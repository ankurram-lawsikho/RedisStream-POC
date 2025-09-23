const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { testRedisConnection } = require('./config/redis');
const { syncDatabase } = require('./models');

// Import routes
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const monitoringRoutes = require('./routes/monitoring');

// Load Swagger YAML
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    const redisStatus = await testRedisConnection();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus ? 'connected' : 'disconnected',
        redis: redisStatus ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Redis Streams POC API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
}));

// API routes
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Redis Streams POC API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      users: '/api/users',
      events: '/api/events',
      monitoring: '/api/monitoring',
      documentation: '/api-docs'
    },
    documentation: {
      users: {
        'POST /api/users': 'Create a new user',
        'GET /api/users': 'Get all users',
        'GET /api/users/:id': 'Get user by ID',
        'PUT /api/users/:id': 'Update user',
        'DELETE /api/users/:id': 'Delete user'
      },
      events: {
        'POST /api/events/chat': 'Send chat message',
        'POST /api/events/tasks': 'Create task',
        'POST /api/events/tasks/:id/complete': 'Complete task',
        'POST /api/events/logs': 'Publish system log',
        'POST /api/events/custom': 'Publish custom event',
        'POST /api/events/batch': 'Batch publish events',
        'GET /api/events/processed': 'Get processed events',
        'GET /api/events/stats': 'Get event statistics',
        'GET /api/events/info': 'Get available streams and event types'
      }
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Initialize and start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Test Redis connection
    await testRedisConnection();
    
    // Sync database models
    await syncDatabase();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📖 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`📋 API Root: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  process.exit(0);
});

startServer();
