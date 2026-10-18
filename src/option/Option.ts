import type { Chainable, Matchable, Tagged, Unwrappable } from "../core/abstractions";
import { UnwrapError } from "../core/errors";

/**
 * Represents the present variant of an {@link Option}.
 *
 * @template T The wrapped value type.
 */
export type Some<T> = {
  readonly _tag: "some";
  readonly value: T;
};

/**
 * Represents the absent variant of an {@link Option}.
 */
export type None = {
  readonly _tag: "none";
};

/**
 * Pattern matcher branches for deconstructing an {@link Option}.
 *
 * @template T The wrapped value type.
 * @template R The return type of the match expression.
 */
export interface OptionMatcher<T, R> {
  /**
   * Handler invoked when the option is `Some`.
   */
  readonly some: (value: T) => R;

  /**
   * Handler invoked when the option is `None`.
   */
  readonly none: () => R;
}

/**
 * Represents an optional value: every `Option<T>` is either `Some` (containing a value `T`)
 * or `None` (representing the absence of a value).
 *
 * `Option` eliminates null/undefined reference errors by encoding optionality in the type system
 * and providing composable Functor (`map`), Monad (`flatMap`), and Foldable (`match`) operations.
 *
 * @template T The type of the wrapped value.
 * @example
 * ```ts
 * const port = Option.fromNullable(process.env.PORT)
 *   .map((raw) => Number.parseInt(raw, 10))
 *   .filter((n) => !Number.isNaN(n))
 *   .unwrapOr(3000);
 * ```
 */
