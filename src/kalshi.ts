// ── KALSHI API CLIENT ──────────────────────────────────────────────
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
  edgeScore: number
  spread: number          // cents
  daysToClose: number
  category: string
  rationale: string
}

// Normalise price to cents regardless of which field Kalshi populates
function toCents(intField: number, dollarField: string): number {
  if (intField && intField > 0) return intField
  if (dollarField) {
    const parsed = parseFloat(dollarField) * 100
    if (!isNaN(parsed) && parsed > 0) return Math.round(parsed)
  }
  return 0
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
  const ms = new Date(isoDate).getTime() - Date.now()
  return Math.max(0, ms / 86400000)
}

function inferCategory(ticker: string, title: string): string {
  const t = (ticker + ' ' + title).toLowerCase()
  if (/fed|fomc|cpi|gdp|inflation|unemploy|jobs|rate\s|interest/.test(t)) return 'Economics'
  if (/btc|eth|crypto|bitcoin|solana|doge/.test(t)) return 'Crypto'
  if (/weather|temp|snow|rain|hurricane|tornado|degrees/.test(t)) return 'Weather'
  if (/nba|nfl|mlb|nhl|ncaa|sport|basketball|football|baseball|hockey|soccer|mls|ufc|tennis/.test(t)) return 'Sports'
  if (/trump|biden|harris|congress|senate|house|election|president|republican|democrat|political/.test(t)) return 'Politics'
  if (/s&p|nasdaq|dow|stock|equity|market|spy|qqq|nyse|russell/.test(t)) return 'Markets'
  if (/oil|gas|gold|silver|commodit|energy|wti|brent/.test(t)) return 'Commodities'
  if (/movie|oscar|grammy|emmy|award|box office|tv show|netflix/.test(t)) return 'Entertainment'
  return 'General'
}

export function scoreMarkets(markets: KalshiMarket[]): ScoredOpportunity[] {
  const raw: Array<{
    market: KalshiMarket
    side: 'YES' | 'NO'
    entryPrice: number
    impliedProb: number
    potentialReturn: number
    spread: number
    daysToClose: number
  }> = []

  for (const m of markets) {
    if (m.status !== 'open') continue

    // Normalise all prices to cents
    const yesBid = toCents(m.yes_bid, m.yes_bid_dollars)
    const yesAsk = toCents(m.yes_ask, m.yes_ask_dollars)
    const noBid  = toCents(m.no_bid,  m.no_bid_dollars)
    const noAsk  = toCents(m.no_ask,  m.no_ask_dollars)

    // Need at least one side to have a tradeable ask price
    if (yesAsk <= 0 && noAsk <= 0) continue

    const days = daysUntil(m.close_time || m.expiration_time)

    // YES side
    if (yesAsk >= 55 && yesAsk <= 98) {
      raw.push({
        market: m, side: 'YES',
        entryPrice: yesAsk,
        impliedProb: yesAsk / 100,
        potentialReturn: (100 - yesAsk) / yesAsk * 100,
        spread: yesAsk - yesBid,
        daysToClose: days,
      })
    }

    // NO side
    if (noAsk >= 55 && noAsk <= 98) {
      raw.push({
        market: m, side: 'NO',
        entryPrice: noAsk,
        impliedProb: noAsk / 100,
        potentialReturn: (100 - noAsk) / noAsk * 100,
        spread: noAsk - noBid,
        daysToClose: days,
      })
    }
  }

  if (raw.length === 0) return []

  // Normalise volume
  const maxVol = Math.max(...raw.map(r => r.market.volume_24h || r.market.volume || 1), 1)

  const scored: ScoredOpportunity[] = raw.map(r => {
    const prob = r.impliedProb * 100

    // 1. Probability score (35pts) — sweet spot 72–93%
    const probScore = prob >= 72 && prob <= 93 ? 35
      : prob >= 60 ? 22 : 10

    // 2. Return score (25pts)
    const returnScore = Math.min(25, r.potentialReturn * 3)

    // 3. Liquidity (20pts)
    const vol = r.market.volume_24h || r.market.volume || 0
    const liquidityScore = (vol / maxVol) * 20

    // 4. Spread (10pts)
    const spreadScore = r.spread <= 1 ? 10 : r.spread <= 3 ? 7 : r.spread <= 6 ? 4 : 1

    // 5. Horizon (10pts) — sooner is better
    const horizonScore = r.daysToClose <= 0.5 ? 10
      : r.daysToClose <= 1 ? 9
      : r.daysToClose <= 7 ? 7
      : r.daysToClose <= 30 ? 4 : 1

    const edgeScore = probScore + returnScore + liquidityScore + spreadScore + horizonScore

    const horizon = r.daysToClose < 1 ? 'today'
      : r.daysToClose < 2 ? 'tomorrow'
      : r.daysToClose < 7 ? `${Math.round(r.daysToClose)}d`
      : `${Math.round(r.daysToClose / 7)}wk`

    const liq = r.spread <= 2 ? 'tight spread' : r.spread <= 5 ? 'moderate spread' : 'wide spread'
    const rationale = `${Math.round(prob)}% implied win · +${r.potentialReturn.toFixed(1)}% return · closes ${horizon} · ${liq}`

    return {
      market: r.market,
      side: r.side,
      entryPrice: r.entryPrice,
      potentialReturn: r.potentialReturn,
      impliedProb: r.impliedProb,
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
