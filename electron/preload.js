const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tiktalk', {
  // --- TikTokパイプライン制御（新規） ---

  // TikTok接続開始
  startTikTok: (username) => {
    ipcRenderer.send('start-tiktok', username);
  },

  // TikTok接続停止
  stopTikTok: () => {
    ipcRenderer.send('stop-tiktok');
  },

  // Node.jsパイプライン制御（エイリアス）
  startNodeReader: (username) => {
    ipcRenderer.send('start-node-reader', username);
  },

  stopNodeReader: () => {
    ipcRenderer.send('stop-node-reader');
  },

  // TTS話者リスト取得
  getSpeakers: () => ipcRenderer.invoke('get-speakers'),

  // 設定の動的更新
  updateSettings: (settings) => {
    ipcRenderer.send('update-settings', settings);
  },

  // ユーザー辞書追加
  addUserDict: ({ userId, reading }) => {
    ipcRenderer.send('add-user-dict', { userId, reading });
  },

  // キューサイズ通知コールバック
  onQueueSize: (callback) => {
    ipcRenderer.on('queue-size', (_event, size) => callback(size));
  },

  // --- 既存: Python読み上げ（セットアップ用に残す） ---

  // 読み上げ開始
  startReader: (username) => {
    ipcRenderer.send('start-reader', username);
  },

  // 読み上げ停止
  stopReader: () => {
    ipcRenderer.send('stop-reader');
  },

  // コメント受信コールバック
  onComment: (callback) => {
    ipcRenderer.on('comment', (_event, data) => callback(data));
  },

  // ステータス変更コールバック
  onStatus: (callback) => {
    ipcRenderer.on('status', (_event, data) => callback(data));
  },

  // --- セットアップウィザード ---

  // セットアップ実行（actionで個別ステップ指定可）
  runSetup: (action) => {
    ipcRenderer.send('run-setup', action);
  },

  // TTS疎通確認
  checkTTS: async () => {
    return await ipcRenderer.invoke('check-tts');
  },

  // セットアップ進捗コールバック
  onSetupProgress: (callback) => {
    ipcRenderer.on('setup-progress', (_event, data) => callback(data));
  },

  // セットアップ完了
  completeSetup: () => {
    ipcRenderer.send('setup-done');
  },

  // セットアップ状態通知コールバック
  onSetupState: (callback) => {
    ipcRenderer.on('setup-state', (_event, data) => callback(data));
  },

  // セットアップ完了通知コールバック
  onSetupCompleted: (callback) => {
    ipcRenderer.on('setup-completed', (_event) => callback());
  },

  // --- ログ操作 ---

  // ログファイルをエクスプローラー/Finderで開く
  openLogFile: () => ipcRenderer.invoke('open-log-file'),

  // ログファイルのパスを取得（UI表示用）
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
});
