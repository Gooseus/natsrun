import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Branch, BranchOps, BranchType } from '../../src/lib/branches/index.js';
import { ITrieNode } from '../../src/lib/natstrie/index.js';

describe('Branch Operations', () => {
  let arrayBranch: Branch<string>;
  let mapBranch: Branch<string>;

  beforeEach(() => {
    arrayBranch = { _t: BranchType.Array, i: [] };
    mapBranch = { _t: BranchType.Map, i: new Map() };
  });

  describe('get', () => {
    it('should get value from array branch', () => {
      const node: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test' };
      (arrayBranch.i as [number, ITrieNode<string>][]).push([1, node]);
      assert.strictEqual(BranchOps.get(arrayBranch, 1), node);
    });

    it('should get value from map branch', () => {
      const node: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test' };
      (mapBranch.i as Map<number, ITrieNode<string>>).set(1, node);
      assert.strictEqual(BranchOps.get(mapBranch, 1), node);
    });

    it('should return undefined for non-existent key in array', () => {
      assert.strictEqual(BranchOps.get(arrayBranch, 1), undefined);
    });

    it('should return undefined for non-existent key in map', () => {
      assert.strictEqual(BranchOps.get(mapBranch, 1), undefined);
    });
  });

  describe('set', () => {
    it('should set value in array branch', () => {
      const node: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test' };
      BranchOps.set(arrayBranch, 1, node);
      assert.strictEqual((arrayBranch.i as [number, ITrieNode<string>][])[0][0], 1);
      assert.strictEqual((arrayBranch.i as [number, ITrieNode<string>][])[0][1], node);
    });

    it('should update existing value in array branch', () => {
      const node1: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test1' };
      const node2: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test2' };
      (arrayBranch.i as [number, ITrieNode<string>][]).push([1, node1]);
      BranchOps.set(arrayBranch, 1, node2);
      assert.strictEqual((arrayBranch.i as [number, ITrieNode<string>][])[0][1], node2);
    });

    it('should set value in map branch', () => {
      const node: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test' };
      BranchOps.set(mapBranch, 1, node);
      assert.strictEqual((mapBranch.i as Map<number, ITrieNode<string>>).get(1), node);
    });
  });

  describe('has', () => {
    it('should check existence in array branch', () => {
      const node: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test' };
      (arrayBranch.i as [number, ITrieNode<string>][]).push([1, node]);
      assert.strictEqual(BranchOps.has(arrayBranch, 1), true);
      assert.strictEqual(BranchOps.has(arrayBranch, 2), false);
    });

    it('should check existence in map branch', () => {
      const node: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test' };
      (mapBranch.i as Map<number, ITrieNode<string>>).set(1, node);
      assert.strictEqual(BranchOps.has(mapBranch, 1), true);
      assert.strictEqual(BranchOps.has(mapBranch, 2), false);
    });
  });

  describe('size', () => {
    it('should get size of array branch', () => {
      const node: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test' };
      (arrayBranch.i as [number, ITrieNode<string>][]).push([1, node]);
      assert.strictEqual(BranchOps.size(arrayBranch), 1);
    });

    it('should get size of map branch', () => {
      const node: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test' };
      (mapBranch.i as Map<number, ITrieNode<string>>).set(1, node);
      assert.strictEqual(BranchOps.size(mapBranch), 1);
    });
  });

  describe('entries', () => {
    it('should iterate over array branch entries', () => {
      const node: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test' };
      (arrayBranch.i as [number, ITrieNode<string>][]).push([1, node]);
      const entries = Array.from(BranchOps.entries(arrayBranch));
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0][0], 1);
      assert.strictEqual(entries[0][1], node);
    });

    it('should iterate over map branch entries', () => {
      const node: ITrieNode<string> = { b: { _t: BranchType.Array, i: [] }, p: 'test' };
      (mapBranch.i as Map<number, ITrieNode<string>>).set(1, node);
      const entries = Array.from(BranchOps.entries(mapBranch));
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0][0], 1);
      assert.strictEqual(entries[0][1], node);
    });
  });
}); 