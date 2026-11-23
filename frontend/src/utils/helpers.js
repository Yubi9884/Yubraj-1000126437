// Reuse these labels so every page uses the same words.
export const CATEGORY = {
  study: "University",
  personal: "Personal",
  admin: "Life admin",
};
// Format dates for a New Zealand audience and let callers request extra fields.
export function dateLabel(value, options = {}) {
  return new Date(value).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    ...options,
  });
}
export function dateTimeLabel(value) {
  const time = new Date(value).toLocaleTimeString("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateLabel(value, { weekday: "short", year: "numeric" })} · ${time}`;
}
export function daysUntil(value, now = Date.now()) {
  // Compare dates without the time, using the user's local timezone.
  const day = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  return Math.round((day(value) - day(now)) / 86400000);
}
export function dueLabel(value, now = Date.now()) {
  const days = daysUntil(value, now);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  // A task due earlier today is overdue even though its calendar-day difference is zero.
  if (+new Date(value) <= now) return "Overdue";
  if (!days) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return null;
}
// Use a completed style for finished tasks and a priority-based style for open tasks.
export function taskDeadlineTone(task) {
  return task.status === "completed" ? "completed" : task.priority;
}
// Change a saved date into local time for the date and time input box.
export function toLocalInput(value) {
  const date = new Date(value);
  return new Date(+date - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
// Count finished steps and total steps for a checklist's progress bar.
export function progress(checklist) {
  const items = checklist?.items || [];
  return {
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}

// Make a date label that the calendar and task filter can both match.
// JavaScript counts months from 0: January is 0 and December is 11.
export function localDayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Show only tasks that match all the selected filters.
export function filterTasks(
  tasks,
  {
    status = "open",
    category = "all",
    query = "",
    selectedDate = null,
    period = "all",
  } = {},
) {
  // Normalize the search text once before matching it against each task.
  const search = query.trim().toLowerCase();

  return tasks.filter(
    (task) =>
      (status === "all" || task.status === status) &&
      (category === "all" || task.category === category) &&
      `${task.title} ${task.description || ""}`
        .toLowerCase()
        .includes(search) &&
      (!selectedDate || localDayKey(task.dueDate) === selectedDate) &&
      (period !== "week" ||
        (daysUntil(task.dueDate) >= 0 && daysUntil(task.dueDate) <= 7)),
  );
}
