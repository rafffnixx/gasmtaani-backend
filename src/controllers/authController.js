// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../models');
const nodemailer = require('nodemailer');
const emailService = require('../services/emailService');


// Console styling
const consoleStyle = {
  error: '\x1b[31m%s\x1b[0m',
  success: '\x1b[32m%s\x1b[0m',
  warning: '\x1b[33m%s\x1b[0m',
  info: '\x1b[36m%s\x1b[0m',
  header: '\x1b[1m\x1b[35m%s\x1b[0m',
  data: '\x1b[90m%s\x1b[0m',
  highlight: '\x1b[1m\x1b[37m%s\x1b[0m',
  time: '\x1b[34m%s\x1b[0m'
};

// Format Kenya time
const formatKenyaTime = (date) => {
  return date.toLocaleString('en-KE', { 
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

class AuthController {
  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  generateToken = (user) => {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        phone: user.phone_number,
        user_type: user.user_type,
        is_verified: user.is_verified,
        is_agent_profile_complete: user.is_agent_profile_complete
      },
      process.env.JWT_SECRET || 'mtaani-gas-secret-key-2024',
      { expiresIn: '7d' }
    );
  };

  generateLimitedToken = (user) => {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        phone: user.phone_number,
        is_verified: false
      },
      process.env.JWT_SECRET || 'mtaani-gas-secret-key-2024',
      { expiresIn: '1h' }
    );
  };

  normalizePhoneNumber = (phone) => {
    if (!phone) return phone;
    
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '254' + cleaned.substring(1);
    }
    
    if (!cleaned.startsWith('+') && !cleaned.startsWith('254')) {
      cleaned = '+254' + cleaned;
    } else if (cleaned.startsWith('254')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  };

  generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // ============================================================================
  // NEW: REGISTRATION WITH EMAIL VERIFICATION - NO USER CREATED YET
  // ============================================================================

  /**
/**
 * 📝 STEP 1: SEND VERIFICATION CODE - NO USER CREATED
 */
