import './style.css'

interface Opportunity {
  ticker: string
  eventTicker: string
  title: string
  subtitle: string
  noSubtitle?: string
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
  kalshiUrl: string
  searchText?: string
}

// ── CATEGORY COLOURS — Prosper & Partners palette ──
const CAT_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  Sports:        { text: '#557A72', bg: 'rgba(85,122,114,0.08)',  border: 'rgba(85,122,114,0.28)' },
  Economics:     { text: '#434371', bg: 'rgba(67,67,113,0.08)',   border: 'rgba(67,67,113,0.28)' },
  Politics:      { text: '#4B4137', bg: 'rgba(75,65,55,0.07)',    border: 'rgba(75,65,55,0.24)' },
  Weather:       { text: '#557A72', bg: 'rgba(85,122,114,0.08)',  border: 'rgba(85,122,114,0.28)' },
  Commodities:   { text: '#817A73', bg: 'rgba(129,122,115,0.07)', border: 'rgba(129,122,115,0.24)' },
  Markets:       { text: '#434371', bg: 'rgba(67,67,113,0.08)',   border: 'rgba(67,67,113,0.28)' },
  Entertainment: { text: '#5A7A1F', bg: 'rgba(90,122,31,0.08)',  border: 'rgba(90,122,31,0.28)' },
  General:       { text: '#817A73', bg: 'rgba(129,122,115,0.07)', border: 'rgba(129,122,115,0.24)' },
}
const defaultCat = { text: '#817A73', bg: 'rgba(129,122,115,0.07)', border: 'rgba(129,122,115,0.24)' }
function catStyle(cat: string) { return CAT_STYLE[cat] || defaultCat }

// ── RISK RATING 1–10 ──────────────────────────────────────────────────
function getRisk(opp: Opportunity): number {
  let risk = 5
  const ev = opp.expectedValue
  const vol = opp.volume24h
  const days = opp.daysToClose

  if (ev < 0)       risk += 3
  else if (ev < 5)  risk += 1
  else if (ev > 15) risk -= 1

  if (vol < 50)        risk += 2
  else if (vol < 200)  risk += 1
  else if (vol > 5000) risk -= 1

  if (days > 7)  risk += 1
  if (days > 14) risk += 1

  if (opp.category === 'Economics' || opp.category === 'Weather') risk -= 1
  if (opp.category === 'Politics')    risk += 1
  if (opp.category === 'Commodities') risk += 2
  if (opp.spread > 6) risk += 1

  return Math.max(1, Math.min(10, Math.round(risk)))
}
function riskLabel(r: number): string {
  if (r <= 2) return 'Very Low'
  if (r <= 4) return 'Low'
  if (r <= 6) return 'Medium'
  if (r <= 8) return 'High'
  return 'Very High'
}
function riskColor(r: number): string {
  if (r <= 2) return '#5A7A1F'
  if (r <= 4) return '#7A9C20'
  if (r <= 6) return '#C8861A'
  if (r <= 8) return '#B84C14'
  return '#8C1C08'
}
function renderRisk(opp: Opportunity): string {
  const r = getRisk(opp)
  const col = riskColor(r)
  const lbl = riskLabel(r)
  const dots = Array.from({ length: 10 }, (_, i) =>
    `<span class="risk-dot${i < r ? ' risk-dot--on' : ''}" style="${i < r ? `background:${col}` : ''}"></span>`
  ).join('')
  return `<div class="risk-row">
    <span class="risk-label-text">Risk</span>
    <span class="risk-score" style="color:${col};">${r}/10 · ${lbl}</span>
    <div class="risk-dots">${dots}</div>
  </div>`
}

// ── BET INSTRUCTION ────────────────────────────────────────────────────
// Builds a consistent two-line action block:
//   Line 1 (why): plain sentence from Foretell
//   Line 2 (how): exact click instruction
//
// Source data from opportunities.js:
//   subtitle    = yes_sub_title  e.g. "67° to 68°", "Memphis", "Above 2.5%"
//   noSubtitle  = no_sub_title   e.g. "NOT: Memphis" or derived
//   side        = 'YES' | 'NO'
//   title       = full Kalshi question title
//   category    = Weather / Sports / Economics / Commodities / ...

