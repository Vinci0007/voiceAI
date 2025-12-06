/**
 * Translation Engine
 * 
 * Implements text translation with multiple engine support, batch optimization,
 * and caching mechanisms.
 * 
 * Requirements:
 * - 4.3: WHEN 文本被提取 THEN 系统 SHALL 将文本从源语言翻译为用户的目标语言
 */

import type { TranslationResult } from '../types';
import { ErrorHandler, ErrorType, ErrorSeverity, createError } from './ErrorHandler';

/**
 * Translation engine types
 */
export enum TranslationEngineType {
  GOOGLE_CLOUD = 'google_cloud',
  DEEPL = 'deepl',
  NLLB_LOCAL = 'nllb_local',
  AUTO = 'auto',
}

/**
 * Configuration for translation engine
 */
export interface TranslationEngineConfig {
  /** Primary translation engine to use */
  primaryEngine: TranslationEngineType;
  /** Fallback engine if primary fails */
  fallbackEngine: TranslationEngineType;
  /** Google Cloud Translation API key */
  googleApiKey?: string;
  /** DeepL API key */
  deeplApiKey?: string;
  /** Enable translation caching */
  enableCache: boolean;
  /** Maximum cache size (number of entries) */
  maxCacheSize: number;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  /** Enable batch translation optimization */
  enableBatchOptimization: boolean;
  /** Maximum batch size for batch translation */
  maxBatchSize: number;
  /** Batch timeout in milliseconds */
  batchTimeout: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TranslationEngineConfig = {
  primaryEngine: TranslationEngineType.GOOGLE_CLOUD,
  fallbackEngine: TranslationEngineType.NLLB_LOCAL,
  enableCache: true,
  maxCacheSize: 10000,
  cacheTTL: 3600000, // 1 hour
  enableBatchOptimization: true,
  maxBatchSize: 100,
  batchTimeout: 100, // 100ms
};

/**
 * Cache entry
 */
interface CacheEntry {
  result: TranslationResult;
  timestamp: number;
}

/**
 * Batch translation request
 */
interface BatchRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  resolve: (result: TranslationResult) => void;
  reject: (error: Error) => void;
}

/**
 * Translation statistics
 */
export interface TranslationStats {
  totalTranslations: number;
  cacheHits: number;
  cacheMisses: number;
  batchTranslations: number;
  averageLatency: number;
  engineUsage: Record<TranslationEngineType, number>;
}

/**
 * TranslationEngine class
 * 
 * Provides translation capabilities with multiple engine support,
 * intelligent caching, and batch optimization.
 */
export class TranslationEngine {
  private config: TranslationEngineConfig;
  private cache: Map<string, CacheEntry>;
  private errorHandler: ErrorHandler;
  private batchQueue: Map<string, BatchRequest[]>;
  private batchTimers: Map<string, NodeJS.Timeout>;
  private stats: TranslationStats;
  private engineAvailability: Map<TranslationEngineType, boolean>;

  constructor(
    config: Partial<TranslationEngineConfig> = {},
    errorHandler: ErrorHandler = new ErrorHandler()
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.errorHandler = errorHandler;
    this.batchQueue = new Map();
    this.batchTimers = new Map();
    this.stats = {
      totalTranslations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      batchTranslations: 0,
      averageLatency: 0,
      engineUsage: {} as Record<TranslationEngineType, number>,
    };
    this.engineAvailability = new Map([
      [TranslationEngineType.GOOGLE_CLOUD, !!this.config.googleApiKey],
      [TranslationEngineType.DEEPL, !!this.config.deeplApiKey],
      [TranslationEngineType.NLLB_LOCAL, true], // Local model always available
    ]);
  }

