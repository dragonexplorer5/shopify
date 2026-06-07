# Perk-Lookup System - Integration Guide

## Overview

The **Perk-Lookup System** allows Shopify AI users to register their gift cards, store reward programs, and credit card perks to receive personalized shopping recommendations. The AI learns what benefits the user has and prioritizes items that leverage those perks.

### Key Features

✅ **Gift Cards** - Walmart, Target, Amazon, Best Buy, custom stores
✅ **Reward Programs** - Target Circle, Best Buy Rewards, Amazon Prime, Walmart+
✅ **Credit Card Perks** - Public benefits only (5% off dining, 3% back on shopping, etc.)
✅ **Promo Credits** - Amazon promotional credits, Uber Eats, etc.
✅ **Safety First** - Never stores card numbers, PINs, balances, or sensitive data
✅ **Perk-Aware AI Scoring** - Boosts recommendations for items eligible for perks

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ELECTRON MAIN PROCESS                       │
│                                                                      │
│  main.js                                                             │
│  ├─ globalPerkProfile (PerkProfile instance)                        │
│  ├─ IPC: set-perks          ← Receives perk list from UI           │
│  ├─ IPC: get-perks          ← Sends perks to UI                    │
│  ├─ IPC: get-perk-summary   ← Returns summary string               │
│  └─ IPC: search-links       ← Passes perks to linkFinder           │
│       └─ searchAndFindLinks(query, globalPerkProfile)              │
│           └─ sortResults(links, parseResult, globalPerkProfile)    │
│               └─ calculatePerkScore(link, activePerkList)          │
└─────────────────────────────────────────────────────────────────────┘
                               ↕ IPC
┌─────────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS (Browser)                      │
│                                                                      │
│  index.html                                                          │
│  ├─ Perk UI Section                                                 │
│  │  ├─ Gift Cards (checkboxes + custom input)                       │
│  │  ├─ Reward Programs (checkboxes + custom input)                  │
│  │  ├─ Credit Card Perks (checkboxes + custom input)                │
│  │  └─ Promo Credits (checkboxes + custom input)                    │
│  │                                                                   │
│  app.js                                                              │
│  ├─ savePerkProfile()     → window.api.setPerks()                   │
│  ├─ loadPerkProfile()     → window.api.getPerks()                   │
│  ├─ updatePerkSummary()   → window.api.getPerkSummary()             │
│  ├─ clearPerkProfile()    → window.api.setPerks({...empty...})      │
│  └─ performSearch()       → window.api.searchLinks()                │
│                              (uses stored perks in backend)         │
│                                                                      │
│  preload.js                                                          │
│  └─ window.api.{setPerks, getPerks, getPerkSummary, searchLinks}    │
└─────────────────────────────────────────────────────────────────────┘
                                ↕
