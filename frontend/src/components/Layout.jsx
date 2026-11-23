import { Brand } from "./common/UI.jsx";

// Map the shared page IDs to the labels shown in the heading and navigation.
export const pageTitles = {
  tasks: "Tasks",
  checklists: "Checklists",
  reminders: "Reminders",
};

// Wrap each signed-in page in a common header and keyboard-accessible main area.
export default function Layout({ page, navigate, onAccount, children }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <nav className="main-navigation" aria-label="Main navigation">
            {Object.entries(pageTitles).map(([id, label]) => (
              <button
                key={id}
                className="nav-item"
                onClick={() => navigate(id)}
                aria-current={page === id ? "page" : undefined}
              >
                {label}
              </button>
            ))}
          </nav>
          <button className="button button-secondary account-button" onClick={onAccount}>
            Account
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
