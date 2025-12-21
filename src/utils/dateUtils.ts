/**
 * Date Utilities
 * Safe date formatting for various input types
 */

/**
 * Safely format date values from various sources
 * Handles: ISO strings, Date objects, Firestore Timestamps, undefined
 */
export const formatDateSafe = (dateValue: unknown): string => {
  if (!dateValue) return '';

  try {
    // Firestore Timestamp
    if (typeof dateValue === 'object' && dateValue !== null) {
      if ('toDate' in dateValue) {
        const date = (dateValue as { toDate: () => Date }).toDate();
        return date.toISOString().split('T')[0];
      }
      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }
    }

    // String (ISO or other)
    if (typeof dateValue === 'string') {
      if (dateValue.includes('T')) {
        return dateValue.split('T')[0];
      }
      return dateValue;
    }

    return '';
  } catch {
    return '';
  }
};

/**
 * Format date for display (Vietnamese format)
 */
export const formatDisplayDate = (dateValue: unknown): string => {
  if (!dateValue) return '';

  try {
    let date: Date;

    if (typeof dateValue === 'object' && dateValue !== null && 'toDate' in dateValue) {
      date = (dateValue as { toDate: () => Date }).toDate();
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return '';
    }

    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('vi-VN');
  } catch {
    return '';
  }
};

/**
 * Format datetime for display
 */
export const formatDisplayDateTime = (dateValue: unknown): string => {
  if (!dateValue) return '';

  try {
    let date: Date;

    if (typeof dateValue === 'object' && dateValue !== null && 'toDate' in dateValue) {
      date = (dateValue as { toDate: () => Date }).toDate();
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return '';
    }

    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN');
  } catch {
    return '';
  }
};

/**
 * Get relative time (e.g., "2 giờ trước")
 */
export const getRelativeTime = (dateValue: unknown): string => {
  if (!dateValue) return '';

  try {
    let date: Date;

    if (typeof dateValue === 'object' && dateValue !== null && 'toDate' in dateValue) {
      date = (dateValue as { toDate: () => Date }).toDate();
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return '';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return formatDisplayDate(date);
  } catch {
    return '';
  }
};
