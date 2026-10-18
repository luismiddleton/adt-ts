# adt-ts

A TypeScript library for Algebraic Data Types (ADTs).

## Features

- **Safe Optional Values (`Option`)**: Handle missing values gracefully without worrying about unexpected `null` or `undefined` runtime errors.
- **Predictable Error Handling (`Result`)**: Represent operations that can succeed or fail explicitly without relying on thrown exceptions.
- **Controlled Async Operations (`Task`)**: Manage asynchronous work that runs only when you ask it to, never crashes unexpectedly, and lets you check progress along the way.
- **Custom Data Shapes (`ADT`)**: Easily build your own custom data models with built-in pattern matching to handle every possible case.
- **Consistent & Composable**: Every type shares a familiar API (`map`, `flatMap`, `match`, and fallback helpers) so learning one makes using all the others second nature.
- **Broad Compatibility**: Built for Node.js 16+ and fully compatible with modern browsers, Deno, Bun, and Edge runtimes.

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
