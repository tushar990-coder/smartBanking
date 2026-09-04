import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Plus, 
  List, 
  Save, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Printer, 
  Search, 
  Eye, 
  Key, 
  Box, 
  DollarSign, 
  FileText, 
  ShieldCheck, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  CreditCard 
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';

interface Member extends MemberOption {
  memberNo?: string;
  phoneNo?: string;
  address?: string;
  aadharCardNo?: string;
}

interface LockerOption {
  lockerID: number;
  cabinetNo: string;
  lockerNo: string;
  keyNo: string;
  typeName: string;
  annualRent: number;
  securityDeposit: number;
  status: string;
}

interface SavingAccount {
  accountID: number;
  accountNumber: string;
  memberID: number;
  currentBalance: number;
}

interface AllotmentRecord {
  allotmentID: number;
  branchID: number;
  lockerAccountNo: string;
  lockerID: number;
  lockerNo: string;
  cabinetNo: string;
  keyNo: string;
  typeName: string;
  memberID: number;
  memberNo: string;
  memberName: string;
  memberPhone: string;
  memberAddress: string;
  jointMember1_ID?: number;
  jointMember1_Name?: string;
  jointMember2_ID?: number;
  jointMember2_Name?: string;
  operatingInstruction: string;
  allotmentDate: string;
  rentStartDate: string;
  expiryDate: string;
  annualRent: number;
  securityDepositAmount: number;
  advanceRentPaid: number;
  linkedSavingAccountID?: number;
  linkedSavingAccountNo?: string;
  isAutoDebitEnabled: boolean;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineeAge?: number;
  nomineeAadhaar?: string;
  status: string; // Active, Surrendered, BreakOpen
  isOverdue: boolean;
  daysRemaining: number;
  totalVisitsCount: number;
}

interface LockerAllotmentMasterProps {
  initialLockerId?: number;
}

