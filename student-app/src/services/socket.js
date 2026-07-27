import { io } from 'socket.io-client';

export const getSocketUrl = () => {
  // 1. Check explicit VITE_SOCKET_URL
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL.replace(/\/+$/, '');
  }

  // 2. Check VITE_API_URL and strip /api trailing segment if present
  if (import.meta.env.VITE_API_URL) {
    const cleanApi = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
    return cleanApi.replace(/\/api\/?$/i, '');
  }

  // 3. Production fallback domain for backend service on Render
  return 'https://messmgmt.onrender.com';
};

export const createSocketClient = (authToken = null) => {
  const socketUrl = getSocketUrl();
  console.log(`[Socket.IO Client] Connecting to: ${socketUrl}`);

  const options = {
    transports: ['websocket', 'polling'], // Fallback between websocket & HTTP long-polling
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    withCredentials: true,
  };

  if (authToken) {
    options.auth = { token: authToken };
  }

  const socket = io(socketUrl, options);

  socket.on('connect', () => {
    console.log(`[Socket.IO Client Connected] Socket ID: ${socket.id} (URL: ${socketUrl})`);
  });

  socket.on('connect_error', (err) => {
    console.error(`[Socket.IO Connection Error] ${err.message}`, err);
  });

  socket.on('disconnect', (reason) => {
    console.warn(`[Socket.IO Disconnected] Reason: ${reason}`);
  });

  return socket;
};
