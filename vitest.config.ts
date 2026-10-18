import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    watch: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/core/**/*.ts",
        "src/adt/**/*.ts",
        "src/option/**/*.ts",
        "src/result/**/*.ts",
        "src/task/**/*.ts",
      ],
      exclude: ["src/**/*.test.ts", "src/**/index.ts"],
    },
  },
});
