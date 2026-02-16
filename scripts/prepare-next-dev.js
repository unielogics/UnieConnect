const fs = require('fs');
const path = require('path');

function ensureFile(filePath, contents) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, contents);
  }
}

try {
  const root = process.cwd();
  const serverDir = path.join(root, '.next', 'server');

  // Next dev occasionally fails to generate this on Windows, but still tries to read it.
  // An empty manifest is valid when no middleware is present.
  ensureFile(path.join(serverDir, 'middleware-manifest.json'), JSON.stringify({ version: 1, middleware: {}, functions: {} }));
} catch (err) {
  // Don't block dev startup; this is a best-effort workaround.
  // eslint-disable-next-line no-console
  console.warn('[prepare-next-dev] warning:', err && err.message ? err.message : err);
}

