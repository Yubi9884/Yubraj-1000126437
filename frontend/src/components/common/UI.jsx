import {
  BookOpen,
  LoaderCircle,
  GraduationCap,
  ClipboardList,
  Leaf,
} from "lucide-react";
import { progress } from "../../utils/helpers.js";

// Use the same app name and icon in the signed-in layout and sign-in screen.
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <BookOpen size={23} strokeWidth={1.8} />
      </span>
      <span>StudyPass NZ</span>
    </div>
  );
}

// Show a shared loading indicator with an accessible label.
export function Spinner() {
  return <LoaderCircle size={18} className="spin" aria-label="Loading" />;
}

// Map each task category to its icon.
export function CategoryIcon({ category, size = 19 }) {
  const Icon =
    category === "study"
      ? GraduationCap
      : category === "admin"
        ? ClipboardList
        : Leaf;
  return <Icon size={size} strokeWidth={1.7} />;
}

// Share the task-tone CSS rules with the calendar and deadline displays.
export function Priority({ value, completed = false }) {
  return (
    <span className="priority" data-task-tone={completed ? "completed" : value}>
      <i aria-hidden="true" />
      {value[0].toUpperCase() + value.slice(1)}
    </span>
  );
}

export function Progress({ list, compact = false }) {
  const { done, total } = progress(list);
  // Fill the bar based on how many checklist steps are finished.
  return (
    <div className={`progress-block ${compact ? "progress-compact" : ""}`}>
      <div className="progress-track">
        <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <span>
        {done}/{total}
        {!compact && " complete"}
      </span>
    </div>
  );
}

