/**
 * ConferenceManager Tests
 * 
 * Tests for multi-speaker conference functionality including:
 * - Audio stream separation
 * - Independent translation queues
 * - Translation result ordering
 * - Audio mixing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConferenceManager } from './ConferenceManager';
import { StreamProcessor } from './StreamProcessor';
import type { AudioBuffer, SpeakerInfo, ProcessedOutput } from '../types';

// Mock StreamProcessor
vi.mock('./StreamProcessor');

describe('ConferenceManager', () => {
  let conferenceManager: ConferenceManager;
  let mockStreamProcessor: StreamProcessor;

  // Helper function to create mock audio buffer
  const createMockAudioBuffer = (timestamp: number = Date.now()): AudioBuffer => ({
    data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
    sampleRate: 16000,
    channels: 1,
    timestamp,
  });

  // Helper function to create mock speaker info
  const createMockSpeakerInfo = (speakerId: string): SpeakerInfo => ({
    speakerId,
    confidence: 0.95,
    isNewSpeaker: false,
  });

  // Helper function to create mock processed output
  const createMockProcessedOutput = (
    speakerId: string,
    timestamp: number
  ): ProcessedOutput => ({
    speakerId,
    originalText: 'Hello',
    translatedText: 'Hola',
    translatedAudio: createMockAudioBuffer(timestamp),
    timestamp,
    latency: 1000,
  });

  beforeEach(() => {
    mockStreamProcessor = new StreamProcessor();
    conferenceManager = new ConferenceManager(mockStreamProcessor, 10);
  });

  describe('Speaker Stream Management', () => {
    it('should create speaker stream for new speaker', async () => {
      const audio = createMockAudioBuffer();
      const speakerInfo = createMockSpeakerInfo('speaker1');

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      const queueId = await conferenceManager.processAudioSegment(
        audio,
        speakerInfo,
        'user1',
        'es'
      );

      expect(queueId).toBeDefined();
      expect(queueId).toMatch(/^queue_/);

      const stream = conferenceManager.getSpeakerStream('speaker1');
      expect(stream).toBeDefined();
      expect(stream?.speakerId).toBe('speaker1');
      expect(stream?.isActive).toBe(true);
    });

    it('should maintain separate streams for different speakers', async () => {
      const audio1 = createMockAudioBuffer();
      const audio2 = createMockAudioBuffer();
      const speaker1 = createMockSpeakerInfo('speaker1');
      const speaker2 = createMockSpeakerInfo('speaker2');

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(audio1, speaker1, 'user1', 'es');
      await conferenceManager.processAudioSegment(audio2, speaker2, 'user1', 'es');

      const streams = conferenceManager.getAllSpeakerStreams();
      expect(streams).toHaveLength(2);
      expect(streams.map(s => s.speakerId)).toContain('speaker1');
      expect(streams.map(s => s.speakerId)).toContain('speaker2');
    });

    it('should enforce maximum speaker limit', async () => {
      const smallConference = new ConferenceManager(mockStreamProcessor, 2);
      const audio = createMockAudioBuffer();

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await smallConference.processAudioSegment(
        audio,
        createMockSpeakerInfo('speaker1'),
        'user1',
        'es'
      );
      await smallConference.processAudioSegment(
        audio,
        createMockSpeakerInfo('speaker2'),
        'user1',
        'es'
      );

      await expect(
        smallConference.processAudioSegment(
          audio,
          createMockSpeakerInfo('speaker3'),
          'user1',
          'es'
        )
      ).rejects.toThrow('Maximum number of speakers');
    });

    it('should allow existing speaker to continue after limit reached', async () => {
      const smallConference = new ConferenceManager(mockStreamProcessor, 2);
      const audio = createMockAudioBuffer();

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await smallConference.processAudioSegment(
        audio,
        createMockSpeakerInfo('speaker1'),
        'user1',
        'es'
      );
      await smallConference.processAudioSegment(
        audio,
        createMockSpeakerInfo('speaker2'),
        'user1',
        'es'
      );

      // Existing speaker should be able to add more audio
      await expect(
        smallConference.processAudioSegment(
          audio,
          createMockSpeakerInfo('speaker1'),
          'user1',
          'es'
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Independent Translation Queues', () => {
    it('should maintain separate queue for each speaker', async () => {
      const audio = createMockAudioBuffer();
      const speaker1 = createMockSpeakerInfo('speaker1');
      const speaker2 = createMockSpeakerInfo('speaker2');

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(audio, speaker1, 'user1', 'es');
      await conferenceManager.processAudioSegment(audio, speaker1, 'user1', 'es');
      await conferenceManager.processAudioSegment(audio, speaker2, 'user1', 'es');

      const stream1 = conferenceManager.getSpeakerStream('speaker1');
      const stream2 = conferenceManager.getSpeakerStream('speaker2');

      expect(stream1?.queue).toHaveLength(2);
      expect(stream2?.queue).toHaveLength(1);
    });

    it('should track queue item status', async () => {
      const audio = createMockAudioBuffer();
      const speakerInfo = createMockSpeakerInfo('speaker1');

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const stream = conferenceManager.getSpeakerStream('speaker1');
      expect(stream?.queue[0].status).toMatch(/pending|processing|completed/);
    });

    it('should assign unique queue item IDs', async () => {
      const audio = createMockAudioBuffer();
      const speakerInfo = createMockSpeakerInfo('speaker1');

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      const id1 = await conferenceManager.processAudioSegment(
        audio,
        speakerInfo,
        'user1',
        'es'
      );
      const id2 = await conferenceManager.processAudioSegment(
        audio,
        speakerInfo,
        'user1',
        'es'
      );

      expect(id1).not.toBe(id2);
    });
  });

  describe('Translation Result Ordering', () => {
    it('should maintain global reception order', async () => {
      const audio = createMockAudioBuffer();
      const speaker1 = createMockSpeakerInfo('speaker1');
      const speaker2 = createMockSpeakerInfo('speaker2');

      let callCount = 0;
      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockImplementation(
        async () => {
          const timestamp = Date.now() + callCount * 100;
          callCount++;
          return createMockProcessedOutput('speaker1', timestamp);
        }
      );

      await conferenceManager.processAudioSegment(audio, speaker1, 'user1', 'es');
      await conferenceManager.processAudioSegment(audio, speaker2, 'user1', 'es');
      await conferenceManager.processAudioSegment(audio, speaker1, 'user1', 'es');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const outputs = conferenceManager.getOutputsInOrder();
      
      // Outputs should be sorted by timestamp (reception order)
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i].timestamp).toBeGreaterThanOrEqual(outputs[i - 1].timestamp);
      }
    });

    it('should return outputs in order with limit', async () => {
      const audio = createMockAudioBuffer();
      const speakerInfo = createMockSpeakerInfo('speaker1');

      let callCount = 0;
      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockImplementation(
        async () => {
          const timestamp = Date.now() + callCount * 100;
          callCount++;
          return createMockProcessedOutput('speaker1', timestamp);
        }
      );

      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');
      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');
      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const outputs = conferenceManager.getOutputsInOrder(2);
      expect(outputs.length).toBeLessThanOrEqual(2);
    });

    it('should get next output in order', async () => {
      const audio = createMockAudioBuffer();
      const speakerInfo = createMockSpeakerInfo('speaker1');

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');
      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const output1 = conferenceManager.getNextOutput();
      const output2 = conferenceManager.getNextOutput();

      expect(output1).toBeDefined();
      expect(output2).toBeDefined();
      
      if (output1 && output2) {
        expect(output1.timestamp).toBeLessThanOrEqual(output2.timestamp);
      }
    });

    it('should return null when no outputs available', () => {
      const output = conferenceManager.getNextOutput();
      expect(output).toBeNull();
    });
  });

  describe('Audio Mixing', () => {
    it('should mix multiple audio buffers', () => {
      const audio1 = createMockAudioBuffer(1000);
      const audio2 = createMockAudioBuffer(2000);
      const audio3 = createMockAudioBuffer(3000);

      const mixed = conferenceManager.mixAudioOutputs([audio1, audio2, audio3]);

      expect(mixed).toBeDefined();
      expect(mixed.data).toBeInstanceOf(Float32Array);
      expect(mixed.sampleRate).toBe(16000);
      expect(mixed.channels).toBe(1);
    });

    it('should return single buffer when only one provided', () => {
      const audio = createMockAudioBuffer();
      const mixed = conferenceManager.mixAudioOutputs([audio]);

      expect(mixed).toBe(audio);
    });

    it('should throw error when no buffers provided', () => {
      expect(() => conferenceManager.mixAudioOutputs([])).toThrow(
        'No audio buffers to mix'
      );
    });

    it('should limit simultaneous outputs', () => {
      const buffers = [
        createMockAudioBuffer(),
        createMockAudioBuffer(),
        createMockAudioBuffer(),
        createMockAudioBuffer(),
        createMockAudioBuffer(),
      ];

      const manager = new ConferenceManager(mockStreamProcessor, 10, {
        maxSimultaneousOutputs: 3,
      });

      const mixed = manager.mixAudioOutputs(buffers);
      expect(mixed).toBeDefined();
    });

    it('should apply volume adjustment', () => {
      const audio1 = createMockAudioBuffer();
      const audio2 = createMockAudioBuffer();

      // Set specific values for testing
      audio1.data.fill(0.5);
      audio2.data.fill(0.5);

      const manager = new ConferenceManager(mockStreamProcessor, 10, {
        mixVolume: 0.5,
        enableAGC: false,
      });

      const mixed = manager.mixAudioOutputs([audio1, audio2]);

      // Each sample should be sum of inputs * mixVolume
      // 0.5 * 0.5 + 0.5 * 0.5 = 0.5
      expect(mixed.data[0]).toBeCloseTo(0.5, 1);
    });

    it('should apply automatic gain control', () => {
      const audio1 = createMockAudioBuffer();
      const audio2 = createMockAudioBuffer();

      // Set high values that would clip
      audio1.data.fill(0.8);
      audio2.data.fill(0.8);

      const manager = new ConferenceManager(mockStreamProcessor, 10, {
        mixVolume: 1.0,
        enableAGC: true,
      });

      const mixed = manager.mixAudioOutputs([audio1, audio2]);

      // AGC should prevent clipping
      const maxValue = Math.max(...Array.from(mixed.data));
      expect(maxValue).toBeLessThanOrEqual(1.0);
    });

    it('should use earliest timestamp for mixed output', () => {
      const audio1 = createMockAudioBuffer(1000);
      const audio2 = createMockAudioBuffer(2000);
      const audio3 = createMockAudioBuffer(3000);

      const mixed = conferenceManager.mixAudioOutputs([audio1, audio2, audio3]);

      expect(mixed.timestamp).toBe(1000);
    });

    it('should track mixed outputs in stats', () => {
      const audio1 = createMockAudioBuffer();
      const audio2 = createMockAudioBuffer();

      conferenceManager.mixAudioOutputs([audio1, audio2]);
      conferenceManager.mixAudioOutputs([audio1, audio2]);

      const stats = conferenceManager.getStats();
      expect(stats.mixedOutputs).toBe(2);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track total speakers', async () => {
      const audio = createMockAudioBuffer();

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(
        audio,
        createMockSpeakerInfo('speaker1'),
        'user1',
        'es'
      );
      await conferenceManager.processAudioSegment(
        audio,
        createMockSpeakerInfo('speaker2'),
        'user1',
        'es'
      );

      const stats = conferenceManager.getStats();
      expect(stats.totalSpeakers).toBe(2);
    });

    it('should track active speakers', async () => {
      const audio = createMockAudioBuffer();

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(
        audio,
        createMockSpeakerInfo('speaker1'),
        'user1',
        'es'
      );

      const stats = conferenceManager.getStats();
      expect(stats.activeSpeakers).toBeGreaterThan(0);
    });

    it('should get queue status for speaker', async () => {
      const audio = createMockAudioBuffer();
      const speakerInfo = createMockSpeakerInfo('speaker1');

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');

      const status = conferenceManager.getSpeakerQueueStatus('speaker1');
      expect(status).toHaveProperty('pending');
      expect(status).toHaveProperty('processing');
      expect(status).toHaveProperty('completed');
      expect(status).toHaveProperty('failed');
    });

    it('should return empty status for unknown speaker', () => {
      const status = conferenceManager.getSpeakerQueueStatus('unknown');
      expect(status.pending).toBe(0);
      expect(status.processing).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.failed).toBe(0);
    });
  });

  describe('Cleanup and Reset', () => {
    it('should clear completed outputs', async () => {
      const audio = createMockAudioBuffer();
      const speakerInfo = createMockSpeakerInfo('speaker1');

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');
      await new Promise(resolve => setTimeout(resolve, 100));

      conferenceManager.clearCompletedOutputs();
      const outputs = conferenceManager.getOutputsInOrder();
      expect(outputs).toHaveLength(0);
    });

    it('should remove inactive speakers', async () => {
      const audio = createMockAudioBuffer();

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(
        audio,
        createMockSpeakerInfo('speaker1'),
        'user1',
        'es'
      );

      // Wait a bit to ensure time has passed
      await new Promise(resolve => setTimeout(resolve, 10));

      // Remove speakers inactive for 1ms (should remove the speaker)
      conferenceManager.removeInactiveSpeakers(1);

      const streams = conferenceManager.getAllSpeakerStreams();
      expect(streams).toHaveLength(0);
    });

    it('should reset conference state', async () => {
      const audio = createMockAudioBuffer();

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(
        audio,
        createMockSpeakerInfo('speaker1'),
        'user1',
        'es'
      );

      conferenceManager.reset();

      const streams = conferenceManager.getAllSpeakerStreams();
      const outputs = conferenceManager.getOutputsInOrder();
      const stats = conferenceManager.getStats();

      expect(streams).toHaveLength(0);
      expect(outputs).toHaveLength(0);
      expect(stats.totalSpeakers).toBe(0);
    });

    it('should cleanup resources', async () => {
      const audio = createMockAudioBuffer();

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(
        audio,
        createMockSpeakerInfo('speaker1'),
        'user1',
        'es'
      );

      await conferenceManager.cleanup();

      const streams = conferenceManager.getAllSpeakerStreams();
      expect(streams).toHaveLength(0);
    });
  });

  describe('Overlapping Outputs', () => {
    it('should identify overlapping outputs within time window', async () => {
      const audio = createMockAudioBuffer();
      const speakerInfo = createMockSpeakerInfo('speaker1');

      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now())
      );

      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');
      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const overlapping = conferenceManager.getOverlappingOutputs(5000);
      expect(overlapping.length).toBeGreaterThan(0);
    });

    it('should not include outputs outside time window', async () => {
      const audio = createMockAudioBuffer();
      const speakerInfo = createMockSpeakerInfo('speaker1');

      // Mock old timestamp
      vi.spyOn(mockStreamProcessor, 'processAudioSegment').mockResolvedValue(
        createMockProcessedOutput('speaker1', Date.now() - 10000)
      );

      await conferenceManager.processAudioSegment(audio, speakerInfo, 'user1', 'es');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const overlapping = conferenceManager.getOverlappingOutputs(1000);
      expect(overlapping).toHaveLength(0);
    });
  });
});
