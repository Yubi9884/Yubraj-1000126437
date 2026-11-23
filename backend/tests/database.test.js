import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseConnection } from "../src/config/database.js";

// Reset the shared connection and restore environment settings between cases.
afterEach(async () => {
  await DatabaseConnection.close();
  vi.unstubAllEnvs();
});

// Verify configuration errors before the app attempts a database connection.
describe("Database connection settings", () => {
  it.each([undefined, "", "   "])(
    "reports a missing Atlas address instead of starting a local database (%j)",
    async (uri) => {
      vi.stubEnv("MONGODB_URI", uri);
      await expect(DatabaseConnection.getConnection()).rejects.toThrow(
        "Add your MongoDB Atlas connection string to MONGODB_URI in backend/.env.",
      );
    },
  );

  it("reports a missing database password before attempting a connection", async () => {
    vi.stubEnv("MONGODB_URI", "mongodb+srv://cluster.example.mongodb.net/");
    vi.stubEnv("MONGODB_USERNAME", "test-user");
    vi.stubEnv("MONGODB_PASSWORD", "");
    await expect(DatabaseConnection.getConnection()).rejects.toThrow(
      "Add your Atlas database user's password to MONGODB_PASSWORD in backend/.env.",
    );
  });
});
