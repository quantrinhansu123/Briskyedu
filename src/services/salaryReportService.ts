/**
 * Salary Report Service
 * Calculate and aggregate salary data from work sessions
 */

import { getWorkSessions, WorkSession } from './workSessionService';
import { getSalaryRules, SalaryRule } from './salaryConfigService';

export interface SalarySummary {
  staffId: string;
  staffName: string;
  position: string;
  totalSessions: number;
  confirmedSessions: number;
  estimatedSalary: number;
  workDetails: WorkSessionDetail[];
}

export interface WorkSessionDetail {
  id: string;
  date: string;
  time: string;
  className: string;
  type: string;
  salary: number;
  studentCount?: number;
  durationMinutes?: number;
}

export const getSalaryReport = async (month?: number, year?: number): Promise<SalarySummary[]> => {
  try {
    // Get all confirmed work sessions
    const sessions = await getWorkSessions({ status: 'Đã xác nhận' });
    const rules = await getSalaryRules();
    
    // Filter by month/year if provided
    let filteredSessions = sessions;
    if (month && year) {
      filteredSessions = sessions.filter(s => {
        const date = new Date(s.date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });
    }
    
    // Group by staff
    const staffMap = new Map<string, WorkSession[]>();
    filteredSessions.forEach(session => {
      const key = session.staffName;
      if (!staffMap.has(key)) {
        staffMap.set(key, []);
      }
      staffMap.get(key)!.push(session);
    });
    
    // Calculate salary for each staff
    const summaries: SalarySummary[] = [];
    
    staffMap.forEach((staffSessions, staffName) => {
      const firstSession = staffSessions[0];
      
      // Find salary rule for this staff
      const rule = rules.find(r => r.staffName === staffName);
      const baseRate = rule?.ratePerSession || 200000;
      const salaryMethod = rule?.salaryMethod || 'Theo ca';
      const ratePerMinute = rule?.ratePerMinute || 0;
      
      const workDetails: WorkSessionDetail[] = staffSessions.map(s => {
        // Build time string with null checks
        let timeStr = '-';
        if (s.timeStart && s.timeEnd) {
          timeStr = `${s.timeStart} - ${s.timeEnd}`;
        } else if (s.timeStart) {
          timeStr = s.timeStart;
        } else if ((s as any).time) {
          // Fallback to 'time' field if exists
          timeStr = (s as any).time;
        }
        
        return {
          id: s.id!,
          date: s.date || '-',
          time: timeStr,
          className: s.className || '-',
          type: s.type || 'Dạy chính',
          salary: (() => {
            if (salaryMethod === 'Theo giờ' && ratePerMinute > 0) {
              const minutes = (s as any).durationMinutes || 90;
              return Math.round(minutes * ratePerMinute);
            }
            return baseRate;
          })(),
          studentCount: s.studentCount,
          durationMinutes: (s as any).durationMinutes,
        };
      });
      
      const totalSalary = workDetails.reduce((sum, d) => sum + d.salary, 0);
      
      summaries.push({
        staffId: firstSession.staffId || staffName,
        staffName,
        position: firstSession.position,
        totalSessions: staffSessions.length,
        confirmedSessions: staffSessions.filter(s => s.status === 'Đã xác nhận').length,
        estimatedSalary: totalSalary,
        workDetails,
      });
    });
    
    return summaries.sort((a, b) => b.estimatedSalary - a.estimatedSalary);
  } catch (error) {
    console.error('Error generating salary report:', error);
    throw new Error('Không thể tạo báo cáo lương');
  }
};
