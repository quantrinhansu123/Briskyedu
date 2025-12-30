/**
 * Permission Service
 * Quản lý phân quyền theo phòng ban và vị trí
 */

// Định nghĩa các Role
export type UserRole = 
  | 'admin'           // Quản lý (Admin) - Full quyền
  | 'cskh'            // Tư vấn & CSKH - Văn phòng
  | 'ketoan'          // Kế toán - Văn phòng
  | 'gv_viet'         // Giáo viên Việt - Đào tạo
  | 'gv_nuocngoai'    // Giáo viên nước ngoài - Đào tạo
  | 'tro_giang';      // Trợ giảng - Đào tạo

// Định nghĩa các Module
export type ModuleKey =
  | 'dashboard'
  | 'classes'
  | 'schedule'
  | 'holidays'
  | 'attendance'
  | 'attendance_history'
  | 'enrollment_history'
  | 'tutoring'
  | 'homework'
  | 'students'
  | 'students_reserved'
  | 'students_dropped'
  | 'students_trial'
  | 'parents'
  | 'feedback'
  | 'leads'
  | 'campaigns'
  | 'staff'
  | 'salary_config'
  | 'work_confirmation'
  | 'leave_request'
  | 'salary_teacher'
  | 'salary_staff'
  | 'contracts'
  | 'invoices'
  | 'revenue'
  | 'debt'
  | 'reports_training'
  | 'reports_finance'
  | 'settings';

// Định nghĩa quyền cho từng action
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';

// Định nghĩa quyền đặc biệt
export interface ModulePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve?: boolean;
  // Các điều kiện đặc biệt
  onlyOwnClasses?: boolean;      // Chỉ xem lớp mình dạy
  hideParentPhone?: boolean;      // Ẩn SĐT phụ huynh
  requireApproval?: boolean;      // Cần admin duyệt
}

