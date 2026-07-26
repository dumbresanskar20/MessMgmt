const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const initSocketIO = require('./socket');
const { initOrderCleanupJob } = require('./jobs/cleanupOldOrders');

// Load environment variables
dotenv.config();

// Initialize express & http server
const app = express();
const server = http.createServer(app);

// Enable trust proxy for Render / Cloudflare reverse proxy rate-limiting & IP tracking
app.set('trust proxy', 1);

// CORS configuration helper function
const cleanOrigin = (url) => (url ? url.replace(/\/+$/, '') : '');

const rawOrigins = [
  process.env.FRONTEND_STUDENT_URL,
  process.env.FRONTEND_ADMIN_URL,
  'https://mess-mgmt.vercel.app',
  'https://mess-mgmt-fo5r.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

const allowedOrigins = Array.from(
  new Set(rawOrigins.filter(Boolean).map(cleanOrigin))
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalizedOrigin = cleanOrigin(origin);
      if (
        allowedOrigins.includes(normalizedOrigin) ||
        normalizedOrigin.endsWith('.vercel.app') ||
        process.env.NODE_ENV !== 'production'
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

initSocketIO(io);
app.set('socketio', io);

const { apiLimiter } = require('./middleware/rateLimiter');

// API Routes
app.use('/api/auth/student', require('./routes/studentAuthRoutes'));
app.use('/api/auth/admin', require('./routes/adminAuthRoutes'));
app.use('/api/menu', apiLimiter, require('./routes/menuRoutes'));
app.use('/api/orders', apiLimiter, require('./routes/orderRoutes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Mess Management System API',
    timestamp: new Date().toISOString(),
  });
});

// Root fallback
app.get('/', (req, res) => {
  res.send('Mess Management System API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  // Initialize daily automated order history cleanup background job
  initOrderCleanupJob();

  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Mess Management Server running on port ${PORT}`);
    console.log(`📡 Socket.IO server active`);
    console.log(`==================================================\n`);
  });
});
