/**
 * NetworkMonitor 使用示例
 */

import {
  NetworkMonitor,
  ProcessingMode,
  type NetworkMetrics,
  type LatencyMetrics,
  type AudioQualitySettings,
} from './NetworkMonitor';
import { NetworkQuality } from '../types';

// ============================================================================
// 示例 1: 基本使用
// ============================================================================

function example1_BasicUsage() {
  console.log('=== 示例 1: 基本使用 ===\n');

  // 创建网络监控实例
  const monitor = new NetworkMonitor({
    latencyThreshold: 500,
    monitorInterval: 5000,
  });

  // 启动监控
  monitor.startMonitoring();

  // 获取当前网络指标
  const metrics = monitor.getCurrentMetrics();
  console.log('当前网络指标:');
  console.log('- 延迟:', metrics.latency, 'ms');
  console.log('- 带宽:', metrics.bandwidth, 'kbps');
  console.log('- 在线状态:', metrics.isOnline);
  console.log('- 网络质量:', metrics.quality);

  // 停止监控
  setTimeout(() => {
    monitor.stopMonitoring();
    monitor.dispose();
    console.log('\n监控已停止\n');
  }, 10000);
}

// ============================================================================
// 示例 2: 延迟统计
// ============================================================================

function example2_LatencyMetrics() {
  console.log('=== 示例 2: 延迟统计 ===\n');

  const monitor = new NetworkMonitor();
  monitor.startMonitoring();

  // 定期显示延迟统计
  const interval = setInterval(() => {
    const latencyMetrics: LatencyMetrics = monitor.getLatencyMetrics();
    
    console.log('延迟统计:');
    console.log('- 当前:', latencyMetrics.current.toFixed(0), 'ms');
    console.log('- 平均:', latencyMetrics.average.toFixed(0), 'ms');
    console.log('- 最小:', latencyMetrics.min.toFixed(0), 'ms');
    console.log('- 最大:', latencyMetrics.max.toFixed(0), 'ms');
    console.log('- 样本数:', latencyMetrics.samples);
    console.log('---');
  }, 6000);

  // 清理
  setTimeout(() => {
    clearInterval(interval);
    monitor.stopMonitoring();
    monitor.dispose();
    console.log('\n示例结束\n');
  }, 30000);
}

// ============================================================================
// 示例 3: 模式切换监听
// ============================================================================

function example3_ModeChangeListener() {
  console.log('=== 示例 3: 模式切换监听 ===\n');

  const monitor = new NetworkMonitor({
    latencyThreshold: 500,
  });

  // 注册模式切换回调
  const unsubscribe = monitor.onModeChange((mode: ProcessingMode, reason: string) => {
    console.log(`\n🔄 模式切换事件:`);
    console.log(`- 新模式: ${mode}`);
    console.log(`- 原因: ${reason}`);

    // 根据模式执行相应操作
    if (mode === ProcessingMode.OFFLINE) {
      console.log('✓ 切换到本地模型');
      // switchToLocalModels();
    } else if (mode === ProcessingMode.ONLINE) {
      console.log('✓ 切换到云端 API');
      // switchToCloudAPIs();
    }
  });

  monitor.startMonitoring();

  // 清理
  setTimeout(() => {
    unsubscribe();
    monitor.stopMonitoring();
    monitor.dispose();
    console.log('\n示例结束\n');
  }, 20000);
}

// ============================================================================
// 示例 4: 音频质量自适应
// ============================================================================

function example4_QualityAdaptation() {
  console.log('=== 示例 4: 音频质量自适应 ===\n');

  const monitor = new NetworkMonitor({
    enableAutoAdaptation: true,
  });

  // 监听音频质量变化
  monitor.onQualityChange((settings: AudioQualitySettings) => {
    console.log('\n🎵 音频质量调整:');
    console.log(`- 采样率: ${settings.sampleRate} Hz`);
    console.log(`- 比特率: ${settings.bitrate} kbps`);
    console.log(`- 声道数: ${settings.channels}`);
    console.log(`- 压缩级别: ${settings.compression}`);

    // 应用新的音频设置
    applyAudioSettings(settings);
  });

  monitor.startMonitoring();

  // 清理
  setTimeout(() => {
    monitor.stopMonitoring();
    monitor.dispose();
    console.log('\n示例结束\n');
  }, 20000);
}

function applyAudioSettings(settings: AudioQualitySettings) {
  // 实际应用中，这里会更新音频服务的配置
  console.log('✓ 音频设置已应用');
}

// ============================================================================
// 示例 5: 网络状态监听
// ============================================================================

function example5_NetworkStatusListener() {
  console.log('=== 示例 5: 网络状态监听 ===\n');

  const monitor = new NetworkMonitor();

  // 注册网络状态回调
  monitor.onNetworkStatus((metrics: NetworkMetrics) => {
    console.log(`\n📊 网络状态更新 [${new Date().toLocaleTimeString()}]:`);
    console.log(`- 延迟: ${metrics.latency.toFixed(0)} ms`);
    console.log(`- 带宽: ${metrics.bandwidth.toFixed(0)} kbps`);
    console.log(`- 抖动: ${metrics.jitter.toFixed(0)} ms`);
    console.log(`- 质量: ${metrics.quality}`);
    console.log(`- 在线: ${metrics.isOnline ? '是' : '否'}`);

    // 根据网络质量显示警告
    if (metrics.quality === NetworkQuality.POOR) {
      console.warn('⚠️  网络质量较差，可能影响通话质量');
    } else if (metrics.quality === NetworkQuality.OFFLINE) {
      console.error('❌ 网络连接已断开');
    }
  });

  monitor.startMonitoring();

  // 清理
  setTimeout(() => {
    monitor.stopMonitoring();
    monitor.dispose();
    console.log('\n示例结束\n');
  }, 20000);
}

