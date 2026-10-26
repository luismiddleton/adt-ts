[🏠 Home](../README.md) · **Option** · [Result](result.md) · [Task](task.md) · [ADT](adt.md)

---

# `Option<T>`

An algebraic data type that explicitly models the presence (`Some<T>`) or absence (`None`) of a value.

---

## Executive Summary

`Option<T>` eliminates runtime `null` and `undefined` reference errors by elevating optionality into the TypeScript type system, replacing error-prone defensive checks with composable, chainable operations.

---

## Why & Key Benefits

JavaScript and TypeScript applications frequently suffer from insidious runtime bugs caused by missing values, falsy value coercion, and forgotten `null` checks. `Option<T>` addresses each of these failure modes directly:

| Failure Mode in Vanilla JS/TS | Failure Impact | `Option<T>` Solution | Engineering Advantage |
| :--- | :--- | :--- | :--- |
| **`TypeError: Cannot read properties of undefined`** | Application crashes in production during property access or method invocation. | Optionality is enforced by the compiler; access requires explicit extraction or mapping. | **Zero unhandled null crashes**: Unsafe access fails at compile time, not runtime. |
| **Accidental falsy coercion (`0`, `""`, `false`)** | Buggy logic when `value || default` inadvertently overrides legitimate values like `0` or `false`. | Distinguishes between absence (`None`) and valid falsy values wrapped in `Some(0)`. | **Accurate domain logic**: Explicit presence guarantees zero false-positive defaults. |
| **Silent propagation of `undefined`** | Optional chaining (`?.`) silently passes `undefined` through chains, obscuring where errors occurred. | Pure, explicit monadic pipeline (`map`, `flatMap`, `filter`) halts precisely on `None`. | **Predictable execution**: Value propagation stops cleanly without leaky `undefined` values. |
| **Ambiguous function signatures** | `getUser(id): User | undefined` fails to distinguish between "not found" vs "error occurred". | Functions explicitly return `Option<User>`, communicating clear intent. | **Self-documenting APIs**: Codebase consumers immediately know how to handle absent values. |

### Before vs After

#### ❌ Before: Fragile defensive checks and falsy coercion pitfalls

```typescript
function getPort(envPort: string | undefined): number {
  if (envPort !== undefined && envPort !== null) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return 8080;
}

// Falsy pitfall example:
const timeout = config.timeout || 3000; // Overrides 0 with 3000!
```

#### ✅ After: Clean, declarative, type-safe pipeline with Option

```typescript
import { Option } from "@luism/adt-ts/option";

function getPort(envPort: string | undefined): number {
  return Option.fromNullable(envPort)
    .map((val) => parseInt(val, 10))
    .filter((num) => !isNaN(num))
    .unwrapOr(8080);
}

// Exact presence check (preserves 0):
const timeout = Option.fromNullable(config.timeout).unwrapOr(3000);
```

---

## When to Use It (and When Not To)

### Ideal Scenarios
- **Optional Object Properties & Lookups**: Finding an element in an array (`array.find(...)`), querying a `Map`, or reading optional configuration parameters.
- **Data Validation & Filtering**: Chaining transformation steps where any intermediate step may yield no result (e.g., parsing strings, validating ranges).
- **Safe Extraction at Boundaries**: Ingesting external data from JSON, HTTP query parameters, or environment variables.

### When Not To Use
- **When You Need the Error Reason**: If the absence of a value represents a failure and callers need to know *why* it failed (e.g., HTTP 404 vs 401, validation error message), use [`Result<T, E>`](result.md).
- **Asynchronous Missing Values**: If fetching the value requires an asynchronous operation, wrap it in [`Task<Option<T>, E>`](task.md) or [`Task<T, E>`](task.md).
- **High-Performance Internal Hot Loops**: In tight numerical or rendering loops where object allocations must be minimized, TypeScript primitives may be preferred.

---

## Mental Model & Flow

An `Option<T>` is a container that exists in one of two states: `Some` (containing a value of type `T`) or `None` (empty).

