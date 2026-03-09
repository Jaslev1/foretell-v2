export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    const nowTs = Math.floor(Date.now() / 1000)

    const fetchWindow = async (minDays, maxDays) => {
      const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
      url.searchParams.set('limit', '1000')
      url.searchParams.set('status', 'open')
      url.searchParams.set('mve_filter', 'exclude')
      url.searchParams.set('min_close_ts', (nowTs + minDays * 86400).toString())
      url.searchParams.set('max_close_ts', (nowTs + maxDays * 86400).toString())
      const r = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
      if (!r.ok) return []
      const d = await r.json()
      return d.markets || []
    }

    const [w0, w1, w2] = await Promise.all([fetchWindow(0,3), fetchWindow(3,7), fetchWindow(7,14)])
    const all = [...w0, ...w1, ...w2]

    // Dedup by ticker
    const seen = new Set()
    const unique = []
    for (const m of all) { if (!seen.has(m.ticker)) { seen.add(m.ticker); unique.push(m) } }

    // Event dedup (same as markets.js)
    const eventBest = new Map()
    for (const m of unique) {
      const eventKey = m.event_ticker || m.ticker.split('-').slice(0,2).join('-')
      const yesAsk = m.yes_ask > 0 ? m.yes_ask : Math.round(parseFloat(m.yes_ask_dollars||'0')*100)
      const noAsk  = m.no_ask  > 0 ? m.no_ask  : Math.round(parseFloat(m.no_ask_dollars||'0')*100)
      const inSweet = (yesAsk>=65&&yesAsk<=87)||(noAsk>=65&&noAsk<=87) ? 1 : 0
      const vol = m.volume_24h||m.volume||0
      const prev = eventBest.get(eventKey)
      if (!prev || inSweet > prev.s || (inSweet===prev.s && vol > prev.v))
        eventBest.set(eventKey, { market: m, s: inSweet, v: vol })
    }
    const deduped = Array.from(eventBest.values()).map(e => e.market)

    // Volume distribution
    const volBuckets = {'0':0,'1-10':0,'11-100':0,'101-1k':0,'1k+':0}
    for (const m of deduped) {
      const v = m.volume_24h||m.volume||0
      if (v===0) volBuckets['0']++
      else if (v<=10) volBuckets['1-10']++
      else if (v<=100) volBuckets['11-100']++
      else if (v<=1000) volBuckets['101-1k']++
      else volBuckets['1k+']++
    }

    // Price distribution on deduped set
    const inRange = deduped.filter(m => {
      const ya = m.yes_ask>0?m.yes_ask:Math.round(parseFloat(m.yes_ask_dollars||'0')*100)
      const na = m.no_ask>0?m.no_ask:Math.round(parseFloat(m.no_ask_dollars||'0')*100)
      return (ya>=65&&ya<=93)||(na>=65&&na<=93)
    })

    res.status(200).json({
      raw_total: all.length,
      unique_tickers: unique.length,
      after_event_dedup: deduped.length,
      in_price_range: inRange.length,
      vol_distribution: volBuckets,
      sample_with_vol: deduped.filter(m=>(m.volume_24h||m.volume||0)>5).slice(0,8).map(m=>({
        ticker: m.ticker,
        title: m.title?.slice(0,55),
        yes_ask: m.yes_ask,
        no_ask: m.no_ask,
        vol: m.volume_24h||m.volume||0,
        close: m.close_time?.slice(0,10)
      }))
    })
  } catch(err) {
    res.status(500).json({ error: err.message })
  }
}
