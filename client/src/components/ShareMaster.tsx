import React, { useState, useEffect, useRef } from 'react';
import MemberSearchSelect from './common/MemberSearchSelect';
import ShareCertificatePreview from './ShareCertificatePreview';
import VoucherPrint from './VoucherPrint';
import SearchableSelect from './SearchableSelect';
import { 
  PlusCircle, 
  Users, 
  BookOpen, 
  Printer, 
  Edit2, 
  Trash2, 
  RotateCcw, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Scale,
  CreditCard,
  Building,
  Wallet,
  ArrowRight,
  FileSpreadsheet,
  Layers,
  IndianRupee,
  Coins,
  X,
  Plus,
  Save,
  ChevronLeft,
  ChevronRight,
  Hash,
  UserPlus,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Member {
  memberID: number;
  customerID?: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  memberCode: string;
  cifNo?: string;
  legacyMemberNo?: string;
  mobileNo?: string;
  village?: string;
  taluka?: string;
  address?: string;
}

interface ShareAccount {
  shareAccountId: number;
  accountNo: string;
  totalShareAmount: number;
  totalShareCount: number;
  dividendPayableBalance?: number;
  openingDate?: string;
  status?: string;
}

interface CertificateData {
  certificateId: number;
  certificateNo: string;
  issueDate: string;
  memberName: string;
  memberNo: string;
  fromShareNo: number;
  toShareNo: number;
  numberOfShares: number;
  faceValue: number;
  totalAmount: number;
  memberAddress?: string;
  fatherHusbandName?: string;
  status: string;
  printCount: number;
}

interface ShareTransactionData {
  transactionId: number;
  shareAccountId: number;
  transactionDate: string;
  transactionType: string;
  numberOfShares: number;
  amount: number;
  narration?: string;
  voucherId?: number;
  voucherNo?: string;
  voucherType?: string;
  voucherStatus?: string;
  paymentMode?: string;
  memberId?: number;
  memberCode?: string;
  memberName?: string;
  accountNo?: string;
}

interface ShareMasterProps {
  initialMemberId?: string | number | null;
  onNavigate?: (tab: string, params?: any) => void;
}

export default function ShareMaster({ initialMemberId, onNavigate }: ShareMasterProps = {}) {
  // Master Data
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [legacyMemberNo, setLegacyMemberNo] = useState('');
  const [nextCertNo, setNextCertNo] = useState('CERT-2026-00001');
  const [nextFromShareNo, setNextFromShareNo] = useState<number>(1);
  const [shareAccount, setShareAccount] = useState<ShareAccount | null>(null);
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [memberTransactions, setMemberTransactions] = useState<ShareTransactionData[]>([]);
  const [allTransactions, setAllTransactions] = useState<ShareTransactionData[]>([]);

  // Pending Membership Applications Awaiting Share Allotment
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');

  // Pop-up Modal for All Transactions
  const [showAllTxnModal, setShowAllTxnModal] = useState(false);
  const [memberHistoryTab, setMemberHistoryTab] = useState<'certificates' | 'ledger'>('certificates');

  // Payment Form States
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Transfer' | 'Bank' | 'LedgerTransfer'>('Cash');
  const [memberSavingAccounts, setMemberSavingAccounts] = useState<any[]>([]);
  const [selectedSavingAccountId, setSelectedSavingAccountId] = useState<number | ''>('');
  const [chequeNo, setChequeNo] = useState('');
  const [allLedgers, setAllLedgers] = useState<any[]>([]);
  const [selectedSourceLedgerId, setSelectedSourceLedgerId] = useState<number | ''>('');
  const [selectedBankLedgerId, setSelectedBankLedgerId] = useState<number | ''>('');
  const [selectedCashLedgerId, setSelectedCashLedgerId] = useState<number | ''>(47);

  // Form Inputs
  const [numberOfShares, setNumberOfShares] = useState<number | ''>('');
  const [faceValue, setFaceValue] = useState<number>(100);
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');

  // Live Auto-Calculations matching MemberMaster layout
  const shareCapitalAmount = (Number(numberOfShares) || 0) * (faceValue || 100);
  const hasShares = numberOfShares !== '' && Number(numberOfShares) > 0;
  const autoFromShareNo = nextFromShareNo || 1;
  const autoToShareNo = hasShares ? autoFromShareNo + Number(numberOfShares) - 1 : 0;
  const autoCertificateNo = hasShares ? (nextCertNo || `CERT-${new Date().getFullYear()}-00001`) : '-';

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Search for All Transactions Modal
  const [allTxnSearch, setAllTxnSearch] = useState('');

  // Modals for Actions
  const [previewCertificate, setPreviewCertificate] = useState<CertificateData | null>(null);
  const [printingVoucherId, setPrintingVoucherId] = useState<number | null>(null);
  const [editTxnModal, setEditTxnModal] = useState<{ open: boolean; txn: ShareTransactionData | null }>({ open: false, txn: null });
  const [editTxnDate, setEditTxnDate] = useState('');
  const [editTxnNarration, setEditTxnNarration] = useState('');
  const [editTxnReason, setEditTxnReason] = useState('');

  const [cancelAllotModal, setCancelAllotModal] = useState<{ open: boolean; txn: ShareTransactionData | null }>({ open: false, txn: null });
  const [cancellationReason, setCancellationReason] = useState('');

  const numberOfSharesInputRef = useRef<HTMLInputElement>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

  // Calculations for summary stats from transactions (excluding OpeningBalance)
  const summaryStats = React.useMemo(() => {
    let totalShares = 0;
    let totalAmount = 0;
    const memberSet = new Set<number>();
    const nonOpTxns = allTransactions.filter(t => t.transactionType !== 'OpeningBalance');

    nonOpTxns.forEach(t => {
      if (t.memberId) memberSet.add(t.memberId);
      if (t.transactionType === 'Allotment') {
        totalShares += t.numberOfShares || 0;
        totalAmount += t.amount || 0;
      } else if (t.transactionType === 'TransferOut' || t.transactionType === 'Transfer-Out' || t.transactionType === 'Surrender' || t.transactionType === 'Withdrawal') {
        totalShares -= t.numberOfShares || 0;
        totalAmount -= t.amount || 0;
      }
    });

    return {
      shareholderCount: memberSet.size,
      totalShares: Math.max(0, totalShares),
      totalAmount: Math.max(0, totalAmount),
      totalTransactions: nonOpTxns.length
    };
  }, [allTransactions]);

  const filteredAllTransactions = React.useMemo(() => {
    const list = allTransactions.filter(t => t.transactionType !== 'OpeningBalance');
    if (!allTxnSearch.trim()) return list;
    const q = allTxnSearch.toLowerCase().trim();
    return list.filter(t => {
      const name = (t.memberName || '').toLowerCase();
      const code = (t.memberCode || '').toLowerCase();
      const vch = (t.voucherNo || '').toLowerCase();
      const narr = (t.narration || '').toLowerCase();
      return name.includes(q) || code.includes(q) || vch.includes(q) || narr.includes(q);
    });
  }, [allTransactions, allTxnSearch]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchInitialData();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchPendingMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/Members/pending-allotment', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        setPendingMembers(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      if (isMountedRef.current) console.error('Error fetching pending members', e);
    }
  };

  const fetchInitialData = async () => {
    await Promise.all([
      fetchMembers(),
      fetchPendingMembers(),
      fetchNextShareConfig(),
      fetchLedgers(),
      fetchAllTransactions()
    ]);
  };

  const fetchLedgers = async () => {
    try {
      const res = await fetch('/api/Ledgers');
      if (res.ok) {
        const data = await res.json();
        if (!isMountedRef.current) return;
        setAllLedgers(data);
        if (data.length > 0) {
          setSelectedSourceLedgerId(data[0].ledgerID);

          const bLedgers = data.filter((l: any) => 
            (l.accountType || '').toLowerCase() === 'bank' || 
            (l.groupName || '').includes('बँक') || 
            (l.groupName || '').toLowerCase().includes('bank') || 
            (l.ledgerName || '').includes('बँक') || 
            (l.ledgerName || '').toLowerCase().includes('bank')
          );
          if (bLedgers.length > 0) {
            setSelectedBankLedgerId(bLedgers[0].ledgerID);
          } else {
            setSelectedBankLedgerId(data[0].ledgerID);
          }

          const cLedgers = data.filter((l: any) => 
            (l.accountType || '').toLowerCase() === 'cash' || 
            (l.ledgerName || '').includes('रोख') || 
            (l.ledgerName || '').toLowerCase().includes('cash')
          );
          if (cLedgers.length > 0) {
            setSelectedCashLedgerId(cLedgers[0].ledgerID);
          }
        }
      }
    } catch (e) {
      if (isMountedRef.current) console.error('Error fetching ledgers', e);
    }
  };

  const fetchNextShareConfig = async () => {
    try {
      const res = await fetch('/api/ShareAccounts/NextShareConfig');
      if (res.ok) {
        const data = await res.json();
        if (!isMountedRef.current) return;
        if (data.nextCertificateNo) setNextCertNo(data.nextCertificateNo);
        if (data.nextFromShareNo) setNextFromShareNo(data.nextFromShareNo);
        if (data.faceValue) setFaceValue(data.faceValue);
      }
    } catch (e) {
      if (isMountedRef.current) console.error(e);
    }
  };

  const selectMemberById = (mId: number, memberList = members) => {
    const sel = memberList.find(m => m.memberID === mId);
    if (sel) {
      setSelectedMemberId(mId);
      setLegacyMemberNo(sel.legacyMemberNo || '');
      loadShareData(mId);
    }
  };

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const membersRes = await fetch('/api/Members', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (membersRes.ok) {
        const data = await membersRes.json();
        if (!isMountedRef.current) return;
        const safeList: Member[] = Array.isArray(data) ? data : [];
        setMembers(safeList);

        if (safeList.length > 0) {
          const urlParams = new URLSearchParams(window.location.search);
          const memberIdParam = initialMemberId || urlParams.get('memberId');
          if (memberIdParam) {
            const mId = parseInt(String(memberIdParam));
            const target = safeList.find(m => m.memberID === mId);
            if (target) {
              selectMemberById(mId, safeList);
            }
          }
        }
      }
    } catch (e) {
      if (isMountedRef.current) console.error(e);
    }
  };

  useEffect(() => {
    if (initialMemberId && members.length > 0) {
      const mId = parseInt(String(initialMemberId));
      if (!isNaN(mId) && mId !== selectedMemberId) {
        selectMemberById(mId, members);
      }
    }
  }, [initialMemberId, members]);

  const fetchAllTransactions = async () => {
    try {
      const res = await fetch('/api/ShareAccounts/AllTransactions');
      if (res.ok) {
        const data = await res.json();
        if (!isMountedRef.current) return;
        setAllTransactions(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      if (isMountedRef.current) console.error(e);
    }
  };

  const fetchMemberSavingAccounts = async (memberId: number, customerId?: number) => {
    try {
      const selected = members.find((m: any) => m.memberID === memberId);
      const cId = customerId || selected?.customerID;
      const url = cId 
        ? `/api/SavingAccounts?customerId=${cId}&memberId=${memberId}`
        : `/api/SavingAccounts?memberId=${memberId}`;
      const res = await fetch(url);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (!isMountedRef.current) return;
          const memberAccs = Array.isArray(data) ? data.filter((a: any) => a.status === 'Active') : [];
          setMemberSavingAccounts(memberAccs);
          if (memberAccs.length > 0) {
            setSelectedSavingAccountId(memberAccs[0].savingAccountId || memberAccs[0].savingAccountID);
          } else {
            setSelectedSavingAccountId('');
          }
        }
      }
    } catch (err) {
      if (isMountedRef.current) console.error('Failed to fetch saving accounts', err);
    }
  };

  const loadShareData = async (memberId: number) => {
    setLoading(true);
    setShareAccount(null);
    setCertificates([]);
    setMemberTransactions([]);
    setMessage(null);
    const selected = members.find((m: any) => m.memberID === memberId);
    fetchMemberSavingAccounts(memberId, selected?.customerID);
    try {
      const [accRes, certRes, txnRes] = await Promise.all([
        fetch(`/api/ShareAccounts/ByMember/${memberId}`),
        fetch(`/api/ShareCertificates/ByMember/${memberId}`),
        fetch(`/api/ShareAccounts/TransactionsByMember/${memberId}`)
      ]);

      if (!isMountedRef.current) return;

      if (accRes.ok && accRes.headers.get('content-type')?.includes('application/json')) {
        setShareAccount(await accRes.json());
      }
      if (certRes.ok && certRes.headers.get('content-type')?.includes('application/json')) {
        setCertificates(await certRes.json());
      }
      if (txnRes.ok && txnRes.headers.get('content-type')?.includes('application/json')) {
        const tData = await txnRes.json();
        const validTxns = Array.isArray(tData) ? tData.filter((t: any) => t.transactionType !== 'OpeningBalance') : [];
        setMemberTransactions(validTxns);
      }
    } catch (err) {
      if (isMountedRef.current) setMessage({ text: 'नेटवर्क त्रुटी: डेटा लोड होऊ शकला नाही.', type: 'error' });
    }
    if (isMountedRef.current) setLoading(false);

    setTimeout(() => {
      if (numberOfSharesInputRef.current) {
        numberOfSharesInputRef.current.focus();
        numberOfSharesInputRef.current.select();
      }
    }, 100);
  };

  const selectedMember = members.find(m => m.memberID === selectedMemberId);

  const resetForm = () => {
    setSelectedMemberId('');
    setLegacyMemberNo('');
    setShareAccount(null);
    setCertificates([]);
    setMemberTransactions([]);
    setNumberOfShares('');
    setNarration('');
    setPaymentMode('Cash');
    setMessage(null);
    fetchNextShareConfig();
  };

  // ➕ CREATE: Allot Shares
  const handleAllot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) {
      setMessage({ text: '⚠️ कृपया प्रथम खातेदार / सभासद निवडा.', type: 'error' });
      return;
    }
    if (!numberOfShares || Number(numberOfShares) <= 0) {
      setMessage({ text: '⚠️ कृपया शेअर्स संख्या (कमितकमी १) प्रविष्ट करा.', type: 'error' });
      return;
    }

    if (paymentMode === 'Transfer' && !selectedSavingAccountId) {
      setMessage({ text: '⚠️ कृपया रक्कम वर्ग करण्यासाठी बचत खाते निवडा.', type: 'error' });
      return;
    }
    if (paymentMode === 'Bank' && !selectedBankLedgerId) {
      setMessage({ text: '⚠️ कृपया बँक खाते लेजर निवडा.', type: 'error' });
      return;
    }
    if (paymentMode === 'LedgerTransfer' && !selectedSourceLedgerId) {
      setMessage({ text: '⚠️ कृपया रक्कम वर्ग करण्यासाठी लेजर निवडा.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const payload = {
      memberId: selectedMemberId,
      numberOfShares: Number(numberOfShares),
      transactionDate: transactionDate,
      faceValue: faceValue,
      fromShareNo: autoFromShareNo,
      toShareNo: autoToShareNo,
      certificateNo: autoCertificateNo !== '-' ? autoCertificateNo : null,
      paymentMode: paymentMode,
      savingAccountId: paymentMode === 'Transfer' ? selectedSavingAccountId : null,
      bankLedgerId: paymentMode === 'Bank' ? selectedBankLedgerId : null,
      sourceLedgerId: paymentMode === 'LedgerTransfer' ? selectedSourceLedgerId : null,
      chequeNo: paymentMode === 'Bank' ? chequeNo : null,
      narration: narration.trim() || 'भाग भांडवल वाटप'
    };

    try {
      const res = await fetch('/api/ShareAccounts/Allot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ 
          text: `✅ ${data.message || 'शेअर्स वाटप यशस्वी झाले!'} (व्हाउचर क्र.: ${data.voucherNo || 'तयार झाले'}, प्रमाणपत्र: ${data.certificateNo || 'तयार झाले'})`, 
          type: 'success' 
        });
        setNumberOfShares('');
        setNarration('');
        loadShareData(selectedMemberId as number);
        fetchNextShareConfig();
        fetchMembers();
        fetchPendingMembers();
        fetchAllTransactions();
      } else {
        setMessage({ text: `❌ त्रुटी: ${data.message || 'वाटप अयशस्वी.'}`, type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'सर्व्हरशी संपर्क होऊ शकला नाही.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ✏️ UPDATE: Edit Transaction
  const handleOpenEditTxn = (txn: ShareTransactionData) => {
    setEditTxnModal({ open: true, txn });
    setEditTxnDate(txn.transactionDate ? txn.transactionDate.split('T')[0] : '');
    setEditTxnNarration(txn.narration || '');
    setEditTxnReason('');
  };

  const handleSaveEditTxn = async () => {
    if (!editTxnModal.txn) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ShareAccounts/Transactions/${editTxnModal.txn.transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionDate: editTxnDate,
          narration: editTxnNarration,
          editReason: editTxnReason
        })
      });

      if (res.ok) {
        setMessage({ text: '✅ व्यवहार यशस्वीरीत्या अद्ययावत केला!', type: 'success' });
        setEditTxnModal({ open: false, txn: null });
        if (selectedMemberId) loadShareData(selectedMemberId as number);
        fetchAllTransactions();
      } else {
        const err = await res.json();
        setMessage({ text: `❌ संपादन अयशस्वी: ${err.message || ''}`, type: 'error' });
      }
    } catch (e) {
      setMessage({ text: 'सर्व्हर त्रुटी.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ❌ DELETE / REVERSE: Cancel Allotment
  const handleOpenCancelAllot = (txn: ShareTransactionData) => {
    setCancelAllotModal({ open: true, txn });
    setCancellationReason('');
  };

  const handleConfirmCancelAllot = async () => {
    if (!cancelAllotModal.txn) return;
    if (!cancellationReason.trim()) {
      alert('कृपया रद्दीकरणाचे कारण प्रविष्ट करा.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/ShareAccounts/Transactions/${cancelAllotModal.txn.transactionId}/Cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancellationReason })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ text: `✅ ${data.message || 'शेअर वाटप यशस्वीरीत्या रद्द व रिव्हर्स केले!'}`, type: 'success' });
        setCancelAllotModal({ open: false, txn: null });
        if (selectedMemberId) loadShareData(selectedMemberId as number);
        fetchMembers();
        fetchAllTransactions();
        fetchNextShareConfig();
      } else {
        setMessage({ text: `❌ रद्दीकरण अयशस्वी: ${data.message || ''}`, type: 'error' });
      }
    } catch (e) {
      setMessage({ text: 'सर्व्हर त्रुटी.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCertificate = async (cert: CertificateData) => {
    const reason = window.prompt(`तुम्हाला प्रमाणपत्र क्र. ${cert.certificateNo} खरोखर रद्द करायचे आहे का? कृपया कारण प्रविष्ट करा:`);
    if (!reason) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/ShareCertificates/${cert.certificateId}/Cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      if (res.ok) {
        setMessage({ text: '✅ प्रमाणपत्र रद्द केले.', type: 'success' });
        if (selectedMemberId) loadShareData(selectedMemberId as number);
      } else {
        const err = await res.json();
        setMessage({ text: `❌ त्रुटी: ${err.message || ''}`, type: 'error' });
      }
    } catch (e) {
      setMessage({ text: 'सर्व्हर त्रुटी.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllTxnExcel = () => {
    if (filteredAllTransactions.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredAllTransactions.map((t, idx) => ({
      'अ.क्र.': idx + 1,
      'दिनांक': t.transactionDate ? t.transactionDate.split('T')[0] : '-',
      'सभासदाचे नाव': t.memberName || '-',
      'सभासद कोड': t.memberCode || t.accountNo || '-',
      'व्यवहार प्रकार': t.transactionType,
      'शेअर्स संख्या': t.numberOfShares,
      'रक्कम (₹)': t.amount,
      'व्हाउचर क्र.': t.voucherNo || '-',
      'शेरा / तपशील': t.narration || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ShareTransactions');
    XLSX.writeFile(wb, `Share_Transactions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* ========================================================================= */}
      {/* 1. TOP SLEEK CBS HEADER BANNER                                            */}
      {/* ========================================================================= */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Scale size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>भाग भांडवल व्यवस्थापन</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Share Capital Management)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              सुटसुटीत शेअर वाटप नोंद (Allotment Entry), खातावणी आणि शेअर प्रमाणपत्रे प्रिंटिंग
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* PENDING MEMBERS BUTTON */}
          <button
            type="button"
            onClick={() => {
              fetchPendingMembers();
              setShowPendingModal(true);
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer relative"
            title="सभासदत्व अर्ज भरलेले व शेअर्स वाटपासाठी प्रलंबित असलेले नवीन सभासद"
          >
            <UserPlus className="w-4 h-4" />
            <span>📋 नवीन सभासद अर्ज ({pendingMembers.length})</span>
            {pendingMembers.length > 0 && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद (Reset)</span>
          </button>

          {/* VIEW ALL TRANSACTIONS MODAL */}
          <button
            type="button"
            onClick={() => {
              fetchAllTransactions();
              setShowAllTxnModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="संस्थेतील सर्व शेअर वाटप व व्यवहार नोंदी पहा"
          >
            <BookOpen className="w-4 h-4" />
            <span>📋 सर्व शेअर्स व्यवहार ({allTransactions.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FOUR FINANCIAL KPI METRIC SUMMARY CARDS                                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण भागधारक</div>
            <div className="text-sm font-black text-gray-900">{summaryStats.shareholderCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण भाग भांडवल (₹)</div>
            <div className="text-sm font-black text-emerald-800">
              ₹{summaryStats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण शेअर्स संख्या</div>
            <div className="text-sm font-black text-indigo-950">{summaryStats.totalShares}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">संस्थेतील सर्व व्यवहार</div>
            <div className="text-sm font-black text-amber-800">{summaryStats.totalTransactions}</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`mb-3 p-2 rounded-sm font-bold flex items-center justify-between border text-xs shadow-2xs ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
          message.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-300' : 'bg-primary/5 text-primary border-primary/20'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
            {message.type === 'error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            {message.type === 'info' && <AlertTriangle className="w-4 h-4 text-primary shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setMessage(null)}
            className="text-gray-400 hover:text-gray-700 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MAIN CLEAN SINGLE UNIFIED ALLOTMENT FORM                               */}
      {/* ========================================================================= */}
      <div 
        ref={formContainerRef}
        className="bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border border-gray-200 space-y-3"
      >
        <form onSubmit={handleAllot} className="space-y-3">
          
          {/* Section 1: Member Selection & Share Details */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">१. सभासद व शेअर्स वाटप माहिती (Member & Share Details)</h2>
              </div>
              {selectedMember && (
                <div>
                  {(!shareAccount || shareAccount.totalShareCount === 0) ? (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded shadow-2xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      🆕 प्रथम भाग वाटप (Initial Allotment)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded shadow-2xs flex items-center gap-1">
                      <Coins className="w-3 h-3 text-indigo-600" />
                      ➕ अतिरिक्त शेअर्स वाटप (विद्यमान शेअर्स: {shareAccount.totalShareCount})
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>
                खातेदार / सभासद शोधा व निवडा (Select Member by Name / Code / Mobile) <span className="text-red-500">*</span>
              </label>
              <MemberSearchSelect
                members={members}
                value={selectedMemberId}
                onChange={(val) => {
                  if (val) {
                    const sel = members.find(m => m.memberID === val);
                    setSelectedMemberId(val as number);
                    setLegacyMemberNo(sel?.legacyMemberNo || '');
                    loadShareData(val as number);
                  } else {
                    setSelectedMemberId('');
                    setLegacyMemberNo('');
                    setShareAccount(null);
                    setCertificates([]);
                    setMemberTransactions([]);
                  }
                }}
                placeholder="-- सभासद नाव, कोड किंवा मोबाईलने शोधा व निवडा --"
                className="w-full text-xs"
              />
            </div>

            {/* Selected Member Info Preview Badge */}
            {selectedMember && (
              <div className="mt-2 p-2.5 bg-primary/5 border border-primary/20 rounded-sm text-[11px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <div className="font-bold text-gray-900 leading-tight text-xs flex items-center gap-2">
                    <span>{selectedMember.firstName} {selectedMember.middleName || ''} {selectedMember.lastName}</span>
                    {selectedMember.memberCode && !selectedMember.memberCode.startsWith('TEMP') ? (
                      <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded font-bold shadow-2xs">
                        ★ सभासद: {selectedMember.memberCode}
                      </span>
                    ) : (
                      <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">
                        खातेदार (नवीन शेअर वाटप)
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>ID: <strong>#{selectedMember.memberID}</strong></span>
                    {selectedMember.cifNo && <span>| CIF: <strong>{selectedMember.cifNo}</strong></span>}
                    {selectedMember.legacyMemberNo && <span>| जुना नंबर: <strong>{selectedMember.legacyMemberNo}</strong></span>}
                    {selectedMember.mobileNo && <span>| मो.: <strong>{selectedMember.mobileNo}</strong></span>}
                    {selectedMember.village && <span>| गाव: <strong>{selectedMember.village}</strong></span>}
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0 bg-white/70 px-2 py-1 rounded border border-primary/15">
                  <div className="text-[9px] text-gray-500 uppercase font-semibold">चालू भाग भांडवल</div>
                  <div className="font-mono font-bold text-primary text-xs">
                    ₹{(shareAccount ? shareAccount.totalShareAmount : 0).toFixed(2)}
                    <span className="text-[10px] font-normal text-gray-600 ml-1">
                      ({shareAccount ? shareAccount.totalShareCount : 0} शेअर्स)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Row 1: Share Basic Allotment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>वाटप तारीख (Date) <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  className={`${inputClass} font-bold`}
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>शेअर्स संख्या (Qty) <span className="text-red-500">*</span></label>
                <input 
                  ref={numberOfSharesInputRef}
                  type="number" 
                  min="1"
                  placeholder="उदा. 10"
                  className={`${inputClass} font-bold font-mono text-right text-primary`}
                  value={numberOfShares}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                    setNumberOfShares(val);
                  }}
                  required
                />
                <span className="text-[10px] text-slate-500 font-semibold">(@ ₹{faceValue}/शेअर)</span>
              </div>

              <div>
                <label className={labelClass}>प्रति शेअर दर (Rate ₹)</label>
                <input
                  type="number"
                  readOnly
                  value={faceValue}
                  className={`${inputClass} font-mono text-right bg-slate-50 cursor-not-allowed`}
                />
              </div>

              <div>
                <label className={labelClass}>शेअर्स रक्कम (Share Capital ₹)</label>
                <input
                  type="text"
                  readOnly
                  value={`₹ ${shareCapitalAmount.toLocaleString('en-IN')}`}
                  className={`${inputClass} font-mono font-bold text-emerald-800 bg-emerald-50 text-right cursor-not-allowed border-emerald-300`}
                />
              </div>
            </div>

            {/* Row 2: Auto-Calculated Share Range & Certificate No */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>
                  <span>शेअर्स नं. पासून (From Share No)</span>
                  <span className="text-[10px] text-blue-600 font-bold ml-1">[Auto]</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={hasShares ? autoFromShareNo : '-'}
                  className={`${inputClass} font-mono font-bold bg-slate-50 text-slate-800 text-center cursor-not-allowed border-slate-300`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <span>शेअर्स नं. पर्यंत (To Share No)</span>
                  <span className="text-[10px] text-blue-600 font-bold ml-1">[Auto]</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={hasShares ? autoToShareNo : '-'}
                  className={`${inputClass} font-mono font-bold bg-slate-50 text-slate-800 text-center cursor-not-allowed border-slate-300`}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>
                  <span>सर्टिफिकेट नं. (Certificate No)</span>
                  <span className="text-[10px] text-blue-600 font-bold ml-1">[Auto]</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={hasShares ? autoCertificateNo : '-'}
                  className={`${inputClass} font-mono font-bold bg-slate-50 text-primary text-center cursor-not-allowed border-slate-300`}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Payment Details */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <CreditCard className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. पेमेंट प्रकार व खातावणी तपशील (Payment & Accounting)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>पेमेंट प्रकार (Payment Mode) <span className="text-red-500">*</span></label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="Cash">💵 रोख जमा (Cash)</option>
                  <option value="Transfer">🔄 बचत खात्यातून वर्ग (Saving Transfer)</option>
                  <option value="Bank">🏦 बँक / चेक / RTGS (Bank Transfer)</option>
                  <option value="LedgerTransfer">📑 इतर लेजरमधून वर्ग (Ledger Transfer)</option>
                </select>
              </div>

              {/* Dynamic Payment Inputs */}
              {paymentMode === 'Transfer' && (
                <div>
                  <label className={labelClass}>बचत खाते निवडा <span className="text-red-500">*</span></label>
                  {memberSavingAccounts.length > 0 ? (
                    <select
                      value={selectedSavingAccountId}
                      onChange={(e) => setSelectedSavingAccountId(e.target.value === '' ? '' : parseInt(e.target.value))}
                      className={inputClass}
                      required
                    >
                      {memberSavingAccounts.map((acc: any) => (
                        <option key={acc.savingAccountID} value={acc.savingAccountID}>
                          {acc.accountNo} (शिल्लक: ₹{acc.currentBalance.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[10px] text-rose-600 font-bold bg-rose-50 p-1.5 rounded border border-rose-200">
                      ⚠️ या सभासदाचे सक्रिय बचत खाते नाही.
                    </div>
                  )}
                </div>
              )}

              {paymentMode === 'Bank' && (
                <>
                  <div>
                    <label className={labelClass}>बँक लेजर निवडा <span className="text-red-500">*</span></label>
                    <SearchableSelect 
                      options={allLedgers.map(l => ({ value: l.ledgerID.toString(), label: `${l.ledgerName} (₹${(l.currentBalance || 0).toFixed(0)})` }))}
                      value={selectedBankLedgerId ? selectedBankLedgerId.toString() : ''}
                      onChange={(e: any) => {
                        const val = e?.target ? e.target.value : e;
                        setSelectedBankLedgerId(val ? parseInt(String(val), 10) : '');
                      }}
                      placeholder="बँक निवडा..."
                    />
                  </div>
                  <div>
                    <label className={labelClass}>चेक / UTR संदर्भ क्र.</label>
                    <input 
                      type="text" 
                      placeholder="उदा. CHQ123456" 
                      value={chequeNo}
                      onChange={(e) => setChequeNo(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              {paymentMode === 'LedgerTransfer' && (
                <div>
                  <label className={labelClass}>रक्कम वर्ग करण्यासाठी लेजर <span className="text-red-500">*</span></label>
                  <SearchableSelect 
                    options={allLedgers.map(l => ({ 
                      value: l.ledgerID.toString(), 
                      label: l.ledgerCode ? `${l.ledgerName} (${l.ledgerCode})` : l.ledgerName 
                    }))}
                    value={selectedSourceLedgerId ? selectedSourceLedgerId.toString() : ''}
                    onChange={(e: any) => {
                      const val = e?.target ? e.target.value : e;
                      setSelectedSourceLedgerId(val ? parseInt(String(val), 10) : '');
                    }}
                    placeholder="लेजर निवडा..."
                  />
                </div>
              )}

              <div>
                <label className={labelClass}>तपशील / शेरा (Narration)</label>
                <input 
                  type="text" 
                  className={inputClass}
                  placeholder="उदा. भाग भांडवल वाटप"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>रद्द करा (Reset)</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all"
            >
              <Save className="w-4 h-4" />
              <span>
                {loading 
                  ? 'प्रक्रिया सुरू आहे...' 
                  : (!shareAccount || shareAccount.totalShareCount === 0)
                  ? '💾 प्रथम शेअर्स वाटप करा व व्हाऊचर तयार करा (Initial Allotment)'
                  : '➕ अतिरिक्त शेअर्स वाटप करा व व्हाऊचर तयार करा (Allot Additional Shares)'}
              </span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* 4. MEMBER CERTIFICATES & PASSBOOK HISTORY (SHOWN WHEN MEMBER SELECTED)     */}
      {/* ========================================================================= */}
      {selectedMember && (
        <div className="mt-3 bg-white p-3.5 rounded-sm shadow-xs border border-gray-200 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-gray-900">
                {selectedMember.firstName} {selectedMember.lastName} - खातावणी व प्रमाणपत्रे
              </h2>
            </div>

            <div className="flex gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
              <button
                type="button"
                onClick={() => setMemberHistoryTab('certificates')}
                className={`px-3 py-1 rounded-sm text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  memberHistoryTab === 'certificates' ? 'bg-primary text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Printer className="w-3 h-3" />
                <span>शेअर प्रमाणपत्रे ({certificates.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setMemberHistoryTab('ledger')}
                className={`px-3 py-1 rounded-sm text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  memberHistoryTab === 'ledger' ? 'bg-primary text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>खातावणी व व्यवहार ({memberTransactions.length})</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Certificates View */}
          {memberHistoryTab === 'certificates' && (
            <div className="overflow-x-auto border border-gray-200 rounded-sm">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-slate-100 text-gray-700 font-bold border-b border-gray-300">
                  <tr>
                    <th className="border-r border-gray-200 p-1.5 text-left">सर्टिफिकेट क्र.</th>
                    <th className="border-r border-gray-200 p-1.5 text-left">दिनांक</th>
                    <th className="border-r border-gray-200 p-1.5 text-right">शेअर्स संख्या</th>
                    <th className="border-r border-gray-200 p-1.5 text-right">रक्कम (₹)</th>
                    <th className="border-r border-gray-200 p-1.5 text-center">स्थिती</th>
                    <th className="p-1.5 text-center w-28">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                  {certificates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-400 font-bold">
                        कोणतेही शेअर प्रमाणपत्र उपलब्ध नाही.
                      </td>
                    </tr>
                  ) : (
                    certificates.map((cert) => (
                      <tr key={cert.certificateId} className={`hover:bg-primary/5 transition-colors ${cert.status === 'Cancelled' ? 'bg-red-50 text-red-800 line-through opacity-70' : ''}`}>
                        <td className="p-1.5 border-r border-gray-200 font-bold font-mono text-primary">{cert.certificateNo}</td>
                        <td className="p-1.5 border-r border-gray-200 font-mono">{cert.issueDate}</td>
                        <td className="p-1.5 border-r border-gray-200 text-right font-bold text-gray-900">{cert.numberOfShares}</td>
                        <td className="p-1.5 border-r border-gray-200 text-right font-bold text-emerald-700">₹{cert.totalAmount.toFixed(2)}</td>
                        <td className="p-1.5 border-r border-gray-200 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cert.status === 'Active' || cert.status === 'Issued' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                          }`}>
                            {cert.status}
                          </span>
                        </td>
                        <td className="p-1.5 text-center space-x-1 whitespace-nowrap">
                          <button 
                            type="button"
                            onClick={() => setPreviewCertificate(cert)}
                            className="bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            🖨️ प्रिंट
                          </button>
                          {cert.status === 'Active' && (
                            <button 
                              type="button"
                              onClick={() => handleCancelCertificate(cert)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              ❌ रद्द
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Passbook Ledger View */}
          {memberHistoryTab === 'ledger' && (
            <div className="overflow-x-auto border border-gray-200 rounded-sm">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-slate-100 text-gray-700 font-bold border-b border-gray-300">
                  <tr>
                    <th className="border-r border-gray-200 p-1.5 text-left">दिनांक</th>
                    <th className="border-r border-gray-200 p-1.5 text-center">प्रकार</th>
                    <th className="border-r border-gray-200 p-1.5 text-right">शेअर्स</th>
                    <th className="border-r border-gray-200 p-1.5 text-right">रक्कम (₹)</th>
                    <th className="border-r border-gray-200 p-1.5 text-center">व्हाउचर</th>
                    <th className="p-1.5 text-center w-24">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                  {memberTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-400 font-bold">
                        कोणताही व्यवहार आढळला नाही.
                      </td>
                    </tr>
                  ) : (
                    memberTransactions.map((t) => {
                      const isAllotment = t.transactionType === 'Allotment';
                      return (
                        <tr key={t.transactionId} className="hover:bg-primary/5 transition-colors">
                          <td className="p-1.5 border-r border-gray-200 font-mono">{t.transactionDate ? t.transactionDate.split('T')[0] : '-'}</td>
                          <td className="p-1.5 border-r border-gray-200 text-center">
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {t.transactionType}
                            </span>
                          </td>
                          <td className="p-1.5 border-r border-gray-200 text-right font-bold font-mono text-emerald-800">+{t.numberOfShares}</td>
                          <td className="p-1.5 border-r border-gray-200 text-right font-bold font-mono text-primary">₹{t.amount.toFixed(2)}</td>
                          <td className="p-1.5 border-r border-gray-200 text-center font-mono text-[10px] text-gray-700">{t.voucherNo || '-'}</td>
                          <td className="p-1.5 text-center space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEditTxn(t)}
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-[10px] font-bold border border-amber-300 cursor-pointer transition-colors"
                              title="शेरा व तारीख संपादन करा"
                            >
                              ✏️
                            </button>
                            {t.voucherId && (
                              <button
                                type="button"
                                onClick={() => setPrintingVoucherId(t.voucherId ?? null)}
                                className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded text-[10px] font-bold border border-indigo-300 cursor-pointer transition-colors"
                                title="जमा पावती / व्हाउचर प्रिंट करा"
                              >
                                🖨️
                              </button>
                            )}
                            {isAllotment && (
                              <button
                                type="button"
                                onClick={() => handleOpenCancelAllot(t)}
                                className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded text-[10px] font-bold border border-rose-300 cursor-pointer transition-colors"
                                title="वाटप रद्द व रिव्हर्स करा"
                              >
                                ❌
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL: ALL TRANSACTIONS LIST                                       */}
      {/* ========================================================================= */}
      {showAllTxnModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>संस्थेतील सर्व शेअर वाटप व व्यवहार इतिहास (All Share Transactions)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredAllTransactions.length} नोंदी
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAllTxnModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors cursor-pointer"
                title="बंद करा (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Toolbar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input 
                  type="text" 
                  placeholder="सभासदाचे नाव, कोड, व्हाउचरने शोधा..." 
                  value={allTxnSearch}
                  onChange={(e) => setAllTxnSearch(e.target.value)}
                  className="pl-8 pr-6 py-1 border border-gray-300 rounded-sm text-xs h-[30px] w-64 lg:w-80 focus:outline-none focus:border-primary bg-white shadow-2xs"
                />
                {allTxnSearch && (
                  <button 
                    onClick={() => setAllTxnSearch('')} 
                    className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportAllTxnExcel}
                disabled={filteredAllTransactions.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="एक्सेल फाइल डाउनलोड करा"
              >
                <FileSpreadsheet size={13} />
                <span>एक्सेल एक्सपोर्ट</span>
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-10">अ.क्र.</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left w-24">दिनांक</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left">सभासदाचे नाव</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-center w-28">प्रकार</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-right w-20">शेअर्स</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-right w-24">रक्कम (₹)</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-center w-36">व्हाउचर क्र.</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left">शेरा</th>
                      <th className="px-2 py-1.5 text-center w-20">कृती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredAllTransactions.map((t, idx) => (
                      <tr key={t.transactionId} className="hover:bg-primary/5 transition-colors">
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-1.5 border-r border-gray-200 font-mono">{t.transactionDate ? t.transactionDate.split('T')[0] : '-'}</td>
                        <td className="px-3 py-1.5 border-r border-gray-200 font-bold text-gray-900">
                          {t.memberName} ({t.memberCode || t.accountNo})
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                            {t.transactionType}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-800">
                          +{t.numberOfShares}
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-primary">
                          ₹{t.amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-200 text-center font-mono text-[10px] text-gray-700">
                          {t.voucherNo || '-'}
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-200 text-gray-700 text-[11px]">
                          {t.narration || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTxn(t)}
                            className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-[10px] font-bold border border-amber-300 cursor-pointer transition-colors"
                            title="शेरा व तारीख संपादन करा"
                          >
                            ✏️
                          </button>
                          {t.voucherId && (
                            <button
                              type="button"
                              onClick={() => setPrintingVoucherId(t.voucherId ?? null)}
                              className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded text-[10px] font-bold border border-indigo-300 cursor-pointer transition-colors"
                              title="जमा पावती / व्हाउचर प्रिंट करा"
                            >
                              🖨️
                            </button>
                          )}
                          {t.transactionType === 'Allotment' && (
                            <button
                              type="button"
                              onClick={() => handleOpenCancelAllot(t)}
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded text-[10px] font-bold border border-rose-300 cursor-pointer transition-colors"
                              title="वाटप रद्द व रिव्हर्स करा"
                            >
                              ❌
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredAllTransactions.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणताही व्यवहार सापडला नाही.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex justify-end items-center text-xs shrink-0">
              <button
                type="button"
                onClick={() => setShowAllTxnModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-xs font-bold transition-all cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ✏️ ACTION MODAL 1: EDIT TRANSACTION REMARKS & DATE */}
      {editTxnModal.open && editTxnModal.txn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 w-full max-w-lg overflow-hidden">
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center">
              <h3 className="text-xs font-bold flex items-center gap-1.5">
                <Edit2 className="w-4 h-4" />
                <span>व्यवहार शेरा व तारीख संपादन (Edit Narration & Date)</span>
              </h3>
              <button 
                onClick={() => setEditTxnModal({ open: false, txn: null })}
                className="text-white/80 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              {/* Context Summary Card (Read-Only) */}
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 text-xs space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <span className="font-bold text-gray-900 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    {editTxnModal.txn.memberName || (selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'खातेदार')}
                  </span>
                  <span className="font-mono text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">
                    {editTxnModal.txn.memberCode || selectedMember?.memberCode || editTxnModal.txn.accountNo || `Acc #${editTxnModal.txn.shareAccountId}`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <div className="text-[10px] text-gray-500 font-semibold">व्यवहार प्रकार</div>
                    <div className="font-bold text-primary">{editTxnModal.txn.transactionType}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-semibold">शेअर्स संख्या</div>
                    <div className="font-mono font-bold text-emerald-800">+{editTxnModal.txn.numberOfShares} शेअर्स</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-semibold">रक्कम</div>
                    <div className="font-mono font-bold text-gray-900">₹{editTxnModal.txn.amount.toFixed(2)}</div>
                  </div>
                </div>

                {editTxnModal.txn.voucherNo && (
                  <div className="text-[10px] text-gray-600 font-mono bg-white px-2 py-1 rounded border border-slate-200 flex items-center justify-between">
                    <span>व्हाउचर क्र.: <b>{editTxnModal.txn.voucherNo}</b></span>
                    <span className="text-emerald-700 font-bold">लेखा व्हाउचर लिंक आहे</span>
                  </div>
                )}
              </div>

              <div className="p-2 bg-amber-50 text-amber-900 border border-amber-200 rounded-sm text-[10.5px] leading-tight flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <b>लेखा सुरक्षा सूचना:</b> बँकिंग नियमांनुसार शेअर्स संख्या व रक्कम अपरिवर्तनीय आहेत. येथे बदललेली तारीख आणि शेरा संबंधित लेजर व्हाउचरवरही आपोआप अद्ययावत होईल.
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <label className={labelClass}>व्यवहार तारीख (Date) <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={editTxnDate}
                    onChange={(e) => setEditTxnDate(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-[9.5px] text-gray-400 mt-0.5">व्हाउचरची तारीखही यानुसार अद्ययावत केली जाईल.</p>
                </div>

                <div>
                  <label className={labelClass}>शेरा / तपशील (Narration)</label>
                  <textarea
                    rows={2}
                    value={editTxnNarration}
                    onChange={(e) => setEditTxnNarration(e.target.value)}
                    placeholder="उदा. भाग भांडवल वाटप, ठराव क्र. १५ नुसार..."
                    className="w-full border border-gray-300 p-2 rounded-sm text-xs font-medium focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>दुरुस्तीचे कारण (Reason for Edit - Audit Trail)</label>
                  <input
                    type="text"
                    value={editTxnReason}
                    onChange={(e) => setEditTxnReason(e.target.value)}
                    placeholder="उदा. पावतीनुसार तारीख दुरुस्ती / संचालक मंडळ ठराव नोंद..."
                    className={inputClass}
                  />
                  <p className="text-[9.5px] text-gray-400 mt-0.5">ऑडिट पडताळणीसाठी दुरुस्तीचे कारण नोंदवले जाईल.</p>
                </div>
              </div>

              <div className="pt-2.5 flex justify-end gap-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditTxnModal({ open: false, txn: null })}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm text-xs font-bold cursor-pointer transition-colors"
                >
                  रद्द करा
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSaveEditTxn}
                  className="px-4 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold cursor-pointer shadow-xs transition-opacity"
                >
                  {loading ? 'जतन होत आहे...' : '💾 बदल जतन करा'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ❌ ACTION MODAL 2: CANCEL & REVERSE ALLOTMENT */}
      {cancelAllotModal.open && cancelAllotModal.txn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-md shadow-2xl border border-rose-300 w-full max-w-md overflow-hidden">
            <div className="bg-rose-700 text-white px-4 py-2.5 flex justify-between items-center">
              <h3 className="text-xs font-bold flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                <span>शेअर वाटप रद्दीकरण (Cancel & Reverse)</span>
              </h3>
              <button 
                onClick={() => setCancelAllotModal({ open: false, txn: null })}
                className="text-white/80 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-rose-950 bg-rose-50 p-2.5 rounded-sm border border-rose-200">
                सावधान: या कृतीमुळे <b>{cancelAllotModal.txn.numberOfShares} शेअर्स (₹{cancelAllotModal.txn.amount.toFixed(2)})</b> खात्यातून वजा होऊन व्हाउचर आपोआप रद्द होईल.
              </p>

              <div>
                <label className={labelClass}>
                  रद्दीकरणाचे कारण (Reason) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="उदा. चुकीचे वाटप किंवा विनंती..."
                  className={inputClass}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setCancelAllotModal({ open: false, txn: null })}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm text-xs font-bold cursor-pointer"
                >
                  मागे जा
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleConfirmCancelAllot}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-sm text-xs font-bold cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{loading ? 'रद्द करत आहे...' : 'वाटप रद्द करा'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ MODAL 3: SHARE CERTIFICATE PRINT */}
      {previewCertificate && (
        <ShareCertificatePreview 
          certificate={previewCertificate} 
          onClose={() => {
            setPreviewCertificate(null);
            if (selectedMemberId) loadShareData(selectedMemberId as number);
          }} 
        />
      )}

      {/* 🖨️ MODAL 4: VOUCHER / RECEIPT PRINT */}
      {printingVoucherId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-4xl w-full max-h-[92vh] overflow-y-auto relative">
            <VoucherPrint voucherId={printingVoucherId} onBack={() => setPrintingVoucherId(null)} />
          </div>
        </div>
      )}

      {/* 📋 MODAL 4: PENDING MEMBERSHIP APPLICATIONS LIST FOR 1-CLICK ALLOTMENT */}
      {showPendingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded shadow-2xl max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden border border-slate-300">
            {/* Top Ribbon */}
            <div className="px-4 py-2.5 bg-amber-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-200" />
                <div>
                  <h3 className="font-bold text-sm">
                    नवीन सभासद अर्ज यादी - शेअर्स वाटपासाठी प्रलंबित ({pendingMembers.length})
                  </h3>
                  <p className="text-[10px] text-amber-100 font-normal">
                    सभासदत्व अर्ज नोंदणी पूर्ण झालेले, परंतु अद्याप भाग भांडवल (Share Allotment) वाटप न झालेले नवीन सभासद
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPendingModal(false)}
                className="text-white/80 hover:text-white font-bold p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Actions Bar */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  placeholder="सभासद कोड, नाव, CIF, मोबाईल किंवा गावाने शोधा..."
                  className="w-full pl-8 pr-3 py-1 border border-slate-300 rounded text-[11px] focus:ring-1 focus:ring-primary focus:border-primary outline-none h-[28px] bg-white"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={fetchPendingMembers}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>रिफ्रेश करा</span>
                </button>
                <span className="font-bold text-slate-600">
                  प्रलंबित अर्ज: <span className="text-amber-700 font-black">{pendingMembers.length}</span>
                </span>
              </div>
            </div>

            {/* Applicants Table */}
            <div className="flex-1 overflow-auto p-2">
              {(() => {
                const q = pendingSearch.toLowerCase().trim();
                const filtered = pendingMembers.filter(m => {
                  if (!q) return true;
                  const name = (m.fullName || `${m.firstName} ${m.lastName}`).toLowerCase();
                  const code = (m.memberCode || '').toLowerCase();
                  const cif = (m.cifNo || '').toLowerCase();
                  const mob = (m.mobileNo || '').toLowerCase();
                  const vil = (m.village || '').toLowerCase();
                  return name.includes(q) || code.includes(q) || cif.includes(q) || mob.includes(q) || vil.includes(q);
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center text-slate-400">
                      <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
                      <p className="font-bold text-slate-700 text-xs">
                        {pendingMembers.length === 0 
                          ? 'अभिनंदन! शेअर्स वाटपासाठी कोणताही प्रलंबित सभासद अर्ज नाही.'
                          : 'शोध निकषांनुसार कोणताही अर्ज सापडला नाही.'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        सर्व नोंदणीकृत सभासदांना शेअर्स वाटप पूर्ण झालेले आहे.
                      </p>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0 font-bold z-10">
                        <th className="p-2">सभासद क्र.</th>
                        <th className="p-2">CIF कोड</th>
                        <th className="p-2">सभासदाचे पूर्ण नाव</th>
                        <th className="p-2">शाखा</th>
                        <th className="p-2">मोबाईल व गाव</th>
                        <th className="p-2">अर्ज / नोंदणी दिनांक</th>
                        <th className="p-2 text-center">कृती</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((m) => (
                        <tr key={m.memberID} className="hover:bg-amber-50/50 transition-colors">
                          <td className="p-2 font-mono font-bold text-primary flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>{m.memberCode}</span>
                          </td>
                          <td className="p-2 font-mono font-semibold text-slate-600">{m.cifNo || '-'}</td>
                          <td className="p-2 font-bold text-slate-900">{m.fullName || `${m.firstName} ${m.lastName}`}</td>
                          <td className="p-2 text-slate-600">{m.branchName || '-'}</td>
                          <td className="p-2 text-slate-600">
                            <div className="font-medium text-slate-800">{m.mobileNo || '-'}</div>
                            <div className="text-[10px] text-slate-400">{m.village || '-'}</div>
                          </td>
                          <td className="p-2 font-mono text-slate-600">
                            {m.joiningDate ? m.joiningDate.split('T')[0] : '-'}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                selectMemberById(m.memberID);
                                setNumberOfShares(10);
                                setShowPendingModal(false);
                                if (formContainerRef.current) {
                                  formContainerRef.current.scrollIntoView({ behavior: 'smooth' });
                                }
                              }}
                              className="px-3 py-1 bg-primary hover:opacity-90 text-white rounded font-bold text-[11px] shadow-2xs cursor-pointer flex items-center justify-center gap-1 mx-auto transition-all"
                            >
                              <span>👉 शेअर्स वाटप करा</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs text-slate-600 shrink-0">
              <span className="font-medium">
                टीप: कोणत्याही अर्जावर 'शेअर्स वाटप करा' क्लिक केल्यास ती नोंद फॉर्ममध्ये आपोआप लोड होईल.
              </span>
              <button
                type="button"
                onClick={() => setShowPendingModal(false)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer text-xs"
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
