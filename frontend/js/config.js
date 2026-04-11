const API = 'http://localhost:3333/api'

const POCKETS = [
  { name: 'Liberdade Financeira', color: 'var(--p1)', hex: '#a8ff3e' },
  { name: 'Custos Fixos',         color: 'var(--p2)', hex: '#38bdf8' },
  { name: 'Conforto',             color: 'var(--p3)', hex: '#f472b6' },
  { name: 'Metas',                color: 'var(--p4)', hex: '#fb923c' },
  { name: 'Prazeres',             color: 'var(--p5)', hex: '#a78bfa' },
  { name: 'Conhecimento',         color: 'var(--p6)', hex: '#fbbf24' },
]

const COLORS = POCKETS.map(p => p.hex)
const DEFAULT_PCTS = [25, 30, 15, 15, 10, 5]

let pcts = [...DEFAULT_PCTS]
let salary = 0
let initialBalance = null
let donutChart = null

// --- BUILD SLIDER CARDS ---
const slidersEl = document.getElementById('sliders')
const legendEl  = document.getElementById('legend')

POCKETS.forEach((p, i) => {
  const card = document.createElement('div')
  card.className = 'slider-card'
  card.innerHTML = `
    <div class="slider-stripe" style="background:${p.hex}"></div>
    <div class="slider-body">
      <div class="slider-header">
        <span class="slider-name" style="color:${p.hex}">${p.name}</span>
        <span class="slider-pct" id="pct-${i}">0%</span>
      </div>
      <span class="slider-amount" style="color:${p.hex}" id="amt-${i}">R$ 0,00</span>
      <input type="range" min="0" max="100" value="0"
             id="range-${i}"
             style="background: linear-gradient(to right, ${p.hex} 0%, ${p.hex} 0%, var(--border) 0%)" />
    </div>
  `
  slidersEl.appendChild(card)

  const li = document.createElement('div')
  li.className = 'legend-item'
  li.innerHTML = `
    <span class="legend-pip" style="background:${p.hex}"></span>
    <span class="legend-name">${p.name}</span>
    <span class="legend-pct" id="leg-${i}">0%</span>
  `
  legendEl.appendChild(li)
})

// --- CHART.JS DONUT ---
function initDonut() {
  const canvas = document.getElementById('donut')
  donutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [...pcts],
        backgroundColor: COLORS,
        borderWidth: 0,
        borderRadius: 0,
        spacing: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      animation: { duration: 300, easing: 'easeInOutQuart' },
    }
  })
}

function updateDonut(values) {
  const sum = values.reduce((a,b) => a+b, 0)
  const el = document.getElementById('donutTotal')
  el.textContent = sum + '%'
  el.className = 'donut-inner-n' + (sum > 100 ? ' over' : sum === 100 ? ' ok' : '')

  if (donutChart) {
    donutChart.data.datasets[0].data = [...values]
    donutChart.update('none')
  }
}

// --- FORMAT ---
function fmt(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// --- UPDATE ---
function update() {
  const sum = pcts.reduce((a,b) => a+b, 0)

  const bar    = document.getElementById('sumBar')
  const sumVal = document.getElementById('sumVal')
  bar.style.width      = Math.min(sum, 100) + '%'
  bar.style.background = sum > 100 ? 'var(--danger)' : sum === 100 ? 'var(--accent)' : 'var(--accent-dim)'
  sumVal.textContent   = sum + '%'
  sumVal.className     = 'sum-value' + (sum > 100 ? ' over' : sum === 100 ? ' ok' : '')

  POCKETS.forEach((p, i) => {
    const v     = pcts[i]
    const range = document.getElementById(`range-${i}`)
    const pct   = document.getElementById(`pct-${i}`)
    const amt   = document.getElementById(`amt-${i}`)
    const leg   = document.getElementById(`leg-${i}`)

    range.value = v
    range.style.background = `linear-gradient(to right, ${p.hex} ${v}%, var(--border) ${v}%)`
    pct.textContent = v + '%'
    amt.textContent = fmt(salary * v / 100)
    leg.textContent = v + '%'
  })

  updateDonut(pcts)
}

// --- EVENTS ---
POCKETS.forEach((_, i) => {
  document.getElementById(`range-${i}`).addEventListener('input', e => {
    const newVal      = parseInt(e.target.value)
    const somaOutros  = pcts.reduce((acc, v, idx) => idx === i ? acc : acc + v, 0)
    const maximo      = 100 - somaOutros
    pcts[i]           = Math.min(newVal, maximo)
    update()
  })
})

document.getElementById('salary').addEventListener('input', e => {
  salary = parseFloat(e.target.value) || 0
  update()
})

document.getElementById('initialBalance').addEventListener('input', e => {
  const v = parseFloat(e.target.value)
  initialBalance = isNaN(v) ? null : v
})

document.getElementById('btnReset').addEventListener('click', () => {
  pcts           = [...DEFAULT_PCTS]
  salary         = 0
  initialBalance = null
  document.getElementById('salary').value         = ''
  document.getElementById('initialBalance').value = ''
  update()
})

document.getElementById('btnSave').addEventListener('click', async () => {
  const sum = pcts.reduce((a,b) => a+b, 0)
  if (sum !== 100) {
    const toast = document.getElementById('toast')
    toast.classList.add('visible')
    setTimeout(() => toast.classList.remove('visible'), 2500)
    return
  }

  const body = {
    salary,
    pockets: Object.fromEntries(POCKETS.map((p,i) => [p.name, pcts[i]])),
    initial_balance: initialBalance,
  }

  try {
    const res = await fetch(`${API}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) throw new Error()

    const msg = document.getElementById('saveMsg')
    msg.classList.add('visible')
    setTimeout(() => msg.classList.remove('visible'), 2500)
  } catch {
    alert('Erro ao salvar configuração.')
  }
})

// --- LOAD ---
async function loadConfig() {
  try {
    const res = await fetch(`${API}/config`)
    if (!res.ok) { update(); return }
    const data = await res.json()

    salary = parseFloat(data.salary)
    document.getElementById('salary').value = salary

    if (data.initial_balance !== null && data.initial_balance !== undefined) {
      initialBalance = parseFloat(data.initial_balance)
      document.getElementById('initialBalance').value = initialBalance
    }

    POCKETS.forEach((p, i) => {
      pcts[i] = data.pockets[p.name].percent
    })

    update()
  } catch {
    update()
  }
}

initDonut()
loadConfig()
