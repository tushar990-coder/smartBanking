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
  Building
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

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [sansthaRes, branchesRes] = await Promise.all([
          fetch('/api/SansthaDetails'),
          fetch('/api/Branches')
        ]);
        
        if (!isMounted) return;

        if (sansthaRes.ok) {
          const s = await sansthaRes.json();
          if (isMounted && s.length > 0) {
            setSansthaName(s[0].sansthaName || "तुमची संस्था");
            setSansthaInfo(s[0]);
          }
        }
        if (branchesRes.ok) {
          const b = await branchesRes.json();
          if (isMounted) setBranches(b);
        }

        const branchParam = selectedBranchId !== 'all' ? `?branchId=${selectedBranchId}` : '';
        const summaryRes = await fetch(`/api/Dashboard${branchParam}`);
        if (!isMounted) return;

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          if (isMounted) setData(summaryData);
        }
      } catch (e) {
        if (isMounted) console.error('Error loading dashboard data', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
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
      titleEn: 'SAVINGS DEPOSIT',
      image: '/action-icons/savings-3d.png',
      icon: Wallet,
      tab: 'saving',
      params: {},
    },
    {
      id: 'pigmy',
      titleMr: 'पिग्मी ठेव',
      titleEn: 'PIGMY DEPOSIT',
      icon: PiggyBank,
      tab: 'pigmy',
      params: {},
    },
    {
      id: 'rd',
      titleMr: 'आवर्ती ठेव',
      titleEn: 'RECURRING DEPOSIT',
      icon: Coins,
      tab: 'rd',
      params: {},
    },
    {
      id: 'fd',
      titleMr: 'मुदत ठेव',
      titleEn: 'FIXED DEPOSIT',
      icon: Landmark,
      tab: 'fd',
      params: {},
    },
    {
      id: 'loan-disb',
      titleMr: 'कर्ज',
      titleEn: 'LOANS',
      image: '/action-icons/loan-disbursement.png',
      icon: Coins,
      tab: 'loan',
      params: {},
    },
    {
      id: 'vouchers',
      titleMr: 'व्हाऊचर',
      titleEn: 'VOUCHERS',
      image: '/action-icons/journal-voucher.png',
      icon: Receipt,
      tab: 'vouchers',
      params: {},
    },
    {
      id: 'reports',
      titleMr: 'रिपोर्ट',
      titleEn: 'REPORTS',
      image: '/action-icons/loan-reports.png',
      icon: BarChart3,
      tab: 'reports',
      params: {},
    }
  ];

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] bg-slate-50 p-6 space-y-3">
        <div className="w-10 h-10 rounded-full border-3 border-primary border-t-transparent animate-spin"></div>
        <p className="text-xs font-bold text-gray-600">डॅशबोर्ड माहिती लोड होत आहे...</p>
      </div>
    );
  }

  return (
    <div className="w-full font-sans relative bg-slate-50 min-h-full flex flex-col justify-between py-2 sm:py-4 px-2 sm:px-4 md:px-5 transition-colors duration-300">
      
      {/* Decorative Background Accent Glow matching Primary Theme */}
      <div className="absolute top-[-10%] left-[-10%] w-[20rem] sm:w-[35rem] h-[20rem] sm:h-[35rem] bg-primary/5 rounded-full blur-[90px] sm:blur-[110px] pointer-events-none"></div>

      <div className="max-w-5xl mx-auto w-full relative z-10 flex-1 flex flex-col justify-between space-y-3 sm:space-y-5">
        
        {/* ========================================================================= */}
        {/* TOP SECTION: SANSTHA HEADER & FINANCIAL OVERVIEW METRICS                  */}
        {/* ========================================================================= */}
        <div className="space-y-2.5 sm:space-y-4">
          
          {/* Classic Banking Header Bar */}
          <div className="bg-white border border-gray-200 border-b-2 border-primary rounded-xl sm:rounded-2xl shadow-xs px-3.5 py-2.5 sm:px-5 sm:py-3 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-gray-100 pb-2 text-[10px] sm:text-[11px] font-semibold text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-900 font-bold">रजिस्टर नं.:</span>
                <span className="font-mono bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold">
                  {sansthaInfo?.registrationNo || '-'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-900 font-bold">रजिस्टर दिनांक:</span>
                <span className="font-mono bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold">
                  {formatRegDate(sansthaInfo?.registrationDate)}
                </span>
              </div>
            </div>

            {/* Central Sanstha Title */}
            <div className="pt-2 text-center relative flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-3">
              <div className="hidden md:block w-24"></div>
              <div>
                <h1 className="text-sm sm:text-lg md:text-xl font-black text-gray-900 tracking-tight leading-snug">
                  {sansthaName}
                </h1>
                <p className="text-[11px] sm:text-xs font-bold text-primary tracking-wide mt-0.5">
                  मुख्य शाखा (Head Office)
                </p>
              </div>

              {/* Branch Selector */}
              {user?.role === 'Admin' ? (
                <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-slate-300">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">शाखा:</span>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="bg-white text-gray-900 text-[11px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded outline-none cursor-pointer border border-slate-300 shadow-2xs focus:ring-1 focus:ring-primary focus:border-primary"
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
                <div className="w-24"></div>
              )}
            </div>
          </div>

          {/* Quick Summary Cards (Live Financial Overview) */}
          {data && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5 pt-0.5">
              <div 
                onClick={() => handleNav('saving')}
                className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs border-t-4 border-t-primary hover:shadow-md transition-all cursor-pointer group"
              >
                <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">एकूण बचत ठेवी</span>
                <div className="text-sm sm:text-lg font-black text-gray-900 mt-0.5 truncate font-mono">{fmt(data?.saving?.totalBalance || 0)}</div>
                <div className="text-[10px] sm:text-[11px] text-primary font-semibold mt-1 flex items-center justify-between">
                  <span>खाती: {data?.saving?.accountCount || 0}</span>
                  <span className="text-[9px] sm:text-[10px] bg-primary/10 text-primary px-1.5 sm:px-2 py-0.5 rounded-full border border-primary/20 font-bold">बचत</span>
                </div>
              </div>

              <div 
                onClick={() => handleNav('loan')}
                className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs border-t-4 border-t-amber-600 hover:shadow-md transition-all cursor-pointer group"
              >
                <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">एकूण कर्ज वाटप</span>
                <div className="text-sm sm:text-lg font-black text-amber-800 mt-0.5 truncate font-mono">{fmt(data?.loan?.disbursedBalance || 0)}</div>
                <div className="text-[10px] sm:text-[11px] text-amber-700 font-semibold mt-1 flex items-center justify-between">
                  <span>खाती: {data?.loan?.accountCount || 0}</span>
                  <span className="text-[9px] sm:text-[10px] bg-amber-50 text-amber-800 px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-200 font-bold">कर्ज</span>
                </div>
              </div>

              <div 
                onClick={() => handleNav('fd')}
                className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs border-t-4 border-t-indigo-600 hover:shadow-md transition-all cursor-pointer group"
              >
                <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">एकूण मुदत ठेवी</span>
                <div className="text-sm sm:text-lg font-black text-gray-900 mt-0.5 truncate font-mono">{fmt(data?.fixedDeposit?.totalBalance || 0)}</div>
                <div className="text-[10px] sm:text-[11px] text-indigo-700 font-semibold mt-1 flex items-center justify-between">
                  <span>खाती: {data?.fixedDeposit?.accountCount || 0}</span>
                  <span className="text-[9px] sm:text-[10px] bg-indigo-50 text-indigo-800 px-1.5 sm:px-2 py-0.5 rounded-full border border-indigo-200 font-bold">मुदत</span>
                </div>
              </div>

              <div 
                onClick={() => handleNav('shares')}
                className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xs border-t-4 border-t-emerald-600 hover:shadow-md transition-all cursor-pointer group"
              >
                <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">एकूण भाग भांडवल</span>
                <div className="text-sm sm:text-lg font-black text-gray-900 mt-0.5 truncate font-mono">{fmt(data?.shares?.totalBalance || 0)}</div>
                <div className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-1 flex items-center justify-between">
                  <span>भागधारक: {data?.shares?.memberCount || 0}</span>
                  <span className="text-[9px] sm:text-[10px] bg-emerald-50 text-emerald-800 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-200 font-bold">शेअर्स</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 7 CIRCULAR GLOSSY 3D ACTION BUTTONS (मुख्य जलद व्यवहार विभाग)              */}
        {/* ========================================================================= */}
        <div className="mt-auto pt-3 sm:pt-5">
          <div className="bg-white/95 backdrop-blur-md border border-gray-200 border-t-2 border-primary rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-md space-y-3">
            
            <div className="text-center pb-1.5 border-b border-gray-100">
              <span className="text-[11px] sm:text-xs font-black text-gray-900 uppercase tracking-widest flex items-center justify-center gap-1.5">
                <Sparkles size={14} className="text-primary" /> मुख्य जलद व्यवहार विभाग (Quick Core Modules)
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3 lg:gap-4 justify-items-center pt-1 max-w-6xl mx-auto">
              {primaryActionButtons.map((btn) => {
                const IconComponent = btn.icon;
                return (
                  <div
                    key={btn.id}
                    onClick={() => handleNav(btn.tab, btn.params)}
                    className="flex flex-col items-center cursor-pointer group select-none w-full max-w-[90px] sm:max-w-[110px]"
                  >
                    {/* Circular Glossy 3D Button Frame */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-primary via-primary to-slate-900 border-[2.5px] sm:border-[3px] md:border-[3.5px] border-primary/40 group-hover:border-primary flex items-center justify-center relative overflow-hidden group-hover:scale-105 group-hover:shadow-xl transition-all duration-300 p-1 sm:p-1.5 shrink-0 shadow-md">
                      
                      {/* Top Gloss Reflection */}
                      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/50 via-white/10 to-transparent rounded-t-full pointer-events-none"></div>
                      
                      {/* Inner Badge Frame */}
                      <div className="w-full h-full rounded-full bg-white/15 backdrop-blur-2xs border border-white/40 flex items-center justify-center shadow-inner">
                        {btn.image ? (
                          <img
                            src={btn.image}
                            alt={btn.titleMr}
                            className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="text-white drop-shadow-md flex items-center justify-center">
                            <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 stroke-[2.2] group-hover:scale-110 transition-transform duration-300" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Label Text Below */}
                    <div className="mt-1.5 text-center px-0.5">
                      <span className="block text-[11px] sm:text-xs md:text-[13px] font-extrabold text-gray-900 group-hover:text-primary tracking-tight leading-tight transition-colors">
                        {btn.titleMr}
                      </span>
                      <span className="block text-[8px] sm:text-[9px] font-bold text-gray-400 font-mono uppercase tracking-wider mt-0.5 truncate max-w-[85px] sm:max-w-none">
                        {btn.titleEn}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
