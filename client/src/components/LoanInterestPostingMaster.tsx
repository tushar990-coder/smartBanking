import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getLockedBranchId, isHeadOfficeUser, resolveWriteBranchId } from '../utils/branchAccess';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calculator,
  CheckCircle2,
  RefreshCw,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

interface Branch {
  branchID: number;
  branchName: string;
}

interface LoanRate {
  loanRateID: number;
  loanType: string;
  shortName?: string;
  interestRate: number;
  overdueInterestRate?: number;
}

interface InterestPostingItem {
  loanAccountID: number;
  loanAccountNo: string;
  memberName: string;
  loanSchemeName: string;
  postingType?: string;
  impactedLedgerName?: string;
  currentPrincipal: number;
  currentInterest: number;
  interestRate: number;
  lastDate: string;
  daysAccrued: number;
  calculatedInterest: number;
  newPrincipal: number;
  newInterest: number;
  penalInterestRate?: number;
  penalDaysAccrued?: number;
  currentOverdueInterest?: number;
  calculatedPenalInterest?: number;
  newOverdueInterest?: number;
}

interface LoanInterestPostingMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const getLocalTodayStr = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getBusinessDateStr = (rawDate?: string | null): string => {
  if (rawDate && typeof rawDate === 'string') {
    const clean = rawDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  }
  return getLocalTodayStr();
};

