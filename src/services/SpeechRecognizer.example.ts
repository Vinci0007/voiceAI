/**
 * SpeechRecognizer Usage Examples
 * 
 * This file demonstrates various ways to use the SpeechRecognizer service.
 */

import { SpeechRecognizer, RecognitionEngine } from './SpeechRecognizer';
import { languageDetector } from './LanguageDetector';
import type { AudioBuffer } from '../types';

// ============================================================================
// Example 1: Basic Speech Recognition
// ============================================================================

async function basicRecognition() {
  console.log('=== Example 1: Basic Recognition ===');

  // Create recognizer with Google Cloud API
  const recognizer = new SpeechRecognizer({
    googleApiKey: 'your-google-api-key',
    primaryEngine: RecognitionEngine.GOOGLE_CLOUD,
    fallbackEngine: RecognitionEngine.VOSK,
  });

  // Create mock audio buffer (in production, this comes from microphone)
  const audio: AudioBuffer = {
    data: new Float32Array(16000), // 1 second at 16kHz
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  // Recognize speech
  const result = await recognizer.recognize(audio, 'en-US');

  console.log('Transcription:', result.text);
  console.log('Confidence:', result.confidence);
  console.log('Is Final:', result.isFinal);
  console.log('Alternatives:', result.alternatives);
}

// ============================================================================
// Example 2: Streaming Recognition
// ============================================================================

async function streamingRecognition() {
  console.log('=== Example 2: Streaming Recognition ===');

  const recognizer = new SpeechRecognizer({
    googleApiKey: 'your-google-api-key',
    enableStreaming: true,
  });

  // Start streaming session
  const sessionId = 'my-streaming-session';
  const stream = recognizer.recognizeStream('en-US', sessionId);

  // Simulate pushing audio chunks (in production, these come from microphone)
  const pushAudioChunks = async () => {
    for (let i = 0; i < 10; i++) {
      const chunk = new Float32Array(1600); // 100ms chunks
      recognizer.pushAudioChunk(sessionId, chunk);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Stop after 1 second
    recognizer.stopStream(sessionId);
  };

  // Process results as they arrive
  const processResults = async () => {
    for await (const result of stream) {
      if (result.isFinal) {
        console.log('✓ Final:', result.text);
      } else {
        console.log('  Interim:', result.text);
      }
    }
  };

  // Run both in parallel
  await Promise.all([pushAudioChunks(), processResults()]);
}

// ============================================================================
// Example 3: Language-Driven Recognition
// ============================================================================

async function languageDrivenRecognition() {
  console.log('=== Example 3: Language-Driven Recognition ===');

  const recognizer = new SpeechRecognizer({
    googleApiKey: 'your-google-api-key',
    primaryEngine: RecognitionEngine.AUTO, // Automatic engine selection
  });

  const audio: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  // Step 1: Detect language
  const langInfo = await languageDetector.detect(audio);
  console.log('Detected language:', langInfo.languageCode);
  console.log('Confidence:', langInfo.confidence);

  // Step 2: Use detected language for recognition
  const result = await recognizer.recognize(audio, langInfo.languageCode);
  console.log('Transcription:', result.text);

  // Step 3: Handle low confidence
  if (langInfo.confidence < 0.7) {
    console.log('Low confidence, trying alternatives...');
    for (const alt of langInfo.alternativeLanguages) {
      const altResult = await recognizer.recognize(audio, alt.code);
      console.log(`Alternative (${alt.code}):`, altResult.text);
    }
  }
}

// ============================================================================
// Example 4: Offline Recognition with Vosk
// ============================================================================

async function offlineRecognition() {
  console.log('=== Example 4: Offline Recognition ===');

  // Configure for offline-only operation
  const recognizer = new SpeechRecognizer({
    primaryEngine: RecognitionEngine.VOSK,
    fallbackEngine: RecognitionEngine.VOSK,
  });

  const audio: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  // Recognize without internet connection
  const result = await recognizer.recognize(audio, 'en-US');
  console.log('Offline transcription:', result.text);
  console.log('Confidence:', result.confidence);
}

// ============================================================================
// Example 5: Multi-Language Recognition
// ============================================================================

async function multiLanguageRecognition() {
  console.log('=== Example 5: Multi-Language Recognition ===');

  const recognizer = new SpeechRecognizer({
    googleApiKey: 'your-google-api-key',
  });

  const languages = [
    { code: 'en-US', name: 'English' },
    { code: 'zh-CN', name: 'Chinese' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
  ];

  const audio: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  // Recognize in multiple languages
  for (const lang of languages) {
    const result = await recognizer.recognize(audio, lang.code);
    console.log(`${lang.name} (${lang.code}):`, result.text);
  }
}

// ============================================================================
// Example 6: Error Handling and Fallback
// ============================================================================

async function errorHandlingExample() {
  console.log('=== Example 6: Error Handling ===');

  // Create recognizer without API key (will use fallback)
  const recognizer = new SpeechRecognizer({
    primaryEngine: RecognitionEngine.GOOGLE_CLOUD,
    fallbackEngine: RecognitionEngine.VOSK,
    // No googleApiKey - will automatically fall back to Vosk
  });

  const audio: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  try {
    // This will fail with Google Cloud but succeed with Vosk fallback
    const result = await recognizer.recognize(audio, 'en-US');
    console.log('Transcription (via fallback):', result.text);
  } catch (error) {
    console.error('Recognition failed:', error);
  }

  // Check engine availability
  console.log('Google Cloud available:', recognizer.isEngineAvailable(RecognitionEngine.GOOGLE_CLOUD));
  console.log('Vosk available:', recognizer.isEngineAvailable(RecognitionEngine.VOSK));
}

// ============================================================================
// Example 7: Real-Time Translation Pipeline
// ============================================================================

async function translationPipeline() {
  console.log('=== Example 7: Translation Pipeline ===');

  const recognizer = new SpeechRecognizer({
    googleApiKey: 'your-google-api-key',
    enableStreaming: true,
  });

  const userTargetLanguage = 'en-US';
  const sessionId = 'translation-session';

  // Start streaming
  const stream = recognizer.recognizeStream('zh-CN', sessionId); // Chinese input

  // Process and translate
  for await (const result of stream) {
    if (result.isFinal) {
      console.log('Original (Chinese):', result.text);
      
      // In production, this would call the translation service
      // const translation = await translator.translate(
      //   result.text,
      //   'zh-CN',
      //   userTargetLanguage
      // );
      // console.log('Translated (English):', translation.translatedText);
      
      console.log('Translated (English): [Translation would go here]');
    }
  }
}

// ============================================================================
// Example 8: Configuration Management
// ============================================================================

function configurationExample() {
  console.log('=== Example 8: Configuration Management ===');

  const recognizer = new SpeechRecognizer();

  // Get current configuration
  const config = recognizer.getConfig();
  console.log('Current config:', config);

  // Update specific settings
  recognizer.updateConfig({
    maxAlternatives: 5,
    enableAutomaticPunctuation: true,
    model: 'command_and_search', // Better for short commands
  });

  // Update API key dynamically
  recognizer.updateConfig({
    googleApiKey: 'new-api-key',
  });

  console.log('Updated config:', recognizer.getConfig());
}

// ============================================================================
// Example 9: Performance Monitoring
// ============================================================================

async function performanceMonitoring() {
  console.log('=== Example 9: Performance Monitoring ===');

  const recognizer = new SpeechRecognizer({
    googleApiKey: 'your-google-api-key',
  });

  const audio: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  // Measure recognition latency
  const startTime = Date.now();
  const result = await recognizer.recognize(audio, 'en-US');
  const endTime = Date.now();

  const latency = endTime - startTime;
  console.log('Recognition latency:', latency, 'ms');
  console.log('Transcription:', result.text);
  console.log('Confidence:', result.confidence);

  // Check if latency meets requirements (<500ms for real-time)
  if (latency < 500) {
    console.log('✓ Latency meets real-time requirements');
  } else {
    console.log('⚠ Latency exceeds real-time threshold');
  }
}

// ============================================================================
// Example 10: Concurrent Recognition Sessions
// ============================================================================

async function concurrentSessions() {
  console.log('=== Example 10: Concurrent Sessions ===');

  const recognizer = new SpeechRecognizer({
    googleApiKey: 'your-google-api-key',
  });

  // Create multiple audio sources (simulating multiple speakers)
  const audio1: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  const audio2: AudioBuffer = {
    data: new Float32Array(16000),
    sampleRate: 16000,
    channels: 1,
    timestamp: Date.now(),
  };

  // Recognize concurrently
  const [result1, result2] = await Promise.all([
    recognizer.recognize(audio1, 'en-US'),
    recognizer.recognize(audio2, 'zh-CN'),
  ]);

  console.log('Speaker 1 (English):', result1.text);
  console.log('Speaker 2 (Chinese):', result2.text);
}

// ============================================================================
// Run Examples
// ============================================================================

async function runExamples() {
  try {
    await basicRecognition();
    console.log('\n');
    
    await streamingRecognition();
    console.log('\n');
    
    await languageDrivenRecognition();
    console.log('\n');
    
    await offlineRecognition();
    console.log('\n');
    
    await multiLanguageRecognition();
    console.log('\n');
    
    await errorHandlingExample();
    console.log('\n');
    
    await translationPipeline();
    console.log('\n');
    
    configurationExample();
    console.log('\n');
    
    await performanceMonitoring();
    console.log('\n');
    
    await concurrentSessions();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Uncomment to run examples
// runExamples();

export {
  basicRecognition,
  streamingRecognition,
  languageDrivenRecognition,
  offlineRecognition,
  multiLanguageRecognition,
  errorHandlingExample,
  translationPipeline,
  configurationExample,
  performanceMonitoring,
  concurrentSessions,
};
