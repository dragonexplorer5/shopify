<!-- ============================================================================
     CLOUDFLARE WORKER INTEGRATION GUIDE
     ============================================================================
     
     This document explains how to deploy and integrate the new network layer
     with Cloudflare Workers and proxy rotation for the Shopify AI Assistant.
     
     ========================================================================== -->

# Cloudflare Workers Integration Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      ELECTRON APP (Main Process)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           main.js (Electron Main Process)                  │  │
│  │  - IPC Handler: "search-links" (original search)           │  │
│  │  - IPC Handler: "scan-shops" (NEW parallel scanning)       │  │
│  │  - IPC Handler: "health-check" (Worker status)             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                ↓                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  src/linkFinder.js (Node.js Backend Logic)                 │  │
│  │  - scanShopViaWorker(url) - single shop scan               │  │
│  │  - scanShopsViaWorker(urls[]) - batch parallel scanning    │  │
│  │  - Shop cooldown tracking (5 min after 3 failures)         │  │
│  │  - Failure count tracking per shop                         │  │
│  │  - IPC-safe error handling                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                ↓                                  │
└─────────────────────────────────────────────────────────────────┘
                                 ║
                       HTTPS API CALLS (CORS-enabled)
                                 ║
                    ┌────────────▼────────────┐
                    │  Cloudflare Workers     │
                    │  (Free Tier)            │
                    │                         │
                    │ cloudflare-worker.js    │
                    │ ✓ /scan (single)        │
                    │ ✓ /scan-batch (batch)   │
                    │ ✓ /health (status)      │
                    └────────────┬────────────┘
                                 ║
              ┌──────────────────┼──────────────────┐
              ║                  ║                  ║
         ┌────▼───┐         ┌────▼───┐        ┌────▼───┐
         │Proxy 1 │         │Proxy 2 │   ...  │Proxy40 │
         │ 40+    │         │Random  │        │Rotation│
         │Rotation│         │Select  │        │        │
         └────┬───┘         └────┬───┘        └────┬───┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 ║
                    ┌────────────▼────────────┐
                    │   Target Websites       │
                    │  (Amazon, eBay, etc)    │
                    │  via Random Proxy       │
                    │  ✓ Anti-ban stealth     │
                    │  ✓ Retry logic          │
                    │  ✓ Timeout protection   │
                    └────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│              RENDERER PROCESS (Browser/Preload)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ src/preload.js (IPC Bridge)                                │  │
│  │                                                             │  │
│  │ window.api.searchLinks(query) ──→ search-links IPC        │  │
│  │ window.api.scanShops(urls[]) ──→ scan-shops IPC (NEW)      │  │
│  │ window.api.healthCheck() ────→ health-check IPC (NEW)      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                ↑                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ src/app.js (Frontend Logic)                                │  │
│  │                                                             │  │
│  │ performSearch() - existing search functionality            │  │
│  │ performShopScan() - NEW parallel shop scanning (NEW)        │  │
│  │ displayScanResults() - display proxy info, timing (NEW)     │  │
│  │ checkWorkerHealth() - verify Worker status (NEW)            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                ↑                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ src/index.html (UI Components)                             │  │
│  │ - Search form (existing)                                   │  │
│  │ - Shop URLs input field (NEW)                              │  │
│  │ - Scan button (NEW)                                        │  │
│  │ - Health check button (NEW)                                │  │
│  │ - Results display (enhanced with proxy info)               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Steps

### Phase 1: Set Up Cloudflare Worker

1. **Create Cloudflare Account**
   - Go to https://dash.cloudflare.com/
   - Sign up (free tier available)
   - Verify email

2. **Create Worker**
   - Click "Workers & Pages" in left sidebar
   - Click "Create Application"
   - Click "Create a Worker"
   - Name it something like `shopify-ai-worker`
   - Click "Deploy"

3. **Deploy Worker Code**
   - In the Worker editor, replace everything with the code from `cloudflare-worker.js`
   - Click "Deploy"
   - Note your Worker URL: `https://<your-subdomain>.workers.dev`

