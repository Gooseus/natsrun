import { ITrieNode, NatsTrie, InvalidSubjectError, InvalidPayloadError } from "./lib/natstrie/index.js";


/**
 * A message object that contains the subject, data, and specific headers of a NATS message.
 */
export type NatsMsg = {
  subject: string;
  data: any;
}

/**
 * A context object that collects context information for the router handlers
 */
export type NatsContext = Record<string, any>;

/**
 * A function that can be used to pass data to the next handler in the chain via the context
 * @param data - The data to pass to the next handler
 * @returns The context object that contains the state and other information for next handler
 */
type NatsNext = (data?: any) => Promise<NatsContext | void>;

/**
 * A handler function that processes NATS messages.
 * @param msg - The message payload received from NATS
 * @param ctx - The context object that contains the state and other information for a handler
 * @param next - The next function that can be used to pass data to the next handler in the chain
 * @returns The context object that contains the state and other information for next handler
 */
export type Handler = (msg: NatsMsg, ctx: NatsContext, next: NatsNext) => Promise<NatsContext | void>;

/**
 * A type that represents the allowd metadata values for a handler
 */
type NatsMetadataValue = string | number | boolean | null;

/**
 * A type that represents the metadata for a handler
 */
type NatsInternalMetadata = {
  _insertOrder: number;
  _pattern: string;
  _lastData: NatsMetadataValue;
}

/**
 * A payload object that contains the handlers and metadata for handling NATS messages
 */
export type NatsHandlersPayload = {
  handlers: Handler[];
  metadata: Record<string, NatsMetadataValue> & NatsInternalMetadata;
}

/**
 * A node in the NATS subject pattern matching trie
 */
export type NatsTrieNode = ITrieNode<NatsHandlersPayload>;

/**
 * Strategy for sorting handlers when multiple matches are found
 * - 'specificity': Sort by pattern specificity (most specific first)
 * - 'insertion': Maintain order of handler registration
 * - 'custom': Use a custom sorting function
 */
export type NatsSortStrategy = 'specificity' | 'insertion' | 'custom';

/**
 * A function that sorts trie nodes
 * @param a - The first node
 * @param b - The second node
 * @returns A number indicating the order of the nodes
 */
export type NatsSortFunction = (a: NatsHandlersPayload, b: NatsHandlersPayload) => number;

/**
 * Error thrown when an invalid NATS subject pattern is provided to NatsRun
 */
export class NatsRunSubjectError extends Error {
  constructor(error: InvalidSubjectError | string) {
    super(typeof error === 'string' ? error : error.message);
    this.name = "NatsRunSubjectError";
  }
}

/**
 * Error thrown when an invalid handler is provided to NatsRun
 */
export class NatsRunHandlerError extends Error {
  constructor(error: InvalidPayloadError | string) {
    super(`Invalid handler: ${typeof error === 'string' ? error : error.reason}`);
    this.name = "NatsRunHandlerError"; 
  }
}

/**
 * Error thrown when an error occurs in NatsRun
 */
export class NatsRunError extends Error {
  constructor(error: Error | string) {
    super(typeof error === 'string' ? error : error.message);
    this.name = "NatsRunError";
  }
}


/**
 * NatsRun is a router that matches NATS subject patterns to handlers.
 * It provides Express/Koa-like routing capabilities for NATS messages,
 * allowing you to define handlers for specific subject patterns.
 * 
 * @example
 * ```typescript
 * const router = new NatsRun();
 * 
 * // Add a handler for user creation
 * router.add('user.created', async (msg) => {
 *   console.log('New user:', msg);
 * });
 * 
 * // Handle a message
 * await router.handle('user.created', { id: 1, name: 'John' });
 * ```
 */
export class NatsRun {
  /** 
   * Number of handlers added so far
   * Used when sortStrategy is 'insertion'
   * @internal
   */
  private count: number = 0;

  /**
   * The underlying trie data structure used for pattern matching
   * @internal
   */
  private trie = new NatsTrie<NatsHandlersPayload>();

  /**
   * The strategy used for sorting matched handlers
   * @internal
   */
  private sortStrategy: NatsSortStrategy;

  /**
   * Optional custom sorting function for handlers
   * @internal
   */
  private customSort?: NatsSortFunction;

  /**
   * Creates a new NatsRun router
   * @param opts - Configuration options
   * @param opts.sortStrategy - Strategy for sorting matching handlers
   * @param opts.customSort - Custom sorting function for handlers
   */
  constructor(opts: { sortStrategy?: NatsSortStrategy, customSort?: NatsSortFunction } = {}) {
    this.sortStrategy = opts.sortStrategy ?? 'specificity';
    this.customSort = opts.customSort;
  }

  private wrapHandler(handler: Handler): NatsHandlersPayload {
    return {
      handlers: [handler],
      metadata: { _insertOrder: 0, _pattern: '', _lastData: null }
    };
  }
  
  private addPayloadMetadata(payload: NatsHandlersPayload, ...metadata: Record<string, NatsMetadataValue>[]): NatsHandlersPayload {
    return {
      ...payload,
      metadata: Object.assign({}, payload.metadata, ...metadata)
    };
  }

