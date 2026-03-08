// api/markets.js — Vercel serverless proxy for Kalshi API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { cursor = '', limit = '1000' } = req.query

    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', limit)
    // Kalshi uses "active" not "open" for tradeable markets
    url.searchParams.set('status', 'active')
    // Exclude multi-leg parlay combos — they have no standalone pricing
    url.searchParams.set('mve_filter', 'exclude')
    if (cursor) url.searchParams.set('cursor', cursor)

    const upstream = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Foretell/1.0' }
    })

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Kalshi API returned ${upstream.status}` })
    }

    const raw = await upstream.json()

    // Secondary filter server-side: drop zero-price and zero-volume markets
    const markets = (raw.markets || []).filter(m =>
      (m.yes_ask > 0 || parseFloat(m.yes_ask_dollars || '0') > 0 ||
       m.no_ask  > 0 || parseFloat(m.no_ask_dollars  || '0') > 0)
    )

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.status(200).json({ markets, cursor: raw.cursor || '' })

  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy error' })
  }
}
