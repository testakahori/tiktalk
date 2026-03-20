const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');
const { checkEngine, getSpeakers, flattenSpeakers, synthesize } = require('./src/tts');

// ────────────────────────────────────────────────────────────
// 設定
// ────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  engine: 'voicevox',
  speakerId: 2,        // 四国めたん ノーマル
  speedScale: 1.2,
  pitchScale: 0.0,
  intonationScale: 1.0,
  volume: 1.0,
  readName: true,      // コメント主の名前も読む
  readJoin: true,      // 入室アナウンス
  ngWords: [
    // 性的表現
    'ろり', 'ロリ', 'ロリコン', 'loli',
    'おまんこ', 'まんこ', 'ちんこ', 'チンコ', 'ちんちん',
    'メスガキ', 'えっち', 'エッチ', 'セックス', 'sex',
    'フェラ', '射精', '強姦', 'レイプ', '痴女', '痴漢', '盗撮',
    'AV', 'エロ', 'えろ',
    // 暴力・脅迫
    '殺す', '殺せ', '死ね', '殺害', '包丁', '爆破', '爆弾',
    // 自傷・危険行為
    'リストカット', '死にたい', '飛び降り', 'オーバードーズ', '首吊り',
    // 誹謗中傷
    'きもい', 'キモい', 'うざい', 'ウザい', '消えろ'
  ],
  maxLength: 50        // 最大文字数（超えたら切る）
};

let settings = { ...DEFAULT_SETTINGS };

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      const saved = JSON.parse(fs.readFileSync(p, 'utf8'));
      settings = { ...DEFAULT_SETTINGS, ...saved };
      // 保存済みngWordsにプリセットをマージ（ユーザーが削除したものは復活させない）
      // → 「一度も保存していない」場合のみプリセットを使う
      // savedにngWordsキーがなければDEFAULT_SETTINGSのプリセットをそのまま使用
      if (!Object.prototype.hasOwnProperty.call(saved, 'ngWords')) {
        settings.ngWords = [...DEFAULT_SETTINGS.ngWords];
      }
    }
  } catch (e) {
    console.error('設定読み込みエラー:', e);
  }
}

function saveSettings(updates) {
  settings = { ...settings, ...updates };
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

// ────────────────────────────────────────────────────────────
// ウィンドウ
// ────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 780,
    minWidth: 420,
    minHeight: 650,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Tiktok Talk',
    backgroundColor: '#0d0d1a',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build/icon.ico')
  });

  mainWindow.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
  loadSettings();
  createWindow();
});

app.on('window-all-closed', () => {
  disconnectTikTok();
  if (process.platform !== 'darwin') app.quit();
});

// ────────────────────────────────────────────────────────────
// TikTok接続
// ────────────────────────────────────────────────────────────
let tiktokConn = null;
let tiktokReady = false; // 接続完了後のコメントだけ読む

function disconnectTikTok() {
  if (tiktokConn) {
    try { tiktokConn.disconnect(); } catch {}
    tiktokConn = null;
  }
  tiktokReady = false;
  clearQueue();
}

ipcMain.handle('tiktok:connect', async (_, username) => {
  disconnectTikTok();

  const clean = username.replace(/^@/, '').trim();
  if (!clean) return { ok: false, message: 'ユーザー名を入力してください' };

  try {
    tiktokConn = new TikTokLiveConnection(clean);

    tiktokConn.on(WebcastEvent.CHAT, (data) => {
      if (!tiktokReady) return; // 接続完了前の過去コメントは無視
      const comment = {
        nickname: filterName(data.user?.nickname || data.user?.uniqueId || '匿名'),
        text: data.comment || ''
      };
      mainWindow?.webContents.send('comment:new', comment);
      enqueue(comment);
    });

    tiktokConn.on(WebcastEvent.MEMBER, (data) => {
      if (!tiktokReady) return;
      if (!settings.readJoin) return;
      const rawName = data.user?.nickname || data.user?.uniqueId || '';
      const name = filterName(rawName);
      enqueue({ nickname: '', text: name ? `${name}さん、いらっしゃい` : 'いらっしゃい' });
      mainWindow?.webContents.send('join:new', { nickname: name || rawName });
    });

    tiktokConn.on(WebcastEvent.DISCONNECTED, () => {
      mainWindow?.webContents.send('tiktok:status', { connected: false, reason: '配信が終了したか接続が切れました' });
    });

    tiktokConn.on(WebcastEvent.ERROR, (err) => {
      mainWindow?.webContents.send('tiktok:status', { connected: false, reason: err.message });
    });

    const state = await tiktokConn.connect();
    tiktokReady = true; // ここから来たコメントだけ読む
    mainWindow?.webContents.send('tiktok:status', { connected: true, roomId: state.roomId });
    return { ok: true };
  } catch (err) {
    tiktokConn = null;
    return { ok: false, message: err.message };
  }
});

