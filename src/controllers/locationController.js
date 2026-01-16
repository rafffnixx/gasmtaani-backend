const db = require('../models');

class LocationController {
  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  // Update user location
  updateLocation = async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        latitude, 
        longitude, 
        address, 
        area_name, 
        town, 
        county 
      } = req.body;

      console.log(`📍 Updating location for user ${userId}`);
      console.log(`📌 Coordinates: ${latitude}, ${longitude}`);
      console.log(`🏠 Address: ${address}`);

      // Validate coordinates
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
      }

      const user = await db.User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update user location
      await user.update({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address,
        area_name: area_name,
        town: town,
        county: county
      });

      console.log(`✅ Location updated for user ${userId}`);

      res.json({
        success: true,
        message: 'Location updated successfully',
        location: {
          latitude: user.latitude,
          longitude: user.longitude,
          address: user.address,
          area_name: user.area_name,
          town: user.town,
          county: user.county,
          updated_at: user.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error updating location:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location',
        error: error.message
      });
    }
  };

  // Get nearby agents (for customers)
  getNearbyAgents = async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        latitude, 
        longitude, 
        radius = 10, // Default 10km radius
        brand_id,
        size 
      } = req.query;

      console.log(`🔍 Finding nearby agents for user ${userId}`);
      console.log(`📍 User location: ${latitude}, ${longitude}`);
      console.log(`📏 Search radius: ${radius}km`);

      // Get user's location
      const user = await db.User.findByPk(userId, {
        attributes: ['id', 'latitude', 'longitude']
      });

      let userLat, userLon;
      
      if (latitude && longitude) {
        // Use provided coordinates
        userLat = parseFloat(latitude);
        userLon = parseFloat(longitude);
      } else if (user.latitude && user.longitude) {
        // Use user's saved location
        userLat = parseFloat(user.latitude);
        userLon = parseFloat(user.longitude);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Location required. Either provide coordinates or update your profile location.'
        });
      }

      // Build base query for listings
      let whereCondition = {
        is_available: true,
        available_quantity: { [db.Sequelize.Op.gt]: 0 }
      };

      if (brand_id) whereCondition.gas_brand_id = brand_id;
      if (size) whereCondition.size = size;

      // Get all active listings
      const listings = await db.AgentGasListing.findAll({
        where: whereCondition,
        include: [
          {
            model: db.User,
            as: 'listingAgent',
            attributes: ['id', 'email', 'phone_number', 'latitude', 'longitude', 'address', 'area_name', 'business_name', 'profile_image']
          },
          {
            model: db.GasBrand,
            as: 'gasBrand',
            attributes: ['id', 'name', 'logo_url']
          }
        ]
      });

      console.log(`📦 Found ${listings.length} listings initially`);

      // Filter by distance
      const radiusKm = parseFloat(radius);
      const nearbyListings = listings.filter(listing => {
        const agent = listing.listingAgent;
        
        if (!agent.latitude || !agent.longitude) return false;
        
        const agentLat = parseFloat(agent.latitude);
        const agentLon = parseFloat(agent.longitude);
        
        const distance = this.calculateDistance(userLat, userLon, agentLat, agentLon);
        listing.dataValues.distance = parseFloat(distance.toFixed(2));
        
        return distance <= radiusKm;
      });

      // Sort by distance (closest first)
      nearbyListings.sort((a, b) => a.dataValues.distance - b.dataValues.distance);

      console.log(`📍 Found ${nearbyListings.length} listings within ${radiusKm}km`);

      // Format response
      const formattedListings = nearbyListings.map(listing => ({
        listing_id: listing.id,
        agent: {
          id: listing.listingAgent.id,
          name: listing.listingAgent.business_name || `Agent ${listing.listingAgent.id}`,
          phone: listing.listingAgent.phone_number,
          email: listing.listingAgent.email,
          profile_image: listing.listingAgent.profile_image,
          location: {
            latitude: listing.listingAgent.latitude,
            longitude: listing.listingAgent.longitude,
            address: listing.listingAgent.address,
            area_name: listing.listingAgent.area_name
          },
          distance: listing.dataValues.distance,
          rating: listing.rating,
          total_orders: listing.total_orders
        },
        product: {
          brand: listing.gasBrand.name,
          brand_id: listing.gasBrand.id,
          brand_logo: listing.gasBrand.logo_url,
          size: listing.size,
          price: parseFloat(listing.selling_price),
          original_price: listing.original_price ? parseFloat(listing.original_price) : null,
          cylinder_condition: listing.cylinder_condition
        },
        availability: {
          quantity: listing.available_quantity,
          delivery_available: listing.delivery_available,
          delivery_fee: listing.delivery_fee ? parseFloat(listing.delivery_fee) : 0,
          delivery_hours: listing.delivery_hours
        }
      }));

      // Group by agent for better presentation
      const agentsMap = new Map();
      formattedListings.forEach(listing => {
        const agentId = listing.agent.id;
        if (!agentsMap.has(agentId)) {
          agentsMap.set(agentId, {
            agent: listing.agent,
            products: []
          });
        }
        agentsMap.get(agentId).products.push({
          listing_id: listing.listing_id,
          brand: listing.product.brand,
          size: listing.product.size,
          price: listing.product.price,
          quantity: listing.availability.quantity
        });
      });

      const agents = Array.from(agentsMap.values());

      res.json({
        success: true,
        user_location: {
          latitude: userLat,
          longitude: userLon,
          provided: !!(latitude && longitude)
        },
        search_radius: radiusKm,
        total_listings: formattedListings.length,
        total_agents: agents.length,
        agents: agents,
        listings: formattedListings
      });

    } catch (error) {
      console.error('❌ Error finding nearby agents:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to find nearby agents',
        error: error.message
      });
    }
  };

  // Get user's current location
  getUserLocation = async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await db.User.findByPk(userId, {
        attributes: ['id', 'latitude', 'longitude', 'address', 'area_name', 'town', 'county', 'updated_at']
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        has_location: !!(user.latitude && user.longitude),
        location: user.latitude && user.longitude ? {
          latitude: user.latitude,
          longitude: user.longitude,
          address: user.address,
          area_name: user.area_name,
          town: user.town,
          county: user.county,
          last_updated: user.updated_at
        } : null,
        message: user.latitude && user.longitude 
          ? 'Location found' 
          : 'No location set. Please update your location.'
      });

    } catch (error) {
      console.error('❌ Error getting user location:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get location',
        error: error.message
      });
    }
  };

  // Search agents by location (public endpoint - no auth required)
  searchAgentsByLocation = async (req, res) => {
    try {
      const { 
        latitude, 
        longitude, 
        radius = 10,
        brand_id,
        size,
        max_price,
        min_price
      } = req.query;

      console.log(`🔍 Public search for agents near ${latitude}, ${longitude}`);
      console.log(`📏 Radius: ${radius}km`);

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required for location search'
        });
      }

      const userLat = parseFloat(latitude);
      const userLon = parseFloat(longitude);
      const radiusKm = parseFloat(radius);

      // Build query conditions
      let whereCondition = {
        is_available: true,
        available_quantity: { [db.Sequelize.Op.gt]: 0 }
      };

      if (brand_id) whereCondition.gas_brand_id = brand_id;
      if (size) whereCondition.size = size;
      if (max_price) whereCondition.selling_price = { [db.Sequelize.Op.lte]: parseFloat(max_price) };
      if (min_price) whereCondition.selling_price = { 
        ...whereCondition.selling_price,
        [db.Sequelize.Op.gte]: parseFloat(min_price)
      };

      // Get listings
      const listings = await db.AgentGasListing.findAll({
        where: whereCondition,
        include: [
          {
            model: db.User,
            as: 'listingAgent',
            where: {
              latitude: { [db.Sequelize.Op.ne]: null },
              longitude: { [db.Sequelize.Op.ne]: null },
              is_active: true
            },
            attributes: ['id', 'email', 'phone_number', 'latitude', 'longitude', 'address', 'area_name', 'business_name']
          },
          {
            model: db.GasBrand,
            as: 'gasBrand',
            attributes: ['id', 'name', 'logo_url']
          }
        ]
      });

      console.log(`📦 Found ${listings.length} listings with location data`);

      // Filter by distance
      const nearbyListings = listings.filter(listing => {
        const agent = listing.listingAgent;
        const agentLat = parseFloat(agent.latitude);
        const agentLon = parseFloat(agent.longitude);
        
        const distance = this.calculateDistance(userLat, userLon, agentLat, agentLon);
        listing.dataValues.distance = parseFloat(distance.toFixed(2));
        
        return distance <= radiusKm;
      });

      // Sort by distance then price
      nearbyListings.sort((a, b) => {
        if (a.dataValues.distance !== b.dataValues.distance) {
          return a.dataValues.distance - b.dataValues.distance;
        }
        return a.selling_price - b.selling_price;
      });

      console.log(`📍 ${nearbyListings.length} listings within ${radiusKm}km`);

      // Format response
      const formattedListings = nearbyListings.map(listing => ({
        listing_id: listing.id,
        agent: {
          id: listing.listingAgent.id,
          name: listing.listingAgent.business_name || `Agent ${listing.listingAgent.id}`,
          phone: listing.listingAgent.phone_number,
          location: {
            latitude: listing.listingAgent.latitude,
            longitude: listing.listingAgent.longitude,
            address: listing.listingAgent.address,
            area_name: listing.listingAgent.area_name,
            distance: listing.dataValues.distance
          }
        },
        product: {
          brand: listing.gasBrand.name,
          size: listing.size,
          price: parseFloat(listing.selling_price),
          cylinder_condition: listing.cylinder_condition
        },
        delivery: {
          available: listing.delivery_available,
          fee: listing.delivery_fee ? parseFloat(listing.delivery_fee) : 0
        }
      }));

      res.json({
        success: true,
        search_location: {
          latitude: userLat,
          longitude: userLon
        },
        search_radius: radiusKm,
        filters: {
          brand_id: brand_id || 'any',
          size: size || 'any',
          price_range: {
            min: min_price || 'any',
            max: max_price || 'any'
          }
        },
        total_results: formattedListings.length,
        results: formattedListings
      });

    } catch (error) {
      console.error('❌ Error searching agents by location:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search agents',
        error: error.message
      });
    }
  };
}

module.exports = new LocationController();