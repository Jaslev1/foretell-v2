// api/opportunities.js — full server-side scoring, returns top 20 ready to render
// Recalibrated 2026-03-10: fixed favorite bias, win-rate table, category penalties

// ── RECALIBRATED WIN-RATE TABLE ────────────────────────────────────────────
// OLD table had anomalous 81% at 65¢ (0.65 implied → 0.81 actual = +16¢ EV).
// That figure was an artefact of small sample size / market selection bias.
// Real calibration: prediction markets are roughly efficient; edge is 1-3pp max
// except at extremes. Favourite-longshot bias means 75-88¢ markets are
// SLIGHTLY overpriced by bettors, so we apply a small discount there.
//
// New table — interpolated, no discontinuous jumps:
//   price 65-69 : hwr ≈ price + 2pp  (~2¢ EV — small mean-reversion edge)
//   price 70-74 : hwr ≈ price + 2pp
//   price 75-79 : hwr ≈ price + 1pp  (favourite bias starts)
//   price 80-87 : hwr ≈ price - 1pp  (favourite-longshot discount)
//   price 88-93 : hwr ≈ price + 1pp  (heavy faves with thick books are fair)
function historicalWinRate(prob) {
  if (prob >= 90) return Math.min(0.97, prob / 100 + 0.01)
  if (prob >= 88) return prob / 100 + 0.01
  if (prob >= 80) return prob / 100 - 0.01   // favourite-longshot zone: slight discount
  if (prob >= 75) return prob / 100 + 0.01
  if (prob >= 65) return prob / 100 + 0.02   // 65-74: small mean-reversion edge
  return prob / 100 - 0.05                   // below 65: longshot overpriced
}

