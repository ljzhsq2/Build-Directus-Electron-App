#!/usr/bin/env node
// Directus 启动包装器 - 直接运行 Directus CLI 的实际入口点

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Directus Wrapper Starting ===');
console.log(`Working directory: ${__dirname}`);
console.log(`Node version: ${process.version}`);

// 找到 Directus 的实际 CLI 入口点（不是 .cmd 脚本）
// 在 node_modules/directus/dist/cli/index.js 或类似位置
const possibleCLIs = [
  join(__dirname, 'node_modules', 'directus', 'dist', 'cli', 'index.js'),
  join(__dirname, 'node_modules', 'directus', 'dist', 'cli.js'),
  join(__dirname, 'node_modules', 'directus', 'dist', 'index.js'),
  join(__dirname, 'cli.js')
];

let cliPath = null;
for (const path of possibleCLIs) {
  if (existsSync(path)) {
    cliPath = path;
    console.log(`✓ Found Directus CLI at: ${path}`);
    break;
  } else {
    console.log(`  × Not found: ${path}`);
  }
}

if (!cliPath) {
  console.error('ERROR: Could not find Directus CLI entry point');
  process.exit(1);
}

// 使用当前的 Node.js 进程（Electron 以 ELECTRON_RUN_AS_NODE 模式运行）
// 来启动 Directus CLI
const args = [cliPath, 'start'];

console.log(`Executing: ${process.execPath} ${args.join(' ')}`);

const child = spawn(process.execPath, args, {
  cwd: __dirname,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1'  // 确保子进程也以 Node 模式运行
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
});

// 转发输出
child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('error', (err) => {
  console.error('Failed to start Directus:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Directus exited with code ${code}`);
  process.exit(code || 0);
});

// 信号处理
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
