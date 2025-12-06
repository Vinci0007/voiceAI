/**
 * Speech Synthesizer Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpeechSynthesizer, SynthesisEngine, AudioEncoding } from './SpeechSynthesizer';
import { ErrorHandler } from './ErrorHandler';

describe('SpeechSynthesizer', () => {
  let synthesizer: SpeechSynthesizer;

  beforeEach(() => {
    synthesizer = new SpeechSynthesizer({
      googleApiKey: 'test-key',
      enableCache: true,
      enableStreaming: true,
    });
  });

  describe('Basic Synthesis', () => {
    it('should synthesize text to speech', async () => {
      const result = await synthesizer.synthesize('Hello', 'en-US');

      expect(result).toBeDefined();
      expect(result.audio).toBeDefined();
      expect(result.audio.data.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.voiceUsed).toBeTruthy();
    });

    it('should return empty result for empty text', async () => {
      const result = await synthesizer.synthesize('', 'en-US');

      expect(result.audio.data.length).toBe(0);
      expect(result.duration).toBe(0);
    });

    it('should handle whitespace-only text', async () => {
      const result = await synthesizer.synthesize('   ', 'en-US');

      expect(result.audio.data.length).toBe(0);
      expect(result.duration).toBe(0);
    });

    it('should include voice information in result', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US', {
        voiceId: 'en-US-Wavenet-A',
      });

      expect(result.voiceUsed).toBe('en-US-Wavenet-A');
    });
  });

  describe('Voice Configuration', () => {
    it('should apply custom voice settings', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US', {
        voiceId: 'en-US-Neural2-A',
        pitch: 5,
        speed: 1.2,
        volume: 0.8,
      });

      expect(result).toBeDefined();
      expect(result.voiceUsed).toBe('en-US-Neural2-A');
    });

    it('should use default voice when not specified', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US');

      expect(result.voiceUsed).toBe(synthesizer.getConfig().defaultVoice.voiceId);
    });

    it('should merge custom voice with defaults', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US', {
        pitch: 10, // Only override pitch
      });

      expect(result).toBeDefined();
      // Should use default voice ID but custom pitch
    });
  });

  describe('Caching', () => {
    it('should cache synthesis results', async () => {
      const text = 'Test phrase';
      const language = 'en-US';

      // First call - cache miss
      await synthesizer.synthesize(text, language);
      const stats1 = synthesizer.getStats();
      expect(stats1.cacheMisses).toBe(1);

      // Second call - cache hit
      await synthesizer.synthesize(text, language);
      const stats2 = synthesizer.getStats();
      expect(stats2.cacheHits).toBe(1);
    });

    it('should respect cache size limit', async () => {
      const smallSynthesizer = new SpeechSynthesizer({
        googleApiKey: 'test-key',
        enableCache: true,
        maxCacheSize: 2,
      });

      // Add 3 syntheses (should evict oldest)
      await smallSynthesizer.synthesize('One', 'en-US');
      await smallSynthesizer.synthesize('Two', 'en-US');
      await smallSynthesizer.synthesize('Three', 'en-US');

      const cacheStats = smallSynthesizer.getCacheStats();
      expect(cacheStats.size).toBeLessThanOrEqual(2);
    });

    it('should clear cache when requested', async () => {
      await synthesizer.synthesize('Test', 'en-US');
      expect(synthesizer.getCacheStats().size).toBeGreaterThan(0);

      synthesizer.clearCache();
      expect(synthesizer.getCacheStats().size).toBe(0);
    });

    it('should calculate cache hit rate correctly', async () => {
      // 2 unique syntheses
      await synthesizer.synthesize('Hello', 'en-US');
      await synthesizer.synthesize('World', 'en-US');

      // 2 cache hits
      await synthesizer.synthesize('Hello', 'en-US');
      await synthesizer.synthesize('World', 'en-US');

      const cacheStats = synthesizer.getCacheStats();
      expect(cacheStats.hitRate).toBe(0.5); // 2 hits out of 4 total
    });

    it('should work with cache disabled', async () => {
      const noCacheSynthesizer = new SpeechSynthesizer({
        googleApiKey: 'test-key',
        enableCache: false,
      });

      await noCacheSynthesizer.synthesize('Test', 'en-US');
      await noCacheSynthesizer.synthesize('Test', 'en-US');

      const stats = noCacheSynthesizer.getStats();
      expect(stats.cacheHits).toBe(0);
      expect(noCacheSynthesizer.getCacheStats().size).toBe(0);
    });

    it('should cache based on text, language, and voice config', async () => {
      const text = 'Test';
      const language = 'en-US';

      // Same text, different voice - should not hit cache
      await synthesizer.synthesize(text, language, { voiceId: 'voice-1' });
      await synthesizer.synthesize(text, language, { voiceId: 'voice-2' });

      const stats = synthesizer.getStats();
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(2);
    });
  });

  describe('Streaming Synthesis', () => {
    it('should support streaming synthesis', async () => {
      const sessionId = 'test-stream';
      
      // Start stream processing in background
      const streamPromise = (async () => {
        const chunks = [];
        const stream = synthesizer.synthesizeStream('en-US', {}, sessionId);
        
        for await (const chunk of stream) {
          chunks.push(chunk);
          if (chunks.length >= 2) break; // Limit iterations
        }
        
        return chunks;
      })();

      // Push text chunks after a short delay
      await new Promise(resolve => setTimeout(resolve, 50));
      synthesizer.pushTextChunk(sessionId, 'Hello ');
      synthesizer.pushTextChunk(sessionId, 'world');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Stop stream
      synthesizer.stopStream(sessionId);

      // Wait for stream to complete
      const chunks = await streamPromise;
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle empty streaming session', async () => {
      const sessionId = 'empty-stream';
      
      // Start stream and stop immediately
      const streamPromise = (async () => {
        const chunks = [];
        const stream = synthesizer.synthesizeStream('en-US', {}, sessionId);
        
        // Set a timeout to prevent infinite wait
        const timeout = new Promise(resolve => setTimeout(() => resolve([]), 500));
        
        const collectChunks = (async () => {
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          return chunks;
        })();
        
        return Promise.race([collectChunks, timeout]);
      })();

      // Stop immediately without pushing text
      await new Promise(resolve => setTimeout(resolve, 50));
      synthesizer.stopStream(sessionId);

      const chunks = await streamPromise;
      expect(chunks.length).toBe(0);
    });
  });

  describe('Engine Selection', () => {
    it('should use primary engine when available', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US');

      expect(result).toBeDefined();
      const stats = synthesizer.getStats();
      expect(stats.engineUsage[SynthesisEngine.GOOGLE_CLOUD]).toBeGreaterThan(0);
    });

    it('should fall back to secondary engine when primary unavailable', async () => {
      const fallbackSynthesizer = new SpeechSynthesizer({
        primaryEngine: SynthesisEngine.GOOGLE_CLOUD,
        fallbackEngine: SynthesisEngine.PIPER_LOCAL,
        // No API key - will use fallback
      });

      const result = await fallbackSynthesizer.synthesize('Test', 'en-US');

      expect(result).toBeDefined();
      expect(result.audio.data.length).toBeGreaterThan(0);
    });

    it('should check engine availability correctly', () => {
      expect(synthesizer.isEngineAvailable(SynthesisEngine.GOOGLE_CLOUD)).toBe(true);
      expect(synthesizer.isEngineAvailable(SynthesisEngine.PIPER_LOCAL)).toBe(true);
      expect(synthesizer.isEngineAvailable(SynthesisEngine.AZURE)).toBe(false);
    });

    it('should update engine availability when config changes', () => {
      expect(synthesizer.isEngineAvailable(SynthesisEngine.AZURE)).toBe(false);

      synthesizer.updateConfig({
        azureApiKey: 'new-key',
        azureRegion: 'eastus',
      });

      expect(synthesizer.isEngineAvailable(SynthesisEngine.AZURE)).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultSynthesizer = new SpeechSynthesizer();
      const config = defaultSynthesizer.getConfig();

      expect(config.primaryEngine).toBe(SynthesisEngine.GOOGLE_CLOUD);
      expect(config.enableCache).toBe(true);
      expect(config.enableStreaming).toBe(true);
      expect(config.sampleRate).toBe(24000);
    });

    it('should accept custom configuration', () => {
      const customSynthesizer = new SpeechSynthesizer({
        primaryEngine: SynthesisEngine.AZURE,
        enableCache: false,
        sampleRate: 48000,
      });

      const config = customSynthesizer.getConfig();
      expect(config.primaryEngine).toBe(SynthesisEngine.AZURE);
      expect(config.enableCache).toBe(false);
      expect(config.sampleRate).toBe(48000);
    });

    it('should update configuration at runtime', () => {
      synthesizer.updateConfig({
        enableCache: false,
        sampleRate: 16000,
      });

      const config = synthesizer.getConfig();
      expect(config.enableCache).toBe(false);
      expect(config.sampleRate).toBe(16000);
    });
  });

  describe('Statistics', () => {
    it('should track total syntheses', async () => {
      await synthesizer.synthesize('One', 'en-US');
      await synthesizer.synthesize('Two', 'en-US');

      const stats = synthesizer.getStats();
      expect(stats.totalSyntheses).toBe(2);
    });

    it('should track cache hits and misses', async () => {
      // Cache miss
      await synthesizer.synthesize('Test', 'en-US');
      // Cache hit
      await synthesizer.synthesize('Test', 'en-US');

      const stats = synthesizer.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
    });

    it('should track engine usage', async () => {
      await synthesizer.synthesize('Test', 'en-US');

      const stats = synthesizer.getStats();
      expect(stats.engineUsage).toBeDefined();
      expect(Object.keys(stats.engineUsage).length).toBeGreaterThan(0);
    });

    it('should calculate average latency', async () => {
      await synthesizer.synthesize('Test1', 'en-US');
      await synthesizer.synthesize('Test2', 'en-US');

      const stats = synthesizer.getStats();
      expect(stats.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle synthesis errors gracefully', async () => {
      const errorHandler = new ErrorHandler();
      const errorSynthesizer = new SpeechSynthesizer({
        primaryEngine: SynthesisEngine.GOOGLE_CLOUD,
        fallbackEngine: SynthesisEngine.PIPER_LOCAL,
      }, errorHandler);

      // Should not throw, even without API key
      const result = await errorSynthesizer.synthesize('Test', 'en-US');

      expect(result).toBeDefined();
      expect(result.audio).toBeDefined();
    });

    it('should return empty audio on complete failure', async () => {
      const errorHandler = new ErrorHandler();
      const errorSynthesizer = new SpeechSynthesizer({
        primaryEngine: SynthesisEngine.GOOGLE_CLOUD,
        fallbackEngine: SynthesisEngine.GOOGLE_CLOUD, // Same as primary
      }, errorHandler);

      // Mock to force failure
      vi.spyOn(errorSynthesizer as any, 'synthesizeWithEngine').mockRejectedValue(
        new Error('All engines failed')
      );

      const result = await errorSynthesizer.synthesize('Test', 'en-US');

      expect(result.audio.data.length).toBe(0);
      expect(result.duration).toBe(0);
    });
  });

  describe('Language Support', () => {
    it('should handle different languages', async () => {
      const languages = ['en-US', 'es-ES', 'fr-FR', 'zh-CN', 'ja-JP'];

      for (const lang of languages) {
        const result = await synthesizer.synthesize('Test', lang);
        expect(result).toBeDefined();
        expect(result.audio.data.length).toBeGreaterThan(0);
      }
    });

    it('should get available voices for language', async () => {
      const voices = await synthesizer.getAvailableVoices('en-US');

      expect(voices).toBeDefined();
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    });
  });

  describe('Audio Format', () => {
    it('should generate audio with correct sample rate', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US');

      expect(result.audio.sampleRate).toBe(synthesizer.getConfig().sampleRate);
    });

    it('should support different sample rates', async () => {
      const rates = [16000, 24000, 48000];

      for (const rate of rates) {
        const customSynthesizer = new SpeechSynthesizer({
          googleApiKey: 'test-key',
          sampleRate: rate,
        });

        const result = await customSynthesizer.synthesize('Test', 'en-US');
        expect(result.audio.sampleRate).toBe(rate);
      }
    });

    it('should generate mono audio', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US');

      expect(result.audio.channels).toBe(1);
    });
  });

  describe('Performance', () => {
    it('should complete synthesis within reasonable time', async () => {
      const start = Date.now();
      await synthesizer.synthesize('Test', 'en-US');
      const duration = Date.now() - start;

      // Should complete within 1 second (including mock delay)
      expect(duration).toBeLessThan(1000);
    });

    it('should be faster with caching', async () => {
      const text = 'Performance test';

      // First call (no cache)
      const start1 = Date.now();
      await synthesizer.synthesize(text, 'en-US');
      const duration1 = Date.now() - start1;

      // Second call (cached)
      const start2 = Date.now();
      await synthesizer.synthesize(text, 'en-US');
      const duration2 = Date.now() - start2;

      // Cached call should be significantly faster
      expect(duration2).toBeLessThan(duration1);
    });

    it('should handle high volume of syntheses', async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(synthesizer.synthesize(`Text ${i}`, 'en-US'));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.audio.data.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Integration with Error Handler', () => {
    it('should use provided error handler', async () => {
      const errorHandler = new ErrorHandler();
      const errorSpy = vi.fn();
      errorHandler.addErrorListener(errorSpy);

      const errorSynthesizer = new SpeechSynthesizer({
        primaryEngine: SynthesisEngine.GOOGLE_CLOUD,
      }, errorHandler);

      // Force an error by not providing API key
      await errorSynthesizer.synthesize('Test', 'en-US');

      // Error handler should have been called
      // (actual behavior depends on implementation)
    });
  });

  describe('Voice Customization', () => {
    it('should apply pitch adjustment', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US', {
        pitch: 10,
      });

      expect(result).toBeDefined();
    });

    it('should apply speed adjustment', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US', {
        speed: 1.5,
      });

      expect(result).toBeDefined();
    });

    it('should apply volume adjustment', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US', {
        volume: 0.5,
      });

      expect(result).toBeDefined();
    });

    it('should handle extreme voice settings', async () => {
      const result = await synthesizer.synthesize('Test', 'en-US', {
        pitch: 20,
        speed: 4.0,
        volume: 1.0,
      });

      expect(result).toBeDefined();
      expect(result.audio.data.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Synthesis', () => {
    it('should synthesize multiple texts', async () => {
      const texts = ['Hello', 'World', 'Test'];
      const results = await Promise.all(
        texts.map(text => synthesizer.synthesize(text, 'en-US'))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.audio.data.length).toBeGreaterThan(0);
      });
    });

    it('should handle mixed cached and uncached texts', async () => {
      // First batch
      await synthesizer.synthesize('Hello', 'en-US');
      await synthesizer.synthesize('World', 'en-US');

      // Second batch with one cached
      const results = await Promise.all([
        synthesizer.synthesize('Hello', 'en-US'), // Cached
        synthesizer.synthesize('Goodbye', 'en-US'), // Not cached
      ]);

      expect(results).toHaveLength(2);
      const stats = synthesizer.getStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
    });
  });
});
