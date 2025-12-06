import { invoke } from '@tauri-apps/api/tauri';

export interface SpeakerInfo {
  speaker_id: string;
  confidence: number;
  is_new_speaker: boolean;
}

/**
 * Identify speaker from audio data
 * @param audioData - Float32 audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns Speaker information including ID and confidence
 */
export async function identifySpeaker(
  audioData: Float32Array,
  sampleRate: number
): Promise<SpeakerInfo> {
  return await invoke<SpeakerInfo>('identify_speaker', {
    audioData: Array.from(audioData),
    sampleRate,
  });
}

/**
 * Register a new speaker with their voiceprint
 * @param speakerId - Unique speaker identifier
 * @param audioData - Float32 audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns The registered speaker ID
 */
export async function registerSpeaker(
  speakerId: string,
  audioData: Float32Array,
  sampleRate: number
): Promise<string> {
  return await invoke<string>('register_speaker', {
    speakerId,
    audioData: Array.from(audioData),
    sampleRate,
  });
}

/**
 * Update an existing speaker's voiceprint with new audio sample
 * @param speakerId - Speaker identifier
 * @param audioData - Float32 audio samples
 * @param sampleRate - Sample rate in Hz
 */
export async function updateSpeakerVoiceprint(
  speakerId: string,
  audioData: Float32Array,
  sampleRate: number
): Promise<void> {
  await invoke('update_speaker_voiceprint', {
    speakerId,
    audioData: Array.from(audioData),
    sampleRate,
  });
}

/**
 * Load all speaker voiceprints from database
 */
export async function loadSpeakerVoiceprints(): Promise<void> {
  await invoke('load_speaker_voiceprints');
}

/**
 * Get all registered speaker IDs
 * @returns Array of speaker IDs
 */
export async function getSpeakerIds(): Promise<string[]> {
  return await invoke<string[]>('get_speaker_ids');
}
