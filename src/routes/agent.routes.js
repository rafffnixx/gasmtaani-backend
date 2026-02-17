// src/routes/agent.routes.js
const express = require('express');
const router = express.Router();
const AgentController = require('../controllers/agent.controller');

// Simple auth middleware (replace with real auth later)
router.use((req, res, next) => {
  // For testing, you can set a user ID
  // In production, this would come from JWT token
  req.user = { id: 1, user_type: 'agent' };
  next();
});

// ========== DASHBOARD ROUTES ==========
router.get('/dashboard/stats', AgentController.getDashboardStats);
router.get('/earnings/stats', AgentController.getEarningsStats);
router.get('/orders/recent', AgentController.getRecentOrders);
router.get('/orders/stats', AgentController.getOrderStats);

// ========== ORDERS MANAGEMENT ==========
router.get('/orders', AgentController.getAgentOrders);
router.get('/orders/:orderId', AgentController.getOrderDetails);
router.put('/orders/:orderId/status', AgentController.updateOrderStatus);
router.put('/orders/:orderId/delivery', AgentController.updateDeliveryStatus);
router.post('/orders/:orderId/cancel', AgentController.cancelOrder);

// ========== PRODUCTS MANAGEMENT ==========
router.get('/products', AgentController.getAgentProducts);
router.get('/products/:productId', AgentController.getProductDetails);
router.post('/products', AgentController.addProduct);
router.put('/products/:productId', AgentController.updateProduct);
router.delete('/products/:productId', AgentController.deleteProduct);
router.put('/products/:productId/stock', AgentController.updateStock);

// ========== EARNINGS & ANALYTICS ==========
router.get('/earnings', AgentController.getAgentEarnings);
router.get('/earnings/analytics', AgentController.getEarningsAnalytics);
router.get('/earnings/daily', AgentController.getDailyEarnings);
router.get('/earnings/monthly', AgentController.getMonthlyEarnings);

// ========== PROFILE & SETTINGS ==========
router.get('/profile', AgentController.getAgentProfile);
router.put('/profile', AgentController.updateAgentProfile);
router.put('/profile/location', AgentController.updateLocation);
router.put('/profile/contact', AgentController.updateContactInfo);
router.post('/profile/verification', AgentController.submitVerification);

// ========== NOTIFICATIONS & SUPPORT ==========
router.get('/notifications', AgentController.getNotifications);
router.put('/notifications/read/:notificationId', AgentController.markNotificationRead);
router.get('/support/tickets', AgentController.getSupportTickets);
router.post('/support/tickets', AgentController.createSupportTicket);

module.exports = router;