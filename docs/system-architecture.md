# EduManager Pro - System Architecture

**Last Updated**: January 3, 2026

## Overview

EduManager Pro uses a strict 3-layer architecture (Services → Hooks → Pages) with Firebase as the backend. This is a Single Page Application (SPA) with client-side rendering and real-time data synchronization. The system manages 37+ Firestore collections across 8 domains via:
- **37 Services**: Static class methods for CRUD operations
- **39 Hooks**: Real-time listeners with onSnapshot pattern
- **40 Pages**: Domain-organized UI components + 3 dashboard pages + router
- **7 Feature Modules**: Encapsulated domain-specific logic (students, classes, attendance, contracts, reports, debt, inventory)
- **15+ Cloud Functions**: Event-driven triggers and background jobs

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    React 19 Application                      ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │   Pages     │  │  Components │  │      Router         │ ││
│  │  │  (40 pages) │  │  (17 total) │  │  (HashRouter)       │ ││
│  │  └──────┬──────┘  └─────────────┘  └─────────────────────┘ ││
│  │         │                                                    ││
│  │  ┌──────▼─────────────────────────────────────────────────┐ ││
│  │  │                    Hooks Layer                          │ ││
│  │  │  • Real-time listeners (onSnapshot)                     │ ││
│  │  │  • State management                                     │ ││
│  │  │  • Client-side filtering                                │ ││
│  │  └──────┬─────────────────────────────────────────────────┘ ││
│  │         │                                                    ││
│  │  ┌──────▼─────────────────────────────────────────────────┐ ││
│  │  │                   Services Layer                        │ ││
│  │  │  • Firestore CRUD operations                            │ ││
│  │  │  • Business logic                                       │ ││
│  │  │  • Static class methods                                 │ ││
│  │  └──────┬─────────────────────────────────────────────────┘ ││
│  └─────────┼───────────────────────────────────────────────────┘│
└────────────┼────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FIREBASE SERVICES                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Firebase   │  │  Cloud      │  │      Cloud              │ │
│  │  Auth       │  │  Firestore  │  │      Functions          │ │
│  │             │  │  (NoSQL DB) │  │      (serverless)       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                  │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐  │
│  │  Cloud      │  │           Firebase Hosting               │  │
│  │  Storage    │  │           (Static hosting)               │  │
│  └─────────────┘  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Three-Layer Architecture

### Layer 1: Services (`src/services/`)

**Purpose**: Firestore CRUD operations và business logic

**Pattern**: Static class methods

```typescript
export class StudentService {
  static async getStudents(filters?: { status?: StudentStatus }): Promise<Student[]> {
    const q = query(collection(db, 'students'), where('status', '==', filters?.status));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
  }

  static async updateStudent(id: string, data: Partial<Student>): Promise<void> {
    await updateDoc(doc(db, 'students', id), data);
  }
}
```

**Key Services**:
- `studentService.ts` - Student CRUD
- `classService.ts` - Class management
- `attendanceService.ts` - Attendance tracking
- `contractService.ts` - Contract management
- `permissionService.ts` - Role-based access control

### Layer 2: Hooks (`src/hooks/`)

**Purpose**: React state management + real-time listeners

**Pattern**: Custom hooks với `{ data, loading, error }`

```typescript
export const useStudents = (filters?: { status?: StudentStatus }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
      setStudents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { students, loading, error };
};
```

**Key Hooks**:
- `useStudents.ts` - Real-time student data
- `useClasses.ts` - Real-time class data
- `useAuth.ts` - Authentication state
- `usePermissions.tsx` - Permission checking

### Layer 3: Pages (`pages/`)

**Purpose**: UI rendering và user interactions

**Pattern**: Consume hooks, render UI

```typescript
export const StudentManager = () => {
  const { students, loading } = useStudents();
  const { hasPermission } = usePermissions();

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {students.map(student => (
        <StudentCard
          key={student.id}
          student={student}
          canEdit={hasPermission('students:edit')}
        />
      ))}
    </div>
  );
};
```

## Data Flow

```
┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│   Firestore  │ ──► │    Service    │ ──► │    Hook     │
│   (Database) │     │ (CRUD + Logic)│     │ (State)     │
└──────────────┘     └───────────────┘     └──────┬──────┘
       ▲                                          │
       │                                          ▼
       │                                   ┌─────────────┐
       │                                   │    Page     │
       │                                   │    (UI)     │
       │                                   └──────┬──────┘
       │                                          │
       └──────────────────────────────────────────┘
                    (User Actions)
```

