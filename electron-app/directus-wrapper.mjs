// Directus 启动包装器 - 用于在 Electron 中以 ES Module 模式启动 Directus
// 禁用 Electron 相关的环境变量，避免单实例检测冲突
delete process.env.ELECTRON_RUN_AS_NODE;
delete process.env.ELECTRON_NO_ATTACH_CONSOLE;

import('./cli.js').catch(err => {
  console.error('Failed to start Directus:', err);
  process.exit(1);
});
