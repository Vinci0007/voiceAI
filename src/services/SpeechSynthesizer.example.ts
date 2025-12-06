/**
 * Speech Synthesizer Usage Examples
 * 
 * This file demonstrates various usage patterns for the Speech Synthesizer.
 */

import { 
  SpeechSynthesizer, 
  SynthesisEngine,
  VoiceGender,
  AudioEncoding 
} from './SpeechSynthesizer';
import { ErrorHandler } from './ErrorHandler';

// Example 1: Basic Synthesis
async function basicSynthesis() {
  console.log('=== Example 1: Basic Synthesis ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
  });

  // Synthesize simple text
  const result = await synthesizer.synthesize(
    'Hello, how are you today?',
    'en-US'
  );

  console.log('Text:', 'Hello, how are you today?');
  console.log('Duration:', result.duration, 'ms');
  console.log('Voice used:', result.voiceUsed);
  console.log('Audio samples:', result.audio.data.length);
  console.log();
}

// Example 2: Custom Voice Configuration
async function customVoiceConfig() {
  console.log('=== Example 2: Custom Voice Configuration ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
  });

  const text = 'Welcome to our application';

  // Synthesize with different voice settings
  const configs = [
    { name: 'Normal', pitch: 0, speed: 1.0, volume: 1.0 },
    { name: 'High pitch', pitch: 10, speed: 1.0, volume: 1.0 },
    { name: 'Fast', pitch: 0, speed: 1.5, volume: 1.0 },
    { name: 'Slow & quiet', pitch: 0, speed: 0.8, volume: 0.5 },
  ];

  for (const config of configs) {
    const result = await synthesizer.synthesize(text, 'en-US', {
      voiceId: 'en-US-Standard-A',
      pitch: config.pitch,
      speed: config.speed,
      volume: config.volume,
    });

    console.log(`${config.name}:`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Samples: ${result.audio.data.length}`);
  }
  console.log();
}

// Example 3: Streaming Synthesis
async function streamingSynthesis() {
  console.log('=== Example 3: Streaming Synthesis ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
    enableStreaming: true,
  });

  console.log('Starting streaming synthesis...');

  // Start streaming
  const sessionId = 'stream_' + Date.now();
  const stream = synthesizer.synthesizeStream('en-US', {
    voiceId: 'en-US-Wavenet-A',
  }, sessionId);

  // Push text chunks
  const chunks = [
    'Hello, ',
    'this is a ',
    'streaming synthesis ',
    'example.',
  ];

  // Push chunks with delay
  setTimeout(() => synthesizer.pushTextChunk(sessionId, chunks[0]), 100);
  setTimeout(() => synthesizer.pushTextChunk(sessionId, chunks[1]), 200);
  setTimeout(() => synthesizer.pushTextChunk(sessionId, chunks[2]), 300);
  setTimeout(() => synthesizer.pushTextChunk(sessionId, chunks[3]), 400);
  setTimeout(() => synthesizer.stopStream(sessionId), 500);

  // Process audio chunks
  let chunkCount = 0;
  for await (const audioChunk of stream) {
    chunkCount++;
    console.log(`Received audio chunk ${chunkCount}:`, audioChunk.data.length, 'samples');
  }

  console.log('Streaming complete\n');
}

// Example 4: Caching Demonstration
async function cachingDemo() {
  console.log('=== Example 4: Caching Demonstration ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
    enableCache: true,
    maxCacheSize: 100,
  });

  const text = 'This is a test phrase';
  const language = 'en-US';

  // First synthesis (cache miss)
  console.log('First synthesis (cache miss)...');
  const start1 = Date.now();
  await synthesizer.synthesize(text, language);
  const time1 = Date.now() - start1;
  console.log(`Time: ${time1}ms`);

  // Second synthesis (cache hit)
  console.log('Second synthesis (cache hit)...');
  const start2 = Date.now();
  await synthesizer.synthesize(text, language);
  const time2 = Date.now() - start2;
  console.log(`Time: ${time2}ms`);

  console.log(`Speedup: ${(time1 / time2).toFixed(1)}x faster`);

  // Check cache stats
  const cacheStats = synthesizer.getCacheStats();
  console.log('\nCache Statistics:');
  console.log('- Size:', cacheStats.size);
  console.log('- Hit rate:', (cacheStats.hitRate * 100).toFixed(2) + '%');
  console.log();
}

// Example 5: Engine Fallback
async function engineFallback() {
  console.log('=== Example 5: Engine Fallback ===\n');

  const synthesizer = new SpeechSynthesizer({
    primaryEngine: SynthesisEngine.GOOGLE_CLOUD,
    fallbackEngine: SynthesisEngine.PIPER_LOCAL,
    // No API key provided - will fall back to local engine
  });

  console.log('Attempting synthesis without API key...');
  const result = await synthesizer.synthesize(
    'Hello, world!',
    'en-US'
  );

  console.log('Synthesis succeeded using fallback engine');
  console.log('Duration:', result.duration, 'ms');
  console.log();
}

// Example 6: Multiple Languages
async function multipleLanguages() {
  console.log('=== Example 6: Multiple Languages ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
  });

  const phrases = [
    { text: 'Hello, world!', lang: 'en-US', name: 'English' },
    { text: '你好，世界！', lang: 'zh-CN', name: 'Chinese' },
    { text: 'Hola, mundo!', lang: 'es-ES', name: 'Spanish' },
    { text: 'Bonjour, monde!', lang: 'fr-FR', name: 'French' },
    { text: 'こんにちは、世界！', lang: 'ja-JP', name: 'Japanese' },
  ];

  console.log('Synthesizing in multiple languages:\n');

  for (const phrase of phrases) {
    const result = await synthesizer.synthesize(phrase.text, phrase.lang);
    console.log(`${phrase.name}: ${phrase.text}`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Voice: ${result.voiceUsed}`);
  }
  console.log();
}