const formatAmount = (val: number | undefined | null): string =>
  Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const LoanInterestPostingMaster: React.FC<LoanInterestPostingMasterProps> = ({ onNavigate }) => {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loanRates, setLoanRates] = useState<LoanRate[]>([]);
  const [branchID, setBranchID] = useState<number>(() => resolveWriteBranchId(user, globalBranchId));
  const [loanRateID, setLoanRateID] = useState<number | null>(null);
  const [postingDate, setPostingDate] = useState<string>(() => getBusinessDateStr(user?.businessDate));
  const [postingMode, setPostingMode] = useState<string>('SchemeDefault'); // SchemeDefault, ForceSeparate, ForceCapitalize

  const [previewItems, setPreviewItems] = useState<InterestPostingItem[]>([]);
  const [totalCalculatedInterest, setTotalCalculatedInterest] = useState<number>(0);
  const [totalPenalInterest, setTotalPenalInterest] = useState<number>(0);
  const [includePenalInterest, setIncludePenalInterest] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [postingLoading, setPostingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [lastVoucherId, setLastVoucherId] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (user?.businessDate) {
      setPostingDate(getBusinessDateStr(user.businessDate));
    }
  }, [user?.businessDate]);

  useEffect(() => {
    fetchBranches();
    fetchLoanRates();
  }, []);

  const clearStalePreview = () => {
    if (previewItems.length > 0) {
      setPreviewItems([]);
      setTotalCalculatedInterest(0);
      setTotalPenalInterest(0);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data);
      if (lockedBranchId) {
        setBranchID(lockedBranchId);
      } else if (res.data.length > 0 && (!globalBranchId || globalBranchId === 'all')) {
        setBranchID(res.data[0].branchID);
      }
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchLoanRates = async () => {
    try {
      const res = await axios.get('/api/LoanRates');
      setLoanRates(res.data);
    } catch (err) {
      console.error('Error fetching loan rates', err);
    }
  };

  const handlePreview = async () => {
    setError('');
    setSuccess('');
    setLastVoucherId(0);
    setLoading(true);
    try {
      const payload = {
        branchID,
        loanRateID: loanRateID || undefined,
        postingDate,
        postingMode,
        capitalizeToPrincipal: postingMode === 'ForceCapitalize',
        includePenalInterest,
      };
      const res = await axios.post('/api/LoanAccounts/PreviewInterestPosting', payload);
      setPreviewItems(res.data.items || []);
      setTotalCalculatedInterest(res.data.totalCalculatedInterest || 0);
      setTotalPenalInterest(res.data.totalPenalInterest || 0);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          (typeof err.response?.data === 'string' ? err.response.data : '') ||
          'व्याज अंदाजपत्रक तयार करताना त्रुटी आली.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePostBatch = async () => {
    if (previewItems.length === 0) {
      setError('आकारणी पोस्ट करण्यापूर्वी व्याजाची गणती (Preview) करा.');
      return;
    }

    const modeText =
      postingMode === 'SchemeDefault'
        ? '🌟 योजनेच्या धोरणानुसार स्वयंचलित (As per Scheme Policy)'
        : postingMode === 'ForceCapitalize'
        ? 'मुद्दलामध्ये प्लस (Capitalize to Principal)'
        : 'येणे व्याजामध्ये (Separate Interest Balance)';

    if (
      !window.confirm(
        `तुम्हाला खरोखर ${previewItems.length} कर्ज खात्यांवर एकत्रीत ₹${totalCalculatedInterest.toLocaleString(
          'en-IN'
        )}${
          totalPenalInterest > 0
            ? ` (दंड व्याज: ₹${totalPenalInterest.toLocaleString('en-IN')})`
            : ''
        } व्याज आकारणी पोस्ट करायची आहे का?\n\nपद्धत: ${modeText}`
      )
    ) {
      return;
    }

    setError('');
    setSuccess('');
    setPostingLoading(true);
    try {
      const payload = {
        branchID,
        loanRateID: loanRateID || undefined,
        postingDate,
        postingMode,
        capitalizeToPrincipal: postingMode === 'ForceCapitalize',
        includePenalInterest,
      };
      const res = await axios.post('/api/LoanAccounts/PostInterestBatch', payload);
      const vNoMsg = res.data.voucherNo ? ` (व्हाऊचर क्र: ${res.data.voucherNo})` : '';
      setSuccess((res.data.message || 'व्याज आकारणी यशस्वीरित्या पोस्ट झाली!') + vNoMsg);
      setLastVoucherId(Number(res.data.voucherID || res.data.voucherId || 0));
      setPreviewItems([]);
      setTotalCalculatedInterest(0);
      setTotalPenalInterest(0);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          (typeof err.response?.data === 'string' ? err.response.data : '') ||
          'व्याज आकारणी पोस्ट करताना त्रुटी आली.'
      );
    } finally {
      setPostingLoading(false);
    }
  };

  const branchOptions = useMemo(() => {
    const base = lockedBranchId
      ? branches.filter((b) => Number(b.branchID) === Number(lockedBranchId))
      : branches;
    if (base.length > 0) return base;
    return [
      {
        branchID: branchID || Number(user?.branchID || 1),
        branchName: user?.branchName || 'मुख्य शाखा',
      },
    ];
  }, [branches, lockedBranchId, branchID, user?.branchID, user?.branchName]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return previewItems;
    const term = searchTerm.toLowerCase();
    return previewItems.filter(
      (i) =>
        i.loanAccountNo.toLowerCase().includes(term) ||
        i.memberName.toLowerCase().includes(term) ||
        i.loanSchemeName.toLowerCase().includes(term) ||
        (i.impactedLedgerName || '').toLowerCase().includes(term)
    );
  }, [previewItems, searchTerm]);

  const showPenalColumns = includePenalInterest || totalPenalInterest > 0;

  const gridTotals = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => {
        acc.currentPrincipal += Number(item.currentPrincipal || 0);
        acc.currentInterest += Number(item.currentInterest || 0);
        acc.calculatedInterest += Number(item.calculatedInterest || 0);
        acc.calculatedPenal += Number(item.calculatedPenalInterest || 0);
        acc.newOverdue += Number(item.newOverdueInterest ?? item.currentOverdueInterest ?? 0);
        acc.newPrincipal += Number(item.newPrincipal || 0);
        acc.newInterest += Number(item.newInterest || 0);
        return acc;
      },
      {
        currentPrincipal: 0,
        currentInterest: 0,
        calculatedInterest: 0,
        calculatedPenal: 0,
        newOverdue: 0,
        newPrincipal: 0,
        newInterest: 0,
      }
    );
  }, [filteredItems]);

  const modeLabelShort =
    postingMode === 'SchemeDefault'
      ? 'योजनेनुसार स्वयंचलित'
      : postingMode === 'ForceCapitalize'
      ? 'मुद्दलामध्ये प्लस'
      : 'स्वतंत्र येणे व्याज';

  return (
    <div className="p-1.5 sm:p-2 max-w-[1560px] mx-auto font-sans text-xs text-slate-800 flex flex-col h-[calc(100vh-3.15rem)] gap-1.5 bg-slate-50/60 overflow-hidden">
      {/* 1. Compact ERP Header + Posting Criteria + Posting Mode Card */}
      <div className="bg-white rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary shrink-0">
        {/* Top Strip: Title + Subtitle Pill + Branch + Back */}
        <div className="px-2.5 py-1.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Calculator size={13} className="stroke-[2.3]" />
              </div>
              <h1 className="text-xs sm:text-sm font-extrabold text-primary tracking-tight whitespace-nowrap">
                कर्ज व्याज आकारणी (Batch Loan Interest Posting)
              </h1>
            </div>

            <span className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-primary/5 border border-primary/20 text-[10px] text-slate-700 whitespace-nowrap">
              <Sparkles size={11} className="text-primary shrink-0" />
              <span>दरमहा / ३१ मार्च अखेर सर्व सक्रिय कर्ज खात्यांवर एकत्रित व्याज आकारणी व ऑटो-व्हाऊचर पोस्टिंग</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Compact Branch Selector */}
            <div className="flex items-center gap-1 bg-white px-2 h-6 rounded-sm border border-slate-300">
              <Building2 size={11} className="text-primary shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">शाखा:</span>
              <select
                value={branchID}
                disabled={!isHOUser}
                onChange={(e) => {
                  setBranchID(parseInt(e.target.value, 10));
                  clearStalePreview();
                }}
                className="h-5 text-[11px] font-bold bg-transparent text-slate-900 focus:outline-none disabled:text-slate-600 cursor-pointer disabled:cursor-not-allowed"
              >
                {branchOptions.map((b) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('loan')}
                className="h-6 px-2 rounded-sm border border-slate-300 bg-white hover:bg-primary/10 hover:text-primary hover:border-primary text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                title="कर्ज विभाग मुख्य डॅशबोर्डवर परत जा"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>मागे</span>
              </button>
            )}
          </div>
        </div>

        {/* Criteria + Action Row */}
        <div className="px-2.5 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <span className="text-[11px] font-extrabold text-primary whitespace-nowrap">
              १. निकष:
            </span>

            {/* कर्ज योजना */}
            <div className="flex items-center gap-1.5 min-w-[230px] sm:min-w-[260px]">
              <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                कर्ज योजना:
              </label>
              <select
                value={loanRateID || ''}
                onChange={(e) => {
                  setLoanRateID(e.target.value ? parseInt(e.target.value, 10) : null);
                  clearStalePreview();
                }}
                className="h-7 flex-1 border border-slate-300 rounded-sm px-2 text-[11px] font-bold bg-white text-slate-900 focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">-- सर्व कर्ज योजना (All Schemes) --</option>
                {loanRates.map((r) => (
                  <option key={r.loanRateID} value={r.loanRateID}>
                    {r.shortName || r.loanType} ({r.interestRate}%)
                  </option>
                ))}
              </select>
            </div>

            {/* आकारणी अखेर तारीख */}
            <div className="flex items-center gap-1.5 shrink-0">
              <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                आकारणी अखेर तारीख:
              </label>
              <input
                type="date"
                value={postingDate}
                onChange={(e) => {
                  setPostingDate(e.target.value);
                  clearStalePreview();
                }}
                className="h-7 w-[132px] border border-slate-300 rounded-sm px-2 text-[11px] font-mono font-bold bg-white text-slate-900 focus:outline-none focus:border-primary"
              />
            </div>

            {/* दंड व्याज समावेश (Overdue / Penal Interest) */}
            <label
              className={`h-7 px-2.5 rounded-sm border flex items-center gap-1.5 cursor-pointer select-none transition-colors ${
                includePenalInterest
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:border-primary'
              }`}
              title="थकीत खात्यांवर योजनेनुसार दंड व्याज देखील आकारा व बुक करा"
            >
              <input
                type="checkbox"
                checked={includePenalInterest}
                onChange={(e) => {
                  setIncludePenalInterest(e.target.checked);
                  clearStalePreview();
                }}
                className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
              />
              <span className="text-[11px] font-bold whitespace-nowrap">
                थकीत खात्यांवर दंड व्याजही आकारा (Penal Interest)
              </span>
            </label>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePreview}
              disabled={loading}
              className="h-7 px-3.5 bg-primary hover:opacity-90 text-white text-[11px] font-extrabold rounded-sm shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Search className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{loading ? 'गणती सुरू आहे...' : '१. व्याजाची गणती करा (Preview)'}</span>
            </button>

            {previewItems.length > 0 && (
              <button
                type="button"
                onClick={handlePostBatch}
                disabled={postingLoading}
                className="h-7 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-sm shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {postingLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {postingLoading ? 'पोस्ट होत आहे...' : '२. व्याज आकारणी पोस्ट करा (Post Batch)'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Posting Mode Radio Section (Theme-Matched Strip) */}
        <div className="bg-primary/5 border-t border-primary/20 px-2.5 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-primary">
              २. व्याज आकारणी व पोस्टिंग पद्धत निवडा (Posting Mode):
            </span>
            <span className="text-[10px] font-semibold text-slate-600 hidden sm:inline">
              सध्याची निवड: <strong className="text-primary">{modeLabelShort}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {/* Option 1: Scheme Default */}
            <label
              className={`flex items-start gap-2 px-2.5 py-1.5 rounded-sm border cursor-pointer transition-all ${
                postingMode === 'SchemeDefault'
                  ? 'bg-white border-primary ring-1 ring-primary/20 shadow-2xs'
                  : 'bg-white/80 border-slate-200 hover:border-primary'
              }`}
            >
              <input
                type="radio"
                name="postingMode"
                checked={postingMode === 'SchemeDefault'}
                onChange={() => {
                  setPostingMode('SchemeDefault');
                  clearStalePreview();
                }}
                className="mt-0.5 w-3.5 h-3.5 accent-primary cursor-pointer shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[11px] font-extrabold ${
                      postingMode === 'SchemeDefault' ? 'text-primary' : 'text-slate-800'
                    }`}
                  >
                    🌟 १. योजनेनुसार स्वयंचलित
                  </span>
                  <span className="px-1.5 py-0.2 rounded-sm bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold">
                    शिफारस केलेले
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 leading-snug mt-0.5">
                  योजनेतील नियमानुसार (&apos;कर्जावर&apos; ➔ मुद्दलात, &apos;येणे व्याजावर&apos; ➔ स्वतंत्र व्याजात) आपोआप पोस्ट होईल.
                </p>
              </div>
            </label>

            {/* Option 2: Force Separate Interest */}
            <label
              className={`flex items-start gap-2 px-2.5 py-1.5 rounded-sm border cursor-pointer transition-all ${
                postingMode === 'ForceSeparate'
                  ? 'bg-white border-primary ring-1 ring-primary/20 shadow-2xs'
                  : 'bg-white/80 border-slate-200 hover:border-primary'
              }`}
            >
              <input
                type="radio"
                name="postingMode"
                checked={postingMode === 'ForceSeparate'}
                onChange={() => {
                  setPostingMode('ForceSeparate');
                  clearStalePreview();
                }}
                className="mt-0.5 w-3.5 h-3.5 accent-primary cursor-pointer shrink-0"
              />
              <div className="min-w-0">
                <div
                  className={`text-[11px] font-extrabold ${
                    postingMode === 'ForceSeparate' ? 'text-primary' : 'text-slate-800'
                  }`}
                >
                  २. सर्वांचे स्वतंत्र येणे व्याज ठेवा
                </div>
                <p className="text-[10px] text-slate-600 leading-snug mt-0.5">
                  सर्व सक्रिय खात्यांचे व्याज &apos;येणे व्याज&apos; खात्यात जमा होईल; मुद्दल जशी आहे तशीच राहील.
                </p>
              </div>
            </label>

            {/* Option 3: Force Capitalize to Principal */}
            <label
              className={`flex items-start gap-2 px-2.5 py-1.5 rounded-sm border cursor-pointer transition-all ${
                postingMode === 'ForceCapitalize'
                  ? 'bg-white border-primary ring-1 ring-primary/20 shadow-2xs'
                  : 'bg-white/80 border-slate-200 hover:border-primary'
              }`}
            >
              <input
                type="radio"
                name="postingMode"
                checked={postingMode === 'ForceCapitalize'}
                onChange={() => {
                  setPostingMode('ForceCapitalize');
                  clearStalePreview();
                }}
                className="mt-0.5 w-3.5 h-3.5 accent-primary cursor-pointer shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[11px] font-extrabold ${
                      postingMode === 'ForceCapitalize' ? 'text-primary' : 'text-slate-800'
                    }`}
                  >
                    ३. सर्वांचे व्याज मुद्दलामध्ये प्लस करा
                  </span>
                  <span className="px-1.5 py-0.2 rounded-sm bg-amber-50 text-amber-900 border border-amber-300 text-[9px] font-bold">
                    मुद्दल वाढेल
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 leading-snug mt-0.5">
                  व्याज थेट मुद्दलात (Principal) जोडले जाईल व पुढील व्याज वाढलेल्या मुद्दलावर आकारले जाईल.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Slim Error Alert */}
      {error && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 px-2.5 py-1.5 rounded-sm flex items-center justify-between gap-2 text-[11px] font-bold shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-600 hover:text-rose-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Slim Success Banner */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-2.5 py-1.5 rounded-sm flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
          <div className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <div className="flex items-center gap-2">
            {onNavigate && lastVoucherId > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('voucher-posting', { voucherId: lastVoucherId })}
                className="h-6 px-2.5 bg-primary hover:opacity-90 text-white font-bold text-[11px] rounded-sm cursor-pointer"
              >
                व्हाउचर पासिंग उघडा
              </button>
            )}
            <button
              type="button"
              onClick={() => setSuccess('')}
              className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Full-Height Dense Single-Line Preview Table Card */}
      <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-300 border-t-2 border-t-primary rounded-sm shadow-xs overflow-hidden">
        {/* Table Toolbar Strip */}
        <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold text-primary">
              ३. व्याज आकारणी अंदाजपत्रक (Interest Preview)
            </span>

            {previewItems.length > 0 && (
              <>
                <span className="px-2 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20 font-bold text-[10px]">
                  एकूण खाती: {filteredItems.length}
                  {filteredItems.length !== previewItems.length ? ` / ${previewItems.length}` : ''}
                </span>
                <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[10px]">
                  पद्धत: {modeLabelShort}
                </span>
                <span className="px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[10px] font-mono">
                  आकारणी व्याज: ₹{formatAmount(totalCalculatedInterest)}
                </span>
                {showPenalColumns && (
                  <span className="px-2 py-0.5 rounded-sm bg-rose-50 text-rose-800 border border-rose-200 font-extrabold text-[10px] font-mono">
                    दंड व्याज: ₹{formatAmount(totalPenalInterest)}
                  </span>
                )}
              </>
            )}
          </div>

          {previewItems.length > 0 && (
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="खाते क्र. / सभासद नाव / योजना शोधा..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-6 w-full border border-slate-300 rounded-sm pl-2 pr-6 text-[11px] bg-white text-slate-900 focus:outline-none focus:border-primary"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1.5 top-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Search className="w-3 h-3 text-slate-400 absolute right-1.5 top-1.5 pointer-events-none" />
              )}
            </div>
          )}
        </div>

        {/* Table Body or Empty State */}
        {previewItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-slate-700">
              व्याज आकारणी अंदाजपत्रक अद्याप तयार केलेले नाही
            </div>
            <p className="text-[11px] text-slate-500 max-w-md">
              वरील शाखा, कर्ज योजना, आकारणी तारीख व पोस्टिंग पद्धत निवडून{' '}
              <strong className="text-primary">&ldquo;१. व्याजाची गणती करा (Preview)&rdquo;</strong> बटनावर क्लिक करा.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            <table className="min-w-full border-collapse text-[11px] leading-tight whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-800 sticky top-0 z-10 border-b-2 border-primary/30 font-bold">
                <tr>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-center w-10">अ.क्र.</th>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-left">खाते क्रमांक</th>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-left">सभासदाचे नाव</th>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-left">कर्ज प्रकार</th>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-center">पोस्टिंग प्रकार</th>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-left">प्रभावित लेजर</th>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-right">चालू मुद्दल</th>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-right">चालू येणे व्याज</th>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-center">व्याजदर</th>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-center">दिवस</th>
                  <th className="py-1.5 px-2 border-r border-slate-200 text-right bg-emerald-50 text-emerald-900">
                    आकारणी व्याज
                  </th>
                  {showPenalColumns && (
                    <>
                      <th className="py-1.5 px-2 border-r border-slate-200 text-right bg-rose-50 text-rose-900">
                        दंड व्याज
                      </th>
                      <th className="py-1.5 px-2 border-r border-slate-200 text-right bg-rose-50 text-rose-950">
                        नवीन दंड शिल्लक
                      </th>
                    </>
                  )}
                  <th className="py-1.5 px-2 border-r border-slate-200 text-right bg-amber-50 text-amber-900">
                    नवीन मुद्दल
                  </th>
                  <th className="py-1.5 px-2 text-right bg-primary/10 text-primary">
                    नवीन येणे व्याज
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showPenalColumns ? 15 : 13}
                      className="py-6 text-center text-slate-500 font-semibold"
                    >
                      शोधलेल्या निकषांनुसार कोणतेही खाते सापडले नाही.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const isPrincipalCap = Boolean(item.postingType?.includes('मुद्दल'));
                    return (
                      <tr
                        key={item.loanAccountID}
                        className="border-b border-slate-200/80 hover:bg-primary/10 transition-colors"
                      >
                        <td className="py-1 px-2 border-r border-slate-200 text-center text-slate-500 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 font-mono font-bold text-primary">
                          {item.loanAccountNo}
                        </td>
                        <td
                          className="py-1 px-2 border-r border-slate-200 font-semibold text-slate-900 max-w-[220px] truncate"
                          title={item.memberName}
                        >
                          {item.memberName}
                        </td>
                        <td
                          className="py-1 px-2 border-r border-slate-200 text-slate-700 max-w-[150px] truncate"
                          title={item.loanSchemeName}
                        >
                          {item.loanSchemeName}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] leading-none font-bold ${
                              isPrincipalCap
                                ? 'bg-amber-50 text-amber-900 border border-amber-300'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}
                          >
                            {item.postingType || '-'}
                          </span>
                        </td>
                        <td
                          className="py-1 px-2 border-r border-slate-200 text-slate-700 font-medium max-w-[170px] truncate"
                          title={item.impactedLedgerName || '-'}
                        >
                          {item.impactedLedgerName || '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-medium text-slate-800">
                          ₹{formatAmount(item.currentPrincipal)}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-medium text-slate-800">
                          ₹{formatAmount(item.currentInterest)}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 text-center font-mono font-semibold text-slate-700">
                          {item.interestRate}%
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 text-center font-mono font-bold text-slate-700">
                          {item.daysAccrued}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-700 bg-emerald-50/50">
                          ₹{formatAmount(item.calculatedInterest)}
                        </td>
                        {showPenalColumns && (
                          <>
                            <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-bold text-rose-700 bg-rose-50/50">
                              ₹{formatAmount(item.calculatedPenalInterest || 0)}
                            </td>
                            <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-bold text-rose-950 bg-rose-50/30">
                              ₹{formatAmount(item.newOverdueInterest ?? item.currentOverdueInterest ?? 0)}
                            </td>
                          </>
                        )}
                        <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-bold text-amber-900 bg-amber-50/40">
                          ₹{formatAmount(item.newPrincipal)}
                        </td>
                        <td className="py-1 px-2 text-right font-mono font-bold text-primary bg-primary/5">
                          ₹{formatAmount(item.newInterest)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredItems.length > 0 && (
                <tfoot className="bg-slate-100 border-t-2 border-primary/30 font-extrabold text-slate-900 sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={6} className="py-1.5 px-2 border-r border-slate-300 text-right text-primary">
                      एकूण ({filteredItems.length} खाती):
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono">
                      ₹{formatAmount(gridTotals.currentPrincipal)}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono">
                      ₹{formatAmount(gridTotals.currentInterest)}
                    </td>
                    <td colSpan={2} className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-400">
                      —
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-emerald-800 bg-emerald-50">
                      ₹{formatAmount(gridTotals.calculatedInterest)}
                    </td>
                    {showPenalColumns && (
                      <>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-rose-800 bg-rose-50">
                          ₹{formatAmount(gridTotals.calculatedPenal)}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-rose-950 bg-rose-50">
                          ₹{formatAmount(gridTotals.newOverdue)}
                        </td>
                      </>
                    )}
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-amber-900 bg-amber-50">
                      ₹{formatAmount(gridTotals.newPrincipal)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-primary bg-primary/10">
                      ₹{formatAmount(gridTotals.newInterest)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanInterestPostingMaster;
