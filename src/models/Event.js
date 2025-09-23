const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  streamId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'stream_id'
  },
  eventType: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'event_type'
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  processedAt: {
    type: DataTypes.DATE,
    field: 'processed_at'
  },
  consumerId: {
    type: DataTypes.STRING,
    field: 'consumer_id'
  },
  userId: {
    type: DataTypes.UUID,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  error: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'events',
  timestamps: true,
  indexes: [
    {
      fields: ['stream_id']
    },
    {
      fields: ['event_type']
    },
    {
      fields: ['processed']
    },
    {
      fields: ['user_id']
    }
  ]
});

module.exports = Event;