// ============================================================================
// SEND VERIFICATION CODE - WITH GOOGLE APPS SCRIPT (100% WORKING)
// ============================================================================
// ============================================================================
// SEND VERIFICATION CODE - WITH GOOGLE APPS SCRIPT (100% WORKING)
// Using: rafffnixx@gmail.com
// ============================================================================
sendVerificationCode = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log(consoleStyle.header, '📧 SEND VERIFICATION CODE');
  console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
  console.log('='.repeat(80));
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, phone_number, full_name, password } = req.body;

    console.log(consoleStyle.info, '📦 Registration Request:');
    console.log(consoleStyle.data, `   Email: ${email}`);
    console.log(consoleStyle.data, `   Phone: ${phone_number}`);
    console.log(consoleStyle.data, `   Name: ${full_name || 'Not provided'}`);

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Normalize phone
    const normalizedPhone = this.normalizePhoneNumber(phone_number);
    console.log(consoleStyle.data, `   Normalized: ${normalizedPhone}`);

    // Check if user already exists
    const existingUser = await db.User.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { email },
          { phone_number: normalizedPhone }
        ]
      }
    });

    if (existingUser) {
      console.log(consoleStyle.error, '❌ User already exists!');
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }

    // Generate verification code
    const code = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Initialize global temp storage
    if (!global.tempRegistrations) {
      global.tempRegistrations = new Map();
    }

    // Create unique verification ID
    const verificationId = `ver_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Store verification data in memory
    global.tempRegistrations.set(verificationId, {
      email,
      phone_number: normalizedPhone,
      full_name: full_name || null,
      password_hash: password,
      code,
      expires_at: expiresAt,
      is_used: false,
      attempts: 0,
      created_at: new Date()
    });

    console.log(consoleStyle.success, '✅ Verification record created in memory!');
    
    // ============================================================
    // LOG CODE TO TERMINAL - ALWAYS VISIBLE
    // ============================================================
    console.log('\n' + '\x1b[43m\x1b[30m%s\x1b[0m', '🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔');
    console.log('\x1b[43m\x1b[30m%s\x1b[0m', '🔔                                                🔔');
    console.log('\x1b[43m\x1b[30m%s\x1b[0m', '🔔         📧 VERIFICATION CODE GENERATED          🔔');
    console.log('\x1b[43m\x1b[30m%s\x1b[0m', '🔔                                                🔔');
    console.log('\x1b[43m\x1b[30m%s\x1b[0m', '🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔');
    console.log('\x1b[33m%s\x1b[0m', '='.repeat(60));
    console.log('\x1b[33m%s\x1b[0m', '   📋 REGISTRATION DETAILS:');
    console.log('\x1b[33m%s\x1b[0m', '='.repeat(60));
    console.log('\x1b[36m%s\x1b[0m', `   👤 Name: ${full_name || 'Not provided'}`);
    console.log('\x1b[36m%s\x1b[0m', `   📧 Email: ${email}`);
    console.log('\x1b[36m%s\x1b[0m', `   📞 Phone: ${phone_number}`);
    console.log('\x1b[36m%s\x1b[0m', `   🔑 Normalized: ${normalizedPhone}`);
    console.log('\x1b[32m%s\x1b[0m', `   🔢 VERIFICATION CODE: ${code}`);
    console.log('\x1b[34m%s\x1b[0m', `   ⏰ Expires: ${formatKenyaTime(expiresAt)}`);
    console.log('\x1b[33m%s\x1b[0m', '='.repeat(60));
    console.log('\x1b[33m%s\x1b[0m', '   ⚠️  USER NOT CREATED YET - VERIFICATION REQUIRED');
    console.log('\x1b[33m%s\x1b[0m', '='.repeat(60));

    // ============================================================
    // SEND EMAIL USING GOOGLE APPS SCRIPT - 100% WORKS
    // ============================================================
    let emailSent = false;
    
    try {
      const axios = require('axios');
      
      // 👇 PASTE YOUR GOOGLE APPS SCRIPT URL HERE
      const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
      
      // Beautiful HTML email template
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333333;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background-color: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              color: white;
              margin: 0;
              font-size: 32px;
              font-weight: 700;
              letter-spacing: 1px;
            }
            .header p {
              color: rgba(255,255,255,0.9);
              margin: 10px 0 0;
              font-size: 16px;
            }
            .content {
              padding: 40px 30px;
              background-color: #ffffff;
            }
            .welcome-text {
              text-align: center;
              margin-bottom: 30px;
            }
            .welcome-text h2 {
              color: #FF6B35;
              margin: 0 0 10px;
              font-size: 24px;
            }
            .code-container {
              background: linear-gradient(145deg, #f8f9fa, #ffffff);
              border: 3px dashed #FF6B35;
              border-radius: 20px;
              padding: 30px;
              margin: 30px 0;
              text-align: center;
              box-shadow: 0 5px 15px rgba(255,107,53,0.1);
            }
            .code-label {
              color: #666;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-bottom: 10px;
            }
            .code {
              font-size: 48px;
              font-weight: 800;
              letter-spacing: 12px;
              color: #FF6B35;
              font-family: 'Courier New', monospace;
              background: #f8f9fa;
              padding: 15px 20px;
              border-radius: 12px;
              display: inline-block;
            }
            .expiry {
              text-align: center;
              background: #f8f9fa;
              padding: 15px;
              border-radius: 12px;
              margin: 20px 0;
              color: #666;
            }
            .expiry strong {
              color: #FF6B35;
            }
            .details-box {
              background: #FFF9E6;
              border-left: 4px solid #FF6B35;
              padding: 20px;
              border-radius: 8px;
              margin: 25px 0;
            }
            .details-box p {
              margin: 8px 0;
              color: #555;
            }
            .footer {
              background-color: #f8f9fa;
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e9ecef;
            }
            .footer p {
              margin: 5px 0;
              color: #888;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚡ Mtaani Gas</h1>
              <p>Futuristic Gas Delivery</p>
            </div>
            
            <div class="content">
              <div class="welcome-text">
                <h2>Welcome to Mtaani Gas! 👋</h2>
                <p style="color: #666; font-size: 16px;">Your trusted partner for gas delivery</p>
              </div>
              
              <p style="font-size: 16px;">Hello <strong style="color: #FF6B35;">${full_name || email}</strong>,</p>
              
              <p style="font-size: 16px; color: #555;">
                Thank you for choosing Mtaani Gas. To complete your registration, 
                please use the verification code below:
              </p>
              
              <div class="code-container">
                <div class="code-label">Verification Code</div>
                <div class="code">${code}</div>
              </div>
              
              <div class="expiry">
                <span style="font-size: 16px;">⏰ This code expires in <strong>10 minutes</strong></span>
              </div>
              
              <div class="details-box">
                <p style="margin-top: 0; font-weight: 600; color: #FF6B35;">📝 Registration Summary</p>
                <p><strong>Name:</strong> ${full_name || 'Not provided'}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone_number}</p>
              </div>
              
              <p style="color: #666; font-style: italic; margin-top: 25px;">
                "Bringing convenience to your doorstep, one cylinder at a time."
              </p>
            </div>
            
            <div class="footer">
              <p style="font-size: 14px; color: #FF6B35; font-weight: 600;">Mtaani Gas - Your Neighborhood Gas Partner</p>
              <p style="margin-top: 15px;">📧 Sent via rafffnixx@gmail.com</p>
              <p style="margin-top: 20px;">
                <small>
                  This is an automated message from Mtaani Gas.<br>
                  © ${new Date().getFullYear()} Mtaani Gas. All rights reserved.
                </small>
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
        WELCOME TO MTAANI GAS!
        
        Hello ${full_name || email},
        
        Your verification code is: ${code}
        
        This code will expire in 10 minutes.
        
        Registration Details:
        • Name: ${full_name || 'Not provided'}
        • Email: ${email}
        • Phone: ${phone_number}
        
        © ${new Date().getFullYear()} Mtaani Gas. All rights reserved.
      `;

      // Send via Google Apps Script
      const response = await axios.post(APPS_SCRIPT_URL, {
        to: email,
        subject: '🔐 Verify Your Mtaani Gas Account',
        html: html,
        text: text
      });

      if (response.data.success) {
        emailSent = true;
        console.log(consoleStyle.success, `✅ Verification email sent to ${email} via Google Apps Script`);
        console.log(consoleStyle.info, `   📧 From: rafffnixx@gmail.com`);
        console.log(consoleStyle.info, `   📧 To: ${email}`);
      }

    } catch (emailError) {
      console.log(consoleStyle.warning, '⚠️ Google Apps Script email failed:');
      console.log(consoleStyle.data, `   Error: ${emailError.message}`);
      console.log(consoleStyle.data, `   Code available in terminal: ${code}`);
    }

    // Return success - NO USER CREATED YET
    res.json({
      success: true,
      message: emailSent 
        ? 'Verification code sent successfully. Please check your email.'
        : 'Verification code generated. Please check terminal for the code.',
      requires_verification: true,
      verification_id: verificationId,
      expires_at: expiresAt,
      email: email,
      phone: phone_number,
      code: process.env.NODE_ENV === 'development' ? code : undefined
    });

  } catch (error) {
    console.log(consoleStyle.error, '🔥 Send verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

  /**
   * ✅ STEP 2: VERIFY CODE AND CREATE USER
   */
/**
 * ✅ STEP 2: VERIFY CODE AND CREATE USER
 * FIXED: Uses in-memory storage instead of database
 */
/**
 * ✅ STEP 2: VERIFY CODE AND CREATE USER WITH SELECTED ROLE
 */
verifyCodeAndCreateUser = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log(consoleStyle.header, '✅ VERIFY CODE & CREATE USER');
  console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
  console.log('='.repeat(80));
  
  try {
    const { email, code, role } = req.body; // ✅ Get role from request

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'User role is required'
      });
    }

    if (!['customer', 'agent'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'User role must be "customer" or "agent"'
      });
    }

    console.log(consoleStyle.info, '📦 Verification Request:');
    console.log(consoleStyle.data, `   Email: ${email}`);
    console.log(consoleStyle.data, `   Code: ${code}`);
    console.log(consoleStyle.data, `   Role: ${role}`); // ✅ Log the role

    // Check in-memory storage
    if (!global.tempRegistrations) {
      global.tempRegistrations = new Map();
      console.log(consoleStyle.error, '❌ No verification records found');
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new one.',
        can_resend: true
      });
    }

    // Find the verification record by email and code
    let verificationRecord = null;
    let verificationId = null;

    for (const [id, record] of global.tempRegistrations.entries()) {
      if (record.email === email && record.code === code && !record.is_used) {
        verificationRecord = record;
        verificationId = id;
        break;
      }
    }

    if (!verificationRecord) {
      console.log(consoleStyle.error, '❌ Invalid verification code');
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please try again.',
        can_resend: true
      });
    }

    // Check if expired
    if (new Date() > verificationRecord.expires_at) {
      console.log(consoleStyle.error, '⏰ Verification code expired');
      verificationRecord.is_used = true;
      global.tempRegistrations.set(verificationId, verificationRecord);
      return res.status(400).json({
        success: false,
        message: 'Verification code expired. Please request a new one.',
        can_resend: true
      });
    }

    // Mark as used
    verificationRecord.is_used = true;
    global.tempRegistrations.set(verificationId, verificationRecord);

    console.log(consoleStyle.success, '✅ Verification code valid!');

    // Check if user already exists
    const existingUser = await db.User.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { email: verificationRecord.email },
          { phone_number: verificationRecord.phone_number }
        ]
      }
    });

    if (existingUser) {
      console.log(consoleStyle.error, '❌ User already exists!');
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // ============================================================
    // CREATE USER WITH THE SELECTED ROLE - NO EXTRA STEP NEEDED
    // ============================================================
    console.log(consoleStyle.info, '🔄 Creating user account...');
    console.log(consoleStyle.data, `   Role: ${role}`);

    // Prepare user data
    const userData = {
      email: verificationRecord.email,
      phone_number: verificationRecord.phone_number,
      password_hash: verificationRecord.password_hash,
      full_name: verificationRecord.full_name,
      user_type: role, // ✅ SET THE SELECTED ROLE IMMEDIATELY!
      is_verified: true,
      is_agent_profile_complete: false
    };

    // Add agent-specific fields
    if (role === 'agent') {
      userData.agent_status = 'pending_vetting';
    }

    // Create the user
    const user = await db.User.create(userData);

    console.log(consoleStyle.success, `✅ User created! ID: ${user.id}`);
    console.log(consoleStyle.success, `   User Type: ${user.user_type}`); // ✅ Confirm role

    // Create wallet
    const [wallet, created] = await db.Wallet.findOrCreate({
      where: { user_id: user.id },
      defaults: {
        user_id: user.id,
        balance: 0.00,
        currency: 'KES'
      }
    });

    if (created) {
      console.log(consoleStyle.success, `💰 Wallet created! Balance: ${wallet.balance} KES`);
    }

    // Generate token - now with correct role
    const token = this.generateToken(user);

    console.log('\n' + consoleStyle.highlight, '='.repeat(60));
    console.log(consoleStyle.success, '   🎉 USER VERIFIED & CREATED!');
    console.log(consoleStyle.highlight, '='.repeat(60));
    console.log(consoleStyle.info, `   👤 ID: ${user.id}`);
    console.log(consoleStyle.info, `   📧 Email: ${user.email}`);
    console.log(consoleStyle.info, `   📞 Phone: ${user.phone_number}`);
    console.log(consoleStyle.info, `   👤 Name: ${user.full_name}`);
    console.log(consoleStyle.success, `   🏷️  Role: ${user.user_type}`); // ✅ Show role
    console.log(consoleStyle.success, `   ✅ Status: VERIFIED`);
    console.log(consoleStyle.highlight, '='.repeat(60));

    // Clean up - remove used verification record
    global.tempRegistrations.delete(verificationId);

    // Return success - NO MORE ROLE SELECTION STEP!
    res.status(201).json({
      success: true,
      message: `Registration complete! Welcome as ${role}.`,
      token: token,
      next_step: role === 'agent' ? 'complete_agent_profile' : 'dashboard',
      requires_agent_profile: role === 'agent',
      user: {
        id: user.id,
        email: user.email,
        phone_number: user.phone_number,
        full_name: user.full_name,
        user_type: user.user_type,
        is_verified: user.is_verified,
        is_agent_profile_complete: user.is_agent_profile_complete,
        agent_status: user.agent_status
      }
    });

  } catch (error) {
    console.log(consoleStyle.error, '🔥 VERIFICATION ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

  // ============================================================================
  // LEGACY REGISTRATION METHODS - DEPRECATED
  // ============================================================================

  /**
   * 📝 STEP 1: BASIC REGISTRATION (LEGACY - DEPRECATED)
   * Kept for backward compatibility only
   */
  step1Register = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '📝 STEP 1: BASIC REGISTRATION (LEGACY)');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    console.log(consoleStyle.warning, '⚠️  This endpoint is deprecated. Use /send-verification instead');
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, phone_number, password, full_name } = req.body;

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters'
        });
      }

      const normalizedPhone = this.normalizePhoneNumber(phone_number);

      const existingUser = await db.User.findOne({
        where: {
          [db.Sequelize.Op.or]: [
            { email },
            { phone_number: normalizedPhone }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or phone already exists'
        });
      }

      const user = await db.User.create({
        email,
        phone_number: normalizedPhone,
        password_hash: password,
        full_name: full_name || null,
        user_type: 'customer',
        is_verified: false,
        is_agent_profile_complete: false
      });

      const verificationData = await this.createVerificationCode(user.id, 'phone_verification');
      const limitedToken = this.generateLimitedToken(user);

      res.status(201).json({
        success: true,
        message: 'Registration successful! Please verify your phone number.',
        requires_verification: true,
        requires_role_selection: true,
        next_step: 'verify_and_choose_role',
        token: limitedToken,
        verification_sent: true,
        user: {
          id: user.id,
          email: user.email,
          phone_number: user.phone_number,
          full_name: user.full_name,
          user_type: user.user_type,
          is_verified: user.is_verified
        }
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 REGISTRATION ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    }
  };

  /**
   * 🔄 RESEND VERIFICATION CODE (LEGACY)
   */
  resendVerification = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '📱 RESEND VERIFICATION CODE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const { phone_number } = req.body;

      if (!phone_number) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      const normalizedPhone = this.normalizePhoneNumber(phone_number);

      const user = await db.User.findOne({
        where: { phone_number: normalizedPhone }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.is_verified) {
        return res.json({
          success: true,
          message: 'Account already verified'
        });
      }

      const verificationData = await this.createVerificationCode(user.id, 'phone_verification');

      res.json({
        success: true,
        message: 'New verification code sent',
        verification_sent: true,
        expires_at: verificationData.expires_at,
        user: {
          id: user.id,
          phone_number: user.phone_number
        }
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 RESEND ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend verification code'
      });
    }
  };

  /**
   * ✅ STEP 2: VERIFY & CHOOSE ROLE
   */
  step2VerifyAndSetRole = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '✅ STEP 2: VERIFY & CHOOSE ROLE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    console.log('='.repeat(80));
    
    try {
      const { phone_number, verification_code, user_type } = req.body;

      if (!phone_number || !verification_code || !user_type) {
        return res.status(400).json({
          success: false,
          message: 'Phone number, verification code, and user type are required'
        });
      }

      if (!['customer', 'agent'].includes(user_type)) {
        return res.status(400).json({
          success: false,
          message: 'User type must be "customer" or "agent"'
        });
      }

      const normalizedPhone = this.normalizePhoneNumber(phone_number);

      const user = await db.User.findOne({
        where: { phone_number: normalizedPhone }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.is_verified) {
        if (user.user_type === 'customer' && user_type === 'agent') {
          user.user_type = 'agent';
          await user.save();
          
          const token = this.generateToken(user);
          
          return res.json({
            success: true,
            message: 'Role changed to agent! Complete your agent profile.',
            token: token,
            next_step: 'complete_agent_profile',
            requires_agent_profile: true,
            user: this.formatUserResponse(user)
          });
        }
        
        return res.json({
          success: true,
          message: `Account already verified as ${user.user_type}`,
          token: this.generateToken(user),
          user: this.formatUserResponse(user)
        });
      }

      const verificationRecord = await db.VerificationCode.findOne({
        where: {
          user_id: user.id,
          type: 'phone_verification',
          is_used: false,
          expires_at: { [db.Sequelize.Op.gt]: new Date() }
        },
        order: [['created_at', 'DESC']]
      });

      if (!verificationRecord) {
        return res.status(400).json({
          success: false,
          message: 'No active verification code found. Please request a new one.',
          can_resend: true
        });
      }

      if (new Date() > verificationRecord.expires_at) {
        verificationRecord.is_used = true;
        await verificationRecord.save();
        return res.status(400).json({
          success: false,
          message: 'Verification code expired. Please request a new one.',
          can_resend: true
        });
      }

      if (verificationRecord.code !== verification_code) {
        verificationRecord.attempts += 1;
        await verificationRecord.save();
        
        const attemptsLeft = 5 - verificationRecord.attempts;
        
        return res.status(400).json({
          success: false,
          message: `Invalid verification code. ${attemptsLeft > 0 ? `${attemptsLeft} attempts left` : 'No attempts left'}`,
          attempts_left: attemptsLeft,
          can_resend: attemptsLeft <= 0
        });
      }

      verificationRecord.is_used = true;
      await verificationRecord.save();

      user.is_verified = true;
      user.user_type = user_type;
      
      if (user_type === 'agent') {
        user.is_agent_profile_complete = false;
        user.agent_status = 'pending_vetting';
      }
      
      await user.save();

      const [wallet, created] = await db.Wallet.findOrCreate({
        where: { user_id: user.id },
        defaults: {
          user_id: user.id,
          balance: 0.00,
          currency: 'KES'
        }
      });

      const fullToken = this.generateToken(user);

      const response = {
        success: true,
        message: `Registration complete! Welcome as ${user_type}.`,
        token: fullToken,
        user: this.formatUserResponse(user, wallet)
      };

      if (user_type === 'agent') {
        response.next_step = 'complete_agent_profile';
        response.requires_agent_profile = true;
        response.message += ' Please complete your agent profile to start selling.';
      }

      res.json(response);

    } catch (error) {
      console.log(consoleStyle.error, '🔥 VERIFICATION ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Verification failed. Please try again.'
      });
    }
  };

  /**
   * 🏢 STEP 3: COMPLETE/UPDATE AGENT PROFILE
   */
  completeAgentProfile = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🏢 STEP 3: COMPLETE/UPDATE AGENT PROFILE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    const transaction = await db.sequelize.transaction();
    
    try {
      const userId = req.user.id;
      const {
        business_name,
        business_address,
        area_name,
        latitude,
        longitude,
        gas_brand_ids,
        id_number,
        kra_pin,
        business_registration_number,
        town,
        county
      } = req.body;

      const requiredFields = ['business_name', 'business_address', 'area_name', 'gas_brand_ids'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      
      if (missingFields.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          missing_fields: missingFields
        });
      }

      if (!Array.isArray(gas_brand_ids) || gas_brand_ids.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Please select at least one gas brand'
        });
      }

      const brands = await db.GasBrand.findAll({
        where: { id: gas_brand_ids },
        transaction
      });

      if (brands.length !== gas_brand_ids.length) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'One or more gas brands not found',
          invalid_brands: gas_brand_ids.filter(id => !brands.find(b => b.id === id))
        });
      }

      const user = await db.User.findOne({
        where: {
          id: userId,
          user_type: 'agent',
          is_verified: true
        },
        transaction
      });

      if (!user) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'User not found or not an agent'
        });
      }

      const wasComplete = user.is_agent_profile_complete;

      await user.update({
        business_name,
        business_address,
        area_name,
        latitude: latitude || null,
        longitude: longitude || null,
        town: town && town !== 'undefined' && town !== '' ? String(town).trim() : null,
        county: county && county !== 'undefined' && county !== '' ? String(county).trim() : null,
        id_number: id_number || null,
        kra_pin: kra_pin || null,
        business_registration_number: business_registration_number || null,
        is_agent_profile_complete: true,
        profile_completed_at: wasComplete ? user.profile_completed_at : new Date(),
        agent_status: 'pending_vetting'
      }, { transaction });

      await db.UserGasBrand.destroy({
        where: { user_id: userId },
        transaction
      });

      const userGasBrands = gas_brand_ids.map(brandId => ({
        user_id: userId,
        gas_brand_id: brandId,
        created_at: new Date(),
        updated_at: new Date()
      }));

      await db.UserGasBrand.bulkCreate(userGasBrands, { transaction });

      const [agentProfile, created] = await db.AgentProfile.findOrCreate({
        where: { agent_id: userId },
        defaults: {
          agent_id: userId,
          is_approved: false,
          approval_status: 'pending',
          rating: 0,
          total_orders: 0,
          commission_rate: 5.00,
          is_active: true
        },
        transaction
      });

      if (!created) {
        await agentProfile.update({
          approval_status: 'pending',
          updated_at: new Date()
        }, { transaction });
      }

      if (!wasComplete) {
        for (const brand of brands) {
          const existingListing = await db.AgentGasListing.findOne({
            where: {
              agent_id: userId,
              gas_brand_id: brand.id,
              size: '6kg'
            },
            transaction
          });

          if (!existingListing) {
            await db.AgentGasListing.create({
              agent_id: userId,
              gas_brand_id: brand.id,
              size: '6kg',
              selling_price: 1500.00,
              available_quantity: 10,
              is_available: true,
              cylinder_condition: 'new',
              delivery_available: true,
              delivery_fee: 100.00,
              is_approved: false,
              rating: 0,
              total_orders: 0,
              description: `Standard ${brand.name} 6kg cylinder`
            }, { transaction });
          }
        }
      }

      await transaction.commit();

      const updatedUser = await db.User.findByPk(userId, {
        attributes: [
          'id', 'email', 'phone_number', 'full_name', 'user_type',
          'is_verified', 'is_agent_profile_complete',
          'latitude', 'longitude', 'area_name', 'town', 'county', 'address',
          'business_name', 'business_address', 'agent_status', 'profile_completed_at',
          'id_number', 'kra_pin', 'business_registration_number',
          'created_at', 'updated_at'
        ],
        include: [
          {
            model: db.GasBrand,
            as: 'gasBrands',
            attributes: ['id', 'name', 'logo_url'],
            through: { attributes: [] }
          },
          {
            model: db.AgentProfile,
            as: 'agentProfile',
            attributes: ['id', 'is_approved', 'approval_status', 'rating', 'total_orders']
          },
          {
            model: db.Wallet,
            as: 'wallet',
            attributes: ['id', 'balance', 'currency']
          }
        ]
      });

      const token = this.generateToken(updatedUser);

      res.json({
        success: true,
        message: wasComplete 
          ? 'Agent profile updated successfully!' 
          : 'Agent profile completed successfully! Your account is now pending admin approval.',
        token: token,
        next_step: 'await_approval',
        user: this.formatUserResponse(updatedUser),
        agent_details: {
          business_name: updatedUser.business_name,
          area_name: updatedUser.area_name,
          coordinates: { 
            latitude: updatedUser.latitude, 
            longitude: updatedUser.longitude 
          },
          town: updatedUser.town,
          county: updatedUser.county,
          gas_brands: updatedUser.gasBrands,
          profile_status: updatedUser.agentProfile?.approval_status,
          was_updated: wasComplete
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.log(consoleStyle.error, '🔥 AGENT PROFILE ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete agent profile'
      });
    }
  };

  // ============================================================================
  // AUTH METHODS
  // ============================================================================

  /**
   * 🔐 LOGIN - WITH FULL USER DATA INCLUDING ROLE
   */
  simpleLogin = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🔐 USER LOGIN');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const { email, phone_number, password } = req.body;

      if ((!email && !phone_number) || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email/phone and password are required'
        });
      }

      let whereClause = {};
      if (email) {
        whereClause.email = email;
      } else {
        const normalizedPhone = this.normalizePhoneNumber(phone_number);
        whereClause.phone_number = normalizedPhone;
      }

      const user = await db.User.findOne({
        where: whereClause,
        attributes: [
          'id', 'email', 'phone_number', 'password_hash',
          'full_name', 'user_type', 'is_verified', 
          'is_agent_profile_complete', 'business_name',
          'agent_status', 'town', 'county', 'area_name',
          'business_address', 'id_number', 'kra_pin',
          'business_registration_number', 'profile_completed_at',
          'created_at', 'updated_at'
        ],
        include: [
          {
            model: db.GasBrand,
            as: 'gasBrands',
            attributes: ['id', 'name'],
            through: { attributes: [] }
          },
          {
            model: db.AgentProfile,
            as: 'agentProfile',
            attributes: ['id', 'approval_status', 'rating', 'total_orders', 'commission_rate']
          },
          {
            model: db.Wallet,
            as: 'wallet',
            attributes: ['id', 'balance', 'currency']
          }
        ]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const isValidPassword = await user.checkPassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      if (!user.is_verified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your account first',
          requires_verification: true,
          can_resend: true,
          phone_number: user.phone_number
        });
      }

      user.last_login = new Date();
      await user.save();

      const token = this.generateToken(user);

      // Set HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      console.log(consoleStyle.success, `✅ Login successful - User:`, {
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        is_admin: user.user_type === 'admin',
        is_agent: user.user_type === 'agent',
        is_customer: user.user_type === 'customer'
      });

      res.json({
        success: true,
        message: 'Login successful',
        token: token,
        user: this.formatUserResponse(user, user.wallet)
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 LOGIN ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  };

  /**
   * 👤 GET CURRENT USER
   */
  getCurrentUser = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '👤 GET CURRENT USER');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const userId = req.user.id;

      const user = await db.User.findByPk(userId, {
        attributes: [
          'id', 'email', 'phone_number', 'full_name', 'user_type',
          'is_verified', 'is_agent_profile_complete',
          'latitude', 'longitude', 'area_name', 'town', 'county', 'address',
          'business_name', 'business_address', 'agent_status', 'profile_completed_at',
          'id_number', 'kra_pin', 'business_registration_number',
          'created_at', 'updated_at'
        ],
        include: [
          {
            model: db.Wallet,
            as: 'wallet',
            attributes: ['id', 'balance', 'currency']
          },
          {
            model: db.GasBrand,
            as: 'gasBrands',
            attributes: ['id', 'name', 'logo_url'],
            through: { attributes: [] }
          },
          {
            model: db.AgentProfile,
            as: 'agentProfile',
            attributes: ['id', 'rating', 'total_orders', 'commission_rate', 'approval_status']
          }
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      console.log(consoleStyle.success, '✅ Current user:', {
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        is_admin: user.user_type === 'admin'
      });

      res.json({
        success: true,
        user: this.formatUserResponse(user)
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user profile'
      });
    }
  };

  /**
   * 📋 GET USER PROFILE - Alias for getCurrentUser
   */
  getUserProfile = async (req, res) => {
    return this.getCurrentUser(req, res);
  };

  /**
   * ✏️ UPDATE USER PROFILE
   */
  updateUserProfile = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '✏️ UPDATE USER PROFILE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const userId = req.user.id;
      const {
        business_name,
        business_address,
        area_name,
        address,
        town,
        county,
        latitude,
        longitude,
        phone_number,
        business_type,
        operating_hours,
        delivery_radius
      } = req.body;

      const user = await db.User.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const updates = {};
      if (business_name !== undefined) updates.business_name = business_name;
      if (business_address !== undefined) updates.business_address = business_address;
      if (area_name !== undefined) updates.area_name = area_name;
      if (address !== undefined) updates.address = address;
      if (town !== undefined) updates.town = town && town !== 'undefined' ? String(town).trim() : null;
      if (county !== undefined) updates.county = county && county !== 'undefined' ? String(county).trim() : null;
      if (latitude !== undefined) updates.latitude = latitude;
      if (longitude !== undefined) updates.longitude = longitude;
      if (phone_number !== undefined) updates.phone_number = phone_number;
      if (business_type !== undefined) updates.business_type = business_type;
      if (operating_hours !== undefined) updates.operating_hours = operating_hours;
      if (delivery_radius !== undefined) updates.delivery_radius = delivery_radius;
      updates.updated_at = new Date();

      if (user.user_type === 'agent' && user.is_agent_profile_complete === false) {
        const requiredFields = ['business_name', 'business_address', 'area_name'];
        const hasAllRequired = requiredFields.every(field => {
          return (updates[field] && updates[field].trim() !== '') || 
                 (user[field] && user[field].trim() !== '');
        });
        
        if (hasAllRequired) {
          updates.is_agent_profile_complete = true;
          updates.profile_completed_at = new Date();
        }
      }

      await user.update(updates);

      const updatedUser = await db.User.findByPk(userId, {
        attributes: [
          'id', 'email', 'phone_number', 'full_name', 'user_type',
          'is_verified', 'is_agent_profile_complete',
          'business_name', 'business_address', 'area_name',
          'town', 'county', 'address', 'latitude', 'longitude',
          'business_type', 'operating_hours', 'delivery_radius',
          'agent_status', 'profile_completed_at',
          'created_at', 'updated_at'
        ]
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 UPDATE PROFILE ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  };

  // ============================================================================
  // AGENT PROFILE ENDPOINTS
  // ============================================================================

  /**
   * 📋 GET AGENT PROFILE - Complete agent details
   */
  getAgentProfile = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '📋 GET AGENT PROFILE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const userId = req.user.id;

      const user = await db.User.findOne({
        where: { 
          id: userId,
          user_type: 'agent'
        },
        attributes: [
          'id', 'email', 'phone_number', 'full_name', 'user_type',
          'is_verified', 'is_agent_profile_complete',
          'business_name', 'business_address', 'area_name',
          'town', 'county', 'address',
          'latitude', 'longitude',
          'id_number', 'kra_pin', 'business_registration_number',
          'agent_status', 'profile_completed_at',
          'delivery_radius', 'operating_hours',
          'created_at', 'updated_at'
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      // Fetch gas brands
      const userGasBrands = await db.UserGasBrand.findAll({
        where: { user_id: userId },
        include: [
          {
            model: db.GasBrand,
            as: 'gas_brand',
            attributes: ['id', 'name', 'logo_url']
          }
        ]
      });

      const gasBrands = userGasBrands.map(ugb => ugb.gas_brand).filter(Boolean);

      // Fetch wallet
      const wallet = await db.Wallet.findOne({
        where: { user_id: userId },
        attributes: ['id', 'balance', 'currency']
      });

      // Fetch agent profile
      const agentProfile = await db.AgentProfile.findOne({
        where: { agent_id: userId },
        attributes: ['id', 'rating', 'total_orders', 'commission_rate', 'approval_status']
      });

      const agentData = {
        id: user.id,
        email: user.email,
        phone_number: user.phone_number,
        full_name: user.full_name,
        user_type: user.user_type,
        is_verified: user.is_verified,
        is_agent_profile_complete: user.is_agent_profile_complete,
        agent_status: user.agent_status,
        profile_completed_at: user.profile_completed_at,
        
        business_name: user.business_name,
        business_address: user.business_address,
        area_name: user.area_name,
        
        town: user.town && user.town !== 'undefined' ? String(user.town) : null,
        county: user.county && user.county !== 'undefined' ? String(user.county) : null,
        address: user.address,
        latitude: user.latitude ? parseFloat(user.latitude) : null,
        longitude: user.longitude ? parseFloat(user.longitude) : null,
        hasLocation: !!(user.latitude && user.longitude),
        
        id_number: user.id_number,
        kra_pin: user.kra_pin,
        business_registration_number: user.business_registration_number,
        
        delivery_radius: user.delivery_radius || 5,
        operating_hours: user.operating_hours || '24/7',
        
        gas_brands: gasBrands,
        agent_profile: agentProfile,
        wallet: wallet,
        
        created_at: user.created_at,
        updated_at: user.updated_at
      };

      res.json({
        success: true,
        agent: agentData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('🔥 AGENT PROFILE ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get agent profile',
        error: error.message
      });
    }
  };

  /**
   * ✏️ UPDATE AGENT PROFILE
   */
  updateAgentProfile = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '✏️ UPDATE AGENT PROFILE');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const userId = req.user.id;
      const {
        business_name,
        business_address,
        area_name,
        town,
        county,
        address,
        latitude,
        longitude,
        id_number,
        kra_pin,
        business_registration_number,
        delivery_radius,
        operating_hours,
        gas_brand_ids
      } = req.body;

      const user = await db.User.findOne({
        where: { 
          id: userId,
          user_type: 'agent'
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      const updates = {};
      if (business_name !== undefined) updates.business_name = business_name;
      if (business_address !== undefined) updates.business_address = business_address;
      if (area_name !== undefined) updates.area_name = area_name;
      if (town !== undefined) updates.town = town && town !== 'undefined' ? String(town).trim() : null;
      if (county !== undefined) updates.county = county && county !== 'undefined' ? String(county).trim() : null;
      if (address !== undefined) updates.address = address;
      if (latitude !== undefined) updates.latitude = latitude;
      if (longitude !== undefined) updates.longitude = longitude;
      if (id_number !== undefined) updates.id_number = id_number;
      if (kra_pin !== undefined) updates.kra_pin = kra_pin;
      if (business_registration_number !== undefined) updates.business_registration_number = business_registration_number;
      if (delivery_radius !== undefined) updates.delivery_radius = delivery_radius;
      if (operating_hours !== undefined) updates.operating_hours = operating_hours;
      updates.updated_at = new Date();

      await user.update(updates);

      if (gas_brand_ids && Array.isArray(gas_brand_ids)) {
        await db.UserGasBrand.destroy({
          where: { user_id: userId }
        });
        
        const userGasBrands = gas_brand_ids.map(brandId => ({
          user_id: userId,
          gas_brand_id: brandId,
          created_at: new Date(),
          updated_at: new Date()
        }));
        
        await db.UserGasBrand.bulkCreate(userGasBrands);
      }

      res.json({
        success: true,
        message: 'Agent profile updated successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('🔥 UPDATE AGENT ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update agent profile'
      });
    }
  };

  /**
   * 📊 GET AGENT DASHBOARD STATS
   */
  getAgentDashboardStats = async (req, res) => {
    try {
      const userId = req.user.id;
      
      const orders = await db.Order.findAll({
        where: { agent_id: userId }
      });
      
      const totalOrders = orders.length;
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
      const processingOrders = orders.filter(o => o.status === 'processing').length;
      const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
      
      const totalRevenue = orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.grand_total || 0), 0);
      
      const today = new Date().toDateString();
      const todaysOrders = orders.filter(order => {
        if (!order.created_at) return false;
        const orderDate = new Date(order.created_at).toDateString();
        return orderDate === today;
      }).length;
      
      const listings = await db.AgentGasListing.findAll({
        where: { agent_id: userId, is_available: true }
      });
      
      res.json({
        success: true,
        stats: {
          totalOrders,
          pendingOrders,
          deliveredOrders,
          processingOrders,
          cancelledOrders,
          totalRevenue,
          todaysOrders,
          activeListings: listings.length
        }
      });
      
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard stats'
      });
    }
  };

  /**
   * 🛒 GET AGENT ORDERS
   */
  getAgentOrders = async (req, res) => {
    try {
      const userId = req.user.id;
      
      const orders = await db.Order.findAll({
        where: { agent_id: userId },
        order: [['created_at', 'DESC']],
        include: [
          {
            model: db.User,
            as: 'customer',
            attributes: ['id', 'full_name', 'phone_number']
          }
        ]
      });

      res.json({
        success: true,
        orders,
        count: orders.length
      });
    } catch (error) {
      console.error('Get agent orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders'
      });
    }
  };

  /**
   * 🏷️ GET AGENT GAS BRANDS
   */
  getAgentGasBrands = async (req, res) => {
    try {
      const userId = req.user.id;
      
      const userGasBrands = await db.UserGasBrand.findAll({
        where: { user_id: userId },
        include: [
          {
            model: db.GasBrand,
            as: 'gas_brand',
            attributes: ['id', 'name', 'logo_url']
          }
        ]
      });

      const gasBrands = userGasBrands.map(ugb => ugb.gas_brand).filter(Boolean);

      res.json({
        success: true,
        gas_brands: gasBrands
      });
    } catch (error) {
      console.error('Get agent gas brands error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch gas brands'
      });
    }
  };

  /**
   * 🔄 UPDATE AGENT GAS BRANDS
   */
  updateAgentGasBrands = async (req, res) => {
    try {
      const userId = req.user.id;
      const { gas_brand_ids } = req.body;

      await db.UserGasBrand.destroy({
        where: { user_id: userId }
      });

      const userGasBrands = gas_brand_ids.map(brandId => ({
        user_id: userId,
        gas_brand_id: brandId,
        created_at: new Date(),
        updated_at: new Date()
      }));

      await db.UserGasBrand.bulkCreate(userGasBrands);

      const brands = await db.GasBrand.findAll({
        where: { id: gas_brand_ids },
        attributes: ['id', 'name']
      });

      res.json({
        success: true,
        message: 'Gas brands updated successfully',
        gas_brands: brands
      });
    } catch (error) {
      console.error('Update gas brands error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update gas brands'
      });
    }
  };

  // ============================================================================
  // DEBUG & UTILITY METHODS
  // ============================================================================

  /**
   * 🚪 LOGOUT USER - Clear cookie
   */
  logoutUser = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🚪 USER LOGOUT');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      
      console.log(consoleStyle.success, '✅ Logout successful');
      
      res.json({
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 LOGOUT ERROR:', error);
      res.status(200).json({
        success: true,
        message: 'Logged out',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * 🗑️ DELETE ACCOUNT
   */
  deleteAccount = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🗑️ DELETE ACCOUNT');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    
    try {
      const userId = req.user.id;

      const user = await db.User.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await user.update({
        is_active: false,
        deleted_at: new Date(),
        updated_at: new Date()
      });

      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      res.json({
        success: true,
        message: 'Account deleted successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 DELETE ACCOUNT ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }
  };

  /**
   * 🐛 DEBUG USER
   */
  debugUser = async (req, res) => {
    try {
      const { phone_number, email } = req.query;

      let whereClause = {};
      if (phone_number) {
        whereClause.phone_number = this.normalizePhoneNumber(phone_number);
      }
      if (email) whereClause.email = email;

      const user = await db.User.findOne({
        where: whereClause,
        attributes: [
          'id', 'email', 'phone_number', 'full_name', 'user_type',
          'is_verified', 'is_agent_profile_complete',
          'latitude', 'longitude', 'area_name', 'town', 'county', 'address',
          'business_name', 'agent_status',
          'created_at', 'updated_at'
        ]
      });

      if (!user) {
        return res.json({
          success: true,
          message: 'User not found',
          found: false
        });
      }

      res.json({
        success: true,
        user,
        current_time: new Date().toISOString(),
        has_location: user.latitude !== null && user.longitude !== null
      });

    } catch (error) {
      console.error('Debug error:', error);
      res.status(500).json({
        success: false,
        message: 'Debug failed'
      });
    }
  };

  /**
   * 🐛 DEBUG AGENT
   */
  debugAgent = async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await db.User.findByPk(userId, {
        attributes: [
          'id', 'email', 'user_type',
          'business_name', 'town', 'county', 'area_name',
          'latitude', 'longitude', 'is_agent_profile_complete'
        ],
        raw: true
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user,
        database_direct: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Debug agent error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  /**
   * 📧 SEND VERIFICATION CODE VIA EMAIL (Legacy)
   */
/**
 * 📝 STEP 1: SEND VERIFICATION CODE - NO USER CREATED
 * FIXED: Removed database operations completely - using in-memory storage only
 */
sendVerificationCode = async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log(consoleStyle.header, '📧 SEND VERIFICATION CODE');
  console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
  console.log('='.repeat(80));
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, phone_number, full_name, password } = req.body;

    console.log(consoleStyle.info, '📦 Registration Request:');
    console.log(consoleStyle.data, `   Email: ${email}`);
    console.log(consoleStyle.data, `   Phone: ${phone_number}`);
    console.log(consoleStyle.data, `   Name: ${full_name || 'Not provided'}`);

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Normalize phone
    const normalizedPhone = this.normalizePhoneNumber(phone_number);
    console.log(consoleStyle.data, `   Normalized: ${normalizedPhone}`);

    // Check if user already exists
    const existingUser = await db.User.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { email },
          { phone_number: normalizedPhone }
        ]
      }
    });

    if (existingUser) {
      console.log(consoleStyle.error, '❌ User already exists!');
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }

    // Generate verification code
    const code = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // ✅ FIX: Use in-memory storage ONLY - no database operations
    // Initialize global temp storage if it doesn't exist
    if (!global.tempRegistrations) {
      global.tempRegistrations = new Map();
    }

    // Create a unique ID for this verification
    const verificationId = `ver_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Store verification data in memory
    global.tempRegistrations.set(verificationId, {
      email,
      phone_number: normalizedPhone,
      full_name: full_name || null,
      password_hash: password,
      code,
      expires_at: expiresAt,
      is_used: false,
      attempts: 0,
      created_at: new Date()
    });

    console.log(consoleStyle.success, '✅ Verification record created in memory!');
    console.log(consoleStyle.data, `   Verification ID: ${verificationId}`);
    
    // ============================================================
    // LOG CODE TO TERMINAL - BIG AND CLEAR
    // ============================================================
    console.log('\n' + '\x1b[43m\x1b[30m%s\x1b[0m', '🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔');
    console.log('\x1b[43m\x1b[30m%s\x1b[0m', '🔔                                                🔔');
    console.log('\x1b[43m\x1b[30m%s\x1b[0m', '🔔         📧 VERIFICATION CODE GENERATED          🔔');
    console.log('\x1b[43m\x1b[30m%s\x1b[0m', '🔔                                                🔔');
    console.log('\x1b[43m\x1b[30m%s\x1b[0m', '🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔');
    console.log('\x1b[33m%s\x1b[0m', '='.repeat(60));
    console.log('\x1b[33m%s\x1b[0m', '   📋 REGISTRATION DETAILS:');
    console.log('\x1b[33m%s\x1b[0m', '='.repeat(60));
    console.log('\x1b[36m%s\x1b[0m', `   👤 Name: ${full_name || 'Not provided'}`);
    console.log('\x1b[36m%s\x1b[0m', `   📧 Email: ${email}`);
    console.log('\x1b[36m%s\x1b[0m', `   📞 Phone: ${phone_number}`);
    console.log('\x1b[36m%s\x1b[0m', `   🔑 Normalized: ${normalizedPhone}`);
    console.log('\x1b[32m%s\x1b[0m', `   🔢 VERIFICATION CODE: ${code}`);
    console.log('\x1b[34m%s\x1b[0m', `   ⏰ Expires: ${formatKenyaTime(expiresAt)}`);
    console.log('\x1b[33m%s\x1b[0m', '='.repeat(60));
    console.log('\x1b[33m%s\x1b[0m', '   ⚠️  USER NOT CREATED YET - VERIFICATION REQUIRED');
    console.log('\x1b[33m%s\x1b[0m', '='.repeat(60));

    // ============================================================
    // SEND EMAIL TO DEVELOPER (raffnixx@gmail.com)
    // ============================================================
    try {
      const testAccount = await nodemailer.createTestAccount();
      
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const info = await transporter.sendMail({
        from: '"Mtaani Gas" <noreply@mtaanigas.com>',
        to: 'raffnixx@gmail.com',
        subject: `🔐 VERIFICATION CODE: ${code} - ${email}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #FF6B35; margin-bottom: 10px;">Mtaani Gas</h1>
              <p style="color: #666; font-size: 16px;">Futuristic Gas Delivery</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #FF6B35; margin-bottom: 20px;">New Registration - Verification Required</h2>
              
              <div style="background-color: #fff; padding: 30px; border-radius: 10px; border: 3px solid #FF6B35; margin: 20px 0;">
                <p style="color: #666; font-size: 18px; margin-bottom: 15px;">Verification Code:</p>
                <span style="font-size: 48px; font-weight: bold; letter-spacing: 10px; color: #FF6B35;">${code}</span>
              </div>
              
              <div style="text-align: left; margin-top: 30px; padding: 20px; background-color: #fff; border-radius: 10px;">
                <h3 style="color: #333; margin-top: 0;">User Details:</h3>
                <p><strong>Name:</strong> ${full_name || 'Not provided'}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone_number}</p>
                <p><strong>Normalized:</strong> ${normalizedPhone}</p>
                <p><strong>Expires:</strong> ${formatKenyaTime(expiresAt)}</p>
                <p><strong>Verification ID:</strong> ${verificationId}</p>
              </div>
              
              <p style="color: #e74c3c; margin-top: 20px; font-weight: bold;">
                ⚠️ User has NOT been created yet. Verification required.
              </p>
            </div>
            
            <div style="margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
              <p>This is a development verification email for Mtaani Gas.</p>
              <p>© 2026 Mtaani Gas. All rights reserved.</p>
            </div>
          </div>
        `,
      });

      console.log(consoleStyle.success, '✅ Verification email sent to developer!');
      console.log(consoleStyle.info, `   Preview: ${nodemailer.getTestMessageUrl(info)}`);
    } catch (emailError) {
      console.log(consoleStyle.warning, '⚠️ Could not send email:', emailError.message);
      console.log(consoleStyle.warning, '   But code is still available in terminal!');
    }

    // Return success - NO USER CREATED YET
    res.json({
      success: true,
      message: 'Verification code sent. Please verify to complete registration.',
      requires_verification: true,
      verification_id: verificationId,
      expires_at: expiresAt,
      email: email,
      phone: phone_number,
      // Include code only in development
      code: process.env.NODE_ENV === 'development' ? code : undefined
    });

  } catch (error) {
    console.log(consoleStyle.error, '🔥 Send verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

  /**
   * 🧪 DEBUG: Force send verification code to email
   */
  debugSendVerification = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🧪 DEBUG: SEND VERIFICATION TO EMAIL');
    
    try {
      const { phone, email } = req.query;
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      const normalizedPhone = this.normalizePhoneNumber(phone);
      
      const user = await db.User.findOne({
        where: { phone_number: normalizedPhone }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const verificationData = await this.createVerificationCode(user.id, 'phone_verification');
      
      const testAccount = await nodemailer.createTestAccount();
      
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const targetEmail = email || 'raffnixx@gmail.com';

      const info = await transporter.sendMail({
        from: '"Mtaani Gas Debug" <debug@mtaanigas.com>',
        to: targetEmail,
        subject: `🧪 DEBUG: Verification Code for ${user.phone_number}`,
        html: `<div><h1>Code: ${verificationData.code}</h1></div>`,
      });

      res.json({
        success: true,
        message: 'Debug verification code sent to email',
        preview_url: nodemailer.getTestMessageUrl(info),
        code: verificationData.code,
        expires_at: verificationData.expires_at
      });

    } catch (error) {
      console.error('Debug email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send debug email'
      });
    }
  };

  /**
   * Create verification code (legacy)
   */
  createVerificationCode = async (userId, type = 'phone_verification') => {
    try {
      await db.VerificationCode.destroy({
        where: {
          user_id: userId,
          type: type,
          is_used: false
        }
      });

      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const verificationCode = await db.VerificationCode.create({
        user_id: userId,
        code: code,
        type: type,
        expires_at: expiresAt,
        is_used: false,
        attempts: 0
      });

      return {
        code: code,
        expires_at: expiresAt,
        id: verificationCode.id
      };
    } catch (error) {
      console.log(consoleStyle.error, '🔥 Failed to create verification code:', error);
      throw error;
    }
  };

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  formatUserResponse = (user, wallet = null) => {
    const response = {
      id: user.id,
      email: user.email,
      phone_number: user.phone_number,
      full_name: user.full_name,
      user_type: user.user_type,
      is_verified: user.is_verified,
      is_agent_profile_complete: user.is_agent_profile_complete,
      latitude: user.latitude ? parseFloat(user.latitude) : null,
      longitude: user.longitude ? parseFloat(user.longitude) : null,
      area_name: user.area_name,
      town: user.town && user.town !== 'undefined' ? String(user.town) : null,
      county: user.county && user.county !== 'undefined' ? String(user.county) : null,
      address: user.address,
      hasLocation: user.latitude !== null && user.longitude !== null,
      wallet: wallet || user.wallet,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    if (user.user_type === 'agent') {
      response.business_name = user.business_name;
      response.business_address = user.business_address;
      response.agent_status = user.agent_status;
      response.profile_completed_at = user.profile_completed_at;
      response.id_number = user.id_number;
      response.kra_pin = user.kra_pin;
      response.business_registration_number = user.business_registration_number;
      response.delivery_radius = user.delivery_radius || 5;
      response.operating_hours = user.operating_hours || '24/7';
      response.gas_brands = user.gasBrands || [];
      response.agent_profile = user.agentProfile;
    }

    return response;
  };
}

module.exports = new AuthController();