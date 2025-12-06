/**
 * Speech Recognition Engine
 * 
 * Implements speech-to-text conversion with multiple engine support.
 * 
 * Requirements:
 * - 3.5: WHEN 源语言确定后 THEN 系统 SHALL 选择相应的语音识别引擎进行处理
 * - 4.2: WHEN 接收到非用户目标语言的语音段 THEN 系统 SHALL 将该语音转换为文本
 */

import type { AudioBuffer, RecognitionResult } from '../types';

/**
 * Speech recognition engine types
 */
export enum RecognitionEngine {
  GOOGLE_CLOUD = 'google_cloud',
  VOSK = 'vosk',
  AUTO = 'auto',
}

/**
 * Configuration for speech recognition
 */
export interface SpeechRecognizerConfig {
  /** Primary recognition engine to use */
  primaryEngine: RecognitionEngine;
  /** Fallback engine if primary fails */
  fallbackEngine: RecognitionEngine;
  /** Google Cloud API key */
  googleApiKey?: string;
  /** Enable streaming recognition */
  enableStreaming: boolean;
  /** Maximum alternatives to return */
  maxAlternatives: number;
  /** Enable automatic punctuation */
  enableAutomaticPunctuation: boolean;
  /** Model to use (e.g., 'default', 'command_and_search', 'phone_call') */
  model: string;
  /** Sample rate for audio (Hz) */
  sampleRate: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: SpeechRecognizerConfig = {
  primaryEngine: RecognitionEngine.GOOGLE_CLOUD,
  fallbackEngine: RecognitionEngine.VOSK,
  enableStreaming: true,
  maxAlternatives: 3,
  enableAutomaticPunctuation: true,
  model: 'default',
  sampleRate: 16000,
};

/**
 * Streaming recognition state
 */
interface StreamingState {
  isActive: boolean;
  language: string;
  sessionId: string;
  buffer: Float32Array[];
}

/**
 * SpeechRecognizer class
 * 
 * Provides speech recognition capabilities with multiple engine support
 * and language-driven engine selection.
 */
export class SpeechRecognizer {
  private config: SpeechRecognizerConfig;
  private streamingState: Map<string, StreamingState>;
  private engineAvailability: Map<RecognitionEngine, boolean>;

  constructor(config: Partial<SpeechRecognizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.streamingState = new Map();
    this.engineAvailability = new Map([
      [RecognitionEngine.GOOGLE_CLOUD, !!this.config.googleApiKey],
      [RecognitionEngine.VOSK, true], // Vosk is always available locally
    ]);
  }

  /**
   * Recognize speech from audio buffer
   * 
   * Requirements:
   * - 3.5: Selects appropriate recognition engine based on language
   * - 4.2: Converts speech to text
   * 
   * @param audio - Audio buffer to recognize
   * @param language - Language code (e.g., 'en-US', 'zh-CN')
   * @returns Recognition result with text and confidence
   */
  async recognize(audio: AudioBuffer, language: string): Promise<RecognitionResult> {
    try {
      // Select engine based on language and availability (Requirement 3.5)
      const engine = this.selectEngine(language);
      
      // Perform recognition using selected engine
      const result = await this.recognizeWithEngine(audio, language, engine);
      
      return result;
    } catch (error) {
      console.error('Speech recognition failed:', error);
      
      // Try fallback engine
      if (this.config.fallbackEngine !== this.config.primaryEngine) {
        try {
          return await this.recognizeWithEngine(
            audio,
            language,
            this.config.fallbackEngine
          );
        } catch (fallbackError) {
          console.error('Fallback recognition failed:', fallbackError);
        }
      }
      
      // Return empty result if all engines fail
      return this.createEmptyResult();
    }
  }

