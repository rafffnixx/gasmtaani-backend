// /src/routes/payment.routes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/authMiddleware');

// ============================================
// TEST ENDPOINTS (for debugging)
// ============================================
router.get('/test', (req, res) => {
  console.log('✅ Payment test endpoint hit!');
  console.log('📊 Request details:', {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: 'Payment endpoint is working',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    note: 'This is a test endpoint to verify routing'
  });
});

router.post('/test-post', (req, res) => {
  console.log('✅ Payment POST test endpoint hit!');
  console.log('📦 Request body:', req.body);
  console.log('👤 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('👤 User agent:', req.headers['user-agent']);
  console.log('🌐 Content-Type:', req.headers['content-type']);
  
  res.json({
    success: true,
    message: 'Payment POST endpoint is working',
    received_body: req.body,
    headers_received: {
      'content-type': req.headers['content-type'],
      authorization: req.headers.authorization ? 'Present' : 'Missing'
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================
// PUBLIC ENDPOINTS (no authentication required)
// ============================================
// Webhook for M-Pesa callbacks (no auth needed)
router.post('/mpesa/callback', paymentController.mpesaCallback);

// ============================================
// AUTHENTICATED ENDPOINTS (require auth)
// ============================================

// M-Pesa Simulation Routes
router.post('/mpesa/initiate', authMiddleware, paymentController.initiateMpesaPayment);
router.post('/mpesa/verify', authMiddleware, paymentController.verifyMpesaPayment);
router.post('/mpesa/resend-code', authMiddleware, paymentController.resendVerificationCode);

// Payment Status Routes
router.get('/status', authMiddleware, paymentController.getPaymentStatus);
router.get('/order/:order_id', authMiddleware, paymentController.getPaymentsByOrder);

// User Payment History Routes
router.get('/customer', authMiddleware, paymentController.getCustomerPayments);
router.get('/agent', authMiddleware, paymentController.getAgentPayments);

// Real M-Pesa Integration (for production)
router.post('/mpesa/stk-push', authMiddleware, paymentController.initiateRealMpesaPayment);

// ============================================
// DEBUG/ADMIN ENDPOINTS
// ============================================
router.get('/debug', authMiddleware, (req, res) => {
  console.log('🔍 Payment debug endpoint accessed by user:', req.user.id);
  
  res.json({
    success: true,
    user: req.user,
    endpoints_available: [
      'GET /test - Test connection',
      'POST /test-post - Test POST requests',
      'POST /mpesa/initiate - Initiate M-Pesa payment',
      'POST /mpesa/verify - Verify M-Pesa payment',
      'POST /mpesa/resend-code - Resend verification code',
      'GET /status?order_id= - Get payment status',
      'GET /order/:order_id - Get payments by order',
      'GET /customer - Get customer payments',
      'GET /agent - Get agent payments',
      'POST /mpesa/stk-push - Real M-Pesa STK push',
      'POST /mpesa/callback - M-Pesa webhook (no auth)'
    ],
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'payment-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;