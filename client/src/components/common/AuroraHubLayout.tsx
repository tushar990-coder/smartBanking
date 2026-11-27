import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Sparkles, Building2 } from 'lucide-react';

export interface AuroraHubActionItem {
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

interface AuroraHubLayoutProps {
  badgeLabel: string;
  titleMr: string;
  subtitleMr: string;
  heroIcon: React.ComponentType<{ className?: string }>;
  heroEmblemGradient: string;
  heroGlowGradient: string;
  underlineGradient: string;
  accentSparkleColor?: string;
  items: AuroraHubActionItem[];
  onNavigate?: (tab: string, params?: any) => void;
}

const getDockLayoutClasses = (count: number) => {
  switch (count) {
    case 4:
      return { maxW: 'max-w-[820px]', grid: 'grid-cols-2 sm:grid-cols-4' };
    case 5:
      return { maxW: 'max-w-[980px]', grid: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' };
    case 6:
      return { maxW: 'max-w-[1120px]', grid: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' };
    case 7:
      return { maxW: 'max-w-[1240px]', grid: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7' };
    default:
      return { maxW: 'max-w-[1320px]', grid: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8' };
  }
};

export default function AuroraHubLayout({
  badgeLabel,
  titleMr,
  subtitleMr,
  heroIcon: HeroIcon,
  heroEmblemGradient,
  heroGlowGradient,
  underlineGradient,
  accentSparkleColor = '#06B6D4',
  items,
  onNavigate,
}: AuroraHubLayoutProps) {
  const { user } = useAuth();
  const dockLayout = getDockLayoutClasses(items.length);

  const handleNav = (tab: string, params?: any) => {
    if (onNavigate) {
      onNavigate(tab, params);
    }
  };

  return (
    <div
      className="relative w-full min-h-[calc(100vh-54px)] flex flex-col justify-between overflow-hidden select-none font-sans"
      style={{
        background:
          'radial-gradient(circle at 18% 18%, #e4ecff 0%, rgba(228,236,255,0) 48%), radial-gradient(circle at 86% 14%, #bfdbfe 0%, rgba(191,219,254,0) 45%), radial-gradient(circle at 75% 78%, #67e8f9 0%, rgba(103,232,249,0) 44%), radial-gradient(circle at 14% 82%, #c4b5fd 0%, rgba(196,181,253,0) 46%), linear-gradient(135deg, #eef2ff 0%, #f8fbff 42%, #dbeafe 78%, #93c5fd 100%)',
      }}
    >
      {/* Crisp Vector Aurora Wave & Ambient Light Canvas */}
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

        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: 'radial-gradient(#3b82f6 0.85px, transparent 0.85px)',
            backgroundSize: '28px 28px',
          }}
        />

        <svg
          viewBox="0 0 1440 520"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full h-[64%] opacity-90"
        >
          <defs>
            <linearGradient id="hubAurora1" x1="0%" y1="50%" x2="100%" y2="30%">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.48" />
              <stop offset="32%" stopColor="#06B6D4" stopOpacity="0.42" />
              <stop offset="65%" stopColor="#10B981" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.52" />
            </linearGradient>
            <linearGradient id="hubAurora2" x1="0%" y1="60%" x2="100%" y2="40%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
              <stop offset="40%" stopColor="#22D3EE" stopOpacity="0.45" />
              <stop offset="75%" stopColor="#3B82F6" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.58" />
            </linearGradient>
            <linearGradient id="hubAurora3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#E0F2FE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path
            d="M0,260 C210,165 390,340 660,245 C920,155 1170,110 1440,195 L1440,520 L0,520 Z"
            fill="url(#hubAurora1)"
          />
          <path
            d="M0,335 C260,235 480,385 780,280 C1050,185 1250,240 1440,150 L1440,520 L0,520 Z"
            fill="url(#hubAurora2)"
          />
          <path
            d="M0,400 C320,320 620,445 960,365 C1190,310 1330,335 1440,295 L1440,520 L0,520 Z"
            fill="url(#hubAurora3)"
          />
        </svg>
      </div>

      {/* Top Minimal Navigation Strip */}
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

      {/* Center Prestigious Department Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-8 sm:py-10">
        <div className="relative mb-4 group cursor-default">
          <div
            className="absolute inset-0 rounded-3xl blur-xl opacity-45 scale-110"
            style={{ background: heroGlowGradient }}
          />
          <div
            className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[22px] flex items-center justify-center text-white shadow-[0_12px_30px_rgba(37,99,235,0.34)] border border-white/40 transition-transform duration-200 group-hover:scale-105"
            style={{ background: heroEmblemGradient }}
          >
            <HeroIcon className="w-11 h-11" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/75 backdrop-blur-md border border-white/90 shadow-2xs text-[10.5px] font-bold tracking-wider uppercase text-[#1D4ED8] mb-2.5">
          <Sparkles className="w-3 h-3" style={{ color: accentSparkleColor }} />
          <span>{badgeLabel}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-[34px] font-black text-[#0F2454] tracking-tight leading-snug max-w-3xl drop-shadow-[0_1px_12px_rgba(255,255,255,0.9)]">
          {titleMr}
        </h1>

        <div
          className="w-28 h-1 rounded-full my-3 opacity-90"
          style={{ background: underlineGradient }}
        />

        <p className="text-xs sm:text-[13px] font-semibold text-[#1E3A8A]/90 bg-white/75 backdrop-blur-md border border-white/90 px-4 py-1.5 rounded-full shadow-2xs max-w-3xl">
          {subtitleMr}
        </p>
      </div>

      {/* Bottom Floating Hover-Animated Icon Dock */}
      <div className="relative z-10 w-full px-3 sm:px-6 pb-5 sm:pb-6">
        <div
          className={`mx-auto bg-white/92 backdrop-blur-xl rounded-[22px] border border-white shadow-[0_16px_45px_rgba(30,64,175,0.18)] px-2 py-3 sm:py-3.5 ${dockLayout.maxW}`}
        >
          <div className={`grid gap-y-2 lg:gap-y-0 lg:divide-x divide-slate-200/75 ${dockLayout.grid}`}>
            {items.map((btn) => {
              const IconComp = btn.icon;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleNav(btn.tab, btn.params)}
                  title={`${btn.titleMr} (${btn.titleEn}) — ${btn.subtitleMr}`}
                  className="group flex flex-col items-center justify-center text-center px-2 py-2 rounded-xl transition-all duration-200 cursor-pointer hover:-translate-y-1.5 hover:bg-slate-50/90 focus:outline-none"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110 overflow-hidden"
                    style={{
                      background: btn.gradient,
                      boxShadow: `0 8px 18px -4px ${btn.shadowColor}`,
                    }}
                  >
                    <IconComp className="w-9 h-9" />
                  </div>

                  <span className="mt-2.5 text-[11.5px] font-extrabold text-slate-800 group-hover:text-slate-950 leading-tight truncate max-w-full">
                    {btn.titleMr}
                  </span>

                  <span
                    className="mt-0.5 text-[9.5px] font-extrabold tracking-wider uppercase leading-tight truncate max-w-full"
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
