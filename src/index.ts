import { NatsTrie } from "./lib/natstrie";

// Handler is a function that takes a message and an optional match object
export type Handler = (msg: any, match?: { subject: string[], pattern: Array<string | RegExp> }) => Promise<void>;

// NatsRun is a simple router that matches NATS subject patterns to handlers
export class NatsRun {
  private trie = new NatsTrie();

  constructor() {}

  /**
   * Add a handler to the Router
   * 
   * @param {string} subject The subject to register with the handler
   * @param {Handler} handler The handler to be called when the subject matches
   * @returns {NatsRoutes} The updated Router
   */
  add(subject: string, handler: Handler): void {
    let handles = this.trie.match(subject) || [];

    handles.push(handler);
    this.trie.insert(subject, handles);
  }

  /**
   * Return all the handlers that match the subject
   * 
   * @param {string} subject The subject to match
   * @returns {Array<Handler[]>} An array of handlers that match the subject
   */
  match(subject = ''): Array<Handler[]> {
    return this.trie.match(subject);
  }

  /**
   * Handle a message, calls each handler that matches the subject
   * 
   * @param {string} subject The subject to match
   * @param {any} message The message passed to the handler
   */
  async handle(subject: string, message: any): Promise<void> {
    const matches = this.trie.match(subject);

    for (const handles of matches) {
      for (const handler of handles) {
        await handler(message, { subject });
      }
    }
  }
}