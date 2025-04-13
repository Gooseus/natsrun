import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { NatsTrie } from '../../src/lib/natstrie/';

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

      test('Trie search with exact match', () => {
        const result = trie.search('foo.bar.baz');
        assert.deepEqual(result?.payload, [ 'payload1' ]);
      });

      test('Trie search with no match', () => {
        const result = trie.search('foo.bar.qux');
        assert.deepEqual(result, undefined);
      });
    });


    describe('Searching a single match wildcard pattern', () => {
      describe('Single match in the middle of the pattern', () => {
        beforeEach(() => {
          trie.insert('foo.*.baz', 'payload1');
        });

        test('Trie search with single match wildcard', () => {
        const result = trie.search('foo.anyvalue.baz');
          assert.deepEqual(result?.payload, [ 'payload1' ]);
        });

        test('Trie search with no match', () => {
          const result = trie.search('foo.anyvalue.qux');
          assert.deepEqual(result, undefined);
        });
      });

      describe('Single match at the end of the pattern', () => {
        beforeEach(() => {
          trie.insert('foo.baz.*', 'payload1');
        });

        test('Searching a matching pattern at the end', () => {
          const result = trie.search('foo.baz.anyvalue');
          assert.deepEqual(result?.payload, [ 'payload1' ]);
        });

        test('Searching a non-matching pattern at the end', () => {
          const result = trie.search('foo.baz.anyvalue.qux');
          assert.deepEqual(result, undefined);
        });

        test('Searching a matching pattern without the end part', () => {
          const result = trie.search('foo.baz');
          assert.deepEqual(result, undefined);
        });
      }); 
    });

    describe('Searching a full match wildcard pattern', () => {
      beforeEach(() => {
        trie.insert('foo.bar.>', 'payload1');
      });

      test('Searching a full match pattern with matching subject', () => {
        const result = trie.search('foo.bar.baz')
        assert.deepEqual(result?.payload, [ 'payload1' ]);
      });
    });
  });
});
