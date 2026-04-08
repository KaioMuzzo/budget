const API = 'http://localhost:3333/api'
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

let month = new Date().getMonth() + 1
let year  = new Date().getFullYear()
let selectedTxType  = 'INCOME'
let selectedSubType = 'DEPOSIT'
let selectedCatType = 'INCOME'
let categories = []
let boxes = []

const fmt     = v   => parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = iso => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

// MONTH NAV
function updateMonthLabel() {
  document.getElementById('monthLabel').textContent = `${MONTHS[month-1]} ${year}`
}

document.getElementById('btnPrev').addEventListener('click', () => {
  if (--month < 1) { month = 12; year-- }
  updateMonthLabel(); loadTransactions()
})

document.getElementById('btnNext').addEventListener('click', () => {
  if (++month > 12) { month = 1; year++ }
  updateMonthLabel(); loadTransactions()
})

// PANELS
function openPanel(id) {
  document.getElementById(id).classList.add('open')
  document.getElementById('overlay').classList.add('open')
}

function closeAll() {
  ;['panelTx','panelCat'].forEach(id => document.getElementById(id).classList.remove('open'))
  document.getElementById('overlay').classList.remove('open')
  clearTxForm()
}

document.getElementById('overlay').addEventListener('click', closeAll)
document.getElementById('closeTx').addEventListener('click', closeAll)
document.getElementById('closeCat').addEventListener('click', closeAll)

document.getElementById('btnNew').addEventListener('click', () => {
  document.getElementById('fDate').value = new Date().toISOString().split('T')[0]
  openPanel('panelTx')
})

document.getElementById('btnCategories').addEventListener('click', () => openPanel('panelCat'))

// TX TYPE TOGGLE
function setTxType(type) {
  selectedTxType = type
  document.getElementById('typeIncome').className  = type === 'INCOME'      ? 'type-btn active-income'  : 'type-btn'
  document.getElementById('typeExpense').className = type === 'EXPENSE'     ? 'type-btn active-expense' : 'type-btn'
  document.getElementById('typeInvest').className  = type === 'INVESTMENT'  ? 'type-btn active-invest'  : 'type-btn'

  const isInvest = type === 'INVESTMENT'
  document.getElementById('fieldCategory').style.display = isInvest ? 'none' : ''
  document.getElementById('fieldBox').style.display      = isInvest ? ''     : 'none'
  document.getElementById('fieldSubType').style.display  = isInvest ? ''     : 'none'

  if (!isInvest) renderCategorySelect()
  else           renderBoxSelect()
}

document.getElementById('typeIncome').addEventListener('click',  () => setTxType('INCOME'))
document.getElementById('typeExpense').addEventListener('click', () => setTxType('EXPENSE'))
document.getElementById('typeInvest').addEventListener('click',  () => setTxType('INVESTMENT'))

// SUB TYPE TOGGLE
function setSubType(sub) {
  selectedSubType = sub
  document.getElementById('subDeposit').className    = sub === 'DEPOSIT'    ? 'sub-btn active-deposit'    : 'sub-btn'
  document.getElementById('subWithdrawal').className = sub === 'WITHDRAWAL' ? 'sub-btn active-withdrawal' : 'sub-btn'
}

document.getElementById('subDeposit').addEventListener('click',    () => setSubType('DEPOSIT'))
document.getElementById('subWithdrawal').addEventListener('click', () => setSubType('WITHDRAWAL'))

// CAT TYPE TOGGLE
document.getElementById('catTypeIncome').addEventListener('click', () => {
  selectedCatType = 'INCOME'
  document.getElementById('catTypeIncome').className  = 'type-btn active-income'
  document.getElementById('catTypeExpense').className = 'type-btn'
})

document.getElementById('catTypeExpense').addEventListener('click', () => {
  selectedCatType = 'EXPENSE'
  document.getElementById('catTypeExpense').className = 'type-btn active-expense'
  document.getElementById('catTypeIncome').className  = 'type-btn'
})

function renderCategorySelect() {
  const sel = document.getElementById('fCategory')
  const filtered = categories.filter(c => c.type === selectedTxType)
  sel.innerHTML = '<option value="">Selecionar...</option>' +
    filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
}

function renderBoxSelect() {
  const sel = document.getElementById('fBox')
  if (!boxes.length) {
    sel.innerHTML = '<option value="">Nenhuma caixinha cadastrada</option>'
    return
  }
  sel.innerHTML = '<option value="">Selecionar...</option>' +
    boxes.map(b => `<option value="${b.id}">${b.name}</option>`).join('')
  if (boxes.length === 1) sel.value = boxes[0].id
}

function renderCatList() {
  const list = document.getElementById('catList')
  if (!categories.length) {
    list.innerHTML = '<div class="cat-empty">Nenhuma categoria criada.</div>'
    return
  }
  list.innerHTML = categories.map((c, i) => `
    <div class="cat-item" style="animation-delay:${i*0.04}s">
      <span class="cat-badge ${c.type === 'INCOME' ? 'income' : 'expense'}">
        ${c.type === 'INCOME' ? 'Receita' : 'Despesa'}
      </span>
      <span class="cat-name">${c.name}</span>
      <button class="btn-delete" data-id="${c.id}">✕</button>
    </div>
  `).join('')

  list.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir esta categoria?')) return
      const res = await fetch(`${API}/categories/${btn.dataset.id}`, { method: 'DELETE' })
      if (res.ok) { await loadCategories(); renderCatList(); renderCategorySelect() }
      else {
        const d = await res.json()
        if (d.error === 'CATEGORY_HAS_TRANSACTIONS')
          alert('Esta categoria possui lançamentos e não pode ser excluída.')
      }
    })
  })
}

