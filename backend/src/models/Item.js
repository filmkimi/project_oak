const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  item_code: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: ''
  },
  total_qty: {
    type: Number,
    default: 1
  },
  available_qty: {
    type: Number,
    default: 1
  },
  borrowed_qty: {
    type: Number,
    default: 0
  },
  damaged_qty: {
    type: Number,
    default: 0
  },
  lost_qty: {
    type: Number,
    default: 0
  },
  image_url: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);