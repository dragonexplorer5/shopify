/**
 * Shop Directory Loader
 * 
 * Parses SHOP_DIRECTORY.md and provides shop URLs for scanning
 * Format: "name | url"
 */

const fs = require('fs');
const path = require('path');

class ShopDirectoryLoader {
  constructor() {
    this.shops = [];
    this.categories = {};
    this.loadDirectory();
  }

  /**
   * Load and parse SHOP_DIRECTORY.md
   */
  loadDirectory() {
    try {
      const dirPath = path.join(__dirname, '..', 'SHOP_DIRECTORY.md');
      
      if (!fs.existsSync(dirPath)) {
        console.warn('[ShopDirectoryLoader] SHOP_DIRECTORY.md not found');
        return;
      }

      const content = fs.readFileSync(dirPath, 'utf-8');
      this.parseMarkdown(content);
      
      console.log(`[ShopDirectoryLoader] Loaded ${this.shops.length} shops from directory`);
    } catch (error) {
      console.error('[ShopDirectoryLoader] Error loading directory:', error.message);
    }
  }

  /**
   * Parse markdown content and extract shops with URLs
   * Format: "## Category Name" followed by "1. Shop Name | https://url"
   */
  parseMarkdown(content) {
    const lines = content.split('\n');
    let currentCategory = 'Uncategorized';
    let currentSubcategory = '';

    for (const line of lines) {
      // Main category (##)
      if (line.startsWith('## ')) {
        currentCategory = line.replace('## ', '').trim();
        this.categories[currentCategory] = [];
        continue;
      }

      // Subcategory (###)
      if (line.startsWith('### ')) {
        currentSubcategory = line.replace('### ', '').trim();
        continue;
      }

      // Shop entry (number. Name | URL)
      const shopMatch = line.match(/^\d+\.\s+(.+?)\s*\|\s*(https?:\/\/.+)/);
      if (shopMatch) {
        const shopName = shopMatch[1].trim();
        const shopUrl = shopMatch[2].trim();

        const shop = {
          name: shopName,
          url: shopUrl,
          category: currentCategory,
          subcategory: currentSubcategory
        };

        this.shops.push(shop);

        if (!this.categories[currentCategory]) {
          this.categories[currentCategory] = [];
        }
        this.categories[currentCategory].push(shop);
      }
    }
  }

  /**
   * Get all shops
   */
  getAllShops() {
    return this.shops;
  }

  /**
   * Get shop URLs only (for scanning)
   */
  getAllShopUrls() {
    return this.shops.map(shop => shop.url);
  }

  /**
   * Get shops by category
   */
  getShopsByCategory(category) {
    return this.categories[category] || [];
  }

  /**
   * Get all categories
   */
  getCategories() {
    return Object.keys(this.categories);
  }

  /**
   * Get random sample of shops for scanning
   * @param {number} count - How many shops to return
   */
  getRandomShops(count = 10) {
    if (this.shops.length === 0) return [];
    
    const shuffled = [...this.shops].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, this.shops.length));
  }

  /**
   * Get random shop URLs for scanning
   * @param {number} count - How many URLs to return
   */
  getRandomShopUrls(count = 10) {
    return this.getRandomShops(count).map(shop => shop.url);
  }

  /**
   * Get shops from specific category
   */
  getCategoryUrls(category) {
    const shops = this.categories[category] || [];
    return shops.map(shop => shop.url);
  }

  /**
   * Search shops by name
   */
  searchShops(query) {
    const lowerQuery = query.toLowerCase();
    return this.shops.filter(shop => 
      shop.name.toLowerCase().includes(lowerQuery) ||
      shop.category.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get shop summary
   */
  getSummary() {
    return {
      totalShops: this.shops.length,
      totalCategories: Object.keys(this.categories).length,
      categories: Object.keys(this.categories),
      shopsByCategory: Object.keys(this.categories).reduce((acc, cat) => {
        acc[cat] = this.categories[cat].length;
        return acc;
      }, {})
    };
  }
}

module.exports = ShopDirectoryLoader;
