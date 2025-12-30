/**
 * usePermission Hook
 * Hook để kiểm tra quyền của user hiện tại
 */

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  UserRole,
  ModuleKey,
  PermissionAction,
  ModulePermission,
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

interface UsePermissionReturn {
  role: UserRole;
  hasPermission: (module: ModuleKey, action: PermissionAction) => boolean;
  getPermission: (module: ModuleKey) => ModulePermission | null;
  canView: (module: ModuleKey) => boolean;
  canCreate: (module: ModuleKey) => boolean;
  canEdit: (module: ModuleKey) => boolean;
  canDelete: (module: ModuleKey) => boolean;
  canApprove: (module: ModuleKey) => boolean;
  onlyOwnClasses: (module: ModuleKey) => boolean;
  hideParentPhone: (module: ModuleKey) => boolean;
  needsApproval: (module: ModuleKey) => boolean;
  visibleMenuItems: ModuleKey[];
  isAdmin: boolean;
  isTeacher: boolean;
  isStaff: boolean;
}

export const usePermission = (): UsePermissionReturn => {
  const { user } = useAuth();

  // Determine role from user's position
  const role = useMemo((): UserRole => {
    if (!user) return 'gv_viet'; // Default role
    
    // Get position from staffData
    const position = user.staffData?.position || '';
    const userRole = user.role || user.staffData?.role || '';
    
    // If user has explicit role field, check it first
    if (userRole) {
      const roleMap: Record<string, UserRole> = {
        'admin': 'admin',
        'Quản lý': 'admin',
        'Quản trị viên': 'admin',
        // CSKH roles
        'cskh_lead': 'cskh_lead',
        'cskh_staff': 'cskh_staff',
        // CM roles
        'cm_lead': 'cm_lead',
        'cm_staff': 'cm_staff',
        // Sale roles
        'sale_lead': 'sale_lead',
        'sale_staff': 'sale_staff',
        // Kế toán
        'ketoan': 'ketoan',
        // Đào tạo
        'gv_viet': 'gv_viet',
        'gv_nuocngoai': 'gv_nuocngoai',
        'tro_giang': 'tro_giang',
        'Giáo viên': 'gv_viet',
        'Trợ giảng': 'tro_giang',
        'Nhân viên': 'cskh_staff', // Default to cskh_staff
      };
      if (roleMap[userRole]) return roleMap[userRole];
    }
    
    // Fallback to position-based role
    return getRoleFromPosition(position);
  }, [user]);

  const visibleMenuItems = useMemo(() => getVisibleMenuItems(role), [role]);

  const isAdmin = role === 'admin';
  const isTeacher = ['gv_viet', 'gv_nuocngoai', 'tro_giang'].includes(role);
  const isStaff = ['cskh_lead', 'cskh_staff', 'cm_lead', 'cm_staff', 'sale_lead', 'sale_staff', 'ketoan'].includes(role);

  return {
    role,
    hasPermission: (module: ModuleKey, action: PermissionAction) => 
      hasPermission(role, module, action),
    getPermission: (module: ModuleKey) => 
      getModulePermission(role, module),
    canView: (module: ModuleKey) => canView(role, module),
    canCreate: (module: ModuleKey) => canCreate(role, module),
    canEdit: (module: ModuleKey) => canEdit(role, module),
    canDelete: (module: ModuleKey) => canDelete(role, module),
    canApprove: (module: ModuleKey) => canApprove(role, module),
    onlyOwnClasses: (module: ModuleKey) => shouldShowOnlyOwnClasses(role, module),
    hideParentPhone: (module: ModuleKey) => shouldHideParentPhone(role, module),
    needsApproval: (module: ModuleKey) => requiresApproval(role, module),
    visibleMenuItems,
    isAdmin,
    isTeacher,
    isStaff,
  };
};

// HOC để wrap component với permission check
export const withPermission = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredModule: ModuleKey,
  requiredAction: PermissionAction = 'view'
) => {
  return (props: P) => {
    const { hasPermission } = usePermission();
    
    if (!hasPermission(requiredModule, requiredAction)) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-xl font-medium text-gray-600">Không có quyền truy cập</h3>
          <p className="mt-2">Bạn không có quyền xem trang này</p>
        </div>
      );
    }
    
    return <WrappedComponent {...props} />;
  };
};
