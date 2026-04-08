const ERROR_CODES = {
  // Generic
  INTERNAL_ERROR:                { statusCode: 500 },
  VALIDATION_ERROR:              { statusCode: 400 },
  NOT_FOUND:                     { statusCode: 404 },

  // Config
  CONFIG_NOT_FOUND:              { statusCode: 404 },
  INVALID_SALARY:                { statusCode: 400 },
  INVALID_POCKETS:               { statusCode: 400 },
  POCKETS_MUST_SUM_100:          { statusCode: 400 },

  // Categories
  CATEGORY_NOT_FOUND:            { statusCode: 404 },
  CATEGORY_NAME_REQUIRED:        { statusCode: 400 },
  CATEGORY_TYPE_INVALID:         { statusCode: 400 },
  CATEGORY_HAS_TRANSACTIONS:     { statusCode: 409 },

  // Transactions
  TRANSACTION_NOT_FOUND:            { statusCode: 404 },
  TRANSACTION_DESCRIPTION_REQUIRED: { statusCode: 400 },
  TRANSACTION_AMOUNT_INVALID:       { statusCode: 400 },
  TRANSACTION_TYPE_INVALID:         { statusCode: 400 },
  TRANSACTION_DATE_INVALID:         { statusCode: 400 },
  TRANSACTION_CATEGORY_REQUIRED:    { statusCode: 400 },
  SUB_TYPE_REQUIRED:                { statusCode: 400 },
  BOX_REQUIRED_FOR_INVESTMENT:      { statusCode: 400 },
  INSUFFICIENT_BALANCE:             { statusCode: 400 },

  // Investment Boxes
  BOX_NOT_FOUND:           { statusCode: 404 },
  BOX_NAME_REQUIRED:       { statusCode: 400 },
  BOX_HAS_BALANCE:         { statusCode: 409 },
} as const

export type ErrorCodeKey = keyof typeof ERROR_CODES

export const ErrorCode = Object.fromEntries(
  Object.keys(ERROR_CODES).map(k => [k, k])
) as { [K in ErrorCodeKey]: K }

export function getStatusCode(code: ErrorCodeKey): number {
  return ERROR_CODES[code].statusCode
}
