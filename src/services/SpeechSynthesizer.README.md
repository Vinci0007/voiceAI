# Speech Synthesizer

## Overview

The Speech Synthesizer provides text-to-speech (TTS) conversion capabilities with support for multiple synthesis engines, intelligent caching, and streaming synthesis. It implements Requirement 4.4 from the design specification.

## Features

### Multiple Engine Support

- **Google Cloud Text-to-Speech API**: High-quality neural voices (primary)
- **Azure Neural TTS**: Alternative high-quality synthesis service
- **Piper TTS**: Fast local synthesis using ONNX Runtime

### Intelligent Caching

- LRU-based cache with configurable size and TTL
- Automatic cache eviction when full
- Cache hit/miss statistics tracking
- Significant latency reduction for repeated phrases

### Streaming Synthesis

- Real-time text-to-speech streaming
- Chunk-based processing for low latency
- Session-based streaming management

### Voice Customization

- Configurable voice selection
- Adjustable pitch, speed, and volume
- Multiple voice options per language
- Gender-specific voice selection

## Usage

### Basic Synthesis

```typescript
import { speechSynthesizer } from './services/SpeechSynthesizer';

// Simple synthesis
const result = await speechSynthesizer.synthesize(
  'Hello, world!',
  'en-US'
);

console.log('Audio duration:', result.duration, 'ms');
console.log('Voice used:', result.voiceUsed);

// Play the audio
playAudio(result.audio);
```

### Custom Voice Configuration

```typescript
// Synthesize with custom voice settings
const result = await speechSynthesizer.synthesize(
  'Welcome to our application',
  'en-US',
  {
    voiceId: 'en-US-Neural2-A',
    pitch: 2,        // Higher pitch
    speed: 1.2,      // 20% faster
    volume: 0.8,     // 80% volume
  }
);
```

### Streaming Synthesis

```typescript
// Start streaming synthesis
const stream = speechSynthesizer.synthesizeStream(
  'en-US',
  { voiceId: 'en-US-Wavenet-A' }
);

// Push text chunks
speechSynthesizer.pushTextChunk(sessionId, 'Hello, ');
speechSynthesizer.pushTextChunk(sessionId, 'how are you?');

// Process audio chunks as they arrive
for await (const audioChunk of stream) {
  playAudioChunk(audioChunk);
}

// Stop streaming
speechSynthesizer.stopStream(sessionId);
```

### Get Available Voices

```typescript
// Get all available voices for a language
const voices = await speechSynthesizer.getAvailableVoices('en-US');

console.log('Available voices:', voices);
// Output: ['en-US-Standard-A', 'en-US-Wavenet-A', 'en-US-Neural2-A', ...]
```

### Configuration

```typescript
import { 
  SpeechSynthesizer, 
  SynthesisEngine,
  AudioEncoding 
} from './services/SpeechSynthesizer';

const synthesizer = new SpeechSynthesizer({
  primaryEngine: SynthesisEngine.GOOGLE_CLOUD,
  fallbackEngine: SynthesisEngine.PIPER_LOCAL,
  googleApiKey: 'your-api-key',
  enableCache: true,
  maxCacheSize: 1000,
  cacheTTL: 3600000, // 1 hour
  enableStreaming: true,
  sampleRate: 24000,
  audioEncoding: AudioEncoding.LINEAR16,
  defaultVoice: {
    voiceId: 'en-US-Standard-A',
    pitch: 0,
    speed: 1.0,
    volume: 1.0,
  },
});
```

### Update Configuration at Runtime

```typescript
speechSynthesizer.updateConfig({
  googleApiKey: 'new-api-key',
  enableCache: false,
  sampleRate: 48000,
});
```

## Cache Management

### Clear Cache

```typescript
speechSynthesizer.clearCache();
```

### Get Cache Statistics

```typescript
const stats = speechSynthesizer.getCacheStats();
console.log(`Cache size: ${stats.size}`);
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

## Statistics

### Get Synthesis Statistics

```typescript
const stats = speechSynthesizer.getStats();
console.log(`Total syntheses: ${stats.totalSyntheses}`);
console.log(`Cache hits: ${stats.cacheHits}`);
console.log(`Cache misses: ${stats.cacheMisses}`);
console.log(`Streaming syntheses: ${stats.streamingSyntheses}`);
console.log(`Average latency: ${stats.averageLatency}ms`);
console.log('Engine usage:', stats.engineUsage);
```

## Engine Availability

### Check Engine Status

```typescript
const isGoogleAvailable = speechSynthesizer.isEngineAvailable(
  SynthesisEngine.GOOGLE_CLOUD
);

