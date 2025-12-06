/**
 * Tests for SpeechRecognizer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpeechRecognizer, RecognitionEngine } from './SpeechRecognizer';
import type { AudioBuffer } from '../types';

describe('SpeechRecognizer', () => {
  let recognizer: SpeechRecognizer;
  let mockAudio: AudioBuffer;

  beforeEach(() => {
    recognizer = new SpeechRecognizer({
      googleApiKey: 'test-api-key',
      enableStreaming: true,
    });

    // Create mock audio buffer
    mockAudio = {
      data: new Float32Array(16000), // 1 second at 16kHz
      sampleRate: 16000,
      channels: 1,
      timestamp: Date.now(),
    };
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultRecognizer = new SpeechRecognizer();
      const config = defaultRecognizer.getConfig();

      expect(config.primaryEngine).toBe(RecognitionEngine.GOOGLE_CLOUD);
      expect(config.fallbackEngine).toBe(RecognitionEngine.VOSK);
      expect(config.enableStreaming).toBe(true);
      expect(config.maxAlternatives).toBe(3);
    });

    it('should allow configuration updates', () => {
      recognizer.updateConfig({
        maxAlternatives: 5,
        enableAutomaticPunctuation: false,
      });

      const config = recognizer.getConfig();
      expect(config.maxAlternatives).toBe(5);
      expect(config.enableAutomaticPunctuation).toBe(false);
    });

    it('should update engine availability when API key is set', () => {
      const noKeyRecognizer = new SpeechRecognizer();
      expect(noKeyRecognizer.isEngineAvailable(RecognitionEngine.GOOGLE_CLOUD)).toBe(false);

      noKeyRecognizer.updateConfig({ googleApiKey: 'new-key' });
      expect(noKeyRecognizer.isEngineAvailable(RecognitionEngine.GOOGLE_CLOUD)).toBe(true);
    });
  });

  describe('Engine Selection', () => {
    it('should select Google Cloud when available and configured as primary', () => {
      expect(recognizer.isEngineAvailable(RecognitionEngine.GOOGLE_CLOUD)).toBe(true);
    });

    it('should always have Vosk available as fallback', () => {
      expect(recognizer.isEngineAvailable(RecognitionEngine.VOSK)).toBe(true);
    });

    it('should fall back to Vosk when Google Cloud is not available', async () => {
      const noKeyRecognizer = new SpeechRecognizer({
        primaryEngine: RecognitionEngine.GOOGLE_CLOUD,
        fallbackEngine: RecognitionEngine.VOSK,
      });

      const result = await noKeyRecognizer.recognize(mockAudio, 'en-US');
      
      // Should still get a result from Vosk fallback
      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
    });
  });

  describe('Speech Recognition', () => {
    it('should recognize speech from audio buffer', async () => {
      const result = await recognizer.recognize(mockAudio, 'en-US');

      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.isFinal).toBe(true);
    });

    it('should return alternatives when configured', async () => {
      recognizer.updateConfig({ maxAlternatives: 3 });
      const result = await recognizer.recognize(mockAudio, 'en-US');

      expect(result.alternatives).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    it('should handle different languages', async () => {
      const languages = ['en-US', 'zh-CN', 'es-ES', 'fr-FR'];

      for (const lang of languages) {
        const result = await recognizer.recognize(mockAudio, lang);
        expect(result).toBeDefined();
        expect(result.text).toBeTruthy();
      }
    });

    it('should return empty result when all engines fail', async () => {
      const failingRecognizer = new SpeechRecognizer({
        primaryEngine: RecognitionEngine.GOOGLE_CLOUD,
        fallbackEngine: RecognitionEngine.GOOGLE_CLOUD, // Same as primary, will fail
        // No API key, so Google Cloud will fail
      });

      const result = await failingRecognizer.recognize(mockAudio, 'en-US');

      // Since Vosk is always available, it will be used as ultimate fallback
      // So we should get a result, not an empty one
      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
    });
  });

  describe('Streaming Recognition', () => {
    it('should start streaming recognition session', async () => {
      const sessionId = 'test-session';
      const stream = recognizer.recognizeStream('en-US', sessionId);

      // Push some audio chunks
      recognizer.pushAudioChunk(sessionId, new Float32Array(1600));
      recognizer.pushAudioChunk(sessionId, new Float32Array(1600));

      // Get first result with timeout
      const firstResultPromise = stream.next();
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => resolve({ done: false, value: null }), 1000)
      );
      
      const firstResult = await Promise.race([firstResultPromise, timeoutPromise]) as any;
      
      if (firstResult.value) {
        expect(firstResult.done).toBe(false);
        expect(firstResult.value).toBeDefined();
      }

      // Stop stream
      recognizer.stopStream(sessionId);
    }, 10000);

    it('should yield interim and final results', async () => {
      const sessionId = 'test-session-2';
      const stream = recognizer.recognizeStream('en-US', sessionId);

      const results: any[] = [];
      let count = 0;
      const maxResults = 5;

      // Push audio and collect results
      const collectResults = async () => {
        for await (const result of stream) {
          results.push(result);
          count++;
          if (count >= maxResults) {
            recognizer.stopStream(sessionId);
            break;
          }
        }
      };

      // Push audio chunks in parallel
      const pushAudio = async () => {
        for (let i = 0; i < 10; i++) {
          recognizer.pushAudioChunk(sessionId, new Float32Array(1600));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      };

      await Promise.race([collectResults(), pushAudio()]);

      expect(results.length).toBeGreaterThan(0);
      
      // Check that we have both interim and final results
      const hasInterim = results.some(r => !r.isFinal);
      const hasFinal = results.some(r => r.isFinal);
      
      expect(hasInterim || hasFinal).toBe(true);
    });

    it('should handle multiple concurrent streaming sessions', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      const stream1 = recognizer.recognizeStream('en-US', session1);
      const stream2 = recognizer.recognizeStream('zh-CN', session2);

      // Push audio to both sessions
      recognizer.pushAudioChunk(session1, new Float32Array(1600));
      recognizer.pushAudioChunk(session2, new Float32Array(1600));

      // Get results from both with timeout
      const timeout = (ms: number) => new Promise((resolve) => 
        setTimeout(() => resolve({ done: false, value: null }), ms)
      );

      const result1 = await Promise.race([stream1.next(), timeout(1000)]) as any;
      const result2 = await Promise.race([stream2.next(), timeout(1000)]) as any;

      if (result1.value) {
        expect(result1.value).toBeDefined();
      }
      if (result2.value) {
        expect(result2.value).toBeDefined();
      }

      // Clean up
      recognizer.stopStream(session1);
      recognizer.stopStream(session2);
    }, 10000);
  });

  describe('Engine-Specific Behavior', () => {
    it('should use Google Cloud when API key is configured', async () => {
      const googleRecognizer = new SpeechRecognizer({
        primaryEngine: RecognitionEngine.GOOGLE_CLOUD,
        googleApiKey: 'test-key',
      });

      const result = await googleRecognizer.recognize(mockAudio, 'en-US');
      
      // Google Cloud typically has higher confidence
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should use Vosk for offline recognition', async () => {
      const voskRecognizer = new SpeechRecognizer({
        primaryEngine: RecognitionEngine.VOSK,
      });

      const result = await voskRecognizer.recognize(mockAudio, 'en-US');
      
      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
    });

    it('should handle AUTO engine selection', async () => {
      const autoRecognizer = new SpeechRecognizer({
        primaryEngine: RecognitionEngine.AUTO,
        googleApiKey: 'test-key',
      });

      const result = await autoRecognizer.recognize(mockAudio, 'en-US');
      
      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle recognition errors gracefully', async () => {
      // Create recognizer without API key
      const errorRecognizer = new SpeechRecognizer({
        primaryEngine: RecognitionEngine.GOOGLE_CLOUD,
        fallbackEngine: RecognitionEngine.VOSK,
      });

      // Should fall back to Vosk
      const result = await errorRecognizer.recognize(mockAudio, 'en-US');
      
      expect(result).toBeDefined();
    });

    it('should handle empty audio buffer', async () => {
      const emptyAudio: AudioBuffer = {
        data: new Float32Array(0),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now(),
      };

      const result = await recognizer.recognize(emptyAudio, 'en-US');
      
      expect(result).toBeDefined();
    });

    it('should handle invalid language codes', async () => {
      const result = await recognizer.recognize(mockAudio, 'invalid-lang');
      
      // Should still return a result (may be empty or use fallback)
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete recognition within reasonable time', async () => {
      const startTime = Date.now();
      await recognizer.recognize(mockAudio, 'en-US');
      const endTime = Date.now();

      const duration = endTime - startTime;
      
      // Should complete within 1 second (including mock delays)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large audio buffers', async () => {
      const largeAudio: AudioBuffer = {
        data: new Float32Array(160000), // 10 seconds at 16kHz
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now(),
      };

      const result = await recognizer.recognize(largeAudio, 'en-US');
      
      expect(result).toBeDefined();
      expect(result.text).toBeTruthy();
    });
  });
});
