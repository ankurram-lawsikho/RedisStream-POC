const express = require('express');
const { Event } = require('../models');
const ProducerService = require('../services/producer');
const { STREAMS, EVENT_TYPES } = require('../utils/streamUtils');
const router = express.Router();

/**
 * Send a chat message and publish event
 */
router.post('/chat', async (req, res) => {
  try {
    const { senderId, receiverId, content, roomId } = req.body;

    if (!senderId || !receiverId || !content) {
      return res.status(400).json({
        error: 'senderId, receiverId, and content are required'
      });
    }

    const messageData = {
      id: require('uuid').v4(),
      senderId,
      receiverId,
      content,
      roomId: roomId || 'general',
      timestamp: new Date().toISOString()
    };

    // Publish chat message event
    const messageId = await ProducerService.publishChatMessage(messageData);

    res.status(201).json({
      success: true,
      message: messageData,
      messageId,
      message: 'Chat message sent and event published successfully'
    });
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({
      error: 'Failed to send chat message',
      details: error.message
    });
  }
});

/**
 * Create a task and publish event
 */
router.post('/tasks', async (req, res) => {
  try {
    const { title, description, priority, assignedTo, createdBy, dueDate } = req.body;

    if (!title || !assignedTo || !createdBy) {
      return res.status(400).json({
        error: 'title, assignedTo, and createdBy are required'
      });
    }

    const taskData = {
      id: require('uuid').v4(),
      title,
      description: description || '',
      priority: priority || 'medium',
      assignedTo,
      createdBy,
      dueDate: dueDate || null
    };

    // Publish task created event
    const messageId = await ProducerService.publishTaskCreated(taskData);

    res.status(201).json({
      success: true,
      task: taskData,
      messageId,
      message: 'Task created and event published successfully'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      error: 'Failed to create task',
      details: error.message
    });
  }
});

/**
 * Complete a task and publish event
 */
router.post('/tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { completedBy, completionNotes } = req.body;

    if (!completedBy) {
      return res.status(400).json({
        error: 'completedBy is required'
      });
    }

    // Publish task completed event
    const messageId = await ProducerService.publishTaskCompleted(
      taskId,
      completedBy,
      completionNotes || ''
    );

    res.json({
      success: true,
      messageId,
      message: 'Task completion event published successfully'
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({
      error: 'Failed to complete task',
      details: error.message
    });
  }
});

/**
 * Publish system log event
 */
router.post('/logs', async (req, res) => {
  try {
    const { level, message, metadata } = req.body;

    if (!level || !message) {
      return res.status(400).json({
        error: 'level and message are required'
      });
    }

    // Publish system log event
    const messageId = await ProducerService.publishSystemLog(level, message, metadata || {});

    res.status(201).json({
      success: true,
      messageId,
      message: 'System log event published successfully'
    });
  } catch (error) {
    console.error('Error publishing system log:', error);
    res.status(500).json({
      error: 'Failed to publish system log',
      details: error.message
    });
  }
});

/**
 * Publish custom event
 */
router.post('/custom', async (req, res) => {
  try {
    const { streamName, eventType, payload } = req.body;

    if (!streamName || !eventType || !payload) {
      return res.status(400).json({
        error: 'streamName, eventType, and payload are required'
      });
    }

    // Publish custom event
    const messageId = await ProducerService.publishCustomEvent(streamName, eventType, payload);

    res.status(201).json({
      success: true,
      messageId,
      message: 'Custom event published successfully'
    });
  } catch (error) {
    console.error('Error publishing custom event:', error);
    res.status(500).json({
      error: 'Failed to publish custom event',
      details: error.message
    });
  }
});

/**
 * Batch publish multiple events
 */
router.post('/batch', async (req, res) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'events array is required and must not be empty'
      });
    }

    // Validate each event
    for (const event of events) {
      if (!event.streamName || !event.eventType || !event.payload) {
        return res.status(400).json({
          error: 'Each event must have streamName, eventType, and payload'
        });
      }
    }

    // Batch publish events
    const messageIds = await ProducerService.batchPublish(events);

    res.status(201).json({
      success: true,
      messageIds,
      count: messageIds.length,
      message: 'Batch events published successfully'
    });
  } catch (error) {
    console.error('Error batch publishing events:', error);
    res.status(500).json({
      error: 'Failed to batch publish events',
      details: error.message
    });
  }
});

/**
 * Get all processed events
 */
router.get('/processed', async (req, res) => {
  try {
    const { limit = 50, offset = 0, eventType, processed } = req.query;

    const where = {};
    if (eventType) where.eventType = eventType;
    if (processed !== undefined) where.processed = processed === 'true';

    const events = await Event.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      events: events.rows,
      total: events.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      error: 'Failed to fetch events',
      details: error.message
    });
  }
});

/**
 * Get event statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const totalEvents = await Event.count();
    const processedEvents = await Event.count({ where: { processed: true } });
    const errorEvents = await Event.count({ where: { error: { [require('sequelize').Op.ne]: null } } });

    // Get event type distribution
    const eventTypeStats = await Event.findAll({
      attributes: [
        'eventType',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['eventType'],
      raw: true
    });

    res.json({
      success: true,
      stats: {
        total: totalEvents,
        processed: processedEvents,
        pending: totalEvents - processedEvents,
        errors: errorEvents,
        eventTypes: eventTypeStats
      }
    });
  } catch (error) {
    console.error('Error fetching event stats:', error);
    res.status(500).json({
      error: 'Failed to fetch event stats',
      details: error.message
    });
  }
});

/**
 * Get available streams and event types
 */
router.get('/info', async (req, res) => {
  try {
    res.json({
      success: true,
      streams: Object.values(STREAMS),
      eventTypes: Object.values(EVENT_TYPES)
    });
  } catch (error) {
    console.error('Error fetching event info:', error);
    res.status(500).json({
      error: 'Failed to fetch event info',
      details: error.message
    });
  }
});

module.exports = router;