4. **Test Worker**
   - Open the Worker URL in browser
   - You should see: `{"error":"Not found","endpoints":["/health","/scan","/scan-batch"]}`
   - Health check: `GET https://<your-subdomain>.workers.dev/health`
   - Should return: `{"status":"ok","timestamp":"...","proxies":40}`

### Phase 2: Configure Electron App

1. **Set Environment Variable**
   ```bash
   # Windows PowerShell
   $env:CLOUDFLARE_WORKER_URL="https://your-subdomain.workers.dev"
   
   # Or add to .env file (create in project root):
   CLOUDFLARE_WORKER_URL=https://your-subdomain.workers.dev
   ```

2. **Install Dependencies** (if not already installed)
   ```bash
   npm install axios @google/generative-ai cheerio
   ```

3. **File Changes Summary**
   - ✅ `src/linkFinder.js` - Completely rewritten with Cloudflare Worker integration
   - ✅ `main.js` - Added IPC handlers for scan-shops and health-check
   - ✅ `src/preload.js` - Added window.api.scanShops() and window.api.healthCheck()
   - ✅ `src/app.js` - Added performShopScan(), displayScanResults(), checkWorkerHealth()
   - 📄 `cloudflare-worker.js` - Deploy to Cloudflare
   - 📋 `INTEGRATION_GUIDE.md` - This file

### Phase 3: Update HTML UI (Add Shop Scan Controls)

Edit `src/index.html` and add these controls in the appropriate section:

```html
<!-- Add this new section after the search input -->
<div id="shopScanSection" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
  <h3>🛍️ Parallel Shop Scanner</h3>
  <p style="font-size: 12px; color: #666;">
    Scan multiple shops in parallel via Cloudflare Workers with proxy rotation
  </p>
  
  <div style="margin: 10px 0;">
    <label for="shopUrlsInput" style="display: block; margin-bottom: 5px; font-weight: bold;">
      Shop URLs (comma-separated):
    </label>
    <textarea
      id="shopUrlsInput"
      placeholder="https://shop1.com, https://shop2.com, https://shop3.com"
      style="width: 100%; height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 12px;"
    ></textarea>
  </div>

  <div style="display: flex; gap: 10px;">
    <button onclick="performShopScan()" style="flex: 1; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
      📊 Scan Shops
    </button>
    <button onclick="checkWorkerHealth()" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
      🟢 Check Worker
    </button>
  </div>
</div>
```

### Phase 4: Test the Integration

1. **Start the App**
   ```bash
   npm start
   ```

2. **Check Worker Health**
   - Click "Check Worker" button
   - Should show: `✅ Cloudflare Worker is operational | Status: ok | Proxies: 40`

3. **Perform a Shop Scan**
   - Paste shop URLs in the textarea
   - Click "Scan Shops"
   - Should show scan results with:
     - ✅ Successful/failed counts
     - 🌐 Proxy URLs used
     - ⏱️ Response times
     - 📅 Timestamps
     - Request attempt numbers

4. **Monitor Console**
   - Open DevTools (F12)
   - Check Console tab for detailed logs
   - Look for lines like: `[batch-1234567890] ✅ Scanned via proxy http://...`

## Features Explained

### 1. Proxy Rotation (40+ Proxies)
- **What**: Each scan request uses a randomly selected proxy from a pool of 40+ free proxies
- **Why**: Prevents IP-based blocking and bans
- **How**: Cloudflare Worker randomly selects from `PROXY_POOL` array

```javascript
// In cloudflare-worker.js
const proxy = getRandomItem(PROXY_POOL); // Random selection
```

### 2. Retry Logic (3 Attempts)
- **What**: If a request fails (403, 429, CAPTCHA, timeout), retry with a different proxy
- **Why**: Handles temporary blocks and detection
- **How**: Each retry selects a new proxy, excludes already-failed ones

```javascript
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  // Try with new proxy each time
}
```

### 3. Anti-Ban Features
- **Randomized User-Agents**: 6 different UA strings
- **Randomized Headers**: Each request has unique headers
- **Request Delays**: 50-150ms random delay before each request
- **Exponential Backoff**: Delays increase on retry (1.5x multiplier)
- **5-Min Cooldown**: After 3 consecutive failures, shop is cooldown for 5 minutes

```javascript
// Exponential backoff
const delay = baseDelay * Math.pow(1.5, attempt - 1);
```