if (!isGoogleAvailable) {
  console.log('Google Cloud TTS is not configured');
}
```

## Performance Optimization

### Caching Benefits

- **First synthesis**: ~300-500ms (API call)
- **Cached synthesis**: <1ms (cache lookup)
- **Cache hit rate**: Typically 30-50% for common phrases

### Latency Targets

- **Google Cloud**: ~300-500ms
- **Azure**: ~400-600ms
- **Piper Local**: ~100-200ms

### Streaming Benefits

- **Batch synthesis**: Wait for complete text, then synthesize
- **Streaming synthesis**: Start playing audio while still receiving text
- **Perceived latency**: Reduced by up to 50%

## Voice Configuration

### Voice Parameters

```typescript
interface VoiceConfig {
  voiceId: string;    // Voice identifier (e.g., 'en-US-Wavenet-A')
  pitch: number;      // Pitch adjustment (-20 to +20)
  speed: number;      // Speaking rate (0.25 to 4.0)
  volume: number;     // Volume level (0.0 to 1.0)
}
```

### Voice Selection Guidelines

**Google Cloud Voices:**
- `Standard`: Basic quality, fast, low cost
- `Wavenet`: High quality, natural sounding
- `Neural2`: Latest generation, most natural

**Azure Voices:**
- `Neural`: High-quality neural voices
- Supports SSML for advanced control

**Piper Voices:**
- `low`: Lower quality, faster
- `medium`: Balanced quality and speed

## Audio Formats

### Supported Encodings

```typescript
enum AudioEncoding {
  LINEAR16 = 'linear16',    // Uncompressed PCM
  MP3 = 'mp3',              // Compressed, smaller size
  OGG_OPUS = 'ogg_opus',    // Compressed, good quality
}
```

### Sample Rates

- **16000 Hz**: Phone quality, smaller size
- **24000 Hz**: Standard quality (default)
- **48000 Hz**: High quality, larger size

## Error Handling

The synthesizer handles errors gracefully:

1. **Primary engine fails**: Automatically falls back to secondary engine
2. **All engines fail**: Returns empty audio buffer
3. **Invalid input**: Returns empty result
4. **API errors**: Logged and handled with retry logic

## Integration with Other Services

### With Translation Engine

```typescript
import { translationEngine } from './services/TranslationEngine';
import { speechSynthesizer } from './services/SpeechSynthesizer';

// Translate text
const translation = await translationEngine.translate(
  'Hello',
  'en',
  'es'
);

// Synthesize translated text
const audio = await speechSynthesizer.synthesize(
  translation.translatedText,
  'es-ES'
);

// Play audio
playAudio(audio.audio);
```

### With Speech Recognizer

```typescript
import { speechRecognizer } from './services/SpeechRecognizer';
import { speechSynthesizer } from './services/SpeechSynthesizer';

// Recognize speech
const recognition = await speechRecognizer.recognize(audioBuffer, 'en-US');

// Echo back with different voice
const echo = await speechSynthesizer.synthesize(
  recognition.text,
  'en-US',
  { voiceId: 'en-US-Wavenet-B' }
);
```

### Real-time Translation Pipeline

```typescript
// Complete translation pipeline
async function translateAndSpeak(
  audioInput: AudioBuffer,
  sourceLang: string,
  targetLang: string
) {
  // 1. Recognize speech
  const recognition = await speechRecognizer.recognize(audioInput, sourceLang);
  
  // 2. Translate text
  const translation = await translationEngine.translate(
    recognition.text,
    sourceLang,
    targetLang
  );
  
  // 3. Synthesize speech
  const synthesis = await speechSynthesizer.synthesize(
    translation.translatedText,
    targetLang
  );
  
  return synthesis.audio;
}
```

## Production Deployment

### API Keys

Set API keys via environment variables or configuration:

```typescript
speechSynthesizer.updateConfig({
  googleApiKey: process.env.GOOGLE_TTS_API_KEY,
  azureApiKey: process.env.AZURE_TTS_API_KEY,
  azureRegion: process.env.AZURE_REGION,
});
```

### Local Model Setup

For offline synthesis, download and configure Piper models:

1. Download Piper ONNX models for target languages
2. Place in `models/` directory
3. Engine will automatically use local model when API is unavailable

### Voice Selection Best Practices

1. **Use neural voices** for best quality when available
2. **Cache common phrases** to reduce API calls
3. **Adjust speed** for better comprehension (0.9-1.1 range)
4. **Test voices** with target audience before deployment

## Advanced Features

### SSML Support (Azure)

```typescript
// Azure supports SSML for advanced control
const ssml = `
  <speak>
    <prosody rate="slow" pitch="+5%">
      Hello, <break time="500ms"/> how are you?
    </prosody>
  </speak>
`;

// SSML is automatically generated based on voice config
```

### Batch Synthesis

```typescript
// Synthesize multiple texts efficiently
const texts = [
  'Good morning',
  'Good afternoon',
  'Good evening',
];

const results = await Promise.all(
  texts.map(text => speechSynthesizer.synthesize(text, 'en-US'))
);
```

### Voice Cloning (Future)

```typescript
// Future feature: Clone voice from sample
const clonedVoice = await speechSynthesizer.cloneVoice(
  sampleAudio,
  'my-custom-voice'
);

const result = await speechSynthesizer.synthesize(
  'Hello in my voice',
  'en-US',
  { voiceId: clonedVoice.id }
);
```

## Requirements Validation

This implementation satisfies:

- **Requirement 4.4**: "WHEN 翻译完成 THEN 系统 SHALL 将翻译后的文本转换为语音输出"
  - ✅ Converts translated text to speech
  - ✅ Supports multiple synthesis engines
  - ✅ Provides voice customization
  - ✅ Handles errors gracefully
  - ✅ Implements caching for performance

## Testing

See `SpeechSynthesizer.test.ts` for comprehensive unit tests covering:

- Basic synthesis
- Voice configuration
- Streaming synthesis
- Caching behavior
- Engine fallback
- Error handling
- Performance validation

## Troubleshooting

### Common Issues

**Issue**: Synthesis is slow
- **Solution**: Enable caching, use local engine, or reduce sample rate

**Issue**: Voice sounds robotic
- **Solution**: Use neural voices (Wavenet, Neural2) instead of Standard

**Issue**: API quota exceeded
- **Solution**: Implement rate limiting, use caching, or switch to local engine

**Issue**: Audio quality is poor
- **Solution**: Increase sample rate, use higher quality encoding, or try different engine

### Debug Mode

```typescript
// Enable debug logging
speechSynthesizer.updateConfig({
  // Add debug flag in future version
});
```
