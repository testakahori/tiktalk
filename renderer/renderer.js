// ────────────────────────────────────────────────────────────
// 状態
// ────────────────────────────────────────────────────────────
let settings = {};
let isConnected = false;
let currentAudio = null;
const MAX_FEED_ITEMS = 30;

// ────────────────────────────────────────────────────────────
// 要素取得
// ────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const statusPill    = $('status-pill');
const statusText    = $('status-text');
const usernameInput = $('username-input');
const connectBtn    = $('connect-btn');
const disconnectBtn = $('disconnect-btn');
const connectError  = $('connect-error');
const engineStatus  = $('engine-status');
const launchBtn     = $('launch-btn');
const speakerSelect = $('speaker-select');
const speedSlider   = $('speed-slider');
const speedLabel    = $('speed-label');
const pitchSlider   = $('pitch-slider');
const pitchLabel    = $('pitch-label');
const intonationSlider = $('intonation-slider');
const intonationLabel  = $('intonation-label');
const volumeSlider  = $('volume-slider');
const volumeLabel   = $('volume-label');
const readJoinToggle = $('read-join-toggle');
const readNameToggle = $('read-name-toggle');
const commentFeed   = $('comment-feed');
const nowReading    = $('now-reading');
const nowReadingText = $('now-reading-text');
const queueBadge    = $('queue-badge');
const skipBtn       = $('skip-btn');
const ngInput       = $('ng-input');
const ngAddBtn      = $('ng-add-btn');
const ngList        = $('ng-list');

// ────────────────────────────────────────────────────────────
// 初期化
// ────────────────────────────────────────────────────────────
async function init() {
  settings = await window.api.loadSettings();
  applySettings();
  renderNgList();
  await refreshEngine(settings.engine);
}

function applySettings() {
  // エンジンタブ
  document.querySelectorAll('.engine-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.engine === settings.engine);
  });

  // スライダー
  speedSlider.value = settings.speedScale ?? 1.2;
  speedLabel.textContent = Number(speedSlider.value).toFixed(1);

  pitchSlider.value = settings.pitchScale ?? 0.0;
  pitchLabel.textContent = Number(pitchSlider.value).toFixed(2);

  intonationSlider.value = settings.intonationScale ?? 1.0;
  intonationLabel.textContent = Number(intonationSlider.value).toFixed(1);

  volumeSlider.value = settings.volume ?? 1.0;
  volumeLabel.textContent = Math.round(volumeSlider.value * 100) + '%';

  // トグル
  readJoinToggle.checked = settings.readJoin !== false;
  readNameToggle.checked = settings.readName !== false;
}

// ────────────────────────────────────────────────────────────
// エンジン切り替え
// ────────────────────────────────────────────────────────────
async function refreshEngine(engine) {
  engineStatus.textContent = '確認中...';
  engineStatus.className = 'engine-status checking';
  speakerSelect.innerHTML = '<option value="">読み込み中...</option>';

  const ok = await window.api.checkEngine(engine);

  if (!ok) {
    const name = engine === 'voicevox' ? 'VOICEVOX' : 'AivisSpeech';
    engineStatus.textContent = `${name} が起動していません。先にアプリを起動してください。`;
    engineStatus.className = 'engine-status ng';
    speakerSelect.innerHTML = '<option value="">エンジンを起動してください</option>';
    return;
  }

  engineStatus.textContent = '✓ エンジン接続OK';
  engineStatus.className = 'engine-status ok';

  // スピーカー一覧取得
  const speakers = await window.api.getSpeakers(engine);
  speakerSelect.innerHTML = '';
  let matched = false;
  for (const s of speakers) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    if (s.id === settings.speakerId) { opt.selected = true; matched = true; }
    speakerSelect.appendChild(opt);
  }

  // エンジン切り替え時に保存済みIDが存在しない場合は先頭に更新
  if (!matched && speakers.length > 0) {
    speakerSelect.value = speakers[0].id;
    saveSetting('speakerId', Number(speakers[0].id));
  }
}

