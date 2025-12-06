/**
 * PerformanceMonitor 使用示例
 * 
 * 展示如何使用性能监控和降级策略
 */

import {
  PerformanceMonitor,
  ServiceType,
  ModelType,
  PerformanceState,
} from './PerformanceMonitor';
import { NetworkMonitor } from './NetworkMonitor';

/**
 * 示例 1: 基本性能监控
 */
export function example1_BasicMonitoring() {
  console.log('=== Example 1: Basic Performance Monitoring ===\n');

  // 创建性能监控器
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

  // 监听性能更新
  monitor.onPerformanceUpdate((metrics, state) => {
    console.log('Performance Update:');
    console.log(`  State: ${state}`);
    console.log(`  End-to-End Latency: ${metrics.endToEndLatency}ms`);
    console.log(`  CPU Usage: ${(metrics.cpuUsage * 100).toFixed(1)}%`);
    console.log(`  Memory Usage: ${metrics.memoryUsage.toFixed(1)}MB`);
    console.log(`  FPS: ${metrics.fps.toFixed(1)}`);
    console.log('');
  });

  // 启动监控
  monitor.startMonitoring();

  // 模拟一些延迟记录
  setTimeout(() => {
    monitor.recordLatency('audio', 50);
    monitor.recordLatency('recognition', 400);
    monitor.recordLatency('translation', 300);
    monitor.recordLatency('synthesis', 350);
    monitor.recordLatency('endToEnd', 1100);
  }, 1500);

  // 5秒后停止
  setTimeout(() => {
    monitor.stopMonitoring();
    monitor.dispose();
    console.log('Monitoring stopped\n');
  }, 5000);
}

/**
 * 示例 2: 模型管理和切换
 */
export async function example2_ModelManagement() {
  console.log('=== Example 2: Model Management ===\n');

  const monitor = new PerformanceMonitor();

  // 查看所有可用的语音识别模型
  console.log('Available Speech Recognition Models:');
  const recognitionModels = monitor.getAvailableModels(ServiceType.SPEECH_RECOGNITION);
  recognitionModels.forEach(model => {
    console.log(`  ${model.type}:`);
    console.log(`    Provider: ${model.provider}`);
    console.log(`    Expected Latency: ${model.expectedLatency}ms`);
    console.log(`    Quality Score: ${model.qualityScore}`);
    console.log(`    Available: ${model.available}`);
  });
  console.log('');

  // 查看当前激活的模型
  const currentModel = monitor.getActiveModel(ServiceType.SPEECH_RECOGNITION);
  console.log(`Current Active Model: ${currentModel?.type}\n`);

  // 手动切换到本地轻量级模型
  try {
    await monitor.switchModel(
      ServiceType.SPEECH_RECOGNITION,
      ModelType.LOCAL_LIGHTWEIGHT
    );
    console.log('Switched to LOCAL_LIGHTWEIGHT model\n');

    const newModel = monitor.getActiveModel(ServiceType.SPEECH_RECOGNITION);
    console.log(`New Active Model: ${newModel?.type}\n`);
  } catch (error) {
    console.error('Failed to switch model:', error);
  }

  monitor.dispose();
}

/**
 * 示例 3: 自动降级策略
 */
export function example3_AutoDegradation() {
  console.log('=== Example 3: Auto Degradation ===\n');

  const monitor = new PerformanceMonitor({
    thresholds: {
      maxLatency: 2000,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 500,
      minFps: 30,
    },
    enableAutoDegradation: true,
  });

  // 监听降级事件
  monitor.onDegradation((strategy, reason) => {
    console.log('Degradation Triggered:');
    console.log(`  Strategy: ${strategy}`);
    console.log(`  Reason: ${reason}`);
    console.log('');
  });

  // 监听性能状态变化
  let lastState = monitor.getCurrentState();
  monitor.onPerformanceUpdate((metrics, state) => {
    if (state !== lastState) {
      console.log(`Performance State Changed: ${lastState} -> ${state}`);
      lastState = state;
    }
  });

  monitor.startMonitoring();

  // 模拟性能下降
  console.log('Simulating performance degradation...\n');

  setTimeout(() => {
    console.log('Recording high latency (2500ms)...');
    monitor.recordLatency('endToEnd', 2500);
  }, 1000);

  setTimeout(() => {
    console.log('Recording very high latency (3500ms)...');
    monitor.recordLatency('endToEnd', 3500);
  }, 2000);

  // 5秒后停止
  setTimeout(() => {
    monitor.stopMonitoring();
    monitor.dispose();
    console.log('\nMonitoring stopped');
  }, 5000);
}

/**
 * 示例 4: 与网络监控集成
 */
export function example4_NetworkIntegration() {
  console.log('=== Example 4: Network Integration ===\n');

  // 创建网络监控器
  const networkMonitor = new NetworkMonitor({
    latencyThreshold: 500,
    monitorInterval: 2000,
  });

  // 创建性能监控器（传入网络监控器）
  const perfMonitor = new PerformanceMonitor(
    {
      enableAutoDegradation: true,
    },
    networkMonitor
  );

  // 监听网络模式变化
  networkMonitor.onModeChange((mode, reason) => {
    console.log('Network Mode Changed:');
    console.log(`  Mode: ${mode}`);
    console.log(`  Reason: ${reason}`);
    console.log('');
  });

  // 监听性能降级
  perfMonitor.onDegradation((strategy, reason) => {
    console.log('Performance Degradation:');
    console.log(`  Strategy: ${strategy}`);
    console.log(`  Reason: ${reason}`);
    console.log('');
  });

  // 启动监控
  networkMonitor.startMonitoring();
  perfMonitor.startMonitoring();

  // 10秒后停止
  setTimeout(() => {
    networkMonitor.stopMonitoring();
    perfMonitor.stopMonitoring();
    networkMonitor.dispose();
    perfMonitor.dispose();
    console.log('All monitoring stopped\n');
  }, 10000);
}