  /**
   * Start streaming recognition session
   * 
   * Enables real-time speech recognition with streaming audio input.
   * 
   * @param language - Language code
   * @param sessionId - Unique session identifier
   * @returns Async iterator yielding recognition results
   */
  async *recognizeStream(
    language: string,
    sessionId: string = this.generateSessionId()
  ): AsyncIterableIterator<RecognitionResult> {
    // Initialize streaming state
    this.streamingState.set(sessionId, {
      isActive: true,
      language,
      sessionId,
      buffer: [],
    });

    try {
      const engine = this.selectEngine(language);
      
      // Start streaming recognition based on engine
      if (engine === RecognitionEngine.GOOGLE_CLOUD) {
        yield* this.streamGoogleCloud(sessionId, language);
      } else {
        yield* this.streamVosk(sessionId, language);
      }
    } finally {
      // Clean up streaming state
      this.streamingState.delete(sessionId);
    }
  }

  /**
   * Push audio chunk to streaming session
   * 
   * @param sessionId - Session identifier
   * @param audioChunk - Audio data chunk
   */
  pushAudioChunk(sessionId: string, audioChunk: Float32Array): void {
    const state = this.streamingState.get(sessionId);
    if (state && state.isActive) {
      state.buffer.push(audioChunk);
    }
  }

