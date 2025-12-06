# Docker 部署指南

本文档描述如何使用 Docker 容器化和部署实时语音翻译应用。

## 目录

- [概述](#概述)
- [Docker 镜像](#docker-镜像)
- [快速开始](#快速开始)
- [详细配置](#详细配置)
- [Docker Compose](#docker-compose)
- [生产部署](#生产部署)
- [监控和日志](#监控和日志)

## 概述

### 架构说明

由于实时语音翻译应用是一个桌面应用（Tauri），Docker 主要用于:
1. **开发环境容器化**: 统一开发环境
2. **CI/CD 构建**: 自动化构建流程
3. **后端服务部署**: 部署信令服务器、更新服务器等辅助服务

**注意:** 桌面应用本身不在容器中运行，而是作为原生应用安装在用户设备上。

### 容器化组件

```
┌─────────────────────────────────────────────────────────┐
│                    Docker 环境                           │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │  构建容器        │  │  开发容器        │            │
│  │  (Build)         │  │  (Development)   │            │
│  │                  │  │                  │            │
│  │  - Node.js       │  │  - Node.js       │            │
│  │  - Rust          │  │  - Rust          │            │
│  │  - 构建工具      │  │  - 开发工具      │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │  信令服务器      │  │  更新服务器      │            │
│  │  (Signaling)     │  │  (Update Server) │            │
│  │                  │  │                  │            │
│  │  - WebSocket     │  │  - Nginx         │            │
│  │  - Node.js       │  │  - 静态文件      │            │
│  └──────────────────┘  └──────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

## Docker 镜像

### 1. 开发环境镜像

用于本地开发和测试。

**Dockerfile.dev:**

```dockerfile
FROM node:18-bullseye

# 安装 Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY src-tauri/Cargo.toml src-tauri/Cargo.lock ./src-tauri/

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 1420 3000

# 启动开发服务器
CMD ["npm", "run", "tauri:dev"]
```

**构建和运行:**

```bash
# 构建镜像
docker build -f Dockerfile.dev -t realtime-voice-translation:dev .

# 运行容器
docker run -it --rm \
  -v $(pwd):/app \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -e DISPLAY=$DISPLAY \
  -p 1420:1420 \
  -p 3000:3000 \
  realtime-voice-translation:dev
```

### 2. 构建环境镜像

用于 CI/CD 自动化构建。

**Dockerfile.build:**

```dockerfile
FROM node:18-bullseye AS builder

# 安装 Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 安装依赖
RUN npm ci

# 构建应用
RUN npm run tauri:build

# 输出构建产物
FROM scratch AS export
COPY --from=builder /app/src-tauri/target/release/bundle/ /
```

**使用方法:**

```bash
# 构建并导出产物
docker build -f Dockerfile.build --output type=local,dest=./dist .

# 构建产物将保存在 ./dist 目录
```

### 3. 信令服务器镜像

用于 WebRTC 信令。

**Dockerfile.signaling:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制信令服务器代码
COPY signaling-server/package*.json ./
RUN npm ci --only=production

COPY signaling-server/ ./

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# 启动服务
CMD ["node", "server.js"]
```

**信令服务器代码 (signaling-server/server.js):**

```javascript
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map();

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error('Invalid message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    // 清理房间
    for (const [roomId, clients] of rooms.entries()) {
      const index = clients.indexOf(ws);
      if (index !== -1) {
        clients.splice(index, 1);
        if (clients.length === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });
});

function handleMessage(ws, data) {
  const { type, roomId, payload } = data;
  
  switch (type) {
    case 'join':
      joinRoom(ws, roomId);
      break;
    case 'leave':
      leaveRoom(ws, roomId);
      break;
    case 'signal':
      forwardSignal(ws, roomId, payload);
      break;
    default:
      console.warn('Unknown message type:', type);
  }
}

function joinRoom(ws, roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, []);
  }
  rooms.get(roomId).push(ws);
  
  ws.send(JSON.stringify({
    type: 'joined',
    roomId,
    participants: rooms.get(roomId).length
  }));
}

function leaveRoom(ws, roomId) {
  if (rooms.has(roomId)) {
    const clients = rooms.get(roomId);
    const index = clients.indexOf(ws);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  }
}

function forwardSignal(ws, roomId, payload) {
  if (rooms.has(roomId)) {
    const clients = rooms.get(roomId);
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'signal',
          payload
        }));
      }
    });
  }
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
```

### 4. 更新服务器镜像

用于应用自动更新。

**Dockerfile.update-server:**

```dockerfile
FROM nginx:alpine

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

# 创建更新文件目录
RUN mkdir -p /var/www/updates

# 复制更新文件
COPY updates/ /var/www/updates/

# 暴露端口
EXPOSE 80 443

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
```

**Nginx 配置 (nginx.conf):**

```nginx
events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name updates.example.com;

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
}
```

## 快速开始

### 使用 Docker 进行开发

```bash
# 1. 构建开发镜像
docker build -f Dockerfile.dev -t rtv:dev .

# 2. 运行开发容器
docker run -it --rm \
  -v $(pwd):/app \
  -p 1420:1420 \
  -p 3000:3000 \
  rtv:dev

# 3. 访问应用
# 前端: http://localhost:1420
# Vite 开发服务器: http://localhost:3000
```

### 使用 Docker 构建应用

```bash
# 构建应用
docker build -f Dockerfile.build --output type=local,dest=./dist .

# 查看构建产物
ls -lh ./dist/
```

## 详细配置

### 环境变量

创建 `.env.docker` 文件:

```env
# 应用配置
NODE_ENV=production
VITE_API_URL=https://api.example.com

# Google Cloud API
VITE_GOOGLE_CLOUD_API_KEY=your_api_key
VITE_GOOGLE_CLOUD_PROJECT_ID=your_project_id

# 功能开关
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_TELEMETRY=false

# 信令服务器
SIGNALING_SERVER_PORT=8080
SIGNALING_SERVER_HOST=0.0.0.0

# 更新服务器
UPDATE_SERVER_PORT=80
UPDATE_SERVER_HOST=0.0.0.0
```

### 卷挂载

```bash
# 挂载源代码（开发）
-v $(pwd):/app

# 挂载构建缓存（加速构建）
-v rtv-cargo-cache:/root/.cargo
-v rtv-node-modules:/app/node_modules

# 挂载数据目录
-v rtv-data:/app/data
```

### 网络配置

```bash
# 创建自定义网络
docker network create rtv-network

# 在网络中运行容器
docker run --network rtv-network ...
```

## Docker Compose

### 完整部署配置

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  # 开发环境
  dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - node_modules:/app/node_modules
      - cargo_cache:/root/.cargo
    ports:
      - "1420:1420"
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - VITE_LOG_LEVEL=debug
    networks:
      - rtv-network

  # 构建服务
  builder:
    build:
      context: .
      dockerfile: Dockerfile.build
    volumes:
      - ./dist:/app/dist
    environment:
      - NODE_ENV=production
    networks:
      - rtv-network

  # 信令服务器
  signaling:
    build:
      context: ./signaling-server
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 3s
      retries: 3
    networks:
      - rtv-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # 更新服务器
  update-server:
    build:
      context: .
      dockerfile: Dockerfile.update-server
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./updates:/var/www/updates:ro
      - ./ssl:/etc/nginx/ssl:ro
    restart: unless-stopped
    networks:
      - rtv-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - signaling
      - update-server
    restart: unless-stopped
    networks:
      - rtv-network

volumes:
  node_modules:
  cargo_cache:

networks:
  rtv-network:
    driver: bridge
```

### 使用 Docker Compose

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重新构建并启动
docker-compose up -d --build
```

### 开发环境

```bash
# 启动开发环境
docker-compose up dev

# 在容器中执行命令
docker-compose exec dev npm test

# 查看开发日志
docker-compose logs -f dev
```

### 生产环境

```bash
# 启动生产服务
docker-compose up -d signaling update-server nginx

# 查看服务状态
docker-compose ps

# 扩展信令服务器
docker-compose up -d --scale signaling=3
```

## 生产部署

### 1. 多阶段构建优化

**Dockerfile.prod:**

```dockerfile
# 阶段 1: 构建前端
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 阶段 2: 构建 Rust 后端
FROM rust:1.70-slim AS rust-builder
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.0-dev \
    build-essential \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY src-tauri/ ./src-tauri/
COPY --from=frontend-builder /app/dist ./dist
RUN cd src-tauri && cargo build --release

# 阶段 3: 最终镜像
FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.0-37 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=rust-builder /app/src-tauri/target/release/realtime-voice-translation /usr/local/bin/
CMD ["realtime-voice-translation"]
```

### 2. 使用 Docker Secrets

```bash
# 创建 secret
echo "your_api_key" | docker secret create google_api_key -

# 在 docker-compose.yml 中使用
services:
  app:
    secrets:
      - google_api_key
    environment:
      - GOOGLE_API_KEY_FILE=/run/secrets/google_api_key

secrets:
  google_api_key:
    external: true
```

### 3. 健康检查

```yaml
services:
  signaling:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 4. 资源限制

```yaml
services:
  signaling:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

## 监控和日志

### 日志管理

```bash
# 查看实时日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f signaling

# 导出日志
docker-compose logs > logs.txt

# 清理日志
docker-compose down
docker system prune -a --volumes
```

### 日志配置

```yaml
services:
  signaling:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=signaling"
```

### 监控集成

**使用 Prometheus 和 Grafana:**

```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    depends_on:
      - prometheus
```

## CI/CD 集成

### GitHub Actions

**.github/workflows/docker-build.yml:**

```yaml
name: Docker Build

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to Docker Hub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    
    - name: Build and push
      uses: docker/build-push-action@v4
      with:
        context: .
        file: ./Dockerfile.build
        push: true
        tags: |
          your-org/realtime-voice-translation:latest
          your-org/realtime-voice-translation:${{ github.sha }}
        cache-from: type=registry,ref=your-org/realtime-voice-translation:buildcache
        cache-to: type=registry,ref=your-org/realtime-voice-translation:buildcache,mode=max
```

## 故障排除

### 常见问题

#### 1. 容器无法启动

```bash
# 查看容器日志
docker logs <container_id>

# 检查容器状态
docker inspect <container_id>

# 进入容器调试
docker exec -it <container_id> /bin/sh
```

#### 2. 网络连接问题

```bash
# 检查网络
docker network ls
docker network inspect rtv-network

# 测试容器间连接
docker exec <container_id> ping <other_container>
```

#### 3. 卷挂载问题

```bash
# 检查卷
docker volume ls
docker volume inspect <volume_name>

# 清理未使用的卷
docker volume prune
```

## 最佳实践

1. **使用多阶段构建** 减小镜像体积
2. **使用 .dockerignore** 排除不必要的文件
3. **固定基础镜像版本** 确保构建可重现
4. **使用健康检查** 确保服务可用性
5. **配置资源限制** 防止资源耗尽
6. **使用 Docker Secrets** 管理敏感信息
7. **定期更新镜像** 修复安全漏洞
8. **监控容器资源** 及时发现问题

## 下一步

- 查看 [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md) 了解云部署
- 查看 [KUBERNETES_DEPLOYMENT.md](KUBERNETES_DEPLOYMENT.md) 了解 K8s 部署
- 查看 [MONITORING.md](MONITORING.md) 了解监控配置
