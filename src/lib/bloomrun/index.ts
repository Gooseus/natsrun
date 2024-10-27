// bloomrun.ts

type Pattern = Record<string, any>;
type Payload = any;

class PatternSet {
  constructor(
    public pattern: Pattern,
    public payload: Payload,
    public weight: number
  ) {}
}

var REST_REGEXP = /^[a-zA-z0-9-_.]+$/;

class Bucket {
  data: PatternSet[] = [];
  weight: number;

  constructor(private isDeep: boolean) {
    this.weight = isDeep ? 0 : Number.MAX_SAFE_INTEGER;
  }

  add(set: PatternSet): void {
    this.data.push(set);
    this.data.sort(this.isDeep ? deepSort : insertionSort);
    this.weight = this.isDeep
      ? Math.max(this.weight, set.weight)
      : Math.min(this.weight, set.weight);
  }

  remove(pattern: Pattern, payload: Payload | null): boolean {
    const initialLength = this.data.length;
    this.data = this.data.filter(
      (item) =>
        !match(pattern, item.pattern) ||
        (payload !== null && payload !== item.payload)
    );
    return this.data.length < initialLength;
  }
}

class Bloomrun {
  private buckets: Bucket[] = [];
  private regexBucket: Bucket;
  private defaultResult: Payload | null = null;
  private tree: Record<string, Record<string | number, Bucket>> = {};

  constructor(private opts: { indexing?: 'depth' } = {}) {
    this.regexBucket = new Bucket(this.isDeep);
  }

  private get isDeep(): boolean {
    return this.opts.indexing === 'depth';
  }

  add(pattern: Pattern, payload?: Payload): this {
    const patternSet = new PatternSet(
      pattern,
      payload ?? pattern,
      this.isDeep ? Object.keys(pattern).length : this.buckets.length + 1
    );

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

  remove(pattern: Pattern, payload?: Payload): this {
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

  lookup(pattern: Pattern, opts?: { patterns?: boolean; payloads?: boolean }): Payload | null {
    const iterator = new BloomrunIterator(this, pattern, opts);
    return iterator.next() ?? this.defaultResult;
  }

  list(pattern?: Pattern, opts?: { patterns?: boolean; payloads?: boolean }): Payload[] {
    const iterator = new BloomrunIterator(this, pattern, opts);
    const list: Payload[] = [];
    let current: Payload | null;

    while ((current = iterator.next()) !== null) {
      list.push(current);
    }

    if (!pattern && this.defaultResult) {
      if (opts?.patterns && opts?.payloads) {
        list.push({ default: true, payload: this.defaultResult });
      } else if (!opts?.patterns) {
        list.push(this.defaultResult);
      }
    }

    return list;
  }

  iterator(pattern?: Pattern, opts?: { patterns?: boolean; payloads?: boolean }): BloomrunIterator {
    return new BloomrunIterator(this, pattern, opts);
  }

  setDefault(payload: Payload): void {
    this.defaultResult = payload;
  }

  [Symbol.iterator](): Iterator<Payload> {
    return this.iterator()[Symbol.iterator]();
  }
}

class BloomrunIterator {
  private buckets: Bucket[];
  private regexBucket: Bucket | null;
  private bucketIndex = 0;
  private dataIndex = 0;
  private visited = new Set<PatternSet>();

  constructor(
    private parent: Bloomrun,
    private pattern: Pattern | undefined,
    private opts?: { patterns?: boolean; payloads?: boolean }
  ) {
    this.buckets = pattern ? this.getBucketsForPattern(pattern) : parent['buckets'];
    this.regexBucket = parent['regexBucket'].data.length > 0 ? parent['regexBucket'] : null;
  }

  private getBucketsForPattern(pattern: Pattern): Bucket[] {
    const buckets: Bucket[] = [];
    const tree = this.parent['tree'];

    for (const [key, value] of Object.entries(pattern)) {
      if (tree[key]?.[value]) {
        buckets.push(tree[key][value]);
      }
    }

    return buckets.sort(this.parent['isDeep'] ? deepSort : insertionSort);
  }

  next(): Payload | null {
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
        } else {
          this.bucketIndex++;
        }
        this.dataIndex = 0;
      }
    }

    return null;
  }

  private formatResult(data: PatternSet): Payload {
    if (this.opts?.patterns) {
      return this.opts.payloads
        ? { pattern: data.pattern, payload: data.payload }
        : data.pattern;
    }
    return data.payload;
  }

  [Symbol.iterator](): Iterator<Payload> {
    return {
      next: () => {
        const value = this.next();
        return value !== null ? { value, done: false } : { done: true, value: undefined };
      },
    };
  }
}

function match(pattern: Pattern, obj: Pattern): boolean {
  for (const [key, value] of Object.entries(pattern)) {
    if (value instanceof RegExp) {
      if (typeof obj[key] !== 'string' || !value.test(obj[key])) {
        return false;
      }
    } else if (obj[key] !== value) {
      return false;
    }
  }

  for(const [key, value] of Object.entries(obj)) {
    if(pattern[key] instanceof RegExp) {
      if(pattern[key].source === REST_REGEXP.source) break;
    } else {
      if(pattern[key] === undefined || pattern[key] !== value) return false;
    }
  }
  return true;
}

function onlyRegex(pattern: Pattern): boolean {
  return Object.values(pattern).every((value) => value instanceof RegExp);
}

function deepSort<T extends Bucket | PatternSet>(a: T, b: T): number {
  return b.weight - a.weight;
}

function insertionSort<T extends Bucket | PatternSet>(a: T, b: T): number {
  return a.weight - b.weight;
}

export default Bloomrun;