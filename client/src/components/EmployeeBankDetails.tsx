import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  User,
  Landmark,
  Save,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  X,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

interface EmployeeBankDetail {
  employeeBankDetailID?: number;
  customerID: number;
  cifNo: string;
  customerName: string;
  employeeID: string;
  departmentID?: number;
  joiningDate?: string;
  employeeStatus: string;
  mobileNumber?: string;
  bankName: string;
  ifscCode: string;
  accountNumber: string;
  accountType: string;
  branchID?: number;
  customerBranchID?: number;
}

interface DropdownItem {
  id: number;
  name: string;
}

interface BankItem {
  bankID: number;
  bankName: string;
}

interface SocietyBranch {
  branchID: number;
  branchName: string;
}

interface EmployeeBankDetailsProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NO_REGEX = /^[A-Za-z0-9]{8,20}$/;
const HO_ROLES = new Set([
  'admin',
  'superadmin',
  'super admin',
  'headoffice',
  'ho_manager',
  'ho manager',
  'auditor',
  'generalmanager',
  'ceo',
  'systemadmin',
  'chairman',
]);

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await res.json();
      if (typeof body === 'string' && body.trim()) return body;
      if (body?.message) return body.message;
      if (body?.title) return body.title;
      if (body?.error) return body.error;
    } else {
      const text = await res.text();
      if (text && text.length < 300) return text;
    }
  } catch {
    // ignore parse failure
  }
  return fallback;
}

function isRowBankComplete(row: EmployeeBankDetail): boolean {
  return Boolean(row.bankName?.trim() && row.ifscCode?.trim() && row.accountNumber?.trim());
}

function validateRowsForSave(
  allRows: EmployeeBankDetail[],
  dirtyIds: Set<number>
): { errorsByCustomer: Record<number, string>; summaryMessage: string } {
  const errorsByCustomer: Record<number, string> = {};

  // Check duplicate Employee IDs across all loaded rows (case-insensitive, trimmed)
  const empIdOwner = new Map<string, EmployeeBankDetail>();
  for (const row of allRows) {
    const empId = (row.employeeID || '').trim().toUpperCase();
    if (!empId) continue;
    const prev = empIdOwner.get(empId);
    if (prev && prev.customerID !== row.customerID) {
      const msg = `कर्मचारी आयडी '${row.employeeID.trim()}' आधीच ${prev.customerName} (${prev.cifNo}) साठी वापरलेला आहे.`;
      if (dirtyIds.has(row.customerID)) errorsByCustomer[row.customerID] = msg;
      if (dirtyIds.has(prev.customerID)) errorsByCustomer[prev.customerID] = msg;
      if (!dirtyIds.has(row.customerID) && !dirtyIds.has(prev.customerID)) {
        errorsByCustomer[row.customerID] = msg;
      }
    } else {
      empIdOwner.set(empId, row);
    }
  }

  // Check duplicate BankName + AccountNumber across all loaded rows
  const bankAccOwner = new Map<string, EmployeeBankDetail>();
  for (const row of allRows) {
    const bankName = (row.bankName || '').trim().toUpperCase();
    const accNo = (row.accountNumber || '').trim().toUpperCase();
    if (!bankName || !accNo) continue;
    const key = `${bankName}::${accNo}`;
    const prev = bankAccOwner.get(key);
    if (prev && prev.customerID !== row.customerID) {
      const msg = `बँक '${row.bankName}' चा खाते क्र. '${row.accountNumber.trim()}' आधीच ${prev.customerName} साठी नोंदवलेला आहे.`;
      if (dirtyIds.has(row.customerID)) errorsByCustomer[row.customerID] = msg;
      if (dirtyIds.has(prev.customerID)) errorsByCustomer[prev.customerID] = msg;
    } else {
      bankAccOwner.set(key, row);
    }
  }

  // Field-level checks on dirty rows
  for (const row of allRows) {
    if (!dirtyIds.has(row.customerID)) continue;
    if (errorsByCustomer[row.customerID]) continue;

    const bank = (row.bankName || '').trim();
    const ifsc = (row.ifscCode || '').trim().toUpperCase();
    const acc = (row.accountNumber || '').trim();
    const emp = (row.employeeID || '').trim();

    if (emp.length > 50) {
      errorsByCustomer[row.customerID] = 'कर्मचारी आयडी कमाल ५० अक्षरांपर्यंत असावा.';
      continue;
    }

    const hasAnyBank = Boolean(bank || ifsc || acc);
    if (hasAnyBank) {
      if (!bank || !ifsc || !acc) {
        errorsByCustomer[row.customerID] = 'बँक नाव, IFSC कोड आणि खाते क्रमांक हे तिन्ही भरणे आवश्यक आहे.';
        continue;
      }
      if (!IFSC_REGEX.test(ifsc)) {
        errorsByCustomer[row.customerID] = `IFSC कोड '${ifsc}' अवैध आहे (मानक ११-अक्षरी उदा. SBIN0001234).`;
        continue;
      }
      if (!ACCOUNT_NO_REGEX.test(acc)) {
        errorsByCustomer[row.customerID] = 'खाते क्रमांक ८ ते २० अंक/अक्षरांचा असावा (स्पेस किंवा चिन्हे नको).';
        continue;
      }
    }
  }

  const firstError = Object.values(errorsByCustomer)[0] || '';
  return { errorsByCustomer, summaryMessage: firstError };
}

