const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { searchAndFindLinks, scanShopsViaWorker } = require('./src/linkFinder');

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

// ============================================================================
// IPC HANDLERS - Main Process Communication
// ============================================================================

/**
 * IPC Handler: search-links (existing, for main search)
 * Routes search queries to the link finder
 */
ipcMain.handle('search-links', async (event, query) => {
  try {
    const results = await searchAndFindLinks(query);
    return { success: true, data: results };
  } catch (error) {
    console.error('Search error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * IPC Handler: scan-shops (new, for parallel shop scanning)
 * 
 * Receives:
 *   - shopUrls: array of URLs to scan
 *   
 * Returns:
 *   {
 *     success: boolean,
 *     data: {
 *       batchId: string,
 *       totalScans: number,
 *       successfulScans: number,
 *       failedScans: number,
 *       results: array,
 *       responseTime: number
 *     },
 *     error?: string
 *   }
 */
ipcMain.handle('scan-shops', async (event, shopUrls) => {
  const batchId = `ipc-${Date.now()}`;
  
  try {
    if (!Array.isArray(shopUrls) || shopUrls.length === 0) {
      return {
        success: false,
        error: 'shopUrls must be a non-empty array'
      };
    }

    console.log(`[${batchId}] Received scan-shops request for ${shopUrls.length} shops`);

    // Set timeout to prevent UI from hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Scan timeout: exceeded 60 seconds')), 60000)
    );

    const scanPromise = scanShopsViaWorker(shopUrls);

    const result = await Promise.race([scanPromise, timeoutPromise]);

    console.log(`[${batchId}] Scan complete: ${result.successfulScans}/${result.totalScans} successful`);

    return {
      success: result.success || result.successfulScans > 0,
      data: result
    };

  } catch (error) {
    console.error(`[${batchId}] Scan-shops error:`, error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * IPC Handler: health-check (optional utility for monitoring Worker)
 * 
 * Returns:
 *   {
 *     workerStatus: 'ok' | 'error',
 *     timestamp: ISO string,
 *     error?: string
 *   }
 */
ipcMain.handle('health-check', async (event) => {
  try {
    const axios = require('axios');
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://your-worker-subdomain.workers.dev';
    
    const response = await axios.get(`${workerUrl}/health`, { timeout: 5000 });
    
    return {
      success: true,
      data: {
        workerStatus: response.data.status,
        timestamp: response.data.timestamp,
        proxies: response.data.proxies
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});
