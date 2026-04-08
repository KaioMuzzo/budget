import { describe, it, expect } from 'vitest'
import { listCategories, createCategory, deleteCategory } from './categories.service'
import { prisma } from '../../lib/prisma'

describe('listCategories', () => {
  it('returns empty array when no categories exist', async () => {
    const result = await listCategories()
    expect(result).toEqual([])
  })

  it('returns categories ordered by name', async () => {
    await createCategory('Salário', 'INCOME')
    await createCategory('Alimentação', 'EXPENSE')

    const result = await listCategories()
    expect(result[0].name).toBe('Alimentação')
    expect(result[1].name).toBe('Salário')
  })
})

describe('createCategory', () => {
  it('creates a category with valid data', async () => {
    const category = await createCategory('Alimentação', 'EXPENSE')
    expect(category.name).toBe('Alimentação')
    expect(category.type).toBe('EXPENSE')
  })

  it('trims whitespace from name', async () => {
    const category = await createCategory('  Transporte  ', 'EXPENSE')
    expect(category.name).toBe('Transporte')
  })

  it('throws CATEGORY_NAME_REQUIRED for empty name', async () => {
    await expect(createCategory('', 'EXPENSE')).rejects.toMatchObject({ code: 'CATEGORY_NAME_REQUIRED' })
  })

  it('throws CATEGORY_NAME_REQUIRED for whitespace-only name', async () => {
    await expect(createCategory('   ', 'EXPENSE')).rejects.toMatchObject({ code: 'CATEGORY_NAME_REQUIRED' })
  })

  it('throws CATEGORY_TYPE_INVALID for unknown type', async () => {
    await expect(createCategory('Alimentação', 'INVALID')).rejects.toMatchObject({ code: 'CATEGORY_TYPE_INVALID' })
  })
})

describe('deleteCategory', () => {
  it('deletes a category with no transactions', async () => {
    const category = await createCategory('Alimentação', 'EXPENSE')
    await deleteCategory(category.id)

    const result = await listCategories()
    expect(result).toEqual([])
  })

  it('throws CATEGORY_NOT_FOUND for non-existent id', async () => {
    await expect(deleteCategory(999999)).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' })
  })

  it('throws CATEGORY_HAS_TRANSACTIONS when category has transactions', async () => {
    const category = await createCategory('Alimentação', 'EXPENSE')

    await prisma.transaction.create({
      data: {
        description: 'Almoço',
        amount: 30,
        type: 'EXPENSE',
        date: new Date(),
        category_id: category.id,
      },
    })

    await expect(deleteCategory(category.id)).rejects.toMatchObject({ code: 'CATEGORY_HAS_TRANSACTIONS' })
  })
})
