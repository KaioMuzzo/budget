import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../middleware/errorHandler'
import { ErrorCode } from '../../constants/errorCodes'

function validateName(name: unknown): string {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new AppError(ErrorCode.BOX_NAME_REQUIRED)
  }
  return name.trim()
}

type Delta = { amount: string; direction: 'up' | 'down' | 'neutral' }
type BoxData = { balance: string; delta: Delta; spark: string[] }

async function calculateBoxData(boxId: number): Promise<BoxData> {
  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const txs = await prisma.transaction.findMany({
    where: { box_id: boxId, type: 'INVESTMENT' },
    select: { sub_type: true, amount: true, date: true },
  })

  // Balance total
  let balance = new Prisma.Decimal(0)
  for (const tx of txs) {
    if (tx.sub_type === 'DEPOSIT') balance = balance.add(tx.amount)
    else if (tx.sub_type === 'WITHDRAWAL') balance = balance.sub(tx.amount)
  }

  // Delta (this month)
  let delta = new Prisma.Decimal(0)
  for (const tx of txs) {
    if (new Date(tx.date) >= startOfMonth) {
      if (tx.sub_type === 'DEPOSIT') delta = delta.add(tx.amount)
      else if (tx.sub_type === 'WITHDRAWAL') delta = delta.sub(tx.amount)
    }
  }

  // Spark: cumulative balance at end of each of last 6 months
  const spark: string[] = []
  for (let i = 5; i >= 0; i--) {
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0, 23, 59, 59, 999))
    let monthBalance = new Prisma.Decimal(0)
    for (const tx of txs) {
      if (new Date(tx.date) <= endOfMonth) {
        if (tx.sub_type === 'DEPOSIT') monthBalance = monthBalance.add(tx.amount)
        else if (tx.sub_type === 'WITHDRAWAL') monthBalance = monthBalance.sub(tx.amount)
      }
    }
    spark.push(monthBalance.toFixed(2))
  }

  const direction = delta.greaterThan(0) ? 'up' : delta.lessThan(0) ? 'down' : ('neutral' as const)

  return {
    balance: balance.toFixed(2),
    delta: { amount: delta.abs().toFixed(2), direction },
    spark,
  }
}

const EMPTY_BOX_DATA: BoxData = {
  balance: '0.00',
  delta: { amount: '0.00', direction: 'neutral' },
  spark: ['0.00', '0.00', '0.00', '0.00', '0.00', '0.00'],
}

export async function listBoxes() {
  const boxes = await prisma.investmentBox.findMany({ orderBy: { created_at: 'asc' } })

  const lastMovement = await prisma.transaction.findFirst({
    where: { type: 'INVESTMENT' },
    orderBy: { date: 'desc' },
    include: { box: { select: { name: true } } },
  })

  const boxesWithData = await Promise.all(
    boxes.map(async box => {
      const { balance, delta, spark } = await calculateBoxData(box.id)
      return { id: box.id, name: box.name, balance, delta, spark, created_at: box.created_at }
    })
  )

  return {
    boxes: boxesWithData,
    last_movement: lastMovement
      ? {
          date: lastMovement.date,
          description: lastMovement.description,
          sub_type: lastMovement.sub_type,
          amount: lastMovement.amount.toFixed(2),
          box_name: lastMovement.box?.name ?? null,
        }
      : null,
  }
}

export async function createBox(name: unknown) {
  const validName = validateName(name)
  const box = await prisma.investmentBox.create({ data: { name: validName } })
  return { id: box.id, name: box.name, ...EMPTY_BOX_DATA, created_at: box.created_at }
}

export async function updateBox(id: number, name: unknown) {
  const existing = await prisma.investmentBox.findUnique({ where: { id } })
  if (!existing) throw new AppError(ErrorCode.BOX_NOT_FOUND)
  const validName = validateName(name)
  const box = await prisma.investmentBox.update({ where: { id }, data: { name: validName } })
  const { balance, delta, spark } = await calculateBoxData(id)
  return { id: box.id, name: box.name, balance, delta, spark, created_at: box.created_at }
}

export async function listBoxTransactions(id: number) {
  const existing = await prisma.investmentBox.findUnique({ where: { id } })
  if (!existing) throw new AppError(ErrorCode.BOX_NOT_FOUND)

  const txs = await prisma.transaction.findMany({
    where: { box_id: id },
    orderBy: { date: 'desc' },
  })

  return txs.map(t => ({
    id: t.id,
    description: t.description,
    sub_type: t.sub_type,
    amount: t.amount.toFixed(2),
    date: t.date,
    created_at: t.created_at,
  }))
}

export async function deleteBox(id: number) {
  const existing = await prisma.investmentBox.findUnique({ where: { id } })
  if (!existing) throw new AppError(ErrorCode.BOX_NOT_FOUND)
  const { balance } = await calculateBoxData(id)
  if (!new Prisma.Decimal(balance).equals(0)) throw new AppError(ErrorCode.BOX_HAS_BALANCE)
  await prisma.transaction.deleteMany({ where: { box_id: id } })
  await prisma.investmentBox.delete({ where: { id } })
}
