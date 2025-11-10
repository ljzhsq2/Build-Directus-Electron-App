#!/usr/bin/env node
// Directus 启动包装器 - 使用动态 import 加载 ES Module

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Directus Wrapper Starting ===');
console.log(`Working directory: ${__dirname}`);
console.log(`Node version: ${process.version}`);

// 找到 Directus 的实际 CLI 入口点
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

// 关键修复：使用动态 import() 来加载 ES Module
// 这样可以正确处理 .js 文件的 ES Module
console.log(`Loading Directus CLI via dynamic import...`);

// 设置命令行参数，让 Directus CLI 认为是从命令行启动的
process.argv = [
  process.argv[0],  // node 路径
  cliPath,          // CLI 脚本路径
  'start'           // 命令
];

try {
  // 动态导入 CLI 模块
  // 使用 file:// URL 协议确保正确解析路径
  const cliUrl = `file:///${cliPath.replace(/\\/g, '/')}`;
  console.log(`Import URL: ${cliUrl}`);

  await import(cliUrl);

  // CLI 通常会接管进程，所以这里不应该到达
  console.log('Directus CLI imported successfully');
} catch (error) {
  console.error('Failed to load Directus CLI:', error);
  console.error('Error details:', error.message);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
