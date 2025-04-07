import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";

import { NatsRun, NatsSortFunction } from "../src/index.js";

function traverseTrie(node, path: string[] = []) {
  if (node.isLeaf) {
    return path;
  }

  for (const [key, child] of node.branches.entries()) {
    path = traverseTrie(child, [key as string, ...path]);
  }

  return path;
}

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
          router.add(sub, ({ subject, pattern }) => {
            tests[sub] = true;
            results.push([subject, pattern]);
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
        router.add("order.create.new", async ({ data }) => { results.push(`order.create.new ${fromUint8Array(data)}`); });
        router.add("order.create", async ({ data }) => { results.push(`order.create ${fromUint8Array(data)}`); });
        router.add("order.*.new", async ({ data }) => { results.push(`order.*.new ${fromUint8Array(data)}`); });
        router.add("order.>", async ({ data }) => { results.push(`order.> ${fromUint8Array(data)}`); });
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
        router.add("order.>", async ({ data }) => { results.push(`order.> ${fromUint8Array(data)}`); });
        router.add("order.*.new", async ({ data }) => { results.push(`order.*.new ${fromUint8Array(data)}`); });
        router.add("order.create", async ({ data }) => { results.push(`order.create ${fromUint8Array(data)}`); });
        router.add("order.create.new", async ({ data }) => { results.push(`order.create.new ${fromUint8Array(data)}`); });
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
      beforeEach(() => {
        // Custom sort that orders alphabetically on the last topic in the subject
        const customSort: NatsSortFunction = (a, b) => a.topic.localeCompare(b.topic);

        router = new NatsRun({ sortStrategy: 'custom', customSort });
        results = [];
        router.add("order.create.new", async ({ data }) => { results.push(`order.create.new ${fromUint8Array(data)}`); });
        router.add("order.create", async ({ data }) => { results.push(`order.create ${fromUint8Array(data)}`); });
        router.add("order.*.new", async ({ data }) => { results.push(`order.*.new ${fromUint8Array(data)}`); });
        router.add("order.>", async ({ data }) => { results.push(`order.> ${fromUint8Array(data)}`); });
      });

      it("executes handlers according to custom sort function", async () => {
        await router.handle("order.create.new", toUint8Array("test"));

        assert.deepStrictEqual(
          results,
          ["order.create.new test", "order.*.new test", "order.> test"].sort(alphaSort),
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
});
