import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
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
  PlusCircle,
  List,
  Percent,
  Info,
  Calendar,
  Building,
  Award,
  FileSpreadsheet,
  X,
  Plus,
  ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountGroup?: { groupName: string };
}

interface FdScheme {
  fdSchemeID: number;
  branchID: number;
  schemeCode: string;
  schemeName: string;
  durationMonths: number;
  interestRate: number;
  seniorCitizenInterestRate: number;
  interestType: string;
  interestPostingMethod: string;
  interestCompoundingFrequency: string;
  minimumAmount: number;
  maximumAmount: number;
  prematureInterestRate: number;
  effectiveDate: string;
  isActive: boolean;
  fdLiabilityLedgerID?: number | null;
  fdLiabilityLedger?: Ledger | null;
  interestExpenseLedgerID?: number | null;
  interestExpenseLedger?: Ledger | null;
  interestPayableLedgerID?: number | null;
  interestPayableLedger?: Ledger | null;
  prematurePenaltyLedgerID?: number | null;
  prematurePenaltyLedger?: Ledger | null;
}

interface FdSchemeFormData {
  branchID: number;
  schemeCode: string;
  schemeName: string;
  durationMonths: number | string;
  interestRate: number | string;
  seniorCitizenInterestRate: number | string;
  interestType: string;
  interestPostingMethod: string;
  interestCompoundingFrequency: string;
  minimumAmount: number | string;
  maximumAmount: number | string;
  prematureInterestRate: number | string;
  effectiveDate: string;
  isActive: boolean;
  fdLiabilityLedgerID: number | string;
  interestExpenseLedgerID: number | string;
  interestPayableLedgerID: number | string;
  prematurePenaltyLedgerID: number | string;
}

