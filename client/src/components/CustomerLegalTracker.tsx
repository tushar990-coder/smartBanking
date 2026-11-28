import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Scale,
  User,
  Phone,
  MapPin,
  FileText,
  Gavel,
  Calendar,
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Printer,
  ShieldAlert,
  IndianRupee,
  Receipt,
  Plus
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import AddLoanRecoveryExpenseModal from './common/AddLoanRecoveryExpenseModal';
import { getCachedMasterArray } from '../utils/apiCache';

interface CustomerItem {
  customerID: number;
  cifNo?: string;
  legacyCustomerNo?: string;
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  mobileNo?: string;
  branchID?: number;
}

interface StageItem {
  stageNo: number;
  stageKey: string;
  title: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'SKIPPED' | string;
  completedDate?: string | null;
  details: string;
  actionTab?: string;
}

interface TimelineItem {
  date: string;
  category: string;
  title: string;
  description: string;
  amount?: number | null;
  voucherNo?: string | null;
  voucherStatus?: string | null;
}

interface TrackedLoan {
  loanAccountID: number;
  loanAccountNo: string;
  legacyLoanNo?: string | null;
  branchID: number;
  branchName: string;
  loanScheme: string;
  status: string;
  openingDate: string;
  maturityDate?: string | null;
  principalBalance: number;
  interestBalance: number;
  overdueInterestBalance: number;
  netUnpaidLegalExpenses: number;
  pendingLegalExpenses: number;
  bankBorneLegalExpenses: number;
  totalRecoverableDues: number;
  guarantor1?: { customerID: number; cifNo?: string; fullName: string; mobileNo?: string } | null;
  guarantor2?: { customerID: number; cifNo?: string; fullName: string; mobileNo?: string } | null;
  activeCase?: {
    caseId: number;
    caseType: string;
    caseNumber: string;
    courtName: string;
    advocateName?: string | null;
    filingDate: string;
    totalClaimAmount: number;
    courtFeeAmount: number;
    status: string;
    certificateNo?: string | null;
    certificateDate?: string | null;
    sanctionedAmount?: number | null;
    futureInterestRate?: number | null;
    awardNumber?: string | null;
    awardDate?: string | null;
    stayOrderNo?: string | null;
    closedReason?: string | null;
  } | null;
  noticesCount: number;
  hearingsCount: number;
  executionsCount: number;
  stages: StageItem[];
  nextRecommendedAction: string;
  nextActionTab?: string;
  timeline: TimelineItem[];
}

interface TrackerResponse {
  customer: {
    customerID: number;
    cifNo?: string;
    legacyCustomerNo?: string;
    fullName: string;
    mobileNo?: string;
    address?: string;
    branchID: number;
  };
  summary: {
    totalLoans: number;
    totalCases: number;
    activeCases: number;
    totalNotices: number;
    pendingVoucherExpenses: number;
    totalApprovedLegalExpenses: number;
    totalRecoveredLegalExpenses: number;
    totalUnpaidLegalExpenses: number;
    totalLoanOutstanding: number;
  };
  loans: TrackedLoan[];
}

interface CustomerLegalTrackerProps {
  branchId?: number;
  effectiveBranch?: number | 'all' | null;
  initialCustomerId?: number | null;
  initialLoanAccountId?: number | null;
  embedded?: boolean;
  onNavigateTab?: (tab: 'notices' | 'filing' | 'hearings' | 'executions' | 'reports' | 'mapping', ctx?: { customerId?: number; loanAccountId?: number; caseId?: number }) => void;
}

const STAGE_STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  IN_PROGRESS: 'bg-amber-50 border-amber-300 text-amber-900',
  PENDING: 'bg-slate-50 border-slate-200 text-slate-600',
  SKIPPED: 'bg-slate-100 border-slate-200 text-slate-400',
};

const TIMELINE_CATEGORY_BADGE: Record<string, string> = {
  NOTICE: 'bg-amber-100 text-amber-900 border-amber-300',
  CASE: 'bg-orange-100 text-[#5A1A14] border-amber-300',
  HEARING: 'bg-amber-100 text-[#5A1A14] border-amber-300',
  CERTIFICATE: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  EXECUTION: 'bg-rose-100 text-rose-900 border-rose-300',
  EXPENSE: 'bg-orange-100 text-orange-900 border-orange-300',
  COLLECTION: 'bg-teal-100 text-teal-900 border-teal-300',
  CLOSURE: 'bg-slate-200 text-slate-900 border-slate-400',
};

