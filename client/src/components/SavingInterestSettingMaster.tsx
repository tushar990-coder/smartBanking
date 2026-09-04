import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Percent,
  Layers,
  Save,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  BookOpen,
  RotateCcw,
  Search,
  Calendar,
  FileSpreadsheet,
  X,
  Plus,
  Building,
  CreditCard
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountGroup?: { groupName: string };
}

interface SavingInterestSetting {
  settingID: number;
  schemeCode?: string | null;
  schemeName?: string | null;
  interestRate: number;
  calculationMethod: string;
  postingFrequency: string;
  effectiveDate: string;
  ledgerID?: number | null;
  savingLiabilityLedgerID?: number | null;
  interestExpenseLedgerID?: number | null;
  interestPayableLedgerID?: number | null;
  ledger?: Ledger | null;
  savingLiabilityLedger?: Ledger | null;
  interestExpenseLedger?: Ledger | null;
  interestPayableLedger?: Ledger | null;
}

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (dateStr?: string) => {
  if (!dateStr) return '';
  const cleanDate = dateStr.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const SavingInterestSettingMaster: React.FC = () => {
  const [settings, setSettings] = useState<SavingInterestSetting[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [allowManualCode, setAllowManualCode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showListModal, setShowListModal] = useState(false);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const schemeNameInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api/SavingSettings/Interest';

  const [formData, setFormData] = useState({
    schemeCode: '',
    schemeName: '',
    interestRate: '4.0',
    calculationMethod: 'Daily Product',
    postingFrequency: 'Yearly',
    effectiveDate: getTodayStr(),
    ledgerID: 0,
    savingLiabilityLedgerID: 0,
    interestExpenseLedgerID: 0,
    interestPayableLedgerID: 0
  });

  const generateSchemeCode = (settingList: SavingInterestSetting[]): string => {
    let maxNum = 0;
    settingList.forEach((s) => {
      if (s.schemeCode) {
        const match = s.schemeCode.trim().match(/SAV-?(\d+)/i) || s.schemeCode.trim().match(/SVS-?(\d+)/i) || s.schemeCode.trim().match(/SB-?(\d+)/i) || s.schemeCode.trim().match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      } else if (s.settingID) {
        if (s.settingID > maxNum) maxNum = s.settingID;
      }
    });

    const nextNum = maxNum === 0 ? 1 : maxNum + 1;
    return `SAV${String(nextNum).padStart(3, '0')}`;
  };

  const fetchLedgers = async () => {
    try {
      const response = await axios.get('/api/Ledgers');
      setLedgers(response.data || []);
    } catch (err) {
      console.error('Error fetching ledgers', err);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(API_URL);
      const fetched: SavingInterestSetting[] = response.data || [];
      setSettings(fetched);

      if (!isEditMode) {
        const nextCode = generateSchemeCode(fetched);
        setFormData((prev) => ({ ...prev, schemeCode: nextCode }));
      }
    } catch (err: any) {
      console.error('Error fetching settings', err);
      setError('व्याज दर सेटिंग लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchLedgers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string; value: string | number } }) => {
    const { name, value } = e.target;
    if (!name) return;
    setFormData((prev) => ({
      ...prev,
      [name]: name.endsWith('ID') ? (parseInt(value as string, 10) || 0) : value
    }));
  };

  const resetForm = (customList?: SavingInterestSetting[]) => {
    const listToUse = customList || settings;
    const nextCode = generateSchemeCode(listToUse);
    setFormData({
      schemeCode: nextCode,
      schemeName: '',
      interestRate: '4.0',
      calculationMethod: 'Daily Product',
      postingFrequency: 'Yearly',
      effectiveDate: getTodayStr(),
      ledgerID: 0,
      savingLiabilityLedgerID: 0,
      interestExpenseLedgerID: 0,
      interestPayableLedgerID: 0
    });
    setIsEditMode(false);
    setEditingId(null);
    setAllowManualCode(false);
    setError('');
    setSuccess('');
  };

  const handleEdit = (setting: SavingInterestSetting) => {
    setIsEditMode(true);
    setEditingId(setting.settingID);
    setAllowManualCode(false);
    setFormData({
      schemeCode: setting.schemeCode || '',
      schemeName: setting.schemeName || '',
      interestRate: setting.interestRate !== undefined ? String(setting.interestRate) : '4.0',
      calculationMethod: setting.calculationMethod || 'Daily Product',
      postingFrequency: setting.postingFrequency || 'Yearly',
      effectiveDate: setting.effectiveDate ? setting.effectiveDate.split('T')[0] : getTodayStr(),
      ledgerID: setting.ledgerID || 0,
      savingLiabilityLedgerID: setting.savingLiabilityLedgerID || setting.ledgerID || 0,
      interestExpenseLedgerID: setting.interestExpenseLedgerID || 0,
      interestPayableLedgerID: setting.interestPayableLedgerID || 0
    });
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

  const handleDelete = async (setting: SavingInterestSetting) => {
    const nameToDisplay = setting.schemeName ? `'${setting.schemeName}'` : `आयडी #${setting.settingID}`;
    if (!window.confirm(`तुम्हाला खात्री आहे का? बचत ठेव व्याजदर योजना ${nameToDisplay} हटवायची आहे?`)) return;

    try {
      setSaving(true);
      await axios.delete(`${API_URL}/${setting.settingID}`);
      setSuccess(`व्याजदर योजना ${nameToDisplay} यशस्वीरीत्या हटवली!`);
      const updatedList = settings.filter(s => s.settingID !== setting.settingID);
      setSettings(updatedList);
      if (isEditMode && editingId === setting.settingID) {
        resetForm(updatedList);
      }
    } catch (err: any) {
      console.error('Delete failed:', err);
      setError(err?.response?.data?.message || 'व्याजदर योजना हटवता आली नाही.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const rate = parseFloat(formData.interestRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setError('कृपया योग्य व्याजदर टाका (उदा. 4.0).');
      return;
    }

    if (!formData.schemeCode.trim()) {
      setError('कृपया योजना कोड टाका.');
      return;
    }

    if (!formData.savingLiabilityLedgerID || formData.savingLiabilityLedgerID <= 0) {
      setError('कृपया १. बचत ठेव देयता खाते (Saving Liability Ledger) निवडा.');
      return;
    }

    if (!formData.interestExpenseLedgerID || formData.interestExpenseLedgerID <= 0) {
      setError('कृपया २. बचत व्याज खर्च खाते (Interest Expense Ledger) निवडा.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        schemeCode: formData.schemeCode.trim(),
        schemeName: formData.schemeName.trim() || null,
        interestRate: rate,
        calculationMethod: formData.calculationMethod,
        postingFrequency: formData.postingFrequency,
        effectiveDate: formData.effectiveDate,
        ledgerID: formData.savingLiabilityLedgerID,
        savingLiabilityLedgerID: formData.savingLiabilityLedgerID,
        interestExpenseLedgerID: formData.interestExpenseLedgerID > 0 ? formData.interestExpenseLedgerID : null,
        interestPayableLedgerID: formData.interestPayableLedgerID > 0 ? formData.interestPayableLedgerID : null
      };

      if (isEditMode && editingId) {
        await axios.put(`${API_URL}/${editingId}`, {
          settingID: editingId,
          ...payload
        });
        setSuccess(`बचत ठेव व्याजदर योजना '${formData.schemeName || formData.schemeCode}' यशस्वीरीत्या अद्ययावत केली!`);
      } else {
        await axios.post(API_URL, payload);
        setSuccess(`नवीन बचत ठेव व्याजदर योजना '${formData.schemeName || formData.schemeCode}' यशस्वीरीत्या जतन झाली!`);
      }

      resetForm();
      fetchSettings();
    } catch (err: any) {
      console.error('Error saving setting:', err);
      setError(err?.response?.data?.message || 'व्याज दर सेटिंग जतन करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredSettings.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredSettings.map((s, i) => ({
      'अ.क्र.': i + 1,
      'योजना कोड': s.schemeCode || s.settingID,
      'योजनेचे नाव': s.schemeName || '-',
      'व्याजदर (%)': `${s.interestRate}%`,
      'गणना पद्धत': s.calculationMethod,
      'वारंवारता': s.postingFrequency,
      'लागू दिनांक': formatDateForDisplay(s.effectiveDate),
      'बचत ठेव खाते': s.savingLiabilityLedger?.ledgerName || s.ledger?.ledgerName || 'डिफॉल्ट'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SavingInterestSettings');
    XLSX.writeFile(wb, `Saving_Interest_Settings_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const ledgerOptions = [
    { value: 0, label: '-- डिफॉल्ट सिस्टीम लेजर वापरा --' },
    ...ledgers.map((l) => ({
      value: l.ledgerID,
      label: `${l.ledgerID} - ${l.ledgerName}${l.accountGroup ? ` (${l.accountGroup.groupName})` : ''}`
    }))
  ];

  const filteredSettings = settings.filter((s) => {
    const term = searchTerm.toLowerCase();
    const codeStr = s.schemeCode || '';
    const nameStr = s.schemeName || '';
    const rateStr = `${s.interestRate}%`;
    const ledgerStr = s.savingLiabilityLedger?.ledgerName || s.interestExpenseLedger?.ledgerName || s.ledger?.ledgerName || '';
    return codeStr.toLowerCase().includes(term) || nameStr.toLowerCase().includes(term) || rateStr.toLowerCase().includes(term) || ledgerStr.toLowerCase().includes(term);
  });

  // KPI Calculations
  const avgInterestRate = settings.length > 0 
    ? (settings.reduce((acc, s) => acc + (s.interestRate || 0), 0) / settings.length).toFixed(2)
    : '0.00';
  const mappedLedgersCount = settings.filter(s => s.savingLiabilityLedgerID && s.savingLiabilityLedgerID > 0).length;

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Percent size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>बचत ठेव व्याजदर सेटिंग</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Saving Interest Settings Master)</span>
              {isEditMode && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.schemeCode})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              बचत ठेवीचा वार्षिक व्याजदर, गणना पद्धत, जमा वारंवारता व खातावणी (GL) लेजर खाती व्यवस्थापन
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
              fetchSettings();
              setShowListModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व बचत व्याजदर योजना यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदवलेली योजना यादी पहा ({settings.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण बचत व्याज योजना</div>
            <div className="text-sm font-black text-gray-900">{settings.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सरासरी व्याजदर (% Avg)</div>
            <div className="text-sm font-black text-emerald-800">{avgInterestRate}% p.a.</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">व्याज गणना पद्धत</div>
            <div className="text-sm font-black text-indigo-950">Daily Product</div>
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
              <h2 className="text-xs font-bold text-primary">१. योजनेची मूलभूत माहिती (Scheme Basic Info)</h2>
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
                  placeholder="उदा. SAV001"
                  name="schemeCode"
                  value={formData.schemeCode}
                  onChange={(e) => setFormData({ ...formData, schemeCode: e.target.value.toUpperCase() })}
                  className={`${inputClass} font-mono font-bold ${
                    allowManualCode ? 'bg-amber-50 text-amber-900 border-amber-400' : 'bg-slate-100 text-primary cursor-not-allowed'
                  }`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>
                  योजनेचे नाव (Scheme Name)
                </label>
                <input
                  ref={schemeNameInputRef}
                  type="text"
                  name="schemeName"
                  value={formData.schemeName}
                  onChange={handleInputChange}
                  placeholder="उदा. सामान्य बचत ठेव योजना"
                  className={`${inputClass} ${isEditMode ? 'border-primary bg-amber-50/40 font-semibold' : ''}`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  लागू तारीख (Effective Date) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="effectiveDate"
                  value={formData.effectiveDate}
                  onChange={handleInputChange}
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Interest Rates & Posting Frequency */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Percent className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. व्याजदर, गणना व जमा वारंवारता (Rate & Calculation Rules)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>
                  वार्षिक व्याजदर (% p.a.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleInputChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-bold text-emerald-700 font-mono`}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>गणना पद्धत (Method)</label>
                <select
                  name="calculationMethod"
                  value={formData.calculationMethod}
                  onChange={handleInputChange}
                  className={inputClass}
                >
                  <option value="Daily Product">दैनिक शिल्लक पद्धत (Daily Product Method)</option>
                  <option value="Minimum Balance (10th to Month-end)">१० ते महिनाअखेर किमान शिल्लक (Min Bal 10th-End)</option>
                  <option value="Monthly Average">मासिक सरासरी पद्धत (Monthly Average)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>खात्यात जमा वारंवारता (Frequency)</label>
                <select
                  name="postingFrequency"
                  value={formData.postingFrequency}
                  onChange={handleInputChange}
                  className={inputClass}
                >
                  <option value="Monthly">दरमहा (Monthly)</option>
                  <option value="Quarterly">त्रैमासिक (Quarterly - ३ महिने)</option>
                  <option value="Half-Yearly">सहामाही (Half-Yearly - ६ महिने)</option>
                  <option value="Yearly">वार्षिक (Yearly - ३१ मार्च)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: GL Ledger Mappings */}
          <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">३. कोर बँकिंग खातावणी लेजर खाते मॅपिंग (GL Ledger Mappings)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  १. बचत ठेव देयता खाते (Saving Liability Ledger) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  name="savingLiabilityLedgerID"
                  value={formData.savingLiabilityLedgerID}
                  onChange={handleInputChange}
                  options={ledgerOptions}
                  placeholder="-- उदा. ११ मेंबर बचत ठेव खाते निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  बचत खात्यांची मुख्य देयता (Liability) नोंद.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  २. बचत व्याज खर्च खाते (Interest Expense Ledger) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  name="interestExpenseLedgerID"
                  value={formData.interestExpenseLedgerID}
                  onChange={handleInputChange}
                  options={ledgerOptions}
                  placeholder="-- उदा. १३१ बचत ठेवीवरील व्याज निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  नफा-तोटा खात्याशी संलग्न व्याज खर्च नोंद.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  ३. बचत देणे व्याज खाते (Interest Payable Ledger)
                </label>
                <SearchableSelect
                  name="interestPayableLedgerID"
                  value={formData.interestPayableLedgerID}
                  onChange={handleInputChange}
                  options={ledgerOptions}
                  placeholder="-- उदा. २३ देणे बचत व्याज निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  देय व्याज (Accrued Liability) खाते.
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
      {/* POP-UP MODAL: SAVED SAVING INTEREST SETTINGS LIST                        */}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेली बचत ठेव व्याजदर यादी (Saved Saving Interest Settings List)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredSettings.length} योजना
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
                  placeholder="योजना कोड, नाव किंवा लेजर शोधा..." 
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
                disabled={filteredSettings.length === 0}
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">व्याजदर (%)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">गणना पद्धत & वारंवारता</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">मॅप्ड देयता खाते</th>
                      <th className="px-2 py-1.5 text-center w-24">लागू तारीख</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredSettings.map((s) => (
                      <tr key={s.settingID} className="hover:bg-primary/5 transition-colors">
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
                              onClick={() => handleDelete(s)} 
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="योजना डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-bold text-gray-900 font-mono">{s.schemeCode || s.settingID}</div>
                          <div className="text-gray-600 font-medium">{s.schemeName || '-'}</div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold text-emerald-700 font-mono">
                          {s.interestRate}% p.a.
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-bold text-gray-800">{s.calculationMethod}</div>
                          <div className="text-[10px] text-gray-500">{s.postingFrequency}</div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          {s.savingLiabilityLedger?.ledgerName || s.ledger?.ledgerName ? (
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-bold" title={s.savingLiabilityLedger?.ledgerName || s.ledger?.ledgerName || ''}>
                              {s.savingLiabilityLedger?.ledgerName || s.ledger?.ledgerName}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">डिफॉल्ट बचत ठेव लेजर</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-gray-600">
                          {formatDateForDisplay(s.effectiveDate)}
                        </td>
                      </tr>
                    ))}
                    {filteredSettings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतीही बचत ठेव व्याजदर योजना सापडली नाही.
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

    </div>
  );
};

export default SavingInterestSettingMaster;
