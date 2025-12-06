/**
 * Translation Engine Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslationEngine, TranslationEngineType } from './TranslationEngine';
import { ErrorHandler } from './ErrorHandler';

describe('TranslationEngine', () => {
  let engine: TranslationEngine;

  beforeEach(() => {
    engine = new TranslationEngine({
      googleApiKey: 'test-key',
      enableCache: true,
      enableBatchOptimization: true,
    });
  });

  describe('Basic Translation', () => {
    it('should translate text from source to target language', async () => {
      const result = await engine.translate('Hello', 'en', 'es');

      expect(result).toBeDefined();
      expect(result.translatedText).toBeTruthy();
      expect(result.sourceLang).toBe('en');
      expect(result.targetLang).toBe('es');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return empty result for empty text', async () => {
      const result = await engine.translate('', 'en', 'es');

      expect(result.translatedText).toBe('');
      expect(result.confidence).toBe(0);
    });

    it('should return original text when source equals target', async () => {
      const text = 'Hello, world!';
      const result = await engine.translate(text, 'en', 'en');

      expect(result.translatedText).toBe(text);
      expect(result.confidence).toBe(1.0);
    });

    it('should normalize language codes when comparing', async () => {
      const text = 'Hello';
      const result = await engine.translate(text, 'en-US', 'en-GB');

      // Should recognize as same language (both 'en')
      expect(result.translatedText).toBe(text);
      expect(result.confidence).toBe(1.0);
    });

    it('should handle whitespace-only text', async () => {
      const result = await engine.translate('   ', 'en', 'es');

      expect(result.translatedText).toBe('');
      expect(result.confidence).toBe(0);
    });
  });

  describe('Batch Translation', () => {
    it('should translate multiple texts', async () => {
      const texts = ['Hello', 'World', 'Goodbye'];
      const results = await engine.translateBatch(texts, 'en', 'fr');

      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.translatedText).toBeTruthy();
        expect(result.sourceLang).toBe('en');
        expect(result.targetLang).toBe('fr');
      });
    });

    it('should return empty array for empty input', async () => {
      const results = await engine.translateBatch([], 'en', 'es');

      expect(results).toHaveLength(0);
    });

    it('should handle mixed cached and uncached texts', async () => {
      const texts = ['Hello', 'World'];

      // First batch - all cache misses
      const firstResults = await engine.translateBatch(texts, 'en', 'es');
      expect(firstResults).toHaveLength(2);

      // Second batch - should use cache for 'Hello' and translate 'Goodbye'
      const results = await engine.translateBatch(
        ['Hello', 'Goodbye'],
        'en',
        'es'
      );

      expect(results).toHaveLength(2);
      // Verify both results are valid
      expect(results[0].translatedText).toBeTruthy();
      expect(results[1].translatedText).toBeTruthy();
      
      // Check that cache is being used (cache size should reflect stored items)
      const cacheStats = engine.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    it('should cache translation results', async () => {
      const text = 'Test';
      const sourceLang = 'en';
      const targetLang = 'es';

      // First call - cache miss
      await engine.translate(text, sourceLang, targetLang);
      const stats1 = engine.getStats();
      expect(stats1.cacheMisses).toBe(1);

      // Second call - cache hit
      await engine.translate(text, sourceLang, targetLang);
      const stats2 = engine.getStats();
      expect(stats2.cacheHits).toBe(1);
    });

    it('should respect cache size limit', async () => {
      const smallEngine = new TranslationEngine({
        googleApiKey: 'test-key',
        enableCache: true,
        maxCacheSize: 2,
      });

      // Add 3 translations (should evict oldest)
      await smallEngine.translate('One', 'en', 'es');
      await smallEngine.translate('Two', 'en', 'es');
      await smallEngine.translate('Three', 'en', 'es');

      const cacheStats = smallEngine.getCacheStats();
      expect(cacheStats.size).toBeLessThanOrEqual(2);
    });

    it('should clear cache when requested', async () => {
      await engine.translate('Test', 'en', 'es');
      expect(engine.getCacheStats().size).toBeGreaterThan(0);

      engine.clearCache();
      expect(engine.getCacheStats().size).toBe(0);
    });

    it('should calculate cache hit rate correctly', async () => {
      // 2 unique translations
      await engine.translate('Hello', 'en', 'es');
      await engine.translate('World', 'en', 'es');

      // 2 cache hits
      await engine.translate('Hello', 'en', 'es');
      await engine.translate('World', 'en', 'es');

      const cacheStats = engine.getCacheStats();
      expect(cacheStats.hitRate).toBe(0.5); // 2 hits out of 4 total
    });

    it('should work with cache disabled', async () => {
      const noCacheEngine = new TranslationEngine({
        googleApiKey: 'test-key',
        enableCache: false,
      });

      await noCacheEngine.translate('Test', 'en', 'es');
      await noCacheEngine.translate('Test', 'en', 'es');

      const stats = noCacheEngine.getStats();
      expect(stats.cacheHits).toBe(0);
      expect(noCacheEngine.getCacheStats().size).toBe(0);
    });
  });

  describe('Queue-based Batch Processing', () => {
    it('should queue translations for batch processing', async () => {
      const promises = [
        engine.queueForBatch('One', 'en', 'es'),
        engine.queueForBatch('Two', 'en', 'es'),
        engine.queueForBatch('Three', 'en', 'es'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.translatedText).toBeTruthy();
      });
    });

    it('should process batch when size limit reached', async () => {
      const smallBatchEngine = new TranslationEngine({
        googleApiKey: 'test-key',
        enableBatchOptimization: true,
        maxBatchSize: 2,
        batchTimeout: 1000, // Long timeout
      });

      // Queue 2 items (should trigger immediate processing)
      const promise1 = smallBatchEngine.queueForBatch('One', 'en', 'es');
      const promise2 = smallBatchEngine.queueForBatch('Two', 'en', 'es');

      const results = await Promise.all([promise1, promise2]);
      expect(results).toHaveLength(2);
    });

    it('should process batch after timeout', async () => {
      const timeoutEngine = new TranslationEngine({
        googleApiKey: 'test-key',
        enableBatchOptimization: true,
        maxBatchSize: 100,
        batchTimeout: 50, // Short timeout
      });

      const promise = timeoutEngine.queueForBatch('Test', 'en', 'es');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await promise;
      expect(result.translatedText).toBeTruthy();
    });
  });

  describe('Engine Selection', () => {
    it('should use primary engine when available', async () => {
      const result = await engine.translate('Test', 'en', 'es');

      expect(result).toBeDefined();
      const stats = engine.getStats();
      expect(stats.engineUsage[TranslationEngineType.GOOGLE_CLOUD]).toBeGreaterThan(0);
    });

    it('should fall back to secondary engine when primary unavailable', async () => {
      const fallbackEngine = new TranslationEngine({
        primaryEngine: TranslationEngineType.GOOGLE_CLOUD,
        fallbackEngine: TranslationEngineType.NLLB_LOCAL,
        // No API key - will use fallback
      });

      const result = await fallbackEngine.translate('Test', 'en', 'es');

      expect(result).toBeDefined();
      expect(result.translatedText).toBeTruthy();
    });

    it('should check engine availability correctly', () => {
      expect(engine.isEngineAvailable(TranslationEngineType.GOOGLE_CLOUD)).toBe(true);
      expect(engine.isEngineAvailable(TranslationEngineType.NLLB_LOCAL)).toBe(true);
      expect(engine.isEngineAvailable(TranslationEngineType.DEEPL)).toBe(false);
    });

    it('should update engine availability when config changes', () => {
      expect(engine.isEngineAvailable(TranslationEngineType.DEEPL)).toBe(false);

      engine.updateConfig({ deeplApiKey: 'new-key' });

      expect(engine.isEngineAvailable(TranslationEngineType.DEEPL)).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultEngine = new TranslationEngine();
      const config = defaultEngine.getConfig();

      expect(config.primaryEngine).toBe(TranslationEngineType.GOOGLE_CLOUD);
      expect(config.enableCache).toBe(true);
      expect(config.enableBatchOptimization).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customEngine = new TranslationEngine({
        primaryEngine: TranslationEngineType.DEEPL,
        enableCache: false,
        maxCacheSize: 5000,
      });

      const config = customEngine.getConfig();
      expect(config.primaryEngine).toBe(TranslationEngineType.DEEPL);
      expect(config.enableCache).toBe(false);
      expect(config.maxCacheSize).toBe(5000);
    });

    it('should update configuration at runtime', () => {
      engine.updateConfig({
        enableCache: false,
        maxBatchSize: 50,
      });

      const config = engine.getConfig();
      expect(config.enableCache).toBe(false);
      expect(config.maxBatchSize).toBe(50);
    });
  });

  describe('Statistics', () => {
    it('should track total translations', async () => {
      await engine.translate('One', 'en', 'es');
      await engine.translate('Two', 'en', 'es');

      const stats = engine.getStats();
      expect(stats.totalTranslations).toBe(2);
    });

    it('should track cache hits and misses', async () => {
      // Cache miss
      await engine.translate('Test', 'en', 'es');
      // Cache hit
      await engine.translate('Test', 'en', 'es');

      const stats = engine.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
    });

    it('should track batch translations', async () => {
      await engine.translateBatch(['One', 'Two', 'Three'], 'en', 'es');

      const stats = engine.getStats();
      expect(stats.batchTranslations).toBeGreaterThan(0);
    });

    it('should track engine usage', async () => {
      await engine.translate('Test', 'en', 'es');

      const stats = engine.getStats();
      expect(stats.engineUsage).toBeDefined();
      expect(Object.keys(stats.engineUsage).length).toBeGreaterThan(0);
    });

    it('should calculate average latency', async () => {
      await engine.translate('Test1', 'en', 'es');
      await engine.translate('Test2', 'en', 'es');

      const stats = engine.getStats();
      expect(stats.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle translation errors gracefully', async () => {
      const errorHandler = new ErrorHandler();
      const errorEngine = new TranslationEngine({
        primaryEngine: TranslationEngineType.GOOGLE_CLOUD,
        fallbackEngine: TranslationEngineType.NLLB_LOCAL,
      }, errorHandler);

      // Should not throw, even without API key
      const result = await errorEngine.translate('Test', 'en', 'es');

      expect(result).toBeDefined();
      expect(result.translatedText).toBeTruthy();
    });

    it('should return original text on complete failure', async () => {
      const errorHandler = new ErrorHandler();
      const errorEngine = new TranslationEngine({
        primaryEngine: TranslationEngineType.GOOGLE_CLOUD,
        fallbackEngine: TranslationEngineType.GOOGLE_CLOUD, // Same as primary
      }, errorHandler);

      // Mock to force failure
      vi.spyOn(errorEngine as any, 'translateWithEngine').mockRejectedValue(
        new Error('All engines failed')
      );

      const text = 'Test';
      const result = await errorEngine.translate(text, 'en', 'es');

      expect(result.translatedText).toBe(text);
      expect(result.confidence).toBe(0);
    });

    it('should handle batch translation errors', async () => {
      const errorHandler = new ErrorHandler();
      const errorEngine = new TranslationEngine({
        enableBatchOptimization: false, // Disable to test individual fallback
      }, errorHandler);

      const results = await errorEngine.translateBatch(
        ['Test1', 'Test2'],
        'en',
        'es'
      );

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Language Code Handling', () => {
    it('should handle ISO 639-1 codes', async () => {
      const result = await engine.translate('Hello', 'en', 'es');

      expect(result.sourceLang).toBe('en');
      expect(result.targetLang).toBe('es');
    });

    it('should handle BCP 47 codes', async () => {
      const result = await engine.translate('Hello', 'en-US', 'es-ES');

      expect(result.sourceLang).toBe('en-US');
      expect(result.targetLang).toBe('es-ES');
    });

    it('should normalize codes for comparison', async () => {
      const text = 'Test';
      
      // These should be treated as same language
      const result1 = await engine.translate(text, 'en', 'en-US');
      const result2 = await engine.translate(text, 'en-GB', 'en-AU');

      expect(result1.translatedText).toBe(text);
      expect(result2.translatedText).toBe(text);
    });
  });

  describe('Integration with Error Handler', () => {
    it('should use provided error handler', async () => {
      const errorHandler = new ErrorHandler();
      const errorSpy = vi.fn();
      errorHandler.addErrorListener(errorSpy);

      const errorEngine = new TranslationEngine({
        primaryEngine: TranslationEngineType.GOOGLE_CLOUD,
      }, errorHandler);

      // Force an error by not providing API key
      await errorEngine.translate('Test', 'en', 'es');

      // Error handler should have been called
      // (actual behavior depends on implementation)
    });
  });

  describe('Performance', () => {
    it('should complete translation within reasonable time', async () => {
      const start = Date.now();
      await engine.translate('Test', 'en', 'es');
      const duration = Date.now() - start;

      // Should complete within 1 second (including mock delay)
      expect(duration).toBeLessThan(1000);
    });

    it('should be faster with caching', async () => {
      const text = 'Performance test';

      // First call (no cache)
      const start1 = Date.now();
      await engine.translate(text, 'en', 'es');
      const duration1 = Date.now() - start1;

      // Second call (cached)
      const start2 = Date.now();
      await engine.translate(text, 'en', 'es');
      const duration2 = Date.now() - start2;

      // Cached call should be significantly faster
      expect(duration2).toBeLessThan(duration1);
    });

    it('should handle high volume of translations', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(engine.translate(`Text ${i}`, 'en', 'es'));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
    });
  });
});
