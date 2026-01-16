module.exports = (sequelize, DataTypes) => {
  const VerificationCode = sequelize.define('VerificationCode', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    code: {
      type: DataTypes.STRING(6),
      allowNull: false,
      validate: {
        len: [6, 6]
      }
    },
    type: {
      type: DataTypes.ENUM('phone_verification', 'email_verification', 'password_reset'),
      defaultValue: 'phone_verification'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      // CRITICAL: Force UTC handling
      get() {
        const rawValue = this.getDataValue('expires_at');
        if (!rawValue) return null;
        
        // Always return as UTC Date object
        const date = new Date(rawValue);
        // If the date looks like it might be in local time, adjust to UTC
        const dateString = date.toString();
        if (dateString.includes('EAT') || dateString.includes('+03:00')) {
          // This is in East Africa Time, convert to UTC
          return new Date(date.getTime() - (3 * 60 * 60 * 1000));
        }
        return date;
      },
      set(value) {
        // Always store as UTC
        let dateValue;
        if (value instanceof Date) {
          dateValue = value;
        } else if (typeof value === 'string') {
          dateValue = new Date(value);
        } else {
          dateValue = new Date();
        }
        
        // Ensure it's stored as UTC
        this.setDataValue('expires_at', dateValue.toISOString());
      }
    },
    is_used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    }
  }, {
    tableName: 'verification_codes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    
    // Hooks to ensure UTC consistency
    hooks: {
      beforeCreate: (verificationCode) => {
        // Ensure expires_at is stored as UTC
        if (verificationCode.expires_at) {
          const date = new Date(verificationCode.expires_at);
          verificationCode.expires_at = date.toISOString();
        }
      },
      beforeUpdate: (verificationCode) => {
        // Ensure expires_at is stored as UTC
        if (verificationCode.expires_at && verificationCode.changed('expires_at')) {
          const date = new Date(verificationCode.expires_at);
          verificationCode.expires_at = date.toISOString();
        }
      },
      afterFind: (results) => {
        // Ensure all dates are in UTC when retrieved
        if (!results) return;
        
        const processDate = (item) => {
          if (item.expires_at) {
            item.expires_at = new Date(item.expires_at);
          }
          if (item.created_at) {
            item.created_at = new Date(item.created_at);
          }
          if (item.updated_at) {
            item.updated_at = new Date(item.updated_at);
          }
        };
        
        if (Array.isArray(results)) {
          results.forEach(processDate);
        } else {
          processDate(results);
        }
      }
    },
    
    // Scopes for easier querying
    defaultScope: {
      attributes: {
        exclude: ['created_at', 'updated_at'] // We'll handle these manually
      }
    },
    scopes: {
      active: {
        where: {
          is_used: false,
          expires_at: {
            [sequelize.Sequelize.Op.gt]: new Date()
          }
        }
      },
      expired: {
        where: {
          expires_at: {
            [sequelize.Sequelize.Op.lt]: new Date()
          }
        }
      },
      unused: {
        where: {
          is_used: false
        }
      }
    }
  });

  // Instance methods
  VerificationCode.prototype.isExpired = function() {
    const now = new Date();
    const expiresAt = new Date(this.expires_at);
    return expiresAt < now;
  };

  VerificationCode.prototype.isValid = function() {
    return !this.is_used && !this.isExpired();
  };

  VerificationCode.prototype.markAsUsed = async function() {
    this.is_used = true;
    return this.save();
  };

  VerificationCode.prototype.incrementAttempts = async function() {
    this.attempts += 1;
    return this.save();
  };

  return VerificationCode;
};