export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
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

    const [w0, w1, w2] = await Promise.all([
      fetchWindow(0, 3),
      fetchWindow(3, 7),
      fetchWindow(7, 14),
    ])

    // Deduplicate by ticker across windows
    const seen = new Set()
    const allMarkets = []
    for (const m of [...w0, ...w1, ...w2]) {
      if (!seen.has(m.ticker)) {
        seen.add(m.ticker)
        allMarkets.push(m)
      }
    }

    // Per-event deduplication: for markets that are just strike variants of the same event
    // (same event_ticker), keep only the one with the best tradeable price in 55–93 range
    // and highest volume. This collapses "Mexico vs USA Total Runs? x14" into one entry.
    const eventBest = new Map()
    for (const m of allMarkets) {
      const eventKey = m.event_ticker || m.ticker.split('-').slice(0, 2).join('-')

      const yesAsk = m.yes_ask > 0 ? m.yes_ask : Math.round(parseFloat(m.yes_ask_dollars || '0') * 100)
      const noAsk  = m.no_ask  > 0 ? m.no_ask  : Math.round(parseFloat(m.no_ask_dollars  || '0') * 100)
      const bestPrice = (yesAsk >= 55 && yesAsk <= 93) ? yesAsk
                      : (noAsk  >= 55 && noAsk  <= 93) ? noAsk
                      : 0

      // Score this variant: prefer prices in sweet spot 65–87, then higher volume
      const inSweetSpot = bestPrice >= 65 && bestPrice <= 87 ? 1 : 0
      const vol = m.volume_24h || m.volume || 0

      if (!eventBest.has(eventKey)) {
        eventBest.set(eventKey, { market: m, sweetSpot: inSweetSpot, vol })
      } else {
        const prev = eventBest.get(eventKey)
        if (inSweetSpot > prev.sweetSpot || (inSweetSpot === prev.sweetSpot && vol > prev.vol)) {
          eventBest.set(eventKey, { market: m, sweetSpot: inSweetSpot, vol })
        }
      }
    }

    const markets = Array.from(eventBest.values()).map(e => e.market)

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.status(200).json({ markets, cursor: '' })

  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy error' })
  }
}
