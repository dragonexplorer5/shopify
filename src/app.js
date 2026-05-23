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
          <a href="${link.url}" class="result-link" target="_blank">${link.url}</a>
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
  window.open(url, '_blank');
}
