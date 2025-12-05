import { useState } from 'react';
import './SettingsView.css';

interface SettingsViewProps {
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  currentSettings: AppSettings;
}

export interface AppSettings {
  targetLanguage: string;
  enableBilingual: boolean;
  enableNotifications: boolean;
  audioQuality: 'low' | 'medium' | 'high';
  autoSaveHistory: boolean;
}

/**
 * SettingsView - 设置界面
 * 
 * 功能：
 * - 目标语言选择
 * - 音频质量设置
 * - 通知设置
 * - 历史记录设置
 */
export function SettingsView({
  onClose,
  onSave,
  currentSettings,
}: SettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const languages = [
    { code: 'zh', name: '中文' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'ru', name: 'Русский' },
    { code: 'ar', name: 'العربية' },
    { code: 'pt', name: 'Português' },
  ];

  return (
    <div className="settings-view">
      <div className="settings-container">
        <div className="settings-header">
          <h2>设置</h2>
          <button onClick={onClose} className="close-button">
            ✕
          </button>
        </div>

        <div className="settings-content">
          {/* 语言设置 */}
          <div className="settings-section">
            <h3>语言设置</h3>

            <div className="setting-item">
              <label htmlFor="target-language">目标语言</label>
              <select
                id="target-language"
                value={settings.targetLanguage}
                onChange={(e) =>
                  setSettings({ ...settings, targetLanguage: e.target.value })
                }
                className="setting-select"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <p className="setting-description">
                其他语言的语音将被翻译成此语言
              </p>
            </div>

            <div className="setting-item">
              <label className="setting-checkbox">
                <input
                  type="checkbox"
                  checked={settings.enableBilingual}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enableBilingual: e.target.checked,
                    })
                  }
                />
                <span>启用双语显示</span>
              </label>
              <p className="setting-description">
                同时显示原文和翻译文本
              </p>
            </div>
          </div>

          {/* 音频设置 */}
          <div className="settings-section">
            <h3>音频设置</h3>

            <div className="setting-item">
              <label htmlFor="audio-quality">音频质量</label>
              <select
                id="audio-quality"
                value={settings.audioQuality}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    audioQuality: e.target.value as 'low' | 'medium' | 'high',
                  })
                }
                className="setting-select"
              >
                <option value="low">低（节省带宽）</option>
                <option value="medium">中（推荐）</option>
                <option value="high">高（最佳质量）</option>
              </select>
              <p className="setting-description">
                较高的质量会消耗更多带宽
              </p>
            </div>
          </div>

          {/* 通知设置 */}
          <div className="settings-section">
            <h3>通知设置</h3>

            <div className="setting-item">
              <label className="setting-checkbox">
                <input
                  type="checkbox"
                  checked={settings.enableNotifications}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enableNotifications: e.target.checked,
                    })
                  }
                />
                <span>启用通知</span>
              </label>
              <p className="setting-description">
                接收重要事件的通知（如参与者加入、网络问题等）
              </p>
            </div>
          </div>

          {/* 历史记录设置 */}
          <div className="settings-section">
            <h3>历史记录</h3>

            <div className="setting-item">
              <label className="setting-checkbox">
                <input
                  type="checkbox"
                  checked={settings.autoSaveHistory}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      autoSaveHistory: e.target.checked,
                    })
                  }
                />
                <span>自动保存历史记录</span>
              </label>
              <p className="setting-description">
                自动保存所有会话的对话历史
              </p>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button onClick={onClose} className="button-secondary">
            取消
          </button>
          <button onClick={handleSave} className="button-primary">
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