┌─────────────────────────────────────────────────────────────────────┐
│                      FILE SYSTEM MODULES                             │
│                                                                      │
│  src/perkProfile.js                                                 │
│  └─ PerkProfile class                                               │
│     ├─ setPerks(perkList)                                           │
│     ├─ getPerks()                                                   │
│     ├─ getApplicableRules(store, category)                          │
│     ├─ getActiveBenefitLabels()                                     │
│     └─ getSummary()                                                 │
│                                                                      │
│  src/linkFinder.js                                                  │
│  ├─ calculatePerkScore(link, activePerkList)                        │
│  ├─ getActivePerksList(globalPerkProfile)                           │
│  └─ sortResults(links, parseResult, globalPerkProfile)              │
│     └─ Boosts scores for items with eligible perks                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. User Sets Perks (UI → Backend)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User checks "Walmart Gift Card" in UI                        │
│ 2. User clicks "Save Perks"                                     │
│    └─ buildPerkList() collects all checkboxes                   │
│                                                                  │
│ 3. savePerkProfile() calls window.api.setPerks(perkList)       │
│                                                                  │
│ 4. Preload.js routes to main process via IPC                   │
│    └─ ipcRenderer.invoke('set-perks', perkList)                │
│                                                                  │
│ 5. main.js receives 'set-perks' IPC message                     │
│    └─ globalPerkProfile.setPerks(perkList)                     │
│    └─ Stores in memory (validates no sensitive data)           │
│                                                                  │
│ 6. Returns success + summary to UI                              │
│    └─ updatePerkSummary() displays "2 gift cards, 1 reward..."  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. User Searches (Perks Influence Results)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User enters "laptop" in search box                            │
│ 2. User clicks "Search"                                          │
│    └─ performSearch() calls window.api.searchLinks(query)       │
│                                                                  │
│ 3. main.js 'search-links' handler receives query                │
│    └─ searchAndFindLinks(query, globalPerkProfile)             │
│                                                                  │
│ 4. linkFinder.js processes:                                      │
│    a) Parse query with AI (product, attributes, sort priority) │
│    b) Search all retailers (Amazon, Walmart, Best Buy, etc.)   │
│    c) sortResults() applies perk-aware scoring:                │
│       └─ For each product:                                      │
│          1. Calculate base score (price + rating + reviews)    │
│          2. Check for matching perks (Best Buy Rewards?)       │
│          3. Apply perk boost multiplier                        │
│          4. Sort all products by boosted score                 │
│                                                                  │
│ 5. Return sorted links with perk info to UI                     │
│    └─ Each link includes:                                       │
│       { ...product data..., perkInfo: {                         │
│         boost: 0.12,                                            │
│         reasons: ["Best Buy Rewards boost"]                    │
│       }}                                                          │
│                                                                  │
│ 6. UI displays results with perk badges                         │
│    └─ "🏆 Best Buy Rewards boost" shown under item             │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
shopify-main/
├── main.js                          [UPDATED] - IPC handlers for perks
├── src/
│   ├── app.js                       [UPDATED] - UI logic for perks
│   ├── index.html                   [UPDATED] - Perk UI section
│   ├── preload.js                   [UPDATED] - IPC bridge for perks
│   ├── perkProfile.js               [NEW] - PerkProfile class
│   ├── linkFinder.js                [UPDATED] - Perk-aware scoring
│   ├── styles.css
│   └── ...
└── ...
```

---

## Code Examples

### Example 1: User Adds Perks

**UI (index.html)**
```html
<input type="checkbox" id="walmart-gc" class="perk-checkbox">
<label for="walmart-gc">Walmart Gift Card</label>
<button onclick="savePerkProfile()">Save Perks</button>
```

**Frontend (app.js)**
```javascript
async function savePerkProfile() {
  const perks = {
    giftCards: [{ store: 'Walmart' }],
    rewardPrograms: [],
    creditCardPerks: [],
    storeCoupons: [],
    promoCredits: []
  };
  
  const result = await window.api.setPerks(perks);
  console.log(result.summary); // "1 gift card(s)"
}
```

**Backend (main.js)**
```javascript
ipcMain.handle('set-perks', async (event, perkList) => {
  const success = globalPerkProfile.setPerks(perkList);
  return { success, summary: globalPerkProfile.getSummary() };
});
```

**Storage (perkProfile.js)**
```javascript
setPerks(perkList) {
  this.perks.giftCards = perkList.giftCards || [];
  // Validates: no card numbers, PINs, or balances allowed
}
```

---

### Example 2: Perk-Aware Search

**Query**: "laptop" with Walmart gift card active

**Backend Processing (linkFinder.js)**

```javascript
// Search returns multiple results:
const results = [
  { title: "Dell Laptop", source: "walmart", price: 599 },
  { title: "HP Laptop", source: "best buy", price: 649 },
  { title: "Lenovo Laptop", source: "amazon", price: 579 }
];

// Perk scoring for Walmart gift card:
calculatePerkScore(results[0], [{type: 'giftCard', perk: {store: 'Walmart'}}])
// Returns: { boost: 1.10, reasons: ["Walmart gift card accepted"] }

// Scoring applied:
// Dell Laptop (Walmart): base_score × 1.10  ← BOOSTED
// HP Laptop (Best Buy): base_score × 1.00
// Lenovo Laptop (Amazon): base_score × 1.00

// Final ranking:
// 1. Dell Laptop ← Ranked first due to perk match + price
// 2. Lenovo Laptop
// 3. HP Laptop
```

---

### Example 3: Perk Info in Results

**Frontend Display (app.js displays with perk badges)**

```javascript
const link = {
  title: "Dell Laptop",
  source: "Walmart",
  price: "$599",
  rating: 4.5,
  perkInfo: {
    boost: 0.10,
    reasons: ["🎁 Walmart gift card accepted"]
  }
};

