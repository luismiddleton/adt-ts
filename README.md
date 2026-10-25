# adt-ts

[![npm version](https://img.shields.io/npm/v/@luism/adt-ts.svg)](https://www.npmjs.com/package/@luism/adt-ts)
[![license](https://img.shields.io/npm/l/@luism/adt-ts.svg)](https://github.com/luismiddleton/adt-ts/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](https://www.npmjs.com/package/@luism/adt-ts)

A lightweight, tree-shakable TypeScript library providing Algebraic Data Types (`Option`, `Result`, `Task`, `ADT`) with functional purity and strict type safety.

---

## Key Pillars

- **Features**: Rich, practical ADT primitives (`Option`, `Result`, `Task`, and custom `ADT` unions) designed to eliminate null pointer exceptions, unhandled runtime crashes, and untracked async state.
- **Composability**: A unified and predictable fluent API across all types (`map`, `flatMap`, `match`, fallback helpers), making transitions and integrations effortless.
- **Compatibility**: Zero runtime dependencies, with full support for Node.js 16+, modern browsers, Deno, Bun, and Edge runtimes.

---

## Installation

```bash
# pnpm
pnpm add @luism/adt-ts

# npm
npm install @luism/adt-ts

# yarn
yarn add @luism/adt-ts
```

---

## Which Type Should I Use?

| Scenario / Need              | Question to Ask                                                         | Recommended Type     | Documentation                  |
| :--------------------------- | :---------------------------------------------------------------------- | :------------------- | :----------------------------- |
| **Missing values**           | _"Could this value be absent without an explicit failure reason?"_      | `Option<T>`          | [Option Guide](docs/option.md) |
| **Fallible sync operations** | _"Can this fail synchronously, and do I need to inspect the failure?"_  | `Result<T, E>`       | [Result Guide](docs/result.md) |
| **Asynchronous operations**  | _"Is this operation async, lazy, cancellable, or retryable?"_           | `Task<T, E>`         | [Task Guide](docs/task.md)     |
| **Custom domain models**     | _"Do I have multiple related data shapes needing exhaustive matching?"_ | `ADT.define<Spec>()` | [ADT Guide](docs/adt.md)       |

---

## Features & Quick Start

### [`Option<T>`](docs/option.md) &mdash; Safe Optional Values

Handle missing values gracefully without `null` or `undefined` runtime errors. Provides safe chaining (`map`, `flatMap`, `filter`) and default unwrapping.

```ts
import { Option } from "@luism/adt-ts/option";

const port = Option.fromNullable(process.env.PORT)
  .map((raw) => Number.parseInt(raw, 10))
  .filter((n) => !Number.isNaN(n))
  .unwrapOr(3000);
```

📖 _Learn more in the [Option Deep Dive](docs/option.md)._

### [`Result<T, E>`](docs/result.md) &mdash; Predictable Error Handling

Represent operations that can succeed or fail explicitly without thrown exceptions. Features dual-channel transformations (`map`, `mapErr`), validation composition, and typed recovery.

```ts
import { Result } from "@luism/adt-ts/result";

const parseJson = (raw: string): Result<Record<string, unknown>, Error> =>
  Result.tryCatch(
    () => JSON.parse(raw) as Record<string, unknown>,
    (err) => new Error(`Invalid JSON: ${String(err)}`),
  );

const message = parseJson('{"status":"ok"}').match({
  ok: (data) => `Loaded status: ${data.status}`,
  err: (error) => `Parse failed: ${error.message}`,
});
```

📖 _Learn more in the [Result Deep Dive](docs/result.md)._

### [`Task<T, E>`](docs/task.md) &mdash; Lazy Async Computations

Encapsulate asynchronous operations that run only when triggered, never throw unhandled rejections, and yield a `Promise<Result<T, E>>` upon `.run()`.

```ts
import { Task } from "@luism/adt-ts/task";

const fetchUserProfile = (userId: string) =>
  Task.tryCatch(async () => {
    const res = await fetch(`/api/users/${userId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as { id: string; name: string };
  });

// Nothing executes until .run() is called
const outcome = await fetchUserProfile("usr_123")
  .map((user) => user.name.toUpperCase())
  .run(); // Returns Promise<Result<string, Error>>, never throws!

if (outcome.isOk()) {
  console.log("User:", outcome.unwrap());
}
```

📖 _Learn more in the [Task Deep Dive](docs/task.md)._

### [`ADT` (Tagged Unions)](docs/adt.md) &mdash; Custom Domain Models

Build custom data shapes with compile-time exhaustive pattern matching (`match`) across all variants.

```ts
import { ADT, type ADTUnion } from "@luism/adt-ts/adt";

type ShapeSpec = {
  Circle: { radius: number };
  Rectangle: { width: number; height: number };
  Point: {};
};

const Shape = ADT.define<ShapeSpec>();
type Shape = ADTUnion<ShapeSpec>;

const shape: Shape = Shape.Circle({ radius: 5 });

const area = Shape.match(shape, {
  Circle: ({ radius }) => Math.PI * radius ** 2,
  Rectangle: ({ width, height }) => width * height,
  Point: () => 0,
});
```

📖 _Learn more in the [ADT Deep Dive](docs/adt.md)._

---

## Interoperability

The types in `adt-ts` are designed to convert smoothly into one another:

- **`Result<T, E>` to `Option<T>`**: Discard error details when only success matters via `.toOption()`.
- **`Task<T, E>` to `Result<T, E>`**: Executing a `Task` via `.run()` resolves to a `Promise<Result<T, E>>`, keeping async error handling fully typed and contained.
- **`Option<T>` to `Result<T, E>`**: Convert an optional value into a fallible result using pattern matching or fallback mapping.

---

## License

MIT &copy; [Luis Middleton](https://github.com/luismiddleton)