```mermaid
stateDiagram-v2
    direction TB
    [*] --> Some: "Option.some(v) / fromNullable(v)"
    [*] --> None: "Option.none() / fromNullable(null)"

    state Some {
        [*] --> MapSome: map(fn)
        MapSome --> Some: "fn(v) yields v'"
        [*] --> FilterSome: filter(pred)
        FilterSome --> None: "predicate is false"
        FilterSome --> Some: "predicate is true"
    }

    state None {
        [*] --> MapNone: map(fn)
        MapNone --> None: "bypass fn"
        [*] --> OrElse: orElse(factory)
        OrElse --> Some: "factory() returns Some"
    }

    Some --> Extract: "unwrapOr(fallback) → v"
    None --> Extract: "unwrapOr(fallback) → fallback"
```

When transforming an `Option` via `.map()`:
- If the instance is `Some(v)`, the callback executes and wraps the new value in `Some(v')`.
- If the instance is `None`, the callback is skipped entirely and `None` is propagated downstream without throwing.

---

## Core API & Common Patterns

### 1. Constructors

```typescript
import { Option } from "@luism/adt-ts/option";

// Wrap an existing value
const someVal = Option.some("hello");

// Empty option singleton (zero memory allocation)
const empty = Option.none<string>();

// Safely convert null or undefined
const fromNull = Option.fromNullable(null); // Option.none()
const fromDefined = Option.fromNullable("value"); // Option.some("value")

// Conditional construction with predicate
const evenOnly = Option.fromPredicate(4, (n) => n % 2 === 0); // Some(4)
const oddRejected = Option.fromPredicate(5, (n) => n % 2 === 0); // None

// Wrap a function that might throw
const parsed = Option.tryCatch(() => JSON.parse(rawText)); // None if throws
```

### 2. Transformations & Combinators

```typescript
// map: Transform the inner value if present
const upper = Option.some("hello").map((s) => s.toUpperCase()); // Some("HELLO")

// flatMap / andThen: Chain operations that return an Option
const findUser = (id: string): Option<User> => /* ... */;
const getAddress = (user: User): Option<Address> => /* ... */;

const address = findUser("usr_1").flatMap(getAddress);

// filter: Keep value only if predicate holds
const adult = Option.some(16).filter((age) => age >= 18); // None

// zip: Combine two Options into a tuple if both are Some
const combined = Option.some(10).zip(Option.some("apples")); // Some([10, "apples"])

// or / orElse: Provide fallback options
const primary = Option.none<string>();
const fallback = Option.some("default");
const active = primary.or(fallback); // Some("default")
const lazyActive = primary.orElse(() => Option.some("computed")); // Some("computed")
```

### 3. Combining Multiple Options

```typescript
// Option.all: Short-circuits to None if ANY item is None
const allPresent = Option.all([Option.some(1), Option.some(2), Option.some(3)]); // Some([1, 2, 3])
const oneMissing = Option.all([Option.some(1), Option.none(), Option.some(3)]); // None

// Option.any: Returns the first Some encountered
const firstMatch = Option.any([Option.none(), Option.some("hit"), Option.some("skip")]); // Some("hit")
```

### 4. Extraction & Pattern Matching

```typescript
const opt = Option.fromNullable(process.env.APP_NAME);

// Safe default extraction
const appName = opt.unwrapOr("DefaultApp");
const computedName = opt.unwrapOrElse(() => calculateDefaultName());

// Pattern matching (exhaustive)
const message = opt.match({
  some: (name) => `Welcome to ${name}`,
  none: () => "Welcome, guest!",
});

// Interop with nullable TS types
const nullable = opt.toNullable(); // string | null
const undef = opt.toUndefined(); // string | undefined

// Assertions (throws UnwrapError if None)
const strict = opt.expect("APP_NAME must be configured in environment");
```

---

## Real-World Example: HTTP Request Header Validation

A resilient pipeline for parsing and sanitizing an authentication token from incoming HTTP headers:

