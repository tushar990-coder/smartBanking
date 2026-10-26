import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { 
  Landmark, 
  Wallet, 
  Calendar, 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle, 
  Printer, 
  FileSpreadsheet, 
  Building2, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Info, 
  ChevronRight, 
  AlertTriangle, 
  SlidersHorizontal, 
  FileCheck, 
  CheckCircle, 
  HelpCircle, 
  Scale, 
  Sparkles, 
  Layers, 
  Percent,
  X
} from 'lucide-react';

interface CashDetail {
  ledgerId: number;
  ledgerName: string;
  balance: number;
}

interface BankCurrentDetail {
  ledgerId: number;
  ledgerName: string;
  accountType: string;
  balance: number;
}

interface CrrSummaryData {
  asOnDate: string;
  targetCrrPercent: number;
  statutoryMinPercent: number;
  statutoryMaxPercent: number;
  totalDeposits: number;
  depositBreakup: {
    fixedDeposits: number;
    savingDeposits: number;
    recurringDeposits: number;
    pigmyDeposits: number;
  };
  cashInHand: number;
  cashDetails: CashDetail[];
  bankCurrentBalances: number;
  bankCurrentDetails: BankCurrentDetail[];
  totalLiquidCash: number;
  actualCrrPercent: number;
  requiredCrrAmount: number;
  surplusDeficitAmount: number;
  complianceStatus: 'Complied' | 'Deficit' | 'Excess';
  statusTextMarathi: string;
  statusColor: 'green' | 'red' | 'yellow';
  isEligibleForContribution: boolean;
  sanstha: {
    name: string;
    registrationNo: string;
    address: string;
    contactNo: string;
  };
}

interface DailyRow {
  date: string;
  displayDate: string;
  dayOfWeek: string;
  totalDeposits: number;
  cashInHand: number;
  bankCurrent: number;
  totalLiquidCash: number;
  crrPercent: number;
  requiredAmount: number;
  surplusDeficit: number;
  status: string;
  statusBadge: string;
}

interface DailyStatementData {
  fromDate: string;
  toDate: string;
  targetCrrPercent: number;
  totalDays: number;
  averageCrrPercent: number;
  maxCrrPercent: number;
  minCrrPercent: number;
  deficitDaysCount: number;
  isOverallCompliant: boolean;
  rows: DailyRow[];
}

interface BranchRetentionRow {
  branchId: number;
  branchCode: string;
  branchName: string;
  branchType: string;
  approvedCashLimit: number;
  actualCashBalance: number;
  variance: number;
  isBreached: boolean;
  insuranceLimit: number;
  isInsuranceAdequate: boolean;
  statusBadge: string;
}

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '0.00';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtInt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Math.round(Number(n)).toLocaleString('en-IN');
};

