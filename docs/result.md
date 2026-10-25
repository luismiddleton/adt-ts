[🏠 Home](../README.md) · [Option](option.md) · **Result** · [Task](task.md) · [ADT](adt.md)

---

# `Result<T, E>`

An algebraic data type that represents the outcome of an operation that can either succeed (`Ok<T>`) or fail (`Err<E>`).

---

## Executive Summary

`Result<T, E>` replaces unpredictable thrown exceptions with explicit, typed error values, enabling compile-time error handling and safe, composable validation pipelines.

---

## Why & Key Benefits

In standard JavaScript and TypeScript, runtime exceptions thrown with `throw` are invisible to the type system (`catch (e: unknown)`), leading to silent crashes, untyped error recovery, and fragile control flow:

| Failure Mode in Vanilla JS/TS | Failure Impact | `Result<T, E>` Solution | Engineering Advantage |
| :--- | :--- | :--- | :--- |
| **Invisible thrown exceptions** | Callers cannot tell from `function parse(str): Data` whether or what errors may be thrown. | Return types explicitly declare `Result<Data, ParseError>`. | **Self-documenting contracts**: Error conditions are enforced at compile time. |
| **`catch (e: unknown)` type erasure** | TypeScript types caught errors as `unknown` or `any`, requiring defensive runtime type assertions. | The error type parameter `E` preserves exact error types throughout the pipeline. | **Type-safe error channels**: Pattern match or transform typed error domain objects without `instanceof`. |
| **Uncaught exception crashes** | A single omitted `try/catch` block terminates Node processes or halts UI rendering. | Errors are returned as ordinary data values rather than thrown interrupts. | **Zero unhandled crashes**: Control flow remains predictable and resilient. |
| **Nested `try/catch` boilerplate** | Multi-step validation leads to indented, unreadable `try/catch` blocks. | Monadic chaining via `flatMap`, `map`, and `orElse` linearizes execution. | **Linear, composable pipelines**: Code reads top-to-bottom with unified error propagation. |

### Before vs After

````carousel
```typescript
// ❌ Before: Invisible thrown exceptions and untyped catch blocks
function parseConfig(raw: string): AppConfig {
  try {
    const json = JSON.parse(raw);
    if (!json.apiKey) {
      throw new Error("Missing apiKey");
    }
    return json;
  } catch (err: unknown) {
    // Type of err is unknown, easily mishandled or rethrown
    console.error("Failed:", (err as Error).message);
    throw err;
  }
}
```
<!-- slide -->
```typescript
// ✅ After: Declarative, typed Result pipeline with explicit error models
import { Result } from "@luism/adt-ts/result";

type ConfigError = { type: "INVALID_JSON"; cause: string } | { type: "MISSING_KEY"; key: string };

function parseConfig(raw: string): Result<AppConfig, ConfigError> {
  return Result.tryCatch(
    () => JSON.parse(raw) as Record<string, unknown>,
    (err) => ({ type: "INVALID_JSON", cause: String(err) }) as ConfigError,
  ).flatMap((json) =>
    typeof json.apiKey === "string"
      ? Result.ok({ apiKey: json.apiKey })
      : Result.err<ConfigError>({ type: "MISSING_KEY", key: "apiKey" }),
  );
}
```
````

---

## When to Use It (and When Not To)

### Ideal Scenarios
- **Synchronous Fallible Operations**: JSON parsing, regex validation, schema parsing, configuration loading.
- **Domain & Business Logic Validation**: Form validation, business rule verification, entity creation where errors have specific domain meaning.
- **Replacing Throw-Heavy Libraries**: Wrapping third-party synchronous functions that throw exceptions using `Result.tryCatch`.

### When Not To Use
- **Missing Values Without Failure Causes**: When a value is simply absent and callers do not need diagnostic reasons, use [`Option<T>`](option.md).
- **Asynchronous Operations**: For asynchronous tasks, use [`Task<T, E>`](task.md) (which yields a `Promise<Result<T, E>>` upon completion).
- **Critical Programming Bugs**: Fatal invariants or assertion failures that indicate code bugs (e.g., array index bounds violations in internal algorithms) can still use standard panics/throws.

---

## Mental Model & Flow

A `Result<T, E>` is a dual-channel container that exists in either the `Ok` state (carrying `value: T`) or the `Err` state (carrying `error: E`).

