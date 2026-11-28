import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { resolveWriteBranchId } from '../utils/branchAccess';
import {
  CreditCard,
  Building2,
  Calendar,
  FileText,
  Wallet,
  AlertTriangle,
  Moon,
  Bell,
  X,
  ArrowUpRight,
  RefreshCw,
  Info,
  CheckCircle,
  Eye,
  Play,
  History,
  RotateCcw,
  ShieldCheck,
  CheckCheck,
  Search,
  LayoutGrid,
  ListFilter,
  CheckCircle2,
  Lock,
  Users,
  FileCheck,
  TrendingUp,
  FolderCheck,
  Filter,
  Printer,
  List,
  Layers
} from 'lucide-react';
import FdReceiptPrintModal from './FdReceiptPrintModal';

interface TodaysTasksDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
  showLoginModal?: boolean;
  onCloseLoginModal?: () => void;
  branchId?: number;
}

export interface TaskItem {
  id: string;
  accountNo?: string;
  memberName: string;
  details: string;
  amount?: number;
  dueDate?: string;
  status: string;
  targetTab?: string;
  entityId?: string;
  priority?: string;
  moduleName?: string;
  sectionTitleMr?: string;
  createdOn?: string;
  roleName?: string;
  canComplete?: boolean;
}

export interface TaskSection {
  id: string;
  titleMr: string;
  titleEn: string;
  category: string;
  moduleKey: string;
  icon: React.ElementType;
  count: number;
  totalAmount?: number;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  accentColor: string;
  targetTab: string;
  roles: string[];
  items: TaskItem[];
}

const KNOWN_MODULES = new Set([
  'vouchers',
  'loans',
  'loanapplications',
  'fd',
  'rd',
  'shares',
  'pigmy',
  'npa',
  'locker',
  'system'
]);

const normalizeModule = (val?: string | null) => (val || '').trim().toLowerCase();

const formatDateSafe = (val?: string | null, fallback = 'आज') => {
  if (!val) return fallback;
  const d = new Date(val);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-GB');
};