function buildBetInstruction(opp: Opportunity): { why: string; how: string; howColor: 'yes' | 'no' } {
  const title    = opp.title || ''
  const sub      = (opp.subtitle || '').replace(/^NOT:\s*/i, '').trim()
  const noSub    = (opp.noSubtitle || '').replace(/^NOT:\s*/i, '').trim()
  const side     = opp.side
  const cat      = opp.category

  // ── Extract city from [City] prefix ──
  const cityMatch = title.match(/^\[([^\]]+)\]/)
  const city = cityMatch ? cityMatch[1] : null

  // ── What is the winning outcome for this side? ──
  // For YES bets: winning outcome = subtitle
  // For NO bets:  winning outcome = noSubtitle (what you're actually backing)
  const winOutcome = side === 'YES' ? sub : noSub

  // ── WEATHER BAND bets ──
  if (cat === 'Weather') {
    const isTempBand = /\d+°?\s*(to|-|–)\s*\d+°/.test(sub) || /\d+°?\s*(to|-|–)\s*\d+°/.test(title)
    const isAbove    = /above|or above|or higher/i.test(sub + title)
    const isBelow    = /below|or below|or lower/i.test(sub + title)
    const stat       = /minimum|low/i.test(title) ? 'low' : 'high'
    const cityStr    = city ? ` in ${city}` : ''

    if (side === 'YES' && (isTempBand || sub)) {
      return {
        why: `Foretell expects the ${stat}${cityStr} to land in this range.`,
        how: `Bet on the ${sub || winOutcome} band — click YES`,
        howColor: 'yes',
      }
    }
    if (side === 'YES' && isAbove) {
      return {
        why: `Foretell expects the ${stat}${cityStr} to be at or above this threshold.`,
        how: `Bet on "${sub}" — click YES`,
        howColor: 'yes',
      }
    }
    if (side === 'YES' && isBelow) {
      return {
        why: `Foretell expects the ${stat}${cityStr} to stay at or below this threshold.`,
        how: `Bet on "${sub}" — click YES`,
        howColor: 'yes',
      }
    }
    if (side === 'NO' && noSub) {
      return {
        why: `Foretell expects the ${stat}${cityStr} to land in this range.`,
        how: `Bet on the ${noSub} band — click YES on that row`,
        howColor: 'yes',
      }
    }
    // NO side, band — the NO means "NOT the subtitle band"
    return {
      why: `Foretell expects the ${stat}${cityStr} NOT to land in "${sub}".`,
      how: `Click NO on the "${sub}" row`,
      howColor: 'no',
    }
  }

  // ── SPORTS / WINNER bets ──
  if (cat === 'Sports') {
    const isWinner = /winner|wins|win the/i.test(title)
    const isSpread = /spread|by over|by at least/i.test(title)
    const isTotal  = /total|points|over|under/i.test(title)

    if (isWinner) {
      if (side === 'YES') {
        // YES = backing the subtitle team/player
        return {
          why: `Foretell expects ${sub || 'this team'} to win.`,
          how: `Back ${sub || 'YES outcome'} — click YES`,
          howColor: 'yes',
        }
      } else {
        // NO on winner = backing noSubtitle (the other team)
        const backing = noSub || sub
        return {
          why: `Foretell expects ${backing} to win.`,
          how: `Back ${backing} — click NO  (NO = ${backing} wins)`,
          howColor: 'no',
        }
      }
    }

    if (isSpread || isTotal) {
      // Spread/total bets — side directly meaningful
      const outcome = side === 'YES' ? (sub || 'YES') : (noSub || 'NO')
      const verb = isSpread ? 'cover the spread' : (sub.toLowerCase().includes('over') ? 'go over' : 'stay under')
      return {
        why: `Foretell expects ${verb}: ${outcome}.`,
        how: `Click ${side} — profit if: ${outcome}`,
        howColor: side === 'YES' ? 'yes' : 'no',
      }
    }

    // Generic sports
    const outcome = side === 'YES' ? sub : noSub
    return {
      why: `Foretell recommends the ${side} side.`,
      how: `Click ${side} — profit if: ${outcome || side}`,
      howColor: side === 'YES' ? 'yes' : 'no',
    }
  }

  // ── ECONOMICS bets ──
  if (cat === 'Economics') {
    const outcome = side === 'YES' ? sub : noSub
    return {
      why: `Foretell expects this reading to come in at: ${outcome || sub}.`,
      how: `Bet on "${outcome || sub}" — click ${side}`,
      howColor: side === 'YES' ? 'yes' : 'no',
    }
  }

  // ── COMMODITIES / MARKETS bets ──
  if (cat === 'Commodities' || cat === 'Markets') {
    const outcome = side === 'YES' ? sub : noSub
    const isAbove = /above|or above|or higher/i.test(outcome + title)
    const isBelow = /below|or below|or lower/i.test(outcome + title)
    const dir = isAbove ? 'at or above' : isBelow ? 'at or below' : 'at'
    return {
      why: `Foretell expects the price to be ${dir}: ${outcome || sub}.`,
      how: `Bet on "${outcome || sub}" — click ${side}`,
      howColor: side === 'YES' ? 'yes' : 'no',
    }
  }

  // ── GENERAL fallback ──
  const outcome = side === 'YES' ? sub : noSub
  return {
    why: `Foretell recommends the ${side} side on this market.`,
    how: `Click ${side} — profit if: ${outcome || side}`,
    howColor: side === 'YES' ? 'yes' : 'no',
  }
}

