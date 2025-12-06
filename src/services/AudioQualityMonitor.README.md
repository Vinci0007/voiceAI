# AudioQualityMonitor

音频质量监控和自适应参数调整服务。

## 功能

- **质量评估**: 实时评估音频质量（SNR、清晰度、回声、噪音）
- **自适应参数调整**: 根据质量指标自动调整处理参数
- **质量通知**: 检测质量问题并通知用户
- **历史跟踪**: 维护质量历史记录用于趋势分析

## 使用方法

### 基本使用

```typescript
import { AudioQualityMonitor } from './services/AudioQualityMonitor';
import { AudioQuality } from './api/audioProcessor';

// 创建监控器
const monitor = new AudioQualityMonitor();

// 设置通知回调
monitor.setNotificationCallback((notification) => {
  console.log(`[${notification.severity}] ${notification.message}`);
  notification.suggestions.forEach((s) => console.log(`  - ${s}`));
});

// 评估音频质量
const quality: AudioQuality = {
  snr: 15,
  clarity: 0.5,
  has_echo: false,
  has_noise: false,
};

monitor.assessQuality(quality);

// 获取自适应参数
const params = monitor.getAdaptiveParameters();
console.log('Noise Reduction:', params.noiseReductionLevel);
console.log('Echo Cancellation:', params.echoCancellationLevel);
console.log('Gain Adjustment:', params.gainAdjustment);

// 检查质量是否可接受
if (monitor.isQualityAcceptable()) {
  console.log('Quality is acceptable for recognition');
}
```

### 自定义阈值

```typescript
const monitor = new AudioQualityMonitor({
  minSnr: 15,           // 最小信噪比
  minClarity: 0.5,      // 最小清晰度
  noiseThreshold: 0.3,  // 噪音检测阈值
});
```

### 获取质量报告

```typescript
const report = monitor.getQualityReport();

console.log('Status:', report.status);
console.log('Average SNR:', report.metrics.averageSnr);
console.log('Average Clarity:', report.metrics.averageClarity);
console.log('Recommendations:');
report.recommendations.forEach((r) => console.log(`  - ${r}`));
```

### 获取质量指标

```typescript
const metrics = monitor.getMetrics();

console.log('Average SNR:', metrics.averageSnr);
console.log('Average Clarity:', metrics.averageClarity);
console.log('Noise Detection Rate:', metrics.noiseDetectionRate);
console.log('Echo Detection Rate:', metrics.echoDetectionRate);
console.log('Sample Count:', metrics.sampleCount);
```

## 质量状态

监控器根据质量指标返回以下状态之一：

- **excellent**: SNR > 20 且 清晰度 > 0.7
- **good**: SNR > 15 且 清晰度 > 0.5
- **fair**: SNR > 10 且 清晰度 > 0.3
- **poor**: 低于 fair 标准

## 自适应参数

监控器自动调整以下参数：

### 噪音抑制级别 (0.0 - 1.0)
- 检测到噪音时增加
- 质量优秀时减少（保留自然声音）
- 范围: 0.3 - 1.0

### 回声消除级别 (0.0 - 1.0)
- 检测到回声时增加
- 无回声时逐渐减少
- 范围: 0.3 - 1.0

### 增益调整 (0.5 - 2.0)
- 清晰度低时增加
- 信号强时减少（避免削波）
- 范围: 0.5 - 2.0

## 通知系统

### 通知严重程度

- **info**: 信息性通知
- **warning**: 警告，可能影响质量
- **critical**: 严重问题，可能导致识别失败

### 通知冷却

为避免通知泛滥，系统在两次通知之间有 5 秒冷却时间。

### 通知内容

每个通知包含：
- `severity`: 严重程度
- `message`: 问题描述
- `suggestions`: 改善建议列表
- `timestamp`: 时间戳

## 质量问题检测

### 低信噪比
- **临界**: SNR < 5 dB
  - 消息: "信噪比极低，语音识别可能失败"
  - 建议: "请移至安静环境或使用耳机麦克风"
- **警告**: SNR < 10 dB
  - 消息: "信噪比较低，可能影响识别准确度"
  - 建议: "请尝试降低背景噪音"

### 低清晰度
- **临界**: 清晰度 < 0.2
  - 消息: "音频清晰度极差"
  - 建议: "请检查麦克风是否正常工作"
- **警告**: 清晰度 < 0.3
  - 消息: "音频清晰度不足"
  - 建议: "请提高说话音量或靠近麦克风"

### 回声检测
- 消息: "检测到回声"
- 建议:
  - "请使用耳机或降低扬声器音量"
  - "请远离墙壁或硬质表面"

### 持续噪音
- 当噪音检测率 > 50% 时触发
- 消息: "背景噪音持续过大"
- 建议:
  - "请移至安静环境"
  - "请关闭附近的噪音源（风扇、空调等）"

## API 参考

### 构造函数

```typescript
constructor(thresholds?: Partial<QualityThresholds>)
```

### 方法

#### assessQuality(quality: AudioQuality): void
评估音频质量并更新自适应参数。

#### getAdaptiveParameters(): AdaptiveParameters
获取当前自适应参数。

#### getMetrics(): QualityMetrics
获取质量指标统计。

#### getQualityStatus(): 'excellent' | 'good' | 'fair' | 'poor'
获取当前质量状态。

#### isQualityAcceptable(): boolean
检查质量是否可接受用于识别。

#### setNotificationCallback(callback: (notification: QualityNotification) => void): void
设置通知回调函数。

#### updateThresholds(thresholds: Partial<QualityThresholds>): void
更新质量阈值。

#### reset(): void
重置历史记录和参数。

#### getHistory(): AudioQuality[]
获取质量历史记录。

#### getQualityReport(): QualityReport
获取详细质量报告。

## 集成示例

### 与 AudioService 集成

```typescript
import { AudioService } from './services/AudioService';
import { AudioQualityMonitor } from './services/AudioQualityMonitor';

const audioService = new AudioService();
const qualityMonitor = new AudioQualityMonitor();

// 设置通知
qualityMonitor.setNotificationCallback((notification) => {
  // 显示通知给用户
  showNotification(notification);
});

// 开始录音
await audioService.startRecording({
  onAudioData: (processedAudio) => {
    // 评估质量
    qualityMonitor.assessQuality(processedAudio.quality);
    
    // 获取自适应参数
    const params = qualityMonitor.getAdaptiveParameters();
    
    // 使用参数调整后续处理
    // ...
  },
  onQualityIssue: (issues) => {
    console.log('Quality issues:', issues);
  },
  onError: (error) => {
    console.error('Audio error:', error);
  },
});
```

### 实时质量监控 UI

```typescript
// 定期更新 UI
setInterval(() => {
  const status = qualityMonitor.getQualityStatus();
  const metrics = qualityMonitor.getMetrics();
  
  updateQualityIndicator(status);
  updateMetricsDisplay(metrics);
}, 1000);
```

## 性能考虑

- 质量历史限制为 100 个样本，避免内存增长
- 通知有 5 秒冷却时间，避免通知泛滥
- 参数调整是渐进式的，避免突然变化
- 所有计算都是轻量级的，适合实时处理

## 需求映射

- **需求 10.2**: 质量自适应参数调整
- **需求 10.5**: 噪音阈值检测和用户通知
