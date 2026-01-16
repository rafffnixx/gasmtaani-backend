const db = require('../models');

class CartController {
  // 1. Get cart items for customer
  getCart = async (req, res) => {
    try {
      if (req.user.user_type !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only customers can view cart'
        });
      }

      const customerId = req.user.id;

      console.log(`🛒 Fetching cart for customer: ${customerId}`);

      // Get cart items with listing and agent details
      const cartItems = await db.Cart.findAll({
        where: { customer_id: customerId },
        include: [
          {
            model: db.AgentGasListing,
            as: 'listing',
            attributes: ['id', 'size', 'selling_price', 'available_quantity', 'cylinder_condition', 'agent_id'],
            include: [
              {
                model: db.GasBrand,
                as: 'brand',
                attributes: ['id', 'name', 'logo_url']
              },
              {
                model: db.User,
                as: 'listingAgent', // Using listingAgent as defined in your index.js
                attributes: ['id', 'business_name', 'full_name', 'phone_number', 'email']
              }
            ]
          }
        ],
        order: [['created_at', 'DESC']]
      });

      // Calculate totals
      let subtotal = 0;
      let totalItems = 0;
      let deliveryFee = 0; // You can calculate per agent or use a flat fee
      
      const formattedItems = cartItems.map(item => {
        const itemTotal = parseFloat(item.listing.selling_price) * item.quantity;
        subtotal += itemTotal;
        totalItems += item.quantity;
        
        // For now, use a fixed delivery fee per item
        // You can customize this based on your business logic
        const itemDeliveryFee = item.listing.delivery_fee || 100; // Default 100 KES
        deliveryFee += itemDeliveryFee;

        return {
          cart_item_id: item.id,
          listing_id: item.listing_id,
          quantity: item.quantity,
          product: {
            brand: item.listing.brand?.name || 'Unknown Brand',
            brand_id: item.listing.brand?.id,
            size: item.listing.size,
            condition: item.listing.cylinder_condition,
            image: item.listing.brand?.logo_url,
            price: parseFloat(item.listing.selling_price)
          },
          agent: {
            id: item.listing.agent_id,
            name: item.listing.listingAgent?.business_name || item.listing.listingAgent?.full_name || 'Unknown Agent',
            phone: item.listing.listingAgent?.phone_number,
            email: item.listing.listingAgent?.email
          },
          item_total: itemTotal,
          delivery_fee: itemDeliveryFee,
          item_grand_total: itemTotal + itemDeliveryFee,
          created_at: item.created_at,
          updated_at: item.updated_at
        };
      });

      const grandTotal = subtotal + deliveryFee;

      console.log(`✅ Found ${cartItems.length} items in cart, ${totalItems} total units`);

