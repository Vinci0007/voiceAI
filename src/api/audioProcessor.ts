import { invoke } from '@tauri-apps/api/tauri';

export interface AudioQuality {
  snr: number;
  clarity: number;
  has_echo: boolean;
  has_noise: boolean;
}

export interface ProcessedAudio {
  samples: number[];
  sample_rate: number;
  channels: number;
  quality: AudioQuality;
  timestamp: number;
}

export class AudioProcessorAPI {
  /**
   * Initialize audio input device
   */
  static async initializeInput(): Promise<void> {
    return invoke('initialize_audio_input');
  }

  /**
   * Initialize audio output device
   */
  static async initializeOutput(): Promise<void> {
    return invoke('initialize_audio_output');
  }

  /**
   * Process audio data with noise reduction, echo cancellation, and volume normalization
   */
  static async processAudio(
    audioData: Float32Array,
    sampleRate: number,
    channels: number
  ): Promise<ProcessedAudio> {
    return invoke('process_audio', {
      audioData: Array.from(audioData),
      sampleRate,
      channels,
    });
  }

  /**
   * Get list of available input devices
   */
  static async getInputDevices(): Promise<string[]> {
    return invoke('get_input_devices');
  }

  /**
   * Get list of available output devices
   */
  static async getOutputDevices(): Promise<string[]> {
    return invoke('get_output_devices');
  }

  /**
   * Check if audio quality is acceptable
   */
  static isQualityAcceptable(quality: AudioQuality): boolean {
    return (
      quality.snr > 10 && // SNR should be above 10 dB
      quality.clarity > 0.3 && // Clarity should be above 30%
      !quality.has_echo // No echo detected
    );
  }

  /**
   * Get quality description for user display
   */
  static getQualityDescription(quality: AudioQuality): string {
    if (quality.snr > 20 && quality.clarity > 0.7) {
      return '优秀';
    } else if (quality.snr > 15 && quality.clarity > 0.5) {
      return '良好';
    } else if (quality.snr > 10 && quality.clarity > 0.3) {
      return '一般';
    } else {
      return '较差';
    }
  }

  /**
   * Get quality issues for user notification
   */
  static getQualityIssues(quality: AudioQuality): string[] {
    const issues: string[] = [];

    if (quality.snr < 10) {
      issues.push('信噪比过低');
    }

    if (quality.clarity < 0.3) {
      issues.push('音频清晰度不足');
    }

    if (quality.has_echo) {
      issues.push('检测到回声');
    }

    if (quality.has_noise) {
      issues.push('背景噪音过大');
    }

    return issues;
  }
}
