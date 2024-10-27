import Bloomrun from './lib/bloomrun';

type NatsRoutes = Map<string, Handler[]>;
type Handler = (msg: any, pattern?: string | RegExp) => Promise<void>;

class PatternError extends Error {
  constructor(message: string, subject: string, error: Error) {
    super(`PatternError: ${subject} => ${message}\n\nError: ${error?.message}`);
    this.name = 'PatternError';
    this.stack = error?.stack;
  }
}

const NatsRouteRegExp: Record<string, RegExp> = {
  MATCH: /^[a-zA-z0-9-_]+$/,
  REST: /^[a-zA-z0-9-_.]+$/,
};

export class NatsRun {
  map: NatsRoutes;

  store = new Bloomrun();

  constructor() {
    this.map = new Map();
  }

  parse(subject: string) : Array<string | RegExp> {
    if(!subject || typeof subject !== 'string')
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
  add(subject: string, handler: Handler): void {
    let parsed;
    try {
      parsed = this.parse(subject);
    } catch (e) {
      console.error(e);
      if(e instanceof PatternError) throw e;
      throw new PatternError('Invalid pattern', subject, e as Error);
    }
    
    let handles = this.store.lookup(parsed) || [];

    handles.push(handler);
    this.store.add(parsed, handles);
  }

  list(subject?: string, opts = {}): Array<Handler[]> {
    return this.store.list(subject?.split('.'), opts);
  }
  
  iterate(subject: string, opts = {}): Iterable<{ pattern: Array<string | RegExp>, payload: Handler[] }> {
    return this.store.iterator(subject.split('.'), { patterns: true, payloads: true });
  }

  /**
   * Handle a message, calls each handler that matches the subject
   * 
   * @param {string} subject The subject to match
   * @param {any} message The message passed to the handler
   */
  async handle(subject: string, message: any): Promise<void> {
    const matches = this.iterate(subject);

    for (const { pattern, payload } of matches) {
      let idx = 0;
      for(const handler of payload) {
        await handler(message, pattern[idx]);
        idx++;
      }
    }
  }
}