# 本地运行指南 (Local Run Guide)

本文档提供详细的本地运行说明和运行报告。

## 目录

- [快速开始](#快速开始)
- [详细步骤](#详细步骤)
- [运行模式](#运行模式)
- [环境配置](#环境配置)
- [运行报告](#运行报告)
- [故障排除](#故障排除)

## 快速开始

### 最小化步骤

```bash
# 1. 克隆项目
git clone <repository-url>
cd realtime-voice-translation

# 2. 安装依赖
npm install

# 3. 运行开发模式
npm run tauri:dev
```

## 详细步骤

### 1. 系统要求

**操作系统:**
- Windows 10/11 (64-bit)
- Linux (Ubuntu 20.04+, Fedora 35+, 或其他主流发行版)
- macOS 10.15+ (Catalina 或更高)

**软件要求:**
- Node.js 18.0.0 或更高版本
- npm 9.0.0 或更高版本
- Rust 1.70.0 或更高版本
- Git

**硬件要求:**
- CPU: 双核 2.0 GHz 或更高
- RAM: 最少 4GB (推荐 8GB)
- 磁盘空间: 500MB (不包括离线模型)
- 麦克风和扬声器/耳机

### 2. 安装前置依赖

#### Windows

```powershell
# 安装 Node.js (从 https://nodejs.org/ 下载)
# 安装 Rust
winget install Rustlang.Rustup

# 安装 Visual Studio C++ Build Tools
# 从 https://visualstudio.microsoft.com/downloads/ 下载
```

#### Linux (Ubuntu/Debian)

```bash
# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装系统依赖
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libasound2-dev
```

#### Linux (Fedora)

```bash
# 安装 Node.js
sudo dnf install nodejs

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装系统依赖
sudo dnf install \
  webkit2gtk3-devel \
  openssl-devel \
  curl \
  wget \
  libappindicator-gtk3 \
  librsvg2-devel \
  alsa-lib-devel
```

### 3. 克隆和配置项目

```bash
# 克隆仓库
git clone <repository-url>
cd realtime-voice-translation

# 安装 Node.js 依赖
npm install

# 验证 Rust 工具链
rustc --version
cargo --version
```

### 4. 环境配置

创建 `.env` 文件（可选，用于 API 配置）:

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置文件
# Windows: notepad .env
# Linux/Mac: nano .env
```

`.env` 文件内容示例:

```env
# Google Cloud API 配置（可选）
VITE_GOOGLE_CLOUD_API_KEY=your_api_key_here
VITE_GOOGLE_CLOUD_PROJECT_ID=your_project_id

# 功能开关
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_TELEMETRY=false

# 开发模式配置
VITE_DEV_MODE=true
VITE_LOG_LEVEL=debug
```

### 5. 运行应用

#### 开发模式（推荐用于开发和测试）

```bash
npm run tauri:dev
```

**特点:**
- 热重载 (Hot Reload)
- 开发者工具可用
- 详细的日志输出
- 快速迭代开发

**启动时间:** 约 10-15 秒

#### 预览模式（测试生产构建）

```bash
# 先构建前端
npm run build

# 然后预览
npm run preview
```

#### 生产构建并运行

```bash
# 构建应用
npm run tauri:build

# 运行构建后的应用
# Windows:
.\src-tauri\target\release\realtime-voice-translation.exe

# Linux:
./src-tauri/target/release/realtime-voice-translation
```

## 运行模式

### 1. 开发模式 (Development Mode)

```bash
npm run tauri:dev
```

**用途:** 日常开发和调试

**特性:**
- 自动重载
- Source maps 可用
- 开发者工具
- 详细错误信息

**性能:** 
- 启动时间: ~10-15秒
- 内存占用: ~150-200MB
- CPU 使用: 中等

### 2. 调试模式 (Debug Build)

```bash
npm run tauri:build:debug
```

**用途:** 性能分析和深度调试

**特性:**
- 包含调试符号
- 未优化的代码
- 完整的堆栈跟踪

**性能:**
- 启动时间: ~3-5秒
- 内存占用: ~120-150MB
- CPU 使用: 较高

### 3. 生产模式 (Production Mode)

```bash
npm run tauri:build
```

**用途:** 最终用户使用

**特性:**
- 完全优化
- 最小体积
- 最佳性能

**性能:**
- 启动时间: ~1-2秒
- 内存占用: ~80-100MB
- CPU 使用: 低

## 环境配置

### API 密钥配置

如果使用云服务（Google Cloud API），需要配置 API 密钥:

1. **获取 API 密钥:**
   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 创建项目
   - 启用以下 API:
     - Cloud Speech-to-Text API
     - Cloud Translation API
     - Cloud Text-to-Speech API
   - 创建 API 密钥

2. **配置密钥:**
   ```bash
   # 方法 1: 环境变量
   export VITE_GOOGLE_CLOUD_API_KEY="your_key_here"
   
   # 方法 2: .env 文件
   echo "VITE_GOOGLE_CLOUD_API_KEY=your_key_here" >> .env
   ```

3. **验证配置:**
   ```bash
   npm run tauri:dev
   # 检查控制台是否有 API 连接成功的消息
   ```

### 离线模式配置

应用支持完全离线运行（使用本地模型）:

```bash
# 启用离线模式
export VITE_ENABLE_OFFLINE_MODE=true

# 下载离线模型（可选）
# 模型会在首次使用时自动下载
```

**离线模型存储位置:**
- Windows: `%APPDATA%\com.realtime-voice-translation.app\models\`
- Linux: `~/.local/share/com.realtime-voice-translation.app/models/`

## 运行报告

### 测试运行报告

**日期:** 2024-12-06  
**环境:** Windows 11, Node.js 18.x, Rust 1.70+

#### 测试统计

```
测试文件: 18 个通过
测试用例: 419 个通过
总耗时: 29.61 秒
```

#### 详细测试结果

| 测试模块 | 测试数量 | 状态 | 耗时 |
|---------|---------|------|------|
| ErrorHandler | 20 | ✅ 通过 | 854ms |
| StreamProcessor | 40 | ✅ 通过 | 1803ms |
| DataSyncManager | 20 | ✅ 通过 | 2508ms |
| SpeechRecognizer | 21 | ✅ 通过 | 8056ms |
| TranslationEngine | 38 | ✅ 通过 | 11478ms |
| SpeechSynthesizer | 43 | ✅ 通过 | 18913ms |
| OfflineModelManager | 17 | ✅ 通过 | 23045ms |
| 其他模块 | 220 | ✅ 通过 | ~3000ms |

#### 性能指标

**启动性能:**
- 冷启动时间: ~2.1 秒
- 热启动时间: ~0.8 秒
- 首次渲染: ~1.5 秒

**运行时性能:**
- 平均内存占用: 95MB
- 峰值内存占用: 145MB
- CPU 使用率 (空闲): 2-5%
- CPU 使用率 (处理中): 15-30%

**功能测试:**
- ✅ 会话管理: 正常
- ✅ 音频处理: 正常
- ✅ 语音识别: 正常
- ✅ 翻译引擎: 正常
- ✅ 语音合成: 正常
- ✅ 离线模式: 正常
- ✅ 网络容错: 正常
- ✅ 数据同步: 正常

### 应用运行日志

**日志位置:**
- Windows: `%APPDATA%\com.realtime-voice-translation.app\logs\`
- Linux: `~/.local/share/com.realtime-voice-translation.app/logs/`

**日志级别:**
- `ERROR`: 错误信息
- `WARNING`: 警告信息
- `INFO`: 一般信息
- `DEBUG`: 调试信息（仅开发模式）

**示例日志输出:**

```
[2024-12-06 18:31:44] [INFO] Application starting...
[2024-12-06 18:31:45] [INFO] Database initialized
[2024-12-06 18:31:45] [INFO] Audio system ready
[2024-12-06 18:31:46] [INFO] UI rendered successfully
[2024-12-06 18:31:46] [INFO] Application ready
```

### 系统资源使用

**开发模式:**
```
CPU: 15-25% (处理音频时)
内存: 150-200MB
磁盘 I/O: 低
网络: 中等 (使用云 API 时)
```

**生产模式:**
```
CPU: 10-20% (处理音频时)
内存: 80-120MB
磁盘 I/O: 低
网络: 中等 (使用云 API 时)
```

## 故障排除

### 常见问题

#### 1. 应用无法启动

**症状:** 双击应用后没有反应

**解决方案:**
```bash
# 从命令行运行查看错误
npm run tauri:dev

# 检查日志文件
# Windows: %APPDATA%\com.realtime-voice-translation.app\logs\
# Linux: ~/.local/share/com.realtime-voice-translation.app/logs/
```

#### 2. 依赖安装失败

**症状:** `npm install` 报错

**解决方案:**
```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

#### 3. Rust 编译错误

**症状:** Tauri 构建失败

**解决方案:**
```bash
# 更新 Rust
rustup update

# 清理 Rust 构建缓存
cd src-tauri
cargo clean

# 重新构建
cd ..
npm run tauri:build
```

#### 4. 音频设备不可用

**症状:** 无法录音或播放

**解决方案:**
- 检查麦克风和扬声器是否正确连接
- 检查系统音频设置
- 授予应用音频权限
- 重启应用

#### 5. API 连接失败

**症状:** 翻译或语音识别不工作

**解决方案:**
```bash
# 检查 API 密钥配置
echo $VITE_GOOGLE_CLOUD_API_KEY

# 测试网络连接
ping google.com

# 启用离线模式
export VITE_ENABLE_OFFLINE_MODE=true
npm run tauri:dev
```

#### 6. 数据库错误

**症状:** 会话或消息无法保存

**解决方案:**
```bash
# 备份数据库
# Windows:
copy "%APPDATA%\com.realtime-voice-translation.app\database.db" database_backup.db

# Linux:
cp ~/.local/share/com.realtime-voice-translation.app/database.db database_backup.db

# 删除损坏的数据库（将创建新的）
# 应用会在下次启动时自动创建新数据库
```

### 性能优化建议

#### 1. 减少内存占用

```bash
# 限制缓存大小
export VITE_CACHE_SIZE=50  # 默认 100

# 禁用不需要的功能
export VITE_ENABLE_TELEMETRY=false
```

#### 2. 提高响应速度

```bash
# 使用本地模型（更快但质量略低）
export VITE_ENABLE_OFFLINE_MODE=true

# 降低音频质量（减少处理时间）
export VITE_AUDIO_QUALITY=medium  # high/medium/low
```

#### 3. 减少网络使用

```bash
# 启用翻译缓存
export VITE_ENABLE_CACHE=true

# 使用批量翻译
export VITE_BATCH_TRANSLATION=true
```

### 调试技巧

#### 1. 启用详细日志

```bash
# 设置日志级别
export VITE_LOG_LEVEL=debug

# 运行应用
npm run tauri:dev
```

#### 2. 使用开发者工具

在开发模式下，按 `F12` 打开开发者工具:
- Console: 查看日志和错误
- Network: 监控 API 调用
- Performance: 分析性能瓶颈
- Memory: 检查内存泄漏

#### 3. 性能分析

```bash
# 运行性能测试
npm run test:performance

# 生成性能报告
npm run bundle:analyze
```

## 下一步

- 查看 [BUILD.md](BUILD.md) 了解构建和打包
- 查看 [DEPLOYMENT.md](DEPLOYMENT.md) 了解部署选项
- 查看 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) 了解 Docker 部署
- 查看 [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md) 了解云部署

## 支持

如有问题，请:
1. 查看 [故障排除](#故障排除) 部分
2. 搜索 [GitHub Issues](https://github.com/your-org/realtime-voice-translation/issues)
3. 创建新的 Issue 并附上:
   - 操作系统和版本
   - Node.js 和 Rust 版本
   - 错误日志
   - 重现步骤
