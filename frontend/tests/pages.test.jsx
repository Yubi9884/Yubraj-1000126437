import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup as renderToString } from "react-dom/server";
import PlannerPage from "../src/pages/PlannerPage.jsx";
import ChecklistsPage from "../src/pages/ChecklistsPage.jsx";
import RemindersPage from "../src/pages/RemindersPage.jsx";
import ReminderPopup from "../src/components/ReminderPopup.jsx";
import { Calendar } from "../src/components/Calendar.jsx";
import { dateLabel } from "../src/utils/helpers.js";
import { listTaskReminders } from "../src/utils/reminders.js";

const noop = () => {};
const task = {
  _id: "task-1",
  title: "Finish the project",
  description: "Prepare submission",
  dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
  reminderAt: new Date(Date.now() + 2 * 86400000).toISOString(),
  reminder: "day",
  status: "open",
  priority: "high",
  category: "study",
  checklistId: null,
};
const checklist = {
  _id: "list-1",
  name: "Submission checklist",
  description: "Final project steps",
  items: [{ id: "item-1", label: "Run the tests", done: true }],
};
// Share a baseline planner fixture and override the state each rendering case needs.
const plannerProps = {
  query: "",
  tasks: [task],
  setPeriod: noop,
  setStatus: noop,
  filteredTasks: [task],
  status: "open",
  category: "all",
  setCategory: noop,
  offline: false,
  updating: null,
  setModal: noop,
  toggleTask: noop,
  notify: noop,
  selectedDate: null,
  setSelectedDate: noop,
  period: "all",
};

// Render the components to HTML and check the text, attributes, and controls they produce.
describe("Page modules after separating the frontend", () => {
  it("shows distinct empty messages for a new account and a search", () => {
    const empty = { ...plannerProps, status: "all", tasks: [], filteredTasks: [] };
    expect(renderToString(<PlannerPage {...empty} />)).toContain("No tasks yet.");
    expect(renderToString(<PlannerPage {...empty} query="missing" />)).toContain(
      "No tasks match these filters.",
    );
  });
  it("renders the task list with an expandable calendar", () => {
    const html = renderToString(<PlannerPage {...plannerProps} />);
    expect(html).toContain("Finish the project");
    expect(html).toContain("calendar-grid");
    expect(html).toContain('<details class="calendar-options"><summary>Calendar</summary>');
  });
  it("renders the task completion loading state", () => {
    const html = renderToString(
      <PlannerPage {...plannerProps} updating={task._id} />,
    );
    expect(html).toContain("Loading");
  });
  it("colors all deadlines by priority and completed tasks by status", () => {
    const now = +new Date(2026, 10, 18, 12);
    const hour = 3600000;
    const makeTask = (priority, dueInHours, completed = false) => ({
      ...task,
      _id: String(dueInHours),
      priority,
      status: completed ? "completed" : "open",
      dueDate: new Date(now + dueInHours * hour).toISOString(),
    });
    const filteredTasks = [
      makeTask("high", -1),
      makeTask("medium", 1),
      makeTask("low", 72),
      makeTask("high", 96),
      makeTask("high", -2, true),
    ];
    const html = renderToString(<PlannerPage {...plannerProps} now={now} filteredTasks={filteredTasks} />);
    expect(html.match(/class="task-row" data-task-tone="high"/g)).toHaveLength(2);
    expect(html).toContain('class="task-row" data-task-tone="medium"');
    expect(html).toContain('class="task-row" data-task-tone="low"');
    expect(html).toContain('class="task-row task-complete" data-task-tone="completed"');
    expect(html).toContain("<small>Overdue</small>");
    expect(html).toContain("<small>Today</small>");
    expect(html).toContain("<small>Completed</small>");
  });
  it("marks a calendar day with its highest open priority or completion", () => {
    const today = new Date();
    const mixed = new Date(today.getFullYear(), today.getMonth(), 3);
    const done = new Date(today.getFullYear(), today.getMonth(), 4);
    const tasks = [
      { ...task, _id: "low", priority: "low", dueDate: mixed },
      { ...task, _id: "high", priority: "high", dueDate: mixed },
      { ...task, _id: "mixed-done", status: "completed", dueDate: mixed },
      { ...task, _id: "done", status: "completed", dueDate: done },
    ];
    const html = renderToString(<Calendar tasks={tasks} onSelect={noop} />);
    expect(html).toContain(`data-task-tone="high" aria-label="Filter tasks for ${dateLabel(mixed)}, High priority"`);
    expect(html).toContain(`data-task-tone="completed" aria-label="Filter tasks for ${dateLabel(done)}, Completed"`);
  });
  it("renders deadline filtering and a control to clear the selected date", () => {
    const html = renderToString(
      <PlannerPage {...plannerProps} selectedDate="2026-10-22" />,
    );
    expect(html).toContain("Next 7 days");
    expect(html).toContain("Clear date");
  });
  it("renders the checklist page and its progress", () => {
    const html = renderToString(
      <ChecklistsPage
        lists={[checklist]}
        query=""
        setModal={noop}
      />,
    );
    expect(html).toContain("Submission checklist");
    expect(html).toContain("1/1 complete");
  });
  it("renders reminder loading and scheduled reminders", () => {
    const multi = {
      ...task,
      reminders: [
        { choice: "day", at: task.reminderAt, sent: false },
        { choice: "hour", at: new Date(+new Date(task.dueDate) - 3600000).toISOString(), sent: false },
      ],
    };
    const html = renderToString(
      <RemindersPage
        subscribed={false}
        offline={false}
        pushBusy="enable"
        onPushAction={noop}
        openTasks={[multi]}
        query=""
        setModal={noop}
      />,
    );
    expect(html.match(/Finish the project/g)).toHaveLength(2);
    expect(html).toContain("1 day before");
    expect(html).toContain("1 hour before");
    expect(html).toContain("Loading");
    expect(html).toContain("Send test notification");
    expect(html).toContain("Enable reminders");
  });

  // Check that both reminder storage formats can still produce in-app alerts.
  it("shows due reminders after opening, including push-sent reminders and old saved tasks", () => {
    const old = { ...task, reminderAt: new Date(Date.now() - 60000).toISOString() };
    const sent = { ...old, _id: "sent-task", title: "Push already sent", reminderSent: true };
    const completed = { ...old, _id: "done-task", title: "Finished work", status: "completed" };
    const future = { ...task, _id: "future-task", title: "Future work" };
    const props = { userId: "student", tasks: [old, sent, completed, future], onOpenTask: noop };
    const html = renderToString(<ReminderPopup {...props} />);
    expect(html).toContain("Task reminders");
    expect(html).toContain(old.title);
    expect(html).toContain(sent.title);
    expect(html).not.toContain(completed.title);
    expect(html).not.toContain(future.title);
    expect(renderToString(<ReminderPopup {...props} blocked />)).toBe("");

    const [dismissed] = listTaskReminders([old]);
    vi.stubGlobal("localStorage", {
      getItem: (key) => key === `studypass-reminder:student:${dismissed.id}` ? "1" : null,
    });
    try {
      expect(renderToString(<ReminderPopup {...props} />)).not.toContain(old.title);
      expect(renderToString(<ReminderPopup {...props} userId="other" />)).toContain(old.title);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