```mermaid
stateDiagram-v2
    [*] --> Ok: Result.ok(value)
    [*] --> Err: Result.err(error)

    state Ok {
        [*] --> MapOk: map(fn)
        MapOk --> Ok: fn(v) -> v'
        [*] --> FlatMapOk: flatMap(fn)
        FlatMapOk --> Ok: fn(v) -> Ok
        FlatMapOk --> Err: fn(v) -> Err
    }

    state Err {
        [*] --> MapErr: mapErr(fn)
        MapErr --> Err: fn(e) -> e'
        [*] --> OrElse: orElse(fn)
        OrElse --> Ok: fn(e) -> Ok
        OrElse --> Err: fn(e) -> Err
    }

    Ok --> Extract: unwrapOr(default) -> returns value
    Err --> Extract: unwrapOr(default) -> returns default
```

When transforming a `Result`:
- `.map()` transforms the `Ok` value while bypassing `Err`.
- `.mapErr()` transforms the `Err` value while bypassing `Ok`.
- `.bimap()` provides dual mappers for both channels at once.
- `.flatMap()` chains a subsequent computation that returns another `Result`.
- `.orElse()` intercepts an `Err` and allows recovery with a new `Result`.

---

## Core API & Common Patterns

### 1. Constructors

```typescript
import { Result } from "@luism/adt-ts/result";

// Explicit success and failure
const success = Result.ok(42);
const failure = Result.err("Connection timed out");

// Wrap throwing synchronous code
const parsed = Result.tryCatch(
  () => JSON.parse(rawText),
  (err) => new Error(`JSON parse error: ${String(err)}`),
);

// Wrap Promise (never throws, returns Promise<Result<T, E>>)
const asyncOutcome = await Result.fromPromise(
  fetchData(),
  (err) => new Error(`Fetch failed: ${String(err)}`),
);

// Convert from Option
import { Option } from "@luism/adt-ts/option";
const opt = Option.some("user_1");
const fromOpt = Result.fromOption(opt, "User not found"); // Ok("user_1")
```

### 2. Dual-Channel Transformations

```typescript
const result: Result<number, string> = Result.ok(10);

// map: Transforms Ok value, leaves Err intact
const doubled = result.map((n) => n * 2); // Ok(20)

// mapErr: Transforms Err value, leaves Ok intact
const withCode = result.mapErr((err) => ({ code: 500, message: err }));

// bimap: Transforms both channels simultaneously
const formatted = result.bimap(
  (val) => `Success: ${val}`,
  (err) => `Failed: ${err}`,
);
```

### 3. Chaining & Recovery

```typescript
// flatMap / andThen: Chain dependent fallible operations
function divide(n: number, d: number): Result<number, string> {
  return d === 0 ? Result.err("Division by zero") : Result.ok(n / d);
}

const outcome = Result.ok(100)
  .flatMap((n) => divide(n, 2))
  .flatMap((n) => divide(n, 5)); // Ok(10)

// orElse: Recover from errors
const recovered = Result.err("Primary cache miss").orElse((_err) =>
  Result.ok("Loaded from fallback database"),
); // Ok("Loaded from fallback database")
```

### 4. Working with Multiple Results

```typescript
// Result.all: Short-circuits on first error
const allSucceeded = Result.all([Result.ok(1), Result.ok(2), Result.ok(3)]); // Ok([1, 2, 3])
const hasFailure = Result.all([Result.ok(1), Result.err("boom"), Result.ok(3)]); // Err("boom")

// Result.partition: Separates successes from errors
const [successes, errors] = Result.partition([
  Result.ok(10),
  Result.err("err1"),
  Result.ok(20),
  Result.err("err2"),
]);
// successes: [10, 20]
// errors: ["err1", "err2"]
```

### 5. Extraction & Pattern Matching

```typescript
const res = Result.ok("active");

// Safe extraction with fallback
const status = res.unwrapOr("inactive");
const computed = res.unwrapOrElse((err) => `fallback-${err}`);

// Pattern matching (exhaustive)
const message = res.match({
  ok: (val) => `Status is ${val}`,
  err: (err) => `Error encountered: ${err}`,
});

// Interop with Option
const optVal = res.toOption(); // Option<string> (Some("active"))
const optErr = res.toErrOption(); // Option<E> (None)
```

---

## Real-World Example: User Registration Validation Pipeline

