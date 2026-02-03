const db = require('../models');

// Get user location
exports.getUserLocation = async (req, res) => {
  try {
    console.log('📍 Getting location for user:', req.user.id);
    
    const user = await db.User.findByPk(req.user.id, {
      attributes: ['id', 'latitude', 'longitude', 'area_name', 'town', 'county', 'address', 'created_at', 'updated_at']
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user has location data
    const hasLocation = user.latitude !== null && user.longitude !== null;
    
    res.json({
      success: true,
      hasLocation: hasLocation,
      location: {
        latitude: user.latitude,
        longitude: user.longitude,
        area_name: user.area_name,
        town: user.town,
        county: user.county,
        address: user.address
      },
      user: {
        id: user.id
      },
      timestamps: {
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error fetching user location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch location',
      error: error.message
    });
  }
};

// Create or update location (POST - can handle both create and update)
exports.createOrUpdateLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, area_name, town, county, address } = req.body;
    
    console.log('📍 Creating/Updating location for user:', userId, { latitude, longitude, area_name });
    
    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }
    
    // Parse and validate coordinates
    const validation = validateCoordinates(latitude, longitude);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }
    
    const lat = validation.lat;
    const lng = validation.lng;
    
    // Check if user exists
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Determine if this is a create or update
    const existingLocation = user.latitude !== null && user.longitude !== null;
    
    // Update user location
    const [updated] = await db.User.update(
      {
        latitude: lat,
        longitude: lng,
        area_name: area_name || null,
        town: town || null,
        county: county || null,
        address: address || null,
        updated_at: new Date()
      },
      {
        where: { id: userId },
        returning: true
      }
    );
    
    if (updated === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or location not updated'
      });
    }
    
    // Get updated user
    const updatedUser = await db.User.findByPk(userId, {
      attributes: ['id', 'latitude', 'longitude', 'area_name', 'town', 'county', 'address', 'updated_at']
    });
    
    res.json({
      success: true,
      message: existingLocation ? 'Location updated successfully' : 'Location created successfully',
      action: existingLocation ? 'updated' : 'created',
      location: {
        latitude: updatedUser.latitude,
        longitude: updatedUser.longitude,
        area_name: updatedUser.area_name,
        town: updatedUser.town,
        county: updatedUser.county,
        address: updatedUser.address
      },
      timestamps: {
        updated_at: updatedUser.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error creating/updating user location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save location',
      error: error.message
    });
  }
};

// Update location (PUT - requires all fields)
exports.updateUserLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, area_name, town, county, address } = req.body;
    
    console.log('📍 Updating location for user:', userId);
    
    // Validate required fields for PUT
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }
    
    // Parse and validate coordinates
    const validation = validateCoordinates(latitude, longitude);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }
    
    const lat = validation.lat;
    const lng = validation.lng;
    
    // Check if location exists to update
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.latitude === null || user.longitude === null) {
      return res.status(404).json({
        success: false,
        message: 'No location found to update. Use POST to create a location first.'
      });
    }
    
    // Update user location
    const [updated] = await db.User.update(
      {
        latitude: lat,
        longitude: lng,
        area_name: area_name !== undefined ? area_name : user.area_name,
        town: town !== undefined ? town : user.town,
        county: county !== undefined ? county : user.county,
        address: address !== undefined ? address : user.address,
        updated_at: new Date()
      },
      {
        where: { id: userId },
        returning: true
      }
    );
    
    if (updated === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not updated'
      });
    }
    
    // Get updated user
    const updatedUser = await db.User.findByPk(userId, {
      attributes: ['id', 'latitude', 'longitude', 'area_name', 'town', 'county', 'address', 'updated_at']
    });
    
    res.json({
      success: true,
      message: 'Location updated successfully',
      location: {
        latitude: updatedUser.latitude,
        longitude: updatedUser.longitude,
        area_name: updatedUser.area_name,
        town: updatedUser.town,
        county: updatedUser.county,
        address: updatedUser.address
      },
      timestamps: {
        updated_at: updatedUser.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error updating user location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location',
      error: error.message
    });
  }
};

// Partially update location (PATCH)
exports.patchUserLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    
    console.log('📍 Patching location for user:', userId, updates);
    
    // Check if user exists
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Validate coordinates if provided
    if (updates.latitude || updates.longitude) {
      if (updates.latitude && updates.longitude) {
        const validation = validateCoordinates(updates.latitude, updates.longitude);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            message: validation.message
          });
        }
        updates.latitude = validation.lat;
        updates.longitude = validation.lng;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Both latitude and longitude must be provided together'
        });
      }
    }
    
    // Add updated timestamp
    updates.updated_at = new Date();
    
    // Update user location
    const [updated] = await db.User.update(updates, {
      where: { id: userId },
      returning: true,
      fields: ['latitude', 'longitude', 'area_name', 'town', 'county', 'address', 'updated_at']
    });
    
    if (updated === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not updated'
      });
    }
    
    // Get updated user
    const updatedUser = await db.User.findByPk(userId, {
      attributes: ['id', 'latitude', 'longitude', 'area_name', 'town', 'county', 'address', 'updated_at']
    });
    
    res.json({
      success: true,
      message: 'Location patched successfully',
      location: {
        latitude: updatedUser.latitude,
        longitude: updatedUser.longitude,
        area_name: updatedUser.area_name,
        town: updatedUser.town,
        county: updatedUser.county,
        address: updatedUser.address
      },
      timestamps: {
        updated_at: updatedUser.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error patching user location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to patch location',
      error: error.message
    });
  }
};

