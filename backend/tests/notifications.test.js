import { describe, expect, it, vi } from "vitest";
import {
  NotificationFactory,
  PushNotifier,
  ReminderScheduler,
} from "../src/services/notifications.js";

const task = {
  _id: "abc123",
  userId: "student1",
  title: "Private administrative task",
  reminder: { choice: "day", at: new Date("2026-11-24T02:00:00.000Z") },
};

// Check that a task alert uses generic text and carries a link the app recognizes.
describe("Notification payload factory", () => {
  it("uses generic lock-screen text and a local task link", () => {
    const payload = NotificationFactory.createTaskReminder(task);
    expect(payload.body).not.toContain("Private");
    expect(payload.url).toBe("/?task=abc123");
    expect(payload.tag).toBe(`task-abc123-day-${+task.reminder.at}`);
    expect(NotificationFactory.createTest().tag).toBe("studypass-test");
  });
});

// Use fake push responses to test cleanup, retry behavior, and accepted delivery counts.
describe("Push delivery errors", () => {
  const subscription = {
    endpoint: "https://fcm.googleapis.com/example",
    keys: { auth: "auth", p256dh: "key" },
  };
  it("removes expired subscriptions and keeps the scheduler running", async () => {
    const repository = {
      findForUser: vi.fn().mockResolvedValue([subscription]),
      remove: vi.fn(),
    };
    const transport = {
      sendNotification: vi.fn().mockRejectedValue({ statusCode: 410 }),
    };
    expect(
      await new PushNotifier(repository, transport).sendForUser("student", {
        title: "Test",
      }),
    ).toBe(0);
    expect(repository.remove).toHaveBeenCalledWith(
      subscription.endpoint,
      "student",
    );
  });
  it("does not discard a subscription after a temporary failure", async () => {
    const repository = {
      findForUser: vi.fn().mockResolvedValue([subscription]),
      remove: vi.fn(),
    };
    const transport = {
      sendNotification: vi
        .fn()
        .mockRejectedValue({ statusCode: 503, message: "Temporary failure" }),
    };
    expect(
      await new PushNotifier(repository, transport).sendForUser("student", {}),
    ).toBe(0);
    expect(repository.remove).not.toHaveBeenCalled();
  });
  it("counts only messages accepted by the push service", async () => {
    const repository = {
      findForUser: vi.fn().mockResolvedValue([subscription]),
      remove: vi.fn(),
    };
    const transport = {
      sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
    };
    expect(
      await new PushNotifier(repository, transport).sendForUser("student", {
        title: "Test",
      }),
    ).toBe(1);
    expect(transport.sendNotification).toHaveBeenCalledWith(
      subscription,
      expect.any(String),
      expect.objectContaining({ TTL: 3600 }),
    );
  });
});

// Check when the scheduler marks a reminder sent and how it handles a concurrent tick.
describe("Reminder scheduler", () => {
  it("marks a reminder sent only after an accepted delivery", async () => {
    const tasks = {
      findDueReminders: vi.fn().mockResolvedValue([task]),
      markReminderSent: vi.fn(),
    };
    const notifier = { sendForUser: vi.fn().mockResolvedValue(1) };
    await new ReminderScheduler(tasks, notifier).checkDue();
    expect(tasks.markReminderSent).toHaveBeenCalledWith(task);
  });
  it("leaves failed reminders available for a later retry", async () => {
    const tasks = {
      findDueReminders: vi.fn().mockResolvedValue([task]),
      markReminderSent: vi.fn(),
    };
    await new ReminderScheduler(tasks, {
      sendForUser: vi.fn().mockResolvedValue(0),
    }).checkDue();
    expect(tasks.markReminderSent).not.toHaveBeenCalled();
  });
  it("prevents overlapping scheduler passes", async () => {
    let release;
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    const tasks = {
      findDueReminders: vi.fn().mockReturnValue(waiting),
      markReminderSent: vi.fn(),
    };
    const scheduler = new ReminderScheduler(tasks, {});
    const first = scheduler.checkDue();
    await scheduler.checkDue();
    expect(tasks.findDueReminders).toHaveBeenCalledTimes(1);
    release([]);
    await first;
    expect(scheduler.running).toBe(false);
  });
});
