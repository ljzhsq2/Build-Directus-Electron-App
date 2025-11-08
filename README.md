# Directus Electron 桌面应用构建指南

## 📋 前置要求

1. 一个 GitHub 仓库
2. Windows 图标文件 `icon.ico`（256x256 推荐）

## 🔄 构建流程说明

此 GitHub Action 使用 **两阶段构建**：

1. **阶段 1（Ubuntu）**：从 Docker 镜像提取 Directus 文件
2. **阶段 2（Windows）**：使用 Electron 打包成 Windows exe

这样可以正确使用 Linux Docker 容器，同时生成 Windows 可执行文件

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

### 2. 配置仓库权限（重要！）

**方法 1：在 workflow 文件中配置（推荐）**
- 已在 `build.yml` 中添加了 `permissions: contents: write`
- 无需额外配置

**方法 2：如果仍然报错，检查仓库设置**
1. 进入仓库 → Settings
2. 左侧菜单找到 **Actions** → **General**
3. 滚动到 **Workflow permissions**
4. 选择 **Read and write permissions**
5. 点击 **Save**

### 3. 添加图标文件

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
- 文件名格式：`Directus-Desktop-{版本号}-Windows-x64-Setup.exe`
- 例如：`Directus-Desktop-1.0.0-Windows-x64-Setup.exe`
- 大小：约 150-200MB
- 包含完整的 Directus 11.5.1 和运行时

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

编辑 `main.js` 中的环境变量部分（第 35-60 行），可以改用 PostgreSQL、MySQL 或其他数据库：

```javascript
// PostgreSQL 示例
DB_CLIENT: 'pg',
DB_HOST: 'localhost',
DB_PORT: '5432',
DB_DATABASE: 'directus',
DB_USER: 'postgres',
DB_PASSWORD: 'password'
```

### 自定义端口

修改 `main.js` 中的 `PORT` 环境变量

## ⚠️ 注意事项

1. **构建时间**：
   - 阶段 1（提取文件）：约 3-5 分钟
   - 阶段 2（打包 exe）：约 10-15 分钟
   - 总计：约 15-20 分钟

2. **安装包大小**：
   - 安装包：约 150-200MB
   - 安装后：约 300-400MB（包含完整的 Node.js 和 Directus）

3. **系统要求**：
   - Windows 10/11 x64
   - 至少 4GB RAM
   - 至少 500MB 可用磁盘空间

4. **数据库位置**：
   - 用户数据存储在 `%APPDATA%\directus-desktop\database\directus.db`

5. **默认账号**：
   - 首次启动使用 `admin@example.com` / `admin` 登录
   - **重要**：登录后请立即修改密码！

6. **端口占用**：
   - 默认使用 8055 端口
   - 如果被占用，需要关闭占用该端口的程序

## 🐛 故障排查

### 构建失败

**问题**：阶段 1 失败（Ubuntu）
- 检查 Docker 镜像版本是否正确
- 确认网络连接正常

**问题**：阶段 2 失败（Windows）
- 检查 Actions 日志中的错误信息
- 确保 `icon.ico` 文件存在于仓库根目录
- 验证 package.json 语法正确

### 应用无法启动

**问题**：双击 exe 没有反应
- 右键 → 以管理员身份运行
- 检查 Windows Defender 是否拦截

**问题**：启动后一直显示"启动中"
- 检查端口 8055 是否被占用（打开任务管理器查看）
- 查看 `%APPDATA%\directus-desktop\` 目录权限
- 尝试删除数据库文件重新初始化

**问题**：无法访问管理界面
- 确认防火墙没有阻止 localhost 连接
- 尝试在浏览器直接访问 `http://localhost:8055/admin`

### 数据丢失

**如何备份数据**：
1. 关闭 Directus 应用
2. 复制整个 `%APPDATA%\directus-desktop\` 目录
3. 保存到安全位置

**如何恢复数据**：
1. 关闭 Directus 应用
2. 将备份的目录覆盖回 `%APPDATA%\directus-desktop\`
3. 重新启动应用

## 📝 许可证

请确保遵守 Directus 的开源许可证
