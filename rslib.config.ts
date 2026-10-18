import { defineConfig } from "@rslib/core";

const sharedMinify = {
  js: true,
  jsOptions: {
    minimizerOptions: {
      mangle: true,
      minify: true,
      compress: {
        toplevel: true,
        passes: 2,
        pure_getters: true,
      },
    },
  },
} as const;

const entries = {
  index: "./src/index.ts",
  option: "./src/option/index.ts",
  result: "./src/result/index.ts",
  task: "./src/task/index.ts",
  adt: "./src/adt/index.ts",
};

export default defineConfig({
  source: {
    entry: entries,
  },
  lib: [
    {
      format: "esm",
      syntax: ["node 16"],
      dts: {
        bundle: true,
      },
      output: {
        minify: sharedMinify,
        distPath: {
          root: "./dist/esm",
        },
      },
    },
    {
      format: "cjs",
      syntax: ["node 16"],
      output: {
        minify: sharedMinify,
        distPath: {
          root: "./dist/cjs",
        },
      },
    },
  ],
});
