import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  CreditCard,
  Building2,
  Calendar,
  UserCheck,
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
  ExternalLink,
  Clock,
  Sparkles,
  TrendingUp,
  FolderCheck,
  Filter,
  ChevronRight
} from 'lucide-react';

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
  createdOn?: string;
  roleName?: string;
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
  badgeColor: string;
  accentBg: string;
  targetTab: string;
  roles: string[];
  items: TaskItem[];
}

export default function TodaysTasksDashboard({
  onNavigate,
  showLoginModal = false,
  onCloseLoginModal,
  branchId: propBranchId
}: TodaysTasksDashboardProps) {
  // 1. Resolve Effective Branch ID dynamically
  const effectiveBranchId = useMemo<number>(() => {
    if (propBranchId && propBranchId > 0) return propBranchId;
    try {
      const storedGlobal = sessionStorage.getItem('globalBranchId');
      if (storedGlobal && parseInt(storedGlobal, 10) > 0) {
        return parseInt(storedGlobal, 10);
      }
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.branchID || u.BranchID) return Number(u.branchID || u.BranchID);
      }
    } catch (_) {}
    return 1;
  }, [propBranchId]);

  // View & Filter States
  const [viewMode, setViewMode] = useState<'CARDS' | 'GRID'>('CARDS');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'URGENT' | 'HIGH'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'MANAGER' | 'CASHIER' | 'LOANS' | 'DEPOSITS' | 'SHARES' | 'LOCKER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [gridModuleFilter, setGridModuleFilter] = useState<string>('ALL');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(showLoginModal);
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemDetails, setSelectedItemDetails] = useState<TaskItem | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Executive KPI Stats State
  const [stats, setStats] = useState({
    totalPending: 0,
    urgentTasks: 0,
    highPriorityTasks: 0,
    totalAmount: 0,
    completedToday: 0,
    completionRate: 0
  });

  // CBS Auto-Renewal State
  const [autoRenewalCandidates, setAutoRenewalCandidates] = useState<any[]>([]);
  const [autoRenewalLoading, setAutoRenewalLoading] = useState(false);
  const [showAutoRenewalModal, setShowAutoRenewalModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [renewalLogs, setRenewalLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<any | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [showRevertDialog, setShowRevertDialog] = useState<any | null>(null);

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
        setAutoRenewalCandidates(res.data || []);
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
      setRenewalLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load auto-renewal logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Fetch KPI Stats
  const fetchStats = async (isMountedRef?: { current: boolean }) => {
    try {
      const res = await axios.get('/api/Notification/stats', {
        params: { branchId: effectiveBranchId }
      });
      if (!isMountedRef || isMountedRef.current) {
        if (res.data) {
          setStats({
            totalPending: res.data.totalPending || 0,
            urgentTasks: res.data.urgentTasks || 0,
            highPriorityTasks: res.data.highPriorityTasks || 0,
            totalAmount: res.data.totalAmount || 0,
            completedToday: res.data.completedToday || 0,
            completionRate: res.data.completionRate || 0
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch notification stats:', err);
    }
  };

  // Fetch Live System Notifications
  const fetchLiveNotifications = async (isMountedRef?: { current: boolean }) => {
    try {
      if (isMountedRef && !isMountedRef.current) return;
      setLoading(true);

      // Trigger automatic live sync from real operational tables first
      await axios.post(`/api/Notification/generate?branchId=${effectiveBranchId}`).catch(() => {});

      if (isMountedRef && !isMountedRef.current) return;

      // Fetch active notifications
      const res = await axios.get('/api/Notification', {
        params: { branchId: effectiveBranchId, status: 'Active' }
      });

      if (!isMountedRef || isMountedRef.current) {
        setLiveNotifications(res.data || []);
      }

      await fetchStats(isMountedRef);
    } catch (err) {
      console.error('Error loading live notifications:', err);
    } finally {
      if (!isMountedRef || isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const isMountedRef = { current: true };
    fetchLiveNotifications(isMountedRef);
    fetchAutoRenewalData(isMountedRef);

    return () => {
      isMountedRef.current = false;
    };
  }, [effectiveBranchId]);

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
        executedBy: 'Manager-EOD'
      });
      setBatchResult(res.data);
      await fetchAutoRenewalData();
      await fetchLiveNotifications();
    } catch (err: any) {
      alert(
        'बॅच रन करताना त्रुटी आली: ' +
          (err.response?.data?.message || err.response?.data || err.message)
      );
    } finally {
      setRunningBatch(false);
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
        revertedBy: 'Manager'
      });
      alert(res.data?.message || 'नूतनीकरण यशस्वीरीत्या रद्द केले.');
      setShowRevertDialog(null);
      setRevertReason('');
      await fetchRenewalLogs();
      await fetchAutoRenewalData();
      await fetchLiveNotifications();
    } catch (err: any) {
      alert(
        'रिव्हर्ट करताना त्रुटी आली: ' +
          (err.response?.data?.message || err.response?.data || err.message)
      );
    } finally {
      setRevertingId(null);
    }
  };

  // Mark a task as completed directly with optimistic update
  const handleCompleteTask = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setCompletingTaskId(taskId);
      await axios.post(`/api/Notification/${taskId}/complete`);

      // Optimistic update
      setLiveNotifications(prev => prev.filter(n => n.notificationID.toString() !== taskId));
      setStats(prev => ({
        ...prev,
        totalPending: Math.max(0, prev.totalPending - 1),
        completedToday: prev.completedToday + 1,
        completionRate:
          prev.totalPending + prev.completedToday > 0
            ? Math.round(
                ((prev.completedToday + 1) / (prev.totalPending + prev.completedToday)) * 100
              )
            : 100
      }));

      setSuccessToast('काम यशस्वीरित्या पूर्ण म्हणून चिन्हांकित केले!');
      if (selectedItemDetails?.id === taskId) {
        setSelectedItemDetails(null);
      }
    } catch (err: any) {
      alert('काम पूर्ण करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setCompletingTaskId(null);
    }
  };

  // Filter helper by module
  const getNotificationsByModule = (moduleName: string) => {
    return liveNotifications.filter((n: any) => n.moduleName === moduleName);
  };

  // BUILD THE 10 BANKING TASK SECTIONS (Fully Audited & Connected)
  const taskSections = useMemo<TaskSection[]>(() => {
    const voucherNotifs = getNotificationsByModule('Vouchers');
    const loanNotifs = getNotificationsByModule('Loans');
    const loanAppNotifs = getNotificationsByModule('LoanApplications');
    const fdNotifs = getNotificationsByModule('FD');
    const rdNotifs = getNotificationsByModule('RD');
    const shareNotifs = getNotificationsByModule('Shares');
    const pigmyNotifs = getNotificationsByModule('Pigmy');
    const npaNotifs = getNotificationsByModule('NPA');
    const lockerNotifs = getNotificationsByModule('Locker');
    const systemNotifs = getNotificationsByModule('System');

    const sections: TaskSection[] = [
      {
        id: 'voucher-pending',
        titleMr: '१. व्हाउचर मंजुरी प्रलंबित',
        titleEn: '1. Voucher Approval Pending',
        category: 'Accounts',
        moduleKey: 'Vouchers',
        icon: FileText,
        count: voucherNotifs.length,
        totalAmount: voucherNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'URGENT',
        badgeColor: 'bg-orange-50 text-orange-800 border-orange-200',
        accentBg: 'border-l-4 border-l-orange-500',
        targetTab: 'vouchers',
        roles: ['MANAGER', 'CASHIER'],
        items: voucherNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `Vouch #${n.entityID}` : undefined,
          memberName: n.title,
          details: n.description,
          amount: n.amount,
          dueDate: n.dueDate ? new Date(n.dueDate).toLocaleDateString('en-IN') : 'आज',
          status: 'मेकर-चेकर पडताळणी प्रलंबित',
          targetTab: 'vouchers',
          entityId: n.entityID,
          priority: n.priority,
          moduleName: 'Vouchers',
          roleName: n.roleName
        }))
      },
      {
        id: 'loan-recovery',
        titleMr: '२. कर्ज वसुली व हप्ते थकीत',
        titleEn: '2. Loan Overdue & Recovery',
        category: 'Loans',
        moduleKey: 'Loans',
        icon: CreditCard,
        count: loanNotifs.length,
        totalAmount: loanNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: loanNotifs.some(n => n.priority === 'URGENT' || n.priority === 'HIGH')
          ? 'URGENT'
          : 'HIGH',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        accentBg: 'border-l-4 border-l-rose-500',
        targetTab: 'loan-collection',
        roles: ['MANAGER', 'LOANS'],
        items: loanNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `कर्ज #${n.entityID}` : undefined,
          memberName: n.title.replace(/^.+?-\s*/, ''),
          details: n.description,
          amount: n.amount,
          dueDate: n.dueDate ? new Date(n.dueDate).toLocaleDateString('en-IN') : 'आज',
          status: n.priority === 'URGENT' ? 'तातडीने वसुली आवश्यक' : 'हप्ता थकीत',
          targetTab: 'loan-collection',
          entityId: n.entityID,
          priority: n.priority,
          moduleName: 'Loans',
          roleName: n.roleName
        }))
      },
      {
        id: 'loan-application',
        titleMr: '३. कर्ज मागणी अर्ज मंजुरी / वाटप',
        titleEn: '3. Loan Sanction / Disbursement',
        category: 'Loans',
        moduleKey: 'LoanApplications',
        icon: FileCheck,
        count: loanAppNotifs.length,
        totalAmount: loanAppNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'HIGH',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        accentBg: 'border-l-4 border-l-indigo-500',
        targetTab: 'loan-process',
        roles: ['MANAGER', 'LOANS'],
        items: loanAppNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `अर्ज #${n.entityID}` : undefined,
          memberName: n.title.replace(/^.+?-\s*/, ''),
          details: n.description,
          amount: n.amount,
          dueDate: n.dueDate ? new Date(n.dueDate).toLocaleDateString('en-IN') : 'आज',
          status: 'मंजुरी / कर्ज वाटप प्रलंबित',
          targetTab: 'loan-process',
          entityId: n.entityID,
          priority: n.priority,
          moduleName: 'LoanApplications',
          roleName: n.roleName
        }))
      },
      {
        id: 'fd-maturity',
        titleMr: '४. मुदत ठेव (FD) मुदतपूर्ती',
        titleEn: '4. FD Maturity Due',
        category: 'Deposits',
        moduleKey: 'FD',
        icon: Building2,
        count: fdNotifs.length,
        totalAmount: fdNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'HIGH',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        accentBg: 'border-l-4 border-l-blue-500',
        targetTab: 'fd-withdrawal',
        roles: ['MANAGER', 'DEPOSITS'],
        items: fdNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `FD #${n.entityID}` : undefined,
          memberName: n.title.replace(/^.+?-\s*/, ''),
          details: n.description,
          amount: n.amount,
          dueDate: n.dueDate ? new Date(n.dueDate).toLocaleDateString('en-IN') : 'आज',
          status: 'परतावा / ऑटो-नूतनीकरण पात्र',
          targetTab: 'fd-withdrawal',
          entityId: n.entityID,
          priority: n.priority,
          moduleName: 'FD',
          roleName: n.roleName
        }))
      },
      {
        id: 'rd-due',
        titleMr: '५. आवर्ती ठेव (RD) थकीत हप्ते',
        titleEn: '5. RD Installment Due',
        category: 'Deposits',
        moduleKey: 'RD',
        icon: Calendar,
        count: rdNotifs.length,
        totalAmount: rdNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'MEDIUM',
        badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        accentBg: 'border-l-4 border-l-cyan-500',
        targetTab: 'rd-collection',
        roles: ['DEPOSITS', 'CASHIER'],
        items: rdNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `RD #${n.entityID}` : undefined,
          memberName: n.title.replace(/^.+?-\s*/, ''),
          details: n.description,
          amount: n.amount,
          dueDate: n.dueDate ? new Date(n.dueDate).toLocaleDateString('en-IN') : 'चालू महिना',
          status: 'मासिक हप्ता प्रलंबित',
          targetTab: 'rd-collection',
          entityId: n.entityID,
          priority: n.priority,
          moduleName: 'RD',
          roleName: n.roleName
        }))
      },
      {
        id: 'share-allotment',
        titleMr: '६. शेअर्स व सभासदत्व वाटप',
        titleEn: '6. Share & Membership Allotment',
        category: 'Shares',
        moduleKey: 'Shares',
        icon: Users,
        count: shareNotifs.length,
        totalAmount: shareNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'HIGH',
        badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
        accentBg: 'border-l-4 border-l-amber-500',
        targetTab: 'share-master',
        roles: ['MANAGER', 'SHARES'],
        items: shareNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `सभासद #${n.entityID}` : undefined,
          memberName: n.title,
          details: n.description,
          amount: n.amount,
          dueDate: n.dueDate ? new Date(n.dueDate).toLocaleDateString('en-IN') : 'आज',
          status: 'संचालक मंडळ मंजुरी / भाग दाखला',
          targetTab: 'share-master',
          entityId: n.entityID,
          priority: n.priority,
          moduleName: 'Shares',
          roleName: n.roleName
        }))
      },
      {
        id: 'pigmy-pending',
        titleMr: '७. पिग्मी / दैनिक ठेव बॅच पोस्टिंग',
        titleEn: '7. Pigmy Voucher Posting',
        category: 'Pigmy',
        moduleKey: 'Pigmy',
        icon: Wallet,
        count: pigmyNotifs.length,
        totalAmount: pigmyNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'HIGH',
        badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
        accentBg: 'border-l-4 border-l-teal-500',
        targetTab: 'pigmy-daybook',
        roles: ['CASHIER', 'MANAGER'],
        items: pigmyNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `एजंट #${n.entityID}` : undefined,
          memberName: n.title,
          details: n.description,
          amount: n.amount,
          dueDate: 'आज',
          status: 'कॅशियर सिंक / व्हाउचर पोस्टिंग बाकी',
          targetTab: 'pigmy-daybook',
          entityId: n.entityID,
          priority: n.priority,
          moduleName: 'Pigmy',
          roleName: n.roleName
        }))
      },
      {
        id: 'npa-alert',
        titleMr: '८. एन.पी.ए. (NPA) तातडीची नोटीस / वसुली',
        titleEn: '8. NPA Recovery & Notices',
        category: 'Audit',
        moduleKey: 'NPA',
        icon: AlertTriangle,
        count: npaNotifs.length,
        totalAmount: npaNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'URGENT',
        badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
        accentBg: 'border-l-4 border-l-red-600',
        targetTab: 'npa-dashboard',
        roles: ['MANAGER', 'LOANS'],
        items: npaNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `खाते #${n.entityID}` : undefined,
          memberName: n.title,
          details: n.description,
          amount: n.amount,
          dueDate: 'अति तातडीचे',
          status: 'कलम १०१ / कायदेशीर नोटीस',
          targetTab: 'npa-dashboard',
          entityId: n.entityID,
          priority: 'URGENT',
          moduleName: 'NPA',
          roleName: n.roleName
        }))
      },
      {
        id: 'locker-renewal',
        titleMr: '९. लॉकर भाडे नूतनीकरण थकीत',
        titleEn: '9. Locker Rent Renewal Due',
        category: 'Locker',
        moduleKey: 'Locker',
        icon: Lock,
        count: lockerNotifs.length,
        totalAmount: lockerNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'MEDIUM',
        badgeColor: 'bg-violet-50 text-violet-800 border-violet-200',
        accentBg: 'border-l-4 border-l-violet-500',
        targetTab: 'locker-rent-renewal',
        roles: ['MANAGER', 'LOCKER', 'CASHIER'],
        items: lockerNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `लॉकर #${n.entityID}` : undefined,
          memberName: n.title,
          details: n.description,
          amount: n.amount,
          dueDate: n.dueDate ? new Date(n.dueDate).toLocaleDateString('en-IN') : 'चालू मुदत',
          status: 'वार्षिक भाडे जमा करणे बाकी',
          targetTab: 'locker-rent-renewal',
          entityId: n.entityID,
          priority: n.priority,
          moduleName: 'Locker',
          roleName: n.roleName
        }))
      },
      {
        id: 'day-end-alert',
        titleMr: '१०. दिवस अखेर (Day-End Status)',
        titleEn: '10. Day End Close Status',
        category: 'System',
        moduleKey: 'System',
        icon: Moon,
        count: systemNotifs.length,
        priority: 'URGENT',
        badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
        accentBg: 'border-l-4 border-l-purple-600',
        targetTab: 'day-end',
        roles: ['MANAGER', 'CASHIER'],
        items: systemNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: 'शाखा दिवस अखेर',
          memberName: n.title,
          details: n.description,
          dueDate: 'आज संध्याकाळी',
          status: 'डे-एंड प्रक्रिया बाकी',
          targetTab: 'day-end',
          entityId: n.entityID,
          priority: 'URGENT',
          moduleName: 'System',
          roleName: n.roleName
        }))
      }
    ];

    return sections;
  }, [liveNotifications]);

  // Apply Role & Priority Filters
  const filteredSections = useMemo(() => {
    return taskSections.filter(section => {
      // Role filter
      if (roleFilter !== 'ALL' && !section.roles.includes(roleFilter)) {
        return false;
      }
      // Priority filter
      if (selectedFilter === 'URGENT') return section.priority === 'URGENT';
      if (selectedFilter === 'HIGH')
        return section.priority === 'HIGH' || section.priority === 'URGENT';
      return true;
    });
  }, [taskSections, roleFilter, selectedFilter]);

  // Flattened items for the Grid Table View
  const allFilteredGridItems = useMemo(() => {
    let items: TaskItem[] = [];
    filteredSections.forEach(sec => {
      if (gridModuleFilter === 'ALL' || sec.moduleKey === gridModuleFilter) {
        items = items.concat(sec.items);
      }
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        item =>
          item.memberName.toLowerCase().includes(q) ||
          item.details.toLowerCase().includes(q) ||
          (item.accountNo && item.accountNo.toLowerCase().includes(q))
      );
    }
    return items;
  }, [filteredSections, gridModuleFilter, searchQuery]);

  // Navigate to Target Action
  const handleActionClick = (targetTab: string, entityId?: string) => {
    if (onNavigate) {
      if (entityId) {
        onNavigate(targetTab, { entityId, id: entityId });
      } else {
        onNavigate(targetTab);
      }
    }
  };

  const fmtCurrency = (val?: number) => {
    if (!val || val === 0) return null;
    return `₹ ${Number(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="p-2.5 max-w-full h-full flex flex-col bg-slate-100 text-[11px] font-sans relative overflow-y-auto">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-300 overflow-hidden flex flex-col mb-4">
        {/* ========================================================
            HERO HEADER BANNER (Core Banking Command Center)
           ======================================================== */}
        <div className="bg-primary text-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center text-white shadow-2xs">
              <FolderCheck className="w-4 h-4 text-sky-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs md:text-sm font-black tracking-wide text-white flex items-center gap-1.5">
                  <span>आजची कामे डॅशबोर्ड (Core Banking Operations Command Center)</span>
                </h2>
                <span className="bg-emerald-500/25 text-emerald-200 border border-emerald-300/40 text-[9px] font-bold px-2 py-0.2 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  डेटाबेस लाईव्ह
                </span>
                <span className="bg-white/20 text-white text-[9px] font-bold px-2 py-0.2 rounded-full">
                  शाखा #{effectiveBranchId}
                </span>
              </div>
              <p className="text-[10px] text-sky-100 hidden sm:block">
                दैनंदिन व्यवहार, प्रलंबित मंजुऱ्या, मुदतपूर्ती व कायदेशीर वसुली नियंत्रण कक्ष
              </p>
            </div>
          </div>

          {/* Top Controls: Refresh, View Mode Switch, Notifications Modal */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher */}
            <div className="inline-flex rounded-md bg-white/15 p-0.5 border border-white/25 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer ${
                  viewMode === 'CARDS'
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-white hover:bg-white/10'
                }`}
                title="१० विभागवार कार्ड्स दृश्य"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>कार्ड दृश्य</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer ${
                  viewMode === 'GRID'
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-white hover:bg-white/10'
                }`}
                title="सर्व प्रलंबित कामांची तपशीलवार यादी"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>तपशीलवार ग्रिड</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                fetchLiveNotifications();
                fetchAutoRenewalData();
              }}
              disabled={loading}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="डेटाबेसमधून कामांची ताजी स्थिती पुन्हा तपासा"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>रीफ्रेश</span>
            </button>

            {/* Pop-up modal opener */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-2.5 py-1 rounded bg-sky-500/30 hover:bg-sky-500/40 text-white border border-sky-300/40 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>सूचना विंडो</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            EXECUTIVE KPI SUMMARY METRIC CARDS (शीर्ष सारांश - ५ निर्देशक)
           ======================================================== */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* 1. Total Pending */}
          <div className="bg-white p-2.5 rounded-md border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-primary shrink-0">
              <FolderCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-semibold">एकूण प्रलंबित कामे</div>
              <div className="text-base font-black text-slate-900 leading-tight">
                {stats.totalPending}{' '}
                <span className="text-[10px] font-normal text-slate-400">नोंदी</span>
              </div>
            </div>
          </div>

          {/* 2. Urgent / High Priority */}
          <div className="bg-white p-2.5 rounded-md border border-rose-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] text-rose-700 font-semibold">अति तातडीची कामे</div>
              <div className="text-base font-black text-rose-700 leading-tight">
                {stats.urgentTasks + stats.highPriorityTasks}{' '}
                <span className="text-[10px] font-normal text-rose-400">तातडीने</span>
              </div>
            </div>
          </div>

          {/* 3. Total Amount */}
          <div className="bg-white p-2.5 rounded-md border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-[10px] text-slate-500 font-semibold">एकूण थकीत / मुदत रक्कम</div>
              <div className="text-sm font-black text-emerald-700 leading-tight truncate">
                ₹ {Number(stats.totalAmount).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* 4. Completed Today */}
          <div className="bg-white p-2.5 rounded-md border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-semibold">आज पूर्ण झालेली कामे</div>
              <div className="text-base font-black text-teal-800 leading-tight">
                {stats.completedToday}{' '}
                <span className="text-[10px] font-normal text-slate-400">पूर्ण</span>
              </div>
            </div>
          </div>

          {/* 5. Progress Bar */}
          <div className="bg-white p-2.5 rounded-md border border-slate-200 shadow-2xs col-span-2 sm:col-span-1 flex flex-col justify-center">
            <div className="flex justify-between items-center text-[10px] font-bold mb-1">
              <span className="text-slate-600">दैनिक कामे पूर्णता प्रगती</span>
              <span className="text-primary font-black">{stats.completionRate}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className="bg-gradient-to-r from-sky-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, stats.completionRate))}%` }}
              ></div>
            </div>
            <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
              <span>०%</span>
              <span>लक्ष्य १००%</span>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROLE-BASED TABS & QUICK PRIORITY FILTER BAR
           ======================================================== */}
        <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Role Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            <span className="text-[10px] font-bold text-slate-500 mr-1 flex items-center gap-0.5">
              <Filter className="w-3 h-3" /> विभाग:
            </span>
            {[
              { key: 'ALL', label: 'सर्व कामे' },
              { key: 'MANAGER', label: 'व्यवस्थापक (Manager)' },
              { key: 'CASHIER', label: 'कॅशियर (Cashier)' },
              { key: 'LOANS', label: 'कर्ज विभाग (Loans)' },
              { key: 'DEPOSITS', label: 'ठेव विभाग (Deposits)' },
              { key: 'SHARES', label: 'शेअर्स विभाग (Shares)' },
              { key: 'LOCKER', label: 'लॉकर विभाग (Locker)' }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRoleFilter(tab.key as any)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  roleFilter === tab.key
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Priority Quick Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-500 mr-0.5">प्राधान्य:</span>
            <div className="inline-flex rounded bg-white p-0.5 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setSelectedFilter('ALL')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer text-[10px] font-bold ${
                  selectedFilter === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                सर्व
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('URGENT')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer text-[10px] font-bold ${
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
                className={`px-2 py-0.5 rounded transition-all cursor-pointer text-[10px] font-bold ${
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

        {/* Dashboard Body Content */}
        <div className="p-3 bg-slate-50/60">
          {/* ========================================================
              🔄 CBS FD AUTO-RENEWAL ACTION CENTER (PRESERVED & ENHANCED)
             ======================================================== */}
          <div className="mb-3.5 bg-gradient-to-r from-sky-950 via-sky-900 to-indigo-950 text-white rounded-md p-3 shadow-xs border border-sky-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shadow-2xs shrink-0">
                <RotateCcw className={`w-4 h-4 ${runningBatch ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs font-black tracking-wide text-white flex items-center gap-1.5">
                    <span>मुदत ठेव स्वयंचलित नूतनीकरण केंद्र (CBS FD Auto-Renewal Center)</span>
                  </h3>
                  <span className="bg-sky-400/20 text-sky-200 border border-sky-300/30 text-[9px] font-bold px-2 py-0.2 rounded-full">
                    आरबीआय १४-दिवसीय सवलत लागू
                  </span>
                </div>
                <div className="text-[10px] text-sky-100 flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>
                    पात्र खाती:{' '}
                    <strong className="text-amber-300 font-bold">
                      {autoRenewalCandidates.length} पावत्या
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    एकूण नूतनीकरण रक्कम:{' '}
                    <strong className="text-emerald-300 font-bold">
                      ₹{' '}
                      {autoRenewalCandidates
                        .reduce(
                          (acc, c) =>
                            acc + (c.projectedRenewedAmount || c.depositAmount || 0),
                          0
                        )
                        .toLocaleString('en-IN')}
                    </strong>
                  </span>
                  <span>•</span>
                  <span className="text-[9px] text-sky-200">
                    प्रचलित व्याजदर स्लॅब स्वयंचलित लागू होतील
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAutoRenewalModal(true)}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-sky-200" />
                <span>पात्र यादी पहा ({autoRenewalCandidates.length})</span>
              </button>

              <button
                type="button"
                disabled={runningBatch || autoRenewalCandidates.length === 0}
                onClick={() => handleRunBatch()}
                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="पात्र सर्व मुदत ठेवींचे प्रचलित व्याजदराने ऑटो-नूतनीकरण करा"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{runningBatch ? 'बॅच प्रक्रिया सुरु...' : '🚀 EOD बॅच रन करा'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  fetchRenewalLogs();
                  setShowLogsModal(true);
                }}
                className="px-2.5 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 text-sky-200 hover:text-white border border-indigo-400/30 text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>इतिहास / रिव्हर्सल</span>
              </button>
            </div>
          </div>

          {/* ========================================================
              MODE 1: 10 CATEGORY CARD VIEW (कार्ड दृश्य)
             ======================================================== */}
          {viewMode === 'CARDS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 lg:grid-cols-4 gap-3">
              {filteredSections.map(section => {
                const IconComponent = section.icon;
                return (
                  <div
                    key={section.id}
                    className={`bg-white rounded-md border border-slate-300 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:border-primary ${section.accentBg}`}
                  >
                    {/* Card Header using Primary Theme */}
                    <div className="bg-primary text-white px-3 py-2 flex justify-between items-center shadow-2xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="p-1 rounded bg-white/15 text-white shrink-0">
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <h3
                            className="font-bold text-xs leading-tight text-white truncate"
                            title={section.titleMr}
                          >
                            {section.titleMr}
                          </h3>
                          <span className="text-[9px] text-sky-100 block font-medium truncate">
                            {section.titleEn}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap ml-1 ${
                          section.count > 0
                            ? 'bg-white text-primary font-black border-white'
                            : 'bg-white/20 text-white border-white/30'
                        }`}
                      >
                        {section.count} नोंदी
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between bg-white">
                      <div>
                        {fmtCurrency(section.totalAmount) && (
                          <div className="mb-2 p-1.5 bg-slate-50 rounded border border-slate-200 flex justify-between items-center text-xs">
                            <span className="text-[10px] text-slate-500 font-medium">एकूण रक्कम:</span>
                            <span className="text-xs font-bold text-primary">
                              {fmtCurrency(section.totalAmount)}
                            </span>
                          </div>
                        )}

                        {/* Items Preview */}
                        <div className="space-y-1.5 mb-2">
                          {section.items.length === 0 ? (
                            <div className="p-3 text-center text-[10px] text-slate-400 font-medium bg-slate-50 rounded border border-dashed border-slate-200">
                              <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto mb-1 opacity-70" />
                              कोणतीही प्रलंबित नोंद नाही
                            </div>
                          ) : (
                            <>
                              {section.items.slice(0, 3).map(item => (
                                <div
                                  key={item.id}
                                  className="p-1.5 rounded bg-slate-50/90 border border-slate-200 hover:border-primary/40 transition-all text-xs flex flex-col justify-between"
                                >
                                  <div className="flex justify-between items-center font-semibold text-slate-800 mb-1 text-[11px]">
                                    <span
                                      className="truncate max-w-[130px]"
                                      title={item.memberName}
                                    >
                                      👤 {item.memberName}
                                    </span>
                                    {item.amount ? (
                                      <span className="text-primary font-bold text-[10px] bg-sky-50 px-1 py-0.2 rounded border border-sky-200 shrink-0">
                                        ₹{Number(item.amount).toLocaleString('en-IN')}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                                    <span
                                      className="font-mono text-slate-600 bg-white px-1 py-0.2 rounded border border-slate-200 text-[9px] truncate max-w-[110px]"
                                      title={item.accountNo || item.details}
                                    >
                                      {item.accountNo || item.details}
                                    </span>

                                    <div className="flex items-center gap-1 shrink-0 ml-1">
                                      <button
                                        type="button"
                                        onClick={e => {
                                          e.stopPropagation();
                                          setSelectedItemDetails(item);
                                        }}
                                        className="px-1.5 py-0.2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[9px] font-medium transition-all flex items-center gap-0.5 cursor-pointer shadow-2xs"
                                        title="पूर्ण तपशील पहा"
                                      >
                                        <Eye className="w-3 h-3 text-slate-500" />
                                        <span>तपशील</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={completingTaskId === item.id}
                                        onClick={e => handleCompleteTask(item.id, e)}
                                        className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded transition-all cursor-pointer disabled:opacity-50"
                                        title="हे काम पूर्ण झाले म्हणून चिन्हांकित करा"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {section.items.length > 3 && (
                                <div className="text-center py-0.5 bg-sky-50 border border-sky-100 rounded text-[9px] font-semibold text-primary">
                                  + {section.items.length - 3} आणखी नोंदी
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={() => handleActionClick(section.targetTab)}
                        className="w-full py-1.5 px-2 bg-primary hover:bg-[#004a75] active:scale-98 text-white text-[11px] font-bold rounded-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer mt-1"
                      >
                        <span>तपासा / कारवाई करा</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================
              MODE 2: UNIFIED GRID TABLE VIEW (तपशीलवार ग्रिड)
             ======================================================== */}
          {viewMode === 'GRID' && (
            <div className="bg-white rounded-md border border-slate-300 shadow-2xs overflow-hidden flex flex-col">
              {/* Search & Filter Toolbar */}
              <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="खातेदार नाव, खाते क्र., किंवा तपशील शोधा..."
                      className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={gridModuleFilter}
                    onChange={e => setGridModuleFilter(e.target.value)}
                    className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ALL">सर्व १० विभाग (All Categories)</option>
                    <option value="Vouchers">१. व्हाउचर (Vouchers)</option>
                    <option value="Loans">२. कर्ज वसुली (Loans)</option>
                    <option value="LoanApplications">३. कर्ज अर्ज (Loan Applications)</option>
                    <option value="FD">४. मुदत ठेव (FD)</option>
                    <option value="RD">५. आवर्ती ठेव (RD)</option>
                    <option value="Shares">६. शेअर्स (Shares)</option>
                    <option value="Pigmy">७. पिग्मी (Pigmy)</option>
                    <option value="NPA">८. एन.पी.ए. (NPA)</option>
                    <option value="Locker">९. लॉकर भाडे (Locker)</option>
                    <option value="System">१०. दिवस अखेर (Day End)</option>
                  </select>

                  <span className="text-[10px] text-slate-500 font-semibold">
                    एकूण सापडलेल्या नोंदी: <strong>{allFilteredGridItems.length}</strong>
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2.5 text-center w-10">#</th>
                      <th className="p-2.5">विभाग / प्रकार</th>
                      <th className="p-2.5">प्राधान्य</th>
                      <th className="p-2.5">खातेदार व कामाचा तपशील</th>
                      <th className="p-2.5">खाते / संदर्भ क्र.</th>
                      <th className="p-2.5 text-right">रक्कम</th>
                      <th className="p-2.5 text-center">देय तारीख</th>
                      <th className="p-2.5">स्थिती</th>
                      <th className="p-2.5 text-center w-44">कृती केंद्र (Action)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allFilteredGridItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                          <p className="font-bold text-xs text-slate-700">कोणतीही प्रलंबित कामे सापडली नाहीत.</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            सर्व व्यवहार अद्ययावत आहेत किंवा फिल्टरमध्ये बसणारी कामे नाहीत.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      allFilteredGridItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          className="hover:bg-sky-50/50 transition-colors"
                        >
                          <td className="p-2.5 text-center text-slate-400 font-mono text-[10px]">
                            {idx + 1}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold border border-slate-200">
                              {item.moduleName || 'System'}
                            </span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                item.priority === 'URGENT'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : item.priority === 'HIGH'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {item.priority === 'URGENT'
                                ? 'अति तातडीचे'
                                : item.priority === 'HIGH'
                                ? 'महत्त्वाचे'
                                : 'सामान्य'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-800 text-[11px]">
                              👤 {item.memberName}
                            </div>
                            <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                              {item.details}
                            </div>
                          </td>
                          <td className="p-2.5 font-mono text-primary font-bold whitespace-nowrap text-[10px]">
                            {item.accountNo || '-'}
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                            {item.amount ? `₹ ${Number(item.amount).toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="p-2.5 text-center text-slate-600 whitespace-nowrap text-[10px]">
                            {item.dueDate || 'आज'}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {item.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1-Click Action to Tab */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleActionClick(item.targetTab || 'vouchers', item.entityId)
                                }
                                className="px-2 py-1 bg-primary hover:bg-[#004a75] text-white text-[10px] font-bold rounded shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                                title="या कामावर थेट कारवाई करण्यासाठी फॉर्म उघडा"
                              >
                                <span>कारवाई</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>

                              {/* Details Modal */}
                              <button
                                type="button"
                                onClick={() => setSelectedItemDetails(item)}
                                className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded transition-all cursor-pointer"
                                title="संपूर्ण तपशील पहा"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Mark Complete */}
                              <button
                                type="button"
                                disabled={completingTaskId === item.id}
                                onClick={e => handleCompleteTask(item.id, e)}
                                className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded transition-all cursor-pointer disabled:opacity-50"
                                title="हे काम पूर्ण झाले म्हणून चिन्हांकित करा"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          MODAL 1: FULL MEMBER & TASK DETAILS POPUP
         ======================================================== */}
      {selectedItemDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-3.5 bg-primary text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/20 rounded-lg text-white">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-white">सभासद व कामाचा पूर्ण तपशील</h3>
                  <p className="text-[10px] text-sky-100">Complete Banking Task Details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemDetails(null)}
                className="p-1 rounded-full hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 bg-slate-50/50 text-xs">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">विभाग / मॉड्यूल (Module):</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {selectedItemDetails.moduleName || 'General'}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">खातेदार / सभासद (Member):</span>
                  <span className="font-bold text-slate-800 text-xs">
                    👤 {selectedItemDetails.memberName}
                  </span>
                </div>

                {selectedItemDetails.accountNo && (
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">खाते / पावती क्र. (Account No):</span>
                    <span className="font-mono text-primary font-bold bg-sky-50 border border-sky-200 px-2 py-0.5 rounded text-[11px]">
                      {selectedItemDetails.accountNo}
                    </span>
                  </div>
                )}

                {selectedItemDetails.amount ? (
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">थकीत / एकूण रक्कम (Amount):</span>
                    <span className="font-extrabold text-primary text-xs">
                      ₹ {Number(selectedItemDetails.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ) : null}

                {selectedItemDetails.dueDate && (
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">मुदत तारीख (Due Date):</span>
                    <span className="font-medium text-slate-700">{selectedItemDetails.dueDate}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">काम स्थिती (Status):</span>
                  <span className="font-medium text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    {selectedItemDetails.status}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700 block mb-1 text-[11px]">
                  वर्णन व आवश्यक कृती (Action Description):
                </span>
                <p className="text-slate-600 leading-relaxed text-xs">
                  {selectedItemDetails.details}
                </p>
              </div>
            </div>

            <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedItemDetails(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs border border-slate-300 cursor-pointer"
              >
                बंद करा
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={completingTaskId === selectedItemDetails.id}
                  onClick={() => handleCompleteTask(selectedItemDetails.id)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>पूर्ण झाले</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetTab = selectedItemDetails.targetTab || 'vouchers';
                    const entityId = selectedItemDetails.entityId;
                    setSelectedItemDetails(null);
                    handleActionClick(targetTab, entityId);
                  }}
                  className="px-3.5 py-1.5 bg-primary hover:bg-[#004a75] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <span>थेट नोंदणी करा</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-primary text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl text-white">
                  <Bell className="w-5 h-5 text-sky-200" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-white">
                    आजची कामे व महत्त्वाच्या सूचना (Today's Live Alerts)
                  </h2>
                  <p className="text-[11px] text-sky-100">
                    डेटाबेसमधील लाईव्ह प्रलंबित कामे व दैनंदिन कार्यभार.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  if (onCloseLoginModal) onCloseLoginModal();
                }}
                className="p-1 rounded-full hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 flex items-start gap-3 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">महत्त्वाची टीप:</span> आजच्या व्यवहारापूर्वी
                  व्हाउचर मंजुरी, कर्ज वसुली, एफ.डी. मुदतपूर्ती, एन.पी.ए. व दिवस अखेर तपासून घ्या.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {taskSections.map(sec => {
                  const SecIcon = sec.icon;
                  return (
                    <div
                      key={sec.id}
                      onClick={() => {
                        setIsModalOpen(false);
                        handleActionClick(sec.targetTab);
                      }}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-primary hover:bg-sky-50/40 transition-all cursor-pointer flex justify-between items-center group shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-primary/10 text-slate-600 group-hover:text-primary transition-colors shrink-0">
                          <SecIcon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-xs text-slate-800 group-hover:text-primary transition-colors truncate">
                            {sec.titleMr}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {sec.count} प्रलंबित नोंदी
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3.5 bg-white border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">
                एकूण {liveNotifications.length} प्रलंबित कामे डेटाबेसमध्ये उपलब्ध आहेत
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  if (onCloseLoginModal) onCloseLoginModal();
                }}
                className="px-4 py-1.5 bg-primary hover:bg-[#004a75] text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
              >
                डॅशबोर्ड पहा (View Dashboard)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: CANDIDATE LIST MODAL (पात्र मुदत ठेव यादी)
         ======================================================== */}
      {showAutoRenewalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] shadow-2xl border border-slate-300 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 bg-gradient-to-r from-sky-950 to-indigo-950 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-white/10 text-sky-200">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-white">स्वयंचलित नूतनीकरणास पात्र मुदत ठेव पावत्या</h3>
                  <p className="text-[10px] text-sky-200">आज किंवा त्यापूर्वी मुदत संपलेली व ऑटो-रिन्यूअल सक्रिय असणारी खाती</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoRenewalModal(false)}
                className="p-1 rounded-full hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-3 overflow-y-auto flex-1 bg-slate-50/50 text-[11px]">
              {autoRenewalCandidates.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCheck className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                  <p className="font-bold text-xs text-slate-700">सध्या स्वयंचलित नूतनीकरणास पात्र कोणतीही ठेव प्रलंबित नाही.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">सर्व मुदत ठेवी नियमित किंवा अद्ययावत आहेत.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-2xs">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold text-[10px]">
                        <th className="p-2">पावती / खाते क्र.</th>
                        <th className="p-2">खातेदार नाव</th>
                        <th className="p-2">मुदतपूर्ती तारीख</th>
                        <th className="p-2 text-right">ठेव मुद्दल</th>
                        <th className="p-2 text-right">अपेक्षित रक्कम</th>
                        <th className="p-2 text-center">प्रचलित दर</th>
                        <th className="p-2">पर्याय</th>
                        <th className="p-2 text-center">कृती</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {autoRenewalCandidates.map(c => (
                        <tr key={c.fdAccountID} className="hover:bg-sky-50/50 transition-colors">
                          <td className="p-2 font-mono font-bold text-primary text-xs">
                            {c.accountNo}
                          </td>
                          <td className="p-2">
                            <div className="font-bold text-slate-800">{c.customerName}</div>
                            {c.contactNo && <div className="text-[9px] text-slate-400">📱 {c.contactNo}</div>}
                            {c.hasActiveLoan && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[9px] font-bold">
                                ⚠️ सक्रिय कर्ज: ₹ {Number(c.activeLoanBalance).toLocaleString('en-IN')}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-slate-600">
                            {new Date(c.MaturityDate || c.maturityDate).toLocaleDateString('en-GB')}
                          </td>
                          <td className="p-2 text-right font-medium text-slate-700">
                            ₹ {Number(c.depositAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-2 text-right font-bold text-emerald-700">
                            ₹ {Number(c.projectedRenewedAmount || c.maturityAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-2 text-center font-bold text-slate-800 bg-sky-50/60">
                            {c.prevailingRate}%
                          </td>
                          <td className="p-2 text-[10px]">
                            {c.autoRenewalOption === 'PrincipalOnly' ? (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                                केवळ मुद्दल (व्याज SB मध्ये)
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                                मुद्दल + जमा व्याज
                              </span>
                            )}
                            <div className="text-[9px] text-slate-400 mt-0.5">
                              नूतनीकरण: {c.autoRenewalCount}/{c.maxAutoRenewalCycles} वेळा
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              disabled={runningBatch}
                              onClick={() => handleRunBatch([c.fdAccountID])}
                              className="px-2 py-1 bg-primary hover:bg-[#004a75] text-white text-[10px] font-bold rounded shadow-2xs transition-all cursor-pointer disabled:opacity-50"
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

            {/* Footer */}
            <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
              <span className="text-[11px] text-slate-600 font-medium">
                एकूण पात्र खाती: <strong>{autoRenewalCandidates.length}</strong> | एकूण रक्कम:{' '}
                <strong>
                  ₹{' '}
                  {autoRenewalCandidates
                    .reduce(
                      (acc, c) => acc + (c.projectedRenewedAmount || c.depositAmount || 0),
                      0
                    )
                    .toLocaleString('en-IN')}
                </strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAutoRenewalModal(false)}
                  className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded transition-colors cursor-pointer"
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
                    className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-300 overflow-hidden">
            <div className="p-3.5 bg-emerald-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-xs text-white">स्वयंचलित नूतनीकरण बॅच निकाल (Execution Summary)</h3>
              </div>
              <button
                type="button"
                onClick={() => setBatchResult(null)}
                className="p-1 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs bg-slate-50/60">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-[10px] text-emerald-700 font-medium">यशस्वी</div>
                  <div className="text-base font-black text-emerald-800">{batchResult.successCount}</div>
                </div>
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="text-[10px] text-rose-700 font-medium">त्रुटी / अपयशी</div>
                  <div className="text-base font-black text-rose-800">{batchResult.failedCount}</div>
                </div>
                <div className="p-2 bg-sky-50 border border-sky-200 rounded-lg">
                  <div className="text-[10px] text-sky-700 font-medium">एकूण रक्कम</div>
                  <div className="text-xs font-black text-sky-900">
                    ₹ {Number(batchResult.totalRenewedAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {batchResult.items && batchResult.items.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded bg-white p-2 divide-y divide-slate-100 text-[11px]">
                  {batchResult.items.map((it: any, idx: number) => (
                    <div key={idx} className="py-1.5 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-800">
                          {it.oldAccountNo} ➜{' '}
                          <span className="text-primary font-mono">{it.newAccountNo || '-'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{it.customerName}</div>
                        {it.errorMessage && (
                          <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                            ⚠️ {it.errorMessage}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-white border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setBatchResult(null)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] shadow-2xl border border-slate-300 flex flex-col overflow-hidden">
            <div className="p-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-sky-300" />
                <div>
                  <h3 className="font-bold text-xs text-white">
                    स्वयंचलित नूतनीकरण ऑडिट इतिहास व १४-दिवसीय रिव्हर्सल
                  </h3>
                  <p className="text-[10px] text-slate-300">
                    आरबीआय मार्गदर्शक तत्त्वांनुसार १४ दिवसांत विनामूल्य रिव्हर्ट करण्याची सुविधा
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="p-1 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1 bg-slate-50/50 text-[11px]">
              {logsLoading ? (
                <div className="text-center py-8 text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-1 text-primary" />
                  <span>ऑडिट लॉग्स लोड होत आहेत...</span>
                </div>
              ) : renewalLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  कोणतीही नूतनीकरण लॉग नोंद उपलब्ध नाही.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-2xs">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold text-[10px]">
                        <th className="p-2">दिनांक / वेळ</th>
                        <th className="p-2">मूळ खाते ➜ नवीन खाते</th>
                        <th className="p-2">खातेदार</th>
                        <th className="p-2 text-right">नूतनीकृत रक्कम</th>
                        <th className="p-2 text-center">व्याजदर</th>
                        <th className="p-2 text-center">स्थिती</th>
                        <th className="p-2 text-center">१४-दिवसीय रिव्हर्सल</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {renewalLogs.map((l: any) => {
                        const batchDate = new Date(l.batchDate || l.executionTime);
                        const daysAgo = Math.floor(
                          (new Date().getTime() - batchDate.getTime()) / (1000 * 3600 * 24)
                        );
                        const isEligibleForGraceReversal =
                          !l.isReverted && daysAgo <= 14 && l.status === 'Success';

                        return (
                          <tr key={l.logID} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2 text-slate-600 font-mono text-[10px]">
                              {batchDate.toLocaleDateString('en-GB')}
                            </td>
                            <td className="p-2 font-mono text-[10px]">
                              <span className="text-slate-600">{l.oldAccountNo}</span> ➜{' '}
                              <strong className="text-primary">{l.newAccountNo}</strong>
                            </td>
                            <td className="p-2 font-semibold text-slate-800">{l.customerName}</td>
                            <td className="p-2 text-right font-bold text-slate-900">
                              ₹ {Number(l.renewedAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-2 text-center font-bold text-slate-700">
                              {l.appliedRate}%
                            </td>
                            <td className="p-2 text-center">
                              {l.isReverted ? (
                                <span className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                  रिव्हर्ट केले
                                </span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                  सक्रिय (Active)
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              {l.isReverted ? (
                                <span
                                  className="text-[9px] text-slate-400 italic"
                                  title={l.revertReason}
                                >
                                  {l.revertReason
                                    ? `कारण: ${l.revertReason.substring(0, 20)}...`
                                    : 'पूर्ववत केले'}
                                </span>
                              ) : isEligibleForGraceReversal ? (
                                <button
                                  type="button"
                                  onClick={() => setShowRevertDialog(l)}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1 mx-auto cursor-pointer"
                                  title={`नूतनीकरण होऊन ${daysAgo} दिवस झाले आहेत (१४ दिवसांची सवलत उपलब्ध)`}
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>रिव्हर्ट ({14 - daysAgo} दिवस बाकी)</span>
                                </button>
                              ) : (
                                <span className="text-[9px] text-slate-400 italic">
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

            <div className="p-3 bg-white border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded transition-colors cursor-pointer"
              >
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 6: REVERT CONFIRMATION DIALOG (१४-दिवसीय रिव्हर्सल कारण)
         ======================================================== */}
      {showRevertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-rose-300 overflow-hidden">
            <div className="p-3 bg-rose-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-200" />
                <h3 className="font-bold text-xs text-white">
                  १४-दिवसीय सवलतीत नूतनीकरण रद्द (Reversal)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRevertDialog(null)}
                className="p-1 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs bg-slate-50/60">
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded text-rose-900 leading-snug">
                ⚠️ <strong>बँकिंग प्रक्रिया माहिती:</strong> नवीन पावती क्र.{' '}
                <strong>{showRevertDialog.newAccountNo}</strong> रद्द होईल, अकाउंटिंग व्हाउचर उलट
                (Reverse) होईल, आणि मूळ पावती क्र.{' '}
                <strong>{showRevertDialog.oldAccountNo}</strong> मुदतपूर्ण (Matured) म्हणून पूर्ववत
                केली जाईल जेणेकरून खातेदार संपूर्ण रक्कम विनादंड काढू शकेल.
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
                  className="w-full border border-gray-300 rounded p-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans"
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
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                disabled={revertingId !== null || !revertReason.trim()}
                onClick={() => handleRevert(showRevertDialog)}
                className="px-3.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>{revertingId ? 'रिव्हर्ट होत आहे...' : 'नूतनीकरण रिव्हर्ट करा'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