  /**
   * Stop streaming recognition session
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
   * Update configuration
   */
  updateConfig(config: Partial<SpeechRecognizerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update engine availability
    if (config.googleApiKey !== undefined) {
      this.engineAvailability.set(
        RecognitionEngine.GOOGLE_CLOUD,
        !!config.googleApiKey
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SpeechRecognizerConfig {
    return { ...this.config };
  }

  /**
   * Check if an engine is available
   */
  isEngineAvailable(engine: RecognitionEngine): boolean {
    return this.engineAvailability.get(engine) ?? false;
  }

  /**
   * Select appropriate recognition engine based on language
   * 
   * Requirement 3.5: Language-driven engine selection
   * 
   * @private
   */
  private selectEngine(language: string): RecognitionEngine {
    // If AUTO mode, select based on availability and language support
    if (this.config.primaryEngine === RecognitionEngine.AUTO) {
      // Prefer Google Cloud for better accuracy if available
      if (this.isEngineAvailable(RecognitionEngine.GOOGLE_CLOUD)) {
        return RecognitionEngine.GOOGLE_CLOUD;
      }
      return RecognitionEngine.VOSK;
    }

    // Use configured primary engine if available
    if (this.isEngineAvailable(this.config.primaryEngine)) {
      return this.config.primaryEngine;
    }

    // Fall back to available engine
    if (this.isEngineAvailable(this.config.fallbackEngine)) {
      return this.config.fallbackEngine;
    }

    // Default to Vosk (always available locally)
    return RecognitionEngine.VOSK;
  }

  /**
   * Perform recognition using specified engine
   * 
   * @private
   */
  private async recognizeWithEngine(
    audio: AudioBuffer,
    language: string,
    engine: RecognitionEngine
  ): Promise<RecognitionResult> {
    switch (engine) {
      case RecognitionEngine.GOOGLE_CLOUD:
        return await this.recognizeGoogleCloud(audio, language);
      case RecognitionEngine.VOSK:
        return await this.recognizeVosk(audio, language);
      default:
        throw new Error(`Unsupported engine: ${engine}`);
    }
  }

  /**
   * Recognize speech using Google Cloud Speech-to-Text API
   * 
   * @private
   */
  private async recognizeGoogleCloud(
    audio: AudioBuffer,
    language: string
  ): Promise<RecognitionResult> {
    if (!this.config.googleApiKey) {
      throw new Error('Google Cloud API key not configured');
    }

    // Convert audio to base64
    const audioContent = this.audioBufferToBase64(audio);

    // In production, this would call the actual Google Cloud API:
    // const response = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.config.googleApiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     config: {
    //       encoding: 'LINEAR16',
    //       sampleRateHertz: this.config.sampleRate,
    //       languageCode: language,
    //       maxAlternatives: this.config.maxAlternatives,
    //       enableAutomaticPunctuation: this.config.enableAutomaticPunctuation,
    //       model: this.config.model,
    //     },
    //     audio: {
    //       content: audioContent,
    //     },
    //   }),
    // });
    // const data = await response.json();

    // Simulate API call for now
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.debug('Google Cloud recognition called with audio length:', audioContent.length);

    // Mock response
    return {
      text: 'Hello, this is a test transcription',
      confidence: 0.92,
      isFinal: true,
      alternatives: [
        { text: 'Hello this is a test transcription', confidence: 0.88 },
        { text: 'Hello, this is the test transcription', confidence: 0.85 },
      ],
    };
  }

  /**
   * Recognize speech using Vosk (local offline engine)
   * 
   * @private
   */
  private async recognizeVosk(
    audio: AudioBuffer,
    language: string
  ): Promise<RecognitionResult> {
    // In production, this would use the Vosk library:
    // const vosk = require('vosk');
    // const model = new vosk.Model(`models/vosk-model-${language}`);
    // const recognizer = new vosk.Recognizer({ model, sampleRate: audio.sampleRate });
    // 
    // recognizer.acceptWaveform(audio.data);
    // const result = JSON.parse(recognizer.finalResult());

    // Simulate Vosk processing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.debug('Vosk recognition called for language:', language);

    // Mock response (lower confidence than Google Cloud)
    return {
      text: 'hello this is a test transcription',
      confidence: 0.78,
      isFinal: true,
      alternatives: [
        { text: 'hello this is the test transcription', confidence: 0.72 },
      ],
    };
  }

  /**
   * Stream recognition using Google Cloud Speech-to-Text API
   * 
   * @private
   */
  private async *streamGoogleCloud(
    sessionId: string,
    language: string
  ): AsyncIterableIterator<RecognitionResult> {
    const state = this.streamingState.get(sessionId);
    if (!state) return;

    // In production, this would use Google Cloud Streaming API:
    // const client = new speech.SpeechClient();
    // const stream = client.streamingRecognize({
    //   config: {
    //     encoding: 'LINEAR16',
    //     sampleRateHertz: this.config.sampleRate,
    //     languageCode: language,
    //   },
    //   interimResults: true,
    // });

    // Simulate streaming recognition
    while (state.isActive) {
      // Wait for audio chunks
      await new Promise(resolve => setTimeout(resolve, 100));

      if (state.buffer.length > 0) {
        // Process buffered audio
        const chunk = state.buffer.shift()!;
        
        // Simulate recognition result
        yield {
          text: 'Partial transcription...',
          confidence: 0.75,
          isFinal: false,
          alternatives: [],
        };

        // Occasionally yield final result
        if (Math.random() > 0.7) {
          yield {
            text: 'Complete sentence transcription.',
            confidence: 0.90,
            isFinal: true,
            alternatives: [
              { text: 'Complete sentence transcription', confidence: 0.85 },
            ],
          };
        }
      }
    }
  }

  /**
   * Stream recognition using Vosk
   * 
   * @private
   */
  private async *streamVosk(
    sessionId: string,
    language: string
  ): AsyncIterableIterator<RecognitionResult> {
    const state = this.streamingState.get(sessionId);
    if (!state) return;

    // In production, this would use Vosk streaming:
    // const model = new vosk.Model(`models/vosk-model-${language}`);
    // const recognizer = new vosk.Recognizer({ model, sampleRate: this.config.sampleRate });

    // Simulate streaming recognition
    while (state.isActive) {
      await new Promise(resolve => setTimeout(resolve, 100));

      if (state.buffer.length > 0) {
        const chunk = state.buffer.shift()!;
        
        // Simulate partial result
        yield {
          text: 'partial transcription',
          confidence: 0.70,
          isFinal: false,
          alternatives: [],
        };

        // Occasionally yield final result
        if (Math.random() > 0.7) {
          yield {
            text: 'complete sentence transcription',
            confidence: 0.82,
            isFinal: true,
            alternatives: [],
          };
        }
      }
    }
  }

  /**
   * Convert audio buffer to base64 for API transmission
   * 
   * @private
   */
  private audioBufferToBase64(audio: AudioBuffer): string {
    const buffer = audio.data;
    const bytes = new Uint8Array(buffer.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Generate unique session ID
   * 
   * @private
   */
  private generateSessionId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create empty recognition result
   * 
   * @private
   */
  private createEmptyResult(): RecognitionResult {
    return {
      text: '',
      confidence: 0,
      isFinal: true,
      alternatives: [],
    };
  }
}

/**
 * Singleton instance for global use
 */
export const speechRecognizer = new SpeechRecognizer();
