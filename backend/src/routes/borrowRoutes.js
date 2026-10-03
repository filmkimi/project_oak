const express = require('express');
const router = express.Router();
const borrowController = require('../controllers/borrowController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, requireAdmin, borrowController.getAllRequests);
router.post('/', authenticate, borrowController.createRequest);
router.put('/:id/status', authenticate, requireAdmin, borrowController.updateRequestStatus);
router.put('/:id/approve', authenticate, requireAdmin, borrowController.approveRequest);
router.put('/:id/return', authenticate, requireAdmin, borrowController.returnItems);

module.exports = router;