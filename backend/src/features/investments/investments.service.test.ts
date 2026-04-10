import { describe, it, expect, beforeEach } from 'vitest'
import { listBoxes, createBox, updateBox, getBox, deleteBox, listBoxTransactions, deleteBoxTransaction } from './investments.service'
import { prisma } from '../../lib/prisma'

const APR_2026 = { month: 4, year: 2026 }

async function seedDeposit(targetBoxId: number, amount: number, date = `${APR_2026.year}-0${APR_2026.month}-01`) {
  return prisma.transaction.create({
    data: {
      description: 'Aporte',
      amount,
      type: 'INVESTMENT',
      sub_type: 'DEPOSIT',
      date: new Date(date),
      box_id: targetBoxId,
    },
  })
}

async function seedWithdrawal(targetBoxId: number, amount: number, date = `${APR_2026.year}-0${APR_2026.month}-02`) {
  return prisma.transaction.create({
    data: {
      description: 'Resgate',
      amount,
      type: 'INVESTMENT',
      sub_type: 'WITHDRAWAL',
      date: new Date(date),
      box_id: targetBoxId,
    },
  })
}

// ─── listBoxes ───────────────────────────────────────────────────────────────

describe('listBoxes', () => {
  it('returns empty boxes array when no boxes exist', async () => {
    const result = await listBoxes()
    expect(result.boxes).toEqual([])
    expect(result.last_movement).toBeNull()
  })

  it('returns boxes ordered by created_at asc', async () => {
    await createBox('Tesouro Direto')
    await createBox('Ações')

    const { boxes } = await listBoxes()
    expect(boxes[0].name).toBe('Tesouro Direto')
    expect(boxes[1].name).toBe('Ações')
  })

  it('returns balance as 0.00 for box with no transactions', async () => {
    await createBox('Tesouro Direto')
    const { boxes } = await listBoxes()
    expect(boxes[0].balance).toBe('0.00')
  })

  it('returns balance as deposits minus withdrawals', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 1000)
    await seedDeposit(box.id, 500)
    await seedWithdrawal(box.id, 200)

    const { boxes } = await listBoxes()
    expect(boxes[0].balance).toBe('1300.00')
  })

  it('returns correct balance per box independently', async () => {
    const a = await createBox('Caixa A')
    const b = await createBox('Caixa B')
    await seedDeposit(a.id, 1000)
    await seedDeposit(b.id, 500)

    const { boxes } = await listBoxes()
    expect(boxes.find(r => r.name === 'Caixa A')!.balance).toBe('1000.00')
    expect(boxes.find(r => r.name === 'Caixa B')!.balance).toBe('500.00')
  })

  it('returns id and created_at fields', async () => {
    await createBox('Tesouro Direto')
    const { boxes } = await listBoxes()
    expect(boxes[0].id).toBeDefined()
    expect(boxes[0].created_at).toBeDefined()
  })

  it('returns last_movement with the most recent transaction across all boxes', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 100, '2026-04-01')
    await seedDeposit(box.id, 200, '2026-04-10')

    const { last_movement } = await listBoxes()
    expect(last_movement).not.toBeNull()
    expect(last_movement!.amount).toBe('200.00')
    expect(last_movement!.box_name).toBe('Tesouro Direto')
  })
})

// ─── createBox ───────────────────────────────────────────────────────────────

