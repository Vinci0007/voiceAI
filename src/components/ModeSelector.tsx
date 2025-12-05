import { SessionMode } from '@/types';
import './ModeSelector.css';

interface ModeSelectorProps {
  onSelectMode: (mode: SessionMode) => void;
}

/**
 * ModeSelector - 模式选择组件
 * 
 * 功能：
 * - 选择会议模式或聊天模式
 * - 显示模式说明
 */
export function ModeSelector({ onSelectMode }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      <h1>实时语音翻译</h1>
      <p className="subtitle">选择会话模式开始</p>

      <div className="mode-cards">
        <div
          className="mode-card conference"
          onClick={() => onSelectMode(SessionMode.CONFERENCE)}
        >
          <div className="mode-icon">👥</div>
          <h2>会议模式</h2>
          <p className="mode-description">
            支持多人同时参与的语音会话
          </p>
          <ul className="mode-features">
            <li>最多 10 人同时参与</li>
            <li>多说话人识别</li>
            <li>实时翻译</li>
            <li>会话记录</li>
          </ul>
          <button className="mode-button">开始会议</button>
        </div>

        <div
          className="mode-card chat"
          onClick={() => onSelectMode(SessionMode.CHAT)}
        >
          <div className="mode-icon">💬</div>
          <h2>聊天模式</h2>
          <p className="mode-description">
            一对一实时语音对话
          </p>
          <ul className="mode-features">
            <li>2 人实时对话</li>
            <li>低延迟翻译</li>
            <li>双语字幕</li>
            <li>对话历史</li>
          </ul>
          <button className="mode-button">开始聊天</button>
        </div>
      </div>
    </div>
  );
}
