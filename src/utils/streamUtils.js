const { redis } = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

// Stream names
const STREAMS = {
  USER_EVENTS: 'user:events',
  CHAT_MESSAGES: 'chat:messages',
  TASK_QUEUE: 'task:queue',
  SYSTEM_LOGS: 'system:logs'
};

// Event types
const EVENT_TYPES = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  MESSAGE_SENT: 'message.sent',
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  SYSTEM_ERROR: 'system.error',
  SYSTEM_INFO: 'system.info'
};

/**
 * Add an event to a Redis Stream
 * @param {string} streamName - Name of the stream
 * @param {string} eventType - Type of event
 * @param {Object} payload - Event payload
 * @param {string} id - Optional message ID (defaults to '*')
 * @returns {Promise<string>} Message ID
 */
const addToStream = async (streamName, eventType, payload, id = '*') => {
  try {
    const messageId = await redis.xadd(
      streamName,
      id,
      'eventType', eventType,
      'payload', JSON.stringify(payload),
      'timestamp', Date.now(),
      'id', uuidv4()
    );
    
    console.log(`📤 Added event to stream ${streamName}: ${eventType} (ID: ${messageId})`);
    return messageId;
  } catch (error) {
    console.error(`❌ Error adding to stream ${streamName}:`, error);
    throw error;
  }
};

/**
 * Read from a Redis Stream
 * @param {string} streamName - Name of the stream
 * @param {string} startId - Starting message ID ('0' for beginning, '$' for new messages)
 * @param {number} count - Maximum number of messages to read
 * @returns {Promise<Array>} Array of messages
 */
const readFromStream = async (streamName, startId = '0', count = 10) => {
  try {
    const result = await redis.xread('COUNT', count, 'STREAMS', streamName, startId);
    return result || [];
  } catch (error) {
    console.error(`❌ Error reading from stream ${streamName}:`, error);
    throw error;
  }
};

/**
 * Read from multiple streams
 * @param {Array} streams - Array of {name, id} objects
 * @param {number} count - Maximum number of messages per stream
 * @returns {Promise<Array>} Array of stream results
 */
const readFromStreams = async (streams, count = 10) => {
  try {
    // Filter out streams that don't exist
    const existingStreams = [];
    for (const stream of streams) {
      const length = await redis.xlen(stream.name);
      if (length > 0) {
        existingStreams.push(stream);
      }
    }

    if (existingStreams.length === 0) {
      return [];
    }

    const streamArgs = existingStreams.flatMap(s => [s.name, s.id]);
    const result = await redis.xread('COUNT', count, 'STREAMS', ...streamArgs);
    return result || [];
  } catch (error) {
    console.error('❌ Error reading from streams:', error);
    throw error;
  }
};

/**
 * Create a consumer group
 * @param {string} streamName - Name of the stream
 * @param {string} groupName - Name of the consumer group
 * @param {string} startId - Starting message ID
 * @returns {Promise<boolean>} Success status
 */
const createConsumerGroup = async (streamName, groupName, startId = '0') => {
  try {
    await redis.xgroup('CREATE', streamName, groupName, startId, 'MKSTREAM');
    console.log(`✅ Created consumer group ${groupName} for stream ${streamName}`);
    return true;
  } catch (error) {
    if (error.message.includes('BUSYGROUP')) {
      console.log(`ℹ️ Consumer group ${groupName} already exists for stream ${streamName}`);
      return true;
    }
    console.error(`❌ Error creating consumer group ${groupName}:`, error);
    throw error;
  }
};

/**
 * Read from a consumer group
 * @param {string} streamName - Name of the stream
 * @param {string} groupName - Name of the consumer group
 * @param {string} consumerName - Name of the consumer
 * @param {number} count - Maximum number of messages to read
 * @param {number} blockTime - Block time in milliseconds (0 for no blocking)
 * @returns {Promise<Array>} Array of messages
 */
const readFromConsumerGroup = async (streamName, groupName, consumerName, count = 1, blockTime = 0) => {
  try {
    const result = await redis.xreadgroup(
      'GROUP', groupName, consumerName,
      'COUNT', count,
      'BLOCK', blockTime,
      'STREAMS', streamName, '>'
    );
    return result || [];
  } catch (error) {
    console.error(`❌ Error reading from consumer group ${groupName}:`, error);
    throw error;
  }
};

/**
 * Acknowledge message processing
 * @param {string} streamName - Name of the stream
 * @param {string} groupName - Name of the consumer group
 * @param {string} messageId - Message ID to acknowledge
 * @returns {Promise<number>} Number of acknowledged messages
 */
const acknowledgeMessage = async (streamName, groupName, messageId) => {
  try {
    const result = await redis.xack(streamName, groupName, messageId);
    console.log(`✅ Acknowledged message ${messageId} in group ${groupName}`);
    return result;
  } catch (error) {
    console.error(`❌ Error acknowledging message ${messageId}:`, error);
    throw error;
  }
};

/**
 * Get stream information
 * @param {string} streamName - Name of the stream
 * @returns {Promise<Object>} Stream information
 */
const getStreamInfo = async (streamName) => {
  try {
    const info = await redis.xinfo('STREAM', streamName);
    return info;
  } catch (error) {
    console.error(`❌ Error getting stream info for ${streamName}:`, error);
    throw error;
  }
};

/**
 * Get consumer group information
 * @param {string} streamName - Name of the stream
 * @param {string} groupName - Name of the consumer group
 * @returns {Promise<Object>} Consumer group information
 */
const getConsumerGroupInfo = async (streamName, groupName) => {
  try {
    const info = await redis.xinfo('GROUPS', streamName);
    return info.find(group => group[1] === groupName);
  } catch (error) {
    console.error(`❌ Error getting consumer group info for ${groupName}:`, error);
    throw error;
  }
};

module.exports = {
  STREAMS,
  EVENT_TYPES,
  addToStream,
  readFromStream,
  readFromStreams,
  createConsumerGroup,
  readFromConsumerGroup,
  acknowledgeMessage,
  getStreamInfo,
  getConsumerGroupInfo
};
