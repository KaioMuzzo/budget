import { describe, it, expect, beforeEach } from 'vitest'
import { getSummary, getComparison, getHistory, getByCategory, getRecentTransactions, getPockets } from './dashboard.service'
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

const APR = { month: 4, year: 2026 }
const MAR = { month: 3, year: 2026 }

function d(dateStr: string) {
  return new Date(dateStr)
}

async function createExpense(amount: number, date: string, catId = categoryId) {
  return prisma.transaction.create({
    data: { description: 'Teste', amount, type: 'EXPENSE', date: d(date), category_id: catId },
  })
}

async function createIncome(amount: number, date: string) {
  return prisma.transaction.create({
    data: { description: 'Teste', amount, type: 'INCOME', date: d(date), category_id: categoryId },
  })
}

async function createDeposit(amount: number, date: string) {
  return prisma.transaction.create({
    data: { description: 'Aporte', amount, type: 'INVESTMENT', sub_type: 'DEPOSIT', date: d(date), box_id: boxId },
  })
}

// ─── getSummary ───────────────────────────────────────────────────────────────

describe('getSummary', () => {
  it('returns zeroed summary when no transactions', async () => {
    const result = await getSummary(APR.month, APR.year)
    expect(result).toEqual({ income: '0.00', expense: '0.00', investment: '0.00', balance: '0.00' })
  })

  it('sums income, expense and investment correctly', async () => {
    await createIncome(5000, '2026-04-01')
    await createExpense(1500, '2026-04-10')
    await createDeposit(800, '2026-04-15')

    const result = await getSummary(APR.month, APR.year)
    expect(result.income).toBe('5000.00')
    expect(result.expense).toBe('1500.00')
    expect(result.investment).toBe('800.00')
    expect(result.balance).toBe('2700.00') // 5000 - 1500 - 800
  })

  it('ignores transactions from other months', async () => {
    await createIncome(3000, '2026-03-15')
    await createIncome(5000, '2026-04-01')

    const result = await getSummary(APR.month, APR.year)
    expect(result.income).toBe('5000.00')
  })
})

// ─── getComparison ────────────────────────────────────────────────────────────

describe('getComparison', () => {
  it('omits field when previous month has no data', async () => {
    await createIncome(5000, '2026-04-01')
    const result = await getComparison(APR.month, APR.year)
    expect(result.income).toBeUndefined()
  })

  it('returns positive % when value increased vs previous month', async () => {
    await createIncome(4000, '2026-03-01')
    await createIncome(5000, '2026-04-01')

    const result = await getComparison(APR.month, APR.year)
    expect(result.income).toBe(25) // (5000 - 4000) / 4000 * 100
  })

  it('returns negative % when value decreased vs previous month', async () => {
    await createExpense(2000, '2026-03-01')
    await createExpense(1000, '2026-04-01')

    const result = await getComparison(APR.month, APR.year)
    expect(result.expense).toBe(-50) // (1000 - 2000) / 2000 * 100
  })

  it('handles month boundary correctly (Jan vs Dec previous year)', async () => {
    await createIncome(3000, '2025-12-01')
    await createIncome(4000, '2026-01-01')

    const result = await getComparison(1, 2026)
    expect(result.income).toBe(33) // Math.round((4000 - 3000) / 3000 * 100)
  })
})

// ─── getHistory ───────────────────────────────────────────────────────────────

describe('getHistory', () => {
  it('returns exactly 6 entries', async () => {
    const result = await getHistory(APR.month, APR.year)
    expect(result).toHaveLength(6)
  })

  it('returns entries ordered oldest to newest', async () => {
    const result = await getHistory(APR.month, APR.year)
    expect(result[0].month).toBe('Nov')
    expect(result[5].month).toBe('Abr')
  })

  it('returns zeroed values for months with no data', async () => {
    const result = await getHistory(APR.month, APR.year)
    expect(result[0].income).toBe('0.00')
    expect(result[0].expense).toBe('0.00')
    expect(result[0].investment).toBe('0.00')
  })

  it('reflects correct values for months with data', async () => {
    await createIncome(5000, '2026-04-01')
    await createExpense(2000, '2026-04-10')
    await createIncome(4000, '2026-03-01')

    const result = await getHistory(APR.month, APR.year)
    const apr = result[5]
    const mar = result[4]

    expect(apr.income).toBe('5000.00')
    expect(apr.expense).toBe('2000.00')
    expect(mar.income).toBe('4000.00')
  })

  it('handles year boundary (history of Jan 2026 includes Nov/Dec 2025)', async () => {
    const result = await getHistory(1, 2026)
    expect(result[0].month).toBe('Ago')
    expect(result[0].year).toBe(2025)
    expect(result[5].month).toBe('Jan')
    expect(result[5].year).toBe(2026)
  })
})

