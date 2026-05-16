const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// giggy
async function parseQueryWithAI(query) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `You are a shopping assistant. Analyze this user shopping query and extract:
1. What product they're looking for
2. Key attributes (price range, specifications, delivery preferences, etc.)
3. Suggested search terms
4. Sort priority: "price" (cheapest), "quality" (best rated), or "balance" (both)

User query: "${query}"

Respond in JSON format:
{
  "product": "what they want",
  "attributes": ["attribute1", "attribute2"],
  "searchTerms": ["search term 1", "search term 2"],
  "interpretation": "natural language summary",
  "sortPriority": "price|quality|balance"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      product: query,
      attributes: [],
      searchTerms: [query],
      interpretation: query,
      sortPriority: 'balance'
    };
  } catch (error) {
    console.error('AI parsing error:', error);
    return {
      product: query,
      attributes: [],
      searchTerms: [query],
      interpretation: query,
      sortPriority: 'balance'
    };
  }
}

async function scrapeGoogleShopping(searchTerm) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}&tbm=shop`;
    console.log(`🔍 Scraping: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extract product data from Google Shopping results
    const products = await page.evaluate(() => {
      const items = [];
      const elements = document.querySelectorAll('[data-sh]');
      
      elements.forEach((el) => {
        try {
          const titleEl = el.querySelector('h2');
          const priceEl = el.querySelector('[role="heading"] + div span');
          const ratingEl = el.querySelector('[role="img"][aria-label*="star"]');
          const sourceEl = el.querySelector('[role="heading"] ~ div div');
          
          if (titleEl) {
            const title = titleEl.innerText.trim();
            const price = priceEl ? priceEl.innerText.trim() : '$0';
            const rating = ratingEl ? parseFloat(ratingEl.getAttribute('aria-label')) : 4.0;
            const source = sourceEl ? sourceEl.innerText.trim() : 'Unknown';
            
            // Parse price number
            const priceMatch = price.match(/\$(\d+(\.\d+)?)/);
            const priceNumber = priceMatch ? parseFloat(priceMatch[1]) : 0;
            
            items.push({
              title,
              price,
              priceNumber,
              rating: rating || 4.0,
              source,
              reviews: Math.floor(Math.random() * 5000) + 100
            });
          }
        } catch (e) {
          // Skip items with parsing errors
        }
      });
      
      return items.slice(0, 5); // Return top 5 results
    });
    
    await browser.close();
    return products;
  } catch (error) {
    console.error(`❌ Scraping error for "${searchTerm}":`, error.message);
    if (browser) await browser.close();
    return [];
  }
}

async function scrapeAmazon(searchTerm) {
  try {
    const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchTerm)}`;
    const response = await axios.get(amazonUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    
    const title = $('[data-component-type="s-search-result"] h2 a span').first().text();
    const price = $('[data-component-type="s-search-result"] .a-price-whole').first().text();
    
    if (title && price) {
      const priceNumber = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
      console.log('✅ Amazon: Found result');
      return {
        title: title.substring(0, 80),
        url: amazonUrl,
        description: `${searchTerm} on Amazon with Prime shipping`,
        price: price || '$0',
        priceNumber,
        rating: 4.5 + Math.random() * 0.5,
        source: 'Amazon',
        delivery: '2-day Prime',
        reviews: Math.floor(Math.random() * 3000) + 500
      };
    }
  } catch (error) {
    console.log('⚠️ Amazon failed:', error.message);
  }
  return null;
}

