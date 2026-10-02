const Item = require('../models/Item');

// ดึงรายการอุปกรณ์ทั้งหมด
exports.getItems = async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// เพิ่มอุปกรณ์ใหม่
exports.createItem = async (req, res) => {
    try {
        let data = req.body;

        // กำหนดค่าเริ่มต้นอัตโนมัติป้องกัน Error 400 กรณีฟอร์มไม่ได้ส่งมา
        if (data.total_qty) {
            const qty = Number(data.total_qty);
            data.total_qty = qty;
            data.available_qty = qty; // ของมาใหม่ จำนวนคงเหลือเท่ากับจำนวนทั้งหมด
        }
        
        data.borrowed_qty = data.borrowed_qty || 0;
        data.damaged_qty = data.damaged_qty || 0;
        data.lost_qty = data.lost_qty || 0;

        const newItem = new Item(data);
        const savedItem = await newItem.save();
        res.status(201).json(savedItem);
    } catch (error) {
        console.error("Error saving item:", error.message);
        res.status(400).json({ message: error.message });
    }
};