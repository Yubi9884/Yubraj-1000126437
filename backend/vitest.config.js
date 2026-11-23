import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // Allow extra time for integration tests to start and stop a local MongoDB process.
    testTimeout: 60000,
    hookTimeout: 180000,
    // Run test files serially so startup and database suites run one after the other.
    fileParallelism: false,
  },
});
