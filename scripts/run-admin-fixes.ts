/**
 * Admin Fixes Script
 *
 * Performs targeted data corrections for specific classes and students:
 * 1. Recalculate session data for all students in target classes
 * 2. Remove students from Starters 14 (Khánh Vy, Minh Khôi)
 * 3. Remove student from Starters 13 (Đỗ Gia Hân)
 * 4. Fix registeredSessions for Lê Tuấn Dũng in Starters 14 (48 → 24)
 *
 * Usage:
 *   npx tsx scripts/run-admin-fixes.ts           # Dry run (preview only)
 *   npx tsx scripts/run-admin-fixes.ts --execute # Apply changes
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS not set in .env.local');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(credPath) });
}

const db = getFirestore();

const IS_DRY_RUN = !process.argv.includes('--execute');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Present statuses (legacy + current)
const PRESENT_STATUSES = ['Đúng giờ', 'Trễ giờ', 'Đã bồi', 'Có mặt', 'Đến trễ'];

// Absent statuses (for session counting)
const ABSENT_STATUSES = ['Vắng', 'Vắng không phép', 'Nghỉ'];

// Student statuses to skip when recalculating
const SKIP_STATUSES = ['Nghỉ học', 'Bảo lưu', 'Học thử', 'Nợ hợp đồng'];

// Target class names to look up
const TARGET_CLASS_NAMES = [
  'Kindy 4',
  'Kindy 6',
  'Kindy 7',
  'Sunny 3',
  'Sunny 5',
  'Starters 11',
  'Starters 13',
  'Starters 14',
  'Ket',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClassDoc {
  id: string;
  name: string;
}

interface StudentDoc {
  id: string;
  fullName?: string;
  name?: string;
  status?: string;
  classId?: string;
  className?: string;
  classIds?: string[];
  registeredSessions?: number;
  attendedSessions?: number;
  remainingSessions?: number;
  classProgress?: Record<string, unknown>;
  debtSessions?: number;
  debtStartDate?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(msg);
}

function sep(char = '=', len = 60) {
  log(char.repeat(len));
}

function studentName(s: StudentDoc): string {
  return s.fullName || s.name || '(no name)';
}

// ---------------------------------------------------------------------------
// 1. Lookup class IDs by name
// ---------------------------------------------------------------------------

async function lookupClassIds(names: string[]): Promise<Map<string, ClassDoc>> {
  log('\n[STEP 1] Looking up class IDs by name...');
  const result = new Map<string, ClassDoc>();

  const snap = await db.collection('classes').get();
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as { name?: string };
    if (data.name && names.includes(data.name)) {
      result.set(data.name, { id: docSnap.id, name: data.name });
      log(`  Found: "${data.name}" → ${docSnap.id}`);
    }
  }

  const missing = names.filter(n => !result.has(n));
  if (missing.length > 0) {
    log(`  WARNING: Classes not found: ${missing.join(', ')}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// 2. Get students for a class (by classId OR className)
// ---------------------------------------------------------------------------

async function getStudentsForClass(classDoc: ClassDoc): Promise<StudentDoc[]> {
  const byIdSnap = await db.collection('students')
    .where('classId', '==', classDoc.id)
    .get();

  const byNameSnap = await db.collection('students')
    .where('className', '==', classDoc.name)
    .get();

  const map = new Map<string, StudentDoc>();
  for (const d of [...byIdSnap.docs, ...byNameSnap.docs]) {
    if (!map.has(d.id)) {
      map.set(d.id, { id: d.id, ...(d.data() as Omit<StudentDoc, 'id'>) });
    }
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// 3. Count actual attendance from studentAttendance collection
// ---------------------------------------------------------------------------

async function countAttendance(
  studentId: string,
  classId: string,
): Promise<{ attended: number; absent: number; makeup: number }> {
  const presentSnap = await db.collection('studentAttendance')
    .where('studentId', '==', studentId)
    .where('classId', '==', classId)
    .where('status', 'in', PRESENT_STATUSES)
    .get();

  let attended = 0;
  let makeup = 0;
  for (const d of presentSnap.docs) {
    const data = d.data();
    if (data.sessionId) {
      attended++;
    } else {
      makeup++;
    }
  }

  const absentSnap = await db.collection('studentAttendance')
    .where('studentId', '==', studentId)
    .where('classId', '==', classId)
    .where('status', 'in', ABSENT_STATUSES)
    .get();

  let absent = 0;
  for (const d of absentSnap.docs) {
    const data = d.data();
    if (data.sessionId) absent++;
  }

  return { attended, absent, makeup };
}

// ---------------------------------------------------------------------------
// 4. Recalculate session data for all students in a class
// ---------------------------------------------------------------------------

async function recalculateClass(classDoc: ClassDoc): Promise<void> {
  log(`\n[RECALCULATE] "${classDoc.name}" (${classDoc.id})`);

  const students = await getStudentsForClass(classDoc);
  log(`  Students found: ${students.length}`);

  if (students.length === 0) {
    log('  No students. Skipping.');
    return;
  }

  let fixed = 0;

  for (const student of students) {
    const sid = student.id;
    const sname = studentName(student);
    const currentStatus = student.status || '';
    const registeredSessions = student.registeredSessions || 0;

    const { attended, absent, makeup } = await countAttendance(sid, classDoc.id);
    const remaining = registeredSessions - attended;

    // Determine new status
    let newStatus = currentStatus;
    if (!SKIP_STATUSES.includes(currentStatus)) {
      if (registeredSessions > 0) {
        if (remaining < 0) {
          newStatus = 'Nợ phí';
        } else if (remaining === 0) {
          newStatus = 'Đã học hết phí';
        } else {
          newStatus = 'Đang học';
        }
      }
    }

    const beforeAttended = student.attendedSessions || 0;
    const beforeRemaining = student.remainingSessions ?? (registeredSessions - beforeAttended);
    const beforeStatus = currentStatus;

    const changed =
      beforeAttended !== attended ||
      beforeRemaining !== remaining ||
      beforeStatus !== newStatus;

    if (!changed) {
      log(`  [OK]    ${sname}: attended=${attended}, remaining=${remaining}, status=${currentStatus}`);
      continue;
    }

    log(
      `  [FIX]   ${sname}:` +
        `\n          attended: ${beforeAttended} → ${attended}` +
        `\n          remaining: ${beforeRemaining} → ${remaining}` +
        `\n          status: ${beforeStatus} → ${newStatus}`,
    );

    if (!IS_DRY_RUN) {
      const updateData: Record<string, unknown> = {
        attendedSessions: attended,
        remainingSessions: remaining,
        makeupSessionsAttended: makeup,
      };

      if (!SKIP_STATUSES.includes(currentStatus)) {
        updateData.status = newStatus;
        if (newStatus === 'Nợ phí') {
          updateData.debtSessions = Math.abs(remaining);
          if (!student.debtStartDate) {
            updateData.debtStartDate = new Date().toISOString();
          }
        } else {
          updateData.debtSessions = 0;
          updateData.debtStartDate = null;
        }
      }

      updateData[`classProgress.${classDoc.id}`] = {
        registeredSessions,
        attendedSessions: attended,
        absentSessions: absent,
        makeupOwed: Math.max(0, absent - makeup),
        makeupDone: makeup,
        reservedSessions: 0,
      };

      await db.collection('students').doc(sid).update(updateData);
      fixed++;
    } else {
      fixed++;
    }
  }

  log(
    `  Result: ${fixed} student(s) ${IS_DRY_RUN ? 'would be fixed' : 'fixed'} out of ${students.length}`,
  );
}

// ---------------------------------------------------------------------------
// 5. Remove a student from a class
// ---------------------------------------------------------------------------

async function removeStudentFromClass(
  studentId: string,
  classId: string,
  label: string,
): Promise<void> {
  log(`\n[REMOVE] ${label} (studentId=${studentId}) from class ${classId}`);

  // Get student doc (Admin SDK: .exists is a property, not method)
  const studentSnap = await db.collection('students').doc(studentId).get();
  if (!studentSnap.exists) {
    log('  ERROR: Student document not found!');
    return;
  }

  const student = { id: studentSnap.id, ...(studentSnap.data() as Omit<StudentDoc, 'id'>) };
  const sname = studentName(student);
  log(`  Student name: ${sname}`);
  log(`  Current status: ${student.status}`);
  log(`  Current classId: ${student.classId}`);

  // Count attendance records to delete
  const attendanceSnap = await db.collection('studentAttendance')
    .where('studentId', '==', studentId)
    .where('classId', '==', classId)
    .get();

  log(`  Attendance records to delete: ${attendanceSnap.size}`);

  if (IS_DRY_RUN) {
    log(
      `  [DRY RUN] Would: set status=Nghỉ học, clear classId/className/class, delete ${attendanceSnap.size} attendance records`,
    );
    return;
  }

  // Delete attendance in batches (Admin SDK batch limit is 500)
  const docs = attendanceSnap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  log(`  Deleted ${docs.length} studentAttendance records`);

  // Update student document
  const updateData: Record<string, unknown> = {
    status: 'Nghỉ học',
    classId: null,
    className: null,
    class: null,
    attendedSessions: 0,
    remainingSessions: 0,
    updatedAt: new Date().toISOString(),
    [`classProgress.${classId}`]: null,
  };

  // Remove from classIds array if present
  if (student.classIds && Array.isArray(student.classIds)) {
    updateData.classIds = student.classIds.filter((id: string) => id !== classId);
  }

  await db.collection('students').doc(studentId).update(updateData);
  log(`  Student updated: status=Nghỉ học, classId/className cleared`);
}

// ---------------------------------------------------------------------------
// 6. Find student by name within a class
// ---------------------------------------------------------------------------

async function findStudentByNameInClass(
  nameFragment: string,
  classDoc: ClassDoc,
): Promise<StudentDoc[]> {
  const students = await getStudentsForClass(classDoc);
  const lower = nameFragment.toLowerCase();
  return students.filter(s => studentName(s).toLowerCase().includes(lower));
}

// ---------------------------------------------------------------------------
// 7. Fix registeredSessions for a specific student
// ---------------------------------------------------------------------------

async function fixRegisteredSessions(
  studentId: string,
  classId: string,
  correctRegistered: number,
  label: string,
): Promise<void> {
  log(`\n[FIX REGISTERED] ${label} (studentId=${studentId})`);

  const studentSnap = await db.collection('students').doc(studentId).get();
  if (!studentSnap.exists) {
    log('  ERROR: Student not found!');
    return;
  }

  const student = studentSnap.data() as StudentDoc;
  const sname = student.fullName || student.name || '(no name)';
  const currentRegistered = student.registeredSessions || 0;
  const attended = student.attendedSessions || 0;
  const newRemaining = correctRegistered - attended;

  log(`  Student: ${sname}`);
  log(`  registeredSessions: ${currentRegistered} → ${correctRegistered}`);
  log(`  attendedSessions: ${attended}`);
  log(`  remainingSessions: ${student.remainingSessions} → ${newRemaining}`);

  if (IS_DRY_RUN) {
    log('  [DRY RUN] Would update registeredSessions and remainingSessions');
    return;
  }

  const updateData: Record<string, unknown> = {
    registeredSessions: correctRegistered,
    remainingSessions: newRemaining,
  };

  // Update classProgress if exists
  if (student.classProgress && student.classProgress[classId]) {
    updateData[`classProgress.${classId}.registeredSessions`] = correctRegistered;
  }

  // Recalculate debt status
  const currentStatus = student.status || '';
  if (!SKIP_STATUSES.includes(currentStatus)) {
    if (newRemaining < 0) {
      updateData.status = 'Nợ phí';
      updateData.debtSessions = Math.abs(newRemaining);
    } else if (newRemaining === 0) {
      updateData.status = 'Đã học hết phí';
      updateData.debtSessions = 0;
    } else {
      updateData.status = 'Đang học';
      updateData.debtSessions = 0;
      updateData.debtStartDate = null;
    }
  }

  await db.collection('students').doc(studentId).update(updateData);
  log(`  Updated successfully`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  sep();
  log('  RUN ADMIN FIXES SCRIPT');
  log(`  Mode: ${IS_DRY_RUN ? 'DRY RUN (no changes will be written)' : 'EXECUTE (changes WILL be applied)'}`);
  log(`  Time: ${new Date().toISOString()}`);
  sep();

  // Step 1: Resolve class IDs
  const classMap = await lookupClassIds(TARGET_CLASS_NAMES);

  const getClass = (name: string): ClassDoc | undefined => classMap.get(name);

  // -------------------------------------------------------------------------
  // Step 2: Recalculate session data for all 9 target classes
  // -------------------------------------------------------------------------

  sep('-');
  log('[PHASE A] Recalculate session data for target classes');
  sep('-');

  for (const name of TARGET_CLASS_NAMES) {
    const classDoc = getClass(name);
    if (!classDoc) {
      log(`\n[SKIP] Class "${name}" not found in Firestore`);
      continue;
    }
    await recalculateClass(classDoc);
  }

  // -------------------------------------------------------------------------
  // Step 3: Remove specific students from Starters 14
  // -------------------------------------------------------------------------

  sep('-');
  log('[PHASE B] Remove students from Starters 14');
  sep('-');

  const starters14 = getClass('Starters 14');
  if (!starters14) {
    log('WARNING: Starters 14 not found, skipping student removal');
  } else {
    // Find Khánh Vy
    const khanhVyList = await findStudentByNameInClass('Khánh Vy', starters14);
    if (khanhVyList.length === 0) {
      log('\n[WARN] "Khánh Vy" not found in Starters 14');
    } else if (khanhVyList.length > 1) {
      log(`\n[WARN] Multiple matches for "Khánh Vy" in Starters 14:`);
      khanhVyList.forEach(s => log(`  - ${studentName(s)} (${s.id})`));
      log('  Please specify exact student ID and re-run.');
    } else {
      await removeStudentFromClass(khanhVyList[0].id, starters14.id, `Khánh Vy (${khanhVyList[0].id})`);
    }

    // Find Minh Khôi
    const minhKhoiList = await findStudentByNameInClass('Minh Khôi', starters14);
    if (minhKhoiList.length === 0) {
      log('\n[WARN] "Minh Khôi" not found in Starters 14');
    } else if (minhKhoiList.length > 1) {
      log(`\n[WARN] Multiple matches for "Minh Khôi" in Starters 14:`);
      minhKhoiList.forEach(s => log(`  - ${studentName(s)} (${s.id})`));
      log('  Please specify exact student ID and re-run.');
    } else {
      await removeStudentFromClass(minhKhoiList[0].id, starters14.id, `Minh Khôi (${minhKhoiList[0].id})`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Remove Đỗ Gia Hân from Starters 13
  // -------------------------------------------------------------------------

  sep('-');
  log('[PHASE C] Remove Đỗ Gia Hân from Starters 13');
  sep('-');

  const starters13 = getClass('Starters 13');
  if (!starters13) {
    log('WARNING: Starters 13 not found, skipping');
  } else {
    const giaHanList = await findStudentByNameInClass('Đỗ Gia Hân', starters13);
    if (giaHanList.length === 0) {
      const giaHanList2 = await findStudentByNameInClass('Gia Hân', starters13);
      if (giaHanList2.length === 0) {
        log('\n[WARN] "Đỗ Gia Hân" not found in Starters 13');
      } else if (giaHanList2.length > 1) {
        log(`\n[WARN] Multiple matches for "Gia Hân" in Starters 13:`);
        giaHanList2.forEach(s => log(`  - ${studentName(s)} (${s.id})`));
        log('  Please specify exact student ID and re-run.');
      } else {
        await removeStudentFromClass(giaHanList2[0].id, starters13.id, `Đỗ Gia Hân (${giaHanList2[0].id})`);
      }
    } else if (giaHanList.length > 1) {
      log(`\n[WARN] Multiple matches for "Đỗ Gia Hân" in Starters 13:`);
      giaHanList.forEach(s => log(`  - ${studentName(s)} (${s.id})`));
      log('  Please specify exact student ID and re-run.');
    } else {
      await removeStudentFromClass(giaHanList[0].id, starters13.id, `Đỗ Gia Hân (${giaHanList[0].id})`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Fix Lê Tuấn Dũng registeredSessions in Starters 14 (48 → 24)
  // -------------------------------------------------------------------------

  sep('-');
  log('[PHASE D] Fix registeredSessions for Lê Tuấn Dũng in Starters 14');
  sep('-');

  if (!starters14) {
    log('WARNING: Starters 14 not found, skipping');
  } else {
    const tuanDungList = await findStudentByNameInClass('Lê Tuấn Dũng', starters14);
    if (tuanDungList.length === 0) {
      const tuanDungList2 = await findStudentByNameInClass('Tuấn Dũng', starters14);
      if (tuanDungList2.length === 0) {
        log('\n[WARN] "Lê Tuấn Dũng" not found in Starters 14');
      } else if (tuanDungList2.length > 1) {
        log(`\n[WARN] Multiple matches for "Tuấn Dũng" in Starters 14:`);
        tuanDungList2.forEach(s => log(`  - ${studentName(s)} (${s.id})`));
        log('  Please specify exact student ID and re-run.');
      } else {
        await fixRegisteredSessions(tuanDungList2[0].id, starters14.id, 24, `Lê Tuấn Dũng`);
      }
    } else if (tuanDungList.length > 1) {
      log(`\n[WARN] Multiple matches for "Lê Tuấn Dũng" in Starters 14:`);
      tuanDungList.forEach(s => log(`  - ${studentName(s)} (${s.id})`));
      log('  Please specify exact student ID and re-run.');
    } else {
      await fixRegisteredSessions(tuanDungList[0].id, starters14.id, 24, `Lê Tuấn Dũng`);
    }
  }

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------

  sep();
  log(`  DONE — ${IS_DRY_RUN ? 'DRY RUN complete. Run with --execute to apply.' : 'All changes applied.'}`);
  sep();
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nFATAL ERROR:', err);
    process.exit(1);
  });
