import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  UserCheck,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  User,
  Info,
  CheckCircle,
  XCircle,
  Search,
  Printer,
  Trash2,
  PlusCircle,
  List,
  Save,
  CreditCard,
  Building,
  ShieldCheck,
  Sparkles,
  Users,
  UserPlus,
  Bookmark,
  RefreshCw
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import CustomerSearchSelect from './common/CustomerSearchSelect';

interface Member {
  customerID?: number;
  memberID: number;
  cifNo?: string;
  memberCode?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  mobileNo?: string;
}

interface RdScheme {
  rdSchemeID: number;
  schemeName: string;
  schemeCode: string;
  interestRate: number;
  durationMonths: number;
  installmentAmount: number;
  minimumInstallment?: number;
  maximumInstallment?: number;
  interestMethod?: string;
}

interface Branch {
  branchID: number;
  branchName: string;
}

interface PigmyAgent {
  agentID: number;
  agentName: string;
  agentCode: string;
}

interface SavingAccountItem {
  savingAccountID: number;
  accountNumber: string;
  balance: number;
}

interface RdAccountItem {
  rdAccountID: number;
  accountNo: string;
  memberName?: string;
  memberCode?: string;
  schemeName?: string;
  installmentAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  accountType?: string;
  jointMemberName?: string;
  paymentMode?: string;
  maturityInstruction?: string;
  passbookNo?: string;
  nomineeName?: string;
}

