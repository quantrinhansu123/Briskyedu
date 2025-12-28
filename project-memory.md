# EduManager Pro - Project Memory

**Last Updated:** 2025-12-28 14:08

---

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | EduManager Pro |
| **Type** | Education Center Management System (Vietnamese) |
| **Stack** | React 19 + TypeScript + Firebase + Vite 7 |
| **Framework** | Firebase (Auth, Firestore, Cloud Functions, Hosting) |
| **UI** | TailwindCSS + lucide-react icons + Recharts |
| **Language** | Vietnamese (all UI, enums, statuses) |

---

## Current State

| Metric | Value |
|--------|-------|
| **Branch** | main |
| **Uncommitted** | 2 files (edumanager-context.txt, project-memory.md) |
| **Progress** | Mature codebase, actively maintained |
| **Last Commit** | `c62df9e` chore(git): add repomix files to gitignore |
| **Docs** | 32 files in `./docs/` |
| **Plans** | 38 files in `./plans/` |

---

## Architecture Quick Ref

### Structure (Non-standard Vite)
```
/                    # Root level (source at root, NOT in src/)
├── App.tsx          # Main app with HashRouter
├── index.tsx        # React entry point
├── types.ts         # ALL TypeScript interfaces/enums (591 lines)
├── pages/           # 36 page components
├── components/      # Shared UI components
├── docs/            # 32 documentation files + ADRs
├── plans/           # 38 plan files + reports + templates
├── src/
│   ├── config/firebase.ts
│   ├── services/    # 30 Firestore CRUD services (static class methods)
│   ├── hooks/       # 29 React hooks (real-time listeners)
│   └── utils/       # Currency, schedule, Excel utilities
├── functions/       # Firebase Cloud Functions
├── scripts/         # Data seeding and maintenance
└── firestore.rules  # Security rules
```

### Three-Layer Pattern
1. **Services** (`src/services/`) - Static class methods for Firestore CRUD
2. **Hooks** (`src/hooks/`) - React state + `onSnapshot` real-time listeners
3. **Pages** (`pages/`) - UI consuming hooks

### Core Collections
- `students` - Student records with enrollment history
- `classes` - Class definitions with schedules
- `staff` - Staff/teachers with roles
- `attendance`/`studentAttendance` - Attendance records
- `contracts` - Payment contracts and enrollments
- `workSessions` - Teacher work sessions for salary

---

## Active Plans

### Codebase Review Plan (2025-12-26)
**Path:** `plans/251226-2134-codebase-review/plan.md`
**Status:** Review Complete, Implementation Pending

| Phase | Name | Priority | Status |
|-------|------|----------|--------|
| 1 | Security Fixes | P0 | Pending |
| 2 | Type Safety & DRY | P1 | Pending |
| 3 | Hooks Consistency | P2 | Pending |
| 4 | Service Layer | P2 | Pending |
| 5 | Test Coverage | P3 | Pending |

### Key Issues Found
- 4 critical security issues (Firestore rules, permissions)
- 6 instances of `any` type
- 15+ DRY violations
- Only 25% pages have permission checks

---

## Recent Activity (Last 10 Commits)

1. `c62df9e` chore(git): add repomix files to gitignore
2. `af5bcce` fix(data): improve class and attendance data consistency
3. `704e94f` feat: Add student editing modal, new attendance/class services
4. `6235f81` fix: properly track attendance increments for historical data
5. `fb0c8b1` fix: use MAX of current/counted attendance (never decrease)
6. `56e44db` fix: also update remainingSessions field when recalculating status
7. `4059d4b` feat: add manual status recalculation for students
8. `06180b8` fix: auto-update student status when sessions exhausted
9. `558ce43` feat: multi-role salary config & UI improvements
10. `08107bb` refactor(components): extract modal components from large pages

---

## Key Files to Know

| Purpose | File |
|---------|------|
| All Types | `types.ts` |
| Routes | `App.tsx` |
| Firebase Config | `src/config/firebase.ts` |
| Student Service | `src/services/studentService.ts` |
| Attendance Service | `src/services/attendanceService.ts` |
| Data Integrity | `src/services/dataIntegrityService.ts` (1130 lines) |
| Security Rules | `firestore.rules` |
| Codebase Summary | `docs/codebase-summary.md` |
| System Architecture | `docs/system-architecture.md` |

---

## Development Commands

```bash
npm run dev              # Dev server port 3000
npm run build            # Production build
npm run test             # Vitest watch mode
npm run test:run         # Tests once (CI)
npm run test:coverage    # Coverage report
firebase emulators:start # Local emulators
firebase deploy          # Deploy to Firebase
```

---

## Session Continuity

### Last Session Focus
- Codebase review completed (2025-12-26)
- 5-phase improvement plan created
- Data consistency improvements made
- Student editing modal added
- Attendance tracking fixes

### Next Priority
- Phase 1: Security Fixes (P0)
- See `plans/251226-2134-codebase-review/phases/phase-01-security.md`

### Recommended Skills
- `frontend-development` - React/TypeScript patterns
- `databases` - Firebase/Firestore operations
- `debugging` - If investigating issues

---

## Notes

- All UI text in Vietnamese
- Uses HashRouter (hash-based routing)
- Multi-class support: students can enroll in multiple classes
- Path alias: `@/*` maps to project root
- 6 ADRs documented in `docs/decisions/`