// Example 7: Get Available Voices
async function availableVoices() {
  console.log('=== Example 7: Available Voices ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
  });

  const languages = ['en-US', 'es-ES', 'fr-FR'];

  for (const lang of languages) {
    const voices = await synthesizer.getAvailableVoices(lang);
    console.log(`${lang} voices:`);
    voices.forEach(voice => console.log(`  - ${voice}`));
    console.log();
  }
}

// Example 8: Statistics Tracking
async function statisticsTracking() {
  console.log('=== Example 8: Statistics Tracking ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
    enableCache: true,
  });

  // Perform various syntheses
  await synthesizer.synthesize('Hello', 'en-US');
  await synthesizer.synthesize('World', 'en-US');
  await synthesizer.synthesize('Hello', 'en-US'); // Cache hit

  // Get statistics
  const stats = synthesizer.getStats();
  console.log('Synthesis Statistics:');
  console.log('- Total syntheses:', stats.totalSyntheses);
  console.log('- Cache hits:', stats.cacheHits);
  console.log('- Cache misses:', stats.cacheMisses);
  console.log('- Streaming syntheses:', stats.streamingSyntheses);
  console.log('- Average latency:', stats.averageLatency.toFixed(2) + 'ms');
  console.log('- Engine usage:', stats.engineUsage);
  console.log();
}

// Example 9: Error Handling
async function errorHandling() {
  console.log('=== Example 9: Error Handling ===\n');

  const errorHandler = new ErrorHandler();
  const synthesizer = new SpeechSynthesizer({
    primaryEngine: SynthesisEngine.GOOGLE_CLOUD,
    fallbackEngine: SynthesisEngine.PIPER_LOCAL,
  }, errorHandler);

  // Listen for errors
  errorHandler.addErrorListener((error) => {
    console.log('Error caught:', error.type, '-', error.message);
  });

  // Try synthesis without API key (will trigger fallback)
  console.log('Attempting synthesis...');
  const result = await synthesizer.synthesize('Test', 'en-US');
  console.log('Result duration:', result.duration, 'ms');
  console.log();
}

// Example 10: Configuration Updates
async function configurationUpdates() {
  console.log('=== Example 10: Configuration Updates ===\n');

  const synthesizer = new SpeechSynthesizer({
    primaryEngine: SynthesisEngine.GOOGLE_CLOUD,
    sampleRate: 24000,
  });

  console.log('Initial config:');
  console.log('- Primary engine:', synthesizer.getConfig().primaryEngine);
  console.log('- Sample rate:', synthesizer.getConfig().sampleRate);

  // Update configuration
  synthesizer.updateConfig({
    primaryEngine: SynthesisEngine.AZURE,
    sampleRate: 48000,
    azureApiKey: 'new-azure-key',
    azureRegion: 'eastus',
  });

  console.log('\nUpdated config:');
  console.log('- Primary engine:', synthesizer.getConfig().primaryEngine);
  console.log('- Sample rate:', synthesizer.getConfig().sampleRate);
  console.log();
}