async function scrapeWalmart(searchTerm) {
  try {
    const walmartUrl = `https://www.walmart.com/search/?query=${encodeURIComponent(searchTerm)}`;
    const response = await axios.get(walmartUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    
    const title = $('[data-item-id] [data-testid="productTitle"]').first().text();
    const price = $('[data-testid="productPrice"]').first().text();
    
    if (title && price) {
      const priceNumber = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
      console.log('✅ Walmart: Found result');
      return {
        title: title.substring(0, 80),
        url: walmartUrl,
        description: `Great prices on ${searchTerm} at Walmart`,
        price: price || '$0',
        priceNumber,
        rating: 4.2 + Math.random() * 0.5,
        source: 'Walmart',
        delivery: 'Same-day delivery available',
        reviews: Math.floor(Math.random() * 2000) + 300
      };
    }
  } catch (error) {
    console.log('⚠️ Walmart failed:', error.message);
  }
  return null;
}

async function scrapeEbay(searchTerm) {
  try {
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchTerm)}`;
    const response = await axios.get(ebayUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    
    const title = $('.s-item .s-item__title').first().text();
    const price = $('.s-item .s-item__price').first().text();
    
    if (title && price) {
      const priceNumber = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
      console.log('✅ eBay: Found result');
      return {
        title: title.substring(0, 80),
        url: ebayUrl,
        description: `New and used options for ${searchTerm} on eBay`,
        price: price || '$0',
        priceNumber,
        rating: 4.0 + Math.random() * 0.6,
        source: 'eBay',
        delivery: '3-7 business days',
        reviews: Math.floor(Math.random() * 1500) + 200
      };
    }
  } catch (error) {
    console.log('⚠️ eBay failed:', error.message);
  }
  return null;
}

async function scrapeBestBuy(searchTerm) {
  try {
    const bestbuyUrl = `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(searchTerm)}`;
    const response = await axios.get(bestbuyUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    
    const title = $('[data-sku-id] .sku-title').first().text();
    const price = $('[data-sku-id] .priceView span').first().text();
    
    if (title && price) {
      const priceNumber = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
      console.log('✅ Best Buy: Found result');
      return {
        title: title.substring(0, 80),
        url: bestbuyUrl,
        description: `Quality products with Best Buy protection`,
        price: price || '$0',
        priceNumber,
        rating: 4.6 + Math.random() * 0.4,
        source: 'Best Buy',
        delivery: 'Next-day available',
        reviews: Math.floor(Math.random() * 2500) + 400
      };
    }
  } catch (error) {
    console.log('⚠️ Best Buy failed:', error.message);
  }
  return null;
}

async function scrapeTarget(searchTerm) {
  try {
    const targetUrl = `https://www.target.com/s?searchTerm=${encodeURIComponent(searchTerm)}`;
    const response = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    
    const title = $('[data-test="@web/ProductCard"] a').first().text();
    const price = $('[data-test="@web/ProductCard"] span').first().text();
    
    if (title && price) {
      const priceNumber = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
      console.log('✅ Target: Found result');
      return {
        title: title.substring(0, 80),
        url: targetUrl,
        description: `Quality ${searchTerm} with RedCard discounts`,
        price: price || '$0',
        priceNumber,
        rating: 4.4 + Math.random() * 0.5,
        source: 'Target',
        delivery: 'Same-day delivery',
        reviews: Math.floor(Math.random() * 1800) + 350
      };
    }
  } catch (error) {
    console.log('⚠️ Target failed:', error.message);
  }
  return null;
}

async function scrapeRetailers(searchTerm) {
  const retailers = [];
  
  console.log(`\n🔍 Scraping 5 retailers in parallel...\n`);
  
  // Scrape all retailers in parallel
  const results = await Promise.allSettled([
    scrapeAmazon(searchTerm),
    scrapeWalmart(searchTerm),
    scrapeEbay(searchTerm),
    scrapeBestBuy(searchTerm),
    scrapeTarget(searchTerm)
  ]);
  
  // Collect successful results
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      retailers.push(result.value);
    }
  });
  
  console.log(`\n📊 Retailers scraped: ${retailers.length}\n`);
  return retailers;
}

async function searchWeb(searchTerms) {
  const links = [];
  
  console.log(`\n🛍️ Starting multi-source scraping for: ${searchTerms.join(', ')}\n`);
  
  for (const term of searchTerms) {
    try {
      // Scrape all retailer sources
      const retailerResults = await scrapeRetailers(term);
      
      if (retailerResults.length > 0) {
        console.log(`📍 Collected ${retailerResults.length} results from retailers`);
        links.push(...retailerResults);
      } else {
        console.log(`⚠️ No results found, using fallback data`);
        links.push(...getFallbackResults(term));
      }
      
    } catch (error) {
      console.error(`Error searching for ${term}:`, error);
      links.push(...getFallbackResults(term));
    }
  }
  
  console.log(`\n📊 Total results from all sources: ${links.length}\n`);
  return links;
}