describe('createBox', () => {
  it('creates a box with valid name', async () => {
    const box = await createBox('Tesouro Direto')
    expect(box.name).toBe('Tesouro Direto')
    expect(box.balance).toBe('0.00')
    expect(box.id).toBeDefined()
    expect(box.created_at).toBeDefined()
  })

  it('persists the box to the database', async () => {
    await createBox('Tesouro Direto')
    const { boxes } = await listBoxes()
    expect(boxes).toHaveLength(1)
    expect(boxes[0].name).toBe('Tesouro Direto')
  })

  it('trims whitespace from name', async () => {
    const box = await createBox('  Tesouro Direto  ')
    expect(box.name).toBe('Tesouro Direto')
  })

  it('throws BOX_NAME_REQUIRED for empty string', async () => {
    await expect(createBox('')).rejects.toMatchObject({ code: 'BOX_NAME_REQUIRED' })
  })

  it('throws BOX_NAME_REQUIRED for whitespace-only string', async () => {
    await expect(createBox('   ')).rejects.toMatchObject({ code: 'BOX_NAME_REQUIRED' })
  })

  it('throws BOX_NAME_REQUIRED for non-string value', async () => {
    await expect(createBox(123)).rejects.toMatchObject({ code: 'BOX_NAME_REQUIRED' })
  })

  it('creates box with goal', async () => {
    const box = await createBox('Reserva', 10000)
    expect(box.goal).toBe('10000.00')
  })

  it('creates box without goal — goal is null', async () => {
    const box = await createBox('Reserva')
    expect(box.goal).toBeNull()
  })

  it('throws TRANSACTION_AMOUNT_INVALID for zero goal', async () => {
    await expect(createBox('Reserva', 0)).rejects.toMatchObject({ code: 'TRANSACTION_AMOUNT_INVALID' })
  })

  it('throws TRANSACTION_AMOUNT_INVALID for negative goal', async () => {
    await expect(createBox('Reserva', -1000)).rejects.toMatchObject({ code: 'TRANSACTION_AMOUNT_INVALID' })
  })
})

// ─── updateBox ───────────────────────────────────────────────────────────────

describe('updateBox', () => {
  it('renames the box', async () => {
    const box = await createBox('Tesouro Direto')
    const updated = await updateBox(box.id, 'Renda Fixa')
    expect(updated.name).toBe('Renda Fixa')
  })

  it('returns current balance after rename', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 800)
    const updated = await updateBox(box.id, 'Renda Fixa')
    expect(updated.balance).toBe('800.00')
  })

  it('persists the rename', async () => {
    const box = await createBox('Tesouro Direto')
    await updateBox(box.id, 'Renda Fixa')
    const { boxes } = await listBoxes()
    expect(boxes[0].name).toBe('Renda Fixa')
  })

  it('throws BOX_NOT_FOUND for non-existent id', async () => {
    await expect(updateBox(999999, 'Novo Nome')).rejects.toMatchObject({ code: 'BOX_NOT_FOUND' })
  })

  it('throws BOX_NAME_REQUIRED for empty string', async () => {
    const box = await createBox('Tesouro Direto')
    await expect(updateBox(box.id, '')).rejects.toMatchObject({ code: 'BOX_NAME_REQUIRED' })
  })

  it('throws BOX_NAME_REQUIRED for whitespace-only string', async () => {
    const box = await createBox('Tesouro Direto')
    await expect(updateBox(box.id, '   ')).rejects.toMatchObject({ code: 'BOX_NAME_REQUIRED' })
  })

  it('throws BOX_NAME_REQUIRED for non-string value', async () => {
    const box = await createBox('Tesouro Direto')
    await expect(updateBox(box.id, null)).rejects.toMatchObject({ code: 'BOX_NAME_REQUIRED' })
  })

  it('updates goal without changing name', async () => {
    const box = await createBox('Tesouro Direto')
    const updated = await updateBox(box.id, undefined, 15000)
    expect(updated.goal).toBe('15000.00')
    expect(updated.name).toBe('Tesouro Direto')
  })

  it('updates name and goal together', async () => {
    const box = await createBox('Tesouro Direto')
    const updated = await updateBox(box.id, 'Renda Fixa', 20000)
    expect(updated.name).toBe('Renda Fixa')
    expect(updated.goal).toBe('20000.00')
  })

  it('returns null goal when goal was never set', async () => {
    const box = await createBox('Tesouro Direto')
    const updated = await updateBox(box.id, 'Renda Fixa')
    expect(updated.goal).toBeNull()
  })

  it('throws TRANSACTION_AMOUNT_INVALID for invalid goal in update', async () => {
    const box = await createBox('Tesouro Direto')
    await expect(updateBox(box.id, undefined, -500)).rejects.toMatchObject({ code: 'TRANSACTION_AMOUNT_INVALID' })
  })
})

// ─── listBoxTransactions ─────────────────────────────────────────────────────

