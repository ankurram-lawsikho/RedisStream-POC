const { 
  createConsumerGroup,
  readFromConsumerGroup,
  acknowledgeMessage,
  getStreamInfo,
  getConsumerGroupInfo,
  STREAMS,
  EVENT_TYPES 
} = require('../utils/streamUtils');
const { Event } = require('../models');

/**
 * Consumer Group Service for Redis Streams
 * Provides reliable message processing with consumer groups
 */
class ConsumerGroupService {
  constructor(groupName, consumerName) {
    this.groupName = groupName;
    this.consumerName = consumerName;
    this.isRunning = false;
    this.streams = [];
  }

  /**
   * Initialize consumer group for a stream
   * @param {string} streamName - Name of the stream
   * @param {string} startId - Starting message ID
   */
  async initializeGroup(streamName, startId = '0') {
    try {
      await createConsumerGroup(streamName, this.groupName, startId);
      this.streams.push({ name: streamName, id: '>' });
      console.log(`✅ Initialized consumer group ${this.groupName} for stream ${streamName}`);
    } catch (error) {
      console.error(`❌ Error initializing consumer group:`, error);
      throw error;
    }
  }

  /**
   * Start consuming from consumer group
   * @param {string} streamName - Name of the stream
   * @param {number} batchSize - Number of messages to process at once
   * @param {number} blockTime - Block time in milliseconds
   */
  async startConsuming(streamName, batchSize = 1, blockTime = 1000) {
    this.isRunning = true;
    console.log(`🚀 Starting consumer group ${this.groupName} (${this.consumerName}) for stream ${streamName}`);

    while (this.isRunning) {
      try {
        const messages = await readFromConsumerGroup(
          streamName,
          this.groupName,
          this.consumerName,
          batchSize,
          blockTime
        );

        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages) {
            for (const [messageId, fields] of streamMessages) {
              await this.processMessage(stream, messageId, fields);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error in consumer group ${this.groupName}:`, error);
        await this.sleep(1000);
      }
    }
  }

  /**
   * Process a single message with acknowledgment
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

      // Process the event
      await this.handleEvent(eventType, payload, streamName, messageId);

      // Acknowledge message processing
      await acknowledgeMessage(streamName, this.groupName, messageId);

      // Mark as processed in database
      await this.markEventAsProcessed(messageId);

      console.log(`✅ Successfully processed and acknowledged message ${messageId}`);
    } catch (error) {
      console.error(`❌ Error processing message ${messageId}:`, error);
      await this.handleProcessingError(streamName, messageId, error);
      
      // Note: We don't acknowledge the message on error
      // This allows it to be reprocessed by another consumer
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
        consumerId: `${this.groupName}:${this.consumerName}`,
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
  }

  /**
   * Handle user created event
   * @param {Object} payload - Event payload
   */
  async handleUserCreated(payload) {
    console.log(`👤 [${this.consumerName}] User created: ${payload.username} (${payload.email})`);
    // Simulate some processing time
    await this.sleep(Math.random() * 1000);
  }

  /**
   * Handle user updated event
   * @param {Object} payload - Event payload
   */
  async handleUserUpdated(payload) {
    console.log(`👤 [${this.consumerName}] User updated: ${payload.username}`);
    console.log(`📝 [${this.consumerName}] Changes:`, payload.changes);
    await this.sleep(Math.random() * 500);
  }

  /**
   * Handle user deleted event
   * @param {Object} payload - Event payload
   */
  async handleUserDeleted(payload) {
    console.log(`👤 [${this.consumerName}] User deleted: ${payload.username}`);
    await this.sleep(Math.random() * 800);
  }

  /**
   * Handle message sent event
   * @param {Object} payload - Event payload
   */
  async handleMessageSent(payload) {
    console.log(`💬 [${this.consumerName}] Message sent from ${payload.senderId} to ${payload.receiverId}`);
    console.log(`📄 [${this.consumerName}] Content: ${payload.content}`);
    await this.sleep(Math.random() * 300);
  }

  /**
   * Handle task created event
   * @param {Object} payload - Event payload
   */
  async handleTaskCreated(payload) {
    console.log(`📋 [${this.consumerName}] Task created: ${payload.title}`);
    console.log(`👤 [${this.consumerName}] Assigned to: ${payload.assignedTo}`);
    await this.sleep(Math.random() * 600);
  }

  /**
   * Handle task completed event
   * @param {Object} payload - Event payload
   */
  async handleTaskCompleted(payload) {
    console.log(`✅ [${this.consumerName}] Task completed: ${payload.taskId}`);
    console.log(`👤 [${this.consumerName}] Completed by: ${payload.completedBy}`);
    await this.sleep(Math.random() * 400);
  }

  /**
   * Handle system error event
   * @param {Object} payload - Event payload
   */
  async handleSystemError(payload) {
    console.error(`🚨 [${this.consumerName}] System Error: ${payload.message}`);
    console.error(`📊 [${this.consumerName}] Metadata:`, payload.metadata);
    await this.sleep(Math.random() * 200);
  }

  /**
   * Handle system info event
   * @param {Object} payload - Event payload
   */
  async handleSystemInfo(payload) {
    console.log(`ℹ️ [${this.consumerName}] System Info: ${payload.message}`);
    await this.sleep(Math.random() * 100);
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
   * Get stream information
   * @param {string} streamName - Stream name
   * @returns {Promise<Object>} Stream information
   */
  async getStreamInfo(streamName) {
    try {
      return await getStreamInfo(streamName);
    } catch (error) {
      console.error(`❌ Error getting stream info for ${streamName}:`, error);
      throw error;
    }
  }

  /**
   * Get consumer group information
   * @param {string} streamName - Stream name
   * @returns {Promise<Object>} Consumer group information
   */
  async getConsumerGroupInfo(streamName) {
    try {
      return await getConsumerGroupInfo(streamName, this.groupName);
    } catch (error) {
      console.error(`❌ Error getting consumer group info:`, error);
      throw error;
    }
  }

  /**
   * Stop the consumer group
   */
  stop() {
    console.log(`🛑 Stopping consumer group ${this.groupName} (${this.consumerName})`);
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

module.exports = ConsumerGroupService;
