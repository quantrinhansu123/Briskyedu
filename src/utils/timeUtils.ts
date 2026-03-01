/**
 * Time Utilities
 * Tính toán thời gian cho khung giờ vai trò GV/TG/GVNN
 */

import type { ClassModel, DayScheduleConfig } from '../../types';

/** Tính số phút giữa 2 mốc giờ HH:mm. VD: ('18:00', '19:30') → 90 */
export function calcMinutesBetween(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

/** Lấy giờ theo vai trò từ scheduleDetails hoặc ClassModel level, fallback về class time */
export function getRoleTime(
  cls: ClassModel,
  dayOfWeek: string,
  role: 'teacher' | 'assistant' | 'foreignTeacher',
  fallbackStart: string,
  fallbackEnd: string
): { start: string; end: string; minutes: number } {
  const dayConfig = cls.scheduleDetails?.find(d => d.dayOfWeek === dayOfWeek);

  const startKey = `${role}StartTime` as keyof DayScheduleConfig;
  const endKey = `${role}EndTime` as keyof DayScheduleConfig;

  const start = (dayConfig?.[startKey] as string)
    || (cls as any)[`${role}StartTime`]
    || fallbackStart;
  const end = (dayConfig?.[endKey] as string)
    || (cls as any)[`${role}EndTime`]
    || fallbackEnd;

  return { start, end, minutes: calcMinutesBetween(start, end) };
}

/** Validate khung giờ vai trò nằm trong khung giờ buổi học */
export function isTimeRangeWithinBounds(
  roleStart: string,
  roleEnd: string,
  classStart: string,
  classEnd: string
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  if (!roleStart || !roleEnd || !classStart || !classEnd) return false;
  return toMin(roleStart) >= toMin(classStart)
    && toMin(roleEnd) <= toMin(classEnd)
    && toMin(roleStart) < toMin(roleEnd);
}
