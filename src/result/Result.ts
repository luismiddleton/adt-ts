import type { Bimappable, Chainable, Matchable, Tagged, Unwrappable } from "../core/abstractions";
import { UnwrapError } from "../core/errors";
import { Option } from "../option/Option";

/**
 * Discriminated union branch representing a successful {@link Result}.
 *
 * @template T The success value type.
 */
export type Ok<T> = {
  readonly _tag: "ok";
  readonly value: T;
};

/**
 * Discriminated union branch representing a failed {@link Result}.
 *
 * @template E The error value type.
 */
export type Err<E> = {
  readonly _tag: "error";
  readonly error: E;
};

/**
 * Underlying discriminated union representation of a {@link Result}.
 *
 * @template T The success value type.
 * @template E The error value type.
 */
export type TResult<T, E> = Ok<T> | Err<E>;

/**
 * Pattern matcher branches for deconstructing a {@link Result}.
 *
 * @template T The success value type.
 * @template E The error value type.
 * @template R The return type of the match expression.
 */
export interface ResultMatcher<T, E, R> {
  /**
   * Handler invoked when the result is `Ok`.
   */
  readonly ok: (value: T) => R;

  /**
   * Handler invoked when the result is `Err`.
   */
  readonly err: (error: E) => R;
}

/**
 * Represents the outcome of an operation that can either succeed (`Ok<T>`) or fail (`Err<E>`).
 *
 * `Result<T, E>` makes error handling explicit and type-safe without relying on thrown exceptions,
 * supporting Functor (`map`), Bifunctor (`mapErr`, `bimap`), Monad (`flatMap`), and Foldable (`match`)
 * operations while maintaining full backwards compatibility with `@luism/result-ts`.
 *
 * @template T The type of the value contained in an `Ok` result.
 * @template E The type of the error contained in an `Err` result.
 * @example
 * ```ts
 * const parsePort = (input: string): Result<number, string> => {
 *   const parsed = Number.parseInt(input, 10);
 *   return Number.isNaN(parsed)
 *     ? Result.err(`Invalid port: ${input}`)
 *     : Result.ok(parsed);
 * };
 *
 * const port = parsePort("8080")
 *   .map((p) => p + 1)
 *   .unwrapOrDefault(3000); // 8081
 * ```
 */
