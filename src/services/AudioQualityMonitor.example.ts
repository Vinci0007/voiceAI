/**
 * AudioQualityMonitor Usage Examples
 * 
 * This file demonstrates various usage patterns for the AudioQualityMonitor service.
 */

import { AudioQualityMonitor, QualityNotification } from './AudioQualityMonitor';
import { AudioQuality } from '../api/audioProcessor';

// ============================================================================
// Example 1: Basic Quality Monitoring
// ============================================================================

export function example1_BasicMonitoring() {
  console.log('=== Example 1: Basic Quality Monitoring ===\n');

  const monitor = new AudioQualityMonitor();

  // Simulate audio quality samples
  const samples: AudioQuality[] = [
    { snr: 15, clarity: 0.5, has_echo: false, has_noise: false },
    { snr: 18, clarity: 0.6, has_echo: false, has_noise: false },
    { snr: 12, clarity: 0.4, has_echo: false, has_noise: true },
    { snr: 20, clarity: 0.7, has_echo: false, has_noise: false },
  ];

  samples.forEach((quality, index) => {
    monitor.assessQuality(quality);
    console.log(`Sample ${index + 1}:`);
    console.log(`  SNR: ${quality.snr} dB`);
    console.log(`  Clarity: ${quality.clarity}`);
    console.log(`  Status: ${monitor.getQualityStatus()}`);
    console.log(`  Acceptable: ${monitor.isQualityAcceptable()}`);
    console.log();
  });

  const metrics = monitor.getMetrics();
  console.log('Overall Metrics:');
  console.log(`  Average SNR: ${metrics.averageSnr.toFixed(2)} dB`);
  console.log(`  Average Clarity: ${metrics.averageClarity.toFixed(2)}`);
  console.log(`  Noise Detection Rate: ${(metrics.noiseDetectionRate * 100).toFixed(1)}%`);
  console.log();
}

// ============================================================================
// Example 2: Quality Notifications
// ============================================================================

export function example2_QualityNotifications() {
  console.log('=== Example 2: Quality Notifications ===\n');

  const monitor = new AudioQualityMonitor();

  // Set up notification handler
  monitor.setNotificationCallback((notification: QualityNotification) => {
    console.log(`[${notification.severity.toUpperCase()}] ${notification.message}`);
    if (notification.suggestions.length > 0) {
      console.log('Suggestions:');
      notification.suggestions.forEach((s) => console.log(`  - ${s}`));
    }
    console.log();
  });

  // Simulate poor quality audio
  console.log('Simulating poor quality audio...\n');
  const poorQuality: AudioQuality = {
    snr: 4,
    clarity: 0.15,
    has_echo: true,
    has_noise: true,
  };

  monitor.assessQuality(poorQuality);

  // Simulate low SNR
  console.log('Simulating low SNR...\n');
  const lowSnr: AudioQuality = {
    snr: 7,
    clarity: 0.5,
    has_echo: false,
    has_noise: false,
  };

  // Wait for cooldown
  setTimeout(() => {
    monitor.assessQuality(lowSnr);
  }, 6000);
}

// ============================================================================
// Example 3: Adaptive Parameter Adjustment
// ============================================================================

