import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import webpush from "web-push";
import { fileURLToPath } from "node:url";

// Prepare local JWT and web push configuration when the API starts or the setup script runs.
export async function setup() {
  // Read the settings file, or use the example if no settings file exists yet.
  const target = new URL("../.env", import.meta.url);
  let contents;
  try {
    contents = await readFile(target, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    contents = await readFile(
      new URL("../.env.example", import.meta.url),
      "utf8",
    );
  }
  // Create login and reminder keys to fill in any missing settings.
  const keys = webpush.generateVAPIDKeys();
  const values = {
    JWT_SECRET: randomBytes(48).toString("hex"),
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  };
  let changed = false;
  for (const [name, value] of Object.entries(values)) {
    // Add missing values but keep any keys that have already been set.
    const empty = new RegExp(`^${name}=\\s*$`, "m");
    if (empty.test(contents)) {
      contents = contents.replace(empty, `${name}=${value}`);
      changed = true;
    } else if (!new RegExp(`^${name}=`, "m").test(contents)) {
      contents += `\n${name}=${value}\n`;
      changed = true;
    }
  }
  if (changed) await writeFile(target, contents, { mode: 0o600 });
  return fileURLToPath(target);
}

// Only print the setup confirmation when this script is run directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await setup();
  console.log(
    "Local configuration is ready. Private keys remain in .env. Run npm run dev.",
  );
}
