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
  { pattern: /^\/api\/savinginterestsettings(\?.*)?$/i, ttl: 5 * 60 * 1000, group: 'savinginterestsettings' },
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

/**
 * Synchronously read cached master data (0ms) so React state can initialize immediately on first render.
 */
export function getCachedMasterData<T = any>(url: string, params?: any): T | null {
  const norm = normalizeApiUrl(url, params);
  const key = buildCacheKey(norm);
  const hit = memoryCache.get(key);
  if (hit && Date.now() - hit.timestamp < hit.ttl) {
    return hit.data as T;
  }
  // Fallback for branch-scoped FdSchemes if global /api/FdSchemes is already cached
  if (norm.toLowerCase().startsWith('/api/fdschemes?')) {
    const baseKey = buildCacheKey('/api/fdschemes');
    const baseHit = memoryCache.get(baseKey);
    if (baseHit && Date.now() - baseHit.timestamp < baseHit.ttl && Array.isArray(baseHit.data)) {
      const sp = new URLSearchParams(norm.split('?')[1] || '');
      const bId = Number(sp.get('branchId') || 0);
      if (bId > 0) {
        return baseHit.data.filter((s: any) => !s.branchID || Number(s.branchID) === bId) as unknown as T;
      }
      return baseHit.data as T;
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
    data,
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
  for (const key of Array.from(memoryCache.keys())) {
    if (key.includes(target)) {
      memoryCache.delete(key);
    }
  }
  // Cross-group invalidations
  if (target.includes('customer') || target.includes('member') || target.includes('share')) {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.includes('/api/customers') || key.includes('/api/members')) {
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
      if (key.includes('/api/ledgers') || key.includes('/api/dashboard')) {
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
      .then((response) => {
        if (response && response.status >= 200 && response.status < 300) {
          memoryCache.set(cacheKey, {
            data: response.data,
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
 * Pre-warm core master datasets in background after login so forms open in 0ms.
 */
export function prewarmMasterDataCache(): void {
  const savedUser = sessionStorage.getItem('bhisi_user') || localStorage.getItem('bhisi_user');
  if (!savedUser) return;

  // Stagger lightly so we don't block initial UI paint
  setTimeout(() => {
    axios.get('/api/Branches').catch(() => {});
    axios.get('/api/SansthaDetails').catch(() => {});
    axios.get('/api/LoanRates').catch(() => {});
    axios.get('/api/SecurityTypes').catch(() => {});
    axios.get('/api/FdSchemes').catch(() => {});
    axios.get('/api/Ledgers').catch(() => {});
    axios.get('/api/Customers').catch(() => {});
  }, 50);
}

