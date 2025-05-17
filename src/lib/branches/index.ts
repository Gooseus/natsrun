import { ITrieNode } from "../natstrie/index.js";

/**
 * The type of branch in the trie
 */
export enum BranchType {
  /** Branch stored as an array for small collections */
  Array = 0,
  /** Branch stored as a map for larger collections */
  Map = 1
}
/**
 * A branch of the trie, an array of [topic, node] tuples
 * @typeParam T - The type of payload stored in the trie node
 */
export type ArrayBranch<T> = {
  /** The branch type identifier */
  _t: BranchType.Array;
  /** Array of topic ID to node mappings */
  i: Array<[number, ITrieNode<T>]>;
};
/**
 * A branch of the trie, a map of [topic, node] tuples
 * @typeParam T - The type of payload stored in the trie node
 */
export type MapBranch<T> = {
  /** The branch type identifier */
  _t: BranchType.Map;
  /** Map of topic ID to node mappings */
  i: Map<number, ITrieNode<T>>;
};
/**
 * A branch of the trie, either a map or an array of [topic, node] tuples
 * @typeParam T - The type of payload stored in the trie node
 */
export type Branch<T> = ArrayBranch<T> | MapBranch<T>;

/**
 * Unified branch operations
 */
export const BranchOps = {
  /**
   * Get a node from a branch by key
   * @param branch - The branch to get from
   * @param key - The key to look up
   * @returns The node if found, undefined otherwise
   */
  get<T>(branch: Branch<T>, key: number): ITrieNode<T> | undefined {
    return branch._t === BranchType.Array
      ? branch.i.find(([k]) => k === key)?.[1]
      : branch.i.get(key);
  },
  
  /**
   * Set a node in a branch
   * @param branch - The branch to set in
   * @param key - The key to set
   * @param value - The node to set
   */
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

  /**
   * Check if a branch has a key
   * @param branch - The branch to check
   * @param key - The key to look for
   * @returns Whether the key exists in the branch
   */
  has<T>(branch: Branch<T>, key: number): boolean {
    return branch._t === BranchType.Array
      ? branch.i.some(([k]) => k === key)
      : branch.i.has(key);
  },

  /**
   * Get the size of a branch
   * @param branch - The branch to get the size of
   * @returns The number of entries in the branch
   */
  size<T>(branch: Branch<T>): number {
    return branch._t === BranchType.Array ? branch.i.length : branch.i.size;
  },

  /**
   * Get an iterator over the entries in a branch
   * @param branch - The branch to iterate over
   * @returns An iterator over [key, node] pairs
   */
  entries<T>(branch: Branch<T>): IterableIterator<[number, ITrieNode<T>]> {
    return branch._t === BranchType.Array
      ? branch.i[Symbol.iterator]()
      : branch.i.entries();
  }
};
