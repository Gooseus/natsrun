import assert from 'node:assert';
import { before, beforeEach, describe, it } from 'node:test';

// TODO: Figure out using enums at runtime in tests without it being a whole thing
import { NatsRun } from '../dist/index.js';

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
      assert(router.store.list().length === 1, 'Router pattern size should');
      assert(router.store.list()[0].length === 1, 'Router pattern handler size should be 1');
      assert(router.store.list(null, { patterns: true })[0][0] === 'order', 'Router pattern handler should be "order"');
    });

    it('adds a simple two part route to the router', () => {
      router.add('order.create', (msg) => { });
      const opts = { patterns : true };

      assert(router.store.list().length === 1, 'Router pattern size should be 1');
      assert(router.store.list()[0].length === 1, 'Router pattern handler size should be 1');
      assert(router.store.list(null, opts)[0][0] === 'order', 'Router pattern should have "order" in the first index');
      assert(router.store.list(null, opts)[0][1] === 'create', 'Router pattern should have "create" in the second index');
    });

    it('adds a simple three part route to the router', () => {
      router.add('order.create.new', (msg) => { });
      const opts = { patterns : true };

      assert(router.store.list().length === 1, 'Router pattern size should be 1');
      assert(router.store.list()[0].length === 1, 'Router pattern handler size should be 1');
      assert(router.store.list(null, opts)[0][0] === 'order', 'Router pattern should have "order" in the first index');
      assert(router.store.list(null, opts)[0][1] === 'create', 'Router pattern should have "create" in the second index');
      assert(router.store.list(null, opts)[0][2] === 'new', 'Router pattern should have "new" in the third index');
    });

    it('adds a wildcard route to the router', () => {
      router.add('order.*.new', (msg) => { });
      const opts = { patterns : true };

      assert(router.store.list().length == 1, 'Router pattern size should be 1');
      assert(router.store.list()[0].length == 1, 'Router pattern handler size should be 1');
      assert(router.store.list(null, opts)[0][0] === 'order', 'Router pattern should have "order" in the first index');
      assert(router.store.list(null, opts)[0][1] instanceof RegExp, 'Router pattern should have a wildcard match in the second index');
      assert(router.store.list(null, opts)[0][2] === 'new', 'Router pattern should have "new" in the third index');
    });

    it('adds a rest route to the router', () => {
      const opts = { patterns : true };

      router.add('order.>', (msg) => { });

      assert(router.store.list().length == 1, 'Router pattern size should be 1');
      assert(router.store.list(null, opts)[0][0] == 'order', 'Router pattern should have "order" in the first index');
      assert(router.store.list(null, opts)[0][1] instanceof RegExp, 'Router pattern should have a rest matcher second index');
    });
  });

  describe("Listing routes", () => {
    let router;
    beforeEach(() => {
      router = new NatsRun();
    });
    describe("Listing all routes", () => {
      it('lists all routes', () => {
        router.add('order', (msg) => { });
        router.add('order.create', (msg) => { });
        router.add('order.create.new', (msg) => { });
        router.add('order.*.new', (msg) => { });
        router.add('order.>', (msg) => { });

        const routes = router.list();
        assert(routes.length === 5, 'Router pattern size should be 5');
      });

      it('lists all routes with patterns', () => {
        router.add('order', (msg) => { });
        router.add('order.create', (msg) => { });
        router.add('order.create.new', (msg) => { });
        router.add('order.*.new', (msg) => { });
        router.add('order.>', (msg) => { });

        const routes = router.list(null, { patterns: true });
        assert(routes.length === 5, 'Router pattern size should be 5');
      });
    });

    describe("Listing specific routes", () => {
      it('lists a single specific route handler', () => {
        router.add('order', (msg) => { });

        const routes = router.list('order');
        assert(routes.length === 1, 'Router pattern size should be 1');
      });

      it('lists an array of handlers for single specific route', () => {
        router.add('order', (msg) => { });
        router.add('order', (msg) => { });

        const routes = router.list('order');
        assert(routes.length === 2, 'Router pattern size should be 1');
      });

      it('lists a single route for multiple pattern matches', () => {
        router.add('order.*.update', (msg) => { });

        const routes = router.list('order.12354.update');
        assert(routes.length === 1, 'Router pattern size should be 1');
        const routes2 = router.list('order.ABCDEF.update');
        assert(routes2.length === 1, 'Router pattern size should be 1');
      });

      it('lists multiple routes for multiple pattern matches', () => {
        router.add('order.*.update', (msg) => { });
        router.add('*.*.update', (msg) => { });

        const routes = router.list('order.12354.update');
        assert(routes.length === 2, 'Router pattern size should be 2');
      });
    });
  });

  describe("Route handlers", () => {
    let router;
    beforeEach(() => {
      router = new NatsRun();
    });

    it('matches a simple one part route', () => {
      const subject = 'order';

      router.add(subject, (msg) => `test ${subject} ${msg}`);

      const matches = router.list('order');
      
      assert(matches.length === 1, 'Router pattern should have a match');
      assert(matches[0].length === 1, 'Patter match should have a handler');
      assert(matches[0][0]('test') === 'test order test', 'Pattern match should have "order"');
    });

    it('matches a simple two part route', () => {
      const subject = 'order.create';

      router.add(subject, (msg) => `test ${subject} ${msg}`);

      const matches = router.list('order.create');

      assert(matches.length == 1, 'Router pattern should have a match');
      assert(matches[0].length == 1, 'Patter match should have a handler');
      assert(matches[0][0]('test') == 'test order.create test', 'Pattern match should have "order.create"');
    });

    it('matches a simple three part route', () => {
      const subject = 'order.create.new';

      router.add(subject, (msg) => `test ${subject} ${msg}`);

      const matches = router.list('order.create.new');
      
      assert(matches.length == 1, 'Router pattern should have a match');
      assert(matches[0].length == 1, 'Patter match should have a handler');
      assert(matches[0][0]('test') == 'test order.create.new test', 'Pattern match should have "order.create.new"');
    });

    it('matches a wildcard route', () => {
      const subject = 'order.*.new';

      router.add(subject, (msg) => `test ${subject} ${msg}`);

      const matches = router.list('order.create.new');
      
      assert(matches.length == 1, 'Router pattern should have a match');
      assert(matches[0].length == 1, 'Patter match should have a handler');
      assert(matches[0][0]('test') == 'test order.*.new test', 'Pattern match should have "order.*.new"');
    });

    it('matches a rest route', () => {
      const subject = 'order.>';
      router.add(subject, (msg) => `test ${subject} ${msg}`);

      const matches = router.list('order.create.new');
      
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

