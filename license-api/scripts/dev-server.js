import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

const rootDir = path.resolve(process.cwd());
const envPath = path.join(rootDir, '.env');
const caPath = '/tmp/apple-system-roots.pem';

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter(Boolean)
      .filter(line => !line.trim().startsWith('#'))
      .map(line => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx), line.slice(idx + 1)];
      }),
  );
}

if (!fs.existsSync(envPath)) {
  console.error('[dev-server] 缺少 .env');
  process.exit(1);
}

const envText = fs.readFileSync(envPath, 'utf8');
const extraEnv = parseEnv(envText);
const env = {
  ...process.env,
  ...extraEnv,
  NODE_EXTRA_CA_CERTS: caPath,
};

console.log('[dev-server] using NODE_EXTRA_CA_CERTS=' + caPath);

const child = spawn(process.execPath, ['server.js'], {
  cwd: rootDir,
  env,
  stdio: 'inherit',
});

child.on('exit', code => {
  process.exit(code || 0);
});
