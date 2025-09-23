const { addToStream, STREAMS, EVENT_TYPES } = require('../utils/streamUtils');
const { User } = require('../models');

/**
 * Producer Service for Redis Streams
 * Handles publishing events to various streams
 */
class ProducerService {
  /**
   * Publish user creation event
   * @param {Object} userData - User data
   * @returns {Promise<string>} Message ID
   */
  static async publishUserCreated(userData) {
    const payload = {
      userId: userData.id,
      username: userData.username,
      email: userData.email,
      status: userData.status,
      createdAt: userData.createdAt
    };

    return await addToStream(
      STREAMS.USER_EVENTS,
      EVENT_TYPES.USER_CREATED,
      payload
    );
  }

  /**
   * Publish user update event
   * @param {Object} userData - Updated user data
   * @param {Object} changes - What changed
   * @returns {Promise<string>} Message ID
   */
  static async publishUserUpdated(userData, changes) {
    const payload = {
      userId: userData.id,
      username: userData.username,
      email: userData.email,
      status: userData.status,
      changes,
      updatedAt: userData.updatedAt
    };

    return await addToStream(
      STREAMS.USER_EVENTS,
      EVENT_TYPES.USER_UPDATED,
      payload
    );
  }

  /**
   * Publish user deletion event
   * @param {string} userId - User ID
   * @param {string} username - Username
   * @returns {Promise<string>} Message ID
   */
  static async publishUserDeleted(userId, username) {
    const payload = {
      userId,
      username,
      deletedAt: new Date().toISOString()
    };

    return await addToStream(
      STREAMS.USER_EVENTS,
      EVENT_TYPES.USER_DELETED,
      payload
    );
  }

  /**
   * Publish chat message event
   * @param {Object} messageData - Message data
   * @returns {Promise<string>} Message ID
   */
  static async publishChatMessage(messageData) {
    const payload = {
      messageId: messageData.id,
      senderId: messageData.senderId,
      receiverId: messageData.receiverId,
      content: messageData.content,
      roomId: messageData.roomId,
      timestamp: messageData.timestamp
    };

    return await addToStream(
      STREAMS.CHAT_MESSAGES,
      EVENT_TYPES.MESSAGE_SENT,
      payload
    );
  }

  /**
   * Publish task creation event
   * @param {Object} taskData - Task data
   * @returns {Promise<string>} Message ID
   */
  static async publishTaskCreated(taskData) {
    const payload = {
      taskId: taskData.id,
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority,
      assignedTo: taskData.assignedTo,
      createdBy: taskData.createdBy,
      dueDate: taskData.dueDate
    };

    return await addToStream(
      STREAMS.TASK_QUEUE,
      EVENT_TYPES.TASK_CREATED,
      payload
    );
  }

  /**
   * Publish task completion event
   * @param {string} taskId - Task ID
   * @param {string} completedBy - User who completed the task
   * @param {string} completionNotes - Optional completion notes
   * @returns {Promise<string>} Message ID
   */
  static async publishTaskCompleted(taskId, completedBy, completionNotes = '') {
    const payload = {
      taskId,
      completedBy,
      completionNotes,
      completedAt: new Date().toISOString()
    };

    return await addToStream(
      STREAMS.TASK_QUEUE,
      EVENT_TYPES.TASK_COMPLETED,
      payload
    );
  }

  /**
   * Publish system log event
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<string>} Message ID
   */
  static async publishSystemLog(level, message, metadata = {}) {
    const payload = {
      level,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      service: 'redis-streams-poc'
    };

    const eventType = level === 'error' ? EVENT_TYPES.SYSTEM_ERROR : EVENT_TYPES.SYSTEM_INFO;

    return await addToStream(
      STREAMS.SYSTEM_LOGS,
      eventType,
      payload
    );
  }

  /**
   * Publish custom event
   * @param {string} streamName - Stream name
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @returns {Promise<string>} Message ID
   */
  static async publishCustomEvent(streamName, eventType, payload) {
    return await addToStream(streamName, eventType, payload);
  }

  /**
   * Batch publish multiple events
   * @param {Array} events - Array of {streamName, eventType, payload} objects
   * @returns {Promise<Array>} Array of message IDs
   */
  static async batchPublish(events) {
    const promises = events.map(event => 
      addToStream(event.streamName, event.eventType, event.payload)
    );
    
    return await Promise.all(promises);
  }
}

module.exports = ProducerService;
