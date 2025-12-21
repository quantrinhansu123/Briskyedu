/**
 * Firestore Utilities
 * Common utilities for Firestore data conversion
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Convert Firestore Timestamp or Date to ISO string
 */
export const convertTimestamp = (value: unknown): string => {
  if (!value) return '';

  // Firestore Timestamp
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  // Has toDate method (Timestamp-like)
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const dateValue = (value as { toDate: () => Date }).toDate();
    return dateValue.toISOString();
  }

  // Already a string
  if (typeof value === 'string') {
    return value;
  }

  // Date object
  if (value instanceof Date) {
    return value.toISOString();
  }

  return '';
};

/**
 * Convert to date-only string (YYYY-MM-DD)
 */
export const convertTimestampToDate = (value: unknown): string => {
  const iso = convertTimestamp(value);
  return iso ? iso.split('T')[0] : '';
};

/**
 * Convert to readable Vietnamese date format
 */
export const formatVietnameseDate = (value: unknown): string => {
  const iso = convertTimestamp(value);
  if (!iso) return '';

  const date = new Date(iso);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};
