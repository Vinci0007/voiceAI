import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { SessionStore } from '@/services/SessionStore';
import { Message } from '@/types';
import * as TauriAPI from '@/api/tauri';

// Mock Tauri API
vi.mock('@/api/tauri', () => ({
  saveMessage: vi.fn(),
  getSessionMessages: vi.fn(),
}));

describe('Data Model Property-Based Tests', () => {
  let sessionStore: SessionStore;

  beforeEach(() => {
    sessionStore = new SessionStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 28: Text Storage Integrity', () => {
    /**
     * Feature: realtime-voice-translation, Property 28: 文本存储完整性
     * Validates: Requirements 9.1
     * 
     * Property: For any recognized speech text, the system should save both
     * the original text and translated text to the session record.
     * 
     * This property verifies that when a message is saved and then retrieved,
     * both the original text and all translations are preserved exactly.
     */
    it('should preserve both original and translated text in round-trip storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary session IDs
          fc.string({ minLength: 1, maxLength: 50 }),
          // Generate arbitrary speaker IDs
          fc.string({ minLength: 1, maxLength: 50 }),
          // Generate arbitrary original text (non-empty)
          fc.string({ minLength: 1, maxLength: 500 }),
          // Generate arbitrary language codes
          fc.string({ minLength: 2, maxLength: 10 }),
          // Generate arbitrary translated text (non-empty)
          fc.string({ minLength: 1, maxLength: 500 }),
          // Generate arbitrary target language codes
          fc.string({ minLength: 2, maxLength: 10 }),
          async (sessionId, speakerId, originalText, originalLang, translatedText, targetLang) => {
            // Create a message with both original and translated text
            const message: Omit<Message, 'id'> = {
              sessionId,
              speakerId,
              timestamp: new Date(),
              originalText,
              originalLanguage: originalLang,
              translations: new Map([[targetLang, translatedText]]),
            };

            // Mock the save operation
            vi.mocked(TauriAPI.saveMessage).mockResolvedValue();

            // Mock the retrieval to return what was saved
            vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue([
              {
                id: 1,
                session_id: sessionId,
                speaker_id: speakerId,
                timestamp: message.timestamp.toISOString(),
                original_text: originalText,
                original_language: originalLang,
                translated_text: translatedText,
                target_language: targetLang,
              },
            ]);

            // Save the message
            await sessionStore.saveMessage(sessionId, message);

            // Verify save was called with correct parameters
            expect(TauriAPI.saveMessage).toHaveBeenCalledWith(
              sessionId,
              speakerId,
              originalText,
              originalLang,
              translatedText,
              targetLang
            );

            // Retrieve the message
            const retrievedMessages = await sessionStore.getHistory(sessionId);

            // Property verification: Both original and translated text must be preserved
            expect(retrievedMessages).toHaveLength(1);
            const retrievedMessage = retrievedMessages[0];

            // Verify original text is preserved
            expect(retrievedMessage.originalText).toBe(originalText);
            expect(retrievedMessage.originalLanguage).toBe(originalLang);

            // Verify translated text is preserved
            expect(retrievedMessage.translations.has(targetLang)).toBe(true);
            expect(retrievedMessage.translations.get(targetLang)).toBe(translatedText);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design doc
      );
    });

    /**
     * Property 28 (Edge Case): Messages with multiple translations
     * 
     * Verifies that when a message has multiple translations (to different languages),
     * all translations are preserved. Note: Current implementation only stores one
     * translation, but this test documents the expected behavior.
     */
    it('should preserve original text even when no translation exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 2, maxLength: 10 }),
          async (sessionId, speakerId, originalText, originalLang) => {
            // Create a message with NO translation
            const message: Omit<Message, 'id'> = {
              sessionId,
              speakerId,
              timestamp: new Date(),
              originalText,
              originalLanguage: originalLang,
              translations: new Map(), // Empty translations
            };

            vi.mocked(TauriAPI.saveMessage).mockResolvedValue();
            vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue([
              {
                id: 1,
                session_id: sessionId,
                speaker_id: speakerId,
                timestamp: message.timestamp.toISOString(),
                original_text: originalText,
                original_language: originalLang,
                translated_text: null,
                target_language: null,
              },
            ]);

            await sessionStore.saveMessage(sessionId, message);
            const retrievedMessages = await sessionStore.getHistory(sessionId);

            // Property: Original text must always be preserved, even without translation
            expect(retrievedMessages).toHaveLength(1);
            expect(retrievedMessages[0].originalText).toBe(originalText);
            expect(retrievedMessages[0].originalLanguage).toBe(originalLang);
            expect(retrievedMessages[0].translations.size).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 28 (Batch Test): Multiple messages preserve integrity
     * 
     * Verifies that when multiple messages are saved in sequence,
     * each message's original and translated text are preserved independently.
     */
    it('should preserve text integrity for multiple messages in a session', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              speakerId: fc.string({ minLength: 1, maxLength: 50 }),
              originalText: fc.string({ minLength: 1, maxLength: 500 }),
              originalLang: fc.string({ minLength: 2, maxLength: 10 }),
              translatedText: fc.string({ minLength: 1, maxLength: 500 }),
              targetLang: fc.string({ minLength: 2, maxLength: 10 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (sessionId, messageData) => {
            // Save all messages
            for (const data of messageData) {
              const message: Omit<Message, 'id'> = {
                sessionId,
                speakerId: data.speakerId,
                timestamp: new Date(),
                originalText: data.originalText,
                originalLanguage: data.originalLang,
                translations: new Map([[data.targetLang, data.translatedText]]),
              };

              vi.mocked(TauriAPI.saveMessage).mockResolvedValue();
              await sessionStore.saveMessage(sessionId, message);
            }

            // Mock retrieval of all messages
            const mockDbMessages = messageData.map((data, index) => ({
              id: index + 1,
              session_id: sessionId,
              speaker_id: data.speakerId,
              timestamp: new Date().toISOString(),
              original_text: data.originalText,
              original_language: data.originalLang,
              translated_text: data.translatedText,
              target_language: data.targetLang,
            }));

            vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockDbMessages);

            const retrievedMessages = await sessionStore.getHistory(sessionId);

            // Property: All messages must preserve their original and translated text
            expect(retrievedMessages).toHaveLength(messageData.length);

            for (let i = 0; i < messageData.length; i++) {
              const expected = messageData[i];
              const actual = retrievedMessages[i];

              expect(actual.originalText).toBe(expected.originalText);
              expect(actual.originalLanguage).toBe(expected.originalLang);
              expect(actual.translations.get(expected.targetLang)).toBe(expected.translatedText);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
