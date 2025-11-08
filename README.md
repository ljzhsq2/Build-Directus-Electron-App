# Directus Electron App - 问题修复说明

## 🔍 问题诊断

### 原始错误
根据日志 `directus.log`，应用启动时出现以下错误：

```
ERROR: Could not find Directus CLI in any expected location
Error reading directory: ENOENT: no such file or directory, 
scandir 'C:\Users\User\AppData\Local\Programs\Directus\resources\app.asar.unpacked\directus-app'
```

**核心问题**：
1. `directus-app` 目录在打包后的应用中不存在
2. Docker 提取的文件没有正确打包到最终的 Electron 应用中

---

## 🛠️ 修复方案

### 1. **修复 Docker 文件提取 (extract-directus job)**

#### 修复内容：
- ✅ 修改提取路径：从 `/directus` 提取到 `directus-app/` 目录
- ✅ 添加详细验证步骤，确认文件结构
- ✅ 改进符号链接处理逻辑
- ✅ 添加 CLI 文件查找验证

#### 关键改动：
```bash
# 原来：直接提取到 directus-files
docker cp directus-temp:/directus ./directus-files

# 修复后：创建目录并提取
mkdir -p directus-app
docker cp directus-temp:/directus/. ./directus-app/
```

---

### 2. **修复 Windows 构建阶段 (build-windows job)**

#### 修复内容：
- ✅ 改进解压验证逻辑
- ✅ 添加关键文件检查（cli.js, package.json 等）
- ✅ 详细的错误提示和调试信息
- ✅ 确保 `directus-app` 目录正确传递到构建阶段

#### 关键改动：
```bash
# 添加多个验证步骤
- 验证下载的 tar.gz 文件
- 验证解压后的目录结构
- 检查关键文件是否存在
- 构建前最终验证
```

---

### 3. **修复 Electron Builder 配置 (package.json)**

#### 修复内容：
- ✅ 确保 `directus-app/**/*` 包含在打包文件中
- ✅ 添加 `asarUnpack` 配置，将整个 `directus-app` 解压到 `app.asar.unpacked`
- ✅ 改进文件过滤规则，减少打包体积

#### 关键改动：
```json
{
  "build": {
    "files": [
      "main.js",
      "preload.js",
      "icon.ico",
      "directus-app/**/*"  // 包含所有 directus 文件
    ],
    "asarUnpack": [
      "directus-app/**/*"  // 解压到 app.asar.unpacked
    ]
  }
}
```

**为什么需要 `asarUnpack`？**
- Electron 默认将文件打包到 `app.asar` 归档中
- Node.js 的某些模块（如 better-sqlite3）需要访问实际的文件系统
- `asarUnpack` 确保这些文件被解压到 `app.asar.unpacked/` 目录

---

### 4. **优化路径查找逻辑 (main.js)**

#### 修复内容：
- ✅ 改进 `getDirectusPath()` 函数，支持多种路径
- ✅ 添加备用路径尝试机制
- ✅ 详细的路径验证和日志记录
- ✅ 改进 `findDirectusCLI()` 函数，支持更多 CLI 位置

#### 关键改动：
```javascript
function getDirectusPath() {
  let directusPath;
  
  if (app.isPackaged) {
    // 打包后：优先使用 app.asar.unpacked 路径
    directusPath = path.join(
      process.resourcesPath, 
      'app.asar.unpacked', 
      'directus-app'
    );
  } else {
    // 开发模式
    directusPath = path.join(__dirname, 'directus-app');
  }
  
  // 如果主路径不存在，尝试备用路径
  if (!fs.existsSync(directusPath)) {
    const alternativePaths = [
      path.join(process.resourcesPath, 'directus-app'),
      path.join(app.getAppPath(), 'directus-app'),
      path.join(__dirname, 'directus-app')
    ];
    
    for (const altPath of alternativePaths) {
      if (fs.existsSync(altPath)) {
        directusPath = altPath;
        break;
      }
    }
  }
  
  return directusPath;
}
```

---

### 5. **增强错误处理和日志**

#### 修复内容：
- ✅ 添加应用启动时的系统信息日志
- ✅ 详细记录路径查找过程
- ✅ 列出目录内容帮助诊断
- ✅ 改进错误对话框，提供日志位置
- ✅ 在加载页面显示实时启动日志

#### 关键改动：
```javascript
// 启动时记录关键信息
log('=== Application Starting ===');
log(`App version: ${app.getVersion()}`);
log(`Electron version: ${process.versions.electron}`);
log(`Is packaged: ${app.isPackaged}`);
log(`Resources path: ${process.resourcesPath}`);

// 如果找不到目录，列出可用内容
if (!fs.existsSync(directusPath)) {
  log('Listing process.resourcesPath contents:');
  const items = fs.readdirSync(process.resourcesPath);
  items.forEach(item => log(`  - ${item}`));
}
```

