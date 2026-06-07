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
  healthCheck: () => ipcRenderer.invoke('health-check'),

  /**
   * Perk-Lookup System - Set user perks
   * 
   * Stores user's gift cards, reward programs, and credit card perks
   * SAFETY: Never stores card numbers, PINs, or balance information
   * 
   * @param {Object} perkList - Perk configuration
   * @example
   * await window.api.setPerks({
   *   giftCards: [{ store: 'Walmart' }],
   *   rewardPrograms: [{ program: 'Target Circle', tier: 'member' }],
   *   creditCardPerks: [{ bank: 'Chase', category: 'Dining', benefit: '5% off' }],
   *   storeCoupons: [{ store: 'Best Buy', description: 'Member exclusive' }],
   *   promoCredits: [{ platform: 'Amazon', description: 'Promo credit' }]
   * })
   * @returns {Promise<boolean>} Success status
   */
  setPerks: (perkList) => ipcRenderer.invoke('set-perks', perkList),

  /**
   * Perk-Lookup System - Get user perks
   * 
   * Retrieves the currently configured perks
   * 
   * @example
   * const perks = await window.api.getPerks();
   * console.log(perks.giftCards, perks.rewardPrograms);
   * 
   * @returns {Promise<Object>} Current perk configuration
   */
  getPerks: () => ipcRenderer.invoke('get-perks'),

  /**
   * Perk-Lookup System - Get perk summary
   * 
   * Returns a human-readable summary of active perks
   * 
   * @example
   * const summary = await window.api.getPerkSummary();
   * console.log(summary); // "2 gift card(s), 1 reward program(s)"
   * 
   * @returns {Promise<string>} Summary string for UI display
   */
  getPerkSummary: () => ipcRenderer.invoke('get-perk-summary'),

  /**
   * Advanced Perk Engine - Update reward progress
   * 
   * Tracks progress in reward programs (points, stamps, tiers, etc.)
   * 
   * @param {string} programName - Program identifier (e.g., 'target-circle')
   * @param {Object} progressData - Progress metrics
   * @example
   * await window.api.updateRewardProgress('target-circle', {
   *   points: 250,
   *   tier: 'gold'
   * });
   * 
   * await window.api.updateRewardProgress('best-buy-rewards', {
   *   points: 280,
   *   stamps: 3,
   *   earning: 1.5
   * });
   * 
   * @returns {Promise<Object>} { success, message, progress }
   */
  updateRewardProgress: (programName, progressData) => 
    ipcRenderer.invoke('update-reward-progress', { programName, progressData }),

  /**
   * Advanced Perk Engine - Get reward progress
   * 
   * Retrieves progress in a specific program or all programs
   * 
   * @param {string} [programName] - Program identifier (optional)
   * @example
   * // Get all programs
   * const allProgress = await window.api.getRewardProgress();
   * 
   * // Get specific program
   * const targetCircle = await window.api.getRewardProgress('target-circle');
   * console.log(targetCircle.points, targetCircle.tier);
   * 
   * @returns {Promise<Object>} Progress data with points, stamps, tiers, etc.
   */
  getRewardProgress: (programName) => 
    ipcRenderer.invoke('get-reward-progress', programName),

  /**
   * Advanced Perk Engine - Get earning path suggestions
   * 
   * Suggests ways to maximize rewards with a specific item
   * 
   * @param {Object} item - Product information
   * @example
   * const suggestions = await window.api.getEarningPath({
   *   title: 'Walmart Laptop',
   *   source: 'Walmart',
   *   priceNumber: 549,
   *   category: 'electronics'
   * });
   * 
   * // Example suggestion:
   * // {
   * //   program: 'best-buy-rewards',
   * //   earnedPoints: 822,
   * //   pointsNeeded: 180,
   * //   milestone: 'Free item at 500 points',
   * //   bonusMultiplier: 2,
   * //   bonusLabel: '2× points on electronics'
   * // }
   * 
   * @returns {Promise<Array>} Array of earning suggestions per program
   */
  getEarningPath: (item) => 
    ipcRenderer.invoke('get-earning-path', item),

  /**
   * Advanced Perk Engine - Check free-item eligibility
   * 
   * Determines if an item qualifies as free or discounted based on perks
   * 
   * @param {Object} item - Product information
   * @example
   * const eligibility = await window.api.checkFreeItemEligibility({
   *   title: 'Walmart Gift Card Purchase Item',
   *   source: 'Walmart',
   *   priceNumber: 19.99,
   *   category: 'household'
   * });
   * 
   * // Result:
   * // {
   * //   eligible: true,
   * //   eligibilities: [{
   * //     perk: 'Walmart Gift Card',
   * //     reason: 'Items under $25 are free-eligible with Walmart gift card',
   * //     eligiblePrice: 19.99
   * //   }],
   * //   totalEligibilities: 1
   * // }
   * 
   * @returns {Promise<Object>} { eligible, eligibilities: [], totalEligibilities }
   */
  checkFreeItemEligibility: (item) => 
    ipcRenderer.invoke('check-free-item-eligibility', item),

  /**
   * Account Benefits - Add account-based benefit
   * 
   * Examples:
   * - Uber Eats: $50 free after 700 purchases
   * - DoorDash: Free delivery on orders $15+
   * - Amazon Fresh: $100 credit after $500 spent
   * 
   * @param {Object} benefit - Benefit details
   * @example
   * await window.api.addAccountBenefit({
   *   name: 'Uber Eats Credit',
   *   amount: 50,
   *   currency: 'USD',
   *   requirement: 'After 700 purchases',
   *   progress: 650,
   *   progressType: 'purchases',
   *   total: 700,
   *   description: '$50 free after 700 purchases'
   * });
   * 
   * @returns {Promise<Object>} { success, message, benefits }
   */
  addAccountBenefit: (benefit) => 
    ipcRenderer.invoke('add-account-benefit', benefit),

  /**
   * Account Benefits - Update progress toward unlocking benefit
   * 
   * @param {string} benefitId - ID of benefit to update
   * @param {number} progress - Current progress value
   * @example
   * // User made 5 more purchases (670/700)
   * await window.api.updateAccountBenefitProgress('uber-eats-credit', 670);
   * 
   * @returns {Promise<Object>} { success, message, benefit }
   */
  updateAccountBenefitProgress: (benefitId, progress) => 
    ipcRenderer.invoke('update-account-benefit-progress', { benefitId, progress }),

  /**
   * Account Benefits - Get all account benefits
   * 
   * Retrieves account benefits including:
   * - All added benefits
   * - Available benefits (can use now)
   * - Almost unlocked benefits (close to available)
   * 
   * @example
   * const result = await window.api.getAccountBenefits();
   * console.log(result.availableBenefits); // Benefits ready to use
   * console.log(result.almostUnlocked);    // Benefits almost unlocked
   * 
   * @returns {Promise<Object>} { benefits, summary, availableBenefits, almostUnlocked }
   */
  getAccountBenefits: () => 
    ipcRenderer.invoke('get-account-benefits'),

  /**
   * Savings Analysis - Analyze single link for savings opportunities
   * 
   * Uses Gemini to identify how user can save money using their account benefits
   * Analyzes price, product category, and available benefits
   * 
   * @param {Object} link - Product link to analyze
   * @example
   * const result = await window.api.analyzeLinkForSavings({
   *   title: 'MacBook Pro 16"',
   *   price: 2499,
   *   source: 'amazon.com',
   *   category: 'electronics'
   * });
   * // Result shows: Uber Eats credit not applicable, but Amazon Prime eligible
   * 
   * @returns {Promise<Object>} { success, analysis }
   */
  analyzeLinkForSavings: (link) => 
    ipcRenderer.invoke('analyze-link-for-savings', { link }),

  /**
   * Savings Analysis - Analyze multiple links for savings
   * 
   * Parallel analysis of top 5 results to find savings opportunities
   * More efficient than analyzing links one at a time
   * 
   * @param {Array} links - Product links to analyze
   * @example
   * const result = await window.api.analyzeLinksForSavings(searchResults);
   * result.analyses.forEach(analysis => {
   *   console.log(`${analysis.link.title}: Save ${analysis.analysis.totalSavings}`);
   * });
   * 
   * @returns {Promise<Object>} { success, analyses: [] }
   */
  analyzeLinksForSavings: (links) => 
    ipcRenderer.invoke('analyze-links-for-savings', { links }),

  /**
   * Open URL in default browser
   * 
   * Opens any URL in the user's default browser, respecting their system settings
   * (Chrome, Edge, Firefox, Safari, etc.)
   * 
   * @param {string} url - The URL to open (with or without protocol)
   * @example
   * await window.api.openUrl('https://amazon.com');
   * await window.api.openUrl('amazon.com'); // Auto-adds https://
   * 
   * @returns {Promise<Object>} { success, error? }
   */
  openUrl: (url) => 
    ipcRenderer.invoke('open-url', url),

  // ============================================================================
  // SHOP DIRECTORY APIs - Access shops from SHOP_DIRECTORY.md
  // ============================================================================


});
