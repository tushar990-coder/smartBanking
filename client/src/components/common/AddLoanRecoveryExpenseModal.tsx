import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { DollarSign, X, CheckCircle2, AlertCircle } from 'lucide-react';
import SearchableSelect from '../SearchableSelect';
import BankLedgerSelect from './BankLedgerSelect';
import { useAuth } from '../../context/AuthContext';
import { getBusinessDateStr } from '../../utils/businessDateUtils';

export interface AddLoanRecoveryExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: number;
  preselectedLoanAccountId?: number;
  preselectedCaseId?: number | null;
  preselectedCustomerId?: number | null;
  defaultExpenseType?: string;
  onSuccess?: (result?: any) => void;
}

interface LoanAccountItem {
  loanAccountID: number;
  branchID?: number;
  loanAccountNo: string;
  legacyAccountNumber?: string | null;
  principalBalance: number;
  maturityDate?: string | null;
  status?: string;
  customerID?: number | null;
  customer?: {
    customerID?: number;
    cifNo?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
  } | null;
  member?: {
    customer?: {
      cifNo?: string;
      firstName?: string;
      middleName?: string;
      lastName?: string;
    } | null;
    firstName?: string;
    middleName?: string;
    lastName?: string;
  } | null;
  loanRate?: {
    loanRateID?: number;
    loanType?: string;
    shortName?: string;
    loanLedgerID?: number | null;
  } | null;
}

interface IncomeLedgerItem {
  ledgerID: number;
  ledgerName: string;
  ledgerCode?: string;
  groupName?: string;
}

const EXPENSE_TYPE_OPTIONS: { value: string; label: string; defaultPayee: string }[] = [
  { value: 'RECOVERY_EXPENSE', label: 'वसूली खर्च (Recovery Expense)', defaultPayee: 'वसूली खर्च (कर्जात नावे)' },
  { value: 'POSTAGE_EXPENSE', label: 'पोसटेज / टपाल खर्च (Postage Expense)', defaultPayee: 'पोसटेज / टपाल खर्च' },
  { value: 'NOTICE_FEE', label: 'नोटीस व टपाल फी (Notice Fee)', defaultPayee: 'टपाल व कायदेशीर नोटीस खर्च' },
  { value: 'COURT_FEE', label: 'कोर्ट फी (Court Fee)', defaultPayee: 'मा. सहकार निबंधक / न्यायालय' },
  { value: 'ADVOCATE_FEE', label: 'वकिली फी (Advocate Fee)', defaultPayee: 'कायदेशीर सल्लागार / वकील' },
  { value: 'NEWSPAPER_AD', label: 'जाहीरनामा खर्च (Newspaper Ad)', defaultPayee: 'वर्तमानपत्र जाहिरात' },
  { value: 'OTHER_RECOVERY', label: 'इतर वसूली खर्च (Other Recovery)', defaultPayee: 'इतर वसूली खर्च' },
];

