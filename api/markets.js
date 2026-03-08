// api/markets.js
// Vercel serverless function — runs server-side, no CORS issues
export default async function handler(req, res) {
  // Allow browser requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { cursor = '', limit = '1000' } = req.query

    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', limit)
    url.searchParams.set('status', 'open')
    if (cursor) url.searchParams.set('cursor', cursor)

    const upstream = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Foretell/1.0',
      }
    })

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Kalshi API returned ${upstream.status}` })
    }

    const data = await upstream.json()

    // Cache for 5 minutes on Vercel edge
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.status(200).json(data)

  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy error' })
  }
}
