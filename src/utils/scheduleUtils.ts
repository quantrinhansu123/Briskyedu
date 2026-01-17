/**
 * Schedule Display Utilities
 * Chuẩn hóa hiển thị lịch học thống nhất toàn hệ thống
 */

/**
 * Format ngày học thành dạng chuẩn "T2, T4, T6"
 * Input có thể là: "Thứ 2, 4, 6" hoặc "Thứ 2, Thứ 4" hoặc "2, 4, 6" hoặc "T2-T4-T6"
 * Output: "T2, T4, T6" (viết tắt, phân cách bằng dấu phẩy)
 */
export const formatScheduleDays = (daysStr: string): string => {
  if (!daysStr) return '';
  
  // Extract all day numbers from the string
  const dayNumbers: number[] = [];
  
  // Match patterns like "Thứ 2", "Thứ 3", etc.
  const thuMatches = daysStr.match(/Thứ\s*(\d)/gi);
  if (thuMatches) {
    thuMatches.forEach(match => {
      const num = parseInt(match.replace(/Thứ\s*/i, ''));
      if (num >= 2 && num <= 7 && !dayNumbers.includes(num)) {
        dayNumbers.push(num);
      }
    });
  }
  
  // Match patterns like "T2", "T3", etc.
  const tMatches = daysStr.match(/T(\d)/gi);
  if (tMatches) {
    tMatches.forEach(match => {
      const num = parseInt(match.replace(/T/i, ''));
      if (num >= 2 && num <= 7 && !dayNumbers.includes(num)) {
        dayNumbers.push(num);
      }
    });
  }
  
  // Match standalone numbers (e.g., "2, 4, 6" after "Thứ")
  const parts = daysStr.split(/[,\-\s]+/);
  parts.forEach(part => {
    const num = parseInt(part.trim());
    if (num >= 2 && num <= 7 && !dayNumbers.includes(num)) {
      dayNumbers.push(num);
    }
  });
  
  // Check for Sunday
  const hasSunday = /CN|Chủ\s*nhật/i.test(daysStr);
  
  // Sort and format
  dayNumbers.sort((a, b) => a - b);
  
  const formatted = dayNumbers.map(n => `T${n}`);
  if (hasSunday) {
    formatted.push('CN');
  }
  
  return formatted.join(', ');
};

/**
 * Format lịch học đầy đủ: "14:00-15:30 T2, T4, T6"
 * Input: "14:00-15:30 Thứ 2, 4, 6" hoặc "14:00-15:30 Thứ 2, Thứ 4, Thứ 6"
 */
export const formatSchedule = (schedule: string): string => {
  if (!schedule) return '';
  
  // Extract time part
  const timeMatch = schedule.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  const timePart = timeMatch ? `${timeMatch[1]}-${timeMatch[2]}` : '';
  
  // Extract and format days part
  const daysStr = schedule.replace(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*/, '').trim();
  const daysPart = formatScheduleDays(daysStr);
  
  if (timePart && daysPart) {
    return `${timePart} ${daysPart}`;
  }
  return daysPart || schedule;
};

/**
 * Lấy phần thời gian từ lịch học
 * "14:00-15:30 Thứ 2, 4" => "14:00-15:30"
 */
export const getScheduleTime = (schedule: string): string => {
  if (!schedule) return '';
  const match = schedule.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  return match ? `${match[1]} - ${match[2]}` : '';
};

/**
 * Lấy phần ngày từ lịch học (đã format)
 * "14:00-15:30 Thứ 2, 4" => "T2, T4"
 */
export const getScheduleDays = (schedule: string): string => {
  if (!schedule) return '';
  const daysStr = schedule.replace(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*/, '').trim();
  return formatScheduleDays(daysStr);
};

/**
 * Parse schedule thành array của day numbers
 * "14:00-15:30 T2, T4, T6" => [2, 4, 6]
 */
export const parseScheduleDays = (schedule: string): number[] => {
  const daysStr = getScheduleDays(schedule);
  const days: number[] = [];

  const matches = daysStr.match(/T(\d)/gi);
  if (matches) {
    matches.forEach(match => {
      const num = parseInt(match.replace(/T/i, ''));
      if (!days.includes(num)) {
        days.push(num);
      }
    });
  }

  return days.sort((a, b) => a - b);
};

/**
 * Validate schedule format and extract info
 * Returns validation result with days and time if valid
 */
export const validateScheduleFormat = (schedule: string): {
  valid: boolean;
  error?: string;
  days?: number[];
  time?: string;
} => {
  if (!schedule?.trim()) {
    return { valid: false, error: 'Vui lòng nhập lịch học' };
  }

  const days = parseScheduleDays(schedule);
  if (days.length === 0) {
    return {
      valid: false,
      error: 'Không nhận diện được ngày học. VD: T2, T4, T6 hoặc Thứ 2, Thứ 4'
    };
  }

  const time = getScheduleTime(schedule);

  return {
    valid: true,
    days,
    time: time || undefined
  };
};
