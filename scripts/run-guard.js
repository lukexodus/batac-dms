import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const sep = args.indexOf('--');
if (sep < 2) {
  console.error('Usage: node scripts/run-guard.js <label> <lockFile> -- <command...>');
  process.exit(2);
}

const label = args[0];
const lockName = args[1];
const [bin, ...binArgs] = args.slice(sep + 1);

const LOCK_FILE = path.join(ROOT, lockName);

let lockFd = null;
let released = false;

function release() {
  if (released) return;
  released = true;
  try {
    if (lockFd !== null) fs.closeSync(lockFd);
  } catch {
    // already closed
  }
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    // already gone
  }
}

try {
  lockFd = fs.openSync(LOCK_FILE, 'wx');
} catch (err) {
  if (err.code === 'EEXIST') {
    console.log(
      `⚠️ A ${label} is already running in another process (lock: ${lockName} at the repo root).`,
    );
    console.log(
      `   Skipping this duplicate run and exiting 0 — the running ${label} covers this invocation, so this is expected, not an error.`,
    );
    console.log(
      `   If no ${label} actually appears to be running, the lock may be stale: delete ${lockName} at the repo root and re-run.`,
    );
    process.exit(0);
  }
  console.error(`Failed to acquire ${label} lock at ${LOCK_FILE}:`, err);
  process.exit(1);
}

process.on('exit', release);
process.on('uncaughtException', (err) => {
  console.error(`Uncaught exception in ${label} guard:`, err);
  process.exit(1);
});

const isWindows = process.platform === 'win32';
const binName = isWindows ? `${bin}.cmd` : bin;
const localBin = path.join(ROOT, 'node_modules', '.bin', binName);
const resolvedBin = fs.existsSync(localBin) ? localBin : bin;

const child = spawn(resolvedBin, binArgs, {
  stdio: 'inherit',
  shell: isWindows,
});

child.on('error', (err) => {
  console.error(`Failed to spawn ${resolvedBin}:`, err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`${label} terminated by signal ${signal}.`);
    process.exit(0);
  }
  process.exit(code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    } else {
      process.exit(0);
    }
  });
}
