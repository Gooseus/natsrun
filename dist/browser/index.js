import { NatsTrie, InvalidSubjectError, InvalidPayloadError } from "./lib/natstrie/index.js";
/**
 * Error thrown when an invalid NATS subject pattern is provided to NatsRun
 */
export class NatsRunSubjectError extends Error {
    constructor(error) {
        super(typeof error === 'string' ? error : error.message);
        this.name = "NatsRunSubjectError";
    }
}
/**
 * Error thrown when an invalid handler is provided to NatsRun
 */
export class NatsRunHandlerError extends Error {
    constructor(error) {
        super(`Invalid handler: ${typeof error === 'string' ? error : error.reason}`);
        this.name = "NatsRunHandlerError";
    }
}
/**
 * Error thrown when an error occurs in NatsRun
 */
export class NatsRunError extends Error {
    constructor(error) {
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
     * Array of handlers in order of registration
     * Used when sortStrategy is 'insertion'
     * @internal
     */
    order = [];
    /**
     * The underlying trie data structure used for pattern matching
     * @internal
     */
    trie = new NatsTrie();
    /**
     * The strategy used for sorting matched handlers
     * @internal
     */
    sortStrategy;
    /**
     * Optional custom sorting function for handlers
     * @internal
     */
    customSort;
    /**
     * Creates a new NatsRun router
     * @param opts - Configuration options
     * @param opts.sortStrategy - Strategy for sorting matching handlers
     * @param opts.customSort - Custom sorting function for handlers
     */
    constructor(opts = {}) {
        this.sortStrategy = opts.sortStrategy ?? 'specificity';
        this.customSort = opts.customSort;
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
    add(pattern, handle) {
        if (!Array.isArray(handle))
            handle = [handle];
        if (handle.some((h) => typeof h !== 'function'))
            throw new NatsRunHandlerError("must be a function");
        try {
            this.trie.insert(pattern, handle);
            this.order.push(handle[0]);
        }
        catch (error) {
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
    match(subject = '') {
        const matches = this.trie.match(subject);
        let flatMatches = matches.flat();
        let sortedMatches;
        switch (this.sortStrategy) {
            case 'insertion':
                sortedMatches = flatMatches.sort((a, b) => {
                    const aHandler = Array.isArray(a.payload) ? a.payload[0] : a.payload;
                    const bHandler = Array.isArray(b.payload) ? b.payload[0] : b.payload;
                    return this.order.indexOf(aHandler) - this.order.indexOf(bHandler);
                });
                break;
            case 'custom':
                sortedMatches = flatMatches.sort(this.customSort);
                break;
            case 'specificity':
                sortedMatches = flatMatches.sort((a, b) => b.depth - a.depth);
                break;
            default:
                sortedMatches = flatMatches;
                break;
        }
        return sortedMatches.map(({ payload }) => payload).flat().filter(x => x !== null);
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
    async handle(subject, message, headers) {
        const matches = this.match(subject);
        for (const handler of matches) {
            await handler({ subject, headers, data: message });
        }
    }
}
