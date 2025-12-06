# PerformanceMonitor

性能监控和降级策略服务，用于监控系统性能并在性能下降时自动切换到轻量级模型。

## 功能

- **实时性能监控**: 监控 CPU、内存、延迟和帧率
- **轻量级模型管理**: 提供多种质量级别的模型选项
- **自动降级策略**: 根据性能指标自动切换模型
- **API 失败降级**: 云端 API → 备用 API → 本地模型
- **性能历史追踪**: 记录和分析性能趋势

## 需求覆盖

- **需求 6.4**: WHERE 实时性要求无法满足 THEN 系统 SHALL 提供选项使用预训练的轻量级模型

## 使用示例

### 基本使用

```typescript
import { PerformanceMonitor } from './services/PerformanceMonitor';

// 创建监控器
const monitor = new PerformanceMonitor({
  monitorInterval: 1000,
  thresholds: {
    maxLatency: 2000,
    maxCpuUsage: 0.8,
    maxMemoryUsage: 500,
    minFps: 30,
  },
  enableAutoDegradation: true,
});

// 启动监控
monitor.startMonitoring();

// 监听性能更新
monitor.onPerformanceUpdate((metrics, state) => {
  console.log('Performance:', metrics);
  console.log('State:', state);
});

// 监听降级事件
monitor.onDegradation((strategy, reason) => {
  console.log(`Degraded: ${strategy} - ${reason}`);
});
```

### 记录延迟

```typescript
// 记录各阶段延迟
monitor.recordLatency('audio', 50);
monitor.recordLatency('recognition', 400);
monitor.recordLatency('translation', 300);
monitor.recordLatency('synthesis', 350);
monitor.recordLatency('endToEnd', 1100);
```

### 手动切换模型

```typescript
import { ServiceType, ModelType } from './services/PerformanceMonitor';

// 切换到本地轻量级模型
await monitor.switchModel(
  ServiceType.SPEECH_RECOGNITION,
  ModelType.LOCAL_LIGHTWEIGHT
);

// 查看当前激活的模型
const activeModel = monitor.getActiveModel(ServiceType.SPEECH_RECOGNITION);
console.log('Active model:', activeModel);
```

### 查看可用模型

```typescript
// 获取所有可用的语音识别模型
const models = monitor.getAvailableModels(ServiceType.SPEECH_RECOGNITION);

models.forEach(model => {
  console.log(`${model.provider}: ${model.type}`);
  console.log(`  Expected latency: ${model.expectedLatency}ms`);
  console.log(`  Quality score: ${model.qualityScore}`);
  console.log(`  Available: ${model.available}`);
});
```

### 集成到翻译管道

```typescript
import { StreamProcessor } from './services/StreamProcessor';
import { PerformanceMonitor } from './services/PerformanceMonitor';

const monitor = new PerformanceMonitor();
const processor = new StreamProcessor();

monitor.startMonitoring();

// 处理音频流
for await (const output of processor.processAudioStream(
  audioStream,
  userId,
  targetLanguage
)) {
  // 记录端到端延迟
  monitor.recordLatency('endToEnd', output.latency);
  
  // 输出结果
  console.log('Translation:', output.translatedText);
}
```

## API 参考

### PerformanceMonitor

#### 构造函数

```typescript
constructor(
  config?: Partial<PerformanceMonitorConfig>,
  networkMonitor?: NetworkMonitor
)
```

#### 方法

- `startMonitoring()`: 启动性能监控
- `stopMonitoring()`: 停止性能监控
- `getCurrentMetrics()`: 获取当前性能指标
- `getMetricsHistory()`: 获取性能历史
- `getCurrentState()`: 获取当前性能状态
- `getAvailableModels(service)`: 获取可用模型列表
- `getActiveModel(service)`: 获取当前激活的模型
- `switchModel(service, modelType)`: 手动切换模型
- `recordLatency(stage, latency)`: 记录延迟指标
- `onPerformanceUpdate(callback)`: 注册性能更新回调
- `onDegradation(callback)`: 注册降级事件回调
- `dispose()`: 清理资源

### 配置选项

