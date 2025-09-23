# Redis Streams POC

A comprehensive Node.js application demonstrating Redis Streams for real-time data processing with Express, PostgreSQL, and Sequelize.

## Features

- 🚀 **Redis Streams Integration**: Complete implementation of Redis Streams with producer/consumer patterns
- 📊 **Consumer Groups**: Scalable and fault-tolerant message processing
- 🗄️ **PostgreSQL + Sequelize**: Persistent data storage with TypeORM-style entities
- 🌐 **Express API**: RESTful endpoints for triggering events
- 📝 **Event Logging**: Complete audit trail of all events
- 🔄 **Real-time Processing**: Event-driven architecture with reliable message delivery

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Express API   │───▶│  Redis Streams  │───▶│   Consumers     │
│   (Producers)   │    │                 │    │  (Processing)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Event Logs    │    │   Business      │
│   (User Data)   │    │   (Audit Trail) │    │   Logic         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 16+
- Docker and Docker Compose
- npm or yarn

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Ensure Redis is running in Docker:**
```bash
# Check if Redis is running
docker ps | grep redis

# If not running, start Redis
docker run -d -p 6379:6379 --name redis-streams redis:latest

# If you get "port is already allocated" error, Redis is already running!
```

3. **Create PostgreSQL database:**
```bash
# Create the database (adjust connection details as needed)
createdb redis_streams_db
```

4. **Create environment file:**
```bash
cp env.example .env
```

5. **Update .env with your PostgreSQL password:**
```bash
# Edit .env file and update DB_PASSWORD with your PostgreSQL password
```

6. **Start the application:**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### 📖 **API Documentation**

Once the server is running, you can access the interactive API documentation at:
- **Swagger UI**: `http://localhost:3000/api-docs`
- **API Root**: `http://localhost:3000/`
- **Health Check**: `http://localhost:3000/health`

## Usage

### API Endpoints

#### Users
- `POST /api/users` - Create user and publish event
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user and publish event
- `DELETE /api/users/:id` - Delete user and publish event

#### Events
- `POST /api/events/chat` - Send chat message
- `POST /api/events/tasks` - Create task
- `POST /api/events/tasks/:id/complete` - Complete task
- `POST /api/events/logs` - Publish system log
- `POST /api/events/custom` - Publish custom event
- `POST /api/events/batch` - Batch publish events
- `GET /api/events/processed` - Get processed events
- `GET /api/events/stats` - Get event statistics

### Running Consumers

#### Simple Consumer
```bash
npm run consumer
```

#### Consumer Group (Scalable)
```bash
npm run consumer-group
```

#### Load Testing
```bash
node src/scripts/loadTest.js 1000 50  # 1000 events, 50ms delay
```

## Examples

### Creating a User (Triggers Event)
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com"
  }'
```

### Sending a Chat Message
```bash
curl -X POST http://localhost:3000/api/events/chat \
  -H "Content-Type: application/json" \
  -d '{
    "senderId": "user-123",
    "receiverId": "user-456",
    "content": "Hello, how are you?",
    "roomId": "general"
  }'
```

### Creating a Task
```bash
curl -X POST http://localhost:3000/api/events/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement Redis Streams",
    "description": "Complete the Redis Streams POC",
    "priority": "high",
    "assignedTo": "user-123",
    "createdBy": "user-456"
  }'
```

## Redis Streams Concepts

### Streams
- `user:events` - User-related events
- `chat:messages` - Chat messages
- `task:queue` - Task processing
- `system:logs` - System logs

### Event Types
- `user.created` - User creation
- `user.updated` - User updates
- `user.deleted` - User deletion
- `message.sent` - Chat messages
- `task.created` - Task creation
- `task.completed` - Task completion
- `system.error` - System errors
- `system.info` - System information

### Consumer Groups
- `user-processing-group` - Processes user events
- `chat-processing-group` - Processes chat messages
- `task-processing-group` - Processes task events

## Project Structure

```
src/
├── config/
│   ├── database.js      # PostgreSQL configuration
│   └── redis.js         # Redis configuration
├── models/
│   ├── Event.js         # Event model
│   ├── User.js          # User model
│   └── index.js         # Model exports
├── routes/
│   ├── users.js         # User API routes
│   └── events.js        # Event API routes
├── services/
│   ├── producer.js      # Event producer service
│   ├── consumer.js      # Simple consumer service
│   └── consumerGroup.js # Consumer group service
├── utils/
│   └── streamUtils.js   # Redis Stream utilities
├── scripts/
│   ├── startConsumer.js      # Consumer script
│   ├── startConsumerGroup.js # Consumer group script
│   └── loadTest.js           # Load testing script
└── app.js               # Express application
```

## Key Features Demonstrated

### 1. Event Publishing
```javascript
// Publish user created event
const messageId = await ProducerService.publishUserCreated(userData);
```

### 2. Event Consumption
```javascript
// Simple consumer
const consumer = new ConsumerService('my-consumer');
await consumer.startConsuming('user:events');

// Consumer group (scalable)
const consumerGroup = new ConsumerGroupService('group1', 'consumer1');
await consumerGroup.startConsuming('user:events');
```

### 3. Message Acknowledgment
```javascript
// Acknowledge message processing
await acknowledgeMessage(streamName, groupName, messageId);
```

### 4. Error Handling
```javascript
// Automatic retry on failure
// Messages not acknowledged are reprocessed
```

## Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Event Statistics
```bash
curl http://localhost:3000/api/events/stats
```

### Processed Events
```bash
curl http://localhost:3000/api/events/processed?limit=10
```

### API Documentation
Visit `http://localhost:3000/api-docs` for interactive API documentation with:
- Complete endpoint documentation
- Request/response schemas
- Try-it-out functionality
- Authentication setup
- Example requests and responses

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run producer` - Start producer service
- `npm run consumer` - Start consumer service
- `npm run consumer-group` - Start consumer group service

### Environment Variables
```env
# Database (Local PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=redis_streams_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# Redis (Docker Redis)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application
PORT=3000
NODE_ENV=development
```

## Comparison with Other Technologies

See [Comparison.md](./Comparison.md) for a detailed comparison of Redis Streams vs Redis Pub/Sub vs Traditional Message Queues.

## Key Benefits of Redis Streams

1. **Reliability**: Messages persist until acknowledged
2. **Scalability**: Consumer groups enable horizontal scaling
3. **Fault Tolerance**: Automatic retry and error handling
4. **Replay Capability**: Can reprocess messages from any point
5. **Real-time**: Low latency message processing
6. **Event Sourcing**: Complete audit trail of all events

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
