import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Sparkles, Building2 } from 'lucide-react';
import {
  AnimatedLoanIcon,
  AnimatedLoanCollectionIcon,
  AnimatedGoldLoanIcon,
  AnimatedInterestIcon,
  AnimatedBulkChargesIcon,
  AnimatedApprovalIcon,
  AnimatedBorrowingIcon,
  AnimatedReportsIcon,
} from './common/AnimatedDashboardIcons';

interface LoanDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

interface LoanDockItem {
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

export default function LoanDashboard({ onNavigate }: LoanDashboardProps) {
  const { user } = useAuth();

  const handleNav = (tab: string, params?: any) => {
    if (onNavigate) {
      onNavigate(tab, params);
    }
  };

  // 8 Bespoke Animated Glossy Gradient Action Icons for Loan Department (कर्ज विभाग मुख्य हब)
  const loanActionButtons: LoanDockItem[] = [
    {
      id: 'loan-process',
      titleMr: 'कर्ज मागणी व वितरण',
      titleEn: 'DISBURSEMENT',
      subtitleMr: 'नवीन अर्ज, मंजुरी व वाटप',
      icon: AnimatedLoanIcon,
      tab: 'loan-process',
      params: { subTab: 1 },
      gradient: 'linear-gradient(135deg, #38BDF8 0%, #1D8CF8 55%, #1D4ED8 100%)',
      shadowColor: 'rgba(29, 140, 248, 0.40)',
      accentHex: '#1D74F5',
    },
    {
      id: 'loan-collection',
      titleMr: 'कर्ज हप्ता वसुली',
      titleEn: 'COLLECTION',
      subtitleMr: 'मुद्दल व व्याज वसुली',
      icon: AnimatedLoanCollectionIcon,
      tab: 'loan-collection',
      params: {},
      gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 55%, #15803D 100%)',
      shadowColor: 'rgba(34, 197, 94, 0.38)',
      accentHex: '#16A34A',
    },
    {
      id: 'gold-loan',
      titleMr: 'सोने तारण कर्ज',
      titleEn: 'GOLD LOAN',
      subtitleMr: 'दागिने मूल्यांकन व तारण',
      icon: AnimatedGoldLoanIcon,
      tab: 'gold-loan-details',
      params: {},
      gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.40)',
      accentHex: '#D97706',
    },
    {
      id: 'loan-interest',
      titleMr: 'कर्ज व्याज आकारणी',
      titleEn: 'INTEREST',
      subtitleMr: 'मासिक / त्रैमासिक व्याज',
      icon: AnimatedInterestIcon,
      tab: 'loan-interest-posting',
      params: {},
      gradient: 'linear-gradient(135deg, #C084FC 0%, #9333EA 55%, #6B21A8 100%)',
      shadowColor: 'rgba(147, 51, 234, 0.38)',
      accentHex: '#7E22CE',
    },
    {
      id: 'loan-bulk-charges',
      titleMr: 'वसुली खर्च नावे',
      titleEn: 'DUE CHARGES',
      subtitleMr: 'नोटीस व इतर खर्च नावे',
      icon: AnimatedBulkChargesIcon,
      tab: 'loan-bulk-charges',
      params: {},
      gradient: 'linear-gradient(135deg, #60A5FA 0%, #2563EB 55%, #1E40AF 100%)',
      shadowColor: 'rgba(37, 99, 235, 0.40)',
      accentHex: '#2563EB',
    },
    {
      id: 'loan-docs',
      titleMr: 'तारण व दागिने',
      titleEn: 'COLLATERAL',
      subtitleMr: 'दस्तऐवज व सुरक्षितता',
      icon: AnimatedApprovalIcon,
      tab: 'loan-documents',
      params: {},
      gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 55%, #047857 100%)',
      shadowColor: 'rgba(16, 185, 129, 0.38)',
      accentHex: '#059669',
    },
    {
      id: 'bank-borrowing',
      titleMr: 'बाह्य कर्जे / पुनर्गहाण',
      titleEn: 'BORROWINGS',
      subtitleMr: 'जिल्हा बँक व पुनर्गहाण',
      icon: AnimatedBorrowingIcon,
      tab: 'bank-borrowing',
      params: {},
      gradient: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 55%, #5B21B6 100%)',
      shadowColor: 'rgba(124, 58, 237, 0.38)',
      accentHex: '#6D28D9',
    },
    {
      id: 'loan-reports',
      titleMr: 'कर्ज अहवाल',
      titleEn: 'REPORTS',
      subtitleMr: 'खतावणी व थकबाकी अहवाल',
      icon: AnimatedReportsIcon,
      tab: 'loan-ledger-report',
      params: {},
      gradient: 'linear-gradient(135deg, #22D3EE 0%, #0891B2 55%, #0369A1 100%)',
      shadowColor: 'rgba(8, 145, 178, 0.38)',
      accentHex: '#0E7490',
    },
  ];

