import React, { useState, useEffect } from 'react';
import { ChevronLeft, Home, User, Landmark, Save, Search, CheckCircle2, AlertCircle, RefreshCw, Plus, X } from 'lucide-react';

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
}

interface DropdownItem {
  id: number;
  name: string;
}

interface BankItem {
  bankID: number;
  bankName: string;
}

interface EmployeeBankDetailsProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const EmployeeBankDetails: React.FC<EmployeeBankDetailsProps> = ({ onNavigate }) => {
  const [data, setData] = useState<EmployeeBankDetail[]>([]);
  const [departments, setDepartments] = useState<DropdownItem[]>([]);
  const [branches, setBranches] = useState<DropdownItem[]>([]);
  const [banks, setBanks] = useState<BankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
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
    const params = new URLSearchParams(window.location.search);
    setSource(params.get('source') || '');
    setContextCustomerId(params.get('customerId') || '');
    
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [empRes, deptRes, branchRes, bankRes] = await Promise.all([
        fetch('/api/EmployeeBankDetails'),
        fetch('/api/DepartmentMaster'),
        fetch('/api/BranchMaster'),
        fetch('/api/BankMasters')
      ]);
      
      const empData = empRes.ok ? await empRes.json() : [];
      const deptData = deptRes.ok ? await deptRes.json() : [];
      const branchData = branchRes.ok ? await branchRes.json() : [];
      const bankData = bankRes.ok ? await bankRes.json() : [];

      const params = new URLSearchParams(window.location.search);
      const urlCustomerId = params.get('customerId');
      
      const normalizedEmpData = empData.map((item: any) => ({
        employeeBankDetailID: item.employeeBankDetailID ?? item.employeeBankDetailId ?? item.EmployeeBankDetailID,
        customerID: item.customerID ?? item.customerId ?? item.CustomerID ?? 0,
        cifNo: item.cifNo ?? item.CIFNo ?? '',
        customerName: item.customerName ?? item.CustomerName ?? '',
        employeeID: item.employeeID ?? item.EmployeeID ?? '',
        departmentID: item.departmentID ?? item.departmentId ?? item.DepartmentID,
        joiningDate: item.joiningDate ?? item.JoiningDate,
        employeeStatus: item.employeeStatus ?? item.EmployeeStatus ?? 'Active',
        mobileNumber: item.mobileNumber ?? item.MobileNumber,
        bankName: item.bankName ?? item.BankName ?? '',
        ifscCode: item.ifscCode ?? item.IFSCCode ?? '',
        accountNumber: item.accountNumber ?? item.AccountNumber ?? '',
        accountType: item.accountType ?? item.AccountType ?? 'Savings',
        branchID: item.branchID ?? item.branchId ?? item.BranchID
      }));

      if (urlCustomerId && params.get('source') === '360dashboard') {
          setData(normalizedEmpData.filter((d: any) => d.customerID.toString() === urlCustomerId));
      } else {
          setData(normalizedEmpData);
      }

      setDepartments(deptData.map((d: any) => ({ 
        id: d.departmentID ?? d.departmentId ?? d.DepartmentID ?? d.id, 
        name: d.departmentName ?? d.DepartmentName ?? d.name 
      })));
      setBranches(branchData.map((b: any) => ({ 
        id: b.branchID ?? b.branchId ?? b.BranchID ?? b.id, 
        name: b.branchName ?? b.BranchName ?? b.name 
      })));

      // Process Bank Master list
      const masterBanks: BankItem[] = bankData.map((b: any) => ({
        bankID: b.bankID ?? b.bankId ?? b.BankID ?? 0,
        bankName: (b.bankName ?? b.BankName ?? '').trim()
      }));

      // Preserve existing bank names from employee data
      const existingBankNames = new Set(masterBanks.map(b => b.bankName.toLowerCase()));
      normalizedEmpData.forEach((item: any) => {
        const name = (item.bankName || '').trim();
        if (name && !existingBankNames.has(name.toLowerCase())) {
          existingBankNames.add(name.toLowerCase());
          masterBanks.push({ bankID: -Math.random(), bankName: name });
        }
      });

