# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
```

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

### Data Migrations

When schema changes require data migration:
1. Create a script in `scripts/` directory
2. Use `npx tsx scripts/[migration-name].ts` to run
3. Test on emulator first: `firebase emulators:start`
4. Run with caution on production data
5. Document the migration in `docs/`

Example migration script pattern:
```typescript
import { db } from '../src/config/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

async function migrateStudentData() {
  const studentsSnap = await getDocs(collection(db, 'students'));

  for (const studentDoc of studentsSnap.docs) {
    const data = studentDoc.data();
    // Migration logic here
    await updateDoc(doc(db, 'students', studentDoc.id), {
      newField: computeNewValue(data)
    });
  }
}

migrateStudentData().catch(console.error);
```