```typescript
import { Option } from "@luism/adt-ts/option";

interface IncomingRequest {
  headers: Record<string, string | undefined>;
}

interface AuthSession {
  token: string;
  isBearer: boolean;
}

function parseAuthHeader(req: IncomingRequest): Option<AuthSession> {
  return Option.fromNullable(req.headers["authorization"])
    .map((header) => header.trim())
    .filter((header) => header.length > 0)
    .flatMap((header) => {
      const parts = header.split(" ");
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        return Option.none();
      }
      return Option.some({
        token: parts[1],
        isBearer: true,
      });
    })
    .filter((session) => session.token.length >= 32); // Verify minimum token length
}

// Usage:
const request: IncomingRequest = {
  headers: { authorization: "Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" },
};

const session = parseAuthHeader(request).unwrapOr({
  token: "anonymous",
  isBearer: false,
});

console.log("Authenticated with:", session.token);
```

---

## API Quick Reference

| Method / Function | Signature | Description |
| :--- | :--- | :--- |
| `Option.some(value)` | `(value: T) => Option<T>` | Wraps a value in a `Some` instance. |
| `Option.none()` | `() => Option<never>` | Returns the shared immutable `None` singleton. |
| `Option.fromNullable(value)` | `(value: T \| null \| undefined) => Option<NonNullable<T>>` | Converts a nullable/undefinable value to `Some` or `None`. |
| `Option.fromPredicate(val, pred)` | `(value: T, predicate: (val: T) => boolean) => Option<T>` | Returns `Some(value)` if predicate matches, otherwise `None`. |
| `Option.tryCatch(fn)` | `(fn: () => T) => Option<T>` | Executes `fn`; returns `Some(result)` or `None` if `fn` threw. |
| `Option.all(options)` | `(options: Iterable<Option<T>>) => Option<T[]>` | Aggregates options into an array; returns `None` if any are `None`. |
| `Option.any(options)` | `(options: Iterable<Option<T>>) => Option<T>` | Returns the first `Some` encountered, or `None`. |
| `opt.isSome()` | `() => boolean` | Type guard checking if this option is `Some`. |
| `opt.isNone()` | `() => boolean` | Type guard checking if this option is `None`. |
| `opt.map(fn)` | `(fn: (val: T) => U) => Option<U>` | Transforms inner value if `Some`; propagates `None`. |
| `opt.flatMap(fn)` | `(fn: (val: T) => Option<U>) => Option<U>` | Chains a computation returning an `Option` (alias `andThen`). |
| `opt.filter(pred)` | `(predicate: (val: T) => boolean) => Option<T>` | Retains inner value if predicate holds; returns `None` otherwise. |
| `opt.zip(other)` | `(other: Option<U>) => Option<[T, U]>` | Pairs values into a tuple if both are `Some`. |
| `opt.or(other)` | `(other: Option<T>) => Option<T>` | Returns `this` if `Some`, otherwise returns `other`. |
| `opt.orElse(fn)` | `(fn: () => Option<T>) => Option<T>` | Returns `this` if `Some`, otherwise lazily computes fallback. |
| `opt.tap(fn)` | `(fn: (val: T) => void) => this` | Executes side effect on `Some` value without modifying it. |
| `opt.match(matcher)` | `(patterns: OptionMatcher<T, R>) => R` | Exhaustively pattern matches on `some` and `none` branches. |
| `opt.unwrap()` | `() => T` | Returns inner value or throws `UnwrapError`. |
| `opt.expect(message)` | `(message: string) => T` | Returns inner value or throws `UnwrapError` with message. |
| `opt.unwrapOr(fallback)` | `(fallback: F) => T \| F` | Returns inner value or provided default fallback. |
| `opt.unwrapOrElse(fn)` | `(fn: () => F) => T \| F` | Returns inner value or computes default fallback lazily. |
| `opt.toNullable()` | `() => T \| null` | Converts `Option<T>` into `T \| null`. |
| `opt.toUndefined()` | `() => T \| undefined` | Converts `Option<T>` into `T \| undefined`. |

---

[← 🏠 Home](../README.md) · [Next: Result →](result.md)
