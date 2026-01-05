/**
 * Dashboard Widget Types
 * Shared interfaces for dashboard components
 */

// Student status for pie/bar charts
export interface StudentStatus {
  name: string;
  value: number;
  color: string;
}

// Birthday person (staff or student)
export interface BirthdayPerson {
  id: string;
  name: string;
  position: string;
  date: string;
  dayOfMonth: number;
  branch?: string;
}

// Student with debt info
export interface StudentDebt {
  id: string;
  fullName: string;
  className: string;
  status: string;
}

// Student expiring soon
export interface StudentExpiring {
  id: string;
  fullName: string;
  className: string;
  remainingSessions: number;
  expectedEndDate?: string;  // Calculated expected end date
  contractStartDate?: string;  // Latest contract start date
  sessionsPerWeek?: number;  // For calculation reference
}

// Checklist item
export interface ChecklistItem {
  id: string;
  task: string;
  count: number;
  done: boolean;
}

// Product stock
export interface ProductStock {
  id?: string;
  name: string;
  stock: number;
  minStock?: number;
}

// Revenue data point
export interface RevenueDataPoint {
  name: string;
  value: number;
  color?: string;
}

// Sales data point
export interface SalesDataPoint {
  month: string;
  expected: number;
  actual: number;
}

// Salary forecast item
export interface SalaryForecastItem {
  position: string;
  amount: number;
}

// Business health metric
export interface BusinessHealthMetric {
  metric: string;
  value: number;
  status: string;
}

// Gift status for birthdays
export interface GiftStatus {
  giftPrepared: boolean;
  giftGiven: boolean;
}

// Center/Branch info
export interface Center {
  id: string;
  name: string;
}

// Upcoming class for teachers
export interface UpcomingClass {
  id: string;
  className: string;
  date: string;
  time: string;
  room: string;
}

// BTVN report needed
export interface BTVNReport {
  id: string;
  className: string;
  lastClassDate: string;
}

// Student alert (absences/homework)
export interface StudentAlert {
  id: string;
  name: string;
  absences?: number;
  completionRate?: number;
}

// Teacher birthday
export interface TeacherStudentBirthday {
  id: string;
  name: string;
  date: string;
  dayOfMonth: number;
}
