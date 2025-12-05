import { describe, it, expect } from 'vitest';
import { SessionMode, SessionStatus, NetworkQuality } from './index';

describe('Type definitions', () => {
  it('should have correct SessionMode enum values', () => {
    expect(SessionMode.CONFERENCE).toBe('conference');
    expect(SessionMode.CHAT).toBe('chat');
  });

  it('should have correct SessionStatus enum values', () => {
    expect(SessionStatus.ACTIVE).toBe('active');
    expect(SessionStatus.PAUSED).toBe('paused');
    expect(SessionStatus.ENDED).toBe('ended');
  });

  it('should have correct NetworkQuality enum values', () => {
    expect(NetworkQuality.EXCELLENT).toBe('excellent');
    expect(NetworkQuality.GOOD).toBe('good');
    expect(NetworkQuality.FAIR).toBe('fair');
    expect(NetworkQuality.POOR).toBe('poor');
    expect(NetworkQuality.OFFLINE).toBe('offline');
  });
});
