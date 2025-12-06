/**
 * ConferenceManager - Multi-speaker conference functionality
 * 
 * Manages multi-person conference sessions with:
 * - Audio stream separation for multiple speakers
 * - Independent translation queues per speaker
 * - Translation result ordering management
 * - Audio mixing for output
 * 
 * Requirements:
 * - 7.1: Support up to 10 simultaneous speakers
 * - 7.2: Separate audio streams for each speaker
 * - 7.3: Maintain independent translation queues per speaker
 * - 7.4: Output translations in reception order
 * - 7.5: Mix overlapping audio outputs
 */

import type {
  AudioBuffer,
  ProcessedOutput,
  SpeakerInfo,
} from '../types';
import { StreamProcessor } from './StreamProcessor';

/**
 * Translation queue item for a speaker
 */
export interface TranslationQueueItem {
  id: string;
  speakerId: string;
  audio: AudioBuffer;
  receptionOrder: number;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: ProcessedOutput;
  error?: Error;
}

/**
 * Speaker stream state
 */
export interface SpeakerStream {
  speakerId: string;
  speakerInfo: SpeakerInfo;
  queue: TranslationQueueItem[];
  isActive: boolean;
  lastActivityTime: number;
}

/**
 * Audio mixing configuration
 */
export interface AudioMixConfig {
  /** Maximum number of simultaneous audio outputs */
  maxSimultaneousOutputs: number;
  /** Volume adjustment for mixed audio (0-1) */
  mixVolume: number;
  /** Enable automatic gain control */
  enableAGC: boolean;
}

/**
 * Conference statistics
 */
export interface ConferenceStats {
  totalSpeakers: number;
  activeSpeakers: number;
  totalProcessed: number;
  queuedItems: number;
  averageQueueTime: number;
  mixedOutputs: number;
}

/**
 * Default audio mixing configuration
 */
const DEFAULT_MIX_CONFIG: AudioMixConfig = {
  maxSimultaneousOutputs: 3,
  mixVolume: 0.7,
  enableAGC: true,
};

/**
 * ConferenceManager class
 * 
 * Manages multi-speaker conference sessions with independent processing
 * queues and audio mixing capabilities.
 */
export class ConferenceManager {
  private streamProcessor: StreamProcessor;
  private speakerStreams: Map<string, SpeakerStream>;
  private globalReceptionOrder: number;
  private completedOutputs: ProcessedOutput[];
  private mixConfig: AudioMixConfig;
  private stats: ConferenceStats;
  private maxSpeakers: number;

  constructor(
    streamProcessor?: StreamProcessor,
    maxSpeakers: number = 10,
    mixConfig: Partial<AudioMixConfig> = {}
  ) {
    this.streamProcessor = streamProcessor || new StreamProcessor();
    this.speakerStreams = new Map();
    this.globalReceptionOrder = 0;
    this.completedOutputs = [];
    this.mixConfig = { ...DEFAULT_MIX_CONFIG, ...mixConfig };
    this.maxSpeakers = maxSpeakers;
    this.stats = this.initializeStats();
  }

  /**
   * Process audio from multiple speakers
   * 
   * Requirement 7.2: Separates audio streams for each speaker
   * Requirement 7.3: Maintains independent translation queues
   * 
   * @param audio - Audio buffer to process
   * @param speakerInfo - Speaker identification information
   * @param userId - User ID for tracking
   * @param targetLanguage - Target language for translation
   * @returns Queue item ID
   */
  async processAudioSegment(
    audio: AudioBuffer,
    speakerInfo: SpeakerInfo,
    userId: string,
    targetLanguage: string
  ): Promise<string> {
    const speakerId = speakerInfo.speakerId;

    // Requirement 7.1: Check speaker limit
    if (!this.speakerStreams.has(speakerId) && this.speakerStreams.size >= this.maxSpeakers) {
      throw new Error(`Maximum number of speakers (${this.maxSpeakers}) reached`);
    }

    // Get or create speaker stream
    let speakerStream = this.speakerStreams.get(speakerId);
    if (!speakerStream) {
      speakerStream = this.createSpeakerStream(speakerId, speakerInfo);
      this.speakerStreams.set(speakerId, speakerStream);
      this.stats.totalSpeakers++;
    }

    // Update activity
    speakerStream.lastActivityTime = Date.now();
    speakerStream.isActive = true;

    // Create queue item with global reception order
    const queueItem: TranslationQueueItem = {
      id: this.generateQueueItemId(),
      speakerId,
      audio,
      receptionOrder: this.globalReceptionOrder++,
      timestamp: Date.now(),
      status: 'pending',
    };

    // Add to speaker's queue
    speakerStream.queue.push(queueItem);
    this.stats.queuedItems++;

    // Process asynchronously
    this.processQueueItem(queueItem, userId, targetLanguage).catch(error => {
      console.error(`Failed to process queue item ${queueItem.id}:`, error);
      queueItem.status = 'failed';
      queueItem.error = error as Error;
    });

    return queueItem.id;
  }

