# NATSRun HTTP & WebSocket Demo

This demo showcases how to use NATSRun to build a real-time messaging application that combines HTTP and WebSocket protocols with NATS messaging. It demonstrates:

1. HTTP to NATS message routing
2. WebSocket real-time communication
3. JetStream stream management
4. Client session management
5. Bi-directional communication patterns

## Features

- **HTTP to NATS Routing**: Maps HTTP requests to NATS subjects
- **WebSocket Support**: Real-time bidirectional communication
- **JetStream Integration**: Persistent message streams and consumers
- **Session Management**: Client identification and room-based messaging
- **Type Safety**: Full TypeScript support with proper type definitions

## Prerequisites

- Node.js 16+
- Docker and Docker Compose
- NATSRun core package

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the NATS server with JetStream enabled:
```bash
docker-compose up -d
```

3. Start the demo:
```bash
npm start
```

## Architecture

The demo implements a room-based messaging system with the following components:

### HTTP Layer
- Maps HTTP requests to NATS subjects
- Handles client session management via cookies
- Serves WebSocket client HTML

### NATS Layer
- Routes messages between HTTP and WebSocket clients
- Manages JetStream streams for persistence
- Handles message acknowledgments

### WebSocket Layer
- Provides real-time bidirectional communication
- Supports room-based message routing
- Maintains persistent connections

## Message Flow

1. **HTTP Request Flow**:
```
HTTP Request → NATS Subject → Message Handler → Response
```

2. **WebSocket Flow**:
```
WebSocket Connection → Room Subscription → Message Handler → Client
```

## API Endpoints

### HTTP Endpoints
- `GET /:roomId` - Join a chat room
- `POST /users` - Create a user (maps to NATS subject)

### WebSocket Endpoints
- `ws://localhost:3000/:roomId/:clientId` - Connect to a specific room

## NATS Subjects

The demo uses the following subject patterns:
- HTTP requests: `{prefix}.{method}.{path}`
- WebSocket messages: `{prefix}.{roomId}.{clientId}.>`
- Response subjects: `{prefix}.{clientId}.push`

## JetStream Configuration

The demo creates a JetStream stream with:
- Name: `users`
- Retention: `workqueue`
- Storage: `memory`
- Subjects: `{prefix}.>`

## Cleanup

To stop the demo:

1. Stop the Node.js process (Ctrl+C)
2. Stop the NATS server:
```bash
docker-compose down
```

## Development

The demo is built with TypeScript and uses:
- `@nats-io/nats-core` for NATS connectivity
- `@nats-io/jetstream` for stream management
- `ws` for WebSocket support
- `natsrun` for message routing

## License

MIT 