### 4. Parallel Scanning
- **What**: Multiple shops scanned simultaneously (not sequentially)
- **Why**: Much faster than one-by-one
- **How**: Uses `Promise.allSettled()` for graceful partial failure handling

```javascript
// All shops scanned in parallel
const results = await Promise.allSettled(
  shopUrls.map(url => scanShop(url))
);
```

### 5. Monitoring & Logging
- **Request IDs**: Each request gets unique ID for tracking
- **ScanLogger**: Centralized logging with emojis and severity levels
- **Metrics**: Track proxy usage, response times, success rates
- **Console Output**: Detailed logs in console and Electron DevTools

```
[batch-1234-0] ℹ️  Starting scan: https://shop1.com
[batch-1234-0] ✅ Scanned via proxy http://103.14.98.54:8080 (2 attempt, 1234ms)
```

## Configuration

### Environment Variables

Create a `.env` file in project root or set system variables:

```env
# Required - Your deployed Cloudflare Worker URL
CLOUDFLARE_WORKER_URL=https://your-subdomain.workers.dev

# Optional - Gemini API Key (for search functionality)
GEMINI_API_KEY=your-gemini-api-key

# Optional - Custom timeout (in ms)
SCAN_TIMEOUT_MS=15000

# Optional - Shops list for testing
TEST_SHOPS="https://amazon.com,https://ebay.com,https://walmart.com"
```

### Worker Configuration

To add more proxies or customize behavior:

1. Edit `cloudflare-worker.js`
2. Modify `PROXY_POOL` array (add/remove proxies)
3. Modify `USER_AGENTS` array (add/remove user agents)
4. Modify delay ranges in `randomDelay()` function
5. Modify retry count in `scanShopWithRetry()` function
6. Re-deploy to Cloudflare

## API Documentation

### Window API (Preload.js)

#### `window.api.scanShops(shopUrls)`
Scan multiple shops in parallel via Cloudflare Worker.

**Parameters:**
- `shopUrls` (Array<string>): URLs to scan

**Returns:**
```javascript
{
  success: boolean,
  data: {
    batchId: string,              // Unique batch ID
    totalScans: number,           // Total shops to scan
    successfulScans: number,      // Successful scans
    failedScans: number,          // Failed scans
    results: Array<{
      success: boolean,
      shopUrl: string,
      html?: string,              // Raw HTML on success
      proxyUsed: string,          // Proxy used (e.g., http://1.2.3.4:8080)
      statusCode: number,         // HTTP status code
      responseTime: number,       // Time in milliseconds
      attempt: number,            // Attempt number (1-3)
      error?: string,             // Error message on failure
      timestamp: string           // ISO timestamp
    }>,
    responseTime: number,         // Total batch time in ms
    fallbackMode?: boolean        // If true, used individual retry
  },
  error?: string
}
```

**Example:**
```javascript
const result = await window.api.scanShops([
  'https://amazon.com/s?k=laptop',
  'https://ebay.com/sch/i.html?_nkw=laptop',
  'https://walmart.com/search?q=laptop'
]);

if (result.success) {
  console.log(`Scanned ${result.data.totalScans} shops`);
  console.log(`✅ ${result.data.successfulScans} successful`);
  console.log(`❌ ${result.data.failedScans} failed`);
  
  result.data.results.forEach(scan => {
    console.log(`${scan.shopUrl}: ${scan.proxyUsed} (${scan.responseTime}ms)`);
  });
}
```

#### `window.api.healthCheck()`
Check Cloudflare Worker status.

**Returns:**
```javascript
{
  success: boolean,
  data?: {
    workerStatus: string,        // "ok" if healthy
    timestamp: string,           // ISO timestamp
    proxies: number              // Number of proxies available
  },
  error?: string
}
```

### Cloudflare Worker Endpoints

#### `POST /scan`
Scan a single shop.

