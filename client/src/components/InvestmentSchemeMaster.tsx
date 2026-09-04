import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Briefcase,
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
  PieChart,
  Landmark,
  Building,
  Percent,
  FileSpreadsheet,
  X,
  Plus,
  Coins,
  TrendingUp,
  Calendar,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountGroup?: { groupName: string };
}

interface InvestmentScheme {
  schemeID: number;
  branchID: number;
  investmentInstitutionID: number;
  institutionName?: string;
  investmentInstitution?: { institutionName: string; institutionType: string };
  schemeCode: string;
  schemeName: string;
  investmentType: string; // 'Deposit' | 'Share'
  interestRate: number; // Deposit: Interest % | Share: Face Value ₹ or Dividend %
  durationMonths: number; // Deposit: Duration in Months | Share: 0
  interestCalculationMethod: string; // Deposit: Simple/Quarterly/Monthly | Share: Dividend
  prematureWithdrawalRate: number; // Deposit: Premature Rate | Share: Expected Dividend %
  isActive: boolean;
  investmentAssetLedgerID?: number | null;
  interestIncomeLedgerID?: number | null;
  interestReceivableLedgerID?: number | null;
  investmentAssetLedger?: Ledger | null;
  interestIncomeLedger?: Ledger | null;
  interestReceivableLedger?: Ledger | null;
}

interface Institution {
  institutionID: number;
  institutionName: string;
  institutionType: string;
}