```typescript
import { Result } from "@luism/adt-ts/result";

interface RawInput {
  username?: string;
  email?: string;
  age?: number;
}

type ValidationError =
  | { field: "username"; reason: "REQUIRED" | "TOO_SHORT" }
  | { field: "email"; reason: "INVALID_FORMAT" }
  | { field: "age"; reason: "MUST_BE_ADULT" };

interface ValidUser {
  username: string;
  email: string;
  age: number;
}

function validateUsername(raw?: string): Result<string, ValidationError> {
  if (!raw) return Result.err({ field: "username", reason: "REQUIRED" });
  if (raw.length < 3) return Result.err({ field: "username", reason: "TOO_SHORT" });
  return Result.ok(raw.trim());
}

function validateEmail(raw?: string): Result<string, ValidationError> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return raw && emailRegex.test(raw)
    ? Result.ok(raw.toLowerCase())
    : Result.err({ field: "email", reason: "INVALID_FORMAT" });
}

function validateAge(raw?: number): Result<number, ValidationError> {
  return typeof raw === "number" && raw >= 18
    ? Result.ok(raw)
    : Result.err({ field: "age", reason: "MUST_BE_ADULT" });
}

function registerUser(input: RawInput): Result<ValidUser, ValidationError> {
  return validateUsername(input.username).flatMap((username) =>
    validateEmail(input.email).flatMap((email) =>
      validateAge(input.age).map((age) => ({ username, email, age })),
    ),
  );
}

// Usage:
const result = registerUser({ username: "alice", email: "alice@example.com", age: 24 });

result.match({
  ok: (user) => console.log("Registered user:", user.username),
  err: (error) => console.error(`Validation failed on ${error.field}: ${error.reason}`),
});
```

---

## API Quick Reference

| Method / Function | Signature | Description |
| :--- | :--- | :--- |
| `Result.ok(value)` | `(value: T) => Result<T, never>` | Wraps a value in an `Ok` instance. |
| `Result.err(error)` | `(error: E) => Result<never, E>` | Wraps an error in an `Err` instance. |
| `Result.tryCatch(fn, onError?)` | `(fn: () => T, onError?) => Result<T, E>` | Invokes `fn`, catching throws into `Err`. |
| `Result.fromOption(opt, err)` | `(option: Option<T>, error: E \| () => E) => Result<T, E>` | Converts `Option` to `Result`. |
| `Result.fromNullable(val, err)` | `(val: T \| null \| undefined, error: E) => Result<NonNullable<T>, E>` | Creates `Ok` if non-nullish, `Err` otherwise. |
| `Result.fromPromise(p, onError?)` | `(promise: PromiseLike<T>, onError?) => Promise<Result<T, E>>` | Wraps promise into non-rejecting Result promise. |
| `Result.all(results)` | `(results: Iterable<Result<T, E>>) => Result<T[], E>` | Collects successes or short-circuits on first `Err`. |
| `Result.partition(results)` | `(results: Iterable<Result<T, E>>) => [T[], E[]]` | Splits items into `[okValues, errors]` tuple. |
| `res.isOk()` | `() => boolean` | Type guard checking if result is `Ok`. |
| `res.isErr()` | `() => boolean` | Type guard checking if result is `Err`. |
| `res.map(fn)` | `(fn: (val: T) => U) => Result<U, E>` | Transforms `Ok` value; propagates `Err`. |
| `res.mapErr(fn)` | `(fn: (err: E) => F) => Result<T, F>` | Transforms `Err` value; propagates `Ok`. |
| `res.bimap(onOk, onErr)` | `(onOk: (v: T) => U, onErr: (e: E) => F) => Result<U, F>` | Maps both channels simultaneously. |
| `res.flatMap(fn)` | `(fn: (val: T) => Result<U, F>) => Result<U, E \| F>` | Chains a computation returning a `Result`. |
| `res.orElse(fn)` | `(fn: (err: E) => Result<T, F>) => Result<T, F>` | Recovers from `Err` with a new `Result`. |
| `res.tap(fn)` | `(fn: (val: T) => void) => this` | Executes side effect on `Ok` value. |
| `res.tapErr(fn)` | `(fn: (err: E) => void) => this` | Executes side effect on `Err` value. |
| `res.match(patterns)` | `(patterns: ResultMatcher<T, E, R>) => R` | Exhaustive pattern match on `ok` and `err`. |
| `res.unwrap()` | `() => T` | Returns `Ok` value or throws `UnwrapError`. |
| `res.unwrapErr()` | `() => E` | Returns `Err` error or throws `UnwrapError`. |
| `res.expect(msg)` | `(message: string) => T` | Returns `Ok` value or throws `UnwrapError` with message. |
| `res.unwrapOr(fallback)` | `(fallback: F) => T \| F` | Returns `Ok` value or default fallback. |
| `res.unwrapOrElse(fn)` | `(fn: (err: E) => F) => T \| F` | Returns `Ok` value or computes fallback lazily. |
| `res.toOption()` | `() => Option<T>` | Converts `Result` to `Option` (discarding error). |
| `res.toErrOption()` | `() => Option<E>` | Extracts error into `Option` (discarding success). |

---

[← Option](option.md) · [🏠 Home](../README.md) · [Next: Task →](task.md)
