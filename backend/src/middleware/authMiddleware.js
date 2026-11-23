import jwt from "jsonwebtoken";
import { AppError } from "../utils/errors.js";

// Send safe account details to the browser. Never include the password hash.
export function publicUser(user) {
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    provider: user.provider,
    demo: user.demo || false,
  };
}
// Create a signed login token that expires after eight hours.
export function issueToken(user, secret) {
  return jwt.sign({ sub: String(user._id) }, secret, {
    algorithm: "HS256",
    issuer: "studypass-nz",
    audience: "studypass-client",
    expiresIn: "8h",
  });
}
// Check the login token and find the account. Let the next function use its user ID.
export function authMiddleware(users, secret) {
  return async (req, res, next) => {
    try {
      const [scheme, token] = (req.headers.authorization || "").split(" ");
      if (scheme !== "Bearer" || !token)
        throw new AppError(401, "Please sign in to continue.");
      let payload;
      try {
        // Verify the signature, expiration, issuer, and audience before trusting the user ID.
        payload = jwt.verify(token, secret, {
          algorithms: ["HS256"],
          issuer: "studypass-nz",
          audience: "studypass-client",
        });
      } catch {
        throw new AppError(
          401,
          "Your session has expired. Please sign in again.",
        );
      }
      req.user = await users.findById(payload.sub);
      if (!req.user) throw new AppError(401, "Please sign in to continue.");
      // Store the verified account ID on the request for controllers and ownership checks.
      req.userId = String(req.user._id);
      next();
    } catch (error) {
      next(error);
    }
  };
}
