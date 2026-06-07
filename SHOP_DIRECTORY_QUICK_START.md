# Shop Directory Scanner - Quick Reference

## 🎯 What It Does

Scans shops from a comprehensive directory of 1,000+ retailers organized by 30+ categories.

---

## 📂 Data Source

**File**: `SHOP_DIRECTORY.md`

Contains 1,000+ shops in format:
```
## Category Name
### Subcategory
1. Shop Name | https://url
2. Shop Name | https://url
```

---

## 🎮 User Interface

### Section: "🏪 Shop Directory Scanner"

**Two scanning modes:**

1. **Random Scan**
   - Enter: Number (5-50)
   - Click: "🎲 Scan Random"
   - Result: Scans N random shops

2. **Category Scan**
   - Select: Category dropdown
   - Load: Shops in that category
   - Check: Specific shops
   - Click: "📊 Scan Selected Shops"

---

## 💻 Backend Components

### ShopDirectoryLoader (`src/shopDirectoryLoader.js`)
- Parses SHOP_DIRECTORY.md
- Extracts shops with URLs
- Provides filtering/search

### IPC Handlers (`main.js`)
```javascript
'get-shop-directory'        // Get summary
'get-shop-categories'       // Get all categories
'get-shops-by-category'     // Get category shops
'scan-directory-shops'      // Scan random
'scan-category-shops'       // Scan by category
'search-directory-shops'    // Search shops
```

### APIs (`preload.js`)
```javascript
window.api.getShopDirectory()
window.api.getShopCategories()
window.api.getShopsByCategory(category)
window.api.scanDirectoryShops(count)
window.api.scanCategoryShops(category, limit)
window.api.searchDirectoryShops(query)
```

---

## 📊 Features

✅ **Directory Summary** - Shows on page load
✅ **Category Browsing** - Select and view shops
✅ **Random Scanning** - Quick health checks
✅ **Category Scanning** - Monitor specific types
✅ **Shop Selection** - Check individual shops
✅ **Performance Metrics** - See scan results

---

## 🚀 Quick Start

1. **App starts** → Directory loads automatically
2. **See summary** → Total shops and categories
3. **Select category** → Drop down appears
4. **View shops** → Click category to see shops
5. **Scan** → Select shops and click Scan
6. **Results** → See successful/failed counts

---

## 📈 What Gets Scanned

When you click "Scan Selected Shops":
- Shop URLs sent to Cloudflare Worker
- Worker fetches shop pages
- Returns: availability, response time, proxy used
- Results shown in app

---

## 🔍 Categories Available

- 🍔 Food & Groceries
- 👗 Fashion & Clothing
- 💻 Technology & Electronics
- 🏠 Home & Decor
- 👶 Baby, Kids & Toys
- 🎮 Gaming & Entertainment
- 💄 Beauty & Personal Care
- 📚 Books & Media
- 🏋️ Sports & Outdoors
- 🌱 Health & Wellness
- 🚗 Automotive
- ✈️ Travel & Hotels
- And 18+ more...

---

## 💡 Use Cases

### Monitor Shop Health
```
Scan 5 random shops
Check which are up/down
Track over time
```

### Test Category Performance
```
Select "Fashion & Clothing"
Scan 3 shops
Compare response times
```

### Verify Retailers
```
Search for "amazon"
See all Amazon shops
Scan to verify working
```

---

## 📊 Scan Results Show

- Total shops scanned
- Successful scans
- Failed scans
- Response time (ms)
- Which proxy was used

---

## ✨ Summary

**Shop Directory Scanner** lets you:
- Monitor 1,000+ shops
- Organize by category
- Scan health/availability
- Track performance
- All from simple UI!

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| No categories | App may still loading |
| Scan errors | Check internet |
| No shops showing | Verify SHOP_DIRECTORY.md exists |
| Empty results | Try different category |

---

**Ready to scan! 🏪✨**