  /**
   * Translate text from source language to target language
   * 
   * Requirement 4.3: Translates text from source to target language
   * 
   * @param text - Text to translate
   * @param sourceLang - Source language code (e.g., 'en', 'zh')
   * @param targetLang - Target language code
   * @returns Translation result with confidence
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult> {
    const startTime = Date.now();

    try {
      // Validate input
      if (!text || text.trim().length === 0) {
        return this.createEmptyResult(sourceLang, targetLang);
      }

      // Check if source and target are the same
      if (this.normalizeLanguageCode(sourceLang) === this.normalizeLanguageCode(targetLang)) {
        return {
          translatedText: text,
          sourceLang,
          targetLang,
          confidence: 1.0,
        };
      }

      // Check cache first
      if (this.config.enableCache) {
        const cached = this.getCachedTranslation(text, sourceLang, targetLang);
        if (cached) {
          this.stats.cacheHits++;
          this.updateLatency(Date.now() - startTime);
          return cached;
        }
        this.stats.cacheMisses++;
      }

      // Select engine
      const engine = this.selectEngine();

      // Perform translation
      const result = await this.errorHandler.fallback(
        () => this.translateWithEngine(text, sourceLang, targetLang, engine),
        () => this.translateWithEngine(
          text,
          sourceLang,
          targetLang,
          this.config.fallbackEngine
        )
      );

      // Cache result
      if (this.config.enableCache) {
        this.cacheTranslation(text, sourceLang, targetLang, result);
      }

      // Update statistics
      this.stats.totalTranslations++;
      this.stats.engineUsage[engine] = (this.stats.engineUsage[engine] || 0) + 1;
      this.updateLatency(Date.now() - startTime);

      return result;
    } catch (error) {
      const systemError = createError(
        ErrorType.TRANSLATION,
        `Translation failed: ${(error as Error).message}`,
        ErrorSeverity.WARNING,
        { text, sourceLang, targetLang },
        error as Error
      );
      this.errorHandler.handleError(systemError);

      // Return original text as fallback
      return {
        translatedText: text,
        sourceLang,
        targetLang,
        confidence: 0,
      };
    }
  }

  /**
   * Translate multiple texts in batch
   * 
   * Optimizes translation by batching multiple requests together.
   * 
   * @param texts - Array of texts to translate
   * @param sourceLang - Source language code
   * @param targetLang - Target language code
   * @returns Array of translation results
   */
  async translateBatch(
    texts: string[],
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult[]> {
    if (texts.length === 0) {
      return [];
    }

    // If batch optimization is disabled, translate individually
    if (!this.config.enableBatchOptimization) {
      return Promise.all(
        texts.map(text => this.translate(text, sourceLang, targetLang))
      );
    }

    try {
      // Check cache for all texts
      const results: (TranslationResult | null)[] = texts.map(text => {
        if (this.config.enableCache) {
          return this.getCachedTranslation(text, sourceLang, targetLang);
        }
        return null;
      });

      // Find texts that need translation
      const uncachedIndices: number[] = [];
      const uncachedTexts: string[] = [];
      results.forEach((result, index) => {
        if (!result) {
          uncachedIndices.push(index);
          uncachedTexts.push(texts[index]);
        }
      });

      // If all cached, return immediately
      if (uncachedTexts.length === 0) {
        this.stats.cacheHits += texts.length;
        return results as TranslationResult[];
      }

      this.stats.cacheMisses += uncachedTexts.length;

      // Translate uncached texts in batch
      const engine = this.selectEngine();
      const batchResults = await this.translateBatchWithEngine(
        uncachedTexts,
        sourceLang,
        targetLang,
        engine
      );

      // Fill in results and cache
      uncachedIndices.forEach((originalIndex, batchIndex) => {
        const result = batchResults[batchIndex];
        results[originalIndex] = result;
        
        if (this.config.enableCache) {
          this.cacheTranslation(
            texts[originalIndex],
            sourceLang,
            targetLang,
            result
          );
        }
      });

      // Update statistics
      this.stats.totalTranslations += texts.length;
      this.stats.batchTranslations += uncachedTexts.length;
      this.stats.engineUsage[engine] = (this.stats.engineUsage[engine] || 0) + uncachedTexts.length;

      return results as TranslationResult[];
    } catch (error) {
      const systemError = createError(
        ErrorType.TRANSLATION,
        `Batch translation failed: ${(error as Error).message}`,
        ErrorSeverity.WARNING,
        { count: texts.length, sourceLang, targetLang },
        error as Error
      );
      this.errorHandler.handleError(systemError);

      // Fallback to individual translation
      return Promise.all(
        texts.map(text => this.translate(text, sourceLang, targetLang))
      );
    }
  }

  /**
   * Queue text for batch translation
   * 
   * Adds text to batch queue and returns a promise that resolves when
   * the batch is processed.
   * 
   * @param text - Text to translate
   * @param sourceLang - Source language code
   * @param targetLang - Target language code
   * @returns Promise that resolves with translation result
   */
  queueForBatch(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult> {
    return new Promise((resolve, reject) => {
      const queueKey = `${sourceLang}-${targetLang}`;
      
      // Get or create queue for this language pair
      if (!this.batchQueue.has(queueKey)) {
        this.batchQueue.set(queueKey, []);
      }
      
      const queue = this.batchQueue.get(queueKey)!;
      queue.push({ text, sourceLang, targetLang, resolve, reject });

      // If queue is full, process immediately
      if (queue.length >= this.config.maxBatchSize) {
        this.processBatchQueue(queueKey);
      } else {
        // Otherwise, set/reset timer
        if (this.batchTimers.has(queueKey)) {
          clearTimeout(this.batchTimers.get(queueKey)!);
        }
        
        const timer = setTimeout(() => {
          this.processBatchQueue(queueKey);
        }, this.config.batchTimeout);
        
        this.batchTimers.set(queueKey, timer);
      }
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TranslationEngineConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update engine availability
    if (config.googleApiKey !== undefined) {
      this.engineAvailability.set(
        TranslationEngineType.GOOGLE_CLOUD,
        !!config.googleApiKey
      );
    }
    if (config.deeplApiKey !== undefined) {
      this.engineAvailability.set(
        TranslationEngineType.DEEPL,
        !!config.deeplApiKey
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): TranslationEngineConfig {
    return { ...this.config };
  }

  /**
   * Clear translation cache
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
   * Get translation statistics
   */
  getStats(): TranslationStats {
    return { ...this.stats };
  }

  /**
   * Check if an engine is available
   */
  isEngineAvailable(engine: TranslationEngineType): boolean {
    return this.engineAvailability.get(engine) ?? false;
  }

  /**
   * Select appropriate translation engine
   * 
   * @private
   */
  private selectEngine(): TranslationEngineType {
    // If AUTO mode, select based on availability
    if (this.config.primaryEngine === TranslationEngineType.AUTO) {
      // Prefer Google Cloud for better quality if available
      if (this.isEngineAvailable(TranslationEngineType.GOOGLE_CLOUD)) {
        return TranslationEngineType.GOOGLE_CLOUD;
      }
      // Then DeepL
      if (this.isEngineAvailable(TranslationEngineType.DEEPL)) {
        return TranslationEngineType.DEEPL;
      }
      // Finally local model
      return TranslationEngineType.NLLB_LOCAL;
    }

    // Use configured primary engine if available
    if (this.isEngineAvailable(this.config.primaryEngine)) {
      return this.config.primaryEngine;
    }

    // Fall back to available engine
    if (this.isEngineAvailable(this.config.fallbackEngine)) {
      return this.config.fallbackEngine;
    }

    // Default to local model (always available)
    return TranslationEngineType.NLLB_LOCAL;
  }

  /**
   * Translate using specified engine
   * 
   * @private
   */
  private async translateWithEngine(
    text: string,
    sourceLang: string,
    targetLang: string,
    engine: TranslationEngineType
  ): Promise<TranslationResult> {
    switch (engine) {
      case TranslationEngineType.GOOGLE_CLOUD:
        return await this.translateGoogleCloud(text, sourceLang, targetLang);
      case TranslationEngineType.DEEPL:
        return await this.translateDeepL(text, sourceLang, targetLang);
      case TranslationEngineType.NLLB_LOCAL:
        return await this.translateNLLB(text, sourceLang, targetLang);
      default:
        throw new Error(`Unsupported engine: ${engine}`);
    }
  }

  /**
   * Translate batch using specified engine
   * 
   * @private
   */
  private async translateBatchWithEngine(
    texts: string[],
    sourceLang: string,
    targetLang: string,
    engine: TranslationEngineType
  ): Promise<TranslationResult[]> {
    switch (engine) {
      case TranslationEngineType.GOOGLE_CLOUD:
        return await this.translateBatchGoogleCloud(texts, sourceLang, targetLang);
      case TranslationEngineType.DEEPL:
        return await this.translateBatchDeepL(texts, sourceLang, targetLang);
      case TranslationEngineType.NLLB_LOCAL:
        return await this.translateBatchNLLB(texts, sourceLang, targetLang);
      default:
        throw new Error(`Unsupported engine: ${engine}`);
    }
  }

  /**
   * Translate using Google Cloud Translation API
   * 
   * @private
   */
  private async translateGoogleCloud(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult> {
    if (!this.config.googleApiKey) {
      throw new Error('Google Cloud API key not configured');
    }

    // In production, this would call the actual Google Cloud Translation API:
    // const response = await fetch('https://translation.googleapis.com/language/translate/v2', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.config.googleApiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     q: text,
    //     source: sourceLang,
    //     target: targetLang,
    //     format: 'text',
    //   }),
    // });
    // const data = await response.json();

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.debug('Google Cloud translation called:', { text, sourceLang, targetLang });

    // Mock response
    return {
      translatedText: `[Google] Translated: ${text}`,
      sourceLang,
      targetLang,
      confidence: 0.95,
    };
  }

  /**
   * Translate batch using Google Cloud Translation API
   * 
   * @private
   */
  private async translateBatchGoogleCloud(
    texts: string[],
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult[]> {
    if (!this.config.googleApiKey) {
      throw new Error('Google Cloud API key not configured');
    }

    // Simulate batch API call
    await new Promise(resolve => setTimeout(resolve, 400));
    
    console.debug('Google Cloud batch translation called:', { count: texts.length, sourceLang, targetLang });

    // Mock batch response
    return texts.map(text => ({
      translatedText: `[Google] Translated: ${text}`,
      sourceLang,
      targetLang,
      confidence: 0.95,
    }));
  }

  /**
   * Translate using DeepL API
   * 
   * @private
   */
  private async translateDeepL(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult> {
    if (!this.config.deeplApiKey) {
      throw new Error('DeepL API key not configured');
    }

    // In production, this would call the actual DeepL API:
    // const response = await fetch('https://api-free.deepl.com/v2/translate', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `DeepL-Auth-Key ${this.config.deeplApiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     text: [text],
    //     source_lang: sourceLang.toUpperCase(),
    //     target_lang: targetLang.toUpperCase(),
    //   }),
    // });
    // const data = await response.json();

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 350));
    
    console.debug('DeepL translation called:', { text, sourceLang, targetLang });

    // Mock response
    return {
      translatedText: `[DeepL] Translated: ${text}`,
      sourceLang,
      targetLang,
      confidence: 0.97,
    };
  }

  /**
   * Translate batch using DeepL API
   * 
   * @private
   */
  private async translateBatchDeepL(
    texts: string[],
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult[]> {
    if (!this.config.deeplApiKey) {
      throw new Error('DeepL API key not configured');
    }

    // Simulate batch API call
    await new Promise(resolve => setTimeout(resolve, 450));
    
    console.debug('DeepL batch translation called:', { count: texts.length, sourceLang, targetLang });

    // Mock batch response
    return texts.map(text => ({
      translatedText: `[DeepL] Translated: ${text}`,
      sourceLang,
      targetLang,
      confidence: 0.97,
    }));
  }

  /**
   * Translate using NLLB-200 local model
   * 
   * @private
   */
  private async translateNLLB(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult> {
    // In production, this would use ONNX Runtime with NLLB-200 model:
    // const session = await ort.InferenceSession.create('models/nllb-200-distilled.onnx');
    // const tokenizer = new Tokenizer('models/nllb-tokenizer.json');
    // const tokens = tokenizer.encode(text, sourceLang);
    // const results = await session.run({ input_ids: tokens });
    // const translatedText = tokenizer.decode(results.output_ids, targetLang);

    // Simulate local model inference
    await new Promise(resolve => setTimeout(resolve, 400));
    
    console.debug('NLLB local translation called:', { text, sourceLang, targetLang });

    // Mock response (lower confidence than cloud APIs)
    return {
      translatedText: `[NLLB] Translated: ${text}`,
      sourceLang,
      targetLang,
      confidence: 0.85,
    };
  }

  /**
   * Translate batch using NLLB-200 local model
   * 
   * @private
   */
  private async translateBatchNLLB(
    texts: string[],
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult[]> {
    // Simulate batch local inference
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.debug('NLLB batch translation called:', { count: texts.length, sourceLang, targetLang });

    // Mock batch response
    return texts.map(text => ({
      translatedText: `[NLLB] Translated: ${text}`,
      sourceLang,
      targetLang,
      confidence: 0.85,
    }));
  }

  /**
   * Get cached translation
   * 
   * @private
   */
  private getCachedTranslation(
    text: string,
    sourceLang: string,
    targetLang: string
  ): TranslationResult | null {
    const key = this.getCacheKey(text, sourceLang, targetLang);
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

    return entry.result;
  }

  /**
   * Cache translation result
   * 
   * @private
   */
  private cacheTranslation(
    text: string,
    sourceLang: string,
    targetLang: string,
    result: TranslationResult
  ): void {
    const key = this.getCacheKey(text, sourceLang, targetLang);
    
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldestCacheEntry();
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Generate cache key
   * 
   * @private
   */
  private getCacheKey(text: string, sourceLang: string, targetLang: string): string {
    return `${sourceLang}:${targetLang}:${text}`;
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
   * Process batch queue for a language pair
   * 
   * @private
   */
  private async processBatchQueue(queueKey: string): Promise<void> {
    // Clear timer
    if (this.batchTimers.has(queueKey)) {
      clearTimeout(this.batchTimers.get(queueKey)!);
      this.batchTimers.delete(queueKey);
    }

    // Get and clear queue
    const queue = this.batchQueue.get(queueKey);
    if (!queue || queue.length === 0) {
      return;
    }
    this.batchQueue.delete(queueKey);

    try {
      // Extract texts and language info
      const texts = queue.map(req => req.text);
      const { sourceLang, targetLang } = queue[0];

      // Translate batch
      const results = await this.translateBatch(texts, sourceLang, targetLang);

      // Resolve all promises
      queue.forEach((req, index) => {
        req.resolve(results[index]);
      });
    } catch (error) {
      // Reject all promises
      queue.forEach(req => {
        req.reject(error as Error);
      });
    }
  }

  /**
   * Normalize language code
   * 
   * @private
   */
  private normalizeLanguageCode(lang: string): string {
    // Remove region code (e.g., 'en-US' -> 'en')
    return lang.split('-')[0].toLowerCase();
  }

  /**
   * Update average latency
   * 
   * @private
   */
  private updateLatency(latency: number): void {
    const total = this.stats.totalTranslations;
    this.stats.averageLatency = 
      (this.stats.averageLatency * (total - 1) + latency) / total;
  }

  /**
   * Create empty translation result
   * 
   * @private
   */
  private createEmptyResult(sourceLang: string, targetLang: string): TranslationResult {
    return {
      translatedText: '',
      sourceLang,
      targetLang,
      confidence: 0,
    };
  }
}

/**
 * Singleton instance for global use
 */
export const translationEngine = new TranslationEngine();
