/**
 * Unit Tests for Session Service Schedule Parsing
 *
 * Tests the schedule parsing functions used by both client-side
 * and Cloud Functions for session auto-generation.
 */

import { describe, it, expect } from 'vitest';
import { parseScheduleDays, parseScheduleTime } from './sessionService';

describe('sessionService', () => {
  describe('parseScheduleDays', () => {
    it('parses T4, T6 format correctly', () => {
      expect(parseScheduleDays('19:30-21:00 T4, T6')).toEqual([3, 5]);
    });

    it('parses T2, T4, T6 format correctly', () => {
      expect(parseScheduleDays('T2, T4, T6')).toEqual([1, 3, 5]);
    });

    it('parses Thứ 2, Thứ 4 format correctly', () => {
      expect(parseScheduleDays('Thứ 2, Thứ 4')).toEqual([1, 3]);
    });

    it('parses Vietnamese day names (thứ hai, thứ tư)', () => {
      expect(parseScheduleDays('thứ hai, thứ tư')).toEqual([1, 3]);
    });

    it('parses T7 as Saturday (index 6)', () => {
      expect(parseScheduleDays('T7')).toEqual([6]);
    });

    it('parses Chủ nhật as Sunday (index 0)', () => {
      expect(parseScheduleDays('Chủ nhật')).toEqual([0]);
    });

    it('parses CN as Sunday (index 0)', () => {
      expect(parseScheduleDays('CN')).toEqual([0]);
    });

    it('handles mixed formats', () => {
      // T4 and thứ 6 should both be parsed
      expect(parseScheduleDays('T4, thứ 6')).toEqual([3, 5]);
    });

    it('handles standalone numbers as fallback', () => {
      expect(parseScheduleDays('2, 4, 6')).toEqual([1, 3, 5]);
    });

    it('returns empty array for empty schedule', () => {
      expect(parseScheduleDays('')).toEqual([]);
    });

    it('returns empty array for unparseable schedule', () => {
      expect(parseScheduleDays('invalid')).toEqual([]);
    });

    it('handles schedule with time prefix', () => {
      expect(parseScheduleDays('18:00-19:30 T3, T5')).toEqual([2, 4]);
    });

    it('handles case insensitive parsing', () => {
      expect(parseScheduleDays('t2, t4')).toEqual([1, 3]);
    });
  });

  describe('parseScheduleTime', () => {
    it('parses HH:MM-HH:MM format', () => {
      expect(parseScheduleTime('18:00-19:30 T2, T4')).toBe('18:00-19:30');
    });

    it('parses Hh-Hh format with minutes', () => {
      expect(parseScheduleTime('19h30-21h00 T4, T6')).toBe('19:30-21:00');
    });

    it('parses time without minutes', () => {
      expect(parseScheduleTime('18h-19h30')).toBe('18:00-19:30');
    });

    it('pads single-digit hours', () => {
      expect(parseScheduleTime('9:00-10:30')).toBe('09:00-10:30');
    });

    it('handles en-dash separator', () => {
      expect(parseScheduleTime('18:00–19:30')).toBe('18:00-19:30');
    });

    it('returns null for schedule without time', () => {
      expect(parseScheduleTime('T2, T4, T6')).toBeNull();
    });

    it('returns null for empty schedule', () => {
      expect(parseScheduleTime('')).toBeNull();
    });
  });
});
