import { Request, Response, NextFunction } from 'express'
import { listTransactions, createTransaction, updateTransaction, deleteTransaction } from './transactions.service'

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1
    const year = Number(req.query.year) || new Date().getFullYear()
    res.json(await listTransactions(month, year))
  } catch (err) {
    next(err)
  }
}

export async function postTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { description, amount, type, date, category_id, sub_type, box_id } = req.body
    res.status(201).json(await createTransaction(description, amount, type, date, category_id, sub_type, box_id))
  } catch (err) {
    next(err)
  }
}

export async function patchTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await updateTransaction(Number(req.params.id), req.body))
  } catch (err) {
    next(err)
  }
}

export async function removeTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteTransaction(Number(req.params.id))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
