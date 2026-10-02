const express = require('express');
const router = express.Router();
const Item = require('../models/Item');

// 1. ดึงรายการอุปกรณ์ทั้งหมด (GET)
router.get('/', async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์', error: error.message });
  }
});

// 2. เพิ่มอุปกรณ์ใหม่เข้าคลัง (POST)
router.post('/', async (req, res) => {
  try {
    // รองรับทั้งฟิลด์ image และ image_url เพื่อความปลอดภัย
    const { name, item_code, category, total_qty, image, image_url } = req.body;
    const finalImage = image_url || image || '';

    // ตรวจสอบข้อมูลเบื้องต้น
    if (!name || !item_code) {
      return res.status(400).json({ error: 'กรุณากรอกชื่ออุปกรณ์และรหัสอุปกรณ์' });
    }

    const qty = Number(total_qty) || 1;

    const newItem = new Item({
      name,
      item_code,
      category: category || '',
      total_qty: qty,
      available_qty: qty, // ป้องกัน Error กรณีที่ Model บังคับใช้ฟิลด์นี้
      borrowed_qty: 0,
      image: finalImage,
      image_url: finalImage
    });

    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
  } catch (error) {
    res.status(400).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', details: error.message });
  }
});

// 3. แก้ไขข้อมูลอุปกรณ์ (PUT)
router.put('/:id', async (req, res) => {
  try {
    const { name, item_code, category, total_qty, image, image_url } = req.body;
    const finalImage = image_url || image || '';
    
    const updateData = {
      name,
      item_code,
      category,
      image: finalImage,
      image_url: finalImage
    };

    if (total_qty !== undefined) {
      updateData.total_qty = Number(total_qty);
    }

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ error: 'ไม่พบอุปกรณ์ที่ต้องการแก้ไข' });
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล', details: error.message });
  }
});

module.exports = router;