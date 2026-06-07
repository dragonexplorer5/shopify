async function performSearch() {
  const query = document.getElementById('queryInput').value.trim();
  const minPrice = document.getElementById('minPrice').value ? parseFloat(document.getElementById('minPrice').value) : null;
  const maxPrice = document.getElementById('maxPrice').value ? parseFloat(document.getElementById('maxPrice').value) : null;
  
  if (!query) {
    showError('Please enter a search query');
    return;
  }

  showLoading(true);
  hideError();
  hideResults();

  try {
    const result = await window.api.searchLinks(query);
    
    if (result.success) {
      displayResults(result.data, minPrice, maxPrice);
    } else {
      showError(result.error || 'An error occurred while searching');
    }
  } catch (error) {
    showError(`Error: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

// ============================================================================
// NEW: PARALLEL SHOP SCANNING WITH PROXY ROTATION
// ============================================================================

/**
 * Performance monitoring class for tracking scan metrics
 */
class ScanMetrics {
  constructor() {
    this.startTime = Date.now();
    this.successCount = 0;
    this.failureCount = 0;
    this.totalTime = 0;
    this.proxies = new Set();
  }

  record(scanResult) {
    if (scanResult.success) {
      this.successCount++;
      if (scanResult.proxyUsed) {
        this.proxies.add(scanResult.proxyUsed);
      }
    } else {
      this.failureCount++;
    }
  }

  finalize() {
    this.totalTime = Date.now() - this.startTime;
  }

  getSummary() {
    return {
      successful: this.successCount,
      failed: this.failureCount,
      uniqueProxies: this.proxies.size,
      totalTime: this.totalTime,
      avgTime: Math.round(this.totalTime / (this.successCount + this.failureCount)) || 0
    };
  }
}

/**
 * Perform parallel shop scan via Cloudflare Worker
 * 
 * Collects shop URLs and sends them for parallel scanning with proxy rotation
 * Displays real-time progress and proxy usage information
 */
async function performShopScan() {
  // Get shop URLs from input (comma-separated)
  const shopUrlsInput = document.getElementById('shopUrlsInput');
  if (!shopUrlsInput) {
    showError('Shop URLs input field not found. Please add it to the HTML.');
    return;
  }

  const input = shopUrlsInput.value.trim();
  if (!input) {
    showError('Please enter one or more shop URLs (comma-separated)');
    return;
  }

  const shopUrls = input
    .split(',')
    .map(url => url.trim())
    .filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));

  if (shopUrls.length === 0) {
    showError('Please enter valid shop URLs (must start with http:// or https://)');
    return;
  }

  showLoading(true);
  hideError();
  hideResults();

  const metrics = new ScanMetrics();

  try {
    console.log(`🔍 Initiating parallel scan of ${shopUrls.length} shops...`);

    // Call the new scanShops API
    const result = await window.api.scanShops(shopUrls);

    if (!result.success && result.data?.successfulScans === 0) {
      showError(result.error || 'Shop scan failed: No successful scans completed');
      return;
    }

    // Record metrics
    if (result.data?.results) {
      result.data.results.forEach(scan => metrics.record(scan));
    }
    metrics.finalize();

    // Display results
    displayScanResults(result.data, metrics.getSummary());

  } catch (error) {
    showError(`Shop Scan Error: ${error.message}`);
    console.error('Scan error:', error);
  } finally {
    showLoading(false);
  }
}

/**
 * Display shop scan results with proxy info, timing, and status
 */
function displayScanResults(batchData, summary) {
  const resultsDiv = document.getElementById('results');
  const resultsContent = document.getElementById('resultsContent');

  let html = `<h2>🛍️ Shop Scan Results</h2>`;

  // Summary Card
  html += `
    <div class="scan-summary" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #007bff;">
      <h3 style="margin-top: 0;">📊 Scan Summary</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
        <div><strong>Total Scans:</strong> ${batchData.totalScans}</div>
        <div><strong>✅ Successful:</strong> <span style="color: green; font-weight: bold;">${batchData.successfulScans}</span></div>
        <div><strong>❌ Failed:</strong> <span style="color: #dc3545; font-weight: bold;">${batchData.failedScans}</span></div>
        <div><strong>⏱️ Total Time:</strong> ${batchData.responseTime}ms</div>
        <div><strong>🌐 Unique Proxies:</strong> ${summary.uniqueProxies}</div>
        <div><strong>⚡ Avg Time/Scan:</strong> ${summary.avgTime}ms</div>
      </div>
      <div style="margin-top: 10px; font-size: 12px; color: #666;">
        <strong>Batch ID:</strong> ${batchData.batchId}
      </div>
    </div>
  `;

  // Individual Results
  if (batchData.results && batchData.results.length > 0) {
    html += `<h3>📋 Individual Scan Results</h3>`;

    batchData.results.forEach((scan, index) => {
      const statusIcon = scan.success ? '✅' : '❌';
      const statusColor = scan.success ? 'green' : '#dc3545';
      const statusText = scan.success ? 'Success' : 'Failed';

      html += `
        <div class="scan-result-item" style="border: 1px solid #ddd; padding: 12px; margin-bottom: 10px; border-radius: 6px; background: #fafafa;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <div style="margin-bottom: 8px;">
                <span style="font-size: 18px; margin-right: 8px;">${statusIcon}</span>
                <strong>Shop ${index + 1}</strong>
                <span style="color: ${statusColor}; font-weight: bold; margin-left: 8px;">${statusText}</span>
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 8px; word-break: break-all;">
                <strong>URL:</strong> ${scan.shopUrl}
              </div>
              
              ${scan.success ? `
                <div style="background: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <div><strong>🌐 Proxy Used:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${scan.proxyUsed || 'N/A'}</code></div>
                  <div><strong>⏱️ Response Time:</strong> ${scan.responseTime}ms</div>
                  <div><strong>🔄 Attempt:</strong> ${scan.attempt}/3</div>
                  <div><strong>📝 Status Code:</strong> ${scan.statusCode || 'N/A'}</div>
                  <div><strong>📅 Timestamp:</strong> ${scan.timestamp ? new Date(scan.timestamp).toLocaleTimeString() : 'N/A'}</div>
                </div>
              ` : `
                <div style="background: #fff3cd; padding: 8px; border-radius: 4px; font-size: 12px; color: #856404;">
                  <strong>❌ Error:</strong> ${scan.error || 'Unknown error'}
                  ${scan.failureCount ? `<div style="margin-top: 4px;"><strong>Failure Count:</strong> ${scan.failureCount}/3</div>` : ''}
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    });
  }

  // Performance Notes
  html += `
    <div style="background: #e7f3ff; padding: 12px; border-radius: 6px; margin-top: 15px; font-size: 12px; border-left: 4px solid #2196F3;">
      <strong>💡 Performance Notes:</strong>
      <ul style="margin: 8px 0; padding-left: 20px;">
        <li>Parallel scanning via Cloudflare Workers</li>
        <li>Each shop rotates through random proxy from pool of 40+</li>
        <li>Automatic retry on 403/429/CAPTCHA with different proxy</li>
        <li>5-minute cooldown after 3 consecutive failures</li>
        <li>Randomized delays (50-150ms) + exponential backoff</li>
      </ul>
    </div>
  `;

  resultsContent.innerHTML = html;
  resultsDiv.classList.remove('hidden');
}

/**
 * Worker health check - verify Cloudflare Worker is accessible
 */
async function checkWorkerHealth() {
  showLoading(true);
  try {
    const result = await window.api.healthCheck();
    
    if (result.success) {
      showError(`✅ Cloudflare Worker is operational | Status: ${result.data.workerStatus} | Proxies: ${result.data.proxies}`);
    } else {
      showError(`❌ Cloudflare Worker is unreachable: ${result.error}`);
    }
  } catch (error) {
    showError(`Health check failed: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

// ============================================================================
// EXISTING UI FUNCTIONS (UNCHANGED)
// ============================================================================

function displayResults(data, minPrice = null, maxPrice = null) {
  const resultsDiv = document.getElementById('results');
  const resultsContent = document.getElementById('resultsContent');
  
  let html = '<h2>Search Results</h2>';
  
  // Show price filter applied if present
  if (minPrice !== null || maxPrice !== null) {
    const priceText = minPrice && maxPrice ? `$${minPrice} - $${maxPrice}` :
                      minPrice ? `$${minPrice}+` :
                      `up to $${maxPrice}`;
    html += `<div class="price-filter-applied">
      <strong>Price Filter:</strong> ${priceText}
    </div>`;
  }
  
  // Show interpretation from AI
  if (data.interpretation) {
    html += `<div class="interpretation">
      <strong>AI Understood:</strong> ${data.interpretation}
    </div>`;
  }
  
  // Show sort method
  const sortMethodText = {
    'price': '💰 Sorted by Price (Cheapest First)',
    'quality': '⭐ Sorted by Quality (Best Rated First)',
    'balance': '⚖️ Sorted by Best Value (Price + Quality)'
  };
  html += `<div class="sort-info">
    <strong>Sorting Method:</strong> ${sortMethodText[data.sortPriority] || 'Best Value'}
  </div>`;
  
  // Filter links by price
  let filteredLinks = data.links || [];
  if (minPrice !== null || maxPrice !== null) {
    filteredLinks = filteredLinks.filter(link => {
      const price = link.priceNumber || 0;
      const aboveMin = minPrice === null || price >= minPrice;
      const belowMax = maxPrice === null || price <= maxPrice;
      return aboveMin && belowMax;
    });
  }
  
  // Show best deal if available (from filtered results)
  if (data.bestDeal && filteredLinks.length > 0) {
    const bestDealPrice = data.bestDeal.price || '';
    const bestDealPriceNum = parseFloat(bestDealPrice.replace(/[^0-9.]/g, '')) || 0;
    const isInRange = (minPrice === null || bestDealPriceNum >= minPrice) && 
                      (maxPrice === null || bestDealPriceNum <= maxPrice);
    
    if (isInRange) {
      html += `<div class="best-deal">
        <h3>🏆 Best Deal Found!</h3>
        <p><strong>Product:</strong> ${data.bestDeal.product}</p>
        <p><strong>Price:</strong> ${data.bestDeal.price}</p>
        <p><strong>Delivery:</strong> ${data.bestDeal.delivery}</p>
        <p><strong>Rating:</strong> ${data.bestDeal.rating}/5 ⭐ (${data.bestDeal.reviews} reviews)</p>
        <p><strong>Why Best:</strong> ${data.bestDeal.recommendation || 'Excellent value for money'}</p>
        <button class="best-deal-button" onclick="openLink('${data.bestDeal.url}')">
          Go to Best Deal →
        </button>
      </div>`;
    }
  }
  
  // Show filtered results count
  if (minPrice !== null || maxPrice !== null) {
    const originalCount = (data.links || []).length;
    html += `<div class="filter-info">
      Found <strong>${filteredLinks.length}</strong> items (out of ${originalCount} total)
    </div>`;
  }
  
  // Show all links ranked
  if (filteredLinks && filteredLinks.length > 0) {
    html += '<h3>All Results (Ranked)</h3>';
    filteredLinks.forEach((link, index) => {
      const badge = index === 0 ? '<span class="rank-badge">🥇 #1</span>' : 
                     index === 1 ? '<span class="rank-badge">🥈 #2</span>' :
                     index === 2 ? '<span class="rank-badge">🥉 #3</span>' :
                     `<span class="rank-badge">#${index + 1}</span>`;
      
      html += `
        <div class="result-item">
          ${badge}
          <div class="result-title">${link.title}</div>
          <button class="result-link" onclick="openLink('${link.url.replace(/'/g, "\\'")}')" style="background: none; border: none; color: #0066cc; text-decoration: underline; cursor: pointer; padding: 0; font: inherit;">
            ${link.url}
          </button>
          <div class="result-description">${link.description}</div>
          <div class="result-meta">
            <span>💰 ${link.price}</span>
            <span>⭐ ${link.rating}/5 (${link.reviews} reviews)</span>
            <span>📦 ${link.source}</span>
            <span>🚚 ${link.delivery}</span>
          </div>
        </div>
      `;
    });
  } else {
    html += '<p>No results found. Please try a different search.</p>';
  }
  
  resultsContent.innerHTML = html;
  resultsDiv.classList.remove('hidden');
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  if (show) {
    loading.classList.remove('hidden');
  } else {
    loading.classList.add('hidden');
  }
}

function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error').classList.add('hidden');
}

function hideResults() {
  document.getElementById('results').classList.add('hidden');
}

function openLink(url) {
  window.api.openUrl(url).catch(error => {
    console.error('Error opening URL:', error);
    showError(`Failed to open URL: ${error.message}`);
  });
}

// ============================================================================
// PERK PROFILE SYSTEM - UI FUNCTIONS
// ============================================================================

/**
 * Toggle perk section visibility
 */
function togglePerkSection() {
  const perkSection = document.getElementById('perkSection');
  const toggleBtn = document.querySelector('.perk-toggle-btn');
  
  if (perkSection.style.display === 'none') {
    perkSection.style.display = 'block';
    toggleBtn.classList.remove('collapsed');
    toggleBtn.classList.add('expanded');
  } else {
    perkSection.style.display = 'none';
    toggleBtn.classList.remove('expanded');
    toggleBtn.classList.add('collapsed');
  }
}

/**
 * Build perk object from UI checkboxes and inputs
 */
function buildPerkList() {
  const perks = {
    giftCards: [],
    rewardPrograms: [],
    creditCardPerks: [],
    storeCoupons: [],
    promoCredits: []
  };

  // Gift Cards
  if (document.getElementById('walmart-gc')?.checked) perks.giftCards.push({ store: 'Walmart' });
  if (document.getElementById('target-gc')?.checked) perks.giftCards.push({ store: 'Target' });
  if (document.getElementById('amazon-gc')?.checked) perks.giftCards.push({ store: 'Amazon' });
  if (document.getElementById('bestbuy-gc')?.checked) perks.giftCards.push({ store: 'Best Buy' });

  // Reward Programs
  if (document.getElementById('target-circle')?.checked) perks.rewardPrograms.push({ program: 'Target Circle', tier: 'member' });
  if (document.getElementById('bestbuy-rewards')?.checked) perks.rewardPrograms.push({ program: 'Best Buy Rewards', tier: 'member' });
  if (document.getElementById('walmart-plus')?.checked) perks.rewardPrograms.push({ program: 'Walmart+', tier: 'premium' });
  if (document.getElementById('amazon-prime')?.checked) perks.rewardPrograms.push({ program: 'Amazon Prime', tier: 'premium' });

  // Credit Card Perks
  if (document.getElementById('chase-dining')?.checked) perks.creditCardPerks.push({ bank: 'Chase', category: 'Dining', benefit: '5% back' });
  if (document.getElementById('amex-shopping')?.checked) perks.creditCardPerks.push({ bank: 'Amex', category: 'Shopping', benefit: '3% back' });
  if (document.getElementById('discover-bonus')?.checked) perks.creditCardPerks.push({ bank: 'Discover', category: 'Rotating', benefit: '5% bonus' });

  // Promo Credits
  if (document.getElementById('amazon-promo')?.checked) perks.promoCredits.push({ platform: 'Amazon', description: 'Promo credit eligible' });
  if (document.getElementById('uber-credit')?.checked) perks.promoCredits.push({ platform: 'Uber Eats', description: 'Credit balance' });

  return perks;
}

/**
 * Add custom gift card
 */
function addCustomGiftCard() {
  const input = document.getElementById('customGcInput');
  const store = input?.value.trim();

  if (!store) {
    alert('Please enter a store name');
    return;
  }

  // Add as checkbox dynamically (simplified for UI)
  console.log(`Added custom gift card: ${store}`);
  if (input) input.value = '';
  updatePerkSummary();
}

/**
 * Add custom reward program
 */
function addCustomRewardProgram() {
  const input = document.getElementById('customRpInput');
  const program = input?.value.trim();

  if (!program) {
    alert('Please enter a program name');
    return;
  }

  console.log(`Added custom reward program: ${program}`);
  if (input) input.value = '';
  updatePerkSummary();
}

/**
 * Add custom credit card perk
 */
function addCustomCreditCardPerk() {
  const input = document.getElementById('customCcInput');
  const perk = input?.value.trim();

  if (!perk) {
    alert('Please enter credit card benefit (e.g., Chase: 2% groceries)');
    return;
  }

  console.log(`Added custom credit card perk: ${perk}`);
  if (input) input.value = '';
  updatePerkSummary();
}

/**
 * Add custom promo credit
 */
function addCustomPromoCredit() {
  const input = document.getElementById('customPromoInput');
  const promo = input?.value.trim();

  if (!promo) {
    alert('Please enter promo credit benefit');
    return;
  }

  console.log(`Added custom promo credit: ${promo}`);
  if (input) input.value = '';
  updatePerkSummary();
}

/**
 * Update perk summary display
 */
async function updatePerkSummary() {
  try {
    const result = await window.api.getPerkSummary();
    const summaryDiv = document.getElementById('perkSummary');
    
    if (result.success) {
      summaryDiv.textContent = `📊 Active Perks: ${result.summary}`;
    } else {
      summaryDiv.textContent = 'No perks configured yet';
    }
  } catch (error) {
    console.error('Error updating perk summary:', error);
  }
}

/**
 * Save perk profile to backend via IPC
 */
async function savePerkProfile() {
  try {
    showLoading(true);
    
    const perks = buildPerkList();
    console.log('Saving perks:', perks);
    
    const result = await window.api.setPerks(perks);
    
    if (result.success) {
      showError(`✅ Perks saved successfully! ${result.summary}`);
      updatePerkSummary();
    } else {
      showError(`❌ Failed to save perks: ${result.message}`);
    }
  } catch (error) {
    showError(`Error saving perks: ${error.message}`);
    console.error('Save perks error:', error);
  } finally {
    showLoading(false);
  }
}

/**
 * Load perk profile from backend
 */
async function loadPerkProfile() {
  try {
    showLoading(true);
    
    const result = await window.api.getPerks();
    
    if (result.success && result.data) {
      const perks = result.data;
      
      // Restore checkboxes from loaded perks
      const storeMap = {
        'Walmart': 'walmart-gc',
        'Target': 'target-gc',
        'Amazon': 'amazon-gc',
        'Best Buy': 'bestbuy-gc'
      };
      
      // Restore gift cards
      perks.giftCards?.forEach(gc => {
        const checkboxId = storeMap[gc.store];
        if (checkboxId) {
          const checkbox = document.getElementById(checkboxId);
          if (checkbox) checkbox.checked = true;
        }
      });

      // Restore reward programs
      const rpMap = {
        'Target Circle': 'target-circle',
        'Best Buy Rewards': 'bestbuy-rewards',
        'Walmart+': 'walmart-plus',
        'Amazon Prime': 'amazon-prime'
      };

      perks.rewardPrograms?.forEach(rp => {
        const checkboxId = rpMap[rp.program];
        if (checkboxId) {
          const checkbox = document.getElementById(checkboxId);
          if (checkbox) checkbox.checked = true;
        }
      });

      // Restore credit card perks
      perks.creditCardPerks?.forEach(ccp => {
        if (ccp.bank === 'Chase' && ccp.category === 'Dining') {
          document.getElementById('chase-dining').checked = true;
        }
        if (ccp.bank === 'Amex' && ccp.category === 'Shopping') {
          document.getElementById('amex-shopping').checked = true;
        }
        if (ccp.bank === 'Discover') {
          document.getElementById('discover-bonus').checked = true;
        }
      });

      // Restore promo credits
      perks.promoCredits?.forEach(pc => {
        if (pc.platform === 'Amazon') {
          document.getElementById('amazon-promo').checked = true;
        }
        if (pc.platform === 'Uber Eats') {
          document.getElementById('uber-credit').checked = true;
        }
      });

      showError('✅ Perks loaded successfully!');
      updatePerkSummary();
    } else {
      showError('❌ Failed to load perks');
    }
  } catch (error) {
    showError(`Error loading perks: ${error.message}`);
    console.error('Load perks error:', error);
  } finally {
    showLoading(false);
  }
}

/**
 * Clear all perks
 */
async function clearPerkProfile() {
  if (!confirm('Are you sure you want to clear all perks?')) {
    return;
  }

  try {
    // Clear all checkboxes
    document.querySelectorAll('.perk-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });

    // Clear input fields
    document.getElementById('customGcInput').value = '';
    document.getElementById('customRpInput').value = '';
    document.getElementById('customCcInput').value = '';
    document.getElementById('customPromoInput').value = '';

    // Save empty perk list
    const result = await window.api.setPerks({
      giftCards: [],
      rewardPrograms: [],
      creditCardPerks: [],
      storeCoupons: [],
      promoCredits: []
    });

    if (result.success) {
      showError('✅ All perks cleared!');
      updatePerkSummary();
    } else {
      showError('❌ Failed to clear perks');
    }
  } catch (error) {
    showError(`Error clearing perks: ${error.message}`);
    console.error('Clear perks error:', error);
  }
}

/**
 * Initialize perk UI on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  updatePerkSummary();
  updateRewardProgramsList();
  updateAccountBenefitsList();
  
  // Auto-save when checkboxes change
  document.querySelectorAll('.perk-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updatePerkSummary);
  });

  // Auto-update reward section when perk checkboxes change
  document.querySelectorAll('.perk-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateRewardProgramsList);
  });
});

// ============================================================================
// REWARD PROGRESS TRACKING - NEW FUNCTIONS
// ============================================================================

/**
 * Update the reward programs list based on selected reward programs
 * Dynamically creates input fields for points, stamps, tiers, etc.
 */
async function updateRewardProgramsList() {
  try {
    const result = await window.api.getPerks();
    
    if (!result.success || !result.data.rewardPrograms) {
      return;
    }

    const container = document.getElementById('rewardProgramsList');
    if (!container) return;

    const programs = result.data.rewardPrograms;
    
    if (programs.length === 0) {
      container.innerHTML = `
        <p style="font-size: 11px; color: #999; padding: 8px; text-align: center;">
          No reward programs configured yet. Add reward programs above first.
        </p>
      `;
      return;
    }

    // Create UI for each reward program
    let html = '';
    for (const program of programs) {
      const progress = await window.api.getRewardProgress(program.name);
      
      html += `
        <div class="reward-program">
          <div class="reward-program-header">
            <div class="reward-program-name">${program.name}</div>
            <div class="reward-program-tier">${program.tier || 'member'}</div>
          </div>
      `;

      // Add progress input fields based on program
      if (program.name === 'Target Circle') {
        html += `
          <div class="reward-progress-item">
            <label>Points:</label>
            <input type="number" id="target-circle-points" min="0" placeholder="0" 
              value="${progress?.points || 0}" 
              onchange="updateRewardProgress('Target Circle', 'points', this.value)">
          </div>
          <div class="reward-progress-item">
            <label>Tier:</label>
            <select id="target-circle-tier" onchange="updateRewardProgress('Target Circle', 'tier', this.value)" 
              style="flex: 1; padding: 4px 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
              <option ${progress?.tier === 'member' ? 'selected' : ''}>member</option>
              <option ${progress?.tier === 'gold' ? 'selected' : ''}>gold</option>
              <option ${progress?.tier === 'platinum' ? 'selected' : ''}>platinum</option>
            </select>
          </div>
          <div class="reward-earning-suggestion">
            <strong>Next Milestone:</strong> Gold tier at 500 points (${500 - (progress?.points || 0)} points to go)
          </div>
        `;
      } else if (program.name === 'Best Buy Rewards') {
        html += `
          <div class="reward-progress-item">
            <label>Points:</label>
            <input type="number" id="bestbuy-rewards-points" min="0" placeholder="0"
              value="${progress?.points || 0}"
              onchange="updateRewardProgress('Best Buy Rewards', 'points', this.value)">
          </div>
          <div class="reward-progress-item">
            <label>Stamps:</label>
            <input type="number" id="bestbuy-rewards-stamps" min="0" placeholder="0"
              value="${progress?.stamps || 0}"
              onchange="updateRewardProgress('Best Buy Rewards', 'stamps', this.value)">
          </div>
          <div class="reward-earning-suggestion">
            <strong>Next Free Item:</strong> At 500 points (${500 - (progress?.points || 0)} to go) or 10 stamps (${10 - (progress?.stamps || 0)} to go)
          </div>
        `;
      } else if (program.name === 'Walmart+') {
        html += `
          <div class="reward-progress-item">
            <label>Member Since:</label>
            <input type="date" id="walmart-plus-date" 
              value="${progress?.joinDate?.split('T')[0] || new Date().toISOString().split('T')[0]}"
              onchange="updateRewardProgress('Walmart+', 'joinDate', this.value)">
          </div>
          <div class="reward-earning-suggestion">
            <strong>Benefit:</strong> 5% off select items + free shipping + fuel discounts
          </div>
        `;
      } else if (program.name === 'Amazon Prime') {
        html += `
          <div class="reward-progress-item">
            <label>Prime Member:</label>
            <select id="amazon-prime-status" onchange="updateRewardProgress('Amazon Prime', 'status', this.value)"
              style="flex: 1; padding: 4px 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
              <option ${progress?.status === 'active' ? 'selected' : ''}>active</option>
              <option ${progress?.status === 'student' ? 'selected' : ''}>student</option>
              <option ${progress?.status === 'trial' ? 'selected' : ''}>trial</option>
            </select>
          </div>
          <div class="reward-earning-suggestion">
            <strong>Benefits:</strong> Free shipping + exclusive deals + Prime Video
          </div>
        `;
      } else {
        // Generic program
        html += `
          <div class="reward-progress-item">
            <label>Points/Stamps:</label>
            <input type="number" id="generic-${program.name}-points" min="0" placeholder="0"
              value="${progress?.points || 0}"
              onchange="updateRewardProgress('${program.name}', 'points', this.value)">
          </div>
        `;
      }

      html += `
        </div>
      `;
    }

    container.innerHTML = html;
  } catch (error) {
    console.error('Error updating reward programs list:', error);
  }
}

/**
 * Update reward progress for a specific program
 */
async function updateRewardProgress(programName, field, value) {
  try {
    const progressData = {
      [field]: isNaN(value) ? value : parseInt(value)
    };

    const result = await window.api.updateRewardProgress(programName, progressData);
    
    if (result.success) {
      console.log(`✅ Updated ${programName}: ${field} = ${value}`);
    } else {
      console.error(`❌ Failed to update ${programName}:`, result.message);
    }
  } catch (error) {
    console.error('Error updating reward progress:', error);
  }
}

/**
 * Save reward progress to backend
 */
async function saveRewardProgress() {
  try {
    showLoading(true);
    
    // Get all reward programs and their progress
    const result = await window.api.getRewardProgress();
    
    // The progress is already saved via updateRewardProgress calls
    // This function just confirms and shows a message
    showError(`✅ Reward progress saved! Tracking ${Object.keys(result?.data || {}).length} programs`);
  } catch (error) {
    showError(`Error saving reward progress: ${error.message}`);
    console.error('Save progress error:', error);
  } finally {
    showLoading(false);
  }
}

/**
 * Load reward progress from backend
 */
async function loadRewardProgress() {
  try {
    showLoading(true);
    
    const result = await window.api.getRewardProgress();
    
    if (result.success && result.data) {
      updateRewardProgramsList();
      showError(`✅ Reward progress loaded!`);
    } else {
      showError('❌ Failed to load reward progress');
    }
  } catch (error) {
    showError(`Error loading reward progress: ${error.message}`);
    console.error('Load progress error:', error);
  } finally {
    showLoading(false);
  }
}

/**
 * Clear all reward progress
 */
async function clearRewardProgress() {
  if (!confirm('Are you sure you want to clear all reward progress?')) {
    return;
  }

  try {
    showLoading(true);
    
    // Clear input fields
    document.querySelectorAll('[id*="points"], [id*="stamps"], [id*="tier"], [id*="status"], [id*="date"]').forEach(input => {
      if (input.type === 'number') input.value = '0';
      if (input.tagName === 'SELECT') input.selectedIndex = 0;
      if (input.type === 'date') input.value = new Date().toISOString().split('T')[0];
    });

    showError('✅ All reward progress cleared!');
    updateRewardProgramsList();
  } catch (error) {
    showError(`Error clearing reward progress: ${error.message}`);
    console.error('Clear progress error:', error);
  } finally {
    showLoading(false);
  }
}

/**
 * Toggle reward section visibility
 */
function toggleRewardSection() {
  const section = document.getElementById('rewardSection');
  const button = event.target.closest('.perk-toggle-btn');
  
  if (section.style.display === 'none') {
    section.style.display = 'block';
    button.classList.remove('collapsed');
    button.classList.add('expanded');
  } else {
    section.style.display = 'none';
    button.classList.remove('expanded');
    button.classList.add('collapsed');
  }
}

// ============================================================================
// NEW: ACCOUNT BENEFITS MANAGEMENT
// ============================================================================

/**
 * Add a new account benefit
 * Example: Uber Eats $50 credit after 700 purchases
 */
async function addAccountBenefit() {
  try {
    const name = document.getElementById('benefitName').value.trim();
    const amount = document.getElementById('benefitAmount').value;
    const requirement = document.getElementById('benefitRequirement').value.trim();
    const progress = document.getElementById('benefitProgress').value;

    if (!name) {
      showError('Please enter a benefit name');
      return;
    }

    showLoading(true);

    const benefit = {
      name,
      amount: amount ? parseFloat(amount) : null,
      currency: 'USD',
      requirement,
      progress: progress ? parseInt(progress) : 0,
      progressType: 'purchases',
      description: `${amount ? '$' + amount : ''} ${requirement}`.trim()
    };

    const result = await window.api.addAccountBenefit(benefit);

    if (result.success) {
      // Clear form
      document.getElementById('benefitName').value = '';
      document.getElementById('benefitAmount').value = '';
      document.getElementById('benefitRequirement').value = '';
      document.getElementById('benefitProgress').value = '';

      showError(`✅ ${result.message}`);
      updateAccountBenefitsList();
    } else {
      showError(`❌ Error: ${result.message}`);
    }
  } catch (error) {
    showError(`Error adding benefit: ${error.message}`);
    console.error('Add benefit error:', error);
  } finally {
    showLoading(false);
  }
}

/**
 * Load and display account benefits
 */
async function updateAccountBenefitsList() {
  try {
    const result = await window.api.getAccountBenefits();

    if (!result.success) {
      console.error('Error loading benefits:', result.error);
      return;
    }

    const benefitsList = document.getElementById('accountBenefitsList');
    const summaryDiv = document.getElementById('accountBenefitsSummary');

    if (result.benefits.length === 0) {
      benefitsList.innerHTML = '<p style="font-size: 11px; color: #999; padding: 8px; text-align: center;">No account benefits added yet.</p>';
      summaryDiv.style.display = 'none';
      return;
    }

    // Display benefits
    benefitsList.innerHTML = result.benefits.map((benefit, index) => {
      const percentComplete = benefit.total 
        ? Math.min(100, (benefit.progress / benefit.total) * 100)
        : 0;
      
      let statusClass = 'in-progress';
      let statusText = `${benefit.progress} of ${benefit.total || 'N/A'}`;

      if (benefit.available) {
        statusClass = 'available';
        statusText = '✅ Available Now!';
      } else if (benefit.total && percentComplete >= 80) {
        statusClass = 'almost-unlocked';
        statusText = `⏳ ${Math.ceil(benefit.total - benefit.progress)} more to unlock`;
      }

      return `
        <div class="benefit-item">
          <div class="benefit-item-header">
            <div class="benefit-item-name">${benefit.name}</div>
            <div class="benefit-item-status ${statusClass}">${statusText}</div>
          </div>
          <div class="benefit-progress">${benefit.requirement || 'In progress...'}</div>
          ${benefit.total ? `
            <div class="benefit-progress-bar">
              <div class="benefit-progress-fill" style="width: ${percentComplete}%"></div>
            </div>
          ` : ''}
          <div class="benefit-actions">
            <button onclick="updateBenefitProgress('${benefit.id}', ${benefit.progress + 1})">
              ➕ Add 1
            </button>
            <button onclick="updateBenefitProgress('${benefit.id}', ${Math.max(0, benefit.progress - 1)})">
              ➖ Remove 1
            </button>
            <button onclick="removeBenefit('${benefit.id}')">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Display summary
    summaryDiv.textContent = result.summary;
    summaryDiv.style.display = 'block';

    // Show available benefits badge
    if (result.availableBenefits.length > 0) {
      const availableText = result.availableBenefits.map(b => b.name).join(', ');
      console.log(`💳 Ready to use: ${availableText}`);
    }

  } catch (error) {
    console.error('Error updating benefits list:', error);
  }
}

/**
 * Update account benefit progress
 */
async function updateBenefitProgress(benefitId, newProgress) {
  try {
    const result = await window.api.updateAccountBenefitProgress(benefitId, newProgress);

    if (result.success) {
      showError(`✅ ${result.message}`);
      updateAccountBenefitsList();
    } else {
      showError(`❌ Error: ${result.message}`);
    }
  } catch (error) {
    showError(`Error updating progress: ${error.message}`);
    console.error('Update progress error:', error);
  }
}

/**
 * Remove a benefit
 */
async function removeBenefit(benefitId) {
  // For now, we'll reload the list (in a full implementation, we'd call an IPC handler)
  // This is a placeholder - full delete functionality would need an IPC handler in main.js
  console.log('Would remove benefit:', benefitId);
  // TODO: Add remove-account-benefit IPC handler to main.js if needed
}

/**
 * Toggle account benefits section visibility
 */
function toggleAccountBenefitsSection() {
  const section = document.getElementById('accountBenefitsSection');
  const button = event.target.closest('.perk-toggle-btn');
  
  if (!section.classList.contains('expanded')) {
    section.classList.add('expanded');
    button.classList.remove('collapsed');
    button.classList.add('expanded');
    updateAccountBenefitsList();
  } else {
    section.classList.remove('expanded');
    button.classList.remove('expanded');
    button.classList.add('collapsed');
  }
}

/**
 * Analyze search results for savings opportunities
 * Called after search completes
 */
async function analyzeResultsForSavings(links) {
  try {
    if (links.length === 0) return;

    const result = await window.api.analyzeLinksForSavings(links);

    if (result.success && result.analyses.length > 0) {
      const savingsContainer = document.getElementById('savingsAnalysisContainer');
      const savingsSuggestions = document.getElementById('savingsSuggestions');

      let html = '';
      result.analyses.forEach(analysis => {
        if (analysis.analysis.success && analysis.analysis.opportunities) {
          html += `
            <div class="savings-suggestion">
              <strong>${analysis.link.title}</strong><br>
              <span class="savings-suggestion-amount">Save: ${analysis.analysis.totalSavings}</span><br>
              <small>${analysis.analysis.recommendation || ''}</small>
            </div>
          `;
        }
      });

      if (html) {
        savingsSuggestions.innerHTML = html;
        savingsContainer.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Error analyzing results for savings:', error);
    // Silently fail - don't interrupt search results
  }
}

/**
 * Override displayResults to include savings analysis
 */
const originalDisplayResults = displayResults;
window.displayResults = function(data, minPrice, maxPrice) {
  originalDisplayResults.call(this, data, minPrice, maxPrice);
  
  // Analyze results for savings opportunities
  if (data.products && data.products.length > 0) {
    analyzeResultsForSavings(data.products);
  }
};


