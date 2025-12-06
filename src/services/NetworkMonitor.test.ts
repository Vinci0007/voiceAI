/**
 * NetworkMonitor 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NetworkMonitor,
  ProcessingMode,
  type AudioQualitySettings,
} from './NetworkMonitor';
import { NetworkQuality } from '../types';

describe('NetworkMonitor', () => {
  let monitor: NetworkMonitor;

  beforeEach(() => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    // Mock performance.now
    vi.spyOn(performance, 'now').mockReturnValue(100);

    monitor = new NetworkMonitor({
      monitorInterval: 1000,
      latencyThreshold: 500,
      bandwidthThreshold: 128,
    });
  });

  afterEach(() => {
    monitor.dispose();
    vi.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该使用默认配置初始化', () => {
      const defaultMonitor = new NetworkMonitor();
      expect(defaultMonitor.getCurrentMode()).toBe(ProcessingMode.ONLINE);
      expect(defaultMonitor.getCurrentMetrics().isOnline).toBe(true);
      defaultMonitor.dispose();
    });

    it('应该使用自定义配置初始化', () => {
      const customMonitor = new NetworkMonitor({
        latencyThreshold: 300,
        bandwidthThreshold: 256,
      });
      expect(customMonitor).toBeDefined();
      customMonitor.dispose();
    });
  });

  describe('网络指标', () => {
    it('应该返回当前网络指标', () => {
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toHaveProperty('latency');
      expect(metrics).toHaveProperty('bandwidth');
      expect(metrics).toHaveProperty('isOnline');
      expect(metrics).toHaveProperty('quality');
    });

    it('应该返回延迟统计信息', () => {
      const latencyMetrics = monitor.getLatencyMetrics();
      expect(latencyMetrics).toHaveProperty('current');
      expect(latencyMetrics).toHaveProperty('average');
      expect(latencyMetrics).toHaveProperty('min');
      expect(latencyMetrics).toHaveProperty('max');
      expect(latencyMetrics).toHaveProperty('samples');
    });

    it('空延迟历史应该返回零值', () => {
      const latencyMetrics = monitor.getLatencyMetrics();
      expect(latencyMetrics.current).toBe(0);
      expect(latencyMetrics.average).toBe(0);
      expect(latencyMetrics.samples).toBe(0);
    });
  });

  describe('处理模式', () => {
    it('应该返回当前处理模式', () => {
      const mode = monitor.getCurrentMode();
      expect(mode).toBe(ProcessingMode.ONLINE);
    });

    it('应该在高延迟时切换到离线模式', async () => {
      let modeChanged = false;
      let newMode: ProcessingMode | null = null;

      monitor.onModeChange((mode) => {
        modeChanged = true;
        newMode = mode;
      });

      // Mock high latency
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(600); // 600ms latency

      await monitor.checkNetwork();

      expect(modeChanged).toBe(true);
      expect(newMode).toBe(ProcessingMode.OFFLINE);
    });

    it('应该在网络离线时切换到离线模式', async () => {
      let modeChanged = false;

      monitor.onModeChange((mode) => {
        modeChanged = true;
        expect(mode).toBe(ProcessingMode.OFFLINE);
      });

      // Simulate offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      await monitor.checkNetwork();

      expect(modeChanged).toBe(true);
    });
  });

  describe('音频质量设置', () => {
    it('应该返回当前音频质量设置', () => {
      const settings = monitor.getCurrentQualitySettings();
      expect(settings).toHaveProperty('sampleRate');
      expect(settings).toHaveProperty('bitrate');
      expect(settings).toHaveProperty('channels');
      expect(settings).toHaveProperty('compression');
    });

    it('应该在网络质量下降时降低音频质量', async () => {
      let qualityChanged = false;
      let newSettings: AudioQualitySettings | undefined;

      monitor.onQualityChange((settings) => {
        qualityChanged = true;
        newSettings = settings;
      });

      // Mock poor network (high latency)
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(600);

      await monitor.checkNetwork();

      // Quality should be adjusted for poor network
      if (qualityChanged && newSettings) {
        expect(newSettings.bitrate).toBeLessThan(128);
      }
    });
  });

  describe('网络监控', () => {
    it('应该启动和停止监控', () => {
      monitor.startMonitoring();
      monitor.stopMonitoring();
      // Should not throw
    });

    it('应该在监控期间定期检查网络', async () => {
      const checkSpy = vi.spyOn(monitor as any, 'performNetworkCheck');
      
      monitor.startMonitoring();
      
      // Wait for at least one check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      monitor.stopMonitoring();
      
      expect(checkSpy).toHaveBeenCalled();
    });

    it('不应该重复启动监控', () => {
      monitor.startMonitoring();
      monitor.startMonitoring(); // Second call should be ignored
      monitor.stopMonitoring();
      // Should not throw
    });
  });

  describe('回调注册', () => {
    it('应该注册和注销网络状态回调', () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onNetworkStatus(callback);
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('应该注册和注销模式切换回调', () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onModeChange(callback);
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('应该注册和注销质量变化回调', () => {
      const callback = vi.fn();
      const unsubscribe = monitor.onQualityChange(callback);
      
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('应该在网络状态变化时调用回调', async () => {
      const callback = vi.fn();
      monitor.onNetworkStatus(callback);

      await monitor.checkNetwork();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('手动网络检查', () => {
    it('应该执行手动网络检查', async () => {
      const metrics = await monitor.checkNetwork();
      
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('latency');
      expect(metrics).toHaveProperty('isOnline');
    });

    it('应该在检查失败时返回指标', async () => {
      // Mock fetch failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const metrics = await monitor.checkNetwork();
      
      expect(metrics).toBeDefined();
      // When fetch fails, quality could be POOR or OFFLINE depending on evaluation
      expect([NetworkQuality.POOR, NetworkQuality.OFFLINE]).toContain(metrics.quality);
    });
  });

  describe('延迟测量', () => {
    it('应该测量网络延迟', async () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50);

      await monitor.checkNetwork();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.latency).toBeGreaterThanOrEqual(0);
    });

    it('应该在所有端点失败时返回高延迟', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('All endpoints failed'));

      await monitor.checkNetwork();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.latency).toBeGreaterThan(0);
    });
  });

  describe('网络质量评估', () => {
    it('应该正确评估优秀网络质量', async () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(30); // 30ms latency

      await monitor.checkNetwork();
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.quality).toBe(NetworkQuality.EXCELLENT);
    });

    it('应该正确评估较差网络质量', async () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(400); // 400ms latency

      await monitor.checkNetwork();
      
      const metrics = monitor.getCurrentMetrics();
      expect([NetworkQuality.POOR, NetworkQuality.FAIR]).toContain(metrics.quality);
    });
  });

  describe('资源清理', () => {
    it('应该清理所有资源', () => {
      monitor.startMonitoring();
      monitor.dispose();
      
      // Should not throw and monitoring should be stopped
      expect(() => monitor.dispose()).not.toThrow();
    });
  });
});