## Real-time Updates

Hệ thống sử dụng Firestore `onSnapshot` cho real-time updates:

```typescript
// Data automatically updates across all components
const unsubscribe = onSnapshot(
  query(collection(db, 'students')),
  (snapshot) => {
    // Auto-update UI when data changes
    setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }
);
```

## Authentication & Authorization

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │ ──► │  Firebase   │ ──► │   useAuth   │
│   Page      │     │    Auth     │     │    Hook     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ Protected   │
                                        │   Route     │
                                        └─────────────┘
```

### Authorization (Role-Based)

```
┌─────────────────────────────────────────────────────────┐
│                    PERMISSION HIERARCHY                  │
├─────────────────────────────────────────────────────────┤
│  Quản trị viên (Admin)    → Full access                 │
│  Quản lý (Manager)        → Most features, no admin     │
│  Giáo viên (Teacher)      → Classes, attendance, salary │
│  Trợ giảng (Assistant)    → Limited class access        │
│  Nhân viên/Sale/Văn phòng → CRM, basic features         │
└─────────────────────────────────────────────────────────┘
```

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/staff/$(request.auth.uid))
          .data.role in ['Quản trị viên', 'Quản lý'];
    }

    function isStaff() {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/staff/$(request.auth.uid));
    }

    match /students/{studentId} {
      allow read: if isStaff();
      allow write: if isStaff();
    }
    // ... more rules
  }
}
```

## Firestore Collections (37+ Total)

The system utilizes 37+ Firestore collections organized across multiple domains:

| Category | Collections | Purpose |
|----------|-------------|---------|
| **Core** | students, classes, staff | Core entities |
| **Operational** | attendance, studentAttendance, contracts, enrollments, workSessions, invoices | Business operations |
| **Finance** | invoices, contracts, revenue, debt, settlementInvoices | Financial management + settlement tracking |
| **Business** | leads, campaigns, parents, feedback | CRM and customer relations |
| **Configuration** | products, rooms, curriculum, salaryConfigs, centerSettings | System configuration |
| **Salary** | monthlySalaries, salaryRecords | Salary calculation and reporting |
| **Reporting** | reports, analytics, comments | Business intelligence |

For a comprehensive and up-to-date schema with all 37+ collections, refer to `docs/FIRESTORE_SCHEMA.md`.

## Cloud Functions Architecture (15+ Total)

Serverless functions in `/functions/src/triggers/` provide backend automation and event-driven processing:

```
┌──────────────────────────────────────────────┐
│    Cloud Functions (15+ Total)               │
├──────────────────────────────────────────────┤
│  ├─ Core Triggers (6)                        │
│  │  ├─ onClassCreate/Update/Delete           │
│  │  ├─ onStudentCreate/Update/Delete         │
│  │  ├─ onContractCreate/Update               │
│  │  ├─ onAttendanceWrite                     │
│  │  ├─ onSessionComplete                     │
│  │  └─ onHolidayUpdate                       │
│  ├─ Specialized Triggers (5)                 │
│  │  ├─ homeworkTriggers                      │
│  │  ├─ staffTriggers                         │
│  │  ├─ settlementInvoiceTriggers             │
│  │  ├─ calculateMonthlySalaries (1st/month)  │
│  │  └─ recalculateStudentStats (daily 2 AM)  │
│  └─ Utilities (3+)                           │
│     ├─ Batch operations                      │
│     ├─ Schedule parsers                      │
│     └─ PDF generation (settlements)          │
└──────────────────────────────────────────────┘
```

### Core Triggers (Event-driven)

**Class Operations**:
- `onClassCreate` - Auto-generate workSessions for class schedule
- `onClassUpdate` - Cascade updates to enrollments and attendance
- `onClassDelete` - Cleanup sessions, cascade to student records

**Student Management**:
- `onStudentCreate` - Initialize student record with default values
- `onStudentUpdate` - Calculate bad debt status, cascade to contracts
- `onStudentDelete` - Cleanup enrollments, attendance, contracts (cascade)

**Financial Operations**:
- `onContractCreate` - Auto-create enrollments with paid sessions from contract
- `onContractUpdate` - Recalculate enrollments if contract terms change
- `onAttendanceWrite` - Update student stats, trigger tutoring if needed

