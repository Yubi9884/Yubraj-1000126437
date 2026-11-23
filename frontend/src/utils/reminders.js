// Keep the labels consistent between the form, reminders page, and popup.
export const REMINDER = {
  week: "1 week before",
  
  threeDays: "3 days before",
  day: "1 day before",
  hour: "1 hour before",
};

export function getTaskReminders(task) {
  if (task.reminders)
    return task.reminders.filter(({ choice }) => Object.hasOwn(REMINDER, choice));
  // A workspace saved offline before this version can still have a single reminder.
  if (!task.reminderAt || !Object.hasOwn(REMINDER, task.reminder)) return [];
  return [{
    choice: task.reminder,
    at: task.reminderAt,
    sent: Boolean(task.reminderSent),
  }];
}

// Return one entry per reminder for open tasks, with the earliest reminder first.
export function listTaskReminders(tasks) {
  return tasks
    .filter((task) => task.status === "open")
    .flatMap((task) =>
      getTaskReminders(task).map((reminder) => {
        const at = new Date(reminder.at).getTime();
        // Include the scheduled time in the ID so a rescheduled reminder is treated as new.
        return { task, reminder, at, id: `${task._id}:${reminder.choice}:${at}` };
      }),
    )
    .sort((first, second) => first.at - second.at);
}
