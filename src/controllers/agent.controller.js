// src/controllers/agent.controller.js
const db = require('../models');
const { Op } = require('sequelize');

class AgentController {
  // ========== DASHBOARD ROUTES ==========
  
  // Get dashboard statistics
  getDashboardStats = async (req, res) => {
    try {
      const agentId = req.user.id;

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get counts
      const totalOrders = await db.Order.count({
        where: { agent_id: agentId }
      });

      const pendingOrders = await db.Order.count({
        where: {
          agent_id: agentId,
          status: 'pending'
        }
      });

      const completedOrders = await db.Order.count({
        where: {
          agent_id: agentId,
          status: 'delivered'
        }
      });

      const todaysOrders = await db.Order.count({
        where: {
          agent_id: agentId,
          created_at: {
            [Op.between]: [today, tomorrow]
          }
        }
      });

      // Get total earnings from delivered orders
      const earnings = await db.Order.sum('grand_total', {
        where: {
          agent_id: agentId,
          status: 'delivered',
          payment_status: 'paid'
        }
      });

      // Get recent orders for preview
      const recentOrders = await db.Order.findAll({
        where: { agent_id: agentId },
        include: [
          {
            model: db.User,
            as: 'customer',
            attributes: ['full_name']
          },
          {
            model: db.AgentGasListing,
            as: 'listing',
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['name']
            }]
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 5
      });

      res.json({
        success: true,
        stats: {
          totalOrders,
          pendingOrders,
          completedOrders,
          todaysOrders,
          totalEarnings: earnings || 0
        },
        recentOrders: recentOrders.map(order => ({
          id: order.id,
          order_number: order.order_number,
          customer_name: order.customer?.full_name || 'Customer',
          product: `${order.listing?.brand?.name || 'Gas'} ${order.listing?.size || ''}`,
          amount: order.grand_total,
          status: order.status,
          created_at: order.created_at
        }))
      });
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard stats'
      });
    }
  };

  // Get earnings stats (for dashboard)
  getEarningsStats = async (req, res) => {
    try {
      const agentId = req.user.id;

      // Get current month range
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get previous month range
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Calculate this month's earnings
      const thisMonthEarnings = await db.Order.sum('grand_total', {
        where: {
          agent_id: agentId,
          status: 'delivered',
          payment_status: 'paid',
          created_at: {
            [Op.between]: [monthStart, monthEnd]
          }
        }
      });

      // Calculate last month's earnings
      const lastMonthEarnings = await db.Order.sum('grand_total', {
        where: {
          agent_id: agentId,
          status: 'delivered',
          payment_status: 'paid',
          created_at: {
            [Op.between]: [lastMonthStart, lastMonthEnd]
          }
        }
      });

      // Get pending earnings
      const pendingEarnings = await db.Order.sum('grand_total', {
        where: {
          agent_id: agentId,
          status: {
            [Op.in]: ['confirmed', 'processing', 'dispatched']
          },
          payment_status: 'paid'
        }
      });

      res.json({
        success: true,
        data: {
          thisMonth: thisMonthEarnings || 0,
          lastMonth: lastMonthEarnings || 0,
          pending: pendingEarnings || 0,
          growth: lastMonthEarnings ? 
            (((thisMonthEarnings || 0) - lastMonthEarnings) / lastMonthEarnings * 100).toFixed(1) : 0
        }
      });
    } catch (error) {
      console.error('Error getting earnings stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get earnings stats'
      });
    }
  };

  // Get recent orders (for dashboard)
  getRecentOrders = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { limit = 10 } = req.query;

      const orders = await db.Order.findAll({
        where: { agent_id: agentId },
        include: [
          {
            model: db.User,
            as: 'customer',
            attributes: ['full_name', 'phone_number']
          },
          {
            model: db.AgentGasListing,
            as: 'listing',
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['name']
            }]
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        orders: orders.map(order => ({
          id: order.id,
          order_number: order.order_number,
          customer: order.customer?.full_name || 'Customer',
          customer_phone: order.customer?.phone_number,
          product: `${order.listing?.brand?.name || 'Gas'} ${order.listing?.size || ''}`,
          quantity: order.quantity,
          amount: order.grand_total,
          status: order.status,
          payment_method: order.payment_method,
          created_at: order.created_at
        }))
      });
    } catch (error) {
      console.error('Error getting recent orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get recent orders'
      });
    }
  };

  // Get order stats
  getOrderStats = async (req, res) => {
    try {
      const agentId = req.user.id;

      const stats = await db.Order.findAll({
        where: { agent_id: agentId },
        attributes: [
          'status',
          [db.Sequelize.fn('COUNT', db.Sequelize.col('status')), 'count']
        ],
        group: ['status']
      });

      const statusMap = {
        pending: 0,
        confirmed: 0,
        processing: 0,
        dispatched: 0,
        delivered: 0,
        cancelled: 0,
        rejected: 0
      };

      stats.forEach(stat => {
        statusMap[stat.status] = parseInt(stat.dataValues.count);
      });

      res.json({
        success: true,
        stats: statusMap,
        total: Object.values(statusMap).reduce((a, b) => a + b, 0)
      });
    } catch (error) {
      console.error('Error getting order stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get order stats'
      });
    }
  };

  // ========== ORDERS MANAGEMENT ==========

  // Get all agent orders (with filters)
  getAgentOrders = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { status, page = 1, limit = 20, startDate, endDate } = req.query;

      const where = { agent_id: agentId };
      
      if (status) where.status = status;
      
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at[Op.gte] = new Date(startDate);
        if (endDate) where.created_at[Op.lte] = new Date(endDate);
      }

      const offset = (page - 1) * limit;

      const { count, rows: orders } = await db.Order.findAndCountAll({
        where,
        include: [
          {
            model: db.User,
            as: 'customer',
            attributes: ['id', 'full_name', 'phone_number']
          },
          {
            model: db.AgentGasListing,
            as: 'listing',
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['name', 'logo_url']
            }]
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        orders: orders.map(order => ({
          id: order.id,
          order_number: order.order_number,
          customer: {
            id: order.customer?.id,
            name: order.customer?.full_name || 'Customer',
            phone: order.customer?.phone_number
          },
          product: {
            brand: order.listing?.brand?.name,
            size: order.listing?.size,
            brand_logo: order.listing?.brand?.logo_url
          },
          quantity: order.quantity,
          unit_price: order.unit_price,
          total_price: order.total_price,
          delivery_fee: order.delivery_fee,
          grand_total: order.grand_total,
          delivery_address: order.delivery_address,
          status: order.status,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          created_at: order.created_at,
          estimated_delivery: order.estimated_delivery_time
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Error getting agent orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get orders'
      });
    }
  };

  // Get single order details
  getOrderDetails = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { orderId } = req.params;

      const order = await db.Order.findOne({
        where: {
          id: orderId,
          agent_id: agentId
        },
        include: [
          {
            model: db.User,
            as: 'customer',
            attributes: ['id', 'full_name', 'phone_number', 'email']
          },
          {
            model: db.AgentGasListing,
            as: 'listing',
            include: [
              {
                model: db.GasBrand,
                as: 'brand',
                attributes: ['name', 'logo_url']
              },
              {
                model: db.User,
                as: 'listingAgent',
                attributes: ['business_name', 'phone_number']
              }
            ]
          },
          {
            model: db.Payment,
            as: 'payments',
            separate: true,
            order: [['created_at', 'DESC']],
            limit: 1
          }
        ]
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.json({
        success: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          customer: {
            id: order.customer?.id,
            name: order.customer?.full_name,
            phone: order.customer?.phone_number,
            email: order.customer?.email
          },
          product: {
            brand: order.listing?.brand?.name,
            size: order.listing?.size,
            condition: order.listing?.cylinder_condition,
            brand_logo: order.listing?.brand?.logo_url
          },
          quantity: order.quantity,
          unit_price: parseFloat(order.unit_price),
          delivery_fee: parseFloat(order.delivery_fee),
          total_price: parseFloat(order.total_price),
          grand_total: parseFloat(order.grand_total),
          delivery_address: order.delivery_address,
          delivery_coordinates: {
            lat: order.delivery_latitude,
            lng: order.delivery_longitude
          },
          customer_notes: order.customer_notes,
          agent_notes: order.agent_notes,
          status: order.status,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          payment: order.payments?.[0] ? {
            id: order.payments[0].id,
            amount: order.payments[0].amount,
            method: order.payments[0].payment_method,
            reference: order.payments[0].transaction_reference,
            status: order.payments[0].status
          } : null,
          created_at: order.created_at,
          updated_at: order.updated_at,
          estimated_delivery: order.estimated_delivery_time,
          actual_delivery: order.actual_delivery_time
        }
      });
    } catch (error) {
      console.error('Error getting order details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get order details'
      });
    }
  };

  // Update order status
  updateOrderStatus = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { orderId } = req.params;
      const { status, notes } = req.body;

      const order = await db.Order.findOne({
        where: {
          id: orderId,
          agent_id: agentId
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Valid status transitions
      const validTransitions = {
        pending: ['confirmed', 'rejected', 'cancelled'],
        confirmed: ['processing', 'cancelled'],
        processing: ['dispatched', 'cancelled'],
        dispatched: ['delivered'],
        delivered: [],
        cancelled: [],
        rejected: []
      };

      if (!validTransitions[order.status]?.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from ${order.status} to ${status}`
        });
      }

      const updateData = { status };
      if (notes) updateData.agent_notes = notes;
      
      if (status === 'delivered') {
        updateData.actual_delivery_time = new Date();
      }

      await order.update(updateData);

      // If order is delivered, update wallet balance if exists
      if (status === 'delivered') {
        try {
          const [wallet] = await db.Wallet.findOrCreate({
            where: { user_id: agentId },
            defaults: { balance: 0, user_id: agentId }
          });
          
          await wallet.increment('balance', { by: parseFloat(order.grand_total) });
          
          await db.WalletTransaction.create({
            wallet_id: wallet.id,
            user_id: agentId,
            amount: order.grand_total,
            type: 'credit',
            reference: `ORDER_${order.order_number}`,
            description: `Payment for order #${order.order_number}`,
            status: 'completed'
          });
        } catch (walletError) {
          console.log('Wallet update failed:', walletError.message);
        }
      }

      res.json({
        success: true,
        message: `Order status updated to ${status}`,
        order: {
          id: order.id,
          status: order.status,
          updated_at: order.updated_at
        }
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update order status'
      });
    }
  };

  // Update delivery status
  updateDeliveryStatus = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { orderId } = req.params;
      const { estimated_time, notes } = req.body;

      const order = await db.Order.findOne({
        where: {
          id: orderId,
          agent_id: agentId
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      await order.update({
        estimated_delivery_time: estimated_time || order.estimated_delivery_time,
        agent_notes: notes || order.agent_notes
      });

      res.json({
        success: true,
        message: 'Delivery status updated',
        order: {
          id: order.id,
          estimated_delivery: order.estimated_delivery_time,
          notes: order.agent_notes
        }
      });
    } catch (error) {
      console.error('Error updating delivery status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update delivery status'
      });
    }
  };

  // Cancel order
  cancelOrder = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { orderId } = req.params;
      const { reason } = req.body;

      const order = await db.Order.findOne({
        where: {
          id: orderId,
          agent_id: agentId,
          status: {
            [Op.in]: ['pending', 'confirmed']
          }
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found or cannot be cancelled'
        });
      }

      // Restore stock if order was confirmed
      if (order.status === 'confirmed') {
        await db.AgentGasListing.increment('available_quantity', {
          by: order.quantity,
          where: { id: order.listing_id }
        });
      }

      await order.update({
        status: 'cancelled',
        agent_notes: reason || 'Cancelled by agent'
      });

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        order: {
          id: order.id,
          status: order.status
        }
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel order'
      });
    }
  };

  // ========== PRODUCTS MANAGEMENT ==========

  // Get all agent products
  getAgentProducts = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { status, page = 1, limit = 20 } = req.query;

      const where = { agent_id: agentId };
      if (status === 'active') where.is_available = true;
      if (status === 'inactive') where.is_available = false;

      const offset = (page - 1) * limit;

      const { count, rows: products } = await db.AgentGasListing.findAndCountAll({
        where,
        include: [{
          model: db.GasBrand,
          as: 'brand',
          attributes: ['id', 'name', 'logo_url']
        }],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        products: products.map(product => ({
          id: product.id,
          brand: {
            id: product.brand?.id,
            name: product.brand?.name,
            logo: product.brand?.logo_url
          },
          size: product.size,
          selling_price: parseFloat(product.selling_price),
          original_price: parseFloat(product.original_price),
          available_quantity: product.available_quantity,
          delivery_available: product.delivery_available,
          delivery_fee: parseFloat(product.delivery_fee),
          cylinder_condition: product.cylinder_condition,
          description: product.description,
          is_available: product.is_available,
          is_approved: product.is_approved,
          total_orders: product.total_orders,
          rating: product.rating,
          created_at: product.created_at
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Error getting agent products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get products'
      });
    }
  };

  // Get single product details
  getProductDetails = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { productId } = req.params;

      const product = await db.AgentGasListing.findOne({
        where: {
          id: productId,
          agent_id: agentId
        },
        include: [{
          model: db.GasBrand,
          as: 'brand',
          attributes: ['id', 'name', 'logo_url']
        }]
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        product: {
          id: product.id,
          brand: {
            id: product.brand?.id,
            name: product.brand?.name,
            logo: product.brand?.logo_url
          },
          size: product.size,
          selling_price: parseFloat(product.selling_price),
          original_price: parseFloat(product.original_price),
          available_quantity: product.available_quantity,
          delivery_available: product.delivery_available,
          delivery_fee: parseFloat(product.delivery_fee),
          cylinder_condition: product.cylinder_condition,
          description: product.description,
          is_available: product.is_available,
          is_approved: product.is_approved,
          total_orders: product.total_orders,
          rating: product.rating,
          created_at: product.created_at,
          updated_at: product.updated_at
        }
      });
    } catch (error) {
      console.error('Error getting product details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get product details'
      });
    }
  };

  // Add new product
  addProduct = async (req, res) => {
    try {
      const agentId = req.user.id;
      const {
        gas_brand_id,
        size,
        selling_price,
        original_price,
        available_quantity,
        delivery_available,
        delivery_fee,
        cylinder_condition,
        description
      } = req.body;

      // Validate required fields
      if (!gas_brand_id || !size || !selling_price || !available_quantity) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      const product = await db.AgentGasListing.create({
        agent_id: agentId,
        gas_brand_id,
        size,
        selling_price,
        original_price: original_price || selling_price,
        available_quantity,
        delivery_available: delivery_available || false,
        delivery_fee: delivery_fee || 0,
        cylinder_condition: cylinder_condition || 'new',
        description,
        is_available: true,
        is_approved: false // Requires admin approval
      });

      res.status(201).json({
        success: true,
        message: 'Product added successfully. Pending approval.',
        product: {
          id: product.id,
          ...product.toJSON()
        }
      });
    } catch (error) {
      console.error('Error adding product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add product'
      });
    }
  };

  // Update product
  updateProduct = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { productId } = req.params;
      const updates = req.body;

      const product = await db.AgentGasListing.findOne({
        where: {
          id: productId,
          agent_id: agentId
        }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Don't allow updating certain fields
      delete updates.id;
      delete updates.agent_id;
      delete updates.total_orders;
      delete updates.rating;

      await product.update(updates);

      res.json({
        success: true,
        message: 'Product updated successfully',
        product
      });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update product'
      });
    }
  };

  // Delete product
  deleteProduct = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { productId } = req.params;

      const product = await db.AgentGasListing.findOne({
        where: {
          id: productId,
          agent_id: agentId
        }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Soft delete - just mark as unavailable
      await product.update({ is_available: false });

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete product'
      });
    }
  };

  // Update stock
  updateStock = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { productId } = req.params;
      const { quantity, operation = 'set' } = req.body;

      const product = await db.AgentGasListing.findOne({
        where: {
          id: productId,
          agent_id: agentId
        }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      let newQuantity;
      if (operation === 'add') {
        newQuantity = product.available_quantity + quantity;
      } else if (operation === 'subtract') {
        newQuantity = Math.max(0, product.available_quantity - quantity);
      } else {
        newQuantity = quantity;
      }

      await product.update({ available_quantity: newQuantity });

      res.json({
        success: true,
        message: 'Stock updated successfully',
        available_quantity: newQuantity
      });
    } catch (error) {
      console.error('Error updating stock:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update stock'
      });
    }
  };

  // ========== EARNINGS & ANALYTICS ==========
  // These will use the EarningsController methods
  // But keeping placeholders here for completeness

  getAgentEarnings = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { period = 'month' } = req.query;

      // Simple implementation - can be expanded
      const where = {
        agent_id: agentId,
        status: 'delivered',
        payment_status: 'paid'
      };

      const totalEarnings = await db.Order.sum('grand_total', { where }) || 0;
      
      const pendingWhere = {
        agent_id: agentId,
        status: { [Op.in]: ['confirmed', 'processing', 'dispatched'] },
        payment_status: 'paid'
      };
      const pendingEarnings = await db.Order.sum('grand_total', { where: pendingWhere }) || 0;

      res.json({
        success: true,
        data: {
          totalEarnings,
          availableBalance: totalEarnings,
          pendingWithdrawal: pendingEarnings,
          thisMonth: totalEarnings * 0.3, // Placeholder - implement properly
          lastMonth: totalEarnings * 0.2, // Placeholder - implement properly
          transactions: []
        }
      });
    } catch (error) {
      console.error('Error getting earnings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get earnings'
      });
    }
  };

  getEarningsAnalytics = async (req, res) => {
    res.json({ success: true, message: 'Earnings analytics placeholder' });
  };

  getDailyEarnings = async (req, res) => {
    res.json({ success: true, message: 'Daily earnings placeholder' });
  };

  getMonthlyEarnings = async (req, res) => {
    res.json({ success: true, message: 'Monthly earnings placeholder' });
  };

  // ========== PROFILE & SETTINGS ==========

  // Get agent profile
  getAgentProfile = async (req, res) => {
    try {
      const agentId = req.user.id;
      
      const agent = await db.User.findByPk(agentId, {
        attributes: {
          exclude: ['password_hash']
        }
      });

      // Get gas brands
      const gasBrands = await db.UserGasBrand.findAll({
        where: { user_id: agentId },
        include: [{
          model: db.GasBrand,
          as: 'brand',
          attributes: ['id', 'name', 'logo_url']
        }]
      });

      res.json({
        success: true,
        agent: {
          ...agent.toJSON(),
          gas_brands: gasBrands.map(gb => gb.brand)
        }
      });
    } catch (error) {
      console.error('Error getting agent profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get agent profile'
      });
    }
  };

  // Update agent profile
  updateAgentProfile = async (req, res) => {
    try {
      const agentId = req.user.id;
      const updates = req.body;

      const agent = await db.User.findByPk(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      // Don't allow updating sensitive fields
      delete updates.id;
      delete updates.password_hash;
      delete updates.user_type;
      delete updates.is_verified;

      await agent.update(updates);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        agent
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  };

  // Update location
  updateLocation = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { latitude, longitude, address, area_name, county, town } = req.body;

      const agent = await db.User.findByPk(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      const updateData = {};
      if (latitude !== undefined) updateData.latitude = latitude;
      if (longitude !== undefined) updateData.longitude = longitude;
      if (address !== undefined) updateData.address = address;
      if (area_name !== undefined) updateData.area_name = area_name;
      if (county !== undefined) updateData.county = county;
      if (town !== undefined) updateData.town = town;

      await agent.update(updateData);

      res.json({
        success: true,
        message: 'Location updated successfully',
        location: {
          latitude: agent.latitude,
          longitude: agent.longitude,
          address: agent.address,
          area_name: agent.area_name,
          county: agent.county,
          town: agent.town
        }
      });
    } catch (error) {
      console.error('Error updating location:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location'
      });
    }
  };

  // Update contact info
  updateContactInfo = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { phone_number, email, business_name } = req.body;

      const agent = await db.User.findByPk(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      await agent.update({
        phone_number: phone_number || agent.phone_number,
        email: email || agent.email,
        business_name: business_name || agent.business_name
      });

      res.json({
        success: true,
        message: 'Contact information updated successfully',
        contact: {
          phone_number: agent.phone_number,
          email: agent.email,
          business_name: agent.business_name
        }
      });
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update contact information'
      });
    }
  };

  // Submit verification
  submitVerification = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { id_number, kra_pin, business_registration } = req.body;

      const agent = await db.User.findByPk(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      await agent.update({
        id_number: id_number || agent.id_number,
        kra_pin: kra_pin || agent.kra_pin,
        business_registration_number: business_registration || agent.business_registration_number,
        verification_status: 'pending'
      });

      res.json({
        success: true,
        message: 'Verification submitted successfully. Pending review.'
      });
    } catch (error) {
      console.error('Error submitting verification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit verification'
      });
    }
  };

  // ========== NOTIFICATIONS ==========

  // Get notifications
  getNotifications = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { unreadOnly, page = 1, limit = 20 } = req.query;

      // This would need a Notification model
      // For now, return mock data
      res.json({
        success: true,
        notifications: [
          {
            id: 1,
            type: 'order',
            title: 'New Order Received',
            message: 'You have a new order #ORD12345',
            read: false,
            created_at: new Date()
          },
          {
            id: 2,
            type: 'system',
            title: 'Profile Update',
            message: 'Your profile has been verified',
            read: true,
            created_at: new Date(Date.now() - 86400000)
          }
        ],
        unread_count: 1,
        pagination: {
          total: 2,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications'
      });
    }
  };

  // Mark notification as read
  markNotificationRead = async (req, res) => {
    try {
      const { notificationId } = req.params;

      // Would update notification in database
      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Error marking notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  };

  // ========== SUPPORT TICKETS ==========

  // Get support tickets
  getSupportTickets = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { status, page = 1, limit = 20 } = req.query;

      // This would need a SupportTicket model
      res.json({
        success: true,
        tickets: [
          {
            id: 1,
            subject: 'Payment Issue',
            status: 'open',
            priority: 'high',
            last_message: 'We are looking into your issue',
            created_at: new Date(),
            updated_at: new Date()
          }
        ],
        pagination: {
          total: 1,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error getting support tickets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get support tickets'
      });
    }
  };

  // Create support ticket
  createSupportTicket = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { subject, message, priority = 'medium' } = req.body;

      if (!subject || !message) {
        return res.status(400).json({
          success: false,
          message: 'Subject and message are required'
        });
      }

      // Would create ticket in database
      res.status(201).json({
        success: true,
        message: 'Support ticket created successfully',
        ticket: {
          id: Date.now(),
          subject,
          message,
          priority,
          status: 'open',
          created_at: new Date()
        }
      });
    } catch (error) {
      console.error('Error creating support ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create support ticket'
      });
    }
  };
}

module.exports = new AgentController();