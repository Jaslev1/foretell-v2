export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const nowTs = Math.floor(Date.now() / 1000)
    const results = {}

    // Fetch 0-3 day window with mve_filter (same as markets.js)
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', '500')
    url.searchParams.set('status', 'open')
    url.searchParams.set('mve_filter', 'exclude')
    url.searchParams.set('min_close_ts', nowTs.toString())
    url.searchParams.set('max_close_ts', (nowTs + 3 * 86400).toString())

    const r = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
    const d = await r.json()
    const markets = d.markets || []

    results.http_status = r.status
    results.count = markets.length
    results.sample = markets.slice(0, 8).map(m => ({
      ticker: m.ticker,
      title: m.title?.slice(0, 55),
      status: m.status,
      yes_ask: m.yes_ask,
      yes_ask_dollars: m.yes_ask_dollars,
      no_ask: m.no_ask,
      volume_24h: m.volume_24h,
      close_time: m.close_time,
    }))

    res.status(200).json(results)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
