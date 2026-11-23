import { randomUUID } from "node:crypto";

// Create example tasks and checklists using the same checks as real user data.
export async function seedWorkspace(planner, userId) {
  // Generate stable IDs and mark the first few items done to show example progress.
  const list = (labels, done = 0) =>
    labels.map((label, index) => ({
      id: randomUUID(),
      label,
      done: index < done,
    }));
  // Save checklists first so the sample tasks can link to their generated IDs.
  const visa = await planner.createChecklist(
    {
      name: "Student visa renewal",
      description: "A simple checklist for the documents I need to prepare.",
      items: list(
        [
          "Check passport expiry",
          "Request enrolment letter",
          "Get proof of funds",
          "Download insurance certificate",
          "Review application documents",
        ],
        2,
      ),
    },
    userId,
  );
  const assignment = await planner.createChecklist(
    {
      name: "Final project hand-in",
      description: "Everything to check before submitting the project.",
      items: list(
        [
          "Complete the frontend",
          "Connect and test the API",
          "Capture testing screenshots",
          "Review the report",
          "Add the GitHub link",
        ],
        2,
      ),
    },
    userId,
  );
  await planner.createChecklist(
    {
      name: "A good start to the week",
      description: "A few small things that make the week easier.",
      items: list(
        [
          "Review upcoming deadlines",
          "Plan study sessions",
          "Back up project files",
        ],
        1,
      ),
    },
    userId,
  );
  // Calculate deadlines relative to when the sample workspace opens.
  const future = (days, hour = 17) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  for (const task of [
    {
      title: "Finish application development project",
      description:
        "Complete the working app, run the tests and review the report before hand-in.",
      category: "study",
      priority: "high",
      dueDate: future(3),
      reminder: "day",
      checklistId: String(assignment._id),
    },
    {
      title: "Prepare student visa documents",
      description:
        "Gather the documents on the linked checklist and check the renewal deadline.",
      category: "admin",
      priority: "high",
      dueDate: future(9),
      reminder: "week",
      checklistId: String(visa._id),
    },
    {
      title: "Review database lecture notes",
      description: "Revise indexes, CRUD operations and database connections.",
      category: "study",
      priority: "medium",
      dueDate: future(5),
      reminder: "day",
    },
    {
      title: "Renew health insurance",
      description:
        "Check the current policy and arrange the next cover period.",
      category: "personal",
      priority: "medium",
      dueDate: future(14),
      reminder: "week",
    },
    {
      title: "Book a study room",
      description: "Find a quiet spot for the group project session.",
      category: "study",
      priority: "low",
      dueDate: future(2),
      reminder: "none",
    },
  ])
    await planner.createTask(task, userId);
}
