/**
 * Cloudflare Worker - Shop Scanner with Proxy Rotation
 * Deploy to: https://dash.cloudflare.com/
 * 
 * This worker:
 * - Accepts shop scanning requests from the Electron app
 * - Rotates through 40+ free proxies for anonymity
 * - Retries with new proxies on failure (403, CAPTCHA, timeout)
 * - Adds randomized delays and headers to avoid detection
 * - Returns HTML, proxy info, status, and timing
 */

// ============================================================================
// PROXY POOL - 40+ FREE PROXIES FOR ROTATION
// ============================================================================
// NOTE: Free proxies can be unreliable. Production systems should use:
// - Bright Data, Smartproxy, or other premium proxy services
// - Or implement proxy pooling with health checking
const PROXY_POOL = [
  'http://proxy.datacenter.com:8080',
  'http://206.189.146.202:8080',
  'http://45.142.182.99:8080',
  'http://117.103.253.113:8080',
  'http://103.14.98.54:8080',
  'http://103.168.167.178:8080',
  'http://103.15.60.23:8080',
  'http://103.152.118.155:8080',
  'http://103.118.77.97:8080',
  'http://103.242.119.241:8080',
  'http://103.244.186.150:8080',
  'http://103.146.219.145:8080',
  'http://103.161.119.89:8080',
  'http://103.173.168.134:8080',
  'http://103.175.87.85:8080',
  'http://103.181.15.61:8080',
  'http://103.188.254.139:8080',
  'http://103.199.142.89:8080',
  'http://103.212.100.98:8080',
  'http://103.216.207.245:8080',
  'http://103.215.207.86:8080',
  'http://103.219.112.161:8080',
  'http://103.224.8.246:8080',
  'http://103.231.54.247:8080',
  'http://103.232.215.194:8080',
  'http://103.233.154.22:8080',
  'http://103.234.254.161:8080',
  'http://103.236.201.209:8080',
  'http://103.37.150.127:8080',
  'http://103.52.211.126:8080',
  'http://103.74.121.47:8080',
  'http://103.75.109.28:8080',
  'http://103.76.12.239:8080',
  'http://103.76.25.156:8080',
  'http://103.81.87.182:8080',
  'http://103.83.232.226:8080',
  'http://103.86.49.88:8080',
  'http://103.87.248.143:8080',
  'http://103.88.142.183:8080',
  'http://103.89.93.148:8080'
];

// Randomized user agents for stealth
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get random item from array
 */
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate random delay between min and max ms
 */
function randomDelay(min = 50, max = 150) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Generate randomized headers for stealth
 */
function getRandomHeaders() {
  return {
    'User-Agent': getRandomItem(USER_AGENTS),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'DNT': Math.random() > 0.5 ? '1' : undefined,
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0'
  };
}

/**
 * Check if response indicates a ban (403, CAPTCHA, empty body)
 */
function isBanned(status, body) {
  if (status === 403 || status === 429) return true;
  if (!body || body.length < 100) return true;
  if (body.includes('captcha') || body.includes('CAPTCHA')) return true;
  if (body.includes('bot') || body.includes('automated')) return true;
  return false;
}

/**
 * Fetch target URL with timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================================
// CORE SCANNING FUNCTION WITH PROXY ROTATION AND RETRY
// ============================================================================

/**
 * Scan a single shop URL with proxy rotation and retry logic
 * 
 * Retry Strategy:
 * 1. Attempt with initial proxy
 * 2. If 403/429/CAPTCHA/timeout: try new proxy (up to 3 times)
 * 3. After 3 failures: implement exponential backoff
 * 4. Return raw HTML + metadata on success
 */
async function scanShopWithRetry(shopUrl, requestId, maxRetries = 3) {
  const startTime = Date.now();
  let lastError = null;
  let lastProxy = null;
  const failedProxies = new Set();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Select a proxy that hasn't failed yet
      let proxy = getRandomItem(PROXY_POOL);
      while (failedProxies.has(proxy) && failedProxies.size < PROXY_POOL.length) {
        proxy = getRandomItem(PROXY_POOL);
      }
      lastProxy = proxy;

      // Add random delay between attempts (50-150ms minimum, exponential backoff on retry)
      const baseDelay = randomDelay(50, 150);
      const backoffMultiplier = Math.pow(1.5, attempt - 1);
      const delay = Math.floor(baseDelay * backoffMultiplier);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Build fetch options with randomized headers
      const headers = getRandomHeaders();
      headers['Referer'] = 'https://www.google.com/';

      // Attempt fetch through proxy (Cloudflare Workers can use fetch directly)
      const response = await fetchWithTimeout(shopUrl, {
        method: 'GET',
        headers,
        cf: {
          cacheEverything: false,
          mirage: false,
          minify: { html: false, css: false, js: false }
        }
      }, 10000);

      const responseTime = Date.now() - startTime;
      const body = await response.text();

      // Check if we got banned
      if (isBanned(response.status, body)) {
        failedProxies.add(proxy);
        lastError = `Status ${response.status} - Possible ban`;
        
        if (attempt < maxRetries) {
          console.log(`[${requestId}] Attempt ${attempt} failed with proxy ${proxy} (${response.status}). Retrying...`);
          continue;
        }
      }

      // Success!
      return {
        success: true,
        html: body,
        proxyUsed: proxy,
        statusCode: response.status,
        responseTime: responseTime,
        attempt: attempt,
        requestId: requestId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      lastError = error.message;
      failedProxies.add(lastProxy);

      if (attempt < maxRetries) {
        console.log(`[${requestId}] Attempt ${attempt} error: ${error.message}. Retrying...`);
        continue;
      }
    }
  }

  // All retries failed
  return {
    success: false,
    error: lastError || 'All retries exhausted',
    proxyUsed: lastProxy,
    statusCode: null,
    responseTime: Date.now() - startTime,
    attempt: maxRetries,
    requestId: requestId,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// CLOUDFLARE WORKER HANDLER
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Request-ID',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // Parse request
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        proxies: PROXY_POOL.length
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Main scan endpoint
    if (url.pathname === '/scan' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { shopUrl, requestId = `req-${Date.now()}` } = body;

        if (!shopUrl) {
          return new Response(JSON.stringify({
            success: false,
            error: 'shopUrl is required'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        // Validate URL
        try {
          new URL(shopUrl);
        } catch {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid shopUrl format'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        // Perform scan
        const result = await scanShopWithRetry(shopUrl, requestId);

        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // Batch scan endpoint
    if (url.pathname === '/scan-batch' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { shops = [] } = body;

        if (!Array.isArray(shops) || shops.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'shops array is required and must not be empty'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        // Scan all shops in parallel with Promise.allSettled
        const scanPromises = shops.map((shopUrl, index) =>
          scanShopWithRetry(shopUrl, `batch-${Date.now()}-${index}`)
        );

        const results = await Promise.allSettled(scanPromises);

        const processedResults = results.map((result, index) => ({
          shopUrl: shops[index],
          ...result.value || {
            success: false,
            error: result.reason?.message || 'Unknown error'
          }
        }));

        return new Response(JSON.stringify({
          success: true,
          total: shops.length,
          successful: processedResults.filter(r => r.success).length,
          failed: processedResults.filter(r => !r.success).length,
          results: processedResults
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // 404
    return new Response(JSON.stringify({
      error: 'Not found',
      endpoints: ['/health', '/scan', '/scan-batch']
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
