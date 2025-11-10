#!/usr/bin/env node
/**
 * Directus 11.5.1 Server Launcher
 *
 * 这个脚本使用 CommonJS 格式，避免 ES Module 的所有问题
 * 直接启动 Directus 服务器，不依赖 CLI
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('═══════════════════════════════════════════════');
console.log('  Directus 11.5.1 Server Launcher');
console.log('═══════════════════════════════════════════════');
console.log(`Node version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Working directory: ${__dirname}`);
console.log('');

// 验证环境变量
const requiredEnvVars = {
  'PORT': process.env.PORT,
  'DB_CLIENT': process.env.DB_CLIENT,
  'DB_FILENAME': process.env.DB_FILENAME,
  'KEY': process.env.KEY,
  'SECRET': process.env.SECRET,
  'ADMIN_EMAIL': process.env.ADMIN_EMAIL,
  'ADMIN_PASSWORD': process.env.ADMIN_PASSWORD
};

console.log('Environment Configuration:');
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  const display = ['KEY', 'SECRET', 'ADMIN_PASSWORD'].includes(key)
    ? (value ? '***' : 'missing')
    : value;
  console.log(`  ${key}: ${display || '❌ NOT SET'}`);
});
console.log('');

// 确保必要的目录存在
const directories = [
  process.env.DB_FILENAME ? path.dirname(process.env.DB_FILENAME) : null,
  process.env.STORAGE_LOCAL_ROOT,
  process.env.EXTENSIONS_PATH
].filter(Boolean);

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
});

console.log('');
console.log('🚀 Starting Directus server...');
console.log('');

// 查找 Directus CLI
const directusCli = path.join(__dirname, 'node_modules', '.bin', 'directus');
const directusCmd = process.platform === 'win32' ? `${directusCli}.cmd` : directusCli;

// 检查 CLI 是否存在
if (!fs.existsSync(directusCmd)) {
  console.error('❌ ERROR: Directus CLI not found!');
  console.error(`   Expected location: ${directusCmd}`);
  console.error('');
  console.error('   Please ensure Directus is installed:');
  console.error('   npm install');
  process.exit(1);
}

console.log(`✓ Found Directus CLI: ${directusCmd}`);
console.log('');

// 使用 node 直接运行 Directus 的 JS 入口点，而不是 .cmd
// 这样可以完全控制执行环境
const directusEntry = path.join(__dirname, 'node_modules', 'directus', 'cli.js');

if (!fs.existsSync(directusEntry)) {
  console.error('❌ ERROR: Directus entry point not found!');
  console.error(`   Expected: ${directusEntry}`);
  process.exit(1);
}

console.log('Starting with: node directus/cli.js start');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// 启动 Directus
// 注意：我们使用当前的 node 进程来运行，而不是创建子进程
// 这样可以避免所有进程管理的问题

// 设置命令行参数
process.argv = [
  process.argv[0],  // node 路径
  directusEntry,    // directus cli.js 路径
  'start'           // 启动命令
];

// 清理可能干扰的环境变量
delete process.env.ELECTRON_RUN_AS_NODE;

// 直接 require Directus CLI 入口点
// 由于我们设置了 package.json 的 type: "commonjs"
// 这个 require 会在 CommonJS 模式下运行
try {
  // 首先尝试修改 Directus 的 package.json 让它使用 CommonJS
  const directusPkgPath = path.join(__dirname, 'node_modules', 'directus', 'package.json');
  if (fs.existsSync(directusPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(directusPkgPath, 'utf8'));

    // 如果 Directus 是 ES Module，我们需要用不同的方式
    if (pkg.type === 'module') {
      console.log('⚠️  Directus is an ES Module package');
      console.log('   Using alternative loading strategy...');
      console.log('');

      // 使用 node 的子进程来运行，传递所有环境变量
      const child = spawn(process.execPath, [directusEntry, 'start'], {
        cwd: __dirname,
        env: process.env,
        stdio: 'inherit'
      });

      child.on('error', (error) => {
        console.error('❌ Failed to start Directus:', error.message);
        process.exit(1);
      });

      child.on('exit', (code) => {
        console.log(`\nDirectus process exited with code ${code}`);
        process.exit(code);
      });

      // 处理退出信号
      process.on('SIGTERM', () => child.kill('SIGTERM'));
      process.on('SIGINT', () => child.kill('SIGINT'));

    } else {
      // CommonJS 模式，直接 require
      console.log('✓ Loading Directus in CommonJS mode');
      require(directusEntry);
    }
  }
} catch (error) {
  console.error('❌ Failed to start Directus:');
  console.error(error.message);
  if (error.stack) {
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
  }
  process.exit(1);
}
