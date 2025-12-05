import { useState } from 'react';
import { Session, Message, NetworkQuality } from '@/types';
import { MessageDisplay } from './MessageDisplay';
import { SessionHistory } from './SessionHistory';
import './SessionView.css';

interface SessionViewProps {
  session: Session;
  messages: Message[];
  onEndSession: () => void;
  onSwitchMode: () => void;
}

/**
 * SessionView - 会话主界面
 * 
 * 功能：
 * - 显示参与者列表
 * - 显示实时字幕
 * - 显示网络状态
 * - 显示延迟监控
 * - 控制会话
 */
export function SessionView({
  session,
  messages,
  onEndSession,
  onSwitchMode,
}: SessionViewProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [showBilingual, setShowBilingual] = useState(true);

  const getNetworkStatusColor = (quality: NetworkQuality): string => {
    switch (quality) {
      case NetworkQuality.EXCELLENT:
        return '#4caf50';
      case NetworkQuality.GOOD:
        return '#8bc34a';
      case NetworkQuality.FAIR:
        return '#ff9800';
      case NetworkQuality.POOR:
        return '#f44336';
      case NetworkQuality.OFFLINE:
        return '#9e9e9e';
      default:
        return '#9e9e9e';
    }
  };

  const getNetworkStatusText = (quality: NetworkQuality): string => {
    switch (quality) {
      case NetworkQuality.EXCELLENT:
        return '优秀';
      case NetworkQuality.GOOD:
        return '良好';
      case NetworkQuality.FAIR:
        return '一般';
      case NetworkQuality.POOR:
        return '较差';
      case NetworkQuality.OFFLINE:
        return '离线';
      default:
        return '未知';
    }
  };

  if (showHistory) {
    return (
      <SessionHistory
        sessionId={session.id}
        onClose={() => setShowHistory(false)}
      />
    );
  }

  return (
    <div className="session-view">
      {/* 顶部控制栏 */}
      <div className="session-header">
        <div className="session-info">
          <h2>
            {session.mode === 'conference' ? '会议模式' : '聊天模式'}
          </h2>
          <span className="session-id">会话 ID: {session.id.slice(0, 8)}</span>
        </div>

        <div className="session-controls">
          <button onClick={() => setShowHistory(true)} className="control-button">
            📜 历史记录
          </button>
          <button onClick={onSwitchMode} className="control-button">
            🔄 切换模式
          </button>
          <button onClick={onEndSession} className="control-button danger">
            ⏹️ 结束会话
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="session-content">
        {/* 左侧：参与者列表 */}
        <div className="participants-panel">
          <div className="panel-header">
            <h3>参与者 ({session.participants.length})</h3>
          </div>

          <div className="participants-list">
            {session.participants.length === 0 ? (
              <p className="no-participants">暂无参与者</p>
            ) : (
              session.participants.map((participant) => (
                <div key={participant.id} className="participant-item">
                  <div className="participant-avatar">
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="participant-info">
                    <div className="participant-name">{participant.name}</div>
                    <div className="participant-language">
                      {participant.preferredLanguage}
                    </div>
                  </div>
                  {participant.isMuted && (
                    <div className="participant-status muted">🔇</div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 添加参与者按钮 */}
          <button className="add-participant-button">
            ➕ 添加参与者
          </button>
        </div>

        {/* 中间：实时字幕 */}
        <div className="messages-panel">
          <div className="panel-header">
            <h3>实时字幕</h3>
            <label className="bilingual-toggle">
              <input
                type="checkbox"
                checked={showBilingual}
                onChange={(e) => setShowBilingual(e.target.checked)}
              />
              <span>双语显示</span>
            </label>
          </div>

          <MessageDisplay
            messages={messages}
            showBilingual={showBilingual}
            maxMessages={50}
          />
        </div>

        {/* 右侧：状态监控 */}
        <div className="status-panel">
          <div className="panel-header">
            <h3>状态监控</h3>
          </div>

          <div className="status-items">
            {/* 网络状态 */}
            <div className="status-item">
              <div className="status-label">网络状态</div>
              <div className="status-value">
                <span
                  className="status-indicator"
                  style={{
                    backgroundColor: getNetworkStatusColor(
                      session.state.networkQuality
                    ),
                  }}
                />
                {getNetworkStatusText(session.state.networkQuality)}
              </div>
            </div>

            {/* 延迟 */}
            <div className="status-item">
              <div className="status-label">平均延迟</div>
              <div className="status-value">
                {session.state.averageLatency.toFixed(0)} ms
              </div>
            </div>

            {/* 活跃参与者 */}
            <div className="status-item">
              <div className="status-label">活跃参与者</div>
              <div className="status-value">
                {session.state.activeParticipants} / {session.participants.length}
              </div>
            </div>

            {/* 消息数量 */}
            <div className="status-item">
              <div className="status-label">消息数量</div>
              <div className="status-value">{session.state.totalMessages}</div>
            </div>

            {/* 会话状态 */}
            <div className="status-item">
              <div className="status-label">会话状态</div>
              <div className="status-value status-badge">
                {session.state.status === 'active' ? '进行中' : '已暂停'}
              </div>
            </div>
          </div>

          {/* 性能图表占位 */}
          <div className="performance-chart">
            <div className="chart-placeholder">
              <p>延迟监控图表</p>
              <p className="chart-note">（实时数据可视化）</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
