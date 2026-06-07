const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { searchAndFindLinks, scanShopsViaWorker } = require('./src/linkFinder');
const PerkProfile = require('./src/perkProfile');
const PerkEngine = require('./src/perkEngine');
const SavingsAnalyzer = require('./src/savingsAnalyzer');

// Initialize global perk profile instance
let globalPerkProfile = new PerkProfile();

// Initialize advanced perk engine (with reward progress tracking)
let globalPerkEngine = new PerkEngine();

// Initialize savings analyzer (uses Gemini to find savings opportunities)
let globalSavingsAnalyzer = new SavingsAnalyzer();

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
 * Routes search queries to the link finder (now perk-aware)
 */
ipcMain.handle('search-links', async (event, query) => {
  try {
    const results = await searchAndFindLinks(query, globalPerkProfile);
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

// ============================================================================
// PERK-LOOKUP SYSTEM - IPC HANDLERS
// ============================================================================

/**
 * IPC Handler: set-perks
 * 
 * Stores user's gift cards, reward programs, and public credit card perks
 * SAFETY: Validates that no sensitive data (card numbers, PINs, balances) is stored
 * 
 * Receives:
 *   {
 *     giftCards: [{ store: 'Walmart' }, ...],
 *     rewardPrograms: [{ program: 'Target Circle', tier: 'member' }, ...],
 *     creditCardPerks: [{ bank: 'Chase', category: 'Dining', benefit: '5% off' }, ...],
 *     storeCoupons: [{ store: 'Best Buy', description: '...' }, ...],
 *     promoCredits: [{ platform: 'Amazon', description: '...' }, ...]
 *   }
 * 
 * Returns:
 *   { success: boolean, message?: string, summary?: string }
 */
ipcMain.handle('set-perks', async (event, perkList) => {
  try {
    console.log('[Perk IPC] Setting perks...');

    const success = globalPerkProfile.setPerks(perkList);

    if (success) {
      const summary = globalPerkProfile.getSummary();
      console.log(`[Perk IPC] Perks set successfully: ${summary}`);
      return {
        success: true,
        message: 'Perks updated',
        summary: summary
      };
    } else {
      return {
        success: false,
        message: 'Failed to set perks (may contain invalid data)'
      };
    }
  } catch (error) {
    console.error('[Perk IPC] Error setting perks:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
});

/**
 * IPC Handler: get-perks
 * 
 * Retrieves the currently configured perks
 * 
 * Returns:
 *   {
 *     success: boolean,
 *     data: {
 *       giftCards: [],
 *       rewardPrograms: [],
 *       creditCardPerks: [],
 *       storeCoupons: [],
 *       promoCredits: []
 *     }
 *   }
 */
ipcMain.handle('get-perks', async (event) => {
  try {
    const perks = globalPerkProfile.getPerks();
    return {
      success: true,
      data: perks
    };
  } catch (error) {
    console.error('[Perk IPC] Error getting perks:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * IPC Handler: get-perk-summary
 * 
 * Returns a human-readable summary of active perks for UI display
 * 
 * Returns:
 *   { success: boolean, summary: string }
 */
ipcMain.handle('get-perk-summary', async (event) => {
  try {
    const summary = globalPerkProfile.getSummary();
    return {
      success: true,
      summary: summary
    };
  } catch (error) {
    console.error('[Perk IPC] Error getting perk summary:', error);
    return {
      success: false,
      summary: 'Error loading perks'
    };
  }
});

/**
 * IPC Handler: update-reward-progress
 * 
 * Updates reward progress for a specific program (points, stamps, tiers, etc.)
 * 
 * Receives:
 *   {
 *     programName: 'target-circle',
 *     progressData: { points: 250, tier: 'gold' }
 *   }
 * 
 * Returns:
 *   { success: boolean, message?: string, progress?: object }
 */
ipcMain.handle('update-reward-progress', async (event, { programName, progressData }) => {
  try {
    console.log(`[Perk IPC] Updating reward progress for ${programName}...`);
    
    const result = globalPerkEngine.updateRewardProgress(programName, progressData);
    
    if (result.success) {
      console.log(`[Perk IPC] ✅ Updated ${programName}`);
    }
    
    return result;
  } catch (error) {
    console.error('[Perk IPC] Error updating reward progress:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
});

/**
 * IPC Handler: get-reward-progress
 * 
 * Gets reward progress for a specific program or all programs
 * 
 * Receives:
 *   programName: string (optional - if omitted, returns all)
 * 
 * Returns:
 *   {
 *     success: boolean,
 *     data: { points: 250, stamps: 3, tier: 'gold', ... }
 *   }
 */
ipcMain.handle('get-reward-progress', async (event, programName) => {
  try {
    let data;
    
    if (programName) {
      data = globalPerkEngine.getRewardProgress(programName);
    } else {
      data = globalPerkEngine.getAllRewardProgress();
    }
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('[Perk IPC] Error getting reward progress:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * IPC Handler: get-earning-path
 * 
 * Gets earning suggestions for how to maximize rewards with a specific item
 * 
 * Receives:
 *   item: {
 *     title: string,
 *     source: string,
 *     priceNumber: number,
 *     category: string
 *   }
 * 
 * Returns:
 *   {
 *     success: boolean,
 *     suggestions: [
 *       {
 *         program: string,
 *         earnedPoints: number,
 *         pointsNeeded: number,
 *         special?: string
 *       },
 *       ...
 *     ]
 *   }
 */
ipcMain.handle('get-earning-path', async (event, item) => {
  try {
    const suggestions = globalPerkEngine.getEarningPath(item);
    
    return {
      success: true,
      suggestions: suggestions
    };
  } catch (error) {
    console.error('[Perk IPC] Error getting earning path:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * IPC Handler: check-free-item-eligibility
 * 
 * Checks if an item qualifies as free or discounted based on active perks
 * 
 * Receives:
 *   item: {
 *     title: string,
 *     source: string,
 *     priceNumber: number,
 *     category: string
 *   }
 * 
 * Returns:
 *   {
 *     success: boolean,
 *     eligible: boolean,
 *     eligibilities: [
 *       {
 *         perk: string,
 *         reason: string,
 *         discount?: number
 *       }
 *     ]
 *   }
 */
ipcMain.handle('check-free-item-eligibility', async (event, item) => {
  try {
    const result = globalPerkEngine.checkFreeItemEligibility(item);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('[Perk IPC] Error checking free-item eligibility:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Account Benefits IPC Handler - Add account-based benefit
 * Example: Uber Eats $50 credit after 700 purchases
 */
ipcMain.handle('add-account-benefit', async (event, benefit) => {
  try {
    const result = globalPerkEngine.addAccountBenefit(benefit);
    return {
      success: result.success,
      message: result.message,
      benefits: globalPerkEngine.accountBenefits
    };
  } catch (error) {
    console.error('[Account Benefit IPC] Error adding benefit:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Account Benefits IPC Handler - Update progress toward benefit
 */
ipcMain.handle('update-account-benefit-progress', async (event, { benefitId, progress }) => {
  try {
    const result = globalPerkEngine.updateAccountBenefitProgress(benefitId, progress);
    return {
      success: result.success,
      message: result.message,
      benefit: result.benefit
    };
  } catch (error) {
    console.error('[Account Benefit IPC] Error updating progress:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Account Benefits IPC Handler - Get all account benefits
 */
ipcMain.handle('get-account-benefits', async (event) => {
  try {
    const benefits = globalPerkEngine.accountBenefits;
    const summary = globalPerkEngine.getAccountBenefitsSummary();
    const availableBenefits = globalPerkEngine.getAvailableAccountBenefits();
    const almostUnlocked = globalPerkEngine.getAlmostUnlockedBenefits();

    return {
      success: true,
      benefits,
      summary,
      availableBenefits,
      almostUnlocked
    };
  } catch (error) {
    console.error('[Account Benefit IPC] Error getting benefits:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Savings Analysis IPC Handler - Analyze single link for savings
 * Uses Gemini to find how user can save using account benefits
 */
ipcMain.handle('analyze-link-for-savings', async (event, { link }) => {
  try {
    const accountBenefits = globalPerkEngine.getAccountBenefitsForAnalysis();
    const analysis = await globalSavingsAnalyzer.analyzeLinkForSavings(link, accountBenefits);

    return {
      success: analysis.success,
      analysis
    };
  } catch (error) {
    console.error('[Savings Analysis IPC] Error analyzing link:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Savings Analysis IPC Handler - Analyze multiple links in parallel
 */
ipcMain.handle('analyze-links-for-savings', async (event, { links }) => {
  try {
    const accountBenefits = globalPerkEngine.getAccountBenefitsForAnalysis();
    const analyses = await globalSavingsAnalyzer.analyzeLinksForSavings(links, accountBenefits);

    return {
      success: true,
      analyses
    };
  } catch (error) {
    console.error('[Savings Analysis IPC] Error analyzing links:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Open URL in default browser
 */
ipcMain.handle('open-url', async (event, url) => {
  try {
    if (!url || typeof url !== 'string') {
      return {
        success: false,
        error: 'Invalid URL'
      };
    }

    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    
    await shell.openExternal(fullUrl);
    
    return {
      success: true
    };
  } catch (error) {
    console.error('[Open URL] Error opening URL:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
