import { AudioProcessorAPI, ProcessedAudio } from '../api/tauri';

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bufferSize: number;
}

export interface AudioStreamCallback {
  onAudioData: (processedAudio: ProcessedAudio) => void;
  onQualityIssue: (issues: string[]) => void;
  onError: (error: Error) => void;
}

export class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private isRecording = false;
  private config: AudioConfig;
  private callback: AudioStreamCallback | null = null;

  constructor(config?: Partial<AudioConfig>) {
    this.config = {
      sampleRate: config?.sampleRate || 16000,
      channels: config?.channels || 1,
      bufferSize: config?.bufferSize || 4096,
    };
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Tauri audio processor
      await AudioProcessorAPI.initializeInput();
      await AudioProcessorAPI.initializeOutput();

      // Initialize Web Audio API
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      });
    } catch (error) {
      throw new Error(`Failed to initialize audio: ${error}`);
    }
  }

  async startRecording(callback: AudioStreamCallback): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    this.callback = callback;

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: false, // We handle this in Rust
          noiseSuppression: false, // We handle this in Rust
          autoGainControl: false, // We handle this in Rust
        },
      });

      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }

      // Create audio source
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for audio data
      const processor = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        this.config.channels,
        this.config.channels
      );

      processor.onaudioprocess = async (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        await this.processAudioChunk(inputData);
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      this.isRecording = true;
    } catch (error) {
      this.callback?.onError(error as Error);
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    this.isRecording = false;
    this.callback = null;
  }

  private async processAudioChunk(audioData: Float32Array): Promise<void> {
    if (!this.callback) {
      return;
    }

    try {
      // Send to Rust for processing
      const processed = await AudioProcessorAPI.processAudio(
        audioData,
        this.config.sampleRate,
        this.config.channels
      );

      // Check quality
      const issues = AudioProcessorAPI.getQualityIssues(processed.quality);
      if (issues.length > 0) {
        this.callback.onQualityIssue(issues);
      }

      // Send processed audio to callback
      this.callback.onAudioData(processed);
    } catch (error) {
      this.callback.onError(error as Error);
    }
  }

  async getAvailableDevices(): Promise<{
    input: string[];
    output: string[];
  }> {
    const [input, output] = await Promise.all([
      AudioProcessorAPI.getInputDevices(),
      AudioProcessorAPI.getOutputDevices(),
    ]);

    return { input, output };
  }

  isActive(): boolean {
    return this.isRecording;
  }

  getConfig(): AudioConfig {
    return { ...this.config };
  }

  async cleanup(): Promise<void> {
    await this.stopRecording();

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}
