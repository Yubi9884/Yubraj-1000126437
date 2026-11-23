import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const url = `http://${host}:5173/`;
const args = process.argv.slice(2);

// Check the page title and Vite entry points before reusing an existing server on port 5173.
async function isStudyPassRunning() {
  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("text/html")) {
      return false;
    }
    const html = await response.text();
    return html.includes("<title>StudyPass NZ · Your student workspace</title>") &&
      html.includes('src="/@vite/client"') &&
      /<script\b[^>]*\ssrc="\/src\/main\.jsx(?:\?[^"<>]*)?"/.test(html);
  } catch {
    return false;
  }
}

if (args.length === 0 && await isStudyPassRunning()) {
  console.log(`StudyPass is already running. Open ${url}`);
} else {
  // Launch the installed Vite CLI with this Node version and forward any extra arguments.
  const vitePackage = import.meta.resolve("vite/package.json");
  const vite = fileURLToPath(new URL("./bin/vite.js", vitePackage));
  const child = spawn(process.execPath, [vite, "--host", host, ...args], {
    stdio: "inherit",
  });
  child.on("error", (error) => {
    console.error(`Could not start Vite: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
  });
}
