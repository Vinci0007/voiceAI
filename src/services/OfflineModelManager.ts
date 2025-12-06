/**
 * Offline Model Manager
 * 
 * Manages local model loading, caching, and availability for offline mode operation.
 * Handles model downloads, updates, and lifecycle management.
 * 
 * Requirements:
 * - 8.1: WHEN 网络连接中断 THEN 系统 SHALL 切换到离线模式并通知用户
 * - 8.2: WHILE 离线模式激活 THEN 系统 SHALL 使用本地缓存的模型继续提供基本功能
 * - 8.3: WHEN 网络连接恢复 THEN 系统 SHALL 自动重新连接并同步离线期间的数据
 */

import { ErrorHandler, ErrorType, ErrorSeverity, createError } from './ErrorHandler';

/**
 * Model types supported by the system
 */
export enum ModelType {
  SPEECH_RECOGNITION = 'speech_recognition',
  TRANSLATION = 'translation',
  SPEECH_SYNTHESIS = 'speech_synthesis',
  LANGUAGE_DETECTION = 'language_detection',
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  type: ModelType;
  language: string;
  version: string;
  size: number; // Size in bytes
  isDownloaded: boolean;
  isLoaded: boolean;
  downloadProgress?: number; // 0-100
  lastUpdated?: Date;
  path?: string;
}

/**
 * Model download options
 */
