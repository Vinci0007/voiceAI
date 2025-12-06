# 部署指南

本文档描述如何部署实时语音翻译应用到不同环境。

## 目录

- [部署架构](#部署架构)
- [环境配置](#环境配置)
- [桌面应用部署](#桌面应用部署)
- [自动更新服务器](#自动更新服务器)
- [监控和日志](#监控和日志)
- [备份和恢复](#备份和恢复)

## 部署架构

### 组件概览

```
┌─────────────────────────────────────────────────────────┐
│                    用户设备                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │         实时语音翻译应用 (Tauri)                  │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │  │
│  │  │   前端     │  │  Rust后端  │  │  SQLite DB │ │  │
│  │  │  (React)   │  │  (音频处理) │  │  (本地)    │ │  │
│  │  └────────────┘  └────────────┘  └────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   云服务 (可选)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ 更新服务器   │  │  API 服务    │  │  信令服务器  │ │
│  │  (版本管理)  │  │ (翻译/语音)  │  │  (WebRTC)    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 环境配置

### 开发环境

```bash
# 克隆仓库
git clone https://github.com/your-org/realtime-voice-translation.git
cd realtime-voice-translation

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加 API 密钥

# 启动开发服务器
npm run tauri:dev
```

### 生产环境

#### 环境变量

创建 `.env.production` 文件：

```bash
# API 配置
VITE_GOOGLE_CLOUD_API_KEY=your_api_key_here
VITE_GOOGLE_CLOUD_PROJECT_ID=your_project_id

# 功能开关
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_TELEMETRY=false

# 更新服务器
VITE_UPDATE_SERVER_URL=https://updates.example.com

# 信令服务器
VITE_SIGNALING_SERVER_URL=wss://signaling.example.com
```

## 桌面应用部署

### Windows 部署

#### 1. 构建安装程序

```bash
# 构建 Windows MSI
npm run tauri:build:windows
```

输出位置：`src-tauri/target/release/bundle/msi/`

#### 2. 代码签名（推荐）

```powershell
# 使用 signtool 签名
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com "实时语音翻译_0.1.0_x64_en-US.msi"
```

#### 3. 分发方式

**选项 A: 直接下载**
- 上传 MSI 到网站
- 提供下载链接
- 包含 SHA256 校验和

**选项 B: Microsoft Store**
- 转换为 MSIX 格式
- 提交到 Microsoft Store
- 自动更新由 Store 管理

**选项 C: 企业部署**
- 使用 Group Policy
- SCCM/Intune 部署
- 静默安装：`msiexec /i app.msi /quiet`

### Linux 部署

#### 1. 构建包

```bash
# 构建 DEB 和 AppImage
npm run tauri:build:linux
```

输出位置：`src-tauri/target/release/bundle/`

#### 2. DEB 包部署

**Ubuntu/Debian:**
```bash
# 安装
sudo dpkg -i realtime-voice-translation_0.1.0_amd64.deb

# 或使用 apt
sudo apt install ./realtime-voice-translation_0.1.0_amd64.deb
```

**创建 APT 仓库:**
```bash
# 1. 设置仓库结构
mkdir -p repo/pool/main
cp *.deb repo/pool/main/

# 2. 生成 Packages 文件
cd repo
dpkg-scanpackages pool/main /dev/null | gzip -9c > dists/stable/main/binary-amd64/Packages.gz

# 3. 签名仓库
gpg --armor --export YOUR_KEY_ID > repo.gpg.key

# 4. 用户添加仓库
echo "deb [signed-by=/usr/share/keyrings/repo.gpg] https://repo.example.com stable main" | sudo tee /etc/apt/sources.list.d/realtime-voice-translation.list
```

#### 3. AppImage 部署

```bash
# 使 AppImage 可执行
chmod +x realtime-voice-translation_0.1.0_amd64.AppImage

# 运行
./realtime-voice-translation_0.1.0_amd64.AppImage

# 集成到系统（可选）
./realtime-voice-translation_0.1.0_amd64.AppImage --appimage-extract
# 手动创建 .desktop 文件
```

#### 4. Flatpak（可选）

创建 `com.realtime-voice-translation.app.yml`:

```yaml
app-id: com.realtime-voice-translation.app
runtime: org.freedesktop.Platform
runtime-version: '23.08'
sdk: org.freedesktop.Sdk
command: realtime-voice-translation

modules:
  - name: realtime-voice-translation
    buildsystem: simple
    build-commands:
      - install -D realtime-voice-translation /app/bin/realtime-voice-translation
    sources:
      - type: file
        path: realtime-voice-translation
```

构建：
```bash
flatpak-builder build-dir com.realtime-voice-translation.app.yml
flatpak build-export export build-dir
```

## 自动更新服务器

### 服务器设置

#### 1. 目录结构

```
/var/www/updates/
├── windows-x86_64/
│   ├── 0.1.0/
│   │   ├── app.msi
│   │   └── app.msi.sig
│   └── 0.2.0/
│       ├── app.msi
│       └── app.msi.sig
├── linux-x86_64/
│   ├── 0.1.0/
│   │   ├── app.AppImage
│   │   └── app.AppImage.sig
│   └── 0.2.0/
│       ├── app.AppImage
│       └── app.AppImage.sig
└── latest.json
```

#### 2. 版本清单 (latest.json)

```json
{
  "version": "0.2.0",
  "notes": "新功能：离线模式改进\n修复：内存泄漏问题",
  "pub_date": "2024-01-15T10:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUldUTE...",
      "url": "https://updates.example.com/windows-x86_64/0.2.0/app.msi"
    },
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUldUTE...",
      "url": "https://updates.example.com/linux-x86_64/0.2.0/app.AppImage"
    }
  }
}
```

#### 3. Nginx 配置

```nginx
server {
    listen 443 ssl http2;
    server_name updates.example.com;

    ssl_certificate /etc/letsencrypt/live/updates.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/updates.example.com/privkey.pem;

    root /var/www/updates;

    # CORS 配置
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, OPTIONS";

    location / {
        try_files $uri $uri/ =404;
    }

    # 版本检查端点
    location ~ ^/([^/]+)/([^/]+)$ {
        default_type application/json;
        try_files /latest.json =404;
    }

    # 缓存控制
    location ~* \.(msi|AppImage|deb)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /latest.json {
        expires 5m;
        add_header Cache-Control "public, must-revalidate";
    }
}
```

#### 4. 部署脚本

创建 `deploy-update.sh`:

```bash
#!/bin/bash

VERSION=$1
PLATFORM=$2

if [ -z "$VERSION" ] || [ -z "$PLATFORM" ]; then
    echo "Usage: ./deploy-update.sh <version> <platform>"
    exit 1
fi

UPLOAD_DIR="/var/www/updates/${PLATFORM}/${VERSION}"

# 创建目录
mkdir -p "$UPLOAD_DIR"

# 上传文件
scp "src-tauri/target/release/bundle/${PLATFORM}/"* "server:${UPLOAD_DIR}/"

# 更新 latest.json
ssh server "cd /var/www/updates && ./update-manifest.sh $VERSION $PLATFORM"

echo "Deployment complete for $PLATFORM version $VERSION"
```

### 启用自动更新

在 `src-tauri/tauri.conf.json` 中配置：

```json
{
  "updater": {
    "active": true,
    "endpoints": [
      "https://updates.example.com/{{target}}/{{current_version}}"
    ],
    "dialog": true,
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDJFNUI3..."
  }
}
```

## 监控和日志

### 应用日志

日志位置：
- **Windows**: `%APPDATA%\com.realtime-voice-translation.app\logs\`
- **Linux**: `~/.local/share/com.realtime-voice-translation.app/logs/`

### 日志级别

```typescript
// 在应用中配置
const LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'error' : 'debug';
```

### 远程监控（可选）

集成 Sentry 或类似服务：

```typescript
import * as Sentry from "@sentry/electron";

Sentry.init({
  dsn: "https://your-dsn@sentry.io/project-id",
  environment: process.env.NODE_ENV,
  release: `realtime-voice-translation@${app.getVersion()}`,
});
```

### 性能监控

```typescript
// 收集性能指标
interface PerformanceMetrics {
  startupTime: number;
  memoryUsage: number;
  cpuUsage: number;
  latency: {
    recognition: number;
    translation: number;
    synthesis: number;
  };
}

// 定期上报（如果用户同意）
async function reportMetrics(metrics: PerformanceMetrics) {
  if (userConsent) {
    await fetch('https://analytics.example.com/metrics', {
      method: 'POST',
      body: JSON.stringify(metrics),
    });
  }
}
```

## 备份和恢复

### 用户数据备份

用户数据位置：
- **Windows**: `%APPDATA%\com.realtime-voice-translation.app\`
- **Linux**: `~/.local/share/com.realtime-voice-translation.app/`

包含：
- `database.db` - SQLite 数据库
- `config.json` - 用户配置
- `voiceprints/` - 声纹数据

### 自动备份脚本

```bash
#!/bin/bash
# backup.sh

APP_DATA="$HOME/.local/share/com.realtime-voice-translation.app"
BACKUP_DIR="$HOME/Backups/realtime-voice-translation"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# 备份数据库
sqlite3 "$APP_DATA/database.db" ".backup '$BACKUP_DIR/database_$DATE.db'"

# 备份配置
cp "$APP_DATA/config.json" "$BACKUP_DIR/config_$DATE.json"

# 备份声纹
tar -czf "$BACKUP_DIR/voiceprints_$DATE.tar.gz" -C "$APP_DATA" voiceprints/

echo "Backup completed: $BACKUP_DIR"
```

### 恢复数据

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1
APP_DATA="$HOME/.local/share/com.realtime-voice-translation.app"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    exit 1
fi

# 停止应用
pkill realtime-voice-translation

# 恢复数据库
cp "$BACKUP_FILE" "$APP_DATA/database.db"

# 重启应用
realtime-voice-translation &

echo "Restore completed"
```

## 故障排除

### 常见部署问题

#### 1. 权限问题

**Linux:**
```bash
# 确保文件可执行
chmod +x realtime-voice-translation

# 检查 SELinux
sudo setenforce 0  # 临时禁用
```

#### 2. 依赖缺失

**Linux:**
```bash
# 检查缺失的库
ldd realtime-voice-translation

# 安装缺失的依赖
sudo apt install libwebkit2gtk-4.0-37
```

#### 3. 网络问题

```bash
# 测试更新服务器连接
curl -I https://updates.example.com/latest.json

# 检查防火墙
sudo ufw status
```

## 安全考虑

### 1. 代码签名

- Windows: 使用有效的代码签名证书
- Linux: 使用 GPG 签名包

### 2. HTTPS

- 所有网络通信使用 HTTPS
- 更新服务器必须使用有效的 SSL 证书

### 3. 权限最小化

- 应用只请求必要的系统权限
- 文件系统访问限制在应用数据目录

### 4. 数据加密

- 敏感数据（API 密钥）加密存储
- 用户数据库可选加密

## 支持和维护

### 联系方式

- 技术支持：support@example.com
- Bug 报告：https://github.com/your-org/realtime-voice-translation/issues
- 文档：https://docs.example.com

### 维护计划

- 每月安全更新
- 每季度功能更新
- 紧急修复：24 小时内发布
