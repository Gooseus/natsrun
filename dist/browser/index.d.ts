import { ITrieNode, InvalidSubjectError, InvalidPayloadError } from "./lib/natstrie/index.js";
/**
 * A message object that contains the subject, data, and specific headers of a NATS message.
 */
export type NatsMsg = {
    subject: string;
    data: Uint8Array;
    headers?: Record<string, string>;
};
/**
 * A handler function that processes NATS messages.
 * @param msg - The message payload received from NATS
 * @param match - Optional match object containing the matched subject
 */
export type Handler = (msg: NatsMsg) => Promise<void>;
/**
 * A node in the NATS subject pattern matching trie
 */
export type NatsTrieNode = ITrieNode<Handler>;
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
export type NatsSortFunction = (a: NatsTrieNode, b: NatsTrieNode) => number;
/**
 * Error thrown when an invalid NATS subject pattern is provided to NatsRun
 */
export declare class NatsRunSubjectError extends Error {
    constructor(error: InvalidSubjectError | string);
}
/**
 * Error thrown when an invalid handler is provided to NatsRun
 */
export declare class NatsRunHandlerError extends Error {
    constructor(error: InvalidPayloadError | string);
}
/**
 * Error thrown when an error occurs in NatsRun
 */
export declare class NatsRunError extends Error {
    constructor(error: Error | string);
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
export declare class NatsRun {
    /**
     * Array of handlers in order of registration
     * Used when sortStrategy is 'insertion'
     * @internal
     */
    private order;
    /**
     * The underlying trie data structure used for pattern matching
     * @internal
     */
    private trie;
    /**
     * The strategy used for sorting matched handlers
     * @internal
     */
    private sortStrategy;
    /**
     * Optional custom sorting function for handlers
     * @internal
     */
    private customSort?;
    /**
     * Creates a new NatsRun router
     * @param opts - Configuration options
     * @param opts.sortStrategy - Strategy for sorting matching handlers
     * @param opts.customSort - Custom sorting function for handlers
     */
    constructor(opts?: {
        sortStrategy?: NatsSortStrategy;
        customSort?: NatsSortFunction;
    });
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
    add(pattern: string, handle: Handler | Handler[]): void;
    /**
     * Returns all handlers that match the given subject
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
    match(subject?: string): Handler[];
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
    handle(subject: string, message: Uint8Array, headers?: Record<string, string>): Promise<void>;
}