export class Option<T>
  implements
    Tagged<"some" | "none">,
    Chainable<T>,
    Matchable<OptionMatcher<T, unknown>>,
    Unwrappable<T>
{
  /**
   * Discriminator tag: `"some"` when a value is present, or `"none"` when absent.
   */
  public readonly _tag: "some" | "none";

  private readonly value?: T;

  /**
   * Internal constructor for `Option`. Use {@link Option.some}, {@link Option.none},
   * or {@link Option.fromNullable} instead.
   *
   * @param tag Variant discriminator (`"some"` or `"none"`).
   * @param value Optional inner value when `tag === "some"`.
   */
  private constructor(tag: "some" | "none", value?: T) {
    this._tag = tag;
    this.value = value;
  }

  /**
   * Creates an `Option<T>` containing the given `value` (`Some`).
   *
   * @template T The value type.
   * @param value The value to wrap.
   * @returns A `Some` instance wrapping `value`.
   * @example
   * ```ts
   * const opt = Option.some(42);
   * console.log(opt.isSome()); // true
   * ```
   */
  public static some<T>(value: T): Option<T> {
    return new Option("some", value);
  }

  /**
   * Returns the singleton empty `Option` (`None`).
   *
   * Because `None` is immutable and carries no state, a shared frozen singleton is returned
   * to avoid runtime allocations.
   *
   * @template T The nominal value type parameter.
   * @returns The `None` instance.
   * @example
   * ```ts
   * const empty = Option.none<number>();
   * console.log(empty.isNone()); // true
   * ```
   */
  public static none<T = never>(): Option<T> {
    return NONE_INSTANCE as Option<T>;
  }

  /**
   * Alias for {@link Option.some}, satisfying the standard pointed functor / monad `of` convention.
   *
   * @template T The value type.
   * @param value The value to lift into `Option`.
   * @returns A `Some` instance wrapping `value`.
   */
  public static of<T>(value: T): Option<T> {
    return new Option("some", value);
  }

  /**
   * Constructs an `Option` from a potentially `null` or `undefined` value.
   * Returns `None` if `value == null`, otherwise `Some(value)`.
   *
   * @template T The input type (possibly nullable).
   * @param value The nullable value to inspect.
   * @returns `Some<NonNullable<T>>` if non-nullish, otherwise `None`.
   * @example
   * ```ts
   * Option.fromNullable("hello"); // Some("hello")
   * Option.fromNullable(null);    // None
   * ```
   */
  public static fromNullable<T>(value: T | null | undefined): Option<NonNullable<T>> {
    return value === null || value === undefined ? Option.none() : new Option("some", value);
  }

  /**
   * Constructs an `Option` by testing `value` against `predicate`.
   * Returns `Some(value)` if `predicate(value)` is `true`, otherwise `None`.
   *
   * @template T The value type.
   * @param value Candidate value to test.
   * @param predicate Boolean or type-guard predicate function.
   * @returns `Some(value)` when `predicate` holds, otherwise `None`.
   */
  public static fromPredicate<T, S extends T>(
    value: T,
    predicate: (value: T) => value is S,
  ): Option<S>;
  public static fromPredicate<T>(value: T, predicate: (value: T) => boolean): Option<T>;
  public static fromPredicate<T>(value: T, predicate: (value: T) => boolean): Option<T> {
    return predicate(value) ? new Option("some", value) : Option.none();
  }

  /**
   * Executes a synchronous function `fn` and wraps its return value in `Some`,
   * or returns `None` if `fn` throws an exception.
   *
   * @template T The return type of `fn`.
   * @param fn A potentially throwing synchronous function.
   * @returns `Some(result)` on success, or `None` if an error was thrown.
   * @example
   * ```ts
   * const parsed = Option.tryCatch(() => JSON.parse(rawJson));
   * ```
   */
  public static tryCatch<T>(fn: () => T): Option<T> {
    try {
      return new Option("some", fn());
    } catch {
      return Option.none();
    }
  }

  /**
   * Combines an iterable of `Option<T>` values into a single `Option<T[]>`.
   * Short-circuits and returns `None` if any element is `None`.
   *
   * @template T The element value type.
   * @param options Iterable collection of `Option<T>` instances.
   * @returns `Some(values)` if all options are `Some`, otherwise `None`.
   * @example
   * ```ts
   * Option.all([Option.some(1), Option.some(2)]); // Some([1, 2])
   * Option.all([Option.some(1), Option.none()]);  // None
   * ```
   */
  public static all<T>(options: Iterable<Option<T>>): Option<T[]> {
    const acc: T[] = [];
    for (const opt of options) {
      if (opt._tag === "none") {
        return Option.none();
      }
      acc.push(opt.value as T);
    }
    return new Option("some", acc);
  }

  /**
   * Returns the first `Some` in an iterable of `Option<T>` values, or `None` if all are `None`.
   *
   * @template T The element value type.
   * @param options Iterable collection of `Option<T>` instances.
   * @returns The first `Some` encountered, or `None`.
   */
  public static any<T>(options: Iterable<Option<T>>): Option<T> {
    for (const opt of options) {
      if (opt._tag === "some") {
        return opt;
      }
    }
    return Option.none();
  }

  /**
   * Checks whether this `Option` contains a value (`Some`).
   *
   * @returns `true` if `_tag === "some"`, narrowing the type accordingly.
   */
  public isSome(): this is Option<T> & { readonly _tag: "some" } {
    return this._tag === "some";
  }

  /**
   * Checks whether this `Option` is empty (`None`).
   *
   * @returns `true` if `_tag === "none"`, narrowing the type accordingly.
   */
  public isNone(): this is Option<T> & { readonly _tag: "none" } {
    return this._tag === "none";
  }

  /**
   * Transforms the inner value using `fn` if `Some`, or propagates `None`.
   *
   * @template U The transformed value type.
   * @param fn Transformation function applied to the present value.
   * @returns `Some(fn(value))` if `Some`, otherwise `None`.
   */
  public map<U>(fn: (value: T) => U): Option<U> {
    return this._tag === "some" ? new Option("some", fn(this.value as T)) : Option.none();
  }

  /**
   * Chains a computation that returns an `Option`, flattening the result.
   *
   * @template U The inner type of the returned `Option`.
   * @param fn Function mapping the present value to a new `Option<U>`.
   * @returns The resulting `Option<U>` if `Some`, otherwise `None`.
   */
  public flatMap<U>(fn: (value: T) => Option<U>): Option<U> {
    return this._tag === "some" ? fn(this.value as T) : Option.none();
  }

  /**
   * Alias for {@link Option.flatMap}.
   *
   * @template U The inner type of the returned `Option`.
   * @param fn Function mapping the present value to a new `Option<U>`.
   * @returns The resulting `Option<U>` if `Some`, otherwise `None`.
   */
  public andThen<U>(fn: (value: T) => Option<U>): Option<U> {
    return this.flatMap(fn);
  }

  /**
   * Retains the inner value only if it satisfies `predicate`; otherwise returns `None`.
   *
   * @param predicate Function used to test the inner value.
   * @returns `this` if `Some` and `predicate(value)` is `true`, otherwise `None`.
   */
  public filter<S extends T>(predicate: (value: T) => value is S): Option<S>;
  public filter(predicate: (value: T) => boolean): Option<T>;
  public filter(predicate: (value: T) => boolean): Option<T> {
    return this._tag === "some" && predicate(this.value as T) ? this : Option.none();
  }

  /**
   * Returns `this` if `Some`, otherwise returns `alternative`.
   *
   * @param alternative Backup `Option<T>` to use when `this` is `None`.
   * @returns `this` if `Some`, otherwise `alternative`.
   */
  public or(alternative: Option<T>): Option<T> {
    return this._tag === "some" ? this : alternative;
  }

  /**
   * Returns `this` if `Some`, otherwise lazily evaluates `fn` to produce a fallback `Option<T>`.
   *
   * @param fn Lazy factory returning a fallback `Option<T>`.
   * @returns `this` if `Some`, otherwise `fn()`.
   */
  public orElse(fn: () => Option<T>): Option<T> {
    return this._tag === "some" ? this : fn();
  }

  /**
   * Combines `this` and `other` into an `Option<[T, U]>` if both are `Some`, or `None` otherwise.
   *
   * @template U The value type of `other`.
   * @param other Another `Option<U>` to pair with.
   * @returns `Some([thisValue, otherValue])` if both are `Some`, otherwise `None`.
   */
  public zip<U>(other: Option<U>): Option<[T, U]> {
    return this._tag === "some" && other._tag === "some"
      ? new Option("some", [this.value as T, other.value as U])
      : Option.none();
  }

  /**
   * Executes a side-effecting callback `fn` when `Some` and returns `this` unchanged.
   *
   * @param fn Callback receiving the inner value when present.
   * @returns `this`.
   */
  public tap(fn: (value: T) => void): this {
    if (this._tag === "some") {
      fn(this.value as T);
    }
    return this;
  }

  /**
   * Exhaustively matches this `Option` against `some` and `none` branch handlers.
   *
   * @template R The return type of the match branches.
   * @param patterns Object containing `some` and `none` callbacks.
   * @returns The result of executing the matching branch.
   * @example
   * ```ts
   * const greeting = maybeName.match({
   *   some: (name) => `Hello, ${name}!`,
   *   none: () => "Hello, stranger!",
   * });
   * ```
   */
  public match<R>(patterns: OptionMatcher<T, R>): R {
    return this._tag === "some" ? patterns.some(this.value as T) : patterns.none();
  }

  /**
   * Alias for {@link Option.match}.
   *
   * @template R The return type of the match branches.
   * @param patterns Object containing `some` and `none` callbacks.
   * @returns The result of executing the matching branch.
   */
  public fold<R>(patterns: OptionMatcher<T, R>): R {
    return this.match(patterns);
  }

  /**
   * Unwraps the contained value if `Some`, or throws an {@link UnwrapError} if `None`.
   *
   * @returns The inner value `T`.
   * @throws {UnwrapError<undefined>} When called on `None`.
   */
  public unwrap(): T {
    if (this._tag === "some") {
      return this.value as T;
    }
    throw new UnwrapError(undefined, "Attempted to unwrap Option.none()");
  }

  /**
   * Unwraps the contained value if `Some`, or throws an {@link UnwrapError} with a custom `message` if `None`.
   *
   * @param message Custom diagnostic message for the thrown error.
   * @returns The inner value `T`.
   * @throws {UnwrapError<undefined>} When called on `None`.
   */
  public expect(message: string): T {
    if (this._tag === "some") {
      return this.value as T;
    }
    throw new UnwrapError(undefined, message);
  }

  /**
   * Returns the inner value if `Some`, or `fallback` if `None`.
   *
   * @template F The fallback value type.
   * @param fallback Default value returned when `None`.
   * @returns Either the inner value `T` or `fallback`.
   */
  public unwrapOr<F>(fallback: F): T | F {
    return this._tag === "some" ? (this.value as T) : fallback;
  }

  /**
   * Alias for {@link Option.unwrapOr}, provided for API symmetry with `Result.unwrapOrDefault`.
   *
   * @template F The fallback value type.
   * @param fallback Default value returned when `None`.
   * @returns Either the inner value `T` or `fallback`.
   */
  public unwrapOrDefault<F>(fallback: F): T | F {
    return this.unwrapOr(fallback);
  }

  /**
   * Returns the inner value if `Some`, or computes a default by calling `fn` if `None`.
   *
   * @template F The fallback return type.
   * @param fn Lazy fallback generator.
   * @returns Either the inner value `T` or `fn()`.
   */
  public unwrapOrElse<F>(fn: () => F): T | F {
    return this._tag === "some" ? (this.value as T) : fn();
  }

  /**
   * Converts this `Option<T>` to `T | null`.
   *
   * @returns The inner value `T` when `Some`, or `null` when `None`.
   */
  public toNullable(): T | null {
    return this._tag === "some" ? (this.value as T) : null;
  }

  /**
   * Converts this `Option<T>` to `T | undefined`.
   *
   * @returns The inner value `T` when `Some`, or `undefined` when `None`.
   */
  public toUndefined(): T | undefined {
    return this._tag === "some" ? (this.value as T) : undefined;
  }
}

const NONE_INSTANCE: Option<never> = /* @__PURE__ */ Object.freeze(
  new (Option as unknown as new (tag: "none") => Option<never>)("none"),
);

export default Option;
