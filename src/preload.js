const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose safe IPC APIs to the renderer process
 * 
 * All communication between renderer and main process must go through these APIs
 */
contextBridge.exposeInMainWorld('api', {
  /**
   * Original search API - searches across multiple retailers
   * @param {string} query - Search query
   * @returns {Promise<Object>} Search results with best deal, links, and sorting
   */
  searchLinks: (query) => ipcRenderer.invoke('search-links', query),

  /**
   * New scan shops API - performs parallel shop scanning via Cloudflare Worker
   * 
   * @param {Array<string>} shopUrls - List of shop URLs to scan
   * @returns {Promise<Object>} Batch scan results with:
   *   - success: boolean
   *   - data: {
   *       batchId: string (unique batch identifier),
   *       totalScans: number (how many shops were scanned),
   *       successfulScans: number (successful scans),
   *       failedScans: number (failed scans),
   *       results: array (individual scan results with proxy info, timing, etc.),
   *       responseTime: number (total time in ms)
   *     }
   *   - error?: string
   * 
   * Example usage:
   *   const result = await window.api.scanShops([
   *     'https://shop1.com',
   *     'https://shop2.com',
   *     'https://shop3.com'
   *   ]);
   *   
   *   result.data.results.forEach(scan => {
   *     console.log(`${scan.shopUrl}: ${scan.proxyUsed} (${scan.responseTime}ms)`);
   *   });
   */
  scanShops: (shopUrls) => ipcRenderer.invoke('scan-shops', shopUrls),

  /**
   * Health check - verifies Cloudflare Worker is accessible
   * @returns {Promise<Object>} Worker status information
   */
  healthCheck: () => ipcRenderer.invoke('health-check')
});
