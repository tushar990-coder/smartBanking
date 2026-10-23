import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  CreditCard,
  User,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
  Coins,
  Layers,
  Save,
  Info,
  CheckSquare,
  Square,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface RdAccount {
  rdAccountID: number;
  accountNo: string;
  legacyAccountNumber?: string;
  memberCode: string;
  memberName: string;
  schemeName: string;
  installmentAmount: number;
  totalPaidInstallments: number;
  durationMonths: number;
  status: string;
  openingDate: string;
  customerID?: number;
  customerId?: number;
  memberID?: number;
  memberId?: number;
  cifNo?: string;
  customerName?: string;
  totalDepositedAmount?: number;
}

export interface RdInstallmentCollectionProps {
  voucherId?: number;
  isPassingMode?: boolean;
  onNavigate?: (tab: string) => void;
}

export default function RdInstallmentCollection({
  voucherId: propVoucherId,
  isPassingMode: propIsPassingMode,
  onNavigate
}: RdInstallmentCollectionProps = {}) {
  const urlParams = new URLSearchParams(window.location.search);
  const voucherIdFromUrl = urlParams.get('voucherId') ? parseInt(urlParams.get('voucherId')!) : undefined;
  const isPassingModeFromUrl = urlParams.get('passingMode') === 'true';

  const voucherId = propVoucherId || voucherIdFromUrl;
  const isPassingMode = propIsPassingMode || isPassingModeFromUrl;

  const [passingVoucherData, setPassingVoucherData] = useState<any | null>(null);
  const [passingLoading, setPassingLoading] = useState<boolean>(false);
  const [passingActionLoading, setPassingActionLoading] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [accounts, setAccounts] = useState<RdAccount[]>([]);
  const [selectedAccId, setSelectedAccId] = useState('');
  const [selectedAcc, setSelectedAcc] = useState<RdAccount | null>(null);

  // Multi-RD Account Selection Modal State (CIF-First)
  const [customerMatchingRds, setCustomerMatchingRds] = useState<RdAccount[]>([]);
  const [showMultiRdModal, setShowMultiRdModal] = useState(false);
  const [multiRdCustomerInfo, setMultiRdCustomerInfo] = useState<{
    name: string;
    cifNo: string;
    customerId?: number;
  } | null>(null);
  const [noRdFoundAlert, setNoRdFoundAlert] = useState<string | null>(null);

  const { user } = useAuth();
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];
  const isHOUser = user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'HeadOffice' || user?.role === 'HO_Manager';
  const [allowDateOverride, setAllowDateOverride] = useState(false);

  // Form states
  const [collectionDate, setCollectionDate] = useState<string>(activeBusinessDate);

  // Sync CBS Business Date if changed
  useEffect(() => {
    if (user?.businessDate) {
      setCollectionDate(user.businessDate.split('T')[0]);
    }
  }, [user?.businessDate]);

  const [isBulk, setIsBulk] = useState(false);
  const [count, setCount] = useState(1);
  const [penaltyAmount, setPenaltyAmount] = useState(0);
  const [payMode, setPayMode] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bulk States
  const [bulkRows, setBulkRows] = useState<{ [key: number]: { count: number; penalty: number; selected: boolean } }>({});

  const selectRdAccount = (acc: RdAccount) => {
    setSelectedAccId(acc.rdAccountID.toString());
    setSelectedAcc(acc);
    setCount(1);

    if (acc) {
      const start = new Date(acc.openingDate);
      start.setMonth(start.getMonth() + acc.totalPaidInstallments);
      const today = new Date();

      const diffMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
      if (diffMonths > 0) {
        const p = Math.round(acc.installmentAmount * 0.02 * diffMonths);
        setPenaltyAmount(p);
      } else {
        setPenaltyAmount(0);
      }
    }
  };

  const fetchAccounts = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      let cifStr = params.get('cifNo') || params.get('cif');
      let customerIdStr = params.get('customerId') || params.get('customerID');
      let memberIdStr = params.get('memberId') || params.get('memberID');
      let entityIdStr = params.get('entityId');
      let rdAccountIdStr = params.get('rdAccountId') || params.get('id');
      let customerNameStr = params.get('customerName');

      // Also read from universal sessionStorage bridge
      if (!cifStr && !customerIdStr && !memberIdStr && !rdAccountIdStr && !entityIdStr) {
        try {
          const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
          if (rawBridge) {
            sessionStorage.removeItem('cbs_active_customer_transfer');
            const bridgeData = JSON.parse(rawBridge);
            if (bridgeData) {
              cifStr = bridgeData.cifNo || bridgeData.cif;
              customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
              memberIdStr = bridgeData.memberId ? String(bridgeData.memberId) : null;
              customerNameStr = bridgeData.customerName || customerNameStr;
            }
          }
        } catch (e) {
          console.error('Failed to read sessionStorage transfer:', e);
        }
      }

      const getAccCustId = (a: any) => Number(a.customerID ?? a.customerId ?? a.CustomerID ?? 0);
      const getAccMemId = (a: any) => Number(a.memberID ?? a.memberId ?? a.MemberID ?? 0);
      const getAccCif = (a: any) => String(a.cifNo ?? a.CIFNo ?? a.cif ?? '').trim().toUpperCase();

      const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
      const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
      const targetAccId = rdAccountIdStr ? parseInt(rdAccountIdStr, 10) : (entityIdStr ? parseInt(entityIdStr, 10) : 0);
      let fastTrackDone = false;

      // ⚡ FAST-TRACK 1: Direct targeted account ID lookup (~15-20ms)
      if (targetAccId > 0) {
        try {
          const singleRes = await axios.get(`/api/RdAccounts/${targetAccId}`);
          const accData = singleRes.data?.AccountDetails || singleRes.data;
          if (accData && accData.rdAccountID) {
            selectRdAccount(accData);
            setAccounts([accData]);
            setCustomerMatchingRds([accData]);
            fastTrackDone = true;
          }
        } catch (err) {
          console.warn('Fast-track targeted RD account lookup failed, falling back', err);
        }
      }
      // ⚡ FAST-TRACK 2: Direct targeted customer / member ID lookup (~20-30ms)
      else if (cId > 0 || mId > 0) {
        try {
          const queryParam = cId > 0 ? `customerId=${cId}` : `memberId=${mId}`;
          const custRes = await axios.get(`/api/RdAccounts?${queryParam}`);
          const custAccounts: RdAccount[] = (custRes.data || []).filter((a: any) => a.status === 'Active' || a.status === 'Matured');
          if (custAccounts.length > 0) {
            setAccounts(custAccounts);
            if (custAccounts.length === 1) {
              selectRdAccount(custAccounts[0]);
              setCustomerMatchingRds(custAccounts);
              setNoRdFoundAlert(null);
            } else {
              setCustomerMatchingRds(custAccounts);
              const custName = customerNameStr || custAccounts[0].customerName || custAccounts[0].memberName || 'खातेदार';
              const primaryCif = cifStr || custAccounts[0].cifNo || '-';
              setMultiRdCustomerInfo({
                name: custName,
                cifNo: primaryCif,
                customerId: cId || getAccCustId(custAccounts[0])
              });
              setShowMultiRdModal(true);
              setNoRdFoundAlert(null);
            }
            fastTrackDone = true;
          }
        } catch (err) {
          console.warn('Fast-track customer RD lookup failed, falling back', err);
        }
      }

      // Background loading of full accounts list for dropdown searches
      axios.get('/api/RdAccounts').then(res => {
        const active: RdAccount[] = (res.data || []).filter((a: any) => a.status === 'Active' || a.status === 'Matured');
        setAccounts(prev => {
          if (prev.length > 0 && fastTrackDone) {
            return active;
          }
          return active;
        });

        // If fast-track did not trigger, process in-memory
        if (!fastTrackDone && (cifStr || customerIdStr || memberIdStr || entityIdStr || rdAccountIdStr)) {
          const cleanCif = cifStr ? cifStr.trim().toUpperCase() : '';
          const cleanDigits = cleanCif ? cleanCif.replace(/\D/g, '') : '';

          let matched: RdAccount[] = [];

          if (targetAccId > 0) {
            matched = active.filter((a: any) => a.rdAccountID === targetAccId || a.memberID === targetAccId);
          } else if (cleanCif) {
            matched = active.filter((a: any) => {
              const aCif = getAccCif(a);
              if (!aCif) return false;
              if (aCif === cleanCif) return true;
              if (cleanDigits && aCif.replace(/\D/g, '') === cleanDigits) return true;
              return false;
            });
          } else if (cId > 0) {
            matched = active.filter((a: any) => getAccCustId(a) === cId);
          } else if (mId > 0) {
            matched = active.filter((a: any) => getAccMemId(a) === mId || getAccCustId(a) === mId);
          }

          if (matched.length === 1) {
            selectRdAccount(matched[0]);
            setCustomerMatchingRds(matched);
            setNoRdFoundAlert(null);
          } else if (matched.length > 1) {
            setCustomerMatchingRds(matched);
            const custName = customerNameStr || matched[0].customerName || matched[0].memberName || 'खातेदार';
            const primaryCif = cleanCif || getAccCif(matched[0]) || '-';
            setMultiRdCustomerInfo({
              name: custName,
              cifNo: primaryCif,
              customerId: cId || getAccCustId(matched[0])
            });
            setShowMultiRdModal(true);
            setNoRdFoundAlert(null);
          } else {
            setCustomerMatchingRds([]);
            const identifier = cleanCif ? `CIF: ${cleanCif}` : (cId ? `ID: ${cId}` : `Member: ${mId}`);
            setNoRdFoundAlert(`निवडलेल्या खातेदाराचे (${customerNameStr || identifier}) कोणतेही सक्रिय आरडी खाते आढळले नाही.`);
          }
        }
      }).catch(err => {
        console.error('Error fetching full RD accounts list', err);
      });
    } catch (err) {
      console.error('Error fetching RD accounts', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (isPassingMode && voucherId) {
      loadPassingInstallment(voucherId);
    }
  }, [isPassingMode, voucherId]);

  const loadPassingInstallment = async (vId: number) => {
    setPassingLoading(true);
    try {
      const res = await axios.get(`/api/RdAccounts/installment-by-voucher/${vId}`);
      const { rdAccount, installmentDetails, voucher } = res.data;
      setPassingVoucherData(voucher);

      if (rdAccount) {
        setSelectedAccId(rdAccount.rdAccountID.toString());
        setSelectedAcc(rdAccount);
      }
      if (installmentDetails) {
        setCount(installmentDetails.installmentCount || 1);
        setPenaltyAmount(installmentDetails.penaltyAmount || 0);
      }
    } catch (err: any) {
      console.error('Error loading RD installment voucher:', err);
      alert('आरडी हप्ता व्हाउचर लोड करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingLoading(false);
    }
  };

  const handlePassVoucher = async () => {
    if (!voucherId) return;
    if (!window.confirm('आपण खात्रीपूर्वक हे आरडी हप्ता व्हाउचर मंजूर व पास करू इच्छिता?')) return;
    setPassingActionLoading(true);
    try {
      await axios.post('/api/VoucherPosting/Post', [voucherId]);
      alert('व्हाउचर यशस्वीरीत्या मंजूर व पास करण्यात आले!');
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      alert('व्हाउचर पास करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingActionLoading(false);
    }
  };

  const handleRejectVoucher = async () => {
    if (!voucherId) return;
    if (!rejectReason.trim()) {
      alert('कृपया नामंजूर / रद्द करण्याचे कारण नमूद करा.');
      return;
    }
    setPassingActionLoading(true);
    try {
      await axios.delete(`/api/VoucherPosting/${voucherId}?reason=${encodeURIComponent(rejectReason)}`);
      alert('व्हाउचर यशस्वीरित्या नामंजूर / रद्द करण्यात आले!');
      setRejectModalOpen(false);
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      alert('व्हाउचर रद्द करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingActionLoading(false);
    }
  };

  const handleAccountChange = (e: any) => {
    const val = e?.target?.value ?? e;
    setSelectedAccId(val);
    const acc = accounts.find((a) => a.rdAccountID === parseInt(val, 10)) || null;
    setSelectedAcc(acc);
    setCount(1);

    if (acc) {
      // Auto-penalty calculation rules: compare OpeningDate + Paid Months vs Today
      const start = new Date(acc.openingDate);
      start.setMonth(start.getMonth() + acc.totalPaidInstallments);
      const today = new Date();

      const diffMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
      if (diffMonths > 0) {
        // 2% penalty per overdue month
        const p = Math.round(acc.installmentAmount * 0.02 * diffMonths);
        setPenaltyAmount(p);
      } else {
        setPenaltyAmount(0);
      }
    } else {
      setPenaltyAmount(0);
    }
  };

  // Initialize Bulk Rows when mode changes
  useEffect(() => {
    if (isBulk && accounts.length > 0) {
      const initial: typeof bulkRows = {};
      accounts.forEach((acc) => {
        const start = new Date(acc.openingDate);
        start.setMonth(start.getMonth() + acc.totalPaidInstallments);
        const today = new Date();
        const diffMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
        const penalty = diffMonths > 0 ? Math.round(acc.installmentAmount * 0.02 * diffMonths) : 0;

        initial[acc.rdAccountID] = {
          count: 1,
          penalty: penalty,
          selected: false,
        };
      });
      setBulkRows(initial);
    }
  }, [isBulk, accounts]);

  const handleBulkRowChange = (id: number, field: string, val: any) => {
    setBulkRows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: val,
      },
    }));
  };

  const handleSelectAllBulk = (checked: boolean) => {
    setBulkRows((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((idStr) => {
        const id = Number(idStr);
        updated[id] = { ...updated[id], selected: checked };
      });
      return updated;
    });
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcc) {
      setError('कृपया आरडी खाते निवडा.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.post(
        `/api/RdAccounts/${selectedAcc.rdAccountID}/CollectInstallment?count=${count}&penaltyAmount=${penaltyAmount}&payMode=${payMode}&collectionDate=${collectionDate}`
      );
      setSuccess(`✅ आरडी हप्ता यशस्वीरीत्या जमा झाला! खाते क्रमांक: ${selectedAcc.accountNo}`);

      setSelectedAccId('');
      setSelectedAcc(null);
      setCount(1);
      setPenaltyAmount(0);
      fetchAccounts();
    } catch (err: any) {
      const errText = typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message || 'हप्ता संकलन करताना त्रुटी आली.';
      setError(errText);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async () => {
    const selectedIds = Object.keys(bulkRows)
      .map(Number)
      .filter((id) => bulkRows[id].selected);

    if (selectedIds.length === 0) {
      setError('कृपया हप्ता भरण्यासाठी किमान एक खाते निवडा.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      let successCount = 0;
      for (const id of selectedIds) {
        const row = bulkRows[id];
        await axios.post(
          `/api/RdAccounts/${id}/CollectInstallment?count=${row.count}&penaltyAmount=${row.penalty}&payMode=Cash&collectionDate=${collectionDate}`
        );
        successCount++;
      }
      setSuccess(`✅ एकत्रित संकलन यशस्वी! ${successCount} खात्यांचे हप्ते जमा झाले.`);
      fetchAccounts();
    } catch (err: any) {
      const errText = typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message || 'एकत्रित संकलन करताना त्रुटी आली.';
      setError(errText);
    } finally {
      setLoading(false);
    }
  };

  const labelClass = "block text-xs font-semibold text-slate-700 mb-1.5";
  const inputClass = "w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none bg-white text-slate-900 font-medium transition duration-150";

  const selectedBulkCount = Object.values(bulkRows).filter((r) => r.selected).length;

  return (
    <div className="p-3 md:p-5 max-w-full h-full flex flex-col bg-slate-50 text-xs font-sans space-y-4">
      {/* Header Bar */}
      <div className="bg-white p-3.5 md:p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-800">
                मासिक आरडी हप्ता संकलन (RD Installment Collection)
              </h1>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded border border-indigo-100">
                हप्ता संकलन
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              खातेदारांच्या आरडी खात्यांचा मासिक हप्ता व थकीत दंड जमा करा.
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        {!isPassingMode ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { setIsBulk(false); setError(''); setSuccess(''); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                !isBulk 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>एकल (Single)</span>
            </button>

            <button
              type="button"
              onClick={() => { setIsBulk(true); setError(''); setSuccess(''); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                isBulk 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>एकत्रित (Bulk)</span>
            </button>
          </div>
        ) : (
          <span className="bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded text-xs flex items-center gap-1">
            🔒 व्हाउचर तपासणी मोड (Checker Mode)
          </span>
        )}
      </div>

      {/* Checker Mode Amber Alert Banner */}
      {isPassingMode && (
        <div className="bg-amber-500 text-slate-950 p-3 rounded shadow-md border-2 border-amber-600 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-slate-950 shrink-0" />
            <div>
              <div className="font-extrabold text-sm uppercase tracking-wide">
                आरडी हप्ता भरणा व्हाउचर तपासणी (RD Installment Collection Checker Mode)
              </div>
              <div className="text-xs text-amber-950 font-medium mt-0.5">
                व्हाउचर क्र: <span className="font-mono font-bold">{passingVoucherData?.voucherNo || voucherId}</span> |
                रक्कम: <span className="font-bold">₹{passingVoucherData?.totalAmount?.toLocaleString('en-IN') || (selectedAcc ? selectedAcc.installmentAmount * count + penaltyAmount : 0)}</span> |
                तारीख: <span className="font-bold">{passingVoucherData?.voucherDate ? new Date(passingVoucherData.voucherDate).toLocaleDateString('mr-IN') : new Date().toLocaleDateString('mr-IN')}</span> |
                स्थिती: <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold text-[10px]">{passingVoucherData?.status || 'Pending'}</span>
              </div>
            </div>
          </div>
          <div className="text-xs font-bold bg-amber-100 text-amber-950 px-2.5 py-1 rounded border border-amber-400">
            🔒 तपासणी मोड: फक्त वाचन अनुज्ञेय (Read Only Lockdown)
          </div>
        </div>
      )}

      {/* Alert Messages */}
      {noRdFoundAlert && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">{noRdFoundAlert}</span>
          </div>
          <button onClick={() => setNoRdFoundAlert(null)} className="font-bold text-amber-700 hover:text-black cursor-pointer">✕</button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-2 text-xs">
          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="flex-1 font-medium">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg flex items-center gap-2 text-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1 font-bold">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Mode Renderings */}
      {!isBulk ? (
        /* Single Account Collection Form */
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 max-w-xl mx-auto space-y-4 w-full">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Coins className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              हप्ता जमा फॉर्म (Single Collection)
            </h2>
          </div>

          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <fieldset disabled={isPassingMode} className="contents">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`${labelClass} !mb-0`}>
                  आरडी खाते क्रमांक निवडा (Select RD Account) <span className="text-red-500">*</span>
                </label>
                {customerMatchingRds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = customerMatchingRds[0];
                      setMultiRdCustomerInfo({
                        name: first.customerName || first.memberName || 'खातेदार',
                        cifNo: first.cifNo || '-',
                        customerId: first.customerID
                      });
                      setShowMultiRdModal(true);
                    }}
                    className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors"
                  >
                    <Layers className="w-3 h-3 text-indigo-600" />
                    <span>खातेदाराची {customerMatchingRds.length} आरडी खाती उपलब्ध (खाते निवडा ⚡)</span>
                  </button>
                )}
              </div>
              <SearchableSelect
                options={accounts.map((a) => {
                  const legBadge = a.legacyAccountNumber ? ` [🏷️ जुने आरडी: ${a.legacyAccountNumber}]` : '';
                  return {
                    value: a.rdAccountID,
                    label: `${a.accountNo}${legBadge} - ${a.memberName} (${a.schemeName})`,
                  };
                })}
                value={selectedAccId}
                onChange={handleAccountChange}
                placeholder="नाव किंवा खाते क्रमांकाने शोधा..."
                disabled={isPassingMode}
              />
            </div>

            {/* Selected Account Details Card */}
            {payMode === 'Cash' && (
              <CashLedgerReflectBadge 
                transactionType="Collection" 
                customTitle="हप्ता जमा होणारे रोख खाते (Cash Collection Ledger)"
              />
            )}

            {selectedAcc && (
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-700 shadow-2xs">
                <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                  <div>
                    <span className="text-slate-500 text-[11px] font-semibold">खातेदार नाव: </span>
                    <span className="font-bold text-slate-900 text-xs">{selectedAcc.memberName}</span>
                  </div>
                  {selectedAcc.legacyAccountNumber && (
                    <span className="bg-purple-100 text-purple-950 border border-purple-300 px-1.5 py-0.2 rounded font-mono font-bold text-[9.5px]">
                      🏷️ जुने आरडी: {selectedAcc.legacyAccountNumber}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 text-[11px] block">मासिक हप्ता:</span>
                    <strong className="text-indigo-700 font-mono font-bold text-xs">
                      ₹ {selectedAcc.installmentAmount?.toLocaleString('en-IN')}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">हप्ते प्रगती (Progress):</span>
                    <strong className="text-slate-800 text-xs">
                      {selectedAcc.totalPaidInstallments} / {selectedAcc.durationMonths} महिने
                    </strong>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (selectedAcc.totalPaidInstallments / (selectedAcc.durationMonths || 1)) * 100
                      )}%`,
                    }}
                  ></div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500 text-[11px]">खाते स्थिती:</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      selectedAcc.status === 'Matured'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {selectedAcc.status === 'Matured' ? 'मुदतपूर्ती (Matured)' : 'सक्रिय (Active)'}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between !mb-0.5">
                  <label className={labelClass}>हप्ता भरणा तारीख (Collection Date) <span className="text-red-500">*</span></label>
                  {!allowDateOverride && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                      <Lock size={9} /> लॉक
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  name="collectionDate"
                  value={collectionDate || activeBusinessDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className={`${inputClass} ${!allowDateOverride ? 'bg-slate-100 cursor-not-allowed select-none font-semibold text-slate-800' : 'bg-white border-amber-400 font-bold'}`}
                  required
                  disabled={!allowDateOverride}
                  readOnly={!allowDateOverride}
                />
                {isHOUser && (
                  <label className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer font-normal mt-0.5 select-none">
                    <input
                      type="checkbox"
                      checked={allowDateOverride}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAllowDateOverride(checked);
                        if (!checked) {
                          setCollectionDate(activeBusinessDate);
                        }
                      }}
                      className="w-3 h-3 text-primary rounded"
                    />
                    <span className="flex items-center gap-0.5">
                      {allowDateOverride ? <Unlock size={10} className="text-amber-600" /> : <Lock size={10} className="text-gray-400" />}
                      तारीख बदला (Override)
                    </span>
                  </label>
                )}
                {allowDateOverride && collectionDate !== activeBusinessDate && (
                  <div className="text-[9px] text-amber-800 bg-amber-50 border border-amber-300 rounded px-1 py-0.5 mt-0.5 flex items-center gap-1 leading-tight">
                    <AlertCircle size={10} className="shrink-0 text-amber-600" />
                    <span>लॉगिन तारीख {activeBusinessDate} व्यतिरिक्त इतर तारीख निवडली आहे.</span>
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>पेमेंट मोड (Payment Mode)</label>
                <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className={inputClass}>
                  <option value="Cash">रोख (Cash)</option>
                  <option value="Bank">बँक ट्रान्सफर (Bank Transfer)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>हप्ते संख्या (Quantity)</label>
                <input
                  type="number"
                  name="count"
                  value={count}
                  onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className={inputClass}
                  min="1"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>थकीत दंड (Penalty ₹)</label>
                <input
                  type="number"
                  name="penaltyAmount"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={inputClass}
                  min="0"
                />
              </div>
            </div>

            {selectedAcc && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center text-slate-800 text-xs shadow-2xs">
                <span className="font-semibold text-slate-700">एकूण जमा रक्कम (Total Payable):</span>
                <span className="text-base font-bold font-mono text-emerald-700">
                  ₹ {(selectedAcc.installmentAmount * count + penaltyAmount).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}

            </fieldset>

            {isPassingMode ? (
              <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting')}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-lg shadow-xs text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>↩️</span> पासिंग यादीवर परत जा
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(true)}
                    disabled={passingActionLoading}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span>❌</span> नामंजूर / रद्द करा
                  </button>

                  <button
                    type="button"
                    onClick={handlePassVoucher}
                    disabled={passingActionLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span>✅</span> {passingActionLoading ? 'मंजूर होत आहे...' : 'मंजूर व पास करा (Pass)'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !selectedAcc}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition duration-200 text-xs shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'प्रक्रिया होत आहे...' : 'हप्ता जमा करा (Collect Installment)'}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      ) : (
        /* Bulk Accounts Collection Table View */
        <div className="bg-white p-4 md:p-5 rounded-xl shadow-xs border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800">एकत्रित हप्ता संकलन यादी (Bulk Collection List)</h2>
              {selectedBulkCount > 0 && (
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-full text-[10px] border border-indigo-100">
                  {selectedBulkCount} खाती निवडली
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">तारीख:</label>
                <input
                  type="date"
                  value={collectionDate || activeBusinessDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className={`text-xs border border-slate-300 rounded px-2 py-0.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-medium ${!allowDateOverride ? 'bg-slate-100 cursor-not-allowed text-slate-800 select-none' : 'bg-white text-slate-900'}`}
                  disabled={!allowDateOverride}
                  readOnly={!allowDateOverride}
                />
                {!allowDateOverride && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                    <Lock size={9} /> लॉक
                  </span>
                )}
              </div>

              <button
                onClick={handleBulkSubmit}
                disabled={loading || selectedBulkCount === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition duration-200 disabled:opacity-50 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'प्रक्रिया होत आहे...' : 'निवडलेले हप्ते जमा करा'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3 w-12 text-center">
                    <input
                      type="checkbox"
                      onChange={(e) => handleSelectAllBulk(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      title="सर्व निवडा"
                    />
                  </th>
                  <th className="py-2.5 px-3">खाते क्रमांक / नाव</th>
                  <th className="py-2.5 px-3 text-center">मासिक हप्ता (₹)</th>
                  <th className="py-2.5 px-3 text-center">भरलेले / एकूण महिने</th>
                  <th className="py-2.5 px-3 text-center w-28">हप्ते (Qty)</th>
                  <th className="py-2.5 px-3 text-center w-28">दंड (₹)</th>
                  <th className="py-2.5 px-3 text-right">एकूण जमा (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                      कोणतीही सक्रिय आरडी खाती उपलब्ध नाहीत.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => {
                    const row = bulkRows[acc.rdAccountID] || { count: 1, penalty: 0, selected: false };
                    const subtotal = acc.installmentAmount * row.count + row.penalty;
                    return (
                      <tr key={acc.rdAccountID} className="hover:bg-slate-50/80 transition duration-150">
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => handleBulkRowChange(acc.rdAccountID, 'selected', e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <div className="font-mono font-bold text-indigo-700 flex items-center gap-1.5">
                            <span>{acc.accountNo}</span>
                            {acc.legacyAccountNumber && (
                              <span className="bg-purple-100 text-purple-950 border border-purple-300 px-1 py-0.2 rounded font-mono font-bold text-[9px]">
                                🏷️ {acc.legacyAccountNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            {acc.memberName} ({acc.schemeName})
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-700">
                          ₹{acc.installmentAmount?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium">
                          {acc.totalPaidInstallments} / {acc.durationMonths}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            value={row.count}
                            onChange={(e) =>
                              handleBulkRowChange(acc.rdAccountID, 'count', Math.max(1, parseInt(e.target.value, 10) || 1))
                            }
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-slate-800 text-xs focus:outline-none focus:border-indigo-600 font-bold"
                            min="1"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            value={row.penalty}
                            onChange={(e) =>
                              handleBulkRowChange(acc.rdAccountID, 'penalty', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-slate-800 text-xs focus:outline-none focus:border-indigo-600 font-medium"
                            min="0"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

      {/* Reject Confirmation Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 border-b border-rose-100 pb-2">
              <span className="text-xl">❌</span>
              <h3 className="font-bold text-sm">आरडी हप्ता भरणा व्हाउचर नामंजूर / रद्द करा</h3>
            </div>

            <p className="text-xs text-gray-600">
              व्हाउचर क्र. <strong className="text-gray-900 font-mono">{passingVoucherData?.voucherNo || voucherId}</strong> नामंजूर करण्याचे कारण खालीलप्रमाणे नोंदवा:
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="नामंजूर / रद्द करण्याचे कारण प्रविष्ट करा..."
              rows={3}
              className="w-full text-xs border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500 font-sans"
              required
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                disabled={passingActionLoading}
                className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                मागे फिरा
              </button>
              <button
                type="button"
                onClick={handleRejectVoucher}
                disabled={passingActionLoading || !rejectReason.trim()}
                className="px-4 py-1.5 text-xs font-bold rounded bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
              >
                {passingActionLoading ? 'रद्द होत आहे...' : 'होय, व्हाउचर रद्द करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Multi-RD Account Selector Modal (CIF-First) */}
      {showMultiRdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-indigo-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-900 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <Coins className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="font-bold text-sm flex items-center gap-2">
                    <span>आरडी खाते निवडा (Select RD Account)</span>
                    <span className="text-[10px] bg-amber-400 text-indigo-950 font-black px-2 py-0.5 rounded-full">
                      एकूण {customerMatchingRds.length} आरडी खाती
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    खातेदार: <strong className="text-white">{multiRdCustomerInfo?.name || 'खातेदार'}</strong>
                    {multiRdCustomerInfo?.cifNo && multiRdCustomerInfo.cifNo !== '-' && (
                      <span className="ml-2 font-mono text-amber-200">
                        [CIF: {multiRdCustomerInfo.cifNo}]
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMultiRdModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded cursor-pointer transition-colors"
                title="बंद करा"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: List of RD Accounts */}
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2.5 bg-slate-50">
              <div className="text-xs text-slate-700 font-semibold mb-2 flex items-center justify-between">
                <span>कृपया हप्ता जमा करण्यासाठी योग्य आरडी खाते निवडा:</span>
                <span className="text-[11px] text-slate-500">क्लिक करून निवडा</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {customerMatchingRds.map((acc: RdAccount) => {
                  const isCurrent = selectedAcc?.rdAccountID === acc.rdAccountID;
                  return (
                    <div
                      key={acc.rdAccountID}
                      onClick={() => {
                        selectRdAccount(acc);
                        setShowMultiRdModal(false);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-400 shadow-sm'
                          : 'bg-white hover:bg-indigo-50/40 border-slate-200 hover:border-indigo-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-slate-900 tracking-wide">
                              {acc.accountNo}
                            </span>
                            {acc.legacyAccountNumber && (
                              <span className="bg-purple-100 text-purple-950 border border-purple-300 px-1.5 py-0.2 rounded font-mono font-bold text-[9.5px]">
                                🏷️ जुने आरडी: {acc.legacyAccountNumber}
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {acc.status || 'Active'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-semibold mt-1">
                            योजना: <span className="text-slate-800 font-bold">{acc.schemeName}</span>
                            {acc.openingDate && (
                              <span className="text-slate-400 font-normal ml-2">
                                (सुरू: {new Date(acc.openingDate).toLocaleDateString('en-GB')})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            हप्ता भरले: <span className="font-semibold text-slate-700">{acc.totalPaidInstallments || 0} / {acc.durationMonths} महिने</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">मासिक हप्ता रक्कम</div>
                          <div className="text-sm font-black text-indigo-700">
                            ₹ {(acc.installmentAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectRdAccount(acc);
                            setShowMultiRdModal(false);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isCurrent
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-300'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{isCurrent ? 'निवडलेले आहे' : 'हे खाते निवडा'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">
                आरडी खाते निवडल्यावर दंड व हप्ता तपशील आपोआप लोड होतील.
              </span>
              <button
                type="button"
                onClick={() => setShowMultiRdModal(false)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold cursor-pointer transition-colors"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
