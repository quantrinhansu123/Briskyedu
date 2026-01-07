# EduManager Pro - Project Memory

**Last Updated:** 2026-01-07 15:50

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
| **Quality Score** | 6.5/10 (Multi-module bug fixes complete) |
| **Progress** | v1.0.1 Stable, 40 pages, 294+ tests |
| **Last Commit** | `a329d08` feat(debt-management): add contract start date and expected end date columns |
| **Active Plans** | Post-1.0.1 Feature Enhancements ✅ | Dashboard Phases 1-4 ✅ | Monthly Salary ✅ |
| **Next Priority** | v1.1 security hardening, code quality improvements |

---

## Architecture Quick Ref

### Structure (Non-standard Vite)
```
/                    # Root level (source at root, NOT in src/)
├── App.tsx          # Main app with HashRouter (40+ routes)
├── index.tsx        # React entry point
├── types.ts         # ALL TypeScript interfaces/enums (50+ interfaces, 7 enums)
├── pages/           # 40 page components (7 domains + auth + dashboard)
├── components/      # 17 shared UI components (6 root + 11 dashboard widgets)
├── docs/            # 31 documentation files + 8 ADRs
├── plans/           # 40+ plan files + reports
├── src/
│   ├── config/firebase.ts
│   ├── services/    # 34 Firestore CRUD services (static class)
│   ├── hooks/       # 39 React hooks (12 real-time + 19 fetch + 2 hybrid)
│   ├── utils/       # 12 utility files
│   └── features/    # 5 active feature modules (students, classes, attendance, reports, debt)
├── functions/       # 15+ Cloud Functions (10 modules + 3 callables + scheduled)
├── scripts/         # 18 maintenance scripts
└── firestore.rules  # 37+ collection rules
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

### Permission & Dashboard Completion (2025-12-30) ✅ COMPLETE
**Path:** `plans/251230-2152-permission-dashboard-completion/plan.md`
**Status:** All 5 phases completed on 2025-12-31

| Phase | Name | Status |
|-------|------|--------|
| 1 | Permission Fix | ✅ Complete |
| 2 | Dashboard CSKH Bug Fix | ✅ Complete |
| 3 | Dashboard CSKH Widgets | ✅ Complete |
| 4 | Dashboard GV Implementation | ✅ Complete |
| 5 | Testing & Verification | ✅ Complete |

### Key Achievements (v1.0.1)
- Fixed CSKH/CM/Sale Staff permissions (classes, schedule, holidays)
- Added 4 new CSKH/Sale widgets (work days, expiring fees, debt list, checklist)
- Implemented complete GV/TG Dashboard (7 widgets with data isolation)
- All 294 tests pass, production build successful

### Codebase Review Plan (2025-12-26)
**Path:** `plans/251226-2134-codebase-review/plan.md`
**Status:** Review Complete, Security Phase Pending (v1.1)

---

## Recent Activity (Last 10 Tasks)

**2026-01-07 (Current Session)**
- 🔄 Context restored - reviewing recent commits since 01/05

**2026-01-06 - 01/07 (Recent Work)**
1. ✅ **Debt Management Enhancement** - Added contract start/expected end date columns
2. ✅ **Work Confirmation Improvements** - Branch/center filter, checkbox selection, work status options
3. ✅ **Dashboard Enhancement** - Contract dates, branch filter
4. ✅ **Staff Account Management** - Store/display plain password for admin viewing, credential saving fixes
5. ✅ **Business Logic Fixes** - 10 bug fixes + invoice editing

**2026-01-05 (Previous Session)**
1. ✅ **Multi-Module Bug Fixes** - Fixed 12+ bugs across 3 modules
   - Training: Attendance sessions, schedule room conflict, tutoring reserve, homework filter
   - Customer: Modal scroll (StudentDetail, Feedback), trial filter, contract class/discount
   - HR: Staff 18+ age, salary buttons, work confirmation save/filter, leave validations, salary edit
   - Deployed to Firebase: https://edumanager-pro-6180f.web.app

**Recent Commits**
1. `a329d08` feat(debt-management): add contract start date and expected end date columns
2. `74f25e1` feat(work-confirmation): add branch/center filter
3. `f407ed9` feat(dashboard): add contract start date, expected end date columns and branch filter
4. `2a76c41` feat(work-confirmation): add checkbox selection and work status options
5. `e14a520` feat: store and display plain password for admin viewing
6. `90304f5` fix: show email/password info for existing staff accounts
7. `f5a1b41` fix: staff edit form now saves login credentials
8. `1a6f8da` fix: resolve 10 business logic bugs and add invoice editing

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

### Current Session (2026-01-07 15:50)
- 🔄 Context restored from project-memory.md
- Reviewing 8 new commits since 01/05

### Previous Sessions (2026-01-05 - 01/07)
- ✅ Debt Management: contract start/end date columns
- ✅ Work Confirmation: branch filter, checkbox selection, work status
- ✅ Dashboard: contract dates, branch filter
- ✅ Staff Management: plain password storage for admin, credential fixes
- ✅ Business Logic: 10 bug fixes + invoice editing

### Previous Session (2026-01-05)
- ✅ Multi-Module Bug Fixes (12+ issues across Training, Customer, HR)
- ✅ Documentation Update (`/docs:update`)
- ✅ Committed: `b0faa06`, Pushed, Deployed

### Next Priority
- v1.1: Security Hardening (P0) - Firestore rules, permission checks
- Code Quality: DRY violations, hook consistency
- See `plans/251226-2134-codebase-review/phases/phase-01-security.md`

### Recommended Skills
- `frontend-development` - React/TypeScript patterns
- `databases` - Firebase/Firestore operations
- `backend-development` - Cloud Functions

---

## Documentation Updated

| File | Updated |
|------|---------|
| `docs/codebase-summary.md` | 2026-01-03 |
| `docs/system-architecture.md` | 2026-01-03 |
| `docs/code-standards.md` | 2026-01-03 |
| `docs/project-roadmap.md` | 2026-01-03 |
| `docs/project-overview-pdr.md` | 2026-01-03 (NEW) |
| `README.md` | 2025-12-31 |

---

## Notes

- All UI text in Vietnamese
- Uses HashRouter (hash-based routing)
- Multi-class support: students can enroll in multiple classes
- Path alias: `@/*` maps to project root
- 8 ADRs documented in `docs/decisions/`
