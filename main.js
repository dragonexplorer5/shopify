const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { searchAndFindLinks } = require('./src/linkFinder');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 500,
    minWidth: 600,
    minHeight: 450,
    maxWidth: 1200,
    maxHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  mainWindow.loadFile('src/index.html');
  mainWindow.webContents.openDevTools();
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handler for search requests
ipcMain.handle('search-links', async (event, query) => {
  try {
    const results = await searchAndFindLinks(query);
    return { success: true, data: results };
  } catch (error) {
    console.error('Search error:', error);
    return { success: false, error: error.message };
  }
});
