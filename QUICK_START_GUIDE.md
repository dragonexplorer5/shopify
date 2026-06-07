# Perk-Lookup System - Quick Start Guide

## 📋 What Was Added

A complete **perk-lookup system** that allows users to register gift cards, store reward programs, and credit card perks. The AI shopping assistant uses these perks to boost recommendations for eligible items.

### New Files
- ✅ `src/perkProfile.js` - Core perk storage & management
- ✅ `PERK_INTEGRATION_GUIDE.md` - Complete architecture & data flow
- ✅ `PERK_API_REFERENCE.md` - Full API documentation
- ✅ `QUICK_START_GUIDE.md` - This file

### Updated Files
- ✅ `main.js` - Added IPC handlers for perk CRUD
- ✅ `src/preload.js` - Added perk API bridge
- ✅ `src/app.js` - Added perk UI logic & functions
- ✅ `src/index.html` - Added perk selection UI section
- ✅ `src/linkFinder.js` - Added perk-aware scoring logic

---

## 🚀 Getting Started (5 Minutes)

### Step 1: Copy Files
```bash
# Ensure these files are in your repo:
src/perkProfile.js          # NEW
PERK_INTEGRATION_GUIDE.md   # NEW
PERK_API_REFERENCE.md       # NEW
```

### Step 2: Verify Updates
Check these files have been updated:
- [ ] `main.js` - Contains `globalPerkProfile` and perk IPC handlers
- [ ] `src/preload.js` - Exposes `window.api.setPerks()`, `getPerks()`, `getPerkSummary()`
- [ ] `src/app.js` - Contains perk functions (`savePerkProfile()`, `loadPerkProfile()`, etc.)
- [ ] `src/index.html` - Contains perk UI section with form
- [ ] `src/linkFinder.js` - Imports PerkProfile, has perk scoring functions

### Step 3: Test
```bash
npm start
```

1. Open Shopify app
2. You should see 💳 **Your Perks & Rewards** section
3. Check a perk (e.g., Walmart Gift Card)
4. Click **Save Perks**
5. Search for "laptop"
6. Results should show perk badges for applicable items

---

## 💡 How It Works (30-Second Version)

```
User selects perks:     [✓] Walmart Gift Card
                        [✓] Target Circle
                        
       ↓
       
User searches:          "laptop"

       ↓
       
AI scoring:             Walmart laptop: +35% boost (under $25)
                        Target laptop: +15% boost (Circle deal)
                        Amazon laptop: +0% boost (no perk)
       
       ↓
       
Results ranked:         1. Walmart laptop ← HIGHEST SCORE
                        2. Target laptop
                        3. Amazon laptop
```

---

## 🎯 Key Features

| Feature | What It Does | Safety |
|---------|----------|--------|
| **Gift Cards** | Boosts items you can buy with stored value | ✅ Never stores balance |
| **Reward Programs** | Prioritizes items where you earn points | ✅ Only stores membership level |
| **Credit Card Perks** | Highlights cashback/discount eligible items | ✅ Never stores card numbers |
| **Promo Credits** | Surfaces items eligible for promotional credit | ✅ Never stores amounts |

---

## 🔒 Safety (What We DON'T Store)

❌ Card numbers (full or partial)
❌ CVV/Security codes
❌ PINs
❌ Account balances
❌ Account identifiers
❌ Expiration dates

✅ **ONLY** public perk descriptions like:
- "Walmart gift card" (store name)
- "5% off dining" (benefit description)
- "Amazon Prime member" (program name)

---

## 📱 User Features

### Save Perks
```javascript
// User checks boxes in UI and clicks "Save Perks"
// Backend stores perks in memory
// Summary updates: "2 gift cards, 1 reward program"
```

### Load Perks
```javascript
// User clicks "Load Perks"
// Previously saved perks are restored to checkboxes
```

### Clear Perks
```javascript
// User clicks "Clear All"
// Confirms deletion
// All perks removed
```

### Get Summary
```javascript
// Auto-updates when perks change
// Shows: "2 gift card(s), 1 reward program(s), 1 credit card perk(s)"
```

---

## 🔧 Developer Features

### Access Perks in Code

**Frontend**:
```javascript
const perks = await window.api.getPerks();
const summary = await window.api.getPerkSummary();
```

**Backend** (main.js):
```javascript
const perks = globalPerkProfile.getPerks();
const summary = globalPerkProfile.getSummary();
```

### Customize Scoring

Edit `src/linkFinder.js` `calculatePerkScore()` function:
```javascript
// Change Walmart gift card boost from 35% to 50%
if (store === 'walmart' && price < 25) {
  perkBoost += 0.50;  // ← Change this
}
```

### Add New Perk Types

Edit `src/perkProfile.js`:
```javascript
// Add new category
this.perks.loyaltyPrograms = [];  // Add new category

// Update UI in index.html to include checkboxes
// Update app.js to handle new type
// Add scoring rules in linkFinder.js
```

---

