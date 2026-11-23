import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
let checked = 0;

// Check every JavaScript file for syntax errors without starting the app.
async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      await checkDirectory(file);
      continue;
    }
    if (!/\.(js|mjs)$/.test(entry.name)) continue;
    // Run the current Node executable in syntax-check mode and surface any parse error in the terminal.
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
    checked++;
  }
}

await checkDirectory(join(backendDirectory, 'src'));
await checkDirectory(join(backendDirectory, 'scripts'));
console.log(`Backend build check passed for ${checked} JavaScript files.`);
console.log('Run npm run dev for development, or npm start to run the backend.');
