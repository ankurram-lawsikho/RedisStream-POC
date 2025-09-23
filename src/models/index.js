const { sequelize } = require('../config/database');
const Event = require('./Event');
const User = require('./User');

// Initialize models
const models = {
  Event,
  User
};

// Define associations
User.hasMany(Event, { foreignKey: 'userId', as: 'events' });
Event.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Sync database
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synchronized successfully.');
  } catch (error) {
    console.error('❌ Error synchronizing database models:', error);
  }
};

module.exports = {
  ...models,
  sequelize,
  syncDatabase
};
