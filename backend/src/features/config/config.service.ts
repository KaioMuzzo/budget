import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../middleware/errorHandler'
import { ErrorCode } from '../../constants/errorCodes'

export const POCKET_NAMES = [
  'Liberdade Financeira',
  'Custos Fixos',
  'Conforto',
  'Metas',
  'Prazeres',
  'Conhecimento',
] as const

export type PocketsInput = Record<string, number>
export type PocketsOutput = Record<string, { percent: number; amount: string }>

export type ConfigResponse = {
  salary: string
  pockets: PocketsOutput
  initial_balance: string | null
  updated_at: Date
}

function computePockets(salary: Prisma.Decimal, pockets: PocketsInput): PocketsOutput {
  return Object.fromEntries(
    POCKET_NAMES.map(name => [
      name,
      {
        percent: pockets[name],
        amount: salary.mul(pockets[name]).div(100).toFixed(2),
      },
    ])
  )
}

function validatePockets(pockets: unknown): PocketsInput {
  if (typeof pockets !== 'object' || pockets === null || Array.isArray(pockets)) {
    throw new AppError(ErrorCode.INVALID_POCKETS)
  }

  const input = pockets as Record<string, unknown>

  for (const name of POCKET_NAMES) {
    if (typeof input[name] !== 'number') {
      throw new AppError(ErrorCode.INVALID_POCKETS)
    }
  }

  if (Object.keys(input).length !== POCKET_NAMES.length) {
    throw new AppError(ErrorCode.INVALID_POCKETS)
  }

  const sum = POCKET_NAMES.reduce((acc, name) => acc + (input[name] as number), 0)
  if (Math.round(sum) !== 100) {
    throw new AppError(ErrorCode.POCKETS_MUST_SUM_100)
  }

  return input as PocketsInput
}

export async function fetchConfig(): Promise<ConfigResponse> {
  const config = await prisma.budgetConfig.findFirst()

  if (!config) {
    throw new AppError(ErrorCode.CONFIG_NOT_FOUND)
  }

  return {
    salary: config.salary.toFixed(2),
    pockets: computePockets(config.salary, config.pockets as PocketsInput),
    initial_balance: config.initial_balance?.toFixed(2) ?? null,
    updated_at: config.updated_at,
  }
}

export async function saveConfig(salary: unknown, pockets: unknown, initial_balance?: unknown): Promise<ConfigResponse> {
  if (typeof salary !== 'number' || salary <= 0) {
    throw new AppError(ErrorCode.INVALID_SALARY)
  }

  const validatedPockets = validatePockets(pockets)
  const salaryDecimal = new Prisma.Decimal(salary)

  let validatedInitialBalance: Prisma.Decimal | null = null
  if (initial_balance !== undefined && initial_balance !== null) {
    const n = Number(initial_balance)
    if (isNaN(n) || n < 0) throw new AppError(ErrorCode.TRANSACTION_AMOUNT_INVALID)
    validatedInitialBalance = new Prisma.Decimal(n)
  }

  const existing = await prisma.budgetConfig.findFirst()

  const data = {
    salary: salaryDecimal,
    pockets: validatedPockets,
    ...(initial_balance !== undefined ? { initial_balance: validatedInitialBalance } : {}),
  }

  const config = existing
    ? await prisma.budgetConfig.update({ where: { id: existing.id }, data })
    : await prisma.budgetConfig.create({ data })

  return {
    salary: config.salary.toFixed(2),
    pockets: computePockets(config.salary, validatedPockets),
    initial_balance: config.initial_balance?.toFixed(2) ?? null,
    updated_at: config.updated_at,
  }
}
