import {
  identifySpeaker,
  registerSpeaker,
  updateSpeakerVoiceprint,
  loadSpeakerVoiceprints,
  getSpeakerIds,
  SpeakerInfo,
} from '../api/speakerIdentifier';

/**
 * Service for managing speaker identification
 */
export class SpeakerIdentificationService {
  private initialized = false;

  /**
   * Initialize the service by loading existing voiceprints from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await loadSpeakerVoiceprints();
      this.initialized = true;
      console.log('Speaker identification service initialized');
    } catch (error) {
      console.error('Failed to initialize speaker identification:', error);
      throw error;
    }
  }

  /**
   * Identify speaker from audio data
   * @param audioData - Audio samples
   * @param sampleRate - Sample rate in Hz
   * @returns Speaker information
   */
  async identify(
    audioData: Float32Array,
    sampleRate: number
  ): Promise<SpeakerInfo> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const speakerInfo = await identifySpeaker(audioData, sampleRate);
      
      // If new speaker detected, you might want to prompt user for a name
      if (speakerInfo.is_new_speaker) {
        console.log(`New speaker detected: ${speakerInfo.speaker_id}`);
      } else {
        console.log(
          `Speaker identified: ${speakerInfo.speaker_id} (confidence: ${speakerInfo.confidence.toFixed(2)})`
        );
      }

      return speakerInfo;
    } catch (error) {
      console.error('Failed to identify speaker:', error);
      throw error;
    }
  }

  /**
   * Register a new speaker with custom ID
   * @param speakerId - Custom speaker identifier
   * @param audioData - Audio samples for voiceprint
   * @param sampleRate - Sample rate in Hz
   */
  async register(
    speakerId: string,
    audioData: Float32Array,
    sampleRate: number
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await registerSpeaker(speakerId, audioData, sampleRate);
      console.log(`Speaker registered: ${speakerId}`);
    } catch (error) {
      console.error('Failed to register speaker:', error);
      throw error;
    }
  }

  /**
   * Update speaker's voiceprint with new audio sample
   * @param speakerId - Speaker identifier
   * @param audioData - New audio samples
   * @param sampleRate - Sample rate in Hz
   */
  async updateVoiceprint(
    speakerId: string,
    audioData: Float32Array,
    sampleRate: number
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await updateSpeakerVoiceprint(speakerId, audioData, sampleRate);
      console.log(`Voiceprint updated for speaker: ${speakerId}`);
    } catch (error) {
      console.error('Failed to update voiceprint:', error);
      throw error;
    }
  }

  /**
   * Get all registered speaker IDs
   * @returns Array of speaker IDs
   */
  async getAllSpeakers(): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await getSpeakerIds();
    } catch (error) {
      console.error('Failed to get speaker IDs:', error);
      throw error;
    }
  }

  /**
   * Check if speaker identification is ready
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const speakerIdentificationService = new SpeakerIdentificationService();
