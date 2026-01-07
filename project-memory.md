# EduManager Pro - Project Memory

**Last Updated:** 2026-01-07 21:35

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
| **Quality Score** | 7.0/10 (Security hardening complete) |
| **Progress** | v1.1 Security Release, 40 pages, 294+ tests |
| **Last Commit** | `d4a4382` fix(permissions): staff roles see salary_staff, not salary_teacher |
| **Active Plans** | Security Hardening ✅ | Permission Fixes ✅ |
| **Deploy** | https://edumanager-pro-6180f.web.app |

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

**2026-01-07 (Current Session) - Security Hardening**
- ✅ **Firestore Security Rules** - 6-phase hardening completed
  - Phase 1-4: Training, Customer, Business, HR collections
  - Phase 5-6: Salary/Finance collections with `onlyOwnData` pattern
  - Added helper functions: `hasPosition()`, `isTeacher()`, `canSeeFinance()`, `isOnlyOwnData()`
- ✅ **Permission Service Fix** - CM Lead salary visibility bug
  - Added `canSeeAllSalaries()` function (Admin/KeToan only)
  - Removed `cm_lead` from `canSeeRevenue()`
  - Staff roles use `salary_staff` module instead of `salary_teacher`
- ✅ **Salary Report Pages** - Permission filtering
  - `SalaryReportTeacher.tsx`: Non-admin sees only own data
  - `SalaryReportStaff.tsx`: Non-admin sees only own data
  - `Dashboard.tsx`: Split revenue/salary widgets with permission gates
- ✅ **Staff Salary Service** - Include Team Leads in NV report
- ✅ **Deployed** to https://edumanager-pro-6180f.web.app

**Recent Commits (01/07)**
1. `d4a4382` fix(permissions): staff roles see salary_staff, not salary_teacher
2. `cddbdde` fix(salary): include team leads in staff salary report
3. `e58bf29` fix(security): filter SalaryReportStaff by canSeeAllSalaries permission
4. `532be0c` fix(security): filter SalaryReportTeacher by canSeeAllSalaries permission
5. `5c90357` fix(security): restrict salary data visibility to Admin/KeToan only
6. `ddd7d25` feat(security): phase 6 - customer + settings collections (FINAL)
7. `32a4108` feat(security): phase 5 - salary collections with onlyOwnData
8. `57d684c` feat(security): phase 4 - HR collections with approval logic

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

### Current Session (2026-01-07 21:35)
- ✅ Security Hardening Complete (v1.1)
- ✅ Firestore rules hardened (6 phases)
- ✅ Permission fixes deployed
- ✅ Documentation updated

### Key Achievements (v1.1 Security Release)
- 6-phase Firestore security rules hardening
- `canSeeAllSalaries()` function for salary data access control
- Staff roles properly separated (salary_staff vs salary_teacher)
- Team Leads included in NV salary report
- All permission tests passing (130 tests)

### Next Priority
- Code Quality: DRY violations, hook consistency
- Performance: Dashboard memoization
- Feature: New feature requests from users

### Recommended Skills
- `frontend-development` - React/TypeScript patterns
- `databases` - Firebase/Firestore operations
- `backend-development` - Cloud Functions

---

## Documentation Updated

| File | Updated |
|------|---------|
| `docs/PERMISSION_MATRIX.md` | 2026-01-07 (NEW) |
| `docs/DASHBOARD_SPECS.md` | 2026-01-07 (NEW) |
| `docs/FIRESTORE_SCHEMA.md` | 2026-01-07 |
| `docs/codebase-summary.md` | 2026-01-05 |
| `docs/system-architecture.md` | 2026-01-05 |
| `docs/code-standards.md` | 2026-01-05 |
| `docs/project-roadmap.md` | 2026-01-05 |
| `project-memory.md` | 2026-01-07 |

---

## Notes

- All UI text in Vietnamese
- Uses HashRouter (hash-based routing)
- Multi-class support: students can enroll in multiple classes
- Path alias: `@/*` maps to project root
- 9 ADRs documented in `docs/decisions/`
