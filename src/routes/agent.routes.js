// src/routes/agent.routes.js - SIMPLE WORKING VERSION
const express = require('express');
const router = express.Router();

// Simple controller with all required functions
const controller = {
  // Dashboard
  getDashboardStats: (req, res) => res.json({ success: true, message: 'Dashboard stats' }),
  getEarningsStats: (req, res) => res.json({ success: true, message: 'Earnings stats' }),
  getRecentOrders: (req, res) => res.json({ success: true, message: 'Recent orders' }),
  getOrderStats: (req, res) => res.json({ success: true, message: 'Order stats' }),
  
  // Orders
  getAgentOrders: (req, res) => res.json({ success: true, message: 'Agent orders' }),
  getOrderDetails: (req, res) => res.json({ success: true, message: 'Order details' }),
  updateOrderStatus: (req, res) => res.json({ success: true, message: 'Update status' }),
  updateDeliveryStatus: (req, res) => res.json({ success: true, message: 'Update delivery' }),
  cancelOrder: (req, res) => res.json({ success: true, message: 'Cancel order' }),
  
  // Products
  getAgentProducts: (req, res) => res.json({ success: true, message: 'Agent products' }),
  getProductDetails: (req, res) => res.json({ success: true, message: 'Product details' }),
  addProduct: (req, res) => res.json({ success: true, message: 'Add product' }),
  updateProduct: (req, res) => res.json({ success: true, message: 'Update product' }),
  deleteProduct: (req, res) => res.json({ success: true, message: 'Delete product' }),
  updateStock: (req, res) => res.json({ success: true, message: 'Update stock' }),
  
  // Earnings
  getAgentEarnings: (req, res) => res.json({ success: true, message: 'Agent earnings' }),
  getEarningsAnalytics: (req, res) => res.json({ success: true, message: 'Earnings analytics' }),
  getDailyEarnings: (req, res) => res.json({ success: true, message: 'Daily earnings' }),
  getMonthlyEarnings: (req, res) => res.json({ success: true, message: 'Monthly earnings' }),
  
  // Profile
  getAgentProfile: (req, res) => res.json({ success: true, message: 'Agent profile' }),
  updateAgentProfile: (req, res) => res.json({ success: true, message: 'Update profile' }),
  updateLocation: (req, res) => res.json({ success: true, message: 'Update location' }),
  updateContactInfo: (req, res) => res.json({ success: true, message: 'Update contact' }),
  submitVerification: (req, res) => res.json({ success: true, message: 'Submit verification' }),
  
  // Notifications & Support
  getNotifications: (req, res) => res.json({ success: true, message: 'Notifications' }),
  markNotificationRead: (req, res) => res.json({ success: true, message: 'Mark read' }),
  getSupportTickets: (req, res) => res.json({ success: true, message: 'Support tickets' }),
  createSupportTicket: (req, res) => res.json({ success: true, message: 'Create ticket' })
};

// Temp auth middleware
router.use((req, res, next) => {
  req.user = { id: 1, user_type: 'agent' };
  next();
});

// ========== DASHBOARD ROUTES ==========
router.get('/dashboard/stats', controller.getDashboardStats);
router.get('/earnings/stats', controller.getEarningsStats);
router.get('/orders/recent', controller.getRecentOrders);
router.get('/orders/stats', controller.getOrderStats);

// ========== ORDERS MANAGEMENT ==========
router.get('/orders', controller.getAgentOrders);
router.get('/orders/:orderId', controller.getOrderDetails);
router.put('/orders/:orderId/status', controller.updateOrderStatus);
router.put('/orders/:orderId/delivery', controller.updateDeliveryStatus);
router.post('/orders/:orderId/cancel', controller.cancelOrder);

// ========== PRODUCTS MANAGEMENT ==========
router.get('/products', controller.getAgentProducts);
router.get('/products/:productId', controller.getProductDetails);
router.post('/products', controller.addProduct);
router.put('/products/:productId', controller.updateProduct);
router.delete('/products/:productId', controller.deleteProduct);
router.put('/products/:productId/stock', controller.updateStock);

// ========== EARNINGS & ANALYTICS ==========
router.get('/earnings', controller.getAgentEarnings);
router.get('/earnings/analytics', controller.getEarningsAnalytics);
router.get('/earnings/daily', controller.getDailyEarnings);
router.get('/earnings/monthly', controller.getMonthlyEarnings);

// ========== PROFILE & SETTINGS ==========
router.get('/profile', controller.getAgentProfile);
router.put('/profile', controller.updateAgentProfile);
router.put('/profile/location', controller.updateLocation);
router.put('/profile/contact', controller.updateContactInfo);
router.post('/profile/verification', controller.submitVerification);

// ========== NOTIFICATIONS & SUPPORT ==========
router.get('/notifications', controller.getNotifications);
router.put('/notifications/read/:notificationId', controller.markNotificationRead);
router.get('/support/tickets', controller.getSupportTickets);
router.post('/support/tickets', controller.createSupportTicket);

module.exports = router;