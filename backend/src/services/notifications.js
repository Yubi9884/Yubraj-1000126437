import webpush from "web-push";
import { logger } from "../utils/logger.js";

// Factory pattern: build the title, message and link for each kind of reminder.
export class NotificationFactory {
  static createTaskReminder(task) {
    // Hide private task details on the lock screen. Open the app to read them.
    return {
      title: "A little reminder from StudyPass",
      body: "You have an upcoming deadline. Open your workspace to see the details.",
      url: `/?task=${task._id}`,
      tag: `task-${task._id}-${task.reminder.choice}-${+task.reminder.at}`,
    };
  }
  static createTest() {
    return {
      title: "You’re all set!",
      body: "StudyPass reminders are connected to this device.",
      url: "/",
      tag: "studypass-test",
    };
  }
}

// Send a prepared payload to the devices saved for one account.
export class PushNotifier {
  // Accept an optional sender so tests can simulate delivery without browser push traffic.
  constructor(subscriptions, transport = webpush) {
    this.subscriptions = subscriptions;
    this.transport = transport;
  }
  async sendForUser(userId, payload) {
    const subscriptions = await this.subscriptions.findForUser(userId);
    let delivered = 0;
    for (const subscription of subscriptions) {
      try {
        await this.transport.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          JSON.stringify(payload),
          { TTL: 3600, timeout: 10000 },
        );
        delivered++;
      } catch (error) {
        // Remove expired device details. Keep other failures so we can try again later.
        if (error.statusCode === 404 || error.statusCode === 410)
          await this.subscriptions.remove(subscription.endpoint, userId);
        else logger.error("push_delivery_failed", error);
      }
    }
    return delivered;
  }
}

// Regularly check for due reminders and mark them sent when a push service accepts them.
export class ReminderScheduler {
  constructor(tasks, notifier) {
    this.tasks = tasks;
    this.notifier = notifier;
    this.running = false;
  }
  async checkDue(now = new Date()) {
    // Skip this check if reminders are still being sent.
    if (this.running) return;
    this.running = true;
    try {
      for (const task of await this.tasks.findDueReminders(now)) {
        const accepted = await this.notifier.sendForUser(
          task.userId,
          NotificationFactory.createTaskReminder(task),
        );
        // The notification service accepted it. This does not mean the user has read it.
        if (accepted > 0) await this.tasks.markReminderSent(task);
      }
    // Release the running flag even if delivery or a database operation fails.
    } finally {
      this.running = false;
    }
  }
  start(interval = 60000) {
    const tick = () =>
      this.checkDue().catch((error) =>
        logger.error("reminder_scheduler_failed", error),
      );
    // Check once at startup. The unreferenced timer lets the process exit once its other work is done.
    tick();
    this.timer = setInterval(tick, interval);
    this.timer.unref();
  }
  stop() {
    clearInterval(this.timer);
  }
}
