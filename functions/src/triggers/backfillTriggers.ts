/**
 * Backfill Session-Attendance Links Cloud Function
 *
 * This function finds sessions with missing attendanceId links and repairs them.
 * Call via HTTP or from Firebase Console Functions shell.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { parseSchedule, generateSessionDates } from '../utils/scheduleParser';
import { executeBatch, BatchOperation } from '../utils/batchUtils';

const db = admin.firestore();
const REGION = 'asia-southeast1';

interface BackfillResult {
  sessionsChecked: number;
  sessionsUpdated: number;
  errors: string[];
  details: Array<{
    sessionId: string;
    sessionNumber: number;
    date: string;
    attendanceId: string;
  }>;
}

/**
 * HTTP Callable function to backfill session-attendance links
 *
 * Usage from browser console:
 * fetch('https://us-central1-<project-id>.cloudfunctions.net/backfillSessionAttendanceLinks?dryRun=true')
 *
 * Or deploy and call via Firebase Functions shell:
 * firebase functions:shell
 * > backfillSessionAttendanceLinks({dryRun: true})
 */
export const backfillSessionAttendanceLinks = functions.region(REGION).https.onRequest(async (req, res) => {
  const dryRun = req.query.dryRun !== 'false';

  console.log(`Starting backfill in ${dryRun ? 'DRY-RUN' : 'EXECUTE'} mode`);

  const result: BackfillResult = {
    sessionsChecked: 0,
    sessionsUpdated: 0,
    errors: [],
    details: []
  };

  try {
    // 1. Get all sessions with status='Chưa học'
    const sessionsSnap = await db.collection('classSessions')
      .where('status', '==', 'Chưa học')
      .get();
    console.log(`Found ${sessionsSnap.size} incomplete sessions`);

    // 2. Get all attendance records
    const attendanceSnap = await db.collection('attendance').get();
    console.log(`Found ${attendanceSnap.size} attendance records`);

    // Build lookup maps
    const attendanceByClassDate = new Map<string, { id: string; sessionId?: string }>();
    const attendanceBySessionId = new Map<string, { id: string }>();

    attendanceSnap.docs.forEach(docRef => {
      const data = docRef.data();
      if (data.classId && data.date) {
        const key = `${data.classId}_${data.date}`;
        attendanceByClassDate.set(key, { id: docRef.id, sessionId: data.sessionId });
      }
      if (data.sessionId) {
        attendanceBySessionId.set(data.sessionId, { id: docRef.id });
      }
    });

    // 3. Process each unlinked session
    for (const sessionDoc of sessionsSnap.docs) {
      result.sessionsChecked++;
      const sessionData = sessionDoc.data();

      if (sessionData.attendanceId) continue;

      // Find matching attendance
      let matchedAttendance = attendanceBySessionId.get(sessionDoc.id);
      if (!matchedAttendance && sessionData.classId && sessionData.date) {
        const key = `${sessionData.classId}_${sessionData.date}`;
        matchedAttendance = attendanceByClassDate.get(key);
      }

      if (matchedAttendance) {
        result.details.push({
          sessionId: sessionDoc.id,
          sessionNumber: sessionData.sessionNumber,
          date: sessionData.date,
          attendanceId: matchedAttendance.id
        });

        if (!dryRun) {
          try {
            await db.collection('classSessions').doc(sessionDoc.id).update({
              status: 'Đã học',
              attendanceId: matchedAttendance.id
            });
            result.sessionsUpdated++;
          } catch (err) {
            result.errors.push(`Failed ${sessionDoc.id}: ${err}`);
          }
        } else {
          result.sessionsUpdated++;
        }
      }
    }

    res.json({
      success: true,
      mode: dryRun ? 'DRY-RUN' : 'EXECUTE',
      ...result
    });

  } catch (error) {
    console.error('Backfill error:', error);
    res.status(500).json({
      success: false,
      error: String(error)
    });
  }
});

/**
 * HTTP function to sync missing sessions for all active classes
 *
 * Usage:
 *   curl "https://asia-southeast1-<project-id>.cloudfunctions.net/syncMissingSessions?dryRun=true"
 *   curl "https://asia-southeast1-<project-id>.cloudfunctions.net/syncMissingSessions?dryRun=false"
 *   curl "https://asia-southeast1-<project-id>.cloudfunctions.net/syncMissingSessions?className=Cam%204.2&dryRun=true"
 */
