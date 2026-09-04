export type RoleCode = 'Admin' | 'HO_Manager' | 'Branch_Manager' | 'Cashier' | 'Operator' | 'Auditor';
export type ActionType = 'View' | 'Add' | 'Edit' | 'Delete' | 'Print' | 'Approve';
export type ModuleCode = 'Member' | 'Saving' | 'FD' | 'RD' | 'Loan' | 'Share' | 'Voucher' | 'Pigmy' | 'Reports' | 'Settings';

export interface RolePermissions {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
  canApprove: boolean;
  isAllBranches: boolean;
}

// Master Role Permission Matrix Definition
export const ROLE_PERMISSION_MATRIX: Record<RoleCode, Record<ModuleCode, RolePermissions>> = {
  Admin: {
    Member: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Saving: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    FD: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    RD: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Loan: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Share: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Voucher: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Pigmy: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Reports: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    Settings: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true }
  },
  HO_Manager: {
    Member: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Saving: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    FD: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    RD: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Loan: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Share: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Voucher: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Pigmy: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true },
    Reports: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    Settings: { canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true, canApprove: true, isAllBranches: true }
  },
  Branch_Manager: {
    Member: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: true, isAllBranches: false },
    Saving: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: true, isAllBranches: false },
    FD: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: true, isAllBranches: false },
    RD: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: true, isAllBranches: false },
    Loan: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: true, isAllBranches: false },
    Share: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: true, isAllBranches: false },
    Voucher: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: true, isAllBranches: false },
    Pigmy: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: true, isAllBranches: false },
    Reports: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Settings: { canView: false, canAdd: false, canEdit: false, canDelete: false, canPrint: false, canApprove: false, isAllBranches: false }
  },
  Cashier: {
    Member: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Saving: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    FD: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    RD: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Loan: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Share: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Voucher: { canView: true, canAdd: true, canEdit: false, canDelete: false, canPrint: true, canApprove: true, isAllBranches: false },
    Pigmy: { canView: true, canAdd: true, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Reports: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Settings: { canView: false, canAdd: false, canEdit: false, canDelete: false, canPrint: false, canApprove: false, isAllBranches: false }
  },
  Operator: {
    Member: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Saving: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    FD: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    RD: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Loan: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Share: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Voucher: { canView: true, canAdd: true, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Pigmy: { canView: true, canAdd: true, canEdit: true, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Reports: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: false },
    Settings: { canView: false, canAdd: false, canEdit: false, canDelete: false, canPrint: false, canApprove: false, isAllBranches: false }
  },
  Auditor: {
    Member: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    Saving: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    FD: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    RD: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    Loan: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    Share: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    Voucher: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    Pigmy: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    Reports: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true },
    Settings: { canView: true, canAdd: false, canEdit: false, canDelete: false, canPrint: true, canApprove: false, isAllBranches: true }
  }
};

export function hasPermission(
  role: string | undefined,
  moduleName: ModuleCode,
  action: ActionType
): boolean {
  if (!role) return false;
  
  // Normalize role string (e.g. "Branch Manager" -> "Branch_Manager", "HO Manager" -> "HO_Manager")
  let normalizedRole: RoleCode = 'Operator';
  const roleLower = role.toLowerCase().replace(/[\s\_]+/g, '');
  
  if (roleLower === 'admin') normalizedRole = 'Admin';
  else if (roleLower.includes('homanager') || roleLower === 'ho_manager') normalizedRole = 'HO_Manager';
  else if (roleLower.includes('branchmanager') || roleLower === 'branch_manager') normalizedRole = 'Branch_Manager';
  else if (roleLower.includes('cashier')) normalizedRole = 'Cashier';
  else if (roleLower.includes('auditor')) normalizedRole = 'Auditor';
  else if (roleLower.includes('operator') || roleLower.includes('clerk')) normalizedRole = 'Operator';

  const rolePerms = ROLE_PERMISSION_MATRIX[normalizedRole];
  if (!rolePerms) return false;

  const modulePerms = rolePerms[moduleName];
  if (!modulePerms) return false;

  switch (action) {
    case 'View': return modulePerms.canView;
    case 'Add': return modulePerms.canAdd;
    case 'Edit': return modulePerms.canEdit;
    case 'Delete': return modulePerms.canDelete;
    case 'Print': return modulePerms.canPrint;
    case 'Approve': return modulePerms.canApprove;
    default: return false;
  }
}
