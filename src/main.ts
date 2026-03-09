import './style.css'

interface Opportunity {
  ticker: string
  eventTicker: string
  title: string
  subtitle: string
  side: 'YES' | 'NO'
  entryPrice: number
  potentialReturn: number
  impliedProb: number
  expectedValue: number
  edgeScore: number
  spread: number
  daysToClose: number
  volume24h: number
  category: string
  rationale: string
  closeTime: string
}

// ── CATEGORY COLOURS — Prosper & Partners palette ──
const CAT_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  Sports:      { text: '#557A72', bg: 'rgba(85,122,114,0.08)',  border: 'rgba(85,122,114,0.28)' },
  Economics:   { text: '#434371', bg: 'rgba(67,67,113,0.08)',   border: 'rgba(67,67,113,0.28)' },
  Politics:    { text: '#4B4137', bg: 'rgba(75,65,55,0.07)',    border: 'rgba(75,65,55,0.24)' },
  Weather:     { text: '#557A72', bg: 'rgba(85,122,114,0.08)',  border: 'rgba(85,122,114,0.28)' },
  Commodities: { text: '#817A73', bg: 'rgba(129,122,115,0.07)', border: 'rgba(129,122,115,0.24)' },
  Markets:     { text: '#434371', bg: 'rgba(67,67,113,0.08)',   border: 'rgba(67,67,113,0.28)' },
  Entertainment:{ text: '#5A7A1F', bg: 'rgba(90,122,31,0.08)', border: 'rgba(90,122,31,0.28)' },
  General:     { text: '#817A73', bg: 'rgba(129,122,115,0.07)', border: 'rgba(129,122,115,0.24)' },
}
const defaultCat = { text: '#817A73', bg: 'rgba(129,122,115,0.07)', border: 'rgba(129,122,115,0.24)' }

function catStyle(cat: string) { return CAT_STYLE[cat] || defaultCat }

function scoreBar(score: number): string {
  const pct = Math.min(100, (score / 90) * 100)
  const color = pct > 68 ? 'var(--lime)' : pct > 42 ? 'var(--teal)' : 'var(--warm-mid)'
  const textColor = pct > 68 ? 'var(--pos)' : pct > 42 ? 'var(--teal-dark)' : 'var(--warm-mid)'
  return `<div class="score-bar-wrap">
    <div class="score-bar-track"><div class="score-bar-fill" style="width:${pct}%;background:${color};"></div></div>
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

function renderCard(opp: Opportunity, rank: number): string {
  const cs = catStyle(opp.category)
  const winProb = Math.round(opp.impliedProb * 100)
  const evColor = opp.expectedValue > 0 ? 'var(--pos)' : 'var(--neg)'
  const evDisplay = (opp.expectedValue > 0 ? '+' : '') + opp.expectedValue.toFixed(1) + '¢'
  const entryDollars = (opp.entryPrice / 100).toFixed(2)
  const isHighConf = winProb >= 80
  // Full event ticker = all segments except last outcome suffix (e.g. KXNBAGAME-26MAR08CHISAC not KXNBAGAME)
  const tickerParts = (opp.eventTicker || opp.ticker || '').split('-')
  const eventSlug = (opp.eventTicker
    ? opp.eventTicker                                    // use event_ticker directly if available
    : tickerParts.slice(0, -1).join('-')                 // else strip last segment
  ).toLowerCase()
  const kalshiUrl = `https://kalshi.com/markets/${eventSlug}`
  const volDisplay = opp.volume24h >= 1000000 ? (opp.volume24h/1000000).toFixed(1)+'M'
                   : opp.volume24h >= 1000 ? (opp.volume24h/1000).toFixed(0)+'k'
                   : opp.volume24h.toString()

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
      <h3 class="card-title">${opp.title}</h3>
      ${opp.subtitle ? `<p class="card-subtitle">${opp.subtitle}</p>` : ''}
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
          <span class="metric-value return-val">+${opp.potentialReturn.toFixed(1)}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Exp. Value</span>
          <span class="metric-value" style="color:${evColor};">${evDisplay}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Vol 24h</span>
          <span class="metric-value">${volDisplay}</span>
        </div>
      </div>
      <div class="card-footer">
        <p class="card-rationale">${opp.rationale}</p>
        ${scoreBar(opp.edgeScore)}
      </div>
    </div>
    <div class="card-actions">
      <a class="card-link-primary" href="${kalshiUrl}" target="_blank" rel="noopener">
        Trade on Kalshi <span class="card-link-arrow">→</span>
      </a>
      <button class="card-copy-btn" data-ticker="${opp.ticker}" title="Copy ticker to search on Kalshi">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/>
          <path d="M1 9V2a1 1 0 0 1 1-1h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
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
  return `<div class="error-state">
    <div class="error-icon">◌</div>
    <h3>Failed to load markets</h3>
    <p>${msg}</p>
    <button class="btn-retry" onclick="window.__foretellRetry()">Try again</button>
  </div>`
}

