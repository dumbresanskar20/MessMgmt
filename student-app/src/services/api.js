import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://messmgmt.onrender.com/api';
const cleanApiUrl = rawApiUrl.replace(/\/+$/, '');
const API_BASE_URL = cleanApiUrl.endsWith('/api') ? cleanApiUrl : `${cleanApiUrl}/api`;

// [Diagnostics] Check API URL protocol for HTTPS vs HTTP (Mixed Content Protection)
console.log(`[Razorpay Diagnostics] Frontend API Base URL configured: ${API_BASE_URL}`);

if (typeof window !== 'undefined' && window.location.protocol === 'https:' && API_BASE_URL.startsWith('http:')) {
  console.error('[Razorpay Diagnostics] CRITICAL: Web app is served over HTTPS but VITE_API_URL is HTTP. Browsers will block these API calls as Mixed Content!');
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Student JWT token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('student_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token invalidation
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[API Interceptor] 401 Unauthorized detected - clearing stale session tokens.');
      localStorage.removeItem('student_token');
      localStorage.removeItem('student_user');
    }
    return Promise.reject(error);
  }
);

export default api;
