import { Router } from 'express'
import { getTransactions, postTransaction, patchTransaction, removeTransaction } from './transactions.controller'

export const transactionsRoutes = Router()

transactionsRoutes.get('/', getTransactions)
transactionsRoutes.post('/', postTransaction)
transactionsRoutes.patch('/:id', patchTransaction)
transactionsRoutes.delete('/:id', removeTransaction)
