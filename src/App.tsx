import { useState } from 'react';
import { SessionManager } from './services';
import { Session, SessionMode, Message } from './types';
import {
  ModeSelector,
  SessionView,
  SettingsView,
  AppSettings,
} from './components';

type AppView = 'mode-selector' | 'session' | 'settings';

function App() {
  const [sessionManager] = useState(() => new SessionManager());
  const [currentView, setCurrentView] = useState<AppView>('mode-selector');
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    targetLanguage: 'zh',
    enableBilingual: true,
    enableNotifications: true,
    audioQuality: 'medium',
    autoSaveHistory: true,
  });

  const handleSelectMode = async (mode: SessionMode) => {
    try {
      const session = await sessionManager.createSession(mode, 'user-1');
      setCurrentSession(session);
      setMessages([]);
      setCurrentView('session');
      console.log('Session created:', session);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleEndSession = async () => {
    if (currentSession) {
      await sessionManager.endSession(currentSession.id);
      setCurrentSession(null);
      setMessages([]);
      setCurrentView('mode-selector');
    }
  };

  const handleSwitchMode = () => {
    if (currentSession) {
      const newMode =
        currentSession.mode === SessionMode.CONFERENCE
          ? SessionMode.CHAT
          : SessionMode.CONFERENCE;

      try {
        sessionManager.switchMode(currentSession.id, newMode);
        const updatedSession = sessionManager.getSession(currentSession.id);
        if (updatedSession) {
          setCurrentSession(updatedSession);
        }
      } catch (error) {
        console.error('Failed to switch mode:', error);
        alert('无法切换模式：' + (error as Error).message);
      }
    }
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    console.log('Settings saved:', newSettings);
  };

  return (
    <div className="app">
      {currentView === 'mode-selector' && (
        <ModeSelector onSelectMode={handleSelectMode} />
      )}

      {currentView === 'session' && currentSession && (
        <SessionView
          session={currentSession}
          messages={messages}
          onEndSession={handleEndSession}
          onSwitchMode={handleSwitchMode}
        />
      )}

      {currentView === 'settings' && (
        <SettingsView
          currentSettings={settings}
          onSave={handleSaveSettings}
          onClose={() => setCurrentView('mode-selector')}
        />
      )}
    </div>
  );
}

export default App;
