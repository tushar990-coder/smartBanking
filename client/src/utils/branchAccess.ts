export const HEAD_OFFICE_ROLES = new Set([
  'admin',
  'superadmin',
  'super admin',
  'systemadmin',
  'headoffice',
  'ho_manager',
  'ho manager',
  'auditor',
  'generalmanager',
  'ceo',
  'chairman',
]);

export interface BranchScopedUser {
  role?: string | null;
  branchID?: number | null;
  defaultBranchID?: number | null;
  isHeadOffice?: boolean | null;
}

export function isHeadOfficeUser(user: BranchScopedUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isHeadOffice === true) return true;
  const normalized = (user.role || '').trim().toLowerCase();
  if (HEAD_OFFICE_ROLES.has(normalized)) return true;
  if (normalized === 'branchmanager' || normalized === 'manager') return false;
  return false;
}

export function getLockedBranchId(user: BranchScopedUser | null | undefined): number | null {
  if (!user || isHeadOfficeUser(user)) return null;
  const candidate = user.defaultBranchID && user.defaultBranchID > 0
    ? user.defaultBranchID
    : user.branchID;
  return candidate && candidate > 0 ? candidate : null;
}

export function getEffectiveBranchId(
  user: BranchScopedUser | null | undefined,
  globalBranchId: number | string | null | undefined,
  localBranchId?: number | string | null | undefined
): number | 'all' | null {
  if (!isHeadOfficeUser(user)) {
    return getLockedBranchId(user);
  }
  if (globalBranchId !== undefined && globalBranchId !== null && globalBranchId !== '') {
    if (globalBranchId === 'all') return 'all';
    if (typeof globalBranchId === 'number' && globalBranchId > 0) return globalBranchId;
    if (typeof globalBranchId === 'string') {
      const parsed = Number(globalBranchId);
      if (parsed > 0) return parsed;
    }
  }
  if (localBranchId === 'all') return 'all';
  if (typeof localBranchId === 'number' && localBranchId > 0) return localBranchId;
  if (typeof localBranchId === 'string') {
    const parsed = Number(localBranchId);
    if (parsed > 0) return parsed;
  }
  return 'all';
}

export function resolveWriteBranchId(
  user: BranchScopedUser | null | undefined,
  selectedBranchId?: number | string | null | undefined
): number {
  if (!isHeadOfficeUser(user)) {
    const locked = getLockedBranchId(user);
    if (locked && locked > 0) return locked;
  }

  if (typeof selectedBranchId === 'number' && selectedBranchId > 0) {
    return selectedBranchId;
  }
  if (typeof selectedBranchId === 'string' && selectedBranchId !== 'all') {
    const parsed = Number(selectedBranchId);
    if (parsed > 0) return parsed;
  }

  const userBranch = user?.defaultBranchID && user.defaultBranchID > 0
    ? user.defaultBranchID
    : user?.branchID;
  if (userBranch && userBranch > 0) return userBranch;

  try {
    const storedGlobal = sessionStorage.getItem('globalBranchId') || localStorage.getItem('globalBranchId');
    if (storedGlobal && storedGlobal !== 'all') {
      const parsed = Number(storedGlobal);
      if (parsed > 0) return parsed;
    }
  } catch {
    // ignore storage access issues
  }

  return 1;
}
