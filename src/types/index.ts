// Core data models based on design document

export enum SessionMode {
  CONFERENCE = 'conference',
  CHAT = 'chat',
}

export enum SessionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
}

export enum NetworkQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  OFFLINE = 'offline',
}

export interface Session {
  id: string;
  mode: SessionMode;
  participants: Participant[];
  createdAt: Date;
  state: SessionState;
}

export interface SessionState {
  status: SessionStatus;
  activeParticipants: number;
  totalMessages: number;
  averageLatency: number;
  networkQuality: NetworkQuality;
}

export interface Participant {
  id: string;
  name: string;
  preferredLanguage: string;
  voiceprint?: Voiceprint;
  joinedAt: Date;
  isMuted: boolean;
}

export interface Voiceprint {
  embedding: Float32Array;
  speakerId: string;
  samples: number;
}

export interface Message {
  id: string;
  sessionId: string;
  speakerId: string;
  timestamp: Date;
  originalText: string;
  originalLanguage: string;
  translations: Map<string, string>;
}

export interface AudioBuffer {
  data: Float32Array;
  sampleRate: number;
  channels: number;
  timestamp: number;
}

export interface ProcessedAudio {
  buffer: AudioBuffer;
  quality: AudioQuality;
  timestamp: number;
}

export interface AudioQuality {
  snr: number; // Signal-to-Noise Ratio
  clarity: number; // 0-1
  hasEcho: boolean;
  hasNoise: boolean;
}

export interface SpeakerInfo {
  speakerId: string;
  confidence: number;
  isNewSpeaker: boolean;
}

export interface LanguageInfo {
  languageCode: string;
  confidence: number;
  alternativeLanguages: Array<{ code: string; confidence: number }>;
}

export interface RecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  alternatives: Array<{ text: string; confidence: number }>;
}

export interface TranslationResult {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  confidence: number;
}

export interface VoiceConfig {
  voiceId: string;
  pitch: number;
  speed: number;
  volume: number;
}

export interface ProcessedOutput {
  speakerId: string;
  originalText: string;
  translatedText: string;
  translatedAudio: AudioBuffer;
  timestamp: number;
  latency: number;
}

export interface PerformanceMetrics {
  audioLatency: number;
  recognitionLatency: number;
  translationLatency: number;
  synthesisLatency: number;
  endToEndLatency: number;
  memoryUsage: number;
  cpuUsage: number;
  audioQuality: number;
  recognitionAccuracy: number;
  translationQuality: number;
}
