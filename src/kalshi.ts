// ── KALSHI SCORER ──────────────────────────────────────────────────────
// API approach: min_close_ts/max_close_ts time windows (required for real markets)
// Scoring: calibrated against real trade history (257 trades, Jan–Mar 2026)
// Category filters: based on empirical P&L from Lovable backtest data

const PROXY = '/api/markets'

export interface KalshiMarket {
  ticker: string
  event_ticker: string
  title: string
  subtitle: string
  yes_sub_title: string
  event_title: string
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
  last_price_dollars: string
  previous_price: number
  volume: number
  volume_24h: number
  volume_24h_fp: string
  open_interest: number
  close_time: string
  expiration_time: string
}

export interface ScoredOpportunity {
  market: KalshiMarket
  side: 'YES' | 'NO'
  entryPrice: number
  potentialReturn: number
  impliedProb: number
  expectedValue: number
  edgeScore: number
  spread: number
  daysToClose: number
  category: string
  rationale: string
}

// ── Price extraction (mirrors Lovable's dollar-first approach) ──
function getYesPrice(m: KalshiMarket): number {
  if (m.yes_ask_dollars) { const p = Math.round(parseFloat(m.yes_ask_dollars) * 100); if (p > 0) return p }
  if (m.yes_bid_dollars) { const p = Math.round(parseFloat(m.yes_bid_dollars) * 100); if (p > 0) return p }
  if (m.last_price_dollars) { const p = Math.round(parseFloat(m.last_price_dollars) * 100); if (p > 0) return p }
  if (m.yes_ask > 0) return m.yes_ask
  if (m.yes_bid > 0) return m.yes_bid
  if (m.last_price > 0) return m.last_price
  return 0
}

// ── Historical win rates from real trade data ──
function historicalWinRate(prob: number): number {
  if (prob >= 90) return 0.97
  if (prob >= 80) return 0.76
  if (prob >= 70) return 0.73
  if (prob >= 60) return 0.81
  if (prob >= 50) return 0.39
  return 0.10
}

