// server.js - CORRECTED VERSION
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// ============================================================
// DATABASE SETUP
// ============================================================
const db = require('./src/models');

// Auto-sync database in development
const syncDatabase = async () => {
  try {
    console.log('\x1b[36m🔍 Checking database connection...\x1b[0m');
    
    // Test connection
    await db.sequelize.authenticate();
    console.log('\x1b[32m✅ Database connection established\x1b[0m');
    
    // Sync in development only
    if (process.env.NODE_ENV === 'development') {
      await db.sequelize.sync();
      console.log('\x1b[32m✅ Database models synced\x1b[0m');
    }
    
  } catch (error) {
    console.error('\x1b[31m❌ Database error:\x1b[0m', error.message);
    console.log('\x1b[33m⚠️  Starting server anyway...\x1b[0m');
  }
};

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\x1b[90m[${timestamp}] ${req.method} ${req.path}\x1b[0m`);
  next();
});

// ============================================================
// ROUTES IMPORT - CORRECTED IMPORTS
// ============================================================

// Import routes
const authRoutes = require('./src/routes/auth.routes');
const productRoutes = require('./src/routes/products.routes');
const orderRoutes = require('./src/routes/order.routes');
const locationRoutes = require('./src/routes/location.routes');
const cartRoutes = require('./src/routes/cart.routes');
const paymentRoutes = require('./src/routes/payment.routes'); // ← ADD THIS LINE

// CORRECT AGENT ROUTES IMPORT - IMPORTANT FIX HERE
const agentsPublicRoutes = require('./src/routes/agents.routes'); // For PUBLIC routes (customers)
const agentDashboardRoutes = require('./src/routes/agent.routes'); // For AUTHENTICATED routes (agent dashboard)

// ============================================================
// ROUTES
// ============================================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Mtaani Gas Marketplace API is running!',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register_step1: 'POST /api/auth/register/step1 - Basic registration',
        verify_step2: 'POST /api/auth/verify/step2 - Verify + set role',
        login: 'POST /api/auth/login - Login',
        resend_verification: 'POST /api/auth/resend-verification - Resend code'
      },
      products: {
        gas_brands: 'GET /api/products/gas-brands - Get all gas brands',
        brand_sizes: 'GET /api/products/brand/:id/sizes - Get sizes for a brand',
        search_agents: 'GET /api/products/brand/:id/size/:size/agents - Find agents',
        search: 'GET /api/products/search?query=... - Search products',
        details: 'GET /api/products/:id - Get product details'
      },
      // ======= PUBLIC AGENT ROUTES (for customers) =======
      agents: {
        nearby: 'GET /api/agents/nearby?lat&lng&radius - Find nearby agents',
        by_brand: 'GET /api/agents/brand/:brandId - Get agents by brand',
        brands_with_counts: 'GET /api/agents/brands-with-agent-counts - Get brands with agent counts',
        update_location: 'PUT /api/agents/update-location - Update user location (auth required)'
      },
      // ======= AUTHENTICATED AGENT ROUTES (agent dashboard) =======
      agent: {
        dashboard_stats: 'GET /api/agent/dashboard/stats - Agent dashboard stats',
        earnings_stats: 'GET /api/agent/earnings/stats - Agent earnings stats',
        recent_orders: 'GET /api/agent/orders/recent - Recent orders',
        profile: 'GET /api/agent/profile - Get agent profile',
        orders: 'GET /api/agent/orders - Get agent orders',
        products: 'GET /api/agent/products - Get agent products',
        earnings: 'GET /api/agent/earnings - Get agent earnings',
        notifications: 'GET /api/agent/notifications - Get notifications',
        support_tickets: 'GET /api/agent/support/tickets - Get support tickets'
      },
      orders: {
        place_order: 'POST /api/orders - Place order',
        my_orders: 'GET /api/orders/customer - Get customer orders',
        agent_orders: 'GET /api/orders/agent - Get agent orders',
        order_details: 'GET /api/orders/:id - Get order details',
        update_status: 'PUT /api/orders/agent/:id/status - Update status',
        cancel_order: 'PUT /api/orders/customer/:id/cancel - Cancel order',
        add_rating: 'POST /api/orders/:id/rating - Add rating'
      },
      location: {
        update_location: 'PUT /api/location/update - Update user location'
      },
      cart: {
        get_cart: 'GET /api/cart - Get cart items',
        add_item: 'POST /api/cart/items - Add item to cart',
        update_item: 'PUT /api/cart/items/:id - Update cart item',
        remove_item: 'DELETE /api/cart/items/:id - Remove from cart',
        clear_cart: 'DELETE /api/cart/clear - Clear cart'
      },
      system: {
        health: 'GET /health - System health check',
        root: 'GET / - This documentation'
      }
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payments', paymentRoutes); // ← ADD THIS LINE


// CORRECT AGENT ROUTES - IMPORTANT FIX HERE
app.use('/api/agents', agentsPublicRoutes); // For PUBLIC agent routes (customers can access)
app.use('/api/agent', agentDashboardRoutes); // For AUTHENTICATED agent routes (agent dashboard)

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'All routes are working!',
    routes: {
      auth: '/api/auth/*',
      products: '/api/products/*',
      orders: '/api/orders/*',
      location: '/api/location/*',
      cart: '/api/cart/*',
      agents: '/api/agents/* (public)',
      agent: '/api/agent/* (authenticated)'
    }
  });
});
// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Mtaani Gas Marketplace API is running!',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register_step1: 'POST /api/auth/register/step1 - Basic registration',
        verify_step2: 'POST /api/auth/verify/step2 - Verify + set role',
        login: 'POST /api/auth/login - Login',
        resend_verification: 'POST /api/auth/resend-verification - Resend code'
      },
      products: {
        gas_brands: 'GET /api/products/gas-brands - Get all gas brands',
        brand_sizes: 'GET /api/products/brand/:id/sizes - Get sizes for a brand',
        search_agents: 'GET /api/products/brand/:id/size/:size/agents - Find agents',
        search: 'GET /api/products/search?query=... - Search products',
        details: 'GET /api/products/:id - Get product details'
      },
      // ======= PUBLIC AGENT ROUTES (for customers) =======
      agents: {
        nearby: 'GET /api/agents/nearby?lat&lng&radius - Find nearby agents',
        by_brand: 'GET /api/agents/brand/:brandId - Get agents by brand',
        brands_with_counts: 'GET /api/agents/brands-with-agent-counts - Get brands with agent counts',
        update_location: 'PUT /api/agents/update-location - Update user location (auth required)'
      },
      // ======= AUTHENTICATED AGENT ROUTES (agent dashboard) =======
      agent: {
        dashboard_stats: 'GET /api/agent/dashboard/stats - Agent dashboard stats',
        earnings_stats: 'GET /api/agent/earnings/stats - Agent earnings stats',
        recent_orders: 'GET /api/agent/orders/recent - Recent orders',
        profile: 'GET /api/agent/profile - Get agent profile',
        orders: 'GET /api/agent/orders - Get agent orders',
        products: 'GET /api/agent/products - Get agent products',
        earnings: 'GET /api/agent/earnings - Get agent earnings',
        notifications: 'GET /api/agent/notifications - Get notifications',
        support_tickets: 'GET /api/agent/support/tickets - Get support tickets'
      },
      orders: {
        place_order: 'POST /api/orders - Place order',
        my_orders: 'GET /api/orders/customer - Get customer orders',
        agent_orders: 'GET /api/orders/agent - Get agent orders',
        order_details: 'GET /api/orders/:id - Get order details',
        update_status: 'PUT /api/orders/agent/:id/status - Update status',
        cancel_order: 'PUT /api/orders/customer/:id/cancel - Cancel order',
        add_rating: 'POST /api/orders/:id/rating - Add rating'
      },
      location: {
        update_location: 'PUT /api/location/update - Update user location'
      },
      cart: {
        get_cart: 'GET /api/cart - Get cart items',
        add_item: 'POST /api/cart/items - Add item to cart',
        update_item: 'PUT /api/cart/items/:id - Update cart item',
        remove_item: 'DELETE /api/cart/items/:id - Remove from cart',
        clear_cart: 'DELETE /api/cart/clear - Clear cart'
      },
      // ======= PAYMENT ROUTES =======
      payments: {
        initiate: 'POST /api/payments/mpesa/initiate - Initiate M-Pesa payment',
        verify: 'POST /api/payments/mpesa/verify - Verify payment with code',
        status: 'GET /api/payments/status?order_id= - Get payment status'
      },
      system: {
        health: 'GET /health - System health check',
        root: 'GET / - This documentation'
      }
    }
  });
});

// Add this after your other routes but before the 404 handler

// Test payment system
app.get('/api/test/payments', async (req, res) => {
  try {
    console.log('🧪 Testing payment system...');
    
    // Check if Payment model is loaded
    if (!db.Payment) {
      return res.status(500).json({
        success: false,
        message: 'Payment model not loaded in database',
        models: Object.keys(db).filter(key => key !== 'sequelize' && key !== 'Sequelize')
      });
    }
    
    // Count existing payments
    const count = await db.Payment.count();
    
    // Get table info
    const [tableInfo] = await db.sequelize.query(`
      SELECT COUNT(*) as total_payments,
             COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
             COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
             COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM payments;
    `);
    
    // Get recent payments
    const recentPayments = await db.Payment.findAll({
      limit: 3,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'order_id', 'amount', 'status', 'payment_method', 'created_at']
    });
    
    res.json({
      success: true,
      message: 'Payment system is working!',
      payment_model: 'Loaded successfully',
      table_info: tableInfo[0],
      recent_payments: recentPayments,
      endpoints_available: {
        initiate: 'POST /api/payments/mpesa/initiate',
        verify: 'POST /api/payments/mpesa/verify',
        status: 'GET /api/payments/status?order_id=',
        test: 'GET /api/test/payments (this endpoint)'
      }
    });
    
  } catch (error) {
    console.error('❌ Payment test error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment system test failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
// Enhanced health check
app.get('/health', async (req, res) => {
  const healthcheck = {
    success: true,
    status: 'healthy',
    service: 'Mtaani Gas Marketplace API',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };

  try {
    await db.sequelize.authenticate();
    healthcheck.database = 'connected';
  } catch (error) {
    healthcheck.database = 'disconnected';
    healthcheck.status = 'unhealthy';
    healthcheck.success = false;
    healthcheck.error = error.message;
  }

  const statusCode = healthcheck.success ? 200 : 503;
  res.status(statusCode).json(healthcheck);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    requested_url: req.originalUrl,
    available_endpoints: {
      auth: '/api/auth/*',
      products: '/api/products/*',
      orders: '/api/orders/*',
      location: '/api/location/*',
      cart: '/api/cart/*',
      agents: '/api/agents/* (public agent routes)',
      agent: '/api/agent/* (authenticated agent routes)',
      health: '/health',
      docs: '/'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('\x1b[31m❌ Server Error:\x1b[0m', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await syncDatabase();
    
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(70));
      console.log('\x1b[1m\x1b[36m🚀 MTAANI GAS MARKETPLACE BACKEND STARTED\x1b[0m');
      console.log('='.repeat(70));
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🏷️  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(70));
      console.log('\n📋 AVAILABLE ENDPOINTS:');
      console.log('👉 POST /api/auth/register/step1    - Register');
      console.log('👉 POST /api/auth/verify/step2      - Verify + choose role');
      console.log('👉 POST /api/auth/login             - Login');
      console.log('👉 GET  /api/products/gas-brands    - Get gas brands');
      console.log('👉 GET  /api/agents/nearby          - Find nearby agents (Public)');
      console.log('👉 GET  /api/agents/brands-with-agent-counts - Get brands with agent counts');
      console.log('👉 GET  /api/agent/profile          - Get agent profile (Authenticated)');
      console.log('👉 GET  /api/health                 - Health check');
      console.log('='.repeat(70));
      console.log('\n\x1b[32m✅ Server ready!\x1b[0m\n');
    });

  } catch (error) {
    console.error('\x1b[31m❌ Failed to start server:\x1b[0m', error);
    process.exit(1);
  }
};

// Start the server
startServer();