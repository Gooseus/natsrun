type Payload = any;
export interface ITrieNode {
    children: Map<string, ITrieNode>;
    payloads: Payload[];
    isTerminal: boolean;
    isRoot: boolean;
}
export interface INatsTrie {
    trieRoot: ITrieNode;
    insert(subject: string, payload: Payload): void;
    match(subject: string): Payload[];
}
export declare class NatsTrie implements INatsTrie {
    trieRoot: ITrieNode;
    constructor(node?: ITrieNode);
    /**
     * Insert a payload into the trie
     *
     * @param subject the subject to insert under
     * @param payload the payload to insert
     */
    insert(subject: string, payload: Payload): void;
    /**
     * Lookup a subject in the trie
     *
     * @param subject the subject to lookup
     * @returns the array of payloads that match the subject
     */
    match(subject: string): Payload[];
}
export {};