const InvestmentSchemeMaster: React.FC = () => {
  const [schemes, setSchemes] = useState<InvestmentScheme[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showListModal, setShowListModal] = useState(false);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const schemeNameInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api';

  const [formData, setFormData] = useState({
    branchID: 1,
    investmentInstitutionID: 0,
    schemeCode: '',
    schemeName: '',
    investmentType: 'Deposit', // 'Deposit' | 'Share'
    // Deposit specific fields:
    interestRate: 7.0, // % p.a.
    durationMonths: 12, // months
    interestCalculationMethod: 'Simple', // Simple, Quarterly, Monthly, Yearly
    prematureWithdrawalRate: 5.5, // %
    // Share specific fields:
    faceValuePerShare: 100, // ₹ per share
    expectedDividendRate: 8.0, // %
    // Common GL Mappings:
    isActive: true,
    investmentAssetLedgerID: 0,
    interestIncomeLedgerID: 0,
    interestReceivableLedgerID: 0
  });

  useEffect(() => {
    fetchSchemes();
    fetchInstitutions();
    fetchBranches();
    fetchLedgers();
    fetchNextSchemeCode();
  }, []);

  const fetchNextSchemeCode = async () => {
    try {
      const res = await axios.get(`${API_URL}/InvestmentSchemes/NextCode`);
      if (res.data && res.data.nextCode) {
        setFormData(prev => ({ ...prev, schemeCode: res.data.nextCode }));
      }
    } catch (err) {
      console.error('Error fetching next investment scheme code', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API_URL}/Branches`);
      setBranches(response.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchInstitutions = async () => {
    try {
      const response = await axios.get(`${API_URL}/InvestmentInstitutions`);
      const list = (response.data || []).map((i: any) => ({
        ...i,
        institutionID: Number(i.institutionID || i.institutionId || i.InvestmentInstitutionID || i.investmentInstitutionID || 0)
      }));
      setInstitutions(list);
    } catch (err) {
      console.error('Error fetching institutions', err);
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

  const getSchemeId = (s: any): number => {
    if (!s) return 0;
    if (typeof s === 'number') return s;
    const candidate = s.schemeID ?? s.schemeId ?? s.SchemeID ?? s.SchemeId ?? s.id ?? s.ID ?? s.Id;
    if (candidate !== undefined && candidate !== null && Number(candidate) > 0) {
      return Number(candidate);
    }
    for (const key of Object.keys(s)) {
      if (key.toLowerCase().includes('schemeid') || key.toLowerCase() === 'id') {
        const val = Number(s[key]);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return 0;
  };

  const fetchSchemes = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/InvestmentSchemes`);
      const rawData = response.data || [];
      const normalized = rawData.map((item: any) => {
        const sid = getSchemeId(item);
        return {
          ...item,
          schemeID: sid,
          branchID: Number(item.branchID || item.BranchID || 1),
          investmentInstitutionID: Number(item.investmentInstitutionID || item.InvestmentInstitutionID || 0),
          schemeCode: item.schemeCode || item.SchemeCode || '',
          schemeName: item.schemeName || item.SchemeName || '',
          investmentType: item.investmentType || item.InvestmentType || 'Deposit',
          interestRate: Number(item.interestRate || item.InterestRate || 0),
          durationMonths: Number(item.durationMonths || item.DurationMonths || 0),
          interestCalculationMethod: item.interestCalculationMethod || item.InterestCalculationMethod || 'Simple',
          prematureWithdrawalRate: Number(item.prematureWithdrawalRate || item.PrematureWithdrawalRate || 0),
          isActive: item.isActive !== undefined ? Boolean(item.isActive) : (item.IsActive !== undefined ? Boolean(item.IsActive) : true),
          investmentAssetLedgerID: item.investmentAssetLedgerID || item.InvestmentAssetLedgerID || 0,
          interestIncomeLedgerID: item.interestIncomeLedgerID || item.InterestIncomeLedgerID || 0,
          interestReceivableLedgerID: item.interestReceivableLedgerID || item.InterestReceivableLedgerID || 0,
          institutionName: item.investmentInstitution?.institutionName || item.institutionName || ''
        };
      });
      setSchemes(normalized);
    } catch (err) {
      console.error('Error fetching investment schemes', err);
      setError('गुंतवणूक योजना लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string; value: any } }) => {
    const { name, value, type } = e.target as any;
    let val: any = value;
    if (type === 'checkbox') {
      val = (e.target as HTMLInputElement).checked;
    }
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleCategorySwitch = (type: 'Deposit' | 'Share') => {
    setFormData(prev => ({
      ...prev,
      investmentType: type,
      // If switching to Share, clear duration & premature rate
      durationMonths: type === 'Share' ? 0 : (prev.durationMonths || 12),
      interestCalculationMethod: type === 'Share' ? 'Dividend' : (prev.interestCalculationMethod === 'Dividend' ? 'Simple' : prev.interestCalculationMethod),
      interestReceivableLedgerID: type === 'Share' ? 0 : prev.interestReceivableLedgerID
    }));
  };

  const resetForm = () => {
    setIsEditMode(false);
    setEditId(null);
    setFormData({
      branchID: 1,
      investmentInstitutionID: 0,
      schemeCode: '',
      schemeName: '',
      investmentType: 'Deposit',
      interestRate: 7.0,
      durationMonths: 12,
      interestCalculationMethod: 'Simple',
      prematureWithdrawalRate: 5.5,
      faceValuePerShare: 100,
      expectedDividendRate: 8.0,
      isActive: true,
      investmentAssetLedgerID: 0,
      interestIncomeLedgerID: 0,
      interestReceivableLedgerID: 0
    });
    fetchNextSchemeCode();
    setError('');
    setSuccess('');
  };

  const handleEdit = (scheme: InvestmentScheme) => {
    const sId = getSchemeId(scheme);
    const isShare = scheme.investmentType === 'Share';
    setIsEditMode(true);
    setEditId(sId);
    setFormData({
      branchID: scheme.branchID || 1,
      investmentInstitutionID: Number(scheme.investmentInstitutionID || 0),
      schemeCode: scheme.schemeCode || '',
      schemeName: scheme.schemeName || '',
      investmentType: scheme.investmentType || 'Deposit',
      interestRate: isShare ? 0 : (scheme.interestRate || 0),
      durationMonths: isShare ? 0 : (scheme.durationMonths || 0),
      interestCalculationMethod: scheme.interestCalculationMethod || (isShare ? 'Dividend' : 'Simple'),
      prematureWithdrawalRate: isShare ? 0 : (scheme.prematureWithdrawalRate || 0),
      faceValuePerShare: isShare ? (scheme.interestRate || 100) : 100,
      expectedDividendRate: isShare ? (scheme.prematureWithdrawalRate || 8.0) : 8.0,
      isActive: scheme.isActive ?? true,
      investmentAssetLedgerID: scheme.investmentAssetLedgerID || 0,
      interestIncomeLedgerID: scheme.interestIncomeLedgerID || 0,
      interestReceivableLedgerID: isShare ? 0 : (scheme.interestReceivableLedgerID || 0)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.investmentInstitutionID || Number(formData.investmentInstitutionID) === 0) {
      setError('कृपया गुंतवणूक संस्था किंवा बँक निवडा.');
      return;
    }

    if (!formData.schemeName.trim()) {
      setError('कृपया योजनेचे नाव टाका.');
      return;
    }

    const isShare = formData.investmentType === 'Share';

    // Core Banking Data Payload
    const payload = {
      branchID: 1,
      investmentInstitutionID: Number(formData.investmentInstitutionID),
      schemeCode: formData.schemeCode.trim(),
      schemeName: formData.schemeName.trim(),
      investmentType: formData.investmentType,
      // For Deposit: interestRate & prematureWithdrawalRate
      // For Share: interestRate stores Face Value, prematureWithdrawalRate stores Expected Dividend %
      interestRate: isShare 
        ? (parseFloat(formData.faceValuePerShare.toString()) || 100)
        : (parseFloat(formData.interestRate.toString()) || 0),
      durationMonths: isShare ? 0 : (parseInt(formData.durationMonths.toString(), 10) || 0),
      interestCalculationMethod: isShare ? 'Dividend' : formData.interestCalculationMethod,
      prematureWithdrawalRate: isShare 
        ? (parseFloat(formData.expectedDividendRate.toString()) || 0)
        : (parseFloat(formData.prematureWithdrawalRate.toString()) || 0),
      isActive: formData.isActive,
      investmentAssetLedgerID: Number(formData.investmentAssetLedgerID) || null,
      interestIncomeLedgerID: Number(formData.interestIncomeLedgerID) || null,
      interestReceivableLedgerID: isShare ? null : (Number(formData.interestReceivableLedgerID) || null)
    };

    setSaving(true);
    try {
      if (isEditMode && editId) {
        await axios.put(`${API_URL}/InvestmentSchemes/${editId}`, {
          ...payload,
          schemeID: editId
        });
        setSuccess('गुंतवणूक योजना यशस्वीरीत्या अद्ययावत (Updated) झाली!');
      } else {
        await axios.post(`${API_URL}/InvestmentSchemes`, payload);
        setSuccess('नवीन गुंतवणूक योजना यशस्वीरीत्या सेव्ह (Saved) झाली!');
      }

      await fetchSchemes();
      resetForm();
    } catch (err: any) {
      console.error('Error saving investment scheme', err);
      setError(typeof err.response?.data === 'string' ? err.response.data : 'गुंतवणूक योजना जतन करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scheme: any) => {
    const sId = getSchemeId(scheme);
    if (!sId) return;

    if (!window.confirm('तुम्हाला खरोखर ही गुंतवणूक योजना काढून टाकायची आहे का?')) return;
    try {
      await axios.delete(`${API_URL}/InvestmentSchemes/${sId}`);
      setSuccess('गुंतवणूक योजना यशस्वीरीत्या काढून टाकली!');
      fetchSchemes();
      if (editId === sId) resetForm();
    } catch (err: any) {
      console.error('Error deleting scheme', err);
      setError(typeof err.response?.data === 'string' ? err.response.data : 'योजना काढून टाकताना त्रुटी आली.');
    }
  };

  const handleExportExcel = () => {
    if (filteredSchemes.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredSchemes.map((s, i) => {
      const isShare = s.investmentType === 'Share';
      return {
        'अ.क्र.': i + 1,
        'योजना कोड': s.schemeCode,
        'योजनेचे नाव': s.schemeName,
        'संस्था / बँक': s.investmentInstitution?.institutionName || s.institutionName || '-',
        'गुंतवणूक वर्गवारी': isShare ? 'शेअर्स मधील गुंतवणूक' : 'ठेवी मधील गुंतवणूक',
        'मुदत (महिने)': isShare ? 'लागू नाही (कायमस्वरूपी)' : `${s.durationMonths} महिने`,
        'व्याजदर / दर्शनी मूल्य': isShare ? `दर्शनी मूल्य: ₹${s.interestRate}` : `${s.interestRate}% p.a.`,
        'परतावा / पद्धत': isShare ? `अपेक्षित लाभांश: ${s.prematureWithdrawalRate}%` : s.interestCalculationMethod,
        'मालमत्ता खाते': s.investmentAssetLedger?.ledgerName || 'डिफॉल्ट',
        'स्थिती': s.isActive ? 'सक्रिय' : 'बंद'
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InvestmentSchemes');
    XLSX.writeFile(wb, `Investment_Schemes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const ledgerOptions = [
    { value: 0, label: '-- डिफॉल्ट सिस्टीम लेजर वापरा --' },
    ...ledgers.map(l => ({
      value: l.ledgerID,
      label: `${l.ledgerID} - ${l.ledgerName}${l.accountGroup ? ` (${l.accountGroup.groupName})` : ''}`
    }))
  ];

  const institutionOptions = [
    { value: 0, label: '-- संस्था निवडा --' },
    ...institutions
      .filter((i: any) => Number(i.institutionID || i.institutionId || i.InvestmentInstitutionID || i.investmentInstitutionID || 0) > 0)
      .map((i: any) => {
        const id = Number(i.institutionID || i.institutionId || i.InvestmentInstitutionID || i.investmentInstitutionID || 0);
        return {
          value: id,
          label: `${i.institutionName || i.name || 'संस्था'} (${i.institutionType || 'Bank'}${i.institutionBranchName ? ' - ' + i.institutionBranchName : ''})`
        };
      })
  ];

  const filteredSchemes = schemes.filter((s) => {
    const instName = s.investmentInstitution?.institutionName || s.institutionName || '';
    return (
      s.schemeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.schemeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.investmentType || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // KPI Calculations
  const depositSchemesCount = schemes.filter(s => s.investmentType === 'Deposit').length;
  const shareSchemesCount = schemes.filter(s => s.investmentType === 'Share').length;
  const activeCount = schemes.filter(s => s.isActive).length;
  const mappedLedgersCount = schemes.filter(s => s.investmentAssetLedgerID && s.investmentAssetLedgerID > 0).length;

  const isShareMode = formData.investmentType === 'Share';

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Briefcase size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>गुंतवणूक योजना मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Investment Scheme Master)</span>
              {isEditMode && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.schemeCode})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              बँकेच्या शेअर्स व ठेवी मधील (Share & Deposit Investments) गुंतवणूक योजना व खातावणी लेजर (GL Mappings) व्यवस्थापन
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
            title="सर्व गुंतवणूक योजना यादी पॉप-अप मध्ये पहा"
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
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ठेव गुंतवणूक योजना (Deposits)</div>
            <div className="text-sm font-black text-gray-900">{depositSchemesCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">शेअर्स भांडवल योजना (Shares)</div>
            <div className="text-sm font-black text-indigo-900">{shareSchemesCount}</div>
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
          
          {/* Section 1: Institution & Category */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">१. गुंतवणूक वर्गवारी व संस्था (Category & Institution)</h2>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isShareMode 
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-300' 
                  : 'bg-blue-50 text-blue-800 border-blue-300'
              }`}>
                {isShareMode ? '📊 शेअर्स भांडवल गुंतवणूक मोड' : '🏛️ बँक मुदत ठेव गुंतवणूक मोड'}
              </span>
            </div>

            {/* Investment Category Radio Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCategorySwitch('Deposit')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-sm border font-bold text-xs transition cursor-pointer ${
                  !isShareMode
                    ? 'bg-primary text-white border-primary shadow-xs ring-1 ring-primary'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-slate-50'
                }`}
              >
                <Landmark className="w-4 h-4" />
                <div className="text-left">
                  <div className="leading-tight">ठेवी मधील गुंतवणूक (Deposit Investment)</div>
                  <div className={`text-[9px] font-normal ${!isShareMode ? 'text-white/80' : 'text-gray-500'}`}>
                    बँकांमधील मुदत ठेवी, फिक्स डिपॉझिट्स (FD / RD / Call Deposits)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategorySwitch('Share')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-sm border font-bold text-xs transition cursor-pointer ${
                  isShareMode
                    ? 'bg-indigo-800 text-white border-indigo-800 shadow-xs ring-1 ring-indigo-800'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-slate-50'
                }`}
              >
                <PieChart className="w-4 h-4" />
                <div className="text-left">
                  <div className="leading-tight">शेअर्स मधील गुंतवणूक (Share Capital Investment)</div>
                  <div className={`text-[9px] font-normal ${isShareMode ? 'text-white/80' : 'text-gray-500'}`}>
                    जिल्हा बँक, शिखर बँक, फेडरेशन मधील कायमस्वरूपी शेअर्स भांडवल
                  </div>
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>लागू व्याप्ती (Scope)</label>
                <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 border border-slate-200 rounded-sm h-[28px]">
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
                  <label className="text-[11px] font-bold text-gray-700">
                    संस्था / बँक <span className="text-red-500">*</span>
                  </label>
                  <a
                    href="?page=settings&category=schemes&sub=inv-institution-sub"
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5"
                    title="नवीन बँक किंवा संस्था नोंदणी करा"
                  >
                    + नवीन संस्था जोडा
                  </a>
                </div>
                <SearchableSelect
                  name="investmentInstitutionID"
                  value={formData.investmentInstitutionID}
                  onChange={handleChange}
                  options={institutionOptions}
                  placeholder="-- संस्था निवडा --"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className={labelClass}>
                    योजना कोड <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 rounded border border-primary/20">⚡ ऑटो</span>
                </div>
                <input
                  type="text"
                  name="schemeCode"
                  value={formData.schemeCode}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold text-primary bg-slate-100`}
                  required
                  placeholder="उदा. INV001"
                />
              </div>

              <div>
                <label className={labelClass}>
                  योजनेचे नाव <span className="text-red-500">*</span>
                </label>
                <input
                  ref={schemeNameInputRef}
                  type="text"
                  name="schemeName"
                  value={formData.schemeName}
                  onChange={handleChange}
                  className={`${inputClass} ${isEditMode ? 'border-primary bg-amber-50/40 font-semibold' : ''}`}
                  required
                  placeholder={isShareMode ? 'उदा. जिल्हा बँक शेअर्स भांडवल गुंतवणूक' : 'उदा. जिल्हा बँक मुदत ठेव योजना'}
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Section 2: DYNAMIC PARAMETERS BASED ON CATEGORY (Deposit vs Share)        */}
          {/* ========================================================================= */}
          {!isShareMode ? (
            /* DEPOSIT INVESTMENT SECTION */
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-bold text-primary">२. ठेव मुदत, व्याजदर व परतावा पद्धत (Term Deposit Duration, Rates & Method)</h2>
                </div>
                <span className="text-[10px] text-gray-500 font-medium">बँक मुदत ठेव नियमावली</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelClass}>
                    व्याजदर (% p.a.) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="interestRate"
                    value={formData.interestRate}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    className={`${inputClass} font-bold text-emerald-700 font-mono`}
                    placeholder="उदा. 7.5"
                    required={!isShareMode}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    मुदत (महिने - Duration) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="durationMonths"
                    value={formData.durationMonths}
                    onChange={handleChange}
                    className={`${inputClass} font-mono font-bold`}
                    placeholder="उदा. 12"
                    required={!isShareMode}
                  />
                </div>

                <div>
                  <label className={labelClass}>व्याज आकारणी व पेआउट पद्धत</label>
                  <select
                    name="interestCalculationMethod"
                    value={formData.interestCalculationMethod}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="Simple">साधे व्याज (Simple Interest)</option>
                    <option value="Quarterly">त्रैमासिक चक्रवाढ (Quarterly Compounding)</option>
                    <option value="Monthly">मासिक पेआउट (Monthly MIS Payout)</option>
                    <option value="Yearly">वार्षिक चक्रवाढ (Yearly Compounding)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>मुदतीपूर्व मोडणी कपात दर (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="prematureWithdrawalRate"
                    value={formData.prematureWithdrawalRate}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    className={`${inputClass} font-bold text-rose-700 font-mono`}
                    placeholder="उदा. 5.5"
                  />
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-1.5 rounded-sm border border-slate-200 w-full sm:w-auto inline-flex hover:bg-primary/5 transition-colors">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange as any}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800">ही मुदत ठेव योजना सक्रीय आहे (Is Active)</span>
                </label>
                <span className="text-[10px] text-gray-500">मुदतपूर्तीनंतर ऑटो-रिन्यूअल किंवा खाते जमा नियम लागू होतील.</span>
              </div>
            </div>
          ) : (
            /* SHARE CAPITAL INVESTMENT SECTION */
            <div className="bg-indigo-50/40 p-3.5 rounded-sm border border-indigo-200 border-t-2 border-indigo-800 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-indigo-200 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-indigo-800" />
                  <h2 className="text-xs font-bold text-indigo-900">२. शेअर्स भांडवल व लाभांश तपशील (Share Capital & Dividend Details)</h2>
                </div>
                <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded border border-indigo-300">
                  🏛️ कायमस्वरूपी भांडवली मालमत्ता (Permanent Equity)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <div>
                  <label className={labelClass}>
                    दर्शनी मूल्य प्रति शेअर (Face Value ₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    name="faceValuePerShare"
                    value={formData.faceValuePerShare}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    className={`${inputClass} font-bold text-indigo-900 font-mono`}
                    placeholder="उदा. 100, 500, 1000"
                    required={isShareMode}
                  />
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    संस्थेच्या एका शेअरचे अधिकृत दर्शनी मूल्य (उदा. ₹100 किंवा ₹1,000)
                  </span>
                </div>

                <div>
                  <label className={labelClass}>
                    अपेक्षित / सरासरी लाभांश दर (% Expected Dividend p.a.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="expectedDividendRate"
                    value={formData.expectedDividendRate}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    className={`${inputClass} font-bold text-emerald-700 font-mono`}
                    placeholder="उदा. 8.0"
                  />
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    वार्षिक सर्वसाधारण सभेत (AGM) मिळणारा अंदाजित लाभांश परतावा
                  </span>
                </div>

                <div>
                  <label className={labelClass}>शेअर्स लाभांश प्रकार (Dividend Type)</label>
                  <div className="px-2 py-1 bg-white border border-indigo-200 rounded-sm h-[28px] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-700" />
                    <span className="text-[11px] font-bold text-indigo-900">वार्षिक लाभांश (Annual Dividend by AGM)</span>
                  </div>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    शेअर्सवर मासिक व्याज नसते; लाभांश जाहीर झाल्यावर थेट जमा होतो.
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between border-t border-indigo-100">
                <label className="flex items-center space-x-2 cursor-pointer bg-white p-1.5 rounded-sm border border-indigo-200 w-full sm:w-auto inline-flex hover:bg-indigo-50 transition-colors">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange as any}
                    className="h-4 w-4 text-indigo-700 focus:ring-indigo-600 border-gray-300 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800">ही शेअर्स गुंतवणूक योजना सक्रीय आहे (Is Active)</span>
                </label>
                <span className="text-[10px] text-indigo-800 font-medium">
                  टीप: शेअर्स भांडवलाला कोणतीही मुदतपूर्ती तारीख (Maturity Date) नसते.
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* Section 3: GL LEDGER MAPPINGS (Deposit vs Share)                         */}
          {/* ========================================================================= */}
          {!isShareMode ? (
            /* DEPOSIT GL MAPPINGS (3 Ledgers) */
            <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
              <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-bold text-primary">३. ठेव गुंतवणूक खातावणी लेजर खाते मॅपिंग (Deposit GL Ledger Mappings)</h2>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Asset & Interest Receivables</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                    १. ठेव गुंतवणूक मालमत्ता खाते (Term Deposit Asset Ledger)
                  </label>
                  <SearchableSelect
                    name="investmentAssetLedgerID"
                    value={formData.investmentAssetLedgerID}
                    onChange={handleChange}
                    options={ledgerOptions}
                    placeholder="-- मालमत्ता खाते निवडा --"
                  />
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    ठेव मुद्दल रक्कम जमा/नावे होणारे मालमत्ता (Asset Dr) खाते.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                    २. गुंतवणूक व्याज उत्पन्न खाते (Interest Income Ledger)
                  </label>
                  <SearchableSelect
                    name="interestIncomeLedgerID"
                    value={formData.interestIncomeLedgerID}
                    onChange={handleChange}
                    options={ledgerOptions}
                    placeholder="-- उत्पन्न खाते निवडा --"
                  />
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    मिळणारे ठेव व्याज उत्पन्न (Income Cr) नोंद खाते.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                    ३. येणे बाकी / संचित व्याज खाते (Accrued Interest Ledger)
                  </label>
                  <SearchableSelect
                    name="interestReceivableLedgerID"
                    value={formData.interestReceivableLedgerID}
                    onChange={handleChange}
                    options={ledgerOptions}
                    placeholder="-- येणे व्याज खाते निवडा --"
                  />
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    ३१ मार्च अखेर साचलेले येणे व्याज (Current Asset Dr) खाते.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* SHARE GL MAPPINGS (2 Ledgers - Asset & Dividend Income) */
            <div className="bg-indigo-50/50 p-3.5 rounded-sm border border-indigo-200 space-y-2.5">
              <div className="flex items-center justify-between border-b border-indigo-200 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-900" />
                  <h2 className="text-xs font-bold text-indigo-900">३. शेअर्स खातावणी लेजर खाते मॅपिंग (Share Capital GL Ledger Mappings)</h2>
                </div>
                <span className="text-[10px] text-indigo-800 font-mono">Permanent Asset & Dividend</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                    १. इतर सहकारी संस्था शेअर्स गुंतवणूक खाते (Shares Asset Ledger)
                  </label>
                  <SearchableSelect
                    name="investmentAssetLedgerID"
                    value={formData.investmentAssetLedgerID}
                    onChange={handleChange}
                    options={ledgerOptions}
                    placeholder="-- शेअर्स मालमत्ता खाते निवडा --"
                  />
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    खरेदी केलेल्या शेअर्सचे कायमस्वरूपी भांडवली मालमत्ता खाते (उदा. DCC बँक शेअर्स खाते - Asset Dr).
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                    २. शेअर्स लाभांश उत्पन्न खाते (Dividend Received Income Ledger)
                  </label>
                  <SearchableSelect
                    name="interestIncomeLedgerID"
                    value={formData.interestIncomeLedgerID}
                    onChange={handleChange}
                    options={ledgerOptions}
                    placeholder="-- लाभांश उत्पन्न खाते निवडा --"
                  />
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    संस्थेकडून प्राप्त होणाऱ्या लाभांशाची जमा नोंद (Dividend Income Cr) खाते.
                  </span>
                </div>
              </div>
            </div>
          )}

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
                isEditMode ? 'bg-amber-600 hover:bg-amber-700' : isShareMode ? 'bg-indigo-800 hover:bg-indigo-900' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'जतन होत आहे...' : isEditMode ? 'बदल सेव्ह करा (Update)' : isShareMode ? 'शेअर्स योजना सेव्ह करा (Save Share Scheme)' : 'ठेव योजना सेव्ह करा (Save Deposit Scheme)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: SAVED INVESTMENT SCHEMES LIST                              */}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेली गुंतवणूक योजना यादी (Saved Investment Schemes List)</span>
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
                  placeholder="योजना कोड, नाव किंवा संस्था शोधा..." 
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
                <span>एक्सेल एक्सपोर्ट (.xlsx)</span>
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">संस्था / बँक</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">वर्गवारी</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">मुदत / दर्शनी मूल्य</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">व्याज / लाभांश दर</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">मॅप्ड मालमत्ता खाते</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredSchemes.map((scheme) => {
                      const isShare = scheme.investmentType === 'Share';
                      return (
                        <tr key={scheme.schemeID} className="hover:bg-primary/5 transition-colors">
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                type="button" 
                                onClick={() => handleEdit(scheme)} 
                                className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="योजना फॉर्ममध्ये लोड करा (Load in Form)"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>सुधारा</span>
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleDelete(scheme)} 
                                className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="योजना डिलीट करा (Delete)"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>बाद</span>
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                            <div className="font-bold text-gray-900 font-mono">{scheme.schemeCode}</div>
                            <div className="text-gray-600 font-medium">{scheme.schemeName}</div>
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-left font-bold text-primary">
                            {scheme.investmentInstitution?.institutionName || scheme.institutionName || '-'}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isShare 
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-300' 
                                : 'bg-blue-50 text-blue-800 border-blue-300'
                            }`}>
                              {isShare ? '📊 शेअर्स' : '🏛️ ठेव'}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                            {isShare ? (
                              <span className="font-mono font-bold text-indigo-950">₹{scheme.interestRate} / शेअर</span>
                            ) : (
                              <span className="font-mono text-gray-700">{scheme.durationMonths} महिने</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold font-mono">
                            {isShare ? (
                              <span className="text-indigo-900">
                                {scheme.prematureWithdrawalRate > 0 ? `${scheme.prematureWithdrawalRate}% लाभांश` : 'AGM ठराव'}
                              </span>
                            ) : (
                              <span className="text-emerald-700">{scheme.interestRate}% p.a.</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                            {scheme.investmentAssetLedger?.ledgerName ? (
                              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-bold" title={scheme.investmentAssetLedger.ledgerName}>
                                {scheme.investmentAssetLedger.ledgerName}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">डिफॉल्ट मालमत्ता लेजर</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              scheme.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {scheme.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredSchemes.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतीही गुंतवणूक योजना सापडली नाही.
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

export default InvestmentSchemeMaster;
