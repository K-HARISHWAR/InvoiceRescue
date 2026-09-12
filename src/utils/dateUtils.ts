import { addDays, isWeekend, subDays, format, isValid, parseISO } from 'date-fns';

/**
 * Checks if a given date is a business day (Monday - Friday).
 */
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date);
}

/**
 * Gets the next business day after the given date.
 */
export function getNextBusinessDay(date: Date): Date {
  let nextDate = addDays(date, 1);
  while (!isBusinessDay(nextDate)) {
    nextDate = addDays(nextDate, 1);
  }
  return nextDate;
}

/**
 * Gets the previous business day before the given date.
 */
export function getPreviousBusinessDay(date: Date): Date {
  let prevDate = subDays(date, 1);
  while (!isBusinessDay(prevDate)) {
    prevDate = subDays(prevDate, 1);
  }
  return prevDate;
}

/**
 * Calculates a due date based on payment terms (e.g. Net 30).
 * Optionally applies a weekend policy: 'none' (leave on weekend), 'next' (roll to next business day), 'previous' (roll to previous business day).
 */
export function calculateDueDate(
  invoiceDateStr: string, 
  paymentTermsDays: number, 
  weekendPolicy: 'none' | 'next' | 'previous' = 'next'
): string {
  const invoiceDate = parseISO(invoiceDateStr);
  if (!isValid(invoiceDate)) {
    throw new Error('Invalid invoice date string');
  }

  let dueDate = addDays(invoiceDate, paymentTermsDays);

  if (weekendPolicy !== 'none' && !isBusinessDay(dueDate)) {
    if (weekendPolicy === 'next') {
      dueDate = getNextBusinessDay(dueDate);
    } else if (weekendPolicy === 'previous') {
      dueDate = getPreviousBusinessDay(dueDate);
    }
  }

  // Always return YYYY-MM-DD
  return format(dueDate, 'yyyy-MM-dd');
}
