# EduManager Pro - Project Memory

**Last Updated:** 2026-01-09 15:55
**Context Version:** 2.2

---

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | EduManager Pro |
| **Type** | Education Center Management System (Vietnamese) |
| **Stack** | React 19 + TypeScript + Firebase + Vite 7 |
| **Status** | Production (v1.1 Security Release) |
| **Deploy** | https://edumanager-pro-6180f.web.app |

---

## Current State Snapshot

### Progress Metrics
- **Overall Completion:** 85%
- **Current Milestone:** v1.1 Security Release Complete
- **Active Phase:** Code Quality & Performance (P1)
- **Quality Score:** 7.2/10 (per Ultrathink Review)

### Git State
```
Branch: main
Uncommitted: Yes - 6 files
Last Commit: 9295a02 - fix: Firestore Schema Update
Ahead/Behind: Up to date with origin/main
```

### Recent Achievements (This Session - 01/09/2026)
1. [x] Ultrathink Codebase Review complete (15 reports generated)
2. [x] CSKH Staff debt view permission disabled
3. [x] DashboardCSKH and DebtManagement minor updates

### Recent Achievements (01/07-01/09)
| Date | Achievement |
|------|-------------|
| 01/09 | Ultrathink codebase review - 7.2/10 score |
| 01/09 | Firestore Schema Update (commit 9295a02) |
| 01/07 | Security hardening v1.1 complete |
| 01/07 | canSeeAllSalaries() implementation |
| 01/07 | RBAC helper functions in Firestore rules |

### Active Work
- **Current Focus:** Uncommitted changes review
- **Active Plan:** None
- **Next Priority:** Commit pending changes, Code Quality refactoring

### Known Blockers & Issues
| Issue | Severity | Notes |
|-------|----------|-------|
| 6 uncommitted files | Low | Need commit |
| 232 `any` types | High | Type safety concern |
| Dashboard.tsx 2,562 lines | High | Needs split |
| 66 console.log statements | Medium | Remove for prod |

---

## Architecture Quick Reference

### Project Structure (Non-standard Vite)
```
/                    # Root level (source at root, NOT in src/)
├── App.tsx          # Main app with HashRouter (42 routes)
├── index.tsx        # React entry point
├── types.ts         # ALL TypeScript interfaces/enums (874 lines)
├── pages/           # 40 page components (8 domains)
├── components/      # 6 shared UI components
├── src/
│   ├── config/firebase.ts
│   ├── services/    # 37 Firestore CRUD services (static class)
│   ├── hooks/       # 36 React hooks (real-time listeners)
│   ├── utils/       # 12 utility files
│   └── features/    # 5 feature modules
├── functions/       # 10 Cloud Function triggers
├── scripts/         # 23 maintenance scripts
├── checkin_code/    # Subproject - Next.js 16 check-in system
└── firestore.rules  # 457 lines, 37+ collections secured
```

### Key Patterns
| Aspect | Pattern/Approach |
|--------|-----------------|
| **Data Flow** | Three-layer (Services → Hooks → Pages) |
| **State Management** | React hooks + Firestore onSnapshot (25 usages) |
| **API Style** | Firebase SDK + Cloud Functions |
| **Database** | Firestore NoSQL (37+ collections) |
| **Testing** | Vitest + React Testing Library (11 test files) |
| **Styling** | TailwindCSS |

### Critical File Paths
- **Entry Point:** `index.tsx`
- **Config:** `src/config/firebase.ts`
- **Routes:** `App.tsx`
- **Types:** `types.ts`
- **Services:** `src/services/`
- **Permissions:** `src/services/permissionService.ts`
- **Security Rules:** `firestore.rules`

---

## Active Plans

| Plan | Status | Priority | Notes |
|------|--------|----------|-------|
| Security Hardening | Complete | P0 | 6-phase Firestore rules |
| Ultrathink Review | Complete | P0 | 7.2/10 score |
| Code Quality | Pending | P1 | DRY, large files |
| Performance | Pending | P2 | Dashboard memoization |

### Immediate Priorities (Next 3 Actions)
1. **Review & commit:** 6 uncommitted files (permissionService change important)
2. **Split Dashboard.tsx:** 2,562 lines into smaller components
3. **Remove console.log:** 66 instances in production code

