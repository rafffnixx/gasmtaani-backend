// src/routes/auth.routes.js - SIMPLIFIED WORKING VERSION
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

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
// PUBLIC ROUTES
// ============================================================

// 📝 STEP 1: BASIC REGISTRATION
router.post('/register/step1', [
  body('email').isEmail().normalizeEmail(),
  body('phone_number').isLength({ min: 10, max: 13 }),
  body('password').isLength({ min: 6 }),
  body('full_name').optional().trim()
], validateRequest, authController.step1Register);

// 🔄 RESEND VERIFICATION CODE
router.post('/resend-verification', [
  body('phone_number').isLength({ min: 10, max: 13 })
], validateRequest, authController.resendVerification);

// ✅ STEP 2: VERIFY & CHOOSE ROLE
router.post('/verify/step2', [
  body('phone_number').isLength({ min: 10, max: 13 }),
  body('verification_code').isLength({ min: 6, max: 6 }),
  body('user_type').isIn(['customer', 'agent'])
], validateRequest, authController.step2VerifyAndSetRole);

// 🔐 LOGIN
router.post('/login', [
  body('email').optional().isEmail(),
  body('phone_number').optional().isLength({ min: 10, max: 13 }),
  body('password').isLength({ min: 6 })
], validateRequest, authController.simpleLogin);

// ============================================================
// PROTECTED ROUTES (Require authentication)
// ============================================================

// 📋 GET USER PROFILE
router.get('/profile', authMiddleware, authController.getUserProfile);

// 🚪 LOGOUT USER
router.post('/logout', authMiddleware, authController.logoutUser);

// ✏️ UPDATE USER PROFILE
router.put('/profile', authMiddleware, authController.updateUserProfile);

// 🏢 COMPLETE AGENT PROFILE
router.post('/complete-agent-profile', authMiddleware, authController.completeAgentProfile);

// 🗑️ DELETE ACCOUNT
router.delete('/account', authMiddleware, authController.deleteAccount);

// ============================================================
// DEBUG/UTILITY ROUTES
// ============================================================

// 🐛 DEBUG USER
router.get('/debug-user', authController.debugUser);
router.post('/debug-user', authController.debugUser);

// 🩺 HEALTH CHECK
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Auth Service',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: [
      { method: 'POST', path: '/api/auth/register/step1', description: 'Basic registration' },
      { method: 'POST', path: '/api/auth/resend-verification', description: 'Resend verification code' },
      { method: 'POST', path: '/api/auth/verify/step2', description: 'Verify & choose role' },
      { method: 'POST', path: '/api/auth/login', description: 'Login' },
      { method: 'GET', path: '/api/auth/profile', description: 'Get user profile (protected)' },
      { method: 'POST', path: '/api/auth/logout', description: 'Logout user (protected)' },
      { method: 'PUT', path: '/api/auth/profile', description: 'Update profile (protected)' }
    ]
  });
});

// NO CATCH-ALL ROUTE HERE - Let server.js handle 404

module.exports = router;