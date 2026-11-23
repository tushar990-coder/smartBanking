import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Building2,
  Coins,
  PlusCircle,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Unlock,
  Banknote,
  Printer,
  AlertTriangle,
  CheckCircle2,
  Search,
  ShieldCheck,
  X
} from 'lucide-react';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';
import BankLedgerSelect from './common/BankLedgerSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';

interface BankBorrowingMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const BORROWING_TYPES = [
  { id: 'GOLD_REPLEDGE', label: '🏅 सोने तारण पुनर्गहाण कर्ज (Gold Re-pledge Refinance)' },
  { id: 'TERM_LOAN', label: '🏦 विना-सोने सामान्य मुदत कर्ज (General Term Loan / Refinance)' },
  { id: 'CASH_CREDIT_OD', label: '💳 कॅश क्रेडिट / ओव्हरड्राफ्ट (CC / OD Limit)' },
  { id: 'FD_AGAINST_LOAN', label: '📜 संस्थेच्या मुदत ठेवीवर कर्ज (Loan Against Sanstha FD)' }
];

const fmtAmt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function BankBorrowingMaster({ onNavigate }: BankBorrowingMasterProps = {}) {
  const { user } = useAuth();
  const activeBizDate = getBusinessDateStr(user?.businessDate);

  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Closed'>('Active');
  const [searchQuery, setSearchQuery] = useState('');

  // Masters & Data
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<any[]>([]);
  const [ownLockers, setOwnLockers] = useState<any[]>([]);
  const [externalLockers, setExternalLockers] = useState<any[]>([]);

  const [kpis, setKpis] = useState<any>(null);
  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [eligiblePackets, setEligiblePackets] = useState<any[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create Borrowing Form State
  const [form, setForm] = useState({
    lenderInstitutionID: '',
    lenderName: '',
    lenderBranchName: '',
    externalLoanAccountNo: '',
    borrowingType: 'GOLD_REPLEDGE',
    pledgedInvestmentAccountID: '',
    sanctionDate: activeBizDate,
    disbursementDate: activeBizDate,
    maturityDate: '',
    sanctionedAmount: '',
    disbursedAmount: '',
    borrowingInterestRate: '9.5',
    interestCalculationMethod: 'Reducing',
    installmentAmount: '',
    borrowingLiabilityLedgerID: '',
    interestExpenseLedgerID: '',
    paymentMode: 'Bank' as 'Bank' | 'Cash',
    bankLedgerID: 0,
    referenceNo: '',
    purposeOrLinkedLoansNote: '',
    remarks: ''
  });

  const [packetSearch, setPacketSearch] = useState('');
  const [selectedPacketLoans, setSelectedPacketLoans] = useState<Record<number, { selected: boolean; receiptNo: string }>>({});

  // Repayment Modal State
  const [repayTarget, setRepayTarget] = useState<any>(null);
  const [repayForm, setRepayForm] = useState({
    repaymentDate: activeBizDate,
    principalPaid: '',
    interestPaid: '',
    penalOrChargesPaid: '0',
    paymentMode: 'Bank' as 'Bank' | 'Cash',
    bankLedgerID: 0,
    referenceNo: '',
    remarks: '',
    returnCustodyStatus: '',
    returnOwnLockerID: '',
    returnExternalLockerID: '',
    releaseGoldCustodyIds: [] as number[]
  });

  // Standalone Unpledge Modal State
  const [unpledgeTarget, setUnpledgeTarget] = useState<any>(null);
  const [unpledgeIds, setUnpledgeIds] = useState<number[]>([]);
  const [unpledgeReturnStatus, setUnpledgeReturnStatus] = useState<string>('BRANCH_SAFE');
  const [unpledgeOwnLockerId, setUnpledgeOwnLockerId] = useState<string>('');
  const [unpledgeExtLockerId, setUnpledgeExtLockerId] = useState<string>('');
  const [unpledgeRemarks, setUnpledgeRemarks] = useState<string>('');

  useEffect(() => {
    loadAllData();
  }, [statusFilter]);

  useEffect(() => {
    if (tab === 'create') {
      loadEligibleGoldPackets();
    }
  }, [tab]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [mstRes, brwRes] = await Promise.all([
        axios.get('/api/Borrowings/masters'),
        axios.get('/api/Borrowings', { params: { status: statusFilter } })
      ]);

      const m = mstRes.data || {};
      setInstitutions(m.institutions || []);
      setLedgers(m.ledgers || []);
      setInvestmentAccounts(m.investmentAccounts || []);
      setOwnLockers(m.ownLockers || []);
      setExternalLockers(m.externalLockers || []);

      // Auto-preselect sensible Liability / Expense GL if only one or named clearly
      const liabLedgers = (m.ledgers || []).filter(
        (l: any) =>
          (l.natureOfGroup || '').toLowerCase() === 'liabilities' &&
          ((l.ledgerName || '').includes('देणे कर्ज') || (l.ledgerName || '').toLowerCase().includes('borrow'))
      );
      const expLedgers = (m.ledgers || []).filter(
        (l: any) =>
          (l.natureOfGroup || '').toLowerCase() === 'expenses' &&
          ((l.ledgerName || '').includes('व्याज') || (l.ledgerName || '').toLowerCase().includes('interest'))
      );
      setForm((prev) => ({
        ...prev,
        borrowingLiabilityLedgerID:
          prev.borrowingLiabilityLedgerID || (liabLedgers[0] ? String(liabLedgers[0].ledgerID) : ''),
        interestExpenseLedgerID:
          prev.interestExpenseLedgerID || (expLedgers[0] ? String(expLedgers[0].ledgerID) : '')
      }));

      setKpis(brwRes.data?.kpis || null);
      setBorrowings(brwRes.data?.items || []);
    } catch (err: any) {
      setErrorMsg('बाह्य कर्ज माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const loadEligibleGoldPackets = async () => {
    try {
      const res = await axios.get('/api/Borrowings/eligible-gold-packets');
      setEligiblePackets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed loading eligible gold packets:', err);
    }
  };

  const liabilityLedgerOptions = useMemo<SearchableSelectOption[]>(() => {
    return ledgers
      .filter((l) => {
        const acct = (l.accountType || '').toLowerCase();
        if (acct.includes('cash') || acct.includes('bank')) return false;
        return (l.natureOfGroup || '').toLowerCase() === 'liabilities';
      })
      .map((l) => ({
        value: l.ledgerID,
        label: `${l.ledgerName} (${l.ledgerCode || l.ledgerID})`,
        subLabel: `ID: ${l.ledgerID}${l.accountType ? ` | ${l.accountType}` : ''}`,
        badge: 'Liabilities (देयता)',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300'
      }));
  }, [ledgers]);

  const expenseLedgerOptions = useMemo<SearchableSelectOption[]>(() => {
    return ledgers
      .filter((l) => {
        const acct = (l.accountType || '').toLowerCase();
        if (acct.includes('cash') || acct.includes('bank')) return false;
        return (l.natureOfGroup || '').toLowerCase() === 'expenses';
      })
      .map((l) => ({
        value: l.ledgerID,
        label: `${l.ledgerName} (${l.ledgerCode || l.ledgerID})`,
        subLabel: `ID: ${l.ledgerID}${l.accountType ? ` | ${l.accountType}` : ''}`,
        badge: 'Expenses (खर्च)',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-300'
      }));
  }, [ledgers]);

  const selectedPacketsList = useMemo(() => {
    return eligiblePackets.filter((p) => selectedPacketLoans[p.loanAccountID]?.selected);
  }, [eligiblePackets, selectedPacketLoans]);

  const spreadSummary = useMemo(() => {
    const borrowRate = parseFloat(form.borrowingInterestRate || '0') || 0;
    if (selectedPacketsList.length === 0) {
      return {
        count: 0,
        netWt: 0,
        valuation: 0,
        customerLoanSum: 0,
        avgCustRate: 0,
        spread: 0
      };
    }
    const netWt = selectedPacketsList.reduce((s, p) => s + Number(p.totalNetWeight || 0), 0);
    const valuation = selectedPacketsList.reduce((s, p) => s + Number(p.totalValuationAmount || 0), 0);
    const customerLoanSum = selectedPacketsList.reduce((s, p) => s + Number(p.customerPrincipalBalance || 0), 0);
    const avgCustRate =
      selectedPacketsList.reduce((s, p) => s + Number(p.customerInterestRate || 0), 0) /
      selectedPacketsList.length;

    return {
      count: selectedPacketsList.length,
      netWt,
      valuation,
      customerLoanSum,
      avgCustRate: Math.round(avgCustRate * 100) / 100,
      spread: Math.round((avgCustRate - borrowRate) * 100) / 100
    };
  }, [selectedPacketsList, form.borrowingInterestRate]);

  const filteredBorrowings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return borrowings;
    return borrowings.filter(
      (b) =>
        (b.borrowingNo || '').toLowerCase().includes(q) ||
        (b.lenderName || '').toLowerCase().includes(q) ||
        (b.externalLoanAccountNo || '').toLowerCase().includes(q) ||
        (b.purposeOrLinkedLoansNote || '').toLowerCase().includes(q) ||
        (b.goldPledges || []).some(
          (p: any) =>
            (p.packetNumber || '').toLowerCase().includes(q) ||
            (p.borrowerName || '').toLowerCase().includes(q) ||
            (p.loanAccountNo || '').toLowerCase().includes(q)
        )
    );
  }, [borrowings, searchQuery]);

  const filteredEligiblePackets = useMemo(() => {
    const q = packetSearch.trim().toLowerCase();
    if (!q) return eligiblePackets;
    return eligiblePackets.filter(
      (p) =>
        (p.packetNumber || '').toLowerCase().includes(q) ||
        (p.loanAccountNo || '').toLowerCase().includes(q) ||
        (p.borrowerName || '').toLowerCase().includes(q) ||
        (p.cifNo || '').toLowerCase().includes(q)
    );
  }, [eligiblePackets, packetSearch]);

  const handleCreateBorrowing = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const disbAmt = parseFloat(form.disbursedAmount || '0');
    if (disbAmt <= 0) {
      setErrorMsg('कृपया घेतलेली कर्ज रक्कम ₹0 पेक्षा जास्त भरा.');
      return;
    }
    if (!form.borrowingLiabilityLedgerID || !form.interestExpenseLedgerID) {
      setErrorMsg('कृपया देणे कर्ज (Liability) आणि देणे कर्ज व्याज खर्च (Expense) ही दोन्ही GL लेजर्स निवडा.');
      return;
    }
    if (form.paymentMode === 'Bank' && (!form.bankLedgerID || form.bankLedgerID <= 0)) {
      setErrorMsg('बँक मोडसाठी बँक जी.एल. खाते निवडणे आवश्यक आहे.');
      return;
    }
    if (form.borrowingType === 'GOLD_REPLEDGE' && selectedPacketsList.length === 0) {
      setErrorMsg('सोने पुनर्गहाण कर्जासाठी किमान एक ग्राहक सोने पाकीट निवडा.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        branchID: Number(user?.branchID || 1),
        lenderInstitutionID: form.lenderInstitutionID ? Number(form.lenderInstitutionID) : null,
        lenderName: form.lenderName,
        lenderBranchName: form.lenderBranchName,
        externalLoanAccountNo: form.externalLoanAccountNo,
        borrowingType: form.borrowingType,
        pledgedInvestmentAccountID:
          form.borrowingType === 'FD_AGAINST_LOAN' && form.pledgedInvestmentAccountID
            ? Number(form.pledgedInvestmentAccountID)
            : null,
        sanctionDate: form.sanctionDate,
        disbursementDate: form.disbursementDate,
        maturityDate: form.maturityDate || null,
        sanctionedAmount: parseFloat(form.sanctionedAmount || form.disbursedAmount || '0'),
        disbursedAmount: disbAmt,
        borrowingInterestRate: parseFloat(form.borrowingInterestRate || '0'),
        interestCalculationMethod: form.interestCalculationMethod,
        installmentAmount: parseFloat(form.installmentAmount || '0'),
        borrowingLiabilityLedgerID: Number(form.borrowingLiabilityLedgerID),
        interestExpenseLedgerID: Number(form.interestExpenseLedgerID),
        paymentMode: form.paymentMode,
        bankLedgerID: form.paymentMode === 'Bank' ? form.bankLedgerID : null,
        referenceNo: form.referenceNo,
        purposeOrLinkedLoansNote: form.purposeOrLinkedLoansNote,
        remarks: form.remarks,
        goldPledges:
          form.borrowingType === 'GOLD_REPLEDGE'
            ? selectedPacketsList.map((p) => ({
                loanAccountID: p.loanAccountID,
                allocatedBorrowedAmount: 0,
                lenderPledgeReceiptNo: selectedPacketLoans[p.loanAccountID]?.receiptNo || ''
              }))
            : []
      };

      const res = await axios.post('/api/Borrowings', payload);
      setSuccessMsg(res.data?.message || 'बाह्य कर्ज यशस्वीरीत्या जतन झाले!');
      setSelectedPacketLoans({});
      setForm((prev) => ({
        ...prev,
        externalLoanAccountNo: '',
        sanctionedAmount: '',
        disbursedAmount: '',
        installmentAmount: '',
        referenceNo: '',
        purposeOrLinkedLoansNote: '',
        remarks: ''
      }));
      setTab('list');
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(typeof err.response?.data === 'string' ? err.response.data : 'बाह्य कर्ज जतन करताना त्रुटी आली.');
    } finally {
      setSubmitting(false);
    }
  };

  const openRepayModal = (b: any) => {
    setRepayTarget(b);
    const activePledgeCustodyIds = (b.goldPledges || [])
      .filter((p: any) => p.pledgeStatus === 'Pledged')
      .map((p: any) => p.goldCustodyID);

    setRepayForm({
      repaymentDate: activeBizDate,
      principalPaid: String(b.outstandingPrincipal || 0),
      interestPaid: '0',
      penalOrChargesPaid: '0',
      paymentMode: 'Bank',
      bankLedgerID: 0,
      referenceNo: '',
      remarks: '',
      returnCustodyStatus: '',
      returnOwnLockerID: '',
      returnExternalLockerID: '',
      releaseGoldCustodyIds: activePledgeCustodyIds
    });
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayTarget) return;
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await axios.post(`/api/Borrowings/${repayTarget.borrowingID}/repay`, {
        repaymentDate: repayForm.repaymentDate,
        principalPaid: parseFloat(repayForm.principalPaid || '0'),
        interestPaid: parseFloat(repayForm.interestPaid || '0'),
        penalOrChargesPaid: parseFloat(repayForm.penalOrChargesPaid || '0'),
        paymentMode: repayForm.paymentMode,
        bankLedgerID: repayForm.paymentMode === 'Bank' ? repayForm.bankLedgerID : null,
        referenceNo: repayForm.referenceNo,
        remarks: repayForm.remarks,
        releaseGoldCustodyIds: repayForm.releaseGoldCustodyIds,
        returnCustodyStatus: repayForm.returnCustodyStatus || null,
        returnOwnLockerID: repayForm.returnOwnLockerID ? Number(repayForm.returnOwnLockerID) : null,
        returnExternalLockerID: repayForm.returnExternalLockerID ? Number(repayForm.returnExternalLockerID) : null
      });

      setSuccessMsg(res.data?.message || 'परतफेड यशस्वीरीत्या नोंदवली!');
      setRepayTarget(null);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(typeof err.response?.data === 'string' ? err.response.data : 'परतफेड नोंदवताना त्रुटी आली.');
    } finally {
      setSubmitting(false);
    }
  };

  const openUnpledgeModal = (b: any) => {
    setUnpledgeTarget(b);
    const closedCustomerLoanIds = (b.goldPledges || [])
      .filter((p: any) => p.pledgeStatus === 'Pledged' && (p.loanStatus === 'Closed' || p.loanPrincipalBalance <= 0))
      .map((p: any) => p.goldCustodyID);
    setUnpledgeIds(closedCustomerLoanIds);
    setUnpledgeReturnStatus('BRANCH_SAFE');
    setUnpledgeOwnLockerId('');
    setUnpledgeExtLockerId('');
    setUnpledgeRemarks('');
  };

  const handleUnpledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unpledgeTarget || unpledgeIds.length === 0) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await axios.post(`/api/Borrowings/${unpledgeTarget.borrowingID}/unpledge-packets`, {
        goldCustodyIds: unpledgeIds,
        releaseDate: activeBizDate,
        returnCustodyStatus: unpledgeReturnStatus,
        returnOwnLockerID: unpledgeReturnStatus === 'OWN_LOCKER' ? Number(unpledgeOwnLockerId || 0) : null,
        returnExternalLockerID: unpledgeReturnStatus === 'EXTERNAL_LOCKER' ? Number(unpledgeExtLockerId || 0) : null,
        remarks: unpledgeRemarks || 'बाह्य कर्जातून सोने पाकीट सोडवले'
      });
      setSuccessMsg(res.data?.message || 'सोने पाकीट यशस्वीरीत्या सोडवले गेले!');
      setUnpledgeTarget(null);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(typeof err.response?.data === 'string' ? err.response.data : 'पाकीट सोडवताना त्रुटी आली.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintRegister = () => {
    const rowsHtml = filteredBorrowings
      .map(
        (b, i) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${b.borrowingNo}<br/><small>${b.externalLoanAccountNo || ''}</small></td>
          <td>${b.lenderName} ${b.lenderBranchName ? `(${b.lenderBranchName})` : ''}</td>
          <td>${b.borrowingType}</td>
          <td style="text-align:center">${new Date(b.disbursementDate).toLocaleDateString('en-GB')}</td>
          <td style="text-align:right">${fmtAmt(b.disbursedAmount)}</td>
          <td style="text-align:right;font-weight:bold">${fmtAmt(b.outstandingPrincipal)}</td>
          <td style="text-align:center">${b.borrowingInterestRate}%</td>
          <td style="text-align:center">${b.activePledgedCount} पाकिटे (${fmtWt(b.totalPledgedNetWeight)}g)</td>
          <td style="text-align:center">${b.status}</td>
        </tr>`
      )
      .join('');

    const win = window.open('', '_blank', 'width=1150,height=780');
    if (!win) return;
    win.document.write(`
      <html><head><title>बाह्य कर्जे व सोने पुनर्गहाण रजिस्टर</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; padding: 18px; }
        h2, h4 { margin: 2px 0; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #334155; padding: 5px 6px; }
        th { background: #e2e8f0; }
        @media print { @page { size: landscape; margin: 10mm; } }
      </style></head><body>
        <h2>संस्थेची बाह्य कर्जे व सोने पुनर्गहाण नोंदवही (Bank &amp; Society Borrowings Register)</h2>
        <h4>दिनांक: ${activeBizDate} | एकूण येणे बाकी: ₹${fmtAmt(kpis?.totalOutstandingPrincipal)}</h4>
        <table>
          <thead>
            <tr>
              <th>अ.क्र.</th><th>बाह्य कर्ज क्र.</th><th>बँक / पतसंस्थेचे नाव</th><th>प्रकार</th>
              <th>दिनांक</th><th>घेतलेली रक्कम (₹)</th><th>देणे बाकी (₹)</th><th>व्याजदर</th><th>पुनर्गहाण दागिने</th><th>स्थिती</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Header */}
      <div className="bg-primary px-3.5 py-2.5 text-white rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-white/15">
            <Building2 size={18} />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold">
              बाह्य कर्जे व सोने पुनर्गहाण व्यवस्थापन (Bank &amp; Patsanstha Borrowings)
            </h1>
            <p className="text-[10.5px] text-blue-100">
              इतर पतसंस्था किंवा बँकेकडून कमी व्याजदराने सोने पुनर्गहाण कर्ज / विना-सोने निधी कर्ज घेणे, व्याज मार्जिन व परतफेड ट्रॅकिंग
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('loan-documents')}
              className="px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-white font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ShieldCheck size={13} /> तारण व दागिने कस्टडी ट्रॅकर
            </button>
          )}
          <button
            type="button"
            onClick={handlePrintRegister}
            className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Printer size={13} /> रजिस्टर छापा
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="bg-white border border-slate-300 rounded-sm p-2.5 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-semibold">चालू बाह्य कर्जे (देणे बाकी)</div>
            <div className="text-sm font-extrabold text-rose-700 font-mono">
              ₹{fmtAmt(kpis.totalOutstandingPrincipal)}
            </div>
            <div className="text-[10px] text-slate-600">{kpis.activeBorrowingsCount} सक्रिय बाह्य कर्ज खाती</div>
          </div>

          <div className="bg-white border border-slate-300 rounded-sm p-2.5 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-semibold">पुनर्गहाण ठेवलेली सोने पाकिटे</div>
            <div className="text-sm font-extrabold text-purple-800 font-mono">
              {kpis.activeRepledgedPacketsCount} पाकिटे
            </div>
            <div className="text-[10px] text-slate-600">एकूण निव्वळ वजन: {fmtWt(kpis.totalRepledgedNetWeight)} ग्रॅम</div>
          </div>

          <div className="bg-white border border-slate-300 rounded-sm p-2.5 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-semibold">सरासरी बाह्य कर्ज व्याजदर</div>
            <div className="text-sm font-extrabold text-slate-900 font-mono">
              {kpis.weightedBorrowingRate}%
            </div>
            <div className="text-[10px] text-slate-600">ग्राहक कर्ज सरासरी दर: {kpis.avgCustomerLendingRate}%</div>
          </div>

          <div className="bg-white border border-emerald-300 bg-emerald-50/40 rounded-sm p-2.5 shadow-2xs">
            <div className="text-[10px] text-emerald-800 font-semibold flex items-center gap-1">
              <TrendingUp size={12} /> संस्थेचा निव्वळ व्याज नफा फरक (Spread)
            </div>
            <div className="text-sm font-extrabold text-emerald-800 font-mono">
              {kpis.netInterestSpreadPercent >= 0 ? '+' : ''}
              {kpis.netInterestSpreadPercent}%
            </div>
            <div className="text-[10px] text-emerald-700">कमी दरात कर्ज घेऊन जास्त दरात वाटप</div>
          </div>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex border-b border-slate-300 gap-1">
        <button
          type="button"
          onClick={() => setTab('list')}
          className={`px-4 py-2 font-bold text-xs rounded-t border-t border-x cursor-pointer ${
            tab === 'list'
              ? 'bg-white text-primary border-slate-300 -mb-px'
              : 'bg-slate-100 text-slate-600 border-transparent'
          }`}
        >
          📋 बाह्य कर्ज खाती, परतफेड व पाकीट सोडवणे ({borrowings.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('create')}
          className={`px-4 py-2 font-bold text-xs rounded-t border-t border-x cursor-pointer flex items-center gap-1 ${
            tab === 'create'
              ? 'bg-white text-primary border-slate-300 -mb-px'
              : 'bg-slate-100 text-slate-600 border-transparent'
          }`}
        >
          <PlusCircle size={14} /> नवीन बाह्य कर्ज नोंदवा (सोने पुनर्गहाण / विना-सोने निधी कर्ज)
        </button>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded border border-red-300 bg-red-50 text-red-800 font-semibold flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={15} /> <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} /> <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* TAB 1: BORROWING ACCOUNTS LIST, REPAYMENT & UNPLEDGE */}
      {tab === 'list' && (
        <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-2xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {(['Active', 'Closed', 'all'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                    statusFilter === st
                      ? 'bg-primary text-white border-primary'
                      : 'bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  {st === 'Active' ? 'चालू (Active)' : st === 'Closed' ? 'बंद (Closed)' : 'सर्व'}
                </button>
              ))}
            </div>

            <div className="relative w-72">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="बँक नाव, कर्ज क्र., पाकीट किंवा ग्राहक शोधा..."
                className="w-full pl-7 pr-2 py-1 border border-slate-300 rounded text-xs"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">बाह्य कर्ज माहिती लोड होत आहे...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead className="bg-slate-100 text-slate-800">
                  <tr>
                    <th className="border px-2 py-1.5 w-8"></th>
                    <th className="border px-2 py-1.5 text-left">कर्ज क्र. व दिनांक</th>
                    <th className="border px-2 py-1.5 text-left">कर्ज देणारी बँक / पतसंस्था</th>
                    <th className="border px-2 py-1.5 text-left">प्रकार</th>
                    <th className="border px-2 py-1.5 text-right">घेतलेली रक्कम</th>
                    <th className="border px-2 py-1.5 text-right">देणे मुद्दल बाकी</th>
                    <th className="border px-2 py-1.5 text-center">व्याजदर (मार्जिन)</th>
                    <th className="border px-2 py-1.5 text-center">पुनर्गहाण पाकिटे</th>
                    <th className="border px-2 py-1.5 text-center">कृती</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBorrowings.map((b) => {
                    const isExp = Boolean(expandedIds[b.borrowingID]);
                    const hasClosedMemberLoanAlert = (b.goldPledges || []).some(
                      (p: any) =>
                        p.pledgeStatus === 'Pledged' &&
                        (p.loanStatus === 'Closed' || p.loanPrincipalBalance <= 0)
                    );

                    return (
                      <React.Fragment key={b.borrowingID}>
                        <tr className={`hover:bg-slate-50 ${hasClosedMemberLoanAlert ? 'bg-amber-50/70' : ''}`}>
                          <td className="border px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedIds((prev) => ({ ...prev, [b.borrowingID]: !prev[b.borrowingID] }))
                              }
                              className="cursor-pointer text-slate-600"
                            >
                              {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          <td className="border px-2 py-1.5">
                            <div className="font-bold font-mono text-primary">{b.borrowingNo}</div>
                            <div className="text-[10px] text-slate-500">
                              दि. {new Date(b.disbursementDate).toLocaleDateString('en-GB')}
                              {b.disbursementVoucherStatus === 'Pending' && (
                                <span className="ml-1 px-1 rounded bg-amber-100 text-amber-900 font-bold">
                                  व्हाउचर प्रलंबित
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="border px-2 py-1.5">
                            <div className="font-bold text-slate-900">{b.lenderName}</div>
                            <div className="text-[10px] text-slate-500">
                              {b.lenderBranchName ? `${b.lenderBranchName} • ` : ''}
                              {b.externalLoanAccountNo ? `A/c: ${b.externalLoanAccountNo}` : ''}
                            </div>
                          </td>
                          <td className="border px-2 py-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-semibold text-[10px]">
                              {b.borrowingType === 'GOLD_REPLEDGE'
                                ? '🏅 सोने पुनर्गहाण'
                                : b.borrowingType === 'TERM_LOAN'
                                ? '🏦 मुदत कर्ज'
                                : b.borrowingType === 'CASH_CREDIT_OD'
                                ? '💳 CC / OD'
                                : '📜 ठेव तारण'}
                            </span>
                            {hasClosedMemberLoanAlert && (
                              <div className="text-[9.5px] font-bold text-red-700 mt-0.5">
                                ⚠️ ग्राहकाचे कर्ज फिटले — पाकीट सोडवा!
                              </div>
                            )}
                          </td>
                          <td className="border px-2 py-1.5 text-right font-mono">₹{fmtAmt(b.disbursedAmount)}</td>
                          <td className="border px-2 py-1.5 text-right font-mono font-bold text-rose-700">
                            ₹{fmtAmt(b.outstandingPrincipal)}
                          </td>
                          <td className="border px-2 py-1.5 text-center font-mono">
                            <div className="font-bold">{b.borrowingInterestRate}%</div>
                            {b.avgCustomerRate > 0 && (
                              <div className="text-[9.5px] text-emerald-700 font-bold">
                                मार्जिन: {b.avgSpreadPercent >= 0 ? '+' : ''}{b.avgSpreadPercent}%
                              </div>
                            )}
                          </td>
                          <td className="border px-2 py-1.5 text-center">
                            {b.borrowingType === 'GOLD_REPLEDGE' ? (
                              <span className="font-bold text-purple-800">
                                {b.activePledgedCount} चालू ({fmtWt(b.totalPledgedNetWeight)}g)
                              </span>
                            ) : (
                              <span className="text-slate-400">विना-सोने</span>
                            )}
                          </td>
                          <td className="border px-2 py-1.5 text-center">
                            {b.status === 'Active' ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openRepayModal(b)}
                                  className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                >
                                  <Banknote size={11} /> परतफेड
                                </button>
                                {b.activePledgedCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => openUnpledgeModal(b)}
                                    className="px-2 py-1 rounded bg-purple-700 hover:bg-purple-800 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                    title="फक्त निवडक सोने पाकीट सोडवा"
                                  >
                                    <Unlock size={11} /> पाकीट सोडवा
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                ✓ पूर्ण बंद
                              </span>
                            )}
                          </td>
                        </tr>

                        {isExp && (
                          <tr className="bg-slate-50">
                            <td colSpan={9} className="border p-3 space-y-3">
                              {b.purposeOrLinkedLoansNote && (
                                <div className="text-[11px] text-slate-700">
                                  <strong>कर्जाचा उद्देश / संलग्न माहिती:</strong> {b.purposeOrLinkedLoansNote}
                                </div>
                              )}

                              {b.goldPledges && b.goldPledges.length > 0 && (
                                <div>
                                  <div className="font-bold text-purple-900 mb-1">
                                    पुनर्गहाण ठेवलेली ग्राहक सोने पाकिटे ({b.goldPledges.length})
                                  </div>
                                  <table className="w-full border-collapse text-[10.5px] bg-white">
                                    <thead className="bg-purple-50">
                                      <tr>
                                        <th className="border px-2 py-1 text-left">पाकीट क्र.</th>
                                        <th className="border px-2 py-1 text-left">ग्राहक कर्ज खाते व नाव</th>
                                        <th className="border px-2 py-1 text-right">वजन (g)</th>
                                        <th className="border px-2 py-1 text-center">ग्राहक दर vs बाह्य दर</th>
                                        <th className="border px-2 py-1 text-right">ग्राहक कर्ज बाकी</th>
                                        <th className="border px-2 py-1 text-center">पुनर्गहाण स्थिती</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {b.goldPledges.map((p: any) => (
                                        <tr key={p.borrowingGoldPledgeID}>
                                          <td className="border px-2 py-1 font-mono font-bold">{p.packetNumber}</td>
                                          <td className="border px-2 py-1">
                                            {p.loanAccountNo} — {p.borrowerName}
                                          </td>
                                          <td className="border px-2 py-1 text-right font-mono">{fmtWt(p.netWeight)}</td>
                                          <td className="border px-2 py-1 text-center font-mono">
                                            {p.customerLoanInterestRate}% - {b.borrowingInterestRate}% ={' '}
                                            <strong className="text-emerald-700">+{p.interestSpreadPercent}%</strong>
                                          </td>
                                          <td className="border px-2 py-1 text-right font-mono">
                                            ₹{fmtAmt(p.loanPrincipalBalance)}{' '}
                                            {p.loanPrincipalBalance <= 0 && (
                                              <span className="ml-1 px-1 rounded bg-red-100 text-red-800 font-bold">
                                                ग्राहक कर्ज बंद!
                                              </span>
                                            )}
                                          </td>
                                          <td className="border px-2 py-1 text-center">
                                            {p.pledgeStatus === 'Pledged' ? (
                                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-bold">
                                                पुनर्गहाण चालू
                                              </span>
                                            ) : (
                                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                                सोडवले ({p.releasedDate ? new Date(p.releasedDate).toLocaleDateString('en-GB') : ''})
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {b.repayments && b.repayments.length > 0 && (
                                <div>
                                  <div className="font-bold text-slate-800 mb-1">
                                    परतफेड इतिहास ({b.repayments.length})
                                  </div>
                                  <table className="w-full border-collapse text-[10.5px] bg-white">
                                    <thead className="bg-slate-100">
                                      <tr>
                                        <th className="border px-2 py-1 text-left">दिनांक</th>
                                        <th className="border px-2 py-1 text-right">मुद्दल परतफेड</th>
                                        <th className="border px-2 py-1 text-right">व्याज खर्च</th>
                                        <th className="border px-2 py-1 text-right">एकूण भरणा</th>
                                        <th className="border px-2 py-1 text-left">व्हाउचर क्र. व स्थिती</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {b.repayments.map((r: any) => (
                                        <tr key={r.borrowingRepaymentID}>
                                          <td className="border px-2 py-1 font-mono">
                                            {new Date(r.repaymentDate).toLocaleDateString('en-GB')}
                                          </td>
                                          <td className="border px-2 py-1 text-right font-mono">₹{fmtAmt(r.principalPaid)}</td>
                                          <td className="border px-2 py-1 text-right font-mono">
                                            ₹{fmtAmt((r.interestPaid || 0) + (r.penalOrChargesPaid || 0))}
                                          </td>
                                          <td className="border px-2 py-1 text-right font-mono font-bold">
                                            ₹{fmtAmt(r.totalPaid)}
                                          </td>
                                          <td className="border px-2 py-1 font-mono">
                                            {r.voucherNo} ({r.voucherStatus})
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {filteredBorrowings.length === 0 && (
                    <tr>
                      <td colSpan={9} className="border p-8 text-center text-slate-500">
                        कोणतीही बाह्य कर्ज नोंद आढळली नाही.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATE NEW BORROWING (GOLD RE-PLEDGE OR GENERAL NON-GOLD BORROWING) */}
      {tab === 'create' && (
        <form onSubmit={handleCreateBorrowing} className="space-y-3">
          <div className="bg-white border border-slate-300 rounded-sm p-3.5 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-primary border-b pb-1.5">
              १. कर्ज देणारी संस्था, कर्ज प्रकार व आर्थिक तपशील
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">बाह्य कर्जाचा प्रकार *</label>
                <select
                  value={form.borrowingType}
                  onChange={(e) => setForm((p) => ({ ...p, borrowingType: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                >
                  {BORROWING_TYPES.map((bt) => (
                    <option key={bt.id} value={bt.id}>
                      {bt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  नोंदणीकृत बँक / पतसंस्था निवडा
                </label>
                <select
                  value={form.lenderInstitutionID}
                  onChange={(e) => {
                    const id = e.target.value;
                    const inst = institutions.find((i) => String(i.institutionID) === id);
                    setForm((p) => ({
                      ...p,
                      lenderInstitutionID: id,
                      lenderName: inst ? inst.institutionName : p.lenderName,
                      lenderBranchName: inst ? inst.institutionBranchName || '' : p.lenderBranchName
                    }));
                  }}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white"
                >
                  <option value="">-- किंवा पुढे थेट नाव टाका --</option>
                  {institutions.map((i) => (
                    <option key={i.institutionID} value={i.institutionID}>
                      {i.institutionName} ({i.institutionBranchName || i.institutionType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  बँक / पतसंस्थेचे नाव *
                </label>
                <input
                  type="text"
                  required
                  value={form.lenderName}
                  onChange={(e) => setForm((p) => ({ ...p, lenderName: e.target.value }))}
                  placeholder="उदा. जिल्हा मध्यवर्ती सहकारी बँक"
                  className="w-full border border-slate-300 rounded px-2 py-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">शाखा नाव</label>
                <input
                  type="text"
                  value={form.lenderBranchName}
                  onChange={(e) => setForm((p) => ({ ...p, lenderBranchName: e.target.value }))}
                  placeholder="मुख्य शाखा"
                  className="w-full border border-slate-300 rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  त्या संस्थेतील कर्ज खाते क्र.
                </label>
                <input
                  type="text"
                  value={form.externalLoanAccountNo}
                  onChange={(e) => setForm((p) => ({ ...p, externalLoanAccountNo: e.target.value }))}
                  placeholder="उदा. GL-CC-4092"
                  className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">कर्ज घेतलेला दिनांक *</label>
                <input
                  type="date"
                  required
                  value={form.disbursementDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, disbursementDate: e.target.value, sanctionDate: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">मुदतपूर्ती दिनांक</label>
                <input
                  type="date"
                  value={form.maturityDate}
                  onChange={(e) => setForm((p) => ({ ...p, maturityDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-primary mb-0.5">बाह्य कर्ज व्याजदर (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={form.borrowingInterestRate}
                  onChange={(e) => setForm((p) => ({ ...p, borrowingInterestRate: e.target.value }))}
                  className="w-full border border-primary rounded px-2 py-1 font-mono font-bold bg-blue-50/40"
                />
              </div>
            </div>

            {form.borrowingType === 'FD_AGAINST_LOAN' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  तारण ठेवलेली संस्थेची मुदत ठेव निवडा (Sanstha Investment FD)
                </label>
                <select
                  value={form.pledgedInvestmentAccountID}
                  onChange={(e) => setForm((p) => ({ ...p, pledgedInvestmentAccountID: e.target.value }))}
                  className="w-full max-w-lg border border-slate-300 rounded px-2 py-1 bg-white"
                >
                  <option value="">-- गुंतवणूक FD निवडा --</option>
                  {investmentAccounts.map((ia) => (
                    <option key={ia.investmentAccountID} value={ia.investmentAccountID}>
                      {ia.investmentNo} ({ia.institutionName}) — ₹{fmtAmt(ia.principalAmount)} @ {ia.interestRate}%
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-emerald-800 mb-0.5">
                  प्रत्यक्ष घेतलेली कर्ज रक्कम (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={1}
                  required
                  value={form.disbursedAmount}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      disbursedAmount: e.target.value,
                      sanctionedAmount: p.sanctionedAmount || e.target.value
                    }))
                  }
                  placeholder="0.00"
                  className="w-full border border-emerald-500 rounded px-2 py-1.5 font-mono font-bold text-right bg-emerald-50/30"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">मंजूर मर्यादा रक्कम (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.sanctionedAmount}
                  onChange={(e) => setForm((p) => ({ ...p, sanctionedAmount: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono text-right"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  निधीचा वापर / संलग्न ग्राहक कर्जे टीप (विना-सोने कर्जासाठी उपयुक्त)
                </label>
                <input
                  type="text"
                  value={form.purposeOrLinkedLoansNote}
                  onChange={(e) => setForm((p) => ({ ...p, purposeOrLinkedLoansNote: e.target.value }))}
                  placeholder="उदा. वैयक्तिक / वाहन कर्ज वाटपासाठी जिल्हा बँक निधी वापरला"
                  className="w-full border border-slate-300 rounded px-2 py-1.5"
                />
              </div>
            </div>

            {/* GL Mapping & Payment Mode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  देणे कर्ज मुद्दल GL खाते (Borrowing Liability Ledger) *
                </label>
                <SearchableSelect
                  value={form.borrowingLiabilityLedgerID}
                  options={liabilityLedgerOptions}
                  onChange={(e) => setForm((p) => ({ ...p, borrowingLiabilityLedgerID: String(e.target.value || '') }))}
                  placeholder="-- Liabilities (देणे कर्जे) लेजर निवडा --"
                  minMenuWidth={420}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  देणे कर्ज व्याज खर्च GL खाते (Interest Expense Ledger) *
                </label>
                <SearchableSelect
                  value={form.interestExpenseLedgerID}
                  options={expenseLedgerOptions}
                  onChange={(e) => setForm((p) => ({ ...p, interestExpenseLedgerID: String(e.target.value || '') }))}
                  placeholder="-- Expenses (व्याज खर्च) लेजर निवडा --"
                  minMenuWidth={420}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">निधी प्राप्ती पद्धत *</label>
                <select
                  value={form.paymentMode}
                  onChange={(e) => setForm((p) => ({ ...p, paymentMode: e.target.value as 'Bank' | 'Cash' }))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                >
                  <option value="Bank">बँक खात्यात जमा (Bank / RTGS / NEFT)</option>
                  <option value="Cash">रोख प्राप्ती (Cash)</option>
                </select>
              </div>

              {form.paymentMode === 'Bank' && (
                <div>
                  <BankLedgerSelect
                    value={form.bankLedgerID}
                    onChange={(id) => setForm((p) => ({ ...p, bankLedgerID: id }))}
                    label="संस्थेचे बँक जी.एल. खाते निवडा *"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">UTR / चेक / संदर्भ क्र.</label>
                <input
                  type="text"
                  value={form.referenceNo}
                  onChange={(e) => setForm((p) => ({ ...p, referenceNo: e.target.value }))}
                  placeholder="UTR / Cheque No."
                  className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                />
              </div>
            </div>
          </div>

          {/* GOLD RE-PLEDGE PACKET SELECTION SECTION */}
          {form.borrowingType === 'GOLD_REPLEDGE' && (
            <div className="bg-white border-2 border-amber-300 rounded-sm p-3.5 shadow-2xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div>
                  <h2 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Coins size={15} className="text-amber-600" /> २. पुनर्गहाण ठेवण्यासाठी ग्राहक सोने तारण पाकिटे निवडा
                  </h2>
                  <p className="text-[10.5px] text-slate-600">
                    निवडलेल्या पाकिटांचे कस्टडी ठिकाण आपोआप या बाह्य कर्जाशी जोडले जाईल आणि जोपर्यंत पाकीट सोडवत नाही तोपर्यंत ते ट्रॅक राहील.
                  </p>
                </div>

                <div className="relative w-64">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={packetSearch}
                    onChange={(e) => setPacketSearch(e.target.value)}
                    placeholder="पाकीट क्र., खाते क्र., ग्राहक नाव शोधा..."
                    className="w-full pl-7 pr-2 py-1 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              {/* Live Spread Comparison Banner */}
              {spreadSummary.count > 0 && (
                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                  <div>
                    निवडलेली पाकिटे: <strong>{spreadSummary.count}</strong> | निव्वळ वजन:{' '}
                    <strong>{fmtWt(spreadSummary.netWt)}g</strong> | मूल्यांकन:{' '}
                    <strong>₹{fmtAmt(spreadSummary.valuation)}</strong>
                  </div>
                  <div>
                    सरासरी ग्राहक कर्ज दर: <strong>{spreadSummary.avgCustRate}%</strong> vs बाह्य कर्ज दर:{' '}
                    <strong>{form.borrowingInterestRate || 0}%</strong> ➔ संस्थेचा निव्वळ व्याज मार्जिन:{' '}
                    <strong className={spreadSummary.spread >= 0 ? 'text-emerald-800' : 'text-red-700'}>
                      {spreadSummary.spread >= 0 ? '+' : ''}{spreadSummary.spread}%
                    </strong>
                  </div>
                </div>
              )}

              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead className="bg-amber-50 sticky top-0">
                    <tr>
                      <th className="border px-2 py-1.5 w-8 text-center">निवडा</th>
                      <th className="border px-2 py-1.5 text-left">पाकीट क्र.</th>
                      <th className="border px-2 py-1.5 text-left">ग्राहक कर्ज खाते व नाव</th>
                      <th className="border px-2 py-1.5 text-right">निव्वळ वजन (g)</th>
                      <th className="border px-2 py-1.5 text-right">मूल्यांकन (₹)</th>
                      <th className="border px-2 py-1.5 text-right">ग्राहक कर्ज बाकी</th>
                      <th className="border px-2 py-1.5 text-center">ग्राहक व्याजदर</th>
                      <th className="border px-2 py-1.5 text-left">सध्याचे ठिकाण</th>
                      <th className="border px-2 py-1.5 text-left">बाह्य संस्था पावती क्र.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEligiblePackets.map((p) => {
                      const entry = selectedPacketLoans[p.loanAccountID] || { selected: false, receiptNo: '' };
                      return (
                        <tr
                          key={p.loanAccountID}
                          className={entry.selected ? 'bg-amber-50/70 font-medium' : 'hover:bg-slate-50'}
                        >
                          <td className="border px-2 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={entry.selected}
                              onChange={(e) =>
                                setSelectedPacketLoans((prev) => ({
                                  ...prev,
                                  [p.loanAccountID]: { ...entry, selected: e.target.checked }
                                }))
                              }
                              className="w-3.5 h-3.5 accent-primary cursor-pointer"
                            />
                          </td>
                          <td className="border px-2 py-1 font-mono font-bold text-amber-950">{p.packetNumber}</td>
                          <td className="border px-2 py-1">
                            {p.loanAccountNo} — {p.borrowerName}
                          </td>
                          <td className="border px-2 py-1 text-right font-mono">{fmtWt(p.totalNetWeight)}</td>
                          <td className="border px-2 py-1 text-right font-mono">₹{fmtAmt(p.totalValuationAmount)}</td>
                          <td className="border px-2 py-1 text-right font-mono">
                            ₹{fmtAmt(p.customerPrincipalBalance)}
                          </td>
                          <td className="border px-2 py-1 text-center font-mono font-bold text-emerald-800">
                            {p.customerInterestRate}%
                          </td>
                          <td className="border px-2 py-1 text-[10px] text-slate-600">{p.currentLocationDisplay}</td>
                          <td className="border px-2 py-1">
                            <input
                              type="text"
                              disabled={!entry.selected}
                              value={entry.receiptNo}
                              onChange={(e) =>
                                setSelectedPacketLoans((prev) => ({
                                  ...prev,
                                  [p.loanAccountID]: { ...entry, receiptNo: e.target.value }
                                }))
                              }
                              placeholder="पर्यायी पावती क्र."
                              className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-[10px] disabled:bg-slate-100"
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {filteredEligiblePackets.length === 0 && (
                      <tr>
                        <td colSpan={9} className="border p-6 text-center text-slate-500">
                          पुनर्गहाण ठेवण्यासाठी सध्या कोणतेही मुक्त सक्रिय सोने तारण पाकीट उपलब्ध नाही.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTab('list')}
              className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 font-semibold cursor-pointer"
            >
              रद्द करा
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded bg-primary hover:opacity-95 text-white font-bold shadow-sm cursor-pointer disabled:opacity-40"
            >
              {submitting ? 'जतन होत आहे...' : 'बाह्य कर्ज जतन करा व व्हाउचर तयार करा'}
            </button>
          </div>
        </form>
      )}

      {/* REPAYMENT MODAL */}
      {repayTarget && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-xl border border-slate-300 max-w-xl w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  बाह्य कर्ज परतफेड — {repayTarget.borrowingNo} ({repayTarget.lenderName})
                </h3>
                <p className="text-[11px] text-slate-600">
                  चालू मुद्दल बाकी: <strong className="text-rose-700">₹{fmtAmt(repayTarget.outstandingPrincipal)}</strong> | व्याजदर:{' '}
                  <strong>{repayTarget.borrowingInterestRate}%</strong>
                </p>
              </div>
              <button type="button" onClick={() => setRepayTarget(null)} className="cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRepaySubmit} className="space-y-2.5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10.5px] font-semibold mb-0.5">परतफेड दिनांक *</label>
                  <input
                    type="date"
                    required
                    value={repayForm.repaymentDate}
                    onChange={(e) => setRepayForm((p) => ({ ...p, repaymentDate: e.target.value }))}
                    className="w-full border rounded px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-800 mb-0.5">मुद्दल भरणा (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={repayTarget.outstandingPrincipal}
                    required
                    value={repayForm.principalPaid}
                    onChange={(e) => setRepayForm((p) => ({ ...p, principalPaid: e.target.value }))}
                    className="w-full border rounded px-2 py-1 font-mono text-right font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-800 mb-0.5">व्याज खर्च (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={repayForm.interestPaid}
                    onChange={(e) => setRepayForm((p) => ({ ...p, interestPaid: e.target.value }))}
                    className="w-full border rounded px-2 py-1 font-mono text-right font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold mb-0.5">दंड / इतर शुल्क (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={repayForm.penalOrChargesPaid}
                    onChange={(e) => setRepayForm((p) => ({ ...p, penalOrChargesPaid: e.target.value }))}
                    className="w-full border rounded px-2 py-1 font-mono text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10.5px] font-semibold mb-0.5">पेमेंट पद्धत</label>
                  <select
                    value={repayForm.paymentMode}
                    onChange={(e) => setRepayForm((p) => ({ ...p, paymentMode: e.target.value as 'Bank' | 'Cash' }))}
                    className="w-full border rounded px-2 py-1.5 bg-white"
                  >
                    <option value="Bank">बँक (Bank / Cheque / RTGS)</option>
                    <option value="Cash">रोख (Cash)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold mb-0.5">संदर्भ / UTR क्र.</label>
                  <input
                    type="text"
                    value={repayForm.referenceNo}
                    onChange={(e) => setRepayForm((p) => ({ ...p, referenceNo: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 font-mono"
                  />
                </div>
              </div>

              {repayForm.paymentMode === 'Bank' && (
                <BankLedgerSelect
                  value={repayForm.bankLedgerID}
                  onChange={(id) => setRepayForm((p) => ({ ...p, bankLedgerID: id }))}
                  label="परतफेडीसाठी बँक जी.एल. खाते निवडा *"
                />
              )}

              {(repayTarget.goldPledges || []).some((p: any) => p.pledgeStatus === 'Pledged') && (
                <div className="p-2.5 rounded border border-purple-200 bg-purple-50/50 space-y-1.5">
                  <div className="font-bold text-purple-900 text-[11px]">
                    या परतफेडीसोबत सोडवायची सोने पाकिटे निवडा (पूर्ण परतफेडीवर सर्व आपोआप मुक्त होतील):
                  </div>
                  {(repayTarget.goldPledges || [])
                    .filter((p: any) => p.pledgeStatus === 'Pledged')
                    .map((p: any) => (
                      <label key={p.goldCustodyID} className="flex items-center gap-2 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={repayForm.releaseGoldCustodyIds.includes(p.goldCustodyID)}
                          onChange={(e) =>
                            setRepayForm((prev) => ({
                              ...prev,
                              releaseGoldCustodyIds: e.target.checked
                                ? [...prev.releaseGoldCustodyIds, p.goldCustodyID]
                                : prev.releaseGoldCustodyIds.filter((id) => id !== p.goldCustodyID)
                            }))
                          }
                        />
                        <span>
                          <strong>{p.packetNumber}</strong> — {p.loanAccountNo} ({p.borrowerName}, {fmtWt(p.netWeight)}g)
                        </span>
                      </label>
                    ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setRepayTarget(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 cursor-pointer"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-40"
                >
                  {submitting ? 'जतन होत आहे...' : 'परतफेड नोंदवा व व्हाउचर बनवा'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STANDALONE UNPLEDGE PACKETS MODAL */}
      {unpledgeTarget && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-xl border border-slate-300 max-w-md w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-purple-950">
                पुनर्गहाण सोने पाकीट सोडवणे (Unpledge) — {unpledgeTarget.borrowingNo}
              </h3>
              <button type="button" onClick={() => setUnpledgeTarget(null)} className="cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUnpledgeSubmit} className="space-y-2.5">
              <div className="space-y-1 max-h-44 overflow-y-auto border rounded p-2 bg-slate-50">
                {(unpledgeTarget.goldPledges || [])
                  .filter((p: any) => p.pledgeStatus === 'Pledged')
                  .map((p: any) => (
                    <label key={p.goldCustodyID} className="flex items-center gap-2 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={unpledgeIds.includes(p.goldCustodyID)}
                        onChange={(e) =>
                          setUnpledgeIds((prev) =>
                            e.target.checked ? [...prev, p.goldCustodyID] : prev.filter((x) => x !== p.goldCustodyID)
                          )
                        }
                      />
                      <span>
                        <strong>{p.packetNumber}</strong> — {p.loanAccountNo} ({p.borrowerName})
                        {p.loanPrincipalBalance <= 0 && (
                          <strong className="ml-1 text-red-700">[ग्राहक कर्ज फिटलेले!]</strong>
                        )}
                      </span>
                    </label>
                  ))}
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-0.5">सोडवल्यानंतर पाकीट कोठे ठेवायचे?</label>
                <select
                  value={unpledgeReturnStatus}
                  onChange={(e) => setUnpledgeReturnStatus(e.target.value)}
                  className="w-full border rounded px-2 py-1 bg-white"
                >
                  <option value="BRANCH_SAFE">शाखा तिजोरी (Branch Safe)</option>
                  <option value="OWN_LOCKER">संस्थेचे स्वतःचे लॉकर</option>
                  <option value="EXTERNAL_LOCKER">इतर बँक भाड्याचे लॉकर</option>
                </select>
              </div>

              {unpledgeReturnStatus === 'OWN_LOCKER' && (
                <select
                  required
                  value={unpledgeOwnLockerId}
                  onChange={(e) => setUnpledgeOwnLockerId(e.target.value)}
                  className="w-full border rounded px-2 py-1 bg-white"
                >
                  <option value="">-- संस्था लॉकर निवडा --</option>
                  {ownLockers.map((l) => (
                    <option key={l.lockerID} value={l.lockerID}>
                      कपाट {l.cabinetNo} - लॉकर {l.lockerNo}
                    </option>
                  ))}
                </select>
              )}

              {unpledgeReturnStatus === 'EXTERNAL_LOCKER' && (
                <select
                  required
                  value={unpledgeExtLockerId}
                  onChange={(e) => setUnpledgeExtLockerId(e.target.value)}
                  className="w-full border rounded px-2 py-1 bg-white"
                >
                  <option value="">-- बाह्य लॉकर निवडा --</option>
                  {externalLockers.map((el) => (
                    <option key={el.externalLockerID} value={el.externalLockerID}>
                      {el.bankOrSocietyName} - लॉकर {el.lockerNo}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="text"
                value={unpledgeRemarks}
                onChange={(e) => setUnpledgeRemarks(e.target.value)}
                placeholder="शेरा (उदा. ग्राहकाचे कर्ज बंद झाल्याने सोडवले)"
                className="w-full border rounded px-2 py-1"
              />

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setUnpledgeTarget(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 cursor-pointer"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  disabled={submitting || unpledgeIds.length === 0}
                  className="px-4 py-1.5 rounded bg-purple-800 text-white font-bold cursor-pointer disabled:opacity-40"
                >
                  पाकीट सोडवून तिजोरीत घ्या
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
