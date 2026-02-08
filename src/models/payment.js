// /src/models/payment.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      }
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
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    payment_method: {
      type: DataTypes.ENUM('mpesa', 'cash', 'card', 'bank_transfer'),
      defaultValue: 'mpesa',
      allowNull: false
    },
    verification_code: {
      type: DataTypes.STRING(6),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled', 'expired'),
      defaultValue: 'pending',
      allowNull: false
    },
    transaction_type: {
      type: DataTypes.ENUM('checkout', 'stk_push', 'c2b', 'b2c', 'reversal'),
      defaultValue: 'checkout',
      allowNull: false
    },
    merchant_request_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    checkout_request_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    transaction_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true
    },
    mpesa_receipt_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true
    },
    verification_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    last_attempt_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'payments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeCreate: (payment) => {
        // Format phone number if needed
        if (payment.phone_number && !payment.phone_number.startsWith('254')) {
          if (payment.phone_number.startsWith('0')) {
            payment.phone_number = '254' + payment.phone_number.substring(1);
          } else if (payment.phone_number.startsWith('+254')) {
            payment.phone_number = payment.phone_number.substring(1);
          } else if (payment.phone_number.length === 9) {
            payment.phone_number = '254' + payment.phone_number;
          }
        }
        
        // Set default expiry (10 minutes from now)
        if (!payment.expires_at) {
          const expiresAt = new Date();
          expiresAt.setMinutes(expiresAt.getMinutes() + 10);
          payment.expires_at = expiresAt;
        }
        
        // Generate verification code if not provided
        if (!payment.verification_code) {
          payment.verification_code = Math.floor(100000 + Math.random() * 900000).toString();
        }
      }
    }
  });

  return Payment;
};