const express = require('express');
const router = express.Router();
const agentsController = require('../controllers/agentsController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Public routes - accessible by anyone
router.get('/nearby', agentsController.getNearbyAgents);
router.get('/brand/:brandId', agentsController.getAgentsByBrand);
router.get('/brands-with-agent-counts', agentsController.getGasBrandsWithAgentCounts);

// Protected route for updating user location
router.put('/update-location', authMiddleware, agentsController.updateUserLocation);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Agents service is running',
    endpoints: [
      { method: 'GET', path: '/agents/nearby', query: 'lat, lng, radius, brand_id, size' },
      { method: 'GET', path: '/agents/brand/:brandId', query: 'lat, lng, radius' },
      { method: 'GET', path: '/agents/brands-with-agent-counts', query: 'lat, lng, radius' },
      { method: 'PUT', path: '/agents/update-location', auth: true }
    ]
  });
});

module.exports = router;