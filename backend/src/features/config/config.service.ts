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
    updated_at: config.updated_at,
  }
}

export async function saveConfig(salary: unknown, pockets: unknown): Promise<ConfigResponse> {
  if (typeof salary !== 'number' || salary <= 0) {
    throw new AppError(ErrorCode.INVALID_SALARY)
  }

  const validatedPockets = validatePockets(pockets)
  const salaryDecimal = new Prisma.Decimal(salary)

  const existing = await prisma.budgetConfig.findFirst()

  const config = existing
    ? await prisma.budgetConfig.update({
        where: { id: existing.id },
        data: { salary: salaryDecimal, pockets: validatedPockets },
      })
    : await prisma.budgetConfig.create({
        data: { salary: salaryDecimal, pockets: validatedPockets },
      })

  return {
    salary: config.salary.toFixed(2),
    pockets: computePockets(config.salary, validatedPockets),
    updated_at: config.updated_at,
  }
}
