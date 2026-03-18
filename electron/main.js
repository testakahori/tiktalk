const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const http = require('http');
const ElectronStore = require('electron-store');
const log = require('electron-log');

// --- ログ設定 ---
// ファイル: %AppData%/TikTalk/logs/main.log (Windows)
//           ~/Library/Logs/TikTalk/main.log  (macOS)
log.transports.file.level = 'debug';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn';

// uncaught例外もキャプチャ
// uncaught例外をキャプチャ（v4スタイル）
process.on('uncaughtException', (error) => {
  log.error('[UncaughtError]', error.message, error.stack);
});

log.info('========== TikTalk 起動 ==========');
log.info(`バージョン: ${require('../package.json').version}`);
log.info(`OS: ${process.platform} ${process.arch}`);

const { CommentFilter } = require('../core/filter.js');
const { CommentFormatter } = require('../core/formatter.js');
const { CommentQueue, Priority } = require('../core/queue.js');
const { TikTokManager } = require('../core/tiktok.js');
const { TTSEngine } = require('../core/tts.js');
const { AudioPlayer } = require('../core/player.js');

// 設定永続化
const store = new ElectronStore({
  defaults: {
    speakerId: 0,
    speed: 1.0,
    ngWords: [],
    ttsBaseUrl: 'http://localhost:5000',
  },
});

let mainWindow = null;
let pythonProcess = null;
let setupProcess = null;

// セットアップ完了フラグのパス
const SETUP_FLAG = path.join(os.homedir(), '.tiktalk_setup_done');

// --- TikTokパイプライン ---
let tiktokManager = null;
let filter = null;
let formatter = null;
let queue = null;
let ttsEngine = null;
let player = null;
let processingQueue = false;

// 連投検出用: userId → コメント回数
const userCommentCount = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    resizable: true,
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 開発中はVite dev server、本番はビルド済みHTMLを読み込む
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// --- Python プロセス管理（セットアップ用に残す） ---

function getPythonCommand() {
  if (app.isPackaged) {
    const exePath = path.join(process.resourcesPath, 'python', 'tiktok_reader.exe');
    return { command: exePath, args: [] };
  } else {
    return { command: 'python', args: [path.join(__dirname, '..', 'python', 'tiktok_reader.py')] };
  }
}

function startPythonProcess(username) {
  if (pythonProcess) {
    stopPythonProcess();
  }

  const { command, args } = getPythonCommand();
  const fullArgs = [...args, username];

  pythonProcess = spawn(command, fullArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';
  pythonProcess.stdout.on('data', (data) => {
    buffer += data.toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        mainWindow?.webContents.send('comment', msg);
      } catch {
        // JSONパース失敗は無視
      }
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    const text = data.toString('utf-8').trim();
    if (text) {
      log.error('[Python]', text);
      mainWindow?.webContents.send('status', { type: 'error', message: text });
    }
  });

  pythonProcess.on('close', (code) => {
    log.info(`[Python] プロセス終了 code=${code}`);
    pythonProcess = null;
    mainWindow?.webContents.send('status', { type: 'stopped', code });
  });

  pythonProcess.on('error', (err) => {
    log.error('[Python起動エラー]', err.message);
    mainWindow?.webContents.send('status', { type: 'error', message: `Python起動失敗: ${err.message}` });
    pythonProcess = null;
  });

  mainWindow?.webContents.send('status', { type: 'started' });
}

function stopPythonProcess() {
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }
  mainWindow?.webContents.send('status', { type: 'stopped' });
}

// --- セットアップウィザード関連 ---

function getSetupPythonCommand(action) {
  const scriptPath = path.join(__dirname, '..', 'python', 'setup_wizard.py');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const args = [scriptPath];
  if (action) args.push(action);
  return { command: pythonCmd, args };
}

function runSetupWizard(action) {
  if (setupProcess) {
    setupProcess.kill();
    setupProcess = null;
  }

  const { command, args } = getSetupPythonCommand(action || 'full');
  setupProcess = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';
  setupProcess.stdout.on('data', (data) => {
    buffer += data.toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        mainWindow?.webContents.send('setup-progress', msg);
      } catch {
        // JSONパース失敗は無視
      }
    }
  });

  setupProcess.stderr.on('data', (data) => {
    log.error('[Setup]', data.toString('utf-8').trim());
  });

  setupProcess.on('close', () => {
    setupProcess = null;
  });
}

function checkTTS() {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: 5000, path: '/voice', method: 'HEAD', timeout: 5000 },
      (res) => resolve(true)
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// --- TikTokパイプライン ---

