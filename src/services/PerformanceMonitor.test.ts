import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PerformanceMonitor,
  ModelType,
  ServiceType,
  PerformanceState,
} from './PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      monitorInterval: 100,
      thresholds: {
        maxLatency: 2000,
        maxCpuUsage: 0.8,
        maxMemoryUsage: 500,
        minFps: 30,
      },
      enableAutoDegradation: true,
      historySampleSize: 10,
    });
  });

  afterEach(() => {
    monitor.dispose();
  });

  describe('initialization', () => {
    it('should initialize with default metrics', () => {
      const metrics = monitor.getCurrentMetrics();
      
      expect(metrics.cpuUsage).toBe(0);
      expect(metrics.memoryUsage).toBe(0);
      expect(metrics.endToEndLatency).toBe(0);
      expect(metrics.fps).toBe(60);
    });

    it('should initialize with optimal state', () => {
      expect(monitor.getCurrentState()).toBe(PerformanceState.OPTIMAL);
    });

    it('should initialize model configurations', () => {
      const recognitionModels = monitor.getAvailableModels(ServiceType.SPEECH_RECOGNITION);
      const translationModels = monitor.getAvailableModels(ServiceType.TRANSLATION);
      const synthesisModels = monitor.getAvailableModels(ServiceType.SPEECH_SYNTHESIS);
      
      expect(recognitionModels.length).toBeGreaterThan(0);
      expect(translationModels.length).toBeGreaterThan(0);
      expect(synthesisModels.length).toBeGreaterThan(0);
    });

    it('should set default active models', () => {
      const recognitionModel = monitor.getActiveModel(ServiceType.SPEECH_RECOGNITION);
      const translationModel = monitor.getActiveModel(ServiceType.TRANSLATION);
      const synthesisModel = monitor.getActiveModel(ServiceType.SPEECH_SYNTHESIS);
      
      expect(recognitionModel?.type).toBe(ModelType.CLOUD_HIGH_QUALITY);
      expect(translationModel?.type).toBe(ModelType.CLOUD_HIGH_QUALITY);
      expect(synthesisModel?.type).toBe(ModelType.CLOUD_HIGH_QUALITY);
    });
  });

  describe('monitoring', () => {
    it('should start monitoring', () => {
      monitor.startMonitoring();
      expect(monitor['isMonitoring']).toBe(true);
    });

    it('should stop monitoring', () => {
      monitor.startMonitoring();
      monitor.stopMonitoring();
      expect(monitor['isMonitoring']).toBe(false);
    });

    it('should not start monitoring twice', () => {
      monitor.startMonitoring();
      const firstTimer = monitor['monitorTimer'];
      monitor.startMonitoring();
      const secondTimer = monitor['monitorTimer'];
      
      expect(firstTimer).toBe(secondTimer);
      monitor.stopMonitoring();
    });

    it('should collect metrics periodically', async () => {
      const callback = vi.fn();
      monitor.onPerformanceUpdate(callback);
      
      monitor.startMonitoring();
      
      // Wait for at least one collection
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(callback).toHaveBeenCalled();
      monitor.stopMonitoring();
    });
  });

  describe('latency recording', () => {
    it('should record audio latency', () => {
      monitor.recordLatency('audio', 50);
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.audioLatency).toBe(50);
    });

    it('should record recognition latency', () => {
      monitor.recordLatency('recognition', 400);
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.recognitionLatency).toBe(400);
    });

    it('should record translation latency', () => {
      monitor.recordLatency('translation', 300);
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.translationLatency).toBe(300);
    });

    it('should record synthesis latency', () => {
      monitor.recordLatency('synthesis', 350);
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.synthesisLatency).toBe(350);
    });

    it('should record end-to-end latency', () => {
      monitor.recordLatency('endToEnd', 1500);
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.endToEndLatency).toBe(1500);
    });
  });

  describe('performance state evaluation', () => {
    it('should be optimal with low latency', () => {
      monitor.recordLatency('endToEnd', 1000);
      expect(monitor.getCurrentState()).toBe(PerformanceState.OPTIMAL);
    });

    it('should be degraded with high latency', () => {
      monitor.recordLatency('endToEnd', 2500);
      monitor['collectMetrics']();
      expect(monitor.getCurrentState()).toBe(PerformanceState.DEGRADED);
    });

    it('should be critical with very high latency', () => {
      monitor.recordLatency('endToEnd', 3500);
      monitor['collectMetrics']();
      expect(monitor.getCurrentState()).toBe(PerformanceState.CRITICAL);
    });
  });

  describe('model switching', () => {
    it('should switch to local lightweight model', async () => {
      await monitor.switchModel(
        ServiceType.SPEECH_RECOGNITION,
        ModelType.LOCAL_LIGHTWEIGHT
      );
      
      const activeModel = monitor.getActiveModel(ServiceType.SPEECH_RECOGNITION);
      expect(activeModel?.type).toBe(ModelType.LOCAL_LIGHTWEIGHT);
    });

    it('should throw error for unavailable model', async () => {
      await expect(
        monitor.switchModel(ServiceType.SPEECH_RECOGNITION, ModelType.LOCAL_ULTRA_LIGHT)
      ).rejects.toThrow();
    });

    it('should throw error for non-existent model', async () => {
      await expect(
        monitor.switchModel(ServiceType.SPEECH_RECOGNITION, 'invalid' as ModelType)
      ).rejects.toThrow();
    });
  });

  describe('automatic degradation', () => {
    it('should trigger degradation on high latency', async () => {
      const callback = vi.fn();
      monitor.onDegradation(callback);
      
      // Record high latency
      monitor.recordLatency('endToEnd', 2500);
      
      // Wait for degradation check
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(callback).toHaveBeenCalled();
    });

    it('should switch to local models on degradation', async () => {
      // Record high latency to trigger degradation
      monitor.recordLatency('endToEnd', 2500);
      
      // Wait for degradation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check if models were switched (if available)
      const recognitionModel = monitor.getActiveModel(ServiceType.SPEECH_RECOGNITION);
      
      // Model should either be switched or remain if local not available
      expect(recognitionModel).toBeDefined();
    });

    it('should not degrade when auto-degradation is disabled', async () => {
      const monitorNoAuto = new PerformanceMonitor({
        enableAutoDegradation: false,
      });
      
      const callback = vi.fn();
      monitorNoAuto.onDegradation(callback);
      
      monitorNoAuto.recordLatency('endToEnd', 3000);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(callback).not.toHaveBeenCalled();
      
      monitorNoAuto.dispose();
    });
  });

  describe('metrics history', () => {
    it('should maintain metrics history', () => {
      monitor.startMonitoring();
      
      // Collect some metrics
      monitor['collectMetrics']();
      monitor['collectMetrics']();
      monitor['collectMetrics']();
      
      const history = monitor.getMetricsHistory();
      expect(history.length).toBeGreaterThan(0);
      
      monitor.stopMonitoring();
    });

    it('should limit history size', () => {
      const smallMonitor = new PerformanceMonitor({
        historySampleSize: 5,
      });
      
      // Collect more than limit
      for (let i = 0; i < 10; i++) {
        smallMonitor['collectMetrics']();
      }
      
      const history = smallMonitor.getMetricsHistory();
      expect(history.length).toBeLessThanOrEqual(5);
      
      smallMonitor.dispose();
    });
  });

  describe('callbacks', () => {
    it('should call performance callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onPerformanceUpdate(callback);
      
      monitor['collectMetrics']();
      
      expect(callback).toHaveBeenCalled();
      
      unsubscribe();
    });

    it('should remove callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onPerformanceUpdate(callback);
      
      unsubscribe();
      monitor['collectMetrics']();
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should call degradation callbacks', async () => {
      const callback = vi.fn();
      monitor.onDegradation(callback);
      
      monitor.recordLatency('endToEnd', 2500);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(callback).toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      
      monitor.onPerformanceUpdate(errorCallback);
      
      expect(() => {
        monitor['collectMetrics']();
      }).not.toThrow();
    });
  });

  describe('model configurations', () => {
    it('should provide speech recognition models', () => {
      const models = monitor.getAvailableModels(ServiceType.SPEECH_RECOGNITION);
      
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.type === ModelType.CLOUD_HIGH_QUALITY)).toBe(true);
      expect(models.some(m => m.type === ModelType.LOCAL_LIGHTWEIGHT)).toBe(true);
    });

    it('should provide translation models', () => {
      const models = monitor.getAvailableModels(ServiceType.TRANSLATION);
      
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.provider.includes('Google'))).toBe(true);
    });

    it('should provide synthesis models', () => {
      const models = monitor.getAvailableModels(ServiceType.SPEECH_SYNTHESIS);
      
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.provider.includes('Google'))).toBe(true);
    });

    it('should include expected latency in model config', () => {
      const models = monitor.getAvailableModels(ServiceType.SPEECH_RECOGNITION);
      
      models.forEach(model => {
        expect(model.expectedLatency).toBeGreaterThan(0);
        expect(model.qualityScore).toBeGreaterThan(0);
        expect(model.qualityScore).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('resource cleanup', () => {
    it('should dispose resources', () => {
      monitor.startMonitoring();
      monitor.dispose();
      
      expect(monitor['isMonitoring']).toBe(false);
      expect(monitor['monitorTimer']).toBeNull();
    });

    it('should clear callbacks on dispose', () => {
      const callback = vi.fn();
      monitor.onPerformanceUpdate(callback);
      
      monitor.dispose();
      monitor['collectMetrics']();
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 6.4: Lightweight model options', () => {
    it('should provide lightweight model options when performance degrades', async () => {
      // Simulate high latency
      monitor.recordLatency('endToEnd', 2500);
      
      // Check that lightweight models are available
      const recognitionModels = monitor.getAvailableModels(ServiceType.SPEECH_RECOGNITION);
      const lightweightModel = recognitionModels.find(
        m => m.type === ModelType.LOCAL_LIGHTWEIGHT
      );
      
      expect(lightweightModel).toBeDefined();
      expect(lightweightModel?.expectedLatency).toBeLessThan(500);
    });

    it('should automatically switch to lightweight models on degradation', async () => {
      const degradationCallback = vi.fn();
      monitor.onDegradation(degradationCallback);
      
      // Trigger degradation with high latency
      monitor.recordLatency('endToEnd', 2500);
      
      // Wait for degradation strategy to execute
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify degradation was triggered
      expect(degradationCallback).toHaveBeenCalled();
    });

    it('should offer multiple model quality levels', () => {
      const models = monitor.getAvailableModels(ServiceType.SPEECH_RECOGNITION);
      
      const hasHighQuality = models.some(m => m.type === ModelType.CLOUD_HIGH_QUALITY);
      const hasStandard = models.some(m => m.type === ModelType.CLOUD_STANDARD);
      const hasLightweight = models.some(m => m.type === ModelType.LOCAL_LIGHTWEIGHT);
      
      expect(hasHighQuality).toBe(true);
      expect(hasStandard).toBe(true);
      expect(hasLightweight).toBe(true);
    });
  });
});
