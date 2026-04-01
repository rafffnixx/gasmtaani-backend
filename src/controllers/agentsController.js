const db = require('../models');
const { Op } = require('sequelize');

// Get nearby agents - location REQUIRED for customers
exports.getNearbyAgents = async (req, res) => {
  try {
    const { lat, lng, radius = 5, brand_id, size } = req.query; // Default 5km for customers
    
    // Check user type from JWT token
    const userType = req.user?.user_type;
    const isCustomer = !userType || userType === 'customer';
    
    console.log(`🔍 ${isCustomer ? 'Customer' : 'Admin/Agent'} searching for agents`);
    
    // For customers: REQUIRE location
    if (isCustomer) {
      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'Location is required to find nearby agents. Please provide latitude and longitude.',
          requires_location: true,
          user_type: 'customer'
        });
      }
    }
    
    // For admins/agents: location is optional (fallback to all agents)
    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;
    const searchRadius = parseFloat(radius);
    
    console.log(`📍 User location: ${userLat}, ${userLng}, radius: ${searchRadius}km`);
    
    // Build include conditions
    const includeConditions = [
      {
        model: db.AgentGasListing,
        as: 'agentGasListings',
        where: { 
          is_available: true,
          is_approved: true 
        },
        required: true,
        include: [{
          model: db.GasBrand,
          as: 'brand',
          attributes: ['id', 'name', 'logo_url']
        }]
      }
    ];

    // Add brand filter if specified
    if (brand_id) {
      includeConditions.push({
        model: db.GasBrand,
        as: 'gasBrands',
        where: { id: brand_id },
        through: { attributes: [] },
        attributes: ['id', 'name'],
        required: true
      });
    }

    // Get all approved agents with active listings
    const agents = await db.User.findAll({
      where: {
        user_type: 'agent',
        is_verified: true,
        is_active: true,
        latitude: { [Op.not]: null },
        longitude: { [Op.not]: null }
      },
      include: includeConditions,
      attributes: [
        'id', 'business_name', 'full_name', 'phone_number', 
        'email', 'area_name', 'address', 'county', 'town',
        'latitude', 'longitude', 'profile_image'
      ]
    });

    console.log(`📊 Found ${agents.length} total agents`);

    // If no location provided (admin/agent mode or customer without location), return all agents with note
    if (!userLat || !userLng) {
      const results = agents.map(agent => ({
        agent: {
          id: agent.id,
          business_name: agent.business_name || agent.full_name,
          full_name: agent.full_name,
          phone_number: agent.phone_number,
          email: agent.email,
          area_name: agent.area_name,
          address: agent.address,
          county: agent.county,
          town: agent.town,
          latitude: agent.latitude,
          longitude: agent.longitude,
          profile_image: agent.profile_image,
          distance: null
        },
        listings: agent.agentGasListings.map(listing => ({
          id: listing.id,
          brand: listing.brand?.name,
          brand_id: listing.brand?.id,
          brand_logo: listing.brand?.logo_url,
          size: listing.size,
          price: listing.selling_price,
          original_price: listing.original_price,
          available_quantity: listing.available_quantity,
          delivery_available: listing.delivery_available,
          delivery_fee: listing.delivery_fee,
          cylinder_condition: listing.cylinder_condition,
          description: listing.description,
          rating: listing.rating || 0,
          total_orders: listing.total_orders || 0
        }))
      }));
      
      return res.json({
        success: true,
        count: results.length,
        search_radius: 'N/A (no location provided)',
        filters: { brand_id, size },
        results: results,
        note: isCustomer ? 
          'No location provided. Showing all available agents. For location-based results, please provide latitude and longitude.' :
          'Admin/Agent mode: Showing all agents. Add location for distance-based filtering.',
        user_type: userType || 'customer'
      });
    }

    // Calculate distances (Haversine formula) when location is provided
    const R = 6371; // Earth's radius in km
    const nearbyAgents = [];
    
    for (const agent of agents) {
      if (!agent.latitude || !agent.longitude) continue;
      
      const agentLat = parseFloat(agent.latitude);
      const agentLng = parseFloat(agent.longitude);
      
      // Validate coordinates
      if (isNaN(agentLat) || isNaN(agentLng)) {
        console.log(`⚠️ Agent ${agent.id} has invalid coordinates: ${agent.latitude}, ${agent.longitude}`);
        continue;
      }
      
      const dLat = (agentLat - userLat) * Math.PI / 180;
      const dLng = (agentLng - userLng) * Math.PI / 180;
      
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(userLat * Math.PI / 180) * Math.cos(agentLat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      console.log(`📍 Agent ${agent.id}: ${distance.toFixed(2)}km from user`);
      
      if (distance <= searchRadius) {
        // Filter listings by size if specified
        let filteredListings = agent.agentGasListings;
        if (size) {
          filteredListings = agent.agentGasListings.filter(
            listing => listing.size === size
          );
        }
        
        if (filteredListings.length > 0) {
          nearbyAgents.push({
            ...agent.toJSON(),
            distance: parseFloat(distance.toFixed(2))
          });
        }
      }
    }

    // Sort by distance
    nearbyAgents.sort((a, b) => a.distance - b.distance);

    // Format response
    const results = nearbyAgents.map(agent => ({
      agent: {
        id: agent.id,
        business_name: agent.business_name || agent.full_name,
        full_name: agent.full_name,
        phone_number: agent.phone_number,
        email: agent.email,
        area_name: agent.area_name,
        address: agent.address,
        county: agent.county,
        town: agent.town,
        latitude: agent.latitude,
        longitude: agent.longitude,
        distance: agent.distance,
        profile_image: agent.profile_image
      },
      listings: agent.agentGasListings.map(listing => ({
        id: listing.id,
        brand: listing.brand?.name,
        brand_id: listing.brand?.id,
        brand_logo: listing.brand?.logo_url,
        size: listing.size,
        price: listing.selling_price,
        original_price: listing.original_price,
        available_quantity: listing.available_quantity,
        delivery_available: listing.delivery_available,
        delivery_fee: listing.delivery_fee,
        cylinder_condition: listing.cylinder_condition,
        description: listing.description,
        rating: listing.rating || 0,
        total_orders: listing.total_orders || 0
      }))
    }));

    console.log(`✅ Found ${results.length} agents within ${searchRadius}km`);
    
    res.json({
      success: true,
      count: results.length,
      user_location: { lat: userLat, lng: userLng },
      search_radius: searchRadius,
      filters: { brand_id, size },
      results: results,
      user_type: userType || 'customer'
    });

  } catch (error) {
    console.error('❌ Error finding nearby agents:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding nearby agents',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get agents by brand - location REQUIRED for customers
exports.getAgentsByBrand = async (req, res) => {
  try {
    const { brandId } = req.params;
    const { lat, lng, radius = 5 } = req.query; // Default 5km
    
    // Check user type
    const userType = req.user?.user_type;
    const isCustomer = !userType || userType === 'customer';
    
    console.log(`🔍 ${isCustomer ? 'Customer' : 'Admin/Agent'} finding agents for brand ${brandId}`);

    const brand = await db.GasBrand.findByPk(brandId);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Gas brand not found'
      });
    }

    // For customers: If no location, show helpful message
    if (isCustomer && (!lat || !lng)) {
      return res.json({
        success: true,
        brand: {
          id: brand.id,
          name: brand.name,
          logo_url: brand.logo_url,
          description: brand.description
        },
        count: 0,
        results: [],
        message: `Location is required to find ${brand.name} agents near you. Please set your location first.`,
        requires_location: true,
        user_type: 'customer'
      });
    }

    // Build base query conditions
    const whereConditions = {
      user_type: 'agent',
      is_verified: true,
      is_active: true
    };

    // Only require location if lat/lng provided
    if (lat && lng) {
      whereConditions.latitude = { [Op.not]: null };
      whereConditions.longitude = { [Op.not]: null };
    }

    // If no location provided (admin/agent mode), get all agents for this brand
    if (!lat || !lng) {
      const agents = await db.User.findAll({
        where: whereConditions,
        include: [
          {
            model: db.AgentGasListing,
            as: 'agentGasListings',
            where: { 
              gas_brand_id: brandId,
              is_available: true,
              is_approved: true 
            },
            required: true,
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['id', 'name', 'logo_url']
            }]
          }
        ],
        attributes: [
          'id', 'business_name', 'full_name', 'phone_number', 
          'email', 'area_name', 'address', 'county', 'town',
          'latitude', 'longitude', 'profile_image'
        ]
      });

      const results = agents.map(agent => ({
        agent: {
          id: agent.id,
          business_name: agent.business_name || agent.full_name,
          full_name: agent.full_name,
          phone_number: agent.phone_number,
          email: agent.email,
          area_name: agent.area_name,
          address: agent.address,
          county: agent.county,
          town: agent.town,
          latitude: agent.latitude,
          longitude: agent.longitude,
          profile_image: agent.profile_image,
          distance: null
        },
        listings: agent.agentGasListings.map(listing => ({
          id: listing.id,
          brand: listing.brand?.name,
          brand_id: listing.brand?.id,
          brand_logo: listing.brand?.logo_url,
          size: listing.size,
          price: listing.selling_price,
          original_price: listing.original_price,
          available_quantity: listing.available_quantity,
          delivery_available: listing.delivery_available,
          delivery_fee: listing.delivery_fee,
          cylinder_condition: listing.cylinder_condition,
          description: listing.description,
          rating: listing.rating || 0,
          total_orders: listing.total_orders || 0
        }))
      }));

      return res.json({
        success: true,
        brand: {
          id: brand.id,
          name: brand.name,
          logo_url: brand.logo_url,
          description: brand.description
        },
        count: results.length,
        results: results,
        message: results.length === 0 
          ? `No agents found selling ${brand.name}.` 
          : `Found ${results.length} agents selling ${brand.name} (all locations)`,
        user_type: userType || 'admin/agent'
      });
    }

    // If location provided, calculate distances
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius);

    const agents = await db.User.findAll({
      where: whereConditions,
      include: [
        {
          model: db.AgentGasListing,
          as: 'agentGasListings',
          where: { 
            gas_brand_id: brandId,
            is_available: true,
            is_approved: true 
          },
          required: true,
          include: [{
            model: db.GasBrand,
            as: 'brand',
            attributes: ['id', 'name', 'logo_url']
          }]
        }
      ],
      attributes: [
        'id', 'business_name', 'full_name', 'phone_number', 
        'email', 'area_name', 'address', 'county', 'town',
        'latitude', 'longitude', 'profile_image'
      ]
    });

    console.log(`📊 Found ${agents.length} total agents with ${brand.name} listings`);

    // Calculate distances
    const R = 6371;
    const agentsWithDistance = [];
    
    for (const agent of agents) {
      if (!agent.latitude || !agent.longitude) {
        console.log(`⚠️ Agent ${agent.id} has no location data`);
        continue;
      }
      
      const agentLat = parseFloat(agent.latitude);
      const agentLng = parseFloat(agent.longitude);
      
      // Validate coordinates
      if (isNaN(agentLat) || isNaN(agentLng)) {
        console.log(`⚠️ Agent ${agent.id} has invalid coordinates: ${agent.latitude}, ${agent.longitude}`);
        continue;
      }
      
      const dLat = (agentLat - userLat) * Math.PI / 180;
      const dLng = (agentLng - userLng) * Math.PI / 180;
      
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(userLat * Math.PI / 180) * Math.cos(agentLat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      console.log(`📍 Agent ${agent.id} (${agent.business_name || agent.full_name}): ${distance.toFixed(2)}km`);
      
      if (distance <= searchRadius) {
        agentsWithDistance.push({
          ...agent.toJSON(),
          distance: parseFloat(distance.toFixed(2))
        });
      }
    }

    // Sort by distance
    agentsWithDistance.sort((a, b) => a.distance - b.distance);

    const results = agentsWithDistance.map(agent => ({
      agent: {
        id: agent.id,
        business_name: agent.business_name || agent.full_name,
        full_name: agent.full_name,
        phone_number: agent.phone_number,
        email: agent.email,
        area_name: agent.area_name,
        address: agent.address,
        county: agent.county,
        town: agent.town,
        latitude: agent.latitude,
        longitude: agent.longitude,
        distance: agent.distance,
        profile_image: agent.profile_image
      },
      listings: agent.agentGasListings.map(listing => ({
        id: listing.id,
        brand: listing.brand?.name,
        brand_id: listing.brand?.id,
        brand_logo: listing.brand?.logo_url,
        size: listing.size,
        price: listing.selling_price,
        original_price: listing.original_price,
        available_quantity: listing.available_quantity,
        delivery_available: listing.delivery_available,
        delivery_fee: listing.delivery_fee,
        cylinder_condition: listing.cylinder_condition,
        description: listing.description,
        rating: listing.rating || 0,
        total_orders: listing.total_orders || 0
      }))
    }));

    console.log(`✅ Found ${results.length} agents within ${searchRadius}km radius`);

    res.json({
      success: true,
      brand: {
        id: brand.id,
        name: brand.name,
        logo_url: brand.logo_url,
        description: brand.description
      },
      count: results.length,
      user_location: { lat: userLat, lng: userLng },
      search_radius: searchRadius,
      results: results,
      message: results.length === 0 
        ? `No agents found selling ${brand.name} within ${searchRadius}km. Try expanding your search radius.`
        : `Found ${results.length} agents selling ${brand.name} within ${searchRadius}km`,
      user_type: userType || 'customer'
    });

  } catch (error) {
    console.error('❌ Error getting agents by brand:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding agents for this brand',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get gas brands with counts of nearby agents - location REQUIRED for customers
// Get gas brands with counts of nearby agents - FIXED VERSION
// Get gas brands with counts of nearby agents - FIXED VERSION
exports.getGasBrandsWithAgentCounts = async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;
    
    // Check user type
    const userType = req.user?.user_type;
    const isCustomer = !userType || userType === 'customer';
    
    console.log(`📊 ${isCustomer ? 'Customer' : 'Admin/Agent'} getting gas brands with agent counts`);
    
    // For customers: If no location, show helpful message
    if (isCustomer && (!lat || !lng)) {
      return res.json({
        success: true,
        brands: [],
        stats: {
          total_brands: 0,
          brands_with_agents: 0,
          total_agents: 0
        },
        message: 'Location is required to find brands near you. Please set your location first.',
        requires_location: true,
        user_type: 'customer'
      });
    }
    
    // If no location provided (admin/agent mode), return brands with counts (from all agents)
    if (!lat || !lng) {
      return await getAllBrandsWithAgentCounts(res, userType || 'admin/agent');
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius);

    console.log(`📍 Searching brands within ${searchRadius}km of ${userLat}, ${userLng}`);

    // ✅ FIXED: Use proper parameterized query with ? placeholders
    const query = `
      SELECT 
        gb.id,
        gb.name,
        gb.logo_url,
        gb.description,
        gb.is_popular,
        COUNT(DISTINCT u.id) as agent_count,
        MIN(agl.selling_price) as min_price,
        MAX(agl.selling_price) as max_price,
        ARRAY_AGG(DISTINCT agl.size) as sizes
      FROM gas_brands gb
      INNER JOIN agent_gas_listings agl ON gb.id = agl.gas_brand_id
      INNER JOIN users u ON agl.agent_id = u.id
      WHERE u.user_type = 'agent'
        AND u.is_verified = true
        AND u.is_active = true
        AND agl.is_available = true
        AND agl.is_approved = true
        AND u.latitude IS NOT NULL
        AND u.longitude IS NOT NULL
        AND (6371 * acos(
          cos(radians(?)) * cos(radians(u.latitude)) * 
          cos(radians(u.longitude) - radians(?)) + 
          sin(radians(?)) * sin(radians(u.latitude))
        )) <= ?
      GROUP BY gb.id, gb.name, gb.logo_url, gb.description, gb.is_popular
      HAVING COUNT(DISTINCT u.id) > 0
      ORDER BY 
        gb.is_popular DESC,
        agent_count DESC,
        gb.name ASC
    `;

    const brands = await db.sequelize.query(query, {
      replacements: [userLat, userLng, userLat, searchRadius],
      type: db.sequelize.QueryTypes.SELECT
    });

    console.log(`🎯 Found ${brands.length} brands with agents within ${searchRadius}km`);

    // Format the response
    const formattedBrands = brands.map(brand => ({
      id: brand.id,
      name: brand.name,
      logo_url: brand.logo_url,
      description: brand.description,
      is_popular: brand.is_popular,
      agent_count: parseInt(brand.agent_count),
      min_price: brand.min_price ? parseFloat(brand.min_price) : null,
      max_price: brand.max_price ? parseFloat(brand.max_price) : null,
      price_range: brand.min_price && brand.max_price 
        ? (brand.min_price === brand.max_price 
          ? `KES ${parseFloat(brand.min_price).toLocaleString('en-KE')}` 
          : `KES ${parseFloat(brand.min_price).toLocaleString('en-KE')} - KES ${parseFloat(brand.max_price).toLocaleString('en-KE')}`)
        : null,
      sizes: brand.sizes ? brand.sizes.filter(s => s !== null) : [],
      has_nearby_agents: true
    }));

    // Calculate total agents
    const totalAgents = formattedBrands.reduce((sum, brand) => sum + brand.agent_count, 0);

    res.json({
      success: true,
      user_location: { lat: userLat, lng: userLng },
      search_radius: searchRadius,
      brands: formattedBrands,
      stats: {
        total_brands: formattedBrands.length,
        brands_with_agents: formattedBrands.length,
        total_agents: totalAgents
      },
      user_type: userType || 'customer'
    });

  } catch (error) {
    console.error('❌ Error getting gas brands with agent counts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching gas brands',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// Helper function to get all brands with agent counts (no location filter)
// Helper function to get all brands with agent counts (no location filter)
async function getAllBrandsWithAgentCounts(res, userType = 'admin/agent') {
  try {
    // Get all active gas brands with agent counts
    const query = `
      SELECT 
        gb.id,
        gb.name,
        gb.logo_url,
        gb.description,
        gb.is_popular,
        COUNT(DISTINCT agl.agent_id) as agent_count,
        MIN(agl.selling_price) as min_price,
        MAX(agl.selling_price) as max_price,
        ARRAY_AGG(DISTINCT agl.size) as sizes
      FROM gas_brands gb
      LEFT JOIN agent_gas_listings agl ON gb.id = agl.gas_brand_id
        AND agl.is_available = true 
        AND agl.is_approved = true
      WHERE gb.is_active = true
      GROUP BY gb.id, gb.name, gb.logo_url, gb.description, gb.is_popular
      ORDER BY agent_count DESC, gb.is_popular DESC, gb.name ASC
    `;

    const brands = await db.sequelize.query(query, {
      type: db.sequelize.QueryTypes.SELECT
    });

    const formattedBrands = brands.map(row => ({
      id: row.id,
      name: row.name,
      logo_url: row.logo_url,
      description: row.description,
      is_popular: row.is_popular,
      agent_count: parseInt(row.agent_count) || 0,
      min_price: row.min_price ? parseFloat(row.min_price) : null,
      max_price: row.max_price ? parseFloat(row.max_price) : null,
      price_range: row.min_price && row.max_price 
        ? (row.min_price === row.max_price 
          ? `KES ${parseFloat(row.min_price).toLocaleString('en-KE')}` 
          : `KES ${parseFloat(row.min_price).toLocaleString('en-KE')} - KES ${parseFloat(row.max_price).toLocaleString('en-KE')}`)
        : null,
      sizes: row.sizes ? row.sizes.filter(s => s !== null) : [],
      has_nearby_agents: parseInt(row.agent_count) > 0
    }));

    console.log(`📊 Found ${formattedBrands.length} brands with counts (no location filter)`);

    return res.json({
      success: true,
      brands: formattedBrands,
      stats: {
        total_brands: formattedBrands.length,
        brands_with_agents: formattedBrands.filter(b => b.agent_count > 0).length,
        total_agents: formattedBrands.reduce((sum, brand) => sum + brand.agent_count, 0)
      },
      user_type: userType,
      note: 'No location provided. Showing all brands with agent counts.'
    });
    
  } catch (error) {
    console.error('Error getting all brands:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching all brands',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Update user location (for customers)
exports.updateUserLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, address, area_name, county, town } = req.body;

    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update location fields
    const updateData = {};
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (address !== undefined) updateData.address = address;
    if (area_name !== undefined) updateData.area_name = area_name;
    if (county !== undefined) updateData.county = county;
    if (town !== undefined) updateData.town = town;

    await user.update(updateData);

    res.json({
      success: true,
      message: 'Location updated successfully',
      location: {
        latitude: user.latitude,
        longitude: user.longitude,
        address: user.address,
        area_name: user.area_name,
        county: user.county,
        town: user.town
      }
    });

  } catch (error) {
    console.error('❌ Error updating user location:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating location',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== ADD AGENT DASHBOARD FUNCTIONS ==========

// Agent Profile
exports.getAgentProfile = async (req, res) => {
  try {
    const agentId = req.user.id;
    
    const agent = await db.User.findByPk(agentId, {
      attributes: {
        exclude: ['password_hash']
      }
    });

    res.json({
      success: true,
      agent: agent
    });
  } catch (error) {
    console.error('Error getting agent profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get agent profile'
    });
  }
};

// Dashboard functions
exports.getDashboardStats = async (req, res) => {
  res.json({ success: true, message: 'Dashboard stats placeholder' });
};

exports.getEarningsStats = async (req, res) => {
  res.json({ success: true, message: 'Earnings stats placeholder' });
};

exports.getRecentOrders = async (req, res) => {
  res.json({ success: true, message: 'Recent orders placeholder' });
};

exports.getOrderStats = async (req, res) => {
  res.json({ success: true, message: 'Order stats placeholder' });
};

// Orders Management
exports.getAgentOrders = async (req, res) => {
  res.json({ success: true, message: 'Agent orders placeholder' });
};

exports.getOrderDetails = async (req, res) => {
  res.json({ success: true, message: 'Order details placeholder' });
};

exports.updateOrderStatus = async (req, res) => {
  res.json({ success: true, message: 'Update order status placeholder' });
};

exports.updateDeliveryStatus = async (req, res) => {
  res.json({ success: true, message: 'Update delivery status placeholder' });
};

exports.cancelOrder = async (req, res) => {
  res.json({ success: true, message: 'Cancel order placeholder' });
};

// Products Management
exports.getAgentProducts = async (req, res) => {
  res.json({ 
    success: true, 
    message: 'Get agent products - placeholder',
    products: [] 
  });
};

exports.getProductDetails = async (req, res) => {
  res.json({ success: true, message: 'Product details placeholder' });
};

exports.addProduct = async (req, res) => {
  res.json({ success: true, message: 'Add product placeholder' });
};

exports.updateProduct = async (req, res) => {
  res.json({ success: true, message: 'Update product placeholder' });
};

exports.deleteProduct = async (req, res) => {
  res.json({ success: true, message: 'Delete product placeholder' });
};

exports.updateStock = async (req, res) => {
  res.json({ success: true, message: 'Update stock placeholder' });
};

// Earnings & Analytics
exports.getAgentEarnings = async (req, res) => {
  res.json({ success: true, message: 'Agent earnings placeholder' });
};

exports.getEarningsAnalytics = async (req, res) => {
  res.json({ success: true, message: 'Earnings analytics placeholder' });
};

exports.getDailyEarnings = async (req, res) => {
  res.json({ success: true, message: 'Daily earnings placeholder' });
};

exports.getMonthlyEarnings = async (req, res) => {
  res.json({ success: true, message: 'Monthly earnings placeholder' });
};

// Profile & Settings
exports.updateAgentProfile = async (req, res) => {
  res.json({ success: true, message: 'Update agent profile placeholder' });
};

exports.updateContactInfo = async (req, res) => {
  res.json({ success: true, message: 'Update contact info placeholder' });
};

exports.submitVerification = async (req, res) => {
  res.json({ success: true, message: 'Submit verification placeholder' });
};

// Notifications & Support
exports.getNotifications = async (req, res) => {
  res.json({ success: true, message: 'Get notifications placeholder' });
};

exports.markNotificationRead = async (req, res) => {
  res.json({ success: true, message: 'Mark notification read placeholder' });
};

exports.getSupportTickets = async (req, res) => {
  res.json({ success: true, message: 'Get support tickets placeholder' });
};

exports.createSupportTicket = async (req, res) => {
  res.json({ success: true, message: 'Create support ticket placeholder' });
};

// Get all agents (admin only - no location required)
exports.getAllAgents = async (req, res) => {
  try {
    // Check if user is admin/agent
    const userType = req.user?.user_type;
    const isAdminOrAgent = userType === 'admin' || userType === 'agent';
    
    if (!isAdminOrAgent) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or agent privileges required.'
      });
    }
    
    const { brand_id } = req.query;
    
    // Build include conditions
    const includeConditions = [
      {
        model: db.AgentGasListing,
        as: 'agentGasListings',
        where: { 
          is_available: true,
          is_approved: true 
        },
        required: false, // Use false to get agents even without listings
        include: [{
          model: db.GasBrand,
          as: 'brand',
          attributes: ['id', 'name', 'logo_url']
        }]
      }
    ];
    
    // Add brand filter if specified
    if (brand_id) {
      includeConditions[0].where.gas_brand_id = brand_id;
      includeConditions[0].required = true;
    }
    
    // Get all agents (with or without location)
    const agents = await db.User.findAll({
      where: {
        user_type: 'agent',
        is_verified: true,
        is_active: true
      },
      include: includeConditions,
      attributes: [
        'id', 'business_name', 'full_name', 'phone_number', 
        'email', 'area_name', 'address', 'county', 'town',
        'latitude', 'longitude', 'profile_image', 'created_at'
      ],
      order: [['created_at', 'DESC']]
    });
    
    const results = agents.map(agent => ({
      agent: {
        id: agent.id,
        business_name: agent.business_name || agent.full_name,
        full_name: agent.full_name,
        phone_number: agent.phone_number,
        email: agent.email,
        area_name: agent.area_name,
        address: agent.address,
        county: agent.county,
        town: agent.town,
        latitude: agent.latitude,
        longitude: agent.longitude,
        profile_image: agent.profile_image,
        created_at: agent.created_at,
        has_location: !!(agent.latitude && agent.longitude)
      },
      listings: agent.agentGasListings?.map(listing => ({
        id: listing.id,
        brand: listing.brand?.name,
        brand_id: listing.brand?.id,
        brand_logo: listing.brand?.logo_url,
        size: listing.size,
        price: listing.selling_price,
        original_price: listing.original_price,
        available_quantity: listing.available_quantity,
        delivery_available: listing.delivery_available,
        delivery_fee: listing.delivery_fee,
        cylinder_condition: listing.cylinder_condition,
        description: listing.description,
        rating: listing.rating || 0,
        total_orders: listing.total_orders || 0
      })) || []
    }));
    
    console.log(`👑 Admin/Agent: Found ${results.length} agents`);
    
    res.json({
      success: true,
      count: results.length,
      results: results,
      user_type: userType,
      note: 'Admin/Agent mode: Showing all agents regardless of location.'
    });
    
  } catch (error) {
    console.error('❌ Error getting all agents:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting agents',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};