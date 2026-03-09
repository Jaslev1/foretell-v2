import './style.css'
import { fetchOpenMarkets, scoreMarkets, type ScoredOpportunity } from './kalshi.ts'

// ── CATEGORY COLOURS — P&P palette ──────────────────────────────────
const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Tennis:        { text: '#557A72', bg: 'rgba(85,122,114,0.08)',  border: 'rgba(85,122,114,0.28)' },
  NCAA:          { text: '#434371', bg: 'rgba(67,67,113,0.08)',   border: 'rgba(67,67,113,0.28)' },
  NBA:           { text: '#434371', bg: 'rgba(67,67,113,0.08)',   border: 'rgba(67,67,113,0.28)' },
  NFL:           { text: '#557A72', bg: 'rgba(85,122,114,0.08)',  border: 'rgba(85,122,114,0.28)' },
  NHL:           { text: '#4B4137', bg: 'rgba(75,65,55,0.07)',    border: 'rgba(75,65,55,0.24)' },
  MLB:           { text: '#4B4137', bg: 'rgba(75,65,55,0.07)',    border: 'rgba(75,65,55,0.24)' },
  Esports:       { text: '#434371', bg: 'rgba(67,67,113,0.08)',   border: 'rgba(67,67,113,0.28)' },
  Soccer:        { text: '#5A7A1F', bg: 'rgba(90,122,31,0.08)',   border: 'rgba(90,122,31,0.28)' },
  Weather:       { text: '#557A72', bg: 'rgba(85,122,114,0.08)',  border: 'rgba(85,122,114,0.28)' },
  'Crypto/Commodities': { text: '#817A73', bg: 'rgba(129,122,115,0.07)', border: 'rgba(129,122,115,0.24)' },
  Economics:     { text: '#434371', bg: 'rgba(67,67,113,0.08)',   border: 'rgba(67,67,113,0.28)' },
  Politics:      { text: '#4B4137', bg: 'rgba(75,65,55,0.07)',    border: 'rgba(75,65,55,0.24)' },
  Entertainment: { text: '#5A7A1F', bg: 'rgba(90,122,31,0.08)',   border: 'rgba(90,122,31,0.28)' },
  General:       { text: '#817A73', bg: 'rgba(129,122,115,0.07)', border: 'rgba(129,122,115,0.24)' },
}

function catStyle(cat: string) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['General']
}

// ── RENDER HELPERS ───────────────────────────────────────────────────
function scoreBar(score: number): string {
  const pct = Math.min(100, (score / 90) * 100)
  // Lime green for high, teal for mid, warm for low
  const color = pct > 68 ? 'var(--lime)' : pct > 42 ? 'var(--teal)' : 'var(--warm-mid)'
  const textColor = pct > 68 ? 'var(--pos)' : pct > 42 ? 'var(--teal-dark)' : 'var(--warm-mid)'
  return `
    <div class="score-bar-wrap">
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${pct}%;background:${color};"></div>
      </div>
      <span class="score-val" style="color:${textColor};">${score.toFixed(1)}</span>
    </div>`
}

function formatClose(days: number): string {
  if (days < 0.042) return 'closes hours'
  if (days < 1)     return 'closes today'
  if (days < 2)     return 'closes tomorrow'
  if (days < 7)     return `${Math.round(days)}d left`
  if (days < 30)    return `${Math.round(days / 7)}wk left`
  return `${Math.round(days / 30)}mo left`
}

