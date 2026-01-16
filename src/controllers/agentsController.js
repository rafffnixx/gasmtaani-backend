const db = require('../models');
const { Op } = require('sequelize');

exports.getNearbyAgents = async (req, res) => {
  try {
    const { lat, lng, radius = 10, brand_id, size } = req.query;
    
    console.log(`🔍 Finding agents near: ${lat}, ${lng}, radius: ${radius}km`);
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius);

    // Build include conditions
    const includeConditions = [
      {
        model: db.AgentGasListing,
        as: 'gasListings',
        where: { 
          is_available: true,
          is_approved: true 
        },
        required: true,
        include: [{
          model: db.GasBrand,
          as: 'gasBrand',
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

    // Calculate distances (Haversine formula)
    const R = 6371; // Earth's radius in km
    const nearbyAgents = [];
    
    for (const agent of agents) {
      if (!agent.latitude || !agent.longitude) continue;
      
      const agentLat = parseFloat(agent.latitude);
      const agentLng = parseFloat(agent.longitude);
      
      const dLat = (agentLat - userLat) * Math.PI / 180;
      const dLng = (agentLng - userLng) * Math.PI / 180;
      
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(userLat * Math.PI / 180) * Math.cos(agentLat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      if (distance <= searchRadius) {
        // Filter listings by size if specified
        let filteredListings = agent.gasListings;
        if (size) {
          filteredListings = agent.gasListings.filter(
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
      listings: agent.gasListings.map(listing => ({
        id: listing.id,
        brand: listing.gasBrand?.name,
        brand_id: listing.gasBrand?.id,
        brand_logo: listing.gasBrand?.logo_url,
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
      results: results
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

// Get agents by brand (for brand details page)
exports.getAgentsByBrand = async (req, res) => {
  try {
    const { brandId } = req.params;
    const { lat, lng, radius = 20 } = req.query;

    console.log(`🔍 Finding agents for brand ${brandId} near ${lat}, ${lng}`);

    const brand = await db.GasBrand.findByPk(brandId);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Gas brand not found'
      });
    }

    // If no location provided, get all agents for this brand
    if (!lat || !lng) {
      const agents = await db.User.findAll({
        where: {
          user_type: 'agent',
          is_verified: true,
          is_active: true
        },
        include: [
          {
            model: db.GasBrand,
            as: 'gasBrands',
            where: { id: brandId },
            through: { attributes: [] },
            attributes: [],
            required: true
          },
          {
            model: db.AgentGasListing,
            as: 'gasListings',
            where: { 
              gas_brand_id: brandId,
              is_available: true,
              is_approved: true 
            },
            required: true,
            include: [{
              model: db.GasBrand,
              as: 'gasBrand',
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
          distance: null // No distance calculated
        },
        listings: agent.gasListings.map(listing => ({
          id: listing.id,
          brand: listing.gasBrand?.name,
          brand_id: listing.gasBrand?.id,
          brand_logo: listing.gasBrand?.logo_url,
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
          ? `No agents found selling ${brand.name}. Try expanding your search radius.`
          : `Found ${results.length} agents selling ${brand.name}`
      });
    }

    // If location provided, calculate distances
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius);

    const agents = await db.User.findAll({
      where: {
        user_type: 'agent',
        is_verified: true,
        is_active: true,
        latitude: { [Op.not]: null },
        longitude: { [Op.not]: null }
      },
      include: [
        {
          model: db.GasBrand,
          as: 'gasBrands',
          where: { id: brandId },
          through: { attributes: [] },
          attributes: [],
          required: true
        },
        {
          model: db.AgentGasListing,
          as: 'gasListings',
          where: { 
            gas_brand_id: brandId,
            is_available: true,
            is_approved: true 
          },
          required: true,
          include: [{
            model: db.GasBrand,
            as: 'gasBrand',
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

    // Calculate distances
    const R = 6371;
    const agentsWithDistance = [];
    
    for (const agent of agents) {
      const agentLat = parseFloat(agent.latitude);
      const agentLng = parseFloat(agent.longitude);
      
      const dLat = (agentLat - userLat) * Math.PI / 180;
      const dLng = (agentLng - userLng) * Math.PI / 180;
      
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(userLat * Math.PI / 180) * Math.cos(agentLat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
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
      listings: agent.gasListings.map(listing => ({
        id: listing.id,
        brand: listing.gasBrand?.name,
        brand_id: listing.gasBrand?.id,
        brand_logo: listing.gasBrand?.logo_url,
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
        : `Found ${results.length} agents selling ${brand.name} within ${searchRadius}km`
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