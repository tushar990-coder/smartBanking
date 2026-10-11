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
    if (!reportData) return;

    const bCap = reportData.borrowingCapacity || reportData.compliance || {};
    const exp2 = reportData.explanation2Breakdown || reportData.dividendCalc || {};
    const netSwanidhi = bCap.netOwnedFunds ?? (reportData?.netSwanidhi?.amountInRupees || 0);
    const maxLimit = bCap.maxBorrowingLimit ?? (netSwanidhi * selectedMultiplier);
    const actualLiab = bCap.actualOutsideLiabilities || 0;
    const surplus = bCap.surplusHeadroom ?? (maxLimit - actualLiab);

    const wb = XLSX.utils.book_new();
    const rows = [
      [reportData.sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'],
      [reportData.sanstha?.address || ''],
      [`नोंदणी क्र.: ${reportData.sanstha?.registrationNo || '-'}`, `नोंदणी दिनांक: ${reportData.sanstha?.registrationDate || '-'}`],
      [],
      ['महाराष्ट्र सहकारी संस्था नियम, १९६१ चे नियम ३५ अन्वये स्वनिधी व कमाल उचल मर्यादा विवरणपत्र'],
      [`दिनांक: ${reportData.targetDateDisplay || asOnDate} रोजी अखेर`, `कमाल उचल मर्यादा गुणक: ${selectedMultiplier} पट`, 'आकडे: रुपयांत (₹) व लाखांत'],
      [],
      ['=== भाग - १ : स्वनिधी गणन विवरणपत्र (Calculation of Owned Funds) ==='],
      ['अ.क्र.', 'तपशिल (Particulars)', 'संदर्भ / आधार', 'रक्कम रुपयांत (₹)', 'रक्कम लाखांत (Lakhs)'],
      ['(अ)', 'स्वनिधीमध्ये समाविष्ट होणारे घटक (Inclusions):', '', '', '']
    ];

    // Part 1 Rows 1 to 6
    const inclusionRows = (reportData.rows || []).filter((r: any) => !r.isTotal && !r.isGrandTotal && !r.isDeduction && r.srNo !== 'ब)' && r.srNo !== 'क)');
    inclusionRows.forEach((r: any) => {
      rows.push([
        r.srNo || '',
        r.particular || '',
        r.reference || '',
        r.amountInRupees !== null && r.amountInRupees !== undefined ? r.amountInRupees : '',
        r.amountInLakhs !== null && r.amountInLakhs !== undefined ? r.amountInLakhs : ''
      ]);
      if (r.items && r.items.length > 0) {
        r.items.forEach((si: any) => {
          rows.push(['', `   ↳ ${si.ledgerName || si.label}`, '', si.balance ?? si.amount, ((si.balance ?? si.amount) / 100000).toFixed(2)]);
        });
      }
    });

    const grossSwanidhi = bCap.grossOwnedFunds ?? (reportData.totalA?.amountInRupees || 0);
    rows.push(['', 'एकूण - (अ) सकल स्वनिधी (Total Gross Owned Funds)', '', grossSwanidhi, (grossSwanidhi / 100000).toFixed(2)]);
    
    rows.push(['(ब)', 'वजावटी (Deductions):', '', '', '']);
    const dedRows = reportData.deductions || [];
    dedRows.forEach((d: any) => {
      rows.push([d.srNo || '१.', d.particular || 'संचित तोटा', d.reference || '', d.amountInRupees, d.amountInLakhs]);
    });
    const totalDeductions = bCap.totalDeductions ?? (reportData.totalB?.amountInRupees || 0);
    rows.push(['', 'एकूण - (ब) एकूण वजावटी (Total Deductions)', '', totalDeductions, (totalDeductions / 100000).toFixed(2)]);

    rows.push(['(क)', 'एकूण - निव्वळ स्वनिधी (Net Owned Funds) [अ - ब]', '', netSwanidhi, (netSwanidhi / 100000).toFixed(2)]);

    rows.push([]);
    rows.push(['=== भाग - २ : नियम ३५ अन्वये कमाल उचल मर्यादा व प्रत्यक्ष देयता ताळमेळ विवरणपत्र ===']);
    rows.push(['अ.क्र.', 'तपशिल / विवरण', 'नियम / आधार', 'रक्कम रुपयांत (₹)', 'रक्कम लाखांत (Lakhs)']);
    rows.push(['१.', 'निव्वळ स्वनिधी (Net Owned Funds)', 'भाग-१ मधील (क) प्रमाणे', netSwanidhi, (netSwanidhi / 100000).toFixed(2)]);
    rows.push(['२.', 'अनुज्ञेय कमाल उचल मर्यादा गुणक', 'पोटनियम व नियम ३५ नुसार', `${selectedMultiplier} पट`, `${selectedMultiplier} पट`]);
    rows.push(['३.', `एकूण अनुज्ञेय कमाल उचल मर्यादा [१ × २]`, `स्वनिधीच्या ${selectedMultiplier} पट`, maxLimit, (maxLimit / 100000).toFixed(2)]);
    rows.push(['४.', 'संस्थेची प्रत्यक्ष बाह्य देणी / उचल (Actual Liabilities):', '', '', '']);
    rows.push(['   (अ)', 'बचत ठेवी (Savings Bank Deposits)', 'प्रत्यक्ष ठेव शिल्लक', bCap.savingBalance || 0, ((bCap.savingBalance || 0) / 100000).toFixed(2)]);
    rows.push(['   (ब)', 'मुदत ठेवी (Fixed Deposits)', 'प्रत्यक्ष ठेव शिल्लक', bCap.fdBalance || 0, ((bCap.fdBalance || 0) / 100000).toFixed(2)]);
    rows.push(['   (क)', 'आवर्ती ठेवी (Recurring Deposits - RD)', 'प्रत्यक्ष ठेव शिल्लक', bCap.rdBalance || 0, ((bCap.rdBalance || 0) / 100000).toFixed(2)]);
    rows.push(['   (ड)', 'दैनिक / पिग्मी ठेवी (Daily / Pigmy Deposits)', 'प्रत्यक्ष ठेव शिल्लक', bCap.pigmyBalance || 0, ((bCap.pigmyBalance || 0) / 100000).toFixed(2)]);
    rows.push(['   (इ)', 'इतर बाह्य वित्तीय संस्था कर्जे (Outside Bank Loans)', 'प्रत्यक्ष बाह्य देणी', bCap.outsideBankLoans || 0, ((bCap.outsideBankLoans || 0) / 100000).toFixed(2)]);
    rows.push(['', 'एकूण प्रत्यक्ष बाह्य देयता / उचल [अ+ब+क+ड+इ]', 'एकूण बाह्य देणी', actualLiab, (actualLiab / 100000).toFixed(2)]);
    rows.push(['५.', bCap.isComplied ? 'शिल्लक सुरक्षित उचल मर्यादा (Surplus Headroom) [३ वजा ४]' : 'अतिरिक्त उचल / तूट (Excess / Deficit) [३ वजा ४]', bCap.isComplied ? 'मर्यादा शिल्लक' : 'तूट', Math.abs(surplus), (Math.abs(surplus) / 100000).toFixed(2)]);
    rows.push(['६.', 'नियम ३५ चे पालन व वैधानिक निष्कर्ष', bCap.complianceStatusText || '', bCap.detailedComplianceNote || bCap.complianceText || '', '']);

    rows.push([]);
    rows.push(['=== भाग - ३ : स्पष्टीकरण-२ शिल्लक निव्वळ नफा संगणन ===']);
    rows.push(['१. प्रमाणित निव्वळ नफा (₹):', exp2.certifiedNetProfit || 0]);
    rows.push([`२. मागील ३ वर्षांचे लाभांश दर सरासरी (%):`, `${exp2.averageDividendRate || exp2.averageRate || avgDiv}%`]);
    rows.push(['३. वजा: नियोजित लाभांश रक्कम (₹):', exp2.estimatedDividendAmount || exp2.proposedDividendAmount || 0]);
    rows.push(['४. स्वनिधीत ग्राह्य शिल्लक नफा (₹):', exp2.surplusProfitInOwnedFunds || exp2.surplusNetProfit || 0]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'नियम ३५ स्वनिधी अहवाल');
    XLSX.writeFile(wb, `Rule35_Swanidhi_Report_${asOnDate}.xlsx`);
  };

  const toggleRow = (srNo: string) => {
    setExpandedRows(prev => ({ ...prev, [srNo]: !prev[srNo] }));
  };

  const avgDiv = ((Number(settings.year1DividendRate || 0) + Number(settings.year2DividendRate || 0) + Number(settings.year3DividendRate || 0)) / 3).toFixed(2);

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-1";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[30px]";

  // Calculations for safe rendering
  const bCap = reportData?.borrowingCapacity || reportData?.compliance || {};
  const exp2 = reportData?.explanation2Breakdown || reportData?.dividendCalc || {};
  const grossOwnedFunds = bCap.grossOwnedFunds ?? (reportData?.totalA?.amountInRupees || 0);
  const totalDeductions = bCap.totalDeductions ?? (reportData?.totalB?.amountInRupees || 0);
  const netOwnedFunds = bCap.netOwnedFunds ?? (reportData?.netSwanidhi?.amountInRupees || 0);
  const maxBorrowingLimit = bCap.maxBorrowingLimit ?? (netOwnedFunds * selectedMultiplier);
  const savingBalance = bCap.savingBalance || 0;
  const fdBalance = bCap.fdBalance || 0;
  const rdBalance = bCap.rdBalance || 0;
  const pigmyBalance = bCap.pigmyBalance || 0;
  const outsideBankLoans = bCap.outsideBankLoans || 0;
  const actualOutsideLiabilities = bCap.actualOutsideLiabilities || (savingBalance + fdBalance + rdBalance + pigmyBalance + outsideBankLoans);
  const surplusHeadroom = bCap.surplusHeadroom ?? (maxBorrowingLimit - actualOutsideLiabilities);
  const isComplied = bCap.isComplied ?? (surplusHeadroom >= 0);
  const complianceStatusText = bCap.complianceStatusText || (isComplied ? '✅ नियम ३५ चे तंतोतंत पालन (मर्यादा सुरक्षित)' : '⚠️ मर्यादा ओलांडली (तूट)');
  const detailedComplianceNote = bCap.detailedComplianceNote || bCap.complianceText || (isComplied 
    ? `संस्थेची प्रत्यक्ष बाह्य देणी ₹ ${fmtCur(actualOutsideLiabilities)} ही नियम ३५ अन्वये अनुज्ञेय कमाल मर्यादा ₹ ${fmtCur(maxBorrowingLimit)} च्या आत मर्यादित असून, संस्थेकडे अजून ₹ ${fmtCur(surplusHeadroom)} (${fmtLakh(surplusHeadroom / 100000)} लाख) इतकी उचल मर्यादा शिल्लक आहे. सबब संस्थेने महाराष्ट्र सहकारी संस्था नियम, १९६१ मधील नियम ३५ चे तंतोतंत पालन केले असून संस्था सुरक्षित आहे.` 
    : `सावधान: संस्थेची प्रत्यक्ष बाह्य देणी ₹ ${fmtCur(actualOutsideLiabilities)} ही नियम ३५ अन्वये अनुज्ञेय कमाल मर्यादा ₹ ${fmtCur(maxBorrowingLimit)} पेक्षा जास्त आहेत. संस्थेकडे ₹ ${fmtCur(Math.abs(surplusHeadroom))} ची तूट आहे.`);

  // Inclusions rows (1 to 6)
  const inclusionRows = (reportData?.rows || []).filter((r: any) => 
    !r.isTotal && !r.isGrandTotal && !r.isDeduction && r.srNo !== 'ब)' && r.srNo !== 'क)' && !r.particular?.includes('एकूण') && !r.particular?.includes('वजा')
  );

  // Deductions rows
  const deductionRows = reportData?.deductions && reportData.deductions.length > 0 
    ? reportData.deductions 
    : (reportData?.rows || []).filter((r: any) => r.isDeduction || r.srNo === 'ब)' || r.particular?.includes('तोटा'));

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans print:p-0 print:bg-white">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: static !important;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              overflow: visible !important;
              display: block !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              page-break-inside: auto !important;
              break-inside: auto !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            thead {
              display: table-header-group !important;
            }
          }
        `}
      </style>

      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-slate-300 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2 no-print">
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
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white border border-slate-700 text-[11px] font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="A4 Print"
              >
                <Printer className="w-3.5 h-3.5" />
                प्रिंट (Print)
              </button>
              <button
                onClick={handleExportExcel}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
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
        <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-sm flex items-center gap-2 shadow-2xs animate-fade-in no-print font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-sm flex items-center gap-2 shadow-2xs animate-fade-in no-print font-medium">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OFFICIAL STATUTORY REPORT (MAHARASHTRA COOP CIRCULAR TEMPLATE)    */}
      {/* ========================================================================= */}
      {activeTab === 'report' && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="bg-white px-3.5 py-2 rounded-sm border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-[11px] no-print">
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

          {/* KPI Dashboard Cards (Screen Only) */}
          {reportData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 no-print">
              {/* Gross Owned Funds */}
              <div className="bg-white p-3 rounded-sm border border-slate-300 border-l-4 border-l-primary shadow-2xs flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण सकल स्वनिधी (अ)</div>
                  <div className="text-sm font-bold text-gray-900 font-mono">
                    ₹ {fmtCur(grossOwnedFunds)}
                  </div>
                  <div className="text-[10px] text-primary font-bold">
                    {fmtLakh(grossOwnedFunds / 100000)} लाख
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
                    ₹ {fmtCur(netOwnedFunds)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold">
                    {fmtLakh(netOwnedFunds / 100000)} लाख
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
                    ₹ {fmtCur(maxBorrowingLimit)}
                  </div>
                  <div className="text-[10px] text-purple-700 font-bold">
                    {fmtLakh(maxBorrowingLimit / 100000)} लाख
                  </div>
                </div>
              </div>

              {/* Compliance Status */}
              <div className={`p-3 rounded-sm border shadow-2xs flex items-center gap-3 ${
                isComplied
                  ? 'bg-emerald-50/70 border-emerald-300 border-l-4 border-l-emerald-600'
                  : 'bg-rose-50/70 border-rose-300 border-l-4 border-l-rose-600'
              }`}>
                <div className={`p-2 rounded-sm ${
                  isComplied ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {isComplied ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">नियम ३५ अनुपालन</div>
                  <div className={`text-xs font-bold ${
                    isComplied ? 'text-emerald-900' : 'text-rose-900'
                  }`}>
                    {complianceStatusText}
                  </div>
                  <div className="text-[10px] text-gray-600 font-medium">
                    शिल्लक उचल: ₹ {fmtCur(surplusHeadroom)} ({fmtLakh(surplusHeadroom / 100000)} लाख)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATUTORY A4 PRINTABLE CANVAS (100% MATCHED TO CIRCULAR TEMPLATE)        */}
          {/* ========================================================================= */}
          <div ref={printAreaRef} className="print-area bg-white p-5 md:p-7 rounded-sm border border-slate-300 shadow-md print:shadow-none print:border-none print:p-0">
            
            {/* 1. Official Co-operative Society Header Box */}
            <div className="border-2 border-gray-900 p-3 text-center bg-white mb-2">
              <div className="flex justify-between items-center text-[11px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1.5">
                <div>
                  <span>नोंदणी क्र. : </span>
                  <span className="font-mono">{reportData?.sanstha?.registrationNo || '-'}</span>
                </div>
                <div>
                  <span>नोंदणी दिनांक : </span>
                  <span className="font-mono">{reportData?.sanstha?.registrationDate || '-'}</span>
                </div>
              </div>

              <h1 className="text-base sm:text-lg font-black text-gray-950 tracking-tight font-serif uppercase">
                {reportData?.sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h1>

              <p className="text-[11px] font-bold text-gray-800 mt-0.5">
                {reportData?.sanstha?.address || ''}
                {reportData?.sanstha?.village ? ` मु. ${reportData.sanstha.village}, ` : ''}
                {reportData?.sanstha?.taluka ? `ता. ${reportData.sanstha.taluka}, ` : ''}
                {reportData?.sanstha?.district ? `जि. ${reportData.sanstha.district} ` : ''}
                {reportData?.sanstha?.pincode ? `- ${reportData.sanstha.pincode} ` : ''}
                {reportData?.sanstha?.phoneNo ? `| फोन : ${reportData.sanstha.phoneNo}` : ''}
              </p>
            </div>

            {/* 2. Official Statutory Report Title Box */}
            <div className="mb-3 text-center">
              <div className="inline-block border-2 border-gray-900 bg-gray-50/90 px-6 py-1 rounded-xs shadow-2xs">
                <h2 className="text-xs sm:text-sm font-black text-gray-950 tracking-wide font-serif">
                  महाराष्ट्र सहकारी संस्था नियम, १९६१ चे नियम ३५ अन्वये स्वनिधी व कमाल उचल मर्यादा विवरणपत्र
                </h2>
                <div className="text-[10px] font-bold text-gray-700 tracking-normal">
                  (Statement of Owned Funds and Maximum Borrowing Limit under Rule 35 of MCS Rules, 1961)
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] font-bold text-gray-900 mt-2 px-1 border-b-2 border-gray-800 pb-1">
                <div>दिनांक : <span className="font-mono">{reportData?.targetDateDisplay || asOnDate}</span> रोजी अखेर</div>
                <div>अनुज्ञेय कमाल उचल मर्यादा : <span className="text-primary font-mono">{selectedMultiplier} पट</span></div>
                <div>आकडे : <span className="font-mono">रुपयांत (₹) व लाखांत (Lakhs)</span></div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* PART 1 : STATUTORY TABLE FOR CALCULATION OF OWNED FUNDS (स्वनिधी गणन)     */}
            {/* ========================================================================= */}
            <div className="mt-4 mb-1">
              <div className="bg-gray-800 text-white px-3 py-1 font-bold text-xs flex justify-between items-center rounded-t-xs border border-gray-800">
                <span>भाग - १ : स्वनिधी गणन विवरणपत्र (Calculation of Owned Funds / Swanidhi)</span>
                <span className="text-[10px] font-normal text-gray-200">महाराष्ट्र शासन सहकार आयुक्त व निबंधक परिपत्रकानुसार</span>
              </div>

              <table className="w-full text-[11px] border-collapse border-2 border-gray-900">
                <thead>
                  <tr className="bg-gray-100 text-gray-900 font-bold border-b-2 border-gray-900 text-center">
                    <th className="border border-gray-700 px-2 py-1 w-12 text-center">अ.क्र.</th>
                    <th className="border border-gray-700 px-3 py-1 text-left">तपशिल (Particulars)</th>
                    <th className="border border-gray-700 px-2 py-1 text-left w-48">संदर्भ / आधार (Reference)</th>
                    <th className="border border-gray-700 px-3 py-1 text-right w-44">रुपयांत (₹)</th>
                    <th className="border border-gray-700 px-3 py-1 text-right w-36">लाखांत (Lakhs)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Section A: Inclusions */}
                  <tr className="bg-slate-200/90 font-black text-gray-950 border-b border-gray-700">
                    <td className="border border-gray-700 px-2 py-1 text-center font-black">(अ)</td>
                    <td colSpan={4} className="border border-gray-700 px-3 py-1 uppercase tracking-wide">
                      स्वनिधीमध्ये समाविष्ट होणारे घटक (Inclusions to Owned Funds)
                    </td>
                  </tr>

                  {/* Rows 1 to 6 */}
                  {inclusionRows.map((row: any, idx: number) => {
                    const hasDrillDown = row.items && row.items.length > 0;
                    const isExpanded = expandedRows[row.srNo];

                    return (
                      <React.Fragment key={`inc-${idx}`}>
                        <tr className="hover:bg-slate-50 text-gray-900 border-b border-gray-300">
                          <td className="border border-gray-600 px-2 py-1 text-center font-bold">
                            {row.srNo}
                          </td>
                          <td className="border border-gray-600 px-3 py-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-gray-900">
                                {row.particular}
                              </span>
                              {hasDrillDown && (
                                <button
                                  type="button"
                                  onClick={() => toggleRow(row.srNo)}
                                  className="text-primary hover:opacity-80 text-[10px] font-bold flex items-center gap-1 no-print cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronDown className="w-3.5 h-3.5" />
                                      तपशील बंद करा ({row.items.length})
                                    </>
                                  ) : (
                                    <>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                      लेजर तपशील ({row.items.length})
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="border border-gray-600 px-2 py-1 text-gray-600 text-[10.5px]">
                            {row.reference || '-'}
                          </td>
                          <td className="border border-gray-600 px-3 py-1 text-right font-mono text-gray-900 font-semibold">
                            {row.amountInRupees !== null && row.amountInRupees !== undefined ? fmtCur(row.amountInRupees) : '-'}
                          </td>
                          <td className="border border-gray-600 px-3 py-1 text-right font-mono font-bold text-gray-900">
                            {row.amountInLakhs !== null && row.amountInLakhs !== undefined ? fmtLakh(row.amountInLakhs) : '-'}
                          </td>
                        </tr>

                        {/* Expandable Sub-items for Free and Development Reserves */}
                        {hasDrillDown && isExpanded && (
                          row.items.map((si: any, sIdx: number) => (
                            <tr key={`inc-${idx}-sub-${sIdx}`} className="bg-primary/5 text-[10px] text-gray-700">
                              <td className="border border-gray-300 px-2 py-0.5 text-center text-gray-400">
                                ↳
                              </td>
                              <td className="border border-gray-300 px-6 py-0.5 italic flex items-center justify-between">
                                <span>{si.ledgerName || si.label}</span>
                                {si.ledgerID && <span className="text-[10px] text-gray-400 font-mono">GL-{si.ledgerID}</span>}
                              </td>
                              <td className="border border-gray-300 px-2 py-0.5 text-gray-500 italic text-[9.5px]">
                                उप-लेजर
                              </td>
                              <td className="border border-gray-300 px-3 py-0.5 text-right font-mono text-gray-600">
                                {fmtCur(si.balance ?? si.amount)}
                              </td>
                              <td className="border border-gray-300 px-3 py-0.5 text-right font-mono text-gray-500">
                                {fmtLakh((si.balance ?? si.amount) / 100000)}
                              </td>
                            </tr>
                          ))
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Total A Row */}
                  <tr className="bg-amber-50/70 font-extrabold text-gray-950 border-t-2 border-b-2 border-gray-900">
                    <td className="border border-gray-700 px-2 py-1 text-center font-black"></td>
                    <td colSpan={2} className="border border-gray-700 px-3 py-1 text-left font-black tracking-wide">
                      एकूण - (अ) सकल स्वनिधी (Total Gross Owned Funds)
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-gray-950">
                      ₹ {fmtCur(grossOwnedFunds)}
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-gray-950">
                      {fmtLakh(grossOwnedFunds / 100000)}
                    </td>
                  </tr>

                  {/* Section B: Deductions */}
                  <tr className="bg-rose-50/80 font-black text-rose-950 border-b border-gray-700">
                    <td className="border border-gray-700 px-2 py-1 text-center font-black">(ब)</td>
                    <td colSpan={4} className="border border-gray-700 px-3 py-1 uppercase tracking-wide">
                      वजावटी (Deductions from Owned Funds)
                    </td>
                  </tr>

                  {/* Deduction Rows */}
                  {deductionRows.map((dRow: any, dIdx: number) => (
                    <tr key={`ded-${dIdx}`} className="hover:bg-slate-50 text-gray-800 border-b border-gray-300">
                      <td className="border border-gray-600 px-2 py-1 text-center font-bold">
                        {dRow.srNo || `${dIdx + 1}.`}
                      </td>
                      <td className="border border-gray-600 px-3 py-1 text-rose-900 font-semibold">
                        {dRow.particular || 'संचित तोटा (Accumulated Losses)'}
                      </td>
                      <td className="border border-gray-600 px-2 py-1 text-gray-600 text-[10.5px]">
                        {dRow.reference || 'ताळेबंद तोटा'}
                      </td>
                      <td className="border border-gray-600 px-3 py-1 text-right font-mono text-rose-700 font-semibold">
                        {fmtCur(dRow.amountInRupees || 0)}
                      </td>
                      <td className="border border-gray-600 px-3 py-1 text-right font-mono text-rose-700 font-bold">
                        {fmtLakh(dRow.amountInLakhs ?? ((dRow.amountInRupees || 0) / 100000))}
                      </td>
                    </tr>
                  ))}

                  {/* Total B Row */}
                  <tr className="bg-rose-50/50 font-bold text-rose-950 border-t border-b-2 border-gray-900">
                    <td className="border border-gray-700 px-2 py-1 text-center font-black"></td>
                    <td colSpan={2} className="border border-gray-700 px-3 py-1 text-left font-black tracking-wide">
                      एकूण - (ब) एकूण वजावटी (Total Deductions)
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-rose-800">
                      ₹ {fmtCur(totalDeductions)}
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-rose-800">
                      {fmtLakh(totalDeductions / 100000)}
                    </td>
                  </tr>

                  {/* Section C: Net Owned Funds (Grand Total) */}
                  <tr className="bg-emerald-50 font-black text-emerald-950 border-t-2 border-b-4 border-emerald-900 text-xs">
                    <td className="border border-emerald-800 px-2 py-1.5 text-center font-black text-xs">(क)</td>
                    <td colSpan={2} className="border border-emerald-800 px-3 py-1.5 text-left font-black tracking-wide text-xs">
                      एकूण - निव्वळ स्वनिधी [अ - ब] (Net Owned Funds / Swanidhi)
                    </td>
                    <td className="border border-emerald-800 px-3 py-1.5 text-right font-mono font-black text-emerald-950 text-xs">
                      ₹ {fmtCur(netOwnedFunds)}
                    </td>
                    <td className="border border-emerald-800 px-3 py-1.5 text-right font-mono font-black text-emerald-950 text-xs">
                      {fmtLakh(netOwnedFunds / 100000)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ========================================================================= */}
            {/* PART 2 : STATUTORY TABLE FOR RULE 35 BORROWING LIMIT VS LIABILITIES       */}
            {/* ========================================================================= */}
            <div className="mt-5 mb-1">
              <div className="bg-gray-800 text-white px-3 py-1 font-bold text-xs flex justify-between items-center rounded-t-xs border border-gray-800">
                <span>भाग - २ : नियम ३५ अन्वये कमाल उचल मर्यादा व प्रत्यक्ष देयता ताळमेळ विवरणपत्र</span>
                <span className="text-[10px] font-normal text-gray-200">MCS Rules, 1961 - Rule 35 Borrowing Limit Reconciliation</span>
              </div>

              <table className="w-full text-[11px] border-collapse border-2 border-gray-900">
                <thead>
                  <tr className="bg-gray-100 text-gray-900 font-bold border-b-2 border-gray-900 text-center">
                    <th className="border border-gray-700 px-2 py-1 w-12 text-center">अ.क्र.</th>
                    <th className="border border-gray-700 px-3 py-1 text-left">तपशिल / विवरण (Particulars)</th>
                    <th className="border border-gray-700 px-2 py-1 text-left w-48">नियम / आधार (Norm / Basis)</th>
                    <th className="border border-gray-700 px-3 py-1 text-right w-44">रुपयांत (₹)</th>
                    <th className="border border-gray-700 px-3 py-1 text-right w-36">लाखांत (Lakhs)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 1. Net Swanidhi */}
                  <tr className="hover:bg-slate-50 text-gray-900 font-bold border-b border-gray-400">
                    <td className="border border-gray-600 px-2 py-1 text-center font-bold">१.</td>
                    <td className="border border-gray-600 px-3 py-1 font-bold">
                      निव्वळ स्वनिधी (Net Owned Funds)
                    </td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-600">
                      भाग-१ मधील (क) प्रमाणे
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono font-bold text-gray-950">
                      ₹ {fmtCur(netOwnedFunds)}
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono font-bold text-gray-950">
                      {fmtLakh(netOwnedFunds / 100000)}
                    </td>
                  </tr>

                  {/* 2. Permissible Multiplier */}
                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-400">
                    <td className="border border-gray-600 px-2 py-1 text-center font-bold">२.</td>
                    <td className="border border-gray-600 px-3 py-1">
                      नियम ३५ अन्वये अनुज्ञेय कमाल उचल मर्यादा गुणक (Permissible Multiplier)
                    </td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-600">
                      पोटनियम व नियम ३५ नुसार
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono font-bold text-primary">
                      {selectedMultiplier} पट
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono font-bold text-primary">
                      {selectedMultiplier} पट
                    </td>
                  </tr>

                  {/* 3. Total Permissible Limit */}
                  <tr className="bg-purple-50 font-black text-purple-950 border-t-2 border-b-2 border-purple-800">
                    <td className="border border-purple-700 px-2 py-1.5 text-center font-black">३.</td>
                    <td className="border border-purple-700 px-3 py-1.5 font-black tracking-wide">
                      एकूण अनुज्ञेय कमाल उचल मर्यादा [१ × २] (Max Permissible Limit)
                    </td>
                    <td className="border border-purple-700 px-2 py-1.5 text-purple-900 font-bold">
                      स्वनिधीच्या {selectedMultiplier} पट
                    </td>
                    <td className="border border-purple-700 px-3 py-1.5 text-right font-mono font-black text-purple-950">
                      ₹ {fmtCur(maxBorrowingLimit)}
                    </td>
                    <td className="border border-purple-700 px-3 py-1.5 text-right font-mono font-black text-purple-950">
                      {fmtLakh(maxBorrowingLimit / 100000)}
                    </td>
                  </tr>

                  {/* 4. Actual Outside Liabilities Header */}
                  <tr className="bg-slate-200/90 font-black text-gray-950 border-b border-gray-700">
                    <td className="border border-gray-700 px-2 py-1 text-center font-black">४.</td>
                    <td colSpan={4} className="border border-gray-700 px-3 py-1 uppercase tracking-wide">
                      संस्थेची प्रत्यक्ष बाह्य देणी / उचल (Actual Outside Liabilities as on Date)
                    </td>
                  </tr>

                  {/* (A) Saving */}
                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-300">
                    <td className="border border-gray-600 px-2 py-1 text-center">(अ)</td>
                    <td className="border border-gray-600 px-3 py-1 pl-6">
                      बचत ठेवी (Savings Bank Deposits)
                    </td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-500">
                      प्रत्यक्ष ठेव शिल्लक
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">
                      {fmtCur(savingBalance)}
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">
                      {fmtLakh(savingBalance / 100000)}
                    </td>
                  </tr>

                  {/* (B) FD */}
                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-300">
                    <td className="border border-gray-600 px-2 py-1 text-center">(ब)</td>
                    <td className="border border-gray-600 px-3 py-1 pl-6">
                      मुदत ठेवी (Fixed Deposits)
                    </td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-500">
                      प्रत्यक्ष ठेव शिल्लक
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">
                      {fmtCur(fdBalance)}
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">
                      {fmtLakh(fdBalance / 100000)}
                    </td>
                  </tr>

                  {/* (C) RD */}
                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-300">
                    <td className="border border-gray-600 px-2 py-1 text-center">(क)</td>
                    <td className="border border-gray-600 px-3 py-1 pl-6">
                      आवर्ती ठेवी (Recurring Deposits - RD)
                    </td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-500">
                      प्रत्यक्ष ठेव शिल्लक
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">
                      {fmtCur(rdBalance)}
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">
                      {fmtLakh(rdBalance / 100000)}
                    </td>
                  </tr>

                  {/* (D) Pigmy */}
                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-300">
                    <td className="border border-gray-600 px-2 py-1 text-center">(ड)</td>
                    <td className="border border-gray-600 px-3 py-1 pl-6">
                      दैनिक / पिग्मी ठेवी (Daily / Pigmy Deposits)
                    </td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-500">
                      प्रत्यक्ष ठेव शिल्लक
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">
                      {fmtCur(pigmyBalance)}
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">
                      {fmtLakh(pigmyBalance / 100000)}
                    </td>
                  </tr>

                  {/* (E) Outside Loans */}
                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-400">
                    <td className="border border-gray-600 px-2 py-1 text-center">(इ)</td>
                    <td className="border border-gray-600 px-3 py-1 pl-6">
                      इतर बाह्य वित्तीय संस्थांची कर्जे / उचल (Outside Bank Loans)
                    </td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-500">
                      प्रत्यक्ष बाह्य देणी
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">
                      {fmtCur(outsideBankLoans)}
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">
                      {fmtLakh(outsideBankLoans / 100000)}
                    </td>
                  </tr>

                  {/* Total Actual Liabilities */}
                  <tr className="bg-slate-100 font-extrabold text-gray-950 border-t-2 border-b-2 border-gray-900">
                    <td className="border border-gray-700 px-2 py-1 text-center"></td>
                    <td colSpan={2} className="border border-gray-700 px-3 py-1 text-left font-black tracking-wide">
                      एकूण प्रत्यक्ष बाह्य देयता / उचल [अ+ब+क+ड+इ] (Total Actual Outside Liabilities)
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-gray-950">
                      ₹ {fmtCur(actualOutsideLiabilities)}
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-gray-950">
                      {fmtLakh(actualOutsideLiabilities / 100000)}
                    </td>
                  </tr>

                  {/* 5. Surplus Headroom / Deficit */}
                  <tr className={`font-black border-t-2 border-b-2 ${
                    isComplied 
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-800' 
                      : 'bg-rose-50 text-rose-950 border-rose-800'
                  }`}>
                    <td className="border border-gray-700 px-2 py-1.5 text-center font-black">५.</td>
                    <td className="border border-gray-700 px-3 py-1.5 font-black">
                      {isComplied ? 'शिल्लक सुरक्षित उचल मर्यादा (Surplus Borrowing Headroom) [३ वजा ४]' : 'अतिरिक्त उचल / मर्यादा तूट (Excess Outside Liabilities / Deficit) [३ वजा ४]'}
                    </td>
                    <td className="border border-gray-700 px-2 py-1.5 font-bold">
                      {isComplied ? 'सुरक्षित मर्यादा शिल्लक' : 'मर्यादा ओलांडली (तूट)'}
                    </td>
                    <td className="border border-gray-700 px-3 py-1.5 text-right font-mono font-black text-xs">
                      ₹ {fmtCur(Math.abs(surplusHeadroom))}
                    </td>
                    <td className="border border-gray-700 px-3 py-1.5 text-right font-mono font-black text-xs">
                      {fmtLakh(Math.abs(surplusHeadroom) / 100000)}
                    </td>
                  </tr>

                  {/* 6. Compliance Conclusion Note */}
                  <tr className="bg-gray-50 border-b-2 border-gray-900">
                    <td className="border border-gray-700 px-2 py-2 text-center font-bold">६.</td>
                    <td colSpan={4} className="border border-gray-700 p-2.5">
                      <div className="flex items-start gap-2">
                        {isComplied ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className={`font-black text-xs ${isComplied ? 'text-emerald-900' : 'text-rose-900'}`}>
                            नियम ३५ वैधानिक निष्कर्ष व अनुपालन शेरा : {isComplied ? '✅ नियम ३५ चे तंतोतंत पालन (संस्था आर्थिकदृष्ट्या सुरक्षित)' : '⚠️ सावधान: नियम ३५ कमाल मर्यादा उल्लंघन'}
                          </div>
                          <p className="text-[10.5px] text-gray-700 mt-1 leading-relaxed">
                            {detailedComplianceNote}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ========================================================================= */}
            {/* PART 3 : EXPLANATION NOTES & WORKINGS (STATUTORY DETAILS)                 */}
            {/* ========================================================================= */}
            <div className="mt-5 space-y-3">
              
              {/* Explanation 2 Breakdown Card */}
              {exp2 && (
                <div className="p-3 bg-amber-50/60 border border-amber-300 rounded-xs text-[11px]">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5 mb-2">
                    <Calculator className="w-4 h-4 text-amber-700" />
                    <span>स्पष्टीकरण-२ : शिल्लक निव्वळ नफा संगणन कार्यपत्रिका (Explanation-2 Net Profit Breakdown)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-gray-800 text-[10.5px]">
                    <div className="p-2 bg-white rounded-xs border border-amber-200">
                      <span className="text-gray-500 block text-[10px]">१. प्रमाणित निव्वळ नफा :</span>
                      <strong className="text-[11px] font-mono font-bold text-gray-900">
                        ₹ {fmtCur(exp2.certifiedNetProfit || 0)}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-xs border border-amber-200">
                      <span className="text-gray-500 block text-[10px]">२. मागील ३ वर्षे सरासरी लाभांश दर :</span>
                      <strong className="text-[11px] text-primary font-mono font-bold">
                        {exp2.averageDividendRate || exp2.averageRate || avgDiv}%
                      </strong>
                      <span className="text-[9px] text-gray-500 block">
                        ({exp2.year1DividendRate || exp2.year1Rate || settings.year1DividendRate}%, {exp2.year2DividendRate || exp2.year2Rate || settings.year2DividendRate}%, {exp2.year3DividendRate || exp2.year3Rate || settings.year3DividendRate}%)
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-xs border border-amber-200">
                      <span className="text-gray-500 block text-[10px]">३. वजा: नियोजित लाभांश रक्कम :</span>
                      <strong className="text-[11px] text-rose-700 font-mono font-bold">
                        - ₹ {fmtCur(exp2.estimatedDividendAmount || exp2.proposedDividendAmount || 0)}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-xs border border-amber-200">
                      <span className="text-gray-500 block text-[10px]">४. स्वनिधीत ग्राह्य शिल्लक नफा :</span>
                      <strong className="text-[11px] text-emerald-800 font-mono font-bold">
                        ₹ {fmtCur(exp2.surplusProfitInOwnedFunds || exp2.surplusNetProfit || 0)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Official Circular Explanation Notes (Verbatim from Circular) */}
              <div className="space-y-2 text-[11px] leading-relaxed text-gray-700">
                <div className="p-2.5 bg-slate-50 rounded-xs border border-slate-300">
                  <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-primary" />
                    स्पष्टीकरण-१ (Explanation 1): मुक्त निधी व विकास निधी
                  </h4>
                  <p className="whitespace-pre-line text-gray-600 text-[10px] leading-relaxed">
                    {reportData?.explanation1Text || "मुक्त व विकास निधीमध्ये जे निधी निव्वळ नफा वितरणामधून वार्षिक सभेचे मान्यतेने निर्माण झाले असून, जे निधी कोणत्याही अन्य कारणासाठी देय नाहीत किंवा ज्यामधून प्रतिवर्षी रक्कम अदा केली जात नाही अशा निधींचा समावेश होणे आवश्यक आहे."}
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xs border border-slate-300">
                  <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-700" />
                    स्पष्टीकरण-२ (Explanation 2): शिल्लक निव्वळ नफा निश्चिती
                  </h4>
                  <p className="whitespace-pre-line text-gray-600 text-[10px] leading-relaxed">
                    {reportData?.explanation2Text || "वैधानिक लेखापरिक्षकाने प्रमाणित केलेल्या निव्वळ नफा रकमेमधून नजिकचे वार्षिक सर्वसाधारण सभेचे मान्यतेनंतर जी रक्कम पुन्हा मुक्त व विकास निधीच्या स्वरुपात, स्वनिधीमध्ये घेण्यात येणार आहे, तेवढीच रक्कम शिल्लक निव्वळ नफा म्हणून गृहीत धरावी."}
                  </p>
                </div>

                {/* Excluded Reserves info */}
                {reportData?.excludedReserves && reportData.excludedReserves.length > 0 && (
                  <div className="p-2.5 bg-rose-50/50 rounded-xs border border-rose-200">
                    <h4 className="font-bold text-rose-950 mb-1 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-rose-700" />
                      स्वनिधीत समाविष्ट न केलेले बाह्य देयता निधी (Excluded Non-Free Reserves)
                    </h4>
                    <p className="text-[10px] text-gray-600 mb-1.5">
                      परिपत्रकानुसार ज्या निधींवर बाह्य देयता आहे अशा खालील निधींचा स्वनिधीमध्ये समावेश केलेला नाही:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {reportData.excludedReserves.map((er: any, eIdx: number) => (
                        <span key={`excl-${eIdx}`} className="px-2 py-0.5 bg-white border border-rose-200 rounded text-[10px] font-medium text-rose-900">
                          {er.ledgerName} : ₹ {fmtCur(er.balance)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* PART 4 : STATUTORY AUDIT & SANSTHA SIGNATURES BLOCK                      */}
            {/* ========================================================================= */}
            <div className="mt-8 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-[11px] text-gray-900 border-t-2 border-gray-900">
              <div className="p-2 border border-gray-300 rounded-xs bg-slate-50/50">
                <div className="h-10"></div>
                <div className="font-bold">लिपिक / रोखपाल</div>
                <div className="text-[10px] text-gray-500 font-medium">तयार केले</div>
              </div>
              <div className="p-2 border border-gray-300 rounded-xs bg-slate-50/50">
                <div className="h-10"></div>
                <div className="font-bold">व्यवस्थापक / मुख्य कार्यकारी अधिकारी</div>
                <div className="text-[10px] text-gray-500 font-medium">तपासले</div>
              </div>
              <div className="p-2 border border-gray-300 rounded-xs bg-slate-50/50">
                <div className="h-10"></div>
                <div className="font-bold">चेअरमन / व्हा. चेअरमन</div>
                <div className="text-[10px] text-gray-500 font-medium">मंजूर केले</div>
              </div>
              <div className="p-2 border border-gray-300 rounded-xs bg-slate-50/50">
                <div className="h-10"></div>
                <div className="font-bold">वैधानिक लेखापरीक्षक</div>
                <div className="text-[10px] text-gray-500 font-medium">प्रमाणित केले</div>
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
