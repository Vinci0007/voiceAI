import { Message } from '@/types';

interface MessageDisplayProps {
  messages: Message[];
  showBilingual?: boolean;
  maxMessages?: number;
}

/**
 * MessageDisplay - 实时消息显示组件
 * 
 * 功能：
 * - 显示实时消息流
 * - 双语文本显示
 * - 自动滚动到最新消息
 */
export function MessageDisplay({
  messages,
  showBilingual = true,
  maxMessages = 50,
}: MessageDisplayProps) {
  // 只显示最近的消息
  const displayMessages = messages.slice(-maxMessages);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="message-display">
      {displayMessages.length === 0 ? (
        <div className="no-messages">
          <p>暂无消息</p>
        </div>
      ) : (
        <div className="messages-container">
          {displayMessages.map((message) => (
            <div key={message.id} className="message-bubble">
              <div className="message-meta">
                <span className="speaker-name">{message.speakerId}</span>
                <span className="message-time">{formatTime(message.timestamp)}</span>
              </div>

              <div className="message-body">
                {/* 原文 */}
                <div className="original-text">
                  <span className="language-tag">{message.originalLanguage}</span>
                  <p>{message.originalText}</p>
                </div>

                {/* 翻译（如果启用双语显示） */}
                {showBilingual && message.translations.size > 0 && (
                  <div className="translated-text">
                    {Array.from(message.translations.entries()).map(
                      ([lang, text]) => (
                        <div key={lang} className="translation-item">
                          <span className="language-tag translation">{lang}</span>
                          <p>{text}</p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
