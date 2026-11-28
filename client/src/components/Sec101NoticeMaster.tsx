import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { exportHtmlElementToPdf } from '../utils/daybookPdfExport';
import {
  FileText,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Download,
  RefreshCw,
  Truck
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import BankLedgerSelect from './common/BankLedgerSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr, parseYmdAsLocalDate, formatLocalYmd } from '../utils/businessDateUtils';
import { isHeadOfficeUser, getEffectiveBranchId } from '../utils/branchAccess';

interface EligibleLoan {
  loanAccountID: number;
  branchID: number;
  branchName: string;
  loanAccountNo: string;
  legacyLoanNo?: string | null;
  customerID?: number | null;
  cifNo?: string;
  legacyCustomerNo?: string | null;
  customerName?: string;
  memberName: string;
  memberCode: string;
  mobileNo: string;
  address: string;
  guarantor1Name?: string;
  guarantor1Mobile?: string;
  guarantor2Name?: string;
  guarantor2Mobile?: string;
  coMemberName?: string;
  coMember2Name?: string;
  loanScheme: string;
  securityType?: string;
  securityDetails?: string;
  securityValue?: number;
  sanctionedAmount?: number;
  durationMonths?: number;
  installmentFrequency?: string;
  installmentAmount?: number;
  noOfInstallments?: number;
  interestRate?: number;
  penalRate?: number;
  interestCalculationMethod?: string;
  status?: string;
  openingDate?: string;
  loanDisbursementDate?: string;
  maturityDate?: string;
  lastInstallmentPaidDate?: string | null;
  lastInterestPostingDate?: string | null;
  principalBalance: number;
  overduePrincipal?: number;
  postedInterestBalance?: number;
  accruedRegularInterest?: number;
  totalRegularInterestDue?: number;
  interestBalance: number;
  interestStartDate?: string;
  interestDays?: number;
  postedPenalInterestBalance?: number;
  estimatedPenalInterest?: number;
  overdueInterestBalance: number;
  totalPenalInterestDue?: number;
  overdueInstallmentsCount?: number;
  totalInstallments?: number;
  overdueSinceDate?: string | null;
  overdueDays?: number;
  npaCategory?: string;
  isNpa?: boolean;
  netUnpaidLegalExpenses?: number;
  totalOutstanding: number;
  totalOutstandingWithAccrued?: number;
  noticesCount?: number;
  lastNoticeDate?: string | null;
  lastNoticeType?: string | null;
  hasActiveCase?: boolean;
  activeCaseNumber?: string | null;
  activeCaseStatus?: string | null;
}

interface LoanDuesPreview {
  loanAccountID: number;
  asOnDate: string;
  principalBalance: number;
  overduePrincipal: number;
  postedInterestBalance: number;
  accruedRegularInterest: number;
  totalRegularInterestDue: number;
  interestStartDate: string;
  interestDays: number;
  interestRate: number;
  penalRate: number;
  isFlatMethod: boolean;
  postedPenalInterestBalance: number;
  estimatedPenalInterest: number;
  totalPenalInterestDue: number;
  overdueInstallmentsCount: number;
  totalInstallments: number;
  overdueSinceDate?: string | null;
  overdueDays: number;
  netUnpaidLegalExpenses: number;
}

const fmtDmy = (ymd?: string | null): string => {
  if (!ymd) return '-';
  const clean = String(ymd).split('T')[0];
  const parts = clean.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : clean;
};

interface NoticeRecord {
  noticeId: number;
  branchId: number;
  branchName: string;
  loanAccountId: number;
  loanAccountNo: string;
  legacyLoanNo?: string | null;
  customerID?: number | null;
  cifNo?: string;
  legacyCustomerNo?: string | null;
  customerName?: string;
  memberName: string;
  memberCode: string;
  address: string;
  mobileNo: string;
  caseType?: string;
  recipientType?: string;
  noticeType: string;
  noticeNumber: string;
  noticeDate: string;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  penalInterestDue: number;
  noticeFee: number;
  totalDemandAmount: number;
  postalTrackingNo?: string;
  postalStatus: string;
  deliveredDate?: string;
  remarks?: string;
}

interface Sec101NoticeMasterProps {
  branchId?: number;
  effectiveBranch?: number | 'all' | null;
  initialLoanAccountId?: number | null;
  embedded?: boolean;
  onDataChanged?: () => void;
}

const POSTAL_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'प्रलंबित', cls: 'bg-slate-100 text-slate-700' },
  DISPATCHED: { label: 'रवाना (Dispatched)', cls: 'bg-amber-100 text-[#5A1A14]' },
  DELIVERED: { label: 'प्राप्त (Delivered)', cls: 'bg-emerald-100 text-emerald-900' },
  RETURNED: { label: 'परत आली (Returned)', cls: 'bg-amber-100 text-amber-900' },
  REFUSED: { label: 'नाकारली (Refused)', cls: 'bg-rose-100 text-rose-900' },
};