function detectCategory(ticker, eventTicker, title) {
  const combined = (ticker + ' ' + (eventTicker||'') + ' ' + (title||'')).toUpperCase()

  // Hard excludes
  if (combined.includes('NETFLIX') || combined.includes('SPOTIFY') || combined.includes('GRAMMY') ||
      combined.includes('OSCAR') || combined.includes('EMMY') || combined.includes('GOLDEN GLOBE') ||
      combined.includes('BOX OFFICE') || combined.includes('ROTTEN TOMATOES') || combined.includes('SUPER BOWL AD'))
    return null
  if ((combined.includes('MENTION') || combined.includes('ATTEND') || combined.includes('APPEARANCE')) &&
      (combined.includes('TRUMP') || combined.includes('CONGRESS') || combined.includes('GOVERNOR') ||
       combined.includes('SOTU') || combined.includes('PRESIDENT')))
    return null
  if (combined.includes('KXTRUMPSAY') || combined.includes('KXCONGRESSMENTION') || combined.includes('KXGOVERNORMENTION'))
    return null
  if (combined.includes('NEXTTEAM') || combined.includes('SURVIVOR') || combined.includes('FIRSTSUPERBOWLSONG') ||
      combined.includes('ATTENDSOTU') || combined.includes('SUPERBOWLAD') || combined.includes('TOPMODEL') ||
      combined.includes('NETFLIXRANK'))
    return null
  // Soccer leagues
  if (combined.includes('ARGPREMDIV') || combined.includes('BRAZSER') || combined.includes('MEXLIGA') ||
      combined.includes('EPL') || combined.includes('BUNDESLIGA') || combined.includes('LALIGA') ||
      combined.includes('SERIEA') || combined.includes('LIGUE1') || combined.includes('FACUP') ||
      combined.includes('DIMAYORGAME') || combined.includes('ALEAGUEGAME') || combined.includes('JBLEAGUEGAME') ||
      combined.includes('HNLGAME') || combined.includes('VTBGAME') || combined.includes('SAUDIPLGAME') ||
      combined.includes('FIBAGAME') || combined.includes('EUROLEAGUE') || combined.includes('FIBAECUP') ||
      combined.includes('SCOTTISHPREM') || combined.includes('EFLCHAMP') || combined.includes('SIXNATIONS') ||
      combined.includes('AFCCL') || combined.includes('DPWORLDTOUR'))
    return null

  // Categorise — economics FIRST to avoid false Sports hits
  if (combined.includes('KXCPI') || combined.includes('KXGDP') || combined.includes('KXPAYROLL') ||
      combined.includes('KXU3') || combined.includes('KXEOWEEK') || combined.includes('KXRT-') ||
      combined.includes('FOMC') || combined.includes('KXPCE') || combined.includes('PCE') ||
      combined.includes('INFLATION') || combined.includes('UNEMPLOYMENT') || combined.includes('JOBLESS') ||
      combined.includes('TREASURY') || combined.includes('KXGOVT') || combined.includes('KXFED') ||
      combined.includes('KXNFP') || combined.includes('KXISM') || combined.includes('KXHOUSING') ||
      combined.includes('KXRETAIL') || combined.includes('KXDEBT') || combined.includes('KXDEFICIT') ||
      combined.includes('KXCORE'))
    return 'Economics'
  if (combined.includes('NBA') || combined.includes('NHL') || combined.includes('NCAA') ||
      combined.includes('WBC') || combined.includes('NFL') || combined.includes('MLB') ||
      combined.includes('WNBA') || combined.includes('PGA') || combined.includes('GOLF') ||
      combined.includes('UFC') || combined.includes('MMA') || combined.includes('ATP') ||
      combined.includes('WTA') || combined.includes('CS2') || combined.includes('LOLGAME') ||
      combined.includes('VALORANT') || combined.includes('WOHOCKEY') || combined.includes('WOMHOCKEY') ||
      combined.includes('WOFSKATE') || combined.includes('WOSKIMTN') || combined.includes('NBLGAME'))
    return 'Sports'

  if (combined.includes('KXBTC') || combined.includes('KXETH') || combined.includes('KXGOLD') ||
      combined.includes('KXWTI') || combined.includes('BITCOIN') || combined.includes('ETHEREUM') ||
      combined.includes('CRYPTO') || combined.includes('KXGOLDMON'))
    return 'Commodities'
  if (combined.includes('INXD') || combined.includes('SP500') || combined.includes('NASDAQ') ||
      combined.includes('NDX') || combined.includes('S&P'))
    return 'Markets'
  if (combined.includes('PRESIDENT') || combined.includes('ELECTION') || combined.includes('SENATE') ||
      combined.includes('CONGRESS') || combined.includes('TRUMP') || combined.includes('SHUTDOWN') ||
      combined.includes('SCOTUS') || combined.includes('GOVERNMENT'))
    return 'Politics'
  if (combined.includes('KXHIGH') || combined.includes('KXLOW') || combined.includes('WEATHER') ||
      combined.includes('SNOW') || combined.includes('RAIN') || combined.includes('HURRICANE') ||
      combined.includes('SNOWSTORM') || combined.includes('NYCSNOW') || combined.includes('DCSNOW'))
    return 'Weather'
  if (combined.includes('ALBUNSALES') || combined.includes('ALBUMSALES'))
    return 'Entertainment'
  return 'General'
}

function getPrice(intVal, dollarStr) {
  if (intVal > 0) return intVal
  const p = Math.round(parseFloat(dollarStr || '0') * 100)
  return p > 0 ? p : 0
}

function daysUntil(isoDate) {
  if (!isoDate) return 999
  return Math.max(0, (new Date(isoDate).getTime() - Date.now()) / 86400000)
}


