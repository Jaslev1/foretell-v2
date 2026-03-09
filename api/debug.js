// api/debug.js — diagnostic endpoint
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const results = {}

  // Test 1: no status param at all
  try {
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', '5')
    const r = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
    const d = await r.json()
    results.no_status = { http: r.status, count: (d.markets||[]).length, statuses: [...new Set((d.markets||[]).map(m=>m.status))], sample_ticker: d.markets?.[0]?.ticker }
  } catch(e) { results.no_status = { error: e.message } }

  // Test 2: status=open
  try {
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', '5')
    url.searchParams.set('status', 'open')
    const r = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
    const d = await r.json()
    results.status_open = { http: r.status, count: (d.markets||[]).length, sample_ticker: d.markets?.[0]?.ticker }
  } catch(e) { results.status_open = { error: e.message } }

  // Test 3: status=active
  try {
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', '5')
    url.searchParams.set('status', 'active')
    const r = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
    const body = await r.text()
    results.status_active = { http: r.status, body_preview: body.slice(0,300) }
  } catch(e) { results.status_active = { error: e.message } }

  // Test 4: show a real market's fields (no status filter)
  try {
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets')
    url.searchParams.set('limit', '3')
    const r = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
    const d = await r.json()
    results.field_sample = (d.markets||[]).slice(0,2).map(m => ({
      ticker: m.ticker,
      status: m.status,
      yes_ask: m.yes_ask,
      yes_ask_dollars: m.yes_ask_dollars,
      no_ask: m.no_ask,
      close_time: m.close_time
    }))
  } catch(e) { results.field_sample = { error: e.message } }

  res.status(200).json(results)
}
