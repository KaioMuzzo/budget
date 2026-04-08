import { Request, Response, NextFunction } from 'express'
import { getSummary, getComparison, getHistory, getByCategory, getRecentTransactions, getPockets } from './dashboard.service'

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1
    const year  = Number(req.query.year)  || new Date().getFullYear()

    const [summary, comparison, history, byCategory, recentTransactions, pockets] = await Promise.all([
      getSummary(month, year),
      getComparison(month, year),
      getHistory(month, year),
      getByCategory(month, year),
      getRecentTransactions(month, year),
      getPockets(),
    ])

    res.json({ summary, comparison, history, byCategory, recentTransactions, pockets })
  } catch (err) {
    next(err)
  }
}