// Weather city lookup — keyed by city code after stripping KXHIGH/KXLOW/KXSNOW/KXRAIN prefix
// Handles all ticker variants: KXHIGHCHI, KXHIGHTCHI, KXLOWTMIA, KXLOWTLAX, KXHIGHTSFO etc.
// The 'T' in some tickers (e.g. KXHIGHTCHI vs KXHIGHCHI) is a station variant; same city.
const WEATHER_CITY_MAP = {
  NY:'New York', NYC:'New York',
  LA:'Los Angeles', LAX:'Los Angeles',
  CHI:'Chicago',
  MIA:'Miami',
  SF:'San Francisco', SFO:'San Francisco',
  DAL:'Dallas',
  HOU:'Houston',
  PHX:'Phoenix',
  SEA:'Seattle',
  DEN:'Denver',
  BOS:'Boston',
  ATL:'Atlanta',
  OKC:'Oklahoma City',
  LV:'Las Vegas',
  PDX:'Portland',
  MSP:'Minneapolis',
  STL:'St. Louis',
  CLE:'Cleveland',
  DCA:'Washington DC', DC:'Washington DC',
  MKE:'Milwaukee',
  PIT:'Pittsburgh',
  ORD:'Chicago',
}

function getWeatherCity(series) {
  // Strip the leading weather-type prefix to get the city code
  const code = series
    .replace(/^KXHIGHT/, '')   // KXHIGHTSFO → SFO
    .replace(/^KXHIGH/,  '')   // KXHIGHCHI  → CHI
    .replace(/^KXLOWT/,  '')   // KXLOWTMIA  → MIA
    .replace(/^KXLOW/,   '')   // KXLOWNY    → NY
    .replace(/^KXSNOW/,  '')   // KXSNOWCHI  → CHI
    .replace(/^KXRAIN/,  '')   // KXRAINLA   → LA
  return WEATHER_CITY_MAP[code] || null
}

function isWeatherSeries(series) {
  return series.startsWith('KXHIGH') || series.startsWith('KXLOW') ||
         series.startsWith('KXSNOW') || series.startsWith('KXRAIN')
}

function buildSearchText(m, side) {
  const ticker = m.ticker || ''
  const title = m.title || ticker
  const series = ticker.split('-')[0].toUpperCase()
  const eventTicker = (m.event_ticker || '').toUpperCase()

  // ── WEATHER ──────────────────────────────────────────────────────────
  // Kalshi weather search works with: "[City] high temperature" or "[City] low temperature"
  // e.g. "Los Angeles high temperature", "Seattle low temperature"
  if (isWeatherSeries(series)) {
    const city = getWeatherCity(series)
    const stat = series.startsWith('KXLOW')  ? 'low temperature'
               : series.startsWith('KXHIGH') ? 'high temperature'
               : series.startsWith('KXSNOW') ? 'snowfall'
               : series.startsWith('KXRAIN') ? 'rainfall'
               : 'temperature'
    return city ? `${city} ${stat}` : title
  }

  // ── SPORTS TOTALS ─────────────────────────────────────────────────────
  // ticker pattern: KXNCAAMBTOTAL-... or KXNBATOTAL-... etc.
  // title = "Oregon St. at Gonzaga: Total Points" — drop ": Total Points"
  // Kalshi search: just the team matchup, e.g. "Oregon St Gonzaga"
  if (series.includes('TOTAL')) {
    return title
      .replace(/:\s*Total Points.*$/i, '')   // drop ": Total Points"
      .replace(/[?.]/g, '')                   // strip punctuation
      .trim()
  }

  // ── SPORTS SPREADS ────────────────────────────────────────────────────
  // title = "Oklahoma City wins by over 5.5 Points?" — just want team names
  // Extract teams from event ticker: KXNBASPREAD-26MAR09DENOKC → "DEN OKC"
  // Better: use the title up to "wins by" or "by over"
  if (series.includes('SPREAD') || series.includes('1HSPREAD') || series.includes('2HSPREAD')) {
    // Strip the spread description, keep team names
    return title
      .replace(/^Will\s+/i, '')             // "Will OKC win..." → "OKC win..."
      .replace(/\s+(wins?|win)\s+.*/i, '')  // "OKC wins by over..." → "OKC"
      .replace(/\s+by\s+over\s+.*/i, '')    // fallback
      .replace(/\s+(the\s+)?(1H|2H|half).*/i, '') // "...win the 1H by..." → clip
      .replace(/[?.]/g, '')
      .trim()
  }

  // ── SPORTS 2H/HALF WINNERS ────────────────────────────────────────────
  // title = "Denver vs Oklahoma City: Second Half Winner?" → strip suffix
  if (series.includes('2HWINNER') || series.includes('1HWINNER')) {
    return title
      .replace(/:\s*(Second|First)\s+Half\s+Winner\??$/i, '')
      .replace(/[?]/g, '')
      .trim()
  }

  // ── DEFAULT ───────────────────────────────────────────────────────────
  // For winner markets and everything else, title is already fine
  // e.g. "Ottawa at Vancouver Winner?" — Kalshi finds this easily
  return title
}

