import { Router } from "express";

// Attach sign-in handlers to the /api/auth prefix registered in app.js.
export function createAuthRoutes(controller, authenticate) {
  const router = Router();
  // Anyone can sign in. Reading /me needs a valid login token.
  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.post("/google", controller.google);
  router.post("/demo", controller.demo);
  router.get("/me", authenticate, controller.me);
  return router;
}
