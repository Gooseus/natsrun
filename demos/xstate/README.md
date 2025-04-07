# NATSrun XState Demo

> [!CAUTION]
> This README was partially written with AI, things may not be entirely accurate
> I will be editing this more later

This demonstrates one way to integrate NATSrun with XState to create state machines that respond to NATS messages. The demo includes several examples that demonstrate different use cases for state machines with NATS integration.

## Overview

The demo includes the following components:

1. **createNatsActor**: A factory for creating an Xstate actor that subscribe to `machine.<id>.<event>` subjects passes them to the state machine.
2. **Example Applications**:
   - **Counter**: A simple counter state machine
   - **Calculator**: A state machine that performs some basic arithmetic operations
   - **IPF**: An Iterative Proportional Fitting state machine for statistical analysis

## createNatsActor

The `createNatsActor` is a factory that creates an XState actor that will:
- Subscribe to NATS messages and convert them into state machine events
- Publish state machine context on final states and errors to NATS topics

## How it Works

1. State machines are defined using XState
2. The `createNatsActor` creates an actor and sets up NATS subscriptions
3. NATS messages are automatically converted to state machine events
4. State changes and context updates are published to NATS topics
5. Error handling and completion events are automatically managed

## Running the Examples

1. Make sure you have a NATS server running locally (default: nats://localhost:4222)
  ```bash
    docker compose up -d
  ```
2. Install dependencies:
  ```bash
    npm install
  ```
3. Start the demo in the demo folder:
  ```bash
    $ node counter/demo.ts
  ```

## Testing the Examples

Each example includes its own test suite. You can run the tests with:

```bash
npm test
```

## Directory Structure

- `actors/`: Contains the `createNatsActor` implementation
- `calculator/`: A calculator state machine example
- `counter/`: A counter state machine example
- `ipf/`: An Iterative Proportional Fitting state machine example

## NATS Topics

The NatsActor uses the following topic pattern:
- `machine.{machineId}.{event}`: For sending events to the state machine
- `machine.{machineId}.error`: For error notifications
- `machine.{machineId}.complete`: For completion notifications

You can use the `nats-cli` to listen with
```
nats sub "machine.{machineId}.>"
```