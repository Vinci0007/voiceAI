import { AudioQuality } from '../api/audioProcessor';

export interface QualityThresholds {
  minSnr: number;
  minClarity: number;
  noiseThreshold: number;
}

export interface AdaptiveParameters {
  noiseReductionLevel: number; // 0.0 - 1.0
  echoCancellationLevel: number; // 0.0 - 1.0
  gainAdjustment: number; // 0.5 - 2.0
}

export interface QualityNotification {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestions: string[];
  timestamp: number;
}

export interface QualityMetrics {
  averageSnr: number;
  averageClarity: number;
  noiseDetectionRate: number;
  echoDetectionRate: number;
  sampleCount: number;
}

export class AudioQualityMonitor {
  private qualityHistory: AudioQuality[] = [];
  private maxHistorySize = 100;
  private thresholds: QualityThresholds;
  private adaptiveParams: AdaptiveParameters;
  private notificationCallback: ((notification: QualityNotification) => void) | null = null;
  private lastNotificationTime = 0;
  private notificationCooldown = 5000; // 5 seconds between notifications

  constructor(thresholds?: Partial<QualityThresholds>) {
    this.thresholds = {
      minSnr: thresholds?.minSnr ?? 10,
      minClarity: thresholds?.minClarity ?? 0.3,
      noiseThreshold: thresholds?.noiseThreshold ?? 0.5,
    };

    this.adaptiveParams = {
      noiseReductionLevel: 0.5,
      echoCancellationLevel: 0.5,
      gainAdjustment: 1.0,
    };
  }

  /**
   * Assess audio quality and update adaptive parameters
   */
  assessQuality(quality: AudioQuality): void {
    // Add to history
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.maxHistorySize) {
      this.qualityHistory.shift();
    }

    // Check for quality issues and notify
    this.checkQualityIssues(quality);

