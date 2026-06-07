#!/usr/bin/env bash
# ============================================================================
# QUICK-START DEPLOYMENT GUIDE
# ============================================================================
# 
# This script provides step-by-step instructions to deploy the Cloudflare
# Worker and integrate it with the Electron app.
#
# Usage: Read through this file and follow each section
#

# ============================================================================
# STEP 1: DEPLOY CLOUDFLARE WORKER
# ============================================================================
echo "
╔════════════════════════════════════════════════════════════════╗
║ STEP 1: Deploy Cloudflare Worker                              ║
╚════════════════════════════════════════════════════════════════╝

1. Open https://dash.cloudflare.com/
2. Sign up (free tier available)
3. Go to 'Workers & Pages' → 'Create Application' → 'Create a Worker'
4. Name it: 'shopify-ai-worker'
5. In the editor, replace all code with cloudflare-worker.js content
6. Click 'Deploy'
7. Note your Worker URL: https://<your-subdomain>.workers.dev

📝 Save this URL - you'll need it in the next step!
"

# ============================================================================
# STEP 2: VERIFY WORKER DEPLOYMENT
# ============================================================================
echo "
╔════════════════════════════════════════════════════════════════╗
║ STEP 2: Verify Worker Deployment                              ║
╚════════════════════════════════════════════════════════════════╝

Test your Worker health endpoint:
curl https://<your-subdomain>.workers.dev/health

Expected response:
{
  \"status\": \"ok\",
  \"timestamp\": \"2024-05-22T10:30:00.000Z\",
  \"proxies\": 40
}

If you see 404, the Worker endpoint doesn't exist yet.
If you see connection error, check your URL is correct.
"

# ============================================================================
# STEP 3: SET ENVIRONMENT VARIABLE
# ============================================================================
echo "
╔════════════════════════════════════════════════════════════════╗
║ STEP 3: Configure Electron App                                ║
╚════════════════════════════════════════════════════════════════╝

Set the Cloudflare Worker URL environment variable:

📌 Windows PowerShell:
   \$env:CLOUDFLARE_WORKER_URL=\"https://<your-subdomain>.workers.dev\"
   npm start

📌 Windows CMD:
   set CLOUDFLARE_WORKER_URL=https://<your-subdomain>.workers.dev
   npm start

📌 Linux/Mac:
   export CLOUDFLARE_WORKER_URL=\"https://<your-subdomain>.workers.dev\"
   npm start

OR create .env file in project root:
   CLOUDFLARE_WORKER_URL=https://<your-subdomain>.workers.dev
   npm start
"

# ============================================================================
# STEP 4: UPDATE HTML UI
# ============================================================================
echo "
╔════════════════════════════════════════════════════════════════╗
║ STEP 4: Add Shop Scanner UI (Optional but Recommended)        ║
╚════════════════════════════════════════════════════════════════╝

Edit src/index.html and add this section after the search form:

<!-- Shop Scanner Section -->
<div id=\"shopScanSection\" style=\"margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;\">
  <h3>🛍️ Parallel Shop Scanner</h3>
  <p style=\"font-size: 12px; color: #666;\">
    Scan multiple shops in parallel via Cloudflare Workers with proxy rotation
  </p>
  
  <div style=\"margin: 10px 0;\">
    <label for=\"shopUrlsInput\" style=\"display: block; margin-bottom: 5px; font-weight: bold;\">
      Shop URLs (comma-separated):
    </label>
    <textarea
      id=\"shopUrlsInput\"
      placeholder=\"https://shop1.com, https://shop2.com, https://shop3.com\"
      style=\"width: 100%; height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 12px;\"
    ></textarea>
  </div>

  <div style=\"display: flex; gap: 10px;\">
    <button onclick=\"performShopScan()\" style=\"flex: 1; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;\">
      📊 Scan Shops
    </button>
    <button onclick=\"checkWorkerHealth()\" style=\"flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;\">
      🟢 Check Worker
    </button>
  </div>
</div>
"

# ============================================================================
# STEP 5: TEST THE INTEGRATION
# ============================================================================
echo "
╔════════════════════════════════════════════════════════════════╗
║ STEP 5: Test the Integration                                  ║
╚════════════════════════════════════════════════════════════════╝

1. Start the app with environment variable set:
   \$env:CLOUDFLARE_WORKER_URL=\"https://<your-subdomain>.workers.dev\"
   npm start

2. Click '🟢 Check Worker' button
   Expected: ✅ Cloudflare Worker is operational

3. Enter shop URLs in the Shop Scanner textarea:
   https://amazon.com/s?k=laptop
   https://ebay.com/sch/i.html?_nkw=laptop

4. Click '📊 Scan Shops' button
   Watch the results appear with proxy info!

