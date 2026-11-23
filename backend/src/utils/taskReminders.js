// Express each time before the task deadline in milliseconds.
export const REMINDER_OFFSETS = {
  week: 7 * 86400000,
  threeDays: 3 * 86400000,
  day: 86400000,
  hour: 3600000,
};

// Older tasks store one reminder directly on the task document.
export function getTaskReminders(task) {
  if (task.reminders)
    return task.reminders.filter(({ choice }) =>
      Object.hasOwn(REMINDER_OFFSETS, choice),
    );
  if (!task.reminderAt || !Object.hasOwn(REMINDER_OFFSETS, task.reminder)) return [];
  return [{
    choice: task.reminder,
    at: task.reminderAt,
    sent: Boolean(task.reminderSent),
  }];
}
