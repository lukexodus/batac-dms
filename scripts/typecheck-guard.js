import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCK_FILE = path.join(ROOT, '.typecheck.lock');

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
    console.log('⚠️ Typecheck is already running. Skipping duplicate execution.');
    process.exit(0);
  }
  console.error(`Failed to acquire typecheck lock at ${LOCK_FILE}:`, err);
  process.exit(1);
}

process.on('exit', release);
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in typecheck guard:', err);
  process.exit(1);
});

const isWindows = process.platform === 'win32';
const turboName = isWindows ? 'turbo.cmd' : 'turbo';
const localBin = path.join(ROOT, 'node_modules', '.bin', turboName);
const turboBin = fs.existsSync(localBin) ? localBin : turboName;

const child = spawn(turboBin, ['run', 'typecheck'], {
  stdio: 'inherit',
  shell: isWindows,
});

child.on('error', (err) => {
  console.error(`Failed to spawn ${turboBin}:`, err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Typecheck terminated by signal ${signal}.`);
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
