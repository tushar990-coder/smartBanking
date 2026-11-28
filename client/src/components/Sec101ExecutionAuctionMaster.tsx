import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Gavel,
  Printer,
  Plus,
  CheckCircle2,
  RefreshCw,
  ArrowUpRight,
  IndianRupee
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import BankLedgerSelect from './common/BankLedgerSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr, parseYmdAsLocalDate, formatLocalYmd } from '../utils/businessDateUtils';
import { isHeadOfficeUser, getEffectiveBranchId } from '../utils/branchAccess';

interface ExecutionRecord {
  executionId: number;
  caseId: number;
  caseType?: string;
  caseNumber: string;
  certificateNumber: string;
  customerName?: string;
  memberName: string;
  cifNo?: string;
  memberCode?: string;
  loanAccountNo: string;
  executionType: string;
  executionOrderNo: string;
  orderDate: string;
  sroName?: string;
  employerName?: string;
  employerAddress?: string;
  monthlyDeductionAmount?: number;
  propertyDetails?: string;
  estimatedValue?: number;
  reservePrice?: number;
  panchanamaDate?: string;
  auctionNoticeDate?: string;
  auctionDate?: string;
  highestBidAmount?: number;
  spotDepositAmount?: number;
  balancePaymentDueDate?: string;
  surplusAmount?: number;
  buyerName?: string;
  buyerContact?: string;
  saleCertificateNo?: string;
  saleCertificateDate?: string;
  settlementVoucherId?: number;
  settlementVoucherNo?: string;
  settlementVoucherStatus?: string;
  executionStatus: string;
  status?: string;
  recoveredAmount: number;
  remarks?: string;
}

interface CertifiedCase {
  caseId: number;
  caseType?: string;
  caseNumber: string;
  certificateNumber?: string;
  awardNumber?: string;
  customerName?: string;
  memberName: string;
  cifNo?: string;
  memberCode: string;
  loanAccountNo: string;
  grantedAmount?: number;
  sanctionedAmount?: number;
  status?: string;
  caseStatus?: string;
}

interface Sec101ExecutionAuctionMasterProps {
  branchId?: number;
  effectiveBranch?: number | 'all' | null;
  initialCaseId?: number | null;
  embedded?: boolean;
  onDataChanged?: () => void;
}

const EXECUTION_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  WARRANT_ISSUED: { label: 'वॉरंट जारी', cls: 'bg-amber-100 text-amber-900' },
  ATTACHED: { label: 'जप्ती / पंचनामा पूर्ण', cls: 'bg-amber-100 text-[#5A1A14]' },
  AUCTION_SCHEDULED: { label: 'लिलाव जाहीरनामा प्रसिद्ध', cls: 'bg-orange-100 text-[#5A1A14]' },
  AUCTION_COMPLETED: { label: 'लिलाव विक्री पूर्ण', cls: 'bg-emerald-100 text-emerald-900' },
  SETTLED: { label: 'वसुली सेटलमेंट पूर्ण', cls: 'bg-teal-100 text-teal-900' },
  CANCELLED: { label: 'रद्द (Cancelled)', cls: 'bg-slate-200 text-slate-700' },
};

const EXECUTION_TYPE_LABELS: Record<string, string> = {
  SEC_49_SALARY: 'कलम ४९ पगार कपात',
  SALARY_ATTACHMENT_SEC49: 'कलम ४९ पगार कपात',
  RULE_107_IMMOVABLE: 'नियम १०७ स्थावर जप्ती',
  IMMOVABLE_PROPERTY: 'नियम १०७ स्थावर जप्ती',
  MOVABLE_PROPERTY: 'जंगम मालमत्ता जप्ती',
  BANK_ACCOUNT_FREEZE: 'बँक खाते गोठवणे',
};