// ── Category detection (from Lovable, tuned to P&P colour system) ──
function detectCategory(ticker: string, eventTicker: string, title: string): string | null {
  const combined = (ticker + ' ' + eventTicker + ' ' + title).toUpperCase()

  // ── HARD EXCLUDES (empirically negative edge from Lovable backtest) ──
  const isEntertainment =
    combined.includes('NETFLIX') || combined.includes('SPOTIFY') ||
    combined.includes('GRAMMY') || combined.includes('OSCAR') ||
    combined.includes('EMMY') || combined.includes('GOLDEN GLOBE') ||
    combined.includes('BOX OFFICE') || combined.includes('ROTTEN TOMATOES') ||
    combined.includes('SUPER BOWL AD') || combined.includes('ALBUM')

  const isPoliticalMention =
    (combined.includes('MENTION') || combined.includes('ATTEND') || combined.includes('APPEARANCE')) &&
    (combined.includes('TRUMP') || combined.includes('CONGRESS') || combined.includes('GOVERNOR') ||
     combined.includes('SOTU') || combined.includes('PRESIDENT'))

  const isSayBet = combined.includes('KXTRUMPSAY') || combined.includes('KXCONGRESSMENTION') ||
    combined.includes('KXGOVERNORMENTION')

  const isSoccer =
    combined.includes('EPL') || combined.includes('BUNDESLIGA') || combined.includes('LALIGA') ||
    combined.includes('SERIEA') || combined.includes('LIGUE1') || combined.includes('FACUP') ||
    combined.includes('CHAMPIONSLEAGUE') || combined.includes('UCL') || combined.includes('UEL') ||
    combined.includes('UECL') || combined.includes('MLS') || combined.includes('DIMAYORGAME') ||
    combined.includes('ALEAGUEGAME') || combined.includes('JBLEAGUEGAME') || combined.includes('HNLGAME') ||
    combined.includes('VTBGAME') || combined.includes('SAUDIPLGAME') || combined.includes('FIBAGAME') ||
    combined.includes('DENBUPERLIGA') || combined.includes('SCOTTISHPREM') || combined.includes('EFLCHAMP') ||
    combined.includes('SIXNATIONS') || combined.includes('AFCCL') || combined.includes('DPWORLDTOUR') ||
    combined.includes('EUROLEAGUE') || combined.includes('FIBAECUP')

  const isMultiOutcomeSpeculation =
    combined.includes('NEXTTEAM') || combined.includes('SURVIVOR') ||
    combined.includes('FIRSTSUPERBOWLSONG') || combined.includes('ATTENDSOTU') ||
    combined.includes('SUPERBOWLAD') || combined.includes('TOPMODEL') ||
    combined.includes('NETFLIXRANK') || combined.includes('NETFLIXRANKMOVIE') ||
    combined.includes('ALBUNSALES')

  if (isEntertainment || isPoliticalMention || isSayBet || isSoccer || isMultiOutcomeSpeculation) {
    return null // hard exclude
  }

  // ── CATEGORISE ──
  if (combined.includes('ATP') || combined.includes('WTA') || combined.includes('ATPMATCH') ||
      combined.includes('WTAMATCH') || combined.includes('ATPCHAL') || combined.includes('WTACHAL') ||
      combined.includes('DPLWTOUR') || combined.includes('LOLGAME') || combined.includes('CS2GAME') ||
      combined.includes('VALORANT') || combined.includes('NBAGAME') || combined.includes('NBAMENT') ||
      combined.includes('NHLGAME') || combined.includes('NCAAMB') || combined.includes('NCAAWB') ||
      combined.includes('NCAABB') || combined.includes('WOHOCKEY') || combined.includes('WOMHOCKEY') ||
      combined.includes('WOFSKATE') || combined.includes('WOSKIMTN') || combined.includes('NBLGAME') ||
      combined.includes('EPLGAME') || combined.includes('MLBST') || combined.includes('NFLMENT') ||
      combined.includes('KXSB-') || combined.includes('KXNBA') || combined.includes('KXNFL') ||
      combined.includes('KXNHL') || combined.includes('KXMLB') || combined.includes('KXUCLGAME') ||
      combined.includes('KXUELGAME') || combined.includes('SPORT'))
    return 'Sports'

  if (combined.includes('FED') || combined.includes('FOMC') || combined.includes('KXCPI') ||
      combined.includes('KXGDP') || combined.includes('KXPAYROLL') || combined.includes('KXU3') ||
      combined.includes('KXEOWEEK') || combined.includes('KXRT-') || combined.includes('INFLATION') ||
      combined.includes('UNEMPLOYMENT') || combined.includes('JOBS') || combined.includes('TREASURY'))
    return 'Economics'

  if (combined.includes('KXBTC') || combined.includes('KXETH') || combined.includes('KXGOLD') ||
      combined.includes('BITCOIN') || combined.includes('ETHEREUM') || combined.includes('CRYPTO'))
    return 'Crypto/Commodities'

  if (combined.includes('INXD') || combined.includes('SP500') || combined.includes('NASDAQ') ||
      combined.includes('NDX') || combined.includes('S&P'))
    return 'Markets'

  if (combined.includes('PRESIDENT') || combined.includes('ELECTION') || combined.includes('SENATE') ||
      combined.includes('CONGRESS') || combined.includes('TRUMP') || combined.includes('SHUTDOWN') ||
      combined.includes('SCOTUS') || combined.includes('GOVERNMENT'))
    return 'Politics'

  if (combined.includes('KXHIGH') || combined.includes('KXLOW') || combined.includes('WEATHER') ||
      combined.includes('SNOW') || combined.includes('RAIN') || combined.includes('HURRICANE') ||
      combined.includes('SNOWSTORM') || combined.includes('NYCSNOW') || combined.includes('DCSNOW') ||
      combined.includes('HIGHMIA') || combined.includes('HIGHLAX') || combined.includes('HIGHDEN'))
    return 'Weather'

  return 'General'
}

