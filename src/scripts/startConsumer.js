#!/usr/bin/env node

const ConsumerService = require('../services/consumer');
const { STREAMS } = require('../utils/streamUtils');
const { testRedisConnection } = require('../config/redis');
const { testConnection } = require('../config/database');

/**
 * Example script to start a simple consumer
 */
async function startConsumer() {
  try {
    console.log('🚀 Starting Redis Streams Consumer...');
    
    // Test connections
    await testRedisConnection();
    await testConnection();
    
    // Create consumer instance
    const consumer = new ConsumerService('example-consumer');
    
    // Start consuming from user events stream
    console.log('📥 Starting to consume from user:events stream...');
    await consumer.startConsuming(STREAMS.USER_EVENTS, '0', 5, 1000);
    
  } catch (error) {
    console.error('❌ Error starting consumer:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down consumer...');
  process.exit(0);
});

startConsumer();
