# EduManager Pro - Project Roadmap

## Vision

Xây dựng hệ thống quản lý trung tâm giáo dục toàn diện, hiệu quả và dễ sử dụng cho các trung tâm ngoại ngữ tại Việt Nam.

## Roadmap Overview

```
2025 Q4                          2026 Q1                          2026 Q2
├── v1.0 Core System             ├── v1.1 Enhancements           ├── v1.2 Advanced
│   ├── Student Management       │   ├── Mobile Responsive       │   ├── Parent Portal
│   ├── Class Management         │   ├── Notifications           │   ├── Student Portal
│   ├── Attendance               │   ├── Analytics Dashboard     │   ├── Mobile App
│   ├── Finance                  │   └── API Integrations        │   └── AI Features
│   └── Reports                  │                                │
└── v1.0 Release (Dec 2025)      └── v1.1 Release (Mar 2026)     └── v1.2 Release (Jun 2026)
```

## Version 1.0 (Current - Dec 2025)

### Features ✅

| Category | Feature | Status |
|----------|---------|--------|
| **Core** | | |
| | User Authentication | ✅ Done |
| | Role-based Authorization | ✅ Done |
| | Dashboard | ✅ Done |
| **Training** | | |
| | Class Management | ✅ Done |
| | Schedule View | ✅ Done |
| | Attendance Tracking | ✅ Done |
| | Homework Management | ✅ Done |
| | Tutoring Sessions | ✅ Done |
| **Students** | | |
| | Student CRUD | ✅ Done |
| | Trial Students | ✅ Done |
| | Parent Management | ✅ Done |
| | Enrollment History | ✅ Done |
| **HR** | | |
| | Staff Management | ✅ Done |
| | Salary Configuration | ✅ Done |
| | Work Confirmation | ✅ Done |
| | Reward/Penalty | ✅ Done |
| **Finance** | | |
| | Contract Creation | ✅ Done |
| | Debt Management | ✅ Done |
| | Revenue Reports | ✅ Done |
| **CRM** | | |
| | Customer Database | ✅ Done |
| | Campaign Management | ✅ Done |
| **Reports** | | |
| | Training Report | ✅ Done |
| | Monthly Report | ✅ Done |
| | Financial Report | ✅ Done |

### Goals

- [x] Core functionality complete
- [x] All CRUD operations working
- [x] Real-time data sync
- [x] Role-based access control
- [x] Production deployment
- [x] User documentation

## Version 1.1 (Q1 2026)

### Planned Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Mobile Responsive | High | Improve mobile/tablet experience |
| Push Notifications | High | Notifications for important events |
| Enhanced Dashboard | Medium | More analytics, charts |
| Email Integration | Medium | Send reports via email |
| Zalo Integration | Medium | Notifications via Zalo |
| Data Export | Low | Export all data to Excel/PDF |

### Improvements

- Performance optimization for large datasets
- Better error handling and user feedback
- Improved search and filtering
- Bulk operations support

## Version 1.2 (Q2 2026)

### Planned Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Parent Portal | High | Parents view student progress |
| Student Portal | Medium | Students view schedule, homework |
| Mobile App | Medium | Native mobile application |
| AI Assistant | Low | AI-powered insights, recommendations |
| Multi-branch | Low | Support multiple locations |

### Considerations

- React Native for mobile app
- Firebase Cloud Messaging for push
- OpenAI/Gemini for AI features

## Version 2.0 (Future)

### Vision Features

- Online learning integration
- Video conferencing
- E-learning content management
- Advanced analytics/BI
- Multi-tenant SaaS model

## Feature Requests Backlog

| ID | Feature | Requested By | Priority | Status |
|----|---------|--------------|----------|--------|
| FR-001 | Bulk student import | Admin | High | Planned v1.1 |
| FR-002 | SMS notifications | Admin | Medium | Under review |
| FR-003 | Calendar export | Teacher | Low | Backlog |
| FR-004 | Grade book | Teacher | Medium | Planned v1.2 |
| FR-005 | Fee calculator | Finance | Medium | Backlog |

## Technical Debt Roadmap

| Item | Priority | Target Version |
|------|----------|----------------|
| Add comprehensive tests | High | v1.0 |
| Refactor large components | Medium | v1.1 |
| Optimize Firestore queries | Medium | v1.1 |
| Add error boundary logging | Low | v1.1 |
| Implement caching | Low | v1.2 |
| Address Security Issues (Firestore rules, permission checks) | High | v1.1 |
| Refactor DRY Violations (Timestamp Conversion & Query Building) | Medium | v1.1 |
| Standardize Hooks Consistency | Medium | v1.1 |

## Dependencies

### External Dependencies

| Dependency | Current | Target | Notes |
|------------|---------|--------|-------|
| React | 19.x | 19.x | Latest |
| Firebase | 12.x | Latest | Keep updated |
| Vite | 7.x | Latest | Keep updated |

### Infrastructure Dependencies

- Firebase Blaze plan (for Cloud Functions)
- Custom domain (optional)
- SSL certificate (Firebase provided)

## Success Metrics

### v1.0 Success Criteria

- [x] All core features functional
- [x] < 5 critical bugs at launch
- [x] Page load < 3 seconds
- [x] 90% user satisfaction

### v1.1 Success Criteria

- [ ] Mobile usability score > 80
- [ ] 50% reduction in support requests
- [ ] User engagement +20%

## Review Schedule

| Date | Milestone | Review Type |
|------|-----------|-------------|
| Dec 2025 | v1.0 Release | Full review |
| Jan 2026 | v1.0 + 1 month | Feedback review |
| Mar 2026 | v1.1 Release | Feature review |
| Jun 2026 | v1.2 Release | Annual review |

## Contact

For roadmap discussions:
- GitHub Issues: Feature requests
- Slack: #edumanager-roadmap
- Email: [project-email]