export default function RdAccountOpening() {
  const [view, setView] = useState<'form' | 'list'>('form');
  const [members, setMembers] = useState<Member[]>([]);
  const [schemes, setSchemes] = useState<RdScheme[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [agents, setAgents] = useState<PigmyAgent[]>([]);
  const [savingAccounts, setSavingAccounts] = useState<SavingAccountItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Next account number preview
  const [nextAccountNo, setNextAccountNo] = useState('');
  const [loadingAccountNo, setLoadingAccountNo] = useState(false);

  // List view state
  const [rdList, setRdList] = useState<RdAccountItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [listError, setListError] = useState('');
  const [listSuccess, setListSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; accountNo: string } | null>(null);

  // Print modal state
  const [printAccount, setPrintAccount] = useState<RdAccountItem | null>(null);

  const [formData, setFormData] = useState({
    branchID: 1,
    memberID: '',
    rdSchemeID: '',
    accountType: 'Single', // Single, Joint, Minor
    jointMemberID: '',
    guardianName: '',
    guardianRelation: '',
    openingDate: new Date().toISOString().split('T')[0],
    installmentAmount: 0,
    durationMonths: 12,
    interestRate: 8.0,
    maturityDate: '',
    maturityAmount: 0,
    paymentMode: 'Cash', // Cash, AutoDebit_Saving
    savingAccountID: '',
    maturityInstruction: 'Cash_Payout', // Credit_Saving, Cash_Payout, Transfer_FD
    agentID: '',
    passbookNo: '',
    nomineeName: '',
    nomineeRelation: '',
    remarks: 'नवीन आवर्ती ठेव खाते उघडले',
  });

  const selectedMember = members.find((m) => m.memberID.toString() === formData.memberID);

  const fetchNextAccountNo = async (branchId: number) => {
    setLoadingAccountNo(true);
    try {
      const res = await axios.get(`/api/RdAccounts/next-account-no?branchId=${branchId}`);
      setNextAccountNo(res.data);
    } catch (err) {
      console.error('Error fetching next account number', err);
      setNextAccountNo('---');
    } finally {
      setLoadingAccountNo(false);
    }
  };

  const fetchMemberSavingAccounts = async (memberId: string) => {
    if (!memberId) {
      setSavingAccounts([]);
      return;
    }
    try {
      const res = await axios.get(`/api/SavingAccountMasters?memberId=${memberId}`);
      const dataList = Array.isArray(res.data) ? res.data : [];
      setSavingAccounts(dataList);
      if (dataList.length > 0) {
        setFormData((prev) => ({ ...prev, savingAccountID: (dataList[0].savingAccountID ?? '').toString() }));
      }
    } catch (err) {
      console.error('Error fetching saving accounts', err);
      setSavingAccounts([]);
    }
  };

  const fetchData = async () => {
    try {
      const [mRes, sRes, bRes, agRes] = await axios.all([
        axios.get('/api/Customers'),
        axios.get('/api/RdSchemes'),
        axios.get('/api/Branches'),
        axios.get('/api/PigmyAgents'),
      ]);
      const mList = Array.isArray(mRes.data) ? mRes.data : [];
      const sList = Array.isArray(sRes.data) ? sRes.data : [];
      const bList = Array.isArray(bRes.data) ? bRes.data : [];
      const agList = Array.isArray(agRes.data) ? agRes.data : [];

      setMembers(mList);
      setSchemes(sList.filter((s: any) => s && s.isActive));
      setBranches(bList);
      setAgents(agList);

      const defaultBranch = bList.length > 0 ? bList[0].branchID : 1;
      fetchNextAccountNo(defaultBranch);

      const params = new URLSearchParams(window.location.search);
      const memberIdStr = params.get('memberId');
      if (memberIdStr && mList.length > 0) {
        const mId = parseInt(memberIdStr, 10);
        const matchedMember = mList.find((m: any) => (m.customerID || m.memberID) === mId);
        if (matchedMember) {
          setFormData((prev) => ({
            ...prev,
            memberID: mId.toString()
          }));
          fetchMemberSavingAccounts(mId.toString());
        }
      }
    } catch (err) {
      console.error('Error loading initial data', err);
    }
  };

  const fetchRdList = async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await axios.get('/api/RdAccounts');
      setRdList(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Error fetching RD accounts list', err);
      setListError('आरडी खात्यांची यादी लोड करताना त्रुटी आली.');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (view === 'list') {
      fetchRdList();
    }
  }, [view]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'branchID') {
      const bId = parseInt(value, 10) || 1;
      fetchNextAccountNo(bId);
    }

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: e.target.type === 'number' ? (value === '' ? '' : value) : value,
      };

      if (name === 'openingDate' && prev.durationMonths > 0) {
        const opening = new Date(value);
        if (!isNaN(opening.getTime())) {
          opening.setMonth(opening.getMonth() + prev.durationMonths);
          updated.maturityDate = opening.toISOString().split('T')[0];
        }
      }
      return updated;
    });
  };

  const handleMemberSelect = (val: any) => {
    const mIdStr = val?.target?.value ?? val;
    setFormData((prev) => ({ ...prev, memberID: mIdStr }));
    fetchMemberSavingAccounts(mIdStr);
  };

  const handleSchemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const schemeId = parseInt(e.target.value, 10);
    const selected = schemes.find((s) => s.rdSchemeID === schemeId);
    if (selected) {
      setFormData((prev) => {
        const inst = selected.installmentAmount;
        const dur = selected.durationMonths;
        const r = selected.interestRate;

        // Auto Maturity Date
        const opening = new Date(prev.openingDate);
        opening.setMonth(opening.getMonth() + dur);
        const maturityDateStr = opening.toISOString().split('T')[0];

        // IBA Standard Compound maturity formula
        const p = inst;
        const n = dur;
        let totalMat = 0;
        for (let k = 1; k <= n; k++) {
          const monthsInBank = n - k + 1;
          const factor = Math.pow(1.0 + (r / 400.0), monthsInBank / 3.0);
          totalMat += p * factor;
        }
        const expectedMaturity = Math.round(totalMat);

        return {
          ...prev,
          rdSchemeID: schemeId.toString(),
          installmentAmount: inst,
          durationMonths: dur,
          interestRate: r,
          maturityDate: maturityDateStr,
          maturityAmount: expectedMaturity,
        };
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        rdSchemeID: '',
        installmentAmount: 0,
        interestRate: 8.0,
        maturityDate: '',
        maturityAmount: 0,
      }));
    }
  };

  const resetForm = () => {
    setFormData({
      branchID: formData.branchID || 1,
      memberID: '',
      rdSchemeID: '',
      accountType: 'Single',
      jointMemberID: '',
      guardianName: '',
      guardianRelation: '',
      openingDate: new Date().toISOString().split('T')[0],
      installmentAmount: 0,
      durationMonths: 12,
      interestRate: 8.0,
      maturityDate: '',
      maturityAmount: 0,
      paymentMode: 'Cash',
      savingAccountID: '',
      maturityInstruction: 'Cash_Payout',
      agentID: '',
      passbookNo: '',
      nomineeName: '',
      nomineeRelation: '',
      remarks: 'नवीन आवर्ती ठेव खाते उघडले',
    });
    setError('');
    setSuccess('');
    setSavingAccounts([]);
    fetchNextAccountNo(formData.branchID || 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberID) {
      setError('कृपया सभासद निवडा.');
      return;
    }
    if (!formData.rdSchemeID) {
      setError('कृपया आरडी ठेव योजना निवडा.');
      return;
    }
    if (formData.accountType === 'Joint' && !formData.jointMemberID) {
      setError('कृपया संयुक्त खातेदाराची निवड करा.');
      return;
    }
    if (formData.paymentMode === 'AutoDebit_Saving' && !formData.savingAccountID) {
      setError('ऑटो-डेबिटसाठी कृपया सभासदाचे बचत खाते निवडा.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...formData,
        accountNo: 'AUTO',
        branchID: parseInt(formData.branchID as any, 10) || 1,
        customerID: parseInt(formData.memberID, 10),
        memberID: parseInt(formData.memberID, 10),
        rdSchemeID: parseInt(formData.rdSchemeID, 10),
        jointMemberID: formData.accountType === 'Joint' && formData.jointMemberID ? parseInt(formData.jointMemberID, 10) : null,
        savingAccountID: formData.paymentMode === 'AutoDebit_Saving' && formData.savingAccountID ? parseInt(formData.savingAccountID, 10) : null,
        agentID: formData.agentID ? parseInt(formData.agentID, 10) : null,
        installmentAmount: parseFloat(formData.installmentAmount as any) || 0,
        durationMonths: parseInt(formData.durationMonths as any, 10) || 12,
        interestRate: parseFloat(formData.interestRate as any) || 0,
        maturityAmount: parseFloat(formData.maturityAmount as any) || 0,
      };
      const res = await axios.post('/api/RdAccounts', payload);
      setSuccess(`✅ नवीन आरडी खाते यशस्वीरीत्या सुरू झाले! खाते क्रमांक: ${res.data.accountNo}`);
      
      resetForm();
    } catch (err: any) {
      const errText = typeof err.response?.data === 'string'
        ? err.response.data
        : err.response?.data?.message || 'नवीन आरडी खाते उघडताना त्रुटी आली.';
      setError(errText);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    try {
      await axios.delete(`/api/RdAccounts/${id}`);
      setListSuccess('आरडी खाते यशस्वीरीत्या हटवण्यात आले.');
      setDeleteConfirm(null);
      fetchRdList();
    } catch (err: any) {
      setListError('खाते हटवताना त्रुटी आली.');
    }
  };

  const filteredRdList = rdList.filter((item) => {
    const accMatch = item.accountNo?.toLowerCase().includes(listSearch.toLowerCase());
    const nameMatch = item.memberName?.toLowerCase().includes(listSearch.toLowerCase());
    const codeMatch = item.memberCode?.toLowerCase().includes(listSearch.toLowerCase());
    return accMatch || nameMatch || codeMatch;
  });

  // Calculate Breakdown
  const totalPrincipalDeposited = (formData.installmentAmount || 0) * (formData.durationMonths || 0);
  const estimatedInterestEarned = Math.max(0, (formData.maturityAmount || 0) - totalPrincipalDeposited);

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full px-2 py-1 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white font-medium";

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
      {/* Outer Container Frame matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 flex flex-col mb-4">

        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
              <span>📋 नवीन आवर्ती ठेव खाते नोंदणी (New RD Account Opening Master)</span>
            </h2>
            <p className="text-[10px] text-blue-100 font-normal">नवीन आवर्ती ठेव खाते नोंदणी, हप्ता जमा आणि ऑटोमॅटिक पावती क्रमांक जनरेशन</p>
          </div>

          {/* View Switcher Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView('form')}
              className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                view === 'form' 
                  ? 'bg-white text-primary font-bold border-white' 
                  : 'bg-blue-800/60 hover:bg-blue-800 text-white border-blue-400/40'
              }`}
            >
              <span>✍️ नवीन अर्ज (New Form)</span>
            </button>

            <button
              type="button"
              onClick={() => { setView('list'); fetchRdList(); }}
              className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                view === 'list' 
                  ? 'bg-white text-primary font-bold border-white' 
                  : 'bg-blue-800/60 hover:bg-blue-800 text-white border-blue-400/40'
              }`}
            >
              <span>👁️ खाती यादी (Account List)</span>
            </button>
          </div>
        </div>

        <div className="p-3">
          {/* ==================== FORM VIEW ==================== */}
          {view === 'form' && (
        <div className="space-y-4">
          {/* Soft Light Auto Account Banner */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-2xs">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
                  आरडी खाते क्रमांक (RD Account Number)
                </span>
                {loadingAccountNo ? (
                  <span className="text-xs text-indigo-500 font-medium animate-pulse">क्रमांक तयार होत आहे...</span>
                ) : (
                  <span className="text-base font-bold text-indigo-700 font-mono tracking-wide">
                    {nextAccountNo || '---'}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-indigo-200 px-3 py-1 rounded-md text-[11px] text-indigo-800 font-medium shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>स्वयंचलित जनरेट केलेला खाते क्रमांक</span>
            </div>
          </div>

          {/* Alert Messages */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-2 text-xs">
              <XCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="flex-1 font-medium">{error}</span>
              <button onClick={() => setError('')} className="font-bold text-slate-400 hover:text-slate-600">×</button>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg flex items-center gap-2 text-xs">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="flex-1 font-bold">{success}</span>
              <button onClick={() => setSuccess('')} className="font-bold text-slate-400 hover:text-slate-600">×</button>
            </div>
          )}

          {/* Main Form Card */}
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xs border border-slate-200 divide-y divide-slate-100">
            
            {/* Section 1: Basic Info & Operating Mode */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-xs">१</span>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  प्राथमिक माहिती व खाते प्रकार (Basic Information & Mode)
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>शाखा (Branch) <span className="text-red-500">*</span></label>
                  <select name="branchID" value={formData.branchID} onChange={handleChange} className={inputClass}>
                    {(Array.isArray(branches) ? branches : []).map((b, idx) => (
                      <option key={`branch-${b.branchID ?? '0'}-${idx}`} value={b.branchID}>{b.branchName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>खातेदार निवडा (Select Customer / CIF) <span className="text-red-500">*</span></label>
                  <CustomerSearchSelect
                    customers={members}
                    value={formData.memberID ? Number(formData.memberID) : ''}
                    onChange={(val) => handleMemberSelect(val ? String(val) : '')}
                    placeholder="-- खातेदार (CIF / नाव / मोबाईलने शोधा) --"
                  />
                </div>

                <div>
                  <label className={labelClass}>खाते संचालन प्रकार (Account Mode) <span className="text-red-500">*</span></label>
                  <select name="accountType" value={formData.accountType} onChange={handleChange} className={inputClass}>
                    <option value="Single">वैयक्तिक (Single Account)</option>
                    <option value="Joint">संयुक्त (Joint Account)</option>
                    <option value="Minor">अल्पवयीन (Minor Account)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>आवर्ती ठेव योजना (RD Scheme) <span className="text-red-500">*</span></label>
                  <select name="rdSchemeID" value={formData.rdSchemeID} onChange={handleSchemeChange} className={inputClass}>
                    <option value="">--- योजना निवडा ---</option>
                    {(Array.isArray(schemes) ? schemes : []).map((s, idx) => (
                      <option key={`scheme-${s.rdSchemeID ?? '0'}-${idx}`} value={s.rdSchemeID}>
                        {s.schemeName} ({s.schemeCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditional Joint Member Selector */}
              {formData.accountType === 'Joint' && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-2">
                  <label className={labelClass}>संयुक्त खातेदार निवडा (Select Joint Member) <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    options={members
                      .filter((m) => m.memberID.toString() !== formData.memberID)
                      .map((m) => ({
                        value: m.memberID,
                        label: `${m.memberCode ? m.memberCode + ' - ' : ''}${m.firstName} ${m.lastName}`,
                      }))}
                    value={formData.jointMemberID}
                    onChange={(val: any) => setFormData((prev) => ({ ...prev, jointMemberID: val?.target?.value ?? val }))}
                    placeholder="दुसरा सभासद शोधा..."
                  />
                </div>
              )}

              {/* Conditional Minor Guardian Fields */}
              {formData.accountType === 'Minor' && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>पालकाचे नाव (Guardian Name) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="guardianName"
                      value={formData.guardianName}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="पालकाचे नाव लिहा"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>पालकाचे नाते (Guardian Relation) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="guardianRelation"
                      value={formData.guardianRelation}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="उदा. वडील, आई"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Selected Member Preview Badge */}
              {selectedMember && (
                <div className="mt-2.5 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800">
                        {selectedMember.firstName} {selectedMember.middleName} {selectedMember.lastName}
                      </span>
                      <span className="text-slate-500 text-[11px] ml-2 font-mono">
                        (कोड: <strong className="text-blue-700">{selectedMember.memberCode}</strong>
                        {selectedMember.cifNo && ` | CIF: ${selectedMember.cifNo}`})
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded text-[10px]">
                    ✓ निवडलेला सभासद
                  </span>
                </div>
              )}
            </div>

            {/* Section 2: Deposit Financials & Auto Debit Setup */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-xs">२</span>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  हप्ता व ऑटो-डेबिट तपशील (Financials & Payment Setup)
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>खाते उघडल्याची तारीख <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    name="openingDate"
                    value={formData.openingDate}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>मासिक हप्ता रक्कम (Installment ₹)</label>
                  <input
                    type="number"
                    name="installmentAmount"
                    value={formData.installmentAmount || ''}
                    readOnly
                    className="w-full text-xs font-bold border border-indigo-200 bg-indigo-50/50 rounded-lg px-3 py-2 text-indigo-900 cursor-not-allowed select-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>कालावधी (महिने)</label>
                  <input
                    type="number"
                    name="durationMonths"
                    value={formData.durationMonths || ''}
                    readOnly
                    className="w-full text-xs font-bold border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-slate-700 cursor-not-allowed select-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>वार्षिक व्याजदर (%)</label>
                  <input
                    type="number"
                    name="interestRate"
                    value={formData.interestRate || ''}
                    readOnly
                    className="w-full text-xs font-bold border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-emerald-600 cursor-not-allowed select-none"
                  />
                </div>
              </div>

              {/* CBS Payment Mode & Linked Saving Account */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className={labelClass}>हप्ता भरणा मोड (Payment Mode) <span className="text-red-500">*</span></label>
                  <select name="paymentMode" value={formData.paymentMode} onChange={handleChange} className={inputClass}>
                    <option value="Cash">रोख (Cash Payment)</option>
                    <option value="AutoDebit_Saving">बचत खात्यातून ऑटो-डेबिट (Auto-Debit from Saving)</option>
                  </select>
                </div>

                {formData.paymentMode === 'AutoDebit_Saving' && (
                  <div>
                    <label className={labelClass}>संलग्न बचत खाते (Linked Saving Account) <span className="text-red-500">*</span></label>
                    <select name="savingAccountID" value={formData.savingAccountID} onChange={handleChange} className={inputClass} required>
                      <option value="">--- बचत खाते निवडा ---</option>
                      {(Array.isArray(savingAccounts) ? savingAccounts : []).map((s, idx) => (
                        <option key={`sav-${s.savingAccountID ?? '0'}-${idx}`} value={s.savingAccountID}>
                          {s.accountNumber} (शिल्लक: ₹{(s.balance ?? 0).toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className={labelClass}>मुदतपूर्ती सूचना (Maturity Instruction) <span className="text-red-500">*</span></label>
                  <select name="maturityInstruction" value={formData.maturityInstruction} onChange={handleChange} className={inputClass}>
                    <option value="Cash_Payout">रोख भरणा करा (Cash Payout)</option>
                    <option value="Credit_Saving">बचत खात्यात जमा करा (Credit to Saving SB)</option>
                    <option value="Transfer_FD">मुदत ठेवीत रुपांतर करा (Auto-Convert to FD)</option>
                  </select>
                </div>
              </div>

              {formData.paymentMode === 'Cash' && (
                <div className="mt-2">
                  <CashLedgerReflectBadge 
                    branchId={formData.branchID} 
                    transactionType="Deposit" 
                    customTitle="हप्ता जमा होणारे रोख खाते (Cash Deposit Ledger)"
                  />
                </div>
              )}

              {/* Light Calculation Summary Box */}
              {formData.maturityAmount > 0 && (
                <div className="mt-3 bg-emerald-50/80 border border-emerald-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs shadow-2xs">
                  <div className="bg-white p-2.5 rounded border border-emerald-100">
                    <span className="text-slate-500 text-[10px] font-bold uppercase block">एकूण जमा मुद्दल:</span>
                    <strong className="text-slate-800 text-xs font-bold font-mono">
                      ₹ {totalPrincipalDeposited.toLocaleString('en-IN')}
                    </strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      ({formData.durationMonths} महिने × ₹{formData.installmentAmount?.toLocaleString('en-IN')})
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded border border-emerald-100">
                    <span className="text-slate-500 text-[10px] font-bold uppercase block">अंदाजित व्याज लाभ:</span>
                    <strong className="text-emerald-700 text-xs font-bold font-mono">
                      + ₹ {estimatedInterestEarned.toLocaleString('en-IN')}
                    </strong>
                    <span className="text-[10px] text-emerald-600 block mt-0.5">
                      व्याजदर {formData.interestRate}%
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded border border-emerald-100">
                    <span className="text-slate-500 text-[10px] font-bold uppercase block">एकूण मुदतपूर्ती रक्कम:</span>
                    <strong className="text-indigo-700 text-sm font-bold font-mono">
                      ₹ {formData.maturityAmount.toLocaleString('en-IN')}
                    </strong>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      मुदत तारीख: {formData.maturityDate}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Nominee, Agent & Passbook Serial */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-xs">३</span>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  वारसदार, एजंट व पासबुक (Nominee, Agent & Passbook)
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>वारसदार नाव (Nominee Name)</label>
                  <input
                    type="text"
                    name="nomineeName"
                    value={formData.nomineeName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="वारसदाराचे नाव लिहा"
                  />
                </div>

                <div>
                  <label className={labelClass}>वारस नाते (Nominee Relation)</label>
                  <select name="nomineeRelation" value={formData.nomineeRelation} onChange={handleChange} className={inputClass}>
                    <option value="">-- नाते निवडा --</option>
                    <option value="स्वतः">स्वतः (Self)</option>
                    <option value="पत्नी">पत्नी (Wife)</option>
                    <option value="पती">पती (Husband)</option>
                    <option value="पती/पत्नी">पती/पत्नी (Spouse)</option>
                    <option value="मुलगा">मुलगा (Son)</option>
                    <option value="मुलगी">मुलगी (Daughter)</option>
                    <option value="आई">आई (Mother)</option>
                    <option value="वडील">वडील (Father)</option>
                    <option value="भाऊ">भाऊ (Brother)</option>
                    <option value="बहीण">बहीण (Sister)</option>
                    <option value="सुन">सुन (Daughter-in-law)</option>
                    <option value="जावई">जावई (Son-in-law)</option>
                    <option value="नातू/नात">नातू / नात (Grandchild)</option>
                    <option value="इतर">इतर (Other)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>हप्ता संकलन एजंट (Agent)</label>
                  <select name="agentID" value={formData.agentID} onChange={handleChange} className={inputClass}>
                    <option value="">--- एजंट निवडा (ऐच्छिक) ---</option>
                    {(Array.isArray(agents) ? agents : []).map((a, idx) => (
                      <option key={`agent-${a.agentID ?? '0'}-${idx}`} value={a.agentID}>
                        {a.agentName} ({a.agentCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>पासबुक / प्रमाणपत्र क्र. (Passbook No)</label>
                  <input
                    type="text"
                    name="passbookNo"
                    value={formData.passbookNo}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="उदा. PB-10203"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className={labelClass}>शेरा (Remarks)</label>
                <input
                  type="text"
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Bottom Footer */}
            <div className="p-4 bg-slate-50 rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  {formData.paymentMode === 'AutoDebit_Saving'
                    ? 'पहिला हप्ता बचत खात्यातून ऑटो-डेबिट होऊन व्हाउचर सेव्ह होईल.'
                    : 'पहिला हप्ता रोख जमा होऊन स्वयंचलित पावती व्हाउचर पोस्ट होईल.'}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg transition text-xs"
                >
                  फॉर्म रीसेट करा
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'जतन होत आहे...' : 'खाते उघडा (Open Account)'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==================== LIST VIEW ==================== */}
      {view === 'list' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800">उघडलेल्या आरडी खात्यांची यादी (RD Accounts)</h2>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-full text-[10px] border border-indigo-100">
                {rdList.length}
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="खाते क्र. किंवा नाव शोधा..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {listError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span>{listError}</span>
            </div>
          )}

          {listSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{listSuccess}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3">खाते क्रमांक</th>
                  <th className="py-2.5 px-3">सभासद नाव</th>
                  <th className="py-2.5 px-3">प्रकार</th>
                  <th className="py-2.5 px-3">योजना</th>
                  <th className="py-2.5 px-3 text-right">मासिक हप्ता (₹)</th>
                  <th className="py-2.5 px-3 text-center">व्याजदर (%)</th>
                  <th className="py-2.5 px-3 text-center">मुदतपूर्ती तारीख</th>
                  <th className="py-2.5 px-3 text-right">मुदतपूर्ती रक्कम (₹)</th>
                  <th className="py-2.5 px-3 text-center">स्थिती</th>
                  <th className="py-2.5 px-3 text-center">क्रिया (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {listLoading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      लोड होत आहे...
                    </td>
                  </tr>
                ) : filteredRdList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                      कोणतेही आरडी खाते सापडले नाही.
                    </td>
                  </tr>
                ) : (
                  filteredRdList.map((item) => (
                    <tr key={item.rdAccountID} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {item.accountNo}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        <div>{item.memberName || '-'}</div>
                        {item.jointMemberName && <div className="text-[10px] text-indigo-600 font-normal">संयुक्त: {item.jointMemberName}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium border border-slate-200">
                          {item.accountType === 'Joint' ? 'संयुक्त' : item.accountType === 'Minor' ? 'अल्पवयीन' : 'वैयक्तिक'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{item.schemeName || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                        ₹{item.installmentAmount?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                        {item.interestRate}%
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium">
                        {item.maturityDate ? new Date(item.maturityDate).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        ₹{item.maturityAmount?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 ${
                          item.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {item.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setPrintAccount(item)}
                            className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded transition"
                            title="पावती प्रिंट करा"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm({ id: item.rdAccountID, accountNo: item.accountNo })}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded transition"
                            title="खाते हटवा"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">खाते हटवण्याची खात्री करा (Delete Confirm)</h3>
            <p className="text-xs text-slate-600">
              तुम्हाला नक्की आरडी खाते क्रमांक <strong className="font-mono text-indigo-700">{deleteConfirm.accountNo}</strong> हटवायचे आहे का?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs"
              >
                रद्द करा
              </button>
              <button
                onClick={() => handleDeleteAccount(deleteConfirm.id)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-xs"
              >
                होय, हटवा
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Passbook Modal */}
      {printAccount && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">आरडी खाते पावती (RD Account Certificate)</h3>
              </div>
              <button onClick={() => setPrintAccount(null)} className="text-slate-400 hover:text-slate-600 font-bold">×</button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">खाते क्रमांक:</span> <strong className="font-mono text-indigo-700">{printAccount.accountNo}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">सभासद नाव:</span> <strong className="text-slate-800">{printAccount.memberName}</strong></div>
              {printAccount.jointMemberName && <div className="flex justify-between"><span className="text-slate-500">संयुक्त खातेदार:</span> <strong className="text-indigo-600">{printAccount.jointMemberName}</strong></div>}
              <div className="flex justify-between"><span className="text-slate-500">योजना:</span> <span>{printAccount.schemeName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">मासिक हप्ता:</span> <strong className="text-indigo-700">₹{printAccount.installmentAmount?.toLocaleString('en-IN')}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">व्याजदर:</span> <strong className="text-emerald-600">{printAccount.interestRate}%</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">मुदतपूर्ती तारीख:</span> <span>{printAccount.maturityDate ? new Date(printAccount.maturityDate).toLocaleDateString('en-IN') : '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">मुदतपूर्ती रक्कम:</span> <strong className="text-emerald-700">₹{printAccount.maturityAmount?.toLocaleString('en-IN')}</strong></div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPrintAccount(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs"
              >
                बंद करा
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>प्रिंट काढा (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
