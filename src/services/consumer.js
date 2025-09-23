const { 
  readFromStream, 
  readFromStreams, 
  STREAMS, 
  EVENT_TYPES 
} = require('../utils/streamUtils');
const { Event } = require('../models');

/**
 * Consumer Service for Redis Streams
 * Handles processing events from various streams
 */
class ConsumerService {
  constructor(consumerId = 'default-consumer') {
    this.consumerId = consumerId;
    this.isRunning = false;
    this.processedMessages = new Set();
  }

  /**
   * Start consuming from a single stream
   * @param {string} streamName - Name of the stream to consume from
   * @param {string} startId - Starting message ID
   * @param {number} batchSize - Number of messages to process at once
   * @param {number} pollInterval - Polling interval in milliseconds
   */
  async startConsuming(streamName, startId = '0', batchSize = 10, pollInterval = 1000) {
    this.isRunning = true;
    console.log(`🚀 Starting consumer ${this.consumerId} for stream ${streamName}`);

    while (this.isRunning) {
      try {
        const messages = await readFromStream(streamName, startId, batchSize);
        
        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages) {
            for (const [messageId, fields] of streamMessages) {
              if (!this.processedMessages.has(messageId)) {
                await this.processMessage(stream, messageId, fields);
                this.processedMessages.add(messageId);
                startId = messageId; // Update start ID for next poll
              }
            }
          }
        } else {
          // No new messages, wait before polling again
          await this.sleep(pollInterval);
        }
      } catch (error) {
        console.error(`❌ Error in consumer ${this.consumerId}:`, error);
        await this.sleep(pollInterval);
      }
    }
  }

  /**
   * Start consuming from multiple streams
   * @param {Array} streams - Array of {name, id} objects
   * @param {number} batchSize - Number of messages to process at once
   * @param {number} pollInterval - Polling interval in milliseconds
   */
  async startConsumingMultiple(streams, batchSize = 10, pollInterval = 1000) {
    this.isRunning = true;
    console.log(`🚀 Starting consumer ${this.consumerId} for multiple streams`);

    while (this.isRunning) {
      try {
        const messages = await readFromStreams(streams, batchSize);
        
        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages) {
            for (const [messageId, fields] of streamMessages) {
              if (!this.processedMessages.has(messageId)) {
                await this.processMessage(stream, messageId, fields);
                this.processedMessages.add(messageId);
                
                // Update the start ID for this stream
                const streamIndex = streams.findIndex(s => s.name === stream);
                if (streamIndex !== -1) {
                  streams[streamIndex].id = messageId;
                }
              }
            }
          }
        } else {
          await this.sleep(pollInterval);
        }
      } catch (error) {
        console.error(`❌ Error in consumer ${this.consumerId}:`, error);
        await this.sleep(pollInterval);
      }
    }
  }

  /**
   * Process a single message
   * @param {string} streamName - Name of the stream
   * @param {string} messageId - Message ID
   * @param {Array} fields - Message fields
   */
  async processMessage(streamName, messageId, fields) {
    try {
      // Parse message fields
      const messageData = this.parseMessageFields(fields);
      const { eventType, payload } = messageData;

      console.log(`📥 Processing message ${messageId} from ${streamName}: ${eventType}`);

      // Save event to database
      await this.saveEventToDatabase(streamName, messageId, eventType, payload);

      // Process based on event type
      await this.handleEvent(eventType, payload, streamName, messageId);

      console.log(`✅ Successfully processed message ${messageId}`);
    } catch (error) {
      console.error(`❌ Error processing message ${messageId}:`, error);
      await this.handleProcessingError(streamName, messageId, error);
    }
  }

  /**
   * Parse message fields into structured data
   * @param {Array} fields - Raw message fields
   * @returns {Object} Parsed message data
   */
  parseMessageFields(fields) {
    const data = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }

    return {
      eventType: data.eventType,
      payload: JSON.parse(data.payload || '{}'),
      timestamp: parseInt(data.timestamp) || Date.now(),
      id: data.id
    };
  }

  /**
   * Save event to database
   * @param {string} streamName - Stream name
   * @param {string} messageId - Message ID
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   */
  async saveEventToDatabase(streamName, messageId, eventType, payload) {
    try {
      // Extract userId from payload if available
      const userId = payload.userId || null;
      
      await Event.create({
        streamId: messageId,
        eventType,
        payload,
        processed: false,
        consumerId: this.consumerId,
        userId: userId
      });
    } catch (error) {
      console.error('❌ Error saving event to database:', error);
      throw error;
    }
  }

  /**
   * Handle different event types
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @param {string} streamName - Stream name
   * @param {string} messageId - Message ID
   */
  async handleEvent(eventType, payload, streamName, messageId) {
    switch (eventType) {
      case EVENT_TYPES.USER_CREATED:
        await this.handleUserCreated(payload);
        break;
      case EVENT_TYPES.USER_UPDATED:
        await this.handleUserUpdated(payload);
        break;
      case EVENT_TYPES.USER_DELETED:
        await this.handleUserDeleted(payload);
        break;
      case EVENT_TYPES.MESSAGE_SENT:
        await this.handleMessageSent(payload);
        break;
      case EVENT_TYPES.TASK_CREATED:
        await this.handleTaskCreated(payload);
        break;
      case EVENT_TYPES.TASK_COMPLETED:
        await this.handleTaskCompleted(payload);
        break;
      case EVENT_TYPES.SYSTEM_ERROR:
        await this.handleSystemError(payload);
        break;
      case EVENT_TYPES.SYSTEM_INFO:
        await this.handleSystemInfo(payload);
        break;
      default:
        console.log(`ℹ️ Unknown event type: ${eventType}`);
    }

    // Mark event as processed in database
    await this.markEventAsProcessed(messageId);
  }

  /**
   * Handle user created event
   * @param {Object} payload - Event payload
   */
  async handleUserCreated(payload) {
    console.log(`👤 User created: ${payload.username} (${payload.email})`);
    // Add your business logic here
    // e.g., send welcome email, create user profile, etc.
  }

  /**
   * Handle user updated event
   * @param {Object} payload - Event payload
   */
  async handleUserUpdated(payload) {
    console.log(`👤 User updated: ${payload.username}`);
    console.log(`📝 Changes:`, payload.changes);
    // Add your business logic here
  }

  /**
   * Handle user deleted event
   * @param {Object} payload - Event payload
   */
  async handleUserDeleted(payload) {
    console.log(`👤 User deleted: ${payload.username}`);
    // Add your business logic here
    // e.g., cleanup user data, send notification, etc.
  }

  /**
   * Handle message sent event
   * @param {Object} payload - Event payload
   */
  async handleMessageSent(payload) {
    console.log(`💬 Message sent from ${payload.senderId} to ${payload.receiverId}`);
    console.log(`📄 Content: ${payload.content}`);
    // Add your business logic here
    // e.g., real-time notifications, message indexing, etc.
  }

  /**
   * Handle task created event
   * @param {Object} payload - Event payload
   */
  async handleTaskCreated(payload) {
    console.log(`📋 Task created: ${payload.title}`);
    console.log(`👤 Assigned to: ${payload.assignedTo}`);
    // Add your business logic here
    // e.g., send notification to assignee, update dashboard, etc.
  }

  /**
   * Handle task completed event
   * @param {Object} payload - Event payload
   */
  async handleTaskCompleted(payload) {
    console.log(`✅ Task completed: ${payload.taskId}`);
    console.log(`👤 Completed by: ${payload.completedBy}`);
    // Add your business logic here
    // e.g., update project status, send completion notification, etc.
  }

  /**
   * Handle system error event
   * @param {Object} payload - Event payload
   */
  async handleSystemError(payload) {
    console.error(`🚨 System Error: ${payload.message}`);
    console.error(`📊 Metadata:`, payload.metadata);
    // Add your business logic here
    // e.g., alert monitoring system, log to external service, etc.
  }

  /**
   * Handle system info event
   * @param {Object} payload - Event payload
   */
  async handleSystemInfo(payload) {
    console.log(`ℹ️ System Info: ${payload.message}`);
    // Add your business logic here
  }

  /**
   * Mark event as processed in database
   * @param {string} messageId - Message ID
   */
  async markEventAsProcessed(messageId) {
    try {
      await Event.update(
        { 
          processed: true, 
          processedAt: new Date() 
        },
        { 
          where: { streamId: messageId } 
        }
      );
    } catch (error) {
      console.error('❌ Error marking event as processed:', error);
    }
  }

  /**
   * Handle processing error
   * @param {string} streamName - Stream name
   * @param {string} messageId - Message ID
   * @param {Error} error - Error object
   */
  async handleProcessingError(streamName, messageId, error) {
    try {
      await Event.update(
        { 
          error: error.message,
          processedAt: new Date()
        },
        { 
          where: { streamId: messageId } 
        }
      );
    } catch (dbError) {
      console.error('❌ Error updating event with error:', dbError);
    }
  }

  /**
   * Stop the consumer
   */
  stop() {
    console.log(`🛑 Stopping consumer ${this.consumerId}`);
    this.isRunning = false;
  }

  /**
   * Sleep utility function
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ConsumerService;
