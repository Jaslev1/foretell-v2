// api/debug.js — shows raw sample data so we can see actual field values
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', '10')
    url.searchParams.set('status', 'active')
    url.searchParams.set('mve_filter', 'exclude')

    const upstream = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Foretell/1.0' }
    })

    const data = await upstream.json()
    const markets = data.markets || []

    // Show field summary for first 10 markets
    const summary = markets.map(m => ({
      ticker: m.ticker,
      title: m.title?.slice(0, 60),
      status: m.status,
      yes_bid: m.yes_bid,
      yes_ask: m.yes_ask,
      no_bid: m.no_bid,
      no_ask: m.no_ask,
      yes_bid_dollars: m.yes_bid_dollars,
      yes_ask_dollars: m.yes_ask_dollars,
      last_price: m.last_price,
      volume_24h: m.volume_24h,
      close_time: m.close_time,
    }))

    res.status(200).json({ count: markets.length, cursor: data.cursor, sample: summary })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
