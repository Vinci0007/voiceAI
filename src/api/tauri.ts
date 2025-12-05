import { invoke } from '@tauri-apps/api/tauri';

// Database API types
export interface DbSession {
  id: string;
  mode: string;
  user_id: string;
  created_at: string;
  status: string;
}

export interface DbMessage {
  id: number;
  session_id: string;
  speaker_id: string;
  timestamp: string;
  original_text: string;
  original_language: string;
  translated_text: string | null;
  target_language: string | null;
}

// Tauri command wrappers
export async function getSessions(): Promise<DbSession[]> {
  return await invoke<DbSession[]>('get_sessions');
}

export async function createSession(
  mode: string,
  userId: string
): Promise<DbSession> {
  return await invoke<DbSession>('create_session', { mode, userId });
}

export async function getSessionMessages(
  sessionId: string,
  limit?: number
): Promise<DbMessage[]> {
  return await invoke<DbMessage[]>('get_session_messages', {
    sessionId,
    limit,
  });
}

export async function saveMessage(
  sessionId: string,
  speakerId: string,
  originalText: string,
  originalLanguage: string,
  translatedText?: string,
  targetLanguage?: string
): Promise<void> {
  return await invoke<void>('save_message', {
    sessionId,
    speakerId,
    originalText,
    originalLanguage,
    translatedText,
    targetLanguage,
  });
}

// Re-export audio processor API
export { AudioProcessorAPI, type AudioQuality, type ProcessedAudio } from './audioProcessor';
