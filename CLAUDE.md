# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Branch Strategy & Current Focus

**Status:** Staging migration PAUSED (Feb 2026). Currently fixing production bugs directly on `main`.

```
main branch     →  PRODUCTION (active development - bug fixes)
                   - 49 collections (legacy schema)
                   - Firebase: edumanager-pro-6180f
                   - Vercel: edumanager.vercel.app

staging branch  →  ON HOLD (schema simplification paused)
                   - Plan: plans/260130-2231-schema-simplification-staging/
```

### Known Legacy Data Issue
Firestore `studentAttendance` collection has MIXED status values:
- **Current (types.ts enum):** `'Đúng giờ'`, `'Trễ giờ'`, `'Vắng'`, `'Bảo lưu'`, `'Đã bồi'`
- **Legacy (old data):** `'Có mặt'`, `'Đến trễ'`, `'Vắng không phép'`, `'Nghỉ'`

All queries against `studentAttendance` MUST include both old and new status values.

---

## Project Overview

EduManager Pro is a Vietnamese education center management system built with React 19, TypeScript, and Firebase. It manages students, classes, attendance, staff salaries, contracts, and financial operations for language learning centers.

## Development Commands

```bash
# Development
npm run dev              # Start dev server on port 3000

# Build & Preview
npm run build            # Production build
npm run preview          # Preview production build

# Testing
npm run test             # Run Vitest in watch mode
npm run test:run         # Run tests once
npm run test:coverage    # Run tests with coverage report

# Firebase
npm run setup:admin      # Create initial admin staff account
firebase deploy          # Deploy to Firebase Hosting
firebase deploy --only firestore:rules  # Deploy Firestore rules only

# Firebase Emulators (Local Development)
firebase emulators:start # Start all emulators (Auth:9099, Firestore:8080, Functions:5001, Hosting:5000)
firebase emulators:exec "npm run test" # Run tests against emulators

# Data Maintenance Scripts
node scripts/create-admin-staff.js        # Create initial admin account
npx tsx scripts/seedAllData.ts            # Seed complete demo dataset
npx tsx scripts/checkDataConsistency.ts   # Verify data integrity
npx tsx scripts/syncContractsToEnrollments.ts  # Sync contract/enrollment data
npx tsx scripts/check-all-class-sessions.ts    # Check ALL classes for session issues
npx tsx scripts/fix-all-class-sessions.ts      # Renumber + fix dayOfWeek (dry-run default)
npx tsx scripts/check-session-count-mismatch.ts # Compare totalSessions vs actual count
npx tsx scripts/delete-all-extra-sessions.ts   # Delete sessions beyond totalSessions
```

## Architecture

### Project Structure

**Important**: This project uses a **non-standard structure** with source files at the root level instead of inside `src/`. The `src/` directory contains services, hooks, and utilities, while components and pages are at the root.

```
/                           # Root level (non-standard Vite setup)
├── App.tsx                 # Main app with HashRouter routing
├── index.tsx               # React entry point
├── types.ts                # All TypeScript interfaces and enums (SINGLE source of truth)
├── pages/                  # Page components (38 pages)
├── components/             # Shared UI components
├── src/
│   ├── config/firebase.ts  # Firebase initialization
│   ├── services/           # Firestore data access layer (CRUD operations)
│   ├── hooks/              # React hooks for data fetching (real-time listeners)
│   ├── utils/              # Currency, schedule, Excel utilities
│   ├── features/           # Feature-specific code (classes, students, etc.)
│   ├── test/               # Test setup and utilities
│   └── shared/components/  # Shared feature components
├── functions/              # Firebase Cloud Functions (TypeScript)
├── scripts/                # Data seeding and maintenance scripts
├── docs/                   # Database schema documentation
└── firestore.rules         # Firestore security rules
```

### Key Technologies

- **Frontend**: React 19, TypeScript, Vite 7, TailwindCSS (via classes)
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions)
- **Routing**: react-router-dom 7 with HashRouter
- **Charts**: Recharts
- **Icons**: lucide-react
- **Excel**: xlsx library for import/export

