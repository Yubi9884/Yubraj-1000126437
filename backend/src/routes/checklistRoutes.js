import { Router } from "express";

// Attach collection and individual-record handlers to /api/checklists.
export function createChecklistRoutes(controller) {
  const router = Router();
  // app.js checks the login token before these checklist requests run.
  router.get("/", controller.list);
  router.get("/:id", controller.read);
  router.post("/", controller.create);
  router.patch("/:id", controller.update);
  router.delete("/:id", controller.remove);
  return router;
}
