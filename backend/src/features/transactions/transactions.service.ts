import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../middleware/errorHandler'
import { ErrorCode } from '../../constants/errorCodes'

type TransactionType = 'INCOME' | 'EXPENSE' | 'INVESTMENT'
type SubType = 'DEPOSIT' | 'WITHDRAWAL'

type TransactionRow = {
  id: number
  description: string
  amount: string
  type: TransactionType
  sub_type: SubType | null
  date: Date
  created_at: Date
  category_id: number | null
  category_name: string | null
  box_id: number | null
  box_name: string | null
}

type TransactionSummary = {
  income: string
  expense: string
  investment: string
  balance: string
}

type ListTransactionsResult = {
  transactions: TransactionRow[]
  summary: TransactionSummary
}

function parseDateRange(month: number, year: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  }
}

function validateType(type: unknown): TransactionType {
  if (type !== 'INCOME' && type !== 'EXPENSE' && type !== 'INVESTMENT') {
    throw new AppError(ErrorCode.TRANSACTION_TYPE_INVALID)
  }
  return type
}

function validateSubType(sub_type: unknown): SubType {
  if (sub_type !== 'DEPOSIT' && sub_type !== 'WITHDRAWAL') {
    throw new AppError(ErrorCode.SUB_TYPE_REQUIRED)
  }
  return sub_type
}

function validateAmount(amount: unknown): number {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new AppError(ErrorCode.TRANSACTION_AMOUNT_INVALID)
  }
  return amount
}

function validateDescription(description: unknown): string {
  if (typeof description !== 'string' || description.trim() === '') {
    throw new AppError(ErrorCode.TRANSACTION_DESCRIPTION_REQUIRED)
  }
  return description.trim()
}

function validateDate(date: unknown): Date {
  const parsed = new Date(date as string)
  if (isNaN(parsed.getTime())) {
    throw new AppError(ErrorCode.TRANSACTION_DATE_INVALID)
  }
  return parsed
}

async function validateCategoryExists(category_id: unknown): Promise<number> {
  if (typeof category_id !== 'number') {
    throw new AppError(ErrorCode.TRANSACTION_CATEGORY_REQUIRED)
  }
  const category = await prisma.category.findUnique({ where: { id: category_id } })
  if (!category) {
    throw new AppError(ErrorCode.CATEGORY_NOT_FOUND)
  }
  return category_id
}

async function validateBoxExists(box_id: unknown): Promise<number> {
  if (typeof box_id !== 'number') {
    throw new AppError(ErrorCode.BOX_REQUIRED_FOR_INVESTMENT)
  }
  const box = await prisma.investmentBox.findUnique({ where: { id: box_id } })
  if (!box) {
    throw new AppError(ErrorCode.BOX_NOT_FOUND)
  }
  return box_id
}

async function checkSufficientBalance(boxId: number, amount: number, excludeTransactionId?: number): Promise<void> {
  const where = { box_id: boxId, type: 'INVESTMENT' as const }
  const excludeFilter = excludeTransactionId ? { NOT: { id: excludeTransactionId } } : {}

  const [depositAgg, withdrawalAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: { ...where, ...excludeFilter, sub_type: 'DEPOSIT' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...where, ...excludeFilter, sub_type: 'WITHDRAWAL' }, _sum: { amount: true } }),
  ])

  const deposits = depositAgg._sum.amount ?? new Prisma.Decimal(0)
  const withdrawals = withdrawalAgg._sum.amount ?? new Prisma.Decimal(0)
  const balance = new Prisma.Decimal(deposits).sub(withdrawals)

  if (new Prisma.Decimal(amount).gt(balance)) {
    throw new AppError(ErrorCode.INSUFFICIENT_BALANCE)
  }
}

