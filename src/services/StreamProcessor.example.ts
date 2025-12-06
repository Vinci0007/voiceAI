/**
 * StreamProcessor Usage Examples
 * 
 * Demonstrates various use cases for the Translation Pipeline Coordinator
 */

import { StreamProcessor } from './StreamProcessor';
import { SpeechRecognizer } from './SpeechRecognizer';
import { LanguageDetector } from './LanguageDetector';
import { TranslationEngine } from './TranslationEngine';
import { SpeechSynthesizer } from './SpeechSynthesizer';
import type { AudioBuffer, SpeakerInfo } from '../types';

// ============================================================================
// Example 1: Basic Single Segment Processing
// ============================================================================

async function example1_basicProcessing() {
  console.log('\n=== Example 1: Basic Single Segment Processing ===\n');

  const processor = new StreamProcessor();

  const audioBuffer: AudioBuffer = {
    data: new Float32Array(16000), // 1 second at 16kHz
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  try {
    const result = await processor.processAudioSegment(
      audioBuffer,
      'user123',
      'en-US'
    );

    if (result) {
      console.log('Original text:', result.originalText);
      console.log('Translated text:', result.translatedText);
      console.log('Latency:', result.latency, 'ms');
      console.log('Speaker:', result.speakerId);
    }
  } catch (error) {
    console.error('Processing failed:', error);
  }
}

// ============================================================================
// Example 2: Stream Processing
// ============================================================================

async function example2_streamProcessing() {
  console.log('\n=== Example 2: Stream Processing ===\n');

  const processor = new StreamProcessor({
    enableStreaming: true,
    enableMetrics: true,
  });

  // Create a mock audio stream
  const audioStream = createMockAudioStream();

  try {
    for await (const output of processor.processAudioStream(
      audioStream,
      'user123',
      'en-US'
    )) {
      console.log(`[${new Date(output.timestamp).toISOString()}]`);
      console.log(`  Speaker: ${output.speakerId}`);
      console.log(`  Original: ${output.originalText}`);
      console.log(`  Translated: ${output.translatedText}`);
      console.log(`  Latency: ${output.latency}ms`);
      console.log('---');
    }
  } finally {
    await processor.cleanup();
  }
}

// ============================================================================
// Example 3: Same Language Skip Translation
// ============================================================================

async function example3_skipSameLanguage() {
  console.log('\n=== Example 3: Skip Same Language Translation ===\n');

  const processor = new StreamProcessor({
    skipSameLanguageTranslation: true,
  });

  const audioBuffer: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  // Process English audio with English target (should skip translation)
  const result = await processor.processAudioSegment(
    audioBuffer,
    'user123',
    'en-US' // Same as detected language
  );

  if (result) {
    console.log('Translation skipped:', result.translatedText === '');
    console.log('Original audio preserved');
  }

  const metrics = processor.getMetrics();
  console.log('Skipped translations:', metrics.skippedTranslations);
}

// ============================================================================
// Example 4: With Custom Services
// ============================================================================

async function example4_customServices() {
  console.log('\n=== Example 4: With Custom Services ===\n');

  // Initialize services with custom configuration
  const recognizer = new SpeechRecognizer({
    primaryEngine: 'google_cloud' as any,
    googleApiKey: 'YOUR_API_KEY',
    enableStreaming: true,
  });

  const detector = new LanguageDetector({
    confidenceThreshold: 0.8,
    useApiDetection: true,
  });

  const translator = new TranslationEngine({
    primaryEngine: 'google_cloud' as any,
    enableCache: true,
    enableBatchOptimization: true,
  });

  const synthesizer = new SpeechSynthesizer({
    primaryEngine: 'google_cloud' as any,
    enableCache: true,
    enableStreaming: true,
  });

  // Create processor with custom services
  const processor = new StreamProcessor(
    {
      enableStreaming: true,
      maxConcurrentProcesses: 5,
    },
    recognizer,
    detector,
    translator,
    synthesizer
  );

  const audioBuffer: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  const result = await processor.processAudioSegment(
    audioBuffer,
    'user123',
    'en-US'
  );

  console.log('Processed with custom services:', result);
}

// ============================================================================
// Example 5: Monitor Pipeline State
// ============================================================================

async function example5_monitorState() {
  console.log('\n=== Example 5: Monitor Pipeline State ===\n');

  const processor = new StreamProcessor({
    enableMetrics: true,
  });

  const audioBuffer: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  // Start processing (don't await to monitor state)
  const processingPromise = processor.processAudioSegment(
    audioBuffer,
    'user123',
    'en-US'
  );

  // Monitor active pipelines
  const checkInterval = setInterval(() => {
    const activePipelines = processor.getActivePipelines();
    
    if (activePipelines.length > 0) {
      activePipelines.forEach(state => {
        console.log(`Segment ${state.segmentId}:`);
        console.log(`  Stage: ${state.currentStage}`);
        console.log(`  Source: ${state.sourceLanguage || 'detecting...'}`);
        console.log(`  Target: ${state.targetLanguage}`);
        console.log(`  Duration: ${Date.now() - state.startTime}ms`);
      });
    }
  }, 100);

  // Wait for completion
  await processingPromise;
  clearInterval(checkInterval);

  console.log('Processing complete');
}

// ============================================================================
// Example 6: Metrics Collection
// ============================================================================

async function example6_metricsCollection() {
  console.log('\n=== Example 6: Metrics Collection ===\n');

  const processor = new StreamProcessor({
    enableMetrics: true,
  });

  // Process multiple segments
  for (let i = 0; i < 5; i++) {
    const audioBuffer: AudioBuffer = {
      data: new Float32Array(16000),
      sampleRate: 16000,
      channels: 1,
      timestamp: Date.now(),
    };

    try {
      await processor.processAudioSegment(
        audioBuffer,
        'user123',
        'en-US'
      );
    } catch (error) {
      console.error(`Segment ${i} failed:`, error);
    }
  }

  // Get metrics
  const metrics = processor.getMetrics();
  
  console.log('\nPipeline Metrics:');
  console.log('  Total processed:', metrics.totalProcessed);
  console.log('  Successful:', metrics.successfulProcessed);
  console.log('  Failed:', metrics.failedProcessed);
  console.log('  Skipped translations:', metrics.skippedTranslations);
  console.log('  Average latency:', metrics.averageLatency.toFixed(2), 'ms');
  
  const successRate = (metrics.successfulProcessed / metrics.totalProcessed * 100).toFixed(2);
  console.log('  Success rate:', successRate + '%');
}

// ============================================================================
// Example 7: Multi-Speaker Processing
// ============================================================================

async function example7_multiSpeaker() {
  console.log('\n=== Example 7: Multi-Speaker Processing ===\n');

  const processor = new StreamProcessor({
    maxConcurrentProcesses: 10,
  });

  const speakers: SpeakerInfo[] = [
    { speakerId: 'speaker_001', confidence: 0.95, isNewSpeaker: false },
    { speakerId: 'speaker_002', confidence: 0.92, isNewSpeaker: false },
    { speakerId: 'speaker_003', confidence: 0.88, isNewSpeaker: true },
  ];

  // Process audio from multiple speakers
  for (const speaker of speakers) {
    const audioBuffer: AudioBuffer = {
      data: new Float32Array(16000),
      sampleRate: 16000,
      channels: 1,
      timestamp: Date.now(),
    };

    const result = await processor.processAudioSegment(
      audioBuffer,
      'user123',
      'en-US',
      speaker
    );

    if (result) {
      console.log(`Speaker ${speaker.speakerId}:`);
      console.log(`  Original: ${result.originalText}`);
      console.log(`  Translated: ${result.translatedText}`);
      console.log(`  Latency: ${result.latency}ms`);
    }
  }
}

// ============================================================================
// Example 8: Error Handling
// ============================================================================

async function example8_errorHandling() {
  console.log('\n=== Example 8: Error Handling ===\n');

  const processor = new StreamProcessor({
    stageTimeout: 5000,
  });

  const audioBuffer: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  try {
    const result = await processor.processAudioSegment(
      audioBuffer,
      'user123',
      'en-US'
    );

    if (result) {
      console.log('Processing successful');
    }
  } catch (error) {
    console.error('Processing failed:', error);
    
    // Check metrics to see failure count
    const metrics = processor.getMetrics();
    console.log('Failed processes:', metrics.failedProcessed);
    
    // Implement retry logic or fallback
    console.log('Implementing fallback strategy...');
  }
}

// ============================================================================
// Example 9: Concurrent Processing
// ============================================================================

async function example9_concurrentProcessing() {
  console.log('\n=== Example 9: Concurrent Processing ===\n');

  const processor = new StreamProcessor({
    maxConcurrentProcesses: 5,
    enableMetrics: true,
  });

  // Process multiple segments concurrently
  const promises = [];
  
  for (let i = 0; i < 10; i++) {
    const audioBuffer: AudioBuffer = {
      data: new Float32Array(16000),
      sampleRate: 16000,
      channels: 1,
      timestamp: Date.now() + i * 100,
    };

    promises.push(
      processor.processAudioSegment(
        audioBuffer,
        'user123',
        'en-US'
      ).catch(error => {
        console.error(`Segment ${i} failed:`, error);
        return null;
      })
    );
  }

  const results = await Promise.all(promises);
  const successfulResults = results.filter(r => r !== null);

  console.log(`Processed ${successfulResults.length} out of ${promises.length} segments`);
  
  const metrics = processor.getMetrics();
  console.log('Average latency:', metrics.averageLatency.toFixed(2), 'ms');
}

// ============================================================================
// Example 10: Cleanup and Resource Management
// ============================================================================

async function example10_cleanup() {
  console.log('\n=== Example 10: Cleanup and Resource Management ===\n');

  const processor = new StreamProcessor();

  // Process some audio
  const audioBuffer: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  await processor.processAudioSegment(
    audioBuffer,
    'user123',
    'en-US'
  );

  console.log('Active pipelines before cleanup:', processor.getActivePipelines().length);

  // Cleanup resources
  await processor.cleanup();

  console.log('Active pipelines after cleanup:', processor.getActivePipelines().length);
  console.log('Resources cleaned up successfully');
}

// ============================================================================
// Helper Functions
// ============================================================================

function createMockAudioStream(): ReadableStream<AudioBuffer> {
  let count = 0;
  const maxChunks = 5;

  return new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        if (count >= maxChunks) {
          clearInterval(interval);
          controller.close();
          return;
        }

        const audioBuffer: AudioBuffer = {
          data: new Float32Array(16000),
          sampleRate: 16000,
          channels: 1,
          timestamp: Date.now(),
        };

        controller.enqueue(audioBuffer);
        count++;
      }, 1000);
    },
  });
}

// ============================================================================
// Run Examples
// ============================================================================

async function runAllExamples() {
  console.log('StreamProcessor Examples\n');
  console.log('========================\n');

  try {
    await example1_basicProcessing();
    await example2_streamProcessing();
    await example3_skipSameLanguage();
    await example4_customServices();
    await example5_monitorState();
    await example6_metricsCollection();
    await example7_multiSpeaker();
    await example8_errorHandling();
    await example9_concurrentProcessing();
    await example10_cleanup();

    console.log('\n========================');
    console.log('All examples completed!');
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Uncomment to run examples
// runAllExamples();

export {
  example1_basicProcessing,
  example2_streamProcessing,
  example3_skipSameLanguage,
  example4_customServices,
  example5_monitorState,
  example6_metricsCollection,
  example7_multiSpeaker,
  example8_errorHandling,
  example9_concurrentProcessing,
  example10_cleanup,
};