/**
 * 示例 5: 性能历史分析
 */
export function example5_HistoryAnalysis() {
  console.log('=== Example 5: Performance History Analysis ===\n');

  const monitor = new PerformanceMonitor({
    monitorInterval: 500,
    historySampleSize: 20,
  });

  monitor.startMonitoring();

  // 模拟不同的延迟
  const latencies = [1000, 1200, 1500, 1800, 2200, 2500, 2300, 2000, 1700, 1400];
  let index = 0;

  const interval = setInterval(() => {
    if (index < latencies.length) {
      monitor.recordLatency('endToEnd', latencies[index]);
      index++;
    } else {
      clearInterval(interval);

      // 分析历史数据
      const history = monitor.getMetricsHistory();
      console.log(`Collected ${history.length} samples\n`);

      // 计算统计信息
      const latencyValues = history.map(m => m.endToEndLatency);
      const avgLatency = latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length;
      const maxLatency = Math.max(...latencyValues);
      const minLatency = Math.min(...latencyValues);

      console.log('Latency Statistics:');
      console.log(`  Average: ${avgLatency.toFixed(1)}ms`);
      console.log(`  Maximum: ${maxLatency}ms`);
      console.log(`  Minimum: ${minLatency}ms`);
      console.log('');

      // 检查性能趋势
      const recentLatencies = latencyValues.slice(-5);
      const recentAvg = recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length;
      const trend = recentAvg > avgLatency ? 'increasing' : 'decreasing';

      console.log(`Performance Trend: ${trend}`);
      console.log(`Recent Average: ${recentAvg.toFixed(1)}ms\n`);

      monitor.stopMonitoring();
      monitor.dispose();
    }
  }, 600);
}

/**
 * 示例 6: 完整的翻译管道集成
 */
export async function example6_PipelineIntegration() {
  console.log('=== Example 6: Pipeline Integration ===\n');

  const monitor = new PerformanceMonitor({
    thresholds: {
      maxLatency: 2000,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 500,
      minFps: 30,
    },
    enableAutoDegradation: true,
  });

  // 监听降级事件
  monitor.onDegradation((strategy, reason) => {
    console.log(`⚠️  Degradation: ${strategy} (${reason})`);
  });

  monitor.startMonitoring();

  // 模拟翻译管道处理
  console.log('Processing audio segments...\n');

  const segments = [
    { audio: 50, recognition: 400, translation: 300, synthesis: 350 },
    { audio: 55, recognition: 450, translation: 320, synthesis: 380 },
    { audio: 60, recognition: 500, translation: 350, synthesis: 400 },
    { audio: 70, recognition: 600, translation: 400, synthesis: 450 },
    { audio: 80, recognition: 700, translation: 500, synthesis: 500 },
  ];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const startTime = Date.now();

    // 模拟各阶段处理
    await new Promise(resolve => setTimeout(resolve, 100));

    // 记录各阶段延迟
    monitor.recordLatency('audio', segment.audio);
    monitor.recordLatency('recognition', segment.recognition);
    monitor.recordLatency('translation', segment.translation);
    monitor.recordLatency('synthesis', segment.synthesis);

    const totalLatency = segment.audio + segment.recognition + segment.translation + segment.synthesis;
    monitor.recordLatency('endToEnd', totalLatency);

    const processingTime = Date.now() - startTime;

    console.log(`Segment ${i + 1}:`);
    console.log(`  Total Latency: ${totalLatency}ms`);
    console.log(`  Processing Time: ${processingTime}ms`);
    console.log(`  State: ${monitor.getCurrentState()}`);

    const activeModel = monitor.getActiveModel(ServiceType.SPEECH_RECOGNITION);
    console.log(`  Active Model: ${activeModel?.type}`);
    console.log('');
  }

  monitor.stopMonitoring();
  monitor.dispose();
  console.log('Pipeline processing complete\n');
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   PerformanceMonitor Usage Examples           ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // 注意：在实际使用中，这些示例应该分别运行
  // 这里为了演示目的，我们按顺序运行它们

  example1_BasicMonitoring();

  await new Promise(resolve => setTimeout(resolve, 6000));

  await example2_ModelManagement();

  await new Promise(resolve => setTimeout(resolve, 1000));

  example3_AutoDegradation();

  await new Promise(resolve => setTimeout(resolve, 6000));

  example4_NetworkIntegration();

  await new Promise(resolve => setTimeout(resolve, 11000));

  example5_HistoryAnalysis();

  await new Promise(resolve => setTimeout(resolve, 8000));

  await example6_PipelineIntegration();

  console.log('All examples completed!');
}

// 如果直接运行此文件
if (require.main === module) {
  runAllExamples().catch(console.error);
}
