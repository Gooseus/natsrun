/**
 * A trie node that stores a payload and branches for each token in the subject
 *
 * @typeParam T - The type of payload stored in the trie node
 */
export interface ITrieNode<T> {
  /** the order of insertion */
  order: number;
  /** The depth of this node in the trie (0 for root) */
  depth: number;
  /** The topic token this node represents */
  topic: string;
  /** Map of child nodes keyed by their topic tokens */
  branches: Map<string, ITrieNode<T>>;
  /** The payload stored at this node, can be a single value or array */
  payload: T | T[] | null;
  /** Whether this node represents a complete topic pattern */
  isLeaf: boolean;
}

/**
 * A trie data structure optimized for NATS subject pattern matching.
 *
 * @typeParam T - The type of payload stored in the trie nodes
 */
export interface INatsTrie<T> {
  /** The root node of the trie */
  trieRoot: ITrieNode<T>;
  /**
   * Insert a payload into the trie under the given topic
   * @param topic - The topic to insert under
   * @param payload - The payload to store at this topic
   */
  insert(topic: string, payload: T | T[]): void;
  /**
   * Find all nodes that match the given topic
   * @param topic - The topic to match against
   * @returns Array of matching nodes
   */
  match(topic: string): ITrieNode<T>[];
  /**
   * Search for a specific topic in the trie
   * @param topic - The topic to search for
   * @returns The matching node if found, undefined otherwise
   */
  search(topic: string): ITrieNode<T> | undefined;
}

/**
 * Options for creating a new Trie node
 *
 * @typeParam T - The type of payload stored in the trie node
 */
export type TTrieOpts = {
  /** The depth of the node in the trie (0 for root) */
  depth?: number;
  /** Whether this node represents a complete subject pattern */
  isLeaf?: boolean;
  /** The subject token this node represents */
  topic?: string;
  /** The order of insertion */
  order?: number;
};

/**
 * Error thrown when an invalid NATS subject pattern is provided
 */
export class InvalidSubjectError extends Error {
  /** The invalid subject pattern that caused the error */
  subject: string;
  /** The reason why the subject pattern is invalid */
  reason: string;

  constructor(subject: string, reason: string) {
    super(`Invalid subject pattern "${subject}": ${reason}`);
    this.name = "InvalidSubjectError";
    this.subject = subject;
    this.reason = reason;
  }
}

/**
 * Error thrown when an invalid payload is provided
 */
export class InvalidPayloadError extends Error {
  /** The reason why the payload is invalid */
  reason: string;

  constructor(reason: string) {
    super(`Invalid payload: ${reason}`);
    this.name = "InvalidPayloadError";
    this.reason = reason;
  }
}

/**
 * Error thrown when an invalid operation is attempted on the trie
 */
export class TrieOperationError extends Error {
  /** The reason why the operation is invalid */
  reason: string;

  constructor(reason: string) {
    super(`Trie operation error: ${reason}`);
    this.name = "TrieOperationError";
    this.reason = reason;
  }
}

/**
 * A trie data structure optimized for NATS subject pattern matching.
 *
 * The NatsTrie implements a specialized trie (prefix tree) that handles NATS subject patterns,
 * including wildcards (* for single token) and greater-than (> for multiple tokens).
 *
 * It provides efficient subject-based routing by storing patterns in a tree structure where:
 * - Each level represents a token in the subject (delimited by periods)
 * - Branches can contain literal matches, wildcards (*), or greater-than (>)
 * - Matching follows NATS subject matching rules
 *
 * @example
 * ```typescript
 * const trie = new NatsTrie<Handler>();
 * trie.insert('user.created', handler1);
 * trie.insert('user.*.updated', handler2);
 * trie.insert('user.>', handler3);
 *
 * const matches = trie.match('user.123.updated');
 * // Returns nodes containing handler2 and handler3
 * ```
 *
 * @typeParam T - The type of payload stored in the trie nodes
 */
export class NatsTrie<T> implements INatsTrie<T> {
  /** The root node of the trie */
  trieRoot: ITrieNode<T>;

  /**
   * Create a new NatsTrie instance
   *
   * @param node Optional initial trie node to use
   */
  constructor(node?: ITrieNode<T>) {
    this.trieRoot = node ?? createTrie();
  }

  /**
   * Traverse the trie and return all nodes
   *
   * @param node The current trie node to traverse from
   * @returns Array of all nodes in the trie
   */
  traverse(node: ITrieNode<T>): ITrieNode<T>[] {
    const results: ITrieNode<T>[] = [node];
    for (const child of node.branches.values()) {
      results.push(...this.traverse(child));
    }
    return results;
  }

  /**
   * Insert a payload into the trie
   *
   * @param subject a defined subject to insert under
   * @param payload a defined payload to insert
   */
  insert(subject: string, payload: T | T[]): void {
    if (!subject) throw new InvalidSubjectError(subject, "must be defined");
    if (!payload || (Array.isArray(payload) && payload.some((p) => !p))) throw new InvalidPayloadError("must be defined");

    const topics = subject.split(".");
    if (topics.length === 0) throw new InvalidSubjectError(subject, "cannot be empty");
    if (topics.some((topic) => topic === "")) throw new InvalidSubjectError(subject, "cannot contain empty topics");
    if (topics.indexOf(">") !== -1 && topics.indexOf(">") !== topics.length - 1) throw new InvalidSubjectError(subject, '">" must be the last topic');

    insert(this.trieRoot, topics, payload);
  }