const CASE_STATUS_LABELS: Record<string, string> = {
  FILED: 'दावा दाखल',
  HEARING: 'सुनावणी सुरू',
  CERTIFIED: 'कलम १०१ दाखला मंजूर',
  AWARDED: 'कलम ९१ निवाडा मंजूर',
  EXECUTION: 'नियम १०७ जप्ती/अंमलबजावणी',
  EXECUTION_RULE107: 'नियम १०७ जप्ती/अंमलबजावणी',
  STAYED: 'स्थगिती आदेश (Stay)',
  DISMISSED: 'फेटाळलेला (Dismissed)',
  WITHDRAWN: 'मागे घेतलेला / तडजोड',
  CLOSED_RECOVERED: 'पूर्ण वसूल / बंद',
};

export default function CustomerLegalTracker({
  branchId,
  effectiveBranch,
  initialCustomerId,
  initialLoanAccountId,
  embedded = false,
  onNavigateTab,
}: CustomerLegalTrackerProps) {
  const [customers, setCustomers] = useState<CustomerItem[]>(() => getCachedMasterArray<CustomerItem>('/api/Customers'));
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(() => {
    if (initialCustomerId && initialCustomerId > 0) return initialCustomerId;
    const sp = new URLSearchParams(window.location.search);
    const urlCId = Number(sp.get('customerId') || 0);
    return urlCId > 0 ? urlCId : 0;
  });
  const [trackerData, setTrackerData] = useState<TrackerResponse | null>(null);
  const [sanstha, setSanstha] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chargeModalCtx, setChargeModalCtx] = useState<{ loanAccountId: number; caseId?: number | null } | null>(null);

  useEffect(() => {
    if (initialCustomerId && initialCustomerId > 0 && initialCustomerId !== selectedCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);

  useEffect(() => {
    const loadMaster = async () => {
      try {
        const [custRes, sanRes] = await Promise.all([
          axios.get('/api/Customers'),
          axios.get('/api/SansthaDetails'),
        ]);
        const list = Array.isArray(custRes.data) ? custRes.data : [];
        setCustomers(list);
        if (Array.isArray(sanRes.data) && sanRes.data.length > 0) {
          setSanstha(sanRes.data[0]);
        } else if (sanRes.data && !Array.isArray(sanRes.data)) {
          setSanstha(sanRes.data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadMaster();
  }, []);

  const scopedCustomers = useMemo(() => {
    if (effectiveBranch && effectiveBranch !== 'all' && Number(effectiveBranch) > 0) {
      return customers.filter((c) => !c.branchID || c.branchID === Number(effectiveBranch));
    }
    return customers;
  }, [customers, effectiveBranch]);

  const customerOptions = useMemo(() => {
    return scopedCustomers.map((c) => {
      const name = c.fullName || [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ').trim() || `Customer #${c.customerID}`;
      return {
        value: c.customerID,
        label: `${c.cifNo || `CIF-${c.customerID}`}${c.legacyCustomerNo ? ` (${c.legacyCustomerNo})` : ''} — ${name}`,
        subLabel: c.mobileNo ? `मोबाईल: ${c.mobileNo}` : undefined,
      };
    });
  }, [scopedCustomers]);

  const fetchTracker = async (cId: number, lId?: number | null) => {
    if ((!cId || cId <= 0) && (!lId || lId <= 0)) {
      setTrackerData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {};
      if (cId > 0) params.customerId = cId;
      if (lId && lId > 0) params.loanAccountId = lId;
      if (effectiveBranch && effectiveBranch !== 'all' && Number(effectiveBranch) > 0) {
        params.branchId = Number(effectiveBranch);
      } else if (branchId && branchId > 0 && effectiveBranch !== 'all') {
        params.branchId = branchId;
      }
      const res = await axios.get('/api/LegalRecovery/customer-tracker', { params });
      setTrackerData(res.data);
      if (res.data?.customer?.customerID && res.data.customer.customerID !== selectedCustomerId) {
        setSelectedCustomerId(res.data.customer.customerID);
      }
    } catch (e: any) {
      console.error(e);
      setTrackerData(null);
      setError(e.response?.data?.message || 'ग्राहक कायदेशीर प्रगती माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracker(selectedCustomerId, initialLoanAccountId);
  }, [selectedCustomerId, effectiveBranch, branchId, initialLoanAccountId]);

  const handleStageAction = (actionTab?: string, loan?: TrackedLoan) => {
    if (!onNavigateTab || !actionTab) return;
    const validTabs = ['notices', 'filing', 'hearings', 'executions', 'reports', 'mapping'] as const;
    if (!validTabs.includes(actionTab as any)) return;
    onNavigateTab(actionTab as any, {
      customerId: trackerData?.customer?.customerID || selectedCustomerId,
      loanAccountId: loan?.loanAccountID,
      caseId: loan?.activeCase?.caseId,
    });
  };

  const renderStageIcon = (status: string) => {
    if (status === 'COMPLETED') return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
    if (status === 'IN_PROGRESS') return <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />;
    return <Circle className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  return (
    <div className={embedded ? 'space-y-3 bg-transparent' : 'p-2.5 space-y-3 bg-transparent text-[11px] font-sans'}>
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } }`}</style>

      {/* Standalone CBS Header (Hidden inside Dashboard or when printing) */}
      {!embedded && (
        <div className="bg-white px-3.5 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary shrink-0" />
            <div>
              <h1 className="text-sm font-bold text-primary">ग्राहकनिहाय कलम १०१ / ९१ कायदेशीर वसुली ट्रॅकर</h1>
              <p className="text-[10.5px] text-slate-500">ग्राहकाची संपूर्ण नोटीस, दावा अर्ज, सुनावणी, दाखला व नियम १०७ वसुली प्रगती फाईल</p>
            </div>
          </div>
        </div>
      )}

      {/* Search & Control Bar (Screen Only) */}
      <div className="bg-white p-3 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs flex flex-col lg:flex-row lg:items-end justify-between gap-3 print:hidden">
        <div className="flex-1 max-w-2xl space-y-1">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <User className="w-4 h-4 text-primary" />
            ग्राहक निवडा (Customer-ID-First: CIF / जुना ग्राहक क्र. / नाव / मोबाईल):
          </label>
          <SearchableSelect
            options={customerOptions}
            value={selectedCustomerId || ''}
            onChange={(e) => setSelectedCustomerId(Number(e.target.value) || 0)}
            placeholder="- CIF क्र. किंवा ग्राहकाचे नाव शोधा -"
            searchPlaceholder="CIF क्र., जुना ग्राहक क्र., नाव किंवा मोबाईल टाका..."
            countLabel="उपलब्ध ग्राहक"
            emptyMessage="ग्राहक आढळला नाही."
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchTracker(selectedCustomerId, initialLoanAccountId)}
            disabled={!selectedCustomerId || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-gray-300 bg-white hover:bg-primary/10 hover:border-primary/30 text-slate-700 hover:text-primary text-xs font-bold disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            रिफ्रेश करा
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!trackerData}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-primary hover:opacity-95 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            ग्राहक १०१/९१ फाईल प्रिंट / PDF
          </button>
        </div>
      </div>

      {/* Print-Only Sanstha Header */}
      {trackerData && (
        <div className="hidden print:block border-b-2 border-slate-800 pb-2 mb-3 text-center">
          <div className="text-base font-black text-slate-900">{sanstha?.sansthaNameMarathi || sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}</div>
          <div className="text-xs text-slate-700">{sanstha?.address || ''}</div>
          <div className="text-sm font-bold text-slate-900 mt-1">ग्राहकनिहाय सहकार कायदा कलम १०१ / ९१ वसुली प्रगती फाईल (Dossier)</div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-sm text-xs font-semibold flex items-center gap-2 print:hidden">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!selectedCustomerId && !loading && !trackerData && (
        <div className="bg-white border border-dashed border-gray-300 rounded-sm p-8 text-center space-y-2">
          <Scale className="w-9 h-9 text-primary/40 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">ग्राहकाची संपूर्ण कलम १०१ / ९१ कार्यवाही ट्रॅक करा</h3>
          <p className="text-xs text-slate-500 max-w-xl mx-auto">
            वर दिलेल्या शोध पेटीतून ग्राहकाचा <strong>CIF क्रमांक</strong> किंवा <strong>नाव</strong> निवडा.
            त्या ग्राहकाच्या सर्व थकीत कर्ज खात्यांची नोटीस स्थिती, दावा अर्ज, कोर्ट सुनावण्या, दाखला/निवाडा व नियम १०७ लिलाव प्रगती येथे दिसेल.
          </p>
        </div>
      )}

      {loading && (
        <div className="bg-white border border-gray-200 rounded-sm p-8 text-center text-xs font-semibold text-slate-500">
          ग्राहकाचा कायदेशीर वसुली इतिहास लोड होत आहे...
        </div>
      )}

      {!loading && trackerData && (
        <div className="space-y-3">
          {/* Customer Identity & KPI Summary */}
          <div className="bg-white rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs p-3.5 space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-gray-100">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20 font-mono font-bold text-[11px]">
                    {trackerData.customer.cifNo || `CUST-${trackerData.customer.customerID}`}
                  </span>
                  {trackerData.customer.legacyCustomerNo && (
                    <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-mono font-semibold text-[11px]">
                      जुना क्र.: {trackerData.customer.legacyCustomerNo}
                    </span>
                  )}
                  <h2 className="text-sm lg:text-base font-black text-slate-900">
                    {trackerData.customer.fullName}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {trackerData.customer.mobileNo || 'मोबाईल नोंद नाही'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {trackerData.customer.address || 'पत्ता नोंद नाही'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full md:w-auto">
                <div className="bg-slate-50 border border-gray-200 rounded-sm px-2.5 py-1.5 text-center">
                  <div className="text-[10px] text-slate-500 font-semibold">कर्जे</div>
                  <div className="text-xs font-black text-slate-900">{trackerData.summary.totalLoans}</div>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-sm px-2.5 py-1.5 text-center">
                  <div className="text-[10px] text-primary font-semibold">दाखल दावे</div>
                  <div className="text-xs font-black text-primary">{trackerData.summary.totalCases}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-sm px-2.5 py-1.5 text-center">
                  <div className="text-[10px] text-amber-800 font-semibold">सक्रिय दावे</div>
                  <div className="text-xs font-black text-amber-950">{trackerData.summary.activeCases}</div>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-sm px-2.5 py-1.5 text-center">
                  <div className="text-[10px] text-primary font-semibold">नोटिसा</div>
                  <div className="text-xs font-black text-primary">{trackerData.summary.totalNotices}</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-sm px-2.5 py-1.5 text-center">
                  <div className="text-[10px] text-rose-700 font-semibold">कर्ज बाकी</div>
                  <div className="text-xs font-black text-rose-900">₹{(trackerData.summary.totalLoanOutstanding || 0).toLocaleString('en-IN')}</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-sm px-2.5 py-1.5 text-center">
                  <div className="text-[10px] text-orange-800 font-semibold">येणे खर्च</div>
                  <div className="text-xs font-black text-orange-950">₹{(trackerData.summary.totalUnpaidLegalExpenses || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>

            {trackerData.summary.pendingVoucherExpenses > 0 && (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-sm px-3 py-2 text-[11px] font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  टीप: या ग्राहकाच्या {trackerData.summary.pendingVoucherExpenses} कायदेशीर खर्च व्हाउचरना अद्याप 'व्हाउचर पासिंग (Checker Approval)' मिळणे बाकी आहे. मंजुरीनंतर ते येणे खर्चात समाविष्ट होतील.
                </span>
              </div>
            )}
          </div>

          {trackerData.loans.length === 0 ? (
            <div className="bg-white rounded-sm border border-gray-200 p-6 text-center text-xs text-slate-500">
              निवडलेल्या शाखेअंतर्गत या ग्राहकाचे कोणतेही कर्ज खाते आढळले नाही.
            </div>
          ) : (
            trackerData.loans.map((loan) => (
              <div key={loan.loanAccountID} className="bg-white rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs overflow-hidden">
                {/* Loan Account CBS Header */}
                <div className="bg-primary/5 border-b border-primary/20 p-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-primary text-white px-2 py-0.5 rounded-sm">
                        {loan.loanAccountNo}
                      </span>
                      {loan.legacyLoanNo && (
                        <span className="font-mono text-[10px] bg-white border border-gray-300 px-2 py-0.5 rounded-sm text-slate-700 font-semibold">
                          जुना क्र.: {loan.legacyLoanNo}
                        </span>
                      )}
                      <span className="text-xs font-bold text-primary">{loan.loanScheme || 'कर्ज खाते'}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">({loan.branchName})</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${loan.status === 'Closed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        स्थिती: {loan.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-700">
                      <span>मुद्दल: <strong className="text-slate-900">₹{(loan.principalBalance || 0).toLocaleString('en-IN')}</strong></span>
                      <span>व्याज: <strong className="text-slate-900">₹{(loan.interestBalance || 0).toLocaleString('en-IN')}</strong></span>
                      <span>दंड: <strong className="text-amber-700">₹{(loan.overdueInterestBalance || 0).toLocaleString('en-IN')}</strong></span>
                      <span>येणे कायदेशीर खर्च: <strong className="text-orange-700">₹{(loan.netUnpaidLegalExpenses || 0).toLocaleString('en-IN')}</strong></span>
                      {loan.pendingLegalExpenses > 0 && (
                        <span>प्रलंबित व्हाउचर: <strong className="text-primary">₹{loan.pendingLegalExpenses.toLocaleString('en-IN')}</strong></span>
                      )}
                      <span>एकूण वसुलीपात्र: <strong className="text-emerald-700 font-extrabold">₹{(loan.totalRecoverableDues || 0).toLocaleString('en-IN')}</strong></span>
                    </div>

                    {(loan.guarantor1 || loan.guarantor2) && (
                      <div className="flex flex-wrap gap-3 text-[10px] text-slate-600 pt-0.5">
                        {loan.guarantor1 && (
                          <span>जामीनदार १: {loan.guarantor1.fullName} ({loan.guarantor1.cifNo || loan.guarantor1.customerID}){loan.guarantor1.mobileNo ? ` • ${loan.guarantor1.mobileNo}` : ''}</span>
                        )}
                        {loan.guarantor2 && (
                          <span>जामीनदार २: {loan.guarantor2.fullName} ({loan.guarantor2.cifNo || loan.guarantor2.customerID}){loan.guarantor2.mobileNo ? ` • ${loan.guarantor2.mobileNo}` : ''}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setChargeModalCtx({
                          loanAccountId: loan.loanAccountID,
                          caseId: loan.activeCase?.caseId || null,
                        })
                      }
                      className="print:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-[11px] font-bold shadow-2xs cursor-pointer transition"
                      title="कर्जाच्या मुद्दलात वसूली किंवा पोसटेज खर्च अ‍ॅड करा"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>वसूली / पोसटेज खर्च</span>
                    </button>
                    {loan.activeCase && (
                      <div className="bg-white border border-primary/30 rounded-sm px-3 py-1.5 text-right space-y-0.5 shrink-0 shadow-2xs">
                        <div className="text-[10px] font-bold text-primary">
                          {loan.activeCase.caseType === 'SEC_91' ? 'कलम ९१ लवाद दावा' : 'कलम १०१ वसुली दावा'} • {loan.activeCase.caseNumber}
                        </div>
                        <div className="text-xs font-extrabold text-slate-900">
                          {CASE_STATUS_LABELS[loan.activeCase.status] || loan.activeCase.status}
                        </div>
                        {loan.activeCase.certificateNo && (
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            दाखला क्र.: {loan.activeCase.certificateNo} (₹{(loan.activeCase.sanctionedAmount || 0).toLocaleString('en-IN')})
                          </div>
                        )}
                        {loan.activeCase.awardNumber && (
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            निवाडा क्र.: {loan.activeCase.awardNumber}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Smart Next-Action Recommendation */}
                <div className="bg-primary/10 border-b border-primary/20 px-3.5 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
                    <span>पुढील आवश्यक कार्यवाही: {loan.nextRecommendedAction}</span>
                  </div>
                  {onNavigateTab && loan.nextActionTab && (
                    <button
                      type="button"
                      onClick={() => handleStageAction(loan.nextActionTab, loan)}
                      className="print:hidden flex items-center gap-1 px-3 py-1 rounded-sm bg-primary hover:opacity-95 text-white text-[11px] font-bold shadow-2xs shrink-0"
                    >
                      पुढील टप्पा सुरू करा <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 8-Stage Legal Lifecycle Progress Stepper */}
                <div className="p-3.5 border-b border-gray-100 space-y-2">
                  <h4 className="text-xs font-bold text-primary border-l-4 border-primary pl-2 flex items-center gap-1.5">
                    <Gavel className="w-3.5 h-3.5 text-primary" />
                    ८-टप्प्यांची कायदेशीर प्रगती स्थिती (Lifecycle Progress Stepper)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {loan.stages.map((st) => (
                      <div
                        key={st.stageKey}
                        onClick={() => handleStageAction(st.actionTab, loan)}
                        className={`p-2.5 rounded-sm border transition cursor-pointer hover:shadow-xs ${STAGE_STATUS_BADGE[st.status] || STAGE_STATUS_BADGE.PENDING}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {renderStageIcon(st.status)}
                            <span className="text-[11px] font-extrabold leading-tight">
                              {st.stageNo}. {st.title}
                            </span>
                          </div>
                          {st.completedDate && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-white/80 border border-black/10 shrink-0">
                              {st.completedDate}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] mt-1.5 leading-snug opacity-90">{st.details}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chronological Activity Timeline */}
                <div className="p-3.5 space-y-2 bg-slate-50/40">
                  <h4 className="text-xs font-bold text-primary border-l-4 border-primary pl-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    ग्राहक कायदेशीर व वसुली घटनाक्रम (Chronological Audit Timeline — {loan.timeline.length} नोंदी)
                  </h4>

                  {loan.timeline.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic py-2">
                      या कर्ज खात्यावर अद्याप कोणतीही कायदेशीर नोटीस, दावा किंवा खर्च नोंदवलेला नाही.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 bg-white rounded-sm border border-gray-200 overflow-hidden">
                      {loan.timeline.map((ev, idx) => (
                        <div key={`${loan.loanAccountID}-${idx}`} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-start gap-2.5">
                            <span className="font-mono text-[10px] font-bold text-slate-500 mt-0.5 shrink-0 w-20">
                              {ev.date}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-sm border text-[9px] font-bold shrink-0 ${TIMELINE_CATEGORY_BADGE[ev.category] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {ev.category}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900">{ev.title}</div>
                              <div className="text-[10px] text-slate-600">{ev.description}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 sm:justify-end">
                            {ev.amount !== null && ev.amount !== undefined && ev.amount > 0 && (
                              <span className="inline-flex items-center gap-0.5 font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-sm">
                                <IndianRupee className="w-3 h-3" />
                                {Number(ev.amount).toLocaleString('en-IN')}
                              </span>
                            )}
                            {ev.voucherNo && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-sm">
                                <Receipt className="w-3 h-3" />
                                {ev.voucherNo}
                                {ev.voucherStatus && (
                                  <span className={`ml-1 px-1 rounded-sm font-bold ${
                                    ev.voucherStatus === 'Approved'
                                      ? 'bg-emerald-200 text-emerald-950'
                                      : ev.voucherStatus === 'Rejected'
                                      ? 'bg-rose-200 text-rose-950'
                                      : 'bg-amber-200 text-amber-950'
                                  }`}>
                                    {ev.voucherStatus}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <AddLoanRecoveryExpenseModal
        isOpen={Boolean(chargeModalCtx)}
        onClose={() => setChargeModalCtx(null)}
        branchId={trackerData?.customer?.branchID || (effectiveBranch && effectiveBranch !== 'all' ? Number(effectiveBranch) : (branchId || 1))}
        preselectedLoanAccountId={chargeModalCtx?.loanAccountId}
        preselectedCaseId={chargeModalCtx?.caseId || null}
        preselectedCustomerId={selectedCustomerId}
        onSuccess={() => {
          if (selectedCustomerId > 0 || (initialLoanAccountId && initialLoanAccountId > 0)) {
            fetchTracker(selectedCustomerId, initialLoanAccountId);
          }
        }}
      />
    </div>
  );
}
