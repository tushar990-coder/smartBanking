import React, { useState, useEffect } from 'react';
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
  CheckCheck
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
}

export interface TaskSection {
  id: string;
  titleMr: string;
  titleEn: string;
  category: string;
  icon: React.ElementType;
  count: number;
  totalAmount?: number;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  badgeColor: string;
  accentBg: string;
  targetTab: string;
  items: TaskItem[];
}

export default function TodaysTasksDashboard({
  onNavigate,
  showLoginModal = false,
  onCloseLoginModal,
  branchId = 1
}: TodaysTasksDashboardProps) {
  const [isModalOpen, setIsModalOpen] = useState(showLoginModal);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'URGENT' | 'HIGH'>('ALL');
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemDetails, setSelectedItemDetails] = useState<TaskItem | null>(null);

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

  const fetchAutoRenewalData = async (isMountedRef?: { current: boolean }) => {
    try {
      if (isMountedRef && !isMountedRef.current) return;
      setAutoRenewalLoading(true);
      const res = await axios.get('/api/FdAccounts/AutoRenewalCandidates', {
        params: { branchId }
      });
      if (!isMountedRef || isMountedRef.current) {
        setAutoRenewalCandidates(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load auto-renewal candidates:", err);
    } finally {
      if (!isMountedRef || isMountedRef.current) {
        setAutoRenewalLoading(false);
      }
    }
  };

  const fetchRenewalLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await axios.get('/api/FdAccounts/AutoRenewalLogs', {
        params: { branchId }
      });
      setRenewalLogs(res.data || []);
    } catch (err) {
      console.error("Failed to load auto-renewal logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleRunBatch = async (specificIds?: number[]) => {
    if (!window.confirm('तुम्हाला खरोखरच पात्र मुदत ठेव पावत्यांचे स्वयंचलित नूतनीकरण (Auto-Renewal Batch) करायचे आहे का?\n\nबँकिंग नियमांनुसार प्रचलित दराने नवीन पावत्या तयार होतील, जुन्या पावत्या बंद होतील व बॅलन्स्ड जर्नल व्हाउचर पोस्ट केले जातील.')) {
      return;
    }
    setRunningBatch(true);
    setBatchResult(null);
    try {
      const res = await axios.post('/api/FdAccounts/RunAutoRenewalBatch', {
        branchID: branchId,
        processDate: new Date().toISOString(),
        specificAccountIDs: specificIds,
        executedBy: 'Manager-EOD'
      });
      setBatchResult(res.data);
      await fetchAutoRenewalData();
      await fetchLiveNotifications();
    } catch (err: any) {
      alert('बॅच रन करताना त्रुटी आली: ' + (err.response?.data?.message || err.response?.data || err.message));
    } finally {
      setRunningBatch(false);
    }
  };

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
      alert('रिव्हर्ट करताना त्रुटी आली: ' + (err.response?.data?.message || err.response?.data || err.message));
    } finally {
      setRevertingId(null);
    }
  };

  const fetchLiveNotifications = async (isMountedRef?: { current: boolean }) => {
    try {
      if (isMountedRef && !isMountedRef.current) return;
      setLoading(true);
      // Generate auto notifications from live database first
      await axios.post(`/api/Notification/generate?branchId=${branchId}`).catch(() => {});

      if (isMountedRef && !isMountedRef.current) return;

      // Fetch active notifications
      const res = await axios.get(`/api/Notification`, {
        params: { branchId, status: 'Active' }
      });
      if (!isMountedRef || isMountedRef.current) {
        setLiveNotifications(res.data || []);
      }
    } catch (err) {
      console.error("Error loading live notifications:", err);
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
  }, [branchId]);

  // Group live DB notifications by ModuleName
  const getNotificationsByModule = (moduleName: string) => {
    return liveNotifications.filter((n: any) => n.moduleName === moduleName);
  };

  // Build live dynamic task sections based on real database notifications
  const buildTaskSections = (): TaskSection[] => {
    const loanNotifs = getNotificationsByModule('Loans');
    const fdNotifs = getNotificationsByModule('FD');
    const rdNotifs = getNotificationsByModule('RD');
    const shareNotifs = getNotificationsByModule('Shares');
    const voucherNotifs = getNotificationsByModule('Vouchers');
    const pigmyNotifs = getNotificationsByModule('Pigmy');
    const npaNotifs = getNotificationsByModule('NPA');
    const systemNotifs = getNotificationsByModule('System');

    return [
      {
        id: 'loan-recovery',
        titleMr: '१. कर्ज वसुली मुदतपूर्ती',
        titleEn: '1. Loan Recovery Due',
        category: 'Loans',
        icon: CreditCard,
        count: loanNotifs.length,
        totalAmount: loanNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: loanNotifs.some(n => n.priority === 'HIGH') ? 'URGENT' : 'HIGH',
        badgeColor: 'bg-rose-50 text-rose-700 border border-rose-200',
        accentBg: 'bg-slate-50 text-slate-800',
        targetTab: 'loan-collection',
        items: loanNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `Acc #${n.entityID}` : undefined,
          memberName: n.title.replace(/^.+?-\s*/, ''),
          details: n.description,
          amount: n.amount,
          dueDate: n.dueDate ? new Date(n.dueDate).toLocaleDateString('en-IN') : 'आज',
          status: n.priority === 'HIGH' ? 'अति तातडीचे' : 'प्रलंबित',
          targetTab: 'loan-collection',
          entityId: n.entityID
        }))
      },
      {
        id: 'fd-maturity',
        titleMr: '२. एफ.डी. मुदतपूर्ती',
        titleEn: '2. FD Maturity',
        category: 'Deposits',
        icon: Building2,
        count: fdNotifs.length,
        totalAmount: fdNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'HIGH',
        badgeColor: 'bg-blue-50 text-blue-700 border border-blue-200',
        accentBg: 'bg-slate-50 text-slate-800',
        targetTab: 'fd-withdrawal',
        items: fdNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `FD #${n.entityID}` : undefined,
          memberName: n.title.replace(/^.+?-\s*/, ''),
          details: n.description,
          amount: n.amount,
          dueDate: n.dueDate ? new Date(n.dueDate).toLocaleDateString('en-IN') : 'उद्या',
          status: 'परतावा / नूतनीकरण',
          targetTab: 'fd-withdrawal',
          entityId: n.entityID
        }))
      },
      {
        id: 'rd-due',
        titleMr: '३. आर.डी. हप्ता बाकी',
        titleEn: '3. RD Due',
        category: 'Deposits',
        icon: Calendar,
        count: rdNotifs.length,
        totalAmount: rdNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'MEDIUM',
        badgeColor: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
        accentBg: 'bg-slate-50 text-slate-800',
        targetTab: 'rd-collection',
        items: rdNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `RD #${n.entityID}` : undefined,
          memberName: n.title.replace(/^.+?-\s*/, ''),
          details: n.description,
          amount: n.amount,
          dueDate: 'आज',
          status: 'हप्ता प्रलंबित',
          targetTab: 'rd-collection',
          entityId: n.entityID
        }))
      },
      {
        id: 'share-approval',
        titleMr: '४. भाग मंजुरी प्रलंबित',
        titleEn: '4. Share Approval',
        category: 'Members',
        icon: UserCheck,
        count: shareNotifs.length,
        totalAmount: shareNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'HIGH',
        badgeColor: 'bg-amber-50 text-amber-800 border border-amber-200',
        accentBg: 'bg-slate-50 text-slate-800',
        targetTab: 'share-master',
        items: shareNotifs.map(n => ({
          id: n.notificationID.toString(),
          memberName: n.title,
          details: n.description,
          amount: n.amount,
          status: 'संचालक मंडळ मंजुरी',
          targetTab: 'share-master'
        }))
      },
      {
        id: 'voucher-pending',
        titleMr: '५. वाउचर मंजुरी प्रलंबित',
        titleEn: '5. Voucher Pending',
        category: 'Accounts',
        icon: FileText,
        count: voucherNotifs.length,
        totalAmount: voucherNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'URGENT',
        badgeColor: 'bg-orange-50 text-orange-800 border border-orange-200',
        accentBg: 'bg-slate-50 text-slate-800',
        targetTab: 'voucher-posting',
        items: voucherNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `Vouch #${n.entityID}` : undefined,
          memberName: n.title,
          details: n.description,
          amount: n.amount,
          dueDate: 'आज',
          status: 'मेकर-चेकर पडताळणी',
          targetTab: 'voucher-posting',
          entityId: n.entityID
        }))
      },
      {
        id: 'pigmy-pending',
        titleMr: '६. पिग्मी संकलन प्रलंबित',
        titleEn: '6. Pigmy Pending',
        category: 'Pigmy',
        icon: Wallet,
        count: pigmyNotifs.length,
        totalAmount: pigmyNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'HIGH',
        badgeColor: 'bg-teal-50 text-teal-800 border border-teal-200',
        accentBg: 'bg-slate-50 text-slate-800',
        targetTab: 'pigmy-collection',
        items: pigmyNotifs.map(n => ({
          id: n.notificationID.toString(),
          memberName: n.title,
          details: n.description,
          amount: n.amount,
          dueDate: 'आज',
          status: 'सिंक प्रलंबित',
          targetTab: 'pigmy-collection'
        }))
      },
      {
        id: 'npa-alert',
        titleMr: '७. एन.पी.ए. इशारा (NPA Alert)',
        titleEn: '7. NPA Alert',
        category: 'Audit',
        icon: AlertTriangle,
        count: npaNotifs.length,
        totalAmount: npaNotifs.reduce((acc, item) => acc + (item.amount || 0), 0),
        priority: 'URGENT',
        badgeColor: 'bg-rose-50 text-rose-800 border border-rose-200',
        accentBg: 'bg-slate-50 text-slate-800',
        targetTab: 'npa-dashboard',
        items: npaNotifs.map(n => ({
          id: n.notificationID.toString(),
          accountNo: n.entityID ? `Loan #${n.entityID}` : undefined,
          memberName: n.title,
          details: n.description,
          amount: n.amount,
          status: 'प्रोव्हिजन / नोटीस',
          targetTab: 'npa-dashboard'
        }))
      },
      {
        id: 'day-end-alert',
        titleMr: '८. दिवस अखेर इशारा (Day End Alert)',
        titleEn: '8. Day End Alert',
        category: 'System',
        icon: Moon,
        count: systemNotifs.length,
        priority: 'HIGH',
        badgeColor: 'bg-purple-50 text-purple-800 border border-purple-200',
        accentBg: 'bg-slate-50 text-slate-800',
        targetTab: 'day-end',
        items: systemNotifs.map(n => ({
          id: n.notificationID.toString(),
          memberName: n.title,
          details: n.description,
          dueDate: 'आज संध्याकाळी',
          status: 'डे-एंड प्रलंबित',
          targetTab: 'day-end'
        }))
      }
    ];
  };

  const taskSections = buildTaskSections();

  const filteredSections = taskSections.filter((section) => {
    if (selectedFilter === 'URGENT') return section.priority === 'URGENT';
    if (selectedFilter === 'HIGH') return section.priority === 'HIGH' || section.priority === 'URGENT';
    return true;
  });

  const handleCardClick = (targetTab: string) => {
    if (onNavigate) {
      onNavigate(targetTab);
    }
  };

  const fmtCurrency = (val?: number) => {
    if (!val || val === 0) return null;
    return `₹ ${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="p-2 max-w-full h-full flex flex-col bg-slate-100 text-[11px] font-sans relative overflow-y-auto">
      
      {/* Outer Container matching System Masters */}
      <div className="bg-white rounded-md shadow-xs border border-slate-300 overflow-hidden flex flex-col">

        {/* Hero Header Banner using Primary Theme Color */}
        <div className="bg-primary text-white px-3 py-2 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-sky-200" />
            <h2 className="text-xs font-bold tracking-wide flex items-center gap-2 text-white">
              <span>आजची कामे डॅशबोर्ड (Live System Tasks)</span>
            </h2>
            <span className="bg-white/20 text-white border border-white/30 text-[10px] font-bold px-2 py-0.2 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              डेटाबेस लाईव्ह
            </span>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchLiveNotifications(); fetchAutoRenewalData(); }}
              disabled={loading}
              className="px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition-all flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>रीफ्रेश</span>
            </button>

            <div className="inline-flex rounded bg-white/10 p-0.5 border border-white/20 text-xs font-medium">
              <button
                onClick={() => setSelectedFilter('ALL')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer text-[11px] ${
                  selectedFilter === 'ALL'
                    ? 'bg-white text-primary font-bold shadow-2xs'
                    : 'text-slate-100 hover:text-white'
                }`}
              >
                सर्व (All)
              </button>
              <button
                onClick={() => setSelectedFilter('URGENT')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer text-[11px] ${
                  selectedFilter === 'URGENT'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-slate-100 hover:text-rose-200'
                }`}
              >
                अति तातडीचे
              </button>
              <button
                onClick={() => setSelectedFilter('HIGH')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer text-[11px] ${
                  selectedFilter === 'HIGH'
                    ? 'bg-amber-500 text-white font-bold'
                    : 'text-slate-100 hover:text-amber-200'
                }`}
              >
                महत्त्वाचे
              </button>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-2.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white border border-white/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>सूचना विंडो</span>
            </button>
          </div>
        </div>

        {/* Dashboard Body */}
        <div className="p-3 bg-slate-50/60">

          {/* 🔄 CBS FD Auto-Renewal Action Banner */}
          <div className="mb-3 bg-gradient-to-r from-sky-950 via-sky-900 to-indigo-950 text-white rounded-md p-2.5 shadow-sm border border-sky-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shadow-2xs">
                <RotateCcw className={`w-4 h-4 ${runningBatch ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black tracking-wide text-white flex items-center gap-1.5">
                    <span>मुदत ठेव स्वयंचलित नूतनीकरण (CBS FD Auto-Renewal Center)</span>
                  </h3>
                  <span className="bg-sky-400/20 text-sky-200 border border-sky-300/30 text-[9px] font-bold px-2 py-0.2 rounded-full">
                    आरबीआय १४-दिवसीय सवलत लागू
                  </span>
                </div>
                <div className="text-[10px] text-sky-100 flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>पात्र खाती: <strong className="text-amber-300 font-bold">{autoRenewalCandidates.length} पावत्या</strong></span>
                  <span>•</span>
                  <span>एकूण नूतनीकरण रक्कम: <strong className="text-emerald-300 font-bold">₹ {autoRenewalCandidates.reduce((acc, c) => acc + (c.projectedRenewedAmount || c.depositAmount || 0), 0).toLocaleString('en-IN')}</strong></span>
                  <span>•</span>
                  <span className="text-[9px] text-sky-200">प्रचलित स्लॅब दर स्वयंचलित लागू</span>
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

          {/* Main 8 Task Cards Grid - 4 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredSections.map((section) => {
              const IconComponent = section.icon;
              return (
                <div
                  key={section.id}
                  className="bg-white rounded-md border border-slate-300 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:border-primary/70"
                >
                  {/* Card Header using Primary Theme Color */}
                  <div className="bg-primary text-white px-3 py-2 flex justify-between items-center shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-white/15 text-white">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs leading-tight text-white">
                          {section.titleMr}
                        </h3>
                        <span className="text-[9px] text-sky-100 block font-medium">
                          {section.titleEn}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 whitespace-nowrap">
                      {section.count} नोंदी
                    </span>
                  </div>

                  {/* Card Body - Clean Light Design */}
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

                      {/* Compact Items List */}
                      <div className="space-y-1.5 mb-2">
                        {section.items.length === 0 ? (
                          <div className="p-2 text-center text-[10px] text-slate-400 font-medium bg-slate-50 rounded border border-dashed border-slate-200">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mx-auto mb-0.5 opacity-70" />
                            कोणतीही प्रलंबित नोंद नाही
                          </div>
                        ) : (
                          <>
                            {section.items.slice(0, 2).map((item) => (
                              <div
                                key={item.id}
                                className="p-1.5 rounded bg-slate-50/80 border border-slate-200 hover:border-primary/40 transition-all text-xs flex flex-col justify-between"
                              >
                                <div className="flex justify-between items-center font-semibold text-slate-800 mb-1 text-[11px]">
                                  <span className="truncate max-w-[130px]" title={item.memberName}>
                                    👤 {item.memberName}
                                  </span>
                                  {item.amount && (
                                    <span className="text-primary font-bold text-[10px] bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200 shrink-0">
                                      ₹{item.amount.toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>

                                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                                  {item.accountNo ? (
                                    <span className="font-mono text-slate-700 bg-white px-1 py-0.2 rounded border border-slate-200 text-[9px]">
                                      {item.accountNo}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[9px]">{item.status}</span>
                                  )}
                                  
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedItemDetails(item);
                                    }}
                                    className="px-1.5 py-0.2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[9px] font-medium transition-all flex items-center gap-0.5 cursor-pointer ml-auto shadow-2xs"
                                    title="सर्व तपशील पहा"
                                  >
                                    <Eye className="w-3 h-3 text-slate-500" />
                                    <span>तपशील</span>
                                  </button>
                                </div>
                              </div>
                            ))}

                            {section.items.length > 2 && (
                              <div className="text-center py-0.5 bg-sky-50 border border-sky-100 rounded text-[9px] font-semibold text-primary">
                                + {section.items.length - 2} आणखी नोंदी
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action Button using Primary Theme Color */}
                    <button
                      onClick={() => handleCardClick(section.targetTab)}
                      className="w-full py-1.5 px-2 bg-primary hover:bg-[#004a75] text-white text-[11px] font-bold rounded-xs flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer"
                    >
                      <span>तपासा / कारवाई करा (Action)</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FULL MEMBER DETAILS POPUP MODAL */}
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
                  <p className="text-[10px] text-sky-100">Complete Member & Task Details</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItemDetails(null)}
                className="p-1 rounded-full hover:bg-white/10 text-slate-200 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 bg-slate-50/50 text-xs">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">सभासदाचे नाव (Member Name):</span>
                  <span className="font-bold text-slate-800 text-xs">👤 {selectedItemDetails.memberName}</span>
                </div>

                {selectedItemDetails.accountNo && (
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">खाते / पावती क्र. (Account No):</span>
                    <span className="font-mono text-primary font-bold bg-sky-50 border border-sky-200 px-2 py-0.5 rounded text-[11px]">
                      {selectedItemDetails.accountNo}
                    </span>
                  </div>
                )}

                {selectedItemDetails.amount && (
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">थकीत / एकूण रक्कम (Amount):</span>
                    <span className="font-extrabold text-primary text-xs">
                      ₹ {selectedItemDetails.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

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
                  संपूर्ण वर्णन (Full Description & Mobile):
                </span>
                <p className="text-slate-600 leading-relaxed text-xs">
                  {selectedItemDetails.details}
                </p>
              </div>
            </div>

            <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => setSelectedItemDetails(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs border border-slate-300"
              >
                बंद करा (Close)
              </button>
              <button
                onClick={() => {
                  const targetTab = selectedItemDetails.targetTab || 'loan-collection';
                  const entityId = selectedItemDetails.entityId;
                  setSelectedItemDetails(null);
                  if (onNavigate) onNavigate(targetTab, entityId ? { entityId } : undefined);
                }}
                className="px-4 py-1.5 bg-primary hover:bg-[#004a75] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs"
              >
                <span>थेट नोंदणी करा (Action)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AFTER LOGIN NOTIFICATION POPUP MODAL */}
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
                    लॉगिन यशस्वी झाले. डेटाबेसमधील लाईव्ह प्रलंबित कामांची नोंद घ्या.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  if (onCloseLoginModal) onCloseLoginModal();
                }}
                className="p-1 rounded-full hover:bg-white/10 text-slate-200 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-start gap-3 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">महत्त्वाची टीप:</span> आजच्या व्यवहारापूर्वी
                  कर्ज वसुली, वाउचर मंजुरी, एन.पी.ए. व दिवस अखेर इशारा तपासून घ्या.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {taskSections.map((sec) => {
                  const SecIcon = sec.icon;
                  return (
                    <div
                      key={sec.id}
                      onClick={() => {
                        setIsModalOpen(false);
                        handleCardClick(sec.targetTab);
                      }}
                      className="p-3 rounded-xl bg-white border border-slate-200 hover:border-primary hover:bg-sky-50/30 transition-all cursor-pointer flex justify-between items-center group shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-primary/10 text-slate-600 group-hover:text-primary transition-colors">
                          <SecIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-800 group-hover:text-primary transition-colors">
                            {sec.titleMr}
                          </div>
                          <div className="text-[10px] text-slate-500">{sec.count} प्रलंबित नोंदी</div>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
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
                onClick={() => {
                  setIsModalOpen(false);
                  if (onCloseLoginModal) onCloseLoginModal();
                }}
                className="px-4 py-1.5 bg-primary hover:bg-[#004a75] text-white font-semibold text-xs rounded-lg shadow-2xs transition-all"
              >
                डॅशबोर्ड पहा (View Dashboard)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================
          1. CANDIDATE LIST MODAL (पात्र मुदत ठेव यादी)
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
                      {autoRenewalCandidates.map((c) => (
                        <tr key={c.fdAccountID} className="hover:bg-sky-50/50 transition-colors">
                          <td className="p-2 font-mono font-bold text-primary text-xs">
                            {c.accountNo}
                          </td>
                          <td className="p-2">
                            <div className="font-bold text-slate-800">{c.customerName}</div>
                            {c.contactNo && <div className="text-[9px] text-slate-400">📱 {c.contactNo}</div>}
                            {c.hasActiveLoan && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[9px] font-bold">
                                ⚠️ सक्रिय कर्ज: ₹ {c.activeLoanBalance.toLocaleString('en-IN')}
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
                एकूण पात्र खाती: <strong>{autoRenewalCandidates.length}</strong> | एकूण रक्कम: <strong>₹ {autoRenewalCandidates.reduce((acc, c) => acc + (c.projectedRenewedAmount || c.depositAmount || 0), 0).toLocaleString('en-IN')}</strong>
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
          2. BATCH RESULT SUMMARY MODAL
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
                  <div className="text-xs font-black text-sky-900">₹ {Number(batchResult.totalRenewedAmount || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {batchResult.items && batchResult.items.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded bg-white p-2 divide-y divide-slate-100 text-[11px]">
                  {batchResult.items.map((it: any, idx: number) => (
                    <div key={idx} className="py-1.5 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-800">
                          {it.oldAccountNo} ➜ <span className="text-primary font-mono">{it.newAccountNo || '-'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{it.customerName}</div>
                        {it.errorMessage && (
                          <div className="text-[10px] text-rose-600 font-semibold mt-0.5">⚠️ {it.errorMessage}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${it.status === 'Success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {it.status === 'Success' ? 'यशस्वी' : 'त्रुटी'}
                        </span>
                        {it.renewedAmount > 0 && (
                          <div className="text-[10px] font-bold text-slate-700 mt-0.5">₹ {it.renewedAmount.toLocaleString('en-IN')}</div>
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
          3. LOGS & 14-DAY REVERSAL MODAL
         ======================================================== */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] shadow-2xl border border-slate-300 flex flex-col overflow-hidden">
            <div className="p-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-sky-300" />
                <div>
                  <h3 className="font-bold text-xs text-white">स्वयंचलित नूतनीकरण ऑडिट इतिहास व १४-दिवसीय रिव्हर्सल</h3>
                  <p className="text-[10px] text-slate-300">आरबीआय मार्गदर्शक तत्त्वांनुसार १४ दिवसांत विनामूल्य रिव्हर्ट करण्याची सुविधा</p>
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
                        const daysAgo = Math.floor((new Date().getTime() - batchDate.getTime()) / (1000 * 3600 * 24));
                        const isEligibleForGraceReversal = !l.isReverted && daysAgo <= 14 && l.status === 'Success';

                        return (
                          <tr key={l.logID} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2 text-slate-600 font-mono text-[10px]">
                              {batchDate.toLocaleDateString('en-GB')}
                            </td>
                            <td className="p-2 font-mono text-[10px]">
                              <span className="text-slate-600">{l.oldAccountNo}</span> ➜ <strong className="text-primary">{l.newAccountNo}</strong>
                            </td>
                            <td className="p-2 font-semibold text-slate-800">
                              {l.customerName}
                            </td>
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
                                <span className="text-[9px] text-slate-400 italic" title={l.revertReason}>
                                  {l.revertReason ? `कारण: ${l.revertReason.substring(0, 20)}...` : 'पूर्ववत केले'}
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
          4. REVERT CONFIRMATION DIALOG (१४-दिवसीय रिव्हर्सल कारण)
         ======================================================== */}
      {showRevertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-rose-300 overflow-hidden">
            <div className="p-3 bg-rose-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-200" />
                <h3 className="font-bold text-xs text-white">१४-दिवसीय सवलतीत नूतनीकरण रद्द (Reversal)</h3>
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
                ⚠️ <strong>बँकिंग प्रक्रिया माहिती:</strong> नवीन पावती क्र. <strong>{showRevertDialog.newAccountNo}</strong> रद्द होईल, अकाउंटिंग व्हाउचर उलट (Reverse) होईल, आणि मूळ पावती क्र. <strong>{showRevertDialog.oldAccountNo}</strong> मुदतपूर्ण (Matured) म्हणून पूर्ववत केली जाईल जेणेकरून खातेदार संपूर्ण रक्कम विनादंड काढू शकेल.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  नूतनीकरण रद्द करण्याचे वैधानिक कारण (Revert Reason) *
                </label>
                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
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
