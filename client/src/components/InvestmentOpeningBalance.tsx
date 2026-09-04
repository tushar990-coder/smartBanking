import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import {
  Briefcase,
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
  Coins,
  Percent,
  Calendar,
  Building,
  BookOpen,
  Landmark,
  TrendingUp,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Institution {
  institutionID: number;
  institutionName: string;
  institutionType: string;
}

interface Scheme {
  schemeID: number;
  investmentInstitutionID: number;
  schemeName: string;
  schemeCode: string;
  investmentType: string;
  interestRate: number;
  durationMonths: number;
  interestCalculationMethod: string;
  prematureWithdrawalRate: number;
}

const InvestmentOpeningBalance: React.FC = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [filteredSchemes, setFilteredSchemes] = useState<Scheme[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [migratedAccounts, setMigratedAccounts] = useState<any[]>([]);
  const [showMigratedModal, setShowMigratedModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Deposit' | 'Share'>('All');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const principalAmountInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api';

  const [formData, setFormData] = useState({
    branchID: 1,
    investmentInstitutionID: 0,
    schemeID: 0,
    depositReceiptNo: '',
    investmentDate: new Date().toISOString().split('T')[0],
    principalAmount: 0,
    numberOfShares: 10,
    faceValuePerShare: 100,
    accruedInterestTillMigration: 0,
    nomineeName: '',
    nomineeRelation: '',
    remarks: '३१/३ स्थलांतर गुंतवणूक',
  });

  const [calcData, setCalcData] = useState({
    interestRate: 0,
    durationMonths: 0,
    interestCalculationMethod: '',
    maturityDate: '',
    expectedMaturityAmount: 0,
  });

  useEffect(() => {
    fetchInstitutions();
    fetchSchemes();
    fetchBranches();
    fetchMigratedAccounts();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/Branches`);
      setBranches(res.data || []);
    } catch {}
  };

  const fetchInstitutions = async () => {
    try {
      const res = await axios.get(`${API_URL}/InvestmentInstitutions`);
      const list = (res.data || []).map((i: any) => ({
        ...i,
        institutionID: Number(i.institutionID || i.institutionId || i.InvestmentInstitutionID || i.investmentInstitutionID || 0)
      }));
      setInstitutions(list);
    } catch {}
  };

  const fetchSchemes = async () => {
    try {
      const res = await axios.get(`${API_URL}/InvestmentSchemes`);
      const list = (res.data || []).map((s: any) => ({
        ...s,
        schemeID: Number(s.schemeID || s.schemeId || s.SchemeID || 0),
        investmentInstitutionID: Number(s.investmentInstitutionID || s.investmentInstitutionId || s.InvestmentInstitutionID || 0),
        investmentType: s.investmentType || s.InvestmentType || 'Deposit',
        interestRate: Number(s.interestRate || s.InterestRate || 0),
        durationMonths: Number(s.durationMonths || s.DurationMonths || 0),
        interestCalculationMethod: s.interestCalculationMethod || s.InterestCalculationMethod || 'Simple',
        prematureWithdrawalRate: Number(s.prematureWithdrawalRate || s.PrematureWithdrawalRate || 0)
      }));
      setSchemes(list);
    } catch {}
  };

  const fetchMigratedAccounts = async () => {
    try {
      const res = await axios.get(`${API_URL}/InvestmentAccounts`);
      if (Array.isArray(res.data)) {
        setMigratedAccounts(res.data.filter((a: any) => a.isLegacyAccount));
      }
    } catch (err) {
      console.error('Failed to fetch migrated investment accounts', err);
    }
  };

  useEffect(() => {
    const selectedInstId = Number(formData.investmentInstitutionID || 0);
    if (selectedInstId > 0) {
      setFilteredSchemes(schemes.filter((s: any) => Number(s.investmentInstitutionID || 0) === selectedInstId));
    } else {
      setFilteredSchemes(schemes);
    }
  }, [formData.investmentInstitutionID, schemes]);

  const selectedScheme = schemes.find(s => s.schemeID === Number(formData.schemeID));
  const isShareMode = selectedScheme ? selectedScheme.investmentType === 'Share' : false;

  useEffect(() => {
    if (!selectedScheme) {
      setCalcData({
        interestRate: 0,
        durationMonths: 0,
        interestCalculationMethod: '',
        maturityDate: '',
        expectedMaturityAmount: 0
      });
      return;
    }

    if (isShareMode) {
      const fv = selectedScheme.interestRate > 0 ? selectedScheme.interestRate : (formData.faceValuePerShare || 100);
      const totalShareAmt = (formData.numberOfShares || 0) * fv;
      setFormData(prev => ({
        ...prev,
        faceValuePerShare: fv,
        principalAmount: totalShareAmt
      }));
      setCalcData({
        interestRate: fv,
        durationMonths: 0,
        interestCalculationMethod: 'Dividend',
        maturityDate: formData.investmentDate,
        expectedMaturityAmount: totalShareAmt
      });
    } else {
      const pAmt = parseFloat(formData.principalAmount.toString()) || 0;
      const rate = selectedScheme.interestRate || 0;
      const months = selectedScheme.durationMonths || 12;
      const method = selectedScheme.interestCalculationMethod || 'Simple';

      const investDate = new Date(formData.investmentDate);
      let matDateStr = formData.investmentDate;
      if (!isNaN(investDate.getTime())) {
        const matDate = new Date(investDate);
        matDate.setMonth(matDate.getMonth() + months);
        matDateStr = matDate.toISOString().split('T')[0];
      }

      let maturityAmt = pAmt;
      if (pAmt > 0 && rate > 0) {
        if (method === 'Simple') {
          const interest = (pAmt * rate * months) / (12 * 100);
          maturityAmt = pAmt + interest;
        } else if (method === 'Monthly') {
          maturityAmt = pAmt;
        } else {
          const r = rate / 100;
          const t = months / 12;
          maturityAmt = pAmt * Math.pow(1 + r / 4, 4 * t);
        }
      }

      setCalcData({
        interestRate: rate,
        durationMonths: months,
        interestCalculationMethod: method,
        maturityDate: matDateStr,
        expectedMaturityAmount: Math.round(maturityAmt * 100) / 100
      });
    }
  }, [formData.schemeID, formData.principalAmount, formData.numberOfShares, formData.investmentDate, selectedScheme, isShareMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | any) => {
    const { name, value, type } = e.target;
    let val: any = type === 'number' ? (value === '' ? '' : parseFloat(value)) : value;
    if (name && (name === 'branchID' || name === 'investmentInstitutionID' || name === 'schemeID')) {
      val = parseInt(String(value), 10) || 0;
    }
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleShareQtyChange = (qty: number) => {
    const fv = formData.faceValuePerShare || 100;
    const total = qty * fv;
    setFormData(prev => ({
      ...prev,
      numberOfShares: qty,
      principalAmount: total
    }));
  };

  const handleEdit = (acc: any) => {
    const accId = acc.investmentAccountID || acc.investmentAccountId;
    const isShare = acc.investmentType === 'Share' || acc.durationMonths === 0;
    setEditingAccountId(accId);
    setFormData({
      branchID: acc.branchID || 1,
      investmentInstitutionID: acc.investmentInstitutionID || 0,
      schemeID: acc.schemeID || 0,
      depositReceiptNo: acc.depositReceiptNo || '',
      investmentDate: acc.investmentDate ? acc.investmentDate.split('T')[0] : new Date().toISOString().split('T')[0],
      principalAmount: acc.principalAmount || 0,
      numberOfShares: isShare ? Math.round((acc.principalAmount || 0) / (acc.interestRate || 100)) : 10,
      faceValuePerShare: isShare ? (acc.interestRate || 100) : 100,
      accruedInterestTillMigration: acc.accruedInterestTillMigration || 0,
      nomineeName: acc.nomineeName || '',
      nomineeRelation: acc.nomineeRelation || '',
      remarks: acc.remarks || '३१/३ स्थलांतर गुंतवणूक',
    });
    setShowMigratedModal(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      principalAmountInputRef.current?.focus();
      principalAmountInputRef.current?.select();
    }, 120);
  };

  const handleDelete = async (id: number, invNo: string) => {
    if (!window.confirm(`तुम्हाला खरोखर गुंतवणूक खाते '${invNo}' डिलीट करायचे आहे का?`)) {
      return;
    }
    try {
      await axios.delete(`${API_URL}/InvestmentAccounts/${id}`);
      setSuccess(`गुंतवणूक खाते '${invNo}' यशस्वीरीत्या डिलीट केले.`);
      fetchMigratedAccounts();
      if (editingAccountId === id) {
        resetForm();
      }
    } catch (err: any) {
      setError(typeof err.response?.data === 'string' ? err.response.data : 'गुंतवणूक खाते डिलीट करताना त्रुटी आली.');
    }
  };

  const resetForm = () => {
    setEditingAccountId(null);
    setFormData({
      branchID: 1,
      investmentInstitutionID: 0,
      schemeID: 0,
      depositReceiptNo: '',
      investmentDate: new Date().toISOString().split('T')[0],
      principalAmount: 0,
      numberOfShares: 10,
      faceValuePerShare: 100,
      accruedInterestTillMigration: 0,
      nomineeName: '',
      nomineeRelation: '',
      remarks: '३१/३ स्थलांतर गुंतवणूक',
    });
    setCalcData({
      interestRate: 0,
      durationMonths: 0,
      interestCalculationMethod: '',
      maturityDate: '',
      expectedMaturityAmount: 0
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.investmentInstitutionID) {
      setError('कृपया गुंतवणूक संस्था किंवा बँक निवडा.');
      return;
    }
    if (!formData.schemeID) {
      setError('कृपया गुंतवणूक योजना निवडा.');
      return;
    }
    if (formData.principalAmount <= 0) {
      setError('कृपया मुद्दल / शेअर्स रक्कम प्रविष्ट करा.');
      return;
    }

    const payload = {
      branchID: formData.branchID || 1,
      financialYearID: 1,
      investmentInstitutionID: Number(formData.investmentInstitutionID),
      schemeID: Number(formData.schemeID),
      depositReceiptNo: formData.depositReceiptNo?.trim() || (isShareMode ? 'SHARE-OB' : 'FDR-OB'),
      investmentDate: formData.investmentDate,
      principalAmount: parseFloat(formData.principalAmount.toString()) || 0,
      interestRate: calcData.interestRate,
      maturityDate: isShareMode ? formData.investmentDate : calcData.maturityDate,
      expectedMaturityAmount: calcData.expectedMaturityAmount || formData.principalAmount,
      accruedInterestTillMigration: isShareMode ? 0 : (parseFloat(formData.accruedInterestTillMigration.toString()) || 0),
      bookValue: (parseFloat(formData.principalAmount.toString()) || 0) + (isShareMode ? 0 : (parseFloat(formData.accruedInterestTillMigration.toString()) || 0)),
      isLegacyAccount: true,
      nomineeName: formData.nomineeName?.trim() || null,
      nomineeRelation: formData.nomineeRelation?.trim() || null,
      remarks: formData.remarks?.trim() || '३१/३ स्थलांतर गुंतवणूक',
      status: 'Active'
    };

    setSaving(true);
    try {
      if (editingAccountId) {
        await axios.put(`${API_URL}/InvestmentAccounts/${editingAccountId}`, {
          ...payload,
          investmentAccountID: editingAccountId
        });
        setSuccess(`गुंतवणूक खाते माहिती यशस्वीरीत्या अद्ययावत केली!`);
      } else {
        const response = await axios.post(`${API_URL}/InvestmentAccounts`, payload);
        setSuccess(`${response.data.message} (खाते क्र: ${response.data.investmentNo})`);
      }
      resetForm();
      fetchMigratedAccounts();
    } catch (err: any) {
      setError(typeof err.response?.data === 'string' ? err.response.data : 'गुंतवणूक खाते जतन करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (migratedAccounts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = migratedAccounts.map((a, idx) => {
      const isShare = a.investmentType === 'Share' || a.durationMonths === 0;
      return {
        'अ.क्र.': idx + 1,
        'खाते क्रमांक': a.investmentNo,
        'पावती / दाखला क्र.': a.depositReceiptNo || '-',
        'संस्था / बँक': a.institutionName || '-',
        'योजना': a.schemeName || '-',
        'वर्गवारी': isShare ? 'शेअर्स भांडवल' : 'मुदत ठेव',
        'गुंतवणूक तारीख': a.investmentDate?.split('T')[0] || '-',
        'मुद्दल रक्कम ₹': a.principalAmount,
        '३१/३ संचित व्याज ₹': a.accruedInterestTillMigration || 0,
        'पुस्तकी मूल्य ₹': a.bookValue,
        'मुदतपूर्ती तारीख': isShare ? 'कायमस्वरूपी' : (a.maturityDate?.split('T')[0] || '-'),
        'स्थिती': a.status
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MigratedInvestments');
    XLSX.writeFile(wb, `Migrated_Investments_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (n: number) => n?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  // KPI Calculations
  const totalMigratedPrincipal = migratedAccounts.reduce((acc, a) => acc + (a.principalAmount || 0), 0);
  const totalMigratedAccrued = migratedAccounts.reduce((acc, a) => acc + (a.accruedInterestTillMigration || 0), 0);
  const totalMigratedBookValue = migratedAccounts.reduce((acc, a) => acc + (a.bookValue || 0), 0);

  const filteredMigratedList = migratedAccounts.filter(a => {
    const isShare = a.investmentType === 'Share' || a.durationMonths === 0;
    if (filterType === 'Deposit' && isShare) return false;
    if (filterType === 'Share' && !isShare) return false;

    const q = searchTerm.toLowerCase();
    return (
      (a.investmentNo || '').toLowerCase().includes(q) ||
      (a.depositReceiptNo || '').toLowerCase().includes(q) ||
      (a.institutionName || '').toLowerCase().includes(q) ||
      (a.schemeName || '').toLowerCase().includes(q)
    );
  });

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
              <span>गुंतवणूक सुरुवातीची शिल्लक स्थलांतर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Investment Opening Balance Migration)</span>
              {editingAccountId && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editingAccountId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              ३१ मार्च अखेरच्या जुन्या मुदत ठेवी, संचित व्याज व शेअर्स भांडवलाचे थेट सिस्टीममध्ये स्थलांतर
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
            title="स्थलांतरित झालेली सर्व खाती पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 स्थलांतरित खाती यादी ({migratedAccounts.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">स्थलांतरित गुंतवणूक खाती</div>
            <div className="text-sm font-black text-gray-900">{migratedAccounts.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">स्थलांतरित मुद्दल रक्कम</div>
            <div className="text-sm font-black text-indigo-900">₹{formatCurrency(totalMigratedPrincipal)}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">३१/३ अखेर संचित व्याज</div>
            <div className="text-sm font-black text-amber-800">₹{formatCurrency(totalMigratedAccrued)}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण पुस्तकी मूल्य (Book Value)</div>
            <div className="text-sm font-black text-emerald-900">₹{formatCurrency(totalMigratedBookValue)}</div>
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

      {/* MAIN SINGLE UNIFIED MIGRATION FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          editingAccountId ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Institution & Scheme Selection */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">१. गुंतवणूक संस्था व योजना निवड (Institution & Scheme Selection)</h2>
              </div>
              {selectedScheme && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isShareMode 
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-300' 
                    : 'bg-blue-50 text-blue-800 border-blue-300'
                }`}>
                  {isShareMode ? '📊 जुने शेअर्स भांडवल स्थलांतर' : '🏛️ जुनी मुदत ठेव स्थलांतर'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>लागू शाखा (Branch)</label>
                <select 
                  name="branchID" 
                  value={formData.branchID} 
                  onChange={handleChange}
                  className={inputClass}
                >
                  {branches.map((b: any) => (
                    <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  गुंतवणूक संस्था / बँक <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  name="investmentInstitutionID"
                  value={formData.investmentInstitutionID}
                  onChange={handleChange}
                  options={[
                    { value: 0, label: '-- संस्था निवडा --' },
                    ...institutions
                      .filter((i: any) => Number(i.institutionID || 0) > 0)
                      .map((i: any) => ({
                        value: i.institutionID,
                        label: `${i.institutionName} (${i.institutionType || 'Bank'})`
                      }))
                  ]}
                  placeholder="-- संस्था निवडा --"
                />
              </div>

              <div>
                <label className={labelClass}>
                  गुंतवणूक योजना <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  name="schemeID"
                  value={formData.schemeID}
                  onChange={handleChange}
                  options={[
                    { value: 0, label: '-- योजना निवडा --' },
                    ...filteredSchemes
                      .filter((s: any) => Number(s.schemeID || 0) > 0)
                      .map((s: any) => ({
                        value: s.schemeID,
                        label: `${s.schemeName} [${s.schemeCode}] (${s.investmentType === 'Share' ? 'शेअर्स' : s.interestRate + '%'})`
                      }))
                  ]}
                  placeholder="-- योजना निवडा --"
                />
              </div>

              <div>
                <label className={labelClass}>
                  मूळ गुंतवणूक / पावती तारीख <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  name="investmentDate" 
                  value={formData.investmentDate} 
                  onChange={handleChange} 
                  required
                  className={inputClass} 
                />
              </div>
            </div>
          </div>

          {/* Section 2: DYNAMIC AMOUNTS & BALANCES (Deposit vs Share) */}
          {!isShareMode ? (
            /* DEPOSIT MIGRATION SECTION */
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
              <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-bold text-primary">२. जुनी मुदत ठेव व ३१ मार्च अखेर संचित व्याज (Deposit Principal & Accrued Interest)</h2>
                </div>
                <span className="text-[10px] text-gray-500">३१/३ ताळेबंद मेळ</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelClass}>
                    मुद्दल ठेव रक्कम (Principal ₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={principalAmountInputRef}
                    type="number"
                    step="1"
                    name="principalAmount"
                    value={formData.principalAmount || ''}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    required
                    placeholder="उदा. 500000"
                    className={`${inputClass} font-bold text-emerald-700 font-mono`}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    ३१ मार्च अखेर संचित व्याज (Accrued ₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    name="accruedInterestTillMigration"
                    value={formData.accruedInterestTillMigration || ''}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    placeholder="उदा. 25000"
                    className={`${inputClass} font-bold text-amber-700 font-mono`}
                  />
                  <span className="text-[10px] text-gray-500 block mt-0.5">३१ मार्च पर्यंत जमा झालेले संचित व्याज</span>
                </div>

                <div>
                  <label className={labelClass}>
                    एकूण पुस्तकी मूल्य (Book Value ₹)
                  </label>
                  <input
                    type="text"
                    value={`₹${formatCurrency((formData.principalAmount || 0) + (formData.accruedInterestTillMigration || 0))}`}
                    readOnly
                    className={`${inputClass} font-bold text-primary font-mono bg-slate-100`}
                  />
                  <span className="text-[10px] text-gray-500 block mt-0.5">मुद्दल + ३१/३ संचित व्याज</span>
                </div>

                <div>
                  <label className={labelClass}>
                    ठेव पावती क्रमांक (Receipt / FDR No) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="depositReceiptNo"
                    value={formData.depositReceiptNo}
                    onChange={handleChange}
                    required
                    placeholder="उदा. FDR/DCC/9823"
                    className={`${inputClass} font-mono font-bold text-purple-900`}
                  />
                </div>
              </div>

              {/* Deposit Live Calculation Banner */}
              {calcData.interestRate > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-sm p-2.5 mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      मुदतपूर्ती व व्याज गणना अंदाज (Calculation Summary):
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-700">
                      पद्धत: {calcData.interestCalculationMethod}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 border-t border-primary/10">
                    <div>
                      <span className="text-gray-500 text-[10px] block">लागू व्याजदर:</span>
                      <span className="font-bold text-emerald-700 font-mono">{calcData.interestRate}% p.a.</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">कालावधी (मुदत):</span>
                      <span className="font-bold text-gray-800 font-mono">{calcData.durationMonths} महिने</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">मुदतपूर्ती तारीख (Maturity):</span>
                      <span className="font-bold text-indigo-900 font-mono">{formatDate(calcData.maturityDate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">अपेक्षित मुदतपूर्ती रक्कम:</span>
                      <span className="font-bold text-emerald-800 font-mono text-xs">₹{formatCurrency(calcData.expectedMaturityAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* SHARE MIGRATION SECTION */
            <div className="bg-indigo-50/40 p-3.5 rounded-sm border border-indigo-200 border-t-2 border-indigo-800 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-indigo-200 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-indigo-800" />
                  <h2 className="text-xs font-bold text-indigo-900">२. जुने शेअर्स भांडवल व दाखला क्रमांक (Share Capital Migration Details)</h2>
                </div>
                <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded border border-indigo-300">
                  🏛️ कायमस्वरूपी भांडवली शेअर्स
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelClass}>
                    शेअर्स संख्या (Quantity) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    name="numberOfShares"
                    value={formData.numberOfShares || ''}
                    onChange={(e) => handleShareQtyChange(parseInt(e.target.value, 10) || 0)}
                    onFocus={(e) => e.target.select()}
                    required
                    placeholder="उदा. 500"
                    className={`${inputClass} font-bold text-indigo-900 font-mono`}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    दर्शनी मूल्य प्रति शेअर (Face Value ₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="faceValuePerShare"
                    value={formData.faceValuePerShare || 100}
                    onChange={handleChange}
                    className={`${inputClass} font-bold text-gray-800 font-mono bg-slate-100`}
                    readOnly
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    एकूण शेअर्स भांडवल (Total Capital ₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="principalAmount"
                    value={formData.principalAmount || ''}
                    onChange={handleChange}
                    className={`${inputClass} font-bold text-emerald-800 font-mono bg-emerald-50 border-emerald-300`}
                    readOnly
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    शेअर दाखला / फॉलिओ क्र. (Folio / Cert No) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="depositReceiptNo"
                    value={formData.depositReceiptNo}
                    onChange={handleChange}
                    required
                    placeholder="उदा. CERT/DCC/589"
                    className={`${inputClass} font-mono font-bold text-indigo-950`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className={labelClass}>लाभांश माहिती</label>
                  <div className="px-2 py-1 bg-white border border-indigo-200 rounded-sm h-[28px] flex items-center gap-1.5 text-[11px] text-indigo-900 font-bold">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-700" />
                    <span>शेअर्सला मुदतपूर्ती तारीख नसते; वार्षिक लाभांश थेट उत्पन्नात नोंदवला जातो.</span>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>शेरा / ठराव संदर्भ (Remarks)</label>
                  <input
                    type="text"
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    placeholder="उदा. ३१/३ शेअर्स स्थलांतर"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{editingAccountId ? 'संपादन रद्द करा' : 'रद्द करा (Reset)'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2 ${
                editingAccountId
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : isShareMode
                  ? 'bg-indigo-800 hover:bg-indigo-900'
                  : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
            >
              <Save className="w-4 h-4" />
              <span>
                {saving
                  ? 'जतन होत आहे...'
                  : editingAccountId
                  ? 'स्थलांतरित माहिती अद्ययावत करा (Update)'
                  : isShareMode
                  ? 'शेअर्स शिल्लक स्थलांतरित करा (Save Share OB)'
                  : 'मुदत ठेव शिल्लक स्थलांतरित करा (Save Deposit OB)'}
              </span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: MIGRATED INVESTMENT ACCOUNTS LIST                           */}
      {/* ========================================================================= */}
      {showMigratedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>स्थलांतरित गुंतवणूक खाती यादी (Migrated Investment Accounts)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredMigratedList.length} खाती
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
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                  <input 
                    type="text" 
                    placeholder="खाते क्र, पावती क्र, बँक किंवा योजनेने शोधा..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-6 py-1 border border-gray-300 rounded-sm text-xs h-[30px] w-60 sm:w-72 focus:outline-none focus:border-primary bg-white shadow-2xs"
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

                {/* Filter Tabs */}
                <div className="flex items-center bg-white border border-gray-300 rounded-sm p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setFilterType('All')}
                    className={`px-2.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                      filterType === 'All' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-slate-100'
                    }`}
                  >
                    सर्व ({migratedAccounts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('Deposit')}
                    className={`px-2.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                      filterType === 'Deposit' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-slate-100'
                    }`}
                  >
                    🏛️ मुदत ठेवी
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('Share')}
                    className={`px-2.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                      filterType === 'Share' ? 'bg-indigo-800 text-white' : 'text-gray-600 hover:bg-slate-100'
                    }`}
                  >
                    📊 शेअर्स
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={migratedAccounts.length === 0}
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-10">#</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left">खाते क्रमांक</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left">पावती / दाखला क्र.</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left">संस्था / बँक</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left">योजना</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-center">गुंतवणूक तारीख</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-right">मुद्दल रक्कम ₹</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-right">३१/३ संचित व्याज ₹</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-right">पुस्तकी मूल्य ₹</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-center">मुदतपूर्ती</th>
                      <th className="px-3 py-1.5 text-center w-20">कृती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredMigratedList.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतेही स्थलांतरित खाते सापडले नाही.
                        </td>
                      </tr>
                    ) : (
                      filteredMigratedList.map((a: any, idx: number) => {
                        const isShare = a.investmentType === 'Share' || a.durationMonths === 0;
                        return (
                          <tr key={a.investmentAccountID || idx} className="hover:bg-primary/5 transition-colors">
                            <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-1.5 border-r border-gray-200 font-mono font-bold text-primary">{a.investmentNo}</td>
                            <td className="px-3 py-1.5 border-r border-gray-200 font-mono font-bold text-purple-900">{a.depositReceiptNo || '-'}</td>
                            <td className="px-3 py-1.5 border-r border-gray-200 font-medium text-gray-900">{a.institutionName}</td>
                            <td className="px-3 py-1.5 border-r border-gray-200 text-gray-700">
                              <div>{a.schemeName}</div>
                              <span className={`inline-block text-[9px] font-bold px-1 rounded border mt-0.5 ${
                                isShare ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}>
                                {isShare ? 'शेअर्स' : 'मुदत ठेव'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 border-r border-gray-200 text-center text-gray-700">{formatDate(a.investmentDate)}</td>
                            <td className="px-3 py-1.5 border-r border-gray-200 text-right font-bold text-emerald-800 font-mono">
                              ₹{formatCurrency(a.principalAmount)}
                            </td>
                            <td className="px-3 py-1.5 border-r border-gray-200 text-right font-bold text-amber-700 font-mono">
                              {isShare ? '-' : `₹${formatCurrency(a.accruedInterestTillMigration || 0)}`}
                            </td>
                            <td className="px-3 py-1.5 border-r border-gray-200 text-right font-bold text-primary font-mono">
                              ₹{formatCurrency(a.bookValue || a.principalAmount)}
                            </td>
                            <td className="px-3 py-1.5 border-r border-gray-200 text-center text-gray-700">
                              {isShare ? <span className="text-gray-400 font-medium">कायमस्वरूपी</span> : formatDate(a.maturityDate)}
                            </td>
                            <td className="px-3 py-1.5 text-center space-x-1 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleEdit(a)}
                                className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-[10px] font-bold border border-amber-300 cursor-pointer"
                                title="संपादन करा"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(a.investmentAccountID, a.investmentNo)}
                                className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded text-[10px] font-bold border border-rose-300 cursor-pointer"
                                title="हटवा"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex justify-between items-center text-xs shrink-0">
              <span className="text-gray-500 font-medium">
                टीप: स्थलांतरित खाती ही ३१ मार्चच्या ओपनिंग बॅलन्ससाठी वापरली जातात.
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

    </div>
  );
};

export default InvestmentOpeningBalance;
