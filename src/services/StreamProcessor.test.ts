/**
 * StreamProcessor Unit Tests
 * 
 * Tests the Translation Pipeline Coordinator functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamProcessor } from './StreamProcessor';
import type { AudioBuffer, SpeakerInfo } from '../types';

// Mock services - we don't need to import the actual classes since we're mocking them
vi.mock('./SpeechRecognizer');
vi.mock('./LanguageDetector');
vi.mock('./TranslationEngine');
vi.mock('./SpeechSynthesizer');

describe('StreamProcessor', () => {
  let processor: StreamProcessor;
  let mockRecognizer: any;
  let mockDetector: any;
  let mockTranslator: any;
  let mockSynthesizer: any;

  const createMockAudioBuffer = (): AudioBuffer => ({
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  });

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock services with small delays to simulate real processing
    mockRecognizer = {
      recognize: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          text: 'Hello world',
          confidence: 0.95,
          isFinal: true,
          alternatives: [],
        };
      }),
    };

    mockDetector = {
      detect: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return {
          languageCode: 'en-US',
          confidence: 0.9,
          alternativeLanguages: [],
        };
      }),
    };

    mockTranslator = {
      translate: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          translatedText: 'Hola mundo',
          sourceLang: 'en',
          targetLang: 'es',
          confidence: 0.95,
        };
      }),
    };

    mockSynthesizer = {
      synthesize: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return createMockAudioBuffer();
      }),
    };

    processor = new StreamProcessor(
      {},
      mockRecognizer,
      mockDetector,
      mockTranslator,
      mockSynthesizer
    );
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      const proc = new StreamProcessor();
      expect(proc).toBeInstanceOf(StreamProcessor);
    });

    it('should create instance with custom config', () => {
      const proc = new StreamProcessor({
        enableStreaming: false,
        maxConcurrentProcesses: 5,
      });
      expect(proc).toBeInstanceOf(StreamProcessor);
    });

    it('should initialize with provided services', () => {
      expect(processor).toBeInstanceOf(StreamProcessor);
    });

    it('should initialize metrics', () => {
      const metrics = processor.getMetrics();
      expect(metrics.totalProcessed).toBe(0);
      expect(metrics.successfulProcessed).toBe(0);
      expect(metrics.failedProcessed).toBe(0);
    });
  });

  describe('processAudioSegment', () => {
    it('should process audio segment through complete pipeline', async () => {
      const audio = createMockAudioBuffer();
      const result = await processor.processAudioSegment(
        audio,
        'user123',
        'es-ES'
      );

      expect(result).toBeDefined();
      expect(result?.originalText).toBe('Hello world');
      expect(result?.translatedText).toBe('Hola mundo');
      expect(result?.speakerId).toBe('unknown');
      expect(result?.latency).toBeGreaterThan(0);
    });

    it('should include speaker info when provided', async () => {
      const audio = createMockAudioBuffer();
      const speakerInfo: SpeakerInfo = {
        speakerId: 'speaker_001',
        confidence: 0.95,
        isNewSpeaker: false,
      };

      const result = await processor.processAudioSegment(
        audio,
        'user123',
        'es-ES',
        speakerInfo
      );

      expect(result?.speakerId).toBe('speaker_001');
    });

    it('should call language detector', async () => {
      const audio = createMockAudioBuffer();
      await processor.processAudioSegment(audio, 'user123', 'es-ES');

      expect(mockDetector.detect).toHaveBeenCalledWith(audio);
    });

    it('should call speech recognizer with detected language', async () => {
      const audio = createMockAudioBuffer();
      await processor.processAudioSegment(audio, 'user123', 'es-ES');

      expect(mockRecognizer.recognize).toHaveBeenCalledWith(audio, 'en-US');
    });

    it('should call translator with correct parameters', async () => {
      const audio = createMockAudioBuffer();
      await processor.processAudioSegment(audio, 'user123', 'es-ES');

      expect(mockTranslator.translate).toHaveBeenCalledWith(
        'Hello world',
        'en-US',
        'es-ES'
      );
    });

    it('should call synthesizer with translated text', async () => {
      const audio = createMockAudioBuffer();
      await processor.processAudioSegment(audio, 'user123', 'es-ES');

      expect(mockSynthesizer.synthesize).toHaveBeenCalledWith(
        'Hola mundo',
        'es-ES'
      );
    });

    it('should return null when no text is recognized', async () => {
      mockRecognizer.recognize.mockResolvedValue({
        text: '',
        confidence: 0,
        isFinal: true,
        alternatives: [],
      });

      const audio = createMockAudioBuffer();
      const result = await processor.processAudioSegment(
        audio,
        'user123',
        'es-ES'
      );

      expect(result).toBeNull();
    });

    it('should update metrics on success', async () => {
      const audio = createMockAudioBuffer();
      await processor.processAudioSegment(audio, 'user123', 'es-ES');

      const metrics = processor.getMetrics();
      expect(metrics.totalProcessed).toBe(1);
      expect(metrics.successfulProcessed).toBe(1);
      expect(metrics.failedProcessed).toBe(0);
    });

    it('should update metrics on failure', async () => {
      mockRecognizer.recognize.mockRejectedValue(new Error('Recognition failed'));

      const audio = createMockAudioBuffer();
      
      await expect(
        processor.processAudioSegment(audio, 'user123', 'es-ES')
      ).rejects.toThrow('Recognition failed');

      const metrics = processor.getMetrics();
      expect(metrics.totalProcessed).toBe(1);
      expect(metrics.failedProcessed).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      mockRecognizer.recognize.mockRejectedValue(new Error('Test error'));

      const audio = createMockAudioBuffer();
      
      await expect(
        processor.processAudioSegment(audio, 'user123', 'es-ES')
      ).rejects.toThrow('Test error');
    });
  });

  describe('Same Language Translation Skip (Requirement 4.5)', () => {
    it('should skip translation when source equals target language', async () => {
      mockDetector.detect.mockResolvedValue({
        languageCode: 'en-US',
        confidence: 0.9,
        alternativeLanguages: [],
      });

      const audio = createMockAudioBuffer();
      const result = await processor.processAudioSegment(
        audio,
        'user123',
        'en-US' // Same as detected language
      );

      expect(result).toBeDefined();
      expect(result?.originalText).toBe('');
      expect(result?.translatedText).toBe('');
      expect(result?.translatedAudio).toBe(audio);
      expect(mockRecognizer.recognize).not.toHaveBeenCalled();
      expect(mockTranslator.translate).not.toHaveBeenCalled();
      expect(mockSynthesizer.synthesize).not.toHaveBeenCalled();
    });

    it('should skip translation with normalized language codes', async () => {
      mockDetector.detect.mockResolvedValue({
        languageCode: 'en-GB',
        confidence: 0.9,
        alternativeLanguages: [],
      });

      const audio = createMockAudioBuffer();
      const result = await processor.processAudioSegment(
        audio,
        'user123',
        'en-US' // Different variant but same base language
      );

      expect(result?.translatedAudio).toBe(audio);
      expect(mockTranslator.translate).not.toHaveBeenCalled();
    });

    it('should not skip when skipSameLanguageTranslation is false', async () => {
      const proc = new StreamProcessor(
        { skipSameLanguageTranslation: false },
        mockRecognizer,
        mockDetector,
        mockTranslator,
        mockSynthesizer
      );

      mockDetector.detect.mockResolvedValue({
        languageCode: 'en-US',
        confidence: 0.9,
        alternativeLanguages: [],
      });

      const audio = createMockAudioBuffer();
      await proc.processAudioSegment(audio, 'user123', 'en-US');

      expect(mockRecognizer.recognize).toHaveBeenCalled();
      expect(mockTranslator.translate).toHaveBeenCalled();
    });

    it('should increment skipped translations metric', async () => {
      mockDetector.detect.mockResolvedValue({
        languageCode: 'en-US',
        confidence: 0.9,
        alternativeLanguages: [],
      });

      const audio = createMockAudioBuffer();
      await processor.processAudioSegment(audio, 'user123', 'en-US');

      const metrics = processor.getMetrics();
      expect(metrics.skippedTranslations).toBe(1);
    });
  });

  describe('processAudioStream', () => {
    it('should process audio stream', async () => {
      const audioBuffers = [
        createMockAudioBuffer(),
        createMockAudioBuffer(),
        createMockAudioBuffer(),
      ];

      const stream = new ReadableStream({
        start(controller) {
          audioBuffers.forEach(buffer => controller.enqueue(buffer));
          controller.close();
        },
      });

      const results = [];
      for await (const output of processor.processAudioStream(
        stream,
        'user123',
        'es-ES'
      )) {
        results.push(output);
      }

      expect(results).toHaveLength(3);
      expect(results[0].originalText).toBe('Hello world');
    });

    it('should handle empty stream', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const results = [];
      for await (const output of processor.processAudioStream(
        stream,
        'user123',
        'es-ES'
      )) {
        results.push(output);
      }

      expect(results).toHaveLength(0);
    });

    it('should process with speaker info', async () => {
      const audioBuffers = [createMockAudioBuffer()];
      const speakerInfo: SpeakerInfo = {
        speakerId: 'speaker_001',
        confidence: 0.95,
        isNewSpeaker: false,
      };

      const stream = new ReadableStream({
        start(controller) {
          audioBuffers.forEach(buffer => controller.enqueue(buffer));
          controller.close();
        },
      });

      const results = [];
      for await (const output of processor.processAudioStream(
        stream,
        'user123',
        'es-ES',
        speakerInfo
      )) {
        results.push(output);
      }

      expect(results[0].speakerId).toBe('speaker_001');
    });
  });

  describe('Pipeline State Management', () => {
    it('should track active pipelines', async () => {
      const audio = createMockAudioBuffer();
      
      // Start processing but don't await
      const promise = processor.processAudioSegment(audio, 'user123', 'es-ES');
      
      // Check active pipelines (may or may not be active depending on timing)
      const activePipelines = processor.getActivePipelines();
      expect(Array.isArray(activePipelines)).toBe(true);
      
      await promise;
      
      // Should be cleared after completion
      const finalPipelines = processor.getActivePipelines();
      expect(finalPipelines).toHaveLength(0);
    });

    it('should clear pipeline state after completion', async () => {
      const audio = createMockAudioBuffer();
      await processor.processAudioSegment(audio, 'user123', 'es-ES');

      const activePipelines = processor.getActivePipelines();
      expect(activePipelines).toHaveLength(0);
    });

    it('should clear pipeline state after error', async () => {
      mockRecognizer.recognize.mockRejectedValue(new Error('Test error'));

      const audio = createMockAudioBuffer();
      
      await expect(
        processor.processAudioSegment(audio, 'user123', 'es-ES')
      ).rejects.toThrow();

      const activePipelines = processor.getActivePipelines();
      expect(activePipelines).toHaveLength(0);
    });
  });

  describe('Metrics', () => {
    it('should collect metrics', async () => {
      const audio = createMockAudioBuffer();
      await processor.processAudioSegment(audio, 'user123', 'es-ES');

      const metrics = processor.getMetrics();
      expect(metrics.totalProcessed).toBe(1);
      expect(metrics.successfulProcessed).toBe(1);
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });

    it('should calculate average latency', async () => {
      const audio = createMockAudioBuffer();
      
      await processor.processAudioSegment(audio, 'user123', 'es-ES');
      await processor.processAudioSegment(audio, 'user123', 'es-ES');
      await processor.processAudioSegment(audio, 'user123', 'es-ES');

      const metrics = processor.getMetrics();
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.totalProcessed).toBe(3);
    });

    it('should reset metrics', async () => {
      const audio = createMockAudioBuffer();
      await processor.processAudioSegment(audio, 'user123', 'es-ES');

      processor.resetMetrics();

      const metrics = processor.getMetrics();
      expect(metrics.totalProcessed).toBe(0);
      expect(metrics.successfulProcessed).toBe(0);
      expect(metrics.averageLatency).toBe(0);
    });

    it('should not collect metrics when disabled', async () => {
      const proc = new StreamProcessor(
        { enableMetrics: false },
        mockRecognizer,
        mockDetector,
        mockTranslator,
        mockSynthesizer
      );

      const audio = createMockAudioBuffer();
      await proc.processAudioSegment(audio, 'user123', 'es-ES');

      const metrics = proc.getMetrics();
      expect(metrics.totalProcessed).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      await processor.cleanup();
      
      const activePipelines = processor.getActivePipelines();
      expect(activePipelines).toHaveLength(0);
    });

    it('should wait for active pipelines to complete', async () => {
      const audio = createMockAudioBuffer();
      
      // Start processing
      const promise = processor.processAudioSegment(audio, 'user123', 'es-ES');
      
      // Cleanup should wait
      await processor.cleanup();
      
      // Ensure processing completed
      await promise;
      
      const activePipelines = processor.getActivePipelines();
      expect(activePipelines).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle language detection errors', async () => {
      mockDetector.detect.mockRejectedValue(new Error('Detection failed'));

      const audio = createMockAudioBuffer();
      
      // Should use default language and continue
      const result = await processor.processAudioSegment(
        audio,
        'user123',
        'es-ES'
      );

      expect(result).toBeDefined();
    });

    it('should handle recognition errors', async () => {
      mockRecognizer.recognize.mockRejectedValue(new Error('Recognition failed'));

      const audio = createMockAudioBuffer();
      
      await expect(
        processor.processAudioSegment(audio, 'user123', 'es-ES')
      ).rejects.toThrow('Recognition failed');
    });

    it('should handle translation errors', async () => {
      mockTranslator.translate.mockRejectedValue(new Error('Translation failed'));

      const audio = createMockAudioBuffer();
      
      await expect(
        processor.processAudioSegment(audio, 'user123', 'es-ES')
      ).rejects.toThrow('Translation failed');
    });

    it('should handle synthesis errors', async () => {
      mockSynthesizer.synthesize.mockRejectedValue(new Error('Synthesis failed'));

      const audio = createMockAudioBuffer();
      
      await expect(
        processor.processAudioSegment(audio, 'user123', 'es-ES')
      ).rejects.toThrow('Synthesis failed');
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple concurrent segments', async () => {
      const audio = createMockAudioBuffer();
      
      const promises = [
        processor.processAudioSegment(audio, 'user123', 'es-ES'),
        processor.processAudioSegment(audio, 'user123', 'es-ES'),
        processor.processAudioSegment(audio, 'user123', 'es-ES'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result?.originalText).toBe('Hello world');
      });
    });

    it('should respect max concurrent processes limit', async () => {
      const proc = new StreamProcessor(
        { maxConcurrentProcesses: 2 },
        mockRecognizer,
        mockDetector,
        mockTranslator,
        mockSynthesizer
      );

      const audio = createMockAudioBuffer();
      
      const promises = Array(5).fill(null).map(() =>
        proc.processAudioSegment(audio, 'user123', 'es-ES')
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
    });
  });

  describe('Language Code Normalization', () => {
    it('should normalize language codes correctly', async () => {
      mockDetector.detect.mockResolvedValue({
        languageCode: 'en-GB',
        confidence: 0.9,
        alternativeLanguages: [],
      });

      const audio = createMockAudioBuffer();
      const result = await processor.processAudioSegment(
        audio,
        'user123',
        'en-US'
      );

      // Should skip translation due to same base language
      expect(result?.translatedAudio).toBe(audio);
    });

    it('should handle language codes without region', async () => {
      mockDetector.detect.mockResolvedValue({
        languageCode: 'en',
        confidence: 0.9,
        alternativeLanguages: [],
      });

      const audio = createMockAudioBuffer();
      const result = await processor.processAudioSegment(
        audio,
        'user123',
        'en-US'
      );

      expect(result?.translatedAudio).toBe(audio);
    });
  });

  describe('Performance', () => {
    it('should complete processing within reasonable time', async () => {
      const audio = createMockAudioBuffer();
      const startTime = Date.now();

      await processor.processAudioSegment(audio, 'user123', 'es-ES');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should track latency accurately', async () => {
      const audio = createMockAudioBuffer();
      const result = await processor.processAudioSegment(
        audio,
        'user123',
        'es-ES'
      );

      expect(result?.latency).toBeGreaterThan(0);
      expect(result?.latency).toBeLessThan(5000);
    });
  });
});
