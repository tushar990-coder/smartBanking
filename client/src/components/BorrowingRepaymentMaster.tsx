import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Printer,
  ShieldCheck,
  Unlock,
  ArrowRight,
  X
} from 'lucide-react';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';
import BankLedgerSelect from './common/BankLedgerSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';

interface BorrowingRepaymentMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const fmtAmt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN');
};

export default function BorrowingRepaymentMaster({ onNavigate }: BorrowingRepaymentMasterProps) {
  const { user } = useAuth();
  const activeBizDate = getBusinessDateStr(user?.businessDate);
  const searchParams = new URLSearchParams(window.location.search);
  const urlBorrowingId = Number(
    searchParams.get('borrowingId') || searchParams.get('entityId') || searchParams.get('id') || 0
  );
  const urlVoucherId = Number(searchParams.get('voucherId') || 0);
  const isPassingMode = searchParams.get('passingMode') === 'true' && urlVoucherId > 0;

  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [ownLockers, setOwnLockers] = useState<any[]>([]);
  const [externalLockers, setExternalLockers] = useState<any[]>([]);
  const [sansthaName, setSansthaName] = useState('पतसंस्था मर्यादित');

  const [selectedBorrowingId, setSelectedBorrowingId] = useState<number>(urlBorrowingId);
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Checker Passing Mode state
  const [passingData, setPassingData] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [passingBusy, setPassingBusy] = useState(false);

  // Print Modal state
  const [printRepayment, setPrintRepayment] = useState<any | null>(null);

  const [form, setForm] = useState({
    repaymentDate: activeBizDate,
    repaymentType: 'RegularEMI' as 'RegularEMI' | 'PartPayment' | 'InterestOnly' | 'Foreclosure',
    principalPaid: '',
    interestPaid: '',
    penalOrChargesPaid: '0',
    chargesLedgerID: '',
    paymentMode: 'Bank' as 'Bank' | 'Cash',
    bankLedgerID: 0,
    referenceNo: '',
    remarks: '',
    closeAccount: false,
    releaseGoldCustodyIds: [] as number[],
    returnCustodyStatus: 'BRANCH_SAFE' as 'BRANCH_SAFE' | 'OWN_LOCKER' | 'EXTERNAL_LOCKER',
    returnOwnLockerID: '',
    returnExternalLockerID: ''
  });

  useEffect(() => {
    axios
      .get('/api/SansthaDetails')
      .then((r) => {
        const row = Array.isArray(r.data) ? r.data[0] : r.data;
        if (row?.sansthaName) setSansthaName(row.sansthaName);
      })
      .catch(() => {});

    if (isPassingMode) {
      loadCheckerVoucher(urlVoucherId);
    } else {
      loadAll();
    }
  }, [isPassingMode, urlVoucherId]);

  const loadCheckerVoucher = async (vId: number) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/Borrowings/by-voucher/${vId}`);
      setPassingData(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data || 'व्हाउचर माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async (keepSelectedId?: number) => {
    setLoading(true);
    try {
      const [mstRes, brwRes] = await Promise.all([
        axios.get('/api/Borrowings/masters'),
        axios.get('/api/Borrowings', { params: { status: 'all' } })
      ]);
      setLedgers(mstRes.data?.ledgers || []);
      setOwnLockers(mstRes.data?.ownLockers || []);
      setExternalLockers(mstRes.data?.externalLockers || []);

      const allItems = brwRes.data?.items || [];
      setBorrowings(allItems);

      const activeItems = allItems.filter((b: any) => b.status === 'Active');
      const targetId = keepSelectedId || urlBorrowingId || activeItems[0]?.borrowingID || 0;
      if (targetId > 0) {
        setSelectedBorrowingId(targetId);
        await fetchRepaymentPreview(targetId, form.repaymentDate, 'RegularEMI');
      }
    } catch (err) {
      toast.error('बाह्य कर्ज माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRepaymentPreview = async (
    borrowingId: number,
    asOfDate: string,
    repayTypeOverride?: 'RegularEMI' | 'PartPayment' | 'InterestOnly' | 'Foreclosure'
  ) => {
    if (!borrowingId) return;
    setPreviewLoading(true);
    try {
      const res = await axios.get(`/api/Borrowings/${borrowingId}/repayment-preview`, {
        params: { asOfDate }
      });
      const data = res.data;
      setPreview(data);

      const effType = repayTypeOverride || form.repaymentType;
      applyTypeAmounts(effType, data);
    } catch (err) {
      toast.error('हप्ता व व्याज कॅल्क्युलेशन लोड करताना त्रुटी आली.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const applyTypeAmounts = (
    type: 'RegularEMI' | 'PartPayment' | 'InterestOnly' | 'Foreclosure',
    previewData: any
  ) => {
    if (!previewData) return;
    if (type === 'RegularEMI') {
      setForm((prev) => ({
        ...prev,
        repaymentType: type,
        principalPaid: String(previewData.suggestedRegularPrincipal ?? 0),
        interestPaid: String(previewData.suggestedRegularInterest ?? 0),
        closeAccount: false
      }));
    } else if (type === 'InterestOnly') {
      setForm((prev) => ({
        ...prev,
        repaymentType: type,
        principalPaid: '0',
        interestPaid: String(previewData.accruedInterest ?? 0),
        closeAccount: false
      }));
    } else if (type === 'Foreclosure') {
      setForm((prev) => ({
        ...prev,
        repaymentType: type,
        principalPaid: String(previewData.foreclosurePrincipal ?? previewData.outstandingPrincipal ?? 0),
        interestPaid: String(previewData.foreclosureInterest ?? previewData.accruedInterest ?? 0),
        closeAccount: true
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        repaymentType: type,
        closeAccount: false
      }));
    }
  };

  const selectedAccount = useMemo(
    () => borrowings.find((b) => b.borrowingID === selectedBorrowingId) || null,
    [borrowings, selectedBorrowingId]
  );

  const activeAccountOptions = useMemo<SearchableSelectOption[]>(() => {
    return borrowings
      .filter((b) => b.status === 'Active')
      .map((b) => ({
        value: String(b.borrowingID),
        label: `${b.borrowingNo} — ${b.lenderName}${b.externalLoanAccountNo ? ` (A/c: ${b.externalLoanAccountNo})` : ''}`,
        subLabel: `येणे मुद्दल: ₹${fmtAmt(b.outstandingPrincipal)} • दर: ${b.borrowingInterestRate}% • हप्ता: ₹${fmtAmt(b.installmentAmount)}`,
        badge: b.overdueEmiCount > 0 ? `${b.overdueEmiCount} थकीत` : 'Active'
      }));
  }, [borrowings]);

  const chargesLedgerOptions = useMemo<SearchableSelectOption[]>(() => {
    return ledgers
      .filter((l) => {
        const acct = (l.accountType || '').toLowerCase();
        if (acct.includes('cash') || acct.includes('bank')) return false;
        const nature = (l.nature || '').toLowerCase();
        return nature.includes('expense') || l.groupName?.includes('खर्च') || !nature;
      })
      .map((l) => ({
        value: String(l.ledgerID),
        label: `${l.ledgerCode ? `${l.ledgerCode} - ` : ''}${l.ledgerName}`,
        subLabel: l.groupName || '',
        badge: 'Expense GL'
      }));
  }, [ledgers]);

  const prinNum = Math.max(0, Number(form.principalPaid) || 0);
  const intNum = Math.max(0, Number(form.interestPaid) || 0);
  const penNum = Math.max(0, Number(form.penalOrChargesPaid) || 0);
  const totalPayable = Number((prinNum + intNum + penNum).toFixed(2));
  const outstandingBefore = Number(selectedAccount?.outstandingPrincipal || preview?.outstandingPrincipal || 0);
  const balanceAfter = Math.max(0, Number((outstandingBefore - prinNum).toFixed(2)));
  const willCloseAccount =
    balanceAfter <= 0.009 &&
    selectedAccount &&
    (selectedAccount.borrowingType !== 'CASH_CREDIT_OD' || form.closeAccount);

  const activeGoldPledges = useMemo(
    () => (selectedAccount?.goldPledges || []).filter((p: any) => p.pledgeStatus === 'Pledged'),
    [selectedAccount]
  );

  const handleQuickPayScheduleRow = (row: any) => {
    const remPrin = Math.max(0, Number((row.principalDue - row.principalPaid).toFixed(2)));
    const remInt = Math.max(0, Number((row.interestDue - row.interestPaid).toFixed(2)));
    setForm((prev) => ({
      ...prev,
      repaymentType: 'RegularEMI',
      principalPaid: String(Math.min(remPrin, outstandingBefore)),
      interestPaid: String(remInt),
      remarks: `हप्ता क्र. #${row.installmentNo} (देय: ${fmtDate(row.dueDate)}) भरणा`
    }));
    toast.success(`हप्ता क्र. #${row.installmentNo} ची देय रक्कम फॉर्ममध्ये भरली आहे.`);
  };

  const toggleGoldRelease = (goldCustodyId: number) => {
    setForm((prev) => {
      const exists = prev.releaseGoldCustodyIds.includes(goldCustodyId);
      return {
        ...prev,
        releaseGoldCustodyIds: exists
          ? prev.releaseGoldCustodyIds.filter((id) => id !== goldCustodyId)
          : [...prev.releaseGoldCustodyIds, goldCustodyId]
      };
    });
  };

  const handleSubmitRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) {
      toast.error('कृपया सक्रिय बाह्य कर्ज खाते निवडा.');
      return;
    }
    if (totalPayable <= 0) {
      toast.error('परतफेडीची एकूण रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.');
      return;
    }
    if (prinNum > outstandingBefore + 0.01) {
      toast.error(`मुद्दल परतफेड (₹${fmtAmt(prinNum)}) ही येणे मुद्दल बाकीपेक्षा (₹${fmtAmt(outstandingBefore)}) जास्त असू शकत नाही.`);
      return;
    }
    if (form.paymentMode === 'Bank' && !form.bankLedgerID) {
      toast.error('बँक पेमेंट मोडसाठी संस्थेचे बँक खाते निवडा.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        repaymentDate: form.repaymentDate,
        repaymentType: form.repaymentType,
        principalPaid: prinNum,
        interestPaid: intNum,
        penalOrChargesPaid: penNum,
        chargesLedgerID: form.chargesLedgerID ? Number(form.chargesLedgerID) : null,
        paymentMode: form.paymentMode,
        bankLedgerID: form.paymentMode === 'Bank' ? form.bankLedgerID : null,
        referenceNo: form.referenceNo.trim() || null,
        remarks: form.remarks.trim() || null,
        closeAccount: willCloseAccount || form.closeAccount,
        releaseGoldCustodyIds: willCloseAccount
          ? activeGoldPledges.map((p: any) => p.goldCustodyID)
          : form.releaseGoldCustodyIds,
        returnCustodyStatus: form.returnCustodyStatus,
        returnOwnLockerID:
          form.returnCustodyStatus === 'OWN_LOCKER' && form.returnOwnLockerID
            ? Number(form.returnOwnLockerID)
            : null,
        returnExternalLockerID:
          form.returnCustodyStatus === 'EXTERNAL_LOCKER' && form.returnExternalLockerID
            ? Number(form.returnExternalLockerID)
            : null
      };

      const res = await axios.post(`/api/Borrowings/${selectedAccount.borrowingID}/repay`, payload);
      toast.success(res.data?.message || 'बाह्य कर्ज हप्ता परतफेड यशस्वीरीत्या जतन झाली!');

      // Prepare print slip immediately
      setPrintRepayment({
        repaymentNo: res.data?.repaymentNo || 'RPY-NEW',
        voucherNo: res.data?.voucherNo || '',
        repaymentDate: form.repaymentDate,
        repaymentType: form.repaymentType,
        installmentsCovered: res.data?.installmentsCovered || '',
        principalPaid: prinNum,
        interestPaid: intNum,
        penalOrChargesPaid: penNum,
        totalPaid: totalPayable,
        balanceBeforeRepayment: outstandingBefore,
        balanceAfterRepayment: res.data?.remainingPrincipal ?? balanceAfter,
        paymentMode: form.paymentMode,
        referenceNo: form.referenceNo,
        remarks: form.remarks,
        borrowingNo: selectedAccount.borrowingNo,
        lenderName: selectedAccount.lenderName,
        externalLoanAccountNo: selectedAccount.externalLoanAccountNo
      });

      setForm((prev) => ({
        ...prev,
        penalOrChargesPaid: '0',
        referenceNo: '',
        remarks: '',
        releaseGoldCustodyIds: []
      }));

      await loadAll(res.data?.isClosed ? undefined : selectedAccount.borrowingID);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data || 'हप्ता परतफेड जतन करताना त्रुटी आली.';
      toast.error(typeof msg === 'string' ? msg : 'हप्ता परतफेड जतन करताना त्रुटी आली.');
    } finally {
      setSubmitting(false);
    }
  };

  // Checker Approve / Reject handlers
  const handleCheckerApprove = async () => {
    if (!passingData?.voucher?.voucherID) return;
    setPassingBusy(true);
    try {
      await axios.post('/api/VoucherPosting/Post', {
        voucherIds: [passingData.voucher.voucherID],
        approvedBy: user?.userID || 1,
        businessDate: activeBizDate
      });
      toast.success(`व्हाउचर क्र. ${passingData.voucher.voucherNo} यशस्वीरीत्या पास (Approved) केले!`);
      await loadCheckerVoucher(passingData.voucher.voucherID);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data || 'व्हाउचर पास करताना त्रुटी आली.';
      toast.error(typeof msg === 'string' ? msg : 'व्हाउचर पास करताना त्रुटी आली.');
    } finally {
      setPassingBusy(false);
    }
  };

  const handleCheckerReject = async () => {
    if (!passingData?.voucher?.voucherID) return;
    if (!rejectReason.trim()) {
      toast.error('कृपया व्हाउचर नाकारण्याचे / रद्द करण्याचे कारण लिहा.');
      return;
    }
    if (!window.confirm('खात्री आहे का? हे व्हाउचर रद्द केल्यास बाह्य कर्ज खाते, हप्ता वेळापत्रक व सोने कस्टडी मूळ स्थितीत पूर्ववत (Lossless Rollback) होईल!')) {
      return;
    }
    setPassingBusy(true);
    try {
      const res = await axios.delete(`/api/VoucherPosting/${passingData.voucher.voucherID}`, {
        params: { reason: rejectReason.trim() }
      });
      toast.success(res.data?.message || 'व्हाउचर रद्द करून खाते पूर्ववत केले!');
      if (onNavigate) onNavigate('vouchers');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data || 'व्हाउचर रद्द करताना त्रुटी आली.';
      toast.error(typeof msg === 'string' ? msg : 'व्हाउचर रद्द करताना त्रुटी आली.');
    } finally {
      setPassingBusy(false);
    }
  };

  // ============================================================================
  // RENDER CHECKER PASSING INSPECTION VIEW
  // ============================================================================
  if (isPassingMode) {
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-amber-700" />
            <div>
              <h2 className="text-base font-bold text-amber-950">
                मेकर-चेकर व्हाउचर पडताळणी — बाह्य कर्ज विभाग (Checker Passing View)
              </h2>
              <p className="text-xs text-amber-800">
                व्यवहार व लेजर नोंदी तपासून व्हाउचर मंजूर (Pass) करा किंवा कारणासह रद्द (Lossless Rollback) करा.
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('vouchers')}
              className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-900 hover:bg-amber-100"
            >
              ← व्हाउचर पासिंगकडे परत
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border p-8 text-center text-sm text-slate-500">लोड होत आहे...</div>
        ) : !passingData ? (
          <div className="bg-white rounded-xl border p-8 text-center text-sm text-rose-600">
            या व्हाउचरशी संलग्न बाह्य कर्ज व्यवहार सापडला नाही.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <div className="text-slate-500">व्यवहार प्रकार</div>
                <div className="font-bold text-indigo-700">
                  {passingData.transactionType === 'Disbursement' ? 'बाह्य कर्ज उचल (Disbursement)' : 'हप्ता परतफेड (Repayment)'}
                </div>
              </div>
              <div>
                <div className="text-slate-500">बाह्य कर्ज खाते</div>
                <div className="font-bold text-slate-800">
                  {passingData.borrowing?.borrowingNo} — {passingData.borrowing?.lenderName}
                </div>
              </div>
              <div>
                <div className="text-slate-500">व्हाउचर क्र. व तारीख</div>
                <div className="font-bold text-slate-800">
                  {passingData.voucher?.voucherNo} ({fmtDate(passingData.voucher?.voucherDate)})
                </div>
              </div>
              <div>
                <div className="text-slate-500">व्हाउचर स्थिती</div>
                <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                  {passingData.voucher?.status}
                </span>
              </div>
            </div>

            <div className="text-xs bg-indigo-50/50 border border-indigo-100 rounded-lg p-3">
              <div className="font-bold text-indigo-900 mb-1">तपशील (Narration):</div>
              <div className="text-slate-700">{passingData.voucher?.narration}</div>
            </div>

            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left px-3 py-2">जनरल लेजर खाते (GL Ledger)</th>
                  <th className="text-right px-3 py-2">नावे (Debit ₹)</th>
                  <th className="text-right px-3 py-2">जमा (Credit ₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(passingData.voucher?.voucherDetails || []).map((vd: any) => (
                  <tr key={vd.voucherDetailID}>
                    <td className="px-3 py-2 font-medium text-slate-800">{vd.ledgerName}</td>
                    <td className="px-3 py-2 text-right font-semibold text-rose-700">
                      {vd.drCr === 'Dr' ? fmtAmt(vd.amount) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                      {vd.drCr === 'Cr' ? fmtAmt(vd.amount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {passingData.voucher?.canPass && (
              <div className="pt-3 border-t border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="रद्द करायचे असल्यास कारण लिहा..."
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    disabled={passingBusy}
                    onClick={handleCheckerReject}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> नाकारा व पूर्ववत करा
                  </button>
                </div>
                <button
                  type="button"
                  disabled={passingBusy}
                  onClick={handleCheckerApprove}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> व्हाउचर मंजूर व पास करा (Approve)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER MAKER REPAYMENT & EMI TRACKER VIEW
  // ============================================================================
  const schedules: any[] = preview?.schedules || selectedAccount?.installmentSchedules || [];
  const pastRepayments: any[] = selectedAccount?.repayments || [];

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              ३. कर्ज हप्ता भरणा व वेळापत्रक (Loan Repaid & EMI Schedule Tracker)
            </h1>
            <p className="text-xs text-slate-500">
              बाह्य बँक / पतसंस्थेच्या कर्जाचे मासिक हप्ते (EMIs), जमा व्याज, आगाऊ भरणा व पूर्ण परतफेड (Foreclosure)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onNavigate && selectedAccount && (
            <button
              type="button"
              onClick={() => onNavigate('borrowing-reports', { borrowingId: selectedAccount.borrowingID, subTab: 'ledger' })}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold"
            >
              📖 खाते खतावणी पाहा
            </button>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('borrowing-dashboard')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
            >
              ← डॅशबोर्ड
            </button>
          )}
        </div>
      </div>

      {/* Account Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              सक्रिय बाह्य कर्ज खाते निवडा (Active Borrowing Account) *
            </label>
            <SearchableSelect
              options={activeAccountOptions}
              value={selectedBorrowingId ? String(selectedBorrowingId) : ''}
              onChange={(val) => {
                const id = Number(val);
                setSelectedBorrowingId(id);
                setForm((prev) => ({ ...prev, releaseGoldCustodyIds: [] }));
                if (id > 0) fetchRepaymentPreview(id, form.repaymentDate, 'RegularEMI');
              }}
              placeholder="कर्ज क्र., बँक नाव किंवा बाह्य खाते क्रमांकाने शोधा..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              परतफेड तारीख (Repayment Date) *
            </label>
            <input
              type="date"
              value={form.repaymentDate}
              onChange={(e) => {
                const dt = e.target.value;
                setForm((prev) => ({ ...prev, repaymentDate: dt }));
                if (selectedBorrowingId > 0 && dt) {
                  fetchRepaymentPreview(selectedBorrowingId, dt);
                }
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
            />
          </div>
        </div>

        {/* Account Summary KPI Strip */}
        {selectedAccount && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-500">मंजूर / उचल रक्कम</div>
              <div className="text-xs font-bold text-slate-800">₹{fmtAmt(selectedAccount.disbursedAmount)}</div>
              <div className="text-[10px] text-slate-500">मंजूर: ₹{fmtAmt(selectedAccount.sanctionedAmount)}</div>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5">
              <div className="text-[11px] text-rose-700 font-medium">येणे मुद्दल बाकी</div>
              <div className="text-sm font-black text-rose-900">₹{fmtAmt(selectedAccount.outstandingPrincipal)}</div>
              <div className="text-[10px] text-rose-700">व्याजदर: {selectedAccount.borrowingInterestRate}% द.सा.द.शे.</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <div className="text-[11px] text-amber-800 font-medium">आजपर्यंत चढलेले व्याज</div>
              <div className="text-sm font-black text-amber-900">
                ₹{fmtAmt(preview?.accruedInterest ?? selectedAccount.accruedInterestToday)}
              </div>
              <div className="text-[10px] text-amber-700">
                {preview?.accruedDays ?? selectedAccount.accruedDays ?? 0} दिवस ({fmtDate(preview?.interestFromDate)})
              </div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
              <div className="text-[11px] text-indigo-700 font-medium">ठरलेला हप्ता (EMI)</div>
              <div className="text-sm font-black text-indigo-900">₹{fmtAmt(selectedAccount.installmentAmount)}</div>
              <div className="text-[10px] text-indigo-700">
                {selectedAccount.installmentType} • {selectedAccount.installmentFrequency}
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              <div className="text-[11px] text-emerald-700 font-medium">हप्ते प्रगती</div>
              <div className="text-sm font-black text-emerald-900">
                {schedules.filter((s) => s.status === 'Paid').length} / {schedules.length} पूर्ण
              </div>
              <div className="text-[10px] text-emerald-700">एकूण व्याज दिले: ₹{fmtAmt(selectedAccount.totalInterestPaid)}</div>
            </div>
            <div
              className={`border rounded-lg p-2.5 ${
                (preview?.overdueCount || 0) > 0
                  ? 'bg-red-50 border-red-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-[11px] text-slate-600 font-medium">थकीत हप्ते (Overdue)</div>
              <div className="text-sm font-black text-red-700">
                {preview?.overdueCount || 0} हप्ते
              </div>
              <div className="text-[10px] text-red-700">
                ₹{fmtAmt((preview?.overduePrincipal || 0) + (preview?.overdueInterest || 0))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedAccount && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT 7 COLS: INTERACTIVE EMI SCHEDULE TABLE */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-800">
                  📅 कर्ज हप्ता वेळापत्रक (Installment / EMI Tracking Schedule)
                </h2>
                <p className="text-[11px] text-slate-500">
                  कोणत्याही थकीत/देय हप्त्यावरील "भरा" बटनावर क्लिक करून रक्कम फॉर्ममध्ये घ्या
                </p>
              </div>
              {previewLoading && <span className="text-[11px] text-indigo-600 font-semibold">गणना सुरू...</span>}
            </div>

            {schedules.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                या खात्यासाठी हप्ता वेळापत्रक लागू नाही (उदा. CC / OD मर्यादा किंवा उचल बाकी). थेट उजवीकडील फॉर्ममधून मुद्दल/व्याज परतफेड नोंदवा.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-2.5 py-2 text-left">#</th>
                      <th className="px-2.5 py-2 text-left">देय तारीख</th>
                      <th className="px-2.5 py-2 text-right">मुद्दल देय</th>
                      <th className="px-2.5 py-2 text-right">व्याज देय</th>
                      <th className="px-2.5 py-2 text-right">एकूण हप्ता</th>
                      <th className="px-2.5 py-2 text-right">भरलेले</th>
                      <th className="px-2.5 py-2 text-right">बाकी देय</th>
                      <th className="px-2.5 py-2 text-center">स्थिती</th>
                      <th className="px-2.5 py-2 text-center">कृती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedules.map((row: any) => {
                      const paidSum = Number(row.principalPaid || 0) + Number(row.interestPaid || 0);
                      const remDue =
                        row.remainingDue ??
                        row.remainingInstallmentDue ??
                        Math.max(0, Number(row.totalInstallmentAmount || 0) - paidSum);

                      const badgeCls =
                        row.status === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : row.status === 'Overdue'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : row.status === 'Partial'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200';

                      const statusMr =
                        row.status === 'Paid'
                          ? 'पूर्ण भरला'
                          : row.status === 'Overdue'
                          ? 'थकीत'
                          : row.status === 'Partial'
                          ? 'अंशतः'
                          : 'येणे बाकी';

                      return (
                        <tr
                          key={row.scheduleID || row.installmentNo}
                          className={
                            row.status === 'Overdue'
                              ? 'bg-rose-50/40 hover:bg-rose-50'
                              : row.status === 'Paid'
                              ? 'bg-emerald-50/20'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="px-2.5 py-2 font-bold text-slate-800">#{row.installmentNo}</td>
                          <td className="px-2.5 py-2 font-medium text-slate-700">
                            <div>{fmtDate(row.dueDate)}</div>
                            {row.paidDate && (
                              <div className="text-[10px] text-emerald-700">भरणा: {fmtDate(row.paidDate)}</div>
                            )}
                          </td>
                          <td className="px-2.5 py-2 text-right">₹{fmtAmt(row.principalDue)}</td>
                          <td className="px-2.5 py-2 text-right">₹{fmtAmt(row.interestDue)}</td>
                          <td className="px-2.5 py-2 text-right font-bold text-slate-900">
                            ₹{fmtAmt(row.totalInstallmentAmount)}
                          </td>
                          <td className="px-2.5 py-2 text-right text-emerald-700 font-semibold">
                            {paidSum > 0 ? `₹${fmtAmt(paidSum)}` : '—'}
                          </td>
                          <td className="px-2.5 py-2 text-right font-bold text-rose-700">
                            {remDue > 0 ? `₹${fmtAmt(remDue)}` : '₹0.00'}
                          </td>
                          <td className="px-2.5 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeCls}`}>
                              {statusMr}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 text-center">
                            {row.status !== 'Paid' ? (
                              <button
                                type="button"
                                onClick={() => handleQuickPayScheduleRow(row)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded text-[10px] font-bold"
                              >
                                भरा →
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-bold">✓</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT 5 COLS: REPAYMENT ENTRY FORM */}
          <form
            onSubmit={handleSubmitRepayment}
            className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3.5"
          >
            <div className="border-b border-slate-200 pb-2.5">
              <h2 className="text-xs font-bold text-slate-900">
                💳 हप्ता / कर्ज परतफेड नोंदणी (Record Borrowing Repayment)
              </h2>
              <p className="text-[11px] text-slate-500">
                बँकेने आकारलेल्या प्रत्यक्ष व्याजाप्रमाणे तुम्ही खालील मुद्दल व व्याज रक्कम संपादित करू शकता
              </p>
            </div>

            {/* Repayment Type Pills */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">परतफेड प्रकार (Repayment Type)</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'RegularEMI', label: 'नियमित हप्ता (Regular EMI)' },
                  { id: 'PartPayment', label: 'आगाऊ मुद्दल (Part Payment)' },
                  { id: 'InterestOnly', label: 'फक्त व्याज (Interest Only)' },
                  { id: 'Foreclosure', label: 'पूर्ण परतफेड (Foreclosure)' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => applyTypeAmounts(opt.id as any, preview)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border text-left transition ${
                      form.repaymentType === opt.id
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  मुद्दल परतफेड (Principal ₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.principalPaid}
                  onChange={(e) => setForm((prev) => ({ ...prev, principalPaid: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  व्याज परतफेड (Interest ₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.interestPaid}
                  onChange={(e) => setForm((prev) => ({ ...prev, interestPaid: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  दंड / इतर बँक शुल्क (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.penalOrChargesPaid}
                  onChange={(e) => setForm((prev) => ({ ...prev, penalOrChargesPaid: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>
              {penNum > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    दंड/शुल्क खर्च लेजर (Optional)
                  </label>
                  <SearchableSelect
                    options={chargesLedgerOptions}
                    value={form.chargesLedgerID}
                    onChange={(v) => setForm((prev) => ({ ...prev, chargesLedgerID: v }))}
                    placeholder="डिफॉल्ट व्याज/शुल्क लेजर..."
                  />
                </div>
              )}
            </div>

            {/* Payment Mode */}
            <div className="space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">पेमेंट मोड (Payment Mode) *</span>
                <div className="flex gap-2">
                  {(['Bank', 'Cash'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, paymentMode: m }))}
                      className={`px-3 py-1 rounded text-[11px] font-bold border ${
                        form.paymentMode === m
                          ? 'bg-indigo-600 text-white border-indigo-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {m === 'Bank' ? '🏦 बँक / NEFT / RTGS' : '💵 रोख (Cash)'}
                    </button>
                  ))}
                </div>
              </div>

              {form.paymentMode === 'Bank' && (
                <BankLedgerSelect
                  value={form.bankLedgerID}
                  onChange={(id) => setForm((prev) => ({ ...prev, bankLedgerID: id }))}
                  label="संस्थेचे बँक खाते निवडा (Credited Bank GL) *"
                />
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={form.referenceNo}
                  onChange={(e) => setForm((prev) => ({ ...prev, referenceNo: e.target.value }))}
                  placeholder="UTR / चेक क्र. / पावती क्र."
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                />
                <input
                  type="text"
                  value={form.remarks}
                  onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="शेरा / Remarks"
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                />
              </div>

              {selectedAccount.borrowingType === 'CASH_CREDIT_OD' && balanceAfter <= 0.009 && (
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 pt-1">
                  <input
                    type="checkbox"
                    checked={form.closeAccount}
                    onChange={(e) => setForm((prev) => ({ ...prev, closeAccount: e.target.checked }))}
                  />
                  CC/OD खाते कायमस्वरूपी बंद करा (Close CC/OD Limit)
                </label>
              )}
            </div>

            {/* Gold Packet Release Options when GOLD_REPLEDGE has pledged packets */}
            {activeGoldPledges.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1">
                    <Unlock className="w-3.5 h-3.5" /> पुनर्गहाण सोने पाकीट सुटका ({activeGoldPledges.length} पाकिटे गहाण)
                  </span>
                  {willCloseAccount && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      खाते बंद होताच सर्व पाकिटे आपोआप सुटतील!
                    </span>
                  )}
                </div>

                {!willCloseAccount && (
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {activeGoldPledges.map((p: any) => (
                      <label
                        key={p.goldCustodyID}
                        className="flex items-center justify-between bg-white px-2 py-1 rounded border border-amber-200 text-[11px]"
                      >
                        <span className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={form.releaseGoldCustodyIds.includes(p.goldCustodyID)}
                            onChange={() => toggleGoldRelease(p.goldCustodyID)}
                          />
                          <span className="font-bold">{p.packetNumber}</span> — {p.borrowerName} ({fmtWt(p.netWeight)} ग्रॅम)
                        </span>
                        {p.loanStatus === 'Closed' && (
                          <span className="text-[10px] font-bold text-rose-700">मूळ कर्ज बंद!</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}

                {(willCloseAccount || form.releaseGoldCustodyIds.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <select
                      value={form.returnCustodyStatus}
                      onChange={(e) => setForm((prev) => ({ ...prev, returnCustodyStatus: e.target.value as any }))}
                      className="border border-amber-300 rounded px-2 py-1 text-xs bg-white font-semibold"
                    >
                      <option value="BRANCH_SAFE">संस्थेची मुख्य तिजोरी (Branch Safe)</option>
                      <option value="OWN_LOCKER">संस्थेचा स्वतःचा लॉकर (Own Locker)</option>
                      <option value="EXTERNAL_LOCKER">बाह्य बँक लॉकर (External Locker)</option>
                    </select>
                    {form.returnCustodyStatus === 'OWN_LOCKER' && (
                      <select
                        value={form.returnOwnLockerID}
                        onChange={(e) => setForm((prev) => ({ ...prev, returnOwnLockerID: e.target.value }))}
                        className="border border-amber-300 rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="">-- लॉकर निवडा --</option>
                        {ownLockers.map((l: any) => (
                          <option key={l.lockerID} value={l.lockerID}>
                            {l.lockerNo} ({l.cabinetNo || 'Main'})
                          </option>
                        ))}
                      </select>
                    )}
                    {form.returnCustodyStatus === 'EXTERNAL_LOCKER' && (
                      <select
                        value={form.returnExternalLockerID}
                        onChange={(e) => setForm((prev) => ({ ...prev, returnExternalLockerID: e.target.value }))}
                        className="border border-amber-300 rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="">-- बाह्य लॉकर निवडा --</option>
                        {externalLockers.map((l: any) => (
                          <option key={l.externalLockerID} value={l.externalLockerID}>
                            {l.bankOrSansthaName} — {l.lockerNumber}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Live Balanced Voucher Preview */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between font-bold text-emerald-950">
                <span>एकूण देय पेमेंट (Total Payment):</span>
                <span className="text-sm font-black text-emerald-800">₹{fmtAmt(totalPayable)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>परतफेडीनंतर उरणारी मुद्दल बाकी:</span>
                <span className="font-bold flex items-center gap-1">
                  ₹{fmtAmt(outstandingBefore)} <ArrowRight className="w-3 h-3" /> ₹{fmtAmt(balanceAfter)}
                  {willCloseAccount && (
                    <span className="ml-1 px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px]">
                      खाते पूर्ण बंद होईल
                    </span>
                  )}
                </span>
              </div>
              <div className="pt-1 border-t border-emerald-200/80 text-[10px] text-slate-600 space-y-0.5">
                {prinNum > 0 && (
                  <div className="flex justify-between">
                    <span>Dr. {selectedAccount.liabilityLedgerName || 'बाह्य कर्ज देणे खाते'}</span>
                    <span className="font-semibold">₹{fmtAmt(prinNum)}</span>
                  </div>
                )}
                {intNum + penNum > 0 && (
                  <div className="flex justify-between">
                    <span>Dr. {selectedAccount.interestExpenseLedgerName || 'बाह्य कर्ज व्याज खर्च खाते'}</span>
                    <span className="font-semibold">₹{fmtAmt(intNum + penNum)}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Cr. {form.paymentMode === 'Bank' ? 'निवडलेले बँक खाते' : 'रोख खाते (Cash)'}</span>
                  <span>₹{fmtAmt(totalPayable)}</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || totalPayable <= 0}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {submitting
                ? 'परतफेड जतन होत आहे...'
                : willCloseAccount
                ? `✓ ₹${fmtAmt(totalPayable)} भरून बाह्य कर्ज खाते पूर्ण बंद करा`
                : `✓ ₹${fmtAmt(totalPayable)} हप्ता / परतफेड व्हाउचर जतन करा`}
            </button>
          </form>
        </div>
      )}

      {/* Past Repayments History */}
      {selectedAccount && pastRepayments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">
              📜 यापूर्वी केलेले हप्ता भरणा / परतफेड व्यवहार ({pastRepayments.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">परतफेड क्र.</th>
                  <th className="px-3 py-2 text-left">तारीख</th>
                  <th className="px-3 py-2 text-left">प्रकार / हप्ते</th>
                  <th className="px-3 py-2 text-right">मुद्दल (₹)</th>
                  <th className="px-3 py-2 text-right">व्याज व शुल्क (₹)</th>
                  <th className="px-3 py-2 text-right">एकूण भरणा (₹)</th>
                  <th className="px-3 py-2 text-left">मोड / व्हाउचर</th>
                  <th className="px-3 py-2 text-center">पावती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastRepayments.map((r: any) => (
                  <tr key={r.borrowingRepaymentID} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-bold text-slate-800">{r.repaymentNo || `#${r.borrowingRepaymentID}`}</td>
                    <td className="px-3 py-2">{fmtDate(r.repaymentDate)}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-indigo-700">{r.repaymentType}</span>
                      {r.installmentsCovered && (
                        <div className="text-[10px] text-emerald-700 font-semibold">{r.installmentsCovered}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">₹{fmtAmt(r.principalPaid)}</td>
                    <td className="px-3 py-2 text-right">
                      ₹{fmtAmt(Number(r.interestPaid || 0) + Number(r.penalOrChargesPaid || 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-800">₹{fmtAmt(r.totalPaid)}</td>
                    <td className="px-3 py-2 text-[11px]">
                      <div>{r.paymentMode} {r.referenceNo ? `(${r.referenceNo})` : ''}</div>
                      <div className="text-slate-500">
                        {r.voucherNo} • <span className="font-semibold">{r.voucherStatus}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setPrintRepayment({
                            ...r,
                            borrowingNo: selectedAccount.borrowingNo,
                            lenderName: selectedAccount.lenderName,
                            externalLoanAccountNo: selectedAccount.externalLoanAccountNo
                          })
                        }
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" /> प्रिंट
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Repayment Advice / Voucher Modal */}
      {printRepayment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <span className="text-xs font-bold">बाह्य कर्ज परतफेड पेमेंट अ‍ॅडव्हाईस (Repayment Advice)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> प्रिंट करा
                </button>
                <button type="button" onClick={() => setPrintRepayment(null)} className="text-slate-300 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-900">
              <div className="text-center border-b-2 border-slate-800 pb-3">
                <div className="text-base font-black">{sansthaName}</div>
                <div className="text-xs font-bold text-slate-600 mt-0.5">
                  बाह्य बँक / पतसंस्था कर्ज हप्ता परतफेड व्हाउचर (Borrowing Repayment Advice)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded border border-slate-300">
                <div><strong>परतफेड क्र.:</strong> {printRepayment.repaymentNo}</div>
                <div><strong>तारीख:</strong> {fmtDate(printRepayment.repaymentDate)}</div>
                <div><strong>संस्था कर्ज क्र.:</strong> {printRepayment.borrowingNo}</div>
                <div><strong>व्हाउचर क्र.:</strong> {printRepayment.voucherNo || '—'}</div>
                <div className="col-span-2">
                  <strong>बँक / पतसंस्था:</strong> {printRepayment.lenderName}{' '}
                  {printRepayment.externalLoanAccountNo ? `(बाह्य खाते क्र.: ${printRepayment.externalLoanAccountNo})` : ''}
                </div>
                {printRepayment.installmentsCovered && (
                  <div className="col-span-2 text-emerald-800 font-bold">
                    समाविष्ट हप्ते: {printRepayment.installmentsCovered}
                  </div>
                )}
              </div>

              <table className="w-full border border-slate-400 text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-300 px-3 py-1.5 text-left">तपशील</th>
                    <th className="border border-slate-300 px-3 py-1.5 text-right">रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 px-3 py-1.5">मुद्दल परतफेड (Principal Repaid)</td>
                    <td className="border border-slate-300 px-3 py-1.5 text-right font-semibold">
                      ₹{fmtAmt(printRepayment.principalPaid)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 px-3 py-1.5">व्याज परतफेड (Interest Paid)</td>
                    <td className="border border-slate-300 px-3 py-1.5 text-right font-semibold">
                      ₹{fmtAmt(printRepayment.interestPaid)}
                    </td>
                  </tr>
                  {Number(printRepayment.penalOrChargesPaid || 0) > 0 && (
                    <tr>
                      <td className="border border-slate-300 px-3 py-1.5">दंड / बँक शुल्क (Charges)</td>
                      <td className="border border-slate-300 px-3 py-1.5 text-right font-semibold">
                        ₹{fmtAmt(printRepayment.penalOrChargesPaid)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 font-black">
                    <td className="border border-slate-300 px-3 py-2">एकूण अदा केलेली रक्कम (Total Paid)</td>
                    <td className="border border-slate-300 px-3 py-2 text-right text-sm">
                      ₹{fmtAmt(printRepayment.totalPaid)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-between text-[11px] text-slate-700">
                <span>पेमेंट मोड: <strong>{printRepayment.paymentMode}</strong> {printRepayment.referenceNo ? `(${printRepayment.referenceNo})` : ''}</span>
                <span>उर्वरित मुद्दल बाकी: <strong>₹{fmtAmt(printRepayment.balanceAfterRepayment)}</strong></span>
              </div>

              <div className="pt-8 grid grid-cols-3 text-center text-[11px] font-semibold text-slate-700">
                <div>तयार करणार (Maker)</div>
                <div>तपासणार (Accountant)</div>
                <div>शाखा व्यवस्थापक (Manager)</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
