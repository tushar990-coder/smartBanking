import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  Printer, 
  FileSpreadsheet, 
  RefreshCw, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  SlidersHorizontal, 
  Info, 
  Sparkles, 
  Save, 
  FolderSync,
  ChevronDown, 
  ChevronRight,
  TrendingUp,
  Percent,
  Calculator,
  Lock,
  FileCheck,
  Search,
  Check,
  RotateCcw
} from 'lucide-react';

interface SwanidhiRow {
  srNo: string;
  particular: string;
  reference: string;
  amountInRupees: number;
  amountInLakhs: number;
  isTotal?: boolean;
  isSubHeader?: boolean;
  isGrandTotal?: boolean;
  hasSubItems?: boolean;
  subItems?: Array<{
    ledgerID: number;
    ledgerName: string;
    balance: number;
  }>;
}

interface CategoryConfig {
  categoryCode: string;
  categoryName: string;
  type: string;
  description: string;
}

interface LedgerItem {
  ledgerID: number;
  ledgerName: string;
  ledgerCode: string;
  groupName: string;
  nature: string;
  openingBalance: number;
  openingBalanceType: string;
}

interface MappingItem {
  mappingID?: number;
  categoryCode: string;
  categoryName: string;
  ledgerID: number;
  ledgerName?: string;
  ledgerCode?: string;
  groupName?: string;
}

interface SwanidhiSettingData {
  settingID?: number;
  branchID: number;
  borrowingLimitMultiplier: number;
  year1DividendRate: number;
  year2DividendRate: number;
  year3DividendRate: number;
  averageDividendRate: number;
  manualCertifiedNetProfit: number | null;
}

const fmtCur = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const fmtLakh = (n: number | null | undefined) => {
  return (n || 0).toFixed(2);
};

