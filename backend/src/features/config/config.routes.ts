import { Router } from 'express'
import { getConfig, upsertConfig } from './config.controller'

export const configRoutes = Router()

configRoutes.get('/', getConfig)
configRoutes.put('/', upsertConfig)
