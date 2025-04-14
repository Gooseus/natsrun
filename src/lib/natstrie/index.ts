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
  i: Array<[string, ITrieNode<T>]>;
};
/**
 * A branch of the trie, a map of [topic, node] tuples
 * @typeParam T - The type of payload stored in the trie node
 */
type MapBranch<T> = {
  _t: BranchType.Map;
  i: Map<string, ITrieNode<T>>;
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
  /** The topic token this node represents */
  t?: string;
  /** The branch of the trie, either a map or an array of [topic, node] tuples */
  b: Branch<T>;
  /** The payload stored at this node, can be a single value or array */
  p?: T | T[];
  /** Whether this node represents a complete topic pattern */
  l?: boolean;
}

type ITrieMapNode<T> = ITrieNode<T> & { b: MapBranch<T> };
type ITrieArrayNode<T> = ITrieNode<T> & { b: ArrayBranch<T> };

export const DEFAULT_ARRAY_TO_MAP_THRESHOLD = 8;

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

  /**
   * Create a new NatsTrie instance
   *
   * @param node Optional initial trie node to use
   */
  constructor(node?: ITrieNode<T>, opts: { arrayToMapThreshold?: number } = {}) {
    this.trieRoot = node ?? createTrie();
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

    insert(this.trieRoot, topics, payload);
  }

  /**
   * Lookup a subject in the trie
   *
   * @param subject the subject to lookup
   * @returns the array of payloads that match the subject
   */
  match(subject: string): ITrieNode<T>[] {
    return match(this.trieRoot, subject.split("."));
  }

  /**
   * Find a subject in the trie
   *
   * @param subject the subject to find
   * @returns the node that matches the subject
   */
  find(subject: string): ITrieNode<T> | undefined {
    return find(this.trieRoot, subject.split("."));
  }

  /**
   * Search for a subject in the trie
   *
   * @param subject the subject to search for
   * @returns the node that matches the subject
   */
  search(subject: string): ITrieNode<T> | undefined {
    return search(this.trieRoot, subject.split("."));
  }
}

// Helper functions

/**
 * Create a new Trie node
 *
 * @param opts Trie options
 * @returns new Trie node
 */
function createTrie<T>({ isLeaf = false, topic = "" }: TTrieOpts = {}): ITrieNode<T> {
  return {
    b: { _t: BranchType.Array, i: [] },
    p: [] as T[],
    l: isLeaf,
    t: topic
  };
}

/**
 * Insert a payload into the trie
 *
 * @param trie the trie to insert into
 * @param subjectTopics the subject topics to insert under
 * @param payload the payload to insert
 */
function insert<T>(trie: ITrieNode<T>, subjectTopics: string[], payload: T | T[]): void {
  let currentNode = trie;
  const lastIndex = subjectTopics.length - 1;

  for (let i = 0; i < subjectTopics.length; i++) {
    const topic = subjectTopics[i];
    const isLast = i === lastIndex;

    // Get or create child node
    let child = BranchOps.get(currentNode.b, topic);
    if (!child) {
      // Check if we need to convert to map
      if (BranchOps.size(currentNode.b) >= DEFAULT_ARRAY_TO_MAP_THRESHOLD) {
        currentNode = convertToMap(currentNode);
      }
      
      child = createTrie({ topic, isLeaf: isLast });
      BranchOps.set(currentNode.b, topic, child);
    }

    currentNode = child;
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
  
  node.b = { _t: BranchType.Map, i: new Map(node.b.i) };
  return node as ITrieMapNode<T>;
}

function search<T>(trie: ITrieNode<T>, subjectTopics: string[], depth: number = 0): ITrieNode<T> | undefined {
  if ((depth === subjectTopics.length && trie.l) || trie.t === ">") {
    return trie;
  }
  
  if (!trie.t && depth > 0) return undefined;

  const topic = subjectTopics[depth];

  // Check exact match
  const exactMatch = BranchOps.get(trie.b, topic);
  if (exactMatch) {
    return search(exactMatch, subjectTopics, depth + 1);
  }

  // Check wildcards
  const starMatch = BranchOps.get(trie.b, "*");
  if (starMatch) {
    const result = search(starMatch, subjectTopics, depth + 1);
    if (result) return result;
  }

  const gtMatch = BranchOps.get(trie.b, ">");
  if (gtMatch) {
    return search(gtMatch, subjectTopics, depth + 1);
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
    if ((index === subjectTopics.length && node.l) || node.t === ">") {
      results.push(node);
      return;
    }

    const topic = subjectTopics[index];

    if (node.b._t === BranchType.Array) {
      for (const [t, child] of node.b.i) {
        if (t === topic) {
          search(child, index + 1);
        }
        if (t === "*") {
          search(child, index + 1);
        }
        if (t === ">") {
          search(child, index + 1);
        } 
      }
    } else if (node.b._t === BranchType.Map) {
      if (node.b.i.has(topic)) {
        search(node.b.i.get(topic)! as ITrieMapNode<T>, index + 1);
      }
      if (node.b.i.has("*")) {
        search(node.b.i.get("*")!, index + 1);
      }
      if (node.b.i.has(">")) {
        search(node.b.i.get(">")!, index + 1);
      } 
    } else {
      throw new TrieOperationError("Invalid branch type");
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
    if (index === subjectTopics.length || node.l) {
      return node;
    }

    const topic = subjectTopics[index];

    if (node.b._t === BranchType.Array) {
      for (const [t, child] of node.b.i) {
        if (t === topic) {
          return search(child, index + 1);
        }
      }
    } else if (node.b._t === BranchType.Map) {
      if (node.b.i.has(topic)) {
        return search(node.b.i.get(topic)! as ITrieMapNode<T>, index + 1);
      }
    }

    return undefined;
  }

  return search(trie, 0);
}

// Unified branch operations
const BranchOps = {
  get<T>(branch: Branch<T>, key: string): ITrieNode<T> | undefined {
    return branch._t === BranchType.Array
      ? branch.i.find(([k]) => k === key)?.[1]
      : branch.i.get(key);
  },
  
  set<T>(branch: Branch<T>, key: string, value: ITrieNode<T>): void {
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

  has<T>(branch: Branch<T>, key: string): boolean {
    return branch._t === BranchType.Array
      ? branch.i.some(([k]) => k === key)
      : branch.i.has(key);
  },

  size<T>(branch: Branch<T>): number {
    return branch._t === BranchType.Array ? branch.i.length : branch.i.size;
  },

  entries<T>(branch: Branch<T>): IterableIterator<[string, ITrieNode<T>]> {
    return branch._t === BranchType.Array
      ? branch.i[Symbol.iterator]()
      : branch.i.entries();
  }
};

function getOrCreateChild<T>(node: ITrieNode<T>, topic: string): ITrieNode<T> {
  const existing = BranchOps.get(node.b, topic);
  if (existing) return existing;

  const newNode = createTrie<T>({ topic });
  BranchOps.set(node.b, topic, newNode);
  return newNode;
}
