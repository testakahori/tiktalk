const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tiktalk', {
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
});
