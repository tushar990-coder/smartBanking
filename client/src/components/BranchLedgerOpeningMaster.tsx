import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  Building2,
  Calendar,
  Save,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowRightLeft,
  ChevronDown,
  Sparkles,
  Info,
  Scale,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  Eye,
  Check,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Branch {
  branchID: number;
  branchCode: string;
  branchName: string;
  branchType: string;
  defaultCashLedgerID?: number;
  defaultCashLedger?: {
    ledgerID: number;
    ledgerName: string;
  };
  isActive: boolean;
}

interface FinancialYear {
  financialYearID: number;
  yearName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

interface LedgerRow {
  ledgerID: number;
  ledgerCode: string;
  ledgerName: string;
  ledgerNameEnglish?: string;
  groupID: number;
  groupName: string;
  accountNature: string;
  reportType?: string;
  accountType?: string;
  masterOpeningBalance: number;
  masterOpeningBalanceType: string;
  branchOpeningBalanceID?: number;
  openingBalance: number;
  openingBalanceType: string;
  remarks?: string;
  isModified?: boolean;
}

interface BranchSplitSummary {
  ledgerID: number;
  ledgerCode: string;
  ledgerName: string;
  groupName: string;
  masterOpeningBalance: number;
  masterOpeningBalanceType: string;
  branchBalances: Record<number, { amount: number; balanceType: string }>;
  totalAllocatedAmount: number;
  balanceDifference: number;
  status: 'Balanced' | 'Partial' | 'OverAllocated' | 'Unallocated';
}

interface BranchLedgerOpeningMasterProps {
  initialBranchId?: number;
}

export default function BranchLedgerOpeningMaster({ initialBranchId }: BranchLedgerOpeningMasterProps) {
  // Master states
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>(initialBranchId || '');
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<number | ''>('');
  
  // Data rows
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [initialRowsMap, setInitialRowsMap] = useState<Record<number, { openingBalance: number; openingBalanceType: string; remarks?: string }>>({});
  
  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [natureFilter, setNatureFilter] = useState<string>('All');
  const [balanceFilter, setBalanceFilter] = useState<'All' | 'WithBalance' | 'ZeroBalance'>('All');
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Split Summary Modal states
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitSummaryData, setSplitSummaryData] = useState<BranchSplitSummary[]>([]);
  const [loadingSplitSummary, setLoadingSplitSummary] = useState(false);
  const [splitSearchTerm, setSplitSearchTerm] = useState('');

  // 1. Initial Load: Fetch Branches & Financial Years
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [branchRes, fyRes] = await Promise.all([
        axios.get('/api/Branches'),
        axios.get('/api/FinancialYears')
      ]);

      const branchList: Branch[] = Array.isArray(branchRes.data) ? branchRes.data : [];
      setBranches(branchList);

      const fyList: FinancialYear[] = Array.isArray(fyRes.data) ? fyRes.data : [];
      setFinancialYears(fyList);

      // Default active branch: initialBranchId or Head Office or first branch
      if (!selectedBranchId && branchList.length > 0) {
        const ho = branchList.find(b => (b.branchType || '').toLowerCase() === 'headoffice') || branchList[0];
        setSelectedBranchId(ho.branchID);
      }

