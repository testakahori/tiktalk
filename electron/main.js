'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const ElectronStore = require('electron-store');
const log = require('./logger'); // 自前ロガー（外部依存ゼロ）

log.info('========== TikTalk 起動 ==========');
log.info(`バージョン: ${require('../package.json').version}`);
log.info(`OS: ${process.platform} ${process.arch}`);

const { CommentFilter } = require('../core/filter.js');
const { CommentFormatter } = require('../core/formatter.js');
const { CommentQueue, Priority } = require('../core/queue.js');
const { TikTokManager } = require('../core/tiktok.js');
const { TTSEngine } = require('../core/tts.js');
const { AudioPlayer } = require('../core/player.js');

// 設定永続化（保存先: %AppData%\TikTalk\config.json）
const store = new ElectronStore({
  name: 'config',
  defaults: {
    speakerId: 0,
    speed: 1.0,
    ngWords: [],
    ttsBaseUrl: 'http://localhost:5000',
  },
});

let mainWindow = null;

// セットアップ完了フラグ（%AppData%\TikTalk\setup_done）
const SETUP_FLAG = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'TikTalk',
  'setup_done'
);

// --- TikTokパイプライン ---
let tiktokManager = null;
let filter = null;
let formatter = null;
let queue = null;
let ttsEngine = null;
let player = null;
let processingQueue = false;
const userCommentCount = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    minWidth: 400,
    minHeight: 600,
    resizable: true,
    title: 'TikTalk',
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true, // セキュリティ強化
    },
  });

  // メニューバーを非表示（本番）
  if (app.isPackaged) {
    mainWindow.setMenuBarVisibility(false);
  }

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- TTS疎通確認（Node.jsのみ・Python不使用） ---
function checkTTS() {
  return new Promise((resolve) => {
    // /voice か /docs か /models/info に HEAD リクエスト
    const tryPath = (pathStr) => new Promise((res) => {
      const req = http.request(
        { hostname: '127.0.0.1', port: 5000, path: pathStr, method: 'HEAD', timeout: 4000 },
        () => res(true)
      );
      req.on('error', () => res(false));
      req.on('timeout', () => { req.destroy(); res(false); });
      req.end();
    });

    Promise.any([tryPath('/voice'), tryPath('/docs'), tryPath('/models/info')])
      .then(() => resolve(true))
      .catch(() => resolve(false));
  });
}

// --- TikTokパイプライン ---
function initPipeline() {
  const ngWords = store.get('ngWords', []);
  const speakerId = store.get('speakerId', 0);
  const speed = store.get('speed', 1.0);
  const ttsBaseUrl = store.get('ttsBaseUrl', 'http://localhost:5000');
  log.info(`[Pipeline] 初期化 speakerId=${speakerId} speed=${speed} ngWords=${ngWords.length}件`);

  filter = new CommentFilter(ngWords);
  formatter = new CommentFormatter();
  queue = new CommentQueue();
  ttsEngine = new TTSEngine({ baseUrl: ttsBaseUrl, speakerId, speed });
  player = new AudioPlayer();
  userCommentCount.clear();

  queue.onReady(() => { processNextComment(); });
}

async function processNextComment() {
  if (processingQueue) return;
  processingQueue = true;

  while (true) {
    queue.setSpeaking(false);
    const comment = queue.next();
    if (!comment) break;

    queue.setSpeaking(true);
    mainWindow?.webContents.send('queue-size', queue.size());

    const formattedText = formatter.format(comment);

    mainWindow?.webContents.send('comment', {
      userId: comment.userId,
      username: comment.username,
      text: comment.text,
      formattedText,
      priority: comment._priority,
      type: comment.type,
    });

    mainWindow?.webContents.send('status', { type: 'speaking' });
    const wavPath = await ttsEngine.speak(formattedText);
    if (wavPath) {
      try {
        await player.play(wavPath);
      } catch (err) {
        log.error('[AudioPlayer]', err.message);
      }
    }
    mainWindow?.webContents.send('status', { type: 'idle' });
  }

  queue.setSpeaking(false);
  processingQueue = false;
  mainWindow?.webContents.send('queue-size', queue.size());
}

function determinePriority(comment) {
  if (comment.type === 'gift') return Priority.GIFT;
  if (comment.type === 'member') return Priority.FIRST_COMMENT;
  const count = userCommentCount.get(comment.userId) || 0;
  return count > 0 ? Priority.REPEAT_USER : Priority.NORMAL;
}

