type NatsRoutes = Map<string, Handler[]>;
type Handler = (msg: any, pattern?: string | RegExp) => Promise<void>;
export declare class NatsRun {
    map: NatsRoutes;
    store: any;
    constructor();
    parse(subject: string): Array<string | RegExp>;
    /**
     * Add a handler to the Router
     *
     * @param {string} subject The subject to register with the handler
     * @param {Handler} handler The handler to be called when the subject matches
     * @returns {NatsRoutes} The updated Router
     */
    add(subject: string, handler: Handler): void;
    list(subject?: string, opts?: {}): Array<Handler[]>;
    iterate(subject: string, opts?: {}): Iterable<{
        pattern: Array<string | RegExp>;
        payload: Handler[];
    }>;
    /**
     * Handle a message, calls each handler that matches the subject
     *
     * @param {string} subject The subject to match
     * @param {any} message The message passed to the handler
     */
    handle(subject: string, message: any): Promise<void>;
}
export {};
