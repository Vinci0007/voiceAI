# ConferenceManager

Multi-speaker conference management service for real-time voice translation.

## Overview

The `ConferenceManager` handles multi-person conference sessions with support for:
- Audio stream separation for multiple speakers (up to 10)
- Independent translation queues per speaker
- Translation result ordering management
- Audio mixing for overlapping outputs

## Requirements

This service implements the following requirements:
- **7.1**: Support up to 10 simultaneous speakers in conference mode
- **7.2**: Separate audio streams for each speaker and process independently
- **7.3**: Maintain independent translation queues per speaker
- **7.4**: Output translations in reception order
- **7.5**: Mix overlapping audio outputs

## Features

### Speaker Stream Management
- Automatic speaker stream creation on first audio segment
- Maximum speaker limit enforcement (default: 10)
- Speaker activity tracking
- Inactive speaker cleanup

### Independent Translation Queues
- Separate processing queue for each speaker
- Queue item status tracking (pending, processing, completed, failed)
- Global reception order tracking across all speakers
- Queue statistics per speaker

### Translation Result Ordering
- Maintains global reception order across all speakers
- Outputs can be retrieved in order
- Support for limiting output count
- Next-output retrieval with automatic removal

### Audio Mixing
- Mix multiple audio buffers into single output
- Configurable maximum simultaneous outputs
- Volume adjustment for mixed audio
- Automatic gain control (AGC) to prevent clipping
- Timestamp preservation (uses earliest)

## Usage

### Basic Setup

```typescript
import { ConferenceManager } from '@/services';

// Create conference manager with default settings
const conferenceManager = new ConferenceManager();

// Or with custom configuration
const conferenceManager = new ConferenceManager(
  streamProcessor,  // Optional custom StreamProcessor
  10,              // Max speakers (default: 10)
  {
    maxSimultaneousOutputs: 3,  // Max audio streams to mix
    mixVolume: 0.7,             // Volume adjustment (0-1)
    enableAGC: true,            // Enable automatic gain control
  }
);
```

### Processing Audio from Multiple Speakers

```typescript
// Process audio segment from a speaker
const queueId = await conferenceManager.processAudioSegment(
  audioBuffer,      // Audio data
  speakerInfo,      // Speaker identification
  userId,           // User ID
  targetLanguage    // Target language for translation
);

// The audio is automatically queued and processed asynchronously
```

### Retrieving Outputs in Order

```typescript
// Get all outputs in reception order
const outputs = conferenceManager.getOutputsInOrder();

// Get limited number of outputs
const recentOutputs = conferenceManager.getOutputsInOrder(5);

// Get next output (removes from queue)
const nextOutput = conferenceManager.getNextOutput();
if (nextOutput) {
  // Play or process the output
  playAudio(nextOutput.translatedAudio);
}
```

### Mixing Overlapping Audio

```typescript
// Get overlapping outputs within time window
const overlapping = conferenceManager.getOverlappingOutputs(1000); // 1 second

// Mix multiple audio buffers
if (overlapping.length > 1) {
  const mixedAudio = conferenceManager.mixAudioOutputs(overlapping);
  playAudio(mixedAudio);
}

// Or manually mix specific outputs
const audio1 = output1.translatedAudio;
const audio2 = output2.translatedAudio;
const mixed = conferenceManager.mixAudioOutputs([audio1, audio2]);
```

### Monitoring and Statistics

```typescript
// Get conference statistics
const stats = conferenceManager.getStats();
console.log(`Total speakers: ${stats.totalSpeakers}`);
console.log(`Active speakers: ${stats.activeSpeakers}`);
console.log(`Total processed: ${stats.totalProcessed}`);
console.log(`Average queue time: ${stats.averageQueueTime}ms`);

// Get speaker-specific queue status
const queueStatus = conferenceManager.getSpeakerQueueStatus('speaker1');
console.log(`Pending: ${queueStatus.pending}`);
console.log(`Processing: ${queueStatus.processing}`);
console.log(`Completed: ${queueStatus.completed}`);
console.log(`Failed: ${queueStatus.failed}`);

// Get all speaker streams
const streams = conferenceManager.getAllSpeakerStreams();
streams.forEach(stream => {
  console.log(`Speaker ${stream.speakerId}: ${stream.queue.length} items`);
});

// Get active speakers only
const activeStreams = conferenceManager.getActiveSpeakerStreams();
```

### Cleanup and Maintenance

```typescript
// Clear completed outputs
conferenceManager.clearCompletedOutputs();

// Remove inactive speakers (inactive for > 60 seconds)
conferenceManager.removeInactiveSpeakers(60000);

// Reset entire conference state
conferenceManager.reset();

// Cleanup resources (waits for pending items)
await conferenceManager.cleanup();
```

## API Reference

### Constructor

```typescript
constructor(
  streamProcessor?: StreamProcessor,
  maxSpeakers?: number,
  mixConfig?: Partial<AudioMixConfig>
)
```

### Methods

#### processAudioSegment
Process audio from a speaker through the translation pipeline.

```typescript
async processAudioSegment(
  audio: AudioBuffer,
  speakerInfo: SpeakerInfo,
  userId: string,
  targetLanguage: string
): Promise<string>
```

Returns: Queue item ID

#### getOutputsInOrder
Get completed outputs sorted by reception order.

```typescript
getOutputsInOrder(limit?: number): ProcessedOutput[]
```

#### getNextOutput
Get and remove the next output in reception order.

