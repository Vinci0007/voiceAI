import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionStore } from './SessionStore';
import { Message } from '@/types';
import * as TauriAPI from '@/api/tauri';

// Mock Tauri API
vi.mock('@/api/tauri', () => ({
  saveMessage: vi.fn(),
  getSessionMessages: vi.fn(),
}));

describe('SessionStore', () => {
  let sessionStore: SessionStore;

  beforeEach(() => {
    sessionStore = new SessionStore();
    vi.clearAllMocks();
  });

  describe('saveMessage', () => {
    it('should save message to database', async () => {
      const message: Omit<Message, 'id'> = {
        sessionId: 'session-1',
        speakerId: 'speaker-1',
        timestamp: new Date(),
        originalText: 'Hello world',
        originalLanguage: 'en',
        translations: new Map([['zh', '你好世界']]),
      };

      vi.mocked(TauriAPI.saveMessage).mockResolvedValue();

      await sessionStore.saveMessage('session-1', message);

      expect(TauriAPI.saveMessage).toHaveBeenCalledWith(
        'session-1',
        'speaker-1',
        'Hello world',
        'en',
        '你好世界',
        'zh'
      );
    });

    it('should save message without translation', async () => {
      const message: Omit<Message, 'id'> = {
        sessionId: 'session-1',
        speakerId: 'speaker-1',
        timestamp: new Date(),
        originalText: 'Hello world',
        originalLanguage: 'en',
        translations: new Map(),
      };

      vi.mocked(TauriAPI.saveMessage).mockResolvedValue();

      await sessionStore.saveMessage('session-1', message);

      expect(TauriAPI.saveMessage).toHaveBeenCalledWith(
        'session-1',
        'speaker-1',
        'Hello world',
        'en',
        undefined,
        undefined
      );
    });
  });

  describe('getHistory', () => {
    it('should retrieve session messages', async () => {
      const mockDbMessages = [
        {
          id: 1,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: new Date().toISOString(),
          original_text: 'Hello',
          original_language: 'en',
          translated_text: '你好',
          target_language: 'zh',
        },
        {
          id: 2,
          session_id: 'session-1',
          speaker_id: 'speaker-2',
          timestamp: new Date().toISOString(),
          original_text: '你好',
          original_language: 'zh',
          translated_text: 'Hello',
          target_language: 'en',
        },
      ];

      vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockDbMessages);

      const messages = await sessionStore.getHistory('session-1');

      expect(messages).toHaveLength(2);
      expect(messages[0].originalText).toBe('Hello');
      expect(messages[0].translations.get('zh')).toBe('你好');
      expect(messages[1].originalText).toBe('你好');
      expect(messages[1].translations.get('en')).toBe('Hello');
    });

    it('should handle messages without translations', async () => {
      const mockDbMessages = [
        {
          id: 1,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: new Date().toISOString(),
          original_text: 'Hello',
          original_language: 'en',
          translated_text: null,
          target_language: null,
        },
      ];

      vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockDbMessages);

      const messages = await sessionStore.getHistory('session-1');

      expect(messages).toHaveLength(1);
      expect(messages[0].translations.size).toBe(0);
    });
  });

  describe('exportSession', () => {
    it('should export session as JSON', async () => {
      const mockDbMessages = [
        {
          id: 1,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
          original_text: 'Hello',
          original_language: 'en',
          translated_text: '你好',
          target_language: 'zh',
        },
      ];

      vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockDbMessages);

      const json = await sessionStore.exportSession('session-1');
      const data = JSON.parse(json);

      expect(data.sessionId).toBe('session-1');
      expect(data.messageCount).toBe(1);
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].originalText).toBe('Hello');
      expect(data.messages[0].translations.zh).toBe('你好');
    });
  });

  describe('exportSessionAsText', () => {
    it('should export session as plain text', async () => {
      const mockDbMessages = [
        {
          id: 1,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
          original_text: 'Hello',
          original_language: 'en',
          translated_text: '你好',
          target_language: 'zh',
        },
      ];

      vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockDbMessages);

      const text = await sessionStore.exportSessionAsText('session-1');

      expect(text).toContain('会话记录');
      expect(text).toContain('session-1');
      expect(text).toContain('Hello');
      expect(text).toContain('你好');
      expect(text).toContain('speaker-1');
    });
  });

  describe('searchMessages', () => {
    it('should search messages by original text', async () => {
      const mockDbMessages = [
        {
          id: 1,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: new Date().toISOString(),
          original_text: 'Hello world',
          original_language: 'en',
          translated_text: '你好世界',
          target_language: 'zh',
        },
        {
          id: 2,
          session_id: 'session-1',
          speaker_id: 'speaker-2',
          timestamp: new Date().toISOString(),
          original_text: 'Goodbye',
          original_language: 'en',
          translated_text: '再见',
          target_language: 'zh',
        },
      ];

      vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockDbMessages);

      const results = await sessionStore.searchMessages('session-1', 'hello');

      expect(results).toHaveLength(1);
      expect(results[0].originalText).toBe('Hello world');
    });

    it('should search messages by translation', async () => {
      const mockDbMessages = [
        {
          id: 1,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: new Date().toISOString(),
          original_text: 'Hello',
          original_language: 'en',
          translated_text: '你好',
          target_language: 'zh',
        },
      ];

      vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockDbMessages);

      const results = await sessionStore.searchMessages('session-1', '你好');

      expect(results).toHaveLength(1);
      expect(results[0].originalText).toBe('Hello');
    });
  });

  describe('filterBySpeaker', () => {
    it('should filter messages by speaker', async () => {
      const mockDbMessages = [
        {
          id: 1,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: new Date().toISOString(),
          original_text: 'Hello',
          original_language: 'en',
          translated_text: null,
          target_language: null,
        },
        {
          id: 2,
          session_id: 'session-1',
          speaker_id: 'speaker-2',
          timestamp: new Date().toISOString(),
          original_text: 'Hi',
          original_language: 'en',
          translated_text: null,
          target_language: null,
        },
      ];

      vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockDbMessages);

      const results = await sessionStore.filterBySpeaker('session-1', 'speaker-1');

      expect(results).toHaveLength(1);
      expect(results[0].speakerId).toBe('speaker-1');
    });
  });

  describe('filterByTimeRange', () => {
    it('should filter messages by time range', async () => {
      const time1 = new Date('2024-01-01T10:00:00Z');
      const time2 = new Date('2024-01-01T11:00:00Z');
      const time3 = new Date('2024-01-01T12:00:00Z');

      const mockDbMessages = [
        {
          id: 1,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: time1.toISOString(),
          original_text: 'Message 1',
          original_language: 'en',
          translated_text: null,
          target_language: null,
        },
        {
          id: 2,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: time2.toISOString(),
          original_text: 'Message 2',
          original_language: 'en',
          translated_text: null,
          target_language: null,
        },
        {
          id: 3,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: time3.toISOString(),
          original_text: 'Message 3',
          original_language: 'en',
          translated_text: null,
          target_language: null,
        },
      ];

      vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockDbMessages);

      const results = await sessionStore.filterByTimeRange(
        'session-1',
        time1,
        time2
      );

      expect(results).toHaveLength(2);
      expect(results[0].originalText).toBe('Message 1');
      expect(results[1].originalText).toBe('Message 2');
    });
  });

  describe('getSessionStats', () => {
    it('should calculate session statistics', async () => {
      const mockDbMessages = [
        {
          id: 1,
          session_id: 'session-1',
          speaker_id: 'speaker-1',
          timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
          original_text: 'Hello',
          original_language: 'en',
          translated_text: null,
          target_language: null,
        },
        {
          id: 2,
          session_id: 'session-1',
          speaker_id: 'speaker-2',
          timestamp: new Date('2024-01-01T11:00:00Z').toISOString(),
          original_text: '你好',
          original_language: 'zh',
          translated_text: null,
          target_language: null,
        },
      ];

      vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockDbMessages);

      const stats = await sessionStore.getSessionStats('session-1');

      expect(stats.totalMessages).toBe(2);
      expect(stats.uniqueSpeakers).toBe(2);
      expect(stats.languages).toContain('en');
      expect(stats.languages).toContain('zh');
      expect(stats.firstMessage).toBeInstanceOf(Date);
      expect(stats.lastMessage).toBeInstanceOf(Date);
    });

    it('should handle empty session', async () => {
      vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue([]);

      const stats = await sessionStore.getSessionStats('session-1');

      expect(stats.totalMessages).toBe(0);
      expect(stats.uniqueSpeakers).toBe(0);
      expect(stats.languages).toEqual([]);
      expect(stats.firstMessage).toBeNull();
      expect(stats.lastMessage).toBeNull();
    });
  });
});
