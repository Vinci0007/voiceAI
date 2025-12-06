# SpeechRecognizer Service

## Overview

The `SpeechRecognizer` service provides speech-to-text conversion capabilities with support for multiple recognition engines. It implements language-driven engine selection and supports both batch and streaming recognition modes.

## Features

- **Multiple Engine Support**: Google Cloud Speech-to-Text API and Vosk (offline)
- **Language-Driven Selection**: Automatically selects the best engine based on language and availability
- **Streaming Recognition**: Real-time speech recognition with interim results
- **Automatic Fallback**: Falls back to alternative engines when primary fails
- **Configurable**: Extensive configuration options for different use cases

## Requirements Addressed

- **3.5**: Language-driven engine selection - System selects appropriate recognition engine based on detected language
- **4.2**: Speech-to-text conversion - Converts non-target language speech to text for translation

## Installation

The service is part of the core application and requires no additional installation. However, for production use:

### Google Cloud Speech-to-Text

1. Create a Google Cloud project
2. Enable the Speech-to-Text API
3. Create an API key or service account
4. Configure the API key in the application

### Vosk (Offline Recognition)

1. Download Vosk models for desired languages from https://alphacephei.com/vosk/models
2. Place models in the `models/` directory
3. Models are automatically loaded based on language code

## Usage

### Basic Recognition

```typescript
import { SpeechRecognizer } from './services/SpeechRecognizer';

// Create recognizer with configuration
const recognizer = new SpeechRecognizer({
  googleApiKey: 'your-api-key',
  primaryEngine: RecognitionEngine.GOOGLE_CLOUD,
  fallbackEngine: RecognitionEngine.VOSK,
});

// Recognize speech from audio buffer
const audio: AudioBuffer = {
  data: new Float32Array(16000), // 1 second at 16kHz
  sampleRate: 16000,
  channels: 1,
  timestamp: Date.now(),
};

const result = await recognizer.recognize(audio, 'en-US');
console.log('Transcription:', result.text);
console.log('Confidence:', result.confidence);
```

### Streaming Recognition

```typescript
// Start streaming session
const sessionId = 'my-session';
const stream = recognizer.recognizeStream('en-US', sessionId);

// Push audio chunks as they arrive
recognizer.pushAudioChunk(sessionId, audioChunk1);
recognizer.pushAudioChunk(sessionId, audioChunk2);

// Process results
for await (const result of stream) {
  if (result.isFinal) {
    console.log('Final:', result.text);
  } else {
    console.log('Interim:', result.text);
  }
}

// Stop when done
recognizer.stopStream(sessionId);
```

### Configuration Options

```typescript
interface SpeechRecognizerConfig {
  // Engine selection
  primaryEngine: RecognitionEngine;      // GOOGLE_CLOUD, VOSK, or AUTO
  fallbackEngine: RecognitionEngine;     // Fallback if primary fails
  
  // API configuration
  googleApiKey?: string;                 // Google Cloud API key
  
  // Recognition settings
  enableStreaming: boolean;              // Enable streaming mode
  maxAlternatives: number;               // Number of alternative transcriptions
  enableAutomaticPunctuation: boolean;   // Add punctuation automatically
  model: string;                         // Model type (default, command_and_search, etc.)
  sampleRate: number;                    // Audio sample rate in Hz
}
```

### Engine Selection

The service automatically selects the best engine based on:

1. **Availability**: Checks if engines are available (API key configured, models downloaded)
2. **Language Support**: Ensures selected engine supports the target language
3. **Configuration**: Respects user preferences for primary/fallback engines

```typescript
// Check engine availability
if (recognizer.isEngineAvailable(RecognitionEngine.GOOGLE_CLOUD)) {
  console.log('Google Cloud is available');
}

// Use AUTO mode for automatic selection
recognizer.updateConfig({
  primaryEngine: RecognitionEngine.AUTO,
});
```

## Supported Languages

### Google Cloud Speech-to-Text
Supports 120+ languages including:
- English (en-US, en-GB, en-AU, etc.)
- Chinese (zh-CN, zh-TW)
- Spanish (es-ES, es-MX, es-US)
- French (fr-FR, fr-CA)
- German (de-DE)
- Japanese (ja-JP)
- Korean (ko-KR)
- And many more...

