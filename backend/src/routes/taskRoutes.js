import { Router } from "express";

// Attach task handlers to /api/tasks. Authentication runs in app.js before these routes.
export function createTaskRoutes(controller) {
  const router = Router();
  // GET reads, POST creates, PATCH edits and DELETE removes a task.
  // :id is the ID of the task to read or change.
  router.get("/", controller.list);
  router.get("/:id", controller.read);
  router.post("/", controller.create);
  router.patch("/:id", controller.update);
  router.delete("/:id", controller.remove);
  return router;
}
