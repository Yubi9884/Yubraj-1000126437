import { Modal } from "./common/Modal.jsx";

// Show the account details and the sign-out button.
export function AccountModal({ user, onClose, onHelp, onInstall, onLogout }) {
  return (
    <Modal title="Account" onClose={onClose}>
      {/* Show the email for regular accounts and identify sample accounts as a sample workspace. */}
      <div className="account-card">
        <h3>{user.name}</h3>
        <p>{user.demo ? "Sample workspace" : user.email}</p>
      </div>
      <p className="form-note">
        {user.demo
          ? "Create an account to return to your own workspace."
          : "Signing out clears this browser’s saved offline copy."}
      </p>
      <div className="modal-footer">
        <button className="button button-secondary" onClick={onHelp}>
          Help
        </button>
        <button className="button button-secondary" onClick={onInstall}>
          Install app
        </button>
        <button className="button button-primary" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </Modal>
  );
}
