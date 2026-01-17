/**
 * Backfill Session-Attendance Links Cloud Function
 *
 * This function finds sessions with missing attendanceId links and repairs them.
 * Call via HTTP or from Firebase Console Functions shell.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

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
export const backfillSessionAttendanceLinks = functions.https.onRequest(async (req, res) => {
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
