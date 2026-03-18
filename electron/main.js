const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let pythonProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    resizable: true,
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

function getPythonCommand() {
  if (app.isPackaged) {
    // 本番: PyInstallerでexe化したものを使用
    const exePath = path.join(process.resourcesPath, 'python', 'tiktok_reader.exe');
    return { command: exePath, args: [] };
  } else {
    // 開発: Pythonスクリプトを直接実行
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

  // stdoutからJSONLを読み取る
  let buffer = '';
  pythonProcess.stdout.on('data', (data) => {
    buffer += data.toString('utf-8');
    const lines = buffer.split('\n');
    // 最後の不完全な行はバッファに残す
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
      console.error('[Python]', text);
      mainWindow?.webContents.send('status', { type: 'error', message: text });
    }
  });

  pythonProcess.on('close', (code) => {
    pythonProcess = null;
    mainWindow?.webContents.send('status', { type: 'stopped', code });
  });

  pythonProcess.on('error', (err) => {
    console.error('[Python起動エラー]', err.message);
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

// IPC ハンドラー
ipcMain.on('start-reader', (_event, username) => {
  startPythonProcess(username);
});

ipcMain.on('stop-reader', () => {
  stopPythonProcess();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopPythonProcess();
  app.quit();
});

app.on('before-quit', () => {
  stopPythonProcess();
});
