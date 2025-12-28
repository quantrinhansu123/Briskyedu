# EduManager Pro - Project Memory

**Last Updated:** 2025-12-28 14:28

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
| **Quality Score** | 6.5/10 (security fixes pending) |
| **Progress** | Mature codebase, actively maintained |
| **Last Commit** | `c62df9e` chore(git): add repomix files to gitignore |
| **Active Plan** | `plans/251226-2134-codebase-review/plan.md` |
| **Next Priority** | Phase 1: Security Fixes (P0) |

---

## Architecture Quick Ref

### Structure (Non-standard Vite)
```
/                    # Root level (source at root, NOT in src/)
├── App.tsx          # Main app with HashRouter (38 routes)
├── index.tsx        # React entry point
├── types.ts         # ALL TypeScript interfaces/enums (27 + 9)
├── pages/           # 37 page components (7 domains)
├── components/      # 5 shared UI components
├── docs/            # 33 documentation files + 8 ADRs
├── plans/           # 40+ plan files + reports
├── src/
│   ├── config/firebase.ts
│   ├── services/    # 28 Firestore CRUD services (static class)
│   ├── hooks/       # 29 React hooks (real-time listeners)
│   └── utils/       # 12 utility files
├── functions/       # 8 Cloud Function triggers
├── scripts/         # 18 maintenance scripts
└── firestore.rules  # 35 collection rules
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

### Last Session (2025-12-28 14:28)
- Full documentation update completed
- 4 scout agents cataloged codebase
- 5 doc files updated
- Session memory synced

### Previous Session (2025-12-26)
- Codebase review completed
- 5-phase improvement plan created
- Data consistency improvements made

### Next Priority
- Phase 1: Security Fixes (P0)
- See `plans/251226-2134-codebase-review/phases/phase-01-security.md`
- 4 critical issues: Firestore rules, permissions, staff auth, salary privacy

### Recommended Skills
- `frontend-development` - React/TypeScript patterns
- `databases` - Firebase/Firestore operations
- `backend-development` - Cloud Functions

---

## Documentation Updated

| File | Updated |
|------|---------|
| `docs/codebase-summary.md` | 2025-12-28 |
| `docs/system-architecture.md` | 2025-12-28 |
| `docs/code-standards.md` | 2025-12-28 |
| `docs/project-roadmap.md` | 2025-12-28 |
| `README.md` | 2025-12-28 |

---

## Notes

- All UI text in Vietnamese
- Uses HashRouter (hash-based routing)
- Multi-class support: students can enroll in multiple classes
- Path alias: `@/*` maps to project root
- 8 ADRs documented in `docs/decisions/`