  /**
   * Process a single queue item through the translation pipeline
   */
  private async processQueueItem(
    queueItem: TranslationQueueItem,
    userId: string,
    targetLanguage: string
  ): Promise<void> {
    queueItem.status = 'processing';

    try {
      const speakerStream = this.speakerStreams.get(queueItem.speakerId);
      if (!speakerStream) {
        throw new Error(`Speaker stream not found: ${queueItem.speakerId}`);
      }

      // Process through pipeline
      const result = await this.streamProcessor.processAudioSegment(
        queueItem.audio,
        userId,
        targetLanguage,
        speakerStream.speakerInfo
      );

      if (result) {
        queueItem.result = result;
        queueItem.status = 'completed';
        this.completedOutputs.push(result);
        this.stats.totalProcessed++;
      } else {
        queueItem.status = 'completed';
      }
    } catch (error) {
      queueItem.status = 'failed';
      queueItem.error = error as Error;
      throw error;
    }
  }

  /**
   * Get completed outputs in reception order
   * 
   * Requirement 7.4: Output translations in reception order
   * 
   * @param limit - Maximum number of outputs to return
   * @returns Array of processed outputs sorted by reception order
   */
  getOutputsInOrder(limit?: number): ProcessedOutput[] {
    // Sort by original reception order (stored in timestamp)
    const sorted = [...this.completedOutputs].sort((a, b) => a.timestamp - b.timestamp);
    
    if (limit) {
      return sorted.slice(0, limit);
    }
    
    return sorted;
  }

  /**
   * Get next available output in reception order
   * 
   * @returns Next output or null if none available
   */
  getNextOutput(): ProcessedOutput | null {
    if (this.completedOutputs.length === 0) {
      return null;
    }

    // Find the output with the earliest timestamp
    const sorted = this.getOutputsInOrder(1);
    if (sorted.length > 0) {
      const output = sorted[0];
      // Remove from completed outputs
      const index = this.completedOutputs.indexOf(output);
      if (index > -1) {
        this.completedOutputs.splice(index, 1);
      }
      return output;
    }

    return null;
  }

  /**
   * Mix multiple audio buffers into a single output
   * 
   * Requirement 7.5: Mix overlapping audio outputs
   * 
   * @param audioBuffers - Array of audio buffers to mix
   * @returns Mixed audio buffer
   */
  mixAudioOutputs(audioBuffers: AudioBuffer[]): AudioBuffer {
    if (audioBuffers.length === 0) {
      throw new Error('No audio buffers to mix');
    }

    if (audioBuffers.length === 1) {
      return audioBuffers[0];
    }

    // Limit simultaneous outputs
    const buffersToMix = audioBuffers.slice(0, this.mixConfig.maxSimultaneousOutputs);

    // Find the longest buffer to determine output length
    const maxLength = Math.max(...buffersToMix.map(b => b.data.length));
    const sampleRate = buffersToMix[0].sampleRate;
    const channels = buffersToMix[0].channels;

    // Create output buffer
    const mixedData = new Float32Array(maxLength);

    // Mix audio data
    for (const buffer of buffersToMix) {
      for (let i = 0; i < buffer.data.length; i++) {
        mixedData[i] += buffer.data[i] * this.mixConfig.mixVolume;
      }
    }

    // Apply automatic gain control if enabled
    if (this.mixConfig.enableAGC) {
      this.applyAGC(mixedData, buffersToMix.length);
    }

    this.stats.mixedOutputs++;

    return {
      data: mixedData,
      sampleRate,
      channels,
      timestamp: Math.min(...buffersToMix.map(b => b.timestamp)),
    };
  }

  /**
   * Apply automatic gain control to prevent clipping
   */
  private applyAGC(data: Float32Array, numSources: number): void {
    // Calculate peak amplitude
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }

