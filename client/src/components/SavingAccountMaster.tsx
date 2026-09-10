import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import CustomerSearchSelect, { CustomerOption } from './common/CustomerSearchSelect';
import { useAuth } from '../context/AuthContext';

interface Member extends Partial<CustomerOption> {
  memberID?: number;
  customerID?: number;
  cifNo?: string;
  memberCode?: string;
  oldMemberCode?: string;
  legacyMemberNo?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  mobileNo?: string;
  aadhaarNo?: string;
  status?: string;
  [key: string]: any;
}

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  groupID: number;
  accountType?: string;
  reportType?: string;
}

const formatDateDisplay = (dateVal: any) => {
  if (!dateVal) return '-';
  try {
    const dt = new Date(dateVal);
    if (isNaN(dt.getTime())) return String(dateVal);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(dateVal);
  }
};

interface JointHolder {
  customerID: number;
  customerName?: string;
  memberID?: number;
  memberName?: string;
  memberCode?: string;
}

interface SavingAccount {
  savingAccountID: number;
  accountNo: string;
  customerID: number;
  customerName?: string;
  cifNo?: string;
  memberID?: number;
  memberName?: string;
  accountType: string;
  openingDate: string;
  openingBalance: number;
  currentBalance: number;
  interestRate: number;
  minimumBalance: number;
  lienAmount?: number;
  lienReason?: string;
  status: string;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineeAddress?: string;
  jointHolders?: JointHolder[];
}

