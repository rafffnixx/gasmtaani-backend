// src/models/UserGasBrand.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserGasBrand = sequelize.define('UserGasBrand', {
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
    gas_brand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'gas_brands',
        key: 'id'
      }
    }
  }, {
    tableName: 'user_gas_brands',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // No associate method here - associations will be defined in index.js
  return UserGasBrand;
};