const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const borrowRoutes = require('./routes/borrowRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  return res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'unavailable',
    database: databaseReady ? 'connected' : 'disconnected'
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/borrows', borrowRoutes);
app.use(express.static(path.join(__dirname, '..', '..', 'Frontend')));

module.exports = app;