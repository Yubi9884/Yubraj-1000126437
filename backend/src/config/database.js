import { MongoClient } from "mongodb";
import { logger } from "../utils/logger.js";

// Singleton pattern: share one MongoDB client across the app.
export class DatabaseConnection {
  static pending;
  static client;

  static async getConnection() {
    // If a connection is already starting, wait for it instead of starting another.
    if (!this.pending)
      this.pending = this.connect().catch((error) => {
        // Clear the failed connection promise so the next call can retry.
        this.pending = undefined;
        throw error;
      });
    return this.pending;
  }

  static async connect() {
    // Read the Atlas address from .env. A missing address is a setup error.
    const uri = process.env.MONGODB_URI?.trim();
    if (!uri) {
      throw new Error(
        "Add your MongoDB Atlas connection string to MONGODB_URI in backend/.env.",
      );
    }
    // Separate login fields allow passwords with symbols without changing the address.
    const username = process.env.MONGODB_USERNAME?.trim();
    const password = process.env.MONGODB_PASSWORD;
    if (username && !password) {
      throw new Error(
        "Add your Atlas database user's password to MONGODB_PASSWORD in backend/.env.",
      );
    }
    this.client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 15000,
      ...(username ? { auth: { username, password } } : {}),
    });
    await this.client.connect();
    const db = this.client.db(process.env.MONGODB_DATABASE || "studypass");
    // Indexes make searches faster. Unique indexes also stop duplicate account details.
    await Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("users").createIndex(
        { googleId: 1 },
        {
          unique: true,
          // Only Google accounts have this identifier, so other accounts are outside the unique index.
          partialFilterExpression: { googleId: { $type: "string" } },
        },
      ),
      db.collection("tasks").createIndex({ userId: 1, dueDate: 1 }),
      db.collection("tasks").createIndex({ reminderSent: 1, reminderAt: 1 }),
      db.collection("tasks").createIndex({ "reminders.sent": 1, "reminders.at": 1 }),
      db.collection("checklists").createIndex({ userId: 1 }),
      db
        .collection("pushSubscriptions")
        .createIndex({ endpoint: 1 }, { unique: true }),
    ]);
    logger.info("database_connected", { database: db.databaseName });
    return db;
  }

  // Close MongoDB during shutdown and reset the shared connection state.
  static async close() {
    await this.client?.close();
    this.client = undefined;
    this.pending = undefined;
  }
}
