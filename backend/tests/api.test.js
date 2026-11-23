import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import dotenv from "dotenv";
import { mkdtemp, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";

dotenv.config({ quiet: true });
let mongo, client, app, db, token, otherToken, taskId, checklistId;
const secret = "integration-test-secret-with-32-characters";
// Simulate a push service accepting a message without sending to a real device.
const notifier = { sendForUser: vi.fn().mockResolvedValue(1) };
const future = (days) => new Date(Date.now() + days * 86400000).toISOString();
const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  // A separate real MongoDB process, never the application database.
  const base = resolve(
    dirname(process.env.LOCAL_DATA_DIR || ".data/mongodb"),
    "studypass-tests",
  );
  await mkdir(base, { recursive: true });
  const dbPath = await mkdtemp(join(base, "db-"));
  mongo = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: "wiredTiger" },
  });
  client = await MongoClient.connect(mongo.getUri());
  db = client.db("studypass_integration");
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  app = createApp(db, { jwtSecret: secret, rateLimits: false, notifier });
  const first = await request(app).post("/api/auth/register").send({
    name: "Test Student",
    email: "student@test.example",
    password: "My-test-password-2026",
  });
  expect(first.status).toBe(201);
  token = first.body.token;
  // Register a second student to verify that owned records stay private across accounts.
  const second = await request(app).post("/api/auth/register").send({
    name: "Other Student",
    email: "other@test.example",
    password: "Another-password-2026",
  });
  otherToken = second.body.token;
});
afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

