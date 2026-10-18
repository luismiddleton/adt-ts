import { describe, expect, it, vi } from "vitest";
import Option from "../option/Option";
import Result from "../result/Result";
import { Task, TaskStatus } from "./Task";

describe("Task", () => {
  it("starts in IDLE when constructed lazily and transitions through PENDING to SUCCEEDED", async () => {
    let resolveInner!: (val: number) => void;
    const task = new Task<number>((resolve) => {
      resolveInner = resolve;
    });

    expect(task).toBeInstanceOf(Task);
    expect(task.getStatus()).toBe(TaskStatus.IDLE);
    expect(task.isIdle()).toBe(true);
    expect(task.isPending()).toBe(false);
    expect(task.isSucceeded()).toBe(false);
    expect(task.isFailed()).toBe(false);
    expect(task.getResult()).toBeUndefined();
    expect(task.getError()).toBeUndefined();
    expect(task.toResult().isNone()).toBe(true);

    const runningPromise = task.run();
    expect(task.getStatus()).toBe(TaskStatus.PENDING);
    expect(task.isPending()).toBe(true);

    resolveInner(42);
    const outcome = await runningPromise;

    expect(outcome.isOk()).toBe(true);
    expect(outcome.unwrap()).toBe(42);
    expect(task.getStatus()).toBe(TaskStatus.SUCCEEDED);
    expect(task.getResult()).toBe(42);
    expect(task.getError()).toBeUndefined();
    expect(task.isSucceeded()).toBe(true);
    expect(task.isPending()).toBe(false);
    expect(task.isFailed()).toBe(false);
    expect(task.toResult().unwrap().unwrap()).toBe(42);
  });

  it("transitions to FAILED and resolves to Result.err without throwing on run()", async () => {
    const error = new Error("fail");
    const task = new Task<number>((_, reject) => {
      reject(error);
    });

    let onRejectedCalledWith: Error | undefined;
    const outcome = await task.run(
      () => {},
      (err) => {
        onRejectedCalledWith = err;
      },
    );

    expect(outcome.isErr()).toBe(true);
    expect(outcome.unwrapErr()).toBe(error);
    expect(onRejectedCalledWith).toBe(error);
    expect(task.getStatus()).toBe(TaskStatus.FAILED);
    expect(task.getResult()).toBeUndefined();
    expect(task.getError()).toBe(error);
    expect(task.isFailed()).toBe(true);
    expect(task.isPending()).toBe(false);
    expect(task.isSucceeded()).toBe(false);
    expect(task.toResult().unwrap().unwrapErr()).toBe(error);
  });

  it("creates pre-settled success and failure Tasks via static methods", async () => {
    const okTask = Task.success(99);
    expect(okTask.getStatus()).toBe(TaskStatus.SUCCEEDED);
    expect(okTask.getResult()).toBe(99);
    expect(okTask.isSucceeded()).toBe(true);
    expect((await okTask.run()).unwrap()).toBe(99);
    expect(await Task.ok(12).runOrThrow()).toBe(12);
    expect(await Task.of(15).runOrThrow()).toBe(15);

    const err = new Error("static fail");
    const failTask = Task.failure<number>(err);
    expect(failTask.getStatus()).toBe(TaskStatus.FAILED);
    expect(failTask.getError()).toBe(err);
    expect(failTask.isFailed()).toBe(true);
    await expect(failTask.runOrThrow()).rejects.toThrow("static fail");

    let caught: Error | undefined;
    await failTask.catch((e) => {
      caught = e;
    });
    expect(caught).toBe(err);
    expect((await Task.err("custom err").run()).unwrapErr()).toBe("custom err");
  });

  it("supports Task.tryCatch, Task.fromResult, and Task.fromOption", async () => {
    const okTask = Task.tryCatch(async () => "loaded");
    expect((await okTask.run()).unwrap()).toBe("loaded");

    const errTask = Task.tryCatch(
      async () => {
        throw new Error("network down");
      },
      (e) => `mapped:${(e as Error).message}`,
    );
    expect((await errTask.run()).unwrapErr()).toBe("mapped:network down");

    const defaultErrTask = Task.tryCatch(() => {
      throw "plain failure";
    });
    expect((await defaultErrTask.run()).unwrapErr().message).toBe("plain failure");

    const fromResOk = Task.fromResult(Result.ok(5));
    expect(fromResOk.isSucceeded()).toBe(true);

    const fromOptNone = Task.fromOption(Option.none<number>(), "none_error");
    expect(fromOptNone.isFailed()).toBe(true);
    expect(fromOptNone.getError()).toBe("none_error");
  });

  it("supports lazy combinators: map, mapErr, bimap, flatMap/andThen, orElse, tap, tapErr, match/fold", async () => {
    const spyOk = vi.fn();
    const spyErr = vi.fn();

    const pipeline = Task.of<number, string>(10)
      .map((x) => x * 2)
      .tap(spyOk)
      .flatMap((x) => Task.ok<number, string>(x + 5))
      .andThen((x) => Result.ok<number, string>(x + 1));

    // Confirm laziness: spyOk not called before .run()
    expect(spyOk).not.toHaveBeenCalled();

    const formatted = await pipeline.match({
      ok: (v) => `value:${v}`,
      err: (e) => `err:${e}`,
    });
    expect(spyOk).toHaveBeenCalledWith(20);
    expect(formatted).toBe("value:26");

    const errPipeline = Task.err<string, number>("initial")
      .map((x) => x + 1)
      .mapErr((e) => `${e}_mapped`)
      .tapErr(spyErr)
      .bimap(
        (v) => v,
        (e) => `${e}!`,
      )
      .orElse((e) => Task.ok<number, string>(e.length));

    expect(await errPipeline.fold({ ok: (v) => v, err: () => -1 })).toBe(15);
    expect(spyErr).toHaveBeenCalledWith("initial_mapped");
  });

  it("supports concurrency utilities: Task.all, Task.sequence, and Task.race", async () => {
    const order: number[] = [];
    const makeTask = (n: number, delayMs: number) =>
      Task.tryCatch(
        () =>
          new Promise<number>((resolve) =>
            setTimeout(() => {
              order.push(n);
              resolve(n);
            }, delayMs),
          ),
      );

    const allRes = await Task.all([Task.of(1), Task.of(2), Task.of(3)]).run();
    expect(allRes.unwrap()).toEqual([1, 2, 3]);

    const seqRes = await Task.sequence([makeTask(1, 15), makeTask(2, 5)]).run();
    expect(seqRes.unwrap()).toEqual([1, 2]);
    expect(order).toEqual([1, 2]);

    const seqFail = await Task.sequence([
      Task.of<number, string>(1),
      Task.err<string, number>("stop"),
      Task.of<number, string>(3),
    ]).run();
    expect(seqFail.unwrapErr()).toBe("stop");

    const raceRes = await Task.race([makeTask(10, 40), makeTask(20, 5)]).run();
    expect(raceRes.unwrap()).toBe(20);
  });

  it("handles synchronous throws, async executor rejections, and bimap/orElse on Ok tasks", async () => {
    const syncThrowTask = new Task<number>(() => {
      throw new Error("sync executor throw");
    });
    expect((await syncThrowTask.run()).unwrapErr().message).toBe("sync executor throw");

    const asyncRejectExecutor = new Task<number>(async () => {
      throw new Error("async executor throw");
    });
    expect((await asyncRejectExecutor.run()).unwrapErr().message).toBe("async executor throw");

    const fromThrowThunk = Task.from<number, Error>(() => {
      throw new Error("thunk throw");
    });
    expect((await fromThrowThunk.run()).unwrapErr().message).toBe("thunk throw");

    const okBimapOrElse = await Task.ok<number, string>(5)
      .bimap(
        (v) => v * 3,
        (e) => e,
      )
      .orElse(() => Result.ok(0))
      .run();
    expect(okBimapOrElse.unwrap()).toBe(15);

    const errFlatMapShortCircuit = await Task.err<string, number>("short")
      .flatMap((v) => Task.ok(v + 1))
      .run();
    expect(errFlatMapShortCircuit.unwrapErr()).toBe("short");
  });
});
