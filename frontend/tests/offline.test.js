import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Load the real service worker in an isolated environment with mock browser APIs.
function worker({
  fetch: fetcher = vi.fn(),
  match = vi.fn(),
  open = vi.fn(),
} = {}) {
  const handlers = {};
  const self = {
    location: { origin: "https://studypass.example" },
    addEventListener: (name, handler) => {
      handlers[name] = handler;
    },
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: {
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue(undefined),
      claim: vi.fn(),
    },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self,
    caches: { match, open },
    fetch: fetcher,
    URL,
    Response,
    Promise,
  });
  return { handlers, self };
}

describe("Offline service worker behavior", () => {
  it("never intercepts authenticated API responses or non-GET requests", () => {
    const { handlers } = worker();
    const respondWith = vi.fn();
    handlers.fetch({
      request: { url: "https://studypass.example/api/tasks", method: "GET" },
      respondWith,
    });
    handlers.fetch({
      request: { url: "https://studypass.example/index.html", method: "POST" },
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();
  });
  // Simulate a failed network request and verify that navigation falls back to the cached page.
  it("serves the saved app shell for an offline navigation", async () => {
    const shell = new Response("<html>Offline application shell</html>");
    const match = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(shell);
    const { handlers } = worker({
      fetch: vi.fn().mockRejectedValue(new TypeError("offline")),
      match,
    });
    let response;
    handlers.fetch({
      request: {
        url: "https://studypass.example/tasks",
        method: "GET",
        mode: "navigate",
      },
      respondWith: (value) => {
        response = value;
      },
    });
    expect(await (await response).text()).toContain(
      "Offline application shell",
    );
    expect(match).toHaveBeenLastCalledWith("/index.html");
  });
  it("returns cached JavaScript when its network request fails", async () => {
    const { handlers } = worker({
      fetch: vi.fn().mockRejectedValue(new TypeError("offline")),
      match: vi.fn().mockResolvedValue(new Response("cached javascript")),
    });
    let response;
    handlers.fetch({
      request: {
        url: "https://studypass.example/assets/app.js",
        method: "GET",
      },
      respondWith: (value) => {
        response = value;
      },
    });
    expect(await (await response).text()).toBe("cached javascript");
  });
  it("handles a malformed push message without crashing", async () => {
    const { handlers, self } = worker();
    handlers.push({
      data: {
        json: () => {
          throw new Error("invalid json");
        },
      },
      waitUntil: (value) => value,
    });
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      "StudyPass reminder",
      expect.objectContaining({ body: expect.any(String) }),
    );
  });
  // Check that test alerts stay separate while actual reminders keep their individual tags.
  it("shows each test notification separately while keeping scheduled reminder tags", () => {
    const { handlers, self } = worker();

    for (const tag of ["studypass-test", "studypass-test", "task-123-hour-1000"]) {
      handlers.push({
        data: { json: () => ({ title: "StudyPass", tag }) },
        waitUntil: (value) => value,
      });
    }

    const displayedTags = self.registration.showNotification.mock.calls.map(
      ([, options]) => options.tag,
    );
    expect(displayedTags).toEqual(["", "", "task-123-hour-1000"]);
  });
  it("does not follow an external URL from a push payload", async () => {
    const { handlers, self } = worker();
    let operation;
    handlers.notificationclick({
      notification: {
        close: vi.fn(),
        data: { url: "https://untrusted.example" },
      },
      waitUntil: (value) => {
        operation = value;
      },
    });
    await operation;
    expect(self.clients.openWindow).toHaveBeenCalledWith(
      "https://studypass.example",
    );
  });
});
