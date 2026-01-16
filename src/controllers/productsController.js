const db = require('../models');
const { Op } = require('sequelize');

class ProductController {
  // Helper: Calculate distance between two coordinates (Haversine formula)
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

  // 1. Get all gas brands (admin catalog)
  getAllGasBrands = async (req, res) => {
    try {
      console.log('📦 Fetching all gas brands...');
      
      const gasBrands = await db.GasBrand.findAll({
        where: { is_active: true },
        order: [
          ['is_popular', 'DESC'],
          ['name', 'ASC']
        ]
      });

      console.log(`✅ Found ${gasBrands.length} gas brands`);
      
      res.json({
        success: true,
        count: gasBrands.length,
        brands: gasBrands
      });

    } catch (error) {
      console.error('❌ Error fetching gas brands:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch gas brands',
        error: error.message
      });
    }
  };

  // 2. Get available sizes for a gas brand
  getBrandSizes = async (req, res) => {
    try {
      const { brand_id } = req.params;
      
      console.log(`📦 Fetching sizes for brand ID: ${brand_id}`);
      
      const brand = await db.GasBrand.findByPk(brand_id);
      
      if (!brand) {
        return res.status(404).json({
          success: false,
          message: 'Gas brand not found'
        });
      }

      // Get unique sizes from agent listings for this brand
      const listings = await db.AgentGasListing.findAll({
        where: { 
          gas_brand_id: brand_id,
          is_available: true,
          available_quantity: { [db.Sequelize.Op.gt]: 0 }
        },
        attributes: ['size'],
        group: ['size']
      });

      const sizes = listings.map(listing => listing.size);
      
      console.log(`✅ Found ${sizes.length} sizes for ${brand.name}`);
      
      res.json({
        success: true,
        brand: {
          id: brand.id,
          name: brand.name,
          logo_url: brand.logo_url
        },
        sizes: sizes
      });

    } catch (error) {
      console.error('❌ Error fetching brand sizes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch brand sizes',
        error: error.message
      });
    }
  };

  // 3. Get agents selling a specific brand and size (with location filter)
  getAgentsByBrandAndSize = async (req, res) => {
    try {
      const { brand_id, size } = req.params;
      const { latitude, longitude, radius = 10 } = req.query; // radius in km
      
      console.log(`🔍 Searching agents for brand ${brand_id}, size ${size}`);
      console.log(`📍 Location filter: ${latitude}, ${longitude}, radius: ${radius}km`);
      
      // Base query condition
      let whereCondition = {
        gas_brand_id: brand_id,
        size: size,
        is_available: true,
        available_quantity: { [db.Sequelize.Op.gt]: 0 }
      };

      // Get all agents with their listings
      let listings = await db.AgentGasListing.findAll({
        where: whereCondition,
        include: [
          {
            model: db.User,
            as: 'listingAgent',
            attributes: ['id', 'email', 'phone_number', 'latitude', 'longitude', 'address', 'area_name', 'business_name']
          },
          {
            model: db.GasBrand,
            as: 'brand', // CHANGED: 'gasBrand' -> 'brand'
            attributes: ['id', 'name', 'logo_url']
          }
        ],
        order: [
          ['selling_price', 'ASC'], // Sort by price (lowest first)
          ['rating', 'DESC'], // Then by rating
          ['total_orders', 'DESC'] // Then by popularity
        ]
      });

      console.log(`✅ Found ${listings.length} listings initially`);

      // Filter by location if coordinates provided
      if (latitude && longitude) {
        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);
        const radiusKm = parseFloat(radius);

        // Filter listings by distance (using agent's location from User model)
        listings = listings.filter(listing => {
          const agent = listing.listingAgent;
          
          if (!agent.latitude || !agent.longitude) return false; // Agent has no location
          
          const distance = this.calculateDistance(
            userLat, userLon,
            parseFloat(agent.latitude),
            parseFloat(agent.longitude)
          );
          
          listing.dataValues.distance = parseFloat(distance.toFixed(2));
          return distance <= radiusKm;
        });

        // Sort by distance
        listings.sort((a, b) => a.dataValues.distance - b.dataValues.distance);
        
        console.log(`📍 After location filter: ${listings.length} listings within ${radiusKm}km`);
      }

      // Format response
      const formattedListings = listings.map(listing => ({
        listing_id: listing.id,
        agent: {
          id: listing.listingAgent.id,
          name: listing.listingAgent.business_name || listing.listingAgent.email.split('@')[0], // Fallback to email prefix
          phone: listing.listingAgent.phone_number,
          location: listing.listingAgent.latitude && listing.listingAgent.longitude ? {
            latitude: listing.listingAgent.latitude,
            longitude: listing.listingAgent.longitude,
            address: listing.listingAgent.address,
            area_name: listing.listingAgent.area_name
          } : null,
          rating: listing.rating,
          total_orders: listing.total_orders
        },
        brand: {
          id: listing.brand.id, // CHANGED: listing.gasBrand -> listing.brand
          name: listing.brand.name,
          logo_url: listing.brand.logo_url
        },
        size: listing.size,
        price: parseFloat(listing.selling_price),
        original_price: listing.original_price ? parseFloat(listing.original_price) : null,
        available_quantity: listing.available_quantity,
        delivery_available: listing.delivery_available,
        delivery_fee: listing.delivery_fee ? parseFloat(listing.delivery_fee) : 0,
        delivery_hours: listing.delivery_hours,
        cylinder_condition: listing.cylinder_condition,
        distance: listing.dataValues.distance || null,
        created_at: listing.created_at
      }));

      // Get brand info
      const brand = await db.GasBrand.findByPk(brand_id, {
        attributes: ['id', 'name', 'logo_url', 'description']
      });

      res.json({
        success: true,
        count: formattedListings.length,
        brand: brand,
        size: size,
        filters: {
          location: {
            latitude: latitude || null,
            longitude: longitude || null,
            radius: radius
          }
        },
        listings: formattedListings
      });

    } catch (error) {
      console.error('❌ Error fetching agents:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch agents',
        error: error.message
      });
    }
  };

  // 4. Get all products (listings) for an agent
  getAgentListings = async (req, res) => {
    try {
      const agentId = req.user.id;
      
      console.log(`📋 Fetching listings for agent: ${agentId}`);
      
      const listings = await db.AgentGasListing.findAll({
        where: { agent_id: agentId },
        include: [
          {
            model: db.GasBrand,
            as: 'brand', // CHANGED: 'gasBrand' -> 'brand'
            attributes: ['id', 'name', 'logo_url']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      const formattedListings = listings.map(listing => ({
        id: listing.id,
        brand: listing.brand, // CHANGED: listing.gasBrand -> listing.brand
        size: listing.size,
        selling_price: parseFloat(listing.selling_price),
        available_quantity: listing.available_quantity,
        is_available: listing.is_available,
        cylinder_condition: listing.cylinder_condition,
        delivery_available: listing.delivery_available,
        delivery_fee: listing.delivery_fee ? parseFloat(listing.delivery_fee) : 0,
        delivery_hours: listing.delivery_hours,
        rating: listing.rating,
        total_orders: listing.total_orders,
        created_at: listing.created_at,
        updated_at: listing.updated_at
      }));

      console.log(`✅ Found ${listings.length} listings for agent ${agentId}`);
      
      res.json({
        success: true,
        count: listings.length,
        listings: formattedListings
      });

    } catch (error) {
      console.error('❌ Error fetching agent listings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch agent listings',
        error: error.message
      });
    }
  };

  // 5. Create new listing (Agent only)
  createListing = async (req, res) => {
    try {
      if (req.user.user_type !== 'agent') {
        return res.status(403).json({
          success: false,
          message: 'Only agents can create listings'
        });
      }

      const agentId = req.user.id;
      const {
        gas_brand_id,
        size,
        selling_price,
        available_quantity = 1,
        cylinder_condition = 'refilled',
        delivery_available = false,
        delivery_fee = 0,
        delivery_hours = 2,
        original_price = null,
        description = ''
      } = req.body;

      console.log(`➕ Creating new listing for agent: ${agentId}`);
      console.log(`📦 Product: brand ${gas_brand_id}, size ${size}, price ${selling_price}`);

      // Validate brand exists
      const brand = await db.GasBrand.findByPk(gas_brand_id);
      if (!brand) {
        return res.status(404).json({
          success: false,
          message: 'Gas brand not found'
        });
      }

      // Check if listing already exists for this agent, brand, and size
      const existingListing = await db.AgentGasListing.findOne({
        where: {
          agent_id: agentId,
          gas_brand_id: gas_brand_id,
          size: size
        }
      });

      if (existingListing) {
        return res.status(400).json({
          success: false,
          message: 'You already have a listing for this brand and size. Please update it instead.'
        });
      }

      // Create new listing
      const listing = await db.AgentGasListing.create({
        agent_id: agentId,
        gas_brand_id,
        size,
        selling_price,
        available_quantity,
        cylinder_condition,
        delivery_available,
        delivery_fee,
        delivery_hours,
        original_price,
        description,
        is_available: true,
        rating: 0,
        total_orders: 0
      });

      console.log(`✅ Listing created with ID: ${listing.id}`);

      res.status(201).json({
        success: true,
        message: 'Listing created successfully',
        listing: {
          id: listing.id,
          brand: {
            id: brand.id,
            name: brand.name,
            logo_url: brand.logo_url
          },
          size: listing.size,
          selling_price: parseFloat(listing.selling_price),
          available_quantity: listing.available_quantity,
          cylinder_condition: listing.cylinder_condition,
          delivery_available: listing.delivery_available,
          delivery_fee: listing.delivery_fee ? parseFloat(listing.delivery_fee) : 0,
          delivery_hours: listing.delivery_hours,
          created_at: listing.created_at
        }
      });

    } catch (error) {
      console.error('❌ Error creating listing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create listing',
        error: error.message
      });
    }
  };

  // 6. Update listing (Agent only)
  updateListing = async (req, res) => {
    try {
      if (req.user.user_type !== 'agent') {
        return res.status(403).json({
          success: false,
          message: 'Only agents can update listings'
        });
      }

      const agentId = req.user.id;
      const { listing_id } = req.params;
      const updateData = req.body;

      console.log(`🔄 Updating listing ${listing_id} for agent ${agentId}`);
      console.log('📝 Update data:', updateData);

      // Find listing
      const listing = await db.AgentGasListing.findOne({
        where: {
          id: listing_id,
          agent_id: agentId
        },
        include: [{
          model: db.GasBrand,
          as: 'brand', // CHANGED: 'gasBrand' -> 'brand'
          attributes: ['id', 'name', 'logo_url']
        }]
      });

      if (!listing) {
        return res.status(404).json({
          success: false,
          message: 'Listing not found or you do not have permission to update it'
        });
      }

      // Update listing
      await listing.update(updateData);

      console.log(`✅ Listing ${listing_id} updated successfully`);

      res.json({
        success: true,
        message: 'Listing updated successfully',
        listing: {
          id: listing.id,
          brand: listing.brand, // CHANGED: listing.gasBrand -> listing.brand
          size: listing.size,
          selling_price: parseFloat(listing.selling_price),
          available_quantity: listing.available_quantity,
          is_available: listing.is_available,
          cylinder_condition: listing.cylinder_condition,
          delivery_available: listing.delivery_available,
          delivery_fee: listing.delivery_fee ? parseFloat(listing.delivery_fee) : 0,
          delivery_hours: listing.delivery_hours,
          updated_at: listing.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error updating listing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update listing',
        error: error.message
      });
    }
  };

  // 7. Delete listing (Agent only)
  deleteListing = async (req, res) => {
    try {
      if (req.user.user_type !== 'agent') {
        return res.status(403).json({
          success: false,
          message: 'Only agents can delete listings'
        });
      }

      const agentId = req.user.id;
      const { listing_id } = req.params;

      console.log(`🗑️ Deleting listing ${listing_id} for agent ${agentId}`);

      // Find and delete listing
      const result = await db.AgentGasListing.destroy({
        where: {
          id: listing_id,
          agent_id: agentId
        }
      });

      if (result === 0) {
        return res.status(404).json({
          success: false,
          message: 'Listing not found or you do not have permission to delete it'
        });
      }

      console.log(`✅ Listing ${listing_id} deleted successfully`);

      res.json({
        success: true,
        message: 'Listing deleted successfully'
      });

    } catch (error) {
      console.error('❌ Error deleting listing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete listing',
        error: error.message
      });
    }
  };

  // 8. Search products across all brands
  searchProducts = async (req, res) => {
    try {
      const { 
        query, 
        brand_id, 
        size, 
        min_price, 
        max_price,
        latitude,
        longitude,
        radius = 10,
        page = 1,
        limit = 20
      } = req.query;

      console.log(`🔍 Product search query: ${query || 'All products'}`);
      console.log(`📏 Filters: brand=${brand_id}, size=${size}, price=${min_price}-${max_price}`);
      console.log(`📍 Location: ${latitude}, ${longitude}, radius=${radius}km`);
      console.log(`📄 Pagination: page=${page}, limit=${limit}`);

      const offset = (page - 1) * limit;

      // Build where condition
      let whereCondition = {
        is_available: true,
        available_quantity: { [db.Sequelize.Op.gt]: 0 }
      };

      if (brand_id) whereCondition.gas_brand_id = brand_id;
      if (size) whereCondition.size = size;
      if (min_price) whereCondition.selling_price = { [db.Sequelize.Op.gte]: parseFloat(min_price) };
      if (max_price) {
        whereCondition.selling_price = { 
          ...whereCondition.selling_price,
          [db.Sequelize.Op.lte]: parseFloat(max_price)
        };
      }

      // Search by brand name if query provided
      let includeBrandCondition = {};
      if (query) {
        includeBrandCondition = {
          model: db.GasBrand,
          as: 'brand', // CHANGED: 'gasBrand' -> 'brand'
          where: {
            name: { [db.Sequelize.Op.iLike]: `%${query}%` }
          }
        };
      } else {
        includeBrandCondition = {
          model: db.GasBrand,
          as: 'brand' // CHANGED: 'gasBrand' -> 'brand'
        };
      }

      let listings = await db.AgentGasListing.findAll({
        where: whereCondition,
        include: [
          includeBrandCondition,
          {
            model: db.User,
            as: 'listingAgent',
            attributes: ['id', 'email', 'phone_number', 'latitude', 'longitude', 'address', 'area_name', 'business_name']
          }
        ],
        order: [
          ['selling_price', 'ASC'],
          ['rating', 'DESC']
        ],
        limit: parseInt(limit),
        offset: offset
      });

      console.log(`✅ Found ${listings.length} listings initially`);

      // Filter by location if coordinates provided
      if (latitude && longitude) {
        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);
        const radiusKm = parseFloat(radius);

        // Filter listings by distance (using agent's location from User model)
        listings = listings.filter(listing => {
          const agent = listing.listingAgent;
          
          if (!agent.latitude || !agent.longitude) return false; // Agent has no location
          
          const distance = this.calculateDistance(
            userLat, userLon,
            parseFloat(agent.latitude),
            parseFloat(agent.longitude)
          );
          
          listing.dataValues.distance = parseFloat(distance.toFixed(2));
          return distance <= radiusKm;
        });

        // Sort by distance
        listings.sort((a, b) => a.dataValues.distance - b.dataValues.distance);
        
        console.log(`📍 After location filter: ${listings.length} listings within ${radiusKm}km`);
      }

      // Get total count for pagination
      const totalCount = await db.AgentGasListing.count({
        where: whereCondition,
        include: query ? [{
          model: db.GasBrand,
          as: 'brand', // CHANGED: 'gasBrand' -> 'brand'
          where: {
            name: { [db.Sequelize.Op.iLike]: `%${query}%` }
          }
        }] : []
      });

      // Format response
      const formattedListings = listings.map(listing => ({
        listing_id: listing.id,
        agent: {
          id: listing.listingAgent.id,
          name: listing.listingAgent.business_name || listing.listingAgent.email.split('@')[0], // Fallback to email prefix
          phone: listing.listingAgent.phone_number,
          location: listing.listingAgent.latitude && listing.listingAgent.longitude ? {
            latitude: listing.listingAgent.latitude,
            longitude: listing.listingAgent.longitude,
            address: listing.listingAgent.address,
            area_name: listing.listingAgent.area_name
          } : null,
          rating: listing.rating,
          total_orders: listing.total_orders
        },
        brand: {
          id: listing.brand.id, // CHANGED: listing.gasBrand -> listing.brand
          name: listing.brand.name,
          logo_url: listing.brand.logo_url
        },
        size: listing.size,
        price: parseFloat(listing.selling_price),
        original_price: listing.original_price ? parseFloat(listing.original_price) : null,
        available_quantity: listing.available_quantity,
        delivery_available: listing.delivery_available,
        delivery_fee: listing.delivery_fee ? parseFloat(listing.delivery_fee) : 0,
        cylinder_condition: listing.cylinder_condition,
        distance: listing.dataValues.distance || null,
        created_at: listing.created_at
      }));

      res.json({
        success: true,
        count: formattedListings.length,
        total: totalCount,
        page: parseInt(page),
        total_pages: Math.ceil(totalCount / limit),
        filters: {
          query: query || null,
          brand_id: brand_id || null,
          size: size || null,
          price_range: {
            min: min_price ? parseFloat(min_price) : null,
            max: max_price ? parseFloat(max_price) : null
          },
          location: {
            latitude: latitude || null,
            longitude: longitude || null,
            radius: radius
          }
        },
        listings: formattedListings
      });

    } catch (error) {
      console.error('❌ Error searching products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search products',
        error: error.message
      });
    }
  };

  // 9. Get product details by ID
  getProductDetails = async (req, res) => {
    try {
      const { listing_id } = req.params;

      console.log(`🔍 Getting details for listing: ${listing_id}`);

      const listing = await db.AgentGasListing.findByPk(listing_id, {
        include: [
          {
            model: db.GasBrand,
            as: 'brand', // CHANGED: 'gasBrand' -> 'brand'
            attributes: ['id', 'name', 'logo_url', 'description']
          },
          {
            model: db.User,
            as: 'listingAgent',
            attributes: ['id', 'email', 'phone_number', 'latitude', 'longitude', 'address', 'area_name', 'business_name']
          }
        ]
      });

      if (!listing) {
        return res.status(404).json({
          success: false,
          message: 'Product listing not found'
        });
      }

      // Get agent's other listings
      const otherListings = await db.AgentGasListing.findAll({
        where: {
          agent_id: listing.agent_id,
          id: { [db.Sequelize.Op.ne]: listing_id },
          is_available: true,
          available_quantity: { [db.Sequelize.Op.gt]: 0 }
        },
        include: [{
          model: db.GasBrand,
          as: 'brand', // CHANGED: 'gasBrand' -> 'brand'
          attributes: ['id', 'name', 'logo_url']
        }],
        limit: 5
      });

      const formattedOtherListings = otherListings.map(other => ({
        id: other.id,
        brand: other.brand.name, // CHANGED: other.gasBrand -> other.brand
        size: other.size,
        price: parseFloat(other.selling_price),
        delivery_available: other.delivery_available
      }));

      // Get agent rating and stats
      const totalListings = await db.AgentGasListing.count({
        where: { agent_id: listing.agent_id }
      });

      const totalSold = await db.AgentGasListing.sum('total_orders', {
        where: { agent_id: listing.agent_id }
      }) || 0;

      const response = {
        success: true,
        listing: {
          id: listing.id,
          brand: {
            id: listing.brand.id, // CHANGED: listing.gasBrand -> listing.brand
            name: listing.brand.name,
            logo_url: listing.brand.logo_url,
            description: listing.brand.description
          },
          agent: {
            id: listing.listingAgent.id,
            name: listing.listingAgent.business_name || listing.listingAgent.email.split('@')[0], // Fallback to email prefix
            phone: listing.listingAgent.phone_number,
            email: listing.listingAgent.email,
            location: listing.listingAgent.latitude && listing.listingAgent.longitude ? {
              latitude: listing.listingAgent.latitude,
              longitude: listing.listingAgent.longitude,
              address: listing.listingAgent.address,
              area_name: listing.listingAgent.area_name
            } : null,
            rating: listing.rating,
            stats: {
              total_listings: totalListings,
              total_sold: totalSold,
              avg_rating: listing.rating
            }
          },
          size: listing.size,
          price: parseFloat(listing.selling_price),
          original_price: listing.original_price ? parseFloat(listing.original_price) : null,
          available_quantity: listing.available_quantity,
          cylinder_condition: listing.cylinder_condition,
          description: listing.description,
          delivery_available: listing.delivery_available,
          delivery_fee: listing.delivery_fee ? parseFloat(listing.delivery_fee) : 0,
          delivery_hours: listing.delivery_hours,
          is_available: listing.is_available,
          total_orders: listing.total_orders,
          created_at: listing.created_at,
          updated_at: listing.updated_at
        },
        other_listings_from_agent: formattedOtherListings
      };

      console.log(`✅ Found listing: ${listing.brand.name} ${listing.size} by ${listing.listingAgent.business_name || listing.listingAgent.email}`);

      res.json(response);

    } catch (error) {
      console.error('❌ Error getting product details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get product details',
        error: error.message
      });
    }
  };

  // 10. NEW: Update agent location
  updateAgentLocation = async (req, res) => {
    try {
      if (req.user.user_type !== 'agent') {
        return res.status(403).json({
          success: false,
          message: 'Only agents can update location'
        });
      }

      const agentId = req.user.id;
      const { latitude, longitude, address, area_name, town, county } = req.body;

      console.log(`📍 Updating location for agent: ${agentId}`);
      console.log(`📌 Coordinates: ${latitude}, ${longitude}`);

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
      }

      const agent = await db.User.findByPk(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      // Update agent location
      await agent.update({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address,
        area_name: area_name,
        town: town,
        county: county
      });

      console.log(`✅ Location updated for agent ${agentId}`);

      res.json({
        success: true,
        message: 'Location updated successfully',
        location: {
          latitude: agent.latitude,
          longitude: agent.longitude,
          address: agent.address,
          area_name: agent.area_name,
          town: agent.town,
          county: agent.county,
          updated_at: agent.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error updating agent location:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location',
        error: error.message
      });
    }
  };

  // 11. NEW: Update customer location
  updateCustomerLocation = async (req, res) => {
    try {
      if (req.user.user_type !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only customers can update location'
        });
      }

      const customerId = req.user.id;
      const { latitude, longitude, address, area_name, town, county } = req.body;

      console.log(`📍 Updating location for customer: ${customerId}`);

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
      }

      const customer = await db.User.findByPk(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      // Update customer location
      await customer.update({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address,
        area_name: area_name,
        town: town,
        county: county
      });

      console.log(`✅ Location updated for customer ${customerId}`);

      res.json({
        success: true,
        message: 'Location updated successfully',
        location: {
          latitude: customer.latitude,
          longitude: customer.longitude,
          address: customer.address,
          area_name: customer.area_name,
          town: customer.town,
          county: customer.county,
          updated_at: customer.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error updating customer location:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location',
        error: error.message
      });
    }
  };

  // 12. NEW: Get nearby agents by location
  getNearbyAgentsByLocation = async (req, res) => {
    try {
      const { 
        latitude, 
        longitude, 
        radius = 10,
        brand_id,
        size,
        min_price,
        max_price
      } = req.query;

      console.log(`📍 Finding nearby agents for location: ${latitude}, ${longitude}`);
      console.log(`📏 Radius: ${radius}km`);

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
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
      if (min_price) whereCondition.selling_price = { [db.Sequelize.Op.gte]: parseFloat(min_price) };
      if (max_price) whereCondition.selling_price = { 
        ...whereCondition.selling_price,
        [db.Sequelize.Op.lte]: parseFloat(max_price)
      };

      // Get all listings
      let listings = await db.AgentGasListing.findAll({
        where: whereCondition,
        include: [
          {
            model: db.User,
            as: 'listingAgent',
            where: {
              latitude: { [db.Sequelize.Op.ne]: null },
              longitude: { [db.Sequelize.Op.ne]: null },
              user_type: 'agent',
              is_active: true
            },
            attributes: ['id', 'email', 'phone_number', 'latitude', 'longitude', 'address', 'area_name', 'business_name']
          },
          {
            model: db.GasBrand,
            as: 'brand', // CHANGED: 'gasBrand' -> 'brand'
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
          name: listing.listingAgent.business_name || listing.listingAgent.email.split('@')[0],
          phone: listing.listingAgent.phone_number,
          email: listing.listingAgent.email,
          location: {
            latitude: listing.listingAgent.latitude,
            longitude: listing.listingAgent.longitude,
            address: listing.listingAgent.address,
            area_name: listing.listingAgent.area_name,
            distance: listing.dataValues.distance
          }
        },
        product: {
          brand: listing.brand.name, // CHANGED: listing.gasBrand -> listing.brand
          brand_id: listing.brand.id,
          brand_logo: listing.brand.logo_url,
          size: listing.size,
          price: parseFloat(listing.selling_price),
          cylinder_condition: listing.cylinder_condition
        },
        availability: {
          quantity: listing.available_quantity,
          delivery_available: listing.delivery_available,
          delivery_fee: listing.delivery_fee ? parseFloat(listing.delivery_fee) : 0,
          delivery_hours: listing.delivery_hours
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
      console.error('❌ Error finding nearby agents:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to find nearby agents',
        error: error.message
      });
    }
  };
}

module.exports = new ProductController();