export async function listTransactions(month: number, year: number): Promise<ListTransactionsResult> {
  const dateFilter = parseDateRange(month, year)

  const [rows, incomeAgg, expenseAgg, depositAgg, withdrawalAgg] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: dateFilter },
      include: {
        category: { select: { name: true } },
        box: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.transaction.aggregate({
      where: { date: dateFilter, type: 'INCOME' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { date: dateFilter, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { date: dateFilter, type: 'INVESTMENT', sub_type: 'DEPOSIT' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { date: dateFilter, type: 'INVESTMENT', sub_type: 'WITHDRAWAL' },
      _sum: { amount: true },
    }),
  ])

  const income = incomeAgg._sum.amount ?? new Prisma.Decimal(0)
  const expense = expenseAgg._sum.amount ?? new Prisma.Decimal(0)
  const deposits = depositAgg._sum.amount ?? new Prisma.Decimal(0)
  const withdrawals = withdrawalAgg._sum.amount ?? new Prisma.Decimal(0)
  const investment = new Prisma.Decimal(deposits).sub(withdrawals)
  const balance = new Prisma.Decimal(income).sub(expense).sub(investment)

  return {
    transactions: rows.map(t => ({
      id: t.id,
      description: t.description,
      amount: t.amount.toFixed(2),
      type: t.type as TransactionType,
      sub_type: t.sub_type as SubType | null,
      date: t.date,
      created_at: t.created_at,
      category_id: t.category_id,
      category_name: t.category?.name ?? null,
      box_id: t.box_id,
      box_name: t.box?.name ?? null,
    })),
    summary: {
      income: income.toFixed(2),
      expense: expense.toFixed(2),
      investment: investment.toFixed(2),
      balance: balance.toFixed(2),
    },
  }
}

export async function createTransaction(
  description: unknown,
  amount: unknown,
  type: unknown,
  date: unknown,
  category_id: unknown,
  sub_type: unknown,
  box_id: unknown,
) {
  const validDescription = validateDescription(description)
  const validAmount = validateAmount(amount)
  const validType = validateType(type)
  const validDate = validateDate(date)

  let validCategoryId: number | null = null
  let validSubType: SubType | null = null
  let validBoxId: number | null = null

  if (validType === 'INVESTMENT') {
    validSubType = validateSubType(sub_type)
    validBoxId = await validateBoxExists(box_id)
    if (validSubType === 'WITHDRAWAL') {
      await checkSufficientBalance(validBoxId, validAmount)
    }
  } else {
    validCategoryId = await validateCategoryExists(category_id)
  }

  const transaction = await prisma.transaction.create({
    data: {
      description: validDescription,
      amount: new Prisma.Decimal(validAmount),
      type: validType,
      date: validDate,
      category_id: validCategoryId,
      sub_type: validSubType,
      box_id: validBoxId,
    },
    include: {
      category: { select: { name: true } },
      box: { select: { name: true } },
    },
  })

  return {
    id: transaction.id,
    description: transaction.description,
    amount: transaction.amount.toFixed(2),
    type: transaction.type as TransactionType,
    sub_type: transaction.sub_type as SubType | null,
    date: transaction.date,
    created_at: transaction.created_at,
    category_id: transaction.category_id,
    category_name: transaction.category?.name ?? null,
    box_id: transaction.box_id,
    box_name: transaction.box?.name ?? null,
  }
}

export async function updateTransaction(
  id: number,
  body: {
    description?: unknown
    amount?: unknown
    type?: unknown
    date?: unknown
    category_id?: unknown
    sub_type?: unknown
    box_id?: unknown
  }
) {
  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing) throw new AppError(ErrorCode.TRANSACTION_NOT_FOUND)

  const data: Prisma.TransactionUpdateInput = {}

  if (body.description !== undefined) data.description = validateDescription(body.description)
  if (body.amount !== undefined) data.amount = new Prisma.Decimal(validateAmount(body.amount))
  if (body.date !== undefined) data.date = validateDate(body.date)
  if (body.type !== undefined) data.type = validateType(body.type)

  const finalType = ((data.type as string) ?? existing.type) as TransactionType

  if (finalType === 'INVESTMENT') {
    if (body.sub_type !== undefined) data.sub_type = validateSubType(body.sub_type)
    if (body.box_id !== undefined) {
      data.box = { connect: { id: await validateBoxExists(body.box_id) } }
    }
    // Switching from non-investment: require both fields
    if (existing.type !== 'INVESTMENT') {
      if (data.sub_type === undefined) throw new AppError(ErrorCode.SUB_TYPE_REQUIRED)
      if (!data.box) throw new AppError(ErrorCode.BOX_REQUIRED_FOR_INVESTMENT)
      data.category = { disconnect: true }
    }
    // Check balance for withdrawal
    const finalSubType = (data.sub_type as string ?? existing.sub_type) as SubType
    if (finalSubType === 'WITHDRAWAL') {
      const finalBoxId = body.box_id !== undefined
        ? await validateBoxExists(body.box_id)
        : existing.box_id!
      const finalAmount = data.amount ? Number(data.amount) : Number(existing.amount)
      await checkSufficientBalance(finalBoxId, finalAmount, id)
    }
  } else {
    if (body.category_id !== undefined) {
      data.category = { connect: { id: await validateCategoryExists(body.category_id) } }
    }
    // Switching from investment: require category
    if (existing.type === 'INVESTMENT') {
      if (!data.category) throw new AppError(ErrorCode.TRANSACTION_CATEGORY_REQUIRED)
      data.box = { disconnect: true }
      data.sub_type = null
    }
  }

  const transaction = await prisma.transaction.update({
    where: { id },
    data,
    include: {
      category: { select: { name: true } },
      box: { select: { name: true } },
    },
  })

  return {
    id: transaction.id,
    description: transaction.description,
    amount: transaction.amount.toFixed(2),
    type: transaction.type as TransactionType,
    sub_type: transaction.sub_type as SubType | null,
    date: transaction.date,
    created_at: transaction.created_at,
    category_id: transaction.category_id,
    category_name: transaction.category?.name ?? null,
    box_id: transaction.box_id,
    box_name: transaction.box?.name ?? null,
  }
}

export async function deleteTransaction(id: number) {
  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing) throw new AppError(ErrorCode.TRANSACTION_NOT_FOUND)

  await prisma.transaction.delete({ where: { id } })
}