```typescript
getNextOutput(): ProcessedOutput | null
```

#### mixAudioOutputs
Mix multiple audio buffers into a single output.

```typescript
mixAudioOutputs(audioBuffers: AudioBuffer[]): AudioBuffer
```

#### getOverlappingOutputs
Get outputs that overlap within a time window.

```typescript
getOverlappingOutputs(timeWindowMs?: number): AudioBuffer[]
```

#### getSpeakerStream
Get speaker stream by ID.

```typescript
getSpeakerStream(speakerId: string): SpeakerStream | undefined
```

#### getAllSpeakerStreams
Get all speaker streams.

```typescript
getAllSpeakerStreams(): SpeakerStream[]
```

#### getActiveSpeakerStreams
Get only active speaker streams.

```typescript
getActiveSpeakerStreams(): SpeakerStream[]
```

#### getSpeakerQueueStatus
Get queue status for a specific speaker.

```typescript
getSpeakerQueueStatus(speakerId: string): {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}
```

#### getStats
Get conference statistics.

```typescript
getStats(): ConferenceStats
```

#### clearCompletedOutputs
Clear all completed outputs from memory.

```typescript
clearCompletedOutputs(): void
```

#### removeInactiveSpeakers
Remove speakers inactive for longer than threshold.

```typescript
removeInactiveSpeakers(inactivityThresholdMs?: number): void
```

#### reset
Reset entire conference state.

```typescript
reset(): void
```

#### cleanup
Cleanup resources and wait for pending items.

```typescript
async cleanup(): Promise<void>
```

## Types

### TranslationQueueItem
```typescript
interface TranslationQueueItem {
  id: string;
  speakerId: string;
  audio: AudioBuffer;
  receptionOrder: number;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: ProcessedOutput;
  error?: Error;
}
```

### SpeakerStream
```typescript
interface SpeakerStream {
  speakerId: string;
  speakerInfo: SpeakerInfo;
  queue: TranslationQueueItem[];
  isActive: boolean;
  lastActivityTime: number;
}
```

### AudioMixConfig
```typescript
interface AudioMixConfig {
  maxSimultaneousOutputs: number;  // Default: 3
  mixVolume: number;               // Default: 0.7
  enableAGC: boolean;              // Default: true
}
```

### ConferenceStats
```typescript
interface ConferenceStats {
  totalSpeakers: number;
  activeSpeakers: number;
  totalProcessed: number;
  queuedItems: number;
  averageQueueTime: number;
  mixedOutputs: number;
}
```

## Example: Complete Conference Flow

```typescript
import { ConferenceManager, StreamProcessor } from '@/services';

// Initialize
const streamProcessor = new StreamProcessor();
const conference = new ConferenceManager(streamProcessor, 10);

// Process audio from multiple speakers
async function handleConference() {
  // Speaker 1 speaks
  await conference.processAudioSegment(
    audioBuffer1,
    { speakerId: 'speaker1', confidence: 0.95, isNewSpeaker: false },
    'user1',
    'es'
  );

  // Speaker 2 speaks
  await conference.processAudioSegment(
    audioBuffer2,
    { speakerId: 'speaker2', confidence: 0.92, isNewSpeaker: false },
    'user1',
    'es'
  );

  // Speaker 1 speaks again
  await conference.processAudioSegment(
    audioBuffer3,
    { speakerId: 'speaker1', confidence: 0.95, isNewSpeaker: false },
    'user1',
    'es'
  );

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get outputs in order
  const outputs = conference.getOutputsInOrder();
  
  // Check for overlapping audio
  const overlapping = conference.getOverlappingOutputs(1000);
  if (overlapping.length > 1) {
    // Mix overlapping audio
    const mixed = conference.mixAudioOutputs(overlapping);
    playAudio(mixed);
  } else {
    // Play outputs sequentially
    for (const output of outputs) {
      playAudio(output.translatedAudio);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Get statistics
  const stats = conference.getStats();
  console.log(`Conference stats:`, stats);

  // Cleanup
  await conference.cleanup();
}
```

## Performance Considerations

1. **Memory Management**: Completed outputs are stored in memory. Use `clearCompletedOutputs()` periodically to free memory.

2. **Speaker Limit**: The default limit of 10 speakers prevents resource exhaustion. Adjust based on your hardware capabilities.

3. **Audio Mixing**: Mixing is CPU-intensive. The `maxSimultaneousOutputs` setting limits the number of streams mixed at once.

4. **Queue Processing**: Each speaker's queue is processed asynchronously. Monitor queue sizes to detect processing bottlenecks.

5. **Inactive Cleanup**: Use `removeInactiveSpeakers()` to free resources from speakers who have left the conference.

## Error Handling

The ConferenceManager handles errors gracefully:

- **Maximum speakers exceeded**: Throws error when trying to add more speakers than the limit
- **Processing failures**: Marks queue items as 'failed' and stores the error
- **Empty audio mixing**: Throws error when trying to mix zero buffers

Always wrap operations in try-catch blocks:

```typescript
try {
  await conference.processAudioSegment(audio, speakerInfo, userId, targetLang);
} catch (error) {
  console.error('Failed to process audio:', error);
  // Handle error appropriately
}
```

## Testing

The ConferenceManager includes comprehensive unit tests covering:
- Speaker stream management
- Independent translation queues
- Translation result ordering
- Audio mixing with AGC
- Statistics and monitoring
- Cleanup and reset operations

Run tests with:
```bash
npm test ConferenceManager.test.ts
```
