import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dateLabel, localDayKey, taskDeadlineTone } from "../utils/helpers.js";

const deadlineLabels = {
  high: "High",
  medium: "Medium",
  low: "Low",
  completed: "Completed",
};
const deadlineRank = { high: 3, medium: 2, low: 1, completed: 0 };

// Show deadline markers by month and send the selected day back to the planner.
export function Calendar({ tasks, selected, onSelect }) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  // Start each calendar week on Monday instead of Sunday.
  const start = (month.getDay() + 6) % 7;
  // Day zero of the following month is the last day of the month being displayed.
  const length = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  // A date reflects its highest open priority. It turns green when all its tasks are done.
  const taskDays = new Map();
  for (const task of tasks) {
    const day = localDayKey(task.dueDate);
    const tone = taskDeadlineTone(task);
    const existing = taskDays.get(day);
    if (!existing || deadlineRank[tone] > deadlineRank[existing]) {
      taskDays.set(day, tone);
    }
  }
  const today = localDayKey(new Date());
  return (
    <section className="panel calendar-panel">
      <div className="calendar-heading">
        <h3>
          {month.toLocaleDateString("en-NZ", {
            month: "long",
            year: "numeric",
          })}
        </h3>
        <div>
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((value, index) => (
          <span key={index} className="calendar-weekday">
            {value}
          </span>
        ))}
        {/* Pad the first row so day one starts under the correct weekday. */}
        {Array.from({ length: start }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length }, (_, index) => {
          const date = new Date(
            month.getFullYear(),
            month.getMonth(),
            index + 1,
          );
          const value = localDayKey(date);
          const tone = taskDays.get(value);
          const description = tone === "completed"
            ? "Completed"
            : `${deadlineLabels[tone]} priority`;
          return (
            <button
              key={value}
              className={`calendar-day ${value === today ? "is-today" : ""} ${selected === value ? "is-selected" : ""}`}
              data-task-tone={tone}
              aria-label={`Filter tasks for ${dateLabel(date)}${tone ? `, ${description}` : ""}`}
              aria-pressed={selected === value}
              onClick={() => onSelect(selected === value ? null : value)}
            >
              {index + 1}
              {tone && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        {Object.entries(deadlineLabels).map(([tone, label]) => (
          <span key={tone} data-task-tone={tone}>
            <i aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
