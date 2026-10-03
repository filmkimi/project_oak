const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Configure it in backend/.env.');
  }

  const conn = await mongoose.connect(process.env.MONGODB_URI);
  console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
};

module.exports = connectDB;