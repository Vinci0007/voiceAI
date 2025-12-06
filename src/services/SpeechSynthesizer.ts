/**
 * Speech Synthesizer
 * 
 * Implements text-to-speech conversion with multiple engine support,
 * streaming synthesis, and voice caching.
 * 
 * Requirements:
 * - 4.4: WHEN 翻译完成 THEN 系统 SHALL 将翻译后的文本转换为语音输出
 */

import type { AudioBuffer, VoiceConfig } from '../types';
import { ErrorHandler, ErrorType, ErrorSeverity, createError } from './ErrorHandler';

/**
 * Speech synthesis engine types
 */
export enum SynthesisEngine {
  GOOGLE_CLOUD = 'google_cloud',
  AZURE = 'azure',
  PIPER_LOCAL = 'piper_local',
  AUTO = 'auto',
}

/**
 * Voice gender options
 */
export enum VoiceGender {
  MALE = 'male',
  FEMALE = 'female',
  NEUTRAL = 'neutral',
}

/**
 * Audio encoding formats
 */
export enum AudioEncoding {
  LINEAR16 = 'linear16',
  MP3 = 'mp3',
  OGG_OPUS = 'ogg_opus',
}

/**
 * Configuration for speech synthesizer
 */
export interface SpeechSynthesizerConfig {
  /** Primary synthesis engine to use */
  primaryEngine: SynthesisEngine;
  /** Fallback engine if primary fails */
  fallbackEngine: SynthesisEngine;
  /** Google Cloud API key */
  googleApiKey?: string;
  /** Azure API key */
  azureApiKey?: string;
  /** Azure region */
  azureRegion?: string;
  /** Enable voice caching */
  enableCache: boolean;
  /** Maximum cache size (number of entries) */
  maxCacheSize: number;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  /** Enable streaming synthesis */
  enableStreaming: boolean;
  /** Sample rate for audio output (Hz) */
  sampleRate: number;
  /** Audio encoding format */
  audioEncoding: AudioEncoding;
  /** Default voice configuration */
  defaultVoice: VoiceConfig;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: SpeechSynthesizerConfig = {
  primaryEngine: SynthesisEngine.GOOGLE_CLOUD,
  fallbackEngine: SynthesisEngine.PIPER_LOCAL,
  enableCache: true,
  maxCacheSize: 1000,
  cacheTTL: 3600000, // 1 hour
  enableStreaming: true,
  sampleRate: 24000,
  audioEncoding: AudioEncoding.LINEAR16,
  defaultVoice: {
    voiceId: 'en-US-Standard-A',
    pitch: 0,
    speed: 1.0,
    volume: 1.0,
  },
};

/**
 * Cache entry
 */
interface CacheEntry {
  audio: AudioBuffer;
  timestamp: number;
}

/**
 * Synthesis result
 */
export interface SynthesisResult {
  audio: AudioBuffer;
  duration: number;
  voiceUsed: string;
}

/**
 * Streaming synthesis state
 */
interface StreamingState {
  isActive: boolean;
  language: string;
  sessionId: string;
  buffer: string[];
}

/**
 * Synthesis statistics
 */
export interface SynthesisStats {
  totalSyntheses: number;
  cacheHits: number;
  cacheMisses: number;
  streamingSyntheses: number;
  averageLatency: number;
  engineUsage: Record<SynthesisEngine, number>;
}

/**
 * SpeechSynthesizer class
 * 
 * Provides text-to-speech capabilities with multiple engine support,
 * intelligent caching, and streaming synthesis.
 */
export class SpeechSynthesizer {
  private config: SpeechSynthesizerConfig;
  private cache: Map<string, CacheEntry>;
  private errorHandler: ErrorHandler;
  private streamingState: Map<string, StreamingState>;
  private stats: SynthesisStats;
  private engineAvailability: Map<SynthesisEngine, boolean>;

  constructor(
    config: Partial<SpeechSynthesizerConfig> = {},
    errorHandler: ErrorHandler = new ErrorHandler()
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.errorHandler = errorHandler;
    this.streamingState = new Map();
    this.stats = {
      totalSyntheses: 0,
      cacheHits: 0,
      cacheMisses: 0,
      streamingSyntheses: 0,
      averageLatency: 0,
      engineUsage: {} as Record<SynthesisEngine, number>,
    };
    this.engineAvailability = new Map([
      [SynthesisEngine.GOOGLE_CLOUD, !!this.config.googleApiKey],
      [SynthesisEngine.AZURE, !!(this.config.azureApiKey && this.config.azureRegion)],
      [SynthesisEngine.PIPER_LOCAL, true], // Local engine always available
    ]);
  }