// Permission matrix theo role
export const ROLE_PERMISSIONS: Record<UserRole, Partial<Record<ModuleKey, ModulePermission>>> = {
  // ========================================
  // ADMIN - Full quyền
  // ========================================
  admin: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    classes: { view: true, create: true, edit: true, delete: true },
    schedule: { view: true, create: true, edit: true, delete: true },
    holidays: { view: true, create: true, edit: true, delete: true },
    attendance: { view: true, create: true, edit: true, delete: true },
    attendance_history: { view: true, create: true, edit: true, delete: true },
    enrollment_history: { view: true, create: true, edit: true, delete: true },
    tutoring: { view: true, create: true, edit: true, delete: true },
    homework: { view: true, create: true, edit: true, delete: true },
    students: { view: true, create: true, edit: true, delete: true },
    students_reserved: { view: true, create: true, edit: true, delete: true },
    students_dropped: { view: true, create: true, edit: true, delete: true },
    students_trial: { view: true, create: true, edit: true, delete: true },
    parents: { view: true, create: true, edit: true, delete: true },
    feedback: { view: true, create: true, edit: true, delete: true },
    leads: { view: true, create: true, edit: true, delete: true },
    campaigns: { view: true, create: true, edit: true, delete: true },
    staff: { view: true, create: true, edit: true, delete: true },
    salary_config: { view: true, create: true, edit: true, delete: true },
    work_confirmation: { view: true, create: true, edit: true, delete: true, approve: true },
    leave_request: { view: true, create: true, edit: true, delete: true, approve: true },
    salary_teacher: { view: true, create: true, edit: true, delete: true },
    salary_staff: { view: true, create: true, edit: true, delete: true },
    contracts: { view: true, create: true, edit: true, delete: true },
    invoices: { view: true, create: true, edit: true, delete: true, approve: true },
    revenue: { view: true, create: true, edit: true, delete: true },
    debt: { view: true, create: true, edit: true, delete: true },
    reports_training: { view: true, create: true, edit: true, delete: true },
    reports_finance: { view: true, create: true, edit: true, delete: true },
    settings: { view: true, create: true, edit: true, delete: true },
  },

  // ========================================
  // CSKH - Tư vấn & Chăm sóc khách hàng (Văn phòng)
  // ========================================
  cskh: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: true, edit: true, delete: false },
    schedule: { view: true, create: true, edit: true, delete: false },
    holidays: { view: true, create: true, edit: true, delete: false },
    attendance: { view: true, create: true, edit: true, delete: false },
    attendance_history: { view: true, create: false, edit: false, delete: false },
    enrollment_history: { view: true, create: true, edit: true, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false },
    homework: { view: true, create: true, edit: true, delete: false },
    students: { view: true, create: true, edit: true, delete: false },
    students_reserved: { view: true, create: true, edit: true, delete: false },
    students_dropped: { view: true, create: true, edit: true, delete: false },
    students_trial: { view: true, create: true, edit: true, delete: false },
    parents: { view: true, create: true, edit: true, delete: false },
    feedback: { view: true, create: true, edit: true, delete: false },
    leads: { view: true, create: true, edit: true, delete: false },
    campaigns: { view: true, create: true, edit: true, delete: false },
    staff: { view: true, create: false, edit: false, delete: false }, // Chỉ xem
    salary_config: { view: false, create: false, edit: false, delete: false }, // Ẩn
    work_confirmation: { view: true, create: true, edit: true, delete: false, approve: true }, // Duyệt công GV
    leave_request: { view: true, create: true, edit: true, delete: false, approve: true }, // Duyệt nghỉ phép
    salary_teacher: { view: false, create: false, edit: false, delete: false }, // Ẩn
    salary_staff: { view: false, create: false, edit: false, delete: false }, // Ẩn
    contracts: { view: true, create: true, edit: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false, requireApproval: true }, // Xóa cần Admin duyệt
    revenue: { view: true, create: false, edit: false, delete: false },
    debt: { view: true, create: true, edit: true, delete: false },
    reports_training: { view: true, create: false, edit: false, delete: false },
    reports_finance: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false }, // Ẩn
  },

  // ========================================
  // KẾ TOÁN (Văn phòng)
  // ========================================
  ketoan: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: false, edit: false, delete: false },
    schedule: { view: true, create: false, edit: false, delete: false },
    holidays: { view: true, create: false, edit: false, delete: false },
    attendance: { view: false, create: false, edit: false, delete: false },
    attendance_history: { view: false, create: false, edit: false, delete: false },
    enrollment_history: { view: true, create: false, edit: false, delete: false },
    tutoring: { view: false, create: false, edit: false, delete: false },
    homework: { view: false, create: false, edit: false, delete: false },
    students: { view: true, create: false, edit: false, delete: false },
    students_reserved: { view: true, create: false, edit: false, delete: false },
    students_dropped: { view: true, create: false, edit: false, delete: false },
    students_trial: { view: false, create: false, edit: false, delete: false },
    parents: { view: true, create: false, edit: false, delete: false },
    feedback: { view: false, create: false, edit: false, delete: false },
    leads: { view: false, create: false, edit: false, delete: false },
    campaigns: { view: false, create: false, edit: false, delete: false },
    staff: { view: true, create: false, edit: false, delete: false },
    salary_config: { view: true, create: true, edit: true, delete: false },
    work_confirmation: { view: true, create: false, edit: false, delete: false },
    leave_request: { view: true, create: true, edit: false, delete: false }, // Xem tất cả, tạo riêng
    salary_teacher: { view: true, create: true, edit: true, delete: false },
    salary_staff: { view: true, create: true, edit: true, delete: false },
    contracts: { view: true, create: true, edit: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: true },
    revenue: { view: true, create: true, edit: true, delete: false },
    debt: { view: true, create: true, edit: true, delete: false },
    reports_training: { view: false, create: false, edit: false, delete: false },
    reports_finance: { view: true, create: true, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // GIÁO VIÊN VIỆT (Đào tạo)
  // ========================================
  gv_viet: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true, hideParentPhone: true },
    schedule: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    holidays: { view: false, create: false, edit: false, delete: false }, // Ẩn
    attendance: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    attendance_history: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    enrollment_history: { view: false, create: false, edit: false, delete: false }, // Ẩn
    tutoring: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    homework: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    students: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true, hideParentPhone: true },
    students_reserved: { view: false, create: false, edit: false, delete: false }, // Ẩn
    students_dropped: { view: false, create: false, edit: false, delete: false }, // Ẩn
    students_trial: { view: false, create: false, edit: false, delete: false }, // Ẩn
    parents: { view: false, create: false, edit: false, delete: false }, // Ẩn
    feedback: { view: true, create: true, edit: false, delete: false, onlyOwnClasses: true },
    leads: { view: false, create: false, edit: false, delete: false }, // Ẩn
    campaigns: { view: false, create: false, edit: false, delete: false }, // Ẩn
    staff: { view: true, create: false, edit: false, delete: false }, // Chỉ xem
    salary_config: { view: false, create: false, edit: false, delete: false }, // Ẩn
    work_confirmation: { view: true, create: true, edit: false, delete: false }, // Xác nhận công của mình
    leave_request: { view: true, create: true, edit: false, delete: false }, // Xem riêng, tạo nghỉ phép
    salary_teacher: { view: true, create: false, edit: false, delete: false }, // Chỉ xem lương của mình
    salary_staff: { view: false, create: false, edit: false, delete: false }, // Ẩn
    contracts: { view: false, create: false, edit: false, delete: false }, // Ẩn
    invoices: { view: false, create: false, edit: false, delete: false }, // Ẩn
    revenue: { view: false, create: false, edit: false, delete: false }, // Ẩn
    debt: { view: false, create: false, edit: false, delete: false }, // Ẩn
    reports_training: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    reports_finance: { view: false, create: false, edit: false, delete: false }, // Ẩn
    settings: { view: false, create: false, edit: false, delete: false }, // Ẩn
  },

  // ========================================
  // GIÁO VIÊN NƯỚC NGOÀI (Đào tạo)
  // ========================================
  gv_nuocngoai: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true, hideParentPhone: true },
    schedule: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    holidays: { view: false, create: false, edit: false, delete: false },
    attendance: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    attendance_history: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    enrollment_history: { view: false, create: false, edit: false, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    homework: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    students: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true, hideParentPhone: true },
    students_reserved: { view: false, create: false, edit: false, delete: false },
    students_dropped: { view: false, create: false, edit: false, delete: false },
    students_trial: { view: false, create: false, edit: false, delete: false },
    parents: { view: false, create: false, edit: false, delete: false },
    feedback: { view: true, create: true, edit: false, delete: false, onlyOwnClasses: true },
    leads: { view: false, create: false, edit: false, delete: false },
    campaigns: { view: false, create: false, edit: false, delete: false },
    staff: { view: true, create: false, edit: false, delete: false },
    salary_config: { view: false, create: false, edit: false, delete: false },
    work_confirmation: { view: true, create: true, edit: false, delete: false },
    salary_teacher: { view: true, create: false, edit: false, delete: false },
    salary_staff: { view: false, create: false, edit: false, delete: false },
    contracts: { view: false, create: false, edit: false, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    revenue: { view: false, create: false, edit: false, delete: false },
    debt: { view: false, create: false, edit: false, delete: false },
    reports_training: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    reports_finance: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
  },

  // ========================================
  // TRỢ GIẢNG (Đào tạo)
  // ========================================
  tro_giang: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    classes: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true, hideParentPhone: true },
    schedule: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    holidays: { view: false, create: false, edit: false, delete: false },
    attendance: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    attendance_history: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    enrollment_history: { view: false, create: false, edit: false, delete: false },
    tutoring: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    homework: { view: true, create: true, edit: true, delete: false, onlyOwnClasses: true },
    students: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true, hideParentPhone: true },
    students_reserved: { view: false, create: false, edit: false, delete: false },
    students_dropped: { view: false, create: false, edit: false, delete: false },
    students_trial: { view: false, create: false, edit: false, delete: false },
    parents: { view: false, create: false, edit: false, delete: false },
    feedback: { view: true, create: true, edit: false, delete: false, onlyOwnClasses: true },
    leads: { view: false, create: false, edit: false, delete: false },
    campaigns: { view: false, create: false, edit: false, delete: false },
    staff: { view: true, create: false, edit: false, delete: false },
    salary_config: { view: false, create: false, edit: false, delete: false },
    work_confirmation: { view: true, create: true, edit: false, delete: false },
    salary_teacher: { view: true, create: false, edit: false, delete: false },
    salary_staff: { view: false, create: false, edit: false, delete: false },
    contracts: { view: false, create: false, edit: false, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    revenue: { view: false, create: false, edit: false, delete: false },
    debt: { view: false, create: false, edit: false, delete: false },
    reports_training: { view: true, create: false, edit: false, delete: false, onlyOwnClasses: true },
    reports_finance: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
  },
};

