import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Scale, 
  ShieldAlert, 
  FileText, 
  Calendar, 
  Gavel, 
  FileSpreadsheet, 
  Settings, 
  Award, 
  Clock, 
  DollarSign, 
  ArrowRight,
  Sparkles,
  LayoutDashboard
} from 'lucide-react';

import Sec101NoticeMaster from './Sec101NoticeMaster';
import Sec101CaseFilingMaster from './Sec101CaseFilingMaster';
import Sec101HearingDiary from './Sec101HearingDiary';
import Sec101ExecutionAuctionMaster from './Sec101ExecutionAuctionMaster';
import Sec101LegalReports from './Sec101LegalReports';
import LegalRecoveryMappingMaster from './LegalRecoveryMappingMaster';

interface DashboardStats {
  totalCases: number;
  filedCases: number;
  hearingCases: number;
  certificatesIssued: number;
  executionCases: number;
  closedCases: number;
  totalClaimAmount: number;
  totalCourtFees: number;
  totalExpenses: number;
  totalNoticesIssued: number;
  upcomingHearingsNext15Days: number;
}

export default function LegalRecoveryDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1);
  const [branches, setBranches] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'notices' | 'filing' | 'hearings' | 'executions' | 'reports' | 'mapping'>('overview');
  const [loading, setLoading] = useState<boolean>(true);

  // Dynamic Theme Hook matching Banking Theme Engine
  const getInitialTheme = () => {
    return document.documentElement.getAttribute('data-theme') || 
           localStorage.getItem('app-theme') || 
           'blue';
  };

  const [appTheme, setAppTheme] = useState(getInitialTheme);

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute('data-theme') || 
                      localStorage.getItem('app-theme') || 
                      'blue';
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

  const getThemeConfig = () => {
    switch (appTheme) {
      case 'green':
        return {
          bannerGrad: 'from-[#032419] via-[#0E8A5A] to-[#043324]',
          bannerBorder: 'border-emerald-500/30',
          bannerIconBg: 'bg-emerald-600/30 border-emerald-400/40 text-emerald-200',
          bannerSubText: 'text-emerald-100/90',
          accentBorder: 'border-emerald-200 hover:border-emerald-500',
          accentText: 'text-[#0E8A5A]',
          badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
          btnPrimary: 'bg-[#0E8A5A] hover:bg-emerald-700 text-white',
          cardBorder: 'border-emerald-200/80 shadow-emerald-100/60',
          btnBorder: 'border-emerald-200/90 shadow-[#032d23]/40 group-hover:shadow-emerald-600/50',
          textDark: 'text-emerald-950',
          activeItemBg: 'bg-emerald-500/25 border-white shadow-md ring-2 ring-white/50',
          // Unified Harmonious Emerald Shades (Not rainbow)
          iconGradient: 'from-emerald-400 via-[#0E8A5A] to-[#043e2e]'
        };
      case 'wine-red':
        return {
          bannerGrad: 'from-[#29030f] via-[#880E4F] to-[#3b0416]',
          bannerBorder: 'border-rose-500/30',
          bannerIconBg: 'bg-rose-600/30 border-rose-400/40 text-rose-200',
          bannerSubText: 'text-rose-100/90',
          accentBorder: 'border-rose-200 hover:border-rose-500',
          accentText: 'text-[#880E4F]',
          badgeBg: 'bg-rose-50 text-rose-800 border border-rose-200',
          btnPrimary: 'bg-[#880E4F] hover:bg-rose-900 text-white',
          cardBorder: 'border-rose-200/80 shadow-rose-100/60',
          btnBorder: 'border-rose-200/90 shadow-[#42051a]/40 group-hover:shadow-rose-600/50',
          textDark: 'text-rose-950',
          activeItemBg: 'bg-rose-500/25 border-white shadow-md ring-2 ring-white/50',
          // Unified Harmonious Burgundy Shades (Not rainbow)
          iconGradient: 'from-rose-400 via-[#880E4F] to-[#3a0017]'
        };
      case 'blue':
      default:
        return {
          bannerGrad: 'from-[#001f33] via-[#005689] to-[#002b47]',
          bannerBorder: 'border-sky-500/30',
          bannerIconBg: 'bg-blue-600/30 border-sky-400/40 text-sky-200',
          bannerSubText: 'text-sky-100/90',
          accentBorder: 'border-blue-200 hover:border-blue-500',
          accentText: 'text-[#005689]',
          badgeBg: 'bg-blue-50 text-blue-800 border border-blue-200',
          btnPrimary: 'bg-[#005689] hover:bg-blue-800 text-white',
          cardBorder: 'border-blue-200/80 shadow-blue-100/60',
          btnBorder: 'border-blue-200/90 shadow-[#031d2e]/40 group-hover:shadow-blue-600/50',
          textDark: 'text-blue-950',
          activeItemBg: 'bg-sky-400/30 border-white shadow-md ring-2 ring-white/50',
          // Unified Harmonious Corporate Blue Shades (Not rainbow)
          iconGradient: 'from-sky-400 via-[#005689] to-[#002842]'
        };
    }
  };

  const theme = getThemeConfig();

  // 7 3D Dashboard Action Items with Unified Theme Styling
  const recoveryActionButtons = [
    {
      id: 'overview',
      titleMr: 'मुख्य डॅशबोर्ड',
      titleEn: 'OVERVIEW',
      icon: LayoutDashboard,
      tab: 'overview' as const,
      desc: 'केस स्थिती व सुनावणी अलर्ट'
    },
    {
      id: 'notices',
      titleMr: '३-टप्प्यांच्या नोटिसा',
      titleEn: 'DEMAND NOTICES',
      icon: ShieldAlert,
      tab: 'notices' as const,
      desc: '१ली, २री व कलम १०१ अंतिम नोटीस'
    },
    {
      id: 'filing',
      titleMr: 'दावा अर्ज व Form M',
      titleEn: 'CASE FILING',
      icon: FileText,
      tab: 'filing' as const,
      desc: 'दावा दाखल व थकबाकी तक्ता'
    },
    {
      id: 'hearings',
      titleMr: 'केस डायरी व सुनावणी',
      titleEn: 'HEARING DIARY',
      icon: Calendar,
      tab: 'hearings' as const,
      desc: 'सुनावणी हजेरी व दाखला नोंद'
    },
    {
      id: 'executions',
      titleMr: 'जप्ती, कपात व लिलाव',
      titleEn: 'RULE 107 / SEC 49',
      icon: Gavel,
      tab: 'executions' as const,
      desc: 'पगार कपात व मालमत्ता लिलाव'
    },
    {
      id: 'reports',
      titleMr: 'अहवाल व खतावणी',
      titleEn: 'LEGAL REPORTS',
      icon: FileSpreadsheet,
      tab: 'reports' as const,
      desc: 'केस रजिस्टर व खर्च खतावणी'
    },
    {
      id: 'mapping',
      titleMr: 'लेजर मॅपिंग',
      titleEn: 'COA SETUP',
      icon: Settings,
      tab: 'mapping' as const,
      desc: 'डायनॅमिक लेजर जोडणी'
    }
  ];

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [selectedBranchId]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      if (res.data) setBranches(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/LegalRecovery/dashboard-stats?branchId=${selectedBranchId}`);
      if (res.data) setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans space-y-3.5">
      {/* Top Banner with Dynamic Theme Gradient */}
      <div className={`bg-gradient-to-r ${theme.bannerGrad} text-white p-4 rounded-xl shadow-md border ${theme.bannerBorder}`}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl backdrop-blur-md ${theme.bannerIconBg}`}>
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base lg:text-lg font-black tracking-tight text-white flex items-center gap-2">
                सहकार कायदा कलम १०१/९१ कायदेशीर वसुली केंद्र
              </h1>
              <p className={`${theme.bannerSubText} text-[11px] font-medium`}>
                महाराष्ट्र सहकारी संस्था अधिनियम १९६० अंतर्गत कायदेशीर वसुली, Form 'M' थकबाकी तक्ता व नियम १०७ अंमलबजावणी
              </p>
            </div>
          </div>

          {/* Branch Switcher */}
          <div className="flex items-center gap-2 bg-black/25 p-1.5 rounded-xl border border-white/15 backdrop-blur-md self-end lg:self-auto">
            <span className="text-xs font-bold text-white/90 pl-2">शाखा:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(Number(e.target.value))}
              className="bg-slate-900 text-white font-semibold text-xs border border-white/20 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-white outline-none"
            >
              {branches.map((b) => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 7 3D Glossy Action Icons in Top Navigation Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-3.5 mt-3 border-t border-white/15">
          {recoveryActionButtons.map((btn) => {
            const IconComponent = btn.icon;
            const isActive = activeSubTab === btn.tab;
            return (
              <div
                key={btn.id}
                onClick={() => setActiveSubTab(btn.tab)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer transition-all duration-200 group select-none ${
                  isActive
                    ? `${theme.activeItemBg} scale-102`
                    : 'bg-white/10 hover:bg-white/15 border border-white/10 hover:scale-101'
                }`}
              >
                {/* 3D Glossy Icon Circle - Unified Theme Gradient */}
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${theme.iconGradient} border-2 border-white/70 flex items-center justify-center relative overflow-hidden shadow-sm group-hover:shadow-md transition-all`}>
                  {/* Top Gloss Reflection */}
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/60 via-white/15 to-transparent rounded-t-full pointer-events-none"></div>
                  <IconComponent className="w-5 h-5 text-white drop-shadow-md stroke-[2.2]" />
                </div>

                {/* Title */}
                <span className={`text-[10px] font-extrabold mt-1.5 text-center leading-tight tracking-tight ${isActive ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                  {btn.titleMr}
                </span>
                <span className="text-[8px] font-bold text-white/70 uppercase font-mono tracking-wider">
                  {btn.titleEn}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          {/* Upcoming Hearing Alert Banner */}
          {stats && stats.upcomingHearingsNext15Days > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-200 text-amber-900 rounded-lg">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-amber-950">
                    आगामी १५ दिवसांत {stats.upcomingHearingsNext15Days} कोर्ट सुनावण्या नियोजित आहेत!
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    वेळेवर हजर राहण्यासाठी आणि वकिलांशी समन्वय साधण्यासाठी केस डायरी तपासा.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveSubTab('hearings')}
                className="bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition"
              >
                सुनावण्या पहा →
              </button>
            </div>
          )}

          {/* Metric Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Claim Amount */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-1.5">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">एकूण दावा रक्कम</span>
                <DollarSign className={`w-4 h-4 ${theme.accentText}`} />
              </div>
              <div className="text-xl font-bold text-gray-900">
                ₹{stats?.totalClaimAmount?.toLocaleString('en-IN') || '0'}
              </div>
              <p className="text-[10px] text-gray-400 font-medium">दाखल केलेल्या सर्व केसेसची थकबाकी</p>
            </div>

            {/* Total Cases Filed */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-1.5">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">दाखल दावे (Cases)</span>
                <Scale className={`w-4 h-4 ${theme.accentText}`} />
              </div>
              <div className="text-xl font-bold text-gray-900">
                {stats?.totalCases || 0}
              </div>
              <div className="flex gap-2 text-[10px] font-semibold text-gray-600">
                <span>दाखल: {stats?.filedCases || 0}</span>
                <span>• सुनावणी: {stats?.hearingCases || 0}</span>
              </div>
            </div>

            {/* Recovery Certificates Granted */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-1.5">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">वसुली दाखले मंजूर</span>
                <Award className={`w-4 h-4 ${theme.accentText}`} />
              </div>
              <div className={`text-xl font-bold ${theme.accentText}`}>
                {stats?.certificatesIssued || 0}
              </div>
              <p className="text-[10px] text-gray-500 font-medium">निबंधकांकडून मंजूर झालेले कलम १०१ दाखले</p>
            </div>

            {/* Executions / Rule 107 */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-1.5">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">जप्ती व पगार कपात</span>
                <Gavel className={`w-4 h-4 ${theme.accentText}`} />
              </div>
              <div className={`text-xl font-bold ${theme.accentText}`}>
                {stats?.executionCases || 0}
              </div>
              <p className="text-[10px] text-gray-500 font-medium">नियम १०७ व कलम ४९ अंमलबजावणी</p>
            </div>
          </div>



          {/* Guided Workflow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 Card */}
            <div
              onClick={() => setActiveSubTab('notices')}
              className={`p-4 rounded-xl border ${theme.accentBorder} bg-white shadow-xs hover:shadow-sm cursor-pointer transition space-y-2`}
            >
              <div className={`w-8 h-8 ${theme.btnPrimary} rounded-lg flex items-center justify-center font-bold text-xs`}>
                १
              </div>
              <h3 className="text-xs font-bold text-gray-900">३-टप्प्यांच्या कायदेशीर नोटिसा</h3>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                थकबाकीदारांना १ली नोटीस (३० दिवस), २री नोटीस (६० दिवस) व कलम १०१ अंतिम कायदेशीर इशारा नोटीस (१५ दिवस) काढा.
              </p>
              <div className={`text-xs font-bold ${theme.accentText} flex items-center gap-1 pt-1`}>
                नोटीस जनरेटर सुरू करा <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Step 2 Card */}
            <div
              onClick={() => setActiveSubTab('filing')}
              className={`p-4 rounded-xl border ${theme.accentBorder} bg-white shadow-xs hover:shadow-sm cursor-pointer transition space-y-2`}
            >
              <div className={`w-8 h-8 ${theme.btnPrimary} rounded-lg flex items-center justify-center font-bold text-xs`}>
                २
              </div>
              <h3 className="text-xs font-bold text-gray-900">कलम १०१ दावा अर्ज व Form 'M'</h3>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                मा. निबंधकांकडे अधिकृत मराठी दावा अर्ज, वैधानिक थकबाकी तक्ता (Form M) व कोर्ट फी ऑटो-व्हाउचर तयार करा.
              </p>
              <div className={`text-xs font-bold ${theme.accentText} flex items-center gap-1 pt-1`}>
                दावा अर्ज दाखल करा <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Step 3 Card */}
            <div
              onClick={() => setActiveSubTab('executions')}
              className={`p-4 rounded-xl border ${theme.accentBorder} bg-white shadow-xs hover:shadow-sm cursor-pointer transition space-y-2`}
            >
              <div className={`w-8 h-8 ${theme.btnPrimary} rounded-lg flex items-center justify-center font-bold text-xs`}>
                ३
              </div>
              <h3 className="text-xs font-bold text-gray-900">नियम १०७ जप्ती, पगार कपात व लिलाव</h3>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                दाखला मिळाल्यानंतर कलम ४९ पगार कपात आदेश, स्थावर/जंगम मालमत्ता जप्ती पंचनामा व लिलाव जाहीरनामा प्रिंट करा.
              </p>
              <div className={`text-xs font-bold ${theme.accentText} flex items-center gap-1 pt-1`}>
                जप्ती व लिलाव सुरू करा <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Legal Expense & Zero-Hardcoding Info Card */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="space-y-0.5">
              <div className={`text-[10px] font-bold ${theme.badgeBg} px-2 py-0.5 rounded-sm uppercase inline-block`}>
                शून्य हार्डकोडिंग (Zero Hardcoding Principle)
              </div>
              <h3 className="text-xs font-bold text-gray-900">डायनॅमिक लेजर इंटिग्रेशन</h3>
              <p className="text-[11px] text-gray-600 max-w-2xl">
                सर्व कोर्ट फी (₹{stats?.totalCourtFees?.toLocaleString('en-IN') || '0'}), वकिली फी, नोटीस फी व इतर कायदेशीर खर्च (एकूण ₹{stats?.totalExpenses?.toLocaleString('en-IN') || '0'}) संस्थेच्या चार्ट ऑफ अकाउंट्सनुसार डायनॅमिकली ऑटो-व्हाउचर पोस्ट होतात.
              </p>
            </div>
            <button
              onClick={() => setActiveSubTab('mapping')}
              className={`px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition whitespace-nowrap ${theme.btnPrimary}`}
            >
              लेजर मॅपिंग तपासा →
            </button>
          </div>
        </div>
      )}

      {/* Sub-Components View */}
      {activeSubTab === 'notices' && <Sec101NoticeMaster />}
      {activeSubTab === 'filing' && <Sec101CaseFilingMaster />}
      {activeSubTab === 'hearings' && <Sec101HearingDiary />}
      {activeSubTab === 'executions' && <Sec101ExecutionAuctionMaster />}
      {activeSubTab === 'reports' && <Sec101LegalReports />}
      {activeSubTab === 'mapping' && <LegalRecoveryMappingMaster />}
    </div>
  );
}
