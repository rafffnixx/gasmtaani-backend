// server.js - CLEANED AND FIXED VERSION
const express = require('express');
const cookieParser = require('cookie-parser');
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
    await db.sequelize.authenticate();
    console.log('\x1b[32m✅ Database connection established\x1b[0m');
    
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
// MIDDLEWARE - SINGLE CORS CONFIG
// ============================================================

// ✅ SINGLE CORS CONFIGURATION - FIXED
const corsOptions = {
  origin: ['http://localhost:19006', 'http://localhost:3000', 'http://10.0.2.2:19006'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions)); // ✅ ONE CORS MIDDLEWARE
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\x1b[90m[${timestamp}] ${req.method} ${req.path}\x1b[0m`);
  next();
});

// ============================================================
// ROUTES IMPORT
// ============================================================

const authRoutes = require('./src/routes/auth.routes');
const productRoutes = require('./src/routes/products.routes');
const orderRoutes = require('./src/routes/order.routes');
const locationRoutes = require('./src/routes/location.routes');
const cartRoutes = require('./src/routes/cart.routes');
const paymentRoutes = require('./src/routes/payment.routes');
const agentsPublicRoutes = require('./src/routes/agents.routes');
const agentDashboardRoutes = require('./src/routes/agent.routes');
const earningsRoutes = require('./src/routes/earnings.routes');

// ============================================================
// ROUTES - SINGLE DEFINITION
// ============================================================

// ✅ ROOT ENDPOINT - SINGLE VERSION
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Mtaani Gas Marketplace API is running!',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register_step1: 'POST /api/auth/register/step1',
        verify_step2: 'POST /api/auth/verify/step2',
        login: 'POST /api/auth/login',
        resend_verification: 'POST /api/auth/resend-verification',
        profile: 'GET /api/auth/profile',
        logout: 'POST /api/auth/logout'
      },
      products: {
        gas_brands: 'GET /api/products/gas-brands',
        brand_sizes: 'GET /api/products/brand/:id/sizes',
        search_agents: 'GET /api/products/brand/:id/size/:size/agents',
        search: 'GET /api/products/search',
        details: 'GET /api/products/:id'
      },
      agents_public: {
        nearby: 'GET /api/agents/nearby',
        by_brand: 'GET /api/agents/brand/:brandId',
        brands_with_counts: 'GET /api/agents/brands-with-agent-counts'
      },
      agent_dashboard: {
        profile: 'GET /api/agent/profile',
        stats: 'GET /api/agent/dashboard/stats',
        orders: 'GET /api/agent/orders',
        products: 'GET /api/agent/products',
        earnings: 'GET /api/agent/earnings',
        gas_brands: 'GET /api/agent/gas-brands'
      },
      orders: {
        place_order: 'POST /api/orders',
        my_orders: 'GET /api/orders/customer',
        agent_orders: 'GET /api/orders/agent',
        order_details: 'GET /api/orders/:id',
        update_status: 'PUT /api/orders/agent/:id/status',
        cancel_order: 'PUT /api/orders/customer/:id/cancel',
        add_rating: 'POST /api/orders/:id/rating'
      },
      location: {
        update_location: 'PUT /api/location/update'
      },
      cart: {
        get_cart: 'GET /api/cart',
        add_item: 'POST /api/cart/items',
        update_item: 'PUT /api/cart/items/:id',
        remove_item: 'DELETE /api/cart/items/:id',
        clear_cart: 'DELETE /api/cart/clear'
      },
      payments: {
        initiate: 'POST /api/payments/mpesa/initiate',
        verify: 'POST /api/payments/mpesa/verify',
        status: 'GET /api/payments/status'
      },
      system: {
        health: 'GET /health',
        test: 'GET /api/test',
        test_payments: 'GET /api/test/payments'
      }
    }
  });
});

// ✅ API ROUTES - SINGLE MOUNT
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/agents', agentsPublicRoutes);
app.use('/api/agent', agentDashboardRoutes);
app.use('/api/earnings', earningsRoutes);

// ✅ TEST ROUTE
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
      agent: '/api/agent/* (authenticated)',
      payments: '/api/payments/*'
    }
  });
});

// ============================================================
// DEBUG ROUTES - FIXED VERSION (No ? in path)
// ============================================================

// Debug: Get all users (limit 10)
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await db.User.findAll({
      attributes: ['id', 'email', 'full_name', 'user_type', 'is_verified', 'is_active', 'business_name'],
      limit: 10
    });
    
    res.json({
      success: true,
      users: users,
      count: users.length,
      note: 'Debug endpoint - remove in production'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug: Get user by ID
app.get('/api/debug/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const user = await db.User.findByPk(userId, {
      attributes: ['id', 'email', 'full_name', 'user_type', 'is_verified', 'is_active', 'business_name']
    });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({
      success: true,
      user: user,
      note: 'Debug endpoint - remove in production'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug: Make user an agent
app.post('/api/debug/make-agent/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const user = await db.User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    await user.update({ 
      user_type: 'agent',
      is_verified: true,
      is_active: true
    });
    
    res.json({
      success: true,
      message: `User ${userId} is now an agent`,
      user: {
        id: user.id,
        email: user.email,
        user_type: user.user_type
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug: Check database tables
app.get('/api/debug/tables', async (req, res) => {
  try {
    const tables = await db.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
      { type: db.sequelize.QueryTypes.SELECT }
    );
    
    res.json({
      success: true,
      tables: tables.map(t => t.table_name || t.TABLE_NAME),
      count: tables.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ PAYMENT TEST ROUTE
app.get('/api/test/payments', async (req, res) => {
  try {
    console.log('🧪 Testing payment system...');
    
    if (!db.Payment) {
      return res.status(500).json({
        success: false,
        message: 'Payment model not loaded',
        models: Object.keys(db).filter(key => key !== 'sequelize' && key !== 'Sequelize')
      });
    }
    
    const count = await db.Payment.count();
    
    const [tableInfo] = await db.sequelize.query(`
      SELECT COUNT(*) as total_payments,
             COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
             COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
             COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM payments;
    `);
    
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
      recent_payments: recentPayments
    });
    
  } catch (error) {
    console.error('❌ Payment test error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment system test failed',
      error: error.message
    });
  }
});

// ✅ HEALTH CHECK
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

  res.status(healthcheck.success ? 200 : 503).json(healthcheck);
});

// ✅ 404 HANDLER
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
      agents: '/api/agents/* (public)',
      agent: '/api/agent/* (authenticated)',
      payments: '/api/payments/*',
      health: '/health',
      docs: '/'
    }
  });
});

// ✅ ERROR HANDLER
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
      console.log('👉 POST /api/auth/login             - Login');
      console.log('👉 GET  /api/auth/profile           - Get profile');
      console.log('👉 GET  /api/agent/profile          - Agent profile');
      console.log('👉 GET  /api/agent/gas-brands       - Agent gas brands');
      console.log('👉 GET  /api/products/gas-brands    - Get gas brands');
      console.log('👉 GET  /api/agents/nearby          - Find nearby agents');
      console.log('👉 GET  /api/health                 - Health check');
      console.log('👉 GET  /api/debug/users            - List users (debug)');
      console.log('👉 GET  /api/debug/user/:id         - Get user by ID (debug)');
      console.log('👉 POST /api/debug/make-agent/:id   - Make user agent (debug)');
      console.log('='.repeat(70));
      console.log('\n\x1b[32m✅ Server ready!\x1b[0m\n');
    });

  } catch (error) {
    console.error('\x1b[31m❌ Failed to start server:\x1b[0m', error);
    process.exit(1);
  }
};

startServer();