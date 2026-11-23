import { ChevronRight } from "lucide-react";
import { progress } from "../utils/helpers.js";

// Search checklists by name and description, then display the progress for each match.
export default function ChecklistsPage({ lists, query, setModal }) {
  const search = query.trim().toLowerCase();
  const filteredLists = lists.filter((list) =>
    [list.name, list.description].join(" ").toLowerCase().includes(search),
  );

  // Distinguish an empty workspace from a search that found no matching checklist.
  if (!filteredLists.length) {
    return (
      <p className="list-empty">
        {lists.length ? "No checklists match your search." : "No checklists yet."}
      </p>
    );
  }

  return (
    <div className="panel checklist-list">
      {filteredLists.map((list) => {
        const { done, total } = progress(list);
        return (
          <button
            type="button"
            key={list._id}
            className="checklist-row"
            onClick={() => setModal({ type: "checklist-detail", id: list._id })}
          >
            <strong>{list.name}</strong>
            <span>{done}/{total} complete</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
