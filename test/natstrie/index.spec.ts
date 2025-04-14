import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BranchType, NatsTrie, DEFAULT_ARRAY_TO_MAP_THRESHOLD } from '../../src/lib/natstrie/index.js';

describe('NatsTrie', () => {
  let trie: NatsTrie<string>;

  describe('Trie search', () => {
    beforeEach(() => {
      trie = new NatsTrie();
    });

    describe('Exact match', () => {
      beforeEach(() => {
        trie.insert('foo.bar.baz', 'payload1');
      });

      it('Trie search with exact match', () => {
        const result = trie.search('foo.bar.baz');
        assert.deepEqual(result?.p, [ 'payload1' ]);
      });

      it('Trie search with no match', () => {
        const result = trie.search('foo.bar.qux');
        assert.deepEqual(result, undefined);
      });
    });


    describe('Searching a single match wildcard pattern', () => {
      describe('Single match in the middle of the pattern', () => {
        beforeEach(() => {
          trie.insert('foo.*.baz', 'payload1');
        });

        it('Trie search with single match wildcard', () => {
          const result = trie.search('foo.anyvalue.baz');
          assert.deepEqual(result?.p, [ 'payload1' ]);
        });

        it('Trie search with no match', () => {
          const result = trie.search('foo.anyvalue.qux');
          assert.deepEqual(result, undefined);
        });
      });

      describe('Single match at the end of the pattern', () => {
        beforeEach(() => {
          trie.insert('foo.baz.*', 'payload1');
        });

        it('Searching a matching pattern at the end', () => {
          const result = trie.search('foo.baz.anyvalue');
          assert.deepEqual(result?.p, [ 'payload1' ]);
        });

        it('Searching a non-matching pattern at the end', () => {
          const result = trie.search('foo.baz.anyvalue.qux');
          assert.deepEqual(result, undefined);
        });

        it('Searching a matching pattern without the end part', () => {
          const result = trie.search('foo.baz');
          assert.deepEqual(result, undefined);
        });
      }); 
    });

    describe('Searching a full match wildcard pattern', () => {
      beforeEach(() => {
        trie.insert('foo.bar.>', 'payload1');
      });

      it('Searching a full match pattern with matching subject', () => {
        const result = trie.search('foo.bar.baz')
        assert.deepEqual(result?.p, [ 'payload1' ]);
      });
    });
  });

  describe('NatsTrie Branch Operations', () => {
    beforeEach(() => {
      trie = new NatsTrie();
    });

    describe('Array to Map conversion', () => {
      it('converts array branch to map when threshold is exceeded', () => {
        for (let i = 0; i < DEFAULT_ARRAY_TO_MAP_THRESHOLD + 1; i++) {
          trie.insert(`${i}.test`, 'payload');
        }

        const root = trie.trieRoot;
        assert.strictEqual(root.b._t, BranchType.Map);
      });

      it('maintains correct data after conversion', () => {
        const patterns = Array.from({ length: DEFAULT_ARRAY_TO_MAP_THRESHOLD + 1 }, (_, i) => `test.${i}`);
        patterns.forEach(p => trie.insert(p, 'payload'));

        patterns.forEach(p => {
          const result = trie.search(p);
          assert.deepStrictEqual(result?.p, ['payload']);
        });
      });
    });

    describe('Branch Operations', () => {
      it('handles mixed array and map branches correctly', () => {
        trie.insert('test.1', 'payload1');
        trie.insert('test.2', 'payload2');
        trie.insert('test.3', 'payload3');
        trie.insert('test.4', 'payload4');
        trie.insert('test.5', 'payload5');
        trie.insert('test.6', 'payload6');
        trie.insert('test.7', 'payload7');
        trie.insert('test.8', 'payload8'); // Should trigger conversion
        trie.insert('test.9', 'payload9');

        for (let i = 1; i <= 9; i++) {
          const result = trie.search(`test.${i}`);
          assert.deepStrictEqual(result?.p, [`payload${i}`]);
        }
      });
    });
  });

  describe('String Pool Integration', () => {
    beforeEach(() => {
      trie = new NatsTrie();
    });

    it('uses string pool for topic strings', () => {
      trie.insert('test.topic', 'payload1');
      trie.insert('test.topic', 'payload2'); // Same topic string should reuse ID
      
      const result = trie.search('test.topic');
      assert.deepEqual(result?.p, ['payload1', 'payload2']);
    });

    it('handles string pool IDs correctly', () => {
      const topic = 'test.topic';
      const id = trie.getTopicId(topic);
      const str = trie.getTopicString(id);
      
      assert.strictEqual(str, topic);
    });
  });

  describe('Array to Map Threshold', () => {
    it('respects custom threshold', () => {
      const customThreshold = 16;
      trie = new NatsTrie();
      trie.arrayToMapThreshold = customThreshold;
      
      // Insert just below threshold
      for (let i = 0; i < customThreshold; i++) {
        trie.insert(`${i}`, 'payload', true);
      }
      assert.strictEqual(trie.trieRoot.b._t, BranchType.Array);
      
      // Insert one more to trigger conversion
      trie.insert(`${customThreshold}`, 'payload', true);
      assert.strictEqual(trie.trieRoot.b._t, BranchType.Map);
    });
  });

  describe('Trie Traversal', () => {
    beforeEach(() => {
      trie = new NatsTrie();
      trie.insert('test.1', 'payload1');
      trie.insert('test.2', 'payload2');
      trie.insert('test.3', 'payload3');
    });

    it('traverses all nodes', () => {
      const nodes = trie.traverse(trie.trieRoot);
      assert.strictEqual(nodes.length, 5); // Root + test branch + 3 leaf nodes
    });

    it('includes all nodes with payloads', () => {
      const nodes = trie.traverse(trie.trieRoot);
      const payloadNodes = nodes.filter(n => n.p !== undefined && Array.isArray(n.p) ? n.p.length > 0 : n.p !== undefined);
      assert.strictEqual(payloadNodes.length, 3);
    });
  });
});
