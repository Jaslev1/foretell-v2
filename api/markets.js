// api/markets.js — Vercel serverless proxy for Kalshi API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { cursor = '', limit = '1000' } = req.query

    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', limit)
    url.searchParams.set('status', 'open')   // "open" is the valid param; API returns "active" markets
    if (cursor) url.searchParams.set('cursor', cursor)

    const upstream = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Foretell/1.0' }
    })

    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(upstream.status).json({ error: `Kalshi ${upstream.status}: ${body.slice(0,200)}` })
    }

    const raw = await upstream.json()

    // Filter out:
    // 1. MVE multi-leg parlay combos (CROSSCATEGORY, MVESPORTS etc.) — zero pricing, no standalone value
    // 2. Markets with no tradeable ask on either side
    const markets = (raw.markets || []).filter(m => {
      if (!m.ticker) return false
      if (m.ticker.includes('CROSSCATEGORY')) return false
      if (m.ticker.includes('MVESPORTS')) return false
      if (m.ticker.includes('MVECROSS')) return false
      const yesAsk = m.yes_ask > 0 ? m.yes_ask : Math.round(parseFloat(m.yes_ask_dollars || '0') * 100)
      const noAsk  = m.no_ask  > 0 ? m.no_ask  : Math.round(parseFloat(m.no_ask_dollars  || '0') * 100)
      // Must have a real ask between 1–99 on at least one side
      return (yesAsk >= 1 && yesAsk <= 99) || (noAsk >= 1 && noAsk <= 99)
    })

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.status(200).json({ markets, cursor: raw.cursor || '' })

  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy error' })
  }
}
