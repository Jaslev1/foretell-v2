import './style.css'
import { fetchOpenMarkets, scoreMarkets, type ScoredOpportunity } from './kalshi.ts'

// ── CATEGORY COLOURS ────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Economics:     '#f0a83c',
  Crypto:        '#7c6af7',
  Weather:       '#3cd9a0',
  Sports:        '#e85858',
  Politics:      '#5899e8',
  Markets:       '#e8b458',
  Entertainment: '#e858c8',
  General:       '#8a92a8',
}

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || '#8a92a8'
}

// ── RENDER HELPERS ───────────────────────────────────────────────────
function scoreBar(score: number): string {
  const pct = Math.min(100, (score / 90) * 100)
  const color = pct > 70 ? '#3cd9a0' : pct > 45 ? '#f0a83c' : '#e85858'
  return `
    <div class="score-bar-wrap">
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${pct}%;background:${color};"></div>
      </div>
      <span class="score-val" style="color:${color};">${score.toFixed(1)}</span>
    </div>`
}

function formatClose(days: number): string {
  if (days < 0.042) return 'Closes in hours'
  if (days < 1) return `Closes today`
  if (days < 2) return `Closes tomorrow`
  if (days < 7) return `${Math.round(days)}d left`
  if (days < 30) return `${Math.round(days / 7)}wk left`
  return `${Math.round(days / 30)}mo left`
}

function renderCard(opp: ScoredOpportunity, rank: number): string {
  const col = categoryColor(opp.category)
  const winProb = Math.round(opp.impliedProb * 100)
  const ret = opp.potentialReturn.toFixed(1)
  const entryDollars = (opp.entryPrice / 100).toFixed(2)
  const isHighConf = winProb >= 80
  const kalshiUrl = `https://kalshi.com/markets/${opp.market.event_ticker.toLowerCase()}`

  return `
  <div class="opp-card" data-rank="${rank}">
    <div class="card-rank">${rank}</div>
    <div class="card-body">
      <div class="card-header">
        <span class="card-cat" style="color:${col};border-color:${col}22;background:${col}11;">${opp.category}</span>
        <span class="card-side ${opp.side === 'YES' ? 'side-yes' : 'side-no'}">${opp.side}</span>
        ${isHighConf ? '<span class="card-badge">HIGH CONF</span>' : ''}
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
          <span class="metric-label">Win Prob</span>
          <span class="metric-value" style="color:${col};">${winProb}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Return</span>
          <span class="metric-value return-val">+${ret}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Spread</span>
          <span class="metric-value">${opp.spread}¢</span>
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
      Trade on Kalshi →
    </a>
  </div>`
}

function renderSkeleton(): string {
  return Array.from({ length: 6 }, (_, i) => `
    <div class="opp-card skeleton" style="animation-delay:${i * 0.08}s;">
      <div class="card-rank sk-block" style="width:28px;height:28px;"></div>
      <div class="card-body">
        <div class="sk-block" style="width:30%;height:14px;margin-bottom:14px;"></div>
        <div class="sk-block" style="width:85%;height:20px;margin-bottom:8px;"></div>
        <div class="sk-block" style="width:60%;height:14px;margin-bottom:20px;"></div>
        <div style="display:flex;gap:16px;">
          ${Array.from({length:5}, () => '<div class="sk-block" style="width:60px;height:36px;"></div>').join('')}
        </div>
      </div>
    </div>`).join('')
}

function renderError(msg: string): string {
  return `
  <div class="error-state">
    <div class="error-icon">⚠</div>
    <h3>Failed to load markets</h3>
    <p>${msg}</p>
    <button class="btn-retry" onclick="window.__foretellRetry()">Retry</button>
  </div>`
}

function renderEmpty(): string {
  return `
  <div class="error-state">
    <div class="error-icon">◎</div>
    <h3>No opportunities found</h3>
    <p>Loading live data… if this persists, check /api/debug for raw market data.</p>
  </div>`
}

// ── FILTER STATE ─────────────────────────────────────────────────────
let allOpps: ScoredOpportunity[] = []
let activeCategory = 'All'
let sortBy: 'score' | 'return' | 'prob' | 'close' = 'score'

function getFiltered(): ScoredOpportunity[] {
  let list = activeCategory === 'All' ? allOpps : allOpps.filter(o => o.category === activeCategory)
  list = [...list].sort((a, b) => {
    if (sortBy === 'score')  return b.edgeScore - a.edgeScore
    if (sortBy === 'return') return b.potentialReturn - a.potentialReturn
    if (sortBy === 'prob')   return b.impliedProb - a.impliedProb
    if (sortBy === 'close')  return a.daysToClose - b.daysToClose
    return 0
  })
  return list
}

