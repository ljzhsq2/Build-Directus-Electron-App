// Directus 启动包装器 - 用于在 Electron 中以 ES Module 模式启动 Directus
import('./cli.js').catch(err => {
  console.error('Failed to start Directus:', err);
  process.exit(1);
});
