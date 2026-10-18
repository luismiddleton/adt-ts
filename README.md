# adt-ts

A TypeScript library for Algebraic Data Types (ADTs).

## Features

- **Core Algebraic Data Types**:
  - **`Option<T>`**: Safe optional values (`Some<T>` | `None`) with a zero-allocation `None` singleton.
  - **`Result<T, E>`**: Explicit synchronous error handling (`Ok<T>` | `Err<E>`).
  - **`Task<T, E>`**: Lazy, composable asynchronous computations (`() => Promise<Result<T, E>>`) that never reject on `.run()` while supporting synchronous lifecycle status inspection (`idle` | `pending` | `succeeded` | `failed`).
  - **`ADT`**: Zero-boilerplate factory and exhaustive pattern matcher for custom discriminated unions.
- **Common Algebraic Abstractions**: Consistent `Tagged`, `Mappable` (Functor), `Bimappable` (Bifunctor), `Chainable` (Monad), `Matchable` (Foldable), and `Unwrappable` interfaces across all types.
- **Tiny & Tree-Shakable**:
  - `"sideEffects": false` + subpath exports (`@luism/adt-ts/option`, `/result`, `/task`, `/adt`).
  - Strictly acyclic dependency graph: importing `Option` or `Result` never bundles `Task`.
  - Minified ESM and CJS outputs compiled with `@rslib/core`.
- **Node.js >= 16 Compatible**: Works across Node 16+, browsers, Deno, Bun, and Edge runtimes.

## Installation

```bash
pnpm add @luism/adt-ts
```

## Quick Start

### `Option<T>`

```ts
import { Option } from "@luism/adt-ts/option";

const port = Option.fromNullable(process.env.PORT)
  .map((raw) => Number.parseInt(raw, 10))
  .filter((n) => !Number.isNaN(n))
  .unwrapOr(3000);
```

### `Result<T, E>`

```ts
import { Result } from "@luism/adt-ts/result";

const parseJson = (raw: string) =>
  Result.tryCatch(
    () => JSON.parse(raw) as Record<string, unknown>,
    (err) => new Error(`Invalid JSON: ${String(err)}`),
  );

const message = parseJson('{"ok":true}').match({
  ok: (data) => `Parsed keys: ${Object.keys(data).join(", ")}`,
  err: (error) => `Error: ${error.message}`,
});
```

### `Task<T, E>`

```ts
import { Task } from "@luism/adt-ts/task";

const fetchNumber = Task.tryCatch(async () => 21);

const outcome = await fetchNumber.map((n) => n * 2).run(); // Promise<Result<number, Error>> (never throws!)

if (outcome.isOk()) {
  console.log(outcome.unwrap()); // 42
}
```

### Custom Tagged Unions (`ADT`)

```ts
import { ADT, type ADTUnion } from "@luism/adt-ts/adt";

type ShapeSpec = {
  Circle: { radius: number };
  Rectangle: { width: number; height: number };
  Point: {};
};

const Shape = ADT.define<ShapeSpec>();
type Shape = ADTUnion<ShapeSpec>;

const shape = Shape.Circle({ radius: 5 });

const area = Shape.match(shape, {
  Circle: ({ radius }) => Math.PI * radius ** 2,
  Rectangle: ({ width, height }) => width * height,
  Point: () => 0,
});
```
