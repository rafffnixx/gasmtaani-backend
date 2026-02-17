// src/routes/earnings.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware'); // ✅ Fixed path
const { agentMiddleware } = require('../middleware/agentMiddleware'); // You'll need this too
const EarningsController = require('../controllers/earnings.controller');

// All earnings routes require authentication and agent role
router.use(authMiddleware);
router.use(agentMiddleware);

// Main earnings dashboard
router.get('/agent', EarningsController.getAgentEarnings);

// Analytics
router.get('/analytics', EarningsController.getEarningsAnalytics);

// Daily earnings
router.get('/daily', EarningsController.getDailyEarnings);

// Monthly earnings
router.get('/monthly', EarningsController.getMonthlyEarnings);

module.exports = router;