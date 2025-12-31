/**
 * Firebase Cloud Functions for EduManager Pro
 * 
 * These functions handle:
 * 1. Data integrity - Cascade updates when class/student data changes
 * 2. Auto-generation - Create sessions when class is created
 * 3. Data cleanup - Handle deletions properly
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all triggers
export * from './triggers/classTriggers';
export * from './triggers/studentTriggers';
export * from './triggers/sessionTriggers';
export * from './triggers/holidayTriggers';
export * from './triggers/homeworkTriggers';
export * from './triggers/attendanceTriggers';
export * from './triggers/studentAttendanceTriggers';
export * from './triggers/contractTriggers';
export * from './triggers/staffTriggers';
export * from './triggers/salaryTriggers';
