import React from 'react'
import ReactDOM from 'react-dom'
import axios from 'axios'
import './index.css'
import App from './App'

import { AuthProvider } from './context/AuthContext'
import { getApiBaseUrl } from './utils/api'

const apiBase = getApiBaseUrl();

// In dev mode, rely on Vite's proxy for /api requests to prevent browser CORS / "Failed to fetch" errors.
const shouldPrependApiBase = !import.meta.env.DEV && Boolean(apiBase);

if (shouldPrependApiBase) {
  axios.defaults.baseURL = apiBase;
}

// Helper function: Converts Marathi Devanagari numerals (०-९) to English digits (0-9)
export const convertMarathiDigits = (val: string): string => {
  if (!val) return val;
  return val.replace(/[०-९]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 48));
};

// Global DOM input listener for real-time Marathi number conversion in input/textarea elements
if (typeof window !== 'undefined') {
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      if (typeof target.value === 'string' && /[०-९]/.test(target.value)) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        target.value = convertMarathiDigits(target.value);
        if (start !== null && end !== null && target.type !== 'number' && target.type !== 'date') {
          try {
            target.setSelectionRange(start, end);
          } catch (_) {}
        }
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, true);
}

// Global Axios Request Interceptor (attaches Bearer Token & handles Marathi digits & URL prefix)
axios.interceptors.request.use((config) => {
  if (shouldPrependApiBase && config.url && config.url.startsWith('/api')) {
    config.url = `${apiBase}${config.url}`;
  }

  if (config.data) {
    if (typeof config.data === 'string') {
      config.data = convertMarathiDigits(config.data);
    } else if (typeof config.data === 'object' && config.data !== null && !(config.data instanceof FormData)) {
      try {
        config.data = JSON.parse(convertMarathiDigits(JSON.stringify(config.data)));
      } catch (_) {}
    }
  }

  const savedUser = localStorage.getItem('bhisi_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      if (user?.token) {
        config.headers = config.headers || {};
        if (!config.headers['Authorization']) {
          config.headers['Authorization'] = `Bearer ${user.token}`;
        }
      }
    } catch (e) {
      console.error('Failed to parse saved user for token', e);
    }
  }
  return config;
}, (error) => Promise.reject(error));

// Global Axios Response Interceptor (handles 401 Unauthorized / Expired session tokens)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config && error.config.url && error.config.url.includes('/api/Auth/login');
      if (!isLoginRequest && localStorage.getItem('bhisi_user')) {
        console.warn("Session expired or unauthorized. Clearing user session.");
        localStorage.removeItem('bhisi_user');
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

// Global Fetch Interceptor (attaches Bearer Token & handles Marathi digits & URL prefix)
const originalFetch = window.fetch;
window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  let urlStr = '';
  if (typeof input === 'string') {
    urlStr = input;
    if (shouldPrependApiBase) {
      if (urlStr.startsWith('/api')) {
        input = `${apiBase}${urlStr}`;
      } else if (urlStr.startsWith('api/')) {
        input = `${apiBase}/${urlStr}`;
      } else if (typeof window !== 'undefined' && urlStr.startsWith(window.location.origin + '/api')) {
        input = urlStr.replace(window.location.origin, apiBase);
      }
    }
  } else if (input instanceof URL) {
    urlStr = input.pathname;
    if (shouldPrependApiBase && (urlStr.startsWith('/api') || urlStr.startsWith('api/'))) {
      const cleanPath = urlStr.startsWith('/') ? urlStr : `/${urlStr}`;
      input = new URL(`${apiBase}${cleanPath}${input.search}`);
    }
  } else if (typeof input === 'object' && input !== null && 'url' in input && typeof (input as any).url === 'string') {
    urlStr = (input as any).url;
    if (shouldPrependApiBase) {
      if (urlStr.startsWith('/api')) {
        input = new Request(`${apiBase}${urlStr}`, input);
      } else if (urlStr.startsWith('api/')) {
        input = new Request(`${apiBase}/${urlStr}`, input);
      }
    }
  }

  if (init && init.body) {
    if (typeof init.body === 'string') {
      init.body = convertMarathiDigits(init.body);
    }
  }

  const savedUser = localStorage.getItem('bhisi_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      if (user?.token) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${user.token}`);
        }
        init.headers = headers;
      }
    } catch (e) {
      console.error('Failed to parse saved user for fetch token', e);
    }
  }

  return originalFetch(input, init);
};

import { BrowserRouter } from 'react-router-dom'

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
)