### Upcoming Work
- [ ] Reduce 232 `any` types
- [ ] Add error handling (try-catch)
- [ ] Service layer tests (34 untested)
- [ ] Document checkin_code subproject

---

## Development Context

### Essential Commands
```bash
npm run dev              # Dev server port 3000
npm run build            # Production build
npm run test             # Vitest watch mode
npm run test:run         # Tests once (CI)
npm run test:coverage    # Coverage report
firebase emulators:start # Local emulators
firebase deploy          # Deploy to Firebase
```

### Environment Setup
- **Node Version:** 18+
- **Package Manager:** npm
- **Required ENV:** VITE_FIREBASE_*, GEMINI_API_KEY (optional)
- **External Services:** Firebase (Auth, Firestore, Functions, Hosting)

### Test Coverage
- **Test Files:** 11 in src/
- **Coverage Gaps:** 34/37 services, 31/36 hooks untested
- **Score:** 6/10 (needs expansion)

---

## Session Continuity

### Uncommitted Changes (REVIEW REQUIRED)
| File | Changes | Action |
|------|---------|--------|
| `pages/DashboardCSKH.tsx` | Minor widget updates | Review |
| `pages/DebtManagement.tsx` | UI refinements | Review |
| `src/services/permissionService.ts` | **CSKH Staff debt=false** | Review carefully |
| `.gitignore` | Minor additions | Commit |
| `project-memory.md` | This update | Commit |
| `.firebase/hosting.*.cache` | Build cache | Ignore |

### Permission Change Detail
```diff
- debt: { view: true, create: true, edit: true, delete: false },
+ debt: { view: false, create: false, edit: false, delete: false }, // Ẩn công nợ khỏi CSKH Staff
```
**Impact:** CSKH Staff (Nhân viên CSKH) no longer has access to Debt Management module.

### Recent Commits (01/07-01/09)
| Hash | Description |
|------|-------------|
| 9295a02 | fix: Firestore Schema Update |
| 69d7827 | docs: update codebase summary and project memory |
| d4a4382 | fix(permissions): staff roles see salary_staff |
| cddbdde | fix(salary): include team leads in staff salary report |
| e58bf29 | fix(security): filter SalaryReportStaff by canSeeAllSalaries |

### Technical Debt Identified
| Item | Severity | Location |
|------|----------|----------|
| 232 `any` types | High | Throughout codebase |
| 66 console.log | Medium | Production code |
| Dashboard.tsx 2,562 lines | High | Needs split |
| 15 timestamp DRY violations | Medium | Services layer |
| 0 try-catch blocks | High | Missing error handling |

---

## Handover Notes

### Start With
1. Review uncommitted changes (`git diff`)
2. Validate permissionService.ts change (CSKH debt access)
3. Commit if approved: `git add . && git commit -m "fix(permissions): hide debt from CSKH Staff"`

### Watch Out For
- Permission change affects CSKH Staff role immediately
- DashboardCSKH widget dependencies
- DebtManagement navigation guards

### Files to Review First
1. `src/services/permissionService.ts` - CSKH debt permission change
2. `pages/DashboardCSKH.tsx` - Dashboard updates
3. `pages/DebtManagement.tsx` - Debt module updates

### Commands to Run First
```bash
git status               # Verify uncommitted changes
git diff --stat          # See change summary
npm run test:run         # Ensure all tests pass
npm run build            # Verify production build
```

---

## Skills & Tools

### Recommended Skills for Next Session
- `frontend-development` - React/TypeScript patterns
- `databases` - Firebase/Firestore operations
- `debugging` - If issues with permission change

### MCP Tools Available
- Firebase MCP: `mcp__plugin_firebase_firebase__*`
- GitHub MCP: `mcp__plugin_github_github__*`
- Context7: `mcp__plugin_context7_context7__*`

---

## Changelog

| Date | Change | By |
|------|--------|-----|
| 2026-01-09 15:55 | Full refresh - ultrathink review, permission change | project-update |
| 2026-01-09 08:50 | Incremental refresh - git delta | read-project-context |
| 2026-01-07 | Security hardening complete, v1.1 release | Session |