function startTikTok(username) {
  stopTikTok();
  initPipeline();

  tiktokManager = new TikTokManager();

  tiktokManager.on('comment', (comment) => {
    if (filter.shouldFilter(comment)) return;
    const priority = determinePriority(comment);
    userCommentCount.set(comment.userId, (userCommentCount.get(comment.userId) || 0) + 1);
    comment._priority = priority;
    queue.add(comment, priority);
    mainWindow?.webContents.send('queue-size', queue.size());
    if (!processingQueue) processNextComment();
  });

  tiktokManager.on('connected', () => {
    log.info(`[TikTok] 接続成功: @${username}`);
    mainWindow?.webContents.send('status', { type: 'connected', message: `${username} に接続しました` });
  });

  tiktokManager.on('disconnected', () => {
    log.warn(`[TikTok] 切断: @${username}`);
    mainWindow?.webContents.send('status', { type: 'disconnected', message: '切断されました。再接続中...' });
  });

  tiktokManager.on('error', (err) => {
    log.error('[TikTok]', err.message || err);
    mainWindow?.webContents.send('status', { type: 'error', message: err.message || String(err) });
  });

  tiktokManager.connect(username);
}

function stopTikTok() {
  if (tiktokManager) {
    tiktokManager.disconnect();
    tiktokManager.removeAllListeners();
    tiktokManager = null;
  }
  if (player) player.stop();
  if (queue) { queue.clear(); queue.setSpeaking(false); }
  processingQueue = false;
  userCommentCount.clear();
  mainWindow?.webContents.send('status', { type: 'disconnected' });
  mainWindow?.webContents.send('queue-size', 0);
}

// --- IPC ハンドラー ---

ipcMain.on('start-tiktok', (_event, username) => {
  log.info(`[IPC] start-tiktok: @${username}`);
  startTikTok(username);
});

ipcMain.on('stop-tiktok', () => {
  log.info('[IPC] stop-tiktok');
  stopTikTok();
});

// エイリアス（UI互換）
ipcMain.on('start-node-reader', (_event, username) => startTikTok(username));
ipcMain.on('stop-node-reader', () => stopTikTok());

ipcMain.handle('get-speakers', async () => {
  const tts = ttsEngine || new TTSEngine({ baseUrl: store.get('ttsBaseUrl', 'http://localhost:5000') });
  return await tts.getSpeakers();
});

ipcMain.on('update-settings', (_event, settings) => {
  if (settings.ngWords !== undefined) {
    store.set('ngWords', settings.ngWords);
    if (filter) filter.updateNgWords(settings.ngWords);
  }
  if (settings.speakerId !== undefined) {
    store.set('speakerId', settings.speakerId);
    if (ttsEngine) ttsEngine.updateOptions({ speakerId: settings.speakerId });
  }
  if (settings.speed !== undefined) {
    store.set('speed', settings.speed);
    if (ttsEngine) ttsEngine.updateOptions({ speed: settings.speed });
  }
});

ipcMain.on('add-user-dict', (_event, { userId, reading }) => {
  if (formatter) formatter.updateUserDict(userId, reading);
});

// TTS疎通確認（Node.jsのみ）
ipcMain.handle('check-tts', async () => {
  const ok = await checkTTS();
  log.info(`[IPC] check-tts: ${ok}`);
  return ok;
});

// セットアップ完了フラグを書き込む
ipcMain.on('setup-done', () => {
  try {
    fs.mkdirSync(path.dirname(SETUP_FLAG), { recursive: true });
    fs.writeFileSync(SETUP_FLAG, new Date().toISOString(), 'utf8');
    log.info('[Setup] 完了フラグ書き込み:', SETUP_FLAG);
  } catch (e) {
    log.error('[Setup] フラグ書き込み失敗:', e.message);
  }
  mainWindow?.webContents.send('setup-completed');
});

// ログファイルをエクスプローラーで開く
ipcMain.handle('open-log-file', async () => {
  const logPath = log.getLogPath();
  log.info('[IPC] ログファイルを開く:', logPath);
  await shell.openPath(logPath);
  return logPath;
});

ipcMain.handle('get-log-path', () => log.getLogPath());

// --- アプリ起動 ---
app.whenReady().then(() => {
  log.info('[App] ウィンドウ作成');
  log.info(`[App] ログ: ${log.getLogPath()}`);
  log.info(`[App] 設定: ${store.path}`);
  createWindow();

  mainWindow.webContents.on('did-finish-load', () => {
    const setupDone = fs.existsSync(SETUP_FLAG);
    log.info(`[App] ロード完了 setupDone=${setupDone}`);
    mainWindow.webContents.send('setup-state', { setupDone });
  });
});

app.on('window-all-closed', () => {
  stopTikTok();
  app.quit();
});

app.on('before-quit', () => {
  stopTikTok();
});