**Work & Salary**:
- `onSessionComplete` - Accumulate work hours, calculate session salary
- `onHolidayUpdate` - Apply/remove sessions during holiday periods

### Specialized Triggers (Background Processing)

**Scheduled Jobs**:
- `calculateMonthlySalaries` - Scheduled for 1st of each month
  - Aggregates all work sessions
  - Calculates position-based salary + bonuses
  - Generates monthlySalarySummary documents
  - Handles salary adjustments and penalties

- `recalculateStudentStats` - Daily 2 AM batch update
  - Recalculates debt calculations
  - Updates class enrollment stats
  - Refreshes analytics data

**Real-time Operations**:
- `settlementInvoiceTriggers` - Debt settlement tracking
  - Generate settlement invoices for students with bad debt
  - Track settlement status and payment history
  - Generate PDF invoices for printing

- `homeworkTriggers` - Homework assignment tracking
  - Track homework submissions
  - Update student progress

- `staffTriggers` - Staff account management
  - Create/update staff accounts in Firebase Auth
  - Sync permission changes
  - Handle role transitions

### Utilities

- **Batch Operations**: Bulk inserts, updates, exports
- **Schedule Parsers**: Parse weekly class schedules into workSessions
- **PDF Generation**: Generate settlement invoices for download/printing
- **Staff Triggers**: Account creation and permission management

**Benefits**:
- Offload heavy computation from client
- Automate recurring tasks (attendance sync, salary calculations)
- Enforce business logic at backend
- Maintain data consistency across collections
- Decouple frontend from backend operations

## Route Structure

Routes are organized by domain within `App.tsx` using `react-router-dom`'s `HashRouter`. This approach helps categorize features and define clear navigation paths:
-   `/training/*`: Classes, schedule, attendance, tutoring
-   `/customers/*`: Students, parents, feedback
-   `/business/*`: Leads, campaigns (CRM)
-   `/hr/*`: Staff, salary, work confirmation
-   `/finance/*`: Contracts, invoices, revenue, debt
-   `/reports/*`: Training, finance, monthly reports
-   `/settings/*`: Products, rooms, curriculum, center config

## Module Dependencies

```
types.ts (Single Source of Truth)
    │
    ├── src/config/firebase.ts
    │       │
    │       ├── src/services/*.ts
    │       │       │
    │       │       └── src/hooks/*.ts
    │       │               │
    │       │               └── pages/*.tsx
    │       │
    │       └── src/utils/*.ts
    │
    └── components/*.tsx
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DEPLOYMENT FLOW                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Developer  ──►  npm run build  ──►  firebase deploy    │
│                       │                    │             │
│                       ▼                    ▼             │
│              ┌─────────────┐       ┌─────────────┐      │
│              │   dist/     │       │  Firebase   │      │
│              │  (static)   │  ──►  │  Hosting    │      │
│              └─────────────┘       └─────────────┘      │
│                                                          │
│  Rules  ──►  firebase deploy --only firestore:rules     │
│                       │                                  │
│                       ▼                                  │
│              ┌─────────────┐                            │
│              │  Firestore  │                            │
│              │   Rules     │                            │
│              └─────────────┘                            │
└─────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Non-standard folder structure**: Source files at root level (not in `src/`) for faster development
2. **Static class methods for services**: Simpler than instantiated classes
3. **Real-time listeners by default**: `onSnapshot` instead of `getDocs` for live updates
4. **Single types.ts file**: All interfaces in one place for easier maintenance
5. **HashRouter**: Works better with Firebase Hosting static deployment
6. **Vietnamese UI text**: All statuses and enums in Vietnamese for end users

## Dashboard Architecture (Role-Based)

The Dashboard component (`pages/Dashboard.tsx`) implements role-based widget rendering to provide tailored views for different user roles:

### Office Dashboard (Admin, Manager, Lead, Staff, Kế toán)

**Core Widgets:**
- Dashboard stats header (total students, classes, staff)
- Attendance insights (top absences, punctuality)
- Common widgets: Sinh nhật, Vật phẩm kho (visible to !isTeacher)

**Role-Specific Sections:**
- **Revenue Module** (`canSeeRevenue`): Doanh số, Doanh thu, Revenue charts (Admin/Manager/Lead/Kế toán)
- **Work Sessions** (`canSeeRevenue`): Salary data for office staff

**CSKH/Sale Specific Widgets:**
- Số ngày công (Work Days summary)
- DS sắp hết phí (Students with expiring contracts)
- DS nợ phí (Students with debt)
- Checklist (Daily tasks/reminders)

### Teacher Dashboard (Giáo Viên, Trợ Giảng)

**Purpose**: Personal dashboard for teachers to manage classes, students, and salary

**Key Widgets:**
1. **My Classes Stats Header**
   - Total classes taught
   - Total students across classes
   - Average students per class

2. **My Classes List**
   - Classes assigned to teacher (filtered by staffId)
   - Schedule details per class
   - Student enrollment info

3. **Upcoming Classes**
   - Classes scheduled for today and this week
   - Time-based sorting
   - Quick action buttons

4. **BTVN Reports Needed**
   - Homework assignments pending feedback
   - Student progress tracking
   - Report submission status

5. **Student Alerts**
   - Top students by absences
   - Low homework submission students
   - At-risk student identification

6. **My Class Birthdays**
   - Upcoming student birthdays (filtered by my classes)
   - Birthday date organization

7. **Monthly Salary**
   - Confirmed salary (tính công)
   - Pending salary (chưa tính công)
   - Work session aggregation

**Data Isolation**: All data filtered by `staffId` for data security and personalization

### Permission Flags

**canSeeRevenue**: Boolean flag determining revenue module visibility
- Set to true for: Admin, Manager, Lead, Kế toán
- Set to false for: Staff, CSKH, Sale, GV, TG

**isTeacher**: Boolean flag determining teacher/GV status
- Set to true for: Giáo viên, Trợ giảng roles
- Used to hide office-specific widgets from teachers

### Data Flow

```
usePermissions() ────┐
                     ├──► Dashboard (role-based rendering)
