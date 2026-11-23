import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Show the React app inside the root box in index.html.
createRoot(document.getElementById("root")).render(<App />);

// A service worker runs in the browser background to save files and show reminders.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // Wait for an active worker before asking it to cache the resources reported by the browser.
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      // Collect files to save while developing. The build creates its own file list.
      const cacheDevelopmentFiles = () =>
        registration.active?.postMessage({
          type: "CACHE_DEV_FILES",
          urls: performance
            .getEntriesByType("resource")
            .map((resource) => resource.name),
        });
      cacheDevelopmentFiles();
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        cacheDevelopmentFiles,
        { once: true },
      );
    } catch (error) {
      console.warn("Offline support could not be registered:", error.message);
    }
  });
}