export class Result<T, E = Error>
  implements
    Tagged<"ok" | "error">,
    Bimappable<T, E>,
    Chainable<T>,
    Matchable<ResultMatcher<T, E, unknown>>,
    Unwrappable<T, E>
{
  /**
   * Discriminator tag: `"ok"` when successful, or `"error"` when failed.
   */
  public readonly _tag: "ok" | "error";

  private readonly value?: T;
  private readonly error?: E;

  /**
   * Constructs a new `Result` instance from a discriminated union payload.
   * Prefer using static factories {@link Result.ok}, {@link Result.err}, or {@link Result.tryCatch}.
   *
   * @param opts Discriminated union object containing `{ _tag: "ok", value }` or `{ _tag: "error", error }`.
   */
  public constructor(opts: TResult<T, E>) {
    this._tag = opts._tag;
    if (opts._tag === "ok") {
      this.value = opts.value;
    } else {
      this.error = opts.error;
    }
  }

  /**
   * Creates a successful `Result` (`Ok`) containing `value`.
   *
   * @template T The type of the success value.
   * @template E The nominal error type parameter (defaults to `never`).
   * @param value The success value to wrap.
   * @returns A new `Result<T, E>` in the `"ok"` state.
   * @example
   * ```ts
   * const okResult = Result.ok(42);
   * ```
   */
  public static ok<T, E = never>(value: T): Result<T, E> {
    return new Result<T, E>({ _tag: "ok", value });
  }

  /**
   * Alias for {@link Result.ok}, satisfying the pointed functor / monad `of` convention.
   *
   * @template T The type of the success value.
   * @template E The nominal error type parameter (defaults to `never`).
   * @param value The success value to wrap.
   * @returns A new `Result<T, E>` in the `"ok"` state.
   */
  public static of<T, E = never>(value: T): Result<T, E> {
    return new Result<T, E>({ _tag: "ok", value });
  }

  /**
   * Creates a failed `Result` (`Err`) containing `error`.
   *
   * @template E The type of the error value.
   * @template T The nominal success type parameter (defaults to `never`).
   * @param error The error value to wrap.
   * @returns A new `Result<T, E>` in the `"error"` state.
   * @example
   * ```ts
   * const errorResult = Result.err("Something went wrong");
   * ```
   */
  public static err<E, T = never>(error: E): Result<T, E> {
    return new Result<T, E>({ _tag: "error", error });
  }

  /**
   * Converts an {@link Option} into a `Result`, mapping `Some(v)` to `Ok(v)`
   * and `None` to `Err(error)`.
   *
   * @template T The option value type.
   * @template E The error type produced when the option is `None`.
   * @param option The `Option<T>` to convert.
   * @param error Error value or lazy error factory used when `option` is `None`.
   * @returns `Ok(value)` if `option.isSome()`, otherwise `Err(error)`.
   */
  public static fromOption<T, E>(option: Option<T>, error: E | (() => E)): Result<T, E> {
    return option.match({
      some: (val) => Result.ok<T, E>(val),
      none: () => Result.err<E, T>(typeof error === "function" ? (error as () => E)() : error),
    });
  }

  /**
   * Constructs a `Result` from a nullable value, returning `Ok(value)` if non-nullish
   * or `Err(error)` if `null` or `undefined`.
   *
   * @template T The input value type.
   * @template E The error type when `value` is nullish.
   * @param value The potentially `null` or `undefined` value.
   * @param error Error value or lazy factory used when `value == null`.
   * @returns `Ok<NonNullable<T>>` or `Err<E>`.
   */
  public static fromNullable<T, E>(
    value: T | null | undefined,
    error: E | (() => E),
  ): Result<NonNullable<T>, E> {
    return value !== null && value !== undefined
      ? Result.ok(value)
      : Result.err(typeof error === "function" ? (error as () => E)() : error);
  }

  /**
   * Executes a synchronous function `fn` and wraps its return value in `Ok`,
   * catching any thrown exception and wrapping it in `Err`.
   *
   * @template T The return type of `fn`.
   * @template E The mapped error type (defaults to `Error`).
   * @param fn A potentially throwing synchronous function.
   * @param onError Optional mapper converting the caught `unknown` reason into `E`.
   * @returns `Ok(fn())` on success, or `Err(onError(caught))` if `fn` throws.
   * @example
   * ```ts
   * const parsed = Result.tryCatch(
   *   () => JSON.parse(raw),
   *   (e) => new Error(`Invalid JSON: ${String(e)}`),
   * );
   * ```
   */
  public static tryCatch<T, E = Error>(fn: () => T, onError?: (error: unknown) => E): Result<T, E> {
    try {
      return Result.ok(fn());
    } catch (err) {
      const mapped = onError
        ? onError(err)
        : ((err instanceof Error ? err : new Error(String(err))) as unknown as E);
      return Result.err(mapped);
    }
  }

  /**
   * Converts a `Promise<T>` into a `Promise<Result<T, E>>` that never rejects.
   *
   * @template T The resolved value type of `promise`.
   * @template E The mapped error type on rejection (defaults to `Error`).
   * @param promise The promise to wrap.
   * @param onError Optional mapper converting a rejection reason into `E`.
   * @returns A promise resolving to `Ok(value)` or `Err(error)`.
   */
  public static async fromPromise<T, E = Error>(
    promise: PromiseLike<T>,
    onError?: (error: unknown) => E,
  ): Promise<Result<T, E>> {
    try {
      const value = await promise;
      return Result.ok(value);
    } catch (err) {
      const mapped = onError
        ? onError(err)
        : ((err instanceof Error ? err : new Error(String(err))) as unknown as E);
      return Result.err(mapped);
    }
  }

  /**
   * Combines an iterable of `Result<T, E>` instances into a single `Result<T[], E>`.
   * Short-circuits on the first `Err` encountered.
   *
   * @template T The success element type.
   * @template E The error type.
   * @param results Iterable of `Result<T, E>` items.
   * @returns `Ok(values)` if every item is `Ok`, or the first `Err` encountered.
   */
  public static all<T, E>(results: Iterable<Result<T, E>>): Result<T[], E> {
    const values: T[] = [];
    for (const res of results) {
      if (res._tag === "error") {
        return Result.err(res.error as E);
      }
      values.push(res.value as T);
    }
    return Result.ok(values);
  }

  /**
   * Partitions an iterable of `Result<T, E>` instances into a tuple of `[okValues, errors]`.
   *
   * @template T The success element type.
   * @template E The error element type.
   * @param results Iterable of `Result<T, E>` items.
   * @returns A tuple `[T[], E[]]` containing all `Ok` values and all `Err` values.
   */
  public static partition<T, E>(results: Iterable<Result<T, E>>): [T[], E[]] {
    const oks: T[] = [];
    const errs: E[] = [];
    for (const res of results) {
      if (res._tag === "ok") {
        oks.push(res.value as T);
      } else {
        errs.push(res.error as E);
      }
    }
    return [oks, errs];
  }

  /**
   * Checks if the `Result` is an `Ok` variant.
   *
   * @example
   * ```ts
   * const result = Result.ok(123);
   * console.log(result.isOk()); // true
   * ```
   * @returns `true` if `_tag === "ok"`, narrowing the type accordingly.
   */
  public isOk(): this is Result<T, E> & { readonly _tag: "ok" } {
    return this._tag === "ok";
  }

  /**
   * Checks if the `Result` is an `Err` variant.
   *
   * @example
   * ```ts
   * const result = Result.err("Error");
   * console.log(result.isErr()); // true
   * ```
   * @returns `true` if `_tag === "error"`, narrowing the type accordingly.
   */
  public isErr(): this is Result<T, E> & { readonly _tag: "error" } {
    return this._tag === "error";
  }

  /**
   * Transforms the success value using `fn` if `Ok`, or propagates the existing `Err`.
   *
   * @template U The transformed success value type.
   * @param fn Function applied to the `Ok` value.
   * @returns `Ok(fn(value))` if `Ok`, otherwise `Err(error)`.
   */
  public map<U>(fn: (value: T) => U): Result<U, E> {
    return this._tag === "ok" ? Result.ok(fn(this.value as T)) : Result.err(this.error as E);
  }

  /**
   * Transforms the error value using `fn` if `Err`, or propagates the existing `Ok`.
   *
   * @template F The transformed error type.
   * @param fn Function applied to the `Err` value.
   * @returns `Err(fn(error))` if `Err`, otherwise `Ok(value)`.
   */
  public mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return this._tag === "error" ? Result.err(fn(this.error as E)) : Result.ok(this.value as T);
  }

  /**
   * Maps both channels simultaneously: applies `onOk` if `Ok`, or `onErr` if `Err`.
   *
   * @template U The mapped success type.
   * @template F The mapped error type.
   * @param onOk Function applied to the success value.
   * @param onErr Function applied to the error value.
   * @returns A new `Result<U, F>`.
   */
  public bimap<U, F>(onOk: (value: T) => U, onErr: (error: E) => F): Result<U, F> {
    return this._tag === "ok"
      ? Result.ok(onOk(this.value as T))
      : Result.err(onErr(this.error as E));
  }

  /**
   * Chains a computation that returns a `Result`, flattening the nested result.
   *
   * @template U The next success value type.
   * @template F The error type of the chained `Result`.
   * @param fn Function mapping the `Ok` value to a new `Result<U, F>`.
   * @returns The chained `Result<U, E | F>`.
   */
  public flatMap<U, F = E>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return this._tag === "ok" ? fn(this.value as T) : Result.err<E | F, U>(this.error as E);
  }

  /**
   * Alias for {@link Result.flatMap}.
   *
   * @template U The next success value type.
   * @template F The error type of the chained `Result`.
   * @param fn Function mapping the `Ok` value to a new `Result<U, F>`.
   * @returns The chained `Result<U, E | F>`.
   */
  public andThen<U, F = E>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return this.flatMap(fn);
  }

  /**
   * Recovers from an `Err` state by invoking `fn` to produce a replacement `Result`.
   *
   * @template F The error type of the recovery `Result`.
   * @param fn Recovery handler receiving the current error `E`.
   * @returns `this` (typed with error `F`) if `Ok`, otherwise `fn(error)`.
   */
  public orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F> {
    return this._tag === "error" ? fn(this.error as E) : Result.ok<T, F>(this.value as T);
  }

  /**
   * Executes a side-effecting function `fn` on the success value if `Ok` and returns `this`.
   *
   * @param fn Callback receiving the success value.
   * @returns `this`.
   */
  public tap(fn: (value: T) => void): this {
    if (this._tag === "ok") {
      fn(this.value as T);
    }
    return this;
  }

  /**
   * Executes a side-effecting function `fn` on the error value if `Err` and returns `this`.
   *
   * @param fn Callback receiving the error value.
   * @returns `this`.
   */
  public tapErr(fn: (error: E) => void): this {
    if (this._tag === "error") {
      fn(this.error as E);
    }
    return this;
  }

  /**
   * Exhaustively matches this `Result` against `ok` and `err` branch handlers.
   *
   * @template R The return type of the match branches.
   * @param patterns Object containing `ok` and `err` callbacks.
   * @returns The result of executing the matching branch.
   * @example
   * ```ts
   * const message = result.match({
   *   ok: (val) => `Success: ${val}`,
   *   err: (err) => `Failed: ${err}`,
   * });
   * ```
   */
  public match<R>(patterns: ResultMatcher<T, E, R>): R {
    return this._tag === "ok" ? patterns.ok(this.value as T) : patterns.err(this.error as E);
  }

  /**
   * Alias for {@link Result.match}.
   *
   * @template R The return type of the match branches.
   * @param patterns Object containing `ok` and `err` callbacks.
   * @returns The result of executing the matching branch.
   */
  public fold<R>(patterns: ResultMatcher<T, E, R>): R {
    return this.match(patterns);
  }

  /**
   * Unwraps the value from an `Ok` result or throws an {@link UnwrapError} if it is `Err`.
   *
   * @example
   * ```ts
   * const okResult = Result.ok("Success");
   * console.log(okResult.unwrap()); // "Success"
   *
   * const errorResult = Result.err("Failed");
   * try {
   *   errorResult.unwrap();
   * } catch (error) {
   *   console.error(error); // UnwrapError: Failed
   * }
   * ```
   * @returns The value `T` contained in the `Ok` result.
   * @throws {UnwrapError<E>} If the `Result` is an `Err`.
   */
  public unwrap(): T {
    if (this._tag === "ok") {
      return this.value as T;
    }
    throw new UnwrapError<E>(this.error as E);
  }

  /**
   * Unwraps the error from an `Err` result or throws an {@link UnwrapError} if it is `Ok`.
   *
   * @returns The error `E` contained in the `Err` result.
   * @throws {UnwrapError<T>} If the `Result` is `Ok`.
   */
  public unwrapErr(): E {
    if (this._tag === "error") {
      return this.error as E;
    }
    throw new UnwrapError<T>(this.value as T, "Attempted to unwrapErr on an Ok Result");
  }

  /**
   * Unwraps the value from an `Ok` result or throws an {@link UnwrapError} with a custom `message`.
   *
   * @param message Custom error message explaining why `Ok` was expected.
   * @returns The value `T` contained in the `Ok` result.
   * @throws {UnwrapError<E>} If the `Result` is `Err`.
   */
  public expect(message: string): T {
    if (this._tag === "ok") {
      return this.value as T;
    }
    throw new UnwrapError<E>(this.error as E, message);
  }

  /**
   * Returns the contained `Ok` value or `fallback` if `Err`.
   *
   * @template F The type of the fallback value.
   * @param fallback Fallback value returned when `Err`.
   * @returns Either the `Ok` value `T` or `fallback`.
   */
  public unwrapOr<F>(fallback: F): T | F {
    return this._tag === "ok" ? (this.value as T) : fallback;
  }

  /**
   * Unwraps the value from `Ok` or returns `fallback` if `Err`.
   * Preserved for 100% backwards compatibility with `@luism/result-ts`.
   *
   * @template F The type of the fallback value.
   * @param fallback The fallback value to return if the `Result` is an `Err`.
   * @example
   * ```ts
   * const okResult = Result.ok(10);
   * console.log(okResult.unwrapOrDefault(0)); // 10
   *
   * const errorResult = Result.err("No value");
   * console.log(errorResult.unwrapOrDefault(0)); // 0
   * ```
   * @returns The value contained in `Ok`, or `fallback` if `Err`.
   */
  public unwrapOrDefault<F>(fallback: F): T | F {
    return this.unwrapOr(fallback);
  }

  /**
   * Returns the contained `Ok` value or computes a fallback from the error using `fn`.
   *
   * @template F The fallback return type.
   * @param fn Function computing a fallback value from the `Err` payload.
   * @returns Either the `Ok` value `T` or `fn(error)`.
   */
  public unwrapOrElse<F>(fn: (error: E) => F): T | F {
    return this._tag === "ok" ? (this.value as T) : fn(this.error as E);
  }

  /**
   * Converts this `Result<T, E>` into an `Option<T>`, mapping `Ok(v)` to `Some(v)` and `Err` to `None`.
   *
   * @returns `Some(value)` if `Ok`, otherwise `None`.
   */
  public toOption(): Option<T> {
    return this._tag === "ok" ? Option.some(this.value as T) : Option.none();
  }

  /**
   * Converts the error channel of this `Result<T, E>` into an `Option<E>`,
   * mapping `Err(e)` to `Some(e)` and `Ok` to `None`.
   *
   * @returns `Some(error)` if `Err`, otherwise `None`.
   */
  public toErrOption(): Option<E> {
    return this._tag === "error" ? Option.some(this.error as E) : Option.none();
  }
}

export { UnwrapError };
export default Result;
