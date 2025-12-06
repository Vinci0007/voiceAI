/**
 * Integration Example: AudioQualityMonitor with AudioService
 * 
 * This example demonstrates how to integrate the AudioQualityMonitor
 * with the existing AudioService for real-time quality monitoring.
 */

import { AudioService } from './AudioService';
import { AudioQualityMonitor } from './AudioQualityMonitor';
import { ProcessedAudio } from '../api/audioProcessor';

/**
 * Example: Real-time audio quality monitoring during recording
 */
export async function example_RealtimeQualityMonitoring() {
  console.log('=== Real-time Audio Quality Monitoring ===\n');

  // Initialize services
  const audioService = new AudioService();
  const qualityMonitor = new AudioQualityMonitor({
    minSnr: 10,
    minClarity: 0.3,
    noiseThreshold: 0.5,
  });

  // Set up quality notification handler
  qualityMonitor.setNotificationCallback((notification) => {
    console.log(`\n[${notification.severity.toUpperCase()}] ${notification.message}`);
    if (notification.suggestions.length > 0) {
      console.log('建议:');
      notification.suggestions.forEach((s) => console.log(`  - ${s}`));
    }
  });

  // Initialize audio
  await audioService.initialize();

  // Start recording with quality monitoring
  await audioService.startRecording({
    onAudioData: (processedAudio: ProcessedAudio) => {
      // Assess quality
      qualityMonitor.assessQuality(processedAudio.quality);

      // Get adaptive parameters
      const params = qualityMonitor.getAdaptiveParameters();

      // Log quality status periodically
      const status = qualityMonitor.getQualityStatus();
      console.log(`Quality: ${status} | NR: ${params.noiseReductionLevel.toFixed(2)} | EC: ${params.echoCancellationLevel.toFixed(2)} | Gain: ${params.gainAdjustment.toFixed(2)}`);

      // Check if quality is acceptable for recognition
      if (!qualityMonitor.isQualityAcceptable()) {
        console.warn('⚠️  Audio quality below acceptable threshold!');
      }

      // Here you would pass the processed audio to the next stage
      // (e.g., speech recognition) along with the adaptive parameters
    },

    onQualityIssue: (issues: string[]) => {
      console.log('Quality issues detected:', issues.join(', '));
    },

    onError: (error: Error) => {
      console.error('Audio error:', error.message);
    },
  });

  // Simulate recording for 10 seconds
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Stop recording
  await audioService.stopRecording();

  // Generate final quality report
  const report = qualityMonitor.getQualityReport();
  console.log('\n=== Final Quality Report ===');
  console.log(`Status: ${report.status}`);
  console.log(`Average SNR: ${report.metrics.averageSnr.toFixed(2)} dB`);
  console.log(`Average Clarity: ${report.metrics.averageClarity.toFixed(2)}`);
  console.log(`Noise Detection Rate: ${(report.metrics.noiseDetectionRate * 100).toFixed(1)}%`);
  console.log(`Echo Detection Rate: ${(report.metrics.echoDetectionRate * 100).toFixed(1)}%`);
  console.log('\nRecommendations:');
  report.recommendations.forEach((r) => console.log(`  - ${r}`));

  // Cleanup
  await audioService.cleanup();
}

/**
 * Example: Using adaptive parameters to adjust processing
 */
export async function example_AdaptiveProcessing() {
  console.log('=== Adaptive Audio Processing ===\n');

  const audioService = new AudioService();
  const qualityMonitor = new AudioQualityMonitor();

  await audioService.initialize();

  let processingCount = 0;

  await audioService.startRecording({
    onAudioData: (processedAudio: ProcessedAudio) => {
      // Assess quality
      qualityMonitor.assessQuality(processedAudio.quality);

      // Get adaptive parameters
      const params = qualityMonitor.getAdaptiveParameters();

      processingCount++;

      // Log parameter adjustments every 10 samples
      if (processingCount % 10 === 0) {
        console.log(`\nSample ${processingCount}:`);
        console.log(`  Quality: ${qualityMonitor.getQualityStatus()}`);
        console.log(`  Adaptive Parameters:`);
        console.log(`    - Noise Reduction: ${params.noiseReductionLevel.toFixed(2)}`);
        console.log(`    - Echo Cancellation: ${params.echoCancellationLevel.toFixed(2)}`);
        console.log(`    - Gain Adjustment: ${params.gainAdjustment.toFixed(2)}`);

        // In a real implementation, you would use these parameters
        // to adjust the audio processing pipeline:
        // - Adjust noise gate threshold based on noiseReductionLevel
        // - Adjust echo cancellation strength based on echoCancellationLevel
        // - Adjust input gain based on gainAdjustment
      }
    },

    onQualityIssue: (issues: string[]) => {
      console.log('⚠️  Quality issues:', issues.join(', '));
    },

    onError: (error: Error) => {
      console.error('Error:', error.message);
    },
  });

  // Simulate recording
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await audioService.stopRecording();
  await audioService.cleanup();
}