// Map position string to role
export const POSITION_TO_ROLE: Record<string, UserRole> = {
  // Admin variations
  'Quản lý (Admin)': 'admin',
  'Quản trị viên': 'admin',
  'Quản lý': 'admin',
  'Admin': 'admin',
  'admin': 'admin',
  // CSKH variations
  'Tư vấn viên': 'cskh',
  'Lễ tân': 'cskh',
  'Nhân viên': 'cskh',
  'CSKH': 'cskh',
  // Kế toán
  'Kế toán': 'ketoan',
  // Giáo viên Việt variations
  'Giáo Viên Việt': 'gv_viet',
  'Giáo viên Việt': 'gv_viet',
  'GV Việt': 'gv_viet',
  // Giáo viên nước ngoài variations
  'Giáo Viên Nước Ngoài': 'gv_nuocngoai',
  'Giáo viên nước ngoài': 'gv_nuocngoai',
  'GV Ngoại': 'gv_nuocngoai',
  'GVNN': 'gv_nuocngoai',
  // Trợ giảng variations
  'Trợ Giảng': 'tro_giang',
  'Trợ giảng': 'tro_giang',
  'TG': 'tro_giang',
};

// Helper functions
export const getRoleFromPosition = (position: string): UserRole => {
  return POSITION_TO_ROLE[position] || 'gv_viet';
};

