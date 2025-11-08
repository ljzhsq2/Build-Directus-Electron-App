# Directus Electron 桌面应用构建指南

## 📋 前置要求

1. 一个 GitHub 仓库
2. Windows 图标文件 `icon.ico`（256x256 推荐）

## 🚀 设置步骤

### 1. 创建仓库结构

```
your-repo/
├── .github/
│   └── workflows/
│       └── build.yml  (上面的 GitHub Action 文件)
├── icon.ico          (应用图标)
└── README.md
```

### 2. 添加图标文件

将一个 256x256 的 `.ico` 图标文件放在仓库根目录，命名为 `icon.ico`

### 3. 触发构建

有两种方式触发构建：

#### 方式 1：使用 Git Tag（推荐）
```bash
git tag v1.0.0
git push origin v1.0.0
```

#### 方式 2：手动触发
1. 进入 GitHub 仓库
2. 点击 Actions 标签
3. 选择 "Build Directus Electron App"
4. 点击 "Run workflow"
5. 输入版本号（如 1.0.0）

## 📦 构建产物

构建完成后，会在 Releases 页面生成：
- 文件名格式：`Directus-{版本号}-Setup.exe`
- 例如：`Directus-1.0.0-Setup.exe`

## ⚙️ 应用功能

构建的应用会：
1. 内置完整的 Directus 11.5.1
2. 使用 SQLite 数据库（存储在用户数据目录）
3. 自动启动 Directus 服务器（端口 8055）
4. 打开内置浏览器访问 Directus 界面

## 🔧 高级配置

### 修改 Directus 版本

编辑 `.github/workflows/build.yml` 第 28 行：
```bash
npm install directus@11.5.1
```

将 `directus@11.5.1` 改为你需要的版本（如 `directus@11.6.0`）

### 修改数据库配置

编辑 `main.js` 中的环境变量部分，可以改用 PostgreSQL 或其他数据库

### 自定义端口

修改 `main.js` 中的 `PORT` 环境变量

## ⚠️ 注意事项

1. **首次构建时间较长**：需要下载 Docker 镜像和 Node 依赖，大约 10-20 分钟
2. **Windows only**：此配置仅构建 Windows 版本，如需 macOS/Linux 版本需修改 workflow
3. **数据库位置**：用户数据存储在 `%APPDATA%\directus-desktop\directus.db`
4. **内存要求**：建议至少 4GB RAM

## 🐛 故障排查

### 构建失败
- 检查 Actions 日志
- 确保 `icon.ico` 文件存在
- 验证 Docker 镜像版本是否正确

### 应用无法启动
- 检查防火墙设置
- 确保端口 8055 未被占用
- 查看应用日志（通常在 `%APPDATA%\directus-desktop\logs`）

## 📝 许可证

请确保遵守 Directus 的开源许可证
