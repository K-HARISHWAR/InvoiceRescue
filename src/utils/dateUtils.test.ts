import { describe, it, expect } from 'vitest';
import { isBusinessDay, getNextBusinessDay, getPreviousBusinessDay, calculateDueDate } from './dateUtils';

describe('dateUtils - Business Logic Hardening', () => {
  describe('isBusinessDay', () => {
    it('returns true for a Monday', () => {
      expect(isBusinessDay(new Date('2026-09-07T12:00:00Z'))).toBe(true);
    });
    
    it('returns false for a Saturday', () => {
      expect(isBusinessDay(new Date('2026-09-12T12:00:00Z'))).toBe(false);
    });

    it('returns false for a Sunday', () => {
      expect(isBusinessDay(new Date('2026-09-13T12:00:00Z'))).toBe(false);
    });
  });

  describe('getNextBusinessDay', () => {
    it('moves Friday to Monday', () => {
      const friday = new Date('2026-09-11T12:00:00Z');
      const monday = getNextBusinessDay(friday);
      expect(monday.getUTCDay()).toBe(1); // 1 = Monday
      expect(monday.toISOString().startsWith('2026-09-14')).toBe(true);
    });

    it('moves Saturday to Monday', () => {
      const saturday = new Date('2026-09-12T12:00:00Z');
      const monday = getNextBusinessDay(saturday);
      expect(monday.toISOString().startsWith('2026-09-14')).toBe(true);
    });
  });

  describe('getPreviousBusinessDay', () => {
    it('moves Monday to Friday', () => {
      const monday = new Date('2026-09-14T12:00:00Z');
      const friday = getPreviousBusinessDay(monday);
      expect(friday.getUTCDay()).toBe(5); // 5 = Friday
      expect(friday.toISOString().startsWith('2026-09-11')).toBe(true);
    });

    it('moves Sunday to Friday', () => {
      const sunday = new Date('2026-09-13T12:00:00Z');
      const friday = getPreviousBusinessDay(sunday);
      expect(friday.toISOString().startsWith('2026-09-11')).toBe(true);
    });
  });

  describe('calculateDueDate Edge Cases', () => {
    it('handles normal Net 30 correctly', () => {
      // Sept 1 + 30 days = Oct 1 (Thursday)
      const due = calculateDueDate('2026-09-01', 30, 'none');
      expect(due).toBe('2026-10-01');
    });

    it('handles leap years correctly', () => {
      // Feb 1, 2024 (Leap year) + 30 days = March 2 (Saturday)
      const due = calculateDueDate('2024-02-01', 30, 'none');
      expect(due).toBe('2024-03-02');

      // Feb 1, 2023 (Non-leap year) + 30 days = March 3 (Friday)
      const due2 = calculateDueDate('2023-02-01', 30, 'none');
      expect(due2).toBe('2023-03-03');
    });

    it('rolls Saturday due dates to next Monday when policy is next', () => {
      // Oct 1 + 30 days = Oct 31, 2026 (Saturday)
      // Next business day should be Nov 2 (Monday)
      const due = calculateDueDate('2026-10-01', 30, 'next');
      expect(due).toBe('2026-11-02');
    });

    it('rolls Saturday due dates to previous Friday when policy is previous', () => {
      // Oct 1 + 30 days = Oct 31, 2026 (Saturday)
      // Previous business day should be Oct 30 (Friday)
      const due = calculateDueDate('2026-10-01', 30, 'previous');
      expect(due).toBe('2026-10-30');
    });

    it('leaves Saturday due dates alone when policy is none', () => {
      // Oct 1 + 30 days = Oct 31, 2026 (Saturday)
      const due = calculateDueDate('2026-10-01', 30, 'none');
      expect(due).toBe('2026-10-31');
    });

    it('handles end of month rolling (Jan 31 + 30 days = Mar 2)', () => {
      // Jan 31, 2026 + 30 days = March 2, 2026 (Monday)
      const due = calculateDueDate('2026-01-31', 30, 'none');
      expect(due).toBe('2026-03-02');
    });
  });
});
