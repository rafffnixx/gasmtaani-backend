const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    order_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    agent_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    listing_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'agent_gas_listings',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 }
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    grand_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    delivery_fee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    delivery_address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    delivery_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    delivery_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'confirmed',
        'processing',
        'dispatched',
        'delivered',
        'cancelled',
        'refunded'
      ),
      defaultValue: 'pending'
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    payment_method: {
      type: DataTypes.ENUM('wallet', 'mpesa', 'cash', 'card', 'cash_on_delivery'),
      defaultValue: 'cash_on_delivery'
    },
    estimated_delivery_time: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    actual_delivery_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    customer_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    agent_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    review: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeCreate: async (order) => {
        // Generate order number if not provided
        if (!order.order_number) {
          const date = new Date();
          const year = date.getFullYear().toString().slice(-2);
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          const random = Math.floor(1000 + Math.random() * 9000);
          order.order_number = `ORD${year}${month}${day}${random}`;
        }
        
        // Ensure grand_total is calculated if not provided
        if (order.total_price && order.delivery_fee && !order.grand_total) {
          const totalPrice = parseFloat(order.total_price) || 0;
          const deliveryFee = parseFloat(order.delivery_fee) || 0;
          order.grand_total = totalPrice + deliveryFee;
        }
      }
    }
  });

  // Associations
  Order.associate = function(models) {
    // Order belongs to customer (User)
    Order.belongsTo(models.User, {
      foreignKey: 'customer_id',
      as: 'customer'
    });

    // Order belongs to agent (User)
    Order.belongsTo(models.User, {
      foreignKey: 'agent_id',
      as: 'agent'
    });

    // Order belongs to listing
    Order.belongsTo(models.AgentGasListing, {
      foreignKey: 'listing_id',
      as: 'listing'
    });
  };

  return Order;
};