### Data Flow Pattern

**Critical Architecture**: Follow the three-layer pattern strictly:

1. **Services Layer** (`src/services/`) - Firestore CRUD operations
   - **Primary pattern**: Named function exports (79% of services)
     - Better tree-shaking, easier mocking, modern React/TS convention
     - Example: `export async function getStudents() { ... }`
   - **Legacy pattern**: Static class methods (21% of services)
     - Used by: StudentService, ClassService, StaffService, AuthService
     - Example: `StudentService.getStudents()`
   - Handle Firestore queries, mutations, and complex business logic
   - Return plain data or promises
   - No React hooks or state management

2. **Hooks Layer** (`src/hooks/`) - React state + real-time listeners
   - Wrap services with React state management
   - **Preferred**: Use `onSnapshot` for real-time Firestore updates
   - **Acceptable**: Use `getDocs` for one-time fetches (reports, lookups)
   - Return `{ data, loading, error }` pattern
   - Handle client-side filtering and search

3. **Pages Layer** (`pages/`) - UI and user interactions
   - Consume hooks for data
   - Render UI with components
   - Handle user events and form submissions

Example (Function Pattern - Preferred):
```typescript
// 1. Service: src/services/attendanceService.ts (Named exports)
export async function getAttendance(classId: string): Promise<Attendance[]> {
  const q = query(collection(db, 'attendance'), where('classId', '==', classId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Attendance[];
}

export async function markAttendance(data: AttendanceData): Promise<string> {
  const docRef = await addDoc(collection(db, 'attendance'), data);
  return docRef.id;
}

// 2. Hook: src/hooks/useAttendance.ts (Real-time listener)
export const useAttendance = (classId: string) => {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'attendance'), where('classId', '==', classId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Attendance[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [classId]);

  return { attendance, loading };
};

// 3. Page: pages/Attendance.tsx
export const Attendance = () => {
  const { attendance, loading } = useAttendance(classId);
  if (loading) return <LoadingSpinner />;
  return <AttendanceTable data={attendance} />;
};
```

Example (Class Pattern - Legacy):
```typescript
// Service: src/services/studentService.ts (Static class - legacy)
export class StudentService {
  static async getStudents(filters?: { status?: StudentStatus }): Promise<Student[]> {
    const q = query(collection(db, 'students'), where('status', '==', filters?.status));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
  }
}
```

### Firebase Region Configuration

**CRITICAL**: This project uses Firebase in **`asia-southeast1`** region.

- **Firestore**: `asia-southeast1` (Singapore)
- **Cloud Functions**: `asia-southeast1`
- **MCP Firebase queries**: May timeout if region not specified correctly

**For MCP Firebase tools**: Always be aware queries go to the correct regional endpoint to avoid `DEADLINE_EXCEEDED` or readtime errors.

**For scripts**: Use **Firebase REST API** instead of MCP tools for data operations:
```bash
# Example: Query Firestore via REST API
curl -X POST \
  "https://firestore.googleapis.com/v1/projects/PROJECT_ID/databases/(default)/documents:runQuery" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"structuredQuery": {...}}'
```

### Firestore Query Guidelines (MCP Firebase)

**CRITICAL**: Before querying Firestore via MCP tools:

1. **Check `types.ts`** for enum values - this is the SINGLE source of truth
2. **Use Vietnamese with diacritics** - all status values are in Vietnamese
3. **Region awareness**: Project uses `asia-southeast1` - queries may timeout if MCP defaults to different region

**Quick Reference - Common Status Values:**

| Collection | Field | Values |
|------------|-------|--------|
| students | status | `Đang học`, `Học thử`, `Nợ phí`, `Bảo lưu`, `Nghỉ học` |
| classes | status | `Đang học`, `Tạm dừng`, `Kết thúc` |
| staff | status | `Đang làm việc`, `Nghỉ việc` |
| contracts | status | `Đã thanh toán`, `Chưa thanh toán` |
| classSessions | status | `Đã học`, `Chưa học` |
| workSessions | status | `Đã xác nhận`, `Chờ xác nhận` |
| enrollments | status | `Đã xác nhận` |

