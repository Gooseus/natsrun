
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

type TTrieOpts = {
  isRoot?: boolean;
  isTerminal?: boolean;
};

// NatsTrie is a simple trie data structure for looking up payloads by NATS subject patterns
export class NatsTrie implements INatsTrie {
  trieRoot: ITrieNode;

  constructor(node?: ITrieNode) {
    this.trieRoot = node ?? createTrie({ isRoot: true });
  }

  /**
   * Insert a payload into the trie
   * 
   * @param subject the subject to insert under
   * @param payload the payload to insert
   */
  insert(subject: string, payload: Payload): void {
    const subjectTokens = subject.split('.');
    insert(this.trieRoot, subjectTokens, payload);
  }

  /**
   * Lookup a subject in the trie
   * 
   * @param subject the subject to lookup
   * @returns the array of payloads that match the subject
   */
  match(subject: string): Payload[] {
    const subjectTokens = subject.split('.');
    return match(this.trieRoot, subjectTokens);
  }
}

// Helper functions

/**
 * Create a new Trie node
 * 
 * @param opts Trie options
 * @returns new Trie node
 */
function createTrie(opts: TTrieOpts = { isTerminal: false, isRoot: false }): ITrieNode {
  return { children: new Map(), payloads: [], isTerminal: !!opts.isTerminal, isRoot: !!opts.isRoot };
}

/**
 * Insert a payload into the trie
 * 
 * @param trie the trie to insert into
 * @param subjectTokens the subject tokens to insert under
 * @param payload the payload to insert
 */
function insert(trie: ITrieNode, subjectTokens: string[], payload: Payload): void {
  let node = trie;
  for (const token of subjectTokens) {
    if (!node.children.has(token)) {
      node.children.set(token, createTrie());
    }
    node = node.children.get(token)!;
  }
  node.isTerminal = true;
  node.payloads.push(payload);
}

/**
 * Lookup a subject in the trie
 * 
 * @param trie the trie to lookup in
 * @param subjectTokens the subject tokens to lookup
 * @returns array of payloads that match the subject
 */
function match(trie: ITrieNode, subjectTokens: string[]): Payload[] {
  let results: Payload[] = [];

  function search(node: ITrieNode, index: number): void {
    if (index === subjectTokens.length) {
      if (node.isTerminal) {
        results.push(...node.payloads);
      }

      if(node.isRoot && node.children.has('>')) {
        collectAllPayloads(node.children.get('>')!, results);
      }
      return;
    }

    const token = subjectTokens[index];

    // Exact match
    if (node.children.has(token)) {
      search(node.children.get(token)!, index + 1);
    }

    // Single-level wildcard '*'
    if (node.children.has('*')) {
      search(node.children.get('*')!, index + 1);
    }

    // Multi-level wildcard '>'
    if (node.children.has('>')) {
      collectAllPayloads(node.children.get('>')!, results);
    }
  }

  search(trie, 0);
  return results;
}

/**
 * Collect all payloads from a node and its children, for multi-level wildcard '>'
 * 
 * @param node the node to collect payloads from
 * @param results the array to collect payloads into
 */
function collectAllPayloads(node: ITrieNode, results: Payload[]): void {
  results.push(...node.payloads);
  for (const child of node.children.values()) {
    collectAllPayloads(child, results);
  }
}

