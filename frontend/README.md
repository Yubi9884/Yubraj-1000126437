# Frontend

The frontend is a React application built with Vite. Run its commands from this folder.

On Windows, double-click **Start Frontend.bat** inside this folder. It installs missing dependencies and starts the frontend.

```powershell
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. Start the backend separately on port 4000.

If the StudyPass development server is already running on port 5173, `npm.cmd run dev` prints its address. Keep the original server terminal open.

## Files to edit

| File or folder | Purpose |
| --- | --- |
| `src/pages/LoginPage.jsx` | Sign in, create account and sample workspace |
| `src/pages/PlannerPage.jsx` | Task list, filters and calendar |
| `src/pages/ChecklistsPage.jsx` | Checklist list and progress |
| `src/pages/RemindersPage.jsx` | Device reminders and scheduled tasks |
| `src/components/forms/` | Task and checklist forms |
| `src/components/details/` | Details and checklist item completion |
| `src/components/Layout.jsx` | Navigation and account button |
| `src/services/api.js` | HTTP requests and JWT request headers |
| `src/services/offline.js` | Saved account data in IndexedDB |
| `src/utils/helpers.js` | Date labels, task filters and progress |
| `src/styles.css` | Responsive appearance |
| `public/sw.js` | App caching and push events |

`App.jsx` coordinates shared state and opens the appropriate form or details dialog. Page components display the selected view. Form components collect input and call their `onSave` handler.

## Configuration

The default API prefix is `/api`. Vite forwards it to `http://127.0.0.1:4000`. Both development and production preview use this proxy.

For a separately hosted API, copy `.env.example` to `.env`, set `VITE_API_URL` to the API's full HTTPS URL, then rebuild. Frontend environment variables are public. Keep server secrets in the backend.

## Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Development frontend on port 5173 |
| `npm.cmd test` | Page rendering and service worker tests |
| `npm.cmd run build` | Build the frontend and complete offline precache |
| `npm.cmd start` | Serve the built frontend on port 5173 |

## Offline demonstration

1. Run `npm.cmd run build`, then `npm.cmd start` after stopping the development frontend.
2. Keep the backend running and sign in at port 5173.
3. Load tasks and checklists online.
4. Inspect Service Workers, Cache Storage and IndexedDB in browser developer tools.
5. Set the browser network to Offline and reload.
6. The saved workspace opens in view-only mode. Reconnect to make changes.

Sign-out clears the account's saved offline data. A new sign-in requires a connection. Browser notification permission is requested only through the Enable reminders button.
