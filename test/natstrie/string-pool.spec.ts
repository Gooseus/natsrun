import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StringPool } from '../../src/lib/natstrie/string-pool.js';

describe('StringPool', () => {
  let pool: StringPool;

  beforeEach(() => {
    pool = new StringPool();
  });

  describe('Basic functionality', () => {
    it('should intern strings and return consistent IDs', () => {
      const id1 = pool.intern('test');
      const id2 = pool.intern('test');
      assert.strictEqual(id1, id2, 'Same string should return same ID');
    });

    it('should return different IDs for different strings', () => {
      const id1 = pool.intern('test1');
      const id2 = pool.intern('test2');
      assert.notStrictEqual(id1, id2, 'Different strings should return different IDs');
    });

    it('should retrieve original strings by ID', () => {
      const str = 'test';
      const id = pool.intern(str);
      assert.strictEqual(pool.getString(id), str, 'Should retrieve original string');
    });

    it('should handle empty strings', () => {
      const id = pool.intern('');
      assert.strictEqual(pool.getString(id), '', 'Should handle empty string');
    });
  });

  describe('Memory efficiency', () => {
    it('should reuse IDs for identical strings', () => {
      const str = 'test';
      const id1 = pool.intern(str);
      const id2 = pool.intern(str);
      const id3 = pool.intern(str);
      
      assert.strictEqual(pool.size(), 1, 'Should only store one copy of identical string');
      assert.strictEqual(id1, id2, 'IDs should be consistent');
      assert.strictEqual(id2, id3, 'IDs should be consistent');
    });

    it('should handle large numbers of unique strings', () => {
      const count = 10000;
      const ids = new Set<number>();
      
      for (let i = 0; i < count; i++) {
        ids.add(pool.intern(`test${i}`));
      }
      
      assert.strictEqual(ids.size, count, 'Should generate unique IDs for unique strings');
      assert.strictEqual(pool.size(), count, 'Should store all unique strings');
    });

    it('should handle repeated patterns efficiently', () => {
      const pattern = 'test.pattern';
      const count = 10000;
      const ids = new Set<number>();
      
      for (let i = 0; i < count; i++) {
        ids.add(pool.intern(pattern));
      }
      
      assert.strictEqual(ids.size, 1, 'Should reuse ID for repeated pattern');
      assert.strictEqual(pool.size(), 1, 'Should only store one copy of repeated pattern');
    });
  });

  describe('Clear functionality', () => {
    it('should clear all stored strings', () => {
      pool.intern('test1');
      pool.intern('test2');
      assert.strictEqual(pool.size(), 2, 'Should have stored strings');
      
      pool.clear();
      assert.strictEqual(pool.size(), 0, 'Should have cleared all strings');
      
      const newId = pool.intern('test1');
      assert.strictEqual(newId, 0, 'Should start IDs from 0 after clear');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined and null inputs', () => {
      assert.throws(() => pool.intern(undefined as any), 'Should throw on undefined');
      assert.throws(() => pool.intern(null as any), 'Should throw on null');
    });

    it('should handle non-string inputs', () => {
      assert.throws(() => pool.intern(123 as any), 'Should throw on number');
      assert.throws(() => pool.intern({} as any), 'Should throw on object');
    });

    it('should handle invalid IDs', () => {
      assert.throws(() => pool.getString(-1), 'Should throw on negative ID');
      assert.throws(() => pool.getString(100), 'Should throw on out of bounds ID');
    });
  });

  describe('Performance', () => {
    it('should handle rapid string interning', () => {
      const start = process.hrtime.bigint();
      const count = 100000;
      
      for (let i = 0; i < count; i++) {
        pool.intern(`test${i}`);
      }
      
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6; // Convert to milliseconds
      
      console.log(`Interning ${count} strings took ${duration.toFixed(2)}ms`);
      assert(duration < 1000, 'Should complete within reasonable time');
    });

    it('should maintain performance with repeated patterns', () => {
      const start = process.hrtime.bigint();
      const count = 100000;
      const pattern = 'test.pattern';
      
      for (let i = 0; i < count; i++) {
        pool.intern(pattern);
      }
      
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6; // Convert to milliseconds
      
      console.log(`Interning ${count} repeated patterns took ${duration.toFixed(2)}ms`);
      assert(duration < 1000, 'Should complete within reasonable time');
    });
  });
}); 