import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

interface CacheEntry {
  data: any;
  status: number;
  statusText: string;
  headers: any;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();

// Master endpoints and their TTLs (in milliseconds)
const CACHEABLE_PATTERNS: Array<{ pattern: RegExp; ttl: number; group: string }> = [
  { pattern: /^\/api\/branches(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'branches' },
  { pattern: /^\/api\/loanrates(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'loanrates' },
  { pattern: /^\/api\/securitytypes(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'securitytypes' },
  { pattern: /^\/api\/sansthadetails(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'sansthadetails' },
  { pattern: /^\/api\/customers(\?.*)?$/i, ttl: 2 * 60 * 1000, group: 'customers' },
  { pattern: /^\/api\/members(\?.*)?$/i, ttl: 2 * 60 * 1000, group: 'members' },
  { pattern: /^\/api\/ledgers(\?.*)?$/i, ttl: 90 * 1000, group: 'ledgers' },
  { pattern: /^\/api\/accountgroups(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'accountgroups' },
  { pattern: /^\/api\/fdschemes(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'fdschemes' },
  { pattern: /^\/api\/rdschemes(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'rdschemes' },
  { pattern: /^\/api\/pigmyschemes(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'pigmyschemes' },
  { pattern: /^\/api\/pigmyagents(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'pigmyagents' },
  { pattern: /^\/api\/shareschemes(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'shareschemes' },
  { pattern: /^\/api\/investmentschemes(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'investmentschemes' },
  { pattern: /^\/api\/investmentinstitutions(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'investmentinstitutions' },
  { pattern: /^\/api\/financialyears(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'financialyears' },
  { pattern: /^\/api\/lockertypes(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'lockertypes' },
  { pattern: /^\/api\/assetcategories(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'assetcategories' },
  { pattern: /^\/api\/shareaccounts\/nextshareconfig(\?.*)?$/i, ttl: 60 * 1000, group: 'nextshareconfig' },
  { pattern: /^\/api\/(savingsettings\/interest|savinginterestsettings)(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'savinginterestsettings' },
  { pattern: /^\/api\/(savingaccounts|savingaccountmasters)(\?.*)?$/i, ttl: 90 * 1000, group: 'savingaccounts' },
  { pattern: /^\/api\/fdaccounts(\?.*)?$/i, ttl: 90 * 1000, group: 'fdaccounts' },
  { pattern: /^\/api\/rdaccounts(\?.*)?$/i, ttl: 90 * 1000, group: 'rdaccounts' },
  { pattern: /^\/api\/pigmyaccounts(\?.*)?$/i, ttl: 90 * 1000, group: 'pigmyaccounts' },
  { pattern: /^\/api\/investmentaccounts(\?.*)?$/i, ttl: 90 * 1000, group: 'investmentaccounts' },
  { pattern: /^\/api\/dashboard(\?.*)?$/i, ttl: 45 * 1000, group: 'dashboard' },
  { pattern: /^\/api\/reports\/(customer360|member360)\/.*$/i, ttl: 45 * 1000, group: 'customer360' },
];

function getActiveBranchContextKey(): string {
  try {
    const globalBranch = localStorage.getItem('globalBranchId') || '';
    const savedUser = sessionStorage.getItem('bhisi_user') || localStorage.getItem('bhisi_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      return `b:${parsed?.branchID || 1}_gb:${globalBranch}_dt:${parsed?.businessDate || ''}`;
    }
    return `gb:${globalBranch}`;
  } catch {
    return 'default';
  }
}

export function normalizeApiUrl(rawUrl: string, params?: any): string {
  if (!rawUrl) return '';
  let clean = rawUrl.trim();
  try {
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const u = new URL(clean);
      clean = u.pathname + u.search;
    }
  } catch {}
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  if (params && typeof params === 'object' && Object.keys(params).length > 0) {
    const sp = new URLSearchParams();
    Object.keys(params)
      .sort()
      .forEach((k) => {
        if (params[k] !== undefined && params[k] !== null) {
          sp.set(k, String(params[k]));
        }
      });
    const qs = sp.toString();
    if (qs) {
      clean += (clean.includes('?') ? '&' : '?') + qs;
    }
  }
  return clean;
}

function getCacheRule(normalizedUrl: string): { ttl: number; group: string } | null {
  for (const rule of CACHEABLE_PATTERNS) {
    if (rule.pattern.test(normalizedUrl)) {
      return { ttl: rule.ttl, group: rule.group };
    }
  }
  return null;
}

function buildCacheKey(normalizedUrl: string): string {
  return `${getActiveBranchContextKey()}::${normalizedUrl.toLowerCase()}`;
}

function ensureParsedCacheData(raw: any): any {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return raw;
      }
    }
  }
  return raw;
}

function ensureJsonStringBody(raw: any): string {
  if (typeof raw === 'string') {
    return raw;
  }
  return JSON.stringify(raw);
}

/**
 * Synchronously read cached master data (0ms) so React state can initialize immediately on first render.
 */
export function getCachedMasterData<T = any>(url: string, params?: any): T | null {
  const norm = normalizeApiUrl(url, params);
  const key = buildCacheKey(norm);
  const hit = memoryCache.get(key);
  if (hit && Date.now() - hit.timestamp < hit.ttl) {
    let parsed = ensureParsedCacheData(hit.data);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (Array.isArray((parsed as any).value)) parsed = (parsed as any).value;
      else if (Array.isArray((parsed as any).data)) parsed = (parsed as any).data;
    }
    hit.data = parsed;
    return parsed as T;
  }
  // Fallback for branch-scoped FdSchemes / RdSchemes if global cache is already populated
  if (norm.toLowerCase().startsWith('/api/fdschemes?') || norm.toLowerCase().startsWith('/api/rdschemes?')) {
    const isRd = norm.toLowerCase().startsWith('/api/rdschemes?');
    const baseKey = buildCacheKey(isRd ? '/api/rdschemes' : '/api/fdschemes');
    const baseHit = memoryCache.get(baseKey);
    if (baseHit && Date.now() - baseHit.timestamp < baseHit.ttl) {
      const baseList = ensureParsedCacheData(baseHit.data);
      baseHit.data = baseList;
      if (Array.isArray(baseList)) {
        const sp = new URLSearchParams(norm.split('?')[1] || '');
        const bId = Number(sp.get('branchId') || 0);
        if (bId > 0) {
          return baseList.filter((s: any) => !s.branchID || Number(s.branchID) === bId) as unknown as T;
        }
        return baseList as T;
      }
    }
  }
  return null;
}

/**
 * Manually set or update cached master data.
 */
export function setCachedMasterData(url: string, data: any, ttlMs = 120000): void {
  const norm = normalizeApiUrl(url);
  const key = buildCacheKey(norm);
  memoryCache.set(key, {
    data: ensureParsedCacheData(data),
    status: 200,
    statusText: 'OK',
    headers: {},
    timestamp: Date.now(),
    ttl: ttlMs,
  });
}

export function markCustomer360Dirty(customerId?: number | string | null): void {
  for (const key of Array.from(memoryCache.keys())) {
    if (key.includes('/api/dashboard') || key.includes('/api/reports/customer360') || key.includes('/api/reports/member360')) {
      memoryCache.delete(key);
    }
  }
  try {
    sessionStorage.setItem('cbs_customer360_dirty', '1');
    sessionStorage.setItem('cbs_customer360_dirty_until', String(Date.now() + 65000));
    if (customerId !== undefined && customerId !== null && String(customerId).trim() !== '' && Number(customerId) > 0) {
      sessionStorage.setItem('last_member360_selected_id', String(customerId));
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('cbs_customer360_cache_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

/**
 * Invalidate cache entries matching a group or URL substring.
 */
export function invalidateApiCache(urlOrGroup?: string): void {
  if (!urlOrGroup) {
    memoryCache.clear();
    return;
  }
  const target = urlOrGroup.toLowerCase();
  // Strip query string and trailing numeric IDs (e.g., '/api/rdschemes/5' -> '/api/rdschemes')
  const baseResource = target.split('?')[0].replace(/\/\d+(\/.*)?$/, '');
  for (const key of Array.from(memoryCache.keys())) {
    if (key.includes(target) || (baseResource && baseResource.startsWith('/api/') && key.includes(baseResource))) {
      memoryCache.delete(key);
    }
  }
  // If any scheme or rate master changes, also invalidate dependent account lists so scheme rates stay fresh
  if (target.includes('rdschemes') || target.includes('rdaccount')) {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.includes('/api/rdaccounts') || key.includes('/api/rdschemes')) {
        memoryCache.delete(key);
      }
    }
  }
  if (target.includes('fdschemes') || target.includes('fdaccount')) {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.includes('/api/fdaccounts') || key.includes('/api/fdschemes')) {
        memoryCache.delete(key);
      }
    }
  }
  if (target.includes('pigmy')) {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.includes('/api/pigmyaccounts') || key.includes('/api/pigmyschemes') || key.includes('/api/pigmyagents')) {
        memoryCache.delete(key);
      }
    }
  }
  if (target.includes('investment')) {
    for (const key of Array.from(memoryCache.keys())) {
      if (
        key.includes('/api/investmentaccounts') ||
        key.includes('/api/investmentschemes') ||
        key.includes('/api/investmentinstitutions')
      ) {
        memoryCache.delete(key);
      }
    }
  }
  if (
    target.includes('savingsettings') ||
    target.includes('savinginterest') ||
    target.includes('savingaccount') ||
    target.includes('savingtransaction')
  ) {
    for (const key of Array.from(memoryCache.keys())) {
      if (
        key.includes('/api/savingaccounts') ||
        key.includes('/api/savingaccountmasters') ||
        key.includes('/api/savingsettings/interest') ||
        key.includes('/api/savinginterestsettings')
      ) {
        memoryCache.delete(key);
      }
    }
  }
  // Cross-group invalidations
  if (target.includes('customer') || target.includes('member') || target.includes('share')) {
    for (const key of Array.from(memoryCache.keys())) {
      if (
        key.includes('/api/customers') ||
        key.includes('/api/members') ||
        key.includes('/api/shareaccounts/nextshareconfig')
      ) {
        memoryCache.delete(key);
      }
    }
  }
  if (
    target.includes('voucher') ||
    target.includes('ledger') ||
    target.includes('disbursement') ||
    target.includes('collection') ||
    target.includes('transaction')
  ) {
    for (const key of Array.from(memoryCache.keys())) {
      if (
        key.includes('/api/ledgers') ||
        key.includes('/api/dashboard') ||
        key.includes('/api/savingaccounts') ||
        key.includes('/api/rdaccounts') ||
        key.includes('/api/pigmyaccounts') ||
        key.includes('/api/fdaccounts')
      ) {
        memoryCache.delete(key);
      }
    }
  }
  if (!target.includes('/api/notification/generate')) {
    markCustomer360Dirty();
  }
}

/**
 * Install smart caching and in-flight deduplication on Axios.
 */
export function setupAxiosCacheAdapter(targetInstance: any = axios): void {
  if (targetInstance.__hasCacheAdapter) return;
  const defaultAdapter = targetInstance.defaults.adapter || axios.defaults.adapter;
  if (!defaultAdapter) return;
  targetInstance.__hasCacheAdapter = true;

  targetInstance.defaults.adapter = async (config: any): Promise<AxiosResponse> => {
    const method = (config.method || 'get').toLowerCase();
    const normUrl = normalizeApiUrl(config.url || '', config.params);

    // Non-GET mutations invalidate relevant master caches immediately
    if (method !== 'get') {
      invalidateApiCache(normUrl);
      if (typeof defaultAdapter === 'function') {
        return defaultAdapter(config);
      }
      return axios.getAdapter(defaultAdapter)(config);
    }

    const rule = getCacheRule(normUrl);
    const runDefault = () => {
      if (typeof defaultAdapter === 'function') {
        return defaultAdapter(config);
      }
      return axios.getAdapter(defaultAdapter)(config);
    };

    if (!rule) {
      return runDefault();
    }

    const cacheKey = buildCacheKey(normUrl);
    const now = Date.now();
    const cached = memoryCache.get(cacheKey);
    if (cached && now - cached.timestamp < cached.ttl) {
      return {
        data: cached.data,
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
        config: config as any,
      };
    }

    // In-flight deduplication for simultaneous identical GET calls
    const existingFlight = inFlightRequests.get(cacheKey);
    if (existingFlight) {
      const sharedRes = await existingFlight;
      return {
        ...sharedRes,
        config: config as any,
      };
    }

    const requestPromise = runDefault()
      .then((response: any) => {
        if (response && response.status >= 200 && response.status < 300) {
          const parsedData = ensureParsedCacheData(response.data);
          memoryCache.set(cacheKey, {
            data: parsedData,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            timestamp: Date.now(),
            ttl: rule.ttl,
          });
        }
        return response;
      })
      .finally(() => {
        inFlightRequests.delete(cacheKey);
      });

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  };
}

/**
 * Shared smart cache & deduplication wrapper for native window.fetch GET requests.
 */
export async function executeCachedFetch(
  originalFetch: typeof window.fetch,
  rawUrl: string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const normUrl = normalizeApiUrl(rawUrl);

  if (method !== 'GET') {
    if (normUrl) {
      invalidateApiCache(normUrl);
    }
    return originalFetch(input, init);
  }

  if (init?.cache === 'no-store' || init?.cache === 'reload') {
    return originalFetch(input, init);
  }

  const rule = getCacheRule(normUrl);
  if (!rule) {
    return originalFetch(input, init);
  }

  const cacheKey = buildCacheKey(normUrl);
  const now = Date.now();
  const cached = memoryCache.get(cacheKey);
  if (cached && now - cached.timestamp < cached.ttl) {
    return new Response(ensureJsonStringBody(cached.data), {
      status: cached.status || 200,
      statusText: cached.statusText || 'OK',
      headers: { ...(cached.headers || {}), 'Content-Type': 'application/json' },
    });
  }

  const existingFlight = inFlightRequests.get(cacheKey);
  if (existingFlight) {
    try {
      const sharedRes = await existingFlight;
      return new Response(ensureJsonStringBody(sharedRes.data), {
        status: sharedRes.status || 200,
        statusText: sharedRes.statusText || 'OK',
        headers: { ...(sharedRes.headers || {}), 'Content-Type': 'application/json' },
      });
    } catch {
      return originalFetch(input, init);
    }
  }

  const fetchPromise = originalFetch(input, init)
    .then(async (response) => {
      if (response && response.ok) {
        const cloned = response.clone();
        try {
          const rawJson = await cloned.json();
          const data = ensureParsedCacheData(rawJson);
          const capturedHeaders: Record<string, string> = {};
          try {
            response.headers.forEach((val, key) => {
              capturedHeaders[key] = val;
            });
          } catch {}
          const entry: CacheEntry = {
            data,
            status: response.status,
            statusText: response.statusText,
            headers: capturedHeaders,
            timestamp: Date.now(),
            ttl: rule.ttl,
          };
          memoryCache.set(cacheKey, entry);
          return { ...entry, rawResponse: response };
        } catch {
          return { data: null, status: response.status, statusText: response.statusText, headers: {}, rawResponse: response };
        }
      }
      return { data: null, status: response.status, statusText: response.statusText, headers: {}, rawResponse: response };
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, fetchPromise);
  const result = await fetchPromise;
  if (result.data !== null && result.data !== undefined) {
    return new Response(ensureJsonStringBody(result.data), {
      status: result.status || 200,
      statusText: result.statusText || 'OK',
      headers: { ...(result.headers || {}), 'Content-Type': 'application/json' },
    });
  }
  return result.rawResponse;
}

/**
 * Pre-warm core master datasets in background after login so forms open in 0ms.
 */
export function prewarmMasterDataCache(): void {
  const savedUser = sessionStorage.getItem('bhisi_user') || localStorage.getItem('bhisi_user');
  if (!savedUser) return;

  // Stage 1: Lightweight core dropdown masters (50ms)
  setTimeout(() => {
    axios.get('/api/Branches').catch(() => {});
    axios.get('/api/SansthaDetails').catch(() => {});
    axios.get('/api/FinancialYears').catch(() => {});
    axios.get('/api/LoanRates').catch(() => {});
    axios.get('/api/SecurityTypes').catch(() => {});
    axios.get('/api/FdSchemes').catch(() => {});
    axios.get('/api/RdSchemes').catch(() => {});
    axios.get('/api/PigmySchemes').catch(() => {});
    axios.get('/api/PigmyAgents').catch(() => {});
    axios.get('/api/SavingSettings/Interest').catch(() => {});
    axios.get('/api/ShareSchemes').catch(() => {});
    axios.get('/api/Ledgers').catch(() => {});
  }, 50);

  // Stage 2: Customer & Member lookup caches (450ms)
  setTimeout(() => {
    axios.get('/api/Customers').catch(() => {});
    axios.get('/api/Members').catch(() => {});
  }, 450);
}

