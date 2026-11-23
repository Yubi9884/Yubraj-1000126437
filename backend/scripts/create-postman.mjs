import { mkdir, writeFile } from "node:fs/promises";

// Build the importable StudyPass API collection and use a bearer token for signed-in requests.
const collection = {
  info: {
    name: "StudyPass NZ API",
    description:
      "Local full-stack API tests. Register or log in first. Private values are saved only in your selected Postman environment.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: {
    type: "bearer",
    bearer: [{ key: "token", value: "{{token}}", type: "string" }],
  },
  item: [],
};
// Build one Postman request and a check for its expected response status.
function item(name, method, path, body, status = 200, options = {}) {
  const tests = [
    `pm.test('Expected HTTP status', () => pm.response.to.have.status(${status}));`,
    ...(options.tests || []),
  ];
  const value = {
    name,
    request: {
      method,
      header: [{ key: "Content-Type", value: "application/json" }],
      url: {
        raw: `{{baseUrl}}${path}`,
        host: ["{{baseUrl}}"],
        path: path.split("/").filter(Boolean),
      },
      ...(body
        ? {
            body: {
              mode: "raw",
              raw: JSON.stringify(body, null, 2),
              options: { raw: { language: "json" } },
            },
          }
        : {}),
      ...(options.noauth ? { auth: { type: "noauth" } } : {}),
    },
    event: [
      { listen: "test", script: { type: "text/javascript", exec: tests } },
    ],
  };
  if (options.before)
    value.event.unshift({
      listen: "prerequest",
      script: { type: "text/javascript", exec: options.before },
    });
  return value;
}
// Capture the login response fields for later requests and check that the password hash stays private.
const saveSession = [
  "pm.test('Session token is returned and saved', () => {",
  "  const session = pm.response.json();",
  "  pm.expect(session.token).to.be.a('string').and.not.be.empty;",
  "  pm.expect(session.user.email).to.be.a('string').and.not.be.empty;",
  "  pm.environment.set('token', session.token);",
  "  pm.environment.set('email', session.user.email);",
  "});",
  "pm.test('No password hash is exposed', () => pm.expect(pm.response.json().user).not.to.have.property('passwordHash'));",
];
collection.item.push({
  name: "1 Health and authentication",
  item: [
    item("Health", "GET", "/api/health", null, 200, {
      noauth: true,
      tests: [
        "pm.test('MongoDB is connected', () => pm.expect(pm.response.json().database).to.eql('connected'));",
      ],
    }),
    item(
      "Register",
      "POST",
      "/api/auth/register",
      { name: "Postman Student", email: "{{email}}", password: "{{password}}" },
      201,
      {
        noauth: true,
        before: [
          "const sampleEmail = pm.variables.replaceIn('student.{{$guid}}@example.test');",
          "pm.variables.set('email', sampleEmail);",
        ],
        tests: saveSession,
      },
    ),
    item(
      "Login",
      "POST",
      "/api/auth/login",
      { email: "{{email}}", password: "{{password}}" },
      200,
      { noauth: true, tests: saveSession },
    ),
    item("Current account", "GET", "/api/auth/me"),
  ],
});
collection.item.push({
  // Save the created checklist ID for later reads, edits, and task linking.
  name: "2 Checklist CRUD",
  item: [
    item(
      "Create checklist",
      "POST",
      "/api/checklists",
      {
        name: "Postman project hand-in",
        description: "Created by the API collection.",
        items: [{ label: "Run the tests" }, { label: "Review the report" }],
      },
      201,
      {
        tests: [
          "pm.test('Checklist has two items and a MongoDB ID', () => {",
          "  const checklist = pm.response.json().checklist;",
          "  pm.expect(checklist.items).to.have.lengthOf(2);",
          "  pm.expect(checklist._id).to.match(/^[a-f0-9]{24}$/);",
          "  pm.environment.set('checklistId', checklist._id);",
          "  pm.environment.set('itemId', checklist.items[0].id);",
          "});",
        ],
      },
    ),
    item("List checklists", "GET", "/api/checklists"),
    item("Read checklist", "GET", "/api/checklists/{{checklistId}}"),
    item(
      "Rename and tick an item",
      "PATCH",
      "/api/checklists/{{checklistId}}",
      {
        name: "Updated project hand-in",
        items: [
          { id: "{{itemId}}", label: "Run all tests", done: true },
          { label: "Review the final report", done: false },
        ],
      },
      200,
      {
        tests: [
          "pm.test('First item is complete', () => pm.expect(pm.response.json().checklist.items[0].done).to.eql(true));",
        ],
      },
    ),
    item(
      "Read the updated checklist",
      "GET",
      "/api/checklists/{{checklistId}}",
      null,
      200,
      {
        tests: [
          "pm.test('Checklist changes were saved', () => {",
          "  const checklist = pm.response.json().checklist;",
          "  pm.expect(checklist.name).to.eql('Updated project hand-in');",
          "  pm.expect(checklist.items[0].done).to.eql(true);",
          "});",
        ],
      },
    ),
  ],
});
collection.item.push({
  // Reuse the checklist ID from the preceding group and store the new task ID for cleanup.
  name: "3 Task CRUD",
  item: [
    item(
      "Create linked task",
      "POST",
      "/api/tasks",
      {
        title: "Postman assessment task",
        dueDate: "{{dueDate}}",
        priority: "high",
        category: "study",
        reminder: "day",
        checklistId: "{{checklistId}}",
      },
      201,
      {
        before: [
          "pm.environment.set('dueDate', new Date(Date.now() + 10 * 86400000).toISOString());",
        ],
        tests: [
          "pm.test('Task has a MongoDB ID and links to the saved checklist', () => {",
          "  const task = pm.response.json().task;",
          "  pm.expect(task._id).to.match(/^[a-f0-9]{24}$/);",
          "  pm.expect(task.checklistId).to.eql(pm.environment.get('checklistId'));",
          "  pm.environment.set('taskId', task._id);",
          "});",
          "pm.test('Reminder is stored', () => pm.expect(pm.response.json().task.reminderAt).to.be.a('string'));",
        ],
      },
    ),
    item("List tasks", "GET", "/api/tasks"),
    item("Read task", "GET", "/api/tasks/{{taskId}}"),
    item(
      "Edit task and mark complete",
      "PATCH",
      "/api/tasks/{{taskId}}",
      { title: "Updated Postman task", status: "completed" },
      200,
      {
        tests: [
          "pm.test('Task is completed', () => pm.expect(pm.response.json().task.status).to.eql('completed'));",
        ],
      },
    ),
    item(
      "Read the updated task",
      "GET",
      "/api/tasks/{{taskId}}",
      null,
      200,
      {
        tests: [
          "pm.test('Task changes were saved', () => {",
          "  const task = pm.response.json().task;",
          "  pm.expect(task.title).to.eql('Updated Postman task');",
          "  pm.expect(task.status).to.eql('completed');",
          "});",
        ],
      },
    ),
  ],
});
collection.item.push({
  // Verify API error responses for missing authentication and invalid data.
  name: "4 Invalid input and authentication",
  item: [
    item("Reject a missing token", "GET", "/api/tasks", null, 401, {
      noauth: true,
    }),
    item(
      "Reject an empty title",
      "POST",
      "/api/tasks",
      { title: " ", dueDate: "{{dueDate}}" },
      400,
    ),
    item(
      "Reject a past deadline",
      "POST",
      "/api/tasks",
      { title: "Old deadline", dueDate: "2020-01-01T00:00:00.000Z" },
      400,
    ),
    item(
      "Reject a forged owner",
      "POST",
      "/api/tasks",
      {
        title: "Ownership test",
        dueDate: "{{dueDate}}",
        userId: "someone-else",
      },
      400,
    ),
    item("Reject a malformed ID", "GET", "/api/tasks/invalid-id", null, 400),
  ],
});
collection.item.push({
  // Check subscription status and provide an optional test for a registered browser.
  name: "5 Push messaging",
  item: [
    item("Registered device count", "GET", "/api/push/subscriptions"),
    {
      name: "Send a real test notification",
      request: {
        method: "POST",
        header: [{ key: "Content-Type", value: "application/json" }],
        url: "{{baseUrl}}/api/push/test",
        body: { mode: "raw", raw: "{}" },
        description:
          "Enable notifications in the browser for the SAME account first. Returns 409 if no device accepts the message; 200 means the push service accepted it.",
      },
      event: [
        {
          listen: "test",
          script: {
            type: "text/javascript",
            exec: [
              "pm.test('Delivery accepted or a clear missing-device response', () => pm.expect([200, 409]).to.include(pm.response.code));",
              "if (pm.response.code === 200) pm.test('At least one device accepted', () => pm.expect(pm.response.json().devices).to.be.above(0));",
            ],
          },
        },
      ],
    },
  ],
});
collection.item.push({
  // Delete both sample records and verify that subsequent reads return 404.
  name: "6 Remove the collection test records",
  item: [
    item("Delete task", "DELETE", "/api/tasks/{{taskId}}", null, 204),
    item("Confirm task was deleted", "GET", "/api/tasks/{{taskId}}", null, 404),
    item(
      "Delete checklist",
      "DELETE",
      "/api/checklists/{{checklistId}}",
      null,
      204,
    ),
    item("Confirm checklist was deleted", "GET", "/api/checklists/{{checklistId}}", null, 404),
  ],
});
// Save the requests and example settings as files that can be imported into Postman.
await mkdir("postman", { recursive: true });
await writeFile(
  "postman/StudyPass.postman_collection.json",
  JSON.stringify(collection, null, 2) + "\n",
);
await writeFile(
  "postman/Local.postman_environment.json",
  JSON.stringify(
    {
      name: "StudyPass Local",
      values: [
        ["baseUrl", "http://127.0.0.1:4000"],
        ["email", ""],
        ["password", "StudyPass-Postman-2026!"],
        ["token", ""],
        ["taskId", ""],
        ["checklistId", ""],
        ["itemId", ""],
        ["dueDate", ""],
      ].map(([key, value]) => ({
        key,
        value,
        enabled: true,
        type: key === "token" || key === "password" ? "secret" : "default",
      })),
      _postman_variable_scope: "environment",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Postman collection and local environment created. No real credentials are included.",
);
