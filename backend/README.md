# Backend

The backend is an Express REST API using MongoDB. Run its commands from this folder.

On Windows, double-click **Start Backend.bat** inside this folder. It installs missing dependencies and starts the backend. It uses Atlas when `MONGODB_URI` is set and local MongoDB when the address is blank.

To start with Atlas from a terminal, configure the connection below and run these commands.

```powershell
npm.cmd install
npm.cmd run dev
```

Check **http://127.0.0.1:4000/api/health**. The response reports `status` as `ok` and `database` as `connected`.

## Structure

| Folder | Purpose |
| --- | --- |
| `src/routes/` | Connect URLs and HTTP methods to controllers |
| `src/controllers/` | Read the request and send the response |
| `src/services/` | Validate data, apply planner rules and send reminders |
| `src/repositories/` | Query MongoDB with ownership filters |
| `src/middleware/` | Verify JWTs and handle errors |
| `src/config/` | Share a MongoDB connection pool |
| `src/utils/` | Errors and structured logging |
| `tests/` | Unit tests and API integration tests |
| `postman/` | API requests and assertions for Postman |

## Configuration

Startup creates `.env` from `.env.example` and generates a random JWT secret and VAPID key pair. Run `npm.cmd run setup` to generate missing values separately.

Set the Atlas connection in `.env`:

```dotenv
MONGODB_URI=mongodb+srv://YOUR-CLUSTER.mongodb.net/
MONGODB_USERNAME=your-database-user
MONGODB_PASSWORD="your-database-password"
MONGODB_DATABASE=studypass
```

Copy the address from your Atlas cluster's **Connect > Drivers** screen. Use an Atlas database user with read/write access to `studypass`, and allow your computer's IP address in the cluster's network access settings. See the [official Atlas connection instructions](https://www.mongodb.com/docs/atlas/driver-connection/).

The username and password fields are passed directly to the MongoDB driver, so symbols in the password do not need URL encoding. If your connection string already includes login details, leave `MONGODB_USERNAME` and `MONGODB_PASSWORD` empty. Restart the backend after changing `.env`.

Atlas startup requires a connection address and a password if you configure a separate username. Once connected, accounts, tasks, checklists and reminder device details are stored in the Atlas database. Existing local application data is not automatically moved to Atlas.

Run `npm.cmd run start:local` to start the backend with MongoDB on this computer. The command uses `LOCAL_DATA_DIR` for persistent workspace data and `MONGOMS_DOWNLOAD_DIR` for the MongoDB binary. On this computer they point to E: because C: has limited space. Integration tests use separate data files.

Email/password login works with the generated JWT secret. Passwords are hashed with bcrypt. Each protected query includes the user ID from the verified token. JWT sessions last eight hours.

To enable Google sign-in, create a Web OAuth client in Google Cloud, authorise `http://localhost:5173` and `http://127.0.0.1:5173` as JavaScript origins, set `GOOGLE_CLIENT_ID`, and restart. The backend verifies the Google ID token before issuing an application JWT.

Set `NODE_ENV=production` when deploying and serve traffic over HTTPS. Production mode disables sample-account creation.

## Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Start the backend and watch source changes |
| `npm.cmd start` | Start the backend |
| `npm.cmd run start:local` | Start the backend with local MongoDB |
| `npm.cmd run build` | Check the backend JavaScript files for syntax errors |
| `npm.cmd run setup` | Generate local configuration and keys |
| `npm.cmd test` | Run unit and real MongoDB integration tests |

The integration tests use a separate database process and test directory. They cover two students' ownership isolation, CRUD operations, invalid input, password hashing, expired tokens, checklist links and reminder delivery behavior.

The backend runs directly as JavaScript. Its build command validates the source files. Run the frontend build from the `frontend` folder to produce the browser application.

## Postman

Start the backend and confirm it reports a connected database at `http://127.0.0.1:4000/api/health`. Import both JSON files from `postman/`, select the **StudyPass Local** environment, and run **StudyPass NZ API** from the Collection Runner. Register generates a unique sample email on each run. Login uses that email and saves the JWT in the selected environment. To test with an existing test account, enter its email and password in the environment and run Login separately.

The collection creates a checklist and a linked task. It reads each record again after updating it and expects HTTP 404 after deletion. It also checks that the API rejects invalid data and missing tokens. The push endpoint returns HTTP 409 when the sample account has no subscribed device.

Use the Collection Runner result for a summary of the checks. For screenshots of individual requests, show the request method, URL, response status and relevant response fields. Keep tokens, passwords and connection details out of screenshots.

## Push reminders

Open Reminders in the frontend and click **Send test notification**. Allow notifications if your browser asks. For a Postman push test, log into the same account used by that browser.

A task can have any combination of reminders at one week, three days, one day, one hour or five minutes before its deadline. Send an array such as `"reminders": ["day", "hour"]` when creating or updating a task through the API. An empty array clears its reminders. To demonstrate one soon, choose a deadline seven minutes ahead and select the five-minute reminder. The in-app popup appears when a reminder is due, including at the next workspace opening. The backend checks due reminders for device delivery every minute and must remain running for push.

Messages use the browser subscription's encryption keys and server VAPID authentication. The scheduler marks a task sent after the push service accepts a message. Expired subscriptions are removed. A failed delivery remains available for a later retry. Run one scheduler process for this version.

## Debugging

Use the root VS Code configuration named Backend API. Set a breakpoint in `src/services/planner.js`, send a Postman request and inspect the verified user ID and task values. Logs contain the request method, path, status and duration.

If another program is using port 4000, stop that program before starting StudyPass. If Atlas cannot connect, check the connection address, database user's password and cluster IP access list. Local startup and integration tests download MongoDB if the binary is missing.

Startup reserves port 4000 before preparing MongoDB. If StudyPass is already running or starting, a repeat launch reports the existing backend. Press Ctrl+C in the original backend terminal to stop it. While the database is connecting, the health endpoint returns HTTP 503 with a starting status.