export function example3_AdaptiveParameters() {
  console.log('=== Example 3: Adaptive Parameter Adjustment ===\n');

  const monitor = new AudioQualityMonitor();

  console.log('Initial Parameters:');
  let params = monitor.getAdaptiveParameters();
  console.log(`  Noise Reduction: ${params.noiseReductionLevel.toFixed(2)}`);
  console.log(`  Echo Cancellation: ${params.echoCancellationLevel.toFixed(2)}`);
  console.log(`  Gain Adjustment: ${params.gainAdjustment.toFixed(2)}`);
  console.log();

  // Simulate noisy environment
  console.log('Simulating noisy environment...');
  for (let i = 0; i < 5; i++) {
    monitor.assessQuality({
      snr: 8,
      clarity: 0.4,
      has_echo: false,
      has_noise: true,
    });
  }

  console.log('Parameters after noise:');
  params = monitor.getAdaptiveParameters();
  console.log(`  Noise Reduction: ${params.noiseReductionLevel.toFixed(2)} (increased)`);
  console.log(`  Echo Cancellation: ${params.echoCancellationLevel.toFixed(2)}`);
  console.log(`  Gain Adjustment: ${params.gainAdjustment.toFixed(2)}`);
  console.log();

  // Simulate echo
  console.log('Simulating echo...');
  for (let i = 0; i < 5; i++) {
    monitor.assessQuality({
      snr: 15,
      clarity: 0.5,
      has_echo: true,
      has_noise: false,
    });
  }

  console.log('Parameters after echo:');
  params = monitor.getAdaptiveParameters();
  console.log(`  Noise Reduction: ${params.noiseReductionLevel.toFixed(2)}`);
  console.log(`  Echo Cancellation: ${params.echoCancellationLevel.toFixed(2)} (increased)`);
  console.log(`  Gain Adjustment: ${params.gainAdjustment.toFixed(2)}`);
  console.log();

  // Simulate low clarity
  console.log('Simulating low clarity...');
  for (let i = 0; i < 5; i++) {
    monitor.assessQuality({
      snr: 12,
      clarity: 0.2,
      has_echo: false,
      has_noise: false,
    });
  }

  console.log('Parameters after low clarity:');
  params = monitor.getAdaptiveParameters();
  console.log(`  Noise Reduction: ${params.noiseReductionLevel.toFixed(2)}`);
  console.log(`  Echo Cancellation: ${params.echoCancellationLevel.toFixed(2)}`);
  console.log(`  Gain Adjustment: ${params.gainAdjustment.toFixed(2)} (increased)`);
  console.log();
}

// ============================================================================
// Example 4: Quality Report Generation
// ============================================================================

export function example4_QualityReport() {
  console.log('=== Example 4: Quality Report Generation ===\n');

  const monitor = new AudioQualityMonitor();

  // Simulate mixed quality samples
  const samples: AudioQuality[] = [
    { snr: 15, clarity: 0.5, has_echo: false, has_noise: false },
    { snr: 12, clarity: 0.4, has_echo: true, has_noise: false },
    { snr: 18, clarity: 0.6, has_echo: false, has_noise: true },
    { snr: 10, clarity: 0.3, has_echo: false, has_noise: false },
    { snr: 20, clarity: 0.7, has_echo: false, has_noise: false },
  ];

  samples.forEach((quality) => monitor.assessQuality(quality));

  const report = monitor.getQualityReport();

  console.log('Quality Report:');
  console.log(`  Status: ${report.status}`);
  console.log();

  console.log('Metrics:');
  console.log(`  Average SNR: ${report.metrics.averageSnr.toFixed(2)} dB`);
  console.log(`  Average Clarity: ${report.metrics.averageClarity.toFixed(2)}`);
  console.log(`  Noise Detection Rate: ${(report.metrics.noiseDetectionRate * 100).toFixed(1)}%`);
  console.log(`  Echo Detection Rate: ${(report.metrics.echoDetectionRate * 100).toFixed(1)}%`);
  console.log(`  Sample Count: ${report.metrics.sampleCount}`);
  console.log();

  console.log('Current Parameters:');
  console.log(`  Noise Reduction: ${report.parameters.noiseReductionLevel.toFixed(2)}`);
  console.log(`  Echo Cancellation: ${report.parameters.echoCancellationLevel.toFixed(2)}`);
  console.log(`  Gain Adjustment: ${report.parameters.gainAdjustment.toFixed(2)}`);
  console.log();

  console.log('Recommendations:');
  report.recommendations.forEach((r) => console.log(`  - ${r}`));
  console.log();
}

// ============================================================================
// Example 5: Custom Thresholds
// ============================================================================

export function example5_CustomThresholds() {
  console.log('=== Example 5: Custom Thresholds ===\n');

  // Create monitor with strict thresholds
  const strictMonitor = new AudioQualityMonitor({
    minSnr: 20,
    minClarity: 0.7,
    noiseThreshold: 0.3,
  });

  // Create monitor with lenient thresholds
  const lenientMonitor = new AudioQualityMonitor({
    minSnr: 8,
    minClarity: 0.2,
    noiseThreshold: 0.7,
  });

  const quality: AudioQuality = {
    snr: 15,
    clarity: 0.5,
    has_echo: false,
    has_noise: false,
  };

  strictMonitor.assessQuality(quality);
  lenientMonitor.assessQuality(quality);

  console.log('Same audio quality with different thresholds:');
  console.log(`  SNR: ${quality.snr} dB, Clarity: ${quality.clarity}`);
  console.log();
  console.log('Strict Monitor:');
  console.log(`  Status: ${strictMonitor.getQualityStatus()}`);
  console.log(`  Acceptable: ${strictMonitor.isQualityAcceptable()}`);
  console.log();
  console.log('Lenient Monitor:');
  console.log(`  Status: ${lenientMonitor.getQualityStatus()}`);
  console.log(`  Acceptable: ${lenientMonitor.isQualityAcceptable()}`);
  console.log();
}

