import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Coins,
  Layers,
  CheckCircle,
  XCircle,
  RotateCcw,
  Save,
  Edit2,
  Trash2,
  Search,
  FileSpreadsheet,
  X,
  Plus,
  IndianRupee,
  Percent,
  Calendar,
  UserCheck,
  BookOpen,
  User,
  CheckCircle2,
  Printer,
  Sparkles,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect from './common/MemberSearchSelect';
import * as XLSX from 'xlsx';

export default function PigmyOpeningBalance() {
  const [members, setMembers] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [financialYears, setFinancialYears] = useState<any[]>([]);
  const [migratedAccounts, setMigratedAccounts] = useState<any[]>([]);
  const [showMigratedModal, setShowMigratedModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [successModalData, setSuccessModalData] = useState<any | null>(null);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const balanceInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    memberID: '',
    branchID: '1',
    pigmySchemeID: '',
    pigmyAgentID: '',
    openingDate: new Date().toISOString().split('T')[0],
    openingBalance: '',
    financialYear: '2025-2026',
    asOfDate: new Date().toISOString().split('T')[0]
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMasters();
    fetchMigratedAccounts();
  }, []);

  const computeAsOfDateFromStartDate = (startDateStr: string): string => {
    if (!startDateStr) return '';
    try {
      const d = new Date(startDateStr);
      if (isNaN(d.getTime())) return '';
      d.setDate(d.getDate() - 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  const fetchMasters = async () => {
    try {
      const [membersRes, schemesRes, agentsRes, yearsRes] = await Promise.all([
        axios.get('/api/Customers'),
        axios.get('/api/PigmySchemes'),
        axios.get('/api/PigmyAgents'),
        axios.get('/api/FinancialYears')
      ]);

      if (membersRes.data) setMembers(membersRes.data);
      if (schemesRes.data) setSchemes(schemesRes.data);
      if (agentsRes.data) setAgents(agentsRes.data);
      if (yearsRes.data && Array.isArray(yearsRes.data) && yearsRes.data.length > 0) {
        const sortedYears = [...yearsRes.data].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setFinancialYears(sortedYears);

        // Find the earliest created year or active year
        const initialYear = sortedYears.find((y: any) => y.isActive) || sortedYears[0];
        const computedAsOfDate = computeAsOfDateFromStartDate(initialYear.startDate);

        setFormData(prev => ({
          ...prev,
          financialYear: initialYear.yearCode || '2025-2026',
          asOfDate: computedAsOfDate || prev.asOfDate,
          openingDate: computedAsOfDate || prev.openingDate
        }));
      }
    } catch (error) {
      console.error('Failed to fetch masters', error);
      toast.error('मास्टर डेटा लोड करताना त्रुटी आली.');
    }
  };

  const handleFinancialYearChange = (yearCode: string) => {
    const matchedYear = financialYears.find(y => y.yearCode === yearCode);
    if (matchedYear) {
      const computedAsOfDate = computeAsOfDateFromStartDate(matchedYear.startDate);
      setFormData(prev => ({
        ...prev,
        financialYear: matchedYear.yearCode,
        asOfDate: computedAsOfDate || prev.asOfDate,
        openingDate: computedAsOfDate || prev.openingDate
      }));
    } else {
      setFormData(prev => ({ ...prev, financialYear: yearCode }));
    }
  };

  const fetchMigratedAccounts = async () => {
    try {
      const res = await axios.get('/api/PigmyAccounts');
      if (Array.isArray(res.data)) {
        setMigratedAccounts(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch migrated accounts', error);
    }
  };

  const resetForm = () => {
    setEditingAccountId(null);
    const initialYear = financialYears.length > 0 ? (financialYears.find((y: any) => y.isActive) || financialYears[0]) : null;
    const computedAsOfDate = initialYear ? computeAsOfDateFromStartDate(initialYear.startDate) : new Date().toISOString().split('T')[0];

    setFormData({
      memberID: '',
      branchID: '1',
      pigmySchemeID: '',
      pigmyAgentID: '',
      openingDate: computedAsOfDate,
      openingBalance: '',
      financialYear: initialYear ? initialYear.yearCode : '2025-2026',
      asOfDate: computedAsOfDate
    });
  };

  const handleEdit = (acc: any) => {
    setEditingAccountId(acc.pigmyAccountID);
    setFormData({
      memberID: String(acc.memberID || ''),
      branchID: String(acc.branchID || '1'),
      pigmySchemeID: String(acc.pigmySchemeID || ''),
      pigmyAgentID: String(acc.pigmyAgentID || ''),
      openingDate: acc.openingDate ? acc.openingDate.split('T')[0] : new Date().toISOString().split('T')[0],
      openingBalance: String(acc.totalDepositedAmount || acc.openingBalance || ''),
      financialYear: acc.financialYear || '2025-2026',
      asOfDate: acc.asOfDate ? acc.asOfDate.split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setShowMigratedModal(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      balanceInputRef.current?.focus();
      balanceInputRef.current?.select();
    }, 150);
  };

  const handleDelete = async (id: number, accNo: string) => {
    if (!window.confirm(`तुम्हाला खरोखर पिग्मी खाते '${accNo}' डिलीट करायचे आहे का?`)) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`/api/PigmyAccounts/${id}?force=true`);
      toast.success(`पिग्मी खाते '${accNo}' यशस्वीरीत्या डिलीट झाले.`);
      fetchMigratedAccounts();
      if (editingAccountId === id) {
        resetForm();
      }
    } catch (error: any) {
      console.error('Error deleting account', error);
      toast.error(error.response?.data?.message || 'खाते डिलीट करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberID) return toast.error('कृपया सभासद निवडा.');
    if (!formData.pigmySchemeID) return toast.error('कृपया पिग्मी योजना निवडा.');
    if (!formData.pigmyAgentID) return toast.error('कृपया एजंट निवडा.');

    setLoading(true);
    try {
      const payload = {
        memberID: parseInt(formData.memberID),
        branchID: parseInt(formData.branchID),
        pigmySchemeID: parseInt(formData.pigmySchemeID),
        pigmyAgentID: parseInt(formData.pigmyAgentID),
        openingBalance: parseFloat(formData.openingBalance || '0'),
        financialYear: formData.financialYear || null,
        asOfDate: formData.asOfDate || null
      };

      const memberObj = members.find(m => String(m.memberID || m.id) === String(formData.memberID));
      const schemeObj = schemes.find(s => String(s.pigmySchemeID || s.id) === String(formData.pigmySchemeID));
      const agentObj = agents.find(a => String(a.pigmyAgentID || a.id) === String(formData.pigmyAgentID));

      if (editingAccountId) {
        await axios.put(`/api/PigmyAccounts/${editingAccountId}`, {
          pigmyAccountID: editingAccountId,
          ...payload
        });
        const updatedAccount = migratedAccounts.find(a => a.pigmyAccountID === editingAccountId);
        const accNo = updatedAccount?.accountNo || `PG-${editingAccountId}`;
        setSuccessModalData({
          isEdit: true,
          accountNo: accNo,
          memberName: memberObj ? `${memberObj.firstName || ''} ${memberObj.middleName ? memberObj.middleName + ' ' : ''}${memberObj.lastName || ''}`.trim() : 'सभासद',
          memberCode: memberObj?.memberCode || '-',
          cifNo: memberObj?.cifNo || '-',
          mobileNo: memberObj?.mobileNo || '-',
          schemeName: schemeObj?.schemeName || 'पिग्मी योजना',
          interestRate: schemeObj?.interestRate || 0,
          agentName: agentObj?.agentName || 'एजंट',
          openingBalance: parseFloat(formData.openingBalance || '0'),
          financialYear: formData.financialYear,
          asOfDate: formData.asOfDate,
          openingDate: formData.openingDate
        });
        toast.success('पिग्मी खाते माहिती यशस्वीरीत्या अद्ययावत केली!');
      } else {
        const response = await axios.post('/api/PigmyAccounts/Migrate', payload);
        const createdAccountNo = response.data?.accountNo || 'नोंदणीकृत';
        setSuccessModalData({
          isEdit: false,
          accountNo: createdAccountNo,
          memberName: memberObj ? `${memberObj.firstName || ''} ${memberObj.middleName ? memberObj.middleName + ' ' : ''}${memberObj.lastName || ''}`.trim() : 'सभासद',
          memberCode: memberObj?.memberCode || '-',
          cifNo: memberObj?.cifNo || '-',
          mobileNo: memberObj?.mobileNo || '-',
          schemeName: schemeObj?.schemeName || 'पिग्मी योजना',
          interestRate: schemeObj?.interestRate || 0,
          agentName: agentObj?.agentName || 'एजंट',
          openingBalance: parseFloat(formData.openingBalance || '0'),
          financialYear: formData.financialYear,
          asOfDate: formData.asOfDate,
          openingDate: formData.openingDate
        });
        toast.success(`पिग्मी खाते यशस्वीरीत्या स्थलांतरित झाले! खाते क्र.: ${createdAccountNo}`);
      }

      resetForm();
      fetchMigratedAccounts();
    } catch (error: any) {
      console.error('Error migrating account', error);
      const errMsg = error.response?.data?.message || error.response?.data || 'खाते स्थलांतर करताना त्रुटी आली.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredAccounts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredAccounts.map((acc, i) => ({
      'अ.क्र.': i + 1,
      'खाते क्र.': acc.accountNo,
      'सभासद कोड': acc.member?.memberCode || '-',
      'सभासदाचे नाव': acc.member ? `${acc.member.firstName} ${acc.member.lastName}` : '-',
      'पिग्मी योजना': acc.pigmyScheme?.schemeName || '-',
      'एजंटचे नाव': acc.pigmyAgent?.agentName || '-',
      'आरंभिक शिल्लक (₹)': acc.totalDepositedAmount || acc.openingBalance || 0,
      'उघडल्याचा दिनांक': acc.openingDate ? acc.openingDate.split('T')[0] : '-',
      'स्थिती': acc.status || 'Active'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PigmyOpeningBalances');
    XLSX.writeFile(wb, `Pigmy_Opening_Balances_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatMemberLabel = (m: any) => {
    const cifPart = m.cifNo ? `[CIF: ${m.cifNo}] ` : '';
    const codePart = m.memberCode ? `[${m.memberCode}] ` : '';
    return `${cifPart}${codePart}${m.firstName} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName}`;
  };

  const filteredAccounts = migratedAccounts.filter(acc => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const memName = acc.member ? `${acc.member.firstName} ${acc.member.lastName}`.toLowerCase() : '';
    const memCode = acc.member?.memberCode ? acc.member.memberCode.toLowerCase() : '';
    const accNo = acc.accountNo ? acc.accountNo.toLowerCase() : '';
    const agentName = acc.pigmyAgent?.agentName ? acc.pigmyAgent.agentName.toLowerCase() : '';
    return accNo.includes(term) || memName.includes(term) || memCode.includes(term) || agentName.includes(term);
  });

  // KPI Calculations
  const totalBalance = migratedAccounts.reduce((sum, a) => sum + (a.totalDepositedAmount || a.openingBalance || 0), 0);
  const activeAgentsCount = new Set(migratedAccounts.map(a => a.pigmyAgentID).filter(Boolean)).size;

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Coins size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>पिग्मी खाते सुरुवातीची शिल्लक स्थलांतर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Pigmy Opening Balance Migration)</span>
              {editingAccountId && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editingAccountId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              ३१ मार्च पूर्वीच्या जुन्या पिग्मी खात्यांचा डेटा, एजंट मॅपिंग व सुरुवातीची शिल्लक स्थलांतर व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {editingAccountId && (
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
            title="सर्व स्थलांतरित पिग्मी यादी पॉप-अप मध्ये पहा"
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
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण स्थलांतरित पिग्मी</div>
            <div className="text-sm font-black text-gray-900">{migratedAccounts.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण आरंभिक शिल्लक</div>
            <div className="text-sm font-black text-emerald-800">₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय एजंट्स (Active Agents)</div>
            <div className="text-sm font-black text-indigo-950">{activeAgentsCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">आर्थिक वर्ष व शिल्लक तारीख</div>
            <div className="text-xs font-black text-amber-800">
              {formData.financialYear} {formData.asOfDate ? `(${formData.asOfDate.split('-').reverse().join('/')} अखेर)` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN SINGLE UNIFIED FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          editingAccountId ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Member, Scheme & Agent */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <UserCheck className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. खाते, योजना व एजंट तपशील (Account, Scheme & Agent Details)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>
                  सभासद निवडा (Member) <span className="text-red-500">*</span>
                </label>
                <MemberSearchSelect
                  members={members}
                  value={formData.memberID ? Number(formData.memberID) : ''}
                  onChange={(val) => setFormData(prev => ({ ...prev, memberID: val ? String(val) : '' }))}
                  placeholder="-- सभासद नाव, कोड किंवा मोबाईलने शोधा --"
                />
              </div>

              <div>
                <label className={labelClass}>
                  पिग्मी योजना (Pigmy Scheme) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className={inputClass}
                  value={formData.pigmySchemeID}
                  onChange={(e) => setFormData({ ...formData, pigmySchemeID: e.target.value })}
                >
                  <option value="">-- योजना निवडा --</option>
                  {schemes.map(s => (
                    <option key={s.pigmySchemeID} value={s.pigmySchemeID}>{s.schemeName} ({s.interestRate}%)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  पिग्मी एजंट (Select Agent) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className={inputClass}
                  value={formData.pigmyAgentID}
                  onChange={(e) => setFormData({ ...formData, pigmyAgentID: e.target.value })}
                >
                  <option value="">-- एजंट निवडा --</option>
                  {agents.map(a => (
                    <option key={a.pigmyAgentID} value={a.pigmyAgentID}>{a.agentName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Balance & Date Details */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <IndianRupee className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. शिल्लक व तारीख तपशील (Balance & Date Details)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>मूळ उघडल्याची तारीख (Opening Date) <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  required
                  className={inputClass}
                  value={formData.openingDate}
                  onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
                />
              </div>

              <div>
                <label className={labelClass}>३१ मार्च ची शिल्लक रक्कम (Balance ₹) <span className="text-red-500">*</span></label>
                <input 
                  ref={balanceInputRef}
                  type="number" 
                  step="0.01"
                  required
                  className={`${inputClass} font-mono font-bold text-emerald-700`}
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className={labelClass}>
                  आर्थिक वर्ष (Financial Year) <span className="text-red-500">*</span>
                </label>
                <select 
                  required
                  className={`${inputClass} font-mono font-bold text-primary`}
                  value={formData.financialYear}
                  onChange={(e) => handleFinancialYearChange(e.target.value)}
                >
                  {financialYears.length > 0 ? (
                    financialYears.map((fy: any) => (
                      <option key={fy.financialYearID || fy.yearCode} value={fy.yearCode}>
                        {fy.yearCode} {fy.isActive ? '(चालू वर्ष)' : ''}
                      </option>
                    ))
                  ) : (
                    <option value="2025-2026">2025-2026</option>
                  )}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  शिल्लक तारीख (As Of Date) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  required
                  className={`${inputClass} font-mono font-bold text-primary`}
                  value={formData.asOfDate}
                  onChange={(e) => setFormData({ ...formData, asOfDate: e.target.value })}
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  * आर्थिक वर्षाच्या १ दिवस आधीची तारीख
                </span>
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
              <span>{editingAccountId ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 ${
                editingAccountId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'जतन होत आहे...' : editingAccountId ? 'बदल सेव्ह करा (Update)' : 'पिग्मी खाते स्थलांतर सेव्ह करा (Migrate Pigmy)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: MIGRATED PIGMY ACCOUNTS LIST                                */}
      {/* ========================================================================= */}
      {showMigratedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>स्थलांतरित पिग्मी खाती यादी (Migrated Pigmy Accounts List)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredAccounts.length} खाती
                  </span>
                </h2>
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

            {/* Modal Filter Toolbar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input 
                  type="text" 
                  placeholder="खाते क्र, सभासद नाव किंवा एजंटने शोधा..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-6 py-1 border border-gray-300 rounded-sm text-xs h-[30px] w-64 lg:w-80 focus:outline-none focus:border-primary bg-white shadow-2xs"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={filteredAccounts.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="एक्सेल फाइल डाउनलोड करा"
              >
                <FileSpreadsheet size={13} />
                <span>एक्सेल एक्सपोर्ट</span>
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-24">कृती</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">खाते क्रमांक</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">सभासद नाव & कोड</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">पिग्मी योजना</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">एजंट नाव</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">आरंभिक शिल्लक (₹)</th>
                      <th className="px-2 py-1.5 text-center w-24">उघडल्याची तारीख</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredAccounts.map((acc) => (
                      <tr key={acc.pigmyAccountID} className="hover:bg-primary/5 transition-colors">
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => handleEdit(acc)} 
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="खाते फॉर्ममध्ये लोड करा (Load in Form)"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>सुधारा</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleDelete(acc.pigmyAccountID, acc.accountNo)} 
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="खाते डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-mono font-bold text-primary">
                          {acc.accountNo}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-bold text-gray-900">{acc.member ? `${acc.member.firstName} ${acc.member.lastName}` : `सभासद ID: ${acc.memberID}`}</div>
                          <div className="text-[10px] text-gray-500 font-mono">कोड: {acc.member?.memberCode || '-'}</div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium text-gray-800">
                          {acc.pigmyScheme?.schemeName || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium text-gray-700">
                          {acc.pigmyAgent?.agentName || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                          ₹{(acc.totalDepositedAmount || acc.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-gray-600">
                          {acc.openingDate ? new Date(acc.openingDate).toLocaleDateString('en-IN') : '-'}
                        </td>
                      </tr>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतेही स्थलांतरित पिग्मी खाते सापडले नाही.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex justify-between items-center text-xs shrink-0">
              <span className="text-gray-500 font-medium">
                टीप: 'सुधारा' वर क्लिक केल्यास खाते थेट मुख्य फॉर्ममध्ये संपादन करण्यासाठी लोड होईल.
              </span>
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
      )}

      {/* ATTRACTIVE SUCCESS CONFIRMATION MODAL (छान आणि आकर्षक संदेश पेटी) */}
      {successModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header with Emerald Gradient */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex justify-between items-center relative overflow-hidden shadow-sm">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner">
                  <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-base tracking-tight">
                      {successModalData.isEdit ? 'पिग्मी खाते अद्ययावत केले!' : '🎉 पिग्मी खाते स्थलांतर यशस्वी!'}
                    </h3>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  </div>
                  <p className="text-[11px] text-emerald-100 font-medium">
                    {successModalData.isEdit ? 'Pigmy Account Updated Successfully' : 'Pigmy Opening Balance Migrated Successfully'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSuccessModalData(null)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white/90 hover:text-white transition-colors relative z-10 cursor-pointer"
                title="बंद करा"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body with Rich Metadata */}
            <div className="p-5 space-y-4 bg-slate-50/80 text-xs">
              
              {/* Highlight Card: Account Number & Balance */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/60 p-4 rounded-2xl border border-emerald-200/80 text-center space-y-1 shadow-2xs">
                <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest block">
                  स्थलांतरित पिग्मी खाते क्रमांक (Account No)
                </span>
                <div className="text-2xl font-black text-emerald-950 font-mono tracking-wider">
                  {successModalData.accountNo}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/90 rounded-full border border-emerald-300/80 shadow-2xs mt-1.5">
                  <span className="text-[11px] text-slate-500 font-semibold">आरंभिक शिल्लक (Opening Balance):</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">
                    ₹ {successModalData.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* 2-Column Information Grid */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                
                {/* Row 1: Member Name */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>सभासदाचे नाव:</span>
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900 text-xs">{successModalData.memberName}</span>
                    <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary font-mono text-[10px] font-bold rounded">
                      [#{successModalData.memberCode}]
                    </span>
                  </div>
                </div>

                {/* Row 2: Scheme */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-600" />
                    <span>पिग्मी योजना:</span>
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-slate-800">{successModalData.schemeName}</span>
                    <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-900 font-bold text-[10px] rounded">
                      {successModalData.interestRate}% व्याज
                    </span>
                  </div>
                </div>

                {/* Row 3: Agent */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>पिग्मी एजंट:</span>
                  </span>
                  <span className="font-bold text-slate-800">{successModalData.agentName}</span>
                </div>

                {/* Row 4: As Of Date & Financial Year */}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>शिल्लक तारीख (As Of Date):</span>
                  </span>
                  <div className="text-right font-mono font-bold text-slate-900">
                    {successModalData.asOfDate ? successModalData.asOfDate.split('-').reverse().join('/') : '-'}
                    <span className="ml-1 text-[10px] text-gray-500 font-sans font-normal">
                      ({successModalData.financialYear} अखेर)
                    </span>
                  </div>
                </div>

              </div>

              {/* Success Info Footer Note */}
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200/70 flex items-center gap-2 text-[11px] text-emerald-900 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>सदर खात्याची सुरुवातीची शिल्लक रोजकीर्द व तेरीज पत्रकात स्वयंचलित जोडली गेली आहे.</span>
              </div>
            </div>

            {/* Modal Footer Actions Bar */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>प्रिंट पावती</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSuccessModalData(null);
                    fetchMigratedAccounts();
                    setShowMigratedModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                >
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>सर्व यादी पहा</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSuccessModalData(null);
                  setTimeout(() => {
                    balanceInputRef.current?.focus();
                  }, 100);
                }}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>➕ पुढील नवीन नोंद करा</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
