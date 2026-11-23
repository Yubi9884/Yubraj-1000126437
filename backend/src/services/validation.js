import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AppError } from "../utils/errors.js";
import { getTaskReminders, REMINDER_OFFSETS } from "../utils/taskReminders.js";

// Zod checks the input values. strict() rejects any fields we have not allowed.
export const taskSchema = z
  .object({
    title: z.string().trim().min(1, "Add a task title.").max(120),
    description: z.string().trim().max(1000),
    dueDate: z.string().datetime({ offset: true }),
    priority: z.enum(["low", "medium", "high"]),
    category: z.enum(["study", "personal", "admin"]),
    status: z.enum(["open", "completed"]),
    reminder: z.enum(["none", "day", "week"]).optional(),
    reminders: z
      .array(z.enum(Object.keys(REMINDER_OFFSETS)))
      .max(Object.keys(REMINDER_OFFSETS).length)
      .refine((choices) => new Set(choices).size === choices.length, {
        message: "Choose each reminder time only once.",
      })
      .optional(),
    checklistId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .nullable(),
  })
  .strict();

// Apply these values when the client omits optional task fields on creation.
export const taskDefaults = {
  description: "",
  priority: "medium",
  category: "study",
  status: "open",
  checklistId: null,
};

// Compute the reminder time relative to the deadline in UTC.
export function calculateReminder(dueDate, choice) {
  if (choice === "none") return null;
  if (!Object.hasOwn(REMINDER_OFFSETS, choice))
    throw new AppError(400, "Choose a valid reminder.");
  return new Date(new Date(dueDate).getTime() - REMINDER_OFFSETS[choice]);
}

// Add the changes to the saved task, then check the full result.
export function validateTask(input, existing = null, now = new Date()) {
  // An edit can change one field, but it cannot add unknown fields.
  const patch = taskSchema.partial().parse(input);
  // Copy only fields the user can edit. Leave out database IDs and the owner.
  const old = existing
    ? Object.fromEntries(
        Object.keys(taskDefaults)
          .concat(["title", "dueDate"])
          .map((key) => [
            key,
            key === "dueDate" ? existing.dueDate.toISOString() : existing[key],
          ]),
      )
    : {};
  const { reminder, reminders, ...data } = taskSchema.parse({
    ...taskDefaults,
    ...old,
    ...patch,
  });
  data.dueDate = new Date(data.dueDate);
  const dateChanged = !existing || +data.dueDate !== +existing.dueDate;
  // Allow an overdue task to be marked complete if its deadline stays the same.
  if (dateChanged && data.dueDate <= now)
    throw new AppError(400, "Choose a deadline in the future.");
  if (reminder !== undefined && reminders !== undefined)
    throw new AppError(
      400,
      "Provide either a single reminder or a list of reminders.",
    );
  const previous = existing ? getTaskReminders(existing) : [];
  const choices = new Set(reminders ?? previous.map(({ choice }) => choice));
  // Translate the single-reminder format into the same set used by the newer API.
  if (reminder !== undefined) {
    choices.clear();
    if (reminder !== "none") choices.add(reminder);
  }

  data.reminders = Object.keys(REMINDER_OFFSETS)
    .filter((choice) => choices.has(choice))
    .map((choice) => {
      // Keep the original time and sent status when both the deadline and reminder choice are unchanged.
      const unchanged = !dateChanged && previous.find(
        (entry) => entry.choice === choice,
      );
      if (unchanged) return unchanged;
      const at = calculateReminder(data.dueDate, choice);
      if (at <= now)
        throw new AppError(
          400,
          "That reminder time has passed. Choose a closer reminder or a later deadline.",
        );
      return { choice, at, sent: false };
    });
  return data;
}

const itemSchema = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().trim().min(1, "Each item needs a name.").max(160),
    done: z.boolean().optional(),
  })
  .strict();
export const checklistSchema = z
  .object({
    name: z.string().trim().min(1, "Add a checklist name.").max(120),
    description: z.string().trim().max(500).optional(),
    items: z.array(itemSchema).min(1, "Add at least one item.").max(50),
  })
  .strict();
export function validateChecklist(input) {
  const result = checklistSchema.parse(input);
  // Each step needs a different ID so ticking one step does not change another.
  const ids = result.items.map((item) => item.id).filter(Boolean);
  if (new Set(ids).size !== ids.length)
    throw new AppError(400, "Each checklist item must have a unique ID.");
  return {
    ...result,
    description: result.description || "",
    items: result.items.map((item) => ({
      id: item.id || randomUUID(),
      label: item.label,
      done: item.done || false,
    })),
  };
}

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().toLowerCase().max(254),
    password: z
      .string()
      .min(10, "Use at least 10 characters for your password.")
      .max(128),
  })
  .strict();
// Reuse the same email normalization at login so the lookup matches registration.
export const loginSchema = registerSchema
  .pick({ email: true })
  .extend({ password: z.string().min(1).max(128) })
  .strict();
