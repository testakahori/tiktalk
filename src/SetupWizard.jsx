import React, { useState } from 'react';

const styles = {
  container: {
    fontFamily: '"Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif',
    maxWidth: 460,
    margin: '0 auto',
    padding: '32px 24px',
    background: '#1a1a2e',
    minHeight: '100vh',
    color: '#eee',
    boxSizing: 'border-box',
  },
  title: { textAlign: 'center', fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { textAlign: 'center', fontSize: 13, color: '#888', marginBottom: 32 },
  card: {
    background: '#0f0f23',
    border: '1px solid #2a2a4a',
    borderRadius: 10,
    padding: '16px 18px',
    marginBottom: 14,
  },
  cardTitle: { fontWeight: 'bold', fontSize: 15, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 },
  cardBody: { fontSize: 13, color: '#aaa', lineHeight: 1.7 },
  stepRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepIcon: { fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 },
  stepLabel: { fontSize: 14, flex: 1 },
  stepStatus: { fontSize: 12, color: '#888' },
  bigBtn: {
    display: 'block',
    width: '100%',
    padding: '14px 0',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #e94560, #c23152)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: 8,
  },
  smallBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: '1px solid #444',
    background: '#252540',
    color: '#ccc',
    fontSize: 13,
    cursor: 'pointer',
    marginTop: 8,
    marginRight: 8,
  },
  ok: { color: '#4caf50' },
  error: { color: '#e94560' },
  warn: { color: '#ff9800' },
  tag: {
    display: 'inline-block',
    background: '#252540',
    border: '1px solid #3a3a6a',
    borderRadius: 4,
    padding: '1px 8px',
    fontSize: 11,
    color: '#aaa',
    marginRight: 4,
    marginTop: 4,
  },
};

const STEPS = [
  { id: 'tts', label: 'Style-Bert-VITS2 の接続確認' },
  { id: 'done', label: 'セットアップ完了' },
];

export default function SetupWizard({ onComplete }) {
  const [phase, setPhase] = useState('intro'); // intro | checking | ok | error
  const [ttsError, setTtsError] = useState('');

  // TTS疎通確認（Node.js から localhost:5000 に HTTP確認するだけ）
  const handleCheck = async () => {
    setPhase('checking');
    setTtsError('');
    try {
      const ok = await window.tiktalk.checkTTS();
      if (ok) {
        setPhase('ok');
      } else {
        setPhase('error');
        setTtsError('localhost:5000 に接続できませんでした。Style-Bert-VITS2 が起動しているか確認してください。');
      }
    } catch (e) {
      setPhase('error');
      setTtsError('確認中にエラーが発生しました: ' + (e?.message || String(e)));
    }
  };

  const handleComplete = () => {
    if (window.tiktalk?.completeSetup) window.tiktalk.completeSetup();
    onComplete();
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>TikTalk セットアップ 🐻</div>
      <div style={styles.subtitle}>はじめての起動です。準備を確認します ✨</div>

      {/* このアプリが何をするか説明 */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>📋 このアプリについて</div>
        <div style={styles.cardBody}>
          TikTok LIVE のコメントを読み上げるツールです。<br />
          <br />
          <strong style={{ color: '#ccc' }}>このアプリが使うもの：</strong>
          <div style={{ marginTop: 6 }}>
            <span style={styles.tag}>localhost:5000</span> Style-Bert-VITS2（音声合成）<br />
            <span style={styles.tag}>TikTok API</span> ライブコメント取得<br />
            <span style={styles.tag}>AppData</span> 設定ファイル保存先
          </div>
          <br />
          <strong style={{ color: '#ccc' }}>このアプリがしないこと：</strong>
          <div style={{ marginTop: 6 }}>
            ✗ 外部へのファイル送信<br />
            ✗ 自動アップデートのダウンロード<br />
            ✗ Python の自動インストール
          </div>
        </div>
      </div>

      {/* TTS確認ステップ */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>🔊 Step 1 / 1: Style-Bert-VITS2 の確認</div>
        <div style={styles.cardBody}>
          TikTalkは音声合成に <strong style={{ color: '#ccc' }}>Style-Bert-VITS2</strong> を使います。<br />
          先に Style-Bert-VITS2 を起動してから、下のボタンを押してください。<br />
          <br />
          <span style={{ color: '#888', fontSize: 12 }}>
            ポート: <code style={{ background: '#1a1a2e', padding: '1px 6px', borderRadius: 3 }}>localhost:5000</code>
          </span>
        </div>

        {phase === 'intro' && (
          <button style={styles.bigBtn} onClick={handleCheck}>
            確認する
          </button>
        )}

        {phase === 'checking' && (
          <div style={{ marginTop: 12, color: '#888', fontSize: 13 }}>⏳ 確認中...</div>
        )}

        {phase === 'ok' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...styles.ok, fontSize: 14, marginBottom: 8 }}>
              ✅ 接続成功！Style-Bert-VITS2 が応答しています
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...styles.error, fontSize: 13, marginBottom: 8 }}>{ttsError}</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
              Style-Bert-VITS2 が起動していない場合は、先に起動してからもう一度お試しください。<br />
              起動方法がわからない場合は配布者に確認してください。
            </div>
            <button style={styles.smallBtn} onClick={handleCheck}>
              🔄 もう一度確認する
            </button>
            <button
              style={{ ...styles.smallBtn, color: '#ff9800', borderColor: '#ff9800' }}
              onClick={handleComplete}
            >
              ⏭ スキップして起動（TTS無しで使う）
            </button>
          </div>
        )}
      </div>

      {/* 完了 */}
      {phase === 'ok' && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>🎉 準備完了</div>
          <div style={{ ...styles.cardBody, marginBottom: 12 }}>
            すべての確認が完了しました。TikTalk を起動できます。
          </div>
          <button style={styles.bigBtn} onClick={handleComplete}>
            TikTalkを起動する！
          </button>
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 11, color: '#555', textAlign: 'center' }}>
        設定ファイルの保存先: %AppData%\TikTalk\<br />
        ログ: %AppData%\TikTalk\logs\main.log
      </div>
    </div>
  );
}
