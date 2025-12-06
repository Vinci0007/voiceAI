/**
 * NetworkMonitor - 网络监控和自适应模块
 * 
 * 功能:
 * - 监控网络延迟和带宽
 * - 自动切换在线/离线模式
 * - 根据网络质量调整音频质量
 * - 计算和显示延迟指标
 * 
 * 需求: 5.4, 5.5, 8.4
 */

import { NetworkQuality } from '../types';
import { OfflineModelManager } from './OfflineModelManager';
import { DataSyncManager } from './DataSyncManager';

export interface NetworkMetrics {
  latency: number; // 网络延迟 (ms)
  bandwidth: number; // 带宽 (kbps)
  packetLoss: number; // 丢包率 (0-1)
  jitter: number; // 抖动 (ms)
  isOnline: boolean; // 是否在线
  quality: NetworkQuality; // 网络质量等级
  timestamp: number; // 测量时间戳
}

export interface LatencyMetrics {
  current: number; // 当前延迟
  average: number; // 平均延迟
  min: number; // 最小延迟
  max: number; // 最大延迟
  samples: number; // 样本数量
}

export interface AudioQualitySettings {
  sampleRate: number; // 采样率 (Hz)
  bitrate: number; // 比特率 (kbps)
  channels: number; // 声道数
  compression: number; // 压缩级别 (0-10)
}

export interface NetworkMonitorConfig {
  latencyThreshold: number; // 高延迟阈值 (ms), 默认 500
  bandwidthThreshold: number; // 低带宽阈值 (kbps), 默认 128
  monitorInterval: number; // 监控间隔 (ms), 默认 5000
  latencySampleSize: number; // 延迟样本大小, 默认 10
  enableAutoAdaptation: boolean; // 启用自动适应, 默认 true
  testEndpoints: string[]; // 测试端点列表
}

export enum ProcessingMode {
  ONLINE = 'online', // 在线模式 (使用云端 API)
  OFFLINE = 'offline', // 离线模式 (使用本地模型)
  HYBRID = 'hybrid', // 混合模式 (根据网络情况动态切换)
}

export type NetworkStatusCallback = (metrics: NetworkMetrics) => void;
export type ModeChangeCallback = (mode: ProcessingMode, reason: string) => void;
export type QualityChangeCallback = (settings: AudioQualitySettings) => void;

/**
 * NetworkMonitor 类
 * 实现网络监控和自适应功能
 */
export class NetworkMonitor {
  private config: Required<NetworkMonitorConfig>;
  private currentMetrics: NetworkMetrics;
  private latencyHistory: number[] = [];
  private currentMode: ProcessingMode = ProcessingMode.ONLINE;
  private currentQualitySettings: AudioQualitySettings;
  private monitorTimer: NodeJS.Timeout | null = null;
  private statusCallbacks: Set<NetworkStatusCallback> = new Set();
  private modeChangeCallbacks: Set<ModeChangeCallback> = new Set();
  private qualityChangeCallbacks: Set<QualityChangeCallback> = new Set();
  private isMonitoring: boolean = false;
  private offlineModelManager?: OfflineModelManager;
  private dataSyncManager?: DataSyncManager;
  private wasOffline: boolean = false;

  constructor(
    config?: Partial<NetworkMonitorConfig>,
    offlineModelManager?: OfflineModelManager,
    dataSyncManager?: DataSyncManager
  ) {
    this.config = {
      latencyThreshold: config?.latencyThreshold ?? 500,
      bandwidthThreshold: config?.bandwidthThreshold ?? 128,
      monitorInterval: config?.monitorInterval ?? 5000,
      latencySampleSize: config?.latencySampleSize ?? 10,
      enableAutoAdaptation: config?.enableAutoAdaptation ?? true,
      testEndpoints: config?.testEndpoints ?? [
        'https://www.google.com/generate_204',
        'https://www.cloudflare.com/cdn-cgi/trace',
      ],
    };

    // 初始化当前指标
    this.currentMetrics = {
      latency: 0,
      bandwidth: 0,
      packetLoss: 0,
      jitter: 0,
      isOnline: navigator.onLine,
      quality: NetworkQuality.EXCELLENT,
      timestamp: Date.now(),
    };

    // 初始化音频质量设置 (高质量)
    this.currentQualitySettings = {
      sampleRate: 48000,
      bitrate: 128,
      channels: 2,
      compression: 3,
    };

    // Store optional dependencies
    this.offlineModelManager = offlineModelManager;
    this.dataSyncManager = dataSyncManager;

    // 监听浏览器在线/离线事件
    this.setupOnlineOfflineListeners();
  }

