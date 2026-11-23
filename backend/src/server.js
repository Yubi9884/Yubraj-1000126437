import { setup } from "../scripts/setup.mjs";
import dotenv from "dotenv";
import webpush from "web-push";
import { DatabaseConnection } from "./config/database.js";
import { API_SERVICE, createApp } from "./app.js";
import { logger } from "./utils/logger.js";
import { createServer } from "node:http";

// Read the bind settings early so the server can claim the port before full setup.
const { parsed: settings } = dotenv.config({ quiet: true, processEnv: {} });
const port = Number(process.env.PORT || settings?.PORT || 4000);
const host = process.env.HOST || settings?.HOST || "127.0.0.1";
const probeHost = { "0.0.0.0": "127.0.0.1", "::": "::1" }[host] || host;
const healthUrl = `http://${probeHost.includes(":") ? `[${probeHost}]` : probeHost}:${port}/api/health`;
let app;
let localMongo;
let shuttingDown;

// Claim the port before preparing the database so concurrent launches share one API.
const server = createServer((request, response) => {
  if (app) return app(request, response);
  response.writeHead(503, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Retry-After": "2",
  });
  response.end(JSON.stringify({
    service: API_SERVICE,
    status: "starting",
    message: "The backend is connecting to MongoDB. Please try again shortly.",
  }));
});

// If the port is occupied, use the health response to identify another StudyPass process.
async function existingApiStatus() {
  try {
    const response = await fetch(healthUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(1500),
    });
    const health = await response.json();
    if (health.service !== API_SERVICE) return;
    if (response.ok && health.status === "ok") return "already running";
    if (response.status === 503 && health.status === "starting") return "starting";
  } catch {
    // The listener may be another service or may have closed during the check.
  }
}

async function shutdown() {
  // If the server is already stopping, wait for it instead of stopping it again.
  if (!shuttingDown) {
    shuttingDown = (async () => {
      app?.locals.scheduler.stop();
      if (server.listening) {
        await new Promise((resolve) => {
          server.close(resolve);
          server.closeIdleConnections();
        });
      }
      try {
        await DatabaseConnection.close();
      } finally {
        await localMongo?.stop();
      }
    })();
  }
  return shuttingDown;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  // Close the reminder timer, server and database when the app is stopped.
  process.on(signal, async () => {
    await shutdown();
    process.exit(0);
  });
}

try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a number between 1 and 65535 in backend/.env.");
  }
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  server.on("error", async (error) => {
    logger.error("server_failed", error);
    await shutdown();
    process.exitCode = 1;
  });

  // Create any missing local settings, then load the environment used by the application.
  await setup();
  dotenv.config({ quiet: true });
  if (process.env.NODE_ENV === "production") process.env.ENABLE_DEMO = "false";
  // Local mode overrides the Atlas connection settings with the local MongoDB address.
  if (process.argv.includes("--local")) {
    const { connectLocalDatabase } = await import("./config/localDatabase.js");
    const { uri, mongo } = await connectLocalDatabase();
    localMongo = mongo;
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_USERNAME = "";
    process.env.MONGODB_PASSWORD = "";
  }
  const db = await DatabaseConnection.getConnection();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:developer@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  // Switch from the starting response to the Express API, then begin checking for reminders.
  app = createApp(db);
  console.log(`StudyPass API ready at ${healthUrl}`);
  app.locals.scheduler.start(
    Number(process.env.REMINDER_INTERVAL_MS || 60000),
  );
} catch (error) {
  if (error.code === "EADDRINUSE" && !server.listening) {
    const status = await existingApiStatus();
    if (status) {
      console.log(`StudyPass API is ${status}. Check ${healthUrl}`);
    } else {
      console.error(`StudyPass could not start because port ${port} is already in use by another process.`);
      process.exitCode = 1;
    }
  } else {
    logger.error("startup_failed", error);
    console.error("Check the backend README for database configuration and startup help.");
    process.exitCode = 1;
  }
  await shutdown();
}
