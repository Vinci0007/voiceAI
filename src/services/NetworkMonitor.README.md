# NetworkMonitor - 网络监控和自适应模块

## 概述

NetworkMonitor 是一个用于监控网络状态并根据网络条件自动调整系统行为的服务。它实现了以下核心功能：

- 实时监控网络延迟和带宽
- 自动切换在线/离线处理模式
- 根据网络质量自适应调整音频质量
- 计算和提供延迟统计指标

## 需求映射

- **需求 5.4**: 网络延迟超过 500ms 时切换到本地处理模式
- **需求 5.5**: 监控并显示当前端到端延迟指标
- **需求 8.4**: 网络带宽不足时降低音频质量以维持实时性

## 核心功能

### 1. 网络监控

```typescript
import { networkMonitor } from './services/NetworkMonitor';

// 启动监控
networkMonitor.startMonitoring();

// 获取当前网络指标
const metrics = networkMonitor.getCurrentMetrics();
console.log('延迟:', metrics.latency, 'ms');
console.log('带宽:', metrics.bandwidth, 'kbps');
console.log('网络质量:', metrics.quality);

// 停止监控
networkMonitor.stopMonitoring();
```

### 2. 延迟统计

```typescript
// 获取延迟统计信息
const latencyMetrics = networkMonitor.getLatencyMetrics();
console.log('当前延迟:', latencyMetrics.current, 'ms');
console.log('平均延迟:', latencyMetrics.average, 'ms');
console.log('最小延迟:', latencyMetrics.min, 'ms');
console.log('最大延迟:', latencyMetrics.max, 'ms');
```

### 3. 处理模式切换

```typescript
// 监听模式切换事件
const unsubscribe = networkMonitor.onModeChange((mode, reason) => {
  console.log('模式切换:', mode, '原因:', reason);
  
  if (mode === ProcessingMode.OFFLINE) {
    // 切换到本地模型
    console.log('切换到离线模式，使用本地模型');
  } else {
    // 切换到云端 API
    console.log('切换到在线模式，使用云端 API');
  }
});

// 取消订阅
unsubscribe();
```

### 4. 音频质量自适应

```typescript
// 监听音频质量变化
networkMonitor.onQualityChange((settings) => {
  console.log('音频质量调整:');
  console.log('- 采样率:', settings.sampleRate, 'Hz');
  console.log('- 比特率:', settings.bitrate, 'kbps');
  console.log('- 声道数:', settings.channels);
  console.log('- 压缩级别:', settings.compression);
  
  // 应用新的音频设置
  audioService.updateSettings(settings);
});
```

### 5. 网络状态监听

```typescript
// 监听网络状态变化
networkMonitor.onNetworkStatus((metrics) => {
  // 更新 UI 显示
  updateNetworkIndicator(metrics.quality);
  updateLatencyDisplay(metrics.latency);
  
  // 根据网络质量显示警告
  if (metrics.quality === NetworkQuality.POOR) {
    showWarning('网络质量较差，可能影响通话质量');
  }
});
```

## 配置选项

```typescript
const monitor = new NetworkMonitor({
  latencyThreshold: 500,        // 高延迟阈值 (ms)
  bandwidthThreshold: 128,      // 低带宽阈值 (kbps)
  monitorInterval: 5000,        // 监控间隔 (ms)
  latencySampleSize: 10,        // 延迟样本大小
  enableAutoAdaptation: true,   // 启用自动适应
  testEndpoints: [              // 测试端点列表
    'https://www.google.com/generate_204',
    'https://www.cloudflare.com/cdn-cgi/trace',
  ],
});
```

## 处理模式

### ProcessingMode.ONLINE
- 使用云端 API 进行语音识别、翻译和合成
- 提供最高质量的处理结果
- 需要稳定的网络连接

### ProcessingMode.OFFLINE
- 使用本地模型进行处理
- 降低对网络的依赖
- 在网络不稳定时自动切换

### ProcessingMode.HYBRID
- 根据网络情况动态选择
- 平衡质量和稳定性

## 网络质量等级

| 等级 | 延迟 | 带宽 | 描述 |
|------|------|------|------|
| EXCELLENT | < 50ms | > 5 Mbps | 优秀 |
| GOOD | < 100ms | > 2 Mbps | 良好 |
| FAIR | < 200ms | > 512 kbps | 一般 |
| POOR | < 500ms | > 128 kbps | 较差 |
| OFFLINE | - | - | 离线 |

## 音频质量自适应策略

根据网络质量自动调整音频参数：

