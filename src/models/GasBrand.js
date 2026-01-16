const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GasBrand = sequelize.define('GasBrand', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    logo_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'gas_brands',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  // REMOVE any associate method here - handle all associations in index.js
  // GasBrand.associate = function(models) {
  //   // Remove this - it's causing circular dependency
  // };

  return GasBrand;
};