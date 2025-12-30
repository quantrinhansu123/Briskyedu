import { describe, it, expect } from 'vitest';
import {
  UserRole,
  ModuleKey,
  ROLE_PERMISSIONS,
  getRoleFromPosition,
  hasPermission,
  canView,
  canCreate,
  canEdit,
  canDelete,
  canApprove,
  shouldShowOnlyOwnClasses,
  shouldHideParentPhone,
  requiresApproval,
  shouldShowOnlyOwnData,
  getVisibleMenuItems,
} from './permissionService';

describe('Permission Service', () => {
  describe('getRoleFromPosition', () => {
    it('should return admin role for Quản lý (Admin)', () => {
      expect(getRoleFromPosition('Quản lý (Admin)')).toBe('admin');
    });

    it('should return cskh_staff role for Tư vấn viên', () => {
      expect(getRoleFromPosition('Tư vấn viên')).toBe('cskh_staff');
    });

    it('should return cskh_staff role for Lễ tân', () => {
      expect(getRoleFromPosition('Lễ tân')).toBe('cskh_staff');
    });

    it('should return cskh_lead role for Trưởng Nhóm CSKH', () => {
      expect(getRoleFromPosition('Trưởng Nhóm CSKH')).toBe('cskh_lead');
    });

    it('should return cm_lead role for Trưởng Nhóm CM', () => {
      expect(getRoleFromPosition('Trưởng Nhóm CM')).toBe('cm_lead');
    });

    it('should return cm_staff role for NV CM', () => {
      expect(getRoleFromPosition('NV CM')).toBe('cm_staff');
    });

    it('should return ketoan role for Kế toán', () => {
      expect(getRoleFromPosition('Kế toán')).toBe('ketoan');
    });

    it('should return gv_viet role for Giáo Viên Việt', () => {
      expect(getRoleFromPosition('Giáo Viên Việt')).toBe('gv_viet');
    });

    it('should return gv_nuocngoai role for Giáo Viên Nước Ngoài', () => {
      expect(getRoleFromPosition('Giáo Viên Nước Ngoài')).toBe('gv_nuocngoai');
    });

    it('should return tro_giang role for Trợ Giảng', () => {
      expect(getRoleFromPosition('Trợ Giảng')).toBe('tro_giang');
    });

    it('should return sale_lead role for Trưởng Nhóm Sale', () => {
      expect(getRoleFromPosition('Trưởng Nhóm Sale')).toBe('sale_lead');
    });

    it('should return sale_staff role for NV Sale', () => {
      expect(getRoleFromPosition('NV Sale')).toBe('sale_staff');
    });

    it('should default to cskh_staff for unknown positions', () => {
      expect(getRoleFromPosition('Unknown Position')).toBe('cskh_staff');
    });
  });

  describe('Admin Permissions', () => {
    const role: UserRole = 'admin';

    it('should have full access to all modules', () => {
      const modules: ModuleKey[] = [
        'dashboard', 'classes', 'schedule', 'students', 
        'staff', 'salary_config', 'contracts', 'settings'
      ];
      
      modules.forEach(module => {
        expect(canView(role, module)).toBe(true);
        expect(canCreate(role, module)).toBe(true);
        expect(canEdit(role, module)).toBe(true);
        expect(canDelete(role, module)).toBe(true);
      });
    });

    it('should be able to approve work confirmation', () => {
      expect(canApprove(role, 'work_confirmation')).toBe(true);
    });

    it('should not have onlyOwnClasses restriction', () => {
      expect(shouldShowOnlyOwnClasses(role, 'classes')).toBe(false);
    });

    it('should not hide parent phone', () => {
      expect(shouldHideParentPhone(role, 'students')).toBe(false);
    });
  });

  describe('CSKH Lead Permissions', () => {
    const role: UserRole = 'cskh_lead';

    it('should view dashboard', () => {
      expect(canView(role, 'dashboard')).toBe(true);
    });

    it('should view and edit classes', () => {
      expect(canView(role, 'classes')).toBe(true);
      expect(canCreate(role, 'classes')).toBe(true);
      expect(canEdit(role, 'classes')).toBe(true);
      expect(canDelete(role, 'classes')).toBe(false);
    });

    it('should not access salary config', () => {
      expect(canView(role, 'salary_config')).toBe(false);
    });

    it('should view own salary_teacher but not salary_staff', () => {
      // Gap #1 fix: cskh_lead can now view salary_teacher (own data only)
      expect(canView(role, 'salary_teacher')).toBe(true);
      expect(shouldShowOnlyOwnData(role, 'salary_teacher')).toBe(true);
      expect(canView(role, 'salary_staff')).toBe(false);
    });

    it('should require approval for invoice deletion', () => {
      expect(requiresApproval(role, 'invoices')).toBe(true);
    });

    it('should be able to approve work confirmation', () => {
      expect(canApprove(role, 'work_confirmation')).toBe(true);
    });

    it('should only view staff, not edit', () => {
      expect(canView(role, 'staff')).toBe(true);
      expect(canCreate(role, 'staff')).toBe(false);
      expect(canEdit(role, 'staff')).toBe(false);
    });

    it('should view revenue (Lead only)', () => {
      expect(canView(role, 'revenue')).toBe(true);
    });
  });

  describe('CSKH Staff Permissions', () => {
    const role: UserRole = 'cskh_staff';

    it('should view dashboard', () => {
      expect(canView(role, 'dashboard')).toBe(true);
    });

    it('should view classes but NOT create/edit (Staff - per spec)', () => {
      expect(canView(role, 'classes')).toBe(true);
      expect(canCreate(role, 'classes')).toBe(false);
      expect(canEdit(role, 'classes')).toBe(false);
    });

    it('should view schedule but NOT create/edit (Staff - per spec)', () => {
      expect(canView(role, 'schedule')).toBe(true);
      expect(canCreate(role, 'schedule')).toBe(false);
      expect(canEdit(role, 'schedule')).toBe(false);
    });

    it('should view holidays but NOT create/edit (Staff - per spec)', () => {
      expect(canView(role, 'holidays')).toBe(true);
      expect(canCreate(role, 'holidays')).toBe(false);
      expect(canEdit(role, 'holidays')).toBe(false);
    });

    it('should NOT view revenue (Staff)', () => {
      expect(canView(role, 'revenue')).toBe(false);
    });

    it('should NOT approve work confirmation (Staff)', () => {
      expect(canApprove(role, 'work_confirmation')).toBe(false);
    });
  });

  describe('Sale Lead Permissions', () => {
    const role: UserRole = 'sale_lead';

    it('should view dashboard', () => {
      expect(canView(role, 'dashboard')).toBe(true);
    });

    it('should view and edit classes', () => {
      expect(canView(role, 'classes')).toBe(true);
      expect(canCreate(role, 'classes')).toBe(true);
      expect(canEdit(role, 'classes')).toBe(true);
      expect(canDelete(role, 'classes')).toBe(false);
    });

    it('should be able to approve work confirmation (Lead)', () => {
      expect(canApprove(role, 'work_confirmation')).toBe(true);
    });

    it('should CAN see revenue (Lead level)', () => {
      expect(canView(role, 'revenue')).toBe(true);
    });

    it('should not access salary config', () => {
      expect(canView(role, 'salary_config')).toBe(false);
    });
  });

  describe('Sale Staff Permissions', () => {
    const role: UserRole = 'sale_staff';

    it('should view dashboard', () => {
      expect(canView(role, 'dashboard')).toBe(true);
    });

    it('should view classes but NOT create/edit (Staff - per spec)', () => {
      expect(canView(role, 'classes')).toBe(true);
      expect(canCreate(role, 'classes')).toBe(false);
      expect(canEdit(role, 'classes')).toBe(false);
    });

    it('should view schedule but NOT create/edit (Staff - per spec)', () => {
      expect(canView(role, 'schedule')).toBe(true);
      expect(canCreate(role, 'schedule')).toBe(false);
      expect(canEdit(role, 'schedule')).toBe(false);
    });

    it('should view holidays but NOT create/edit (Staff - per spec)', () => {
      expect(canView(role, 'holidays')).toBe(true);
      expect(canCreate(role, 'holidays')).toBe(false);
      expect(canEdit(role, 'holidays')).toBe(false);
    });

    it('should NOT view revenue (Staff)', () => {
      expect(canView(role, 'revenue')).toBe(false);
    });

    it('should NOT approve work confirmation (Staff)', () => {
      expect(canApprove(role, 'work_confirmation')).toBe(false);
    });
  });

  describe('Kế toán Permissions', () => {
    const role: UserRole = 'ketoan';

    it('should view dashboard', () => {
      expect(canView(role, 'dashboard')).toBe(true);
    });

    it('should have full access to salary config', () => {
      expect(canView(role, 'salary_config')).toBe(true);
      expect(canCreate(role, 'salary_config')).toBe(true);
      expect(canEdit(role, 'salary_config')).toBe(true);
    });

    it('should have full access to invoices', () => {
      expect(canView(role, 'invoices')).toBe(true);
      expect(canCreate(role, 'invoices')).toBe(true);
      expect(canEdit(role, 'invoices')).toBe(true);
      expect(canDelete(role, 'invoices')).toBe(true);
    });

    it('should not access attendance', () => {
      expect(canView(role, 'attendance')).toBe(false);
    });

    it('should not access leads/campaigns', () => {
      expect(canView(role, 'leads')).toBe(false);
      expect(canView(role, 'campaigns')).toBe(false);
    });
  });

  describe('Giáo viên Việt Permissions', () => {
    const role: UserRole = 'gv_viet';

    it('should view dashboard', () => {
      expect(canView(role, 'dashboard')).toBe(true);
    });

    it('should view classes with onlyOwnClasses restriction', () => {
      expect(canView(role, 'classes')).toBe(true);
      expect(shouldShowOnlyOwnClasses(role, 'classes')).toBe(true);
    });

    it('should hide parent phone for classes (students hidden per spec)', () => {
      expect(shouldHideParentPhone(role, 'classes')).toBe(true);
      // Gap #1: students module is now hidden for GV
      expect(canView(role, 'students')).toBe(false);
    });

    it('should view holidays (per spec - view only)', () => {
      expect(canView(role, 'holidays')).toBe(true);
      expect(canCreate(role, 'holidays')).toBe(false);
    });

    it('should not access enrollment history', () => {
      expect(canView(role, 'enrollment_history')).toBe(false);
    });

    it('should not access any customer modules', () => {
      expect(canView(role, 'parents')).toBe(false);
      expect(canView(role, 'students_reserved')).toBe(false);
      expect(canView(role, 'students_dropped')).toBe(false);
    });

    it('should not access finance modules', () => {
      expect(canView(role, 'contracts')).toBe(false);
      expect(canView(role, 'invoices')).toBe(false);
      expect(canView(role, 'revenue')).toBe(false);
      expect(canView(role, 'debt')).toBe(false);
    });

    it('should not access settings', () => {
      expect(canView(role, 'settings')).toBe(false);
    });

    it('should view own salary only', () => {
      expect(canView(role, 'salary_teacher')).toBe(true);
      expect(canCreate(role, 'salary_teacher')).toBe(false);
    });

    it('should NOT access work confirmation (Gap #5 - hidden per spec)', () => {
      // Gap #5: work_confirmation is now hidden for GV
      expect(canView(role, 'work_confirmation')).toBe(false);
      expect(canCreate(role, 'work_confirmation')).toBe(false);
    });
  });

  describe('Trợ giảng Permissions', () => {
    const role: UserRole = 'tro_giang';

    it('should have same restrictions as gv_viet (updated per spec)', () => {
      expect(shouldShowOnlyOwnClasses(role, 'classes')).toBe(true);
      // Gap #1: students module hidden, so hideParentPhone not applicable
      expect(canView(role, 'students')).toBe(false);
      expect(canView(role, 'holidays')).toBe(true); // Can VIEW but not create
      expect(canCreate(role, 'holidays')).toBe(false);
      expect(canView(role, 'contracts')).toBe(false);
      expect(canView(role, 'settings')).toBe(false);
      // Gap #5: work_confirmation hidden
      expect(canView(role, 'work_confirmation')).toBe(false);
    });
  });

  describe('getVisibleMenuItems', () => {
    it('should return all modules for admin', () => {
      const items = getVisibleMenuItems('admin');
      expect(items).toContain('dashboard');
      expect(items).toContain('classes');
      expect(items).toContain('settings');
      expect(items).toContain('salary_config');
    });

    it('should hide salary_config but show salary_teacher for cskh_staff', () => {
      const items = getVisibleMenuItems('cskh_staff');
      expect(items).toContain('dashboard');
      expect(items).toContain('classes');
      expect(items).not.toContain('salary_config');
      expect(items).toContain('salary_teacher'); // Gap #2 fix: can view own salary
      expect(items).not.toContain('settings');
      expect(items).not.toContain('revenue'); // Staff cannot see revenue
      expect(items).not.toContain('staff'); // Gap #3 fix: staff hidden
    });

    it('should show revenue and salary_teacher for cskh_lead', () => {
      const items = getVisibleMenuItems('cskh_lead');
      expect(items).toContain('dashboard');
      expect(items).toContain('classes');
      expect(items).toContain('revenue'); // Lead CAN see revenue
      expect(items).toContain('salary_teacher'); // Gap #1 fix: can view own salary
      expect(items).not.toContain('salary_config');
      expect(items).not.toContain('settings');
    });

    it('should hide most modules for teachers except holidays', () => {
      const items = getVisibleMenuItems('gv_viet');
      expect(items).toContain('dashboard');
      expect(items).toContain('classes');
      expect(items).toContain('holidays'); // GV/TG CAN view holidays (per spec)
      expect(items).not.toContain('leads');
      expect(items).not.toContain('contracts');
      expect(items).not.toContain('settings');
      // Gap #1: students hidden
      expect(items).not.toContain('students');
      // Gap #6: reward_penalty visible
      expect(items).toContain('reward_penalty');
      // Gap #7: personal_profile visible
      expect(items).toContain('personal_profile');
    });
  });

  // ========================================
  // GV/TG Permission Gaps Fix Tests
  // Based on spec analysis: 251230-gv-tg-permission-gaps-analysis.md
  // ========================================
  describe('GV/TG Permission Gaps Fix', () => {
    const gvRoles: UserRole[] = ['gv_viet', 'gv_nuocngoai', 'tro_giang'];

    describe('Gap #1: students module should be hidden', () => {
      gvRoles.forEach(role => {
        it(`${role} should NOT view students module`, () => {
          expect(canView(role, 'students')).toBe(false);
        });
      });
    });

    describe('Gap #2: feedback should be view-only', () => {
      gvRoles.forEach(role => {
        it(`${role} should view feedback but NOT create`, () => {
          expect(canView(role, 'feedback')).toBe(true);
          expect(canCreate(role, 'feedback')).toBe(false);
        });
      });
    });

    describe('Gap #3: staff module should be hidden', () => {
      gvRoles.forEach(role => {
        it(`${role} should NOT view staff module`, () => {
          expect(canView(role, 'staff')).toBe(false);
        });
      });
    });

    describe('Gap #4: salary_config should be viewable with onlyOwnData', () => {
      gvRoles.forEach(role => {
        it(`${role} should view salary_config with onlyOwnData`, () => {
          expect(canView(role, 'salary_config')).toBe(true);
          expect(canEdit(role, 'salary_config')).toBe(false);
          expect(shouldShowOnlyOwnData(role, 'salary_config')).toBe(true);
        });
      });
    });

    describe('Gap #5: work_confirmation should be hidden', () => {
      gvRoles.forEach(role => {
        it(`${role} should NOT view or create work_confirmation`, () => {
          expect(canView(role, 'work_confirmation')).toBe(false);
          expect(canCreate(role, 'work_confirmation')).toBe(false);
        });
      });
    });

    describe('Gap #6: reward_penalty module should be visible', () => {
      gvRoles.forEach(role => {
        it(`${role} should view reward_penalty`, () => {
          expect(canView(role, 'reward_penalty')).toBe(true);
          expect(canCreate(role, 'reward_penalty')).toBe(false);
        });
      });

      it('admin should have full access to reward_penalty', () => {
        expect(canView('admin', 'reward_penalty')).toBe(true);
        expect(canCreate('admin', 'reward_penalty')).toBe(true);
        expect(canEdit('admin', 'reward_penalty')).toBe(true);
      });
    });

    describe('Gap #7: personal_profile module should be accessible', () => {
      const allRoles: UserRole[] = ['admin', 'gv_viet', 'gv_nuocngoai', 'tro_giang',
        'cskh_lead', 'cskh_staff', 'cm_lead', 'cm_staff', 'sale_lead', 'sale_staff', 'ketoan'];

      allRoles.forEach(role => {
        it(`${role} should view and edit personal_profile`, () => {
          expect(canView(role, 'personal_profile')).toBe(true);
          expect(canEdit(role, 'personal_profile')).toBe(true);
        });
      });
    });
  });

  // ========================================
  // CSKH Permission Gaps Fix Tests
  // Based on spec analysis: 251230-cskh-permission-gaps-analysis.md
  // ========================================
  describe('CSKH Permission Gaps Fix', () => {
    describe('Gap #1-2: salary_teacher with onlyOwnData', () => {
      it('cskh_lead can view salary_teacher with onlyOwnData', () => {
        expect(canView('cskh_lead', 'salary_teacher')).toBe(true);
        expect(shouldShowOnlyOwnData('cskh_lead', 'salary_teacher')).toBe(true);
        expect(canCreate('cskh_lead', 'salary_teacher')).toBe(false);
      });

      it('cskh_staff can view salary_teacher with onlyOwnData', () => {
        expect(canView('cskh_staff', 'salary_teacher')).toBe(true);
        expect(shouldShowOnlyOwnData('cskh_staff', 'salary_teacher')).toBe(true);
        expect(canCreate('cskh_staff', 'salary_teacher')).toBe(false);
      });
    });

    describe('Gap #3: cskh_staff staff hidden', () => {
      it('cskh_staff cannot view staff', () => {
        expect(canView('cskh_staff', 'staff')).toBe(false);
      });

      it('cskh_lead CAN view staff (not hidden for lead)', () => {
        expect(canView('cskh_lead', 'staff')).toBe(true);
      });
    });

    describe('Gap #4: cskh_staff campaigns read-only', () => {
      it('cskh_staff can view but not create/edit campaigns', () => {
        expect(canView('cskh_staff', 'campaigns')).toBe(true);
        expect(canCreate('cskh_staff', 'campaigns')).toBe(false);
        expect(canEdit('cskh_staff', 'campaigns')).toBe(false);
      });

      it('cskh_lead CAN create/edit campaigns', () => {
        expect(canView('cskh_lead', 'campaigns')).toBe(true);
        expect(canCreate('cskh_lead', 'campaigns')).toBe(true);
        expect(canEdit('cskh_lead', 'campaigns')).toBe(true);
      });
    });
  });
});