---

## 📋 验证清单

构建流程中添加了多个验证点：

### Extract 阶段：
- ✅ 验证 Docker 镜像拉取
- ✅ 验证文件提取
- ✅ 验证 CLI 入口点存在
- ✅ 验证符号链接处理
- ✅ 验证打包文件大小

### Build 阶段：
- ✅ 验证 artifact 下载
- ✅ 验证解压后的目录结构
- ✅ 验证关键文件存在
- ✅ 验证 package.json 配置
- ✅ 验证最终构建输出

### Runtime 阶段：
- ✅ 验证 directus-app 路径
- ✅ 验证 CLI 文件可访问
- ✅ 验证进程启动
- ✅ 验证健康检查端点

---

## 🚀 使用新版本

### 触发构建：

**方式 1：手动触发**
```bash
# 在 GitHub Actions 页面手动触发
# 输入版本号，例如：1.0.1
```

**方式 2：标签触发**
```bash
git tag v1.0.1
git push origin v1.0.1
```

### 预期结果：

1. ✅ Extract 阶段成功提取 Directus 文件
2. ✅ Build 阶段成功创建安装包
3. ✅ 安装包运行时能找到 `directus-app` 目录
4. ✅ 应用正常启动 Directus 服务
5. ✅ 用户可以访问 `http://localhost:8055/admin`

---

## 🐛 调试指南

如果仍然遇到问题，按以下步骤调试：

### 1. 检查构建日志
- 查看 GitHub Actions 的完整日志
- 重点关注 "Extract Directus files" 和 "Verify directus-app before build" 步骤

### 2. 检查本地日志
安装应用后，查看日志文件：
```
C:\Users\<用户名>\AppData\Roaming\directus-desktop\directus.log
```

关键信息：
- `Resources path`: 查看资源路径
- `Checking: ...`: 查看尝试的 CLI 路径
- `Directory contents`: 查看实际可用的文件

### 3. 按 F12 查看实时日志
- 启动应用后按 F12 打开开发者工具
- 查看 Console 中的详细日志

### 4. 手动验证打包结果
下载并解压安装包后，检查：
```
resources\
├── app.asar              (主应用归档)
└── app.asar.unpacked\    (解压的文件)
    └── directus-app\     (应该包含 Directus 文件)
        ├── cli.js        (或 dist/cli.js)
        ├── package.json
        └── node_modules\
```

---

## 📊 技术细节

### Electron 打包机制

```
打包前:
project/
├── main.js
├── directus-app/
│   ├── cli.js
│   └── node_modules/

打包后:
resources/
├── app.asar                      (压缩归档)
│   ├── main.js
│   └── preload.js
└── app.asar.unpacked/            (未压缩文件)
    └── directus-app/
        ├── cli.js
        └── node_modules/
```

### 路径解析优先级

1. `process.resourcesPath/app.asar.unpacked/directus-app` (打包后优先)
2. `process.resourcesPath/directus-app` (备用路径 1)
3. `app.getAppPath()/directus-app` (备用路径 2)
4. `__dirname/directus-app` (开发模式)

---

## ✅ 修复总结

| 问题 | 原因 | 解决方案 | 状态 |
|------|------|----------|------|
| directus-app 不存在 | Docker 文件提取路径错误 | 修改为 `docker cp ... ./directus-app/` | ✅ |
| 目录结构不对 | 解压逻辑有误 | 改进解压和验证逻辑 | ✅ |
| 打包后找不到文件 | 未配置 asarUnpack | 添加 `asarUnpack: ["directus-app/**/*"]` | ✅ |
| CLI 路径查找失败 | 只检查单一路径 | 添加多路径尝试机制 | ✅ |
| 错误信息不清晰 | 缺少调试日志 | 添加详细日志和验证步骤 | ✅ |

---

## 🎯 下一步

1. **测试新版本**：触发新的构建并下载测试
2. **验证功能**：确保 Directus 正常启动和运行
3. **收集反馈**：如果还有问题，提供完整的日志文件

---

## 📞 联系支持

如果问题仍然存在：
1. 在 GitHub Issues 中创建新 issue
2. 附上完整的 `directus.log` 文件
3. 提供 GitHub Actions 构建日志链接
4. 说明你的系统环境（Windows 版本等）

---

**修复版本**: 1.0.1  
**修复日期**: 2025-11-08  
**修复内容**: Docker 文件提取、路径查找、打包配置、日志增强
