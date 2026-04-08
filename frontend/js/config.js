const API = 'http://localhost:3333/api'

const POCKETS = [
  { name: 'Liberdade Financeira', color: 'var(--p1)' },
  { name: 'Custos Fixos',         color: 'var(--p2)' },
  { name: 'Conforto',             color: 'var(--p3)' },
  { name: 'Metas',                color: 'var(--p4)' },
  { name: 'Prazeres',             color: 'var(--p5)' },
  { name: 'Conhecimento',         color: 'var(--p6)' },
]

const COLORS = ['#a8ff3e','#38bdf8','#f472b6','#fb923c','#a78bfa','#fbbf24']
const DEFAULT_PCTS = [25, 30, 15, 15, 10, 5]

let pcts = [...DEFAULT_PCTS]
let salary = 0

// --- BUILD SLIDERS ---
const slidersEl = document.getElementById('sliders')
const legendEl  = document.getElementById('legend')

POCKETS.forEach((p, i) => {
  const row = document.createElement('div')
  row.className = 'slider-row'
  row.innerHTML = `
    <div class="slider-meta">
      <span class="slider-name" style="color:${p.color}">${p.name}</span>
      <span class="slider-pct" id="pct-${i}">0%</span>
      <span class="slider-amount" style="color:${p.color}" id="amt-${i}">R$ 0,00</span>
    </div>
    <input type="range" min="0" max="100" value="0"
           id="range-${i}"
           style="--thumb-color:${p.color};
                  background: linear-gradient(to right, ${p.color} 0%, ${p.color} 0%, var(--border) 0%)" />
  `
  slidersEl.appendChild(row)

  const li = document.createElement('div')
  li.className = 'legend-item'
  li.innerHTML = `
    <span class="legend-dot" style="background:${p.color}"></span>
    <span class="legend-name">${p.name}</span>
    <span class="legend-val" id="leg-${i}">0%</span>
  `
  legendEl.appendChild(li)
})

// --- DONUT ---
const canvas = document.getElementById('donut')
const ctx    = canvas.getContext('2d')

function drawDonut(values) {
  const total = values.reduce((a,b) => a+b, 0) || 100
  const cx = canvas.width  / 2
  const cy = canvas.height / 2
  const r  = 85
  const inner = 52

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  let start = -Math.PI / 2
  values.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, start, start + slice)
    ctx.closePath()
    ctx.fillStyle = COLORS[i]
    ctx.fill()
    start += slice
  })

  ctx.beginPath()
  ctx.arc(cx, cy, inner, 0, Math.PI * 2)
  ctx.fillStyle = '#0d0d0f'
  ctx.fill()

  const sum = values.reduce((a,b) => a+b, 0)
  ctx.fillStyle = '#e8e8f0'
  ctx.font = `700 1.5rem DM Sans, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${sum}%`, cx, cy - 8)
  ctx.fillStyle = '#6b6b80'
  ctx.font = `400 0.65rem DM Sans, sans-serif`
  ctx.fillText('Total', cx, cy + 12)
}

// --- UPDATE ---
function fmt(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function update() {
  const sum = pcts.reduce((a,b) => a+b, 0)

  const bar = document.getElementById('sumBar')
  const sumVal = document.getElementById('sumVal')
  bar.style.width = Math.min(sum, 100) + '%'
  bar.style.background = sum > 100 ? 'var(--danger)' : sum === 100 ? 'var(--accent)' : 'var(--accent-dim)'
  sumVal.textContent = sum + '%'
  sumVal.className = 'sum-value' + (sum > 100 ? ' over' : sum === 100 ? ' ok' : '')

  POCKETS.forEach((_, i) => {
    const v = pcts[i]
    const range = document.getElementById(`range-${i}`)
    const pct   = document.getElementById(`pct-${i}`)
    const amt   = document.getElementById(`amt-${i}`)
    const leg   = document.getElementById(`leg-${i}`)

    range.value = v
    range.style.background = `linear-gradient(to right, ${COLORS[i]} ${v}%, ${COLORS[i]} ${v}%, var(--border) ${v}%)`
    pct.textContent = v + '%'
    amt.textContent = fmt(salary * v / 100)
    leg.textContent = v + '%'
  })

  drawDonut(pcts)
}

// --- EVENTS ---
POCKETS.forEach((_, i) => {
  document.getElementById(`range-${i}`).addEventListener('input', e => {
    const newVal = parseInt(e.target.value)
    const somaOutros = pcts.reduce((acc, v, idx) => idx === i ? acc : acc + v, 0)
    const maximo = 100 - somaOutros
    pcts[i] = Math.min(newVal, maximo)
    update()
  })
})

document.getElementById('salary').addEventListener('input', e => {
  salary = parseFloat(e.target.value) || 0
  update()
})

document.getElementById('btnReset').addEventListener('click', () => {
  pcts = [...DEFAULT_PCTS]
  salary = 0
  document.getElementById('salary').value = ''
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
    pockets: Object.fromEntries(POCKETS.map((p,i) => [p.name, pcts[i]]))
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
    if (!res.ok) {
      update()
      return
    }
    const data = await res.json()

    salary = parseFloat(data.salary)
    document.getElementById('salary').value = salary

    POCKETS.forEach((p, i) => {
      pcts[i] = data.pockets[p.name].percent
    })

    update()
  } catch {
    update()
  }
}

loadConfig()
