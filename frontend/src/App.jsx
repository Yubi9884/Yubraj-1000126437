import Layout, { pageTitles } from "./components/Layout.jsx";
import ReminderPopup from "./components/ReminderPopup.jsx";
import PlannerPage from "./pages/PlannerPage.jsx";
import ChecklistsPage from "./pages/ChecklistsPage.jsx";
import RemindersPage from "./pages/RemindersPage.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  Check,
  CircleHelp,
  ClipboardList,
  Download,
  ListTodo,
  Plus,
  RefreshCw,
  WifiOff,
  X,
} from "lucide-react";
import Auth from "./pages/LoginPage.jsx";
import {
  AccountModal,
  ChecklistDetail,
  ChecklistForm,
  ConfirmDelete,
  Modal,
  Spinner,
  TaskDetail,
  TaskForm,
} from "./components/index.js";
import { api, readSession, saveSession } from "./services/api.js";
import {
  clearWorkspace,
  loadWorkspace,
  saveWorkspace,
} from "./services/offline.js";
import { filterTasks } from "./utils/helpers.js";

// Coordinate the signed-in workspace, background updates, page selection, and dialogs.
export default function App() {
  // useState remembers values. Changing a value updates what the user sees.
  // These values hold the account, tasks, filters and open pop-up.
  const [session, setSession] = useState(readSession);
  const [config, setConfig] = useState(null);
  const [data, setData] = useState({ tasks: [], checklists: [] });
  const [loading, setLoading] = useState(Boolean(session));
  const [now, setNow] = useState(Date.now);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [page, setPage] = useState("tasks");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [selectedDate, setSelectedDate] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [pushBusy, setPushBusy] = useState(null);
  const [subscribed, setSubscribed] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [updating, setUpdating] = useState(null);
  const sessionRef = useRef(session);
  const toastTimer = useRef();
  // Remember the latest account while waiting for a server reply.
  sessionRef.current = session;
  // Show one message at a time and restart its dismissal timer for each new message.
  const notify = useCallback((message, error = false) => {
    clearTimeout(toastTimer.current);
    setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Get tasks and checklists from the server. Save a copy to view without internet.
  const refresh = useCallback(async () => {
    const id = sessionRef.current?.user._id;
    if (!id) return;
    try {
      // Fetch both lists together. Check the account again before applying the response.
      const [taskData, listData] = await Promise.all([
        api("/tasks"),
        api("/checklists"),
      ]);
      if (sessionRef.current?.user._id !== id) return;
      const next = { tasks: taskData.tasks, checklists: listData.checklists };
      setData(next);
      setOffline(false);
      await saveWorkspace(id, next).catch(() =>
        notify(
          "Data loaded. This browser could not save an offline copy.",
          true,
        ),
      );
    } catch (error) {
      if (sessionRef.current?.user._id !== id) return;
      // An expired session clears account state. A connection failure can fall back to the saved workspace.
      if (error.status === 401) {
        saveSession(null);
        sessionRef.current = null;
        setSession(null);
        setData({ tasks: [], checklists: [] });
        await clearWorkspace(id).catch(() => {});
        notify("Your session expired. Please sign in again.", true);
      } else if (error instanceof TypeError || !navigator.onLine) {
        const saved = await loadWorkspace(id).catch(() => null);
        if (sessionRef.current?.user._id !== id) return;
        if (saved) setData(saved);
        setOffline(true);
        if (!saved)
          notify(
            "No offline copy yet. Reconnect and refresh to load your workspace.",
            true,
          );
      } else {
        notify(error.message, true);
      }
    } finally {
      setLoading(false);
    }
  }, [notify]);

  // Get app settings from the server, such as whether Google sign-in is enabled.
  // useEffect runs this after the page appears. [] means it runs once when opened.
  useEffect(() => {
    let timer;
    let cancelled = false;
    async function loadConfig() {
      try {
        const result = await api("/config");
        if (!cancelled) setConfig(result);
      } catch {
        if (!cancelled) timer = setTimeout(loadConfig, 3000);
      }
    }
    loadConfig();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    // Press Ctrl+K or Command+K to jump to the search box.
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const search = document.querySelector(
          'input[aria-label="Search workspace"]',
        );
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    // Load the user's data after sign-in or when the account changes.
    if (session) {
      setLoading(true);
      refresh();
    }
  }, [session?.user._id, refresh]);
  useEffect(() => {
    // Listen for internet changes and the browser's offer to install the app.
    const online = () => {
      refresh();
      api("/config")
        .then(setConfig)
        .catch(() => {});
    };
    const offline = () => setOffline(true);
    const install = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("beforeinstallprompt", install);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, [refresh]);
  useEffect(() => {
    // Check both browser and server subscription state before showing device reminders as enabled.
    if (!session || offline || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    Promise.all([
      navigator.serviceWorker.ready.then((registration) =>
        registration.pushManager?.getSubscription(),
      ),
      api("/push/subscriptions"),
    ])
      .then(([subscription, { count }]) => {
        if (!cancelled)
          setSubscribed((current) => current ?? (Boolean(subscription) && count > 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [offline, session?.user._id]);
  useEffect(() => {
    if (!session) return;
    // Refresh the time for deadline labels and popups, including when the user returns to the tab.
    const check = () => setNow(Date.now());
    check();
    const timer = window.setInterval(check, 15000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [session?.user._id]);
  useEffect(() => {
    // A reminder link contains a task ID. Open that task after its data has loaded.
    const taskId = new URLSearchParams(window.location.search).get("task");
    if (taskId && data.tasks.some((task) => task._id === taskId)) {
      setModal({ type: "task-detail", id: taskId });
      // Consume the notification link so a later refresh will not reopen the same dialog.
      history.replaceState(null, "", "/");
    }
  }, [data.tasks]);

  // Remember the signed-in account and open the task list.
  function login(next) {
    saveSession(next);
    sessionRef.current = next;
    setSession(next);
    setSubscribed(null);
    navigate("tasks");
    setData({ tasks: [], checklists: [] });
  }
  // Sign out and delete this user's saved offline data from the browser.
  async function logout() {
    const userId = session?.user._id;
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      // Remove the device from the signed-in account while its login token is still available.
      if (subscription && navigator.onLine) {
        await api("/push/subscribe", {
          method: "DELETE",
          body: { endpoint: subscription.endpoint },
        });
        await subscription.unsubscribe();
      }
    } catch {
      /* Still sign out if removing device reminders fails. */
    }
    saveSession(null);
    sessionRef.current = null;
    setSession(null);
    setData({ tasks: [], checklists: [] });
    setModal(null);
    setSubscribed(false);
    setQuery("");
    if (userId) await clearWorkspace(userId).catch(() => {});
  }
  // Reset the filters when moving to another page.
  function navigate(next) {
    setPage(next);
    setCategory("all");
    setStatus("all");
    setPeriod("all");
    setQuery("");
    setSelectedDate(null);
  }
  // Save a change, reload the lists and show a success message.
  async function mutate(path, method, body, message) {
    if (offline)
      throw new Error(
        "Reconnect to make changes. Your saved workspace is view only.",
      );
    await api(path, { method, body });
    await refresh();
    notify(message);
  }
  // Switch a task between unfinished and completed.
  async function toggleTask(task) {
    setUpdating(task._id);
    try {
      await mutate(
        `/tasks/${task._id}`,
        "PATCH",
        { status: task.status === "completed" ? "open" : "completed" },
        task.status === "completed"
          ? "Task reopened."
          : "One more thing done. Nice work!",
      );
    } finally {
      setUpdating(null);
    }
  }
  // Tick or untick only the checklist step with this ID.
  async function toggleItem(list, id) {
    await mutate(
      `/checklists/${list._id}`,
      "PATCH",
      {
        items: list.items.map((item) =>
          item.id === id ? { ...item, done: !item.done } : item,
        ),
      },
      "Checklist updated.",
    );
  }
  // Ask the user to allow reminders, then save this device on the server.
  async function registerPushDevice() {
    if (
      !("Notification" in window) ||
      !("PushManager" in window) ||
      !("serviceWorker" in navigator)
    )
      throw new Error(
        "This browser does not support Web Push. Try a current Chrome, Edge or Firefox browser.",
      );
    if (!config?.vapidPublicKey)
      throw new Error(
        "The server push keys are not ready. Restart the backend and refresh.",
      );
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw new Error(
        "Notifications are blocked. Allow them in your browser’s site settings, then try again.",
      );
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      // Change the server's public reminder key into the format the browser needs.
      const base64 = config.vapidPublicKey
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const decoded = atob(
        base64 + "=".repeat((4 - (base64.length % 4)) % 4),
      );
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(decoded, (character) =>
          character.charCodeAt(0),
        ),
      });
    }
    // Register the browser subscription with the API so the scheduler knows where to send alerts.
    await api("/push/subscribe", {
      method: "POST",
      body: subscription.toJSON(),
    });
    setSubscribed(true);
  }

  // Use the same setup flow for enabling reminders and sending a test notification.
  async function runPushAction(action) {
    setPushBusy(action);
    try {
      if (!subscribed) await registerPushDevice();
      if (action === "test") {
        await api("/push/test", { method: "POST", body: {} });
        notify("Test notification sent. Check your device notifications.");
      } else {
        notify("This device is ready for reminders.");
      }
    } catch (error) {
      if (error.status === 409) setSubscribed(false);
      notify(error.message, true);
    } finally {
      setPushBusy(null);
    }
  }
  // Open the browser install prompt when available. Otherwise, show the installation instructions.
  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
    } else setModal({ type: "install" });
  }

  // Derive the page lists and selected records from the latest workspace data on every render.
  const tasks = data.tasks;
  const lists = data.checklists;
  const openTasks = tasks.filter((task) => task.status === "open");
  const selectedTask = tasks.find((task) => task._id === modal?.id);
  const selectedList = lists.find((list) => list._id === modal?.id);
  const filteredTasks = filterTasks(tasks, {
    status,
    category,
    query,
    selectedDate,
    period,
  });
  // A modal is a pop-up. Its type chooses the pop-up; its ID chooses the saved item.
  const close = () => setModal(null);
  const canCreate = page === "tasks" || page === "checklists";
  const isChecklistPage = page === "checklists";

  // Show the sign-in screen until the browser has a session.
  if (!session)
    return (
      <>
        <Auth config={config} onSession={login} />
        {toast && (
          <div
            className={`toast ${toast.error ? "toast-error" : ""}`}
            role="status"
          >
            {toast.message}
            <button aria-label="Dismiss message" onClick={() => setToast(null)}>
              <X size={16} />
            </button>
          </div>
        )}
      </>
    );
  return (
    <>
      <Layout
        page={page}
        navigate={navigate}
        onAccount={() => setModal({ type: "account" })}
      >
        {offline && (
          <div className="offline-banner" role="status">
            <WifiOff size={17} />
            <div>
              <strong>Offline view only</strong> · Reconnect to make changes.
            </div>
            <button className="text-button" onClick={refresh}>
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}
        <div className="page-heading">
          <h1>{pageTitles[page]}</h1>
          {canCreate && (
            <button
              className="button button-primary"
              disabled={offline}
              onClick={() =>
                setModal({
                  type: isChecklistPage ? "checklist-form" : "task-form",
                })
              }
            >
              <Plus size={16} />
              {isChecklistPage ? "New checklist" : "New task"}
            </button>
          )}
        </div>
        <input
          className="workspace-search"
          type="search"
          aria-label="Search workspace"
          placeholder={`Search ${pageTitles[page].toLowerCase()}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {/* Wait for the initial workspace load, then pass shared state and handlers to the active page. */}
        {loading ? (
          <div className="loading-workspace">
            <Spinner />
            <p>Loading your workspace…</p>
          </div>
        ) : (
          <>
            {page === "tasks" && (
              <PlannerPage
                now={now}
                query={query}
                tasks={tasks}
                setPeriod={setPeriod}
                setStatus={setStatus}
                filteredTasks={filteredTasks}
                status={status}
                category={category}
                setCategory={setCategory}
                offline={offline}
                updating={updating}
                setModal={setModal}
                toggleTask={toggleTask}
                notify={notify}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                period={period}
              />
            )}
            {page === "checklists" && (
              <ChecklistsPage
                lists={lists}
                query={query}
                setModal={setModal}
              />
            )}
            {page === "reminders" && (
              <RemindersPage
                now={now}
                subscribed={subscribed}
                offline={offline}
                pushBusy={pushBusy}
                onPushAction={runPushAction}
                openTasks={openTasks}
                query={query}
                setModal={setModal}
              />
            )}
          </>
        )}
      </Layout>
      {/* Keep in-app reminders available on every signed-in page. The account key resets popup state on account changes. */}
      <ReminderPopup
        key={session.user._id}
        userId={session.user._id}
        tasks={openTasks}
        now={now}
        blocked={loading || Boolean(modal)}
        onOpenTask={(id) => setModal({ type: "task-detail", id })}
      />
      {/* The task and checklist forms use POST for creation and PATCH when editing a saved record. */}
      {modal?.type === "task-form" && (
        <TaskForm
          key={modal.id || "new-task"}
          task={selectedTask}
          lists={lists}
          onClose={close}
          onSave={async (body) => {
            await mutate(
              selectedTask ? `/tasks/${selectedTask._id}` : "/tasks",
              selectedTask ? "PATCH" : "POST",
              body,
              selectedTask
                ? "Task updated."
                : "Task added.",
            );
            close();
          }}
        />
      )}
      {modal?.type === "checklist-form" && (
        <ChecklistForm
          key={modal.id || "new-list"}
          checklist={selectedList}
          onClose={close}
          onSave={async (body) => {
            await mutate(
              selectedList ? `/checklists/${selectedList._id}` : "/checklists",
              selectedList ? "PATCH" : "POST",
              body,
              selectedList ? "Checklist updated." : "Your checklist is ready.",
            );
            close();
          }}
        />
      )}
      {/* Look up the current record for each detail dialog so it reflects the latest workspace state. */}
      {modal?.type === "task-detail" && selectedTask && (
        <TaskDetail
          task={selectedTask}
          now={now}
          checklist={lists.find(
            (list) => list._id === selectedTask.checklistId,
          )}
          readOnly={offline}
          onClose={close}
          onToggle={() => toggleTask(selectedTask)}
          onItemToggle={toggleItem}
          onEdit={() => setModal({ type: "task-form", id: selectedTask._id })}
          onDelete={() =>
            setModal({ type: "delete-task", id: selectedTask._id })
          }
        />
      )}
      {modal?.type === "checklist-detail" && selectedList && (
        <ChecklistDetail
          checklist={selectedList}
          readOnly={offline}
          onClose={close}
          onToggle={toggleItem}
          onEdit={() =>
            setModal({ type: "checklist-form", id: selectedList._id })
          }
          onDelete={() =>
            setModal({ type: "delete-checklist", id: selectedList._id })
          }
        />
      )}
      {/* Both delete flows wait for confirmation and close the dialog after the API succeeds. */}
      {modal?.type === "delete-task" && selectedTask && (
        <ConfirmDelete
          title="Delete this task?"
          description={`“${selectedTask.title}” and its reminders will be removed. Its linked checklist will stay.`}
          onClose={close}
          onConfirm={async () => {
            await mutate(
              `/tasks/${selectedTask._id}`,
              "DELETE",
              undefined,
              "Task deleted.",
            );
            close();
          }}
        />
      )}
      {modal?.type === "delete-checklist" && selectedList && (
        <ConfirmDelete
          title="Delete this checklist?"
          description={`“${selectedList.name}” and its items will be removed. Any linked tasks will stay, with their checklist link cleared.`}
          onClose={close}
          onConfirm={async () => {
            await mutate(
              `/checklists/${selectedList._id}`,
              "DELETE",
              undefined,
              "Checklist deleted.",
            );
            close();
          }}
        />
      )}
      {modal?.type === "account" && (
        <AccountModal
          user={session.user}
          onClose={close}
          onHelp={() => setModal({ type: "help" })}
          onInstall={installApp}
          onLogout={logout}
        />
      )}
      {modal?.type === "help" && (
        <Modal
          title="StudyPass help"
          onClose={close}
        >
          <div className="help-steps">
            {[
              [
                ListTodo,
                "Give your tasks a home",
                "Add a title and deadline, choose a priority, and select any reminder times you need.",
              ],
              [
                ClipboardList,
                "Break it into small steps",
                "Create a checklist, add the items you need, and link it to a task.",
              ],
              [
                WifiOff,
                "Keep your plans close",
                "After loading your workspace online, you can view its saved copy offline. Reconnect before making changes.",
              ],
              [
                Bell,
                "Let reminders come to you",
                "Due reminders pop up in your workspace. Enable device notifications on the Reminders page to get alerts when the app is closed.",
              ],
            ].map(([Icon, title, text]) => (
              <div key={title}>
                <Icon size={21} />
                <span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </span>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button className="button button-primary" onClick={close}>
              Got it
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "install" && (
        <Modal
          title="Install StudyPass"
          description="Add StudyPass to your home screen or desktop."
          onClose={close}
        >
          <div className="help-steps">
            <div>
              <Download size={22} />
              <span>
                <strong>On Chrome or Edge</strong>
                <p>
                  Open the browser menu and choose “Install StudyPass” or
                  “Install page as app”. The option appears when your browser
                  considers the app installable.
                </p>
              </span>
            </div>
            <div>
              <BookOpen size={22} />
              <span>
                <strong>On iPhone or iPad</strong>
                <p>
                  Open StudyPass over HTTPS in Safari, tap Share, then “Add to
                  Home Screen”.
                </p>
              </span>
            </div>
          </div>
          <p className="form-note">
            Install the app after opening it online. Your saved workspace
            remains available for viewing when you lose your connection.
          </p>
          <div className="modal-footer">
            <button className="button button-primary" onClick={close}>
              Got it
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role="status"
        >
          {toast.error ? <CircleHelp size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button aria-label="Dismiss message" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