const LockerAllotmentMaster: React.FC<LockerAllotmentMasterProps> = ({ initialLockerId }) => {
  const [activeTab, setActiveTab] = useState<'new' | 'list'>('new');
  const [allotments, setAllotments] = useState<AllotmentRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [availableLockers, setAvailableLockers] = useState<LockerOption[]>([]);
  const [savingAccounts, setSavingAccounts] = useState<SavingAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');

  // Print & Details Modal
  const [printAllotment, setPrintAllotment] = useState<AllotmentRecord | null>(null);
  const [viewAllotment, setViewAllotment] = useState<AllotmentRecord | null>(null);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    branchID: 1,
    lockerID: initialLockerId ? initialLockerId.toString() : '',
    memberID: '',
    jointMember1_ID: '',
    jointMember2_ID: '',
    operatingInstruction: 'Self',
    allotmentDate: new Date().toISOString().split('T')[0],
    rentStartDate: new Date().toISOString().split('T')[0],
    annualRent: '0',
    securityDepositAmount: '0',
    advanceRentPaid: '0',
    linkedSavingAccountID: '',
    isAutoDebitEnabled: false,
    nomineeName: '',
    nomineeRelation: 'पती/पत्नी (Spouse)',
    nomineeAge: '',
    nomineeAadhaar: '',
    nomineeAddress: '',
    remarks: ''
  });

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchSanstha = async () => {
    try {
      const res = await fetch('/api/SansthaDetails');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setSansthaDetail(data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllotments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/LockerAllotments');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAllotments(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/Members');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setMembers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLockers = async () => {
    try {
      const res = await fetch('/api/Lockers?status=Available');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAvailableLockers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSavingAccounts = async (mId?: string) => {
    try {
      const res = await fetch('/api/SavingAccountMaster');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setSavingAccounts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSanstha();
    fetchAllotments();
    fetchMembers();
    fetchLockers();
    fetchSavingAccounts();
  }, []);

  // When initialLockerId changes or locker is selected, auto-fill Rent and Deposit
  useEffect(() => {
    if (formData.lockerID) {
      const selected = availableLockers.find(l => l.lockerID.toString() === formData.lockerID.toString());
      if (selected) {
        setFormData(prev => ({
          ...prev,
          annualRent: selected.annualRent?.toString() || '0',
          securityDepositAmount: selected.securityDeposit?.toString() || '0',
          advanceRentPaid: selected.annualRent?.toString() || '0'
        }));
      }
    }
  }, [formData.lockerID, availableLockers]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string; value: string | number; type?: string } }
  ) => {
    const target = e.target as any;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setFormData(prev => ({
      ...prev,
      [target.name]: value
    }));
  };

  const handleReset = () => {
    setFormData({
      branchID: 1,
      lockerID: '',
      memberID: '',
      jointMember1_ID: '',
      jointMember2_ID: '',
      operatingInstruction: 'Self',
      allotmentDate: new Date().toISOString().split('T')[0],
      rentStartDate: new Date().toISOString().split('T')[0],
      annualRent: '0',
      securityDepositAmount: '0',
      advanceRentPaid: '0',
      linkedSavingAccountID: '',
      isAutoDebitEnabled: false,
      nomineeName: '',
      nomineeRelation: 'पती/पत्नी (Spouse)',
      nomineeAge: '',
      nomineeAadhaar: '',
      nomineeAddress: '',
      remarks: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lockerID) {
      showMsg('कृपया उपलब्ध लॉकर निवडा.', 'error');
      return;
    }
    if (!formData.memberID) {
      showMsg('कृपया मुख्य सभासद निवडा.', 'error');
      return;
    }

    const payload = {
      branchID: Number(formData.branchID) || 1,
      lockerID: parseInt(formData.lockerID),
      memberID: parseInt(formData.memberID),
      jointMember1_ID: formData.jointMember1_ID ? parseInt(formData.jointMember1_ID) : null,
      jointMember2_ID: formData.jointMember2_ID ? parseInt(formData.jointMember2_ID) : null,
      operatingInstruction: formData.operatingInstruction,
      allotmentDate: formData.allotmentDate,
      rentStartDate: formData.rentStartDate,
      annualRent: parseFloat(formData.annualRent) || 0,
      securityDepositAmount: parseFloat(formData.securityDepositAmount) || 0,
      advanceRentPaid: parseFloat(formData.advanceRentPaid) || 0,
      linkedSavingAccountID: formData.linkedSavingAccountID ? parseInt(formData.linkedSavingAccountID) : null,
      isAutoDebitEnabled: formData.isAutoDebitEnabled,
      nomineeName: formData.nomineeName.trim(),
      nomineeRelation: formData.nomineeRelation,
      nomineeAge: formData.nomineeAge ? parseInt(formData.nomineeAge) : null,
      nomineeAadhaar: formData.nomineeAadhaar.trim(),
      nomineeAddress: formData.nomineeAddress.trim(),
      remarks: formData.remarks
    };

    try {
      const res = await fetch('/api/LockerAllotments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        showMsg(data.message || 'लॉकर यशस्वीरीत्या वाटप करण्यात आला!');
        handleReset();
        fetchLockers();
        fetchAllotments();
        setActiveTab('list');
      } else {
        const data = await res.json();
        showMsg(data.message || 'त्रुटी आली.', 'error');
      }
    } catch (err) {
      console.error(err);
      showMsg('सर्व्हर एरर आली.', 'error');
    }
  };

  // Safe arrays
  const safeMembers = Array.isArray(members) ? members : [];
  const safeLockers = Array.isArray(availableLockers) ? availableLockers : [];
  const safeSavings = Array.isArray(savingAccounts) ? savingAccounts : [];
  const safeAllotments = Array.isArray(allotments) ? allotments : [];

  // Dropdown Options
  const memberOptions = [
    { value: '', label: '-- सभासद निवडा --' },
    ...safeMembers.map(m => ({
      value: m.memberID.toString(),
      label: `${m.memberNo} - ${m.firstName} ${m.lastName} ${m.phoneNo ? `(${m.phoneNo})` : ''}`
    }))
  ];

  const lockerDropdownOptions = [
    { value: '', label: '-- उपलब्ध लॉकर निवडा --' },
    ...safeLockers.map(l => ({
      value: l.lockerID.toString(),
      label: `कपाट: ${l.cabinetNo} | लॉकर क्र.: ${l.lockerNo} (${l.typeName}) - भाडे ₹${l.annualRent}`
    }))
  ];

  // Member's linked saving accounts
  const memberSavingAccounts = safeSavings.filter(s => 
    formData.memberID && s.memberID?.toString() === formData.memberID.toString()
  );

  const savingAccountOptions = [
    { value: '', label: '-- बचत खाते निवडा (ऐच्छिक) --' },
    ...memberSavingAccounts.map(s => ({
      value: s.accountID.toString(),
      label: `खाते क्र.: ${s.accountNumber} (शिल्लक: ₹${s.currentBalance})`
    }))
  ];

  // Filtered Allotments
  const filteredAllotments = safeAllotments.filter(a => {
    const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || 
      (a.lockerAccountNo && a.lockerAccountNo.toLowerCase().includes(term)) ||
      (a.lockerNo && a.lockerNo.toLowerCase().includes(term)) ||
      (a.memberName && a.memberName.toLowerCase().includes(term)) ||
      (a.memberNo && a.memberNo.toLowerCase().includes(term));

    return matchesStatus && matchesSearch;
  });

  const inputClass = "w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white";
  const labelClass = "block text-[11px] font-bold text-slate-700 mb-0.5";

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg shadow-xs border border-slate-200 gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
            <UserCheck size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">लॉकर वाटप व खाते नोंदणी (Locker Allotment)</h1>
            <p className="text-xs text-slate-500">सभासदास नवीन लॉकर वाटप, सह-धारक, वारसदार व अनामत पावती</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'new' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus size={14} /> नवीन वाटप
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'list' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List size={14} /> वाटप यादी ({allotments.length})
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-2.5 rounded-md text-xs font-semibold flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tab 1: New Allotment Form */}
      {activeTab === 'new' && (
        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Step 1: Locker Selection */}
            <div className="bg-emerald-50/40 p-3 rounded-lg border border-emerald-200">
              <h2 className="text-xs font-bold text-emerald-950 mb-2 flex items-center gap-1.5">
                <Box size={15} className="text-emerald-700" /> १. लॉकर व कपाट निवड (Locker Selection)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className={labelClass}>उपलब्ध लॉकर निवडा *</label>
                  <SearchableSelect
                    name="lockerID"
                    value={formData.lockerID}
                    onChange={handleChange}
                    options={lockerDropdownOptions}
                    placeholder="-- कपाट किंवा लॉकर क्रमांक शोधा --"
                  />
                </div>
                <div>
                  <label className={labelClass}>वाटप दिनांक (Allotment Date) *</label>
                  <input
                    type="date"
                    name="allotmentDate"
                    value={formData.allotmentDate}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Member & Joint Holders */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <h2 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <User size={15} className="text-blue-600" /> २. सभासद व सह-धारक तपशील (Customer & Joint Holders)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>मुख्य सभासद / खातेदार *</label>
                  <MemberSearchSelect
                    members={safeMembers}
                    value={formData.memberID ? Number(formData.memberID) : ''}
                    onChange={(val) => handleChange({ target: { name: 'memberID', value: val ? String(val) : '' } })}
                    placeholder="-- सभासद नाव, कोड किंवा मोबाईलने शोधा --"
                  />
                </div>
                <div>
                  <label className={labelClass}>सह-धारक १ (Joint Holder 1 - ऐच्छिक)</label>
                  <MemberSearchSelect
                    members={safeMembers.filter(m => m.memberID.toString() !== formData.memberID)}
                    value={formData.jointMember1_ID ? Number(formData.jointMember1_ID) : ''}
                    onChange={(val) => handleChange({ target: { name: 'jointMember1_ID', value: val ? String(val) : '' } })}
                    placeholder="-- सह-धारक १ शोधा --"
                  />
                </div>
                <div>
                  <label className={labelClass}>सह-धारक २ (Joint Holder 2 - ऐच्छिक)</label>
                  <MemberSearchSelect
                    members={safeMembers.filter(m => m.memberID.toString() !== formData.memberID && m.memberID.toString() !== formData.jointMember1_ID)}
                    value={formData.jointMember2_ID ? Number(formData.jointMember2_ID) : ''}
                    onChange={(val) => handleChange({ target: { name: 'jointMember2_ID', value: val ? String(val) : '' } })}
                    placeholder="-- सह-धारक २ शोधा --"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2.5">
                <div>
                  <label className={labelClass}>चालवण्याची पद्धत (Operating Instruction) *</label>
                  <select
                    name="operatingInstruction"
                    value={formData.operatingInstruction}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="Self">स्वतः (Self Only)</option>
                    <option value="EitherOrSurvivor">दोघांपैकी एकाने (Either or Survivor)</option>
                    <option value="Jointly">सर्व धारकांनी एकत्रित (Jointly)</option>
                    <option value="AnyOne">कोणीही एकाने (Any One)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>भाडे सुरू दिनांक (Rent Start Date) *</label>
                  <input
                    type="date"
                    name="rentStartDate"
                    value={formData.rentStartDate}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>लिंक्ड बचत खाते (Auto-Debit Savings A/c)</label>
                  <SearchableSelect
                    name="linkedSavingAccountID"
                    value={formData.linkedSavingAccountID}
                    onChange={handleChange}
                    options={savingAccountOptions}
                    placeholder="-- बचत खाते निवडा --"
                  />
                </div>
              </div>

              <div className="mt-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isAutoDebitEnabled"
                    checked={formData.isAutoDebitEnabled}
                    onChange={handleChange}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>वार्षिक भाडे देय तारखेला बचत खात्यातून आपोआप कट करा (Enable Auto-Debit for Annual Rent)</span>
                </label>
              </div>
            </div>

            {/* Step 3: Nominee Details */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <h2 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-purple-600" /> ३. वारसदार / नॉमिनी माहिती (Nominee Details)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelClass}>वारसदाराचे नाव (Nominee Name)</label>
                  <input
                    type="text"
                    name="nomineeName"
                    value={formData.nomineeName}
                    onChange={handleChange}
                    placeholder="वारसदाराचे पूर्ण नाव"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>नाते (Relation)</label>
                  <select
                    name="nomineeRelation"
                    value={formData.nomineeRelation}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="पती/पत्नी (Spouse)">पती/पत्नी (Spouse)</option>
                    <option value="मुलगा (Son)">मुलगा (Son)</option>
                    <option value="मुलगी (Daughter)">मुलगी (Daughter)</option>
                    <option value="वडील (Father)">वडील (Father)</option>
                    <option value="आई (Mother)">आई (Mother)</option>
                    <option value="भाऊ (Brother)">भाऊ (Brother)</option>
                    <option value="इतर (Other)">इतर (Other)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>वय (Age)</label>
                  <input
                    type="number"
                    name="nomineeAge"
                    value={formData.nomineeAge}
                    onChange={handleChange}
                    placeholder="उदा. 25"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>आधार क्रमांक (Aadhaar No)</label>
                  <input
                    type="text"
                    name="nomineeAadhaar"
                    value={formData.nomineeAadhaar}
                    onChange={handleChange}
                    placeholder="12 अंकी आधार क्र."
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Financial Calculation */}
            <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200">
              <h2 className="text-xs font-bold text-amber-950 mb-2 flex items-center gap-1.5">
                <DollarSign size={15} className="text-amber-700" /> ४. देय रक्कम तपशील व पावती (Payment & Fees Summary)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>अनामत रक्कम (Caution Deposit ₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="securityDepositAmount"
                    value={formData.securityDepositAmount}
                    onChange={handleChange}
                    className={`${inputClass} font-bold text-blue-700`}
                  />
                </div>
                <div>
                  <label className={labelClass}>१ वर्षाचे अग्रीम भाडे (Advance 1 Year Rent ₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="advanceRentPaid"
                    value={formData.advanceRentPaid}
                    onChange={handleChange}
                    className={`${inputClass} font-bold text-emerald-700`}
                  />
                </div>
                <div>
                  <label className={labelClass}>एकूण स्वीकारलेली रक्कम (Total Collected ₹)</label>
                  <div className="text-sm font-black text-slate-800 bg-white p-1.5 rounded-md border border-amber-300">
                    ₹{(parseFloat(formData.securityDepositAmount || '0') + parseFloat(formData.advanceRentPaid || '0')).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit & Reset */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1"
              >
                <RotateCcw size={13} /> फॉर्म रिसेट
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs flex items-center gap-1.5"
              >
                <Save size={14} /> लॉकर वाटप करा व पावती जनरेट करा
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Allotments List */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {/* Search & Filter Toolbar */}
          <div className="bg-white p-2.5 rounded-lg shadow-xs border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-2">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="खाते क्र. / लॉकर क्र. / सभासद शोधा..."
                  className="w-full text-xs pl-7 pr-2.5 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold text-slate-700"
              >
                <option value="All">सर्व स्थिती (All Status)</option>
                <option value="Active">सक्रिय (Active)</option>
                <option value="Surrendered">समर्पित / बंद (Surrendered)</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">
              एकूण नोंदी: <strong className="text-slate-800">{filteredAllotments.length}</strong>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2 px-3">खाते क्रमांक</th>
                    <th className="py-2 px-3">कपाट व लॉकर क्र.</th>
                    <th className="py-2 px-3">सभासद नाव</th>
                    <th className="py-2 px-3">पद्धत</th>
                    <th className="py-2 px-3">वाटप दिनांक</th>
                    <th className="py-2 px-3">मुदत समाप्ती</th>
                    <th className="py-2 px-3 text-right">डिपॉझिट</th>
                    <th className="py-2 px-3 text-center">व्हिजिट्स</th>
                    <th className="py-2 px-3 text-center">स्थिती</th>
                    <th className="py-2 px-3 text-center">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAllotments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-slate-400">
                        कोणतेही लॉकर वाटप रेकॉर्ड सापडले नाही.
                      </td>
                    </tr>
                  ) : (
                    filteredAllotments.map((a) => (
                      <tr key={a.allotmentID} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-emerald-800">{a.lockerAccountNo}</td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-slate-800">{a.cabinetNo} - {a.lockerNo}</span>
                          <span className="text-[10px] text-slate-500 block">चावी: {a.keyNo} ({a.typeName})</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-slate-800 block">{a.memberName}</span>
                          <span className="text-[10px] text-slate-500">सभासद क्र.: {a.memberNo}</span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-600">{a.operatingInstruction}</td>
                        <td className="py-2 px-3 text-slate-600">{new Date(a.allotmentDate).toLocaleDateString('en-GB')}</td>
                        <td className="py-2 px-3">
                          <span className={`font-bold ${a.isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                            {new Date(a.expiryDate).toLocaleDateString('en-GB')}
                          </span>
                          {a.isOverdue && (
                            <span className="text-[9px] bg-rose-100 text-rose-800 px-1 py-0.2 rounded font-bold block w-fit">
                              थकबाकी
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-blue-700">
                          ₹{a.securityDepositAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-purple-700">{a.totalVisitsCount}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            a.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {a.status === 'Active' ? 'सक्रिय' : 'बंद / समर्पित'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => setViewAllotment(a)}
                              title="तपशील पहा"
                              className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => setPrintAllotment(a)}
                              title="करारपत्र / पावती प्रिंट करा"
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Printer size={13} />
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
        </div>
      )}

      {/* Print Allotment Agreement & Receipt Modal */}
      {printAllotment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center print:hidden">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Printer size={16} className="text-emerald-400" /> लॉकर वाटप पावती व करारपत्र (Allotment Certificate)
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded flex items-center gap-1"
                >
                  <Printer size={13} /> प्रिंट
                </button>
                <button onClick={() => setPrintAllotment(null)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Certificate */}
            <div className="p-6 space-y-4 text-slate-800 font-serif">
              <div className="border border-gray-900 p-3 relative text-center mb-3">
                <div className="flex justify-between items-center text-[12px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2 font-sans">
                  <div><span>रजि. नं. - </span><span className="font-mono">{sansthaDetail?.registrationNo || '-'}</span></div>
                  <div><span>रजि. दि. - </span><span className="font-mono">{sansthaDetail?.registrationDate ? new Date(sansthaDetail.registrationDate).toLocaleDateString('en-GB') : '-'}</span></div>
                </div>
                <h2 className="text-lg font-bold uppercase tracking-wider text-gray-950">{sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}</h2>
                <p className="text-xs text-slate-600 font-sans mt-0.5">{sansthaDetail?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}</p>
                <p className="text-xs text-slate-600 font-bold mt-1">मुख्य शाखा | लॉकर विभाग (Locker Custody Department)</p>
                <h3 className="text-sm font-black mt-2 underline uppercase">लॉकर वाटप पावती व करारपत्र (Locker Agreement)</h3>
              </div>

              <div className="flex justify-between text-xs font-sans">
                <div>
                  <p><strong>खाते क्रमांक:</strong> <span className="font-mono font-bold text-emerald-700">{printAllotment.lockerAccountNo}</span></p>
                  <p><strong>वाटप दिनांक:</strong> {new Date(printAllotment.allotmentDate).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="text-right">
                  <p><strong>कपाट क्रमांक:</strong> {printAllotment.cabinetNo}</p>
                  <p><strong>लॉकर क्रमांक:</strong> <span className="font-bold">{printAllotment.lockerNo}</span> (चावी: {printAllotment.keyNo})</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5 text-xs font-sans">
                <p><strong>मुख्य धारक:</strong> {printAllotment.memberName} (सभासद क्र. {printAllotment.memberNo})</p>
                {printAllotment.jointMember1_Name && <p><strong>सह-धारक १:</strong> {printAllotment.jointMember1_Name}</p>}
                {printAllotment.jointMember2_Name && <p><strong>सह-धारक २:</strong> {printAllotment.jointMember2_Name}</p>}
                <p><strong>चालवण्याची पद्धत:</strong> {printAllotment.operatingInstruction}</p>
                <p><strong>वारसदार (Nominee):</strong> {printAllotment.nomineeName || '-'} ({printAllotment.nomineeRelation || '-'})</p>
              </div>

              <div className="border border-slate-300 rounded overflow-hidden text-xs font-sans">
                <table className="w-full">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2 text-left">तपशील</th>
                      <th className="p-2 text-right">रक्कम (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2">अनामत रक्कम (Locker Caution / Security Deposit)</td>
                      <td className="p-2 text-right font-bold">₹{printAllotment.securityDepositAmount?.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">अग्रीम वार्षिक भाडे (Advance Annual Rent - 1 Year)</td>
                      <td className="p-2 text-right font-bold">₹{printAllotment.annualRent?.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold text-slate-900">
                      <td className="p-2">एकूण जमा रक्कम (Total Amount Received)</td>
                      <td className="p-2 text-right text-emerald-800 font-black">
                        ₹{(printAllotment.securityDepositAmount + printAllotment.annualRent).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pt-6 flex justify-between text-xs text-center font-sans">
                <div>
                  <div className="h-10"></div>
                  <p className="border-t border-slate-400 pt-1 font-bold">खातेदाराची सही</p>
                </div>
                <div>
                  <div className="h-10"></div>
                  <p className="border-t border-slate-400 pt-1 font-bold">लॉकर कस्टोडियन / मॅनेजर</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LockerAllotmentMaster;
