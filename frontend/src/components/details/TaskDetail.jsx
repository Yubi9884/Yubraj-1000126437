import { useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Pencil,
  Trash2,
} from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { Spinner, CategoryIcon, Priority, Progress } from "../common/UI.jsx";
import {
  CATEGORY,
  dateTimeLabel,
  dueLabel,
  taskDeadlineTone,
} from "../../utils/helpers.js";
import { getTaskReminders, REMINDER } from "../../utils/reminders.js";

// Show the task deadline, reminder choices, and any linked checklist.
export function TaskDetail({
  task,
  now = Date.now(),
  checklist,
  readOnly,
  onClose,
  onEdit,
  onDelete,
  onToggle,
  onItemToggle,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reminders = getTaskReminders(task);
  const completed = task.status === "completed";
  const deadlineStatus = completed ? "Completed" : dueLabel(task.dueDate, now);
  // Stop extra clicks while saving. Show a message if saving fails.
  async function action(callback) {
    setBusy(true);
    setError("");
    try {
      await callback();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={task.title} onClose={onClose}>
      <div className="detail-meta">
        <span className={`category-label category-${task.category}`}>
          <CategoryIcon category={task.category} />
          {CATEGORY[task.category]}
        </span>
        <Priority value={task.priority} completed={completed} />
      </div>
      {task.description && (
        <p className="detail-description">{task.description}</p>
      )}
      <div className="detail-facts">
        <div data-task-tone={taskDeadlineTone(task)}>
          <CalendarDays size={19} />
          <span>
            Due date
            <strong>
              <time dateTime={task.dueDate}>{dateTimeLabel(task.dueDate)}</time>
            </strong>
            {deadlineStatus && <small>{deadlineStatus}</small>}
          </span>
        </div>
        <div>
          <Bell size={19} />
          <span>
            Reminders
            <strong>
              {reminders.map(({ choice }) => REMINDER[choice]).join(", ") ||
                "No reminders"}
            </strong>
          </span>
        </div>
      </div>
      {/* Reuse the checklist item action to save progress directly from the task dialog. */}
      {checklist && (
        <div className="detail-checklist">
          <div className="section-heading">
            <h3>{checklist.name}</h3>
            <Progress list={checklist} compact />
          </div>
          {checklist.items.map((item) => (
            <label
              className={`checklist-item ${item.done ? "is-done" : ""}`}
              key={item.id}
            >
              <input
                type="checkbox"
                checked={item.done}
                disabled={readOnly || busy}
                onChange={() => action(() => onItemToggle(checklist, item.id))}
              />
              <span className="custom-check">
                {item.done && <Check size={13} />}
              </span>
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {/* Disable changes when viewing a saved offline copy or while a change is pending. */}
      <div className="detail-actions">
        <button
          className="button button-primary"
          disabled={readOnly || busy}
          onClick={() => action(onToggle)}
        >
          {busy ? <Spinner /> : <CheckCheck size={17} />}
          {completed ? "Mark as open" : "Mark complete"}
        </button>
        <button
          className="button button-secondary"
          disabled={readOnly || busy}
          onClick={onEdit}
        >
          <Pencil size={16} />
          Edit
        </button>
        <button
          className="icon-button danger"
          disabled={readOnly || busy}
          aria-label="Delete task"
          onClick={onDelete}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </Modal>
  );
}
