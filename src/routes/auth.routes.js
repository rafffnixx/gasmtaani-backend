// src/routes/auth.routes.js - COMPLETELY FIXED VERSION
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { agentMiddleware } = require('../middleware/agentMiddleware');

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// ============================================================
// PUBLIC ROUTES - REGISTRATION & AUTH
// ============================================================

/**
 * 🆕 NEW FLOW: Send verification code - NO USER CREATED YET
 */
router.post('/send-verification', [
  body('email').isEmail().normalizeEmail(),
  body('phone_number').isLength({ min: 10, max: 13 }),
  body('password').isLength({ min: 6 }),
  body('full_name').optional().trim()
], validateRequest, authController.sendVerificationCode);

/**
 * 🆕 NEW FLOW: Verify code and CREATE user
 */
router.post('/verify-code', [
  body('email').isEmail().normalizeEmail(),
  body('code').isLength({ min: 6, max: 6 })
], validateRequest, authController.verifyCodeAndCreateUser);

// ============================================================
// LEGACY FLOW - DEPRECATED (Keep for backward compatibility)
// ============================================================

/**
 * 📝 STEP 1: BASIC REGISTRATION (LEGACY - DEPRECATED)
 */
router.post('/register/step1', [
  body('email').isEmail().normalizeEmail(),
  body('phone_number').isLength({ min: 10, max: 13 }),
  body('password').isLength({ min: 6 }),
  body('full_name').optional().trim()
], validateRequest, authController.step1Register);

/**
 * 🔄 RESEND VERIFICATION CODE (LEGACY)
 */
router.post('/resend-verification', [
  body('phone_number').isLength({ min: 10, max: 13 })
], validateRequest, authController.resendVerification);

/**
 * ✅ STEP 2: VERIFY & CHOOSE ROLE (LEGACY)
 */
router.post('/verify/step2', [
  body('phone_number').isLength({ min: 10, max: 13 }),
  body('verification_code').isLength({ min: 6, max: 6 }),
  body('user_type').isIn(['customer', 'agent'])
], validateRequest, authController.step2VerifyAndSetRole);

/**
 * 🔐 LOGIN
 */
router.post('/login', [
  body('email').optional().isEmail(),
  body('phone_number').optional().isLength({ min: 10, max: 13 }),
  body('password').isLength({ min: 6 })
], validateRequest, authController.simpleLogin);

// ============================================================
// PROTECTED ROUTES (Require Authentication)
// ============================================================

/**
 * 👤 GET USER PROFILE
 */
router.get('/profile', authMiddleware, authController.getUserProfile);

/**
 * 🚪 LOGOUT USER
 */
router.post('/logout', authMiddleware, authController.logoutUser);

/**
 * ✏️ UPDATE USER PROFILE
 */
router.put('/profile', authMiddleware, authController.updateUserProfile);

/**
 * 🏢 COMPLETE AGENT PROFILE (First time setup)
 */
router.post('/complete-agent-profile', authMiddleware, authController.completeAgentProfile);

/**
 * 🗑️ DELETE ACCOUNT
 */
router.delete('/account', authMiddleware, authController.deleteAccount);

// ============================================================
// 🧪 DEBUG ROUTES (Development)
// ============================================================

/**
 * 🧪 Debug: Force send verification to email
 */
router.get('/debug/send-verification', authController.debugSendVerification);

// ============================================================
// 🎯 AGENT-SPECIFIC ROUTES (Authenticated)
// ============================================================

/**
 * 📋 GET FULL AGENT PROFILE - Includes location, brands, stats
 */
router.get('/agent/profile', 
  authMiddleware, 
  agentMiddleware, 
  authController.getAgentProfile
);

/**
 * ✏️ UPDATE AGENT PROFILE
 */
router.put('/agent/profile', 
  authMiddleware, 
  agentMiddleware, 
  authController.updateAgentProfile
);

/**
 * 📊 GET AGENT DASHBOARD STATS
 */
router.get('/agent/dashboard/stats', 
  authMiddleware, 
  agentMiddleware, 
  authController.getAgentDashboardStats
);

/**
 * 🛒 GET AGENT ORDERS
 */
router.get('/agent/orders', 
  authMiddleware, 
  agentMiddleware, 
  authController.getAgentOrders
);

/**
 * 🏷️ GET AGENT GAS BRANDS
 */
router.get('/agent/gas-brands', 
  authMiddleware, 
  agentMiddleware, 
  authController.getAgentGasBrands
);

/**
 * 🔄 UPDATE AGENT GAS BRANDS
 */
router.put('/agent/gas-brands', 
  authMiddleware, 
  agentMiddleware, 
  [
    body('gas_brand_ids').isArray().notEmpty()
  ], 
  validateRequest, 
  authController.updateAgentGasBrands
);

// Add to auth.routes.js for testing
router.get('/test-mail-server', async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'mail.masaigroup.co.ke',
      port: parseInt(process.env.MAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER || 'it@masaigroup.co.ke',
        pass: process.env.MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.verify();
    
    // Send test email
    const info = await transporter.sendMail({
      from: `"Mtaani Gas Test" <${process.env.MAIL_USER || 'it@masaigroup.co.ke'}>`,
      to: 'rafffnixx@gmail.com', // Replace with your email for testing
      subject: '✅ Mail Server Test Successful',
      text: 'Your mail server is configured correctly!',
    });

    res.json({
      success: true,
      message: 'Mail server is working!',
      messageId: info.messageId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Mail server test failed',
      error: error.message
    });
  }
});

// ============================================================
// 🐛 DEBUG & UTILITY ROUTES
// ============================================================

/**
 * 🐛 DEBUG USER - Find user by phone/email
 */
router.get('/debug-user', authController.debugUser);
router.post('/debug-user', authController.debugUser);

/**
 * 🐛 DEBUG AGENT - Direct database check
 */
router.get('/debug-agent/:userId', authController.debugAgent);



/**
 * 🩺 HEALTH CHECK
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Auth Service',
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    endpoints: {
      new_flow: {
        send_verification: 'POST /api/auth/send-verification',
        verify_code: 'POST /api/auth/verify-code'
      },
      legacy_flow: {
        register_step1: 'POST /api/auth/register/step1',
        verify_step2: 'POST /api/auth/verify/step2',
        resend: 'POST /api/auth/resend-verification'
      },
      auth: {
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile',
        logout: 'POST /api/auth/logout',
        update: 'PUT /api/auth/profile'
      },
      agent: {
        profile: 'GET /api/auth/agent/profile',
        stats: 'GET /api/auth/agent/dashboard/stats',
        orders: 'GET /api/auth/agent/orders',
        gas_brands: 'GET /api/auth/agent/gas-brands'
      },
      debug: {
        debug_user: 'GET /api/auth/debug-user',
        debug_agent: 'GET /api/auth/debug-agent/:userId',
        debug_send: 'GET /api/auth/debug/send-verification',
        health: 'GET /api/auth/health'
      }
    }
  });
});

module.exports = router;