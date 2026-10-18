import { describe, expect, it, vi } from "vitest";
import { UnwrapError } from "../core/errors";
import Option from "./Option";

const double = (x: number) => x * 2;
const addThree = (x: number) => x + 3;
const monadicDouble = (x: number) => (x > 0 ? Option.some(x * 2) : Option.none<number>());
const monadicAddTen = (x: number) => Option.some(x + 10);

describe("Option", () => {
  it("constructs Some and singleton None", () => {
    const some = Option.some(42);
    const ofVal = Option.of("abc");
    const none1 = Option.none<number>();
    const none2 = Option.none<string>();

    expect(some.isSome()).toBe(true);
    expect(some.isNone()).toBe(false);
    expect(some._tag).toBe("some");
    expect(ofVal.unwrap()).toBe("abc");

    expect(none1.isNone()).toBe(true);
    expect(none1.isSome()).toBe(false);
    expect(none1._tag).toBe("none");
    // Singleton check: zero extra allocation on Option.none()
    expect(none1).toBe(none2);
  });

  it("constructs fromNullable, fromPredicate, and tryCatch", () => {
    expect(Option.fromNullable(0).unwrap()).toBe(0);
    expect(Option.fromNullable("").unwrap()).toBe("");
    expect(Option.fromNullable(null).isNone()).toBe(true);
    expect(Option.fromNullable(undefined).isNone()).toBe(true);

    expect(Option.fromPredicate(10, (n) => n > 5).unwrap()).toBe(10);
    expect(Option.fromPredicate(2, (n) => n > 5).isNone()).toBe(true);

    expect(Option.tryCatch(() => JSON.parse('{"a":1}')).unwrap()).toEqual({ a: 1 });
    expect(Option.tryCatch(() => JSON.parse("{invalid")).isNone()).toBe(true);
  });

  it("satisfies Functor and Monad laws", () => {
    const fa = Option.some(5);
    // Functor identity
    expect(fa.map((x) => x).unwrap()).toBe(fa.unwrap());
    // Functor composition
    expect(fa.map(double).map(addThree).unwrap()).toBe(fa.map((x) => addThree(double(x))).unwrap());

    // Monad left identity
    expect(Option.of(5).flatMap(monadicDouble).unwrap()).toBe(monadicDouble(5).unwrap());
    // Monad right identity
    expect(fa.flatMap(Option.of).unwrap()).toBe(fa.unwrap());
    // Monad associativity
    expect(fa.flatMap(monadicDouble).flatMap(monadicAddTen).unwrap()).toBe(
      fa.flatMap((x) => monadicDouble(x).flatMap(monadicAddTen)).unwrap(),
    );

    // None propagation
    const empty = Option.none<number>();
    expect(empty.map(double).isNone()).toBe(true);
    expect(empty.flatMap(monadicDouble).isNone()).toBe(true);
    expect(fa.andThen(monadicDouble).unwrap()).toBe(10);
  });

  it("supports filter, or, orElse, zip, tap, and match/fold", () => {
    const some = Option.some(10);
    const none = Option.none<number>();

    expect(some.filter((x) => x === 10).unwrap()).toBe(10);
    expect(some.filter((x) => x > 20).isNone()).toBe(true);
    expect(none.filter(() => true).isNone()).toBe(true);

    expect(some.or(Option.some(99)).unwrap()).toBe(10);
    expect(none.or(Option.some(99)).unwrap()).toBe(99);

    expect(some.orElse(() => Option.some(99)).unwrap()).toBe(10);
    expect(none.orElse(() => Option.some(99)).unwrap()).toBe(99);

    expect(some.zip(Option.some("a")).unwrap()).toEqual([10, "a"]);
    expect(some.zip(Option.none()).isNone()).toBe(true);
    expect(none.zip(Option.some("a")).isNone()).toBe(true);

    const spy = vi.fn();
    some.tap(spy);
    none.tap(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(10);

    expect(some.match({ some: (v) => v + 1, none: () => 0 })).toBe(11);
    expect(none.fold({ some: (v) => v + 1, none: () => 0 })).toBe(0);
  });

  it("supports unwrap, expect, unwrapOr, unwrapOrDefault, unwrapOrElse, toNullable, toUndefined", () => {
    const some = Option.some("value");
    const none = Option.none<string>();

    expect(some.unwrap()).toBe("value");
    expect(some.expect("must exist")).toBe("value");
    expect(() => none.unwrap()).toThrow(UnwrapError);
    expect(() => none.expect("custom msg")).toThrow("custom msg");

    expect(some.unwrapOr("fallback")).toBe("value");
    expect(none.unwrapOr("fallback")).toBe("fallback");
    expect(none.unwrapOrDefault("fallback")).toBe("fallback");
    expect(some.unwrapOrElse(() => "lazy")).toBe("value");
    expect(none.unwrapOrElse(() => "lazy")).toBe("lazy");

    expect(some.toNullable()).toBe("value");
    expect(none.toNullable()).toBeNull();
    expect(some.toUndefined()).toBe("value");
    expect(none.toUndefined()).toBeUndefined();
  });

  it("combines collections with Option.all and Option.any", () => {
    expect(Option.all([Option.some(1), Option.some(2)]).unwrap()).toEqual([1, 2]);
    expect(Option.all([Option.some(1), Option.none()]).isNone()).toBe(true);

    expect(Option.any([Option.none<number>(), Option.some(7), Option.some(8)]).unwrap()).toBe(7);
    expect(Option.any([Option.none(), Option.none()]).isNone()).toBe(true);
  });
});