export default function Sec101ExecutionAuctionMaster({
  branchId: propBranchId,
  effectiveBranch: propEffectiveBranch,
  initialCaseId,
  embedded = false,
  onDataChanged,
}: Sec101ExecutionAuctionMasterProps = {}) {
  const { user, globalBranchId } = useAuth();
  const isHo = isHeadOfficeUser(user);
  const bizDateStr = getBusinessDateStr(user?.businessDate);

  const [cases, setCases] = useState<CertifiedCase[]>([]);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [sanstha, setSanstha] = useState<any>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(() => propBranchId || user?.branchID || 1);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Create Execution Form State
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(initialCaseId || null);
  const [executionType, setExecutionType] = useState<string>('SEC_49_SALARY');
  const [executionOrderNo, setExecutionOrderNo] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(bizDateStr);
  const [sroName, setSroName] = useState<string>('');
  const [employerName, setEmployerName] = useState<string>('');
  const [employerAddress, setEmployerAddress] = useState<string>('');
  const [monthlyDeductionAmount, setMonthlyDeductionAmount] = useState<number>(5000);
  const [propertyDetails, setPropertyDetails] = useState<string>('');
  const [estimatedValue, setEstimatedValue] = useState<number>(0);
  const [reservePrice, setReservePrice] = useState<number>(0);
  const [auctionNoticeDate, setAuctionNoticeDate] = useState<string>('');
  const [auctionDate, setAuctionDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Stage Progression Modal
  const [stageExec, setStageExec] = useState<ExecutionRecord | null>(null);
  const [nextStageStatus, setNextStageStatus] = useState<string>('ATTACHED');
  const [stPanchanamaDate, setStPanchanamaDate] = useState<string>(bizDateStr);
  const [stAuctionNoticeDate, setStAuctionNoticeDate] = useState<string>(bizDateStr);
  const [stAuctionDate, setStAuctionDate] = useState<string>(() => {
    const dt = parseYmdAsLocalDate(bizDateStr);
    dt.setDate(dt.getDate() + 31);
    return formatLocalYmd(dt);
  });
  const [stReservePrice, setStReservePrice] = useState<number>(0);
  const [stHighestBidAmount, setStHighestBidAmount] = useState<number>(0);
  const [stSpotDepositAmount, setStSpotDepositAmount] = useState<number>(0);
  const [stBalanceDueDate, setStBalanceDueDate] = useState<string>(bizDateStr);
  const [stBuyerName, setStBuyerName] = useState<string>('');
  const [stBuyerContact, setStBuyerContact] = useState<string>('');
  const [stSaleCertNo, setStSaleCertNo] = useState<string>('');
  const [stSaleCertDate, setStSaleCertDate] = useState<string>(bizDateStr);
  const [bypassThirtyDayCheck, setBypassThirtyDayCheck] = useState<boolean>(false);
  const [stRemarks, setStRemarks] = useState<string>('');
  const [updatingStage, setUpdatingStage] = useState<boolean>(false);

  // Rule 107 Settlement Modal
  const [settleExec, setSettleExec] = useState<ExecutionRecord | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleDate, setSettleDate] = useState<string>(bizDateStr);
  const [settlePaymentMode, setSettlePaymentMode] = useState<string>('CASH');
  const [settleBankLedgerId, setSettleBankLedgerId] = useState<number>(0);
  const [settleReferenceNo, setSettleReferenceNo] = useState<string>('');
  const [settleRemarks, setSettleRemarks] = useState<string>('');
  const [settling, setSettling] = useState<boolean>(false);

  // Unified Print Modal
  const [printDoc, setPrintDoc] = useState<{ mode: 'SALARY_ORDER' | 'PANCHANAMA' | 'AUCTION_NOTICE' | 'SALE_CERT'; record: any } | null>(null);

  useEffect(() => {
    if (propBranchId && propBranchId > 0) setSelectedBranchId(propBranchId);
    else {
      const eff = getEffectiveBranchId(user, globalBranchId);
      if (typeof eff === 'number' && eff > 0) setSelectedBranchId(eff);
    }
  }, [propBranchId, user, globalBranchId]);

  useEffect(() => {
    setOrderDate(bizDateStr);
    setStPanchanamaDate(bizDateStr);
    setStAuctionNoticeDate(bizDateStr);
    setStSaleCertDate(bizDateStr);
    setSettleDate(bizDateStr);
  }, [bizDateStr]);

  useEffect(() => {
    if (initialCaseId && initialCaseId > 0) setSelectedCaseId(initialCaseId);
  }, [initialCaseId]);

  useEffect(() => {
    axios.get('/api/Branches').then((r) => Array.isArray(r.data) && setBranches(r.data)).catch(console.error);
    axios.get('/api/SansthaDetails').then((r) => {
      if (Array.isArray(r.data) && r.data.length > 0) setSanstha(r.data[0]);
      else if (r.data && !Array.isArray(r.data)) setSanstha(r.data);
    }).catch(console.error);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchQuery = propEffectiveBranch === 'all' && isHo ? '' : `?branchId=${selectedBranchId}`;
      const [caseRes, execRes] = await Promise.all([
        axios.get(`/api/LegalRecovery/cases${branchQuery}`),
        axios.get(`/api/LegalRecovery/executions${branchQuery}`),
      ]);

      const allCases: CertifiedCase[] = Array.isArray(caseRes.data) ? caseRes.data : [];
      setCases(
        allCases.filter(
          (c) =>
            Boolean(c.certificateNumber) ||
            Boolean(c.awardNumber) ||
            ['CERTIFIED', 'CERTIFICATE_ISSUED', 'AWARDED', 'EXECUTION', 'EXECUTION_RULE107'].includes((c.status || c.caseStatus || '').toUpperCase())
        )
      );
      setExecutions(Array.isArray(execRes.data) ? execRes.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranchId, propEffectiveBranch]);

  const handleCreateExecution = async () => {
    if (!selectedCaseId) {
      alert('कृपया दाखला / निवाडा मंजूर झालेली केस निवडा.');
      return;
    }

    setSubmitting(true);
    try {
      const yr = (orderDate || bizDateStr).slice(0, 4);
      const res = await axios.post('/api/LegalRecovery/execution/create', {
        caseId: selectedCaseId,
        executionType,
        executionOrderNo: executionOrderNo || `EXEC/${yr}/${selectedCaseId}`,
        orderDate,
        warrantIssueDate: orderDate,
        sroName,
        employerName,
        employerAddress,
        monthlyDeductionAmount: executionType === 'SEC_49_SALARY' ? Number(monthlyDeductionAmount) || 0 : null,
        propertyDetails,
        estimatedValue: Number(estimatedValue) || 0,
        reservePrice: Number(reservePrice) || 0,
        auctionNoticeDate: auctionNoticeDate || null,
        auctionDate: auctionDate || null,
        remarks,
      });

      if (res.status === 200) {
        const result = res.data;
        alert('जप्ती / पगार कपात आदेश यशस्वीरीत्या नोंदवला गेला!');
        await fetchData();
        if (onDataChanged) onDataChanged();
        if (executionType === 'SEC_49_SALARY') {
          const selectedC = cases.find((c) => c.caseId === selectedCaseId);
          setPrintDoc({
            mode: 'SALARY_ORDER',
            record: {
              ...result,
              memberName: selectedC?.customerName || selectedC?.memberName,
              loanAccountNo: selectedC?.loanAccountNo,
              certificateNumber: selectedC?.certificateNumber || selectedC?.awardNumber,
              employerName,
              employerAddress,
              monthlyDeductionAmount,
              orderDate,
              executionOrderNo: executionOrderNo || `EXEC/${yr}/${selectedCaseId}`,
            },
          });
        }
        setExecutionOrderNo('');
        setRemarks('');
      }
    } catch (e: any) {
      alert('नोंद करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const openStageModal = (rec: ExecutionRecord) => {
    setStageExec(rec);
    const cur = (rec.executionStatus || rec.status || '').toUpperCase();
    const suggested = cur === 'WARRANT_ISSUED' ? 'ATTACHED' : cur === 'ATTACHED' ? 'AUCTION_SCHEDULED' : 'AUCTION_COMPLETED';
    setNextStageStatus(suggested);
    setStPanchanamaDate(rec.panchanamaDate || bizDateStr);
    const noticeBase = rec.auctionNoticeDate || bizDateStr;
    setStAuctionNoticeDate(noticeBase);
    const d31 = parseYmdAsLocalDate(noticeBase);
    d31.setDate(d31.getDate() + 31);
    setStAuctionDate(rec.auctionDate || formatLocalYmd(d31));
    setStReservePrice(rec.reservePrice || rec.estimatedValue || 0);
    setStHighestBidAmount(rec.highestBidAmount || 0);
    setStSpotDepositAmount(rec.spotDepositAmount || 0);
    setStBalanceDueDate(rec.balancePaymentDueDate || formatLocalYmd(d31));
    setStBuyerName(rec.buyerName || '');
    setStBuyerContact(rec.buyerContact || '');
    setStSaleCertNo(rec.saleCertificateNo || `SALE/${(bizDateStr || '').slice(0, 4)}/${rec.executionId}`);
    setStSaleCertDate(rec.saleCertificateDate || bizDateStr);
    setBypassThirtyDayCheck(false);
    setStRemarks('');
  };

  const handleUpdateStage = async () => {
    if (!stageExec) return;
    setUpdatingStage(true);
    try {
      await axios.put(`/api/LegalRecovery/execution/update-stage/${stageExec.executionId}`, {
        status: nextStageStatus,
        panchanamaDate: stPanchanamaDate || null,
        auctionNoticeDate: stAuctionNoticeDate || null,
        auctionDate: stAuctionDate || null,
        reservePrice: Number(stReservePrice) || 0,
        highestBidAmount: Number(stHighestBidAmount) || 0,
        spotDepositAmount: Number(stSpotDepositAmount) || 0,
        balancePaymentDueDate: stBalanceDueDate || null,
        buyerName: stBuyerName,
        buyerContact: stBuyerContact,
        saleCertificateNo: stSaleCertNo,
        saleCertificateDate: stSaleCertDate || null,
        bypassThirtyDayNoticeCheck: bypassThirtyDayCheck,
        remarks: stRemarks,
      });
      setStageExec(null);
      await fetchData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      alert('नियम १०७ टप्पा अपडेट करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setUpdatingStage(false);
    }
  };

  const openSettleModal = (rec: ExecutionRecord) => {
    setSettleExec(rec);
    setSettleAmount(rec.highestBidAmount || rec.reservePrice || rec.monthlyDeductionAmount || 0);
    setSettleDate(bizDateStr);
    setSettlePaymentMode('CASH');
    setSettleBankLedgerId(0);
    setSettleReferenceNo('');
    setSettleRemarks(`नियम १०७ वसुली / लिलाव सेटलमेंट - ${rec.caseNumber}`);
  };

  const handleSettleExecution = async () => {
    if (!settleExec) return;
    if (Number(settleAmount) <= 0) {
      alert('कृपया वैध वसुली रक्कम प्रविष्ट करा.');
      return;
    }
    if (settlePaymentMode === 'BANK_TRANSFER' && (!settleBankLedgerId || settleBankLedgerId <= 0)) {
      alert('बँक व्यवहारासाठी बँक जी.एल. खाते निवडा.');
      return;
    }

    setSettling(true);
    try {
      const res = await axios.post(`/api/LegalRecovery/execution/settle/${settleExec.executionId}`, {
        recoveredAmount: Number(settleAmount),
        settlementDate: settleDate,
        paymentMode: settlePaymentMode,
        bankLedgerId: settlePaymentMode === 'BANK_TRANSFER' ? settleBankLedgerId : null,
        referenceNo: settlePaymentMode === 'BANK_TRANSFER' ? settleReferenceNo : null,
        remarks: settleRemarks,
      });
      const r = res.data;
      alert(
        `नियम १०७ लिलाव वसुली व्हाउचर यशस्वीरीत्या तयार झाले!\n` +
          `व्हाउचर क्र.: ${r.voucherNo}\n` +
          `कर्जास जमा: ₹${Number(r.loanAppliedAmount || 0).toLocaleString('en-IN')}\n` +
          `कर्जदार अतिरिक्त रक्कम (Surplus): ₹${Number(r.surplusAmount || 0).toLocaleString('en-IN')}`
      );
      setSettleExec(null);
      await fetchData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      alert('सेटलमेंट व्हाउचर तयार करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setSettling(false);
    }
  };

  const caseSelectOptions = cases.map((c) => ({
    value: c.caseId,
    label: `${c.customerName || c.memberName} (CIF: ${c.cifNo || c.memberCode || '-'}) — ${c.certificateNumber || c.awardNumber || c.caseNumber}`,
    subLabel: `खाते: ${c.loanAccountNo} | मंजूर: ₹${Number(c.grantedAmount || c.sanctionedAmount || 0).toLocaleString('en-IN')}`,
  }));

  return (
    <div className={embedded ? 'max-w-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5' : 'p-2.5 max-w-full h-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5'}>
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } }`}</style>

      <div className={printDoc ? 'space-y-2.5 print:hidden' : 'space-y-2.5'}>
        {!embedded && (
          <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-primary shrink-0" />
                <h1 className="text-sm font-bold text-primary tracking-wide">नियम १०७ जप्ती, कलम ४९ पगार कपात व लिलाव (Rule 107 Lifecycle & Settlement)</h1>
              </div>
              <p className="text-slate-500 text-[10.5px] mt-0.5">
                कलम ४९ पगार कपात, नियम १०७ जप्ती पंचनामा, ३०-दिवसांचा लिलाव जाहीरनामा व लिलाव विक्री सेटलमेंट व्हाउचर.
              </p>
            </div>
          </div>
        )}

        {/* Branch Bar */}
        <div className="bg-white px-3 py-2 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">शाखा (Branch):</label>
            <select
              value={selectedBranchId}
              disabled={!isHo}
              onChange={(e) => setSelectedBranchId(Number(e.target.value))}
              className="border border-gray-300 rounded-sm px-2.5 py-1 text-xs font-semibold text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:bg-gray-100"
            >
              {branches.map((b) => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>
            <button type="button" onClick={fetchData} className="p-1.5 border border-gray-300 rounded-sm bg-white hover:bg-primary/10 hover:text-primary transition" title="रिफ्रेश करा">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <span className="text-[11px] text-gray-600 font-medium">
            दाखला / निवाडा मंजूर केसेस: <strong className="text-primary">{cases.length}</strong> | जप्ती/कपात नोंदी: <strong className="text-primary">{executions.length}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Left: Form */}
          <div className="lg:col-span-5 bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-primary border-l-4 border-primary pl-2 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <Plus className="w-4 h-4 text-primary" />
              नवीन जप्ती / पगार कपात आदेश (Create Execution)
            </h2>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-gray-700">दाखला / निवाडा मंजूर केस निवडा:</label>
                <div className="mt-0.5">
                  <SearchableSelect
                    options={caseSelectOptions}
                    value={selectedCaseId || ''}
                    onChange={(e) => setSelectedCaseId(Number(e.target.value) || null)}
                    placeholder="- दाखला मंजूर केस निवडा -"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-700">अंमलबजावणीचा प्रकार (Execution Type):</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { key: 'SEC_49_SALARY', title: 'कलम ४९ पगार कपात', sub: 'नियोक्ता आदेश' },
                    { key: 'RULE_107_IMMOVABLE', title: 'स्थावर मालमत्ता जप्ती', sub: 'नियम १०७ जमीन/घर' },
                    { key: 'MOVABLE_PROPERTY', title: 'जंगम मालमत्ता जप्ती', sub: 'वाहन / यंत्रसामग्री' },
                    { key: 'BANK_ACCOUNT_FREEZE', title: 'बँक खाते गोठवणे', sub: 'बँक / मुदत ठेव आदेश' },
                  ].map((et) => (
                    <button
                      key={et.key}
                      type="button"
                      onClick={() => setExecutionType(et.key)}
                      className={`p-2 rounded-sm text-left border transition ${
                        executionType === et.key ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs' : 'border-gray-200 text-gray-700 hover:bg-primary/5'
                      }`}
                    >
                      <div className="text-xs font-bold">{et.title}</div>
                      <div className="text-[10px] text-gray-500">{et.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-700">वॉरंट / आदेश क्र. (Order No.):</label>
                  <input type="text" value={executionOrderNo} onChange={(e) => setExecutionOrderNo(e.target.value)} placeholder="उदा. EXEC/2026/..." className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-700">वॉरंट जारी दिनांक (Order Date):</label>
                  <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>

              {executionType === 'SEC_49_SALARY' ? (
                <div className="bg-emerald-50/50 p-3 rounded-sm border border-emerald-200 space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-emerald-950">नियोक्ता / कंपनी / कार्यालयाचे नाव:</label>
                    <input type="text" value={employerName} onChange={(e) => setEmployerName(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1 text-xs font-bold bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-950">कार्यालयाचा संपूर्ण पत्ता:</label>
                    <input type="text" value={employerAddress} onChange={(e) => setEmployerAddress(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1 text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-950">मासिक पगार कपात रक्कम (₹):</label>
                    <input type="number" value={monthlyDeductionAmount} onChange={(e) => setMonthlyDeductionAmount(Number(e.target.value))} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1 text-xs font-bold text-emerald-800 bg-white" />
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50/50 p-3 rounded-sm border border-rose-200 space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-rose-950">विशेष वसुली अधिकारी (SRO Name):</label>
                    <input type="text" value={sroName} onChange={(e) => setSroName(e.target.value)} placeholder="श्री. विशेष वसुली अधिकारी..." className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1 text-xs font-bold bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-rose-950">मालमत्ता / खाते वर्णन (Property Details):</label>
                    <textarea rows={2} value={propertyDetails} onChange={(e) => setPropertyDetails(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm p-2 text-xs bg-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-rose-950">मूल्यांकन किंमत (₹):</label>
                      <input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(Number(e.target.value))} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs font-bold bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-rose-950">राखीव बोली किंमत (₹):</label>
                      <input type="number" value={reservePrice} onChange={(e) => setReservePrice(Number(e.target.value))} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs font-bold bg-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-rose-950">जाहीरनामा दिनांक (ऐच्छिक):</label>
                      <input type="date" value={auctionNoticeDate} onChange={(e) => setAuctionNoticeDate(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-rose-950">लिलाव दिनांक (ऐच्छिक):</label>
                      <input type="date" value={auctionDate} onChange={(e) => setAuctionDate(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white" />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-gray-700">शेरा (Remarks):</label>
                <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>

              <button
                type="button"
                onClick={handleCreateExecution}
                disabled={submitting || !selectedCaseId}
                className="w-full py-2 rounded-sm font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 bg-primary hover:opacity-95 text-white"
              >
                {submitting ? 'आदेश तयार होत आहे...' : 'जप्ती / कपात आदेश जारी करा'}
              </button>
            </div>
          </div>

          {/* Right: Executions List */}
          <div className="lg:col-span-7 bg-white rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs overflow-hidden">
            <div className="p-3 bg-gray-100/70 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xs font-bold text-gray-800">नियम १०७ जप्ती व कलम ४९ पगार कपात यादी ({executions.length})</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] text-gray-700 leading-tight border-collapse">
                <thead className="bg-[#5A1A14] text-[11px] font-bold text-amber-50 uppercase border-b">
                  <tr>
                    <th className="px-2 py-1.5.5 whitespace-nowrap">कर्जदार व दाखला</th>
                    <th className="px-2 py-1.5.5 whitespace-nowrap">प्रकार</th>
                    <th className="px-2 py-1.5.5 whitespace-nowrap">तपशील व रक्कम</th>
                    <th className="px-2 py-1.5.5 whitespace-nowrap">स्थिती</th>
                    <th className="px-2 py-1.5.5 text-center whitespace-nowrap">नियम १०७ टप्पे / प्रिंट</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {executions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-gray-400">
                        कोणतीही अंमलबजावणी नोंद आढळली नाही.
                      </td>
                    </tr>
                  ) : (
                    executions.map((e) => {
                      const stKey = (e.executionStatus || e.status || 'WARRANT_ISSUED').toUpperCase();
                      const stMeta = EXECUTION_STATUS_LABELS[stKey] || { label: stKey, cls: 'bg-slate-100 text-slate-800' };
                      return (
                        <tr key={e.executionId} className="hover:bg-gray-50/80 transition">
                          <td className="px-2 py-1 align-middle">
                            <div className="font-bold text-gray-900">{e.customerName || e.memberName}</div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              CIF: {e.cifNo || e.memberCode || '-'} | {e.certificateNumber || e.caseNumber}
                            </div>
                          </td>
                          <td className="px-2 py-1 align-middle">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                              {EXECUTION_TYPE_LABELS[e.executionType] || e.executionType}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-[10px] align-middle">
                            <div className="font-semibold text-gray-800 max-w-[180px] truncate">
                              {e.executionType.includes('SALARY') ? e.employerName || '-' : e.propertyDetails || '-'}
                            </div>
                            <div className="font-bold text-emerald-700">
                              {e.executionType.includes('SALARY')
                                ? `कपात: ₹${Number(e.monthlyDeductionAmount || 0).toLocaleString('en-IN')}/माह`
                                : e.highestBidAmount && e.highestBidAmount > 0
                                ? `विक्री बोली: ₹${e.highestBidAmount.toLocaleString('en-IN')}`
                                : `राखीव: ₹${Number(e.reservePrice || 0).toLocaleString('en-IN')}`}
                            </div>
                            {e.settlementVoucherNo && (
                              <div className="text-[9px] font-mono text-teal-800 font-bold">
                                सेटलमेंट: {e.settlementVoucherNo}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1 align-middle">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stMeta.cls}`}>{stMeta.label}</span>
                          </td>
                          <td className="px-2 py-1 align-middle">
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {stKey !== 'SETTLED' && stKey !== 'CANCELLED' && (
                                <>
                                  <button
                                    onClick={() => openStageModal(e)}
                                    className="bg-orange-50 hover:bg-orange-100 text-[#5A1A14] border border-amber-200 px-2 py-1 rounded text-[10px] font-bold inline-flex items-center gap-0.5"
                                  >
                                    <ArrowUpRight className="w-3 h-3" /> टप्पा
                                  </button>
                                  <button
                                    onClick={() => openSettleModal(e)}
                                    className="bg-teal-700 hover:bg-teal-800 text-white px-2 py-1 rounded text-[10px] font-bold inline-flex items-center gap-0.5"
                                  >
                                    <IndianRupee className="w-3 h-3" /> सेटलमेंट
                                  </button>
                                </>
                              )}
                              {e.executionType.includes('SALARY') ? (
                                <button
                                  onClick={() => setPrintDoc({ mode: 'SALARY_ORDER', record: e })}
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded text-[10px] font-bold border border-gray-300 inline-flex items-center gap-1"
                                >
                                  <Printer className="w-3 h-3" /> आदेश
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setPrintDoc({ mode: 'PANCHANAMA', record: e })}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-1.5 py-1 rounded text-[10px] font-bold border"
                                    title="जप्ती पंचनामा"
                                  >
                                    पंचनामा
                                  </button>
                                  <button
                                    onClick={() => setPrintDoc({ mode: stKey === 'AUCTION_COMPLETED' || stKey === 'SETTLED' ? 'SALE_CERT' : 'AUCTION_NOTICE', record: e })}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-1.5 py-1 rounded text-[10px] font-bold border"
                                  >
                                    {stKey === 'AUCTION_COMPLETED' || stKey === 'SETTLED' ? 'विक्री दाखला' : 'जाहीरनामा'}
                                  </button>
                                </>
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
        </div>
      </div>

      {/* Rule 107 Stage Modal */}
      {stageExec && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-sm border-t-4 border-t-primary max-w-lg w-full p-5 shadow-2xl space-y-3 text-xs">
            <h3 className="font-bold text-sm text-primary border-b pb-2">
              नियम १०७ अंमलबजावणी टप्पा अपडेट ({stageExec.caseNumber} - {stageExec.customerName || stageExec.memberName})
            </h3>

            <div>
              <label className="font-bold text-gray-700">पुढील टप्पा (Stage):</label>
              <select value={nextStageStatus} onChange={(e) => setNextStageStatus(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                <option value="ATTACHED">१. जप्ती व पंचनामा पूर्ण (ATTACHED)</option>
                <option value="AUCTION_SCHEDULED">२. लिलाव जाहीरनामा प्रसिद्ध (AUCTION_SCHEDULED)</option>
                <option value="AUCTION_COMPLETED">३. लिलाव विक्री व विक्री दाखला पूर्ण (AUCTION_COMPLETED)</option>
                <option value="CANCELLED">४. जप्ती/लिलाव रद्द (CANCELLED)</option>
              </select>
            </div>

            {nextStageStatus === 'ATTACHED' && (
              <div>
                <label className="font-bold text-gray-700">जप्ती पंचनामा दिनांक:</label>
                <input type="date" value={stPanchanamaDate} onChange={(e) => setStPanchanamaDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
            )}

            {nextStageStatus === 'AUCTION_SCHEDULED' && (
              <div className="space-y-2.5 bg-primary/5 p-3 rounded-sm border border-primary/20">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-gray-700">लिलाव जाहीरनामा दिनांक:</label>
                    <input type="date" value={stAuctionNoticeDate} onChange={(e) => setStAuctionNoticeDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1 bg-white" />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700">नियोजित लिलाव दिनांक (३० दिवसांनंतर):</label>
                    <input type="date" value={stAuctionDate} onChange={(e) => setStAuctionDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1 bg-white" />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-gray-700">राखीव किंमत (Reserve Price ₹):</label>
                  <input type="number" value={stReservePrice} onChange={(e) => setStReservePrice(Number(e.target.value))} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1 bg-white font-bold" />
                </div>
                <label className="flex items-center gap-1.5 font-semibold text-primary cursor-pointer">
                  <input type="checkbox" checked={bypassThirtyDayCheck} onChange={(e) => setBypassThirtyDayCheck(e.target.checked)} />
                  <span>अपवादात्मक ३०-दिवस मुदत तपासणी वगळा (SRO Override)</span>
                </label>
              </div>
            )}

            {nextStageStatus === 'AUCTION_COMPLETED' && (
              <div className="space-y-2 bg-emerald-50 p-3 rounded-sm border border-emerald-200">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-gray-700">खरेदीदाराचे नाव (Highest Bidder):</label>
                    <input type="text" value={stBuyerName} onChange={(e) => setStBuyerName(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1 bg-white font-bold" />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700">संपर्क / मोबाईल:</label>
                    <input type="text" value={stBuyerContact} onChange={(e) => setStBuyerContact(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1 bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-gray-700">अंतिम बोली रक्कम (₹):</label>
                    <input type="number" value={stHighestBidAmount} onChange={(e) => setStHighestBidAmount(Number(e.target.value))} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1 bg-white font-bold text-emerald-800" />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700">स्पॉट ठेव (किमान १५% ₹):</label>
                    <input type="number" value={stSpotDepositAmount} onChange={(e) => setStSpotDepositAmount(Number(e.target.value))} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1 bg-white font-bold" />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700">उर्वरित मुदत दिनांक:</label>
                    <input type="date" value={stBalanceDueDate} onChange={(e) => setStBalanceDueDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1 bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-gray-700">विक्री दाखला क्र. (Sale Cert No.):</label>
                    <input type="text" value={stSaleCertNo} onChange={(e) => setStSaleCertNo(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1 bg-white font-mono" />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700">विक्री दाखला दिनांक:</label>
                    <input type="date" value={stSaleCertDate} onChange={(e) => setStSaleCertDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1 bg-white" />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="font-bold text-gray-700">शेरा:</label>
              <input type="text" value={stRemarks} onChange={(e) => setStRemarks(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setStageExec(null)} className="px-4 py-1.5 rounded-sm bg-gray-100 font-bold text-gray-700">
                रद्द करा
              </button>
              <button type="button" onClick={handleUpdateStage} disabled={updatingStage} className="px-4 py-1.5 rounded-sm bg-primary hover:opacity-95 text-white font-bold">
                {updatingStage ? 'अपडेट होत आहे...' : 'टप्पा सेव्ह करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Atomic Rule 107 Settlement Modal */}
      {settleExec && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-sm border-t-4 border-t-primary max-w-md w-full p-5 shadow-2xl space-y-3.5 text-xs">
            <h3 className="font-bold text-sm text-primary border-b pb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              नियम १०७ वसुली / लिलाव सेटलमेंट (Atomic Voucher)
            </h3>

            <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2.5 text-[11px] text-emerald-950">
              <div><strong>कर्जदार:</strong> {settleExec.customerName || settleExec.memberName} ({settleExec.loanAccountNo})</div>
              <div><strong>प्राधान्य क्रम:</strong> १. कायदेशीर खर्च → २. दंडव्याज → ३. नियमित व्याज → ४. मुद्दल → ५. अतिरिक्त रक्कम (Surplus)</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-gray-700">वसूल / लिलाव रक्कम (₹):</label>
                <input type="number" value={settleAmount} onChange={(e) => setSettleAmount(Number(e.target.value))} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 font-black text-emerald-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="font-bold text-gray-700">सेटलमेंट दिनांक:</label>
                <input type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
            </div>

            <div>
              <label className="font-bold text-gray-700">जमा पद्धत (Payment Mode):</label>
              <select
                value={settlePaymentMode}
                onChange={(e) => {
                  setSettlePaymentMode(e.target.value);
                  if (e.target.value !== 'BANK_TRANSFER') {
                    setSettleBankLedgerId(0);
                    setSettleReferenceNo('');
                  }
                }}
                className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="CASH">रोख जमा (Cash Receipt)</option>
                <option value="BANK_TRANSFER">बँक जमा / चेक / RTGS (Bank Transfer)</option>
              </select>
            </div>

            {settlePaymentMode === 'BANK_TRANSFER' && (
              <div className="space-y-2 bg-primary/5 p-2.5 rounded-sm border border-primary/20">
                <BankLedgerSelect value={settleBankLedgerId} onChange={setSettleBankLedgerId} showCountBadge />
                <input
                  type="text"
                  placeholder="UTR / चेक क्र."
                  value={settleReferenceNo}
                  onChange={(e) => setSettleReferenceNo(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2.5 py-1 bg-white"
                />
              </div>
            )}

            <div>
              <label className="font-bold text-gray-700">शेरा:</label>
              <input type="text" value={settleRemarks} onChange={(e) => setSettleRemarks(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setSettleExec(null)} className="px-4 py-1.5 rounded-sm bg-gray-100 font-bold text-gray-700">
                रद्द करा
              </button>
              <button type="button" onClick={handleSettleExecution} disabled={settling} className="px-4 py-1.5 rounded-sm bg-primary hover:opacity-95 text-white font-bold">
                {settling ? 'व्हाउचर पोस्ट होत आहे...' : 'सेटलमेंट व्हाउचर पोस्ट करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Legal Documents Modal */}
      {printDoc && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:static print:bg-white print:p-0">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl space-y-5 print:shadow-none print:max-h-none print:p-2 print:overflow-visible">
            <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900 uppercase">
                {sanstha?.sansthaNameMarathi || sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h2>
              <p className="text-xs text-slate-600">{sanstha?.address}</p>
              <p className="text-xs text-slate-600">नोंदणी क्र.: {sanstha?.registrationNo || '-'}</p>
            </div>

            {printDoc.mode === 'SALARY_ORDER' && (
              <>
                <div className="text-center">
                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-extrabold px-4 py-1 rounded-full">
                    महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे कलम ४९ अन्वये पगार कपात आदेश पत्र
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <div>जावक क्र.: {printDoc.record.executionOrderNo}</div>
                  <div>दिनांक: {printDoc.record.orderDate}</div>
                </div>
                <div className="text-xs text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <div><strong>प्रति (नियोक्ता / आहरण व संवितरण अधिकारी):</strong></div>
                  <div className="font-bold">{printDoc.record.employerName || '-'}</div>
                  <div>{printDoc.record.employerAddress || '-'}</div>
                </div>
                <div className="text-xs text-slate-800 leading-relaxed space-y-3 text-justify">
                  <p>
                    <strong>विषय:</strong> कर्जदार श्री/श्रीमती <strong>{printDoc.record.customerName || printDoc.record.memberName}</strong> यांच्या मासिक वेतनातून दरमहा{' '}
                    <strong>₹{Number(printDoc.record.monthlyDeductionAmount || 0).toLocaleString('en-IN')}</strong> कलम ४९ अन्वये कपात करून संस्थेकडे जमा करणेबाबत.
                  </p>
                  <p>
                    <strong>संदर्भ:</strong> वसुली दाखला / निवाडा क्र. <strong>{printDoc.record.certificateNumber || printDoc.record.caseNumber}</strong> (कर्ज खाते: {printDoc.record.loanAccountNo}).
                  </p>
                  <p>
                    महोदय, उपरोक्त कर्जदारांनी थकबाकी भरलेली नसल्याने मा. निबंधक यांनी वसुली दाखला मंजूर केलेला आहे. सहकार कायदा कलम ४९(२) अन्वये संबंधित कर्मचाऱ्याच्या पगारातून दरमहा नमूद रक्कम कपात करून संस्थेस पाठवणे नियोक्त्यावर बंधनकारक आहे.
                  </p>
                </div>
              </>
            )}

            {printDoc.mode === 'PANCHANAMA' && (
              <>
                <div className="text-center">
                  <span className="bg-amber-100 text-[#5A1A14] border border-amber-300 text-xs font-extrabold px-4 py-1 rounded-full">
                    महाराष्ट्र सहकारी संस्था नियम १९६१ चे नियम १०७ अन्वये मालमत्ता जप्ती पंचनामा
                  </span>
                </div>
                <div className="text-xs space-y-2 text-slate-800">
                  <div><strong>प्रकरण व दाखला क्र.:</strong> {printDoc.record.caseNumber} / {printDoc.record.certificateNumber}</div>
                  <div><strong>थकबाकीदार कर्जदार:</strong> {printDoc.record.customerName || printDoc.record.memberName} (CIF: {printDoc.record.cifNo || '-'})</div>
                  <div><strong>विशेष वसुली अधिकारी (SRO):</strong> {printDoc.record.sroName || 'विशेष वसुली अधिकारी'}</div>
                  <div><strong>जप्ती पंचनामा दिनांक:</strong> {printDoc.record.panchanamaDate || printDoc.record.orderDate}</div>
                  <div className="bg-slate-50 border p-3 rounded-lg">
                    <strong>जप्त मालमत्तेचा तपशील व मूल्यांकन:</strong>
                    <p className="mt-1">{printDoc.record.propertyDetails || '-'}</p>
                    <p className="mt-1 font-bold">मूल्यांकन किंमत: ₹{Number(printDoc.record.estimatedValue || 0).toLocaleString('en-IN')} | राखीव किंमत: ₹{Number(printDoc.record.reservePrice || 0).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </>
            )}

            {printDoc.mode === 'AUCTION_NOTICE' && (
              <>
                <div className="text-center">
                  <span className="bg-rose-100 text-rose-900 border border-rose-300 text-xs font-extrabold px-4 py-1 rounded-full">
                    नियम १०७(११)(e) अन्वये जाहीर लिलाव जाहीरनामा (३० दिवस पूर्वसूचना)
                  </span>
                </div>
                <div className="text-xs space-y-2 text-slate-800 leading-relaxed">
                  <p>सर्व जनतेस जाहीर करण्यात येते की, थकबाकीदार <strong>{printDoc.record.customerName || printDoc.record.memberName}</strong> यांच्या जप्त केलेल्या खालील मालमत्तेचा जाहीर लिलाव दिनांक <strong>{printDoc.record.auctionDate || 'निश्चित केलेल्या दिनांकास'}</strong> रोजी घेण्यात येणार आहे.</p>
                  <div className="bg-slate-50 border p-3 rounded-lg">
                    <div><strong>मालमत्ता वर्णन:</strong> {printDoc.record.propertyDetails || '-'}</div>
                    <div><strong>जाहीरनामा दिनांक:</strong> {printDoc.record.auctionNoticeDate || printDoc.record.orderDate} | <strong>राखीव किंमत (Reserve Price):</strong> ₹{Number(printDoc.record.reservePrice || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </>
            )}

            {printDoc.mode === 'SALE_CERT' && (
              <>
                <div className="text-center">
                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-extrabold px-4 py-1 rounded-full">
                    नियम १०७ अन्वये लिलाव विक्री दाखला (Sale Confirmation Certificate)
                  </span>
                </div>
                <div className="text-xs space-y-2 text-slate-800 leading-relaxed">
                  <div><strong>विक्री दाखला क्र.:</strong> {printDoc.record.saleCertificateNo || '-'} | <strong>दिनांक:</strong> {printDoc.record.saleCertificateDate || '-'}</div>
                  <div className="bg-slate-50 border p-3 rounded-lg space-y-1">
                    <div><strong>खरेदीदार:</strong> {printDoc.record.buyerName || '-'} ({printDoc.record.buyerContact || '-'})</div>
                    <div><strong>अंतिम लिलाव विक्री रक्कम:</strong> ₹{Number(printDoc.record.highestBidAmount || 0).toLocaleString('en-IN')}</div>
                    <div><strong>मूळ कर्जदार व केस:</strong> {printDoc.record.customerName || printDoc.record.memberName} ({printDoc.record.caseNumber})</div>
                    <div><strong>मालमत्ता:</strong> {printDoc.record.propertyDetails || '-'}</div>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between items-end pt-8 text-xs font-bold text-slate-900">
              <div>प्रत माहितीसाठी: {printDoc.record.customerName || printDoc.record.memberName}</div>
              <div className="text-center space-y-6">
                <p>आपला विश्वासू,</p>
                <p>विशेष वसुली अधिकारी / शाखा व्यवस्थापक<br />{sanstha?.sansthaNameMarathi || sanstha?.sansthaName || 'सहकारी पतसंस्था'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <button onClick={() => window.print()} className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md">
                <Printer className="w-4 h-4" /> प्रिंट काढा
              </button>
              <button onClick={() => setPrintDoc(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-xl font-bold text-xs">
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
