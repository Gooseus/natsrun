export type Handler = (msg: any, match?: {
    subject: string[];
    pattern: Array<string | RegExp>;
}) => Promise<void>;
export declare class NatsRun {
    private trie;
    constructor();
    /**
     * Add a handler to the Router
     *
     * @param {string} subject The subject to register with the handler
     * @param {Handler} handler The handler to be called when the subject matches
     * @returns {NatsRoutes} The updated Router
     */
    add(subject: string, handler: Handler): void;
    /**
     * Return all the handlers that match the subject
     *
     * @param {string} subject The subject to match
     * @returns {Array<Handler[]>} An array of handlers that match the subject
     */
    match(subject?: string): Array<Handler[]>;
    /**
     * Handle a message, calls each handler that matches the subject
     *
     * @param {string} subject The subject to match
     * @param {any} message The message passed to the handler
     */
    handle(subject: string, message: any): Promise<void>;
}
