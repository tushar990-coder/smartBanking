import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Layers,
  Info,
  RotateCcw,
  Clock,
  Printer,
  Eye,
  BookOpen
} from 'lucide-react';
import VoucherPrint from './VoucherPrint';

interface VoucherDetail {
  voucherDetailID: number;
  ledgerID: number;
  drCr: string;
  amount: number;
  narration: string;
  ledger: { ledgerName: string; accountType?: string };
  customer?: {
    cifNo?: string;
    CIFNo?: string;
    legacyCustomerNo?: string;
    LegacyCustomerNo?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    FirstName?: string;
    MiddleName?: string;
    LastName?: string;
  };
  member?: {
    MemberCode?: string;
    FirstName?: string;
    LastName?: string;
    memberCode?: string;
    firstName?: string;
    lastName?: string;
    customer?: {
      cifNo?: string;
      CIFNo?: string;
      legacyCustomerNo?: string;
      LegacyCustomerNo?: string;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      FirstName?: string;
      MiddleName?: string;
      LastName?: string;
    };
  };
}

interface Voucher {
  voucherID: number;
  branchID?: number;
  voucherNo: string;
  scrollNo?: number;
  voucherDate: string;
  voucherType: string;
  narration: string;
  totalAmount: number;
  status: string;
  voucherDetails: VoucherDetail[];
}

