export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', '1000')
    url.searchParams.set('status', 'open')

    const r = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
    const d = await r.json()
    const all = d.markets || []

    // Skip MVE junk but NO price filter — show raw values
    const real = all.filter(m => m.ticker &&
      !m.ticker.includes('CROSSCATEGORY') &&
      !m.ticker.includes('MVE'))

    // Bucket by yes_ask value to understand distribution
    const buckets = {}
    for (const m of real) {
      const key = `yes_ask=${m.yes_ask} yes_ask_$=${m.yes_ask_dollars} no_ask=${m.no_ask} no_ask_$=${m.no_ask_dollars}`
      buckets[key] = (buckets[key] || 0) + 1
    }

    // Top 20 most common price combos
    const topBuckets = Object.entries(buckets)
      .sort((a,b) => b[1]-a[1])
      .slice(0,20)
      .map(([k,v]) => `${v}x  ${k}`)

    // First 5 non-MVE markets with ALL their fields
    const rawSample = real.slice(0,5).map(m => {
      const out = {}
      for (const k of Object.keys(m)) out[k] = m[k]
      return out
    })

    res.status(200).json({
      total_raw: all.length,
      non_mve: real.length,
      price_distribution: topBuckets,
      raw_sample: rawSample
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
