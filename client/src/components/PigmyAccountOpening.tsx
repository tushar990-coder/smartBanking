import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import SearchableSelect from './SearchableSelect';
import CustomerSearchSelect from './common/CustomerSearchSelect';
import { 
  CreditCard, 
  User, 
  Building2, 
  Calendar, 
  Award, 
  ShieldCheck, 
  Percent, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Printer,
  ArrowUpRight,
  Search,
  ListFilter,
  RefreshCw,
  Eye,
  FileText,
  Edit2,
  Trash2,
  Save,
  RotateCcw,
  SlidersHorizontal,
  Info,
  ListOrdered
} from 'lucide-react';

interface Branch {
  branchID?: number;
  branchId?: number;
  branchCode: string;
  branchName: string;
}

export default function PigmyAccountOpening() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  
  // Saved Pigmy Accounts State
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal Controls
  const [showFullAccountsListModal, setShowFullAccountsListModal] = useState<boolean>(false);
  const [selectedAccountModal, setSelectedAccountModal] = useState<any | null>(null);
  const [isEditModalMode, setIsEditModalMode] = useState<boolean>(false);
  
  const [modalEditForm, setModalEditForm] = useState({
    pigmyAgentID: '',
    pigmySchemeID: '',
    totalDepositedAmount: '',
    status: 'Active'
  });
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    accountNo: '',
    customerID: '',
    branchID: '1',
    pigmySchemeID: '',
    pigmyAgentID: '',
    openingDate: new Date().toISOString().split('T')[0],
    openingBalance: '0'
  });

  const [autoAccountNo, setAutoAccountNo] = useState<string>('लोड होत आहे...');
  const [loadingAccountNo, setLoadingAccountNo] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedScheme, setSelectedScheme] = useState<any>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [createdAccountResult, setCreatedAccountResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Safe Property Resolvers
  const getCustomerId = (c: any): string => {
    if (!c) return '';
    const id = c.customerID ?? c.customerId ?? c.CustomerID ?? c.id;
    return id !== undefined && id !== null ? id.toString() : '';
  };

  const getCustomerFullName = (c: any): string => {
    if (!c) return '';
    const fn = c.firstName || c.FirstName || '';
    const mn = c.middleName || c.MiddleName || '';
    const ln = c.lastName || c.LastName || '';
    const name = `${fn} ${mn} ${ln}`.replace(/\s+/g, ' ').trim();
    return name || 'अज्ञात खातेदार';
  };

  const getCustomerCif = (c: any): string => {
    if (!c) return '-';
    return c.cifNo || c.CIFNo || c.cifno || '-';
  };

  const getCustomerMobile = (c: any): string => {
    if (!c) return '-';
    return c.mobileNo || c.MobileNo || c.phoneNo || '-';
  };

  const getCustomerAadhaar = (c: any): string => {
    if (!c) return '-';
    return c.aadhaarNo || c.AadhaarNo || c.aadhaarCardNo || '-';
  };

  const getCustomerPan = (c: any): string => {
    if (!c) return '-';
    return c.panNo || c.PANNo || c.panCardNo || '-';
  };

  const getCustomerAddressStr = (c: any): string => {
    if (!c) return '';
    const addr = c.address || c.Address || '';
    const village = c.village || c.Village || '';
    const taluka = c.taluka || c.Taluka || '';
    const dist = c.district || c.District || '';
    const parts = [addr, village, taluka, dist].filter(Boolean);
    return parts.join(', ');
  };

  const getSchemeId = (s: any): string => {
    if (!s) return '';
    const id = s.pigmySchemeID ?? s.pigmySchemeId ?? s.PigmySchemeID ?? s.id;
    return id !== undefined && id !== null ? id.toString() : '';
  };

  const getAgentId = (a: any): string => {
    if (!a) return '';
    const id = a.pigmyAgentID ?? a.pigmyAgentId ?? a.PigmyAgentID ?? a.id;
    return id !== undefined && id !== null ? id.toString() : '';
  };

  const getAccountId = (acc: any): number => {
    if (!acc) return 0;
    const id = acc.pigmyAccountID ?? acc.pigmyAccountId ?? acc.PigmyAccountID ?? acc.id ?? acc.AccountID ?? acc.accountId ?? 0;
    return typeof id === 'number' ? id : parseInt(id) || 0;
  };

  useEffect(() => {
    fetchMasters();
    fetchSavedAccounts();
  }, []);

  // Sync Selected Customer on form change
  useEffect(() => {
    if (formData.customerID && customers.length > 0) {
      const targetIdStr = formData.customerID.toString();
      const matched = customers.find(c => getCustomerId(c) === targetIdStr);
      setSelectedCustomer(matched || null);
    } else if (!formData.customerID) {
      setSelectedCustomer(null);
    }
  }, [formData.customerID, customers]);

  useEffect(() => {
    if (formData.branchID) {
      fetchNextAccountNo(parseInt(formData.branchID), formData.pigmySchemeID ? parseInt(formData.pigmySchemeID) : 1);
    }
  }, [formData.branchID, formData.pigmySchemeID]);

  const fetchMasters = async () => {
    try {
      const [customersRes, branchesRes, schemesRes, agentsRes] = await Promise.all([
        axios.get('/api/Customers'),
        axios.get('/api/Branches'),
        axios.get('/api/PigmySchemes'),
        axios.get('/api/PigmyAgents')
      ]);

      if (customersRes.data) setCustomers(customersRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (schemesRes.data) setSchemes(schemesRes.data);
      if (agentsRes.data) setAgents(agentsRes.data);
    } catch (error) {
      console.error('Failed to fetch masters', error);
      toast.error('मास्टर डेटा लोड करताना त्रुटी आली.');
    }
  };

  const fetchSavedAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await axios.get('/api/PigmyAccounts');
      if (res.data) {
        setSavedAccounts(res.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch saved accounts', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const fetchNextAccountNo = async (branchId: number, schemeId: number) => {
    setLoadingAccountNo(true);
    try {
      const res = await axios.get('/api/PigmyAccounts/next-account-no', {
        params: { branchId, schemeId }
      });
      if (res.data) {
        const nextNo = res.data.accountNo || (typeof res.data === 'string' ? res.data : 'PG-00001');
        setAutoAccountNo(nextNo);
        setFormData(prev => ({ ...prev, accountNo: nextNo }));
      } else {
        setAutoAccountNo('PG-00001');
        setFormData(prev => ({ ...prev, accountNo: 'PG-00001' }));
      }
    } catch (err) {
      console.error('Failed to fetch next account number', err);
      setAutoAccountNo('PG-00001');
      setFormData(prev => ({ ...prev, accountNo: 'PG-00001' }));
    } finally {
      setLoadingAccountNo(false);
    }
  };

  const adjustAccountNo = (current: string, delta: number): string => {
    if (!current || current === 'लोड होत आहे...') {
      return delta > 0 ? 'PG-00001' : 'PG-00001';
    }
    const match = current.match(/^(.*?)(\d+)([^\d]*)$/);
    if (!match) {
      return delta > 0 ? `${current}-1` : current;
    }
    const prefix = match[1];
    const numStr = match[2];
    const suffix = match[3];
    const currentNum = parseInt(numStr, 10);
    const nextNum = Math.max(1, currentNum + delta);
    const paddedNum = String(nextNum).padStart(numStr.length, '0');
    return `${prefix}${paddedNum}${suffix}`;
  };

  const handleIncrementAccountNo = () => {
    const current = formData.accountNo || autoAccountNo;
    const nextVal = adjustAccountNo(current, 1);
    setFormData(prev => ({ ...prev, accountNo: nextVal }));
    setAutoAccountNo(nextVal);
  };

  const handleDecrementAccountNo = () => {
    const current = formData.accountNo || autoAccountNo;
    const prevVal = adjustAccountNo(current, -1);
    setFormData(prev => ({ ...prev, accountNo: prevVal }));
    setAutoAccountNo(prevVal);
  };

  const handleAccountNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, accountNo: val }));
    setAutoAccountNo(val);
  };

  const handleCustomerChange = (e: any) => {
    const custId = e && e.target ? e.target.value : e;
    const strCustId = custId !== undefined && custId !== null ? custId.toString() : '';
    setFormData(prev => ({ ...prev, customerID: strCustId }));
    const customer = customers.find(c => getCustomerId(c) === strCustId);
    setSelectedCustomer(customer || null);
  };

  const handleSchemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const schemeId = e.target.value;
    setFormData(prev => ({ ...prev, pigmySchemeID: schemeId }));
    const scheme = schemes.find(s => getSchemeId(s) === schemeId);
    setSelectedScheme(scheme || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.customerID) {
      setErrorMessage('कृपया खातेदार निवडा.');
      toast.error('कृपया खातेदार निवडा.');
      return;
    }
    if (!formData.pigmySchemeID) {
      setErrorMessage('कृपया पिग्मी योजना निवडा.');
      toast.error('कृपया पिग्मी योजना निवडा.');
      return;
    }
    if (!formData.pigmyAgentID) {
      setErrorMessage('कृपया पिग्मी एजंट निवडा.');
      toast.error('कृपया पिग्मी एजंट निवडा.');
      return;
    }

    const activeAccountNo = (formData.accountNo || autoAccountNo || '').trim();
    const existingAccount = activeAccountNo && activeAccountNo !== 'लोड होत आहे...'
      ? savedAccounts.find(
          acc => (acc.accountNo || acc.AccountNo || '').toString().trim().toLowerCase() === activeAccountNo.toLowerCase()
        )
      : null;

    if (existingAccount) {
      const existingCustomerName = existingAccount.customer ? `${existingAccount.customer.firstName || ''} ${existingAccount.customer.lastName || ''}`.trim() : '';
      setErrorMessage(`पिग्मी खाते क्रमांक '${activeAccountNo}' आधीच ${existingCustomerName ? `(${existingCustomerName}) च्या नावे ` : ''}नोंदणीकृत आहे. कृपया दुसरा क्रमांक निवडा किंवा (+) ने पुढील क्रमांक घ्या.`);
      toast.error(`पिग्मी खाते क्रमांक '${activeAccountNo}' आधीच अस्तित्वात आहे.`);
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        accountNo: activeAccountNo,
        customerID: parseInt(formData.customerID),
        branchID: parseInt(formData.branchID),
        pigmySchemeID: parseInt(formData.pigmySchemeID),
        pigmyAgentID: parseInt(formData.pigmyAgentID),
        openingDate: formData.openingDate,
        openingBalance: parseFloat(formData.openingBalance) || 0
      };

      const response = await axios.post('/api/PigmyAccounts/OpenAccount', payload);

      if (response.data) {
        const data = response.data;
        const createdNo = data.accountNo || activeAccountNo;
        setCreatedAccountResult({
          accountNo: createdNo,
          customerName: selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : '',
          schemeName: selectedScheme ? selectedScheme.schemeName : '',
          openingDate: formData.openingDate,
          maturityDate: getMaturityDate()
        });
        toast.success(`नवीन पिग्मी खाते क्रमांक '${createdNo}' यशस्वीरीत्या उघडले गेले!`);
        fetchSavedAccounts();
        fetchNextAccountNo(parseInt(formData.branchID || '1'), formData.pigmySchemeID ? parseInt(formData.pigmySchemeID) : 1);
        setFormData(prev => ({
          ...prev,
          customerID: '',
          openingBalance: '0'
        }));
        setSelectedCustomer(null);
      }
    } catch (error: any) {
      console.error('Error opening account', error);
      const errText = error.response?.data?.message || error.response?.data || 'सर्व्हर त्रुटी आली. सबमिशन पूर्ण होऊ शकले नाही.';
      setErrorMessage(`खाते तयार करताना त्रुटी आली: ${errText}`);
      toast.error(`खाते उघडताना त्रुटी: ${errText}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAccountModal = (acc: any, edit: boolean = false) => {
    setSelectedAccountModal(acc);
    setIsEditModalMode(edit);
    setModalMessage(null);
    setModalEditForm({
      pigmyAgentID: getAgentId(acc.pigmyAgent) || acc.pigmyAgentID?.toString() || '',
      pigmySchemeID: getSchemeId(acc.pigmyScheme) || acc.pigmySchemeID?.toString() || '',
      totalDepositedAmount: acc.totalDepositedAmount !== undefined ? acc.totalDepositedAmount.toString() : '0',
      status: acc.status || 'Active'
    });
  };

  const handleUpdateAccountModal = async () => {
    if (!selectedAccountModal) return;
    const accId = getAccountId(selectedAccountModal);
    if (!accId) {
      setModalMessage({ type: 'error', text: 'अवैध खाते आयडी.' });
      return;
    }
    
    try {
      const payload = {
        pigmyAccountID: accId,
        pigmyAgentID: parseInt(modalEditForm.pigmyAgentID),
        pigmySchemeID: parseInt(modalEditForm.pigmySchemeID),
        totalDepositedAmount: parseFloat(modalEditForm.totalDepositedAmount) || 0,
        status: modalEditForm.status
      };

      const res = await axios.put(`/api/PigmyAccounts/${accId}`, payload);

      if (res.data) {
        setModalMessage({ type: 'success', text: res.data.message || 'पिग्मी खाते माहिती यशस्वीरीत्या अपडेट झाली!' });
        toast.success(res.data.message || 'खाते माहिती अपडेट झाली.');
        setIsEditModalMode(false);
        fetchSavedAccounts();
      }
    } catch (err: any) {
      console.error('Error updating account', err);
      const errMsg = err.response?.data?.message || 'माहिती अपडेट करताना सर्व्हर त्रुटी आली.';
      setModalMessage({ type: 'error', text: errMsg });
      toast.error(errMsg);
    }
  };

  const handleDeleteAccount = async (acc: any, force: boolean = false) => {
    const accId = getAccountId(acc);
    const accNo = acc ? (acc.accountNo || acc.AccountNo || '') : '';
    
    if (!accId) {
      toast.error('अवैध खाते आयडी.');
      return;
    }
    
    if (!force && !window.confirm(`तुम्हाला नक्की पिग्मी खाते क्रमांक '${accNo}' डिलीट करायचा आहे का?`)) {
      return;
    }

    try {
      const url = `/api/PigmyAccounts/${accId}${force ? '?force=true' : ''}`;
      const res = await axios.delete(url);

      if (res.data) {
        toast.success(res.data.message || `पिग्मी खाते '${accNo}' डिलीट केले गेले.`);
        if (selectedAccountModal && getAccountId(selectedAccountModal) === accId) {
          setSelectedAccountModal(null);
        }
        fetchSavedAccounts();
      }
    } catch (err: any) {
      console.error('Error deleting account', err);
      const data = err.response?.data;
      if (data?.canForce && !force) {
        if (window.confirm(`${data.message}\n\nतुम्हाला हे खाते आणि त्याच्या सर्व व्यवहारांच्या नोंदी बळजबरीने (Force Delete) हटवायच्या आहेत का?`)) {
          handleDeleteAccount(acc, true);
          return;
        }
      } else {
        toast.error(data?.message || 'खाते डिलीट करताना सर्व्हर त्रुटी आली.');
      }
    }
  };

  const formatDateToDDMMYYYY = (dateStr: any): string => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.toString();
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr.toString();
    }
  };

  const getMaturityDateISO = (): string => {
    if (selectedScheme && formData.openingDate) {
      const date = new Date(formData.openingDate);
      const months = selectedScheme.durationMonths || 12;
      date.setMonth(date.getMonth() + months);
      return date.toISOString().split('T')[0];
    }
    return '';
  };

  const getMaturityDateDisplay = (): string => {
    const iso = getMaturityDateISO();
    return formatDateToDDMMYYYY(iso);
  };

  const getMaturityDate = getMaturityDateISO;

  const filteredSavedAccounts = savedAccounts.filter(acc => {
    const accountNo = (acc.accountNo || acc.AccountNo || '').toString().toLowerCase();
    const customerName = acc.customer 
      ? `${acc.customer.firstName || ''} ${acc.customer.middleName || ''} ${acc.customer.lastName || ''}`.toLowerCase()
      : '';
    const agentName = acc.pigmyAgent ? (acc.pigmyAgent.agentName || '').toLowerCase() : '';
    const query = searchTerm.toLowerCase();

    return accountNo.includes(query) || customerName.includes(query) || agentName.includes(query);
  });

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Standard ERP Header Banner */}
      <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-200" />
          <div>
            <h1 className="text-sm font-bold tracking-wide">नवीन पिग्मी खाते उघडा (New Pigmy Account Opening)</h1>
            <p className="text-[10px] text-blue-100 font-normal">ऑटो-इन्क्रिमेंट खाते क्रमांक, एजंट लिंकिंग आणि पिग्मी खात्यांची व्यवस्थापन यादी</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchSavedAccounts();
              setShowFullAccountsListModal(true);
            }}
            className="px-2.5 py-0.5 bg-blue-800/60 hover:bg-blue-800 text-white font-semibold rounded-sm border border-blue-400/40 flex items-center gap-1 text-xs cursor-pointer"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>खाती यादी ({savedAccounts.length})</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="font-bold text-slate-400 hover:text-slate-600 text-sm">×</button>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-5">
        
        {/* Section 1: Customer & Account Info */}
        <div>
          <div className="text-xs font-bold text-slate-800 pb-2 mb-3 border-b border-slate-100 flex items-center gap-1.5">
            <User className="w-4 h-4 text-primary" />
            <span>१. खातेदार व खाते क्रमांक माहिती (Customer & Account Info)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* PIGMY ACCOUNT NUMBER FIELD WITH INCREMENT / DECREMENT STEPPER */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 text-xs">
                  पिग्मी खाते क्रमांक (Pigmy Account No) <span className="text-rose-500">*</span>
                </label>
                {(() => {
                  const activeNo = (formData.accountNo || autoAccountNo || '').trim().toLowerCase();
                  const exists = activeNo && activeNo !== 'लोड होत आहे...' && savedAccounts.some(
                    acc => (acc.accountNo || acc.AccountNo || '').toString().trim().toLowerCase() === activeNo
                  );
                  if (exists) {
                    return (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        ⚠ वापरलेले (In Use)
                      </span>
                    );
                  }
                  if (formData.accountNo && formData.accountNo !== 'लोड होत आहे...') {
                    return (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        ✓ उपलब्ध (Available)
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="flex items-center gap-1">
                {/* Decrement Button */}
                <button
                  type="button"
                  onClick={handleDecrementAccountNo}
                  title="मागील क्रमांक (Decrement -1)"
                  className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-extrabold text-base rounded-lg border border-slate-300 transition-colors cursor-pointer select-none"
                >
                  −
                </button>

                {/* Account Number Input */}
                <input 
                  type="text" 
                  name="accountNo"
                  required
                  value={formData.accountNo || autoAccountNo} 
                  onChange={handleAccountNoChange}
                  placeholder="उदा. HO-PG-00001"
                  className={`flex-1 border rounded-lg px-2.5 py-1.5 font-extrabold font-mono text-xs outline-none shadow-2xs transition-colors text-center ${
                    (formData.accountNo || autoAccountNo) && savedAccounts.some(acc => (acc.accountNo || acc.AccountNo || '').toString().trim().toLowerCase() === (formData.accountNo || autoAccountNo || '').trim().toLowerCase())
                      ? 'border-rose-400 bg-rose-50/70 text-rose-900 focus:border-rose-500' 
                      : 'border-slate-300 bg-white text-primary focus:border-primary focus:ring-1 focus:ring-primary'
                  }`}
                />

                {/* Increment Button */}
                <button
                  type="button"
                  onClick={handleIncrementAccountNo}
                  title="पुढील क्रमांक (Increment +1)"
                  className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-extrabold text-base rounded-lg border border-slate-300 transition-colors cursor-pointer select-none"
                >
                  +
                </button>

                {/* Reset / Next Sequence Button */}
                <button
                  type="button"
                  onClick={() => fetchNextAccountNo(parseInt(formData.branchID || '1'), formData.pigmySchemeID ? parseInt(formData.pigmySchemeID) : 1)}
                  disabled={loadingAccountNo}
                  title="ऑटो पुढील उपलब्ध खाते क्र. आणा (Fetch Next Auto)"
                  className="h-8 px-2 flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-lg border border-primary/30 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAccountNo ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* SELECT CUSTOMER SEARCHABLE DROPDOWN */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between text-xs">
                <span>खातेदार निवडा (Select Customer / CIF) <span className="text-rose-500">*</span></span>
                {customers.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    एकूण खातेदार: {customers.length}
                  </span>
                )}
              </label>
              <CustomerSearchSelect
                customers={customers}
                value={formData.customerID ? Number(formData.customerID) : ''}
                onChange={(val) => handleCustomerChange({ target: { name: 'customerID', value: val ? String(val) : '' } })}
                placeholder="-- खातेदार (CIF / नाव / मोबाईलने शोधा) --"
              />
            </div>
          </div>

          {/* RICH SELECTED CUSTOMER PROFILE CARD */}
          {selectedCustomer && (
            <div className="mt-3.5 p-3.5 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/60 border border-blue-200 rounded-2xl shadow-xs space-y-2.5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-blue-100 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 flex items-center justify-center">
                    <User className="w-4 h-4 mx-auto" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs tracking-tight flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-900">{getCustomerFullName(selectedCustomer)}</span>
                      <span className="px-2 py-0.5 bg-primary/10 text-primary font-mono text-[11px] rounded-md font-bold">
                        CIF: {getCustomerCif(selectedCustomer)}
                      </span>
                    </h4>
                    {getCustomerAddressStr(selectedCustomer) ? (
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        📍 {getCustomerAddressStr(selectedCustomer)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic mt-0.5">
                        पत्ता: नोंदवला नाही
                      </p>
                    )}
                  </div>
                </div>

                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-[10px] flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>निवडलेला खातेदार (Active Customer)</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-0.5">
                <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] font-semibold">CIF नंबर:</span>
                  <span className="font-mono font-bold text-slate-800">{getCustomerCif(selectedCustomer)}</span>
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] font-semibold">मोबाईल नंबर:</span>
                  <span className="font-mono font-bold text-slate-800">{getCustomerMobile(selectedCustomer)}</span>
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] font-semibold">आधार कार्ड नंबर:</span>
                  <span className="font-mono font-bold text-slate-800">{getCustomerAadhaar(selectedCustomer)}</span>
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px] font-semibold">पॅन नंबर (PAN):</span>
                  <span className="font-mono font-bold text-slate-800">{getCustomerPan(selectedCustomer)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Account & Multi-Branch Details */}
        <div>
          <div className="text-xs font-bold text-slate-800 pb-2 mb-3 border-b border-slate-100 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-primary" />
            <span>२. खाते व शाखा तपशील (Account & Multi-Branch Details)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* BRANCH SELECTION */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                शाखा निवडा (Select Branch) <span className="text-rose-500">*</span>
              </label>
              <select 
                className="w-full border border-slate-300 rounded-xl px-3 py-1.5 bg-slate-50 focus:bg-white focus:border-primary outline-none"
                value={formData.branchID}
                onChange={(e) => setFormData({ ...formData, branchID: e.target.value })}
              >
                {branches.length > 0 ? (
                  branches.map((b, idx) => {
                    const bId = b.branchID || b.branchId || idx + 1;
                    return (
                      <option key={`br-${bId}-${idx}`} value={bId}>
                        [{b.branchCode || 'HO'}] {b.branchName}
                      </option>
                    );
                  })
                ) : (
                  <option key="br-default" value="1">[HO] मुख्य शाखा (Head Office)</option>
                )}
              </select>
            </div>

            {/* PIGMY SCHEME */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                पिग्मी योजना (Pigmy Scheme) <span className="text-rose-500">*</span>
              </label>
              <select 
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-1.5 bg-slate-50 focus:bg-white focus:border-primary outline-none"
                value={formData.pigmySchemeID}
                onChange={handleSchemeChange}
              >
                <option key="sch-default" value="">-- योजना निवडा --</option>
                {schemes.map((s, idx) => {
                  const sId = getSchemeId(s) || idx.toString();
                  return (
                    <option key={`sch-${sId}-${idx}`} value={sId}>
                      {s.schemeName || 'योजना'} ({s.interestRate || 0}%) - {s.durationMonths || 12}M
                    </option>
                  );
                })}
              </select>
            </div>

            {/* AGENT SELECTION */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                पिग्मी एजंट निवडा (Select Agent) <span className="text-rose-500">*</span>
              </label>
              <select 
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-1.5 bg-slate-50 focus:bg-white focus:border-primary outline-none"
                value={formData.pigmyAgentID}
                onChange={(e) => setFormData({ ...formData, pigmyAgentID: e.target.value })}
              >
                <option key="ag-default" value="">-- एजंट निवडा --</option>
                {agents.map((a, idx) => {
                  const aId = getAgentId(a) || idx.toString();
                  return (
                    <option key={`ag-${aId}-${idx}`} value={aId}>
                      👤 {a.agentName || 'एजंट'} ({a.mobileNo || '-'})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* OPENING DATE */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                खाते उघडण्याची तारीख (Opening Date) <span className="text-rose-500">*</span>
              </label>
              <input 
                type="date" 
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-1.5 bg-slate-50 focus:bg-white focus:border-primary outline-none"
                value={formData.openingDate}
                onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
              />
            </div>

            {/* INTEREST RATE */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">व्याजदर (Interest Rate %)</label>
              <input 
                type="text" 
                readOnly 
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-emerald-800 font-extrabold" 
                value={selectedScheme ? `${selectedScheme.interestRate}%` : '-'} 
              />
            </div>

            {/* MATURITY DATE */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">परिपक्वता तारीख (Maturity Date)</label>
              <div className="relative">
                <input 
                  type="text" 
                  readOnly 
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-900 font-extrabold font-mono text-xs" 
                  value={getMaturityDateDisplay()} 
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-medium font-sans">
                  (DD/MM/YYYY)
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button 
            type="button" 
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold transition"
          >
            रिसेट करा (Reset)
          </button>
          <button 
            type="submit" 
            disabled={submitting}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl font-bold shadow-sm transition flex items-center gap-1.5"
          >
            <span>{submitting ? 'खाते तयार होत आहे...' : 'खाते उघडा (Create Account)'}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* POPUP MODAL 1: SAVED PIGMY ACCOUNTS LIST POPUP PAGE (MATCHES APP THEME) */}
      {showFullAccountsListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-[96%] w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header using App Theme bg-primary */}
            <div className="p-4 bg-primary text-white flex justify-between items-center shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl border border-white/30 text-white">
                  <ListOrdered className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    उघडलेल्या पिग्मी खात्यांची यादी (Saved Pigmy Accounts List)
                  </h3>
                  <p className="text-[11px] text-white/80">
                    एकूण नोंदणीकृत खाती: {savedAccounts.length} | शोध व संपादन पर्याय (Edit & Delete Available)
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowFullAccountsListModal(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Toolbar */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="relative flex-1 w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  placeholder="खाते क्र., सभासद नाव किंवा एजंटने शोधा..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-primary shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchSavedAccounts}
                  disabled={loadingAccounts}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-700 font-semibold transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAccounts ? 'animate-spin' : ''}`} />
                  <span>यादी रिफ्रेश</span>
                </button>
              </div>
            </div>

            {/* Modal Table Content using App Theme */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-primary text-white font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5">खाते क्रमांक (Account No)</th>
                    <th className="px-3 py-2.5">खातेदाराचे नाव (Customer Name)</th>
                    <th className="px-3 py-2.5">पिग्मी योजना (Scheme)</th>
                    <th className="px-3 py-2.5">नियुक्त एजंट (Agent)</th>
                    <th className="px-3 py-2.5 text-right">जमा रक्कम (Balance ₹)</th>
                    <th className="px-3 py-2.5">उघडल्याची तारीख</th>
                    <th className="px-3 py-2.5 text-center">स्थिती (Status)</th>
                    <th className="px-3 py-2.5 text-right">कारवाई (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loadingAccounts ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        <span>पिग्मी खाती लोड होत आहेत...</span>
                      </td>
                    </tr>
                  ) : filteredSavedAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                        कोणतीही पिग्मी खाती सापडली नाहीत.
                      </td>
                    </tr>
                  ) : (
                    filteredSavedAccounts.map((acc, idx) => {
                      const accId = getAccountId(acc) || idx;
                      const accNo = acc.accountNo || acc.AccountNo || '-';
                      const customerName = acc.customer 
                        ? `${acc.customer.firstName || ''} ${acc.customer.middleName ? acc.customer.middleName + ' ' : ''}${acc.customer.lastName || ''}`
                        : '-';
                      const schemeName = acc.pigmyScheme ? acc.pigmyScheme.schemeName : '-';
                      const agentName = acc.pigmyAgent ? acc.pigmyAgent.agentName : '-';
                      const balance = acc.totalDepositedAmount || 0;
                      const openDate = acc.openingDate ? new Date(acc.openingDate).toLocaleDateString('en-IN') : '-';

                      return (
                        <tr key={`acc-${accId}-${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2.5 font-mono font-bold text-primary">
                            {accNo}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-900">
                            👤 {customerName}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 font-medium">
                            {schemeName}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {agentName !== '-' ? `👤 ${agentName}` : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-extrabold text-emerald-700 font-mono">
                            ₹{balance.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">
                            {openDate}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                              acc.status === 'Active' 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {acc.status || 'Active'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right space-x-1">
                            <button
                              onClick={() => handleOpenAccountModal(acc, false)}
                              className="px-2 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 rounded font-bold text-[11px] transition inline-flex items-center gap-0.5"
                              title="तपशील पहा"
                            >
                              <Eye className="w-3 h-3" />
                              <span>पहा</span>
                            </button>
                            <button
                              onClick={() => handleOpenAccountModal(acc, true)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-200 rounded font-bold text-[11px] transition inline-flex items-center gap-0.5"
                              title="संपादित करा"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>संपादित</span>
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(acc)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded font-bold text-[11px] transition inline-flex items-center gap-0.5"
                              title="खाते डिलीट करा"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>डिलीट</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-white border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">
                दाखवत आहे: {filteredSavedAccounts.length} पैकी {savedAccounts.length} खाती
              </span>
              <button
                onClick={() => setShowFullAccountsListModal(false)}
                className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition"
              >
                बंद करा (Close)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP MODAL 2: FULL ACCOUNT DETAILS & EDIT MODAL (MATCHES APP THEME) */}
      {selectedAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header using App Theme bg-primary */}
            <div className="p-4 bg-primary text-white flex justify-between items-center shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl border border-white/30 text-white">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    पिग्मी खाते पूर्ण तपशील व संपादन (Pigmy Account Details)
                  </h3>
                  <p className="text-[10px] text-white/80 font-mono">
                    Account No: {selectedAccountModal.accountNo || selectedAccountModal.AccountNo}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAccountModal(null)}
                className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalMessage && (
              <div className={`p-3 text-xs font-medium flex items-center justify-between ${
                modalMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-rose-50 text-rose-800 border-b border-rose-200'
              }`}>
                <span>{modalMessage.text}</span>
                <button onClick={() => setModalMessage(null)} className="font-bold">×</button>
              </div>
            )}

            <div className="p-5 overflow-y-auto space-y-4 bg-slate-50 flex-1">
              
              {/* Account Header Badge */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">खाते क्रमांक (Account No):</span>
                  <span className="font-extrabold text-primary font-mono text-sm bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-lg">
                    {selectedAccountModal.accountNo || selectedAccountModal.AccountNo}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">खातेदाराचे नाव (Customer Name):</span>
                  <span className="font-bold text-slate-900">
                    👤 {selectedAccountModal.customer ? `${selectedAccountModal.customer.firstName} ${selectedAccountModal.customer.middleName ? selectedAccountModal.customer.middleName + ' ' : ''}${selectedAccountModal.customer.lastName}` : '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">मोबाईल / आधार नंबर:</span>
                  <span className="font-semibold text-slate-700 font-mono">
                    {selectedAccountModal.customer ? (selectedAccountModal.customer.mobileNo || selectedAccountModal.customer.aadhaarNo || '-') : '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">खाते उघडल्याची तारीख:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {formatDateToDDMMYYYY(selectedAccountModal.openingDate)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">परिपक्वता तारीख (Maturity Date):</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {formatDateToDDMMYYYY(selectedAccountModal.maturityDate)}
                  </span>
                </div>
              </div>

              {/* View vs Edit Toggle Content */}
              {isEditModalMode ? (
                <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-3">
                  <h4 className="font-bold text-amber-900 text-xs flex items-center gap-1.5 pb-1 border-b border-amber-200/60">
                    <Edit2 className="w-4 h-4 text-amber-600" />
                    <span>खाते माहिती संपादन करा (Edit Pigmy Account)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">नियुक्त एजंट (Select Agent)</label>
                      <select 
                        className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white text-xs"
                        value={modalEditForm.pigmyAgentID}
                        onChange={(e) => setModalEditForm({ ...modalEditForm, pigmyAgentID: e.target.value })}
                      >
                        <option value="">-- एजंट निवडा --</option>
                        {agents.map(a => {
                          const aId = getAgentId(a);
                          return <option key={aId} value={aId}>{a.agentName}</option>;
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">पिग्मी योजना (Select Scheme)</label>
                      <select 
                        className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white text-xs"
                        value={modalEditForm.pigmySchemeID}
                        onChange={(e) => setModalEditForm({ ...modalEditForm, pigmySchemeID: e.target.value })}
                      >
                        <option value="">-- योजना निवडा --</option>
                        {schemes.map(s => {
                          const sId = getSchemeId(s);
                          return <option key={sId} value={sId}>{s.schemeName} ({s.interestRate}%)</option>;
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">एकूण जमा रक्कम (Balance ₹)</label>
                      <input 
                        type="number"
                        className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white text-xs font-bold text-slate-900"
                        value={modalEditForm.totalDepositedAmount}
                        onChange={(e) => setModalEditForm({ ...modalEditForm, totalDepositedAmount: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">खाते स्थिती (Status)</label>
                      <select 
                        className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white text-xs"
                        value={modalEditForm.status}
                        onChange={(e) => setModalEditForm({ ...modalEditForm, status: e.target.value })}
                      >
                        <option value="Active">Active (सक्रिय)</option>
                        <option value="Closed">Closed (बंद / परिपक्व)</option>
                        <option value="Inactive">Inactive (अक्रिय)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsEditModalMode(false)}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold"
                    >
                      रद्द करा
                    </button>
                    <button 
                      type="button" 
                      onClick={handleUpdateAccountModal}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-1 shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>माहिती अपडेट करा</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">पिग्मी योजना (Scheme):</span>
                    <span className="font-bold text-slate-800">
                      {selectedAccountModal.pigmyScheme ? `${selectedAccountModal.pigmyScheme.schemeName} (${selectedAccountModal.pigmyScheme.interestRate}%)` : '-'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">नियुक्त एजंट (Agent):</span>
                    <span className="font-bold text-primary">
                      👤 {selectedAccountModal.pigmyAgent ? `${selectedAccountModal.pigmyAgent.agentName} (${selectedAccountModal.pigmyAgent.mobileNo})` : '-'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">एकूण जमा रक्कम (Total Deposited):</span>
                    <span className="font-extrabold text-emerald-700 text-sm font-mono">
                      ₹ {(selectedAccountModal.totalDepositedAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">खाते स्थिती (Status):</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      selectedAccountModal.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}>
                      {selectedAccountModal.status || 'Active'}
                    </span>
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => handleDeleteAccount(selectedAccountModal)}
                className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-xl font-bold transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>खाते डिलीट करा</span>
              </button>

              <div className="flex items-center gap-2">
                {!isEditModalMode && (
                  <button
                    onClick={() => setIsEditModalMode(true)}
                    className="px-4 py-1.5 bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-200 rounded-xl font-bold transition flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>माहिती संपादित करा</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedAccountModal(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition"
                >
                  बंद करा (Close)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS CREATED ACCOUNT MODAL */}
      {createdAccountResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-emerald-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-7 h-7" />
                <div>
                  <h3 className="font-bold text-base">पिग्मी खाते यशस्वीरीत्या उघडले!</h3>
                  <p className="text-xs text-emerald-100">Pigmy Account Created Successfully</p>
                </div>
              </div>
              <button 
                onClick={() => setCreatedAccountResult(null)}
                className="p-1 rounded-full hover:bg-white/10 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 bg-slate-50 text-xs">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
                <div className="text-center pb-3 border-b border-slate-100">
                  <span className="text-slate-500 block text-[11px]">नवीन पिग्मी खाते क्रमांक</span>
                  <span className="text-xl font-extrabold text-primary font-mono tracking-wider bg-primary/10 border border-primary/20 px-3 py-1 rounded-xl inline-block mt-1">
                    {createdAccountResult.accountNo}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">खातेदाराचे नाव:</span>
                  <span className="font-bold text-slate-900">{createdAccountResult.customerName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">पिग्मी योजना:</span>
                  <span className="font-bold text-slate-800">{createdAccountResult.schemeName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">खाते उघडल्याची तारीख:</span>
                  <span className="font-semibold text-slate-800 font-mono">{formatDateToDDMMYYYY(createdAccountResult.openingDate)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">परिपक्वता तारीख (Maturity):</span>
                  <span className="font-bold text-emerald-800 font-mono">{formatDateToDDMMYYYY(createdAccountResult.maturityDate)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>प्रिंट करा</span>
              </button>
              <button
                onClick={() => setCreatedAccountResult(null)}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-sm"
              >
                ओके (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
