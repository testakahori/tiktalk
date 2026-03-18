import React, { useState, useEffect } from 'react';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 320,
    background: '#0f0f23',
    color: '#eee',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #222',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: 22,
    cursor: 'pointer',
    padding: '0 4px',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e94560',
    marginBottom: 12,
    borderBottom: '1px solid #1a1a2e',
    paddingBottom: 6,
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #333',
    background: '#16213e',
    color: '#eee',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 12,
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  slider: {
    flex: 1,
    accentColor: '#e94560',
  },
  sliderValue: {
    fontSize: 13,
    color: '#ccc',
    minWidth: 32,
    textAlign: 'right',
  },
  inputRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #333',
    background: '#16213e',
    color: '#eee',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  },
  inputSmall: {
    width: '45%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #333',
    background: '#16213e',
    color: '#eee',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  },
  addBtn: {
    padding: '8px 14px',
    borderRadius: 6,
    border: 'none',
    background: '#e94560',
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 12,
    background: '#1a1a2e',
    border: '1px solid #333',
    fontSize: 12,
    color: '#ccc',
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    color: '#e94560',
    fontSize: 14,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  dictItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #1a1a2e',
    fontSize: 13,
  },
  dictText: {
    color: '#ccc',
  },
  dictReading: {
    color: '#e94560',
  },
};

export default function SettingsPanel({ open, onClose, settings, onSettingsChange }) {
  const [speakers, setSpeakers] = useState(null);
  const [ngInput, setNgInput] = useState('');
  const [dictUser, setDictUser] = useState('');
  const [dictReading, setDictReading] = useState('');

  // 話者リスト取得
  useEffect(() => {
    if (!open) return;
    if (speakers) return;
    if (window.tiktalk?.getSpeakers) {
      window.tiktalk.getSpeakers()
        .then((list) => setSpeakers(Array.isArray(list) ? list : []))
        .catch(() => setSpeakers([]));
    }
  }, [open]);

  if (!open) return null;

  const { speakerId, speed, ngWords, userDict } = settings;

  const handleSpeakerChange = (e) => {
    const id = Number(e.target.value);
    onSettingsChange({ speakerId: id });
    window.tiktalk?.updateSettings({ speakerId: id });
  };

  const handleSpeedChange = (e) => {
    const val = Number(e.target.value);
    onSettingsChange({ speed: val });
    window.tiktalk?.updateSettings({ speed: val });
  };

  const handleAddNgWord = () => {
    const word = ngInput.trim();
    if (!word || ngWords.includes(word)) return;
    const updated = [...ngWords, word];
    setNgInput('');
    onSettingsChange({ ngWords: updated });
    window.tiktalk?.updateSettings({ ngWords: updated });
  };

  const handleRemoveNgWord = (word) => {
    const updated = ngWords.filter((w) => w !== word);
    onSettingsChange({ ngWords: updated });
    window.tiktalk?.updateSettings({ ngWords: updated });
  };

  const handleAddDict = () => {
    const user = dictUser.trim();
    const reading = dictReading.trim();
    if (!user || !reading) return;
    const updated = { ...userDict, [user]: reading };
    setDictUser('');
    setDictReading('');
    onSettingsChange({ userDict: updated });
    window.tiktalk?.addUserDict({ userId: user, reading });
  };

  const handleRemoveDict = (user) => {
    const updated = { ...userDict };
    delete updated[user];
    onSettingsChange({ userDict: updated });
    window.tiktalk?.addUserDict({ userId: user, reading: '' });
  };

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>設定 ⚙</span>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          {/* 音声設定 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>音声設定</div>

            <label style={styles.label}>話者</label>
            <select style={styles.select} value={speakerId} onChange={handleSpeakerChange}>
              {speakers === null ? (
                <option>取得中...</option>
              ) : speakers.length === 0 ? (
                <option>話者なし</option>
              ) : (
                speakers.map((s, i) => (
                  <option key={s.id ?? i} value={s.id ?? i}>
                    {s.name || `話者 ${s.id ?? i}`}
                  </option>
                ))
              )}
            </select>

            <label style={styles.label}>読み上げ速度: {speed.toFixed(1)}</label>
            <div style={styles.sliderRow}>
              <span style={{ fontSize: 11, color: '#888' }}>0.8</span>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.1"
                value={speed}
                onChange={handleSpeedChange}
                style={styles.slider}
              />
              <span style={{ fontSize: 11, color: '#888' }}>1.5</span>
            </div>
          </div>

          {/* NGワード */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>NGワード</div>
            <div style={styles.inputRow}>
              <input
                style={styles.input}
                placeholder="NGワードを入力"
                value={ngInput}
                onChange={(e) => setNgInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddNgWord(); }}
              />
              <button style={styles.addBtn} onClick={handleAddNgWord}>追加</button>
            </div>
            <div style={styles.tagList}>
              {ngWords.map((word) => (
                <span key={word} style={styles.tag}>
                  {word}
                  <button style={styles.tagRemove} onClick={() => handleRemoveNgWord(word)}>×</button>
                </span>
              ))}
            </div>
          </div>

          {/* ユーザー名読み辞書 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>ユーザー名読み辞書</div>
            <div style={styles.inputRow}>
              <input
                style={styles.inputSmall}
                placeholder="ユーザー名"
                value={dictUser}
                onChange={(e) => setDictUser(e.target.value)}
              />
              <input
                style={styles.inputSmall}
                placeholder="読み方"
                value={dictReading}
                onChange={(e) => setDictReading(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddDict(); }}
              />
              <button style={styles.addBtn} onClick={handleAddDict}>追加</button>
            </div>
            {Object.entries(userDict).map(([user, reading]) => (
              <div key={user} style={styles.dictItem}>
                <span>
                  <span style={styles.dictText}>{user}</span>
                  <span style={{ color: '#666' }}> → </span>
                  <span style={styles.dictReading}>{reading}</span>
                </span>
                <button style={styles.tagRemove} onClick={() => handleRemoveDict(user)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
