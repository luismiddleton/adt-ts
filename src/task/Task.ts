import type { Bimappable, Chainable, Tagged } from "../core/abstractions";
import { Option } from "../option/Option";
import { Result, type ResultMatcher } from "../result/Result";

/**
 * Execution lifecycle states of a {@link Task}.
 *
 * Defined as a frozen `as const` object rather than a TypeScript `enum` so bundlers
 * can inline and tree-shake unused properties with zero IIFE overhead.
 */
export const TaskStatus = /* @__PURE__ */ Object.freeze({
  /**
   * The task has been constructed lazily and has not yet been started via `.run()`.
   */
  IDLE: "idle",
  /**
   * The task is currently executing asynchronously.
   */
  PENDING: "pending",
  /**
   * The task has completed with an `Ok` result.
   */
  SUCCEEDED: "succeeded",
  /**
   * The task has completed with an `Err` failure.
   */
  FAILED: "failed",
} as const);

/**
 * Union of all valid {@link Task} lifecycle status strings.
 */
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/**
 * Executor callback signature compatible with `@luism/task-ts` and standard `Promise` executors.
 *
 * @template T The resolved value type.
 * @template E The rejection reason type.
 */
export type TaskExecutor<T, E = Error> = (
  resolve: (value: T | PromiseLike<T>) => void,
  reject: (reason?: E) => void,
) => void | Promise<void>;

/**
 * Represents a deferred, composable asynchronous computation that resolves to a {@link Result | Result<T, E>}
 * without throwing unhandled rejections, while providing synchronous inspection of its lifecycle status.
 *
 * `Task<T, E>` unifies `@luism/task-ts` and `@luism/result-ts`:
 * - **Lazy execution**: Work only begins when {@link Task.run | run}, {@link Task.runOrThrow | runOrThrow},
 *   or {@link Task.match | match} is invoked.
 * - **Never rejects on `run()`**: Always resolves to `Result<T, E>`.
 * - **Stateful status tracking**: Synchronously inspect `idle`, `pending`, `succeeded`, or `failed`
 *   states for UI rendering or telemetry.
 * - **Full Functor / Bifunctor / Monad combinators**: Chain async workflows via `map`, `mapErr`, `flatMap`, and `orElse`.
 *
 * @template T The success value type.
 * @template E The error value type (defaults to `Error`).
 * @example
 * ```ts
 * const fetchUser = (id: string) =>
 *   Task.tryCatch(
 *     () => fetch(`/api/users/${id}`).then((r) => r.json()),
 *     (err) => new Error(`Failed to load user ${id}: ${String(err)}`),
 *   );
 *
 * const result = await fetchUser("42")
 *   .map((user) => user.name.toUpperCase())
 *   .run();
 * ```
 */
export class Task<T, E = Error> implements Tagged<"task">, Bimappable<T, E>, Chainable<T> {
  /**
   * Discriminator tag identifying a `Task` instance.
   */
  public readonly _tag = "task" as const;

  private readonly thunk: () => Promise<Result<T, E>>;
  private state: TaskStatus = TaskStatus.IDLE;
  private result?: T;
  private error?: E;