export default function CrrReport() {
  const [activeTab, setActiveTab] = useState<'summary' | 'daily' | 'branch' | 'framework'>('summary');
  const [asOnDate, setAsOnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [targetCrrPercent, setTargetCrrPercent] = useState<number>(3.0);
  const [loading, setLoading] = useState<boolean>(false);

  const [summaryData, setSummaryData] = useState<CrrSummaryData | null>(null);
  const [dailyData, setDailyData] = useState<DailyStatementData | null>(null);
  const [branchData, setBranchData] = useState<BranchRetentionRow[]>([]);

  useEffect(() => {
    fetchCrrSummary();
  }, [asOnDate, targetCrrPercent]);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyStatement();
    } else if (activeTab === 'branch') {
      fetchBranchRetention();
    }
  }, [activeTab, fromDate, toDate, targetCrrPercent]);

  const fetchCrrSummary = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/CrrReport/Summary', {
        params: { asOnDate, targetCrrPercent }
      });
      setSummaryData(res.data);
    } catch (err: any) {
      console.error(err);
      toast.error('CRR सारांश लोड करताना अडचण आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyStatement = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/CrrReport/DailyStatement', {
        params: { fromDate, toDate, targetCrrPercent }
      });
      setDailyData(res.data);
    } catch (err: any) {
      console.error(err);
      toast.error('दैनिक CRR विवरण लोड करताना अडचण आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchBranchRetention = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/CrrReport/BranchRetention', {
        params: { asOnDate }
      });
      if (res.data && res.data.branches) {
        setBranchData(res.data.branches);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('शाखानिहाय रोख मर्यादा लोड करताना अडचण आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    if (summaryData) {
      const summaryRows = [
        ['महाराष्ट्र राज्य सहकारी पतसंस्था - CRR (रोख राखीव प्रमाण) अहवाल'],
        ['संस्थेचे नाव:', summaryData.sanstha?.name || 'नागरी सहकारी पतसंस्था'],
        ['नोंदणी क्र.:', summaryData.sanstha?.registrationNo || '-'],
        ['अखेर दिनांक:', summaryData.asOnDate],
        [''],
        ['तपशील / घटक', 'रक्कम (₹) / प्रमाण'],
        ['एकूण ठेवी दायित्व (NDTL)', summaryData.totalDeposits],
        ['  - मुदत ठेवी (FD)', summaryData.depositBreakup?.fixedDeposits],
        ['  - बचत ठेवी (Savings)', summaryData.depositBreakup?.savingDeposits],
        ['  - आवर्ती ठेवी (RD)', summaryData.depositBreakup?.recurringDeposits],
        ['  - दैनिक / पिग्मी ठेवी (Pigmy)', summaryData.depositBreakup?.pigmyDeposits],
        ['प्रत्यक्ष तिजोरी रोख शिल्लक (Cash in Hand)', summaryData.cashInHand],
        ['बँकांमधील चालू खाती शिल्लक (Bank Current)', summaryData.bankCurrentBalances],
        ['एकूण उपलब्ध रोख तरलता (Liquid Cash)', summaryData.totalLiquidCash],
        ['विहित किमान CRR निकष (%)', `${summaryData.statutoryMinPercent}% ते ${summaryData.statutoryMaxPercent}%`],
        ['संस्थेचे लक्ष्य CRR (%)', `${summaryData.targetCrrPercent}%`],
        ['प्रत्यक्ष राखलेले CRR (%)', `${summaryData.actualCrrPercent}%`],
        ['आवश्यक किमान CRR रक्कम (₹)', summaryData.requiredCrrAmount],
        ['अधिशेष (+) / तुटवडा (-) (₹)', summaryData.surplusDeficitAmount],
        ['वैधानिक अनुपालन स्थिती', summaryData.statusTextMarathi],
        ['नियामक मंडळ अंशदानास पात्रता', summaryData.isEligibleForContribution ? 'पात्र (हिरवा)' : 'अपात्र']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'CRR_Summary');
    }

    // 2. Daily Statement Sheet
    if (dailyData && dailyData.rows && dailyData.rows.length > 0) {
      const dailyRows = [
        ['CRR दैनिक व पंधरवडानिहाय कल नोंदवही (Daily Statement)'],
        ['कालावधी:', `${dailyData.fromDate} ते ${dailyData.toDate}`],
        ['लक्ष्य CRR %:', `${dailyData.targetCrrPercent}%`],
        ['मासिक सरासरी CRR %:', `${dailyData.averageCrrPercent}%`],
        [''],
        ['तारीख', 'वार', 'एकूण ठेवी (₹)', 'रोख शिल्लक (₹)', 'बँक चालू (₹)', 'एकूण तरल रोख (₹)', 'प्रत्यक्ष CRR %', 'आवश्यक रक्कम (₹)', 'अधिशेष/तूट (₹)', 'स्थिती']
      ];

      dailyData.rows.forEach(r => {
        dailyRows.push([
          r.displayDate,
          r.dayOfWeek,
          r.totalDeposits,
          r.cashInHand,
          r.bankCurrent,
          r.totalLiquidCash,
          `${r.crrPercent}%`,
          r.requiredAmount,
          r.surplusDeficit,
          r.statusBadge
        ]);
      });

      const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily_Register');
    }

    // 3. Branch Retention Sheet
    if (branchData && branchData.length > 0) {
      const branchRows = [
        ['शाखानिहाय रोख मर्यादा व विमा सुरक्षा पडताळणी'],
        ['अखेर दिनांक:', asOnDate],
        [''],
        ['शाखा कोड', 'शाखा नाव', 'प्रकार', 'मंजूर रोख मर्यादा (₹)', 'प्रत्यक्ष रोख शिल्लक (₹)', 'फरक / उल्लंघन (₹)', 'विमा संरक्षण (₹)', 'स्थिती']
      ];

      branchData.forEach(b => {
        branchRows.push([
          b.branchCode,
          b.branchName,
          b.branchType,
          b.approvedCashLimit,
          b.actualCashBalance,
          b.variance,
          b.insuranceLimit,
          b.isBreached ? 'मर्यादा ओलांडली' : 'मर्यादेत'
        ]);
      });

      const wsBranch = XLSX.utils.aoa_to_sheet(branchRows);
      XLSX.utils.book_append_sheet(wb, wsBranch, 'Branch_Retention');
    }

    XLSX.writeFile(wb, `CRR_Liquidity_Report_${asOnDate}.xlsx`);
    toast.success('CRR एक्सेल अहवाल यशस्वीरीत्या डाऊनलोड झाला!');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans print:p-0 print:bg-white text-gray-800">
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
          <div className="w-8 h-8 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs shrink-0">
            <Landmark size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>CRR रोख राखीव प्रमाण व तरलता अहवाल</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">
                (Cash Reserve Ratio & Liquidity Compliance)
              </span>
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-sm border border-primary/20">
                विहित निकष: १.००% ते ५.००%
              </span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              महाराष्ट्र सहकारी संस्था कायदा १९६० व पतसंस्था नियामक मंडळ, पुणे मार्गदर्शक नियमांनुसार रोख तरलता विवरण
            </p>
          </div>
        </div>

        {/* Tab Switcher & Action Controls */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-0.5 rounded-sm border border-slate-300 flex items-center gap-1 text-[11px] font-semibold">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-2.5 py-1 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-white text-primary shadow-2xs border border-gray-300 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>मुख्य सारांश</span>
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-2.5 py-1 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'daily'
                  ? 'bg-white text-primary shadow-2xs border border-gray-300 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>दैनिक नोंदवही</span>
            </button>
            <button
              onClick={() => setActiveTab('branch')}
              className={`px-2.5 py-1 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'branch'
                  ? 'bg-white text-primary shadow-2xs border border-gray-300 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>शाखा मर्यादा</span>
            </button>
            <button
              onClick={() => setActiveTab('framework')}
              className={`px-2.5 py-1 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'framework'
                  ? 'bg-white text-primary shadow-2xs border border-gray-300 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>अंमलबजावणी आराखडा</span>
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white border border-slate-700 text-[11px] font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="A4 प्रिंट प्रत"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>प्रिंट (Print)</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="एक्सेल फाइल डाऊनलोड करा"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>एक्सेल (Excel)</span>
          </button>
        </div>
      </div>

      {/* CBS Filter & Parameters Bar (Screen Only) */}
      <div className="bg-white px-3.5 py-2 rounded-sm border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-[11px] mb-3 no-print">
        <div className="flex flex-wrap items-center gap-3">
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
            <label className="font-bold text-gray-700">संस्थेचे लक्ष्य CRR %:</label>
            <select
              value={targetCrrPercent}
              onChange={(e) => setTargetCrrPercent(Number(e.target.value))}
              className="px-2.5 py-1 border border-primary/30 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary font-bold text-primary bg-primary/5 h-[30px]"
            >
              <option value="1.0">१.००% (किमान वैधानिक मर्यादा)</option>
              <option value="2.0">२.००%</option>
              <option value="3.0">३.००% (आदर्श प्रमाण)</option>
              <option value="4.0">४.००%</option>
              <option value="5.0">५.००% (कमाल वैधानिक मर्यादा)</option>
            </select>
          </div>

          <button
            onClick={() => {
              fetchCrrSummary();
              if (activeTab === 'daily') fetchDailyStatement();
              if (activeTab === 'branch') fetchBranchRetention();
            }}
            disabled={loading}
            className="px-3 py-1 bg-primary hover:opacity-90 text-white font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors h-[30px] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'अपडेट होत आहे...' : 'अहवाल रिफ्रेश'}</span>
          </button>
        </div>

        <div className="text-[10.5px] text-gray-500 font-medium italic">
          * पतसंस्था नियामक मंडळ निकष: एकूण ठेवींच्या १% ते ५% दरम्यान रोख तरलता राखणे बंधनकारक आहे.
        </div>
      </div>

      {/* KPI Dashboard Metric Cards (Screen Only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3 no-print">
        {/* Card 1: Total Deposits Base (NDTL) */}
        <div className="bg-white p-3 rounded-sm border border-slate-300 border-l-4 border-l-primary shadow-2xs flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-sm shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">एकूण ठेवी दायित्व (NDTL)</div>
            <div className="text-base font-bold text-gray-900 font-mono">
              ₹ {fmt(summaryData?.totalDeposits)}
            </div>
            <div className="text-[10px] text-primary font-bold truncate">
              FD, बचत, RD व पिग्मी ठेवींची बेरीज
            </div>
          </div>
        </div>

        {/* Card 2: Liquid Cash Reserve */}
        <div className="bg-white p-3 rounded-sm border border-slate-300 border-l-4 border-l-emerald-600 shadow-2xs flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-sm shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">उपलब्ध रोख तरलता (Liquid Cash)</div>
            <div className="text-base font-bold text-emerald-800 font-mono">
              ₹ {fmt(summaryData?.totalLiquidCash)}
            </div>
            <div className="text-[10px] text-emerald-700 font-bold truncate">
              रोख: ₹ {fmt(summaryData?.cashInHand)} | बँक चालू: ₹ {fmt(summaryData?.bankCurrentBalances)}
            </div>
          </div>
        </div>

        {/* Card 3: Actual CRR % & Compliance */}
        <div className={`p-3 rounded-sm border border-slate-300 border-l-4 shadow-2xs flex items-center gap-3 ${
          summaryData?.complianceStatus === 'Complied'
            ? 'bg-white border-l-emerald-600'
            : summaryData?.complianceStatus === 'Deficit'
              ? 'bg-rose-50/20 border-l-rose-600'
              : 'bg-amber-50/20 border-l-amber-500'
        }`}>
          <div className={`p-2 rounded-sm shrink-0 ${
            summaryData?.complianceStatus === 'Complied'
              ? 'bg-emerald-50 text-emerald-700'
              : summaryData?.complianceStatus === 'Deficit'
                ? 'bg-rose-50 text-rose-700'
                : 'bg-amber-50 text-amber-700'
          }`}>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">प्रत्यक्ष राखलेले CRR %</div>
            <div className={`text-base font-black font-mono ${
              summaryData?.complianceStatus === 'Complied'
                ? 'text-emerald-800'
                : summaryData?.complianceStatus === 'Deficit'
                  ? 'text-rose-700'
                  : 'text-amber-700'
            }`}>
              {summaryData?.actualCrrPercent || 0}% <span className="text-[10px] font-semibold text-gray-500 font-sans">(लक्ष्य {targetCrrPercent}%)</span>
            </div>
            <div className="mt-0.5">
              <span className={`px-1.5 py-0.5 rounded-xs text-[9.5px] font-bold inline-flex items-center gap-1 ${
                summaryData?.complianceStatus === 'Complied'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : summaryData?.complianceStatus === 'Deficit'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {summaryData?.complianceStatus === 'Complied' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                <span>{summaryData?.statusTextMarathi || 'पडताळणी चालू'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Surplus / Deficit Amount */}
        <div className={`p-3 rounded-sm border border-slate-300 border-l-4 shadow-2xs flex items-center gap-3 ${
          (summaryData?.surplusDeficitAmount || 0) >= 0 ? 'bg-white border-l-primary' : 'bg-rose-50/20 border-l-rose-600'
        }`}>
          <div className={`p-2 rounded-sm shrink-0 ${
            (summaryData?.surplusDeficitAmount || 0) >= 0 ? 'bg-primary/10 text-primary' : 'bg-rose-50 text-rose-700'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">अधिशेष (+) / तुटवडा (-)</div>
            <div className={`text-base font-bold font-mono ${
              (summaryData?.surplusDeficitAmount || 0) >= 0 ? 'text-primary' : 'text-rose-700'
            }`}>
              {(summaryData?.surplusDeficitAmount || 0) >= 0 ? '+' : ''} ₹ {fmt(summaryData?.surplusDeficitAmount)}
            </div>
            <div className="text-[10px] text-gray-500 font-medium truncate">
              आवश्यक रक्कम: ₹ {fmt(summaryData?.requiredCrrAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Statutory Regulatory Status Strip (Screen Only) */}
      {summaryData && (
        <div className={`mb-3 p-2.5 rounded-sm border text-[11px] flex items-center justify-between gap-2 no-print ${
          summaryData.complianceStatus === 'Complied'
            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
            : summaryData.complianceStatus === 'Deficit'
              ? 'bg-rose-50/80 border-rose-300 text-rose-900'
              : 'bg-amber-50/80 border-amber-300 text-amber-900'
        }`}>
          <div className="flex items-center gap-2">
            {summaryData.complianceStatus === 'Complied' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <div className="font-medium">
              <strong>वैधानिक स्थिती:</strong>{' '}
              {summaryData.complianceStatus === 'Complied' ? (
                <span>
                  संस्थेने दिनांक <strong>{asOnDate}</strong> अखेर एकूण ठेवी ₹ <strong>{fmt(summaryData.totalDeposits)}</strong> च्या तुलनेत{' '}
                  <strong>{summaryData.actualCrrPercent}%</strong> (₹ {fmt(summaryData.totalLiquidCash)}) इतकी तरलता राखली असून विहित १% ते ५% निकषांचे तंतोतंत पालन केले आहे. नियामक मंडळ अंशदान व वैधानिक तरतुदीसाठी संस्था <strong>पात्र (Complied)</strong> आहे.
                </span>
              ) : (
                <span>
                  सावधान: प्रत्यक्ष CRR <strong>{summaryData.actualCrrPercent}%</strong> हा विहित निकषांच्या बाहेर असून संस्थेकडे ₹ <strong>{fmt(Math.abs(summaryData.surplusDeficitAmount))}</strong> चा तुटवडा आहे. तातडीने रोख शिल्लक व बँक चालू खात्यांमध्ये तरलता वाढविणे आवश्यक आहे.
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className={`px-2 py-0.5 rounded-xs font-bold text-[10px] uppercase tracking-wider ${
              summaryData.complianceStatus === 'Complied'
                ? 'bg-emerald-700 text-white'
                : 'bg-rose-700 text-white'
            }`}>
              {summaryData.complianceStatus === 'Complied' ? '✔ COMPLIANT' : '⚠️ ACTION REQUIRED'}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN TABS CONTENT                                                       */}
      {/* ========================================================================= */}

      {/* TAB 1: मुख्य सारांश व घटक ताळमेळ (Screen Only) */}
      {activeTab === 'summary' && (
        <div className="space-y-3 no-print">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-[11px]">
            {/* Left: Cash in Hand Breakup */}
            <div className="bg-white rounded-sm border border-slate-300 shadow-2xs p-3">
              <div className="font-bold text-gray-900 text-xs mb-2 pb-1.5 border-b border-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-primary">
                  <Wallet className="w-4 h-4" />
                  <span>अ) प्रत्यक्ष रोख शिल्लक (Physical Cash in Hand)</span>
                </span>
                <span className="text-primary font-bold font-mono">₹ {fmt(summaryData?.cashInHand)}</span>
              </div>
              
              <table className="w-full text-[11px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-gray-800 font-bold border-b border-slate-300">
                    <th className="py-1.5 px-2.5 text-left border border-slate-300">रोख खाते / तिजोरी लेजर नाव</th>
                    <th className="py-1.5 px-2.5 text-right border border-slate-300">शिल्लक रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData?.cashDetails && summaryData.cashDetails.length > 0 ? (
                    summaryData.cashDetails.map((c) => (
                      <tr key={c.ledgerId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-1 px-2.5 font-medium text-gray-800 border border-slate-200">{c.ledgerName}</td>
                        <td className="py-1 px-2.5 text-right font-bold text-gray-900 font-mono border border-slate-200">₹ {fmt(c.balance)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-3 px-2.5 text-center text-gray-400 border border-slate-200">
                        रोख लेजर्स उपलब्ध नाहीत
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-gray-900">
                    <td className="py-1.5 px-2.5 border border-slate-300">एकूण प्रत्यक्ष रोख शिल्लक:</td>
                    <td className="py-1.5 px-2.5 text-right text-emerald-800 font-mono border border-slate-300">₹ {fmt(summaryData?.cashInHand)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right: Bank Current Accounts Breakup */}
            <div className="bg-white rounded-sm border border-slate-300 shadow-2xs p-3">
              <div className="font-bold text-gray-900 text-xs mb-2 pb-1.5 border-b border-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-primary">
                  <Landmark className="w-4 h-4" />
                  <span>ब) बँकांमधील चालू खाती शिल्लक (Bank Current Balances)</span>
                </span>
                <span className="text-primary font-bold font-mono">₹ {fmt(summaryData?.bankCurrentBalances)}</span>
              </div>

              <table className="w-full text-[11px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-gray-800 font-bold border-b border-slate-300">
                    <th className="py-1.5 px-2.5 text-left border border-slate-300">बँक खाते नाव</th>
                    <th className="py-1.5 px-2.5 text-left border border-slate-300">खाते प्रकार</th>
                    <th className="py-1.5 px-2.5 text-right border border-slate-300">शिल्लक रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData?.bankCurrentDetails && summaryData.bankCurrentDetails.length > 0 ? (
                    summaryData.bankCurrentDetails.map((b) => (
                      <tr key={b.ledgerId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-1 px-2.5 font-medium text-gray-800 border border-slate-200">{b.ledgerName}</td>
                        <td className="py-1 px-2.5 text-gray-500 border border-slate-200">{b.accountType}</td>
                        <td className="py-1 px-2.5 text-right font-bold text-gray-900 font-mono border border-slate-200">₹ {fmt(b.balance)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-3 px-2.5 text-center text-gray-400 border border-slate-200">
                        बँक चालू खाती नोंदी उपलब्ध नाहीत
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-gray-900">
                    <td colSpan={2} className="py-1.5 px-2.5 border border-slate-300">एकूण बँक चालू खाती शिल्लक:</td>
                    <td className="py-1.5 px-2.5 text-right text-primary font-mono border border-slate-300">₹ {fmt(summaryData?.bankCurrentBalances)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom: Deposits Base Composition */}
          <div className="bg-white rounded-sm border border-slate-300 shadow-2xs p-3">
            <div className="font-bold text-gray-900 text-xs mb-2 pb-1.5 border-b border-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-primary">
                <Building2 className="w-4 h-4" />
                <span>क) एकूण ठेवींची वर्गवारी व रचना (Deposit Liabilities Composition)</span>
              </span>
              <span className="text-primary font-bold font-mono">₹ {fmt(summaryData?.totalDeposits)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-slate-50 rounded-sm border border-slate-300 flex flex-col justify-between">
                <div>
                  <div className="text-[10.5px] font-bold text-gray-700">१. मुदत ठेवी (Fixed Deposits - FD)</div>
                  <div className="text-sm font-bold text-gray-900 font-mono mt-1">₹ {fmt(summaryData?.depositBreakup?.fixedDeposits)}</div>
                </div>
                <div className="text-[10px] text-gray-500 mt-1 font-semibold">
                  प्रमाण: {summaryData?.totalDeposits ? (((summaryData.depositBreakup?.fixedDeposits || 0) / summaryData.totalDeposits) * 100).toFixed(1) : 0}%
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-sm border border-slate-300 flex flex-col justify-between">
                <div>
                  <div className="text-[10.5px] font-bold text-gray-700">२. बचत ठेवी (Savings Accounts)</div>
                  <div className="text-sm font-bold text-gray-900 font-mono mt-1">₹ {fmt(summaryData?.depositBreakup?.savingDeposits)}</div>
                </div>
                <div className="text-[10px] text-gray-500 mt-1 font-semibold">
                  प्रमाण: {summaryData?.totalDeposits ? (((summaryData.depositBreakup?.savingDeposits || 0) / summaryData.totalDeposits) * 100).toFixed(1) : 0}%
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-sm border border-slate-300 flex flex-col justify-between">
                <div>
                  <div className="text-[10.5px] font-bold text-gray-700">३. आवर्ती ठेव (Recurring Deposits - RD)</div>
                  <div className="text-sm font-bold text-gray-900 font-mono mt-1">₹ {fmt(summaryData?.depositBreakup?.recurringDeposits)}</div>
                </div>
                <div className="text-[10px] text-gray-500 mt-1 font-semibold">
                  प्रमाण: {summaryData?.totalDeposits ? (((summaryData.depositBreakup?.recurringDeposits || 0) / summaryData.totalDeposits) * 100).toFixed(1) : 0}%
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-sm border border-slate-300 flex flex-col justify-between">
                <div>
                  <div className="text-[10.5px] font-bold text-gray-700">४. दैनिक / पिग्मी ठेव (Pigmy Deposits)</div>
                  <div className="text-sm font-bold text-gray-900 font-mono mt-1">₹ {fmt(summaryData?.depositBreakup?.pigmyDeposits)}</div>
                </div>
                <div className="text-[10px] text-gray-500 mt-1 font-semibold">
                  प्रमाण: {summaryData?.totalDeposits ? (((summaryData.depositBreakup?.pigmyDeposits || 0) / summaryData.totalDeposits) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: दैनिक व पंधरवडानिहाय कल नोंदवही (Screen Only) */}
      {activeTab === 'daily' && (
        <div className="bg-white rounded-sm border border-slate-300 shadow-2xs p-3 text-[11px] no-print">
          {/* Daily Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2.5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700">कालावधी:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-sm text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary h-[28px]"
              />
              <span className="text-gray-500 font-medium">ते</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-sm text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary h-[28px]"
              />
              <button
                onClick={fetchDailyStatement}
                disabled={loading}
                className="px-3 py-1 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-[11px] flex items-center gap-1 shadow-2xs h-[28px] cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>शोधा</span>
              </button>
            </div>

            {/* Daily stats summary chips */}
            {dailyData && (
              <div className="flex items-center gap-2">
                <span className="bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-300 text-[10.5px] font-semibold text-gray-700">
                  मासिक सरासरी: <strong className="text-emerald-700">{dailyData.averageCrrPercent}%</strong>
                </span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-300 text-[10.5px] font-semibold text-gray-700">
                  उच्चांक: <strong>{dailyData.maxCrrPercent}%</strong>
                </span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-300 text-[10.5px] font-semibold text-gray-700">
                  नीचांक: <strong>{dailyData.minCrrPercent}%</strong>
                </span>
                <span className={`px-2 py-0.5 rounded-sm text-[10.5px] font-bold border ${
                  dailyData.deficitDaysCount === 0 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}>
                  तुटवडा दिवस: {dailyData.deficitDaysCount} दिवस
                </span>
              </div>
            )}
          </div>

          {/* Daily Trend Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-gray-800 font-bold border-b border-slate-300">
                  <th className="py-1.5 px-2 text-left border border-slate-300">तारीख</th>
                  <th className="py-1.5 px-2 text-left border border-slate-300">वार</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">एकूण ठेवी (₹)</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">रोख शिल्लक (₹)</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">बँक चालू खाती (₹)</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">एकूण तरल रोकड (₹)</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">प्रत्यक्ष CRR %</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">आवश्यक रक्कम ({targetCrrPercent}%)</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">अधिशेष / तुटवडा (₹)</th>
                  <th className="py-1.5 px-2 text-center border border-slate-300">स्थिती</th>
                </tr>
              </thead>
              <tbody>
                {dailyData?.rows && dailyData.rows.length > 0 ? (
                  dailyData.rows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-primary/5 transition-colors">
                      <td className="py-1.5 px-2 font-medium border border-slate-200">{r.displayDate}</td>
                      <td className="py-1.5 px-2 text-gray-500 border border-slate-200">{r.dayOfWeek}</td>
                      <td className="py-1.5 px-2 text-right font-mono border border-slate-200">{fmt(r.totalDeposits)}</td>
                      <td className="py-1.5 px-2 text-right text-emerald-800 font-semibold font-mono border border-slate-200">{fmt(r.cashInHand)}</td>
                      <td className="py-1.5 px-2 text-right text-primary font-semibold font-mono border border-slate-200">{fmt(r.bankCurrent)}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-gray-900 font-mono border border-slate-200">{fmt(r.totalLiquidCash)}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold border border-slate-200">
                        <span className={`px-1.5 py-0.5 rounded-xs ${
                          r.crrPercent >= 1.0 && r.crrPercent <= 5.0 
                            ? 'text-emerald-800 bg-emerald-50 border border-emerald-300 font-black' 
                            : r.crrPercent < 1.0 
                              ? 'text-rose-800 bg-rose-50 border border-rose-300 font-black' 
                              : 'text-amber-800 bg-amber-50 border border-amber-300 font-black'
                        }`}>
                          {r.crrPercent}%
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-600 font-mono border border-slate-200">{fmt(r.requiredAmount)}</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-semibold border border-slate-200 ${
                        r.surplusDeficit >= 0 ? 'text-primary' : 'text-rose-700'
                      }`}>
                        {r.surplusDeficit >= 0 ? '+' : ''}{fmt(r.surplusDeficit)}
                      </td>
                      <td className="py-1.5 px-2 text-center border border-slate-200">
                        <span className="text-[10px] font-bold">{r.statusBadge}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-4 text-center text-gray-400 border border-slate-200">
                      माहिती उपलब्ध नाही. कृपया कालावधी निवडून 'शोधा' बटणावर क्लिक करा.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: शाखानिहाय रोख मर्यादा पडताळणी (Screen Only) */}
      {activeTab === 'branch' && (
        <div className="bg-white rounded-sm border border-slate-300 shadow-2xs p-3 text-[11px] no-print">
          <div className="font-bold text-gray-900 text-xs mb-2 pb-1.5 border-b border-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-primary">
              <Building2 className="w-4 h-4" />
              <span>शाखानिहाय मंजूर रोख मर्यादा (Retention Limit) व विमा सुरक्षा पडताळणी</span>
            </span>
            <span className="text-gray-500 text-[10.5px]">अखेर दिनांक: {asOnDate}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-gray-800 font-bold border-b border-slate-300">
                  <th className="py-1.5 px-2 text-left border border-slate-300">शाखा कोड</th>
                  <th className="py-1.5 px-2 text-left border border-slate-300">शाखा नाव</th>
                  <th className="py-1.5 px-2 text-left border border-slate-300">शाखा प्रकार</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">मंजूर रोख मर्यादा (₹)</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">प्रत्यक्ष रोख शिल्लक (₹)</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">मर्यादा फरक (₹)</th>
                  <th className="py-1.5 px-2 text-right border border-slate-300">विमा संरक्षण मर्यादा (₹)</th>
                  <th className="py-1.5 px-2 text-center border border-slate-300">विमा सुरक्षा</th>
                  <th className="py-1.5 px-2 text-center border border-slate-300">स्थिती</th>
                </tr>
              </thead>
              <tbody>
                {branchData && branchData.length > 0 ? (
                  branchData.map((b) => (
                    <tr key={b.branchId} className="hover:bg-primary/5 transition-colors">
                      <td className="py-1.5 px-2 font-semibold text-gray-700 font-mono border border-slate-200">{b.branchCode}</td>
                      <td className="py-1.5 px-2 font-bold text-gray-900 border border-slate-200">{b.branchName}</td>
                      <td className="py-1.5 px-2 text-gray-500 border border-slate-200">{b.branchType}</td>
                      <td className="py-1.5 px-2 text-right font-mono border border-slate-200">₹ {fmt(b.approvedCashLimit)}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-emerald-800 font-mono border border-slate-200">₹ {fmt(b.actualCashBalance)}</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-semibold border border-slate-200 ${
                        b.isBreached ? 'text-rose-700' : 'text-gray-600'
                      }`}>
                        {b.variance > 0 ? `+ ₹ ${fmt(b.variance)} (उल्लंघन)` : `₹ ${fmt(Math.abs(b.variance))} (शिल्लक)`}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono border border-slate-200">₹ {fmt(b.insuranceLimit)}</td>
                      <td className="py-1.5 px-2 text-center border border-slate-200">
                        <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-bold border ${
                          b.isInsuranceAdequate 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}>
                          {b.isInsuranceAdequate ? '✅ संरक्षित' : '⚠️ अपुरे कव्हर'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-center border border-slate-200">
                        <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-bold border ${
                          b.isBreached 
                            ? 'bg-rose-50 text-rose-800 border-rose-300' 
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}>
                          {b.statusBadge}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-gray-400 border border-slate-200">
                      शाखा माहिती उपलब्ध नाही.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: वैधानिक नियम व अंमलबजावणी आराखडा (Screen Only) */}
      {activeTab === 'framework' && (
        <div className="space-y-3 no-print">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Card 1: Statutory Norms */}
            <div className="bg-white rounded-sm border border-slate-300 shadow-2xs p-3">
              <div className="font-bold text-gray-900 text-xs mb-2 pb-1.5 border-b border-slate-300 flex items-center gap-1.5 text-primary">
                <Scale className="w-4 h-4" />
                <span>१. वैधानिक तरलता निकष (Statutory Liquidity Norms)</span>
              </div>
              <ul className="space-y-2 text-[11px] text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[10px]">१</span>
                  <div>
                    <strong className="text-gray-900">किमान CRR प्रमाण (१.००%):</strong> महाराष्ट्र सहकारी संस्था कायदा व पतसंस्था नियामक मंडळ, पुणे मार्गदर्शक तत्त्वांनुसार प्रत्येक पतसंस्थेने एकूण ठेवींच्या किमान १% इतकी रोख तरलता राखणे कायदेशीररित्या अनिवार्य आहे.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[10px]">२</span>
                  <div>
                    <strong className="text-gray-900">आदर्श प्रमाण (३.००%):</strong> दैनिक ठेवी परतावा, धनादेश वटणावळ आणि आकस्मिक रोख गरजा सुरळीत चालण्यासाठी ३.००% तरलता राखणे आदर्श मानले जाते.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 text-[10px]">३</span>
                  <div>
                    <strong className="text-gray-900">कमाल मर्यादा (५.००%):</strong> ५.००% पेक्षा जास्त रोख ठेवणे अनुत्पादक मानले जाते. संस्थेला व्याज तोटा होऊ नये म्हणून अतिरिक्त रोकड तात्काळ जिल्हा मध्यवर्ती बँकेच्या मुदत ठेवींमध्ये गुंतवावी.
                  </div>
                </li>
              </ul>
            </div>

            {/* Card 2: Computation Formula */}
            <div className="bg-white rounded-sm border border-slate-300 shadow-2xs p-3">
              <div className="font-bold text-gray-900 text-xs mb-2 pb-1.5 border-b border-slate-300 flex items-center gap-1.5 text-primary">
                <Percent className="w-4 h-4" />
                <span>२. CRR गणना सूत्र व घटकांची व्याप्ती (Formula & Components)</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-sm mb-2 text-center font-mono font-bold text-gray-800 text-[11px]">
                CRR % = (उपलब्ध रोख तरलता ÷ एकूण ठेवी दायित्व NDTL) × १००
              </div>
              <div className="space-y-1.5 text-[11px] text-gray-700">
                <div>
                  <strong className="text-gray-900">अंश (Numerator):</strong> प्रत्यक्ष तिजोरी रोख शिल्लक (Cash in Hand) + बँकांमधील चालू खाती (Current Accounts Balance).
                </div>
                <div>
                  <strong className="text-gray-900">छेद (Denominator):</strong> एकूण बाह्य ठेवी दायित्व (NDTL) = मुदत ठेवी (FD) + बचत खाती (Savings) + आवर्ती ठेवी (RD) + पिग्मी ठेवी (Pigmy).
                </div>
                <div className="text-[10px] text-primary font-bold mt-1">
                  * टीप: बँकेतील मुदत ठेवी (FD) या SLR (Statutory Liquidity Ratio) मध्ये गणल्या जातात, CRR मध्ये फक्त चालू खाती गणली जातात.
                </div>
              </div>
            </div>

            {/* Card 3: Retention & Insurance Policy */}
            <div className="bg-white rounded-sm border border-slate-300 shadow-2xs p-3">
              <div className="font-bold text-gray-900 text-xs mb-2 pb-1.5 border-b border-slate-300 flex items-center gap-1.5 text-primary">
                <Building2 className="w-4 h-4" />
                <span>३. शाखा रोख धारणा मर्यादा व तिजोरी विमा (Retention & Insurance)</span>
              </div>
              <ul className="space-y-2 text-[11px] text-gray-700">
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>संचालक मंडळाने मंजूर केलेली <strong>रोख धारणा मर्यादा (Cash Retention Limit)</strong> प्रत्येक शाखेसाठी अंतिम मानली जाईल.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>दिवसाअखेर अतिरिक्त रोकड आढळल्यास ती दुसऱ्या दिवशी सकाळी पहिल्या सत्रात जिल्हा बँक किंवा मुख्य शाखेत जमा करावी.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>प्रत्येक शाखेचा <strong>तिजोरी रोख विमा (Cash-in-Safe Cover)</strong> हा प्रत्यक्ष मंजूर रोख मर्यादेपेक्षा जास्त असावा.</span>
                </li>
              </ul>
            </div>

            {/* Card 4: Action & Contingency Plan */}
            <div className="bg-white rounded-sm border border-slate-300 shadow-2xs p-3">
              <div className="font-bold text-gray-900 text-xs mb-2 pb-1.5 border-b border-slate-300 flex items-center gap-1.5 text-primary">
                <ShieldCheck className="w-4 h-4" />
                <span>४. आपत्कालीन तरलता व्यवस्थापन कृती आराखडा (Action Plan)</span>
              </div>
              <div className="space-y-2 text-[11px] text-gray-700">
                <div className="p-1.5 bg-rose-50 border border-rose-200 rounded-sm">
                  <strong className="text-rose-800">CRR १% पेक्षा कमी (तुटवडा/धोका):</strong> नवीन कर्ज वितरण तात्काळ थांबवावे, बँक ओव्हरड्राफ्ट/क्रेडिट लाईन सक्रिय करावी, आणि मुदतपूर्व ठेवी परताव्यावर तात्पुरते नियंत्रण आणावे.
                </div>
                <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-sm">
                  <strong className="text-amber-800">CRR १% ते ३% (सावध स्थिती):</strong> दैनंदिन रोख आवक-जावकचे काटेकोर संनियंत्रण ठेवावे व ठेवी गोळा करणाऱ्या प्रतिनिधींकडून रोख वेळेत जमा करून घ्यावी.
                </div>
                <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded-sm">
                  <strong className="text-emerald-800">CRR ५% पेक्षा जास्त (अतिरिक्त रोख):</strong> अतिरिक्त अनुत्पादक रोकड जिल्हा बँकेत अल्पमुदत मुदत ठेवीत (Short Term FD) गुंतवून संस्थेचे व्याज उत्पन्न वाढवावे.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT-ONLY OFFICIAL CBS REPORT (Hidden on Screen, Visible on Print)       */}
      {/* ========================================================================= */}
      <div className="hidden print:block print-area">
        {/* Print Society Header */}
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-3">
          <h1 className="text-base font-bold uppercase tracking-wide text-gray-900">
            {summaryData?.sanstha?.name || 'नागरी सहकारी पतसंस्था मर्यादित'}
          </h1>
          <p className="text-[10px] text-gray-600 mt-0.5">
            नोंदणी क्र.: {summaryData?.sanstha?.registrationNo || '-'} | पत्ता: {summaryData?.sanstha?.address || '-'} | संपर्क: {summaryData?.sanstha?.contactNo || '-'}
          </p>
          <div className="mt-2 py-0.5 px-3 bg-slate-100 border border-slate-400 inline-block font-bold text-xs uppercase tracking-wider">
            CRR (रोख राखीव प्रमाण / रोख तरलता) वैधानिक विवरणपत्र
          </div>
          <div className="text-[10px] text-gray-600 mt-1">
            अखेर दिनांक: <strong>{asOnDate}</strong> | विहित निकष: <strong>१.००% ते ५.००%</strong> | संस्थेचे लक्ष्य: <strong>{targetCrrPercent}%</strong>
          </div>
        </div>

        {/* Print Summary Table */}
        <div className="mb-4">
          <div className="font-bold text-xs text-gray-900 border-b border-slate-400 pb-1 mb-2">
            १. रोख तरलता व वैधानिक अनुपालन सारांश
          </div>
          <table className="w-full text-xs border-collapse border border-slate-800">
            <thead>
              <tr className="bg-slate-100 text-gray-900 font-bold border-b border-slate-800">
                <th className="py-1 px-2 text-left border border-slate-800">अ.क्र.</th>
                <th className="py-1 px-2 text-left border border-slate-800">तपशील / घटक नाव</th>
                <th className="py-1 px-2 text-right border border-slate-800">रक्कम (₹) / प्रमाण</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 px-2 border border-slate-800 text-center">१</td>
                <td className="py-1 px-2 border border-slate-800 font-semibold">एकूण ठेवी बाह्य दायित्व (NDTL Deposits Base)</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-mono font-bold">₹ {fmt(summaryData?.totalDeposits)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 border border-slate-800 text-center">२</td>
                <td className="py-1 px-2 border border-slate-800">  - मुदत ठेवी (Fixed Deposits - FD)</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-mono">₹ {fmt(summaryData?.depositBreakup?.fixedDeposits)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 border border-slate-800 text-center">३</td>
                <td className="py-1 px-2 border border-slate-800">  - बचत ठेवी (Savings Accounts)</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-mono">₹ {fmt(summaryData?.depositBreakup?.savingDeposits)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 border border-slate-800 text-center">४</td>
                <td className="py-1 px-2 border border-slate-800">  - आवर्ती ठेवी (Recurring Deposits - RD)</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-mono">₹ {fmt(summaryData?.depositBreakup?.recurringDeposits)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 border border-slate-800 text-center">५</td>
                <td className="py-1 px-2 border border-slate-800">  - दैनिक / पिग्मी ठेवी (Pigmy Deposits)</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-mono">₹ {fmt(summaryData?.depositBreakup?.pigmyDeposits)}</td>
              </tr>
              <tr className="bg-slate-50 font-semibold">
                <td className="py-1 px-2 border border-slate-800 text-center">६</td>
                <td className="py-1 px-2 border border-slate-800">प्रत्यक्ष तिजोरी रोख शिल्लक (Physical Cash in Hand)</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-mono">₹ {fmt(summaryData?.cashInHand)}</td>
              </tr>
              <tr className="bg-slate-50 font-semibold">
                <td className="py-1 px-2 border border-slate-800 text-center">७</td>
                <td className="py-1 px-2 border border-slate-800">बँकांमधील चालू खाती शिल्लक (Bank Current Balances)</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-mono">₹ {fmt(summaryData?.bankCurrentBalances)}</td>
              </tr>
              <tr className="bg-slate-100 font-bold">
                <td className="py-1.5 px-2 border border-slate-800 text-center">८</td>
                <td className="py-1.5 px-2 border border-slate-800">एकूण उपलब्ध रोख तरलता (Liquid Cash: ६ + ७)</td>
                <td className="py-1.5 px-2 border border-slate-800 text-right font-mono">₹ {fmt(summaryData?.totalLiquidCash)}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 border border-slate-800 text-center">९</td>
                <td className="py-1 px-2 border border-slate-800 font-semibold">विहित वैधानिक CRR निकष (%)</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-mono font-bold">१.००% ते ५.००%</td>
              </tr>
              <tr className="bg-slate-100 font-bold">
                <td className="py-1.5 px-2 border border-slate-800 text-center">१०</td>
                <td className="py-1.5 px-2 border border-slate-800">प्रत्यक्ष राखलेले CRR प्रमाण (%)</td>
                <td className="py-1.5 px-2 border border-slate-800 text-right font-mono text-sm">{summaryData?.actualCrrPercent}%</td>
              </tr>
              <tr>
                <td className="py-1 px-2 border border-slate-800 text-center">११</td>
                <td className="py-1 px-2 border border-slate-800">आवश्यक किमान CRR रक्कम (लक्ष्य {targetCrrPercent}% प्रमाणे)</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-mono">₹ {fmt(summaryData?.requiredCrrAmount)}</td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="py-1 px-2 border border-slate-800 text-center">१२</td>
                <td className="py-1 px-2 border border-slate-800">अधिशेष (+) / तुटवडा (-) रक्कम</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-mono">
                  {(summaryData?.surplusDeficitAmount || 0) >= 0 ? '+' : ''} ₹ {fmt(summaryData?.surplusDeficitAmount)}
                </td>
              </tr>
              <tr>
                <td className="py-1 px-2 border border-slate-800 text-center">१३</td>
                <td className="py-1 px-2 border border-slate-800 font-semibold">वैधानिक अनुपालन स्थिती (Compliance Status)</td>
                <td className="py-1 px-2 border border-slate-800 text-right font-bold">{summaryData?.statusTextMarathi}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Print Signatures Block (Official CBS 3-Tier) */}
        <div className="mt-14 pt-4 text-xs">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="h-12"></div>
              <div className="font-bold border-t border-slate-800 pt-1">रोखपाल / कॅशियर</div>
              <div className="text-[10px] text-gray-500">(तयार केले / Maker)</div>
            </div>
            <div>
              <div className="h-12"></div>
              <div className="font-bold border-t border-slate-800 pt-1">लेखापाल / अंतर्गत लेखापरीक्षक</div>
              <div className="text-[10px] text-gray-500">(तपासले / Checker)</div>
            </div>
            <div>
              <div className="h-12"></div>
              <div className="font-bold border-t border-slate-800 pt-1">मुख्य कार्यकारी अधिकारी / व्यवस्थापक</div>
              <div className="text-[10px] text-gray-500">(मंजूर केले / Authorized)</div>
            </div>
          </div>
          <div className="text-[9px] text-gray-500 text-center mt-6">
            हा अहवाल SmartBanking Core Banking System द्वारे दिनांक {new Date().toLocaleDateString('en-GB')} रोजी तयार करण्यात आला असून संगणकीय सुरक्षित प्रत आहे.
          </div>
        </div>
      </div>
    </div>
  );
}
