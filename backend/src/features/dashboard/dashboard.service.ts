import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../lib/prisma'

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function parseDateRange(month: number, year: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt:  new Date(Date.UTC(year, month, 1)),
  }
}

function prevMonth(month: number, year: number): { month: number; year: number } {
  return month === 1
    ? { month: 12, year: year - 1 }
    : { month: month - 1, year }
}

async function fetchSummaryRaw(month: number, year: number) {
  const dateFilter = parseDateRange(month, year)

  // YIELD is intentionally excluded — it's not money leaving the account
  const [incomeAgg, expenseAgg, depositAgg, withdrawalAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: { date: dateFilter, type: 'INCOME' },                             _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { date: dateFilter, type: 'EXPENSE' },                            _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { date: dateFilter, type: 'INVESTMENT', sub_type: 'DEPOSIT' },    _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { date: dateFilter, type: 'INVESTMENT', sub_type: 'WITHDRAWAL' }, _sum: { amount: true } }),
  ])

  const income      = incomeAgg._sum.amount      ?? new Prisma.Decimal(0)
  const expense     = expenseAgg._sum.amount     ?? new Prisma.Decimal(0)
  const deposits    = depositAgg._sum.amount    ?? new Prisma.Decimal(0)
  const withdrawals = withdrawalAgg._sum.amount ?? new Prisma.Decimal(0)
  const investment  = new Prisma.Decimal(deposits).sub(withdrawals)

  return { income, expense, investment }
}

export async function getSummary(month: number, year: number) {
  const [{ income, expense, investment }, config] = await Promise.all([
    fetchSummaryRaw(month, year),
    prisma.budgetConfig.findFirst({ select: { initial_balance: true } }),
  ])

  const configInitialBalance = config?.initial_balance ?? new Prisma.Decimal(0)
  const balance = new Prisma.Decimal(configInitialBalance).add(income).sub(expense).sub(investment)

  return {
    income:     income.toFixed(2),
    expense:    expense.toFixed(2),
    investment: investment.toFixed(2),
    balance:    balance.toFixed(2),
  }
}

export async function getComparison(month: number, year: number) {
  const prev = prevMonth(month, year)

  const [curr, past] = await Promise.all([
    fetchSummaryRaw(month, year),
    fetchSummaryRaw(prev.month, prev.year),
  ])

  function pctChange(current: Prisma.Decimal, previous: Prisma.Decimal): number | null {
    if (previous.isZero()) return null
    return Math.round(current.sub(previous).div(previous).mul(100).toNumber())
  }

  const result: Record<string, number> = {}
  const incomeChange     = pctChange(curr.income,     past.income)
  const expenseChange    = pctChange(curr.expense,    past.expense)
  const investmentChange = pctChange(curr.investment, past.investment)

  if (incomeChange     !== null) result.income     = incomeChange
  if (expenseChange    !== null) result.expense    = expenseChange
  if (investmentChange !== null) result.investment = investmentChange

  return result
}

export async function getHistory(month: number, year: number) {
  const months: { month: number; year: number }[] = []
  let m = month, y = year

  for (let i = 0; i < 6; i++) {
    months.unshift({ month: m, year: y })
    const p = prevMonth(m, y)
    m = p.month
    y = p.year
  }

  return Promise.all(
    months.map(async ({ month: mo, year: yr }) => {
      const { income, expense, investment } = await fetchSummaryRaw(mo, yr)
      return {
        month:      MONTH_LABELS[mo - 1],
        year:       yr,
        income:     income.toFixed(2),
        expense:    expense.toFixed(2),
        investment: investment.toFixed(2),
      }
    })
  )
}

export async function getByCategory(month: number, year: number) {
  const dateFilter = parseDateRange(month, year)

  const rows = await prisma.transaction.groupBy({
    by: ['category_id'],
    where: { date: dateFilter, type: 'EXPENSE' },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 6,
  })

  const categoryIds = rows
    .map(r => r.category_id)
    .filter((id): id is number => id !== null)

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  })

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]))

  return rows.map(r => ({
    name:   r.category_id ? (categoryMap[r.category_id] ?? 'Sem categoria') : 'Sem categoria',
    amount: (r._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
  }))
}

export async function getRecentTransactions(month: number, year: number) {
  const dateFilter = parseDateRange(month, year)

  const rows = await prisma.transaction.findMany({
    where: { date: dateFilter },
    include: {
      category: { select: { name: true } },
      box:      { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: 10,
  })

  return rows.map(t => ({
    id:          t.id,
    description: t.description,
    amount:      t.amount.toFixed(2),
    type:        t.type,
    date:        t.date.toISOString().split('T')[0],
    category:    t.category?.name ?? t.box?.name ?? null,
  }))
}

export async function getPockets() {
  const config = await prisma.budgetConfig.findFirst()
  if (!config) return null

  const pockets = config.pockets as Record<string, number>

  return Object.fromEntries(
    Object.entries(pockets).map(([name, percent]) => [
      name,
      {
        percent,
        amount: config.salary.mul(percent).div(100).toFixed(2),
      },
    ])
  )
}