describe('listBoxTransactions', () => {
  it('throws BOX_NOT_FOUND for non-existent box', async () => {
    await expect(listBoxTransactions(999999)).rejects.toMatchObject({ code: 'BOX_NOT_FOUND' })
  })

  it('returns empty array for box with no transactions', async () => {
    const box = await createBox('Tesouro Direto')
    expect(await listBoxTransactions(box.id)).toEqual([])
  })

  it('returns all transactions for the box', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 500, '2026-04-01')
    await seedWithdrawal(box.id, 100, '2026-04-02')

    const result = await listBoxTransactions(box.id)
    expect(result).toHaveLength(2)
  })

  it('returns transactions ordered by date desc', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 100, '2026-04-01')
    await seedDeposit(box.id, 200, '2026-04-10')

    const result = await listBoxTransactions(box.id)
    expect(Number(result[0].amount)).toBeGreaterThan(Number(result[1].amount))
  })

  it('does not return transactions from other boxes', async () => {
    const boxA = await createBox('Caixa A')
    const boxB = await createBox('Caixa B')
    await seedDeposit(boxA.id, 500)
    await seedDeposit(boxB.id, 300)

    const result = await listBoxTransactions(boxA.id)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe('500.00')
  })

  it('returns correct fields on each transaction', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 500, '2026-04-05')

    const result = await listBoxTransactions(box.id)
    const t = result[0]
    expect(t.id).toBeDefined()
    expect(t.description).toBe('Aporte')
    expect(t.sub_type).toBe('DEPOSIT')
    expect(t.amount).toBe('500.00')
    expect(t.date).toBeDefined()
    expect(t.created_at).toBeDefined()
  })

  it('filters by month — returns only transactions in that month', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 300, '2026-03-15')
    await seedDeposit(box.id, 500, '2026-04-01')
    await seedDeposit(box.id, 200, '2026-04-20')

    const result = await listBoxTransactions(box.id, '2026-04')
    expect(result).toHaveLength(2)
    expect(result.every(t => new Date(t.date).getUTCMonth() === 3)).toBe(true)
  })

  it('filters by month — returns empty when no transactions in month', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 500, '2026-03-01')

    const result = await listBoxTransactions(box.id, '2026-04')
    expect(result).toHaveLength(0)
  })

  it('without month filter returns all transactions', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 100, '2026-02-01')
    await seedDeposit(box.id, 200, '2026-03-01')
    await seedDeposit(box.id, 300, '2026-04-01')

    const result = await listBoxTransactions(box.id)
    expect(result).toHaveLength(3)
  })
})

// ─── getBox ──────────────────────────────────────────────────────────────────

describe('getBox', () => {
  it('throws BOX_NOT_FOUND for non-existent id', async () => {
    await expect(getBox(999999)).rejects.toMatchObject({ code: 'BOX_NOT_FOUND' })
  })

  it('returns box with zeroed stats when no transactions', async () => {
    const box = await createBox('Reserva')
    const result = await getBox(box.id)
    expect(result.balance).toBe('0.00')
    expect(result.total_deposited).toBe('0.00')
    expect(result.total_withdrawn).toBe('0.00')
    expect(result.transaction_count).toBe(0)
  })

  it('returns correct balance, total_deposited and total_withdrawn', async () => {
    const box = await createBox('Reserva')
    await seedDeposit(box.id, 1000, '2026-01-01')
    await seedDeposit(box.id, 500, '2026-02-01')
    await seedWithdrawal(box.id, 200, '2026-03-01')

    const result = await getBox(box.id)
    expect(result.total_deposited).toBe('1500.00')
    expect(result.total_withdrawn).toBe('200.00')
    expect(result.balance).toBe('1300.00')
    expect(result.transaction_count).toBe(3)
  })

  it('returns goal when set', async () => {
    const box = await createBox('Reserva', 10000)
    const result = await getBox(box.id)
    expect(result.goal).toBe('10000.00')
  })

  it('returns null goal when not set', async () => {
    const box = await createBox('Reserva')
    const result = await getBox(box.id)
    expect(result.goal).toBeNull()
  })

  it('returns monthly with 4 entries ordered oldest to newest', async () => {
    const box = await createBox('Reserva')
    const result = await getBox(box.id)
    expect(result.monthly).toHaveLength(4)
    const months = result.monthly.map(m => m.month)
    expect(months[0] < months[1]).toBe(true)
    expect(months[1] < months[2]).toBe(true)
    expect(months[2] < months[3]).toBe(true)
  })

  it('aggregates deposited and withdrawn correctly per month', async () => {
    const box = await createBox('Reserva')
    await seedDeposit(box.id, 1000, '2026-04-01')
    await seedDeposit(box.id, 500, '2026-04-10')
    await seedWithdrawal(box.id, 200, '2026-04-15')

    const result = await getBox(box.id)
    const apr = result.monthly.find(m => m.month === '2026-04')!
    expect(apr.deposited).toBe('1500.00')
    expect(apr.withdrawn).toBe('200.00')
  })

  it('months with no transactions show 0.00', async () => {
    const box = await createBox('Reserva')
    await seedDeposit(box.id, 100, '2026-04-01')

    const result = await getBox(box.id)
    const jan = result.monthly.find(m => m.month === '2026-01')
    if (jan) {
      expect(jan.deposited).toBe('0.00')
      expect(jan.withdrawn).toBe('0.00')
    }
  })

  it('returns id, name and created_at', async () => {
    const box = await createBox('Reserva')
    const result = await getBox(box.id)
    expect(result.id).toBe(box.id)
    expect(result.name).toBe('Reserva')
    expect(result.created_at).toBeDefined()
  })
})

