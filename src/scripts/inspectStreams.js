#!/usr/bin/env node

const { redis } = require('../config/redis');
const { STREAMS } = require('../utils/streamUtils');

/**
 * Redis Streams Inspection Script
 * Provides detailed information about Redis Streams
 */
class StreamInspector {
  constructor() {
    this.streams = Object.values(STREAMS);
  }

  /**
   * Get all streams information
   */
  async getAllStreamsInfo() {
    console.log('🔍 Redis Streams Inspection Report');
    console.log('=====================================\n');

    for (const streamName of this.streams) {
      await this.getStreamInfo(streamName);
      console.log('');
    }
  }

  /**
   * Get specific stream information
   */
  async getStreamInfo(streamName) {
    try {
      console.log(`📊 Stream: ${streamName}`);
      console.log('─'.repeat(50));

      // Check if stream exists
      const length = await redis.xlen(streamName);
      
      if (length === 0) {
        console.log('   Status: Empty (no messages)');
        return;
      }

      console.log(`   Length: ${length} messages`);

      // Get stream info
      const info = await redis.xinfo('STREAM', streamName);
      const streamInfo = this.parseInfo(info);
      
      console.log(`   First ID: ${streamInfo['first-entry']?.[0] || 'N/A'}`);
      console.log(`   Last ID: ${streamInfo['last-entry']?.[0] || 'N/A'}`);
      console.log(`   Groups: ${streamInfo['groups'] || 0}`);

      // Get consumer groups
      const groups = await redis.xinfo('GROUPS', streamName);
      if (groups.length > 0) {
        console.log('   Consumer Groups:');
        for (const group of groups) {
          const groupInfo = this.parseInfo(group);
          console.log(`     - ${groupInfo.name}: ${groupInfo.consumers} consumers, ${groupInfo.pending} pending`);
        }
      }

      // Get recent messages
      const messages = await redis.xrevrange(streamName, '+', '-', 'COUNT', 3);
      if (messages.length > 0) {
        console.log('   Recent Messages:');
        for (const [id, fields] of messages) {
          const data = this.parseFields(fields);
          console.log(`     ${id}: ${data.eventType || 'unknown'} - ${JSON.stringify(data.payload || {})}`);
        }
      }

    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
  }

  /**
   * Monitor stream in real-time
   */
  async monitorStream(streamName, duration = 30000) {
    console.log(`👀 Monitoring stream: ${streamName} for ${duration/1000} seconds`);
    console.log('Press Ctrl+C to stop\n');

    const startTime = Date.now();
    let lastId = '$'; // Start from new messages

    while (Date.now() - startTime < duration) {
      try {
        const messages = await redis.xread('BLOCK', 1000, 'STREAMS', streamName, lastId);
        
        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages) {
            for (const [messageId, fields] of streamMessages) {
              const data = this.parseFields(fields);
              const timestamp = new Date().toISOString();
              
              console.log(`[${timestamp}] ${messageId}: ${data.eventType}`);
              console.log(`  Payload: ${JSON.stringify(data.payload, null, 2)}`);
              console.log('');
              
              lastId = messageId;
            }
          }
        }
      } catch (error) {
        console.error('Error monitoring stream:', error.message);
        await this.sleep(1000);
      }
    }

    console.log('Monitoring stopped.');
  }

  /**
   * Get consumer group details
   */
  async getConsumerGroupInfo(streamName, groupName) {
    try {
      console.log(`👥 Consumer Group: ${groupName} (${streamName})`);
      console.log('─'.repeat(50));

      const groups = await redis.xinfo('GROUPS', streamName);
      const group = groups.find(g => this.parseInfo(g).name === groupName);
      
      if (!group) {
        console.log('   Group not found');
        return;
      }

      const groupInfo = this.parseInfo(group);
      console.log(`   Consumers: ${groupInfo.consumers}`);
      console.log(`   Pending: ${groupInfo.pending}`);
      console.log(`   Last Delivered: ${groupInfo['last-delivered-id']}`);

      // Get consumers
      const consumers = await redis.xinfo('CONSUMERS', streamName, groupName);
      if (consumers.length > 0) {
        console.log('   Consumer Details:');
        for (const consumer of consumers) {
          const consumerInfo = this.parseInfo(consumer);
          console.log(`     - ${consumerInfo.name}: ${consumerInfo.pending} pending, idle ${consumerInfo.idle}ms`);
        }
      }

    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
  }

  /**
   * Get Redis server info
   */
  async getRedisInfo() {
    try {
      console.log('🔧 Redis Server Information');
      console.log('─'.repeat(50));

      const info = await redis.info();
      const memory = await redis.info('memory');
      const stats = await redis.info('stats');

      const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
      const uptime = info.match(/uptime_in_seconds:([^\r\n]+)/)?.[1];
      const connectedClients = info.match(/connected_clients:([^\r\n]+)/)?.[1];
      const usedMemory = memory.match(/used_memory_human:([^\r\n]+)/)?.[1];
      const totalCommands = stats.match(/total_commands_processed:([^\r\n]+)/)?.[1];

      console.log(`   Version: ${version}`);
      console.log(`   Uptime: ${uptime} seconds`);
      console.log(`   Connected Clients: ${connectedClients}`);
      console.log(`   Used Memory: ${usedMemory}`);
      console.log(`   Total Commands: ${totalCommands}`);

    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
  }

  /**
   * Parse Redis info response
   */
  parseInfo(info) {
    const result = {};
    for (let i = 0; i < info.length; i += 2) {
      result[info[i]] = info[i + 1];
    }
    return result;
  }

  /**
   * Parse message fields
   */
  parseFields(fields) {
    const result = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      
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

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
async function main() {
  const inspector = new StreamInspector();
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'all':
        await inspector.getAllStreamsInfo();
        break;
      
      case 'stream':
        const streamName = args[1];
        if (!streamName) {
          console.log('Usage: node inspectStreams.js stream <stream-name>');
          process.exit(1);
        }
        await inspector.getStreamInfo(streamName);
        break;
      
      case 'monitor':
        const monitorStream = args[1];
        const duration = parseInt(args[2]) || 30000;
        if (!monitorStream) {
          console.log('Usage: node inspectStreams.js monitor <stream-name> [duration-ms]');
          process.exit(1);
        }
        await inspector.monitorStream(monitorStream, duration);
        break;
      
      case 'group':
        const groupStream = args[1];
        const groupName = args[2];
        if (!groupStream || !groupName) {
          console.log('Usage: node inspectStreams.js group <stream-name> <group-name>');
          process.exit(1);
        }
        await inspector.getConsumerGroupInfo(groupStream, groupName);
        break;
      
      case 'redis':
        await inspector.getRedisInfo();
        break;
      
      default:
        console.log('Redis Streams Inspector');
        console.log('Usage:');
        console.log('  node inspectStreams.js all                    - Show all streams info');
        console.log('  node inspectStreams.js stream <name>          - Show specific stream info');
        console.log('  node inspectStreams.js monitor <name> [ms]    - Monitor stream in real-time');
        console.log('  node inspectStreams.js group <stream> <group> - Show consumer group info');
        console.log('  node inspectStreams.js redis                  - Show Redis server info');
        break;
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await redis.disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Goodbye!');
  await redis.disconnect();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = StreamInspector;
