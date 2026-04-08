import { Router } from 'express'
import { getCategories, postCategory, removeCategory } from './categories.controller'

export const categoriesRoutes = Router()

categoriesRoutes.get('/', getCategories)
categoriesRoutes.post('/', postCategory)
categoriesRoutes.delete('/:id', removeCategory)
