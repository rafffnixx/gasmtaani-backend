const db = require('../models');

class PaymentController {
  // Helper: Generate verification code
  generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // 1. Initiate M-Pesa Payment (Simulation)
  initiateMpesaPayment = async (req, res) => {
    try {
      console.log('==============================');
      console.log('🟢 PAYMENT INITIATION REQUEST RECEIVED');
      console.log('==============================');
      
      console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
      
      const { order_id, phone_number, amount } = req.body;
      const userId = req.user.id;
      const userType = req.user.user_type;

      console.log(`💰 Initiating M-Pesa payment for order: ${order_id}`);
      console.log(`👤 User: ${userId} (${userType})`);

      // Validate input
      if (!order_id || !phone_number || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Order ID, phone number, and amount are required'
        });
      }

      // Format phone number
      let formattedPhone = phone_number.toString().trim();
      formattedPhone = formattedPhone.replace(/\D/g, '');
      
      // Format to 254
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      } else if (formattedPhone.startsWith('+254')) {
        formattedPhone = formattedPhone.substring(1);
      } else if (formattedPhone.length === 9) {
        formattedPhone = '254' + formattedPhone;
      }

      // Validate Kenyan phone number
      const kenyanRegex = /^254[17]\d{8}$/;
      if (!kenyanRegex.test(formattedPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid Kenyan phone number (e.g., 0712345678 or 0112345678)'
        });
      }

      console.log(`✅ Phone validated: ${formattedPhone}`);

      // Find order
      const order = await db.Order.findOne({
        where: {
          id: order_id,
          customer_id: userId,
          status: 'pending_payment'
        },
        include: [
          {
            model: db.AgentGasListing,
            as: 'listing',
            attributes: ['id', 'size', 'selling_price']
          }
        ]
      });

      if (!order) {
        console.log(`❌ Order ${order_id} not found or not in pending_payment state`);
        return res.status(404).json({
          success: false,
          message: 'Order not found or payment cannot be initiated'
        });
      }

      console.log(`✅ Order found: #${order.order_number}`);
      console.log(`💰 Order total: ${order.grand_total}`);

      // Check if order already has a completed payment
      const existingPayment = await db.Payment.findOne({
        where: {
          order_id: order_id,
          status: 'completed'
        }
      });

      if (existingPayment) {
        console.log(`⚠️ Order ${order_id} already has completed payment: ${existingPayment.id}`);
        return res.status(400).json({
          success: false,
          message: 'This order has already been paid for',
          payment: existingPayment
        });
      }

      // Verify amount matches order
      const requestedAmount = parseFloat(amount);
      const orderAmount = parseFloat(order.grand_total);
      console.log(`💰 Amount check: Requested ${requestedAmount} vs Order ${orderAmount}`);
      
      if (requestedAmount !== orderAmount) {
        return res.status(400).json({
          success: false,
          message: `Amount (${amount}) does not match order total (${order.grand_total})`
        });
      }

      // Generate verification code
      const verificationCode = this.generateVerificationCode();
      console.log(`🔢 Generated verification code: ${verificationCode}`);

      // Create payment record
      const payment = await db.Payment.create({
        order_id: order_id,
        customer_id: userId,
        agent_id: order.agent_id,
        amount: amount,
        phone_number: formattedPhone,
        payment_method: 'mpesa',
        verification_code: verificationCode,
        status: 'pending',
        transaction_type: 'checkout',
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        metadata: {
          listing_id: order.listing_id,
          quantity: order.quantity,
          original_phone: phone_number
        }
      });

      console.log(`✅ Payment record created: ID ${payment.id}`);
      console.log(`📱 Phone stored: ${payment.phone_number}`);
      console.log(`⏰ Expires at: ${payment.expires_at}`);

      const responseData = {
        success: true,
        message: 'Verification code generated',
        payment: {
          payment_id: payment.id,
          order_id: payment.order_id,
          amount: parseFloat(payment.amount),
          phone_number: payment.phone_number,
          verification_code: verificationCode,
          status: payment.status,
          expires_at: payment.expires_at,
          created_at: payment.created_at,
          listing_id: order.listing_id
        },
        note: 'In production, verification code would be sent via SMS'
      };

      console.log('==============================');
      console.log('🟢 PAYMENT INITIATION COMPLETE');
      console.log('==============================');

      res.json(responseData);

    } catch (error) {
      console.error('❌❌❌ ERROR in initiateMpesaPayment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate payment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  };

  // 2. Verify M-Pesa Payment
  verifyMpesaPayment = async (req, res) => {
    try {
      const { payment_id, verification_code } = req.body;
      const userId = req.user.id;

      console.log(`🔐 Verifying payment: ${payment_id}`);
      console.log(`🔢 Code: ${verification_code}`);
      console.log(`👤 Customer ID: ${userId}`);

      if (!payment_id || !verification_code) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID and verification code are required'
        });
      }

      // Find payment using raw query to avoid association issues
      const [payment] = await db.sequelize.query(
        `SELECT * FROM payments WHERE id = $1 AND customer_id = $2`,
        {
          bind: [payment_id, userId],
          type: db.sequelize.QueryTypes.SELECT
        }
      );

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found or you do not have permission'
        });
      }

      console.log(`💰 Payment found: ID ${payment.id}, Status: ${payment.status}`);
      console.log(`📦 Associated Order ID: ${payment.order_id}`);

      // Check if payment can be verified
      if (payment.status !== 'pending') {
        console.log(`⚠️ Payment is already ${payment.status}`);
        return res.status(400).json({
          success: false,
          message: `Payment is already ${payment.status}`
        });
      }

      // Check if payment is expired
      if (new Date(payment.expires_at) < new Date()) {
        console.log(`⏰ Payment expired at: ${payment.expires_at}`);
        await db.sequelize.query(
          `UPDATE payments SET status = 'expired', failure_reason = 'Payment verification timeout' WHERE id = $1`,
          { bind: [payment_id] }
        );
        
        return res.status(400).json({
          success: false,
          message: 'Verification code has expired. Please restart payment.'
        });
      }

      // Verify code
      if (payment.verification_code !== verification_code) {
        console.log(`❌ Code mismatch: Expected ${payment.verification_code}, Got ${verification_code}`);
        
        // Increment verification attempts
        const newAttempts = (payment.verification_attempts || 0) + 1;
        await db.sequelize.query(
          `UPDATE payments SET verification_attempts = $1, last_attempt_at = NOW() WHERE id = $2`,
          { bind: [newAttempts, payment_id] }
        );

        console.log(`📝 Verification attempts: ${newAttempts}/5`);

        // Check if too many attempts
        if (newAttempts >= 5) {
          await db.sequelize.query(
            `UPDATE payments SET status = 'expired', failure_reason = 'Too many failed verification attempts' WHERE id = $1`,
            { bind: [payment_id] }
          );
          
          console.log(`🚫 Too many failed attempts, payment expired`);
          
          return res.status(400).json({
            success: false,
            message: 'Too many failed attempts. Payment has been expired.'
          });
        }

        const attemptsLeft = 5 - newAttempts;
        return res.status(400).json({
          success: false,
          message: `Invalid verification code. ${attemptsLeft} attempt(s) left.`,
          attempts_left: attemptsLeft
        });
      }

      // ✅ Code is correct - Update payment status
      console.log(`✅ Verification code correct!`);
      
      const transactionReference = `MPESA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // 1. Update payment to completed
      await db.sequelize.query(
        `UPDATE payments SET 
          status = 'completed', 
          verified_at = NOW(), 
          transaction_reference = $1 
         WHERE id = $2`,
        { bind: [transactionReference, payment_id] }
      );

      console.log(`💰 Payment ${payment_id} marked as completed`);
      console.log(`📊 Transaction Reference: ${transactionReference}`);

      // 2. Get order details
      const order = await db.Order.findByPk(payment.order_id);
      if (!order) {
        console.log(`❌ Order ${payment.order_id} not found`);
        return res.status(404).json({
          success: false,
          message: 'Associated order not found'
        });
      }

      // 3. Update order status and reduce stock
      if (order.status === 'pending_payment') {
        // Update order to pending (waiting agent confirmation)
        await order.update({
          status: 'pending', // Now waiting for agent to confirm
          payment_status: 'paid',
          payment_method: 'mpesa'
        });
        
        // Reduce listing quantity
        const listing = await db.AgentGasListing.findByPk(order.listing_id);
        if (listing) {
          await listing.update({
            available_quantity: listing.available_quantity - order.quantity
          });
          console.log(`📦 Reduced listing quantity by ${order.quantity} after M-Pesa verification`);
        }
        
        console.log(`✅ Order ${order.id} updated: status=pending (waiting agent), payment_status=paid`);
      } else {
        // Order already in another state, just update payment status
        await order.update({
          payment_status: 'paid',
          payment_method: 'mpesa'
        });
        console.log(`✅ Order ${order.id} payment_status updated to paid`);
      }

      // 4. Clear cart
      console.log(`🛒 Checking cart for customer ${userId}`);
      try {
        // Parse metadata
        let metadata = {};
        if (payment.metadata) {
          if (typeof payment.metadata === 'string') {
            try {
              metadata = JSON.parse(payment.metadata);
            } catch (e) {
              console.log('⚠️ Could not parse metadata as JSON:', e.message);
            }
          } else {
            metadata = payment.metadata;
          }
        }
        
        const listingId = metadata.listing_id;
        
        if (listingId) {
          console.log(`🔍 Clearing cart for listing ${listingId}`);
          
          // Clear cart for this listing
          await db.sequelize.query(
            `DELETE FROM carts WHERE customer_id = $1 AND listing_id = $2`,
            { bind: [userId, listingId] }
          );
          
          console.log(`🗑️ Cleared cart for listing ${listingId}`);
        }
      } catch (cartError) {
        console.error('❌ Error clearing cart:', cartError);
        console.log('⚠️ Payment succeeded but cart clearing failed');
      }

      // TODO: Send notification to agent
      console.log(`📱 Notification would be sent to agent: ${payment.agent_id}`);

      console.log(`🎉 Payment verification complete!`);

      res.json({
        success: true,
        message: 'Payment successful! Order confirmed and waiting for agent.',
        payment: {
          payment_id: payment.id,
          order_id: payment.order_id,
          transaction_reference: transactionReference,
          amount: parseFloat(payment.amount),
          status: 'completed',
          verified_at: new Date().toISOString(),
          expires_at: payment.expires_at
        },
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          payment_status: order.payment_status
        },
        cart_cleared: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error verifying payment:', error);
      console.error('📝 Error details:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Failed to verify payment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  };

  // 3. Resend verification code
  resendVerificationCode = async (req, res) => {
    try {
      const { payment_id } = req.body;
      const userId = req.user.id;

      console.log(`🔄 Resending code for payment: ${payment_id}`);

      if (!payment_id) {
        return res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
      }

      // Find payment
      const payment = await db.Payment.findOne({
        where: {
          id: payment_id,
          customer_id: userId,
          status: 'pending'
        }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found or already processed'
        });
      }

      // Check if payment is expired
      if (new Date() > payment.expires_at) {
        await payment.update({
          status: 'expired',
          failure_reason: 'Payment verification timeout'
        });
        
        return res.status(400).json({
          success: false,
          message: 'Payment has expired. Please restart payment process.'
        });
      }

      // Generate new code
      const newCode = this.generateVerificationCode();

      // Update payment with new code
      await payment.update({
        verification_code: newCode,
        verification_attempts: (payment.verification_attempts || 0) + 1
      });

      console.log(`✅ New code generated: ${newCode}`);

      res.json({
        success: true,
        message: 'New verification code generated',
        payment: {
          payment_id: payment.id,
          verification_code: newCode,
          expires_at: payment.expires_at,
          note: 'In production, code would be sent via SMS'
        }
      });

    } catch (error) {
      console.error('❌ Error resending code:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend verification code',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // 4. Get payment status
  getPaymentStatus = async (req, res) => {
    try {
      const { order_id } = req.query;
      const userId = req.user.id;

      console.log(`📊 Getting payment status for order: ${order_id}`);

      if (!order_id) {
        return res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
      }

      // Find payment
      const payment = await db.Payment.findOne({
        where: {
          order_id: order_id,
          customer_id: userId
        },
        order: [['created_at', 'DESC']]
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'No payment found for this order'
        });
      }

      res.json({
        success: true,
        payment: {
          payment_id: payment.id,
          order_id: payment.order_id,
          amount: parseFloat(payment.amount),
          phone_number: payment.phone_number,
          status: payment.status,
          payment_method: payment.payment_method,
          transaction_reference: payment.transaction_reference,
          verification_code: payment.status === 'pending' ? payment.verification_code : undefined,
          verification_attempts: payment.verification_attempts,
          expires_at: payment.expires_at,
          verified_at: payment.verified_at,
          created_at: payment.created_at,
          updated_at: payment.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error getting payment status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // 5. Get payments by order (for customer and agent)
  getPaymentsByOrder = async (req, res) => {
    try {
      const { order_id } = req.params;
      const userId = req.user.id;
      const userType = req.user.user_type;

      console.log(`📋 Getting payments for order: ${order_id}`);
      console.log(`👤 User: ${userId} (${userType})`);

      // Find order first to check permissions
      const order = await db.Order.findByPk(order_id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Check permissions
      if (userType === 'customer' && order.customer_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only view payments for your own orders'
        });
      }

      if (userType === 'agent' && order.agent_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only view payments for your own agent orders'
        });
      }

      // Find payments for this order
      const payments = await db.Payment.findAll({
        where: { order_id: order_id },
        order: [['created_at', 'DESC']],
        include: [
          {
            model: db.User,
            as: 'customer',
            attributes: ['id', 'full_name', 'phone_number']
          }
        ]
      });

      res.json({
        success: true,
        order_id: order_id,
        payments: payments.map(payment => ({
          payment_id: payment.id,
          amount: parseFloat(payment.amount),
          phone_number: payment.phone_number,
          status: payment.status,
          payment_method: payment.payment_method,
          transaction_reference: payment.transaction_reference,
          verification_attempts: payment.verification_attempts,
          expires_at: payment.expires_at,
          verified_at: payment.verified_at,
          failure_reason: payment.failure_reason,
          created_at: payment.created_at,
          customer: payment.customer ? {
            name: payment.customer.full_name,
            phone: payment.customer.phone_number
          } : null
        }))
      });

    } catch (error) {
      console.error('❌ Error getting payments by order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payments',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // 6. Get customer payments
  getCustomerPayments = async (req, res) => {
    try {
      if (req.user.user_type !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only customers can view their payments'
        });
      }

      const customerId = req.user.id;
      const { status, limit = 20, page = 1 } = req.query;

      console.log(`📊 Getting payments for customer: ${customerId}`);

      const offset = (page - 1) * limit;
      
      // Build where condition
      const whereCondition = { customer_id: customerId };
      if (status) whereCondition.status = status;

      const { count, rows: payments } = await db.Payment.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: db.Order,
            as: 'order',
            attributes: ['id', 'order_number', 'status', 'payment_status']
          },
          {
            model: db.User,
            as: 'agent',
            attributes: ['id', 'business_name', 'full_name']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      res.json({
        success: true,
        payments: payments.map(payment => ({
          payment_id: payment.id,
          order: {
            id: payment.order?.id,
            order_number: payment.order?.order_number,
            status: payment.order?.status,
            payment_status: payment.order?.payment_status
          },
          amount: parseFloat(payment.amount),
          phone_number: payment.phone_number,
          status: payment.status,
          payment_method: payment.payment_method,
          transaction_reference: payment.transaction_reference,
          agent: payment.agent ? {
            name: payment.agent.business_name || payment.agent.full_name
          } : null,
          verified_at: payment.verified_at,
          created_at: payment.created_at
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(count / limit)
        }
      });

    } catch (error) {
      console.error('❌ Error getting customer payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payments',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // 7. Get agent payments
  getAgentPayments = async (req, res) => {
    try {
      if (req.user.user_type !== 'agent') {
        return res.status(403).json({
          success: false,
          message: 'Only agents can view their payments'
        });
      }

      const agentId = req.user.id;
      const { status, limit = 20, page = 1 } = req.query;

      console.log(`📊 Getting payments for agent: ${agentId}`);

      const offset = (page - 1) * limit;
      
      // Build where condition
      const whereCondition = { agent_id: agentId };
      if (status) whereCondition.status = status;

      const { count, rows: payments } = await db.Payment.findAndCountAll({
        where: whereCondition,
        include: [
          {
            model: db.Order,
            as: 'order',
            attributes: ['id', 'order_number', 'status', 'payment_status']
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

      res.json({
        success: true,
        payments: payments.map(payment => ({
          payment_id: payment.id,
          order: {
            id: payment.order?.id,
            order_number: payment.order?.order_number,
            status: payment.order?.status,
            payment_status: payment.order?.payment_status
          },
          amount: parseFloat(payment.amount),
          phone_number: payment.phone_number,
          status: payment.status,
          payment_method: payment.payment_method,
          transaction_reference: payment.transaction_reference,
          customer: payment.customer ? {
            name: payment.customer.full_name,
            phone: payment.customer.phone_number
          } : null,
          verified_at: payment.verified_at,
          created_at: payment.created_at
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(count / limit)
        }
      });

    } catch (error) {
      console.error('❌ Error getting agent payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payments',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // 8. For Production: Integrate with Safaricom Daraja API
  initiateRealMpesaPayment = async (req, res) => {
    try {
      const { order_id, phone_number } = req.body;
      const userId = req.user.id;

      console.log(`🚀 Initiating real M-Pesa STK Push for order: ${order_id}`);

      // Find order
      const order = await db.Order.findOne({
        where: {
          id: order_id,
          customer_id: userId,
          status: 'pending_payment'
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found or not ready for payment'
        });
      }

      // Format phone number
      let formattedPhone = phone_number.trim();
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      }

      // Validate Kenyan phone number
      if (!/^254[17]\d{8}$/.test(formattedPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid Kenyan phone number'
        });
      }

      // TODO: Implement actual Safaricom Daraja API call here
      const darajaResponse = {
        success: true,
        message: 'STK Push sent successfully',
        data: {
          MerchantRequestID: `MPESA${Date.now()}`,
          CheckoutRequestID: `ws_CO_${Date.now()}`,
          ResponseCode: '0',
          ResponseDescription: 'Success. Request accepted for processing',
          CustomerMessage: 'Please enter your M-Pesa PIN to complete the payment'
        }
      };

      // Save payment record
      const payment = await db.Payment.create({
        order_id: order_id,
        customer_id: userId,
        agent_id: order.agent_id,
        amount: order.grand_total,
        phone_number: formattedPhone,
        payment_method: 'mpesa',
        status: 'pending',
        transaction_type: 'stk_push',
        merchant_request_id: darajaResponse.data.MerchantRequestID,
        checkout_request_id: darajaResponse.data.CheckoutRequestID
      });

      console.log(`✅ M-Pesa STK Push initiated`);
      console.log(`📱 Merchant Request ID: ${payment.merchant_request_id}`);

      res.json({
        success: true,
        message: 'M-Pesa STK Push initiated. Please check your phone.',
        payment: {
          payment_id: payment.id,
          merchant_request_id: payment.merchant_request_id,
          checkout_request_id: payment.checkout_request_id,
          amount: parseFloat(payment.amount),
          phone_number: payment.phone_number,
          note: 'Customer should receive an STK Push prompt on their phone'
        }
      });

    } catch (error) {
      console.error('❌ Error initiating real M-Pesa payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate M-Pesa payment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // 9. Webhook for Daraja API callbacks (for production)
  mpesaCallback = async (req, res) => {
    try {
      const callbackData = req.body;
      
      console.log('📞 M-Pesa Callback Received:', JSON.stringify(callbackData, null, 2));

      // Handle different callback types
      if (callbackData.Body?.stkCallback) {
        // STK Push callback
        const stkCallback = callbackData.Body.stkCallback;
        
        if (stkCallback.ResultCode === 0) {
          // Successful payment
          const checkoutRequestId = stkCallback.CheckoutRequestID;
          const mpesaReceipt = stkCallback.CallbackMetadata?.Item?.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
          const phoneNumber = stkCallback.CallbackMetadata?.Item?.find(item => item.Name === 'PhoneNumber')?.Value;
          const amount = stkCallback.CallbackMetadata?.Item?.find(item => item.Name === 'Amount')?.Value;

          console.log(`✅ M-Pesa Payment Successful`);
          console.log(`📱 Receipt: ${mpesaReceipt}, Amount: ${amount}, Phone: ${phoneNumber}`);

          // Find and update payment
          const payment = await db.Payment.findOne({
            where: {
              checkout_request_id: checkoutRequestId,
              status: 'pending'
            }
          });

          if (payment) {
            await payment.update({
              status: 'completed',
              verified_at: new Date(),
              mpesa_receipt_number: mpesaReceipt,
              transaction_reference: `MPESA-${mpesaReceipt}`,
              metadata: { ...payment.metadata, callbackData: stkCallback }
            });

            // Update order
            const order = await db.Order.findByPk(payment.order_id);
            if (order && order.status === 'pending_payment') {
              await order.update({
                status: 'pending',
                payment_status: 'paid',
                payment_method: 'mpesa'
              });
              
              // Reduce listing quantity
              const listing = await db.AgentGasListing.findByPk(order.listing_id);
              if (listing) {
                await listing.update({
                  available_quantity: listing.available_quantity - order.quantity
                });
              }
            }

            console.log(`✅ Updated payment ${payment.id} and order ${payment.order_id}`);
          }
        } else {
          // Failed payment
          console.log(`❌ M-Pesa Payment Failed: ${stkCallback.ResultDesc}`);
          
          const payment = await db.Payment.findOne({
            where: {
              checkout_request_id: stkCallback.CheckoutRequestID
            }
          });

          if (payment) {
            await payment.update({
              status: 'failed',
              failure_reason: stkCallback.ResultDesc,
              metadata: { ...payment.metadata, callbackData: stkCallback }
            });
          }
        }
      }

      // Always return success to Daraja API
      res.json({
        ResultCode: 0,
        ResultDesc: "Success"
      });

    } catch (error) {
      console.error('❌ Error processing M-Pesa callback:', error);
      res.json({
        ResultCode: 1,
        ResultDesc: "Failed to process callback"
      });
    }
  };
}

module.exports = new PaymentController();