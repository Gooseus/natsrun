import { ITrieNode } from "../natstrie/index.js";

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
export type ArrayBranch<T> = {
  _t: BranchType.Array;
  i: Array<[number, ITrieNode<T>]>;
};
/**
 * A branch of the trie, a map of [topic, node] tuples
 * @typeParam T - The type of payload stored in the trie node
 */
export type MapBranch<T> = {
  _t: BranchType.Map;
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
