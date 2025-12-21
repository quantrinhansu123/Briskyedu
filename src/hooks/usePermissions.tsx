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
  getVisibleMenuItems,
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
  
  // Menu visibility
  getVisibleMenuItems: () => ModuleKey[];
  isMenuVisible: (module: ModuleKey) => boolean;
  
  // Role checks
  isAdmin: boolean;
  isTeacher: boolean;
  isOfficeStaff: boolean;
}

export const usePermissions = (): UsePermissionsReturn => {
  const { user, staffData } = useAuth();

  // Determine role from staff position
  const role = useMemo<UserRole>(() => {
    if (!staffData?.position) {
      console.warn(`[SECURITY] Staff ${staffData?.id || 'unknown'} missing position, restricting access`);
      return 'tro_giang'; // Most restrictive role for staff without position
    }
    return getRoleFromPosition(staffData.position);
  }, [staffData?.position, staffData?.id]);

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
    
    getVisibleMenuItems: () => getVisibleMenuItems(role),
    
    isMenuVisible: (module: ModuleKey) => canView(role, module),
  }), [role]);

  // Role type checks
  const roleChecks = useMemo(() => ({
    isAdmin: role === 'admin',
    isTeacher: ['gv_viet', 'gv_nuocngoai', 'tro_giang'].includes(role),
    isOfficeStaff: ['cskh', 'ketoan'].includes(role),
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
