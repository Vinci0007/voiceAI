import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioQualityMonitor, QualityNotification } from './AudioQualityMonitor';
import { AudioQuality } from '../api/audioProcessor';

describe('AudioQualityMonitor', () => {
  let monitor: AudioQualityMonitor;

  beforeEach(() => {
    monitor = new AudioQualityMonitor();
  });

  describe('Quality Assessment', () => {
    it('should assess high quality audio correctly', () => {
      const highQuality: AudioQuality = {
        snr: 25,
        clarity: 0.8,
        has_echo: false,
        has_noise: false,
      };

      monitor.assessQuality(highQuality);
      const status = monitor.getQualityStatus();

      expect(status).toBe('excellent');
      expect(monitor.isQualityAcceptable()).toBe(true);
    });

    it('should assess low quality audio correctly', () => {
      const lowQuality: AudioQuality = {
        snr: 5,
        clarity: 0.2,
        has_echo: true,
        has_noise: true,
      };

      monitor.assessQuality(lowQuality);
      const status = monitor.getQualityStatus();

      expect(status).toBe('poor');
      expect(monitor.isQualityAcceptable()).toBe(false);
    });

    it('should maintain quality history', () => {
      const quality1: AudioQuality = {
        snr: 15,
        clarity: 0.5,
        has_echo: false,
        has_noise: false,
      };

      const quality2: AudioQuality = {
        snr: 20,
        clarity: 0.7,
        has_echo: false,
        has_noise: false,
      };

      monitor.assessQuality(quality1);
      monitor.assessQuality(quality2);

      const history = monitor.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(quality1);
      expect(history[1]).toEqual(quality2);
    });

    it('should limit history size', () => {
      const quality: AudioQuality = {
        snr: 15,
        clarity: 0.5,
        has_echo: false,
        has_noise: false,
      };

      // Add more than max history size
      for (let i = 0; i < 150; i++) {
        monitor.assessQuality(quality);
      }

      const history = monitor.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Quality Metrics', () => {
    it('should calculate average metrics correctly', () => {
      const qualities: AudioQuality[] = [
        { snr: 10, clarity: 0.3, has_echo: false, has_noise: true },
        { snr: 20, clarity: 0.7, has_echo: true, has_noise: false },
        { snr: 15, clarity: 0.5, has_echo: false, has_noise: false },
      ];

      qualities.forEach((q) => monitor.assessQuality(q));
      const metrics = monitor.getMetrics();

      expect(metrics.averageSnr).toBeCloseTo(15, 1);
      expect(metrics.averageClarity).toBeCloseTo(0.5, 1);
      expect(metrics.noiseDetectionRate).toBeCloseTo(1 / 3, 2);
      expect(metrics.echoDetectionRate).toBeCloseTo(1 / 3, 2);
      expect(metrics.sampleCount).toBe(3);
    });

    it('should return zero metrics when no history', () => {
      const metrics = monitor.getMetrics();

      expect(metrics.averageSnr).toBe(0);
      expect(metrics.averageClarity).toBe(0);
      expect(metrics.noiseDetectionRate).toBe(0);
      expect(metrics.echoDetectionRate).toBe(0);
      expect(metrics.sampleCount).toBe(0);
    });
  });

  describe('Adaptive Parameters', () => {
    it('should increase noise reduction when noise detected', () => {
      const noisyQuality: AudioQuality = {
        snr: 8,
        clarity: 0.4,
        has_echo: false,
        has_noise: true,
      };

      const initialParams = monitor.getAdaptiveParameters();
      monitor.assessQuality(noisyQuality);
      const updatedParams = monitor.getAdaptiveParameters();

      expect(updatedParams.noiseReductionLevel).toBeGreaterThan(
        initialParams.noiseReductionLevel
      );
    });

    it('should increase echo cancellation when echo detected', () => {
      const echoQuality: AudioQuality = {
        snr: 15,
        clarity: 0.5,
        has_echo: true,
        has_noise: false,
      };

      const initialParams = monitor.getAdaptiveParameters();
      monitor.assessQuality(echoQuality);
      const updatedParams = monitor.getAdaptiveParameters();

      expect(updatedParams.echoCancellationLevel).toBeGreaterThan(
        initialParams.echoCancellationLevel
      );
    });

    it('should increase gain when clarity is low', () => {
      const lowClarityQuality: AudioQuality = {
        snr: 12,
        clarity: 0.2,
        has_echo: false,
        has_noise: false,
      };

      const initialParams = monitor.getAdaptiveParameters();
      monitor.assessQuality(lowClarityQuality);
      const updatedParams = monitor.getAdaptiveParameters();

      expect(updatedParams.gainAdjustment).toBeGreaterThan(
        initialParams.gainAdjustment
      );
    });

    it('should decrease noise reduction when quality is excellent', () => {
      const excellentQuality: AudioQuality = {
        snr: 25,
        clarity: 0.9,
        has_echo: false,
        has_noise: false,
      };

      // First increase noise reduction
      monitor.assessQuality({
        snr: 8,
        clarity: 0.4,
        has_echo: false,
        has_noise: true,
      });

      const beforeParams = monitor.getAdaptiveParameters();
      monitor.assessQuality(excellentQuality);
      const afterParams = monitor.getAdaptiveParameters();

      expect(afterParams.noiseReductionLevel).toBeLessThan(
        beforeParams.noiseReductionLevel
      );
    });

    it('should cap parameters at maximum values', () => {
      const poorQuality: AudioQuality = {
        snr: 3,
        clarity: 0.1,
        has_echo: true,
        has_noise: true,
      };

      // Apply poor quality multiple times
      for (let i = 0; i < 20; i++) {
        monitor.assessQuality(poorQuality);
      }

      const params = monitor.getAdaptiveParameters();
      expect(params.noiseReductionLevel).toBeLessThanOrEqual(1.0);
      expect(params.echoCancellationLevel).toBeLessThanOrEqual(1.0);
      expect(params.gainAdjustment).toBeLessThanOrEqual(2.0);
    });

    it('should cap parameters at minimum values', () => {
      const excellentQuality: AudioQuality = {
        snr: 30,
        clarity: 0.95,
        has_echo: false,
        has_noise: false,
      };

      // Apply excellent quality multiple times
      for (let i = 0; i < 20; i++) {
        monitor.assessQuality(excellentQuality);
      }

      const params = monitor.getAdaptiveParameters();
      expect(params.noiseReductionLevel).toBeGreaterThanOrEqual(0.3);
      expect(params.echoCancellationLevel).toBeGreaterThanOrEqual(0.3);
      expect(params.gainAdjustment).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Quality Notifications', () => {
    it('should notify on low SNR', () => {
      const notifications: QualityNotification[] = [];
      monitor.setNotificationCallback((n) => notifications.push(n));

      const lowSnrQuality: AudioQuality = {
        snr: 4,
        clarity: 0.5,
        has_echo: false,
        has_noise: false,
      };

      monitor.assessQuality(lowSnrQuality);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].severity).toBe('critical');
      expect(notifications[0].message).toContain('信噪比');
    });

    it('should notify on low clarity', () => {
      const notifications: QualityNotification[] = [];
      monitor.setNotificationCallback((n) => notifications.push(n));

      const lowClarityQuality: AudioQuality = {
        snr: 15,
        clarity: 0.15,
        has_echo: false,
        has_noise: false,
      };

      monitor.assessQuality(lowClarityQuality);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].severity).toBe('critical');
      expect(notifications[0].message).toContain('清晰度');
    });

    it('should notify on echo detection', () => {
      const notifications: QualityNotification[] = [];
      monitor.setNotificationCallback((n) => notifications.push(n));

      const echoQuality: AudioQuality = {
        snr: 15,
        clarity: 0.5,
        has_echo: true,
        has_noise: false,
      };

      monitor.assessQuality(echoQuality);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toContain('回声');
      expect(notifications[0].suggestions.length).toBeGreaterThan(0);
    });

    it('should notify on persistent noise', () => {
      const notifications: QualityNotification[] = [];
      monitor.setNotificationCallback((n) => notifications.push(n));

      const noisyQuality: AudioQuality = {
        snr: 12,
        clarity: 0.4,
        has_echo: false,
        has_noise: true,
      };

      // Add multiple noisy samples to exceed threshold
      for (let i = 0; i < 10; i++) {
        monitor.assessQuality(noisyQuality);
      }

      expect(notifications.length).toBeGreaterThan(0);
      const noiseNotification = notifications.find((n) =>
        n.message.includes('噪音')
      );
      expect(noiseNotification).toBeDefined();
    });

    it('should respect notification cooldown', () => {
      const notifications: QualityNotification[] = [];
      monitor.setNotificationCallback((n) => notifications.push(n));

      const poorQuality: AudioQuality = {
        snr: 4,
        clarity: 0.15,
        has_echo: true,
        has_noise: true,
      };

      // Assess multiple times quickly
      monitor.assessQuality(poorQuality);
      monitor.assessQuality(poorQuality);
      monitor.assessQuality(poorQuality);

      // Should only get one notification due to cooldown
      expect(notifications).toHaveLength(1);
    });

    it('should provide suggestions with notifications', () => {
      const notifications: QualityNotification[] = [];
      monitor.setNotificationCallback((n) => notifications.push(n));

      const poorQuality: AudioQuality = {
        snr: 4,
        clarity: 0.15,
        has_echo: true,
        has_noise: true,
      };

      monitor.assessQuality(poorQuality);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Quality Status', () => {
    it('should return excellent for high quality', () => {
      const quality: AudioQuality = {
        snr: 25,
        clarity: 0.8,
        has_echo: false,
        has_noise: false,
      };

      monitor.assessQuality(quality);
      expect(monitor.getQualityStatus()).toBe('excellent');
    });

    it('should return good for decent quality', () => {
      const quality: AudioQuality = {
        snr: 17,
        clarity: 0.6,
        has_echo: false,
        has_noise: false,
      };

      monitor.assessQuality(quality);
      expect(monitor.getQualityStatus()).toBe('good');
    });

    it('should return fair for acceptable quality', () => {
      const quality: AudioQuality = {
        snr: 12,
        clarity: 0.4,
        has_echo: false,
        has_noise: false,
      };

      monitor.assessQuality(quality);
      expect(monitor.getQualityStatus()).toBe('fair');
    });

    it('should return poor for low quality', () => {
      const quality: AudioQuality = {
        snr: 5,
        clarity: 0.2,
        has_echo: true,
        has_noise: true,
      };

      monitor.assessQuality(quality);
      expect(monitor.getQualityStatus()).toBe('poor');
    });
  });

  describe('Quality Report', () => {
    it('should generate comprehensive quality report', () => {
      const quality: AudioQuality = {
        snr: 15,
        clarity: 0.5,
        has_echo: false,
        has_noise: false,
      };

      monitor.assessQuality(quality);
      const report = monitor.getQualityReport();

      expect(report.status).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.parameters).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should provide recommendations for poor quality', () => {
      const poorQuality: AudioQuality = {
        snr: 8,
        clarity: 0.3,
        has_echo: true,
        has_noise: true,
      };

      monitor.assessQuality(poorQuality);
      const report = monitor.getQualityReport();

      expect(report.recommendations.length).toBeGreaterThan(1);
    });

    it('should indicate good quality when no issues', () => {
      const goodQuality: AudioQuality = {
        snr: 20,
        clarity: 0.7,
        has_echo: false,
        has_noise: false,
      };

      monitor.assessQuality(goodQuality);
      const report = monitor.getQualityReport();

      expect(report.recommendations).toContain('音频质量良好，无需调整');
    });
  });

  describe('Threshold Management', () => {
    it('should use custom thresholds', () => {
      const customMonitor = new AudioQualityMonitor({
        minSnr: 15,
        minClarity: 0.5,
        noiseThreshold: 0.3,
      });

      const quality: AudioQuality = {
        snr: 12,
        clarity: 0.4,
        has_echo: false,
        has_noise: false,
      };

      customMonitor.assessQuality(quality);
      expect(customMonitor.isQualityAcceptable()).toBe(false);
    });

    it('should update thresholds dynamically', () => {
      const quality: AudioQuality = {
        snr: 12,
        clarity: 0.4,
        has_echo: false,
        has_noise: false,
      };

      monitor.assessQuality(quality);
      expect(monitor.isQualityAcceptable()).toBe(true);

      monitor.updateThresholds({ minSnr: 15, minClarity: 0.5 });
      expect(monitor.isQualityAcceptable()).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should reset history and parameters', () => {
      const quality: AudioQuality = {
        snr: 8,
        clarity: 0.3,
        has_echo: true,
        has_noise: true,
      };

      // Build up history and adjust parameters
      for (let i = 0; i < 10; i++) {
        monitor.assessQuality(quality);
      }

      expect(monitor.getHistory().length).toBeGreaterThan(0);

      monitor.reset();

      expect(monitor.getHistory()).toHaveLength(0);
      const params = monitor.getAdaptiveParameters();
      expect(params.noiseReductionLevel).toBe(0.5);
      expect(params.echoCancellationLevel).toBe(0.5);
      expect(params.gainAdjustment).toBe(1.0);
    });
  });
});