| 网络质量 | 采样率 | 比特率 | 声道 | 压缩 |
|----------|--------|--------|------|------|
| EXCELLENT | 48000 Hz | 128 kbps | 立体声 | 低 (3) |
| GOOD | 44100 Hz | 96 kbps | 立体声 | 中 (5) |
| FAIR | 32000 Hz | 64 kbps | 单声道 | 高 (7) |
| POOR/OFFLINE | 16000 Hz | 32 kbps | 单声道 | 最高 (9) |

## 使用示例

### 完整集成示例

```typescript
import { networkMonitor, ProcessingMode } from './services/NetworkMonitor';
import { streamProcessor } from './services/StreamProcessor';

// 初始化网络监控
networkMonitor.startMonitoring();

// 监听模式切换
networkMonitor.onModeChange((mode, reason) => {
  console.log(`模式切换: ${mode} (${reason})`);
  
  // 更新流处理器配置
  if (mode === ProcessingMode.OFFLINE) {
    streamProcessor.switchToLocalModels();
  } else {
    streamProcessor.switchToCloudAPIs();
  }
});

// 监听音频质量变化
networkMonitor.onQualityChange((settings) => {
  console.log('音频质量调整:', settings);
  audioService.updateQuality(settings);
});

// 监听网络状态
networkMonitor.onNetworkStatus((metrics) => {
  // 更新 UI
  document.getElementById('latency').textContent = 
    `${metrics.latency.toFixed(0)}ms`;
  document.getElementById('quality').textContent = 
    metrics.quality;
});

// 手动触发网络检查
async function checkNetworkNow() {
  const metrics = await networkMonitor.checkNetwork();
  console.log('网络检查结果:', metrics);
}

// 清理
window.addEventListener('beforeunload', () => {
  networkMonitor.dispose();
});
```

### UI 集成示例

```typescript
// 显示网络状态指示器
function updateNetworkIndicator(quality: NetworkQuality) {
  const indicator = document.getElementById('network-indicator');
  
  switch (quality) {
    case NetworkQuality.EXCELLENT:
      indicator.className = 'status-excellent';
      indicator.textContent = '网络优秀';
      break;
    case NetworkQuality.GOOD:
      indicator.className = 'status-good';
      indicator.textContent = '网络良好';
      break;
    case NetworkQuality.FAIR:
      indicator.className = 'status-fair';
      indicator.textContent = '网络一般';
      break;
    case NetworkQuality.POOR:
      indicator.className = 'status-poor';
      indicator.textContent = '网络较差';
      break;
    case NetworkQuality.OFFLINE:
      indicator.className = 'status-offline';
      indicator.textContent = '离线模式';
      break;
  }
}

// 显示延迟指标
function updateLatencyDisplay() {
  const metrics = networkMonitor.getLatencyMetrics();
  
  document.getElementById('current-latency').textContent = 
    `${metrics.current.toFixed(0)}ms`;
  document.getElementById('average-latency').textContent = 
    `${metrics.average.toFixed(0)}ms`;
  document.getElementById('min-latency').textContent = 
    `${metrics.min.toFixed(0)}ms`;
  document.getElementById('max-latency').textContent = 
    `${metrics.max.toFixed(0)}ms`;
}
```

## 注意事项

1. **浏览器兼容性**: 使用 `navigator.onLine` 和 `fetch` API，需要现代浏览器支持
2. **CORS 限制**: 测试端点可能受 CORS 限制，使用 `mode: 'no-cors'` 绕过
3. **延迟测量精度**: 实际延迟包括 DNS 解析、TCP 连接等，不仅是网络传输时间
4. **带宽估算**: 当前实现基于延迟估算，实际应用中应下载测试文件测量真实带宽
5. **自动适应**: 启用自动适应后，系统会自动切换模式和调整质量，可能影响用户体验

## 性能考虑

- 监控间隔默认为 5 秒，可根据需要调整
- 延迟历史保留最近 10 个样本，避免内存占用过大
- 网络检查使用 HEAD 请求，最小化数据传输
- 回调执行在 try-catch 中，避免单个回调错误影响整体功能

## 测试

运行单元测试：

```bash
npm test NetworkMonitor.test.ts
```

测试覆盖：
- 网络指标获取
- 延迟统计计算
- 处理模式切换
- 音频质量自适应
- 回调注册和触发
- 资源清理

## 未来改进

1. 实现真实的带宽测量（下载测试文件）
2. 支持更多的网络质量指标（丢包率、抖动）
3. 添加网络质量预测功能
4. 支持自定义适应策略
5. 添加网络质量历史记录和趋势分析
