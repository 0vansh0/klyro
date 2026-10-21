import { spawn } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;
const port = process.env.PORT || 5000;
const healthUrl = `http://127.0.0.1:${port}/api/health`;
let server = null;
let vite = null;
let stopping = false;
let backendSupervisionEnabled = false;
let restartTimer = null;
let serverExited = false;

function stopChildren() {
  if (stopping) return;
  stopping = true;
  if (restartTimer) clearTimeout(restartTimer);
  server?.kill();
  vite?.kill();
}

function scheduleBackendRestart() {
  if (stopping || !backendSupervisionEnabled || restartTimer) return;
  console.warn("Restarting the KLYRO API in 2 seconds…");
  restartTimer = setTimeout(() => {
    restartTimer = null;
    launchBackend();
  }, 2000);
}

function launchBackend() {
  if (stopping) return;
  serverExited = false;
  server = spawn(node, [path.join(root, "server", "server.js")], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  server.on("error", (error) => {
    console.error("Could not start the analysis server:", error.message);
    serverExited = true;
    scheduleBackendRestart();
  });
  server.on("exit", (code) => {
    serverExited = true;
    if (!stopping && code !== 0) console.error(`Analysis server exited with code ${code}.`);
    scheduleBackendRestart();
  });
}

process.on("SIGINT", stopChildren);
process.on("SIGTERM", stopChildren);

async function backendIsReady(timeoutMs = 1000) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return false;
    const health = await response.json();
    return health.service === "KLYRO API";
  } catch {
    return false;
  }
}

// Reuse the backend when another terminal or an earlier dev run already started it.
let ready = await backendIsReady();
if (!ready) {
  launchBackend();

  for (let attempt = 0; attempt < 40 && !stopping && !serverExited; attempt += 1) {
    ready = await backendIsReady(700);
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

if (!ready) {
  console.error(`Analysis server is unavailable at ${healthUrl}. Check its port and try again.`);
  stopChildren();
  process.exitCode = 1;
} else if (!stopping) {
  backendSupervisionEnabled = Boolean(server);
  vite = spawn(node, [path.join(root, "node_modules", "vite", "bin", "vite.js")], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  vite.on("error", (error) => {
    console.error("Could not start the Vite dev server:", error.message);
    stopChildren();
    process.exitCode = 1;
  });
  vite.on("exit", (code) => {
    if (!stopping) {
      stopChildren();
      process.exitCode = code || 0;
    }
  });
}
