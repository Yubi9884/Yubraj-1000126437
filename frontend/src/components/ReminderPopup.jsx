import { useEffect, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { Modal } from "./common/Modal.jsx";
import { Priority } from "./common/UI.jsx";
import { dateTimeLabel, taskDeadlineTone } from "../utils/helpers.js";
import { listTaskReminders, REMINDER } from "../utils/reminders.js";

// Show due in-app reminders and remember dismissals for the signed-in account.
export default function ReminderPopup({
  userId,
  tasks,
  now = Date.now(),
  blocked,
  onOpenTask,
}) {
  const [dismissed, setDismissed] = useState(() => new Set());
  const prefix = `studypass-reminder:${userId}:`;

  useEffect(() => {
    // Sync dismissals across tabs using the storage event and the account-specific key prefix.
    const checkOtherTab = (event) => {
      if (event.newValue === "1" && event.key?.startsWith(prefix)) {
        const id = event.key.slice(prefix.length);
        setDismissed((previous) => new Set([...previous, id]));
      }
    };
    window.addEventListener("storage", checkOtherTab);
    return () => window.removeEventListener("storage", checkOtherTab);
  }, [prefix]);

  function wasDismissed(id) {
    if (dismissed.has(id)) return true;
    try {
      return localStorage.getItem(prefix + id) === "1";
    } catch {
      return false;
    }
  }

  function dismiss(entries) {
    const ids = entries.map(({ id }) => id);
    setDismissed((previous) => new Set([...previous, ...ids]));
    for (const id of ids) {
      try {
        localStorage.setItem(prefix + id, "1");
      } catch {
        // The current tab can still remember dismissals when storage is unavailable.
      }
    }
  }

  // Wait for the tab to be visible and free of other dialogs before showing due reminders.
  if (blocked || globalThis.document?.visibilityState === "hidden") return null;
  const due = listTaskReminders(tasks).filter(
    ({ at, id }) => at <= now && !wasDismissed(id),
  );
  if (due.length === 0) return null;

  return (
    <Modal title="Task reminders" onClose={() => dismiss(due)}>
      <div className="reminder-popup-list">
        {due.map((entry) => {
          const { task, reminder, id } = entry;
          return (
            <button
              key={id}
              type="button"
              className="reminder-row"
              data-task-tone={taskDeadlineTone(task)}
              onClick={() => {
                // Dismiss this reminder before its task detail dialog opens.
                dismiss([entry]);
                onOpenTask(task._id);
              }}
            >
              <span className="task-category-icon">
                <Bell size={17} />
              </span>
              <div>
                <strong>{task.title}</strong>
                <span>
                  {REMINDER[reminder.choice]} ·{" "}
                  {+new Date(task.dueDate) <= now ? "Overdue since" : "Due"}{" "}
                  <time dateTime={task.dueDate}>{dateTimeLabel(task.dueDate)}</time>
                </span>
              </div>
              <Priority value={task.priority} />
              <ChevronRight size={17} />
            </button>
          );
        })}
      </div>
      <div className="modal-footer">
        <button className="button button-secondary" onClick={() => dismiss(due)}>
          {due.length === 1 ? "Dismiss reminder" : "Dismiss all"}
        </button>
      </div>
    </Modal>
  );
}
