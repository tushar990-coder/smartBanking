import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  UserCheck,
  Search,
  BookOpen,
  ShieldCheck,
  RotateCcw,
  X,
  List,
  Percent,
  IndianRupee,
  Edit2,
  Trash2,
  ArrowLeft,
  FileSpreadsheet,
  Plus,
  Layers,
  CheckCircle,
  XCircle,
  Save
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Member extends MemberOption {
  customerID?: number;
}

const SavingOpeningBalance: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showMigratedModal, setShowMigratedModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [migratedAccounts, setMigratedAccounts] = useState<any[]>([]);
  const [allSavingAccounts, setAllSavingAccounts] = useState<any[]>([]);
  const [showDuplicateConfirmModal, setShowDuplicateConfirmModal] = useState(false);
  const [confirmedMemberID, setConfirmedMemberID] = useState<number | null>(null);
  const [modalAccountTypeFilter, setModalAccountTypeFilter] = useState('ALL');
  const [modalBranchFilter, setModalBranchFilter] = useState('ALL');

  const [isEditMode, setIsEditMode] = useState(false);
  const [editAccountId, setEditAccountId] = useState<number | null>(null);
  const [jointHolderMemberIDs, setJointHolderMemberIDs] = useState<number[]>([]);
  const [selectedJointMemberID, setSelectedJointMemberID] = useState<number | null>(null);
  const [nextAccountNoPreview, setNextAccountNoPreview] = useState<string>('');
  const formContainerRef = useRef<HTMLDivElement>(null);
  const openingBalanceInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api';

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

  const initialFormState = {
    branchID: user?.branchID || 1,
    memberID: 0,
    oldAccountNo: '',
    settingID: 0,
    accountType: 'Personal',
    openingDate: '',
    ledgerID: 7,
    openingBalance: 0,
    interestRate: 4.0,
    minimumBalance: 500,
    status: 'Active',
    nomineeName: '',
    nomineeRelation: '',
    nomineeAddress: '',
    lastInterestPostingDate: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  const handleJointMemberSelect = (mId: number | '') => {
    if (!mId) {
      setSelectedJointMemberID(null);
      return;
    }
    const numId = Number(mId);
    if (numId === Number(formData.memberID)) {
      setError('मुख्य खातेदाराला सह-खातेदार म्हणून जोडता येत नाही.');
      return;
    }
    if (!jointHolderMemberIDs.includes(numId)) {
      setJointHolderMemberIDs(prev => [...prev, numId]);
      setError('');
    }
    setSelectedJointMemberID(null);
  };

  const addJointHolder = () => {
    if (!selectedJointMemberID) return;
    handleJointMemberSelect(selectedJointMemberID);
  };

  const removeJointHolder = (id: number) => {
    setJointHolderMemberIDs(prev => prev.filter(mId => mId !== id));
  };

  const getMemberDisplayName = (mId: number) => {
    const mem = members.find(m => (m.memberID || m.customerID) === mId);
    if (!mem) return `सभासद #${mId}`;
    const code = mem.memberCode ? `[${mem.memberCode}] ` : '';
    const name = `${mem.firstName || ''} ${mem.middleName ? mem.middleName + ' ' : ''}${mem.lastName || ''}`.trim();
    return `${code}${name}`;
  };

  useEffect(() => {
    fetchBranches();
    fetchSchemes();
    fetchMembers();
    fetchLedgers();
    fetchMigratedAccounts();
    fetchNextAccountNo(formData.branchID || 1);
  }, []);

  useEffect(() => {
    if (formData.branchID) {
      fetchNextAccountNo(Number(formData.branchID));
    }
  }, [formData.branchID]);

  const fetchNextAccountNo = async (branchId: number) => {
    try {
      const response = await axios.get(`${API_URL}/SavingAccounts/next-account-no?branchId=${branchId}`);
      if (response.data?.nextAccountNo) {
        setNextAccountNoPreview(response.data.nextAccountNo);
      }
    } catch (err) {
      console.error('Error fetching next account number preview', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      const response = await axios.get(`${API_URL}/SavingSettings/Interest`);
      if (Array.isArray(response.data) && response.data.length > 0) {
        setSchemes(response.data);
        const defaultScheme = response.data[0];
        const mappedLedgerId = defaultScheme.savingLiabilityLedgerID || defaultScheme.ledgerID || defaultScheme.interestExpenseLedgerID || 7;
        setFormData(prev => ({
          ...prev,
          settingID: defaultScheme.settingID,
          interestRate: defaultScheme.interestRate || 4.0,
          ledgerID: mappedLedgerId
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          settingID: -1,
          interestRate: 4.0,
          ledgerID: 7
        }));
      }
    } catch (err) {
      console.error('Error fetching saving schemes', err);
    }
  };

  const fetchMigratedAccounts = async () => {
    try {
      const response = await axios.get(`${API_URL}/SavingAccounts`);
      if (Array.isArray(response.data)) {
        setAllSavingAccounts(response.data);
        const legacyOnly = response.data.filter((a: any) => a.isLegacyAccount);
        setMigratedAccounts(legacyOnly);
      }
    } catch (err) {
      console.error('Error fetching migrated accounts', err);
    }
  };

  const fetchLedgers = async () => {
    try {
      const response = await axios.get(`${API_URL}/Ledgers`);
      if (Array.isArray(response.data)) {
        setLedgers(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch ledgers', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API_URL}/Branches`);
      setBranches(response.data);
    } catch (err) {
      console.error('Error fetching branches', err);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSchemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = parseInt(e.target.value, 10);
    if (sId === -1) {
      setFormData(prev => ({
        ...prev,
        settingID: -1,
        interestRate: 4.0,
        ledgerID: 7
      }));
      return;
    }

    const selectedScheme = schemes.find(s => s.settingID === sId);
    if (selectedScheme) {
      const mappedLedgerId = selectedScheme.savingLiabilityLedgerID || selectedScheme.ledgerID || selectedScheme.interestExpenseLedgerID || 7;
      setFormData(prev => ({
        ...prev,
        settingID: sId,
        interestRate: selectedScheme.interestRate || 4.0,
        ledgerID: mappedLedgerId
      }));
    }
  };

  const handleStartEdit = (account: any) => {
    setIsEditMode(true);
    setEditAccountId(account.savingAccountID);
    setConfirmedMemberID(account.memberID);

    const jointIds = (account.jointHolders || []).map((jh: any) => jh.memberID || jh.memberId).filter(Boolean);
    setJointHolderMemberIDs(jointIds);
    setSelectedJointMemberID(null);

    setFormData({
      branchID: account.branchID || user?.branchID || 1,
      memberID: account.memberID,
      oldAccountNo: account.oldAccountNo || account.legacyAccountNumber || '',
      settingID: account.settingID || 0,
      accountType: account.accountType || 'Personal',
      openingDate: account.openingDate ? account.openingDate.split('T')[0] : '',
      ledgerID: account.ledgerID || 7,
      openingBalance: account.openingBalance || 0,
      interestRate: account.interestRate || 4.0,
      minimumBalance: account.minimumBalance || 500,
      status: account.status || 'Active',
      nomineeName: account.nomineeName || '',
      nomineeRelation: account.nomineeRelation || '',
      nomineeAddress: account.nomineeAddress || '',
      lastInterestPostingDate: account.lastInterestPostingDate ? account.lastInterestPostingDate.split('T')[0] : ''
    });

    setError('');
    setSuccess('');
    setShowMigratedModal(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      openingBalanceInputRef.current?.focus();
      openingBalanceInputRef.current?.select();
    }, 150);
  };

  const handleDelete = async (id: number, accNo: string) => {
    if (!window.confirm(`तुम्हाला खरोखर बचत खाते '${accNo}' हटवायचे आहे का?`)) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_URL}/SavingAccounts/${id}`);
      setSuccess(`बचत खाते '${accNo}' यशस्वीरीत्या हटवले.`);
      await fetchMigratedAccounts();
      fetchNextAccountNo(formData.branchID);
      if (editAccountId === id) {
        resetForm();
      }
    } catch (err: any) {
      console.error('Error deleting saving account', err);
      setError(err?.response?.data?.message || 'खाते हटवताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setEditAccountId(null);
    setConfirmedMemberID(null);
    setJointHolderMemberIDs([]);
    setSelectedJointMemberID(null);
    const targetBranchId = user?.branchID || formData.branchID || 1;
    setFormData({
      ...initialFormState,
      branchID: targetBranchId,
      settingID: schemes.length > 0 ? schemes[0].settingID : -1,
      interestRate: schemes.length > 0 ? schemes[0].interestRate : 4.0,
      ledgerID: schemes.length > 0 ? (schemes[0].savingLiabilityLedgerID || 7) : 7
    });
    fetchNextAccountNo(targetBranchId);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.memberID || Number(formData.memberID) === 0) {
      setError('कृपया सभासद निवडा.');
      return;
    }

    if (!formData.openingDate) {
      setError('कृपया मूळ उघडल्याची तारीख (Opening Date) टाका.');
      return;
    }

    if (formData.openingBalance < 0) {
      setError('सुरुवातीची शिल्लक ऋण (Negative) असू शकत नाही.');
      return;
    }

    let finalJointHolders = [...jointHolderMemberIDs];
    if (selectedJointMemberID && !finalJointHolders.includes(selectedJointMemberID)) {
      finalJointHolders.push(selectedJointMemberID);
      setJointHolderMemberIDs(finalJointHolders);
    }

    if (formData.accountType === 'Joint' && finalJointHolders.length === 0) {
      setError('संयुक्त खात्यासाठी किमान एक सह-खातेदार / संयुक्त सभासद जोडा.');
      return;
    }

    // Check duplicate account
    if (!isEditMode && confirmedMemberID !== Number(formData.memberID)) {
      const existing = allSavingAccounts.filter((a: any) => a.memberID === Number(formData.memberID));
      if (existing.length > 0) {
        setShowDuplicateConfirmModal(true);
        return;
      }
    }

    await executeSave(finalJointHolders);
  };

  const executeSave = async (finalJointHolders?: number[]) => {
    setLoading(true);
    try {
      const jointIds = finalJointHolders !== undefined ? finalJointHolders : (formData.accountType === 'Joint' ? jointHolderMemberIDs : []);
      const payload = {
        savingAccountID: isEditMode && editAccountId ? editAccountId : 0,
        branchID: Number(formData.branchID),
        memberID: Number(formData.memberID),
        oldAccountNo: formData.oldAccountNo ? formData.oldAccountNo.trim() : null,
        settingID: Number(formData.settingID) === -1 ? null : Number(formData.settingID),
        accountType: formData.accountType,
        openingDate: formData.openingDate,
        ledgerID: Number(formData.ledgerID),
        openingBalance: parseFloat(formData.openingBalance.toString()) || 0,
        interestRate: parseFloat(formData.interestRate.toString()) || 0,
        minimumBalance: parseFloat(formData.minimumBalance.toString()) || 500,
        status: formData.status,
        nomineeName: formData.nomineeName,
        nomineeRelation: formData.nomineeRelation,
        nomineeAddress: formData.nomineeAddress,
        lastInterestPostingDate: formData.lastInterestPostingDate ? formData.lastInterestPostingDate : null,
        jointHolderMemberIDs: formData.accountType === 'Joint' ? jointIds : [],
        isLegacyAccount: true
      };

      if (isEditMode && editAccountId) {
        await axios.put(`${API_URL}/SavingAccounts/${editAccountId}`, payload);
        setSuccess('बचत खाते सुरुवातीची शिल्लक माहिती यशस्वीरीत्या अद्ययावत केली!');
      } else {
        const res = await axios.post(`${API_URL}/SavingAccounts/Migrate`, payload);
        setSuccess(`बचत खाते स्थलांतर यशस्वी झाले! खाते क्र.: ${res.data?.accountNo || 'नोंद झाली'}`);
      }

      resetForm();
      await fetchMigratedAccounts();
      fetchNextAccountNo(formData.branchID);
    } catch (err: any) {
      console.error('Error saving saving opening balance', err);
      setError(err?.response?.data?.message || 'माहिती सेव्ह करताना त्रुटी आली.');
    } finally {
      setLoading(false);
      setShowDuplicateConfirmModal(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredMigrated.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredMigrated.map((acc, i) => {
      const jointNames = (acc.jointHolders || []).map((jh: any) => jh.memberName || `${jh.member?.firstName || ''} ${jh.member?.lastName || ''}`.trim()).filter(Boolean).join(', ');
      const ledgerObj = ledgers.find(l => l.ledgerID === acc.ledgerID);
      const schemeObj = schemes.find(s => s.settingID === acc.settingID);
      return {
        'अ.क्र.': i + 1,
        'बचत खाते क्र. (CBS)': acc.accountNo,
        'जुने बचत खाते क्र.': acc.oldAccountNo || acc.legacyAccountNumber || '-',
        'शाखा': acc.branchName || acc.branch?.branchName || '-',
        'CIF क्र.': acc.cifNo || acc.member?.cifNo || '-',
        'सभासद कोड': acc.memberCode || acc.member?.memberCode || '-',
        'सभासदाचे नाव': acc.memberName || `${acc.member?.firstName || ''} ${acc.member?.lastName || ''}`.trim(),
        'खाते प्रकार': acc.accountType === 'Joint' ? 'संयुक्त (Joint)' : acc.accountType === 'Minor' ? 'अल्पवयीन (Minor)' : acc.accountType === 'Organization' ? 'संस्था (Organization)' : 'वैयक्तिक (Personal)',
        'सह-खातेदार (Joint Holders)': jointNames || '-',
        'बचत योजना': schemeObj?.schemeName || (acc.settingID ? `योजना #${acc.settingID}` : 'डिफॉल्ट दर'),
        'लेजर खातावणी': ledgerObj ? `${ledgerObj.ledgerID} - ${ledgerObj.ledgerName}` : (acc.ledgerName || 'बचत ठेव (7)'),
        'सुरुवातीची शिल्लक (₹)': acc.openingBalance || 0,
        'व्याजदर (%)': `${acc.interestRate || 4}%`,
        'किमान शिल्लक (₹)': acc.minimumBalance || 500,
        'मागील व्याज जमा दिनांक': acc.lastInterestPostingDate ? acc.lastInterestPostingDate.split('T')[0] : '-',
        'वारसदाराचे नाव': acc.nomineeName || '-',
        'वारसदाराशी नाते': acc.nomineeRelation || '-',
        'वारसदाराचा पत्ता': acc.nomineeAddress || '-',
        'खाते उघडल्याचा दिनांक': acc.openingDate ? acc.openingDate.split('T')[0] : '-',
        'स्थिती': acc.status === 'Active' ? 'सक्रिय (Active)' : 'बंद (Closed)'
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SavingOpeningBalances');
    XLSX.writeFile(wb, `Saving_Opening_Balances_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const nomineeRelationOptions = [
    'पत्नी (Wife)',
    'पती (Husband)',
    'मुलगा (Son)',
    'मुलगी (Daughter)',
    'आई (Mother)',
    'वडील (Father)',
    'भाऊ (Brother)',
    'बहीण (Sister)',
    'नातू (Grandson)',
    'नात (Granddaughter)',
    'सून (Daughter-in-law)',
    'जावई (Son-in-law)',
    'काका (Uncle)',
    'काकू (Aunt)',
    'भाचा / पुतण्या (Nephew)',
    'भाची / पुतणी (Niece)',
    'मित्र / भागीदार (Friend / Partner)',
    'इतर (Other)'
  ];

  const formatMemberLabel = (m: Member) => {
    const cifPart = m.cifNo ? `[CIF: ${m.cifNo}] ` : '';
    const oldCodePart = m.oldMemberCode || m.legacyMemberNo ? ` (जुना कोड: ${m.oldMemberCode || m.legacyMemberNo})` : '';
    return `${cifPart}${m.memberCode} - ${m.firstName} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName}${oldCodePart}`;
  };

  const selectedMember = members.find(m => (m.memberID || m.customerID) === Number(formData.memberID));
  const existingMemberAccounts = allSavingAccounts.filter((a: any) => a.memberID === Number(formData.memberID) && a.savingAccountID !== editAccountId);

  const filteredMigrated = migratedAccounts.filter(acc => {
    const q = searchQuery.toLowerCase().trim();
    const jointNames = (acc.jointHolders || []).map((jh: any) => jh.memberName || `${jh.member?.firstName || ''} ${jh.member?.lastName || ''}`.trim()).join(' ').toLowerCase();
    
    const matchSearch = !q || (
      (acc.accountNo && acc.accountNo.toLowerCase().includes(q)) ||
      (acc.oldAccountNo && acc.oldAccountNo.toLowerCase().includes(q)) ||
      (acc.legacyAccountNumber && acc.legacyAccountNumber.toLowerCase().includes(q)) ||
      (acc.memberName && acc.memberName.toLowerCase().includes(q)) ||
      (acc.memberCode && acc.memberCode.toLowerCase().includes(q)) ||
      (acc.cifNo && acc.cifNo.toLowerCase().includes(q)) ||
      (acc.branchName && acc.branchName.toLowerCase().includes(q)) ||
      (acc.nomineeName && acc.nomineeName.toLowerCase().includes(q)) ||
      (acc.nomineeRelation && acc.nomineeRelation.toLowerCase().includes(q)) ||
      jointNames.includes(q)
    );
    const matchType = modalAccountTypeFilter === 'ALL' || acc.accountType === modalAccountTypeFilter;
    const matchBranch = modalBranchFilter === 'ALL' || (acc.branchID || acc.branchId)?.toString() === modalBranchFilter;
    return matchSearch && matchType && matchBranch;
  });

  // KPI Calculations
  const totalMigratedBalance = migratedAccounts.reduce((sum, a) => sum + (a.openingBalance || 0), 0);
  const activeCount = migratedAccounts.filter(a => a.status === 'Active').length;
  const avgRate = migratedAccounts.length > 0
    ? (migratedAccounts.reduce((sum, a) => sum + (a.interestRate || 4), 0) / migratedAccounts.length).toFixed(2)
    : '4.00';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Wallet size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>बचत खाते सुरुवातीची शिल्लक स्थलांतर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Opening Balance Saving Migration)</span>
              {isEditMode && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editAccountId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              ३१ मार्च पूर्वीपासून सुरू असलेल्या जुन्या बचत खात्यांचा डेटा स्थलांतर करणे व सुरुवातीची शिल्लक नोंदवणे
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isEditMode && (
            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>संपादन रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchMigratedAccounts();
              setShowMigratedModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व स्थलांतरित बचत खाती यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदवलेली खाती पहा ({migratedAccounts.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण स्थलांतरित खाती</div>
            <div className="text-sm font-black text-gray-900">{migratedAccounts.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण सुरुवातीची शिल्लक</div>
            <div className="text-sm font-black text-emerald-800">₹{totalMigratedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सरासरी व्याजदर</div>
            <div className="text-sm font-black text-indigo-950">{avgRate}% p.a.</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय खाती (Active)</div>
            <div className="text-sm font-black text-amber-800">{activeCount}</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* MAIN SINGLE UNIFIED FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          isEditMode ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Member & Account Details */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <UserCheck className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. खाते व सभासद माहिती (Account & Member Details)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>शाखा (Branch)</label>
                <select name="branchID" value={formData.branchID} onChange={handleChange} className={inputClass}>
                  {branches.map((b) => (
                    <option key={b.branchID} value={b.branchID}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  नवीन बचत खाते क्र. <span className="text-primary text-[10px] font-mono">(New CBS A/c No)</span>
                </label>
                <div className="flex items-center h-[28px] px-2 bg-slate-100 border border-slate-300 rounded-sm font-mono font-bold text-xs text-primary shadow-2xs">
                  {isEditMode
                    ? (allSavingAccounts.find(a => a.savingAccountID === editAccountId)?.accountNo || 'नोंद झालेले')
                    : (nextAccountNoPreview || 'HO10100001')}
                  <span className="ml-auto text-[9px] text-gray-500 font-sans font-normal">
                    {isEditMode ? '(अद्ययावत)' : '(ऑटो जनरेट)'}
                  </span>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  जुने बचत खाते क्र. <span className="text-gray-500 text-[10px] font-mono">(Old/Legacy A/c No)</span>
                </label>
                <input
                  type="text"
                  name="oldAccountNo"
                  value={formData.oldAccountNo}
                  onChange={handleChange}
                  placeholder="उदा. SB-101 किंवा 45"
                  className={`${inputClass} font-mono font-bold text-gray-800`}
                />
              </div>
            </div>

            <div className="pt-1.5 border-t border-gray-200">
              <label className={labelClass}>
                सभासद निवडा (Select Member) <span className="text-red-500">*</span>
              </label>
              <div className={isEditMode ? 'opacity-70 pointer-events-none' : ''}>
                <MemberSearchSelect
                  members={members}
                  value={formData.memberID ? Number(formData.memberID) : ''}
                  onChange={(val) => setFormData((prev) => ({ ...prev, memberID: val ? Number(val) : 0 }))}
                  placeholder="-- सभासद नाव, कोड किंवा मोबाईलने शोधा --"
                />
              </div>
              {selectedMember && (
                <div className="mt-1 p-1.5 bg-primary/5 border border-primary/20 rounded-sm text-[10px] space-y-0.5 text-gray-800 font-medium">
                  <div className="flex justify-between items-center">
                    <span><b>CIF No:</b> {selectedMember.cifNo || '-'}</span>
                    <span><b>सभासद कोड:</b> {selectedMember.memberCode}</span>
                  </div>
                  <div className="pt-0.5"><b>ग्राहक नाव:</b> {selectedMember.firstName} {selectedMember.middleName ? selectedMember.middleName + ' ' : ''}{selectedMember.lastName}</div>
                </div>
              )}
              {existingMemberAccounts.length > 0 && !isEditMode && (
                <div className="mt-1 p-1.5 bg-amber-50 border border-amber-300 rounded-sm text-[10px] text-amber-900 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>या सभासदाचे आधीच {existingMemberAccounts.length} बचत खाते सुरू आहे ({existingMemberAccounts.map(a => a.accountNo || `Acc#${a.savingAccountID}`).join(', ')}).</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>
                  मूळ उघडल्याची तारीख (Opening Date) <span className="text-red-500">*</span>
                </label>
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
                <label className={labelClass}>
                  सुरुवातीची शिल्लक (Opening Balance ₹) <span className="text-red-500">*</span>
                </label>
                <input
                  ref={openingBalanceInputRef}
                  type="number"
                  name="openingBalance"
                  value={formData.openingBalance}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-bold text-emerald-700 font-mono`}
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>खाते प्रकार (Account Type)</label>
                <select name="accountType" value={formData.accountType} onChange={handleChange} className={inputClass}>
                  <option value="Personal">वैयक्तिक (Personal)</option>
                  <option value="Joint">संयुक्त (Joint)</option>
                  <option value="Minor">अल्पवयीन (Minor)</option>
                  <option value="Organization">संस्था (Organization)</option>
                </select>
              </div>
            </div>

            {/* Dynamic Joint Holders Selection: Rendered when Account Type is Joint */}
            {formData.accountType === 'Joint' && (
              <div className="pt-2 border-t border-blue-200 animate-in fade-in duration-200">
                <div className="border border-blue-300 rounded-sm p-2.5 bg-blue-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="text-sm">👥</span>
                      <span>सह-खातेदार / संयुक्त सभासद (Joint Account Holders)</span>
                      <span className="bg-blue-200 text-blue-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {jointHolderMemberIDs.length} जोडले
                      </span>
                    </h3>
                    <span className="text-[10px] text-blue-700 italic font-medium">
                      * संयुक्त खात्यासाठी किमान एक सह-खातेदार निवडा
                    </span>
                  </div>

                  {/* Search & Add Joint Member */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <MemberSearchSelect
                        members={members.filter(m => (m.memberID || m.customerID) !== Number(formData.memberID) && !jointHolderMemberIDs.includes(m.memberID || m.customerID || 0))}
                        value={selectedJointMemberID || ''}
                        onChange={handleJointMemberSelect}
                        placeholder="-- सह-खातेदार / संयुक्त सभासद शोधा व निवडा --"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addJointHolder}
                      disabled={!selectedJointMemberID}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3.5 py-1 rounded-sm text-xs font-bold transition-colors whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1 h-[28px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>जोडा (Add)</span>
                    </button>
                  </div>

                  {/* List of Added Joint Holders */}
                  {jointHolderMemberIDs.length > 0 ? (
                    <div className="space-y-1 pt-1">
                      {jointHolderMemberIDs.map((id, idx) => (
                        <div key={id} className="flex items-center justify-between bg-white border border-blue-200 rounded-sm px-2.5 py-1 text-xs shadow-2xs hover:border-blue-300 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-800 font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                              #{idx + 1}
                            </span>
                            <span className="text-gray-900 font-bold text-[11px]">
                              {getMemberDisplayName(id)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeJointHolder(id)}
                            className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-1.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-0.5"
                            title="सह-खातेदार काढा"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>काढा</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-sm flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>कृपया वरील ड्रॉपडाउनमधून संयुक्त खातेदार शोधा आणि '+ जोडा' बटणावर क्लिक करा.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Scheme & Interest Rules */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Percent className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. व्याजदर व योजना नियम (Scheme & Rates)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>बचत ठेव योजना (Scheme)</label>
                <select name="settingID" value={formData.settingID} onChange={handleSchemeChange} className={inputClass}>
                  {schemes.length === 0 ? (
                    <option value="-1">-- कोणतीही योजना उपलब्ध नाही (डिफॉल्ट दर वापरा) --</option>
                  ) : (
                    schemes.map((s) => (
                      <option key={s.settingID} value={s.settingID}>
                        {s.schemeName || `व्याजदर सेटिंग #${s.settingID}`} ({s.interestRate}%)
                      </option>
                    ))
                  )}
                  {schemes.length > 0 && <option value="-1">-- इतर / सानुकूल डिफॉल्ट दर वापरा --</option>}
                </select>
                <div className="text-[9px] text-emerald-800 font-medium mt-0.5 leading-tight flex items-center gap-1 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                  <span className="font-bold">देयता लेजर:</span>
                  <span className="font-mono truncate">
                    {(() => {
                      const mappedL = ledgers.find(l => l.ledgerID === formData.ledgerID);
                      return mappedL ? `${mappedL.ledgerID} - ${mappedL.ledgerName}` : `बचत ठेव (${formData.ledgerID || 7})`;
                    })()}
                  </span>
                </div>
              </div>

              <div>
                <label className={labelClass}>व्याजदर (% p.a.)</label>
                <input
                  type="number"
                  step="0.01"
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold text-emerald-700`}
                />
              </div>

              <div>
                <label className={labelClass}>किमान शिल्लक (Min Balance ₹)</label>
                <input
                  type="number"
                  name="minimumBalance"
                  value={formData.minimumBalance}
                  onChange={handleChange}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  मागील व्याज जमा दिनांक <span className="text-primary text-[10px] font-mono">(Last Int. Date)</span>
                </label>
                <input
                  type="date"
                  name="lastInterestPostingDate"
                  value={formData.lastInterestPostingDate}
                  onChange={handleChange}
                  className={`${inputClass} font-mono`}
                />
                <div className="text-[9px] text-primary/80 font-medium mt-0.5 leading-tight">
                  💡 पुढील व्याज या तारखेपासून पुढे मोजले जाईल.
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Nominee Details */}
          <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">३. वारसदार माहिती (Nominee Details)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>वारसदाराचे नाव (Nominee Name)</label>
                <input
                  type="text"
                  name="nomineeName"
                  value={formData.nomineeName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. राहुल तानाजी पाटील"
                />
              </div>

              <div>
                <label className={labelClass}>वारसदाराशी नाते (Relation)</label>
                <select
                  name="nomineeRelation"
                  value={formData.nomineeRelation}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">-- नाते निवडा (Select Relation) --</option>
                  {nomineeRelationOptions.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                  {formData.nomineeRelation && !nomineeRelationOptions.includes(formData.nomineeRelation) && (
                    <option value={formData.nomineeRelation}>
                      {formData.nomineeRelation}
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className={labelClass}>वारसदाराचा पत्ता (Nominee Address)</label>
                <input
                  type="text"
                  name="nomineeAddress"
                  value={formData.nomineeAddress}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. मु. पो. सांगली"
                />
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 ${
                isEditMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'जतन होत आहे...' : isEditMode ? 'बदल सेव्ह करा (Update)' : 'खाते स्थलांतर सेव्ह करा (Migrate Account)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: MIGRATED SAVING ACCOUNTS LIST                               */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* POP-UP MODAL: MIGRATED SAVING ACCOUNTS LIST                               */}
      {/* ========================================================================= */}
      {showMigratedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-1 sm:p-3 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 w-[98vw] max-w-[1440px] max-h-[94vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2.5">
                <Wallet className="w-5 h-5 text-white" />
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold">
                    स्थलांतरित बचत खाती यादी (Migrated Saving Accounts Master)
                  </h2>
                  <span className="bg-white/20 text-white text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">
                    एकूण: {filteredMigrated.length} खाती
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMigratedModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors cursor-pointer"
                title="बंद करा (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Toolbar & KPI Summary */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2.5 shrink-0">
              {/* Left: Filters */}
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                  <input 
                    type="text" 
                    placeholder="खाते क्र, नाव, कोड, CIF, वारसदार किंवा शाखा शोधा..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-6 py-1 border border-gray-300 rounded-sm text-xs h-[30px] w-56 sm:w-72 focus:outline-none focus:border-primary bg-white shadow-2xs"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')} 
                      className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Branch Filter */}
                <select
                  value={modalBranchFilter}
                  onChange={(e) => setModalBranchFilter(e.target.value)}
                  className="text-xs border border-gray-300 rounded-sm px-2 py-1 h-[30px] bg-white focus:outline-none focus:border-primary"
                >
                  <option value="ALL">-- सर्व शाखा (All Branches) --</option>
                  {branches.map(b => (
                    <option key={b.branchID} value={b.branchID?.toString()}>
                      {b.branchName}
                    </option>
                  ))}
                </select>

                {/* Account Type Filter */}
                <select
                  value={modalAccountTypeFilter}
                  onChange={(e) => setModalAccountTypeFilter(e.target.value)}
                  className="text-xs border border-gray-300 rounded-sm px-2 py-1 h-[30px] bg-white focus:outline-none focus:border-primary"
                >
                  <option value="ALL">-- सर्व खाते प्रकार --</option>
                  <option value="Personal">वैयक्तिक (Personal)</option>
                  <option value="Joint">संयुक्त (Joint)</option>
                  <option value="Minor">अल्पवयीन (Minor)</option>
                  <option value="Organization">संस्था (Organization)</option>
                </select>
              </div>

              {/* Right: Quick KPI badges & Excel Export */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="hidden lg:flex items-center gap-2 text-[11px]">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-1 rounded-sm font-bold">
                    एकूण शिल्लक: ₹{filteredMigrated.reduce((s, a) => s + (a.openingBalance || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 px-2 py-1 rounded-sm font-bold">
                    संयुक्त खाती: {filteredMigrated.filter(a => a.accountType === 'Joint').length}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={filteredMigrated.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer h-[30px]"
                  title="सर्व फिल्डसह एक्सेल फाइल डाउनलोड करा"
                >
                  <FileSpreadsheet size={14} />
                  <span>एक्सेल एक्सपोर्ट</span>
                </button>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[1200px]">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300 text-[11px]">
                    <tr>
                      <th className="px-2 py-2 border-r border-gray-200 text-center w-10">अ.क्र.</th>
                      <th className="px-2 py-2 border-r border-gray-200 text-center w-24">कृती</th>
                      <th className="px-2.5 py-2 border-r border-gray-200 text-left min-w-[130px]">खाते क्र. व शाखा</th>
                      <th className="px-2.5 py-2 border-r border-gray-200 text-left min-w-[180px]">सभासद नाव व कोड</th>
                      <th className="px-2.5 py-2 border-r border-gray-200 text-left min-w-[160px]">खाते प्रकार व सह-खातेदार</th>
                      <th className="px-2.5 py-2 border-r border-gray-200 text-left min-w-[140px]">योजना व लेजर (GL)</th>
                      <th className="px-2.5 py-2 border-r border-gray-200 text-right min-w-[120px]">सुरुवातीची शिल्लक</th>
                      <th className="px-2 py-2 border-r border-gray-200 text-center min-w-[100px]">दर व किमान शिल्लक</th>
                      <th className="px-2.5 py-2 border-r border-gray-200 text-center min-w-[115px]">मागील व्याज दिनांक</th>
                      <th className="px-2.5 py-2 border-r border-gray-200 text-left min-w-[140px]">वारसदार व नाते</th>
                      <th className="px-2 py-2 border-r border-gray-200 text-center min-w-[100px]">उघडल्याचा दिनांक</th>
                      <th className="px-2 py-2 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredMigrated.map((acc, idx) => {
                      const schemeObj = schemes.find(s => s.settingID === acc.settingID);
                      const ledgerObj = ledgers.find(l => l.ledgerID === acc.ledgerID);
                      return (
                        <tr key={acc.savingAccountID} className="hover:bg-primary/5 transition-colors">
                          {/* 1. Sr. No. */}
                          <td className="px-2 py-2 border-r border-gray-200 text-center font-mono text-gray-500 font-bold">
                            {idx + 1}
                          </td>

                          {/* 2. Actions */}
                          <td className="px-2 py-2 border-r border-gray-200 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                type="button" 
                                onClick={() => handleStartEdit(acc)} 
                                className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="खाते फॉर्ममध्ये लोड करा (Load in Form)"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>सुधारा</span>
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleDelete(acc.savingAccountID, acc.accountNo)} 
                                className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="खाते डिलीट करा (Delete)"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>बाद</span>
                              </button>
                            </div>
                          </td>

                          {/* 3. Account No & Branch */}
                          <td className="px-2.5 py-2 border-r border-gray-200 text-left">
                            <div className="font-mono font-bold text-primary text-xs tracking-wide">{acc.accountNo}</div>
                            {(acc.oldAccountNo || acc.legacyAccountNumber) && (
                              <div className="text-[10px] text-amber-900 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 font-mono font-bold mt-0.5 inline-block">
                                जुने: {acc.oldAccountNo || acc.legacyAccountNumber}
                              </div>
                            )}
                            <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                              {acc.branchName || acc.branch?.branchName || 'मुख्य शाखा'}
                            </div>
                          </td>

                          {/* 4. Member Name & Code */}
                          <td className="px-2.5 py-2 border-r border-gray-200 text-left">
                            <div className="font-bold text-gray-900 leading-snug">
                              {acc.memberName || `${acc.member?.firstName || ''} ${acc.member?.lastName || ''}`}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                              कोड: <span className="font-bold text-gray-700">{acc.memberCode || acc.member?.memberCode || '-'}</span> 
                              {acc.cifNo ? ` | CIF: ${acc.cifNo}` : ''}
                            </div>
                          </td>

                          {/* 5. Account Type & Joint Holders */}
                          <td className="px-2.5 py-2 border-r border-gray-200 text-left">
                            <div className="inline-block">
                              <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border ${
                                acc.accountType === 'Joint'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : acc.accountType === 'Minor'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : acc.accountType === 'Organization'
                                  ? 'bg-purple-100 text-purple-800 border-purple-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}>
                                {acc.accountType === 'Joint' ? '👥 संयुक्त (Joint)' : acc.accountType === 'Minor' ? '👶 अल्पवयीन (Minor)' : acc.accountType === 'Organization' ? '🏢 संस्था (Org)' : '👤 वैयक्तिक (Personal)'}
                              </span>
                            </div>

                            {acc.accountType === 'Joint' && acc.jointHolders && acc.jointHolders.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {acc.jointHolders.map((jh: any, jIdx: number) => (
                                  <div key={jh.savingAccountJointHolderID || jIdx} className="text-[10px] text-blue-900 bg-blue-50/90 px-1.5 py-0.5 rounded border border-blue-200 font-medium flex items-center gap-1">
                                    <span className="font-bold text-blue-700">#{jIdx + 1}</span>
                                    <span>{jh.memberName || `${jh.member?.firstName || ''} ${jh.member?.lastName || ''}`.trim()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* 6. Scheme & GL Liability Ledger */}
                          <td className="px-2.5 py-2 border-r border-gray-200 text-left">
                            <div className="font-semibold text-gray-800">
                              {schemeObj?.schemeName || (acc.settingID ? `योजना #${acc.settingID}` : 'डिफॉल्ट दर')}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                              GL: {ledgerObj ? `${ledgerObj.ledgerID} - ${ledgerObj.ledgerName}` : (acc.ledgerName || 'बचत ठेव (7)')}
                            </div>
                          </td>

                          {/* 7. Opening Balance */}
                          <td className="px-2.5 py-2 border-r border-gray-200 text-right font-mono font-bold text-emerald-700 text-xs whitespace-nowrap">
                            ₹{(acc.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* 8. Interest Rate & Min Balance */}
                          <td className="px-2 py-2 border-r border-gray-200 text-center font-mono">
                            <div className="font-bold text-gray-900">{acc.interestRate || 4}% p.a.</div>
                            <div className="text-[10px] text-gray-500">किमान: ₹{acc.minimumBalance || 500}</div>
                          </td>

                          {/* 9. Last Interest Posting Date */}
                          <td className="px-2 py-2 border-r border-gray-200 text-center font-mono whitespace-nowrap">
                            {acc.lastInterestPostingDate ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                                <span>📅</span> {acc.lastInterestPostingDate.split('T')[0]}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-[10px]">-</span>
                            )}
                          </td>

                          {/* 10. Nominee Details */}
                          <td className="px-2.5 py-2 border-r border-gray-200 text-left">
                            {acc.nomineeName ? (
                              <div>
                                <div className="font-bold text-gray-800">{acc.nomineeName}</div>
                                {acc.nomineeRelation && (
                                  <div className="text-[10px] text-gray-500 font-medium">{acc.nomineeRelation}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-[10px]">नोंद नाही</span>
                            )}
                          </td>

                          {/* 11. Opening Date */}
                          <td className="px-2 py-2 border-r border-gray-200 text-center font-mono text-gray-700 whitespace-nowrap">
                            {acc.openingDate ? acc.openingDate.split('T')[0] : '-'}
                          </td>

                          {/* 12. Status */}
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              acc.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {acc.status === 'Active' ? 'सक्रिय' : 'बंद'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredMigrated.length === 0 && (
                      <tr>
                        <td colSpan={12} className="px-6 py-12 text-center text-gray-400 font-bold bg-slate-50">
                          <Wallet className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <span>कोणतेही स्थलांतरित बचत खाते सापडले नाही.</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex flex-wrap justify-between items-center gap-2 text-xs shrink-0">
              <span className="text-gray-600 font-medium">
                💡 टीप: 'सुधारा' वर क्लिक केल्यास खात्याची सर्व माहिती (सह-खातेदारांसह) थेट मुख्य फॉर्ममध्ये लोड होईल.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMigratedModal(false)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-xs font-bold transition-all cursor-pointer"
                >
                  बंद करा (Close)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Duplicate Account Confirm Modal */}
      {showDuplicateConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-md shadow-xl border border-gray-300 max-w-md w-full p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm border-b pb-2">
              <AlertCircle size={18} />
              <span>खाते आधीच अस्तित्वात आहे (Duplicate Account Warning)</span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              या सभासदाचे आधीच बचत खाते अस्तित्वात आहे. तुम्हाला या सभासदासाठी दुसरे अतिरिक्त बचत खाते स्थलांतरित करायचे आहे का?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowDuplicateConfirmModal(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-sm text-xs"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmedMemberID(Number(formData.memberID));
                  executeSave();
                }}
                className="px-4 py-1.5 bg-primary text-white font-bold rounded-sm text-xs hover:opacity-90"
              >
                होय, पुढे चला (Proceed)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SavingOpeningBalance;
