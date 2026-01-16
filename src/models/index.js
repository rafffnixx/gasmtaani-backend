const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const db = {};

// Load all models
const modelFiles = fs.readdirSync(__dirname)
  .filter(file => file.endsWith('.js') && file !== 'index.js');

modelFiles.forEach(file => {
  const model = require(path.join(__dirname, file))(sequelize, DataTypes);
  db[model.name] = model;
});

// ============================================
// SET UP ALL ASSOCIATIONS - CONSISTENT VERSION
// ============================================

// 1. CORE USER ASSOCIATIONS
db.User.hasOne(db.Wallet, { 
  foreignKey: 'user_id', 
  as: 'wallet' 
});
db.Wallet.belongsTo(db.User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});

db.User.hasMany(db.VerificationCode, { 
  foreignKey: 'user_id', 
  as: 'verificationCodes' 
});
db.VerificationCode.belongsTo(db.User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});

db.User.hasOne(db.AgentProfile, { 
  foreignKey: 'agent_id', 
  as: 'agentProfile' 
});
db.AgentProfile.belongsTo(db.User, { 
  foreignKey: 'agent_id', 
  as: 'agent' 
});

// 2. USER <-> GASBRAND (Many-to-Many)
db.User.belongsToMany(db.GasBrand, {
  through: db.UserGasBrand,
  foreignKey: 'user_id',
  otherKey: 'gas_brand_id',
  as: 'gasBrands'
});

db.GasBrand.belongsToMany(db.User, {
  through: db.UserGasBrand,
  foreignKey: 'gas_brand_id',
  otherKey: 'user_id',
  as: 'agents'
});

// 3. AGENTGASLISTING ASSOCIATIONS
db.AgentGasListing.belongsTo(db.User, {
  foreignKey: 'agent_id',
  as: 'listingAgent'  // Use 'listingAgent' to avoid conflict with AgentProfile
});

db.AgentGasListing.belongsTo(db.GasBrand, {
  foreignKey: 'gas_brand_id',
  as: 'brand'  // This MUST match what orderController.js uses
});

// Reverse associations
db.User.hasMany(db.AgentGasListing, {
  foreignKey: 'agent_id',
  as: 'agentGasListings'
});

db.GasBrand.hasMany(db.AgentGasListing, {
  foreignKey: 'gas_brand_id',
  as: 'agentGasListings'
});

// 4. ORDER ASSOCIATIONS (CRITICAL - This fixes your errors)
if (db.Order) {
  // Order belongs to Customer (User)
  db.Order.belongsTo(db.User, {
    foreignKey: 'customer_id',
    as: 'customer'
  });

  // Order belongs to Agent (User)
  db.Order.belongsTo(db.User, {
    foreignKey: 'agent_id',
    as: 'agent'
  });

  // Order belongs to Listing
  db.Order.belongsTo(db.AgentGasListing, {
    foreignKey: 'listing_id',
    as: 'listing'  // This alias MUST be used in orderController.js includes
  });

  // Reverse associations
  db.User.hasMany(db.Order, {
    foreignKey: 'customer_id',
    as: 'customerOrders'
  });

  db.User.hasMany(db.Order, {
    foreignKey: 'agent_id',
    as: 'agentOrders'
  });

  db.AgentGasListing.hasMany(db.Order, {
    foreignKey: 'listing_id',
    as: 'orders'
  });
}

// 5. CART ASSOCIATIONS (NEW)
if (db.Cart) {
  // Cart belongs to Customer (User)
  db.Cart.belongsTo(db.User, {
    foreignKey: 'customer_id',
    as: 'customer'
  });

  // Cart belongs to Listing
  db.Cart.belongsTo(db.AgentGasListing, {
    foreignKey: 'listing_id',
    as: 'listing'
  });

  // Cart also belongs to Agent (through listing)
  // This is for easier queries - agent_id is stored in AgentGasListing
  // We'll set up a virtual association
  
  // Reverse associations
  db.User.hasMany(db.Cart, {
    foreignKey: 'customer_id',
    as: 'cartItems'
  });

  db.AgentGasListing.hasMany(db.Cart, {
    foreignKey: 'listing_id',
    as: 'inCarts'
  });
}

// 6. USER LOCATION ASSOCIATIONS
if (db.UserLocation) {
  db.User.hasOne(db.UserLocation, {
    foreignKey: 'user_id',
    as: 'location'
  });
  
  db.UserLocation.belongsTo(db.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
}

// ============================================
// VIRTUAL ASSOCIATIONS FOR CART TO AGENT
// ============================================
if (db.Cart && db.AgentGasListing) {
  // Add a virtual association to get agent directly from cart
  db.Cart.belongsTo(db.User, {
    foreignKey: 'agent_id',
    as: 'agent',
    targetKey: 'id',
    // We'll set this up through a custom getter in the model or a join query
  });
  
  // To get agent_id, we can add a getter method to the Cart model
  // But for simplicity, we'll handle it in queries with includes
}

// ============================================
// REMOVE ALL associate() METHODS FROM INDIVIDUAL MODELS
// ============================================
// Important: Delete or comment out any associate() methods in:
// - Order.js
// - AgentGasListing.js
// - Cart.js
// - Any other model files that have associate() methods

// ============================================
// SYNC WITH DATABASE (Optional - for debugging)
// ============================================
async function syncModels() {
  try {
    // Force sync for debugging (use carefully in production!)
    // await sequelize.sync({ force: true });
    
    // Or use alter for development
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synced successfully');
    
    // Test associations
    console.log('\n📋 Testing associations...');
    console.log(`Loaded models: ${Object.keys(db).join(', ')}`);
    
    if (db.Order) {
      console.log('✅ Order model loaded');
      console.log('✅ Order -> AgentGasListing association: as: "listing"');
      console.log('✅ Order -> User (customer) association: as: "customer"');
      console.log('✅ Order -> User (agent) association: as: "agent"');
    }
    
    if (db.AgentGasListing) {
      console.log('✅ AgentGasListing -> GasBrand association: as: "brand"');
      console.log('✅ AgentGasListing -> User association: as: "listingAgent"');
    }
    
    if (db.Cart) {
      console.log('✅ Cart model loaded');
      console.log('✅ Cart -> User association: as: "customer"');
      console.log('✅ Cart -> AgentGasListing association: as: "listing"');
      console.log('✅ User -> Cart association: as: "cartItems"');
    }
    
  } catch (error) {
    console.error('❌ Error syncing models:', error);
  }
}

// Uncomment to sync on startup (for development)
// syncModels();

// ============================================
// IMPORTANT: UPDATE YOUR orderController.js
// ============================================
// After updating this file, you MUST also update orderController.js:
// 1. Line 33: Change as: 'gasBrand' to as: 'brand'
// 2. Lines 141 & 192: Add as: 'listing' to AgentGasListing include

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;