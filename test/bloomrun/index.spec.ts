import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import Bloomrun from '../../src/lib/bloomrun';

describe('Bloomrun', () => {
  test('add and lookup', () => {
    const bloom = new Bloomrun();
    bloom.add({ hello: 'world' }, 'Hello, World!');
    const result = bloom.lookup({ hello: 'world' });
    assert.equal(result, 'Hello, World!');
  });

  test('add without payload', () => {
    const bloom = new Bloomrun();
    const pattern = { hello: 'world' };
    bloom.add(pattern);
    const result = bloom.lookup(pattern);
    assert.deepEqual(result, pattern);
  });

  test('lookup with non-matching pattern', () => {
    const bloom = new Bloomrun();
    bloom.add({ hello: 'world' }, 'Hello, World!');
    const result = bloom.lookup({ hello: 'universe' });
    assert.equal(result, null);
  });

  test('remove', () => {
    const bloom = new Bloomrun();
    bloom.add({ hello: 'world' }, 'Hello, World!');
    bloom.remove({ hello: 'world' });
    const result = bloom.lookup({ hello: 'world' });
    assert.equal(result, null);
  });

  test('list', () => {
    const bloom = new Bloomrun();
    bloom.add({ hello: 'world' }, 'Hello, World!');
    bloom.add({ hello: 'universe' }, 'Hello, Universe!');
    const results = bloom.list();
    assert.deepEqual(results, ['Hello, World!', 'Hello, Universe!']);
  });

  test('list with pattern', () => {
    const bloom = new Bloomrun();
    bloom.add({ hello: 'world' }, 'Hello, World!');
    bloom.add({ hello: 'universe' }, 'Hello, Universe!');
    const results = bloom.list({ hello: 'world' });
    assert.deepEqual(results, ['Hello, World!']);
  });

  test('iterator', () => {
    const bloom = new Bloomrun();
    bloom.add({ hello: 'world' }, 'Hello, World!');
    bloom.add({ hello: 'universe' }, 'Hello, Universe!');
    const iterator = bloom.iterator();
    assert.equal(iterator.next(), 'Hello, World!');
    assert.equal(iterator.next(), 'Hello, Universe!');
    assert.equal(iterator.next(), null);
  });

  test('setDefault', () => {
    const bloom = new Bloomrun();
    bloom.setDefault('Default Result');
    const result = bloom.lookup({ nonexistent: 'pattern' });
    assert.equal(result, 'Default Result');
  });

  test('regex pattern', () => {
    const bloom = new Bloomrun();
    bloom.add({ hello: /wo.*/ }, 'Hello, World!');
    const result = bloom.lookup({ hello: 'world' });
    assert.equal(result, 'Hello, World!');
  });

  test('depth indexing', () => {
    const bloom = new Bloomrun({ indexing: 'depth' });
    bloom.add({ a: 1 }, 'First');
    bloom.add({ a: 1, b: 2 }, 'Second');
    bloom.add({ a: 1, b: 2, c: 3 }, 'Third');
    const result = bloom.lookup({ a: 1, b: 2, c: 3 });
    assert.equal(result, 'Third');
  });

  test('Symbol.iterator', () => {
    const bloom = new Bloomrun();
    bloom.add({ hello: 'world' }, 'Hello, World!');
    bloom.add({ hello: 'universe' }, 'Hello, Universe!');
    const results = [...bloom];
    assert.deepEqual(results, ['Hello, World!', 'Hello, Universe!']);
  });
});