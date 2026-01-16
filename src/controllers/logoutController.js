// controllers/logoutController.js
const jwt = require('jsonwebtoken');

// Console styling matching your auth controller
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

class LogoutController {
  /**
   * @desc    Logout user and invalidate token
   * @route   POST /api/auth/logout
   * @access  Private
   */
  logoutUser = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🚪 USER LOGOUT');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);
    console.log('='.repeat(80));
    
    try {
      // Log request info
      console.log(consoleStyle.info, '📦 Logout Request:');
      console.log(consoleStyle.data, `   User ID: ${req.user?.id || 'Not available'}`);
      console.log(consoleStyle.data, `   User Type: ${req.user?.user_type || 'Not available'}`);
      console.log(consoleStyle.data, `   Method: ${req.method}`);
      console.log(consoleStyle.data, `   IP: ${req.ip || req.connection.remoteAddress}`);

      // Get token from header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log(consoleStyle.warning, '⚠️ No Bearer token in header');
        console.log(consoleStyle.data, `   Header: ${authHeader || 'Not provided'}`);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Logged out (no active token)',
          timestamp: new Date().toISOString()
        });
      }

      const token = authHeader.split(' ')[1];
      console.log(consoleStyle.info, '🔑 Token extracted');
      console.log(consoleStyle.data, `   Token length: ${token.length} chars`);
      
      // Try to decode token for info (optional)
      let tokenInfo = null;
      try {
        const decoded = jwt.decode(token);
        if (decoded) {
          tokenInfo = {
            userId: decoded.id,
            email: decoded.email,
            userType: decoded.user_type,
            issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
            expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null
          };
          
          console.log(consoleStyle.info, '📊 Token Info:');
          console.log(consoleStyle.data, `   User ID: ${decoded.id}`);
          console.log(consoleStyle.data, `   Email: ${decoded.email}`);
          console.log(consoleStyle.data, `   Expires: ${decoded.exp ? formatKenyaTime(new Date(decoded.exp * 1000)) : 'Unknown'}`);
        }
      } catch (decodeError) {
        console.log(consoleStyle.warning, '⚠️ Could not decode token (may be invalid)');
      }

      // ============================================
      // OPTIONAL: Token blacklist implementation
      // Uncomment if you want to implement token blacklisting
      // ============================================
      
      // Option 1: Simple in-memory blacklist (for single server)
      // This is just an example - use Redis or database for production
      /*
      if (!global.tokenBlacklist) {
        global.tokenBlacklist = new Set();
      }
      
      // Add token to blacklist (expires with token expiry)
      global.tokenBlacklist.add(token);
      console.log(consoleStyle.success, '✅ Token added to blacklist');
      */

      // Option 2: Database blacklist (requires Token model)
      /*
      try {
        const Token = require('../models/Token');
        const decoded = jwt.decode(token);
        
        await Token.create({
          token: token,
          userId: decoded?.id || req.user?.id,
          type: 'access',
          blacklisted: true,
          expiresAt: decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000),
          reason: 'user_logout'
        });
        
        console.log(consoleStyle.success, '✅ Token blacklisted in database');
      } catch (dbError) {
        console.log(consoleStyle.warning, `⚠️ Database blacklist failed: ${dbError.message}`);
      }
      */

      // Option 3: Session-based (if using express-session)
      /*
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.log(consoleStyle.error, `❌ Session destroy error: ${err.message}`);
          } else {
            console.log(consoleStyle.success, '✅ Session destroyed');
          }
        });
      }
      */

      // Clear cookies if any
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      res.clearCookie('sessionId');
      console.log(consoleStyle.success, '✅ Cookies cleared');

      // Log successful logout
      console.log('\n' + consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.success, '   ✅ LOGOUT SUCCESSFUL');
      console.log(consoleStyle.highlight, '='.repeat(60));
      console.log(consoleStyle.info, `   👤 User: ${req.user?.email || tokenInfo?.email || 'Unknown'}`);
      console.log(consoleStyle.info, `   🆔 ID: ${req.user?.id || tokenInfo?.userId || 'Unknown'}`);
      console.log(consoleStyle.info, `   🏷️  Type: ${req.user?.user_type || tokenInfo?.userType || 'Unknown'}`);
      console.log(consoleStyle.time, `   ⏰ Time: ${formatKenyaTime(new Date())}`);
      console.log(consoleStyle.highlight, '='.repeat(60));

      // Send success response
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString(),
        server_time_kenya: formatKenyaTime(new Date()),
        user_info: {
          id: req.user?.id || tokenInfo?.userId,
          email: req.user?.email || tokenInfo?.email,
          user_type: req.user?.user_type || tokenInfo?.userType
        },
        action: 'logout_complete',
        next_step: 'client_should_clear_storage'
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 LOGOUT ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      console.log(consoleStyle.data, `   Stack: ${error.stack}`);
      
      // Even if error occurs, send success response to client
      // This ensures client can clear their storage
      res.status(200).json({
        success: true,
        message: 'Logged out (backend cleanup may have issues)',
        timestamp: new Date().toISOString(),
        note: 'Client should clear local storage',
        error_in_backend: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * @desc    Logout from all devices (optional - for premium feature)
   * @route   POST /api/auth/logout-all
   * @access  Private
   */
  logoutAllDevices = async (req, res) => {
    console.log('\n' + '='.repeat(80));
    console.log(consoleStyle.header, '🚪💻 LOGOUT ALL DEVICES');
    console.log(consoleStyle.time, `📅 Time: ${formatKenyaTime(new Date())}`);

    try {
      const userId = req.user.id;
      
      console.log(consoleStyle.info, '📦 Logout All Request:');
      console.log(consoleStyle.data, `   User ID: ${userId}`);
      console.log(consoleStyle.data, `   Email: ${req.user.email}`);
      console.log(consoleStyle.data, `   IP: ${req.ip}`);

      // ============================================
      // Implementation depends on your token strategy
      // ============================================

      // Option 1: If using token versioning in user model
      /*
      const User = require('../models/User');
      await User.update(
        { token_version: db.Sequelize.literal('token_version + 1') },
        { where: { id: userId } }
      );
      */

      // Option 2: If using database token blacklist
      /*
      const Token = require('../models/Token');
      await Token.update(
        { blacklisted: true },
        { where: { userId: userId, blacklisted: false } }
      );
      */

      // Option 3: Update last logout timestamp
      const db = require('../models');
      await db.User.update(
        { 
          last_logout_all: new Date(),
          updated_at: new Date()
        },
        { where: { id: userId } }
      );

      console.log(consoleStyle.success, '✅ Logout from all devices initiated');
      
      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully',
        timestamp: new Date().toISOString(),
        user_id: userId,
        action: 'logout_all_devices'
      });

    } catch (error) {
      console.log(consoleStyle.error, '🔥 LOGOUT ALL ERROR:');
      console.log(consoleStyle.data, `   Error: ${error.message}`);
      
      res.status(500).json({
        success: false,
        message: 'Failed to logout from all devices',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * @desc    Check if token is valid (for client-side validation)
   * @route   GET /api/auth/check-token
   * @access  Private
   */
  checkTokenValidity = async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'No token provided',
          valid: false
        });
      }

      const token = authHeader.split(' ')[1];
      
      // Verify token
      jwt.verify(token, process.env.JWT_SECRET || 'mtaani-gas-secret-key-2024', (err, decoded) => {
        if (err) {
          return res.status(401).json({
            success: false,
            message: 'Token invalid or expired',
            valid: false,
            error: err.name
          });
        }

        res.json({
          success: true,
          message: 'Token is valid',
          valid: true,
          user: {
            id: decoded.id,
            email: decoded.email,
            user_type: decoded.user_type
          },
          expires_at: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
        });
      });

    } catch (error) {
      console.log(consoleStyle.error, 'Token check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check token',
        valid: false
      });
    }
  };
}

module.exports = new LogoutController();