export async function fetchOpenMarkets(): Promise<KalshiMarket[]> {
  const res = await fetch(PROXY)
  if (!res.ok) throw new Error(`Proxy error: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.markets || []
}

// ── SCORING ENGINE ──────────────────────────────────────────────────
function daysUntil(isoDate: string): number {
  if (!isoDate) return 999
  return Math.max(0, (new Date(isoDate).getTime() - Date.now()) / 86400000)
}

export function scoreMarkets(markets: KalshiMarket[]): ScoredOpportunity[] {
  const candidates: Array<{
    market: KalshiMarket
    side: 'YES' | 'NO'
    entryPrice: number
    prob: number
    ev: number
    spread: number
    days: number
    category: string
  }> = []

  for (const m of markets) {
    const category = detectCategory(m.ticker, m.event_ticker || '', m.title || '')
    if (!category) continue // hard-excluded category

    // Skip zero-volume markets (strike variants with no real interest)
    const vol = m.volume_24h || m.volume || 0
    if (vol < 5) continue

    const yesPrice = getYesPrice(m)
    if (yesPrice <= 0) continue

    const noPrice = 100 - yesPrice
    const days = daysUntil(m.close_time || m.expiration_time)

    // Score YES side — sweet spot 65–93% from real trade data
    if (yesPrice >= 65 && yesPrice <= 93) {
      const hwr = historicalWinRate(yesPrice)
      const ev = hwr * (100 - yesPrice) - (1 - hwr) * yesPrice
      const spread = Math.max(0, (m.yes_ask || 0) - (m.yes_bid || 0))
      candidates.push({ market: m, side: 'YES', entryPrice: yesPrice, prob: yesPrice, ev, spread, days, category })
    }

    // Score NO side (equivalent to YES on the other outcome)
    const noAsk = m.no_ask > 0 ? m.no_ask : Math.round(parseFloat(m.no_ask_dollars || '0') * 100)
    if (noAsk >= 65 && noAsk <= 93) {
      const hwr = historicalWinRate(noAsk)
      const ev = hwr * (100 - noAsk) - (1 - hwr) * noAsk
      const spread = Math.max(0, (m.no_ask || 0) - (m.no_bid || 0))
      candidates.push({ market: m, side: 'NO', entryPrice: noAsk, prob: noAsk, ev, spread, days, category })
    }
  }

  if (candidates.length === 0) return []

  const maxVol = Math.max(...candidates.map(c => c.market.volume_24h || c.market.volume || 1), 1)

  const scored: ScoredOpportunity[] = candidates.map(c => {
    const p = c.prob

    // EV score (40pts) — primary signal
    const evScore = Math.max(0, Math.min(40, (c.ev / 25) * 40))

    // Price band score (25pts) — calibrated to real win rates
    // 65–79¢ sweet spot (81% and 73% historical win rate)
    const bandScore =
      p >= 75 && p <= 87 ? 25 :   // Prime zone (Lovable backtest: best hit rate)
      p >= 65 && p <  75 ? 22 :   // Strong zone
      p >= 88 && p <= 93 ? 15 :   // Safe but thin
      10

    // Liquidity (20pts)
    const vol2 = c.market.volume_24h || c.market.volume || 0
    const liquidityScore = (vol2 / maxVol) * 20

    // Spread (10pts)
    const spreadScore = c.spread <= 2 ? 10 : c.spread <= 5 ? 7 : c.spread <= 10 ? 4 : 1

    // Horizon (5pts) — shorter is better (less overnight risk)
    const horizonScore = c.days <= 1 ? 5 : c.days <= 3 ? 4 : c.days <= 7 ? 2 : 1

    // Category bonus/penalty based on backtest data
    const catBonus =
      c.category === 'Economics' ? 3 :
      c.category === 'Weather'   ? 2 :
      c.category === 'Markets'   ? 2 :
      c.category === 'Sports'    ? 0 :
      c.category === 'Politics'  ? -2 :
      0

    const edgeScore = evScore + bandScore + liquidityScore + spreadScore + horizonScore + catBonus

    // Rationale string
    const ret = ((100 - c.entryPrice) / c.entryPrice * 100).toFixed(1)
    const horizon = c.days < 0.5 ? 'today' : c.days < 1.5 ? 'tomorrow' : c.days < 7 ? `${Math.round(c.days)}d` : `${Math.round(c.days / 7)}wk`
    const evLabel = (c.ev > 0 ? '+' : '') + c.ev.toFixed(1) + '¢ EV'
    const liq = c.spread <= 2 ? 'tight spread' : c.spread <= 6 ? 'moderate spread' : 'wide spread'
    const rationale = `${Math.round(historicalWinRate(p) * 100)}% hist. win · +${ret}% return · ${evLabel} · closes ${horizon} · ${liq}`

    return {
      market: c.market,
      side: c.side,
      entryPrice: c.entryPrice,
      potentialReturn: parseFloat(ret),
      impliedProb: c.prob / 100,
      expectedValue: c.ev,
      edgeScore,
      spread: c.spread,
      daysToClose: c.days,
      category,
      rationale,
    }
  })

  scored.sort((a, b) => b.edgeScore - a.edgeScore)

  // Deduplicate — one best side per event ticker
  const seen = new Set<string>()
  const top: ScoredOpportunity[] = []
  for (const s of scored) {
    const key = s.market.event_ticker || s.market.ticker
    if (!seen.has(key)) {
      seen.add(key)
      top.push(s)
    }
    if (top.length >= 20) break
  }

  return top
}
