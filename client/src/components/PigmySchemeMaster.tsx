import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Save,
  Edit2,
  Trash2,
  PlusCircle,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Layers,
  XCircle,
  AlertTriangle,
  X,
  BookOpen,
  RotateCcw,
  Search,
  Percent,
  Calendar,
  Building,
  Coins,
  FileSpreadsheet,
  Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountGroup?: { groupName: string };
}

interface PigmyScheme {
  pigmySchemeID?: number;
  pigmySchemeId?: number;
  id?: number;
  schemeCode?: string;
  schemeName: string;
  interestRate: number;
  durationMonths: number;
  status: string;
  pigmyLiabilityLedgerID?: number | null;
  interestExpenseLedgerID?: number | null;
  interestPayableLedgerID?: number | null;
  commissionExpenseLedgerID?: number | null;
  pigmyLiabilityLedger?: Ledger | null;
  interestExpenseLedger?: Ledger | null;
  interestPayableLedger?: Ledger | null;
  commissionExpenseLedger?: Ledger | null;
  createdBy?: number;
  createdDate?: string;
}

interface SchemeDeleteDependencyModal {
  scheme: PigmyScheme;
  schemeId: number;
  accountsCount: number;
  message: string;
}

export default function PigmySchemeMaster() {
  const [schemes, setSchemes] = useState<PigmyScheme[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showListModal, setShowListModal] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editSchemeId, setEditSchemeId] = useState<number | null>(null);
  const [allowManualCode, setAllowManualCode] = useState(false);
  const [deleteDependencyModal, setDeleteDependencyModal] = useState<SchemeDeleteDependencyModal | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const schemeNameInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    schemeCode: '',
    schemeName: '',
    interestRate: '',
    durationMonths: '12',
    status: 'Active',
    pigmyLiabilityLedgerID: 0,
    interestExpenseLedgerID: 0,
    interestPayableLedgerID: 0,
    commissionExpenseLedgerID: 0
  });

  const getSchemeId = (scheme: PigmyScheme): number => {
    return scheme.pigmySchemeID ?? scheme.pigmySchemeId ?? scheme.id ?? 0;
  };

  const generateSchemeCode = (schemeList: PigmyScheme[]): string => {
    let maxNum = 0;
    schemeList.forEach((s) => {
      if (s.schemeCode) {
        const match = s.schemeCode.trim().match(/PGS-?(\d+)/i) || s.schemeCode.trim().match(/PG-?(\d+)/i) || s.schemeCode.trim().match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      } else {
        const id = getSchemeId(s);
        if (id > maxNum) maxNum = id;
      }
    });

    const nextNum = maxNum === 0 ? 1 : maxNum + 1;
    return `PGS${String(nextNum).padStart(3, '0')}`;
  };

  const fetchSchemesAndLedgers = async () => {
    setLoading(true);
    setError('');
    try {
      const [sRes, lRes] = await Promise.all([
        axios.get('/api/PigmySchemes'),
        axios.get('/api/Ledgers')
      ]);
      const fetchedSchemes: PigmyScheme[] = sRes.data || [];
      setSchemes(fetchedSchemes);
      setLedgers(lRes.data || []);

      if (!isEditMode) {
        const nextCode = generateSchemeCode(fetchedSchemes);
        setFormData((prev) => ({ ...prev, schemeCode: nextCode }));
      }
    } catch (err: any) {
      console.error('Failed to fetch Pigmy schemes or ledgers:', err);
      setError(err?.response?.data?.message || 'पिग्मी योजना किंवा लेजर खाती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemesAndLedgers();
  }, []);

  const resetForm = (customSchemesList?: PigmyScheme[]) => {
    const listToUse = customSchemesList || schemes;
    const nextCode = generateSchemeCode(listToUse);
    setFormData({
      schemeCode: nextCode,
      schemeName: '',
      interestRate: '',
      durationMonths: '12',
      status: 'Active',
      pigmyLiabilityLedgerID: 0,
      interestExpenseLedgerID: 0,
      interestPayableLedgerID: 0,
      commissionExpenseLedgerID: 0
    });
    setIsEditMode(false);
    setEditSchemeId(null);
    setAllowManualCode(false);
    setError('');
    setSuccess('');
  };

  const handleEdit = (scheme: PigmyScheme) => {
    const sId = getSchemeId(scheme);
    setFormData({
      schemeCode: scheme.schemeCode || '',
      schemeName: scheme.schemeName || '',
      interestRate: scheme.interestRate !== undefined ? String(scheme.interestRate) : '',
      durationMonths: scheme.durationMonths !== undefined ? String(scheme.durationMonths) : '12',
      status: scheme.status || 'Active',
      pigmyLiabilityLedgerID: scheme.pigmyLiabilityLedgerID || 0,
      interestExpenseLedgerID: scheme.interestExpenseLedgerID || 0,
      interestPayableLedgerID: scheme.interestPayableLedgerID || 0,
      commissionExpenseLedgerID: scheme.commissionExpenseLedgerID || 0
    });
    setIsEditMode(true);
    setEditSchemeId(sId);
    setAllowManualCode(false);
    setError('');
    setSuccess('');
    setShowListModal(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      schemeNameInputRef.current?.focus();
      schemeNameInputRef.current?.select();
    }, 120);
  };

  const checkSchemeDependencies = async (schemeId: number) => {
    try {
      const res = await axios.get(`/api/PigmySchemes/${schemeId}/dependencies`);
      return res.data;
    } catch (err) {
      return { hasDependencies: false, accountsCount: 0 };
    }
  };

  const handleDeleteClick = async (scheme: PigmyScheme) => {
    const schemeId = getSchemeId(scheme);
    if (!schemeId) return;

    try {
      setLoading(true);
      const depInfo = await checkSchemeDependencies(schemeId);
      if (depInfo.hasDependencies && depInfo.accountsCount > 0) {
        setDeleteDependencyModal({
          scheme,
          schemeId,
          accountsCount: depInfo.accountsCount,
          message: depInfo.message || `या योजनेशी ${depInfo.accountsCount} पिग्मी खाती जोडलेली आहेत. आधी ती खाती बदला किंवा बंद करा.`
        });
        return;
      }

      if (window.confirm(`तुम्हाला खात्री आहे का? '${scheme.schemeName}' (कोड: ${scheme.schemeCode || schemeId}) ही पिग्मी योजना कायमस्वरूपी हटवायची आहे?`)) {
        await executeDelete(schemeId, scheme.schemeName);
      }
    } catch (err: any) {
      console.error('Delete check failed:', err);
      setError('योजना तपासताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const executeDelete = async (schemeId: number, schemeName: string) => {
    try {
      setSaving(true);
      await axios.delete(`/api/PigmySchemes/${schemeId}`);
      setSuccess(`पिग्मी योजना '${schemeName}' यशस्वीरीत्या हटवली!`);
      const updatedList = schemes.filter((s) => getSchemeId(s) !== schemeId);
      setSchemes(updatedList);
      if (isEditMode && editSchemeId === schemeId) {
        resetForm(updatedList);
      }
    } catch (err: any) {
      console.error('Delete failed:', err);
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'योजना हटवता आली नाही. कृपया पुन्हा प्रयत्न करा.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.schemeName.trim()) {
      setError('कृपया योजनेचे नाव प्रविष्ट करा.');
      return;
    }

    if (!formData.schemeCode.trim()) {
      setError('कृपया योजना कोड प्रविष्ट करा.');
      return;
    }

    const rate = parseFloat(formData.interestRate);
    if (isNaN(rate) || rate < 0) {
      setError('कृपया वैध व्याजदर प्रविष्ट करा (उदा. 6.5).');
      return;
    }

    const duration = parseInt(formData.durationMonths, 10);
    if (isNaN(duration) || duration <= 0) {
      setError('कृपया वैध मुदत महिने प्रविष्ट करा.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        pigmySchemeID: isEditMode && editSchemeId ? editSchemeId : 0,
        schemeCode: formData.schemeCode.trim(),
        schemeName: formData.schemeName.trim(),
        interestRate: rate,
        durationMonths: duration,
        status: formData.status,
        pigmyLiabilityLedgerID: formData.pigmyLiabilityLedgerID || null,
        interestExpenseLedgerID: formData.interestExpenseLedgerID || null,
        interestPayableLedgerID: formData.interestPayableLedgerID || null,
        commissionExpenseLedgerID: formData.commissionExpenseLedgerID || null,
        createdBy: 1,
        createdDate: new Date().toISOString()
      };

      if (isEditMode && editSchemeId) {
        await axios.put(`/api/PigmySchemes/${editSchemeId}`, payload);
        setSuccess(`पिग्मी योजना '${formData.schemeName}' (कोड: ${formData.schemeCode}) यशस्वीरीत्या अद्ययावत (Updated) झाली!`);
      } else {
        await axios.post('/api/PigmySchemes', payload);
        setSuccess(`नवीन पिग्मी योजना '${formData.schemeName}' (कोड: ${formData.schemeCode}) यशस्वीरीत्या सेव्ह (Saved) झाली!`);
      }

      resetForm();
      fetchSchemesAndLedgers();
    } catch (err: any) {
      console.error('Error saving Pigmy scheme:', err);
      setError(err?.response?.data?.message || 'योजना सेव्ह/एडिट करताना त्रुटी आली. माहिती तपासा.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredSchemes.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredSchemes.map((s, i) => ({
      'अ.क्र.': i + 1,
      'योजना कोड': s.schemeCode || getSchemeId(s),
      'योजनेचे नाव': s.schemeName,
      'कालावधी (महिने)': s.durationMonths,
      'व्याजदर (%)': s.interestRate,
      'देयता खाते': s.pigmyLiabilityLedger?.ledgerName || 'डिफॉल्ट',
      'व्याज खर्च खाते': s.interestExpenseLedger?.ledgerName || 'डिफॉल्ट',
      'कमिशन खर्च खाते': s.commissionExpenseLedger?.ledgerName || 'डिफॉल्ट',
      'स्थिती': s.status === 'Active' ? 'सक्रिय' : 'बंद'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PigmySchemes');
    XLSX.writeFile(wb, `Pigmy_Schemes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredSchemes = schemes.filter((s) => {
    const term = searchTerm.toLowerCase();
    const nameMatch = s.schemeName?.toLowerCase().includes(term);
    const codeMatch = s.schemeCode?.toLowerCase().includes(term);
    const idMatch = String(getSchemeId(s)).includes(term);
    return nameMatch || codeMatch || idMatch;
  });

  const ledgerOptions = [
    { value: 0, label: '-- डिफॉल्ट सिस्टीम लेजर वापरा --' },
    ...ledgers.map((l) => ({
      value: l.ledgerID,
      label: `${l.ledgerID} - ${l.ledgerName}${l.accountGroup ? ` (${l.accountGroup.groupName})` : ''}`
    }))
  ];

  // KPI Calculations
  const activeCount = schemes.filter(s => s.status === 'Active').length;
  const avgInterestRate = schemes.length > 0 
    ? (schemes.reduce((acc, s) => acc + (s.interestRate || 0), 0) / schemes.length).toFixed(2)
    : '0.00';
  const mappedLedgersCount = schemes.filter(s => s.pigmyLiabilityLedgerID && s.pigmyLiabilityLedgerID > 0).length;

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

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
              <span>पिग्मी योजना मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Pigmy Scheme Master)</span>
              {isEditMode && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.schemeCode})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              नवीन पिग्मी योजना तयार करा, व्याजदर, मुदत, एजंट कमिशन व जनरल लेजर खाते मॅपिंग व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isEditMode && (
            <button
              type="button"
              onClick={() => resetForm()}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>संपादन रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => resetForm()}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन योजना</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchSchemesAndLedgers();
              setShowListModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व पिग्मी योजना यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदवलेली योजना यादी पहा ({schemes.length})</span>
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
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण पिग्मी योजना</div>
            <div className="text-sm font-black text-gray-900">{schemes.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय योजना (Active)</div>
            <div className="text-sm font-black text-emerald-800">{activeCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सरासरी व्याजदर (% Avg)</div>
            <div className="text-sm font-black text-indigo-950">{avgInterestRate}% p.a.</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">मॅप्ड खातावणी खाती</div>
            <div className="text-sm font-black text-amber-800">{mappedLedgersCount}</div>
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
          
          {/* Section 1: Basic Scheme Info */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. मूलभूत योजना माहिती व व्याजदर (Basic Details & Interest)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className={labelClass}>
                    योजना कोड <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAllowManualCode(!allowManualCode)}
                    className="text-[9px] text-primary hover:underline font-bold cursor-pointer bg-primary/10 px-1 rounded border border-primary/20"
                    title={allowManualCode ? 'ऑटो जनरेट लॉक करा' : 'मॅन्युअली बदला'}
                  >
                    {allowManualCode ? 'ऑटो लॉक' : 'बदला'}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  readOnly={!allowManualCode}
                  placeholder="उदा. PGS001"
                  value={formData.schemeCode}
                  onChange={(e) => setFormData({ ...formData, schemeCode: e.target.value.toUpperCase() })}
                  className={`${inputClass} font-mono font-bold ${
                    allowManualCode ? 'bg-amber-50 text-amber-900 border-amber-400' : 'bg-slate-100 text-primary cursor-not-allowed'
                  }`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>
                  योजनेचे नाव (Scheme Name) <span className="text-red-500">*</span>
                </label>
                <input
                  ref={schemeNameInputRef}
                  type="text"
                  required
                  placeholder="उदा. डेली डबल्स पिग्मी 12M"
                  value={formData.schemeName}
                  onChange={(e) => setFormData({ ...formData, schemeName: e.target.value })}
                  className={`${inputClass} ${isEditMode ? 'border-primary bg-amber-50/40 font-semibold' : ''}`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  व्याजदर (% p.a.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="उदा. 6.5"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                  className={`${inputClass} font-bold text-emerald-700 font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>
                  मुदत (महिने) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="उदा. 12"
                  value={formData.durationMonths}
                  onChange={(e) => setFormData({ ...formData, durationMonths: e.target.value })}
                  className={`${inputClass} font-mono font-bold`}
                />
              </div>

              <div>
                <label className={labelClass}>योजना स्थिती (Status)</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={`${inputClass} font-bold`}
                >
                  <option value="Active">सक्रिय (Active)</option>
                  <option value="Inactive">बंद (Inactive)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: GL Ledger Mappings */}
          <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. कोर बँकिंग खातावणी लेजर खाते मॅपिंग (GL Ledger Mappings)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  १. पिग्मी ठेव देयता खाते (Pigmy Deposit Liability Ledger)
                </label>
                <SearchableSelect
                  name="pigmyLiabilityLedgerID"
                  value={formData.pigmyLiabilityLedgerID}
                  onChange={(e) => setFormData({ ...formData, pigmyLiabilityLedgerID: Number(e.target.value) })}
                  options={ledgerOptions}
                  placeholder="-- उदा. १० पिग्मी ठेव खाते निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  पिग्मी जमा रकमेची मुख्य देयता (Liability) नोंद.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  २. पिग्मी व्याज खर्च खाते (Pigmy Interest Expense Ledger)
                </label>
                <SearchableSelect
                  name="interestExpenseLedgerID"
                  value={formData.interestExpenseLedgerID}
                  onChange={(e) => setFormData({ ...formData, interestExpenseLedgerID: Number(e.target.value) })}
                  options={ledgerOptions}
                  placeholder="-- उदा. १३३ पिग्मी ठेवीवरील व्याज निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  नफा-तोटा खात्याशी संलग्न व्याज खर्च खाते.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  ३. पिग्मी देणे व्याज खाते (Pigmy Interest Payable Ledger)
                </label>
                <SearchableSelect
                  name="interestPayableLedgerID"
                  value={formData.interestPayableLedgerID}
                  onChange={(e) => setFormData({ ...formData, interestPayableLedgerID: Number(e.target.value) })}
                  options={ledgerOptions}
                  placeholder="-- उदा. २३ देणे पिग्मी व्याज निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  साचलेले देय व्याज (Accrued Liability) खाते.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  ४. पिग्मी एजंट कमिशन खर्च खाते (Agent Commission Expense Ledger)
                </label>
                <SearchableSelect
                  name="commissionExpenseLedgerID"
                  value={formData.commissionExpenseLedgerID}
                  onChange={(e) => setFormData({ ...formData, commissionExpenseLedgerID: Number(e.target.value) })}
                  options={ledgerOptions}
                  placeholder="-- उदा. १३४ पिग्मी एजंट कमिशन निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  पिग्मी एजंटला दिलेल्या कमिशनचा खर्च नोंद.
                </span>
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={() => resetForm()}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2 ${
                isEditMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'जतन होत आहे...' : isEditMode ? 'बदल सेव्ह करा (Update)' : 'योजना सेव्ह करा (Save Scheme)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: SAVED PIGMY SCHEMES LIST                                   */}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेली पिग्मी योजना यादी (Saved Pigmy Schemes List)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredSchemes.length} योजना
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowListModal(false)}
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
                  placeholder="योजना कोड किंवा नाव शोधा..." 
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
                disabled={filteredSchemes.length === 0}
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">योजना कोड & नाव</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">मुदत & व्याजदर</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">मॅप्ड देयता खाते</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredSchemes.map((s) => {
                      const schemeId = getSchemeId(s);
                      return (
                        <tr key={schemeId} className="hover:bg-primary/5 transition-colors">
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                type="button" 
                                onClick={() => handleEdit(s)} 
                                className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="योजना फॉर्ममध्ये लोड करा (Load in Form)"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>सुधारा</span>
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleDeleteClick(s)} 
                                className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="योजना डिलीट करा (Delete)"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>बाद</span>
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                            <div className="font-bold text-gray-900 font-mono">{s.schemeCode || schemeId}</div>
                            <div className="text-gray-600 font-medium">{s.schemeName}</div>
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                            <div className="text-emerald-700 font-bold font-mono">{s.interestRate}% p.a.</div>
                            <div className="text-gray-500 text-[10px]">{s.durationMonths} महिने</div>
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                            {s.pigmyLiabilityLedger?.ledgerName ? (
                              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-bold" title={s.pigmyLiabilityLedger.ledgerName}>
                                {s.pigmyLiabilityLedger.ledgerName}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">डिफॉल्ट पिग्मी ठेव लेजर</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {s.status === 'Active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredSchemes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतीही पिग्मी योजना सापडली नाही.
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
                टीप: 'सुधारा' वर क्लिक केल्यास योजना थेट मुख्य फॉर्ममध्ये संपादन करण्यासाठी लोड होईल.
              </span>
              <button
                type="button"
                onClick={() => setShowListModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-xs font-bold transition-all cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Dependency Modal */}
      {deleteDependencyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-md shadow-xl border border-gray-300 max-w-md w-full p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm border-b pb-2">
              <AlertTriangle size={18} />
              <span>योजना डिलीट करता येणार नाही (Dependency Alert)</span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              {deleteDependencyModal.message}
            </p>
            <div className="bg-rose-50 border border-rose-200 rounded p-2 text-[11px] text-rose-900 font-bold">
              सक्रिय खाती: {deleteDependencyModal.accountsCount}
            </div>
            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setDeleteDependencyModal(null)}
                className="px-4 py-1.5 bg-primary text-white font-bold rounded-sm text-xs"
              >
                समजले (OK)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