useAuth() ───────────┤
                     └──► Widget components (filtered by staffId)

useClasses() ────┐
useStaff() ──────├──► Teacher Dashboard widgets (GV/TG only)
useLeaveBalance()┤
useSalaryData() ─┘
```

## Tutoring System (Lịch Bồi Bài)

### Status Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    TUTORING STATUS TRANSITIONS                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Vắng in attendance] ──► auto-create ──► Chưa bồi               │
│                                              │                    │
│                                              ▼                    │
│                                           Đã hẹn ◄─── Undo       │
│                                         (scheduled)   (Admin)     │
│                                              │                    │
│                     ┌────────────────────────┼────────────────┐  │
│                     │                        │                │  │
│                     ▼                        ▼                ▼  │
│                 Đã bồi               Nghỉ tính phí      Nghỉ bảo lưu
│              (completed)           (charged absence)  (reserved)  │
│                     │                        │                │  │
│                     ▼                        │                ▼  │
│         studentAttendance           No attendance      studentAttendance
│         status = "Đã bồi"             change          status = "Bảo lưu"
│                     │                        │                │  │
│                     ▼                        │                ▼  │
│         Cloud Function:                      │         Extend course
│         attendedSessions++                   │         expectedEndDate
│                                              │                    │
└──────────────────────────────────────────────────────────────────┘
```

### Data Link

```
tutoring.studentAttendanceId ──► studentAttendance.id
                                        │
                                        ▼
                              Cloud Function triggers
                              on status change
```

### TutoringStatus Values

| Status | Description | Effect |
|--------|-------------|--------|
| `Chưa bồi` | Not scheduled | Initial state |
| `Đã hẹn` | Scheduled | Date/time/tutor set |
| `Đã bồi` | Completed | Updates studentAttendance → triggers CF → attendedSessions++ |
| `Nghỉ tính phí` | Charged absence | Requires reason, no attendance update, session counts as used |
| `Nghỉ bảo lưu` | Reserved absence | Updates studentAttendance to "Bảo lưu", extends course end date |
| `Hủy` | Cancelled | No side effects |

### Key Service Functions

- `completeTutoring(id, userId)` - Updates both tutoring and studentAttendance
- `markChargedAbsence(id, userId, reason)` - Requires reason, no attendance update
- `markReservedAbsence(id, userId)` - Updates attendance, extends course
- `undoTutoring(id, userId)` - Reverts to "Đã hẹn" (Admin/Manager only)
- `softDeleteTutoring(id, userId)` - 30-day retention before permanent delete