function clearTxForm() {
  ;['fDesc','fAmount','fDate'].forEach(id => document.getElementById(id).value = '')
  document.getElementById('fCategory').value = ''
  document.getElementById('fBox').value = ''
  ;['errDesc','errAmount','errCat','errBox','errDate'].forEach(id =>
    document.getElementById(id).classList.remove('visible'))
  setTxType('INCOME')
  setSubType('DEPOSIT')
}

// SUBMIT TX
document.getElementById('btnSubmitTx').addEventListener('click', async () => {
  const desc   = document.getElementById('fDesc').value.trim()
  const amount = parseFloat(document.getElementById('fAmount').value)
  const date   = document.getElementById('fDate').value
  const isInvest = selectedTxType === 'INVESTMENT'
  let valid = true

  const check = (cond, errId) => {
    if (cond) { document.getElementById(errId).classList.add('visible');    valid = false }
    else        document.getElementById(errId).classList.remove('visible')
  }

  check(!desc,              'errDesc')
  check(!amount||amount<=0, 'errAmount')
  check(!date,              'errDate')

  if (isInvest) {
    const boxId = parseInt(document.getElementById('fBox').value)
    check(!boxId, 'errBox')
    if (!valid) return

    try {
      const res = await fetch(`${API}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          amount,
          type: 'INVESTMENT',
          sub_type: selectedSubType,
          date,
          box_id: boxId,
        })
      })
      if (!res.ok) {
        const d = await res.json()
        if (d.error === 'INSUFFICIENT_BALANCE') { alert('Saldo insuficiente para este resgate.'); return }
        throw new Error()
      }
      closeAll(); loadTransactions()
    } catch { alert('Erro ao salvar lançamento.') }
  } else {
    const catId = parseInt(document.getElementById('fCategory').value)
    check(!catId, 'errCat')
    if (!valid) return

    try {
      const res = await fetch(`${API}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, amount, type: selectedTxType, date, category_id: catId })
      })
      if (!res.ok) throw new Error()
      closeAll(); loadTransactions()
    } catch { alert('Erro ao salvar lançamento.') }
  }
})

// SUBMIT CAT
document.getElementById('btnSubmitCat').addEventListener('click', async () => {
  const name = document.getElementById('catName').value.trim()
  if (!name) { document.getElementById('errCatName').classList.add('visible'); return }
  document.getElementById('errCatName').classList.remove('visible')

  try {
    const res = await fetch(`${API}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: selectedCatType })
    })
    if (!res.ok) throw new Error()
    document.getElementById('catName').value = ''
    await loadCategories()
    renderCatList()
    renderCategorySelect()
  } catch { alert('Erro ao criar categoria.') }
})

async function loadCategories() {
  const res = await fetch(`${API}/categories`)
  if (res.ok) categories = await res.json()
}

async function loadBoxes() {
  const res = await fetch(`${API}/investments`)
  if (res.ok) boxes = await res.json()
}

async function loadTransactions() {
  const res = await fetch(`${API}/transactions?month=${month}&year=${year}`)
  if (!res.ok) return

  const { transactions, summary } = await res.json()

  document.getElementById('sumIncome').textContent  = fmt(summary.income)
  document.getElementById('sumExpense').textContent = fmt(summary.expense)
  document.getElementById('sumInvest').textContent  = fmt(summary.investment || 0)
  document.getElementById('sumBalance').textContent = fmt(summary.balance)

  const tbody = document.getElementById('tbody')

  if (!transactions.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Nenhum lançamento neste mês.</div></td></tr>`
    return
  }

  tbody.innerHTML = transactions.map((t, i) => {
    const isInvest  = t.type === 'INVESTMENT'
    const isDeposit = t.sub_type === 'DEPOSIT'

    const labelHtml = isInvest
      ? `<span class="td-cat invest">${t.box_name} · ${isDeposit ? 'Aporte' : 'Resgate'}</span>`
      : `<span class="td-cat">${t.category_name}</span>`

    const sign     = t.type === 'INCOME' ? '+' : isInvest && isDeposit ? '↓' : '-'
    const amtClass = t.type === 'INCOME' ? 'income' : isInvest ? 'invest' : 'expense'

    return `
      <tr style="animation-delay:${i*0.04}s">
        <td class="td-desc">${t.description}</td>
        <td>${labelHtml}</td>
        <td class="td-date">${fmtDate(t.date)}</td>
        <td class="td-amount ${amtClass}">${sign} ${fmt(t.amount)}</td>
        <td><button class="btn-delete" data-id="${t.id}">✕</button></td>
      </tr>
    `
  }).join('')

  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este lançamento?')) return
      const res = await fetch(`${API}/transactions/${btn.dataset.id}`, { method: 'DELETE' })
      if (res.ok) loadTransactions()
    })
  })
}

async function init() {
  await Promise.all([loadCategories(), loadBoxes()])
  renderCategorySelect()
  renderCatList()
  updateMonthLabel()
  loadTransactions()
}

init()