export const hasPermission = (
  role: UserRole,
  module: ModuleKey,
  action: PermissionAction
): boolean => {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  if (!permissions) return false;
  return permissions[action] === true;
};

export const getModulePermission = (
  role: UserRole,
  module: ModuleKey
): ModulePermission | null => {
  return ROLE_PERMISSIONS[role]?.[module] || null;
};

export const canView = (role: UserRole, module: ModuleKey): boolean => {
  return hasPermission(role, module, 'view');
};

export const canCreate = (role: UserRole, module: ModuleKey): boolean => {
  return hasPermission(role, module, 'create');
};

export const canEdit = (role: UserRole, module: ModuleKey): boolean => {
  return hasPermission(role, module, 'edit');
};

export const canDelete = (role: UserRole, module: ModuleKey): boolean => {
  return hasPermission(role, module, 'delete');
};

export const canApprove = (role: UserRole, module: ModuleKey): boolean => {
  return hasPermission(role, module, 'approve');
};

export const shouldShowOnlyOwnClasses = (role: UserRole, module: ModuleKey): boolean => {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  return permissions?.onlyOwnClasses === true;
};

export const shouldHideParentPhone = (role: UserRole, module: ModuleKey): boolean => {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  return permissions?.hideParentPhone === true;
};

export const requiresApproval = (role: UserRole, module: ModuleKey): boolean => {
  const permissions = ROLE_PERMISSIONS[role]?.[module];
  return permissions?.requireApproval === true;
};

// Get visible menu items for a role
export const getVisibleMenuItems = (role: UserRole): ModuleKey[] => {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return [];
  
  return Object.entries(permissions)
    .filter(([_, perm]) => perm.view)
    .map(([module]) => module as ModuleKey);
};
