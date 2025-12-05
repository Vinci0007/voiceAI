import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SessionHistory } from './SessionHistory';
import * as TauriAPI from '@/api/tauri';

// Mock Tauri API
vi.mock('@/api/tauri', () => ({
  getSessionMessages: vi.fn(),
}));

describe('SessionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display loading state initially', () => {
    vi.mocked(TauriAPI.getSessionMessages).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<SessionHistory sessionId="session-1" />);

    expect(screen.getByText('加载历史记录中...')).toBeDefined();
  });

  it('should display messages after loading', async () => {
    const mockMessages = [
      {
        id: 1,
        session_id: 'session-1',
        speaker_id: 'speaker-1',
        timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
        original_text: 'Hello world',
        original_language: 'en',
        translated_text: '你好世界',
        target_language: 'zh',
      },
    ];

    vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockMessages);

    render(<SessionHistory sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeDefined();
    });

    expect(screen.getByText('你好世界')).toBeDefined();
    expect(screen.getAllByText('speaker-1').length).toBeGreaterThan(0);
  });

  it('should display "no messages" when history is empty', async () => {
    vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue([]);

    render(<SessionHistory sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByText('没有找到消息')).toBeDefined();
    });
  });

  it('should display session statistics', async () => {
    const mockMessages = [
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
        original_text: '你好',
        original_language: 'zh',
        translated_text: null,
        target_language: null,
      },
    ];

    vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockMessages);

    render(<SessionHistory sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByText(/总消息数/)).toBeDefined();
    });

    // 验证统计信息显示
    const statValues = screen.getAllByText('2');
    expect(statValues.length).toBeGreaterThan(0); // 总消息数和参与者数都是2
  });

  it('should display bilingual text for messages with translations', async () => {
    const mockMessages = [
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

    vi.mocked(TauriAPI.getSessionMessages).mockResolvedValue(mockMessages);

    render(<SessionHistory sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeDefined();
    });

    // 验证双语显示
    expect(screen.getByText(/原文/)).toBeDefined();
    expect(screen.getByText(/翻译/)).toBeDefined();
    expect(screen.getByText('你好')).toBeDefined();
  });
});