// ─── deleteBoxTransaction ─────────────────────────────────────────────────────

describe('deleteBoxTransaction', () => {
  it('deletes a transaction from the box', async () => {
    const box = await createBox('Reserva')
    const tx = await seedDeposit(box.id, 500)
    await deleteBoxTransaction(box.id, tx.id)
    expect(await listBoxTransactions(box.id)).toHaveLength(0)
  })

  it('throws BOX_NOT_FOUND for non-existent box', async () => {
    await expect(deleteBoxTransaction(999999, 1)).rejects.toMatchObject({ code: 'BOX_NOT_FOUND' })
  })

  it('throws TRANSACTION_NOT_FOUND for non-existent transaction', async () => {
    const box = await createBox('Reserva')
    await expect(deleteBoxTransaction(box.id, 999999)).rejects.toMatchObject({ code: 'TRANSACTION_NOT_FOUND' })
  })

  it('throws TRANSACTION_NOT_FOUND when transaction belongs to different box', async () => {
    const boxA = await createBox('Caixa A')
    const boxB = await createBox('Caixa B')
    const tx = await seedDeposit(boxA.id, 500)
    await expect(deleteBoxTransaction(boxB.id, tx.id)).rejects.toMatchObject({ code: 'TRANSACTION_NOT_FOUND' })
  })

  it('does not delete other transactions in the box', async () => {
    const box = await createBox('Reserva')
    const tx1 = await seedDeposit(box.id, 300)
    await seedDeposit(box.id, 200)
    await deleteBoxTransaction(box.id, tx1.id)
    expect(await listBoxTransactions(box.id)).toHaveLength(1)
  })
})

// ─── deleteBox ───────────────────────────────────────────────────────────────

describe('deleteBox', () => {
  it('deletes a box with zero balance and no transactions', async () => {
    const box = await createBox('Tesouro Direto')
    await deleteBox(box.id)
    const { boxes } = await listBoxes()
    expect(boxes).toHaveLength(0)
  })

  it('deletes box and its transactions when deposits equal withdrawals', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 500)
    await seedWithdrawal(box.id, 500)

    await deleteBox(box.id)

    const { boxes } = await listBoxes()
    expect(boxes).toHaveLength(0)
    const remaining = await prisma.transaction.findMany({ where: { box_id: box.id } })
    expect(remaining).toHaveLength(0)
  })

  it('throws BOX_HAS_BALANCE when box has positive balance', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 500)
    await expect(deleteBox(box.id)).rejects.toMatchObject({ code: 'BOX_HAS_BALANCE' })
  })

  it('throws BOX_HAS_BALANCE when deposits exceed withdrawals', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 500)
    await seedWithdrawal(box.id, 200)
    await expect(deleteBox(box.id)).rejects.toMatchObject({ code: 'BOX_HAS_BALANCE' })
  })

  it('throws BOX_NOT_FOUND for non-existent id', async () => {
    await expect(deleteBox(999999)).rejects.toMatchObject({ code: 'BOX_NOT_FOUND' })
  })
})
