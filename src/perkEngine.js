/**
 * Advanced Perk Engine
 * 
 * Manages:
 * - Gift cards (NO balances, NO card numbers - safety first)
 * - Reward programs with progress tracking
 * - Reward earning rules (how to earn points, stamps, tiers)
 * - Perk-based item scoring and eligibility
 * - Free-item eligibility tracking
 * - Earning suggestions (how to maximize rewards)
 * 
 * SAFETY: Never handles money, payments, or sensitive financial data
 * Only stores public perk rules and reward progress metrics
 */

class PerkEngine {
  constructor() {
    // Core perk storage
    this.giftCards = [];      // [{ store: 'Walmart' }, { store: 'Target' }]
    this.rewardPrograms = []; // [{ name: 'Target Circle', tier: 'member' }, ...]
    this.creditCardPerks = [];// [{ bank: 'Chase', category: 'Dining', benefit: '5% back' }, ...]
    
    // Reward progress tracking (points, stamps, tiers, etc.)
    this.rewardProgress = {};
    // Example: {
    //   'target-circle': { points: 150, tier: 'member', nextTierAt: 500, lastUpdate: timestamp },
    //   'best-buy-rewards': { points: 280, stamps: 3, nextFreeAt: 5, earning: 1.5 },
    //   'starbucks': { stamps: 7, nextFreeAt: 10, estimatedValue: '$3.50' }
    // }
    
    // Account-based benefits (spend requirements, credit amounts, purchase counts)
    this.accountBenefits = [];
    // Example: {
    //   'uber-eats': {
    //     name: 'Uber Eats Credit',
    //     amount: 50,
    //     currency: 'USD',
    //     requirement: 'After 700 purchases',
    //     progress: 650,
    //     progressType: 'purchases',
    //     available: false,
    //     estimatedUnlock: '50 more purchases'
    //   },
    //   'doordash': {
    //     name: 'DoorDash Free Delivery',
    //     requirement: '$5 minimum order',
    //     available: true
    //   }
    // }
    
    // Rules for how perks apply to items
    this.perkRules = this._initializePerkRules();
    
    // Rules for how to earn rewards
    this.earningRules = this._initializeEarningRules();
  }

  /**
   * Define perk rules - how perks apply to items and categories
   */
  _initializePerkRules() {
    return {
      'walmart-gift-card': {
        name: 'Walmart Gift Card',
        freeItemThreshold: 25.00,    // Items under $25 are "free-eligible"
        boostMultiplier: 1.35,       // 35% score boost for Walmart items
        benefitLabel: 'Free with gift card',
        eligible: ['grocery', 'household', 'electronics', 'clothing', 'toys']
      },
      'target-circle': {
        name: 'Target Circle',
        discountPercent: 5,          // 5% off eligible items
        boostMultiplier: 1.15,       // 15% score boost
        benefitLabel: 'Target Circle member deal',
        eligible: ['household', 'apparel', 'toys', 'beauty', 'electronics']
      },
      'amazon-prime': {
        name: 'Amazon Prime',
        freeShipping: true,
        discountPercent: 10,         // Up to 10% off select items
        boostMultiplier: 1.20,       // 20% score boost
        benefitLabel: 'Prime eligible',
        eligible: ['electronics', 'books', 'apparel', 'home', 'toys']
      },
      'best-buy-rewards': {
        name: 'Best Buy Rewards',
        pointsEarnRate: 1.0,         // 1% back in points
        boostMultiplier: 1.12,       // 12% score boost
        benefitLabel: 'Rewards member',
        eligible: ['electronics', 'appliances', 'gaming', 'computing']
      },
      'chase-dining': {
        name: 'Chase Sapphire: 5% Dining',
        discountPercent: 5,
        boostMultiplier: 1.10,
        category: 'Dining',
        benefitLabel: 'Credit card perk',
        eligible: ['dining']
      },
      'amex-shopping': {
        name: 'Amex Gold: 4% Shopping',
        discountPercent: 4,
        boostMultiplier: 1.08,
        category: 'Shopping',
        benefitLabel: 'Credit card perk',
        eligible: ['shopping', 'electronics', 'apparel']
      }
    };
  }

