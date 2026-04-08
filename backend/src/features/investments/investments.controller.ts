import { Request, Response, NextFunction } from 'express'
import { listBoxes, createBox, updateBox, deleteBox, listBoxTransactions } from './investments.service'

export async function getBoxes(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listBoxes())
  } catch (err) {
    next(err)
  }
}

export async function postBox(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await createBox(req.body.name))
  } catch (err) {
    next(err)
  }
}

export async function patchBox(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await updateBox(Number(req.params.id), req.body.name))
  } catch (err) {
    next(err)
  }
}

export async function getBoxTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listBoxTransactions(Number(req.params.id)))
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