document.querySelectorAll('.engine-tab').forEach(tab => {
  tab.addEventListener('click', async () => {
    const engine = tab.dataset.engine;
    document.querySelectorAll('.engine-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    settings.engine = engine;
    await saveSetting('engine', engine);
    await refreshEngine(engine);
  });
});

launchBtn.addEventListener('click', async () => {
  launchBtn.disabled = true;
  launchBtn.textContent = '起動中...';
  const result = await window.api.launchEngine(settings.engine);
  if (!result.ok) {
    engineStatus.textContent = result.message;
    engineStatus.className = 'engine-status ng';
    launchBtn.disabled = false;
    launchBtn.textContent = '▶ 起動する';
    return;
  }
  // 起動後に少し待ってから接続確認
  engineStatus.textContent = '起動待ち...';
  engineStatus.className = 'engine-status checking';
  let tries = 0;
  const poll = setInterval(async () => {
    tries++;
    const ok = await window.api.checkEngine(settings.engine);
    if (ok) {
      clearInterval(poll);
      launchBtn.disabled = false;
      launchBtn.textContent = '▶ 起動する';
      await refreshEngine(settings.engine);
    } else if (tries >= 20) {
      clearInterval(poll);
      engineStatus.textContent = '起動タイムアウト。手動で起動してみて。';
      engineStatus.className = 'engine-status ng';
      launchBtn.disabled = false;
      launchBtn.textContent = '▶ 起動する';
    }
  }, 1500);
});

// ────────────────────────────────────────────────────────────
// 設定変更
// ────────────────────────────────────────────────────────────
async function saveSetting(key, value) {
  settings[key] = value;
  await window.api.saveSettings({ [key]: value });
}

speedSlider.addEventListener('input', () => {
  const v = Number(speedSlider.value);
  speedLabel.textContent = v.toFixed(1);
  saveSetting('speedScale', v);
});

pitchSlider.addEventListener('input', () => {
  const v = Number(pitchSlider.value);
  pitchLabel.textContent = v.toFixed(2);
  saveSetting('pitchScale', v);
});

intonationSlider.addEventListener('input', () => {
  const v = Number(intonationSlider.value);
  intonationLabel.textContent = v.toFixed(1);
  saveSetting('intonationScale', v);
});

volumeSlider.addEventListener('input', () => {
  const v = Number(volumeSlider.value);
  volumeLabel.textContent = Math.round(v * 100) + '%';
  saveSetting('volume', v);
});

speakerSelect.addEventListener('change', () => {
  saveSetting('speakerId', Number(speakerSelect.value));
});

readJoinToggle.addEventListener('change', () => {
  saveSetting('readJoin', readJoinToggle.checked);
});

readNameToggle.addEventListener('change', () => {
  saveSetting('readName', readNameToggle.checked);
});

// ────────────────────────────────────────────────────────────
// NGワード管理
// ────────────────────────────────────────────────────────────
function renderNgList() {
  ngList.innerHTML = '';
  const words = settings.ngWords || [];
  if (words.length === 0) {
    ngList.innerHTML = '<span style="font-size:12px;color:var(--text2)">まだ登録されていないわ</span>';
    return;
  }
  for (const word of words) {
    const tag = document.createElement('div');
    tag.className = 'ng-tag';
    tag.innerHTML = `<span>${escapeHtml(word)}</span><button title="削除">×</button>`;
    tag.querySelector('button').addEventListener('click', () => removeNgWord(word));
    ngList.appendChild(tag);
  }
}

function addNgWord() {
  const word = ngInput.value.trim();
  if (!word) return;
  const words = settings.ngWords || [];
  if (words.includes(word)) { ngInput.value = ''; return; }
  words.push(word);
  saveSetting('ngWords', words);
  ngInput.value = '';
  renderNgList();
}

function removeNgWord(word) {
  const words = (settings.ngWords || []).filter(w => w !== word);
  saveSetting('ngWords', words);
  renderNgList();
}

ngAddBtn.addEventListener('click', addNgWord);
ngInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addNgWord(); });

// ────────────────────────────────────────────────────────────
// TikTok 接続
// ────────────────────────────────────────────────────────────
connectBtn.addEventListener('click', async () => {
  const username = usernameInput.value.trim();
  if (!username) {
    showConnectError('ユーザー名を入力してください');
    return;
  }

  connectBtn.disabled = true;
  connectBtn.textContent = '接続中...';
  hideConnectError();

  const result = await window.api.connect(username);

  if (result.ok) {
    setConnectedState(true);
  } else {
    connectBtn.disabled = false;
    connectBtn.textContent = '接続';
    showConnectError(result.message || '接続に失敗しました');
  }
});

disconnectBtn.addEventListener('click', async () => {
  await window.api.disconnect();
  setConnectedState(false);
});

usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') connectBtn.click();
});

