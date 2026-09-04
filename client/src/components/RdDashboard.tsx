import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Coins, 
  Receipt, 
  Scale, 
  Layers, 
  BarChart3, 
  ArrowLeft, 
  Sparkles,
  CalendarCheck,
  TrendingUp,
  FileText
} from 'lucide-react';

const fmt = (n: number) => '₹ ' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface RdDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function RdDashboard({ onNavigate }: RdDashboardProps) {
  const { user } = useAuth();

  const getInitialTheme = () => {
    return document.documentElement.getAttribute('data-theme') || 
           localStorage.getItem('app-theme') || 
           'wine-red';
  };

  const [appTheme, setAppTheme] = useState(getInitialTheme);

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute('data-theme') || 
                      localStorage.getItem('app-theme') || 
                      'wine-red';
      setAppTheme(current);
    };

    window.addEventListener('storage', updateTheme);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => {
      window.removeEventListener('storage', updateTheme);
      observer.disconnect();
    };
  }, []);

  const handleNav = (tab: string, params?: any) => {
    if (onNavigate) {
      onNavigate(tab, params);
    }
  };

  const getThemeConfig = () => {
    switch (appTheme) {
      case 'green':
        return {
          bgGrad: 'from-emerald-50/40 via-slate-50 to-teal-50/30',
          accentBg: 'bg-emerald-400/10',
          textDark: 'text-emerald-950',
          textSub: 'text-emerald-700',
          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          cardBorder: 'border-emerald-200/80 shadow-emerald-100',
          btnBorder: 'border-emerald-200/90 shadow-emerald-950/30 group-hover:shadow-emerald-500/50',
          bannerGrad: 'from-emerald-950 via-[#0E8A5A] to-teal-900',
          bannerBorder: 'border-emerald-400/30',
          bannerMetricBg: 'bg-emerald-900/40 border-emerald-400/30',
          bannerSubText: 'text-emerald-200',
          backBtnHover: 'hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300',
          gradients: [
            'from-emerald-400 via-emerald-600 to-teal-950',
            'from-green-400 via-emerald-600 to-emerald-950',
            'from-emerald-400 via-green-600 to-teal-950',
            'from-teal-400 via-emerald-700 to-slate-900',
            'from-emerald-400 via-teal-600 to-green-950',
            'from-green-400 via-emerald-600 to-teal-900',
            'from-emerald-400 via-green-700 to-teal-950'
          ]
        };
      case 'blue':
        return {
          bgGrad: 'from-sky-50/40 via-slate-50 to-blue-50/30',
          accentBg: 'bg-sky-400/10',
          textDark: 'text-blue-950',
          textSub: 'text-sky-800',
          badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
          cardBorder: 'border-sky-200/80 shadow-sky-100',
          btnBorder: 'border-sky-200/90 shadow-blue-950/30 group-hover:shadow-blue-500/50',
          bannerGrad: 'from-slate-950 via-[#005689] to-blue-900',
          bannerBorder: 'border-sky-400/30',
          bannerMetricBg: 'bg-blue-900/40 border-sky-400/30',
          bannerSubText: 'text-sky-200',
          backBtnHover: 'hover:bg-sky-50 hover:text-blue-800 hover:border-sky-300',
          gradients: [
            'from-sky-400 via-blue-600 to-blue-950',
            'from-cyan-400 via-blue-600 to-indigo-950',
            'from-blue-400 via-indigo-600 to-blue-950',
            'from-sky-500 via-blue-700 to-slate-900',
            'from-cyan-500 via-blue-600 to-blue-950',
            'from-blue-400 via-blue-600 to-sky-950',
            'from-sky-400 via-indigo-600 to-blue-950'
          ]
        };
      case 'wine-red':
      default:
        return {
          bgGrad: 'from-rose-50/40 via-slate-50 to-pink-50/30',
          accentBg: 'bg-rose-400/10',
          textDark: 'text-[#4c0519]',
          textSub: 'text-[#880e4f]',
          badgeBg: 'bg-rose-100 text-[#880e4f] border-rose-300',
          cardBorder: 'border-rose-200/80 shadow-rose-100/60',
          btnBorder: 'border-rose-200/90 shadow-[#42051a]/40 group-hover:shadow-rose-600/50',
          bannerGrad: 'from-[#380413] via-[#880E4F] to-[#4c0519]',
          bannerBorder: 'border-rose-400/30',
          bannerMetricBg: 'bg-pink-950/40 border-rose-400/30',
          bannerSubText: 'text-pink-200',
          backBtnHover: 'hover:bg-rose-50 hover:text-[#880e4f] hover:border-rose-300',
          gradients: [
            'from-rose-400 via-[#9b1142] to-[#42051a]',
            'from-pink-400 via-[#880e4f] to-[#3a0017]',
            'from-rose-400 via-[#831843] to-[#400318]',
            'from-red-400 via-[#7f1d1d] to-[#3f0708]',
            'from-rose-400 via-[#9f1239] to-[#4c0519]',
            'from-pink-400 via-[#9d174d] to-[#470624]',
            'from-rose-400 via-[#881337] to-[#380413]'
          ]
        };
    }
  };

  const themeCfg = getThemeConfig();

  // 5 Circular Glossy 3D Action Buttons for Recurring Deposit (RD)
  const rdActionButtons = [
    {
      id: 'rd-open',
      titleMr: 'नवीन आवर्ती ठेव',
      titleEn: 'RD ACCOUNT OPENING',
      icon: Coins,
      tab: 'rd-account',
      params: {},
      gradient: themeCfg.gradients[0]
    },
    {
      id: 'rd-collect',
      titleMr: 'आवर्ती हप्ता वसुली',
      titleEn: 'INSTALLMENT COLLECTION',
      icon: Receipt,
      tab: 'rd-collect',
      params: {},
      gradient: themeCfg.gradients[1]
    },
    {
      id: 'rd-accrual',
      titleMr: 'आवर्ती व्याज आकारणी',
      titleEn: 'INTEREST ACCRUAL',
      icon: Scale,
      tab: 'rd-accrual',
      params: {},
      gradient: themeCfg.gradients[2]
    },
    {
      id: 'rd-withdraw',
      titleMr: 'आवर्ती ठेव परतावा',
      titleEn: 'MATURITY / CLOSURE',
      icon: Layers,
      tab: 'rd-withdrawal',
      params: {},
      gradient: themeCfg.gradients[3]
    },
    {
      id: 'rd-reports',
      titleMr: 'रिपोर्ट',
      titleEn: 'REPORTS',
      icon: BarChart3,
      tab: 'rd-reports',
      params: {},
      gradient: themeCfg.gradients[4]
    }
  ];

  return (
    <div className={`w-full font-sans relative bg-gradient-to-b ${themeCfg.bgGrad} min-h-[calc(100vh-4rem)] flex flex-col justify-between pb-4 transition-colors duration-300`}>
      {/* Decorative Background Accent */}
      <div className={`absolute top-[-10%] left-[-10%] w-[35rem] h-[35rem] ${themeCfg.accentBg} rounded-full blur-[110px] pointer-events-none`}></div>

      <div className="p-3 md:p-5 max-w-4xl mx-auto w-full relative z-10 flex-1 flex flex-col justify-between space-y-4">
        
        {/* Top Section: Header & Hero Banner */}
        <div className="space-y-3">
          {/* Navigation Bar */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => handleNav('dashboard')}
              className={`flex items-center gap-2 px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs ${themeCfg.backBtnHover} transition-all cursor-pointer`}
            >
              <ArrowLeft size={15} />
              <span>मुख्य डॅशबोर्डवर जा</span>
            </button>
            
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-extrabold ${themeCfg.badgeBg} px-3 py-0.5 rounded-full shadow-2xs border`}>
                🪙 आवर्ती ठेव विभाग (Recurring Deposit Hub)
              </span>
            </div>
          </div>

          {/* Hero Banner (Compact & Sleek Width) */}
          <div className={`bg-gradient-to-r ${themeCfg.bannerGrad} text-white rounded-xl shadow-md px-4 py-2.5 md:py-3 relative overflow-hidden border ${themeCfg.bannerBorder}`}>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 shadow-inner shrink-0 text-xl">
                  🪙
                </div>
                <div>
                  <h1 className="text-sm md:text-base font-black tracking-tight text-white drop-shadow-md flex items-center gap-2">
                    <span>आवर्ती ठेव विभाग मुख्य हब</span>
                  </h1>
                  <p className={`text-[11px] ${themeCfg.bannerSubText} font-medium mt-0.5 drop-shadow-xs`}>
                    नवीन आवर्ती ठेव नोंदणी, मासिक हप्ता वसुली, मुदतपूर्व परतावा आणि व्याज आकारणी
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Section: 5 Circular Glossy 3D Action Buttons */}
        <div className="mt-auto pt-4">
          <div className={`bg-white/95 backdrop-blur-md border ${themeCfg.cardBorder} rounded-2xl p-4 md:p-5 shadow-md space-y-3`}>
            <div className="text-center pb-2 border-b border-slate-100">
              <span className={`text-xs font-black ${themeCfg.textDark} uppercase tracking-widest flex items-center justify-center gap-1.5`}>
                <Sparkles size={14} className={themeCfg.textSub} /> आवर्ती ठेव विभाग मुख्य हब (RECURRING DEPOSIT CORE MODULES)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5 sm:gap-6 justify-items-center pt-2 max-w-5xl mx-auto">
              {rdActionButtons.map((btn) => {
                const IconComponent = btn.icon;
                return (
                  <div
                    key={btn.id}
                    onClick={() => handleNav(btn.tab, btn.params)}
                    className="flex flex-col items-center cursor-pointer group select-none w-full max-w-[130px]"
                  >
                    {/* Circular Glossy 3D Button Frame */}
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br ${btn.gradient} border-[3.5px] ${themeCfg.btnBorder} flex items-center justify-center relative overflow-hidden group-hover:scale-110 group-hover:shadow-2xl group-hover:border-white transition-all duration-300 p-2`}>
                      {/* Top Gloss Reflection */}
                      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/50 via-white/10 to-transparent rounded-t-full pointer-events-none"></div>
                      
                      {/* Inner Badge Frame */}
                      <div className="w-full h-full rounded-full bg-white/15 backdrop-blur-2xs border border-white/40 flex items-center justify-center p-1.5 shadow-inner">
                        <div className="text-white drop-shadow-md flex items-center justify-center">
                          <IconComponent size={34} className="stroke-[2.2]" />
                        </div>
                      </div>
                    </div>

                    {/* Label Text Below */}
                    <div className="mt-2.5 text-center">
                      <span className={`block text-xs sm:text-sm font-extrabold ${themeCfg.textDark} group-hover:opacity-80 tracking-tight leading-tight transition-colors`}>
                        {btn.titleMr}
                      </span>
                      <span className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wider mt-0.5">
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
