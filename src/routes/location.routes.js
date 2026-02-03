const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authMiddleware } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// GET /api/location - Get user location
router.get('/', locationController.getUserLocation);

// POST /api/location - Create or update location
router.post('/', locationController.createOrUpdateLocation);

// PUT /api/location - Update location
router.put('/', locationController.updateUserLocation);

// PATCH /api/location - Partially update location
router.patch('/', locationController.patchUserLocation);

// DELETE /api/location - Delete location
router.delete('/', locationController.deleteUserLocation);

// GET /api/location/verify - Verify location
router.get('/verify', locationController.verifyLocation);

// GET /api/location/coordinates - Get coordinates only
router.get('/coordinates', locationController.getCoordinates);

// GET /api/location/address - Get address only
router.get('/address', locationController.getAddress);

// POST /api/location/set-from-map - Set location from map
router.post('/set-from-map', locationController.setLocationFromMap);

// GET /api/location/health - Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Location Service',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;