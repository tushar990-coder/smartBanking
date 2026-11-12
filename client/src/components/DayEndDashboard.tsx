import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldAlert, CheckCircle2, Lock, Unlock, Play,
  AlertTriangle, Building2, Calendar, Banknote,
  FileSpreadsheet, RotateCcw, ArrowRight, RefreshCw, History
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCachedMasterData } from '../utils/apiCache';

interface Branch {
  branchID: number;
  branchCode: string;
  branchName: string;
  branchType: string;
}

const formatDisplayDate = (dateVal?: string | Date | null): string => {
  if (!dateVal) return '—';
  const str = typeof dateVal === 'string' ? dateVal.split('T')[0] : dateVal.toISOString().split('T')[0];
  const parts = str.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return new Date(dateVal).toLocaleDateString('en-GB');
};

const formatDateInput = (dateVal?: string | Date | null): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') return dateVal.split('T')[0];
  return dateVal.toISOString().split('T')[0];
};

const addOneDayStr = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const DayEndDashboard: React.FC = () => {
  const { user, updateBusinessDate } = useAuth();

  const fallbackBranch: Branch = {
    branchID: user?.branchID || 1,
    branchCode: '001',
    branchName: user?.branchName || 'मुख्य शाखा (Main Branch)',
    branchType: user?.branchType || 'HeadOffice'
  };

  const [branches, setBranches] = useState<Branch[]>(() => {
    const cached = getCachedMasterData<Branch[]>('/api/Branches');
    return Array.isArray(cached) && cached.length > 0 ? cached : [fallbackBranch];
  });
  const [selectedBranchId, setSelectedBranchId] = useState<number>(user?.branchID || 1);

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [eodRunning, setEodRunning] = useState(false);
  const [revokeRunning, setRevokeRunning] = useState(false);
  const [initialDateInput, setInitialDateInput] = useState<string>('');
  const [settingInitialDate, setSettingInitialDate] = useState(false);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isHeadOfficeOrAdmin =
    user?.role === 'Admin' ||
    user?.role === 'SuperAdmin' ||
    user?.role === 'HeadOffice' ||
    user?.role === 'HO_Manager' ||
    user?.branchType === 'HeadOffice' ||
    user?.branchID === 1;

  const canManageDayEnd =
    isHeadOfficeOrAdmin ||
    user?.role === 'BranchManager';

  useEffect(() => {
    axios
      .get('/api/Branches')
      .then(res => {
        const data = res.data;
        const list: Branch[] = Array.isArray(data) ? data : data?.value || [];
        if (list.length > 0) setBranches(list);
      })
      .catch(() => {});
  }, [user?.token]);

  const fetchDayEndData = async (branchId: number, syncHeaderDate = false) => {
    setLoading(true);
    try {
      const statusRes = await fetch(`/api/EodOperations/status/${branchId}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const activeDateStr = formatDateInput(statusData.businessDate || statusData.BusinessDate);

        // Sync 1:1 with VoucherPosting/Unposted for the active business date so both screens always match 100%
        if (activeDateStr) {
          try {
            const unpostedRes = await fetch(
              `/api/VoucherPosting/Unposted?branchId=${branchId}&voucherDate=${activeDateStr}&allDates=false`,
              { headers: { Authorization: `Bearer ${user?.token}` } }
            );
            if (unpostedRes.ok) {
              const unpostedList = await unpostedRes.json();
              if (Array.isArray(unpostedList)) {
                const exactForActiveDate = unpostedList.filter((v: any) => {
                  const vNo = v.voucherNo || v.VoucherNo || '';
                  const vType = (v.voucherType || v.VoucherType || '').toLowerCase();
                  const narr = (v.narration || v.Narration || '').toLowerCase();
                  const vDate = formatDateInput(v.voucherDate || v.VoucherDate);
                  if (vDate !== activeDateStr) return false;
                  if (
                    vType === 'opening' ||
                    narr.includes('आरंभिक शिल्लक') ||
                    narr.includes('opening balance migration') ||
                    narr.includes('import') ||
                    vNo.includes('-OP-') ||
                    vNo.includes('-IMP-') ||
                    vNo.startsWith('JV-FD-OP-') ||
                    vNo.startsWith('REC-FD-OP-') ||
                    vNo.startsWith('JV-RD-OP-') ||
                    vNo.startsWith('REC-RD-OP-') ||
                    vNo.startsWith('JV-SH-OP-') ||
                    vNo.startsWith('JV-INV-OP-')
                  ) {
                    return false;
                  }
                  return true;
                });
                statusData.unpostedVouchers = exactForActiveDate.length;
                statusData.UnpostedVouchers = exactForActiveDate.length;
              }
            }
          } catch {}
        }

        setStatus(statusData);

        if (activeDateStr) {
          setInitialDateInput(activeDateStr);
        }
        if (syncHeaderDate && activeDateStr && branchId === (user?.branchID || 1)) {
          updateBusinessDate(activeDateStr);
        }
      }
    } catch (err) {
      console.error('Error fetching EOD status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBranchId) {
      fetchDayEndData(selectedBranchId, false);
    }
  }, [selectedBranchId]);

  const activeBusinessDateStr =
    formatDateInput(status?.businessDate || status?.BusinessDate) || formatDateInput(user?.businessDate);
  const nextSequentialDateStr =
    formatDateInput(status?.nextSequentialDate || status?.NextSequentialDate) ||
    addOneDayStr(activeBusinessDateStr);
  const lastClosedDateStr = formatDateInput(status?.lastClosedDate || status?.LastClosedDate);
  const isLastClosedDateInClosedFy = Boolean(
    status?.isLastClosedDateInClosedFy ?? status?.IsLastClosedDateInClosedFy
  );
  const lastClosedDateFyCode =
    status?.lastClosedDateFyCode || status?.LastClosedDateFyCode || '';
  const isDayClosed = Boolean(status?.isDayClosed ?? status?.IsDayClosed);

  const unpostedVouchers = Number(status?.unpostedVouchers ?? status?.UnpostedVouchers ?? 0);

  const cashTally = status?.cashTally || status?.CashTally || {};
  const openingCash = Number(cashTally.opening ?? cashTally.Opening ?? 0);
  const todayReceipts = Number(cashTally.todayReceipts ?? cashTally.TodayReceipts ?? 0);
  const todayPayments = Number(cashTally.todayPayments ?? cashTally.TodayPayments ?? 0);
  const closingCash = Number(cashTally.closing ?? cashTally.Closing ?? 0);
  const expectedClosingCash = openingCash + todayReceipts - todayPayments;
  const isCashTallied =
    Boolean(cashTally.isPositive ?? cashTally.IsPositive ?? closingCash >= 0) &&
    closingCash >= 0 &&
    Math.abs(expectedClosingCash - closingCash) < 0.01;

  const transferTally = status?.transferTally || status?.TransferTally || {};
  const transferDebit = Number(transferTally.debit ?? transferTally.Debit ?? 0);
  const transferCredit = Number(transferTally.credit ?? transferTally.Credit ?? 0);
  const transferDiff = Math.abs(transferDebit - transferCredit);
  const isTransferTallied = Boolean(transferTally.isMatched ?? transferTally.IsMatched ?? transferDiff < 0.01);

  const isVouchersClear = unpostedVouchers === 0;
  const isAllTallied = isVouchersClear && isCashTallied && isTransferTallied;

  const loggedInDateStr = formatDateInput(user?.businessDate);
  const hasPendingOlderDayEnd =
    Boolean(activeBusinessDateStr && loggedInDateStr && activeBusinessDateStr < loggedInDateStr);

  const handleRunEod = async () => {
    if (!isAllTallied) return;

    const currentDisplay = formatDisplayDate(activeBusinessDateStr);
    const nextDisplay = formatDisplayDate(nextSequentialDateStr);

    if (
      !window.confirm(
        `तुम्हाला दिनांक ${currentDisplay} चा दिवस अखेर (Day End) करून पुढील तारीख ${nextDisplay} सुरू करायची आहे का?`
      )
    ) {
      return;
    }

    setEodRunning(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/EodOperations/close-day/${selectedBranchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          nextBusinessDate: nextSequentialDateStr || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          type: 'success',
          text: data.message || data.Message || `दिनांक ${currentDisplay} चा दिवस अखेर पूर्ण झाला!`
        });
        await fetchDayEndData(selectedBranchId, true);
      } else {
        setActionMessage({
          type: 'error',
          text: data.message || data.Message || 'दिवस अखेर करताना त्रुटी आली.'
        });
        await fetchDayEndData(selectedBranchId, false);
      }
    } catch {
      setActionMessage({ type: 'error', text: 'सर्व्हरशी संपर्क होऊ शकला नाही.' });
    } finally {
      setEodRunning(false);
    }
  };

  const handleRevokeDayEnd = async () => {
    const targetRevokeDisplay = lastClosedDateStr ? formatDisplayDate(lastClosedDateStr) : 'मागील बंद दिवस';

    if (isLastClosedDateInClosedFy) {
      setActionMessage({
        type: 'error',
        text: `दिनांक ${targetRevokeDisplay} ही तारीख बंद झालेल्या आर्थिक वर्षात (${lastClosedDateFyCode || 'Closed FY'}) येते. आर्थिक वर्ष बंद असल्यामुळे या दिवसाचा Day End रद्द (Revoke) करता येणार नाही.`
      });
      return;
    }

    if (
      !window.confirm(
        `तुम्हाला दिनांक ${targetRevokeDisplay} चा दिवस अखेर रद्द (Revoke Day End) करून तो दिवस पुन्हा उघडायचा आहे का?`
      )
    ) {
      return;
    }

    setRevokeRunning(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/EodOperations/unlock-day/${selectedBranchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          reason: `Day End Revoked for ${targetRevokeDisplay}`
        })
      });

      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          type: 'success',
          text: data.message || data.Message || `दिनांक ${targetRevokeDisplay} चा दिवस पुन्हा उघडण्यात आला आहे!`
        });
        await fetchDayEndData(selectedBranchId, true);
      } else {
        setActionMessage({
          type: 'error',
          text: data.message || data.Message || 'दिवस पुन्हा उघडताना त्रुटी आली.'
        });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'सर्व्हरशी संपर्क होऊ शकला नाही.' });
    } finally {
      setRevokeRunning(false);
    }
  };

  const handleSetInitialStartDate = async () => {
    if (!initialDateInput) return;
    const targetDisplay = formatDisplayDate(initialDateInput);
    if (
      !window.confirm(
        `तुम्हाला प्रारंभिक दिवस अखेर तारीख ${targetDisplay} निश्चित करायची आहे का?`
      )
    ) {
      return;
    }

    setSettingInitialDate(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/EodOperations/initialize-golive-date/${selectedBranchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          goLiveDate: initialDateInput,
          reason: 'Initial Start Date Set'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          type: 'success',
          text: data.message || data.Message || `प्रारंभिक तारीख ${targetDisplay} सेट करण्यात आली!`
        });
        await fetchDayEndData(selectedBranchId, true);
      } else {
        setActionMessage({
          type: 'error',
          text: data.message || data.Message || 'तारीख सेट करताना त्रुटी आली.'
        });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'सर्व्हरशी संपर्क होऊ शकला नाही.' });
    } finally {
      setSettingInitialDate(false);
    }
  };

  const selectedBranchName =
    branches.find(b => b.branchID === selectedBranchId)?.branchName ||
    cashTally.branchName ||
    cashTally.BranchName ||
    user?.branchName ||
    'मुख्य शाखा (Main Branch)';

  return (
    <div className="p-2.5 sm:p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs text-slate-800">
      {/* 1. TOP HEADER BANNER (Soft Multi-Tone Slate-Blue-Indigo Gradient with Crisp Border) */}
      <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-indigo-50 px-3.5 py-2.5 rounded-sm shadow-xs border-2 border-slate-300 border-b-4 border-b-primary flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-indigo-100 border border-indigo-400 flex items-center justify-center text-indigo-900 shadow-2xs shrink-0">
            <Lock className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>बिझनेस डेट व दिवस अखेर नियंत्रण</span>
              <span className="text-xs font-semibold text-indigo-800 hidden sm:inline">
                (Day End Control)
              </span>
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              कॅश व ट्रान्सफर बॅलन्स टॅली तपासून क्रमाने दिवस अखेर (Day End) करा किंवा बंद दिवस पुन्हा उघडा (Revoke)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isHeadOfficeOrAdmin ? (
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-sm border border-indigo-400 shadow-2xs h-7">
              <Building2 className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <select
                value={selectedBranchId}
                onChange={e => {
                  setSelectedBranchId(Number(e.target.value));
                  setActionMessage(null);
                }}
                className="bg-transparent text-slate-900 font-semibold text-xs focus:outline-none cursor-pointer pr-1"
              >
                {branches.map(b => (
                  <option key={b.branchID} value={b.branchID} className="text-slate-900 bg-white">
                    {b.branchName} {b.branchCode ? `(${b.branchCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-sm border border-indigo-400 text-xs font-semibold text-slate-900 shadow-2xs h-7">
              <Building2 className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <span>{selectedBranchName}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchDayEndData(selectedBranchId, false)}
            disabled={loading}
            title="ताजे करा (Refresh)"
            className="px-2.5 py-1 rounded-sm bg-white hover:bg-indigo-50 border border-indigo-400 text-indigo-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition h-7 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-700 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश</span>
          </button>
        </div>
      </div>

      {/* Warning if user logged in on a later date while an earlier date is still not closed */}
      {hasPendingOlderDayEnd && (
        <div className="bg-amber-100/90 border-2 border-amber-400 border-l-4 border-l-amber-600 px-3.5 py-2.5 rounded-sm flex items-start gap-2.5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 leading-relaxed">
            <span className="font-bold">
              महत्त्वाची सूचना: दिनांक {formatDisplayDate(activeBusinessDateStr)} पासून दिवस अखेर (Day End) बाकी आहे!
            </span>{' '}
            तुम्ही दिनांक <strong>{formatDisplayDate(loggedInDateStr)}</strong> निवडून लॉगिन केले असले, तरी प्रथम{' '}
            <strong>{formatDisplayDate(activeBusinessDateStr)}</strong> चा दिवस अखेर पूर्ण केल्याशिवाय पुढील तारखेवर (
            <strong>{formatDisplayDate(nextSequentialDateStr)}</strong>) जाता येणार नाही.
          </div>
        </div>
      )}

      {/* Action Feedback Message */}
      {actionMessage && (
        <div
          className={`px-3.5 py-2 rounded-sm border-2 border-l-4 flex items-center justify-between gap-2 text-xs font-semibold shadow-2xs ${
            actionMessage.type === 'success'
              ? 'bg-emerald-100/90 border-emerald-400 border-l-emerald-700 text-emerald-950'
              : 'bg-rose-100/90 border-rose-400 border-l-rose-700 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold px-1.5 py-0.5 rounded-sm hover:bg-black/10 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* GROUP BOX 1: Active Business Date & Sequential Status (Indigo Top Accent + 3 Distinct Color Cards) */}
      <div className="bg-white rounded-sm shadow-xs border-2 border-slate-300 border-t-4 border-t-indigo-600 overflow-hidden">
        <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 flex justify-between items-center">
          <h2 className="text-xs font-bold text-indigo-950">
            १. चालू बिझनेस डेट व क्रमवार स्थिती (Business Date Status)
          </h2>
          <span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-0.5 rounded-sm border border-slate-300">
            शाखा: <strong className="font-bold text-slate-900">{selectedBranchName}</strong>
          </span>
        </div>

        <div className="p-3 bg-white grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          {/* Card 1: Current Open Business Date -> EMERALD / TEAL SHADE */}
          <div className="bg-emerald-50/90 border-2 border-emerald-400 border-l-4 border-l-emerald-600 rounded-sm p-3 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-950">
                चालू प्रलंबित दिवस अखेर तारीख
              </span>
              <span
                className={`px-2 py-0.5 rounded-sm text-xs font-semibold flex items-center gap-1 border ${
                  isDayClosed
                    ? 'bg-rose-100 text-rose-800 border-rose-400'
                    : 'bg-white text-emerald-900 border-emerald-400'
                }`}
              >
                {isDayClosed ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                {isDayClosed ? 'बंद (Closed)' : 'चालू (Open)'}
              </span>
            </div>
            <div className="my-1.5">
              <span className="text-sm font-bold text-emerald-900">
                {formatDisplayDate(activeBusinessDateStr)}
              </span>
            </div>
            <span className="text-xs text-emerald-800 font-medium">
              ही तारीख बंद केल्याशिवाय पुढची तारीख येणार नाही
            </span>
          </div>

          {/* Card 2: Last Closed Date -> WARM AMBER / GOLD SHADE */}
          <div className="bg-amber-50/90 border-2 border-amber-400 border-l-4 border-l-amber-600 rounded-sm p-3 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-950">
                मागील बंद झालेली तारीख (Last Closed)
              </span>
              <History className="w-3.5 h-3.5 text-amber-700" />
            </div>
            <div className="my-1.5">
              <span className="text-sm font-bold text-amber-950">
                {lastClosedDateStr ? formatDisplayDate(lastClosedDateStr) : 'अद्याप कोणताही दिवस बंद नाही'}
              </span>
            </div>
            {!lastClosedDateStr && isHeadOfficeOrAdmin ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={initialDateInput}
                  onChange={e => setInitialDateInput(e.target.value)}
                  className="text-xs border border-amber-400 rounded-sm px-2 py-0.5 bg-white text-slate-900 font-semibold h-6"
                />
                <button
                  type="button"
                  onClick={handleSetInitialStartDate}
                  disabled={settingInitialDate || !initialDateInput}
                  className="text-xs font-semibold bg-amber-200 hover:bg-amber-300 text-amber-950 border border-amber-500 px-2.5 py-0.5 rounded-sm cursor-pointer disabled:opacity-50 h-6"
                >
                  {settingInitialDate ? '...' : 'तारीख सेट करा'}
                </button>
              </div>
            ) : isLastClosedDateInClosedFy ? (
              <span className="text-xs text-rose-800 font-bold flex items-center gap-1">
                <Lock className="w-3 h-3 shrink-0" />
                आर्थिक वर्ष {lastClosedDateFyCode || ''} बंद आहे (Revoke होणार नाही)
              </span>
            ) : (
              <span className="text-xs text-amber-900 font-medium">
                {lastClosedDateStr ? 'गरज असल्यास खालील Revoke बटणाने उघडता येईल' : 'पहिली दिवस अखेर प्रक्रिया'}
              </span>
            )}
          </div>

          {/* Card 3: Next Sequential Date -> ROYAL INDIGO / BLUE SHADE */}
          <div className="bg-indigo-50/90 border-2 border-indigo-300 border-l-4 border-l-indigo-600 rounded-sm p-3 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-indigo-950">
                दिवस बंद केल्यावर येणारी पुढची तारीख
              </span>
              <Calendar className="w-3.5 h-3.5 text-indigo-700" />
            </div>
            <div className="my-1.5">
              <span className="text-sm font-bold text-indigo-950">
                {formatDisplayDate(nextSequentialDateStr)}
              </span>
            </div>
            <span className="text-xs text-indigo-900 font-medium">
              दि. {formatDisplayDate(activeBusinessDateStr)} क्लोज केल्यावरच ही तारीख उघडेल
            </span>
          </div>
        </div>
      </div>

      {/* GROUP BOX 2: 3 Mandatory Tally Checks (Violet + Emerald + Sky-Blue Multi-Color Cards) */}
      <div className="bg-white rounded-sm shadow-xs border-2 border-slate-300 border-t-4 border-t-blue-600 overflow-hidden">
        <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 flex justify-between items-center">
          <h2 className="text-xs font-bold text-blue-950">
            २. दिवस अखेरसाठी आवश्यक ३ ताळमेळ तपासण्या (दिनांक {formatDisplayDate(activeBusinessDateStr)})
          </h2>
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-sm border ${
              isAllTallied
                ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                : 'bg-rose-100 text-rose-900 border-rose-400'
            }`}
          >
            {isAllTallied ? '✅ तिन्ही ताळमेळ पूर्ण (Tallied)' : '❌ ताळमेळ अपूर्ण (Day End होणार नाही)'}
          </span>
        </div>

        <div className="p-3 bg-white grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          {/* Check 1: Pending Vouchers -> SOFT VIOLET / PURPLE SHADE (or Rose when pending) */}
          <div
            className={`rounded-sm border-2 flex flex-col justify-between overflow-hidden shadow-2xs ${
              isVouchersClear
                ? 'bg-violet-50/70 border-violet-300'
                : 'bg-rose-50/90 border-rose-400'
            }`}
          >
            <div>
              <div
                className={`flex items-center justify-between px-3 py-2 border-b ${
                  isVouchersClear
                    ? 'bg-violet-100/90 border-violet-300'
                    : 'bg-rose-100/90 border-rose-300'
                }`}
              >
                <span className="text-xs font-bold text-violet-950 flex items-center gap-1.5">
                  <FileSpreadsheet className={`w-3.5 h-3.5 ${isVouchersClear ? 'text-violet-700' : 'text-rose-700'}`} />
                  १) प्रलंबित व्हाउचर्स (Pending)
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-sm border ${
                    isVouchersClear
                      ? 'bg-white text-emerald-800 border-emerald-400'
                      : 'bg-white text-rose-800 border-rose-400'
                  }`}
                >
                  {isVouchersClear ? '✅ पास (0)' : `❌ ${unpostedVouchers} प्रलंबित`}
                </span>
              </div>

              <div className="p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>तपासणी तारीख:</span>
                  <span className="font-semibold text-slate-900">{formatDisplayDate(activeBusinessDateStr)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>प्रलंबित व्हाउचर्स संख्या:</span>
                  <span className={`font-bold ${isVouchersClear ? 'text-violet-900' : 'text-rose-700'}`}>
                    {unpostedVouchers} व्हाउचर्स
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>व्हाउचर पासिंग स्थिती:</span>
                  <span className="font-semibold text-slate-900">
                    {isVouchersClear ? 'सर्व मंजूर (Approved)' : 'मंजुरी प्रलंबित'}
                  </span>
                </div>
              </div>
            </div>

            <div
              className={`px-3 py-2 border-t flex items-center justify-between gap-2 ${
                isVouchersClear
                  ? 'bg-violet-100/70 border-violet-300'
                  : 'bg-rose-100/70 border-rose-300'
              }`}
            >
              {!isVouchersClear ? (
                <>
                  <span className="text-xs text-rose-900 font-semibold">
                    व्हाउचर पास करा:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeBusinessDateStr) {
                        updateBusinessDate(activeBusinessDateStr);
                      }
                      window.history.pushState(null, '', '/voucher/passing');
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    className="text-xs font-semibold text-rose-900 bg-white hover:bg-rose-50 border border-rose-400 px-2.5 py-0.5 rounded-sm flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                  >
                    पास करा <ArrowRight className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs font-semibold text-violet-950">अंतिम स्थिती:</span>
                  <span className="text-xs font-bold text-emerald-800">० प्रलंबित (Tallied)</span>
                </>
              )}
            </div>
          </div>

          {/* Check 2: Cash Balance Tally -> SOFT EMERALD / TEAL SHADE */}
          <div
            className={`rounded-sm border-2 flex flex-col justify-between overflow-hidden shadow-2xs ${
              isCashTallied
                ? 'bg-emerald-50/70 border-emerald-400'
                : 'bg-rose-50/90 border-rose-400'
            }`}
          >
            <div>
              <div
                className={`flex items-center justify-between px-3 py-2 border-b ${
                  isCashTallied
                    ? 'bg-emerald-100/90 border-emerald-300'
                    : 'bg-rose-100/90 border-rose-300'
                }`}
              >
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-700" />
                  २) कॅश बॅलन्स टॅली (Cash Tally)
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-sm border ${
                    isCashTallied
                      ? 'bg-white text-emerald-800 border-emerald-400'
                      : 'bg-white text-rose-800 border-rose-400'
                  }`}
                >
                  {isCashTallied ? '✅ टॅली आहे' : '❌ टॅली नाही'}
                </span>
              </div>

              <div className="p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>आरंभीची रोख शिल्लक:</span>
                  <span className="font-semibold text-slate-900">
                    ₹ {openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>+ आजची रोख जमा (Dr):</span>
                  <span className="font-semibold text-emerald-800">
                    ₹ {todayReceipts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>- आजचा रोख खर्च (Cr):</span>
                  <span className="font-semibold text-rose-700">
                    ₹ {todayPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div
              className={`px-3 py-2 border-t flex items-center justify-between ${
                isCashTallied
                  ? 'bg-emerald-100/70 border-emerald-300'
                  : 'bg-rose-100/70 border-rose-300'
              }`}
            >
              <span className="text-xs font-semibold text-emerald-950">अखेरची रोख शिल्लक:</span>
              <span className={`text-xs font-bold ${isCashTallied ? 'text-emerald-900' : 'text-rose-800'}`}>
                ₹ {closingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Check 3: Transfer Balance Tally -> SOFT SKY / BLUE SHADE */}
          <div
            className={`rounded-sm border-2 flex flex-col justify-between overflow-hidden shadow-2xs ${
              isTransferTallied
                ? 'bg-sky-50/80 border-sky-400'
                : 'bg-rose-50/90 border-rose-400'
            }`}
          >
            <div>
              <div
                className={`flex items-center justify-between px-3 py-2 border-b ${
                  isTransferTallied
                    ? 'bg-sky-100/90 border-sky-300'
                    : 'bg-rose-100/90 border-rose-300'
                }`}
              >
                <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-700" />
                  ३) ट्रान्सफर बॅलन्स टॅली (Transfer)
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-sm border ${
                    isTransferTallied
                      ? 'bg-white text-emerald-800 border-emerald-400'
                      : 'bg-white text-rose-800 border-rose-400'
                  }`}
                >
                  {isTransferTallied ? '✅ टॅली आहे' : '❌ फरक आहे'}
                </span>
              </div>

              <div className="p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>ट्रान्सफर नावे (Debit):</span>
                  <span className="font-semibold text-slate-900">
                    ₹ {transferDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>ट्रान्सफर जमा (Credit):</span>
                  <span className="font-semibold text-slate-900">
                    ₹ {transferCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>ताळमेळ स्थिती:</span>
                  <span className="font-semibold text-slate-900">
                    {isTransferTallied ? 'नावे = जमा जुळले' : 'नावे-जमा तफावत'}
                  </span>
                </div>
              </div>
            </div>

            <div
              className={`px-3 py-2 border-t flex items-center justify-between ${
                isTransferTallied
                  ? 'bg-sky-100/70 border-sky-300'
                  : 'bg-rose-100/70 border-rose-300'
              }`}
            >
              <span className="text-xs font-semibold text-sky-950">नावे-जमा फरक:</span>
              <span className={`text-xs font-bold ${isTransferTallied ? 'text-sky-950' : 'text-rose-800'}`}>
                ₹ {transferDiff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* GROUP BOX 3: Day End Execution & Day Revoke Controls */}
      <div className="bg-white rounded-sm shadow-xs border-2 border-slate-300 border-t-4 border-t-teal-600 overflow-hidden">
        <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 flex justify-between items-center">
          <h2 className="text-xs font-bold text-teal-950">
            ३. दिवस अखेर (Close Day) किंवा दिवस पुन्हा उघडणे (Revoke Day End)
          </h2>
        </div>

        <div className="p-3 bg-white">
          <div
            className={`p-3 rounded-sm border-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${
              isAllTallied
                ? 'bg-slate-50 border-slate-300'
                : 'bg-rose-50/90 border-rose-300'
            }`}
          >
            <div className="text-xs text-slate-800">
              {isAllTallied ? (
                <span>
                  दिनांक <strong className="text-slate-950">{formatDisplayDate(activeBusinessDateStr)}</strong> चे सर्व ताळमेळ पूर्ण आहेत. आपण दिवस बंद करून पुढील तारीख{' '}
                  <strong className="text-indigo-800">{formatDisplayDate(nextSequentialDateStr)}</strong> सुरू करू शकता.
                </span>
              ) : (
                <span className="text-rose-900 font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                  दिनांक {formatDisplayDate(activeBusinessDateStr)} चा दिवस बंद करण्यासाठी प्रलंबित व्हाउचर्स (0), कॅश बॅलन्स आणि ट्रान्सफर बॅलन्स हे तिन्ही Tally असणे आवश्यक आहे.
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Primary Button: Soft Indigo-Blue Shaded Action Button */}
              <button
                type="button"
                onClick={handleRunEod}
                disabled={!canManageDayEnd || !isAllTallied || isDayClosed || eodRunning || loading}
                className={`py-2 px-4 rounded-sm font-bold text-xs flex items-center justify-center gap-1.5 border-2 transition ${
                  canManageDayEnd && isAllTallied && !isDayClosed && !eodRunning
                    ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-950 border-indigo-500 cursor-pointer shadow-2xs'
                    : 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current text-indigo-800" />
                {eodRunning
                  ? 'दिवस अखेर सुरू आहे...'
                  : `दि. ${formatDisplayDate(activeBusinessDateStr)} चा दिवस बंद करा ➔ (${formatDisplayDate(nextSequentialDateStr)})`}
              </button>

              {/* Secondary Button: Soft Warm Amber Revoke Button */}
              {canManageDayEnd && (
                <button
                  type="button"
                  onClick={handleRevokeDayEnd}
                  disabled={!lastClosedDateStr || isLastClosedDateInClosedFy || revokeRunning || loading}
                  title={
                    isLastClosedDateInClosedFy
                      ? `दिनांक ${formatDisplayDate(lastClosedDateStr)} ही तारीख बंद आर्थिक वर्षात (${lastClosedDateFyCode}) असल्याने Revoke करता येणार नाही.`
                      : undefined
                  }
                  className={`py-2 px-3.5 rounded-sm font-bold text-xs flex items-center justify-center gap-1.5 border-2 transition ${
                    lastClosedDateStr && !isLastClosedDateInClosedFy && !revokeRunning
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-500 cursor-pointer shadow-2xs'
                      : 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed'
                  }`}
                >
                  {isLastClosedDateInClosedFy ? (
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-amber-800" />
                  )}
                  {revokeRunning
                    ? 'रद्द करत आहे...'
                    : isLastClosedDateInClosedFy
                    ? `आर्थिक वर्ष बंद (${lastClosedDateFyCode || 'FY'}) — Revoke बंद`
                    : lastClosedDateStr
                    ? `दिवस अखेर रद्द करा (Revoke ${formatDisplayDate(lastClosedDateStr)})`
                    : 'मागील बंद दिवस नाही'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayEndDashboard;
