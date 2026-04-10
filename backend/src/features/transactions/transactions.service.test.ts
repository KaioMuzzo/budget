import { describe, it, expect, beforeEach } from 'vitest'
import { listTransactions, createTransaction, updateTransaction, deleteTransaction } from './transactions.service'
import { prisma } from '../../lib/prisma'

let categoryId: number
let boxId: number

beforeEach(async () => {
  const category = await prisma.category.create({
    data: { name: 'Alimentação', type: 'EXPENSE' },
  })
  categoryId = category.id

  const box = await prisma.investmentBox.create({ data: { name: 'Tesouro Direto' } })
  boxId = box.id
})

const APR_2026 = { month: 4, year: 2026 }

async function createExpense(amount: number, date: string) {
  return createTransaction('Teste', amount, 'EXPENSE', date, categoryId, null, null)
}

async function createIncome(amount: number, date: string) {
  return createTransaction('Teste', amount, 'INCOME', date, categoryId, null, null)
}

async function createDeposit(amount: number, date: string, targetBoxId = boxId) {
  return createTransaction('Aporte', amount, 'INVESTMENT', date, null, 'DEPOSIT', targetBoxId)
}

async function createWithdrawal(amount: number, date: string, targetBoxId = boxId) {
  return createTransaction('Resgate', amount, 'INVESTMENT', date, null, 'WITHDRAWAL', targetBoxId)
}

// ─── listTransactions ────────────────────────────────────────────────────────

describe('listTransactions', () => {
  it('returns empty list and zeroed summary when no transactions', async () => {
    const result = await listTransactions(APR_2026.month, APR_2026.year)
    expect(result.transactions).toEqual([])
    expect(result.summary).toEqual({ income: '0.00', expense: '0.00', investment: '0.00', balance: '0.00' })
  })

  it('returns only transactions from the requested month', async () => {
    await createExpense(100, '2026-04-10')
    await createExpense(200, '2026-03-15')

    const result = await listTransactions(APR_2026.month, APR_2026.year)
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].amount).toBe('100.00')
  })

  it('computes summary correctly with income and expenses', async () => {
    await createIncome(5000, '2026-04-01')
    await createExpense(1500, '2026-04-10')
    await createExpense(300, '2026-04-20')

    const result = await listTransactions(APR_2026.month, APR_2026.year)
    expect(result.summary.income).toBe('5000.00')
    expect(result.summary.expense).toBe('1800.00')
    expect(result.summary.investment).toBe('0.00')
    expect(result.summary.balance).toBe('3200.00')
  })

  it('computes investment in summary as deposits minus withdrawals', async () => {
    await createIncome(5000, '2026-04-01')
    await createExpense(1000, '2026-04-10')
    await createDeposit(500, '2026-04-15')
    await createDeposit(200, '2026-04-16')
    await createWithdrawal(100, '2026-04-17')

    const result = await listTransactions(APR_2026.month, APR_2026.year)
    expect(result.summary.investment).toBe('600.00') // 700 - 100
    expect(result.summary.balance).toBe('3400.00')   // 5000 - 1000 - 600
  })

  it('investment summary aggregates across multiple boxes', async () => {
    const box2 = await prisma.investmentBox.create({ data: { name: 'CDB' } })
    await createDeposit(300, '2026-04-01', boxId)
    await createDeposit(200, '2026-04-01', box2.id)

    const result = await listTransactions(APR_2026.month, APR_2026.year)
    expect(result.summary.investment).toBe('500.00')
  })

  it('investment summary is zero when deposits equal withdrawals', async () => {
    await createDeposit(300, '2026-04-01')
    await createWithdrawal(300, '2026-04-02')

    const result = await listTransactions(APR_2026.month, APR_2026.year)
    expect(result.summary.investment).toBe('0.00')
  })

  it('returns transactions ordered by date desc', async () => {
    await createExpense(100, '2026-04-01')
    await createExpense(200, '2026-04-20')

    const result = await listTransactions(APR_2026.month, APR_2026.year)
    expect(Number(result.transactions[0].amount)).toBeGreaterThan(Number(result.transactions[1].amount))
  })

  it('returns category_name and null box fields for income/expense', async () => {
    await createExpense(50, '2026-04-05')

    const result = await listTransactions(APR_2026.month, APR_2026.year)
    const t = result.transactions[0]
    expect(t.category_name).toBe('Alimentação')
    expect(t.category_id).toBe(categoryId)
    expect(t.box_name).toBeNull()
    expect(t.box_id).toBeNull()
    expect(t.sub_type).toBeNull()
  })

  it('returns box_name and null category fields for investment', async () => {
    await createDeposit(100, '2026-04-05')

    const result = await listTransactions(APR_2026.month, APR_2026.year)
    const t = result.transactions[0]
    expect(t.box_name).toBe('Tesouro Direto')
    expect(t.box_id).toBe(boxId)
    expect(t.sub_type).toBe('DEPOSIT')
    expect(t.category_name).toBeNull()
    expect(t.category_id).toBeNull()
  })
})

