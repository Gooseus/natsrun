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