**If unsure**: Query with `NOT_EQUAL ""` filter on a known field (e.g., `name`, `code`) to discover actual data structure first.

### Firestore Collections

Core collections (see `docs/FIRESTORE_SCHEMA.md` for full schema):
- `students` - Student records with enrollment history
- `classes` - Class definitions with schedules
- `staff` - Staff/teachers with roles and permissions
- `attendance` / `studentAttendance` - Attendance records
- `contracts` - Payment contracts and enrollments
- `workSessions` - Teacher work sessions for salary calculation
- `leads` / `campaigns` - CRM/marketing data

### Authentication & Permissions

- Firebase Auth for authentication
- Staff document in Firestore determines role/permissions
- Roles: `Quản trị viên` (Admin), `Quản lý` (Manager), `Giáo viên`, `Trợ giảng`, `Nhân viên`, `Sale`, `Văn phòng`
- Permission hook: `src/hooks/usePermissions.tsx`

### Route Structure

Routes are organized by domain in `App.tsx`:
- `/training/*` - Classes, schedule, attendance, tutoring
- `/customers/*` - Students, parents, feedback
- `/business/*` - Leads, campaigns (CRM)
- `/hr/*` - Staff, salary, work confirmation
- `/finance/*` - Contracts, invoices, revenue, debt
- `/reports/*` - Training, finance, monthly reports
- `/settings/*` - Products, rooms, curriculum, center config

### Environment Variables

Required in `.env.local`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
GEMINI_API_KEY=  # For AI features

# Firebase Admin SDK (for scripts only - NOT for frontend)
GOOGLE_APPLICATION_CREDENTIALS=./edumanager-pro-6180f-firebase-adminsdk-fbsvc-0637614afa.json
```

### Firebase Admin SDK Scripts

**When writing scripts that need Firestore admin access:**

1. **Load `.env.local` explicitly** (NOT `import 'dotenv/config'` which only loads `.env`):
```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Admin SDK (only once)
if (!getApps().length) {
  initializeApp({
    credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!)
  });
}

const db = getFirestore();
```

2. **Run script**: `npx tsx scripts/your-script.ts`

**IMPORTANT**:
- Service account key file is gitignored - NEVER commit it
- Use Admin SDK for scripts only, NOT for frontend code
- Frontend uses client SDK with security rules
- **DO NOT use** `import * as admin from 'firebase-admin'` - it fails in ESM (`"type": "module"`). Use modular imports above.
- **Client SDK CANNOT be used for scripts** - Firestore security rules block unauthenticated access

### Path Aliases

- `@/*` maps to project root (configured in `vite.config.ts` and `tsconfig.json`)

## Testing

Tests use Vitest with jsdom and React Testing Library:
- Test files: `**/*.{test,spec}.{ts,tsx}`
- Setup: `src/test/setup.ts`
- Mock Firebase services when testing hooks
- Coverage reports generated in `coverage/` directory

Run tests:
```bash
# Watch mode (auto-rerun on changes)
npm run test

# Run once (CI/CD mode)
npm run test:run

# Run specific test file
npx vitest run src/services/permissionService.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests matching a pattern
npx vitest run --grep "StudentService"
```

**Testing Pattern**:
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('StudentService', () => {
  it('should fetch students with status filter', async () => {
    // Mock Firestore
    const mockStudents = [{ id: '1', name: 'Test' }];
    vi.mock('firebase/firestore');

    // Test service
    const result = await StudentService.getStudents({ status: StudentStatus.ACTIVE });

    expect(result).toEqual(mockStudents);
  });
});
```

## Important Patterns

### Vietnamese Language

All UI text, statuses, and enums are in Vietnamese:
- Status values: `'Đang học'`, `'Bảo lưu'`, `'Nghỉ học'`, etc.
- Use existing enum values from `types.ts` for consistency

