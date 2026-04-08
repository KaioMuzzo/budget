import { describe, it, expect } from 'vitest'
import { fetchConfig, saveConfig } from './config.service'

const validPockets = {
  'Liberdade Financeira': 10,
  'Custos Fixos': 55,
  'Conforto': 10,
  'Metas': 10,
  'Prazeres': 10,
  'Conhecimento': 5,
}

describe('fetchConfig', () => {
  it('throws CONFIG_NOT_FOUND when no config exists', async () => {
    await expect(fetchConfig()).rejects.toMatchObject({ code: 'CONFIG_NOT_FOUND' })
  })

  it('returns config with computed pocket amounts', async () => {
    await saveConfig(5000, validPockets)
    const config = await fetchConfig()

    expect(config.salary).toBe('5000.00')
    expect(config.pockets['Custos Fixos']).toEqual({ percent: 55, amount: '2750.00' })
    expect(config.pockets['Conhecimento']).toEqual({ percent: 5, amount: '250.00' })
  })
})

describe('saveConfig', () => {
  it('creates config when none exists', async () => {
    const config = await saveConfig(3000, validPockets)
    expect(config.salary).toBe('3000.00')
  })

  it('updates existing config on second call', async () => {
    await saveConfig(3000, validPockets)
    const updated = await saveConfig(6000, validPockets)
    expect(updated.salary).toBe('6000.00')
  })

  it('throws INVALID_SALARY for zero', async () => {
    await expect(saveConfig(0, validPockets)).rejects.toMatchObject({ code: 'INVALID_SALARY' })
  })

  it('throws INVALID_SALARY for negative value', async () => {
    await expect(saveConfig(-100, validPockets)).rejects.toMatchObject({ code: 'INVALID_SALARY' })
  })

  it('throws INVALID_SALARY for non-number', async () => {
    await expect(saveConfig('abc', validPockets)).rejects.toMatchObject({ code: 'INVALID_SALARY' })
  })

  it('throws INVALID_POCKETS when a pocket is missing', async () => {
    const { Conhecimento: _, ...incomplete } = validPockets
    await expect(saveConfig(5000, incomplete)).rejects.toMatchObject({ code: 'INVALID_POCKETS' })
  })

  it('throws INVALID_POCKETS when pockets is not an object', async () => {
    await expect(saveConfig(5000, 'invalid')).rejects.toMatchObject({ code: 'INVALID_POCKETS' })
  })

  it('throws POCKETS_MUST_SUM_100 when sum is wrong', async () => {
    const wrong = { ...validPockets, 'Conhecimento': 10 }
    await expect(saveConfig(5000, wrong)).rejects.toMatchObject({ code: 'POCKETS_MUST_SUM_100' })
  })
})