      res.json({
        success: true,
        cart: formattedItems,
        summary: {
          items_count: totalItems,
          unique_items: cartItems.length,
          subtotal: parseFloat(subtotal.toFixed(2)),
          delivery_fee: parseFloat(deliveryFee.toFixed(2)),
          grand_total: parseFloat(grandTotal.toFixed(2))
        }
      });

    } catch (error) {
      console.error('❌ Error fetching cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // 2. Add item to cart (Fixed - no agent_id required)
  addToCart = async (req, res) => {
    try {
      if (req.user.user_type !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only customers can add to cart'
        });
      }

      const customerId = req.user.id;
      const { listing_id, quantity = 1 } = req.body;

      console.log(`➕ Adding to cart for customer: ${customerId}`);
      console.log(`📦 Listing ID: ${listing_id}, Quantity: ${quantity}`);

      // Validate input
      if (!listing_id) {
        return res.status(400).json({
          success: false,
          message: 'Listing ID is required'
        });
      }

      if (quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1'
        });
      }

      // Validate listing exists
      const listing = await db.AgentGasListing.findByPk(listing_id, {
        include: [
          {
            model: db.GasBrand,
            as: 'brand',
            attributes: ['id', 'name']
          },
          {
            model: db.User,
            as: 'listingAgent',
            attributes: ['id', 'business_name', 'full_name']
          }
        ]
      });

      if (!listing) {
        return res.status(404).json({
          success: false,
          message: 'Product listing not found'
        });
      }

      // Check availability
      if (!listing.is_available) {
        return res.status(400).json({
          success: false,
          message: 'This product is currently unavailable'
        });
      }

      if (listing.available_quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${listing.available_quantity} units available`
        });
      }

      // Check if customer is trying to add their own product
      if (listing.agent_id === customerId) {
        return res.status(400).json({
          success: false,
          message: 'You cannot add your own product to cart'
        });
      }

      // Check if item already in cart (unique constraint on customer_id + listing_id)
      const existingCartItem = await db.Cart.findOne({
        where: {
          customer_id: customerId,
          listing_id: listing_id
        }
      });

      let cartItem;
      let isNewItem = false;
      
      if (existingCartItem) {
        // Update quantity
        const newQuantity = existingCartItem.quantity + parseInt(quantity);
        
        if (listing.available_quantity < newQuantity) {
          return res.status(400).json({
            success: false,
            message: `Cannot add more. Only ${listing.available_quantity} units available in total`
          });
        }

        await existingCartItem.update({
          quantity: newQuantity
        });

        cartItem = existingCartItem;
        console.log(`🔄 Updated quantity to ${newQuantity} for listing ${listing_id}`);
      } else {
        // Create new cart item
        cartItem = await db.Cart.create({
          customer_id: customerId,
          listing_id: listing_id,
          agent_id: listing.agent_id, // ← ADD THIS LINE
          quantity: quantity
        });

        isNewItem = true;
        console.log(`✅ Added new item to cart`);
      }

      // Get updated cart item with details
      const updatedCartItem = await db.Cart.findByPk(cartItem.id, {
        include: [
          {
            model: db.AgentGasListing,
            as: 'listing',
            attributes: ['selling_price', 'size', 'cylinder_condition'],
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['name']
            }]
          }
        ]
      });

      const itemTotal = parseFloat(updatedCartItem.listing.selling_price) * updatedCartItem.quantity;

      res.status(201).json({
        success: true,
        message: isNewItem ? 'Item added to cart' : 'Cart updated successfully',
        cart_item: {
          cart_item_id: updatedCartItem.id,
          listing_id: updatedCartItem.listing_id,
          quantity: updatedCartItem.quantity,
          product: {
            brand: updatedCartItem.listing.brand.name,
            size: updatedCartItem.listing.size,
            condition: updatedCartItem.listing.cylinder_condition,
            price: parseFloat(updatedCartItem.listing.selling_price)
          },
          item_total: itemTotal,
          agent_id: listing.agent_id // Include agent_id from the listing
        }
      });

    } catch (error) {
      console.error('❌ Error adding to cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add to cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // 3. Update cart item quantity
  updateCartItem = async (req, res) => {
    try {
      if (req.user.user_type !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only customers can update cart'
        });
      }

      const customerId = req.user.id;
      const { cart_item_id } = req.params;
      const { quantity } = req.body;

      console.log(`✏️ Updating cart item: ${cart_item_id}`);
      console.log(`🔢 New quantity: ${quantity}`);

      if (!quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1'
        });
      }

      // Find cart item
      const cartItem = await db.Cart.findOne({
        where: {
          id: cart_item_id,
          customer_id: customerId
        },
        include: [{
          model: db.AgentGasListing,
          as: 'listing',
          attributes: ['available_quantity', 'selling_price', 'size']
        }]
      });

      if (!cartItem) {
        return res.status(404).json({
          success: false,
          message: 'Cart item not found'
        });
      }

      // Check available quantity
      if (cartItem.listing.available_quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${cartItem.listing.available_quantity} units available`
        });
      }

      // Update quantity
      await cartItem.update({ quantity });

      const itemTotal = parseFloat(cartItem.listing.selling_price) * quantity;

      console.log(`✅ Cart item updated to quantity ${quantity}`);

      res.json({
        success: true,
        message: 'Cart item updated',
        cart_item: {
          cart_item_id: cartItem.id,
          listing_id: cartItem.listing_id,
          quantity: cartItem.quantity,
          item_total: itemTotal,
          updated_at: cartItem.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error updating cart item:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update cart item',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // 4. Remove item from cart
  removeFromCart = async (req, res) => {
    try {
      if (req.user.user_type !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only customers can remove from cart'
        });
      }

      const customerId = req.user.id;
      const { cart_item_id } = req.params;

      console.log(`🗑️ Removing cart item: ${cart_item_id}`);

      const result = await db.Cart.destroy({
        where: {
          id: cart_item_id,
          customer_id: customerId
        }
      });

      if (result === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cart item not found'
        });
      }

      console.log(`✅ Cart item removed successfully`);

      res.json({
        success: true,
        message: 'Item removed from cart'
      });

    } catch (error) {
      console.error('❌ Error removing from cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove from cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // 5. Clear entire cart
  clearCart = async (req, res) => {
    try {
      if (req.user.user_type !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only customers can clear cart'
        });
      }

      const customerId = req.user.id;

      console.log(`🧹 Clearing entire cart for customer: ${customerId}`);

      const result = await db.Cart.destroy({
        where: { customer_id: customerId }
      });

      console.log(`✅ Cleared ${result} items from cart`);

      res.json({
        success: true,
        message: `Cleared ${result} items from cart`
      });

    } catch (error) {
      console.error('❌ Error clearing cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cart',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };
}

module.exports = new CartController();