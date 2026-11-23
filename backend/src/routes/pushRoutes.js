import { Router } from "express";

// Attach device registration and test handlers to /api/push.
export function createPushRoutes(controller) {
  const router = Router();
  // Signed-in users can add or remove a reminder device and send a test reminder.
  router.get("/subscriptions", controller.count);
  router.post("/subscribe", controller.subscribe);
  router.delete("/subscribe", controller.unsubscribe);
  router.post("/test", controller.test);
  return router;
}
