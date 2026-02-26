/**
 * Legacy Session Import Service
 *
 * Parses Excel files to bulk-update legacyAttendedSessions for migrated students.
 * Flow: parse file → generate preview (match by code/name) → apply updates
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Student } from '@/types';
import { updateLegacyAttendedSessions } from './adminFixService';
import * as XLSX from 'xlsx';

export interface LegacyImportRow {
  code: string;
  fullName: string;
  legacySessions: number;
}

export interface LegacyImportPreview {
  row: LegacyImportRow;
  matched: boolean;
  studentId?: string;
  studentName?: string;
  currentLegacy: number;
  currentRemaining: number;
  newRemaining: number;
  error?: string;
}

/**
 * Parse Excel file into import rows.
 * Expected columns: A=Mã HV, B=Họ tên, C=Đã học (cũ)
 */
export function parseExcelFile(file: File): Promise<LegacyImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

        // Skip header row (index 0)
        const rows: LegacyImportRow[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row || (!row[0] && !row[1])) continue; // skip empty rows

          rows.push({
            code: String(row[0] || '').trim(),
            fullName: String(row[1] || '').trim(),
            legacySessions: parseInt(row[2]) || 0,
          });
        }

        if (rows.length === 0) {
          reject(new Error('File không có dữ liệu hợp lệ'));
          return;
        }

        resolve(rows);
      } catch {
        reject(new Error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Match Excel rows to Firestore students and generate before/after preview.
 * Match priority: student code > full name (case-insensitive)
 */
export async function generateImportPreview(
  rows: LegacyImportRow[]
): Promise<LegacyImportPreview[]> {
  const studentsSnap = await getDocs(collection(db, 'students'));
  const students = studentsSnap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as (Student & { id: string })[];

  return rows.map(row => {
    // Match by code first (most reliable), fallback to name
    let student = row.code
      ? students.find(s => s.code === row.code)
      : undefined;

    if (!student && row.fullName) {
      student = students.find(
        s => s.fullName?.toLowerCase() === row.fullName.toLowerCase()
      );
    }

    if (!student) {
      return {
        row,
        matched: false,
        currentLegacy: 0,
        currentRemaining: 0,
        newRemaining: 0,
        error: `Không tìm thấy học viên: ${row.code || row.fullName}`,
      };
    }

    const registered = student.registeredSessions || 0;
    const attended = student.attendedSessions || 0;
    const currentLegacy = student.legacyAttendedSessions || 0;
    const currentRemaining = registered - attended - currentLegacy;
    const newRemaining = registered - attended - row.legacySessions;

    return {
      row,
      matched: true,
      studentId: student.id,
      studentName: student.fullName,
      currentLegacy,
      currentRemaining,
      newRemaining,
    };
  });
}

/**
 * Apply legacy sessions from preview (only matched rows).
 * Returns summary of successes and failures.
 */
export async function applyLegacyImport(
  previews: LegacyImportPreview[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const matched = previews.filter(p => p.matched && p.studentId);
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const preview of matched) {
    try {
      await updateLegacyAttendedSessions(preview.studentId!, preview.row.legacySessions);
      success++;
    } catch (err: any) {
      failed++;
      errors.push(`${preview.studentName}: ${err.message}`);
    }
  }

  return { success, failed, errors };
}
