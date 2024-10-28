import assert from 'node:assert';
import { before, beforeEach, describe, it } from 'node:test';

// TODO: Figure out using enums at runtime in tests without it being a whole thing
import { NatsRun } from '../dist/index.js';

function traverseTrie(node, path: string[] = []) {
  if(node.isTerminal) {
    return path;
  }

  for(const [key, child] of node.children.entries()) {
    path = traverseTrie(child, [  key as string, ...path ]);
  }

  return path;
}

describe('NatsRun', () => {

  describe('Class API', () => {
    it('is an function', () => {
      assert.strictEqual(typeof NatsRun, 'function');
    });
  });
  
  describe('Instance API', () => {
    const instance = new NatsRun();
    it('has a method called "add"', () => {
      assert.strictEqual(typeof instance.add, 'function');
    });
  });

  describe("Adding routes", () => {
    let router;

    beforeEach(() => {
      router = new NatsRun();
    });
    
    it('adds a simple one part route to the router', () => {
      router.add('order', (msg) => { });

      assert(traverseTrie(router.trie.trieRoot).length === 1, 'Router pattern size should be 1');
    });

    it('adds a simple two part route to the router', () => {
      router.add('order.create', (msg) => { });

      assert(traverseTrie(router.trie.trieRoot).length === 2, 'Router path size should be 1');
      // assert(Array.from(router.trie.trieRoot.children.entries())?.[0]?.[1]?.children.entries()?.[0]?.[1]?.payloads?.length === 1, 'Router pattern handler size should be 1');
      // assert(Array.from(router.trie.trieRoot.children.keys())[0] === 'order', 'Router pattern should have "order" in the first index');
      // assert(Array.from(router.trie.trieRoot.children.keys())[1] === 'create', 'Router pattern should have "create" in the second index');
    });

    it('adds a simple three part route to the router', () => {
      router.add('order.create.new', (msg) => { });

      assert(traverseTrie(router.trie.trieRoot).length === 3, 'Router path size should be 3');
      // assert(Array.from(router.trie.trieRoot.children.entries())?.[0]?.[1]?.children.entries()?.[0]?.[1]?.children.entries()?.[0]?.[1]?.payloads?.length === 1, `Router pattern handler size should be 1`);
      // assert(Array.from(router.trie.trieRoot.children.keys())[0] === 'order', 'Router pattern should have "order" in the first index');
      // assert(Array.from(router.trie.trieRoot.children.keys())[1] === 'create', 'Router pattern should have "create" in the second index');
      // assert(Array.from(router.trie.trieRoot.children.keys())[2] === 'new', 'Router pattern should have "new" in the third index');
    });

    it('adds a wildcard route to the router', () => {
      router.add('order.*.new', (msg) => { });
      // const opts = { patterns : true };

      assert(traverseTrie(router.trie.trieRoot).length === 3, 'Router path size should be 3');
      // assert(Array.from(router.trie.trieRoot.children.entries())?.[0]?.[1]?.payloads?.length == 1, 'Router pattern handler size should be 1');
      // assert(Array.from(router.trie.trieRoot.children.keys())[0] === 'order', 'Router pattern should have "order" in the first index');
      // assert(Array.from(router.trie.trieRoot.children.keys())[2] === 'new', 'Router pattern should have "new" in the third index');
    });

    it('adds a rest route to the router', () => {
      const opts = { patterns : true };

      router.add('order.>', (msg) => { });

      assert(traverseTrie(router.trie.trieRoot).length === 2, 'Router path size should be 2');
      // assert(router.trie.trieRoot.children.size == 1, 'Router pattern size should be 1');
      // assert(Array.from(router.trie.trieRoot.children.keys())[0] === 'order', 'Router pattern should have "order" in the first index');
    });
  });

  describe("Route Matches", () => {
    let router;
    beforeEach(() => {
      router = new NatsRun();
    });

    it('matches a simple one part route', () => {
      const subject = 'order';

      router.add(subject, (msg) => `test ${subject} ${msg}`);

      const matches = router.match('order');
      
      assert(matches.length === 1, 'Router pattern should have a match');
      assert(matches[0].length === 1, 'Patter match should have a handler');
      assert(matches[0][0]('test') === 'test order test', 'Pattern match should have "order"');
    });

    it('matches a simple two part route', () => {
      const subject = 'order.create';

      router.add(subject, (msg) => `test ${subject} ${msg}`);

      const matches = router.match('order.create');

      assert(matches.length == 1, 'Router pattern should have a match');
      assert(matches[0].length == 1, 'Patter match should have a handler');
      assert(matches[0][0]('test') == 'test order.create test', 'Pattern match should have "order.create"');
    });

    it('matches a simple three part route', () => {
      const subject = 'order.create.new';

      router.add(subject, (msg) => `test ${subject} ${msg}`);

      const matches = router.match('order.create.new');
      
      assert(matches.length == 1, 'Router pattern should have a match');
      assert(matches[0].length == 1, 'Patter match should have a handler');
      assert(matches[0][0]('test') == 'test order.create.new test', 'Pattern match should have "order.create.new"');
    });

    it('matches a wildcard route', () => {
      const subject = 'order.*.new';

      router.add(subject, (msg) => `test ${subject} ${msg}`);

      const matches = router.match('order.create.new');
      
      assert(matches.length == 1, 'Router pattern should have a match');
      assert(matches[0].length == 1, 'Patter match should have a handler');
      assert(matches[0][0]('test') == 'test order.*.new test', 'Pattern match should have "order.*.new"');
    });

    it('matches a rest route', () => {
      const subject = 'order.>';
      router.add(subject, (msg) => `test ${subject} ${msg}`);

      const matches = router.match('order.create.new');
      
      assert(matches.length == 1, 'Router pattern should have a match');
      assert(matches[0].length == 1, 'Patter match should have a handler');
      assert(matches[0][0]('test') == 'test order.> test', 'Pattern match should have "order.>"');
    });
  });

  describe("Route handling with messages", () => {
    
    describe('handling different kinds of routes appropriately', async () => {
      let router;
      let tests;
      let results;

      beforeEach(() => {
        router = new NatsRun();
        tests = {
          'order': false,
          'order.create': false,
          'order.create.new': false,
          'order.*.new': false,
          'order.>': false
        };
        results = [];
        
        Object.keys(tests).forEach(async (sub) => {
          router.add(sub, (msg, { subject, pattern }) => { 
            tests[sub] = true;
            results.push([subject, pattern])
          });
        });
      });

      it('should handle wildcard routes', async () => {
        await router.handle('order.1234.new', 'test');

        assert(!tests['order'], `Handler for 'order' should NOT have been called`);
        assert(!tests['order.create'], `Handler for 'order.create' should NOT have been called`);
        assert(!tests['order.create.new'], `Handler for 'order.create.new' should NOT have been called`);

        assert(tests['order.*.new'], `Handler for 'order.*.new' should have been called`);
        assert(tests['order.>'], `Handler for 'order.>' should have been called`);
      });

      it('should handle wildcard routes', async () => {
        await router.handle('order.create.new', 'test');

        assert(!tests['order'], `Handler for 'order' should NOT have been called`);
        assert(!tests['order.create'], `Handler for 'order.create' should NOT have been called`);

        assert(tests['order.create.new'], `Handler for 'order.>' should have been called`);
        assert(tests['order.*.new'], `Handler for 'order.*.new' should have been called`);
        assert(tests['order.>'], `Handler for 'order.>' should have been called`);
      });
    });
  });
});

