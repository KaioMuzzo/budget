import { Router } from 'express'
import { getBoxes, postBox, patchBox, removeBox, getBoxById, getBoxTransactions, removeBoxTransaction } from './investments.controller'

export const investmentsRoutes = Router()

investmentsRoutes.get('/', getBoxes)
investmentsRoutes.post('/', postBox)
investmentsRoutes.get('/:id', getBoxById)
investmentsRoutes.get('/:id/transactions', getBoxTransactions)
investmentsRoutes.patch('/:id', patchBox)
investmentsRoutes.delete('/:boxId/transactions/:txId', removeBoxTransaction)
investmentsRoutes.delete('/:id', removeBox)