  /**
   * Lookup a subject in the trie
   *
   * @param subject the subject to lookup
   * @returns the array of payloads that match the subject
   */
  match(subject: string): ITrieNode<T>[] {
    const topics = subject.split(".");
    return match(this.trieRoot, topics);
  }

  /**
   * Find a subject in the trie
   *
   * @param subject the subject to find
   * @returns the node that matches the subject
   */
  find(subject: string): ITrieNode<T> | undefined {
    const topics = subject.split(".");
    return find(this.trieRoot, topics);
  }

  /**
   * Search for a subject in the trie
   *
   * @param subject the subject to search for
   * @returns the node that matches the subject
   */
  search(subject: string): ITrieNode<T> | undefined {
    const topics = subject.split(".");
    return search(this.trieRoot, topics);
  }
}

// Helper functions

/**
 * Create a new Trie node
 *
 * @param opts Trie options
 * @returns new Trie node
 */
function createTrie<T>({ depth = 0, isLeaf = false, topic = "", order = 0 }: TTrieOpts = {}): ITrieNode<T> {
  return { branches: new Map(), payload: null, depth, isLeaf, topic, order };
}

/**
 * Insert a payload into the trie
 *
 * @param trie the trie to insert into
 * @param subjectTopics the subject topics to insert under
 * @param payload the payload to insert
 */
function insert<T>(trie: ITrieNode<T>, subjectTopics: string[], payload: T | T[]): void {
  let node = trie;
  for (const topic of subjectTopics) {
    if (!node.branches.has(topic)) {
      node.branches.set(topic, createTrie({ depth: node.depth + 1, topic, order: node.order + 1 }));
    }
    if (node.topic === ">") break;

    node = node.branches.get(topic)!;
  }
  node.isLeaf = true;
  if (node.payload) {
    if (Array.isArray(node.payload)) {
      if (Array.isArray(payload)) {
        node.payload.push(...payload);
      } else {
        node.payload.push(payload);
      }
    } else {
      if (Array.isArray(payload)) {
        node.payload = [node.payload, ...payload];
      } else {
        node.payload = [node.payload, payload];
      }
    }
  } else {
    node.payload = payload;
  }
}

/**
 * Search for a subject in the trie
 *
 * @param node The current trie node to search from
 * @param subjectTopics Array of subject topics to match
 * @returns The matching trie node if found, undefined otherwise
 *
 * @example
 * ```typescript
 * // Search for 'user.123.profile' in trie
 * const node = search(trie, ['user', '123', 'profile']);
 * ```
 */
function search<T>(node: ITrieNode<T>, subjectTopics: string[]): ITrieNode<T> | undefined {
  if ((node.depth === subjectTopics.length && node.isLeaf) || node.topic === ">") {
    return node;
  }
  if (!node.topic && node.depth > 0) return undefined;

  const topic = subjectTopics[node.depth];

  // Exact match
  if (node.branches.has(topic)) {
    return search(node.branches.get(topic)!, subjectTopics);
  }

  // Single match wildcard '*'
  if (node.branches.has("*")) {
    return search(node.branches.get("*")!, subjectTopics);
  }

  // Full match wildcard '>'
  if (node.branches.has(">")) {
    return search(node.branches.get(">")!, subjectTopics);
  }
}

/**
 * Lookup a subject in the trie
 *
 * @param trie the trie to lookup in
 * @param subjectTopics the subject topics to lookup
 * @returns array of payloads that match the subject
 */
function match<T>(trie: ITrieNode<T>, subjectTopics: string[]): ITrieNode<T>[] {
  let results: ITrieNode<T>[] = [];

  function search(node: ITrieNode<T>, index: number): void {
    if ((index === subjectTopics.length && node.isLeaf) || node.topic === ">") {
      results.push(node);
      return;
    }

    const topic = subjectTopics[index];

    // Exact match
    if (node.branches.has(topic)) {
      search(node.branches.get(topic)!, index + 1);
    }

    // Single match wildcard '*'
    if (node.branches.has("*")) {
      search(node.branches.get("*")!, index + 1);
    }

    // Full match wildcard '>'
    if (node.branches.has(">")) {
      search(node.branches.get(">")!, index + 1);
    }
  }

  search(trie, 0);
  return results;
}

/**
 * Lookup a subject in the trie
 *
 * @param trie the trie to lookup in
 * @param subjectTopics the subject topics to lookup
 * @returns array of payloads that match the subject
 */
function find<T>(trie: ITrieNode<T>, subjectTopics: string[]): ITrieNode<T> | undefined {
  function search(node: ITrieNode<T>, index: number): ITrieNode<T> | undefined {
    if (index === subjectTopics.length || node.isLeaf) {
      return node;
    }

    const topic = subjectTopics[index];

    if (node.branches.has(topic)) {
      return search(node.branches.get(topic)!, index + 1);
    }

    return undefined;
  }

  return search(trie, 0);
}