// Delete user location
exports.deleteUserLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📍 Deleting location for user:', userId);
    
    const [updated] = await db.User.update(
      {
        latitude: null,
        longitude: null,
        area_name: null,
        town: null,
        county: null,
        address: null,
        updated_at: new Date()
      },
      {
        where: { id: userId }
      }
    );
    
    if (updated === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Location deleted successfully',
      timestamps: {
        deleted_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error deleting user location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete location',
      error: error.message
    });
  }
};

// Verify if user has location
exports.verifyLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📍 Verifying location for user:', userId);
    
    const user = await db.User.findByPk(userId, {
      attributes: ['latitude', 'longitude']
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const hasLocation = user.latitude !== null && user.longitude !== null;
    
    res.json({
      success: true,
      hasLocation: hasLocation,
      isComplete: hasLocation && user.latitude !== 0 && user.longitude !== 0,
      coordinates: hasLocation ? {
        latitude: user.latitude,
        longitude: user.longitude
      } : null
    });
    
  } catch (error) {
    console.error('Error verifying location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify location',
      error: error.message
    });
  }
};

// Get only coordinates
exports.getCoordinates = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📍 Getting coordinates for user:', userId);
    
    const user = await db.User.findByPk(userId, {
      attributes: ['latitude', 'longitude']
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const hasLocation = user.latitude !== null && user.longitude !== null;
    
    if (!hasLocation) {
      return res.status(404).json({
        success: false,
        message: 'No coordinates found'
      });
    }
    
    res.json({
      success: true,
      coordinates: {
        latitude: user.latitude,
        longitude: user.longitude
      }
    });
    
  } catch (error) {
    console.error('Error getting coordinates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get coordinates',
      error: error.message
    });
  }
};

// Get only address details
exports.getAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📍 Getting address for user:', userId);
    
    const user = await db.User.findByPk(userId, {
      attributes: ['area_name', 'town', 'county', 'address']
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if any address field exists
    const hasAddress = user.area_name || user.town || user.county || user.address;
    
    if (!hasAddress) {
      return res.status(404).json({
        success: false,
        message: 'No address details found'
      });
    }
    
    res.json({
      success: true,
      address: {
        area_name: user.area_name,
        town: user.town,
        county: user.county,
        address: user.address
      }
    });
    
  } catch (error) {
    console.error('Error getting address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get address',
      error: error.message
    });
  }
};

// Set location from map (with validation)
exports.setLocationFromMap = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, address, place_name } = req.body;
    
    console.log('📍 [MAP] Setting location from map for user:', userId, {
      latitude,
      longitude,
      place_name
    });
    
    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }
    
    // Parse coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }
    
    // Update user
    const updateData = {
      latitude: lat,
      longitude: lng,
      updated_at: new Date()
    };
    
    // Try to extract area/town from place_name or address
    if (place_name) {
      // Simple parsing - you might want to improve this
      const parts = place_name.split(',').map(p => p.trim());
      if (parts.length > 0) {
        updateData.area_name = parts[0];
      }
      if (parts.length > 1) {
        updateData.town = parts[1];
      }
    }
    
    if (address) {
      updateData.address = address;
    }
    
    const [updated] = await db.User.update(updateData, {
      where: { id: userId }
    });
    
    if (updated === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get updated user
    const updatedUser = await db.User.findByPk(userId, {
      attributes: ['latitude', 'longitude', 'area_name', 'town', 'county', 'address']
    });
    
    res.json({
      success: true,
      message: 'Location set from map successfully',
      location: {
        latitude: updatedUser.latitude,
        longitude: updatedUser.longitude,
        area_name: updatedUser.area_name,
        town: updatedUser.town,
        county: updatedUser.county,
        address: updatedUser.address
      },
      map_data: {
        place_name,
        address
      }
    });
    
  } catch (error) {
    console.error('Error setting location from map:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set location from map',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to validate coordinates
function validateCoordinates(latitude, longitude) {
  try {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lng)) {
      return { valid: false, message: 'Invalid coordinates format. Must be numbers.' };
    }
    
    // Validate coordinate ranges
    if (lat < -90 || lat > 90) {
      return { valid: false, message: 'Latitude must be between -90 and 90 degrees' };
    }
    
    if (lng < -180 || lng > 180) {
      return { valid: false, message: 'Longitude must be between -180 and 180 degrees' };
    }
    
    // Validate for Kenya (approximate coordinates)
    if (lat < -5 || lat > 5 || lng < 33 || lng > 42) {
      console.warn(`Warning: Coordinates (${lat}, ${lng}) are outside typical Kenya range`);
    }
    
    return { valid: true, lat, lng };
    
  } catch (error) {
    return { valid: false, message: 'Invalid coordinates format' };
  }
}