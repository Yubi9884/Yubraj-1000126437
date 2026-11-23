import { ZodError } from "zod";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/errors.js";

// Keep all four inputs: Express needs them to recognise this as an error handler.
export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  // Return the field paths and validation messages so clients can explain invalid input.
  if (error instanceof ZodError)
    return res.status(400).json({
      error: error.issues
        .map((issue) => `${issue.path.join(".") || "Input"}: ${issue.message}`)
        .join(" "),
      issues: error.issues,
    });
  // MongoDB error 11000 means a value already exists and must be unique.
  if (error.code === 11000)
    return res.status(409).json({
      error: "That record already exists. Please use a different value.",
    });
  const status =
    error.status || (error.type === "entity.parse.failed" ? 400 : 500);
  if (status >= 500) logger.error("request_failed", error);
  // Keep technical error details in the server log. Show the user a simple message.
  res.status(status).json({
    error:
      status >= 500 && !(error instanceof AppError)
        ? "Something went wrong on the server. Please try again."
        : error.message,
  });
};
