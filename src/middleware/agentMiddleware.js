// src/middleware/agentMiddleware.js

/**
 * 🎯 AGENT MIDDLEWARE
 * Ensures the authenticated user is an agent
 */
const agentMiddleware = async (req, res, next) => {
  try {
    // Check if user exists from auth middleware
    if (!req.user) {
      console.log('❌ Agent middleware: No user found in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    console.log('👤 Agent middleware checking user:', {
      id: req.user.id,
      user_type: req.user.user_type,
      email: req.user.email
    });

    // Check if user is an agent
    if (req.user.user_type !== 'agent') {
      console.log(`❌ Access denied. User type is '${req.user.user_type}', not 'agent'`);
      return res.status(403).json({
        success: false,
        message: `Access denied. Agent privileges required. Current user type: ${req.user.user_type}`
      });
    }

    console.log('✅ Agent middleware: Access granted');
    next();
  } catch (error) {
    console.error('❌ Agent middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify agent privileges'
    });
  }
};

module.exports = { agentMiddleware };