// src/models/Withdrawal.js
module.exports = (sequelize, DataTypes) => {
  const Withdrawal = sequelize.define('Withdrawal', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    agent_id: {
      type: DataTypes.UUID,
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
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending'
    },
    payment_method: {
      type: DataTypes.ENUM('mpesa', 'bank_transfer', 'cash'),
      allowNull: false
    },
    account_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    account_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bank_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    branch_code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    swift_code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: true
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'withdrawals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Withdrawal.associate = (models) => {
    Withdrawal.belongsTo(models.User, {
      foreignKey: 'agent_id',
      as: 'agent'
    });
  };

  return Withdrawal;
};