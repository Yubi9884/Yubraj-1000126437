import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AppError } from "../utils/errors.js";
import { registerSchema, loginSchema } from "../services/validation.js";
import { seedWorkspace } from "../services/seed.js";
import { issueToken, publicUser } from "../middleware/authMiddleware.js";

// Handle sign-in methods and return the same session format for each successful login.
export function createAuthController(users, planner, secret) {
  // After sign-in, return safe account details and a login token to the browser.
  const session = (user) => ({
    user: publicUser(user),
    token: issueToken(user, secret),
  });
  return {
    // Validate the registration fields and check for an existing account before creating one.
    register: async (req, res) => {
      const data = registerSchema.parse(req.body);
      if (await users.findByEmail(data.email))
        throw new AppError(
          409,
          "An account already uses that email. Please sign in.",
        );
      // Save a password hash: a value used to check passwords without storing the password.
      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await users.create({
        name: data.name,
        email: data.email,
        passwordHash,
        provider: "password",
      });
      res.status(201).json(session(user));
    },
    login: async (req, res) => {
      const data = loginSchema.parse(req.body);
      const user = await users.findByEmail(data.email);
      // Check a hash even if the email is missing, to make response times harder to compare.
      const valid = await bcrypt.compare(
        data.password,
        user?.passwordHash ||
          "$2b$12$VDsPD3.8q9bYjlk6pH1RXeVRWwOkzbI9IhhFJO6gKFXzXHs6hplH.",
      );
      if (!user || !user.passwordHash || !valid)
        throw new AppError(401, "The email or password is incorrect.");
      res.json(session(user));
    },
    google: async (req, res) => {
      if (!process.env.GOOGLE_CLIENT_ID)
        throw new AppError(
          503,
          "Google sign-in has not been configured. Use email sign-in instead.",
        );
      const { credential } = z
        .object({ credential: z.string().min(20).max(10000) })
        .strict()
        .parse(req.body);
      let identity;
      try {
        // Check that Google's login token is valid and was issued for this app.
        const ticket = await new OAuth2Client(
          process.env.GOOGLE_CLIENT_ID,
        ).verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        identity = ticket.getPayload();
      } catch {
        throw new AppError(
          401,
          "Google could not verify your sign-in. Please try again.",
        );
      }
      if (!identity?.sub || !identity.email || !identity.email_verified)
        throw new AppError(401, "Use a verified Google account.");
      // Use the Google subject as the account identifier and keep an existing email account on its original sign-in method.
      let user = await users.findByGoogleId(identity.sub);
      if (!user) {
        if (await users.findByEmail(identity.email.toLowerCase()))
          throw new AppError(
            409,
            "This email has an existing account. Use its original sign-in method.",
          );
        user = await users.create({
          name: identity.name || "Student",
          email: identity.email.toLowerCase(),
          googleId: identity.sub,
          provider: "google",
        });
      }
      res.json(session(user));
    },
    demo: async (req, res) => {
      if (process.env.ENABLE_DEMO !== "true")
        throw new AppError(404, "Sample workspaces are disabled.");
      // Create a new sample account with its own example tasks and checklists.
      const user = await users.create({
        name: "Yubraj Thapa",
        email: `sample-${randomUUID()}@studypass.local`,
        provider: "demo",
        demo: true,
      });
      await seedWorkspace(planner, String(user._id));
      res.status(201).json(session(user));
    },
    me: (req, res) => res.json({ user: publicUser(req.user) }),
  };
}
