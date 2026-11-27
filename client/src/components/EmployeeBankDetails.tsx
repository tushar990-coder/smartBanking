import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  SlidersHorizontal,
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

type GridViewMode = 'BANK_COMPACT' | 'ALL_COLUMNS';

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

  // Clean View Mode: BANK_COMPACT hides cluttering HR columns unless toggled
  const [viewMode, setViewMode] = useState<GridViewMode>('BANK_COMPACT');
  const [showMasterMenu, setShowMasterMenu] = useState(false);
  const masterMenuRef = useRef<HTMLDivElement | null>(null);

  // Single-Row Detail Edit Modal (for comfortable editing of all Bank + Employee fields)
  const [editingRow, setEditingRow] = useState<EmployeeBankDetail | null>(null);
  const [savingSingleRow, setSavingSingleRow] = useState(false);

  // Dirty tracking & row validation errors
  const [dirtyCustomerIds, setDirtyCustomerIds] = useState<Set<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  // Search, Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (masterMenuRef.current && !masterMenuRef.current.contains(e.target as Node)) {
        setShowMasterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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
        if (editingRow && editingRow.customerID === activeCustomerIdForBank) {
          setEditingRow((prev) => (prev ? { ...prev, bankName: bankNameAdded } : null));
        }
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
        if (editingRow && editingRow.customerID === activeCustomerIdForDept) {
          setEditingRow((prev) => (prev ? { ...prev, departmentID: newDeptId } : null));
        }
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
        if (editingRow && editingRow.customerID === activeCustomerIdForBranch) {
          setEditingRow((prev) => (prev ? { ...prev, branchID: newBranchId } : null));
        }
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
      const okMsg = resJson?.message || 'खातेदार व कर्मचारी बँक माहिती यशस्वीरित्या सेव्ह झाली!';
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

  // Quick Save from the Single-Customer Detail Modal
  const handleSaveSingleModalRow = async () => {
    if (!editingRow) return;
    const simulatedAll = data.map((r) => (r.customerID === editingRow.customerID ? editingRow : r));
    const singleDirty = new Set<number>([editingRow.customerID]);
    const { errorsByCustomer, summaryMessage } = validateRowsForSave(simulatedAll, singleDirty);
    if (Object.keys(errorsByCustomer).length > 0) {
      toast.error(summaryMessage);
      return;
    }

    setSavingSingleRow(true);
    try {
      const response = await fetch('/api/EmployeeBankDetails/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([editingRow]),
      });

      if (!response.ok) {
        const errMsg = await readErrorMessage(response, 'माहिती सेव्ह करताना त्रुटी आली.');
        toast.error(errMsg);
        return;
      }

      setData(simulatedAll);
      setDirtyCustomerIds((prev) => {
        const next = new Set(prev);
        next.delete(editingRow.customerID);
        return next;
      });
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[editingRow.customerID];
        return next;
      });
      toast.success(`${editingRow.customerName} यांची बँक व कर्मचारी माहिती सेव्ह झाली!`);
      setEditingRow(null);
    } catch {
      toast.error('माहिती सेव्ह करताना त्रुटी आली.');
    } finally {
      setSavingSingleRow(false);
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
  const deptNameMap = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);
  const totalCols = viewMode === 'BANK_COMPACT' ? 9 : 14;

  // Ultra-compact spreadsheet cell input styling (borderless at rest, crisp border on hover/focus)
  const cellInputBase =
    'h-6 px-1.5 rounded text-[11.5px] bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-primary focus:outline-none transition-colors';
  const cellSelectBase =
    'h-6 px-1 rounded text-[11.5px] bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-primary focus:outline-none transition-colors cursor-pointer';

  return (
    <div className="h-[calc(100vh-3.15rem)] flex flex-col gap-1.5 p-1.5 bg-slate-50 overflow-hidden font-sans">
      {/* TOP COMPACT 2-STRIP HEADER & FILTER BAR */}
      <div className="shrink-0 bg-white border border-slate-200 rounded-lg shadow-2xs px-2.5 py-1.5 space-y-1.5">
        {/* Strip 1: Title + Counts + Master Quick-Add Menu + Excel + Save */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {source === '360dashboard' && (
              <button
                type="button"
                onClick={navigateBack}
                className="h-6 px-2 rounded border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="360 डॅशबोर्डवर परत जा"
              >
                <Home size={11} />
                <ChevronLeft size={12} />
                <span>360 डॅशबोर्ड</span>
              </button>
            )}

            <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Landmark size={14} />
            </div>

            <h1 className="text-xs sm:text-sm font-black text-primary leading-tight truncate">
              खातेदार व कर्मचारी बँक तपशील
            </h1>

            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10.5px] font-bold text-emerald-800">
              बँक पूर्ण: {completedCount} / {data.length}
            </span>

            {dirtyCustomerIds.size > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10.5px] font-extrabold text-amber-900">
                ● {dirtyCustomerIds.size} नोंदींमध्ये बदल बाकी
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Consolidated Clean "+ मास्टर जोडा" Dropdown (replaces 3 rainbow buttons) */}
            <div className="relative" ref={masterMenuRef}>
              <button
                type="button"
                onClick={() => setShowMasterMenu((v) => !v)}
                className="h-7 px-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} className="text-primary" />
                <span>मास्टर जोडा</span>
                <ChevronDown size={12} className="text-slate-400" />
              </button>

              {showMasterMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 text-xs font-semibold text-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMasterMenu(false);
                      setActiveCustomerIdForBank(null);
                      setNewBankName('');
                      setAddBankError('');
                      setAddBankSuccess('');
                      setShowAddBankModal(true);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-primary/5 hover:text-primary flex items-center gap-2 cursor-pointer"
                  >
                    <Plus size={13} className="text-primary" />
                    <span>नवीन बँक जोडा</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMasterMenu(false);
                      setActiveCustomerIdForDept(null);
                      setNewDeptName('');
                      setNewDeptCode('');
                      setAddDeptError('');
                      setAddDeptSuccess('');
                      setShowAddDeptModal(true);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-primary/5 hover:text-primary flex items-center gap-2 cursor-pointer"
                  >
                    <Plus size={13} className="text-primary" />
                    <span>नवीन विभाग जोडा</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMasterMenu(false);
                      setActiveCustomerIdForBranch(null);
                      setNewBranchName('');
                      setNewBranchCode('');
                      setAddBranchError('');
                      setAddBranchSuccess('');
                      setShowAddBranchModal(true);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-primary/5 hover:text-primary flex items-center gap-2 cursor-pointer"
                  >
                    <Plus size={13} className="text-primary" />
                    <span>नवीन कंपनी शाखा जोडा</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fetchData()}
              disabled={loading}
              title="ताजे करा (Refresh)"
              className="h-7 px-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin text-primary' : ''} />
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || filteredData.length === 0}
              className="h-7 px-2.5 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet size={12} />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || loading || dirtyCustomerIds.size === 0}
              className="h-7 px-3.5 rounded-md bg-primary hover:bg-primary/90 text-white text-[11.5px] font-extrabold flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>सेव्ह होत आहे...</span>
                </>
              ) : (
                <>
                  <Save size={12} />
                  <span>बदल सेव्ह करा {dirtyCustomerIds.size > 0 ? `(${dirtyCustomerIds.size})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Strip 2: Search + View Mode Toggle (सुटसुटीत बँक vs सर्व रकाने) + Compact Filters */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative w-56 sm:w-64">
              <Search size={13} className="text-slate-400 absolute left-2 top-2 pointer-events-none" />
              <input
                type="text"
                placeholder="शोधा: नाव, CIF, मोबाईल, बँक, खाते क्र...."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 w-full border border-slate-300 pl-7 pr-6 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:border-primary text-[11px] font-semibold text-slate-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Clean View Toggle: बँक तपशील (सुटसुटीत) vs कर्मचारी + बँक (सर्व रकाने) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 h-7">
              <button
                type="button"
                onClick={() => setViewMode('BANK_COMPACT')}
                className={`h-6 px-2.5 rounded text-[11px] font-extrabold cursor-pointer transition-colors ${
                  viewMode === 'BANK_COMPACT'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                बँक तपशील (सुटसुटीत)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('ALL_COLUMNS')}
                className={`h-6 px-2.5 rounded text-[11px] font-extrabold cursor-pointer transition-colors ${
                  viewMode === 'ALL_COLUMNS'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                कर्मचारी + बँक (सर्व)
              </button>
            </div>

            {/* Society Branch Filter (HO) */}
            {isHoAdmin && societyBranches.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-md px-1.5 h-7">
                <Building2 size={12} className="text-primary shrink-0" />
                <select
                  value={selectedSocietyBranchId}
                  onChange={(e) => handleSocietyBranchChange(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-slate-800 focus:outline-none"
                  title="पतसंस्था शाखा निवडा"
                >
                  <option value="all">सर्व शाखा</option>
                  {societyBranches.map((sb) => (
                    <option key={sb.branchID} value={String(sb.branchID)}>
                      {sb.branchName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Bank Completion Filter */}
            <select
              value={completionFilter}
              onChange={(e) => setCompletionFilter(e.target.value as 'all' | 'completed' | 'pending')}
              className="h-7 border border-slate-300 rounded-md px-2 text-[11px] bg-white focus:outline-none focus:border-primary font-semibold text-slate-700"
            >
              <option value="all">सर्व बँक स्थिती</option>
              <option value="completed">✓ बँक पूर्ण</option>
              <option value="pending">○ बँक अपूर्ण</option>
            </select>

            {/* Department & Status Filters (shown when ALL_COLUMNS or active) */}
            {(viewMode === 'ALL_COLUMNS' || deptFilter !== 'all' || statusFilter !== 'all') && (
              <>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-7 border border-slate-300 rounded-md px-2 text-[11px] bg-white focus:outline-none focus:border-primary font-semibold text-slate-700"
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
                  className="h-7 border border-slate-300 rounded-md px-2 text-[11px] bg-white focus:outline-none focus:border-primary font-semibold text-slate-700"
                >
                  <option value="all">सर्व पद स्थिती</option>
                  <option value="Active">सक्रिय</option>
                  <option value="Retired">निवृत्त</option>
                  <option value="Resigned">राजीनामा</option>
                  <option value="Transferred">बदली</option>
                  <option value="Suspended">निलंबित</option>
                </select>
              </>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">
            नोंदी: <strong className="text-primary font-extrabold">{filteredData.length}</strong>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded text-[11px] font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <AlertCircle size={13} className="text-rose-600 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 cursor-pointer">
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* CENTER FULL-HEIGHT ULTRA-COMPACT SINGLE-LINE TABLE */}
      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-slate-500 text-xs font-bold">
            <RefreshCw size={16} className="animate-spin text-primary" />
            <span>खातेदार बँक माहिती लोड होत आहे...</span>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-primary text-white sticky top-0 z-10 text-[11px] font-bold select-none">
                  <tr className="h-7">
                    <th className="w-10 px-2 text-center border-r border-white/15 whitespace-nowrap">अ.क्र.</th>
                    <th className="w-24 px-2 border-r border-white/15 whitespace-nowrap">CIF क्र.</th>
                    <th className="min-w-[180px] px-2.5 border-r border-white/15 whitespace-nowrap">खातेदाराचे नाव</th>
                    <th className="w-24 px-2 border-r border-white/15 whitespace-nowrap">मोबाईल क्र.</th>

                    {viewMode === 'ALL_COLUMNS' && (
                      <>
                        <th className="w-24 px-2 border-r border-white/15 whitespace-nowrap">कर्मचारी आयडी</th>
                        <th className="w-36 px-2 border-r border-white/15 whitespace-nowrap">विभाग</th>
                        <th className="w-28 px-2 border-r border-white/15 whitespace-nowrap">रुजू दि.</th>
                        <th className="w-24 px-2 border-r border-white/15 whitespace-nowrap">पद स्थिती</th>
                      </>
                    )}

                    <th className="w-48 px-2 border-r border-white/15 whitespace-nowrap">वैयक्तिक बँकेचे नाव</th>
                    <th className="w-28 px-2 border-r border-white/15 whitespace-nowrap">IFSC कोड</th>
                    <th className="w-36 px-2 border-r border-white/15 whitespace-nowrap">बँक खाते क्रमांक</th>
                    <th className="w-24 px-2 border-r border-white/15 whitespace-nowrap">खाते प्रकार</th>

                    {viewMode === 'ALL_COLUMNS' && (
                      <th className="w-32 px-2 border-r border-white/15 whitespace-nowrap">कंपनी शाखा</th>
                    )}

                    <th className="w-16 px-2 text-center whitespace-nowrap">सविस्तर</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11.5px]">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={totalCols} className="py-12 text-center text-slate-400 font-semibold">
                        कोणतीही खातेदार / कर्मचारी नोंद सापडली नाही.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row, idx) => {
                      const serialNo = (safePage - 1) * pageSize + idx + 1;
                      const isDirty = dirtyCustomerIds.has(row.customerID);
                      const rowError = rowErrors[row.customerID];
                      const bankDone = isRowBankComplete(row);
                      const deptTitle = row.departmentID ? deptNameMap.get(row.departmentID) : '';

                      return (
                        <tr
                          key={row.customerID || row.cifNo}
                          title={rowError ? `त्रुटी: ${rowError}` : undefined}
                          className={`h-7 transition-colors whitespace-nowrap ${
                            rowError
                              ? 'bg-rose-50/90 hover:bg-rose-100/70'
                              : isDirty
                              ? 'bg-amber-50/70 hover:bg-amber-100/60'
                              : idx % 2 === 0
                              ? 'bg-white hover:bg-primary/5'
                              : 'bg-slate-50/50 hover:bg-primary/5'
                          }`}
                        >
                          <td className="px-2 py-0.5 text-center text-slate-500 font-semibold border-r border-slate-100">
                            {serialNo}
                          </td>

                          <td className="px-2 py-0.5 font-mono text-[10.5px] font-bold text-primary border-r border-slate-100">
                            <div className="flex items-center gap-1">
                              {bankDone ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="बँक तपशील पूर्ण" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" title="बँक तपशील अपूर्ण" />
                              )}
                              <span>{row.cifNo || 'CIF' + String(row.customerID).padStart(6, '0')}</span>
                              {isDirty && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="न सेव्ह केलेला बदल" />
                              )}
                            </div>
                          </td>

                          <td
                            className="px-2.5 py-0.5 font-bold text-slate-800 border-r border-slate-100 max-w-[230px] truncate"
                            title={`${row.customerName}${deptTitle ? ` (${deptTitle})` : ''}`}
                          >
                            <span>{row.customerName}</span>
                            {viewMode === 'BANK_COMPACT' && (row.employeeID || deptTitle) && (
                              <span className="ml-1.5 px-1 py-0 rounded bg-slate-100 text-slate-500 text-[9.5px] font-semibold">
                                {row.employeeID || deptTitle}
                              </span>
                            )}
                          </td>

                          <td className="px-2 py-0.5 font-mono text-[10.5px] text-slate-600 border-r border-slate-100">
                            {row.mobileNumber || '-'}
                          </td>

                          {viewMode === 'ALL_COLUMNS' && (
                            <>
                              <td className="px-1 py-0.5 border-r border-slate-100">
                                <input
                                  type="text"
                                  maxLength={50}
                                  value={row.employeeID || ''}
                                  onChange={(e) => handleInputChange(row.customerID, 'employeeID', e.target.value)}
                                  placeholder="-"
                                  className={`${cellInputBase} w-20 font-medium text-slate-800`}
                                />
                              </td>

                              <td className="px-1 py-0.5 border-r border-slate-100">
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
                                  className={`${cellSelectBase} w-32 font-medium text-slate-700`}
                                >
                                  <option value="">- विभाग -</option>
                                  {departments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.name}
                                    </option>
                                  ))}
                                  <option value="__ADD_NEW_DEPT__">+ नवीन विभाग जोडा</option>
                                </select>
                              </td>

                              <td className="px-1 py-0.5 border-r border-slate-100">
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
                                  className={`${cellInputBase} w-28 text-[10.5px] py-0 text-slate-700`}
                                />
                              </td>

                              <td className="px-1 py-0.5 border-r border-slate-100">
                                <select
                                  value={row.employeeStatus}
                                  onChange={(e) => handleInputChange(row.customerID, 'employeeStatus', e.target.value)}
                                  className={`${cellSelectBase} w-24 font-semibold text-slate-700`}
                                >
                                  <option value="Active">सक्रिय</option>
                                  <option value="Retired">निवृत्त</option>
                                  <option value="Resigned">राजीनामा</option>
                                  <option value="Transferred">बदली</option>
                                  <option value="Suspended">निलंबित</option>
                                </select>
                              </td>
                            </>
                          )}

                          {/* Bank Name */}
                          <td className="px-1 py-0.5 border-r border-slate-100">
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
                              className={`${cellSelectBase} w-full min-w-[165px] font-semibold ${
                                row.bankName ? 'text-slate-900' : 'text-slate-400'
                              }`}
                            >
                              <option value="">-- बँक निवडा --</option>
                              {banks.map((b) => (
                                <option key={b.bankID + '-' + b.bankName} value={b.bankName} className="text-slate-800">
                                  {b.bankName}
                                </option>
                              ))}
                              <option value="__ADD_NEW__" className="font-bold text-primary">
                                + नवीन बँक जोडा
                              </option>
                            </select>
                          </td>

                          {/* IFSC */}
                          <td className="px-1 py-0.5 border-r border-slate-100">
                            <input
                              type="text"
                              maxLength={11}
                              value={row.ifscCode || ''}
                              onChange={(e) =>
                                handleInputChange(row.customerID, 'ifscCode', e.target.value.toUpperCase().trim())
                              }
                              placeholder="IFSC कोड"
                              className={`${cellInputBase} w-full min-w-[105px] uppercase font-mono font-semibold text-slate-800`}
                            />
                          </td>

                          {/* Account Number */}
                          <td className="px-1 py-0.5 border-r border-slate-100">
                            <input
                              type="text"
                              maxLength={20}
                              value={row.accountNumber || ''}
                              onChange={(e) =>
                                handleInputChange(row.customerID, 'accountNumber', e.target.value.replace(/\s+/g, ''))
                              }
                              placeholder="खाते क्रमांक"
                              className={`${cellInputBase} w-full min-w-[130px] font-mono font-bold text-slate-900`}
                            />
                          </td>

                          {/* Account Type */}
                          <td className="px-1 py-0.5 border-r border-slate-100">
                            <select
                              value={row.accountType}
                              onChange={(e) => handleInputChange(row.customerID, 'accountType', e.target.value)}
                              className={`${cellSelectBase} w-full font-semibold text-slate-700`}
                            >
                              <option value="Savings">बचत</option>
                              <option value="Current">चालू</option>
                              <option value="Salary">पगार</option>
                            </select>
                          </td>

                          {viewMode === 'ALL_COLUMNS' && (
                            <td className="px-1 py-0.5 border-r border-slate-100">
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
                                className={`${cellSelectBase} w-32 text-slate-700`}
                              >
                                <option value="">- शाखा -</option>
                                {branches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                                <option value="__ADD_NEW_BRANCH__">+ नवीन शाखा जोडा</option>
                              </select>
                            </td>
                          )}

                          {/* Quick Single-Customer Full Form Modal Trigger */}
                          <td className="px-1.5 py-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => setEditingRow({ ...row })}
                              title="बँक व कर्मचारी सविस्तर माहिती भरा / संपादित करा"
                              className="h-5 px-1.5 rounded border border-slate-200 hover:border-primary bg-slate-50 hover:bg-primary/10 text-slate-600 hover:text-primary text-[10px] font-bold inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              <SlidersHorizontal size={10} />
                              <span>फॉर्म</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* SLIM COMPACT PAGINATION FOOTER */}
            <div className="shrink-0 h-8 px-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">प्रति पान:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-6 border border-slate-300 rounded px-1 bg-white text-[11px] font-bold text-slate-800"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  ({filteredData.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, filteredData.length)} / एकूण {filteredData.length})
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="h-6 px-2 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 flex items-center gap-0.5 font-bold cursor-pointer"
                >
                  <ChevronLeft size={12} /> मागील
                </button>
                <span className="px-2 font-extrabold text-slate-800">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="h-6 px-2 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 flex items-center gap-0.5 font-bold cursor-pointer"
                >
                  पुढील <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SINGLE-CUSTOMER CLEAN QUICK-EDIT MODAL (बँक + कर्मचारी संपूर्ण फॉर्म) */}
      {editingRow && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-3">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden">
            <div className="bg-primary text-white px-4 py-2.5 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-black truncate">{editingRow.customerName}</h3>
                <p className="text-[11px] text-white/80 font-mono">
                  {editingRow.cifNo || `CIF${String(editingRow.customerID).padStart(6, '0')}`}
                  {editingRow.mobileNumber ? ` • मो. ${editingRow.mobileNumber}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              {/* Section 1: Bank Details */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="font-extrabold text-primary text-[11.5px] border-b border-slate-200 pb-1">
                  १. वैयक्तिक बँक खाते तपशील
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">बँकेचे नाव</label>
                    <select
                      value={editingRow.bankName || ''}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setActiveCustomerIdForBank(editingRow.customerID);
                          setShowAddBankModal(true);
                        } else {
                          setEditingRow({ ...editingRow, bankName: e.target.value });
                        }
                      }}
                      className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-semibold focus:border-primary focus:outline-none"
                    >
                      <option value="">-- बँक निवडा --</option>
                      {banks.map((b) => (
                        <option key={b.bankID + '-' + b.bankName} value={b.bankName}>
                          {b.bankName}
                        </option>
                      ))}
                      <option value="__ADD_NEW__">+ नवीन बँक जोडा</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">IFSC कोड (११ अक्षरी)</label>
                    <input
                      type="text"
                      maxLength={11}
                      value={editingRow.ifscCode || ''}
                      onChange={(e) =>
                        setEditingRow({ ...editingRow, ifscCode: e.target.value.toUpperCase().trim() })
                      }
                      placeholder="उदा. SBIN0001234"
                      className="h-8 w-full rounded border border-slate-300 bg-white px-2 uppercase font-mono font-bold focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">बँक खाते क्रमांक</label>
                    <input
                      type="text"
                      maxLength={20}
                      value={editingRow.accountNumber || ''}
                      onChange={(e) =>
                        setEditingRow({ ...editingRow, accountNumber: e.target.value.replace(/\s+/g, '') })
                      }
                      placeholder="खाते क्रमांक"
                      className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-mono font-bold focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">खात्याचा प्रकार</label>
                    <select
                      value={editingRow.accountType}
                      onChange={(e) => setEditingRow({ ...editingRow, accountType: e.target.value })}
                      className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-semibold focus:border-primary focus:outline-none"
                    >
                      <option value="Savings">बचत (Savings)</option>
                      <option value="Current">चालू (Current)</option>
                      <option value="Salary">पगार (Salary)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Employee / Company Details */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="font-extrabold text-slate-700 text-[11.5px] border-b border-slate-200 pb-1">
                  २. कर्मचारी व विभाग तपशील (पगारदार कर्मचाऱ्यांसाठी पर्यायी)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">कर्मचारी आयडी (Emp ID)</label>
                    <input
                      type="text"
                      maxLength={50}
                      value={editingRow.employeeID || ''}
                      onChange={(e) => setEditingRow({ ...editingRow, employeeID: e.target.value })}
                      placeholder="उदा. EMP001"
                      className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-semibold focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">विभाग (Department)</label>
                    <select
                      value={editingRow.departmentID ?? ''}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW_DEPT__') {
                          setActiveCustomerIdForDept(editingRow.customerID);
                          setShowAddDeptModal(true);
                        } else {
                          setEditingRow({
                            ...editingRow,
                            departmentID: e.target.value ? Number(e.target.value) : undefined,
                          });
                        }
                      }}
                      className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-semibold focus:border-primary focus:outline-none"
                    >
                      <option value="">-- विभाग निवडा --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                      <option value="__ADD_NEW_DEPT__">+ नवीन विभाग जोडा</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">कंपनी / कार्यालय शाखा</label>
                    <select
                      value={editingRow.branchID ?? ''}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW_BRANCH__') {
                          setActiveCustomerIdForBranch(editingRow.customerID);
                          setShowAddBranchModal(true);
                        } else {
                          setEditingRow({
                            ...editingRow,
                            branchID: e.target.value ? Number(e.target.value) : undefined,
                          });
                        }
                      }}
                      className="h-8 w-full rounded border border-slate-300 bg-white px-2 font-semibold focus:border-primary focus:outline-none"
                    >
                      <option value="">-- कंपनी शाखा निवडा --</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                      <option value="__ADD_NEW_BRANCH__">+ नवीन शाखा जोडा</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">रुजू तारीख</label>
                      <input
                        type="date"
                        value={editingRow.joiningDate ? editingRow.joiningDate.split('T')[0] : ''}
                        onChange={(e) =>
                          setEditingRow({
                            ...editingRow,
                            joiningDate: e.target.value ? e.target.value : undefined,
                          })
                        }
                        className="h-8 w-full rounded border border-slate-300 bg-white px-1.5 text-[11px] focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">पद स्थिती</label>
                      <select
                        value={editingRow.employeeStatus}
                        onChange={(e) => setEditingRow({ ...editingRow, employeeStatus: e.target.value })}
                        className="h-8 w-full rounded border border-slate-300 bg-white px-1.5 font-semibold focus:border-primary focus:outline-none"
                      >
                        <option value="Active">सक्रिय</option>
                        <option value="Retired">निवृत्त</option>
                        <option value="Resigned">राजीनामा</option>
                        <option value="Transferred">बदली</option>
                        <option value="Suspended">निलंबित</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="h-8 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleSaveSingleModalRow}
                disabled={savingSingleRow}
                className="h-8 px-4 rounded-md bg-primary hover:bg-primary/90 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save size={13} />
                <span>{savingSingleRow ? 'सेव्ह होत आहे...' : 'जतन करा'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Bank Modal */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4" />
                <h3 className="font-bold text-sm">नवीन बँक जोडा</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddBankModal(false);
                  setAddBankError('');
                  setNewBankName('');
                  setActiveCustomerIdForBank(null);
                }}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {addBankSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{addBankSuccess}</span>
                </div>
              )}

              {addBankError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{addBankError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  बँकेचे नाव <span className="text-rose-500">*</span>
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
                  placeholder="उदा. स्टेट बँक ऑफ इंडिया / KDCC बँक"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white"
                  autoFocus
                />
              </div>
            </div>

            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddBankModal(false);
                  setAddBankError('');
                  setAddBankSuccess('');
                  setNewBankName('');
                  setActiveCustomerIdForBank(null);
                }}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                {addBankSuccess ? 'बंद करा' : 'रद्द करा'}
              </button>
              <button
                type="button"
                onClick={handleAddBank}
                disabled={addingBank || !newBankName.trim()}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded font-bold text-xs disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{addingBank ? 'सेव्ह होत आहे...' : 'बँक सेव्ह करा'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Department Modal */}
      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <h3 className="font-bold text-sm">नवीन विभाग जोडा</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddDeptModal(false);
                  setAddDeptError('');
                  setAddDeptSuccess('');
                  setNewDeptName('');
                  setNewDeptCode('');
                  setActiveCustomerIdForDept(null);
                }}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {addDeptSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{addDeptSuccess}</span>
                </div>
              )}

              {addDeptError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{addDeptError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  विभागाचे नाव <span className="text-rose-500">*</span>
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
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">विभाग कोड (पर्यायी)</label>
                <input
                  type="text"
                  maxLength={20}
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  placeholder="उदा. DEPT01"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white uppercase"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddDeptModal(false);
                  setAddDeptError('');
                  setAddDeptSuccess('');
                  setNewDeptName('');
                  setNewDeptCode('');
                  setActiveCustomerIdForDept(null);
                }}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                {addDeptSuccess ? 'बंद करा' : 'रद्द करा'}
              </button>
              <button
                type="button"
                onClick={handleAddDept}
                disabled={addingDept || !newDeptName.trim()}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded font-bold text-xs disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{addingDept ? 'सेव्ह होत आहे...' : 'विभाग सेव्ह करा'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Company Branch Modal */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <h3 className="font-bold text-sm">नवीन कंपनी शाखा जोडा</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddBranchModal(false);
                  setAddBranchError('');
                  setAddBranchSuccess('');
                  setNewBranchName('');
                  setNewBranchCode('');
                  setActiveCustomerIdForBranch(null);
                }}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {addBranchSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{addBranchSuccess}</span>
                </div>
              )}

              {addBranchError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{addBranchError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  कंपनी शाखेचे नाव <span className="text-rose-500">*</span>
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
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">शाखा कोड (पर्यायी)</label>
                <input
                  type="text"
                  maxLength={20}
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  placeholder="उदा. BR01"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-primary bg-white uppercase"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddBranchModal(false);
                  setAddBranchError('');
                  setAddBranchSuccess('');
                  setNewBranchName('');
                  setNewBranchCode('');
                  setActiveCustomerIdForBranch(null);
                }}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                {addBranchSuccess ? 'बंद करा' : 'रद्द करा'}
              </button>
              <button
                type="button"
                onClick={handleAddBranch}
                disabled={addingBranch || !newBranchName.trim()}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded font-bold text-xs disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{addingBranch ? 'सेव्ह होत आहे...' : 'शाखा सेव्ह करा'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeBankDetails;
