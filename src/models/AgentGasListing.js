const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AgentGasListing = sequelize.define('AgentGasListing', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    agent_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    gas_brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'gas_brands',
        key: 'id'
      }
    },
    size: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    selling_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    available_quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    is_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    cylinder_condition: {
      type: DataTypes.ENUM('new', 'refilled', 'exchange'),
      defaultValue: 'refilled'
    },
    delivery_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    delivery_fee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    delivery_hours: {
      type: DataTypes.INTEGER
    },
    is_approved: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0
    },
    total_orders: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    original_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'agent_gas_listings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // REMOVE associate method completely - handle in index.js only
  // AgentGasListing.associate = function(models) {
  //   // Remove this
  // };

  return AgentGasListing;
};