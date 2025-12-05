import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from './SessionManager';
import { SessionMode, Participant } from '@/types';
import * as TauriAPI from '@/api/tauri';

// Mock Tauri API
vi.mock('@/api/tauri', () => ({
  createSession: vi.fn(),
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a conference session', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      expect(session.id).toBe('session-1');
      expect(session.mode).toBe(SessionMode.CONFERENCE);
      expect(session.participants).toEqual([]);
      expect(session.state.status).toBe('active');
    });

    it('should create a chat session', async () => {
      const mockDbSession = {
        id: 'session-2',
        mode: 'chat',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CHAT,
        'user-1'
      );

      expect(session.mode).toBe(SessionMode.CHAT);
    });
  });

  describe('switchMode', () => {
    it('should switch from conference to chat mode', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      sessionManager.switchMode(session.id, SessionMode.CHAT);

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.mode).toBe(SessionMode.CHAT);
    });

    it('should preserve session state when switching modes', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      // 更新状态
      sessionManager.updateSessionState(session.id, {
        totalMessages: 10,
        averageLatency: 500,
      });

      // 切换模式
      sessionManager.switchMode(session.id, SessionMode.CHAT);

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.state.totalMessages).toBe(10);
      expect(updatedSession?.state.averageLatency).toBe(500);
    });

    it('should throw error when switching to chat mode with more than 2 participants', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      // 添加3个参与者
      for (let i = 1; i <= 3; i++) {
        const participant: Participant = {
          id: `participant-${i}`,
          name: `Participant ${i}`,
          preferredLanguage: 'en',
          joinedAt: new Date(),
          isMuted: false,
        };
        sessionManager.addParticipant(session.id, participant);
      }

      expect(() => {
        sessionManager.switchMode(session.id, SessionMode.CHAT);
      }).toThrow('Cannot switch to chat mode: more than 2 participants in session');
    });
  });

  describe('addParticipant', () => {
    it('should add participant to conference session', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      const participant: Participant = {
        id: 'participant-1',
        name: 'John Doe',
        preferredLanguage: 'en',
        joinedAt: new Date(),
        isMuted: false,
      };

      sessionManager.addParticipant(session.id, participant);

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.participants).toHaveLength(1);
      expect(updatedSession?.participants[0].id).toBe('participant-1');
    });

    it('should enforce chat mode participant limit (2)', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'chat',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CHAT,
        'user-1'
      );

      // 添加2个参与者
      for (let i = 1; i <= 2; i++) {
        const participant: Participant = {
          id: `participant-${i}`,
          name: `Participant ${i}`,
          preferredLanguage: 'en',
          joinedAt: new Date(),
          isMuted: false,
        };
        sessionManager.addParticipant(session.id, participant);
      }

      // 尝试添加第3个参与者应该失败
      const participant3: Participant = {
        id: 'participant-3',
        name: 'Participant 3',
        preferredLanguage: 'en',
        joinedAt: new Date(),
        isMuted: false,
      };

      expect(() => {
        sessionManager.addParticipant(session.id, participant3);
      }).toThrow('Chat mode only supports 2 participants');
    });

    it('should enforce conference mode participant limit (10)', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      // 添加10个参与者
      for (let i = 1; i <= 10; i++) {
        const participant: Participant = {
          id: `participant-${i}`,
          name: `Participant ${i}`,
          preferredLanguage: 'en',
          joinedAt: new Date(),
          isMuted: false,
        };
        sessionManager.addParticipant(session.id, participant);
      }

      // 尝试添加第11个参与者应该失败
      const participant11: Participant = {
        id: 'participant-11',
        name: 'Participant 11',
        preferredLanguage: 'en',
        joinedAt: new Date(),
        isMuted: false,
      };

      expect(() => {
        sessionManager.addParticipant(session.id, participant11);
      }).toThrow('Conference mode supports maximum 10 participants');
    });
  });

  describe('removeParticipant', () => {
    it('should remove participant from session', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      const participant: Participant = {
        id: 'participant-1',
        name: 'John Doe',
        preferredLanguage: 'en',
        joinedAt: new Date(),
        isMuted: false,
      };

      sessionManager.addParticipant(session.id, participant);
      sessionManager.removeParticipant(session.id, 'participant-1');

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.participants).toHaveLength(0);
    });
  });

  describe('updateParticipant', () => {
    it('should update participant information', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      const participant: Participant = {
        id: 'participant-1',
        name: 'John Doe',
        preferredLanguage: 'en',
        joinedAt: new Date(),
        isMuted: false,
      };

      sessionManager.addParticipant(session.id, participant);
      sessionManager.updateParticipant(session.id, 'participant-1', {
        name: 'Jane Doe',
        preferredLanguage: 'zh',
      });

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.participants[0].name).toBe('Jane Doe');
      expect(updatedSession?.participants[0].preferredLanguage).toBe('zh');
    });
  });

  describe('toggleParticipantMute', () => {
    it('should toggle participant mute status', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      const participant: Participant = {
        id: 'participant-1',
        name: 'John Doe',
        preferredLanguage: 'en',
        joinedAt: new Date(),
        isMuted: false,
      };

      sessionManager.addParticipant(session.id, participant);
      sessionManager.toggleParticipantMute(session.id, 'participant-1');

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.participants[0].isMuted).toBe(true);
    });
  });

  describe('endSession', () => {
    it('should end session and update status', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      await sessionManager.endSession(session.id);

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.state.status).toBe('ended');
    });
  });

  describe('canAddMoreParticipants', () => {
    it('should return true for conference with less than 10 participants', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'conference',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CONFERENCE,
        'user-1'
      );

      expect(sessionManager.canAddMoreParticipants(session.id)).toBe(true);
    });

    it('should return false for chat with 2 participants', async () => {
      const mockDbSession = {
        id: 'session-1',
        mode: 'chat',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        status: 'active',
      };

      vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

      const session = await sessionManager.createSession(
        SessionMode.CHAT,
        'user-1'
      );

      // 添加2个参与者
      for (let i = 1; i <= 2; i++) {
        const participant: Participant = {
          id: `participant-${i}`,
          name: `Participant ${i}`,
          preferredLanguage: 'en',
          joinedAt: new Date(),
          isMuted: false,
        };
        sessionManager.addParticipant(session.id, participant);
      }

      expect(sessionManager.canAddMoreParticipants(session.id)).toBe(false);
    });
  });
});