// Example 11: Real-time Translation Pipeline
async function realtimeTranslationPipeline() {
  console.log('=== Example 11: Real-time Translation Pipeline ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
  });

  // Simulate translated text arriving in real-time
  const translations = [
    { text: 'Hola', timestamp: 0 },
    { text: 'Cómo estás', timestamp: 100 },
    { text: 'Estoy bien', timestamp: 200 },
    { text: 'Gracias', timestamp: 300 },
  ];

  console.log('Processing real-time translations...\n');

  for (const translation of translations) {
    const result = await synthesizer.synthesize(
      translation.text,
      'es-ES'
    );

    console.log(`[${translation.timestamp}ms] ${translation.text}`);
    console.log(`  Synthesized in ${result.duration}ms`);
  }
  console.log();
}

// Example 12: Cache Management
async function cacheManagement() {
  console.log('=== Example 12: Cache Management ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
    enableCache: true,
    maxCacheSize: 3, // Small cache for demonstration
  });

  // Add syntheses to cache
  console.log('Adding syntheses to cache...');
  await synthesizer.synthesize('One', 'en-US');
  await synthesizer.synthesize('Two', 'en-US');
  await synthesizer.synthesize('Three', 'en-US');

  console.log('Cache size:', synthesizer.getCacheStats().size);

  // Add one more (will evict oldest)
  await synthesizer.synthesize('Four', 'en-US');
  console.log('Cache size after adding fourth:', synthesizer.getCacheStats().size);

  // Clear cache
  synthesizer.clearCache();
  console.log('Cache size after clearing:', synthesizer.getCacheStats().size);
  console.log();
}

// Example 13: Voice Comparison
async function voiceComparison() {
  console.log('=== Example 13: Voice Comparison ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
  });

  const text = 'The quick brown fox jumps over the lazy dog';
  const voices = [
    'en-US-Standard-A',
    'en-US-Wavenet-A',
    'en-US-Neural2-A',
  ];

  console.log('Comparing different voice types:\n');

  for (const voiceId of voices) {
    const result = await synthesizer.synthesize(text, 'en-US', { voiceId });
    console.log(`Voice: ${voiceId}`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Samples: ${result.audio.data.length}`);
  }
  console.log();
}

// Example 14: Batch Synthesis
async function batchSynthesis() {
  console.log('=== Example 14: Batch Synthesis ===\n');

  const synthesizer = new SpeechSynthesizer({
    googleApiKey: 'demo-key',
  });

  const phrases = [
    'Good morning',
    'Good afternoon',
    'Good evening',
    'Good night',
  ];

  console.log('Synthesizing batch of phrases...\n');

  const results = await Promise.all(
    phrases.map(phrase => synthesizer.synthesize(phrase, 'en-US'))
  );

  results.forEach((result, i) => {
    console.log(`${phrases[i]}: ${result.duration}ms`);
  });
  console.log();
}

// Example 15: Audio Format Configuration
async function audioFormatConfig() {
  console.log('=== Example 15: Audio Format Configuration ===\n');

  const formats = [
    { encoding: AudioEncoding.LINEAR16, rate: 16000, name: 'Phone quality' },
    { encoding: AudioEncoding.LINEAR16, rate: 24000, name: 'Standard quality' },
    { encoding: AudioEncoding.LINEAR16, rate: 48000, name: 'High quality' },
  ];

  for (const format of formats) {
    const synthesizer = new SpeechSynthesizer({
      googleApiKey: 'demo-key',
      audioEncoding: format.encoding,
      sampleRate: format.rate,
    });

    const result = await synthesizer.synthesize('Hello', 'en-US');
    
    console.log(`${format.name} (${format.rate}Hz):`);
    console.log(`  Samples: ${result.audio.data.length}`);
    console.log(`  Duration: ${result.duration}ms`);
  }
  console.log();
}

// Run all examples
async function runAllExamples() {
  try {
    await basicSynthesis();
    await customVoiceConfig();
    await streamingSynthesis();
    await cachingDemo();
    await engineFallback();
    await multipleLanguages();
    await availableVoices();
    await statisticsTracking();
    await errorHandling();
    await configurationUpdates();
    await realtimeTranslationPipeline();
    await cacheManagement();
    await voiceComparison();
    await batchSynthesis();
    await audioFormatConfig();

    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export for use in other files
export {
  basicSynthesis,
  customVoiceConfig,
  streamingSynthesis,
  cachingDemo,
  engineFallback,
  multipleLanguages,
  availableVoices,
  statisticsTracking,
  errorHandling,
  configurationUpdates,
  realtimeTranslationPipeline,
  cacheManagement,
  voiceComparison,
  batchSynthesis,
  audioFormatConfig,
  runAllExamples,
};

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
