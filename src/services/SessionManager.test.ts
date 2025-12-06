import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { SessionManager } from './SessionManager';
import { SessionMode, SessionStatus, Participant } from '@/types';
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

  describe('Property 3: Mode Switching Availability', () => {
    /**
     * Feature: realtime-voice-translation, Property 3: 模式切换可用性
     * Validates: Requirements 1.4
     * 
     * Property: For any active session, mode switching functionality should always be available.
     * 
     * This property verifies that:
     * 1. Mode switching can be called on any active session
     * 2. The switchMode method does not throw errors for valid mode switches
     * 3. Mode switching is available regardless of the current mode
     * 
     * Note: Mode switching may fail validation (e.g., switching to chat with >2 participants),
     * but the functionality itself should always be available to attempt.
     */
    it('should allow mode switching for any active session', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary user IDs
          fc.string({ minLength: 1, maxLength: 50 }),
          // Generate arbitrary initial mode
          fc.constantFrom(SessionMode.CONFERENCE, SessionMode.CHAT),
          // Generate arbitrary target mode
          fc.constantFrom(SessionMode.CONFERENCE, SessionMode.CHAT),
          // Generate number of participants (0-2 to ensure valid chat mode switch)
          fc.integer({ min: 0, max: 2 }),
          async (userId, initialMode, targetMode, participantCount) => {
            // Create a new session manager for each test
            const manager = new SessionManager();

            // Mock the database session creation
            const mockDbSession = {
              id: `session-${Math.random()}`,
              mode: initialMode,
              user_id: userId,
              created_at: new Date().toISOString(),
              status: 'active',
            };

            vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);

            // Create session with initial mode
            const session = await manager.createSession(initialMode, userId);

            // Add participants (within valid range for chat mode)
            for (let i = 0; i < participantCount; i++) {
              const participant: Participant = {
                id: `participant-${i}`,
                name: `Participant ${i}`,
                preferredLanguage: 'en',
                joinedAt: new Date(),
                isMuted: false,
              };
              manager.addParticipant(session.id, participant);
            }

            // Verify session is active
            const activeSession = manager.getSession(session.id);
            expect(activeSession).not.toBeNull();
            expect(activeSession?.state.status).toBe(SessionStatus.ACTIVE);

            // Property verification: Mode switching should be available (callable)
            // It should not throw an error for valid switches
            let switchSucceeded = false;
            let switchError: Error | null = null;

            try {
              manager.switchMode(session.id, targetMode);
              switchSucceeded = true;
            } catch (error) {
              switchError = error as Error;
            }

            // The switchMode method should be callable (functionality is available)
            // If it fails, it should be due to validation, not unavailability
            if (!switchSucceeded && switchError) {
              // If switching failed, it should be for a valid reason (validation)
              // not because the functionality is unavailable
              expect(switchError.message).toMatch(
                /Cannot switch to chat mode: more than 2 participants in session/
              );
            } else {
              // If switching succeeded, verify the mode was changed
              const updatedSession = manager.getSession(session.id);
              expect(updatedSession?.mode).toBe(targetMode);
            }

            // Property: The session should still be active after attempting mode switch
            const finalSession = manager.getSession(session.id);
            expect(finalSession).not.toBeNull();
            expect(finalSession?.state.status).toBe(SessionStatus.ACTIVE);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design doc
      );
    });

    /**
     * Property 3 (Specific Case): Mode switching preserves session availability
     * 
     * Verifies that after a successful mode switch, the session remains active
     * and mode switching continues to be available.
     */
    it('should allow repeated mode switching on the same session', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.constantFrom(SessionMode.CONFERENCE, SessionMode.CHAT), {
            minLength: 2,
            maxLength: 5,
          }),
          async (userId, modeSequence) => {
            const manager = new SessionManager();

            // Create initial session
            const mockDbSession = {
              id: `session-${Math.random()}`,
              mode: SessionMode.CONFERENCE,
              user_id: userId,
              created_at: new Date().toISOString(),
              status: 'active',
            };

            vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);
            const session = await manager.createSession(SessionMode.CONFERENCE, userId);

            // Property: Mode switching should be available multiple times
            for (const targetMode of modeSequence) {
              const currentSession = manager.getSession(session.id);
              expect(currentSession).not.toBeNull();
              expect(currentSession?.state.status).toBe(SessionStatus.ACTIVE);

              // Attempt mode switch
              try {
                manager.switchMode(session.id, targetMode);
                
                // Verify mode was changed
                const updatedSession = manager.getSession(session.id);
                expect(updatedSession?.mode).toBe(targetMode);
              } catch (error) {
                // If it fails, it should be due to validation, not unavailability
                // For this test, we're not adding participants, so switches should succeed
                throw error;
              }
            }

            // Property: Session should still be active after all switches
            const finalSession = manager.getSession(session.id);
            expect(finalSession).not.toBeNull();
            expect(finalSession?.state.status).toBe(SessionStatus.ACTIVE);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3 (Edge Case): Mode switching availability for sessions with different states
     * 
     * Verifies that mode switching is available for sessions in different states,
     * but may have different outcomes based on session state.
     */
    it('should have mode switching functionality available regardless of session state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom(SessionMode.CONFERENCE, SessionMode.CHAT),
          fc.constantFrom(SessionMode.CONFERENCE, SessionMode.CHAT),
          async (userId, initialMode, targetMode) => {
            const manager = new SessionManager();

            const mockDbSession = {
              id: `session-${Math.random()}`,
              mode: initialMode,
              user_id: userId,
              created_at: new Date().toISOString(),
              status: 'active',
            };

            vi.mocked(TauriAPI.createSession).mockResolvedValue(mockDbSession);
            const session = await manager.createSession(initialMode, userId);

            // Property: switchMode method should be callable (not throw "method not found")
            // The method exists and can be invoked
            expect(typeof manager.switchMode).toBe('function');

            // Verify we can call the method (functionality is available)
            try {
              manager.switchMode(session.id, targetMode);
              
              // If successful, mode should be changed
              const updatedSession = manager.getSession(session.id);
              expect(updatedSession?.mode).toBe(targetMode);
            } catch (error) {
              // If it throws, it should be a validation error, not a "method unavailable" error
              expect(error).toBeInstanceOf(Error);
              const errorMessage = (error as Error).message;
              
              // Should not be errors about method unavailability
              expect(errorMessage).not.toMatch(/undefined|not a function|not available/i);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
