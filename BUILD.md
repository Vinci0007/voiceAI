# 构建和打包指南

本文档描述如何构建和打包实时语音翻译应用。

## 目录

- [前置要求](#前置要求)
- [开发构建](#开发构建)
- [生产构建](#生产构建)
- [平台特定构建](#平台特定构建)
- [构建优化](#构建优化)
- [安装程序](#安装程序)
- [自动更新配置](#自动更新配置)
- [故障排除](#故障排除)

## 前置要求

### 所有平台

- Node.js 18+ 和 npm
- Rust 1.70+
- Git

### Windows

- Microsoft Visual Studio C++ Build Tools
- WebView2 (Windows 10/11 自带)

### Linux

- 开发工具包:
  ```bash
  # Ubuntu/Debian
  sudo apt update
  sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libasound2-dev
  
  # Fedora
  sudo dnf install webkit2gtk3-devel \
    openssl-devel \
    curl \
    wget \
    libappindicator-gtk3 \
    librsvg2-devel \
    alsa-lib-devel
  ```

## 开发构建

### 启动开发服务器

```bash
npm install
npm run tauri:dev
```

这将启动 Vite 开发服务器和 Tauri 应用，支持热重载。

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试（监视模式）
npm run test:watch

# 运行属性测试
npm run test:pbt
```

## 生产构建

### 标准构建

```bash
# 安装依赖
npm install

# 构建应用
npm run tauri:build
```

构建产物位置:
- Windows: `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/deb/` 或 `appimage/`

### 优化构建

```bash
# 使用优化配置构建
npm run build:optimize
npm run tauri:build
```

## 平台特定构建

### Windows

```bash
# 构建 Windows MSI 安装程序
npm run tauri:build:windows
```

输出文件:
- `实时语音翻译_0.1.0_x64_en-US.msi` - MSI 安装程序
- `实时语音翻译.exe` - 独立可执行文件

### Linux

```bash
# 构建 Linux 包
npm run tauri:build:linux
```

输出文件:
- `realtime-voice-translation_0.1.0_amd64.deb` - Debian/Ubuntu 包
- `realtime-voice-translation_0.1.0_amd64.AppImage` - AppImage 通用包

### 调试构建

```bash
# 构建带调试符号的版本
npm run tauri:build:debug
```

## 构建优化

### 已实现的优化

#### Rust 优化 (Cargo.toml)

```toml
[profile.release]
opt-level = "z"     # 优化体积
lto = true          # 链接时优化
codegen-units = 1   # 更好的优化
strip = true        # 移除调试符号
panic = "abort"     # 减小体积
```

#### TypeScript/JavaScript 优化 (vite.config.ts)

- **Tree-shaking**: 自动移除未使用的代码
- **代码分割**: 将 React 和 Tauri API 分离到独立 chunk
- **压缩**: 使用 esbuild 进行快速压缩
- **资源内联**: 小于 4KB 的资源内联到 bundle

#### 构建大小对比

| 配置 | 预期大小 |
|------|----------|
| 未优化 | ~8-10 MB |
| 标准优化 | ~3-5 MB |
| 完全优化 | ~2-3 MB |

### 分析 Bundle 大小

```bash
# 分析构建产物
npm run bundle:analyze
```

## 安装程序

### Windows MSI

MSI 安装程序自动创建，包含:
- 开始菜单快捷方式
- 桌面快捷方式（可选）
- 卸载程序
- 自动安装依赖

配置位于 `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "wix": {
        "language": "zh-CN"
      }
    }
  }
}
```

### Linux DEB

DEB 包自动创建，包含:
- 应用程序菜单条目
- 图标
- 依赖声明

### Linux AppImage

AppImage 是自包含的可执行文件:
- 无需安装
- 包含所有依赖
- 可在任何 Linux 发行版运行

使用方法:
```bash
chmod +x realtime-voice-translation_0.1.0_amd64.AppImage
./realtime-voice-translation_0.1.0_amd64.AppImage
```

## 自动更新配置

### 启用自动更新

1. 编辑 `src-tauri/tauri.conf.json`:

```json
{
  "updater": {
    "active": true,
    "endpoints": [
      "https://your-update-server.com/{{target}}/{{current_version}}"
    ],
    "dialog": true,
    "pubkey": "YOUR_PUBLIC_KEY_HERE"
  }
}
```

2. 生成密钥对:

```bash
npm run tauri signer generate -- -w ~/.tauri/myapp.key
```

3. 将公钥添加到配置文件

4. 签名发布:

```bash
npm run tauri build
# 签名文件会自动生成在 bundle 目录
```

### 更新服务器

需要提供以下端点:

```
GET /{{target}}/{{current_version}}
```

返回 JSON:
```json
{
  "version": "0.2.0",
  "notes": "更新说明",
  "pub_date": "2024-01-01T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://..."
    },
    "linux-x86_64": {
      "signature": "...",
      "url": "https://..."
    }
  }
}
```

## 故障排除

### 构建失败

#### 错误: "WebView2 not found"

**Windows**: 安装 WebView2 Runtime
```bash
# 从 Microsoft 下载并安装
https://developer.microsoft.com/microsoft-edge/webview2/
```

#### 错误: "webkit2gtk not found"

**Linux**: 安装开发库
```bash
sudo apt install libwebkit2gtk-4.0-dev
```

#### 错误: "linker error"

**所有平台**: 确保安装了正确的构建工具
- Windows: Visual Studio C++ Build Tools
- Linux: build-essential
- 检查 Rust 工具链: `rustc --version`

### 构建体积过大

1. 确认使用 release 模式: `npm run tauri:build`
2. 检查 Cargo.toml 中的优化配置
3. 运行 `npm run bundle:analyze` 分析大文件
4. 移除未使用的依赖

### 运行时错误

#### 应用无法启动

1. 检查日志文件:
   - Windows: `%APPDATA%\com.realtime-voice-translation.app\logs\`
   - Linux: `~/.local/share/com.realtime-voice-translation.app/logs/`

2. 尝试从命令行运行查看错误:
   ```bash
   # Windows
   .\实时语音翻译.exe
   
   # Linux
   ./realtime-voice-translation
   ```

#### 数据库错误

确保应用有权限访问数据目录:
- Windows: `%APPDATA%\com.realtime-voice-translation.app\`
- Linux: `~/.local/share/com.realtime-voice-translation.app/`

## 性能基准

### 构建时间

| 平台 | 首次构建 | 增量构建 |
|------|----------|----------|
| Windows | ~5-8 分钟 | ~1-2 分钟 |
| Linux | ~4-6 分钟 | ~1-2 分钟 |

### 应用大小

| 平台 | 安装包大小 | 安装后大小 |
|------|------------|------------|
| Windows MSI | ~3-5 MB | ~8-12 MB |
| Linux DEB | ~3-5 MB | ~8-12 MB |
| Linux AppImage | ~8-12 MB | N/A |

### 启动时间

- 冷启动: < 2 秒
- 热启动: < 1 秒

## 发布清单

在发布新版本前，确保:

- [ ] 更新 `package.json` 和 `src-tauri/Cargo.toml` 中的版本号
- [ ] 更新 `CHANGELOG.md`
- [ ] 运行所有测试: `npm test`
- [ ] 在目标平台上测试构建
- [ ] 测试安装程序
- [ ] 测试卸载程序
- [ ] 验证自动更新（如果启用）
- [ ] 创建 Git 标签: `git tag v0.1.0`
- [ ] 推送标签: `git push --tags`

## 持续集成

### GitHub Actions 示例

创建 `.github/workflows/build.yml`:

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        platform: [ubuntu-latest, windows-latest]
    
    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt update
          sudo apt install -y libwebkit2gtk-4.0-dev \
            build-essential curl wget libssl-dev \
            libgtk-3-dev libayatana-appindicator3-dev \
            librsvg2-dev libasound2-dev
      
      - name: Install npm dependencies
        run: npm install
      
      - name: Build
        run: npm run tauri:build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.platform }}-build
          path: src-tauri/target/release/bundle/
```

## 支持

如有问题，请查看:
- [Tauri 文档](https://tauri.app/v1/guides/)
- [Vite 文档](https://vitejs.dev/)
- [项目 Issues](https://github.com/your-repo/issues)
