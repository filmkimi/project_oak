const mongoose = require('mongoose');
const BorrowRequest = require('../models/BorrowRequest');
const Item = require('../models/Item');
const socket = require('../socket');

function fail(res, status, message) {
  return res.status(status).json({ message });
}

function emitSafely(event, payload, adminsOnly = false) {
  try {
    const io = socket.getIO();
    if (adminsOnly) io.to('admins').emit(event, payload);
    else io.emit(event, payload);
  } catch (error) {
    console.warn(`Socket emit warning (${event}):`, error.message);
  }
}

exports.getAllRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      if (!['pending', 'approved', 'rejected', 'returned', 'overdue'].includes(req.query.status)) {
        return fail(res, 400, 'สถานะคำขอไม่ถูกต้อง');
      }
      filter.status = req.query.status;
    }

    const requests = await BorrowRequest.find(filter)
      .populate('user', 'identifier_code full_name department role email phone')
      .populate('items.item', 'name item_code category available_qty')
      .populate('approved_by', 'full_name')
      .sort({ createdAt: -1 });
    const filteredRequests = req.query.role
      ? requests.filter(request => request.user && request.user.role === req.query.role)
      : requests;

    return res.json(filteredRequests);
  } catch (error) {
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการยืมได้', error: error.message });
  }
};

exports.createRequest = async (req, res) => {
  try {
    const { group_name = '', project_name, purpose, borrow_date, due_date, items } = req.body || {};
    const normalizedProject = typeof project_name === 'string' ? project_name.trim() : '';
    const normalizedPurpose = typeof purpose === 'string' ? purpose.trim() : '';
    if (!normalizedProject || !normalizedPurpose || !due_date || !Array.isArray(items) || items.length === 0) {
      return fail(res, 400, 'กรุณาระบุโปรเจกต์ วัตถุประสงค์ วันคืน และรายการอุปกรณ์');
    }

    const borrowDate = borrow_date ? new Date(borrow_date) : new Date();
    const dueDate = new Date(due_date);
    if (Number.isNaN(borrowDate.getTime()) || Number.isNaN(dueDate.getTime()) || dueDate <= borrowDate) {
      return fail(res, 400, 'วันที่คืนต้องอยู่หลังวันที่ยืม');
    }

    const seenItems = new Set();
    for (const entry of items) {
      if (!entry || !mongoose.isValidObjectId(entry.item) ||
          !Number.isInteger(entry.requested_qty) || entry.requested_qty < 1) {
        return fail(res, 400, 'รายการอุปกรณ์หรือจำนวนที่ขอยืมไม่ถูกต้อง');
      }
      if (seenItems.has(String(entry.item))) {
        return fail(res, 400, 'ไม่สามารถส่งอุปกรณ์รายการเดิมซ้ำได้');
      }
      seenItems.add(String(entry.item));
    }

    const stockItems = await Item.find({ _id: { $in: [...seenItems] } })
      .select('name available_qty');
    if (stockItems.length !== seenItems.size) {
      return fail(res, 400, 'ไม่พบอุปกรณ์บางรายการในระบบ');
    }
    const stockById = new Map(stockItems.map(item => [String(item._id), item]));
    for (const entry of items) {
      if (stockById.get(String(entry.item)).available_qty < entry.requested_qty) {
        return fail(res, 409, `อุปกรณ์ ${stockById.get(String(entry.item)).name} มีจำนวนคงเหลือไม่เพียงพอ`);
      }
    }

    const request = await BorrowRequest.create({
      user: req.user.id,
      group_name,
      project_name: normalizedProject,
      purpose: normalizedPurpose,
      borrow_date: borrowDate,
      due_date: dueDate,
      items
    });
    const populatedRequest = await BorrowRequest.findById(request._id)
      .populate('user', 'identifier_code full_name department')
      .populate('items.item', 'name item_code category available_qty');

    emitSafely('new_borrow_request', populatedRequest, true);
    return res.status(201).json({
      message: 'ส่งคำขอยืมสำเร็จเรียบร้อย',
      data: populatedRequest
    });
  } catch (error) {
    return res.status(500).json({ message: 'ไม่สามารถส่งคำขอยืมได้', error: error.message });
  }
};

