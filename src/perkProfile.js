/**
 * Perk Profile System
 * 
 * Manages user's gift cards, store reward programs, and public credit card perks
 * SAFETY: Never stores sensitive data like card numbers, PINs, or balances
 * Only stores public perk benefits and eligibility rules
 */

class PerkProfile {
  constructor() {
    // In-memory perk storage
    this.perks = {
      giftCards: [],        // e.g., { store: 'Walmart', amount: null } (no amount stored)
      rewardPrograms: [],   // e.g., { program: 'Target Circle', tier: 'member' }
      creditCardPerks: [],  // e.g., { bank: 'Chase', category: 'Dining', benefit: '5% off' }
      storeCoupons: [],     // e.g., { store: 'Best Buy', description: 'Member exclusive' }
      promoCredits: []      // e.g., { platform: 'Amazon', description: 'Promo credit' }
    };

    // Perk-specific rules for applying benefits during shopping
    this.perkRules = this._initializePerkRules();
  }

  /**
   * Initialize default perk rules for popular retailers
   * These rules define how perks apply to items and categories
   */
  _initializePerkRules() {
    return {
      'walmart-gift-card': {
        name: 'Walmart Gift Card',
        freeItemThreshold: 25.00,           // Items under $25 highlighted as "free-eligible"
        benefitLabel: 'Free with gift card', // How to label items in UI
        eligible: ['grocery', 'household', 'electronics', 'clothing']
      },
      'target-circle': {
        name: 'Target Circle',
        discountPercent: 5,                 // Circle members get 5% off select items
        benefitLabel: 'Target Circle deal',
        eligible: ['household', 'apparel', 'toys', 'beauty']
      },
      'amazon-promo': {
        name: 'Amazon Promo Credit',
        benefitLabel: 'Eligible for promo',
        eligible: ['electronics', 'books', 'apparel']
      },
      'best-buy-rewards': {
        name: 'Best Buy Rewards',
        pointsMultiplier: 2.0,              // Double points on eligible items
        benefitLabel: 'Double points item',
        eligible: ['electronics', 'appliances', 'computing']
      },
      'store-exclusive': {
        name: 'Store Exclusive',
        benefitLabel: 'Member exclusive',
        eligible: ['all']
      }
    };
  }

  /**
   * Set user's perks
   * @param {Object} perkList - Object containing perk arrays
   * @example
   * setPerk({
   *   giftCards: [{ store: 'Walmart' }],
   *   rewardPrograms: [{ program: 'Target Circle', tier: 'member' }],
   *   creditCardPerks: [{ bank: 'Chase', category: 'Dining', benefit: '5% off' }],
   *   storeCoupons: [{ store: 'Best Buy', description: 'Member exclusive' }],
   *   promoCredits: [{ platform: 'Amazon', description: 'Promo credit available' }]
   * })
   */
  setPerks(perkList) {
    try {
      // Validate and sanitize input
      if (!perkList || typeof perkList !== 'object') {
        console.warn('[PerkProfile] Invalid perk list provided');
        return false;
      }

      // Update each perk category with validation
      if (Array.isArray(perkList.giftCards)) {
        this.perks.giftCards = perkList.giftCards.filter(p => p.store && typeof p.store === 'string');
      }
      if (Array.isArray(perkList.rewardPrograms)) {
        this.perks.rewardPrograms = perkList.rewardPrograms.filter(p => p.program && typeof p.program === 'string');
      }
      if (Array.isArray(perkList.creditCardPerks)) {
        // Safety check: ensure no card numbers or balances are stored
        this.perks.creditCardPerks = perkList.creditCardPerks.filter(p => {
          if (p.cardNumber || p.balance || p.pin) {
            console.warn('[PerkProfile] Attempted to store sensitive card data - REJECTED');
            return false;
          }
          return p.bank && p.category && p.benefit;
        });
      }
      if (Array.isArray(perkList.storeCoupons)) {
        this.perks.storeCoupons = perkList.storeCoupons.filter(p => p.store && p.description);
      }
      if (Array.isArray(perkList.promoCredits)) {
        this.perks.promoCredits = perkList.promoCredits.filter(p => p.platform && p.description);
      }

      console.log('[PerkProfile] Perks updated successfully:', this.perks);
      return true;
    } catch (error) {
      console.error('[PerkProfile] Error setting perks:', error);
      return false;
    }
  }

  /**
   * Get all user perks
   * @returns {Object} Current perk configuration
   */
  getPerks() {
    return JSON.parse(JSON.stringify(this.perks)); // Deep copy to prevent mutations
  }

