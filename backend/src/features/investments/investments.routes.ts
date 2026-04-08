import { Router } from 'express'
import { getBoxes, postBox, patchBox, removeBox, getBoxTransactions } from './investments.controller'

export const investmentsRoutes = Router()

investmentsRoutes.get('/', getBoxes)
investmentsRoutes.post('/', postBox)
investmentsRoutes.get('/:id/transactions', getBoxTransactions)
investmentsRoutes.patch('/:id', patchBox)
investmentsRoutes.delete('/:id', removeBox)
