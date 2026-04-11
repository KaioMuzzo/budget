const API = 'http://localhost:3333/api'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const PALETTE = ['--p3','--p2','--p4','--p1','--p5','--p6']

let month = new Date().getMonth() + 1
let year  = new Date().getFullYear()

let barChart   = null
let donutChart = null

function css(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim()
}

function fmt(val) {
  return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function updateMonthLabel() {
  document.getElementById('monthLabel').textContent = `${MONTHS[month - 1]} ${year}`
  document.getElementById('heroSub').textContent = 'carregando...'
  document.getElementById('heroAmount').textContent = '—'
  document.getElementById('heroCents').textContent = ''
}

document.getElementById('btnPrev').addEventListener('click', () => {
  if (--month < 1) { month = 12; year-- }
  updateMonthLabel()
  loadDashboard()
})

document.getElementById('btnNext').addEventListener('click', () => {
  if (++month > 12) { month = 1; year++ }
  updateMonthLabel()
  loadDashboard()
})

function renderHero(summary, txCount) {
  const balance = parseFloat(summary.balance)
  const abs     = Math.abs(balance)
  const [intPart, decPart] = abs.toFixed(2).split('.')
  document.getElementById('heroAmount').textContent = parseFloat(intPart).toLocaleString('pt-BR')
  document.getElementById('heroCents').textContent  = `,${decPart}`
  document.getElementById('heroSub').innerHTML =
    `<strong>${txCount}</strong> lançamento${txCount !== 1 ? 's' : ''} · receitas <strong>${fmt(summary.income)}</strong> · despesas <strong>${fmt(summary.expense)}</strong>`
}

function renderStats(summary, comparison) {
  const items = [
    { id: 'cardIncome',  key: 'income',     subId: 'cardIncomeSub'  },
    { id: 'cardExpense', key: 'expense',     subId: 'cardExpenseSub' },
    { id: 'cardInvest',  key: 'investment',  subId: 'cardInvestSub'  },
  ]

  items.forEach(({ id, key, subId }) => {
    document.getElementById(id).textContent = fmt(summary[key])
    const subEl = document.getElementById(subId)
    const pct   = comparison[key]

    if (pct == null) {
      subEl.textContent = '—'
      subEl.className   = 'stat-sub'
    } else {
      const sign = pct >= 0 ? '↑' : '↓'
      subEl.textContent = `${sign} ${Math.abs(pct)}% vs mês anterior`
      subEl.className = key === 'expense'
        ? `stat-sub ${pct > 0 ? 'down' : 'up'}`
        : `stat-sub ${pct > 0 ? 'up' : 'down'}`
    }
  })

  document.getElementById('cardBalance').textContent    = fmt(summary.balance)
  document.getElementById('cardBalanceSub').textContent = 'disponível no mês'
}

// ── BAR CHART ─────────────────────────────────────────────────
function makeGradient(ctx, colorHex, alpha1 = 0.55, alpha2 = 0.15) {
  const gr = ctx.createLinearGradient(0, 0, 0, ctx.canvas.offsetHeight || 200)
  gr.addColorStop(0, colorHex + hex(alpha1))
  gr.addColorStop(1, colorHex + hex(alpha2))
  return gr
}

function hex(alpha) {
  return Math.round(alpha * 255).toString(16).padStart(2, '0')
}

function renderBarChart(history) {
  const labels  = history.map(h => h.month)
  const income  = history.map(h => parseFloat(h.income))
  const expense = history.map(h => parseFloat(h.expense))
  const invest  = history.map(h => parseFloat(h.investment))

  const incomeColor  = css('--income').trim()
  const expenseColor = css('--expense').trim()
  const investColor  = '#fbbf24'
  const borderColor  = css('--border').trim()
  const mutedColor   = css('--muted').trim()

  if (barChart) {
    barChart.data.labels = labels
    barChart.data.datasets[0].data = income
    barChart.data.datasets[1].data = expense
    barChart.data.datasets[2].data = invest
    barChart.update({ duration: 600, easing: 'easeInOutQuart' })
    return
  }

  const canvasEl = document.getElementById('barChart')
  const ctx      = canvasEl.getContext('2d')

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Receita',
          data: income,
          backgroundColor: incomeColor + 'aa',
          hoverBackgroundColor: incomeColor,
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: 'Despesa',
          data: expense,
          backgroundColor: expenseColor + 'aa',
          hoverBackgroundColor: expenseColor,
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: 'Investido',
          data: invest,
          backgroundColor: investColor + 'aa',
          hoverBackgroundColor: investColor,
          borderRadius: 5,
          borderSkipped: false,
        },
      ]
    },
    options: {
      responsive: true,
      animation: { duration: 700, easing: 'easeInOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1f',
          borderColor: borderColor,
          borderWidth: 1,
          titleColor: '#ffffff',
          bodyColor: mutedColor,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: mutedColor, font: { size: 11, family: 'DM Sans' } }
        },
        y: {
          grid: { color: borderColor + '66', drawBorder: false },
          border: { display: false },
          ticks: {
            color: mutedColor,
            font: { size: 11, family: 'DM Sans' },
            callback: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
          }
        }
      }
    }
  })
}

