import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getCachedMasterData, invalidateApiCache } from '../utils/apiCache';
import { getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';
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
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (!isHOUser && lockedBranchId) {
      return lockedBranchId.toString();
    }
    return sessionStorage.getItem('globalBranchId') || localStorage.getItem('globalBranchId') || (user?.branchID ? user.branchID.toString() : 'all');
  });

  const [data, setData] = useState<any>(() => {
    try {
      const initialBranch = (!isHOUser && lockedBranchId)
        ? lockedBranchId.toString()
        : (sessionStorage.getItem('globalBranchId') || localStorage.getItem('globalBranchId') || (user?.branchID ? user.branchID.toString() : 'all'));
      const summaryUrl = initialBranch !== 'all' ? `/api/Dashboard?branchId=${initialBranch}` : '/api/Dashboard';
      const memHit = getCachedMasterData<any>(summaryUrl);
      if (memHit) return memHit;
      const cached = localStorage.getItem(`cbs_dashboard_cache_${initialBranch}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [sansthaName, setSansthaName] = useState(() => {
    const cachedSanstha = getCachedMasterData<any[]>('/api/SansthaDetails');
    if (Array.isArray(cachedSanstha) && cachedSanstha[0]?.sansthaName) {
      return cachedSanstha[0].sansthaName;
    }
    return localStorage.getItem('cbs_sanstha_name') || "तुमची संस्था";
  });
  const [sansthaInfo, setSansthaInfo] = useState<any>(() => {
    const cachedSanstha = getCachedMasterData<any[]>('/api/SansthaDetails');
    if (Array.isArray(cachedSanstha) && cachedSanstha[0]) {
      return cachedSanstha[0];
    }
    try {
      const cached = localStorage.getItem('cbs_sanstha_info');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    const initialBranch = (user && user.role !== 'Admin' && user.branchID) 
      ? user.branchID.toString() 
      : (localStorage.getItem('globalBranchId') || (user?.branchID ? user.branchID.toString() : 'all'));
    return !localStorage.getItem(`cbs_dashboard_cache_${initialBranch}`);
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [branches, setBranches] = useState<any[]>(() => {
    const memBranches = getCachedMasterData<any[]>('/api/Branches');
    if (Array.isArray(memBranches) && memBranches.length > 0) return memBranches;
    try {
      const cached = localStorage.getItem('cbs_branches_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!isHOUser && lockedBranchId) {
      setSelectedBranchId(lockedBranchId.toString());
    }
  }, [isHOUser, lockedBranchId]);

  useEffect(() => {
    const effective = !isHOUser && lockedBranchId ? lockedBranchId.toString() : selectedBranchId;
    if (effective !== selectedBranchId) {
      setSelectedBranchId(effective);
      return;
    }
    sessionStorage.setItem('globalBranchId', effective);
    localStorage.setItem('globalBranchId', effective);
    try {
      const cached = localStorage.getItem(`cbs_dashboard_cache_${effective}`);
      if (cached) {
        setData(JSON.parse(cached));
      }
    } catch (e) {
      // ignore
    }
  }, [selectedBranchId, isHOUser, lockedBranchId]);

  const loadData = async (forceRefresh = false) => {
    if (!data) setLoading(true);
    else setIsRefreshing(true);

    try {
      const branchParam = selectedBranchId !== 'all' ? `branchId=${selectedBranchId}` : '';
      const refreshParam = forceRefresh ? 'refresh=true' : '';
      const queryParams = [branchParam, refreshParam].filter(Boolean).join('&');
      const summaryUrl = `/api/Dashboard${queryParams ? `?${queryParams}` : ''}`;

      if (forceRefresh) {
        invalidateApiCache('/api/dashboard');
      }

      const [sansthaRes, branchesRes, summaryRes] = await Promise.all([
        axios.get('/api/SansthaDetails').catch(() => null),
        axios.get('/api/Branches').catch(() => null),
        axios.get(summaryUrl).catch(() => null)
      ]);

      if (sansthaRes && sansthaRes.data) {
        const s = sansthaRes.data;
        if (s && s.length > 0) {
          setSansthaName(s[0].sansthaName || "तुमची संस्था");
          setSansthaInfo(s[0]);
          localStorage.setItem('cbs_sanstha_name', s[0].sansthaName || "तुमची संस्था");
          localStorage.setItem('cbs_sanstha_info', JSON.stringify(s[0]));
        }
      }
      if (branchesRes && branchesRes.data) {
        const b = branchesRes.data;
        setBranches(b || []);
        localStorage.setItem('cbs_branches_cache', JSON.stringify(b || []));
      }

      if (summaryRes && summaryRes.data) {
        const summaryData = summaryRes.data;
        setData(summaryData);
        localStorage.setItem(`cbs_dashboard_cache_${selectedBranchId}`, JSON.stringify(summaryData));
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
      icon: Wallet,
      tab: 'saving',
      params: {},
      cardClass: 'bg-gradient-to-b from-emerald-50/90 to-white border-emerald-200/90 hover:border-emerald-400',
      iconBoxClass: 'bg-emerald-500 text-white shadow-sm group-hover:scale-105',
      titleHoverClass: 'group-hover:text-emerald-700',
    },
    {
      id: 'pigmy',
      titleMr: 'पिग्मी ठेव',
      titleEn: 'PIGMY',
      icon: PiggyBank,
      tab: 'pigmy',
      params: {},
      cardClass: 'bg-gradient-to-b from-teal-50/90 to-white border-teal-200/90 hover:border-teal-400',
      iconBoxClass: 'bg-teal-500 text-white shadow-sm group-hover:scale-105',
      titleHoverClass: 'group-hover:text-teal-700',
    },
    {
      id: 'rd',
      titleMr: 'आवर्ती ठेव',
      titleEn: 'RECURRING',
      icon: Coins,
      tab: 'rd',
      params: {},
      cardClass: 'bg-gradient-to-b from-amber-50/90 to-white border-amber-200/90 hover:border-amber-400',
      iconBoxClass: 'bg-amber-500 text-white shadow-sm group-hover:scale-105',
      titleHoverClass: 'group-hover:text-amber-700',
    },
    {
      id: 'fd',
      titleMr: 'मुदत ठेव',
      titleEn: 'FIXED DEPOSIT',
      icon: Landmark,
      tab: 'fd',
      params: {},
      cardClass: 'bg-gradient-to-b from-sky-50/90 to-white border-sky-200/90 hover:border-sky-400',
      iconBoxClass: 'bg-sky-500 text-white shadow-sm group-hover:scale-105',
      titleHoverClass: 'group-hover:text-sky-700',
    },
    {
      id: 'loan-disb',
      titleMr: 'कर्ज व्यवहार',
      titleEn: 'LOANS',
      icon: Scale,
      tab: 'loan',
      params: {},
      cardClass: 'bg-gradient-to-b from-violet-50/90 to-white border-violet-200/90 hover:border-violet-400',
      iconBoxClass: 'bg-violet-500 text-white shadow-sm group-hover:scale-105',
      titleHoverClass: 'group-hover:text-violet-700',
    },
    {
      id: 'vouchers',
      titleMr: 'व्हाऊचर',
      titleEn: 'VOUCHERS',
      icon: Receipt,
      tab: 'vouchers',
      params: {},
      cardClass: 'bg-gradient-to-b from-rose-50/90 to-white border-rose-200/90 hover:border-rose-400',
      iconBoxClass: 'bg-rose-500 text-white shadow-sm group-hover:scale-105',
      titleHoverClass: 'group-hover:text-rose-700',
    },
    {
      id: 'reports',
      titleMr: 'अहवाल',
      titleEn: 'REPORTS',
      icon: BarChart3,
      tab: 'reports',
      params: {},
      cardClass: 'bg-gradient-to-b from-blue-50/90 to-white border-blue-200/90 hover:border-blue-400',
      iconBoxClass: 'bg-blue-500 text-white shadow-sm group-hover:scale-105',
      titleHoverClass: 'group-hover:text-blue-700',
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
      cardBg: 'bg-blue-50/50 hover:bg-blue-50/80 border-blue-200/80 hover:border-blue-300',
      iconBg: 'bg-white border-blue-200/80',
      tagColor: 'bg-blue-100/80 text-blue-700 border border-blue-200/70'
    },
    {
      id: 'day-end',
      title: 'दिवसअखेर प्रक्रिया (EOD)',
      subtitle: 'कॅश पडताळणी, दिवस समाप्ती व ईओडी स्टेटस',
      tag: 'दिवसअखेर',
      icon: Moon,
      tab: 'day-end',
      color: 'text-violet-600',
      cardBg: 'bg-violet-50/50 hover:bg-violet-50/80 border-violet-200/80 hover:border-violet-300',
      iconBg: 'bg-white border-violet-200/80',
      tagColor: 'bg-violet-100/80 text-violet-700 border border-violet-200/70'
    },
    {
      id: 'cashier-dashboard',
      title: 'कॅशियर रोख काऊंटर',
      subtitle: 'दैनिक रोख जमा, नावे, कॅश शिल्लक व हिशोब',
      tag: 'रोख व्यवहार',
      icon: Wallet,
      tab: 'cashier-dashboard',
      color: 'text-emerald-600',
      cardBg: 'bg-emerald-50/50 hover:bg-emerald-50/80 border-emerald-200/80 hover:border-emerald-300',
      iconBg: 'bg-white border-emerald-200/80',
      tagColor: 'bg-emerald-100/80 text-emerald-700 border border-emerald-200/70'
    },
    {
      id: 'member-360',
      title: 'खातेदार ३६०° प्रोफाइल',
      subtitle: 'खातेदाराची सर्व खाती, ठेवी, कर्ज व शेअर्स एकाच ठिकाणी',
      tag: 'CIF ३६०°',
      icon: Users,
      tab: 'member-360',
      color: 'text-teal-600',
      cardBg: 'bg-teal-50/50 hover:bg-teal-50/80 border-teal-200/80 hover:border-teal-300',
      iconBg: 'bg-white border-teal-200/80',
      tagColor: 'bg-teal-100/80 text-teal-700 border border-teal-200/70'
    },
    {
      id: 'npa-dashboard',
      title: 'एन.पी.ए. व वसुली कक्ष',
      subtitle: 'थकबाकी वर्गीकरण, नोटीस ट्रॅकिंग व कायदेशीर वसुली',
      tag: 'कर्ज वसुली',
      icon: AlertTriangle,
      tab: 'npa-dashboard',
      color: 'text-amber-600',
      cardBg: 'bg-amber-50/50 hover:bg-amber-50/80 border-amber-200/80 hover:border-amber-300',
      iconBg: 'bg-white border-amber-200/80',
      tagColor: 'bg-amber-100/80 text-amber-700 border border-amber-200/70'
    },
    {
      id: 'voucher',
      title: 'नवीन व्हाऊचर नोंद',
      subtitle: 'कॅश, बँक व जर्नल व्हाउचर त्वरित नोंदणी',
      tag: 'लेखा नोंदणी',
      icon: Receipt,
      tab: 'voucher',
      color: 'text-sky-600',
      cardBg: 'bg-sky-50/50 hover:bg-sky-50/80 border-sky-200/80 hover:border-sky-300',
      iconBg: 'bg-white border-sky-200/80',
      tagColor: 'bg-sky-100/80 text-sky-700 border border-sky-200/70'
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
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          <p className="text-xs font-semibold text-slate-600">सीबीएस मुख्य डॅशबोर्ड लोड होत आहे...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-50/70 font-sans relative pb-10 px-3 sm:px-5 select-none">
      <div className="max-w-7xl mx-auto w-full space-y-3.5 pt-2.5">
        
        {/* ========================================================================= */}
        {/* 1. TOP SECTION: SANSTHA HEADER BAR                                        */}
        {/* ========================================================================= */}
        <div className="rounded-xl p-3.5 sm:p-4 bg-gradient-to-r from-primary/5 via-white to-primary/5 border border-slate-200 border-t-[3px] border-t-primary shadow-sm">
          
          {/* Top Info Row (Reg No, Date & System Status) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2 text-[10px] sm:text-[11px] font-medium">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">रजिस्टर नं.:</span>
              <span className="font-mono bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold">
                {sansthaInfo?.registrationNo || '-'}
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-semibold">नोंदणी दिनांक:</span>
              <span className="font-mono bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold">
                {formatRegDate(sansthaInfo?.registrationDate)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>CBS लाइव्ह सिस्टिम</span>
              </span>
              
              <button
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                title="डॅशबोर्ड डेटा रिफ्रेश करा"
              >
                <RefreshCw size={13} className={isRefreshing ? "animate-spin text-primary" : ""} />
              </button>
            </div>
          </div>

          {/* Central Institution Title & Branch Selector */}
          <div className="pt-2.5 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/25 shadow-sm hidden sm:flex items-center justify-center shrink-0">
                <Landmark size={22} className="text-primary" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-800 tracking-tight leading-snug">
                  {sansthaName}
                </h1>
                <p className="text-[11px] sm:text-[12px] font-semibold text-primary tracking-wide flex items-center justify-center md:justify-start gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span>
                    {selectedBranchId === 'all'
                      ? 'सर्व शाखा एकत्रित (Consolidated)'
                      : (branches.find((b: any) => b.branchID?.toString() === selectedBranchId)?.branchName || user?.branchName || 'मुख्य शाखा')}
                    {' '}&bull; को-ऑप सीबीएस कोर बँकिंग प्रणाली
                  </span>
                </p>
              </div>
            </div>

            {/* Branch Selector Pill */}
            {isHOUser ? (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                <Building2 size={14} className="text-primary shrink-0" />
                <span className="text-[11px] font-semibold text-slate-600 shrink-0">शाखा:</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-transparent text-slate-800 text-xs font-bold py-0.5 pr-2 outline-none cursor-pointer border-none focus:ring-0 font-sans"
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
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                <Building2 size={13} className="text-primary shrink-0" />
                <span>शाखा: {user?.branchName || 'मुख्य शाखा'} (लॉक)</span>
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
              className="rounded-xl p-3.5 bg-gradient-to-b from-emerald-50/70 to-white border border-emerald-200/80 border-t-[3px] border-t-emerald-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide truncate">
                  एकूण बचत ठेवी
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Wallet size={15} />
                </div>
              </div>

              <div className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-1.5 truncate font-mono tracking-tight">
                {fmt(data?.saving?.totalBalance || 0)}
              </div>

              <div className="text-[11px] text-slate-600 font-medium mt-2.5 flex items-center justify-between pt-2 border-t border-emerald-100">
                <span>सक्रिय खाती: <b className="font-mono text-slate-800">{data?.saving?.accountCount || 0}</b></span>
                <span className="text-[10px] bg-emerald-100/80 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold inline-flex items-center gap-0.5">
                  बचत ठेव <ArrowUpRight size={10} />
                </span>
              </div>
            </div>

            {/* 2. Loan Disbursed Card */}
            <div 
              onClick={() => handleNav('loan')}
              className="rounded-xl p-3.5 bg-gradient-to-b from-amber-50/70 to-white border border-amber-200/80 border-t-[3px] border-t-amber-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide truncate">
                  एकूण कर्ज वाटप
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Scale size={15} />
                </div>
              </div>

              <div className="text-lg sm:text-xl font-extrabold text-amber-700 mt-1.5 truncate font-mono tracking-tight">
                {fmt(data?.loan?.disbursedBalance || 0)}
              </div>

              <div className="text-[11px] text-slate-600 font-medium mt-2.5 flex items-center justify-between pt-2 border-t border-amber-100">
                <span>वाटप खाती: <b className="font-mono text-slate-800">{data?.loan?.accountCount || 0}</b></span>
                <span className="text-[10px] bg-amber-100/80 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-semibold inline-flex items-center gap-0.5">
                  कर्ज खाते <ArrowUpRight size={10} />
                </span>
              </div>
            </div>

            {/* 3. Fixed Deposit Card */}
            <div 
              onClick={() => handleNav('fd')}
              className="rounded-xl p-3.5 bg-gradient-to-b from-sky-50/70 to-white border border-sky-200/80 border-t-[3px] border-t-sky-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide truncate">
                  एकूण मुदत ठेवी
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Landmark size={15} />
                </div>
              </div>

              <div className="text-lg sm:text-xl font-extrabold text-sky-700 mt-1.5 truncate font-mono tracking-tight">
                {fmt(data?.fixedDeposit?.totalBalance || 0)}
              </div>

              <div className="text-[11px] text-slate-600 font-medium mt-2.5 flex items-center justify-between pt-2 border-t border-sky-100">
                <span>ठेवी खाती: <b className="font-mono text-slate-800">{data?.fixedDeposit?.accountCount || 0}</b></span>
                <span className="text-[10px] bg-sky-100/80 text-sky-700 px-2 py-0.5 rounded-full border border-sky-200 font-semibold inline-flex items-center gap-0.5">
                  मुदत ठेव <ArrowUpRight size={10} />
                </span>
              </div>
            </div>

            {/* 4. Share Capital Card */}
            <div 
              onClick={() => handleNav('shares')}
              className="rounded-xl p-3.5 bg-gradient-to-b from-violet-50/70 to-white border border-violet-200/80 border-t-[3px] border-t-violet-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide truncate">
                  एकूण भाग भांडवल
                </span>
                <div className="w-8 h-8 rounded-xl bg-violet-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Coins size={15} />
                </div>
              </div>

              <div className="text-lg sm:text-xl font-extrabold text-violet-700 mt-1.5 truncate font-mono tracking-tight">
                {fmt(data?.shares?.totalBalance || 0)}
              </div>

              <div className="text-[11px] text-slate-600 font-medium mt-2.5 flex items-center justify-between pt-2 border-t border-violet-100">
                <span>एकूण सभासद: <b className="font-mono text-slate-800">{data?.shares?.memberCount || data?.members?.totalMembers || 0}</b></span>
                <span className="text-[10px] bg-violet-100/80 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200 font-semibold inline-flex items-center gap-0.5">
                  शेअर्स <ArrowUpRight size={10} />
                </span>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. CO-OP CBS EXECUTIVE RATIOS & CAPITAL SUMMARY (संस्था आर्थिक गुणोत्तर)     */}
        {/* ========================================================================= */}
        <div className="rounded-xl p-3.5 sm:p-4 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Activity size={15} />
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-slate-800">
                संस्था आर्थिक स्थिती व तरलता गुणोत्तर (Co-Op Financial Health & Metrics)
              </h2>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono hidden sm:inline">
              LIVE CO-OP CBS RATIOS
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            
            {/* Ratio 1: Total Deposits */}
            <div className="p-3 rounded-lg bg-emerald-50/45 border border-emerald-200/70 border-l-4 border-l-emerald-500">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">
                एकूण संकलित ठेवी (Total Deposits)
              </span>
              <div className="text-sm sm:text-base font-extrabold text-emerald-700 mt-1 font-mono">
                {fmt(totalDeposits)}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                बचत + मुदत + पिग्मी + आवर्ती
              </p>
            </div>

            {/* Ratio 2: Total Advances */}
            <div className="p-3 rounded-lg bg-amber-50/45 border border-amber-200/70 border-l-4 border-l-amber-500">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">
                एकूण कर्ज बाकी (Total Advances)
              </span>
              <div className="text-sm sm:text-base font-extrabold text-amber-700 mt-1 font-mono">
                {fmt(totalAdvances)}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                संस्थेचे एकूण वाटप येणे मुद्दल
              </p>
            </div>

            {/* Ratio 3: CD Ratio */}
            <div className="p-3 rounded-lg bg-sky-50/45 border border-sky-200/70 border-l-4 border-l-sky-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                  सी.डी. गुणोत्तर (CD Ratio)
                </span>
                <Percent size={12} className="text-sky-600" />
              </div>
              <div className="text-sm sm:text-base font-extrabold text-sky-700 mt-1 font-mono">
                {cdRatio}%
              </div>
              <div className="w-full h-1.5 bg-sky-100 rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, parseFloat(cdRatio) || 0))}%` }}
                />
              </div>
            </div>

            {/* Ratio 4: Active Accounts & Members */}
            <div className="p-3 rounded-lg bg-violet-50/45 border border-violet-200/70 border-l-4 border-l-violet-500">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">
                एकूण सभासद व खाती
              </span>
              <div className="text-sm sm:text-base font-extrabold text-violet-700 mt-1 font-mono">
                {data?.members?.totalMembers || 0} <span className="text-xs font-semibold text-slate-500">सभासद</span>
              </div>
              <p className="text-[10px] text-violet-600 font-semibold mt-0.5 font-mono">
                {totalActiveAccounts} सक्रिय खाती कार्यान्वित
              </p>
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. QUICK CORE MODULES (मुख्य जलद व्यवहार विभाग)                            */}
        {/* ========================================================================= */}
        <div className="rounded-xl p-3.5 sm:p-4 bg-white border border-slate-200 shadow-sm">
          
          {/* Header Badge */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
            <span className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-wide inline-flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles size={14} />
              </span>
              <span>मुख्य जलद व्यवहार विभाग (Quick Core Modules)</span>
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium hidden sm:inline">
              जलद खाते नोंदणी व दैनिक व्यवहार मॉड्यूल
            </span>
          </div>

          {/* 7 Bright Light-Tinted Module Tiles */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2.5 sm:gap-3 justify-items-center max-w-5xl mx-auto">
            {primaryActionButtons.map((btn) => {
              const IconComponent = btn.icon;
              return (
                <button
                  type="button"
                  key={btn.id}
                  onClick={() => handleNav(btn.tab, btn.params)}
                  className={`flex flex-col items-center cursor-pointer group select-none w-full p-3 rounded-xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 ${btn.cardClass}`}
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform duration-150 ${btn.iconBoxClass}`}>
                    <IconComponent className="w-5 h-5 stroke-[2.2]" />
                  </div>

                  {/* Labels */}
                  <div className="mt-2 text-center w-full">
                    <span className={`block text-[11px] sm:text-xs font-bold text-slate-800 tracking-tight leading-tight transition-colors truncate ${btn.titleHoverClass}`}>
                      {btn.titleMr}
                    </span>
                    <span className="block text-[8.5px] font-semibold text-slate-500 font-mono uppercase tracking-wider truncate mt-0.5">
                      {btn.titleEn}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* ========================================================================= */}
        {/* 5. QUICK OPERATIONS & TELLER SHORTCUTS (द्रुत सेवा व संचालन)                */}
        {/* ========================================================================= */}
        <div className="rounded-xl p-3.5 sm:p-4 bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
            <span className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-wide inline-flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Calendar size={14} />
              </span>
              <span>द्रुत कामकाज व दैनंदिन संचालन (Daily Operations & Shortcuts)</span>
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium hidden sm:inline">
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
                  className={`p-3 rounded-xl border hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 cursor-pointer flex items-center justify-between group ${op.cardBg}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform ${op.iconBg} ${op.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-primary transition-colors truncate">
                          {op.title}
                        </span>
                        <span className={`text-[8.5px] font-semibold px-1.5 py-0.5 rounded ${op.tagColor} shrink-0`}>
                          {op.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 truncate mt-0.5">
                        {op.subtitle}
                      </p>
                    </div>
                  </div>

                  <ChevronRight size={14} className="text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. BOTTOM SYSTEM STATUS RIBBON (सिस्टिम सुरक्षा व आकडेवारी)                  */}
        {/* ========================================================================= */}
        <div className="pt-0.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[10px] sm:text-[11px] font-medium text-slate-600 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <ShieldCheck size={14} className="text-emerald-600" />
                CBS कोर सुरक्षित (100% Core Banking Validated)
              </span>
              <span className="text-slate-300">|</span>
              <span>एकूण सभासद: <b className="font-mono text-slate-800">{data?.members?.totalMembers || 0}</b></span>
              <span className="text-slate-300">|</span>
              <span>व्हाऊचर्स: <b className="font-mono text-slate-800">{data?.accounting?.totalVouchers || 0}</b></span>
              <span className="text-slate-300">|</span>
              <span>खतावण्या: <b className="font-mono text-slate-800">{data?.accounting?.totalLedgers || 0}</b></span>
            </div>

            <div className="flex items-center gap-2 text-slate-600 font-mono text-[10px]">
              <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                FY: {user?.financialYearCode || '2026-2027'}
              </span>
              <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-semibold">
                {user?.branchName || 'मुख्य शाखा'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