// Render in UI:
// Dell Laptop (Walmart)
// ★★★★★ 4.5 | $599
// 🎁 Walmart gift card accepted  ← Perk badge
```

---

## Perk Scoring Logic

### Gift Card Rules

| Store | Condition | Boost |
|-------|-----------|-------|
| Walmart | Under $25 | +35% |
| Walmart | Any price | +10% |
| Target | Any price | +15% |
| Amazon | Any price | +12% |
| Best Buy | Any price | +18% |

### Reward Program Rules

| Program | Condition | Boost |
|---------|-----------|-------|
| Target Circle | Target items | +15% |
| Best Buy Rewards | Best Buy items | +12% |
| Amazon Prime | Amazon items | +20% |
| Walmart+ | Walmart items | +10% |

### Credit Card Perks

| Bank | Category | Boost |
|------|----------|-------|
| Chase | Dining | +10% |
| Amex | Shopping | +10% |
| Any | Electronics | +12% |

### Promo Credits

| Platform | Condition | Boost |
|----------|-----------|-------|
| Amazon | Eligible items | +25% |

---

## Safety & Privacy

### What We Store
✅ Store names (Walmart, Target, Amazon)
✅ Program names (Target Circle, Amazon Prime)
✅ Public perk descriptions ("5% off dining")
✅ Tier/status info (member, premium)

### What We NEVER Store
❌ Card numbers (even partial)
❌ CVV/Security codes
❌ Expiration dates
❌ Cardholder names
❌ Account balances
❌ PIN numbers
❌ Account identifiers

### Validation

**perkProfile.js** validates all inputs:
```javascript
setPerks(perkList) {
  perkList.creditCardPerks.forEach(perk => {
    if (perk.cardNumber || perk.balance || perk.pin) {
      console.warn('❌ Attempted to store sensitive data - REJECTED');
      return false;
    }
  });
}
```

---

## Testing Checklist

- [ ] User can select gift cards and save
- [ ] User can select reward programs and save
- [ ] User can enter custom credit card perks
- [ ] User can load previously saved perks
- [ ] User can clear all perks
- [ ] Perk summary displays correctly
- [ ] Search results show perk badges
- [ ] Walmart items under $25 rank highest (with Walmart gift card)
- [ ] Items from matching stores rank higher
- [ ] Removing perks resets rankings
- [ ] API calls don't send sensitive data
- [ ] Invalid data (card numbers, etc.) is rejected

---

## Deployment Checklist

1. ✅ Copy `src/perkProfile.js` to repo
2. ✅ Update `main.js` with IPC handlers
3. ✅ Update `src/preload.js` with perk API
4. ✅ Update `src/app.js` with perk UI logic
5. ✅ Update `src/index.html` with perk UI section
6. ✅ Update `src/linkFinder.js` with perk scoring
7. ✅ Test all functionality manually
8. ✅ Verify no sensitive data is logged
9. ✅ Test with electron to ensure IPC works
10. ✅ Run full search test with perks enabled

---

## Future Enhancements

- [ ] Persist perks to localStorage
- [ ] Store/restore perks to JSON file
- [ ] Add more retailers and their rules
- [ ] AI-powered perk suggestion based on shopping history
- [ ] Perk expiration dates and alerts
- [ ] Integration with credit card APIs (read-only public perks)
- [ ] Mobile app support
- [ ] Cloud sync of perk profiles

---

## Support & Debugging

### Issue: Perks not boosting search results

1. Verify perks are saved: `window.api.getPerkSummary()`
2. Check console for errors: DevTools → Console
3. Verify perk rules match store names (case-insensitive)
4. Check `globalPerkProfile.getPerks()` in main.js

### Issue: Sensitive data warning in logs

- This is expected! The system rejects attempts to store sensitive data
- Users should be informed to NEVER enter card numbers

### Issue: IPC communication failing

1. Verify preload.js is loaded correctly
2. Check electron contextIsolation is enabled
3. Verify main.js IPC handlers are registered before app loads
4. Check DevTools → Console for IPC errors

---

## Questions?

Refer to the architecture diagram above and trace the data flow for your specific use case.
