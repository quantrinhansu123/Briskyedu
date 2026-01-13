/**
 * Role Utilities
 * Utilities for normalizing and checking staff roles
 */

/**
 * Normalize a role/position string by removing diacritics and converting to lowercase
 * This allows matching Vietnamese role names with and without diacritics
 */
export const normalizeRole = (role: string): string => {
  if (!role) return '';
  return role
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .trim();
};

/**
 * Check if a role/position indicates an assistant (trợ giảng) role
 * Handles multiple variations with and without diacritics
 */
export const isAssistantRole = (role: string): boolean => {
  const normalized = normalizeRole(role);
  return (
    normalized.includes('tro giang') ||
    normalized.includes('assistant') ||
    normalized === 'ta' ||
    normalized.includes('teaching assistant')
  );
};

/**
 * Check if a role/position indicates a teacher (giáo viên) role
 */
export const isTeacherRole = (role: string): boolean => {
  const normalized = normalizeRole(role);
  return (
    normalized.includes('giao vien') ||
    normalized.includes('teacher') ||
    normalized === 'gv'
  );
};
