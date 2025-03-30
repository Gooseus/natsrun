# Basic Routing Demo

This demo shows how to use natsrun for basic message routing in NATS.

## Prerequisites

- Docker and Docker Compose
- Node.js (v16 or later)
- npm or yarn
- nats-cli

## Setup

0. Install and Run the [Docker Runtime](https://docs.docker.com/engine/install/)

1. Install the [NATS CLI](https://github.com/nats-io/natscli)

2. Clone and open the repo
```bash
git clone https://github.com/Gooseus/natsrun.git
cd natsrun
```

2. Compose and start the NATS server with Docker:
```bash
docker-compose up -d
```

1. Install dependencies:
```bash
npm install
```

3. Run the example app:
```bash
npm start
```

## Send test messages with the CLI:

### Hello World

```bash
> nats pub 'greet.world' 'Hello'
```

### Echo
```bash
> nats pub 'echo test' 'Test'
```

## What's Happening?

This demo demonstrates two basic routing patterns:

1. `greet.*` - A route that responds with a greeting using the wildcard part of the subject
2. `echo.*` - A route that simply echoes back the message payload

The example shows how to:
- Connect to NATS
- Create a router
- Define routes with wildcards
- Handle incoming messages
- Send requests and receive responses

## Cleanup

To stop the NATS server:
```bash
docker-compose down
``` 