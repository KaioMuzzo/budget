import { afterEach, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'

afterEach(async () => {
  await prisma.transaction.deleteMany()
  await prisma.investmentBox.deleteMany()
  await prisma.category.deleteMany()
  await prisma.budgetConfig.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})
