import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getCachedMasterData, invalidateApiCache } from '../utils/apiCache';
import { getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';
import {
  Building2,
  Landmark,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  AnimatedSavingIcon,
  AnimatedDepositIcon,
  AnimatedLoanIcon,
  AnimatedTransferIcon,
  AnimatedCustomerIcon,
  AnimatedApprovalIcon,
  AnimatedAlertsIcon,
  AnimatedReportsIcon,
} from './common/AnimatedDashboardIcons';

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

interface DockIconItem {
  id: string;
  titleMr: string;
  titleEn: string;
  subtitleMr: string;
  icon: React.ComponentType<{ className?: string }>;
  tab: string;
  params?: any;
  gradient: string;
  shadowColor: string;
  accentHex: string;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (!isHOUser && lockedBranchId) {
      return lockedBranchId.toString();
    }
    return (
      sessionStorage.getItem('globalBranchId') ||
      localStorage.getItem('globalBranchId') ||
      (user?.branchID ? user.branchID.toString() : 'all')
    );
  });

  const [sansthaName, setSansthaName] = useState(() => {
    const cachedSanstha = getCachedMasterData<any[]>('/api/SansthaDetails');
    if (Array.isArray(cachedSanstha) && cachedSanstha[0]?.sansthaName) {
      return cachedSanstha[0].sansthaName;
    }
    return localStorage.getItem('cbs_sanstha_name') || 'तुमची संस्था';
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

  const [isRefreshing, setIsRefreshing] = useState(false);

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
  }, [selectedBranchId, isHOUser, lockedBranchId]);

  const loadHeaderMeta = async (forceRefresh = false) => {
    setIsRefreshing(true);
    try {
      if (forceRefresh) {
        invalidateApiCache('/api/sansthadetails');
        invalidateApiCache('/api/branches');
      }
      const [sansthaRes, branchesRes] = await Promise.all([
        axios.get('/api/SansthaDetails').catch(() => null),
        axios.get('/api/Branches').catch(() => null),
      ]);

      if (sansthaRes?.data && Array.isArray(sansthaRes.data) && sansthaRes.data.length > 0) {
        setSansthaName(sansthaRes.data[0].sansthaName || 'तुमची संस्था');
        setSansthaInfo(sansthaRes.data[0]);
        localStorage.setItem('cbs_sanstha_name', sansthaRes.data[0].sansthaName || 'तुमची संस्था');
        localStorage.setItem('cbs_sanstha_info', JSON.stringify(sansthaRes.data[0]));
      }
      if (branchesRes?.data && Array.isArray(branchesRes.data)) {
        setBranches(branchesRes.data);
        localStorage.setItem('cbs_branches_cache', JSON.stringify(branchesRes.data));
      }
    } catch (e) {
      console.error('Error loading dashboard header metadata', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadHeaderMeta();
  }, []);

  const handleBranchSelect = (val: string) => {
    setSelectedBranchId(val);
    sessionStorage.setItem('globalBranchId', val);
    localStorage.setItem('globalBranchId', val);
    window.dispatchEvent(new Event('globalBranchChange'));
  };

  const handleNav = (tab: string, params?: any) => {
    if (onNavigate) {
      onNavigate(tab, params);
    }
  };

  // Bottom Icon Dock — 8 Bespoke Animated Glossy Gradient Icons matching exact reference shades
  const bottomDockIcons: DockIconItem[] = [
    {
      id: 'accounts',
      titleMr: 'बचत खाते',
      titleEn: 'SAVINGS',
      subtitleMr: 'बचत खाते व दैनंदिन व्यवहार',
      icon: AnimatedSavingIcon,
      tab: 'saving',
      gradient: 'linear-gradient(135deg, #38BDF8 0%, #1D8CF8 55%, #1D4ED8 100%)',
      shadowColor: 'rgba(29, 140, 248, 0.42)',
      accentHex: '#1D74F5',
    },
    {
      id: 'deposits',
      titleMr: 'मुदत व ठेवी',
      titleEn: 'DEPOSITS',
      subtitleMr: 'मुदत, आवर्ती, पिग्मी',
      icon: AnimatedDepositIcon,
      tab: 'fd',
      gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 55%, #15803D 100%)',
      shadowColor: 'rgba(34, 197, 94, 0.38)',
      accentHex: '#16A34A',
    },
    {
      id: 'loans',
      titleMr: 'कर्ज व्यवहार',
      titleEn: 'LOANS',
      subtitleMr: 'कर्ज वाटप व वसुली',
      icon: AnimatedLoanIcon,
      tab: 'loan',
      gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.40)',
      accentHex: '#D97706',
    },
    {
      id: 'fund-transfer',
      titleMr: 'व्हाऊचर / व्यवहार',
      titleEn: 'TRANSFERS',
      subtitleMr: 'व्हाऊचर व हस्तांतरण',
      icon: AnimatedTransferIcon,
      tab: 'vouchers',
      gradient: 'linear-gradient(135deg, #C084FC 0%, #9333EA 55%, #6B21A8 100%)',
      shadowColor: 'rgba(147, 51, 234, 0.38)',
      accentHex: '#7E22CE',
    },
    {
      id: 'customers',
      titleMr: 'खातेदार',
      titleEn: 'CUSTOMERS',
      subtitleMr: 'खातेदार नोंदणी व व्यवस्थापन',
      icon: AnimatedCustomerIcon,
      tab: 'customers',
      gradient: 'linear-gradient(135deg, #60A5FA 0%, #2563EB 55%, #1E40AF 100%)',
      shadowColor: 'rgba(37, 99, 235, 0.40)',
      accentHex: '#2563EB',
    },
    {
      id: 'security',
      titleMr: 'पासिंग व मंजुरी',
      titleEn: 'APPROVALS',
      subtitleMr: 'व्हाउचर पासिंग सुरक्षा',
      icon: AnimatedApprovalIcon,
      tab: 'voucher-posting',
      gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 55%, #047857 100%)',
      shadowColor: 'rgba(16, 185, 129, 0.38)',
      accentHex: '#059669',
    },
    {
      id: 'alerts',
      titleMr: 'आजची कामे',
      titleEn: 'ALERTS',
      subtitleMr: 'देयके व दैनिक सूचना',
      icon: AnimatedAlertsIcon,
      tab: 'todays-tasks',
      gradient: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 55%, #5B21B6 100%)',
      shadowColor: 'rgba(124, 58, 237, 0.38)',
      accentHex: '#6D28D9',
    },
    {
      id: 'reports',
      titleMr: 'अहवाल केंद्र',
      titleEn: 'REPORTS',
      subtitleMr: 'स्मार्ट अहवाल विश्लेषण',
      icon: AnimatedReportsIcon,
      tab: 'reports',
      gradient: 'linear-gradient(135deg, #22D3EE 0%, #0891B2 55%, #0369A1 100%)',
      shadowColor: 'rgba(8, 145, 178, 0.38)',
      accentHex: '#0E7490',
    },
  ];

  const activeBranchLabel =
    selectedBranchId === 'all'
      ? 'सर्व शाखा एकत्रित (All Branches)'
      : branches.find((b: any) => b.branchID?.toString() === selectedBranchId)?.branchName ||
        user?.branchName ||
        'मुख्य शाखा';

  return (
    <div
      className="relative w-full min-h-[calc(100vh-54px)] flex flex-col justify-between overflow-hidden select-none font-sans"
      style={{
        background:
          'radial-gradient(circle at 16% 16%, rgba(251,214,205,0.62) 0%, rgba(251,214,205,0) 48%), radial-gradient(circle at 86% 14%, rgba(254,226,184,0.72) 0%, rgba(254,226,184,0) 46%), radial-gradient(circle at 76% 80%, rgba(253,213,155,0.58) 0%, rgba(253,213,155,0) 46%), radial-gradient(circle at 14% 82%, rgba(245,204,196,0.52) 0%, rgba(245,204,196,0) 48%), linear-gradient(135deg, #FDF2EE 0%, #FFFBF7 44%, #FEF3E2 80%, #FCE3BE 100%)',
      }}
    >
      {/* ========================================================================= */}
      {/* SOFT FAINT PASTEL MAROON-PEACH-GOLD AMBIENT LIGHT & SILK WAVE CANVAS     */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Luminous Pastel Warm Orbs */}
        <div
          className="absolute -top-24 -left-20 w-[440px] h-[440px] rounded-full opacity-35 blur-3xl"
          style={{ background: 'radial-gradient(circle, #E2A396 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-12 right-8 w-[460px] h-[460px] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #FCD396 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-14 left-1/3 w-[520px] h-[320px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #FDBA74 0%, transparent 72%)' }}
        />

        {/* Subtle Warm Copper Architectural Dot Grid Texture */}
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage: 'radial-gradient(#B45309 0.8px, transparent 0.8px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Soft Faint Flowing Silk Ribbon Waves (Rose-Maroon -> Apricot -> Cream Gold) */}
        <svg
          viewBox="0 0 1440 520"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full h-[60%] opacity-90"
        >
          <defs>
            <linearGradient id="maroonWave1" x1="0%" y1="50%" x2="100%" y2="30%">
              <stop offset="0%" stopColor="#A94438" stopOpacity="0.20" />
              <stop offset="38%" stopColor="#D97742" stopOpacity="0.18" />
              <stop offset="72%" stopColor="#F59E0B" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#EA8C2E" stopOpacity="0.24" />
            </linearGradient>
            <linearGradient id="maroonWave2" x1="0%" y1="60%" x2="100%" y2="40%">
              <stop offset="0%" stopColor="#B9584A" stopOpacity="0.14" />
              <stop offset="45%" stopColor="#F59E0B" stopOpacity="0.18" />
              <stop offset="80%" stopColor="#FBBF24" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="maroonWave3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
              <stop offset="50%" stopColor="#FFF7ED" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FDE6C4" stopOpacity="0.52" />
            </linearGradient>
          </defs>

          {/* Back Wave */}
          <path
            d="M0,260 C210,165 390,340 660,245 C920,155 1170,110 1440,195 L1440,520 L0,520 Z"
            fill="url(#maroonWave1)"
          />
          {/* Mid Luminous Soft Wave */}
          <path
            d="M0,335 C260,235 480,385 780,280 C1050,185 1250,240 1440,150 L1440,520 L0,520 Z"
            fill="url(#maroonWave2)"
          />
          {/* Foreground Soft Ivory Silk Wave */}
          <path
            d="M0,400 C320,320 620,445 960,365 C1190,310 1330,335 1440,295 L1440,520 L0,520 Z"
            fill="url(#maroonWave3)"
          />
        </svg>
      </div>

      {/* ========================================================================= */}
      {/* TOP MINIMAL FROSTED CONTROLS STRIP                                        */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full px-4 sm:px-7 pt-3.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 backdrop-blur-md border border-amber-200/80 shadow-xs text-[11px] font-bold text-[#6B2118]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>SMART BANKING CBS</span>
          <span className="text-amber-300">•</span>
          <span className="font-mono text-[#8C4A32]">FY {user?.financialYearCode || '2026-2027'}</span>
        </div>

        <div className="flex items-center gap-2">
          {isHOUser ? (
            <div className="flex items-center gap-1.5 bg-white/85 backdrop-blur-md px-3 py-1 rounded-full border border-amber-200/80 shadow-xs">
              <Building2 size={13} className="text-[#B45309] shrink-0" />
              <select
                value={selectedBranchId}
                onChange={(e) => handleBranchSelect(e.target.value)}
                className="bg-transparent text-[#4A1914] text-[11.5px] font-bold py-0 pr-1 outline-none cursor-pointer border-none focus:ring-0"
              >
                <option value="all" className="text-slate-900 bg-white">सर्व शाखा (All Branches)</option>
                {branches.map((b: any) => (
                  <option key={b.branchID} value={b.branchID.toString()} className="text-slate-900 bg-white">
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#4A1914] bg-white/85 backdrop-blur-md px-3 py-1 rounded-full border border-amber-200/80 shadow-xs">
              <Building2 size={13} className="text-[#B45309] shrink-0" />
              <span>{user?.branchName || 'मुख्य शाखा'}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => loadHeaderMeta(true)}
            disabled={isRefreshing}
            className="w-7 h-7 rounded-full bg-white/85 hover:bg-white backdrop-blur-md border border-amber-200/80 text-[#9A3412] flex items-center justify-center transition-all cursor-pointer shadow-xs"
            title="माहिती ताजी करा (Refresh)"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CENTER PRESTIGIOUS INSTITUTION HERO (Soft Airy Warm Maroon & Gold)        */}
      {/* ========================================================================= */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-8 sm:py-10">
        {/* Warm Maroon-Saffron Cooperative Bank Emblem */}
        <div className="relative mb-4">
          <div
            className="absolute inset-0 rounded-3xl blur-xl opacity-35 scale-110"
            style={{ background: 'linear-gradient(135deg, #8C2D19 0%, #D97706 60%, #F59E0B 100%)' }}
          />
          <div
            className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[22px] flex items-center justify-center text-white shadow-[0_12px_28px_rgba(124,36,24,0.28)] border border-white/50"
            style={{
              background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)',
            }}
          >
            <Landmark className="w-8 h-8 sm:w-9 sm:h-9 text-white" strokeWidth={2} />
          </div>
        </div>

        {/* Subtle Warm Tagline Pill */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/80 backdrop-blur-md border border-amber-200/80 shadow-2xs text-[10.5px] font-bold tracking-wider uppercase text-[#9A3412] mb-2.5">
          <Sparkles className="w-3 h-3 text-[#D97706]" />
          <span>सुरक्षित को-ऑपरेटिव्ह कोर बँकिंग प्रणाली</span>
        </div>

        {/* Prestigious Institution Title */}
        <h1 className="text-xl sm:text-3xl md:text-[34px] font-black text-[#5A1A14] tracking-tight leading-snug max-w-4xl drop-shadow-[0_1px_12px_rgba(255,255,255,0.9)]">
          {sansthaName}
        </h1>

        {/* Clean Warm Gold Accent Divider */}
        <div
          className="w-28 h-1 rounded-full my-3 opacity-85"
          style={{
            background: 'linear-gradient(90deg, #7C2418 0%, #D97706 55%, #F59E0B 100%)',
          }}
        />

        {/* Branch & Registration Metadata Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-[#5C3A2E]">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/82 backdrop-blur-md border border-amber-200/80 shadow-2xs text-[#6B2118]">
            <Building2 className="w-3.5 h-3.5 text-[#D97706]" />
            <span>{activeBranchLabel}</span>
          </span>
          {sansthaInfo?.registrationNo && (
            <span className="px-3 py-1 rounded-full bg-white/82 backdrop-blur-md border border-amber-200/80 shadow-2xs font-mono text-[11px] text-[#5C3A2E]">
              रजि. नं.: {sansthaInfo.registrationNo}
            </span>
          )}
          {sansthaInfo?.registrationDate && (
            <span className="px-3 py-1 rounded-full bg-white/82 backdrop-blur-md border border-amber-200/80 shadow-2xs font-mono text-[11px] text-[#5C3A2E]">
              स्थापना दि.: {formatRegDate(sansthaInfo.registrationDate)}
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM FLOATING WARM IVORY ICON DOCK                                      */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full px-3 sm:px-6 pb-5 sm:pb-6">
        <div className="max-w-[1320px] mx-auto bg-white/94 backdrop-blur-xl rounded-[24px] border border-amber-200/75 shadow-[0_16px_42px_rgba(124,36,24,0.12)] px-2 py-3 sm:py-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-y-2 lg:gap-y-0 lg:divide-x divide-amber-200/55">
            {bottomDockIcons.map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.tab, item.params)}
                  title={`${item.titleMr} (${item.titleEn}) — ${item.subtitleMr}`}
                  className="group flex flex-col items-center justify-center text-center px-2 py-2 rounded-xl transition-all duration-200 cursor-pointer hover:-translate-y-1.5 hover:bg-amber-50/75 focus:outline-none"
                >
                  {/* Glossy Gradient Squircle Icon */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110 overflow-hidden"
                    style={{
                      background: item.gradient,
                      boxShadow: `0 8px 18px -4px ${item.shadowColor}`,
                    }}
                  >
                    <IconComp className="w-9 h-9" />
                  </div>

                  {/* Crisp Marathi Module Label */}
                  <span className="mt-2.5 text-[12px] font-extrabold text-[#4A1914] group-hover:text-[#7C2418] leading-tight truncate max-w-full">
                    {item.titleMr}
                  </span>

                  {/* Subtle Color-Matched English Label */}
                  <span
                    className="mt-0.5 text-[9.5px] font-extrabold tracking-wider uppercase leading-tight"
                    style={{ color: item.accentHex }}
                  >
                    {item.titleEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
