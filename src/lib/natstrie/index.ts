import { StringPool } from './string-pool.js';

/**
 * The type of branch in the trie
 */
export enum BranchType {
  Array = 0,
  Map = 1
}
/**
 * A branch of the trie, an array of [topic, node] tuples
 * @typeParam T - The type of payload stored in the trie node
 */
type ArrayBranch<T> = {
  _t: BranchType.Array;
  i: Array<[number, ITrieNode<T>]>;
};
/**
 * A branch of the trie, a map of [topic, node] tuples
 * @typeParam T - The type of payload stored in the trie node
 */
type MapBranch<T> = {
  _t: BranchType.Map;
  i: Map<number, ITrieNode<T>>;
};
/**
 * A branch of the trie, either a map or an array of [topic, node] tuples
 * @typeParam T - The type of payload stored in the trie node
 */
type Branch<T> = ArrayBranch<T> | MapBranch<T>;

/**
 * A trie node that stores a payload and branches for each token in the subject
 *
 * @typeParam T - The type of payload stored in the trie node
 */
export interface ITrieNode<T> {
  /** The topic token ID this node represents (from string pool) */
  t?: number;
  /** The branch of the trie, either a map or an array of [topic, node] tuples */
  b: Branch<T>;
  /** The payload stored at this node, can be a single value or array */
  p?: T | T[];
  /** Whether this node represents a complete topic pattern */
  l?: boolean;
}

type ITrieMapNode<T> = ITrieNode<T> & { b: MapBranch<T> };
type ITrieArrayNode<T> = ITrieNode<T> & { b: ArrayBranch<T> };

export const DEFAULT_ARRAY_TO_MAP_THRESHOLD = 32;

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
  /** The threshold for converting an array of [topic, node] tuples to a map */
  arrayToMapThreshold: number;
  /** The string pool for interning topic strings */
  private stringPool: StringPool;

  /**
   * Create a new NatsTrie instance
   *
   * @param node Optional initial trie node to use
   */
  constructor(node?: ITrieNode<T>, opts: { arrayToMapThreshold?: number } = {}) {
    this.stringPool = new StringPool(['*', '>']);
    this.trieRoot = node ?? createTrie({ stringPool: this.stringPool });
    this.arrayToMapThreshold = opts.arrayToMapThreshold ?? DEFAULT_ARRAY_TO_MAP_THRESHOLD;
  }

  /**
   * Traverse the trie and return all nodes
   *
   * @param node The current trie node to traverse from
   * @returns Array of all nodes in the trie
   */
  traverse(node: ITrieNode<T>): ITrieNode<T>[] {
    const results: ITrieNode<T>[] = [node];
    if (node.b._t === BranchType.Array) {
      for (const [_, child] of node.b.i) {
        results.push(...this.traverse(child));
      }
    } else if (node.b._t === BranchType.Map) {
      for (const child of node.b.i.values()) {
        results.push(...this.traverse(child));
      }
    } else {
      throw new TrieOperationError("invalid branch type");
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

    insert(this.trieRoot, topics, payload, this.stringPool);
  }

  /**
   * Lookup a subject in the trie
   *
   * @param subject the subject to lookup
   * @returns the array of payloads that match the subject
   */
  match(subject: string, debug: boolean = false): ITrieNode<T>[] {
    return match(this.trieRoot, subject.split("."), this.stringPool, debug);
  }

  /**
   * Find a subject in the trie
   *
   * @param subject the subject to find
   * @returns the node that matches the subject
   */
  find(subject: string): ITrieNode<T> | undefined {
    return find(this.trieRoot, subject.split("."), this.stringPool);
  }

  /**
   * Search for a subject in the trie
   *
   * @param subject the subject to search for
   * @returns the node that matches the subject
   */
  search(subject: string, debug: boolean = false): ITrieNode<T> | undefined {
    return search(this.trieRoot, subject.split("."), this.stringPool, 0, debug);
  }

  /**
   * Get the string for a topic ID
   * @param id The topic ID to look up
   * @returns The string associated with the ID
   */
  getTopicString(id: number): string {
    return this.stringPool.getString(id);
  }

  /**
   * Get the ID for a topic string
   * @param str The string to intern
   * @returns The ID of the string in the pool
   */
  getTopicId(str: string): number {
    return this.stringPool.intern(str);
  }
}