function setConnectedState(connected) {
  isConnected = connected;

  if (connected) {
    statusPill.className = 'status-pill connected';
    statusText.textContent = '配信中';
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = '';
    usernameInput.disabled = true;
  } else {
    statusPill.className = 'status-pill';
    statusText.textContent = '未接続';
    connectBtn.style.display = '';
    connectBtn.disabled = false;
    connectBtn.textContent = '接続';
    disconnectBtn.style.display = 'none';
    usernameInput.disabled = false;
    setNowReading(null);
  }
}

function showConnectError(msg) {
  connectError.textContent = '⚠ ' + msg;
  connectError.style.display = '';
}

function hideConnectError() {
  connectError.style.display = 'none';
}

// ────────────────────────────────────────────────────────────
// コメントフィード
// ────────────────────────────────────────────────────────────
let latestCommentEl = null;

function addComment(comment, reading = false) {
  // 空ヒントを消す
  const hint = commentFeed.querySelector('.empty-hint');
  if (hint) hint.remove();

  const item = document.createElement('div');
  item.className = 'comment-item' + (reading ? ' reading' : '');

  const initial = (comment.nickname || '?')[0].toUpperCase();
  item.innerHTML = `
    <div class="comment-avatar">${initial}</div>
    <div class="comment-body">
      <div class="comment-name">${escapeHtml(comment.nickname)}</div>
      <div class="comment-text">${escapeHtml(comment.text)}</div>
    </div>
  `;

  commentFeed.prepend(item);

  // 最大件数制限
  const items = commentFeed.querySelectorAll('.comment-item');
  if (items.length > MAX_FEED_ITEMS) {
    items[items.length - 1].remove();
  }

  return item;
}

function addJoin(nickname) {
  const hint = commentFeed.querySelector('.empty-hint');
  if (hint) hint.remove();

  const item = document.createElement('div');
  item.className = 'comment-item join-item';
  item.innerHTML = `
    <div class="comment-avatar" style="background:linear-gradient(135deg,#2dff88,#00f2ea)">👋</div>
    <div class="comment-body">
      <div class="comment-text" style="color:#2dff88">${escapeHtml(nickname)}さん、いらっしゃい</div>
    </div>
  `;
  commentFeed.prepend(item);

  const items = commentFeed.querySelectorAll('.comment-item');
  if (items.length > MAX_FEED_ITEMS) items[items.length - 1].remove();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ────────────────────────────────────────────────────────────
// 読み上げ中インジケーター
// ────────────────────────────────────────────────────────────
function setNowReading(text) {
  if (text) {
    nowReading.classList.remove('idle');
    nowReadingText.textContent = '▶ ' + text;
  } else {
    nowReading.classList.add('idle');
    nowReadingText.textContent = '待機中';
  }
}

// ────────────────────────────────────────────────────────────
// 音声再生
// ────────────────────────────────────────────────────────────
window.api.onPlayAudio(({ base64, volume }) => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const dataUrl = `data:audio/wav;base64,${base64}`;
  currentAudio = new Audio(dataUrl);
  currentAudio.volume = Math.min(1, Math.max(0, volume ?? 1));

  currentAudio.addEventListener('ended', () => {
    currentAudio = null;
    setNowReading(null);
    window.api.audioDone();
  });

  currentAudio.addEventListener('error', () => {
    currentAudio = null;
    setNowReading(null);
    window.api.audioDone();
  });

  currentAudio.play().catch(() => {
    currentAudio = null;
    setNowReading(null);
    window.api.audioDone();
  });
});

// ────────────────────────────────────────────────────────────
// スキップ
// ────────────────────────────────────────────────────────────
skipBtn.addEventListener('click', () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  setNowReading(null);
  window.api.audioSkip();
});

// ────────────────────────────────────────────────────────────
// キュー件数
// ────────────────────────────────────────────────────────────
window.api.onQueueCount((count) => {
  queueBadge.textContent = `待機 ${count}件`;
  queueBadge.className = 'queue-badge' + (count > 0 ? ' active' : '');
});

// ────────────────────────────────────────────────────────────
// イベント受信（メインプロセスから）
// ────────────────────────────────────────────────────────────
window.api.onTiktokStatus((status) => {
  if (!status.connected) {
    setConnectedState(false);
    if (status.reason) showConnectError(status.reason);
  }
});

window.api.onComment((comment) => {
  addComment(comment);
  setNowReading(`${comment.nickname}: ${comment.text}`);
});

window.api.onJoin(({ nickname }) => {
  addJoin(nickname);
});

// ────────────────────────────────────────────────────────────
// 起動
// ────────────────────────────────────────────────────────────
init();
