import { ObjectId } from "mongodb";
import { AppError } from "../utils/errors.js";
import { getTaskReminders } from "../utils/taskReminders.js";

// Check the ID, then change it into the ID format MongoDB uses.
export function toId(value) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    throw new AppError(400, "The record ID is invalid.");
  return new ObjectId(value);
}

// Keep database actions here. Use the user ID so each student gets only their own data.
export class OwnedRepository {
  constructor(db, name) {
    this.collection = db.collection(name);
  }
  async findForUser(userId) {
    return this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
  }
  async findOne(id, userId) {
    return this.collection.findOne({ _id: toId(id), userId });
  }
  // Attach ownership and timestamps on the server, then return the generated MongoDB ID.
  async create(data, userId) {
    const document = {
      ...data,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await this.collection.insertOne(document);
    return { ...document, _id: result.insertedId };
  }
  async update(id, data, userId) {
    // Update only when both the item ID and the signed-in user's ID match.
    return this.collection.findOneAndUpdate(
      { _id: toId(id), userId },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
  }
  async delete(id, userId) {
    return this.collection.findOneAndDelete({ _id: toId(id), userId });
  }
}

// Reuse the ownership rules and add task-specific sorting, edits, and reminder queries.
export class TaskRepository extends OwnedRepository {
  constructor(db) {
    super(db, "tasks");
  }
  async findForUser(userId) {
    // Put the earliest deadline first for the task list and next-deadline display.
    return this.collection.find({ userId }).sort({ dueDate: 1 }).toArray();
  }
  // Only save if the revision still matches the version read by the service.
  // A successful edit bumps the revision and removes the legacy reminder fields.
  async update(id, data, userId, revision) {
    return this.collection.findOneAndUpdate(
      { _id: toId(id), userId, revision: revision ?? { $exists: false } },
      {
        $set: { ...data, updatedAt: new Date() },
        $inc: { revision: 1 },
        $unset: { reminder: "", reminderAt: "", reminderSent: "" },
      },
      { returnDocument: "after" },
    );
  }
  // Clear this checklist reference on every linked task for the same account.
  async unlinkChecklist(checklistId, userId) {
    await this.collection.updateMany(
      { userId, checklistId },
      { $set: { checklistId: null, updatedAt: new Date() }, $inc: { revision: 1 } },
    );
  }
  // Find open tasks with a future deadline and an elapsed, unsent reminder in either storage format.
  async findDueReminders(now) {
    const dueTasks = await this.collection
      .find({
        status: "open",
        dueDate: { $gt: now },
        $or: [
          { reminders: { $elemMatch: { sent: false, at: { $lte: now } } } },
          {
            reminders: { $exists: false },
            reminderSent: false,
            reminderAt: { $lte: now },
          },
        ],
      })
      .limit(100)
      .toArray();
    // Return one scheduler entry per due reminder, since one task can have several.
    return dueTasks.flatMap((task) =>
      getTaskReminders(task)
        .filter((reminder) => !reminder.sent && reminder.at <= now)
        .map((reminder) => ({
          _id: task._id,
          userId: task.userId,
          reminder,
          legacy: !task.reminders,
        })),
    );
  }
  async markReminderSent({ _id, reminder, legacy }) {
    const { choice, at } = reminder;
    const task = { _id, status: "open" };
    if (legacy) {
      const result = await this.collection.updateOne(
        {
          ...task,
          reminders: { $exists: false },
          reminder: choice,
          reminderAt: at,
          reminderSent: false,
        },
        { $set: { reminderSent: true }, $inc: { revision: 1 } },
      );
      // A concurrent edit can convert the old reminder to the array while push is in flight.
      if (result.modifiedCount) return;
    }
    // Match the exact reminder choice and time so a rescheduled reminder stays pending.
    await this.collection.updateOne(
      { ...task, reminders: { $elemMatch: { choice, at, sent: false } } },
      { $set: { "reminders.$.sent": true }, $inc: { revision: 1 } },
    );
  }
}

export class ChecklistRepository extends OwnedRepository {
  constructor(db) {
    // Reuse the shared create, read, update and delete functions for checklists.
    super(db, "checklists");
  }
}

// Look up accounts by email, MongoDB ID, or their Google account identifier.
export class UserRepository {
  constructor(db) {
    this.collection = db.collection("users");
  }
  findByEmail(email) {
    return this.collection.findOne({ email });
  }
  findById(id) {
    return this.collection.findOne({ _id: toId(id) });
  }
  findByGoogleId(googleId) {
    return this.collection.findOne({ googleId });
  }
  async create(data) {
    const document = { ...data, createdAt: new Date() };
    const result = await this.collection.insertOne(document);
    return { ...document, _id: result.insertedId };
  }
}

export class PushSubscriptionRepository {
  constructor(db) {
    this.collection = db.collection("pushSubscriptions");
  }
  findForUser(userId) {
    return this.collection.find({ userId }).toArray();
  }
  // Upsert by endpoint so registering the same browser subscription updates the existing record.
  save(subscription, userId) {
    return this.collection.updateOne(
      { endpoint: subscription.endpoint },
      { $set: { ...subscription, userId, updatedAt: new Date() } },
      { upsert: true },
    );
  }
  remove(endpoint, userId) {
    return this.collection.deleteOne({ endpoint, userId });
  }
}
