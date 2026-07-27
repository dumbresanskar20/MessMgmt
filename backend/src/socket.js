const jwt = require('jsonwebtoken');

const initSocketIO = (io) => {
  // Middleware to authenticate socket connections via JWT token
  io.use((socket, next) => {
    let rawToken = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!rawToken) {
      // Allow anonymous connection for non-sensitive public events if any
      socket.userType = 'anonymous';
      return next();
    }

    if (typeof rawToken === 'string') {
      rawToken = rawToken.replace(/^Bearer\s+/i, '').trim();
    }

    try {
      const decoded = jwt.verify(rawToken, process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production');
      socket.user = decoded;
      if (['super_admin', 'staff'].includes(decoded.role)) {
        socket.userType = 'admin';
      } else if (decoded.role === 'student') {
        socket.userType = 'student';
      }
      return next();
    } catch (err) {
      console.warn(`[Socket.IO Auth Error] Socket ${socket.id} verification failed: ${err.message}`);
      socket.userType = 'anonymous';
      return next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id} (Type: ${socket.userType || 'anonymous'})`);

    // Kitchen Screen Subscription (strictly for authenticated admins)
    socket.on('join:kitchen', () => {
      if (socket.userType === 'admin') {
        socket.join('kitchen');
        console.log(`[Socket.IO] Admin socket ${socket.id} (${socket.user?.username}) joined room 'kitchen'`);
        socket.emit('joined:kitchen', { success: true, message: 'Subscribed to live kitchen order stream.' });
      } else {
        socket.emit('error', { message: 'Unauthorized. Admin token required to join kitchen stream.' });
      }
    });

    // Student Order Subscription
    socket.on('join:student', (studentId) => {
      const targetId = studentId || socket.user?.id || socket.user?.studentId;
      if (targetId) {
        socket.join(`student:${targetId}`);
        console.log(`[Socket.IO] Student socket ${socket.id} joined room 'student:${targetId}'`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};

module.exports = initSocketIO;
