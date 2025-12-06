/**
 * Stream Processor - Translation Pipeline Coordinator
 * 
 * Coordinates the entire audio processing pipeline from audio input to translated speech output.
 * Implements streaming processing to minimize latency and manages pipeline state.
 * 
 * Requirements:
 * - 4.2: WHEN 接收到非用户目标语言的语音段 THEN 系统 SHALL 将该语音转换为文本
 * - 4.3: WHEN 文本被提取 THEN 系统 SHALL 将文本从源语言翻译为用户的目标语言
 * - 4.4: WHEN 翻译完成 THEN 系统 SHALL 将翻译后的文本转换为语音输出
 * - 4.5: WHEN 接收到与用户目标语言相同的语音段 THEN 系统 SHALL 直接播放原始语音而不进行翻译
 */

import type {
  AudioBuffer,
  ProcessedOutput,
  SpeakerInfo,
  LanguageInfo,
  RecognitionResult,
  TranslationResult,
} from '../types';
import { SpeechRecognizer } from './SpeechRecognizer';
import { LanguageDetector } from './LanguageDetector';
import { TranslationEngine } from './TranslationEngine';
import { SpeechSynthesizer } from './SpeechSynthesizer';
import { ErrorHandler, ErrorType, ErrorSeverity, createError } from './ErrorHandler';

/**
 * Pipeline stage for tracking processing progress
 */
export enum PipelineStage {
  AUDIO_INPUT = 'audio_input',
  LANGUAGE_DETECTION = 'language_detection',
  SPEECH_RECOGNITION = 'speech_recognition',
  TRANSLATION = 'translation',
  SPEECH_SYNTHESIS = 'speech_synthesis',
  OUTPUT = 'output',
}

/**
 * Pipeline state for a single audio segment
 */
export interface PipelineState {
  segmentId: string;
  currentStage: PipelineStage;
  startTime: number;
  speakerId?: string;
  sourceLanguage?: string;
  targetLanguage: string;
  originalText?: string;
  translatedText?: string;
  error?: Error;
}

/**
 * Configuration for stream processor
 */
export interface StreamProcessorConfig {
  /** Enable streaming mode for lower latency */
  enableStreaming: boolean;
  /** Skip translation when source equals target language */
  skipSameLanguageTranslation: boolean;
  /** Maximum concurrent pipeline processes */
  maxConcurrentProcesses: number;
  /** Timeout for each pipeline stage (ms) */
  stageTimeout: number;
  /** Enable performance metrics collection */
  enableMetrics: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: StreamProcessorConfig = {
  enableStreaming: true,
  skipSameLanguageTranslation: true,
  maxConcurrentProcesses: 10,
  stageTimeout: 5000,
  enableMetrics: true,
};

/**
 * Pipeline metrics
 */
export interface PipelineMetrics {
  totalProcessed: number;
  successfulProcessed: number;
  failedProcessed: number;
  skippedTranslations: number;
  averageLatency: number;
  stageLatencies: Record<PipelineStage, number>;
}

/**
 * StreamProcessor class
 * 
 * Coordinates the entire translation pipeline with streaming support
 * and intelligent language handling.
 */
export class StreamProcessor {
  private config: StreamProcessorConfig;
  private speechRecognizer: SpeechRecognizer;
  private languageDetector: LanguageDetector;
  private translationEngine: TranslationEngine;
  private speechSynthesizer: SpeechSynthesizer;
  private errorHandler: ErrorHandler;
  
  private activePipelines: Map<string, PipelineState>;
  private metrics: PipelineMetrics;
  private latencyHistory: number[];

  constructor(
    config: Partial<StreamProcessorConfig> = {},
    speechRecognizer?: SpeechRecognizer,
    languageDetector?: LanguageDetector,
    translationEngine?: TranslationEngine,
    speechSynthesizer?: SpeechSynthesizer
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize services (use provided or create new instances)
    this.speechRecognizer = speechRecognizer || new SpeechRecognizer();
    this.languageDetector = languageDetector || new LanguageDetector();
    this.translationEngine = translationEngine || new TranslationEngine();
    this.speechSynthesizer = speechSynthesizer || new SpeechSynthesizer();
    this.errorHandler = new ErrorHandler();
    
    this.activePipelines = new Map();
    this.metrics = this.initializeMetrics();
    this.latencyHistory = [];
  }