5. Check DevTools (F12) → Console for logs:
   [batch-1234] ✅ Scanned via proxy http://...
"

# ============================================================================
# STEP 6: VERIFY FILES ARE UPDATED
# ============================================================================
echo "
╔════════════════════════════════════════════════════════════════╗
║ STEP 6: Verify All Files Updated                              ║
╚════════════════════════════════════════════════════════════════╝

Check these files were modified:
✓ src/linkFinder.js - NEW functions scanShopsViaWorker, scanShopViaWorker
✓ main.js - NEW IPC handlers for scan-shops, health-check
✓ src/preload.js - NEW APIs window.api.scanShops(), window.api.healthCheck()
✓ src/app.js - NEW functions performShopScan, displayScanResults, checkWorkerHealth
✓ cloudflare-worker.js - Full worker code (deploy to Cloudflare)

Check using:
grep -n 'scanShopsViaWorker' src/linkFinder.js
grep -n 'scan-shops' main.js
grep -n 'scanShops' src/preload.js
grep -n 'performShopScan' src/app.js
"

# ============================================================================
# FEATURES SUMMARY
# ============================================================================
echo "
╔════════════════════════════════════════════════════════════════╗
║ ✅ DEPLOYED FEATURES                                           ║
╚════════════════════════════════════════════════════════════════╝

🚀 Parallel Shop Scanning
   - Multiple shops scanned simultaneously (not one-by-one)
   - Uses Promise.allSettled() for graceful failure handling

🌐 Proxy Rotation
   - 40+ free proxies randomly selected for each request
   - Different proxy for each retry (up to 3 attempts)

🔄 Smart Retry Logic
   - Automatic retry on 403 Forbidden
   - Automatic retry on 429 Rate Limit
   - Automatic retry on CAPTCHA detection
   - Automatic retry on timeout (10 seconds)
   - Each retry uses a different proxy

⏱️ Performance Tracking
   - Response time per shop (in milliseconds)
   - Request attempt number (1-3)
   - HTTP status codes
   - Proxy URLs logged
   - Batch ID for correlation

🛡️ Anti-Ban Features
   - Randomized User-Agent headers (6 different browsers)
   - Randomized HTTP headers
   - Request delays: 50-150ms random
   - Exponential backoff: Delay increases on retry
   - 5-minute cooldown after 3 consecutive failures

❄️ Cooldown Tracking
   - Per-shop failure counter
   - 5-minute cooldown after 3 failures
   - Prevents continuous spam/bans

📊 Monitoring & Logging
   - Structured logging with request IDs
   - Success/failure tracking
   - Real-time UI feedback
   - Console logs for debugging

🟢 Health Checks
   - Check Worker status anytime
   - Returns proxy pool size
   - Detects Worker downtime
"

# ============================================================================
# TROUBLESHOOTING
# ============================================================================
echo "
╔════════════════════════════════════════════════════════════════╗
║ 🔧 TROUBLESHOOTING                                             ║
╚════════════════════════════════════════════════════════════════╝

Problem: 'CLOUDFLARE_WORKER_URL is undefined'
→ Set env var: \$env:CLOUDFLARE_WORKER_URL=\"https://...\"

Problem: 'Cannot reach Cloudflare Worker'
→ Test: curl https://<your-subdomain>.workers.dev/health
→ Check URL is correct in environment variable

Problem: 'All scans failing'
→ Free proxies may be offline
→ Update PROXY_POOL array in cloudflare-worker.js
→ Check console for specific error messages

Problem: 'Timeout errors'
→ Increase TIMEOUT_MS in src/linkFinder.js
→ Try scanning fewer shops
→ Check network connectivity

For detailed help, see: INTEGRATION_GUIDE.md
"

# ============================================================================
# NEXT STEPS
# ============================================================================
echo "
╔════════════════════════════════════════════════════════════════╗
║ 📋 NEXT STEPS                                                  ║
╚════════════════════════════════════════════════════════════════╝

1. Deploy cloudflare-worker.js to Cloudflare Workers
2. Set CLOUDFLARE_WORKER_URL environment variable
3. Test health check (Click '🟢 Check Worker')
4. Add shop scanner UI section to src/index.html
5. Test parallel shop scanning (Click '📊 Scan Shops')
6. Monitor console logs for debug info
7. Read INTEGRATION_GUIDE.md for advanced configuration

💡 Tips:
   - Free Cloudflare Workers: 100,000 requests/day free
   - Free proxies are unreliable - use premium for production
   - Monitor your shop's target website policies
   - Consider ethical implications of scanning

📖 Documentation:
   - INTEGRATION_GUIDE.md - Complete integration guide
   - cloudflare-worker.js - Worker code with comments
   - src/linkFinder.js - Client code with comments

✨ You're all set! Happy scanning! ✨
"
