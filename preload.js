const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 設定
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),

  // エンジン
  checkEngine: (engine) => ipcRenderer.invoke('tts:checkEngine', engine),
  launchEngine: (engine) => ipcRenderer.invoke('engine:launch', engine),
  getSpeakers: (engine) => ipcRenderer.invoke('tts:getSpeakers', engine),

  // TikTok
  connect: (username) => ipcRenderer.invoke('tiktok:connect', username),
  disconnect: () => ipcRenderer.invoke('tiktok:disconnect'),

  // 音声
  audioDone: () => ipcRenderer.send('audio:done'),
  audioSkip: () => ipcRenderer.send('audio:skip'),

  // イベント受信
  onTiktokStatus: (cb) => ipcRenderer.on('tiktok:status', (_, v) => cb(v)),
  onComment: (cb) => ipcRenderer.on('comment:new', (_, v) => cb(v)),
  onJoin: (cb) => ipcRenderer.on('join:new', (_, v) => cb(v)),
  onPlayAudio: (cb) => ipcRenderer.on('audio:play', (_, v) => cb(v)),
  onQueueCount: (cb) => ipcRenderer.on('queue:count', (_, v) => cb(v)),

  // クリーンアップ
  removeAllListeners: (ch) => ipcRenderer.removeAllListeners(ch)
});
