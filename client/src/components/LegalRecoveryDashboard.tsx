import React, { useState, useEffect, useCallback } from 'react';
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
  UserCheck,
  LayoutDashboard
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { isHeadOfficeUser, getEffectiveBranchId, resolveWriteBranchId } from '../utils/branchAccess';
import CustomerLegalTracker from './CustomerLegalTracker';
import Sec101NoticeMaster from './Sec101NoticeMaster';
import Sec101CaseFilingMaster from './Sec101CaseFilingMaster';
import Sec101HearingDiary from './Sec101HearingDiary';
import Sec101ExecutionAuctionMaster from './Sec101ExecutionAuctionMaster';
import Sec101LegalReports from './Sec101LegalReports';
import LegalRecoveryMappingMaster from './LegalRecoveryMappingMaster';

type LegalSubTab = 'overview' | 'tracker' | 'notices' | 'filing' | 'hearings' | 'executions' | 'reports' | 'mapping';

interface LegalRecoveryDashboardProps {
  initialSubTab?: LegalSubTab;
}

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

export default function LegalRecoveryDashboard({ initialSubTab = 'overview' }: LegalRecoveryDashboardProps) {
  const { user, globalBranchId } = useAuth();
  const isHo = isHeadOfficeUser(user);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | 'all'>(() => {
    const eff = getEffectiveBranchId(user, globalBranchId);
    return eff ?? (user?.branchID || 1);
  });
  const [branches, setBranches] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<LegalSubTab>(initialSubTab);
  const [navContext, setNavContext] = useState<{ customerId?: number; loanAccountId?: number; caseId?: number }>(() => {
    const sp = new URLSearchParams(window.location.search);
    const cId = Number(sp.get('customerId') || 0);
    const lId = Number(sp.get('loanAccountId') || 0);
    const csId = Number(sp.get('caseId') || 0);
    return {
      customerId: cId > 0 ? cId : undefined,
      loanAccountId: lId > 0 ? lId : undefined,
      caseId: csId > 0 ? csId : undefined,
    };
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    const eff = getEffectiveBranchId(user, globalBranchId);
    if (!isHo && eff && eff !== 'all') {
      setSelectedBranchId(eff);
    } else if (eff !== null) {
      setSelectedBranchId(eff);
    }
  }, [user, globalBranchId, isHo]);

  useEffect(() => {
    const handleGlobalBranchChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const eff = getEffectiveBranchId(user, detail?.branchId ?? detail ?? globalBranchId);
      if (eff !== null) setSelectedBranchId(eff);
    };
    window.addEventListener('globalBranchChange', handleGlobalBranchChange);
    return () => window.removeEventListener('globalBranchChange', handleGlobalBranchChange);
  }, [user, globalBranchId]);

  const effectiveBranch = getEffectiveBranchId(user, globalBranchId, selectedBranchId);
  const writeBranchId = resolveWriteBranchId(user, selectedBranchId);

  // Dashboard Sub-Module Navigation Tabs
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
      id: 'tracker',
      titleMr: 'ग्राहक १०१/९१ ट्रॅकर',
      titleEn: 'CUSTOMER TRACKER',
      icon: UserCheck,
      tab: 'tracker' as const,
      desc: 'ग्राहकनिहाय संपूर्ण केस प्रगती'
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

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (effectiveBranch && effectiveBranch !== 'all' && Number(effectiveBranch) > 0) {
        params.branchId = effectiveBranch;
      }
      const res = await axios.get('/api/LegalRecovery/dashboard-stats', { params });
      if (res.data) setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [effectiveBranch]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleNavigateSubTab = (tab: LegalSubTab, ctx?: { customerId?: number; loanAccountId?: number; caseId?: number }) => {
    if (ctx) {
      setNavContext(ctx);
    }
    setActiveSubTab(tab);
  };

  return (
    <div className="p-2.5 max-w-full h-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5">
      {/* Clean CBS Header & Compact Tab Navigation (Hidden on Print) */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary p-3 space-y-2.5 print:hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-sm bg-primary/10 border border-primary/20 text-primary shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm lg:text-base font-bold tracking-tight text-primary flex items-center gap-2">
                सहकार कायदा कलम १०१/९१ कायदेशीर वसुली केंद्र
              </h1>
              <p className="text-[11px] text-slate-600 font-medium">
                महाराष्ट्र सहकारी संस्था अधिनियम १९६० अंतर्गत कायदेशीर वसुली, Form 'M' थकबाकी तक्ता व नियम १०७ अंमलबजावणी
              </p>
            </div>
          </div>

          {/* Branch Switcher */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <span className="text-[11px] font-bold text-slate-700">शाखा:</span>
            <select
              value={selectedBranchId === 'all' ? 'all' : selectedBranchId}
              disabled={!isHo}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedBranchId(val === 'all' ? 'all' : Number(val));
              }}
              className="bg-white text-slate-800 font-semibold text-xs border border-gray-300 rounded-sm px-2.5 py-1 focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:bg-gray-100 disabled:text-slate-500"
            >
              {isHo && <option value="all">सर्व शाखा (All Branches)</option>}
              {branches.map((b) => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub-Module Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 pt-2.5 border-t border-gray-200">
          {recoveryActionButtons.map((btn) => {
            const IconComponent = btn.icon;
            const isActive = activeSubTab === btn.tab;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setActiveSubTab(btn.tab)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-sm border text-left transition cursor-pointer select-none ${
                  isActive
                    ? 'bg-primary text-white border-primary shadow-xs font-bold'
                    : 'bg-white text-slate-700 border-gray-200 hover:bg-primary/10 hover:border-primary/30 hover:text-primary font-semibold'
                }`}
              >
                <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-primary'}`} />
                <div className="min-w-0">
                  <div className="text-[11px] leading-tight truncate">{btn.titleMr}</div>
                  <div className={`text-[8.5px] font-mono tracking-wider uppercase truncate ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                    {btn.titleEn}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {activeSubTab === 'overview' && (
        <div className="space-y-3">
          {/* Upcoming Hearing Alert Banner */}
          {stats && stats.upcomingHearingsNext15Days > 0 && (
            <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-600 rounded-sm p-2.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-amber-100 text-amber-800 rounded-sm">
                  <Clock className="w-4 h-4 animate-pulse" />
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
                type="button"
                onClick={() => setActiveSubTab('hearings')}
                className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-3 py-1.5 rounded-sm shadow-xs transition shrink-0"
              >
                सुनावण्या पहा →
              </button>
            </div>
          )}

          {/* Metric Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Claim Amount */}
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-1">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">एकूण दावा रक्कम</span>
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xl font-bold text-gray-900">
                {loading ? '...' : `₹${stats?.totalClaimAmount?.toLocaleString('en-IN') || '0'}`}
              </div>
              <p className="text-[10px] text-gray-500 font-medium">दाखल केलेल्या सर्व केसेसची थकबाकी</p>
            </div>

            {/* Total Cases Filed */}
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-1">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">दाखल दावे (Cases)</span>
                <Scale className="w-4 h-4 text-primary" />
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
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-1">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">वसुली दाखले मंजूर</span>
                <Award className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xl font-bold text-primary">
                {stats?.certificatesIssued || 0}
              </div>
              <p className="text-[10px] text-gray-500 font-medium">निबंधकांकडून मंजूर झालेले कलम १०१ दाखले</p>
            </div>

            {/* Executions / Rule 107 */}
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-1">
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">जप्ती व पगार कपात</span>
                <Gavel className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xl font-bold text-primary">
                {stats?.executionCases || 0}
              </div>
              <p className="text-[10px] text-gray-500 font-medium">नियम १०७ व कलम ४९ अंमलबजावणी</p>
            </div>
          </div>

          {/* Guided Workflow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Step 1 Card */}
            <div
              onClick={() => setActiveSubTab('notices')}
              className="p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary hover:border-primary bg-white shadow-xs hover:shadow-sm cursor-pointer transition space-y-2"
            >
              <div className="w-7 h-7 bg-primary text-white rounded-sm flex items-center justify-center font-bold text-xs">
                १
              </div>
              <h3 className="text-xs font-bold text-gray-900">३-टप्प्यांच्या कायदेशीर नोटिसा</h3>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                थकबाकीदारांना १ली नोटीस (३० दिवस), २री नोटीस (६० दिवस) व कलम १०१ अंतिम कायदेशीर इशारा नोटीस (१५ दिवस) काढा.
              </p>
              <div className="text-xs font-bold text-primary flex items-center gap-1 pt-1">
                नोटीस जनरेटर सुरू करा <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Step 2 Card */}
            <div
              onClick={() => setActiveSubTab('filing')}
              className="p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary hover:border-primary bg-white shadow-xs hover:shadow-sm cursor-pointer transition space-y-2"
            >
              <div className="w-7 h-7 bg-primary text-white rounded-sm flex items-center justify-center font-bold text-xs">
                २
              </div>
              <h3 className="text-xs font-bold text-gray-900">कलम १०१ दावा अर्ज व Form 'M'</h3>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                मा. निबंधकांकडे अधिकृत मराठी दावा अर्ज, वैधानिक थकबाकी तक्ता (Form M) व कोर्ट फी ऑटो-व्हाउचर तयार करा.
              </p>
              <div className="text-xs font-bold text-primary flex items-center gap-1 pt-1">
                दावा अर्ज दाखल करा <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Step 3 Card */}
            <div
              onClick={() => setActiveSubTab('executions')}
              className="p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary hover:border-primary bg-white shadow-xs hover:shadow-sm cursor-pointer transition space-y-2"
            >
              <div className="w-7 h-7 bg-primary text-white rounded-sm flex items-center justify-center font-bold text-xs">
                ३
              </div>
              <h3 className="text-xs font-bold text-gray-900">नियम १०७ जप्ती, पगार कपात व लिलाव</h3>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                दाखला मिळाल्यानंतर कलम ४९ पगार कपात आदेश, स्थावर/जंगम मालमत्ता जप्ती पंचनामा व लिलाव जाहीरनामा प्रिंट करा.
              </p>
              <div className="text-xs font-bold text-primary flex items-center gap-1 pt-1">
                जप्ती व लिलाव सुरू करा <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Legal Expense & Zero-Hardcoding Info Card */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-l-4 border-l-primary shadow-xs flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-sm uppercase inline-block">
                शून्य हार्डकोडिंग (Zero Hardcoding Principle)
              </div>
              <h3 className="text-xs font-bold text-gray-900">डायनॅमिक लेजर इंटिग्रेशन</h3>
              <p className="text-[11px] text-gray-600 max-w-2xl">
                सर्व कोर्ट फी (₹{stats?.totalCourtFees?.toLocaleString('en-IN') || '0'}), वकिली फी, नोटीस फी व इतर कायदेशीर खर्च (एकूण ₹{stats?.totalExpenses?.toLocaleString('en-IN') || '0'}) संस्थेच्या चार्ट ऑफ अकाउंट्सनुसार डायनॅमिकली ऑटो-व्हाउचर पोस्ट होतात.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('mapping')}
              className="px-4 py-1.5 rounded-sm text-xs font-bold shadow-xs transition whitespace-nowrap bg-primary hover:opacity-95 text-white"
            >
              लेजर मॅपिंग तपासा →
            </button>
          </div>
        </div>
      )}

      {/* Sub-Components View */}
      {activeSubTab === 'tracker' && (
        <CustomerLegalTracker
          branchId={writeBranchId}
          effectiveBranch={effectiveBranch}
          initialCustomerId={navContext.customerId}
          initialLoanAccountId={navContext.loanAccountId}
          embedded
          onNavigateTab={(t, ctx) => handleNavigateSubTab(t, ctx)}
        />
      )}
      {activeSubTab === 'notices' && (
        <Sec101NoticeMaster
          branchId={writeBranchId}
          effectiveBranch={effectiveBranch}
          initialLoanAccountId={navContext.loanAccountId}
          embedded
          onDataChanged={fetchStats}
        />
      )}
      {activeSubTab === 'filing' && (
        <Sec101CaseFilingMaster
          branchId={writeBranchId}
          effectiveBranch={effectiveBranch}
          initialLoanAccountId={navContext.loanAccountId}
          embedded
          onDataChanged={fetchStats}
        />
      )}
      {activeSubTab === 'hearings' && (
        <Sec101HearingDiary
          branchId={writeBranchId}
          effectiveBranch={effectiveBranch}
          initialCaseId={navContext.caseId}
          embedded
          onDataChanged={fetchStats}
        />
      )}
      {activeSubTab === 'executions' && (
        <Sec101ExecutionAuctionMaster
          branchId={writeBranchId}
          effectiveBranch={effectiveBranch}
          initialCaseId={navContext.caseId}
          embedded
          onDataChanged={fetchStats}
        />
      )}
      {activeSubTab === 'reports' && (
        <Sec101LegalReports
          branchId={writeBranchId}
          effectiveBranch={effectiveBranch}
          embedded
          onDataChanged={fetchStats}
        />
      )}
      {activeSubTab === 'mapping' && (
        <LegalRecoveryMappingMaster
          branchId={writeBranchId}
          embedded
          onDataChanged={fetchStats}
        />
      )}
    </div>
  );
}