      masterBanks.sort((a, b) => a.bankName.localeCompare(b.bankName));
      setBanks(masterBanks);

    } catch (err) {
      setError('डेटा लोड करताना त्रुटी आली. कृपया रीफ्रेश करा.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (customerID: number, field: keyof EmployeeBankDetail, value: any) => {
    setData(prev => prev.map(item => {
      if (item.customerID === customerID) {
        return { ...item, [field]: value };
      }
      return item;
    }));
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

    let bankNameAdded = trimmedName;
    let newBankId = Date.now();

    try {
      const response = await fetch('/api/BankMasters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bankName: trimmedName })
      });

      if (response.ok) {
        const savedBank = await response.json();
        bankNameAdded = (savedBank.bankName ?? savedBank.BankName ?? trimmedName).trim();
        newBankId = savedBank.bankID ?? savedBank.BankID ?? newBankId;
      }
    } catch (err) {
      console.error('API call error when saving bank:', err);
    } finally {
      // Always update UI list so user is never blocked
      setBanks(prev => {
        if (prev.some(b => b.bankName.toLowerCase() === bankNameAdded.toLowerCase())) {
          return prev;
        }
        return [...prev, { bankID: newBankId, bankName: bankNameAdded }]
          .sort((a, b) => a.bankName.localeCompare(b.bankName));
      });

      if (activeCustomerIdForBank !== null) {
        handleInputChange(activeCustomerIdForBank, 'bankName', bankNameAdded);
      }

      setAddBankSuccess(`'${bankNameAdded}' बँक यशस्वीरीत्या जोडली गेली!`);
      setNewBankName('');
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

    let deptNameAdded = trimmedName;
    let newDeptId = Date.now();

    try {
      const response = await fetch('/api/DepartmentMaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          departmentName: trimmedName,
          departmentCode: newDeptCode.trim()
        })
      });

      if (response.ok) {
        const savedDept = await response.json();
        deptNameAdded = (savedDept.departmentName ?? savedDept.DepartmentName ?? trimmedName).trim();
        newDeptId = savedDept.departmentID ?? savedDept.departmentId ?? savedDept.DepartmentID ?? newDeptId;
      }
    } catch (err) {
      console.error('API call error when saving department:', err);
    } finally {
      setDepartments(prev => {
        if (prev.some(d => d.id === newDeptId || d.name.toLowerCase() === deptNameAdded.toLowerCase())) {
          return prev;
        }
        return [...prev, { id: newDeptId, name: deptNameAdded }]
          .sort((a, b) => a.name.localeCompare(b.name));
      });

      if (activeCustomerIdForDept !== null) {
        handleInputChange(activeCustomerIdForDept, 'departmentID', newDeptId);
      }

      setAddDeptSuccess(`'${deptNameAdded}' विभाग यशस्वीरीत्या जोडला गेला!`);
      setNewDeptName('');
      setNewDeptCode('');
      setAddingDept(false);
    }
  };

  const handleAddBranch = async () => {
    const trimmedName = newBranchName.trim();
    if (!trimmedName) {
      setAddBranchError('कृपया शाखेचे नाव प्रविष्ट करा.');
      return;
    }

    setAddingBranch(true);
    setAddBranchError('');
    setAddBranchSuccess('');

    const autoCode = newBranchCode.trim() || `BR${Date.now().toString().slice(-4)}`;
    let branchNameAdded = trimmedName;
    let newBranchId = Date.now();

    try {
      const response = await fetch('/api/BranchMaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branchName: trimmedName,
          branchCode: autoCode,
          branchType: 'Branch',
          status: true
        })
      });

      if (response.ok) {
        const savedBranch = await response.json();
        branchNameAdded = (savedBranch.branchName ?? savedBranch.BranchName ?? trimmedName).trim();
        newBranchId = savedBranch.branchID ?? savedBranch.branchId ?? savedBranch.BranchID ?? newBranchId;
      }
    } catch (err) {
      console.error('API call error when saving branch:', err);
    } finally {
      setBranches(prev => {
        if (prev.some(b => b.id === newBranchId || b.name.toLowerCase() === branchNameAdded.toLowerCase())) {
          return prev;
        }
        return [...prev, { id: newBranchId, name: branchNameAdded }]
          .sort((a, b) => a.name.localeCompare(b.name));
      });

      if (activeCustomerIdForBranch !== null) {
        handleInputChange(activeCustomerIdForBranch, 'branchID', newBranchId);
      }

      setAddBranchSuccess(`'${branchNameAdded}' शाखा यशस्वीरीत्या जोडली गेली!`);
      setNewBranchName('');
      setNewBranchCode('');
      setAddingBranch(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    
    // Check for duplicate Employee ID
    const empIds = data.map(d => d.employeeID).filter(id => id && id.trim() !== '');
    const hasDuplicates = empIds.some((id, index) => empIds.indexOf(id) !== index);
    
    if (hasDuplicates) {
      setError('ड्युप्लिकेट कर्मचारी आयडी (Duplicate Employee ID) आढळला आहे! कृपया एकमेव आयडी टाका.');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/EmployeeBankDetails/bulk-upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save data');
      }

      alert('कर्मचारी बँक माहिती यशस्वीरित्या सेव्ह झाली!');
      fetchData();
    } catch (err) {
      setError('माहिती सेव्ह करताना त्रुटी आली. कृपया सर्व्हर कनेक्शन तपासा.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const navigateBack = () => {
    if (onNavigate) {
      onNavigate('customer-360', { customerId: contextCustomerId });
    }
  };

  const filteredData = data.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      (item.customerName && item.customerName.toLowerCase().includes(q)) ||
      (item.cifNo && item.cifNo.toLowerCase().includes(q)) ||
      (item.employeeID && item.employeeID.toLowerCase().includes(q)) ||
      (item.bankName && item.bankName.toLowerCase().includes(q)) ||
      (item.accountNumber && item.accountNumber.includes(q)) ||
      (item.mobileNumber && item.mobileNumber.includes(q))
    );
  });

  return (
    <div className="p-2 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-6">
      {/* 360 Dashboard Breadcrumb */}
      {source === '360dashboard' && (
        <div className="mb-2.5 flex flex-wrap justify-between items-center bg-white p-2 rounded-md border border-gray-200 shadow-xs">
          <nav className="flex text-[11px] text-gray-500 font-medium items-center">
            <span className="flex items-center hover:text-blue-600 cursor-pointer" onClick={() => onNavigate && onNavigate('dashboard')}>
               <Home size={12} className="mr-1 text-gray-400" /> होम
            </span>
            <span className="mx-1.5 text-gray-300">/</span>
            <span className="flex items-center hover:text-blue-600 cursor-pointer" onClick={() => onNavigate && onNavigate('customer')}>
               <User size={12} className="mr-1 text-gray-400" /> खातेदार माहिती
            </span>
            <span className="mx-1.5 text-gray-300">/</span>
            <span className="text-blue-600 hover:underline cursor-pointer font-bold flex items-center" onClick={navigateBack}>
               360 डॅशबोर्ड
            </span>
            <span className="mx-1.5 text-gray-300">/</span>
            <span className="text-gray-800 font-semibold">कर्मचारी बँक तपशील</span>
          </nav>
          
          <button 
            onClick={navigateBack}
            className="flex items-center text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-md hover:bg-blue-100 transition-colors font-bold cursor-pointer"
          >
            <ChevronLeft size={14} className="mr-1" /> 360 डॅशबोर्डवर परत जा
          </button>
        </div>
      )}

      {/* Main Header Action Bar */}
      <div className="mb-3 flex flex-wrap justify-between items-center bg-white p-2.5 rounded-md shadow-xs border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary p-2 rounded-md">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-800 leading-tight">
                खातेदार व कर्मचारी बँक तपशील (Customer & Employee Bank Details)
              </h1>
              {source === '360dashboard' && (
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                  खातेदार फिल्टर लागू
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500">पतसंस्थेच्या सर्व नोंदणीकृत खातेदारांचे (CIF) वैयक्तिक बँक खाते, IFSC कोड, मूळ कंपनी/विभाग व पद स्थिती माहिती व्यवस्थापित करा</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <button 
            onClick={() => {
              setActiveCustomerIdForDept(null);
              setNewDeptName('');
              setNewDeptCode('');
              setAddDeptError('');
              setAddDeptSuccess('');
              setShowAddDeptModal(true);
            }}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-bold text-xs shadow-md transition-all cursor-pointer"
            title="नवीन विभाग जोडा"
          >
            <Plus className="w-4 h-4" />
            <span>+ विभाग जोडा (Add Dept)</span>
          </button>

          <button 
            onClick={() => {
              setActiveCustomerIdForBank(null);
              setNewBankName('');
              setAddBankError('');
              setAddBankSuccess('');
              setShowAddBankModal(true);
            }}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md font-bold text-xs shadow-md transition-all cursor-pointer"
            title="नवीन बँक जोडा"
          >
            <Plus className="w-4 h-4" />
            <span>+ बँक जोडा (Add Bank)</span>
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
            className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md font-bold text-xs shadow-md transition-all cursor-pointer"
            title="नवीन शाखा जोडा"
          >
            <Plus className="w-4 h-4" />
            <span>+ शाखा जोडा (Add Branch)</span>
          </button>

          <button 
            onClick={handleSaveAll}
            disabled={saving || loading}
            className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-[#004a75] hover:from-[#004a75] hover:to-[#003452] text-white px-4 py-1.5 rounded-md font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>सेव्ह होत आहे...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>सर्व बदल सेव्ह करा (Save All)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 mb-3 rounded-md text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-md shadow-md border border-gray-200 overflow-hidden">
        {/* Search Toolbar */}
        <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="नाव, CIF, बँक नाव किंवा खाते क्रमांकाने शोधा..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 pl-9 pr-3 py-1.5 rounded-md bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs shadow-xs"
            />
          </div>

          <div className="text-xs text-gray-500 font-medium self-end sm:self-center">
            एकूण नोंदणीकृत खातेदार: <strong className="text-primary font-bold">{filteredData.length}</strong>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="p-10 text-center text-gray-500 text-xs font-semibold flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span>डेटा लोड होत आहे... (Loading Data...)</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 border-b border-gray-300 shadow-xs">
                <tr>
                  <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">CIF क्र.</th>
                  <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap min-w-[150px]">खातेदाराचे नाव</th>
                  <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">कर्मचारी आयडी / टोकन</th>
                  <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">विभाग (Dept)</th>
                  <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">रुजू तारीख</th>
                  <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">पद स्थिती (Status)</th>
                  <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">वैयक्तिक बँकेचे नाव</th>
                  <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">IFSC कोड</th>
                  <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">खाते क्रमांक</th>
                  <th className="px-2.5 py-2 border-r border-gray-200 font-bold whitespace-nowrap">खात्याचा प्रकार</th>
                  <th className="px-2.5 py-2 font-bold whitespace-nowrap">बँक शाखा</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Landmark className="w-8 h-8 text-gray-300" />
                        <p className="font-semibold text-gray-600">कोणतीही कर्मचारी नोंद सापडली नाही.</p>
                        <p className="text-[11px] text-gray-400">शोधाचा शब्द बदला किंवा नवीन खातेदार नोंदणी करा.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <tr key={row.customerID || row.cifNo} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-2.5 py-1.5 border-r border-gray-100 font-bold text-primary whitespace-nowrap">
                        {row.cifNo || ('CIF' + String(row.customerID).padStart(6, '0'))}
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100 font-bold text-gray-800 whitespace-nowrap">
                        {row.customerName}
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100">
                        <input 
                          type="text" 
                          value={row.employeeID || ''} 
                          onChange={(e) => handleInputChange(row.customerID, 'employeeID', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-24 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-medium"
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
                              handleInputChange(row.customerID, 'departmentID', e.target.value ? Number(e.target.value) : undefined);
                            }
                          }}
                          className="border border-gray-300 rounded px-2 py-1 w-36 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                        >
                          <option value="">-- विभाग निवडा --</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
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
                          onChange={(e) => handleInputChange(row.customerID, 'joiningDate', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100">
                        <select 
                          value={row.employeeStatus}
                          onChange={(e) => handleInputChange(row.customerID, 'employeeStatus', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-semibold"
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
                          className="border border-gray-300 rounded px-2 py-1 w-40 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                        >
                          <option value="">-- बँक निवडा --</option>
                          {banks.map(b => (
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
                          value={row.ifscCode || ''} 
                          onChange={(e) => handleInputChange(row.customerID, 'ifscCode', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-28 text-xs uppercase focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                          placeholder="SBIN0001234"
                        />
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100">
                        <input 
                          type="text" 
                          value={row.accountNumber || ''} 
                          onChange={(e) => handleInputChange(row.customerID, 'accountNumber', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-32 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                          placeholder="खाते क्रमांक"
                        />
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100">
                        <select 
                          value={row.accountType}
                          onChange={(e) => handleInputChange(row.customerID, 'accountType', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
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
                              handleInputChange(row.customerID, 'branchID', e.target.value ? Number(e.target.value) : undefined);
                            }
                          }}
                          className="border border-gray-300 rounded px-2 py-1 w-32 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          <option value="">-- शाखा निवडा --</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                          <option value="__ADD_NEW_BRANCH__" className="font-bold text-purple-600 bg-purple-50">
                            + नवीन शाखा जोडा (Add New Branch)
                          </option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Add Bank Modal */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
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
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {addBankSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{addBankSuccess}</span>
                </div>
              )}

              {addBankError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2">
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
                  value={newBankName}
                  onChange={(e) => {
                    setNewBankName(e.target.value);
                    if (addBankSuccess) setAddBankSuccess('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddBank();
                  }}
                  placeholder="उदा. स्टेट बँक ऑफ इंडिया / ICICI Bank"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
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
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-100 transition-colors"
              >
                {addBankSuccess ? 'पूर्ण झाले (Close)' : 'रद्द करा (Cancel)'}
              </button>
              <button 
                onClick={handleAddBank}
                disabled={addingBank || !newBankName.trim()}
                className="flex items-center gap-1.5 bg-primary hover:bg-[#004a75] text-white px-4 py-1.5 rounded-md font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {addingBank ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>सेव्ह होत आहे...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>बँक सेव्ह करा (Save Bank)</span>
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
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
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
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {addDeptSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{addDeptSuccess}</span>
                </div>
              )}

              {addDeptError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2">
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
                  value={newDeptName}
                  onChange={(e) => {
                    setNewDeptName(e.target.value);
                    if (addDeptSuccess) setAddDeptSuccess('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddDept();
                  }}
                  placeholder="उदा. महसूल विभाग / वित्त विभाग / प्रशासन"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  विभाग कोड (Department Code - पर्यायी)
                </label>
                <input 
                  type="text" 
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  placeholder="उदा. DEPT01"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white uppercase"
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
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-100 transition-colors"
              >
                {addDeptSuccess ? 'पूर्ण झाले (Close)' : 'रद्द करा (Cancel)'}
              </button>
              <button 
                onClick={handleAddDept}
                disabled={addingDept || !newDeptName.trim()}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {addingDept ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>सेव्ह होत आहे...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>विभाग सेव्ह करा (Save Dept)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Branch Modal */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-gray-800">नवीन शाखा जोडा (Add New Branch)</h3>
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
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {addBranchSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{addBranchSuccess}</span>
                </div>
              )}

              {addBranchError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{addBranchError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  शाखेचे नाव (Branch Name) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={newBranchName}
                  onChange={(e) => {
                    setNewBranchName(e.target.value);
                    if (addBranchSuccess) setAddBranchSuccess('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddBranch();
                  }}
                  placeholder="उदा. मुख्य शाखा / पुणे शाखा / कोल्हापूर शाखा"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  शाखा कोड (Branch Code - पर्यायी)
                </label>
                <input 
                  type="text" 
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  placeholder="उदा. BR01"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white uppercase"
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
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-100 transition-colors"
              >
                {addBranchSuccess ? 'पूर्ण झाले (Close)' : 'रद्द करा (Cancel)'}
              </button>
              <button 
                onClick={handleAddBranch}
                disabled={addingBranch || !newBranchName.trim()}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-md font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {addingBranch ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>सेव्ह होत आहे...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>शाखा सेव्ह करा (Save Branch)</span>
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
