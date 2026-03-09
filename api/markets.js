// api/markets.js — Vercel serverless proxy for Kalshi API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { cursor = '', limit = '1000' } = req.query

    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', limit)
    // Kalshi uses "active" for tradeable markets
    url.searchParams.set('status', 'active')
    if (cursor) url.searchParams.set('cursor', cursor)

    const upstream = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Foretell/1.0' }
    })

    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(upstream.status).json({ error: `Kalshi ${upstream.status}: ${body.slice(0,200)}` })
    }

    const raw = await upstream.json()

    // Filter out MVE parlay combos (ticker contains hash-like segments) and zero-price markets
    const markets = (raw.markets || []).filter(m => {
      // Drop multi-leg cross-category combos — they have random hash tickers and no pricing
      if (m.ticker && m.ticker.includes('CROSSCATEGORY')) return false
      // Must have at least one tradeable side
      const hasPrice =
        (m.yes_ask > 0) || (parseFloat(m.yes_ask_dollars || '0') > 0) ||
        (m.no_ask  > 0) || (parseFloat(m.no_ask_dollars  || '0') > 0)
      return hasPrice
    })

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.status(200).json({ markets, cursor: raw.cursor || '' })

  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy error' })
  }
}
