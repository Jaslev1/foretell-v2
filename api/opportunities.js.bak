// api/opportunities.js — full server-side scoring, returns top 20 ready to render
// Bypasses TypeScript client scorer entirely

const HISTORICAL_WIN_RATES = {
  90: 0.97, 80: 0.76, 70: 0.73, 60: 0.81, 50: 0.39
}

function historicalWinRate(prob) {
  if (prob >= 90) return 0.97
  if (prob >= 80) return 0.76
  if (prob >= 70) return 0.73
  if (prob >= 65) return 0.81
  return 0.39
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


// Weather series → city name
const WEATHER_CITY = {
  KXHIGHNY:'New York', KXHIGHLA:'Los Angeles', KXHIGHCHI:'Chicago',
  KXHIGHMIA:'Miami', KXHIGHSF:'San Francisco', KXHIGHDAL:'Dallas',
  KXHIGHHOU:'Houston', KXHIGHPHX:'Phoenix', KXHIGHSEA:'Seattle',
  KXHIGHDEN:'Denver', KXHIGHBOS:'Boston', KXHIGHATL:'Atlanta',
  KXLOWNY:'New York', KXLOWCHI:'Chicago', KXLOWBOS:'Boston',
  KXSNOWNY:'New York', KXSNOWCHI:'Chicago', KXSNOWBOS:'Boston',
  KXRAINNY:'New York', KXRAINLA:'Los Angeles',
}

function buildSearchText(m, side) {
  const ticker = m.ticker || ''
  const title = m.title || ticker
  const series = ticker.split('-')[0].toUpperCase()

  // Weather: prepend city name if missing
  if (WEATHER_CITY[series]) {
    return `${WEATHER_CITY[series]}: ${title}`
  }

  // Sports spread/total: Kalshi search works best with the event title
  // e.g. "Charlotte at Phoenix" rather than the strike variant "Charlotte wins by over 9.5"
  // Use event_ticker derived title when available, fall back to market title
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

  const evScore       = Math.max(0, Math.min(40, (ev / 25) * 40))
  const bandScore     = price >= 75 && price <= 87 ? 25 : price >= 65 && price < 75 ? 22 : price >= 88 ? 15 : 10
  const liquidScore   = (vol / Math.max(maxVol, 1)) * 20
  const spreadScore   = spread <= 2 ? 10 : spread <= 5 ? 7 : spread <= 10 ? 4 : 1
  const horizonScore  = days <= 1 ? 5 : days <= 3 ? 4 : days <= 7 ? 2 : 1
  const catBonus      = category === 'Economics' ? 3 : category === 'Weather' ? 2 : category === 'Markets' ? 2 : category === 'Politics' ? -2 : 0
  const edgeScore     = evScore + bandScore + liquidScore + spreadScore + horizonScore + catBonus

  const horizon = days < 0.5 ? 'today' : days < 1.5 ? 'tomorrow' : days < 7 ? `${Math.round(days)}d` : `${Math.round(days/7)}wk`
  const evLabel = (ev > 0 ? '+' : '') + ev.toFixed(1) + '¢ EV'
  const liq = spread <= 2 ? 'tight spread' : spread <= 6 ? 'moderate spread' : 'wide spread'
  const rationale = `${Math.round(hwr * 100)}% hist. win · +${ret.toFixed(1)}% return · ${evLabel} · closes ${horizon} · ${liq}`

  const eventTicker = m.event_ticker || m.ticker.split('-').slice(0,-1).join('-')
  const kalshiUrl = `https://kalshi.com/markets/${eventTicker.toLowerCase()}/${m.ticker.toLowerCase()}`

  return {
    ticker: m.ticker,
    eventTicker,
    kalshiUrl,
    title: (() => {
      const base = m.title || m.ticker
      const series = (m.ticker || '').split('-')[0].toUpperCase()
      const city = WEATHER_CITY[series]
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
      if (vol < 5) continue

      const category = detectCategory(m.ticker, m.event_ticker, m.title)
      if (!category) continue

      const ya = getPrice(m.yes_ask, m.yes_ask_dollars)
      const na = getPrice(m.no_ask, m.no_ask_dollars)

      if (ya >= 65 && ya <= 93) candidates.push({ m, side: 'YES', price: ya, category })
      if (na >= 65 && na <= 93) candidates.push({ m, side: 'NO',  price: na, category })
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
