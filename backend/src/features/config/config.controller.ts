import { Request, Response, NextFunction } from 'express'
import { fetchConfig, saveConfig } from './config.service'

export async function getConfig(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await fetchConfig())
  } catch (err) {
    next(err)
  }
}

export async function upsertConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const { salary, pockets, initial_balance } = req.body
    res.json(await saveConfig(salary, pockets, initial_balance))
  } catch (err) {
    next(err)
  }
}
