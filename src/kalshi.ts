// ── KALSHI API CLIENT ──────────────────────────────────────────────
// Calibrated against real trade history (257 trades, Jan–Mar 2026)
// Win rates by entry price band:
//   60-69¢: 81% win rate, ~52% avg return
//   70-79¢: 73% win rate, ~35% avg return  ← sweet spot (most volume)
//   80-89¢: 76% win rate, ~20% avg return
//   90+¢:  100% win rate, ~8% avg return

const PROXY = '/api/markets'

export interface KalshiMarket {
  ticker: string
  event_ticker: string
  title: string
  subtitle: string
  status: string
  yes_bid: number
  yes_ask: number
  no_bid: number
  no_ask: number
  yes_bid_dollars: string
  yes_ask_dollars: string
  no_bid_dollars: string
  no_ask_dollars: string
  last_price: number
  volume: number
  volume_24h: number
  open_interest: number
  close_time: string
  expiration_time: string
  result: string
}

export interface ScoredOpportunity {
  market: KalshiMarket
  side: 'YES' | 'NO'
  entryPrice: number      // cents
  potentialReturn: number // % return if win
  impliedProb: number     // 0–1
  expectedValue: number   // EV in cents per $1 risked
  edgeScore: number       // composite 0–100
  spread: number          // cents
  daysToClose: number
  category: string
  rationale: string
}

// Normalise price to cents — Kalshi returns either int cents or dollar string
function toCents(intField: number, dollarField: string): number {
  if (intField > 0) return intField
  if (dollarField) {
    const p = Math.round(parseFloat(dollarField) * 100)
    if (p > 0) return p
  }
  return 0
}

// Historical win rates from real trade data
// Used to compute expected value beyond raw implied probability
function historicalWinRate(entryCents: number): number {
  if (entryCents >= 90) return 0.97
  if (entryCents >= 80) return 0.76
  if (entryCents >= 70) return 0.73
  if (entryCents >= 60) return 0.81
  if (entryCents >= 50) return 0.39
  return 0.10 // below 50¢ — historically very poor
}

export async function fetchOpenMarkets(pages = 5): Promise<KalshiMarket[]> {
  const markets: KalshiMarket[] = []
  let cursor = ''

  for (let i = 0; i < pages; i++) {
    const url = new URL(PROXY, window.location.origin)
    url.searchParams.set('limit', '1000')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Proxy error: ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    markets.push(...(data.markets || []))
    cursor = data.cursor || ''
    if (!cursor) break
  }

  return markets
}

// ── SCORING ENGINE ──────────────────────────────────────────────────
function daysUntil(isoDate: string): number {
  if (!isoDate) return 999
  return Math.max(0, (new Date(isoDate).getTime() - Date.now()) / 86400000)
}

function inferCategory(ticker: string, title: string): string {
  const t = (ticker + ' ' + title).toLowerCase()
  // Sports — most common in real data
  if (/kxatp|atpmatch|atpchal|wtamatch|wtachal/.test(t)) return 'Tennis'
  if (/ncaamb|ncaawb|ncaabb/.test(t)) return 'NCAA'
  if (/kxnba|nbagame|nbament|nbatrad/.test(t)) return 'NBA'
  if (/kxnfl|nflment|superbowl|kxsb-/.test(t)) return 'NFL'
  if (/kxnhl|nhlgame/.test(t)) return 'NHL'
  if (/kxmlb|mlbst/.test(t)) return 'MLB'
  if (/cs2game|lolgame|valorant|esport/.test(t)) return 'Esports'
  if (/epl|laliga|seriea|ligue1|facup|ucl|uel|uecl|bundesl|mls|soccer|football/.test(t)) return 'Soccer'
  if (/kxhigh|kxlow|weather|snow|rain|temp|hurricane/.test(t)) return 'Weather'
  if (/kxbtc|kxeth|kxgold|crypto|bitcoin/.test(t)) return 'Crypto/Commodities'
  if (/kxfed|kxcpi|kxgdp|kxpayroll|kxu3|kxeoweek|fomc|inflation/.test(t)) return 'Economics'
  if (/kxtrump|congress|senate|president|election|politics/.test(t)) return 'Politics'
  if (/netflix|spotify|oscar|grammy|movie|show|album/.test(t)) return 'Entertainment'
  return 'General'
}

