import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';
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
  AlertTriangle
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
  const [activeTab, setActiveTab] = useState<'summary' | 'daily' | 'branch'>('summary');
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
        ['संस्थेचे नाव:', summaryData.sanstha?.name || 'पतसंस्था मर्यादित'],
        ['नोंदणी क्रमांक:', summaryData.sanstha?.registrationNo || '', 'अखेर दिनांक:', summaryData.asOnDate],
        [''],
        ['तपशील / घटक', 'रक्कम / प्रमाण'],
        ['एकूण ठेवी दायित्व (NDTL / Total Deposits)', summaryData.totalDeposits],
        ['मुदत ठेवी (Fixed Deposits - FD)', summaryData.depositBreakup?.fixedDeposits || 0],
        ['बचत खाती (Savings Accounts)', summaryData.depositBreakup?.savingDeposits || 0],
        ['आवर्ती ठेवी (Recurring Deposits - RD)', summaryData.depositBreakup?.recurringDeposits || 0],
        ['दैनिक / पिग्मी ठेवी (Daily / Pigmy)', summaryData.depositBreakup?.pigmyDeposits || 0],
        [''],
        ['प्रत्यक्ष तिजोरीतील रोख शिल्लक (Cash in Hand)', summaryData.cashInHand],
        ['बँकांमधील चालू खाती शिल्लक (Bank Current)', summaryData.bankCurrentBalances],
        ['एकूण रोख तरलता राखीव (Total Liquid Cash)', summaryData.totalLiquidCash],
        [''],
        ['विहित किमान CRR निकष (%)', `${summaryData.statutoryMinPercent}% ते ${summaryData.statutoryMaxPercent}%`],
        ['संस्थेचे लक्ष्य CRR (%)', `${summaryData.targetCrrPercent}%`],
        ['प्रत्यक्ष राखलेले CRR (%)', `${summaryData.actualCrrPercent}%`],
        ['आवश्यक किमान CRR रक्कम (₹)', summaryData.requiredCrrAmount],
        ['अधिशेष / तुटवडा रक्कम (₹)', summaryData.surplusDeficitAmount],
        ['वैधानिक स्थिती (Statutory Status)', summaryData.statusTextMarathi],
        ['नियामक मंडळ अंशदान योजना पात्रता', summaryData.isEligibleForContribution ? 'पात्र (Eligible)' : 'अपात्र (Ineligible)']
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'CRR_Summary');
    }

    // 2. Daily Statement Sheet
    if (dailyData && dailyData.rows?.length > 0) {
      const dailyRows = [
        ['CRR दैनिक व पंधरवडानिहाय कल नोंदवही (Daily Statement)'],
        ['कालावधी:', `${dailyData.fromDate} ते ${dailyData.toDate}`],
        ['मासिक सरासरी CRR:', `${dailyData.averageCrrPercent}%`, 'उच्चांक:', `${dailyData.maxCrrPercent}%`, 'नीचांक:', `${dailyData.minCrrPercent}%`],
        ['तुटवडा राहिलेले दिवस:', dailyData.deficitDaysCount],
        [''],
        ['तारीख', 'वार', 'एकूण ठेवी (₹)', 'रोख शिल्लक (₹)', 'बँक चालू शिल्लक (₹)', 'एकूण तरल रोकड (₹)', 'प्रत्यक्ष CRR (%)', 'आवश्यक रक्कम (₹)', 'अधिशेष / तुटवडा (₹)', 'स्थिती']
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
    <div className="min-h-screen bg-slate-50 text-slate-800 p-3 sm:p-6 print:p-0 print:bg-white font-sans">
      <Toaster position="top-right" />

      {/* Top Banner & Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-600 text-white p-2 rounded-lg shadow-sm">
                <Landmark className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <span>CRR रोख राखीव प्रमाण व तरलता अहवाल</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                    विहित निकष: १.००% ते ५.००%
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  महाराष्ट्र सहकारी संस्था कायदा १९६० व पतसंस्था नियामक मंडळ, पुणे मार्गदर्शक नियमांनुसार रोख तरलता विवरण
                </p>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>अखेर दिनांक:</span>
              <input 
                type="date" 
                value={asOnDate} 
                onChange={(e) => setAsOnDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700">
              <span>लक्ष्य CRR %:</span>
              <select
                value={targetCrrPercent}
                onChange={(e) => setTargetCrrPercent(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="1.0">१.००% (किमान)</option>
                <option value="2.0">२.००%</option>
                <option value="3.0">३.००% (आदर्श)</option>
                <option value="4.0">४.००%</option>
                <option value="5.0">५.००% (कमाल)</option>
              </select>
            </div>

            <button
              onClick={() => {
                fetchCrrSummary();
                if (activeTab === 'daily') fetchDailyStatement();
                if (activeTab === 'branch') fetchBranchRetention();
              }}
              disabled={loading}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'अपडेट होत आहे...' : 'रिफ्रेश'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm"
              title="एक्सेल फाइल डाऊनलोड करा"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>एक्सेल (XLSX)</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>प्रिंट प्रत</span>
            </button>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block text-center border-b-2 border-slate-800 pb-3 mb-4">
        <h1 className="text-xl font-bold uppercase">{summaryData?.sanstha?.name || 'नागरी सहकारी पतसंस्था मर्यादित'}</h1>
        <p className="text-xs text-slate-600">
          नोंदणी क्र.: {summaryData?.sanstha?.registrationNo || '-'} | पत्ता: {summaryData?.sanstha?.address || '-'}
        </p>
        <div className="mt-2 py-1 px-3 bg-slate-100 border border-slate-300 inline-block font-semibold text-xs">
          CRR (रोख राखीव प्रमाण / रोख तरलता) विवरणपत्र - अखेर दिनांक: {asOnDate}
        </div>
      </div>

      {/* Primary KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Card 1: Total Deposits Base */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>एकूण ठेवी दायित्व (NDTL)</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800 my-1">
            ₹ {fmt(summaryData?.totalDeposits)}
          </div>
          <div className="text-[11px] text-slate-500">
            FD, बचत, RD व पिग्मी ठेवींची एकूण बेरीज
          </div>
        </div>

        {/* Card 2: Liquid Cash Reserve */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>राखलेली रोख तरलता</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 my-1">
            ₹ {fmt(summaryData?.totalLiquidCash)}
          </div>
          <div className="text-[11px] text-slate-500">
            तिजोरी रोख: ₹ {fmt(summaryData?.cashInHand)} | बँक चालू: ₹ {fmt(summaryData?.bankCurrentBalances)}
          </div>
        </div>

        {/* Card 3: Actual CRR % & Badge */}
        <div className={`rounded-xl p-4 shadow-sm border ${
          summaryData?.complianceStatus === 'Complied' 
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
            : summaryData?.complianceStatus === 'Deficit'
              ? 'bg-rose-50/70 border-rose-200 text-rose-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
        }`}>
          <div className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>प्रत्यक्ष राखलेले CRR %</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black my-1">
            {summaryData?.actualCrrPercent || 0}%
          </div>
          <div className="mt-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
              summaryData?.complianceStatus === 'Complied'
                ? 'bg-emerald-600 text-white'
                : summaryData?.complianceStatus === 'Deficit'
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-600 text-white'
            }`}>
              {summaryData?.complianceStatus === 'Complied' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              <span>{summaryData?.statusTextMarathi || 'पडताळणी चालू'}</span>
            </span>
          </div>
        </div>

        {/* Card 4: Surplus / Deficit Amount */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>अधिशेष / तुटवडा रक्कम</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className={`text-2xl font-bold my-1 ${
            (summaryData?.surplusDeficitAmount || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
          }`}>
            {(summaryData?.surplusDeficitAmount || 0) >= 0 ? '+' : ''} ₹ {fmt(summaryData?.surplusDeficitAmount)}
          </div>
          <div className="text-[11px] text-slate-500">
            आवश्यक {targetCrrPercent}% प्रमाणे: ₹ {fmt(summaryData?.requiredCrrAmount)}
          </div>
        </div>
      </div>

      {/* Tabs Navigation (Screen only) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden print:hidden">
        <div className="flex divide-x divide-slate-100">
          {[
            { id: 'summary', name: '१. मुख्य सारांश व घटक ताळमेळ', desc: 'रोख शिल्लक, बँक चालू खाती व ठेवी वर्गीकरण' },
            { id: 'daily', name: '२. दैनिक व पंधरवडानिहाय कल नोंदवही', desc: 'सलग ३० दिवसांचा दैनंदिन तरलता कल' },
            { id: 'branch', name: '३. शाखानिहाय रोख मर्यादा पडताळणी', desc: 'शाखा रोख मर्यादा (Retention Limit) व विमा' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 p-3 text-left transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-50/70 text-emerald-950 border-b-2 border-emerald-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="text-xs sm:text-sm font-bold flex items-center justify-between">
                <span>{tab.name}</span>
                {activeTab === tab.id && <ChevronRight className="w-4 h-4 text-emerald-600" />}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{tab.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: मुख्य सारांश व घटक ताळमेळ */}
      {(activeTab === 'summary' || window.matchMedia('print').matches) && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            {/* Left: Cash in Hand Breakup */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
              <div className="font-bold text-slate-800 text-sm mb-3 pb-2 border-b border-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>अ) प्रत्यक्ष रोख शिल्लक (Physical Cash in Hand)</span>
                </span>
                <span className="text-emerald-700 font-bold">₹ {fmt(summaryData?.cashInHand)}</span>
              </div>
              
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="py-2 px-3 text-left">रोख खाते / तिजोरी लेजर नाव</th>
                    <th className="py-2 px-3 text-right">शिल्लक रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryData?.cashDetails && summaryData.cashDetails.length > 0 ? (
                    summaryData.cashDetails.map((c) => (
                      <tr key={c.ledgerId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-slate-700">{c.ledgerName}</td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900">₹ {fmt(c.balance)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-3 px-3 text-center text-slate-400">
                        रोख लेजर्स उपलब्ध नाहीत
                      </td>
                    </tr>
                  )}
                  <tr className="bg-emerald-50/70 font-bold">
                    <td className="py-2 px-3 text-emerald-950">एकूण प्रत्यक्ष रोख शिल्लक:</td>
                    <td className="py-2 px-3 text-right text-emerald-950">₹ {fmt(summaryData?.cashInHand)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right: Bank Current Accounts Breakup */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
              <div className="font-bold text-slate-800 text-sm mb-3 pb-2 border-b border-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-blue-600" />
                  <span>ब) बँकांमधील चालू खाती शिल्लक (Bank Current Balances)</span>
                </span>
                <span className="text-blue-700 font-bold">₹ {fmt(summaryData?.bankCurrentBalances)}</span>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="py-2 px-3 text-left">बँक खाते नाव</th>
                    <th className="py-2 px-3 text-left">खाते प्रकार</th>
                    <th className="py-2 px-3 text-right">शिल्लक रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryData?.bankCurrentDetails && summaryData.bankCurrentDetails.length > 0 ? (
                    summaryData.bankCurrentDetails.map((b) => (
                      <tr key={b.ledgerId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-slate-700">{b.ledgerName}</td>
                        <td className="py-2 px-3 text-slate-500">{b.accountType}</td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900">₹ {fmt(b.balance)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-3 px-3 text-center text-slate-400">
                        बँक चालू खाती नोंदी उपलब्ध नाहीत
                      </td>
                    </tr>
                  )}
                  <tr className="bg-blue-50/70 font-bold">
                    <td colSpan={2} className="py-2 px-3 text-blue-950">एकूण बँक चालू खाती शिल्लक:</td>
                    <td className="py-2 px-3 text-right text-blue-950">₹ {fmt(summaryData?.bankCurrentBalances)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom: Deposits Base Composition Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 text-xs">
            <div className="font-bold text-slate-800 text-sm mb-3 pb-2 border-b border-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-purple-600" />
                <span>क) एकूण ठेवींची रचना (Deposit Liabilities Composition)</span>
              </span>
              <span className="text-purple-700 font-bold">₹ {fmt(summaryData?.totalDeposits)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500">१. मुदत ठेवी (Fixed Deposits - FD)</div>
                <div className="text-base font-bold text-slate-800 mt-1">₹ {fmt(summaryData?.depositBreakup?.fixedDeposits)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500">२. बचत ठेवी (Savings Accounts)</div>
                <div className="text-base font-bold text-slate-800 mt-1">₹ {fmt(summaryData?.depositBreakup?.savingDeposits)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500">३. आवर्ती ठेव (Recurring Deposits - RD)</div>
                <div className="text-base font-bold text-slate-800 mt-1">₹ {fmt(summaryData?.depositBreakup?.recurringDeposits)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500">४. दैनिक / पिग्मी ठेव (Pigmy Deposits)</div>
                <div className="text-base font-bold text-slate-800 mt-1">₹ {fmt(summaryData?.depositBreakup?.pigmyDeposits)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: दैनिक व पंधरवडानिहाय कल नोंदवही */}
      {(activeTab === 'daily' || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 text-xs">
          {/* Daily Controls bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200 print:hidden">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">कालावधी:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-xs font-medium"
              />
              <span>ते</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-xs font-medium"
              />
              <button
                onClick={fetchDailyStatement}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-semibold"
              >
                शोधा
              </button>
            </div>

            {/* Daily stats summary chips */}
            {dailyData && (
              <div className="flex items-center gap-2">
                <span className="bg-slate-100 px-2 py-1 rounded text-[11px] font-semibold text-slate-700">
                  मासिक सरासरी: <strong className="text-emerald-700">{dailyData.averageCrrPercent}%</strong>
                </span>
                <span className="bg-slate-100 px-2 py-1 rounded text-[11px] font-semibold text-slate-700">
                  उच्चांक: <strong>{dailyData.maxCrrPercent}%</strong>
                </span>
                <span className="bg-slate-100 px-2 py-1 rounded text-[11px] font-semibold text-slate-700">
                  नीचांक: <strong>{dailyData.minCrrPercent}%</strong>
                </span>
                <span className={`px-2 py-1 rounded text-[11px] font-bold ${
                  dailyData.deficitDaysCount === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  तुटवडा दिवस: {dailyData.deficitDaysCount} दिवस
                </span>
              </div>
            )}
          </div>

          {/* Daily Trend Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="py-2 px-2 text-left">तारीख</th>
                  <th className="py-2 px-2 text-left">वार</th>
                  <th className="py-2 px-2 text-right">एकूण ठेवी (₹)</th>
                  <th className="py-2 px-2 text-right">रोख शिल्लक (₹)</th>
                  <th className="py-2 px-2 text-right">बँक चालू खाती (₹)</th>
                  <th className="py-2 px-2 text-right">एकूण तरल रोकड (₹)</th>
                  <th className="py-2 px-2 text-right">प्रत्यक्ष CRR %</th>
                  <th className="py-2 px-2 text-right">आवश्यक रक्कम ({targetCrrPercent}%)</th>
                  <th className="py-2 px-2 text-right">अधिशेष / तुटवडा (₹)</th>
                  <th className="py-2 px-2 text-center">स्थिती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyData?.rows && dailyData.rows.length > 0 ? (
                  dailyData.rows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-2 font-medium">{r.displayDate}</td>
                      <td className="py-2 px-2 text-slate-500">{r.dayOfWeek}</td>
                      <td className="py-2 px-2 text-right">{fmt(r.totalDeposits)}</td>
                      <td className="py-2 px-2 text-right text-emerald-700 font-semibold">{fmt(r.cashInHand)}</td>
                      <td className="py-2 px-2 text-right text-blue-700 font-semibold">{fmt(r.bankCurrent)}</td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900">{fmt(r.totalLiquidCash)}</td>
                      <td className="py-2 px-2 text-right font-black">
                        <span className={`px-1.5 py-0.5 rounded ${
                          r.crrPercent >= 1.0 && r.crrPercent <= 5.0 
                            ? 'text-emerald-700' 
                            : r.crrPercent < 1.0 
                              ? 'text-rose-600 bg-rose-50' 
                              : 'text-amber-600'
                        }`}>
                          {r.crrPercent}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-slate-600">{fmt(r.requiredAmount)}</td>
                      <td className={`py-2 px-2 text-right font-semibold ${
                        r.surplusDeficit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        {r.surplusDeficit >= 0 ? '+' : ''}{fmt(r.surplusDeficit)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-[11px] font-bold">{r.statusBadge}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-4 text-center text-slate-400">
                      माहिती उपलब्ध नाही. कृपया कालावधी निवडून 'शोधा' बटणावर क्लिक करा.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: शाखानिहाय रोख मर्यादा पडताळणी */}
      {(activeTab === 'branch' || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 text-xs">
          <div className="font-bold text-slate-800 text-sm mb-3 pb-2 border-b border-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>शाखानिहाय मंजूर रोख मर्यादा (Retention Limit) व विमा सुरक्षा पडताळणी</span>
            </span>
            <span className="text-slate-500 text-xs">दिनांक: {asOnDate}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="py-2 px-3 text-left">शाखा कोड</th>
                  <th className="py-2 px-3 text-left">शाखा नाव</th>
                  <th className="py-2 px-3 text-left">शाखा प्रकार</th>
                  <th className="py-2 px-3 text-right">मंजूर रोख मर्यादा (₹)</th>
                  <th className="py-2 px-3 text-right">प्रत्यक्ष रोख शिल्लक (₹)</th>
                  <th className="py-2 px-3 text-right">मर्यादा फरक (₹)</th>
                  <th className="py-2 px-3 text-right">विमा संरक्षण मर्यादा (₹)</th>
                  <th className="py-2 px-3 text-center">विमा सुरक्षा</th>
                  <th className="py-2 px-3 text-center">स्थिती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchData && branchData.length > 0 ? (
                  branchData.map((b) => (
                    <tr key={b.branchId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-700">{b.branchCode}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{b.branchName}</td>
                      <td className="py-2 px-3 text-slate-500">{b.branchType}</td>
                      <td className="py-2 px-3 text-right font-medium">₹ {fmt(b.approvedCashLimit)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">₹ {fmt(b.actualCashBalance)}</td>
                      <td className={`py-2 px-3 text-right font-semibold ${
                        b.isBreached ? 'text-rose-600' : 'text-slate-600'
                      }`}>
                        {b.variance > 0 ? `+ ₹ ${fmt(b.variance)} (उल्लंघन)` : `₹ ${fmt(Math.abs(b.variance))} (शिल्लक)`}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">₹ {fmt(b.insuranceLimit)}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.isInsuranceAdequate ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {b.isInsuranceAdequate ? '✅ संरक्षित' : '⚠️ अपुरे कव्हर'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.isBreached ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {b.statusBadge}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-slate-400">
                      शाखा माहिती उपलब्ध नाही.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINT-ONLY SIGNATURE SECTION */}
      <div className="hidden print:block mt-12 pt-8 border-t border-slate-400 text-xs">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="h-14"></div>
            <div className="font-bold border-t border-slate-400 pt-1">रोखपाल / कॅशियर</div>
            <div className="text-[10px] text-slate-500">तयार केले</div>
          </div>
          <div>
            <div className="h-14"></div>
            <div className="font-bold border-t border-slate-400 pt-1">शाखा व्यवस्थापक / हिशोबनीस</div>
            <div className="text-[10px] text-slate-500">तपासले</div>
          </div>
          <div>
            <div className="h-14"></div>
            <div className="font-bold border-t border-slate-400 pt-1">मुख्य कार्यकारी अधिकारी / व्यवस्थापक</div>
            <div className="text-[10px] text-slate-500">मंजूर केले</div>
          </div>
        </div>
      </div>
    </div>
  );
}