function renderEmpty(): string {
  return `<div class="error-state">
    <div class="error-icon">◌</div>
    <h3>No opportunities found</h3>
    <p>No markets in scoring range right now. Check back soon or hit refresh.</p>
  </div>`
}

// ── STATE ──────────────────────────────────────────────────────────────
let allOpps: Opportunity[] = []
let activeCategory = 'All'
let sortBy: 'score' | 'return' | 'prob' | 'close' = 'score'

function getFiltered(): Opportunity[] {
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

function updateCategoryTabs(opps: Opportunity[]) {
  const counts: Record<string, number> = { All: opps.length }
  for (const o of opps) counts[o.category] = (counts[o.category] || 0) + 1
  const tabs = document.getElementById('cat-tabs')
  if (!tabs) return
  tabs.innerHTML = Object.entries(counts).map(([cat, n]) => `
    <button class="cat-tab ${cat === activeCategory ? 'active' : ''}" data-cat="${cat}">
      ${cat} <span class="cat-count">${n}</span>
    </button>`).join('')
  tabs.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = (btn as HTMLElement).dataset.cat || 'All'
      tabs.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      updateGrid()
    })
  })
}

function updateStats(opps: Opportunity[], scanned: number) {
  const avgProb   = opps.length ? opps.reduce((s, o) => s + o.impliedProb, 0) / opps.length : 0
  const avgReturn = opps.length ? opps.reduce((s, o) => s + o.potentialReturn, 0) / opps.length : 0
  const set = (id: string, v: string) => { const e = document.getElementById(id); if (e) e.textContent = v }
  set('stat-count', opps.length.toString())
  set('stat-prob', `${Math.round(avgProb * 100)}%`)
  set('stat-return', `${avgReturn.toFixed(1)}%`)
  set('stat-updated', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
}

// ── COPY TICKER HANDLER (delegated) ──────────────────────────────────
document.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest('.card-copy-btn') as HTMLElement | null
  if (!btn) return
  const ticker = btn.dataset.ticker || ''
  navigator.clipboard.writeText(ticker).then(() => {
    btn.classList.add('copied')
    btn.title = 'Copied!'
    setTimeout(() => { btn.classList.remove('copied'); btn.title = 'Copy ticker to search on Kalshi' }, 1800)
  })
})

// ── LOAD ───────────────────────────────────────────────────────────────
async function loadOpportunities() {
  const grid = document.getElementById('opp-grid')
  if (!grid) return
  grid.innerHTML = renderSkeleton()
  const status = document.getElementById('load-status')
  if (status) status.textContent = 'Scanning markets…'

  try {
    const res = await fetch('/api/opportunities')
    if (!res.ok) throw new Error(`Server error: ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    const opps: Opportunity[] = data.opportunities || []
    allOpps = opps

    updateStats(opps, data.scanned || 0)
    updateCategoryTabs(opps)
    updateGrid()

    if (status) status.textContent = `${data.scanned || 0} scanned · ${opps.length} found`
  } catch (err: any) {
    grid.innerHTML = renderError(err?.message || 'Unknown error')
    if (status) status.textContent = 'Load failed'
  }
}

// ── SHELL ──────────────────────────────────────────────────────────────
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
        <div class="stat-cell"><span class="stat-val" id="stat-count">—</span><span class="stat-key">Opportunities</span></div>
        <div class="stat-cell"><span class="stat-val" id="stat-prob">—</span><span class="stat-key">Avg win prob</span></div>
        <div class="stat-cell"><span class="stat-val" id="stat-return">—</span><span class="stat-key">Avg return</span></div>
        <div class="stat-cell"><span class="stat-val" id="stat-updated">—</span><span class="stat-key">Last updated</span></div>
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
        <p>Data sourced from the <a href="https://kalshi.com" target="_blank" rel="noopener">Kalshi</a> public API. Not financial advice.</p>
      </div>
      <div class="footer-right">
        <p>Score = EV (40) + price band (25)<br>+ liquidity (20) + spread (10) + horizon (5)</p>
      </div>
    </div>
  </footer>
</div>`

document.getElementById('sort-select')?.addEventListener('change', e => {
  sortBy = (e.target as HTMLSelectElement).value as typeof sortBy
  updateGrid()
})
document.getElementById('btn-refresh')?.addEventListener('click', () => {
  activeCategory = 'All'; sortBy = 'score'; loadOpportunities()
})
window.__foretellRetry = loadOpportunities
loadOpportunities()

declare global { interface Window { __foretellRetry: () => void } }