```typescript
interface PerformanceMonitorConfig {
  monitorInterval: number;        // 监控间隔 (ms)
  thresholds: {
    maxLatency: number;           // 最大延迟 (ms)
    maxCpuUsage: number;          // 最大 CPU 使用率 (0-1)
    maxMemoryUsage: number;       // 最大内存 (MB)
    minFps: number;               // 最小帧率
  };
  enableAutoDegradation: boolean; // 启用自动降级
  historySampleSize: number;      // 历史样本大小
}
```

### 性能指标

```typescript
interface PerformanceMetrics {
  cpuUsage: number;              // CPU 使用率
  memoryUsage: number;           // 内存使用 (MB)
  endToEndLatency: number;       // 端到端延迟 (ms)
  audioLatency: number;          // 音频处理延迟 (ms)
  recognitionLatency: number;    // 识别延迟 (ms)
  translationLatency: number;    // 翻译延迟 (ms)
  synthesisLatency: number;      // 合成延迟 (ms)
  fps: number;                   // 帧率
  timestamp: number;             // 时间戳
}
```

### 模型类型

```typescript
enum ModelType {
  CLOUD_HIGH_QUALITY = 'cloud_high_quality',      // 云端高质量
  CLOUD_STANDARD = 'cloud_standard',              // 云端标准
  LOCAL_LIGHTWEIGHT = 'local_lightweight',        // 本地轻量级
  LOCAL_ULTRA_LIGHT = 'local_ultra_light',        // 本地超轻量级
}
```

### 服务类型

```typescript
enum ServiceType {
  SPEECH_RECOGNITION = 'speech_recognition',
  TRANSLATION = 'translation',
  SPEECH_SYNTHESIS = 'speech_synthesis',
  LANGUAGE_DETECTION = 'language_detection',
}
```

### 性能状态

```typescript
enum PerformanceState {
  OPTIMAL = 'optimal',      // 最佳
  DEGRADED = 'degraded',    // 降级
  CRITICAL = 'critical',    // 临界
}
```

## 降级策略

系统包含以下自动降级策略（按优先级排序）：

1. **switch_to_ultra_light_models** (优先级 0)
   - 触发条件: 延迟 > 阈值 × 1.5
   - 动作: 切换到超轻量级模型

2. **switch_to_local_models** (优先级 1)
   - 触发条件: 延迟 > 阈值
   - 动作: 切换到本地轻量级模型

3. **reduce_processing_quality** (优先级 2)
   - 触发条件: CPU 使用率 > 阈值
   - 动作: 降低处理质量

4. **clear_caches** (优先级 3)
   - 触发条件: 内存使用 > 阈值
   - 动作: 清理缓存

## 模型配置

### 语音识别模型

| 模型类型 | 提供商 | 预期延迟 | 质量评分 |
|---------|--------|---------|---------|
| Cloud High Quality | Google Cloud Speech-to-Text | 500ms | 0.95 |
| Cloud Standard | Azure Speech Services | 600ms | 0.90 |
| Local Lightweight | Vosk | 250ms | 0.80 |

### 翻译模型

| 模型类型 | 提供商 | 预期延迟 | 质量评分 |
|---------|--------|---------|---------|
| Cloud High Quality | Google Cloud Translation | 300ms | 0.95 |
| Cloud Standard | DeepL API | 400ms | 0.97 |
| Local Lightweight | NLLB-200 | 400ms | 0.85 |

### 语音合成模型

| 模型类型 | 提供商 | 预期延迟 | 质量评分 |
|---------|--------|---------|---------|
| Cloud High Quality | Google Cloud Text-to-Speech | 400ms | 0.95 |
| Cloud Standard | Azure Neural TTS | 500ms | 0.93 |
| Local Lightweight | Piper TTS | 150ms | 0.80 |

## 性能优化建议

1. **监控间隔**: 根据应用需求调整监控间隔，频繁监控会增加开销
2. **阈值设置**: 根据目标设备性能调整阈值
3. **历史样本**: 较大的样本可以更准确地评估趋势，但会占用更多内存
4. **自动降级**: 在性能敏感的场景启用自动降级

## 注意事项

- 本地模型需要预先下载才能使用
- 模型切换可能导致短暂的处理中断
- CPU 和内存监控在某些环境下可能不准确
- 降级策略会影响输出质量

## 相关服务

- `NetworkMonitor`: 网络监控和自适应
- `ErrorHandler`: 错误处理和重试
- `StreamProcessor`: 翻译管道协调
- `OfflineModelManager`: 离线模型管理
