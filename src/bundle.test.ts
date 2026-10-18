import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const distDir = resolve(import.meta.dirname, "../dist");

describe("Build Output, Minification & Tree-Shaking Isolation", () => {
  it("emits minified ESM, CJS, and bundled .d.ts files for all entry points", () => {
    const entries = ["index", "option", "result", "task", "adt"] as const;

    for (const entry of entries) {
      const esmPath = resolve(distDir, `esm/${entry}.js`);
      const cjsPath = resolve(distDir, `cjs/${entry}.cjs`);
      const dtsPath = resolve(distDir, `esm/${entry}.d.ts`);

      expect(existsSync(esmPath)).toBe(true);
      expect(existsSync(cjsPath)).toBe(true);
      expect(existsSync(dtsPath)).toBe(true);

      const esmContent = readFileSync(esmPath, "utf8");
      const dtsContent = readFileSync(dtsPath, "utf8");

      expect(esmContent.length).toBeGreaterThan(0);
      expect(dtsContent.length).toBeGreaterThan(0);
    }
  });

  it("keeps individual and total ESM bundles well within gzipped size budgets", () => {
    const budgetsBytes: Record<string, number> = {
      adt: 500, // < 0.5 KB gzipped
      option: 1200, // < 1.2 KB gzipped
      result: 1500, // < 1.5 KB gzipped
      task: 2200, // < 2.2 KB gzipped
      index: 2500, // < 2.5 KB gzipped for entire library
    };

    for (const [entry, maxGzipBytes] of Object.entries(budgetsBytes)) {
      const esmPath = resolve(distDir, `esm/${entry}.js`);
      const raw = readFileSync(esmPath);
      const gzipped = gzipSync(raw);

      expect(gzipped.byteLength).toBeLessThanOrEqual(maxGzipBytes);
    }
  });

  it("maintains strict one-way module isolation for tree-shaking", () => {
    const adtCode = readFileSync(resolve(distDir, "esm/adt.js"), "utf8");
    const optionCode = readFileSync(resolve(distDir, "esm/option.js"), "utf8");
    const resultCode = readFileSync(resolve(distDir, "esm/result.js"), "utf8");

    // adt.js should not bundle Option, Result, or Task
    expect(adtCode).not.toContain("UnwrapError");
    expect(adtCode).not.toContain("fromNullable");

    // option.js should not bundle Result or Task
    expect(optionCode).not.toContain("fromPromise");
    expect(optionCode).not.toContain("runOrThrow");
    expect(optionCode).not.toContain("SUCCEEDED");

    // result.js should not bundle Task
    expect(resultCode).not.toContain("runOrThrow");
    expect(resultCode).not.toContain("SUCCEEDED");
  });
});
