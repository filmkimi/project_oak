const http = require('http');
require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const socketService = require('./src/socket');

const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDB();

  const server = http.createServer(app);
  socketService.init(server);

  server.listen(PORT, () => {
    console.log(`Server & Real-Time Engine running on port ${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Server startup failed:', error.message);
  process.exitCode = 1;
});