const formatCustomerFullName = (acc: LoanAccountItem): string => {
  const c = acc.customer || acc.member?.customer;
  if (c) {
    return [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  if (acc.member) {
    return [acc.member.firstName, acc.member.middleName, acc.member.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  return '';
};

export default function AddLoanRecoveryExpenseModal({
  isOpen,
  onClose,
  branchId,
  preselectedLoanAccountId,
  preselectedCaseId = null,
  preselectedCustomerId = null,
  defaultExpenseType = 'RECOVERY_EXPENSE',
  onSuccess,
}: AddLoanRecoveryExpenseModalProps) {
  const { user } = useAuth();
  const bizDateStr = getBusinessDateStr(user?.businessDate);

  const [loans, setLoans] = useState<LoanAccountItem[]>([]);
  const [incomeLedgers, setIncomeLedgers] = useState<IncomeLedgerItem[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [loanAccountId, setLoanAccountId] = useState<number>(preselectedLoanAccountId || 0);
  const [expenseType, setExpenseType] = useState<string>(defaultExpenseType);
  const [expenseDate, setExpenseDate] = useState<string>(bizDateStr);
  const [amount, setAmount] = useState<string>('');
  const [capitalizeToLoanPrincipal, setCapitalizeToLoanPrincipal] = useState<boolean>(true);
  const [creditLedgerId, setCreditLedgerId] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [bankLedgerId, setBankLedgerId] = useState<number>(0);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [paidTo, setPaidTo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    setExpenseType(defaultExpenseType || 'RECOVERY_EXPENSE');
    setExpenseDate(bizDateStr);
    setAmount('');
    setCapitalizeToLoanPrincipal(true);
    setPaymentMode('CASH');
    setBankLedgerId(0);
    setReferenceNo('');
    setPaidTo('');
    setRemarks('');
    if (preselectedLoanAccountId && preselectedLoanAccountId > 0) {
      setLoanAccountId(preselectedLoanAccountId);
    } else {
      setLoanAccountId(0);
    }

    const loadModalMasters = async () => {
      setLoadingData(true);
      try {
        const effectiveBranch = branchId > 0 ? branchId : (user?.branchID || 1);
        const loansUrl = `/api/LoanAccounts?branchId=${effectiveBranch}&status=Active&lightweight=true`;
        const [loansRes, chargeLedgersRes, mappingRes] = await Promise.allSettled([
          axios.get(loansUrl),
          axios.get('/api/Vouchers/loan-charge-ledgers'),
          axios.get(`/api/LegalRecoveryMapping?branchId=${effectiveBranch}`),
        ]);

        let fetchedLoans: LoanAccountItem[] =
          loansRes.status === 'fulfilled' && Array.isArray(loansRes.value.data) ? loansRes.value.data : [];

        if (preselectedCustomerId && preselectedCustomerId > 0) {
          const customerLoans = fetchedLoans.filter(
            (l) => Number(l.customerID || l.customer?.customerID || 0) === Number(preselectedCustomerId)
          );
          if (customerLoans.length > 0 && !preselectedLoanAccountId) {
            setLoanAccountId(customerLoans[0].loanAccountID);
          }
        }

        if (
          preselectedLoanAccountId &&
          preselectedLoanAccountId > 0 &&
          !fetchedLoans.some((l) => l.loanAccountID === preselectedLoanAccountId)
        ) {
          try {
            const singleRes = await axios.get(`/api/LoanAccounts/${preselectedLoanAccountId}`);
            if (singleRes.data && singleRes.data.loanAccountID) {
              fetchedLoans = [singleRes.data, ...fetchedLoans];
            }
          } catch {
            // ignore fallback failure
          }
        }

        setLoans(fetchedLoans);

        if (chargeLedgersRes.status === 'fulfilled' && chargeLedgersRes.value.data) {
          const incList: IncomeLedgerItem[] = Array.isArray(chargeLedgersRes.value.data.incomeLedgers)
            ? chargeLedgersRes.value.data.incomeLedgers
            : [];
          setIncomeLedgers(incList);
        }

        if (mappingRes.status === 'fulfilled' && Array.isArray(mappingRes.value.data)) {
          setMappings(mappingRes.value.data);
        }
      } catch (err) {
        console.error('Failed to load modal master data', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadModalMasters();
  }, [isOpen, branchId, preselectedLoanAccountId, preselectedCustomerId, defaultExpenseType, bizDateStr]);

  // Dynamically resolve default Income CreditLedgerId based on mapping + expenseType keywords (never hardcoded IDs)
  useEffect(() => {
    if (!isOpen || incomeLedgers.length === 0) return;

    const effectiveBranch = branchId > 0 ? branchId : (user?.branchID || 1);
    const exactMap = mappings.find(
      (m: any) =>
        m.isActive &&
        String(m.transactionType || '').toUpperCase() === expenseType.toUpperCase() &&
        Number(m.branchId || 0) === effectiveBranch
    );
    const globalMap = mappings.find(
      (m: any) =>
        m.isActive &&
        String(m.transactionType || '').toUpperCase() === expenseType.toUpperCase() &&
        (!m.branchId || Number(m.branchId) === 0)
    );
    const mappedCreditId = Number((exactMap || globalMap)?.creditLedgerId || 0);
    if (mappedCreditId > 0 && incomeLedgers.some((l) => l.ledgerID === mappedCreditId)) {
      setCreditLedgerId(mappedCreditId);
      return;
    }

    const matchKeywords = (text: string, words: string[]) =>
      words.some((w) => text.toLowerCase().includes(w.toLowerCase()));

    let preferred: IncomeLedgerItem | undefined;
    if (expenseType === 'POSTAGE_EXPENSE' || expenseType === 'NOTICE_FEE') {
      preferred = incomeLedgers.find((l) =>
        matchKeywords(l.ledgerName || '', ['पोसटेज', 'टपाल', 'postage', 'notice', 'नोटीस'])
      );
    } else if (expenseType === 'RECOVERY_EXPENSE') {
      preferred = incomeLedgers.find((l) =>
        matchKeywords(l.ledgerName || '', ['वसूली', 'वसुली', 'recovery'])
      );
    }
    if (!preferred) {
      preferred = incomeLedgers.find((l) =>
        matchKeywords(l.ledgerName || '', ['इतर उत्पन्न', 'other income', 'misc', 'किरकोळ', 'फी उत्पन्न'])
      );
    }
    setCreditLedgerId((preferred || incomeLedgers[0]).ledgerID);
  }, [isOpen, expenseType, incomeLedgers, mappings, branchId]);

  const selectedLoan = useMemo(
    () => loans.find((l) => l.loanAccountID === Number(loanAccountId)),
    [loans, loanAccountId]
  );

  const selectedIncomeLedger = useMemo(
    () => incomeLedgers.find((l) => l.ledgerID === Number(creditLedgerId)),
    [incomeLedgers, creditLedgerId]
  );

  const loanOptions = useMemo(() => {
    const todayStr = bizDateStr || new Date().toISOString().split('T')[0];
    return [...loans]
      .sort((a, b) => {
        const aOverdue = a.maturityDate && a.maturityDate.split('T')[0] <= todayStr ? 0 : 1;
        const bOverdue = b.maturityDate && b.maturityDate.split('T')[0] <= todayStr ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        return (a.loanAccountNo || '').localeCompare(b.loanAccountNo || '');
      })
      .map((l) => {
        const custName = formatCustomerFullName(l) || 'कर्जदार';
        const cif = l.customer?.cifNo || l.member?.customer?.cifNo || '';
        const isOverdue = Boolean(l.maturityDate && l.maturityDate.split('T')[0] <= todayStr);
        const oldTag = l.legacyAccountNumber ? ` [जुना: ${l.legacyAccountNumber}]` : '';
        const overdueTag = isOverdue ? ' [मुदतपूर्ती थकबाकी]' : '';
        return {
          value: l.loanAccountID,
          label: `${l.loanAccountNo}${oldTag} — ${custName}${cif ? ` (${cif})` : ''} | मुद्दल: ₹${Number(l.principalBalance || 0).toLocaleString('en-IN')}${overdueTag}`,
        };
      });
  }, [loans, bizDateStr]);

  const incomeLedgerOptions = useMemo(() => {
    return incomeLedgers.map((l) => ({
      value: l.ledgerID,
      label: `${l.ledgerName}${l.ledgerCode ? ` (${l.ledgerCode})` : ''}${l.groupName ? ` — [${l.groupName}]` : ''}`,
    }));
  }, [incomeLedgers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Math.round((Number(amount) || 0) * 100) / 100;

    if (!loanAccountId || loanAccountId <= 0) {
      alert('कृपया थकबाकीदार कर्ज खाते निवडा.');
      return;
    }
    if (numericAmount <= 0) {
      alert('कृपया शून्यापेक्षा जास्त वैध खर्च रक्कम प्रविष्ट करा.');
      return;
    }
    if (capitalizeToLoanPrincipal && (!creditLedgerId || creditLedgerId <= 0)) {
      alert('कृपया उत्पन्नाचे (Income) खाते निवडा.');
      return;
    }
    if (!capitalizeToLoanPrincipal && paymentMode === 'BANK_TRANSFER' && (!bankLedgerId || bankLedgerId <= 0)) {
      alert('कृपया बँक जी.एल. खाते निवडा.');
      return;
    }

    const typeMeta = EXPENSE_TYPE_OPTIONS.find((t) => t.value === expenseType);
    const effectiveBranch = selectedLoan?.branchID && selectedLoan.branchID > 0
      ? selectedLoan.branchID
      : (branchId > 0 ? branchId : user?.branchID || 1);

    setSubmitting(true);
    try {
      const payload = {
        branchId: effectiveBranch,
        caseId: preselectedCaseId && preselectedCaseId > 0 ? preselectedCaseId : null,
        loanAccountId: Number(loanAccountId),
        expenseType,
        amount: numericAmount,
        expenseDate,
        paidTo: paidTo.trim() || typeMeta?.defaultPayee || 'वसूली व पोसटेज खर्च',
        paymentMode: capitalizeToLoanPrincipal ? 'JOURNAL' : paymentMode,
        bankLedgerId: !capitalizeToLoanPrincipal && paymentMode === 'BANK_TRANSFER' ? bankLedgerId : null,
        referenceNo: !capitalizeToLoanPrincipal && paymentMode === 'BANK_TRANSFER' ? referenceNo : null,
        isDebitedToBorrower: true,
        postVoucher: true,
        capitalizeToLoanPrincipal,
        creditLedgerId: capitalizeToLoanPrincipal ? creditLedgerId : null,
        remarks: remarks.trim() || null,
      };

      const res = await axios.post('/api/LegalRecovery/expense/add', payload);
      if (res.status === 200) {
        const result = res.data;
        alert(
          `${result.message || 'खर्च नोंद यशस्वीरीत्या सेव्ह झाली!'}\nव्हाउचर क्र.: ${result.voucherNo || result.voucherNumber || '-'}\nटीप: हे व्हाउचर पासिंगसाठी प्रलंबित (Pending) आहे; व्हाउचर मंजूर/पास केल्यावर कर्जाच्या मुद्दलात रक्कम जमा होईल.`
        );
        if (onSuccess) onSuccess(result);
        onClose();
      }
    } catch (err: any) {
      alert('खर्च नोंदवताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 print:hidden">
      <div className="bg-white rounded-sm border-t-4 border-t-primary max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-gray-200">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <DollarSign className="w-4 h-4 text-primary" />
            <span>थकबाकीदार कर्जात वसूली / पोसटेज खर्च अ‍ॅड करा</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-gray-200 text-gray-500 hover:text-gray-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs overflow-y-auto">
          {loadingData && (
            <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-sm text-[11px] font-semibold">
              कर्ज खाती व उत्पन्नाची लेजर खाती लोड होत आहेत...
            </div>
          )}

          {/* Loan Selection */}
          <div>
            <label className="font-bold text-gray-800 block mb-1">
              थकबाकीदार कर्ज खाते निवडा <span className="text-rose-600">*</span>
              <span className="text-[10px] font-normal text-gray-500 ml-1">(कलम १०१ केस शिवाय देखील निवडता येते)</span>
            </label>
            <SearchableSelect
              id="recovery-modal-loan-select"
              options={loanOptions}
              value={loanAccountId || ''}
              onChange={(e) => setLoanAccountId(Number(e.target.value) || 0)}
              placeholder="-- कर्ज खाते क्र., जुना नं., नाव किंवा CIF शोधा --"
              searchPlaceholder="खाते क्र., जुना नं., नाव शोधा..."
              minMenuWidth={480}
              disabled={Boolean(preselectedLoanAccountId && preselectedLoanAccountId > 0)}
            />
            {selectedLoan && (
              <div className="mt-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-sm flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span>
                  खातेदार: <strong className="text-slate-900">{formatCustomerFullName(selectedLoan) || '-'}</strong>
                  {selectedLoan.loanRate?.loanType ? ` • ${selectedLoan.loanRate.loanType}` : ''}
                </span>
                <span className="font-mono font-bold text-primary">
                  सध्याची मुद्दल बाकी: ₹{Number(selectedLoan.principalBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Expense Type, Date & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-1">
              <label className="font-bold text-gray-800 block mb-1">खर्च प्रकार:</label>
              <select
                value={expenseType}
                onChange={(e) => setExpenseType(e.target.value)}
                className="w-full border border-gray-300 rounded-sm px-2 py-1.5 font-bold bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              >
                {EXPENSE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-gray-800 block mb-1">खर्च तारीख:</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-sm px-2 py-1.5 bg-white font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-gray-800 block mb-1">
                रक्कम (₹) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="उदा. 500"
                required
                className="w-full border border-gray-300 rounded-sm px-2.5 py-1.5 font-mono font-black text-rose-700 text-right focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="border border-teal-200 bg-teal-50/50 rounded-sm p-2.5 space-y-2">
            <div className="font-bold text-teal-950 text-[11px]">हिशेब नोंदवण्याची पद्धत (Accounting Mode):</div>
            <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded-sm bg-white border border-teal-300">
              <input
                type="radio"
                name="chargeAccountingMode"
                checked={capitalizeToLoanPrincipal}
                onChange={() => setCapitalizeToLoanPrincipal(true)}
                className="mt-0.5"
              />
              <div>
                <div className="font-bold text-teal-900">
                  कर्जाच्या मुद्दलात (Principal Balance) अ‍ॅड करा — <span className="text-primary">Dr कर्ज मुद्दल / Cr इतर उत्पन्न (Journal)</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  मुदतपूर्ती (Maturity) नंतर व्याज मोजणी बंद झालेल्या थकबाकी कर्जाच्या येणे बाकीत वसूली/पोसटेज खर्च थेट वाढतो व निवडलेल्या उत्पन्नास जमा पडते.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded-sm bg-white border border-gray-200">
              <input
                type="radio"
                name="chargeAccountingMode"
                checked={!capitalizeToLoanPrincipal}
                onChange={() => setCapitalizeToLoanPrincipal(false)}
                className="mt-0.5"
              />
              <div>
                <div className="font-bold text-slate-800">
                  रोख / बँक खर्च नोंदवून स्वतंत्र येणे बाकीत (Overdue Recovery Ledger) ठेवा
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  कर्जाचे मुद्दल न वाढवता रोख/बँकेतून अदा करून स्वतंत्र कायदेशीर खर्च बाकी ठेवली जाते.
                </div>
              </div>
            </label>
          </div>

          {/* Dynamic Income Ledger Selector OR Bank Selector */}
          {capitalizeToLoanPrincipal ? (
            <div className="bg-amber-50/70 border border-amber-200 rounded-sm p-2.5 space-y-2">
              <div>
                <label className="font-bold text-amber-950 block mb-1">
                  जमा उत्पन्नाचे खाते निवडा (Cr Dynamic Income Ledger) <span className="text-rose-600">*</span>
                </label>
                {incomeLedgers.length === 0 && !loadingData ? (
                  <div className="flex items-center gap-1.5 text-rose-700 font-bold text-[11px] bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>सिस्टीममध्ये कोणतेही सक्रिय उत्पन्नाचे (Income Group) लेजर खाते आढळले नाही. कृपया Ledger Master मध्ये उत्पन्न खाते तयार करा.</span>
                  </div>
                ) : (
                  <SearchableSelect
                    id="recovery-modal-income-ledger"
                    options={incomeLedgerOptions}
                    value={creditLedgerId || ''}
                    onChange={(e) => setCreditLedgerId(Number(e.target.value) || 0)}
                    placeholder="-- उत्पन्न लेजर निवडा (उदा. इतर उत्पन्न / पोसटेज उत्पन्न / वसूली उत्पन्न) --"
                    searchPlaceholder="उत्पन्न खाते नाव किंवा कोड शोधा..."
                    minMenuWidth={440}
                  />
                )}
              </div>

              {/* Live Dr / Cr Accounting Preview */}
              <div className="bg-white border border-amber-300/80 rounded-sm px-2.5 py-1.5 text-[10.5px] font-mono space-y-0.5">
                <div className="text-rose-800 font-bold">
                  Dr (नावे): कर्ज खाते मुद्दल {selectedLoan ? `(${selectedLoan.loanAccountNo} - ${selectedLoan.loanRate?.loanType || 'Loan'})` : ''} — ₹{Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-emerald-800 font-bold">
                  Cr (जमा): {selectedIncomeLedger?.ledgerName || 'निवडलेले उत्पन्न खाते'} — ₹{Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-gray-200 rounded-sm p-2.5 space-y-2">
              <div>
                <label className="font-bold text-gray-800 block mb-1">पेमेंट पद्धत (Payment Mode):</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                    <input
                      type="radio"
                      checked={paymentMode === 'CASH'}
                      onChange={() => {
                        setPaymentMode('CASH');
                        setBankLedgerId(0);
                        setReferenceNo('');
                      }}
                    />
                    <span>रोख (Cash)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                    <input
                      type="radio"
                      checked={paymentMode === 'BANK_TRANSFER'}
                      onChange={() => setPaymentMode('BANK_TRANSFER')}
                    />
                    <span>बँक ट्रान्सफर / चेक (Bank)</span>
                  </label>
                </div>
              </div>

              {paymentMode === 'BANK_TRANSFER' && (
                <div className="space-y-2">
                  <BankLedgerSelect value={bankLedgerId} onChange={setBankLedgerId} showCountBadge />
                  <input
                    type="text"
                    placeholder="UTR / चेक क्र. (Reference No.)"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="w-full border border-gray-300 rounded-sm px-2.5 py-1.5 bg-white"
                  />
                </div>
              )}
            </div>
          )}

          {/* Payee & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="font-bold text-gray-700 block mb-1">तपशील / देय व्यक्ती (Optional):</label>
              <input
                type="text"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                placeholder="उदा. भारतीय डाक / वसूली अधिकारी"
                className="w-full border border-gray-300 rounded-sm px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">शेरा (Remarks):</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="उदा. थकबाकी रजिस्टर पोस्ट / वसूली खर्च"
                className="w-full border border-gray-300 rounded-sm px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50/70 border border-blue-200 rounded-sm text-[10.5px] text-blue-900">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>
              <strong>Maker-Checker:</strong> सेव्ह केल्यानंतर <strong>Pending Journal व्हाउचर</strong> तयार होईल. व्हाउचर पासिंग (Approval) केल्यावरच कर्जाच्या मुद्दलात रक्कम जमा होईल.
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-sm text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
            >
              रद्द करा
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-sm text-xs font-bold shadow-xs transition disabled:opacity-50 bg-primary hover:opacity-95 text-white cursor-pointer"
            >
              {submitting ? 'व्हाउचर तयार होत आहे...' : 'खर्च सेव्ह व व्हाउचर तयार करा'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
