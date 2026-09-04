import React, { useState, useEffect, useRef } from 'react';
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
  Users,
  ShieldCheck,
  TrendingUp,
  Coins,
  FileSpreadsheet,
  X,
  Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountGroup?: { groupName: string };
}

interface ShareScheme {
  shareSchemeId: number;
  branchID: number;
  schemeCode: string;
  schemeName: string;
  memberType: string;
  shareFaceValue: number;
  minSharesCount: number;
  maxSharesCount: number;
  entranceFee: number;
  buildingFund: number;
  shareTransferFee: number;
  dividendRate: number;
  hasVotingRights: boolean;
  isMobileCompulsory?: boolean;
  isAadhaarCompulsory?: boolean;
  isPanCompulsory?: boolean;
  loanEligibilityMultiplier: number;
  effectiveDate: string;
  isActive: boolean;
  shareCapitalLedgerID?: number | null;
  shareCapitalLedger?: Ledger | null;
  entranceFeeLedgerID?: number | null;
  entranceFeeLedger?: Ledger | null;
  shareTransferFeeLedgerID?: number | null;
  shareTransferFeeLedger?: Ledger | null;
  buildingFundLedgerID?: number | null;
  buildingFundLedger?: Ledger | null;
  dividendPayableLedgerID?: number | null;
  dividendPayableLedger?: Ledger | null;
}

