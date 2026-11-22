import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Printer,
  ChevronDown,
  ChevronRight,
  Search,
  ShieldCheck,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';
import BankLedgerSelect from './common/BankLedgerSelect';

interface NoticeOption {
  demandNoticeId: number;
  noticeNumber: string;
  month: number;
  year: number;
  demandDate: string;
  employerId: number;
  employerName: string;
  branchId: number;
  branchName: string;
  totalDemandAmount: number;
  totalRecoveredAmount: number;
  pendingAmount: number;
  pendingVoucherCount: number;
  memberCount: number;
  recoveredMemberCount: number;
  status: string;
}

interface AllocationItemPreview {
  demandMemberColumnItemId: number;
  sequenceOrder: number;
  subRowIndex: number;
  itemType: string;
  columnHeaderMr: string;
  displaySubLabel?: string | null;
  pendingAmount: number;
  allocatedPrincipalOrDeposit: number;
  allocatedInterest: number;
  totalAllocated: number;
  remainingAfter: number;
}

interface BulkMemberRow {
  demandNoticeId: number;
  noticeNumber: string;
  demandMemberDetailId: number;
  empCode: string;
  cifNo: string;
  memberName: string;
  totalDeduction: number;
  alreadyRecovered: number;
  pendingAmount: number;
  isSelected: boolean;
  actualReceivedAmount: number;
  items: AllocationItemPreview[];
}

interface RecoveryHistoryRow {
  demandRecoveryId: number;
  demandNoticeId: number;
  noticeNumber: string;
  employerName: string;
  branchName: string;
  recoveryDate: string;
  totalReceivedAmount: number;
  paymentMode: string;
  referenceNo?: string;
  recoveredMemberCount: number;
  voucherId?: number;
  voucherNo?: string;
  voucherStatus?: string;
  remarks?: string;
}

interface DemandRecoveryMasterProps {
  initialNoticeId?: number;
  onNavigate?: (tab: string, params?: any) => void;
}

