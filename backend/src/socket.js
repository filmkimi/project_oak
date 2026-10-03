const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: '*', // กำหนด Domain Frontend ภายหลังได้
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next();
      if (!process.env.JWT_SECRET) return next(new Error('Authentication is not configured'));

      try {
        socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
      } catch (error) {
        return next(new Error('Invalid authentication token'));
      }
    });

    io.on('connection', (socket) => {
      if (socket.data.user?.role === 'admin') socket.join('admins');
      console.log(`Client connected: ${socket.id}`);
      
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io is not initialized!');
    }
    return io;
  }
};