import { ChevronRight } from "lucide-react";
import { Spinner } from "../components/index.js";
import { dateTimeLabel } from "../utils/helpers.js";
import { listTaskReminders, REMINDER } from "../utils/reminders.js";

// Show scheduled reminders from open tasks and expose device notification controls.
export default function RemindersPage({
  now = Date.now(),
  subscribed,
  offline,
  pushBusy,
  onPushAction,
  openTasks,
  query,
  setModal,
}) {
  const search = query.trim().toLowerCase();
  // Use the time-sorted reminder entries and filter them by their task title.
  const reminders = listTaskReminders(openTasks).filter(({ task }) =>
    task.title.toLowerCase().includes(search),
  );

  return (
    <>
      {reminders.length ? (
        <div className="panel">
          {reminders.map(({ task, reminder, at, id }) => (
            <button
              key={id}
              className="reminder-row"
              onClick={() => setModal({ type: "task-detail", id: task._id })}
            >
              <div>
                <strong>{task.title}</strong>
                <span>{REMINDER[reminder.choice]} · {dateTimeLabel(at)}</span>
              </div>
              <span className="reminder-state">
                {reminder.sent ? "Push sent" : at <= now ? "Due" : "Scheduled"}
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <p className="list-empty">
          {search ? "No reminders match your search." : "No scheduled reminders yet."}
        </p>
      )}

      {/* App.jsx handles browser permission, device registration, and the test request. */}
      <section className="notification-settings" aria-label="Device notifications">
        <div>
          <h2>Device notifications</h2>
          <p>{subscribed ? "Enabled on this device." : "Get reminders when StudyPass is closed."}</p>
        </div>
        <div className="notification-actions">
          {!subscribed && (
            <button
              type="button"
              className="button button-secondary"
              disabled={offline || Boolean(pushBusy)}
              onClick={() => onPushAction("enable")}
            >
              {pushBusy === "enable" && <Spinner />}
              Enable reminders
            </button>
          )}
          <button
            type="button"
            className="button button-secondary"
            disabled={offline || Boolean(pushBusy)}
            onClick={() => onPushAction("test")}
          >
            {pushBusy === "test" && <Spinner />}
            Send test notification
          </button>
        </div>
      </section>
    </>
  );
}