exports.approveRequest = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return fail(res, 400, 'รหัสคำขอยืมไม่ถูกต้อง');
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const request = await BorrowRequest.findById(req.params.id).session(session);
    if (!request) {
      await session.abortTransaction();
      return fail(res, 404, 'ไม่พบคำขอยืมนี้');
    }
    if (request.status !== 'pending') {
      await session.abortTransaction();
      return fail(res, 409, 'คำขอนี้ถูกจัดการไปแล้ว');
    }

    const updatedItems = [];
    for (const lineItem of request.items) {
      const inventory = await Item.findById(lineItem.item).select('category').session(session);
      if (!inventory) {
        throw Object.assign(new Error('ไม่พบอุปกรณ์ในคำขอยืม'), { statusCode: 409 });
      }
      const increments = {
        available_qty: -lineItem.requested_qty,
        ...(inventory.category === 'durable' ? { borrowed_qty: lineItem.requested_qty } : {})
      };
      const item = await Item.findOneAndUpdate(
        { _id: lineItem.item, available_qty: { $gte: lineItem.requested_qty } },
        { $inc: increments },
        { returnDocument: 'after', session, runValidators: true }
      );
      if (!item) {
        throw Object.assign(new Error('อุปกรณ์มีจำนวนคงเหลือไม่เพียงพอ หรือไม่พบรายการ'), { statusCode: 409 });
      }
      updatedItems.push(item);
    }

    request.status = 'approved';
    request.approved_by = req.user.id;
    await request.save({ session });
    await session.commitTransaction();

    emitSafely('stock_updated', updatedItems);
    emitSafely('request_status_changed', { requestId: request._id, status: 'approved' }, true);
    return res.json({ message: 'อนุมัติคำขอยืมและตัดสต็อกเรียบร้อยแล้ว', request });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    return res.status(error.statusCode || 400).json({ message: error.message });
  } finally {
    await session.endSession();
  }
};

exports.returnItems = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return fail(res, 400, 'รหัสคำขอยืมไม่ถูกต้อง');
  }

  const { return_records: returnRecords } = req.body || {};
  if (!Array.isArray(returnRecords)) {
    return fail(res, 400, 'รูปแบบรายการคืนอุปกรณ์ไม่ถูกต้อง');
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const request = await BorrowRequest.findById(req.params.id).session(session);
    if (!request) {
      await session.abortTransaction();
      return fail(res, 404, 'ไม่พบรายการยืมนี้');
    }
    if (request.status !== 'approved') {
      await session.abortTransaction();
      return fail(res, 409, 'คำขอนี้ไม่ได้อยู่ในสถานะกำลังยืม');
    }

    const durableLines = [];
    for (const lineItem of request.items) {
      const item = await Item.findById(lineItem.item).select('category').session(session);
      if (item && item.category === 'durable') durableLines.push(lineItem);
    }
    const lineById = new Map(durableLines.map(line => [String(line.item), line]));
    const seen = new Set();
    const updatedItems = [];

    for (const record of returnRecords) {
      if (!record || !mongoose.isValidObjectId(record.item_id) ||
          !Number.isInteger(record.returned_qty) || record.returned_qty < 0 ||
          !Number.isInteger(record.damaged_qty || 0) || (record.damaged_qty || 0) < 0 ||
          !Number.isInteger(record.lost_qty || 0) || (record.lost_qty || 0) < 0) {
        await session.abortTransaction();
        return fail(res, 400, 'จำนวนอุปกรณ์ที่คืน ชำรุด หรือสูญหายไม่ถูกต้อง');
      }

      const itemId = String(record.item_id);
      const lineItem = lineById.get(itemId);
      if (!lineItem || seen.has(itemId)) {
        await session.abortTransaction();
        return fail(res, 400, 'พบอุปกรณ์ที่ไม่ได้อยู่ในคำขอ หรือระบุซ้ำ');
      }
      seen.add(itemId);

      const returned = record.returned_qty;
      const damaged = record.damaged_qty || 0;
      const lost = record.lost_qty || 0;
      const accounted = returned + damaged + lost;
      const alreadyAccounted = lineItem.returned_qty + lineItem.damaged_qty + lineItem.lost_qty;
      if (accounted < 1 || alreadyAccounted + accounted > lineItem.requested_qty) {
        await session.abortTransaction();
        return fail(res, 400, 'จำนวนคืนเกินจำนวนที่ยืม หรือไม่มีจำนวนให้บันทึก');
      }

      const updatedItem = await Item.findOneAndUpdate(
        { _id: lineItem.item, borrowed_qty: { $gte: accounted } },
        { $inc: { borrowed_qty: -accounted, available_qty: returned, damaged_qty: damaged, lost_qty: lost } },
        { returnDocument: 'after', session, runValidators: true }
      );
      if (!updatedItem) {
        throw Object.assign(new Error('จำนวนคงคลังไม่สอดคล้องกับรายการยืม'), { statusCode: 409 });
      }

      lineItem.returned_qty += returned;
      lineItem.damaged_qty += damaged;
      lineItem.lost_qty += lost;
      updatedItems.push(updatedItem);
    }

    const allDurableItemsAccounted = durableLines.every(line =>
      line.returned_qty + line.damaged_qty + line.lost_qty === line.requested_qty
    );
    if (allDurableItemsAccounted) {
      request.status = 'returned';
      request.return_date = new Date();
    }
    await request.save({ session });
    await session.commitTransaction();

    emitSafely('stock_updated', updatedItems);
    if (request.status === 'returned') {
      emitSafely('request_status_changed', { requestId: request._id, status: 'returned' }, true);
    }
    return res.json({
      message: request.status === 'returned' ? 'บันทึกการคืนอุปกรณ์เรียบร้อยแล้ว' : 'บันทึกการคืนบางส่วนเรียบร้อยแล้ว',
      status: request.status
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    return res.status(error.statusCode || 400).json({ message: error.message });
  } finally {
    await session.endSession();
  }
};
