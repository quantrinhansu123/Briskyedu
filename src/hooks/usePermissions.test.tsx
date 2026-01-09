import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as useAuthModule from './useAuth';
import { usePermissions } from './usePermissions';

// Create mock for useAuth
vi.mock('./useAuth');

describe('usePermissions Hook', () => {
  describe('with Teacher Role (GV Việt)', () => {
    beforeEach(() => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: { uid: 'test-user-id' } as any,
        staffData: {
          id: 'staff-123',
          name: 'Test Teacher',
          position: 'Giáo Viên Việt',
        },
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        register: vi.fn(),
        isAuthenticated: true,
        isAdmin: false,
      });
    });

    it('should determine role from staff position', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('gv_viet');
    });

    it('should provide staffId', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.staffId).toBe('staff-123');
    });

    it('should check view permission', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canView('classes')).toBe(true);
      expect(result.current.canView('settings')).toBe(false);
    });

    it('should check create permission', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canCreate('attendance')).toBe(true);
      expect(result.current.canCreate('contracts')).toBe(false);
    });

    it('should check edit permission', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canEdit('attendance')).toBe(true);
      expect(result.current.canEdit('students')).toBe(false);
    });

    it('should check delete permission', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canDelete('classes')).toBe(false);
      expect(result.current.canDelete('students')).toBe(false);
    });

    it('should check onlyOwnClasses', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.shouldShowOnlyOwnClasses('classes')).toBe(true);
      expect(result.current.shouldShowOnlyOwnClasses('schedule')).toBe(true);
    });

    it('should check hideParentPhone', () => {
      const { result } = renderHook(() => usePermissions());
      // Gap #1: students module is now hidden for GV, so no hideParentPhone needed
      expect(result.current.shouldHideParentPhone('students')).toBe(false);
      // classes still has hideParentPhone
      expect(result.current.shouldHideParentPhone('classes')).toBe(true);
    });

    it('should identify teacher role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isTeacher).toBe(true);
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isOfficeStaff).toBe(false);
    });

    it('should return visible menu items', () => {
      const { result } = renderHook(() => usePermissions());
      const items = result.current.getVisibleMenuItems();
      expect(items).toContain('dashboard');
      expect(items).toContain('classes');
      expect(items).not.toContain('settings');
    });

    it('should check individual menu visibility', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isMenuVisible('dashboard')).toBe(true);
      expect(result.current.isMenuVisible('settings')).toBe(false);
    });
  });

  describe('with Admin Role', () => {
    beforeEach(() => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: { uid: 'admin-user-id' } as any,
        staffData: {
          id: 'admin-123',
          name: 'Admin User',
          position: 'Quản lý (Admin)',
        },
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        register: vi.fn(),
        isAuthenticated: true,
        isAdmin: true,
      });
    });

    it('should have admin role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('admin');
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isTeacher).toBe(false);
    });

    it('should have full CRUD permissions', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canView('settings')).toBe(true);
      expect(result.current.canCreate('settings')).toBe(true);
      expect(result.current.canEdit('settings')).toBe(true);
      expect(result.current.canDelete('settings')).toBe(true);
    });

    it('should not have onlyOwnClasses restriction', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.shouldShowOnlyOwnClasses('classes')).toBe(false);
    });

    it('should see all menu items', () => {
      const { result } = renderHook(() => usePermissions());
      const items = result.current.getVisibleMenuItems();
      expect(items).toContain('settings');
      expect(items).toContain('salary_config');
    });
  });

  describe('with CSKH Staff Role', () => {
    beforeEach(() => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: { uid: 'cskh-user-id' } as any,
        staffData: {
          id: 'cskh-123',
          name: 'CSKH User',
          position: 'Tư vấn viên', // Maps to cskh_staff
        },
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        register: vi.fn(),
        isAuthenticated: true,
        isAdmin: false,
      });
    });

    it('should have cskh_staff role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('cskh_staff');
      expect(result.current.isOfficeStaff).toBe(true);
    });

    it('should not see salary_config and salary_teacher (CSKH is not teacher)', () => {
      // CSKH Staff không phải GV/TG nên không thấy salary_teacher
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canView('salary_config')).toBe(false);
      expect(result.current.canView('salary_teacher')).toBe(false);
    });

    it('should require approval for invoice delete', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.requiresApproval('invoices')).toBe(true);
    });

    it('should NOT approve work confirmation (staff level)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canApprove('work_confirmation')).toBe(false);
    });

    it('should NOT see revenue (staff level)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canSeeRevenue).toBe(false);
    });
  });

  describe('with CSKH Lead Role', () => {
    beforeEach(() => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: { uid: 'cskh-lead-id' } as any,
        staffData: {
          id: 'cskh-lead-123',
          name: 'CSKH Lead',
          position: 'Trưởng Nhóm CSKH', // Maps to cskh_lead
        },
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        register: vi.fn(),
        isAuthenticated: true,
        isAdmin: false,
      });
    });

    it('should have cskh_lead role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('cskh_lead');
      expect(result.current.isOfficeStaff).toBe(true);
      expect(result.current.isTeamLead).toBe(true);
    });

    it('should CAN approve work confirmation (lead level)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canApprove('work_confirmation')).toBe(true);
    });

    it('should CAN see revenue (lead level)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canSeeRevenue).toBe(true);
    });
  });

  describe('with Sale Lead Role', () => {
    beforeEach(() => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: { uid: 'sale-lead-id' } as any,
        staffData: {
          id: 'sale-lead-123',
          name: 'Sale Lead',
          position: 'Trưởng Nhóm Sale',
        },
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        register: vi.fn(),
        isAuthenticated: true,
        isAdmin: false,
      });
    });

    it('should have sale_lead role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('sale_lead');
      expect(result.current.isOfficeStaff).toBe(true);
      expect(result.current.isTeamLead).toBe(true);
    });

    it('should CAN approve work confirmation (lead level)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canApprove('work_confirmation')).toBe(true);
    });

    it('should CAN see revenue (lead level)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canSeeRevenue).toBe(true);
    });
  });

  describe('with Sale Staff Role', () => {
    beforeEach(() => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: { uid: 'sale-staff-id' } as any,
        staffData: {
          id: 'sale-staff-123',
          name: 'Sale Staff',
          position: 'NV Sale',
        },
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        register: vi.fn(),
        isAuthenticated: true,
        isAdmin: false,
      });
    });

    it('should have sale_staff role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('sale_staff');
      expect(result.current.isOfficeStaff).toBe(true);
    });

    it('should NOT approve work confirmation (staff level)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canApprove('work_confirmation')).toBe(false);
    });

    it('should NOT see revenue (staff level)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canSeeRevenue).toBe(false);
    });
  });

  describe('with Ketoan Role', () => {
    beforeEach(() => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: { uid: 'ketoan-user-id' } as any,
        staffData: {
          id: 'ketoan-123',
          name: 'Ketoan User',
          position: 'Kế toán',
        },
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        register: vi.fn(),
        isAuthenticated: true,
        isAdmin: false,
      });
    });

    it('should have ketoan role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('ketoan');
      expect(result.current.isOfficeStaff).toBe(true);
    });

    it('should have full access to salary', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canView('salary_config')).toBe(true);
      expect(result.current.canCreate('salary_config')).toBe(true);
      expect(result.current.canEdit('salary_config')).toBe(true);
    });

    it('should access attendance (Ketoan has full Đào Tạo access per spec)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canView('attendance')).toBe(true);
    });
  });

  describe('with Tro Giang Role', () => {
    beforeEach(() => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: { uid: 'tg-user-id' } as any,
        staffData: {
          id: 'tg-123',
          name: 'Tro Giang User',
          position: 'Trợ Giảng',
        },
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        register: vi.fn(),
        isAuthenticated: true,
        isAdmin: false,
      });
    });

    it('should have tro_giang role', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('tro_giang');
      expect(result.current.isTeacher).toBe(true);
    });

    it('should have same restrictions as teacher', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.shouldShowOnlyOwnClasses('classes')).toBe(true);
      // Gap #1: students module is now hidden for GV/TG
      expect(result.current.shouldHideParentPhone('students')).toBe(false);
      expect(result.current.canView('contracts')).toBe(false);
      // Gap #5: work_confirmation hidden
      expect(result.current.canView('work_confirmation')).toBe(false);
    });
  });

  describe('without staffData', () => {
    beforeEach(() => {
      vi.mocked(useAuthModule.useAuth).mockReturnValue({
        user: null,
        staffData: null,
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        register: vi.fn(),
        isAuthenticated: false,
        isAdmin: false,
      });
    });

    it('should default to tro_giang role for security', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.role).toBe('tro_giang');
    });
  });
});
