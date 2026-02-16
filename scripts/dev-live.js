const { spawn } = require('child_process');

function usageAndExit(message) {
  if (message) console.error(message);
  console.error('');
  console.error('Set UNIECONNECT_LIVE_API to a reachable API origin, for example:');
  console.error('  set UNIECONNECT_LIVE_API=https://<your-live-api-host> && npm run dev:live');
  console.error('');
  process.exit(1);
}

const live = (process.env.UNIECONNECT_LIVE_API || '').trim().replace(/\/+$/, '');
if (!live) usageAndExit('UNIECONNECT_LIVE_API is not set.');

// Ensure both the Next.js rewrite proxy AND the browser-side config point to the same API origin.
process.env.UNIECONNECT_BACKEND_URL = live;
process.env.NEXT_PUBLIC_API_BASE = live;

console.log('[unieconnect] dev:live using API origin:', live);

// Prepare workaround for Windows dev-file issues, then start next dev.
const prepare = spawn(process.execPath, ['scripts/prepare-next-dev.js'], {
  stdio: 'inherit',
  shell: false,
  env: process.env,
});

prepare.on('exit', (code) => {
  if (code !== 0) process.exit(code || 1);

  const nextBin = process.platform === 'win32' ? 'next.cmd' : 'next';
  const child = spawn(nextBin, ['dev'], { stdio: 'inherit', env: process.env, shell: false });
  child.on('exit', (c) => process.exit(c || 0));
});