### Currency Handling

Use `formatCurrency()` from `src/utils/currencyUtils.ts` for VND formatting.

### Real-time Updates

Most hooks use Firestore `onSnapshot` for real-time data. When modifying data, updates propagate automatically to all components using the same hook.

### Multi-class Support

Students can enroll in multiple classes:
- `classIds: string[]` array for enrolled classes
- Primary class stored in `classId`

### Enrollment Records

When students enroll or change classes, create an `EnrollmentRecord` entry to maintain audit history. Types include: `'Hợp đồng mới'`, `'Hợp đồng tái phí'`, `'Chuyển lớp'`, `'Tặng buổi'`, etc.

### Timestamp Conversion

Firestore uses Timestamps. When reading data, convert to ISO strings for consistency:

```typescript
// Reading from Firestore
const student = {
  ...doc.data(),
  dob: doc.data().dob?.toDate?.()?.toISOString() || doc.data().dob || '',
  createdAt: doc.data().createdAt?.toDate?.()?.toISOString()
};

// Writing to Firestore
import { Timestamp } from 'firebase/firestore';
await addDoc(collection(db, 'students'), {
  ...studentData,
  dob: Timestamp.fromDate(new Date(studentData.dob)),
  createdAt: Timestamp.now()
});
```

## Common Workflows

### Adding a New Feature

1. **Define types** in `types.ts` (single source of truth)
2. **Create service** in `src/services/[feature]Service.ts` (prefer function exports)
3. **Create hook** in `src/hooks/use[Feature].ts` (prefer onSnapshot for real-time)
4. **Create page** in `pages/[Feature]Manager.tsx` consuming the hook
5. **Add route** in `App.tsx` under appropriate domain section
6. **Update Firestore rules** in `firestore.rules` if needed
7. **Write tests** for service and hook logic
8. **Update documentation** in `docs/` if adding new collections

### Debugging Firestore Issues

```bash
# Check Firestore rules locally
firebase emulators:start --only firestore

# Query Firestore directly
npx tsx scripts/checkDataConsistency.ts

# View data in Firebase Console
# https://console.firebase.google.com

# Check Firestore indexes
# Review firestore.indexes.json and Firebase Console
```

### Data Migrations & Scripts

When schema changes require data migration:
1. Create a script in `scripts/` directory
2. **Use Firebase REST API** for data operations (not MCP tools)
3. Use `npx tsx scripts/[migration-name].ts` to run
4. Test on emulator first: `firebase emulators:start`
5. Run with caution on production data
6. Document the migration in `docs/`

**Script Requirements**:
- **MUST use Firebase Admin SDK** (not client SDK - security rules block unauthenticated access)
- Handle `asia-southeast1` region explicitly
- Include proper error handling and logging
- Always implement **dry-run mode** (default) with `--execute` flag for production scripts

Example migration script pattern:
```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!) });
}
const db = getFirestore();
const IS_DRY_RUN = !process.argv.includes('--execute');

async function migrateStudentData() {
  const studentsSnap = await db.collection('students').get();

  for (const studentDoc of studentsSnap.docs) {
    const data = studentDoc.data();
    // Migration logic here
    if (!IS_DRY_RUN) {
      await db.collection('students').doc(studentDoc.id).update({
        newField: computeNewValue(data)
      });
    }
  }
}

migrateStudentData().catch(console.error);
```

---

## Lessons Learned (Production Bug Fixes - Feb 2026)

### Attendance System Architecture

**Session counting is EXCLUSIVELY handled by Cloud Functions** (`functions/src/triggers/studentAttendanceTriggers.ts`):
- `onStudentAttendanceCreate` - Recalculates `attendedSessions`, `remainingSessions`, and student status
- `onStudentAttendanceUpdate` - Handles status changes
- `onStudentAttendanceDelete` - Recalculates on deletion

