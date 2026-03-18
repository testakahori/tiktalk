import React, { useRef, useEffect } from 'react';

const TYPE_ICONS = {
  gift: '🎁',
  member: '👋',
  chat: '💬',
};

const styles = {
  logBox: {
    background: '#0f0f23',
    borderRadius: 8,
    border: '1px solid #222',
    padding: 12,
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

export default function CommentLog({ comments }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [comments]);

  return (
    <div style={styles.logBox} ref={logRef}>
      {comments.length === 0 ? (
        <div style={styles.empty}>コメントを待っています...</div>
      ) : (
        comments.map((c, i) => (
          <div key={i} style={styles.logItem}>
            <span>{TYPE_ICONS[c.type] || TYPE_ICONS.chat} </span>
            <span style={styles.logUser}>{c.username || c.user}</span>
            <span style={styles.logComment}>: {c.text || c.comment}</span>
          </div>
        ))
      )}
    </div>
  );
}
