const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const borrowRoutes = require('./routes/borrowRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Base Route
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/borrows', borrowRoutes);
app.use('/api/dashboard', dashboardRoutes);

module.exports = app;