// ============================================================================
// 示例 6: 手动网络检查
// ============================================================================

async function example6_ManualCheck() {
  console.log('=== 示例 6: 手动网络检查 ===\n');

  const monitor = new NetworkMonitor();

  try {
    console.log('执行网络检查...');
    const metrics = await monitor.checkNetwork();

    console.log('\n网络检查结果:');
    console.log('- 延迟:', metrics.latency.toFixed(0), 'ms');
    console.log('- 带宽:', metrics.bandwidth.toFixed(0), 'kbps');
    console.log('- 质量:', metrics.quality);
    console.log('- 在线:', metrics.isOnline);

    // 根据结果决定处理策略
    if (metrics.latency > 500) {
      console.log('\n建议: 切换到本地处理模式');
    } else if (metrics.quality === NetworkQuality.EXCELLENT) {
      console.log('\n建议: 使用高质量云端服务');
    }
  } catch (error) {
    console.error('网络检查失败:', error);
  } finally {
    monitor.dispose();
    console.log('\n示例结束\n');
  }
}

// ============================================================================
// 示例 7: 完整集成示例
// ============================================================================

function example7_FullIntegration() {
  console.log('=== 示例 7: 完整集成示例 ===\n');

  const monitor = new NetworkMonitor({
    latencyThreshold: 500,
    bandwidthThreshold: 128,
    monitorInterval: 5000,
    enableAutoAdaptation: true,
  });

  // 1. 监听模式切换
  monitor.onModeChange((mode, reason) => {
    console.log(`\n🔄 模式切换: ${mode}`);
    console.log(`   原因: ${reason}`);
    
    // 更新系统配置
    updateSystemMode(mode);
  });

  // 2. 监听音频质量变化
  monitor.onQualityChange((settings) => {
    console.log(`\n🎵 音频质量: ${settings.bitrate}kbps @ ${settings.sampleRate}Hz`);
    
    // 更新音频配置
    updateAudioConfig(settings);
  });

  // 3. 监听网络状态
  monitor.onNetworkStatus((metrics) => {
    // 更新 UI 显示
    updateNetworkUI(metrics);
    
    // 记录指标
    logMetrics(metrics);
  });

  // 启动监控
  monitor.startMonitoring();

  // 定期显示延迟统计
  const statsInterval = setInterval(() => {
    const latencyMetrics = monitor.getLatencyMetrics();
    console.log(`\n📈 延迟统计: 当前=${latencyMetrics.current.toFixed(0)}ms, ` +
                `平均=${latencyMetrics.average.toFixed(0)}ms`);
  }, 10000);

  // 清理
  setTimeout(() => {
    clearInterval(statsInterval);
    monitor.stopMonitoring();
    monitor.dispose();
    console.log('\n=== 集成示例结束 ===\n');
  }, 60000);
}

function updateSystemMode(mode: ProcessingMode) {
  console.log(`   ✓ 系统模式已更新为: ${mode}`);
}

function updateAudioConfig(settings: AudioQualitySettings) {
  console.log(`   ✓ 音频配置已更新`);
}

function updateNetworkUI(metrics: NetworkMetrics) {
  // 在实际应用中，这里会更新 UI 元素
  // 例如: 网络质量指示器、延迟显示等
}

function logMetrics(metrics: NetworkMetrics) {
  // 在实际应用中，这里会记录指标到日志系统
}

// ============================================================================
// 示例 8: 自定义配置
// ============================================================================

function example8_CustomConfiguration() {
  console.log('=== 示例 8: 自定义配置 ===\n');

  // 创建自定义配置的监控器
  const monitor = new NetworkMonitor({
    // 更严格的延迟阈值
    latencyThreshold: 300,
    
    // 更高的带宽要求
    bandwidthThreshold: 256,
    
    // 更频繁的监控
    monitorInterval: 3000,
    
    // 更大的样本大小
    latencySampleSize: 20,
    
    // 禁用自动适应（手动控制）
    enableAutoAdaptation: false,
    
    // 自定义测试端点
    testEndpoints: [
      'https://www.google.com/generate_204',
      'https://www.cloudflare.com/cdn-cgi/trace',
      'https://api.github.com',
    ],
  });

  console.log('自定义配置已应用:');
  console.log('- 延迟阈值: 300ms');
  console.log('- 带宽阈值: 256kbps');
  console.log('- 监控间隔: 3秒');
  console.log('- 样本大小: 20');
  console.log('- 自动适应: 禁用');

  monitor.startMonitoring();

  // 手动控制模式切换
  monitor.onNetworkStatus((metrics) => {
    if (metrics.latency > 300) {
      console.log('\n⚠️  延迟超过阈值，建议手动切换到离线模式');
    }
  });

  // 清理
  setTimeout(() => {
    monitor.stopMonitoring();
    monitor.dispose();
    console.log('\n示例结束\n');
  }, 20000);
}

// ============================================================================
// 运行示例
// ============================================================================

// 取消注释以运行特定示例

// example1_BasicUsage();
// example2_LatencyMetrics();
// example3_ModeChangeListener();
// example4_QualityAdaptation();
// example5_NetworkStatusListener();
// example6_ManualCheck();
// example7_FullIntegration();
// example8_CustomConfiguration();

export {
  example1_BasicUsage,
  example2_LatencyMetrics,
  example3_ModeChangeListener,
  example4_QualityAdaptation,
  example5_NetworkStatusListener,
  example6_ManualCheck,
  example7_FullIntegration,
  example8_CustomConfiguration,
};