export const syncMissingSessions = functions.region(REGION).https.onRequest(async (req, res) => {
  const dryRun = req.query.dryRun !== 'false';
  const targetClassName = req.query.className as string | undefined;

  console.log(`[syncMissingSessions] Mode: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}, Target: ${targetClassName || 'ALL'}`);

  const result: {
    classesProcessed: number;
    sessionsAdded: number;
    sessionsRemoved: number;
    details: Array<{ className: string; added: number; removed: number }>;
    errors: string[];
  } = {
    classesProcessed: 0,
    sessionsAdded: 0,
    sessionsRemoved: 0,
    details: [],
    errors: []
  };

  try {
    // 1. Get active classes
    let classesQuery = db.collection('classes').where('status', '==', 'Đang học');

    const classesSnap = await classesQuery.get();
    let classes = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter by className if specified
    if (targetClassName) {
      classes = classes.filter((c: any) => c.name === targetClassName);
      if (classes.length === 0) {
        res.status(404).json({ success: false, error: `Class "${targetClassName}" not found` });
        return;
      }
    }

    console.log(`[syncMissingSessions] Processing ${classes.length} classes`);

    // 2. Load holidays
    const holidaysSnap = await db.collection('holidays').get();
    const holidayDates = new Set<string>();
    holidaysSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          holidayDates.add(d.toISOString().split('T')[0]);
        }
      } else if (data.date) {
        holidayDates.add(data.date);
      }
    });
    console.log(`[syncMissingSessions] Loaded ${holidayDates.size} holiday dates`);

    // 3. Process each class
    for (const classDoc of classes) {
      const classData = classDoc as any;
      const classId = classDoc.id;

      if (!classData.schedule || classData.totalSessions === undefined || classData.totalSessions === null) {
        result.errors.push(`${classData.name}: Missing schedule or totalSessions`);
        continue;
      }

      // If totalSessions is 0, report it (should not happen if config is correct)
      if (classData.totalSessions === 0) {
        result.errors.push(`${classData.name}: totalSessions is 0 (check class config)`);
        continue;
      }

      console.log(`[syncMissingSessions] ${classData.name}: totalSessions=${classData.totalSessions}, schedule=${classData.schedule}`);

      // Get existing sessions
      const existingSnap = await db.collection('classSessions')
        .where('classId', '==', classId)
        .get();

      const existingSessions = existingSnap.docs.map(d => ({
        id: d.id,
        ...d.data() as { date: string; attendanceId?: string; sessionNumber: number }
      }));

      // Parse schedule
      const { time, days } = parseSchedule(classData.schedule);
      if (days.length === 0) {
        result.errors.push(`${classData.name}: Could not parse schedule "${classData.schedule}"`);
        continue;
      }

      // Get start date
      let startDate: string;
      if (classData.startDate) {
        if (typeof classData.startDate === 'string') {
          startDate = classData.startDate;
        } else if (classData.startDate.toDate) {
          startDate = classData.startDate.toDate().toISOString().split('T')[0];
        } else {
          startDate = new Date().toISOString().split('T')[0];
        }
      } else {
        startDate = new Date().toISOString().split('T')[0];
      }

      // Generate expected sessions (excluding holidays)
      const allExpectedDates = generateSessionDates(startDate, classData.totalSessions, days);
      const expectedSessions = allExpectedDates.filter(s => !holidayDates.has(s.date));

      // Calculate diff
      const existingDates = new Set(existingSessions.map(s => s.date));
      const expectedDates = new Set(expectedSessions.map(s => s.date));

      const toAdd = expectedSessions.filter(s => !existingDates.has(s.date));
      const toRemove = existingSessions.filter(s =>
        !expectedDates.has(s.date) && !s.attendanceId
      );

      if (toAdd.length === 0 && toRemove.length === 0) {
        continue; // Already synced
      }

      result.details.push({
        className: classData.name,
        added: toAdd.length,
        removed: toRemove.length
      });

      // Execute if not dry run
      if (!dryRun) {
        const operations: BatchOperation[] = [];

        // Delete excess sessions
        toRemove.forEach(s => {
          operations.push({
            type: 'delete' as const,
            ref: db.collection('classSessions').doc(s.id)
          });
        });

        // Add missing sessions
        const maxSessionNumber = Math.max(0, ...existingSessions.map(s => s.sessionNumber || 0));
        let nextNum = maxSessionNumber + 1;

        toAdd.forEach(sessionDate => {
          operations.push({
            type: 'set' as const,
            ref: db.collection('classSessions').doc(),
            data: {
              classId,
              className: classData.name,
              sessionNumber: nextNum++,
              date: sessionDate.date,
              dayOfWeek: sessionDate.dayOfWeek,
              time: time || null,
              room: classData.room || null,
              teacherId: classData.teacherId || null,
              teacherName: classData.teacher || null,
              status: 'Chưa học',
              createdAt: new Date().toISOString()
            }
          });
        });

        if (operations.length > 0) {
          await executeBatch(operations);
        }
      }

      result.classesProcessed++;
      result.sessionsAdded += toAdd.length;
      result.sessionsRemoved += toRemove.length;
    }

    res.json({
      success: true,
      mode: dryRun ? 'DRY-RUN' : 'EXECUTE',
      ...result
    });

  } catch (error) {
    console.error('[syncMissingSessions] Error:', error);
    res.status(500).json({
      success: false,
      error: String(error)
    });
  }
});

