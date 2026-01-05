# EduManager Pro - Project Memory

**Last Updated:** 2026-01-05 19:48

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
| **Last Commit** | `b0faa06` fix: resolve multi-module bugs across Training, Customer, and HR modules |
| **Active Plans** | Multi-module Bug Fixes ✅ | Dashboard Phases 1-4 ✅ | Monthly Salary ✅ |
| **Next Priority** | Production stabilization, v1.1 security hardening |

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

**2026-01-05 (Current Session)**
1. ✅ **Multi-Module Bug Fixes** - Fixed 12+ bugs across 3 modules
   - Training: Attendance sessions, schedule room conflict, tutoring reserve, homework filter
   - Customer: Modal scroll (StudentDetail, Feedback), trial filter, contract class/discount
   - HR: Staff 18+ age, salary buttons, work confirmation save/filter, leave validations, salary edit
   - Deployed to Firebase: https://edumanager-pro-6180f.web.app

2. ✅ **Documentation Update** - Full codebase sync
   - Updated 6 docs files (PDR, codebase-summary, code-standards, architecture, roadmap, README)
   - Scout reports for pages (40), src (37 services, 35+ hooks), components (7+10 widgets)

**2025-12-31 (Previous Session)**
1. ✅ **Staff Role/Position Conflict Fix** - Expanded Văn phòng positions
2. ✅ **Permission & Dashboard Completion** - All 5 phases complete (v1.0.1)

**Recent Commits**
1. `b0faa06` fix: resolve multi-module bugs across Training, Customer, and HR modules
2. `2dceea5` feat(dashboard): implement DashboardGV for teachers (Phase 4)
3. `53c5be2` feat(dashboard): implement DashboardCSKH for CSKH staff (Phase 3)
4. `a75fe80` feat(dashboard): implement Dashboard Router for role-based routing (Phase 2)
5. `8f8fa54` feat(dashboard): extract reusable dashboard widgets for Phase 1

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

### Current Session (2026-01-05 19:00 - 19:48)
- ✅ Multi-Module Bug Fixes (12+ issues)
  - Training: Attendance add session, schedule room conflict, tutoring reserve, homework filter
  - Customer: Modal scroll fixes, trial student filter, contract class/discount selection
  - HR: Staff 18+ age validation, salary custom button, work confirmation save, leave validations
- ✅ Committed: `b0faa06`, Pushed to origin, Deployed to Firebase
- ✅ Documentation Update (`/docs:update`)
  - Spawned 3 scout agents for pages (40), src (37 services, 35+ hooks), components
  - Updated 6 docs files via docs-manager agent
  - Synced project-memory.md

### Previous Session (2026-01-03 15:43 - 15:58)
- ✅ Full Documentation Update - 6 scout agents, 5 docs updated
- Version: v1.0.1 with Dashboard Phases 1-4 complete

### Previous Session (2025-12-31 12:15 - 12:50)
- ✅ Staff Role/Position Conflict Fix
- ✅ Permission & Dashboard plan fully complete (5/5 phases)

### Next Priority
- Production stabilization and monitoring
- v1.1: Security Hardening (P0) - Firestore rules, permission checks
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