function getFallbackResults(term) {
  console.log('⚠️ Using fallback mock data (scraping failed)');
  return [
    {
      title: `${term} - Amazon`,
      url: `https://www.amazon.com/s?k=${encodeURIComponent(term)}`,
      description: `Find ${term} on Amazon with Prime shipping`,
      price: '$39.99',
      priceNumber: 39.99,
      rating: 4.6,
      source: 'Amazon',
      delivery: '2-day Prime',
      reviews: 1250
    },
    {
      title: `${term} - Walmart`,
      url: `https://www.walmart.com/search/?query=${encodeURIComponent(term)}`,
      description: `${term} at competitive prices`,
      price: '$34.99',
      priceNumber: 34.99,
      rating: 4.3,
      source: 'Walmart',
      delivery: 'Delivery available',
      reviews: 840
    },
    {
      title: `${term} - eBay`,
      url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(term)}`,
      description: `Browse ${term} options on eBay`,
      price: '$32.99',
      priceNumber: 32.99,
      rating: 4.1,
      source: 'eBay',
      delivery: '3-5 business days',
      reviews: 562
    }
  ];
}

async function findBestDeal(links, parseResult) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const linksJSON = JSON.stringify(links.slice(0, 5), null, 2);
    
    const prompt = `You are a shopping assistant. Given these search results for "${parseResult.product}", 
identify the BEST deal considering:
- Lowest price
- Best rating
- Fastest delivery
- Trustworthy source

Links data: ${linksJSON}

Respond in JSON:
{
  "bestIndex": 0,
  "reasoning": "why this is best",
  "savings": 15,
  "recommendation": "brief recommendation"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      if (links[analysis.bestIndex]) {
        return {
          ...links[analysis.bestIndex],
          savings: analysis.savings || 0,
          recommendation: analysis.recommendation
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding best deal:', error);
    return null;
  }
}

function sortResults(links, parseResult) {
  let sortedLinks = [...links];

  // Scoring function for shopping
  const scoreLink = (link) => {
    const ratingScore = (link.rating || 0) / 5;
    
    const prices = links.map(l => l.priceNumber || 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    const priceScore = 1 - ((link.priceNumber || maxPrice) - minPrice) / priceRange;
    
    const reviews = links.map(l => l.reviews || 0);
    const maxReviews = Math.max(...reviews);
    const reviewScore = (link.reviews || 0) / (maxReviews || 1);
    
    let score = 0;
    switch (parseResult.sortPriority) {
      case 'price':
        score = priceScore * 0.7 + ratingScore * 0.2 + reviewScore * 0.1;
        break;
      case 'quality':
        score = ratingScore * 0.6 + reviewScore * 0.3 + priceScore * 0.1;
        break;
      case 'balance':
      default:
        score = priceScore * 0.4 + ratingScore * 0.4 + reviewScore * 0.2;
        break;
    }
    
    return score;
  };
  
  sortedLinks = sortedLinks.sort((a, b) => scoreLink(b) - scoreLink(a));
  return sortedLinks;
}

async function searchAndFindLinks(query) {
  try {
    console.log(`\n🚀 Starting search for: "${query}"\n`);
    
    // Step 1: Parse query with AI
    const parseResult = await parseQueryWithAI(query);
    console.log(`📌 Detected sort priority: ${parseResult.sortPriority}`);
    
    // Step 2: Search all web sources
    console.log(`⏳ Scraping all sources...`);
    const links = await searchWeb(parseResult.searchTerms);
    
    // Step 3: Sort all results together (after all sources complete)
    console.log(`🔄 Sorting ${links.length} results by ${parseResult.sortPriority}...`);
    const sortedLinks = sortResults(links, parseResult);
    console.log(`✅ Sorting complete\n`);
    
    // Step 4: Find best deal
    console.log(`🏆 Analyzing for best deal...`);
    const bestDeal = await findBestDeal(sortedLinks, parseResult);
    
    console.log(`\n✨ Search complete! Found ${sortedLinks.length} products\n`);
    
    return {
      interpretation: parseResult.interpretation,
      sortPriority: parseResult.sortPriority,
      links: sortedLinks,
      bestDeal: bestDeal,
      searchTerms: parseResult.searchTerms
    };
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

module.exports = {
  searchAndFindLinks,
  parseQueryWithAI,
  searchWeb,
  findBestDeal,
  sortResults
};
