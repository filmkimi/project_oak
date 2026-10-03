const mongoose = require('mongoose');
const BorrowRequest = require('../models/BorrowRequest');
const Item = require('../models/Item');
const socket = require('../socket');

exports.getMyRequests = async (req, res) => {
  try {
    const requests = await BorrowRequest.find({ user: req.user.id })
      .populate('user', 'identifier_code full_name department role')
      .populate('items.item', 'name item_code category available_qty')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 1. ดึงรายการคำขอยืมทั้งหมด (สำหรับแสดงผลบนตารางหน้า admin.html)
exports.getAllRequests = async (req, res) => {
  try {
    const { status, role } = req.query;
    const validStatuses = ['pending', 'approved', 'rejected', 'returned', 'overdue'];
    const validRoles = ['student', 'teacher', 'admin'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'สถานะคำขอไม่ถูกต้อง' });
    }
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'ประเภทผู้ใช้ไม่ถูกต้อง' });
    }

    let requests = await BorrowRequest.find(status ? { status } : {})
      .populate('user', 'identifier_code full_name department role')
      .populate('items.item', 'name item_code category available_qty')
      .sort({ createdAt: -1 });

    if (role) {
      requests = requests.filter(request => request.user?.role === role);
    }

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateRequestStatus = async (req, res) => {
  const { status } = req.body;

  if (status === 'approved') {
    return exports.approveRequest(req, res);
  }

  if (status === 'returned') {
    try {
      const request = await BorrowRequest.findById(req.params.id);
      if (!request || request.status !== 'approved') {
        return res.status(400).json({ error: 'ไม่พบคำขอ หรือคำขอนี้ยังไม่อยู่ในสถานะกำลังยืม' });
      }

      req.body.return_records = request.items.map(item => ({
        item_id: item.item,
        returned_qty: item.requested_qty,
        damaged_qty: 0,
        lost_qty: 0
      }));
      return exports.returnItems(req, res);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (status === 'rejected') {
    try {
      const request = await BorrowRequest.findById(req.params.id);
      if (!request || request.status !== 'pending') {
        return res.status(400).json({ error: 'ไม่พบคำขอ หรือคำขอนี้ถูกประมวลผลไปแล้ว' });
      }

      request.status = 'rejected';
      await request.save();
      socket.getIO().emit('request_status_changed', {
        requestId: request._id,
        status: 'rejected'
      });
      return res.json({ message: 'ปฏิเสธคำขอยืมเรียบร้อยแล้ว', request });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'สถานะคำขอไม่ถูกต้อง' });
};

// 2. นักศึกษาส่งคำขอยืม (บันทึกข้อมูลและส่ง Socket ไปยังหน้า Admin)
exports.createRequest = async (req, res) => {
  try {
    const {
      group_name,
      project_name,
      purpose,
      borrow_date,
      due_date,
      items
    } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    }
    if (!project_name || !purpose || !due_date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลคำขอยืมให้ครบถ้วน' });
    }

    const newRequest = await BorrowRequest.create({
      user: userId,
      group_name,
      project_name,
      purpose,
      borrow_date: borrow_date || new Date(),
      due_date,
      items
    });

    const populatedRequest = await BorrowRequest.findById(newRequest._id)
      .populate('user', 'identifier_code full_name department')
      .populate('items.item', 'name item_code category available_qty');

    // ส่งสัญญาณ Real-time ไปแจ้งเตือนหน้าจอ Admin ทันที
    try {
      socket.getIO().emit('new_borrow_request', populatedRequest);
    } catch (sErr) {
      console.warn('Socket emit warning:', sErr.message);
    }

    res.status(201).json({ 
      message: 'ส่งคำขอยืมสำเร็จเรียบร้อย', 
      data: populatedRequest 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Admin อนุมัติการยืม (ตัดสต็อกอุปกรณ์ด้วย Transaction)
exports.approveRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const adminId = req.user?.id || req.body.admin_id;

    const request = await BorrowRequest.findById(id).session(session);
    if (!request || request.status !== 'pending') {
      throw new Error('ไม่พบคำขอยืม หรือคำขอนี้ถูกประมวลผลไปแล้ว');
    }

    const updatedItems = [];

    for (const lineItem of request.items) {
      const item = await Item.findById(lineItem.item).session(session);
      if (!item || item.available_qty < lineItem.requested_qty) {
        throw new Error(`อุปกรณ์ ${item ? item.name : lineItem.item} มีจำนวนคงเหลือไม่เพียงพอ`);
      }

      // ตัดจำนวนที่สามารถยืมได้
      item.available_qty -= lineItem.requested_qty;
      if (item.category === 'durable') {
        item.borrowed_qty += lineItem.requested_qty;
      }
      await item.save({ session });
      updatedItems.push(item);
    }

    request.status = 'approved';
    if (adminId) request.approved_by = adminId;
    await request.save({ session });

    await session.commitTransaction();

    // ส่งสัญญาณอัปเดตสต็อกและสถานะคำขอไปยัง Client ทุกคนแบบ Real-time
    try {
      socket.getIO().emit('stock_updated', updatedItems);
      socket.getIO().emit('request_status_changed', {
        requestId: request._id,
        status: 'approved'
      });
    } catch (sErr) {
      console.warn('Socket emit warning:', sErr.message);
    }

    res.json({ message: 'อนุมัติคำขอยืมและตัดสต็อกเรียบร้อยแล้ว', request });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// 4. บันทึกการคืนอุปกรณ์ (เพิ่มสต็อกกลับเข้าคลัง)
exports.returnItems = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { return_records } = req.body; // รูปแบบ: [{ item_id, returned_qty, damaged_qty, lost_qty }]
    
    const request = await BorrowRequest.findById(id).session(session);
    if (!request || request.status !== 'approved') {
      throw new Error('คำขอนี้ไม่อยู่ในสถานะที่สามารถบันทึกการคืนได้');
    }

    const updatedStockList = [];

    for (const record of return_records) {
      const item = await Item.findById(record.item_id).session(session);
      if (!item) continue;

      if (item.category === 'durable') {
        item.borrowed_qty -= (record.returned_qty + record.damaged_qty + record.lost_qty);
        item.available_qty += record.returned_qty;
        item.damaged_qty += record.damaged_qty;
        item.lost_qty += record.lost_qty;
        await item.save({ session });
        updatedStockList.push(item);
      }
    }

    request.status = 'returned';
    request.return_date = new Date();
    await request.save({ session });

    await session.commitTransaction();

    // แจ้งเตือน Real-time ว่าสต็อกกลับเข้าสู่ระบบแล้ว
    try {
      socket.getIO().emit('stock_updated', updatedStockList);
      socket.getIO().emit('request_status_changed', { 
        requestId: request._id, 
        status: 'returned' 
      });
    } catch (sErr) {
      console.warn('Socket emit warning:', sErr.message);
    }

    res.json({ message: 'บันทึกการคืนอุปกรณ์และคืนสต็อกสำเร็จ' });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};