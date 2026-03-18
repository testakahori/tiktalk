import React, { useState, useEffect } from 'react';
import SetupWizard from './SetupWizard';
import SettingsPanel from './components/SettingsPanel';
import CommentLog from './components/CommentLog';
import StatusBar from './components/StatusBar';

const styles = {
  app: {
    fontFamily: '"Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif',
    maxWidth: 460,
    margin: '0 auto',
    padding: '24px 20px',
    background: '#1a1a2e',
    minHeight: '100vh',
    color: '#eee',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  settingsBtn: {
    background: 'none',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#aaa',
    fontSize: 14,
    padding: '6px 12px',
    cursor: 'pointer',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 13,
    color: '#888',
    marginBottom: 24,
  },
  warning: {
    background: '#442200',
    border: '1px solid #885500',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
    color: '#ffaa44',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    color: '#aaa',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #333',
    background: '#16213e',
    color: '#eee',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  },
  buttonRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 16,
  },
  btnStart: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 8,
    border: 'none',
    background: '#e94560',
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  btnStop: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 8,
    border: '1px solid #555',
    background: '#333',
    color: '#ccc',
    fontSize: 15,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  logTitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
};

function App() {
  const [setupCompleted, setSetupCompleted] = useState(null);
  const [username, setUsername] = useState('');
  const [running, setRunning] = useState(false);
  const [connectedUser, setConnectedUser] = useState('');
  const [status, setStatus] = useState('stopped');
  const [errorMsg, setErrorMsg] = useState('');
  const [comments, setComments] = useState([]);
  const [queueSize, setQueueSize] = useState(0);
  const [ttsWarning, setTtsWarning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    speakerId: 0,
    speed: 1.0,
    ngWords: [],
    userDict: {},
  });

  // セットアップ状態の確認
  useEffect(() => {
    if (!window.tiktalk?.onSetupState) {
      setSetupCompleted(true);
      return;
    }
    window.tiktalk.onSetupState((data) => {
      setSetupCompleted(data.setupDone);
    });
    window.tiktalk.onSetupCompleted(() => {
      setSetupCompleted(true);
    });
  }, []);

  // Style-Bert-VITS2の起動確認
  useEffect(() => {
    fetch('http://localhost:5000/voice', { method: 'HEAD' })
      .then(() => setTtsWarning(false))
      .catch(() => setTtsWarning(true));
  }, []);

  // IPC リスナー登録
  useEffect(() => {
    if (!window.tiktalk) return;

    window.tiktalk.onComment((data) => {
      setComments((prev) => {
        const next = [...prev, data];
        return next.slice(-30);
      });
    });

    window.tiktalk.onStatus((data) => {
      if (data.type === 'connected') {
        setStatus('connected');
        setRunning(true);
        setErrorMsg('');
      } else if (data.type === 'disconnected') {
        setStatus('disconnected');
        setRunning(false);
        setConnectedUser('');
      } else if (data.type === 'error') {
        setStatus('error');
        setErrorMsg(data.message || 'エラーが発生しました');
      } else if (data.type === 'speaking') {
        setStatus('speaking');
      } else if (data.type === 'idle') {
        setStatus('connected');
      } else if (data.type === 'started') {
        setStatus('connected');
        setRunning(true);
        setErrorMsg('');
      } else if (data.type === 'stopped') {
        setStatus('stopped');
        setRunning(false);
        setConnectedUser('');
      }
    });

    if (window.tiktalk.onQueueSize) {
      window.tiktalk.onQueueSize((size) => setQueueSize(size));
    }
  }, []);

  const handleStart = () => {
    const name = username.trim().replace(/^@/, '');
    if (!name) return;
    if (window.tiktalk) {
      setComments([]);
      setConnectedUser(name);
      window.tiktalk.startTikTok(name);
    }
  };

  const handleStop = () => {
    if (window.tiktalk) {
      window.tiktalk.stopTikTok();
      setConnectedUser('');
    }
  };

  const handleSettingsChange = (partial) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  // セットアップ状態確認中
  if (setupCompleted === null) {
    return (
      <div style={styles.app}>
        <div style={{ textAlign: 'center', marginTop: 100, color: '#888' }}>読み込み中...</div>
      </div>
    );
  }

  // セットアップ未完了
  if (!setupCompleted) {
    return <SetupWizard onComplete={() => setSetupCompleted(true)} />;
  }

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.title}>TikTalk 🎮</div>
        <button style={styles.settingsBtn} onClick={() => setSettingsOpen(true)}>
          設定 ⚙
        </button>
      </div>
      <div style={styles.subtitle}>TikTokライブ読み上げツール</div>

      {ttsWarning && (
        <div style={styles.warning}>
          ⚠ Style-Bert-VITS2 が起動していません（localhost:5000）。
          読み上げを使うにはTTSサーバーを先に起動してください。
        </div>
      )}

      <StatusBar status={status} connectedUser={connectedUser} queueSize={queueSize} />

      {status === 'error' && errorMsg && (
        <div style={{ ...styles.warning, background: '#330000', borderColor: '#660000', color: '#ff6666' }}>
          {errorMsg}
        </div>
      )}

      <div style={styles.inputGroup}>
        <label style={styles.label}>TikTokユーザー名</label>
        <input
          style={styles.input}
          type="text"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={running}
          onKeyDown={(e) => { if (e.key === 'Enter' && !running) handleStart(); }}
        />
      </div>

      <div style={styles.buttonRow}>
        <button
          style={{ ...styles.btnStart, ...(running ? styles.btnDisabled : {}) }}
          onClick={handleStart}
          disabled={running || !username.trim()}
        >
          配信開始
        </button>
        <button
          style={{ ...styles.btnStop, ...(!running ? styles.btnDisabled : {}) }}
          onClick={handleStop}
          disabled={!running}
        >
          停止
        </button>
      </div>

      <div style={styles.logTitle}>コメントログ</div>
      <CommentLog comments={comments} />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
}

export default App;