ipcMain.handle('tiktok:disconnect', () => {
  disconnectTikTok();
  return true;
});

// ────────────────────────────────────────────────────────────
// 名前フィルター
// ────────────────────────────────────────────────────────────
function hasNgWord(text) {
  if (!settings.ngWords || settings.ngWords.length === 0) return false;
  const lower = (text || '').toLowerCase();
  return settings.ngWords.some(w => w && lower.includes(w.toLowerCase()));
}

// NGワードが名前に含まれていたら空文字を返す（名前を読まない）
function filterName(nickname) {
  if (!nickname) return '';
  if (hasNgWord(nickname)) return '';
  return nickname;
}

// ────────────────────────────────────────────────────────────
// 音声キュー
// ────────────────────────────────────────────────────────────
let queue = [];
let isPlaying = false;

function clearQueue() {
  queue = [];
  isPlaying = false;
}

function buildReadText(comment) {
  let text = comment.text.trim();
  if (!text) return null;

  // URL除去
  text = text.replace(/https?:\/\/\S+/g, '');
  // 記号だらけなら読まない
  if (text.replace(/[^\p{L}\p{N}]/gu, '').length < 1) return null;

  // コメントにNGワードがあれば丸ごとスキップ
  if (hasNgWord(text)) return null;

  // 名前は filterName 済みの値を使う（NGなら空文字→名前を読まない）
  if (settings.readName && comment.nickname) {
    text = `${comment.nickname}、${text}`;
  }

  return text.trim();
}

function enqueue(comment) {
  const text = buildReadText(comment);
  if (!text) return;

  // キューが溜まりすぎたら古いものを捨てる
  if (queue.length >= 10) queue.shift();

  queue.push(text);
  mainWindow?.webContents.send('queue:count', queue.length + (isPlaying ? 1 : 0));
  processQueue();
}

async function processQueue() {
  if (isPlaying || queue.length === 0) return;
  isPlaying = true;

  const text = queue.shift();
  mainWindow?.webContents.send('queue:count', queue.length + 1);

  try {
    const wav = await synthesize(
      settings.engine,
      text,
      settings.speakerId,
      settings.speedScale,
      settings.pitchScale,
      settings.intonationScale
    );
    const base64 = wav.toString('base64');
    mainWindow?.webContents.send('audio:play', { base64, volume: settings.volume });
    // audio:done を受け取るまで次へ進まない
  } catch (err) {
    console.error('TTS合成エラー:', err);
    isPlaying = false;
    processQueue();
  }
}

ipcMain.on('audio:done', () => {
  isPlaying = false;
  mainWindow?.webContents.send('queue:count', queue.length);
  processQueue();
});

ipcMain.on('audio:skip', () => {
  clearQueue();
  mainWindow?.webContents.send('queue:count', 0);
});

// ────────────────────────────────────────────────────────────
// 設定 / TTS関連IPC
// ────────────────────────────────────────────────────────────
ipcMain.handle('settings:load', () => settings);

ipcMain.handle('settings:save', (_, updates) => {
  saveSettings(updates);
  return true;
});

const ENGINE_EXE_PATHS = {
  voicevox: path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'VOICEVOX', 'VOICEVOX.exe'),
  aivis:    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'AivisSpeech', 'AivisSpeech.exe')
};

ipcMain.handle('engine:launch', async (_, engine) => {
  const exePath = ENGINE_EXE_PATHS[engine];
  if (!fs.existsSync(exePath)) {
    return { ok: false, message: '実行ファイルが見つからなかったわ。Cドライブへのインストールを確認してみて。' };
  }
  try {
    spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
});

ipcMain.handle('tts:checkEngine', async (_, engine) => {
  return await checkEngine(engine);
});

ipcMain.handle('tts:getSpeakers', async (_, engine) => {
  try {
    const raw = await getSpeakers(engine);
    return flattenSpeakers(raw);
  } catch {
    return [];
  }
});
