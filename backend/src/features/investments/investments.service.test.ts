import { describe, it, expect, beforeEach } from 'vitest'
import { listBoxes, createBox, updateBox, deleteBox, listBoxTransactions } from './investments.service'
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
  it('returns empty array when no boxes exist', async () => {
    expect(await listBoxes()).toEqual([])
  })

  it('returns boxes ordered by created_at asc', async () => {
    await createBox('Tesouro Direto')
    await createBox('Ações')

    const result = await listBoxes()
    expect(result[0].name).toBe('Tesouro Direto')
    expect(result[1].name).toBe('Ações')
  })

  it('returns balance as 0.00 for box with no transactions', async () => {
    await createBox('Tesouro Direto')
    const result = await listBoxes()
    expect(result[0].balance).toBe('0.00')
  })

  it('returns balance as deposits minus withdrawals', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 1000)
    await seedDeposit(box.id, 500)
    await seedWithdrawal(box.id, 200)

    const result = await listBoxes()
    expect(result[0].balance).toBe('1300.00')
  })

  it('returns correct balance per box independently', async () => {
    const a = await createBox('Caixa A')
    const b = await createBox('Caixa B')
    await seedDeposit(a.id, 1000)
    await seedDeposit(b.id, 500)

    const result = await listBoxes()
    expect(result.find(r => r.name === 'Caixa A')!.balance).toBe('1000.00')
    expect(result.find(r => r.name === 'Caixa B')!.balance).toBe('500.00')
  })

  it('returns id and created_at fields', async () => {
    await createBox('Tesouro Direto')
    const result = await listBoxes()
    expect(result[0].id).toBeDefined()
    expect(result[0].created_at).toBeDefined()
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
    const result = await listBoxes()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Tesouro Direto')
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
    const result = await listBoxes()
    expect(result[0].name).toBe('Renda Fixa')
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
})

// ─── deleteBox ───────────────────────────────────────────────────────────────

describe('deleteBox', () => {
  it('deletes a box with zero balance and no transactions', async () => {
    const box = await createBox('Tesouro Direto')
    await deleteBox(box.id)
    expect(await listBoxes()).toHaveLength(0)
  })

  it('deletes box and its transactions when deposits equal withdrawals', async () => {
    const box = await createBox('Tesouro Direto')
    await seedDeposit(box.id, 500)
    await seedWithdrawal(box.id, 500)

    await deleteBox(box.id)

    expect(await listBoxes()).toHaveLength(0)
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
