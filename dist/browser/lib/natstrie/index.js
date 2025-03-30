/**
 * Error thrown when an invalid NATS subject pattern is provided
 */
export class InvalidSubjectError extends Error {
    /** The invalid subject pattern that caused the error */
    subject;
    /** The reason why the subject pattern is invalid */
    reason;
    constructor(subject, reason) {
        super(`Invalid subject pattern "${subject}": ${reason}`);
        this.name = "InvalidSubjectError";
        this.subject = subject;
        this.reason = reason;
    }
}
/**
 * Error thrown when an invalid payload is provided
 */
export class InvalidPayloadError extends Error {
    /** The reason why the payload is invalid */
    reason;
    constructor(reason) {
        super(`Invalid payload: ${reason}`);
        this.name = "InvalidPayloadError";
        this.reason = reason;
    }
}
/**
 * Error thrown when an invalid operation is attempted on the trie
 */
export class TrieOperationError extends Error {
    /** The reason why the operation is invalid */
    reason;
    constructor(reason) {
        super(`Trie operation error: ${reason}`);
        this.name = "TrieOperationError";
        this.reason = reason;
    }
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
export class NatsTrie {
    /** The root node of the trie */
    trieRoot;
    /**
     * Create a new NatsTrie instance
     *
     * @param node Optional initial trie node to use
     */
    constructor(node) {
        this.trieRoot = node ?? createTrie();
    }
    /**
     * Traverse the trie and return all nodes
     *
     * @param node The current trie node to traverse from
     * @returns Array of all nodes in the trie
     */
    traverse(node) {
        const results = [node];
        for (const child of node.branches.values()) {
            results.push(...this.traverse(child));
        }
        return results;
    }
    /**
     * Insert a payload into the trie
     *
     * @param subject a defined subject to insert under
     * @param payload a defined payload to insert
     */
    insert(subject, payload) {
        if (!subject)
            throw new InvalidSubjectError(subject, "must be defined");
        if (!payload || (Array.isArray(payload) && payload.some((p) => !p)))
            throw new InvalidPayloadError("must be defined");
        const topics = subject.split(".");
        if (topics.length === 0)
            throw new InvalidSubjectError(subject, "cannot be empty");
        if (topics.some((topic) => topic === ""))
            throw new InvalidSubjectError(subject, "cannot contain empty topics");
        if (topics.indexOf(">") !== -1 && topics.indexOf(">") !== topics.length - 1)
            throw new InvalidSubjectError(subject, '">" must be the last topic');
        insert(this.trieRoot, topics, payload);
    }
    /**
     * Lookup a subject in the trie
     *
     * @param subject the subject to lookup
     * @returns the array of payloads that match the subject
     */
    match(subject) {
        const topics = subject.split(".");
        return match(this.trieRoot, topics);
    }
    /**
     * Find a subject in the trie
     *
     * @param subject the subject to find
     * @returns the node that matches the subject
     */
    find(subject) {
        const topics = subject.split(".");
        return find(this.trieRoot, topics);
    }
    /**
     * Search for a subject in the trie
     *
     * @param subject the subject to search for
     * @returns the node that matches the subject
     */
    search(subject) {
        const topics = subject.split(".");
        return search(this.trieRoot, topics);
    }
}
// Helper functions
/**
 * Create a new Trie node
 *
 * @param opts Trie options
 * @returns new Trie node
 */
function createTrie({ depth = 0, isLeaf = false, topic = "", order = 0 } = {}) {
    return { branches: new Map(), payload: null, depth, isLeaf, topic, order };
}
/**
 * Insert a payload into the trie
 *
 * @param trie the trie to insert into
 * @param subjectTopics the subject topics to insert under
 * @param payload the payload to insert
 */
function insert(trie, subjectTopics, payload) {
    let node = trie;
    for (const topic of subjectTopics) {
        if (!node.branches.has(topic)) {
            node.branches.set(topic, createTrie({ depth: node.depth + 1, topic, order: node.order + 1 }));
        }
        if (node.topic === ">")
            break;
        node = node.branches.get(topic);
    }
    node.isLeaf = true;
    if (node.payload) {
        if (Array.isArray(node.payload)) {
            if (Array.isArray(payload)) {
                node.payload.push(...payload);
            }
            else {
                node.payload.push(payload);
            }
        }
        else {
            if (Array.isArray(payload)) {
                node.payload = [node.payload, ...payload];
            }
            else {
                node.payload = [node.payload, payload];
            }
        }
    }
    else {
        node.payload = payload;
    }
}
/**
 * Search for a subject in the trie
 *
 * @param node The current trie node to search from
 * @param subjectTopics Array of subject topics to match
 * @returns The matching trie node if found, undefined otherwise
 *
 * @example
 * ```typescript
 * // Search for 'user.123.profile' in trie
 * const node = search(trie, ['user', '123', 'profile']);
 * ```
 */
function search(node, subjectTopics) {
    if ((node.depth === subjectTopics.length && node.isLeaf) || node.topic === ">") {
        return node;
    }
    if (!node.topic && node.depth > 0)
        return undefined;
    const topic = subjectTopics[node.depth];
    // Exact match
    if (node.branches.has(topic)) {
        return search(node.branches.get(topic), subjectTopics);
    }
    // Single match wildcard '*'
    if (node.branches.has("*")) {
        return search(node.branches.get("*"), subjectTopics);
    }
    // Full match wildcard '>'
    if (node.branches.has(">")) {
        return search(node.branches.get(">"), subjectTopics);
    }
}
/**
 * Lookup a subject in the trie
 *
 * @param trie the trie to lookup in
 * @param subjectTopics the subject topics to lookup
 * @returns array of payloads that match the subject
 */
function match(trie, subjectTopics) {
    let results = [];
    function search(node, index) {
        if ((index === subjectTopics.length && node.isLeaf) || node.topic === ">") {
            results.push(node);
            return;
        }
        const topic = subjectTopics[index];
        // Exact match
        if (node.branches.has(topic)) {
            search(node.branches.get(topic), index + 1);
        }
        // Single match wildcard '*'
        if (node.branches.has("*")) {
            search(node.branches.get("*"), index + 1);
        }
        // Full match wildcard '>'
        if (node.branches.has(">")) {
            search(node.branches.get(">"), index + 1);
        }
    }
    search(trie, 0);
    return results;
}
/**
 * Lookup a subject in the trie
 *
 * @param trie the trie to lookup in
 * @param subjectTopics the subject topics to lookup
 * @returns array of payloads that match the subject
 */
function find(trie, subjectTopics) {
    function search(node, index) {
        if (index === subjectTopics.length || node.isLeaf) {
            return node;
        }
        const topic = subjectTopics[index];
        if (node.branches.has(topic)) {
            return search(node.branches.get(topic), index + 1);
        }
        return undefined;
    }
    return search(trie, 0);
}
