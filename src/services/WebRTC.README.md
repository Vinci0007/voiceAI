# WebRTC 实时通信模块

## 概述

WebRTC 实时通信模块提供了完整的 P2P 音频传输解决方案，支持多人会议和一对一聊天场景。该模块包含三个核心服务：

1. **WebRTCService** - 管理 WebRTC 对等连接和音频流
2. **SignalingService** - 管理 WebSocket 信令通信
3. **WebRTCManager** - 协调 WebRTC 和信令服务

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      WebRTCManager                          │
│  (协调 WebRTC 和信令服务，管理会话建立流程)                  │
└────────────────┬────────────────────────────┬───────────────┘
                 │                            │
        ┌────────▼────────┐          ┌────────▼────────┐
        │ WebRTCService   │          │SignalingService │
        │ (P2P 连接管理)  │          │ (WebSocket 信令)│
        └─────────────────┘          └─────────────────┘
                 │                            │
        ┌────────▼────────┐          ┌────────▼────────┐
        │  RTCPeerConn    │          │   WebSocket     │
        │  MediaStream    │          │   Messages      │
        └─────────────────┘          └─────────────────┘
```

## 核心功能

### 1. WebRTCService

负责管理 WebRTC 对等连接和音频流传输。

**主要功能：**
- 初始化本地音频流
- 创建和管理 RTCPeerConnection
- 处理 Offer/Answer 交换
- 管理 ICE 候选
- 数据通道通信
- 音频静音控制

**使用示例：**

```typescript
import { WebRTCService } from '@/services';

const webrtc = new WebRTCService({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ],
  audioConstraints: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 16000,
  }
});

// 设置回调
webrtc.setCallbacks({
  onRemoteStream: (peerId, stream) => {
    console.log(`Received stream from ${peerId}`);
    // 播放远程音频流
    const audio = new Audio();
    audio.srcObject = stream;
    audio.play();
  },
  onPeerConnected: (peerId) => {
    console.log(`Connected to ${peerId}`);
  },
  onPeerDisconnected: (peerId) => {
    console.log(`Disconnected from ${peerId}`);
  },
});

// 初始化本地音频流
await webrtc.initializeLocalStream();

// 创建对等连接
await webrtc.createPeerConnection('peer1', true);

// 创建 Offer
const offer = await webrtc.createOffer('peer1');

// 设置远程描述
await webrtc.setRemoteDescription('peer1', remoteAnswer);

// 添加 ICE 候选
await webrtc.addIceCandidate('peer1', iceCandidate);

// 静音本地音频
webrtc.muteLocalAudio(true);

// 清理资源
await webrtc.cleanup();
```

### 2. SignalingService

负责管理 WebSocket 信令通信，用于交换 SDP 和 ICE 候选。

**主要功能：**
- 连接到信令服务器
- 加入/离开会话
- 发送/接收 Offer/Answer
- 发送/接收 ICE 候选
- 自动重连
- 心跳保活

**使用示例：**

```typescript
import { SignalingService } from '@/services';

const signaling = new SignalingService({
  serverUrl: 'ws://localhost:8080',
  reconnectInterval: 3000,
  heartbeatInterval: 30000,
  maxReconnectAttempts: 5,
});

// 设置回调
signaling.setCallbacks({
  onSessionJoined: (sessionId, peerId, existingPeers) => {
    console.log(`Joined session ${sessionId} as ${peerId}`);
    console.log(`Existing peers:`, existingPeers);
  },
  onPeerJoined: (sessionId, peerId) => {
    console.log(`Peer ${peerId} joined`);
  },
  onPeerLeft: (sessionId, peerId) => {
    console.log(`Peer ${peerId} left`);
  },
  onOffer: (fromPeerId, offer) => {
    console.log(`Received offer from ${fromPeerId}`);
    // 处理 offer
  },
  onAnswer: (fromPeerId, answer) => {
    console.log(`Received answer from ${fromPeerId}`);
    // 处理 answer
  },
  onIceCandidate: (fromPeerId, candidate) => {
    console.log(`Received ICE candidate from ${fromPeerId}`);
    // 处理 ICE 候选
  },
});

// 连接到信令服务器
await signaling.connect();

// 加入会话
signaling.joinSession('session1', 'peer1');

// 发送 Offer
signaling.sendOffer('peer2', offer);

// 发送 Answer
signaling.sendAnswer('peer2', answer);

// 发送 ICE 候选
signaling.sendIceCandidate('peer2', candidate);

// 离开会话
signaling.leaveSession();

// 断开连接
signaling.disconnect();
```

### 3. WebRTCManager

协调 WebRTC 和信令服务，提供统一的高级 API。

**主要功能：**
- 自动处理会话建立流程
- 管理多对等方连接
- 自动处理 Offer/Answer 交换
- 自动处理 ICE 候选交换
- 简化的 API 接口

**使用示例：**

```typescript
import { WebRTCManager } from '@/services';
import { SessionMode } from '@/types';

const manager = new WebRTCManager({
  signalingServerUrl: 'ws://localhost:8080',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ],
});