function initPipeline() {
  const ngWords = store.get('ngWords', []);
  const speakerId = store.get('speakerId', 0);
  const speed = store.get('speed', 1.0);
  const ttsBaseUrl = store.get('ttsBaseUrl', 'http://localhost:5000');
  log.info(`[Pipeline] 初期化 speakerId=${speakerId} speed=${speed} ttsBaseUrl=${ttsBaseUrl} ngWords=${ngWords.length}件`);

  filter = new CommentFilter(ngWords);
  formatter = new CommentFormatter();
  queue = new CommentQueue();
  ttsEngine = new TTSEngine({ baseUrl: ttsBaseUrl, speakerId, speed });
  player = new AudioPlayer();
  userCommentCount.clear();

  // キューにコメントが入ったら処理開始
  queue.onReady(() => {
    processNextComment();
  });
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

    // フォーマット
    const formattedText = formatter.format(comment);

    // Rendererにコメント通知
    mainWindow?.webContents.send('comment', {
      userId: comment.userId,
      username: comment.username,
      text: comment.text,
      formattedText,
      priority: comment._priority,
      type: comment.type,
    });

    // TTS
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
  if (count > 0) return Priority.REPEAT_USER;
  return Priority.NORMAL;
}

function startTikTok(username) {
  stopTikTok();
  initPipeline();

  tiktokManager = new TikTokManager();

  tiktokManager.on('comment', (comment) => {
    // フィルタ
    if (filter.shouldFilter(comment)) return;

    // 優先度判定
    const priority = determinePriority(comment);

    // 連投カウント更新
    userCommentCount.set(comment.userId, (userCommentCount.get(comment.userId) || 0) + 1);

    // _priorityをコメントに付与してキューに追加
    comment._priority = priority;
    queue.add(comment, priority);
    mainWindow?.webContents.send('queue-size', queue.size());

    // キューに溜まっていて処理が止まっている場合に再開
    if (!processingQueue) {
      processNextComment();
    }
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
  if (player) {
    player.stop();
  }
  if (queue) {
    queue.clear();
    queue.setSpeaking(false);
  }
  processingQueue = false;
  userCommentCount.clear();
  mainWindow?.webContents.send('status', { type: 'disconnected' });
  mainWindow?.webContents.send('queue-size', 0);
}

// --- IPC ハンドラー ---

// 既存: Pythonプロセス制御（セットアップ用）
ipcMain.on('start-reader', (_event, username) => {
  startPythonProcess(username);
});

ipcMain.on('stop-reader', () => {
  stopPythonProcess();
});

// 新規: TikTokパイプライン制御
ipcMain.on('start-tiktok', (_event, username) => {
  startTikTok(username);
});

ipcMain.on('stop-tiktok', () => {
  stopTikTok();
});

// Node.jsパイプライン制御（エイリアス）
ipcMain.on('start-node-reader', (_event, username) => {
  startTikTok(username);
});

ipcMain.on('stop-node-reader', () => {
  stopTikTok();
});

// TTS話者リスト取得
ipcMain.handle('get-speakers', async () => {
  const tempTts = ttsEngine || new TTSEngine({ baseUrl: store.get('ttsBaseUrl', 'http://localhost:5000') });
  return await tempTts.getSpeakers();
});

// 設定の動的更新（永続化あり）
ipcMain.on('update-settings', (_event, settings) => {
  if (settings.ngWords) {
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

// ユーザー辞書更新
ipcMain.on('add-user-dict', (_event, { userId, reading }) => {
  if (formatter) {
    formatter.updateUserDict(userId, reading);
  }
});

// ログファイルを開く
ipcMain.handle('open-log-file', async () => {
  const logPath = log.transports.file.file;
  log.info('[IPC] ログファイルを開く:', logPath);
  await shell.openPath(logPath);
  return logPath;
});

// ログパスを取得（UIに表示用）
ipcMain.handle('get-log-path', () => {
  return log.transports.file.file;
});

// セットアップ用IPC
ipcMain.on('run-setup', (_event, action) => {
  runSetupWizard(action);
});

ipcMain.handle('check-tts', async () => {
  return await checkTTS();
});

ipcMain.on('setup-done', () => {
  mainWindow?.webContents.send('setup-completed');
});

// セットアップ済みか確認してから起動
app.whenReady().then(() => {
  log.info('[App] ウィンドウ作成');
  createWindow();
  mainWindow.webContents.on('did-finish-load', () => {
    const setupDone = fs.existsSync(SETUP_FLAG);
    log.info(`[App] ロード完了 setupDone=${setupDone}`);
    mainWindow.webContents.send('setup-state', { setupDone });
  });
});

app.on('ready', () => {
  log.info(`[App] ログファイル: ${log.transports.file.file}`);
});

app.on('window-all-closed', () => {
  stopTikTok();
  stopPythonProcess();
  app.quit();
});

app.on('before-quit', () => {
  stopTikTok();
  stopPythonProcess();
  if (setupProcess) {
    setupProcess.kill();
    setupProcess = null;
  }
});
