/**
 * Base contract for all discriminated union variants.
 *
 * Every Algebraic Data Type variant in `@luism/adt-ts` exposes a readonly `_tag`
 * property for structural pattern matching and TypeScript type narrowing.
 *
 * @template Tag The string literal tag identifying the variant.
 */
export interface Tagged<Tag extends string = string> {
  /**
   * Discriminator tag identifying the runtime variant.
   */
  readonly _tag: Tag;
}

/**
 * Functor abstraction for types whose inner value can be transformed via {@link Mappable.map | map}.
 *
 * Implementations must satisfy the Functor laws:
 * 1. **Identity**: `fa.map(x => x)` is equivalent to `fa`.
 * 2. **Composition**: `fa.map(f).map(g)` is equivalent to `fa.map(x => g(f(x)))`.
 *
 * @template T The wrapped value type.
 */
export interface Mappable<T> {
  /**
   * Transforms the wrapped value using `fn` while preserving the container structure.
   *
   * @template U The transformed value type.
   * @param fn A pure transformation function applied to the inner value.
   * @returns A new container holding the transformed value.
   */
  map<U>(fn: (value: T) => U): Mappable<U>;

  /**
   * Executes a side-effecting function on the inner value (if present) and returns `this`.
   *
   * @param fn A side-effect function that receives the current value.
   * @returns The current container instance unchanged.
   */
  tap(fn: (value: T) => void): Mappable<T>;
}

/**
 * Bifunctor abstraction for types with both a success channel (`T`) and an error channel (`E`).
 *
 * @template T The success value type.
 * @template E The error value type.
 */
export interface Bimappable<T, E> extends Mappable<T> {
  /**
   * Transforms the error channel using `fn` while leaving the success channel untouched.
   *
   * @template F The transformed error type.
   * @param fn A function transforming the error value.
   * @returns A new container with the transformed error channel.
   */
  mapErr<F>(fn: (error: E) => F): Bimappable<T, F>;

  /**
   * Simultaneously transforms either the success channel (`onOk`) or the error channel (`onErr`).
   *
   * @template U The transformed success type.
   * @template F The transformed error type.
   * @param onOk Function applied when in the success state.
   * @param onErr Function applied when in the error state.
   * @returns A new container with both channels mapped.
   */
  bimap<U, F>(onOk: (value: T) => U, onErr: (error: E) => F): Bimappable<U, F>;
}

/**
 * Monad abstraction for sequencing operations that return a wrapped container.
 *
 * Implementations must satisfy the Monad laws:
 * 1. **Left Identity**: `M.of(a).flatMap(f)` is equivalent to `f(a)`.
 * 2. **Right Identity**: `m.flatMap(M.of)` is equivalent to `m`.
 * 3. **Associativity**: `m.flatMap(f).flatMap(g)` is equivalent to `m.flatMap(x => f(x).flatMap(g))`.
 *
 * @template T The wrapped value type.
 */
export interface Chainable<T> extends Mappable<T> {
  /**
   * Chains a computation that returns another container, flattening the nested result.
   *
   * @template U The inner value type of the returned container.
   * @param fn A function returning the next container in the chain.
   * @returns The flattened container resulting from `fn`.
   */
  flatMap<U>(fn: (value: T) => Chainable<U>): Chainable<U>;

  /**
   * Alias for {@link Chainable.flatMap | flatMap}.
   *
   * @template U The inner value type of the returned container.
   * @param fn A function returning the next container in the chain.
   * @returns The flattened container resulting from `fn`.
   */
  andThen<U>(fn: (value: T) => Chainable<U>): Chainable<U>;
}

/**
 * Foldable / pattern-matching abstraction for exhaustively deconstructing an ADT.
 *
 * @template Patterns The record of branch handlers.
 */
export interface Matchable<Patterns> {
  /**
   * Exhaustively matches all variants of the ADT and returns the computed result.
   *
   * @param patterns Object containing a handler function for each variant.
   * @returns The result produced by the matching branch handler.
   */
  match(patterns: Patterns): unknown;

  /**
   * Alias for {@link Matchable.match | match}.
   *
   * @param patterns Object containing a handler function for each variant.
   * @returns The result produced by the matching branch handler.
   */
  fold(patterns: Patterns): unknown;
}

/**
 * Extraction contract for safely or unsafely unwrapping a container's value.
 *
 * @template T The wrapped value type.
 */
export interface Unwrappable<T, E = void> {
  /**
   * Extracts the contained value or throws an `UnwrapError` if the container is empty or in an error state.
   *
   * @returns The unwrapped value `T`.
   */
  unwrap(): T;

  /**
   * Extracts the contained value or throws an `UnwrapError` with a custom diagnostic `message`.
   *
   * @param message Custom error message explaining why unwrapping was expected to succeed.
   * @returns The unwrapped value `T`.
   */
  expect(message: string): T;

  /**
   * Extracts the contained value or returns `fallback` when empty or in an error state.
   *
   * @template F The fallback value type.
   * @param fallback Fallback value returned when unwrapping fails.
   * @returns Either the contained value `T` or `fallback`.
   */
  unwrapOr<F>(fallback: F): T | F;

  /**
   * Alias for {@link Unwrappable.unwrapOr | unwrapOr}, preserved for backwards compatibility with `@luism/result-ts`.
   *
   * @template F The fallback value type.
   * @param fallback Fallback value returned when unwrapping fails.
   * @returns Either the contained value `T` or `fallback`.
   */
  unwrapOrDefault<F>(fallback: F): T | F;

  /**
   * Extracts the contained value or lazily computes a fallback using `fn`.
   *
   * @template F The fallback return type.
   * @param fn Lazy fallback factory invoked only when the value is absent.
   * @returns Either the contained value `T` or the result of `fn`.
   */
  unwrapOrElse<F>(fn: (error: E) => F): T | F;
}