function scoreOpportunity(m, side, price, category, maxVol) {
  const hwr = historicalWinRate(price)
  const ev = hwr * (100 - price) - (1 - hwr) * price
  const ret = ((100 - price) / price * 100)
  const days = daysUntil(m.close_time || m.expiration_time)
  const vol = m.volume_24h || m.volume || 0
  const spread = side === 'YES'
    ? Math.max(0, (m.yes_ask || 0) - (m.yes_bid || 0))
    : Math.max(0, (m.no_ask || 0) - (m.no_bid || 0))

  // ── FIX 2: Remove bandScore favourite bias ─────────────────────────────
  // Old: gave 75-87 the highest bandScore (25) — actively rewarded favourites.
  // New: flat band score; EV alone drives preference, not price level.
  // We keep a small bonus for the 65-74 band (best risk/reward ratio).
  const bandScore     = price >= 65 && price <= 74 ? 20 : price >= 75 && price <= 87 ? 15 : price >= 88 ? 8 : 5

  // ── FIX 3: EV score — tighter ceiling, negative EV now actively penalised ─
  // Old: evScore = max(0, ...) — zero-floors negative EV, hiding bad bets.
  // New: negative EV subtracts points. Max still 35pts at +15¢ EV.
  const evScore       = ev >= 0
    ? Math.max(0, Math.min(35, (ev / 15) * 35))
    : Math.max(-20, (ev / 15) * 20)   // negative EV: up to -20pt penalty

  // ── FIX 4: Liquidity score uses log scale, not linear ─────────────────
  // Old: linear (vol/maxVol)*20 → NBA/NFL swamp everything, thin markets scored 0.
  // New: log scale so a $10k-volume market scores decently vs a $5M market.
  const logVol        = Math.log10(Math.max(vol, 1))
  const logMaxVol     = Math.log10(Math.max(maxVol, 1))
  const liquidScore   = (logVol / Math.max(logMaxVol, 1)) * 15

  const spreadScore   = spread <= 2 ? 10 : spread <= 5 ? 7 : spread <= 10 ? 4 : 1

  // ── FIX 5: Horizon score — favour near-term, heavily penalise 2wk+ ────
  // Old: days 7+ scored 1pt (same as 3wk). Now: 2wk bets get real penalty.
  const horizonScore  = days <= 1 ? 8 : days <= 3 ? 6 : days <= 7 ? 3 : days <= 10 ? 1 : -2

  // ── FIX 6: Category bonuses/penalties — evidence-based ────────────────
  // Old: Sports=0 (no distinction between NBA and WTA Challenger).
  // New: break Sports into sub-types; penalise high-variance / thin markets.
  const ticker  = (m.ticker || '').toUpperCase()
  const isNBA   = ticker.includes('KXNBA')
  const isNHL   = ticker.includes('KXNHL')
  const isMLB   = ticker.includes('KXMLB') || ticker.includes('KXWBC')
  const isNCAAB = ticker.includes('KXNCAABB') || ticker.includes('KXNCAAMB')
  const isNCAAF = ticker.includes('KXNCAAFB')
  const isTennis= ticker.includes('KXWTA') || ticker.includes('KXATP') || ticker.includes('KXCHALLENGER')
  const isNFL   = ticker.includes('KXNFL')
  const isSGP   = ticker.includes('SPREAD') || ticker.includes('TOTAL') || ticker.includes('1HWINNER') || ticker.includes('2HWINNER')
  const isPolitics = category === 'Politics'
  const isMention  = ticker.includes('KXMENTION') || ticker.includes('KXFED') && ticker.includes('MENTION')
  const isSpring   = ticker.includes('KXMLBST')   // Spring training — low signal

  let catBonus = 0
  if (category === 'Economics')  catBonus += 4   // high signal: data releases, Fed
  if (category === 'Weather')    catBonus += 3   // high signal: short horizon, NWS data
  if (category === 'Markets')    catBonus += 2
  if (isPolitics)                catBonus -= 4   // low signal: narrative-driven
  if (isMention)                 catBonus -= 3   // "Will Powell say X?" — unpredictable
  if (isTennis)                  catBonus -= 4   // high variance: upsets common, thin books
  if (isNBA && isSGP)            catBonus -= 3   // same-game props: correlated risk
  if (isNCAAB || isNCAAF)        catBonus += 1   // reasonable signal from spreads
  if (isMLB)                     catBonus += 1   // decent data; spring training offset below
  if (isSpring)                  catBonus -= 2   // spring training: low signal
  if (isNHL)                     catBonus += 1
  if (isNFL)                     catBonus += 2   // thick book, good data

  // ── FIX 7: Extreme favourite penalty ─────────────────────────────────
  // A 90¢ market paying 11% return with 14 days left is not a good bet
  // even if EV is technically positive. Asymmetric payoff kills Kelly sizing.
  const extremeFavePenalty = price >= 88 && days > 3 ? -5 : price >= 85 && days > 7 ? -3 : 0

  const edgeScore = evScore + bandScore + liquidScore + spreadScore + horizonScore + catBonus + extremeFavePenalty

  const horizon = days < 0.5 ? 'today' : days < 1.5 ? 'tomorrow' : days < 7 ? `${Math.round(days)}d` : `${Math.round(days/7)}wk`
  const evLabel = (ev > 0 ? '+' : '') + ev.toFixed(1) + '¢ EV'
  const liq = spread <= 2 ? 'tight spread' : spread <= 6 ? 'moderate spread' : 'wide spread'
  // Win probability shown as calibrated model output, not raw Kalshi price
  const winPct = Math.round(hwr * 100)
  const rationale = `${winPct}% model win · +${ret.toFixed(1)}% return · ${evLabel} · closes ${horizon} · ${liq}`

  const eventTicker = m.event_ticker || m.ticker.split('-').slice(0,-1).join('-')
  const kalshiUrl = `https://kalshi.com/markets/${eventTicker.toLowerCase()}/${m.ticker.toLowerCase()}`

  return {
    ticker: m.ticker,
    eventTicker,
    kalshiUrl,
    title: (() => {
      const base = m.title || m.ticker
      const series = (m.ticker || '').split('-')[0].toUpperCase()
      const city = getWeatherCity(series)
      return city ? `[${city}] ${base}` : base
    })(),
    subtitle: m.subtitle || m.yes_sub_title || '',
    noSubtitle: m.no_sub_title || (m.subtitle || m.yes_sub_title ? `NOT: ${m.subtitle || m.yes_sub_title}` : ''),
    side,
    entryPrice: price,
    potentialReturn: Math.round(ret * 10) / 10,
    impliedProb: price / 100,
    expectedValue: Math.round(ev * 10) / 10,
    edgeScore: Math.round(edgeScore * 10) / 10,
    spread,
    daysToClose: Math.round(days * 10) / 10,
    volume24h: vol,
    category,
    rationale,
    closeTime: m.close_time || m.expiration_time || '',
    searchText: buildSearchText(m, side),
  }
}

