import React, { useState, useEffect } from 'react';
import BankLedgerSelect from './common/BankLedgerSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';

interface Agent {
  pigmyAgentID: number;
  agentName: string;
  agentCode?: string;
  mobileNo?: string;
}

interface RemittanceItem {
  depositId: number;
  receiptNo: string;
  depositDate: string;
  collectionDateFrom?: string;
  collectionDateTo?: string;
  amount: number;
  paymentMode?: string;
  narration: string;
  voucherId?: number;
  voucherNo?: string;
}

interface DayBreakupItem {
  date: string;
  count: number;
  amount: number;
  remittedAmount?: number;
  pendingAmount?: number;
  isRemitted?: boolean;
}

interface PigmySchemeBreakupItem {
  pigmySchemeID: number;
  schemeCode: string;
  schemeName: string;
  liabilityLedgerID?: number;
  liabilityLedgerName: string;
  accountsCount: number;
  collectionsCount: number;
  collectedAmount: number;
  remittedAmount: number;
  pendingAmount: number;
}

interface DayCollectionItem {
  collectionId: number;
  receiptNo: string;
  collectionDate: string;
  collectionAmount: number;
  collectionSource: string;
  paymentMode: string;
  openingBalance: number;
  closingBalance: number;
  accountId: number;
  accountNo: string;
  legacyAccountNumber: string;
  pigmySchemeID?: number;
  schemeCode?: string;
  schemeName?: string;
  customerName: string;
  mobileNo: string;
  voucherId?: number;
  isVoucherGenerated: boolean;
}

interface DayBookSummary {
  openingBalance: number;
  todaysCollection: number;
  cashDeposited: number;
  closingBalance: number;
  collectionDateFrom?: string;
  collectionDateTo?: string;
  depositDate?: string;
  rangeCollectionAmount?: number;
  rangeCollectionCount?: number;
  rangeTotalCollected?: number;
  rangeAlreadyRemitted?: number;
  isFullyRemitted?: boolean;
  totalPendingCash?: number;
  activeSchemesCount?: number;
  schemeBreakup?: PigmySchemeBreakupItem[];
  dayBreakup?: DayBreakupItem[];
  recentRemittances: RemittanceItem[];
}

interface AgentDayBookMasterProps {
  voucherId?: number;
  isPassingMode?: boolean;
  onNavigate?: (tab: string, subTab?: string) => void;
}

