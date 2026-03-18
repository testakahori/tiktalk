import React from 'react';

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: 8,
    background: '#0f0f23',
    border: '1px solid #222',
    marginBottom: 16,
    fontSize: 13,
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  connected: { color: '#44ee88' },
  stopped: { color: '#888' },
  speaking: { color: '#ffcc00' },
  error: { color: '#ee4444' },
  queue: {
    color: '#aaa',
    fontSize: 12,
  },
  user: {
    color: '#ccc',
    fontSize: 12,
  },
};

export default function StatusBar({ status, connectedUser, queueSize }) {
  let icon, label, colorStyle;

  if (status === 'connected') {
    icon = '🟢';
    label = '接続中';
    colorStyle = styles.connected;
  } else if (status === 'speaking') {
    icon = '🟡';
    label = '読み上げ中';
    colorStyle = styles.speaking;
  } else if (status === 'error') {
    icon = '🔴';
    label = 'エラー';
    colorStyle = styles.error;
  } else {
    icon = '🔴';
    label = '停止';
    colorStyle = styles.stopped;
  }

  return (
    <div style={styles.bar}>
      <div style={styles.badge}>
        <span>{icon}</span>
        <span style={colorStyle}>{label}</span>
        {connectedUser && <span style={styles.user}>({connectedUser})</span>}
      </div>
      {queueSize > 0 && (
        <span style={styles.queue}>キューに{queueSize}件</span>
      )}
    </div>
  );
}
