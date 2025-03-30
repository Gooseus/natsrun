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
        assert.deepEqual(result?.payload, 'payload1');
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
          assert.deepEqual(result?.payload, 'payload1');
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
          assert.deepEqual(result?.payload, 'payload1');
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
        assert.deepEqual(result?.payload, 'payload1');
      });
    });
  });

  // describe('Trie insertion and exact matching', () => {
  //   let trie: NatsTrie<string>;
  //   let matches;

  //   beforeEach(() => {
  //     trie = new NatsTrie();
  //   });

  //   test('Trie insertion and exact matching', () => {
  //     trie.insert('foo.bar.baz', 'payload1');
  //     trie.insert('foo.bar.qux', 'payload2');

  //     // Exact match
  //     matches = trie.match('foo.bar.baz');
  //     assert.deepEqual(matches?.[0]?.payload, 'payload1');
  //   });

  //   test('Trie matching with additional subjects', () => {
  //     trie.insert('foo.bar.baz', 'payload1');
  //     trie.insert('foo.bar.qux', 'payload2');

  //     matches = trie.match('foo.bar.qux');
  //     assert.deepEqual(matches?.[0]?.payload, 'payload2');
  //   });

  //   test('Trie not matching', () => {
  //     trie.insert('foo.bar.baz', 'payload1');
  //     trie.insert('foo.bar.qux', 'payload2');

  //     // No match
  //     matches = trie.match('foo.bar.unknown');
  //     assert.deepEqual(matches?.length, 0);
  //   });

  //   test('Trie matching with single-level wildcard (*)', () => {
  //     trie.insert('foo.*.baz', 'payloadWildcard');

  //     // Matching with wildcard
  //     let matches = trie.match('foo.anyvalue.baz');
  //     assert.deepEqual(matches?.[0]?.payload, 'payloadWildcard');
  //   });
    
  //   test('Trie not matching with single-level wildcard (*)', () => {
  //     trie.insert('foo.*.baz', 'payloadWildcard');

  //     // No match
  //     matches = trie.match('foo.anyvalue.qux');
  //     assert.deepEqual(matches?.length, 0);
  //   });

  //   test('Trie matching with single-level wildcard (*) at the end', () => {

  //     trie.insert('foo.baz.*', 'payloadWildcard');

  //     // Matching with wildcard
  //     let matches = trie.match('foo.baz.anyvalue');
  //     assert.deepEqual(matches?.[0]?.payload, 'payloadWildcard');
  //   });

  //   test('Trie not matching with single-level wildcard (*) at the end', () => {
  //     trie.insert('foo.baz.*', 'payloadWildcard');

  //     // No match
  //     let matches = trie.match('foo.baz.anyvalue.qux');
  //     assert.deepEqual(matches?.length, 0);
  //   });

  //   test('Trie not matching with a single-level wildcard (*) at the end of match', () => {
  //     trie.insert('foo.baz.*', 'payloadWildcard');

  //     // No match
  //     let matches = trie.match('foo.baz');
  //     assert.deepEqual(matches?.length, 0);
  //   });
  // });

  // describe('Trie matching with multi-level wildcard (>)', () => {
  //   let trie: NatsTrie<string>;
  //   let matches;

  //   beforeEach(() => {
  //     trie = new NatsTrie();
  //     trie.insert('foo.bar.>', 'payloadMultiWildcard');
  //   });

  //   test('Matching with additional tokens (>)', () => {
  //     matches = trie.match('foo.bar.baz');
  //     assert.deepEqual(matches?.[0]?.payload, 'payloadMultiWildcard');
  //   });

  //   test('Matching with more additional tokens (>)', () => {
  //     matches = trie.match('foo.bar.baz.qux');
  //     assert.deepEqual(matches?.[0]?.payload, 'payloadMultiWildcard');
  //   });

  //   test('Exact match without additional tokens (>)', () => {
  //     matches = trie.match('foo.bar');
  //     assert.deepEqual(matches?.length, 0);
  //   });

  //   test('Matching with single-level wildcard at the end (>)', () => {
  //     trie.insert('foo.bar.*', 'payloadSingleWildcardEnd');
  //     matches = trie.match('foo.bar.baz');
  //     const payloads = matches?.map(x => x.payload);
  //     assert.deepEqual(payloads.sort(), ['payloadMultiWildcard', 'payloadSingleWildcardEnd'].sort());
  //   });
  // });

  // describe('Trie matching with both wildcards', () => {
  //   let trie: NatsTrie<string>;
  //   let matches;

  //   beforeEach(() => {
  //     trie = new NatsTrie();
  //     trie.insert('foo.*.>', 'payloadBothWildcards');
  //   });

  //   test('Matching various subjects', () => {
  //     // Matching various subjects
  //     matches = trie.match('foo.any.number.of.tokens');
  //     assert.deepEqual(matches, ['payloadBothWildcards']);
  //   });

  //   test('Matching with fewer tokens than pattern', () => {
  //     matches = trie.match('foo.another.test');
  //     assert.deepEqual(matches, ['payloadBothWildcards']);
  //   });

  //   test('Trie matching precedence', () => {
  //     trie.insert('foo.bar.baz', 'payloadExact');
  //     trie.insert('foo.*.baz', 'payloadWildcard');
  //     trie.insert('foo.bar.>', 'payloadMultiWildcard');

  //     // Matching should return all applicable payloads
  //     matches = trie.match('foo.bar.baz');
  //     assert.deepEqual(matches.sort(), ['payloadBothWildcards', 'payloadExact', 'payloadWildcard', 'payloadMultiWildcard'].sort());
  //   });
  // });

  // describe('Trie no match scenarios', () => {
  //   let trie: NatsTrie<string>;
  //   let matches;

  //   beforeEach(() => {
  //     trie = new NatsTrie();
  //     trie.insert('foo.bar', 'payload1');
  //   });

  //   test('Trie no match with empty trie', () => {
  //     // Empty trie
  //     const emptyTrie = new NatsTrie();
  //     matches = emptyTrie.match('foo.bar');
  //     assert.deepEqual(matches, []);
  //   });

  //   test('Trie no match with empty subject', () => {
  //     // Empty subject
  //     let matches = trie.match('');
  //     assert.deepEqual(matches, []);
  //   });

  //   test('Trie no match with fewer tokens than pattern', () => {
  //     // Subject with fewer tokens than pattern
  //     let matches = trie.match('foo');
  //     assert.deepEqual(matches, []);
  //   });

  //   test('Trie no match with more tokens than pattern', () => {
  //     // Subject with more tokens than pattern
  //     let matches = trie.match('foo.bar.baz');
  //     assert.deepEqual(matches, []);
  //   });
  // });

  // describe('Trie edge cases', () => {
  //   let trie: NatsTrie<string>;
  //   let matches;

  //   beforeEach(() => {
  //     trie = new NatsTrie();
  //   });

  //   test('Trie edge cases with empty patterns and subjects', () => {
  //     // Empty pattern
  //     trie.insert('', 'payloadEmptyPattern');

  //     // Matching empty subject
  //     matches = trie.match('');
  //     assert.deepEqual(matches, ['payloadEmptyPattern']);

  //     // Non-empty subject should not match
  //     matches = trie.match('foo');
  //     assert.deepEqual(matches, []);
  //   });

  //   test('Trie handling of multiple payloads at the same node', () => {
  //     trie.insert('foo.bar', 'payload1');
  //     trie.insert('foo.bar', 'payload2');

  //     // Should return both payloads
  //     matches = trie.match('foo.bar');
  //     assert.deepEqual(matches.sort(), ['payload1', 'payload2'].sort());
  //   });

  //   test('Trie wildcard matching with overlapping patterns', () => {
  //     trie.insert('foo.*.baz', 'payloadWildcard');
  //     trie.insert('foo.bar.baz', 'payloadExact');

  //     // Matching should return both payloads
  //     matches = trie.match('foo.bar.baz');
  //     assert.deepEqual(matches.sort(), ['payloadWildcard', 'payloadExact'].sort());
  //   });

  //   test('Trie wildcard matching with no applicable patterns', () => {
  //     trie.insert('foo.*.baz', 'payloadWildcard');

  //     // Subject does not match because last token differs
  //     let matches = trie.match('foo.anything.qux');
  //     assert.deepEqual(matches, []);
  //   });

  //   describe('Trie multi-level wildcard at root', () => {
  //     let trie: NatsTrie<string>;
  //     let matches;
      

  //     beforeEach(() => {
  //       trie = new NatsTrie();
  //       trie.insert('>', 'payloadRootMultiWildcard');
  //     });

  //     test('Trie multi-level wildcard at root with single token', () => {
  //       matches = trie.match('foo.bar.baz');
  //       assert.deepEqual(matches, ['payloadRootMultiWildcard']);
  //     });

  //     test('Trie multi-level wildcard at root with no tokens', () => {
  //       matches = trie.match('any.subject');
  //       assert.deepEqual(matches, ['payloadRootMultiWildcard']);
  //     });

  //     test('Trie multi-level wildcard at root with empty subject', () => {
  //       matches = trie.match('');
  //       assert.deepEqual(matches, ['payloadRootMultiWildcard']);
  //     });
  //   });
  // });

});