**Request:**
```json
{
  "shopUrl": "https://amazon.com",
  "requestId": "req-1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "html": "<html>...</html>",
  "proxyUsed": "http://103.14.98.54:8080",
  "statusCode": 200,
  "responseTime": 1234,
  "attempt": 1,
  "requestId": "req-1234567890",
  "timestamp": "2024-05-22T10:30:00.000Z"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Status 403 - Possible ban",
  "proxyUsed": "http://103.14.98.54:8080",
  "statusCode": 403,
  "responseTime": 1234,
  "attempt": 3,
  "requestId": "req-1234567890",
  "timestamp": "2024-05-22T10:30:00.000Z"
}
```

#### `POST /scan-batch`
Scan multiple shops in parallel.

**Request:**
```json
{
  "shops": [
    "https://amazon.com",
    "https://ebay.com",
    "https://walmart.com"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "total": 3,
  "successful": 2,
  "failed": 1,
  "results": [
    { "shopUrl": "https://amazon.com", "success": true, ... },
    { "shopUrl": "https://ebay.com", "success": false, ... }
  ]
}
```

#### `GET /health`
Check Worker health.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-05-22T10:30:00.000Z",
  "proxies": 40
}
```

## Troubleshooting

### Problem: "CLOUDFLARE_WORKER_URL is undefined"
**Solution**: Set the environment variable before starting the app:
```bash
$env:CLOUDFLARE_WORKER_URL="https://your-subdomain.workers.dev"
npm start
```

### Problem: "Cannot reach Cloudflare Worker"
**Solution**:
1. Verify Worker is deployed: `curl https://your-subdomain.workers.dev/health`
2. Check Worker URL is correct in environment
3. Verify Cloudflare account still active (free tier has 100,000 requests/day)
4. Check browser DevTools Network tab for request details

### Problem: "All scans failing with 403"
**Solution**:
1. Free proxies in pool may be offline - update `PROXY_POOL` in worker
2. Target website may have strong anti-bot protection
3. Try adding more user-agents to `USER_AGENTS` array
4. Increase `SHOP_COOLDOWN_MS` to allow longer recovery

### Problem: "Scan never completes (timeout)"
**Solution**:
1. Check network connectivity
2. Reduce number of shops in batch (start with 3-5)
3. Increase `TIMEOUT_MS` in linkFinder.js
4. Check if Cloudflare Workers service is operational

### Problem: "Proxy rotation not working"
**Solution**:
1. Verify proxies in `PROXY_POOL` are valid and online
2. Check CloudflareWorker logs for errors
3. Try test with known-good proxy first
4. Monitor console for proxy URLs being used

## Performance Tuning

### For Faster Scans
- Reduce `randomDelay()` min/max values (default 50-150ms)
- Increase concurrent requests (batch larger sets)
- Use premium proxies instead of free ones

### For Better Success Rate
- Increase `MAX_RETRIES` to 5 (default 3)
- Add more proxies to `PROXY_POOL`
- Increase `SHOP_COOLDOWN_MS` (default 5 min)
- Add more user-agents to `USER_AGENTS`

### For Production Use
- Replace free proxies with premium (Bright Data, Smartproxy, etc.)
- Implement Redis caching for cooldown tracking (currently in-memory)
- Add database logging for audit trail
- Implement rate limiting per IP
- Add CAPTCHA solver integration

## Security Notes

⚠️ **Important**: This system uses free proxies which:
- May be unreliable or offline
- Could be honeypots
- Have unknown data policies
- Should only be used for non-sensitive data

**Recommendations for Production**:
1. Use authenticated proxy services (Bright Data, Smartproxy, Oxylabs)
2. Implement IP rotation certificates
3. Add CAPTCHA solving (2Captcha, Anti-Captcha)
4. Rate-limit requests per domain
5. Add user-agent rotation with browser simulation
6. Use residential proxies for complex sites

## Support & Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **Worker Pricing**: Free tier = 100,000 requests/day
- **Proxy Services**: 
  - Bright Data: https://brightdata.com/
  - Smartproxy: https://smartproxy.com/
  - Oxylabs: https://oxylabs.io/

## Version History

- **v1.0.0** (2024-05-22) - Initial release
  - Cloudflare Worker with 40+ proxy pool
  - 3-attempt retry logic
  - Batch parallel scanning
  - Anti-ban features (randomization, delays, rotation)
  - Shop cooldown tracking
  - Real-time monitoring

## License

MIT License - See LICENSE file for details