// ── PLAIN TITLE (strip Kalshi question framing) ──────────────────────
function plainTitle(opp: Opportunity): string {
  const t = opp.title || opp.ticker
  const cityMatch = t.match(/^\[([^\]]+)\]/)
  const city = cityMatch ? cityMatch[1] : null

  // Weather: "Max temperature · Miami · Mar 10, 2026"
  if (city) {
    const stat = /maximum|max/i.test(t) ? 'Max temperature'
               : /minimum|min/i.test(t)  ? 'Min temperature'
               : /high temp/i.test(t)    ? 'High temperature'
               : /low temp/i.test(t)     ? 'Low temperature'
               : /snow/i.test(t)         ? 'Snowfall'
               : /rain/i.test(t)         ? 'Rainfall'
               : 'Temperature'
    const dateMatch = t.match(/(\w{3}\s+\d{1,2}(?:,?\s*\d{4})?)/)
    const date = dateMatch ? dateMatch[0] : ''
    return `${stat} · ${city}${date ? ' · ' + date : ''}`
  }
  return t
}

// ── SCORE BAR ────────────────────────────────────────────────────────
// The score is Foretell's composite edge score (max ~90).
// Higher = stronger opportunity. Shown as a thin bar + number.
function scoreBar(score: number): string {
  const pct = Math.min(100, (score / 90) * 100)
  const barColor = pct > 68 ? 'var(--lime)' : pct > 42 ? 'var(--teal)' : 'var(--warm-mid)'
  const textColor = pct > 68 ? 'var(--pos)' : pct > 42 ? 'var(--teal-dark)' : 'var(--warm-mid)'
  return `<div class="score-row">
    <span class="score-label">Foretell score</span>
    <div class="score-bar-track"><div class="score-bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
    <span class="score-val" style="color:${textColor};">${score.toFixed(1)}<span class="score-max">/90</span></span>
  </div>
  <div class="score-legend">Higher = stronger edge · EV + price band + liquidity + spread + horizon</div>`
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
  const volDisplay = opp.volume24h >= 1000000 ? (opp.volume24h / 1000000).toFixed(1) + 'M'
                   : opp.volume24h >= 1000    ? (opp.volume24h / 1000).toFixed(0) + 'k'
                   : opp.volume24h.toString()

  const { why, how, howColor } = buildBetInstruction(opp)
  const title = plainTitle(opp)
  const searchStr = opp.searchText || opp.title

  // City badge for weather cards
  const cityMatch = opp.title.match(/^\[([^\]]+)\]/)
  const cityBadge = cityMatch ? `<span class="card-city">📍 ${cityMatch[1]}</span>` : ''

  return `
  <div class="opp-card" data-id="${opp.ticker}">
    <div class="card-rank">${rank}</div>
    <div class="card-body">

      <!-- Header row: category · side · city · conf · closes -->
      <div class="card-header">
        <span class="card-cat" style="color:${cs.text};border-color:${cs.border};background:${cs.bg};">${opp.category}</span>
        <span class="card-side ${opp.side === 'YES' ? 'side-yes' : 'side-no'}">${opp.side}</span>
        ${cityBadge}
        ${isHighConf ? '<span class="card-badge">High Conf</span>' : ''}
        <span class="card-close">${formatClose(opp.daysToClose)}</span>
      </div>

      <!-- Plain-English title -->
      <h3 class="card-title">${title}</h3>

      <!-- ★ BET INSTRUCTION — the most important element ── -->
      <div class="bet-box">
        <p class="bet-why">${why}</p>
        <div class="bet-how bet-how--${howColor}">
          <span class="bet-arrow">→</span>
          <span class="bet-how-text">${how}</span>
        </div>
      </div>

      <!-- Stats row -->
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

      <!-- Risk rating -->
      ${renderRisk(opp)}

      <!-- Rationale + score bar -->
      <div class="card-footer">
        <p class="card-rationale">${opp.rationale}</p>
        ${scoreBar(opp.edgeScore)}
      </div>

    </div><!-- /card-body -->

    <!-- Actions footer — belongs to THIS card, separated visually -->
    <div class="card-actions">

      <!-- Primary: direct link to exact Kalshi market page -->
      <a class="card-kalshi-link" href="${opp.kalshiUrl}" target="_blank" rel="noopener">
        Open on Kalshi
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 9L9 2M9 2H4M9 2V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>

      <!-- Secondary: copy search string as fallback -->
      <button class="card-copy-btn" data-copy="${searchStr}" title="Copy search term to find on Kalshi">
        <span class="copy-label-short">Copy search</span>
        <svg class="copy-icon" width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="4" y="4" width="8" height="8" rx="1.2" stroke="currentColor" stroke-width="1.3"/>
          <path d="M1 9V2a1 1 0 0 1 1-1h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <span class="copy-confirm">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6.5l3 3L10 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Copied!
        </span>
      </button>

      <button class="card-placed-btn" data-ticker="${opp.ticker}">
        <span class="placed-checkbox"></span>
        <span class="placed-label">Mark placed</span>
        <span class="placed-confirm">Placed ✓</span>
      </button>
    </div>

  </div>`
}

