import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  KeyRound, 
  Box, 
  UserCheck, 
  Clock, 
  DollarSign, 
  LogOut, 
  BarChart3, 
  AlertTriangle, 
  ChevronRight, 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle2, 
  Layers, 
  FileText,
  Sparkles,
  Lock,
  RefreshCw,
  TrendingUp,
  Shield,
  History
} from 'lucide-react';

const fmt = (n: number) => '₹ ' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface LockerDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function LockerDashboard({ onNavigate }: LockerDashboardProps) {
  const { user } = useAuth();
  const [summary, setSummary] = useState({
    totalLockers: 0,
    availableLockers: 0,
    allottedLockers: 0,
    maintenanceLockers: 0,
    sealedLockers: 0
  });
  const [allotments, setAllotments] = useState<any[]>([]);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const selectedBranchId = localStorage.getItem('globalBranchId') || (user?.branchID ? user.branchID.toString() : 'all');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [rRes, aRes, vRes] = await Promise.all([
        fetch('/api/Lockers/RackOverview'),
        fetch('/api/LockerAllotments'),
        fetch('/api/LockerVisits')
      ]);

      if (rRes.ok) {
        const rData = await rRes.json();
        setSummary({
          totalLockers: rData.totalLockers || 0,
          availableLockers: rData.availableLockers || 0,
          allottedLockers: rData.allottedLockers || 0,
          maintenanceLockers: rData.maintenanceLockers || 0,
          sealedLockers: rData.sealedLockers || 0
        });
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        if (Array.isArray(aData)) setAllotments(aData);
      }
      if (vRes.ok) {
        const vData = await vRes.json();
        if (Array.isArray(vData)) setRecentVisits(vData.slice(0, 6));
      }
    } catch (err) {
      console.error('Error loading locker dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedBranchId]);

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
          featureIconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          featureCardBorder: 'border-emerald-200/80 hover:border-emerald-400',
          backBtnHover: 'hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300',
          accentText: 'text-emerald-700',
          progressGrad: 'from-emerald-500 to-teal-600',
          tableHeadBg: 'bg-emerald-50/70 text-emerald-950 border-emerald-200',
          gradients: [
            'from-emerald-400 via-emerald-600 to-teal-950',
            'from-green-400 via-emerald-600 to-emerald-950',
            'from-emerald-400 via-green-600 to-teal-950',
            'from-teal-400 via-emerald-700 to-slate-900',
            'from-emerald-400 via-teal-600 to-green-950',
            'from-green-400 via-emerald-600 to-teal-900',
            'from-emerald-400 via-green-700 to-teal-950',
            'from-teal-400 via-emerald-800 to-slate-950'
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
          featureIconBg: 'bg-sky-50 text-blue-700 border-sky-200',
          featureCardBorder: 'border-sky-200/80 hover:border-sky-400',
          backBtnHover: 'hover:bg-sky-50 hover:text-blue-800 hover:border-sky-300',
          accentText: 'text-blue-700',
          progressGrad: 'from-blue-500 to-indigo-600',
          tableHeadBg: 'bg-blue-50/70 text-blue-950 border-blue-200',
          gradients: [
            'from-sky-400 via-blue-600 to-blue-950',
            'from-cyan-400 via-blue-600 to-indigo-950',
            'from-blue-400 via-indigo-600 to-blue-950',
            'from-sky-500 via-blue-700 to-slate-900',
            'from-cyan-500 via-blue-600 to-blue-950',
            'from-blue-400 via-blue-600 to-sky-950',
            'from-sky-400 via-indigo-600 to-blue-950',
            'from-indigo-400 via-blue-700 to-slate-950'
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
          featureIconBg: 'bg-rose-50 text-[#880e4f] border-rose-200',
          featureCardBorder: 'border-rose-200/80 hover:border-rose-400',
          backBtnHover: 'hover:bg-rose-50 hover:text-[#880e4f] hover:border-rose-300',
          accentText: 'text-[#880e4f]',
          progressGrad: 'from-rose-500 to-[#880e4f]',
          tableHeadBg: 'bg-rose-50/70 text-[#4c0519] border-rose-200',
          gradients: [
            'from-rose-400 via-[#9b1142] to-[#42051a]',
            'from-pink-400 via-[#880e4f] to-[#3a0017]',
            'from-rose-400 via-[#831843] to-[#400318]',
            'from-red-400 via-[#7f1d1d] to-[#3f0708]',
            'from-rose-400 via-[#9f1239] to-[#4c0519]',
            'from-pink-400 via-[#9d174d] to-[#470624]',
            'from-rose-400 via-[#881337] to-[#380413]',
            'from-red-400 via-[#9b1142] to-[#4c0519]'
          ]
        };
    }
  };

  const themeCfg = getThemeConfig();

  const safeAllotments = Array.isArray(allotments) ? allotments : [];
  const safeVisits = Array.isArray(recentVisits) ? recentVisits : [];
  const overdueCount = safeAllotments.filter(a => a && a.status === 'Active' && a.isOverdue).length;
  const occupancyPercentage = summary.totalLockers > 0 
    ? Math.round((summary.allottedLockers / summary.totalLockers) * 100) 
    : 0;

  const lockerSubModules = [
    {
      id: 'locker-inv',
      titleMr: 'कपाट व इन्व्हेंटरी',
      titleEn: 'CABINET & RACK',
      icon: Box,
      tab: 'locker-master',
      params: {},
      badge: `${summary.totalLockers} लॉकर्स`,
      gradient: themeCfg.gradients[0]
    },
    {
      id: 'locker-allot',
      titleMr: 'लॉकर वाटप व करार',
      titleEn: 'ALLOTMENT',
      icon: UserCheck,
      tab: 'locker-allotment',
      params: {},
      badge: 'नवीन वाटप',
      gradient: themeCfg.gradients[1]
    },
    {
      id: 'locker-visit',
      titleMr: 'दैनिक व्हिजिट नोंद',
      titleEn: 'VISIT REGISTER',
      icon: Clock,
      tab: 'locker-visit-register',
      params: {},
      badge: 'ड्युअल की हजेरी',
      gradient: themeCfg.gradients[2]
    },
    {
      id: 'locker-rent',
      titleMr: 'भाडे नूतनीकरण',
      titleEn: 'RENT RENEWAL',
      icon: DollarSign,
      tab: 'locker-rent-renewal',
      params: {},
      badge: overdueCount > 0 ? `${overdueCount} थकीत` : 'ऑटो-डेबिट',
      gradient: themeCfg.gradients[3]
    },
    {
      id: 'locker-surr',
      titleMr: 'लॉकर समर्पण',
      titleEn: 'SURRENDER',
      icon: LogOut,
      tab: 'locker-surrender',
      params: {},
      badge: 'अनामत परतावा',
      gradient: themeCfg.gradients[4]
    },
    {
      id: 'locker-types',
      titleMr: 'प्रकार व दर मास्टर',
      titleEn: 'TYPES & RATES',
      icon: Layers,
      tab: 'locker-types',
      params: {},
      badge: 'दर निश्चिती',
      gradient: themeCfg.gradients[5]
    },
    {
      id: 'locker-rep',
      titleMr: 'लॉकर अहवाल',
      titleEn: 'REPORTS',
      icon: BarChart3,
      tab: 'locker-reports',
      params: {},
      badge: 'ऑडिट पत्रके',
      gradient: themeCfg.gradients[6]
    },
    {
      id: 'locker-notice',
      titleMr: 'थकीत भाडे नोटीस',
      titleEn: 'DEMAND NOTICE',
      icon: AlertTriangle,
      tab: 'locker-reports',
      params: {},
      badge: 'नोटीस जारी',
      gradient: themeCfg.gradients[7]
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 min-h-[400px]">
        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${themeCfg.accentText}`}></div>
      </div>
    );
  }

  return (
    <div className={`w-full font-sans relative bg-gradient-to-b ${themeCfg.bgGrad} min-h-screen pb-12 transition-colors duration-300`}>
      {/* Decorative Ambient Background Glow Blob */}
      <div className={`absolute top-[-10%] left-[-10%] w-[35rem] h-[35rem] ${themeCfg.accentBg} rounded-full blur-[110px] pointer-events-none`}></div>

      <div className="p-3 md:p-6 max-w-7xl mx-auto relative z-10 space-y-5">
        
        {/* Navigation Header */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => handleNav('dashboard')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs ${themeCfg.backBtnHover} transition-all cursor-pointer`}
          >
            <ArrowLeft size={16} />
            <span>मुख्य डॅशबोर्डवर जा</span>
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboardData}
              title="रिफ्रेश करा"
              className={`p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 ${themeCfg.backBtnHover} shadow-2xs transition cursor-pointer`}
            >
              <RefreshCw size={14} />
            </button>
            <span className={`text-[11px] font-extrabold ${themeCfg.badgeBg} border px-3 py-1 rounded-full shadow-2xs flex items-center gap-1.5`}>
              <Lock size={12} /> लॉकर व्यवस्थापन विभाग (Locker Module Hub)
            </span>
          </div>
        </div>

        {/* Themed Hero Banner */}
        <div className={`bg-gradient-to-r ${themeCfg.bannerGrad} text-white rounded-2xl shadow-md p-5 relative overflow-hidden border ${themeCfg.bannerBorder}`}>
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner shrink-0 text-2xl">
                🔐
              </div>
              <div>
                <h1 className="text-base md:text-xl font-black tracking-tight text-white drop-shadow-xs flex items-center gap-2">
                  <span>लॉकर व्यवस्थापन मुख्य हब (Locker Management System)</span>
                </h1>
                <p className={`text-xs ${themeCfg.bannerSubText} font-medium mt-0.5 drop-shadow-xs`}>
                  ड्युअल की सिक्युरिटी, कपाट व्हिज्युअल नकाशा, दैनंदिन हाताळणी नोंद व स्वयंचलित भाडे वसुली
                </p>
              </div>
            </div>

            {/* Quick Metrics Badge in Hero Banner */}
            <div className={`flex flex-wrap items-center gap-3 ${themeCfg.bannerMetricBg} backdrop-blur-md px-4 py-2.5 rounded-xl border ${themeCfg.bannerBorder} shrink-0`}>
              <div>
                <div className={`text-[10px] font-bold ${themeCfg.bannerSubText} uppercase tracking-wider`}>एकूण लॉकर्स</div>
                <div className="text-sm font-black text-white">{summary.totalLockers} Lockers</div>
              </div>
              <div className="h-7 w-[1px] bg-white/20"></div>
              <div>
                <div className={`text-[10px] font-bold ${themeCfg.bannerSubText} uppercase tracking-wider`}>सध्या उपलब्ध</div>
                <div className="text-sm font-black text-emerald-300">{summary.availableLockers} मोकळे</div>
              </div>
              <div className="h-7 w-[1px] bg-white/20"></div>
              <div>
                <div className={`text-[10px] font-bold ${themeCfg.bannerSubText} uppercase tracking-wider`}>ऑक्युपन्सी दर</div>
                <div className="text-sm font-black text-white">{occupancyPercentage}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Summary Stat Cards with Theme Accent Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div 
            onClick={() => handleNav('locker-master')}
            className={`bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:shadow-md ${themeCfg.featureCardBorder} transition-all cursor-pointer flex justify-between items-center group`}
          >
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">🟢 उपलब्ध लॉकर्स</span>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">{summary.availableLockers}</p>
              <span className="text-[10px] text-slate-500 font-medium">वाटपासाठी तयार</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div 
            onClick={() => handleNav('locker-allotment')}
            className={`bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:shadow-md ${themeCfg.featureCardBorder} transition-all cursor-pointer flex justify-between items-center group`}
          >
            <div>
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">🔴 वाटप झालेले</span>
              <p className="text-2xl font-black text-blue-800 mt-0.5">{summary.allottedLockers}</p>
              <span className="text-[10px] text-slate-500 font-medium">सक्रिय ग्राहक</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <UserCheck size={20} />
            </div>
          </div>

          <div 
            onClick={() => handleNav('locker-rent-renewal')}
            className={`bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:shadow-md ${themeCfg.featureCardBorder} transition-all cursor-pointer flex justify-between items-center group`}
          >
            <div>
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">⚠️ थकीत भाडे खाती</span>
              <p className="text-2xl font-black text-rose-700 mt-0.5">{overdueCount}</p>
              <span className="text-[10px] text-slate-500 font-medium">नूतनीकरण बाकी</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <AlertTriangle size={20} />
            </div>
          </div>

          <div 
            onClick={() => handleNav('locker-visit-register')}
            className={`bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:shadow-md ${themeCfg.featureCardBorder} transition-all cursor-pointer flex justify-between items-center group`}
          >
            <div>
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">⏱️ व्हिजिट नोंदी</span>
              <p className="text-2xl font-black text-slate-800 mt-0.5">{safeVisits.length}</p>
              <span className="text-[10px] text-slate-500 font-medium">अलीकडील नोंदी</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Clock size={20} />
            </div>
          </div>
        </div>

        {/* Core Modules: Circular Glossy 3D Action Buttons Matching Loan/Shares Hub */}
        <div className={`bg-white/95 backdrop-blur-md border ${themeCfg.cardBorder} rounded-2xl p-4 md:p-6 shadow-md space-y-4`}>
          <div className="text-center pb-2 border-b border-slate-100">
            <span className={`text-xs sm:text-sm font-black ${themeCfg.textDark} uppercase tracking-widest flex items-center justify-center gap-1.5`}>
              <Sparkles size={16} className={themeCfg.textSub} /> लॉकर विभाग मुख्य हब (LOCKER DEPARTMENT CORE MODULES)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-4 sm:gap-5 justify-items-center pt-2">
            {lockerSubModules.map((btn) => {
              const IconComponent = btn.icon;
              return (
                <div
                  key={btn.id}
                  onClick={() => handleNav(btn.tab, btn.params)}
                  className="flex flex-col items-center cursor-pointer group select-none w-full max-w-[125px]"
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

        {/* Occupancy & Live Vault Status Progress Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`bg-white border ${themeCfg.cardBorder} rounded-2xl shadow-xs p-4 flex flex-col justify-between space-y-3`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold ${themeCfg.textDark} flex items-center gap-1.5`}>
                  <Box size={15} className={themeCfg.accentText} /> कपाट ऑक्युपन्सी प्रमाण (Capacity)
                </span>
                <span className={`text-xs font-extrabold ${themeCfg.badgeBg} px-2 py-0.5 rounded-full border`}>
                  {occupancyPercentage}% भरलेले
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                <div 
                  className={`bg-gradient-to-r ${themeCfg.progressGrad} h-full rounded-full transition-all duration-500`} 
                  style={{ width: `${occupancyPercentage}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-100">
              <div className="p-2 bg-emerald-50/60 rounded-lg border border-emerald-100">
                <div className="text-[10px] text-emerald-800 font-bold">उपलब्ध</div>
                <div className="text-sm font-black text-emerald-700">{summary.availableLockers}</div>
              </div>
              <div className="p-2 bg-blue-50/60 rounded-lg border border-blue-100">
                <div className="text-[10px] text-blue-800 font-bold">वाटप</div>
                <div className="text-sm font-black text-blue-800">{summary.allottedLockers}</div>
              </div>
              <div className="p-2 bg-amber-50/60 rounded-lg border border-amber-100">
                <div className="text-[10px] text-amber-800 font-bold">दुरुस्ती/इतर</div>
                <div className="text-sm font-black text-amber-700">{summary.maintenanceLockers + summary.sealedLockers}</div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Security Policies */}
          <div className={`md:col-span-2 bg-white border ${themeCfg.cardBorder} rounded-2xl shadow-xs p-4 flex flex-col justify-between space-y-3`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${themeCfg.textDark} flex items-center gap-1.5`}>
                <ShieldCheck size={16} className={themeCfg.accentText} /> लॉकर सुरक्षा व ड्युअल की मार्गदर्शक नियम
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Core Banking Standard</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                <div className={`p-1.5 ${themeCfg.featureIconBg} rounded-lg shrink-0 mt-0.5`}>
                  <KeyRound size={14} />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-[11px] block">ड्युअल की ऑथेंटिकेशन (Dual Key)</span>
                  <span className="text-[10px] text-slate-500">प्रत्येक लॉकर उघडण्यासाठी ग्राहकाची चावी व बँकेची मास्टर चावी आवश्यक असते.</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                <div className={`p-1.5 ${themeCfg.featureIconBg} rounded-lg shrink-0 mt-0.5`}>
                  <Clock size={14} />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-[11px] block">वेळेची नोंद व हजेरी (Time In / Out)</span>
                  <span className="text-[10px] text-slate-500">व्हिजिट रजिस्टरमध्ये लॉकर रूममध्ये जाण्याची व बाहेर पडण्याची वेळ अनिवार्य नोंदवावी.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Access Logs Live Table */}
        <div className={`bg-white border ${themeCfg.cardBorder} rounded-2xl shadow-xs overflow-hidden`}>
          <div className={`p-3.5 border-b flex justify-between items-center ${themeCfg.tableHeadBg}`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg ${themeCfg.featureIconBg} flex items-center justify-center font-bold`}>
                <Clock size={15} />
              </div>
              <div>
                <h3 className={`text-xs font-black ${themeCfg.textDark}`}>अलीकडील लॉकर व्हिजिट्स (Recent Vault Access Logs)</h3>
                <p className="text-[10px] text-slate-500">लॉकर रूममध्ये नुकत्याच झालेल्या प्रवेशांच्या नोंदी</p>
              </div>
            </div>
            <button
              onClick={() => handleNav('locker-visit-register')}
              className={`text-xs ${themeCfg.accentText} font-extrabold hover:underline flex items-center gap-1 cursor-pointer`}
            >
              सर्व नोंदी पहा <ChevronRight size={14} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-extrabold">
                  <th className="py-2.5 px-3">तारीख</th>
                  <th className="py-2.5 px-3">खाते क्र.</th>
                  <th className="py-2.5 px-3">लॉकर क्र.</th>
                  <th className="py-2.5 px-3">व्यक्तीचे नाव</th>
                  <th className="py-2.5 px-3 text-center">Time In</th>
                  <th className="py-2.5 px-3 text-center">Time Out</th>
                  <th className="py-2.5 px-3">अधिकारी</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {safeVisits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400 font-medium">
                      कोणत्याही व्हिजिट नोंदी उपलब्ध नाहीत.
                    </td>
                  </tr>
                ) : (
                  safeVisits.map((v) => (
                    <tr key={v.visitID} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-semibold text-slate-700">{new Date(v.visitDate).toLocaleDateString('en-GB')}</td>
                      <td className={`py-2 px-3 font-mono font-bold ${themeCfg.accentText}`}>{v.lockerAccountNo}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{v.cabinetNo} - {v.lockerNo}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{v.operatorName}</td>
                      <td className={`py-2 px-3 text-center font-bold ${themeCfg.badgeBg} rounded`}>{v.timeIn}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-600">{v.timeOut || <span className="text-amber-600 font-normal">आत आहेत...</span>}</td>
                      <td className="py-2 px-3 text-slate-600">{v.bankOfficerName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
