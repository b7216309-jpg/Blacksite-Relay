const { contextBridge, ipcRenderer } = require('electron');
const quitCallbacks = new Set();
ipcRenderer.on('quit-requested', () => {
    for (const callback of [...quitCallbacks]) { try { callback(); } catch (_) {} }
});

contextBridge.exposeInMainWorld('electronAPI', {
    submitScore: (name, score) => ipcRenderer.invoke('submit-score', { name, score }),
    getLeaderboard: () => ipcRenderer.invoke('get-leaderboard'),
    saveGame: (data) => ipcRenderer.invoke('save-game', data),
    loadGame: () => ipcRenderer.invoke('load-game'),
    closeApp: () => ipcRenderer.send('close-app'),
    onQuitRequested: callback => {
        if (typeof callback !== 'function') throw new TypeError('A quit callback is required.');
        const subscription = () => callback();
        quitCallbacks.add(subscription);
        ipcRenderer.send('quit-listener-ready', true);
        let subscribed = true;
        return () => {
            if (!subscribed) return;
            subscribed = false; quitCallbacks.delete(subscription);
            if (!quitCallbacks.size) ipcRenderer.send('quit-listener-ready', false);
        };
    },
    quitCancelled: () => ipcRenderer.send('quit-cancelled'),
    flushLocalScores: (options = {}) => ipcRenderer.invoke('flush-local-scores', options),
    finishQuit: (options = {}) => ipcRenderer.invoke('finish-quit', options)
});
