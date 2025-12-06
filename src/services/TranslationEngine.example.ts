/**
 * Translation Engine Usage Examples
 * 
 * This file demonstrates various usage patterns for the Translation Engine.
 */

import { TranslationEngine, TranslationEngineType } from './TranslationEngine';
import { ErrorHandler } from './ErrorHandler';

// Example 1: Basic Translation
async function basicTranslation() {
  console.log('=== Example 1: Basic Translation ===\n');

  const engine = new TranslationEngine({
    googleApiKey: 'demo-key',
  });

  // Translate a simple text
  const result = await engine.translate(
    'Hello, how are you?',
    'en',
    'es'
  );

  console.log('Original:', 'Hello, how are you?');
  console.log('Translated:', result.translatedText);
  console.log('Confidence:', result.confidence);
  console.log('Source:', result.sourceLang);
  console.log('Target:', result.targetLang);
  console.log();
}

// Example 2: Batch Translation
async function batchTranslation() {
  console.log('=== Example 2: Batch Translation ===\n');

  const engine = new TranslationEngine({
    googleApiKey: 'demo-key',
    enableBatchOptimization: true,
  });

  const texts = [
    'Good morning',
    'Good afternoon',
    'Good evening',
    'Good night',
  ];

  console.log('Translating batch of', texts.length, 'texts...');
  const results = await engine.translateBatch(texts, 'en', 'fr');

  results.forEach((result, i) => {
    console.log(`${texts[i]} -> ${result.translatedText}`);
  });
  console.log();
}

// Example 3: Queue-based Batch Processing
async function queuedBatchTranslation() {
  console.log('=== Example 3: Queued Batch Processing ===\n');

  const engine = new TranslationEngine({
    googleApiKey: 'demo-key',
    enableBatchOptimization: true,
    maxBatchSize: 5,
    batchTimeout: 100,
  });

  console.log('Queueing translations...');
  
  // Queue multiple translations
  const promises = [
    engine.queueForBatch('Hello', 'en', 'de'),
    engine.queueForBatch('World', 'en', 'de'),
    engine.queueForBatch('Goodbye', 'en', 'de'),
  ];

  // They will be processed together in a single batch
  const results = await Promise.all(promises);

  results.forEach((result, i) => {
    console.log(`Translation ${i + 1}:`, result.translatedText);
  });
  console.log();
}

// Example 4: Caching Demonstration
async function cachingDemo() {
  console.log('=== Example 4: Caching Demonstration ===\n');

  const engine = new TranslationEngine({
    googleApiKey: 'demo-key',
    enableCache: true,
    maxCacheSize: 1000,
    cacheTTL: 3600000, // 1 hour
  });

  const text = 'This is a test';
  const sourceLang = 'en';
  const targetLang = 'ja';

  // First translation (cache miss)
  console.log('First translation (cache miss)...');
  const start1 = Date.now();
  await engine.translate(text, sourceLang, targetLang);
  const time1 = Date.now() - start1;
  console.log(`Time: ${time1}ms`);

  // Second translation (cache hit)
  console.log('Second translation (cache hit)...');
  const start2 = Date.now();
  await engine.translate(text, sourceLang, targetLang);
  const time2 = Date.now() - start2;
  console.log(`Time: ${time2}ms`);

  console.log(`Speedup: ${(time1 / time2).toFixed(1)}x faster`);

  // Check cache stats
  const cacheStats = engine.getCacheStats();
  console.log('\nCache Statistics:');
  console.log('- Size:', cacheStats.size);
  console.log('- Hit rate:', (cacheStats.hitRate * 100).toFixed(2) + '%');
  console.log();
}

// Example 5: Engine Fallback
async function engineFallback() {
  console.log('=== Example 5: Engine Fallback ===\n');

  const engine = new TranslationEngine({
    primaryEngine: TranslationEngineType.GOOGLE_CLOUD,
    fallbackEngine: TranslationEngineType.NLLB_LOCAL,
    // No API key provided - will fall back to local model
  });

  console.log('Attempting translation without API key...');
  const result = await engine.translate(
    'Hello, world!',
    'en',
    'zh'
  );

  console.log('Translation succeeded using fallback engine');
  console.log('Result:', result.translatedText);
  console.log('Confidence:', result.confidence);
  console.log();
}

// Example 6: Multiple Language Pairs
async function multipleLanguagePairs() {
  console.log('=== Example 6: Multiple Language Pairs ===\n');

  const engine = new TranslationEngine({
    googleApiKey: 'demo-key',
  });

  const text = 'Welcome to our application';
  const languagePairs = [
    { source: 'en', target: 'es', name: 'Spanish' },
    { source: 'en', target: 'fr', name: 'French' },
    { source: 'en', target: 'de', name: 'German' },
    { source: 'en', target: 'ja', name: 'Japanese' },
    { source: 'en', target: 'zh', name: 'Chinese' },
  ];

  console.log('Original:', text);
  console.log('\nTranslations:');

  for (const pair of languagePairs) {
    const result = await engine.translate(text, pair.source, pair.target);
    console.log(`- ${pair.name}: ${result.translatedText}`);
  }
  console.log();
}