  /**
   * Define earning rules - how users earn rewards
   */
  _initializeEarningRules() {
    return {
      'target-circle': {
        program: 'Target Circle',
        earningRate: 1,             // 1 point per $1 spent
        nextTierAt: 500,            // Tier up at 500 points
        tiers: ['member', 'gold', 'platinum'],
        tierBenefits: {
          'member': { bonus: 0 },
          'gold': { bonus: 0.05 },           // +5% bonus
          'platinum': { bonus: 0.10 }        // +10% bonus
        }
      },
      'best-buy-rewards': {
        program: 'Best Buy Rewards',
        earningRate: 1.5,           // 1.5 points per $1 spent
        nextFreeAt: 500,            // Free $5 item at 500 points
        stamps: { 
          earnsPerPurchase: 1,
          nextFreeItemAt: 10         // Free item at 10 stamps
        },
        bonusCategories: {
          'electronics': 2.0,        // 2× points on electronics
          'gaming': 2.0              // 2× points on gaming
        }
      },
      'starbucks': {
        program: 'Starbucks Rewards',
        stamps: {
          earnsPerPurchase: 1,
          nextFreeItemAt: 10,        // Free drink at 10 stamps
          nextFreeItemValue: '$5.00'
        },
        tiers: ['member', 'gold', 'platinum'],
        earningBonus: {
          'gold': 1.5,               // 1.5× earn rate
          'platinum': 2.0            // 2× earn rate
        }
      },
      'walmart-plus': {
        program: 'Walmart+',
        discountPercent: 5,          // 5% off select items
        earningRate: 1,
        freeShipping: true,
        gasDiscount: true            // Fuel discounts
      },
      'amazon-prime': {
        program: 'Amazon Prime',
        membershipBenefit: 'prime-exclusive',
        earningRate: 0,              // Points vary by category
        freeShipping: true,
        memberExclusiveDeals: true
      }
    };
  }

  /**
   * Set user's gift cards and reward programs
   * Validates input - REJECTS card numbers, balances, sensitive data
   */
  setPerks(perkList) {
    try {
      // Validate no sensitive data in input
      const sensitiveFields = ['cardNumber', 'cvv', 'pin', 'balance', 'accountId', 
                               'expiryDate', 'cvc', 'ssn', 'password'];
      
      const jsonStr = JSON.stringify(perkList);
      for (const field of sensitiveFields) {
        if (jsonStr.toLowerCase().includes(field.toLowerCase())) {
          throw new Error(`❌ Cannot store sensitive field: ${field}`);
        }
      }

      // Clear and rebuild perks
      this.giftCards = perkList.giftCards || [];
      this.rewardPrograms = perkList.rewardPrograms || [];
      this.creditCardPerks = perkList.creditCardPerks || [];
      
      // Initialize reward progress for new programs
      perkList.rewardPrograms?.forEach(program => {
        if (!this.rewardProgress[program.name]) {
          this.rewardProgress[program.name] = this._initializeRewardProgress(program.name);
        }
      });

      return { 
        success: true, 
        message: '✅ Perks saved successfully',
        summary: this.getSummary()
      };
    } catch (error) {
      return { 
        success: false, 
        message: `❌ Error: ${error.message}`
      };
    }
  }

  /**
   * Get current perks
   */
  getPerks() {
    return {
      giftCards: this.giftCards,
      rewardPrograms: this.rewardPrograms,
      creditCardPerks: this.creditCardPerks
    };
  }