const SavingAccountMaster: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SavingAccount[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [interestSettings, setInterestSettings] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editAccountId, setEditAccountId] = useState<number | null>(null);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showDuplicateConfirmModal, setShowDuplicateConfirmModal] = useState(false);
  const [confirmedCustomerID, setConfirmedCustomerID] = useState<number | null>(null);

  // Quick Scheme Creation Modal State
  const [showQuickSchemeModal, setShowQuickSchemeModal] = useState(false);
  const [allGlLedgers, setAllGlLedgers] = useState<Ledger[]>([]);
  const [quickSchemeForm, setQuickSchemeForm] = useState({
    schemeCode: '',
    schemeName: '',
    interestRate: 4.0,
    calculationMethod: 'DailyProduct',
    postingFrequency: 'Quarterly',
    effectiveDate: new Date().toISOString().split('T')[0],
    savingLiabilityLedgerID: 7,
    interestExpenseLedgerID: 0
  });
  const [savingSchemeLoading, setSavingSchemeLoading] = useState(false);
  const [schemeModalError, setSchemeModalError] = useState('');

  const API_URL = '/api';

  const getTodayDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    branchID: user?.branchID || 1,
    customerID: 0,
    ledgerID: 7, // Default to Saving Deposit control ledger
    accountType: 'Personal',
    isLegacyAccount: false,
    accountNo: '',
    openingDate: getTodayDate(),
    openingBalance: 0,
    interestRate: 4.0,
    minimumBalance: 500,
    lienAmount: 0,
    lienReason: '',
    status: 'Active',
    nomineeName: '',
    nomineeRelation: '',
    nomineeAddress: '',
  });

  // Joint holders state
  const [jointHolderCustomerIDs, setJointHolderCustomerIDs] = useState<number[]>([]);
  const [selectedJointCustomerID, setSelectedJointCustomerID] = useState<number>(0);

  useEffect(() => {
    fetchAccounts();
    fetchMembers();
    fetchLedgers();
    fetchBranches();
    fetchNextAccountNo();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerIdStr = params.get('customerId') || params.get('memberId');
    if (customerIdStr && members.length > 0) {
      const cId = parseInt(customerIdStr, 10);
      const matchedMember = members.find(m => (m.customerID || m.customerId || m.memberID) === cId);
      if (matchedMember) {
        setFormData(prev => ({
          ...prev,
          customerID: cId
        }));
      }
    }
  }, [members]);

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API_URL}/Branches`);
      setBranches(response.data);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchNextAccountNo = async (bId?: number) => {
    try {
      const selectedBranchId = bId || formData.branchID || 1;
      const response = await axios.get(`${API_URL}/SavingAccounts/next-account-no?branchId=${selectedBranchId}`);
      if (response.data) {
        const nextNo = typeof response.data === 'string'
          ? response.data
          : (response.data.accountNo || response.data.nextAccountNo || '');
        if (nextNo) {
          setFormData(prev => ({
            ...prev,
            accountNo: nextNo
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching next account no', err);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API_URL}/SavingAccounts`);
      setAccounts(response.data);
    } catch (err) {
      console.error('Error fetching accounts', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API_URL}/Customers`);
      setMembers(response.data);
    } catch (err) {
      console.error('Error fetching customers', err);
    }
  };

  const fetchLedgers = async (autoSelectLedgerId?: number, autoSelectRate?: number) => {
    try {
      const [ledgersRes, interestRes] = await Promise.all([
        axios.get(`${API_URL}/Ledgers`),
        axios.get(`${API_URL}/SavingSettings/Interest`).catch(() => ({ data: [] }))
      ]);

      const allLedgersList: Ledger[] = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];
      setAllGlLedgers(allLedgersList);

      const iSettings: any[] = Array.isArray(interestRes.data) ? interestRes.data : [];
      setInterestSettings(iSettings);

      const uniqueLedgerMap = new Map<number, Ledger>();

      // Extract ledgers configured in Saving Interest Settings (Saving Schemes) ONLY
      iSettings.forEach((s: any) => {
        const targetId = s.savingLiabilityLedgerID || s.ledgerID || s.interestExpenseLedgerID;
        if (targetId && targetId > 0) {
          const ledgerObj = s.savingLiabilityLedger || s.ledger || s.interestExpenseLedger || allLedgersList.find((l: Ledger) => l.ledgerID === targetId);
          if (ledgerObj) {
            const displayName = s.schemeName
              ? `${s.schemeName}${s.interestRate !== undefined ? ` (${s.interestRate}%)` : ''}`
              : `${ledgerObj.ledgerName}${s.interestRate !== undefined ? ` (${s.interestRate}%)` : ''}`;
            uniqueLedgerMap.set(targetId, { ...ledgerObj, ledgerName: displayName });
          }
        }
      });

      const finalLedgers = Array.from(uniqueLedgerMap.values());
      setLedgers(finalLedgers);

      if (autoSelectLedgerId) {
        setFormData(prev => ({
          ...prev,
          ledgerID: autoSelectLedgerId,
          interestRate: autoSelectRate !== undefined ? autoSelectRate : prev.interestRate
        }));
      } else if (finalLedgers.length > 0) {
        const firstLedgerId = finalLedgers[0].ledgerID;
        const matchedScheme = iSettings.find((s: any) =>
          s.savingLiabilityLedgerID === firstLedgerId ||
          s.interestExpenseLedgerID === firstLedgerId ||
          s.ledgerID === firstLedgerId
        );
        setFormData(prev => ({
          ...prev,
          ledgerID: prev.ledgerID && uniqueLedgerMap.has(prev.ledgerID) ? prev.ledgerID : firstLedgerId,
          interestRate: matchedScheme && matchedScheme.interestRate ? matchedScheme.interestRate : prev.interestRate
        }));
      } else {
        // Zero schemes available
        setFormData(prev => ({
          ...prev,
          ledgerID: 0
        }));
      }
    } catch (err) {
      console.error('Error fetching ledgers', err);
    }
  };

  const handleOpenQuickSchemeModal = () => {
    setSchemeModalError('');
    const defLiab = allGlLedgers.find(l => l.ledgerName.includes('बचत ठेव') || (l.accountType && l.accountType.toLowerCase().includes('saving')));
    const defExp = allGlLedgers.find(l => l.ledgerName.includes('बचत व्याज') || l.ledgerName.toLowerCase().includes('interest on saving'));

    let nextCode = 'SAV-001';
    try {
      const codes = interestSettings.map((s: any) => s.schemeCode).filter(Boolean);
      const count = codes.length + 1;
      nextCode = `SAV-${count.toString().padStart(3, '0')}`;
    } catch {
      // fallback
    }

    setQuickSchemeForm({
      schemeCode: nextCode,
      schemeName: 'सर्वसाधारण बचत ठेव 4%',
      interestRate: 4.0,
      calculationMethod: 'DailyProduct',
      postingFrequency: 'Quarterly',
      effectiveDate: new Date().toISOString().split('T')[0],
      savingLiabilityLedgerID: defLiab ? defLiab.ledgerID : (allGlLedgers[0]?.ledgerID || 7),
      interestExpenseLedgerID: defExp ? defExp.ledgerID : 0
    });
    setShowQuickSchemeModal(true);
  };

  const handleSaveQuickScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSchemeForm.schemeName.trim()) {
      setSchemeModalError('कृपया योजनेचे नाव प्रविष्ट करा.');
      return;
    }
    if (!quickSchemeForm.savingLiabilityLedgerID) {
      setSchemeModalError('कृपया बचत ठेव नियंत्रण लेजर निवडा.');
      return;
    }

    setSavingSchemeLoading(true);
    setSchemeModalError('');
    try {
      const payload = {
        schemeCode: quickSchemeForm.schemeCode,
        schemeName: quickSchemeForm.schemeName.trim(),
        interestRate: parseFloat(String(quickSchemeForm.interestRate)) || 0,
        calculationMethod: quickSchemeForm.calculationMethod,
        postingFrequency: quickSchemeForm.postingFrequency,
        effectiveDate: quickSchemeForm.effectiveDate,
        savingLiabilityLedgerID: quickSchemeForm.savingLiabilityLedgerID,
        ledgerID: quickSchemeForm.savingLiabilityLedgerID,
        interestExpenseLedgerID: quickSchemeForm.interestExpenseLedgerID > 0 ? quickSchemeForm.interestExpenseLedgerID : null
      };

      const res = await axios.post(`${API_URL}/SavingSettings/Interest`, payload);
      const createdScheme = res.data;

      // Refresh ledgers and interestSettings and auto-select
      const chosenLedgerId = createdScheme.savingLiabilityLedgerID || createdScheme.ledgerID || quickSchemeForm.savingLiabilityLedgerID;
      await fetchLedgers(chosenLedgerId, createdScheme.interestRate);

      setShowQuickSchemeModal(false);
      setSuccess(`नवीन बचत ठेव योजना '${createdScheme.schemeName}' यशस्वीरीत्या तयार केली व निवडली!`);
    } catch (err: any) {
      console.error('Error saving quick saving scheme', err);
      setSchemeModalError(err.response?.data?.message || err.response?.data || 'बचत योजना सेव्ह करताना त्रुटी आली.');
    } finally {
      setSavingSchemeLoading(false);
    }
  };

  const handleInputChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    if (name === 'branchID') {
      const newBranchId = parseInt(value, 10) || 1;
      fetchNextAccountNo(newBranchId);
    }
    
    // Auto-update interest rate from scheme when changing deposit ledger
    if (name === 'ledgerID') {
      if (value === '__CREATE_NEW_SCHEME__') {
        handleOpenQuickSchemeModal();
        return;
      }
      const selectedLedgerId = parseInt(value, 10) || 0;
      const matchedScheme = interestSettings.find((s: any) =>
        s.savingLiabilityLedgerID === selectedLedgerId ||
        s.interestExpenseLedgerID === selectedLedgerId ||
        s.ledgerID === selectedLedgerId
      );

      setFormData((prev) => ({
        ...prev,
        ledgerID: selectedLedgerId,
        interestRate: matchedScheme && matchedScheme.interestRate ? matchedScheme.interestRate : prev.interestRate
      }));
      return;
    }

    setFormData((prev) => {
      let val: any = value;
      if (type === 'checkbox') {
        val = checked;
      } else if (name === 'customerID' || name === 'ledgerID' || name === 'branchID') {
        val = parseInt(value, 10) || 0;
      } else if (name === 'openingBalance' || name === 'minimumBalance' || name === 'lienAmount' || name === 'interestRate') {
        val = value === '' ? '' : value;
      }
      return {
        ...prev,
        [name]: val,
      };
    });
  };

  const addJointHolder = () => {
    if (!selectedJointCustomerID || selectedJointCustomerID === 0) return;
    // Don't add primary customer as joint holder
    if (selectedJointCustomerID === formData.customerID) {
      setError('मुख्य खातेदार सह-खातेदार म्हणून जोडता येत नाही.');
      return;
    }
    // Don't add duplicate
    if (jointHolderCustomerIDs.includes(selectedJointCustomerID)) {
      setError('हा ग्राहक आधीच जोडलेला आहे.');
      return;
    }
    setJointHolderCustomerIDs(prev => [...prev, selectedJointCustomerID]);
    setSelectedJointCustomerID(0);
    setError('');
  };

  const removeJointHolder = (customerId: number) => {
    setJointHolderCustomerIDs(prev => prev.filter(id => id !== customerId));
  };

  // Helper function to build formatted customer label with CIF & Old No
  const formatCustomerLabel = (m: Member) => {
    const fullName = `${m.firstName || ''} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName || ''}`.trim();
    const cifStr = m.cifNo ? `CIF: ${m.cifNo}` : '';
    const oldNo = m.oldMemberCode || m.legacyMemberNo;
    const oldNoStr = oldNo ? `जुना CIF: ${oldNo}` : '';
    const mobStr = m.mobileNo ? `मो.: ${m.mobileNo}` : '';

    const details = [cifStr, oldNoStr, mobStr].filter(Boolean).join(' | ');
    return details ? `${fullName} (${details})` : fullName;
  };

  const getCustomerLabel = (customerId: number) => {
    const m = members.find(m => (m.customerID || m.customerId || m.memberID) === customerId);
    return m ? formatCustomerLabel(m) : '';
  };

  const resetForm = () => {
    setFormData({
      branchID: user?.branchID || 1,
      customerID: 0,
      ledgerID: 7,
      accountType: 'Personal',
      isLegacyAccount: false,
      accountNo: '',
      openingDate: getTodayDate(),
      openingBalance: 0,
      interestRate: 4.0,
      minimumBalance: 500,
      lienAmount: 0,
      lienReason: '',
      status: 'Active',
      nomineeName: '',
      nomineeRelation: '',
      nomineeAddress: '',
    });
    setJointHolderCustomerIDs([]);
    setSelectedJointCustomerID(0);
    setIsEditMode(false);
    setEditAccountId(null);
    fetchNextAccountNo();
  };

  const handleEdit = (acc: any) => {
    setIsEditMode(true);
    setEditAccountId(acc.savingAccountID);
    const dateStr = acc.openingDate 
      ? (acc.openingDate.includes('T') ? acc.openingDate.split('T')[0] : acc.openingDate) 
      : new Date().toISOString().split('T')[0];

    setFormData({
      branchID: acc.branchID || 1,
      customerID: acc.customerID || acc.memberID || 0,
      ledgerID: acc.ledgerID || 7,
      accountType: acc.accountType || 'Personal',
      isLegacyAccount: acc.isLegacyAccount || false,
      accountNo: acc.accountNo || '',
      openingDate: dateStr,
      openingBalance: acc.openingBalance ?? 0,
      interestRate: acc.interestRate ?? 0,
      minimumBalance: acc.minimumBalance ?? 0,
      lienAmount: acc.lienAmount ?? 0,
      lienReason: acc.lienReason || '',
      status: acc.status || 'Active',
      nomineeName: acc.nomineeName || '',
      nomineeRelation: acc.nomineeRelation || '',
      nomineeAddress: acc.nomineeAddress || '',
    });
    // Set joint holders if any
    if (acc.jointHolders && Array.isArray(acc.jointHolders)) {
      setJointHolderCustomerIDs(acc.jointHolders.map((jh: any) => jh.customerID || jh.memberID));
    } else {
      setJointHolderCustomerIDs([]);
    }
    
    setError('');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('तुम्हाला खात्री आहे का की हे खाते डिलीट करायचे आहे? (Are you sure you want to delete this account?)')) {
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await axios.delete(`${API_URL}/SavingAccounts/${id}`);
      const successMsg = response.data?.message || 'खाते यशस्वीरित्या डिलीट केले!';
      setSuccess(successMsg);
      await fetchAccounts();
      if (isEditMode && editAccountId === id) {
        resetForm();
      } else {
        await fetchNextAccountNo(formData.branchID);
      }
      alert(`✅ ${successMsg}`);
    } catch (err: any) {
      console.error('Delete error', err);
      let errMsg = 'खाते डिलीट करताना त्रुटी आली. (Error deleting account)';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errMsg = err.response.data;
        } else if (err.response.data.message) {
          errMsg = err.response.data.message;
        } else if (err.response.data.title) {
          errMsg = err.response.data.title;
        }
      }
      setError(errMsg);
      alert(`❌ खाते डिलीट करता आले नाही!\n\nकारण: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const executeSave = async () => {
    setLoading(true);
    setError('');
    
    try {
      const selectedObj = members.find(m => (m.customerID === Number(formData.customerID) || m.customerId === Number(formData.customerID) || m.memberID === Number(formData.customerID)));
      const resolvedCustId = selectedObj?.customerID || selectedObj?.customerId || Number(formData.customerID);

      const payload = {
        savingAccountID: isEditMode ? editAccountId : 0,
        ...formData,
        customerID: resolvedCustId,
        openingBalance: (formData.openingBalance as any) === '' ? 0 : parseFloat(formData.openingBalance as any) || 0,
        minimumBalance: (formData.minimumBalance as any) === '' ? 0 : parseFloat(formData.minimumBalance as any) || 0,
        lienAmount: (formData.lienAmount as any) === '' ? 0 : parseFloat(formData.lienAmount as any) || 0,
        interestRate: (formData.interestRate as any) === '' ? 0 : parseFloat(formData.interestRate as any) || 0,
        accountNo: formData.accountNo || 'AUTO',
        jointHolderCustomerIDs: formData.accountType === 'Joint' ? jointHolderCustomerIDs : [],
      };
      
      if (isEditMode) {
        await axios.put(`${API_URL}/SavingAccounts/${editAccountId}`, payload);
        alert('बचत खाते यशस्वीरित्या अपडेट केले!');
      } else {
        await axios.post(`${API_URL}/SavingAccounts`, payload);
        alert('बचत खाते यशस्वीरित्या उघडले गेले आहे!');
      }
      
      fetchAccounts();
      resetForm();
    } catch (err: any) {
      console.error('Save error:', err);
      const errMsg = err.response?.data?.title || err.response?.data || 'खाते जतन करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.';
      setError(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerID) {
      setError('कृपया खातेदार निवडा (Please select a customer)');
      return;
    }

    if (formData.accountType === 'Joint' && jointHolderCustomerIDs.length === 0) {
      setError('संयुक्त खात्यासाठी किमान एक सह-खातेदार जोडा.');
      return;
    }
    
    if (!isEditMode) {
      const selectedObj = members.find(m => (m.customerID === Number(formData.customerID) || m.customerId === Number(formData.customerID) || m.memberID === Number(formData.customerID)));
      const targetCustId = selectedObj?.customerID || selectedObj?.customerId || Number(formData.customerID);
      const existingCustAccounts = accounts.filter(a => targetCustId && a.customerID === targetCustId);
      if (existingCustAccounts.length > 0 && confirmedCustomerID !== Number(formData.customerID)) {
        setShowDuplicateConfirmModal(true);
        return;
      }
    }

    await executeSave();
  };

  // Convert members list to CustomerSearchSelect options format
  const customerOptions = members.map((m) => ({
    value: m.customerID || m.customerId || m.memberID || 0,
    label: formatCustomerLabel(m)
  }));

  // Joint holder customer options - exclude primary customer and already added customers
  const jointCustomerOptions = members
    .filter(m => (m.customerID || m.customerId || m.memberID) !== formData.customerID && !jointHolderCustomerIDs.includes(m.customerID || m.customerId || m.memberID || 0))
    .map((m) => ({
      value: m.customerID || m.customerId || m.memberID || 0,
      label: formatCustomerLabel(m)
    }));

  // Filter accounts by search query safely
  const filteredAccounts = (accounts || []).filter((acc) => {
    if (!acc) return false;
    const query = (searchQuery || '').toLowerCase();
    const accNoStr = (acc.accountNo || '').toLowerCase();
    const nameStr = (acc.customerName || acc.memberName || '').toLowerCase();
    const cifStr = (acc.cifNo || '').toLowerCase();
    return accNoStr.includes(query) || nameStr.includes(query) || cifStr.includes(query);
  });

  // Nominee relation options
  const relationOptions = ['स्वतः', 'पती', 'पत्नी', 'मुलगा', 'मुलगी', 'भाऊ', 'बहीण', 'आई', 'वडील', 'इतर'];

  const selectedMember = members.find(m => (m.customerID === Number(formData.customerID) || m.customerId === Number(formData.customerID) || m.memberID === Number(formData.customerID)));
  const targetCustId = selectedMember?.customerID || selectedMember?.customerId || Number(formData.customerID);
  const existingMemberAccounts = accounts.filter(a => 
    targetCustId && a.customerID === targetCustId && 
    a.savingAccountID !== editAccountId
  );

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Standard ERP Header Banner */}
      <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div className="flex items-center gap-2">
          <span className="text-base">👤</span>
          <div>
            <h1 className="text-sm font-bold tracking-wide">बचत खाते मास्टर (Saving Account Master)</h1>
            <p className="text-[10px] text-blue-100 font-normal">नवीन बचत खाते उघडणे, संयुक्त खातेदार (Joint Holders), नॉमिनी व ऑटो-अकाउंट नं जनरेशन</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAccountsModal(true)}
            className="px-2.5 py-0.5 bg-blue-800/60 hover:bg-blue-800 text-white font-semibold rounded-sm border border-blue-400/40 flex items-center gap-1 text-xs cursor-pointer"
          >
            <span>📂 उघडलेली खाती ({accounts.length})</span>
          </button>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-white p-1.5 rounded-sm shadow-sm border border-gray-200 mb-3">
        <div className="flex justify-between items-center mb-1 border-b pb-0.5">
          <h2 className="text-sm font-bold text-primary">
            {isEditMode ? 'खाते माहिती अपडेट करा (Update Account)' : 'नवीन खाते उघडा (Open New Account)'}
          </h2>
          <div className="flex items-center gap-4">
            {isEditMode && (
              <button 
                type="button" 
                onClick={resetForm}
                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-0.5 rounded text-gray-700"
              >
                रद्द करा (Cancel)
              </button>
            )}
          </div>
        </div>
        
        {error && (
          <div className="mb-2 bg-red-50 text-red-600 px-2 py-1 rounded-sm text-xs border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Main Account Fields Form Grid (Balanced 12-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-x-3 gap-y-2 items-end bg-slate-50/60 p-2.5 rounded-sm border border-slate-200">
            
            {/* Branch Dropdown - 3 cols */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-0.5">शाखा (Branch) *</label>
              {user?.role === 'Admin' ? (
                <select
                  name="branchID"
                  value={formData.branchID}
                  onChange={handleInputChange}
                  disabled={isEditMode}
                  className="w-full border border-gray-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs bg-white disabled:bg-gray-100 disabled:text-gray-500 font-bold h-7"
                  required
                >
                  {branches.map(b => (
                    <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                  ))}
                </select>
              ) : (
                <div className="w-full border border-gray-300 px-2.5 py-1 rounded-sm text-xs bg-gray-100 font-bold text-gray-800 flex items-center gap-1 h-7">
                  <span>🔒</span>
                  <span>{branches.find(b => b.branchID === formData.branchID)?.branchName || user?.branchName || 'Bambavade Branch'}</span>
                </div>
              )}
            </div>

            {/* Searchable Customer Dropdown - 6 cols */}
            <div className="lg:col-span-6">
              <label className="block text-xs font-semibold text-gray-700 mb-0.5">खातेदार निवडा (Select Customer / CIF) *</label>
              <div className={isEditMode ? 'opacity-70 pointer-events-none' : ''}>
                <CustomerSearchSelect
                  customers={members}
                  value={formData.customerID ? Number(formData.customerID) : ''}
                  onChange={(val) => handleInputChange({ target: { name: 'customerID', value: val ? String(val) : '' } })}
                  placeholder="-- खातेदार (CIF / नाव / मोबाईलने शोधा) --"
                />
              </div>

              {/* Live Duplicate Warning Notification Badge */}
              {existingMemberAccounts.length > 0 && !isEditMode && (
                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded-sm text-[11px] text-amber-900 font-semibold flex items-start gap-1.5 shadow-2xs">
                  <span className="text-amber-600 font-bold shrink-0">⚠️</span>
                  <div>
                    <span>सूचना: या खातेदाराचे <b>{existingMemberAccounts.length} बचत खाते</b> आधीच सुरू आहे ({existingMemberAccounts.map(a => a.accountNo).join(', ')}).</span>
                  </div>
                </div>
              )}
            </div>

            {/* Saving Account No - 3 cols */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-blue-900 mb-0.5">
                बचत खाते क्र. (Saving A/c No) *
              </label>
              <input
                type="text"
                name="accountNo"
                value={formData.accountNo}
                readOnly={true}
                placeholder="उदा. 010100001"
                className="w-full border border-blue-400 px-2.5 py-1 rounded-sm text-xs bg-blue-50/80 font-bold text-blue-900 shadow-xs cursor-not-allowed h-7"
              />
            </div>

            {/* Ledger Dropdown - 4 cols */}
            <div className="lg:col-span-4">
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-xs font-semibold text-gray-700">
                  बचत ठेव प्रकार (Saving Deposit Ledger) *
                </label>
                <button
                  type="button"
                  onClick={handleOpenQuickSchemeModal}
                  className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="नवीन बचत योजना तयार करा"
                >
                  <span>+</span> नवीन योजना
                </button>
              </div>
              <select
                name="ledgerID"
                value={formData.ledgerID || ''}
                onChange={handleInputChange}
                disabled={isEditMode}
                className={`w-full border px-2.5 py-1 rounded-sm focus:outline-none focus:ring-1 transition-colors text-xs disabled:bg-gray-100 disabled:text-gray-500 h-7 ${
                  ledgers.length === 0
                    ? 'border-amber-400 bg-amber-50/50 text-amber-900 focus:border-amber-500 focus:ring-amber-500 font-semibold'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
                required
              >
                {ledgers.length === 0 ? (
                  <>
                    <option value="">-- कोणतीही बचत योजना उपलब्ध नाही --</option>
                    <option value="__CREATE_NEW_SCHEME__" className="font-bold text-emerald-700 bg-emerald-50">
                      ➕ नवीन बचत ठेव योजना तयार करा (Create Scheme)
                    </option>
                  </>
                ) : (
                  <>
                    <option value="">-- प्रकार निवडा --</option>
                    {ledgers.map(l => {
                      const matchedScheme = interestSettings.find(s => 
                        s.savingLiabilityLedgerID === l.ledgerID || 
                        s.interestExpenseLedgerID === l.ledgerID || 
                        s.ledgerID === l.ledgerID
                      );
                      const displayName = (matchedScheme && matchedScheme.schemeName) 
                        ? matchedScheme.schemeName 
                        : l.ledgerName;
                      const rateText = matchedScheme && matchedScheme.interestRate 
                        ? ` (${matchedScheme.interestRate}% p.a. • ${matchedScheme.calculationMethod === 'MonthlyMinimum' ? '10 ते महिनाअखेर किमान' : 'दैनिक प्रॉडक्ट'})` 
                        : '';
                      return (
                        <option key={l.ledgerID} value={l.ledgerID}>
                          {displayName}{rateText}
                        </option>
                      );
                    })}
                    <option value="__CREATE_NEW_SCHEME__" className="font-bold text-emerald-700 bg-emerald-50">
                      ➕ नवीन बचत ठेव योजना तयार करा (Create Scheme)
                    </option>
                  </>
                )}
              </select>

              {ledgers.length === 0 && (
                <div className="mt-1 flex items-start gap-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                  <span className="text-amber-600 font-bold shrink-0">⚠️</span>
                  <div>
                    <span>कोणतीही बचत ठेव योजना तयार केलेली नाही. खाते उघडण्यासाठी कृपया </span>
                    <button
                      type="button"
                      onClick={handleOpenQuickSchemeModal}
                      className="underline font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer ml-0.5"
                    >
                      येथे क्लिक करून योजना तयार करा
                    </button>
                    <span>.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Account Type - 3 cols */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-0.5">खाते प्रकार (Account Type) *</label>
              <select
                name="accountType"
                value={formData.accountType}
                onChange={handleInputChange}
                disabled={isEditMode}
                className="w-full border border-gray-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs disabled:bg-gray-100 disabled:text-gray-500 h-7"
              >
                <option value="Personal">वैयक्तिक (Personal)</option>
                <option value="Joint">संयुक्त (Joint)</option>
              </select>
            </div>

            {/* Opening Date - 3 cols */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-0.5">तारीख (Opening Date) *</label>
              <input
                type="date"
                name="openingDate"
                value={formData.openingDate}
                onChange={handleInputChange}
                className="w-full border border-gray-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs font-semibold text-gray-800 bg-white h-7"
                required
              />
            </div>

            {/* Interest Rate - 2 cols */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-0.5">व्याज दर (%)</label>
              <input
                type="number"
                step="0.01"
                name="interestRate"
                value={formData.interestRate}
                onChange={handleInputChange}
                onWheel={(e) => e.currentTarget.blur()}
                onFocus={(e) => e.target.select()}
                className="w-full border border-gray-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs h-7"
                required
              />
            </div>

            {/* Minimum Balance - 3 cols */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-0.5">किमान शिल्लक (₹)</label>
              <input
                type="number"
                name="minimumBalance"
                value={formData.minimumBalance}
                onChange={handleInputChange}
                onWheel={(e) => e.currentTarget.blur()}
                onFocus={(e) => e.target.select()}
                className="w-full border border-gray-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs font-semibold text-gray-800 h-7"
                required
              />
            </div>

            {/* Status Select - 3 cols */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-0.5">खाते स्थिती (Status) *</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full border border-gray-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs bg-white font-bold h-7"
              >
                <option value="Active">● सक्रिय (Active)</option>
                <option value="Frozen">🔒 फ्रीझ (Frozen)</option>
                <option value="Dormant">⚠️ सुप्त (Dormant)</option>
              </select>
            </div>

            {/* Lien Hold Amount - 3 cols */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-amber-800 mb-0.5 flex items-center gap-1">
                <span>🔒</span> तारण होल्ड (Lien ₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="lienAmount"
                value={formData.lienAmount}
                onChange={handleInputChange}
                onWheel={(e) => e.currentTarget.blur()}
                onFocus={(e) => e.target.select()}
                placeholder="0.00"
                className="w-full border border-amber-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-xs font-bold text-amber-900 bg-amber-50/40 h-7"
              />
            </div>

            {/* Lien Reason - 3 cols */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-amber-800 mb-0.5 truncate" title="होल्डचे तपशीलवार कारण (Lien Reason & Remarks)">होल्डचे कारण (Lien Remarks)</label>
              <input
                type="text"
                name="lienReason"
                value={formData.lienReason}
                onChange={handleInputChange}
                placeholder="उदा. कर्ज खाते L-102 साठी तारण"
                className="w-full border border-amber-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-xs bg-amber-50/40 font-medium h-7"
              />
            </div>
          </div>

          {/* Row 2: Joint Holders - Only shown when Account Type is Joint */}
          {formData.accountType === 'Joint' && (
            <div className="border border-blue-200 rounded-sm p-2 bg-blue-50/50">
              <h3 className="text-xs font-bold text-blue-700 mb-1.5 flex items-center gap-1">
                <span>👥</span> सह-खातेदार (Joint Holders)
              </h3>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1">
                  <CustomerSearchSelect
                    customers={members.filter(m => (m.customerID || m.customerId || m.memberID) !== formData.customerID && !jointHolderCustomerIDs.includes(m.customerID || m.customerId || m.memberID || 0))}
                    value={selectedJointCustomerID ? Number(selectedJointCustomerID) : ''}
                    onChange={(val) => setSelectedJointCustomerID(val ? Number(val) : 0)}
                    placeholder="-- सह-खातेदार शोधा व निवडा --"
                  />
                </div>
                <button
                  type="button"
                  onClick={addJointHolder}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-[5px] rounded-sm text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  + जोडा
                </button>
              </div>

              {/* Added Joint Holders List */}
              {jointHolderCustomerIDs.length > 0 && (
                <div className="space-y-0.5">
                  {jointHolderCustomerIDs.map((id, idx) => (
                    <div key={id} className="flex items-center justify-between bg-white border border-blue-200 rounded-sm px-2 py-0.5 text-xs">
                      <span className="text-gray-800 font-medium">
                        {idx + 1}. {getCustomerLabel(id)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeJointHolder(id)}
                        className="text-red-500 hover:text-red-700 font-bold text-sm px-1 cursor-pointer"
                        title="काढा"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {jointHolderCustomerIDs.length === 0 && (
                <p className="text-[10px] text-blue-500 italic">किमान एक सह-खातेदार जोडा.</p>
              )}
            </div>
          )}

          {/* Row 3: Nominee Details */}
          <div className="border border-amber-200/90 rounded-sm p-2.5 bg-amber-50/20 space-y-1">
            <h3 className="text-xs font-bold text-amber-900 flex items-center gap-1">
              <span>🛡️</span> वारसदार माहिती (Nominee Details)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-0.5">वारसदाराचे नाव (Nominee Name)</label>
                <input
                  type="text"
                  name="nomineeName"
                  value={formData.nomineeName}
                  onChange={handleInputChange}
                  placeholder="नाव टाका..."
                  className="w-full border border-gray-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs h-7"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-0.5">नाते (Relation)</label>
                <select
                  name="nomineeRelation"
                  value={formData.nomineeRelation}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs bg-white h-7"
                >
                  <option value="">-- नाते निवडा --</option>
                  {relationOptions.map(rel => (
                    <option key={rel} value={rel}>{rel}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-0.5">वारसदाराचा पत्ता (Nominee Address)</label>
                <input
                  type="text"
                  name="nomineeAddress"
                  value={formData.nomineeAddress}
                  onChange={handleInputChange}
                  placeholder="पत्ता टाका..."
                  className="w-full border border-gray-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs h-7"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-[#004a75] text-white px-6 py-1.5 rounded-sm font-semibold shadow-xs transition-colors text-xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'जतन करत आहे...' : (isEditMode ? 'अपडेट करा (Update)' : 'खाते उघडा (Create Account)')}
            </button>
          </div>
        </form>
      </div>

      {/* Account List Summary & Modal Trigger Bar */}
      <div className="mt-3 bg-white p-3 rounded-sm shadow-xs border border-gray-200 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-base">📂</span>
          <h2 className="text-sm font-bold text-gray-800">उघडलेली बचत खाती (Saving Accounts Directory)</h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">{filteredAccounts.length} खाती</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="नाव किंवा खाते क्र. शोधा..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-gray-300 px-3 py-1 rounded-sm focus:outline-none focus:border-blue-500 text-xs w-52 bg-white"
          />
          <button
            type="button"
            onClick={() => setShowAccountsModal(true)}
            className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-4 py-1.5 rounded-sm shadow-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>🔍</span> सर्व खाती पॉपअप मध्ये पहा (Full Grid View)
          </button>
        </div>
      </div>

      {/* Full Screen Modal Popup Window */}
      {showAccountsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-md shadow-2xl border border-gray-200 w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">📂</span>
                <h2 className="text-sm sm:text-base font-bold">उघडलेली बचत खाती (Opened Saving Accounts Directory)</h2>
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {filteredAccounts.length} खाती
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountsModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 w-7 h-7 rounded-full flex items-center justify-center text-lg font-bold transition-colors cursor-pointer"
                title="बंद करा (Close)"
              >
                ✕
              </button>
            </div>

            {/* Modal Header Error & Success Banners */}
            {error && (
              <div className="bg-red-600 text-white px-4 py-2 text-xs font-bold flex justify-between items-center shrink-0">
                <span>⚠️ {error}</span>
                <button onClick={() => setError('')} className="text-white hover:text-gray-200 font-bold ml-2">✕</button>
              </div>
            )}
            {success && (
              <div className="bg-green-600 text-white px-4 py-2 text-xs font-bold flex justify-between items-center shrink-0">
                <span>✅ {success}</span>
                <button onClick={() => setSuccess('')} className="text-white hover:text-gray-200 font-bold ml-2">✕</button>
              </div>
            )}

            {/* Modal Search Bar & Instruction */}
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <label className="text-xs font-bold text-gray-700 whitespace-nowrap">शोधा (Search):</label>
                <input
                  type="text"
                  placeholder="नाव, खाते क्र. किंवा शाखा शोधा..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-gray-300 px-3 py-1 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs w-full sm:w-80 bg-white font-medium"
                  autoFocus
                />
              </div>
              <div className="text-xs text-gray-600 font-medium">
                * खात्यात बदल करण्यासाठी <span className="font-bold text-blue-700">✏️ बदल करा (Edit)</span> किंवा <span className="font-bold text-red-600">🗑️ डिलीट</span> बटण वापरा.
              </div>
            </div>

            {/* Modal Body - Complete 16+ Columns Table */}
            <div className="overflow-auto flex-1 p-2">
              <table className="min-w-full divide-y divide-gray-200 text-xs text-center border border-gray-200">
                <thead className="bg-gray-100 text-gray-800 sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-center">अ. क्र.</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-left">शाखा (Branch)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-left">खाते क्र. (A/c No)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-left">खातेदार व सह-खातेदार (Customer Name)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-center">प्रकार (Type)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-left">ठेव प्रकार (Ledger)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-center">तारीख (Opening Date)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-right">आरंभी शिल्लक (OB ₹)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-right">चालू शिल्लक (Balance ₹)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-center">व्याज (%)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-right">किमान शिल्लक (Min Bal ₹)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-left">तारण होल्ड (Lien Hold)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-left">वारसदार नाव (Nominee Name)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-center">नाते (Relation)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-left">वारसदार पत्ता (Address)</th>
                    <th className="px-2 py-2 border-r border-gray-300 font-bold text-center">स्थिती (Status)</th>
                    <th className="px-2 py-2 font-bold text-center w-28 sticky right-0 bg-gray-100 shadow-xs">कृती (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="px-4 py-8 text-center text-gray-500 font-medium">
                        कोणतेही बचत खाते आढळले नाही.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc: any, index: number) => (
                      <tr key={acc.savingAccountID} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-semibold text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-700 font-semibold whitespace-nowrap">
                          {acc.branchName || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-bold text-primary whitespace-nowrap">
                          {acc.accountNo}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-semibold text-gray-900 min-w-[180px]">
                          <div>{acc.customerName || acc.memberName}</div>
                          {acc.jointHolders && acc.jointHolders.length > 0 && (
                            <div className="text-[10px] text-blue-600 mt-0.5">
                              🤝 सह-खातेदार: {acc.jointHolders.map((jh: any) => jh.customerName || jh.memberName).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-sm ${
                            acc.accountType === 'Joint' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {acc.accountType === 'Joint' ? 'संयुक्त' : 'वैयक्तिक'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-600 font-medium whitespace-nowrap">
                          {ledgers.find(l => l.ledgerID === acc.ledgerID)?.ledgerName || 'बचत ठेव (Saving)'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap text-gray-700">
                          {formatDateDisplay(acc.openingDate)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-medium text-gray-700 whitespace-nowrap">
                          ₹{(acc.openingBalance || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-bold text-emerald-600 whitespace-nowrap">
                          ₹{(acc.currentBalance || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-semibold text-gray-700 whitespace-nowrap">
                          {acc.interestRate}%
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-semibold text-gray-800 whitespace-nowrap">
                          ₹{(acc.minimumBalance || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left whitespace-nowrap">
                          {(acc.lienAmount || 0) > 0 ? (
                            <span className="text-amber-800 font-bold text-[11px]" title={acc.lienReason || ''}>
                              🔒 ₹{(acc.lienAmount || 0).toFixed(2)} {acc.lienReason ? `(${acc.lienReason})` : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-800 font-medium whitespace-nowrap">
                          {acc.nomineeName || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-700 whitespace-nowrap">
                          {acc.nomineeRelation || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-600 max-w-[150px] truncate" title={acc.nomineeAddress || ''}>
                          {acc.nomineeAddress || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-sm ${
                            acc.status === 'Active' ? 'bg-green-100 text-green-800' :
                            acc.status === 'Frozen' ? 'bg-red-100 text-red-800 border border-red-300' :
                            acc.status === 'Dormant' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {acc.status === 'Active' ? 'सक्रिय' :
                             acc.status === 'Frozen' ? '🔒 फ्रीझ' :
                             acc.status === 'Dormant' ? '⚠️ सुप्त' : 'निष्क्रिय'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center sticky right-0 bg-white shadow-xs">
                          <div className="flex justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                handleEdit(acc);
                                setShowAccountsModal(false);
                              }}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-sm text-[11px] font-bold border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                              title="बदल करा (Edit)"
                            >
                              <span>✏️</span> बदल
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(acc.savingAccountID)}
                              className="bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 rounded-sm text-[11px] font-bold border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                              title="डिलीट करा (Delete)"
                            >
                              <span>🗑️</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 flex justify-between items-center text-xs shrink-0">
              <span className="text-gray-600 font-medium">एकूण खाती: <b>{filteredAccounts.length}</b></span>
              <button
                type="button"
                onClick={() => setShowAccountsModal(false)}
                className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer"
              >
                पॉपअप बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Marathi Duplicate Saving Account Confirmation Modal */}
      {showDuplicateConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-md shadow-2xl border border-amber-300 max-w-md w-full overflow-hidden">
            <div className="bg-amber-600 text-white px-4 py-3 font-bold text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>बचत खाते आधीच उघडलेले आहे!</span>
              </div>
              <button type="button" onClick={() => setShowDuplicateConfirmModal(false)} className="text-white hover:text-amber-100 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-800 leading-relaxed">
                या खातेदाराचे (<b>{selectedMember?.firstName || ''} {selectedMember?.lastName || ''}</b>{selectedMember?.cifNo ? `, CIF: ${selectedMember.cifNo}` : ''}) बचत खाते (Saving Account) आधीच उघडलेले आहे.
              </p>

              {existingMemberAccounts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2.5 space-y-1">
                  <div className="font-bold text-amber-900 text-[11px] flex items-center gap-1">
                    <span>🏦</span>
                    <span>सध्या चालू असलेली बचत खाती ({existingMemberAccounts.length}):</span>
                  </div>
                  <div className="text-[11px] text-amber-800 font-mono font-semibold">
                    {existingMemberAccounts.map((a: any) => a.accountNo || `Acc#${a.savingAccountID}`).join(', ')}
                  </div>
                </div>
              )}

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-950 font-bold text-xs">
                तुम्हाला या खातेदाराचे आणखी १ नवीन बचत खाते (Multiple Saving Account) उघडायचे आहे का?
              </div>
            </div>

            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDuplicateConfirmModal(false)}
                className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-slate-800 rounded-sm text-xs font-bold transition-all cursor-pointer"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmedCustomerID(Number(formData.customerID));
                  setShowDuplicateConfirmModal(false);
                  executeSave();
                }}
                className="px-4 py-1.5 bg-primary hover:bg-[#004a75] text-white rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>✓</span>
                <span>होय, नवीन खाते तयार करा</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Saving Scheme Creation Modal */}
      {showQuickSchemeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white px-4 py-3 font-bold text-sm flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-white/20 rounded">✨</span>
                <span>नवीन बचत ठेव योजना तयार करा (New Saving Scheme)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickSchemeModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveQuickScheme}>
              <div className="p-4 space-y-3 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
                {schemeModalError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-1.5 font-semibold">
                    <span>⚠️</span>
                    <span>{schemeModalError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Scheme Code */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">योजना कोड (Scheme Code) *</label>
                    <input
                      type="text"
                      value={quickSchemeForm.schemeCode}
                      onChange={(e) => setQuickSchemeForm(prev => ({ ...prev, schemeCode: e.target.value }))}
                      required
                      placeholder="उदा. SAV-001"
                      className="w-full border border-gray-300 px-2.5 py-1.5 rounded text-xs font-mono font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Interest Rate */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">वार्षिक व्याजदर (Interest Rate %) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={quickSchemeForm.interestRate}
                      onChange={(e) => setQuickSchemeForm(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))}
                      onWheel={(e) => e.currentTarget.blur()}
                      required
                      placeholder="उदा. 4.00"
                      className="w-full border border-gray-300 px-2.5 py-1.5 rounded text-xs font-bold text-emerald-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Scheme Name */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">योजनेचे नाव (Scheme Name) *</label>
                    <input
                      type="text"
                      value={quickSchemeForm.schemeName}
                      onChange={(e) => setQuickSchemeForm(prev => ({ ...prev, schemeName: e.target.value }))}
                      required
                      placeholder="उदा. सर्वसाधारण बचत ठेव 4%"
                      className="w-full border border-gray-300 px-2.5 py-1.5 rounded text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Calculation Method */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">व्याज गणना पद्धत (Calculation Method) *</label>
                    <select
                      value={quickSchemeForm.calculationMethod}
                      onChange={(e) => setQuickSchemeForm(prev => ({ ...prev, calculationMethod: e.target.value }))}
                      className="w-full border border-gray-300 px-2.5 py-1.5 rounded text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value="DailyProduct">दैनिक प्रॉडक्ट (Daily Product)</option>
                      <option value="MonthlyMinimum">10 ते महिनाअखेर किमान शिल्लक (Monthly Minimum)</option>
                    </select>
                  </div>

                  {/* Posting Frequency */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">पोस्टिंग वारंवारता (Frequency) *</label>
                    <select
                      value={quickSchemeForm.postingFrequency}
                      onChange={(e) => setQuickSchemeForm(prev => ({ ...prev, postingFrequency: e.target.value }))}
                      className="w-full border border-gray-300 px-2.5 py-1.5 rounded text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value="Quarterly">तिमाही (Quarterly)</option>
                      <option value="HalfYearly">सहामाही (Half-Yearly)</option>
                      <option value="Yearly">वार्षिक (Yearly)</option>
                      <option value="Monthly">मासिक (Monthly)</option>
                    </select>
                  </div>

                  {/* Saving Liability GL Ledger */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">बचत ठेव नियंत्रण लेजर (Saving Liability Ledger) *</label>
                    <select
                      value={quickSchemeForm.savingLiabilityLedgerID}
                      onChange={(e) => setQuickSchemeForm(prev => ({ ...prev, savingLiabilityLedgerID: parseInt(e.target.value, 10) || 0 }))}
                      required
                      className="w-full border border-gray-300 px-2.5 py-1.5 rounded text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">-- लेजर निवडा --</option>
                      {allGlLedgers.map((l) => (
                        <option key={l.ledgerID} value={l.ledgerID}>
                          {l.ledgerName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Interest Expense GL Ledger */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5">बचत व्याज खर्च लेजर (Interest Expense Ledger)</label>
                    <select
                      value={quickSchemeForm.interestExpenseLedgerID}
                      onChange={(e) => setQuickSchemeForm(prev => ({ ...prev, interestExpenseLedgerID: parseInt(e.target.value, 10) || 0 }))}
                      className="w-full border border-gray-300 px-2.5 py-1.5 rounded text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value={0}>-- स्वयंचलित निवडा (Default Expense) --</option>
                      {allGlLedgers.map((l) => (
                        <option key={l.ledgerID} value={l.ledgerID}>
                          {l.ledgerName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickSchemeModal(false)}
                  disabled={savingSchemeLoading}
                  className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-slate-800 rounded text-xs font-bold transition-all cursor-pointer"
                >
                  रद्द करा (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={savingSchemeLoading}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {savingSchemeLoading ? (
                    <>
                      <span className="inline-block animate-spin">⏳</span>
                      <span>सेव्ह करत आहे...</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>योजना सेव्ह करा व निवडा</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingAccountMaster;

