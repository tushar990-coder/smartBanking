import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Repeat,
  Layers,
  PlusCircle,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Save,
  RotateCcw,
  Search,
  BookOpen,
  ShieldCheck,
  Percent,
  Calendar,
  DollarSign,
  FileSpreadsheet,
  X,
  Plus,
  Coins,
  Building
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountGroup?: { groupName: string };
}

interface RdScheme {
  rdSchemeID: number;
  schemeCode: string;
  schemeName: string;
  durationMonths: number;
  installmentAmount: number;
  minimumInstallment: number;
  maximumInstallment: number;
  interestRate: number;
  interestMethod: string;
  penaltyAmount: number;
  prematurePenaltyRate: number;
  effectiveDate: string;
  isActive: boolean;
  rdLiabilityLedgerID?: number;
  interestExpenseLedgerID?: number;
  interestPayableLedgerID?: number;
  penaltyIncomeLedgerID?: number;
  rdLiabilityLedger?: Ledger;
  interestExpenseLedger?: Ledger;
  interestPayableLedger?: Ledger;
  penaltyIncomeLedger?: Ledger;
}

export default function RdSchemeMaster() {
  const [schemes, setSchemes] = useState<RdScheme[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showListModal, setShowListModal] = useState(false);

  const [formData, setFormData] = useState({
    rdSchemeID: 0,
    schemeCode: '',
    schemeName: '',
    durationMonths: 12,
    installmentAmount: 1000,
    minimumInstallment: 500,
    maximumInstallment: 50000,
    interestRate: 8.0,
    interestMethod: 'Quarterly',
    penaltyAmount: 20,
    prematurePenaltyRate: 1.0,
    effectiveDate: new Date().toISOString().split('T')[0],
    isActive: true,
    rdLiabilityLedgerID: 0,
    interestExpenseLedgerID: 0,
    interestPayableLedgerID: 0,
    penaltyIncomeLedgerID: 0,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [allowManualCode, setAllowManualCode] = useState(false);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const schemeNameInputRef = useRef<HTMLInputElement>(null);

  const generateSchemeCode = (schemeList: RdScheme[]): string => {
    let maxNum = 0;
    schemeList.forEach((s) => {
      if (s.schemeCode) {
        const match = s.schemeCode.trim().match(/RDS-?(\d+)/i) || s.schemeCode.trim().match(/RD-?(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    });

    const nextNum = maxNum === 0 ? 1 : maxNum + 1;
    return `RDS${String(nextNum).padStart(3, '0')}`;
  };

  const fetchSchemes = async () => {
    setLoading(true);
    setError('');
    try {
      const [sRes, lRes] = await Promise.all([
        axios.get('/api/RdSchemes'),
        axios.get('/api/Ledgers'),
      ]);
      const fetched: RdScheme[] = sRes.data || [];
      setSchemes(fetched);
      setLedgers(lRes.data || []);

      if (!isEditing) {
        const autoCode = generateSchemeCode(fetched);
        setFormData((prev) => ({ ...prev, schemeCode: autoCode }));
      }
    } catch (err: any) {
      console.error('Error fetching RD schemes or ledgers', err);
      setError(err.response?.data?.message || 'आवर्ती ठेव योजना लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemes();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string, value: string | number, type?: string } }) => {
    const name = e.target.name || '';
    const value = e.target.value;
    const type = (e.target as any).type;
    let val: any = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    if (type === 'number' || name.includes('Rate') || name.includes('Amount') || name.includes('Installment') || name === 'durationMonths') {
      val = value === '' ? '' : value;
    } else if (name.endsWith('ID') || name.endsWith('Id')) {
      val = value === '' ? '' : (typeof value === 'number' ? value : parseInt(String(value), 10) || 0);
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleEdit = (scheme: RdScheme) => {
    setFormData({
      rdSchemeID: scheme.rdSchemeID,
      schemeCode: scheme.schemeCode || '',
      schemeName: scheme.schemeName || '',
      durationMonths: scheme.durationMonths || 12,
      installmentAmount: scheme.installmentAmount || 1000,
      minimumInstallment: scheme.minimumInstallment || 500,
      maximumInstallment: scheme.maximumInstallment || 50000,
      interestRate: scheme.interestRate || 8.0,
      interestMethod: scheme.interestMethod || 'Quarterly',
      penaltyAmount: scheme.penaltyAmount || 20,
      prematurePenaltyRate: scheme.prematurePenaltyRate ?? 1.0,
      effectiveDate: scheme.effectiveDate ? scheme.effectiveDate.split('T')[0] : new Date().toISOString().split('T')[0],
      isActive: scheme.isActive ?? true,
      rdLiabilityLedgerID: scheme.rdLiabilityLedgerID || 0,
      interestExpenseLedgerID: scheme.interestExpenseLedgerID || 0,
      interestPayableLedgerID: scheme.interestPayableLedgerID || 0,
      penaltyIncomeLedgerID: scheme.penaltyIncomeLedgerID || 0,
    });
    setIsEditing(true);
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

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`तुम्हाला खरोखर "${name}" ही आवर्ती ठेव योजना डिलीट करायची आहे का?`)) return;
    try {
      await axios.delete(`/api/RdSchemes/${id}`);
      setSuccess('योजना यशस्वीरित्या डिलीट केली!');
      fetchSchemes();
      if (formData.rdSchemeID === id) resetForm();
    } catch (err: any) {
      const errText = typeof err.response?.data === 'string' 
        ? err.response.data 
        : err.response?.data?.message || 'योजना डिलीट करताना त्रुटी आली.';
      setError(errText);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setAllowManualCode(false);
    const autoCode = generateSchemeCode(schemes);
    setFormData({
      rdSchemeID: 0,
      schemeCode: autoCode,
      schemeName: '',
      durationMonths: 12,
      installmentAmount: 1000,
      minimumInstallment: 500,
      maximumInstallment: 50000,
      interestRate: 8.0,
      interestMethod: 'Quarterly',
      penaltyAmount: 20,
      prematurePenaltyRate: 1.0,
      effectiveDate: new Date().toISOString().split('T')[0],
      isActive: true,
      rdLiabilityLedgerID: 0,
      interestExpenseLedgerID: 0,
      interestPayableLedgerID: 0,
      penaltyIncomeLedgerID: 0,
    });
    setError('');
    setSuccess('');
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

    const payload = {
      ...formData,
      durationMonths: parseInt(String(formData.durationMonths), 10) || 12,
      installmentAmount: parseFloat(String(formData.installmentAmount)) || 0,
      minimumInstallment: parseFloat(String(formData.minimumInstallment)) || 0,
      maximumInstallment: parseFloat(String(formData.maximumInstallment)) || 0,
      interestRate: parseFloat(String(formData.interestRate)) || 0,
      penaltyAmount: parseFloat(String(formData.penaltyAmount)) || 0,
      prematurePenaltyRate: parseFloat(String(formData.prematurePenaltyRate)) || 0,
      rdLiabilityLedgerID: formData.rdLiabilityLedgerID ? Number(formData.rdLiabilityLedgerID) : null,
      interestExpenseLedgerID: formData.interestExpenseLedgerID ? Number(formData.interestExpenseLedgerID) : null,
      interestPayableLedgerID: formData.interestPayableLedgerID ? Number(formData.interestPayableLedgerID) : null,
      penaltyIncomeLedgerID: formData.penaltyIncomeLedgerID ? Number(formData.penaltyIncomeLedgerID) : null,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await axios.put(`/api/RdSchemes/${formData.rdSchemeID}`, payload);
        setSuccess('योजना यशस्वीरित्या अद्ययावत (Updated) केली!');
      } else {
        await axios.post('/api/RdSchemes', payload);
        setSuccess('नवीन योजना यशस्वीरित्या सेव्ह (Saved) केली!');
      }
      resetForm();
      fetchSchemes();
    } catch (err: any) {
      const errText = typeof err.response?.data === 'string' 
        ? err.response.data 
        : err.response?.data?.message || 'योजना जतन करताना त्रुटी आली.';
      setError(errText);
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredSchemes.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredSchemes.map((s, i) => ({
      'अ.क्र.': i + 1,
      'योजना कोड': s.schemeCode,
      'योजनेचे नाव': s.schemeName,
      'कालावधी (महिने)': s.durationMonths,
      'हप्ता रक्कम (₹)': s.installmentAmount,
      'व्याजदर (%)': s.interestRate,
      'मुदतपूर्व कपात दर (%)': s.prematurePenaltyRate,
      'आरडी ठेव देयता खाते': s.rdLiabilityLedger?.ledgerName || 'डिफॉल्ट',
      'स्थिती': s.isActive ? 'सक्रिय' : 'बंद'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RDSchemes');
    XLSX.writeFile(wb, `RD_Schemes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredSchemes = schemes.filter((s) => {
    const codeMatch = s.schemeCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const nameMatch = s.schemeName?.toLowerCase().includes(searchTerm.toLowerCase());
    return codeMatch || nameMatch;
  });

  const ledgerOptions = [
    { value: 0, label: '-- डिफॉल्ट सिस्टीम लेजर वापरा --' },
    ...ledgers.map((l) => ({
      value: l.ledgerID,
      label: `${l.ledgerID} - ${l.ledgerName}${l.accountGroup ? ` (${l.accountGroup.groupName})` : ''}`
    })),
  ];

  // KPI Calculations
  const activeCount = schemes.filter(s => s.isActive).length;
  const avgInterestRate = schemes.length > 0 
    ? (schemes.reduce((acc, s) => acc + (s.interestRate || 0), 0) / schemes.length).toFixed(2)
    : '0.00';
  const mappedLedgersCount = schemes.filter(s => s.rdLiabilityLedgerID && s.rdLiabilityLedgerID > 0).length;

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Repeat size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>आवर्ती ठेव (RD) योजना मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(RD Scheme Master)</span>
              {isEditing && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.schemeCode})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              नवीन आवर्ती ठेव योजना तयार करा, व्याजदर, मुदतपूर्व कपात दर, लेजर खाती व अटी व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isEditing && (
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
            <span>नवीन योजना</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchSchemes();
              setShowListModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व आवर्ती ठेव योजना यादी पॉप-अप मध्ये पहा"
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
            <Repeat className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण आवर्ती ठेव योजना</div>
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
          isEditing ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Basic Info & Duration */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. योजना माहिती व कालावधी (Basic Details & Duration)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className={labelClass}>
                    योजना कोड (Scheme Code) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] bg-primary/10 text-primary font-bold px-1 rounded border border-primary/20">
                      {isEditing ? 'फिक्स्ड' : allowManualCode ? 'मॅन्युअल' : 'ऑटो'}
                    </span>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => setAllowManualCode(!allowManualCode)}
                        className="text-[9px] text-primary hover:underline font-bold cursor-pointer"
                      >
                        {allowManualCode ? 'ऑटो' : 'बदला'}
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  name="schemeCode"
                  value={formData.schemeCode}
                  onChange={handleChange}
                  readOnly={!allowManualCode && !isEditing}
                  className={`${inputClass} font-mono font-bold uppercase ${
                    !allowManualCode && !isEditing ? 'bg-slate-100 text-primary cursor-not-allowed select-none' : ''
                  }`}
                  placeholder="उदा. RDS001"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>
                  योजनेचे नाव (Scheme Name) <span className="text-red-500">*</span>
                </label>
                <input
                  ref={schemeNameInputRef}
                  type="text"
                  name="schemeName"
                  value={formData.schemeName}
                  onChange={handleChange}
                  className={`${inputClass} ${isEditing ? 'border-primary bg-amber-50/40 font-semibold' : ''}`}
                  placeholder="उदा. १२ महिने आवर्ती ठेव योजना"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>
                  कालावधी (महिने) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="durationMonths"
                  value={formData.durationMonths}
                  onChange={handleChange}
                  className={`${inputClass} font-bold text-gray-900 font-mono`}
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>
                  प्रभावी तारीख (Effective Date) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="effectiveDate"
                  value={formData.effectiveDate}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>

              <div className="flex items-center pt-3">
                <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-1.5 rounded-sm border border-slate-200 w-full hover:bg-primary/5 transition-colors">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800">ही योजना सक्रीय आहे (Is Active)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Installment, Rates & Limits */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Coins className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. हप्ता, व्याजदर व दंड कपात नियम (Installment, Rates & Limits)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>
                  नियमित व्याजदर (% p.a.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-bold text-emerald-700 font-mono`}
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>
                  मुदतपूर्व कपात दर (% p.a.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="prematurePenaltyRate"
                  value={formData.prematurePenaltyRate}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-bold text-rose-700 font-mono`}
                  step="0.01"
                  min="0"
                  placeholder="1.00"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>
                  निश्चित हप्ता रक्कम (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="installmentAmount"
                  value={formData.installmentAmount}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-bold text-primary font-mono`}
                  min="100"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>किमान हप्ता मर्यादा (₹)</label>
                <input
                  type="number"
                  name="minimumInstallment"
                  value={formData.minimumInstallment}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-mono`}
                  min="100"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>कमाल हप्ता मर्यादा (₹)</label>
                <input
                  type="number"
                  name="maximumInstallment"
                  value={formData.maximumInstallment}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-mono`}
                  min="100"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>थकीत हप्ता दंड (₹/दर १०० रु.)</label>
                <input
                  type="number"
                  name="penaltyAmount"
                  value={formData.penaltyAmount}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-mono`}
                  min="0"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 3: GL Ledger Mappings */}
          <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">३. कोर बँकिंग खातावणी लेजर खाते मॅपिंग (GL Ledger Mappings)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  १. आरडी ठेव देयता खाते (RD Deposit Liability Ledger)
                </label>
                <SearchableSelect
                  name="rdLiabilityLedgerID"
                  value={formData.rdLiabilityLedgerID}
                  onChange={handleChange}
                  options={ledgerOptions}
                  placeholder="-- लेजर निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  आरडी हप्ता जमा होणारे मुख्य देयता खाते.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  २. आरडी देणे व्याज खाते (RD Interest Payable Ledger)
                </label>
                <SearchableSelect
                  name="interestPayableLedgerID"
                  value={formData.interestPayableLedgerID}
                  onChange={handleChange}
                  options={ledgerOptions}
                  placeholder="-- लेजर निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  साचलेले देय व्याज (Accrued Interest) खाते.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  ३. आरडी व्याज खर्च खाते (RD Interest Expense Ledger)
                </label>
                <SearchableSelect
                  name="interestExpenseLedgerID"
                  value={formData.interestExpenseLedgerID}
                  onChange={handleChange}
                  options={ledgerOptions}
                  placeholder="-- लेजर निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  नफा-तोटा खात्याशी संलग्न व्याज खर्च नोंद.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  ४. आरडी दंड उत्पन्न खाते (RD Penalty Income Ledger)
                </label>
                <SearchableSelect
                  name="penaltyIncomeLedgerID"
                  value={formData.penaltyIncomeLedgerID}
                  onChange={handleChange}
                  options={ledgerOptions}
                  placeholder="-- लेजर निवडा --"
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  थकीत हप्ता दंड उत्पन्न (Income) जमा नोंद.
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
              <span>{isEditing ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2 ${
                isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'जतन होत आहे...' : isEditing ? 'बदल सेव्ह करा (Update)' : 'योजना सेव्ह करा (Save Scheme)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: SAVED RD SCHEMES LIST                                      */}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Repeat className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेली आवर्ती ठेव (RD) योजना यादी (Saved RD Schemes List)</span>
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">कालावधी & हप्ता</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">व्याज / दंड कपात</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">मॅप्ड देयता खाते</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredSchemes.map((s) => (
                      <tr key={s.rdSchemeID} className="hover:bg-primary/5 transition-colors">
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
                              onClick={() => handleDelete(s.rdSchemeID, s.schemeName)} 
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="योजना डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-bold text-gray-900 font-mono">{s.schemeCode}</div>
                          <div className="text-gray-600 font-medium">{s.schemeName}</div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                          <div className="font-bold text-primary font-mono">₹{s.installmentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          <div className="text-gray-500 text-[10px]">{s.durationMonths} महिने</div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                          <div className="text-emerald-700 font-bold font-mono">{s.interestRate}% p.a.</div>
                          <div className="text-rose-700 text-[9px] font-mono">कपात: {s.prematurePenaltyRate}%</div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          {s.rdLiabilityLedger?.ledgerName ? (
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-bold" title={s.rdLiabilityLedger.ledgerName}>
                              {s.rdLiabilityLedger.ledgerName}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">डिफॉल्ट आरडी ठेव लेजर</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {s.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredSchemes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतीही आवर्ती ठेव योजना सापडली नाही.
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
}
