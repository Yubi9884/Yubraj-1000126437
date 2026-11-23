import { requireRecord } from "../utils/errors.js";
import { getTaskReminders } from "../utils/taskReminders.js";

// Format a saved task for the API and omit its internal revision counter.
function taskResponse(task) {
  const { revision, ...data } = task;
  const reminders = getTaskReminders(task);
  // Continue serving the original single-reminder fields to older clients.
  const legacy = reminders.find(
    ({ choice }) => choice === "day" || choice === "week",
  );
  return {
    ...data,
    reminders,
    reminder: legacy?.choice ?? "none",
    reminderAt: legacy?.at ?? null,
    reminderSent: legacy?.sent ?? false,
  };
}

// req holds the browser's request. Use res to send data back to the browser.
export function createTaskController(tasks, planner) {
  return {
    // Use the account ID attached by authentication for every task read and write.
    list: async (req, res) =>
      res.json({ tasks: (await tasks.findForUser(req.userId)).map(taskResponse) }),
    read: async (req, res) =>
      res.json({
        task: taskResponse(
          requireRecord(await tasks.findOne(req.params.id, req.userId)),
        ),
      }),
    create: async (req, res) =>
      res
        .status(201)
        .json({ task: taskResponse(await planner.createTask(req.body, req.userId)) }),
    update: async (req, res) =>
      res.json({
        task: taskResponse(await planner.updateTask(req.params.id, req.body, req.userId)),
      }),
    // Wait for the delete to complete before sending HTTP 204 with an empty body.
    remove: async (req, res) => {
      await planner.deleteTask(req.params.id, req.userId);
      res.status(204).end();
    },
  };
}
