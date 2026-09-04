import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Bell,
  CheckCircle,
  X,
  CreditCard,
  Building2,
  Calendar,
  UserCheck,
  FileText,
  Wallet,
  AlertTriangle,
  Moon,
  ChevronRight,
  Filter,
  RefreshCw,
  Info
} from 'lucide-react';

interface NotificationItem {
  notificationID: number;
  branchID: number;
  moduleName: string;
  notificationType: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  targetTab: string;
  entityName?: string;
  entityID?: string;
  amount?: number;
  dueDate?: string;
  status: string;
  createdOn: string;
}

interface NotificationCenterProps {
  onNavigate?: (tab: string, params?: any) => void;
  branchId?: number;
}

export default function NotificationCenter({ onNavigate, branchId = 1 }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const [listRes, countRes] = await Promise.all([
        axios.get(`/api/Notification`, {
          params: { branchId, module: selectedModule, priority: selectedPriority, status: 'Active' }
        }).catch(() => ({ data: [] })),
        axios.get(`/api/Notification/module-counts`, { params: { branchId } }).catch(() => ({ data: {} }))
      ]);
      setNotifications(Array.isArray(listRes.data) ? listRes.data : []);
      setCounts(typeof countRes.data === 'object' && countRes.data !== null ? countRes.data : {});
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [branchId, selectedModule, selectedPriority]);

  const handleGenerateAuto = async () => {
    try {
      setGenerating(true);
      await axios.post(`/api/Notification/generate?branchId=${branchId}`);
      await fetchNotifications();
    } catch (err) {
      console.error("Error generating notifications:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await axios.post(`/api/Notification/${id}/complete`);
      setNotifications(prev => prev.filter(n => n.notificationID !== id));
      fetchNotifications();
    } catch (err) {
      console.error("Error completing notification:", err);
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    setIsOpen(false);
    if (onNavigate && item.targetTab) {
      onNavigate(item.targetTab, item.entityID ? { entityId: item.entityID } : undefined);
    }
  };

  const getModuleIcon = (moduleName: string) => {
    switch (moduleName) {
      case 'Loans': return CreditCard;
      case 'FD': return Building2;
      case 'RD': return Calendar;
      case 'Shares': return UserCheck;
      case 'Vouchers': return FileText;
      case 'Pigmy': return Wallet;
      case 'NPA': return AlertTriangle;
      default: return Moon;
    }
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'HIGH') {
      return <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">अति तातडीचे (High)</span>;
    }
    if (priority === 'MEDIUM') {
      return <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">महत्त्वाचे (Medium)</span>;
    }
    return <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">सामान्य (Low)</span>;
  };

  const totalActive = counts['ALL'] || 0;

  return (
    <div className="relative inline-block text-left">
      {/* Top Bar Notification Bell Trigger */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-xl transition-all border border-slate-200 shadow-2xs focus:outline-none"
        title="सूचना केंद्र (Notification Center)"
      >
        <Bell className="w-5 h-5" />
        {totalActive > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
            {totalActive > 99 ? '99+' : totalActive}
          </span>
        )}
      </button>

      {/* Dropdown Popover Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-slide-in-right">
            {/* Drawer Header */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/20 rounded-xl border border-primary/40">
                  <Bell className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">सूचना केंद्र (Notification Engine)</h3>
                  <p className="text-[11px] text-slate-400">प्रलंबित कामे व स्वयंचलित सूचना अलार्म</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateAuto}
                  disabled={generating}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition text-xs flex items-center gap-1"
                  title="ऑटो जनरेट करा"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
              {/* Priority Filters */}
              <div className="flex gap-1 overflow-x-auto text-[11px] font-medium pb-1">
                <button
                  onClick={() => setSelectedPriority('ALL')}
                  className={`px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                    selectedPriority === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  सर्व (All)
                </button>
                <button
                  onClick={() => setSelectedPriority('HIGH')}
                  className={`px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                    selectedPriority === 'HIGH' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200'
                  }`}
                >
                  🔴 तातडीचे
                </button>
                <button
                  onClick={() => setSelectedPriority('MEDIUM')}
                  className={`px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                    selectedPriority === 'MEDIUM' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-800 border-amber-200'
                  }`}
                >
                  🟡 महत्त्वाचे
                </button>
              </div>

              {/* Module Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto text-[10px] font-semibold">
                {['ALL', 'Loans', 'FD', 'RD', 'Vouchers', 'NPA', 'System'].map(mod => (
                  <button
                    key={mod}
                    onClick={() => setSelectedModule(mod)}
                    className={`px-2 py-0.5 rounded-md transition ${
                      selectedModule === mod
                        ? 'bg-primary text-white font-bold'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {mod} {counts[mod] ? `(${counts[mod]})` : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification List Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {loading ? (
                <div className="flex items-center justify-center p-8 text-xs text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2 text-primary" />
                  सूचना लोड होत आहेत...
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center p-8 text-slate-500 text-xs">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-slate-700">कोणतीही प्रलंबित सूचना नाही.</p>
                  <p className="text-[11px] text-slate-400 mt-1">सर्व कामे पूर्ण झालेली आहेत.</p>
                </div>
              ) : (
                notifications.map(item => {
                  const Icon = getModuleIcon(item.moduleName);
                  return (
                    <div
                      key={item.notificationID}
                      onClick={() => handleNotificationClick(item)}
                      className="p-3 bg-white rounded-2xl border border-slate-200 hover:border-primary hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-100 rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors text-slate-700">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-xs text-slate-900 group-hover:text-primary transition-colors">
                            {item.title}
                          </span>
                        </div>
                        {getPriorityBadge(item.priority)}
                      </div>

                      <p className="text-xs text-slate-600 mb-2 pl-7 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex justify-between items-center pl-7 pt-1 border-t border-slate-100 text-[11px]">
                        {item.amount && (
                          <span className="font-bold text-slate-900">
                            ₹{item.amount.toLocaleString('en-IN')}
                          </span>
                        )}
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={(e) => handleComplete(e, item.notificationID)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-lg font-semibold text-[10px] transition-all flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            पूर्ण झाले (Done)
                          </button>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <span>एकूण प्रलंबित: <strong>{totalActive}</strong></span>
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-xl text-xs"
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