  /**
   * 启动网络监控
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitorTimer = setInterval(() => {
      this.performNetworkCheck();
    }, this.config.monitorInterval);

    // 立即执行一次检查
    this.performNetworkCheck();
  }

  /**
   * 停止网络监控
   */
  public stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.isMonitoring = false;
  }

  /**
   * 获取当前网络指标
   */
  public getCurrentMetrics(): NetworkMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * 获取延迟统计信息
   */
  public getLatencyMetrics(): LatencyMetrics {
    if (this.latencyHistory.length === 0) {
      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        samples: 0,
      };
    }

    const current = this.latencyHistory[this.latencyHistory.length - 1];
    const average = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    const min = Math.min(...this.latencyHistory);
    const max = Math.max(...this.latencyHistory);

    return {
      current,
      average,
      min,
      max,
      samples: this.latencyHistory.length,
    };
  }

  /**
   * 获取当前处理模式
   */
  public getCurrentMode(): ProcessingMode {
    return this.currentMode;
  }

  /**
   * 获取当前音频质量设置
   */
  public getCurrentQualitySettings(): AudioQualitySettings {
    return { ...this.currentQualitySettings };
  }

  /**
   * 手动触发网络检查
   */
  public async checkNetwork(): Promise<NetworkMetrics> {
    await this.performNetworkCheck();
    return this.getCurrentMetrics();
  }

  /**
   * 注册网络状态回调
   */
  public onNetworkStatus(callback: NetworkStatusCallback): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  /**
   * 注册模式切换回调
   */
  public onModeChange(callback: ModeChangeCallback): () => void {
    this.modeChangeCallbacks.add(callback);
    return () => this.modeChangeCallbacks.delete(callback);
  }

  /**
   * 注册质量变化回调
   */
  public onQualityChange(callback: QualityChangeCallback): () => void {
    this.qualityChangeCallbacks.add(callback);
    return () => this.qualityChangeCallbacks.delete(callback);
  }

  /**
   * 执行网络检查
   */
  private async performNetworkCheck(): Promise<void> {
    try {
      // 检查在线状态
      const isOnline = navigator.onLine;

      if (!isOnline) {
        this.updateMetrics({
          latency: Infinity,
          bandwidth: 0,
          packetLoss: 1,
          jitter: 0,
          isOnline: false,
          quality: NetworkQuality.OFFLINE,
          timestamp: Date.now(),
        });
        return;
      }

      // 测量延迟
      const latency = await this.measureLatency();
      
      // 估算带宽 (简化实现)
      const bandwidth = await this.estimateBandwidth();

      // 计算抖动
      const jitter = this.calculateJitter(latency);

      // 评估网络质量
      const quality = this.evaluateNetworkQuality(latency, bandwidth);

      // 更新指标
      this.updateMetrics({
        latency,
        bandwidth,
        packetLoss: 0, // 简化实现，实际需要更复杂的测量
        jitter,
        isOnline: true,
        quality,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Network check failed:', error);
      // 检查失败，假设网络质量较差
      this.updateMetrics({
        ...this.currentMetrics,
        quality: NetworkQuality.POOR,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 测量网络延迟
   * 需求 5.5: 监控并显示当前端到端延迟指标
   */
  private async measureLatency(): Promise<number> {
    const measurements: number[] = [];

    // 对每个端点进行测量
    for (const endpoint of this.config.testEndpoints) {
      try {
        const startTime = performance.now();
        const response = await fetch(endpoint, {
          method: 'HEAD',
          cache: 'no-cache',
          mode: 'no-cors', // 避免 CORS 问题
        });
        const endTime = performance.now();
        
        measurements.push(endTime - startTime);
      } catch (error) {
        // 端点不可达，跳过
        continue;
      }
    }

    // 如果所有端点都失败，返回一个高延迟值
    if (measurements.length === 0) {
      return 1000;
    }

    // 返回平均延迟
    return measurements.reduce((a, b) => a + b, 0) / measurements.length;
  }

  /**
   * 估算带宽
   * 需求 8.4: 根据带宽调整音频质量
   */
  private async estimateBandwidth(): Promise<number> {
    // 简化实现：基于延迟估算带宽
    // 实际应用中应该下载测试文件来测量真实带宽
    const latency = this.currentMetrics.latency;

    if (latency < 50) {
      return 10000; // 10 Mbps
    } else if (latency < 100) {
      return 5000; // 5 Mbps
    } else if (latency < 200) {
      return 2000; // 2 Mbps
    } else if (latency < 500) {
      return 512; // 512 kbps
    } else {
      return 128; // 128 kbps
    }
  }

  /**
   * 计算抖动
   */
  private calculateJitter(currentLatency: number): number {
    if (this.latencyHistory.length === 0) {
      return 0;
    }

    const lastLatency = this.latencyHistory[this.latencyHistory.length - 1];
    return Math.abs(currentLatency - lastLatency);
  }

  /**
   * 评估网络质量
   */
  private evaluateNetworkQuality(latency: number, bandwidth: number): NetworkQuality {
    // 基于延迟和带宽评估网络质量
    if (latency < 50 && bandwidth > 5000) {
      return NetworkQuality.EXCELLENT;
    } else if (latency < 100 && bandwidth > 2000) {
      return NetworkQuality.GOOD;
    } else if (latency < 200 && bandwidth > 512) {
      return NetworkQuality.FAIR;
    } else if (latency < 500 && bandwidth > 128) {
      return NetworkQuality.POOR;
    } else {
      return NetworkQuality.OFFLINE;
    }
  }

  /**
   * 更新网络指标
   */
  private updateMetrics(metrics: NetworkMetrics): void {
    const previousMetrics = this.currentMetrics;
    this.currentMetrics = metrics;

    // 更新延迟历史
    this.latencyHistory.push(metrics.latency);
    if (this.latencyHistory.length > this.config.latencySampleSize) {
      this.latencyHistory.shift();
    }

    // 通知状态回调
    this.statusCallbacks.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Network status callback error:', error);
      }
    });

    // 如果启用自动适应，检查是否需要切换模式或调整质量
    if (this.config.enableAutoAdaptation) {
      this.adaptToNetworkConditions(metrics, previousMetrics);
    }
  }

  /**
   * 根据网络条件自适应调整
   * 需求 5.4: 网络延迟超过 500ms 时切换到本地处理模式
   * 需求 8.4: 网络带宽不足时降低音频质量
   */
  private adaptToNetworkConditions(
    current: NetworkMetrics,
    previous: NetworkMetrics
  ): void {
    // 检查是否需要切换处理模式
    this.checkModeSwitch(current);

    // 检查是否需要调整音频质量
    this.checkQualityAdjustment(current, previous);
  }

  /**
   * 检查是否需要切换处理模式
   * 需求 5.4: 网络延迟超过 500ms 时切换到本地处理模式
   * 需求 8.1: 网络连接中断时切换到离线模式并通知用户
   * 需求 8.3: 网络连接恢复时自动重新连接并同步数据
   */
  private checkModeSwitch(metrics: NetworkMetrics): void {
    const previousMode = this.currentMode;
    let newMode = previousMode;
    let reason = '';

    // 离线状态 (Requirement 8.1)
    if (!metrics.isOnline) {
      newMode = ProcessingMode.OFFLINE;
      reason = 'Network connection lost';
      this.wasOffline = true;
    }
    // 高延迟
    else if (metrics.latency > this.config.latencyThreshold) {
      newMode = ProcessingMode.OFFLINE;
      reason = `High latency detected: ${metrics.latency.toFixed(0)}ms > ${this.config.latencyThreshold}ms`;
    }
    // 网络质量差
    else if (metrics.quality === NetworkQuality.POOR) {
      newMode = ProcessingMode.OFFLINE;
      reason = 'Poor network quality';
    }
    // 网络恢复良好 (Requirement 8.3)
    else if (metrics.quality === NetworkQuality.EXCELLENT || metrics.quality === NetworkQuality.GOOD) {
      newMode = ProcessingMode.ONLINE;
      reason = 'Network quality improved';
      
      // If recovering from offline, trigger data sync
      if (this.wasOffline && this.dataSyncManager) {
        this.wasOffline = false;
        this.triggerDataSync();
      }
    }

    // 如果模式发生变化，通知回调
    if (newMode !== previousMode) {
      this.currentMode = newMode;
      
      // Check offline capability when switching to offline mode
      if (newMode === ProcessingMode.OFFLINE && this.offlineModelManager) {
        const capability = this.offlineModelManager.getOfflineCapability();
        if (!capability.isAvailable) {
          console.warn('Offline mode activated but no offline models available');
          reason += ' (Limited functionality - no offline models)';
        }
      }
      
      this.modeChangeCallbacks.forEach(callback => {
        try {
          callback(newMode, reason);
        } catch (error) {
          console.error('Mode change callback error:', error);
        }
      });
    }
  }

  /**
   * Trigger data synchronization after network recovery
   * 
   * Requirement 8.3: Sync offline data when network recovers
   */
  private async triggerDataSync(): Promise<void> {
    if (!this.dataSyncManager) {
      return;
    }

    try {
      console.log('Network recovered, starting data synchronization...');
      const result = await this.dataSyncManager.sync();
      
      if (result.success) {
        console.log(`Data sync completed: ${result.syncedCount} operations synced`);
      } else {
        console.warn(`Data sync completed with errors: ${result.failedCount} operations failed`);
      }
    } catch (error) {
      console.error('Data sync failed:', error);
    }
  }

  /**
   * 检查是否需要调整音频质量
   * 需求 8.4: 网络带宽不足时降低音频质量
   */
  private checkQualityAdjustment(
    current: NetworkMetrics,
    previous: NetworkMetrics
  ): void {
    // 只在网络质量发生变化时调整
    if (current.quality === previous.quality) {
      return;
    }

    const previousSettings = this.currentQualitySettings;
    let newSettings = { ...previousSettings };

    // 根据网络质量调整音频设置
    switch (current.quality) {
      case NetworkQuality.EXCELLENT:
        newSettings = {
          sampleRate: 48000,
          bitrate: 128,
          channels: 2,
          compression: 3,
        };
        break;

      case NetworkQuality.GOOD:
        newSettings = {
          sampleRate: 44100,
          bitrate: 96,
          channels: 2,
          compression: 5,
        };
        break;

      case NetworkQuality.FAIR:
        newSettings = {
          sampleRate: 32000,
          bitrate: 64,
          channels: 1,
          compression: 7,
        };
        break;

      case NetworkQuality.POOR:
      case NetworkQuality.OFFLINE:
        newSettings = {
          sampleRate: 16000,
          bitrate: 32,
          channels: 1,
          compression: 9,
        };
        break;
    }

    // 如果设置发生变化，更新并通知
    if (JSON.stringify(newSettings) !== JSON.stringify(previousSettings)) {
      this.currentQualitySettings = newSettings;
      this.qualityChangeCallbacks.forEach(callback => {
        try {
          callback(newSettings);
        } catch (error) {
          console.error('Quality change callback error:', error);
        }
      });
    }
  }

  /**
   * 设置在线/离线事件监听器
   */
  private setupOnlineOfflineListeners(): void {
    window.addEventListener('online', () => {
      this.currentMetrics.isOnline = true;
      this.performNetworkCheck();
    });

    window.addEventListener('offline', () => {
      this.updateMetrics({
        latency: Infinity,
        bandwidth: 0,
        packetLoss: 1,
        jitter: 0,
        isOnline: false,
        quality: NetworkQuality.OFFLINE,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.stopMonitoring();
    this.statusCallbacks.clear();
    this.modeChangeCallbacks.clear();
    this.qualityChangeCallbacks.clear();
  }
}

// 导出单例实例
export const networkMonitor = new NetworkMonitor();