// Helper functions

/**
 * Create a new Trie node
 *
 * @param opts Trie options
 * @returns new Trie node
 */
function createTrie<T>({ isLeaf = false, topic = "", stringPool }: TTrieOpts & { stringPool: StringPool }): ITrieNode<T> {
  return {
    b: { _t: BranchType.Array, i: [] },
    p: [] as T[],
    l: isLeaf,
    t: topic ? stringPool.intern(topic) : undefined
  };
}

/**
 * Insert a payload into the trie
 *
 * @param trie the trie to insert into
 * @param subjectTopics the subject topics to insert under
 * @param payload the payload to insert
 * @param stringPool the string pool to use for interning topic strings
 */
function insert<T>(trie: ITrieNode<T>, subjectTopics: string[], payload: T | T[], stringPool: StringPool): void {
  let currentNode = trie;
  const lastIndex = subjectTopics.length - 1;

  for (let i = 0; i < subjectTopics.length; i++) {
    const topic = subjectTopics[i];
    const topicId = stringPool.intern(topic);
    const isLast = i === lastIndex;

    if (isLast) {
      let child = BranchOps.get(currentNode.b, topicId);
      if (!child) {
        if (BranchOps.size(currentNode.b) >= DEFAULT_ARRAY_TO_MAP_THRESHOLD) {
          currentNode = convertToMap(currentNode);
        }
        child = createTrie({ topic, isLeaf: true, stringPool });
        BranchOps.set(currentNode.b, topicId, child);
      }
      currentNode = child;
    } else {
      let child = BranchOps.get(currentNode.b, topicId);
      if (!child) {
        if (BranchOps.size(currentNode.b) >= DEFAULT_ARRAY_TO_MAP_THRESHOLD) {
          currentNode = convertToMap(currentNode);
        }
        child = createTrie({ topic, stringPool });
        BranchOps.set(currentNode.b, topicId, child);
      }
      currentNode = child;
    }
  }

  // Handle payload
  currentNode.l = true;
  if (Array.isArray(currentNode.p)) {
    if (Array.isArray(payload)) {
      currentNode.p.push(...payload);
    } else {
      currentNode.p.push(payload);
    }
  } else {
    currentNode.p = currentNode.p ? [currentNode.p] : [];
    if (Array.isArray(payload)) {
      currentNode.p = [...currentNode.p, ...payload];
    } else {
      currentNode.p = [...currentNode.p, payload];
    }
  }
}

function convertToMap<T>(node: ITrieNode<T>): ITrieNode<T> {
  if (node.b._t === BranchType.Map) return node;
  
  const map = new Map<number, ITrieNode<T>>();
  for (const [key, value] of node.b.i) {
    map.set(key, value);
  }
  
  node.b = { _t: BranchType.Map, i: map };
  return node;
}

function search<T>(trie: ITrieNode<T>, subjectTopics: string[], stringPool: StringPool, depth: number = 0, debug: boolean = false): ITrieNode<T> | undefined {
  if (debug) console.log("search 1", trie, subjectTopics, depth);
  if (depth === subjectTopics.length) {
    if (trie.l || trie.t === stringPool.intern(">")) {
      return trie;
    }
    return undefined;
  }
  
  if (!trie.t && depth > 0) return undefined;

  const topic = subjectTopics[depth];
  const topicId = stringPool.intern(topic);
  const starId = stringPool.intern("*");
  const gtId = stringPool.intern(">");

  if (debug) console.log("search 2", topic, topicId, starId, gtId);

  // Check exact match
  const exactMatch = BranchOps.get(trie.b, topicId);
  if (debug) console.log("search 3 exactMatch", exactMatch);
  if (exactMatch) {
    const result = search(exactMatch, subjectTopics, stringPool, depth + 1, debug);
    if (result) return result;
  }

  // Check wildcards
  const starMatch = BranchOps.get(trie.b, starId);
  if (debug) console.log("search 3 starMatch", starMatch);
  if (starMatch) {
    const result = search(starMatch, subjectTopics, stringPool, depth + 1, debug);
    if (result) return result;
  }

  // Check greater-than
  const gtMatch = BranchOps.get(trie.b, gtId);
  if (debug) console.log("search 3 gtMatch", gtMatch);
  if (gtMatch) {
    return gtMatch;
  }

  return undefined;
}

