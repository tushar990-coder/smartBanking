import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BookOpen, Layers, ShieldCheck, RefreshCw, CheckCircle, AlertTriangle, ArrowRight, DollarSign } from 'lucide-react';
import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import SearchableSelect from './SearchableSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountType?: string;
  groupID?: number;
}

interface SavingAccount {
  savingAccountID: number;
  accountNo: string;
  memberID: number;
  currentBalance: number;
  minimumBalance?: number;
  lienAmount?: number;
  status: string;
  ledger?: Ledger;
}

interface FdAccount {
  fdAccountID: number;
  branchID: number;
  accountNo: string;
  memberID: number;
  memberName: string;
  memberCode: string;
  schemeName: string;
  fdSchemeID: number;
  depositAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  legacyAccruedInt: number;
  status: string;
  fdLiabilityLedgerID?: number | null;
  fdLiabilityLedgerName?: string;
  interestExpenseLedgerID?: number | null;
  interestExpenseLedgerName?: string;
  interestPayableLedgerID?: number | null;
  interestPayableLedgerName?: string;
  prematurePenaltyLedgerID?: number | null;
  prematurePenaltyLedgerName?: string;
}

interface FdScheme {
  fdSchemeID: number;
  schemeName: string;
  schemeCode?: string;
  interestRate: number;
  durationMonths: number;
  prematureInterestRate?: number;
  fdLiabilityLedgerID?: number | null;
  fdLiabilityLedger?: Ledger | null;
  fdLiabilityLedgerName?: string;
  interestExpenseLedgerID?: number | null;
  interestExpenseLedger?: Ledger | null;
  interestExpenseLedgerName?: string;
  interestPayableLedgerID?: number | null;
  interestPayableLedger?: Ledger | null;
  interestPayableLedgerName?: string;
  prematurePenaltyLedgerID?: number | null;
  prematurePenaltyLedger?: Ledger | null;
  prematurePenaltyLedgerName?: string;
}

