import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  TaskRepository,
  ChecklistRepository,
  UserRepository,
  PushSubscriptionRepository,
} from "./repositories/index.js";
import { PlannerService } from "./services/planner.js";
import { PushNotifier, ReminderScheduler } from "./services/notifications.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createAuthController } from "./controllers/authController.js";
import { createTaskController } from "./controllers/taskController.js";
import { createChecklistController } from "./controllers/checklistController.js";
import { createPushController } from "./controllers/pushController.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createTaskRoutes } from "./routes/taskRoutes.js";
import { createChecklistRoutes } from "./routes/checklistRoutes.js";
import { createPushRoutes } from "./routes/pushRoutes.js";
import { AppError } from "./utils/errors.js";
import { logger } from "./utils/logger.js";

export const API_SERVICE = "StudyPass NZ API";

// Build the Express API around a supplied MongoDB database. Tests can pass their own database and options.
export function createApp(database, options = {}) {
  const app = express();
  const secret = options.jwtSecret || process.env.JWT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "Run npm run setup in the backend folder to generate JWT_SECRET.",
    );

  // Repositories read and save data. Services check the data and apply app rules.
  const users = new UserRepository(database);
  const tasks = new TaskRepository(database);
  const checklists = new ChecklistRepository(database);
  const subscriptions = new PushSubscriptionRepository(database);
  const planner = new PlannerService(tasks, checklists);
  const notifier = options.notifier || new PushNotifier(subscriptions);
  // Check who is signed in before allowing access to their data.
  const authenticate = authMiddleware(users, secret);
  // Keep the reminder timer here so server.js can start and stop it.
  app.locals.scheduler = new ReminderScheduler(tasks, notifier);

  // Apply security headers, restrict browser origins, and limit the size of incoming JSON.
  app.disable("x-powered-by");
  app.use(
    helmet({ crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" } }),
  );
  const origins = (
    process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((value) => value.trim());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) return callback(null, true);
        callback(new AppError(403, "This origin is not allowed."));
      },
    }),
  );
  app.use(express.json({ limit: "48kb" }));
  app.use("/api", (request, response, next) => {
    // Tell the browser not to save API replies. Log how long each request takes.
    response.setHeader("Cache-Control", "no-store");
    const started = Date.now();
    const path = request.originalUrl.split("?")[0];
    response.on("finish", () => {
      if (path !== "/api/health")
        logger.info("request", {
          method: request.method,
          path,
          status: response.statusCode,
          durationMs: Date.now() - started,
        });
    });
    next();
  });
  if (options.rateLimits !== false) {
    // Block too many requests in a short time, especially repeated sign-in attempts.
    app.use(
      "/api",
      rateLimit({
        windowMs: 60000,
        limit: 240,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: "Too many requests. Please wait a moment." },
      }),
    );
    app.use(
      "/api/auth",
      rateLimit({
        windowMs: 15 * 60000,
        limit: 40,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: {
          error: "Too many sign-in attempts. Please try again in 15 minutes.",
        },
      }),
    );
  }

  app.get("/", (request, response) =>
    response.json({
      service: "StudyPass NZ backend",
      health: "/api/health",
      frontend: "http://127.0.0.1:5173",
    }),
  );
  // The health endpoint pings MongoDB so a successful response confirms the database is reachable.
  app.get("/api/health", async (request, response) => {
    await database.command({ ping: 1 });
    response.json({
      status: "ok",
      database: "connected",
      service: API_SERVICE,
    });
  });
  // Expose the public settings the frontend needs to show optional sign-in and push features.
  app.get("/api/config", (request, response) =>
    response.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
      demoEnabled: process.env.ENABLE_DEMO === "true",
    }),
  );

  // Match each API address to the function that handles its request.
  app.use(
    "/api/auth",
    createAuthRoutes(
      createAuthController(users, planner, secret),
      authenticate,
    ),
  );
  app.use(
    "/api/tasks",
    authenticate,
    createTaskRoutes(createTaskController(tasks, planner)),
  );
  app.use(
    "/api/checklists",
    authenticate,
    createChecklistRoutes(createChecklistController(checklists, planner)),
  );
  app.use(
    "/api/push",
    authenticate,
    createPushRoutes(createPushController(subscriptions, notifier)),
  );
  app.use((request, response) =>
    response.status(404).json({ error: "That API endpoint does not exist." }),
  );
  // Put error handling last so it can catch errors from the routes above.
  app.use(errorHandler);
  return app;
}
