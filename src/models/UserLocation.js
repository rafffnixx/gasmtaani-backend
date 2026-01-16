const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserLocation = sequelize.define('UserLocation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT
    },
    area_name: {
      type: DataTypes.STRING(100)
    },
    town: {
      type: DataTypes.STRING(100)
    },
    county: {
      type: DataTypes.STRING(100)
    }
  }, {
    tableName: 'user_locations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return UserLocation;
};
