export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    // Call our own markets endpoint
    const base = `https://${req.headers.host}`
    const mRes = await fetch(`${base}/api/markets`)
    const { markets = [] } = await mRes.json()

    const results = []

    for (const m of markets) {
      const getYesPrice = () => {
        if (m.yes_ask > 0) return m.yes_ask
        const d = parseFloat(m.yes_ask_dollars || '0') * 100
        if (d > 0) return Math.round(d)
        return 0
      }
      const getNoPrice = () => {
        if (m.no_ask > 0) return m.no_ask
        const d = parseFloat(m.no_ask_dollars || '0') * 100
        if (d > 0) return Math.round(d)
        return 0
      }

      const vol = m.volume_24h || m.volume || 0
      if (vol < 5) continue

      const yesAsk = getYesPrice()
      const noAsk  = getNoPrice()

      // Check both sides
      for (const [side, price] of [['YES', yesAsk], ['NO', noAsk]]) {
        if (price >= 65 && price <= 93) {
          results.push({
            ticker: m.ticker,
            title: m.title?.slice(0, 50),
            side,
            price,
            vol,
            no_ask_raw: m.no_ask,
            no_ask_dollars: m.no_ask_dollars,
            yes_ask_raw: m.yes_ask,
          })
        }
      }
    }

    results.sort((a, b) => b.vol - a.vol)

    res.status(200).json({
      total_markets: markets.length,
      scoreable: results.length,
      top20: results.slice(0, 20)
    })
  } catch(err) {
    res.status(500).json({ error: err.message })
  }
}
