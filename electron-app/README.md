# Electron App 配置文件

这个目录包含用于构建 Directus Desktop 应用的 Electron 配置文件。

## 文件说明

### package.json.template
Electron 应用的 package.json 模板文件。构建时会将 `VERSION_PLACEHOLDER` 替换为实际的版本号。

**包含配置:**
- Electron 和 electron-builder 依赖
- 构建脚本和配置
- NSIS 安装程序设置
- 文件打包规则

### main.js
Electron 主进程文件，负责：
- 启动 Directus 服务器进程
- 创建主窗口
- 处理日志记录
- 管理应用生命周期
- 查找和启动 Directus CLI

### preload.js
Electron 预加载脚本，提供安全的 IPC 通信桥接：
- `getAppPath()` - 获取应用数据目录
- `openExternal(url)` - 在外部浏览器中打开链接
- `getStartupLogs()` - 获取启动日志

## 本地开发测试

如果你想在本地测试这些配置文件：

```bash
# 1. 将文件复制到工作目录
cp electron-app/package.json.template package.json
cp electron-app/main.js .
cp electron-app/preload.js .

# 2. 替换版本号
sed -i 's/VERSION_PLACEHOLDER/1.0.0/g' package.json

# 3. 确保有 directus-app 目录（从 Docker 提取或本地安装）

# 4. 安装依赖
npm install

# 5. 运行
npm start

# 6. 构建
npm run build
```

## 修改指南

- **修改窗口大小/样式**: 编辑 `main.js` 中的 `createWindow()` 函数
- **修改启动配置**: 编辑 `main.js` 中的 `startDirectus()` 函数的 `env` 变量
- **修改安装程序**: 编辑 `package.json.template` 中的 `build.nsis` 部分
- **添加 IPC 通信**: 在 `preload.js` 中添加新的 API，在 `main.js` 中添加对应的 handler

## 注意事项

1. **不要直接修改 GitHub Action 中的内联代码** - 修改这个目录中的文件即可
2. **测试更改** - 在本地测试后再推送到 GitHub
3. **版本号** - `VERSION_PLACEHOLDER` 会在构建时自动替换
4. **图标文件** - 如果需要自定义图标，在仓库根目录添加 `icon.ico` 文件
