# StreamProcessor - Translation Pipeline Coordinator

## Overview

The `StreamProcessor` is the central coordinator for the real-time voice translation pipeline. It orchestrates the flow from audio input through language detection, speech recognition, translation, and speech synthesis to produce translated audio output.

## Features

- **Complete Pipeline Coordination**: Manages all stages from audio input to translated output
- **Streaming Support**: Processes audio streams with minimal latency
- **Smart Language Handling**: Automatically skips translation when source equals target language (Requirement 4.5)
- **Pipeline State Management**: Tracks processing state for each audio segment
- **Performance Metrics**: Collects detailed metrics on latency and success rates
- **Error Handling**: Robust error handling with fallback strategies
- **Concurrent Processing**: Supports multiple concurrent pipeline processes

## Requirements Satisfied

- **4.2**: Converts non-target language speech to text
- **4.3**: Translates text from source to target language
- **4.4**: Synthesizes translated text to speech
- **4.5**: Skips translation when source equals target language

## Architecture

```
Audio Input
    ↓
Language Detection
    ↓
Speech Recognition
    ↓
Translation (skipped if same language)
    ↓
Speech Synthesis
    ↓
Audio Output
```

## Usage

### Basic Usage

```typescript
import { StreamProcessor } from './services/StreamProcessor';
import { SpeechRecognizer } from './services/SpeechRecognizer';
import { LanguageDetector } from './services/LanguageDetector';
import { TranslationEngine } from './services/TranslationEngine';
import { SpeechSynthesizer } from './services/SpeechSynthesizer';

// Initialize services
const recognizer = new SpeechRecognizer({ googleApiKey: 'YOUR_KEY' });
const detector = new LanguageDetector({ apiKey: 'YOUR_KEY' });
const translator = new TranslationEngine({ googleApiKey: 'YOUR_KEY' });
const synthesizer = new SpeechSynthesizer({ googleApiKey: 'YOUR_KEY' });

// Create stream processor
const processor = new StreamProcessor(
  {
    enableStreaming: true,
    skipSameLanguageTranslation: true,
  },
  recognizer,
  detector,
  translator,
  synthesizer
);

// Process audio stream
const audioStream = getAudioStream(); // Your audio source
const targetLanguage = 'en-US';

for await (const output of processor.processAudioStream(
  audioStream,
  'user123',
  targetLanguage
)) {
  console.log('Original:', output.originalText);
  console.log('Translated:', output.translatedText);
  console.log('Latency:', output.latency, 'ms');
  
  // Play translated audio
  playAudio(output.translatedAudio);
}
```

### Process Single Audio Segment

```typescript
const processor = new StreamProcessor();

const audioBuffer: AudioBuffer = {
  data: new Float32Array(16000), // 1 second at 16kHz
  sampleRate: 16000,
  channels: 1,
  timestamp: Date.now(),
};

const speakerInfo = {
  speakerId: 'speaker_001',
  confidence: 0.95,
  isNewSpeaker: false,
};

const result = await processor.processAudioSegment(
  audioBuffer,
  'user123',
  'en-US',
  speakerInfo
);

if (result) {
  console.log('Processing complete:', result);
}
```

### With Custom Configuration

```typescript
const processor = new StreamProcessor({
  enableStreaming: true,
  skipSameLanguageTranslation: true,
  maxConcurrentProcesses: 5,
  stageTimeout: 10000, // 10 seconds
  enableMetrics: true,
});
```

### Monitor Pipeline State

```typescript
// Get all active pipelines
const activePipelines = processor.getActivePipelines();
console.log('Active pipelines:', activePipelines.length);

activePipelines.forEach(state => {
  console.log(`Segment ${state.segmentId}:`);
  console.log(`  Stage: ${state.currentStage}`);
  console.log(`  Source: ${state.sourceLanguage}`);
  console.log(`  Target: ${state.targetLanguage}`);
});

// Get specific pipeline state
const state = processor.getPipelineState('segment_123');
if (state) {
  console.log('Current stage:', state.currentStage);
}
```

### Access Metrics

```typescript
const metrics = processor.getMetrics();

console.log('Total processed:', metrics.totalProcessed);
console.log('Success rate:', 
  (metrics.successfulProcessed / metrics.totalProcessed * 100).toFixed(2) + '%'
);
console.log('Average latency:', metrics.averageLatency.toFixed(2), 'ms');
console.log('Skipped translations:', metrics.skippedTranslations);
```

### Cleanup

