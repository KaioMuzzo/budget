const API = 'http://localhost:3333/api'

const fmt     = v   => parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = iso => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

const params = new URLSearchParams(location.search)
const boxId  = parseInt(params.get('id'))

if (!boxId) location.href = 'investments.html'

// PANELS
function openPanel(id) {
  closeAll()
  document.getElementById(id).classList.add('open')
  document.getElementById('overlay').classList.add('open')
}

function closeAll() {
  ;['panelDeposit', 'panelWithdraw'].forEach(id =>
    document.getElementById(id).classList.remove('open'))
  document.getElementById('overlay').classList.remove('open')
}

document.getElementById('overlay').addEventListener('click', closeAll)
document.getElementById('closeDeposit').addEventListener('click', closeAll)
document.getElementById('closeWithdraw').addEventListener('click', closeAll)

document.getElementById('btnDeposit').addEventListener('click', () => {
  document.getElementById('fDepositDate').value = new Date().toISOString().split('T')[0]
  document.getElementById('fDepositAmount').value = ''
  ;['errDepositAmount','errDepositDate'].forEach(id =>
    document.getElementById(id).classList.remove('visible'))
  openPanel('panelDeposit')
})

document.getElementById('btnWithdraw').addEventListener('click', () => {
  document.getElementById('fWithdrawDate').value = new Date().toISOString().split('T')[0]
  document.getElementById('fWithdrawAmount').value = ''
  ;['errWithdrawAmount','errWithdrawDate'].forEach(id =>
    document.getElementById(id).classList.remove('visible'))
  openPanel('panelWithdraw')
})

// SUBMIT DEPOSIT
document.getElementById('btnSubmitDeposit').addEventListener('click', async () => {
  const amount = parseFloat(document.getElementById('fDepositAmount').value)
  const date   = document.getElementById('fDepositDate').value
  let valid = true

  const check = (cond, errId) => {
    if (cond) { document.getElementById(errId).classList.add('visible');    valid = false }
    else        document.getElementById(errId).classList.remove('visible')
  }

  check(!amount || amount <= 0, 'errDepositAmount')
  check(!date,                  'errDepositDate')
  if (!valid) return

  try {
    const res = await fetch(`${API}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Aporte',
        amount,
        type: 'INVESTMENT',
        sub_type: 'DEPOSIT',
        date,
        box_id: boxId,
      })
    })
    if (!res.ok) throw new Error()
    closeAll()
    loadAll()
  } catch { alert('Erro ao registrar aporte.') }
})

// SUBMIT WITHDRAWAL
document.getElementById('btnSubmitWithdraw').addEventListener('click', async () => {
  const amount = parseFloat(document.getElementById('fWithdrawAmount').value)
  const date   = document.getElementById('fWithdrawDate').value
  let valid = true

  const check = (cond, errId) => {
    if (cond) { document.getElementById(errId).classList.add('visible');    valid = false }
    else        document.getElementById(errId).classList.remove('visible')
  }

  check(!amount || amount <= 0, 'errWithdrawAmount')
  check(!date,                  'errWithdrawDate')
  if (!valid) return

  try {
    const res = await fetch(`${API}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Resgate',
        amount,
        type: 'INVESTMENT',
        sub_type: 'WITHDRAWAL',
        date,
        box_id: boxId,
      })
    })
    if (!res.ok) {
      const d = await res.json()
      if (d.error === 'INSUFFICIENT_BALANCE') {
        alert('Saldo insuficiente para este resgate.')
      } else {
        alert('Erro ao registrar resgate.')
      }
      return
    }
    closeAll()
    loadAll()
  } catch { alert('Erro ao registrar resgate.') }
})

// RENDER
function renderTransactions(txs) {
  const tbody = document.getElementById('tbody')

  if (!txs.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state">Nenhum movimento registrado.</div></td></tr>`
    return
  }

  tbody.innerHTML = txs.map((t, i) => {
    const isDeposit = t.sub_type === 'DEPOSIT'
    return `
      <tr style="animation-delay:${i * 0.04}s">
        <td><span class="td-type ${isDeposit ? 'deposit' : 'withdrawal'}">${isDeposit ? 'Aporte' : 'Resgate'}</span></td>
        <td class="td-date">${fmtDate(t.date)}</td>
        <td class="td-amount ${isDeposit ? 'deposit' : 'withdrawal'}">
          ${isDeposit ? '+' : '-'} ${fmt(t.amount)}
        </td>
      </tr>
    `
  }).join('')
}

async function loadAll() {
  const [boxRes, txRes] = await Promise.all([
    fetch(`${API}/investments`),
    fetch(`${API}/investments/${boxId}/transactions`),
  ])

  if (!boxRes.ok || !txRes.ok) {
    alert('Caixinha não encontrada.')
    location.href = 'investments.html'
    return
  }

  const boxes = await boxRes.json()
  const box   = boxes.find(b => b.id === boxId)

  if (!box) {
    location.href = 'investments.html'
    return
  }

  document.title = `Budget — ${box.name}`
  document.getElementById('boxName').textContent    = box.name
  document.getElementById('boxBalance').textContent = fmt(box.balance)

  const txs = await txRes.json()
  renderTransactions(txs)
}

loadAll()