function updateGrid() {
  const grid = document.getElementById('opp-grid')
  if (!grid) return
  const filtered = getFiltered()
  if (filtered.length === 0) {
    grid.innerHTML = renderEmpty()
    return
  }
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
  const avgProb = opps.length ? opps.reduce((s, o) => s + o.impliedProb, 0) / opps.length : 0
  const avgReturn = opps.length ? opps.reduce((s, o) => s + o.potentialReturn, 0) / opps.length : 0
  const el = (id: string, val: string) => { const e = document.getElementById(id); if (e) e.textContent = val }
  el('stat-count', opps.length.toString())
  el('stat-prob', `${Math.round(avgProb * 100)}%`)
  el('stat-return', `${avgReturn.toFixed(1)}%`)
  el('stat-updated', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
}

// ── MAIN LOAD ─────────────────────────────────────────────────────────
async function loadOpportunities() {
  const grid = document.getElementById('opp-grid')
  if (!grid) return

  // Show skeleton
  grid.innerHTML = renderSkeleton()

  // Update status
  const status = document.getElementById('load-status')
  if (status) status.textContent = 'Fetching markets…'

  try {
    const markets = await fetchOpenMarkets(5)
    if (status) status.textContent = `Scoring ${markets.length} markets…`

    const opps = scoreMarkets(markets)
    allOpps = opps

    updateStats(opps)
    updateCategoryTabs(opps)
    updateGrid()

    if (status) status.textContent = `${markets.length} scanned · ${opps.length} opportunities found`

  } catch (err: any) {
    grid.innerHTML = renderError(err?.message || 'Unknown error')
    const status = document.getElementById('load-status')
    if (status) status.textContent = 'Load failed'
  }
}

// ── MOUNT APP ─────────────────────────────────────────────────────────
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div class="page">

  <!-- HEADER -->
  <header>
    <div class="header-inner">
      <div class="logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke="#f0a83c" stroke-width="1.5"/>
          <path d="M7 19 L11 12 L15 16 L21 7" stroke="#f0a83c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="21" cy="7" r="2.5" fill="#f0a83c"/>
        </svg>
        <span class="logo-text">Foretell</span>
      </div>
      <div class="header-meta">
        <span class="header-tag">Kalshi Scanner</span>
        <span class="header-status" id="load-status">Loading…</span>
      </div>
    </div>
  </header>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-text">
        <h1>Today's Top <span class="accent">20</span> Kalshi Opportunities</h1>
        <p>High-probability, short-horizon bets ranked by return-to-risk score. Updated daily from live Kalshi markets.</p>
      </div>
      <div class="stats-row">
        <div class="stat-box">
          <span class="stat-n" id="stat-count">—</span>
          <span class="stat-l">Opportunities</span>
        </div>
        <div class="stat-box">
          <span class="stat-n" id="stat-prob">—</span>
          <span class="stat-l">Avg Win Prob</span>
        </div>
        <div class="stat-box">
          <span class="stat-n" id="stat-return">—</span>
          <span class="stat-l">Avg Return</span>
        </div>
        <div class="stat-box">
          <span class="stat-n" id="stat-updated">—</span>
          <span class="stat-l">Last Updated</span>
        </div>
      </div>
    </div>
  </section>

  <!-- CONTROLS -->
  <div class="controls-bar">
    <div class="controls-inner">
      <div id="cat-tabs" class="cat-tabs">
        <button class="cat-tab active" data-cat="All">All</button>
      </div>
      <div class="sort-controls">
        <span class="sort-label">Sort:</span>
        <select id="sort-select" class="sort-select">
          <option value="score">Best Score</option>
          <option value="return">Highest Return</option>
          <option value="prob">Win Probability</option>
          <option value="close">Closes Soonest</option>
        </select>
        <button class="btn-refresh" id="btn-refresh" title="Refresh">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M7 2l2-2M7 2l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Refresh
        </button>
      </div>
    </div>
  </div>

  <!-- GRID -->
  <main class="main-grid">
    <div id="opp-grid" class="opp-grid"></div>
  </main>

  <!-- FOOTER -->
  <footer>
    <div class="footer-inner">
      <p>Data sourced live from <a href="https://kalshi.com" target="_blank" rel="noopener">Kalshi</a> public API. Not financial advice. Trade responsibly.</p>
      <p class="footer-score-note">Score = probability (35) + return (25) + liquidity (20) + spread (10) + horizon (10)</p>
    </div>
  </footer>

</div>
`

// Wire up sort
document.getElementById('sort-select')?.addEventListener('change', (e) => {
  sortBy = (e.target as HTMLSelectElement).value as typeof sortBy
  updateGrid()
})

// Wire up refresh
document.getElementById('btn-refresh')?.addEventListener('click', () => {
  activeCategory = 'All'
  sortBy = 'score'
  loadOpportunities()
})

// Retry hook
window.__foretellRetry = loadOpportunities

// Kick off
loadOpportunities()

declare global {
  interface Window { __foretellRetry: () => void }
}