const EmployeeBankDetails: React.FC<EmployeeBankDetailsProps> = ({ onNavigate }) => {
  const { user, globalBranchId } = useAuth();
  const isHoAdmin = useMemo(() => {
    const role = (user?.role || user?.roleName || '').trim().toLowerCase();
    return HO_ROLES.has(role);
  }, [user]);

  const initialBranch = useMemo(() => {
    const stored = globalBranchId || localStorage.getItem('globalBranchId') || (user?.branchID ? String(user.branchID) : '');
    if (isHoAdmin) {
      return stored && stored !== 'all' ? stored : 'all';
    }
    return user?.branchID ? String(user.branchID) : (stored || 'all');
  }, [globalBranchId, isHoAdmin, user]);

  const [selectedSocietyBranchId, setSelectedSocietyBranchId] = useState<string>(initialBranch);
  const [societyBranches, setSocietyBranches] = useState<SocietyBranch[]>([]);

  const [data, setData] = useState<EmployeeBankDetail[]>([]);
  const [departments, setDepartments] = useState<DropdownItem[]>([]);
  const [branches, setBranches] = useState<DropdownItem[]>([]);
  const [banks, setBanks] = useState<BankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Dirty tracking & row validation errors
  const [dirtyCustomerIds, setDirtyCustomerIds] = useState<Set<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  // Search, Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Quick Add Bank Modal state
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [addingBank, setAddingBank] = useState(false);
  const [addBankError, setAddBankError] = useState('');
  const [addBankSuccess, setAddBankSuccess] = useState('');
  const [activeCustomerIdForBank, setActiveCustomerIdForBank] = useState<number | null>(null);

  // Quick Add Department Modal state
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [addingDept, setAddingDept] = useState(false);
  const [addDeptError, setAddDeptError] = useState('');
  const [addDeptSuccess, setAddDeptSuccess] = useState('');
  const [activeCustomerIdForDept, setActiveCustomerIdForDept] = useState<number | null>(null);

  // Quick Add Branch Modal state
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [addingBranch, setAddingBranch] = useState(false);
  const [addBranchError, setAddBranchError] = useState('');
  const [addBranchSuccess, setAddBranchSuccess] = useState('');
  const [activeCustomerIdForBranch, setActiveCustomerIdForBranch] = useState<number | null>(null);

  // URL Context
  const [source, setSource] = useState('');
  const [contextCustomerId, setContextCustomerId] = useState('');

  // Warn user on browser close/refresh when unsaved edits exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyCustomerIds.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyCustomerIds.size]);

  const fetchData = useCallback(async (branchOverride?: string) => {
    setLoading(true);
    setError('');
    try {
      const targetBranch = branchOverride ?? selectedSocietyBranchId;
      const empUrl =
        targetBranch && targetBranch !== 'all'
          ? `/api/EmployeeBankDetails?branchId=${encodeURIComponent(targetBranch)}`
          : '/api/EmployeeBankDetails';

      const [empRes, deptRes, branchRes, bankRes, socBranchRes] = await Promise.all([
        fetch(empUrl),
        fetch('/api/DepartmentMaster'),
        fetch('/api/BranchMaster'),
        fetch('/api/BankMasters'),
        fetch('/api/Branches'),
      ]);

      if (!empRes.ok) {
        const msg = await readErrorMessage(empRes, 'खातेदार बँक माहिती लोड करताना सर्व्हर त्रुटी आली.');
        throw new Error(msg);
      }

      const empData = await empRes.json();
      const deptData = deptRes.ok ? await deptRes.json() : [];
      const branchData = branchRes.ok ? await branchRes.json() : [];
      const bankData = bankRes.ok ? await bankRes.json() : [];
      const socBranchData = socBranchRes.ok ? await socBranchRes.json() : [];

      setSocietyBranches(
        Array.isArray(socBranchData)
          ? socBranchData.map((b: any) => ({
              branchID: b.branchID ?? b.BranchID ?? 0,
              branchName: b.branchName ?? b.BranchName ?? '',
            }))
          : []
      );

      const params = new URLSearchParams(window.location.search);
      const urlCustomerId = params.get('customerId');

      const normalizedEmpData: EmployeeBankDetail[] = (Array.isArray(empData) ? empData : []).map((item: any) => ({
        employeeBankDetailID: item.employeeBankDetailID ?? item.employeeBankDetailId ?? item.EmployeeBankDetailID,
        customerID: item.customerID ?? item.customerId ?? item.CustomerID ?? 0,
        cifNo: item.cifNo ?? item.CIFNo ?? '',
        customerName: item.customerName ?? item.CustomerName ?? '',
        employeeID: item.employeeID ?? item.EmployeeID ?? '',
        departmentID: item.departmentID ?? item.departmentId ?? item.DepartmentID ?? undefined,
        joiningDate: item.joiningDate ?? item.JoiningDate ?? undefined,
        employeeStatus: item.employeeStatus ?? item.EmployeeStatus ?? 'Active',
        mobileNumber: item.mobileNumber ?? item.MobileNumber ?? '',
        bankName: item.bankName ?? item.BankName ?? '',
        ifscCode: item.ifscCode ?? item.IFSCCode ?? '',
        accountNumber: item.accountNumber ?? item.AccountNumber ?? '',
        accountType: item.accountType ?? item.AccountType ?? 'Savings',
        branchID: item.branchID ?? item.branchId ?? item.BranchID ?? undefined,
        customerBranchID: item.customerBranchID ?? item.CustomerBranchID ?? undefined,
      }));

      if (urlCustomerId && params.get('source') === '360dashboard') {
        setData(normalizedEmpData.filter((d) => d.customerID.toString() === urlCustomerId));
      } else {
        setData(normalizedEmpData);
      }

      setDirtyCustomerIds(new Set());
      setRowErrors({});

      setDepartments(
        (Array.isArray(deptData) ? deptData : []).map((d: any) => ({
          id: d.departmentID ?? d.departmentId ?? d.DepartmentID ?? d.id,
          name: d.departmentName ?? d.DepartmentName ?? d.name,
        }))
      );
      setBranches(
        (Array.isArray(branchData) ? branchData : []).map((b: any) => ({
          id: b.branchID ?? b.branchId ?? b.BranchID ?? b.id,
          name: b.branchName ?? b.BranchName ?? b.name,
        }))
      );

      // Process Bank Master list
      const masterBanks: BankItem[] = (Array.isArray(bankData) ? bankData : []).map((b: any) => ({
        bankID: b.bankID ?? b.bankId ?? b.BankID ?? 0,
        bankName: (b.bankName ?? b.BankName ?? '').trim(),
      }));

      const existingBankNames = new Set(masterBanks.map((b) => b.bankName.toLowerCase()));
      normalizedEmpData.forEach((item) => {
        const name = (item.bankName || '').trim();
        if (name && !existingBankNames.has(name.toLowerCase())) {
          existingBankNames.add(name.toLowerCase());
          masterBanks.push({ bankID: -Math.floor(Math.random() * 100000), bankName: name });
        }
      });

      masterBanks.sort((a, b) => a.bankName.localeCompare(b.bankName));
      setBanks(masterBanks);
    } catch (err: any) {
      const msg = err?.message || 'डेटा लोड करताना त्रुटी आली. कृपया रीफ्रेश करा.';
      setError(msg);
      toast.error(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedSocietyBranchId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSource(params.get('source') || '');
    setContextCustomerId(params.get('customerId') || '');
    fetchData();
  }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, deptFilter, completionFilter, pageSize]);

  const handleInputChange = (customerID: number, field: keyof EmployeeBankDetail, value: any) => {
    setData((prev) =>
      prev.map((item) => {
        if (item.customerID === customerID) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
    setDirtyCustomerIds((prev) => {
      const next = new Set(prev);
      next.add(customerID);
      return next;
    });
    setRowErrors((prev) => {
      if (!prev[customerID]) return prev;
      const next = { ...prev };
      delete next[customerID];
      return next;
    });
  };

  const handleAddBank = async () => {
    const trimmedName = newBankName.trim();
    if (!trimmedName) {
      setAddBankError('कृपया बँकेचे नाव प्रविष्ट करा.');
      return;
    }

    setAddingBank(true);
    setAddBankError('');
    setAddBankSuccess('');

    try {
      const response = await fetch('/api/BankMasters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankName: trimmedName }),
      });

      if (!response.ok) {
        const msg = await readErrorMessage(response, 'बँक सेव्ह करताना त्रुटी आली.');
        setAddBankError(msg);
        toast.error(msg);
        return;
      }

      const savedBank = await response.json();
      const bankNameAdded = (savedBank.bankName ?? savedBank.BankName ?? trimmedName).trim();
      const newBankId = Number(savedBank.bankID ?? savedBank.bankId ?? savedBank.BankID ?? 0);

      if (newBankId <= 0) {
        setAddBankError('सर्व्हरकडून वैध बँक आयडी प्राप्त झाला नाही.');
        return;
      }

      setBanks((prev) => {
        if (prev.some((b) => b.bankName.toLowerCase() === bankNameAdded.toLowerCase())) {
          return prev;
        }
        return [...prev, { bankID: newBankId, bankName: bankNameAdded }].sort((a, b) =>
          a.bankName.localeCompare(b.bankName)
        );
      });

      if (activeCustomerIdForBank !== null) {
        handleInputChange(activeCustomerIdForBank, 'bankName', bankNameAdded);
      }

      const successMsg = `'${bankNameAdded}' बँक यशस्वीरीत्या जोडली गेली!`;
      setAddBankSuccess(successMsg);
      toast.success(successMsg);
      setNewBankName('');
    } catch (err) {
      console.error('API call error when saving bank:', err);
      const msg = 'सर्व्हरशी संपर्क होऊ शकला नाही. कृपया नेटवर्क तपासा.';
      setAddBankError(msg);
      toast.error(msg);
    } finally {
      setAddingBank(false);
    }
  };

  const handleAddDept = async () => {
    const trimmedName = newDeptName.trim();
    if (!trimmedName) {
      setAddDeptError('कृपया विभागाचे नाव प्रविष्ट करा.');
      return;
    }

    setAddingDept(true);
    setAddDeptError('');
    setAddDeptSuccess('');

    try {
      const response = await fetch('/api/DepartmentMaster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentName: trimmedName,
          departmentCode: newDeptCode.trim().toUpperCase(),
        }),
      });

      if (!response.ok) {
        const msg = await readErrorMessage(response, 'विभाग सेव्ह करताना त्रुटी आली.');
        setAddDeptError(msg);
        toast.error(msg);
        return;
      }

      const savedDept = await response.json();
      const deptNameAdded = (savedDept.departmentName ?? savedDept.DepartmentName ?? trimmedName).trim();
      const newDeptId = Number(savedDept.departmentID ?? savedDept.departmentId ?? savedDept.DepartmentID ?? 0);

      if (newDeptId <= 0) {
        setAddDeptError('सर्व्हरकडून वैध विभाग आयडी प्राप्त झाला नाही.');
        return;
      }

      setDepartments((prev) => {
        if (prev.some((d) => d.id === newDeptId || d.name.toLowerCase() === deptNameAdded.toLowerCase())) {
          return prev;
        }
        return [...prev, { id: newDeptId, name: deptNameAdded }].sort((a, b) => a.name.localeCompare(b.name));
      });

      if (activeCustomerIdForDept !== null) {
        handleInputChange(activeCustomerIdForDept, 'departmentID', newDeptId);
      }

      const successMsg = `'${deptNameAdded}' विभाग यशस्वीरीत्या जोडला गेला!`;
      setAddDeptSuccess(successMsg);
      toast.success(successMsg);
      setNewDeptName('');
      setNewDeptCode('');
    } catch (err) {
      console.error('API call error when saving department:', err);
      const msg = 'सर्व्हरशी संपर्क होऊ शकला नाही. कृपया नेटवर्क तपासा.';
      setAddDeptError(msg);
      toast.error(msg);
    } finally {
      setAddingDept(false);
    }
  };

  const handleAddBranch = async () => {
    const trimmedName = newBranchName.trim();
    if (!trimmedName) {
      setAddBranchError('कृपया कंपनी शाखेचे नाव प्रविष्ट करा.');
      return;
    }

    setAddingBranch(true);
    setAddBranchError('');
    setAddBranchSuccess('');

    const autoCode = newBranchCode.trim().toUpperCase() || `BR${Date.now().toString().slice(-4)}`;

    try {
      const response = await fetch('/api/BranchMaster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchName: trimmedName,
          branchCode: autoCode,
          branchType: 'Branch',
          status: true,
        }),
      });

      if (!response.ok) {
        const msg = await readErrorMessage(response, 'कंपनी शाखा सेव्ह करताना त्रुटी आली.');
        setAddBranchError(msg);
        toast.error(msg);
        return;
      }

      const savedBranch = await response.json();
      const branchNameAdded = (savedBranch.branchName ?? savedBranch.BranchName ?? trimmedName).trim();
      const newBranchId = Number(savedBranch.branchID ?? savedBranch.branchId ?? savedBranch.BranchID ?? 0);

      if (newBranchId <= 0) {
        setAddBranchError('सर्व्हरकडून वैध शाखा आयडी प्राप्त झाला नाही.');
        return;
      }

      setBranches((prev) => {
        if (prev.some((b) => b.id === newBranchId || b.name.toLowerCase() === branchNameAdded.toLowerCase())) {
          return prev;
        }
        return [...prev, { id: newBranchId, name: branchNameAdded }].sort((a, b) => a.name.localeCompare(b.name));
      });

      if (activeCustomerIdForBranch !== null) {
        handleInputChange(activeCustomerIdForBranch, 'branchID', newBranchId);
      }

      const successMsg = `'${branchNameAdded}' शाखा यशस्वीरीत्या जोडली गेली!`;
      setAddBranchSuccess(successMsg);
      toast.success(successMsg);
      setNewBranchName('');
      setNewBranchCode('');
    } catch (err) {
      console.error('API call error when saving branch:', err);
      const msg = 'सर्व्हरशी संपर्क होऊ शकला नाही. कृपया नेटवर्क तपासा.';
      setAddBranchError(msg);
      toast.error(msg);
    } finally {
      setAddingBranch(false);
    }
  };

  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.filter((item) => {
      if (statusFilter !== 'all' && item.employeeStatus !== statusFilter) {
        return false;
      }
      if (deptFilter !== 'all' && String(item.departmentID ?? '') !== deptFilter) {
        return false;
      }
      if (completionFilter === 'completed' && !isRowBankComplete(item)) {
        return false;
      }
      if (completionFilter === 'pending' && isRowBankComplete(item)) {
        return false;
      }
      if (!q) return true;
      return (
        (item.customerName && item.customerName.toLowerCase().includes(q)) ||
        (item.cifNo && item.cifNo.toLowerCase().includes(q)) ||
        (item.employeeID && item.employeeID.toLowerCase().includes(q)) ||
        (item.bankName && item.bankName.toLowerCase().includes(q)) ||
        (item.ifscCode && item.ifscCode.toLowerCase().includes(q)) ||
        (item.accountNumber && item.accountNumber.toLowerCase().includes(q)) ||
        (item.mobileNumber && item.mobileNumber.toLowerCase().includes(q))
      );
    });
  }, [data, searchQuery, statusFilter, deptFilter, completionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, safePage, pageSize]);

  const handleSaveAll = async () => {
    setError('');
    if (dirtyCustomerIds.size === 0) {
      toast('सेव्ह करण्यासाठी कोणत्याही नोंदीत बदल केलेला नाही.');
      return;
    }

    const { errorsByCustomer, summaryMessage } = validateRowsForSave(data, dirtyCustomerIds);
    if (Object.keys(errorsByCustomer).length > 0) {
      setRowErrors(errorsByCustomer);
      setError(summaryMessage);
      toast.error(summaryMessage);

      // Jump to page containing the first error row if visible in filteredData
      const firstInvalidCustId = Number(Object.keys(errorsByCustomer)[0]);
      const idx = filteredData.findIndex((r) => r.customerID === firstInvalidCustId);
      if (idx >= 0) {
        setCurrentPage(Math.floor(idx / pageSize) + 1);
      }
      return;
    }

    const dirtyRows = data.filter((row) => dirtyCustomerIds.has(row.customerID));

    setSaving(true);
    try {
      const response = await fetch('/api/EmployeeBankDetails/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dirtyRows),
      });

      if (!response.ok) {
        const errMsg = await readErrorMessage(response, 'माहिती सेव्ह करताना त्रुटी आली.');
        setError(errMsg);
        toast.error(errMsg);
        return;
      }

      const resJson = await response.json().catch(() => null);
      const okMsg = resJson?.message || 'कर्मचारी बँक माहिती यशस्वीरित्या सेव्ह झाली!';
      toast.success(okMsg);
      setDirtyCustomerIds(new Set());
      setRowErrors({});
      await fetchData();
    } catch (err) {
      console.error(err);
      const msg = 'माहिती सेव्ह करताना त्रुटी आली. कृपया सर्व्हर कनेक्शन तपासा.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      toast.error('निर्यात (Export) करण्यासाठी डेटा उपलब्ध नाही.');
      return;
    }
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    const rows = filteredData.map((r, i) => ({
      'अ.क्र.': i + 1,
      'CIF क्र.': r.cifNo || `CIF${String(r.customerID).padStart(6, '0')}`,
      'खातेदाराचे नाव': r.customerName,
      'मोबाईल क्र.': r.mobileNumber || '-',
      'कर्मचारी आयडी': r.employeeID || '-',
      'विभाग': r.departmentID ? deptMap.get(r.departmentID) || '-' : '-',
      'रुजू तारीख': r.joiningDate ? r.joiningDate.split('T')[0] : '-',
      'पद स्थिती': r.employeeStatus,
      'बँकेचे नाव': r.bankName || '-',
      'IFSC कोड': r.ifscCode || '-',
      'खाते क्रमांक': r.accountNumber || '-',
      'खात्याचा प्रकार': r.accountType,
      'कंपनी शाखा': r.branchID ? branchMap.get(r.branchID) || '-' : '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'EmployeeBankDetails');
    XLSX.writeFile(wb, `Khatedar_Bank_Details_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Excel फाईल डाउनलोड झाली!');
  };

  const handleSocietyBranchChange = (newBranchId: string) => {
    if (dirtyCustomerIds.size > 0) {
      const proceed = window.confirm('काही नोंदींमध्ये न सेव्ह केलेले बदल आहेत. शाखा बदलल्यास ते बदल रद्द होतील. पुढे जायचे का?');
      if (!proceed) return;
    }
    setSelectedSocietyBranchId(newBranchId);
    fetchData(newBranchId);
  };

  const navigateBack = () => {
    if (dirtyCustomerIds.size > 0) {
      const proceed = window.confirm('काही नोंदींमध्ये न सेव्ह केलेले बदल आहेत. सेव्ह न करता बाहेर पडायचे का?');
      if (!proceed) return;
    }
    if (onNavigate) {
      onNavigate('customer-360', { customerId: contextCustomerId });
    }
  };

  const completedCount = useMemo(() => data.filter(isRowBankComplete).length, [data]);

  return (
    <div className="p-2 max-w-[1600px] mx-auto bg-gray-50 min-h-screen font-sans pb-6">
      {/* 360 Dashboard Breadcrumb */}
      {source === '360dashboard' && (
        <div className="mb-2.5 flex flex-wrap justify-between items-center bg-white p-2 rounded-sm border border-gray-200 shadow-xs">
          <nav className="flex text-[11px] text-gray-500 font-medium items-center">
            <span
              className="flex items-center hover:text-primary cursor-pointer"
              onClick={() => onNavigate && onNavigate('dashboard')}
            >
              <Home size={12} className="mr-1 text-gray-400" /> होम
            </span>
            <span className="mx-1.5 text-gray-300">/</span>
            <span
              className="flex items-center hover:text-primary cursor-pointer"
              onClick={() => onNavigate && onNavigate('customers')}
            >
              <User size={12} className="mr-1 text-gray-400" /> खातेदार माहिती
            </span>
            <span className="mx-1.5 text-gray-300">/</span>
            <span className="text-primary hover:underline cursor-pointer font-bold flex items-center" onClick={navigateBack}>
              360 डॅशबोर्ड
            </span>
            <span className="mx-1.5 text-gray-300">/</span>
            <span className="text-gray-800 font-semibold">कर्मचारी बँक तपशील</span>
          </nav>

          <button
            onClick={navigateBack}
            className="flex items-center text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-sm hover:bg-primary/20 transition-colors font-bold cursor-pointer"
          >
            <ChevronLeft size={14} className="mr-1" /> 360 डॅशबोर्डवर परत जा
          </button>
        </div>
      )}

      {/* Main Header Action Bar */}
      <div className="mb-3 flex flex-wrap justify-between items-center bg-white p-2.5 rounded-sm shadow-xs border border-gray-200 gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary p-2 rounded-sm">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-gray-800 leading-tight">
                खातेदार व कर्मचारी बँक तपशील (Customer &amp; Employee Bank Details)
              </h1>
              {source === '360dashboard' && (
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                  खातेदार फिल्टर लागू
                </span>
              )}
              {dirtyCustomerIds.size > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-300">
                  {dirtyCustomerIds.size} नोंदींमध्ये बदल प्रलंबित
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              पतसंस्थेच्या नोंदणीकृत खातेदारांचे (CIF) वैयक्तिक बँक खाते, IFSC कोड, मूळ कंपनी/विभाग व पद स्थिती माहिती व्यवस्थापित करा
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setActiveCustomerIdForDept(null);
              setNewDeptName('');
              setNewDeptCode('');
              setAddDeptError('');
              setAddDeptSuccess('');
              setShowAddDeptModal(true);
            }}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-sm font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="नवीन विभाग जोडा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>विभाग जोडा</span>
          </button>

          <button
            onClick={() => {
              setActiveCustomerIdForBank(null);
              setNewBankName('');
              setAddBankError('');
              setAddBankSuccess('');
              setShowAddBankModal(true);
            }}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-sm font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="नवीन बँक जोडा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>बँक जोडा</span>
          </button>

          <button
            onClick={() => {
              setActiveCustomerIdForBranch(null);
              setNewBranchName('');
              setNewBranchCode('');
              setAddBranchError('');
              setAddBranchSuccess('');
              setShowAddBranchModal(true);
            }}
            className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-sm font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="नवीन कंपनी शाखा जोडा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>कंपनी शाखा जोडा</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={loading || filteredData.length === 0}
            className="flex items-center gap-1 bg-teal-700 hover:bg-teal-800 text-white px-2.5 py-1.5 rounded-sm font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            title="Excel मध्ये डाउनलोड करा"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            onClick={handleSaveAll}
            disabled={saving || loading || dirtyCustomerIds.size === 0}
            className="flex items-center gap-1.5 bg-primary hover:bg-[#004a75] text-white px-4 py-1.5 rounded-sm font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>सेव्ह होत आहे...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>
                  बदल सेव्ह करा {dirtyCustomerIds.size > 0 ? `(${dirtyCustomerIds.size})` : ''}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 mb-3 rounded-sm text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="नाव, CIF, मोबाईल, बँक, IFSC किंवा खाते क्र...."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 pl-8 pr-3 py-1.5 rounded-sm bg-white focus:outline-none focus:border-primary text-xs"
              />
            </div>

            {isHoAdmin && societyBranches.length > 0 && (
              <div className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-gray-500" />
                <select
                  value={selectedSocietyBranchId}
                  onChange={(e) => handleSocietyBranchChange(e.target.value)}
                  className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-primary font-medium"
                  title="पतसंस्था शाखा निवडा"
                >
                  <option value="all">सर्व शाखा (All Branches)</option>
                  {societyBranches.map((sb) => (
                    <option key={sb.branchID} value={String(sb.branchID)}>
                      {sb.branchName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <select
              value={completionFilter}
              onChange={(e) => setCompletionFilter(e.target.value as 'all' | 'completed' | 'pending')}
              className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="all">सर्व बँक स्थिती</option>
              <option value="completed">बँक तपशील पूर्ण</option>
              <option value="pending">बँक तपशील अपूर्ण</option>
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="all">सर्व विभाग</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="all">सर्व पद स्थिती</option>
              <option value="Active">सक्रिय (Active)</option>
              <option value="Retired">निवृत्त (Retired)</option>
              <option value="Resigned">राजीनामा (Resigned)</option>
              <option value="Transferred">बदली (Transferred)</option>
              <option value="Suspended">निलंबित (Suspended)</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-600 font-medium">
            <span>
              बँक पूर्ण: <strong className="text-emerald-700 font-bold">{completedCount}</strong> / {data.length}
            </span>
            <span>
              दाखवलेले: <strong className="text-primary font-bold">{filteredData.length}</strong>
            </span>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="p-10 text-center text-gray-500 text-xs font-semibold flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span>डेटा लोड होत आहे... (Loading Data...)</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 border-b border-gray-300 shadow-xs">
                  <tr>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">CIF क्र.</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap min-w-[150px]">
                      खातेदाराचे नाव
                    </th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">मोबाईल क्र.</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">कर्मचारी आयडी</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">विभाग (Dept)</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">रुजू तारीख</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">पद स्थिती</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">वैयक्तिक बँकेचे नाव</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">IFSC कोड</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">खाते क्रमांक</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">खाते प्रकार</th>
                    <th className="px-2.5 py-2 font-bold whitespace-nowrap">कंपनी शाखा</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Landmark className="w-8 h-8 text-gray-300" />
                          <p className="font-semibold text-gray-600">कोणतीही खातेदार/कर्मचारी नोंद सापडली नाही.</p>
                          <p className="text-[11px] text-gray-400">शोधाचा शब्द किंवा फिल्टर बदला.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row) => {
                      const isDirty = dirtyCustomerIds.has(row.customerID);
                      const rowError = rowErrors[row.customerID];
                      return (
                        <React.Fragment key={row.customerID || row.cifNo}>
                          <tr
                            className={`transition-colors ${
                              rowError
                                ? 'bg-red-50/70'
                                : isDirty
                                ? 'bg-amber-50/60 hover:bg-amber-50'
                                : 'hover:bg-blue-50/40'
                            }`}
                          >
                            <td className="px-2.5 py-1.5 border-r border-gray-100 font-bold text-primary whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <span>{row.cifNo || 'CIF' + String(row.customerID).padStart(6, '0')}</span>
                                {isDirty && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                                    title="बदल केलेली नोंद (Unsaved)"
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-100 font-bold text-gray-800 whitespace-nowrap">
                              {row.customerName}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-100 text-gray-600 whitespace-nowrap font-mono">
                              {row.mobileNumber || '-'}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-100">
                              <input
                                type="text"
                                maxLength={50}
                                value={row.employeeID || ''}
                                onChange={(e) => handleInputChange(row.customerID, 'employeeID', e.target.value)}
                                className="border border-gray-300 rounded-sm px-2 py-1 w-24 text-xs focus:outline-none focus:border-primary bg-white font-medium"
                                placeholder="Emp ID"
                              />
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-100">
                              <select
                                value={row.departmentID !== undefined && row.departmentID !== null ? row.departmentID : ''}
                                onChange={(e) => {
                                  if (e.target.value === '__ADD_NEW_DEPT__') {
                                    setActiveCustomerIdForDept(row.customerID);
                                    setNewDeptName('');
                                    setNewDeptCode('');
                                    setAddDeptError('');
                                    setAddDeptSuccess('');
                                    setShowAddDeptModal(true);
                                  } else {
                                    handleInputChange(
                                      row.customerID,
                                      'departmentID',
                                      e.target.value ? Number(e.target.value) : undefined
                                    );
                                  }
                                }}
                                className="border border-gray-300 rounded-sm px-2 py-1 w-36 text-xs focus:outline-none focus:border-primary bg-white font-medium"
                              >
                                <option value="">-- विभाग निवडा --</option>
                                {departments.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                                <option value="__ADD_NEW_DEPT__" className="font-bold text-blue-600 bg-blue-50">
                                  + नवीन विभाग जोडा (Add New Dept)
                                </option>
                              </select>
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-100">
                              <input
                                type="date"
                                value={row.joiningDate ? row.joiningDate.split('T')[0] : ''}
                                onChange={(e) =>
                                  handleInputChange(
                                    row.customerID,
                                    'joiningDate',
                                    e.target.value ? e.target.value : undefined
                                  )
                                }
                                className="border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white"
                              />
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-100">
                              <select
                                value={row.employeeStatus}
                                onChange={(e) => handleInputChange(row.customerID, 'employeeStatus', e.target.value)}
                                className="border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white font-semibold"
                              >
                                <option value="Active">सक्रिय (Active)</option>
                                <option value="Retired">निवृत्त (Retired)</option>
                                <option value="Resigned">राजीनामा (Resigned)</option>
                                <option value="Transferred">बदली (Transferred)</option>
                                <option value="Suspended">निलंबित (Suspended)</option>
                              </select>
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-100">
                              <select
                                value={row.bankName || ''}
                                onChange={(e) => {
                                  if (e.target.value === '__ADD_NEW__') {
                                    setActiveCustomerIdForBank(row.customerID);
                                    setNewBankName('');
                                    setAddBankError('');
                                    setAddBankSuccess('');
                                    setShowAddBankModal(true);
                                  } else {
                                    handleInputChange(row.customerID, 'bankName', e.target.value);
                                  }
                                }}
                                className="border border-gray-300 rounded-sm px-2 py-1 w-40 text-xs focus:outline-none focus:border-primary bg-white font-medium"
                              >
                                <option value="">-- बँक निवडा --</option>
                                {banks.map((b) => (
                                  <option key={b.bankID + '-' + b.bankName} value={b.bankName}>
                                    {b.bankName}
                                  </option>
                                ))}
                                <option value="__ADD_NEW__" className="font-bold text-blue-600 bg-blue-50">
                                  + नवीन बँक जोडा (Add New Bank)
                                </option>
                              </select>
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-100">
                              <input
                                type="text"
                                maxLength={11}
                                value={row.ifscCode || ''}
                                onChange={(e) =>
                                  handleInputChange(row.customerID, 'ifscCode', e.target.value.toUpperCase().trim())
                                }
                                className="border border-gray-300 rounded-sm px-2 py-1 w-28 text-xs uppercase font-mono focus:outline-none focus:border-primary bg-white font-medium"
                                placeholder="SBIN0001234"
                              />
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-100">
                              <input
                                type="text"
                                maxLength={20}
                                value={row.accountNumber || ''}
                                onChange={(e) =>
                                  handleInputChange(row.customerID, 'accountNumber', e.target.value.replace(/\s+/g, ''))
                                }
                                className="border border-gray-300 rounded-sm px-2 py-1 w-32 text-xs font-mono focus:outline-none focus:border-primary bg-white font-medium"
                                placeholder="खाते क्रमांक"
                              />
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-100">
                              <select
                                value={row.accountType}
                                onChange={(e) => handleInputChange(row.customerID, 'accountType', e.target.value)}
                                className="border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white"
                              >
                                <option value="Savings">बचत (Savings)</option>
                                <option value="Current">चालू (Current)</option>
                                <option value="Salary">पगार (Salary)</option>
                              </select>
                            </td>
                            <td className="px-2.5 py-1.5">
                              <select
                                value={row.branchID !== undefined && row.branchID !== null ? row.branchID : ''}
                                onChange={(e) => {
                                  if (e.target.value === '__ADD_NEW_BRANCH__') {
                                    setActiveCustomerIdForBranch(row.customerID);
                                    setNewBranchName('');
                                    setNewBranchCode('');
                                    setAddBranchError('');
                                    setAddBranchSuccess('');
                                    setShowAddBranchModal(true);
                                  } else {
                                    handleInputChange(
                                      row.customerID,
                                      'branchID',
                                      e.target.value ? Number(e.target.value) : undefined
                                    );
                                  }
                                }}
                                className="border border-gray-300 rounded-sm px-2 py-1 w-32 text-xs focus:outline-none focus:border-primary bg-white"
                              >
                                <option value="">-- कंपनी शाखा --</option>
                                {branches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                                <option value="__ADD_NEW_BRANCH__" className="font-bold text-purple-600 bg-purple-50">
                                  + नवीन कंपनी शाखा जोडा
                                </option>
                              </select>
                            </td>
                          </tr>
                          {rowError && (
                            <tr className="bg-red-50">
                              <td colSpan={12} className="px-3 py-1 text-[11px] font-semibold text-red-700 border-b border-red-200">
                                ⚠ {rowError}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap justify-between items-center gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span>प्रति पान नोंदी:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="border border-gray-300 rounded-sm px-1.5 py-0.5 bg-white text-xs font-semibold"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  (एकूण {filteredData.length} पैकी{' '}
                  {filteredData.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, filteredData.length)})
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-2 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-100 disabled:opacity-40 flex items-center gap-0.5 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> मागील
                </button>
                <span className="px-2 font-bold text-gray-800">
                  पान {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-2 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-100 disabled:opacity-40 flex items-center gap-0.5 cursor-pointer"
                >
                  पुढील <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Add Bank Modal */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-sm shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-sm text-gray-800">नवीन बँक जोडा (Add New Bank)</h3>
              </div>
              <button
                onClick={() => {
                  setShowAddBankModal(false);
                  setAddBankError('');
                  setNewBankName('');
                  setActiveCustomerIdForBank(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-sm transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {addBankSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-sm text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{addBankSuccess}</span>
                </div>
              )}

              {addBankError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{addBankError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  बँकेचे नाव (Bank Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={newBankName}
                  onChange={(e) => {
                    setNewBankName(e.target.value);
                    if (addBankSuccess) setAddBankSuccess('');
                    if (addBankError) setAddBankError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddBank();
                  }}
                  placeholder="उदा. स्टेट बँक ऑफ इंडिया / ICICI Bank"
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white"
                  autoFocus
                />
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddBankModal(false);
                  setAddBankError('');
                  setAddBankSuccess('');
                  setNewBankName('');
                  setActiveCustomerIdForBank(null);
                }}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-sm text-xs font-medium hover:bg-gray-100 transition-colors"
              >
                {addBankSuccess ? 'पूर्ण झाले (Close)' : 'रद्द करा (Cancel)'}
              </button>
              <button
                onClick={handleAddBank}
                disabled={addingBank || !newBankName.trim()}
                className="flex items-center gap-1.5 bg-primary hover:bg-[#004a75] text-white px-4 py-1.5 rounded-sm font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {addingBank ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>सेव्ह होत आहे...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>बँक सेव्ह करा</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Department Modal */}
      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-sm shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-gray-800">नवीन विभाग जोडा (Add New Department)</h3>
              </div>
              <button
                onClick={() => {
                  setShowAddDeptModal(false);
                  setAddDeptError('');
                  setAddDeptSuccess('');
                  setNewDeptName('');
                  setNewDeptCode('');
                  setActiveCustomerIdForDept(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-sm transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {addDeptSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-sm text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{addDeptSuccess}</span>
                </div>
              )}

              {addDeptError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{addDeptError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  विभागाचे नाव (Department Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={newDeptName}
                  onChange={(e) => {
                    setNewDeptName(e.target.value);
                    if (addDeptSuccess) setAddDeptSuccess('');
                    if (addDeptError) setAddDeptError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddDept();
                  }}
                  placeholder="उदा. महसूल विभाग / वित्त विभाग / प्रशासन"
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  विभाग कोड (Department Code - पर्यायी)
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  placeholder="उदा. DEPT01"
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white uppercase"
                />
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddDeptModal(false);
                  setAddDeptError('');
                  setAddDeptSuccess('');
                  setNewDeptName('');
                  setNewDeptCode('');
                  setActiveCustomerIdForDept(null);
                }}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-sm text-xs font-medium hover:bg-gray-100 transition-colors"
              >
                {addDeptSuccess ? 'पूर्ण झाले (Close)' : 'रद्द करा (Cancel)'}
              </button>
              <button
                onClick={handleAddDept}
                disabled={addingDept || !newDeptName.trim()}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-sm font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {addingDept ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>सेव्ह होत आहे...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>विभाग सेव्ह करा</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Company Branch Modal */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-sm shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-gray-800">नवीन कंपनी शाखा जोडा (Add Company Branch)</h3>
              </div>
              <button
                onClick={() => {
                  setShowAddBranchModal(false);
                  setAddBranchError('');
                  setAddBranchSuccess('');
                  setNewBranchName('');
                  setNewBranchCode('');
                  setActiveCustomerIdForBranch(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-sm transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {addBranchSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-sm text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{addBranchSuccess}</span>
                </div>
              )}

              {addBranchError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-sm text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{addBranchError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  कंपनी शाखेचे नाव (Branch Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={newBranchName}
                  onChange={(e) => {
                    setNewBranchName(e.target.value);
                    if (addBranchSuccess) setAddBranchSuccess('');
                    if (addBranchError) setAddBranchError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddBranch();
                  }}
                  placeholder="उदा. मुख्य कार्यालय / पुणे शाखा / कोल्हापूर शाखा"
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  शाखा कोड (Branch Code - पर्यायी)
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  placeholder="उदा. BR01"
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white uppercase"
                />
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddBranchModal(false);
                  setAddBranchError('');
                  setAddBranchSuccess('');
                  setNewBranchName('');
                  setNewBranchCode('');
                  setActiveCustomerIdForBranch(null);
                }}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-sm text-xs font-medium hover:bg-gray-100 transition-colors"
              >
                {addBranchSuccess ? 'पूर्ण झाले (Close)' : 'रद्द करा (Cancel)'}
              </button>
              <button
                onClick={handleAddBranch}
                disabled={addingBranch || !newBranchName.trim()}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-sm font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {addingBranch ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>सेव्ह होत आहे...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>शाखा सेव्ह करा</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeBankDetails;