const fmtDec = (v: number) =>
  Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DemandRecoveryMaster({ initialNoticeId, onNavigate }: DemandRecoveryMasterProps) {
  const { user } = useAuth();
  const activeBizStr = getBusinessDateStr(user?.businessDate);

  const [tab, setTab] = useState<'process' | 'history'>('process');
  const [notices, setNotices] = useState<NoticeOption[]>([]);
  const [selectedNoticeIds, setSelectedNoticeIds] = useState<number[]>(initialNoticeId ? [initialNoticeId] : []);
  const [memberRows, setMemberRows] = useState<BulkMemberRow[]>([]);
  const [expandedMemberIds, setExpandedMemberIds] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const [recoveryDate, setRecoveryDate] = useState<string>(activeBizStr);
  const [paymentMode, setPaymentMode] = useState<'Bank' | 'Cash'>('Bank');
  const [bankLedgerId, setBankLedgerId] = useState<number>(0);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [autoCreateThrift, setAutoCreateThrift] = useState<boolean>(true);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `DMD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const [history, setHistory] = useState<RecoveryHistoryRow[]>([]);
  const [receiptModal, setReceiptModal] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [valResult, setValResult] = useState<{ isValid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user?.businessDate) {
      setRecoveryDate(getBusinessDateStr(user.businessDate));
    }
  }, [user?.businessDate]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (initialNoticeId && initialNoticeId > 0) {
      setSelectedNoticeIds([initialNoticeId]);
    }
  }, [initialNoticeId]);

  useEffect(() => {
    loadSelectedNoticeMembers();
  }, [selectedNoticeIds]);

  const loadInitialData = async () => {
    try {
      const [nRes, hRes] = await Promise.all([
        axios.get('/api/DemandNotices'),
        axios.get('/api/DemandRecoveries')
      ]);
      const allNotices: NoticeOption[] = Array.isArray(nRes.data) ? nRes.data : [];
      setNotices(allNotices.filter((n) => n.status !== 'Cancelled' && n.status !== 'Received'));
      setHistory(Array.isArray(hRes.data) ? hRes.data : []);
    } catch (err) {
      console.error('Failed loading demand recovery data', err);
    }
  };

  const loadSelectedNoticeMembers = async () => {
    if (selectedNoticeIds.length === 0) {
      setMemberRows([]);
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setValResult(null);
    try {
      const allLoaded: BulkMemberRow[] = [];
      for (const nId of selectedNoticeIds) {
        const res = await axios.get(`/api/DemandNotices/${nId}/grid`);
        const noticeMeta = res.data?.notice;
        const rows = res.data?.rows || [];

        for (const r of rows) {
          if ((r.pendingAmount || 0) <= 0.009) continue;
          const items: AllocationItemPreview[] = (r.allItemsBySequence || [])
            .filter((x: any) => (x.pendingAmount || 0) > 0.009)
            .map((x: any) => ({
              demandMemberColumnItemId: x.demandMemberColumnItemId,
              sequenceOrder: x.sequenceOrder,
              subRowIndex: x.subRowIndex,
              itemType: x.itemType,
              columnHeaderMr: x.columnHeaderMr,
              displaySubLabel: x.displaySubLabel,
              pendingAmount: x.pendingAmount,
              allocatedPrincipalOrDeposit: Math.max(0, (x.demandPrincipalOrDeposit || 0) - (x.recoveredPrincipalOrDeposit || 0)),
              allocatedInterest: Math.max(0, (x.demandInterest || 0) + (x.demandPenalInterest || 0) - (x.recoveredInterest || 0) - (x.recoveredPenalInterest || 0)),
              totalAllocated: x.pendingAmount,
              remainingAfter: 0
            }));

          allLoaded.push({
            demandNoticeId: nId,
            noticeNumber: noticeMeta?.noticeNumber || '',
            demandMemberDetailId: r.demandMemberDetailId,
            empCode: r.empCode || '',
            cifNo: r.cifNo || '',
            memberName: r.memberName || '',
            totalDeduction: r.totalDeduction || 0,
            alreadyRecovered: r.recoveredAmount || 0,
            pendingAmount: r.pendingAmount || 0,
            isSelected: true,
            actualReceivedAmount: r.pendingAmount || 0,
            items
          });
        }
      }
      setMemberRows(allLoaded);
    } catch (err: any) {
      setErrorMsg(err.response?.data || 'प्रलंबित डिमान्ड सभासद यादी लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  // Live Sequence Waterfall Calculator (matches backend ComputeColumnAllocation logic!)
  const recomputeLocalSequenceWaterfall = (row: BulkMemberRow, received: number): AllocationItemPreview[] => {
    let pool = Math.max(0, Math.round(received * 100) / 100);
    return row.items.map((item) => {
      const pend = item.pendingAmount;
      const alloc = Math.min(pool, pend);
      pool = Math.max(0, Math.round((pool - alloc) * 100) / 100);
      return {
        ...item,
        totalAllocated: alloc,
        remainingAfter: Math.max(0, Math.round((pend - alloc) * 100) / 100)
      };
    });
  };

  const handleToggleNotice = (noticeId: number) => {
    setSelectedNoticeIds((prev) =>
      prev.includes(noticeId) ? prev.filter((id) => id !== noticeId) : [...prev, noticeId]
    );
  };

  const handleMemberAmountChange = (detailId: number, rawVal: string) => {
    const val = Math.max(0, Number(rawVal) || 0);
    setMemberRows((prev) =>
      prev.map((row) => {
        if (row.demandMemberDetailId !== detailId) return row;
        return {
          ...row,
          actualReceivedAmount: val,
          isSelected: val > 0 ? true : row.isSelected,
          items: recomputeLocalSequenceWaterfall(row, val)
        };
      })
    );
  };

  const handleToggleMember = (detailId: number, checked: boolean) => {
    setMemberRows((prev) =>
      prev.map((row) => {
        if (row.demandMemberDetailId !== detailId) return row;
        const amt = checked ? (row.actualReceivedAmount > 0 ? row.actualReceivedAmount : row.pendingAmount) : 0;
        return {
          ...row,
          isSelected: checked,
          actualReceivedAmount: amt,
          items: recomputeLocalSequenceWaterfall(row, amt)
        };
      })
    );
  };

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return memberRows;
    return memberRows.filter(
      (r) =>
        r.empCode.toLowerCase().includes(q) ||
        r.cifNo.toLowerCase().includes(q) ||
        r.memberName.toLowerCase().includes(q) ||
        r.noticeNumber.toLowerCase().includes(q)
    );
  }, [memberRows, searchQuery]);

  const totalBulkReceived = useMemo(
    () =>
      Math.round(
        memberRows
          .filter((r) => r.isSelected && r.actualReceivedAmount > 0)
          .reduce((s, r) => s + Number(r.actualReceivedAmount || 0), 0) * 100
      ) / 100,
    [memberRows]
  );

  const selectedMemberCount = useMemo(
    () => memberRows.filter((r) => r.isSelected && r.actualReceivedAmount > 0).length,
    [memberRows]
  );

  const buildBulkPayload = () => {
    const byNotice = new Map<number, BulkMemberRow[]>();
    for (const r of memberRows) {
      if (!r.isSelected || r.actualReceivedAmount <= 0) continue;
      const list = byNotice.get(r.demandNoticeId) || [];
      list.push(r);
      byNotice.set(r.demandNoticeId, list);
    }

    return {
      recoveryDate,
      paymentMode,
      bankLedgerID: paymentMode === 'Bank' ? (bankLedgerId || null) : null,
      referenceNo,
      remarks,
      autoCreateMissingThriftAccount: autoCreateThrift,
      idempotencyKey,
      notices: Array.from(byNotice.entries()).map(([demandNoticeId, members]) => ({
        demandNoticeId,
        members: members.map((m) => ({
          demandMemberDetailId: m.demandMemberDetailId,
          isSelected: m.isSelected,
          actualReceivedAmount: m.actualReceivedAmount
        }))
      }))
    };
  };

  const handleValidateBulk = async (): Promise<boolean> => {
    setErrorMsg('');
    setValidating(true);
    try {
      const res = await axios.post('/api/DemandRecoveries/validate-bulk', buildBulkPayload());
      setValResult(res.data);
      return Boolean(res.data?.isValid);
    } catch (err: any) {
      setErrorMsg(err.response?.data || 'बल्क तपासणी करताना त्रुटी आली.');
      return false;
    } finally {
      setValidating(false);
    }
  };

  const handleSubmitBulk = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    const ok = await handleValidateBulk();
    if (!ok) return;

    if (
      !window.confirm(
        `एकूण ${selectedMemberCount} कर्मचाऱ्यांची ₹${fmtDec(totalBulkReceived)} पगार वसुली नोंदवून पासिंगसाठी व्हाउचर तयार करायचे का?`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/DemandRecoveries/process-bulk', buildBulkPayload());
      setSuccessMsg(res.data?.message || 'बल्क पगार वसुली यशस्वीरीत्या नोंदवली गेली!');
      setIdempotencyKey(`DMD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      setValResult(null);
      await loadInitialData();
      await loadSelectedNoticeMembers();
    } catch (err: any) {
      const msg = err.response?.data;
      setErrorMsg(typeof msg === 'string' ? msg : 'बल्क वसुली जतन करताना त्रुटी आली.');
    } finally {
      setSubmitting(false);
    }
  };

  const openAllocationReceipt = async (recoveryId: number) => {
    try {
      const res = await axios.get(`/api/DemandRecoveries/allocation-receipt/${recoveryId}`);
      setReceiptModal(res.data);
    } catch (err: any) {
      alert(err.response?.data || 'वसुली पावती लोड करताना त्रुटी.');
    }
  };

  const printReceiptModal = () => {
    if (!receiptModal) return;
    const rec = receiptModal.recovery;
    const groups = receiptModal.memberGroups || [];
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) return;
    const rowsHtml = groups
      .map(
        (g: any, i: number) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td style="text-align:center">${g.empCode}</td>
          <td>${g.memberName} (${g.cifNo})</td>
          <td>
            ${(g.items || [])
              .map(
                (it: any) =>
                  `<div>[क्रम ${it.sequenceOrder}] <b>${it.displaySubLabel || it.columnHeaderMr}</b>: ₹${fmtDec(it.totalAllocated)}</div>`
              )
              .join('')}
          </td>
          <td style="text-align:right;font-weight:bold">₹${fmtDec(g.totalAllocated)}</td>
        </tr>
      `
      )
      .join('');

    win.document.write(`
      <html><head><title>बल्क वसुली पावती - ${rec.voucherNo}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 18px; }
        h2, h4 { text-align: center; margin: 3px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #334155; padding: 5px; vertical-align: top; }
        th { background: #e2e8f0; }
      </style></head><body>
      <h2>पगारदार पतसंस्था — बल्क डिमान्ड वसुली पोचपावती (Allocation Register)</h2>
      <h4>नोटीस: ${rec.noticeNumber} | नियोक्ता: ${rec.employerName} | व्हाउचर क्र.: ${rec.voucherNo} | दिनांक: ${(rec.recoveryDate || '').split('T')[0]}</h4>
      <table>
        <thead><tr><th>अ.नं.</th><th>Emp Code</th><th>खातेदाराचे नाव</th><th>Sequence नुसार जमा तपशील</th><th>एकूण जमा</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold">एकूण वसुली (${rec.recoveredMemberCount} कर्मचारी):</td><td style="text-align:right;font-weight:bold">₹${fmtDec(rec.totalReceivedAmount)}</td></tr></tfoot>
      </table>
      <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="p-2 max-w-[1400px] mx-auto font-sans text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b-2 border-primary">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary text-white">
            <Banknote size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">
              बल्क पगार डिमान्ड वसुली (Bulk Salary Demand Recovery)
            </h1>
            <p className="text-[11px] text-slate-500">
              जतन केलेल्या डिमान्ड नोटीसेसवर पूर्ण किंवा कर्मचारी-निहाय कमी पगाराची Sequence प्राधान्याप्रमाणे एकत्रित वसुली
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('process')}
            className={`px-3 py-1 rounded font-bold cursor-pointer ${
              tab === 'process' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            बल्क वसुली नोंदवा
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-3 py-1 rounded font-bold cursor-pointer ${
              tab === 'history' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            वसुली इतिहास व पावत्या ({history.length})
          </button>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('demand-notice')}
              className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 font-semibold cursor-pointer"
            >
              ← डिमांड फॉर्म
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-2 p-2 rounded border border-red-300 bg-red-50 text-red-800 font-semibold flex items-center gap-1.5">
          <AlertTriangle size={15} /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-2 p-2 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold flex items-center gap-1.5">
          <CheckCircle2 size={15} /> {successMsg}
        </div>
      )}

      {tab === 'process' ? (
        <div className="space-y-3">
          {/* Step 1: Select Saved Notice(s) & Payment Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Notice Picker */}
            <div className="lg:col-span-5 bg-white border border-slate-300 rounded p-2.5 shadow-2xs">
              <div className="font-bold text-primary mb-1.5 border-b pb-1">
                १. प्रलंबित डिमान्ड नोटीस निवडा (१ किंवा अधिक Bulk Batch)
              </div>
              {notices.length === 0 ? (
                <div className="text-slate-500 py-4 text-center">कोणतीही प्रलंबित डिमान्ड नोटीस उपलब्ध नाही.</div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {notices.map((n) => {
                    const checked = selectedNoticeIds.includes(n.demandNoticeId);
                    return (
                      <label
                        key={n.demandNoticeId}
                        className={`flex items-center justify-between p-1.5 rounded border cursor-pointer ${
                          checked ? 'border-primary bg-blue-50/70' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleNotice(n.demandNoticeId)}
                            className="w-4 h-4 accent-primary"
                          />
                          <div>
                            <div className="font-bold text-slate-800">
                              {n.employerName} — <span className="font-mono text-primary">{n.noticeNumber}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {n.branchName} | खातेदार बाकी: {n.memberCount - n.recoveredMemberCount}/{n.memberCount}
                              {n.pendingVoucherCount > 0 && (
                                <span className="ml-2 px-1 rounded bg-red-100 text-red-700 font-bold">
                                  ⚠️ {n.pendingVoucherCount} Pending Voucher
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-rose-700">₹{fmtDec(n.pendingAmount)}</div>
                          <div className="text-[10px] text-slate-500">एकूण: ₹{fmtDec(n.totalDemandAmount)}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment Header */}
            <div className="lg:col-span-7 bg-white border border-slate-300 rounded p-2.5 shadow-2xs space-y-2">
              <div className="font-bold text-primary border-b pb-1">
                २. बँक / रोख पावती तपशील (Consolidated Receipt Voucher)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">वसुली दिनांक (CBS Date) *</label>
                  <input
                    type="date"
                    value={recoveryDate}
                    onChange={(e) => setRecoveryDate(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">पेमेंट प्रकार *</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as 'Bank' | 'Cash')}
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-semibold"
                  >
                    <option value="Bank">बँक जमा (Bank / NEFT / Cheque)</option>
                    <option value="Cash">रोख जमा (Cash)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">संदर्भ क्र. (Cheque / UTR)</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="उदा. UTR / CHQ-12345"
                    className="w-full border border-slate-300 rounded px-2 py-1"
                  />
                </div>
              </div>

              {paymentMode === 'Bank' && (
                <div>
                  <BankLedgerSelect
                    value={bankLedgerId}
                    onChange={(id) => setBankLedgerId(id)}
                    label="जमा होणारे बँक खाते निवडा (Debit Bank GL) *"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-emerald-800">
                  <input
                    type="checkbox"
                    checked={autoCreateThrift}
                    onChange={(e) => setAutoCreateThrift(e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span>नवीन कर्मचाऱ्यांचे 'संजीवनी ठेव' खाते नसल्यास आपोआप उघडा</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">एकूण बल्क प्राप्त रक्कम:</span>
                  <span className="px-3 py-1 rounded bg-yellow-100 border border-yellow-400 font-mono font-bold text-sm text-red-800">
                    ₹{fmtDec(totalBulkReceived)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {valResult && (
            <div
              className={`p-2.5 rounded border text-xs ${
                valResult.isValid
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              <div className="font-bold mb-1">
                {valResult.isValid ? '✓ बल्क वसुली तपासणी यशस्वी!' : '⚠️ खालील त्रुटी दुरुस्त करा:'}
              </div>
              {valResult.errors.map((e, i) => (
                <div key={i} className="text-red-800">• {e}</div>
              ))}
              {valResult.warnings.map((w, i) => (
                <div key={i} className="text-amber-800">• {w}</div>
              ))}
            </div>
          )}

          {/* Member-wise Editable Bulk Table */}
          <div className="bg-white border border-slate-300 rounded shadow-sm">
            <div className="p-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">
                  ३. कर्मचारी-निहाय प्रत्यक्ष वसुली रक्कम ({selectedMemberCount}/{memberRows.length} निवडलेले)
                </span>
                <div className="flex items-center gap-1 border border-slate-300 rounded bg-white px-2 py-0.5">
                  <Search size={13} className="text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Emp Code / नाव शोधा..."
                    className="text-xs focus:outline-none w-40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleValidateBulk}
                  disabled={validating || memberRows.length === 0}
                  className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <ShieldCheck size={14} /> {validating ? 'तपासत आहे...' : 'बल्क तपासणी'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitBulk}
                  disabled={submitting || selectedMemberCount === 0}
                  className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow cursor-pointer disabled:opacity-40"
                >
                  {submitting
                    ? 'प्रोसेस होत आहे...'
                    : `बल्क वसुली जतन करा (₹${fmtDec(totalBulkReceived)})`}
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-[450px]">
              {loading ? (
                <div className="p-8 text-center text-slate-500">सभासद वसुली यादी लोड होत आहे...</div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  वरील यादीतून किमान एक प्रलंबित डिमान्ड नोटीस निवडा.
                </div>
              ) : (
                <table className="min-w-full border-collapse text-xs">
                  <thead className="bg-primary text-white sticky top-0 z-10">
                    <tr>
                      <th className="border border-slate-400/40 px-2 py-1.5 w-10 text-center">✓</th>
                      <th className="border border-slate-400/40 px-2 py-1.5 w-24 text-left">नोटीस क्र.</th>
                      <th className="border border-slate-400/40 px-2 py-1.5 w-20 text-center">Emp Code</th>
                      <th className="border border-slate-400/40 px-2 py-1.5 text-left">खातेदाराचे नाव (CIF)</th>
                      <th className="border border-slate-400/40 px-2 py-1.5 w-28 text-right">शिल्लक डिमान्ड</th>
                      <th className="border border-slate-400/40 px-2 py-1.5 w-36 text-right">प्रत्यक्ष पगार कपात ₹</th>
                      <th className="border border-slate-400/40 px-2 py-1.5 w-44 text-center">Sequence वाटप</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((row) => {
                      const isExpanded = !!expandedMemberIds[row.demandMemberDetailId];
                      const isShort = row.isSelected && row.actualReceivedAmount < row.pendingAmount - 0.01;
                      return (
                        <React.Fragment key={row.demandMemberDetailId}>
                          <tr className={`${isShort ? 'bg-amber-50/70' : 'bg-white'} hover:bg-blue-50/30`}>
                            <td className="border border-slate-200 px-2 py-1 text-center">
                              <input
                                type="checkbox"
                                checked={row.isSelected}
                                onChange={(e) => handleToggleMember(row.demandMemberDetailId, e.target.checked)}
                                className="w-3.5 h-3.5 accent-primary"
                              />
                            </td>
                            <td className="border border-slate-200 px-2 py-1 font-mono text-[10px]">
                              {row.noticeNumber}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-center font-mono">{row.empCode}</td>
                            <td className="border border-slate-200 px-2 py-1 font-semibold">
                              {row.memberName} <span className="text-[10px] text-slate-500">({row.cifNo})</span>
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-right font-mono font-semibold">
                              ₹{fmtDec(row.pendingAmount)}
                            </td>
                            <td className="border border-slate-200 p-1">
                              <input
                                type="number"
                                min={0}
                                max={row.pendingAmount}
                                step="1"
                                disabled={!row.isSelected}
                                value={row.actualReceivedAmount}
                                onChange={(e) => handleMemberAmountChange(row.demandMemberDetailId, e.target.value)}
                                className={`w-full px-2 py-0.5 text-right font-mono font-bold border rounded ${
                                  isShort ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-300'
                                }`}
                              />
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedMemberIds((p) => ({
                                    ...p,
                                    [row.demandMemberDetailId]: !p[row.demandMemberDetailId]
                                  }))
                                }
                                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                वाटप पहा ({row.items.length})
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50">
                              <td colSpan={7} className="border border-slate-200 px-4 py-2">
                                <div className="text-[10px] font-bold text-primary mb-1">
                                  डिमांड सेटिंग्ज SequenceOrder प्राधान्यक्रमानुसार वसुली वाटप प्रीव्ह्यू:
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  {row.items.map((it) => (
                                    <div
                                      key={it.demandMemberColumnItemId}
                                      className="p-1.5 rounded border border-slate-300 bg-white flex items-center justify-between text-[11px]"
                                    >
                                      <div>
                                        <span className="font-bold text-primary mr-1">#{it.sequenceOrder}</span>
                                        <span className="font-semibold">
                                          {it.displaySubLabel || it.columnHeaderMr}
                                          {it.subRowIndex > 0 && (
                                            <span className="ml-1 text-[9px] px-1 rounded bg-indigo-100 text-indigo-800">
                                              RD Sub-Row
                                            </span>
                                          )}
                                        </span>
                                        <div className="text-[10px] text-slate-500">
                                          बाकी: ₹{fmtDec(it.pendingAmount)} | नंतर शिल्लक: ₹{fmtDec(it.remainingAfter)}
                                        </div>
                                      </div>
                                      <div className="font-mono font-bold text-emerald-700">
                                        +₹{fmtDec(it.totalAllocated)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="bg-white border border-slate-300 rounded shadow-sm overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-primary text-white">
              <tr>
                <th className="border border-slate-400/40 px-2 py-2 text-left">दिनांक</th>
                <th className="border border-slate-400/40 px-2 py-2 text-left">व्हाउचर क्र.</th>
                <th className="border border-slate-400/40 px-2 py-2 text-left">नोटीस / नियोक्ता</th>
                <th className="border border-slate-400/40 px-2 py-2 text-center">पद्धत</th>
                <th className="border border-slate-400/40 px-2 py-2 text-center">कर्मचारी</th>
                <th className="border border-slate-400/40 px-2 py-2 text-right">प्राप्त रक्कम</th>
                <th className="border border-slate-400/40 px-2 py-2 text-center">व्हाउचर स्थिती</th>
                <th className="border border-slate-400/40 px-2 py-2 text-center">पावती / प्रिंट</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">अद्याप कोणतीही वसुली नोंद आढळली नाही.</td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.demandRecoveryId} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-2 py-1.5 font-mono">{(h.recoveryDate || '').split('T')[0]}</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-mono font-bold text-primary">
                      {h.voucherNo || '-'}
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5">
                      <span className="font-semibold">{h.employerName}</span>{' '}
                      <span className="text-[10px] text-slate-500">({h.noticeNumber})</span>
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 text-center">{h.paymentMode}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-center font-bold">{h.recoveredMemberCount}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-right font-mono font-bold text-emerald-700">
                      ₹{fmtDec(h.totalReceivedAmount)}
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          h.voucherStatus === 'Approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {h.voucherStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="border border-slate-200 px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => openAllocationReceipt(h.demandRecoveryId)}
                        className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Printer size={12} /> तपशील / प्रिंट
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Allocation Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="bg-white rounded shadow-xl border border-slate-300 w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-primary text-white">
              <div className="font-bold">
                वसुली पोचपावती तपशील — व्हाउचर: {receiptModal.recovery?.voucherNo}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printReceiptModal}
                  className="px-2.5 py-1 rounded bg-white text-primary font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={13} /> प्रिंट
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptModal(null)}
                  className="p-1 hover:bg-white/20 rounded cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="p-3 overflow-auto flex-1">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-300 px-2 py-1 text-center">Emp Code</th>
                    <th className="border border-slate-300 px-2 py-1 text-left">खातेदाराचे नाव</th>
                    <th className="border border-slate-300 px-2 py-1 text-left">Sequence नुसार जमा तपशील</th>
                    <th className="border border-slate-300 px-2 py-1 text-right">एकूण जमा</th>
                  </tr>
                </thead>
                <tbody>
                  {(receiptModal.memberGroups || []).map((g: any) => (
                    <tr key={g.demandMemberDetailId}>
                      <td className="border border-slate-300 px-2 py-1 text-center font-mono">{g.empCode}</td>
                      <td className="border border-slate-300 px-2 py-1 font-semibold">{g.memberName}</td>
                      <td className="border border-slate-300 px-2 py-1 space-y-0.5">
                        {(g.items || []).map((it: any) => (
                          <div key={it.demandRecoveryAllocationId} className="text-[11px]">
                            <span className="font-bold text-primary">#{it.sequenceOrder}</span>{' '}
                            {it.displaySubLabel || it.columnHeaderMr}:{' '}
                            <span className="font-mono font-semibold">₹{fmtDec(it.totalAllocated)}</span>
                          </div>
                        ))}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-emerald-700">
                        ₹{fmtDec(g.totalAllocated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