  /**
   * Update reward progress for a specific program
   * Example: updateRewardProgress('target-circle', { points: 250, tier: 'gold' })
   */
  updateRewardProgress(programName, progressData) {
    try {
      if (!this.rewardProgress[programName]) {
        this.rewardProgress[programName] = {};
      }
      
      // Update progress (no money/balance fields allowed)
      this.rewardProgress[programName] = {
        ...this.rewardProgress[programName],
        ...progressData,
        lastUpdate: new Date().toISOString()
      };

      return {
        success: true,
        message: `✅ Updated ${programName}`,
        progress: this.rewardProgress[programName]
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Error updating progress: ${error.message}`
      };
    }
  }

  /**
   * Get reward progress for a specific program
   */
  getRewardProgress(programName) {
    return this.rewardProgress[programName] || null;
  }

  /**
   * Get all reward progress
   */
  getAllRewardProgress() {
    return this.rewardProgress;
  }

  /**
   * Initialize default reward progress for a program
   */
  _initializeRewardProgress(programName) {
    const rules = this.earningRules[programName] || {};
    
    return {
      name: programName,
      points: 0,
      stamps: 0,
      tier: 'member',
      joinDate: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      earningRate: rules.earningRate || 1,
      nextMilestone: rules.nextFreeAt || rules.nextTierAt || 100
    };
  }

  /**
   * Get earning suggestions based on current progress
   * Returns array of suggestions for how to maximize rewards
   */
  getEarningPath(item) {
    const suggestions = [];

    // Check each reward program
    for (const programName in this.rewardProgress) {
      const progress = this.rewardProgress[programName];
      const rules = this.earningRules[programName];
      if (!rules) continue;

      // How much would this item earn?
      const itemPrice = item.priceNumber || 0;
      const earnedPoints = Math.ceil(itemPrice * (rules.earningRate || 1));
      const earnedStamps = rules.stamps?.earnsPerPurchase || 0;

      // Build suggestion
      const suggestion = {
        program: programName,
        earnedPoints,
        earnedStamps,
        progress: progress
      };

      // Calculate progress toward next milestone
      if (rules.nextFreeAt) {
        const pointsNeeded = rules.nextFreeAt - progress.points;
        suggestion.pointsNeeded = Math.max(0, pointsNeeded);
        suggestion.milestone = `Free item at ${rules.nextFreeAt} points`;
        
        if (pointsNeeded <= earnedPoints) {
          suggestion.special = `🎉 This purchase could earn you a FREE ITEM!`;
        }
      }

      if (rules.stamps?.nextFreeItemAt) {
        const stampsNeeded = rules.stamps.nextFreeItemAt - progress.stamps;
        suggestion.stampsNeeded = Math.max(0, stampsNeeded);
        
        if (stampsNeeded <= earnedStamps) {
          suggestion.special = `🎉 This purchase could earn you a FREE ${rules.stamps.nextFreeItemValue || 'ITEM'}!`;
        }
      }

      // Check bonus categories
      if (rules.bonusCategories && item.category) {
        const multiplier = rules.bonusCategories[item.category];
        if (multiplier) {
          suggestion.bonusMultiplier = multiplier;
          suggestion.bonusLabel = `${multiplier}× points in ${item.category}`;
          suggestion.adjustedEarnings = Math.ceil(earnedPoints * multiplier);
        }
      }

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Calculate free-item eligibility
   * Returns { eligible: true/false, reason: string }
   */
  checkFreeItemEligibility(item) {
    const eligible = [];

    // Check Walmart gift card eligibility
    const hasWalmartGC = this.giftCards.some(gc => gc.store === 'Walmart');
    if (hasWalmartGC && item.priceNumber < 25) {
      eligible.push({
        perk: 'Walmart Gift Card',
        reason: `Items under $25 are free-eligible with Walmart gift card`,
        eligiblePrice: item.priceNumber
      });
    }

    // Check Target Circle eligibility
    const hasTargetCircle = this.rewardPrograms.some(rp => rp.name === 'Target Circle');
    if (hasTargetCircle && item.source === 'Target') {
      eligible.push({
        perk: 'Target Circle',
        reason: '5% Circle member discount on Target items',
        discount: '5%'
      });
    }

    // Check Amazon Prime eligibility
    const hasAmazonPrime = this.rewardPrograms.some(rp => rp.name === 'Amazon Prime');
    if (hasAmazonPrime && item.source === 'Amazon') {
      eligible.push({
        perk: 'Amazon Prime',
        reason: 'Prime member benefits on Amazon items',
        freeShipping: true
      });
    }

    return {
      eligible: eligible.length > 0,
      eligibilities: eligible,
      totalEligibilities: eligible.length
    };
  }

  /**
   * Calculate perk-aware score boost for an item
   * Returns { boost: 1.0-1.50, reasons: [string], perksApplied: [string] }
   */
  calculatePerkScore(item) {
    let totalBoost = 1.0;
    const reasons = [];
    const perksApplied = [];

    // Check each perk against item
    for (const gc of this.giftCards) {
      const rule = this.perkRules[`${gc.store.toLowerCase()}-gift-card`];
      if (!rule) continue;

      if (item.source === gc.store) {
        if (item.priceNumber < rule.freeItemThreshold) {
          totalBoost *= rule.boostMultiplier;
          reasons.push(`🎁 ${gc.store} gift card (items under $${rule.freeItemThreshold})`);
          perksApplied.push(gc.store);
        } else {
          totalBoost *= 1.10; // Smaller boost for items over threshold
          reasons.push(`🎁 ${gc.store} gift card accepted`);
          perksApplied.push(gc.store);
        }
        break;
      }
    }

    // Check reward programs
    for (const rp of this.rewardPrograms) {
      const rule = this.perkRules[rp.name.toLowerCase().replace(' ', '-')];
      if (!rule) continue;

      if (item.source === rule.name) {
        totalBoost *= rule.boostMultiplier;
        reasons.push(`🏆 ${rp.name} member benefit`);
        perksApplied.push(rp.name);
      }
    }

    // Check credit card perks
    for (const perk of this.creditCardPerks) {
      const ruleKey = `${perk.bank.toLowerCase()}-${perk.category.toLowerCase()}`;
      const rule = this.perkRules[ruleKey];
      if (!rule) continue;

      if (item.category === perk.category) {
        totalBoost *= rule.boostMultiplier;
        reasons.push(`💳 ${perk.bank} (${perk.benefit})`);
        perksApplied.push(perk.bank);
      }
    }

    return {
      boost: Math.min(totalBoost, 1.50), // Cap at 50% boost
      reasons,
      perksApplied,
      boostPercentage: Math.round((totalBoost - 1.0) * 100)
    };
  }

  /**
   * Get user-friendly summary of perks
   */
  getSummary() {
    const parts = [];
    if (this.giftCards.length > 0) {
      parts.push(`${this.giftCards.length} gift card(s)`);
    }
    if (this.rewardPrograms.length > 0) {
      parts.push(`${this.rewardPrograms.length} reward program(s)`);
    }
    if (this.creditCardPerks.length > 0) {
      parts.push(`${this.creditCardPerks.length} credit card perk(s)`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'No perks saved';
  }

  /**
   * Clear all perks and reward progress
   */
  clearAll() {
    this.giftCards = [];
    this.rewardPrograms = [];
    this.creditCardPerks = [];
    this.rewardProgress = {};
    this.accountBenefits = [];
    return { success: true, message: '✅ All perks cleared' };
  }

  /**
   * Add account-based benefit
   * Examples:
   * - Uber Eats: $50 free after 700 purchases
   * - DoorDash: Free delivery on orders $15+
   * - Amazon Fresh: $100 credit after $500 spent
   */
  addAccountBenefit(benefit) {
    try {
      if (!benefit.name) {
        throw new Error('Benefit must have a name');
      }

      const benefitId = benefit.name.toLowerCase().replace(/\s+/g, '-');
      
      this.accountBenefits.push({
        id: benefitId,
        name: benefit.name,
        amount: benefit.amount || null,       // e.g., $50
        currency: benefit.currency || 'USD',
        requirement: benefit.requirement || '', // e.g., "After 700 purchases"
        progress: benefit.progress || 0,       // e.g., 650 purchases
        progressType: benefit.progressType || 'purchases', // purchases, spending, days, etc.
        total: benefit.total || null,          // e.g., 700 (total purchases needed)
        available: benefit.available || false,
        description: benefit.description || '',
        addedDate: new Date().toISOString()
      });

      return {
        success: true,
        message: `✅ Added account benefit: ${benefit.name}`
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Error adding benefit: ${error.message}`
      };
    }
  }

