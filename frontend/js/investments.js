const API = 'http://localhost:3333/api'

const fmt = v => parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

let boxes = []
let editingBoxId = null

// PANEL
function openPanel(editBox = null) {
  editingBoxId = editBox ? editBox.id : null
  document.getElementById('panelBoxTitle').textContent = editBox ? 'Renomear Caixinha' : 'Nova Caixinha'
  document.getElementById('btnSubmitBox').textContent  = editBox ? 'Salvar' : 'Criar'
  document.getElementById('fName').value = editBox ? editBox.name : ''
  document.getElementById('errName').classList.remove('visible')
  document.getElementById('panelBox').classList.add('open')
  document.getElementById('overlay').classList.add('open')
  document.getElementById('fName').focus()
}

function closePanel() {
  document.getElementById('panelBox').classList.remove('open')
  document.getElementById('overlay').classList.remove('open')
  editingBoxId = null
}

document.getElementById('overlay').addEventListener('click', closePanel)
document.getElementById('closeBox').addEventListener('click', closePanel)
document.getElementById('btnNew').addEventListener('click', () => openPanel())

// SUBMIT
document.getElementById('btnSubmitBox').addEventListener('click', async () => {
  const name = document.getElementById('fName').value.trim()
  if (!name) { document.getElementById('errName').classList.add('visible'); return }
  document.getElementById('errName').classList.remove('visible')

  try {
    let res
    if (editingBoxId) {
      res = await fetch(`${API}/investments/${editingBoxId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
    } else {
      res = await fetch(`${API}/investments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
    }
    if (!res.ok) throw new Error()
    closePanel()
    loadBoxes()
  } catch { alert('Erro ao salvar caixinha.') }
})

// RENDER
function renderBoxes() {
  const tbody = document.getElementById('tbody')
  const total = boxes.reduce((acc, b) => acc + parseFloat(b.balance), 0)
  document.getElementById('sumTotal').textContent = fmt(total)

  if (!boxes.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state">Nenhuma caixinha criada.</div></td></tr>`
    return
  }

  tbody.innerHTML = boxes.map((b, i) => {
    const hasBalance = parseFloat(b.balance) > 0
    return `
      <tr style="animation-delay:${i * 0.04}s" data-id="${b.id}">
        <td class="td-name"><a href="investment-detail.html?id=${b.id}">${b.name}</a></td>
        <td class="td-balance">${fmt(b.balance)}</td>
        <td style="text-align:right">
          <button class="btn-icon btn-edit" data-id="${b.id}" title="Renomear">✎</button>
          <button class="btn-icon danger btn-delete" data-id="${b.id}"
            ${hasBalance ? 'disabled title="Resgate todo o saldo antes de remover"' : 'title="Remover"'}>✕</button>
        </td>
      </tr>
    `
  }).join('')

  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const box = boxes.find(b => b.id === parseInt(btn.dataset.id))
      if (box) openPanel(box)
    })
  })

  tbody.querySelectorAll('.btn-delete:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      if (!confirm('Remover esta caixinha?')) return
      const res = await fetch(`${API}/investments/${btn.dataset.id}`, { method: 'DELETE' })
      if (res.ok) loadBoxes()
      else {
        const d = await res.json()
        if (d.error === 'BOX_HAS_BALANCE')
          alert('Esta caixinha possui saldo e não pode ser removida.')
      }
    })
  })
}

async function loadBoxes() {
  const res = await fetch(`${API}/investments`)
  if (res.ok) { boxes = await res.json(); renderBoxes() }
}

loadBoxes()
