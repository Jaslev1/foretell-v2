// api/kalshi-markets.js
// Vercel Serverless Function to fetch Kalshi markets
// RECALIBRATED VERSION - Based on 279-bet analysis

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
    
    // Fetch markets from Kalshi
    const response = await fetch(`${KALSHI_API_BASE}/markets?limit=1000&status=open`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Kalshi API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process markets with new recalibrated algorithm
    const opportunities = processMarkets(data.markets || []);
    
    res.status(200).json({ 
      success: true,
      opportunities,
      count: opportunities.length,
      timestamp: new Date().toISOString(),
      version: '2.0-recalibrated'
    });
    
  } catch (error) {
    console.error('Error fetching Kalshi data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

function processMarkets(markets) {
  const now = new Date();
  
  return markets
    .filter(m => {
      // Must have pricing data
      if (!m.yes_bid || !m.yes_ask) return false;
      
      // Filter out extremely wide spreads
      const spread = (m.yes_ask - m.yes_bid) / 100;
      if (spread > 0.35) return false;
      
      return true;
    })
    .map(m => {
      const yesPrice = m.yes_ask / 100; // Price to buy YES
      const probability = ((m.yes_bid + m.yes_ask) / 2) / 100; // Midpoint probability
      const spread = (m.yes_ask - m.yes_bid) / 100;
      
      // Calculate days and hours to expiry
      const expiryDate = new Date(m.close_time);
      const msToExpiry = expiryDate - now;
      const expiryDays = Math.max(0, Math.ceil(msToExpiry / (1000 * 60 * 60 * 24)));
      const hoursToExpiry = Math.max(0, msToExpiry / (1000 * 60 * 60));
      
      // NEW: Calculate Expected Value
      const ev = calculateExpectedValue(probability, yesPrice);
      
      // NEW: Calculate Risk/Reward Ratio
      const riskRewardRatio = calculateRiskRewardRatio(yesPrice);
      
      // NEW: Calculate Edge (our confidence vs market price)
      const edge = probability - yesPrice;
      
      return {
        id: m.ticker,
        title: m.title.replace(/^yes\s+/i, '').trim(),
        category: categorizeMarket(m.ticker, m.title),
        probability,
        yesPrice,
        payout: probability > 0 ? 1 / probability : 0,
        volume: m.volume || 0,
        spread,
        expiryDays,
        hoursToExpiry,
        
        // NEW METRICS
        expectedValue: ev,
        edge,
        riskRewardRatio,
        maxWin: 1 - yesPrice,
        maxLoss: yesPrice,
        
        // Recalibrated risk score
        riskScore: calculateRiskScore(m, spread, probability, yesPrice, hoursToExpiry, edge),
        
        marketUrl: m.market_url || `https://kalshi.com/markets/${m.ticker.toLowerCase()}`
      };
    })
    .filter(opp => {
      // NEW: CRITICAL FILTERS BASED ON ANALYSIS
      
      // Filter 1: Must have positive EV > 5%
      if (opp.expectedValue < 0.05) return false;
      
      // Filter 2: Avoid expensive favorites (learned from 60-100¢ losses)
      // Only allow expensive bets if edge is very strong
      if (opp.yesPrice > 0.70 && opp.edge < 0.10) return false;
      
      // Filter 3: Avoid terrible risk/reward ratios
      if (opp.riskRewardRatio > 4) return false;
      
      // Filter 4: Prefer sweet spot time windows (6-24hr profitable zone)
      // Don't filter out, but will be ranked lower
      
      return true;
    })
    .sort((a, b) => {
      // NEW SORTING: Prioritize EV, then risk score, then volume
      
      // First: Sort by EV (higher is better)
      const evDiff = b.expectedValue - a.expectedValue;
      if (Math.abs(evDiff) > 0.02) return evDiff;
      
      // Second: Sort by risk score (lower is better)
      if (a.riskScore !== b.riskScore) return a.riskScore - b.riskScore;
      
      // Third: Sort by volume (higher is better)
      return b.volume - a.volume;
    })
    .slice(0, 100); // Top 100 opportunities
}

function categorizeMarket(ticker, title) {
  const t = (ticker + ' ' + title).toLowerCase();
  
  // Sports - EXPANDED (major loss category)
  if (t.includes('nba') || t.includes('nfl') || t.includes('mlb') || t.includes('nhl') ||
      t.includes('lakers') || t.includes('chiefs') || t.includes('super bowl') ||
      t.includes('march madness') || t.includes('ncaa') || t.includes('premier league') ||
      t.includes('champions league') || t.includes('world cup') || t.includes('masters') ||
      t.includes('pga') || t.includes('ufc') || t.includes('boxing') || t.includes('tennis') ||
      t.includes('atp') || t.includes('wta') || t.includes('game') || t.includes('match') ||
      t.includes('eurogame') || t.includes('euroleague') || t.includes('superlig')) return 'Sports';
  
  // Economics
  if (t.includes('fed') || t.includes('gdp') || t.includes('inflation') || 
      t.includes('cpi') || t.includes('unemployment') || t.includes('jobs') ||
      t.includes('treasury') || t.includes('housing') || t.includes('retail sales') ||
      t.includes('gas') || t.includes('price')) return 'Economics';
  
  // Crypto
  if (t.includes('btc') || t.includes('bitcoin') || t.includes('eth') || 
      t.includes('ethereum') || t.includes('crypto') || t.includes('sol') ||
      t.includes('solana') || t.includes('coinbase')) return 'Crypto';
  
  // Stocks
  if (t.includes('nvda') || t.includes('nvidia') || t.includes('tsla') || 
      t.includes('tesla') || t.includes('stock') || t.includes('earnings') ||
      t.includes('aapl') || t.includes('apple') || t.includes('amzn') ||
      t.includes('meta') || t.includes('msft') || t.includes('s&p') ||
      t.includes('nasdaq') || t.includes('dow')) return 'Stocks';
  
  // Tech
  if (t.includes('ai ') || t.includes('google') || t.includes('microsoft') || 
      t.includes('tech') || t.includes('software') || t.includes('openai') ||
      t.includes('chatgpt') || t.includes('gemini')) return 'Tech';
  
  // Politics - FILTERED (attendance markets were losers)
  if (t.includes('election') || t.includes('congress') || t.includes('senate') ||
      t.includes('president') || t.includes('trump') || t.includes('biden') ||
      t.includes('democrat') || t.includes('republican') || t.includes('scotus') ||
      t.includes('supreme court') || t.includes('approval') || t.includes('sotu')) return 'Politics';
  
  // Weather
  if (t.includes('weather') || t.includes('temperature') || t.includes('snow') ||
      t.includes('rain') || t.includes('hurricane') || t.includes('storm')) return 'Weather';
  
  // Entertainment
  if (t.includes('oscar') || t.includes('grammy') || t.includes('emmy') ||
      t.includes('movie') || t.includes('box office') || t.includes('netflix') ||
      t.includes('streaming') || t.includes('taylor swift') || t.includes('model') ||
      t.includes('topmodel')) return 'Entertainment';
  
  return 'Other';
}

function calculateExpectedValue(probability, price, feeRate = 0.07) {
  // Calculate expected return
  const payout = 1 - price; // What you win if correct
  const risk = price; // What you lose if wrong
  
  const expectedReturn = (probability * payout) - ((1 - probability) * risk);
  
  // Account for fees (7% total: ~3.5% open + ~3.5% close)
  const fees = (price + Math.abs(payout)) * (feeRate / 2);
  
  return expectedReturn - fees;
}

function calculateRiskRewardRatio(price) {
  // How much you risk vs how much you can win
  const maxLoss = price;
  const maxWin = 1 - price;
  
  if (maxWin === 0) return 999; // Avoid division by zero
  
  return maxLoss / maxWin;
}

function calculateRiskScore(market, spread, probability, yesPrice, hoursToExpiry, edge) {
  const { volume = 0, ticker = '', title = '' } = market;
  
  let risk = 5; // Start at medium risk
  
  // Volume adjustments (same as before)
  if (volume > 200000) risk -= 2;
  else if (volume > 100000) risk -= 1;
  else if (volume < 20000) risk += 2;
  else if (volume < 50000) risk += 1;
  
  // Spread adjustments (same as before)
  if (spread < 0.05) risk -= 1;
  else if (spread < 0.10) risk -= 0.5;
  else if (spread > 0.25) risk += 2;
  else if (spread > 0.15) risk += 1;
  
  // NEW: Asymmetric Risk Penalty (addresses favorite bias)
  const riskRewardRatio = yesPrice / (1 - yesPrice);
  if (riskRewardRatio > 4) risk += 3;  // e.g., 80¢ YES bets
  else if (riskRewardRatio > 3) risk += 2;  // e.g., 75¢ YES bets
  else if (riskRewardRatio > 2) risk += 1;  // e.g., 67¢ YES bets
  
  // NEW: Favorite Bias Penalty (double-penalty for expensive + confident)
  if (yesPrice > 0.70 && probability > 0.70) {
    risk += 2; // Heavily penalize buying expensive favorites
  }
  
  // NEW: Underdog Bonus (reward finding underpriced underdogs)
  if (yesPrice < 0.40 && edge > 0.10) {
    risk -= 2; // Big bonus for strong edge on cheap bets
  } else if (yesPrice < 0.50 && edge > 0.08) {
    risk -= 1; // Moderate bonus
  }
  
  // NEW: Time Window Adjustment (based on actual performance)
  if (hoursToExpiry >= 6 && hoursToExpiry <= 24) {
    risk -= 1.5; // SWEET SPOT: 6-24 hour window (85.3% win rate)
  } else if (hoursToExpiry < 1) {
    risk -= 0.5; // Also profitable: <1 hour window (78.9% win rate)
  } else if (hoursToExpiry >= 1 && hoursToExpiry < 6) {
    risk += 2; // DANGER ZONE: 1-6 hour window (lost $155)
  } else if (hoursToExpiry > 72) {
    risk += 1; // Multi-day holds underperformed
  }
  
  // NEW: Category-Specific Adjustments (based on worst performers)
  const t = (ticker + ' ' + title).toLowerCase();
  
  // Sports: Penalize heavy favorites (many losses here)
  if ((t.includes('match') || t.includes('game')) && yesPrice > 0.70) {
    risk += 1.5;
  }
  
  // Politics: Penalize attendance/ceremonial markets (KXATTENDSOTU losses)
  if (t.includes('attend') || t.includes('sotu') || t.includes('appear')) {
    risk += 2;
  }
  
  // Entertainment: Slight bonus (performed well in top 10)
  if (t.includes('model') || t.includes('oscar') || t.includes('grammy')) {
    risk -= 0.5;
  }
  
  // Coin-flip markets (mid-probability) - still risky
  if (probability > 0.45 && probability < 0.55) {
    risk += 1;
  }
  
  return Math.max(1, Math.min(10, Math.round(risk * 2) / 2)); // Round to nearest 0.5
}
