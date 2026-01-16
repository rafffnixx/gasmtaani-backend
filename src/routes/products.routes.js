const express = require('express');
const router = express.Router();
const productController = require('../controllers/productsController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Public routes (no authentication required)
router.get('/gas-brands', productController.getAllGasBrands);
router.get('/brand/:brand_id/sizes', productController.getBrandSizes);
router.get('/brand/:brand_id/size/:size/agents', productController.getAgentsByBrandAndSize);
router.get('/search', productController.searchProducts);
router.get('/nearby-agents', productController.getNearbyAgentsByLocation); // MOVE THIS BEFORE :listing_id
router.get('/:listing_id', productController.getProductDetails);

// Agent-only routes (require auth)
router.get('/agent/listings', authMiddleware, productController.getAgentListings);
router.post('/agent/listings', authMiddleware, productController.createListing);
router.put('/agent/listings/:listing_id', authMiddleware, productController.updateListing);
router.delete('/agent/listings/:listing_id', authMiddleware, productController.deleteListing);

// Location routes
router.post('/agent/location', authMiddleware, productController.updateAgentLocation);
router.post('/customer/location', authMiddleware, productController.updateCustomerLocation);

module.exports = router;