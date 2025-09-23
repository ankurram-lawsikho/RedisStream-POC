#!/usr/bin/env node

const ProducerService = require('../services/producer');
const { testRedisConnection } = require('../config/redis');
const { testConnection } = require('../config/database');

/**
 * Load test script to generate events
 */
async function loadTest() {
  try {
    console.log('🚀 Starting Redis Streams Load Test...');
    
    // Test connections
    await testRedisConnection();
    await testConnection();
    
    const eventCount = parseInt(process.argv[2]) || 100;
    const delay = parseInt(process.argv[3]) || 100; // ms between events
    
    console.log(`📊 Generating ${eventCount} events with ${delay}ms delay...`);
    
    for (let i = 0; i < eventCount; i++) {
      try {
        // Generate different types of events
        const eventType = i % 4;
        
        switch (eventType) {
          case 0:
            // User created event
            await ProducerService.publishUserCreated({
              id: `user-${i}`,
              username: `user${i}`,
              email: `user${i}@example.com`,
              status: 'active',
              createdAt: new Date().toISOString()
            });
            break;
            
          case 1:
            // Chat message event
            await ProducerService.publishChatMessage({
              id: `msg-${i}`,
              senderId: `user-${i}`,
              receiverId: `user-${(i + 1) % 10}`,
              content: `Test message ${i}`,
              roomId: 'general',
              timestamp: new Date().toISOString()
            });
            break;
            
          case 2:
            // Task created event
            await ProducerService.publishTaskCreated({
              id: `task-${i}`,
              title: `Task ${i}`,
              description: `Description for task ${i}`,
              priority: ['low', 'medium', 'high'][i % 3],
              assignedTo: `user-${i % 5}`,
              createdBy: `user-${(i + 1) % 5}`,
              dueDate: new Date(Date.now() + 86400000).toISOString()
            });
            break;
            
          case 3:
            // System log event
            await ProducerService.publishSystemLog(
              ['info', 'warn', 'error'][i % 3],
              `Load test message ${i}`,
              { iteration: i, timestamp: Date.now() }
            );
            break;
        }
        
        if (i % 10 === 0) {
          console.log(`📤 Generated ${i + 1}/${eventCount} events...`);
        }
        
        // Delay between events
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`❌ Error generating event ${i}:`, error);
      }
    }
    
    console.log(`✅ Load test completed! Generated ${eventCount} events.`);
    
  } catch (error) {
    console.error('❌ Error in load test:', error);
    process.exit(1);
  }
}

loadTest();