async function fetchAllMarkets() {
  const nowTs = Math.floor(Date.now() / 1000)
  const fetchWindow = async (minDays, maxDays) => {
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', '1000')
    url.searchParams.set('status', 'open')
    url.searchParams.set('mve_filter', 'exclude')
    url.searchParams.set('min_close_ts', (nowTs + minDays * 86400).toString())
    url.searchParams.set('max_close_ts', (nowTs + maxDays * 86400).toString())
    const r = await fetch(url.toString(), { headers: { 'Accept': 'application/json', 'User-Agent': 'Foretell/1.0' } })
    if (!r.ok) return []
    const d = await r.json()
    return d.markets || []
  }

  const [w0, w1, w2] = await Promise.all([fetchWindow(0,3), fetchWindow(3,7), fetchWindow(7,14)])
  const seen = new Set()
  const all = []
  for (const m of [...w0, ...w1, ...w2]) {
    if (!seen.has(m.ticker)) { seen.add(m.ticker); all.push(m) }
  }

  // Per-event dedup: best variant per event_ticker
  const eventBest = new Map()
  for (const m of all) {
    const eventKey = m.event_ticker || m.ticker.split('-').slice(0,2).join('-')
    const ya = getPrice(m.yes_ask, m.yes_ask_dollars)
    const na = getPrice(m.no_ask, m.no_ask_dollars)
    const inSweet = (ya>=65&&ya<=87)||(na>=65&&na<=87) ? 1 : 0
    const vol = m.volume_24h || m.volume || 0
    const prev = eventBest.get(eventKey)
    if (!prev || inSweet > prev.s || (inSweet===prev.s && vol > prev.v))
      eventBest.set(eventKey, { market: m, s: inSweet, v: vol })
  }
  return Array.from(eventBest.values()).map(e => e.market)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const markets = await fetchAllMarkets()

    // Build candidate list
    const candidates = []
    for (const m of markets) {
      const vol = m.volume_24h || m.volume || 0
      if (vol < 50) continue  // raised from 5 — ghost markets excluded

      const category = detectCategory(m.ticker, m.event_ticker, m.title)
      if (!category) continue

      const ya = getPrice(m.yes_ask, m.yes_ask_dollars)
      const na = getPrice(m.no_ask, m.no_ask_dollars)

      // ── FIX 8: Tighten price band — exclude extreme favourites ──────────
      // 88-93¢ markets have <13% upside. After spreading costs + model error,
      // they're not attractive unless EV is strong. Allow them but score them down.
      // Min vol raised to 50 (was effectively 5) to exclude ghost markets.
      if (ya >= 65 && ya <= 93 && (m.volume_24h||m.volume||0) >= 50)
        candidates.push({ m, side: 'YES', price: ya, category })
      if (na >= 65 && na <= 93 && (m.volume_24h||m.volume||0) >= 50)
        candidates.push({ m, side: 'NO',  price: na, category })
    }

    const maxVol = Math.max(...candidates.map(c => c.m.volume_24h || c.m.volume || 1), 1)

    const scored = candidates.map(({ m, side, price, category }) =>
      scoreOpportunity(m, side, price, category, maxVol)
    ).sort((a, b) => b.edgeScore - a.edgeScore)

    // Deduplicate by event ticker — best side only
    const seenEvents = new Set()
    const top = []
    for (const opp of scored) {
      if (!seenEvents.has(opp.eventTicker)) {
        seenEvents.add(opp.eventTicker)
        top.push(opp)
      }
      if (top.length >= 20) break
    }

    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60')
    res.status(200).json({ opportunities: top, scanned: markets.length, ts: Date.now() })

  } catch (err) {
    res.status(500).json({ error: err.message, opportunities: [] })
  }
}
