const express = require('express');
const router = express.Router();
const borrowController = require('../controllers/borrowController');

// ตรวจสอบชื่อฟังก์ชันให้ตรงกับที่ export ใน borrowController
router.get('/', borrowController.getAllRequests);
router.post('/', borrowController.createRequest);
router.put('/:id/approve', borrowController.approveRequest);
router.put('/:id/return', borrowController.returnItems);

module.exports = router;