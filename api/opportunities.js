// api/opportunities.js
// Vercel Serverless Function to fetch Kalshi markets
// VERSION 2.3 - Correct API URL + migrated to _dollars fixed-point fields (March 12 2026 breaking change)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // FIXED: api.elections.kalshi.com is the correct PUBLIC endpoint for ALL markets
    // trading-api.kalshi.com requires auth; elections subdomain is public/no-key
    const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

    const response = await fetch(`${KALSHI_API_BASE}/markets?limit=1000&status=open`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Foretell/2.3'
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Kalshi API returned ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const markets = data.markets || [];

    const opportunities = processMarkets(markets);

    res.status(200).json({
      success: true,
      opportunities,
      count: opportunities.length,
      totalMarkets: markets.length,
      timestamp: new Date().toISOString(),
      version: '2.3-dollars-fields'
    });

  } catch (error) {
    console.error('Error fetching Kalshi data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Parse price from either new _dollars string fields or legacy cent integer fields.
// Kalshi removed legacy integer cent fields on March 12, 2026 — prefer _dollars.
function parsePrice(dollarsField, centsField) {
  if (dollarsField !== undefined && dollarsField !== null) {
    return parseFloat(dollarsField);
  }
  if (centsField !== undefined && centsField !== null) {
    return centsField / 100;
  }
  return null;
}

function processMarkets(markets) {
  const now = new Date();

  return markets
    .filter(m => {
      const yesBid = parsePrice(m.yes_bid_dollars, m.yes_bid);
      const yesAsk = parsePrice(m.yes_ask_dollars, m.yes_ask);
      if (yesBid === null || yesAsk === null) return false;
      if (yesBid <= 0 || yesAsk <= 0) return false;
      if (yesBid > yesAsk) return false;
      const spread = yesAsk - yesBid;
      if (spread > 0.40) return false;
      return true;
    })
    .map(m => {
      const yesBid = parsePrice(m.yes_bid_dollars, m.yes_bid);
      const yesAsk = parsePrice(m.yes_ask_dollars, m.yes_ask);
      const noBid  = parsePrice(m.no_bid_dollars,  m.no_bid)  ?? (1 - yesAsk);
      const noAsk  = parsePrice(m.no_ask_dollars,  m.no_ask)  ?? (1 - yesBid);

      const midpoint = (yesBid + yesAsk) / 2;
      const spread   = yesAsk - yesBid;

      const expiryDate    = new Date(m.close_time || m.expiration_time);
      const msToExpiry    = expiryDate - now;
      const expiryDays    = Math.max(0, Math.ceil(msToExpiry / (1000 * 60 * 60 * 24)));
      const hoursToExpiry = Math.max(0, msToExpiry / (1000 * 60 * 60));

      const feeRate = 0.035;

      // EV for buying YES at ask
      const yesEV = (midpoint * (1 - yesAsk)) - ((1 - midpoint) * yesAsk) - (yesAsk * feeRate);
      // EV for buying NO at ask
      const noEV  = ((1 - midpoint) * (1 - noAsk)) - (midpoint * noAsk) - (noAsk * feeRate);

      const bestSide  = noEV > yesEV ? 'NO'  : 'YES';
      const bestEV    = noEV > yesEV ? noEV  : yesEV;
      const bestPrice = noEV > yesEV ? noAsk : yesAsk;

      const volume = m.volume || 0;

      return {
        id:             m.ticker,
        title:          (m.title || m.ticker).replace(/^yes\s+/i, '').trim(),
        category:       categorizeMarket(m.ticker, m.title || ''),
        probability:    midpoint,
        yesPrice:       yesAsk,
        noPrice:        noAsk,
        bestSide,
        bestPrice,
        volume,
        spread,
        expiryDays,
        hoursToExpiry,
        expectedValue:  bestEV,
        yesEV,
        noEV,
        edge:           midpoint - yesAsk,
        riskRewardRatio: bestPrice / (1 - bestPrice),
        maxWin:         1 - bestPrice,
        maxLoss:        bestPrice,
        riskScore:      calculateRiskScore(m, spread, midpoint, bestPrice, hoursToExpiry),
        marketUrl:      `https://kalshi.com/markets/${m.ticker}`
      };
    })
    .filter(opp => {
      if (opp.expectedValue < 0.005) return false;
      if (opp.volume < 500)          return false;
      if (opp.hoursToExpiry < 0.5)   return false;
      return true;
    })
    .sort((a, b) => {
      const evDiff = b.expectedValue - a.expectedValue;
      if (Math.abs(evDiff) > 0.005) return evDiff;
      if (a.riskScore !== b.riskScore) return a.riskScore - b.riskScore;
      return b.volume - a.volume;
    })
    .slice(0, 100);
}

function categorizeMarket(ticker, title) {
  const t = (ticker + ' ' + title).toLowerCase();

  if (t.includes('nba') || t.includes('nfl') || t.includes('mlb') || t.includes('nhl') ||
      t.includes('lakers') || t.includes('chiefs') || t.includes('super bowl') ||
      t.includes('march madness') || t.includes('ncaa') || t.includes('premier league') ||
      t.includes('champions league') || t.includes('world cup') || t.includes('masters') ||
      t.includes('pga') || t.includes('ufc') || t.includes('boxing') || t.includes('tennis') ||
      t.includes('atp') || t.includes('wta') || t.includes('game') || t.includes('match') ||
      t.includes('euroleague') || t.includes('superlig')) return 'Sports';

  if (t.includes('fed') || t.includes('gdp') || t.includes('inflation') ||
      t.includes('cpi') || t.includes('unemployment') || t.includes('jobs') ||
      t.includes('treasury') || t.includes('housing') || t.includes('retail sales') ||
      t.includes('tariff') || t.includes('trade')) return 'Economics';

  if (t.includes('btc') || t.includes('bitcoin') || t.includes('eth') ||
      t.includes('ethereum') || t.includes('crypto') || t.includes('sol') ||
      t.includes('solana') || t.includes('coinbase')) return 'Crypto';

  if (t.includes('nvda') || t.includes('nvidia') || t.includes('tsla') ||
      t.includes('tesla') || t.includes('stock') || t.includes('earnings') ||
      t.includes('aapl') || t.includes('apple') || t.includes('amzn') ||
      t.includes('meta') || t.includes('msft') || t.includes('s&p') ||
      t.includes('nasdaq') || t.includes('dow')) return 'Stocks';

  if (t.includes('ai ') || t.includes('google') || t.includes('microsoft') ||
      t.includes('tech') || t.includes('openai') || t.includes('chatgpt') ||
      t.includes('gemini') || t.includes('anthropic')) return 'Tech';

  if (t.includes('election') || t.includes('congress') || t.includes('senate') ||
      t.includes('president') || t.includes('trump') || t.includes('biden') ||
      t.includes('democrat') || t.includes('republican') || t.includes('scotus') ||
      t.includes('supreme court') || t.includes('approval') || t.includes('executive order') ||
      t.includes('tariff')) return 'Politics';

  if (t.includes('weather') || t.includes('temperature') || t.includes('snow') ||
      t.includes('rain') || t.includes('hurricane') || t.includes('storm')) return 'Weather';

  if (t.includes('oscar') || t.includes('grammy') || t.includes('emmy') ||
      t.includes('movie') || t.includes('box office') || t.includes('netflix') ||
      t.includes('taylor swift')) return 'Entertainment';

  return 'Other';
}

function calculateRiskScore(market, spread, probability, entryPrice, hoursToExpiry) {
  const { volume = 0, ticker = '', title = '' } = market;
  const t = (ticker + ' ' + (title || '')).toLowerCase();

  let risk = 5;

  if (volume > 500000)      risk -= 2;
  else if (volume > 100000) risk -= 1;
  else if (volume < 5000)   risk += 2;
  else if (volume < 20000)  risk += 1;

  if (spread < 0.04)       risk -= 1;
  else if (spread < 0.08)  risk -= 0.5;
  else if (spread > 0.25)  risk += 2;
  else if (spread > 0.15)  risk += 1;

  const rr = entryPrice / (1 - entryPrice);
  if (rr > 9)      risk += 3;
  else if (rr > 4) risk += 2;
  else if (rr > 2) risk += 1;

  if (hoursToExpiry >= 6 && hoursToExpiry <= 48)   risk -= 1.5;
  else if (hoursToExpiry < 1)                       risk += 1;
  else if (hoursToExpiry >= 1 && hoursToExpiry < 6) risk += 2;
  else if (hoursToExpiry > 168)                     risk += 1;

  if (t.includes('attend') || t.includes('sotu') || t.includes('appear')) risk += 2;
  if ((t.includes('match') || t.includes('game')) && entryPrice > 0.75)   risk += 1.5;
  if (probability > 0.43 && probability < 0.57) risk += 1;

  return Math.max(1, Math.min(10, Math.round(risk * 2) / 2));
}
