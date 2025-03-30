/**
 * A trie node that stores a payload and branches for each token in the subject
 *
 * @typeParam T - The type of payload stored in the trie node
 */
export interface ITrieNode<T> {
    /** the order of insertion */
    order: number;
    /** The depth of this node in the trie (0 for root) */
    depth: number;
    /** The topic token this node represents */
    topic: string;
    /** Map of child nodes keyed by their topic tokens */
    branches: Map<string, ITrieNode<T>>;
    /** The payload stored at this node, can be a single value or array */
    payload: T | T[] | null;
    /** Whether this node represents a complete topic pattern */
    isLeaf: boolean;
}
/**
 * A trie data structure optimized for NATS subject pattern matching.
 *
 * @typeParam T - The type of payload stored in the trie nodes
 */
export interface INatsTrie<T> {
    /** The root node of the trie */
    trieRoot: ITrieNode<T>;
    /**
     * Insert a payload into the trie under the given topic
     * @param topic - The topic to insert under
     * @param payload - The payload to store at this topic
     */
    insert(topic: string, payload: T | T[]): void;
    /**
     * Find all nodes that match the given topic
     * @param topic - The topic to match against
     * @returns Array of matching nodes
     */
    match(topic: string): ITrieNode<T>[];
    /**
     * Search for a specific topic in the trie
     * @param topic - The topic to search for
     * @returns The matching node if found, undefined otherwise
     */
    search(topic: string): ITrieNode<T> | undefined;
}
/**
 * Options for creating a new Trie node
 *
 * @typeParam T - The type of payload stored in the trie node
 */
export type TTrieOpts = {
    /** The depth of the node in the trie (0 for root) */
    depth?: number;
    /** Whether this node represents a complete subject pattern */
    isLeaf?: boolean;
    /** The subject token this node represents */
    topic?: string;
    /** The order of insertion */
    order?: number;
};
/**
 * Error thrown when an invalid NATS subject pattern is provided
 */
export declare class InvalidSubjectError extends Error {
    /** The invalid subject pattern that caused the error */
    subject: string;
    /** The reason why the subject pattern is invalid */
    reason: string;
    constructor(subject: string, reason: string);
}
/**
 * Error thrown when an invalid payload is provided
 */
export declare class InvalidPayloadError extends Error {
    /** The reason why the payload is invalid */
    reason: string;
    constructor(reason: string);
}
/**
 * Error thrown when an invalid operation is attempted on the trie
 */
export declare class TrieOperationError extends Error {
    /** The reason why the operation is invalid */
    reason: string;
    constructor(reason: string);
}
/**
 * A trie data structure optimized for NATS subject pattern matching.
 *
 * The NatsTrie implements a specialized trie (prefix tree) that handles NATS subject patterns,
 * including wildcards (* for single token) and greater-than (> for multiple tokens).
 *
 * It provides efficient subject-based routing by storing patterns in a tree structure where:
 * - Each level represents a token in the subject (delimited by periods)
 * - Branches can contain literal matches, wildcards (*), or greater-than (>)
 * - Matching follows NATS subject matching rules
 *
 * @example
 * ```typescript
 * const trie = new NatsTrie<Handler>();
 * trie.insert('user.created', handler1);
 * trie.insert('user.*.updated', handler2);
 * trie.insert('user.>', handler3);
 *
 * const matches = trie.match('user.123.updated');
 * // Returns nodes containing handler2 and handler3
 * ```
 *
 * @typeParam T - The type of payload stored in the trie nodes
 */
export declare class NatsTrie<T> implements INatsTrie<T> {
    /** The root node of the trie */
    trieRoot: ITrieNode<T>;
    /**
     * Create a new NatsTrie instance
     *
     * @param node Optional initial trie node to use
     */
    constructor(node?: ITrieNode<T>);
    /**
     * Traverse the trie and return all nodes
     *
     * @param node The current trie node to traverse from
     * @returns Array of all nodes in the trie
     */
    traverse(node: ITrieNode<T>): ITrieNode<T>[];
    /**
     * Insert a payload into the trie
     *
     * @param subject a defined subject to insert under
     * @param payload a defined payload to insert
     */
    insert(subject: string, payload: T | T[]): void;
    /**
     * Lookup a subject in the trie
     *
     * @param subject the subject to lookup
     * @returns the array of payloads that match the subject
     */
    match(subject: string): ITrieNode<T>[];
    /**
     * Find a subject in the trie
     *
     * @param subject the subject to find
     * @returns the node that matches the subject
     */
    find(subject: string): ITrieNode<T> | undefined;
    /**
     * Search for a subject in the trie
     *
     * @param subject the subject to search for
     * @returns the node that matches the subject
     */
    search(subject: string): ITrieNode<T> | undefined;
}
