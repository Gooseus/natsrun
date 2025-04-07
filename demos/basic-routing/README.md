# Basic Routing Demo

This demo shows how to use natsrun for basic message routing in NATS, demonstrating how to create middleware-style message handlers similar to Express/Koa for HTTP requests.

## Prerequisites

- Docker and Docker Compose
- Node.js (v16 or later)
- npm or yarn
- nats-cli (NATS command-line interface)

## Quick Start

1. Start NATS server:
```bash
docker-compose up -d
```

2. Install dependencies:
```bash
npm install
```

3. Run the demo:
```bash
npm start
```

## Testing the Routes

The demo sets up two routing patterns that you can test using the NATS CLI:

### 1. Greeting Route (`greet.*`)
Responds with a greeting using the wildcard part of the subject:
```bash
nats pub 'greet.world' 'Hello'
```

### 2. Echo Route (`echo.*`)
Echoes back any message payload:
```bash
nats pub 'echo.test' 'Test message'
```

## Implementation Details

This demo showcases:
- Setting up a NATS connection
- Creating a message router
- Defining wildcard routes
- Handling incoming messages
- Request-response patterns

## Development Setup

1. Install Docker: [Docker Installation Guide](https://docs.docker.com/engine/install/)

2. Install NATS CLI:
   - GitHub: [nats-io/natscli](https://github.com/nats-io/natscli)
   - Follow installation instructions for your platform

3. Clone the repository:
```bash
git clone https://github.com/Gooseus/natsrun.git
cd natsrun
```

## Cleanup

Stop the NATS server:
```bash
docker-compose down
```

## Additional Resources

- [NATS Documentation](https://docs.nats.io/)
- [NATS CLI Documentation](https://github.com/nats-io/natscli#readme) 