const FdSchemeMaster: React.FC = () => {
  const [schemes, setSchemes] = useState<FdScheme[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSchemeId, setEditSchemeId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showListModal, setShowListModal] = useState(false);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const schemeNameInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api';

  const [formData, setFormData] = useState<FdSchemeFormData>({
    branchID: 1,
    schemeCode: '',
    schemeName: '',
    durationMonths: 12,
    interestRate: 8.0,
    seniorCitizenInterestRate: 8.5,
    interestType: 'Simple',
    interestPostingMethod: 'On Principal',
    interestCompoundingFrequency: 'N/A',
    minimumAmount: 1000,
    maximumAmount: 1000000,
    prematureInterestRate: 6.0,
    effectiveDate: new Date().toISOString().split('T')[0],
    isActive: true,
    fdLiabilityLedgerID: 0,
    interestExpenseLedgerID: 0,
    interestPayableLedgerID: 0,
    prematurePenaltyLedgerID: 0,
  });

  useEffect(() => {
    fetchSchemes();
    fetchBranches();
    fetchLedgers();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API_URL}/Branches`);
      setBranches(response.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchLedgers = async () => {
    try {
      const response = await axios.get(`${API_URL}/Ledgers`);
      setLedgers(response.data || []);
    } catch (err) {
      console.error('Error fetching ledgers', err);
    }
  };

  const generateSchemeCode = (schemeList: FdScheme[]): string => {
    let maxNum = 0;
    schemeList.forEach((s) => {
      if (s.schemeCode) {
        const match = s.schemeCode.trim().match(/FD-?(\d+)/i) || s.schemeCode.trim().match(/FDS-?(\d+)/i) || s.schemeCode.trim().match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      } else if (s.fdSchemeID) {
        if (s.fdSchemeID > maxNum) maxNum = s.fdSchemeID;
      }
    });
    const nextNum = maxNum + 1;
    return `FD${nextNum.toString().padStart(3, '0')}`;
  };

  const fetchSchemes = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/FdSchemes`);
      const data = response.data || [];
      setSchemes(data);

      if (!isEditMode) {
        const autoCode = generateSchemeCode(data);
        setFormData((prev) => ({
          ...prev,
          schemeCode: autoCode
        }));
      }
    } catch (err) {
      console.error('Error fetching schemes', err);
      setError('मुदत ठेव योजना लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: any } }) => {
    const { name, value, type } = e.target as any;
    let val: any = value;
    if (type === 'checkbox') {
      val = (e.target as HTMLInputElement).checked;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: val
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.schemeName.trim()) {
      setError('कृपया मुदत ठेव योजनेचे नाव टाका.');
      return;
    }

    if (!formData.fdLiabilityLedgerID || Number(formData.fdLiabilityLedgerID) === 0) {
      setError('कृपया मुदत ठेव देयता लेजर खाते (FD Liability Ledger) निवडा.');
      return;
    }

    if (!formData.interestPayableLedgerID || Number(formData.interestPayableLedgerID) === 0) {
      setError('कृपया मुदत ठेव देणे व्याज खाते (FD Interest Payable Ledger) निवडा.');
      return;
    }

    const payload = {
      branchID: 1, // Sanstha-wide master
      schemeCode: formData.schemeCode.trim(),
      schemeName: formData.schemeName.trim(),
      durationMonths: parseInt(formData.durationMonths.toString(), 10) || 12,
      interestRate: parseFloat(formData.interestRate.toString()) || 0,
      seniorCitizenInterestRate: parseFloat(formData.seniorCitizenInterestRate.toString()) || 0,
      interestType: formData.interestType,
      interestPostingMethod: formData.interestPostingMethod,
      interestCompoundingFrequency: formData.interestCompoundingFrequency,
      minimumAmount: parseFloat(formData.minimumAmount.toString()) || 0,
      maximumAmount: parseFloat(formData.maximumAmount.toString()) || 0,
      prematureInterestRate: parseFloat(formData.prematureInterestRate.toString()) || 0,
      effectiveDate: formData.effectiveDate || new Date().toISOString().split('T')[0],
      isActive: formData.isActive,
      fdLiabilityLedgerID: Number(formData.fdLiabilityLedgerID) || null,
      interestExpenseLedgerID: Number(formData.interestExpenseLedgerID) || null,
      interestPayableLedgerID: Number(formData.interestPayableLedgerID) || null,
      prematurePenaltyLedgerID: Number(formData.prematurePenaltyLedgerID) || null,
    };

    setSaving(true);
    try {
      if (isEditMode && editSchemeId) {
        await axios.put(`${API_URL}/FdSchemes/${editSchemeId}`, {
          ...payload,
          fdSchemeID: editSchemeId
        });
        setSuccess('मुदत ठेव योजना यशस्वीरीत्या अद्ययावत (Updated) झाली!');
      } else {
        await axios.post(`${API_URL}/FdSchemes`, payload);
        setSuccess('नवीन मुदत ठेव योजना यशस्वीरीत्या सेव्ह (Saved) झाली!');
      }

      await fetchSchemes();
      resetForm();
    } catch (err: any) {
      console.error('Error saving scheme', err);
      setError(typeof err.response?.data === 'string' ? err.response.data : 'मुदत ठेव योजना जतन करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (scheme: FdScheme) => {
    setIsEditMode(true);
    setEditSchemeId(scheme.fdSchemeID);
    setFormData({
      branchID: scheme.branchID || 1,
      schemeCode: scheme.schemeCode || '',
      schemeName: scheme.schemeName || '',
      durationMonths: scheme.durationMonths || 12,
      interestRate: scheme.interestRate || 0,
      seniorCitizenInterestRate: scheme.seniorCitizenInterestRate || 0,
      interestType: scheme.interestType || 'Simple',
      interestPostingMethod: scheme.interestPostingMethod || 'On Principal',
      interestCompoundingFrequency: scheme.interestCompoundingFrequency || 'N/A',
      minimumAmount: scheme.minimumAmount || 1000,
      maximumAmount: scheme.maximumAmount || 1000000,
      prematureInterestRate: scheme.prematureInterestRate || 0,
      effectiveDate: scheme.effectiveDate ? scheme.effectiveDate.split('T')[0] : new Date().toISOString().split('T')[0],
      isActive: scheme.isActive ?? true,
      fdLiabilityLedgerID: scheme.fdLiabilityLedgerID || 0,
      interestExpenseLedgerID: scheme.interestExpenseLedgerID || 0,
      interestPayableLedgerID: scheme.interestPayableLedgerID || 0,
      prematurePenaltyLedgerID: scheme.prematurePenaltyLedgerID || 0,
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

  const handleDelete = async (id: number) => {
    if (!window.confirm('तुम्हाला खरोखर ही मुदत ठेव योजना काढून टाकायची आहे का?')) return;
    try {
      await axios.delete(`${API_URL}/FdSchemes/${id}`);
      setSuccess('मुदत ठेव योजना यशस्वीरीत्या काढून टाकली!');
      fetchSchemes();
      if (editSchemeId === id) resetForm();
    } catch (err: any) {
      console.error('Error deleting scheme', err);
      setError(typeof err.response?.data === 'string' ? err.response.data : 'योजना काढून टाकताना त्रुटी आली.');
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setEditSchemeId(null);
    const autoCode = generateSchemeCode(schemes);
    setFormData({
      branchID: 1,
      schemeCode: autoCode,
      schemeName: '',
      durationMonths: 12,
      interestRate: 8.0,
      seniorCitizenInterestRate: 8.5,
      interestType: 'Simple',
      interestPostingMethod: 'On Principal',
      interestCompoundingFrequency: 'N/A',
      minimumAmount: 1000,
      maximumAmount: 1000000,
      prematureInterestRate: 6.0,
      effectiveDate: new Date().toISOString().split('T')[0],
      isActive: true,
      fdLiabilityLedgerID: 0,
      interestExpenseLedgerID: 0,
      interestPayableLedgerID: 0,
      prematurePenaltyLedgerID: 0,
    });
    setError('');
    setSuccess('');
  };

  const handleExportExcel = () => {
    if (filteredSchemes.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredSchemes.map((s, i) => ({
      'अ.क्र.': i + 1,
      'योजना कोड': s.schemeCode,
      'योजनेचे नाव': s.schemeName,
      'कालावधी (महिने)': s.durationMonths,
      'व्याजदर (%)': s.interestRate,
      'ज्येष्ठ नागरिक दर (%)': s.seniorCitizenInterestRate,
      'व्याज प्रकार': s.interestType,
      'किमान रक्कम (₹)': s.minimumAmount,
      'कमाल रक्कम (₹)': s.maximumAmount,
      'मुदत ठेव देयता खाते': s.fdLiabilityLedger?.ledgerName || 'डिफॉल्ट',
      'स्थिती': s.isActive ? 'सक्रिय' : 'बंद'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FDSchemes');
    XLSX.writeFile(wb, `FD_Schemes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const ledgerOptions = [
    { value: 0, label: '-- डिफॉल्ट मुदत ठेव लेजर वापरा --' },
    ...ledgers.map((l) => ({
      value: l.ledgerID,
      label: `${l.ledgerID} - ${l.ledgerName}${l.accountGroup ? ` (${l.accountGroup.groupName})` : ''}`
    }))
  ];

  const filteredSchemes = schemes.filter((s) =>
    s.schemeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.schemeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.fdLiabilityLedger?.ledgerName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // KPI Calculations
  const activeCount = schemes.filter(s => s.isActive).length;
  const avgInterestRate = schemes.length > 0 
    ? (schemes.reduce((acc, s) => acc + (s.interestRate || 0), 0) / schemes.length).toFixed(2)
    : '0.00';
  const mappedLedgersCount = schemes.filter(s => s.fdLiabilityLedgerID && s.fdLiabilityLedgerID > 0).length;

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Layers size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>मुदत ठेव योजना मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(FD Scheme Master)</span>
              {isEditMode && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.schemeCode})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              मुदत ठेवीचे व्याजदर, कालावधी नियम आणि कोर बँकिंग खातावणी लेजर (GL Mappings) व्यवस्थापन
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
            title="सर्व मुदत ठेव योजना यादी पॉप-अप मध्ये पहा"
          >
            <List className="w-4 h-4" />
            <span>📋 नोंदवलेली योजना यादी पहा ({schemes.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण मुदत ठेव योजना</div>
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
      <form 
        ref={formContainerRef}
        onSubmit={handleSubmit} 
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          isEditMode ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        {/* Section 1: Basic Information & Interest Rates */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
            <Info className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold text-primary">१. मूलभूत माहिती व व्याजदर (Basic Details & Interest Rates)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div>
              <label className={labelClass}>लागू व्याप्ती (Applicability Scope)</label>
              <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-sm h-[28px]">
                <div className="p-0.5 bg-primary text-white rounded-xs">
                  <Building className="w-3 h-3" />
                </div>
                <div>
                  <span className="font-bold text-[11px] text-primary block leading-tight">🏛️ सर्व शाखांना लागू</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className={labelClass}>
                  योजना कोड (Scheme Code) <span className="text-red-500">*</span>
                </label>
                <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 rounded border border-primary/20">⚡ ऑटो (Auto)</span>
              </div>
              <input
                type="text"
                name="schemeCode"
                value={formData.schemeCode}
                readOnly
                className={`${inputClass} bg-slate-100 font-bold text-primary cursor-not-allowed font-mono`}
                required
                placeholder="उदा. FD001"
              />
            </div>

            <div>
              <label className={labelClass}>
                योजनेचे नाव (FD Scheme Name) <span className="text-red-500">*</span>
              </label>
              <input
                ref={schemeNameInputRef}
                type="text"
                name="schemeName"
                value={formData.schemeName}
                onChange={handleChange}
                className={`${inputClass} ${isEditMode ? 'border-primary bg-amber-50/40 font-semibold' : ''}`}
                required
                placeholder="उदा. १ वर्ष मुदत ठेव योजना"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1.5 border-t border-gray-200">
            <div>
              <label className={labelClass}>कालावधी (महिने - Duration) <span className="text-red-500">*</span></label>
              <input
                type="number"
                name="durationMonths"
                value={formData.durationMonths}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} font-bold text-gray-900 font-mono`}
                required
              />
            </div>

            <div>
              <label className={labelClass}>नियमित व्याजदर (% p.a.) <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                name="interestRate"
                value={formData.interestRate}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} text-emerald-700 font-bold font-mono`}
                required
              />
            </div>

            <div>
              <label className={labelClass}>ज्येष्ठ नागरिक दर (% p.a.)</label>
              <input
                type="number"
                step="0.01"
                name="seniorCitizenInterestRate"
                value={formData.seniorCitizenInterestRate}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} text-amber-700 font-bold font-mono`}
                required
              />
            </div>

            <div>
              <label className={labelClass}>मुदतीपूर्व बंद कपात दर (%)</label>
              <input
                type="number"
                step="0.01"
                name="prematureInterestRate"
                value={formData.prematureInterestRate}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} text-rose-700 font-bold font-mono`}
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Interest Calculation Rules & Limits */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
            <Percent className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold text-primary">२. व्याज नियम व मर्यादा (Interest Calculation Rules & Limits)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div>
              <label className={labelClass}>व्याज प्रकार (Interest Type) <span className="text-red-500">*</span></label>
              <select name="interestType" value={formData.interestType} onChange={handleChange} className={inputClass}>
                <option value="Simple">साधी ठेव (Simple Deposit)</option>
                <option value="Cumulative">चक्रवाढ (Cumulative Deposit)</option>
                <option value="MIS">मासिक व्याज (Monthly Income - MIS)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>व्याज मोजणी पद्धत (Posting Method)</label>
              <select name="interestPostingMethod" value={formData.interestPostingMethod} onChange={handleChange} className={inputClass}>
                <option value="On Principal">मूळ मुद्दलावर (On Principal)</option>
                <option value="On Interest">व्याजावर व्याज चक्रवाढ (On Interest)</option>
                <option value="Monthly Payout">दरमहा व्याज पेआउट (Monthly Payout)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>चक्रवाढ वारंवारता (Compounding Freq.)</label>
              <select 
                name="interestCompoundingFrequency" 
                value={formData.interestCompoundingFrequency} 
                onChange={handleChange} 
                className={inputClass}
                disabled={formData.interestType !== 'Cumulative'}
              >
                <option value="N/A">लागू नाही (N/A)</option>
                <option value="Quarterly">त्रैमासिक चक्रवाढ (Quarterly - ३ महिने)</option>
                <option value="Half-Yearly">सहामाही चक्रवाढ (Half-Yearly - ६ महिने)</option>
                <option value="Yearly">वार्षिक चक्रवाढ (Yearly - १२ महिने)</option>
                <option value="Monthly">मासिक चक्रवाढ (Monthly - १ महिना)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-gray-200">
            <div>
              <label className={labelClass}>किमान ठेव रक्कम (₹ Minimum)</label>
              <input
                type="number"
                name="minimumAmount"
                value={formData.minimumAmount}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} font-mono`}
                required
              />
            </div>

            <div>
              <label className={labelClass}>कमाल ठेव रक्कम (₹ Maximum)</label>
              <input
                type="number"
                name="maximumAmount"
                value={formData.maximumAmount}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} font-mono`}
                required
              />
            </div>

            <div>
              <label className={labelClass}>प्रभावी तारीख (Effective Date)</label>
              <input
                type="date"
                name="effectiveDate"
                value={formData.effectiveDate}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="pt-1 flex items-center">
            <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-2 rounded-sm border border-slate-200 hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange as any}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
              />
              <span className="text-xs font-bold text-gray-800">ही योजना सक्रीय आहे (Is Active)</span>
            </label>
          </div>
        </div>

        {/* Section 3: GL Ledger Mappings */}
        <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
          <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold text-primary">३. कोर बँकिंग खातावणी लेजर खाते मॅपिंग (GL Account Mappings)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                १. मुदत ठेव देयता खाते (FD Liability Ledger) <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                name="fdLiabilityLedgerID"
                value={formData.fdLiabilityLedgerID}
                onChange={handleChange}
                options={ledgerOptions}
                placeholder="-- उदा. १२ मेंबर मुदत ठेव खाते निवडा --"
              />
              <span className="text-[10px] text-gray-500 block mt-0.5">
                ठेवीची मूळ मुद्दल रक्कम (Principal Amount) जमा/नावे करण्यासाठी.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                २. मुदत ठेव देणे व्याज खाते (FD Interest Payable Ledger) <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                name="interestPayableLedgerID"
                value={formData.interestPayableLedgerID}
                onChange={handleChange}
                options={ledgerOptions}
                placeholder="-- उदा. २३ देणे सभासद ठेव व्याज खाते निवडा --"
              />
              <span className="text-[10px] text-gray-500 block mt-0.5">
                साचलेले देय व्याज (Accrued Interest Liability) फेडण्यासाठी.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                ३. मुदत ठेव व्याज खर्च खाते (FD Interest Expense Ledger)
              </label>
              <SearchableSelect
                name="interestExpenseLedgerID"
                value={formData.interestExpenseLedgerID}
                onChange={handleChange}
                options={ledgerOptions}
                placeholder="-- उदा. १३२ मुदत ठेवीवरील व्याज खाते निवडा --"
              />
              <span className="text-[10px] text-gray-500 block mt-0.5">
                ठेवीवर द्यायचा दरमहा/वार्षिक नफा-तोटा व्याज खर्च.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                ४. मुदत पूर्व कपात दंड खाते (FD Premature Penalty Ledger)
              </label>
              <SearchableSelect
                name="prematurePenaltyLedgerID"
                value={formData.prematurePenaltyLedgerID}
                onChange={handleChange}
                options={ledgerOptions}
                placeholder="-- उदा. १३२ मुदत पूर्व दंड कपात उत्पन्न खाते निवडा --"
              />
              <span className="text-[10px] text-gray-500 block mt-0.5">
                मुदतपूर्व बंद कपातीची जमा नोंद करण्यासाठी.
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
            <span>{saving ? 'साठवत आहे...' : isEditMode ? 'बदल सेव्ह करा (Update)' : 'योजना सेव्ह करा (Save Scheme)'}</span>
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: SAVED FD SCHEMES LIST                                      */}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेली मुदत ठेव योजना यादी (Saved FD Schemes List)</span>
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">कालावधी & दर</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">व्याज प्रकार</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">मॅप्ड देयता लेजर</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredSchemes.map((s) => (
                      <tr key={s.fdSchemeID} className="hover:bg-primary/5 transition-colors">
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
                              onClick={() => handleDelete(s.fdSchemeID)} 
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
                          <div className="text-emerald-700 font-bold font-mono">{s.interestRate}% p.a.</div>
                          <div className="text-gray-500 text-[10px]">{s.durationMonths} महिने</div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-medium text-gray-700">
                          {s.interestType}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          {s.fdLiabilityLedger?.ledgerName ? (
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-bold" title={s.fdLiabilityLedger.ledgerName}>
                              {s.fdLiabilityLedger.ledgerName}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">डिफॉल्ट मुदत ठेव लेजर</span>
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
                          कोणतीही मुदत ठेव योजना सापडली नाही.
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

export default FdSchemeMaster;
