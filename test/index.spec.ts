import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";

import { NatsRun, NatsSortFunction } from "../src/index.js";
import { BranchType } from "../src/lib/natstrie/index.js";

function traverseTrie(node, path: string[] = []) {
  if (node.l) {
    return path;
  }

  if (node.b._t === BranchType.Array) {
    for (const [key, child] of node.b.i) {
      path = traverseTrie(child, [key as string, ...path]);
    }
  } else {
    for (const [key, child] of node.b.i.entries()) {
      path = traverseTrie(child, [key as string, ...path]);
    }
  }

  return path;
}

const testHandler = (test: string, results: string[]) => async ({ data }, _ctx, next) => { 
  results.push(`${test} ${fromUint8Array(data)}`);
  return next();
};

function toUint8Array(str: string | number): Uint8Array {
  if (typeof str === "string") {
    return new TextEncoder().encode(str);
  }

  if (typeof str === "number") {
    return new Uint8Array([str]);
  }

  throw new Error("Invalid input");
}

function fromUint8Array(arr?: Uint8Array): string | number {
  if (!arr) {
    return "";
  }

  if (arr.length === 1) {
    return arr[0];
  }

  return new TextDecoder().decode(arr);
}

function alphaSort(a: string, b: string) {
  const aTopics = a.split(".");
  const bTopics = b.split(".");
  const aLast = aTopics[aTopics.length - 1];
  const bLast = bTopics[bTopics.length - 1];
  return aLast.localeCompare(bLast);
}

