const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const BorrowRequest = require('../models/BorrowRequest');
const { authenticate, requireRole } = require('../middleware/auth');
const socket = require('../socket');

function notifyStockChanged(item) {
  try {
    socket.getIO().emit('stock_updated', [item]);
  } catch (error) {
    if (error.message !== 'Socket.io is not initialized!') {
      console.warn('Socket emit warning (stock_updated):', error.message);
    }
  }
}

function validateItem(body, { creating = false } = {}) {
  const { item_code, name, category, total_qty, image_url = '', description = '' } = body || {};
  if (typeof item_code !== 'string' || !item_code.trim() ||
      typeof name !== 'string' || !name.trim() ||
      !['durable', 'consumable'].includes(category)) {
    return 'กรุณากรอกรหัส ชื่อ และประเภทอุปกรณ์ให้ถูกต้อง';
  }
  if (creating && (!Number.isInteger(total_qty) || total_qty < 0)) {
    return 'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป';
  }
  if (typeof total_qty !== 'undefined' && (!Number.isInteger(total_qty) || total_qty < 0)) {
    return 'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป';
  }
  if (typeof image_url !== 'string' || typeof description !== 'string') {
    return 'รูปภาพหรือลักษณะสินค้าไม่ถูกต้อง';
  }
  return null;
}

router.get('/', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    return res.json(items);
  } catch (error) {
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์', error: error.message });
  }
});

router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const validationError = validateItem(req.body, { creating: true });
    if (validationError) return res.status(400).json({ message: validationError });

    const item = await Item.create({
      item_code: req.body.item_code.trim(),
      name: req.body.name.trim(),
      category: req.body.category,
      total_qty: req.body.total_qty,
      available_qty: req.body.total_qty,
      image_url: req.body.image_url.trim(),
      description: req.body.description.trim()
    });
    notifyStockChanged(item);
    return res.status(201).json({ message: 'เพิ่มสินค้าเรียบร้อยแล้ว', data: item });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'รหัสสินค้านี้มีอยู่ในระบบแล้ว' });
    return res.status(500).json({ message: 'เพิ่มสินค้าไม่สำเร็จ', error: error.message });
  }
});

router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: 'รหัสสินค้าไม่ถูกต้อง' });
    }
    const validationError = validateItem(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'ไม่พบสินค้านี้' });
    if (req.body.category !== item.category && item.borrowed_qty > 0) {
      return res.status(409).json({ message: 'เปลี่ยนประเภทสินค้าไม่ได้ขณะที่ยังมีรายการถูกยืม' });
    }
    if (typeof req.body.total_qty !== 'undefined') {
      const quantityChange = req.body.total_qty - item.total_qty;
      if (item.available_qty + quantityChange < 0) {
        return res.status(409).json({ message: 'ลดจำนวนรวมไม่ได้ต่ำกว่าจำนวนที่มีอยู่หรือกำลังถูกยืม' });
      }
      item.total_qty = req.body.total_qty;
      item.available_qty += quantityChange;
    }

    item.item_code = req.body.item_code.trim();
    item.name = req.body.name.trim();
    item.category = req.body.category;
    item.image_url = req.body.image_url.trim();
    item.description = req.body.description.trim();
    await item.save();
    notifyStockChanged(item);
    return res.json({ message: 'แก้ไขสินค้าเรียบร้อยแล้ว', data: item });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'รหัสสินค้านี้มีอยู่ในระบบแล้ว' });
    return res.status(500).json({ message: 'แก้ไขสินค้าไม่สำเร็จ', error: error.message });
  }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: 'รหัสสินค้าไม่ถูกต้อง' });
    }
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'ไม่พบสินค้านี้' });
    if (item.borrowed_qty > 0) {
      return res.status(409).json({ message: 'ลบสินค้าที่กำลังถูกยืมไม่ได้' });
    }
    const referenced = await BorrowRequest.exists({ 'items.item': item._id });
    if (referenced) {
      return res.status(409).json({ message: 'ลบสินค้าที่มีประวัติคำขอยืมไม่ได้' });
    }
    await item.deleteOne();
    notifyStockChanged({ _id: item._id, deleted: true });
    return res.json({ message: 'ลบสินค้าเรียบร้อยแล้ว' });
  } catch (error) {
    return res.status(500).json({ message: 'ลบสินค้าไม่สำเร็จ', error: error.message });
  }
});

module.exports = router;