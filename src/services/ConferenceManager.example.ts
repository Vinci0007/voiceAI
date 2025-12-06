/**
 * ConferenceManager Usage Examples
 * 
 * Demonstrates how to use the ConferenceManager for multi-speaker conferences
 */

import { ConferenceManager, StreamProcessor } from './index';
import type { AudioBuffer, SpeakerInfo } from '../types';

// Helper function to create mock audio buffer
function createAudioBuffer(duration: number = 1000): AudioBuffer {
  const sampleRate = 16000;
  const samples = Math.floor((sampleRate * duration) / 1000);
  const data = new Float32Array(samples);
  
  // Generate simple sine wave
  for (let i = 0; i < samples; i++) {
    data[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.3;
  }
  
  return {
    data,
    sampleRate,
    channels: 1,
    timestamp: Date.now(),
  };
}

// Helper function to simulate audio playback
function playAudio(audio: AudioBuffer): void {
  console.log(`Playing audio: ${audio.data.length} samples at ${audio.sampleRate}Hz`);
}

/**
 * Example 1: Basic Conference Setup
 */
async function example1_BasicSetup() {
  console.log('\n=== Example 1: Basic Conference Setup ===\n');

  // Create conference manager with default settings
  const conference = new ConferenceManager();

  // Create speaker info
  const speaker1: SpeakerInfo = {
    speakerId: 'alice',
    confidence: 0.95,
    isNewSpeaker: false,
  };

  const speaker2: SpeakerInfo = {
    speakerId: 'bob',
    confidence: 0.92,
    isNewSpeaker: false,
  };

  // Process audio from multiple speakers
  const audio1 = createAudioBuffer(1000);
  const audio2 = createAudioBuffer(1000);

  console.log('Processing audio from Alice...');
  await conference.processAudioSegment(audio1, speaker1, 'user1', 'es');

  console.log('Processing audio from Bob...');
  await conference.processAudioSegment(audio2, speaker2, 'user1', 'es');

  // Get statistics
  const stats = conference.getStats();
  console.log('\nConference Statistics:');
  console.log(`- Total speakers: ${stats.totalSpeakers}`);
  console.log(`- Active speakers: ${stats.activeSpeakers}`);
  console.log(`- Queued items: ${stats.queuedItems}`);

  // Cleanup
  await conference.cleanup();
}

/**
 * Example 2: Processing Multiple Speakers
 */
async function example2_MultipleSpeakers() {
  console.log('\n=== Example 2: Processing Multiple Speakers ===\n');

  const conference = new ConferenceManager();

  // Simulate 5 speakers in a conference
  const speakers = ['alice', 'bob', 'charlie', 'diana', 'eve'];

  for (const speakerId of speakers) {
    const speakerInfo: SpeakerInfo = {
      speakerId,
      confidence: 0.9 + Math.random() * 0.1,
      isNewSpeaker: false,
    };

    const audio = createAudioBuffer(500);
    
    console.log(`Processing audio from ${speakerId}...`);
    await conference.processAudioSegment(audio, speakerInfo, 'user1', 'es');
  }

  // Get all speaker streams
  const streams = conference.getAllSpeakerStreams();
  console.log(`\nTotal speaker streams: ${streams.length}`);
  
  streams.forEach(stream => {
    const status = conference.getSpeakerQueueStatus(stream.speakerId);
    console.log(`- ${stream.speakerId}: ${status.pending} pending, ${status.completed} completed`);
  });

  await conference.cleanup();
}

/**
 * Example 3: Translation Result Ordering
 */
async function example3_ResultOrdering() {
  console.log('\n=== Example 3: Translation Result Ordering ===\n');

  const conference = new ConferenceManager();

  const speaker1: SpeakerInfo = {
    speakerId: 'alice',
    confidence: 0.95,
    isNewSpeaker: false,
  };

  const speaker2: SpeakerInfo = {
    speakerId: 'bob',
    confidence: 0.92,
    isNewSpeaker: false,
  };

  // Process audio in specific order
  console.log('1. Alice speaks first');
  await conference.processAudioSegment(createAudioBuffer(), speaker1, 'user1', 'es');

  console.log('2. Bob speaks second');
  await conference.processAudioSegment(createAudioBuffer(), speaker2, 'user1', 'es');

  console.log('3. Alice speaks third');
  await conference.processAudioSegment(createAudioBuffer(), speaker1, 'user1', 'es');

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get outputs in order
  console.log('\nRetrieving outputs in reception order:');
  const outputs = conference.getOutputsInOrder();
  
  outputs.forEach((output, index) => {
    console.log(`${index + 1}. Speaker: ${output.speakerId}, Timestamp: ${output.timestamp}`);
  });

  await conference.cleanup();
}

/**
 * Example 4: Audio Mixing
 */
async function example4_AudioMixing() {
  console.log('\n=== Example 4: Audio Mixing ===\n');

  // Create conference with custom mix configuration
  const conference = new ConferenceManager(undefined, 10, {
    maxSimultaneousOutputs: 3,
    mixVolume: 0.7,
    enableAGC: true,
  });

  // Create multiple audio buffers
  const audio1 = createAudioBuffer(1000);
  const audio2 = createAudioBuffer(1000);
  const audio3 = createAudioBuffer(1000);

  console.log('Mixing 3 audio buffers...');
  const mixed = conference.mixAudioOutputs([audio1, audio2, audio3]);

  console.log(`Mixed audio: ${mixed.data.length} samples`);
  console.log(`Sample rate: ${mixed.sampleRate}Hz`);
  console.log(`Channels: ${mixed.channels}`);

  // Check for clipping
  const maxValue = Math.max(...Array.from(mixed.data));
  console.log(`Peak amplitude: ${maxValue.toFixed(3)} (should be ≤ 1.0)`);

  const stats = conference.getStats();
  console.log(`Mixed outputs count: ${stats.mixedOutputs}`);

  await conference.cleanup();
}

/**
 * Example 5: Overlapping Audio Detection
 */
async function example5_OverlappingAudio() {
  console.log('\n=== Example 5: Overlapping Audio Detection ===\n');

  const conference = new ConferenceManager();

  const speaker1: SpeakerInfo = {
    speakerId: 'alice',
    confidence: 0.95,
    isNewSpeaker: false,
  };

  const speaker2: SpeakerInfo = {
    speakerId: 'bob',
    confidence: 0.92,
    isNewSpeaker: false,
  };

  // Process audio from both speakers in quick succession
  console.log('Alice and Bob speak almost simultaneously...');
  await conference.processAudioSegment(createAudioBuffer(), speaker1, 'user1', 'es');
  await new Promise(resolve => setTimeout(resolve, 100));
  await conference.processAudioSegment(createAudioBuffer(), speaker2, 'user1', 'es');

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check for overlapping outputs
  const overlapping = conference.getOverlappingOutputs(1000);
  console.log(`\nFound ${overlapping.length} overlapping audio outputs`);

  if (overlapping.length > 1) {
    console.log('Mixing overlapping audio...');
    const mixed = conference.mixAudioOutputs(overlapping);
    playAudio(mixed);
  } else {
    console.log('No overlapping audio, playing sequentially...');
    const outputs = conference.getOutputsInOrder();
    for (const output of outputs) {
      playAudio(output.translatedAudio);
    }
  }

  await conference.cleanup();
}

/**
 * Example 6: Queue Monitoring
 */
async function example6_QueueMonitoring() {
  console.log('\n=== Example 6: Queue Monitoring ===\n');

  const conference = new ConferenceManager();

  const speaker: SpeakerInfo = {
    speakerId: 'alice',
    confidence: 0.95,
    isNewSpeaker: false,
  };

  // Process multiple audio segments
  console.log('Processing 5 audio segments...');
  for (let i = 0; i < 5; i++) {
    await conference.processAudioSegment(createAudioBuffer(), speaker, 'user1', 'es');
    console.log(`Segment ${i + 1} queued`);
  }

  // Monitor queue status
  console.log('\nMonitoring queue status:');
  for (let i = 0; i < 10; i++) {
    const status = conference.getSpeakerQueueStatus('alice');
    console.log(
      `[${i}] Pending: ${status.pending}, Processing: ${status.processing}, ` +
      `Completed: ${status.completed}, Failed: ${status.failed}`
    );
    
    if (status.pending === 0 && status.processing === 0) {
      console.log('All items processed!');
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  await conference.cleanup();
}

/**
 * Example 7: Speaker Limit Enforcement
 */
async function example7_SpeakerLimit() {
  console.log('\n=== Example 7: Speaker Limit Enforcement ===\n');

  // Create conference with low speaker limit
  const conference = new ConferenceManager(undefined, 3);

  console.log('Conference allows maximum 3 speakers\n');

  // Add 3 speakers successfully
  for (let i = 1; i <= 3; i++) {
    const speaker: SpeakerInfo = {
      speakerId: `speaker${i}`,
      confidence: 0.95,
      isNewSpeaker: false,
    };
    
    await conference.processAudioSegment(createAudioBuffer(), speaker, 'user1', 'es');
    console.log(`✓ Speaker ${i} added successfully`);
  }

  // Try to add 4th speaker
  try {
    const speaker4: SpeakerInfo = {
      speakerId: 'speaker4',
      confidence: 0.95,
      isNewSpeaker: false,
    };
    
    await conference.processAudioSegment(createAudioBuffer(), speaker4, 'user1', 'es');
    console.log('✓ Speaker 4 added successfully');
  } catch (error) {
    console.log(`✗ Speaker 4 rejected: ${(error as Error).message}`);
  }

  // Existing speaker can continue
  const speaker1: SpeakerInfo = {
    speakerId: 'speaker1',
    confidence: 0.95,
    isNewSpeaker: false,
  };
  
  await conference.processAudioSegment(createAudioBuffer(), speaker1, 'user1', 'es');
  console.log('✓ Existing speaker 1 can continue');

  await conference.cleanup();
}

/**
 * Example 8: Inactive Speaker Cleanup
 */
async function example8_InactiveCleanup() {
  console.log('\n=== Example 8: Inactive Speaker Cleanup ===\n');

  const conference = new ConferenceManager();

  // Add some speakers
  const speakers = ['alice', 'bob', 'charlie'];
  for (const speakerId of speakers) {
    const speaker: SpeakerInfo = {
      speakerId,
      confidence: 0.95,
      isNewSpeaker: false,
    };
    await conference.processAudioSegment(createAudioBuffer(), speaker, 'user1', 'es');
  }

  console.log(`Initial speakers: ${conference.getAllSpeakerStreams().length}`);

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100));

  // Remove inactive speakers (inactive for > 50ms)
  console.log('\nRemoving inactive speakers (threshold: 50ms)...');
  conference.removeInactiveSpeakers(50);

  console.log(`Remaining speakers: ${conference.getAllSpeakerStreams().length}`);

  await conference.cleanup();
}

/**
 * Example 9: Complete Conference Flow
 */
async function example9_CompleteFlow() {
  console.log('\n=== Example 9: Complete Conference Flow ===\n');

  const streamProcessor = new StreamProcessor();
  const conference = new ConferenceManager(streamProcessor, 10);

  // Simulate a real conference
  console.log('Starting conference with 3 participants...\n');

  const participants = [
    { id: 'alice', name: 'Alice' },
    { id: 'bob', name: 'Bob' },
    { id: 'charlie', name: 'Charlie' },
  ];

  // Each participant speaks multiple times
  for (let round = 1; round <= 3; round++) {
    console.log(`--- Round ${round} ---`);
    
    for (const participant of participants) {
      const speaker: SpeakerInfo = {
        speakerId: participant.id,
        confidence: 0.9 + Math.random() * 0.1,
        isNewSpeaker: false,
      };

      console.log(`${participant.name} is speaking...`);
      await conference.processAudioSegment(
        createAudioBuffer(500),
        speaker,
        'user1',
        'es'
      );
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Wait for all processing to complete
  console.log('\nWaiting for processing to complete...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get final statistics
  const stats = conference.getStats();
  console.log('\n=== Final Statistics ===');
  console.log(`Total speakers: ${stats.totalSpeakers}`);
  console.log(`Active speakers: ${stats.activeSpeakers}`);
  console.log(`Total processed: ${stats.totalProcessed}`);
  console.log(`Average queue time: ${stats.averageQueueTime.toFixed(2)}ms`);

  // Get outputs
  const outputs = conference.getOutputsInOrder();
  console.log(`\nTotal outputs: ${outputs.length}`);

  // Play outputs
  console.log('\nPlaying outputs in order:');
  for (const output of outputs.slice(0, 5)) {
    console.log(`- ${output.speakerId}: "${output.originalText}" → "${output.translatedText}"`);
  }

  // Cleanup
  await conference.cleanup();
  console.log('\nConference ended.');
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await example1_BasicSetup();
    await example2_MultipleSpeakers();
    await example3_ResultOrdering();
    await example4_AudioMixing();
    await example5_OverlappingAudio();
    await example6_QueueMonitoring();
    await example7_SpeakerLimit();
    await example8_InactiveCleanup();
    await example9_CompleteFlow();
    
    console.log('\n✓ All examples completed successfully!');
  } catch (error) {
    console.error('\n✗ Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  example1_BasicSetup,
  example2_MultipleSpeakers,
  example3_ResultOrdering,
  example4_AudioMixing,
  example5_OverlappingAudio,
  example6_QueueMonitoring,
  example7_SpeakerLimit,
  example8_InactiveCleanup,
  example9_CompleteFlow,
};