function renderCard(opp: ScoredOpportunity, rank: number): string {
  const cs = catStyle(opp.category)
  const winProb = Math.round(opp.impliedProb * 100)
  const ev = opp.expectedValue
  const evColor = ev > 0 ? 'var(--pos)' : 'var(--neg)'
  const evDisplay = (ev > 0 ? '+' : '') + ev.toFixed(1) + '¢'
  const ret = opp.potentialReturn.toFixed(1)
  const entryDollars = (opp.entryPrice / 100).toFixed(2)
  const isHighConf = winProb >= 80
  const kalshiUrl = `https://kalshi.com/markets/${opp.market.event_ticker.toLowerCase()}`

  return `
  <div class="opp-card">
    <div class="card-rank">${rank}</div>
    <div class="card-body">
      <div class="card-header">
        <span class="card-cat" style="color:${cs.text};border-color:${cs.border};background:${cs.bg};">${opp.category}</span>
        <span class="card-side ${opp.side === 'YES' ? 'side-yes' : 'side-no'}">${opp.side}</span>
        ${isHighConf ? '<span class="card-badge">High Conf</span>' : ''}
        <span class="card-close">${formatClose(opp.daysToClose)}</span>
      </div>

      <h3 class="card-title">${opp.market.title}</h3>
      ${opp.market.subtitle ? `<p class="card-subtitle">${opp.market.subtitle}</p>` : ''}

      <div class="card-metrics">
        <div class="metric">
          <span class="metric-label">Entry</span>
          <span class="metric-value">$${entryDollars}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Implied</span>
          <span class="metric-value">${winProb}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Return</span>
          <span class="metric-value return-val">+${ret}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Exp. Value</span>
          <span class="metric-value" style="color:${evColor};">${evDisplay}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Vol 24h</span>
          <span class="metric-value">${opp.market.volume_24h >= 1000 ? (opp.market.volume_24h / 1000).toFixed(1) + 'k' : opp.market.volume_24h}</span>
        </div>
      </div>

      <div class="card-footer">
        <p class="card-rationale">${opp.rationale}</p>
        ${scoreBar(opp.edgeScore)}
      </div>
    </div>
    <a class="card-link" href="${kalshiUrl}" target="_blank" rel="noopener">
      Trade on Kalshi <span class="card-link-arrow">→</span>
    </a>
  </div>`
}

function renderSkeleton(): string {
  return Array.from({ length: 6 }, (_, i) => `
    <div class="opp-card" style="opacity:${1 - i*0.12}">
      <div class="card-body">
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <div class="sk-line" style="width:70px;height:20px;"></div>
          <div class="sk-line" style="width:40px;height:20px;"></div>
        </div>
        <div class="sk-line" style="width:88%;height:18px;margin-bottom:8px;"></div>
        <div class="sk-line" style="width:65%;height:14px;margin-bottom:20px;"></div>
        <div style="display:flex;gap:1px;">
          ${Array.from({length:5}, () => '<div class="sk-line" style="flex:1;height:38px;"></div>').join('')}
        </div>
      </div>
    </div>`).join('')
}

function renderError(msg: string): string {
  return `
  <div class="error-state">
    <div class="error-icon">◌</div>
    <h3>Failed to load markets</h3>
    <p>${msg}</p>
    <button class="btn-retry" onclick="window.__foretellRetry()">Try again</button>
  </div>`
}

function renderEmpty(): string {
  return `
  <div class="error-state">
    <div class="error-icon">◌</div>
    <h3>No opportunities found</h3>
    <p>No markets in the scoring range right now. Check /api/debug to inspect raw market data.</p>
  </div>`
}

// ── FILTER STATE ─────────────────────────────────────────────────────
let allOpps: ScoredOpportunity[] = []
let activeCategory = 'All'
let sortBy: 'score' | 'return' | 'prob' | 'close' = 'score'

function getFiltered(): ScoredOpportunity[] {
  let list = activeCategory === 'All' ? allOpps : allOpps.filter(o => o.category === activeCategory)
  return [...list].sort((a, b) => {
    if (sortBy === 'score')  return b.edgeScore - a.edgeScore
    if (sortBy === 'return') return b.potentialReturn - a.potentialReturn
    if (sortBy === 'prob')   return b.impliedProb - a.impliedProb
    if (sortBy === 'close')  return a.daysToClose - b.daysToClose
    return 0
  })
}

function updateGrid() {
  const grid = document.getElementById('opp-grid')
  if (!grid) return
  const filtered = getFiltered()
  if (filtered.length === 0) { grid.innerHTML = renderEmpty(); return }
  grid.innerHTML = filtered.map((o, i) => renderCard(o, i + 1)).join('')
}

function updateCategoryTabs(opps: ScoredOpportunity[]) {
  const counts: Record<string, number> = { All: opps.length }
  for (const o of opps) counts[o.category] = (counts[o.category] || 0) + 1

  const tabs = document.getElementById('cat-tabs')
  if (!tabs) return
  tabs.innerHTML = Object.entries(counts).map(([cat, n]) => `
    <button class="cat-tab ${cat === activeCategory ? 'active' : ''}" data-cat="${cat}">
      ${cat} <span class="cat-count">${n}</span>
    </button>
  `).join('')

  tabs.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = (btn as HTMLElement).dataset.cat || 'All'
      tabs.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      updateGrid()
    })
  })
}

