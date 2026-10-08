import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  Landmark, 
  Coins, 
  Wallet, 
  Scale, 
  Receipt, 
  BarChart3, 
  Sparkles,
  PiggyBank,
  RefreshCw,
  Users,
  FileText,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  Activity,
  Percent,
  Moon,
  AlertTriangle,
  ChevronRight,
  UserCheck,
  CreditCard
} from 'lucide-react';

const fmt = (n: number) => '₹ ' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatRegDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

interface DashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [sansthaName, setSansthaName] = useState("तुमची संस्था");
  const [sansthaInfo, setSansthaInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (user && user.role !== 'Admin' && user.branchID) {
      return user.branchID.toString();
    }
    return localStorage.getItem('globalBranchId') || (user?.branchID ? user.branchID.toString() : 'all');
  });

  useEffect(() => {
    if (user && user.role !== 'Admin' && user.branchID) {
      setSelectedBranchId(user.branchID.toString());
    }
  }, [user?.role, user?.branchID]);

  useEffect(() => {
    localStorage.setItem('globalBranchId', selectedBranchId);
  }, [selectedBranchId]);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [sansthaRes, branchesRes] = await Promise.all([
        fetch('/api/SansthaDetails'),
        fetch('/api/Branches')
      ]);

      if (sansthaRes.ok) {
        const s = await sansthaRes.json();
        if (s && s.length > 0) {
          setSansthaName(s[0].sansthaName || "तुमची संस्था");
          setSansthaInfo(s[0]);
        }
      }
      if (branchesRes.ok) {
        const b = await branchesRes.json();
        setBranches(b || []);
      }

      const branchParam = selectedBranchId !== 'all' ? `?branchId=${selectedBranchId}` : '';
      const summaryRes = await fetch(`/api/Dashboard${branchParam}`);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setData(summaryData);
      }
    } catch (e) {
      console.error('Error loading dashboard data', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranchId]);

  const handleNav = (tab: string, params?: any) => {
    if (onNavigate) {
      onNavigate(tab, params);
    }
  };

  const primaryActionButtons = [
    {
      id: 'saving',
      titleMr: 'बचत ठेव',
      titleEn: 'SAVINGS',
      image: '/action-icons/savings-3d.png',
      icon: Wallet,
      tab: 'saving',
      params: {},
      accentColor: 'from-emerald-500 to-teal-700',
      glowColor: 'rgba(16,185,129,0.3)',
    },
    {
      id: 'pigmy',
      titleMr: 'पिग्मी ठेव',
      titleEn: 'PIGMY',
      icon: PiggyBank,
      tab: 'pigmy',
      params: {},
      accentColor: 'from-teal-500 to-cyan-700',
      glowColor: 'rgba(20,184,166,0.3)',
    },
    {
      id: 'rd',
      titleMr: 'आवर्ती ठेव',
      titleEn: 'RECURRING',
      icon: Coins,
      tab: 'rd',
      params: {},
      accentColor: 'from-amber-500 to-orange-700',
      glowColor: 'rgba(245,158,11,0.3)',
    },
    {
      id: 'fd',
      titleMr: 'मुदत ठेव',
      titleEn: 'FIXED DEPOSIT',
      icon: Landmark,
      tab: 'fd',
      params: {},
      accentColor: 'from-indigo-500 to-blue-700',
      glowColor: 'rgba(99,102,241,0.3)',
    },
    {
      id: 'loan-disb',
      titleMr: 'कर्ज व्यवहार',
      titleEn: 'LOANS',
      image: '/action-icons/loan-disbursement.png',
      icon: Scale,
      tab: 'loan',
      params: {},
      accentColor: 'from-purple-500 to-violet-700',
      glowColor: 'rgba(168,85,247,0.3)',
    },
    {
      id: 'vouchers',
      titleMr: 'व्हाऊचर',
      titleEn: 'VOUCHERS',
      image: '/action-icons/journal-voucher.png',
      icon: Receipt,
      tab: 'vouchers',
      params: {},
      accentColor: 'from-rose-500 to-pink-700',
      glowColor: 'rgba(244,63,94,0.3)',
    },
    {
      id: 'reports',
      titleMr: 'अहवाल',
      titleEn: 'REPORTS',
      image: '/action-icons/loan-reports.png',
      icon: BarChart3,
      tab: 'reports',
      params: {},
      accentColor: 'from-blue-600 to-slate-800',
      glowColor: 'rgba(37,99,235,0.3)',
    }
  ];

  // Quick Daily Operations Shortcuts
  const quickOperations = [
    {
      id: 'todays-tasks',
      title: 'आजची देयके व कामे',
      subtitle: 'मुदत ठेव मॅच्युरिटी, कर्ज हफ्ते व दैनंदिन अलर्ट्स',
      tag: 'दैनिक अलर्ट्स',
      icon: Calendar,
      tab: 'todays-tasks',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50/70',
      borderColor: 'border-blue-200/80',
      tagColor: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'day-end',
      title: 'दिवसअखेर प्रक्रिया (EOD)',
      subtitle: 'कॅश पडताळणी, दिवस समाप्ती व ईओडी स्टेटस',
      tag: 'दिवसअखेर',
      icon: Moon,
      tab: 'day-end',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50/70',
      borderColor: 'border-purple-200/80',
      tagColor: 'bg-purple-100 text-purple-800'
    },
    {
      id: 'cashier-dashboard',
      title: 'कॅशियर रोख काऊंटर',
      subtitle: 'दैनिक रोख जमा, नावे, कॅश शिल्लक व हिशोब',
      tag: 'रोख व्यवहार',
      icon: Wallet,
      tab: 'cashier-dashboard',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50/70',
      borderColor: 'border-emerald-200/80',
      tagColor: 'bg-emerald-100 text-emerald-800'
    },
    {
      id: 'member-360',
      title: 'सभासद ३६०° प्रोफाइल',
      subtitle: 'सभासदाची सर्व खाती, ठेवी, कर्ज व शेअर्स एकाच ठिकाणी',
      tag: 'CIF प्रोफाइल',
      icon: Users,
      tab: 'member-360',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50/70',
      borderColor: 'border-teal-200/80',
      tagColor: 'bg-teal-100 text-teal-800'
    },
    {
      id: 'npa-dashboard',
      title: 'एन.पी.ए. व वसुली कक्ष',
      subtitle: 'थकबाकी वर्गीकरण, नोटीस ट्रॅकिंग व कायदेशीर वसुली',
      tag: 'कर्ज वसुली',
      icon: AlertTriangle,
      tab: 'npa-dashboard',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50/70',
      borderColor: 'border-amber-200/80',
      tagColor: 'bg-amber-100 text-amber-800'
    },
    {
      id: 'voucher',
      title: 'नवीन व्हाऊचर नोंद',
      subtitle: 'कॅश, बँक व जर्नल व्हाउचर त्वरित नोंदणी',
      tag: 'लेखा नोंदणी',
      icon: Receipt,
      tab: 'voucher',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50/70',
      borderColor: 'border-indigo-200/80',
      tagColor: 'bg-indigo-100 text-indigo-800'
    }
  ];

  // Calculated Co-Op Ratios & Totals
  const totalDeposits = (data?.saving?.totalBalance || 0) + 
                        (data?.fixedDeposit?.totalBalance || 0) + 
                        (data?.recurringDeposit?.totalBalance || 0) + 
                        (data?.pigmy?.totalBalance || 0);

  const totalAdvances = data?.loan?.disbursedBalance || 0;

  const cdRatio = totalDeposits > 0 
    ? ((totalAdvances / totalDeposits) * 100).toFixed(1) 
    : '0.0';

  const totalActiveAccounts = (data?.saving?.accountCount || 0) + 
                              (data?.loan?.accountCount || 0) + 
                              (data?.fixedDeposit?.accountCount || 0) + 
                              (data?.recurringDeposit?.accountCount || 0) + 
                              (data?.pigmy?.accountCount || 0);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 space-y-3 select-none">
        <div className="p-6 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-lg flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin"></div>
          <p className="text-xs font-bold text-slate-700">सीबीएस मुख्य डॅशबोर्ड लोड होत आहे...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-50/60 font-sans relative pb-10 px-3 sm:px-5 select-none">
      
      {/* Background Ambient Multi-Color Light Orbs */}
      <div className="absolute top-0 left-[-5%] w-[24rem] sm:w-[32rem] h-[24rem] sm:h-[32rem] bg-gradient-to-tr from-emerald-500/10 to-teal-400/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[-5%] w-[20rem] sm:w-[28rem] h-[20rem] sm:h-[28rem] bg-gradient-to-br from-indigo-500/8 to-blue-600/5 rounded-full blur-[110px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto w-full relative z-10 space-y-3.5 pt-2.5">
        
        {/* ========================================================================= */}
        {/* 1. TOP SECTION: SANSTHA HEADER BAR                                        */}
        {/* ========================================================================= */}
        <div className="relative rounded-2xl p-3 sm:p-3.5 backdrop-blur-xl bg-white/85 border border-white/80 shadow-xs overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-emerald-500/70 before:to-transparent">
          
          {/* Top Specular Row (Reg No, Date & System Status) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2 text-[10px] sm:text-[11px] font-semibold">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold">रजिस्टर नं.:</span>
              <span className="font-mono bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold">
                {sansthaInfo?.registrationNo || '-'}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-bold">नोंदणी दिनांक:</span>
              <span className="font-mono bg-teal-500/10 text-teal-800 border border-teal-500/20 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold">
                {formatRegDate(sansthaInfo?.registrationDate)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>CBS लाइव्ह सिस्टिम</span>
              </span>
              
              <button
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="p-1 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="डॅशबोर्ड डेटा रिफ्रेश करा"
              >
                <RefreshCw size={13} className={isRefreshing ? "animate-spin text-emerald-600" : ""} />
              </button>
            </div>
          </div>

          {/* Central Institution Title & Branch Selector */}
          <div className="pt-2.5 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-b from-emerald-500/15 to-teal-500/5 border border-emerald-500/25 shadow-inner hidden sm:flex items-center justify-center shrink-0">
                <Landmark size={22} className="text-emerald-700" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-900 tracking-tight leading-snug">
                  {sansthaName}
                </h1>
                <p className="text-[11px] sm:text-[12px] font-bold text-emerald-700 tracking-wide flex items-center justify-center md:justify-start gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>मुख्य शाखा (Head Office) &bull; को-ऑप सीबीएस कोर बँकिंग प्रणाली</span>
                </p>
              </div>
            </div>

            {/* Branch Selector Glass Pill */}
            {user?.role === 'Admin' ? (
              <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
                <Building2 size={14} className="text-emerald-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-700 shrink-0">शाखा:</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-transparent text-slate-900 text-xs font-bold py-0.5 pr-2 outline-none cursor-pointer border-none focus:ring-0 font-sans"
                >
                  <option value="all">सर्व शाखा (All Branches)</option>
                  {branches.map((b: any) => (
                    <option key={b.branchID} value={b.branchID.toString()}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-xs font-bold text-slate-600 bg-slate-100/80 px-3 py-1 rounded-lg border border-slate-200">
                शाखा: {user?.branchName || 'मुख्य शाखा'}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. PRIMARY 4 FINANCIAL STAT CARDS (आर्थिक स्थिती व खाती संक्षेप)             */}
        {/* ========================================================================= */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
            
            {/* 1. Saving Deposits Card */}
            <div 
              onClick={() => handleNav('saving')}
              className="relative rounded-2xl p-3.5 backdrop-blur-xl bg-white/85 border border-white/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[2.5px] before:bg-gradient-to-r before:from-transparent before:via-emerald-500 before:to-transparent"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  एकूण बचत ठेवी
                </span>
                <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition-transform shadow-2xs">
                  <Wallet size={14} />
                </div>
              </div>

              <div className="text-base sm:text-lg md:text-xl font-black text-slate-900 mt-1 truncate font-mono tracking-tight">
                {fmt(data?.saving?.totalBalance || 0)}
              </div>

              <div className="text-[11px] text-emerald-700 font-semibold mt-2 flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span>सक्रिय खाती: <b className="font-mono text-slate-800">{data?.saving?.accountCount || 0}</b></span>
                <span className="text-[9.5px] bg-emerald-500/10 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                  बचत ठेव
                </span>
              </div>
            </div>

            {/* 2. Loan Disbursed Card */}
            <div 
              onClick={() => handleNav('loan')}
              className="relative rounded-2xl p-3.5 backdrop-blur-xl bg-white/85 border border-white/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[2.5px] before:bg-gradient-to-r before:from-transparent before:via-amber-500 before:to-transparent"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  एकूण कर्ज वाटप
                </span>
                <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 group-hover:scale-105 transition-transform shadow-2xs">
                  <Scale size={14} />
                </div>
              </div>

              <div className="text-base sm:text-lg md:text-xl font-black text-amber-900 mt-1 truncate font-mono tracking-tight">
                {fmt(data?.loan?.disbursedBalance || 0)}
              </div>

              <div className="text-[11px] text-amber-700 font-semibold mt-2 flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span>वाटप खाती: <b className="font-mono text-slate-800">{data?.loan?.accountCount || 0}</b></span>
                <span className="text-[9.5px] bg-amber-500/10 text-amber-800 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold">
                  कर्ज खाते
                </span>
              </div>
            </div>

            {/* 3. Fixed Deposit Card */}
            <div 
              onClick={() => handleNav('fd')}
              className="relative rounded-2xl p-3.5 backdrop-blur-xl bg-white/85 border border-white/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[2.5px] before:bg-gradient-to-r before:from-transparent before:via-indigo-500 before:to-transparent"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  एकूण मुदत ठेवी
                </span>
                <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-700 group-hover:scale-105 transition-transform shadow-2xs">
                  <Landmark size={14} />
                </div>
              </div>

              <div className="text-base sm:text-lg md:text-xl font-black text-indigo-950 mt-1 truncate font-mono tracking-tight">
                {fmt(data?.fixedDeposit?.totalBalance || 0)}
              </div>

              <div className="text-[11px] text-indigo-700 font-semibold mt-2 flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span>ठेवी खाती: <b className="font-mono text-slate-800">{data?.fixedDeposit?.accountCount || 0}</b></span>
                <span className="text-[9.5px] bg-indigo-500/10 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-500/20 font-bold">
                  मुदत ठेव
                </span>
              </div>
            </div>

            {/* 4. Share Capital Card */}
            <div 
              onClick={() => handleNav('shares')}
              className="relative rounded-2xl p-3.5 backdrop-blur-xl bg-white/85 border border-white/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[2.5px] before:bg-gradient-to-r before:from-transparent before:via-teal-500 before:to-transparent"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  एकूण भाग भांडवल
                </span>
                <div className="w-7 h-7 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-700 group-hover:scale-105 transition-transform shadow-2xs">
                  <Coins size={14} />
                </div>
              </div>

              <div className="text-base sm:text-lg md:text-xl font-black text-slate-900 mt-1 truncate font-mono tracking-tight">
                {fmt(data?.shares?.totalBalance || 0)}
              </div>

              <div className="text-[11px] text-teal-700 font-semibold mt-2 flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span>एकूण सभासद: <b className="font-mono text-slate-800">{data?.shares?.memberCount || data?.members?.totalMembers || 0}</b></span>
                <span className="text-[9.5px] bg-teal-500/10 text-teal-800 px-2 py-0.5 rounded-full border border-teal-500/20 font-bold">
                  शेअर्स
                </span>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. CO-OP CBS EXECUTIVE RATIOS & CAPITAL SUMMARY (संस्था आर्थिक गुणोत्तर)     */}
        {/* ========================================================================= */}
        <div className="relative rounded-2xl p-3.5 backdrop-blur-xl bg-white/85 border border-white/80 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/60">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-emerald-600" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                संस्था आर्थिक स्थिती व तरलता गुणोत्तर (Co-Op Financial Health & Metrics)
              </h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              LIVE CO-OP CBS RATIOS
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            
            {/* Ratio 1: Total Deposits */}
            <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                एकूण संकलित ठेवी (Total Deposits)
              </span>
              <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5 font-mono">
                {fmt(totalDeposits)}
              </div>
              <p className="text-[9.5px] text-slate-500 mt-0.5">
                बचत + मुदत + पिग्मी + आवर्ती
              </p>
            </div>

            {/* Ratio 2: Total Advances */}
            <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                एकूण कर्ज बाकी (Total Advances)
              </span>
              <div className="text-sm sm:text-base font-black text-amber-900 mt-0.5 font-mono">
                {fmt(totalAdvances)}
              </div>
              <p className="text-[9.5px] text-slate-500 mt-0.5">
                संस्थेचे एकूण वाटप येणे मुद्दल
              </p>
            </div>

            {/* Ratio 3: CD Ratio */}
            <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  सी.डी. गुणोत्तर (CD Ratio)
                </span>
                <Percent size={12} className="text-emerald-600" />
              </div>
              <div className="text-sm sm:text-base font-black text-emerald-800 mt-0.5 font-mono">
                {cdRatio}%
              </div>
              <p className="text-[9.5px] text-slate-500 mt-0.5">
                कर्ज-ठेव तरलता प्रमाण
              </p>
            </div>

            {/* Ratio 4: Active Accounts & Members */}
            <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                एकूण सभासद व खाती
              </span>
              <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5 font-mono">
                {data?.members?.totalMembers || 0} <span className="text-xs font-normal text-slate-500">सभासद</span>
              </div>
              <p className="text-[9.5px] text-emerald-700 font-semibold mt-0.5 font-mono">
                {totalActiveAccounts} सक्रिय खाती कार्यान्वित
              </p>
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. 7 3D GLASS ORB ACTION BUTTONS (मुख्य जलद व्यवहार विभाग)                 */}
        {/* ========================================================================= */}
        <div className="relative rounded-2xl p-3 sm:p-4 backdrop-blur-xl bg-white/85 border border-white/80 shadow-xs overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-teal-500/70 before:to-transparent">
          
          {/* Header Badge */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 mb-2">
            <span className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-wider inline-flex items-center gap-1.5">
              <Sparkles size={14} className="text-emerald-600" />
              <span>मुख्य जलद व्यवहार विभाग (Quick Core Modules)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              जलद खाते नोंदणी व दैनिक व्यवहार मॉड्यूल
            </span>
          </div>

          {/* 7 3D Glass Orbs */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3 sm:gap-4 justify-items-center pt-1.5 max-w-5xl mx-auto">
            {primaryActionButtons.map((btn) => {
              const IconComponent = btn.icon;
              return (
                <div
                  key={btn.id}
                  onClick={() => handleNav(btn.tab, btn.params)}
                  className="flex flex-col items-center cursor-pointer group select-none w-full max-w-[95px] p-1.5 rounded-xl hover:bg-slate-100/50 transition-all"
                >
                  {/* Compact 3D Glass Sphere Frame */}
                  <div 
                    className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full p-1 flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-active:scale-95 shadow-xs"
                    style={{
                      boxShadow: `0 6px 16px -2px ${btn.glowColor}, inset 0 1px 1px rgba(255,255,255,0.8)`
                    }}
                  >
                    {/* Outer Glass Rim */}
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${btn.accentColor} opacity-90 p-[2px]`}>
                      <div className="w-full h-full rounded-full bg-slate-900/10 backdrop-blur-xs"></div>
                    </div>

                    {/* Top Specular Light Highlight */}
                    <div className="absolute top-0.5 left-1.5 right-1.5 h-1/2 rounded-t-full bg-gradient-to-b from-white/70 via-white/20 to-transparent pointer-events-none"></div>

                    {/* Inner Frosted Center */}
                    <div className="relative z-10 w-full h-full rounded-full bg-white/25 backdrop-blur-xs border border-white/60 flex items-center justify-center shadow-inner group-hover:bg-white/35 transition-colors">
                      {btn.image ? (
                        <img
                          src={btn.image}
                          alt={btn.titleMr}
                          className="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow-xs group-hover:scale-110 transition-transform duration-200"
                        />
                      ) : (
                        <div className="text-white drop-shadow-xs flex items-center justify-center">
                          <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2] group-hover:scale-110 transition-transform duration-200" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="mt-1.5 text-center px-0.5 w-full">
                    <span className="block text-[11px] sm:text-xs font-black text-slate-800 group-hover:text-emerald-700 tracking-tight leading-tight transition-colors truncate">
                      {btn.titleMr}
                    </span>
                    <span className="block text-[8px] sm:text-[8.5px] font-bold text-slate-400 font-mono uppercase tracking-wider truncate mt-0.5">
                      {btn.titleEn}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* ========================================================================= */}
        {/* 5. QUICK OPERATIONS & TELLER SHORTCUTS (द्रुत सेवा व संचालन)                */}
        {/* ========================================================================= */}
        <div className="relative rounded-2xl p-3 sm:p-4 backdrop-blur-xl bg-white/85 border border-white/80 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 mb-2.5">
            <span className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-wider inline-flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" />
              <span>द्रुत कामकाज व दैनंदिन संचालन (Daily Operations & Shortcuts)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              नेहमी लागणाऱ्या सेवा एका क्लिकवर उपलब्ध
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {quickOperations.map((op) => {
              const Icon = op.icon;
              return (
                <div
                  key={op.id}
                  onClick={() => handleNav(op.tab)}
                  className={`p-2.5 rounded-xl ${op.bgColor} border ${op.borderColor} hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 cursor-pointer flex items-center justify-between group`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center ${op.color} shadow-2xs shrink-0 group-hover:scale-105 transition-transform`}>
                      <Icon size={16} />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                          {op.title}
                        </span>
                        <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded ${op.tagColor} shrink-0`}>
                          {op.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {op.subtitle}
                      </p>
                    </div>
                  </div>

                  <ChevronRight size={14} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. BOTTOM SYSTEM STATUS RIBBON (सिस्टिम सुरक्षा व आकडेवारी)                  */}
        {/* ========================================================================= */}
        <div className="pt-0.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-white/80 text-[10px] sm:text-[11px] font-semibold text-slate-600 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <ShieldCheck size={13} className="text-emerald-600" />
                CBS कोर सुरक्षित (100% Core Banking Validated)
              </span>
              <span className="text-slate-300">|</span>
              <span>एकूण सभासद: <b className="font-mono text-slate-800">{data?.members?.totalMembers || 0}</b></span>
              <span className="text-slate-300">|</span>
              <span>व्हाऊचर्स: <b className="font-mono text-slate-800">{data?.accounting?.totalVouchers || 0}</b></span>
              <span className="text-slate-300">|</span>
              <span>खतावण्या: <b className="font-mono text-slate-800">{data?.accounting?.totalLedgers || 0}</b></span>
            </div>

            <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                FY: {user?.financialYearCode || '2026-2027'}
              </span>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                {user?.branchName || 'मुख्य शाखा'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
