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
type Pattern = Record<string, any>;
type Payload = any;
declare class Bloomrun {
    private opts;
    private buckets;
    private regexBucket;
    private defaultResult;
    private tree;
    constructor(opts?: {
        indexing?: 'depth';
    });
    private get isDeep();
    add(pattern: Pattern, payload?: Payload): this;
    remove(pattern: Pattern, payload?: Payload): this;
    lookup(pattern: Pattern, opts?: {
        patterns?: boolean;
        payloads?: boolean;
    }): Payload | null;
    list(pattern?: Pattern, opts?: {
        patterns?: boolean;
        payloads?: boolean;
    }): Payload[];
    iterator(pattern?: Pattern, opts?: {
        patterns?: boolean;
        payloads?: boolean;
    }): BloomrunIterator;
    setDefault(payload: Payload): void;
    [Symbol.iterator](): Iterator<Payload>;
}
declare class BloomrunIterator {
    private parent;
    private pattern;
    private opts?;
    private buckets;
    private regexBucket;
    private bucketIndex;
    private dataIndex;
    private visited;
    constructor(parent: Bloomrun, pattern: Pattern | undefined, opts?: {
        patterns?: boolean;
        payloads?: boolean;
    } | undefined);
    private getBucketsForPattern;
    next(): Payload | null;
    private formatResult;
    [Symbol.iterator](): Iterator<Payload>;
}
export default Bloomrun;