const FdWithdrawalMaturity: React.FC = () => {
  const [accounts, setAccounts] = useState<FdAccount[]>([]);
  const [schemes, setSchemes] = useState<FdScheme[]>([]);
  const [bankLedgers, setBankLedgers] = useState<Ledger[]>([]);
  const [selectedAccId, setSelectedAccId] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<FdAccount | null>(null);

  const [actionType, setActionType] = useState<string>('MaturityClose'); // MaturityClose, PrematureClose, Renewal
  const [closureDate, setClosureDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [renewalType, setRenewalType] = useState<string>('PrincipalPlusInterest'); // PrincipalOnly, PrincipalPlusInterest
  const [targetSchemeId, setTargetSchemeId] = useState<number>(0);

  // Payment Mode states
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank' | 'Transfer'>('Cash');
  const [bankAccountLedgerID, setBankAccountLedgerID] = useState<number>(0);
  const [chequeNo, setChequeNo] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [memberSavingAccounts, setMemberSavingAccounts] = useState<SavingAccount[]>([]);
  const [selectedSavingAccountId, setSelectedSavingAccountId] = useState<number | ''>('');
  const [narration, setNarration] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = '/api';

  useEffect(() => {
    fetchAccounts();
    fetchSchemes();
    fetchBankLedgers();
  }, []);

  const fetchBankLedgers = async () => {
    try {
      const res = await axios.get(`${API_URL}/Ledgers`);
      const allLedgers: Ledger[] = Array.isArray(res.data) ? res.data : [];
      const bLedgers = allLedgers.filter((l: any) => {
        if (!l) return false;
        const name = (l.ledgerName || '').toLowerCase();
        const type = (l.accountType || '').toLowerCase();
        const group = l.groupID || 0;
        return (
          type.includes('bank') ||
          name.includes('bank') ||
          name.includes('बँक') ||
          group === 12 || group === 8 || group === 9
        );
      });
      const finalBankList = bLedgers.length > 0 ? bLedgers : allLedgers;
      setBankLedgers(finalBankList);
      if (finalBankList.length > 0) {
        setBankAccountLedgerID(finalBankList[0].ledgerID);
      }
    } catch (e) {
      console.error('Error fetching bank ledgers', e);
    }
  };

  const fetchMemberSavingsAccounts = async (memberId: number, customerId?: number) => {
    if ((!memberId || memberId <= 0) && (!customerId || customerId <= 0)) {
      setMemberSavingAccounts([]);
      setSelectedSavingAccountId('');
      return;
    }
    try {
      const url = customerId 
        ? `${API_URL}/SavingAccounts?customerId=${customerId}&memberId=${memberId || ''}`
        : `${API_URL}/SavingAccounts?memberId=${memberId}`;
      const res = await axios.get(url);
      const list: SavingAccount[] = Array.isArray(res.data)
        ? res.data.filter((a: any) => a.status === 'Active' || !a.status)
        : [];
      setMemberSavingAccounts(list);
      if (list.length > 0) {
        setSelectedSavingAccountId(list[0].savingAccountID);
      } else {
        setSelectedSavingAccountId('');
      }
    } catch (err) {
      console.error('Error fetching member savings accounts', err);
      setMemberSavingAccounts([]);
      setSelectedSavingAccountId('');
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API_URL}/FdAccounts`);
      const activeList = response.data.filter((a: any) => a.status !== 'Closed');
      setAccounts(activeList);

      const params = new URLSearchParams(window.location.search);
      const entityIdStr = params.get('entityId');
      const fdAccountIdStr = params.get('fdAccountId') || params.get('id');
      const memberIdStr = params.get('memberId');

      let matched: FdAccount | undefined = undefined;
      if (fdAccountIdStr) {
        const accId = parseInt(fdAccountIdStr);
        matched = activeList.find((a: any) => a.fdAccountID === accId);
      } else if (entityIdStr) {
        const eId = parseInt(entityIdStr);
        matched = activeList.find((a: any) => a.fdAccountID === eId || a.memberID === eId);
      } else if (memberIdStr) {
        const mId = parseInt(memberIdStr);
        matched = activeList.find((a: any) => a.memberID === mId);
      }

      if (matched) {
        setSelectedAccId(matched.fdAccountID);
        setSelectedAccount(matched);
        fetchMemberSavingsAccounts(matched.memberID, (matched as any).customerID || (matched.member as any)?.customerID);
      }
    } catch (err) {
      console.error('Error fetching accounts', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      const response = await axios.get(`${API_URL}/FdSchemes`);
      const list: FdScheme[] = response.data || [];
      setSchemes(list);
      if (list.length > 0) {
        setTargetSchemeId(list[0].fdSchemeID);
      }
    } catch (err) {
      console.error('Error fetching schemes', err);
    }
  };

  const handleAccountSelect = (val: any) => {
    const accId = typeof val === 'object' && val?.target ? parseInt(val.target.value) : parseInt(String(val || 0));
    setSelectedAccId(accId);
    const selected = accounts.find((a) => a.fdAccountID === accId) || null;
    setSelectedAccount(selected);
    setError('');
    setSuccess('');
    if (selected) {
      fetchMemberSavingsAccounts(selected.memberID, (selected as any).customerID || (selected.member as any)?.customerID);
    } else {
      setMemberSavingAccounts([]);
      setSelectedSavingAccountId('');
    }
  };

  // Maturity Date validation helper
  const checkIsMatured = () => {
    if (!selectedAccount) return false;
    const closureDt = new Date(closureDate || new Date().toISOString().split('T')[0]);
    closureDt.setHours(0, 0, 0, 0);

    const matDt = new Date(selectedAccount.maturityDate);
    matDt.setHours(0, 0, 0, 0);

    return closureDt.getTime() >= matDt.getTime();
  };

  const isMatured = checkIsMatured();
  const isPendingMaturityAction = Boolean((actionType === 'MaturityClose' || actionType === 'Renewal') && selectedAccount && !isMatured);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedAccount) {
      setError('कृपया खाते निवडा.');
      return;
    }

    if (isPendingMaturityAction) {
      setError(`⚠️ सदर मुदत ठेव पावती अद्याप मुदतपूर्ण (Matured) झालेली नाही! मुदतपूर्ती तारीख ${selectedAccount.maturityDate.split('T')[0].split('-').reverse().join('/')} आहे.`);
      return;
    }

    // Validation for Bank Payment
    if ((actionType === 'MaturityClose' || actionType === 'PrematureClose' || (actionType === 'Renewal' && renewalType === 'PrincipalOnly')) && paymentMode === 'Bank') {
      if (!bankAccountLedgerID || bankAccountLedgerID <= 0) {
        setError('कृपया बँक खाते लेजर निवडा.');
        return;
      }
    }

    // Validation for Transfer Payment
    if ((actionType === 'MaturityClose' || actionType === 'PrematureClose' || (actionType === 'Renewal' && renewalType === 'PrincipalOnly')) && paymentMode === 'Transfer') {
      if (!selectedSavingAccountId || selectedSavingAccountId <= 0) {
        setError('⚠️ रक्कम वर्ग करण्यासाठी सभासदाचे कोणतेही सक्रिय बचत खाते निवडलेले नाही.');
        return;
      }
    }

    setLoading(true);
    try {
      const basePayload = {
        closureDate: closureDate,
        paymentMode: paymentMode,
        bankAccountLedgerID: paymentMode === 'Bank' ? bankAccountLedgerID : null,
        chequeNo: paymentMode === 'Bank' ? chequeNo : null,
        chequeDate: paymentMode === 'Bank' ? chequeDate : null,
        savingAccountID: paymentMode === 'Transfer' ? selectedSavingAccountId : null,
        narration: narration || null
      };

      if (actionType === 'MaturityClose') {
        const response = await axios.post(`${API_URL}/FdAccounts/${selectedAccount.fdAccountID}/MaturedClose`, basePayload);
        setSuccess(response.data);
      } else if (actionType === 'PrematureClose') {
        const response = await axios.post(
          `${API_URL}/FdAccounts/${selectedAccount.fdAccountID}/PrematureClose`,
          basePayload
        );
        const resData = response.data;
        setSuccess(`✅ मुदत पूर्व बंद यशस्वी (${paymentMode})! दिवसांची संख्या: ${resData.actualDays}, मूळ मुद्दल: ₹${selectedAccount.depositAmount.toLocaleString()}, पुनर्गणना केलेले व्याज: ₹${resData.recalcInt}, दंडात्मक कपात: ₹${resData.clawback}, अंतिम पेआउट: ₹${resData.netPayout}`);
      } else if (actionType === 'Renewal') {
        if (targetSchemeId === 0) {
          setError('कृपया नूतनीकरणासाठी नवीन ठेव योजना निवडा.');
          setLoading(false);
          return;
        }

        const payload = {
          targetSchemeID: targetSchemeId,
          renewalType: renewalType,
          closureDate: closureDate,
          paymentMode: renewalType === 'PrincipalOnly' ? paymentMode : 'BookTransfer',
          bankAccountLedgerID: renewalType === 'PrincipalOnly' && paymentMode === 'Bank' ? bankAccountLedgerID : null,
          chequeNo: renewalType === 'PrincipalOnly' && paymentMode === 'Bank' ? chequeNo : null,
          chequeDate: renewalType === 'PrincipalOnly' && paymentMode === 'Bank' ? chequeDate : null,
          savingAccountID: renewalType === 'PrincipalOnly' && paymentMode === 'Transfer' ? selectedSavingAccountId : null,
          narration: narration || null
        };

        const response = await axios.post(
          `${API_URL}/FdAccounts/${selectedAccount.fdAccountID}/Renew`,
          payload
        );
        const resData = response.data;
        setSuccess(`✅ ${resData.message} (नवीन पावती क्र: ${resData.newAccountNo})`);
      }

      // Refresh list
      setSelectedAccount(null);
      setSelectedAccId(0);
      setNarration('');
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || 'व्यवहार पूर्ण करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to resolve mapped ledgers for selected account scheme
  const getSchemeLedgers = () => {
    if (!selectedAccount) return null;
    const scheme = schemes.find(s => s.fdSchemeID === selectedAccount.fdSchemeID || s.schemeName === selectedAccount.schemeName);

    const fdLiability = selectedAccount.fdLiabilityLedgerName 
      || scheme?.fdLiabilityLedger?.ledgerName 
      || scheme?.fdLiabilityLedgerName 
      || '१२ मेंबर मुदत ठेव खाते (Fixed Deposit Liability)';

    const interestPayable = selectedAccount.interestPayableLedgerName 
      || scheme?.interestPayableLedger?.ledgerName 
      || scheme?.interestPayableLedgerName 
      || '२३ देणे सभासद ठेव व्याज (Interest Payable)';

    const interestExpense = selectedAccount.interestExpenseLedgerName 
      || scheme?.interestExpenseLedger?.ledgerName 
      || scheme?.interestExpenseLedgerName 
      || '१३२ मुदत ठेवीवरील व्याज (Interest Expense)';

    const prematurePenalty = selectedAccount.prematurePenaltyLedgerName 
      || scheme?.prematurePenaltyLedger?.ledgerName 
      || scheme?.prematurePenaltyLedgerName 
      || '१३२ मुदत पूर्व कपात दंड उत्पन्न खाते (Premature Clawback)';

    let payoutLedgerName = '५१ हातातील रोख शिल्लक (Cash Account)';
    if (paymentMode === 'Bank') {
      const b = bankLedgers.find(l => l.ledgerID === bankAccountLedgerID);
      payoutLedgerName = b ? `${b.ledgerID} - ${b.ledgerName} (Bank A/c)` : 'बँक खाते लेजर (Bank GL)';
    } else if (paymentMode === 'Transfer') {
      const sAcc = memberSavingAccounts.find(s => s.savingAccountID === selectedSavingAccountId);
      payoutLedgerName = sAcc ? `७ - बचत ठेव खाते (${sAcc.accountNo})` : '७ - सभासद बचत ठेव देयता खाते (SB Liability)';
    }

    return { fdLiability, interestPayable, interestExpense, prematurePenalty, cashLedger: payoutLedgerName, scheme };
  };

  // Generate Voucher Entries Preview
  const getVoucherEntriesPreview = () => {
    if (!selectedAccount) return null;
    const ledgers = getSchemeLedgers();
    if (!ledgers) return null;

    const entries: { drCr: 'Dr' | 'Cr'; ledgerName: string; note: string; amount: number }[] = [];

    if (actionType === 'MaturityClose') {
      const principal = selectedAccount.depositAmount;
      const accruedInt = Math.max(0, (selectedAccount.maturityAmount || selectedAccount.depositAmount) - selectedAccount.depositAmount + selectedAccount.legacyAccruedInt);
      const totalPayout = principal + accruedInt;

      entries.push({
        drCr: 'Dr',
        ledgerName: ledgers.fdLiability,
        note: 'मुदत ठेव मुद्दल खाते कमी करणे (Principal Liability Cleared)',
        amount: principal
      });

      if (accruedInt > 0) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestPayable,
          note: 'साचलेले देय व्याज चुकता करणे (Accrued Interest Payable)',
          amount: accruedInt
        });
      }

      entries.push({
        drCr: 'Cr',
        ledgerName: ledgers.cashLedger,
        note: paymentMode === 'Cash' ? 'सभासदास रोख पेमेंट (Cash Payout to Member)' : (paymentMode === 'Bank' ? 'बँक ट्रान्सफर / धनादेश परतावा (Bank Payout)' : 'सभासदाच्या बचत खात्यात वर्ग (SB Credit Payout)'),
        amount: totalPayout
      });

    } else if (actionType === 'PrematureClose') {
      const principal = selectedAccount.depositAmount;
      const actualDays = Math.max(1, Math.floor((new Date(closureDate).getTime() - new Date(selectedAccount.openingDate).getTime()) / (1000 * 60 * 60 * 24)));
      const prematureRate = ledgers.scheme?.prematureInterestRate ?? Math.max(0, selectedAccount.interestRate - 1.0);
      const recalculatedInterest = Math.round((principal * prematureRate * actualDays) / 36500);
      const alreadyAccruedInt = selectedAccount.legacyAccruedInt;
      
      let clawback = 0;
      let netPayout = principal + recalculatedInterest;

      if (alreadyAccruedInt > recalculatedInterest) {
        clawback = alreadyAccruedInt - recalculatedInterest;
        netPayout = principal - clawback;
      }

      entries.push({
        drCr: 'Dr',
        ledgerName: ledgers.fdLiability,
        note: 'मुदत ठेव मुद्दल खाते कमी करणे (Principal Liability)',
        amount: principal
      });

      if (alreadyAccruedInt > 0) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestPayable,
          note: 'आधी तरतूद केलेले देय व्याज नावे (Accrued Interest Payable Debited)',
          amount: alreadyAccruedInt
        });
      }

      if (recalculatedInterest > alreadyAccruedInt) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestExpense,
          note: 'चालू कालावधीचे पुनर्गणना केलेले मुदत ठेव व्याज खर्च (Interest Expense)',
          amount: recalculatedInterest - alreadyAccruedInt
        });
      }

      entries.push({
        drCr: 'Cr',
        ledgerName: ledgers.cashLedger,
        note: paymentMode === 'Cash' ? 'प्रत्यक्ष अंतिम रोख पेआउट रक्कम (Net Cash Paid)' : (paymentMode === 'Bank' ? 'प्रत्यक्ष अंतिम बँक पेआउट (Net Bank Payout)' : 'बचत खात्यात वर्ग अंतिम पेआउट (Net SB Transfer)'),
        amount: netPayout
      });

      if (clawback > 0) {
        entries.push({
          drCr: 'Cr',
          ledgerName: ledgers.prematurePenalty,
          note: 'जास्तीच्या दिलेल्या व्याजाची दंड कपात जमा (Clawback Penalty Adjustment)',
          amount: clawback
        });
      }

    } else if (actionType === 'Renewal') {
      const targetScheme = schemes.find(s => s.fdSchemeID === targetSchemeId);
      const targetLiabilityLedger = targetScheme?.fdLiabilityLedger?.ledgerName 
        || targetScheme?.fdLiabilityLedgerName 
        || `${targetScheme?.schemeName || 'नवीन योजना'} - मुदत ठेव देयता खाते`;

      const principal = selectedAccount.depositAmount;
      const accruedInt = Math.max(0, (selectedAccount.maturityAmount || selectedAccount.depositAmount) - selectedAccount.depositAmount + selectedAccount.legacyAccruedInt);
      const totalVal = principal + accruedInt;

      const newDepositAmount = renewalType === 'PrincipalPlusInterest' ? totalVal : principal;

      entries.push({
        drCr: 'Dr',
        ledgerName: ledgers.fdLiability,
        note: 'जुने मुदत ठेव खाते बंद करणे (Old FD Liability Cleared)',
        amount: principal
      });

      if (renewalType === 'PrincipalPlusInterest' && accruedInt > 0) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestPayable,
          note: 'देणे व्याज मुद्दलात पुनर्गठित करणे (Interest Capitalized to New FD)',
          amount: accruedInt
        });
      }

      entries.push({
        drCr: 'Cr',
        ledgerName: targetLiabilityLedger,
        note: `नवीन मुदत ठेव खात्यात मुद्दल जमा (${targetScheme?.schemeName || 'New FD Account'})`,
        amount: newDepositAmount
      });

      if (renewalType === 'PrincipalOnly' && accruedInt > 0) {
        entries.push({
          drCr: 'Cr',
          ledgerName: ledgers.cashLedger,
          note: paymentMode === 'Cash' ? 'केवळ व्याजाची रक्कम रोखीने अदा करणे (Interest Cash Payout)' : (paymentMode === 'Bank' ? 'व्याज बँक ट्रान्सफरने अदा करणे (Interest Bank Payout)' : 'व्याज बचत खात्यात वर्ग करणे (Interest SB Credit)'),
          amount: accruedInt
        });
      }
    }

    return entries;
  };

  const labelClass = 'block text-xs font-bold text-gray-700 mb-1';
  const inputClass = 'w-full text-xs border border-gray-300 rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-primary bg-white';

  const voucherPreview = getVoucherEntriesPreview();

  // Format account options for SearchableSelect
  const accountOptions = [
    { value: '0', label: '--- मुदत ठेव खाते निवडा (Select FD Account) ---' },
    ...accounts.map(a => ({
      value: a.fdAccountID.toString(),
      label: `${a.accountNo} - ${a.memberName} (${a.memberCode}) | ठेव: ₹${a.depositAmount.toLocaleString()} | मुदतपूर्ती: ${a.maturityDate ? a.maturityDate.split('T')[0].split('-').reverse().join('/') : ''} [${a.schemeName}]`
    }))
  ];

  return (
    <div className="p-3 max-w-6xl mx-auto space-y-3 font-sans text-xs">
      {/* Top ERP Header Banner */}
      <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-200" />
          <div>
            <h1 className="text-sm font-bold tracking-wide">मुदत ठेव क्लोजर आणि नूतनीकरण (FD Closures & Renewals)</h1>
            <p className="text-[10px] text-blue-100 font-normal">मुदत संपलेल्या किंवा मुदतपूर्व ठेवींचे क्लेम सेटल करणे, पेमेंट मोड निवडणे व कोर बँकिंग लेजर नोंदी (Vouchers) करणे</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1 bg-blue-800/60 border border-blue-400/40 text-blue-100 text-[10px] px-2.5 py-0.5 rounded font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
          <span>मल्टी-पेमेंट मोड व व्हाऊचर लेजर सक्षम</span>
        </div>
      </div>

      {error && <div className="bg-red-100 border border-red-300 text-red-700 text-xs p-2.5 rounded-sm font-medium">{error}</div>}
      {success && <div className="bg-green-100 border border-green-300 text-green-800 text-xs p-2.5 rounded-sm font-semibold">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-sm shadow-sm border border-gray-200 space-y-4">
        {/* Step 1: Account Selection */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-primary border-b pb-1 flex items-center justify-between">
            <span>१. मुदत ठेव खाते व व्यवहार निवडा (Select FD Account & Action)</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>मुदत ठेव खाते शोधा व निवडा *</label>
              <SearchableSelect
                options={accountOptions}
                value={selectedAccId.toString()}
                onChange={handleAccountSelect}
                placeholder="पावती क्र., नाव किंवा कोडने शोधा..."
              />
            </div>

            <div>
              <label className={labelClass}>व्यवहार निवडा (Select Action Type) *</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full text-xs font-bold border border-blue-300 bg-blue-50 rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-primary text-blue-900 cursor-pointer shadow-2xs"
              >
                <option value="MaturityClose">१. मुदतपूर्ती पेमेंट (Standard Maturity Payout)</option>
                <option value="PrematureClose">२. मुदतपूर्व बंद (Premature Close & Clawback)</option>
                <option value="Renewal">३. मुदत ठेव नूतनीकरण (FD Renewal)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Selected Account Info Box */}
        {selectedAccount && (
          <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-700 shadow-2xs">
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">सभासदाचे नाव:</span>
              <strong className="text-gray-900">{selectedAccount.memberName}</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">ठेव योजना (Scheme):</span>
              <strong className="text-blue-900">{selectedAccount.schemeName}</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">मूळ मुद्दल ठेव:</span>
              <strong className="text-green-800 text-sm font-bold">₹ {selectedAccount.depositAmount.toLocaleString()}</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">मूळ व्याजदर:</span>
              <strong>{selectedAccount.interestRate} %</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">खाते उघडल्याची तारीख:</span>
              <strong>{selectedAccount.openingDate.split('T')[0].split('-').reverse().join('/')}</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">मुदतपूर्ती तारीख:</span>
              <strong>{selectedAccount.maturityDate.split('T')[0].split('-').reverse().join('/')}</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">अंदाजित मुदतपूर्ती रक्कम:</span>
              <strong className="text-blue-900 font-mono font-bold">₹ {selectedAccount.maturityAmount.toLocaleString()}</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">खाते सद्यस्थिती:</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                selectedAccount.status === 'Matured' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-green-100 text-green-800 border border-green-200'
              }`}>
                {selectedAccount.status}
              </span>
            </div>
          </div>
        )}

        {/* Step 2: Dynamic Action Parameters */}
        {selectedAccount && (
          <div className="border-t pt-3 space-y-3">
            <h2 className="text-xs font-bold text-primary border-b pb-1">२. व्यवहाराचे नियम व अटी</h2>

            {/* Non-Matured Warning Alert */}
            {isPendingMaturityAction && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded shadow-2xs text-xs text-red-800 space-y-1.5">
                <div className="font-bold text-red-900 flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>सदर मुदत ठेव पावती अद्याप मुदतपूर्ण (Matured) झालेली नाही!</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  या पावतीची मुदतपूर्ती तारीख <strong className="font-mono text-red-950 font-bold bg-white px-1.5 py-0.5 rounded border border-red-200">{selectedAccount.maturityDate.split('T')[0].split('-').reverse().join('/')}</strong> आहे. 
                  अद्याप मुदत पूर्ण झाली नसल्याने या पावतीवर <strong>'मुदतपूर्ती पेमेंट'</strong> किंवा <strong>'नूतनीकरण'</strong> करता येणार नाही.
                </p>
                <div className="bg-red-100/90 text-red-950 p-2 rounded border border-red-200 text-[11px] font-bold flex items-center gap-2">
                  <span>💡 जर ही पावती आजच बंद करायची असेल, तर कृपया वरील ड्रॉपडाउनमधून <strong>'२. मुदतपूर्व बंद (Premature Close & Clawback)'</strong> हा पर्याय निवडा.</span>
                </div>
              </div>
            )}

            {actionType === 'MaturityClose' && !isPendingMaturityAction && (
              <div className="bg-yellow-50 p-3 border border-yellow-200 text-xs text-yellow-800 space-y-1 rounded-sm">
                <strong>मुदतपूर्ती नियम:</strong> ठेवीची मुदत पूर्ण झाली आहे. मूळ मुद्दल + साचलेले व्याज रोखीने, बँकेद्वारे किंवा सभासदाच्या बचत खात्यात वर्ग केले जाईल.
              </div>
            )}

            {actionType === 'PrematureClose' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>प्रत्यक्ष बंद केल्याची तारीख (Closure Date)</label>
                  <input
                    type="date"
                    value={closureDate}
                    onChange={(e) => setClosureDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div className="bg-red-50 p-2.5 rounded-sm border border-red-200 text-xs text-red-800">
                  <strong>मुदतपूर्व कपात नियम:</strong> प्रत्यक्ष दिवसांनुसार व्याजाची पुनर्गणना केली जाईल आणि दंडात्मक कपात (Clawback) नंतरची रक्कम निवडलेल्या पेमेंट मोडने अदा केली जाईल.
                </div>
              </div>
            )}

            {actionType === 'Renewal' && !isPendingMaturityAction && (
              <div className="space-y-3 bg-indigo-50/60 p-3 rounded border border-indigo-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>नूतनीकरण प्रकार (Renewal Type) *</label>
                    <select
                      value={renewalType}
                      onChange={(e) => setRenewalType(e.target.value)}
                      className={inputClass}
                    >
                      <option value="PrincipalPlusInterest">१. मुद्दल + व्याज एकत्रित नूतनीकरण (Full Amount Renewal - 100% Roll)</option>
                      <option value="PrincipalOnly">२. केवळ मुद्दल नूतनीकरण (Principal Only, Interest Payout)</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>नूतनीकरणाची ठेव योजना (Target Scheme) *</label>
                    <select
                      value={targetSchemeId}
                      onChange={(e) => setTargetSchemeId(parseInt(e.target.value))}
                      className={inputClass}
                      required
                    >
                      {schemes.map((s) => (
                        <option key={s.fdSchemeID} value={s.fdSchemeID}>
                          {s.schemeName} ({s.durationMonths} महिने @ {s.interestRate}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {renewalType === 'PrincipalPlusInterest' && (
                  <div className="bg-white p-2.5 rounded border border-indigo-200 text-xs text-indigo-950 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔄</span>
                      <div>
                        <strong className="block text-indigo-900">पूर्ण मुदत ठेव रक्कम नवीन योजनेत वर्ग (100% Book Transfer)</strong>
                        <span className="text-[11px] text-gray-600">मुद्दल + साचलेले व्याज एकत्रित होऊन नवीन पावती तयार होईल.</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded border border-indigo-300">
                      जर्नल व्हाऊचर (JV Transfer)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Payment Mode Controls */}
            {(actionType === 'MaturityClose' || actionType === 'PrematureClose' || (actionType === 'Renewal' && renewalType === 'PrincipalOnly')) && !isPendingMaturityAction && (
              <div className="bg-slate-50/90 p-3.5 rounded-sm border border-slate-300 space-y-3 shadow-2xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      {actionType === 'Renewal' ? 'व्याज परतावा पेमेंट पद्धत (Interest Payout Mode) *' : 'परतावा पेमेंट पद्धत (Payout Payment Mode) *'}
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e: any) => setPaymentMode(e.target.value)}
                      className="w-full text-xs font-bold border border-emerald-500 bg-emerald-50/40 rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-primary text-emerald-950 cursor-pointer shadow-2xs"
                    >
                      <option value="Cash">💵 रोख परतावा (Cash Payout)</option>
                      <option value="Bank">🏦 बँक ट्रान्सफर / धनादेश (Bank Transfer / Cheque)</option>
                      <option value="Transfer">🔄 बचत खात्यात वर्ग (Transfer to Member SB Account)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">तपशील / शेरा (Narration - Optional)</label>
                    <input
                      type="text"
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                      placeholder="उदा. मुदत ठेव परतावा / मुदतपूर्व बंद परतावा"
                      className="w-full border border-gray-300 px-2.5 py-1.5 rounded-sm text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Conditional Cash Badge */}
                {paymentMode === 'Cash' && (
                  <CashLedgerReflectBadge 
                    branchId={selectedAccount.branchID} 
                    transactionType="Withdrawal" 
                    customTitle="परतावा अदा करण्याचे रोख खाते (Payout Cash Ledger)"
                  />
                )}

                {/* Conditional Bank Details Card */}
                {paymentMode === 'Bank' && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">बँक लेजर निवडा (Select Bank GL) *</label>
                        <SearchableSelect
                          options={bankLedgers.map(b => ({
                            value: b.ledgerID.toString(),
                            label: `${b.ledgerID} - ${b.ledgerName} (${b.accountType || 'Bank'})`
                          }))}
                          value={bankAccountLedgerID.toString()}
                          onChange={(val: any) => {
                            const v = typeof val === 'object' && val?.target ? val.target.value : val;
                            setBankAccountLedgerID(parseInt(String(v || 0)));
                          }}
                          placeholder="बँक खाते शोधा..."
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">धनादेश / संदर्भ क्र. (Cheque / Ref No)</label>
                        <input
                          type="text"
                          value={chequeNo}
                          onChange={(e) => setChequeNo(e.target.value)}
                          placeholder="उदा. Cheque 123456 / UTR"
                          className="w-full border border-amber-300 px-2 py-1 rounded-sm text-xs bg-white font-bold text-gray-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">धनादेश तारीख (Cheque Date)</label>
                        <input
                          type="date"
                          value={chequeDate}
                          onChange={(e) => setChequeDate(e.target.value)}
                          className="w-full border border-amber-300 px-2 py-1 rounded-sm text-xs bg-white text-gray-800 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Conditional Saving Transfer Card */}
                {paymentMode === 'Transfer' && (
                  <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded space-y-2">
                    <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">
                      रक्कम जमा करण्यासाठी सभासदाचे बचत खाते निवडा (Select Member Saving A/c) *
                    </label>
                    {memberSavingAccounts.length > 0 ? (
                      <select
                        value={selectedSavingAccountId}
                        onChange={(e) => setSelectedSavingAccountId(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full border border-indigo-300 px-2.5 py-1.5 rounded-sm text-xs bg-white font-bold text-indigo-950 shadow-2xs"
                        required
                      >
                        {memberSavingAccounts.map((acc) => {
                          const avail = Math.max(0, acc.currentBalance - (acc.lienAmount || 0) - (acc.minimumBalance || 0));
                          return (
                            <option key={acc.savingAccountID} value={acc.savingAccountID}>
                              {acc.accountNo} | चालू शिल्लक: ₹{acc.currentBalance.toFixed(2)} (उपलब्ध: ₹{avail.toFixed(2)})
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <div className="text-xs text-red-600 font-bold bg-white p-2 rounded border border-red-200 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>⚠️ या सभासदाचे कोणतेही सक्रिय बचत खाते उपलब्ध नाही! कृपया रोख किंवा बँक पर्याय निवडा.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Accounting Voucher Live Preview */}
        {voucherPreview && (
          <div className="border-t pt-3 space-y-2">
            <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>३. जनरेट होणाऱ्या ऑटो-व्हाउचर लेजर नोंदींचे प्रिव्ह्यू (Accounting Entries Preview)</span>
            </h2>
            <div className="border rounded-sm overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b text-[11px] font-bold text-gray-700">
                    <th className="p-2 w-16 text-center">प्रकार (Dr/Cr)</th>
                    <th className="p-2">लेजर खाते (Ledger Account)</th>
                    <th className="p-2">लेखांकन कारण / शेरा (Particulars)</th>
                    <th className="p-2 text-right w-28">रक्कम (Amount ₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {voucherPreview.map((entry, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="p-2 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          entry.drCr === 'Dr' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {entry.drCr}
                        </span>
                      </td>
                      <td className="p-2 font-bold text-gray-900">{entry.ledgerName}</td>
                      <td className="p-2 text-gray-600 text-[11px]">{entry.note}</td>
                      <td className="p-2 text-right font-mono font-bold text-gray-900">
                        ₹ {entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="pt-2 border-t flex items-center justify-between">
          <div className="text-[11px] text-gray-500">
            * 'व्यवहार पूर्ण करा' बटण दाबल्यावर खाते अपडेट होऊन व्हाऊचर त्वरित पोस्ट केले जाईल.
          </div>
          <button
            type="submit"
            disabled={loading || !selectedAccount || isPendingMaturityAction}
            className={`px-5 py-2 rounded-sm font-bold text-xs shadow-xs transition duration-150 flex items-center gap-1.5 cursor-pointer ${
              loading || !selectedAccount || isPendingMaturityAction
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : actionType === 'PrematureClose'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : actionType === 'Renewal'
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-primary hover:bg-[#004a75] text-white'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>प्रक्रिया होत आहे...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>
                  {actionType === 'MaturityClose' && 'मुदतपूर्ती पेमेंट पूर्ण करा (Process Maturity Payout)'}
                  {actionType === 'PrematureClose' && 'मुदतपूर्व बंद व पेआउट करा (Premature Close)'}
                  {actionType === 'Renewal' && 'नूतनीकरण पूर्ण करा (Process Renewal)'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FdWithdrawalMaturity;