## 🧪 Testing Examples

### Test 1: Basic Perk Save
```javascript
// In DevTools Console:
await window.api.setPerks({
  giftCards: [{ store: 'Walmart' }],
  rewardPrograms: [],
  creditCardPerks: [],
  storeCoupons: [],
  promoCredits: []
});

// Expected: { success: true, summary: "1 gift card(s)" }
```

### Test 2: Load and Verify
```javascript
const result = await window.api.getPerks();
console.log(result.data.giftCards);
// Expected: [{ store: 'Walmart' }]
```

### Test 3: Perk-Aware Search
```javascript
// Verify that searching with Walmart perk active
// boosts Walmart items in results
```

### Test 4: Reject Sensitive Data
```javascript
// Try to save card number (should fail)
await window.api.setPerks({
  creditCardPerks: [{
    bank: 'Chase',
    category: 'Dining',
    benefit: '5% back',
    cardNumber: '4111-1111-1111-1111'  // INVALID
  }]
});

// Expected: { success: false, message: "... invalid data" }
```

---

## 📊 Perk Scoring Boosts

### Walmart Gift Card
- Items under $25: **+35%** ⭐⭐⭐
- Items any price: **+10%**

### Target Circle
- Target items: **+15%**

### Amazon Prime
- Amazon items: **+20%** ⭐⭐

### Best Buy Rewards
- Best Buy items: **+12%**

### Credit Card Perks
- Matching category: **+10%**
- Electronics at electronics retailer: **+12%**

### Promo Credits
- Amazon promo eligible: **+25%** ⭐⭐⭐

---

## 🐛 Troubleshooting

### Perks don't appear in results

1. Check perks are saved:
   ```javascript
   await window.api.getPerkSummary()  // Should return count
   ```

2. Check console for errors:
   - DevTools → Console tab
   - Look for `[Perk IPC]` messages

3. Verify store names match:
   - Case-insensitive matching
   - "walmart" = "Walmart" = "WALMART" ✅

### IPC errors

1. Verify preload.js is loaded
2. Check main.js has these handlers registered:
   - `set-perks`
   - `get-perks`
   - `get-perk-summary`

3. Restart Electron app

### Search results unchanged

1. Verify perk profile instance created in main.js:
   ```javascript
   let globalPerkProfile = new PerkProfile();
   ```

2. Verify `searchAndFindLinks()` receives perkProfile:
   ```javascript
   const results = await searchAndFindLinks(query, globalPerkProfile);
   ```

3. Check console for perk scoring messages

---

## 📚 Full Documentation

- **Architecture & Data Flow**: See `PERK_INTEGRATION_GUIDE.md`
- **Complete API Reference**: See `PERK_API_REFERENCE.md`
- **Module Documentation**: See inline comments in `src/perkProfile.js`

---

## ✅ Deployment Checklist

Before going live:

- [ ] All files copied correctly
- [ ] main.js has globalPerkProfile initialized
- [ ] preload.js exposes all perk APIs
- [ ] app.js has all perk functions
- [ ] index.html has perk UI section
- [ ] linkFinder.js has perk scoring
- [ ] Tested saving perks
- [ ] Tested loading perks
- [ ] Tested search with perks active
- [ ] Tested clearing perks
- [ ] Verified no sensitive data in logs
- [ ] Tested invalid data rejection

---

## 🎓 Learning Path

1. **5 min**: Read this Quick Start Guide
2. **10 min**: Look at `src/perkProfile.js` (well-commented)
3. **15 min**: Review perk scoring in `src/linkFinder.js`
4. **20 min**: Trace data flow in `PERK_INTEGRATION_GUIDE.md`
5. **10 min**: Review API reference for specific methods

---

## 💬 Quick Reference

| I want to... | Code |
|---|---|
| Save perks | `await window.api.setPerks(perkList)` |
| Load perks | `const p = await window.api.getPerks()` |
| Get summary | `const s = await window.api.getPerkSummary()` |
| Search (perk-aware) | `await window.api.searchLinks(query)` |
| Clear all | Call `setPerks()` with empty arrays |
| Check specific perk | `profile.hasPerk('Walmart')` |
| Get perk rules | `profile.getApplicableRules(store, category)` |
| Calculate boost | `calculatePerkScore(link, perkList)` |

---

## 🎉 You're Ready!

The perk-lookup system is fully integrated and ready to use. Users can now:

1. ✅ Tell the AI what gift cards they have
2. ✅ Register their reward programs
3. ✅ Add credit card perks
4. ✅ Get personalized shopping recommendations
5. ✅ See perk-eligible items ranked higher

All while maintaining **complete privacy** — no sensitive financial data is ever stored.

---

## 📞 Support

For issues or questions:
1. Check the API Reference for specific method usage
2. Review the Integration Guide for architecture details
3. Check console logs for error messages (with `[Perk IPC]` prefix)
4. Verify all 5 files have been updated correctly

---

**Happy shopping! 🛍️**
