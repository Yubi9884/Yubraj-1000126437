import { useState } from "react";
import { Check } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { Spinner } from "../common/UI.jsx";
import { CATEGORY, toLocalInput } from "../../utils/helpers.js";
import { getTaskReminders, REMINDER } from "../../utils/reminders.js";

// Use one form for creating and editing tasks. App.jsx supplies the API save action.
export function TaskForm({ task, lists, onSave, onClose }) {
  // Fill the form with the saved task, or use starting values for a new task.
  const [values, setValues] = useState({
    title: task?.title || "",
    description: task?.description || "",
    dueDate: toLocalInput(task?.dueDate || new Date(Date.now() + 86400000)),
    category: task?.category || "study",
    priority: task?.priority || "medium",
    reminders: task ? getTaskReminders(task).map(({ choice }) => choice) : [],
    checklistId: task?.checklistId || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Read and update each input using its field name.
  const field = (key) => ({
    value: values[key],
    onChange: (event) => setValues({ ...values, [key]: event.target.value }),
  });
  async function submit(event) {
    // Stop the form from reloading the page when the user saves.
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...values,
        // Convert local time to UTC, the shared time format used by the server.
        dueDate:
          // Keep the original timestamp when the minute-precision input is unchanged.
          task && values.dueDate === toLocalInput(task.dueDate)
            ? task.dueDate
            : new Date(values.dueDate).toISOString(),
        // Use null in the API payload to explicitly represent no checklist link.
        checklistId: values.checklistId || null,
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title={task ? "Edit task" : "New task"} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>
          Task title
          <input
            {...field("title")}
            required
            maxLength={120}
            placeholder="e.g. Finish application development project"
          />
        </label>
        <div className="form-grid">
          <label>
            Due date and time
            <input type="datetime-local" {...field("dueDate")} required />
          </label>
          <label>
            Category
            <select {...field("category")}>
              {Object.entries(CATEGORY).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Priority</legend>
          <div className="priority-picker">
            {["low", "medium", "high"].map((value) => (
              <label
                key={value}
                className={values.priority === value ? "selected" : ""}
                data-task-tone={value}
              >
                <input
                  type="radio"
                  name="priority"
                  value={value}
                  checked={values.priority === value}
                  onChange={() => setValues({ ...values, priority: value })}
                />
                <span className="priority-dot" aria-hidden="true" />
                {value[0].toUpperCase() + value.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>
        <details className="form-options" open={task ? true : undefined}>
          <summary>Notes, reminders and checklist</summary>
          <div className="form">
            <label>
              Notes
              <textarea
                {...field("description")}
                maxLength={1000}
                rows={2}
              />
            </label>
            <fieldset>
              <legend>Remind me before the deadline</legend>
              <div className="reminder-options">
                {Object.entries(REMINDER).map(([choice, label]) => (
                  <label key={choice}>
                    <input
                      type="checkbox"
                      name="reminders"
                      value={choice}
                      checked={values.reminders.includes(choice)}
                      onChange={(event) => {
                        // Add or remove this reminder choice while preserving the other selections.
                        const { checked } = event.target;
                        setValues((previous) => ({
                          ...previous,
                          reminders: checked
                            ? [...previous.reminders, choice]
                            : previous.reminders.filter((value) => value !== choice),
                        }));
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Linked checklist
              <select {...field("checklistId")}>
                <option value="">No checklist</option>
                {lists.map((list) => (
                  <option key={list._id} value={list._id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? <Spinner /> : <Check size={17} />}
            {task ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