/**
 * HTTP function to fix classes with totalSessions = 0
 * Calculates totalSessions from startDate, endDate, and schedule
 *
 * Usage:
 *   curl "https://asia-southeast1-<project-id>.cloudfunctions.net/fixTotalSessions?dryRun=true"
 *   curl "https://asia-southeast1-<project-id>.cloudfunctions.net/fixTotalSessions?dryRun=false"
 *   curl "https://asia-southeast1-<project-id>.cloudfunctions.net/fixTotalSessions?className=Kindy%204&dryRun=true"
 */
export const fixTotalSessions = functions.region(REGION).https.onRequest(async (req, res) => {
  const dryRun = req.query.dryRun !== 'false';
  const targetClassName = req.query.className as string | undefined;

  console.log(`[fixTotalSessions] Mode: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}, Target: ${targetClassName || 'ALL'}`);

  const result: {
    classesChecked: number;
    classesFixed: number;
    details: Array<{ className: string; oldValue: number; newValue: number; startDate: string; endDate: string }>;
    errors: string[];
  } = {
    classesChecked: 0,
    classesFixed: 0,
    details: [],
    errors: []
  };

  try {
    // Get active classes with totalSessions = 0
    const classesSnap = await db.collection('classes').where('status', '==', 'Đang học').get();
    let classes = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter by className if specified
    if (targetClassName) {
      classes = classes.filter((c: any) => c.name === targetClassName);
    }

    // Only process classes with totalSessions = 0 or undefined
    classes = classes.filter((c: any) => !c.totalSessions || c.totalSessions === 0);

    console.log(`[fixTotalSessions] Found ${classes.length} classes with totalSessions = 0`);

    // Load holidays for exclusion
    const holidaysSnap = await db.collection('holidays').get();
    const holidayDates = new Set<string>();
    holidaysSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          holidayDates.add(d.toISOString().split('T')[0]);
        }
      } else if (data.date) {
        holidayDates.add(data.date);
      }
    });

    for (const classDoc of classes) {
      result.classesChecked++;
      const classData = classDoc as any;

      // Need schedule, startDate, endDate to calculate
      if (!classData.schedule) {
        result.errors.push(`${classData.name}: Missing schedule`);
        continue;
      }

      // Parse schedule to get days per week
      const { days } = parseSchedule(classData.schedule);
      if (days.length === 0) {
        result.errors.push(`${classData.name}: Could not parse schedule "${classData.schedule}"`);
        continue;
      }

      // Get dates
      let startDate: Date;
      let endDate: Date;

      if (classData.startDate) {
        startDate = classData.startDate.toDate ? classData.startDate.toDate() : new Date(classData.startDate);
      } else {
        result.errors.push(`${classData.name}: Missing startDate`);
        continue;
      }

      if (classData.endDate) {
        endDate = classData.endDate.toDate ? classData.endDate.toDate() : new Date(classData.endDate);
      } else {
        result.errors.push(`${classData.name}: Missing endDate`);
        continue;
      }

      // Calculate total sessions (excluding holidays)
      let totalSessions = 0;
      const current = new Date(startDate);

      while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];

        if (days.includes(dayOfWeek) && !holidayDates.has(dateStr)) {
          totalSessions++;
        }
        current.setDate(current.getDate() + 1);
      }

      if (totalSessions === 0) {
        result.errors.push(`${classData.name}: Calculated 0 sessions (check dates/schedule)`);
        continue;
      }

      result.details.push({
        className: classData.name,
        oldValue: classData.totalSessions || 0,
        newValue: totalSessions,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      if (!dryRun) {
        await db.collection('classes').doc(classDoc.id).update({
          totalSessions,
          updatedAt: new Date().toISOString()
        });
        result.classesFixed++;
      } else {
        result.classesFixed++;
      }
    }

    res.json({
      success: true,
      mode: dryRun ? 'DRY-RUN' : 'EXECUTE',
      ...result
    });

  } catch (error) {
    console.error('[fixTotalSessions] Error:', error);
    res.status(500).json({
      success: false,
      error: String(error)
    });
  }
});