/**
 * Example: Quality-based decision making
 */
export async function example_QualityBasedDecisions() {
  console.log('=== Quality-Based Decision Making ===\n');

  const audioService = new AudioService();
  const qualityMonitor = new AudioQualityMonitor({
    minSnr: 12,
    minClarity: 0.4,
  });

  await audioService.initialize();

  let acceptedSamples = 0;
  let rejectedSamples = 0;

  await audioService.startRecording({
    onAudioData: (processedAudio: ProcessedAudio) => {
      // Assess quality
      qualityMonitor.assessQuality(processedAudio.quality);

      // Make decisions based on quality
      if (qualityMonitor.isQualityAcceptable()) {
        acceptedSamples++;
        // Process this audio for speech recognition
        console.log('✓ Sample accepted for recognition');
      } else {
        rejectedSamples++;
        // Skip this sample or request user to improve conditions
        console.log('✗ Sample rejected - quality too low');

        const metrics = qualityMonitor.getMetrics();
        if (metrics.averageSnr < 10) {
          console.log('  Reason: Low SNR');
        }
        if (metrics.averageClarity < 0.3) {
          console.log('  Reason: Low clarity');
        }
      }
    },

    onQualityIssue: (issues: string[]) => {
      console.log('Issues:', issues.join(', '));
    },

    onError: (error: Error) => {
      console.error('Error:', error.message);
    },
  });

  // Simulate recording
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await audioService.stopRecording();

  console.log('\n=== Processing Statistics ===');
  console.log(`Accepted samples: ${acceptedSamples}`);
  console.log(`Rejected samples: ${rejectedSamples}`);
  console.log(`Acceptance rate: ${((acceptedSamples / (acceptedSamples + rejectedSamples)) * 100).toFixed(1)}%`);

  await audioService.cleanup();
}

/**
 * Example: Quality monitoring with UI updates
 */
export class AudioQualityUI {
  private audioService: AudioService;
  private qualityMonitor: AudioQualityMonitor;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.audioService = new AudioService();
    this.qualityMonitor = new AudioQualityMonitor();
  }

  async start(onUpdate: (status: string, metrics: any) => void) {
    await this.audioService.initialize();

    // Set up quality notifications
    this.qualityMonitor.setNotificationCallback((notification) => {
      // Show notification to user
      this.showNotification(notification.severity, notification.message, notification.suggestions);
    });

    // Start recording
    await this.audioService.startRecording({
      onAudioData: (processedAudio) => {
        this.qualityMonitor.assessQuality(processedAudio.quality);
      },
      onQualityIssue: (issues) => {
        console.log('Quality issues:', issues);
      },
      onError: (error) => {
        console.error('Error:', error);
      },
    });

    // Update UI periodically
    this.updateInterval = setInterval(() => {
      const status = this.qualityMonitor.getQualityStatus();
      const metrics = this.qualityMonitor.getMetrics();
      onUpdate(status, metrics);
    }, 1000);
  }

  async stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    await this.audioService.stopRecording();
    await this.audioService.cleanup();

    // Return final report
    return this.qualityMonitor.getQualityReport();
  }

  private showNotification(severity: string, message: string, suggestions: string[]) {
    // In a real UI, this would show a toast/alert
    console.log(`[${severity}] ${message}`);
    suggestions.forEach((s) => console.log(`  - ${s}`));
  }
}

/**
 * Example usage of AudioQualityUI
 */
export async function example_UIIntegration() {
  console.log('=== UI Integration Example ===\n');

  const ui = new AudioQualityUI();

  await ui.start((status, metrics) => {
    // Update UI elements
    console.log(`Status: ${status} | SNR: ${metrics.averageSnr.toFixed(1)} dB | Clarity: ${metrics.averageClarity.toFixed(2)}`);
  });

  // Simulate user session
  await new Promise((resolve) => setTimeout(resolve, 10000));

  const report = await ui.stop();

  console.log('\n=== Session Report ===');
  console.log(`Final Status: ${report.status}`);
  console.log('Recommendations:');
  report.recommendations.forEach((r) => console.log(`  - ${r}`));
}

// Run examples
if (require.main === module) {
  (async () => {
    try {
      await example_RealtimeQualityMonitoring();
      await example_AdaptiveProcessing();
      await example_QualityBasedDecisions();
      await example_UIIntegration();
    } catch (error) {
      console.error('Example error:', error);
    }
  })();
}
