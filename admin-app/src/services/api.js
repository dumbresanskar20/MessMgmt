import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://messmgmt-1.onrender.com/api';
const cleanApiUrl = rawApiUrl.replace(/\/+$/, '');
const API_BASE_URL = cleanApiUrl.endsWith('/api') ? cleanApiUrl : `${cleanApiUrl}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Admin JWT bearer token
api.interceptors.request.use(
  (config) => {
    const rawToken = localStorage.getItem('admin_token');
    if (rawToken && rawToken !== 'null' && rawToken !== 'undefined') {
      const cleanToken = rawToken.replace(/^"(.*)"$/, '$1').trim();
      config.headers.Authorization = `Bearer ${cleanToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: handle 401 Unauthorized errors by clearing stale token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 402) {
      console.warn('[Admin API] 402 Subscription Expired detected');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('subscription_expired', { detail: error.response.data }));
      }
    }
    if (error.response && error.response.status === 401) {
      const errorData = error.response.data || {};
      const isAuthError =
        errorData.code === 'TOKEN_EXPIRED' ||
        errorData.code === 'INVALID_TOKEN' ||
        errorData.code === 'NO_TOKEN' ||
        (errorData.message && errorData.message.toLowerCase().includes('token'));

      if (isAuthError) {
        console.warn('[Admin API] 401 Auth error confirmed — clearing stale admin_token');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('admin_auth_unauthorized'));
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
