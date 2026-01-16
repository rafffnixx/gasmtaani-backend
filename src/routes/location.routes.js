const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Public routes (no authentication required)
router.get('/search/agents', locationController.searchAgentsByLocation);

// Protected routes (require authentication)
router.post('/update', authMiddleware, locationController.updateLocation);
router.get('/my-location', authMiddleware, locationController.getUserLocation);
router.get('/nearby-agents', authMiddleware, locationController.getNearbyAgents);

module.exports = router;