**DO NOT count sessions on client-side** - this causes race conditions with Cloud Function triggers, leading to double-counting of `attendedSessions`.

### Attendance Record Types
- Records **WITH `sessionId`** = regular class attendance (counts toward `attendedSessions`)
- Records **WITHOUT `sessionId`** = makeup sessions (tracked separately)

### Status Values - Legacy Data Trap

`PRESENT_STATUSES` in Cloud Functions MUST include both legacy and current values:
```typescript
const PRESENT_STATUSES = ['Đúng giờ', 'Trễ giờ', 'Đã bồi', 'Có mặt', 'Đến trễ'];
```
If only current values are used, Cloud Functions will NEVER detect present students for records saved with legacy statuses. This was the root cause of all 9 classes showing wrong data.

### Firebase CLI Deploy Caching

Firebase CLI caches source hashes. When code changes aren't detected:
1. Delete `.firebase/` directory
2. Clean `functions/lib/` directory
3. Deploy specific functions by name:
```bash
firebase deploy --only functions:onStudentAttendanceCreate,functions:onStudentAttendanceUpdate
```

### Student Status Transitions
```
registeredSessions > 0:
  remaining > 0  → 'Đang học'
  remaining == 0 → 'Đã học hết phí'
  remaining < 0  → 'Nợ phí' (with debtSessions = abs(remaining))

Skip statuses (don't auto-update): 'Nghỉ học', 'Bảo lưu', 'Học thử', 'Nợ hợp đồng'
```

### Admin Fix Service (`src/services/adminFixService.ts`)

Utility functions for one-time data repairs:
- `recalculateClassStudentData(classId)` - Recalculate from actual attendance records
- `resetClassAttendance(classId)` - Destructively reset all attendance
- `removeStudentFromClass(studentId, classId)` - Remove with cleanup
- `fixStudentRegisteredSessions(studentId, classId, correctSessions)` - Fix session count

### Firestore Timestamp Comparison Trap (Mar 2026)

**NEVER compare Firestore Timestamps with `===`/`!==`** - they are objects, so reference comparison ALWAYS returns `true` for `!==`.

```typescript
// BUG: always true (comparing object references)
const startDateChanged = before.startDate !== after.startDate;

// FIX: compare by value using duck typing (handles both Timestamp and string)
const toDateStr = (v: any) => v?.toMillis ? v.toMillis().toString() : String(v || '');
const startDateChanged = toDateStr(before.startDate) !== toDateStr(after.startDate);
```

This bug caused `onClassUpdate` to regenerate sessions on EVERY class update, creating an indirect infinite loop:
`delete session → onSessionDelete → updateClassProgress() → onClassUpdate → regenerateSessionsForClass() → re-create deleted session`

### Session Trigger Chain (Watch out!)

`onSessionCreate/Update/Delete` (`functions/src/triggers/sessionTriggers.ts`) → calls `updateClassProgress()` → updates class doc (`completedSessions`, `progress`, `updatedAt`) → triggers `onClassUpdate` (`functions/src/triggers/classTriggers.ts`) → may call `regenerateSessionsForClass()`.

**Rule**: Only regenerate when schedule/totalSessions/startDate ACTUALLY change (compare values, not references).

### Holiday System (Dual System)

Two independent systems when holiday is toggled "Đã áp dụng":
1. **Client** (`src/services/holidayService.ts`): Creates `attendance` records with `status: 'LỊCH NGHỈ CHUNG'`
2. **Cloud Function** (`functions/src/triggers/holidayTriggers.ts`): Changes `classSessions.status` to `'Nghỉ'`

These can get out of sync if Cloud Function fails/delays. Session generation auto-checks active holidays (Mar 2026 fix).

### Class-to-Attendance Flow

Complete flow documented in `docs/class-to-attendance-flow.md`:
- Class create → auto-generate sessions (Cloud Function)
- Holiday apply → mark sessions as "Nghỉ" (dual system)
- Attendance → save records → Cloud Function recalculates student data
- Schedule change → regenerate sessions → auto-renumber by date
