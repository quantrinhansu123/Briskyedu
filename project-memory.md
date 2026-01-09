# EduManager Pro - Project Memory

**Last Updated:** 2026-01-09 23:22
**Context Version:** 2.3

---

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | EduManager Pro |
| **Type** | Education Center Management System (Vietnamese) |
| **Stack** | React 19 + TypeScript + Firebase + Vite 7 |
| **Status** | Production (v1.1 + Bugfixes) |
| **Deploy** | https://edumanager-pro-6180f.web.app |

---

## Current State Snapshot

### Progress Metrics
- **Overall Completion:** 87%
- **Current Milestone:** Customer Bugfix Release
- **Active Phase:** Code Quality & Performance (P1)
- **Quality Score:** 7.2/10 (per Ultrathink Review)

### Git State
```
Branch: main
Uncommitted: None (clean)
Last Commit: a963aa6 - feat(contracts): add PDF download and modularize
Ahead/Behind: Up to date with origin/main (deployed)
```

### Recent Achievements (Session 01/09/2026 Evening)
1. [x] Fixed 5 customer-reported bugs
2. [x] Added PDF download button to ContractCreation
3. [x] Added print button to ContractList
4. [x] Auto-fill remaining sessions in class transfer
5. [x] Director name fetches from Firestore (not hardcoded)
6. [x] Modularized contract PDF code → `contract-pdf-generator.ts`
7. [x] CSKH Staff debt permission disabled
8. [x] Deployed to Firebase

### Recent Commits (This Session)
| Hash | Description |
|------|-------------|
| a963aa6 | feat(contracts): add PDF download and modularize print logic |
| 12ad63b | fix: customer-reported bugs - contracts, class transfer, permissions |

### Active Work
- **Current Focus:** Session complete - all bugs fixed
- **Active Plan:** None
- **Next Priority:** Code Quality refactoring (technical debt)

### Known Blockers & Issues
| Issue | Severity | Notes |
|-------|----------|-------|
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
│   ├── utils/       # 13 utility files (+contract-pdf-generator.ts)
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
- **Contract PDF:** `src/utils/contract-pdf-generator.ts` (NEW)

---

## Active Plans

| Plan | Status | Priority | Notes |
|------|--------|----------|-------|
| Security Hardening | Complete | P0 | 6-phase Firestore rules |
| Ultrathink Review | Complete | P0 | 7.2/10 score |
| Customer Bugfixes | Complete | P0 | 5 bugs fixed this session |
| Code Quality | Pending | P1 | DRY, large files |
| Performance | Pending | P2 | Dashboard memoization |

### Immediate Priorities (Next 3 Actions)
1. **Split Dashboard.tsx:** 2,562 lines into smaller components
2. **Remove console.log:** 66 instances in production code
3. **Reduce 232 `any` types:** Type safety improvement

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
- **Tests:** 294 passing
- **Coverage Gaps:** 34/37 services, 31/36 hooks untested
- **Score:** 6/10 (needs expansion)

---

## Session Continuity

### Changes Made This Session (01/09 Evening)

#### Customer Bug Fixes (commit 12ad63b)
| Bug | File | Fix |
|-----|------|-----|
| Director hardcoded | `ContractCreation.tsx` | Fetch from `centers` collection |
| No print in list | `ContractList.tsx` | Added print button |
| Class transfer sessions | `TransferClassModal.tsx` | Auto-fill remaining sessions |
| CSKH debt access | `permissionService.ts` | Set debt.view = false |
| Test fix | `usePermissions.test.tsx` | Updated CSKH test |

#### PDF Modularization (commit a963aa6)
| Change | Description |
|--------|-------------|
| NEW: `contract-pdf-generator.ts` | Shared PDF generation module |
| ContractCreation.tsx | Added "Tải PDF" download button |
| ContractList.tsx | Uses shared module, -125 lines |

### Files Changed This Session
```
src/utils/contract-pdf-generator.ts  [NEW]
pages/ContractCreation.tsx           [MODIFIED]
pages/ContractList.tsx               [MODIFIED]
pages/CenterSettings.tsx             [MODIFIED]
src/features/students/components/TransferClassModal.tsx [MODIFIED]
src/services/permissionService.ts    [MODIFIED]
src/hooks/usePermissions.test.tsx    [MODIFIED]
```

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

### Session Summary
- Fixed 5 customer-reported bugs
- Modularized contract PDF code
- All changes committed and deployed
- Git state: clean

### Start Next Session With
1. Code quality refactoring (Dashboard split)
2. Remove 66 console.log statements
3. Reduce `any` types

### Watch Out For
- New PDF module: `src/utils/contract-pdf-generator.ts`
- CSKH Staff now has NO debt module access
- Center settings must have `manager` field for contract representative

### Files to Review First
1. `src/utils/contract-pdf-generator.ts` - New shared module
2. `pages/CenterSettings.tsx` - "Người đại diện" field updated

### Commands to Run First
```bash
git log --oneline -5    # See recent commits
npm run test:run        # Verify tests
npm run dev             # Start dev server
```

---

## Skills & Tools

### Recommended Skills for Next Session
- `frontend-development` - Dashboard component refactoring
- `code-review` - Remove console.log, fix any types
- `debugging` - If issues arise

### MCP Tools Available
- Firebase MCP: `mcp__plugin_firebase_firebase__*`
- GitHub MCP: `mcp__plugin_github_github__*`
- Context7: `mcp__plugin_context7_context7__*`

---

## Changelog

| Date | Change | By |
|------|--------|-----|
| 2026-01-09 23:22 | Session complete - 5 bugs fixed, PDF modularized, deployed | project-update |
| 2026-01-09 15:55 | Full refresh - ultrathink review, permission change | project-update |
| 2026-01-09 08:50 | Incremental refresh - git delta | read-project-context |
| 2026-01-07 | Security hardening complete, v1.1 release | Session |
