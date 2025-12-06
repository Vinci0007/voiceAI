/**
 * Services module - 导出所有服务类
 */

export { SessionManager } from './SessionManager';
export { SessionStore } from './SessionStore';
export {
  ErrorHandler,
  ErrorType,
  ErrorSeverity,
  createError,
  globalErrorHandler,
} from './ErrorHandler';
export type { SystemError, ErrorResponse, RetryOptions } from './ErrorHandler';
export { AudioService } from './AudioService';
export type { AudioConfig, AudioStreamCallback } from './AudioService';
export { SpeakerIdentificationService, speakerIdentificationService } from './SpeakerIdentificationService';
export { LanguageDetector, languageDetector } from './LanguageDetector';
export type { LanguageDetectorConfig } from './LanguageDetector';
export { SpeechRecognizer, RecognitionEngine, speechRecognizer } from './SpeechRecognizer';
export type { SpeechRecognizerConfig } from './SpeechRecognizer';
export { TranslationEngine, TranslationEngineType, translationEngine } from './TranslationEngine';
export type { TranslationEngineConfig, TranslationStats } from './TranslationEngine';
export { SpeechSynthesizer, SynthesisEngine, VoiceGender, AudioEncoding, speechSynthesizer } from './SpeechSynthesizer';
export type { SpeechSynthesizerConfig, SynthesisResult, SynthesisStats } from './SpeechSynthesizer';
export { StreamProcessor, PipelineStage } from './StreamProcessor';
export type { StreamProcessorConfig, PipelineState, PipelineMetrics } from './StreamProcessor';
export { NetworkMonitor, ProcessingMode, networkMonitor } from './NetworkMonitor';
export type {
  NetworkMonitorConfig,
  NetworkMetrics,
  LatencyMetrics,
  AudioQualitySettings,
  NetworkStatusCallback,
  ModeChangeCallback,
  QualityChangeCallback,
} from './NetworkMonitor';
export { OfflineModelManager, ModelType, offlineModelManager } from './OfflineModelManager';
export type {
  OfflineModelManagerConfig,
  ModelInfo,
  ModelDownloadOptions,
  OfflineCapability,
} from './OfflineModelManager';
export { DataSyncManager, SyncOperationType, dataSyncManager } from './DataSyncManager';
export type {
  DataSyncManagerConfig,
  SyncOperation,
  SyncStatus,
  SyncResult,
} from './DataSyncManager';
export { ConferenceManager } from './ConferenceManager';
export type {
  TranslationQueueItem,
  SpeakerStream,
  AudioMixConfig,
  ConferenceStats,
} from './ConferenceManager';
export { AudioQualityMonitor } from './AudioQualityMonitor';
export type {
  QualityThresholds,
  AdaptiveParameters,
  QualityNotification,
  QualityMetrics,
} from './AudioQualityMonitor';
export { WebRTCService } from './WebRTCService';
export type {
  WebRTCConfig,
  PeerConnection,
  WebRTCCallbacks,
} from './WebRTCService';
export { SignalingService, SignalingMessageType } from './SignalingService';
export type {
  SignalingConfig,
  SignalingMessage,
  SignalingCallbacks,
} from './SignalingService';
export { WebRTCManager } from './WebRTCManager';
export type {
  WebRTCManagerConfig,
  WebRTCManagerCallbacks,
} from './WebRTCManager';
export { PerformanceMonitor, ServiceType, PerformanceState, performanceMonitor } from './PerformanceMonitor';
export type {
  PerformanceMonitorConfig,
  PerformanceMetrics,
  PerformanceThresholds,
  ModelConfig,
  DegradationStrategy,
  PerformanceCallback,
  DegradationCallback,
} from './PerformanceMonitor';
