import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import {
  calculateReminder,
  validateChecklist,
  validateTask,
} from "../src/services/validation.js";
import { toId } from "../src/repositories/index.js";
import { issueToken } from "../src/middleware/authMiddleware.js";
import jwt from "jsonwebtoken";

// Use a fixed clock so deadline and reminder edge cases are repeatable.
const now = new Date("2026-11-16T00:00:00.000Z");
const input = { title: "Finish report", dueDate: "2026-11-25T02:00:00.000Z" };

describe("Task validation and reminder boundaries", () => {
  it("trims a title and provides safe defaults", () => {
    const task = validateTask(
      { ...input, title: "  Finish report  " },
      null,
      now,
    );
    expect(task.title).toBe("Finish report");
    expect(task.status).toBe("open");
    expect(task.reminders).toEqual([]);
  });
  it.each(["", "   "])("rejects an empty title %j", (title) => {
    expect(() => validateTask({ ...input, title }, null, now)).toThrow();
  });
  it("rejects a deadline in the past", () => {
    expect(() =>
      validateTask(
        { ...input, dueDate: "2026-11-15T00:00:00.000Z" },
        null,
        now,
      ),
    ).toThrow("future");
  });
  it("rejects a deadline exactly at the current time", () => {
    expect(() =>
      validateTask({ ...input, dueDate: now.toISOString() }, null, now),
    ).toThrow("future");
  });
  it("rejects an already elapsed reminder even if the deadline is future", () => {
    expect(() =>
      validateTask(
        { ...input, dueDate: "2026-11-16T02:00:00.000Z", reminder: "day" },
        null,
        now,
      ),
    ).toThrow("reminder time has passed");
  });
  it("calculates day and week reminders in UTC", () => {
    expect(calculateReminder(input.dueDate, "day").toISOString()).toBe(
      "2026-11-24T02:00:00.000Z",
    );
    expect(calculateReminder(input.dueDate, "week").toISOString()).toBe(
      "2026-11-18T02:00:00.000Z",
    );
  });
  it("keeps an elapsed reminder and its sent status when adding a later one", () => {
    const previous = validateTask({ ...input, reminders: ["week"] }, null, now);
    previous.reminders[0].sent = true;
    const changed = validateTask(
      { title: "Revised report", reminders: ["hour", "week"] },
      previous,
      new Date("2026-11-20"),
    );
    expect(changed.reminders).toEqual([
      previous.reminders[0],
      { choice: "hour", at: new Date("2026-11-25T01:00:00.000Z"), sent: false },
    ]);
  });
  it("reschedules every selected reminder when the deadline changes", () => {
    const previous = validateTask({ ...input, reminders: ["day", "week"] }, null, now);
    previous.reminders[0].sent = true;
    const changed = validateTask({ dueDate: "2026-11-26T02:00:00.000Z" }, previous, now);
    expect(changed.reminders).toEqual([
      { choice: "week", at: new Date("2026-11-19T02:00:00.000Z"), sent: false },
      { choice: "day", at: new Date("2026-11-25T02:00:00.000Z"), sent: false },
    ]);
  });
  it("rejects duplicate reminder times", () => {
    expect(() => validateTask({ ...input, reminders: ["day", "day"] }, null, now))
      .toThrow("only once");
  });
  it("rejects the removed five-minute reminder choice", () => {
    expect(() =>
      validateTask({ ...input, reminders: ["fiveMinutes"] }, null, now),
    ).toThrow();
  });
  it("allows completion of an overdue task without changing its date", () => {
    const previous = validateTask(input, null, now);
    expect(
      validateTask({ status: "completed" }, previous, new Date("2026-12-01"))
        .status,
    ).toBe("completed");
  });
  it("rejects extra database operators and ownership fields", () => {
    expect(() =>
      validateTask({ ...input, userId: "another-user" }, null, now),
    ).toThrow();
    expect(() =>
      validateTask({ ...input, $set: { title: "injected" } }, null, now),
    ).toThrow();
  });
});

// Cover generated item IDs, default completion values, and invalid checklist data.
describe("Checklist validation", () => {
  it("assigns stable item IDs and completion defaults", () => {
    const list = validateChecklist({
      name: " Documents ",
      items: [{ label: " Letter " }],
    });
    expect(list.name).toBe("Documents");
    expect(list.items[0].label).toBe("Letter");
    expect(list.items[0].id).toMatch(/^[a-f\d-]{36}$/i);
    expect(list.items[0].done).toBe(false);
    expect(validateChecklist(list).items[0].id).toBe(list.items[0].id);
  });
  it("rejects an empty checklist and a blank item", () => {
    expect(() => validateChecklist({ name: "Docs", items: [] })).toThrow();
    expect(() =>
      validateChecklist({ name: "Docs", items: [{ label: "  " }] }),
    ).toThrow();
  });
  it("rejects duplicate item IDs", () => {
    const id = "7253dd7e-8e7d-45cc-b116-28b9c18352a2";
    expect(() =>
      validateChecklist({
        name: "Docs",
        items: [
          { id, label: "A" },
          { id, label: "B" },
        ],
      }),
    ).toThrow("unique ID");
  });
});

// Check MongoDB ID parsing, token claims, and the public account response.
describe("Authentication primitives", () => {
  it("rejects malformed MongoDB IDs", () => {
    expect(() => toId("not-an-id")).toThrow("invalid");
    expect(() => toId({ $ne: null })).toThrow("invalid");
  });
  it("issues a signed, expiring token without private user fields", () => {
    const user = {
      _id: new ObjectId(),
      passwordHash: "private",
      email: "student@example.com",
    };
    const secret = "unit-test-secret-at-least-32-characters";
    const token = issueToken(user, secret);
    const payload = jwt.verify(token, secret, {
      issuer: "studypass-nz",
      audience: "studypass-client",
      algorithms: ["HS256"],
    });
    expect(payload.sub).toBe(String(user._id));
    expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
    expect(payload.passwordHash).toBeUndefined();
    expect(payload.email).toBeUndefined();
  });
});
