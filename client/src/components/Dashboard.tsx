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
          'radial-gradient(circle at 18% 18%, #e4ecff 0%, rgba(228,236,255,0) 48%), radial-gradient(circle at 86% 14%, #bfdbfe 0%, rgba(191,219,254,0) 45%), radial-gradient(circle at 75% 78%, #67e8f9 0%, rgba(103,232,249,0) 44%), radial-gradient(circle at 14% 82%, #c4b5fd 0%, rgba(196,181,253,0) 46%), linear-gradient(135deg, #eef2ff 0%, #f8fbff 42%, #dbeafe 78%, #93c5fd 100%)',
      }}
    >
      {/* ========================================================================= */}
      {/* CRISP VECTOR AURORA WAVE & AMBIENT LIGHT CANVAS (Image Color Palette)     */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Luminous Glow Orbs */}
        <div
          className="absolute -top-24 -left-20 w-[420px] h-[420px] rounded-full opacity-45 blur-3xl"
          style={{ background: 'radial-gradient(circle, #a5b4fc 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-12 right-10 w-[460px] h-[460px] rounded-full opacity-45 blur-3xl"
          style={{ background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-16 left-1/3 w-[520px] h-[320px] rounded-full opacity-35 blur-3xl"
          style={{ background: 'radial-gradient(circle, #2dd4bf 0%, transparent 72%)' }}
        />

        {/* Subtle Architectural Dot Grid Texture */}
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: 'radial-gradient(#3b82f6 0.85px, transparent 0.85px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Flowing Multi-Color Aurora Ribbon Waves (Violet -> Cyan -> Emerald -> Royal Blue) */}
        <svg
          viewBox="0 0 1440 520"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full h-[64%] opacity-90"
        >
          <defs>
            <linearGradient id="auroraWave1" x1="0%" y1="50%" x2="100%" y2="30%">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.48" />
              <stop offset="32%" stopColor="#06B6D4" stopOpacity="0.42" />
              <stop offset="65%" stopColor="#10B981" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.52" />
            </linearGradient>
            <linearGradient id="auroraWave2" x1="0%" y1="60%" x2="100%" y2="40%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
              <stop offset="40%" stopColor="#22D3EE" stopOpacity="0.45" />
              <stop offset="75%" stopColor="#3B82F6" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.58" />
            </linearGradient>
            <linearGradient id="auroraWave3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#E0F2FE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.55" />
            </linearGradient>
          </defs>

          {/* Back Wave */}
          <path
            d="M0,260 C210,165 390,340 660,245 C920,155 1170,110 1440,195 L1440,520 L0,520 Z"
            fill="url(#auroraWave1)"
          />
          {/* Mid Luminous Wave */}
          <path
            d="M0,335 C260,235 480,385 780,280 C1050,185 1250,240 1440,150 L1440,520 L0,520 Z"
            fill="url(#auroraWave2)"
          />
          {/* Foreground Soft Silk Wave */}
          <path
            d="M0,400 C320,320 620,445 960,365 C1190,310 1330,335 1440,295 L1440,520 L0,520 Z"
            fill="url(#auroraWave3)"
          />
        </svg>
      </div>

      {/* ========================================================================= */}
      {/* TOP-RIGHT MINIMAL CONTROLS STRIP (Zero Clunky Header Card)                */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full px-4 sm:px-7 pt-3.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/75 backdrop-blur-md border border-white/90 shadow-xs text-[11px] font-bold text-[#1E3A8A]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>SMART BANKING CBS</span>
          <span className="text-blue-300">•</span>
          <span className="font-mono text-slate-600">FY {user?.financialYearCode || '2026-2027'}</span>
        </div>

        <div className="flex items-center gap-2">
          {isHOUser ? (
            <div className="flex items-center gap-1.5 bg-white/85 backdrop-blur-md px-3 py-1 rounded-full border border-white shadow-xs">
              <Building2 size={13} className="text-[#2563EB] shrink-0" />
              <select
                value={selectedBranchId}
                onChange={(e) => handleBranchSelect(e.target.value)}
                className="bg-transparent text-slate-800 text-[11.5px] font-bold py-0 pr-1 outline-none cursor-pointer border-none focus:ring-0"
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
            <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700 bg-white/85 backdrop-blur-md px-3 py-1 rounded-full border border-white shadow-xs">
              <Building2 size={13} className="text-[#2563EB] shrink-0" />
              <span>{user?.branchName || 'मुख्य शाखा'}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => loadHeaderMeta(true)}
            disabled={isRefreshing}
            className="w-7 h-7 rounded-full bg-white/85 backdrop-blur-md border border-white text-[#2563EB] hover:bg-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
            title="माहिती ताजी करा (Refresh)"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CENTER PRESTIGIOUS INSTITUTION HERO (Clean, Airy, Zero Stat Cards)        */}
      {/* ========================================================================= */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-8 sm:py-10">
        {/* Glowing Cooperative Bank Emblem */}
        <div className="relative mb-4">
          <div
            className="absolute inset-0 rounded-3xl blur-xl opacity-45 scale-110"
            style={{ background: 'linear-gradient(135deg, #2563EB 0%, #06B6D4 55%, #7C3AED 100%)' }}
          />
          <div
            className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[22px] flex items-center justify-center text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] border border-white/40"
            style={{
              background: 'linear-gradient(135deg, #1D8CF8 0%, #2563EB 52%, #6D28D9 100%)',
            }}
          >
            <Landmark className="w-8 h-8 sm:w-9 sm:h-9" strokeWidth={2} />
          </div>
        </div>

        {/* Subtle Tagline Pill */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/75 backdrop-blur-md border border-white/90 shadow-2xs text-[10.5px] font-bold tracking-wider uppercase text-[#1D4ED8] mb-2.5">
          <Sparkles className="w-3 h-3 text-[#06B6D4]" />
          <span>को-ऑपरेटिव्ह कोर बँकिंग प्रणाली</span>
        </div>

        {/* Prestigious Institution Title */}
        <h1 className="text-xl sm:text-3xl md:text-[34px] font-black text-[#0F2454] tracking-tight leading-snug max-w-4xl drop-shadow-[0_1px_12px_rgba(255,255,255,0.9)]">
          {sansthaName}
        </h1>

        {/* Clean Accent Divider */}
        <div
          className="w-28 h-1 rounded-full my-3 opacity-90"
          style={{
            background: 'linear-gradient(90deg, #7C3AED 0%, #06B6D4 50%, #2563EB 100%)',
          }}
        />

        {/* Branch & Registration Metadata Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-700">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 backdrop-blur-md border border-white/90 shadow-2xs text-[#1E3A8A]">
            <Building2 className="w-3.5 h-3.5 text-[#1D8CF8]" />
            <span>{activeBranchLabel}</span>
          </span>
          {sansthaInfo?.registrationNo && (
            <span className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-md border border-white/90 shadow-2xs font-mono text-[11px] text-slate-700">
              रजि. नं.: {sansthaInfo.registrationNo}
            </span>
          )}
          {sansthaInfo?.registrationDate && (
            <span className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-md border border-white/90 shadow-2xs font-mono text-[11px] text-slate-700">
              स्थापना दि.: {formatRegDate(sansthaInfo.registrationDate)}
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM FLOATING ICON DOCK (Glossy Vibrant Icons — Exact Reference Shades) */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full px-3 sm:px-6 pb-5 sm:pb-6">
        <div className="max-w-[1320px] mx-auto bg-white/92 backdrop-blur-xl rounded-[22px] border border-white shadow-[0_16px_45px_rgba(30,64,175,0.18)] px-2 py-3 sm:py-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-y-2 lg:gap-y-0 lg:divide-x divide-slate-200/75">
            {bottomDockIcons.map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.tab, item.params)}
                  title={`${item.titleMr} (${item.titleEn}) — ${item.subtitleMr}`}
                  className="group flex flex-col items-center justify-center text-center px-2 py-2 rounded-xl transition-all duration-200 cursor-pointer hover:-translate-y-1.5 hover:bg-slate-50/90 focus:outline-none"
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
                  <span className="mt-2.5 text-[12px] font-extrabold text-slate-800 group-hover:text-slate-950 leading-tight truncate max-w-full">
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
