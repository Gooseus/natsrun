
/**
 * Error thrown when an invalid NATS subject pattern is provided
 */
export class InvalidSubjectError extends Error {
  /** The invalid subject pattern that caused the error */
  subject: string;
  /** The reason why the subject pattern is invalid */
  reason: string;

  constructor(subject: string, reason: string) {
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
  reason: string;

  constructor(reason: string) {
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
  reason: string;

  constructor(reason: string) {
    super(`Trie operation error: ${reason}`);
    this.name = "TrieOperationError";
    this.reason = reason;
  }
}