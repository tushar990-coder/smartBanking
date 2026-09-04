import axios from 'axios';

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      if (!host.startsWith('api.')) {
        return `${window.location.protocol}//api.${host}`;
      }
    }
  }
  return '';
};

const apiBase = getApiBaseUrl();

// Helper function: Converts Marathi Devanagari numerals (०-९) to English digits (0-9)
export const convertMarathiDigits = (val: string): string => {
  if (!val) return val;
  return val.replace(/[०-९]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 48));
};

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  try {
    // 1. Normalize URL to always target /api/... cleanly
    let url = config.url || '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (!url.startsWith('/api/') && url !== '/api') {
        url = url.startsWith('/') ? `/api${url}` : `/api/${url}`;
      }
      const currentApiBase = getApiBaseUrl();
      if (currentApiBase) {
        url = `${currentApiBase}${url}`;
      }
      config.url = url;
    }

    // 2. Convert Marathi digits in payload
    if (config.data) {
      if (typeof config.data === 'string') {
        config.data = convertMarathiDigits(config.data);
      } else if (typeof config.data === 'object' && config.data !== null && !(config.data instanceof FormData)) {
        try {
          config.data = JSON.parse(convertMarathiDigits(JSON.stringify(config.data)));
        } catch (_) {}
      }
    }

    // 3. Attach Auth token & Branch ID
    const savedUser = localStorage.getItem('bhisi_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user?.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
      if (user?.branchID) {
        config.headers['X-Branch-ID'] = user.branchID.toString();
      }
    }
  } catch (err) {
    console.error('Error in api request interceptor', err);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Force instant logout across application
      localStorage.removeItem('bhisi_user');
      localStorage.removeItem('globalBranchId');
      sessionStorage.removeItem('just_logged_in');
      window.dispatchEvent(new CustomEvent('auth-unauthorized'));
    }
    if (error.response?.status === 423) {
      // License Locked / Expired / Mismatch
      window.dispatchEvent(new CustomEvent('license-locked', { detail: error.response.data }));
    }
    return Promise.reject(error);
  }
);

export default api;