export default function TodaysTasksDashboard({
  onNavigate,
  showLoginModal = false,
  onCloseLoginModal,
  branchId: propBranchId
}: TodaysTasksDashboardProps) {
  const { user, globalBranchId } = useAuth();
  const gridSectionRef = useRef<HTMLDivElement | null>(null);

  // Resolve Effective Branch ID dynamically
  const effectiveBranchId = useMemo<number>(() => {
    if (propBranchId && propBranchId > 0) return propBranchId;
    return resolveWriteBranchId(user, globalBranchId);
  }, [propBranchId, user, globalBranchId]);

  // View & Filter States
  const [viewMode, setViewMode] = useState<'CARDS' | 'GRID'>('CARDS');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'URGENT' | 'HIGH'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'MANAGER' | 'CASHIER' | 'LOANS' | 'DEPOSITS' | 'SHARES' | 'LOCKER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [gridModuleFilter, setGridModuleFilter] = useState<string>('ALL');

  // Category List Modal State (Click any card/count -> view ALL items in scrollable table)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState('');

  // Modal & Data States
  const [isModalOpen, setIsModalOpen] = useState(showLoginModal);
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);
  const [borrowingDueEmis, setBorrowingDueEmis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [selectedItemDetails, setSelectedItemDetails] = useState<TaskItem | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [completedTodayCount, setCompletedTodayCount] = useState<number>(0);

  // CBS Auto-Renewal State
  const [autoRenewalCandidates, setAutoRenewalCandidates] = useState<any[]>([]);
  const [autoRenewalLoading, setAutoRenewalLoading] = useState(false);
  const [showAutoRenewalModal, setShowAutoRenewalModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [renewalLogs, setRenewalLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<any | null>(null);
  const [sansthaFdPolicy, setSansthaFdPolicy] = useState<string>('NEW_RECEIPT');
  const [policyLoadError, setPolicyLoadError] = useState<string>('');
  const [batchPrintAccount, setBatchPrintAccount] = useState<any | null>(null);
  const [batchPrintSide, setBatchPrintSide] = useState<'front' | 'endorsement'>('front');
  const [loadingPrintId, setLoadingPrintId] = useState<number | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [showRevertDialog, setShowRevertDialog] = useState<any | null>(null);

  // Sync login modal prop
  useEffect(() => {
    setIsModalOpen(showLoginModal);
  }, [showLoginModal]);

  // Toast auto-clear
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Fetch Auto Renewal Candidates
  const fetchAutoRenewalData = async (isMountedRef?: { current: boolean }) => {
    try {
      if (isMountedRef && !isMountedRef.current) return;
      setAutoRenewalLoading(true);
      const res = await axios.get('/api/FdAccounts/AutoRenewalCandidates', {
        params: { branchId: effectiveBranchId }
      });
      if (!isMountedRef || isMountedRef.current) {
        setAutoRenewalCandidates(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to load auto-renewal candidates:', err);
    } finally {
      if (!isMountedRef || isMountedRef.current) {
        setAutoRenewalLoading(false);
      }
    }
  };

  // Fetch Renewal Audit Logs
  const fetchRenewalLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await axios.get('/api/FdAccounts/AutoRenewalLogs', {
        params: { branchId: effectiveBranchId }
      });
      setRenewalLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load auto-renewal logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Fetch Live System Notifications & Borrowing Due EMIs
  const fetchLiveNotifications = async (isMountedRef?: { current: boolean }, forceRefresh = false) => {
    try {
      if (isMountedRef && !isMountedRef.current) return;
      setLoading(true);
      setLoadError('');

      // Trigger automatic live sync from real operational tables first
      await axios
        .post(`/api/Notification/generate`, null, {
          params: { branchId: effectiveBranchId, force: forceRefresh }
        })
        .catch(() => {});

      if (isMountedRef && !isMountedRef.current) return;

      const [notifRes, brwEmiRes, statsRes] = await Promise.all([
        axios.get('/api/Notification', {
          params: { branchId: effectiveBranchId, status: 'Active' }
        }),
        axios
          .get('/api/Borrowings/upcoming-emis', {
            params: { branchId: effectiveBranchId, days: 7 }
          })
          .catch(() => ({ data: { items: [] } })),
        axios
          .get('/api/Notification/stats', {
            params: { branchId: effectiveBranchId }
          })
          .catch(() => ({ data: null }))
      ]);

      if (!isMountedRef || isMountedRef.current) {
        const rawNotifs = Array.isArray(notifRes.data)
          ? notifRes.data
          : Array.isArray(notifRes.data?.items)
          ? notifRes.data.items
          : [];
        const rawEmis = Array.isArray(brwEmiRes.data?.items)
          ? brwEmiRes.data.items
          : Array.isArray(brwEmiRes.data)
          ? brwEmiRes.data
          : [];

        setLiveNotifications(rawNotifs);
        setBorrowingDueEmis(rawEmis);
        setCompletedTodayCount(Number(statsRes.data?.completedToday ?? 0));
      }
    } catch (err: any) {
      console.error('Error loading live notifications:', err);
      if (!isMountedRef || isMountedRef.current) {
        setLoadError(
          err?.response?.data?.message ||
            err?.message ||
            'आजची कामे लोड करताना सर्व्हर त्रुटी आली. कृपया पुन्हा रीफ्रेश करा.'
        );
      }
    } finally {
      if (!isMountedRef || isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const isMountedRef = { current: true };
    fetchLiveNotifications(isMountedRef, false);
    if (!showLoginModal) {
      fetchAutoRenewalData(isMountedRef);
      axios
        .get('/api/SansthaDetails')
        .then(r => {
          if (!isMountedRef.current) return;
          const row = Array.isArray(r.data) ? r.data[0] : r.data;
          if (!row?.fdRenewalReceiptPolicy) {
            setPolicyLoadError('संस्था FD पावती धोरण सेट केलेले नाही.');
            return;
          }
          setPolicyLoadError('');
          setSansthaFdPolicy(row.fdRenewalReceiptPolicy);
        })
        .catch(err => {
          if (!isMountedRef.current) return;
          console.error('SansthaDetails policy load failed', err);
          setPolicyLoadError('संस्था पावती धोरण लोड करण्यात अडचण आली.');
        });
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [effectiveBranchId, showLoginModal]);

  // Run Batch Auto-Renewal
  const handleRunBatch = async (specificIds?: number[]) => {
    if (
      !window.confirm(
        'तुम्हाला खरोखरच पात्र मुदत ठेव पावत्यांचे स्वयंचलित नूतनीकरण (Auto-Renewal Batch) करायचे आहे का?\n\nबँकिंग नियमांनुसार प्रचलित दराने नवीन पावत्या तयार होतील, जुन्या पावत्या बंद होतील व बॅलन्स्ड जर्नल व्हाउचर पोस्ट केले जातील.'
      )
    ) {
      return;
    }
    setRunningBatch(true);
    setBatchResult(null);
    try {
      const res = await axios.post('/api/FdAccounts/RunAutoRenewalBatch', {
        branchID: effectiveBranchId,
        processDate: new Date().toISOString(),
        specificAccountIDs: specificIds,
        executedBy: user?.username || 'Manager-EOD'
      });
      setBatchResult(res.data);
      await fetchAutoRenewalData();
      await fetchLiveNotifications(undefined, true);
    } catch (err: any) {
      alert(
        'बॅच रन करताना त्रुटी आली: ' +
          (err.response?.data?.message || err.response?.data || err.message)
      );
    } finally {
      setRunningBatch(false);
    }
  };

  const handleOpenBatchPrintModal = async (it: any, side: 'front' | 'endorsement') => {
    const newId = Number(it?.newFdAccountID || 0);
    if (newId <= 0) {
      alert('नवीन मुदत ठेव खाते ID उपलब्ध नाही. पावती प्रिंट करता येत नाही.');
      return;
    }
    setLoadingPrintId(newId);
    try {
      const res = await axios.get(`/api/FdAccounts/${newId}`);
      const acc = res.data;
      if (!acc) {
        alert('खाते माहिती लोड झाली नाही.');
        return;
      }
      setBatchPrintSide(side);
      setBatchPrintAccount({
        ...acc,
        oldReceiptNo: it.oldReceiptNo || acc.oldReceiptNo,
        oldAccountNo: it.oldAccountNo,
        oldDepositAmount: it.oldAmount || it.oldPrincipal,
        effectivePolicy: it.receiptPolicy || sansthaFdPolicy
      });
    } catch (err: any) {
      alert(
        'पावती प्रिंटसाठी खाते माहिती लोड करताना त्रुटी आली: ' +
          (err.response?.data?.message || err.message)
      );
    } finally {
      setLoadingPrintId(null);
    }
  };

  // 14-Day Reversal
  const handleRevert = async (account: any) => {
    if (!revertReason.trim()) {
      alert('कृपया नूतनीकरण रद्द करण्याचे कारण लिहा.');
      return;
    }
    const targetId = account.newFdAccountID || account.fdAccountID;
    setRevertingId(targetId);
    try {
      const res = await axios.post(`/api/FdAccounts/${targetId}/RevertAutoRenewal`, {
        revertReason: revertReason.trim(),
        revertedBy: user?.username || 'Manager'
      });
      alert(res.data?.message || 'नूतनीकरण यशस्वीरीत्या रद्द केले.');
      setShowRevertDialog(null);
      setRevertReason('');
      await fetchRenewalLogs();
      await fetchAutoRenewalData();
      await fetchLiveNotifications(undefined, true);
    } catch (err: any) {
      alert(
        'रिव्हर्ट करताना त्रुटी आली: ' +
          (err.response?.data?.message || err.response?.data || err.message)
      );
    } finally {
      setRevertingId(null);
    }
  };

  // Mark a system notification as completed
  const handleCompleteTask = async (item: TaskItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (item.canComplete === false || !/^\d+$/.test(item.id)) {
      handleActionClick(item.targetTab || 'borrowing-repayment', item.entityId);
      return;
    }
    try {
      setCompletingTaskId(item.id);
      await axios.post(`/api/Notification/${item.id}/complete`);

      setLiveNotifications(prev => prev.filter(n => String(n.notificationID) !== item.id));
      setCompletedTodayCount(prev => prev + 1);
      setSuccessToast('काम यशस्वीरित्या पूर्ण म्हणून चिन्हांकित केले!');

      if (selectedItemDetails?.id === item.id) {
        setSelectedItemDetails(null);
      }
    } catch (err: any) {
      alert('काम पूर्ण करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setCompletingTaskId(null);
    }
  };

  // Build ALL Banking Task Sections (Case-insensitive + Catch-All so ZERO notifications are ever dropped!)
  const taskSections = useMemo<TaskSection[]>(() => {
    const byMod = (modKey: string) =>
      liveNotifications.filter((n: any) => normalizeModule(n.moduleName) === modKey.toLowerCase());

    const voucherNotifs = byMod('Vouchers');
    const loanNotifs = byMod('Loans');
    const loanAppNotifs = byMod('LoanApplications');
    const fdNotifs = byMod('FD');
    const rdNotifs = byMod('RD');
    const shareNotifs = byMod('Shares');
    const pigmyNotifs = byMod('Pigmy');
    const npaNotifs = byMod('NPA');
    const lockerNotifs = byMod('Locker');
    const systemNotifs = byMod('System');
    const otherNotifs = liveNotifications.filter(
      (n: any) => !KNOWN_MODULES.has(normalizeModule(n.moduleName))
    );

    const sections: TaskSection[] = [
      {
        id: 'voucher-pending',
        titleMr: '१. व्हाउचर मंजुरी प्रलंबित',
        titleEn: 'Voucher Approval Pending',
        category: 'Accounts',
        moduleKey: 'Vouchers',
        icon: FileText,
        count: voucherNotifs.length,
        totalAmount: voucherNotifs.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        priority: 'URGENT',
        accentColor: '#EA580C',
        targetTab: 'voucher-posting',
        roles: ['MANAGER', 'CASHIER'],
        items: voucherNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: n.entityID ? `Voucher #${n.entityID}` : undefined,
          memberName: n.title || 'प्रलंबित व्हाउचर',
          details: n.description || '',
          amount: Number(n.amount || 0),
          dueDate: formatDateSafe(n.dueDate, 'आज'),
          status: 'मेकर-चेकर पासिंग प्रलंबित',
          targetTab: n.targetTab || 'voucher-posting',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: n.priority || 'URGENT',
          moduleName: 'Vouchers',
          sectionTitleMr: 'व्हाउचर मंजुरी',
          roleName: n.roleName,
          canComplete: true
        }))
      },
      {
        id: 'loan-recovery',
        titleMr: '२. कर्ज वसुली व हप्ते थकीत',
        titleEn: 'Loan Overdue & Recovery',
        category: 'Loans',
        moduleKey: 'Loans',
        icon: CreditCard,
        count: loanNotifs.length,
        totalAmount: loanNotifs.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        priority: loanNotifs.some(n => n.priority === 'URGENT') ? 'URGENT' : 'HIGH',
        accentColor: '#E11D48',
        targetTab: 'loan-collection',
        roles: ['MANAGER', 'LOANS'],
        items: loanNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: n.entityID ? `कर्ज #${n.entityID}` : undefined,
          memberName: (n.title || 'कर्जदार').replace(/^.+?-\s*/, ''),
          details: n.description || '',
          amount: Number(n.amount || 0),
          dueDate: formatDateSafe(n.dueDate, 'आज'),
          status: n.priority === 'URGENT' ? 'तातडीने वसुली आवश्यक' : 'हप्ता थकीत',
          targetTab: n.targetTab || 'loan-collection',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: n.priority || 'HIGH',
          moduleName: 'Loans',
          sectionTitleMr: 'कर्ज वसुली',
          roleName: n.roleName,
          canComplete: true
        }))
      },
      {
        id: 'loan-application',
        titleMr: '३. कर्ज मागणी अर्ज मंजुरी / वाटप',
        titleEn: 'Loan Sanction / Disbursement',
        category: 'Loans',
        moduleKey: 'LoanApplications',
        icon: FileCheck,
        count: loanAppNotifs.length,
        totalAmount: loanAppNotifs.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        priority: 'HIGH',
        accentColor: '#4F46E5',
        targetTab: 'loan-process',
        roles: ['MANAGER', 'LOANS'],
        items: loanAppNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: n.entityID ? `अर्ज #${n.entityID}` : undefined,
          memberName: (n.title || 'अर्जदार').replace(/^.+?-\s*/, ''),
          details: n.description || '',
          amount: Number(n.amount || 0),
          dueDate: formatDateSafe(n.dueDate, 'आज'),
          status: 'मंजुरी / कर्ज वाटप प्रलंबित',
          targetTab: n.targetTab || 'loan-process',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: n.priority || 'HIGH',
          moduleName: 'LoanApplications',
          sectionTitleMr: 'कर्ज मागणी अर्ज',
          roleName: n.roleName,
          canComplete: true
        }))
      },
      {
        id: 'fd-maturity',
        titleMr: '४. मुदत ठेव (FD) मुदतपूर्ती',
        titleEn: 'FD Maturity Due',
        category: 'Deposits',
        moduleKey: 'FD',
        icon: Building2,
        count: fdNotifs.length,
        totalAmount: fdNotifs.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        priority: 'HIGH',
        accentColor: '#B44814',
        targetTab: 'fd-withdrawal',
        roles: ['MANAGER', 'DEPOSITS'],
        items: fdNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: n.entityID ? `FD #${n.entityID}` : undefined,
          memberName: (n.title || 'ठेवीदार').replace(/^.+?-\s*/, ''),
          details: n.description || '',
          amount: Number(n.amount || 0),
          dueDate: formatDateSafe(n.dueDate, 'आज'),
          status: 'परतावा / ऑटो-नूतनीकरण पात्र',
          targetTab: n.targetTab || 'fd-withdrawal',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: n.priority || 'HIGH',
          moduleName: 'FD',
          sectionTitleMr: 'मुदत ठेव (FD)',
          roleName: n.roleName,
          canComplete: true
        }))
      },
      {
        id: 'rd-due',
        titleMr: '५. आवर्ती ठेव (RD) थकीत हप्ते',
        titleEn: 'RD Installment Due',
        category: 'Deposits',
        moduleKey: 'RD',
        icon: Calendar,
        count: rdNotifs.length,
        totalAmount: rdNotifs.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        priority: 'MEDIUM',
        accentColor: '#0891B2',
        targetTab: 'rd-collection',
        roles: ['DEPOSITS', 'CASHIER'],
        items: rdNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: n.entityID ? `RD #${n.entityID}` : undefined,
          memberName: (n.title || 'आरडी खातेदार').replace(/^.+?-\s*/, ''),
          details: n.description || '',
          amount: Number(n.amount || 0),
          dueDate: formatDateSafe(n.dueDate, 'चालू महिना'),
          status: 'मासिक हप्ता प्रलंबित',
          targetTab: n.targetTab || 'rd-collection',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: n.priority || 'MEDIUM',
          moduleName: 'RD',
          sectionTitleMr: 'आवर्ती ठेव (RD)',
          roleName: n.roleName,
          canComplete: true
        }))
      },
      {
        id: 'share-allotment',
        titleMr: '६. शेअर्स व सभासदत्व वाटप',
        titleEn: 'Share & Membership Allotment',
        category: 'Shares',
        moduleKey: 'Shares',
        icon: Users,
        count: shareNotifs.length,
        totalAmount: shareNotifs.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        priority: 'HIGH',
        accentColor: '#D97706',
        targetTab: 'share-master',
        roles: ['MANAGER', 'SHARES'],
        items: shareNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: n.entityID ? `सभासद #${n.entityID}` : undefined,
          memberName: (n.title || 'सभासद').replace(/^.+?-\s*/, ''),
          details: n.description || '',
          amount: Number(n.amount || 0),
          dueDate: formatDateSafe(n.dueDate, 'आज'),
          status: 'मंजुरी / भाग दाखला बाकी',
          targetTab: n.targetTab || 'share-master',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: n.priority || 'HIGH',
          moduleName: 'Shares',
          sectionTitleMr: 'शेअर्स व सभासदत्व',
          roleName: n.roleName,
          canComplete: true
        }))
      },
      {
        id: 'pigmy-pending',
        titleMr: '७. पिग्मी / दैनिक ठेव बॅच पोस्टिंग',
        titleEn: 'Pigmy Voucher Posting',
        category: 'Pigmy',
        moduleKey: 'Pigmy',
        icon: Wallet,
        count: pigmyNotifs.length,
        totalAmount: pigmyNotifs.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        priority: 'HIGH',
        accentColor: '#059669',
        targetTab: 'pigmy-daybook',
        roles: ['CASHIER', 'MANAGER'],
        items: pigmyNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: n.entityID ? `एजंट #${n.entityID}` : undefined,
          memberName: (n.title || 'पिग्मी एजंट').replace(/^.+?-\s*/, ''),
          details: n.description || '',
          amount: Number(n.amount || 0),
          dueDate: formatDateSafe(n.dueDate, 'आज'),
          status: 'एजंट भरणा / व्हाउचर पोस्टिंग बाकी',
          targetTab: n.targetTab || 'pigmy-daybook',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: n.priority || 'HIGH',
          moduleName: 'Pigmy',
          sectionTitleMr: 'पिग्मी डे-बुक',
          roleName: n.roleName,
          canComplete: true
        }))
      },
      {
        id: 'npa-alert',
        titleMr: '८. एन.पी.ए. (NPA) तातडीची वसुली',
        titleEn: 'NPA Recovery & Notices',
        category: 'Audit',
        moduleKey: 'NPA',
        icon: AlertTriangle,
        count: npaNotifs.length,
        totalAmount: npaNotifs.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        priority: 'URGENT',
        accentColor: '#DC2626',
        targetTab: 'npa-dashboard',
        roles: ['MANAGER', 'LOANS'],
        items: npaNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: n.entityID ? `खाते #${n.entityID}` : undefined,
          memberName: (n.title || 'NPA खाते').replace(/^.+?-\s*/, ''),
          details: n.description || '',
          amount: Number(n.amount || 0),
          dueDate: 'अति तातडीचे',
          status: 'कलम १०१ / कायदेशीर नोटीस',
          targetTab: n.targetTab || 'npa-dashboard',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: 'URGENT',
          moduleName: 'NPA',
          sectionTitleMr: 'एन.पी.ए. (NPA)',
          roleName: n.roleName,
          canComplete: true
        }))
      },
      {
        id: 'locker-renewal',
        titleMr: '९. लॉकर भाडे नूतनीकरण थकीत',
        titleEn: 'Locker Rent Renewal Due',
        category: 'Locker',
        moduleKey: 'Locker',
        icon: Lock,
        count: lockerNotifs.length,
        totalAmount: lockerNotifs.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        priority: 'MEDIUM',
        accentColor: '#7C3AED',
        targetTab: 'locker-rent-renewal',
        roles: ['MANAGER', 'LOCKER', 'CASHIER'],
        items: lockerNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: n.entityID ? `लॉकर #${n.entityID}` : undefined,
          memberName: (n.title || 'लॉकर धारक').replace(/^.+?-\s*/, ''),
          details: n.description || '',
          amount: Number(n.amount || 0),
          dueDate: formatDateSafe(n.dueDate, 'चालू मुदत'),
          status: 'वार्षिक भाडे जमा करणे बाकी',
          targetTab: n.targetTab || 'locker-rent-renewal',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: n.priority || 'MEDIUM',
          moduleName: 'Locker',
          sectionTitleMr: 'लॉकर भाडे',
          roleName: n.roleName,
          canComplete: true
        }))
      },
      {
        id: 'day-end-alert',
        titleMr: '१०. दिवस अखेर (Day-End Status)',
        titleEn: 'Day End Close Status',
        category: 'System',
        moduleKey: 'System',
        icon: Moon,
        count: systemNotifs.length,
        totalAmount: 0,
        priority: 'URGENT',
        accentColor: '#6D28D9',
        targetTab: 'day-end',
        roles: ['MANAGER', 'CASHIER'],
        items: systemNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: 'शाखा दिवस अखेर',
          memberName: n.title || 'दिवस अखेर इशारा',
          details: n.description || '',
          dueDate: 'आज संध्याकाळी',
          status: 'डे-एंड प्रक्रिया बाकी',
          targetTab: n.targetTab || 'day-end',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: 'URGENT',
          moduleName: 'System',
          sectionTitleMr: 'दिवस अखेर (EOD)',
          roleName: n.roleName,
          canComplete: true
        }))
      },
      {
        id: 'borrowing-emi-due',
        titleMr: '११. बाह्य कर्ज देय व थकीत हप्ते',
        titleEn: 'Bank Borrowing EMIs Due',
        category: 'Borrowings',
        moduleKey: 'Borrowings',
        icon: Building2,
        count: borrowingDueEmis.length,
        totalAmount: borrowingDueEmis.reduce((acc, item) => acc + Number(item.totalDue || 0), 0),
        priority: borrowingDueEmis.some(x => x.isOverdue) ? 'URGENT' : 'HIGH',
        accentColor: '#B45309',
        targetTab: 'borrowing-repayment',
        roles: ['MANAGER', 'CASHIER', 'LOANS'],
        items: borrowingDueEmis.map((b: any) => ({
          id: `brw-emi-${b.scheduleID || b.borrowingID}`,
          accountNo: `${b.borrowingNo || `BRW #${b.borrowingID}`} (हप्ता #${b.installmentNo || 1})`,
          memberName: b.lenderName || 'बाह्य बँक / पतसंस्था',
          details: `मुद्दल: ₹${Number(b.principalDue || 0).toLocaleString('en-IN')} + व्याज: ₹${Number(b.interestDue || 0).toLocaleString('en-IN')}${b.externalLoanAccountNo ? ` • A/c: ${b.externalLoanAccountNo}` : ''}`,
          amount: Number(b.totalDue || 0),
          dueDate: formatDateSafe(b.dueDate, 'आज'),
          status: b.isOverdue
            ? `${b.overdueDays} दिवस थकीत!`
            : b.daysRemaining === 0
            ? 'आज देय आहे'
            : `${b.daysRemaining} दिवसांत देय`,
          targetTab: 'borrowing-repayment',
          entityId: String(b.borrowingID),
          priority: b.isOverdue ? 'URGENT' : 'HIGH',
          moduleName: 'Borrowings',
          sectionTitleMr: 'बाह्य कर्ज हप्ते',
          roleName: 'MANAGER',
          canComplete: false
        }))
      }
    ];

    // Catch-all section so NO active DB notification is ever hidden from the list!
    if (otherNotifs.length > 0) {
      sections.push({
        id: 'other-alerts',
        titleMr: '१२. इतर प्रलंबित कामे व सूचना',
        titleEn: 'Other Operational Alerts',
        category: 'Other',
        moduleKey: 'Other',
        icon: Layers,
        count: otherNotifs.length,
        totalAmount: otherNotifs.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        priority: otherNotifs.some(n => n.priority === 'URGENT') ? 'URGENT' : 'MEDIUM',
        accentColor: '#0284C7',
        targetTab: 'dashboard',
        roles: ['MANAGER', 'CASHIER', 'LOANS', 'DEPOSITS', 'SHARES', 'LOCKER'],
        items: otherNotifs.map(n => ({
          id: String(n.notificationID),
          accountNo: n.entityID ? `${n.moduleName || 'Task'} #${n.entityID}` : n.moduleName || undefined,
          memberName: n.title || 'प्रलंबित काम',
          details: n.description || '',
          amount: Number(n.amount || 0),
          dueDate: formatDateSafe(n.dueDate, 'आज'),
          status: 'प्रलंबित',
          targetTab: n.targetTab || 'dashboard',
          entityId: n.entityID ? String(n.entityID) : undefined,
          priority: n.priority || 'MEDIUM',
          moduleName: n.moduleName || 'Other',
          sectionTitleMr: n.moduleName || 'इतर कामे',
          roleName: n.roleName,
          canComplete: true
        }))
      });
    }

    return sections;
  }, [liveNotifications, borrowingDueEmis]);

  // Exact Live KPI Stats derived directly from loaded taskSections (100% Parity with Lists!)
  const liveStats = useMemo(() => {
    const allItems = taskSections.flatMap(s => s.items);
    const totalPending = allItems.length;
    const urgentTasks = allItems.filter(i => i.priority === 'URGENT').length;
    const highPriorityTasks = allItems.filter(i => i.priority === 'HIGH').length;
    const totalAmount = allItems.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const totalToday = totalPending + completedTodayCount;
    const completionRate = totalToday > 0 ? Math.round((completedTodayCount / totalToday) * 100) : 100;

    return {
      totalPending,
      urgentTasks,
      highPriorityTasks,
      totalAmount,
      completedToday: completedTodayCount,
      completionRate
    };
  }, [taskSections, completedTodayCount]);

  // Apply Role & Priority Filters
  const filteredSections = useMemo(() => {
    return taskSections.filter(section => {
      if (roleFilter !== 'ALL' && !section.roles.includes(roleFilter)) {
        return false;
      }
      if (selectedFilter === 'URGENT') {
        return section.priority === 'URGENT' || section.items.some(i => i.priority === 'URGENT');
      }
      if (selectedFilter === 'HIGH') {
        return (
          section.priority === 'HIGH' ||
          section.priority === 'URGENT' ||
          section.items.some(i => i.priority === 'HIGH' || i.priority === 'URGENT')
        );
      }
      return true;
    });
  }, [taskSections, roleFilter, selectedFilter]);

  // Flattened items for Unified Grid Table View
  const allFilteredGridItems = useMemo(() => {
    let items: TaskItem[] = [];
    filteredSections.forEach(sec => {
      if (gridModuleFilter === 'ALL' || sec.moduleKey === gridModuleFilter) {
        let secItems = sec.items;
        if (selectedFilter === 'URGENT') {
          secItems = secItems.filter(i => i.priority === 'URGENT');
        } else if (selectedFilter === 'HIGH') {
          secItems = secItems.filter(i => i.priority === 'URGENT' || i.priority === 'HIGH');
        }
        items = items.concat(secItems);
      }
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        item =>
          (item.memberName || '').toLowerCase().includes(q) ||
          (item.details || '').toLowerCase().includes(q) ||
          (item.accountNo || '').toLowerCase().includes(q) ||
          (item.sectionTitleMr || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [filteredSections, gridModuleFilter, selectedFilter, searchQuery]);

  // Active Category Modal Section
  const activeCategorySection = useMemo(() => {
    if (!activeCategoryId) return null;
    return taskSections.find(s => s.id === activeCategoryId) || null;
  }, [activeCategoryId, taskSections]);

  const activeCategoryFilteredItems = useMemo(() => {
    if (!activeCategorySection) return [];
    if (!categorySearch.trim()) return activeCategorySection.items;
    const q = categorySearch.toLowerCase().trim();
    return activeCategorySection.items.filter(
      item =>
        (item.memberName || '').toLowerCase().includes(q) ||
        (item.details || '').toLowerCase().includes(q) ||
        (item.accountNo || '').toLowerCase().includes(q)
    );
  }, [activeCategorySection, categorySearch]);

  // Open Grid View smoothly with optional preset filters
  const openGridWithFilter = (opts?: { moduleKey?: string; priority?: 'ALL' | 'URGENT' | 'HIGH' }) => {
    setRoleFilter('ALL');
    setGridModuleFilter(opts?.moduleKey ?? 'ALL');
    setSelectedFilter(opts?.priority ?? 'ALL');
    setViewMode('GRID');
    setTimeout(() => {
      gridSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  // Navigate to Target Action
  const handleActionClick = (targetTab: string, entityId?: string) => {
    if (onNavigate) {
      if (entityId) {
        onNavigate(targetTab, {
          entityId,
          id: entityId,
          ...(targetTab.startsWith('borrowing-') ? { borrowingId: entityId } : {})
        });
      } else {
        onNavigate(targetTab);
      }
    }
  };

  const fmtCurrency = (val?: number) => {
    if (!val || val === 0) return null;
    return `₹ ${Number(val).toLocaleString('en-IN')}`;
  };

  const renderPriorityPill = (priority?: string) => {
    if (priority === 'URGENT') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[9.5px] font-bold">
          अति तातडीचे
        </span>
      );
    }
    if (priority === 'HIGH') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[9.5px] font-bold">
          महत्त्वाचे
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-100 text-[#9A3412] border border-orange-200 text-[9.5px] font-bold">
        नियमित
      </span>
    );
  };

  return (
    <div
      className={
        showLoginModal
          ? 'font-sans'
          : 'min-h-full w-full p-2.5 sm:p-3.5 text-[11px] font-sans relative'
      }
      style={
        showLoginModal
          ? undefined
          : {
              background:
                'radial-gradient(circle at 12% 10%, #FDE8E1 0%, rgba(253,232,225,0) 45%), radial-gradient(circle at 88% 12%, #FDE6C4 0%, rgba(253,230,196,0) 44%), radial-gradient(circle at 78% 85%, #FCD9B6 0%, rgba(252,217,182,0) 44%), linear-gradient(135deg, #FDF2EE 0%, #FFFBF7 46%, #FEF3E2 82%, #FCE3BE 100%)'
            }
      }
    >
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white border border-emerald-400 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-100" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Dashboard Container (NO overflow-hidden or h-full scroll trap!) */}
      {!showLoginModal && (
        <div className="max-w-[1680px] mx-auto space-y-3 pb-6">
          {/* ========================================================
              PASTEL ROSE-IVORY-GOLD HERO HEADER BANNER (Operations Command Center)
             ======================================================== */}
          <div className="rounded-2xl shadow-[0_8px_24px_rgba(124,36,24,0.08)] border border-amber-300/75 overflow-hidden bg-white">
            <div
              className="relative text-[#5A1A14] px-4 py-2.5 pt-3 flex flex-wrap items-center justify-between gap-2.5 border-b border-amber-200/80"
              style={{
                background: 'linear-gradient(125deg, #FCEAE4 0%, #FFF9F2 48%, #FEF0D8 82%, #FCE0B8 100%)'
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)' }}
              />
              <div className="flex items-center gap-2.5 min-w-0 relative z-10">
                <div
                  className="w-9 h-9 rounded-xl text-white border border-amber-200/60 flex items-center justify-center shadow-[0_6px_14px_rgba(154,52,18,0.24)] shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                >
                  <FolderCheck className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xs sm:text-sm font-black tracking-wide text-[#4A1410] truncate">
                      आजची कामे डॅशबोर्ड{' '}
                      <span className="bg-gradient-to-r from-[#7C2418] via-[#B44814] to-[#D97706] bg-clip-text text-transparent">
                        (Core Banking Operations)
                      </span>
                    </h2>
                    <span className="bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 text-[9.5px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      डेटाबेस लाईव्ह
                    </span>
                    <span className="bg-amber-100/90 text-[#7C2418] border border-amber-300/80 text-[9.5px] font-bold px-2 py-0.5 rounded-full">
                      शाखा #{effectiveBranchId}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#7A5243] font-medium hidden sm:block mt-0.5">
                    कोणत्याही कार्ड किंवा एकूण संख्येवर क्लिक करून संपूर्ण प्रलंबित कामांची यादी थेट पहा व कारवाई करा
                  </p>
                </div>
              </div>

              {/* Top Controls */}
              <div className="flex items-center gap-2 flex-wrap relative z-10">
                {/* View Mode Switcher */}
                <div className="inline-flex rounded-lg bg-white/85 p-0.5 border border-amber-200/90 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('CARDS')}
                    className={`px-2.5 py-1 rounded-md flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer ${
                      viewMode === 'CARDS'
                        ? 'bg-gradient-to-r from-[#7C2418] via-[#B44814] to-[#D97706] text-white shadow-xs'
                        : 'text-[#6E493C] hover:bg-amber-50'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>कार्ड दृश्य</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('GRID')}
                    className={`px-2.5 py-1 rounded-md flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer ${
                      viewMode === 'GRID'
                        ? 'bg-gradient-to-r from-[#7C2418] via-[#B44814] to-[#D97706] text-white shadow-xs'
                        : 'text-[#6E493C] hover:bg-amber-50'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>संपूर्ण यादी ({liveStats.totalPending})</span>
                  </button>
                </div>

                {/* Live Force Refresh */}
                <button
                  type="button"
                  onClick={() => {
                    fetchLiveNotifications(undefined, true);
                    fetchAutoRenewalData();
                  }}
                  disabled={loading}
                  className="px-2.5 py-1.5 rounded-lg bg-white/90 hover:bg-amber-50 text-[#7C2418] text-[11px] font-bold border border-amber-300/80 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="डेटाबेसमधून कामांची ताजी स्थिती पुन्हा तपासा"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#B44814] ${loading ? 'animate-spin' : ''}`} />
                  <span>रीफ्रेश</span>
                </button>

                {/* Pop-up modal opener */}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg text-white text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs hover:brightness-105"
                  style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                >
                  <Bell className="w-3.5 h-3.5 text-amber-100" />
                  <span>सूचना विंडो</span>
                </button>
              </div>
            </div>

            {/* Error Alert Banner (if API failed) */}
            {loadError && (
              <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 flex items-center justify-between gap-2 text-rose-800 text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{loadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchLiveNotifications(undefined, true)}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold cursor-pointer shrink-0"
                >
                  पुन्हा प्रयत्न करा
                </button>
              </div>
            )}

            {/* ========================================================
                CLICKABLE EXECUTIVE KPI SUMMARY METRIC CARDS (5 Cards)
               ======================================================== */}
            <div className="bg-gradient-to-r from-[#FFF9F2] via-white to-[#FEF5E7] border-b border-amber-200/70 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* 1. Total Pending -> Click opens full list */}
              <button
                type="button"
                onClick={() => openGridWithFilter({ moduleKey: 'ALL', priority: 'ALL' })}
                className="text-left bg-white hover:bg-amber-50/75 p-2.5 rounded-xl border border-amber-200/90 shadow-xs hover:shadow transition-all flex items-center gap-3 cursor-pointer group"
                title="सर्व प्रलंबित कामांची संपूर्ण यादी पाहण्यासाठी क्लिक करा"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                >
                  <FolderCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-[#9A3412] font-bold flex items-center justify-between">
                    <span>एकूण प्रलंबित कामे</span>
                    <ArrowUpRight className="w-3 h-3 text-[#B44814] opacity-70 group-hover:opacity-100" />
                  </div>
                  <div className="text-base font-black text-[#4A1410] leading-tight">
                    {liveStats.totalPending}{' '}
                    <span className="text-[10px] font-semibold text-[#B44814]">यादी पहा ➔</span>
                  </div>
                </div>
              </button>

              {/* 2. Urgent / High Priority -> Click opens urgent/high list */}
              <button
                type="button"
                onClick={() => openGridWithFilter({ moduleKey: 'ALL', priority: 'HIGH' })}
                className="text-left bg-white hover:bg-rose-50/70 p-2.5 rounded-xl border border-rose-200/80 shadow-xs hover:shadow transition-all flex items-center gap-3 cursor-pointer group"
                title="अति तातडीची व महत्त्वाची कामे पाहण्यासाठी क्लिक करा"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FB7185] to-[#E11D48] flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-rose-700 font-bold flex items-center justify-between">
                    <span>अति तातडीची / महत्त्वाची</span>
                    <ArrowUpRight className="w-3 h-3 text-rose-500 opacity-70 group-hover:opacity-100" />
                  </div>
                  <div className="text-base font-black text-rose-700 leading-tight">
                    {liveStats.urgentTasks + liveStats.highPriorityTasks}{' '}
                    <span className="text-[10px] font-semibold text-rose-500">तातडीने</span>
                  </div>
                </div>
              </button>

              {/* 3. Total Amount */}
              <button
                type="button"
                onClick={() => openGridWithFilter({ moduleKey: 'ALL', priority: 'ALL' })}
                className="text-left bg-white hover:bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80 shadow-xs hover:shadow transition-all flex items-center gap-3 cursor-pointer group"
                title="रक्कमनिहाय सर्व प्रलंबित कामे पहा"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#34D399] to-[#059669] flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="text-[10px] text-emerald-800/85 font-bold">एकूण थकीत / देय रक्कम</div>
                  <div className="text-sm font-black text-emerald-700 leading-tight truncate">
                    ₹ {Number(liveStats.totalAmount).toLocaleString('en-IN')}
                  </div>
                </div>
              </button>

              {/* 4. Completed Today */}
              <div className="bg-white p-2.5 rounded-xl border border-teal-200/80 shadow-xs flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2DD4BF] to-[#0D9488] flex items-center justify-center text-white shadow-sm shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-teal-800/85 font-bold">आज पूर्ण झालेली कामे</div>
                  <div className="text-base font-black text-[#4A1410] leading-tight">
                    {liveStats.completedToday}{' '}
                    <span className="text-[10px] font-normal text-[#8C5E4F]">पूर्ण</span>
                  </div>
                </div>
              </div>

              {/* 5. Completion Progress */}
              <div className="bg-white p-2.5 rounded-xl border border-amber-200/90 shadow-xs col-span-2 sm:col-span-1 flex flex-col justify-center">
                <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                  <span className="text-[#7C2418]">दैनिक कामे पूर्णता प्रगती</span>
                  <span className="text-[#9A3412] font-black">{liveStats.completionRate}%</span>
                </div>
                <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, liveStats.completionRate))}%`,
                      background: 'linear-gradient(90deg, #B44814 0%, #D97706 55%, #10B981 100%)'
                    }}
                  />
                </div>
                <div className="text-[9px] text-[#8C5E4F] mt-1 flex justify-between font-medium">
                  <span>०%</span>
                  <span>लक्ष्य १००%</span>
                </div>
              </div>
            </div>

            {/* ========================================================
                ROLE-BASED TABS & QUICK PRIORITY FILTER BAR
               ======================================================== */}
            <div className="px-3.5 py-2 bg-[#FFFBF7] border-b border-amber-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Role Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                <span className="text-[10px] font-bold text-[#7C2418] mr-1 flex items-center gap-1 shrink-0">
                  <Filter className="w-3 h-3 text-[#B44814]" /> विभाग:
                </span>
                {[
                  { key: 'ALL', label: 'सर्व कामे' },
                  { key: 'MANAGER', label: 'व्यवस्थापक' },
                  { key: 'CASHIER', label: 'कॅशियर' },
                  { key: 'LOANS', label: 'कर्ज विभाग' },
                  { key: 'DEPOSITS', label: 'ठेव विभाग' },
                  { key: 'SHARES', label: 'शेअर्स विभाग' },
                  { key: 'LOCKER', label: 'लॉकर विभाग' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setRoleFilter(tab.key as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      roleFilter === tab.key
                        ? 'bg-[#7C2418] text-white shadow-xs'
                        : 'bg-white text-[#5C3A2E] hover:bg-amber-50 border border-amber-200/80'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Priority Quick Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#7C2418]">प्राधान्य:</span>
                <div className="inline-flex rounded-lg bg-white p-0.5 border border-amber-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('ALL')}
                    className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer text-[10.5px] font-bold ${
                      selectedFilter === 'ALL'
                        ? 'bg-[#B44814] text-white'
                        : 'text-[#6E493C] hover:text-[#4A1410]'
                    }`}
                  >
                    सर्व
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('URGENT')}
                    className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer text-[10.5px] font-bold ${
                      selectedFilter === 'URGENT'
                        ? 'bg-rose-600 text-white'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    अति तातडीचे
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('HIGH')}
                    className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer text-[10.5px] font-bold ${
                      selectedFilter === 'HIGH'
                        ? 'bg-amber-500 text-white'
                        : 'text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    महत्त्वाचे
                  </button>
                </div>
              </div>
            </div>

            {/* ========================================================
                CBS FD AUTO-RENEWAL ACTION CENTER
               ======================================================== */}
            <div className="px-3.5 py-2.5 bg-gradient-to-r from-[#FDF4EF] via-[#FFFBF7] to-[#FEF3E2] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                >
                  <RotateCcw className={`w-4 h-4 ${runningBatch || autoRenewalLoading ? 'animate-spin' : ''}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-black tracking-wide text-[#4A1410]">
                      मुदत ठेव स्वयंचलित नूतनीकरण केंद्र (CBS FD Auto-Renewal Center)
                    </h3>
                    <span className="bg-amber-100 text-[#7C2418] border border-amber-300/80 text-[9.5px] font-bold px-2 py-0.5 rounded-full">
                      RBI १४-दिवसीय सवलत लागू
                    </span>
                    <span
                      className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${
                        sansthaFdPolicy === 'RETAIN_ORIGINAL'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : sansthaFdPolicy === 'NEXT_LEGACY'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-orange-100 text-[#9A3412] border-orange-300'
                      }`}
                    >
                      पावती धोरण:{' '}
                      {sansthaFdPolicy === 'RETAIN_ORIGINAL'
                        ? 'मूळ पावती क्र. कायम'
                        : sansthaFdPolicy === 'NEXT_LEGACY'
                        ? 'पुढील जुना FD क्र.'
                        : sansthaFdPolicy === 'HYBRID_CHOICE'
                        ? 'हायब्रीड धोरण'
                        : 'नवीन CBS पावती क्र.'}
                    </span>
                    {policyLoadError && (
                      <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[9.5px] font-bold px-2 py-0.5 rounded-full">
                        ⚠️ {policyLoadError}
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-[#6E493C] flex items-center gap-2 mt-0.5 flex-wrap">
                    <span>
                      पात्र खाती:{' '}
                      <strong className="text-[#9A3412] font-black">
                        {autoRenewalCandidates.length} पावत्या
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      एकूण नूतनीकरण रक्कम:{' '}
                      <strong className="text-emerald-700 font-black">
                        ₹{' '}
                        {autoRenewalCandidates
                          .reduce(
                            (acc, c) => acc + Number(c.projectedRenewedAmount || c.depositAmount || 0),
                            0
                          )
                          .toLocaleString('en-IN')}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowAutoRenewalModal(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-[#7C2418] border border-amber-300/80 shadow-2xs text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#B44814]" />
                  <span>पात्र यादी पहा ({autoRenewalCandidates.length})</span>
                </button>

                <button
                  type="button"
                  disabled={runningBatch || autoRenewalCandidates.length === 0}
                  onClick={() => handleRunBatch()}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white text-[11px] font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{runningBatch ? 'बॅच प्रक्रिया सुरु...' : 'EOD बॅच रन करा'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchRenewalLogs();
                    setShowLogsModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#9A3412] border border-orange-200 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-[#B44814]" />
                  <span>इतिहास / रिव्हर्सल</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================
              LOADING STATE
             ======================================================== */}
          {loading && liveNotifications.length === 0 && (
            <div className="bg-white/90 rounded-xl border border-amber-200 p-10 text-center shadow-xs">
              <RefreshCw className="w-7 h-7 animate-spin text-[#B44814] mx-auto mb-2" />
              <p className="text-xs font-bold text-[#4A1410]">डेटाबेसमधून आजची कामे लोड होत आहेत...</p>
            </div>
          )}

          {/* ========================================================
              MODE 1: CATEGORY CARDS VIEW (कार्ड दृश्य — Click any card/count for full scrollable list!)
             ======================================================== */}
          {!loading && viewMode === 'CARDS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredSections.map(section => {
                const IconComponent = section.icon;
                return (
                  <div
                    key={section.id}
                    className="bg-white/95 rounded-xl border border-amber-200/80 shadow-[0_4px_16px_rgba(124,36,24,0.06)] hover:shadow-[0_10px_24px_rgba(124,36,24,0.11)] hover:border-amber-300 transition-all duration-200 flex flex-col justify-between overflow-hidden"
                    style={{ borderTop: `3px solid ${section.accentColor}` }}
                  >
                    {/* Card Header — Clicking Count Badge opens Full Scrollable List */}
                    <div className="px-3 py-2 bg-gradient-to-r from-[#FDF4EF] to-[#FEF6EA] border-b border-amber-100 flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0"
                          style={{ backgroundColor: section.accentColor }}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h3
                            className="font-extrabold text-[11.5px] leading-tight text-[#4A1410] truncate"
                            title={section.titleMr}
                          >
                            {section.titleMr}
                          </h3>
                          <span className="text-[9.5px] text-[#8C5E4F] block font-semibold truncate">
                            {section.titleEn}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCategorySearch('');
                          setActiveCategoryId(section.id);
                        }}
                        className={`text-[10.5px] font-black px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                          section.count > 0
                            ? 'bg-[#9A3412] hover:bg-[#7C2418] text-white border-[#7C2418] shadow-xs'
                            : 'bg-[#FFF8F1] text-[#8C5E4F] border-amber-200 hover:bg-amber-50'
                        }`}
                        title="या विभागातील सर्व कामांची संपूर्ण यादी पहा"
                      >
                        {section.count} नोंदी
                      </button>
                    </div>

                    {/* Card Body */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between bg-white">
                      <div>
                        {fmtCurrency(section.totalAmount) && (
                          <div className="mb-2 px-2 py-1 rounded-lg bg-amber-50/75 border border-amber-200/75 flex justify-between items-center text-[11px]">
                            <span className="text-[10px] text-[#6E493C] font-semibold">एकूण रक्कम:</span>
                            <span className="font-black text-[#4A1410]">
                              {fmtCurrency(section.totalAmount)}
                            </span>
                          </div>
                        )}

                        {/* Preview Items (Top 3) */}
                        <div className="space-y-1.5 mb-2">
                          {section.items.length === 0 ? (
                            <div className="p-3.5 text-center text-[10.5px] text-[#8C5E4F] font-semibold bg-[#FFFBF7] rounded-lg border border-dashed border-amber-200">
                              <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto mb-1 opacity-75" />
                              कोणतीही प्रलंबित नोंद नाही
                            </div>
                          ) : (
                            <>
                              {section.items.slice(0, 3).map(item => (
                                <div
                                  key={item.id}
                                  onClick={() => setSelectedItemDetails(item)}
                                  className="p-1.5 rounded-lg border border-amber-100 hover:border-amber-300 hover:bg-amber-50/50 transition-all cursor-pointer"
                                >
                                  <div className="flex justify-between items-center gap-1 font-bold text-[#4A1410] text-[11px]">
                                    <span className="truncate" title={item.memberName}>
                                      {item.memberName}
                                    </span>
                                    {item.amount ? (
                                      <span className="font-mono font-black text-[10px] text-[#9A3412] bg-orange-50 border border-orange-200/80 px-1.5 py-0.5 rounded shrink-0">
                                        ₹{Number(item.amount).toLocaleString('en-IN')}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="flex justify-between items-center text-[10px] text-[#7A5243] mt-1 pt-1 border-t border-amber-100/70 gap-1">
                                    <span
                                      className="font-mono text-[#6E493C] truncate"
                                      title={item.accountNo || item.details}
                                    >
                                      {item.accountNo || item.details}
                                    </span>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={e => {
                                          e.stopPropagation();
                                          setSelectedItemDetails(item);
                                        }}
                                        className="px-1.5 py-0.5 bg-white hover:bg-amber-50 text-[#9A3412] border border-amber-200 rounded text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer"
                                        title="पूर्ण तपशील पहा"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span>पहा</span>
                                      </button>
                                      {item.canComplete !== false && (
                                        <button
                                          type="button"
                                          disabled={completingTaskId === item.id}
                                          onClick={e => handleCompleteTask(item, e)}
                                          className="p-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded cursor-pointer disabled:opacity-50"
                                          title="पूर्ण झाले चिन्हांकित करा"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {section.items.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCategorySearch('');
                                    setActiveCategoryId(section.id);
                                  }}
                                  className="w-full text-center py-1 px-2 bg-amber-50 hover:bg-amber-100 text-[#7C2418] border border-amber-200 rounded-lg text-[10.5px] font-extrabold cursor-pointer transition-colors"
                                >
                                  + आणखी {section.items.length - 3} नोंदी — संपूर्ण यादी पहा (All {section.items.length})
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Bottom Dual Action Bar: View Full List + Go to Screen */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-amber-100/80">
                        <button
                          type="button"
                          onClick={() => {
                            setCategorySearch('');
                            setActiveCategoryId(section.id);
                          }}
                          className="py-1.5 px-2 bg-[#FFF8F1] hover:bg-amber-100/80 text-[#7C2418] border border-amber-200/90 text-[10.5px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                        >
                          <List className="w-3.5 h-3.5" />
                          <span>यादी पहा ({section.count})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleActionClick(section.targetTab)}
                          className="py-1.5 px-2 hover:brightness-110 text-white text-[10.5px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                          style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                        >
                          <span>कारवाई करा</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================
              MODE 2: UNIFIED SCROLLABLE GRID TABLE VIEW (तपशीलवार यादी)
             ======================================================== */}
          {viewMode === 'GRID' && (
            <div
              ref={gridSectionRef}
              className="bg-white rounded-xl border border-amber-200/90 shadow-[0_8px_24px_rgba(124,36,24,0.08)] overflow-hidden flex flex-col"
            >
              {/* Search & Module Filter Toolbar */}
              <div className="px-3.5 py-2.5 bg-gradient-to-r from-[#FDF2EE] via-[#FFFBF7] to-[#FEF3E2] border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2.5">
                <div className="relative flex-1 min-w-[260px] max-w-md">
                  <Search className="w-3.5 h-3.5 text-[#B44814] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="खातेदार नाव, खाते क्र., विभाग किंवा तपशील शोधा..."
                    className="w-full pl-8 pr-8 py-1 bg-white border border-amber-200 rounded-lg text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-[#B44814] focus:border-[#B44814] h-[28px]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8C5E4F] hover:text-[#4A1410] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={gridModuleFilter}
                    onChange={e => setGridModuleFilter(e.target.value)}
                    className="border border-amber-200 rounded-lg px-2.5 py-1 text-[11px] bg-white text-[#4A1410] font-bold h-[28px] focus:outline-none focus:ring-1 focus:ring-[#B44814] cursor-pointer"
                  >
                    <option value="ALL">सर्व विभाग ({liveStats.totalPending})</option>
                    {taskSections.map(sec => (
                      <option key={sec.id} value={sec.moduleKey}>
                        {sec.titleMr} ({sec.count})
                      </option>
                    ))}
                  </select>

                  <span className="px-2.5 py-1 rounded-lg bg-[#9A3412] text-white text-[10.5px] font-black">
                    एकूण नोंदी: {allFilteredGridItems.length}
                  </span>
                </div>
              </div>

              {/* Scrollable Compact Single-Line ERP Table */}
              <div className="w-full overflow-auto max-h-[65vh]">
                <table className="w-full border-collapse text-left text-[11px] whitespace-nowrap leading-tight">
                  <thead className="bg-[#5A1A14] text-amber-50 font-bold text-[10.5px] sticky top-0 z-10">
                    <tr>
                      <th className="py-1.5 px-2 text-center w-10 border-r border-white/10 whitespace-nowrap">#</th>
                      <th className="py-1.5 px-2 border-r border-white/10 whitespace-nowrap">विभाग / मॉड्यूल</th>
                      <th className="py-1.5 px-2 text-center border-r border-white/10 whitespace-nowrap">प्राधान्य</th>
                      <th className="py-1.5 px-2 border-r border-white/10 whitespace-nowrap">खातेदार / शीर्षक</th>
                      <th className="py-1.5 px-2 border-r border-white/10 whitespace-nowrap">संदर्भ / खाते क्र.</th>
                      <th className="py-1.5 px-2 border-r border-white/10 whitespace-nowrap">कामाचा तपशील</th>
                      <th className="py-1.5 px-2 text-right border-r border-white/10 whitespace-nowrap">रक्कम (₹)</th>
                      <th className="py-1.5 px-2 text-center border-r border-white/10 whitespace-nowrap">देय तारीख</th>
                      <th className="py-1.5 px-2 border-r border-white/10 whitespace-nowrap">स्थिती</th>
                      <th className="py-1.5 px-2 text-center sticky right-0 bg-[#5A1A14] z-20 whitespace-nowrap">कृती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/80">
                    {allFilteredGridItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-10 text-center text-[#8C5E4F]">
                          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-70" />
                          <p className="font-bold text-[#5A1A14] text-xs">
                            निवडलेल्या फिल्टरनुसार कोणतेही प्रलंबित काम आढळले नाही.
                          </p>
                          {(gridModuleFilter !== 'ALL' || selectedFilter !== 'ALL' || roleFilter !== 'ALL' || searchQuery) && (
                            <button
                              type="button"
                              onClick={() => {
                                setGridModuleFilter('ALL');
                                setSelectedFilter('ALL');
                                setRoleFilter('ALL');
                                setSearchQuery('');
                              }}
                              className="mt-2 px-3 py-1 bg-[#9A3412] hover:bg-[#7C2418] text-white rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              सर्व फिल्टर काढा (Show All)
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      allFilteredGridItems.map((item, idx) => {
                        const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-[#FFFBF7]';
                        return (
                          <tr
                            key={`${item.moduleName}-${item.id}-${idx}`}
                            className={`h-[30px] ${rowBg} hover:bg-amber-50/80 transition-colors group`}
                          >
                            <td className="py-1 px-2 text-center font-bold text-[#8C5E4F] border-r border-amber-100/80 align-middle">
                              {idx + 1}
                            </td>
                            <td className="py-1 px-2 font-bold text-[#7C2418] border-r border-amber-100/80 align-middle">
                              {item.sectionTitleMr || item.moduleName}
                            </td>
                            <td className="py-1 px-2 text-center border-r border-amber-100/80 align-middle">
                              {renderPriorityPill(item.priority)}
                            </td>
                            <td
                              className="py-1 px-2 font-bold text-[#4A1410] border-r border-amber-100/80 max-w-[200px] truncate align-middle"
                              title={item.memberName}
                            >
                              {item.memberName}
                            </td>
                            <td className="py-1 px-2 font-mono font-semibold text-[#9A3412] border-r border-amber-100/80 align-middle">
                              {item.accountNo || '-'}
                            </td>
                            <td
                              className="py-1 px-2 text-slate-600 border-r border-amber-100/80 max-w-[260px] truncate align-middle"
                              title={item.details}
                            >
                              {item.details || '-'}
                            </td>
                            <td className="py-1 px-2 text-right font-mono font-bold text-emerald-700 border-r border-amber-100/80 align-middle">
                              {item.amount ? `₹ ${Number(item.amount).toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td className="py-1 px-2 text-center font-mono text-slate-700 border-r border-amber-100/80 align-middle">
                              {item.dueDate || '-'}
                            </td>
                            <td className="py-1 px-2 text-slate-700 border-r border-amber-100/80 align-middle">
                              {item.status}
                            </td>
                            <td
                              className={`py-0.5 px-2 text-center sticky right-0 ${rowBg} group-hover:bg-amber-50/80 z-10 shadow-[-4px_0_8px_rgba(90,26,20,0.06)]`}
                            >
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedItemDetails(item)}
                                  className="px-1.5 py-0.5 bg-white hover:bg-amber-100 text-[#9A3412] border border-amber-200 rounded text-[10px] font-bold cursor-pointer inline-flex items-center gap-0.5"
                                  title="पूर्ण तपशील पहा"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>पहा</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleActionClick(item.targetTab || 'vouchers', item.entityId)}
                                  className="px-1.5 py-0.5 bg-[#B44814] hover:bg-[#7C2418] text-white rounded text-[10px] font-bold cursor-pointer inline-flex items-center gap-0.5"
                                  title="संबंधित स्क्रीन उघडा"
                                >
                                  <span>{item.canComplete === false ? 'हप्ता भरा' : 'उघडा'}</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                                {item.canComplete !== false && (
                                  <button
                                    type="button"
                                    disabled={completingTaskId === item.id}
                                    onClick={e => handleCompleteTask(item, e)}
                                    className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded cursor-pointer disabled:opacity-50"
                                    title="काम पूर्ण झाले म्हणून चिन्हांकित करा"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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
      )}

      {/* ========================================================
          MODAL 0: FULL CATEGORY TASK LIST MODAL (Scrollable List for Clicked Category)
         ======================================================== */}
      {activeCategorySection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-white rounded-xl max-w-[97vw] xl:max-w-[1460px] w-full max-h-[88vh] shadow-2xl border border-amber-300/80 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div
              className="relative px-4 py-2.5 pt-3 text-[#4A1410] flex justify-between items-center gap-2 shrink-0 border-b border-amber-200/90"
              style={{ background: 'linear-gradient(125deg, #FCEAE4 0%, #FFF9F2 48%, #FCE0B8 100%)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)' }}
              />
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white border border-white/40 shrink-0 shadow-xs"
                  style={{ backgroundColor: activeCategorySection.accentColor }}
                >
                  <activeCategorySection.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-xs sm:text-sm text-[#4A1410] truncate">
                    {activeCategorySection.titleMr} — संपूर्ण यादी ({activeCategorySection.count} नोंदी)
                  </h3>
                  <p className="text-[10px] text-[#7A5243] font-medium truncate">
                    {activeCategorySection.titleEn}
                    {fmtCurrency(activeCategorySection.totalAmount)
                      ? ` • एकूण रक्कम: ${fmtCurrency(activeCategorySection.totalAmount)}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target = activeCategorySection.targetTab;
                    setActiveCategoryId(null);
                    handleActionClick(target);
                  }}
                  className="px-2.5 py-1 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs hover:brightness-105"
                  style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                >
                  <span>विभाग स्क्रीन उघडा</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategoryId(null)}
                  className="p-1 rounded-lg hover:bg-amber-100/80 text-[#7C2418] hover:text-[#4A1410] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Filter Strip */}
            <div className="px-3.5 py-2 bg-gradient-to-r from-[#FDF2EE] to-[#FEF3E2] border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="w-3.5 h-3.5 text-[#B44814] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  placeholder="या यादीत खातेदार नाव, खाते क्र. किंवा तपशील शोधा..."
                  className="w-full pl-8 pr-8 py-1 bg-white border border-amber-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-[#B44814] h-[28px]"
                />
                {categorySearch && (
                  <button
                    type="button"
                    onClick={() => setCategorySearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8C5E4F] hover:text-[#4A1410] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-[11px] font-bold text-[#6E493C]">
                दाखवत आहे: <strong className="text-[#9A3412]">{activeCategoryFilteredItems.length}</strong> /{' '}
                {activeCategorySection.count} नोंदी
              </span>
            </div>

            {/* Scrollable Category Table (flex-1 min-h-0 guarantees vertical + horizontal scroll!) */}
            <div className="flex-1 min-h-0 overflow-auto bg-white">
              {activeCategoryFilteredItems.length === 0 ? (
                <div className="p-12 text-center text-[#8C5E4F]">
                  <CheckCircle className="w-9 h-9 text-emerald-500 mx-auto mb-2 opacity-75" />
                  <p className="font-bold text-[#4A1410] text-xs">या विभागात कोणतीही प्रलंबित नोंद नाही.</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-[11px] whitespace-nowrap leading-tight">
                  <thead className="bg-[#5A1A14] text-amber-50 font-bold text-[10.5px] sticky top-0 z-10">
                    <tr>
                      <th className="py-1.5 px-2 text-center w-10 border-r border-white/10 whitespace-nowrap">#</th>
                      <th className="py-1.5 px-2 text-center border-r border-white/10 whitespace-nowrap">प्राधान्य</th>
                      <th className="py-1.5 px-2 border-r border-white/10 whitespace-nowrap">खातेदार / शीर्षक</th>
                      <th className="py-1.5 px-2 border-r border-white/10 whitespace-nowrap">खाते / संदर्भ क्र.</th>
                      <th className="py-1.5 px-2 border-r border-white/10 whitespace-nowrap">तपशील</th>
                      <th className="py-1.5 px-2 text-right border-r border-white/10 whitespace-nowrap">रक्कम (₹)</th>
                      <th className="py-1.5 px-2 text-center border-r border-white/10 whitespace-nowrap">देय तारीख</th>
                      <th className="py-1.5 px-2 border-r border-white/10 whitespace-nowrap">स्थिती</th>
                      <th className="py-1.5 px-2 text-center sticky right-0 bg-[#5A1A14] z-20 whitespace-nowrap">कृती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/80">
                    {activeCategoryFilteredItems.map((item, idx) => {
                      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-[#FFFBF7]';
                      return (
                        <tr
                          key={item.id}
                          className={`h-[30px] ${rowBg} hover:bg-amber-50/80 transition-colors group`}
                        >
                          <td className="py-1 px-2 text-center font-bold text-[#8C5E4F] border-r border-amber-100/80 align-middle">
                            {idx + 1}
                          </td>
                          <td className="py-1 px-2 text-center border-r border-amber-100/80 align-middle">
                            {renderPriorityPill(item.priority)}
                          </td>
                          <td
                            className="py-1 px-2 font-bold text-[#4A1410] border-r border-amber-100/80 max-w-[200px] truncate align-middle"
                            title={item.memberName}
                          >
                            {item.memberName}
                          </td>
                          <td className="py-1 px-2 font-mono font-semibold text-[#9A3412] border-r border-amber-100/80 align-middle">
                            {item.accountNo || '-'}
                          </td>
                          <td
                            className="py-1 px-2 text-slate-600 border-r border-amber-100/80 max-w-[300px] truncate align-middle"
                            title={item.details}
                          >
                            {item.details || '-'}
                          </td>
                          <td className="py-1 px-2 text-right font-mono font-bold text-emerald-700 border-r border-amber-100/80 align-middle">
                            {item.amount ? `₹ ${Number(item.amount).toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="py-1 px-2 text-center font-mono text-slate-700 border-r border-amber-100/80 align-middle">
                            {item.dueDate || '-'}
                          </td>
                          <td className="py-1 px-2 text-slate-700 border-r border-amber-100/80 align-middle">
                            {item.status}
                          </td>
                          <td
                            className={`py-0.5 px-2 text-center sticky right-0 ${rowBg} group-hover:bg-amber-50/80 z-10 shadow-[-4px_0_8px_rgba(90,26,20,0.06)]`}
                          >
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedItemDetails(item)}
                                className="px-1.5 py-0.5 bg-white hover:bg-amber-100 text-[#9A3412] border border-amber-200 rounded text-[10px] font-bold cursor-pointer inline-flex items-center gap-0.5"
                              >
                                <Eye className="w-3 h-3" />
                                <span>पहा</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const target = item.targetTab || activeCategorySection.targetTab;
                                  setActiveCategoryId(null);
                                  handleActionClick(target, item.entityId);
                                }}
                                className="px-1.5 py-0.5 bg-[#B44814] hover:bg-[#7C2418] text-white rounded text-[10px] font-bold cursor-pointer inline-flex items-center gap-0.5"
                              >
                                <span>{item.canComplete === false ? 'हप्ता भरा' : 'उघडा'}</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                              {item.canComplete !== false && (
                                <button
                                  type="button"
                                  disabled={completingTaskId === item.id}
                                  onClick={e => handleCompleteTask(item, e)}
                                  className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded cursor-pointer disabled:opacity-50"
                                  title="पूर्ण झाले चिन्हांकित करा"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2 bg-[#FFF8F1] border-t border-amber-200/80 flex justify-between items-center shrink-0">
              <span className="text-[11px] font-bold text-[#6E493C]">
                एकूण नोंदी: <strong className="text-[#4A1410]">{activeCategoryFilteredItems.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setActiveCategoryId(null)}
                className="px-4 py-1 bg-white hover:bg-amber-50 text-[#5C3A2E] border border-amber-200 rounded-lg text-xs font-bold cursor-pointer"
              >
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 1: FULL MEMBER & TASK DETAILS POPUP
         ======================================================== */}
      {selectedItemDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-amber-300/80 overflow-hidden">
            <div
              className="relative px-4 py-3 pt-3.5 text-[#4A1410] flex justify-between items-center border-b border-amber-200/80"
              style={{ background: 'linear-gradient(125deg, #FCEAE4 0%, #FFF9F2 48%, #FCE0B8 100%)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)' }}
              />
              <div className="flex items-center gap-2.5">
                <div
                  className="p-1.5 text-white rounded-lg shadow-xs"
                  style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                >
                  <Info className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#4A1410]">सभासद व कामाचा पूर्ण तपशील</h3>
                  <p className="text-[10px] text-[#7A5243]">Complete Banking Task Details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemDetails(null)}
                className="p-1 rounded-full hover:bg-amber-100/80 text-[#7C2418] hover:text-[#4A1410] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 bg-[#FFFBF7] text-xs max-h-[65vh] overflow-y-auto">
              <div className="bg-white p-3.5 rounded-lg border border-amber-200/80 space-y-2">
                <div className="flex justify-between items-center pb-1.5 border-b border-amber-100">
                  <span className="text-[#8C5E4F] font-medium">विभाग / मॉड्यूल:</span>
                  <span className="font-bold text-[#4A1410]">
                    {selectedItemDetails.sectionTitleMr || selectedItemDetails.moduleName || 'General'}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-1.5 border-b border-amber-100 gap-2">
                  <span className="text-[#8C5E4F] font-medium shrink-0">खातेदार / शीर्षक:</span>
                  <span className="font-bold text-[#4A1410] text-right">
                    {selectedItemDetails.memberName}
                  </span>
                </div>

                {selectedItemDetails.accountNo && (
                  <div className="flex justify-between items-center pb-1.5 border-b border-amber-100">
                    <span className="text-[#8C5E4F] font-medium">खाते / संदर्भ क्र.:</span>
                    <span className="font-mono text-[#9A3412] font-bold bg-orange-50 border border-orange-200 px-2 py-0.5 rounded text-[11px]">
                      {selectedItemDetails.accountNo}
                    </span>
                  </div>
                )}

                {selectedItemDetails.amount ? (
                  <div className="flex justify-between items-center pb-1.5 border-b border-amber-100">
                    <span className="text-[#8C5E4F] font-medium">थकीत / एकूण रक्कम:</span>
                    <span className="font-black text-emerald-700">
                      ₹ {Number(selectedItemDetails.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ) : null}

                {selectedItemDetails.dueDate && (
                  <div className="flex justify-between items-center pb-1.5 border-b border-amber-100">
                    <span className="text-[#8C5E4F] font-medium">मुदत / देय तारीख:</span>
                    <span className="font-mono font-bold text-[#4A1410]">{selectedItemDetails.dueDate}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-[#8C5E4F] font-medium">काम स्थिती:</span>
                  <span className="font-bold text-[#7C2418] bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    {selectedItemDetails.status}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-amber-200/80">
                <span className="font-bold text-[#7C2418] block mb-1 text-[11px]">
                  वर्णन व आवश्यक कृती:
                </span>
                <p className="text-[#5C3A2E] leading-relaxed text-xs whitespace-pre-wrap">
                  {selectedItemDetails.details || 'अतिरिक्त तपशील उपलब्ध नाही.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-white border-t border-amber-200/80 flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedItemDetails(null)}
                className="px-3 py-1.5 bg-[#FFF8F1] hover:bg-amber-50 text-[#5C3A2E] font-bold rounded-lg text-xs border border-amber-200 cursor-pointer"
              >
                बंद करा
              </button>
              <div className="flex items-center gap-2">
                {selectedItemDetails.canComplete !== false && (
                  <button
                    type="button"
                    disabled={completingTaskId === selectedItemDetails.id}
                    onClick={() => handleCompleteTask(selectedItemDetails)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>पूर्ण झाले</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const targetTab = selectedItemDetails.targetTab || 'voucher-posting';
                    const entityId = selectedItemDetails.entityId;
                    setSelectedItemDetails(null);
                    setActiveCategoryId(null);
                    handleActionClick(targetTab, entityId);
                  }}
                  className="px-3.5 py-1.5 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs hover:brightness-105 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                >
                  <span>थेट स्क्रीन उघडा</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: LOGIN NOTIFICATIONS POPUP DIALOG
         ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl border border-amber-300/80 overflow-hidden flex flex-col max-h-[88vh]">
            <div
              className="relative px-4 py-3 pt-3.5 text-[#4A1410] flex justify-between items-center shrink-0 border-b border-amber-200/80"
              style={{ background: 'linear-gradient(125deg, #FCEAE4 0%, #FFF9F2 48%, #FCE0B8 100%)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)' }}
              />
              <div className="flex items-center gap-2.5">
                <div
                  className="p-2 text-white rounded-xl shadow-xs"
                  style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
                >
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-tight text-[#4A1410]">
                    आजची कामे व महत्त्वाच्या सूचना (Today&apos;s Live Alerts)
                  </h2>
                  <p className="text-[11px] text-[#7A5243]">
                    डेटाबेसमधील लाईव्ह प्रलंबित कामे व दैनंदिन कार्यभार
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  if (onCloseLoginModal) onCloseLoginModal();
                }}
                className="p-1 rounded-full hover:bg-amber-100/80 text-[#7C2418] hover:text-[#4A1410] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto min-h-0 space-y-3 flex-1 bg-[#FFFBF7]">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">महत्त्वाची टीप:</span> कोणत्याही विभागावर क्लिक करून त्यातील सर्व प्रलंबित कामांची यादी थेट पाहू शकता.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {taskSections.map(sec => {
                  const SecIcon = sec.icon;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        if (onCloseLoginModal) onCloseLoginModal();
                        if (showLoginModal && onNavigate) {
                          handleActionClick('todays-tasks');
                        } else {
                          setCategorySearch('');
                          setActiveCategoryId(sec.id);
                        }
                      }}
                      className="text-left p-2.5 rounded-xl bg-white border border-amber-200/80 hover:border-amber-400 hover:bg-amber-50/50 transition-all cursor-pointer flex justify-between items-center group shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="p-2 rounded-lg text-white shrink-0"
                          style={{ backgroundColor: sec.accentColor }}
                        >
                          <SecIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-[#4A1410] truncate">
                            {sec.titleMr}
                          </div>
                          <div className="text-[10.5px] font-semibold text-[#9A3412]">
                            {sec.count} प्रलंबित नोंदी
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-[#B44814] group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-3 bg-white border-t border-amber-200/80 flex justify-between items-center shrink-0">
              <span className="text-xs text-[#6E493C] font-bold">
                एकूण <strong className="text-[#9A3412]">{liveStats.totalPending}</strong> प्रलंबित कामे उपलब्ध आहेत
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  if (onCloseLoginModal) onCloseLoginModal();
                  if (showLoginModal && onNavigate) {
                    onNavigate('todays-tasks');
                  }
                }}
                className="px-4 py-1.5 hover:brightness-105 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)' }}
              >
                आजची कामे पहा
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: CANDIDATE LIST MODAL (पात्र मुदत ठेव यादी)
         ======================================================== */}
      {showAutoRenewalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-[97vw] xl:max-w-[1460px] w-full max-h-[85vh] shadow-2xl border border-amber-300/80 flex flex-col overflow-hidden">
            <div
              className="relative px-4 py-2.5 pt-3 text-[#4A1410] flex justify-between items-center shrink-0 border-b border-amber-200/80"
              style={{ background: 'linear-gradient(125deg, #FCEAE4 0%, #FFF9F2 48%, #FCE0B8 100%)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)' }}
              />
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#B44814]" />
                <div>
                  <h3 className="font-bold text-xs text-[#4A1410]">स्वयंचलित नूतनीकरणास पात्र मुदत ठेव पावत्या</h3>
                  <p className="text-[10px] text-[#7A5243]">आज किंवा त्यापूर्वी मुदत संपलेली व ऑटो-रिन्यूअल सक्रिय असणारी खाती</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoRenewalModal(false)}
                className="p-1 rounded-full hover:bg-amber-100/80 text-[#7C2418] hover:text-[#4A1410] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 overflow-auto min-h-0 flex-1 bg-[#FFFBF7] text-[11px]">
              {autoRenewalCandidates.length === 0 ? (
                <div className="text-center py-8 text-[#8C5E4F]">
                  <CheckCheck className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                  <p className="font-bold text-xs text-[#4A1410]">सध्या स्वयंचलित नूतनीकरणास पात्र कोणतीही ठेव प्रलंबित नाही.</p>
                </div>
              ) : (
                <div className="overflow-auto border border-amber-200/80 rounded-lg bg-white shadow-xs">
                  <table className="w-full border-collapse text-left whitespace-nowrap leading-tight">
                    <thead>
                      <tr className="bg-[#5A1A14] text-amber-50 font-bold text-[10.5px]">
                        <th className="py-1.5 px-2 whitespace-nowrap">पावती / खाते क्र.</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">खातेदार नाव</th>
                        <th className="py-1.5 px-2 text-center whitespace-nowrap">मुदतपूर्ती तारीख</th>
                        <th className="py-1.5 px-2 text-right whitespace-nowrap">ठेव मुद्दल</th>
                        <th className="py-1.5 px-2 text-right whitespace-nowrap">अपेक्षित रक्कम</th>
                        <th className="py-1.5 px-2 text-center whitespace-nowrap">प्रचलित दर</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">पर्याय</th>
                        <th className="py-1.5 px-2 text-center whitespace-nowrap">कृती</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100/80">
                      {autoRenewalCandidates.map(c => (
                        <tr key={c.fdAccountID} className="hover:bg-amber-50/60 transition-colors">
                          <td className="py-1 px-2 font-mono font-bold text-[#9A3412] align-middle">
                            <div>{c.receiptNo || c.accountNo}</div>
                            {c.receiptNo && c.receiptNo !== c.accountNo && (
                              <div className="text-[9.5px] text-slate-500 font-normal">CBS: {c.accountNo}</div>
                            )}
                          </td>
                          <td className="py-1 px-2 align-middle">
                            <div className="font-bold text-[#4A1410]">{c.customerName}</div>
                            {c.contactNo && <div className="text-[9.5px] text-slate-500">📱 {c.contactNo}</div>}
                            {c.hasActiveLoan && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[9px] font-bold">
                                ⚠️ सक्रिय कर्ज: ₹ {Number(c.activeLoanBalance).toLocaleString('en-IN')}
                              </span>
                            )}
                          </td>
                          <td className="py-1 px-2 text-center font-mono text-slate-700 align-middle">
                            {formatDateSafe(c.MaturityDate || c.maturityDate, '-')}
                          </td>
                          <td className="py-1 px-2 text-right font-mono font-medium text-slate-700 align-middle">
                            ₹ {Number(c.depositAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-1 px-2 text-right font-mono font-bold text-emerald-700 align-middle">
                            ₹ {Number(c.projectedRenewedAmount || c.maturityAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-1 px-2 text-center font-bold text-[#7C2418] bg-amber-50/50 align-middle">
                            {c.prevailingRate}%
                          </td>
                          <td className="py-1 px-2 text-[10px] align-middle">
                            {c.autoRenewalOption === 'PrincipalOnly' ? (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                                केवळ मुद्दल (व्याज SB मध्ये)
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                                मुद्दल + जमा व्याज
                              </span>
                            )}
                            <div className="text-[9.5px] text-slate-500 mt-0.5">
                              नूतनीकरण: {c.autoRenewalCount}/{c.maxAutoRenewalCycles} वेळा
                            </div>
                          </td>
                          <td className="py-1 px-2 text-center align-middle">
                            <button
                              type="button"
                              disabled={runningBatch}
                              onClick={() => handleRunBatch([c.fdAccountID])}
                              className="px-2.5 py-1 bg-[#B44814] hover:bg-[#7C2418] text-white text-[10px] font-bold rounded shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              नूतनीकरण करा
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-3 bg-white border-t border-amber-200/80 flex justify-between items-center shrink-0">
              <span className="text-[11px] text-[#6E493C] font-semibold">
                एकूण पात्र खाती: <strong className="text-[#4A1410]">{autoRenewalCandidates.length}</strong> | एकूण रक्कम:{' '}
                <strong className="text-emerald-700">
                  ₹{' '}
                  {autoRenewalCandidates
                    .reduce((acc, c) => acc + Number(c.projectedRenewedAmount || c.depositAmount || 0), 0)
                    .toLocaleString('en-IN')}
                </strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAutoRenewalModal(false)}
                  className="px-3 py-1 bg-[#FFF8F1] hover:bg-amber-50 text-[#5C3A2E] border border-amber-200 text-xs font-bold rounded-lg cursor-pointer"
                >
                  बंद करा
                </button>
                {autoRenewalCandidates.length > 0 && (
                  <button
                    type="button"
                    disabled={runningBatch}
                    onClick={() => {
                      setShowAutoRenewalModal(false);
                      handleRunBatch();
                    }}
                    className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>सर्व {autoRenewalCandidates.length} पावत्यांची बॅच रन करा</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: BATCH RESULT SUMMARY MODAL
         ======================================================== */}
      {batchResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-amber-300/80 overflow-hidden">
            <div
              className="relative px-4 py-3 pt-3.5 text-[#4A1410] flex justify-between items-center border-b border-amber-200/80"
              style={{ background: 'linear-gradient(125deg, #FCEAE4 0%, #FFF9F2 48%, #FCE0B8 100%)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)' }}
              />
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-xs text-[#4A1410]">स्वयंचलित नूतनीकरण बॅच निकाल (Execution Summary)</h3>
              </div>
              <button
                type="button"
                onClick={() => setBatchResult(null)}
                className="p-1 rounded-full hover:bg-amber-100/80 text-[#7C2418] hover:text-[#4A1410] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs bg-[#FFFBF7]">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-[10px] text-emerald-700 font-bold">यशस्वी</div>
                  <div className="text-base font-black text-emerald-800">{batchResult.successCount}</div>
                </div>
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="text-[10px] text-rose-700 font-bold">त्रुटी / अपयशी</div>
                  <div className="text-base font-black text-rose-800">{batchResult.failedCount}</div>
                </div>
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-[10px] text-[#9A3412] font-bold">एकूण रक्कम</div>
                  <div className="text-xs font-black text-[#4A1410]">
                    ₹ {Number(batchResult.totalRenewedAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {batchResult.items && batchResult.items.length > 0 && (
                <div className="max-h-56 overflow-y-auto border border-amber-200/80 rounded-lg bg-white p-2 divide-y divide-amber-100 text-[11px]">
                  {batchResult.items.map((it: any, idx: number) => (
                    <div key={idx} className="py-1.5 flex justify-between items-center gap-2">
                      <div>
                        <div className="font-bold text-[#4A1410]">
                          पावती: {it.oldReceiptNo || it.oldAccountNo} ➜{' '}
                          <span className="text-[#9A3412] font-mono">{it.newReceiptNo || it.newAccountNo || '-'}</span>
                          {it.renewalCycleNo > 0 && (
                            <span className="ml-1 text-[9px] bg-amber-100 text-amber-900 px-1 rounded">
                              सायकल #{it.renewalCycleNo}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">{it.customerName}</div>
                        {it.voucherNo && (
                          <div className="text-[9.5px] text-amber-800 font-semibold mt-0.5">
                            🧾 व्हाउचर: <span className="font-mono">{it.voucherNo}</span> ({it.voucherStatus || 'Pending'})
                          </div>
                        )}
                        {it.errorMessage && (
                          <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                            ⚠️ {it.errorMessage}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            it.status === 'Success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {it.status === 'Success' ? 'यशस्वी' : 'त्रुटी'}
                        </span>
                        {it.renewedAmount > 0 && (
                          <div className="text-[10px] font-bold text-slate-700 mt-0.5">
                            ₹ {Number(it.renewedAmount).toLocaleString('en-IN')}
                          </div>
                        )}
                        {it.status === 'Success' && it.newFdAccountID > 0 && (
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <button
                              type="button"
                              disabled={loadingPrintId === it.newFdAccountID}
                              onClick={() => handleOpenBatchPrintModal(it, 'front')}
                              className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded text-[9.5px] font-bold cursor-pointer inline-flex items-center gap-0.5 disabled:opacity-50"
                            >
                              <Printer className="w-2.5 h-2.5" />
                              <span>पावती</span>
                            </button>
                            <button
                              type="button"
                              disabled={loadingPrintId === it.newFdAccountID}
                              onClick={() => handleOpenBatchPrintModal(it, 'endorsement')}
                              className="px-1.5 py-0.5 bg-orange-100 hover:bg-orange-200 text-[#7C2418] border border-orange-300 rounded text-[9.5px] font-bold cursor-pointer inline-flex items-center gap-0.5 disabled:opacity-50"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>शेरा</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-white border-t border-amber-200/80 flex items-center justify-between gap-2">
              {onNavigate && batchResult.successCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setBatchResult(null);
                    onNavigate('voucher-posting');
                  }}
                  className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-bold text-xs rounded-lg cursor-pointer"
                >
                  📋 Pass Voucher (व्हाउचर पासिंग) ला जा
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setBatchResult(null)}
                className="px-4 py-1.5 bg-[#9A3412] hover:bg-[#7C2418] text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                समजले (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: LOGS & 14-DAY REVERSAL MODAL
         ======================================================== */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-[97vw] xl:max-w-[1460px] w-full max-h-[85vh] shadow-2xl border border-amber-300/80 flex flex-col overflow-hidden">
            <div
              className="relative px-4 py-2.5 pt-3 text-[#4A1410] flex justify-between items-center shrink-0 border-b border-amber-200/80"
              style={{ background: 'linear-gradient(125deg, #FCEAE4 0%, #FFF9F2 48%, #FCE0B8 100%)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, #7C2418 0%, #B44814 50%, #D97706 100%)' }}
              />
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#B44814]" />
                <div>
                  <h3 className="font-bold text-xs text-[#4A1410]">
                    स्वयंचलित नूतनीकरण ऑडिट इतिहास व १४-दिवसीय रिव्हर्सल
                  </h3>
                  <p className="text-[10px] text-[#7A5243]">
                    RBI मार्गदर्शक तत्त्वांनुसार १४ दिवसांत विनामूल्य रिव्हर्ट करण्याची सुविधा
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="p-1 rounded-full hover:bg-amber-100/80 text-[#7C2418] hover:text-[#4A1410] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 overflow-auto min-h-0 flex-1 bg-[#FFFBF7] text-[11px]">
              {logsLoading ? (
                <div className="text-center py-8 text-[#8C5E4F]">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-1 text-[#B44814]" />
                  <span>ऑडिट लॉग्स लोड होत आहेत...</span>
                </div>
              ) : renewalLogs.length === 0 ? (
                <div className="text-center py-8 text-[#8C5E4F] font-semibold">
                  कोणतीही नूतनीकरण लॉग नोंद उपलब्ध नाही.
                </div>
              ) : (
                <div className="overflow-auto border border-amber-200/80 rounded-lg bg-white shadow-xs">
                  <table className="w-full border-collapse text-left whitespace-nowrap leading-tight">
                    <thead>
                      <tr className="bg-[#5A1A14] text-amber-50 font-bold text-[10.5px]">
                        <th className="py-1.5 px-2 whitespace-nowrap">दिनांक</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">मूळ खाते ➜ नवीन खाते</th>
                        <th className="py-1.5 px-2 whitespace-nowrap">खातेदार</th>
                        <th className="py-1.5 px-2 text-right whitespace-nowrap">नूतनीकृत रक्कम</th>
                        <th className="py-1.5 px-2 text-center whitespace-nowrap">व्याजदर</th>
                        <th className="py-1.5 px-2 text-center whitespace-nowrap">स्थिती</th>
                        <th className="py-1.5 px-2 text-center whitespace-nowrap">१४-दिवसीय रिव्हर्सल</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100/80">
                      {renewalLogs.map((l: any) => {
                        const batchDate = new Date(l.batchDate || l.executionTime);
                        const daysAgo = Math.floor(
                          (new Date().getTime() - batchDate.getTime()) / (1000 * 3600 * 24)
                        );
                        const isEligibleForGraceReversal =
                          !l.isReverted && daysAgo <= 14 && l.status === 'Success';

                        return (
                          <tr key={l.logID} className="hover:bg-amber-50/60 transition-colors">
                            <td className="py-1 px-2 text-slate-600 font-mono text-[10.5px] align-middle">
                              {formatDateSafe(l.batchDate || l.executionTime, '-')}
                            </td>
                            <td className="py-1 px-2 font-mono text-[10.5px] align-middle">
                              <span className="text-slate-600">{l.oldAccountNo}</span> ➜{' '}
                              <strong className="text-[#9A3412]">{l.newAccountNo}</strong>
                            </td>
                            <td className="py-1 px-2 font-bold text-[#4A1410] align-middle">{l.customerName}</td>
                            <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 align-middle">
                              ₹ {Number(l.renewedAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-1 px-2 text-center font-bold text-slate-700 align-middle">
                              {l.appliedRate}%
                            </td>
                            <td className="py-1 px-2 text-center align-middle">
                              {l.isReverted ? (
                                <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[9.5px] font-bold">
                                  रिव्हर्ट केले
                                </span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[9.5px] font-bold">
                                  सक्रिय (Active)
                                </span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-center align-middle">
                              {l.isReverted ? (
                                <span
                                  className="text-[10px] text-slate-500 italic"
                                  title={l.revertReason}
                                >
                                  {l.revertReason
                                    ? `कारण: ${l.revertReason.substring(0, 22)}...`
                                    : 'पूर्ववत केले'}
                                </span>
                              ) : isEligibleForGraceReversal ? (
                                <button
                                  type="button"
                                  onClick={() => setShowRevertDialog(l)}
                                  className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>रिव्हर्ट ({14 - daysAgo} दिवस बाकी)</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  सवलत मुदत संपली ({daysAgo} दिवस)
                                </span>
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

            <div className="p-3 bg-white border-t border-amber-200/80 text-right shrink-0">
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-1 bg-[#FFF8F1] hover:bg-amber-50 text-[#5C3A2E] border border-amber-200 text-xs font-bold rounded-lg cursor-pointer"
              >
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 6: REVERT CONFIRMATION DIALOG
         ======================================================== */}
      {showRevertDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-rose-200 overflow-hidden">
            <div className="p-3 bg-gradient-to-r from-rose-600 to-rose-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                <h3 className="font-bold text-xs">
                  १४-दिवसीय सवलतीत नूतनीकरण रद्द (Reversal)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRevertDialog(null)}
                className="p-1 rounded-full hover:bg-white/15 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs bg-slate-50/70">
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-rose-900 leading-snug">
                ⚠️ <strong>बँकिंग प्रक्रिया माहिती:</strong> नवीन पावती क्र.{' '}
                <strong>{showRevertDialog.newAccountNo}</strong> रद्द होईल, अकाउंटिंग व्हाउचर उलट
                (Reverse) होईल, आणि मूळ पावती क्र.{' '}
                <strong>{showRevertDialog.oldAccountNo}</strong> मुदतपूर्ण (Matured) म्हणून पूर्ववत
                केली जाईल.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  नूतनीकरण रद्द करण्याचे वैधानिक कारण (Revert Reason) *
                </label>
                <textarea
                  value={revertReason}
                  onChange={e => setRevertReason(e.target.value)}
                  placeholder="उदा. ठेवीदाराने १४ दिवसांत रक्कम काढण्याची किंवा इतर मुदतीत ठेवण्याची विनंती केली..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans"
                />
              </div>
            </div>

            <div className="p-3 bg-white border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRevertDialog(null);
                  setRevertReason('');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                disabled={revertingId !== null || !revertReason.trim()}
                onClick={() => handleRevert(showRevertDialog)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                <span>{revertingId ? 'रिव्हर्ट होत आहे...' : 'नूतनीकरण रिव्हर्ट करा'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {batchPrintAccount && (
        <FdReceiptPrintModal
          account={batchPrintAccount}
          initialSide={batchPrintSide}
          onClose={() => setBatchPrintAccount(null)}
        />
      )}
    </div>
  );
}