    // Apply gain reduction if needed
    if (peak > 1.0) {
      const gain = 1.0 / peak;
      for (let i = 0; i < data.length; i++) {
        data[i] *= gain;
      }
    } else if (numSources > 1) {
      // Normalize for multiple sources
      const gain = Math.min(1.0, 1.0 / Math.sqrt(numSources));
      for (let i = 0; i < data.length; i++) {
        data[i] *= gain;
      }
    }
  }

  /**
   * Get overlapping audio outputs for mixing
   * 
   * @param timeWindowMs - Time window in milliseconds to consider for overlap
   * @returns Array of overlapping audio buffers
   */
  getOverlappingOutputs(timeWindowMs: number = 1000): AudioBuffer[] {
    const now = Date.now();
    const overlapping: AudioBuffer[] = [];

    for (const output of this.completedOutputs) {
      if (now - output.timestamp <= timeWindowMs) {
        overlapping.push(output.translatedAudio);
      }
    }

    return overlapping;
  }

  /**
   * Create a new speaker stream
   */
  private createSpeakerStream(speakerId: string, speakerInfo: SpeakerInfo): SpeakerStream {
    return {
      speakerId,
      speakerInfo,
      queue: [],
      isActive: true,
      lastActivityTime: Date.now(),
    };
  }

  /**
   * Generate unique queue item ID
   */
  private generateQueueItemId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): ConferenceStats {
    return {
      totalSpeakers: 0,
      activeSpeakers: 0,
      totalProcessed: 0,
      queuedItems: 0,
      averageQueueTime: 0,
      mixedOutputs: 0,
    };
  }

  /**
   * Get speaker stream by ID
   */
  getSpeakerStream(speakerId: string): SpeakerStream | undefined {
    return this.speakerStreams.get(speakerId);
  }

  /**
   * Get all speaker streams
   */
  getAllSpeakerStreams(): SpeakerStream[] {
    return Array.from(this.speakerStreams.values());
  }

  /**
   * Get active speaker streams
   */
  getActiveSpeakerStreams(): SpeakerStream[] {
    return this.getAllSpeakerStreams().filter(stream => stream.isActive);
  }

  /**
   * Get queue status for a speaker
   */
  getSpeakerQueueStatus(speakerId: string): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const stream = this.speakerStreams.get(speakerId);
    if (!stream) {
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    return {
      pending: stream.queue.filter(item => item.status === 'pending').length,
      processing: stream.queue.filter(item => item.status === 'processing').length,
      completed: stream.queue.filter(item => item.status === 'completed').length,
      failed: stream.queue.filter(item => item.status === 'failed').length,
    };
  }

  /**
   * Get conference statistics
   */
  getStats(): ConferenceStats {
    // Update active speakers count
    this.stats.activeSpeakers = this.getActiveSpeakerStreams().length;
    
    // Calculate average queue time
    let totalQueueTime = 0;
    let completedCount = 0;
    
    for (const stream of this.speakerStreams.values()) {
      for (const item of stream.queue) {
        if (item.status === 'completed' && item.result) {
          totalQueueTime += item.result.latency;
          completedCount++;
        }
      }
    }
    
    this.stats.averageQueueTime = completedCount > 0 ? totalQueueTime / completedCount : 0;
    
    return { ...this.stats };
  }

  /**
   * Clear completed outputs
   */
  clearCompletedOutputs(): void {
    this.completedOutputs = [];
  }

  /**
   * Remove inactive speakers
   * 
   * @param inactivityThresholdMs - Time in ms after which a speaker is considered inactive
   */
  removeInactiveSpeakers(inactivityThresholdMs: number = 60000): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [speakerId, stream] of this.speakerStreams.entries()) {
      if (now - stream.lastActivityTime > inactivityThresholdMs) {
        toRemove.push(speakerId);
      }
    }

    for (const speakerId of toRemove) {
      this.speakerStreams.delete(speakerId);
      console.log(`Removed inactive speaker: ${speakerId}`);
    }
  }

  /**
   * Reset conference state
   */
  reset(): void {
    this.speakerStreams.clear();
    this.completedOutputs = [];
    this.globalReceptionOrder = 0;
    this.stats = this.initializeStats();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Wait for pending items to complete
    const maxWaitTime = 5000;
    const startTime = Date.now();

    while (this.hasPendingItems() && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clear all data
    this.reset();
  }

  /**
   * Check if there are pending items in any queue
   */
  private hasPendingItems(): boolean {
    for (const stream of this.speakerStreams.values()) {
      if (stream.queue.some(item => item.status === 'pending' || item.status === 'processing')) {
        return true;
      }
    }
    return false;
  }
}
