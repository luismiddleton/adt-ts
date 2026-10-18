import { describe, expect, it, test, vi } from "vitest";
import Option from "../option/Option";
import Result, { UnwrapError } from "./Result";

describe("Result", () => {
  // Backwards-compatibility suite from @luism/result-ts
  test("returns the shape of a valid result", () => {
    const result = Result.ok(5);

    expect(result.isOk()).toBeTruthy();
    expect(result.isErr()).toBeFalsy();
    expect(result.unwrap()).toBe(5);
    expect(result.unwrapOrDefault("fallback")).toBe(5);
  });

  test("returns the shape of an error", () => {
    const result = Result.err("some error");

    expect(result.isErr()).toBeTruthy();
    expect(result.isOk()).toBeFalsy();
    expect(() => result.unwrap()).toThrow(UnwrapError);
    expect(result.unwrapOrDefault("fallback")).toEqual("fallback");
  });

  it("supports static factories: of, fromOption, fromNullable, tryCatch, fromPromise", async () => {
    expect(Result.of(10).unwrap()).toBe(10);

    expect(Result.fromOption(Option.some(42), "missing").unwrap()).toBe(42);
    expect(Result.fromOption(Option.none(), () => "lazy err").unwrapErr()).toBe("lazy err");

    expect(Result.fromNullable("ok", "null").unwrap()).toBe("ok");
    expect(Result.fromNullable(null, "was null").unwrapErr()).toBe("was null");
    expect(Result.fromNullable(undefined, () => "lazy null").unwrapErr()).toBe("lazy null");

    expect(Result.tryCatch(() => 2 + 2).unwrap()).toBe(4);
    const errRes = Result.tryCatch(() => {
      throw new Error("boom");
    });
    expect(errRes.unwrapErr().message).toBe("boom");

    const nonErrorThrow = Result.tryCatch(() => {
      throw "raw string";
    });
    expect(nonErrorThrow.unwrapErr().message).toBe("raw string");

    const customMapped = Result.tryCatch(
      () => {
        throw new Error("bad");
      },
      () => "CUSTOM_ERR" as const,
    );
    expect(customMapped.unwrapErr()).toBe("CUSTOM_ERR");

    const asyncOk = await Result.fromPromise(Promise.resolve(99));
    expect(asyncOk.unwrap()).toBe(99);

    const asyncErr = await Result.fromPromise(Promise.reject(new Error("net fail")));
    expect(asyncErr.unwrapErr().message).toBe("net fail");

    const asyncMappedErr = await Result.fromPromise(
      Promise.reject("raw reject"),
      (e) => `wrapped:${String(e)}`,
    );
    expect(asyncMappedErr.unwrapErr()).toBe("wrapped:raw reject");

    const asyncDefaultNonErr = await Result.fromPromise(Promise.reject("plain reject"));
    expect(asyncDefaultNonErr.unwrapErr().message).toBe("plain reject");
  });

  it("satisfies Functor, Bifunctor, and Monad laws", () => {
    const ok = Result.ok<number, string>(10);
    const err = Result.err<string, number>("fail");

    expect(ok.map((x) => x * 2).unwrap()).toBe(20);
    expect(err.map((x) => x * 2).unwrapErr()).toBe("fail");

    expect(ok.mapErr((e) => e.toUpperCase()).unwrap()).toBe(10);
    expect(err.mapErr((e) => e.toUpperCase()).unwrapErr()).toBe("FAIL");

    expect(
      ok
        .bimap(
          (v) => v + 1,
          (e) => `${e}!`,
        )
        .unwrap(),
    ).toBe(11);
    expect(
      err
        .bimap(
          (v) => v + 1,
          (e) => `${e}!`,
        )
        .unwrapErr(),
    ).toBe("fail!");

    expect(ok.flatMap((v) => Result.ok(v + 5)).unwrap()).toBe(15);
    expect(ok.andThen((v) => Result.err(`bad:${v}`)).unwrapErr()).toBe("bad:10");
    expect(err.flatMap((v) => Result.ok(v + 5)).unwrapErr()).toBe("fail");

    expect(ok.orElse(() => Result.ok(0)).unwrap()).toBe(10);
    expect(err.orElse((e) => Result.ok(e.length)).unwrap()).toBe(4);
  });

  it("supports tap, tapErr, match/fold, expect, unwrapErr, unwrapOrElse, toOption, toErrOption", () => {
    const ok = Result.ok<number, string>(7);
    const err = Result.err<string, number>("oops");

    const okSpy = vi.fn();
    const errSpy = vi.fn();
    ok.tap(okSpy).tapErr(errSpy);
    err.tap(okSpy).tapErr(errSpy);
    expect(okSpy).toHaveBeenCalledWith(7);
    expect(errSpy).toHaveBeenCalledWith("oops");

    expect(ok.match({ ok: (v) => `ok:${v}`, err: (e) => `err:${e}` })).toBe("ok:7");
    expect(err.fold({ ok: (v) => `ok:${v}`, err: (e) => `err:${e}` })).toBe("err:oops");

    expect(ok.expect("should be ok")).toBe(7);
    expect(() => err.expect("custom expect")).toThrow("custom expect");
    expect(() => ok.unwrapErr()).toThrow(UnwrapError);

    expect(ok.unwrapOrElse(() => 0)).toBe(7);
    expect(err.unwrapOrElse((e) => e.length)).toBe(4);

    expect(ok.toOption().unwrap()).toBe(7);
    expect(err.toOption().isNone()).toBe(true);
    expect(ok.toErrOption().isNone()).toBe(true);
    expect(err.toErrOption().unwrap()).toBe("oops");
  });

  it("supports Result.all and Result.partition", () => {
    expect(Result.all([Result.ok(1), Result.ok(2), Result.ok(3)]).unwrap()).toEqual([1, 2, 3]);
    expect(Result.all([Result.ok(1), Result.err("bad"), Result.ok(3)]).unwrapErr()).toBe("bad");

    const [oks, errs] = Result.partition([
      Result.ok(1),
      Result.err("e1"),
      Result.ok(2),
      Result.err("e2"),
    ]);
    expect(oks).toEqual([1, 2]);
    expect(errs).toEqual(["e1", "e2"]);
  });
});
