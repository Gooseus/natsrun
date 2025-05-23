/**
 * A pool of strings that ensures each unique string is stored only once
 */
export class StringPool {
  /** Map of strings to their unique IDs */
  private pool: Map<string, number>;
  /** Array of strings indexed by their IDs */
  private strings: string[];
  /** Next available ID for a new string */
  private nextId: number;

  constructor() {
    this.pool = new Map();
    this.strings = [];
    this.nextId = 2;
  }

  /**
   * Get the ID for a string, adding it to the pool if not already present
   * @param str The string to intern
   * @returns The ID of the string in the pool
   */
  intern(str: string): number {
    if (str === "") {
      throw new Error('StringPool does not support empty strings');
    }
    if (str === ">") return 0;
    if (str === "*") return 1;
    if (typeof str !== 'string') {
      throw new Error('StringPool only supports string inputs');
    }

    const existing = this.pool.get(str);
    if (existing !== undefined) {
      return existing;
    }

    const id = this.nextId++;
    this.pool.set(str, id);
    this.strings[id] = str;
    return id;
  }

  /**
   * Get the string for a given ID
   * @param id The ID of the string to retrieve
   * @returns The string associated with the ID
   */
  getString(id: number): string {
    if (id == 0) return ">";
    if (id == 1) return "*";
    if (id < 0 || id >= this.strings.length) {
      throw new Error('Invalid string ID');
    }
    return this.strings[id];
  }

  /**
   * Clear the string pool
   */
  clear(): void {
    this.pool.clear();
    this.strings = [];
    this.nextId = 0;
  }

  /**
   * Get the number of strings in the pool
   */
  size(): number {
    return this.pool.size;
  }
} 