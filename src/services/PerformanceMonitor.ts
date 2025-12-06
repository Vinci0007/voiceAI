/**
 * PerformanceMonitor - 性能监控和降级策略
 * 
 * 功能:
 * - 实时性能监控 (CPU、内存、延迟)
 * - 轻量级模型选项管理
 * - API 失败降级策略
 * - 自动降级决策逻辑
 * 
 * 需求: 6.4 - WHERE 实时性要求无法满足 THEN 系统 SHALL 提供选项使用预训练的轻量级模型
 */

import { ErrorHandler, ErrorType, ErrorSeverity, createError } from './ErrorHandler';
import { NetworkMonitor, ProcessingMode } from './NetworkMonitor';

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** CPU 使用率 (0-1) */
  cpuUsage: number;
  /** 内存使用 (MB) */
  memoryUsage: number;
  /** 端到端延迟 (ms) */
  endToEndLatency: number;
  /** 音频处理延迟 (ms) */
  audioLatency: number;
  /** 识别延迟 (ms) */
  recognitionLatency: number;
  /** 翻译延迟 (ms) */
  translationLatency: number;
  /** 合成延迟 (ms) */
  synthesisLatency: number;
  /** 帧率 (FPS) */
  fps: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 模型类型
 */
export enum ModelType {
  /** 云端高质量模型 */
  CLOUD_HIGH_QUALITY = 'cloud_high_quality',
  /** 云端标准模型 */
  CLOUD_STANDARD = 'cloud_standard',
  /** 本地轻量级模型 */
  LOCAL_LIGHTWEIGHT = 'local_lightweight',
  /** 本地超轻量级模型 */
  LOCAL_ULTRA_LIGHT = 'local_ultra_light',
}

/**
 * 服务类型
 */
export enum ServiceType {
  SPEECH_RECOGNITION = 'speech_recognition',
  TRANSLATION = 'translation',
  SPEECH_SYNTHESIS = 'speech_synthesis',
  LANGUAGE_DETECTION = 'language_detection',
}

/**
 * 模型配置
 */
export interface ModelConfig {
  type: ModelType;
  service: ServiceType;
  provider: string;
  endpoint?: string;
  modelName?: string;
  /** 预期延迟 (ms) */
  expectedLatency: number;
  /** 质量评分 (0-1) */
  qualityScore: number;
  /** 是否可用 */
  available: boolean;
}

/**
 * 降级策略
 */
export interface DegradationStrategy {
  /** 策略名称 */
  name: string;
  /** 触发条件 */
  condition: (metrics: PerformanceMetrics) => boolean;
  /** 执行动作 */
  action: () => Promise<void>;
  /** 优先级 (数字越小优先级越高) */
  priority: number;
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholds {
  /** 最大可接受延迟 (ms) */
  maxLatency: number;
  /** 最大 CPU 使用率 (0-1) */
  maxCpuUsage: number;
  /** 最大内存使用 (MB) */
  maxMemoryUsage: number;
  /** 最小帧率 (FPS) */
  minFps: number;
}

/**
 * 性能监控配置
 */
export interface PerformanceMonitorConfig {
  /** 监控间隔 (ms) */
  monitorInterval: number;
  /** 性能阈值 */
  thresholds: PerformanceThresholds;
  /** 启用自动降级 */
  enableAutoDegradation: boolean;
  /** 历史样本大小 */
  historySampleSize: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  monitorInterval: 1000,
  thresholds: {
    maxLatency: 2000, // 2 seconds (Requirement 5.1)
    maxCpuUsage: 0.8, // 80%
    maxMemoryUsage: 500, // 500 MB
    minFps: 30,
  },
  enableAutoDegradation: true,
  historySampleSize: 60,
};

/**
 * 性能状态
 */
export enum PerformanceState {
  OPTIMAL = 'optimal',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
}

export type PerformanceCallback = (metrics: PerformanceMetrics, state: PerformanceState) => void;
export type DegradationCallback = (strategy: string, reason: string) => void;

/**
 * PerformanceMonitor 类
 * 
 * 实现性能监控和自动降级策略
 */
export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private errorHandler: ErrorHandler;
  private networkMonitor?: NetworkMonitor;
  
  private currentMetrics: PerformanceMetrics;
  private metricsHistory: PerformanceMetrics[] = [];
  private currentState: PerformanceState = PerformanceState.OPTIMAL;
  
  private modelConfigs: Map<ServiceType, ModelConfig[]> = new Map();
  private activeModels: Map<ServiceType, ModelConfig> = new Map();
  private degradationStrategies: DegradationStrategy[] = [];
  