```typescript
// Cleanup when done
await processor.cleanup();
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableStreaming` | boolean | `true` | Enable streaming mode for lower latency |
| `skipSameLanguageTranslation` | boolean | `true` | Skip translation when source equals target |
| `maxConcurrentProcesses` | number | `10` | Maximum concurrent pipeline processes |
| `stageTimeout` | number | `5000` | Timeout for each stage in milliseconds |
| `enableMetrics` | boolean | `true` | Enable performance metrics collection |

## Pipeline Stages

1. **AUDIO_INPUT**: Initial audio buffer received
2. **LANGUAGE_DETECTION**: Detecting source language
3. **SPEECH_RECOGNITION**: Converting speech to text
4. **TRANSLATION**: Translating text to target language
5. **SPEECH_SYNTHESIS**: Converting translated text to speech
6. **OUTPUT**: Final output ready

## Performance

### Target Latency

- **End-to-end**: < 2 seconds (Requirement 5.1)
- **Language Detection**: ~50-100ms
- **Speech Recognition**: ~300-500ms
- **Translation**: ~200-400ms
- **Speech Synthesis**: ~300-500ms

### Optimization Features

- **Streaming Processing**: Reduces perceived latency
- **Concurrent Processing**: Handles multiple segments simultaneously
- **Smart Skipping**: Avoids unnecessary translation for same language
- **Efficient State Management**: Minimal overhead for tracking

## Error Handling

The StreamProcessor includes comprehensive error handling:

```typescript
try {
  const result = await processor.processAudioSegment(
    audioBuffer,
    'user123',
    'en-US'
  );
} catch (error) {
  console.error('Pipeline error:', error);
  // Error is logged and metrics are updated
  // Fallback strategies are automatically applied
}
```

Errors are handled at each stage with automatic fallback to alternative engines when available.

## Integration with Other Services

### SpeechRecognizer

Converts speech to text with language-specific engine selection.

### LanguageDetector

Detects source language with confidence scoring and secondary confirmation.

### TranslationEngine

Translates text with caching and batch optimization.

### SpeechSynthesizer

Synthesizes speech with voice customization and streaming support.

## Best Practices

1. **Reuse Instances**: Create one StreamProcessor instance and reuse it
2. **Monitor Metrics**: Regularly check metrics to identify bottlenecks
3. **Handle Errors**: Implement proper error handling for production use
4. **Cleanup**: Always call `cleanup()` when done to release resources
5. **Configure Timeouts**: Adjust timeouts based on your network conditions
6. **Use Streaming**: Enable streaming for better real-time performance

## Example: Complete Real-time Translation

```typescript
import { StreamProcessor } from './services/StreamProcessor';

async function startRealTimeTranslation() {
  const processor = new StreamProcessor({
    enableStreaming: true,
    skipSameLanguageTranslation: true,
    enableMetrics: true,
  });

  // Get audio from microphone
  const audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
    },
  });

  // Convert to AudioBuffer stream
  const audioBufferStream = convertToAudioBufferStream(audioStream);

  // Process and output
  try {
    for await (const output of processor.processAudioStream(
      audioBufferStream,
      'user123',
      'en-US'
    )) {
      // Display text
      displayText(output.originalText, output.translatedText);
      
      // Play audio
      await playAudio(output.translatedAudio);
      
      // Log metrics
      console.log(`Latency: ${output.latency}ms`);
    }
  } finally {
    await processor.cleanup();
  }
}

// Helper functions
function convertToAudioBufferStream(mediaStream: MediaStream): ReadableStream<AudioBuffer> {
  // Implementation depends on your audio processing setup
  // This is a simplified example
  return new ReadableStream({
    start(controller) {
      // Process audio chunks and push to controller
    },
  });
}

function displayText(original: string, translated: string) {
  console.log(`Original: ${original}`);
  console.log(`Translated: ${translated}`);
}

async function playAudio(audio: AudioBuffer) {
  // Play audio using Web Audio API or other method
}
```

## Troubleshooting

### High Latency

- Check network connection quality
- Verify API keys are valid
- Consider using local models for offline mode
- Reduce `maxConcurrentProcesses` if system is overloaded

### Translation Not Skipped

- Ensure `skipSameLanguageTranslation` is `true`
- Check language codes are properly formatted (e.g., 'en-US')
- Verify language detection is working correctly

### Pipeline Stuck

- Check `stageTimeout` configuration
- Monitor active pipelines with `getActivePipelines()`
- Call `cleanup()` to force clear stuck pipelines

## API Reference

See the TypeScript definitions in `StreamProcessor.ts` for complete API documentation.