describe("NatsRun", () => {
  describe("Class API", () => {
    it("is an function", () => {
      assert.strictEqual(typeof NatsRun, "function");
    });
  });

  describe("Instance API", () => {
    const instance = new NatsRun();
    it('has a method called "add"', () => {
      assert.strictEqual(typeof instance.add, "function");
    });
  });

  describe("Adding routes", () => {
    let router;

    beforeEach(() => {
      router = new NatsRun();
    });

    it("adds a simple one part route to the router", () => {
      router.add("order", (msg) => msg)

      assert(
        traverseTrie(router.trie.trieRoot).length === 1,
        "Router pattern size should be 1"
      );
    });

    it("adds a simple two part route to the router", () => {
      router.add("order.create", (msg) => {});

      assert(
        traverseTrie(router.trie.trieRoot).length === 2,
        "Router path size should be 1"
      );
    });

    it("adds a simple three part route to the router", () => {
      router.add("order.create.new", (msg) => {});

      assert(
        traverseTrie(router.trie.trieRoot).length === 3,
        "Router path size should be 3"
      );
    });

    it("adds a wildcard route to the router", () => {
      router.add("order.*.new", (msg) => {});

      assert(
        traverseTrie(router.trie.trieRoot).length === 3,
        "Router path size should be 3"
      );
    });

    it("adds a rest route to the router", () => {
      const opts = { patterns: true };

      router.add("order.>", (msg) => {});

      assert(
        traverseTrie(router.trie.trieRoot).length === 2,
        "Router path size should be 2"
      );
    });
  });

  describe("Route Matches", () => {
    let router;
    beforeEach(() => {
      router = new NatsRun();
    });

    it("matches a simple one part route", () => {
      const subject = "order";

      router.add(subject, ({ data }) => `test ${subject} ${fromUint8Array(data)}`);

      const matches = router.match("order");

      assert(matches.length === 1, "Router pattern should have a match");
      assert(matches[0].length === 1, "Patter match should have a handler");
      assert.strictEqual(
        matches[0]({ subject: "order", data: toUint8Array("test") }),
        "test order test",
        'Pattern match should have "order"'
      );
    });

    it("matches a simple two part route", () => {
      const subject = "order.create";

      router.add(subject, ({ data }) => `test ${subject} ${fromUint8Array(data)}`);

      const matches = router.match("order.create");

      assert(matches.length == 1, "Router pattern should have a match");
      assert(matches[0].length == 1, "Patter match should have a handler");
      assert.strictEqual(
        matches[0]({ subject: "order", data: toUint8Array("test") }),
        "test order.create test",
        'Pattern match should have "order.create"'
      );
    });

    it("matches a simple three part route", () => {
      const subject = "order.create.new";

      router.add(subject, ({ data }) => `test ${subject} ${fromUint8Array(data)}`);

      const matches = router.match("order.create.new");

      assert(matches.length == 1, "Router pattern should have a match");
      assert(matches[0].length == 1, "Patter match should have a handler");
      assert.strictEqual(
        matches[0]({ subject: "order", data: toUint8Array("test") }),
        "test order.create.new test",
        'Pattern match should have "order.create.new"'
      );
    });

    it("matches a wildcard route", () => {
      const subject = "order.*.new";

      router.add(subject, ({ data }) => `test ${subject} ${fromUint8Array(data)}`);

      const matches = router.match("order.create.new");

      assert(matches.length == 1, "Router pattern should have a match");
      assert(matches[0].length == 1, "Patter match should have a handler");
      assert.strictEqual(
        matches[0]({ subject: "order", data: toUint8Array("test") }),
        "test order.*.new test",
        'Pattern match should have "order.*.new"'
      );
    });

    it("matches a rest route", () => {
      const subject = "order.>";
      router.add(subject, ({ data }) => `test ${subject} ${fromUint8Array(data)}`);

      const matches = router.match("order.create.new");

      assert(matches.length == 1, "Router pattern should have a match");
      assert(matches[0].length == 1, "Patter match should have a handler");
      assert.strictEqual(
        matches[0]({ subject: "order", data: toUint8Array("test") }),
        "test order.> test",
        'Pattern match should have "order.>"'
      );
    });
  });

  describe("Route handling with messages", () => {
    describe("handling different kinds of routes appropriately", async () => {
      let router;
      let tests;
      let results;

      beforeEach(() => {
        router = new NatsRun();
        tests = {
          order: false,
          "order.create": false,
          "order.create.new": false,
          "order.*.new": false,
          "order.>": false,
        };
        results = [];

        Object.keys(tests).forEach(async (sub) => {
          router.add(sub, ({ subject, pattern }, ctx, next) => {
            tests[sub] = true;
            results.push([subject, pattern]);
            return next();
          });
        });
      });

      it("should handle wildcard routes", async () => {
        await router.handle("order.1234.new", "test");

        assert(
          !tests["order"],
          `Handler for 'order' should NOT have been called`
        );
        assert(
          !tests["order.create"],
          `Handler for 'order.create' should NOT have been called`
        );
        assert(
          !tests["order.create.new"],
          `Handler for 'order.create.new' should NOT have been called`
        );

        assert(
          tests["order.*.new"],
          `Handler for 'order.*.new' should have been called`
        );
        assert(
          tests["order.>"],
          `Handler for 'order.>' should have been called`
        );
      });

      it("should handle wildcard routes", async () => {
        await router.handle("order.create.new", "test");

        assert(
          !tests["order"],
          `Handler for 'order' should NOT have been called`
        );
        assert(
          !tests["order.create"],
          `Handler for 'order.create' should NOT have been called`
        );

        assert(
          tests["order.create.new"],
          `Handler for 'order.>' should have been called`
        );
        assert(
          tests["order.*.new"],
          `Handler for 'order.*.new' should have been called`
        );
        assert(
          tests["order.>"],
          `Handler for 'order.>' should have been called`
        );
      });
    });
  });

  describe("Route handler ordering", async () => {
    let router: NatsRun;
    let results: string[];

    describe("ordering by specificity", () => {
      beforeEach(() => {
        router = new NatsRun({ sortStrategy: 'specificity' });
        results = [];
        router.add("order.create.new", testHandler("order.create.new", results));
        router.add("order.create", testHandler("order.create", results));
        router.add("order.*.new", testHandler("order.*.new", results));
        router.add("order.>", testHandler("order.>", results));
      });

      it("executes handlers in order from most specific to least specific", async () => {
        await router.handle("order.create.new", toUint8Array("test"));

        assert.deepStrictEqual(
          results,
          ["order.create.new test", "order.*.new test", "order.> test"],
          "Handlers should execute in order from most specific to least specific"
        );
      });

      it("executes wildcard handlers in correct order", async () => {
        await router.handle("order.other.new", toUint8Array("test"));

        assert.deepStrictEqual(
          results,
          ["order.*.new test", "order.> test"],
          "Wildcard handlers should execute in correct order"
        );
      });

      it("executes exact match handlers first", async () => {
        await router.handle("order.create", toUint8Array("test"));

        assert.deepStrictEqual(
          results,
          ["order.create test", "order.> test"],
          "Exact match handlers should execute before wildcards"
        );
      });
    });

    describe("ordering by insertion", () => {
      beforeEach(() => {
        router = new NatsRun({ sortStrategy: 'insertion' });
        results = [];
        router.add("order.>", testHandler("order.>", results));
        router.add("order.*.new", testHandler("order.*.new", results));
        router.add("order.create", testHandler("order.create", results));
        router.add("order.create.new", testHandler("order.create.new", results));
      });

      it("executes handlers in order of insertion", async () => {
        await router.handle("order.create.new", toUint8Array("test"));

        assert.deepStrictEqual(
          results,
          ["order.> test", "order.*.new test", "order.create.new test"],
          "Handlers should execute in order of insertion"
        );
      });

      it("maintains insertion order for wildcard matches", async () => {
        await router.handle("order.other.new", toUint8Array("test"));

        assert.deepStrictEqual(
          results,
          ["order.> test", "order.*.new test"],
          "Wildcard handlers should execute in order of insertion"
        );
      });
    });

    describe("ordering by custom sort", () => {
      const prioritySort: NatsSortFunction = (a, b) => +(a.metadata.priority ?? 0) - +(b.metadata.priority ?? 0);
      beforeEach(() => {
        router = new NatsRun({ sortStrategy: 'custom', customSort: prioritySort });
        results = [];
        router.add("order.create.new", testHandler("order.create.new", results), { priority: 3 });
        router.add("order.create", testHandler("order.create", results), { priority: 4 });
        router.add("order.*.new", testHandler("order.*.new", results), { priority: 2 });
        router.add("order.>", testHandler("order.>", results), { priority: 1 });
      });

      it("executes handlers according to custom sort function", async () => {
        await router.handle("order.create.new", toUint8Array("test"));

        assert.deepStrictEqual(
          results,
          ["order.> test", "order.*.new test", "order.create.new test"],
          "Handlers should execute according to custom sort function"
        );
      });

      it("applies custom sort to wildcard matches", async () => {
        await router.handle("order.other.new", toUint8Array("test"));

        assert.deepStrictEqual(
          results,
          ["order.*.new test", "order.> test"].sort(alphaSort),
          "Wildcard handlers should execute according to custom sort function"
        );
      });
    });
  });

  describe("Error handling", () => {
    let router: NatsRun;

    beforeEach(() => {
      router = new NatsRun();
    });

    it("should handle invalid subject patterns", () => {
      assert.throws(
        () => router.add("", async (_) => {}),
        { message: /Invalid subject pattern/ },
        "Should throw on empty subject"
      );

      assert.throws(
        () => router.add("order..create", async (_) => {}),
        { message: /Invalid subject pattern/ },
        "Should throw on subject with consecutive dots"
      );

      assert.throws(
        () => router.add("order.>.create", async (_) => {}),
        { message: /Invalid subject pattern/ },
        "Should throw on subject with > not at the end"
      );
    });

    it("should handle handler errors gracefully", async () => {
      const error = new Error("Handler error");
      router.add("order.create", async (_) => {
        throw error;
      });

      await assert.rejects(
        () => router.handle("order.create", toUint8Array("test")),
        error,
        "Should propagate handler errors"
      );
    });

    it("should handle multiple handler errors", async () => {
      const error1 = new Error("First handler error");
      const error2 = new Error("Second handler error");
      
      router.add("order.create", [
        async ({ data }) => { throw error1; },
        async ({ data }) => { throw error2; }
      ]);

      await assert.rejects(
        () => router.handle("order.create", toUint8Array("test")),
        error1,
        "Should propagate first handler error"
      );
    });

    it("should handle invalid handler types", () => {
      assert.throws(
        () => router.add("order.create", null as any),
        { message: /Invalid handler/ },
        "Should throw on null handler"
      );

      assert.throws(
        () => router.add("order.create", undefined as any),
        { message: /Invalid handler/ },
        "Should throw on undefined handler"
      );

      assert.throws(
        () => router.add("order.create", "not a function" as any),
        { message: /Invalid handler/ },
        "Should throw on non-function handler"
      );
    });

    it("should handle invalid message types", async () => {
      router.add("order.create", async ({ data }) => {
        assert.strictEqual(data, undefined, "Should handle undefined message");
      });

      await assert.doesNotReject(
        () => router.handle("order.create", undefined as any),
        "Should handle undefined message"
      );
    });
  });

  describe("Handler Registration and Matching", () => {
    let router: NatsRun;
    let results;

    beforeEach(() => {
      router = new NatsRun();
      results = [];
    });

    describe("Multiple Handlers", () => {
      it("executes multiple handlers for the same pattern", async () => {
        router.add("test.multi", [
          testHandler("handler1", results),
          testHandler("handler2", results)
        ]);

        await router.handle("test.multi", toUint8Array("test"));
        assert.deepStrictEqual(results, ["handler1 test", "handler2 test"]);
      });

      it("executes handlers in order of registration by default", async () => {
        router.add("test.order", testHandler("first", results));
        router.add("test.order", testHandler("second", results));

        await router.handle("test.order", toUint8Array("test"));
        assert.deepStrictEqual(results, ["first test", "second test"]);
      });
    });

    describe("Sort Strategies", () => {
      it("sorts handlers by specificity when configured", async () => {
        router = new NatsRun({ sortStrategy: 'specificity' });
        
        router.add("test.*", testHandler("wildcard", results));
        router.add("test.specific", testHandler("specific", results));
        router.add("test.*.end", testHandler("middle", results));

        await router.handle("test.specific", toUint8Array("test"));
        assert.deepStrictEqual(results, ["specific test", "wildcard test"]);
      });

      it("maintains insertion order when configured", async () => {
        router = new NatsRun({ sortStrategy: 'insertion' });
        
        router.add("test.*", testHandler("first", results));
        router.add("test.specific", testHandler("second", results));
        router.add("test.*", testHandler("third", results));

        await router.handle("test.specific", toUint8Array("test"));
        assert.deepStrictEqual(results, ["first test", "second test", "third test"]);
      });

      it("uses custom sort function when configured", async () => {
        const notWildcards = (part: string) => !['*', '>'].includes(part);
        const customSort: NatsSortFunction = (a, b) => {
          const aDepth = a.metadata._pattern.split('.').filter(notWildcards).length;
          const bDepth = b.metadata._pattern.split('.').filter(notWildcards).length;
          return aDepth - bDepth;
        };

        router = new NatsRun({ sortStrategy: 'custom', customSort });
        
        router.add("test.>", testHandler("short", results));
        router.add("test.new.>", testHandler("new", results));
        router.add("test.new.long.>", testHandler("long", results));
        router.add("test.new.long.pattern", testHandler("longest", results));
        router.add(">", testHandler("shortest", results));

        await router.handle("test.new.long.pattern", toUint8Array("test"));
        assert.deepStrictEqual(results, ["shortest test", "short test", "new test", "long test", "longest test"]);
      });
    });

    describe("Pattern Specificity", () => {
      it("matches more specific pattern first", async () => {
        router = new NatsRun({ sortStrategy: 'specificity' });

        router.add("test.>", testHandler("wildcard", results));
        router.add("test.specific", testHandler("specific", results));
        router.add("test.*.end", testHandler("middle", results));

        await router.handle("test.specific.end", toUint8Array("test"));
        assert.deepStrictEqual(results, ["middle test", "wildcard test"]);
      });

      it("matches most specific pattern first", async () => {
        router = new NatsRun({ sortStrategy: 'specificity' });

        router.add("test.a.>", testHandler("a >", results));
        router.add("test.b.>", testHandler("b >", results));
        router.add("test.*.specific", testHandler("* specific", results));

        await router.handle("test.a.specific", toUint8Array("test"));
        assert.deepStrictEqual(results, ["* specific test", "a > test"]);
      });

      it("handles overlapping patterns correctly", async () => {
        router = new NatsRun({ sortStrategy: 'specificity' });

        router.add("test.foo.>", testHandler("foo arrow", results));
        router.add("test.foo.*", testHandler("foo star", results));
        router.add("test.>", testHandler("arrow", results));

        await router.handle("test.foo.bar", toUint8Array("test"));
        assert.deepStrictEqual(results, ["foo star test", "foo arrow test", "arrow test"]);
      });
    });
  });

  describe("Handler Control Flow", () => {
    let router: NatsRun;
    let results: any[];

    beforeEach(() => {
      router = new NatsRun();
      results = [];
    });

    describe("Context Sharing", () => {
      it("allows handlers to share state via context", async () => {
        router.add("test.context", [
          async (msg, ctx, next) => {
            ctx.value = "first";
            results.push(ctx.value);
            return next(ctx);
          },
          async (msg, ctx) => {
            ctx.value += " second";
            results.push(ctx.value);
          }
        ]);

        await router.handle("test.context", "test");
        assert.deepStrictEqual(results, ["first", "first second"]);
      });

      it("isolates context between different subject matches", async () => {
        router.add("test.one", async (msg, ctx) => {
          ctx.value = "one";
          results.push(ctx.value);
        });

        router.add("test.two", async (msg, ctx) => {
          results.push(ctx.value); // should be undefined
        });

        await router.handle("test.one", "test");
        await router.handle("test.two", "test");
        assert.deepStrictEqual(results, ["one", undefined]);
      });
    });

    describe("Next Function Flow", () => {
      it("allows handlers to pass modified data to next handler", async () => {
        router.add("test.flow", [
          async (msg, ctx, next) => {
            const modified = msg.data + " modified";
            return next(modified);
          },
          async (msg, ctx) => {
            results.push(msg.data);
          }
        ]);

        const ctx = await router.handle("test.flow", "original");
        assert.deepStrictEqual(results, ["original"]);
        assert.deepStrictEqual(ctx._lastData, "original modified");
      });

      it("supports early termination of handler chain", async () => {
        router.add("test.early", [
          async (msg, ctx, next) => {
            if (msg.data === "stop") {
              results.push("stopped");
              return { ...ctx, _lastData: "stopped" }; // Don't call next
            }
            return await next(ctx);
          },
          async (msg) => {
            results.push("reached");
          }
        ]);

        await router.handle("test.early", "stop");
        await router.handle("test.early", "continue");
        assert.deepStrictEqual(results, ["stopped", "reached"]);
      });

      it("handles errors in next chain properly", async () => {
        router.add("test.error", [
          async (msg, ctx, next) => {
            try {
              return await next(ctx);
            } catch (err) {
              results.push("caught error");
            }
          },
          async () => {
            throw new Error("handler error");
          }
        ]);

        await router.handle("test.error", "test");
        assert.deepStrictEqual(results, ["caught error"]);
      });
    });

    describe("Next Function Edge Cases", () => {
      it("handles multiple next() calls gracefully", async () => {
        let callCount = 0;
        router.add("test.next", [
          async (msg, ctx, next) => {
            await next();
            await next(); // Should be ignored or error
            callCount++;
          },
          async (msg, ctx) => {
            callCount++;
          }
        ]);
        await router.handle("test.next", "test");
        assert.strictEqual(callCount, 2, "Should only execute handlers once");
      });
    
      it("preserves context through next() chain", async () => {
        const results: any[] = [];
        router.add("test.chain", [
          async (msg, ctx, next) => {
            ctx.first = true;
            await next({ modified: true });
          },
          async (msg, ctx, next) => {
            results.push([ctx.first, ctx.modified]);
            await next();
          }
        ]);
        await router.handle("test.chain", "test");
        assert.deepStrictEqual(results, [[true, true]]);
      });
    });

    describe("Combined Context and Next", () => {
      it("allows both state sharing and flow control", async () => {
        router.add("test.combined", [
          async (msg, ctx, next) => {
            ctx.count = 1;
            return next({ msgdata: msg.data + " first" });
          },
          async (msg, ctx, next) => {
            ctx.count++;
            results.push(`count: ${ctx.count}, data: ${ctx.msgdata}`);
          }
        ]);

        await router.handle("test.combined", "test");
        assert.deepStrictEqual(results, ["count: 2, data: test first"]);
      });

      it("maintains pattern matching with middleware", async () => {
        router.add("test.>", async (msg, ctx, next) => {
          ctx.matched = ctx.matched || [];
          ctx.matched.push("catchall");
          return next();
        });

        router.add("test.*.specific", async (msg, ctx, next) => {
          ctx.matched = ctx.matched || [];
          ctx.matched.push("specific");
          return next();
        });

        const ctx = await router.handle("test.foo.specific", "test");
        assert.deepStrictEqual(ctx.matched, ["specific", "catchall"]);
      });
    });

    describe("Run-specific Context", () => {
      it("maintains separate contexts for different runs", async () => {
        const results: any[] = [];
        router.add("test.a.specific", async (msg, ctx, next) => {
          ctx.pattern = "a";
          await next();
        });
        router.add("test.b.specific", async (msg, ctx, next) => {
          ctx.pattern = "b";
          await next();
        });
        router.add("test.*.specific", async (msg, ctx, next) => {
          results.push(ctx.pattern);
          await next();
        });
    
        const ctx1 = await router.handle("test.a.specific", "test");
        const ctx2 = await router.handle("test.b.specific", "test");
        assert.deepStrictEqual(results, ["a", "b"]);
        assert.deepStrictEqual(ctx1, { pattern: "a" });
        assert.deepStrictEqual(ctx2, { pattern: "b" });
      });
    });

    describe("Context Initialization", () => {
      it("provides a default empty context if none supplied", async () => {
        router.add("test.context", async (msg, ctx) => {
          assert.deepStrictEqual(ctx, {}, "Context should be initialized as empty object");
        });
        const ctx = await router.handle("test.context", "test");

        assert.deepStrictEqual(ctx, {}, "Context should be returned from the handle")
      });

      it("preserves supplied context properties", async () => {
        const initialCtx = { custom: "value" };
        router.add("test.context", async (msg, ctx) => {
          assert.strictEqual(ctx.custom, "value", "Should preserve initial context values");
        });
        const ctx = await router.handle("test.context", "test", initialCtx); 

        assert.deepStrictEqual(ctx, initialCtx, "Should return the same context unchanged from the handle");
      });
    });

    describe("Async Flow Control", () => {
      it("maintains order with async operations", async () => {
        const results: any[] = [];
        router.add("test.async", [
          async (msg, ctx, next) => {
            await new Promise(resolve => setTimeout(resolve, 50));
            results.push(1);
            await next();
          },
          async (msg, ctx, next) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            results.push(2);
            await next();
          },
          async () => {
            results.push(3);
          }
        ]);
        await router.handle("test.async", "test");
        assert.deepStrictEqual(results, [1, 2, 3]);
      });
    });
  });

  describe("Resource Management", () => {
    let router: NatsRun;

    beforeEach(() => {
      router = new NatsRun();
    });

    it("shows linear or better memory growth with increasing patterns", async () => {
      const measurements: Array<{n: number, memory: number}> = [];
      const samples = [1024, 2048, 4096, 8192, 16384, 32768, 65536];  // Test points
      
      // Take measurements at different N
      for (const n of samples) {
        // Force GC if available (Node --expose-gc required)
        if (global.gc) {
          global.gc();
        }
        
        const beforeMem = process.memoryUsage().rss;
        
        for (let i = 0; i < n; i++) {
          router.add(`test.${i}.pattern`, async () => {});
        }
        
        const afterMem = process.memoryUsage().rss;
        measurements.push({
          n,
          memory: (afterMem - beforeMem) / 1024 / 1024 // MB
        });
      }

      // Calculate growth ratios between consecutive measurements
      const growthRatios = measurements.slice(1).map((m, i) => ({
        n1: measurements[i].n,
        n2: m.n,
        ratio: m.memory / measurements[i].memory,
        expected: (m.n / measurements[i].n) * 1.2 // Allow 20% overhead for variability
      }));

      console.log('Memory measurements:', measurements);
      console.log('Growth ratios:', growthRatios);

      // Verify growth is roughly linear or better
      // If memory growth ratio is consistently less than or equal to N ratio, we're good
      growthRatios.forEach(({ ratio, expected }) => {
        assert(ratio <= expected,
          `Memory growth ratio (${ratio.toFixed(2)}) should not significantly exceed ` +
          `the input size ratio (${expected.toFixed(2)})`);
      });
    });

    it("maintains reasonable memory per pattern", async () => {
      const n = 2000; // Smaller sample for average calculation
      const threshold = 2048; // 2KB per pattern as an example threshold
      
      if (global.gc) {
        global.gc();
      }
      
      const beforeMem = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < n; i++) {
        router.add(`test.${i}.pattern`, async () => {});
      }
      
      const afterMem = process.memoryUsage().heapUsed;
      const memoryPerPattern = (afterMem - beforeMem) / n;
      
      console.log(`Average memory per pattern: ${memoryPerPattern.toFixed(2)} bytes`);
      
      // This threshold would need tuning based on your specific implementation
      assert(memoryPerPattern < threshold,
        `Memory per pattern (${memoryPerPattern.toFixed(2)} bytes) exceeds reasonable threshold (${threshold} bytes)`);
    });

    it("profiles memory usage by component", async () => {
      const n = 2000;
      const patterns = Array.from({length: n}, (_, i) => `test.${i}.pattern`);
      const handler = async () => {};
      
      // Measure base memory
      const baseline = process.memoryUsage().heapUsed;
      
      // Measure just patterns
      const patternStrings = new Set(patterns);
      const patternMem = process.memoryUsage().heapUsed - baseline;
      
      // Measure trie structure
      const router = new NatsRun();
      router.add(patterns[0], handler);
      const singleNodeMem = process.memoryUsage().heapUsed - baseline - patternMem;
      
      // Measure full structure
      for (const pattern of patterns.slice(1)) {
        router.add(pattern, handler);
      }
      const totalMem = process.memoryUsage().heapUsed - baseline;
      
      console.log({
        patternOverhead: patternMem / n,
        nodeOverhead: singleNodeMem,
        totalPerPattern: totalMem / n
      });
    });
  });  
});
