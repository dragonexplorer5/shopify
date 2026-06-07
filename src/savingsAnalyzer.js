/**
 * Savings Analyzer - Personalized Savings Opportunities
 * 
 * Uses Google Generative AI (Gemini) to analyze each product link and identify:
 * - How user can save money using their account benefits
 * - What conditions need to be met
 * - Estimated total savings
 * 
 * SAFETY: Analyzes public pricing data only
 * Never handles payment info or sensitive data
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class SavingsAnalyzer {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Analyze a product link and find savings opportunities
   * 
   * @param {Object} link - Product link object with title, price, source, etc.
   * @param {Array} accountBenefits - User's account benefits array
   * @returns {Promise<Object>} Savings analysis with opportunities
   * 
   * Example accountBenefits:
   * [
   *   {
   *     name: 'Uber Eats Credit',
   *     amount: 50,
   *     currency: 'USD',
   *     requirement: 'After 700 purchases',
   *     progress: 650,  // 650 out of 700 purchases
   *     available: false
   *   },
   *   {
   *     name: 'Walmart+ Membership',
   *     benefit: '5% off groceries',
   *     available: true
   *   }
   * ]
   */
  async analyzeLinkForSavings(link, accountBenefits = []) {
    try {
      if (!this.genAI || !process.env.GEMINI_API_KEY) {
        return {
          success: false,
          savings: [],
          totalPotentialSavings: '$0',
          reason: 'Gemini API not configured'
        };
      }

      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const accountBenefitsStr = JSON.stringify(accountBenefits, null, 2);
      const linkStr = JSON.stringify({
        title: link.title,
        price: link.price,
        source: link.source,
        category: link.category
      }, null, 2);

      const prompt = `You are a savings expert. Analyze this product and the user's account benefits to find ways they can save.

PRODUCT:
${linkStr}

USER'S ACCOUNT BENEFITS:
${accountBenefitsStr}

For each benefit that could apply to this product, provide:
1. The benefit name
2. How much they could save (specific amount or percentage)
3. What they need to do to use it (condition/requirement)
4. Is it available now or when will it be available

Respond in JSON format:
{
  "opportunities": [
    {
      "benefit": "Benefit name",
      "savings": "$15.50 or 10%",
      "description": "How to apply this benefit",
      "available": true/false,
      "estimatedNewPrice": "$XX.XX",
      "requirement": "What user needs to do"
    }
  ],
  "totalSavings": "$XX.XX",
  "bestOption": "Name of the best savings option",
  "recommendation": "Short recommendation text"
}

Be realistic and conservative in savings calculations.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          link: link.title,
          ...analysis
        };
      }

      return {
        success: false,
        savings: [],
        reason: 'Could not parse analysis'
      };
    } catch (error) {
      console.error('[SavingsAnalyzer] Error analyzing link:', error.message);
      return {
        success: false,
        savings: [],
        error: error.message
      };
    }
  }

  /**
   * Analyze multiple links in parallel
   * 
   * @param {Array} links - Array of product links
   * @param {Array} accountBenefits - User's account benefits
   * @returns {Promise<Array>} Array of savings analyses
   */
  async analyzeLinksForSavings(links, accountBenefits = []) {
    try {
      // Filter to top 5 results for efficiency
      const topLinks = links.slice(0, 5);

      const analyses = await Promise.allSettled(
        topLinks.map(link => this.analyzeLinkForSavings(link, accountBenefits))
      );

      return analyses
        .map((result, index) => ({
          index,
          link: topLinks[index],
          analysis: result.status === 'fulfilled' ? result.value : {
            success: false,
            error: result.reason?.message || 'Analysis failed'
          }
        }))
        .filter(item => item.analysis.success);
    } catch (error) {
      console.error('[SavingsAnalyzer] Error analyzing links:', error);
      return [];
    }
  }

  /**
   * Generate a savings summary for display
   * 
   * @param {Object} analysis - Result from analyzeLinkForSavings
   * @returns {String} Human-readable savings summary
   */
  formatSavingsSummary(analysis) {
    if (!analysis.success || !analysis.opportunities || analysis.opportunities.length === 0) {
      return 'No additional savings found';
    }

    const parts = [];
    parts.push(`💰 Total Potential Savings: ${analysis.totalSavings}`);

    analysis.opportunities.forEach(opp => {
      const status = opp.available ? '✅' : '⏳';
      parts.push(`${status} ${opp.benefit}: ${opp.savings}`);
    });

    if (analysis.recommendation) {
      parts.push(`\n💡 ${analysis.recommendation}`);
    }

    return parts.join('\n');
  }
}

module.exports = SavingsAnalyzer;