  /**
   * Process audio stream through the complete pipeline
   * 
   * Requirements:
   * - 4.2: Converts non-target language speech to text
   * - 4.3: Translates text to target language
   * - 4.4: Synthesizes translated text to speech
   * - 4.5: Skips translation for same language
   * 
   * @param audioStream - Readable stream of audio buffers
   * @param userId - User ID for tracking
   * @param targetLanguage - User's target language
   * @param speakerInfo - Optional speaker information
   * @returns Async iterator of processed outputs
   */
  async *processAudioStream(
    audioStream: ReadableStream<AudioBuffer>,
    userId: string,
    targetLanguage: string,
    speakerInfo?: SpeakerInfo
  ): AsyncIterableIterator<ProcessedOutput> {
    const reader = audioStream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Process single audio segment
        const result = await this.processAudioSegment(
          value,
          userId,
          targetLanguage,
          speakerInfo
        );
        
        if (result) {
          yield result;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Process a single audio segment through the pipeline
   * 
   * @param audio - Audio buffer to process
   * @param userId - User ID for tracking
   * @param targetLanguage - User's target language
   * @param speakerInfo - Optional speaker information
   * @returns Processed output or null if skipped
   */
  async processAudioSegment(
    audio: AudioBuffer,
    _userId: string,
    targetLanguage: string,
    speakerInfo?: SpeakerInfo
  ): Promise<ProcessedOutput | null> {
    const segmentId = this.generateSegmentId();
    const startTime = Date.now();
    
    // Initialize pipeline state
    const state: PipelineState = {
      segmentId,
      currentStage: PipelineStage.AUDIO_INPUT,
      startTime,
      speakerId: speakerInfo?.speakerId,
      targetLanguage,
    };
    
    this.activePipelines.set(segmentId, state);
    
    try {
      // Stage 1: Language Detection
      state.currentStage = PipelineStage.LANGUAGE_DETECTION;
      const languageInfo = await this.detectLanguage(audio);
      state.sourceLanguage = languageInfo.languageCode;
      
      // Stage 2: Check if translation is needed (Requirement 4.5)
      if (this.shouldSkipTranslation(languageInfo.languageCode, targetLanguage)) {
        this.metrics.skippedTranslations++;
        this.activePipelines.delete(segmentId);
        
        // Return original audio without translation
        return {
          speakerId: speakerInfo?.speakerId || 'unknown',
          originalText: '', // No text extraction needed
          translatedText: '', // No translation
          translatedAudio: audio, // Original audio
          timestamp: audio.timestamp,
          latency: Date.now() - startTime,
        };
      }
      
      // Stage 3: Speech Recognition (Requirement 4.2)
      state.currentStage = PipelineStage.SPEECH_RECOGNITION;
      const recognitionResult = await this.recognizeSpeech(audio, languageInfo.languageCode);
      state.originalText = recognitionResult.text;
      
      // Skip if no text was recognized
      if (!recognitionResult.text || recognitionResult.text.trim().length === 0) {
        this.activePipelines.delete(segmentId);
        return null;
      }
      
      // Stage 4: Translation (Requirement 4.3)
      state.currentStage = PipelineStage.TRANSLATION;
      const translationResult = await this.translateText(
        recognitionResult.text,
        languageInfo.languageCode,
        targetLanguage
      );
      state.translatedText = translationResult.translatedText;
      
      // Stage 5: Speech Synthesis (Requirement 4.4)
      state.currentStage = PipelineStage.SPEECH_SYNTHESIS;
      const synthesisResult = await this.synthesizeSpeech(
        translationResult.translatedText,
        targetLanguage
      );
      const synthesizedAudio = synthesisResult.audio;
      
      // Stage 6: Output
      state.currentStage = PipelineStage.OUTPUT;
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Update metrics
      this.updateMetrics(state, latency, true);
      this.activePipelines.delete(segmentId);
      
      return {
        speakerId: speakerInfo?.speakerId || 'unknown',
        originalText: recognitionResult.text,
        translatedText: translationResult.translatedText,
        translatedAudio: synthesizedAudio,
        timestamp: audio.timestamp,
        latency,
      };
      
    } catch (error) {
      state.error = error as Error;
      this.updateMetrics(state, Date.now() - startTime, false);
      this.activePipelines.delete(segmentId);
      
      // Handle error with fallback strategies
      const handledError = this.errorHandler.handleError(
        createError(
          ErrorType.UNKNOWN,
          `Pipeline processing failed: ${(error as Error).message}`,
          ErrorSeverity.WARNING,
          { segmentId, stage: state.currentStage }
        )
      );
      
      if (handledError.shouldRetry) {
        // Retry logic could be implemented here
        console.warn(`Pipeline error, retry recommended: ${handledError.userMessage}`);
      }
      
      throw error;
    }
  }

  /**
   * Detect language from audio segment
   */
  private async detectLanguage(audio: AudioBuffer): Promise<LanguageInfo> {
    try {
      return await this.languageDetector.detect(audio);
    } catch (error) {
      console.error('Language detection failed:', error);
      // Return default language
      return {
        languageCode: 'en',
        confidence: 0.5,
        alternativeLanguages: [],
      };
    }
  }

  /**
   * Recognize speech from audio
   */
  private async recognizeSpeech(
    audio: AudioBuffer,
    language: string
  ): Promise<RecognitionResult> {
    return await this.speechRecognizer.recognize(audio, language);
  }

  /**
   * Translate text from source to target language
   */
  private async translateText(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult> {
    return await this.translationEngine.translate(text, sourceLang, targetLang);
  }

  /**
   * Synthesize speech from text
   */
  private async synthesizeSpeech(
    text: string,
    language: string
  ): Promise<{ audio: AudioBuffer }> {
    const result = await this.speechSynthesizer.synthesize(text, language);
    return { audio: result.audio };
  }

  /**
   * Check if translation should be skipped
   * 
   * Requirement 4.5: Skip translation when source equals target language
   */
  private shouldSkipTranslation(sourceLanguage: string, targetLanguage: string): boolean {
    if (!this.config.skipSameLanguageTranslation) {
      return false;
    }
    
    // Normalize language codes (e.g., 'en-US' -> 'en')
    const normalizedSource = this.normalizeLanguageCode(sourceLanguage);
    const normalizedTarget = this.normalizeLanguageCode(targetLanguage);
    
    return normalizedSource === normalizedTarget;
  }

  /**
   * Normalize language code to base language
   */
  private normalizeLanguageCode(languageCode: string): string {
    return languageCode.split('-')[0].toLowerCase();
  }

  /**
   * Generate unique segment ID
   */
  private generateSegmentId(): string {
    return `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): PipelineMetrics {
    return {
      totalProcessed: 0,
      successfulProcessed: 0,
      failedProcessed: 0,
      skippedTranslations: 0,
      averageLatency: 0,
      stageLatencies: {
        [PipelineStage.AUDIO_INPUT]: 0,
        [PipelineStage.LANGUAGE_DETECTION]: 0,
        [PipelineStage.SPEECH_RECOGNITION]: 0,
        [PipelineStage.TRANSLATION]: 0,
        [PipelineStage.SPEECH_SYNTHESIS]: 0,
        [PipelineStage.OUTPUT]: 0,
      },
    };
  }

  /**
   * Update metrics after processing
   */
  private updateMetrics(_state: PipelineState, latency: number, success: boolean): void {
    if (!this.config.enableMetrics) {
      return;
    }
    
    this.metrics.totalProcessed++;
    
    if (success) {
      this.metrics.successfulProcessed++;
    } else {
      this.metrics.failedProcessed++;
    }
    
    // Update latency history
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift();
    }
    
    // Calculate average latency
    this.metrics.averageLatency =
      this.latencyHistory.reduce((sum, l) => sum + l, 0) / this.latencyHistory.length;
  }

  /**
   * Get current pipeline metrics
   */
  getMetrics(): PipelineMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active pipeline states
   */
  getActivePipelines(): PipelineState[] {
    return Array.from(this.activePipelines.values());
  }

  /**
   * Get pipeline state by segment ID
   */
  getPipelineState(segmentId: string): PipelineState | undefined {
    return this.activePipelines.get(segmentId);
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.latencyHistory = [];
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Wait for active pipelines to complete or timeout
    const timeout = this.config.stageTimeout;
    const startTime = Date.now();
    
    while (this.activePipelines.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Clear remaining pipelines
    this.activePipelines.clear();
    
    // Log if any pipelines were forcefully cleared
    if (this.activePipelines.size > 0) {
      console.warn(`Cleanup: ${this.activePipelines.size} pipelines were forcefully cleared`);
    }
  }
}
