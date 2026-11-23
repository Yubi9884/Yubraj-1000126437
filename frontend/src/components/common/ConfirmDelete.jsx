import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "./Modal.jsx";
import { Spinner } from "./UI.jsx";

// Reuse one confirmation dialog for both task and checklist deletion.
export function ConfirmDelete({ title, description, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Close the pop-up after deleting. If deleting fails, show the error and allow a retry.
  async function remove() {
    setBusy(true);
    try {
      await onConfirm();
    } catch (error) {
      setError(error.message);
      setBusy(false);
    }
  }
  return (
    <Modal title={title} description={description} onClose={onClose}>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="modal-footer">
        <button
          className="button button-secondary"
          onClick={onClose}
          disabled={busy}
        >
          Keep it
        </button>
        <button
          className="button button-danger"
          onClick={remove}
          disabled={busy}
        >
          {busy ? <Spinner /> : <Trash2 size={16} />}Delete
        </button>
      </div>
    </Modal>
  );
}
