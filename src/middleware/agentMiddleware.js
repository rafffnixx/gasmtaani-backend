// src/middleware/agentMiddleware.js

/**
 * 🎯 AGENT MIDDLEWARE
 * Ensures the authenticated user is an agent
 */
const agentMiddleware = async (req, res, next) => {
  try {
    // Check if user exists from auth middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user is an agent
    if (req.user.user_type !== 'agent') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Agent privileges required.'
      });
    }

    // For routes that require complete profile (optional)
    // Uncomment if you want to enforce complete profile for certain routes
    /*
    if (req.path.includes('/dashboard') || req.path.includes('/orders')) {
      if (!req.user.is_agent_profile_complete) {
        return res.status(403).json({
          success: false,
          message: 'Please complete your agent profile first',
          requires_profile_completion: true
        });
      }
    }
    */

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