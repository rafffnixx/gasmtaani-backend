const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Customer routes
router.post('/', authMiddleware, orderController.placeOrder);
router.get('/customer', authMiddleware, orderController.getCustomerOrders);
router.put('/customer/:order_id/cancel', authMiddleware, orderController.cancelOrder);
router.post('/:order_id/rating', authMiddleware, orderController.addRating);

// Agent routes
router.get('/agent', authMiddleware, orderController.getAgentOrders);
router.put('/agent/:order_id/status', authMiddleware, orderController.updateOrderStatus);
router.get('/agent/stats', authMiddleware, orderController.getAgentOrderStats); // NEW
router.get('/agent/recent', authMiddleware, orderController.getAgentRecentOrders); // NEW
router.get('/agent/summary', authMiddleware, orderController.getOrderStatusSummary); // NEW

// Common routes (both customer and agent)
router.get('/:order_id', authMiddleware, orderController.getOrderDetails);

module.exports = router;