# 构建快速入门

快速开始构建实时语音翻译应用。

## 🚀 快速构建

### 开发模式

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run tauri:dev
```

### 生产构建

```bash
# 完整构建（推荐）
npm run build:full

# 或分步构建
npm run build:check    # 检查环境
npm test               # 运行测试
npm run build:optimize # 构建前端
npm run tauri:build    # 构建 Tauri 应用
```

## 📦 构建产物位置

### Windows
```
src-tauri/target/release/bundle/msi/
├── 实时语音翻译_0.1.0_x64_en-US.msi  (安装程序)
└── 实时语音翻译.exe                   (可执行文件)
```

### Linux
```
src-tauri/target/release/bundle/
├── deb/
│   └── realtime-voice-translation_0.1.0_amd64.deb
└── appimage/
    └── realtime-voice-translation_0.1.0_amd64.AppImage
```

## 🎯 常用命令

```bash
# 环境检查
npm run build:check

# 清理构建
npm run build:clean

# 运行测试
npm test

# Windows 构建
npm run tauri:build:windows

# Linux 构建
npm run tauri:build:linux

# 调试构建
npm run tauri:build:debug

# 查看构建产物
node scripts/build.js artifacts
```

## ⚙️ 构建配置

### 优化级别

| 配置 | 体积 | 速度 | 构建时间 |
|------|------|------|----------|
| Debug | 大 | 快 | 短 |
| Release | 中 | 中 | 中 |
| Release (优化) | 小 | 慢 | 长 |

当前使用: **Release (优化)** - 最小体积

### 修改优化级别

编辑 `src-tauri/Cargo.toml`:

```toml
[profile.release]
opt-level = "z"     # "z" = 最小体积, "3" = 最快速度
lto = true          # true = 启用, false = 禁用
codegen-units = 1   # 1 = 最优, 16 = 最快
```

## 🔧 故障排除

### 构建失败

```bash
# 1. 清理并重试
npm run build:clean
npm run build:full

# 2. 检查环境
npm run build:check

# 3. 更新依赖
npm install
cargo update
```

### 常见错误

**错误: "WebView2 not found" (Windows)**
```bash
# 下载并安装 WebView2 Runtime
https://developer.microsoft.com/microsoft-edge/webview2/
```

**错误: "webkit2gtk not found" (Linux)**
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.0-dev

# Fedora
sudo dnf install webkit2gtk3-devel
```

**错误: "linker error"**
```bash
# 确保安装了构建工具
# Windows: Visual Studio C++ Build Tools
# Linux: build-essential
```

## 📊 性能目标

| 指标 | 目标 | 当前 |
|------|------|------|
| 应用体积 | < 5 MB | ~3-5 MB ✅ |
| 启动时间 | < 2 秒 | ~1.5 秒 ✅ |
| 构建时间 | < 5 分钟 | ~5 分钟 ✅ |
| 内存占用 | < 500 MB | ~300-400 MB ✅ |

## 📚 详细文档

- [BUILD.md](BUILD.md) - 完整构建指南
- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南
- [RELEASE.md](RELEASE.md) - 发布流程
- [OPTIMIZATION.md](OPTIMIZATION.md) - 优化详解

## 🆘 获取帮助

```bash
# 查看构建脚本帮助
node scripts/build.js help

# 查看 Tauri 帮助
npm run tauri -- --help
```

## ✅ 发布前检查清单

- [ ] 所有测试通过: `npm test`
- [ ] 环境检查通过: `npm run build:check`
- [ ] 构建成功: `npm run build:full`
- [ ] 应用体积 < 5 MB
- [ ] 启动时间 < 2 秒
- [ ] 功能测试通过
- [ ] 更新 CHANGELOG.md
- [ ] 更新版本号

## 🎉 首次构建

第一次构建？按照以下步骤：

```bash
# 1. 克隆仓库
git clone <repository-url>
cd realtime-voice-translation

# 2. 安装依赖
npm install

# 3. 检查环境
npm run build:check

# 4. 运行测试
npm test

# 5. 开发模式测试
npm run tauri:dev

# 6. 生产构建
npm run build:full

# 7. 查看构建产物
node scripts/build.js artifacts
```

完成！🎊
