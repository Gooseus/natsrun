# NATSrun

> [!CAUTION]
> This is a WIP and not yet published to NPM

## Introduction

NATSrun is a lightweight TypeScript library that provides Express/Koa-like routing capabilities for NATS messages. It uses pattern matching to route messages to appropriate handlers based on NATS subjects, making it easy to build microservices with clean, maintainable code.

### Features

- 🔍 Pattern-based message routing using NATS subject patterns
- 🎯 Multiple handler support for the same subject
- ⚡ Async/await support
- 🔄 Configurable handler sorting strategies
- 📦 Zero dependencies (except TypeScript)
- 🎨 TypeScript-first design

## Installation

```bash
npm install natsrun
```

## Quick Start

```typescript
import { NatsRun } from 'natsrun';

// Create a new router
const router = new NatsRun();

// Add handlers for different subjects
router.add('user.created', async (msg) => {
  console.log('New user created:', msg);
});

router.add('user.*.updated', async (msg, match) => {
  console.log(`User ${match.subject} updated:`, msg);
});

// Handle incoming messages
await router.handle('user.created', { id: 1, name: 'John' });
await router.handle('user.123.updated', { name: 'John Doe' });
```

## Subject Pattern Matching

NATSrun supports NATS-style subject pattern matching:

- `*` matches a single token
- `>` matches one or more tokens
- Exact matches take precedence over wildcards

Examples:
- `user.*` matches `user.created`, `user.updated`
- `user.>` matches `user.created`, `user.123.updated`, `user.123.profile.updated`
- `user.created` matches exactly `user.created`

## Handler Sorting

NATSrun supports three sorting strategies for handlers:

1. `specificity` (default): Handlers are sorted by pattern specificity (most specific first)
2. `insertion`: Handlers are executed in the order they were added
3. `custom`: Use your own sorting function

```typescript
const router = new NatsRun({
  sortStrategy: 'insertion' // or 'specificity' or 'custom'
});

// Custom sorting
const router = new NatsRun({
  sortStrategy: 'custom',
  customSort: (a, b) => {
    // Your custom sorting logic
    return 0;
  }
});
```

## API Reference

### NatsRun Class

The main router class that handles message routing.

#### Constructor

```typescript
constructor(opts?: {
  sortStrategy?: 'specificity' | 'insertion' | 'custom';
  customSort?: (a: NatsTrieNode, b: NatsTrieNode) => number;
})
```

#### Methods

- `add(pattern: string, handle: Handler | Handler[]): void`
  - Adds a handler for the given subject pattern
  - Can accept a single handler or an array of handlers

- `match(subject: string): Handler[]`
  - Returns all handlers that match the given subject
  - Handlers are sorted according to the configured strategy

- `handle(subject: string, message: any): Promise<void>`
  - Executes all matching handlers for the given subject and message

### Types

```typescript
type Handler = (msg: any, match?: { subject: string }) => Promise<void>;
```

## Development

### Building

```bash
npm run build
```

### Testing

This project uses the built-in Node test runner with [tsx](https://github.com/privatenumber/tsx) for TypeScript support.

```bash
npm run test
```

### Documentation

Generate and view documentation:

```bash
npm run build:docs
http-server docs
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Inspired by [bloomrun](https://github.com/mcollina/bloomrun) and [patrun](https://github.com/rjrodger/patrun)
- Pattern matchers used by [Hemera](https://github.com/hemerajs/hemera) and [Seneca](https://github.com/senecajs/seneca)

# TODO

- [ ] Add examples and use cases
- [ ] More configurations for the run (exectution order, async)  
- [ ] Tests for different configurations
- [ ] Github actions
- [ ] Publish