// Example 7: Statistics Tracking
async function statisticsTracking() {
  console.log('=== Example 7: Statistics Tracking ===\n');

  const engine = new TranslationEngine({
    googleApiKey: 'demo-key',
    enableCache: true,
  });

  // Perform various translations
  await engine.translate('Hello', 'en', 'es');
  await engine.translate('World', 'en', 'es');
  await engine.translate('Hello', 'en', 'es'); // Cache hit
  await engine.translateBatch(['Good', 'Bad'], 'en', 'fr');

  // Get statistics
  const stats = engine.getStats();
  console.log('Translation Statistics:');
  console.log('- Total translations:', stats.totalTranslations);
  console.log('- Cache hits:', stats.cacheHits);
  console.log('- Cache misses:', stats.cacheMisses);
  console.log('- Batch translations:', stats.batchTranslations);
  console.log('- Average latency:', stats.averageLatency.toFixed(2) + 'ms');
  console.log('- Engine usage:', stats.engineUsage);
  console.log();
}

// Example 8: Error Handling
async function errorHandling() {
  console.log('=== Example 8: Error Handling ===\n');

  const errorHandler = new ErrorHandler();
  const engine = new TranslationEngine({
    primaryEngine: TranslationEngineType.GOOGLE_CLOUD,
    fallbackEngine: TranslationEngineType.NLLB_LOCAL,
  }, errorHandler);

  // Listen for errors
  errorHandler.addErrorListener((error) => {
    console.log('Error caught:', error.type, '-', error.message);
  });

  // Try translation without API key (will trigger fallback)
  console.log('Attempting translation...');
  const result = await engine.translate('Test', 'en', 'fr');
  console.log('Result:', result.translatedText);
  console.log();
}

// Example 9: Same Language Detection
async function sameLanguageDetection() {
  console.log('=== Example 9: Same Language Detection ===\n');

  const engine = new TranslationEngine({
    googleApiKey: 'demo-key',
  });

  const text = 'This text is already in English';
  
  console.log('Translating English to English...');
  const result = await engine.translate(text, 'en', 'en-US');

  console.log('Original:', text);
  console.log('Result:', result.translatedText);
  console.log('Confidence:', result.confidence);
  console.log('Note: No actual translation performed (same language)');
  console.log();
}

// Example 10: Configuration Updates
async function configurationUpdates() {
  console.log('=== Example 10: Configuration Updates ===\n');

  const engine = new TranslationEngine({
    primaryEngine: TranslationEngineType.GOOGLE_CLOUD,
  });

  console.log('Initial config:');
  console.log('- Primary engine:', engine.getConfig().primaryEngine);
  console.log('- Cache enabled:', engine.getConfig().enableCache);

  // Update configuration
  engine.updateConfig({
    primaryEngine: TranslationEngineType.DEEPL,
    enableCache: false,
    deeplApiKey: 'new-deepl-key',
  });

  console.log('\nUpdated config:');
  console.log('- Primary engine:', engine.getConfig().primaryEngine);
  console.log('- Cache enabled:', engine.getConfig().enableCache);
  console.log();
}

// Example 11: Real-time Translation Pipeline
async function realtimeTranslationPipeline() {
  console.log('=== Example 11: Real-time Translation Pipeline ===\n');

  const engine = new TranslationEngine({
    googleApiKey: 'demo-key',
    enableBatchOptimization: true,
    batchTimeout: 50, // Short timeout for real-time
  });

  // Simulate real-time speech recognition results
  const speechResults = [
    { text: 'Hello', timestamp: 0 },
    { text: 'How are you', timestamp: 100 },
    { text: 'I am fine', timestamp: 200 },
    { text: 'Thank you', timestamp: 300 },
  ];

  console.log('Processing real-time speech results...\n');

  for (const speech of speechResults) {
    // Queue for batch processing (low latency)
    const translationPromise = engine.queueForBatch(
      speech.text,
      'en',
      'es'
    );

    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 50));

    const result = await translationPromise;
    console.log(`[${speech.timestamp}ms] ${speech.text} -> ${result.translatedText}`);
  }
  console.log();
}

// Example 12: Cache Management
async function cacheManagement() {
  console.log('=== Example 12: Cache Management ===\n');

  const engine = new TranslationEngine({
    googleApiKey: 'demo-key',
    enableCache: true,
    maxCacheSize: 3, // Small cache for demonstration
  });

  // Add translations to cache
  console.log('Adding translations to cache...');
  await engine.translate('One', 'en', 'es');
  await engine.translate('Two', 'en', 'es');
  await engine.translate('Three', 'en', 'es');

  console.log('Cache size:', engine.getCacheStats().size);

  // Add one more (will evict oldest)
  await engine.translate('Four', 'en', 'es');
  console.log('Cache size after adding fourth:', engine.getCacheStats().size);

  // Clear cache
  engine.clearCache();
  console.log('Cache size after clearing:', engine.getCacheStats().size);
  console.log();
}

// Run all examples
async function runAllExamples() {
  try {
    await basicTranslation();
    await batchTranslation();
    await queuedBatchTranslation();
    await cachingDemo();
    await engineFallback();
    await multipleLanguagePairs();
    await statisticsTracking();
    await errorHandling();
    await sameLanguageDetection();
    await configurationUpdates();
    await realtimeTranslationPipeline();
    await cacheManagement();

    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export for use in other files
export {
  basicTranslation,
  batchTranslation,
  queuedBatchTranslation,
  cachingDemo,
  engineFallback,
  multipleLanguagePairs,
  statisticsTracking,
  errorHandling,
  sameLanguageDetection,
  configurationUpdates,
  realtimeTranslationPipeline,
  cacheManagement,
  runAllExamples,
};

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