export default function Sec101NoticeMaster({
  branchId: propBranchId,
  effectiveBranch: propEffectiveBranch,
  initialLoanAccountId,
  embedded = false,
  onDataChanged,
}: Sec101NoticeMasterProps = {}) {
  const { user, globalBranchId } = useAuth();
  const isHo = isHeadOfficeUser(user);
  const bizDateStr = getBusinessDateStr(user?.businessDate);

  const computeDueDate = (startYmd: string, type: string): string => {
    const dt = parseYmdAsLocalDate(startYmd);
    const days = type === 'FINAL_NOTICE' || type === 'SRO_DEMAND' ? 15 : type === 'NOTICE_2' ? 15 : 30;
    dt.setDate(dt.getDate() + days);
    return formatLocalYmd(dt);
  };

  const [loans, setLoans] = useState<EligibleLoan[]>([]);
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [sanstha, setSanstha] = useState<any>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(() => propBranchId || user?.branchID || 1);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [loanSearch, setLoanSearch] = useState<string>('');

  // Form States
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(initialLoanAccountId || null);
  const [caseType, setCaseType] = useState<'SEC_101' | 'SEC_91'>('SEC_101');
  const [noticeType, setNoticeType] = useState<string>('NOTICE_1');
  const [noticeDate, setNoticeDate] = useState<string>(bizDateStr);
  const [dueDate, setDueDate] = useState<string>(() => computeDueDate(bizDateStr, 'NOTICE_1'));
  const [principalDue, setPrincipalDue] = useState<number>(0);
  const [interestDue, setInterestDue] = useState<number>(0);
  const [penalInterestDue, setPenalInterestDue] = useState<number>(0);
  const [noticeFee, setNoticeFee] = useState<number>(100);
  const [noticeFeePaymentMode, setNoticeFeePaymentMode] = useState<string>('CASH');
  const [noticeFeeBankLedgerId, setNoticeFeeBankLedgerId] = useState<number>(0);
  const [noticeFeeReferenceNo, setNoticeFeeReferenceNo] = useState<string>('');
  const [sendGuarantor1, setSendGuarantor1] = useState<boolean>(false);
  const [sendGuarantor2, setSendGuarantor2] = useState<boolean>(false);
  const [postalTrackingNo, setPostalTrackingNo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);
  const [duesPreview, setDuesPreview] = useState<LoanDuesPreview | null>(null);
  const [loadingDuesPreview, setLoadingDuesPreview] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Print / PDF State
  const [printNotice, setPrintNotice] = useState<NoticeRecord | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const printModalRef = useRef<HTMLDivElement>(null);

  // Postal Status Modal State
  const [postalEditNotice, setPostalEditNotice] = useState<NoticeRecord | null>(null);
  const [editPostalStatus, setEditPostalStatus] = useState<string>('DISPATCHED');
  const [editTrackingNo, setEditTrackingNo] = useState<string>('');
  const [editDeliveredDate, setEditDeliveredDate] = useState<string>(bizDateStr);
  const [editPostalRemarks, setEditPostalRemarks] = useState<string>('');
  const [savingPostal, setSavingPostal] = useState<boolean>(false);

  useEffect(() => {
    if (propBranchId && propBranchId > 0) {
      setSelectedBranchId(propBranchId);
    } else {
      const eff = getEffectiveBranchId(user, globalBranchId);
      if (typeof eff === 'number' && eff > 0) setSelectedBranchId(eff);
    }
  }, [propBranchId, user, globalBranchId]);

  useEffect(() => {
    setNoticeDate(bizDateStr);
    setDueDate(computeDueDate(bizDateStr, noticeType));
  }, [bizDateStr]);

  useEffect(() => {
    axios.get('/api/Branches').then((r) => Array.isArray(r.data) && setBranches(r.data)).catch(console.error);
    axios.get('/api/SansthaDetails').then((r) => {
      if (Array.isArray(r.data) && r.data.length > 0) setSanstha(r.data[0]);
      else if (r.data && !Array.isArray(r.data)) setSanstha(r.data);
    }).catch(console.error);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const qs = new URLSearchParams();
      if (!(propEffectiveBranch === 'all' && isHo)) qs.set('branchId', String(selectedBranchId));
      const noticeQs = qs.toString() ? `?${qs.toString()}` : '';
      if (noticeDate) qs.set('asOnDate', noticeDate);
      const eligibleQs = qs.toString() ? `?${qs.toString()}` : '';

      const [loanRes, noticeRes] = await Promise.all([
        axios.get(`/api/LegalRecovery/eligible-loans${eligibleQs}`),
        axios.get(`/api/LegalRecovery/notices${noticeQs}`),
      ]);

      const loanData: EligibleLoan[] = Array.isArray(loanRes.data) ? loanRes.data : [];
      setLoans(loanData);

      if (initialLoanAccountId && loanData.some((l) => l.loanAccountID === initialLoanAccountId)) {
        handleSelectLoan(initialLoanAccountId, loanData);
      } else if (loanData.length > 0 && (!selectedLoanId || !loanData.some((l) => l.loanAccountID === selectedLoanId))) {
        handleSelectLoan(loanData[0].loanAccountID, loanData);
      } else if (loanData.length > 0 && selectedLoanId) {
        const refreshed = loanData.find((l) => l.loanAccountID === selectedLoanId);
        if (refreshed) handleSelectLoan(refreshed.loanAccountID, loanData);
      } else if (loanData.length === 0) {
        setSelectedLoanId(null);
        setDuesPreview(null);
        setPrincipalDue(0);
        setInterestDue(0);
        setPenalInterestDue(0);
      }

      setNotices(Array.isArray(noticeRes.data) ? noticeRes.data : []);
    } catch (e: any) {
      console.error(e);
      setApiError(
        e?.response?.data?.message ||
        'थकबाकीदार कर्ज खाती लोड करताना सर्व्हर त्रुटी आली. कृपया Backend API चालू असल्याची खात्री करा.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranchId, propEffectiveBranch]);

  useEffect(() => {
    if (initialLoanAccountId && loans.length > 0) {
      handleSelectLoan(initialLoanAccountId, loans);
    }
  }, [initialLoanAccountId]);

  const computeFallbackDays = (startYmd?: string | null, endYmd?: string | null): number => {
    if (!startYmd || !endYmd) return 0;
    const sDate = parseYmdAsLocalDate(startYmd);
    const eDate = parseYmdAsLocalDate(endYmd);
    if (!sDate || !eDate) return 0;
    return Math.max(0, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const refreshLoanDuesForDate = async (loanId: number, targetDate: string) => {
    if (!loanId || loanId <= 0 || !targetDate) return;
    setLoadingDuesPreview(true);
    try {
      const res = await axios.get(`/api/LegalRecovery/loan-dues-preview/${loanId}`, {
        params: { asOnDate: targetDate },
      });
      if (res.data) {
        const d: LoanDuesPreview = res.data;
        setApiError(null);
        setDuesPreview(d);
        setPrincipalDue(d.principalBalance || 0);
        setInterestDue(d.totalRegularInterestDue ?? 0);
        setPenalInterestDue(d.totalPenalInterestDue ?? 0);
      }
    } catch (e: any) {
      console.error(e);
      const status = e?.response?.status;
      setApiError(
        status === 404
          ? 'बॅकएंड API सर्व्हर जुन्या आवृत्तीवर चालू आहे (loan-dues-preview सापडले नाही). अचूक व्याज व कर्ज तपशीलासाठी SmartBanking Backend API रीस्टार्ट करा.'
          : (e?.response?.data?.message || 'नोटीस तारखेपर्यंतचे व्याज व थकबाकी लोड करताना सर्व्हर त्रुटी आली.')
      );
    } finally {
      setLoadingDuesPreview(false);
    }
  };

  const handleSelectLoan = (loanId: number, fallbackList?: EligibleLoan[]) => {
    setSelectedLoanId(loanId);
    const list = fallbackList || loans;
    const found = list.find((l) => l.loanAccountID === loanId);
    if (found) {
      const fallbackStart = found.interestStartDate || found.loanDisbursementDate || found.openingDate || '';
      const resolvedDays = typeof found.interestDays === 'number'
        ? found.interestDays
        : computeFallbackDays(fallbackStart, noticeDate);
      setPrincipalDue(found.principalBalance || 0);
      setInterestDue(found.totalRegularInterestDue ?? found.interestBalance ?? 0);
      setPenalInterestDue(found.totalPenalInterestDue ?? found.overdueInterestBalance ?? 0);
      setDuesPreview({
        loanAccountID: found.loanAccountID,
        asOnDate: noticeDate,
        principalBalance: found.principalBalance || 0,
        overduePrincipal: found.overduePrincipal || 0,
        postedInterestBalance: found.postedInterestBalance || 0,
        accruedRegularInterest: found.accruedRegularInterest || 0,
        totalRegularInterestDue: found.totalRegularInterestDue ?? found.interestBalance ?? 0,
        interestStartDate: fallbackStart,
        interestDays: resolvedDays,
        interestRate: found.interestRate || 0,
        penalRate: found.penalRate || 0,
        isFlatMethod: (found.interestCalculationMethod || '').toLowerCase().includes('flat'),
        postedPenalInterestBalance: found.postedPenalInterestBalance ?? found.overdueInterestBalance ?? 0,
        estimatedPenalInterest: found.estimatedPenalInterest || 0,
        totalPenalInterestDue: found.totalPenalInterestDue ?? found.overdueInterestBalance ?? 0,
        overdueInstallmentsCount: found.overdueInstallmentsCount || 0,
        totalInstallments: found.totalInstallments || 0,
        overdueSinceDate: found.overdueSinceDate,
        overdueDays: found.overdueDays || 0,
        netUnpaidLegalExpenses: found.netUnpaidLegalExpenses || 0,
      });
      setSendGuarantor1(false);
      setSendGuarantor2(false);
      refreshLoanDuesForDate(loanId, noticeDate);
    }
  };

  const handleNoticeTypeChange = (nextType: string) => {
    setNoticeType(nextType);
    setDueDate(computeDueDate(noticeDate, nextType));
  };

  const handleGenerateNotice = async () => {
    if (!selectedLoanId) {
      alert('कृपया प्रथम कर्जदार खाते निवडा.');
      return;
    }

    if (Number(noticeFee) > 0 && noticeFeePaymentMode === 'BANK_TRANSFER' && (!noticeFeeBankLedgerId || noticeFeeBankLedgerId <= 0)) {
      alert('नोटीस फी बँकेद्वारे असल्यास कृपया बँक जी.एल. खाते (Bank GL Account) निवडा.');
      return;
    }

    const recipients: string[] = [];
    if (sendGuarantor1 && (selectedLoan?.guarantor1Name || selectedLoan?.coMemberName)) recipients.push('GUARANTOR_1');
    if (sendGuarantor2 && (selectedLoan?.guarantor2Name || selectedLoan?.coMember2Name)) recipients.push('GUARANTOR_2');

    setGenerating(true);
    try {
      const targetBranch = selectedLoan?.branchID || selectedBranchId;
      const res = await axios.post('/api/LegalRecovery/notice/generate', {
        branchId: targetBranch,
        loanAccountId: selectedLoanId,
        caseType,
        noticeType,
        noticeDate,
        dueDate,
        principalDue: Number(principalDue) || 0,
        interestDue: Number(interestDue) || 0,
        penalInterestDue: Number(penalInterestDue) || 0,
        noticeFee: Number(noticeFee) || 0,
        paymentMode: Number(noticeFee) > 0 ? noticeFeePaymentMode : 'CASH',
        bankLedgerId: Number(noticeFee) > 0 && noticeFeePaymentMode === 'BANK_TRANSFER' ? noticeFeeBankLedgerId : null,
        referenceNo: Number(noticeFee) > 0 && noticeFeePaymentMode === 'BANK_TRANSFER' ? noticeFeeReferenceNo : null,
        guarantorNoticeRecipients: recipients,
        postalTrackingNo,
        remarks,
      });

      if (res.status === 200) {
        const result = res.data;
        alert(
          `नोटीस यशस्वीरीत्या तयार झाली!\nनोटीस क्र: ${result.noticeNumber}\nएकूण मागणी रक्कम: ₹${Number(result.totalDemandAmount || 0).toLocaleString('en-IN')}` +
            (result.voucherNo ? `\nव्हाउचर क्र.: ${result.voucherNo} (व्हाउचर पासिंगसाठी प्रलंबित)` : '')
        );
        setPostalTrackingNo('');
        setRemarks('');
        setNoticeFeeBankLedgerId(0);
        setNoticeFeeReferenceNo('');
        await fetchData();
        if (onDataChanged) onDataChanged();
        setActiveTab('history');
      }
    } catch (e: any) {
      console.error(e);
      alert('नोटीस तयार करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const openPostalModal = (n: NoticeRecord) => {
    setPostalEditNotice(n);
    setEditPostalStatus(n.postalStatus || 'DISPATCHED');
    setEditTrackingNo(n.postalTrackingNo || '');
    setEditDeliveredDate(n.deliveredDate || bizDateStr);
    setEditPostalRemarks(n.remarks || '');
  };

  const handleSavePostalStatus = async () => {
    if (!postalEditNotice) return;
    setSavingPostal(true);
    try {
      await axios.put(`/api/LegalRecovery/notice/postal-status/${postalEditNotice.noticeId}`, {
        postalTrackingNo: editTrackingNo,
        postalStatus: editPostalStatus,
        deliveredDate: editPostalStatus === 'DELIVERED' ? editDeliveredDate : null,
        remarks: editPostalRemarks,
      });
      setPostalEditNotice(null);
      await fetchData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      alert('टपाल स्थिती अपडेट करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setSavingPostal(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!printModalRef.current || !printNotice) return;
    setDownloadingPdf(true);
    try {
      await exportHtmlElementToPdf({
        element: printModalRef.current,
        filename: `Legal_Notice_${(printNotice.noticeNumber || 'Doc').replace(/[/\\]/g, '_')}.pdf`,
        format: 'a4',
        orientation: 'portrait',
        marginMm: 6,
        shrinkToSinglePageTolerance: 1.08
      });
    } catch (err) {
      console.error('Sec 101 Legal Notice PDF generation error:', err);
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const totalDemand = Number(principalDue || 0) + Number(interestDue || 0) + Number(penalInterestDue || 0) + Number(noticeFee || 0);
  const selectedLoan = loans.find((l) => l.loanAccountID === selectedLoanId);

  const loanSelectOptions = loans.map((l) => ({
    value: l.loanAccountID,
    label: `${l.loanAccountNo} - ${l.customerName || l.memberName} (CIF: ${l.cifNo || l.memberCode || '-'})`,
    subLabel: `थकबाकी: ₹${(l.totalOutstanding || 0).toLocaleString('en-IN')}`,
  }));

  const filteredLoans = loans.filter((l) => {
    const q = loanSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (l.customerName || l.memberName || '').toLowerCase().includes(q) ||
      (l.loanAccountNo || '').toLowerCase().includes(q) ||
      (l.cifNo || l.memberCode || '').toLowerCase().includes(q) ||
      (l.legacyCustomerNo || '').toLowerCase().includes(q) ||
      (l.mobileNo || '').toLowerCase().includes(q) ||
      (l.loanScheme || '').toLowerCase().includes(q)
    );
  });

  const filteredNotices = notices.filter((n) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (n.customerName || n.memberName || '').toLowerCase().includes(q) ||
      (n.noticeNumber || '').toLowerCase().includes(q) ||
      (n.loanAccountNo || '').toLowerCase().includes(q) ||
      (n.cifNo || n.memberCode || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className={embedded ? 'max-w-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5' : 'p-2.5 max-w-full h-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5'}>
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } }`}</style>

      {/* Main Screen UI Wrapper (Hidden when print preview modal is open & printing) */}
      <div className={printNotice ? 'space-y-2.5 print:hidden' : 'space-y-2.5'}>
        {/* Header (Standalone full header vs Embedded compact action strip) */}
        {!embedded ? (
          <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
                <h1 className="text-sm font-bold text-primary tracking-wide">३-टप्प्यांच्या कायदेशीर वसुली नोटिसा (Sec 101 / 91 Demand Notices)</h1>
              </div>
              <p className="text-slate-500 text-[10.5px] mt-0.5">
                १ली नोटीस (३० दिवस), २री नोटीस (६० दिवस), कलम १०१/९१ अंतिम कायदेशीर नोटीस व जामीनदार प्रत — RPAD टपाल ट्रॅकिंगसह.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1.5 rounded-sm text-xs font-bold border transition ${
                  activeTab === 'create' ? 'bg-primary text-white border-primary shadow-xs' : 'bg-white text-slate-700 border-gray-300 hover:bg-primary/10 hover:text-primary'
                }`}
              >
                + नवीन नोटीस काढा
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-sm text-xs font-bold border transition ${
                  activeTab === 'history' ? 'bg-primary text-white border-primary shadow-xs' : 'bg-white text-slate-700 border-gray-300 hover:bg-primary/10 hover:text-primary'
                }`}
              >
                नोटीस इतिहास ({notices.length})
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white px-3 py-2 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs flex flex-wrap items-center justify-between gap-2.5 print:hidden">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-700">शाखा (Branch):</label>
              <select
                value={selectedBranchId}
                disabled={!isHo}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                className="border border-gray-300 rounded-sm px-2.5 py-1 text-xs font-semibold text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:bg-gray-100"
              >
                {branches.map((b) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName} ({b.branchCode})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={fetchData}
                className="p-1 rounded-sm border border-gray-300 bg-white hover:bg-primary/10 text-slate-700 hover:text-primary transition"
                title="रिफ्रेश करा"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <span className="text-[11px] text-gray-600 font-medium hidden sm:inline pl-1">
                पात्र खाती: <strong className="text-primary">{loans.length}</strong> | नोटिसा: <strong className="text-primary">{notices.length}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1 rounded-sm text-xs font-bold border transition ${
                  activeTab === 'create' ? 'bg-primary text-white border-primary shadow-xs' : 'bg-white text-slate-700 border-gray-300 hover:bg-primary/10 hover:text-primary'
                }`}
              >
                + नवीन नोटीस काढा
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded-sm text-xs font-bold border transition ${
                  activeTab === 'history' ? 'bg-primary text-white border-primary shadow-xs' : 'bg-white text-slate-700 border-gray-300 hover:bg-primary/10 hover:text-primary'
                }`}
              >
                नोटीस इतिहास ({notices.length})
              </button>
            </div>
          </div>
        )}

        {apiError && (
          <div className="bg-rose-50 border border-rose-300 border-l-4 border-l-rose-600 text-rose-900 px-3 py-2 rounded-sm text-xs font-bold flex items-center gap-2 print:hidden">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Branch & Summary Bar (Shown when standalone) */}
        {!embedded && (
          <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-700">शाखा (Branch):</label>
              <select
                value={selectedBranchId}
                disabled={!isHo}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                className="border border-gray-300 rounded-sm px-2.5 py-1 text-xs font-semibold text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:bg-gray-100"
              >
                {branches.map((b) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName} ({b.branchCode})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={fetchData}
                className="p-1.5 rounded-sm border border-gray-300 bg-white hover:bg-primary/10 text-gray-700 hover:text-primary transition"
                title="रिफ्रेश करा"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="text-[11px] text-gray-600 font-medium">
              पात्र थकबाकीदार खाती: <strong>{loans.length}</strong> | जारी नोटिसा: <strong>{notices.length}</strong>
            </div>
          </div>
        )}

        {activeTab === 'create' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left: Borrower Loan Selector */}
            <div className="lg:col-span-5 bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-2.5">
              <h2 className="text-xs font-bold text-primary border-l-4 border-primary pl-2 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                थकबाकीदार कर्ज खाती (Customer-First Selection)
              </h2>

              <SearchableSelect
                options={loanSelectOptions}
                value={selectedLoanId || ''}
                onChange={(e) => handleSelectLoan(Number(e.target.value))}
                placeholder="CIF / कर्ज खाते क्र. / नाव शोधा..."
              />

              <div className="relative">
                <input
                  type="text"
                  placeholder="यादीत फिल्टर करा (नाव / CIF / खाते क्र.)..."
                  value={loanSearch}
                  onChange={(e) => setLoanSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm pl-7 pr-2 py-1 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
              </div>

              <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                {filteredLoans.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    {loading ? 'खाती लोड होत आहेत...' : 'या शाखेत कोणतीही थकबाकीदार खाती आढळली नाहीत.'}
                  </div>
                ) : (
                  filteredLoans.map((loan) => {
                    const isSelected = selectedLoanId === loan.loanAccountID;
                    const regInt = loan.totalRegularInterestDue ?? loan.interestBalance ?? 0;
                    const penInt = loan.totalPenalInterestDue ?? loan.overdueInterestBalance ?? 0;
                    return (
                      <div
                        key={loan.loanAccountID}
                        onClick={() => handleSelectLoan(loan.loanAccountID)}
                        className={`p-2.5 rounded-sm border cursor-pointer transition space-y-2 ${
                          isSelected ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/20' : 'border-gray-200 hover:border-primary/40 bg-white'
                        }`}
                      >
                        {/* Header Row: Name + CIF + Badges + Total Recoverable */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <div className="font-black text-xs text-gray-900 flex flex-wrap items-center gap-1.5">
                              <span className="truncate">{loan.customerName || loan.memberName}</span>
                              {loan.isNpa && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  {loan.npaCategory || 'NPA'}
                                </span>
                              )}
                              {loan.hasActiveCase && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-100 text-[#7C2418] border border-amber-200">
                                  दावा: {loan.activeCaseNumber}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                              खाते: <strong className="text-gray-900">{loan.loanAccountNo}</strong> | CIF: {loan.cifNo || loan.memberCode || '-'}
                              {loan.legacyCustomerNo ? ` (${loan.legacyCustomerNo})` : ''}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded inline-block">
                              ₹{(loan.totalOutstandingWithAccrued ?? loan.totalOutstanding ?? 0).toLocaleString('en-IN')}
                            </span>
                            <div className="text-[9px] text-gray-500 font-medium mt-0.5">एकूण वसुलीपात्र</div>
                          </div>
                        </div>

                        {/* Loan Terms Strip */}
                        <div className="grid grid-cols-3 gap-1.5 bg-slate-50/90 border border-slate-200/80 rounded-lg p-1.5 text-[10px]">
                          <div>
                            <div className="text-gray-500">योजना / दर</div>
                            <div className="font-bold text-slate-900 truncate" title={loan.loanScheme}>
                              {loan.loanScheme} ({loan.interestRate || 0}%{loan.penalRate ? ` + ${loan.penalRate}%` : ''})
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">मंजूर / वाटप</div>
                            <div className="font-bold text-slate-900">
                              ₹{Number(loan.sanctionedAmount || 0).toLocaleString('en-IN')} • {fmtDmy(loan.loanDisbursementDate || loan.openingDate)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">हप्ता / मुदतपूर्ती</div>
                            <div className="font-bold text-slate-900">
                              ₹{Number(loan.installmentAmount || 0).toLocaleString('en-IN')} • {fmtDmy(loan.maturityDate)}
                            </div>
                          </div>
                        </div>

                        {/* Overdue Dues Breakdown */}
                        <div className="grid grid-cols-4 gap-1.5 text-[10px] pt-0.5">
                          <div className="bg-white border border-gray-200 rounded px-1.5 py-1">
                            <div className="text-[9px] text-gray-500">मुद्दल बाकी</div>
                            <div className="font-bold text-gray-900">₹{(loan.principalBalance || 0).toLocaleString('en-IN')}</div>
                          </div>
                          <div className="bg-amber-50/70 border border-amber-200 rounded px-1.5 py-1">
                            <div className="text-[9px] text-amber-800">नियमित व्याज</div>
                            <div className="font-bold text-amber-950">₹{regInt.toLocaleString('en-IN')}</div>
                          </div>
                          <div className="bg-rose-50/70 border border-rose-200 rounded px-1.5 py-1">
                            <div className="text-[9px] text-rose-800">दंडव्याज</div>
                            <div className="font-bold text-rose-950">₹{penInt.toLocaleString('en-IN')}</div>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1">
                            <div className="text-[9px] text-slate-600">थकीत हप्ते / दिवस</div>
                            <div className="font-bold text-slate-900">
                              {(loan.totalInstallments || 0) > 0
                                ? `${loan.overdueInstallmentsCount || 0}/${loan.totalInstallments} (${loan.overdueDays || 0} दि.)`
                                : ((loan.overdueDays || 0) > 0 ? `मुदतबाह्य (${loan.overdueDays} दि.)` : 'एकरकमी / बुलेट')}
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="text-[10px] text-gray-600 flex flex-wrap justify-between items-center gap-1 pt-0.5 border-t border-gray-100">
                          <span>शेवटचा भरणा: <strong>{fmtDmy(loan.lastInstallmentPaidDate)}</strong></span>
                          <span>नोटिसा: <strong>{loan.noticesCount || 0}</strong>{(loan.netUnpaidLegalExpenses || 0) > 0 ? ` | खर्च: ₹${loan.netUnpaidLegalExpenses?.toLocaleString('en-IN')}` : ''}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Notice Generation Form */}
            <div className="lg:col-span-7 bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-gray-100 pb-2">
                <h2 className="text-xs font-bold text-primary border-l-4 border-primary pl-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" />
                  नोटीस तपशील व मागणी पत्र (Notice Preparation)
                </h2>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold text-gray-600">कायदा कलम:</label>
                  <select
                    value={caseType}
                    onChange={(e) => setCaseType(e.target.value as 'SEC_101' | 'SEC_91')}
                    className="border border-gray-300 rounded-sm px-2 py-1 text-[11px] font-bold bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="SEC_101">कलम १०१ (वसुली दाखला)</option>
                    <option value="SEC_91">कलम ९१ (सहकारी न्यायालय लवाद)</option>
                  </select>
                </div>
              </div>

              {selectedLoan ? (
                <div className="bg-slate-50/70 p-3 rounded-sm border border-gray-200 text-xs text-gray-700 space-y-2">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="font-bold text-gray-900 flex flex-wrap items-center gap-1.5">
                      <span>{selectedLoan.customerName || selectedLoan.memberName}</span>
                      <span className="font-mono text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-sm">
                        {selectedLoan.cifNo || selectedLoan.memberCode}
                      </span>
                      {selectedLoan.isNpa && (
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded-sm">
                          {selectedLoan.npaCategory}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600">शाखा: {selectedLoan.branchName}</span>
                  </div>
                  <div className="text-[11px]">पत्ता: {selectedLoan.address || '-'} | मो: {selectedLoan.mobileNo || '-'}</div>

                  {/* Full Loan Account Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-200 text-[10px]">
                    <div className="bg-white rounded-sm border border-gray-200 p-1.5">
                      <div className="text-gray-500">कर्ज खाते व योजना</div>
                      <div className="font-bold text-gray-900 font-mono">{selectedLoan.loanAccountNo}</div>
                      <div className="text-gray-700 truncate">{selectedLoan.loanScheme}</div>
                    </div>
                    <div className="bg-white rounded-sm border border-gray-200 p-1.5">
                      <div className="text-gray-500">मंजूर रक्कम व दर</div>
                      <div className="font-bold text-gray-900">₹{Number(selectedLoan.sanctionedAmount || 0).toLocaleString('en-IN')}</div>
                      <div className="text-primary font-semibold">व्याज: {selectedLoan.interestRate || 0}% | दंड: {selectedLoan.penalRate || 0}%</div>
                    </div>
                    <div className="bg-white rounded-sm border border-gray-200 p-1.5">
                      <div className="text-gray-500">वाटप / मुदतपूर्ती / हप्ता</div>
                      <div className="font-bold text-gray-900">{fmtDmy(selectedLoan.loanDisbursementDate || selectedLoan.openingDate)} → {fmtDmy(selectedLoan.maturityDate)}</div>
                      <div className="text-gray-700">हप्ता: ₹{Number(selectedLoan.installmentAmount || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-white rounded-sm border border-gray-200 p-1.5">
                      <div className="text-gray-500">थकीत हप्ते / शेवटचा भरणा</div>
                      <div className="font-bold text-rose-800">
                        {(duesPreview?.totalInstallments ?? selectedLoan.totalInstallments ?? 0) > 0
                          ? `${duesPreview?.overdueInstallmentsCount ?? selectedLoan.overdueInstallmentsCount ?? 0} / ${duesPreview?.totalInstallments ?? selectedLoan.totalInstallments ?? 0} (${duesPreview?.overdueDays ?? selectedLoan.overdueDays ?? 0} दिवस)`
                          : ((duesPreview?.overdueDays ?? selectedLoan.overdueDays ?? 0) > 0 ? `मुदतबाह्य (${duesPreview?.overdueDays ?? selectedLoan.overdueDays ?? 0} दिवस)` : 'एकरकमी / बुलेट')}
                      </div>
                      <div className="text-gray-700">भरणा: {fmtDmy(selectedLoan.lastInstallmentPaidDate)}</div>
                    </div>
                  </div>
                  {selectedLoan.securityDetails && (
                    <div className="text-[10px] text-slate-700 bg-white border border-slate-200 rounded px-2 py-1">
                      <strong>तारण तपशील:</strong> {selectedLoan.securityDetails}
                    </div>
                  )}

                  {(selectedLoan.guarantor1Name || selectedLoan.coMemberName || selectedLoan.guarantor2Name || selectedLoan.coMember2Name) && (
                    <div className="pt-1.5 mt-1 border-t border-gray-200 flex flex-wrap gap-4 text-[11px]">
                      {(selectedLoan.guarantor1Name || selectedLoan.coMemberName) && (
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={sendGuarantor1}
                            onChange={(e) => setSendGuarantor1(e.target.checked)}
                          />
                          <span>जामीनदार १ ला प्रत: {selectedLoan.guarantor1Name || selectedLoan.coMemberName}{selectedLoan.guarantor1Mobile ? ` (${selectedLoan.guarantor1Mobile})` : ''}</span>
                        </label>
                      )}
                      {(selectedLoan.guarantor2Name || selectedLoan.coMember2Name) && (
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={sendGuarantor2}
                            onChange={(e) => setSendGuarantor2(e.target.checked)}
                          />
                          <span>जामीनदार २ ला प्रत: {selectedLoan.guarantor2Name || selectedLoan.coMember2Name}{selectedLoan.guarantor2Mobile ? ` (${selectedLoan.guarantor2Mobile})` : ''}</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs">
                  डाव्या बाजूने थकबाकीदार कर्जदार खाते निवडा.
                </div>
              )}

              {/* Notice Type Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700">नोटीसचा प्रकार (Notice Stage):</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { key: 'NOTICE_1', title: '१ली नोटीस (Warning)', sub: '३० दिवस स्मरणपत्र', active: 'border-amber-600 bg-amber-50 text-amber-950 font-bold' },
                    { key: 'NOTICE_2', title: '२री नोटीस (Demand)', sub: 'संयुक्त व जामीनदार मागणी', active: 'border-orange-600 bg-orange-50 text-orange-950 font-bold' },
                    { key: 'FINAL_NOTICE', title: `${caseType === 'SEC_91' ? 'कलम ९१' : 'कलम १०१'} अंतिम नोटीस`, sub: '१५ दिवसांची अंतिम मुदत', active: 'border-rose-600 bg-rose-50 text-rose-950 font-bold' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleNoticeTypeChange(item.key)}
                      className={`p-2.5 rounded-lg text-left border transition ${
                        noticeType === item.key ? item.active : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-xs font-bold">{item.title}</div>
                      <div className="text-[10px] text-gray-500">{item.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates & Amounts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700">नोटीस तारीख (व्यवसाय दिनांक):</label>
                  <input
                    type="date"
                    value={noticeDate}
                    onChange={(e) => {
                      const nextDt = e.target.value;
                      setNoticeDate(nextDt);
                      setDueDate(computeDueDate(nextDt, noticeType));
                      if (selectedLoanId) refreshLoanDuesForDate(selectedLoanId, nextDt);
                    }}
                    className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700">भरण्याची मुदत तारीख (Due Date):</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-800"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                {loadingDuesPreview && (
                  <div className="text-[10px] font-bold text-amber-700 animate-pulse">
                    नोटीस तारखेपर्यंतचे नियमित व दंडव्याज मोजले जात आहे...
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-gray-700">थकीत मुद्दल:</label>
                    <input type="number" value={principalDue} onChange={(e) => setPrincipalDue(Number(e.target.value))} className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-gray-900 bg-white" />
                    {duesPreview && (
                      <div className="text-[9px] text-gray-500 mt-0.5">
                        हप्ता थकबाकी: ₹{(duesPreview.overduePrincipal || 0).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-700">नियमित व्याज:</label>
                    <input type="number" value={interestDue} onChange={(e) => setInterestDue(Number(e.target.value))} className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-amber-900 bg-white" />
                    {duesPreview && (
                      <div className="text-[9px] text-amber-900 mt-0.5 leading-tight">
                        येणे: ₹{duesPreview.postedInterestBalance.toLocaleString('en-IN')} + जमा ({duesPreview.interestDays} दि. @ {duesPreview.interestRate}%): ₹{duesPreview.accruedRegularInterest.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-700">दंडव्याज:</label>
                    <input type="number" value={penalInterestDue} onChange={(e) => setPenalInterestDue(Number(e.target.value))} className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-rose-800 bg-white" />
                    {duesPreview && (
                      <div className="text-[9px] text-rose-800 mt-0.5 leading-tight">
                        पोस्ट: ₹{duesPreview.postedPenalInterestBalance.toLocaleString('en-IN')}
                        {duesPreview.estimatedPenalInterest > 0 ? ` | अंदाज (${duesPreview.overdueDays} दि.): ₹${duesPreview.estimatedPenalInterest.toLocaleString('en-IN')}` : ''}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-700">नोटीस फी:</label>
                    <input type="number" value={noticeFee} onChange={(e) => setNoticeFee(Number(e.target.value))} className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-gray-900 bg-white" />
                    {duesPreview && duesPreview.netUnpaidLegalExpenses > 0 && (
                      <div className="text-[9px] text-slate-600 mt-0.5">
                        आधीचे येणे खर्च: ₹{duesPreview.netUnpaidLegalExpenses.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                </div>
                {duesPreview && duesPreview.interestStartDate && (
                  <div className="text-[10px] text-slate-600 pt-1 border-t border-gray-200 flex flex-wrap justify-between gap-2">
                    <span>व्याज मोजणी कालावधी: <strong>{fmtDmy(duesPreview.interestStartDate)}</strong> ते <strong>{fmtDmy(duesPreview.asOnDate)}</strong> ({duesPreview.interestDays} दिवस • {duesPreview.isFlatMethod ? 'Flat' : 'Daily Reducing'})</span>
                    {duesPreview.overdueSinceDate && (
                      <span>थकबाकी दिनांक: <strong>{fmtDmy(duesPreview.overdueSinceDate)}</strong> ({duesPreview.overdueDays} दिवस)</span>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg flex justify-between items-center">
                <div>
                  <div className="text-[11px] font-bold text-rose-900 uppercase">एकूण मागणी रक्कम:</div>
                  <div className="text-[10px] text-rose-600">मुद्दल + व्याज + दंडव्याज + नोटीस फी</div>
                </div>
                <div className="text-xl font-black text-rose-700">₹{totalDemand.toLocaleString('en-IN')}</div>
              </div>

              {Number(noticeFee) > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-sm p-3 space-y-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-800">नोटीस फी लेखांकन पद्धत (Payment Mode):</label>
                      <select
                        value={noticeFeePaymentMode}
                        onChange={(e) => {
                          setNoticeFeePaymentMode(e.target.value);
                          if (e.target.value !== 'BANK_TRANSFER') {
                            setNoticeFeeBankLedgerId(0);
                            setNoticeFeeReferenceNo('');
                          }
                        }}
                        className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs font-bold text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      >
                        <option value="CASH">रोख पावती / पेमेंट (Cash)</option>
                        <option value="BANK_TRANSFER">बँक खाते / ट्रान्सफर (Bank Account)</option>
                        <option value="JOURNAL">जर्नल - कर्जदार नावे आकारणी (Journal Debit)</option>
                      </select>
                    </div>
                    {noticeFeePaymentMode === 'BANK_TRANSFER' && (
                      <div>
                        <label className="text-[11px] font-bold text-primary">चेक / UTR संदर्भ क्र.:</label>
                        <input
                          type="text"
                          placeholder="चेक क्र. किंवा UTR क्र."
                          value={noticeFeeReferenceNo}
                          onChange={(e) => setNoticeFeeReferenceNo(e.target.value)}
                          className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                    )}
                  </div>
                  {noticeFeePaymentMode === 'BANK_TRANSFER' && (
                    <BankLedgerSelect value={noticeFeeBankLedgerId} onChange={setNoticeFeeBankLedgerId} showCountBadge />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700">स्पीड पोस्ट / RPAD बारकोड क्र.:</label>
                  <input
                    type="text"
                    placeholder="उदा. EM123456789IN"
                    value={postalTrackingNo}
                    onChange={(e) => setPostalTrackingNo(e.target.value)}
                    className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700">नोंद / शेरा (Remarks):</label>
                  <input
                    type="text"
                    placeholder="उदा. टपालाने पाठवली / समक्ष दिली"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateNotice}
                disabled={generating || !selectedLoanId}
                className="w-full py-2.5 rounded-sm font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 bg-primary hover:opacity-95 text-white"
              >
                <CheckCircle2 className="w-4 h-4" />
                {generating ? 'नोटीस तयार होत आहे...' : 'कायदेशीर नोटीस तयार करा व सेव्ह करा'}
              </button>
            </div>
          </div>
        ) : (
          /* History Table */
          <div className="bg-white rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs overflow-hidden">
            <div className="p-3 bg-gray-100/70 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
              <h2 className="text-xs font-bold text-gray-800">जारी केलेल्या कायदेशीर नोटिसांची यादी ({filteredNotices.length})</h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="नोटीस क्र. / CIF / नाव / खाते क्र. शोधा..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="border border-gray-300 rounded-md pl-7 pr-3 py-1 text-xs w-64 bg-white"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] text-gray-700 leading-tight border-collapse">
                <thead className="bg-[#5A1A14] text-[11px] font-bold text-amber-50 uppercase border-b">
                  <tr>
                    <th className="px-2 py-1.5.5 whitespace-nowrap">नोटीस क्र. व तारीख</th>
                    <th className="px-2 py-1.5.5 whitespace-nowrap">कर्जदार / प्राप्तकर्ता (CIF)</th>
                    <th className="px-2 py-1.5.5 whitespace-nowrap">नोटीस प्रकार व कलम</th>
                    <th className="px-2 py-1.5.5 text-right whitespace-nowrap">मागणी रक्कम</th>
                    <th className="px-2 py-1.5.5 whitespace-nowrap">मुदत तारीख</th>
                    <th className="px-2 py-1.5.5 whitespace-nowrap">टपाल बारकोड व स्थिती</th>
                    <th className="px-2 py-1.5.5 text-center whitespace-nowrap">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {filteredNotices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-gray-400">
                        कोणत्याही नोटिसा आढळल्या नाहीत.
                      </td>
                    </tr>
                  ) : (
                    filteredNotices.map((n) => {
                      const pMeta = POSTAL_STATUS_LABELS[n.postalStatus] || { label: n.postalStatus, cls: 'bg-slate-100 text-slate-800' };
                      return (
                        <tr key={n.noticeId} className="hover:bg-gray-50/80 transition">
                          <td className="px-2 py-1 font-bold text-gray-900 align-middle">
                            <div>{n.noticeNumber}</div>
                            <div className="text-[10px] text-gray-500 font-normal">{n.noticeDate}</div>
                          </td>
                          <td className="px-2 py-1 align-middle">
                            <div className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                              <span>{n.customerName || n.memberName}</span>
                              {n.recipientType && n.recipientType !== 'BORROWER' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-900">
                                  {n.recipientType === 'GUARANTOR_1' ? 'जामीनदार १ प्रत' : 'जामीनदार २ प्रत'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              खाते: {n.loanAccountNo} | CIF: {n.cifNo || n.memberCode || '-'} | {n.mobileNo}
                            </div>
                          </td>
                          <td className="px-2 py-1 align-middle">
                            <div className="flex flex-col gap-0.5 items-start">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  n.noticeType === 'FINAL_NOTICE'
                                    ? 'bg-rose-100 text-rose-800'
                                    : n.noticeType === 'NOTICE_2'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {n.noticeType === 'FINAL_NOTICE' ? 'अंतिम नोटीस' : n.noticeType === 'NOTICE_2' ? '२री नोटीस' : '१ली नोटीस'}
                              </span>
                              <span className="text-[9px] font-bold text-slate-600">
                                {n.caseType === 'SEC_91' ? 'कलम ९१' : 'कलम १०१'}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-1 font-bold text-rose-700 text-right align-middle">₹{(n.totalDemandAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-2 py-1 text-gray-600 align-middle">{n.dueDate}</td>
                          <td className="px-2 py-1 text-[10px] align-middle">
                            <div className="font-mono font-bold text-gray-800">{n.postalTrackingNo || '-'}</div>
                            <span className={`font-bold px-1.5 py-0.2 rounded inline-block mt-0.5 ${pMeta.cls}`}>
                              {pMeta.label}
                            </span>
                            {n.deliveredDate && <div className="text-[9px] text-gray-500">पोहोच: {n.deliveredDate}</div>}
                          </td>
                          <td className="px-2 py-1 text-center align-middle">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openPostalModal(n)}
                                className="bg-amber-50 hover:bg-amber-100 text-[#5A1A14] px-2 py-1 rounded text-[10px] font-bold inline-flex items-center gap-1 border border-amber-200"
                                title="टपाल स्थिती अपडेट करा"
                              >
                                <Truck className="w-3 h-3" /> पोहोच
                              </button>
                              <button
                                onClick={() => setPrintNotice(n)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded text-[10px] font-bold inline-flex items-center gap-1 border border-gray-300"
                              >
                                <Printer className="w-3 h-3" /> प्रिंट
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Postal Delivery Update Modal */}
      {postalEditNotice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3.5 text-xs">
            <h3 className="text-sm font-black text-slate-900 border-b pb-2 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#9A3412]" />
              टपाल पोहोच स्थिती अपडेट करा ({postalEditNotice.noticeNumber})
            </h3>
            <div>
              <label className="font-bold text-gray-700">टपाल स्थिती (Postal Status):</label>
              <select
                value={editPostalStatus}
                onChange={(e) => setEditPostalStatus(e.target.value)}
                className="w-full mt-1 border rounded-md px-2.5 py-1.5 font-bold"
              >
                <option value="DISPATCHED">रवाना (Dispatched)</option>
                <option value="DELIVERED">प्राप्त / बजावणी पूर्ण (Delivered)</option>
                <option value="RETURNED">परत आली (Returned Unclaimed)</option>
                <option value="REFUSED">नाकारली (Refused)</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-gray-700">RPAD / स्पीड पोस्ट बारकोड क्र.:</label>
              <input
                type="text"
                value={editTrackingNo}
                onChange={(e) => setEditTrackingNo(e.target.value)}
                className="w-full mt-1 border rounded-md px-2.5 py-1.5 font-mono"
              />
            </div>
            {editPostalStatus === 'DELIVERED' && (
              <div>
                <label className="font-bold text-gray-700">पोहोच दिनांक (Delivered Date):</label>
                <input
                  type="date"
                  value={editDeliveredDate}
                  onChange={(e) => setEditDeliveredDate(e.target.value)}
                  className="w-full mt-1 border rounded-md px-2.5 py-1.5"
                />
              </div>
            )}
            <div>
              <label className="font-bold text-gray-700">शेरा (Remarks):</label>
              <input
                type="text"
                value={editPostalRemarks}
                onChange={(e) => setEditPostalRemarks(e.target.value)}
                className="w-full mt-1 border rounded-md px-2.5 py-1.5"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setPostalEditNotice(null)} className="px-3.5 py-1.5 rounded-lg bg-gray-100 font-bold text-gray-700">
                रद्द करा
              </button>
              <button onClick={handleSavePostalStatus} disabled={savingPostal} className="px-4 py-1.5 rounded-lg bg-[#9A3412] text-white font-bold">
                {savingPostal ? 'सेव्ह होत आहे...' : 'सेव्ह करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Print / PDF Notice Modal */}
      {printNotice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:static print:bg-white print:p-0">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl print:shadow-none print:max-h-none print:overflow-visible">
            <div ref={printModalRef} className="p-8 space-y-5 print:p-4">
              {/* Sanstha Header */}
              <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-wide">
                  {sanstha?.sansthaNameMarathi || sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
                </h2>
                <p className="text-xs text-slate-600">{sanstha?.address || ''}</p>
                <p className="text-xs text-slate-600">
                  नोंदणी क्र.: {sanstha?.registrationNo || '-'} | फोन: {sanstha?.phoneNo || sanstha?.contactNo || '-'} | शाखा: {printNotice.branchName}
                </p>
              </div>

              {/* Notice Title */}
              <div className="text-center">
                <span className="bg-rose-100 text-rose-900 border border-rose-300 text-xs font-extrabold px-4 py-1.5 rounded-full tracking-wide inline-block">
                  {printNotice.noticeType === 'FINAL_NOTICE'
                    ? `महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे ${printNotice.caseType === 'SEC_91' ? 'कलम ९१' : 'कलम १०१'} अन्वये अंतिम कायदेशीर मागणी नोटीस`
                    : `थकबाकी कर्ज वसुली मागणी नोटीस (${printNotice.noticeType === 'NOTICE_2' ? 'द्वितीय' : 'प्रथम'})`}
                </span>
              </div>

              <div className="flex justify-between text-xs text-slate-700 font-semibold">
                <div>जावक क्र.: {printNotice.noticeNumber}</div>
                <div>दिनांक: {printNotice.noticeDate}</div>
              </div>

              {/* Recipient Details */}
              <div className="text-xs text-slate-800 space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <strong>प्रति ({printNotice.recipientType === 'GUARANTOR_1' ? 'जामीनदार क्र. १' : printNotice.recipientType === 'GUARANTOR_2' ? 'जामीनदार क्र. २' : 'मुख्य कर्जदार'}):</strong>{' '}
                  {printNotice.customerName || printNotice.memberName}{' '}
                  {printNotice.cifNo ? <span className="font-mono text-[11px]">(CIF: {printNotice.cifNo})</span> : null}
                </div>
                <div><strong>पत्ता:</strong> {printNotice.address || '-'}</div>
                <div>
                  <strong>कर्ज खाते क्र.:</strong> {printNotice.loanAccountNo}
                  {printNotice.legacyLoanNo ? ` (${printNotice.legacyLoanNo})` : ''} | <strong>मोबाईल:</strong> {printNotice.mobileNo || '-'}
                </div>
              </div>

              {/* Notice Content Body */}
              <div className="text-xs text-slate-800 leading-relaxed space-y-3 text-justify">
                <p>महोदय / महोदया,</p>
                <p>
                  {printNotice.recipientType && printNotice.recipientType !== 'BORROWER'
                    ? `आपण कर्ज खाते क्र. ${printNotice.loanAccountNo} (${printNotice.memberName}) या कर्जास जामीनदार आहात. सदर कर्जाची परतफेड न झाल्यामुळे कर्जाच्या अटींनुसार मुख्य कर्जदारासमवेत आपणही थकबाकी भरण्यास संयुक्त व वैयक्तिकरीत्या जबाबदार आहात.`
                    : `आपण संस्थेकडून कर्ज खाते क्र. ${printNotice.loanAccountNo} अन्वये कर्ज घेतले होते. कर्जाच्या अटी व शर्तीनुसार आपण नियमित हप्ते भरणे बंधनकारक होते. परंतु वारंवार सूचना देऊनही आपण कर्जाची परतफेड केलेली नाही.`}
                </p>
                <p>सदर नोटीस दिनांकापर्यंत सदर खात्यावर खालीलप्रमाणे रक्कम थकीत आहे:</p>

                <table className="w-full border text-[11px] border-slate-300 leading-tight border-collapse">
                  <thead className="bg-[#5A1A14] font-bold text-amber-50">
                    <tr>
                      <th className="border px-2 py-1.5 text-left whitespace-nowrap">तपशील</th>
                      <th className="border px-2 py-1.5 text-right whitespace-nowrap">रक्कम (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border px-2 py-1 align-middle">१. थकीत मुद्दल (Principal Overdue)</td>
                      <td className="border px-2 py-1 text-right align-middle">₹{(printNotice.principalDue || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="border px-2 py-1 align-middle">२. थकीत नियमित व्याज (Interest Overdue)</td>
                      <td className="border px-2 py-1 text-right align-middle">₹{(printNotice.interestDue || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="border px-2 py-1 align-middle">३. दंडव्याज (Penal Interest)</td>
                      <td className="border px-2 py-1 text-right align-middle">₹{(printNotice.penalInterestDue || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="border px-2 py-1 align-middle">४. नोटीस व टपाल खर्च (Notice Fee)</td>
                      <td className="border px-2 py-1 text-right align-middle">₹{(printNotice.noticeFee || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="bg-rose-50 font-bold text-rose-900">
                      <td className="border px-2 py-1 align-middle">एकूण मागणी रक्कम (Total Demand)</td>
                      <td className="border px-2 py-1 text-right text-sm align-middle">₹{(printNotice.totalDemandAmount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>

                <p className="font-semibold text-rose-900">
                  तरी ही नोटीस मिळाल्यापासून दि. <strong>{printNotice.dueDate}</strong> पर्यंत वरील एकूण रक्कम ₹{(printNotice.totalDemandAmount || 0).toLocaleString('en-IN')} पुढील चालू व्याजासह संस्थेत भरून पावती घ्यावी.
                </p>
                <p>
                  मुदतीत रक्कम न भरल्यास, महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे{' '}
                  <strong>
                    {printNotice.caseType === 'SEC_91'
                      ? 'कलम ९१ अन्वये मा. सहकारी न्यायालयात लवाद दावा दाखल केला जाईल'
                      : 'कलम १०१ अन्वये मा. सहाय्यक/उपनिबंधक यांच्याकडे वसुली दाखला मिळवण्यासाठी दावा दाखल केला जाईल'}
                  </strong>
                  , तसेच नियम १०७ अन्वये स्थावर/जंगम मालमत्ता जप्ती व लिलाव कारवाई करण्यात येईल, याची नोंद घ्यावी.
                </p>
              </div>

              {/* Signature Block */}
              <div className="flex justify-between items-end pt-6 text-xs font-bold text-slate-800">
                <div className="space-y-0.5">
                  <p>टपाल पोहोच / RPAD: {printNotice.postalTrackingNo || 'हातोहात / स्पीड पोस्ट'}</p>
                  <p className="text-[10px] font-normal text-slate-600">
                    स्थिती: {POSTAL_STATUS_LABELS[printNotice.postalStatus]?.label || printNotice.postalStatus}
                  </p>
                </div>
                <div className="text-center space-y-6">
                  <p>आपला नम्र,</p>
                  <p>
                    शाखा व्यवस्थापक / मुख्य कार्यकारी अधिकारी
                    <br />
                    {sanstha?.sansthaNameMarathi || sanstha?.sansthaName || 'सहकारी पतसंस्था'}
                  </p>
                </div>
              </div>
            </div>

            {/* Print Action Buttons */}
            <div className="flex justify-end gap-3 p-4 border-t bg-slate-50 rounded-b-2xl print:hidden">
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> {downloadingPdf ? 'PDF तयार होत आहे...' : 'PDF डाउनलोड करा'}
              </button>
              <button
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" /> प्रिंट काढा
              </button>
              <button
                onClick={() => setPrintNotice(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-xl font-bold text-xs"
              >
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
