import { Request, Response, NextFunction } from 'express'
import { ErrorCode, ErrorCodeKey, getStatusCode } from '../constants/errorCodes'

export class AppError extends Error {
  public statusCode: number

  constructor(public code: ErrorCodeKey) {
    super(code)
    this.name = 'AppError'
    this.statusCode = getStatusCode(code)
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.code })
    return
  }

  console.error(err)
  res.status(500).json({ error: 'INTERNAL_ERROR' })
}
