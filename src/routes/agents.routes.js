// src/routes/agent.routes.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware'); // Import the whole module
const agentController = require('../controllers/agent.controller');

// Apply authentication middleware to all agent routes
router.use(auth.authMiddleware); // Use auth.authMiddleware

// Dashboard Routes
router.get('/dashboard/stats', agentController.getDashboardStats);
router.get('/earnings/stats', agentController.getEarningsStats);
router.get('/orders/recent', agentController.getRecentOrders);
router.get('/orders/stats', agentController.getOrderStats);

// Orders Management
router.get('/orders', agentController.getAgentOrders);
router.get('/orders/:orderId', agentController.getOrderDetails);
router.put('/orders/:orderId/status', agentController.updateOrderStatus);
router.put('/orders/:orderId/delivery', agentController.updateDeliveryStatus);
router.post('/orders/:orderId/cancel', agentController.cancelOrder);

// Products Management
router.get('/products', agentController.getAgentProducts);
router.get('/products/:productId', agentController.getProductDetails);
router.post('/products', agentController.addProduct);
router.put('/products/:productId', agentController.updateProduct);
router.delete('/products/:productId', agentController.deleteProduct);
router.put('/products/:productId/stock', agentController.updateStock);

// Earnings & Analytics
router.get('/earnings', agentController.getAgentEarnings);
router.get('/earnings/analytics', agentController.getEarningsAnalytics);
router.get('/earnings/daily', agentController.getDailyEarnings);
router.get('/earnings/monthly', agentController.getMonthlyEarnings);

// Profile & Settings
router.get('/profile', agentController.getAgentProfile);
router.put('/profile', agentController.updateAgentProfile);
router.put('/profile/location', agentController.updateLocation);
router.put('/profile/contact', agentController.updateContactInfo);
router.post('/profile/verification', agentController.submitVerification);

// Notifications & Support
router.get('/notifications', agentController.getNotifications);
router.put('/notifications/read/:notificationId', agentController.markNotificationRead);
router.get('/support/tickets', agentController.getSupportTickets);
router.post('/support/tickets', agentController.createSupportTicket);

module.exports = router;