// Exercise registration, login, token checks, and API response headers through HTTP.
describe("Account security", () => {
  it("reports a connected database", async () => {
    const result = await request(app).get("/api/health");
    expect(result.status).toBe(200);
    expect(result.body.database).toBe("connected");
  });
  it("hashes passwords and excludes hashes from responses", async () => {
    const user = await db
      .collection("users")
      .findOne({ email: "student@test.example" });
    expect(user.passwordHash).not.toBe("My-test-password-2026");
    expect(user.passwordHash).toMatch(/^\$2/);
    const result = await request(app).get("/api/auth/me").set(auth());
    expect(result.body.user.passwordHash).toBeUndefined();
  });
  it("signs in with a valid password", async () => {
    const result = await request(app).post("/api/auth/login").send({
      email: "student@test.example",
      password: "My-test-password-2026",
    });
    expect(result.status).toBe(200);
    expect(result.body.token).toBeTruthy();
  });
  it("rejects invalid and unknown passwords with the same message", async () => {
    const a = await request(app)
      .post("/api/auth/login")
      .send({ email: "student@test.example", password: "wrong" });
    const b = await request(app)
      .post("/api/auth/login")
      .send({ email: "missing@test.example", password: "wrong" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });
  it("rejects missing, forged and expired tokens", async () => {
    expect((await request(app).get("/api/tasks")).status).toBe(401);
    expect(
      (await request(app).get("/api/tasks").set("Authorization", "Bearer bad"))
        .status,
    ).toBe(401);
    const expired = jwt.sign({ sub: "000000000000000000000000" }, secret, {
      expiresIn: -1,
      issuer: "studypass-nz",
      audience: "studypass-client",
    });
    expect(
      (
        await request(app)
          .get("/api/tasks")
          .set("Authorization", `Bearer ${expired}`)
      ).status,
    ).toBe(401);
  });
  it("rejects duplicate email registrations and short passwords", async () => {
    expect(
      (
        await request(app).post("/api/auth/register").send({
          name: "Duplicate",
          email: "student@test.example",
          password: "My-test-password-2026",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app).post("/api/auth/register").send({
          name: "Student",
          email: "new@test.example",
          password: "short",
        })
      ).status,
    ).toBe(400);
  });
  it("rejects unexpected origins and never caches private API responses", async () => {
    expect(
      (
        await request(app)
          .get("/api/tasks")
          .set(auth())
          .set("Origin", "https://untrusted.example")
      ).status,
    ).toBe(403);
    const result = await request(app).get("/api/tasks").set(auth());
    expect(result.headers["cache-control"]).toBe("no-store");
  });
});

// Carry the created checklist ID through the read and edit requests.
describe("Checklist CRUD and item management", () => {
  it("creates a checklist with an embedded item", async () => {
    const result = await request(app)
      .post("/api/checklists")
      .set(auth())
      .send({
        name: "Project submission",
        items: [{ label: "Check the tests" }],
      });
    expect(result.status).toBe(201);
    checklistId = result.body.checklist._id;
    expect(result.body.checklist.items[0].done).toBe(false);
  });
  it("reads the owned checklist and rejects another user", async () => {
    expect(
      (await request(app).get(`/api/checklists/${checklistId}`).set(auth()))
        .status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get(`/api/checklists/${checklistId}`)
          .set("Authorization", `Bearer ${otherToken}`)
      ).status,
    ).toBe(404);
  });
  it("renames a checklist, updates and adds items", async () => {
    const original = (
      await request(app).get(`/api/checklists/${checklistId}`).set(auth())
    ).body.checklist;
    const result = await request(app)
      .patch(`/api/checklists/${checklistId}`)
      .set(auth())
      .send({
        name: "Final hand-in",
        items: [
          { ...original.items[0], done: true, label: "Run all tests" },
          { label: "Capture screenshots" },
        ],
      });
    expect(result.status).toBe(200);
    expect(result.body.checklist.items).toHaveLength(2);
    expect(result.body.checklist.items[0].done).toBe(true);
    expect(result.body.checklist.items[0].id).toBe(original.items[0].id);
  });
  it("rejects a checklist without items", async () => {
    expect(
      (
        await request(app)
          .post("/api/checklists")
          .set(auth())
          .send({ name: "Empty", items: [] })
      ).status,
    ).toBe(400);
  });
});

// Use the linked checklist and both accounts to check task operations and ownership.
describe("Task CRUD and authorization", () => {
  it("creates a task linked to the student’s checklist", async () => {
    const result = await request(app)
      .post("/api/tasks")
      .set(auth())
      .send({
        title: "Submit project",
        dueDate: future(10),
        reminder: "week",
        checklistId,
      });
    expect(result.status).toBe(201);
    taskId = result.body.task._id;
    expect(result.body.task.checklistId).toBe(checklistId);
    expect(result.body.task.reminderAt).toBeTruthy();
  });
  it("reads and updates a task", async () => {
    expect(
      (await request(app).get(`/api/tasks/${taskId}`).set(auth())).status,
    ).toBe(200);
    const result = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(auth())
      .send({
        title: "Submit final project",
        priority: "high",
        status: "completed",
      });
    expect(result.status).toBe(200);
    expect(result.body.task.status).toBe("completed");
    expect(result.body.task.priority).toBe("high");
  });
  it("does not expose or change another student’s task", async () => {
    const other = { Authorization: `Bearer ${otherToken}` };
    expect(
      (await request(app).get("/api/tasks").set(other)).body.tasks,
    ).toHaveLength(0);
    expect(
      (await request(app).get(`/api/tasks/${taskId}`).set(other)).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/tasks/${taskId}`)
          .set(other)
          .send({ title: "Stolen" })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/api/tasks/${taskId}`).set(other)).status,
    ).toBe(404);
  });
  it("rejects a link to another student’s checklist", async () => {
    const result = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ title: "Invalid link", dueDate: future(5), checklistId });
    expect(result.status).toBe(400);
  });
  it("rejects malformed IDs, past deadlines and operator injection", async () => {
    expect(
      (await request(app).get("/api/tasks/not-an-id").set(auth())).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/tasks")
          .set(auth())
          .send({ title: "Old", dueDate: "2020-01-01T00:00:00.000Z" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/tasks")
          .set(auth())
          .send({ title: "Inject", dueDate: future(5), userId: "other" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch(`/api/tasks/${taskId}`)
          .set(auth())
          .send({ $set: { userId: "other" } })
      ).status,
    ).toBe(400);
  });
  it("clears task links when the linked checklist is deleted", async () => {
    expect(
      (await request(app).delete(`/api/checklists/${checklistId}`).set(auth()))
        .status,
    ).toBe(204);
    const result = await request(app).get(`/api/tasks/${taskId}`).set(auth());
    expect(result.body.task.checklistId).toBeNull();
  });
  it("deletes the task and returns 404 on subsequent access", async () => {
    expect(
      (await request(app).delete(`/api/tasks/${taskId}`).set(auth())).status,
    ).toBe(204);
    expect(
      (await request(app).get(`/api/tasks/${taskId}`).set(auth())).status,
    ).toBe(404);
  });
});

// Check protected routes and endpoint validation with the stubbed sender.
describe("Push API authorization and validation", () => {
  it("requires authentication for test pushes", async () => {
    expect((await request(app).post("/api/push/test").send({})).status).toBe(
      401,
    );
  });
  it("tests push delivery through the protected endpoint", async () => {
    const result = await request(app)
      .post("/api/push/test")
      .set(auth())
      .send({});
    expect(result.status).toBe(200);
    expect(result.body.devices).toBe(1);
  });
  it("returns an actionable error if no subscription accepted delivery", async () => {
    notifier.sendForUser.mockResolvedValueOnce(0);
    expect(
      (await request(app).post("/api/push/test").set(auth()).send({})).status,
    ).toBe(409);
  });
  it("rejects unsafe or malformed subscription endpoints", async () => {
    const result = await request(app)
      .post("/api/push/subscribe")
      .set(auth())
      .send({
        endpoint: "http://127.0.0.1/private",
        keys: { auth: "x", p256dh: "x" },
      });
    expect(result.status).toBe(400);
  });
});

// Exercise reminder storage and delivery updates against the test MongoDB database.
describe("Task reminder schedules", () => {
  it("saves multiple times and delivers each reminder independently", async () => {
    const created = await request(app).post("/api/tasks").set(auth()).send({
      title: "Multiple reminders",
      dueDate: future(10),
      reminders: ["hour", "week", "day"],
    });
    expect(created.status).toBe(201);
    const task = created.body.task;
    const path = `/api/tasks/${task._id}`;
    expect(task.reminders.map(({ choice }) => choice)).toEqual(["week", "day", "hour"]);
    const [week, day] = task.reminders.map(({ at }) => new Date(at));
    await app.locals.scheduler.checkDue(week);
    await app.locals.scheduler.checkDue(week);
    let result = await request(app).get(path).set(auth());
    expect(result.body.task.reminders.map(({ sent }) => sent)).toEqual([true, false, false]);

    await app.locals.scheduler.checkDue(day);
    result = await request(app).get(path).set(auth());
    expect(result.body.task.reminders.map(({ sent }) => sent)).toEqual([true, true, false]);
    const deliveries = notifier.sendForUser.mock.calls
      .map(([, payload]) => payload)
      .filter(({ url }) => url === `/?task=${task._id}`);
    expect(deliveries).toHaveLength(2);
    expect(deliveries[0].tag).not.toBe(deliveries[1].tag);
    const removed = await request(app).patch(path).set(auth()).send({ reminders: [] });
    expect(removed.body.task.reminders).toEqual([]);
  });

  it("reads a legacy reminder and records delivery through a concurrent edit", async () => {
    const owner = await db.collection("users").findOne({ email: "student@test.example" });
    const at = new Date(future(1));
    const record = await db.collection("tasks").insertOne({
      userId: String(owner._id),
      title: "Legacy reminder",
      description: "",
      dueDate: new Date(+at + 86400000),
      priority: "medium",
      category: "study",
      status: "open",
      reminder: "day",
      reminderAt: at,
      reminderSent: false,
      checklistId: null,
    });
    const path = `/api/tasks/${record.insertedId}`;
    const before = await request(app).get(path).set(auth());
    expect(before.body.task.reminders).toEqual([{ choice: "day", at: at.toISOString(), sent: false }]);

    notifier.sendForUser.mockImplementationOnce(async () => {
      const edited = await request(app).patch(path).set(auth()).send({ title: "Edited while sending" });
      expect(edited.status).toBe(200);
      return 1;
    });
    await app.locals.scheduler.checkDue(at);
    const after = await request(app).get(path).set(auth());
    expect(after.body.task.title).toBe("Edited while sending");
    expect(after.body.task.reminders).toEqual([{ choice: "day", at: at.toISOString(), sent: true }]);
    expect(after.body.task.reminderSent).toBe(true);
  });
});