  /**
   * Update account benefit progress
   */
  updateAccountBenefitProgress(benefitId, progress) {
    try {
      const benefit = this.accountBenefits.find(b => b.id === benefitId);
      if (!benefit) {
        throw new Error(`Benefit not found: ${benefitId}`);
      }

      benefit.progress = progress;

      // Check if benefit is now available
      if (benefit.total && progress >= benefit.total) {
        benefit.available = true;
      }

      return {
        success: true,
        message: `✅ Updated ${benefit.name}`,
        benefit
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Error: ${error.message}`
      };
    }
  }

  /**
   * Get account benefits in format for Gemini analysis
   */
  getAccountBenefitsForAnalysis() {
    return this.accountBenefits.map(benefit => ({
      name: benefit.name,
      amount: benefit.amount,
      currency: benefit.currency,
      requirement: benefit.requirement,
      progress: benefit.progress,
      progressType: benefit.progressType,
      total: benefit.total,
      available: benefit.available,
      description: benefit.description,
      estimatedUnlock: this._calculateEstimate(benefit)
    }));
  }

  /**
   * Calculate how close user is to unlocking benefit
   */
  _calculateEstimate(benefit) {
    if (benefit.available) return 'Available now!';
    if (!benefit.total || benefit.progress === undefined) return null;

    const remaining = benefit.total - benefit.progress;
    return `${remaining} more ${benefit.progressType} until unlock`;
  }

  /**
   * Get available account benefits summary
   */
  getAvailableAccountBenefits() {
    return this.accountBenefits.filter(b => b.available);
  }

  /**
   * Get account benefits that are close to being unlocked
   */
  getAlmostUnlockedBenefits(threshold = 20) {
    return this.accountBenefits.filter(benefit => {
      if (benefit.available || !benefit.total) return false;
      const percentComplete = (benefit.progress / benefit.total) * 100;
      return percentComplete >= (100 - threshold);
    });
  }

  /**
   * Get account benefits summary for display
   */
  getAccountBenefitsSummary() {
    const available = this.accountBenefits.filter(b => b.available).length;
    const almostUnlocked = this.getAlmostUnlockedBenefits().length;
    const total = this.accountBenefits.length;

    if (total === 0) return 'No account benefits added';
    
    const parts = [];
    if (available > 0) parts.push(`${available} available`);
    if (almostUnlocked > 0) parts.push(`${almostUnlocked} almost unlocked`);
    parts.push(`${total} total`);

    return `Account Benefits: ${parts.join(', ')}`;
  }
}

module.exports = PerkEngine;
