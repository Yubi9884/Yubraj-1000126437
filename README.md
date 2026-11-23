# StudyPass NZ

The application has two independent projects. Each folder has its own `package.json`, dependencies, configuration and start command.

```text
Application final/
  frontend/             React interface and PWA
    public/             Service worker, manifest and app icon
    src/
      pages/            Login, planner, checklists and reminders
      components/       Layout, forms, details and shared controls
      services/         API requests and offline storage
      utils/            Date labels, filters and progress
      App.jsx           Page selection and shared application state
      main.jsx          React entry point and worker registration
    tests/              Page rendering and offline tests
    Start Frontend.bat  Start the frontend on Windows
    package.json
    vite.config.js
  backend/              Express API and MongoDB
    src/
      config/           Database connection
      routes/           API URL definitions
      controllers/      Request and response handling
      services/         Validation, planner and reminder logic
      repositories/     Database queries and ownership filters
      middleware/       JWT authentication and error handling
      utils/            Errors and logging
      server.js         Backend entry point
      app.js            Express configuration and route registration
    tests/              Unit tests and real MongoDB API tests
    postman/            Importable API collection
    .env.example
    package.json
    Start Backend.bat   Start the backend on Windows
```

## Run the application

1. To use Atlas, set your connection address, database username and password in `backend/.env`, following the backend README. Leave the address blank to use local MongoDB with the Windows launcher.
2. Open the **backend** folder and double-click **Start Backend.bat**.
3. Open the **frontend** folder and double-click **Start Frontend.bat**.
4. Open **http://127.0.0.1:5173** once both servers are ready.

Each launcher starts only the project in its own folder. Keep both terminal windows open while you use the application.

To use local MongoDB from a terminal, run `npm.cmd run start:local` in `backend` and start the frontend as usual. The local startup uses the existing workspace data on this computer.

To run each project from a terminal with Atlas, open two terminals in this folder.

In the first terminal, start the backend.

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

In the second terminal, start the frontend.

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

The frontend runs on port **5173**. The backend runs on port **4000**. Check the database connection at **http://127.0.0.1:4000/api/health**.

Choose **Open a sample workspace** to explore the features, or create an email account for your own work. Sample accounts have separate seeded tasks and checklists. Create a normal email account if you want to sign back into the same workspace after signing out.

Node.js **22.12 or later** is required. The first installation needs internet access. The backend stores application data in the `studypass` database.

Backend integration tests use a separate local MongoDB process. On this computer, its download and test files use `E:/StudyPassNZ-local-runtime`. Existing local application data is not automatically moved into Atlas.

## Understand the request flow

1. A frontend page calls `frontend/src/services/api.js`.
2. Vite forwards `/api` requests to the backend on port 4000.
3. A backend route chooses the controller.
4. Authentication checks the JWT and identifies the student.
5. The controller calls a service to validate and process the request.
6. A repository reads or writes that student's MongoDB records.
7. The response updates the interface and its saved offline copy.

## Explain the project to your lecturer

- **React state and props:** `App.jsx` keeps the current account, tasks, checklists and filters in state. It passes data and action functions to the pages as props.
- **Saving a task:** `TaskForm.jsx` collects the input. `App.jsx` sends it through `api.js`, reloads the lists after a successful save and shows a message.
- **Backend layers:** routes select a controller, controllers handle HTTP requests and responses, services validate changes, and repositories query MongoDB.
- **Account ownership:** the backend checks the signed JWT, then uses its verified user ID in database queries. A student cannot choose another owner in a request.
- **Offline viewing:** the service worker caches app files, while IndexedDB stores each account's workspace. Changes require a connection; signing out clears the account's saved copy.
- **Reminders:** each task can have several times. Due reminders pop up when the workspace opens and while it stays open. Optional device notifications use a server check every minute by default and link to the task using `/?task=ID`.
- **Design patterns:** repositories organise database access, `DatabaseConnection` shares one connection pool (Singleton), and `NotificationFactory` builds reminder and test messages (Simple Factory).

The source comments explain the reasons for important checks, date conversions and browser events. Use the request flow above to trace one task from its form to MongoDB and back.

## Check the project

Run backend tests in `backend`.

```powershell
npm.cmd test
```

Run frontend tests and build in `frontend`.

```powershell
npm.cmd test
npm.cmd run build
```

For a built frontend, keep the backend running, stop Vite's development server, then run `npm.cmd start` inside `frontend`. Open port 5173 again. This serves the production build with the complete offline precache.

## Included features

- Task CRUD with deadlines, priorities, categories, completion and multiple reminders with in-app popups.
- Checklist CRUD with editable items, completion and links to tasks.
- Email/password authentication, signed JWTs and ownership checks.
- Google sign-in when you add your own Google client ID.
- Offline viewing through a service worker and account-specific IndexedDB storage.
- Web Push subscriptions, an authenticated test endpoint and a reminder scheduler.
- Repository, Singleton and Simple Factory patterns.

Google sign-in requires your Google client ID. Actual push delivery requires browser notification permission and a supported connected device. The backend README explains both configurations.

Read the README inside each folder for its commands, configuration and testing instructions.
