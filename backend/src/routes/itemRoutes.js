const express = require('express');
const router = express.Router();
const Item = require('../models/Item');

// ดึงรายการอุปกรณ์ทั้งหมด
router.get('/', async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์', error: error.message });
  }
});

module.exports = router;