  private monitorTimer: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  
  private performanceCallbacks: Set<PerformanceCallback> = new Set();
  private degradationCallbacks: Set<DegradationCallback> = new Set();
  
  private lastFrameTime: number = 0;
  private frameCount: number = 0;

  constructor(
    config?: Partial<PerformanceMonitorConfig>,
    networkMonitor?: NetworkMonitor
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.errorHandler = new ErrorHandler();
    this.networkMonitor = networkMonitor;
    
    this.currentMetrics = this.initializeMetrics();
    
    // 初始化模型配置
    this.initializeModelConfigs();
    
    // 初始化降级策略
    this.initializeDegradationStrategies();
  }

  /**
   * 启动性能监控
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitorTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitorInterval);

    // 立即执行一次收集
    this.collectMetrics();
  }

  /**
   * 停止性能监控
   */
  public stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.isMonitoring = false;
  }

  /**
   * 获取当前性能指标
   */
  public getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * 获取性能历史
   */
  public getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * 获取当前性能状态
   */
  public getCurrentState(): PerformanceState {
    return this.currentState;
  }

  /**
   * 获取可用模型配置
   */
  public getAvailableModels(service: ServiceType): ModelConfig[] {
    return this.modelConfigs.get(service) || [];
  }

  /**
   * 获取当前激活的模型
   */
  public getActiveModel(service: ServiceType): ModelConfig | undefined {
    return this.activeModels.get(service);
  }

  /**
   * 手动切换模型
   */
  public async switchModel(service: ServiceType, modelType: ModelType): Promise<void> {
    const models = this.modelConfigs.get(service) || [];
    const targetModel = models.find(m => m.type === modelType);
    
    if (!targetModel) {
      throw new Error(`Model ${modelType} not found for service ${service}`);
    }
    
    if (!targetModel.available) {
      throw new Error(`Model ${modelType} is not available`);
    }
    
    const previousModel = this.activeModels.get(service);
    this.activeModels.set(service, targetModel);
    
    console.log(
      `Switched ${service} model from ${previousModel?.type || 'none'} to ${targetModel.type}`
    );
  }

  /**
   * 注册性能回调
   */
  public onPerformanceUpdate(callback: PerformanceCallback): () => void {
    this.performanceCallbacks.add(callback);
    return () => this.performanceCallbacks.delete(callback);
  }

  /**
   * 注册降级回调
   */
  public onDegradation(callback: DegradationCallback): () => void {
    this.degradationCallbacks.add(callback);
    return () => this.degradationCallbacks.delete(callback);
  }

  /**
   * 记录延迟指标
   */
  public recordLatency(
    stage: 'audio' | 'recognition' | 'translation' | 'synthesis' | 'endToEnd',
    latency: number
  ): void {
    switch (stage) {
      case 'audio':
        this.currentMetrics.audioLatency = latency;
        break;
      case 'recognition':
        this.currentMetrics.recognitionLatency = latency;
        break;
      case 'translation':
        this.currentMetrics.translationLatency = latency;
        break;
      case 'synthesis':
        this.currentMetrics.synthesisLatency = latency;
        break;
      case 'endToEnd':
        this.currentMetrics.endToEndLatency = latency;
        break;
    }
    
    // 检查是否需要降级
    if (this.config.enableAutoDegradation) {
      this.checkDegradation();
    }
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    // 收集内存使用
    const memoryUsage = this.getMemoryUsage();
    
    // 收集 CPU 使用 (简化实现)
    const cpuUsage = this.estimateCpuUsage();
    
    // 计算帧率
    const fps = this.calculateFps();
    
    // 更新指标
    this.currentMetrics = {
      ...this.currentMetrics,
      cpuUsage,
      memoryUsage,
      fps,
      timestamp: Date.now(),
    };
    
    // 添加到历史
    this.metricsHistory.push({ ...this.currentMetrics });
    if (this.metricsHistory.length > this.config.historySampleSize) {
      this.metricsHistory.shift();
    }
    
    // 评估性能状态
    const newState = this.evaluatePerformanceState();
    if (newState !== this.currentState) {
      this.currentState = newState;
    }
    
    // 通知回调
    this.performanceCallbacks.forEach(callback => {
      try {
        callback(this.currentMetrics, this.currentState);
      } catch (error) {
        console.error('Performance callback error:', error);
      }
    });
    
    // 检查是否需要降级
    if (this.config.enableAutoDegradation) {
      this.checkDegradation();
    }
  }

  /**
   * 获取内存使用
   */
  private getMemoryUsage(): number {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * 估算 CPU 使用
   */
  private estimateCpuUsage(): number {
    // 简化实现：基于延迟估算 CPU 使用
    const totalLatency = 
      this.currentMetrics.audioLatency +
      this.currentMetrics.recognitionLatency +
      this.currentMetrics.translationLatency +
      this.currentMetrics.synthesisLatency;
    
    // 假设理想延迟为 1000ms，超过则认为 CPU 使用率高
    const idealLatency = 1000;
    const usage = Math.min(totalLatency / idealLatency, 1);
    
    return usage;
  }

  /**
   * 计算帧率
   */
  private calculateFps(): number {
    const now = performance.now();
    
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = now;
      return 60;
    }
    
    this.frameCount++;
    const elapsed = now - this.lastFrameTime;
    
    if (elapsed >= 1000) {
      const fps = (this.frameCount * 1000) / elapsed;
      this.frameCount = 0;
      this.lastFrameTime = now;
      return fps;
    }
    
    return this.currentMetrics.fps;
  }

  /**
   * 评估性能状态
   */
  private evaluatePerformanceState(): PerformanceState {
    const { thresholds } = this.config;
    const metrics = this.currentMetrics;
    
    // 检查是否处于临界状态
    if (
      metrics.endToEndLatency > thresholds.maxLatency * 1.5 ||
      metrics.cpuUsage > thresholds.maxCpuUsage * 1.2 ||
      metrics.memoryUsage > thresholds.maxMemoryUsage * 1.2
    ) {
      return PerformanceState.CRITICAL;
    }
    
    // 检查是否处于降级状态
    if (
      metrics.endToEndLatency > thresholds.maxLatency ||
      metrics.cpuUsage > thresholds.maxCpuUsage ||
      metrics.memoryUsage > thresholds.maxMemoryUsage ||
      metrics.fps < thresholds.minFps
    ) {
      return PerformanceState.DEGRADED;
    }
    
    return PerformanceState.OPTIMAL;
  }

  /**
   * 检查是否需要降级
   * 
   * Requirement 6.4: 提供轻量级模型选项当实时性要求无法满足
   */
  private checkDegradation(): void {
    // 按优先级排序策略
    const sortedStrategies = [...this.degradationStrategies].sort(
      (a, b) => a.priority - b.priority
    );
    
    // 检查每个策略的条件
    for (const strategy of sortedStrategies) {
      if (strategy.condition(this.currentMetrics)) {
        this.executeDegradationStrategy(strategy);
        break; // 只执行第一个匹配的策略
      }
    }
  }

  /**
   * 执行降级策略
   */
  private async executeDegradationStrategy(strategy: DegradationStrategy): Promise<void> {
    try {
      console.log(`Executing degradation strategy: ${strategy.name}`);
      
      await strategy.action();
      
      // 通知回调
      this.degradationCallbacks.forEach(callback => {
        try {
          callback(strategy.name, 'Performance threshold exceeded');
        } catch (error) {
          console.error('Degradation callback error:', error);
        }
      });
      
    } catch (error) {
      this.errorHandler.handleError(
        createError(
          ErrorType.UNKNOWN,
          `Degradation strategy failed: ${(error as Error).message}`,
          ErrorSeverity.WARNING,
          { strategy: strategy.name }
        )
      );
    }
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      endToEndLatency: 0,
      audioLatency: 0,
      recognitionLatency: 0,
      translationLatency: 0,
      synthesisLatency: 0,
      fps: 60,
      timestamp: Date.now(),
    };
  }

  /**
   * 初始化模型配置
   */
  private initializeModelConfigs(): void {
    // 语音识别模型
    this.modelConfigs.set(ServiceType.SPEECH_RECOGNITION, [
      {
        type: ModelType.CLOUD_HIGH_QUALITY,
        service: ServiceType.SPEECH_RECOGNITION,
        provider: 'Google Cloud Speech-to-Text',
        expectedLatency: 500,
        qualityScore: 0.95,
        available: true,
      },
      {
        type: ModelType.CLOUD_STANDARD,
        service: ServiceType.SPEECH_RECOGNITION,
        provider: 'Azure Speech Services',
        expectedLatency: 600,
        qualityScore: 0.90,
        available: true,
      },
      {
        type: ModelType.LOCAL_LIGHTWEIGHT,
        service: ServiceType.SPEECH_RECOGNITION,
        provider: 'Vosk',
        expectedLatency: 250,
        qualityScore: 0.80,
        available: true,
      },
    ]);
    
    // 翻译模型
    this.modelConfigs.set(ServiceType.TRANSLATION, [
      {
        type: ModelType.CLOUD_HIGH_QUALITY,
        service: ServiceType.TRANSLATION,
        provider: 'Google Cloud Translation',
        expectedLatency: 300,
        qualityScore: 0.95,
        available: true,
      },
      {
        type: ModelType.CLOUD_STANDARD,
        service: ServiceType.TRANSLATION,
        provider: 'DeepL API',
        expectedLatency: 400,
        qualityScore: 0.97,
        available: true,
      },
      {
        type: ModelType.LOCAL_LIGHTWEIGHT,
        service: ServiceType.TRANSLATION,
        provider: 'NLLB-200',
        expectedLatency: 400,
        qualityScore: 0.85,
        available: false, // Needs to be downloaded
      },
    ]);
    
    // 语音合成模型
    this.modelConfigs.set(ServiceType.SPEECH_SYNTHESIS, [
      {
        type: ModelType.CLOUD_HIGH_QUALITY,
        service: ServiceType.SPEECH_SYNTHESIS,
        provider: 'Google Cloud Text-to-Speech',
        expectedLatency: 400,
        qualityScore: 0.95,
        available: true,
      },
      {
        type: ModelType.CLOUD_STANDARD,
        service: ServiceType.SPEECH_SYNTHESIS,
        provider: 'Azure Neural TTS',
        expectedLatency: 500,
        qualityScore: 0.93,
        available: true,
      },
      {
        type: ModelType.LOCAL_LIGHTWEIGHT,
        service: ServiceType.SPEECH_SYNTHESIS,
        provider: 'Piper TTS',
        expectedLatency: 150,
        qualityScore: 0.80,
        available: false, // Needs to be downloaded
      },
    ]);
    
    // 设置默认激活模型（云端高质量）
    for (const [service, configs] of this.modelConfigs.entries()) {
      const defaultModel = configs.find(c => c.type === ModelType.CLOUD_HIGH_QUALITY);
      if (defaultModel) {
        this.activeModels.set(service, defaultModel);
      }
    }
  }

  /**
   * 初始化降级策略
   */
  private initializeDegradationStrategies(): void {
    // 策略 1: 高延迟 - 切换到本地模型
    this.degradationStrategies.push({
      name: 'switch_to_local_models',
      condition: (metrics) => metrics.endToEndLatency > this.config.thresholds.maxLatency,
      action: async () => {
        // 切换所有服务到本地轻量级模型
        for (const service of [
          ServiceType.SPEECH_RECOGNITION,
          ServiceType.TRANSLATION,
          ServiceType.SPEECH_SYNTHESIS,
        ]) {
          const models = this.modelConfigs.get(service) || [];
          const localModel = models.find(
            m => m.type === ModelType.LOCAL_LIGHTWEIGHT && m.available
          );
          
          if (localModel) {
            await this.switchModel(service, ModelType.LOCAL_LIGHTWEIGHT);
          }
        }
      },
      priority: 1,
    });
    
    // 策略 2: 极高延迟 - 切换到超轻量级模型
    this.degradationStrategies.push({
      name: 'switch_to_ultra_light_models',
      condition: (metrics) => metrics.endToEndLatency > this.config.thresholds.maxLatency * 1.5,
      action: async () => {
        // 切换到最轻量级的可用模型
        for (const service of [
          ServiceType.SPEECH_RECOGNITION,
          ServiceType.TRANSLATION,
          ServiceType.SPEECH_SYNTHESIS,
        ]) {
          const models = this.modelConfigs.get(service) || [];
          const ultraLightModel = models.find(
            m => m.type === ModelType.LOCAL_ULTRA_LIGHT && m.available
          );
          
          if (ultraLightModel) {
            await this.switchModel(service, ModelType.LOCAL_ULTRA_LIGHT);
          }
        }
      },
      priority: 0,
    });
    
    // 策略 3: 高 CPU 使用 - 降低处理质量
    this.degradationStrategies.push({
      name: 'reduce_processing_quality',
      condition: (metrics) => metrics.cpuUsage > this.config.thresholds.maxCpuUsage,
      action: async () => {
        console.log('Reducing processing quality to lower CPU usage');
        // 实际实现中会调整音频采样率、比特率等
      },
      priority: 2,
    });
    
    // 策略 4: 高内存使用 - 清理缓存
    this.degradationStrategies.push({
      name: 'clear_caches',
      condition: (metrics) => metrics.memoryUsage > this.config.thresholds.maxMemoryUsage,
      action: async () => {
        console.log('Clearing caches to free memory');
        // 实际实现中会清理翻译缓存、音频缓存等
      },
      priority: 3,
    });
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.stopMonitoring();
    this.performanceCallbacks.clear();
    this.degradationCallbacks.clear();
  }
}

// 导出单例实例
export const performanceMonitor = new PerformanceMonitor();
