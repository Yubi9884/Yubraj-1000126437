import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { Progress } from "../common/UI.jsx";

// Show checklist progress and send edit, delete, and step changes back to App.jsx.
export function ChecklistDetail({
  checklist,
  readOnly,
  onClose,
  onEdit,
  onDelete,
  onToggle,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Tell App.jsx which step was clicked so it can save the new ticked status.
  async function toggle(id) {
    setBusy(true);
    setError("");
    try {
      await onToggle(checklist, id);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={checklist.name}
      description={checklist.description}
      onClose={onClose}
    >
      <div className="checklist-detail-progress">
        <Progress list={checklist} />
      </div>
      {/* Reflect the saved completion status and disable changes during offline use or a pending update. */}
      {checklist.items.map((item) => (
        <label
          className={`checklist-item ${item.done ? "is-done" : ""}`}
          key={item.id}
        >
          <input
            type="checkbox"
            disabled={readOnly || busy}
            checked={item.done}
            onChange={() => toggle(item.id)}
          />
          <span className="custom-check">
            {item.done && <Check size={13} />}
          </span>
          <span>{item.label}</span>
        </label>
      ))}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="detail-actions">
        <button
          className="button button-primary"
          disabled={readOnly}
          onClick={onEdit}
        >
          <Pencil size={16} />
          Edit checklist
        </button>
        <button
          className="button button-secondary danger"
          disabled={readOnly}
          onClick={onDelete}
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>
    </Modal>
  );
}