    // Adjust parameters based on quality
    this.adjustParameters(quality);
  }

  /**
   * Check for quality issues and send notifications
   */
  private checkQualityIssues(quality: AudioQuality): void {
    const now = Date.now();
    if (now - this.lastNotificationTime < this.notificationCooldown) {
      return; // Don't spam notifications
    }

    const issues: string[] = [];
    const suggestions: string[] = [];
    let severity: 'info' | 'warning' | 'critical' = 'info';

    // Check SNR
    if (quality.snr < this.thresholds.minSnr) {
      if (quality.snr < 5) {
        severity = 'critical';
        issues.push('信噪比极低，语音识别可能失败');
        suggestions.push('请移至安静环境或使用耳机麦克风');
      } else {
        severity = 'warning';
        issues.push('信噪比较低，可能影响识别准确度');
        suggestions.push('请尝试降低背景噪音');
      }
    }

    // Check clarity
    if (quality.clarity < this.thresholds.minClarity) {
      if (quality.clarity < 0.2) {
        severity = 'critical';
        issues.push('音频清晰度极差');
        suggestions.push('请检查麦克风是否正常工作');
        suggestions.push('请靠近麦克风或提高音量');
      } else {
        severity = severity === 'critical' ? 'critical' : 'warning';
        issues.push('音频清晰度不足');
        suggestions.push('请提高说话音量或靠近麦克风');
      }
    }

    // Check echo
    if (quality.has_echo) {
      severity = severity === 'critical' ? 'critical' : 'warning';
      issues.push('检测到回声');
      suggestions.push('请使用耳机或降低扬声器音量');
      suggestions.push('请远离墙壁或硬质表面');
    }

    // Check noise
    if (quality.has_noise) {
      const metrics = this.getMetrics();
      if (metrics.noiseDetectionRate > this.thresholds.noiseThreshold) {
        severity = severity === 'critical' ? 'critical' : 'warning';
        issues.push('背景噪音持续过大');
        suggestions.push('请移至安静环境');
        suggestions.push('请关闭附近的噪音源（风扇、空调等）');
      }
    }

    // Send notification if there are issues
    if (issues.length > 0 && this.notificationCallback) {
      this.notificationCallback({
        severity,
        message: issues.join('；'),
        suggestions,
        timestamp: now,
      });
      this.lastNotificationTime = now;
    }
  }

  /**
   * Adjust processing parameters based on quality metrics
   */
  private adjustParameters(quality: AudioQuality): void {
    // Adjust noise reduction level based on noise detection
    if (quality.has_noise) {
      this.adaptiveParams.noiseReductionLevel = Math.min(
        1.0,
        this.adaptiveParams.noiseReductionLevel + 0.1
      );
    } else if (quality.snr > 20) {
      // Reduce noise reduction if quality is good to preserve natural sound
      this.adaptiveParams.noiseReductionLevel = Math.max(
        0.3,
        this.adaptiveParams.noiseReductionLevel - 0.05
      );
    }

    // Adjust echo cancellation level
    if (quality.has_echo) {
      this.adaptiveParams.echoCancellationLevel = Math.min(
        1.0,
        this.adaptiveParams.echoCancellationLevel + 0.1
      );
    } else {
      this.adaptiveParams.echoCancellationLevel = Math.max(
        0.3,
        this.adaptiveParams.echoCancellationLevel - 0.05
      );
    }

    // Adjust gain based on clarity
    if (quality.clarity < 0.3) {
      // Increase gain for low clarity
      this.adaptiveParams.gainAdjustment = Math.min(
        2.0,
        this.adaptiveParams.gainAdjustment + 0.1
      );
    } else if (quality.clarity > 0.8) {
      // Reduce gain if signal is strong to avoid clipping
      this.adaptiveParams.gainAdjustment = Math.max(
        0.5,
        this.adaptiveParams.gainAdjustment - 0.05
      );
    }
  }

  /**
   * Get current adaptive parameters
   */
  getAdaptiveParameters(): AdaptiveParameters {
    return { ...this.adaptiveParams };
  }

  /**
   * Get quality metrics from history
   */
  getMetrics(): QualityMetrics {
    if (this.qualityHistory.length === 0) {
      return {
        averageSnr: 0,
        averageClarity: 0,
        noiseDetectionRate: 0,
        echoDetectionRate: 0,
        sampleCount: 0,
      };
    }

    const sum = this.qualityHistory.reduce(
      (acc, q) => ({
        snr: acc.snr + q.snr,
        clarity: acc.clarity + q.clarity,
        noise: acc.noise + (q.has_noise ? 1 : 0),
        echo: acc.echo + (q.has_echo ? 1 : 0),
      }),
      { snr: 0, clarity: 0, noise: 0, echo: 0 }
    );

    const count = this.qualityHistory.length;

    return {
      averageSnr: sum.snr / count,
      averageClarity: sum.clarity / count,
      noiseDetectionRate: sum.noise / count,
      echoDetectionRate: sum.echo / count,
      sampleCount: count,
    };
  }

  /**
   * Get current quality status
   */
  getQualityStatus(): 'excellent' | 'good' | 'fair' | 'poor' {
    const metrics = this.getMetrics();

    if (metrics.averageSnr > 20 && metrics.averageClarity > 0.7) {
      return 'excellent';
    } else if (metrics.averageSnr > 15 && metrics.averageClarity > 0.5) {
      return 'good';
    } else if (metrics.averageSnr > 10 && metrics.averageClarity > 0.3) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  /**
   * Check if quality is acceptable for recognition
   */
  isQualityAcceptable(): boolean {
    const metrics = this.getMetrics();
    return (
      metrics.averageSnr >= this.thresholds.minSnr &&
      metrics.averageClarity >= this.thresholds.minClarity &&
      metrics.echoDetectionRate < 0.5
    );
  }

  /**
   * Set notification callback
   */
  setNotificationCallback(callback: (notification: QualityNotification) => void): void {
    this.notificationCallback = callback;
  }

  /**
   * Update quality thresholds
   */
  updateThresholds(thresholds: Partial<QualityThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }

  /**
   * Reset quality history and parameters
   */
  reset(): void {
    this.qualityHistory = [];
    this.adaptiveParams = {
      noiseReductionLevel: 0.5,
      echoCancellationLevel: 0.5,
      gainAdjustment: 1.0,
    };
    this.lastNotificationTime = 0;
  }

  /**
   * Get quality history
   */
  getHistory(): AudioQuality[] {
    return [...this.qualityHistory];
  }

  /**
   * Get detailed quality report
   */
  getQualityReport(): {
    status: string;
    metrics: QualityMetrics;
    parameters: AdaptiveParameters;
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const status = this.getQualityStatus();
    const recommendations: string[] = [];

    if (metrics.averageSnr < 15) {
      recommendations.push('建议改善环境噪音条件');
    }

    if (metrics.averageClarity < 0.5) {
      recommendations.push('建议提高麦克风音量或靠近麦克风');
    }

    if (metrics.echoDetectionRate > 0.3) {
      recommendations.push('建议使用耳机以减少回声');
    }

    if (metrics.noiseDetectionRate > 0.5) {
      recommendations.push('建议移至更安静的环境');
    }

    if (recommendations.length === 0) {
      recommendations.push('音频质量良好，无需调整');
    }

    return {
      status,
      metrics,
      parameters: this.getAdaptiveParameters(),
      recommendations,
    };
  }
}