// ─── createTransaction ───────────────────────────────────────────────────────

describe('createTransaction', () => {
  it('creates an expense with valid data', async () => {
    const t = await createTransaction('Almoço', 35.50, 'EXPENSE', '2026-04-05', categoryId, null, null)
    expect(t.description).toBe('Almoço')
    expect(t.amount).toBe('35.50')
    expect(t.type).toBe('EXPENSE')
    expect(t.category_name).toBe('Alimentação')
    expect(t.box_name).toBeNull()
    expect(t.sub_type).toBeNull()
    expect(t.box_id).toBeNull()
  })

  it('creates an income with valid data', async () => {
    const t = await createTransaction('Salário', 5000, 'INCOME', '2026-04-05', categoryId, null, null)
    expect(t.type).toBe('INCOME')
    expect(t.amount).toBe('5000.00')
    expect(t.category_name).toBe('Alimentação')
    expect(t.box_name).toBeNull()
    expect(t.sub_type).toBeNull()
  })

  it('creates an investment deposit with valid data', async () => {
    const t = await createTransaction('Aporte mensal', 500, 'INVESTMENT', '2026-04-05', null, 'DEPOSIT', boxId)
    expect(t.type).toBe('INVESTMENT')
    expect(t.sub_type).toBe('DEPOSIT')
    expect(t.box_name).toBe('Tesouro Direto')
    expect(t.box_id).toBe(boxId)
    expect(t.amount).toBe('500.00')
    expect(t.category_name).toBeNull()
    expect(t.category_id).toBeNull()
  })

  it('creates an investment withdrawal when balance is sufficient', async () => {
    await createDeposit(1000, '2026-04-01')
    const t = await createWithdrawal(300, '2026-04-05')
    expect(t.type).toBe('INVESTMENT')
    expect(t.sub_type).toBe('WITHDRAWAL')
    expect(t.amount).toBe('300.00')
  })

  it('throws INSUFFICIENT_BALANCE for withdrawal exceeding box balance', async () => {
    await createDeposit(200, '2026-04-01')
    await expect(createWithdrawal(500, '2026-04-05'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })

  it('throws INSUFFICIENT_BALANCE when compound withdrawals exceed deposits', async () => {
    await createDeposit(500, '2026-04-01')
    await createWithdrawal(300, '2026-04-02')
    // remaining balance: 200 — trying to withdraw 300 should fail
    await expect(createWithdrawal(300, '2026-04-03'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })

  it('throws INSUFFICIENT_BALANCE for withdrawal with no deposits', async () => {
    await expect(createWithdrawal(100, '2026-04-05'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })

  it('throws SUB_TYPE_REQUIRED when investment has no sub_type', async () => {
    await expect(createTransaction('Aporte', 100, 'INVESTMENT', '2026-04-05', null, null, boxId))
      .rejects.toMatchObject({ code: 'SUB_TYPE_REQUIRED' })
  })

  it('throws SUB_TYPE_REQUIRED for invalid sub_type string', async () => {
    await expect(createTransaction('Aporte', 100, 'INVESTMENT', '2026-04-05', null, 'INVALID', boxId))
      .rejects.toMatchObject({ code: 'SUB_TYPE_REQUIRED' })
  })

  it('throws BOX_REQUIRED_FOR_INVESTMENT when investment has no box_id', async () => {
    await expect(createTransaction('Aporte', 100, 'INVESTMENT', '2026-04-05', null, 'DEPOSIT', null))
      .rejects.toMatchObject({ code: 'BOX_REQUIRED_FOR_INVESTMENT' })
  })

  it('throws BOX_NOT_FOUND for non-existent box', async () => {
    await expect(createTransaction('Aporte', 100, 'INVESTMENT', '2026-04-05', null, 'DEPOSIT', 999999))
      .rejects.toMatchObject({ code: 'BOX_NOT_FOUND' })
  })

  it('throws TRANSACTION_CATEGORY_REQUIRED when no category_id for income/expense', async () => {
    await expect(createTransaction('Almoço', 50, 'EXPENSE', '2026-04-05', null, null, null))
      .rejects.toMatchObject({ code: 'TRANSACTION_CATEGORY_REQUIRED' })
  })

  it('throws CATEGORY_NOT_FOUND for non-existent category', async () => {
    await expect(createTransaction('Almoço', 50, 'EXPENSE', '2026-04-05', 999999, null, null))
      .rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' })
  })

  it('throws TRANSACTION_DESCRIPTION_REQUIRED for empty description on expense', async () => {
    await expect(createTransaction('', 100, 'EXPENSE', '2026-04-05', categoryId, null, null))
      .rejects.toMatchObject({ code: 'TRANSACTION_DESCRIPTION_REQUIRED' })
  })

  it('throws TRANSACTION_DESCRIPTION_REQUIRED for null description on expense', async () => {
    await expect(createTransaction(null, 100, 'EXPENSE', '2026-04-05', categoryId, null, null))
      .rejects.toMatchObject({ code: 'TRANSACTION_DESCRIPTION_REQUIRED' })
  })

  it('uses "Aporte" as fallback when deposit has no description', async () => {
    const t = await createTransaction(null, 200, 'INVESTMENT', '2026-04-05', null, 'DEPOSIT', boxId)
    expect(t.description).toBe('Aporte')
  })

  it('uses "Resgate" as fallback when withdrawal has no description', async () => {
    await createDeposit(500, '2026-04-01')
    const t = await createTransaction('', 100, 'INVESTMENT', '2026-04-05', null, 'WITHDRAWAL', boxId)
    expect(t.description).toBe('Resgate')
  })

  it('keeps explicit description on investment when provided', async () => {
    const t = await createTransaction('Aporte mensal', 200, 'INVESTMENT', '2026-04-05', null, 'DEPOSIT', boxId)
    expect(t.description).toBe('Aporte mensal')
  })

  it('throws TRANSACTION_AMOUNT_INVALID for zero', async () => {
    await expect(createTransaction('Almoço', 0, 'EXPENSE', '2026-04-05', categoryId, null, null))
      .rejects.toMatchObject({ code: 'TRANSACTION_AMOUNT_INVALID' })
  })

  it('throws TRANSACTION_AMOUNT_INVALID for negative value', async () => {
    await expect(createTransaction('Almoço', -50, 'EXPENSE', '2026-04-05', categoryId, null, null))
      .rejects.toMatchObject({ code: 'TRANSACTION_AMOUNT_INVALID' })
  })

  it('throws TRANSACTION_TYPE_INVALID for unknown type', async () => {
    await expect(createTransaction('Almoço', 50, 'OTHER', '2026-04-05', categoryId, null, null))
      .rejects.toMatchObject({ code: 'TRANSACTION_TYPE_INVALID' })
  })

  it('throws TRANSACTION_DATE_INVALID for invalid date', async () => {
    await expect(createTransaction('Almoço', 50, 'EXPENSE', 'not-a-date', categoryId, null, null))
      .rejects.toMatchObject({ code: 'TRANSACTION_DATE_INVALID' })
  })
})

// ─── updateTransaction ───────────────────────────────────────────────────────

describe('updateTransaction', () => {
  it('updates description', async () => {
    const t = await createExpense(100, '2026-04-05')
    const updated = await updateTransaction(t.id, { description: 'Jantar' })
    expect(updated.description).toBe('Jantar')
  })

  it('updates amount', async () => {
    const t = await createExpense(100, '2026-04-05')
    const updated = await updateTransaction(t.id, { amount: 250 })
    expect(updated.amount).toBe('250.00')
  })

  it('updates date', async () => {
    const t = await createExpense(100, '2026-04-05')
    const updated = await updateTransaction(t.id, { date: '2026-04-20' })
    expect(new Date(updated.date).toISOString().startsWith('2026-04-20')).toBe(true)
  })

  it('updates category', async () => {
    const newCategory = await prisma.category.create({ data: { name: 'Transporte', type: 'EXPENSE' } })
    const t = await createExpense(100, '2026-04-05')
    const updated = await updateTransaction(t.id, { category_id: newCategory.id })
    expect(updated.category_name).toBe('Transporte')
  })

  it('updates type from INCOME to EXPENSE', async () => {
    const t = await createIncome(100, '2026-04-05')
    const updated = await updateTransaction(t.id, { type: 'EXPENSE' })
    expect(updated.type).toBe('EXPENSE')
    expect(updated.sub_type).toBeNull()
    expect(updated.box_id).toBeNull()
  })

  it('switches from expense to investment', async () => {
    const t = await createExpense(100, '2026-04-05')
    const updated = await updateTransaction(t.id, { type: 'INVESTMENT', sub_type: 'DEPOSIT', box_id: boxId })
    expect(updated.type).toBe('INVESTMENT')
    expect(updated.sub_type).toBe('DEPOSIT')
    expect(updated.box_name).toBe('Tesouro Direto')
    expect(updated.category_id).toBeNull()
  })

  it('switches from investment to expense', async () => {
    const t = await createDeposit(100, '2026-04-05')
    const updated = await updateTransaction(t.id, { type: 'EXPENSE', category_id: categoryId })
    expect(updated.type).toBe('EXPENSE')
    expect(updated.sub_type).toBeNull()
    expect(updated.box_id).toBeNull()
    expect(updated.category_name).toBe('Alimentação')
  })

  it('updates sub_type from DEPOSIT to WITHDRAWAL when balance is sufficient', async () => {
    await createDeposit(500, '2026-04-01')
    const deposit = await createDeposit(100, '2026-04-02')
    // balance excluding this transaction: 500 — change it to WITHDRAWAL of 100
    const updated = await updateTransaction(deposit.id, { sub_type: 'WITHDRAWAL' })
    expect(updated.sub_type).toBe('WITHDRAWAL')
  })

  it('throws INSUFFICIENT_BALANCE when changing DEPOSIT to WITHDRAWAL exceeds balance', async () => {
    // no other deposits — only this one exists
    const deposit = await createDeposit(100, '2026-04-01')
    // excluding itself, balance = 0; withdrawal of 100 > 0
    await expect(updateTransaction(deposit.id, { sub_type: 'WITHDRAWAL' }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })

  it('updates withdrawal amount within remaining balance (excludes self)', async () => {
    await createDeposit(500, '2026-04-01')
    const withdrawal = await createWithdrawal(100, '2026-04-02')
    // balance excluding this withdrawal: 500 — can update to 400
    const updated = await updateTransaction(withdrawal.id, { amount: 400 })
    expect(updated.amount).toBe('400.00')
  })

  it('throws INSUFFICIENT_BALANCE when updating withdrawal amount beyond balance', async () => {
    await createDeposit(200, '2026-04-01')
    const withdrawal = await createWithdrawal(100, '2026-04-02')
    await expect(updateTransaction(withdrawal.id, { amount: 500 }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })

  it('throws SUB_TYPE_REQUIRED when switching to investment without sub_type', async () => {
    const t = await createExpense(100, '2026-04-05')
    await expect(updateTransaction(t.id, { type: 'INVESTMENT', box_id: boxId }))
      .rejects.toMatchObject({ code: 'SUB_TYPE_REQUIRED' })
  })

  it('throws BOX_REQUIRED_FOR_INVESTMENT when switching to investment without box_id', async () => {
    const t = await createExpense(100, '2026-04-05')
    await expect(updateTransaction(t.id, { type: 'INVESTMENT', sub_type: 'DEPOSIT' }))
      .rejects.toMatchObject({ code: 'BOX_REQUIRED_FOR_INVESTMENT' })
  })

  it('throws TRANSACTION_CATEGORY_REQUIRED when switching to expense without category', async () => {
    const t = await createDeposit(100, '2026-04-05')
    await expect(updateTransaction(t.id, { type: 'EXPENSE' }))
      .rejects.toMatchObject({ code: 'TRANSACTION_CATEGORY_REQUIRED' })
  })

  it('throws CATEGORY_NOT_FOUND when updating with non-existent category', async () => {
    const t = await createExpense(100, '2026-04-05')
    await expect(updateTransaction(t.id, { category_id: 999999 }))
      .rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' })
  })

  it('throws BOX_NOT_FOUND when updating with non-existent box', async () => {
    const t = await createDeposit(100, '2026-04-05')
    await expect(updateTransaction(t.id, { box_id: 999999 }))
      .rejects.toMatchObject({ code: 'BOX_NOT_FOUND' })
  })

  it('throws TRANSACTION_TYPE_INVALID when updating to invalid type', async () => {
    const t = await createExpense(100, '2026-04-05')
    await expect(updateTransaction(t.id, { type: 'INVALID' }))
      .rejects.toMatchObject({ code: 'TRANSACTION_TYPE_INVALID' })
  })

  it('throws TRANSACTION_NOT_FOUND for non-existent id', async () => {
    await expect(updateTransaction(999999, { description: 'X' }))
      .rejects.toMatchObject({ code: 'TRANSACTION_NOT_FOUND' })
  })

  it('throws TRANSACTION_AMOUNT_INVALID for invalid amount in update', async () => {
    const t = await createExpense(100, '2026-04-05')
    await expect(updateTransaction(t.id, { amount: -10 }))
      .rejects.toMatchObject({ code: 'TRANSACTION_AMOUNT_INVALID' })
  })
})

// ─── deleteTransaction ───────────────────────────────────────────────────────

describe('deleteTransaction', () => {
  it('deletes an existing transaction', async () => {
    const t = await createExpense(100, '2026-04-05')
    await deleteTransaction(t.id)

    const result = await listTransactions(APR_2026.month, APR_2026.year)
    expect(result.transactions).toHaveLength(0)
  })

  it('throws TRANSACTION_NOT_FOUND for non-existent id', async () => {
    await expect(deleteTransaction(999999))
      .rejects.toMatchObject({ code: 'TRANSACTION_NOT_FOUND' })
  })
})
