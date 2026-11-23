import { Check } from "lucide-react";
import { Calendar, Priority, Spinner } from "../components/index.js";
import {
  CATEGORY,
  dateLabel,
  dueLabel,
  taskDeadlineTone,
} from "../utils/helpers.js";

// Render the task filters, calendar, and list using shared state and actions from App.jsx.
export default function PlannerPage({
  now = Date.now(),
  tasks,
  filteredTasks,
  query,
  status,
  setStatus,
  category,
  setCategory,
  period,
  setPeriod,
  selectedDate,
  setSelectedDate,
  offline,
  updating,
  setModal,
  toggleTask,
  notify,
}) {
  const hasFilters =
    query.trim() ||
    category !== "all" ||
    status !== "all" ||
    period !== "all" ||
    selectedDate;
  // Keep calendar markers visible across dates while respecting the selected task status.
  const calendarTasks =
    status === "all" ? tasks : tasks.filter((task) => task.status === status);

  return (
    <>
      <div className="task-filters">
        <select
          aria-label="Task status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
        </select>
        <select
          aria-label="Task category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORY).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          aria-label="Task deadline"
          value={period}
          onChange={(event) => {
            setSelectedDate(null);
            setPeriod(event.target.value);
          }}
        >
          <option value="all">Any deadline</option>
          <option value="week">Next 7 days</option>
        </select>
      </div>

      {/* Selecting a date clears the deadline range. Choosing a deadline range also clears the date. */}
      <details className="calendar-options">
        <summary>Calendar</summary>
        <Calendar
          tasks={calendarTasks}
          selected={selectedDate}
          onSelect={(date) => {
            setPeriod("all");
            setSelectedDate(date);
          }}
        />
      </details>

      {selectedDate && (
        <p className="active-filter">
          Showing tasks for the selected date
          <button className="text-button" onClick={() => setSelectedDate(null)}>
            Clear date
          </button>
        </p>
      )}

      {filteredTasks.length ? (
        <div className="panel task-table">
          <div className="task-table-heading">
            <span>Task</span>
            <span>Due date</span>
            <span>Priority</span>
          </div>
          {/* Render completion state and deadline text for each matching task. */}
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "completed";
            const deadlineStatus = isCompleted
              ? "Completed"
              : dueLabel(task.dueDate, now);

            return (
              <div
                className={isCompleted ? "task-row task-complete" : "task-row"}
                data-task-tone={taskDeadlineTone(task)}
                key={task._id}
              >
                <div className="task-main">
                  <button
                    className={isCompleted ? "task-check checked" : "task-check"}
                    aria-label={(isCompleted ? "Reopen " : "Complete ") + task.title}
                    disabled={offline || updating === task._id}
                    onClick={() =>
                      toggleTask(task).catch((error) => notify(error.message, true))
                    }
                  >
                    {updating === task._id ? <Spinner /> : isCompleted && <Check size={14} />}
                  </button>
                  <button
                    className="task-title-button"
                    onClick={() => setModal({ type: "task-detail", id: task._id })}
                  >
                    <strong>{task.title}</strong>
                    <span>{CATEGORY[task.category]}</span>
                  </button>
                </div>
                <div className="task-date">
                  <time dateTime={task.dueDate}>{dateLabel(task.dueDate)}</time>
                  {deadlineStatus && <small>{deadlineStatus}</small>}
                </div>
                <Priority value={task.priority} completed={isCompleted} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="list-empty">{hasFilters ? "No tasks match these filters." : "No tasks yet."}</p>
      )}
    </>
  );
}
