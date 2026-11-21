#!/usr/bin/env node
// Cross-platform setup (Node 18+, Playwright + Chromium, Tone.js).
//   node setup.mjs [project-dir]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = process.argv[2] ? path.resolve(process.argv[2]) : '';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function hasDeps(dir) {
  return dir && fs.existsSync(path.join(dir, 'node_modules', 'playwright')) && fs.existsSync(path.join(dir, 'node_modules', 'tone'));
}
function isWritable(dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; }
}
function run(cmd, argv, cwd) {
  const r = spawnSync(cmd, argv, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status === 0;
}

if (hasDeps(HERE) || hasDeps(PROJ)) {
  console.log('✓ playwright + tone already installed');
} else if (isWritable(HERE)) {
  console.log(`→ installing playwright + tone into ${HERE}`);
  if (!run(npmCmd, ['install', '--no-audit', '--no-fund', '--loglevel=error'], HERE)) process.exit(1);
} else if (PROJ) {
  console.log(`→ skill folder is read-only; installing playwright into ${PROJ}`);
  if (!run(npmCmd, ['install', '--no-audit', '--no-fund', '--loglevel=error', '-D', 'playwright', 'tone@15.1.22'], PROJ)) process.exit(1);
} else {
  console.error(`✗ ${HERE} is read-only. Re-run with a project folder: node setup.mjs <project-dir>`);
  process.exit(1);
}

if (!run(npxCmd, ['--yes', 'playwright', 'install', 'chromium'], PROJ || HERE)) {
  console.log('! could not download Chromium; render.mjs will fall back to an installed Google Chrome / Edge');
}
execFileSync(process.execPath, [path.join(HERE, 'check-env.mjs'), ...(PROJ ? [PROJ] : [])], { stdio: 'inherit' });
