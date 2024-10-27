/**
 * bloomrun.ts
 * Ported to TypeScript from https://github.com/mcollina/bloomrun
 * with the assistance of a claude-3.5-sonnet model via Cursor
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015-2017 Matteo Collina
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * https://github.com/mcollina/bloomrun/blob/master/LICENSE
**/
class PatternSet {
    pattern;
    payload;
    weight;
    constructor(pattern, payload, weight) {
        this.pattern = pattern;
        this.payload = payload;
        this.weight = weight;
    }
}
var REST_REGEXP = /^[a-zA-z0-9-_.]+$/;
class Bucket {
    isDeep;
    data = [];
    weight;
    constructor(isDeep) {
        this.isDeep = isDeep;
        this.weight = isDeep ? 0 : Number.MAX_SAFE_INTEGER;
    }
    add(set) {
        this.data.push(set);
        this.data.sort(this.isDeep ? deepSort : insertionSort);
        this.weight = this.isDeep
            ? Math.max(this.weight, set.weight)
            : Math.min(this.weight, set.weight);
    }
    remove(pattern, payload) {
        const initialLength = this.data.length;
        this.data = this.data.filter((item) => !match(pattern, item.pattern) ||
            (payload !== null && payload !== item.payload));
        return this.data.length < initialLength;
    }
}
class Bloomrun {
    opts;
    buckets = [];
    regexBucket;
    defaultResult = null;
    tree = {};
    constructor(opts = {}) {
        this.opts = opts;
        this.regexBucket = new Bucket(this.isDeep);
    }
    get isDeep() {
        return this.opts.indexing === 'depth';
    }
    add(pattern, payload) {
        const patternSet = new PatternSet(pattern, payload ?? pattern, this.isDeep ? Object.keys(pattern).length : this.buckets.length + 1);
        if (onlyRegex(pattern)) {
            this.regexBucket.add(patternSet);
            return this;
        }
        for (const [key, value] of Object.entries(pattern)) {
            if (typeof value !== 'object') {
                if (!this.tree[key]) {
                    this.tree[key] = {};
                }
                if (!this.tree[key][value]) {
                    const bucket = new Bucket(this.isDeep);
                    this.buckets.push(bucket);
                    this.tree[key][value] = bucket;
                }
                this.tree[key][value].add(patternSet);
            }
        }
        return this;
    }
    remove(pattern, payload) {
        if (onlyRegex(pattern)) {
            this.regexBucket.remove(pattern, payload ?? null);
            return this;
        }
        for (const [key, value] of Object.entries(pattern)) {
            if (typeof value !== 'object' && this.tree[key]?.[value]) {
                const bucket = this.tree[key][value];
                if (bucket.remove(pattern, payload ?? null)) {
                    this.buckets = this.buckets.filter((b) => b !== bucket);
                    delete this.tree[key][value];
                    bucket.data.forEach((set) => this.add(set.pattern, set.payload));
                }
            }
        }
        return this;
    }
    lookup(pattern, opts) {
        const iterator = new BloomrunIterator(this, pattern, opts);
        return iterator.next() ?? this.defaultResult;
    }
    list(pattern, opts) {
        const iterator = new BloomrunIterator(this, pattern, opts);
        const list = [];
        let current;
        while ((current = iterator.next()) !== null) {
            list.push(current);
        }
        if (!pattern && this.defaultResult) {
            if (opts?.patterns && opts?.payloads) {
                list.push({ default: true, payload: this.defaultResult });
            }
            else if (!opts?.patterns) {
                list.push(this.defaultResult);
            }
        }
        return list;
    }
    iterator(pattern, opts) {
        return new BloomrunIterator(this, pattern, opts);
    }
    setDefault(payload) {
        this.defaultResult = payload;
    }
    [Symbol.iterator]() {
        return this.iterator()[Symbol.iterator]();
    }
}
class BloomrunIterator {
    parent;
    pattern;
    opts;
    buckets;
    regexBucket;
    bucketIndex = 0;
    dataIndex = 0;
    visited = new Set();
    constructor(parent, pattern, opts) {
        this.parent = parent;
        this.pattern = pattern;
        this.opts = opts;
        this.buckets = pattern ? this.getBucketsForPattern(pattern) : parent['buckets'];
        this.regexBucket = parent['regexBucket'].data.length > 0 ? parent['regexBucket'] : null;
    }
    getBucketsForPattern(pattern) {
        const buckets = [];
        const tree = this.parent['tree'];
        for (const [key, value] of Object.entries(pattern)) {
            if (tree[key]?.[value]) {
                buckets.push(tree[key][value]);
            }
        }
        return buckets.sort(this.parent['isDeep'] ? deepSort : insertionSort);
    }
    next() {
        while (this.bucketIndex < this.buckets.length || this.regexBucket) {
            const currentBucket = this.regexBucket || this.buckets[this.bucketIndex];
            const currentData = currentBucket.data[this.dataIndex];
            if (currentData && (!this.pattern || match(currentData.pattern, this.pattern))) {
                if (!this.visited.has(currentData)) {
                    this.visited.add(currentData);
                    this.dataIndex++;
                    return this.formatResult(currentData);
                }
            }
            this.dataIndex++;
            if (this.dataIndex >= currentBucket.data.length) {
                if (this.regexBucket) {
                    this.regexBucket = null;
                }
                else {
                    this.bucketIndex++;
                }
                this.dataIndex = 0;
            }
        }
        return null;
    }
    formatResult(data) {
        if (this.opts?.patterns) {
            return this.opts.payloads
                ? { pattern: data.pattern, payload: data.payload }
                : data.pattern;
        }
        return data.payload;
    }
    [Symbol.iterator]() {
        return {
            next: () => {
                const value = this.next();
                return value !== null ? { value, done: false } : { done: true, value: undefined };
            },
        };
    }
}
function match(pattern, obj) {
    for (const [key, value] of Object.entries(pattern)) {
        if (value instanceof RegExp) {
            if (typeof obj[key] !== 'string' || !value.test(obj[key])) {
                return false;
            }
        }
        else if (obj[key] !== value) {
            return false;
        }
    }
    // TODO: need to remove the REST_REGEXP dep and find more elegant way to handle NATS wildcards
    for (const [key, value] of Object.entries(obj)) {
        if (pattern[key] instanceof RegExp) {
            if (pattern[key].source === REST_REGEXP.source)
                break;
        }
        else {
            if (pattern[key] === undefined || pattern[key] !== value)
                return false;
        }
    }
    return true;
}
function onlyRegex(pattern) {
    return Object.values(pattern).every((value) => value instanceof RegExp);
}
function deepSort(a, b) {
    return b.weight - a.weight;
}
function insertionSort(a, b) {
    return a.weight - b.weight;
}
export default Bloomrun;
