import { Request, Response, NextFunction } from 'express'
import { listCategories, createCategory, deleteCategory } from './categories.service'

export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listCategories())
  } catch (err) {
    next(err)
  }
}

export async function postCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, type } = req.body
    res.status(201).json(await createCategory(name, type))
  } catch (err) {
    next(err)
  }
}

export async function removeCategory(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteCategory(Number(req.params.id))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
