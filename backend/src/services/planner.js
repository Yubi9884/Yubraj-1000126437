import { requireRecord, AppError } from "../utils/errors.js";
import {
  validateTask,
  validateChecklist,
  checklistSchema,
} from "./validation.js";

// Check the input and make sure a linked checklist belongs to this user before saving.
export class PlannerService {
  constructor(tasks, checklists) {
    this.tasks = tasks;
    this.checklists = checklists;
  }
  // A null ID means no link. Any supplied ID must resolve to a checklist owned by the same user.
  async assertChecklist(checklistId, userId) {
    if (checklistId && !(await this.checklists.findOne(checklistId, userId)))
      throw new AppError(400, "Choose a checklist from your own workspace.");
  }
  async createTask(input, userId) {
    const data = validateTask(input);
    await this.assertChecklist(data.checklistId, userId);
    return this.tasks.create(data, userId);
  }
  async updateTask(id, input, userId) {
    // Retry if another edit or reminder delivery changes the task while it is being saved.
    for (let attempt = 0; attempt < 3; attempt++) {
      const old = requireRecord(await this.tasks.findOne(id, userId));
      const data = validateTask(input, old);
      await this.assertChecklist(data.checklistId, userId);
      // Passing the last revision prevents this save from overwriting a newer database change.
      const saved = await this.tasks.update(id, data, userId, old.revision);
      if (saved) return saved;
    }
    throw new AppError(
      409,
      "This task changed while you were editing it. Try saving again.",
    );
  }
  async deleteTask(id, userId) {
    return requireRecord(await this.tasks.delete(id, userId));
  }
  async createChecklist(input, userId) {
    return this.checklists.create(validateChecklist(input), userId);
  }
  async updateChecklist(id, input, userId) {
    const old = requireRecord(await this.checklists.findOne(id, userId));
    // Merge the supplied fields with the saved checklist, then validate the full result.
    const patch = checklistSchema.partial().parse(input);
    const data = validateChecklist({
      name: old.name,
      description: old.description,
      items: old.items,
      ...patch,
    });
    return requireRecord(await this.checklists.update(id, data, userId));
  }
  async deleteChecklist(id, userId) {
    requireRecord(await this.checklists.findOne(id, userId));
    // Remove task links first so no task points to a deleted checklist.
    await this.tasks.unlinkChecklist(id, userId);
    return requireRecord(await this.checklists.delete(id, userId));
  }
}
