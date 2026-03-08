// ── KALSHI API CLIENT ──────────────────────────────────────────────
// Public endpoint — no auth required
const BASE = 'https://api.elections.kalshi.com/trade-api/v2'

export interface KalshiMarket {
  ticker: string
  event_ticker: string
  title: string
  subtitle: string
  status: string
  yes_bid: number       // cents
  yes_ask: number       // cents
  no_bid: number        // cents
  no_ask: number        // cents
  last_price: number    // cents
  volume: number
  volume_24h: number
  open_interest: number
  close_time: string
  expiration_time: string
  result: string
  yes_bid_dollars: string
  no_bid_dollars: string
}

export interface ScoredOpportunity {
  market: KalshiMarket
  side: 'YES' | 'NO'
  entryPrice: number      // cents — what you pay
  payoutIfWin: number     // cents — what you get back (always 100)
  potentialReturn: number // % return if win
  impliedProb: number     // market's implied probability of winning
  edgeScore: number       // our composite score (higher = better opp)
  spread: number          // bid-ask spread in cents
  daysToClose: number
  category: string
  rationale: string
}

// Fetch up to `pages` pages of open markets (1000 per page)
export async function fetchOpenMarkets(pages = 5): Promise<KalshiMarket[]> {
  const markets: KalshiMarket[] = []
  let cursor = ''

  for (let i = 0; i < pages; i++) {
    const url = new URL(`${BASE}/markets`)
    url.searchParams.set('limit', '1000')
    url.searchParams.set('status', 'open')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Kalshi API error: ${res.status}`)
    const data = await res.json()

    markets.push(...(data.markets || []))
    cursor = data.cursor || ''
    if (!cursor) break
  }

  return markets
}

// ── SCORING ENGINE ──────────────────────────────────────────────────
//
// Strategy: find markets where:
//   1. Price is HIGH (70–95¢) → smaller payout but high win probability
//   2. Spread is TIGHT → liquid, fair market
//   3. Volume is decent → not illiquid
//   4. Time to close is SHORT → faster resolution
//   5. Return per $ risked is still reasonable
//
// Score formula (0–100):
//   - Probability score:  normalised implied prob in 70–97% band   (35pts)
//   - Return score:       return % normalised against peers         (25pts)
//   - Liquidity score:    24h volume rank                           (20pts)
//   - Spread score:       tight spread = better                     (10pts)
//   - Horizon score:      closes sooner = better                    (10pts)

function daysUntil(isoDate: string): number {
  if (!isoDate) return 999
  const ms = new Date(isoDate).getTime() - Date.now()
  return Math.max(0, ms / (1000 * 60 * 60 * 24))
}

function inferCategory(ticker: string, title: string): string {
  const t = (ticker + ' ' + title).toLowerCase()
  if (t.includes('fed') || t.includes('rate') || t.includes('cpi') || t.includes('gdp') || t.includes('inflation') || t.includes('fomc')) return 'Economics'
  if (t.includes('btc') || t.includes('eth') || t.includes('crypto') || t.includes('bitcoin')) return 'Crypto'
  if (t.includes('weather') || t.includes('temp') || t.includes('snow') || t.includes('rain') || t.includes('hurricane')) return 'Weather'
  if (t.includes('nba') || t.includes('nfl') || t.includes('mlb') || t.includes('nhl') || t.includes('sport') || t.includes('game')) return 'Sports'
  if (t.includes('trump') || t.includes('biden') || t.includes('congress') || t.includes('senate') || t.includes('election') || t.includes('president')) return 'Politics'
  if (t.includes('apple') || t.includes('tesla') || t.includes('nvidia') || t.includes('tech') || t.includes('stock') || t.includes('nasdaq') || t.includes('s&p') || t.includes('dow')) return 'Markets'
  if (t.includes('movie') || t.includes('oscar') || t.includes('grammy') || t.includes('emmy') || t.includes('box office')) return 'Entertainment'
  return 'General'
}

function buildRationale(side: 'YES' | 'NO', impliedProb: number, potentialReturn: number, daysToClose: number, spread: number): string {
  const prob = Math.round(impliedProb * 100)
  const ret = potentialReturn.toFixed(1)
  const horizon = daysToClose < 1 ? 'today' : daysToClose < 7 ? `${Math.round(daysToClose)}d` : `${Math.round(daysToClose / 7)}wk`
  const liquidity = spread <= 2 ? 'tight spread' : spread <= 5 ? 'moderate spread' : 'wider spread'
  return `${prob}% implied win · ${ret}% return · resolves ${horizon} · ${liquidity}`
}

export function scoreMarkets(markets: KalshiMarket[]): ScoredOpportunity[] {
  // Pre-filter: must have real pricing and volume
  const valid = markets.filter(m =>
    m.yes_bid > 0 &&
    m.yes_ask > 0 &&
    m.no_bid > 0 &&
    m.no_ask > 0 &&
    m.volume_24h > 0 &&
    m.status === 'open'
  )

  // Build raw opportunities for both YES and NO sides
  const raw: Array<{
    market: KalshiMarket
    side: 'YES' | 'NO'
    entryPrice: number
    impliedProb: number
    potentialReturn: number
    spread: number
    daysToClose: number
  }> = []

  for (const m of valid) {
    const days = daysUntil(m.close_time || m.expiration_time)

    // YES side: buy at yes_ask, win 100¢
    const yesEntry = m.yes_ask
    const yesImplied = yesEntry / 100
    const yesReturn = (100 - yesEntry) / yesEntry * 100
    const yesSpread = m.yes_ask - m.yes_bid

    // NO side: buy at no_ask, win 100¢
    const noEntry = m.no_ask
    const noImplied = noEntry / 100
    const noReturn = (100 - noEntry) / noEntry * 100
    const noSpread = m.no_ask - m.no_bid

    // Only consider high-probability side (60–97¢ entry = 60–97% win prob)
    // This is the "predictable, smaller payout" brief
    if (yesEntry >= 60 && yesEntry <= 97) {
      raw.push({ market: m, side: 'YES', entryPrice: yesEntry, impliedProb: yesImplied, potentialReturn: yesReturn, spread: yesSpread, daysToClose: days })
    }
    if (noEntry >= 60 && noEntry <= 97) {
      raw.push({ market: m, side: 'NO', entryPrice: noEntry, impliedProb: noImplied, potentialReturn: noReturn, spread: noSpread, daysToClose: days })
    }
  }

  if (raw.length === 0) return []

  // Normalise volume for liquidity scoring
  const maxVol = Math.max(...raw.map(r => r.market.volume_24h))
  const maxDays = Math.max(...raw.map(r => r.daysToClose), 1)

  // Score each
  const scored: ScoredOpportunity[] = raw.map(r => {
    // 1. Probability score (35pts) — sweet spot is 75–92% implied
    const probPct = r.impliedProb * 100
    const probScore = probPct >= 75 && probPct <= 92
      ? 35
      : probPct >= 65
        ? 25
        : 15

    // 2. Return score (25pts) — higher return within the high-prob band is better
    const returnScore = Math.min(25, r.potentialReturn * 2.5)

    // 3. Liquidity score (20pts)
    const liquidityScore = (r.market.volume_24h / maxVol) * 20

    // 4. Spread score (10pts) — tighter is better
    const spreadScore = r.spread <= 1 ? 10 : r.spread <= 3 ? 7 : r.spread <= 5 ? 4 : 1

    // 5. Horizon score (10pts) — shorter is better (resolves soon)
    const horizonScore = r.daysToClose === 0 ? 10
      : r.daysToClose <= 1 ? 9
      : r.daysToClose <= 7 ? 7
      : r.daysToClose <= 30 ? 4
      : 1

    const edgeScore = probScore + returnScore + liquidityScore + spreadScore + horizonScore

    return {
      market: r.market,
      side: r.side,
      entryPrice: r.entryPrice,
      payoutIfWin: 100,
      potentialReturn: r.potentialReturn,
      impliedProb: r.impliedProb,
      edgeScore,
      spread: r.spread,
      daysToClose: r.daysToClose,
      category: inferCategory(r.market.ticker, r.market.title),
      rationale: buildRationale(r.side, r.impliedProb, r.potentialReturn, r.daysToClose, r.spread),
    }
  })

  // Sort by score, deduplicate (pick best side per market), take top 20
  scored.sort((a, b) => b.edgeScore - a.edgeScore)

  const seen = new Set<string>()
  const top: ScoredOpportunity[] = []
  for (const s of scored) {
    if (!seen.has(s.market.ticker)) {
      seen.add(s.market.ticker)
      top.push(s)
    }
    if (top.length >= 20) break
  }

  return top
}