export function scoreMarkets(markets: KalshiMarket[]): ScoredOpportunity[] {
  const raw: Array<{
    market: KalshiMarket
    side: 'YES' | 'NO'
    entryPrice: number
    impliedProb: number
    historicalWR: number
    potentialReturn: number
    expectedValue: number
    spread: number
    daysToClose: number
  }> = []

  for (const m of markets) {
    if (m.status !== 'open') continue

    const yesBid = toCents(m.yes_bid, m.yes_bid_dollars)
    const yesAsk = toCents(m.yes_ask, m.yes_ask_dollars)
    const noBid  = toCents(m.no_bid,  m.no_bid_dollars)
    const noAsk  = toCents(m.no_ask,  m.no_ask_dollars)

    const days = daysUntil(m.close_time || m.expiration_time)

    // YES side — only score the 55–95¢ band (validated range from trade data)
    if (yesAsk >= 55 && yesAsk <= 95) {
      const hwr = historicalWinRate(yesAsk)
      const ret = (100 - yesAsk) / yesAsk * 100
      const ev  = hwr * (100 - yesAsk) - (1 - hwr) * yesAsk
      raw.push({
        market: m, side: 'YES',
        entryPrice: yesAsk,
        impliedProb: yesAsk / 100,
        historicalWR: hwr,
        potentialReturn: ret,
        expectedValue: ev,
        spread: Math.max(0, yesAsk - yesBid),
        daysToClose: days,
      })
    }

    // NO side
    if (noAsk >= 55 && noAsk <= 95) {
      const hwr = historicalWinRate(noAsk)
      const ret = (100 - noAsk) / noAsk * 100
      const ev  = hwr * (100 - noAsk) - (1 - hwr) * noAsk
      raw.push({
        market: m, side: 'NO',
        entryPrice: noAsk,
        impliedProb: noAsk / 100,
        historicalWR: hwr,
        potentialReturn: ret,
        expectedValue: ev,
        spread: Math.max(0, noAsk - noBid),
        daysToClose: days,
      })
    }
  }

  if (raw.length === 0) return []

  const maxVol = Math.max(...raw.map(r => r.market.volume_24h || r.market.volume || 1), 1)

  const scored: ScoredOpportunity[] = raw.map(r => {
    const p = r.entryPrice

    // 1. EV score (40pts) — positive EV is the core signal
    //    Max EV in sweet spot ~25¢, normalise to 40pts
    const evScore = Math.max(0, Math.min(40, (r.expectedValue / 25) * 40))

    // 2. Price band score (25pts) — calibrated to real win rates
    //    60–79¢ is the historical sweet spot
    const bandScore = p >= 60 && p <= 79 ? 25
      : p >= 80 && p <= 89 ? 20
      : p >= 55 && p < 60  ? 15
      : p >= 90             ? 12
      : 8

    // 3. Liquidity (20pts)
    const vol = r.market.volume_24h || r.market.volume || 0
    const liquidityScore = (vol / maxVol) * 20

    // 4. Spread (10pts) — tight spread = real market, not illiquid stub
    const spreadScore = r.spread <= 1 ? 10 : r.spread <= 3 ? 7 : r.spread <= 6 ? 4 : 1

    // 5. Horizon (5pts) — shorter resolves sooner (less overnight risk)
    const horizonScore = r.daysToClose <= 1 ? 5 : r.daysToClose <= 7 ? 4 : r.daysToClose <= 30 ? 2 : 1

    const edgeScore = evScore + bandScore + liquidityScore + spreadScore + horizonScore

    // Build rationale
    const horizon = r.daysToClose < 0.5 ? 'closes today'
      : r.daysToClose < 1.5 ? 'closes tomorrow'
      : r.daysToClose < 7 ? `closes in ${Math.round(r.daysToClose)}d`
      : `closes in ${Math.round(r.daysToClose / 7)}wk`
    const evLabel = r.expectedValue > 0
      ? `+${r.expectedValue.toFixed(1)}¢ EV`
      : `${r.expectedValue.toFixed(1)}¢ EV`
    const liq = r.spread <= 2 ? 'tight spread' : r.spread <= 5 ? 'moderate spread' : 'wide spread'
    const rationale = `${Math.round(r.historicalWR * 100)}% hist. win rate · +${r.potentialReturn.toFixed(1)}% return · ${evLabel} · ${horizon} · ${liq}`

    return {
      market: r.market,
      side: r.side,
      entryPrice: r.entryPrice,
      potentialReturn: r.potentialReturn,
      impliedProb: r.impliedProb,
      expectedValue: r.expectedValue,
      edgeScore,
      spread: r.spread,
      daysToClose: r.daysToClose,
      category: inferCategory(r.market.ticker, r.market.title),
      rationale,
    }
  })

  scored.sort((a, b) => b.edgeScore - a.edgeScore)

  // Deduplicate — best side per market ticker
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
