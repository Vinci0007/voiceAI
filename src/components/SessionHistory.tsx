import { useState, useEffect } from 'react';
import { Message } from '@/types';
import { SessionStore } from '@/services';

interface SessionHistoryProps {
  sessionId: string;
  onClose?: () => void;
}

/**
 * SessionHistory - 会话历史记录组件
 * 
 * 功能：
 * - 显示对话历史（双语文本）
 * - 搜索和过滤消息
 * - 导出会话记录
 */
export function SessionHistory({ sessionId, onClose }: SessionHistoryProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [sessionStore] = useState(() => new SessionStore());
  const [stats, setStats] = useState<{
    totalMessages: number;
    uniqueSpeakers: number;
    languages: string[];
  } | null>(null);

  // 加载历史消息
  useEffect(() => {
    loadHistory();
  }, [sessionId]);

  // 应用过滤
  useEffect(() => {
    applyFilters();
  }, [messages, searchQuery, selectedSpeaker]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const history = await sessionStore.getHistory(sessionId);
      setMessages(history);

      // 加载统计信息
      const sessionStats = await sessionStore.getSessionStats(sessionId);
      setStats(sessionStats);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...messages];

    // 按说话人过滤
    if (selectedSpeaker !== 'all') {
      filtered = filtered.filter((msg) => msg.speakerId === selectedSpeaker);
    }

    // 按搜索查询过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((msg) => {
        // 搜索原文
        if (msg.originalText.toLowerCase().includes(query)) {
          return true;
        }
        // 搜索翻译
        for (const translation of msg.translations.values()) {
          if (translation.toLowerCase().includes(query)) {
            return true;
          }
        }
        return false;
      });
    }

    setFilteredMessages(filtered);
  };

  const handleExportJSON = async () => {
    try {
      const json = await sessionStore.exportSession(sessionId);
      downloadFile(json, `session-${sessionId}.json`, 'application/json');
    } catch (error) {
      console.error('Failed to export JSON:', error);
    }
  };

  const handleExportText = async () => {
    try {
      const text = await sessionStore.exportSessionAsText(sessionId);
      downloadFile(text, `session-${sessionId}.txt`, 'text/plain');
    } catch (error) {
      console.error('Failed to export text:', error);
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getUniqueSpeakers = (): string[] => {
    const speakers = new Set(messages.map((msg) => msg.speakerId));
    return Array.from(speakers);
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="session-history loading">
        <p>加载历史记录中...</p>
      </div>
    );
  }

  return (
    <div className="session-history">
      <div className="history-header">
        <h2>会话历史记录</h2>
        {onClose && (
          <button onClick={onClose} className="close-button">
            关闭
          </button>
        )}
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="history-stats">
          <div className="stat-item">
            <span className="stat-label">总消息数：</span>
            <span className="stat-value">{stats.totalMessages}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">参与者数：</span>
            <span className="stat-value">{stats.uniqueSpeakers}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">语言：</span>
            <span className="stat-value">{stats.languages.join(', ')}</span>
          </div>
        </div>
      )}

      {/* 搜索和过滤 */}
      <div className="history-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索消息..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-box">
          <label htmlFor="speaker-filter">说话人：</label>
          <select
            id="speaker-filter"
            value={selectedSpeaker}
            onChange={(e) => setSelectedSpeaker(e.target.value)}
            className="speaker-select"
          >
            <option value="all">全部</option>
            {getUniqueSpeakers().map((speaker) => (
              <option key={speaker} value={speaker}>
                {speaker}
              </option>
            ))}
          </select>
        </div>

        <div className="export-buttons">
          <button onClick={handleExportJSON} className="export-button">
            导出 JSON
          </button>
          <button onClick={handleExportText} className="export-button">
            导出文本
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="history-messages">
        {filteredMessages.length === 0 ? (
          <p className="no-messages">没有找到消息</p>
        ) : (
          filteredMessages.map((message) => (
            <div key={message.id} className="message-item">
              <div className="message-header">
                <span className="message-speaker">{message.speakerId}</span>
                <span className="message-timestamp">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>

              <div className="message-content">
                <div className="message-original">
                  <span className="message-label">
                    原文 ({message.originalLanguage}):
                  </span>
                  <p className="message-text">{message.originalText}</p>
                </div>

                {message.translations.size > 0 && (
                  <div className="message-translations">
                    {Array.from(message.translations.entries()).map(
                      ([lang, text]) => (
                        <div key={lang} className="message-translation">
                          <span className="message-label">翻译 ({lang}):</span>
                          <p className="message-text">{text}</p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 显示过滤结果数量 */}
      {filteredMessages.length !== messages.length && (
        <div className="filter-info">
          显示 {filteredMessages.length} / {messages.length} 条消息
        </div>
      )}
    </div>
  );
}
