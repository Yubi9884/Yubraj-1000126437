import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

// Run the backend in a child process and capture its output and exit status.
function launchBackend(environment, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/server.js', ...args], {
      cwd: backendDirectory,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Backend did not report its startup error in time.'));
    }, 10000);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('close', (code) => { clearTimeout(timeout); resolve({ code, output }); });
  });
}

describe('Backend startup', () => {
  it('leaves an unrelated listener on the API port alone', async () => {
    const occupied = createServer((request, response) => response.end('original server'));
    servers.push(occupied);
    await new Promise((resolve) => occupied.listen(0, '127.0.0.1', resolve));
    const port = occupied.address().port;
    const result = await launchBackend({ PORT: String(port), HOST: '127.0.0.1', MONGODB_URI: '' });
    expect(result.code).toBe(1);
    expect(result.output).toContain(`port ${port} is already in use`);
    expect(result.output).not.toContain('database_starting');
    expect(result.output).not.toContain('SyntaxError');
    expect(await (await fetch(`http://127.0.0.1:${port}`)).text()).toBe('original server');
  });

  // Check that a StudyPass listener is reused while starting and after it is ready.
  it.each([
    { statusCode: 200, status: 'ok', message: 'already running', args: [] },
    { statusCode: 503, status: 'starting', message: 'starting', args: ['--local'] },
  ])('reuses a StudyPass listener with status $status', async ({ statusCode, status, message, args }) => {
    const existing = createServer((request, response) => {
      expect(request.url).toBe('/api/health');
      response.writeHead(statusCode, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ service: 'StudyPass NZ API', status }));
    });
    servers.push(existing);
    await new Promise((resolve) => existing.listen(0, '127.0.0.1', resolve));
    const port = existing.address().port;
    const result = await launchBackend({ PORT: String(port), HOST: '127.0.0.1', MONGODB_URI: '' }, args);

    expect(result.code).toBe(0);
    expect(result.output).toContain(`StudyPass API is ${message}.`);
    expect(result.output).not.toContain('Starting StudyPass with local MongoDB');
  });

  it('reports an invalid port without starting MongoDB', async () => {
    const result = await launchBackend({ PORT: 'invalid-port' });
    expect(result.code).toBe(1);
    expect(result.output).toContain('PORT must be a number');
    expect(result.output).not.toContain('database_starting');
  });
});
