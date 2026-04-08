import { Router } from 'express'
import { configRoutes } from './features/config/config.routes'
import { categoriesRoutes } from './features/categories/categories.routes'
import { transactionsRoutes } from './features/transactions/transactions.routes'
import { investmentsRoutes } from './features/investments/investments.routes'
import { dashboardRoutes } from './features/dashboard/dashboard.routes'

export const router = Router()

router.use('/config', configRoutes)
router.use('/categories', categoriesRoutes)
router.use('/transactions', transactionsRoutes)
router.use('/investments', investmentsRoutes)
router.use('/dashboard', dashboardRoutes)
