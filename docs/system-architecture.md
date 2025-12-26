# EduManager Pro - System Architecture

## Overview

EduManager Pro sử dụng kiến trúc 3-layer (Services → Hooks → Pages) với Firebase làm backend. Đây là một Single Page Application (SPA) với client-side rendering và real-time data synchronization.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    React 19 Application                      ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │   Pages     │  │  Components │  │      Router         │ ││
│  │  │  (36 pages) │  │  (shared)   │  │  (HashRouter)       │ ││
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

## Firestore Collections

The system utilizes 28+ Firestore collections to store various data. Key collections include:
-   `students`: Student records with enrollment history.
-   `classes`: Class definitions and schedules.
-   `staff`: Staff/teacher profiles with roles and permissions.
-   `attendance`/`studentAttendance`: Records for student attendance.
-   `contracts`: Payment contracts and enrollment details.
-   `workSessions`: Teacher work sessions for salary calculation.
-   `leads`/`campaigns`: CRM and marketing data.

For a comprehensive and up-to-date schema, refer to `docs/FIRESTORE_SCHEMA.md`.

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