export default function SwanidhiReport() {
  const [activeTab, setActiveTab] = useState<'report' | 'mapping'>('report');
  const [asOnDate, setAsOnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(10.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any>(null);
  
  // Mapping & Config State
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [allLedgers, setAllLedgers] = useState<LedgerItem[]>([]);
  const [savedMappings, setSavedMappings] = useState<MappingItem[]>([]);
  const [settings, setSettings] = useState<SwanidhiSettingData>({
    branchID: 1,
    borrowingLimitMultiplier: 10.0,
    year1DividendRate: 9.0,
    year2DividendRate: 9.0,
    year3DividendRate: 9.0,
    averageDividendRate: 9.0,
    manualCertifiedNetProfit: null
  });
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({ '४.': true });
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReport();
    fetchConfig();
  }, []);

  const fetchReport = async (dateVal = asOnDate, multVal = selectedMultiplier) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get('/api/Swanidhi/Report', {
        params: {
          asOnDate: dateVal,
          branchId: 1,
          customMultiplier: multVal
        }
      });
      if (res.data) {
        setReportData(res.data);
        if (res.data.borrowingLimitMultiplier) {
          setSelectedMultiplier(res.data.borrowingLimitMultiplier);
        }
      }
    } catch (err: any) {
      console.error('Failed to load Swanidhi Report', err);
      setErrorMsg(err?.response?.data?.message || 'स्वनिधी अहवाल लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/Swanidhi/Config', { params: { branchId: 1 } });
      if (res.data) {
        setCategories(res.data.categories || []);
        setAllLedgers(res.data.allLedgers || []);
        setSavedMappings(res.data.savedMappings || []);
        if (res.data.setting) {
          setSettings(res.data.setting);
          setSelectedMultiplier(res.data.setting.borrowingLimitMultiplier || 10.0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Swanidhi Config', err);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    setSaveSuccessMsg('');
    setErrorMsg('');
    try {
      const payload = {
        branchID: 1,
        borrowingLimitMultiplier: Number(settings.borrowingLimitMultiplier) || 10.0,
        year1DividendRate: Number(settings.year1DividendRate) || 0,
        year2DividendRate: Number(settings.year2DividendRate) || 0,
        year3DividendRate: Number(settings.year3DividendRate) || 0,
        manualCertifiedNetProfit: settings.manualCertifiedNetProfit !== null && settings.manualCertifiedNetProfit !== undefined && String(settings.manualCertifiedNetProfit) !== ''
          ? Number(settings.manualCertifiedNetProfit) 
          : null,
        mappings: savedMappings.map(m => ({
          categoryCode: m.categoryCode,
          categoryName: m.categoryName,
          ledgerID: m.ledgerID
        }))
      };

      await axios.post('/api/Swanidhi/Config', payload);
      setSaveSuccessMsg('स्वनिधी डायनॅमिक लेजर मॅपिंग व नियम यशस्वीरीत्या सेव्ह झाले!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
      await fetchConfig();
      await fetchReport(asOnDate, payload.borrowingLimitMultiplier);
    } catch (err: any) {
      console.error('Failed to save config', err);
      setErrorMsg(err?.response?.data?.message || 'मॅपिंग जतन करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMap = async () => {
    if (!window.confirm('तुम्हाला खरोखर प्रणालीद्वारे आपोआप उपलब्ध लेजर्स स्वनिधीच्या शासकीय हेड्सशी मॅप करायचे आहेत का?')) {
      return;
    }
    setLoading(true);
    setSaveSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await axios.post('/api/Swanidhi/AutoMap');
      setSaveSuccessMsg(`${res.data?.message || 'आपोआप मॅपिंग पूर्ण झाले!'}`);
      setTimeout(() => setSaveSuccessMsg(''), 5000);
      await fetchConfig();
      await fetchReport();
    } catch (err: any) {
      console.error('Auto map failed', err);
      setErrorMsg(err?.response?.data?.message || 'ऑटो मॅपिंग अयशस्वी.');
    } finally {
      setLoading(false);
    }
  };

  const toggleLedgerMapping = (categoryCode: string, ledgerID: number) => {
    const existing = savedMappings.find(m => m.ledgerID === ledgerID);
    if (existing) {
      if (existing.categoryCode === categoryCode) {
        // Remove mapping
        setSavedMappings(savedMappings.filter(m => m.ledgerID !== ledgerID));
      } else {
        // Change category
        const cat = categories.find(c => c.categoryCode === categoryCode);
        setSavedMappings(savedMappings.map(m => m.ledgerID === ledgerID ? {
          ...m,
          categoryCode,
          categoryName: cat?.categoryName || categoryCode
        } : m));
      }
    } else {
      // Add new
      const cat = categories.find(c => c.categoryCode === categoryCode);
      const ledger = allLedgers.find(l => l.ledgerID === ledgerID);
      setSavedMappings([...savedMappings, {
        categoryCode,
        categoryName: cat?.categoryName || categoryCode,
        ledgerID,
        ledgerName: ledger?.ledgerName,
        ledgerCode: ledger?.ledgerCode,
        groupName: ledger?.groupName
      }]);
    }
  };

  const removeMapping = (ledgerID: number) => {
    setSavedMappings(savedMappings.filter(m => m.ledgerID !== ledgerID));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!reportData || !reportData.rows) return;

    const wb = XLSX.utils.book_new();
    const rows = [
      [reportData.sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'],
      ['स्वनिधी (Owned Funds - Rule 35) परिपत्रकानुसार विवरणपत्रक'],
      [`दिनांक: ${reportData.targetDateDisplay || asOnDate}`, `कमाल उचल मर्यादा: ${selectedMultiplier} पट`],
      [],
      ['अ.क्र.', 'तपशिल', 'रुपयांत', 'लाखांत']
    ];

    reportData.rows.forEach((r: any) => {
      rows.push([
        r.srNo || '',
        r.particular || '',
        r.amountInRupees !== null && r.amountInRupees !== undefined ? r.amountInRupees : '',
        r.amountInLakhs !== null && r.amountInLakhs !== undefined ? r.amountInLakhs : ''
      ]);
      if (r.subItems && r.subItems.length > 0) {
        r.subItems.forEach((si: any) => {
          rows.push(['', `   - ${si.ledgerName}`, si.balance, (si.balance / 100000).toFixed(2)]);
        });
      }
    });

    rows.push([]);
    rows.push(['--- नियम ३५ कमाल उचल मर्यादा तुलना ---']);
    rows.push(['निव्वळ स्वनिधी (Net Owned Funds):', '', reportData.borrowingCapacity?.netOwnedFunds, (reportData.borrowingCapacity?.netOwnedFunds / 100000).toFixed(2)]);
    rows.push([`कमाल उचल मर्यादा (${selectedMultiplier} पट):`, '', reportData.borrowingCapacity?.maxBorrowingLimit, (reportData.borrowingCapacity?.maxBorrowingLimit / 100000).toFixed(2)]);
    rows.push(['प्रत्यक्ष बाह्य देयता (ठेवी + बाह्य कर्जे):', '', reportData.borrowingCapacity?.actualOutsideLiabilities, (reportData.borrowingCapacity?.actualOutsideLiabilities / 100000).toFixed(2)]);
    rows.push(['शिल्लक उचल मर्यादा (Surplus Headroom):', '', reportData.borrowingCapacity?.surplusHeadroom, (reportData.borrowingCapacity?.surplusHeadroom / 100000).toFixed(2)]);
    rows.push(['अनुपालन स्थिती (Compliance Status):', '', reportData.borrowingCapacity?.complianceStatusText]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'स्वनिधी अहवाल');
    XLSX.writeFile(wb, `Swanidhi_Report_${asOnDate}.xlsx`);
  };

  const toggleRow = (srNo: string) => {
    setExpandedRows(prev => ({ ...prev, [srNo]: !prev[srNo] }));
  };

  const avgDiv = ((Number(settings.year1DividendRate || 0) + Number(settings.year2DividendRate || 0) + Number(settings.year3DividendRate || 0)) / 3).toFixed(2);

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-1";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[30px]";

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans print:p-0 print:bg-white">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-slate-300 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Building2 size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>स्वनिधी व नियम ३५ कमाल उचल मर्यादा</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">
                (Rule 35 Swanidhi & Borrowing Limit)
              </span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              महाराष्ट्र शासन सहकार आयुक्त व निबंधक परिपत्रक आणि नियम ३५ अन्वये अधिकृत स्वनिधी व कमाल उचल अहवाल
            </p>
          </div>
        </div>

        {/* Tab Switcher & Action Controls */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-0.5 rounded-sm border border-slate-300 flex items-center gap-1 text-[11px] font-semibold">
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1 rounded-sm flex items-center gap-1.5 transition-all ${
                activeTab === 'report'
                  ? 'bg-white text-primary shadow-2xs border border-gray-300 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              शासकीय अहवाल (Report)
            </button>
            <button
              onClick={() => setActiveTab('mapping')}
              className={`px-3 py-1 rounded-sm flex items-center gap-1.5 transition-all ${
                activeTab === 'mapping'
                  ? 'bg-white text-primary shadow-2xs border border-gray-300 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              डायनॅमिक लेजर मॅपिंग व नियम (Mapping)
            </button>
          </div>

          {activeTab === 'report' && (
            <>
              <button
                onClick={handlePrint}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[11px] font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors"
                title="A4 Print"
              >
                <Printer className="w-3.5 h-3.5" />
                प्रिंट (Print)
              </button>
              <button
                onClick={handleExportExcel}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors"
                title="Excel Export"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                एक्सेल (Excel)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {saveSuccessMsg && (
        <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-sm flex items-center gap-2 shadow-2xs animate-fade-in print:hidden font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-sm flex items-center gap-2 shadow-2xs animate-fade-in print:hidden font-medium">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OFFICIAL REPORT                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'report' && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="bg-white px-3.5 py-2 rounded-sm border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-[11px] print:hidden">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <label className="font-bold text-gray-700">दिनांक (As on Date):</label>
                <input
                  type="date"
                  value={asOnDate}
                  onChange={(e) => setAsOnDate(e.target.value)}
                  className="px-2.5 py-1 border border-gray-300 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary font-medium text-gray-800 bg-white h-[30px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <label className="font-bold text-gray-700">नियम ३५ कमाल उचल मर्यादा पट:</label>
                <select
                  value={selectedMultiplier}
                  onChange={(e) => setSelectedMultiplier(Number(e.target.value))}
                  className="px-2.5 py-1 border border-primary/30 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary font-bold text-primary bg-primary/5 h-[30px]"
                >
                  <option value={10}>१० पट (10x - सामान्य मर्यादा)</option>
                  <option value={12}>१२ पट (12x - 'अ' वर्ग ऑडिट)</option>
                  <option value={15}>१५ पट (15x - विशेष वर्ग)</option>
                  <option value={8}>८ पट (8x - इतर)</option>
                </select>
              </div>

              <button
                onClick={() => fetchReport(asOnDate, selectedMultiplier)}
                disabled={loading}
                className="px-3 py-1 bg-primary hover:opacity-90 text-white font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors h-[30px] cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                अहवाल तयार करा
              </button>
            </div>

            <div className="text-[10px] text-gray-500 italic">
              * सर्व आकडे ताळेबंद व लेजर खतावणीच्या प्रत्यक्ष शिल्लकेवरून संकलित केले आहेत.
            </div>
          </div>

          {/* KPI Dashboard Cards */}
          {reportData && reportData.borrowingCapacity && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 print:hidden">
              {/* Gross Owned Funds */}
              <div className="bg-white p-3 rounded-sm border border-slate-300 border-l-4 border-l-primary shadow-2xs flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण स्वनिधी (अ)</div>
                  <div className="text-sm font-bold text-gray-900 font-mono">
                    ₹ {fmtCur(reportData.borrowingCapacity.grossOwnedFunds)}
                  </div>
                  <div className="text-[10px] text-primary font-bold">
                    {fmtLakh(reportData.borrowingCapacity.grossOwnedFunds / 100000)} लाख
                  </div>
                </div>
              </div>

              {/* Net Owned Funds */}
              <div className="bg-white p-3 rounded-sm border border-slate-300 border-l-4 border-l-emerald-600 shadow-2xs flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">निव्वळ स्वनिधी (अ - ब)</div>
                  <div className="text-sm font-bold text-emerald-800 font-mono">
                    ₹ {fmtCur(reportData.borrowingCapacity.netOwnedFunds)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold">
                    {fmtLakh(reportData.borrowingCapacity.netOwnedFunds / 100000)} लाख
                  </div>
                </div>
              </div>

              {/* Borrowing Limit */}
              <div className="bg-white p-3 rounded-sm border border-slate-300 border-l-4 border-l-purple-600 shadow-2xs flex items-center gap-3">
                <div className="p-2 bg-purple-50 text-purple-700 rounded-sm">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    कमाल उचल मर्यादा ({selectedMultiplier} पट)
                  </div>
                  <div className="text-sm font-bold text-purple-900 font-mono">
                    ₹ {fmtCur(reportData.borrowingCapacity.maxBorrowingLimit)}
                  </div>
                  <div className="text-[10px] text-purple-700 font-bold">
                    {fmtLakh(reportData.borrowingCapacity.maxBorrowingLimit / 100000)} लाख
                  </div>
                </div>
              </div>

              {/* Compliance Status */}
              <div className={`p-3 rounded-sm border shadow-2xs flex items-center gap-3 ${
                reportData.borrowingCapacity.isComplied
                  ? 'bg-emerald-50/70 border-emerald-300 border-l-4 border-l-emerald-600'
                  : 'bg-rose-50/70 border-rose-300 border-l-4 border-l-rose-600'
              }`}>
                <div className={`p-2 rounded-sm ${
                  reportData.borrowingCapacity.isComplied ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {reportData.borrowingCapacity.isComplied ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">नियम ३५ अनुपालन</div>
                  <div className={`text-xs font-bold ${
                    reportData.borrowingCapacity.isComplied ? 'text-emerald-900' : 'text-rose-900'
                  }`}>
                    {reportData.borrowingCapacity.complianceStatusText}
                  </div>
                  <div className="text-[10px] text-gray-600 font-medium">
                    शिल्लक उचल: ₹ {fmtCur(reportData.borrowingCapacity.surplusHeadroom)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Printable Report Canvas */}
          <div ref={printAreaRef} className="bg-white p-5 rounded-sm border border-slate-300 shadow-2xs print:shadow-none print:border-none print:p-0">
            {/* Sanstha Header (Matching Official Spec) */}
            <div className="text-center pb-3 border-b-2 border-gray-800 mb-4">
              <h2 className="text-base font-extrabold text-gray-900 tracking-wide">
                {reportData?.sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h2>
              {reportData?.sanstha?.address && (
                <div className="text-[11px] text-gray-600">{reportData.sanstha.address}</div>
              )}
              {reportData?.sanstha?.registrationNo && (
                <div className="text-[10px] text-gray-500 font-medium">
                  नोंदणी क्र.: {reportData.sanstha.registrationNo}
                </div>
              )}
              <div className="mt-2 inline-block px-3 py-0.5 bg-gray-100 rounded-sm text-[11px] font-bold text-gray-800 border border-gray-300">
                स्वनिधी (Owned Funds - Rule 35) परिपत्रकानुसार विवरणपत्रक
              </div>
              <div className="flex justify-between items-center text-[11px] text-gray-600 mt-2 px-2 font-medium">
                <div>तारीख: <strong>{reportData?.targetDateDisplay || asOnDate}</strong> रोजी अखेर</div>
                <div>कमाल उचल मर्यादा: <strong>{selectedMultiplier} पट</strong></div>
                <div className="font-semibold text-gray-800">आकडे लाखात (Amounts in Lakhs)</div>
              </div>
            </div>

            {/* Official Report Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse border border-gray-400">
                <thead>
                  <tr className="bg-slate-100 text-gray-800 font-bold border-b border-gray-400">
                    <th className="border border-gray-400 px-3 py-1.5 text-center w-14">अ.क्र.</th>
                    <th className="border border-gray-400 px-3 py-1.5 text-left">तपशिल (Particulars)</th>
                    <th className="border border-gray-400 px-3 py-1.5 text-right w-44">रुपयांत (₹)</th>
                    <th className="border border-gray-400 px-3 py-1.5 text-right w-36">लाखांत (Lakhs)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.rows?.map((row: any, idx: number) => {
                    const isGroupHeader = row.isSubHeader;
                    const isTotalRow = row.isTotal;
                    const isGrandTotal = row.isGrandTotal;
                    const isDeduction = row.particular?.includes('वजा') || row.srNo === 'ब)';
                    const hasDrillDown = row.hasSubItems && row.subItems && row.subItems.length > 0;
                    const isExpanded = expandedRows[row.srNo];

                    return (
                      <React.Fragment key={idx}>
                        <tr
                          className={`transition-colors ${
                            isGrandTotal
                              ? 'bg-emerald-50 font-extrabold text-emerald-950 border-t-2 border-b-2 border-emerald-600'
                              : isTotalRow
                              ? 'bg-slate-100 font-bold text-gray-900 border-t border-b border-gray-400'
                              : isGroupHeader
                              ? 'bg-primary/5 font-bold text-primary'
                              : 'hover:bg-slate-50 text-gray-800'
                          }`}
                        >
                          <td className="border border-gray-300 px-3 py-1 text-center font-semibold">
                            {row.srNo}
                          </td>
                          <td className="border border-gray-300 px-3 py-1">
                            <div className="flex items-center justify-between">
                              <span className={isGrandTotal ? 'font-black' : isTotalRow ? 'font-bold' : ''}>
                                {row.particular}
                              </span>
                              {hasDrillDown && (
                                <button
                                  type="button"
                                  onClick={() => toggleRow(row.srNo)}
                                  className="text-primary hover:opacity-80 text-[10px] font-bold flex items-center gap-1 print:hidden"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronDown className="w-3.5 h-3.5" />
                                      तपशील बंद करा ({row.subItems.length})
                                    </>
                                  ) : (
                                    <>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                      लेजर तपशील पाहा ({row.subItems.length})
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className={`border border-gray-300 px-3 py-1 text-right font-mono ${
                            isDeduction ? 'text-rose-700 font-semibold' : ''
                          }`}>
                            {row.amountInRupees !== null && row.amountInRupees !== undefined
                              ? fmtCur(row.amountInRupees)
                              : ''}
                          </td>
                          <td className={`border border-gray-300 px-3 py-1 text-right font-mono font-bold ${
                            isGrandTotal ? 'text-emerald-900' : isDeduction ? 'text-rose-700' : 'text-gray-900'
                          }`}>
                            {row.amountInLakhs !== null && row.amountInLakhs !== undefined
                              ? fmtLakh(row.amountInLakhs)
                              : ''}
                          </td>
                        </tr>

                        {/* Expandable Sub-items for Free and Development Reserves */}
                        {hasDrillDown && isExpanded && (
                          row.subItems.map((si: any, sIdx: number) => (
                            <tr key={`${idx}-sub-${sIdx}`} className="bg-primary/5 text-[10px] text-gray-700">
                              <td className="border border-gray-200 px-3 py-0.5 text-center text-gray-400">
                                ↳
                              </td>
                              <td className="border border-gray-200 px-6 py-0.5 italic flex items-center justify-between">
                                <span>{si.ledgerName}</span>
                                <span className="text-[10px] text-gray-400 font-mono">GL-{si.ledgerID}</span>
                              </td>
                              <td className="border border-gray-200 px-3 py-0.5 text-right font-mono text-gray-600">
                                {fmtCur(si.balance)}
                              </td>
                              <td className="border border-gray-200 px-3 py-0.5 text-right font-mono text-gray-500">
                                {fmtLakh(si.balance / 100000)}
                              </td>
                            </tr>
                          ))
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Explanation 2 Breakdown Card */}
            {reportData?.explanation2Breakdown && (
              <div className="mt-3 p-3 bg-amber-50/60 border border-amber-200 rounded-sm text-[11px]">
                <div className="font-bold text-amber-900 flex items-center gap-1.5 mb-1.5">
                  <Calculator className="w-4 h-4 text-amber-700" />
                  स्पष्टीकरण-२: शिल्लक निव्वळ नफा संगणन (Explanation-2 Net Profit Breakdown)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-gray-800 text-[10px]">
                  <div className="p-2 bg-white rounded-sm border border-amber-200">
                    <span className="text-gray-500 block">१. प्रमाणित निव्वळ नफा:</span>
                    <strong className="text-[11px] font-mono">
                      ₹ {fmtCur(reportData.explanation2Breakdown.certifiedNetProfit)}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded-sm border border-amber-200">
                    <span className="text-gray-500 block">२. मागील ३ वर्षे सरासरी लाभांश दर:</span>
                    <strong className="text-[11px] text-primary">
                      {reportData.explanation2Breakdown.averageDividendRate}%
                    </strong>
                    <span className="text-[9px] text-gray-500 block">
                      ({reportData.explanation2Breakdown.year1DividendRate}%, {reportData.explanation2Breakdown.year2DividendRate}%, {reportData.explanation2Breakdown.year3DividendRate}%)
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-sm border border-amber-200">
                    <span className="text-gray-500 block">३. वजा: नियोजित लाभांश रक्कम:</span>
                    <strong className="text-[11px] text-rose-700 font-mono">
                      - ₹ {fmtCur(reportData.explanation2Breakdown.estimatedDividendAmount)}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded-sm border border-amber-200">
                    <span className="text-gray-500 block">४. स्वनिधीत ग्राह्य शिल्लक नफा:</span>
                    <strong className="text-[11px] text-emerald-800 font-mono">
                      ₹ {fmtCur(reportData.explanation2Breakdown.surplusProfitInOwnedFunds)}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Official Circular Explanation Notes (Verbatim from Circular) */}
            <div className="mt-5 pt-3 border-t-2 border-gray-300 space-y-2.5 text-[11px] leading-relaxed text-gray-700">
              <div className="p-2.5 bg-slate-50 rounded-sm border border-slate-300">
                <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  स्पष्टीकरण-१ (Explanation 1): मुक्त निधी व विकास निधी
                </h4>
                <p className="whitespace-pre-line text-gray-600 text-[10px] leading-relaxed">
                  {reportData?.explanation1Text}
                </p>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-sm border border-slate-300">
                <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  स्पष्टीकरण-२ (Explanation 2): शिल्लक निव्वळ नफा निश्चिती
                </h4>
                <p className="whitespace-pre-line text-gray-600 text-[10px] leading-relaxed">
                  {reportData?.explanation2Text}
                </p>
              </div>
            </div>

            {/* Signatures Area for Statutory Audit & Print */}
            <div className="mt-8 pt-4 grid grid-cols-3 gap-6 text-center text-[11px] text-gray-800 border-t border-gray-300">
              <div>
                <div className="h-8"></div>
                <div className="font-bold">लिपिक / व्यवस्थापक</div>
                <div className="text-[10px] text-gray-500">तयार केले</div>
              </div>
              <div>
                <div className="h-8"></div>
                <div className="font-bold">मुख्य कार्यकारी अधिकारी / चेअरमन</div>
                <div className="text-[10px] text-gray-500">तपासले व मंजूर केले</div>
              </div>
              <div>
                <div className="h-8"></div>
                <div className="font-bold">वैधानिक लेखापरिक्षक (Statutory Auditor)</div>
                <div className="text-[10px] text-gray-500">प्रमाणित केले</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DYNAMIC LEDGER MAPPING & RULE CONFIGURATION                        */}
      {/* ========================================================================= */}
      {activeTab === 'mapping' && (
        <div className="space-y-3">
          
          {/* Top Config Controls Form - 100% Matched to CBS Theme */}
          <div className="bg-white rounded-sm border border-slate-300 border-t-2 border-t-primary shadow-xs">
            
            {/* Form Section Header Banner */}
            <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-100 px-3.5 py-2 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 rounded-t-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
                  <SlidersHorizontal size={14} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                    <span>नियम ३५ कमाल उचल व लाभांश दर सेटिंग्ज</span>
                    <span className="text-[10px] text-primary font-semibold font-mono hidden sm:inline">
                      (Rule 35 Multiplier & Dividend Rates Setting)
                    </span>
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium">
                    येथे संस्थेची कमाल उचल मर्यादा पट, मागील ३ वर्षांचे लाभांश दर व प्रमाणित निव्वळ नफा निश्चित करा.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoMap}
                  disabled={loading}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[11px] font-semibold rounded-sm shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  title="अस्तित्वातील लेजर्स आपोआप शोधून शासकीय हेड्सशी मॅप करा"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>आपोआप लेजर शोधा (Smart Auto-Map)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white text-[11px] font-bold rounded-sm shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>मॅपिंग व सेटिंग्ज सेव्ह करा</span>
                </button>
              </div>
            </div>

            {/* Form Fields - Structured Inside Solid Bordered Group Boxes */}
            <div className="p-3.5 space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                
                {/* Group Box 1: Multiplier & Net Profit */}
                <fieldset className="lg:col-span-5 border border-slate-300 rounded-sm px-3.5 pt-2 pb-3 bg-white shadow-2xs">
                  <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs flex items-center gap-1.5">
                    <Building2 size={12} className="text-primary shrink-0" />
                    <span>१. कमाल उचल मर्यादा व प्रमाणित नफा (Borrowing & Profit)</span>
                  </legend>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                    {/* Field 1: Multiplier */}
                    <div>
                      <label className={labelClass}>
                        उचल मर्यादा (Multiplier): <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={settings.borrowingLimitMultiplier}
                        onChange={(e) => setSettings({ ...settings, borrowingLimitMultiplier: Number(e.target.value) })}
                        className={inputClass}
                      >
                        <option value={10}>१० पट (10.00x - सामान्य)</option>
                        <option value={12}>१२ पट (12.00x - 'अ' वर्ग)</option>
                        <option value={15}>१५ पट (15.00x - विशेष)</option>
                        <option value={8}>८ पट (8.00x - इतर)</option>
                      </select>
                      <span className="text-[9px] text-gray-500 mt-0.5 block">नियम ३५ कमाल उचल गुणक</span>
                    </div>

                    {/* Field 2: Manual Certified Net Profit Override */}
                    <div>
                      <label className={labelClass}>
                        प्रमाणित निव्वळ नफा (₹):
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={settings.manualCertifiedNetProfit ?? ''}
                        onChange={(e) => setSettings({ 
                          ...settings, 
                          manualCertifiedNetProfit: e.target.value === '' ? null : Number(e.target.value) 
                        })}
                        className={inputClass}
                        placeholder="स्वयंचलित / रिकामे ठेवा"
                      />
                      <span className="text-[9px] text-gray-500 mt-0.5 block">ऑडिट प्रमाणित नफा (पर्यायी)</span>
                    </div>
                  </div>
                </fieldset>

                {/* Group Box 2: Dividend Rates & 3-Year Average */}
                <fieldset className="lg:col-span-7 border border-slate-300 rounded-sm px-3.5 pt-2 pb-3 bg-white shadow-2xs">
                  <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs flex items-center gap-1.5">
                    <Percent size={12} className="text-primary shrink-0" />
                    <span>२. स्पष्टीकरण-२: मागील ३ वर्षांचे लाभांश दर व सरासरी (Dividend Rates & 3-Yr Avg)</span>
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mt-1.5 items-end">
                    {/* Year 1 Dividend */}
                    <div>
                      <label className={labelClass}>
                        १. वर्ष १ दर (%):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={settings.year1DividendRate}
                        onChange={(e) => setSettings({ ...settings, year1DividendRate: Number(e.target.value) })}
                        className={inputClass}
                        placeholder="9.00"
                      />
                      <span className="text-[9px] text-gray-500 mt-0.5 block">मागील वर्ष १ लाभांश %</span>
                    </div>

                    {/* Year 2 Dividend */}
                    <div>
                      <label className={labelClass}>
                        २. वर्ष २ दर (%):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={settings.year2DividendRate}
                        onChange={(e) => setSettings({ ...settings, year2DividendRate: Number(e.target.value) })}
                        className={inputClass}
                        placeholder="9.00"
                      />
                      <span className="text-[9px] text-gray-500 mt-0.5 block">मागील वर्ष २ लाभांश %</span>
                    </div>

                    {/* Year 3 Dividend */}
                    <div>
                      <label className={labelClass}>
                        ३. वर्ष ३ दर (%):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={settings.year3DividendRate}
                        onChange={(e) => setSettings({ ...settings, year3DividendRate: Number(e.target.value) })}
                        className={inputClass}
                        placeholder="9.00"
                      />
                      <span className="text-[9px] text-gray-500 mt-0.5 block">मागील वर्ष ३ लाभांश %</span>
                    </div>

                    {/* Auto Average KPI */}
                    <div className="bg-primary/5 p-2 rounded-sm border border-primary/20 flex flex-col justify-between h-[52px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-primary font-bold">सरासरी लाभांश:</span>
                        <span className="text-xs font-black text-primary font-mono">{avgDiv}%</span>
                      </div>
                      <span className="text-[9px] text-primary/80">स्पष्टीकरण-२ मर्यादेसाठी स्वयंचलित</span>
                    </div>
                  </div>
                </fieldset>

              </div>
            </div>
          </div>

          {/* Dynamic Category Mapping Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {categories.map((cat) => {
              const mappedForCat = savedMappings.filter(m => m.categoryCode === cat.categoryCode);
              const isDeduction = cat.type === 'Deduction';
              const isExcluded = cat.type === 'Excluded';

              return (
                <div
                  key={cat.categoryCode}
                  className={`bg-white rounded-sm border shadow-2xs flex flex-col ${
                    isDeduction
                      ? 'border-rose-300'
                      : isExcluded
                      ? 'border-gray-300'
                      : 'border-slate-300'
                  }`}
                >
                  {/* Category Card Header */}
                  <div className={`px-3 py-2 border-b flex items-start justify-between rounded-t-sm ${
                    isDeduction
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                      : isExcluded
                      ? 'bg-slate-100 border-slate-200 text-slate-800'
                      : 'bg-gradient-to-r from-slate-50 to-primary/5 border-slate-200 text-gray-900'
                  }`}>
                    <div>
                      <div className="text-[11px] font-bold flex items-center gap-1.5">
                        <span className={isDeduction ? 'text-rose-700' : isExcluded ? 'text-slate-600' : 'text-primary'}>●</span>
                        <span>{cat.categoryName}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                        {cat.description}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-sm uppercase shrink-0 ${
                      isDeduction
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : isExcluded
                        ? 'bg-slate-200 text-slate-700 border border-slate-300'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      {mappedForCat.length} लेजर्स
                    </span>
                  </div>

                  {/* Mapped Ledgers List */}
                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1 max-h-44 overflow-y-auto mb-2 pr-1">
                      {mappedForCat.length === 0 ? (
                        <div className="text-[11px] text-gray-400 italic py-2 text-center">
                          कोणताही लेजर मॅप केलेला नाही. खालील लेजर्समधून निवडा.
                        </div>
                      ) : (
                        mappedForCat.map((m) => {
                          const ledger = allLedgers.find(l => l.ledgerID === m.ledgerID);
                          return (
                            <div
                              key={m.ledgerID}
                              className="flex items-center justify-between p-1 bg-slate-50 hover:bg-slate-100 rounded-sm border border-gray-200 text-[11px]"
                            >
                              <div className="truncate mr-2">
                                <span className="font-semibold text-gray-800">
                                  {m.ledgerName || ledger?.ledgerName}
                                </span>
                                <span className="text-[10px] text-gray-500 ml-1.5 font-mono">
                                  [{ledger?.groupName || 'GL'}]
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeMapping(m.ledgerID)}
                                className="text-rose-500 hover:text-rose-700 text-[11px] font-bold px-1.5 py-0.5 rounded-sm hover:bg-rose-50 transition-colors shrink-0"
                                title="काढून टाका"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Quick Add Dropdown */}
                    <div className="pt-2 border-t border-gray-100">
                      <select
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val > 0) {
                            toggleLedgerMapping(cat.categoryCode, val);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        className="w-full px-2 py-1 border border-gray-300 rounded-sm text-[11px] text-gray-700 bg-white focus:ring-1 focus:ring-primary focus:border-primary h-[28px]"
                      >
                        <option value="">+ या हेडखाली नवीन लेजर जोडा...</option>
                        {allLedgers
                          .filter(l => !savedMappings.some(m => m.ledgerID === l.ledgerID && m.categoryCode === cat.categoryCode))
                          .map(l => (
                            <option key={l.ledgerID} value={l.ledgerID}>
                              {l.ledgerName} ({l.groupName})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Master Unmapped / All Ledgers Reference Table */}
          <div className="bg-white rounded-sm border border-slate-300 shadow-2xs">
            <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-100 px-3.5 py-2 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 rounded-t-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
                  <FolderSync size={14} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                    <span>सर्व जनरल लेजर्स व त्यांचे स्वनिधी मॅपिंग</span>
                    <span className="text-[10px] text-primary font-semibold font-mono hidden sm:inline">(All Ledgers Status)</span>
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium">
                    संस्थेतील सर्व खाती व त्यांचे शासकीय स्वनिधी वर्गीकरण एका दृष्टिक्षेपात तपासा किंवा बदला.
                  </p>
                </div>
              </div>

              <div className="w-full md:w-64">
                <input
                  type="text"
                  placeholder="लेजरचे नाव शोधा..."
                  value={ledgerSearchTerm}
                  onChange={(e) => setLedgerSearchTerm(e.target.value)}
                  className="w-full px-2.5 py-1 border border-gray-300 rounded-sm text-[11px] focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto border-t border-slate-300">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-100 text-gray-700 font-bold border-b border-slate-300 sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 w-16 text-center">ID</th>
                    <th className="px-3 py-1.5">लेजरचे नाव (Ledger Name)</th>
                    <th className="px-3 py-1.5">ग्रुप (Account Group)</th>
                    <th className="px-3 py-1.5">प्रकार (Nature)</th>
                    <th className="px-3 py-1.5 w-72">स्वनिधी कॅटेगरी (Assigned Category)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allLedgers
                    .filter(l => !ledgerSearchTerm || l.ledgerName.toLowerCase().includes(ledgerSearchTerm.toLowerCase()) || l.groupName.toLowerCase().includes(ledgerSearchTerm.toLowerCase()))
                    .map(l => {
                      const currentMapping = savedMappings.find(m => m.ledgerID === l.ledgerID);

                      return (
                        <tr key={l.ledgerID} className="hover:bg-slate-50">
                          <td className="px-3 py-1 text-center text-gray-400 font-mono">{l.ledgerID}</td>
                          <td className="px-3 py-1 font-medium text-gray-900">{l.ledgerName}</td>
                          <td className="px-3 py-1 text-gray-600">{l.groupName}</td>
                          <td className="px-3 py-1 text-gray-500">
                            <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                              l.nature === 'Liabilities' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                              l.nature === 'Assets' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                              l.nature === 'Expenses' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                              'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {l.nature}
                            </span>
                          </td>
                          <td className="px-3 py-1">
                            <select
                              value={currentMapping?.categoryCode || ''}
                              onChange={(e) => {
                                const newCat = e.target.value;
                                if (!newCat) {
                                  removeMapping(l.ledgerID);
                                } else {
                                  toggleLedgerMapping(newCat, l.ledgerID);
                                }
                              }}
                              className={`w-full px-2 py-1 border rounded-sm text-[11px] ${
                                currentMapping 
                                  ? 'bg-primary/5 border-primary/40 font-bold text-primary' 
                                  : 'bg-white border-gray-300 text-gray-500'
                              } h-[26px]`}
                            >
                              <option value="">-- लागू नाही / Unmapped --</option>
                              {categories.map(c => (
                                <option key={c.categoryCode} value={c.categoryCode}>
                                  {c.categoryName}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
