/**
 * Standardized application errors
 */

export type ErrorCode = 
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'INVOICE_NOT_FOUND'
  | 'INVOICE_LOCKED'
  | 'DUPLICATE_INVOICE'
  | 'AI_PARSE_FAILED'
  | 'GMAIL_NOT_CONNECTED'
  | 'PAYMENT_INVALID'
  | 'ENTITY_REQUIRED'
  | 'UNKNOWN_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly originalError?: unknown;

  constructor(code: ErrorCode, message: string, originalError?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Helper to safely extract a user-facing message from unknown errors
 */
export function getErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Avoid showing raw postgres errors directly to users
    if (error.message.includes('relation') || error.message.includes('column') || error.message.includes('syntax')) {
      return fallbackMessage;
    }
    return error.message;
  }
  
  return fallbackMessage;
}