interface ShareSchemeFormData {
  branchID: number;
  schemeCode: string;
  schemeName: string;
  memberType: string;
  shareFaceValue: number | string;
  minSharesCount: number | string;
  maxSharesCount: number | string;
  entranceFee: number | string;
  buildingFund: number | string;
  shareTransferFee: number | string;
  dividendRate: number | string;
  hasVotingRights: boolean;
  isMobileCompulsory: boolean;
  isAadhaarCompulsory: boolean;
  isPanCompulsory: boolean;
  loanEligibilityMultiplier: number | string;
  effectiveDate: string;
  isActive: boolean;
  shareCapitalLedgerID: number | string;
  entranceFeeLedgerID: number | string;
  shareTransferFeeLedgerID: number | string;
  buildingFundLedgerID: number | string;
  dividendPayableLedgerID: number | string;
}

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ShareSchemeMaster: React.FC = () => {
  const [schemes, setSchemes] = useState<ShareScheme[]>([]);
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

  const formContainerRef = useRef<HTMLFormElement>(null);
  const schemeNameInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api';

  const [formData, setFormData] = useState<ShareSchemeFormData>({
    branchID: 1,
    schemeCode: '',
    schemeName: 'नियमित सभासद शेअर योजना',
    memberType: 'Regular',
    shareFaceValue: 100.0,
    minSharesCount: 1,
    maxSharesCount: 1000,
    entranceFee: 10.0,
    buildingFund: 0.0,
    shareTransferFee: 25.0,
    dividendRate: 10.0,
    hasVotingRights: true,
    isMobileCompulsory: true,
    isAadhaarCompulsory: true,
    isPanCompulsory: false,
    loanEligibilityMultiplier: 10,
    effectiveDate: getTodayStr(),
    isActive: true,
    shareCapitalLedgerID: 0,
    entranceFeeLedgerID: 0,
    shareTransferFeeLedgerID: 0,
    buildingFundLedgerID: 0,
    dividendPayableLedgerID: 0
  });

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setLoading(true);
        const [schemesRes, branchesRes, ledgersRes] = await Promise.allSettled([
          axios.get(`${API_URL}/ShareSchemes`),
          axios.get(`${API_URL}/Branches`),
          axios.get(`${API_URL}/Ledgers`)
        ]);

        if (!isMounted) return;

        let loadedSchemes: ShareScheme[] = [];
        if (schemesRes.status === 'fulfilled') {
          loadedSchemes = Array.isArray(schemesRes.value.data) ? schemesRes.value.data : [];
          setSchemes(loadedSchemes);
        }

        if (branchesRes.status === 'fulfilled') {
          setBranches(Array.isArray(branchesRes.value.data) ? branchesRes.value.data : []);
        }

        if (ledgersRes.status === 'fulfilled') {
          setLedgers(Array.isArray(ledgersRes.value.data) ? ledgersRes.value.data : []);
        }

        if (!isEditMode && loadedSchemes.length > 0) {
          fetchNextSchemeCode('Regular');
        } else if (!isEditMode) {
          setFormData((prev) => ({ ...prev, schemeCode: 'SHR-REG-01' }));
        }
      } catch (err) {
        console.error('Error in initial load:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchSchemes = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/ShareSchemes`);
      const data = Array.isArray(response.data) ? response.data : [];
      setSchemes(data);

      if (!isEditMode) {
        fetchNextSchemeCode(formData.memberType);
      }
    } catch (err) {
      console.error('Error fetching schemes', err);
      setError('भाग भांडवल योजना लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNextSchemeCode = async (memberType: string) => {
    try {
      const res = await axios.get(`${API_URL}/ShareSchemes/NextSchemeCode?memberType=${encodeURIComponent(memberType)}`);
      if (res.data && res.data.schemeCode) {
        setFormData((prev) => ({
          ...prev,
          schemeCode: res.data.schemeCode
        }));
      }
    } catch (err) {
      const prefix = memberType === 'Regular' ? 'REG' : memberType === 'Nominal' ? 'NOM' : memberType === 'Associate' ? 'ASC' : 'INS';
      const count = (schemes || []).filter((s) => s.memberType === memberType).length + 1;
      setFormData((prev) => ({
        ...prev,
        schemeCode: `SHR-${prefix}-${count.toString().padStart(2, '0')}`
      }));
    }
  };

  const handleMemberTypeChange = (type: string) => {
    let defName = 'नियमित सभासद शेअर योजना';
    let defMin = 1;
    let defMax = 1000;
    let defFee = 10;
    let defBld = 0;
    let defTransfer = 25;
    let defDiv = 10;
    let defVote = true;
    let defMult = 10;

    if (type === 'Nominal') {
      defName = 'नाममात्र (Nominal) सभासद योजना';
      defMin = 1;
      defMax = 10;
      defFee = 10;
      defBld = 0;
      defTransfer = 0;
      defDiv = 0;
      defVote = false;
      defMult = 1;
    } else if (type === 'Associate') {
      defName = 'सहयोगी (Associate) सभासद योजना';
      defMin = 1;
      defMax = 100;
      defFee = 10;
      defBld = 0;
      defTransfer = 10;
      defDiv = 5;
      defVote = false;
      defMult = 5;
    } else if (type === 'Institutional') {
      defName = 'संस्थागत सभासद शेअर योजना';
      defMin = 10;
      defMax = 10000;
      defFee = 100;
      defBld = 0;
      defTransfer = 100;
      defDiv = 10;
      defVote = true;
      defMult = 20;
    }

    setFormData((prev) => ({
      ...prev,
      memberType: type,
      schemeName: !isEditMode ? defName : prev.schemeName,
      minSharesCount: !isEditMode ? defMin : prev.minSharesCount,
      maxSharesCount: !isEditMode ? defMax : prev.maxSharesCount,
      entranceFee: !isEditMode ? defFee : prev.entranceFee,
      buildingFund: !isEditMode ? defBld : prev.buildingFund,
      shareTransferFee: !isEditMode ? defTransfer : prev.shareTransferFee,
      dividendRate: !isEditMode ? defDiv : prev.dividendRate,
      hasVotingRights: !isEditMode ? defVote : prev.hasVotingRights,
      loanEligibilityMultiplier: !isEditMode ? defMult : prev.loanEligibilityMultiplier
    }));

    if (!isEditMode) {
      fetchNextSchemeCode(type);
    }
  };

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
      | { target: { name?: string; value: any } }
  ) => {
    const { name, value, type } = e.target as any;
    if (!name) return;
    let val: any = value;
    if (type === 'checkbox') {
      val = (e.target as HTMLInputElement).checked;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: val
    }));
  };

  const handleEdit = (scheme: ShareScheme) => {
    setIsEditMode(true);
    setEditSchemeId(scheme.shareSchemeId);
    setFormData({
      branchID: scheme.branchID || 1,
      schemeCode: scheme.schemeCode || '',
      schemeName: scheme.schemeName || '',
      memberType: scheme.memberType || 'Regular',
      shareFaceValue: scheme.shareFaceValue || 100,
      minSharesCount: scheme.minSharesCount || 1,
      maxSharesCount: scheme.maxSharesCount || 1000,
      entranceFee: scheme.entranceFee || 0,
      buildingFund: scheme.buildingFund || 0,
      shareTransferFee: scheme.shareTransferFee || 0,
      dividendRate: scheme.dividendRate || 0,
      hasVotingRights: scheme.hasVotingRights ?? true,
      isMobileCompulsory: scheme.isMobileCompulsory ?? true,
      isAadhaarCompulsory: scheme.isAadhaarCompulsory ?? true,
      isPanCompulsory: scheme.isPanCompulsory ?? false,
      loanEligibilityMultiplier: scheme.loanEligibilityMultiplier || 10,
      effectiveDate: scheme.effectiveDate ? scheme.effectiveDate.split('T')[0] : getTodayStr(),
      isActive: scheme.isActive ?? true,
      shareCapitalLedgerID: scheme.shareCapitalLedgerID || 0,
      entranceFeeLedgerID: scheme.entranceFeeLedgerID || 0,
      shareTransferFeeLedgerID: scheme.shareTransferFeeLedgerID || 0,
      buildingFundLedgerID: scheme.buildingFundLedgerID || 0,
      dividendPayableLedgerID: scheme.dividendPayableLedgerID || 0
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
    if (!window.confirm('तुम्हाला खरोखर ही भाग भांडवल योजना काढून टाकायची आहे का?')) return;
    try {
      await axios.delete(`${API_URL}/ShareSchemes/${id}`);
      setSuccess('भाग भांडवल योजना यशस्वीरीत्या काढून टाकली!');
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
    setFormData({
      branchID: 1,
      schemeCode: '',
      schemeName: 'नियमित सभासद शेअर योजना',
      memberType: 'Regular',
      shareFaceValue: 100.0,
      minSharesCount: 1,
      maxSharesCount: 1000,
      entranceFee: 10.0,
      buildingFund: 0.0,
      shareTransferFee: 25.0,
      dividendRate: 10.0,
      hasVotingRights: true,
      isMobileCompulsory: true,
      isAadhaarCompulsory: true,
      isPanCompulsory: false,
      loanEligibilityMultiplier: 10,
      effectiveDate: getTodayStr(),
      isActive: true,
      shareCapitalLedgerID: 0,
      entranceFeeLedgerID: 0,
      shareTransferFeeLedgerID: 0,
      buildingFundLedgerID: 0,
      dividendPayableLedgerID: 0
    });
    fetchNextSchemeCode('Regular');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.schemeName.trim()) {
      setError('कृपया योजनेचे नाव टाका.');
      return;
    }

    if (!formData.shareCapitalLedgerID || Number(formData.shareCapitalLedgerID) === 0) {
      setError('कृपया मुख्य भाग भांडवल जमा खाते (Share Capital Ledger) निवडा.');
      return;
    }

    const payload = {
      branchID: 1,
      schemeCode: formData.schemeCode.trim(),
      schemeName: formData.schemeName.trim(),
      memberType: formData.memberType,
      shareFaceValue: parseFloat(formData.shareFaceValue.toString()) || 100,
      minSharesCount: parseInt(formData.minSharesCount.toString(), 10) || 1,
      maxSharesCount: parseInt(formData.maxSharesCount.toString(), 10) || 1000,
      entranceFee: parseFloat(formData.entranceFee.toString()) || 0,
      buildingFund: parseFloat(formData.buildingFund.toString()) || 0,
      shareTransferFee: parseFloat(formData.shareTransferFee.toString()) || 0,
      dividendRate: parseFloat(formData.dividendRate.toString()) || 0,
      hasVotingRights: formData.hasVotingRights,
      isMobileCompulsory: formData.isMobileCompulsory,
      isAadhaarCompulsory: formData.isAadhaarCompulsory,
      isPanCompulsory: formData.isPanCompulsory,
      loanEligibilityMultiplier: parseInt(formData.loanEligibilityMultiplier.toString(), 10) || 10,
      effectiveDate: formData.effectiveDate || getTodayStr(),
      isActive: formData.isActive,
      shareCapitalLedgerID: Number(formData.shareCapitalLedgerID) || null,
      entranceFeeLedgerID: Number(formData.entranceFeeLedgerID) || null,
      shareTransferFeeLedgerID: Number(formData.shareTransferFeeLedgerID) || null,
      buildingFundLedgerID: Number(formData.buildingFundLedgerID) || null,
      dividendPayableLedgerID: Number(formData.dividendPayableLedgerID) || null
    };

    setSaving(true);
    try {
      if (isEditMode && editSchemeId) {
        await axios.put(`${API_URL}/ShareSchemes/${editSchemeId}`, {
          ...payload,
          shareSchemeId: editSchemeId
        });
        setSuccess('भाग भांडवल योजना यशस्वीरीत्या अद्ययावत (Updated) झाली!');
      } else {
        await axios.post(`${API_URL}/ShareSchemes`, payload);
        setSuccess('नवीन भाग भांडवल योजना यशस्वीरीत्या सेव्ह (Saved) झाली!');
      }

      await fetchSchemes();
      resetForm();
    } catch (err: any) {
      console.error('Error saving share scheme', err);
      const msg = err.response?.data?.message || err.response?.data || err.message || 'योजना जतन करताना त्रुटी आली.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
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
      'सभासद वर्ग': s.memberType,
      'दर्शनी मूल्य (₹)': s.shareFaceValue,
      'प्रवेश फी (₹)': s.entranceFee,
      'किमान शेअर्स': s.minSharesCount,
      'कमाल शेअर्स': s.maxSharesCount,
      'लाभांश दर (%)': s.dividendRate,
      'कर्ज पात्रता पट': `${s.loanEligibilityMultiplier}x`,
      'भाग भांडवल खाते': s.shareCapitalLedger?.ledgerName || 'डिफॉल्ट',
      'स्थिती': s.isActive ? 'सक्रिय' : 'बंद'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ShareSchemes');
    XLSX.writeFile(wb, `Share_Schemes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const safeSchemes = Array.isArray(schemes) ? schemes : [];
  const safeLedgers = Array.isArray(ledgers) ? ledgers : [];

  const filteredSchemes = safeSchemes.filter((s) => {
    if (!s) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const nameMatch = (s.schemeName || '').toLowerCase().includes(term);
    const codeMatch = (s.schemeCode || '').toLowerCase().includes(term);
    const typeMatch = (s.memberType || '').toLowerCase().includes(term);
    const ledgerMatch = (s.shareCapitalLedger?.ledgerName || '').toLowerCase().includes(term);
    return nameMatch || codeMatch || typeMatch || ledgerMatch;
  });

  const ledgerOptions = [
    { value: 0, label: '-- डिफॉल्ट लेजर वापरा किंवा निवडा --' },
    ...safeLedgers.map((l) => ({
      value: l.ledgerID,
      label: `${l.ledgerID} - ${l.ledgerName}${l.accountGroup ? ` (${l.accountGroup.groupName})` : ''}`
    }))
  ];

  // KPI Calculations
  const activeCount = safeSchemes.filter(s => s.isActive).length;
  const avgDividendRate = safeSchemes.length > 0 
    ? (safeSchemes.reduce((acc, s) => acc + (s.dividendRate || 0), 0) / safeSchemes.length).toFixed(1)
    : '0.0';
  const mappedLedgersCount = safeSchemes.filter(s => s.shareCapitalLedgerID && s.shareCapitalLedgerID > 0).length;

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
              <span>भाग भांडवल व सभासद योजना मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Share & Customer Scheme Master)</span>
              {isEditMode && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.schemeCode})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              सभासद वर्ग, दर्शनी मूल्य, प्रवेश व हस्तांतरण फी, लाभांश आणि कोर खातावणी लेजर (GL Mappings) व्यवस्थापन
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
            title="सर्व भाग भांडवल योजना यादी पॉप-अप मध्ये पहा"
          >
            <List className="w-4 h-4" />
            <span>📋 नोंदवलेली योजना यादी पहा ({safeSchemes.length})</span>
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
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण भागभांडवल योजना</div>
            <div className="text-sm font-black text-gray-900">{safeSchemes.length}</div>
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
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सरासरी लाभांश दर (%)</div>
            <div className="text-sm font-black text-indigo-950">{avgDividendRate}%</div>
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
        {/* Section 1: Basic Details & Member Category */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
            <Info className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold text-primary">१. योजना व सभासद वर्ग माहिती (Basic Details & Member Category)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
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
              <label className={labelClass}>सभासद प्रकार / वर्ग (Member Type) <span className="text-red-500">*</span></label>
              <select
                name="memberType"
                value={formData.memberType}
                onChange={(e) => handleMemberTypeChange(e.target.value)}
                className={`${inputClass} font-bold text-primary`}
              >
                <option value="Regular">नियमित सभासद (Regular - Class A)</option>
                <option value="Nominal">नाममात्र सभासद (Nominal - Class B)</option>
                <option value="Associate">सहयोगी सभासद (Associate - Class C)</option>
                <option value="Institutional">संस्थागत सभासद (Institutional)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-0.5">
                <label className={labelClass}>
                  योजना कोड (Scheme Code) <span className="text-red-500">*</span>
                </label>
                {!isEditMode && (
                  <button
                    type="button"
                    onClick={() => fetchNextSchemeCode(formData.memberType)}
                    className="text-[9px] text-primary font-bold flex items-center gap-0.5 cursor-pointer bg-primary/10 px-1 rounded border border-primary/20"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> ऑटो
                  </button>
                )}
              </div>
              <input
                type="text"
                name="schemeCode"
                value={formData.schemeCode}
                onChange={handleChange}
                className={`${inputClass} font-mono font-bold uppercase text-primary`}
                required
                placeholder="उदा. SHR-REG-01"
              />
            </div>

            <div>
              <label className={labelClass}>
                योजनेचे नाव (Scheme Name) <span className="text-red-500">*</span>
              </label>
              <input
                ref={schemeNameInputRef}
                type="text"
                name="schemeName"
                value={formData.schemeName}
                onChange={handleChange}
                className={`${inputClass} ${isEditMode ? 'border-primary bg-amber-50/40 font-semibold' : ''}`}
                required
                placeholder="उदा. नियमित सभासद भाग भांडवल योजना"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Share Value, Fees, Dividend & KYC Checks */}
        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
            <Coins className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold text-primary">२. भागभांडवल, शुल्क व अधिकार नियम (Share Value, Fees & Limits)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <div>
              <label className={labelClass}>दर्शनी मूल्य (Share Face Value ₹) <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                min="1"
                name="shareFaceValue"
                value={formData.shareFaceValue}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} font-bold text-emerald-700 font-mono`}
                required
              />
            </div>

            <div>
              <label className={labelClass}>सभासद प्रवेश फी (Entrance Fee ₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="entranceFee"
                value={formData.entranceFee}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className={labelClass}>इमारत / निधी (Building Fund ₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="buildingFund"
                value={formData.buildingFund}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className={labelClass}>हस्तांतरण फी (Transfer Fee ₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="shareTransferFee"
                value={formData.shareTransferFee}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1.5 border-t border-gray-200">
            <div>
              <label className={labelClass}>किमान शेअर्स मर्यादा (Min Shares)</label>
              <input
                type="number"
                min="1"
                name="minSharesCount"
                value={formData.minSharesCount}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className={labelClass}>कमाल शेअर्स मर्यादा (Max Shares)</label>
              <input
                type="number"
                min="1"
                name="maxSharesCount"
                value={formData.maxSharesCount}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className={labelClass}>अपेक्षित लाभांश दर (Dividend Rate %)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                name="dividendRate"
                value={formData.dividendRate}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} text-indigo-700 font-bold font-mono`}
              />
            </div>

            <div>
              <label className={labelClass}>कर्ज मर्यादा (Share Multiplier)</label>
              <input
                type="number"
                min="1"
                max="100"
                name="loanEligibilityMultiplier"
                value={formData.loanEligibilityMultiplier}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className={`${inputClass} text-primary font-bold font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1.5 border-t border-gray-200">
            <div>
              <label className={labelClass}>लागू दिनांक (Effective Date)</label>
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
                  onChange={handleChange}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-gray-800">ही योजना सक्रीय आहे (Is Active)</span>
              </label>
            </div>
          </div>

          {/* KYC & Membership Rules Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1.5 border-t border-gray-200">
            <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-2 rounded-sm border border-slate-200 hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                name="isMobileCompulsory"
                checked={formData.isMobileCompulsory}
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
              />
              <span className="text-[11px] font-bold text-gray-800">
                मोबाईल नंबर अनिवार्य
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-2 rounded-sm border border-slate-200 hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                name="isAadhaarCompulsory"
                checked={formData.isAadhaarCompulsory}
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
              />
              <span className="text-[11px] font-bold text-gray-800">
                आधार कार्ड अनिवार्य
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-2 rounded-sm border border-slate-200 hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                name="isPanCompulsory"
                checked={formData.isPanCompulsory}
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
              />
              <span className="text-[11px] font-bold text-gray-800">
                पॅन कार्ड अनिवार्य
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-2 rounded-sm border border-slate-200 hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                name="hasVotingRights"
                checked={formData.hasVotingRights}
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
              />
              <span className="text-[11px] font-bold text-gray-800">
                मतदानाचा हक्क (Voting Rights)
              </span>
            </label>
          </div>
        </div>

        {/* Section 3: GL Ledger Mappings */}
        <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-1.5">
            <h2 className="text-xs font-bold text-primary flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>३. कोर बँकिंग खातावणी लेजर खाते मॅपिंग (GL Account Mappings)</span>
            </h2>
            <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] px-2 py-0.5 rounded font-bold">
              ⚡ Single Source of Truth (SSOT)
            </span>
          </div>

          {/* Info Callout */}
          <div className="bg-white p-2.5 rounded-sm border border-primary/20 text-[11px] text-gray-800 flex items-start gap-2 shadow-2xs">
            <span className="text-base leading-none">🏛️</span>
            <div>
              <p className="font-bold text-primary">कोअर बँकिंग नियम (Core Banking Ledger Policy):</p>
              <p className="text-[10px] text-gray-600 mt-0.5 leading-relaxed">
                येथे निवडलेले <strong>"भाग भांडवल जमा खाते"</strong> हे शेअर वाटप, परतावा, हस्तांतरण, सुरुवातीची शिल्लक, सभासद खाते बंद आणि कर्ज वाटपामधील भागभांडवल कपातीसह संपूर्ण शेअर मॉड्युलमधील सर्व फॉर्म्ससाठी आपोआप लागू (Map) होईल.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                १. भाग भांडवल जमा खाते (Share Capital Ledger) <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                name="shareCapitalLedgerID"
                value={formData.shareCapitalLedgerID}
                onChange={handleChange}
                options={ledgerOptions}
                placeholder="-- भाग भांडवल खाते शोधा व निवडा --"
              />
              <span className="text-[10px] text-gray-500 block mt-0.5">
                शेअर खरेदीची मुख्य भांडवल रक्कम (Liability) जमा करण्यासाठी.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                २. प्रवेश फी उत्पन्न खाते (Entrance Fee Ledger)
              </label>
              <SearchableSelect
                name="entranceFeeLedgerID"
                value={formData.entranceFeeLedgerID}
                onChange={handleChange}
                options={ledgerOptions}
                placeholder="-- प्रवेश फी खाते शोधा व निवडा --"
              />
              <span className="text-[10px] text-gray-500 block mt-0.5">
                सभासद नोंदणी प्रवेश फी (Income) जमा करण्यासाठी.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                ३. शेअर हस्तांतरण फी खाते (Transfer Fee Ledger)
              </label>
              <SearchableSelect
                name="shareTransferFeeLedgerID"
                value={formData.shareTransferFeeLedgerID}
                onChange={handleChange}
                options={ledgerOptions}
                placeholder="-- हस्तांतरण फी खाते शोधा व निवडा --"
              />
              <span className="text-[10px] text-gray-500 block mt-0.5">
                शेअर हस्तांतरण करताना मिळणारी फी (Income) जमा करण्यासाठी.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                ४. इमारत / निधी खाते (Building Fund Ledger)
              </label>
              <SearchableSelect
                name="buildingFundLedgerID"
                value={formData.buildingFundLedgerID}
                onChange={handleChange}
                options={ledgerOptions}
                placeholder="-- इमारत निधी खाते शोधा व निवडा --"
              />
              <span className="text-[10px] text-gray-500 block mt-0.5">
                सभासदांकडून घेतलेला निधी (Fund/Liability) जमा करण्यासाठी.
              </span>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                ५. लाभांश खर्च / देय खाते (Dividend Expense Ledger)
              </label>
              <SearchableSelect
                name="dividendPayableLedgerID"
                value={formData.dividendPayableLedgerID}
                onChange={handleChange}
                options={ledgerOptions}
                placeholder="-- लाभांश खर्च खाते शोधा व निवडा --"
              />
              <span className="text-[10px] text-gray-500 block mt-0.5">
                वार्षिक लाभांश वाटपाची खर्च (Expense) नोंद करण्यासाठी.
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
      {/* POP-UP MODAL: SAVED SHARE SCHEMES LIST                                   */}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेली भाग भांडवल योजना यादी (Saved Share Schemes List)</span>
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
                  placeholder="योजना कोड, नाव, सभासद वर्ग किंवा लेजर शोधा..." 
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">सभासद वर्ग</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">दर्शनी मूल्य (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">लाभांश (%)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">मॅप्ड भांडवल खाते</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredSchemes.map((s) => (
                      <tr key={s.shareSchemeId} className="hover:bg-primary/5 transition-colors">
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
                              onClick={() => handleDelete(s.shareSchemeId)} 
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
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold text-primary">
                          {s.memberType === 'Regular' ? 'नियमित' : s.memberType === 'Nominal' ? 'नाममात्र' : s.memberType === 'Associate' ? 'सहयोगी' : s.memberType}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-bold text-emerald-700 font-mono">
                          ₹{s.shareFaceValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold text-indigo-700 font-mono">
                          {s.dividendRate}%
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          {s.shareCapitalLedger?.ledgerName ? (
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-bold" title={s.shareCapitalLedger.ledgerName}>
                              {s.shareCapitalLedger.ledgerName}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">डिफॉल्ट भाग भांडवल लेजर</span>
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
                        <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतीही भाग भांडवल योजना सापडली नाही.
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

export default ShareSchemeMaster;
