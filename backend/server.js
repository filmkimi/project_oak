const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const app = require('./src/app');
const connectDB = require('./src/config/db');
const socketService = require('./src/socket');

const PORT = process.env.PORT || 3000;

if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn('Password reset email is unavailable: configure SMTP_HOST, SMTP_USER, and SMTP_PASS in backend/.env');
}

// เชื่อมต่อ MongoDB Atlas ก่อนเริ่ม Server
connectDB();

const server = http.createServer(app);

// ผูก Socket.IO เข้ากับ HTTP Server
app.set('io', socketService.init(server));

server.listen(PORT, () => {
  console.log(`Server & Real-Time Engine running on port ${PORT}`);
});