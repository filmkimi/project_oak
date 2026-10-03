const express = require('express');
const router = express.Router();
const borrowController = require('../controllers/borrowController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('admin'), borrowController.getAllRequests);
router.post('/', authenticate, requireRole('student', 'teacher'), borrowController.createRequest);
router.put('/:id/approve', authenticate, requireRole('admin'), borrowController.approveRequest);
router.put('/:id/return', authenticate, requireRole('admin'), borrowController.returnItems);

module.exports = router;