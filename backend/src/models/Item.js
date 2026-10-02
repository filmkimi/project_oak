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
    const { name, item_code, category, total_qty, image, image_url } = req.body;
    const imgValue = image_url || image; // รองรับทั้งสองชื่อคีย์

    // ตรวจสอบข้อมูลเบื้องต้น
    if (!name || !item_code || !category || total_qty === undefined) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน (ชื่อ, รหัส, หมวดหมู่, จำนวน)' });
    }

    const qty = Number(total_qty) || 1;

    const newItem = new Item({
      name,
      item_code,
      category,
      total_qty: qty,
      available_qty: qty, // ตั้งค่าเริ่มต้นให้ของว่างเท่ากับจำนวนทั้งหมด
      borrowed_qty: 0,
      damaged_qty: 0,
      lost_qty: 0,
      image_url: imgValue || '' 
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
    const imgValue = image_url || image;
    
    const updateData = {
      name,
      item_code,
      category,
      image_url: imgValue
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