// ── DONUT CHART ────────────────────────────────────────────────
function renderDonut(byCategory) {
  const palette = PALETTE.map(v => css(v))
  const total   = byCategory.reduce((s, c) => s + parseFloat(c.amount), 0)
  const labels  = byCategory.map(c => c.name)
  const data    = byCategory.map(c => parseFloat(c.amount))
  const colors  = palette.slice(0, byCategory.length)
  const borderColor = css('--surface').trim()
  const mutedColor  = css('--muted').trim()

  if (donutChart) {
    donutChart.data.labels = labels
    donutChart.data.datasets[0].data = data
    donutChart.data.datasets[0].backgroundColor = colors
    donutChart.update({ duration: 600, easing: 'easeInOutQuart' })
  } else {
    donutChart = new Chart(document.getElementById('donutChart'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor,
          borderWidth: 3,
          hoverOffset: 8,
          hoverBorderWidth: 3,
        }]
      },
      options: {
        cutout: '70%',
        animation: { animateRotate: true, animateScale: false, duration: 700, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a1f',
            borderColor: css('--border').trim(),
            borderWidth: 1,
            titleColor: '#ffffff',
            bodyColor: mutedColor,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: ctx => ` ${fmt(ctx.parsed)} (${Math.round(ctx.parsed / total * 100)}%)`
            }
          }
        }
      }
    })
  }

  const legend = document.getElementById('donutLegend')
  legend.innerHTML = byCategory.map((cat, i) => {
    const pct   = total > 0 ? Math.round(parseFloat(cat.amount) / total * 100) : 0
    const color = palette[i]
    return `
      <div class="donut-legend-item">
        <span class="legend-pip" style="background:${color}"></span>
        <span class="donut-legend-name">${cat.name}</span>
        <div class="donut-legend-bar-wrap">
          <div class="donut-legend-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="donut-legend-pct">${pct}%</span>
      </div>
    `
  }).join('')
}

// ── POCKETS ────────────────────────────────────────────────────
function renderPockets(pockets) {
  const grid = document.getElementById('pocketsGrid')

  if (!pockets) {
    grid.innerHTML = `<div style="padding:1rem;font-size:0.82rem;color:var(--muted)">
      Nenhuma configuração. <a href="config.html" style="color:var(--accent)">Configurar →</a>
    </div>`
    return
  }

  const colors = PALETTE.map(v => css(v))
  grid.innerHTML = Object.entries(pockets).map(([name, p], i) => `
    <div class="pocket-row">
      <span class="pocket-dot" style="background:${colors[i]}"></span>
      <span class="pocket-name">${name}</span>
      <div class="pocket-bar-track">
        <div class="pocket-bar-fill" style="width:${p.percent}%;background:${colors[i]}"></div>
      </div>
      <span class="pocket-pct">${p.percent}%</span>
      <span class="pocket-amount" style="color:${colors[i]}">${fmt(p.amount)}</span>
    </div>
  `).join('')
}

// ── TRANSACTIONS ───────────────────────────────────────────────
function renderTransactions(transactions) {
  const body = document.getElementById('txBody')

  if (!transactions.length) {
    body.innerHTML = `<tr><td colspan="5" style="padding:1.5rem 0;color:var(--muted);font-size:0.82rem">Nenhum lançamento neste mês.</td></tr>`
    return
  }

  body.innerHTML = transactions.map(t => {
    const sign  = t.type === 'INCOME' ? '+' : '−'
    const cls   = t.type === 'INCOME' ? 'income' : t.type === 'INVESTMENT' ? 'invest' : 'expense'
    const label = t.type === 'INCOME' ? 'Receita' : t.type === 'INVESTMENT' ? 'Investimento' : 'Despesa'
    const date  = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return `
      <tr>
        <td><div class="tx-desc">${t.description}</div></td>
        <td class="tx-cat">${t.category ?? '—'}</td>
        <td><span class="badge ${cls}">${label}</span></td>
        <td class="tx-amount ${cls}">${sign}${fmt(t.amount)}</td>
        <td class="tx-date">${date}</td>
      </tr>
    `
  }).join('')
}

// ── LOAD ───────────────────────────────────────────────────────
async function loadDashboard() {
  const res = await fetch(`${API}/dashboard?month=${month}&year=${year}`)
  if (!res.ok) return

  const { summary, comparison, history, byCategory, recentTransactions, pockets } = await res.json()

  renderHero(summary, recentTransactions.length)
  renderStats(summary, comparison)
  renderBarChart(history)
  renderDonut(byCategory)
  renderPockets(pockets)
  renderTransactions(recentTransactions)
}

updateMonthLabel()
loadDashboard()
