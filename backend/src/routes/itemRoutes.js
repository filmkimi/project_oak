const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
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
    const imgValue = image_url || image;

    if (!name || !category || total_qty === undefined) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน (ชื่อ, หมวดหมู่, จำนวน)' });
    }

    const qty = Number(total_qty) || 1;
    const generatedId = new mongoose.Types.ObjectId();

    const newItem = new Item({
      _id: generatedId,
      name,
      item_code: item_code || `AUTO-${generatedId.toString()}`,
      category,
      total_qty: qty,
      available_qty: qty,
      borrowed_qty: 0,
      damaged_qty: 0,
      lost_qty: 0,
      image_url: imgValue || ''
    });

    const savedItem = await newItem.save();

    // แจ้งเตือน Real-time ไปยัง Client (ถ้ามีการตั้งค่า Socket.io ไว้ที่ app)
    const io = req.app.get('io');
    if (io) {
      io.emit('itemAdded', savedItem);
    }

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

    // ค้นหาข้อมูลอุปกรณ์เดิมก่อนเพื่อนำมาคำนวณยอดคงเหลือ
    const currentItem = await Item.findById(req.params.id);
    if (!currentItem) {
      return res.status(404).json({ error: 'ไม่พบอุปกรณ์ที่ต้องการแก้ไข' });
    }

    const updateData = {
      name: name !== undefined ? name : currentItem.name,
      item_code: item_code !== undefined ? item_code : currentItem.item_code,
      category: category !== undefined ? category : currentItem.category,
      image_url: imgValue !== undefined ? imgValue : currentItem.image_url
    };

    // คำนวณ available_qty ใหม่ถ้ามีการเปลี่ยนจำนวนทั้งหมด
    if (total_qty !== undefined) {
      const newTotal = Number(total_qty);
      updateData.total_qty = newTotal;

      const borrowed = currentItem.borrowed_qty || 0;
      const damaged = currentItem.damaged_qty || 0;
      const lost = currentItem.lost_qty || 0;

      // ยอดคงเหลือ = ยอดทั้งหมดใหม่ - ยอดที่ถูกยืม/ชำรุด/สูญหาย (ไม่ให้ติดลบ)
      updateData.available_qty = Math.max(0, newTotal - borrowed - damaged - lost);
    }

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // แจ้งเตือน Real-time ไปยัง Client หน้าบ้าน
    const io = req.app.get('io');
    if (io) {
      io.emit('itemUpdated', updatedItem);
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล', details: error.message });
  }
});

// 4. ลบอุปกรณ์ออกจากคลัง (DELETE)
router.delete('/:id', async (req, res) => {
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);
    if (!deletedItem) {
      return res.status(404).json({ error: 'ไม่พบอุปกรณ์ที่ต้องการลบ' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('itemDeleted', { id: deletedItem._id });
    }

    res.json({ message: 'ลบอุปกรณ์สำเร็จ', id: deletedItem._id });
  } catch (error) {
    res.status(400).json({ error: 'เกิดข้อผิดพลาดในการลบอุปกรณ์', details: error.message });
  }
});

module.exports = router;