  /**
   * Synthesize speech from text
   * 
   * Requirement 4.4: Converts translated text to speech output
   * 
   * @param text - Text to synthesize
   * @param language - Language code (e.g., 'en-US', 'zh-CN')
   * @param voice - Optional voice configuration
   * @returns Synthesis result with audio buffer
   */
  async synthesize(
    text: string,
    language: string,
    voice?: Partial<VoiceConfig>
  ): Promise<SynthesisResult> {
    const startTime = Date.now();

    try {
      // Validate input
      if (!text || text.trim().length === 0) {
        return this.createEmptyResult();
      }

      // Merge voice config with defaults
      const voiceConfig = { ...this.config.defaultVoice, ...voice };

      // Check cache first
      if (this.config.enableCache) {
        const cached = this.getCachedSynthesis(text, language, voiceConfig);
        if (cached) {
          this.stats.cacheHits++;
          const duration = Date.now() - startTime;
          this.updateLatency(duration);
          return {
            audio: cached,
            duration,
            voiceUsed: voiceConfig.voiceId,
          };
        }
        this.stats.cacheMisses++;
      }

      // Select engine
      const engine = this.selectEngine();

      // Perform synthesis
      const audio = await this.errorHandler.fallback(
        () => this.synthesizeWithEngine(text, language, voiceConfig, engine),
        () => this.synthesizeWithEngine(
          text,
          language,
          voiceConfig,
          this.config.fallbackEngine
        )
      );

      // Cache result
      if (this.config.enableCache) {
        this.cacheSynthesis(text, language, voiceConfig, audio);
      }

      // Update statistics
      this.stats.totalSyntheses++;
      this.stats.engineUsage[engine] = (this.stats.engineUsage[engine] || 0) + 1;
      const duration = Date.now() - startTime;
      this.updateLatency(duration);

      return {
        audio,
        duration,
        voiceUsed: voiceConfig.voiceId,
      };
    } catch (error) {
      const systemError = createError(
        ErrorType.SYNTHESIS,
        `Speech synthesis failed: ${(error as Error).message}`,
        ErrorSeverity.WARNING,
        { text, language },
        error as Error
      );
      this.errorHandler.handleError(systemError);

      // Return empty audio as fallback
      return this.createEmptyResult();
    }
  }

  /**
   * Start streaming synthesis session
   * 
   * Enables real-time speech synthesis with streaming text input.
   * 
   * @param language - Language code
   * @param voice - Optional voice configuration
   * @param sessionId - Unique session identifier
   * @returns Async iterator yielding audio chunks
   */
  async *synthesizeStream(
    language: string,
    voice?: Partial<VoiceConfig>,
    sessionId: string = this.generateSessionId()
  ): AsyncIterableIterator<AudioBuffer> {
    // Initialize streaming state
    this.streamingState.set(sessionId, {
      isActive: true,
      language,
      sessionId,
      buffer: [],
    });

    try {
      const voiceConfig = { ...this.config.defaultVoice, ...voice };
      const engine = this.selectEngine();

      // Start streaming synthesis based on engine
      if (engine === SynthesisEngine.GOOGLE_CLOUD) {
        yield* this.streamGoogleCloud(sessionId, language, voiceConfig);
      } else if (engine === SynthesisEngine.AZURE) {
        yield* this.streamAzure(sessionId, language, voiceConfig);
      } else {
        yield* this.streamPiper(sessionId, language, voiceConfig);
      }

      this.stats.streamingSyntheses++;
    } finally {
      // Clean up streaming state
      this.streamingState.delete(sessionId);
    }
  }

  /**
   * Push text chunk to streaming session
   * 
   * @param sessionId - Session identifier
   * @param textChunk - Text chunk to synthesize
   */
  pushTextChunk(sessionId: string, textChunk: string): void {
    const state = this.streamingState.get(sessionId);
    if (state && state.isActive) {
      state.buffer.push(textChunk);
    }
  }

