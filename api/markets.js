// api/markets.js — Vercel serverless proxy for Kalshi API
// Key insight from working implementation: must use min_close_ts/max_close_ts
// to get real single-outcome markets. Without time windows, API returns MVE parlay combos.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const nowTs = Math.floor(Date.now() / 1000)

    // Fetch three time windows in parallel (same approach as working Lovable implementation)
    const windows = [
      { minDays: 0, maxDays: 3 },
      { minDays: 3, maxDays: 7 },
      { minDays: 7, maxDays: 14 },
    ]

    const fetchWindow = async ({ minDays, maxDays }) => {
      const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
      url.searchParams.set('limit', '500')
      url.searchParams.set('status', 'open')
      url.searchParams.set('mve_filter', 'exclude')
      url.searchParams.set('min_close_ts', (nowTs + minDays * 86400).toString())
      url.searchParams.set('max_close_ts', (nowTs + maxDays * 86400).toString())

      const r = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Foretell/1.0' }
      })
      if (!r.ok) return []
      const d = await r.json()
      return d.markets || []
    }

    const windowResults = await Promise.all(windows.map(fetchWindow))

    // Deduplicate by ticker
    const seen = new Set()
    const markets = []
    for (const batch of windowResults) {
      for (const m of batch) {
        if (!seen.has(m.ticker)) {
          seen.add(m.ticker)
          markets.push(m)
        }
      }
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.status(200).json({ markets, cursor: '' })

  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy error' })
  }
}
