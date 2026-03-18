import React, { useState, useEffect, useRef } from 'react';

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
  title: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
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
  status: {
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 16,
    padding: '6px 0',
  },
  statusConnected: {
    color: '#44ee88',
  },
  statusDisconnected: {
    color: '#888',
  },
  statusError: {
    color: '#ee4444',
  },
  logTitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  logBox: {
    background: '#0f0f23',
    borderRadius: 8,
    border: '1px solid #222',
    padding: '12px',
    height: 300,
    overflowY: 'auto',
  },
  logItem: {
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 1.5,
  },
  logUser: {
    color: '#e94560',
    fontWeight: 'bold',
  },
  logComment: {
    color: '#ddd',
  },
  empty: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 40,
  },
};

function App() {
  const [username, setUsername] = useState('');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('stopped'); // stopped | started | error
  const [errorMsg, setErrorMsg] = useState('');
  const [comments, setComments] = useState([]);
  const [ttsWarning, setTtsWarning] = useState(false);
  const logRef = useRef(null);

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
      if (data.type === 'comment') {
        setComments((prev) => {
          const next = [...prev, data];
          // 最新10件のみ保持
          return next.slice(-10);
        });
      }
    });

    window.tiktalk.onStatus((data) => {
      if (data.type === 'started') {
        setStatus('started');
        setRunning(true);
        setErrorMsg('');
      } else if (data.type === 'stopped') {
        setStatus('stopped');
        setRunning(false);
      } else if (data.type === 'error') {
        setStatus('error');
        setErrorMsg(data.message || 'エラーが発生しました');
      }
    });
  }, []);

  // ログ自動スクロール
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [comments]);

  const handleStart = () => {
    const name = username.trim().replace(/^@/, '');
    if (!name) return;
    if (window.tiktalk) {
      setComments([]);
      window.tiktalk.startReader(name);
    }
  };

  const handleStop = () => {
    if (window.tiktalk) {
      window.tiktalk.stopReader();
    }
  };

  const statusLabel = () => {
    if (status === 'started') return { text: '● 接続中', style: styles.statusConnected };
    if (status === 'error') return { text: '● エラー', style: styles.statusError };
    return { text: '○ 停止中', style: styles.statusDisconnected };
  };

  const s = statusLabel();

  return (
    <div style={styles.app}>
      <div style={styles.title}>TikTalk 🎮</div>
      <div style={styles.subtitle}>TikTokライブ読み上げツール</div>

      {ttsWarning && (
        <div style={styles.warning}>
          ⚠ Style-Bert-VITS2 が起動していません（localhost:5000）。
          読み上げを使うにはTTSサーバーを先に起動してください。
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

      <div style={{ ...styles.status, ...s.style }}>{s.text}</div>

      {status === 'error' && errorMsg && (
        <div style={{ ...styles.warning, background: '#330000', borderColor: '#660000', color: '#ff6666' }}>
          {errorMsg}
        </div>
      )}

      <div style={styles.logTitle}>コメントログ</div>
      <div style={styles.logBox} ref={logRef}>
        {comments.length === 0 ? (
          <div style={styles.empty}>コメントを待っています...</div>
        ) : (
          comments.map((c, i) => (
            <div key={i} style={styles.logItem}>
              <span style={styles.logUser}>{c.user}</span>
              <span style={styles.logComment}>: {c.comment}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
