// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const db = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // ✅ 1. Try to get token from cookie first (most secure)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('🔑 Auth via cookie');
    }
    
    // ✅ 2. Fallback to Authorization header (for development/API clients)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
        console.log('🔑 Auth via header');
      }
    }

    // ✅ 3. No token found
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'mtaani-gas-secret-key-2024'
    );
    
    // Check if user exists and is active
    const user = await db.User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    // ✅ Attach FULL user object to request
    req.user = {
      id: user.id,
      email: user.email,
      phone_number: user.phone_number,
      full_name: user.full_name,
      user_type: user.user_type,
      is_verified: user.is_verified,
      is_agent_profile_complete: user.is_agent_profile_complete,
      business_name: user.business_name,
      agent_status: user.agent_status,
      town: user.town,
      county: user.county
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    console.error('❌ Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

module.exports = { authMiddleware };