import { io } from 'socket.io-client';

export const getSocketUrl = () => {
  const isBrowser = typeof window !== 'undefined';
  const isLocalhostDomain = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (import.meta.env.VITE_SOCKET_URL) {
    const url = import.meta.env.VITE_SOCKET_URL.replace(/\/+$/, '');
    if (isLocalhostDomain || (!url.includes('localhost') && !url.includes('127.0.0.1'))) {
      return url;
    }
  }

  if (import.meta.env.VITE_API_URL) {
    const cleanApi = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
    const url = cleanApi.replace(/\/api\/?$/i, '');
    if (isLocalhostDomain || (!url.includes('localhost') && !url.includes('127.0.0.1'))) {
      return url;
    }
  }

  return 'https://messmgmt-1.onrender.com';
};

export const createAdminSocketClient = (token) => {
  const socketUrl = getSocketUrl();
  console.log(`[Admin Socket.IO Client] Connecting to: ${socketUrl}`);

  const options = {
    auth: { token },
    transports: ['websocket', 'polling'], // Fallback between websocket & HTTP long-polling
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    withCredentials: true,
  };

  const socket = io(socketUrl, options);

  socket.on('connect', () => {
    console.log(`[Admin Socket.IO Connected] Socket ID: ${socket.id} (URL: ${socketUrl})`);
  });

  socket.on('connect_error', (err) => {
    console.error(`[Admin Socket.IO Connection Error] ${err.message}`, err);
  });

  socket.on('disconnect', (reason) => {
    console.warn(`[Admin Socket.IO Disconnected] Reason: ${reason}`);
  });

  return socket;
};
