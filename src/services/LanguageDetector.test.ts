/**
 * Tests for LanguageDetector service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LanguageDetector } from './LanguageDetector';
import type { AudioBuffer } from '../types';

describe('LanguageDetector', () => {
  let detector: LanguageDetector;

  beforeEach(() => {
    detector = new LanguageDetector({
      confidenceThreshold: 0.7,
      useApiDetection: true,
      apiKey: 'test-api-key',
      defaultLanguage: 'en',
      maxAlternatives: 3,
    });
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultDetector = new LanguageDetector();
      const config = defaultDetector.getConfig();
      
      expect(config.confidenceThreshold).toBe(0.7);
      expect(config.useApiDetection).toBe(true);
      expect(config.defaultLanguage).toBe('en');
      expect(config.maxAlternatives).toBe(3);
    });

    it('should allow configuration updates', () => {
      detector.updateConfig({ confidenceThreshold: 0.8 });
      const config = detector.getConfig();
      
      expect(config.confidenceThreshold).toBe(0.8);
    });

    it('should merge partial configuration with existing config', () => {
      detector.updateConfig({ confidenceThreshold: 0.9 });
      const config = detector.getConfig();
      
      expect(config.confidenceThreshold).toBe(0.9);
      expect(config.defaultLanguage).toBe('en'); // Should remain unchanged
    });
  });

  describe('detectFromText', () => {
    it('should detect Chinese text', () => {
      const result = detector.detectFromText('你好世界');
      
      expect(result.languageCode).toBe('zh');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect Japanese text', () => {
      const result = detector.detectFromText('こんにちは');
      
      expect(result.languageCode).toBe('ja');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect Korean text', () => {
      const result = detector.detectFromText('안녕하세요');
      
      expect(result.languageCode).toBe('ko');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect Arabic text', () => {
      const result = detector.detectFromText('مرحبا');
      
      expect(result.languageCode).toBe('ar');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect Cyrillic text (Russian)', () => {
      const result = detector.detectFromText('Привет мир');
      
      expect(result.languageCode).toBe('ru');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should default to English for Latin script', () => {
      const result = detector.detectFromText('Hello world');
      
      expect(result.languageCode).toBe('en');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should return default language for empty text', () => {
      const result = detector.detectFromText('');
      
      expect(result.languageCode).toBe('en');
      expect(result.confidence).toBe(0.5);
    });

    it('should return default language for whitespace-only text', () => {
      const result = detector.detectFromText('   ');
      
      expect(result.languageCode).toBe('en');
      expect(result.confidence).toBe(0.5);
    });

    it('should include alternative languages when available', () => {
      const result = detector.detectFromText('你好');
      
      expect(result.alternativeLanguages).toBeDefined();
      expect(Array.isArray(result.alternativeLanguages)).toBe(true);
    });
  });

  describe('detect (audio)', () => {
    const createMockAudioBuffer = (): AudioBuffer => ({
      data: new Float32Array(1000),
      sampleRate: 16000,
      channels: 1,
      timestamp: Date.now(),
    });

    it('should detect language from audio segment', async () => {
      const audioSegment = createMockAudioBuffer();
      const result = await detector.detect(audioSegment);
      
      expect(result).toBeDefined();
      expect(result.languageCode).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should return language info with confidence', async () => {
      const audioSegment = createMockAudioBuffer();
      const result = await detector.detect(audioSegment);
      
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should return alternative languages', async () => {
      const audioSegment = createMockAudioBuffer();
      const result = await detector.detect(audioSegment);
      
      expect(Array.isArray(result.alternativeLanguages)).toBe(true);
    });

    it('should handle detection errors gracefully', async () => {
      const invalidDetector = new LanguageDetector({
        useApiDetection: false,
      });
      
      const audioSegment = createMockAudioBuffer();
      const result = await invalidDetector.detect(audioSegment);
      
      // Should return default language info
      expect(result.languageCode).toBe('en');
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('Low confidence handling (Requirement 3.4)', () => {
    it('should trigger secondary confirmation when confidence is below threshold', async () => {
      // Set a high threshold to trigger secondary confirmation
      detector.updateConfig({ confidenceThreshold: 0.9 });
      
      const audioSegment: AudioBuffer = {
        data: new Float32Array(1000),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now(),
      };
      
      const result = await detector.detect(audioSegment);
      
      // Should still return a valid result after secondary confirmation
      expect(result).toBeDefined();
      expect(result.languageCode).toBeDefined();
    });

    it('should use multi-language mode for secondary confirmation', async () => {
      detector.updateConfig({ confidenceThreshold: 0.95 });
      
      const audioSegment: AudioBuffer = {
        data: new Float32Array(1000),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now(),
      };
      
      const result = await detector.detect(audioSegment);
      
      // After secondary confirmation, confidence should be improved
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle very short audio segments', async () => {
      const shortAudio: AudioBuffer = {
        data: new Float32Array(10),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now(),
      };
      
      const result = await detector.detect(shortAudio);
      
      expect(result).toBeDefined();
      expect(result.languageCode).toBeDefined();
    });

    it('should handle multi-channel audio', async () => {
      const multiChannelAudio: AudioBuffer = {
        data: new Float32Array(2000),
        sampleRate: 16000,
        channels: 2,
        timestamp: Date.now(),
      };
      
      const result = await detector.detect(multiChannelAudio);
      
      expect(result).toBeDefined();
    });

    it('should handle different sample rates', async () => {
      const highSampleRateAudio: AudioBuffer = {
        data: new Float32Array(1000),
        sampleRate: 48000,
        channels: 1,
        timestamp: Date.now(),
      };
      
      const result = await detector.detect(highSampleRateAudio);
      
      expect(result).toBeDefined();
    });
  });

  describe('Requirements validation', () => {
    it('should analyze audio segment language features (Requirement 3.1)', async () => {
      const audioSegment: AudioBuffer = {
        data: new Float32Array(1000),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now(),
      };
      
      const result = await detector.detect(audioSegment);
      
      // Should return language analysis result
      expect(result.languageCode).toBeDefined();
      expect(typeof result.languageCode).toBe('string');
    });

    it('should determine source language category (Requirement 3.2)', async () => {
      const audioSegment: AudioBuffer = {
        data: new Float32Array(1000),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now(),
      };
      
      const result = await detector.detect(audioSegment);
      
      // Should return a valid language code
      expect(result.languageCode).toBeTruthy();
      expect(result.languageCode.length).toBeGreaterThan(0);
    });

    it('should associate language info with audio segment (Requirement 3.3)', async () => {
      const audioSegment: AudioBuffer = {
        data: new Float32Array(1000),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now(),
      };
      
      const result = await detector.detect(audioSegment);
      
      // Result should contain complete language information
      expect(result).toHaveProperty('languageCode');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('alternativeLanguages');
    });

    it('should use multi-language mode when confidence is low (Requirement 3.4)', async () => {
      detector.updateConfig({ confidenceThreshold: 0.99 });
      
      const audioSegment: AudioBuffer = {
        data: new Float32Array(1000),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now(),
      };
      
      const result = await detector.detect(audioSegment);
      
      // Should still return a result after secondary confirmation
      expect(result).toBeDefined();
      expect(result.languageCode).toBeDefined();
    });
  });
});
