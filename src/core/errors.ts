import type { Tagged } from "./abstractions";

/**
 * Error thrown when attempting to unwrap an empty `Option` (`None`) or a failed `Result` (`Err`).
 *
 * Extends the native JavaScript `Error` class for full stack-trace support in Node.js >= 16,
 * while preserving the `error` property and `_tag = "UnwrapError"` from `@luism/result-ts`.
 *
 * @template E The underlying error payload type.
 * @example
 * ```ts
 * try {
 *   Result.err("invalid input").unwrap();
 * } catch (err) {
 *   if (err instanceof UnwrapError) {
 *     console.error(err.error); // "invalid input"
 *   }
 * }
 * ```
 */
export class UnwrapError<E = unknown> extends Error implements Tagged<"UnwrapError"> {
  /**
   * Discriminator tag identifying this error class.
   */
  public readonly _tag = "UnwrapError" as const;

  /**
   * The underlying cause or error payload associated with the failed unwrap.
   */
  public readonly error: E;

  /**
   * Creates a new `UnwrapError`.
   *
   * @param error The underlying error value or reason.
   * @param message Optional human-readable error message.
   */
  constructor(error: E, message?: string) {
    super(
      message ??
        (typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Attempted to unwrap an empty or failed ADT value"),
    );
    this.name = "UnwrapError";
    this.error = error;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
