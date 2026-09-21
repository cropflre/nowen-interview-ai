import { spawn } from 'node:child_process';

const jobs = [
  spawn(process.execPath, ['--watch', 'server/index.mjs'], { stdio: 'inherit' }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev:web'], { stdio: 'inherit' }),
];
let stopped = false;
function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  for (const job of jobs) job.kill();
  process.exitCode = code;
}
for (const job of jobs) job.on('exit', (code) => stop(code || 0));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