// 设置回调
manager.setCallbacks({
  onRemoteStream: (peerId, stream) => {
    console.log(`Received stream from ${peerId}`);
    // 播放远程音频流
  },
  onPeerConnected: (peerId) => {
    console.log(`Connected to ${peerId}`);
  },
  onPeerDisconnected: (peerId) => {
    console.log(`Disconnected from ${peerId}`);
  },
  onSessionJoined: (sessionId, peerId) => {
    console.log(`Joined session ${sessionId}`);
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});

// 初始化
await manager.initialize();

// 加入会话（会议模式）
await manager.joinSession('session1', 'peer1', SessionMode.CONFERENCE);

// 静音本地音频
manager.muteLocalAudio(true);

// 获取所有远程音频流
const remoteStreams = manager.getAllRemoteStreams();
remoteStreams.forEach((stream, peerId) => {
  console.log(`Stream from ${peerId}:`, stream);
});

// 发送数据给所有对等方
manager.sendDataToAllPeers({ type: 'message', text: 'Hello!' });

// 发送数据给特定对等方
manager.sendDataToPeer('peer2', { type: 'message', text: 'Hi peer2!' });

// 离开会话
await manager.leaveSession();

// 清理资源
await manager.cleanup();
```

## 信令协议

### 消息类型

```typescript
enum SignalingMessageType {
  // 会话管理
  JOIN_SESSION = 'join_session',
  LEAVE_SESSION = 'leave_session',
  SESSION_JOINED = 'session_joined',
  PEER_JOINED = 'peer_joined',
  PEER_LEFT = 'peer_left',

  // WebRTC 信令
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice_candidate',

  // 错误和状态
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}
```

### 消息格式

```typescript
interface SignalingMessage {
  type: SignalingMessageType;
  sessionId?: string;
  peerId?: string;
  fromPeerId?: string;
  toPeerId?: string;
  data?: any;
  timestamp?: number;
}
```

### 会话建立流程

```
客户端 A                信令服务器              客户端 B
   |                        |                      |
   |--JOIN_SESSION--------->|                      |
   |<--SESSION_JOINED-------|                      |
   |                        |<--JOIN_SESSION-------|
   |                        |---SESSION_JOINED---->|
   |<--PEER_JOINED----------|                      |
   |                        |---PEER_JOINED------->|
   |                        |                      |
   |--OFFER---------------->|---OFFER------------->|
   |                        |<--ANSWER-------------|
   |<--ANSWER---------------|                      |
   |                        |                      |
   |--ICE_CANDIDATE-------->|---ICE_CANDIDATE----->|
   |<--ICE_CANDIDATE--------|<--ICE_CANDIDATE------|
   |                        |                      |
   |<======= P2P 音频流建立 ======================>|
```

## 会话模式

### 会议模式 (Conference Mode)

- 支持最多 10 个参与者
- 每个参与者与其他所有参与者建立 P2P 连接
- 适用于多人会议场景

### 聊天模式 (Chat Mode)

- 支持 2 个参与者
- 单个 P2P 连接
- 适用于一对一聊天场景

## 配置选项

### WebRTC 配置

```typescript
interface WebRTCConfig {
  // ICE 服务器配置
  iceServers: RTCIceServer[];
  
  // 音频约束
  audioConstraints?: {
    echoCancellation?: boolean;  // 回声消除
    noiseSuppression?: boolean;  // 噪音抑制
    autoGainControl?: boolean;   // 自动增益控制
    sampleRate?: number;         // 采样率
    channelCount?: number;       // 声道数
  };
}
```

### 信令配置

```typescript
interface SignalingConfig {
  serverUrl: string;              // WebSocket 服务器 URL
  reconnectInterval?: number;     // 重连间隔（毫秒）
  heartbeatInterval?: number;     // 心跳间隔（毫秒）
  maxReconnectAttempts?: number;  // 最大重连次数
}
```

## 错误处理

所有服务都提供 `onError` 回调来处理错误：

```typescript
service.setCallbacks({
  onError: (error) => {
    console.error('Error:', error.message);
    
    // 根据错误类型采取不同的处理策略
    if (error.message.includes('Permission denied')) {
      // 处理权限错误
    } else if (error.message.includes('connection')) {
      // 处理连接错误
    }
  },
});
```

## 性能优化

### 音频质量设置

根据网络条件调整音频质量：

```typescript
// 高质量（良好网络）
audioConstraints: {
  sampleRate: 48000,
  channelCount: 2,
}

// 标准质量（一般网络）
audioConstraints: {
  sampleRate: 16000,
  channelCount: 1,
}

// 低质量（差网络）
audioConstraints: {
  sampleRate: 8000,
  channelCount: 1,
}
```

### ICE 服务器选择

使用多个 STUN/TURN 服务器提高连接成功率：

```typescript
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:turn.example.com:3478',
    username: 'user',
    credential: 'pass',
  },
]
```

## 测试

运行单元测试：

```bash
npm test WebRTCService.test.ts
npm test SignalingService.test.ts
```

## 注意事项

1. **浏览器兼容性**：确保目标浏览器支持 WebRTC API
2. **HTTPS 要求**：在生产环境中，必须使用 HTTPS 才能访问麦克风
3. **防火墙**：某些网络环境可能需要 TURN 服务器才能建立连接
4. **资源清理**：使用完毕后务必调用 `cleanup()` 方法释放资源
5. **错误处理**：始终设置 `onError` 回调来处理各种错误情况

## 信令服务器实现

本模块需要配合信令服务器使用。信令服务器可以使用以下技术实现：

- Node.js + WebSocket (ws 库)
- Python + WebSocket (websockets 库)
- Go + WebSocket (gorilla/websocket 库)

简单的 Node.js 信令服务器示例：

```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const sessions = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    
    switch (message.type) {
      case 'join_session':
        // 处理加入会话
        break;
      case 'offer':
      case 'answer':
      case 'ice_candidate':
        // 转发信令消息
        break;
    }
  });
});
```

## 相关需求

- 需求 1.2: 会议模式支持多人参与
- 需求 1.3: 聊天模式支持两人对话
- 需求 7.1: 会议模式支持最多 10 个说话人

## 未来改进

1. 添加视频流支持
2. 实现屏幕共享功能
3. 添加录制功能
4. 实现端到端加密
5. 优化多人会议的音频混合策略
