# NATSrun

[![npm version](https://img.shields.io/npm/v/@gooseus/natsrun.svg)](https://www.npmjs.com/package/@gooseus/natsrun)
[![CI/CD](https://github.com/Gooseus/natsrun/actions/workflows/test-build.yml/badge.svg)](https://github.com/Gooseus/natsrun/actions/workflows/test-build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)

## Introduction

NATSrun is a lightweight TypeScript library that provides Express/Koa-like routing capabilities for NATS messages. It uses pattern matching to route messages to appropriate handlers based on NATS subjects, making it easy to build microservices with clean, maintainable code.

### Features

- Pattern-based message routing using NATS subject patterns
- Multiple handler support for the same subject
- Async/await support
- Configurable handler sorting strategies
- Zero dependencies (except TypeScript)
- TypeScript-first design with full type safety

## Installation

```bash
npm install @gooseus/natsrun
```

## Quick Start

```typescript
import { NatsRun } from '@gooseus/natsrun';

// Create a new router
const router = new NatsRun();

// Add handlers for different subjects
router.add('user.created', async (msg, ctx, next) => {
  console.log('New user created:', msg);
  // Pass data to next handler
  await next({ userId: msg.data.id });
});

router.add('user.*.updated', async (msg, ctx, next) => {
  console.log(`User ${ctx.userId} updated:`, msg);
  // Access data from previous handler
  console.log('Previous handler data:', ctx);
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

1. `specificity` (default): Handlers are sorted by pattern specificity (more specific first)
2. `insertion`: Handlers are executed in the order they were added
3. `custom`: Use your own sorting function

```typescript
const router = new NatsRun({
  sortStrategy: 'insertion' // or 'specificity' or 'custom'
});

// Custom sorting with metadata
router.add('user.updated', async (msg) => {
  console.log('Handler 1:', msg);
}, { priority: 1 });

router.add('user.updated', async (msg) => {
  console.log('Handler 2:', msg);
}, { priority: 2 });

// Custom sorting function
const router = new NatsRun({
  sortStrategy: 'custom',
  customSort: (a, b) => a.metadata.priority - b.metadata.priority
});
```

## API Reference

### NatsRun Class

The main router class that handles message routing.

#### Constructor

```typescript
constructor(opts?: {
  sortStrategy?: 'specificity' | 'insertion' | 'custom';
  customSort?: (a: NatsHandlersPayload, b: NatsHandlersPayload) => number;
})
```

#### Methods

- `add(pattern: string, handle: Handler | Handler[], metadata?: Record<string, any>): void`
  - Adds a handler for the given subject pattern
  - Can accept a single handler or an array of handlers
  - Optional metadata for custom sorting

- `match(subject: string): Handler[]`
  - Returns all handlers that match the given subject
  - Handlers are sorted according to the configured strategy

- `handle(subject: string, message: any, ctx?: Record<string, any>): Promise<Record<string, any>>`
  - Executes all matching handlers for the given subject and message
  - Returns the final context after all handlers have executed

### Types

```typescript
type Handler = (msg: NatsMsg, ctx: Record<string, any>, next: (data?: any) => Promise<Record<string, any> | void>) => Promise<Record<string, any> | void>;

type NatsMsg = {
  subject: string;
  data: any;
};
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

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes in each version.

## License

MIT

## Acknowledgments

- Inspired by [bloomrun](https://github.com/mcollina/bloomrun) and [patrun](https://github.com/rjrodger/patrun)
- Pattern matchers used by [Hemera](https://github.com/hemerajs/hemera) and [Seneca](https://github.com/senecajs/seneca)