// ============================================================================
// Example 6: Real-time Monitoring Integration
// ============================================================================

export function example6_RealtimeIntegration() {
  console.log('=== Example 6: Real-time Monitoring Integration ===\n');

  const monitor = new AudioQualityMonitor();

  // Set up notification handler
  monitor.setNotificationCallback((notification) => {
    console.log(`[${new Date().toISOString()}] ${notification.severity}: ${notification.message}`);
  });

  // Simulate real-time audio stream
  console.log('Simulating real-time audio stream...\n');

  let sampleCount = 0;
  const interval = setInterval(() => {
    // Generate random quality metrics
    const quality: AudioQuality = {
      snr: 10 + Math.random() * 15,
      clarity: 0.3 + Math.random() * 0.5,
      has_echo: Math.random() > 0.9,
      has_noise: Math.random() > 0.7,
    };

    monitor.assessQuality(quality);
    sampleCount++;

    // Log status every 5 samples
    if (sampleCount % 5 === 0) {
      const status = monitor.getQualityStatus();
      const params = monitor.getAdaptiveParameters();
      console.log(`Sample ${sampleCount}: Status=${status}, NR=${params.noiseReductionLevel.toFixed(2)}, EC=${params.echoCancellationLevel.toFixed(2)}`);
    }

    // Stop after 20 samples
    if (sampleCount >= 20) {
      clearInterval(interval);
      console.log('\nFinal Report:');
      const report = monitor.getQualityReport();
      console.log(`  Status: ${report.status}`);
      console.log(`  Average SNR: ${report.metrics.averageSnr.toFixed(2)} dB`);
      console.log(`  Average Clarity: ${report.metrics.averageClarity.toFixed(2)}`);
    }
  }, 100);
}

// ============================================================================
// Example 7: Quality History Analysis
// ============================================================================

export function example7_HistoryAnalysis() {
  console.log('=== Example 7: Quality History Analysis ===\n');

  const monitor = new AudioQualityMonitor();

  // Simulate quality degradation over time
  console.log('Simulating quality degradation...\n');
  for (let i = 0; i < 10; i++) {
    const quality: AudioQuality = {
      snr: 20 - i * 1.5,
      clarity: 0.8 - i * 0.05,
      has_echo: i > 7,
      has_noise: i > 5,
    };
    monitor.assessQuality(quality);
  }

  const history = monitor.getHistory();
  console.log('Quality History:');
  history.forEach((q, i) => {
    console.log(`  Sample ${i + 1}: SNR=${q.snr.toFixed(1)}, Clarity=${q.clarity.toFixed(2)}, Echo=${q.has_echo}, Noise=${q.has_noise}`);
  });
  console.log();

  const metrics = monitor.getMetrics();
  console.log('Trend Analysis:');
  console.log(`  Average SNR: ${metrics.averageSnr.toFixed(2)} dB`);
  console.log(`  Average Clarity: ${metrics.averageClarity.toFixed(2)}`);
  console.log(`  Echo Detection Rate: ${(metrics.echoDetectionRate * 100).toFixed(1)}%`);
  console.log(`  Noise Detection Rate: ${(metrics.noiseDetectionRate * 100).toFixed(1)}%`);
  console.log();

  if (!monitor.isQualityAcceptable()) {
    console.log('⚠️  Quality has degraded below acceptable levels!');
    const report = monitor.getQualityReport();
    console.log('Recommendations:');
    report.recommendations.forEach((r) => console.log(`  - ${r}`));
  }
  console.log();
}

// ============================================================================
// Run all examples
// ============================================================================

if (require.main === module) {
  example1_BasicMonitoring();
  example2_QualityNotifications();
  example3_AdaptiveParameters();
  example4_QualityReport();
  example5_CustomThresholds();
  example6_RealtimeIntegration();
  example7_HistoryAnalysis();
}
