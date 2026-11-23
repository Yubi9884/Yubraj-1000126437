import { openDB } from "idb";
// IndexedDB is browser storage. Keep each account's offline data here.
const db = () =>
  openDB("studypass-offline", 1, {
    // Create the workspace store when IndexedDB first opens version 1.
    upgrade(database) {
      database.createObjectStore("workspaces");
    },
  });
export async function saveWorkspace(userId, data) {
  const database = await db();
  // Save the data under the user's ID so each account can load its own copy.
  await database.put(
    "workspaces",
    { ...data, savedAt: new Date().toISOString() },
    userId,
  );
}
// Read the saved copy for the signed-in account when the API cannot be reached.
export async function loadWorkspace(userId) {
  const database = await db();
  return database.get("workspaces", userId);
}
// Delete this account's saved data when the user signs out.
export async function clearWorkspace(userId) {
  const database = await db();
  await database.delete("workspaces", userId);
}
