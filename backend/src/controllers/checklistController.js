import { requireRecord } from "../utils/errors.js";

// Read the browser's request, call the right service and send the result back.
export function createChecklistController(checklists, planner) {
  return {
    // Read account-owned records through the repository and send changes through the planner service.
    list: async (req, res) =>
      res.json({ checklists: await checklists.findForUser(req.userId) }),
    read: async (req, res) =>
      res.json({
        checklist: requireRecord(
          await checklists.findOne(req.params.id, req.userId),
        ),
      }),
    create: async (req, res) =>
      res
        .status(201)
        .json({
          checklist: await planner.createChecklist(req.body, req.userId),
        }),
    update: async (req, res) =>
      res.json({
        checklist: await planner.updateChecklist(
          req.params.id,
          req.body,
          req.userId,
        ),
      }),
    // The planner clears task links before the controller confirms the deletion.
    remove: async (req, res) => {
      await planner.deleteChecklist(req.params.id, req.userId);
      res.status(204).end();
    },
  };
}
