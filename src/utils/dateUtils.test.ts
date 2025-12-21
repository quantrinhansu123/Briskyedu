/**
 * Date Utilities Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  formatDateSafe,
  formatDisplayDate,
  formatDisplayDateTime,
  getRelativeTime
} from './dateUtils';

describe('formatDateSafe', () => {
  it('should handle ISO strings', () => {
    expect(formatDateSafe('2023-12-15T10:30:00.000Z')).toBe('2023-12-15');
    expect(formatDateSafe('2023-01-01')).toBe('2023-01-01');
  });

  it('should handle Date objects', () => {
    const date = new Date('2023-12-15T00:00:00Z');
    expect(formatDateSafe(date)).toBe('2023-12-15');
  });

  it('should handle Firestore Timestamp-like objects', () => {
    const timestamp = {
      toDate: () => new Date('2023-12-15T00:00:00Z')
    };
    expect(formatDateSafe(timestamp)).toBe('2023-12-15');
  });

  it('should handle null/undefined', () => {
    expect(formatDateSafe(null)).toBe('');
    expect(formatDateSafe(undefined)).toBe('');
  });

  it('should handle empty string', () => {
    expect(formatDateSafe('')).toBe('');
  });
});

describe('formatDisplayDate', () => {
  it('should format date in Vietnamese locale (DD/MM/YYYY)', () => {
    const result = formatDisplayDate('2023-12-15');
    // Vietnamese locale uses DD/MM/YYYY format
    expect(result).toMatch(/15.*12.*2023/);
  });

  it('should handle Firestore Timestamp', () => {
    const timestamp = {
      toDate: () => new Date('2023-06-20T00:00:00Z')
    };
    const result = formatDisplayDate(timestamp);
    expect(result).toMatch(/20.*6.*2023|20.*06.*2023/);
  });

  it('should return empty for invalid input', () => {
    expect(formatDisplayDate(null)).toBe('');
    expect(formatDisplayDate(undefined)).toBe('');
    expect(formatDisplayDate('')).toBe('');
  });
});

describe('formatDisplayDateTime', () => {
  it('should format datetime with time', () => {
    const result = formatDisplayDateTime('2023-12-15T14:30:00.000Z');
    // Should include both date and time
    expect(result).toMatch(/\d+/); // Should have numbers
    expect(result.length).toBeGreaterThan(8); // Should be longer than just date
  });

  it('should handle Firestore Timestamp', () => {
    const timestamp = {
      toDate: () => new Date('2023-12-15T14:30:00Z')
    };
    const result = formatDisplayDateTime(timestamp);
    expect(result).toMatch(/\d+/);
  });

  it('should return empty for invalid input', () => {
    expect(formatDisplayDateTime(null)).toBe('');
    expect(formatDisplayDateTime(undefined)).toBe('');
  });
});

describe('getRelativeTime', () => {
  it('should return "Vừa xong" for recent times', () => {
    const now = new Date();
    expect(getRelativeTime(now.toISOString())).toBe('Vừa xong');
  });

  it('should return minutes for times within an hour', () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const result = getRelativeTime(thirtyMinsAgo.toISOString());
    expect(result).toMatch(/\d+ phút trước/);
  });

  it('should return hours for times within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const result = getRelativeTime(threeHoursAgo.toISOString());
    expect(result).toMatch(/\d+ giờ trước/);
  });

  it('should return days for times within a week', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const result = getRelativeTime(twoDaysAgo.toISOString());
    expect(result).toMatch(/\d+ ngày trước/);
  });

  it('should return formatted date for older times', () => {
    const oldDate = '2020-01-15';
    const result = getRelativeTime(oldDate);
    expect(result).toMatch(/15.*1.*2020|15.*01.*2020/);
  });

  it('should return empty for invalid input', () => {
    expect(getRelativeTime(null)).toBe('');
    expect(getRelativeTime(undefined)).toBe('');
  });
});