interface VoucherPostingProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const VoucherPosting: React.FC<VoucherPostingProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedVouchers, setSelectedVouchers] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RECEIPT' | 'PAYMENT' | 'JV_CONTRA'>('ALL');
  const [expandedVoucherId, setExpandedVoucherId] = useState<number | null>(null);
  const [printingVoucherId, setPrintingVoucherId] = useState<number | null>(null);

  // Date Filtering States
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : todayStr;
  const [selectedDate, setSelectedDate] = useState<string>(activeBusinessDate);
  // Pending tab defaults to All Dates so zero pending backlog is ever hidden; Approved tab defaults to Today
  const [isAllDates, setIsAllDates] = useState<boolean>(true);

  useEffect(() => {
    if (user?.businessDate) {
      setSelectedDate(user.businessDate.split('T')[0]);
    }
  }, [user?.businessDate]);

  // Active Tab Mode: 'PENDING' (प्रलंबित) vs 'APPROVED' (मंजूर)
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED'>('PENDING');

  // Approved Vouchers State
  const [approvedVouchers, setApprovedVouchers] = useState<Voucher[]>([]);
  const [loadingApproved, setLoadingApproved] = useState(false);

  // Unpass Modal States
  const [unpassModalOpen, setUnpassModalOpen] = useState(false);
  const [targetVoucherToUnpass, setTargetVoucherToUnpass] = useState<Voucher | null>(null);
  const [bulkUnpassModalOpen, setBulkUnpassModalOpen] = useState(false);
  const [unpassReason, setUnpassReason] = useState('माहिती सुधारण्यासाठी मंजुरी रद्द केली (Reverted to Pending for correction)');
  const [unpassError, setUnpassError] = useState('');

  const getOperatingBranchQuery = () => {
    const globalBranchStr = localStorage.getItem('globalBranchId');
    const isHO = user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'HeadOffice' || user?.role === 'HO_Manager';
    if (globalBranchStr && globalBranchStr !== 'all') {
      const parsed = parseInt(globalBranchStr, 10);
      if (!isNaN(parsed) && parsed > 0) return `?branchId=${parsed}`;
    }
    if (globalBranchStr === 'all' && isHO) {
      return '';
    }
    if (isHO && (!user?.branchID || user.branchID <= 0)) {
      return '';
    }
    return `?branchId=${user?.branchID || 1}`;
  };

  useEffect(() => {
    fetchUnpostedVouchers();
    fetchApprovedVouchers();

    const handleBranchChange = () => {
      fetchUnpostedVouchers();
      fetchApprovedVouchers();
    };
    window.addEventListener('globalBranchChange', handleBranchChange);
    return () => window.removeEventListener('globalBranchChange', handleBranchChange);
  }, [user?.branchID, user?.role]);

  const isOpeningMigrationVoucher = (v: Voucher) => {
    const vNo = v.voucherNo || '';
    const narr = (v.narration || '').toLowerCase();
    const vDate = v.voucherDate ? new Date(v.voucherDate) : null;
    const isLegacyDate = vDate && vDate <= new Date('2026-03-31T23:59:59');

    return (
      (v.voucherType || '').toLowerCase() === 'opening' ||
      narr.includes('आरंभिक शिल्लक') ||
      narr.includes('opening balance migration') ||
      (Boolean(isLegacyDate) && (
        vNo.includes('-OP-') ||
        vNo.startsWith('JV-FD-OP-') ||
        vNo.startsWith('REC-FD-OP-') ||
        vNo.startsWith('JV-RD-OP-') ||
        vNo.startsWith('REC-RD-OP-') ||
        vNo.startsWith('JV-SH-OP-') ||
        vNo.startsWith('JV-INV-OP-')
      ))
    );
  };

  const fetchApprovedVouchers = async () => {
    setLoadingApproved(true);
    try {
      const branchQuery = getOperatingBranchQuery();
      const res = await fetch(`/api/VoucherPosting/Approved${branchQuery}`);
      if (res.ok) {
        const data = await res.json();
        const safeList: Voucher[] = (Array.isArray(data) ? data : []).filter((v: Voucher) => !isOpeningMigrationVoucher(v));
        setApprovedVouchers(safeList);
      } else {
        console.error('Failed to fetch approved vouchers:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Network error fetching approved vouchers:', err);
    } finally {
      setLoadingApproved(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchUnpostedVouchers(), fetchApprovedVouchers()]);
  };

  const fetchUnpostedVouchers = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const branchQuery = getOperatingBranchQuery();
      const res = await fetch(`/api/VoucherPosting/Unposted${branchQuery}`);
      if (res.ok) {
        const data = await res.json();
        const safeList: Voucher[] = (Array.isArray(data) ? data : []).filter((v: Voucher) => !isOpeningMigrationVoucher(v));
        setVouchers(safeList);
        setSelectedVouchers(new Set());

        const params = new URLSearchParams(window.location.search);
        const entityIdStr = params.get('entityId');
        const voucherIdStr = params.get('voucherId') || params.get('id');
        const targetVId = voucherIdStr ? parseInt(voucherIdStr, 10) : (entityIdStr ? parseInt(entityIdStr, 10) : null);

        if (targetVId && safeList.some((v) => v.voucherID === targetVId)) {
          setExpandedVoucherId(targetVId);
          setSelectedVouchers(new Set([targetVId]));
        }
      } else {
        setError('प्रलंबित व्हाउचर्स लोड करताना त्रुटी आली. (Failed to load pending vouchers)');
      }
    } catch {
      setError('सर्व्हरशी संपर्क साधता आला नाही. (Network Error)');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchTab = (tab: 'PENDING' | 'APPROVED') => {
    setActiveTab(tab);
    setSelectedVouchers(new Set());
    setExpandedVoucherId(null);
    setTypeFilter('ALL');
    setMessage('');
    setError('');
    if (tab === 'PENDING') {
      setIsAllDates(true);
    } else {
      setSelectedDate(activeBusinessDate);
      setIsAllDates(false);
    }
  };

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedVouchers);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedVouchers(newSelection);
  };

  const selectAllFiltered = () => {
    if (selectedVouchers.size === filteredVouchers.length && filteredVouchers.length > 0) {
      setSelectedVouchers(new Set());
    } else {
      setSelectedVouchers(new Set(filteredVouchers.map((v) => v.voucherID)));
    }
  };

  const handlePostSelected = async () => {
    if (selectedVouchers.size === 0) return;
    if (!window.confirm(`तुम्हाला खात्री आहे का की तुम्ही निवडलेले ${selectedVouchers.size} व्हाउचर मंजूर व पोस्ट करू इच्छिता?`)) return;

    setActionLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/VoucherPosting/Post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: Array.from(selectedVouchers),
          approvedBy: user?.userID || 1,
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        let successText = `${selectedVouchers.size} व्हाउचर(स) यशस्वीरीत्या पास व पोस्ट झाले.`;
        if (resData.vouchers && Array.isArray(resData.vouchers)) {
          const scrollInfo = resData.vouchers.map((v: any) => `${v.voucherNo} (#${v.scrollNo})`).join(', ');
          successText += ` वाटप केलेले स्क्रॉल क्र.: ${scrollInfo}`;
        }
        setMessage(successText);
        setSelectedVouchers(new Set());
        refreshAll();
      } else {
        const errText = await res.text();
        setError(`त्रुटी: ${errText}`);
      }
    } catch {
      setError('पोस्टिंग करताना नेटवर्क त्रुटी आली. (Network error during posting)');
    } finally {
      setActionLoading(false);
    }
  };

  // Direct Single Pass (एका क्लिकवर स्वतंत्र व्हाउचर मंजूर व पोस्ट करणे)
  const handleSinglePass = async (voucher: Voucher) => {
    if (!voucher) return;
    if (voucher.status === 'Approved') {
      alert(`व्हाउचर क्र. ${voucher.voucherNo} आधीच मंजूर आहे (स्क्रॉल क्र. #${voucher.scrollNo || 'उपलब्ध'}).`);
      return;
    }

    const confirmMsg = `व्हाउचर क्र. ${voucher.voucherNo} (${voucher.voucherType} - ₹${voucher.totalAmount.toLocaleString('en-IN')}) मंजूर व पास करायचे आहे का?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/VoucherPosting/Post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: [voucher.voucherID],
          approvedBy: user?.userID || 1,
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        let successText = `व्हाउचर क्र. ${voucher.voucherNo} यशस्वीरीत्या पास व पोस्ट झाले.`;
        if (resData.vouchers && Array.isArray(resData.vouchers) && resData.vouchers.length > 0) {
          const scrollInfo = resData.vouchers[0].scrollNo ? ` (वाटप केलेला स्क्रॉल क्र. #${resData.vouchers[0].scrollNo})` : '';
          successText += scrollInfo;
        }
        setMessage(successText);
        await refreshAll();
      } else {
        const errText = await res.text();
        setError(`मंजुरी त्रुटी: ${errText}`);
      }
    } catch {
      setError('पासिंग करताना नेटवर्क त्रुटी आली. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Single Unpass Modal
  const openSingleUnpassModal = (voucher: Voucher) => {
    setTargetVoucherToUnpass(voucher);
    setUnpassReason('माहिती सुधारण्यासाठी मंजुरी रद्द केली (Reverted to Pending for correction)');
    setUnpassError('');
    setUnpassModalOpen(true);
  };

  // Open Bulk Unpass Modal
  const openBulkUnpassModal = () => {
    if (selectedVouchers.size === 0) return;
    setUnpassReason('माहिती सुधारण्यासाठी मंजुरी रद्द केली (Reverted to Pending for correction)');
    setUnpassError('');
    setBulkUnpassModalOpen(true);
  };

  const closeUnpassModals = () => {
    setUnpassModalOpen(false);
    setBulkUnpassModalOpen(false);
    setTargetVoucherToUnpass(null);
    setUnpassReason('माहिती सुधारण्यासाठी मंजुरी रद्द केली (Reverted to Pending for correction)');
    setUnpassError('');
  };

  // Open the entry in its original entry form in Passing Mode (Intelligent CBS Multi-Module Dispatcher)
  const handleOpenFormView = (v: Voucher) => {
    const narr = (v.narration || '').toLowerCase();
    const vNo = v.voucherNo || '';

    // 1. Loan Collection
    const isLoanCollection =
      narr.includes('loan collection') ||
      vNo.startsWith('LC-') ||
      (vNo.includes('-REC-') && narr.includes('rect no'));

    // 2. Loan Disbursement
    const isLoanDisbursement =
      narr.includes('loan disbursed') ||
      narr.includes('loan disbursement') ||
      v.narration?.includes('कर्ज वितरण') ||
      v.narration?.includes('कर्ज वाटप') ||
      vNo.startsWith('LD-');

    // 3. Saving Account Closing
    const isSavingClosing =
      vNo.startsWith('VCH-SAV-CLS-') ||
      v.narration?.includes('बचत खाते बंद') ||
      narr.includes('saving account closed') ||
      narr.includes('saving account closure');

    // 4. Saving Deposit / Withdrawal Transaction
    const isSavingTransaction =
      vNo.startsWith('SAV-') ||
      vNo.startsWith('REC-SAV-') ||
      vNo.startsWith('PAY-SAV-') ||
      v.narration?.includes('बचत जमा') ||
      v.narration?.includes('बचत नावे') ||
      v.narration?.includes('बचत हस्तांतरण') ||
      narr.includes('saving deposit') ||
      narr.includes('saving withdrawal') ||
      narr.includes('saving transfer');

    // 5. Fixed Deposit Withdrawal / Closure / Renewal
    const isFdWithdrawal =
      vNo.startsWith('JV-FD-CLOSE-') ||
      vNo.startsWith('JV-FD-PRECLOSE-') ||
      vNo.startsWith('PAY-FD-CLOSE-') ||
      vNo.startsWith('PMT-FD-CLOSE-') ||
      vNo.startsWith('JV-FD-REN-') ||
      vNo.startsWith('JV-FD-INT-') ||
      vNo.startsWith('PAY-FD-INT-') ||
      narr.includes('fd maturity payout') ||
      narr.includes('fd renewal') ||
      v.narration?.includes('मुदत ठेव नूतनीकरण') ||
      v.narration?.includes('मुदत ठेव मुद्दल नूतनीकरण') ||
      v.narration?.includes('मुदत ठेव पूर्ण क्लोजर') ||
      narr.includes('fd premature') ||
      v.narration?.includes('मुदतपूर्व परतावा') ||
      v.narration?.includes('मुदत ठेव बंद');

    // 6. Fixed Deposit Account Opening
    const isFdOpening =
      vNo.startsWith('REC-FD-OP-') ||
      vNo.startsWith('JV-FD-OP-') ||
      vNo.startsWith('REC-FD-') ||
      vNo.startsWith('JV-FD-') ||
      v.narration?.includes('मुदत ठेव रक्कम जमा') ||
      v.narration?.includes('नवीन मुदत ठेव खाते') ||
      v.narration?.includes('मुदत ठेव खाते उघडले') ||
      narr.includes('fd account opened');

    // 7. Recurring Deposit (RD)
    const isRdOpening =
      vNo.startsWith('REC-RD-OPEN-') ||
      vNo.startsWith('JV-RD-OPEN-') ||
      vNo.startsWith('REC-RD-OP-') ||
      vNo.startsWith('JV-RD-OP-') ||
      v.narration?.includes('नवीन आरडी खाते') ||
      v.narration?.includes('आवर्ती ठेव खाते उघडले') ||
      narr.includes('rd account opened');

    const isRdWithdrawal =
      vNo.startsWith('JV-RD-CLOSE-') ||
      vNo.startsWith('JV-RD-PRECLOSE-') ||
      v.narration?.includes('आवर्ती ठेव बंद') ||
      narr.includes('rd maturity') ||
      narr.includes('rd closed');

    const isRdCollection =
      !isRdOpening &&
      (vNo.startsWith('REC-RD-') ||
        vNo.startsWith('JV-RD-COLL-') ||
        vNo.includes('-RD-COLL-') ||
        v.narration?.includes('आवर्ती ठेव हप्ता') ||
        narr.includes('rd installment'));

    // 8. Pigmy Deposit
    const isPigmyDaybook =
      vNo.startsWith('PG-DAYBOOK-') ||
      v.narration?.includes('एजंट डे-बुक') ||
      narr.includes('agent daybook');

    const isPigmyClosure =
      vNo.startsWith('PG-CLOSE-') ||
      v.narration?.includes('पिग्मी खाते बंद') ||
      narr.includes('pigmy closed') ||
      narr.includes('pigmy closure');

    const isPigmyCollection =
      vNo.startsWith('REC-PG-') ||
      v.narration?.includes('पिग्मी वसुली') ||
      narr.includes('pigmy collection');

    // 9. Share Capital & Members
    const isShareTransfer =
      vNo.startsWith('JV-SH-TRF-') ||
      vNo.startsWith('VCH-SHR-TRF-') ||
      v.narration?.includes('भाग हस्तांतरण') ||
      narr.includes('share transfer');

    const isShareWithdrawal =
      vNo.startsWith('PAY-SH-') ||
      vNo.startsWith('VCH-SHR-WD-') ||
      v.narration?.includes('भाग परतावा') ||
      narr.includes('share withdrawal');

    const isShareMaster =
      vNo.startsWith('REC-SH-') ||
      vNo.startsWith('VCH-SHR-') ||
      vNo.startsWith('VCH-ADM-') ||
      v.narration?.includes('भाग भांडवल') ||
      v.narration?.includes('भाग वाटप') ||
      v.narration?.includes('सभासद नोंदणी') ||
      narr.includes('share capital') ||
      narr.includes('share purchase') ||
      v.narration?.includes('नवीन भाग खरेदी');

    const isMemberClosure =
      v.narration?.includes('सभासदत्व रद्द') ||
      narr.includes('member closure');

    // 10. Lockers
    const isLockerAllotment =
      v.narration?.includes('लॉकर वाटप') ||
      narr.includes('locker allotment');

    const isLockerRentRenewal =
      v.narration?.includes('लॉकर भाडे') ||
      narr.includes('locker rent');

    const isLockerSurrender =
      v.narration?.includes('लॉकर सरेंडर') ||
      narr.includes('locker surrender');

    // 11. Assets
    const isAssetPurchase =
      v.narration?.includes('मालमत्ता खरेदी') ||
      narr.includes('asset purchase');

    // Navigation execution
    if (isLoanCollection) {
      if (onNavigate) {
        onNavigate('loan-collection', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=loan-collection&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isLoanDisbursement) {
      if (onNavigate) {
        onNavigate('loan-process', { subTab: '2', voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/karjvibhag/karjmagni?subTab=2&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isSavingClosing) {
      if (onNavigate) {
        onNavigate('saving-closing', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=saving-closing&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isSavingTransaction) {
      if (onNavigate) {
        onNavigate('saving-transaction', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=saving-transaction&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isFdWithdrawal) {
      if (onNavigate) {
        onNavigate('fd-withdrawal', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=fd-withdrawal&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isFdOpening) {
      if (onNavigate) {
        onNavigate('fd-account', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=fd-account&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isRdOpening) {
      if (onNavigate) {
        onNavigate('rd-account', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=rd-account&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isRdWithdrawal) {
      if (onNavigate) {
        onNavigate('rd-withdrawal', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=rd-withdrawal&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isRdCollection) {
      if (onNavigate) {
        onNavigate('rd-collection', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=rd-collection&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isPigmyDaybook) {
      if (onNavigate) {
        onNavigate('pigmy-daybook', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=pigmy-daybook&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isPigmyClosure) {
      if (onNavigate) {
        onNavigate('pigmy-closure', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=pigmy-closure&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isPigmyCollection) {
      if (onNavigate) {
        onNavigate('pigmy-collection', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=pigmy-collection&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isShareTransfer) {
      if (onNavigate) {
        onNavigate('share-transfer', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=share-transfer&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isShareWithdrawal) {
      if (onNavigate) {
        onNavigate('share-withdrawal', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=share-withdrawal&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isShareMaster) {
      if (onNavigate) {
        onNavigate('share-master', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=share-master&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isMemberClosure) {
      if (onNavigate) {
        onNavigate('member-closure', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=member-closure&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isLockerAllotment) {
      if (onNavigate) {
        onNavigate('locker-allotment', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=locker-allotment&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isLockerRentRenewal) {
      if (onNavigate) {
        onNavigate('locker-rent-renewal', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=locker-rent-renewal&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isLockerSurrender) {
      if (onNavigate) {
        onNavigate('locker-surrender', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=locker-surrender&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else if (isAssetPurchase) {
      if (onNavigate) {
        onNavigate('asset-purchase', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=asset-purchase&voucherId=${v.voucherID}&passingMode=true`;
      }
    } else {
      if (onNavigate) {
        onNavigate('voucher', { voucherId: v.voucherID, passingMode: 'true' });
      } else {
        window.location.href = `/?tab=voucher&voucherId=${v.voucherID}&passingMode=true`;
      }
    }
  };

  // Direct Single Delete (१७ मॉड्यूल्स स्टेट रोलबॅकसह थेट डिलीट)
  const handleDirectSingleDelete = async (voucher: Voucher) => {
    if (!voucher) return;
    const confirmMsg = `व्हाउचर क्र. ${voucher.voucherNo} (${voucher.voucherType} - ₹${voucher.totalAmount.toLocaleString('en-IN')}) खरोखर रद्द व डिलीट करायचे आहे का?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/VoucherPosting/${voucher.voucherID}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'नोंद थेट रद्द / डिलीट (Direct Deleted from Database)',
          userId: user?.userID || 1,
          username: user?.username || 'Admin',
          userRole: user?.roleName || user?.role || 'Admin',
        }),
      });

      const resData = await res.json().catch(() => null);

      if (res.ok) {
        setMessage(resData?.message || `व्हाउचर क्र. ${voucher.voucherNo} यशस्वीरीत्या रद्द व हटवले गेले.`);
        setSelectedVouchers(new Set());
        refreshAll();
      } else {
        setError(resData?.message || resData || 'व्हाउचर हटवताना त्रुटी आली.');
      }
    } catch {
      setError('सर्व्हरशी संपर्क साधता आला नाही. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setActionLoading(false);
    }
  };

  // Guarded Action Delete (मंजूर व्हाउचरसाठी सुरक्षा तपासणीसह डिलीट)
  const handleActionDelete = async (voucher: Voucher) => {
    if (!voucher) return;
    if (voucher.status === 'Approved' || activeTab === 'APPROVED') {
      alert(
        `सुरक्षा चेतावणी: व्हाउचर क्र. ${voucher.voucherNo} आधीच मंजूर (Approved) झालेले आहे.\n\n` +
        `कोअर बँकिंग नियमांनुसार मंजूर व्हाउचर थेट डिलीट करता येत नाही.\n` +
        `कृपया प्रथम 'अन-पास (Unpass)' बटण दाबून व्हाउचर प्रलंबित करा, त्यानंतरच डिलीट करा.`
      );
      return;
    }
    await handleDirectSingleDelete(voucher);
  };

  // Direct Bulk Delete (निवडलेले व्हाउचर थेट डिलीट करणे)
  const handleDirectBulkDelete = async () => {
    if (selectedVouchers.size === 0) return;
    if (!window.confirm(`तुम्हाला खात्री आहे का की तुम्ही निवडलेले ${selectedVouchers.size} व्हाउचर्स थेट रद्द व डिलीट करू इच्छिता?`)) return;

    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/VoucherPosting/BulkReject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: Array.from(selectedVouchers),
          reason: 'नोंद थेट रद्द / डिलीट (Direct Deleted from Database)',
          userId: user?.userID || 1,
          username: user?.username || 'Admin',
          userRole: user?.roleName || user?.role || 'Admin',
        }),
      });

      const resData = await res.json().catch(() => null);

      if (res.ok) {
        setMessage(resData?.message || `${selectedVouchers.size} व्हाउचर्स यशस्वीरीत्या रद्द व हटवले गेले.`);
        setSelectedVouchers(new Set());
        refreshAll();
      } else {
        setError(resData?.message || resData || 'एकत्रित व्हाउचर्स हटवताना त्रुटी आली.');
      }
    } catch {
      setError('सर्व्हरशी संपर्क साधता आला नाही. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Single Unpass (Revert approval to Pending)
  const handleConfirmSingleUnpass = async () => {
    if (!targetVoucherToUnpass) return;

    setActionLoading(true);
    setUnpassError('');
    try {
      const res = await fetch('/api/VoucherPosting/Unpass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: [targetVoucherToUnpass.voucherID],
          reason: unpassReason.trim() || 'माहिती सुधारण्यासाठी मंजुरी रद्द केली (Reverted to Pending for correction)',
          unpassedBy: user?.userID || 1,
          username: user?.username || 'Admin',
          userRole: user?.roleName || user?.role || 'Admin',
        }),
      });

      const resData = await res.json().catch(() => null);

      if (res.ok) {
        setMessage(resData?.message || `व्हाउचर क्र. ${targetVoucherToUnpass.voucherNo} यशस्वीरीत्या अन-पास केले गेले (Status: Pending).`);
        closeUnpassModals();
        setSelectedVouchers(new Set());
        await refreshAll();
      } else {
        setUnpassError(resData?.message || resData || 'व्हाउचर अन-पास करताना त्रुटी आली.');
      }
    } catch {
      setUnpassError('सर्व्हरशी संपर्क साधता आला नाही. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Bulk Unpass (Revert multiple approved vouchers to Pending)
  const handleConfirmBulkUnpass = async () => {
    if (selectedVouchers.size === 0) return;

    setActionLoading(true);
    setUnpassError('');
    try {
      const res = await fetch('/api/VoucherPosting/Unpass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: Array.from(selectedVouchers),
          reason: unpassReason.trim() || 'माहिती सुधारण्यासाठी मंजुरी रद्द केली (Reverted to Pending for correction)',
          unpassedBy: user?.userID || 1,
          username: user?.username || 'Admin',
          userRole: user?.roleName || user?.role || 'Admin',
        }),
      });

      const resData = await res.json().catch(() => null);

      if (res.ok) {
        setMessage(resData?.message || `${selectedVouchers.size} व्हाउचर्स यशस्वीरीत्या अन-पास केले गेले (Status: Pending).`);
        closeUnpassModals();
        setSelectedVouchers(new Set());
        await refreshAll();
      } else {
        setUnpassError(resData?.message || resData || 'एकत्रित व्हाउचर्स अन-पास करताना त्रुटी आली.');
      }
    } catch {
      setUnpassError('सर्व्हरशी संपर्क साधता आला नाही. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setActionLoading(false);
    }
  };

  // Date switching handlers
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setIsAllDates(false);
    setSelectedVouchers(new Set());
  };

  const handleSetToday = () => {
    handleDateChange(activeBusinessDate);
  };

  const handleSetYesterday = () => {
    handleDateChange(yesterdayStr);
  };

  const handleSetAllDates = () => {
    setIsAllDates(true);
    setSelectedVouchers(new Set());
  };

  // Helper: Extract customer/party name, CIF & primary ledger summary for quick table scan
  const getVoucherPartySummary = (v: Voucher) => {
    const details = v.voucherDetails || [];
    let cif = '';
    let fullName = '';

    for (const vd of details) {
      const cust = vd.customer || vd.member?.customer;
      const cVal = cust?.CIFNo || cust?.cifNo || '';
      const fName = cust?.FirstName || cust?.firstName || vd.member?.FirstName || vd.member?.firstName || '';
      const mName = cust?.MiddleName || cust?.middleName || '';
      const lName = cust?.LastName || cust?.lastName || vd.member?.LastName || vd.member?.lastName || '';
      const combined = [fName, mName, lName].filter(Boolean).join(' ').trim();
      if (cVal || combined) {
        cif = cVal;
        fullName = combined;
        break;
      }
    }

    const nonCashLedgers = details
      .map((vd) => vd.ledger?.ledgerName || '')
      .filter((name) => {
        const lower = name.toLowerCase();
        return Boolean(name) && !name.includes('रोख') && !lower.includes('cash in hand') && lower !== 'cash';
      });

    const uniqueNonCash = Array.from(new Set(nonCashLedgers));
    const allUniqueLedgers = Array.from(new Set(details.map((vd) => vd.ledger?.ledgerName || '').filter(Boolean)));
    const primaryLedgers = uniqueNonCash.length > 0 ? uniqueNonCash : allUniqueLedgers;
    const ledgerSummary =
      primaryLedgers.length <= 2
        ? primaryLedgers.join(' • ')
        : `${primaryLedgers[0]} (+${primaryLedgers.length - 1})`;

    return { cif, fullName, ledgerSummary };
  };

  const currentDataset = activeTab === 'PENDING' ? vouchers : approvedVouchers;

  // Vouchers filtered by Date
  const dateFilteredVouchers = useMemo(() => {
    if (isAllDates) return currentDataset;
    return currentDataset.filter((v) => {
      const vDateStr = v.voucherDate ? v.voucherDate.split('T')[0] : '';
      return vDateStr === selectedDate;
    });
  }, [currentDataset, selectedDate, isAllDates]);

  // Other dates count (when filtered to a single date)
  const otherDatesCount = useMemo(() => {
    if (isAllDates) return 0;
    return currentDataset.length - dateFilteredVouchers.length;
  }, [currentDataset.length, dateFilteredVouchers.length, isAllDates]);

  // Filter vouchers based on Type chip and Search query (including Customer Name & CIF)
  const filteredVouchers = useMemo(() => {
    return dateFilteredVouchers.filter((v) => {
      const upperType = (v.voucherType || '').toUpperCase();
      const matchesType =
        typeFilter === 'ALL' ||
        (typeFilter === 'JV_CONTRA'
          ? upperType === 'JOURNAL' || upperType === 'CONTRA'
          : upperType === typeFilter);

      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesType;

      const matchesNo = (v.voucherNo || '').toLowerCase().includes(query);
      const matchesScroll = (v.scrollNo || '').toString().includes(query);
      const matchesNarration = (v.narration || '').toLowerCase().includes(query);
      const matchesAmount = (v.totalAmount || 0).toString().includes(query);
      const matchesDetails = v.voucherDetails?.some((vd) => {
        const lName = (vd.ledger?.ledgerName || '').toLowerCase();
        const cust = vd.customer || vd.member?.customer;
        const cStr = cust
          ? `${cust.CIFNo || cust.cifNo || ''} ${cust.FirstName || cust.firstName || ''} ${cust.MiddleName || cust.middleName || ''} ${cust.LastName || cust.lastName || ''}`.toLowerCase()
          : '';
        return lName.includes(query) || cStr.includes(query);
      });

      return matchesType && (matchesNo || matchesScroll || matchesNarration || matchesAmount || Boolean(matchesDetails));
    });
  }, [dateFilteredVouchers, typeFilter, searchQuery]);

  // Inline counts for interactive type filter pills
  const totalCount = dateFilteredVouchers.length;
  const receiptsCount = dateFilteredVouchers.filter((v) => v.voucherType === 'Receipt').length;
  const paymentsCount = dateFilteredVouchers.filter((v) => v.voucherType === 'Payment').length;
  const journalsCount = dateFilteredVouchers.filter((v) => v.voucherType === 'Journal' || v.voucherType === 'Contra').length;
  const filteredTotalAmount = filteredVouchers.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

  const selectedVouchersList = filteredVouchers.filter((v) => selectedVouchers.has(v.voucherID));
  const selectedTotalAmount = selectedVouchersList.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-full flex flex-col bg-slate-50 text-[11px] font-sans pb-10">
      {/* 1. STANDARD CBS THEME HEADER BANNER (Matches ERP Dynamic Theme) */}
      <div className="bg-white px-3.5 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs shrink-0">
            <ShieldCheck size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
              <span>व्हाउचर पासिंग व मंजुरी</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">
                (Voucher Passing & Approval)
              </span>
            </h1>
            <p className="text-[10.5px] text-gray-500 font-medium">
              प्रलंबित व्यवहार तपासणी, मंजुरी (Maker-Checker) व अन-पास व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Integrated Tabs + Quick Daybook + Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Segmented Pending / Approved Tabs */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 border border-gray-200 rounded-sm">
            <button
              type="button"
              onClick={() => handleSwitchTab('PENDING')}
              className={`px-3 py-1 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'PENDING'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-gray-700 hover:bg-slate-200/70'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>प्रलंबित (Pending)</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'PENDING'
                    ? 'bg-white/25 text-white'
                    : vouchers.length > 0
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-200 text-slate-700'
                }`}
              >
                {vouchers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab('APPROVED')}
              className={`px-3 py-1 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'APPROVED'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-gray-700 hover:bg-slate-200/70'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>मंजूर (Approved)</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === 'APPROVED'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {approvedVouchers.length}
              </span>
            </button>
          </div>

          {/* Context Daybook Link */}
          {activeTab === 'PENDING' ? (
            <button
              type="button"
              onClick={() => (onNavigate ? onNavigate('draft-daybook') : (window.location.href = '/reports/draft-daybook'))}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs h-[28px]"
              title="व्हाउचर पासिंग करण्यापूर्वी कच्ची रोजकीर्द तपासा"
            >
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>कच्ची रोजकीर्द</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (onNavigate ? onNavigate('daybook') : (window.location.href = '/reports/daybook'))}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs h-[28px]"
              title="मंजूर व्हाउचर्सची पक्की रोजकीर्द तपासा"
            >
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>पक्की रोजकीर्द</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading || loadingApproved || actionLoading}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-gray-700 border border-gray-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs h-[28px] disabled:opacity-50"
            title="यादी ताजी करा (Refresh)"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${loading || loadingApproved ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">रीफ्रेश</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {message && (
        <div className="mb-2 p-2 bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs rounded-sm font-bold flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
          <button type="button" onClick={() => setMessage('')} className="text-emerald-700 hover:text-emerald-950 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-2 p-2 bg-rose-50 text-rose-900 border border-rose-300 text-xs rounded-sm font-bold flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-700 hover:text-rose-950 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. MAIN UNIFIED WORKSPACE CARD (border-t-2 border-primary) */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary flex flex-col overflow-hidden">
        {/* SINGLE COMPACT FILTER & SUMMARY STRIP */}
        <div className="px-3 py-2 bg-slate-50/80 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          {/* Left: Compact Date Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <button
              type="button"
              onClick={handleSetAllDates}
              className={`px-2 py-1 rounded-sm text-[11px] transition-all cursor-pointer border h-[26px] flex items-center ${
                isAllDates
                  ? 'bg-primary text-white border-primary font-bold shadow-2xs'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 font-medium'
              }`}
            >
              सर्व तारखा
            </button>
            <button
              type="button"
              onClick={handleSetToday}
              className={`px-2 py-1 rounded-sm text-[11px] transition-all cursor-pointer border h-[26px] flex items-center ${
                !isAllDates && selectedDate === activeBusinessDate
                  ? 'bg-primary text-white border-primary font-bold shadow-2xs'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 font-medium'
              }`}
            >
              आज
            </button>
            <button
              type="button"
              onClick={handleSetYesterday}
              className={`px-2 py-1 rounded-sm text-[11px] transition-all cursor-pointer border h-[26px] flex items-center ${
                !isAllDates && selectedDate === yesterdayStr
                  ? 'bg-primary text-white border-primary font-bold shadow-2xs'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 font-medium'
              }`}
            >
              काल
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) handleDateChange(e.target.value);
              }}
              className={`h-[26px] border rounded-sm px-2 text-[11px] font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white ${
                !isAllDates ? 'border-primary text-gray-900' : 'border-gray-300 text-gray-600'
              }`}
              title="विशिष्ट तारखेचे व्हाउचर पहा"
            />

            {!isAllDates && otherDatesCount > 0 && activeTab === 'PENDING' && (
              <button
                type="button"
                onClick={handleSetAllDates}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[10.5px] font-bold cursor-pointer h-[26px]"
                title="इतर तारखांचे प्रलंबित व्हाउचर्स पहा"
              >
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>इतर तारखा: {otherDatesCount}</span>
              </button>
            )}
          </div>

          {/* Center: Interactive Type Filter Pills (Replaces 5 bulky KPI cards & dropdown) */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-sm text-[11px] border transition-all cursor-pointer h-[26px] flex items-center gap-1 ${
                typeFilter === 'ALL'
                  ? 'bg-primary text-white border-primary font-bold shadow-2xs'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary/50 font-semibold'
              }`}
            >
              <span>सर्व</span>
              <span className={`font-mono text-[10px] ${typeFilter === 'ALL' ? 'text-white' : 'text-gray-500'}`}>
                ({totalCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter('RECEIPT')}
              className={`px-2.5 py-1 rounded-sm text-[11px] border transition-all cursor-pointer h-[26px] flex items-center gap-1 ${
                typeFilter === 'RECEIPT'
                  ? 'bg-primary text-white border-primary font-bold shadow-2xs'
                  : 'bg-white text-emerald-800 border-gray-300 hover:border-primary/50 font-semibold'
              }`}
            >
              <span>रिसिप्ट</span>
              <span className={`font-mono text-[10px] ${typeFilter === 'RECEIPT' ? 'text-white' : 'text-emerald-700'}`}>
                ({receiptsCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter('PAYMENT')}
              className={`px-2.5 py-1 rounded-sm text-[11px] border transition-all cursor-pointer h-[26px] flex items-center gap-1 ${
                typeFilter === 'PAYMENT'
                  ? 'bg-primary text-white border-primary font-bold shadow-2xs'
                  : 'bg-white text-rose-800 border-gray-300 hover:border-primary/50 font-semibold'
              }`}
            >
              <span>पेमेंट</span>
              <span className={`font-mono text-[10px] ${typeFilter === 'PAYMENT' ? 'text-white' : 'text-rose-700'}`}>
                ({paymentsCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter('JV_CONTRA')}
              className={`px-2.5 py-1 rounded-sm text-[11px] border transition-all cursor-pointer h-[26px] flex items-center gap-1 ${
                typeFilter === 'JV_CONTRA'
                  ? 'bg-primary text-white border-primary font-bold shadow-2xs'
                  : 'bg-white text-indigo-800 border-gray-300 hover:border-primary/50 font-semibold'
              }`}
            >
              <span>जर्नल/कॉन्ट्रा</span>
              <span className={`font-mono text-[10px] ${typeFilter === 'JV_CONTRA' ? 'text-white' : 'text-indigo-700'}`}>
                ({journalsCount})
              </span>
            </button>
          </div>

          {/* Right: Compact Search + Total Amount Summary */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative flex-1 sm:w-56 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="व्हाउचर क्र., नाव, खाते, रक्कम शोधा..."
                className="w-full h-[26px] pl-7 pr-6 text-[11px] border border-gray-300 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-gray-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="h-[26px] px-2.5 bg-primary/10 text-primary border border-primary/20 rounded-sm flex items-center gap-1 font-bold text-[11px] whitespace-nowrap">
              <span>एकूण:</span>
              <span className="font-mono font-black">
                ₹{filteredTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* CONTEXTUAL BULK ACTION BAR (Shown ONLY when 1+ vouchers are selected) */}
        {selectedVouchers.size > 0 && (
          <div className="px-3 py-1.5 bg-primary/10 border-b border-primary/25 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="font-bold text-primary">
                ✓ {selectedVouchers.size} व्हाउचर्स निवडले
              </span>
              <span className="text-gray-400">|</span>
              <span className="font-bold text-gray-800 font-mono">
                रक्कम: ₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <button
                type="button"
                onClick={() => setSelectedVouchers(new Set())}
                className="text-[11px] text-gray-600 hover:text-gray-900 underline cursor-pointer ml-1"
              >
                निवड रद्द करा
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'PENDING' ? (
                <>
                  <button
                    type="button"
                    onClick={handleDirectBulkDelete}
                    disabled={actionLoading}
                    className="px-2.5 py-1 rounded-sm text-xs font-bold bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 transition-all flex items-center gap-1 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>निवडलेले रद्द करा ({selectedVouchers.size})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePostSelected}
                    disabled={actionLoading}
                    className="px-3 py-1 rounded-sm text-xs font-bold bg-primary hover:opacity-90 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>निवडलेले पास करा ({selectedVouchers.size})</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={openBulkUnpassModal}
                  disabled={actionLoading}
                  className="px-3 py-1 rounded-sm text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>निवडलेले अन-पास करा ({selectedVouchers.size})</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* CLEAN 7-COLUMN VOUCHER TABLE */}
        <div className="overflow-x-auto min-h-[380px]">
          <table className="min-w-full divide-y divide-gray-200 text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-800 sticky top-0 z-10 border-b border-slate-300 font-bold">
              <tr>
                <th className="px-2 py-2 border-r border-gray-200 w-9 text-center">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-primary rounded-sm cursor-pointer align-middle"
                    checked={filteredVouchers.length > 0 && selectedVouchers.size === filteredVouchers.length}
                    onChange={selectAllFiltered}
                    title={`सर्व ${filteredVouchers.length} व्हाउचर्स निवडा (Select All)`}
                  />
                </th>
                <th className="px-2.5 py-2 border-r border-gray-200 w-24 text-left">तारीख</th>
                <th className="px-2.5 py-2 border-r border-gray-200 w-36 text-left">व्हाउचर क्र.</th>
                <th className="px-2 py-2 border-r border-gray-200 w-20 text-left">प्रकार</th>
                <th className="px-2.5 py-2 border-r border-gray-200 text-left">खाते / खातेदार व तपशील</th>
                <th className="px-2.5 py-2 border-r border-gray-200 w-28 text-right">रक्कम (₹)</th>
                <th className="px-2 py-2 w-40 text-center">कृती (Action)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white text-gray-800">
              {(activeTab === 'PENDING' ? loading : loadingApproved) && currentDataset.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-gray-500 font-bold">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>
                        {activeTab === 'PENDING'
                          ? 'प्रलंबित व्हाउचर्स लोड होत आहेत...'
                          : 'मंजूर व्हाउचर्स लोड होत आहेत...'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-gray-500">
                    {currentDataset.length === 0 ? (
                      <div className="space-y-1">
                        <CheckCircle2 className="w-8 h-8 text-primary mx-auto opacity-80" />
                        <p className="text-sm font-bold text-gray-800">
                          {activeTab === 'PENDING'
                            ? 'कोणतेही प्रलंबित व्हाउचर शिल्लक नाही'
                            : 'कोणतेही मंजूर व्हाउचर सापडले नाही'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {activeTab === 'PENDING'
                            ? 'सर्व व्हाउचर्स यशस्वीरीत्या मंजूर व पोस्ट झालेले आहेत.'
                            : 'व्हाउचर्स मंजूर केल्यानंतर ते येथे दिसतील.'}
                        </p>
                      </div>
                    ) : !isAllDates && dateFilteredVouchers.length === 0 ? (
                      <div className="space-y-2 max-w-md mx-auto">
                        <Info className="w-7 h-7 text-primary mx-auto opacity-80" />
                        <p className="text-xs font-bold text-gray-800">
                          निवडलेल्या तारखेचे ({selectedDate.split('-').reverse().join('/')}) कोणतेही{' '}
                          {activeTab === 'PENDING' ? 'प्रलंबित' : 'मंजूर'} व्हाउचर नाही.
                        </p>
                        {otherDatesCount > 0 && (
                          <button
                            type="button"
                            onClick={handleSetAllDates}
                            className="px-3 py-1 bg-primary text-white rounded-sm text-xs font-bold cursor-pointer shadow-2xs"
                          >
                            सर्व तारखांचे {otherDatesCount} व्हाउचर्स पहा
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="font-semibold">शोधलेल्या निकषांशी जुळणारे कोणतेही व्हाउचर सापडले नाही.</span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => {
                  const isSelected = selectedVouchers.has(v.voucherID);
                  const isExpanded = expandedVoucherId === v.voucherID;
                  const { cif, fullName, ledgerSummary } = getVoucherPartySummary(v);

                  let typeBadgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (v.voucherType === 'Receipt') {
                    typeBadgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  } else if (v.voucherType === 'Payment') {
                    typeBadgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
                  } else if (v.voucherType === 'Journal') {
                    typeBadgeStyle = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                  } else if (v.voucherType === 'Contra') {
                    typeBadgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                  }

                  return (
                    <React.Fragment key={v.voucherID}>
                      <tr
                        onClick={() => setExpandedVoucherId(isExpanded ? null : v.voucherID)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td
                          className="px-2 py-2 border-r border-gray-200 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 accent-primary rounded-sm cursor-pointer align-middle"
                            checked={isSelected}
                            onChange={() => toggleSelection(v.voucherID)}
                          />
                        </td>

                        <td className="px-2.5 py-2 border-r border-gray-200 text-left font-medium whitespace-nowrap text-gray-800">
                          <span className="inline-flex items-center gap-1">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            )}
                            <span>
                              {new Date(v.voucherDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                          </span>
                        </td>

                        <td className="px-2.5 py-2 border-r border-gray-200 text-left whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-primary font-mono">{v.voucherNo}</span>
                            {v.scrollNo ? (
                              <span
                                className="px-1.5 py-0.2 text-[9.5px] font-mono font-bold bg-amber-50 text-amber-900 rounded-sm border border-amber-200"
                                title={`स्क्रॉल क्र. #${v.scrollNo}`}
                              >
                                #{v.scrollNo}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-2 py-2 border-r border-gray-200 text-left whitespace-nowrap">
                          <span className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-sm border ${typeBadgeStyle}`}>
                            {v.voucherType}
                          </span>
                        </td>

                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-left max-w-md">
                          <div className="flex flex-wrap items-center gap-1.5 leading-snug">
                            {fullName && (
                              <span className="font-bold text-gray-900">{fullName}</span>
                            )}
                            {cif && (
                              <span className="px-1.5 py-0.2 rounded-sm bg-primary/10 text-primary border border-primary/20 font-mono font-bold text-[9.5px]">
                                {cif}
                              </span>
                            )}
                            {ledgerSummary && (
                              <span className={`${fullName ? 'text-gray-600 font-semibold text-[11px]' : 'font-bold text-gray-900'}`}>
                                {fullName ? `• ${ledgerSummary}` : ledgerSummary}
                              </span>
                            )}
                          </div>
                          {v.narration && (
                            <div className="text-[10.5px] text-gray-500 truncate mt-0.5" title={v.narration}>
                              {v.narration}
                            </div>
                          )}
                        </td>

                        <td className="px-2.5 py-2 border-r border-gray-200 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                          ₹{v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        <td
                          className="px-2 py-1.5 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-center gap-1">
                            {activeTab === 'PENDING' ? (
                              <button
                                type="button"
                                onClick={() => handleSinglePass(v)}
                                disabled={actionLoading}
                                className="bg-primary hover:opacity-90 text-white px-2.5 py-1 rounded-sm text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                                title="व्हाउचर मंजूर व पास करा"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>पास</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openSingleUnpassModal(v)}
                                disabled={actionLoading}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded-sm text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                                title="मंजूर व्हाउचर अन-पास करा"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>अन-पास</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenFormView(v)}
                              className="bg-white hover:bg-slate-100 text-slate-700 border border-gray-300 px-1.5 py-1 rounded-sm text-[10.5px] font-semibold transition-colors cursor-pointer flex items-center gap-0.5"
                              title="मूळ फॉर्ममध्ये नोंद उघडा (View Form)"
                            >
                              <Eye className="w-3 h-3 text-primary" />
                              <span>फॉर्म</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPrintingVoucherId(v.voucherID)}
                              className="bg-white hover:bg-slate-100 text-slate-700 border border-gray-300 p-1 rounded-sm transition-colors cursor-pointer flex items-center justify-center"
                              title="व्हाउचर पावती प्रिंट करा (Print Slip)"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-600" />
                            </button>

                            {activeTab === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => handleActionDelete(v)}
                                disabled={actionLoading}
                                className="bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-gray-300 hover:border-rose-300 p-1 rounded-sm transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
                                title="व्हाउचर रद्द व डिलीट करा (Delete & Rollback)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Clean Expanded Dr/Cr Ledger Breakdown (Matches VoucherMaster, zero duplicate buttons) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={7} className="p-2.5 border-l-4 border-primary text-left">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" />
                                <span>खातावणी तपशील (Ledger Breakdown — {v.voucherNo})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedVoucherId(null)}
                                className="text-gray-400 hover:text-gray-700 text-[10.5px] font-bold flex items-center gap-0.5 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>बंद</span>
                              </button>
                            </div>

                            <div className="overflow-x-auto bg-white border border-gray-200 rounded-sm shadow-2xs">
                              <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                                <thead className="bg-slate-100 text-slate-700 font-bold">
                                  <tr>
                                    <th className="px-3 py-1.5 text-left border-r border-gray-200">खाते (Ledger Name)</th>
                                    <th className="px-3 py-1.5 text-left border-r border-gray-200 w-56">खातेदार / सीआयएफ (CIF ID)</th>
                                    <th className="px-3 py-1.5 text-right border-r border-gray-200 w-36">नावे (Dr ₹)</th>
                                    <th className="px-3 py-1.5 text-right w-36">जमा (Cr ₹)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {v.voucherDetails?.map((vd, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="px-3 py-1.5 text-gray-900 font-bold border-r border-gray-200">
                                        <span>{vd.ledger?.ledgerName || 'Unknown Ledger'}</span>
                                        {vd.narration ? (
                                          <span className="text-gray-500 font-normal italic ml-1.5 text-[10.5px]">
                                            ({vd.narration})
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="px-3 py-1.5 text-gray-700 border-r border-gray-200 font-medium">
                                        {(() => {
                                          const ledgerName = vd.ledger?.ledgerName || '';
                                          const accountType = vd.ledger?.accountType || '';
                                          const isCashOrGeneral =
                                            accountType === 'Cash In Hand' ||
                                            ledgerName.includes('रोख') ||
                                            ledgerName.toLowerCase().includes('cash');

                                          if (isCashOrGeneral) {
                                            return <span className="text-gray-400 font-mono">-</span>;
                                          }

                                          const cust = vd.customer || vd.member?.customer;
                                          const cifVal = cust?.CIFNo || cust?.cifNo;
                                          const fName = cust?.FirstName || cust?.firstName || vd.member?.FirstName || vd.member?.firstName || '';
                                          const lName = cust?.LastName || cust?.lastName || vd.member?.LastName || vd.member?.lastName || '';
                                          const fFullName = `${fName} ${lName}`.trim();

                                          if (cifVal) {
                                            return (
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-primary font-mono text-[11px]">{cifVal}</span>
                                                {fFullName ? <span className="text-gray-700">{fFullName}</span> : null}
                                              </div>
                                            );
                                          }

                                          const memCode = vd.member?.MemberCode || vd.member?.memberCode;
                                          if (memCode || fFullName) {
                                            return (
                                              <div className="flex items-center gap-1.5">
                                                {memCode && <span className="font-bold text-gray-800 font-mono">{memCode}</span>}
                                                {fFullName && <span className="text-gray-700">{fFullName}</span>}
                                              </div>
                                            );
                                          }

                                          return <span className="text-gray-400 font-mono">-</span>;
                                        })()}
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-rose-700 font-mono font-bold border-r border-gray-200">
                                        {vd.drCr === 'Dr' ? `₹${vd.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-emerald-700 font-mono font-bold">
                                        {vd.drCr === 'Cr' ? `₹${vd.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-slate-100 font-bold text-[11px] border-t border-slate-300">
                                  <tr>
                                    <td colSpan={2} className="px-3 py-1 text-right text-gray-800 border-r border-gray-200">
                                      एकूण बेरीज (Total Dr / Cr):
                                    </td>
                                    <td className="px-3 py-1 text-right text-rose-700 font-mono font-black border-r border-gray-200">
                                      ₹{(v.voucherDetails?.filter((d) => d.drCr === 'Dr').reduce((s, d) => s + (d.amount || 0), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-1 text-right text-emerald-800 font-mono font-black">
                                      ₹{(v.voucherDetails?.filter((d) => d.drCr === 'Cr').reduce((s, d) => s + (d.amount || 0), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          SINGLE UNPASS CONFIRMATION MODAL (Theme-Matched)
          ======================================================== */}
      {unpassModalOpen && targetVoucherToUnpass && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-sm shadow-xl border border-gray-300 w-full max-w-md overflow-hidden">
            <div className="bg-primary text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-white" />
                <h3 className="font-bold text-xs">मंजूर व्हाउचर अन-पास करा (Revert to Pending)</h3>
              </div>
              <button
                type="button"
                onClick={closeUnpassModals}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="bg-slate-50 border border-gray-200 rounded-sm p-3 space-y-1.5">
                <div className="flex justify-between items-center border-b border-gray-200 pb-1.5 font-bold">
                  <span className="font-mono text-primary">{targetVoucherToUnpass.voucherNo}</span>
                  <span className="font-mono font-black text-gray-900">
                    ₹{targetVoucherToUnpass.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-600">
                  <span>तारीख: <strong className="text-gray-900">{new Date(targetVoucherToUnpass.voucherDate).toLocaleDateString('en-GB')}</strong></span>
                  <span>प्रकार: <strong className="text-gray-900">{targetVoucherToUnpass.voucherType}</strong></span>
                  {targetVoucherToUnpass.scrollNo ? (
                    <span>स्क्रॉल: <strong className="text-amber-800">#{targetVoucherToUnpass.scrollNo}</strong></span>
                  ) : null}
                </div>
              </div>

              <p className="text-[11px] text-gray-600 leading-relaxed">
                हे व्हाउचर अन-पास केल्यास त्याची स्थिती पुन्हा <strong>प्रलंबित (Pending)</strong> होईल व ते पक्क्या रोजकीर्दीतून तात्पुरते वगळले जाईल.
              </p>

              {unpassError && (
                <div className="p-2 bg-rose-50 text-rose-800 border border-rose-200 text-xs rounded-sm font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{unpassError}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeUnpassModals}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-sm text-xs border border-gray-300 cursor-pointer disabled:opacity-50"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleUnpass}
                disabled={actionLoading}
                autoFocus
                className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>अन-पास होत आहे...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>अन-पास निश्चित करा</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          BULK UNPASS CONFIRMATION MODAL (Theme-Matched)
          ======================================================== */}
      {bulkUnpassModalOpen && selectedVouchers.size > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-sm shadow-xl border border-gray-300 w-full max-w-md overflow-hidden">
            <div className="bg-primary text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-white" />
                <h3 className="font-bold text-xs">एकत्रित व्हाउचर्स अन-पास करा (Bulk Unpass)</h3>
              </div>
              <button
                type="button"
                onClick={closeUnpassModals}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="bg-slate-50 border border-gray-200 rounded-sm p-3 space-y-2">
                <div className="flex justify-between items-center font-bold">
                  <span>निवडलेले व्हाउचर्स: <strong className="text-primary">{selectedVouchers.size}</strong></span>
                  <span className="font-mono">एकूण: ₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="max-h-24 overflow-y-auto bg-white p-1.5 border border-gray-200 rounded-sm text-[10.5px] space-y-1">
                  {selectedVouchersList.map((v) => (
                    <div key={v.voucherID} className="flex justify-between border-b border-gray-100 last:border-0 pb-0.5">
                      <span className="font-mono font-bold text-primary">{v.voucherNo}</span>
                      <span className="text-gray-500">{v.voucherType}</span>
                      <span className="font-mono font-bold">₹{v.totalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-gray-600 leading-relaxed">
                निवडलेले सर्व <strong>{selectedVouchers.size}</strong> मंजूर व्हाउचर्स पुन्हा <strong>प्रलंबित (Pending)</strong> स्थितीत पाठवले जातील.
              </p>

              {unpassError && (
                <div className="p-2 bg-rose-50 text-rose-800 border border-rose-200 text-xs rounded-sm font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{unpassError}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeUnpassModals}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-sm text-xs border border-gray-300 cursor-pointer disabled:opacity-50"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkUnpass}
                disabled={actionLoading}
                autoFocus
                className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>अन-पास होत आहे...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>सर्व ({selectedVouchers.size}) अन-पास करा</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          OFFICIAL VOUCHER PRINT SLIP MODAL
          ======================================================== */}
      {printingVoucherId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-sm max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-300 relative">
            <VoucherPrint voucherId={printingVoucherId} onBack={() => setPrintingVoucherId(null)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherPosting;
