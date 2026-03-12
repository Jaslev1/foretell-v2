// api/kalshi-markets.js
// Vercel Serverless Function to fetch Kalshi markets
// VERSION 2.1 - Adjusted EV thresholds (v2.0 was too aggressive)

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
    
    // Process markets with recalibrated algorithm
    const opportunities = processMarkets(data.markets || []);
    
    res.status(200).json({ 
      success: true,
      opportunities,
      count: opportunities.length,
      timestamp: new Date().toISOString(),
      version: '2.1-adjusted'
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
      
      // Calculate Expected Value
      const ev = calculateExpectedValue(probability, yesPrice);
      
      // Calculate Risk/Reward Ratio
      const riskRewardRatio = calculateRiskRewardRatio(yesPrice);
      
      // Calculate Edge (our confidence vs market price)
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
        
        // Metrics
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
      // ADJUSTED FILTERS (v2.1)
      
      // Filter 1: Must have positive EV > 2% (was 5%, too aggressive)
      if (opp.expectedValue < 0.02) return false;
      
      // Filter 2: Avoid expensive favorites without strong edge
      // Only reject if BOTH price >70¢ AND edge <5% (was 10%)
      if (opp.yesPrice > 0.70 && opp.edge < 0.05) return false;
      
      // Filter 3: Avoid terrible risk/reward ratios (keep at 4:1)
      if (opp.riskRewardRatio > 4) return false;
      
      // Filter 4: Filter out very low volume markets (new)
      if (opp.volume < 10000) return false;
      
      return true;
    })
    .sort((a, b) => {
      // Sort by EV first, then risk score, then volume
      const evDiff = b.expectedValue - a.expectedValue;
      if (Math.abs(evDiff) > 0.01) return evDiff;
      
      if (a.riskScore !== b.riskScore) return a.riskScore - b.riskScore;
      
      return b.volume - a.volume;
    })
    .slice(0, 100);
}

function categorizeMarket(ticker, title) {
  const t = (ticker + ' ' + title).toLowerCase();
  
  // Sports
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
  
  // Politics
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

function calculateExpectedValue(probability, price, feeRate = 0.035) {
  // ADJUSTED: Kalshi fees are ~3.5% total (not 7%)
  // 1.75% on entry + 1.75% on exit = 3.5% total
  
  const payout = 1 - price;
  const risk = price;
  
  const expectedReturn = (probability * payout) - ((1 - probability) * risk);
  
  // More accurate fee calculation
  const fees = price * feeRate; // Fee on entry
  
  return expectedReturn - fees;
}

function calculateRiskRewardRatio(price) {
  const maxLoss = price;
  const maxWin = 1 - price;
  
  if (maxWin === 0) return 999;
  
  return maxLoss / maxWin;
}

function calculateRiskScore(market, spread, probability, yesPrice, hoursToExpiry, edge) {
  const { volume = 0, ticker = '', title = '' } = market;
  
  let risk = 5; // Start at medium risk
  
  // Volume adjustments
  if (volume > 200000) risk -= 2;
  else if (volume > 100000) risk -= 1;
  else if (volume < 20000) risk += 2;
  else if (volume < 50000) risk += 1;
  
  // Spread adjustments
  if (spread < 0.05) risk -= 1;
  else if (spread < 0.10) risk -= 0.5;
  else if (spread > 0.25) risk += 2;
  else if (spread > 0.15) risk += 1;
  
  // Asymmetric Risk Penalty
  const riskRewardRatio = yesPrice / (1 - yesPrice);
  if (riskRewardRatio > 4) risk += 3;
  else if (riskRewardRatio > 3) risk += 2;
  else if (riskRewardRatio > 2) risk += 1;
  
  // Favorite Bias Penalty
  if (yesPrice > 0.70 && probability > 0.70) {
    risk += 2;
  }
  
  // Underdog Bonus
  if (yesPrice < 0.40 && edge > 0.10) {
    risk -= 2;
  } else if (yesPrice < 0.50 && edge > 0.08) {
    risk -= 1;
  }
  
  // Time Window Adjustment
  if (hoursToExpiry >= 6 && hoursToExpiry <= 24) {
    risk -= 1.5; // Sweet spot
  } else if (hoursToExpiry < 1) {
    risk -= 0.5;
  } else if (hoursToExpiry >= 1 && hoursToExpiry < 6) {
    risk += 2; // Danger zone
  } else if (hoursToExpiry > 72) {
    risk += 1;
  }
  
  // Category-Specific Adjustments
  const t = (ticker + ' ' + title).toLowerCase();
  
  // Sports: Penalize heavy favorites
  if ((t.includes('match') || t.includes('game')) && yesPrice > 0.70) {
    risk += 1.5;
  }
  
  // Politics: Penalize attendance/ceremonial
  if (t.includes('attend') || t.includes('sotu') || t.includes('appear')) {
    risk += 2;
  }
  
  // Entertainment: Slight bonus
  if (t.includes('model') || t.includes('oscar') || t.includes('grammy')) {
    risk -= 0.5;
  }
  
  // Coin-flip markets
  if (probability > 0.45 && probability < 0.55) {
    risk += 1;
  }
  
  return Math.max(1, Math.min(10, Math.round(risk * 2) / 2));
}