export interface ModelDownloadOptions {
  priority: 'high' | 'normal' | 'low';
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Offline capability status
 */
export interface OfflineCapability {
  isAvailable: boolean;
  availableLanguages: string[];
  missingModels: ModelInfo[];
  totalSize: number;
  usedSize: number;
}

/**
 * Model registry entry
 */
interface ModelRegistryEntry {
  info: ModelInfo;
  instance?: any; // Loaded model instance
  loadPromise?: Promise<any>;
}

/**
 * Configuration for offline model manager
 */
export interface OfflineModelManagerConfig {
  /** Base path for model storage */
  modelBasePath: string;
  /** Maximum storage size for models (bytes) */
  maxStorageSize: number;
  /** Enable automatic model updates */
  enableAutoUpdate: boolean;
  /** Model update check interval (ms) */
  updateCheckInterval: number;
  /** Preferred languages for pre-loading */
  preferredLanguages: string[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: OfflineModelManagerConfig = {
  modelBasePath: '/models',
  maxStorageSize: 2 * 1024 * 1024 * 1024, // 2GB
  enableAutoUpdate: true,
  updateCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
  preferredLanguages: ['en', 'zh', 'es', 'fr', 'de'],
};

/**
 * OfflineModelManager class
 * 
 * Manages local models for offline operation, including downloading,
 * loading, and lifecycle management.
 */
export class OfflineModelManager {
  private config: OfflineModelManagerConfig;
  private errorHandler: ErrorHandler;
  private modelRegistry: Map<string, ModelRegistryEntry>;
  private downloadQueue: Map<string, ModelDownloadOptions>;
  private updateTimer: NodeJS.Timeout | null = null;
  private storageUsed: number = 0;

  constructor(
    config: Partial<OfflineModelManagerConfig> = {},
    errorHandler: ErrorHandler = new ErrorHandler()
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.errorHandler = errorHandler;
    this.modelRegistry = new Map();
    this.downloadQueue = new Map();

    // Initialize model registry with available models
    this.initializeModelRegistry();

    // Start update checker if enabled
    if (this.config.enableAutoUpdate) {
      this.startUpdateChecker();
    }
  }

  /**
   * Check if offline mode is available for a language
   * 
   * Requirement 8.2: Verify local models are available for offline operation
   * 
   * @param language - Language code to check
   * @returns True if all required models are available
   */
  isOfflineAvailable(language: string): boolean {
    const requiredModels = this.getRequiredModelsForLanguage(language);
    return requiredModels.every(modelId => {
      const entry = this.modelRegistry.get(modelId);
      return entry && entry.info.isDownloaded;
    });
  }

  /**
   * Get offline capability status
   * 
   * @returns Current offline capability information
   */
  getOfflineCapability(): OfflineCapability {
    const availableLanguages: string[] = [];
    const missingModels: ModelInfo[] = [];
    let totalSize = 0;

    // Check each preferred language
    for (const lang of this.config.preferredLanguages) {
      const requiredModels = this.getRequiredModelsForLanguage(lang);
      const allAvailable = requiredModels.every(modelId => {
        const entry = this.modelRegistry.get(modelId);
        if (entry) {
          totalSize += entry.info.size;
          if (!entry.info.isDownloaded) {
            missingModels.push(entry.info);
            return false;
          }
          return true;
        }
        return false;
      });

      if (allAvailable) {
        availableLanguages.push(lang);
      }
    }

    return {
      isAvailable: availableLanguages.length > 0,
      availableLanguages,
      missingModels,
      totalSize,
      usedSize: this.storageUsed,
    };
  }

  /**
   * Load model for use
   * 
   * @param modelId - Model identifier
   * @returns Loaded model instance
   */
  async loadModel(modelId: string): Promise<any> {
    const entry = this.modelRegistry.get(modelId);
    
    if (!entry) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // If already loaded, return cached instance
    if (entry.instance) {
      return entry.instance;
    }

    // If loading in progress, wait for it
    if (entry.loadPromise) {
      return await entry.loadPromise;
    }

    // Start loading
    entry.loadPromise = this.performModelLoad(entry);
    
    try {
      const instance = await entry.loadPromise;
      entry.instance = instance;
      entry.info.isLoaded = true;
      entry.loadPromise = undefined;
      return instance;
    } catch (error) {
      entry.loadPromise = undefined;
      throw error;
    }
  }

  /**
   * Unload model to free memory
   * 
   * @param modelId - Model identifier
   */
  unloadModel(modelId: string): void {
    const entry = this.modelRegistry.get(modelId);
    
    if (entry && entry.instance) {
      // Cleanup model instance
      if (typeof entry.instance.dispose === 'function') {
        entry.instance.dispose();
      }
      
      entry.instance = undefined;
      entry.info.isLoaded = false;
    }
  }

  /**
   * Download model for offline use
   * 
   * @param modelId - Model identifier
   * @param options - Download options
   */
  async downloadModel(
    modelId: string,
    options: Partial<ModelDownloadOptions> = {}
  ): Promise<void> {
    const entry = this.modelRegistry.get(modelId);
    
    if (!entry) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (entry.info.isDownloaded) {
      console.log(`Model already downloaded: ${modelId}`);
      return;
    }

    // Check storage space
    if (this.storageUsed + entry.info.size > this.config.maxStorageSize) {
      throw new Error('Insufficient storage space for model download');
    }

    const downloadOptions: ModelDownloadOptions = {
      priority: 'normal',
      ...options,
    };

    // Add to download queue
    this.downloadQueue.set(modelId, downloadOptions);

    try {
      await this.performModelDownload(entry, downloadOptions);
      
      entry.info.isDownloaded = true;
      entry.info.lastUpdated = new Date();
      this.storageUsed += entry.info.size;
      
      this.downloadQueue.delete(modelId);
      
      if (downloadOptions.onComplete) {
        downloadOptions.onComplete();
      }
    } catch (error) {
      this.downloadQueue.delete(modelId);
      
      if (downloadOptions.onError) {
        downloadOptions.onError(error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Delete model to free storage
   * 
   * @param modelId - Model identifier
   */
  async deleteModel(modelId: string): Promise<void> {
    const entry = this.modelRegistry.get(modelId);
    
    if (!entry) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Unload if loaded
    if (entry.info.isLoaded) {
      this.unloadModel(modelId);
    }

    // Delete model files
    if (entry.info.isDownloaded) {
      await this.performModelDelete(entry);
      
      entry.info.isDownloaded = false;
      entry.info.path = undefined;
      this.storageUsed -= entry.info.size;
    }
  }

  /**
   * Get list of all available models
   * 
   * @returns Array of model information
   */
  getAvailableModels(): ModelInfo[] {
    return Array.from(this.modelRegistry.values()).map(entry => ({ ...entry.info }));
  }

  /**
   * Get models for a specific type
   * 
   * @param type - Model type
   * @returns Array of model information
   */
  getModelsByType(type: ModelType): ModelInfo[] {
    return this.getAvailableModels().filter(model => model.type === type);
  }

  /**
   * Get models for a specific language
   * 
   * @param language - Language code
   * @returns Array of model information
   */
  getModelsByLanguage(language: string): ModelInfo[] {
    return this.getAvailableModels().filter(model => model.language === language);
  }

  /**
   * Pre-load models for preferred languages
   * 
   * Loads models into memory for faster access
   */
  async preloadPreferredModels(): Promise<void> {
    const loadPromises: Promise<any>[] = [];

    for (const lang of this.config.preferredLanguages) {
      const requiredModels = this.getRequiredModelsForLanguage(lang);
      
      for (const modelId of requiredModels) {
        const entry = this.modelRegistry.get(modelId);
        if (entry && entry.info.isDownloaded && !entry.info.isLoaded) {
          loadPromises.push(
            this.loadModel(modelId).catch(error => {
              console.error(`Failed to preload model ${modelId}:`, error);
            })
          );
        }
      }
    }

    await Promise.all(loadPromises);
  }

  /**
   * Check for model updates
   * 
   * @returns Array of models that have updates available
   */
  async checkForUpdates(): Promise<ModelInfo[]> {
    // In production, this would check a remote server for model updates
    // For now, return empty array
    console.log('Checking for model updates...');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OfflineModelManagerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart update checker if auto-update setting changed
    if (config.enableAutoUpdate !== undefined) {
      if (config.enableAutoUpdate) {
        this.startUpdateChecker();
      } else {
        this.stopUpdateChecker();
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): OfflineModelManagerConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopUpdateChecker();
    
    // Unload all models
    for (const modelId of this.modelRegistry.keys()) {
      this.unloadModel(modelId);
    }
    
    this.modelRegistry.clear();
    this.downloadQueue.clear();
  }

  // Private methods

  /**
   * Initialize model registry with available models
   */
  private initializeModelRegistry(): void {
    // Define available models
    // In production, this would be loaded from a configuration file or API
    
    const models: ModelInfo[] = [
      // Speech Recognition Models (Vosk)
      {
        id: 'vosk-en',
        type: ModelType.SPEECH_RECOGNITION,
        language: 'en',
        version: '0.22',
        size: 50 * 1024 * 1024, // 50MB
        isDownloaded: false,
        isLoaded: false,
      },
      {
        id: 'vosk-zh',
        type: ModelType.SPEECH_RECOGNITION,
        language: 'zh',
        version: '0.22',
        size: 45 * 1024 * 1024, // 45MB
        isDownloaded: false,
        isLoaded: false,
      },
      {
        id: 'vosk-es',
        type: ModelType.SPEECH_RECOGNITION,
        language: 'es',
        version: '0.22',
        size: 40 * 1024 * 1024, // 40MB
        isDownloaded: false,
        isLoaded: false,
      },
      
      // Translation Models (NLLB-200 distilled)
      {
        id: 'nllb-200-distilled',
        type: ModelType.TRANSLATION,
        language: 'multi',
        version: '1.0',
        size: 200 * 1024 * 1024, // 200MB
        isDownloaded: false,
        isLoaded: false,
      },
      
      // Speech Synthesis Models (Piper TTS)
      {
        id: 'piper-en',
        type: ModelType.SPEECH_SYNTHESIS,
        language: 'en',
        version: '1.0',
        size: 30 * 1024 * 1024, // 30MB
        isDownloaded: false,
        isLoaded: false,
      },
      {
        id: 'piper-zh',
        type: ModelType.SPEECH_SYNTHESIS,
        language: 'zh',
        version: '1.0',
        size: 28 * 1024 * 1024, // 28MB
        isDownloaded: false,
        isLoaded: false,
      },
      {
        id: 'piper-es',
        type: ModelType.SPEECH_SYNTHESIS,
        language: 'es',
        version: '1.0',
        size: 25 * 1024 * 1024, // 25MB
        isDownloaded: false,
        isLoaded: false,
      },
      
      // Language Detection Model (fastText)
      {
        id: 'fasttext-lid',
        type: ModelType.LANGUAGE_DETECTION,
        language: 'multi',
        version: '1.0',
        size: 1 * 1024 * 1024, // 1MB
        isDownloaded: false,
        isLoaded: false,
      },
    ];

    // Register all models
    for (const model of models) {
      this.modelRegistry.set(model.id, { info: model });
    }
  }

  /**
   * Get required models for a language
   */
  private getRequiredModelsForLanguage(language: string): string[] {
    return [
      `vosk-${language}`, // Speech recognition
      'nllb-200-distilled', // Translation (multi-language)
      `piper-${language}`, // Speech synthesis
      'fasttext-lid', // Language detection
    ];
  }

  /**
   * Perform actual model loading
   */
  private async performModelLoad(entry: ModelRegistryEntry): Promise<any> {
    if (!entry.info.isDownloaded) {
      throw new Error(`Model not downloaded: ${entry.info.id}`);
    }

    console.log(`Loading model: ${entry.info.id}`);

    // In production, this would load the actual model using appropriate libraries:
    // - Vosk for speech recognition
    // - ONNX Runtime for NLLB translation
    // - Piper for TTS
    // - fastText for language detection

    // Simulate model loading
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock model instance
    return {
      id: entry.info.id,
      type: entry.info.type,
      dispose: () => {
        console.log(`Disposing model: ${entry.info.id}`);
      },
    };
  }

  /**
   * Perform actual model download
   */
  private async performModelDownload(
    entry: ModelRegistryEntry,
    options: ModelDownloadOptions
  ): Promise<void> {
    console.log(`Downloading model: ${entry.info.id}`);

    // In production, this would download from a CDN or model repository
    // For now, simulate download with progress updates

    const totalChunks = 10;
    for (let i = 0; i <= totalChunks; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const progress = (i / totalChunks) * 100;
      entry.info.downloadProgress = progress;
      
      if (options.onProgress) {
        options.onProgress(progress);
      }
    }

    // Set model path
    entry.info.path = `${this.config.modelBasePath}/${entry.info.id}`;
    entry.info.downloadProgress = undefined;
  }

  /**
   * Perform actual model deletion
   */
  private async performModelDelete(entry: ModelRegistryEntry): Promise<void> {
    console.log(`Deleting model: ${entry.info.id}`);

    // In production, this would delete model files from storage
    // For now, just simulate deletion
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Start automatic update checker
   */
  private startUpdateChecker(): void {
    if (this.updateTimer) {
      return;
    }

    this.updateTimer = setInterval(async () => {
      try {
        const updates = await this.checkForUpdates();
        if (updates.length > 0) {
          console.log(`Found ${updates.length} model updates available`);
        }
      } catch (error) {
        console.error('Update check failed:', error);
      }
    }, this.config.updateCheckInterval);
  }

  /**
   * Stop automatic update checker
   */
  private stopUpdateChecker(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
}

/**
 * Singleton instance for global use
 */
export const offlineModelManager = new OfflineModelManager();
