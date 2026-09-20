const mongoose = require('mongoose');
const BorrowRequest = require('../models/BorrowRequest');
const Item = require('../models/Item');
const socket = require('../socket');

// 1. นักศึกษาส่งคำขอยืม
exports.createRequest = async (req, res) => {
  try {
    const { group_name, project_name, purpose, borrow_date, due_date, items } = req.body;

    const newRequest = await BorrowRequest.create({
      user: req.user.id,
      group_name,
      project_name,
      purpose,
      borrow_date,
      due_date,
      items
    });

    const populatedRequest = await newRequest.populate(['user', 'items.item']);

    // แจ้งเตือน Admin และ Dashboard แบบ Real-time
    socket.getIO().emit('new_borrow_request', populatedRequest);

    res.status(201).json({ message: 'Borrow request created', data: populatedRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Admin อนุมัติการยืม (ตัดสต็อก)
exports.approveRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const request = await BorrowRequest.findById(id).session(session);

    if (!request || request.status !== 'pending') {
      throw new Error('Request not found or already processed');
    }

    const updatedItems = [];

    for (const lineItem of request.items) {
      const item = await Item.findById(lineItem.item).session(session);
      if (!item || item.available_qty < lineItem.requested_qty) {
        throw new Error(`Insufficient stock for item: ${item ? item.name : lineItem.item}`);
      }

      item.available_qty -= lineItem.requested_qty;
      if (item.category === 'durable') {
        item.borrowed_qty += lineItem.requested_qty;
      }
      await item.save({ session });
      updatedItems.push(item);
    }

    request.status = 'approved';
    request.approved_by = req.user.id;
    await request.save({ session });

    await session.commitTransaction();

    // Broadcast Real-time ให้อุปกรณ์ที่สต็อกเปลี่ยน และสถานะคำขอที่เปลี่ยน
    socket.getIO().emit('stock_updated', updatedItems);
    socket.getIO().emit('request_status_changed', {
      requestId: request._id,
      status: 'approved'
    });

    res.json({ message: 'Request approved successfully', request });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// 3. บันทึกการคืนอุปกรณ์
exports.returnItems = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { return_records } = req.body; // [{ item_id, returned_qty, damaged_qty, lost_qty }]
    const request = await BorrowRequest.findById(id).session(session);

    if (!request || request.status !== 'approved') {
      throw new Error('Invalid request for return');
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

    // แจ้งเตือน Real-time ให้ทุก Client ทราบว่าสต็อกคืนเข้าคลังแล้ว
    socket.getIO().emit('stock_updated', updatedStockList);
    socket.getIO().emit('request_status_changed', { requestId: request._id, status: 'returned' });

    res.json({ message: 'Return recorded successfully' });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ error: error.message });
  } finally {
    session.endSession();
  }
};