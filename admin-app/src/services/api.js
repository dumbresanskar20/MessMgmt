import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://messmgmt.onrender.com/api';
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
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
