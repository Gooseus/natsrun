import Bloomrun from './lib/bloomrun';
class PatternError extends Error {
    constructor(message, subject, error) {
        super(`PatternError: ${subject} => ${message}\n\nError: ${error?.message}`);
        this.name = 'PatternError';
        this.stack = error?.stack;
    }
}
const NatsRouteRegExp = {
    MATCH: /^[a-zA-z0-9-_]+$/,
    REST: /^[a-zA-z0-9-_.]+$/,
};
export class NatsRun {
    map;
    store = new Bloomrun();
    constructor() {
        this.map = new Map();
    }
    parse(subject) {
        if (!subject || typeof subject !== 'string')
            throw new PatternError('Invalid pattern', subject, new Error('Subject must be a string'));
        const parsed = [];
        for (const part of subject.split('.')) {
            if (part === '>') {
                parsed.push(NatsRouteRegExp.REST);
                break;
            }
            parsed.push(part === '*' ? NatsRouteRegExp.MATCH : part);
        }
        return parsed;
    }
    /**
     * Add a handler to the Router
     *
     * @param {string} subject The subject to register with the handler
     * @param {Handler} handler The handler to be called when the subject matches
     * @returns {NatsRoutes} The updated Router
     */
    add(subject, handler) {
        let parsed;
        try {
            parsed = this.parse(subject);
        }
        catch (e) {
            console.error(e);
            if (e instanceof PatternError)
                throw e;
            throw new PatternError('Invalid pattern', subject, e);
        }
        let handles = this.store.lookup(parsed) || [];
        handles.push(handler);
        this.store.add(parsed, handles);
    }
    list(subject, opts = {}) {
        return this.store.list(subject?.split('.'), opts);
    }
    iterate(subject, opts = {}) {
        return this.store.iterator(subject.split('.'), { patterns: true, payloads: true });
    }
    /**
     * Handle a message, calls each handler that matches the subject
     *
     * @param {string} subject The subject to match
     * @param {any} message The message passed to the handler
     */
    async handle(subject, message) {
        const matches = this.iterate(subject);
        for (const { pattern, payload } of matches) {
            for (const handler of payload) {
                await handler(message, { subject: subject.split('.'), pattern });
            }
        }
    }
}