### Vosk
Supports 20+ languages with downloadable models:
- English (en-US)
- Chinese (zh-CN)
- Spanish (es)
- French (fr)
- German (de)
- Russian (ru)
- And more...

## Performance

### Latency Targets

- **Google Cloud**: ~300-500ms (network dependent)
- **Vosk (offline)**: ~200-300ms (local processing)
- **Streaming**: Interim results every 100-200ms

### Resource Usage

- **Memory**: ~100-200MB (with loaded models)
- **CPU**: 15-30% during active recognition
- **Network**: ~10-20 KB/s for streaming (Google Cloud)

## Error Handling

The service implements robust error handling:

```typescript
try {
  const result = await recognizer.recognize(audio, 'en-US');
  // Process result
} catch (error) {
  // Automatic fallback to alternative engine
  console.error('Recognition failed:', error);
}
```

Errors are handled automatically:
1. Primary engine fails → Try fallback engine
2. All engines fail → Return empty result
3. Network errors → Fall back to offline engine
4. Invalid input → Return empty result with warning

## Integration with Other Services

### With LanguageDetector

```typescript
import { languageDetector } from './services/LanguageDetector';
import { speechRecognizer } from './services/SpeechRecognizer';

// Detect language first
const langInfo = await languageDetector.detect(audio);

// Use detected language for recognition
const result = await speechRecognizer.recognize(audio, langInfo.languageCode);
```

### With Translation Pipeline

```typescript
// 1. Detect language
const language = await languageDetector.detect(audio);

// 2. Recognize speech
const recognition = await speechRecognizer.recognize(audio, language.languageCode);

// 3. Translate if needed
if (language.languageCode !== userTargetLanguage) {
  const translation = await translator.translate(
    recognition.text,
    language.languageCode,
    userTargetLanguage
  );
}
```

## Testing

Run tests with:

```bash
npm test -- SpeechRecognizer.test.ts
```

The test suite covers:
- Configuration management
- Engine selection logic
- Batch recognition
- Streaming recognition
- Error handling
- Performance benchmarks

## Production Deployment

### Google Cloud Setup

1. **Create API Key**:
   ```bash
   gcloud auth application-default login
   gcloud projects create my-translation-app
   gcloud services enable speech.googleapis.com
   ```

2. **Configure Application**:
   ```typescript
   recognizer.updateConfig({
     googleApiKey: process.env.GOOGLE_CLOUD_API_KEY,
   });
   ```

### Vosk Setup

1. **Download Models**:
   ```bash
   mkdir -p models
   cd models
   wget https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip
   unzip vosk-model-en-us-0.22.zip
   ```

2. **Configure Model Path**:
   Models are loaded automatically based on language code.

## Troubleshooting

### "Google Cloud API key not configured"
- Ensure API key is set in configuration
- Check that API key has Speech-to-Text API enabled

### "Recognition failed with all engines"
- Check network connectivity for Google Cloud
- Verify Vosk models are downloaded and accessible
- Check audio format (should be 16kHz, mono, LINEAR16)

### Low Recognition Accuracy
- Ensure audio quality is good (low noise, clear speech)
- Use appropriate model for use case (default, command_and_search, etc.)
- Consider using Google Cloud for better accuracy

### High Latency
- Use streaming mode for real-time applications
- Consider using Vosk for offline/low-latency scenarios
- Check network latency if using Google Cloud

## Future Enhancements

- [ ] Support for Azure Speech Services
- [ ] Support for AWS Transcribe
- [ ] Custom vocabulary and phrase hints
- [ ] Speaker diarization integration
- [ ] Automatic language detection (without separate service)
- [ ] Model caching and preloading
- [ ] Batch processing optimization

## References

- [Google Cloud Speech-to-Text Documentation](https://cloud.google.com/speech-to-text/docs)
- [Vosk Documentation](https://alphacephei.com/vosk/)
- [Design Document](../../.kiro/specs/realtime-voice-translation/design.md)
- [Requirements Document](../../.kiro/specs/realtime-voice-translation/requirements.md)
