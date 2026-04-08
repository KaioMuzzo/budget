import { Router } from 'express'
import { getDashboard } from './dashboard.controller'

export const dashboardRoutes = Router()

dashboardRoutes.get('/', getDashboard)
