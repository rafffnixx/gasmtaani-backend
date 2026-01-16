const db = require('../models');

class OrderController {
  // Helper: Generate unique order number
  generateOrderNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `ORD${year}${month}${day}${random}`;
  };

  // 1. Place a new order (Customer only)
  placeOrder = async (req, res) => {
    try {
      if (req.user.user_type !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only customers can place orders'
        });
      }

      const customerId = req.user.id;
      const {
        listing_id,
        quantity = 1,
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        delivery_notes = '',
        payment_method = 'cash'
      } = req.body;

      console.log(`🛒 Placing order for customer: ${customerId}`);
      console.log(`📦 Listing ID: ${listing_id}, Quantity: ${quantity}`);

      // Validate listing exists and is available
      const listing = await db.AgentGasListing.findByPk(listing_id, {
        include: [
          {
            model: db.GasBrand,
            as: 'brand',
            attributes: ['id', 'name', 'logo_url']
          },
          {
            model: db.User,
            as: 'listingAgent',
            attributes: ['id', 'full_name', 'business_name', 'phone_number']
          }
        ]
      });

      if (!listing) {
        return res.status(404).json({
          success: false,
          message: 'Product listing not found'
        });
      }

      if (!listing.is_available) {
        return res.status(400).json({
          success: false,
          message: 'This product is currently unavailable'
        });
      }

      if (listing.available_quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${listing.available_quantity} units available. Requested: ${quantity}`
        });
      }

      // Check if customer is trying to order from themselves
      if (listing.agent_id === customerId) {
        return res.status(400).json({
          success: false,
          message: 'You cannot order from yourself'
        });
      }

      // Calculate amounts
      const unitPrice = parseFloat(listing.selling_price);
      const deliveryFee = listing.delivery_available ? parseFloat(listing.delivery_fee) : 0;
      const totalPrice = unitPrice * quantity;
      const grandTotal = totalPrice + deliveryFee;

      console.log('💰 Price calculation:');
      console.log('  Unit price:', unitPrice);
      console.log('  Delivery fee:', deliveryFee);
      console.log('  Total price (product):', totalPrice);
      console.log('  Grand total (product + delivery):', grandTotal);

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      // Create order
      const order = await db.Order.create({
        order_number: orderNumber,
        customer_id: customerId,
        agent_id: listing.agent_id,
        listing_id: listing_id,
        quantity: quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        grand_total: grandTotal,
        delivery_fee: deliveryFee,
        delivery_address: delivery_address,
        delivery_latitude: delivery_latitude,
        delivery_longitude: delivery_longitude,
        customer_notes: delivery_notes,
        payment_method: payment_method === 'cash_on_delivery' ? 'cash' : payment_method,
        status: 'pending',
        payment_status: 'pending'
      });

      // Update listing quantity
      await listing.update({
        available_quantity: listing.available_quantity - quantity
      });

      // Update total orders on listing
      await listing.increment('total_orders');

      console.log(`✅ Order placed successfully! Order #: ${orderNumber}`);
      console.log(`💰 Total: KES ${grandTotal}`);

      // Get fresh data for response to ensure associations are loaded
      const freshOrder = await db.Order.findByPk(order.id, {
        include: [
          {
            model: db.AgentGasListing,
            as: 'listing',
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['id', 'name']
            }]
          },
          {
            model: db.User,
            as: 'customer',
            attributes: ['id', 'full_name', 'phone_number']
          },
          {
            model: db.User,
            as: 'agent',
            attributes: ['id', 'full_name', 'business_name', 'phone_number']
          }
        ]
      });

      // Get customer details
      const customer = await db.User.findByPk(customerId, {
        attributes: ['id', 'full_name', 'phone_number']
      });

      const response = {
        success: true,
        message: 'Order placed successfully',
        order: {
          id: freshOrder.id,
          order_number: freshOrder.order_number,
          customer: {
            id: customer?.id,
            name: customer?.full_name || 'Customer',
            phone: customer?.phone_number
          },
          agent: {
            id: freshOrder.agent?.id,
            name: freshOrder.agent?.business_name || freshOrder.agent?.full_name || 'Agent',
            phone: freshOrder.agent?.phone_number
          },
          product: {
            brand: freshOrder.listing?.brand?.name || 'Gas Brand',
            size: freshOrder.listing?.size,
            cylinder_condition: freshOrder.listing?.cylinder_condition
          },
          quantity: freshOrder.quantity,
          unit_price: parseFloat(freshOrder.unit_price),
          delivery_fee: parseFloat(freshOrder.delivery_fee),
          total_price: parseFloat(freshOrder.total_price),
          grand_total: parseFloat(freshOrder.grand_total),
          delivery_address: freshOrder.delivery_address,
          customer_notes: freshOrder.customer_notes,
          status: freshOrder.status,
          payment_method: freshOrder.payment_method,
          payment_status: freshOrder.payment_status,
          created_at: freshOrder.created_at
        }
      };

      // TODO: Send notification to agent
      console.log(`📱 Notification would be sent to agent: ${freshOrder.agent?.phone_number}`);

      res.status(201).json(response);

    } catch (error) {
      console.error('❌ Error placing order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to place order',
        error: error.message,
        details: error.errors ? error.errors.map(e => ({
          field: e.path,
          message: e.message,
          value: e.value
        })) : []
      });
    }
  };

  // 2. Get customer orders
  getCustomerOrders = async (req, res) => {
    try {
      const customerId = req.user.id;
      const { status, page = 1, limit = 20 } = req.query;

      console.log(`📋 Fetching orders for customer: ${customerId}`);
      console.log(`🔍 Status filter: ${status || 'All'}`);

      const offset = (page - 1) * limit;

      // Build where condition
      let whereCondition = { customer_id: customerId };
      if (status) whereCondition.status = status;

      const { count, rows: orders } = await db.Order.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: db.AgentGasListing,
            as: 'listing',
            attributes: ['id', 'size'],
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['id', 'name', 'logo_url']
            }]
          },
          {
            model: db.User,
            as: 'agent',
            attributes: ['id', 'business_name', 'full_name', 'phone_number', 'profile_image']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      const formattedOrders = orders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        product: {
          brand: order.listing?.brand?.name || 'Gas Brand',
          size: order.listing?.size,
          image: order.listing?.brand?.logo_url
        },
        agent: {
          id: order.agent?.id,
          name: order.agent?.business_name || order.agent?.full_name || 'Agent',
          phone: order.agent?.phone_number,
          profile_image: order.agent?.profile_image
        },
        quantity: order.quantity,
        unit_price: parseFloat(order.unit_price),
        total_price: parseFloat(order.total_price),
        grand_total: parseFloat(order.grand_total),
        delivery_fee: parseFloat(order.delivery_fee),
        delivery_address: order.delivery_address,
        status: order.status,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        created_at: order.created_at,
        estimated_delivery_time: order.estimated_delivery_time,
        actual_delivery_time: order.actual_delivery_time
      }));

      console.log(`✅ Found ${count} orders for customer ${customerId}`);

      res.json({
        success: true,
        count: formattedOrders.length,
        total: count,
        page: parseInt(page),
        total_pages: Math.ceil(count / limit),
        orders: formattedOrders
      });

    } catch (error) {
      console.error('❌ Error fetching customer orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders',
        error: error.message
      });
    }
  };

  // 3. Get agent orders (orders received by agent)
  getAgentOrders = async (req, res) => {
    try {
      if (req.user.user_type !== 'agent') {
        return res.status(403).json({
          success: false,
          message: 'Only agents can view their received orders'
        });
      }

      const agentId = req.user.id;
      const { status, page = 1, limit = 20 } = req.query;

      console.log(`📋 Fetching orders for agent: ${agentId}`);
      console.log(`🔍 Status filter: ${status || 'All'}`);

      const offset = (page - 1) * limit;

      // Build where condition
      let whereCondition = { agent_id: agentId };
      if (status) whereCondition.status = status;

      const { count, rows: orders } = await db.Order.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: db.AgentGasListing,
            as: 'listing',
            attributes: ['id', 'size'],
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['id', 'name', 'logo_url']
            }]
          },
          {
            model: db.User,
            as: 'customer',
            attributes: ['id', 'full_name', 'phone_number']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      const formattedOrders = orders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        product: {
          brand: order.listing?.brand?.name || 'Gas Brand',
          size: order.listing?.size,
          image: order.listing?.brand?.logo_url
        },
        customer: {
          id: order.customer?.id,
          name: order.customer?.full_name || 'Customer',
          phone: order.customer?.phone_number
        },
        quantity: order.quantity,
        unit_price: parseFloat(order.unit_price),
        total_price: parseFloat(order.total_price),
        grand_total: parseFloat(order.grand_total),
        delivery_fee: parseFloat(order.delivery_fee),
        delivery_address: order.delivery_address,
        customer_notes: order.customer_notes,
        status: order.status,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        created_at: order.created_at,
        estimated_delivery_time: order.estimated_delivery_time,
        agent_notes: order.agent_notes
      }));

      console.log(`✅ Found ${count} orders for agent ${agentId}`);

      res.json({
        success: true,
        count: formattedOrders.length,
        total: count,
        page: parseInt(page),
        total_pages: Math.ceil(count / limit),
        orders: formattedOrders
      });

    } catch (error) {
      console.error('❌ Error fetching agent orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders',
        error: error.message
      });
    }
  };

  // 4. Update order status (Agent only)
  updateOrderStatus = async (req, res) => {
    try {
      if (req.user.user_type !== 'agent') {
        return res.status(403).json({
          success: false,
          message: 'Only agents can update order status'
        });
      }

      const agentId = req.user.id;
      const { order_id } = req.params;
      const { status, agent_notes, estimated_delivery_time } = req.body;

      console.log(`🔄 Updating order ${order_id} status to: ${status}`);
      console.log(`📝 Agent notes: ${agent_notes || 'None'}`);

      // Find order
      const order = await db.Order.findOne({
        where: {
          id: order_id,
          agent_id: agentId
        },
        include: [{
          model: db.User,
          as: 'customer',
          attributes: ['id', 'full_name', 'phone_number']
        }]
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found or you do not have permission to update it'
        });
      }

      // Validate status transition
      const validTransitions = {
        pending: ['confirmed', 'rejected', 'cancelled'],
        confirmed: ['processing', 'cancelled'],
        processing: ['shipped', 'cancelled'],
        shipped: ['delivered'],
        delivered: [], // Terminal state
        cancelled: [], // Terminal state
        rejected: [] // Terminal state
      };

      if (!validTransitions[order.status].includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from ${order.status} to ${status}`
        });
      }

      // Update order
      const updateData = { status };
      if (agent_notes) updateData.agent_notes = agent_notes;
      if (estimated_delivery_time) updateData.estimated_delivery_time = estimated_delivery_time;
      
      // Set actual delivery time if status is delivered
      if (status === 'delivered') {
        updateData.actual_delivery_time = new Date();
      }

      await order.update(updateData);

      console.log(`✅ Order ${order_id} status updated to: ${status}`);

      // TODO: Send notification to customer
      console.log(`📱 Notification would be sent to customer: ${order.customer?.phone_number}`);

      res.json({
        success: true,
        message: `Order status updated to ${status}`,
        order: {
          id: order.id,
          order_number: order.order_number,
          customer_name: order.customer?.full_name || 'Customer',
          status: order.status,
          agent_notes: order.agent_notes,
          estimated_delivery_time: order.estimated_delivery_time,
          updated_at: order.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error updating order status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update order status',
        error: error.message
      });
    }
  };

  // 5. Cancel order (Customer only)
  cancelOrder = async (req, res) => {
    try {
      const customerId = req.user.id;
      const { order_id } = req.params;
      const { cancellation_reason } = req.body;

      console.log(`❌ Customer ${customerId} cancelling order: ${order_id}`);
      console.log(`📝 Reason: ${cancellation_reason || 'No reason provided'}`);

      // Find order
      const order = await db.Order.findOne({
        where: {
          id: order_id,
          customer_id: customerId
        },
        include: [{
          model: db.AgentGasListing,
          attributes: ['id', 'available_quantity']
        }]
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found or you do not have permission to cancel it'
        });
      }

      // Check if order can be cancelled
      const cancellableStatuses = ['pending', 'confirmed'];
      if (!cancellableStatuses.includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel order with status: ${order.status}`
        });
      }

      // Update order status
      await order.update({
        status: 'cancelled',
        cancellation_reason: cancellation_reason
      });

      // Return quantity to listing if order was confirmed
      if (order.status === 'confirmed' && order.AgentGasListing) {
        await db.AgentGasListing.increment('available_quantity', {
          by: order.quantity,
          where: { id: order.AgentGasListing.id }
        });
        console.log(`🔄 Returned ${order.quantity} units to listing ${order.AgentGasListing.id}`);
      }

      console.log(`✅ Order ${order_id} cancelled successfully`);

      // TODO: Send notification to agent
      console.log('📱 Notification would be sent to agent');

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          cancellation_reason: order.cancellation_reason,
          updated_at: order.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error cancelling order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel order',
        error: error.message
      });
    }
  };

  // 6. Get order details
  getOrderDetails = async (req, res) => {
    try {
      const { order_id } = req.params;
      const userId = req.user.id;
      const userType = req.user.user_type;

      console.log(`🔍 Getting details for order: ${order_id}`);
      console.log(`👤 User: ${userId} (${userType})`);

      // Build where condition based on user type
      let whereCondition = { id: order_id };
      if (userType === 'customer') {
        whereCondition.customer_id = userId;
      } else if (userType === 'agent') {
        whereCondition.agent_id = userId;
      }
      // Admin can see any order

      const order = await db.Order.findOne({
        where: whereCondition,
        include: [
          {
            model: db.AgentGasListing,
            as: 'listing',
            attributes: ['id', 'size', 'cylinder_condition'],
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['id', 'name', 'logo_url', 'description']
            }]
          },
          {
            model: db.User,
            as: 'customer',
            attributes: ['id', 'full_name', 'phone_number', 'email']
          },
          {
            model: db.User,
            as: 'agent',
            attributes: ['id', 'full_name', 'business_name', 'phone_number', 'email', 'profile_image']
          }
        ]
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found or you do not have permission to view it'
        });
      }

      const response = {
        success: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          customer: {
            id: order.customer.id,
            name: order.customer.full_name,
            phone: order.customer.phone_number,
            email: order.customer.email
          },
          agent: {
            id: order.agent.id,
            name: order.agent.business_name || order.agent.full_name,
            phone: order.agent.phone_number,
            email: order.agent.email,
            profile_image: order.agent.profile_image
          },
          product: {
            brand: order.listing.brand.name,
            size: order.listing.size,
            cylinder_condition: order.listing.cylinder_condition,
            image: order.listing.brand.logo_url,
            description: order.listing.brand.description
          },
          quantity: order.quantity,
          unit_price: parseFloat(order.unit_price),
          delivery_fee: parseFloat(order.delivery_fee),
          total_price: parseFloat(order.total_price),
          grand_total: parseFloat(order.grand_total),
          delivery_address: order.delivery_address,
          delivery_latitude: order.delivery_latitude,
          delivery_longitude: order.delivery_longitude,
          customer_notes: order.customer_notes,
          agent_notes: order.agent_notes,
          status: order.status,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          cancellation_reason: order.cancellation_reason,
          estimated_delivery_time: order.estimated_delivery_time,
          actual_delivery_time: order.actual_delivery_time,
          rating: order.rating,
          review: order.review,
          created_at: order.created_at,
          updated_at: order.updated_at
        }
      };

      console.log(`✅ Found order #${order.order_number} with status: ${order.status}`);

      res.json(response);

    } catch (error) {
      console.error('❌ Error getting order details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get order details',
        error: error.message
      });
    }
  };

  // 7. Add rating and review (Customer only, after delivery)
  addRating = async (req, res) => {
    try {
      if (req.user.user_type !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only customers can rate orders'
        });
      }

      const customerId = req.user.id;
      const { order_id } = req.params;
      const { rating, review } = req.body;

      console.log(`⭐ Customer ${customerId} rating order: ${order_id}`);
      console.log(`📊 Rating: ${rating}/5`);
      console.log(`📝 Review: ${review || 'No review'}`);

      // Validate rating
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }

      // Find order
      const order = await db.Order.findOne({
        where: {
          id: order_id,
          customer_id: customerId,
          status: 'delivered'
        },
        include: [{
          model: db.AgentGasListing,
          attributes: ['id', 'agent_id', 'rating', 'total_orders']
        }]
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found, not delivered yet, or you cannot rate it'
        });
      }

      // Check if already rated
      if (order.rating) {
        return res.status(400).json({
          success: false,
          message: 'You have already rated this order'
        });
      }

      // Update order with rating
      await order.update({
        rating: parseInt(rating),
        review: review
      });

      // Update agent's average rating on the listing
      if (order.AgentGasListing) {
        const listing = order.AgentGasListing;
        const totalRatings = listing.total_orders;
        const currentRating = listing.rating || 0;
        
        // Calculate new average rating
        const newRating = ((currentRating * totalRatings) + parseInt(rating)) / (totalRatings + 1);
        
        await listing.update({
          rating: parseFloat(newRating.toFixed(2))
        });
        
        console.log(`📈 Updated listing rating to: ${newRating.toFixed(2)}`);
      }

      console.log(`✅ Rating submitted successfully for order ${order_id}`);

      res.json({
        success: true,
        message: 'Thank you for your rating!',
        rating: {
          order_id: order.id,
          rating: order.rating,
          review: order.review,
          updated_at: order.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error adding rating:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add rating',
        error: error.message
      });
    }
  };
}

module.exports = new OrderController();