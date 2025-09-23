#!/usr/bin/env node

const ConsumerGroupService = require('../services/consumerGroup');
const { STREAMS } = require('../utils/streamUtils');
const { testRedisConnection } = require('../config/redis');
const { testConnection } = require('../config/database');

/**
 * Example script to start a consumer group
 */
async function startConsumerGroup() {
  try {
    console.log('🚀 Starting Redis Streams Consumer Group...');
    
    // Test connections
    await testRedisConnection();
    await testConnection();
    
    // Get consumer name from command line args or use default
    const consumerName = process.argv[2] || `consumer-${Date.now()}`;
    const groupName = 'user-processing-group';
    
    // Create consumer group instance
    const consumerGroup = new ConsumerGroupService(groupName, consumerName);
    
    // Initialize consumer group for user events stream
    await consumerGroup.initializeGroup(STREAMS.USER_EVENTS, '0');
    
    // Start consuming from consumer group
    console.log(`📥 Starting consumer group ${groupName} with consumer ${consumerName}...`);
    await consumerGroup.startConsuming(STREAMS.USER_EVENTS, 1, 1000);
    
  } catch (error) {
    console.error('❌ Error starting consumer group:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down consumer group...');
  process.exit(0);
});

startConsumerGroup();
