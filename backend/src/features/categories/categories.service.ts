import { prisma } from '../../lib/prisma'
import { TransactionType } from '../../generated/prisma/client'
import { AppError } from '../../middleware/errorHandler'
import { ErrorCode } from '../../constants/errorCodes'

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function createCategory(name: unknown, type: unknown) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new AppError(ErrorCode.CATEGORY_NAME_REQUIRED)
  }

  if (type !== 'INCOME' && type !== 'EXPENSE') {
    throw new AppError(ErrorCode.CATEGORY_TYPE_INVALID)
  }

  return prisma.category.create({
    data: {
      name: name.trim(),
      type: type as TransactionType,
    },
  })
}

export async function deleteCategory(id: number) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { transactions: true } } },
  })

  if (!category) {
    throw new AppError(ErrorCode.CATEGORY_NOT_FOUND)
  }

  if (category._count.transactions > 0) {
    throw new AppError(ErrorCode.CATEGORY_HAS_TRANSACTIONS)
  }

  await prisma.category.delete({ where: { id } })
}
