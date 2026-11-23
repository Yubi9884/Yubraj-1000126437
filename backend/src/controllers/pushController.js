import { z } from "zod";
import { AppError } from "../utils/errors.js";
import { NotificationFactory } from "../services/notifications.js";

// Manage browser push subscriptions for the signed-in account.
export function createPushController(subscriptions, notifier) {
  return {
    count: async (req, res) =>
      res.json({ count: (await subscriptions.findForUser(req.userId)).length }),
    subscribe: async (req, res) => {
      // Only accept reminder addresses from supported browser notification services.
      const allowedHost =
        /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com|wns\.windows\.com)$/i;
      const schema = z
        .object({
          endpoint: z
            .string()
            .url()
            .max(2048)
            .refine((value) => {
              const url = new URL(value);
              return (
                url.protocol === "https:" &&
                allowedHost.test(url.hostname) &&
                !url.port &&
                !url.username
              );
            }, "Use a subscription from a supported browser push service."),
          expirationTime: z.number().nullable().optional(),
          // The browser provides these keys so the push sender can encrypt the notification payload.
          keys: z
            .object({
              p256dh: z
                .string()
                .regex(/^[A-Za-z\d_-]+$/)
                .min(80)
                .max(100),
              auth: z
                .string()
                .regex(/^[A-Za-z\d_-]+$/)
                .min(20)
                .max(30),
            })
            .strict(),
        })
        .strict();
      const subscription = schema.parse(req.body);
      await subscriptions.save(subscription, req.userId);
      res
        .status(201)
        .json({ message: "Reminders are connected to this device." });
    },
    unsubscribe: async (req, res) => {
      const { endpoint } = z
        .object({ endpoint: z.string().url().max(2048) })
        .strict()
        .parse(req.body);
      await subscriptions.remove(endpoint, req.userId);
      res.status(204).end();
    },
    // Send a test to the account devices and report how many push services accepted it.
    test: async (req, res) => {
      const sent = await notifier.sendForUser(
        req.userId,
        NotificationFactory.createTest(),
      );
      if (!sent)
        throw new AppError(
          409,
          "No device accepted the notification. Enable reminders in the app and try again.",
        );
      res.json({
        message: "Test notification accepted by the push service.",
        devices: sent,
      });
    },
  };
}
