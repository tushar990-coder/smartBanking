import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Building,
  Calendar,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Info,
  RotateCcw,
  Clock,
  Printer,
  Eye
} from 'lucide-react';
import VoucherPrint from './VoucherPrint';

interface VoucherDetail {
  voucherDetailID: number;
  ledgerID: number;
  drCr: string;
  amount: number;
  narration: string;
  ledger: { ledgerName: string };
  customer?: {
    cifNo?: string;
    CIFNo?: string;
    firstName?: string;
    lastName?: string;
    FirstName?: string;
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
      firstName?: string;
      lastName?: string;
      FirstName?: string;
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
  const [typeFilter, setTypeFilter] = useState('ALL');
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

  const initialDate = user?.businessDate ? user.businessDate.split('T')[0] : todayStr;
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [isAllDates, setIsAllDates] = useState<boolean>(false);

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

  useEffect(() => {
    fetchUnpostedVouchers();
    fetchApprovedVouchers();
  }, []);

  const isOpeningMigrationVoucher = (v: Voucher) => {
    const vNo = v.voucherNo || '';
    const narr = (v.narration || '').toLowerCase();
    return (
      vNo.includes('-OP-') ||
      vNo.startsWith('JV-FD-OP-') ||
      vNo.startsWith('REC-FD-OP-') ||
      vNo.startsWith('JV-RD-OP-') ||
      vNo.startsWith('REC-RD-OP-') ||
      vNo.startsWith('JV-SH-OP-') ||
      vNo.startsWith('JV-INV-OP-') ||
      (v.voucherType || '').toLowerCase() === 'opening' ||
      narr.includes('आरंभिक शिल्लक') ||
      narr.includes('opening balance migration')
    );
  };

  const fetchApprovedVouchers = async () => {
    setLoadingApproved(true);
    try {
      const branchId = user?.branchID || 1;
      const res = await fetch(`/api/VoucherPosting/Approved?branchId=${branchId}`);
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
      const branchId = user?.branchID || 1;
      const res = await fetch(`/api/VoucherPosting/Unposted?branchId=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        const safeList: Voucher[] = (Array.isArray(data) ? data : []).filter((v: Voucher) => !isOpeningMigrationVoucher(v));
        setVouchers(safeList);
        setSelectedVouchers(new Set());

        const params = new URLSearchParams(window.location.search);
        const entityIdStr = params.get('entityId');
        const voucherIdStr = params.get('voucherId') || params.get('id');
        const targetVId = voucherIdStr ? parseInt(voucherIdStr) : (entityIdStr ? parseInt(entityIdStr) : null);

        if (targetVId && data.some((v: any) => v.voucherID === targetVId)) {
          const targetV = data.find((v: any) => v.voucherID === targetVId);
          if (targetV?.voucherDate) {
            setSelectedDate(targetV.voucherDate.split('T')[0]);
            setIsAllDates(false);
          }
          setExpandedVoucherId(targetVId);
          setSelectedVouchers(new Set([targetVId]));
        }
      } else {
        setError('प्रलंबित व्हाउचर्स लोड करताना त्रुटी आली. (Failed to load pending vouchers)');
      }
    } catch (err) {
      setError('सर्व्हरशी संपर्क साधता आला नाही. (Network Error)');
    } finally {
      setLoading(false);
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
    } catch (err) {
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
    } catch (err) {
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

    // 5. Fixed Deposit Withdrawal / Closure
    const isFdWithdrawal =
      vNo.startsWith('JV-FD-CLOSE-') ||
      vNo.startsWith('JV-FD-PRECLOSE-') ||
      narr.includes('fd maturity payout') ||
      v.narration?.includes('मुदत ठेव पूर्ण क्लोजर') ||
      narr.includes('fd premature') ||
      v.narration?.includes('मुदतपूर्व परतावा') ||
      v.narration?.includes('मुदत ठेव बंद');

    // 6. Fixed Deposit Account Opening
    const isFdOpening =
      vNo.startsWith('REC-FD-OP-') ||
      vNo.startsWith('JV-FD-OP-') ||
      vNo.startsWith('REC-FD-') ||
      v.narration?.includes('मुदत ठेव रक्कम जमा') ||
      v.narration?.includes('नवीन मुदत ठेव खाते') ||
      v.narration?.includes('मुदत ठेव खाते उघडले') ||
      narr.includes('fd account opened');

    // 7. Recurring Deposit (RD)
    const isRdOpening =
      vNo.startsWith('REC-RD-OP-') ||
      v.narration?.includes('आवर्ती ठेव खाते उघडले') ||
      narr.includes('rd account opened');

    const isRdWithdrawal =
      vNo.startsWith('JV-RD-CLOSE-') ||
      v.narration?.includes('आवर्ती ठेव बंद') ||
      narr.includes('rd maturity') ||
      narr.includes('rd closed');

    const isRdCollection =
      vNo.startsWith('REC-RD-') ||
      v.narration?.includes('आवर्ती ठेव हप्ता') ||
      narr.includes('rd installment');

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

  // Direct Single Delete (थेट डिलीट - कारण विचारणे बंद)
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
    } catch (err) {
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
    } catch (err) {
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
    const today = user?.businessDate ? user.businessDate.split('T')[0] : todayStr;
    handleDateChange(today);
  };

  const handleSetYesterday = () => {
    handleDateChange(yesterdayStr);
  };

  const handleToggleAllDates = () => {
    setIsAllDates((prev) => !prev);
    setSelectedVouchers(new Set());
  };

  // Group distinct dates having vouchers in current active tab
  const currentDataset = activeTab === 'PENDING' ? vouchers : approvedVouchers;

  const activeDateMap = useMemo(() => {
    const map = new Map<string, number>();
    currentDataset.forEach((v) => {
      const dStr = v.voucherDate ? v.voucherDate.split('T')[0] : '';
      if (dStr) {
        map.set(dStr, (map.get(dStr) || 0) + 1);
      }
    });
    return map;
  }, [currentDataset]);

  // Sorted descending (latest date first)
  const uniqueActiveDates = useMemo(() => {
    return Array.from(activeDateMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [activeDateMap]);

  // Vouchers filtered strictly by Date first
  const dateFilteredVouchers = useMemo(() => {
    if (isAllDates) return currentDataset;
    return currentDataset.filter((v) => {
      const vDateStr = v.voucherDate ? v.voucherDate.split('T')[0] : '';
      return vDateStr === selectedDate;
    });
  }, [currentDataset, selectedDate, isAllDates]);

  // Other dates count (for Backlog alert)
  const otherDatesCount = useMemo(() => {
    return currentDataset.filter((v) => {
      const vDateStr = v.voucherDate ? v.voucherDate.split('T')[0] : '';
      return vDateStr !== selectedDate;
    }).length;
  }, [currentDataset, selectedDate]);

  // Filter vouchers based on search query and type filter applied to dateFilteredVouchers
  const filteredVouchers = useMemo(() => {
    return dateFilteredVouchers.filter((v) => {
      const matchesType = typeFilter === 'ALL' || (v.voucherType || '').toUpperCase() === typeFilter.toUpperCase();
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesType;

      const matchesNo = (v.voucherNo || '').toLowerCase().includes(query);
      const matchesScroll = (v.scrollNo || '').toString().includes(query);
      const matchesNarration = (v.narration || '').toLowerCase().includes(query);
      const matchesAmount = (v.totalAmount || 0).toString().includes(query);
      const matchesLedger = v.voucherDetails?.some((vd) =>
        (vd.ledger?.ledgerName || '').toLowerCase().includes(query)
      );

      return matchesType && (matchesNo || matchesScroll || matchesNarration || matchesAmount || matchesLedger);
    });
  }, [dateFilteredVouchers, typeFilter, searchQuery]);

  // Calculate metrics based on dateFilteredVouchers
  const totalCount = dateFilteredVouchers.length;
  const receiptsCount = dateFilteredVouchers.filter((v) => v.voucherType === 'Receipt').length;
  const paymentsCount = dateFilteredVouchers.filter((v) => v.voucherType === 'Payment').length;
  const totalAmount = dateFilteredVouchers.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

  const selectedVouchersList = dateFilteredVouchers.filter((v) => selectedVouchers.has(v.voucherID));
  const selectedTotalAmount = selectedVouchersList.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

  return (
    <div className="p-2 sm:p-3 max-w-full min-h-full flex flex-col bg-gray-50 text-[11px] font-sans relative pb-28">
      {/* Outer Container */}
      <div className="bg-white rounded-md shadow-sm border border-gray-200 flex flex-col">
        {/* Clean, Light Header Banner */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 rounded-t-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 shadow-2xs">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                <span>व्हाउचर पासिंग, मंजुरी व व्यवस्थापन (Voucher Passing & Approval)</span>
              </h2>
              <p className="text-[11px] text-slate-500 font-normal">
                कोअर बँकिंग दुहेरी नियंत्रण (Maker-Checker Approval & Audit System)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={refreshAll}
              disabled={loading || loadingApproved || actionLoading}
              className="bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded text-xs font-semibold border border-slate-300 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingApproved ? 'animate-spin' : ''}`} />
              <span>रीफ्रेश</span>
            </button>

            {activeTab === 'PENDING' ? (
              <>
                {/* Verify Pre-Posting Draft Daybook Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate('draft-daybook');
                    } else {
                      window.location.href = '/reports/draft-daybook';
                    }
                  }}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 px-2.5 py-1.5 rounded text-xs font-semibold border border-amber-300 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="व्हाउचर पासिंग करण्यापूर्वी कच्ची रोजकीर्द तपासा (Draft Daybook)"
                >
                  <span>📖</span>
                  <span>कच्ची रोजकीर्द (Draft Daybook)</span>
                </button>

                {/* Bulk Reject Button */}
                <button
                  onClick={handleDirectBulkDelete}
                  disabled={selectedVouchers.size === 0 || actionLoading}
                  className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    selectedVouchers.size > 0
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 shadow-2xs'
                      : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed shadow-none'
                  }`}
                  title="निवडलेले सर्व व्हाउचर थेट रद्द व डिलीट करा"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>निवडलेले रद्द करा ({selectedVouchers.size})</span>
                </button>

                {/* Bulk Post Button */}
                <button
                  onClick={handlePostSelected}
                  disabled={selectedVouchers.size === 0 || actionLoading}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    selectedVouchers.size > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>निवडलेले पास करा ({selectedVouchers.size})</span>
                </button>
              </>
            ) : (
              <>
                {/* Official Daybook Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate('daybook');
                    } else {
                      window.location.href = '/reports/daybook';
                    }
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 px-2.5 py-1.5 rounded text-xs font-semibold border border-emerald-300 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="मंजूर व्हाउचर्सची अधिकृत पक्की रोजकीर्द तपासा (Daybook)"
                >
                  <span>📘</span>
                  <span>पक्की रोजकीर्द (Daybook)</span>
                </button>

                {/* Bulk Unpass Button */}
                <button
                  onClick={openBulkUnpassModal}
                  disabled={selectedVouchers.size === 0 || actionLoading}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    selectedVouchers.size > 0
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none'
                  }`}
                  title="निवडलेले मंजूर व्हाउचर्स पुन्हा प्रलंबित स्थितीत पाठवा (Revert to Pending)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>निवडलेले अन-पास करा ({selectedVouchers.size})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dual Tab Strip: Pending vs Approved */}
        <div className="flex border-b border-gray-200 bg-slate-50/70 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('PENDING');
              setSelectedVouchers(new Set());
              setMessage('');
              setError('');
            }}
            className={`px-4 py-2 font-bold text-xs rounded-t-md transition-all flex items-center gap-2 cursor-pointer border-t border-l border-r ${
              activeTab === 'PENDING'
                ? 'bg-white text-emerald-800 border-t-2 border-t-emerald-600 border-x-gray-200 border-b-transparent shadow-xs -mb-px z-10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${activeTab === 'PENDING' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>प्रलंबित व्हाउचर्स (Pending)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'PENDING'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {vouchers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('APPROVED');
              setSelectedVouchers(new Set());
              setMessage('');
              setError('');
            }}
            className={`px-4 py-2 font-bold text-xs rounded-t-md transition-all flex items-center gap-2 cursor-pointer border-t border-l border-r ${
              activeTab === 'APPROVED'
                ? 'bg-white text-emerald-800 border-t-2 border-t-emerald-600 border-x-gray-200 border-b-transparent shadow-xs -mb-px z-10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${activeTab === 'APPROVED' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>मंजूर व्हाउचर्स (Approved)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {approvedVouchers.length}
            </span>
          </button>
        </div>

        <div className="p-3 space-y-2.5">
          {/* CBS Date Selector & Backlog Management Toolbar */}
          <div className="bg-slate-50/70 p-2 rounded-md border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>तारीख:</span>
              </div>

              {/* Date Input */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    handleDateChange(e.target.value);
                  }
                }}
                disabled={isAllDates}
                className={`border px-2 py-1 rounded text-xs font-semibold transition-all focus:outline-none focus:border-emerald-600 ${
                  isAllDates
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-900 border-gray-300 shadow-2xs'
                }`}
                title="व्हाउचर तारीख निवडा"
              />

              {/* Quick Date Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSetToday}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer border ${
                    !isAllDates && selectedDate === (user?.businessDate ? user.businessDate.split('T')[0] : todayStr)
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}
                  title="आजच्या तारखेचे व्हाउचर दाखवा"
                >
                  आज
                </button>

                <button
                  type="button"
                  onClick={handleSetYesterday}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer border ${
                    !isAllDates && selectedDate === yesterdayStr
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}
                  title="कालच्या तारखेचे व्हाउचर दाखवा"
                >
                  काल
                </button>

                <button
                  type="button"
                  onClick={handleToggleAllDates}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer border ${
                    isAllDates
                      ? 'bg-slate-700 text-white border-slate-700 shadow-2xs font-bold'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}
                  title="सर्व तारखांचे एकत्रित व्हाउचर पाहण्यासाठी टॉगल करा"
                >
                  {isAllDates ? '✓ सर्व तारखा' : 'सर्व तारखा'}
                </button>
              </div>

              {/* Integrated Compact Backlog Notice (Eliminates the bulky yellow box) */}
              {!isAllDates && otherDatesCount > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    इतर तारखांचे <strong>{otherDatesCount}</strong> व्हाउचर {activeTab === 'PENDING' ? 'प्रलंबित' : 'उपलब्ध'}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleAllDates}
                    className="text-amber-800 font-bold underline hover:text-amber-950 cursor-pointer ml-0.5"
                  >
                    सर्व पहा
                  </button>
                </div>
              )}
            </div>

            {/* Backlog Date Jump Pills */}
            {uniqueActiveDates.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <span className="text-gray-400 text-[10.5px]">तारखा:</span>
                {uniqueActiveDates.map(([dStr, count]) => {
                  const isCurrent = !isAllDates && selectedDate === dStr;
                  const displayDate = dStr.split('-').reverse().join('/');
                  return (
                    <button
                      key={dStr}
                      type="button"
                      onClick={() => handleDateChange(dStr)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
                        isCurrent
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                      title={`${displayDate} चे ${count} व्हाउचर`}
                    >
                      <span>{displayDate}</span>
                      <span className={`px-1 rounded-full text-[9px] ${
                        isCurrent ? 'bg-white/30 text-white font-bold' : 'bg-slate-100 text-slate-600 font-bold'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clean Summary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-white p-2.5 rounded-md border border-gray-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {activeTab === 'PENDING'
                    ? (!isAllDates ? 'निवडलेली तारीख प्रलंबित' : 'एकूण प्रलंबित व्हाउचर्स')
                    : (!isAllDates ? 'निवडलेली तारीख मंजूर' : 'एकूण मंजूर व्हाउचर्स')}
                </p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-base font-bold text-slate-800 font-mono">{totalCount}</p>
                  {!isAllDates && currentDataset.length > 0 && (
                    <span className="text-[10px] text-gray-400 font-medium">
                      (एकूण: {currentDataset.length})
                    </span>
                  )}
                </div>
              </div>
              <span className="p-1.5 bg-slate-50 text-slate-600 rounded text-sm">{activeTab === 'PENDING' ? '⏳' : '✅'}</span>
            </div>

            <div className="bg-white p-2.5 rounded-md border border-gray-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">रिसिप्ट्स (Receipts)</p>
                <p className="text-base font-bold text-emerald-700 font-mono mt-0.5">{receiptsCount}</p>
              </div>
              <span className="p-1.5 bg-emerald-50 rounded text-sm">📥</span>
            </div>

            <div className="bg-white p-2.5 rounded-md border border-gray-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider">पेमेंट्स (Payments)</p>
                <p className="text-base font-bold text-rose-700 font-mono mt-0.5">{paymentsCount}</p>
              </div>
              <span className="p-1.5 bg-rose-50 rounded text-sm">📤</span>
            </div>

            <div className="bg-white p-2.5 rounded-md border border-gray-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  {activeTab === 'PENDING' ? 'प्रलंबित रक्कम' : 'मंजूर रक्कम'}
                </p>
                <p className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <span className="p-1.5 bg-amber-50 rounded text-sm">💰</span>
            </div>
          </div>

          {/* Feedback Alerts */}
          {message && (
            <div className="p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs rounded-sm font-bold flex items-center gap-2 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-rose-50 text-rose-900 border border-rose-300 text-xs rounded-sm font-bold flex items-center gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Master Table Container */}
          <div className="bg-white rounded-sm shadow-2xs border border-gray-200">
            {/* Controls Header */}
            <div className="p-2 bg-gray-100 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <label className="flex items-center space-x-2 cursor-pointer font-bold text-gray-800 select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary rounded-sm border-gray-400 focus:ring-primary cursor-pointer"
                    checked={selectedVouchers.size === filteredVouchers.length && filteredVouchers.length > 0}
                    onChange={selectAllFiltered}
                  />
                  <span className="text-xs">
                    सर्व {filteredVouchers.length} व्हाउचर्स निवडा (Select All
                    {!isAllDates ? ` - ${selectedDate.split('-').reverse().join('/')}` : ''})
                  </span>
                </label>
                {selectedVouchers.size > 0 && (
                  <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-sm border border-primary/20">
                    निवडलेली रक्कम: ₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="व्हाउचर क्र., नरेशन किंवा रक्कमेने शोधा..."
                    className="w-full pl-7 pr-6 py-1 text-xs border border-gray-300 rounded-sm focus:outline-none focus:border-primary bg-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 font-bold"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="border border-gray-300 px-2.5 py-1 rounded-sm text-xs focus:outline-none focus:border-primary bg-white font-semibold"
                >
                  <option value="ALL">सर्व प्रकार (All Types)</option>
                  <option value="RECEIPT">रिसिप्ट (Receipt)</option>
                  <option value="PAYMENT">पेमेंट (Payment)</option>
                  <option value="JOURNAL">जर्नल (Journal)</option>
                  <option value="CONTRA">कॉन्ट्रा (Contra)</option>
                </select>
              </div>
            </div>

            {/* Master Table Body */}
            <div className="overflow-x-auto min-h-[350px]">
              <table className="min-w-full divide-y divide-gray-200 text-xs text-center border-collapse">
                <thead className="bg-slate-50 text-slate-700 sticky top-0 z-10 border-b border-gray-200 shadow-2xs font-bold">
                  <tr>
                    <th className="px-2 py-2 border-r border-gray-200 font-bold w-10 text-center text-slate-700">#</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold w-24 text-left text-slate-700">तारीख</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold w-36 text-left text-slate-700">व्हाउचर क्र.</th>
                    <th className="px-2 py-2 border-r border-gray-200 font-bold w-20 text-center text-slate-700">स्क्रॉल</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold w-20 text-left text-slate-700">प्रकार</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold text-left text-slate-700">तपशील</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 font-bold w-28 text-right text-slate-700">रक्कम (₹)</th>
                    <th className="px-2 py-2 border-r border-gray-200 font-bold w-16 text-center text-slate-700">खाती</th>
                    <th className="px-2 py-2 font-bold w-44 text-center text-slate-700">कृती (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white text-gray-800">
                  {(activeTab === 'PENDING' ? loading : loadingApproved) && currentDataset.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500 font-bold">
                        <div className="inline-flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                          <span>
                            {activeTab === 'PENDING'
                              ? 'प्रलंबित व्हाउचर्स लोड होत आहेत... (Loading Pending Vouchers...)'
                              : 'मंजूर व्हाउचर्स लोड होत आहेत... (Loading Approved Vouchers...)'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500 font-bold">
                        {currentDataset.length === 0 ? (
                          <div className="space-y-1">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                            <p className="text-sm font-bold text-gray-800">
                              {activeTab === 'PENDING'
                                ? 'कोणतेही प्रलंबित व्हाउचर शिल्लक नाही'
                                : 'कोणतेही मंजूर व्हाउचर सापडले नाही'}
                            </p>
                            <p className="text-xs text-gray-500 font-normal">
                              {activeTab === 'PENDING'
                                ? 'सर्व व्हाउचर्स यशस्वीरीत्या मंजूर व पोस्ट झालेले आहेत.'
                                : 'व्हाउचर्स मंजूर केल्यानंतर ते येथे दिसतील व आवश्यकता असल्यास अन-पास करता येतील.'}
                            </p>
                          </div>
                        ) : !isAllDates && dateFilteredVouchers.length === 0 ? (
                          <div className="space-y-2 max-w-md mx-auto">
                            <Info className="w-8 h-8 text-amber-500 mx-auto" />
                            <p className="text-sm font-bold text-gray-800">
                              निवडलेल्या तारखेचे ({selectedDate.split('-').reverse().join('/')}) कोणतेही{' '}
                              {activeTab === 'PENDING' ? 'प्रलंबित' : 'मंजूर'} व्हाउचर नाही
                            </p>
                            {otherDatesCount > 0 && (
                              <p className="text-xs text-amber-800 font-normal">
                                इतर तारखांचे एकूण {otherDatesCount} व्हाउचर उपलब्ध आहेत. ते पाहण्यासाठी वरील इतर तारखेवर क्लिक करा किंवा 'सर्व तारखा' बटण दाबा.
                              </p>
                            )}
                          </div>
                        ) : (
                          'शोधलेल्या निकषांशी जुळणारे कोणतेही व्हाउचर सापडले नाही.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((v) => {
                      const isSelected = selectedVouchers.has(v.voucherID);
                      const isExpanded = expandedVoucherId === v.voucherID;

                      let typeBadgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                      if (v.voucherType === 'Receipt') {
                        typeBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      } else if (v.voucherType === 'Payment') {
                        typeBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
                      } else if (v.voucherType === 'Journal') {
                        typeBadgeStyle = 'bg-purple-50 text-purple-700 border-purple-200';
                      } else if (v.voucherType === 'Contra') {
                        typeBadgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                      }

                      return (
                        <React.Fragment key={v.voucherID}>
                          <tr
                            onClick={() => setExpandedVoucherId(isExpanded ? null : v.voucherID)}
                            className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-50/40 font-medium' : ''
                            }`}
                          >
                            <td className="px-2 py-1.5 border-r border-gray-200 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-emerald-600 rounded-sm border-gray-300 focus:ring-emerald-500 cursor-pointer"
                                checked={isSelected}
                                onChange={() => toggleSelection(v.voucherID)}
                              />
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-left font-medium whitespace-nowrap text-gray-800">
                              <span className="mr-1 text-gray-400 text-[10px] inline-block">{isExpanded ? '▼' : '▶'}</span>
                              {new Date(v.voucherDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-left font-bold text-gray-900 whitespace-nowrap font-mono">
                              {v.voucherNo}
                            </td>
                            <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold whitespace-nowrap">
                              {v.scrollNo ? (
                                <span className="px-2 py-0.5 inline-flex text-[10px] font-bold bg-amber-50 text-amber-800 rounded-sm border border-amber-200">
                                  #{v.scrollNo}
                                </span>
                              ) : (
                                <span className="text-gray-400 font-mono text-[10px] italic">प्रलंबित</span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-left whitespace-nowrap">
                              <span className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-semibold rounded-sm border ${typeBadgeStyle}`}>
                                {v.voucherType}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-left text-gray-700 truncate max-w-xs" title={v.narration || ''}>
                              {v.narration ? (
                                <span>{v.narration}</span>
                              ) : (
                                <span className="text-gray-400 italic">तपशील उपलब्ध नाही</span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                              ₹{v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold text-gray-600">
                              {v.voucherDetails?.length || 0} खाती
                            </td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center justify-center gap-1">
                                {/* 1. मूळ फॉर्म (View Form) */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenFormView(v)}
                                  className="bg-white hover:bg-slate-100 text-slate-700 border border-gray-300 px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title="मूळ फॉर्ममध्ये नोंद पाहा (View Original Form)"
                                >
                                  <Eye className="w-3 h-3 text-slate-600" />
                                  <span>फॉर्म</span>
                                </button>

                                {/* 2. व्हाउचर पावती (Voucher Print Slip) */}
                                <button
                                  type="button"
                                  onClick={() => setPrintingVoucherId(v.voucherID)}
                                  className="bg-white hover:bg-slate-100 text-slate-700 border border-gray-300 px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title="व्हाउचर पावती पाहा व प्रिंट करा (Print Slip)"
                                >
                                  <Printer className="w-3 h-3 text-slate-600" />
                                  <span>व्हाउचर</span>
                                </button>

                                {/* 3. पास (फक्त प्रलंबित टॅबमध्ये) */}
                                {activeTab === 'PENDING' && (
                                  <button
                                    type="button"
                                    onClick={() => handleSinglePass(v)}
                                    disabled={actionLoading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                                    title="हे व्हाउचर थेट पास व मंजूर करा"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>पास</span>
                                  </button>
                                )}

                                {/* 4. अन-पास (फक्त मंजूर टॅबमध्ये) */}
                                {activeTab === 'APPROVED' && (
                                  <button
                                    type="button"
                                    onClick={() => openSingleUnpassModal(v)}
                                    disabled={actionLoading}
                                    className="bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                                    title="मंजूर व्हाउचर अन-पास करा"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>अन-पास</span>
                                  </button>
                                )}

                                {/* 5. हटवा / डिलीट */}
                                <button
                                  type="button"
                                  onClick={() => handleActionDelete(v)}
                                  disabled={actionLoading}
                                  className="bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-gray-300 hover:border-rose-300 p-1 rounded text-[10.5px] transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
                                  title={activeTab === 'PENDING' ? "व्हाउचर थेट रद्द व डिलीट करा" : "मंजूर व्हाउचर डिलीट करण्यासाठी प्रथम अन-पास करा"}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Voucher Details Breakdown */}
                          {isExpanded && (
                            <tr
                              ref={(el) => {
                                if (el) {
                                  setTimeout(() => {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                  }, 60);
                                }
                              }}
                              className="bg-slate-50 border-b-2 border-emerald-500/30"
                            >
                              <td colSpan={9} className="p-2.5 sm:p-3 text-left">
                                <div className="bg-white p-3 rounded-md border border-gray-200 shadow-xs space-y-2">
                                  <div className="flex flex-wrap justify-between items-center border-b border-gray-200 pb-2 gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="p-1 bg-slate-100 rounded text-slate-700">
                                        <Layers className="w-4 h-4 text-emerald-700" />
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                          <span>खाती तपशील (Ledger Breakdown for {v.voucherNo})</span>
                                        </h4>
                                        <p className="text-[10px] text-gray-500">
                                          तारीख: <span className="font-bold text-gray-700">{new Date(v.voucherDate).toLocaleDateString('en-GB')}</span> | 
                                          स्क्रॉल क्र.: <span className="font-bold text-amber-700">{v.scrollNo ? `#${v.scrollNo}` : 'मंजुरीनंतर'}</span> | 
                                          प्रकार: <span className="font-bold text-gray-700">{v.voucherType}</span>
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {/* 1. मूळ फॉर्म (View Form) */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenFormView(v);
                                        }}
                                        className="bg-white hover:bg-slate-50 text-slate-700 border border-gray-300 px-2.5 py-1 rounded text-[10.5px] font-semibold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                                        title="या नोंदीचा मूळ फॉर्म उघडा (Open Form View)"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                                        <span>मूळ फॉर्म (View Form)</span>
                                      </button>

                                      {/* 2. व्हाउचर पावती (Print Slip) */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPrintingVoucherId(v.voucherID);
                                        }}
                                        className="bg-white hover:bg-slate-50 text-slate-700 border border-gray-300 px-2.5 py-1 rounded text-[10.5px] font-semibold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                                        title="अधिकृत व्हाउचर पावती पाहा व प्रिंट करा (Print Slip)"
                                      >
                                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                                        <span>व्हाउचर पावती (Print Slip)</span>
                                      </button>

                                      {/* 3. पास (Pending मध्ये) */}
                                      {activeTab === 'PENDING' && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSinglePass(v);
                                          }}
                                          disabled={actionLoading}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[10.5px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                          title="हे व्हाउचर थेट मंजूर व पास करा (Approve & Pass)"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>व्हाउचर पास करा</span>
                                        </button>
                                      )}

                                      {/* 4. अन-पास (Approved मध्ये) */}
                                      {activeTab === 'APPROVED' && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openSingleUnpassModal(v);
                                          }}
                                          disabled={actionLoading}
                                          className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded text-[10.5px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                          title="मंजूरी मागे घ्या व प्रलंबित करा (Unpass)"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                          <span>अन-पास करा</span>
                                        </button>
                                      )}

                                      {/* 5. डिलीट (Delete) */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleActionDelete(v);
                                        }}
                                        disabled={actionLoading}
                                        className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 px-2.5 py-1 rounded text-[10.5px] font-semibold shadow-2xs transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                        title={activeTab === 'PENDING' ? "व्हाउचर थेट रद्द व डिलीट करा" : "मंजूर व्हाउचर डिलीट करण्यासाठी प्रथम अन-पास करा"}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>हटवा</span>
                                      </button>

                                      <span className="text-[11px] font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded border border-gray-300 ml-1">
                                        एकूण: ₹{v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedVoucherId(null);
                                        }}
                                        className="text-gray-400 hover:text-rose-600 px-2 py-1 rounded text-[10px] font-bold border border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                                        title="तपशील बंद करा"
                                      >
                                        <X className="w-3 h-3" />
                                        <span>बंद करा</span>
                                      </button>
                                    </div>
                                  </div>

                                  <div className="overflow-x-auto border border-gray-200 rounded-sm">
                                    <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-gray-300">
                                        <tr>
                                          <th className="px-3 py-1.5 text-left border-r border-gray-200">खाते (Ledger Name)</th>
                                          <th className="px-3 py-1.5 text-left border-r border-gray-200 w-52">सीआयएफ क्र. / खातेदार (CIF ID)</th>
                                          <th className="px-3 py-1.5 text-right border-r border-gray-200 w-36">नावे (Debit Dr ₹)</th>
                                          <th className="px-3 py-1.5 text-right w-36">जमा (Credit Cr ₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 bg-white">
                                        {v.voucherDetails?.map((vd, idx) => (
                                          <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                            <td className="px-3 py-1.5 text-gray-900 font-bold border-r border-gray-200">
                                              <span>{vd.ledger?.ledgerName || 'Unknown Ledger'}</span>
                                              {vd.narration ? (
                                                <span className="text-gray-500 font-normal italic ml-2 text-[10.5px]">({vd.narration})</span>
                                              ) : null}
                                            </td>
                                             <td className="px-3 py-1.5 text-gray-700 border-r border-gray-200 font-medium">
                                               {(() => {
                                                 const ledgerName = vd.ledger?.ledgerName || '';
                                                 const accountType = (vd.ledger as any)?.accountType || '';
                                                 const isCashOrGeneral = accountType === 'Cash In Hand' || 
                                                                         ledgerName.includes('रोख') || 
                                                                         ledgerName.toLowerCase().includes('cash');

                                                 if (isCashOrGeneral) {
                                                   return <span className="text-gray-400 font-mono">-</span>;
                                                 }

                                                 const cif = vd.customer?.CIFNo || vd.customer?.cifNo || vd.member?.customer?.CIFNo || vd.member?.customer?.cifNo;
                                                 const firstName = vd.customer?.FirstName || vd.customer?.firstName || vd.member?.customer?.FirstName || vd.member?.customer?.firstName || vd.member?.FirstName || vd.member?.firstName || '';
                                                 const lastName = vd.customer?.LastName || vd.customer?.lastName || vd.member?.customer?.LastName || vd.member?.customer?.lastName || vd.member?.LastName || vd.member?.lastName || '';
                                                 const fullName = `${firstName} ${lastName}`.trim();

                                                 if (cif) {
                                                   return (
                                                     <div className="flex flex-col leading-tight">
                                                       <span className="font-extrabold text-primary font-mono text-[11.5px]">{cif}</span>
                                                       {fullName ? <span className="text-[10px] text-gray-600 font-medium">{fullName}</span> : null}
                                                     </div>
                                                   );
                                                 }

                                                 const memCode = vd.member?.MemberCode || vd.member?.memberCode;
                                                 if (memCode) {
                                                   return (
                                                     <div className="flex flex-col leading-tight">
                                                       <span className="font-bold text-gray-800 font-mono text-[11.5px]">{memCode}</span>
                                                       {fullName ? <span className="text-[10px] text-gray-600 font-medium">{fullName}</span> : null}
                                                     </div>
                                                   );
                                                 }

                                                 return <span className="text-gray-400 font-mono">-</span>;
                                               })()}
                                             </td>
                                            <td className="px-3 py-1.5 text-right text-rose-600 font-mono font-bold border-r border-gray-200">
                                              {vd.drCr === 'Dr' ? `₹${vd.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className="px-3 py-1.5 text-right text-emerald-700 font-mono font-bold">
                                              {vd.drCr === 'Cr' ? `₹${vd.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-slate-100 font-bold text-[11px] border-t-2 border-slate-300">
                                        <tr>
                                          <td colSpan={2} className="px-3 py-1.5 text-right font-bold text-gray-800 border-r border-gray-200">
                                            एकूण बेरजा (Total Dr / Cr):
                                          </td>
                                          <td className="px-3 py-1.5 text-right text-rose-700 font-mono font-black border-r border-gray-200">
                                            ₹{(v.voucherDetails?.filter(d => d.drCr === 'Dr').reduce((s, d) => s + (d.amount || 0), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          <td className="px-3 py-1.5 text-right text-emerald-800 font-mono font-black">
                                            ₹{(v.voucherDetails?.filter(d => d.drCr === 'Cr').reduce((s, d) => s + (d.amount || 0), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
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
        </div>
      </div>


      {/* ========================================================
          SINGLE UNPASS CONFIRMATION MODAL
          ======================================================== */}
      {unpassModalOpen && targetVoucherToUnpass && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-md shadow-xl border border-amber-300 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-white" />
                <h3 className="font-bold text-xs">
                  मंजूर व्हाउचर अन-पास करा (Revert Voucher Approval to Pending)
                </h3>
              </div>
              <button
                type="button"
                onClick={closeUnpassModals}
                className="text-amber-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              {/* Voucher Summary Card */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-sm p-3 space-y-2 text-xs text-gray-800">
                <div className="flex justify-between items-center border-b border-amber-200 pb-1.5 font-bold">
                  <span className="font-mono text-amber-950 font-black">
                    व्हाउचर क्र.: {targetVoucherToUnpass.voucherNo}
                  </span>
                  <span className="px-2 py-0.5 rounded-sm bg-amber-200 text-amber-950 font-black text-[10px]">
                    {targetVoucherToUnpass.scrollNo ? `स्क्रॉल क्र. #${targetVoucherToUnpass.scrollNo}` : 'मंजूर'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-gray-500">तारीख: </span>
                    <span className="font-bold text-gray-900">
                      {new Date(targetVoucherToUnpass.voucherDate).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">प्रकार: </span>
                    <span className="font-bold text-gray-900">{targetVoucherToUnpass.voucherType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">रक्कम: </span>
                    <span className="font-bold text-amber-900 font-mono">
                      ₹{targetVoucherToUnpass.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">खाती संख्या: </span>
                    <span className="font-bold text-gray-900">
                      {targetVoucherToUnpass.voucherDetails?.length || 0}
                    </span>
                  </div>
                </div>

                {targetVoucherToUnpass.narration && (
                  <div className="border-t border-amber-200/60 pt-1 text-[11px]">
                    <span className="text-gray-500">तपशील: </span>
                    <span className="text-gray-800 font-medium">{targetVoucherToUnpass.narration}</span>
                  </div>
                )}
              </div>

              {/* CBS Core Banking Notice */}
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-sm text-[11px] text-blue-950 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">कोअर बँकिंग सुरक्षा व खातावणी प्रभाव:</p>
                  <p className="text-[10px] text-blue-900 mt-0.5 leading-relaxed">
                    हे व्हाउचर अन-पास केल्यास त्याची स्थिती पुन्हा <strong>प्रलंबित (Pending)</strong> होईल. 
                    याचा स्क्रॉल क्र. तात्पुरता रद्द होईल व हे व्हाउचर पक्क्या रोजकीर्द आणि दिवसअखेर (EOD) मधून वगळले जाईल.
                    आवश्यक दुरुस्ती झाल्यानंतर तुम्ही हे व्हाउचर पुन्हा पास करू शकता.
                  </p>
                </div>
              </div>

              {/* Audit Notice */}
              <div className="flex justify-between items-center text-[10.5px] bg-slate-50 border border-gray-200 px-2.5 py-1.5 rounded-sm">
                <span className="text-gray-600">सुरक्षा ऑडिट नोंद आपोआप ठेवली जाईल.</span>
                <span className="text-gray-500">
                  वापरकर्ता: <strong className="text-gray-800">{user?.username || 'Admin'}</strong>
                </span>
              </div>

              {/* Error display */}
              {unpassError && (
                <div className="p-2 bg-rose-50 text-rose-800 border border-rose-200 text-xs rounded-sm font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{unpassError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-100 px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeUnpassModals}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-sm text-xs border border-gray-300 cursor-pointer disabled:opacity-50"
              >
                मागे जा (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleUnpass}
                disabled={actionLoading}
                autoFocus
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-sm text-xs border border-amber-700 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>अन-पास करत आहे...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>अन-पास निश्चित करा (Confirm Unpass)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          BULK UNPASS CONFIRMATION MODAL
          ======================================================== */}
      {bulkUnpassModalOpen && selectedVouchers.size > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-md shadow-xl border border-amber-300 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-white" />
                <h3 className="font-bold text-xs">
                  एकत्रित मंजूर व्हाउचर्स अन-पास करा (Bulk Unpass Vouchers)
                </h3>
              </div>
              <button
                type="button"
                onClick={closeUnpassModals}
                className="text-amber-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              {/* Summary Card */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-sm p-3 space-y-2 text-xs text-gray-800">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-amber-950">
                    एकूण निवडलेले व्हाउचर्स: <strong>{selectedVouchers.size}</strong>
                  </span>
                  <span className="text-amber-950 font-mono font-bold">
                    एकूण रक्कम: ₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="max-h-24 overflow-y-auto bg-white p-1.5 border border-amber-200 rounded-sm text-[10px] space-y-1">
                  {selectedVouchersList.map((v) => (
                    <div key={v.voucherID} className="flex justify-between border-b border-gray-100 last:border-0 pb-0.5">
                      <span className="font-mono font-bold">{v.voucherNo} {v.scrollNo ? `(#${v.scrollNo})` : ''}</span>
                      <span className="text-gray-500">{v.voucherType}</span>
                      <span className="font-mono font-bold">₹{v.totalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CBS Core Banking Notice */}
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-sm text-[11px] text-blue-950 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">कोअर बँकिंग सुरक्षा व खातावणी प्रभाव:</p>
                  <p className="text-[10px] text-blue-900 mt-0.5 leading-relaxed">
                    हे सर्व <strong>{selectedVouchers.size}</strong> मंजूर व्हाउचर्स पुन्हा प्रलंबित (Pending) स्थितीत पाठवले जातील. 
                    दुरुस्तीनंतर ते प्रलंबित टॅबमधून पुन्हा मंजूर केले जाऊ शकतील.
                  </p>
                </div>
              </div>

              {/* Audit Notice */}
              <div className="flex justify-between items-center text-[10.5px] bg-slate-50 border border-gray-200 px-2.5 py-1.5 rounded-sm">
                <span className="text-gray-600">सर्व नोंदींसाठी सुरक्षा ऑडिट नोंद आपोआप ठेवली जाईल.</span>
                <span className="text-gray-500">
                  वापरकर्ता: <strong className="text-gray-800">{user?.username || 'Admin'}</strong>
                </span>
              </div>

              {/* Error display */}
              {unpassError && (
                <div className="p-2 bg-rose-50 text-rose-800 border border-rose-200 text-xs rounded-sm font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{unpassError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-100 px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeUnpassModals}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-sm text-xs border border-gray-300 cursor-pointer disabled:opacity-50"
              >
                मागे जा (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkUnpass}
                disabled={actionLoading}
                autoFocus
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-sm text-xs border border-amber-700 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>अन-पास करत आहे...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>सर्व {selectedVouchers.size} व्हाउचर्स अन-पास करा (Confirm Bulk Unpass)</span>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-300 relative">
            <VoucherPrint voucherId={printingVoucherId} onBack={() => setPrintingVoucherId(null)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherPosting;
