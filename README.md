# 实时语音翻译应用

支持多人会议和一对一实时聊天的语音翻译桌面应用。

## 功能特性

- 🎤 实时语音识别
- 🌍 多语言自动检测和翻译
- 👥 说话人识别
- 💬 会议模式和聊天模式
- 📝 对话历史记录
- 🔌 离线模式支持

## 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Rust + Tauri
- **数据库**: SQLite
- **测试**: Vitest + fast-check (属性测试)

## 开发环境设置

### 前置要求

- Node.js 18+
- Rust 1.70+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri:dev
```

### 构建生产版本

```bash
npm run tauri:build
```

## 测试

### 运行所有测试

```bash
npm test
```

### 运行属性测试

```bash
npm run test:pbt
```

### 监听模式

```bash
npm run test:watch
```

## 文档

### 运行和部署

- **[本地运行指南](LOCAL_RUN_GUIDE.md)** - 详细的本地开发和运行说明
- **[运行报告](RUN_REPORT.md)** - 最新的测试和性能报告
- **[Docker 部署](DOCKER_DEPLOYMENT.md)** - 使用 Docker 容器化部署
- **[云部署指南](CLOUD_DEPLOYMENT.md)** - AWS、Azure、GCP 等云平台部署
- **[构建指南](BUILD.md)** - 构建和打包说明
- **[部署指南](DEPLOYMENT.md)** - 生产环境部署

### 开发文档

- **[快速开始](BUILD_QUICK_START.md)** - 快速开始开发
- **[设置指南](SETUP.md)** - 开发环境设置
- **[优化指南](OPTIMIZATION.md)** - 性能优化建议

## 项目结构

```
.
├── src/                    # 前端源代码
│   ├── api/               # Tauri API 包装器
│   ├── components/        # React 组件
│   ├── services/          # 业务逻辑服务
│   ├── types/             # TypeScript 类型定义
│   ├── App.tsx            # 主应用组件
│   └── main.tsx           # 应用入口
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── main.rs        # Tauri 主程序
│   │   ├── database.rs    # SQLite 数据库模块
│   │   ├── audio_processor.rs  # 音频处理
│   │   └── speaker_identifier.rs  # 说话人识别
│   └── Cargo.toml         # Rust 依赖配置
├── package.json           # Node.js 依赖配置
└── vite.config.ts         # Vite 构建配置
```

## 数据库架构

### Sessions 表
- 存储会话信息（会议模式/聊天模式）

### Messages 表
- 存储对话消息（原始文本和翻译）

### Speakers 表
- 存储说话人信息和声纹数据

### Session_Participants 表
- 管理会话参与者关系

## 性能目标

- 端到端延迟: < 2 秒
- 启动时间: < 1.5 秒
- 内存占用: < 500 MB
- 安装包大小: < 10 MB (基础版)

## 许可证

待定