      // Default active FY: current FY or first
      if (!selectedFyId && fyList.length > 0) {
        const currentFy = fyList.find(f => f.isCurrent) || fyList[0];
        setSelectedFyId(currentFy.financialYearID);
      }
    } catch (err: any) {
      console.error("Error loading branches or financial years", err);
      setErrorMsg("शाखा किंवा आर्थिक वर्ष लोड करताना त्रुटी आली.");
    }
  };

  // 2. Fetch Ledger Rows whenever selectedBranchId or selectedFyId changes
  useEffect(() => {
    if (selectedBranchId && selectedFyId) {
      fetchLedgerRows();
    }
  }, [selectedBranchId, selectedFyId]);

  const fetchLedgerRows = async () => {
    if (!selectedBranchId || !selectedFyId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get('/api/BranchLedgerOpeningBalances/ledger-rows', {
        params: {
          branchId: selectedBranchId,
          financialYearId: selectedFyId
        }
      });

      const data: LedgerRow[] = Array.isArray(res.data) ? res.data : [];
      setRows(data);

      // Save initial state to detect modified rows
      const initMap: Record<number, { openingBalance: number; openingBalanceType: string; remarks?: string }> = {};
      data.forEach(r => {
        initMap[r.ledgerID] = {
          openingBalance: r.openingBalance || 0,
          openingBalanceType: r.openingBalanceType || 'Dr',
          remarks: r.remarks || ''
        };
      });
      setInitialRowsMap(initMap);
    } catch (err: any) {
      console.error("Error fetching branch ledger rows", err);
      setErrorMsg("लेजर शिल्लक डेटा लोड करताना त्रुटी आली.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Row Change Handlers
  const handleAmountChange = (ledgerId: number, val: string) => {
    const num = parseFloat(val) || 0;
    setRows(prev => prev.map(r => {
      if (r.ledgerID !== ledgerId) return r;
      const initial = initialRowsMap[ledgerId];
      const isModified = initial ? (initial.openingBalance !== num || initial.openingBalanceType !== r.openingBalanceType || (initial.remarks || '') !== (r.remarks || '')) : true;
      return {
        ...r,
        openingBalance: num,
        isModified
      };
    }));
  };

  const handleTypeChange = (ledgerId: number, balanceType: string) => {
    setRows(prev => prev.map(r => {
      if (r.ledgerID !== ledgerId) return r;
      const initial = initialRowsMap[ledgerId];
      const isModified = initial ? (initial.openingBalance !== r.openingBalance || initial.openingBalanceType !== balanceType || (initial.remarks || '') !== (r.remarks || '')) : true;
      return {
        ...r,
        openingBalanceType: balanceType,
        isModified
      };
    }));
  };

  const handleRemarksChange = (ledgerId: number, remarks: string) => {
    setRows(prev => prev.map(r => {
      if (r.ledgerID !== ledgerId) return r;
      const initial = initialRowsMap[ledgerId];
      const isModified = initial ? (initial.openingBalance !== r.openingBalance || initial.openingBalanceType !== r.openingBalanceType || (initial.remarks || '') !== remarks) : true;
      return {
        ...r,
        remarks,
        isModified
      };
    }));
  };

  // Quick Action: Copy master balance to branch row
  const handleCopyMaster = (ledgerId: number) => {
    setRows(prev => prev.map(r => {
      if (r.ledgerID !== ledgerId) return r;
      return {
        ...r,
        openingBalance: r.masterOpeningBalance,
        openingBalanceType: r.masterOpeningBalanceType || 'Dr',
        isModified: true
      };
    }));
  };

  // Quick Action: Reset single row
  const handleResetRow = (ledgerId: number) => {
    const init = initialRowsMap[ledgerId];
    if (!init) return;
    setRows(prev => prev.map(r => {
      if (r.ledgerID !== ledgerId) return r;
      return {
        ...r,
        openingBalance: init.openingBalance,
        openingBalanceType: init.openingBalanceType,
        remarks: init.remarks,
        isModified: false
      };
    }));
  };

  // 4. Save Bulk Modified Rows
  const handleBulkSave = async () => {
    if (!selectedBranchId || !selectedFyId) {
      setErrorMsg("कृपया शाखा आणि आर्थिक वर्ष निवडा.");
      return;
    }

    const modifiedRows = rows.filter(r => r.isModified);
    if (modifiedRows.length === 0) {
      setSuccessMsg("कोणतेही बदल झालेले नाहीत.");
      setTimeout(() => setSuccessMsg(''), 3000);
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      branchID: Number(selectedBranchId),
      financialYearID: Number(selectedFyId),
      entries: modifiedRows.map(r => ({
        ledgerID: r.ledgerID,
        openingBalance: Number(r.openingBalance) || 0,
        openingBalanceType: r.openingBalanceType || 'Dr',
        remarks: r.remarks || null
      }))
    };

    try {
      const res = await axios.post('/api/BranchLedgerOpeningBalances/bulk', payload);
      setSuccessMsg(`यशस्वी! ${modifiedRows.length} खात्यांची शाखानिहाय सुरुवातीची शिल्लक जतन केली गेली.`);
      fetchLedgerRows();
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err: any) {
      console.error("Error saving branch opening balances", err);
      const msg = err.response?.data?.message || err.response?.data || "सुरुवातीची शिल्लक जतन करताना त्रुटी आली.";
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  // 5. Fetch Split Summary for Modal
  const fetchSplitSummary = async () => {
    if (!selectedFyId) return;
    setLoadingSplitSummary(true);
    try {
      const res = await axios.get('/api/BranchLedgerOpeningBalances/split-summary', {
        params: { financialYearId: selectedFyId }
      });
      setSplitSummaryData(Array.isArray(res.data) ? res.data : []);
      setShowSplitModal(true);
    } catch (err) {
      console.error("Error fetching split summary", err);
      alert("शाखा विभागणी विहंगावलोकन लोड करता आले नाही.");
    } finally {
      setLoadingSplitSummary(false);
    }
  };

  // 6. Excel Export
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert("एक्सपोर्ट करण्यासाठी कोणताही डेटा नाही.");
      return;
    }

    const branch = branches.find(b => b.branchID === selectedBranchId);
    const fy = financialYears.find(f => f.financialYearID === selectedFyId);

    const exportData = filteredRows.map((r, i) => ({
      'अ.क्र.': i + 1,
      'खाते कोड': r.ledgerCode || r.ledgerID,
      'खात्याचे नाव': r.ledgerName,
      'इंग्रजी नाव': r.ledgerNameEnglish || '',
      'खाते गट': r.groupName,
      'गट स्वरूप': r.accountNature,
      'HO शिल्लक': r.masterOpeningBalance,
      'HO प्रकार': r.masterOpeningBalanceType,
      'शाखा सुरुवातीची शिल्लक': r.openingBalance,
      'शाखा प्रकार': r.openingBalanceType,
      'शेरा / टिप्पणी': r.remarks || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BranchOpeningBalance');
    const filename = `Branch_Opening_Balance_${branch?.branchCode || 'BR'}_${fy?.yearName || 'FY'}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // 7. Computed Metrics & Filters
  const selectedBranch = useMemo(() => {
    return branches.find(b => b.branchID === selectedBranchId);
  }, [branches, selectedBranchId]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches = 
          (r.ledgerName && r.ledgerName.toLowerCase().includes(q)) ||
          (r.ledgerCode && r.ledgerCode.toLowerCase().includes(q)) ||
          (r.groupName && r.groupName.toLowerCase().includes(q)) ||
          (r.ledgerNameEnglish && r.ledgerNameEnglish.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Nature Filter
      if (natureFilter !== 'All') {
        if (natureFilter === 'Asset' && !r.accountNature.includes('Asset') && !r.accountNature.includes('मालमत्ता')) return false;
        if (natureFilter === 'Liability' && !r.accountNature.includes('Liability') && !r.accountNature.includes('देयता')) return false;
        if (natureFilter === 'Income' && !r.accountNature.includes('Income') && !r.accountNature.includes('उत्पन्न')) return false;
        if (natureFilter === 'Expense' && !r.accountNature.includes('Expense') && !r.accountNature.includes('खर्च')) return false;
      }

      // Balance Filter
      if (balanceFilter === 'WithBalance' && (!r.openingBalance || r.openingBalance === 0)) return false;
      if (balanceFilter === 'ZeroBalance' && (r.openingBalance && r.openingBalance > 0)) return false;

      return true;
    });
  }, [rows, searchTerm, natureFilter, balanceFilter]);

  const metrics = useMemo(() => {
    let totalDr = 0;
    let totalCr = 0;
    let nonZeroCount = 0;
    let modifiedCount = 0;

    rows.forEach(r => {
      const amt = Number(r.openingBalance) || 0;
      if (amt > 0) {
        nonZeroCount++;
        if (r.openingBalanceType === 'Dr') {
          totalDr += amt;
        } else {
          totalCr += amt;
        }
      }
      if (r.isModified) {
        modifiedCount++;
      }
    });

    const diff = Math.abs(totalDr - totalCr);
    const isBalanced = diff < 0.01;

    return {
      totalDr,
      totalCr,
      diff,
      isBalanced,
      diffType: totalDr > totalCr ? 'Dr' : 'Cr',
      nonZeroCount,
      modifiedCount,
      totalCount: rows.length
    };
  }, [rows]);

  const fmtCurrency = (val: number) => {
    return '₹ ' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans pb-10">
      
      {/* 🌟 1. CBS HEADER BANNER */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Scale size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>शाखानिहाय लेजर सुरुवातीची शिल्लक मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Branch Ledger Opening Balance)</span>
              {selectedBranch && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  (selectedBranch.branchType || '').toLowerCase() === 'headoffice'
                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                    : 'bg-blue-100 text-blue-900 border-blue-300'
                }`}>
                  {(selectedBranch.branchType || '').toLowerCase() === 'headoffice' ? '👑 मुख्य कार्यालय (HO)' : '🏢 शाखा'}
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              प्रत्येक शाखेसाठी स्वतंत्र लेजर शिल्लक नोंदणी, शाखा ताळेबंद ताळमेळ आणि संस्थास्तरीय विभागणी व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchSplitSummary}
            disabled={loadingSplitSummary}
            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-sm text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="सर्व शाखा विभागणी विहंगावलोकन पहा"
          >
            <Eye className="w-3.5 h-3.5 text-purple-600" />
            <span>📊 सर्व शाखा विभागणी ताळेबंद</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-sm text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="एक्सेलमध्ये एक्सपोर्ट करा"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>एक्सेल</span>
          </button>

          <button
            type="button"
            onClick={fetchLedgerRows}
            disabled={loading}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="रिफ्रेश करा"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश</span>
          </button>

          <button
            type="button"
            onClick={handleBulkSave}
            disabled={saving || metrics.modifiedCount === 0}
            className={`px-3 py-1 text-[11px] font-bold rounded-sm shadow-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              metrics.modifiedCount > 0
                ? 'bg-primary hover:bg-primary/95 text-white animate-pulse'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'जतन करत आहे...' : `बदल सेव्ह करा (${metrics.modifiedCount})`}</span>
          </button>
        </div>
      </div>

      {/* 📊 2. SELECTOR & KPI SUMMARY BAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 mb-3">
        {/* Selector Card (4 cols) */}
        <div className="lg:col-span-4 bg-white p-3 rounded-sm border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            <span>शाखा व आर्थिक वर्ष निवड</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-700 mb-0.5">शाखा (Branch) *</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                className="w-full text-[11px] font-bold border border-gray-300 rounded-sm px-2 py-1 bg-white text-gray-900 focus:ring-1 focus:ring-primary focus:border-primary h-[28px]"
              >
                {branches.map(b => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchCode} - {b.branchName} {(b.branchType || '').toLowerCase() === 'headoffice' ? '(HO)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-700 mb-0.5">आर्थिक वर्ष (Financial Year) *</label>
              <select
                value={selectedFyId}
                onChange={(e) => setSelectedFyId(Number(e.target.value))}
                className="w-full text-[11px] font-bold border border-gray-300 rounded-sm px-2 py-1 bg-white text-gray-900 focus:ring-1 focus:ring-primary focus:border-primary h-[28px]"
              >
                {financialYears.map(f => (
                  <option key={f.financialYearID} value={f.financialYearID}>
                    {f.yearName} {f.isCurrent ? '⭐ (चालू)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedBranch && (
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
              <span className="text-gray-500">डिफॉल्ट रोख खाते:</span>
              <span className="font-semibold text-gray-800">
                {selectedBranch.defaultCashLedger?.ledgerName || (selectedBranch.defaultCashLedgerID ? `ID: ${selectedBranch.defaultCashLedgerID}` : 'अनिर्धारित (Auto)')}
              </span>
            </div>
          )}
        </div>

        {/* Financial KPI Summary Cards (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Total Dr Card */}
          <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>एकूण नावे शिल्लक (Dr)</span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
            <div className="text-sm font-black text-blue-900 mt-1">{fmtCurrency(metrics.totalDr)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">मालमत्ता / खर्च खाती</div>
          </div>

          {/* Total Cr Card */}
          <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>एकूण जमा शिल्लक (Cr)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="text-sm font-black text-emerald-900 mt-1">{fmtCurrency(metrics.totalCr)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">देयता / उत्पन्न खाती</div>
          </div>

          {/* Tally / Difference Card */}
          <div className={`p-2.5 rounded-sm border shadow-xs flex flex-col justify-between ${
            metrics.isBalanced ? 'bg-emerald-50/60 border-emerald-300' : 'bg-rose-50/70 border-rose-300'
          }`}>
            <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
              <span className={metrics.isBalanced ? 'text-emerald-800' : 'text-rose-800'}>ताळेबंद ताळमेळ</span>
              {metrics.isBalanced ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              )}
            </div>
            <div className={`text-sm font-black mt-1 ${metrics.isBalanced ? 'text-emerald-900' : 'text-rose-900'}`}>
              {metrics.isBalanced ? '⚖️ संतुलित (0.00)' : fmtCurrency(metrics.diff)}
            </div>
            <div className="text-[10px] font-bold mt-0.5">
              {metrics.isBalanced ? (
                <span className="text-emerald-700">Dr व Cr तंतोतंत जुळले</span>
              ) : (
                <span className="text-rose-700">तफावत: {metrics.diffType} शिल्लक जास्त</span>
              )}
            </div>
          </div>

          {/* Accounts Count Card */}
          <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>खाती संख्या (Accounts)</span>
              <Layers className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-sm font-black text-gray-900 mt-1">
              {metrics.nonZeroCount} <span className="text-[10px] text-gray-500 font-normal">/ {metrics.totalCount}</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {metrics.modifiedCount > 0 ? (
                <span className="text-amber-600 font-bold">✏️ {metrics.modifiedCount} बदल सेव्ह करणे बाकी</span>
              ) : (
                'सुरुवातीची शिल्लक असलेली खाती'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mb-3 p-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-sm text-xs font-bold flex justify-between items-center shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-3 p-2 bg-red-50 text-red-800 border border-red-300 rounded-sm text-xs font-bold flex justify-between items-center shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* 🔍 3. FILTERS & SEARCH CONTROLS */}
      <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-xs mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="लेजर कोड, नाव किंवा खाते गट शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 text-[11px] border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-[28px] w-64"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Nature Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-sm border border-slate-200">
            {[
              { id: 'All', label: 'सर्व (All)' },
              { id: 'Asset', label: 'मालमत्ता (Assets)' },
              { id: 'Liability', label: 'देयता (Liabilities)' },
              { id: 'Income', label: 'उत्पन्न (Income)' },
              { id: 'Expense', label: 'खर्च (Expenses)' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setNatureFilter(tab.id)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-xs transition-all cursor-pointer ${
                  natureFilter === tab.id
                    ? 'bg-white text-primary shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Balance Filter */}
          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as any)}
            className="text-[11px] font-medium border border-slate-300 rounded-sm px-2 py-1 bg-white text-gray-800 h-[28px]"
          >
            <option value="All">सर्व नोंदी (All Records)</option>
            <option value="WithBalance">फक्त शिल्लक असलेली खाती (&gt; 0)</option>
            <option value="ZeroBalance">फक्त 0 शिल्लक खाती (0.00)</option>
          </select>
        </div>

        <div className="text-[10px] text-gray-500 font-bold">
          दाखवत आहे: <span className="text-gray-900">{filteredRows.length}</span> / {rows.length} खाती
        </div>
      </div>

      {/* 📜 4. SPREADSHEET-LIKE DATA TABLE */}
      <div className="bg-white rounded-sm shadow-xs overflow-hidden border border-gray-200 border-t-2 border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <th className="p-2 border-r border-gray-200 w-12 text-center">अ.क्र.</th>
                <th className="p-2 border-r border-gray-200 w-20">कोड</th>
                <th className="p-2 border-r border-gray-200 min-w-[200px]">खात्याचे नाव (Ledger Name)</th>
                <th className="p-2 border-r border-gray-200 w-36">खाते गट (Group)</th>
                <th className="p-2 border-r border-gray-200 w-24 text-center">गट स्वरूप</th>
                <th className="p-2 border-r border-gray-200 w-36 text-right bg-purple-50/60 text-purple-900">
                  🏛️ HO / संस्था शिल्लक
                </th>
                <th className="p-2 border-r border-gray-200 w-44 text-right bg-blue-50/80 text-blue-950">
                  🏢 शाखा शिल्लक (₹) *
                </th>
                <th className="p-2 border-r border-gray-200 w-24 text-center bg-blue-50/80 text-blue-950">
                  प्रकार (Dr/Cr)
                </th>
                <th className="p-2 border-r border-gray-200 min-w-[150px]">शेरा / संदर्भ (Remarks)</th>
                <th className="p-2 text-center w-28">क्रिया (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>शाखानिहाय लेजर डेटा लोड होत आहे...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400 italic">
                    कोणतेही खाते सापडले नाही. शोध निकष बदला.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, index) => {
                  const isModified = r.isModified;
                  const hasBranchBalance = r.openingBalance > 0;
                  const hasMasterBalance = r.masterOpeningBalance > 0;

                  return (
                    <tr 
                      key={r.ledgerID} 
                      className={`transition-colors ${
                        isModified ? 'bg-amber-50/70 font-semibold' : hasBranchBalance ? 'bg-blue-50/20' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-1.5 text-center border-r border-gray-200 text-gray-500">
                        {index + 1}
                      </td>

                      <td className="p-1.5 border-r border-gray-200 font-mono text-gray-700">
                        {r.ledgerCode || r.ledgerID}
                      </td>

                      <td className="p-1.5 border-r border-gray-200">
                        <div className="font-bold text-gray-900">{r.ledgerName}</div>
                        {r.ledgerNameEnglish && (
                          <div className="text-[10px] text-gray-500">{r.ledgerNameEnglish}</div>
                        )}
                      </td>

                      <td className="p-1.5 border-r border-gray-200 text-gray-700">
                        {r.groupName}
                      </td>

                      <td className="p-1.5 border-r border-gray-200 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          r.accountNature.includes('Asset') || r.accountNature.includes('मालमत्ता')
                            ? 'bg-blue-100 text-blue-800'
                            : r.accountNature.includes('Liability') || r.accountNature.includes('देयता')
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.accountNature.includes('Income') || r.accountNature.includes('उत्पन्न')
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {r.accountNature}
                        </span>
                      </td>

                      {/* HO Master Balance (Read-only reference) */}
                      <td className="p-1.5 border-r border-gray-200 text-right bg-purple-50/30 font-mono font-medium text-purple-900">
                        {hasMasterBalance ? (
                          <span>
                            {fmtCurrency(r.masterOpeningBalance)}
                            <span className="text-[10px] text-purple-700 ml-1 font-bold">({r.masterOpeningBalanceType})</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">0.00</span>
                        )}
                      </td>

                      {/* Branch Opening Balance Amount Input */}
                      <td className="p-1 border-r border-gray-200 text-right bg-blue-50/30">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={r.openingBalance === 0 ? '' : r.openingBalance}
                            placeholder="0.00"
                            onChange={(e) => handleAmountChange(r.ledgerID, e.target.value)}
                            className={`w-full text-right font-mono font-bold text-xs px-2 py-1 border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary h-[28px] ${
                              isModified 
                                ? 'bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-300' 
                                : r.openingBalance > 0
                                ? 'bg-white border-blue-300 text-blue-950 font-bold'
                                : 'bg-white border-gray-200 text-gray-500'
                            }`}
                          />
                        </div>
                      </td>

                      {/* Branch Dr / Cr Selector */}
                      <td className="p-1 border-r border-gray-200 text-center bg-blue-50/30">
                        <select
                          value={r.openingBalanceType || 'Dr'}
                          onChange={(e) => handleTypeChange(r.ledgerID, e.target.value)}
                          className={`text-xs font-bold px-1.5 py-0.5 border rounded-sm h-[28px] ${
                            r.openingBalanceType === 'Dr' 
                              ? 'bg-blue-50 text-blue-800 border-blue-300' 
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          <option value="Dr">Dr (नावे)</option>
                          <option value="Cr">Cr (जमा)</option>
                        </select>
                      </td>

                      {/* Remarks */}
                      <td className="p-1 border-r border-gray-200">
                        <input
                          type="text"
                          value={r.remarks || ''}
                          placeholder="शेरा किंवा संदर्भ..."
                          onChange={(e) => handleRemarksChange(r.ledgerID, e.target.value)}
                          className="w-full text-[11px] px-2 py-1 border border-gray-200 rounded-sm focus:outline-none focus:border-primary h-[28px] bg-white text-gray-800"
                        />
                      </td>

                      {/* Row Actions */}
                      <td className="p-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {hasMasterBalance && (
                            <button
                              type="button"
                              onClick={() => handleCopyMaster(r.ledgerID)}
                              title="HO शिल्लक येथे कॉपी करा"
                              className="p-1 text-purple-700 hover:bg-purple-100 rounded cursor-pointer border border-purple-200"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isModified && (
                            <button
                              type="button"
                              onClick={() => handleResetRow(r.ledgerID)}
                              title="बदल पूर्ववत करा (Reset)"
                              className="p-1 text-slate-600 hover:bg-slate-200 rounded cursor-pointer border border-slate-300"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer with Summary */}
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-gray-900">
                  <td colSpan={5} className="p-2 text-right border-r border-gray-200">
                    दाखवलेल्या खात्यांची एकूण बेरीज:
                  </td>
                  <td className="p-2 text-right border-r border-gray-200 text-purple-900 font-mono">
                    -
                  </td>
                  <td className="p-2 text-right border-r border-gray-200 text-blue-950 font-mono text-xs">
                    Dr: {fmtCurrency(metrics.totalDr)} | Cr: {fmtCurrency(metrics.totalCr)}
                  </td>
                  <td colSpan={3} className="p-2 text-left">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      metrics.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {metrics.isBalanced ? '✓ ताळेबंद तंतोतंत जुळले' : `तफावत: ${fmtCurrency(metrics.diff)}`}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 📊 5. MULTI-BRANCH ALLOCATION SPLIT SUMMARY MODAL */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    सर्व शाखा शिल्लक विभागणी विहंगावलोकन (Multi-Branch Allocation Split Summary)
                  </h3>
                  <p className="text-[10px] text-slate-300">
                    संस्थेच्या मुख्य लेजर बॅलन्सची प्रत्येक शाखेत कशी विभागणी झाली आहे याचा संपूर्ण ताळेबंद
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSplitModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-sm text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Search & Filter */}
            <div className="p-3 bg-slate-50 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="लेजर किंवा खाते शोधा..."
                  value={splitSearchTerm}
                  onChange={(e) => setSplitSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-[11px] border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-primary h-[28px]"
                />
              </div>

              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> पूर्ण विभागणी (Balanced)
                </span>
                <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> अपूर्ण विभागणी (Partial)
                </span>
                <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> अतिरिक्त (Over Allocated)
                </span>
              </div>
            </div>

            {/* Modal Table */}
            <div className="flex-1 overflow-auto p-3">
              <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="p-2 border-r border-gray-200 w-12 text-center">अ.क्र.</th>
                    <th className="p-2 border-r border-gray-200">खात्याचे नाव</th>
                    <th className="p-2 border-r border-gray-200">खाते गट</th>
                    <th className="p-2 border-r border-gray-200 text-right bg-purple-50 text-purple-900">
                      संस्था मुख्य शिल्लक (HO Total)
                    </th>
                    {/* Render column for each branch */}
                    {branches.map(b => (
                      <th key={b.branchID} className="p-2 border-r border-gray-200 text-right bg-blue-50/70 text-blue-950">
                        {b.branchName}
                      </th>
                    ))}
                    <th className="p-2 border-r border-gray-200 text-right bg-slate-200 font-black">
                      एकूण विभागलेले (Allocated)
                    </th>
                    <th className="p-2 border-r border-gray-200 text-right font-black">
                      तफावत (Difference)
                    </th>
                    <th className="p-2 text-center w-24">स्थिती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {splitSummaryData
                    .filter(s => {
                      if (!splitSearchTerm) return true;
                      const q = splitSearchTerm.toLowerCase();
                      return s.ledgerName.toLowerCase().includes(q) || s.ledgerCode.toLowerCase().includes(q) || s.groupName.toLowerCase().includes(q);
                    })
                    .map((s, idx) => {
                      const isBalanced = s.status === 'Balanced';
                      const isOver = s.status === 'OverAllocated';

                      return (
                        <tr key={s.ledgerID} className="hover:bg-slate-50 transition-colors">
                          <td className="p-1.5 text-center border-r border-gray-200 text-gray-500">
                            {idx + 1}
                          </td>
                          <td className="p-1.5 border-r border-gray-200 font-bold text-gray-900">
                            {s.ledgerName}
                          </td>
                          <td className="p-1.5 border-r border-gray-200 text-gray-600">
                            {s.groupName}
                          </td>
                          <td className="p-1.5 border-r border-gray-200 text-right bg-purple-50/30 font-mono font-bold text-purple-950">
                            {fmtCurrency(s.masterOpeningBalance)}
                            <span className="text-[9px] text-purple-700 ml-1">({s.masterOpeningBalanceType})</span>
                          </td>
                          {/* Each branch balance */}
                          {branches.map(b => {
                            const bData = s.branchBalances[b.branchID];
                            const amt = bData ? bData.amount : 0;
                            return (
                              <td key={b.branchID} className="p-1.5 border-r border-gray-200 text-right font-mono">
                                {amt > 0 ? (
                                  <span className="font-bold text-blue-900">
                                    {fmtCurrency(amt)}
                                    <span className="text-[9px] text-blue-700 ml-0.5">({bData.balanceType})</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-300">0.00</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-1.5 border-r border-gray-200 text-right bg-slate-50 font-mono font-black text-gray-900">
                            {fmtCurrency(s.totalAllocatedAmount)}
                          </td>
                          <td className={`p-1.5 border-r border-gray-200 text-right font-mono font-black ${
                            isBalanced ? 'text-emerald-700' : isOver ? 'text-rose-700' : 'text-amber-700'
                          }`}>
                            {s.balanceDifference !== 0 ? fmtCurrency(s.balanceDifference) : '0.00'}
                          </td>
                          <td className="p-1.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              isBalanced 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                : isOver 
                                ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {isBalanced ? '✓ पूर्ण' : isOver ? '⚠️ जादा' : '⏳ अपूर्ण'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-4 py-2.5 border-t border-gray-200 flex items-center justify-between">
              <span className="text-[11px] text-gray-600">
                एकूण खाती: <strong>{splitSummaryData.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowSplitModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-sm text-xs font-bold cursor-pointer"
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
