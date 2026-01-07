/**
 * usePermissions Hook
 * Hook để kiểm tra quyền của user hiện tại
 */

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  UserRole,
  ModuleKey,
  PermissionAction,
  ModulePermission,
  ROLE_PERMISSIONS,
  getRoleFromPosition,
  hasPermission,
  getModulePermission,
  canView,
  canCreate,
  canEdit,
  canDelete,
  canApprove,
  shouldShowOnlyOwnClasses,
  shouldHideParentPhone,
  requiresApproval,
  shouldShowOnlyOwnData,
  shouldOnlyUpdateStatus,
  getVisibleMenuItems,
  // Role helper functions
  isTeamLead as isTeamLeadCheck,
  canSeeRevenue as canSeeRevenueCheck,
  canSeeAllSalaries as canSeeAllSalariesCheck,
  isTeacher as isTeacherCheck,
  isOfficeStaff as isOfficeStaffCheck,
  isCSKH as isCSKHCheck,
  isCSKHLeader as isCSKHLeaderCheck,
  isKeToan as isKeToanCheck,
} from '../services/permissionService';

interface UsePermissionsReturn {
  role: UserRole;
  staffId: string | null;
  
  // Permission checks
  hasPermission: (module: ModuleKey, action: PermissionAction) => boolean;
  getModulePermission: (module: ModuleKey) => ModulePermission | null;
  canView: (module: ModuleKey) => boolean;
  canCreate: (module: ModuleKey) => boolean;
  canEdit: (module: ModuleKey) => boolean;
  canDelete: (module: ModuleKey) => boolean;
  canApprove: (module: ModuleKey) => boolean;
  
  // Special conditions
  shouldShowOnlyOwnClasses: (module: ModuleKey) => boolean;
  shouldHideParentPhone: (module: ModuleKey) => boolean;
  requiresApproval: (module: ModuleKey) => boolean;
  shouldShowOnlyOwnData: (module: ModuleKey) => boolean;
  shouldOnlyUpdateStatus: (module: ModuleKey) => boolean;
  
  // Menu visibility
  getVisibleMenuItems: () => ModuleKey[];
  isMenuVisible: (module: ModuleKey) => boolean;
  
  // Role checks
  isAdmin: boolean;
  isTeacher: boolean;
  isOfficeStaff: boolean;
  isTeamLead: boolean;        // Trưởng nhóm (admin, cskh_lead, cm_lead)
  canSeeRevenue: boolean;     // Có thể xem doanh thu (NOT cm_lead)
  canSeeAllSalaries: boolean; // Có thể xem lương TẤT CẢ nhân viên (admin, ketoan only)
  isCSKH: boolean;            // CSKH staff (cskh_lead or cskh_staff)
  isCSKHLeader: boolean;      // CSKH leader only
  isKeToan: boolean;          // Kế toán
}

export const usePermissions = (): UsePermissionsReturn => {
  const { user, staffData } = useAuth();

  // Determine role from staff position
  const role = useMemo<UserRole>(() => {
    // During loading, return restrictive role silently
    if (!staffData) {
      return 'tro_giang';
    }
    // Staff exists but missing position - warn
    if (!staffData.position) {
      console.warn(`[SECURITY] Staff ${staffData.id || 'unknown'} missing position, restricting access`);
      return 'tro_giang';
    }
    return getRoleFromPosition(staffData.position);
  }, [staffData]);

  const staffId = staffData?.id || user?.uid || null;

  // Memoized permission functions
  const permissions = useMemo(() => ({
    hasPermission: (module: ModuleKey, action: PermissionAction) => 
      hasPermission(role, module, action),
    
    getModulePermission: (module: ModuleKey) => 
      getModulePermission(role, module),
    
    canView: (module: ModuleKey) => canView(role, module),
    canCreate: (module: ModuleKey) => canCreate(role, module),
    canEdit: (module: ModuleKey) => canEdit(role, module),
    canDelete: (module: ModuleKey) => canDelete(role, module),
    canApprove: (module: ModuleKey) => canApprove(role, module),
    
    shouldShowOnlyOwnClasses: (module: ModuleKey) => 
      shouldShowOnlyOwnClasses(role, module),
    
    shouldHideParentPhone: (module: ModuleKey) => 
      shouldHideParentPhone(role, module),
    
    requiresApproval: (module: ModuleKey) =>
      requiresApproval(role, module),

    shouldShowOnlyOwnData: (module: ModuleKey) =>
      shouldShowOnlyOwnData(role, module),

    shouldOnlyUpdateStatus: (module: ModuleKey) =>
      shouldOnlyUpdateStatus(role, module),

    getVisibleMenuItems: () => getVisibleMenuItems(role),
    
    isMenuVisible: (module: ModuleKey) => canView(role, module),
  }), [role]);

  // Role type checks - use helpers from permissionService
  const roleChecks = useMemo(() => ({
    isAdmin: role === 'admin',
    isTeacher: isTeacherCheck(role),
    isOfficeStaff: isOfficeStaffCheck(role),
    isTeamLead: isTeamLeadCheck(role),
    canSeeRevenue: canSeeRevenueCheck(role),
    canSeeAllSalaries: canSeeAllSalariesCheck(role),
    isCSKH: isCSKHCheck(role),
    isCSKHLeader: isCSKHLeaderCheck(role),
    isKeToan: isKeToanCheck(role),
  }), [role]);

  return {
    role,
    staffId,
    ...permissions,
    ...roleChecks,
  };
};

// HOC for wrapping components with permission check
export const withPermission = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  module: ModuleKey,
  action: PermissionAction = 'view'
) => {
  return (props: P) => {
    const { hasPermission } = usePermissions();
    
    if (!hasPermission(module, action)) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-500 font-semibold">Không có quyền truy cập</p>
            <p className="text-gray-500 text-sm mt-1">Bạn không có quyền xem nội dung này</p>
          </div>
        </div>
      );
    }
    
    return <WrappedComponent {...props} />;
  };
};