  private isHandlersPayload(handle: NatsHandlersPayload | Handler): handle is NatsHandlersPayload {
    return typeof handle === 'object' && handle !== null && 'handlers' in handle && Array.isArray(handle.handlers) && handle.handlers.every((h) => typeof h === 'function');
  }

  private async objectifyData(data: any, ctx: NatsContext): Promise<NatsContext> {
    if (typeof data === 'function') {
      data = await data(ctx);
    }
    if (typeof data === 'object' && data !== null) {
      return data;
    }
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return { _lastData: data };
    }
    return {};
  }

  /**
   * Adds a handler for a specific subject pattern
   * 
   * @param pattern - The NATS subject pattern to match
   * @param handle - Handler function(s) to execute when pattern matches
   * 
   * @example
   * ```typescript
   * // Single handler
   * router.add('user.created', async (msg) => {
   *   console.log('New user:', msg);
   * });
   * 
   * // Multiple handlers
   * router.add('user.updated', [
   *   async (msg) => { console.log('Handler 1:', msg); },
   *   async (msg) => { console.log('Handler 2:', msg); }
   * ]);
   * ```
   */
  add(pattern: string, handle: NatsHandlersPayload | NatsHandlersPayload[] | Handler | Handler[], metadata: Record<string, NatsMetadataValue> = {}): void {
    const handlers: NatsHandlersPayload[] = [];
    if (!Array.isArray(handle)) {
      if (typeof handle === 'function') {
        handlers.push(this.addPayloadMetadata(this.wrapHandler(handle), metadata, { _insertOrder: this.count++, _pattern: pattern }));
      } else if (this.isHandlersPayload(handle)) {
        handlers.push(this.addPayloadMetadata(handle, metadata, { _insertOrder: this.count++, _pattern: pattern }));
      } else {
        throw new NatsRunHandlerError("Must be a NatsHandlersPayload, a Handler function, or an array of either");
      }
    } else {
      for (const h of handle) {
        if (typeof h !== 'function') {
          if (this.isHandlersPayload(h)) {
            handlers.push(this.addPayloadMetadata(h, metadata, { _insertOrder: this.count++, _pattern: pattern }));
          } else {
            throw new NatsRunHandlerError("Array must contain NatsHandlersPayload or Handler functions");
          }
        } else {
          handlers.push(this.addPayloadMetadata(this.wrapHandler(h), metadata, { _insertOrder: this.count++, _pattern: pattern }));
        }
      }
    }

    try {
      this.trie.insert(pattern, handlers);
    } catch (error) {
      if (error instanceof InvalidSubjectError) {
        throw new NatsRunSubjectError(error);
      }
      if (error instanceof InvalidPayloadError) {
        throw new NatsRunHandlerError(error);
      }
      if (error instanceof Error) {
        throw new NatsRunError(error);
      }
      throw error;
    }
  }

  private calculateSpecificity(pattern: string): number {
    const topics = pattern.split('.');
    return topics.reduce((acc, topic) => {
      if (topic === '>') return acc + 1;
      if (topic === '*') return acc + 2;
      return acc + 3;
    }, 0);
  }

  /**
   * Returns all handlers that match the given subject, sorted according to the configured strategy
   * 
   * @param subject - The NATS subject to match
   * @returns Array of matching handlers, sorted according to the configured strategy
   * 
   * @example
   * ```typescript
   * const handlers = router.match('user.123.updated');
   * // Returns handlers matching 'user.123.updated', 'user.*.updated', etc.
   * ```
   */
  match(subject = ''): Handler[] {
    const matches = this.trie.match(subject);
    let flatMatches = matches.flat();
    const unsortedPayloads = flatMatches.flatMap(({ payload }) => payload);
    let sortedPayloads: NatsHandlersPayload[];

    switch (this.sortStrategy) { 
      case 'insertion':
        sortedPayloads = unsortedPayloads.sort((a, b) => {
          return a.metadata._insertOrder - b.metadata._insertOrder;
        });
        break;
      case 'custom':
        sortedPayloads = unsortedPayloads.sort(this.customSort!);
        break;
      case 'specificity':
        sortedPayloads = unsortedPayloads.sort((a, b) => this.calculateSpecificity(b.metadata._pattern) - this.calculateSpecificity(a.metadata._pattern));
        break;
      default:
        sortedPayloads = unsortedPayloads;
        break;
    }

    return sortedPayloads.flatMap(({ handlers }) => handlers);
  }

  /**
   * Executes all handlers that match the given subject
   * 
   * @param subject - The NATS subject to match
   * @param message - The message payload to pass to handlers
   * 
   * @example
   * ```typescript
   * await router.handle('user.123.updated', {
   *   id: 123,
   *   name: 'John Doe'
   * });
   * ```
   */
  async handle(subject: string, message: any, ctx: NatsContext = {}): Promise<NatsContext> {
    const matches = this.match(subject);
    let handler: Handler | undefined = matches.shift();
    if (!handler) return ctx;

    const next = async (data?: any) => {
      ctx = { ...ctx, ...(await this.objectifyData(data, ctx)) };
      const nhandler = matches.shift();
      if (!nhandler) return ctx;
      return nhandler({ subject, data: message }, ctx, next) ?? ctx;
    };

    return await handler({ subject, data: message }, ctx, next) ?? ctx;
  }
}