  /**
   * Stop streaming synthesis session
   * 
   * @param sessionId - Session identifier
   */
  stopStream(sessionId: string): void {
    const state = this.streamingState.get(sessionId);
    if (state) {
      state.isActive = false;
    }
  }

  /**
   * Get available voices for a language
   * 
   * @param language - Language code
   * @returns List of available voice IDs
   */
  async getAvailableVoices(language: string): Promise<string[]> {
    const engine = this.selectEngine();

    switch (engine) {
      case SynthesisEngine.GOOGLE_CLOUD:
        return this.getGoogleCloudVoices(language);
      case SynthesisEngine.AZURE:
        return this.getAzureVoices(language);
      case SynthesisEngine.PIPER_LOCAL:
        return this.getPiperVoices(language);
      default:
        return [];
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SpeechSynthesizerConfig>): void {
    this.config = { ...this.config, ...config };

    // Update engine availability
    if (config.googleApiKey !== undefined) {
      this.engineAvailability.set(
        SynthesisEngine.GOOGLE_CLOUD,
        !!config.googleApiKey
      );
    }
    if (config.azureApiKey !== undefined || config.azureRegion !== undefined) {
      this.engineAvailability.set(
        SynthesisEngine.AZURE,
        !!(this.config.azureApiKey && this.config.azureRegion)
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SpeechSynthesizerConfig {
    return { ...this.config };
  }

  /**
   * Clear synthesis cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: number | null;
  } {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    const hitRate = total > 0 ? this.stats.cacheHits / total : 0;

    let oldestTimestamp: number | null = null;
    for (const entry of this.cache.values()) {
      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      hitRate,
      oldestEntry: oldestTimestamp,
    };
  }

  /**
   * Get synthesis statistics
   */
  getStats(): SynthesisStats {
    return { ...this.stats };
  }

  /**
   * Check if an engine is available
   */
  isEngineAvailable(engine: SynthesisEngine): boolean {
    return this.engineAvailability.get(engine) ?? false;
  }

  /**
   * Select appropriate synthesis engine
   * 
   * @private
   */
  private selectEngine(): SynthesisEngine {
    // If AUTO mode, select based on availability
    if (this.config.primaryEngine === SynthesisEngine.AUTO) {
      // Prefer Google Cloud for better quality if available
      if (this.isEngineAvailable(SynthesisEngine.GOOGLE_CLOUD)) {
        return SynthesisEngine.GOOGLE_CLOUD;
      }
      // Then Azure
      if (this.isEngineAvailable(SynthesisEngine.AZURE)) {
        return SynthesisEngine.AZURE;
      }
      // Finally local engine
      return SynthesisEngine.PIPER_LOCAL;
    }

    // Use configured primary engine if available
    if (this.isEngineAvailable(this.config.primaryEngine)) {
      return this.config.primaryEngine;
    }

    // Fall back to available engine
    if (this.isEngineAvailable(this.config.fallbackEngine)) {
      return this.config.fallbackEngine;
    }

    // Default to local engine (always available)
    return SynthesisEngine.PIPER_LOCAL;
  }

  /**
   * Synthesize using specified engine
   * 
   * @private
   */
  private async synthesizeWithEngine(
    text: string,
    language: string,
    voice: VoiceConfig,
    engine: SynthesisEngine
  ): Promise<AudioBuffer> {
    switch (engine) {
      case SynthesisEngine.GOOGLE_CLOUD:
        return await this.synthesizeGoogleCloud(text, language, voice);
      case SynthesisEngine.AZURE:
        return await this.synthesizeAzure(text, language, voice);
      case SynthesisEngine.PIPER_LOCAL:
        return await this.synthesizePiper(text, language, voice);
      default:
        throw new Error(`Unsupported engine: ${engine}`);
    }
  }

  /**
   * Synthesize using Google Cloud Text-to-Speech API
   * 
   * @private
   */
  private async synthesizeGoogleCloud(
    text: string,
    language: string,
    voice: VoiceConfig
  ): Promise<AudioBuffer> {
    if (!this.config.googleApiKey) {
      throw new Error('Google Cloud API key not configured');
    }

    // In production, this would call the actual Google Cloud TTS API:
    // const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.config.googleApiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     input: { text },
    //     voice: {
    //       languageCode: language,
    //       name: voice.voiceId,
    //     },
    //     audioConfig: {
    //       audioEncoding: this.config.audioEncoding.toUpperCase(),
    //       sampleRateHertz: this.config.sampleRate,
    //       pitch: voice.pitch,
    //       speakingRate: voice.speed,
    //       volumeGainDb: this.volumeToDb(voice.volume),
    //     },
    //   }),
    // });
    // const data = await response.json();
    // const audioContent = Buffer.from(data.audioContent, 'base64');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 400));

    console.debug('Google Cloud TTS called:', { text, language, voice: voice.voiceId });

    // Mock audio buffer
    return this.createMockAudioBuffer(text.length * 100);
  }

  /**
   * Synthesize using Azure Neural TTS
   * 
   * @private
   */
  private async synthesizeAzure(
    text: string,
    language: string,
    voice: VoiceConfig
  ): Promise<AudioBuffer> {
    if (!this.config.azureApiKey || !this.config.azureRegion) {
      throw new Error('Azure API key or region not configured');
    }

    // In production, this would call the actual Azure TTS API:
    // const response = await fetch(
    //   `https://${this.config.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Ocp-Apim-Subscription-Key': this.config.azureApiKey,
    //       'Content-Type': 'application/ssml+xml',
    //       'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
    //     },
    //     body: this.generateSSML(text, language, voice),
    //   }
    // );
    // const audioData = await response.arrayBuffer();

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 450));

    console.debug('Azure TTS called:', { text, language, voice: voice.voiceId });

    // Mock audio buffer
    return this.createMockAudioBuffer(text.length * 100);
  }

  /**
   * Synthesize using Piper TTS (local)
   * 
   * @private
   */
  private async synthesizePiper(
    text: string,
    language: string,
    voice: VoiceConfig
  ): Promise<AudioBuffer> {
    // In production, this would use Piper TTS with ONNX Runtime:
    // const piper = require('piper-tts');
    // const model = await piper.loadModel(`models/piper-${language}.onnx`);
    // const audioData = await model.synthesize(text, {
    //   speakerId: voice.voiceId,
    //   speed: voice.speed,
    // });

    // Simulate local synthesis
    await new Promise(resolve => setTimeout(resolve, 150));

    console.debug('Piper TTS called:', { text, language, voice: voice.voiceId });

    // Mock audio buffer
    return this.createMockAudioBuffer(text.length * 100);
  }

  /**
   * Stream synthesis using Google Cloud TTS
   * 
   * @private
   */
  private async *streamGoogleCloud(
    sessionId: string,
    language: string,
    voice: VoiceConfig
  ): AsyncIterableIterator<AudioBuffer> {
    const state = this.streamingState.get(sessionId);
    if (!state) return;

    // In production, this would use Google Cloud Streaming TTS
    while (state.isActive) {
      await new Promise(resolve => setTimeout(resolve, 100));

      if (state.buffer.length > 0) {
        const textChunk = state.buffer.shift()!;
        const audio = await this.synthesizeGoogleCloud(textChunk, language, voice);
        yield audio;
      }
    }
  }

  /**
   * Stream synthesis using Azure TTS
   * 
   * @private
   */
  private async *streamAzure(
    sessionId: string,
    language: string,
    voice: VoiceConfig
  ): AsyncIterableIterator<AudioBuffer> {
    const state = this.streamingState.get(sessionId);
    if (!state) return;

    while (state.isActive) {
      await new Promise(resolve => setTimeout(resolve, 100));

      if (state.buffer.length > 0) {
        const textChunk = state.buffer.shift()!;
        const audio = await this.synthesizeAzure(textChunk, language, voice);
        yield audio;
      }
    }
  }

  /**
   * Stream synthesis using Piper TTS
   * 
   * @private
   */
  private async *streamPiper(
    sessionId: string,
    language: string,
    voice: VoiceConfig
  ): AsyncIterableIterator<AudioBuffer> {
    const state = this.streamingState.get(sessionId);
    if (!state) return;

    while (state.isActive) {
      await new Promise(resolve => setTimeout(resolve, 100));

      if (state.buffer.length > 0) {
        const textChunk = state.buffer.shift()!;
        const audio = await this.synthesizePiper(textChunk, language, voice);
        yield audio;
      }
    }
  }

  /**
   * Get available Google Cloud voices
   * 
   * @private
   */
  private async getGoogleCloudVoices(language: string): Promise<string[]> {
    // In production, this would call the voices API
    // Mock response
    const languagePrefix = language.split('-')[0];
    return [
      `${language}-Standard-A`,
      `${language}-Standard-B`,
      `${language}-Wavenet-A`,
      `${language}-Wavenet-B`,
      `${language}-Neural2-A`,
      `${language}-Neural2-B`,
    ];
  }

  /**
   * Get available Azure voices
   * 
   * @private
   */
  private async getAzureVoices(language: string): Promise<string[]> {
    // Mock response
    return [
      `${language}-JennyNeural`,
      `${language}-GuyNeural`,
      `${language}-AriaNeural`,
      `${language}-DavisNeural`,
    ];
  }

  /**
   * Get available Piper voices
   * 
   * @private
   */
  private async getPiperVoices(language: string): Promise<string[]> {
    // Mock response
    return [
      `${language}-female-low`,
      `${language}-female-medium`,
      `${language}-male-low`,
      `${language}-male-medium`,
    ];
  }

  /**
   * Get cached synthesis
   * 
   * @private
   */
  private getCachedSynthesis(
    text: string,
    language: string,
    voice: VoiceConfig
  ): AudioBuffer | null {
    const key = this.getCacheKey(text, language, voice);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const age = Date.now() - entry.timestamp;
    if (age > this.config.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.audio;
  }

  /**
   * Cache synthesis result
   * 
   * @private
   */
  private cacheSynthesis(
    text: string,
    language: string,
    voice: VoiceConfig,
    audio: AudioBuffer
  ): void {
    const key = this.getCacheKey(text, language, voice);

    // If cache is full, remove oldest entry
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldestCacheEntry();
    }

    this.cache.set(key, {
      audio,
      timestamp: Date.now(),
    });
  }

  /**
   * Generate cache key
   * 
   * @private
   */
  private getCacheKey(text: string, language: string, voice: VoiceConfig): string {
    return `${language}:${voice.voiceId}:${voice.speed}:${voice.pitch}:${text}`;
  }

  /**
   * Evict oldest cache entry
   * 
   * @private
   */
  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Generate unique session ID
   * 
   * @private
   */
  private generateSessionId(): string {
    return `synth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update average latency
   * 
   * @private
   */
  private updateLatency(latency: number): void {
    const total = this.stats.totalSyntheses;
    this.stats.averageLatency =
      (this.stats.averageLatency * (total - 1) + latency) / total;
  }

  /**
   * Create mock audio buffer for testing
   * 
   * @private
   */
  private createMockAudioBuffer(samples: number): AudioBuffer {
    const data = new Float32Array(samples);
    // Generate simple sine wave for testing
    for (let i = 0; i < samples; i++) {
      data[i] = Math.sin(2 * Math.PI * 440 * i / this.config.sampleRate) * 0.3;
    }

    return {
      data,
      sampleRate: this.config.sampleRate,
      channels: 1,
      timestamp: Date.now(),
    };
  }

  /**
   * Create empty synthesis result
   * 
   * @private
   */
  private createEmptyResult(): SynthesisResult {
    return {
      audio: {
        data: new Float32Array(0),
        sampleRate: this.config.sampleRate,
        channels: 1,
        timestamp: Date.now(),
      },
      duration: 0,
      voiceUsed: this.config.defaultVoice.voiceId,
    };
  }

  /**
   * Convert volume (0-1) to decibels
   * 
   * @private
   */
  private volumeToDb(volume: number): number {
    if (volume <= 0) return -96;
    if (volume >= 1) return 0;
    return 20 * Math.log10(volume);
  }

  /**
   * Generate SSML for Azure TTS
   * 
   * @private
   */
  private generateSSML(text: string, language: string, voice: VoiceConfig): string {
    const pitch = voice.pitch >= 0 ? `+${voice.pitch}%` : `${voice.pitch}%`;
    const rate = voice.speed >= 1 ? `+${(voice.speed - 1) * 100}%` : `${(voice.speed - 1) * 100}%`;

    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
        <voice name="${voice.voiceId}">
          <prosody pitch="${pitch}" rate="${rate}" volume="${voice.volume * 100}">
            ${text}
          </prosody>
        </voice>
      </speak>
    `.trim();
  }
}

/**
 * Singleton instance for global use
 */
export const speechSynthesizer = new SpeechSynthesizer();
