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
}

document.getElementById('btnPrev').addEventListener('click', () => {
  month--
  if (month < 1) { month = 12; year-- }
  updateMonthLabel()
  loadDashboard()
})

document.getElementById('btnNext').addEventListener('click', () => {
  month++
  if (month > 12) { month = 1; year++ }
  updateMonthLabel()
  loadDashboard()
})

function renderCards(summary, comparison) {
  const cards = [
    { id: 'cardIncome',     key: 'income',     label: 'receita' },
    { id: 'cardExpense',    key: 'expense',     label: 'despesas' },
    { id: 'cardInvest',     key: 'investment',  label: 'investido' },
  ]

  cards.forEach(({ id, key }) => {
    document.getElementById(id).textContent = fmt(summary[key])

    const subEl = document.getElementById(id + 'Sub')
    const pct   = comparison[key]

    if (pct === undefined || pct === null) {
      subEl.textContent = '—'
      subEl.className   = 'card-sub'
    } else {
      const sign = pct >= 0 ? '↑' : '↓'
      subEl.textContent = `${sign} ${Math.abs(pct)}% vs mês anterior`
      subEl.className   = key === 'expense'
        ? (pct > 0 ? 'card-sub down' : 'card-sub up')
        : (pct > 0 ? 'card-sub up'   : 'card-sub down')
    }
  })

  document.getElementById('cardBalance').textContent    = fmt(summary.balance)
  document.getElementById('cardBalanceSub').textContent = 'disponível no mês'
}

function renderBarChart(history) {
  const labels  = history.map(h => h.month)
  const income  = history.map(h => parseFloat(h.income))
  const expense = history.map(h => parseFloat(h.expense))
  const invest  = history.map(h => parseFloat(h.investment))

  if (barChart) {
    barChart.data.labels          = labels
    barChart.data.datasets[0].data = income
    barChart.data.datasets[1].data = expense
    barChart.data.datasets[2].data = invest
    barChart.update()
    return
  }

  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Receita',   data: income,  backgroundColor: css('--income')  + '99', borderRadius: 5 },
        { label: 'Despesa',   data: expense, backgroundColor: css('--expense') + '99', borderRadius: 5 },
        { label: 'Investido', data: invest,  backgroundColor: css('--p6')      + '99', borderRadius: 5 },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: css('--border') }, ticks: { color: css('--muted'), font: { size: 11, family: 'DM Sans' } } },
        y: {
          grid: { color: css('--border') },
          ticks: {
            color: css('--muted'),
            font: { size: 11, family: 'DM Sans' },
            callback: v => 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        }
      }
    }
  })
}

function renderDonut(byCategory) {
  const palette = PALETTE.map(v => css(v))
  const total   = byCategory.reduce((s, c) => s + parseFloat(c.amount), 0)
  const labels  = byCategory.map(c => c.name)
  const data    = byCategory.map(c => parseFloat(c.amount))

  if (donutChart) {
    donutChart.data.labels            = labels
    donutChart.data.datasets[0].data  = data
    donutChart.data.datasets[0].backgroundColor = palette.slice(0, byCategory.length)
    donutChart.update()
  } else {
    donutChart = new Chart(document.getElementById('donutChart'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: palette.slice(0, byCategory.length),
          borderColor: css('--surface'),
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` R$ ${ctx.parsed.toLocaleString('pt-BR')} (${Math.round(ctx.parsed / total * 100)}%)`
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
        <span class="pocket-dot" style="background:${color}"></span>
        <span class="donut-legend-name">${cat.name}</span>
        <div class="donut-legend-bar-wrap">
          <div class="donut-legend-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="donut-legend-pct">${pct}%</span>
      </div>
    `
  }).join('')
}

function renderPockets(pockets) {
  const grid = document.getElementById('pocketsGrid')

  if (!pockets) {
    grid.innerHTML = `<div style="padding:1rem;font-size:0.82rem;color:var(--muted)">
      Nenhuma configuração encontrada. <a href="config.html" style="color:var(--accent)">Configurar →</a>
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

async function loadDashboard() {
  const res = await fetch(`${API}/dashboard?month=${month}&year=${year}`)
  if (!res.ok) return

  const { summary, comparison, history, byCategory, recentTransactions, pockets } = await res.json()

  renderCards(summary, comparison)
  renderBarChart(history)
  renderDonut(byCategory)
  renderPockets(pockets)
  renderTransactions(recentTransactions)
}

updateMonthLabel()
loadDashboard()
