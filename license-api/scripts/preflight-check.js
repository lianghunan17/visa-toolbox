import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(process.cwd());
const filesToScan = [
  path.join(rootDir, 'server.js'),
  path.join(rootDir, 'package.json'),
  path.join(rootDir, '..', 'admin.js'),
  path.join(rootDir, '..', 'admin.html'),
];

const checks = [];

function addCheck(ok, message) {
  checks.push({ ok, message });
}

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function scanDangerousPatterns() {
  for (const filePath of filesToScan) {
    const content = readIfExists(filePath);
    if (!content) {
      addCheck(false, `缺少文件: ${path.relative(rootDir, filePath)}`);
      continue;
    }

    addCheck(true, `已检查文件: ${path.relative(rootDir, filePath)}`);

    if (content.includes('NODE_TLS_REJECT_UNAUTHORIZED=0')) {
      addCheck(false, `发现危险 TLS 绕过配置: ${path.relative(rootDir, filePath)}`);
    }

    if (content.includes('DEFAULT_LOCAL_ADMIN_TOKEN')) {
      addCheck(false, `发现默认管理员 token 常量: ${path.relative(rootDir, filePath)}`);
    }

    if (content.includes('your-license-api.example.com')) {
      addCheck(false, `发现示例 API 地址尚未替换: ${path.relative(rootDir, filePath)}`);
    }
  }
}

function scanEnv() {
  const envPath = path.join(rootDir, '.env');
  const envExamplePath = path.join(rootDir, '.env.example');
  const envContent = readIfExists(envPath);
  const envExampleContent = readIfExists(envExamplePath);

  if (!envContent) {
    addCheck(false, '缺少 .env 文件');
    return;
  }

  const requiredKeys = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ADMIN_BEARER_TOKEN',
    'LICENSE_TOKEN_SECRET',
  ];

  let envOk = true;
  for (const key of requiredKeys) {
    const matched = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
    const value = matched?.[1]?.trim();
    if (!value) {
      addCheck(false, `.env 缺少 ${key}`);
      envOk = false;
      continue;
    }
    if (key === 'LICENSE_TOKEN_SECRET' && value === 'change-me') {
      addCheck(false, 'LICENSE_TOKEN_SECRET 仍是默认值 change-me');
      envOk = false;
    }
  }

  if (envOk) {
    addCheck(true, '.env 必填项检查通过');
  }

  if (envContent.includes('NODE_TLS_REJECT_UNAUTHORIZED=0')) {
    addCheck(false, '.env 中存在危险 TLS 绕过配置');
  }

  if (!envExampleContent) {
    addCheck(false, '缺少 .env.example，容易让配置项漂移');
  } else {
    addCheck(true, '.env.example 已存在');
  }
}

function printReport() {
  const failures = checks.filter(item => !item.ok);
  if (!checks.length) {
    console.log('[preflight] 未执行任何检查');
    process.exit(1);
  }

  console.log('[preflight] 检查结果');
  checks.forEach(item => {
    console.log(`${item.ok ? '✅' : '❌'} ${item.message}`);
  });

  if (failures.length) {
    console.error(`\n[preflight] 失败 ${failures.length} 项，请先修复再发布。`);
    process.exit(1);
  }

  console.log('\n[preflight] 通过，可以继续发布。');
}

scanDangerousPatterns();
scanEnv();

if (!checks.length) {
  addCheck(false, '未收集到任何检查结果');
}

printReport();
