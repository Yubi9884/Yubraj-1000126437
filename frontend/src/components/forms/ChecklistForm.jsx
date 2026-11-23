import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { Spinner } from "../common/UI.jsx";

// Edit the name, description, and steps together before submitting a single checklist payload.
export function ChecklistForm({ checklist, onSave, onClose }) {
  // Give each step its own ID so changing its name keeps its ticked status.
  const [name, setName] = useState(checklist?.name || "");
  const [description, setDescription] = useState(checklist?.description || "");
  const [items, setItems] = useState(
    checklist?.items || [{ id: crypto.randomUUID(), label: "", done: false }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Send the form values to App.jsx to save them and reload the checklists.
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ name, description, items });
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={checklist ? "Edit checklist" : "New checklist"}
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <label>
          Checklist name
          <input
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Student visa renewal"
          />
        </label>
        <label>
          Description <span className="optional">optional</span>
          <textarea
            maxLength={500}
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this checklist for?"
          />
        </label>
        <fieldset>
          <legend>Checklist items</legend>
          {/* Keep at least one step and enforce the same 50-step limit as the API. */}
          <div className="checklist-form-items">
            {items.map((item, index) => (
              <div className="checklist-form-row" key={item.id}>
                <span className="item-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <input
                  aria-label={`Item ${index + 1}`}
                  required
                  maxLength={160}
                  placeholder="Add a step or document…"
                  value={item.label}
                  onChange={(event) =>
                    setItems(
                      // Match by item ID and preserve the saved completion flag when changing the label.
                      items.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, label: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <button
                  className="icon-button"
                  type="button"
                  disabled={items.length === 1}
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() =>
                    setItems(items.filter((entry) => entry.id !== item.id))
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="text-button add-item"
            disabled={items.length >= 50}
            onClick={() =>
              setItems([
                ...items,
                { id: crypto.randomUUID(), label: "", done: false },
              ])
            }
          >
            <Plus size={17} />
            Add another item
          </button>
        </fieldset>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? <Spinner /> : <Check size={17} />}
            {checklist ? "Save changes" : "Create checklist"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