  /**
   * Creates a new lazy `Task` from an executor function `(resolve, reject) => void`
   * or an internal `Result`-returning thunk.
   *
   * Unlike a native `Promise`, the `executor` is deferred until {@link Task.run | run} is called.
   *
   * @param executor Executor function receiving `resolve` and `reject` callbacks.
   */
  public constructor(
    executor: TaskExecutor<T, E>,
    initialState?: {
      status: TaskStatus;
      result?: T;
      error?: E;
      thunk?: () => Promise<Result<T, E>>;
    },
  ) {
    if (initialState?.thunk) {
      this.thunk = initialState.thunk;
      this.state = initialState.status;
      this.result = initialState.result;
      this.error = initialState.error;
      return;
    }

    this.thunk = () =>
      new Promise<Result<T, E>>((resolvePromise) => {
        try {
          const maybePromise = executor(
            (value) => {
              Promise.resolve(value).then(
                (resolved) => resolvePromise(Result.ok(resolved)),
                (err) => resolvePromise(Result.err(err as E)),
              );
            },
            (reason) => {
              resolvePromise(Result.err(reason as E));
            },
          );
          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.catch((err: unknown) => {
              resolvePromise(Result.err(err as E));
            });
          }
        } catch (err) {
          resolvePromise(Result.err(err as E));
        }
      });
  }

  /**
   * Creates a lazy `Task` from a thunk that returns a `Result<T, E>` or `Promise<Result<T, E>>`.
   *
   * @template T The success value type.
   * @template E The error value type.
   * @param thunk Zero-argument function returning a `Result` or `Promise<Result>`.
   * @returns A new `Task<T, E>` in the `"idle"` state.
   */
  public static from<T, E = Error>(thunk: () => Promise<Result<T, E>> | Result<T, E>): Task<T, E> {
    return new Task<T, E>(() => {}, {
      status: TaskStatus.IDLE,
      thunk: async () => {
        try {
          return await thunk();
        } catch (err) {
          return Result.err(err as E);
        }
      },
    });
  }

  /**
   * Creates a lazy `Task` from a synchronous or asynchronous function that may throw or reject.
   *
   * @template T The resolved value type.
   * @template E The mapped error type (defaults to `Error`).
   * @param fn Function returning `T` or `Promise<T>`.
   * @param onError Optional mapper transforming caught errors into `E`.
   * @returns A new `Task<T, E>` in the `"idle"` state.
   */
  public static tryCatch<T, E = Error>(
    fn: () => PromiseLike<T> | T,
    onError?: (error: unknown) => E,
  ): Task<T, E> {
    return Task.from(async () => {
      try {
        const value = await fn();
        return Result.ok<T, E>(value);
      } catch (err) {
        const mapped = onError
          ? onError(err)
          : ((err instanceof Error ? err : new Error(String(err))) as unknown as E);
        return Result.err<E, T>(mapped);
      }
    });
  }

  /**
   * Creates a `Task` that is already resolved in the `"succeeded"` state with `value`.
   *
   * @template T The success value type.
   * @template E The nominal error type parameter (defaults to `Error`).
   * @param value The value to resolve the `Task` with.
   * @returns A `Task<T, E>` in the `"succeeded"` state.
   */
  public static success<T, E = Error>(value: T): Task<T, E> {
    const okResult = Result.ok<T, E>(value);
    return new Task<T, E>(() => {}, {
      status: TaskStatus.SUCCEEDED,
      result: value,
      thunk: () => Promise.resolve(okResult),
    });
  }

  /**
   * Alias for {@link Task.success}.
   *
   * @template T The success value type.
   * @template E The nominal error type parameter.
   * @param value The value to resolve the `Task` with.
   * @returns A `Task<T, E>` in the `"succeeded"` state.
   */
  public static ok<T, E = never>(value: T): Task<T, E> {
    return Task.success<T, E>(value);
  }

  /**
   * Alias for {@link Task.success}, satisfying the pointed functor / monad `of` convention.
   *
   * @template T The success value type.
   * @template E The nominal error type parameter.
   * @param value The value to lift into `Task`.
   * @returns A `Task<T, E>` in the `"succeeded"` state.
   */
  public static of<T, E = never>(value: T): Task<T, E> {
    return Task.success<T, E>(value);
  }

  /**
   * Creates a `Task` that is already settled in the `"failed"` state with `reason`.
   *
   * @template T The nominal success value type (defaults to `never`).
   * @template E The error value type (defaults to `Error`).
   * @param reason The error reason for the failed `Task`.
   * @returns A `Task<T, E>` in the `"failed"` state.
   */
  public static failure<T = never, E = Error>(reason: E): Task<T, E> {
    const errResult = Result.err<E, T>(reason);
    return new Task<T, E>(() => {}, {
      status: TaskStatus.FAILED,
      error: reason,
      thunk: () => Promise.resolve(errResult),
    });
  }

  /**
   * Alias for {@link Task.failure}.
   *
   * @template E The error value type.
   * @template T The nominal success value type.
   * @param error The error reason for the failed `Task`.
   * @returns A `Task<T, E>` in the `"failed"` state.
   */
  public static err<E, T = never>(error: E): Task<T, E> {
    return Task.failure<T, E>(error);
  }

  /**
   * Lifts an existing {@link Result} into an immediately settled `Task`.
   *
   * @template T The success value type.
   * @template E The error value type.
   * @param result The `Result<T, E>` to lift.
   * @returns A `Task<T, E>` in `"succeeded"` (if `Ok`) or `"failed"` (if `Err`) state.
   */
  public static fromResult<T, E>(result: Result<T, E>): Task<T, E> {
    return result.match({
      ok: (val) => Task.success<T, E>(val),
      err: (err) => Task.failure<T, E>(err),
    });
  }

  /**
   * Lifts an {@link Option} into an immediately settled `Task`, mapping `Some(v)` to
   * a succeeded task and `None` to a failed task with `error`.
   *
   * @template T The option value type.
   * @template E The error type when `option` is `None`.
   * @param option The `Option<T>` to convert.
   * @param error Error value or lazy factory used when `option` is `None`.
   * @returns A `Task<T, E>`.
   */
  public static fromOption<T, E>(option: Option<T>, error: E | (() => E)): Task<T, E> {
    return Task.fromResult(Result.fromOption(option, error));
  }

  /**
   * Runs an iterable of tasks concurrently (via `Promise.all`) and collects their `Ok` values.
   * Short-circuits with the first `Err` if any task fails.
   *
   * @template T The element success type.
   * @template E The error type.
   * @param tasks Iterable collection of `Task<T, E>` instances.
   * @returns A new lazy `Task<T[], E>`.
   */
  public static all<T, E>(tasks: Iterable<Task<T, E>>): Task<T[], E> {
    return Task.from(async () => {
      const results = await Promise.all(Array.from(tasks, (t) => t.run()));
      return Result.all(results);
    });
  }

  /**
   * Runs an iterable of tasks sequentially (one after another) and collects their `Ok` values.
   * Stops and returns the first `Err` encountered without starting subsequent tasks.
   *
   * @template T The element success type.
   * @template E The error type.
   * @param tasks Iterable collection of `Task<T, E>` instances.
   * @returns A new lazy `Task<T[], E>`.
   */
  public static sequence<T, E>(tasks: Iterable<Task<T, E>>): Task<T[], E> {
    return Task.from(async () => {
      const values: T[] = [];
      for (const task of tasks) {
        const res = await task.run();
        if (res.isErr()) {
          return Result.err(res.unwrapErr());
        }
        values.push(res.unwrap());
      }
      return Result.ok(values);
    });
  }

  /**
   * Races an iterable of tasks concurrently and settles with the result of the first task to complete.
   *
   * @template T The success value type.
   * @template E The error value type.
   * @param tasks Iterable collection of `Task<T, E>` instances.
   * @returns A new lazy `Task<T, E>`.
   */
  public static race<T, E>(tasks: Iterable<Task<T, E>>): Task<T, E> {
    return Task.from(() => Promise.race(Array.from(tasks, (t) => t.run())));
  }

  /**
   * Executes the `Task`, updating its status (`"pending"` -> `"succeeded"` | `"failed"`)
   * and resolving to a {@link Result | Result<T, E>} without throwing.
   *
   * Optional `onFulfilled` and `onRejected` callbacks are invoked when provided,
   * preserving backwards compatibility with `@luism/task-ts`.
   *
   * @param onFulfilled Optional callback executed when the task succeeds.
   * @param onRejected Optional callback executed when the task fails.
   * @returns A `Promise` that always resolves to `Result<T, E>`.
   */
  public async run(
    onFulfilled?: (value: T) => void,
    onRejected?: (reason: E) => void,
  ): Promise<Result<T, E>> {
    this.state = TaskStatus.PENDING;
    this.result = undefined;
    this.error = undefined;

    const outcome = await this.thunk();
    if (outcome.isOk()) {
      const value = outcome.unwrap();
      this.state = TaskStatus.SUCCEEDED;
      this.result = value;
      onFulfilled?.(value);
    } else {
      const err = outcome.unwrapErr();
      this.state = TaskStatus.FAILED;
      this.error = err;
      onRejected?.(err);
    }
    return outcome;
  }

  /**
   * Executes the `Task` and returns a standard `Promise<T>` that resolves with `T`
   * on success or rejects with `E` on failure.
   *
   * @returns A promise resolving to `T` or rejecting with `E`.
   */
  public async runOrThrow(): Promise<T> {
    const outcome = await this.run();
    if (outcome.isOk()) {
      return outcome.unwrap();
    }
    throw outcome.unwrapErr();
  }

  /**
   * Executes the `Task` and invokes `onRejected` if the task fails.
   * Provided for backwards compatibility with `@luism/task-ts`.
   *
   * @param onRejected Callback invoked with the error `E` when the task fails.
   * @returns A `Promise<Result<T, E>>` representing the settled outcome.
   */
  public async catch(onRejected: (reason: E) => void): Promise<Result<T, E>> {
    return this.run(undefined, onRejected);
  }

  /**
   * Transforms the success value of this `Task` using `fn`.
   * Returns a new lazy `Task` without executing the current task immediately.
   *
   * @template U The transformed success type.
   * @param fn Transformation function applied to the `Ok` value.
   * @returns A new lazy `Task<U, E>`.
   */
  public map<U>(fn: (value: T) => U): Task<U, E> {
    return Task.from(async () => {
      const res = await this.run();
      return res.map(fn);
    });
  }

  /**
   * Transforms the error value of this `Task` using `fn`.
   * Returns a new lazy `Task` without executing the current task immediately.
   *
   * @template F The transformed error type.
   * @param fn Transformation function applied to the `Err` value.
   * @returns A new lazy `Task<T, F>`.
   */
  public mapErr<F>(fn: (error: E) => F): Task<T, F> {
    return Task.from(async () => {
      const res = await this.run();
      return res.mapErr(fn);
    });
  }

  /**
   * Simultaneously transforms either the success value (`onOk`) or the error value (`onErr`).
   *
   * @template U The transformed success type.
   * @template F The transformed error type.
   * @param onOk Function applied when the task succeeds.
   * @param onErr Function applied when the task fails.
   * @returns A new lazy `Task<U, F>`.
   */
  public bimap<U, F>(onOk: (value: T) => U, onErr: (error: E) => F): Task<U, F> {
    return Task.from(async () => {
      const res = await this.run();
      return res.bimap(onOk, onErr);
    });
  }

  /**
   * Chains a computation that returns another `Task` or `Result`, flattening the result into a single lazy `Task`.
   *
   * @template U The next success value type.
   * @template F The error type of the chained computation.
   * @param fn Function mapping the resolved `T` to a `Task<U, F>` or `Result<U, F>`.
   * @returns A new lazy `Task<U, E | F>`.
   */
  public flatMap<U, F = E>(fn: (value: T) => Task<U, F> | Result<U, F>): Task<U, E | F> {
    return Task.from(async () => {
      const res = await this.run();
      if (res.isErr()) {
        return Result.err<E | F, U>(res.unwrapErr());
      }
      const next = fn(res.unwrap());
      return next instanceof Task ? next.run() : next;
    });
  }

  /**
   * Alias for {@link Task.flatMap}.
   *
   * @template U The next success value type.
   * @template F The error type of the chained computation.
   * @param fn Function mapping the resolved `T` to a `Task<U, F>` or `Result<U, F>`.
   * @returns A new lazy `Task<U, E | F>`.
   */
  public andThen<U, F = E>(fn: (value: T) => Task<U, F> | Result<U, F>): Task<U, E | F> {
    return this.flatMap(fn);
  }

  /**
   * Recovers from a failed task by invoking `fn` to produce a fallback `Task` or `Result`.
   *
   * @template F The error type of the recovery computation.
   * @param fn Recovery handler receiving the error `E`.
   * @returns A new lazy `Task<T, F>`.
   */
  public orElse<F>(fn: (error: E) => Task<T, F> | Result<T, F>): Task<T, F> {
    return Task.from(async () => {
      const res = await this.run();
      if (res.isOk()) {
        return Result.ok<T, F>(res.unwrap());
      }
      const recovered = fn(res.unwrapErr());
      return recovered instanceof Task ? recovered.run() : recovered;
    });
  }

  /**
   * Returns a new lazy `Task` that executes a side-effect `fn` on the success value when run.
   *
   * @param fn Side-effect callback receiving the resolved value `T`.
   * @returns A new lazy `Task<T, E>`.
   */
  public tap(fn: (value: T) => void): Task<T, E> {
    return Task.from(async () => {
      const res = await this.run();
      return res.tap(fn);
    });
  }

  /**
   * Returns a new lazy `Task` that executes a side-effect `fn` on the error value when run.
   *
   * @param fn Side-effect callback receiving the error `E`.
   * @returns A new lazy `Task<T, E>`.
   */
  public tapErr(fn: (error: E) => void): Task<T, E> {
    return Task.from(async () => {
      const res = await this.run();
      return res.tapErr(fn);
    });
  }

  /**
   * Executes the `Task` and folds its settled `Result` using the `ok` and `err` branch handlers.
   *
   * @template R The return type of the match branches.
   * @param patterns Object containing `ok` and `err` callbacks.
   * @returns A `Promise<R>` resolving to the matched branch result.
   */
  public async match<R>(patterns: ResultMatcher<T, E, R>): Promise<R> {
    const res = await this.run();
    return res.match(patterns);
  }

  /**
   * Alias for {@link Task.match}.
   *
   * @template R The return type of the match branches.
   * @param patterns Object containing `ok` and `err` callbacks.
   * @returns A `Promise<R>` resolving to the matched branch result.
   */
  public async fold<R>(patterns: ResultMatcher<T, E, R>): Promise<R> {
    return this.match(patterns);
  }

  /**
   * Gets the result of the `Task` if it has succeeded.
   *
   * @returns The success value `T`, or `undefined` if the task has not succeeded.
   */
  public getResult(): T | undefined {
    return this.result;
  }

  /**
   * Gets the error of the `Task` if it has failed.
   *
   * @returns The error value `E`, or `undefined` if the task has not failed.
   */
  public getError(): E | undefined {
    return this.error;
  }

  /**
   * Converts the current settled state of this `Task` into an `Option<Result<T, E>>`.
   * Returns `Some(Ok(result))` if succeeded, `Some(Err(error))` if failed, or `None` if idle/pending.
   *
   * @returns `Option<Result<T, E>>` reflecting the current synchronous state.
   */
  public toResult(): Option<Result<T, E>> {
    if (this.state === TaskStatus.SUCCEEDED) {
      return Option.some(Result.ok<T, E>(this.result as T));
    }
    if (this.state === TaskStatus.FAILED) {
      return Option.some(Result.err<E, T>(this.error as E));
    }
    return Option.none();
  }

  /**
   * Gets the current execution status of the `Task`.
   *
   * @returns `"idle"`, `"pending"`, `"succeeded"`, or `"failed"`.
   */
  public getStatus(): TaskStatus {
    return this.state;
  }

  /**
   * Checks if the `Task` has not yet been started (`"idle"`).
   *
   * @returns `true` if the task is idle, `false` otherwise.
   */
  public isIdle(): this is Task<T, E> & { getStatus: () => typeof TaskStatus.IDLE } {
    return this.state === TaskStatus.IDLE;
  }

  /**
   * Checks if the `Task` is currently executing (`"pending"`).
   *
   * @returns `true` if the task is pending, `false` otherwise.
   */
  public isPending(): this is Task<T, E> & { getStatus: () => typeof TaskStatus.PENDING } {
    return this.state === TaskStatus.PENDING;
  }

  /**
   * Checks if the `Task` has completed successfully (`"succeeded"`).
   *
   * @returns `true` if the task has succeeded, `false` otherwise.
   */
  public isSucceeded(): this is Task<T, E> & { getStatus: () => typeof TaskStatus.SUCCEEDED } {
    return this.state === TaskStatus.SUCCEEDED;
  }

  /**
   * Checks if the `Task` has failed (`"failed"`).
   *
   * @returns `true` if the task has failed, `false` otherwise.
   */
  public isFailed(): this is Task<T, E> & { getStatus: () => typeof TaskStatus.FAILED } {
    return this.state === TaskStatus.FAILED;
  }
}

export default Task;
