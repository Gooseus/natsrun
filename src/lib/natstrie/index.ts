import { StringPool } from "../string-pool/index.js";
import { Branch, BranchOps, BranchType } from "../branches/index.js";
import { InvalidSubjectError, InvalidPayloadError, TrieOperationError } from "../errors/index.js";

export { BranchType } from "../branches/index.js";
export { InvalidPayloadError, InvalidSubjectError } from "../errors/index.js";

/**
 * A trie node that stores a payload and branches for each token in the subject
 *
 * @typeParam T - The type of payload stored in the trie node
 */
export interface ITrieNode<T> {
  /** The topic token ID this node represents (from string pool) */
  t?: number;
  /** The branch of the trie, either a map or an array of [topic, node] tuples */
  b?: Branch<T>;
  /** The payload stored at this node, can be a single value or array */
  p?: T | T[];
}

/**
 * Default threshold for converting an array branch to a map branch
 * When a branch grows beyond this size, it will be converted from an array to a map for better performance
 */
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
  /** The subject token this node represents */
  topicId?: number;
};

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
  /** The string pool for interning topic strings */
  private stringPool: StringPool;
  /** The root node of the trie */
  trieRoot: ITrieNode<T>;
  /** The threshold for converting an array of [topic, node] tuples to a map */
  arrayToMapThreshold: number = DEFAULT_ARRAY_TO_MAP_THRESHOLD;

  /**
   * Create a new NatsTrie instance
   *
   * @param node Optional initial trie node to use
   */
  constructor(node?: ITrieNode<T>) {
    this.stringPool = new StringPool();
    this.trieRoot = node ?? createTrie({});
  }

  /**
   * Traverse the trie and return all nodes
   *
   * @param node The current trie node to traverse from
   * @returns Array of all nodes in the trie
   */
  traverse(node: ITrieNode<T>): ITrieNode<T>[] {
    const results: ITrieNode<T>[] = [node];
    if(!node.b) return results;

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

    insert(this.trieRoot, topics, payload, this.stringPool, this.arrayToMapThreshold);
  }

  /**
   * Lookup a subject in the trie
   *
   * @param subject the subject to lookup
   * @returns the array of payloads that match the subject
   */
  match(subject: string): ITrieNode<T>[] {
    return match(this.trieRoot, subject.split(".").map((t) => this.stringPool.intern(t)));
  }

  /**
   * Search for a subject in the trie
   *
   * @param subject the subject to search for
   * @returns the node that matches the subject
   */
  search(subject: string): ITrieNode<T> | undefined {
    return search(this.trieRoot, subject.split("."), this.stringPool);
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
function createTrie<T>({ topicId = -1 }: TTrieOpts): ITrieNode<T> {
  const node: ITrieNode<T> = {
    b: { _t: BranchType.Array, i: [] },
  };
  if (topicId !== -1) {
    node.t = topicId;
  }
  return node;
}

/**
 * Insert a payload into the trie
 *
 * @param trie the trie to insert into
 * @param subjectTopics the subject topics to insert under
 * @param payload the payload to insert
 * @param stringPool the string pool to use for interning topic strings
 */
function insert<T>(
  trie: ITrieNode<T>,
  subjectTopics: string[],
  payload: T | T[],
  stringPool: StringPool,
  arrayToMapThreshold: number = DEFAULT_ARRAY_TO_MAP_THRESHOLD
): void {
  let currentNode = trie;

  for (let i = 0; i < subjectTopics.length; i++) {
    const topic = subjectTopics[i];
    const topicId = stringPool.intern(topic);
    if(!currentNode.b) continue;

    let child = BranchOps.get(currentNode.b, topicId) ?? createTrie({ topicId });
    if (BranchOps.size(currentNode.b) >= arrayToMapThreshold) {
      currentNode = convertToMap(currentNode);
    }
    if(!currentNode.b) throw Error("Something went wrong");
    BranchOps.set(currentNode.b, topicId, child);
    currentNode = child;
  }

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
  if (!node.b) return node;
  if (node.b._t === BranchType.Map) return node;

  const map = new Map<number, ITrieNode<T>>();
  for (const [key, value] of node.b.i) {
    map.set(key, value);
  }

  node.b = { _t: BranchType.Map, i: map };
  return node;
}

function search<T>(trie: ITrieNode<T>, subjectTopics: string[], stringPool: StringPool, depth: number = 0): ITrieNode<T> | undefined {
  if (depth === subjectTopics.length) {
    if (trie.p || trie.t === stringPool.intern(">")) {
      return trie;
    }
    return undefined;
  }

  if (!trie.b || (!trie.t && depth > 0)) return undefined;

  const topic = subjectTopics[depth];
  const topicId = stringPool.intern(topic);
  const starId = stringPool.intern("*");
  const gtId = stringPool.intern(">");


  const exactMatch = BranchOps.get(trie.b, topicId);
  if (exactMatch) {
    const result = search(exactMatch, subjectTopics, stringPool, depth + 1);
    if (result) return result;
  }

  const starMatch = BranchOps.get(trie.b, starId);
  if (starMatch) {
    const result = search(starMatch, subjectTopics, stringPool, depth + 1);
    if (result) return result;
  }

  const gtMatch = BranchOps.get(trie.b, gtId);
  if (gtMatch) {
    return gtMatch;
  }

  return undefined;
}

function match<T>(node: ITrieNode<T>, topics: number[], index: number = 0, results: ITrieNode<T>[] = []): ITrieNode<T>[] {
  if (index === topics.length) {
    if (node.p || node.t === 0) {
      results.push(node);
    }
    return results;
  }

  const topicId = topics[index];
  if(!node.b) return results;

  if (node.b._t === BranchType.Array) {
    for (const [t, child] of node.b.i) {
      if (t !== undefined && child) {
        if (t === 0) {
          results.push(child);
        } else if (t === 1 || t === topicId) {
          match(child, topics, index + 1, results);
        }
      }
    }
  } else if (node.b._t === BranchType.Map) {
    if (node.b.i.has(topicId)) {
      match(node.b.i.get(topicId)!, topics, index + 1, results);
    }
    if (node.b.i.has(1)) {
      match(node.b.i.get(1)!, topics, index + 1);
    }
    if (node.b.i.has(0)) {
      results.push(node.b.i.get(0)!);
    }
  }

  return results;
}