const AgentDayBookMaster: React.FC<AgentDayBookMasterProps> = ({ voucherId: propVoucherId, isPassingMode: propIsPassingMode, onNavigate }) => {
  const queryParams = new URLSearchParams(window.location.search);
  const voucherId = propVoucherId || (queryParams.get('voucherId') ? parseInt(queryParams.get('voucherId')!, 10) : undefined);
  const isPassingMode = propIsPassingMode ?? (queryParams.get('passingMode') === 'true');

  const [passingVoucherData, setPassingVoucherData] = useState<any>(null);
  const [passingLoading, setPassingLoading] = useState<boolean>(false);
  const [passingActionLoading, setPassingActionLoading] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | ''>('');
  const [fallbackPigmySchemeId, setFallbackPigmySchemeId] = useState<number | ''>('');
  
  // 3-Date States
  const todayStr = getBusinessDateStr(user?.businessDate);
  const [collectionDateFrom, setCollectionDateFrom] = useState<string>(todayStr);
  const [collectionDateTo, setCollectionDateTo] = useState<string>(todayStr);
  const [depositDate, setDepositDate] = useState<string>(todayStr);

  useEffect(() => {
    if (!isPassingMode) {
      const bStr = getBusinessDateStr(user?.businessDate);
      setDepositDate(bStr);
      setCollectionDateFrom(bStr);
      setCollectionDateTo(bStr);
    }
  }, [user?.businessDate, isPassingMode]);

  const [summary, setSummary] = useState<DayBookSummary | null>(null);

  const [depositAmount, setDepositAmount] = useState<number | ''>('');
  const [autoFilledFromExcel, setAutoFilledFromExcel] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [bankLedgerId, setBankLedgerId] = useState<number>(0);
  const [narration, setNarration] = useState('');
  const [message, setMessage] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<RemittanceItem | null>(null);
  const [deletingDepositId, setDeletingDepositId] = useState<number | null>(null);

  // Day Details Modal States
  const [showDayDetailsModal, setShowDayDetailsModal] = useState<boolean>(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState<DayBreakupItem | null>(null);
  const [dayCollections, setDayCollections] = useState<DayCollectionItem[]>([]);
  const [loadingDayCollections, setLoadingDayCollections] = useState<boolean>(false);

  const handleViewDayDetails = async (day: DayBreakupItem) => {
    if (!selectedAgentId) return;
    setSelectedDayInfo(day);
    setShowDayDetailsModal(true);
    setLoadingDayCollections(true);
    try {
      const dateStr = day.date.split('T')[0];
      const res = await fetch(`/api/AgentDayBook/DayCollections?agentId=${selectedAgentId}&date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDayCollections(data);
        } else if (data && Array.isArray(data.collections)) {
          setDayCollections(data.collections);
        } else {
          setDayCollections([]);
        }
      } else {
        alert('पावत्या आणताना त्रुटी आली.');
      }
    } catch (err) {
      console.error('Error fetching day collections:', err);
      alert('सर्व्हरशी संपर्क होऊ शकला नाही.');
    } finally {
      setLoadingDayCollections(false);
    }
  };

  const loadPassingVoucher = async (vId: number) => {
    setPassingLoading(true);
    try {
      const res = await fetch(`/api/AgentDayBook/by-voucher/${vId}`);
      if (res.ok) {
        const data = await res.json();
        setPassingVoucherData(data.voucher);

        if (data.agent) {
          setSelectedAgentId(data.agent.pigmyAgentID);
        }
        if (data.deposit) {
          setDepositAmount(data.deposit.amount);
          setPaymentMode(data.deposit.paymentMode || 'CASH');
          if (data.deposit.bankLedgerId) {
            setBankLedgerId(Number(data.deposit.bankLedgerId));
          }
          if (data.deposit.depositDate) {
            setDepositDate(data.deposit.depositDate.split('T')[0]);
          }
          setNarration(data.deposit.narration || '');
        }
        if (data.denominations) {
          setDenominations({
            500: data.denominations.count500 || 0,
            200: data.denominations.count200 || 0,
            100: data.denominations.count100 || 0,
            50: data.denominations.count50 || 0,
            20: data.denominations.count20 || 0,
            10: data.denominations.count10 || 0,
            5: data.denominations.count5 || 0,
            coins: data.denominations.countCoins || 0
          });
        }
      } else {
        alert('व्हाउचर माहिती लोड करताना त्रुटी आली.');
      }
    } catch (err: any) {
      console.error('Error loading Agent Daybook voucher:', err);
      alert('व्हाउचर लोड करताना त्रुटी: ' + err.message);
    } finally {
      setPassingLoading(false);
    }
  };

  const handlePassVoucher = async () => {
    if (!voucherId) return;
    if (!window.confirm('आपण खात्रीपूर्वक हे एजंट भरणा व्हाउचर मंजूर व पास करू इच्छिता?')) return;
    setPassingActionLoading(true);
    try {
      const res = await fetch('/api/VoucherPosting/Post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherIds: [voucherId], approvedBy: 1 })
      });
      if (res.ok) {
        alert('व्हाउचर यशस्वीरीत्या मंजूर व पास करण्यात आले!');
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        const errText = await res.text();
        alert('व्हाउचर पास करताना त्रुटी: ' + errText);
      }
    } catch (err: any) {
      alert('व्हाउचर पास करताना नेटवर्क त्रुटी: ' + err.message);
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
      const res = await fetch(`/api/VoucherPosting/${voucherId}?reason=${encodeURIComponent(rejectReason)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('व्हाउचर यशस्वीरित्या नामंजूर / रद्द करण्यात आले!');
        setRejectModalOpen(false);
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        const errText = await res.text();
        alert('व्हाउचर रद्द करताना त्रुटी: ' + errText);
      }
    } catch (err: any) {
      alert('व्हाउचर रद्द करताना नेटवर्क त्रुटी: ' + err.message);
    } finally {
      setPassingActionLoading(false);
    }
  };

  // Cash Denominations State
  const [showDenomGrid, setShowDenomGrid] = useState<boolean>(true);
  const [denominations, setDenominations] = useState<{ [key: string]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    coins: 0
  });

  const handleDenomChange = (denom: string, countStr: string) => {
    const count = parseInt(countStr) || 0;
    setDenominations(prev => {
      const updated = { ...prev, [denom]: Math.max(0, count) };
      return updated;
    });
  };

  const totalDenominationAmount = 
    (denominations[500] || 0) * 500 +
    (denominations[200] || 0) * 200 +
    (denominations[100] || 0) * 100 +
    (denominations[50] || 0) * 50 +
    (denominations[20] || 0) * 20 +
    (denominations[10] || 0) * 10 +
    (denominations[5] || 0) * 5 +
    (denominations.coins || 0);

  const applyDenomToDepositAmount = () => {
    if (totalDenominationAmount > 0) {
      setDepositAmount(totalDenominationAmount);
    }
  };

  const applyRangeAmountToDeposit = () => {
    if (summary && summary.rangeCollectionAmount !== undefined && summary.rangeCollectionAmount > 0) {
      setDepositAmount(summary.rangeCollectionAmount);
    }
  };

  const resetDenominations = () => {
    setDenominations({
      500: 0,
      200: 0,
      100: 0,
      50: 0,
      20: 0,
      10: 0,
      5: 0,
      coins: 0
    });
  };

  useEffect(() => {
    fetch('/api/PigmySchemes')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setSchemes(Array.isArray(data) ? data : []))
      .catch(() => setSchemes([]));

    fetch('/api/PigmyAgents')
      .then((res) => res.json())
      .then((data) => {
        setAgents(data);
        // Check for remittance transfer bridge from Excel Import
        try {
          const rawBridge = sessionStorage.getItem('cbs_agent_remittance_bridge');
          const qp = new URLSearchParams(window.location.search);
          const qpAgent = qp.get('agentId');
          const qpFrom = qp.get('fromDate');
          const qpTo = qp.get('toDate');
          const qpAmount = qp.get('amount');

          if (rawBridge) {
            sessionStorage.removeItem('cbs_agent_remittance_bridge');
            const b = JSON.parse(rawBridge);
            if (b.agentId) setSelectedAgentId(Number(b.agentId));
            if (b.fromDate) setCollectionDateFrom(b.fromDate);
            if (b.toDate) setCollectionDateTo(b.toDate);
            if (b.amount && Number(b.amount) > 0) {
              setDepositAmount(Number(b.amount));
              setAutoFilledFromExcel(true);
            }
          } else if (qpAgent) {
            setSelectedAgentId(Number(qpAgent));
            if (qpFrom) setCollectionDateFrom(qpFrom);
            if (qpTo) setCollectionDateTo(qpTo);
            if (qpAmount && Number(qpAmount) > 0) {
              setDepositAmount(Number(qpAmount));
              setAutoFilledFromExcel(true);
            }
          } else if (data.length > 0) {
            setSelectedAgentId(data[0].pigmyAgentID);
          }
        } catch {
          if (data.length > 0) {
            setSelectedAgentId(data[0].pigmyAgentID);
          }
        }
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedAgentId && collectionDateFrom && collectionDateTo && depositDate) {
      fetchSummary();
    }
  }, [selectedAgentId, collectionDateFrom, collectionDateTo, depositDate]);

  useEffect(() => {
    if (voucherId) {
      loadPassingVoucher(voucherId);
    }
  }, [voucherId]);

  const fetchSummary = async () => {
    if (!selectedAgentId || !collectionDateFrom || !collectionDateTo || !depositDate) return;
    try {
      const res = await fetch(
        `/api/AgentDayBook/Summary/${selectedAgentId}?fromDate=${collectionDateFrom}&toDate=${collectionDateTo}&depositDate=${depositDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
        setMessage('');

        // ⚡ AUTO-FILL: If depositAmount is empty, zero, or was previously auto-filled, set it to the unremitted collection amount from Excel
        if (data.rangeCollectionAmount !== undefined && data.rangeCollectionAmount > 0) {
          setDepositAmount(prev => (prev === '' || prev === 0 || autoFilledFromExcel ? data.rangeCollectionAmount : prev));
          setAutoFilledFromExcel(true);
        } else if (data.totalPendingCash !== undefined && data.totalPendingCash > 0) {
          setDepositAmount(prev => (prev === '' || prev === 0 || autoFilledFromExcel ? data.totalPendingCash : prev));
          setAutoFilledFromExcel(true);
        }
      } else {
        setMessage('डे बुक माहिती लोड करताना त्रुटी आली.');
      }
    } catch (err) {
      console.error(err);
      setMessage('सर्व्हरशी संपर्क साधता आला नाही.');
    }
  };

  const clearForm = () => {
    setDepositAmount('');
    setAutoFilledFromExcel(false);
    setFallbackPigmySchemeId('');
    setNarration('');
    setPaymentMode('CASH');
    setBankLedgerId(0);
    resetDenominations();
    const bStr = getBusinessDateStr(user?.businessDate);
    setCollectionDateFrom(bStr);
    setCollectionDateTo(bStr);
    setDepositDate(bStr);
  };

  const handleDeposit = async () => {
    if (!selectedAgentId || !depositAmount) return;

    if (new Date(collectionDateFrom) > new Date(collectionDateTo)) {
      setMessage('त्रुटी: संकलन सुरू दिनांक (From) ही संकलन शेवट दिनांक (To) पेक्षा मोठी असू शकत नाही.');
      return;
    }

    if (paymentMode !== 'CASH' && (!bankLedgerId || bankLedgerId <= 0)) {
      setMessage('त्रुटी: बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.');
      return;
    }

    if (paymentMode === 'CASH' && totalDenominationAmount > 0 && totalDenominationAmount !== Number(depositAmount)) {
      setMessage(`त्रुटी: नोटांची एकूण मोजणी (₹${totalDenominationAmount.toLocaleString('en-IN')}) आणि भरणा रक्कम (₹${Number(depositAmount).toLocaleString('en-IN')}) तंतोतंत जुळली पाहिजे.`);
      return;
    }

    try {
      const payload: any = {
        agentId: Number(selectedAgentId),
        collectionDateFrom: collectionDateFrom,
        collectionDateTo: collectionDateTo,
        depositDate: depositDate,
        amount: Number(depositAmount),
        paymentMode: paymentMode,
        bankLedgerId: paymentMode !== 'CASH' ? bankLedgerId : null,
        fallbackPigmySchemeId: fallbackPigmySchemeId ? Number(fallbackPigmySchemeId) : null,
        narration: narration,
        branchId: user?.branchID || 1
      };

      if (paymentMode === 'CASH' && totalDenominationAmount > 0) {
        payload.count500 = denominations[500] || 0;
        payload.count200 = denominations[200] || 0;
        payload.count100 = denominations[100] || 0;
        payload.count50 = denominations[50] || 0;
        payload.count20 = denominations[20] || 0;
        payload.count10 = denominations[10] || 0;
        payload.count5 = denominations[5] || 0;
        payload.countCoins = denominations.coins || 0;
      }

      const res = await fetch('/api/AgentDayBook/DepositCash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`यशस्वी! पावती क्र: ${data.receiptNo} | मोड: ${paymentMode} | व्हाउचर क्र: ${data.voucherNo}`);
        clearForm(); // Clear the form completely
        fetchSummary(); // Refresh balances and history
      } else {
        const errText = await res.text();
        setMessage(`त्रुटी: ${errText}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('भरणा करताना नेटवर्क त्रुटी आली.');
    }
  };

  const handleDeleteDeposit = async (depositId: number, receiptNo: string) => {
    if (!window.confirm(`तुम्हाला भरणा पावती क्र. ${receiptNo} खरोखर डिलीट / रद्द करायची आहे का?\n\nही नोंद डिलीट केल्यावर या पावतीचे संकलन पुन्हा डे बुकमध्ये भरण्यासाठी उपलब्ध होईल.`)) {
      return;
    }

    setDeletingDepositId(depositId);
    try {
      const res = await fetch(`/api/AgentDayBook/Deposit/${depositId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message || 'भरणा पावती यशस्वीरीत्या डिलीट करण्यात आली.');
        await fetchSummary();
      } else {
        const errText = await res.text();
        alert('भरणा पावती डिलीट करताना त्रुटी आली: ' + errText);
      }
    } catch (err: any) {
      console.error('Error deleting deposit:', err);
      alert('सर्व्हरशी संपर्क साधताना त्रुटी: ' + err.message);
    } finally {
      setDeletingDepositId(null);
    }
  };

  const selectedAgentObj = agents.find(a => a.pigmyAgentID === Number(selectedAgentId));

  const getModeLabel = (mode?: string) => {
    switch (mode?.toUpperCase()) {
      case 'ONLINE': return '💳 ऑनलाईन';
      case 'UPI': return '📱 युपीआय';
      case 'CHEQUE': return '📜 चेक';
      default: return '💵 रोख (Cash)';
    }
  };

  return (
    <div
      className="p-2.5 sm:p-3.5 w-full min-h-full font-sans text-xs"
      style={{
        background:
          'linear-gradient(135deg, #eef2ff 0%, #f8fbff 45%, #e0f2fe 100%)',
      }}
    >
      <div className="max-w-[1680px] mx-auto space-y-3">
      {/* Passing Mode Banner */}
      {isPassingMode && (
        <div className="bg-amber-500 text-white p-3 rounded-xl shadow flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-sm">व्हाउचर तपासणी व पासिंग मोड (Checker Inspection Mode)</p>
              <p className="text-xs text-amber-100">
                व्हाउचर क्र: <span className="font-mono font-bold text-white">{passingVoucherData?.voucherNo || voucherId}</span> | 
                रक्कम: <span className="font-bold text-white">₹{passingVoucherData?.totalAmount?.toLocaleString('en-IN') || depositAmount}</span> | 
                स्थिती: <span className="font-bold text-white">{passingVoucherData?.status || 'तपासणीसाठी प्रलंबित'}</span>
                {passingVoucherData?.narration && ` | तपशील: ${passingVoucherData.narration}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting')}
              className="px-3 py-1 bg-white text-amber-800 text-xs font-bold rounded-lg shadow hover:bg-amber-50 cursor-pointer"
            >
              ↩️ पासिंग यादीवर परत जा
            </button>
          </div>
        </div>
      )}
      
      {/* Outer Aurora Container */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_28px_rgba(37,99,235,0.09)] border border-blue-200/75 overflow-hidden flex flex-col">
        
        {/* Aurora Sapphire Header Banner */}
        <div
          className="px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2"
          style={{
            background:
              'linear-gradient(125deg, #0F2454 0%, #1E3A8A 46%, #2563EB 82%, #4F46E5 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-base shadow-xs shrink-0">
              📖
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight flex items-center gap-2">
                <span>एजंट डे बुक</span>
                <span className="text-[11px] font-semibold text-sky-200 hidden sm:inline">(Agent Day Book — Cash Remittance)</span>
                {isPassingMode && <span className="ml-1 text-[10.5px] font-bold text-amber-100 bg-amber-600/60 px-2 py-0.5 rounded-full border border-amber-300/50">फक्त वाचन मोड</span>}
              </h2>
              <p className="text-[11px] text-blue-100/90 font-medium">एजंट दैनंदिन संकलन ताळमेळ, रोख भरणा, पावती जनरेशन आणि शिल्लक तपासणी</p>
            </div>
          </div>

          <button
            onClick={fetchSummary}
            className="px-3 py-1 bg-white/15 hover:bg-white/25 text-white font-bold rounded-full border border-white/30 flex items-center gap-1 text-xs cursor-pointer transition"
          >
            <span>↻ रिफ्रेश</span>
          </button>
        </div>

        <div className="p-3.5 space-y-3">

          {message && (
            <div className={`p-2.5 rounded-sm border text-xs font-bold ${
              message.startsWith('यशस्वी') || message.startsWith('Success')
                ? 'bg-green-50 text-green-800 border-green-200' 
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              {message}
            </div>
          )}

      {/* Filter Section: Agent & 3 Dates */}
      <div className="bg-white p-2.5 rounded-sm shadow-sm mb-3 flex flex-wrap gap-3 items-end border border-gray-200">
        <div className="w-56">
          <label className="block text-[11px] font-bold text-gray-700 mb-0.5">एजंट निवडा (Select Agent)</label>
          <select
            className="w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] bg-white font-medium"
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(Number(e.target.value))}
          >
            <option value="">-- एजंट निवडा --</option>
            {agents.map((a) => (
              <option key={a.pigmyAgentID} value={a.pigmyAgentID}>
                {a.agentName} ({a.pigmyAgentID})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-0.5">📅 संकलन सुरू (From Date)</label>
          <input
            type="date"
            className="border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] bg-white"
            value={collectionDateFrom}
            onChange={(e) => setCollectionDateFrom(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-0.5">📅 संकलन शेवट (To Date)</label>
          <input
            type="date"
            className="border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] bg-white"
            value={collectionDateTo}
            onChange={(e) => setCollectionDateTo(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="block text-[11px] font-bold text-blue-900">
              🏦 शाखेत भरणा दिनांक (Deposit Date)
            </label>
            <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5" title="शाखेत भरणा दिनांक नेहमी युझरच्या लॉगिन बिझनेस डेटनुसार लॉक राहील.">
              <span>🔒</span> लॉगिन दिनांक
            </span>
          </div>
          <input
            type="date"
            readOnly
            disabled
            tabIndex={-1}
            title="शाखेत प्रत्यक्ष भरणा दिनांक नेहमी चालू लॉगिन तारखेनुसारच (Business Date) राहतो आणि बदलता येत नाही."
            className="border-2 border-emerald-500/60 px-2 py-0.5 rounded-sm text-[11px] bg-slate-100 font-bold text-slate-800 cursor-not-allowed shadow-inner w-full select-none"
            value={depositDate}
          />
        </div>

        <button
          className="bg-primary hover:bg-[#004a75] text-white px-3.5 py-1 rounded-sm font-bold shadow-sm transition-colors text-[11px]"
          onClick={fetchSummary}
        >
          रिफ्रेश (Refresh)
        </button>
      </div>

      {/* Multi-Day Range Breakdown Card (दिवसनिहाय संकलन ब्रेकअप) */}
      {summary && (
        <div className={`border rounded-sm p-2.5 mb-3 shadow-2xs ${
          summary.isFullyRemitted 
            ? 'bg-emerald-50/70 border-emerald-300' 
            : 'bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border-blue-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-base">{summary.isFullyRemitted ? '✅' : '📊'}</span>
              <div>
                <h3 className={`text-xs font-bold ${summary.isFullyRemitted ? 'text-emerald-900' : 'text-blue-900'}`}>
                  निवडलेल्या कालावधीतील संकलन तपशील ({new Date(collectionDateFrom).toLocaleDateString('en-GB')} ते {new Date(collectionDateTo).toLocaleDateString('en-GB')})
                </h3>
                <div className="text-[10px] text-gray-700 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <span>एकूण पावत्या: <strong className="font-mono">{summary.rangeCollectionCount || 0}</strong></span>
                  <span>|</span>
                  <span>कालावधी संकलन: <strong className="font-mono text-gray-900">₹ {(summary.rangeTotalCollected ?? summary.rangeCollectionAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                  {(summary.rangeAlreadyRemitted || 0) > 0 && (
                    <>
                      <span>|</span>
                      <span>आधीच भरणा (Remitted): <strong className="font-mono text-blue-700">₹ {(summary.rangeAlreadyRemitted || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                    </>
                  )}
                  <span>|</span>
                  <span>उर्वरित बाकी (Pending): <strong className={`font-mono ${(summary.rangeCollectionAmount || 0) > 0 ? 'text-amber-700 font-extrabold' : 'text-emerald-700 font-extrabold'}`}>₹ {(summary.rangeCollectionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                </div>
              </div>
            </div>

            {summary.isFullyRemitted ? (
              <div className="bg-emerald-600 text-white font-bold px-3 py-1 rounded-sm shadow-xs text-xs flex items-center gap-1 self-start sm:self-auto">
                <span>✓ सर्व संकलन आधीच शाखेत जमा (Remitted) झाले आहे</span>
              </div>
            ) : (summary.rangeCollectionAmount || 0) > 0 ? (
              <button
                type="button"
                onClick={applyRangeAmountToDeposit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-sm shadow-xs text-xs flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
                title="कालावधीतील उर्वरित रक्कम भरणा बॉक्समध्ये भरा"
              >
                <span>⚡ उर्वरित रक्कम भरा (₹{(summary.rangeCollectionAmount || 0).toLocaleString('en-IN')})</span>
              </button>
            ) : null}
          </div>

          {/* Day-by-Day Breakup Badges */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mr-1">दिवसनिहाय (Day Breakup):</span>
            {!summary.dayBreakup || summary.dayBreakup.length === 0 ? (
              <span className="text-[11px] text-gray-500 italic">या कालावधीत कोणतेही संकलन झालेले नाही.</span>
            ) : (
              summary.dayBreakup.map((day) => (
                <div 
                  key={day.date} 
                  onClick={() => handleViewDayDetails(day)}
                  className={`px-2.5 py-1 rounded border shadow-2xs text-[11px] flex items-center gap-1.5 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all select-none ${
                    day.isRemitted 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100' 
                      : (day.remittedAmount || 0) > 0
                        ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                        : 'bg-white border-blue-300 text-gray-800 hover:bg-blue-50'
                  }`}
                  title="या दिवसाच्या सर्व पावत्यांचे तपशील पाहण्यासाठी क्लिक करा"
                >
                  <span className="font-semibold text-blue-900 underline decoration-dotted">{new Date(day.date).toLocaleDateString('en-GB')}:</span>
                  <span className="text-[10px] font-medium text-blue-700 bg-blue-50/80 px-1 rounded">({day.count} पावत्या 👁️)</span>
                  <span className="font-bold font-mono text-emerald-700">₹{day.amount.toLocaleString('en-IN')}</span>
                  {day.isRemitted ? (
                    <span className="bg-emerald-200/80 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                      ✓ जमा पूर्ण
                    </span>
                  ) : (day.remittedAmount || 0) > 0 ? (
                    <span className="bg-amber-200/80 text-amber-900 text-[9px] font-bold px-1.5 py-0.2 rounded">
                      ⏳ ₹{day.pendingAmount?.toLocaleString('en-IN')} बाकी
                    </span>
                  ) : (
                    <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                      ⏳ भरणे बाकी
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Scheme-Wise GL Ledger Breakup */}
          {summary.schemeBreakup && summary.schemeBreakup.length > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-200/80 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wide mr-1">
                योजनेनिहाय व लेजरनिहाय विभागणी (Scheme GL Breakup):
              </span>
              {summary.schemeBreakup.map((sb) => (
                <div
                  key={`sb-${sb.pigmySchemeID}`}
                  className={`px-2.5 py-1 rounded border text-[11px] flex flex-wrap items-center gap-1.5 shadow-2xs ${
                    !sb.liabilityLedgerID
                      ? 'bg-red-50 border-red-300 text-red-900'
                      : sb.pendingAmount > 0
                        ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                >
                  <span className="font-bold">{sb.schemeName}</span>
                  <span className="text-[10px] font-mono bg-white/80 px-1 rounded border border-indigo-200">
                    Cr: {sb.liabilityLedgerID ? `#${sb.liabilityLedgerID} ${sb.liabilityLedgerName}` : '⚠️ लेजर मॅप नाही'}
                  </span>
                  <span className="text-[10px] text-gray-600">({sb.accountsCount} खाती)</span>
                  <span className="font-mono font-bold text-indigo-900">
                    एकूण: ₹{sb.collectedAmount.toLocaleString('en-IN')}
                  </span>
                  {sb.pendingAmount > 0 && (
                    <span className="bg-amber-100 text-amber-900 text-[9.5px] font-bold px-1.5 py-0.2 rounded border border-amber-300">
                      बाकी: ₹{sb.pendingAmount.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary Balance Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div className="bg-white p-2.5 rounded-sm shadow-sm border-l-4 border-gray-500 border border-gray-200">
            <h3 className="text-[10px] text-gray-500 font-bold uppercase">सुरुवातीची बाकी (Opening)</h3>
            <p className="text-sm font-extrabold text-gray-800 mt-0.5">₹ {summary.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white p-2.5 rounded-sm shadow-sm border-l-4 border-emerald-500 border border-gray-200">
            <h3 className="text-[10px] text-emerald-700 font-bold uppercase">कालावधी संकलन बाकी (Pending)</h3>
            <p className="text-sm font-extrabold text-emerald-700 mt-0.5">+ ₹ {(summary.rangeCollectionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            {summary.isFullyRemitted && (
              <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">✓ पूर्ण जमा (₹{(summary.rangeTotalCollected || 0).toLocaleString('en-IN')})</span>
            )}
          </div>
          <div className="bg-white p-2.5 rounded-sm shadow-sm border-l-4 border-red-500 border border-gray-200">
            <h3 className="text-[10px] text-gray-500 font-bold uppercase">आज शाखेत भरलेली रोख</h3>
            <p className="text-sm font-extrabold text-red-600 mt-0.5">- ₹ {summary.cashDeposited.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white p-2.5 rounded-sm shadow-sm border-l-4 border-blue-600 border border-gray-200">
            <h3 className="text-[10px] text-gray-500 font-bold uppercase">एजंटकडील एकूण शिल्लक कॅश</h3>
            <p className="text-sm font-extrabold text-blue-700 mt-0.5">₹ {(summary.totalPendingCash ?? summary.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Left Receive Cash Form | Right Remittance History Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        
        {/* Receive Cash Form */}
        <fieldset disabled={isPassingMode} className="contents">
        <div className="lg:col-span-4 bg-white p-3 rounded-sm shadow-sm border border-gray-200 h-fit">
          <div className="text-[12px] font-bold text-primary border-b border-gray-200 pb-1 mb-2.5 flex justify-between items-center">
            <span>एजंट रोख रक्कम भरणा नोंद (Receive Remittance)</span>
          </div>

          <div className="mb-2">
            <label className="block text-[11px] font-bold text-gray-700 mb-0.5">एजंटकडील एकूण शिल्लक रोख</label>
            <input
              type="text"
              readOnly
              className="w-full border border-gray-300 px-2 py-1 rounded-sm bg-gray-100 font-mono font-bold text-xs text-blue-700"
              value={summary ? `₹ ${(summary.totalPendingCash ?? summary.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ 0.00'}
            />
          </div>

          <div className="mb-2">
            <label className="block text-[11px] font-bold text-gray-700 mb-0.5">पैसे भरणा प्रकार (Payment Mode) <span className="text-red-500">*</span></label>
            <select
              className="w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-xs font-bold bg-white"
              value={paymentMode}
              onChange={(e) => {
                setPaymentMode(e.target.value);
                if (e.target.value === 'CASH') setBankLedgerId(0);
              }}
            >
              <option value="CASH">💵 रोख (Cash)</option>
              <option value="ONLINE">💳 ऑनलाईन (Online / NEFT / RTGS)</option>
              <option value="UPI">📱 युपीआय (UPI / PhonePe / GPay)</option>
              <option value="CHEQUE">📜 चेक (Cheque / Demand Draft)</option>
            </select>
          </div>

          {paymentMode !== 'CASH' && (
            <div className="mb-2 p-2 bg-blue-50/50 border border-blue-200 rounded-sm">
              <BankLedgerSelect
                value={bankLedgerId}
                onChange={setBankLedgerId}
                disabled={isPassingMode}
                showCountBadge
              />
            </div>
          )}

          <div className="mb-2">
            <div className="flex justify-between items-center mb-0.5">
              <div className="flex items-center gap-1.5">
                <label className="block text-[11px] font-bold text-gray-700">शाखेत जमा रक्कम (Remittance Amount ₹)</label>
                {depositAmount && Number(depositAmount) > 0 && autoFilledFromExcel && (
                  <span className="text-[9.5px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-0.5" title="एक्सेल संकलनानुसार प्रलंबित रक्कम आपोआप भरली आहे. आवश्यक असल्यास आपण बदलू शकता.">
                    <span>⚡</span> ऑटो-रक्कम (एक्सेल संकलन)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {summary && (summary.rangeCollectionAmount || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      applyRangeAmountToDeposit();
                      setAutoFilledFromExcel(true);
                    }}
                    className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                    title="कालावधीतील शिल्लक संकलन रक्कम भरा"
                  >
                    ⚡ शिल्लक संकलन घ्या (₹{(summary.rangeCollectionAmount || 0).toLocaleString('en-IN')})
                  </button>
                )}
                {paymentMode === 'CASH' && totalDenominationAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      applyDenomToDepositAmount();
                      setAutoFilledFromExcel(false);
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                  >
                    नोटांची रक्कम घ्या (₹{totalDenominationAmount.toLocaleString('en-IN')})
                  </button>
                )}
              </div>
            </div>
            <input
              type="number"
              className="w-full border-2 border-emerald-500/70 px-2 py-1 rounded-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors text-xs font-mono font-black text-gray-950 bg-emerald-50/20"
              placeholder={summary?.rangeCollectionAmount ? `उदा. ₹ ${summary.rangeCollectionAmount}` : `Max: ₹ ${summary?.totalPendingCash ?? summary?.closingBalance ?? 0}`}
              value={depositAmount}
              onChange={(e) => {
                setDepositAmount(e.target.value ? Number(e.target.value) : '');
                setAutoFilledFromExcel(false);
              }}
            />
            {summary?.schemeBreakup && summary.schemeBreakup.filter(s => s.pendingAmount > 0).length > 0 && (
              <div className="mt-1.5 bg-indigo-50/70 border border-indigo-200 rounded-sm px-2 py-1 text-[10px] text-indigo-900 space-y-0.5">
                <div className="font-bold">Daybook Cr लेजर्स (संकलनानुसार आपोआप विभागले जाईल):</div>
                {summary.schemeBreakup.filter(s => s.pendingAmount > 0).map(sb => (
                  <div key={`form-sb-${sb.pigmySchemeID}`} className="flex justify-between font-mono">
                    <span>• {sb.liabilityLedgerID ? `${sb.liabilityLedgerName} (#${sb.liabilityLedgerID})` : `${sb.schemeName} (⚠️ लेजर नाही)`}</span>
                    <span className="font-bold">₹{sb.pendingAmount.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
            {schemes.filter(s => s.status === 'Active').length > 1 && (!summary?.schemeBreakup || summary.schemeBreakup.filter(s => s.pendingAmount > 0).length === 0) && (
              <div className="mt-1.5">
                <label className="block text-[10px] font-bold text-amber-800 mb-0.5">
                  अतिरिक्त / संकलनाविना रकमेसाठी पिग्मी योजना (Fallback Scheme)
                </label>
                <select
                  className="w-full border border-amber-300 px-2 py-1 rounded-sm text-[11px] bg-amber-50/40 font-semibold"
                  value={fallbackPigmySchemeId}
                  onChange={(e) => setFallbackPigmySchemeId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">-- योजना निवडा (एकापेक्षा जास्त योजना असल्यास) --</option>
                  {schemes.filter(s => s.status === 'Active').map((s: any) => (
                    <option key={s.pigmySchemeID} value={s.pigmySchemeID}>
                      {s.schemeName} {s.pigmyLiabilityLedger?.ledgerName ? `(${s.pigmyLiabilityLedger.ledgerName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cash Denomination Counter Grid (Active when Cash Mode is selected) */}
          {paymentMode === 'CASH' && (
            <div className="mb-2 border border-emerald-200 bg-emerald-50/40 rounded-sm p-2 text-xs">
              <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-emerald-200">
                <span className="font-bold text-emerald-900 text-[11px] flex items-center gap-1">
                  💵 कॅशियर नोटा मोजणी (Denominations)
                </span>
                <button
                  type="button"
                  onClick={resetDenominations}
                  className="text-[10px] text-gray-500 hover:text-red-600 font-medium"
                >
                  रीसेट (Reset)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                {[
                  { label: '₹ ५००', key: 500, val: 500 },
                  { label: '₹ २००', key: 200, val: 200 },
                  { label: '₹ १००', key: 100, val: 100 },
                  { label: '₹ ५०', key: 50, val: 50 },
                  { label: '₹ २०', key: 20, val: 20 },
                  { label: '₹ १०', key: 10, val: 10 },
                  { label: '₹ ५', key: 5, val: 5 },
                  { label: 'नाणी (Coins)', key: 'coins', val: 1, isCoin: true }
                ].map((d) => (
                  <div key={d.key.toString()} className="flex items-center justify-between bg-white px-1.5 py-0.5 rounded border border-gray-200">
                    <span className="font-semibold text-gray-700 w-16 text-[10px]">{d.label}</span>
                    <span className="text-gray-400 text-[10px]">×</span>
                    <input
                      type="number"
                      min="0"
                      className="w-12 text-center border border-gray-300 rounded px-1 py-0.5 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                      value={denominations[d.key] || ''}
                      placeholder="0"
                      onChange={(e) => handleDenomChange(d.key.toString(), e.target.value)}
                    />
                    <span className="font-mono text-[10px] text-gray-600 w-12 text-right">
                      ₹{((denominations[d.key] || 0) * d.val).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Denomination Total & Matching Indicator */}
              <div className="mt-2 pt-1 border-t border-emerald-200 flex justify-between items-center text-[11px]">
                <div>
                  <span className="text-gray-600 font-medium">एकूण नोटा: </span>
                  <span className="font-mono font-bold text-emerald-800">
                    ₹ {totalDenominationAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                {totalDenominationAmount > 0 && depositAmount && Number(depositAmount) > 0 && (
                  <div>
                    {totalDenominationAmount === Number(depositAmount) ? (
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                        ✓ अचूक (Matched)
                      </span>
                    ) : (
                      <span className="text-red-700 font-bold bg-red-100 px-1.5 py-0.5 rounded text-[10px]">
                        फरक: ₹ {Math.abs(totalDenominationAmount - Number(depositAmount)).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-3">
            <label className="block text-[11px] font-bold text-gray-700 mb-0.5">तपशील / शेरा (Narration)</label>
            <input
              type="text"
              className="w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] bg-white"
              placeholder="उदा. Cash handed over to Branch Counter"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
            />
          </div>

          {summary?.isFullyRemitted && (
            <div className="mb-2 p-2 bg-emerald-50 border border-emerald-300 rounded text-[11px] text-emerald-800 font-bold flex items-center gap-1.5">
              <span>✓</span>
              <span>या निवडलेल्या कालावधीचे सर्व संकलन आधीच पूर्ण जमा (Remitted) झाले आहे.</span>
            </div>
          )}

          {!isPassingMode && (
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 bg-primary hover:bg-[#004a75] text-white px-3 py-1.5 rounded-sm font-bold shadow-sm transition-colors text-xs disabled:opacity-50 cursor-pointer"
                disabled={!summary || (summary.totalPendingCash ?? summary.closingBalance) <= 0 || !depositAmount || summary.isFullyRemitted}
                onClick={handleDeposit}
              >
                रक्कम जमा करा व व्हाउचर जनरेट करा (Receive & Create Voucher)
              </button>
              <button
                type="button"
                className="px-2.5 py-1.5 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-sm font-semibold text-xs transition-colors cursor-pointer"
                onClick={clearForm}
                title="सर्व इनपुट साफ करा"
              >
                साफ करा (Clear)
              </button>
            </div>
          )}
        </div>
        </fieldset>

        {/* Remittance History Sheet (Compact Single-Line 8-Column Grid) */}
        <div className="lg:col-span-8 bg-white p-3 rounded-sm shadow-sm border border-gray-200 min-w-0">
          <h2 className="text-[12px] font-bold text-gray-800 mb-2 border-b pb-1 flex justify-between items-center">
            <span>एजंट भरणा पावती इतिहास (Remittance Receipts History)</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-sm font-bold">
              {summary?.recentRemittances?.length || 0} पावत्या
            </span>
          </h2>

          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="min-w-full divide-y divide-gray-200 text-left text-[11px] border-collapse">
              <thead className="bg-primary text-white whitespace-nowrap">
                <tr>
                  <th className="px-2 py-1.5 border-r border-blue-400/70 font-semibold">पावती क्र.</th>
                  <th className="px-2 py-1.5 border-r border-blue-400/70 font-semibold text-center">भरणा दि.</th>
                  <th className="px-2 py-1.5 border-r border-blue-400/70 font-semibold text-center">संकलन कालावधी</th>
                  <th className="px-2 py-1.5 border-r border-blue-400/70 font-semibold text-center">प्रकार</th>
                  <th className="px-2 py-1.5 border-r border-blue-400/70 font-semibold">व्हाउचर क्र.</th>
                  <th className="px-2 py-1.5 border-r border-blue-400/70 font-semibold text-right">रक्कम (₹)</th>
                  <th className="px-2 py-1.5 border-r border-blue-400/70 font-semibold">तपशील</th>
                  <th className="px-2 py-1.5 font-semibold text-center">कृती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {!summary?.recentRemittances || summary.recentRemittances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                      या एजंटच्या कोणत्याही भरणा पावत्या आढळल्या नाहीत.
                    </td>
                  </tr>
                ) : (
                  summary.recentRemittances.map((item, idx) => {
                    const collectionPeriod =
                      item.collectionDateFrom && item.collectionDateTo
                        ? `${new Date(item.collectionDateFrom).toLocaleDateString('en-GB')} - ${new Date(item.collectionDateTo).toLocaleDateString('en-GB')}`
                        : item.narration?.includes('[संकलन:')
                          ? item.narration.split('[संकलन:')[1]?.split(']')[0]?.trim() || '-'
                          : '-';

                    const cleanNarration = (item.narration || '')
                      .replace(/\[संकलन:[^\]]+\]/g, '')
                      .trim();

                    return (
                      <tr
                        key={item.depositId}
                        className={`hover:bg-blue-50/50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/45' : 'bg-white'}`}
                      >
                        <td className="px-2 py-1 border-r border-gray-200 font-mono font-bold text-primary whitespace-nowrap align-middle">
                          {item.receiptNo}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap text-center font-mono font-medium text-gray-800 align-middle">
                          {new Date(item.depositDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap text-center align-middle">
                          {collectionPeriod !== '-' ? (
                            <span className="inline-block font-mono font-semibold text-blue-900 text-[10px] bg-blue-50 px-1.5 py-0.5 rounded-sm border border-blue-200 leading-tight">
                              {collectionPeriod}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap text-center font-semibold text-gray-800 align-middle">
                          <span className="inline-block px-1.5 py-0.5 rounded-sm text-[10px] leading-tight bg-gray-100 border border-gray-300">
                            {getModeLabel(item.paymentMode)}
                          </span>
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 font-mono text-gray-700 whitespace-nowrap align-middle">
                          {item.voucherNo || '-'}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 text-right font-mono font-bold text-green-700 whitespace-nowrap align-middle">
                          ₹ {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td
                          className="px-2 py-1 border-r border-gray-200 text-left text-gray-600 whitespace-nowrap align-middle max-w-[180px]"
                          title={cleanNarration || item.narration || undefined}
                        >
                          {cleanNarration ? (
                            <div className="truncate text-[10.5px]">{cleanNarration}</div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-center whitespace-nowrap align-middle">
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(item)}
                            className="border border-blue-500 text-blue-700 px-2 py-0.5 rounded-sm hover:bg-blue-50 transition-colors font-semibold text-[10px] leading-tight cursor-pointer whitespace-nowrap"
                            title="पावती प्रिंट करा"
                          >
                            प्रिंट
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>

      {/* Printable Cash Remittance Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-4 rounded-sm shadow-lg font-sans border border-gray-300">
            
            {/* Header */}
            <div className="text-center border-b-2 border-primary pb-2 mb-3">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wide">स्मार्ट बँकिंग को-ऑपरेटिव्ह क्रेडिट सोसायटी</h2>
              <p className="text-[10px] text-gray-600 font-semibold">एजंट रक्कम भरणा पावती (Agent Remittance Advice Slip)</p>
            </div>

            {/* Receipt Details */}
            <div className="space-y-1.5 text-xs border-b pb-3 mb-3">
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">पावती क्र. (Receipt No):</span>
                <span className="font-mono font-bold text-primary">{selectedReceipt.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">भरणा प्रकार (Payment Mode):</span>
                <span className="font-bold text-blue-800">{getModeLabel(selectedReceipt.paymentMode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">व्हाउचर क्र. (Voucher No):</span>
                <span className="font-mono font-bold text-gray-800">{selectedReceipt.voucherNo || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">भरणा दिनांक (Deposit Date):</span>
                <span className="font-semibold text-blue-900">{new Date(selectedReceipt.depositDate).toLocaleDateString('en-GB')}</span>
              </div>
              {(selectedReceipt.collectionDateFrom || selectedReceipt.narration?.includes('[संकलन:')) && (
                <div className="flex justify-between bg-blue-50/70 p-1 rounded border border-blue-200">
                  <span className="text-blue-900 font-bold">संकलन कालावधी (Collection Period):</span>
                  <span className="font-bold text-blue-900">
                    {selectedReceipt.collectionDateFrom && selectedReceipt.collectionDateTo
                      ? `${new Date(selectedReceipt.collectionDateFrom).toLocaleDateString('en-GB')} ते ${new Date(selectedReceipt.collectionDateTo).toLocaleDateString('en-GB')}`
                      : selectedReceipt.narration?.split('[संकलन:')[1]?.split(']')[0]?.trim()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">पिग्मी एजंटचे नाव (Agent Name):</span>
                <span className="font-bold text-gray-900">{selectedAgentObj?.agentName || `Agent ID: ${selectedAgentId}`}</span>
              </div>
              <div className="flex justify-between bg-green-50 p-1.5 rounded-sm border border-green-200">
                <span className="font-bold text-green-900">भरणा केलेली रक्कम (Remitted Amount):</span>
                <span className="font-extrabold text-green-800 text-sm">₹ {selectedReceipt.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {selectedReceipt.narration && !selectedReceipt.narration.startsWith('[संकलन:') && (
                <div className="flex justify-between pt-1">
                  <span className="text-gray-600 font-semibold">तपशील (Narration):</span>
                  <span className="text-gray-800">{selectedReceipt.narration.replace(/\[संकलन:[^\]]+\]/g, '').trim()}</span>
                </div>
              )}
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-4 pt-4 pb-2 text-center text-[10px] text-gray-600 font-semibold border-b mb-3">
              <div>
                <div className="h-8"></div>
                <p className="border-t pt-0.5">पिग्मी एजंट सही (Agent Signature)</p>
              </div>
              <div>
                <div className="h-8"></div>
                <p className="border-t pt-0.5">शाखा कॅशियर सही (Cashier Signature)</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-3 py-1 bg-gray-500 text-white rounded-sm text-xs font-semibold hover:bg-gray-600"
              >
                बंद करा (Close)
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1 bg-primary text-white rounded-sm text-xs font-bold hover:bg-[#004a75]"
              >
                प्रिंट काढा (Print Slip)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passing Mode Actions Bar */}
      {isPassingMode && (
        <div className="bg-white p-4 rounded-sm shadow-sm border border-gray-200 flex justify-between items-center">
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold rounded text-xs border border-gray-300 transition"
          >
            ↩️ पासिंग यादीवर परत जा (Back to Queue)
          </button>
          <div className="flex space-x-3">
            <button
              type="button"
              disabled={passingActionLoading}
              onClick={() => setRejectModalOpen(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs shadow transition disabled:opacity-50"
            >
              ❌ नामंजूर / रद्द करा (Reject Voucher)
            </button>
            <button
              type="button"
              disabled={passingActionLoading}
              onClick={handlePassVoucher}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow transition disabled:opacity-50"
            >
              {passingActionLoading ? 'पास करत आहे...' : '✅ मंजूर व पास करा (Approve & Pass)'}
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-md w-full p-4 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-red-600">व्हाउचर नामंजूर / रद्द करा</h3>
            <p className="text-xs text-gray-600">
              कृपया हे व्हाउचर का नामंजूर किंवा रद्द करत आहात याचे स्पष्ट कारण लिहा (उदा. रोख भरणा तफावत, चुकीचा एजंट इ.):
            </p>
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-1 focus:ring-red-500"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="नामंजूरीचे कारण नमूद करा..."
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold hover:bg-gray-50"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                disabled={passingActionLoading || !rejectReason.trim()}
                onClick={handleRejectVoucher}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition disabled:opacity-50"
              >
                {passingActionLoading ? 'प्रक्रिया सुरू...' : 'पुष्टी करा व रद्द करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Details Modal */}
      {showDayDetailsModal && selectedDayInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg max-w-4xl w-full p-5 space-y-4 shadow-2xl border border-gray-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg text-lg">
                  📋
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    दैनिक संकलन पावती तपशील
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {new Date(selectedDayInfo.date).toLocaleDateString('en-GB')}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    एजंट: <span className="font-semibold text-gray-700">{agents.find(a => a.pigmyAgentID === selectedAgentId)?.agentName || `एजंट #${selectedAgentId}`}</span>
                    {' '}| एकूण पावत्या: <span className="font-semibold text-gray-700">{selectedDayInfo.count}</span>
                    {' '}| एकूण संकलन: <span className="font-bold text-emerald-700">₹{selectedDayInfo.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDayDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 text-xl font-bold transition cursor-pointer"
                title="बंद करा"
              >
                ✕
              </button>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-y-auto">
              {loadingDayCollections ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-500">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <span className="text-xs font-medium">पावत्यांचा तपशील लोड होत आहे...</span>
                </div>
              ) : dayCollections.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  या दिवसासाठी कोणतीही पावती सापडली नाही.
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-center w-10">#</th>
                        <th className="px-3 py-2">पावती क्र. (Receipt No)</th>
                        <th className="px-3 py-2">खाते क्र. (Account No)</th>
                        <th className="px-3 py-2">पिग्मी योजना (Scheme)</th>
                        <th className="px-3 py-2">खातेदाराचे नाव</th>
                        <th className="px-3 py-2 text-center">वेळ</th>
                        <th className="px-3 py-2 text-center">स्रोत / माध्यम</th>
                        <th className="px-3 py-2 text-right">रक्कम (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dayCollections.map((col, idx) => (
                        <tr key={col.collectionId} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-3 py-2 text-center font-mono text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-medium text-gray-800">
                            {col.receiptNo || `-`}
                            {col.voucherId && (
                              <span className="ml-1 text-[9px] px-1 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-200 font-normal">
                                V#{col.voucherId}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            <div className="font-semibold text-blue-900">{col.accountNo}</div>
                            {col.legacyAccountNumber && (
                              <div className="text-[10px] text-gray-500">
                                जुना: <span className="font-semibold text-gray-700">{col.legacyAccountNumber}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                              {col.schemeName || (col.pigmySchemeID ? `योजना #${col.pigmySchemeID}` : '-')}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{col.customerName || 'N/A'}</div>
                            {col.mobileNo && (
                              <div className="text-[10px] text-gray-500">📱 {col.mobileNo}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600 font-mono">
                            {col.collectionDate ? new Date(col.collectionDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              col.collectionSource === 'APP' 
                                ? 'bg-indigo-100 text-indigo-700' 
                                : col.collectionSource === 'IMPORT' 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : 'bg-gray-100 text-gray-700'
                            }`}>
                              {col.collectionSource || 'MANUAL'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 text-sm">
                            ₹{col.collectionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <tr>
                        <td colSpan={7} className="px-3 py-2 text-right text-gray-700">
                          एकूण संकलन ({dayCollections.length} पावत्या):
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-800 text-sm">
                          ₹{dayCollections.reduce((sum, c) => sum + (c.collectionAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="text-[11px] text-gray-500">
                💡 टीप: ही रक्कम एजंटच्या चालू शिल्लक / जमा खात्याशी संबंधित आहे.
              </div>
              <div className="flex items-center gap-2">
                {!selectedDayInfo.isRemitted && (selectedDayInfo.pendingAmount || 0) > 0 && !isPassingMode && (
                  <button
                    type="button"
                    onClick={() => {
                      const dayStr = selectedDayInfo.date.split('T')[0];
                      setCollectionDateFrom(dayStr);
                      setCollectionDateTo(dayStr);
                      setDepositAmount(selectedDayInfo.pendingAmount || selectedDayInfo.amount);
                      setShowDayDetailsModal(false);
                      setMessage(`दिवस ${new Date(dayStr).toLocaleDateString('en-GB')} ची प्रलंबित संकलन रक्कम भरण्यासाठी निवडली.`);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs shadow transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>⚡ या दिवसाचा भरणा करा (₹{(selectedDayInfo.pendingAmount || selectedDayInfo.amount).toLocaleString('en-IN')})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDayDetailsModal(false)}
                  className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-semibold text-xs transition cursor-pointer"
                >
                  बंद करा (Close)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AgentDayBookMaster;

