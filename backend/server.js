const http = require('http');
require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const socketService = require('./src/socket');

const PORT = process.env.PORT || 3000;

// เชื่อมต่อ MongoDB Atlas ก่อนเริ่ม Server
connectDB();

const server = http.createServer(app);

// ผูก Socket.IO เข้ากับ HTTP Server
socketService.init(server);

server.listen(PORT, () => {
  console.log(`Server & Real-Time Engine running on port ${PORT}`);
});