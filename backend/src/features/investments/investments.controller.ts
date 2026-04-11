import { Request, Response, NextFunction } from 'express'
import { listBoxes, createBox, updateBox, getBox, deleteBox, listBoxTransactions, deleteBoxTransaction, registerYield } from './investments.service'

export async function getBoxes(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listBoxes())
  } catch (err) {
    next(err)
  }
}

export async function getBoxById(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getBox(Number(req.params.id)))
  } catch (err) {
    next(err)
  }
}

export async function postBox(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await createBox(req.body.name, req.body.goal, req.body.initial_balance))
  } catch (err) {
    next(err)
  }
}

export async function patchBox(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await updateBox(Number(req.params.id), req.body.name, req.body.goal, req.body.initial_balance))
  } catch (err) {
    next(err)
  }
}

export async function postYield(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await registerYield(Number(req.params.id), req.body.current_value, req.body.date))
  } catch (err) {
    next(err)
  }
}

export async function getBoxTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listBoxTransactions(Number(req.params.id), req.query.month as string | undefined))
  } catch (err) {
    next(err)
  }
}

export async function removeBoxTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteBoxTransaction(Number(req.params.boxId), Number(req.params.txId))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function removeBox(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteBox(Number(req.params.id))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
