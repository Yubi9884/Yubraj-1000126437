const SESSION_KEY = "studypass-session";
// Remember the signed-in account and login token in this browser tab.
export function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}
// Use sessionStorage so the login survives a reload in this tab and can be removed at sign-out.
export function saveSession(session) {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
}
// Send a request to the server. Include the login token to identify the user.
export async function api(path, options = {}) {
  const session = readSession();
  // Use the Vite API proxy by default and allow a different base URL through configuration.
  const baseUrl = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  // Status 204 means the delete worked and there is no response data to read.
  const data =
    response.status === 204
      ? {}
      : await response.json().catch(() => ({
          error:
            "The backend is unavailable. Check that it is running on port 4000.",
        }));
  // Pass any server error back to the page so it can show the user a message.
  if (!response.ok) {
    const error = new Error(
      data.error || "The request could not be completed.",
    );
    // Preserve the HTTP status so the app can handle an expired session differently from other failures.
    error.status = response.status;
    throw error;
  }
  return data;
}