// ─── getByCategory ────────────────────────────────────────────────────────────

describe('getByCategory', () => {
  it('returns empty array when no expenses', async () => {
    const result = await getByCategory(APR.month, APR.year)
    expect(result).toEqual([])
  })

  it('returns only EXPENSE transactions', async () => {
    await createIncome(5000, '2026-04-01')
    await createDeposit(800, '2026-04-05')
    await createExpense(300, '2026-04-10')

    const result = await getByCategory(APR.month, APR.year)
    expect(result).toHaveLength(1)
  })

  it('groups by category and sums amounts', async () => {
    await createExpense(200, '2026-04-01')
    await createExpense(300, '2026-04-05')

    const result = await getByCategory(APR.month, APR.year)
    expect(result[0].name).toBe('Alimentação')
    expect(result[0].amount).toBe('500.00')
  })

  it('returns at most 6 categories ordered by amount desc', async () => {
    const amounts = [100, 200, 300, 400, 500, 600, 700]
    for (const amount of amounts) {
      const cat = await prisma.category.create({ data: { name: `Cat ${amount}`, type: 'EXPENSE' } })
      await createExpense(amount, '2026-04-01', cat.id)
    }

    const result = await getByCategory(APR.month, APR.year)
    expect(result).toHaveLength(6)
    expect(Number(result[0].amount)).toBeGreaterThanOrEqual(Number(result[1].amount))
    expect(Number(result[0].amount)).toBe(700)
  })
})

// ─── getRecentTransactions ────────────────────────────────────────────────────

describe('getRecentTransactions', () => {
  it('returns empty array when no transactions', async () => {
    const result = await getRecentTransactions(APR.month, APR.year)
    expect(result).toEqual([])
  })

  it('returns at most 10 transactions', async () => {
    for (let i = 1; i <= 12; i++) {
      await createExpense(100, `2026-04-${String(i).padStart(2, '0')}`)
    }

    const result = await getRecentTransactions(APR.month, APR.year)
    expect(result).toHaveLength(10)
  })

  it('returns transactions ordered by date desc', async () => {
    await createExpense(100, '2026-04-01')
    await createExpense(200, '2026-04-20')

    const result = await getRecentTransactions(APR.month, APR.year)
    expect(result[0].date).toBe('2026-04-20')
    expect(result[1].date).toBe('2026-04-01')
  })

  it('returns only transactions from the requested month', async () => {
    await createExpense(100, '2026-03-15')
    await createExpense(200, '2026-04-10')

    const result = await getRecentTransactions(APR.month, APR.year)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe('200.00')
  })

  it('returns correct shape with category name', async () => {
    await createExpense(150, '2026-04-05')

    const result = await getRecentTransactions(APR.month, APR.year)
    const t = result[0]
    expect(t.id).toBeDefined()
    expect(t.description).toBe('Teste')
    expect(t.amount).toBe('150.00')
    expect(t.type).toBe('EXPENSE')
    expect(t.date).toBe('2026-04-05')
    expect(t.category).toBe('Alimentação')
  })

  it('uses box name as category for investments', async () => {
    await createDeposit(500, '2026-04-10')

    const result = await getRecentTransactions(APR.month, APR.year)
    expect(result[0].category).toBe('Tesouro Direto')
  })
})

// ─── getPockets ───────────────────────────────────────────────────────────────

describe('getPockets', () => {
  it('returns null when no config exists', async () => {
    const result = await getPockets()
    expect(result).toBeNull()
  })

  it('returns computed pocket amounts based on salary', async () => {
    await prisma.budgetConfig.create({
      data: {
        salary: 5000,
        pockets: {
          'Liberdade Financeira': 10,
          'Custos Fixos': 55,
          'Conforto': 10,
          'Metas': 10,
          'Prazeres': 10,
          'Conhecimento': 5,
        },
      },
    })

    const result = await getPockets()
    expect(result).not.toBeNull()
    expect(result!['Custos Fixos']).toEqual({ percent: 55, amount: '2750.00' })
    expect(result!['Conhecimento']).toEqual({ percent: 5, amount: '250.00' })
  })
})
