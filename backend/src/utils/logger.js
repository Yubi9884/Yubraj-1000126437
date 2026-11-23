// Print one log entry per line to make server activity and errors easier to read.
export const logger = {
  info(event, details = {}) {
    console.log(
      JSON.stringify({
        level: "info",
        event,
        ...details,
        time: new Date().toISOString(),
      }),
    );
  },
  // Use the error stream for failures and keep the timestamp in a consistent UTC format.
  error(event, error) {
    console.error(
      JSON.stringify({
        level: "error",
        event,
        message: error.message,
        time: new Date().toISOString(),
      }),
    );
  },
};