function renderSkeleton(): string {
  return Array.from({ length: 6 }, (_, i) => `
    <div class="opp-card" style="opacity:${1 - i * 0.12}">
      <div class="card-body">
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <div class="sk-line" style="width:70px;height:20px;"></div>
          <div class="sk-line" style="width:40px;height:20px;"></div>
        </div>
        <div class="sk-line" style="width:88%;height:18px;margin-bottom:8px;"></div>
        <div class="sk-line" style="width:65%;height:14px;margin-bottom:20px;"></div>
        <div style="display:flex;gap:1px;">
          ${Array.from({ length: 5 }, () => '<div class="sk-line" style="flex:1;height:38px;"></div>').join('')}
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

// ── STATE ────────────────────────────────────────────────────────────
let allOpps: Opportunity[] = []
let activeCategory = 'All'
let sortBy: 'score' | 'return' | 'prob' | 'close' = 'score'
const placedSet = new Set<string>()

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
  placedSet.forEach(ticker => {
    const card = grid.querySelector(`[data-id="${ticker}"]`)
    if (card) card.classList.add('is-placed')
  })
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

function updateStats(opps: Opportunity[]) {
  const avgProb   = opps.length ? opps.reduce((s, o) => s + o.impliedProb, 0) / opps.length : 0
  const avgReturn = opps.length ? opps.reduce((s, o) => s + o.potentialReturn, 0) / opps.length : 0
  const set = (id: string, v: string) => { const e = document.getElementById(id); if (e) e.textContent = v }
  set('stat-count',   opps.length.toString())
  set('stat-prob',    `${Math.round(avgProb * 100)}%`)
  set('stat-return',  `${avgReturn.toFixed(1)}%`)
  set('stat-updated', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
}

// ── EVENT DELEGATION ─────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const target = e.target as Element

  const copyBtn = target.closest('.card-copy-btn') as HTMLElement | null
  if (copyBtn) {
    const text = copyBtn.dataset.copy || ''
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.classList.add('copied')
      setTimeout(() => copyBtn.classList.remove('copied'), 2000)
    })
    return
  }

  const placedBtn = target.closest('.card-placed-btn') as HTMLElement | null
  if (placedBtn) {
    const ticker = placedBtn.dataset.ticker || ''
    const card = placedBtn.closest('.opp-card') as HTMLElement | null
    if (!card) return
    if (placedSet.has(ticker)) {
      placedSet.delete(ticker)
      card.classList.remove('is-placed')
    } else {
      placedSet.add(ticker)
      card.classList.add('is-placed')
    }
  }
})

// ── LOAD ─────────────────────────────────────────────────────────────
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

    updateStats(opps)
    updateCategoryTabs(opps)
    updateGrid()

    if (status) status.textContent = `${data.scanned || 0} scanned · ${opps.length} found`
  } catch (err: any) {
    grid.innerHTML = renderError(err?.message || 'Unknown error')
    if (status) status.textContent = 'Load failed'
  }
}

// ── SHELL ─────────────────────────────────────────────────────────────
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
        <p>
          <strong>YES pill</strong> = buy YES on Kalshi &nbsp;·&nbsp; <strong>NO pill</strong> = buy NO on Kalshi<br>
          On winner markets: clicking NO means you're backing the named team/player<br>
          <strong>Open on Kalshi →</strong> goes directly to the exact market page<br>
          <strong>Foretell score</strong> = composite edge 0–90 (EV + price band + liquidity + spread + horizon)<br>
          <strong>Risk 1–10</strong> = 1 very safe · 10 very risky
        </p>
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
