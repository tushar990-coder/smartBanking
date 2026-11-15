import React from 'react';
import { useAuth } from '../context/AuthContext';
import { getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';

interface BranchOption {
  branchID: number;
  branchName: string;
  branchCode?: string;
  branchType?: string;
}

interface BranchSelectorProps {
  branches: BranchOption[];
  value: string | number;
  onChange: (value: string) => void;
  allowAll?: boolean;
  allLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  branches,
  value,
  onChange,
  allowAll = true,
  allLabel = 'सर्व शाखा (Consolidated - All Branches)',
  disabled = false,
  className = '',
  id,
}) => {
  const { user } = useAuth();
  const isHO = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);

  const visibleBranches = isHO || !lockedBranchId
    ? branches
    : branches.filter((b) => Number(b.branchID) === Number(lockedBranchId));

  const effectiveValue = isHO
    ? String(value ?? (allowAll ? 'all' : (lockedBranchId || 1)))
    : String(lockedBranchId || value || 1);

  return (
    <select
      id={id}
      value={effectiveValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !isHO}
      className={className}
    >
      {isHO && allowAll && <option value="all">{allLabel}</option>}
      {visibleBranches.map((b) => (
        <option key={b.branchID} value={String(b.branchID)}>
          {b.branchCode ? `${b.branchCode} - ` : ''}{b.branchName}
        </option>
      ))}
    </select>
  );
};

export default BranchSelector;