  /**
   * Get perks by category
   * @param {string} category - 'giftCards', 'rewardPrograms', 'creditCardPerks', 'storeCoupons', 'promoCredits'
   * @returns {Array} Perks in the specified category
   */
  getPerksByCategory(category) {
    if (this.perks[category]) {
      return JSON.parse(JSON.stringify(this.perks[category]));
    }
    return [];
  }

  /**
   * Check if user has a specific perk type
   * @param {string} store - Store or program name to check
   * @returns {Object|null} Perk details if found, null otherwise
   */
  hasPerk(store) {
    const store_lower = store.toLowerCase();
    
    // Check all perk categories
    for (const perk of this.perks.giftCards) {
      if (perk.store.toLowerCase() === store_lower) return { type: 'giftCard', perk };
    }
    for (const perk of this.perks.rewardPrograms) {
      if (perk.program.toLowerCase() === store_lower) return { type: 'rewardProgram', perk };
    }
    for (const perk of this.perks.storeCoupons) {
      if (perk.store.toLowerCase() === store_lower) return { type: 'coupon', perk };
    }
    
    return null;
  }

  /**
   * Get applicable perk rules for a store/category combination
   * @param {string} store - Store name
   * @param {string} category - Item category (electronics, grocery, etc.)
   * @returns {Object|null} Perk rule if applicable
   */
  getApplicableRules(store, category) {
    const ruleKey = this._generateRuleKey(store);
    const rule = this.perkRules[ruleKey];

    if (!rule) return null;

    // Check if category is eligible for this rule
    if (rule.eligible.includes(category) || rule.eligible.includes('all')) {
      return rule;
    }

    return null;
  }

  /**
   * Generate a normalized rule key from store name
   * @private
   * @param {string} store - Store name
   * @returns {string} Normalized rule key
   */
  _generateRuleKey(store) {
    return store.toLowerCase().replace(/\s+/g, '-') + '-gift-card';
  }

  /**
   * Get all active perk benefit labels
   * @returns {Array} Array of benefit labels for UI display
   */
  getActiveBenefitLabels() {
    const labels = [];

    this.perks.giftCards.forEach(gc => {
      const rule = this.perkRules['walmart-gift-card'] || this.perkRules['store-exclusive'];
      labels.push({
        store: gc.store,
        label: rule?.benefitLabel || 'Gift card benefit',
        type: 'giftCard'
      });
    });

    this.perks.rewardPrograms.forEach(rp => {
      const rule = this.perkRules['target-circle'] || this.perkRules['store-exclusive'];
      labels.push({
        store: rp.program,
        label: rule?.benefitLabel || 'Reward program benefit',
        type: 'rewardProgram'
      });
    });

    this.perks.creditCardPerks.forEach(ccp => {
      labels.push({
        store: `${ccp.bank} - ${ccp.category}`,
        label: `${ccp.benefit} on ${ccp.category}`,
        type: 'creditCard'
      });
    });

    this.perks.storeCoupons.forEach(sc => {
      labels.push({
        store: sc.store,
        label: sc.description,
        type: 'coupon'
      });
    });

    this.perks.promoCredits.forEach(pc => {
      labels.push({
        store: pc.platform,
        label: pc.description,
        type: 'promoCredit'
      });
    });

    return labels;
  }

  /**
   * Clear all perks
   */
  clearAllPerks() {
    this.perks = {
      giftCards: [],
      rewardPrograms: [],
      creditCardPerks: [],
      storeCoupons: [],
      promoCredits: []
    };
    console.log('[PerkProfile] All perks cleared');
  }

  /**
   * Get a summary of active perks for quick UI display
   * @returns {string} Human-readable summary
   */
  getSummary() {
    const counts = {
      giftCards: this.perks.giftCards.length,
      rewardPrograms: this.perks.rewardPrograms.length,
      creditCardPerks: this.perks.creditCardPerks.length,
      storeCoupons: this.perks.storeCoupons.length,
      promoCredits: this.perks.promoCredits.length
    };

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    if (total === 0) {
      return 'No perks configured';
    }

    const parts = [];
    if (counts.giftCards > 0) parts.push(`${counts.giftCards} gift card(s)`);
    if (counts.rewardPrograms > 0) parts.push(`${counts.rewardPrograms} reward program(s)`);
    if (counts.creditCardPerks > 0) parts.push(`${counts.creditCardPerks} credit card perk(s)`);
    if (counts.storeCoupons > 0) parts.push(`${counts.storeCoupons} coupon(s)`);
    if (counts.promoCredits > 0) parts.push(`${counts.promoCredits} promo credit(s)`);

    return parts.join(', ');
  }
}

// Export the PerkProfile class
module.exports = PerkProfile;
