// Give an expected error a status number and a message to show the user.
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    // The Express error handler reads this status to choose the HTTP response code.
    this.status = status;
  }
}

// Return 404 (not found) if the item is missing or belongs to another user.
export function requireRecord(
  record,
  message = "This record was not found in your workspace.",
) {
  if (!record) throw new AppError(404, message);
  return record;
}