/**
 * Lookup a subject in the trie
 *
 * @param trie the trie to lookup in
 * @param subjectTopics the subject topics to lookup
 * @param stringPool the string pool to use for interning topic strings
 * @returns array of payloads that match the subject
 */
function match<T>(trie: ITrieNode<T>, subjectTopics: string[], stringPool: StringPool, debug: boolean = false): ITrieNode<T>[] {
  let results: ITrieNode<T>[] = [];
  const starId = stringPool.intern("*");
  const gtId = stringPool.intern(">");
  
  function _search(node: ITrieNode<T>, index: number): void {
    if (index === subjectTopics.length) {
      if (node.l || node.t === gtId) {
        results.push(node);
      }
      return;
    }

    const topic = subjectTopics[index];
    const topicId = stringPool.intern(topic);

    if (node.b._t === BranchType.Array) {
      for (const [t, child] of node.b.i) {
        if (t && child) {
          if(t === gtId) {
            results.push(child);
          } else if (t === starId || t === topicId) {
            _search(child, index + 1);
          }
        }
      }
    } else if (node.b._t === BranchType.Map) {
      if (node.b.i.has(topicId)) {
        _search(node.b.i.get(topicId)!, index + 1);
      }
      if (node.b.i.has(starId)) {
        _search(node.b.i.get(starId)!, index + 1);
      }
      if (node.b.i.has(gtId)) {
        results.push(node.b.i.get(gtId)!);
      }
    }
  }

  _search(trie, 0);
  return results;
}

/**
 * Lookup a subject in the trie
 *
 * @param trie the trie to lookup in
 * @param subjectTopics the subject topics to lookup
 * @param stringPool the string pool to use for interning topic strings
 * @returns array of payloads that match the subject
 */
function find<T>(trie: ITrieNode<T>, subjectTopics: string[], stringPool: StringPool): ITrieNode<T> | undefined {
  function search(node: ITrieNode<T>, index: number): ITrieNode<T> | undefined {
    if (index === subjectTopics.length) {
      return node.l ? node : undefined;
    }

    const topic = subjectTopics[index];
    const topicId = stringPool.intern(topic);

    if (node.b._t === BranchType.Array) {
      for (const [t, child] of node.b.i) {
        if (t === topicId) {
          return search(child, index + 1);
        }
      }
    } else if (node.b._t === BranchType.Map) {
      if (node.b.i.has(topicId)) {
        return search(node.b.i.get(topicId)!, index + 1);
      }
    }

    return undefined;
  }

  return search(trie, 0);
}

// Unified branch operations
const BranchOps = {
  get<T>(branch: Branch<T>, key: number): ITrieNode<T> | undefined {
    return branch._t === BranchType.Array
      ? branch.i.find(([k]) => k === key)?.[1]
      : branch.i.get(key);
  },
  
  set<T>(branch: Branch<T>, key: number, value: ITrieNode<T>): void {
    if (branch._t === BranchType.Array) {
      const index = branch.i.findIndex(([k]) => k === key);
      if (index >= 0) {
        branch.i[index] = [key, value];
      } else {
        branch.i.push([key, value]);
      }
    } else {
      branch.i.set(key, value);
    }
  },

  has<T>(branch: Branch<T>, key: number): boolean {
    return branch._t === BranchType.Array
      ? branch.i.some(([k]) => k === key)
      : branch.i.has(key);
  },

  size<T>(branch: Branch<T>): number {
    return branch._t === BranchType.Array ? branch.i.length : branch.i.size;
  },

  entries<T>(branch: Branch<T>): IterableIterator<[number, ITrieNode<T>]> {
    return branch._t === BranchType.Array
      ? branch.i[Symbol.iterator]()
      : branch.i.entries();
  }
};

function getOrCreateChild<T>(node: ITrieNode<T>, topic: string, stringPool: StringPool): ITrieNode<T> {
  const topicId = stringPool.intern(topic);
  const existing = BranchOps.get(node.b, topicId);
  if (existing) return existing;

  const newNode = createTrie<T>({ topic, stringPool });
  BranchOps.set(node.b, topicId, newNode);
  return newNode;
}
