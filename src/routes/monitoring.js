const express = require('express');
const { redis } = require('../config/redis');
const { STREAMS } = require('../utils/streamUtils');
const router = express.Router();

/**
 * Get all Redis Streams information
 */
router.get('/streams', async (req, res) => {
  try {
    const streams = Object.values(STREAMS);
    const streamInfo = {};

    for (const streamName of streams) {
      try {
        // Check if stream exists
        const length = await redis.xlen(streamName);
        
        if (length > 0) {
          // Get stream info
          const info = await redis.xinfo('STREAM', streamName);
          
          // Get consumer groups
          const groups = await redis.xinfo('GROUPS', streamName);
          
          // Get last few messages
          const messages = await redis.xrevrange(streamName, '+', '-', 'COUNT', 5);
          
          streamInfo[streamName] = {
            length,
            info: parseStreamInfo(info),
            groups: groups.map(group => parseGroupInfo(group)),
            recentMessages: messages.map(([id, fields]) => ({
              id,
              data: parseMessageFields(fields)
            }))
          };
        } else {
          streamInfo[streamName] = {
            length: 0,
            info: null,
            groups: [],
            recentMessages: []
          };
        }
      } catch (error) {
        streamInfo[streamName] = {
          error: error.message,
          length: 0
        };
      }
    }

    res.json({
      success: true,
      streams: streamInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting streams info:', error);
    res.status(500).json({
      error: 'Failed to get streams information',
      details: error.message
    });
  }
});

/**
 * Get specific stream information
 */
router.get('/streams/:streamName', async (req, res) => {
  try {
    const { streamName } = req.params;
    const { limit = 10 } = req.query;

    // Get stream length
    const length = await redis.xlen(streamName);
    
    // Get stream info
    const info = await redis.xinfo('STREAM', streamName);
    
    // Get consumer groups
    const groups = await redis.xinfo('GROUPS', streamName);
    
    // Get recent messages
    const messages = await redis.xrevrange(streamName, '+', '-', 'COUNT', parseInt(limit));
    
    // Get message range
    const range = await redis.xrange(streamName, '-', '+', 'COUNT', parseInt(limit));

    res.json({
      success: true,
      stream: streamName,
      length,
      info: parseStreamInfo(info),
      groups: groups.map(group => parseGroupInfo(group)),
      recentMessages: messages.map(([id, fields]) => ({
        id,
        data: parseMessageFields(fields)
      })),
      messageRange: range.map(([id, fields]) => ({
        id,
        data: parseMessageFields(fields)
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting stream info:', error);
    res.status(500).json({
      error: 'Failed to get stream information',
      details: error.message
    });
  }
});

/**
 * Get consumer group information
 */
router.get('/streams/:streamName/groups', async (req, res) => {
  try {
    const { streamName } = req.params;

    const groups = await redis.xinfo('GROUPS', streamName);
    
    const groupDetails = await Promise.all(
      groups.map(async (group) => {
        const groupInfo = parseGroupInfo(group);
        const consumers = await redis.xinfo('CONSUMERS', streamName, groupInfo.name);
        
        return {
          ...groupInfo,
          consumers: consumers.map(consumer => parseConsumerInfo(consumer))
        };
      })
    );

    res.json({
      success: true,
      stream: streamName,
      groups: groupDetails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting consumer groups:', error);
    res.status(500).json({
      error: 'Failed to get consumer groups',
      details: error.message
    });
  }
});

/**
 * Read messages from stream
 */
router.get('/streams/:streamName/messages', async (req, res) => {
  try {
    const { streamName } = req.params;
    const { 
      start = '0', 
      end = '+', 
      count = 10,
      direction = 'forward' 
    } = req.query;

    let messages;
    
    if (direction === 'backward') {
      messages = await redis.xrevrange(streamName, end, start, 'COUNT', parseInt(count));
    } else {
      messages = await redis.xrange(streamName, start, end, 'COUNT', parseInt(count));
    }

    res.json({
      success: true,
      stream: streamName,
      direction,
      count: messages.length,
      messages: messages.map(([id, fields]) => ({
        id,
        data: parseMessageFields(fields)
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading stream messages:', error);
    res.status(500).json({
      error: 'Failed to read stream messages',
      details: error.message
    });
  }
});

/**
 * Get Redis server information
 */
router.get('/redis/info', async (req, res) => {
  try {
    const info = await redis.info();
    const memory = await redis.info('memory');
    const stats = await redis.info('stats');
    
    res.json({
      success: true,
      redis: {
        version: info.match(/redis_version:([^\r\n]+)/)?.[1],
        mode: info.match(/redis_mode:([^\r\n]+)/)?.[1],
        uptime: info.match(/uptime_in_seconds:([^\r\n]+)/)?.[1],
        connectedClients: info.match(/connected_clients:([^\r\n]+)/)?.[1],
        usedMemory: memory.match(/used_memory_human:([^\r\n]+)/)?.[1],
        totalCommands: stats.match(/total_commands_processed:([^\r\n]+)/)?.[1]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting Redis info:', error);
    res.status(500).json({
      error: 'Failed to get Redis information',
      details: error.message
    });
  }
});

/**
 * Test Redis connection
 */
router.get('/redis/ping', async (req, res) => {
  try {
    const start = Date.now();
    const result = await redis.ping();
    const latency = Date.now() - start;
    
    res.json({
      success: true,
      result,
      latency: `${latency}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error pinging Redis:', error);
    res.status(500).json({
      error: 'Failed to ping Redis',
      details: error.message
    });
  }
});

// Helper functions
function parseStreamInfo(info) {
  const result = {};
  for (let i = 0; i < info.length; i += 2) {
    result[info[i]] = info[i + 1];
  }
  return result;
}

function parseGroupInfo(group) {
  const result = {};
  for (let i = 0; i < group.length; i += 2) {
    result[group[i]] = group[i + 1];
  }
  return result;
}

function parseConsumerInfo(consumer) {
  const result = {};
  for (let i = 0; i < consumer.length; i += 2) {
    result[consumer[i]] = consumer[i + 1];
  }
  return result;
}

function parseMessageFields(fields) {
  const result = {};
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i];
    const value = fields[i + 1];
    
    // Try to parse JSON fields
    if (key === 'payload') {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

module.exports = router;
