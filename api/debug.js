// api/debug.js — shows raw sample of real markets after filtering
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', '1000')
    url.searchParams.set('status', 'open')

    const r = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
    const d = await r.json()
    const all = d.markets || []

    const filtered = all.filter(m => {
      if (!m.ticker) return false
      if (m.ticker.includes('CROSSCATEGORY') || m.ticker.includes('MVESPORTS') || m.ticker.includes('MVECROSS')) return false
      const yesAsk = m.yes_ask > 0 ? m.yes_ask : Math.round(parseFloat(m.yes_ask_dollars || '0') * 100)
      const noAsk  = m.no_ask  > 0 ? m.no_ask  : Math.round(parseFloat(m.no_ask_dollars  || '0') * 100)
      return (yesAsk >= 1 && yesAsk <= 99) || (noAsk >= 1 && noAsk <= 99)
    })

    res.status(200).json({
      total_raw: all.length,
      after_filter: filtered.length,
      sample: filtered.slice(0, 10).map(m => ({
        ticker: m.ticker,
        title: m.title?.slice(0, 60),
        status: m.status,
        yes_ask: m.yes_ask,
        yes_ask_dollars: m.yes_ask_dollars,
        no_ask: m.no_ask,
        no_ask_dollars: m.no_ask_dollars,
        volume_24h: m.volume_24h,
        close_time: m.close_time,
      }))
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