  return (
    <div
      className="relative w-full min-h-[calc(100vh-54px)] flex flex-col justify-between overflow-hidden select-none font-sans"
      style={{
        background:
          'radial-gradient(circle at 18% 18%, #e4ecff 0%, rgba(228,236,255,0) 48%), radial-gradient(circle at 86% 14%, #bfdbfe 0%, rgba(191,219,254,0) 45%), radial-gradient(circle at 75% 78%, #67e8f9 0%, rgba(103,232,249,0) 44%), radial-gradient(circle at 14% 82%, #c4b5fd 0%, rgba(196,181,253,0) 46%), linear-gradient(135deg, #eef2ff 0%, #f8fbff 42%, #dbeafe 78%, #93c5fd 100%)',
      }}
    >
      {/* ========================================================================= */}
      {/* CRISP VECTOR AURORA WAVE & AMBIENT LIGHT CANVAS (Matches Main Dashboard)  */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
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

        {/* Subtle Architectural Dot Grid */}
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: 'radial-gradient(#3b82f6 0.85px, transparent 0.85px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Flowing Multi-Color Aurora Ribbon Waves */}
        <svg
          viewBox="0 0 1440 520"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full h-[64%] opacity-90"
        >
          <defs>
            <linearGradient id="loanAurora1" x1="0%" y1="50%" x2="100%" y2="30%">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.48" />
              <stop offset="32%" stopColor="#06B6D4" stopOpacity="0.42" />
              <stop offset="65%" stopColor="#10B981" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.52" />
            </linearGradient>
            <linearGradient id="loanAurora2" x1="0%" y1="60%" x2="100%" y2="40%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
              <stop offset="40%" stopColor="#22D3EE" stopOpacity="0.45" />
              <stop offset="75%" stopColor="#3B82F6" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.58" />
            </linearGradient>
            <linearGradient id="loanAurora3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#E0F2FE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path
            d="M0,260 C210,165 390,340 660,245 C920,155 1170,110 1440,195 L1440,520 L0,520 Z"
            fill="url(#loanAurora1)"
          />
          <path
            d="M0,335 C260,235 480,385 780,280 C1050,185 1250,240 1440,150 L1440,520 L0,520 Z"
            fill="url(#loanAurora2)"
          />
          <path
            d="M0,400 C320,320 620,445 960,365 C1190,310 1330,335 1440,295 L1440,520 L0,520 Z"
            fill="url(#loanAurora3)"
          />
        </svg>
      </div>

      {/* ========================================================================= */}
      {/* TOP MINIMAL NAVIGATION BAR (Frosted Glass Pills)                          */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full px-4 sm:px-7 pt-3.5 flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => handleNav('dashboard')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/85 hover:bg-white backdrop-blur-md border border-white text-[#0F2454] text-[11.5px] font-bold shadow-xs transition-all cursor-pointer hover:-translate-x-0.5"
        >
          <ArrowLeft size={14} className="text-[#2563EB]" />
          <span>मुख्य डॅशबोर्डवर जा</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 backdrop-blur-md border border-white shadow-xs text-[11px] font-bold text-[#1E3A8A]">
            <Building2 size={12} className="text-[#1D8CF8]" />
            <span>{user?.branchName || 'मुख्य शाखा'}</span>
            <span className="text-blue-300">•</span>
            <span className="font-mono text-slate-600">FY {user?.financialYearCode || '2026-2027'}</span>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CENTER PRESTIGIOUS LOAN HUB HERO                                          */}
      {/* ========================================================================= */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-8 sm:py-10">
        {/* Glowing Animated Loan Hub Emblem */}
        <div className="relative mb-4">
          <div
            className="absolute inset-0 rounded-3xl blur-xl opacity-45 scale-110"
            style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #2563EB 55%, #7C3AED 100%)' }}
          />
          <div
            className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[22px] flex items-center justify-center text-white shadow-[0_12px_30px_rgba(37,99,235,0.34)] border border-white/40"
            style={{
              background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 52%, #D97706 100%)',
            }}
          >
            <AnimatedLoanIcon className="w-11 h-11" />
          </div>
        </div>

        {/* Subtle Module Pill */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/75 backdrop-blur-md border border-white/90 shadow-2xs text-[10.5px] font-bold tracking-wider uppercase text-[#1D4ED8] mb-2.5">
          <Sparkles className="w-3 h-3 text-[#F59E0B]" />
          <span>LOAN DEPARTMENT CORE HUB</span>
        </div>

        {/* Prestigious Title */}
        <h1 className="text-2xl sm:text-3xl md:text-[34px] font-black text-[#0F2454] tracking-tight leading-snug max-w-3xl drop-shadow-[0_1px_12px_rgba(255,255,255,0.9)]">
          कर्ज विभाग मुख्य हब
        </h1>

        {/* Clean Aurora Accent Underline */}
        <div
          className="w-28 h-1 rounded-full my-3 opacity-90"
          style={{
            background: 'linear-gradient(90deg, #F59E0B 0%, #06B6D4 50%, #2563EB 100%)',
          }}
        />

        {/* Subtitle Pill */}
        <p className="text-xs sm:text-[13px] font-semibold text-[#1E3A8A]/90 bg-white/75 backdrop-blur-md border border-white/90 px-4 py-1.5 rounded-full shadow-2xs">
          कर्ज मागणी व वितरण &bull; हप्ता वसुली &bull; सोने तारण &bull; व्याज आकारणी &bull; बाह्य कर्जे व अहवाल
        </p>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM FLOATING 8-ICON ANIMATED DOCK (Matches Main Dashboard Exactly)     */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full px-3 sm:px-6 pb-5 sm:pb-6">
        <div className="max-w-[1320px] mx-auto bg-white/92 backdrop-blur-xl rounded-[22px] border border-white shadow-[0_16px_45px_rgba(30,64,175,0.18)] px-2 py-3 sm:py-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-y-2 lg:gap-y-0 lg:divide-x divide-slate-200/75">
            {loanActionButtons.map((btn) => {
              const IconComp = btn.icon;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleNav(btn.tab, btn.params)}
                  title={`${btn.titleMr} (${btn.titleEn}) — ${btn.subtitleMr}`}
                  className="group flex flex-col items-center justify-center text-center px-2 py-2 rounded-xl transition-all duration-200 cursor-pointer hover:-translate-y-1.5 hover:bg-slate-50/90 focus:outline-none"
                >
                  {/* Glossy Gradient Squircle with Animated Icon */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110 overflow-hidden"
                    style={{
                      background: btn.gradient,
                      boxShadow: `0 8px 18px -4px ${btn.shadowColor}`,
                    }}
                  >
                    <IconComp className="w-9 h-9" />
                  </div>

                  {/* Marathi Label */}
                  <span className="mt-2.5 text-[11.5px] font-extrabold text-slate-800 group-hover:text-slate-950 leading-tight truncate max-w-full">
                    {btn.titleMr}
                  </span>

                  {/* Accent English Tag */}
                  <span
                    className="mt-0.5 text-[9.5px] font-extrabold tracking-wider uppercase leading-tight"
                    style={{ color: btn.accentHex }}
                  >
                    {btn.titleEn}
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