function updateStats(opps: ScoredOpportunity[]) {
  const avgProb   = opps.length ? opps.reduce((s, o) => s + o.impliedProb, 0) / opps.length : 0
  const avgReturn = opps.length ? opps.reduce((s, o) => s + o.potentialReturn, 0) / opps.length : 0
  const set = (id: string, v: string) => { const e = document.getElementById(id); if (e) e.textContent = v }
  set('stat-count', opps.length.toString())
  set('stat-prob', `${Math.round(avgProb * 100)}%`)
  set('stat-return', `${avgReturn.toFixed(1)}%`)
  set('stat-updated', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
}

// ── MAIN LOAD ─────────────────────────────────────────────────────────
async function loadOpportunities() {
  const grid = document.getElementById('opp-grid')
  if (!grid) return
  grid.innerHTML = renderSkeleton()

  const status = document.getElementById('load-status')
  if (status) status.textContent = 'Fetching markets…'

  try {
    const markets = await fetchOpenMarkets()
    if (status) status.textContent = `Scoring ${markets.length} markets…`

    const opps = scoreMarkets(markets)
    allOpps = opps

    updateStats(opps)
    updateCategoryTabs(opps)
    updateGrid()

    if (status) status.textContent = `${markets.length} scanned · ${opps.length} found`
  } catch (err: any) {
    grid.innerHTML = renderError(err?.message || 'Unknown error')
    if (status) status.textContent = 'Load failed'
  }
}

// ── HTML SHELL ────────────────────────────────────────────────────────
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div class="page">

  <header>
    <div class="header-inner">
      <a class="logo" href="#">
        <div class="logo-mark">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 13 L6 8 L10 11 L16 3" stroke="#B6EE4F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="16" cy="3" r="2" fill="#B6EE4F"/>
          </svg>
        </div>
        <span class="logo-name">Foretell</span>
      </a>
      <div class="header-right">
        <span class="header-eyebrow">Kalshi Scanner</span>
        <span id="load-status">Loading…</span>
      </div>
    </div>
  </header>

  <section class="hero">
    <div class="hero-inner">
      <div class="hero-left">
        <div class="hero-eyebrow">
          <div class="hero-eyebrow-line"></div>
          <span class="hero-eyebrow-text">Live Market Scanner</span>
        </div>
        <h1>Today's top <em>20</em><br>Kalshi opportunities.</h1>
        <p class="hero-sub">High-probability, short-horizon positions ranked by expected value — calibrated against real trade history.</p>
      </div>
      <div class="stats-block">
        <div class="stat-cell">
          <span class="stat-val" id="stat-count">—</span>
          <span class="stat-key">Opportunities</span>
        </div>
        <div class="stat-cell">
          <span class="stat-val" id="stat-prob">—</span>
          <span class="stat-key">Avg win prob</span>
        </div>
        <div class="stat-cell">
          <span class="stat-val" id="stat-return">—</span>
          <span class="stat-key">Avg return</span>
        </div>
        <div class="stat-cell">
          <span class="stat-val" id="stat-updated">—</span>
          <span class="stat-key">Last updated</span>
        </div>
      </div>
    </div>
  </section>

  <div class="controls-bar">
    <div class="controls-inner">
      <div id="cat-tabs" class="cat-tabs">
        <button class="cat-tab active" data-cat="All">All</button>
      </div>
      <div class="sort-controls">
        <span class="sort-label">Sort</span>
        <select id="sort-select" class="sort-select">
          <option value="score">Best score</option>
          <option value="return">Highest return</option>
          <option value="prob">Win probability</option>
          <option value="close">Closes soonest</option>
        </select>
        <button class="btn-refresh" id="btn-refresh">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M11 6A5 5 0 1 1 6 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M6 1l2.5-1.5M6 1l2.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Refresh
        </button>
      </div>
    </div>
  </div>

  <main class="main-grid">
    <div id="opp-grid" class="opp-grid"></div>
  </main>

  <footer>
    <div class="footer-inner">
      <div>
        <div class="footer-brand">Foretell</div>
        <p>Data sourced from the <a href="https://kalshi.com" target="_blank" rel="noopener">Kalshi</a> public API. Not financial advice. Past performance does not predict future results.</p>
      </div>
      <div class="footer-right">
        <p>Score = EV (40) + price band (25)<br>+ liquidity (20) + spread (10) + horizon (5)</p>
      </div>
    </div>
  </footer>

</div>`

document.getElementById('sort-select')?.addEventListener('change', (e) => {
  sortBy = (e.target as HTMLSelectElement).value as typeof sortBy
  updateGrid()
})

document.getElementById('btn-refresh')?.addEventListener('click', () => {
  activeCategory = 'All'
  sortBy = 'score'
  loadOpportunities()
})

window.__foretellRetry = loadOpportunities
loadOpportunities()

declare global {
  interface Window { __foretellRetry: () => void }
}
