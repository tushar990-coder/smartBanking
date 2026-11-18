import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Scale, Printer, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import BankLedgerSelect from './common/BankLedgerSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';
import { isHeadOfficeUser, getEffectiveBranchId } from '../utils/branchAccess';

interface EligibleLoan {
  loanAccountID: number;
  branchID: number;
  branchName: string;
  loanAccountNo: string;
  legacyLoanNo?: string | null;
  customerID?: number | null;
  cifNo?: string;
  legacyCustomerNo?: string | null;
  customerName?: string;
  memberName: string;
  memberCode: string;
  mobileNo: string;
  address: string;
  guarantor1Name?: string;
  guarantor2Name?: string;
  loanScheme: string;
  sanctionedAmount?: number;
  loanDisbursementDate?: string;
  maturityDate?: string;
  installmentAmount?: number;
  interestRate?: number;
  penalRate?: number;
  lastInstallmentPaidDate?: string | null;
  principalBalance: number;
  overduePrincipal?: number;
  postedInterestBalance?: number;
  accruedRegularInterest?: number;
  totalRegularInterestDue?: number;
  interestBalance: number;
  overdueInterestBalance: number;
  totalPenalInterestDue?: number;
  overdueInstallmentsCount?: number;
  totalInstallments?: number;
  overdueDays?: number;
  npaCategory?: string;
  isNpa?: boolean;
  netUnpaidLegalExpenses?: number;
  totalOutstanding: number;
  noticesCount?: number;
  hasActiveCase?: boolean;
  activeCaseNumber?: string | null;
  activeCaseStatus?: string | null;
}

interface FormMData {
  sanstha?: any;
  loanAccountID?: number;
  loanAccountNo?: string;
  legacyLoanNo?: string | null;
  branchName?: string;
  asOnDate?: string;
  borrower?: {
    customerID?: number;
    fullName?: string;
    cifNo?: string;
    legacyCustomerNo?: string | null;
    memberCode?: string;
    address?: string;
    mobileNo?: string;
  };
  guarantor1?: {
    customerID?: number;
    cifNo?: string;
    fullName?: string;
    address?: string;
    mobileNo?: string;
  };
  guarantor2?: {
    customerID?: number;
    cifNo?: string;
    fullName?: string;
    address?: string;
    mobileNo?: string;
  };
  loanDetails?: {
    sanctionDate?: string;
    maturityDate?: string;
    sanctionAmount?: number;
    installmentAmount?: number;
    durationMonths?: number;
    interestRate?: number;
    penalRate?: number;
    schemeName?: string;
    postedInterestBalance?: number;
    accruedRegularInterest?: number;
    interestDays?: number;
    overduePrincipal?: number;
    overdueInstallmentsCount?: number;
    overdueDays?: number;
    principalBalance?: number;
    interestBalance?: number;
    penalInterestBalance?: number;
    legalExpenses?: number;
    totalDues?: number;
  };
  noticesCount?: number;
  hasFinalNotice15DaysElapsed?: boolean;
  daysSinceLastNotice?: number;
}

interface Sec101CaseFilingMasterProps {
  branchId?: number;
  effectiveBranch?: number | 'all' | null;
  initialLoanAccountId?: number | null;
  embedded?: boolean;
  onDataChanged?: () => void;
}

export default function Sec101CaseFilingMaster({
  branchId: propBranchId,
  effectiveBranch: propEffectiveBranch,
  initialLoanAccountId,
  embedded = false,
  onDataChanged,
}: Sec101CaseFilingMasterProps = {}) {
  const { user, globalBranchId } = useAuth();
  const isHo = isHeadOfficeUser(user);
  const bizDateStr = getBusinessDateStr(user?.businessDate);

  const [loans, setLoans] = useState<EligibleLoan[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(() => propBranchId || user?.branchID || 1);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(initialLoanAccountId || null);
  const [formM, setFormM] = useState<FormMData | null>(null);
  const [loadingFormM, setLoadingFormM] = useState<boolean>(false);

  // Customer-First Borrower Details (Read-Only display fed from Form M)
  const [borrowerName, setBorrowerName] = useState<string>('');
  const [borrowerCif, setBorrowerCif] = useState<string>('');
  const [borrowerAddress, setBorrowerAddress] = useState<string>('');
  const [borrowerMobile, setBorrowerMobile] = useState<string>('');
  const [loanAccountNo, setLoanAccountNo] = useState<string>('');
  const [schemeName, setSchemeName] = useState<string>('साधारण कर्ज योजना');

  const [principalClaim, setPrincipalClaim] = useState<number>(0);
  const [interestClaim, setInterestClaim] = useState<number>(0);
  const [penalInterestClaim, setPenalInterestClaim] = useState<number>(0);
  const [otherChargesClaim, setOtherChargesClaim] = useState<number>(0);
  const [interestRate, setInterestRate] = useState<number>(14.0);
  const [penalRate, setPenalRate] = useState<number>(2.0);

  // Case Filing Inputs
  const [caseType, setCaseType] = useState<'SEC_101' | 'SEC_91'>('SEC_101');
  const [caseNumber, setCaseNumber] = useState<string>('');
  const [courtName, setCourtName] = useState<string>('मा. सहाय्यक निबंधक, सहकारी संस्था');
  const [advocateName, setAdvocateName] = useState<string>('');
  const [filingDate, setFilingDate] = useState<string>(bizDateStr);
  const [courtFeeAmount, setCourtFeeAmount] = useState<number>(0);
  const [courtFeeChallanNo, setCourtFeeChallanNo] = useState<string>('');
  const [courtFeePaymentMode, setCourtFeePaymentMode] = useState<string>('CASH');
  const [courtFeeBankLedgerId, setCourtFeeBankLedgerId] = useState<number>(0);
  const [courtFeeReferenceNo, setCourtFeeReferenceNo] = useState<string>('');
  const [bypassNoticeWaitCheck, setBypassNoticeWaitCheck] = useState<boolean>(false);
  const [remarks, setRemarks] = useState<string>('');
  const [filing, setFiling] = useState<boolean>(false);

  const [loanSearchTerm, setLoanSearchTerm] = useState<string>('');
  const [showPetitionPrint, setShowPetitionPrint] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (propBranchId && propBranchId > 0) {
      setSelectedBranchId(propBranchId);
    } else {
      const eff = getEffectiveBranchId(user, globalBranchId);
      if (typeof eff === 'number' && eff > 0) setSelectedBranchId(eff);
    }
  }, [propBranchId, user, globalBranchId]);

  useEffect(() => {
    setFilingDate(bizDateStr);
  }, [bizDateStr]);

  useEffect(() => {
    axios.get('/api/Branches').then((r) => Array.isArray(r.data) && setBranches(r.data)).catch(console.error);
  }, []);

  const clearSelection = () => {
    setSelectedLoanId(null);
    setFormM(null);
    setBorrowerName('');
    setBorrowerCif('');
    setBorrowerAddress('');
    setBorrowerMobile('');
    setLoanAccountNo('');
    setPrincipalClaim(0);
    setInterestClaim(0);
    setPenalInterestClaim(0);
    setOtherChargesClaim(0);
    setCaseNumber('');
  };

  const fetchEligibleLoans = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const qs = new URLSearchParams();
      if (!(propEffectiveBranch === 'all' && isHo)) qs.set('branchId', String(selectedBranchId));
      if (filingDate || bizDateStr) qs.set('asOnDate', filingDate || bizDateStr);
      const queryStr = qs.toString() ? `?${qs.toString()}` : '';
      const res = await axios.get(`/api/LegalRecovery/eligible-loans${queryStr}`);
      const data: EligibleLoan[] = Array.isArray(res.data) ? res.data : [];
      setLoans(data);

      if (initialLoanAccountId && data.some((l) => l.loanAccountID === initialLoanAccountId)) {
        await handleSelectLoan(initialLoanAccountId, data.find((l) => l.loanAccountID === initialLoanAccountId));
      } else if (data.length > 0 && (!selectedLoanId || !data.some((l) => l.loanAccountID === selectedLoanId))) {
        await handleSelectLoan(data[0].loanAccountID, data[0]);
      } else if (data.length === 0) {
        clearSelection();
      }
    } catch (e: any) {
      console.error(e);
      setApiError(
        e?.response?.data?.message ||
        'थकबाकीदार कर्ज खाती लोड करताना सर्व्हर त्रुटी आली. कृपया Backend API चालू असल्याची खात्री करा.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    clearSelection();
    fetchEligibleLoans();
  }, [selectedBranchId, propEffectiveBranch]);

  const handleSelectLoan = async (loanId: number, fallbackLoanObj?: EligibleLoan, overrideAsOnDate?: string, overrideCaseType?: 'SEC_101' | 'SEC_91') => {
    if (!loanId || loanId <= 0) {
      clearSelection();
      return;
    }
    setSelectedLoanId(loanId);
    setLoadingFormM(true);

    const effectiveType = overrideCaseType || caseType;
    const effectiveDate = overrideAsOnDate || filingDate || bizDateStr;
    const yr = effectiveDate.slice(0, 4) || String(new Date().getFullYear());
    const prefix = effectiveType === 'SEC_91' ? '९१' : '१०१';

    const loanObj = fallbackLoanObj || loans.find((l) => l.loanAccountID === loanId);
    if (loanObj) {
      setBorrowerName(loanObj.customerName || loanObj.memberName || '');
      setBorrowerCif(loanObj.cifNo || loanObj.memberCode || '');
      setBorrowerAddress(loanObj.address || '');
      setBorrowerMobile(loanObj.mobileNo || '');
      setLoanAccountNo(loanObj.loanAccountNo || '');
      setSchemeName(loanObj.loanScheme || 'कर्ज योजना');
      setPrincipalClaim(loanObj.principalBalance || 0);
      setInterestClaim(loanObj.totalRegularInterestDue ?? loanObj.interestBalance ?? 0);
      setPenalInterestClaim(loanObj.totalPenalInterestDue ?? loanObj.overdueInterestBalance ?? 0);
      setOtherChargesClaim(loanObj.netUnpaidLegalExpenses || 0);
      setCaseNumber(`${prefix}/${yr}/${loanObj.loanAccountNo}`);
    }

    try {
      const res = await axios.get(`/api/LegalRecovery/form-m/${loanId}`, {
        params: { asOnDate: effectiveDate },
      });
      if (res.data) {
        const data: FormMData = res.data;
        setApiError(null);
        setFormM(data);
        if (data.borrower?.fullName) setBorrowerName(data.borrower.fullName);
        if (data.borrower?.cifNo || data.borrower?.memberCode) setBorrowerCif(data.borrower.cifNo || data.borrower.memberCode || '');
        if (data.borrower?.address) setBorrowerAddress(data.borrower.address);
        if (data.borrower?.mobileNo) setBorrowerMobile(data.borrower.mobileNo);
        if (data.loanAccountNo) setLoanAccountNo(data.loanAccountNo);
        if (data.loanDetails) {
          setPrincipalClaim(data.loanDetails.principalBalance || 0);
          setInterestClaim(data.loanDetails.interestBalance || 0);
          setPenalInterestClaim(data.loanDetails.penalInterestBalance || 0);
          setOtherChargesClaim(data.loanDetails.legalExpenses || 0);
          setInterestRate(data.loanDetails.interestRate || 14.0);
          setPenalRate(data.loanDetails.penalRate || 2.0);
          setSchemeName(data.loanDetails.schemeName || 'कर्ज योजना');
        }
        setCaseNumber(`${prefix}/${yr}/${data.loanAccountNo || loanObj?.loanAccountNo}`);
      }
    } catch (e: any) {
      console.error(e);
      setApiError(e?.response?.data?.message || 'Form M थकबाकी तक्ता सर्व्हरवरून लोड करताना त्रुटी आली.');
    } finally {
      setLoadingFormM(false);
    }
  };

  const handleCaseTypeChange = (nextType: 'SEC_101' | 'SEC_91') => {
    setCaseType(nextType);
    if (nextType === 'SEC_91') {
      setCourtName('मा. सहकारी न्यायालय (Co-operative Court)');
    } else {
      setCourtName('मा. सहाय्यक निबंधक, सहकारी संस्था');
    }
    if (selectedLoanId && loanAccountNo) {
      const yr = (filingDate || bizDateStr).slice(0, 4);
      setCaseNumber(`${nextType === 'SEC_91' ? '९१' : '१०१'}/${yr}/${loanAccountNo}`);
    }
  };

  const calculatedTotalClaim =
    Number(principalClaim || 0) +
    Number(interestClaim || 0) +
    Number(penalInterestClaim || 0) +
    Number(otherChargesClaim || 0);

  const selectedLoan = loans.find((l) => l.loanAccountID === selectedLoanId);

  const handleFileCase = async () => {
    if (!selectedLoanId || selectedLoanId <= 0) {
      alert('कृपया प्रथम वैध कर्जदार खाते निवडा.');
      return;
    }
    if (!caseNumber.trim()) {
      alert('कृपया दावा क्रमांक (Case Number) प्रविष्ट करा.');
      return;
    }
    if (Number(courtFeeAmount) > 0 && courtFeePaymentMode === 'BANK_TRANSFER' && (!courtFeeBankLedgerId || courtFeeBankLedgerId <= 0)) {
      alert('कोर्ट फी बँकेद्वारे भरल्यास कृपया बँक जी.एल. खाते निवडा.');
      return;
    }

    setFiling(true);
    try {
      const targetBranch = selectedLoan?.branchID || selectedBranchId;
      const res = await axios.post('/api/LegalRecovery/case/file', {
        branchId: targetBranch,
        loanAccountId: selectedLoanId,
        caseType,
        caseNumber,
        courtName,
        advocateName,
        filingDate,
        principalClaim: Number(principalClaim) || 0,
        interestClaim: Number(interestClaim) || 0,
        penalInterestClaim: Number(penalInterestClaim) || 0,
        otherChargesClaim: Number(otherChargesClaim) || 0,
        courtFeeAmount: Number(courtFeeAmount) || 0,
        courtFeeChallanNo,
        paymentMode: Number(courtFeeAmount) > 0 ? courtFeePaymentMode : 'CASH',
        bankLedgerId: Number(courtFeeAmount) > 0 && courtFeePaymentMode === 'BANK_TRANSFER' ? courtFeeBankLedgerId : null,
        referenceNo: Number(courtFeeAmount) > 0 && courtFeePaymentMode === 'BANK_TRANSFER' ? courtFeeReferenceNo || courtFeeChallanNo : null,
        bypassNoticeWaitCheck,
        remarks,
      });

      if (res.status === 200) {
        const result = res.data;
        alert(
          `${caseType === 'SEC_91' ? 'कलम ९१' : 'कलम १०१'} दावा अर्ज यशस्वीरीत्या दाखल झाला!\nदावा क्र.: ${result.caseNumber || caseNumber}` +
            (result.voucherNo ? `\nकोर्ट फी व्हाउचर क्र.: ${result.voucherNo}` : '')
        );
        setCourtFeeAmount(0);
        setCourtFeeChallanNo('');
        setCourtFeeBankLedgerId(0);
        setCourtFeeReferenceNo('');
        setBypassNoticeWaitCheck(false);
        await fetchEligibleLoans();
        if (onDataChanged) onDataChanged();
        setShowPetitionPrint(true);
      }
    } catch (e: any) {
      console.error(e);
      alert('दावा दाखल करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setFiling(false);
    }
  };

  const filteredLoans = loans.filter((l) => {
    const q = loanSearchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (l.customerName || l.memberName || '').toLowerCase().includes(q) ||
      (l.loanAccountNo || '').toLowerCase().includes(q) ||
      (l.cifNo || l.memberCode || '').toLowerCase().includes(q) ||
      (l.legacyCustomerNo || '').toLowerCase().includes(q)
    );
  });

  const loanSelectOptions = loans.map((l) => ({
    value: l.loanAccountID,
    label: `${l.loanAccountNo} - ${l.customerName || l.memberName} (CIF: ${l.cifNo || l.memberCode || '-'})`,
    subLabel: `थकबाकी: ₹${(l.totalOutstanding || 0).toLocaleString('en-IN')}`,
  }));

  return (
    <div className={embedded ? 'max-w-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5' : 'p-2.5 max-w-full h-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5'}>
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } }`}</style>

      <div className={showPetitionPrint ? 'space-y-2.5 print:hidden' : 'space-y-2.5'}>
        {/* Header (Standalone CBS Header vs Embedded Action Strip) */}
        {!embedded && (
          <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary shrink-0" />
                <h1 className="text-sm font-bold text-primary tracking-wide">कलम १०१ / ९१ दावा अर्ज व Form 'M' तक्ता (Case Filing & Statement)</h1>
              </div>
              <p className="text-slate-500 text-[10.5px] mt-0.5">
                मा. सहाय्यक/उपनिबंधक (कलम १०१) किंवा मा. सहकारी न्यायालय (कलम ९१) दावा अर्ज, Form 'M' थकबाकी तक्ता व कोर्ट फी व्हाउचर.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPetitionPrint(true)}
              disabled={!selectedLoanId}
              className="bg-primary hover:opacity-95 text-white px-3.5 py-1.5 rounded-sm text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> दावा अर्ज प्रिंट पूर्वावलोकन
            </button>
          </div>
        )}

        {/* Top Search & Branch Bar */}
        <div className="bg-white px-3 py-2 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center gap-2.5 flex-1">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-gray-700 whitespace-nowrap">शाखा:</label>
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
            </div>
            <div className="flex-1 max-w-lg">
              <SearchableSelect
                options={loanSelectOptions}
                value={selectedLoanId || ''}
                onChange={(e) => handleSelectLoan(Number(e.target.value))}
                placeholder="CIF / कर्जदार खाते क्र. किंवा नाव शोधा..."
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {embedded && (
              <button
                type="button"
                onClick={() => setShowPetitionPrint(true)}
                disabled={!selectedLoanId}
                className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 rounded-sm text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" /> दावा अर्ज प्रिंट पूर्वावलोकन
              </button>
            )}
            <button type="button" onClick={fetchEligibleLoans} className="p-1.5 bg-white hover:bg-primary/10 text-gray-700 hover:text-primary rounded-sm border border-gray-300 transition" title="रिफ्रेश करा">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-[11px] text-gray-600 font-medium">
              पात्र खाती: <strong className="text-primary">{loans.length}</strong>
            </span>
          </div>
        </div>

        {apiError && (
          <div className="bg-rose-50 border border-rose-300 border-l-4 border-l-rose-600 text-rose-900 px-3 py-2 rounded-sm text-xs font-bold flex items-center gap-2 print:hidden">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Left: Borrower List */}
          <div className="lg:col-span-4 bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-2.5">
            <h2 className="text-xs font-bold text-primary border-l-4 border-primary pl-2 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              थकबाकीदार कर्ज खाती ({loans.length})
            </h2>

            <div className="relative">
              <input
                type="text"
                placeholder="नाव / CIF / खाते क्र. शोधा..."
                value={loanSearchTerm}
                onChange={(e) => setLoanSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-sm pl-7 pr-2 py-1 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
              <SearchableIconPlaceholder />
            </div>

            <div className="max-h-[540px] overflow-y-auto space-y-1.5 pr-1">
              {filteredLoans.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  {loading ? 'खाती लोड होत आहेत...' : 'कोणतीही पात्र खाती आढळली नाहीत.'}
                </div>
              ) : (
                filteredLoans.map((loan) => {
                  const isSelected = selectedLoanId === loan.loanAccountID;
                  return (
                    <div
                      key={loan.loanAccountID}
                      onClick={() => handleSelectLoan(loan.loanAccountID, loan)}
                      className={`p-2 rounded-sm border cursor-pointer transition ${
                        isSelected ? 'border-primary bg-primary/10 shadow-xs font-bold' : 'border-gray-200 hover:border-primary/40 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-bold text-xs text-gray-900 flex items-center gap-1 flex-wrap">
                            <span>{loan.customerName || loan.memberName}</span>
                            {loan.isNpa && (
                              <span className="text-[9px] font-bold bg-rose-100 text-rose-800 px-1 py-0.2 rounded-sm">
                                {loan.npaCategory}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            खाते: {loan.loanAccountNo} | CIF: {loan.cifNo || loan.memberCode || '-'}
                          </div>
                          <div className="text-[9.5px] text-gray-600 mt-0.5">
                            मंजूर: ₹{Number(loan.sanctionedAmount || 0).toLocaleString('en-IN')} | मुद्दल: ₹{(loan.principalBalance || 0).toLocaleString('en-IN')} | व्याज: ₹{(loan.totalRegularInterestDue ?? loan.interestBalance ?? 0).toLocaleString('en-IN')}
                          </div>
                          {loan.hasActiveCase && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded-sm">
                              दावा दाखल: {loan.activeCaseNumber} ({loan.activeCaseStatus})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded-sm shrink-0">
                          ₹{(loan.totalOutstanding || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Form M & Filing Form */}
          <div className="lg:col-span-8 space-y-3">
            {selectedLoan?.hasActiveCase && (
              <div className="bg-amber-50 border border-amber-300 text-amber-950 p-3 rounded-sm text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>सावधान: या कर्ज खात्यावर आधीच दावा क्र. {selectedLoan.activeCaseNumber} ({selectedLoan.activeCaseStatus}) सक्रिय आहे.</span>
              </div>
            )}

            {formM && !formM.hasFinalNotice15DaysElapsed && (
              <div className="bg-orange-50 border border-orange-300 text-orange-950 p-3 rounded-sm text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-orange-700 shrink-0" />
                  वैधानिक १५-दिवस अंतिम नोटीस सूचना:
                </div>
                <p className="text-[11px]">
                  या खात्यावर अंतिम कायदेशीर नोटीसनंतर अद्याप १५ दिवस पूर्ण झालेले नाहीत (सध्या: {formM.daysSinceLastNotice || 0} दिवस / एकूण नोटिसा: {formM.noticesCount || 0}).
                </p>
                <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bypassNoticeWaitCheck}
                    onChange={(e) => setBypassNoticeWaitCheck(e.target.checked)}
                  />
                  <span>विशेष अधिकारी मंजुरीसह १५ दिवसांची अट वगळून दावा दाखल करा (Override)</span>
                </label>
              </div>
            )}

            {/* Section 1: Customer-First Details */}
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-[11px] font-bold text-primary border-l-4 border-primary pl-2 uppercase">
                  १. कर्जदार व जामीनदारांची माहिती (Customer-ID-First)
                </span>
                {loadingFormM && <span className="text-[10px] text-amber-600 font-bold animate-pulse">Form M लोड होत आहे...</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-700">कर्जदाराचे नाव (Customer Name):</label>
                  <input type="text" readOnly value={borrowerName} className="w-full mt-0.5 border border-gray-200 rounded-sm px-2.5 py-1.5 text-xs font-bold text-gray-900 bg-slate-50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-700">CIF / ग्राहक कोड:</label>
                  <input type="text" readOnly value={borrowerCif} className="w-full mt-0.5 border border-gray-200 rounded-sm px-2.5 py-1.5 text-xs font-mono font-bold text-primary bg-slate-50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-700">कर्ज खाते क्र. (Read-Only):</label>
                  <input type="text" readOnly value={loanAccountNo} className="w-full mt-0.5 border border-gray-200 rounded-sm px-2.5 py-1.5 text-xs font-mono font-bold text-gray-900 bg-slate-50" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-700">पत्ता (Address):</label>
                  <input type="text" readOnly value={borrowerAddress} className="w-full mt-0.5 border border-gray-200 rounded-sm px-2.5 py-1.5 text-xs text-gray-800 bg-slate-50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-700">मोबाईल क्र. (Mobile):</label>
                  <input type="text" readOnly value={borrowerMobile} className="w-full mt-0.5 border border-gray-200 rounded-md px-2.5 py-1.5 text-xs text-gray-800 bg-gray-50" />
                </div>
              </div>

              {(formM?.guarantor1 || formM?.guarantor2) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  {formM?.guarantor1 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px]">
                      <div className="font-bold text-slate-800">जामीनदार १: {formM.guarantor1.fullName}</div>
                      <div className="text-slate-600 text-[10px]">CIF: {formM.guarantor1.cifNo || '-'} | मो.: {formM.guarantor1.mobileNo || '-'}</div>
                    </div>
                  )}
                  {formM?.guarantor2 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px]">
                      <div className="font-bold text-slate-800">जामीनदार २: {formM.guarantor2.fullName}</div>
                      <div className="text-slate-600 text-[10px]">CIF: {formM.guarantor2.cifNo || '-'} | मो.: {formM.guarantor2.mobileNo || '-'}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Form M Dues */}
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-[11px] font-bold text-primary border-l-4 border-primary pl-2 uppercase">
                  २. Form 'M' वैधानिक थकबाकी तक्ता ({schemeName} • दिनांक {filingDate} अखेर)
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-50/70 p-2.5 rounded-sm border border-gray-200">
                <div>
                  <label className="text-[10px] font-bold text-gray-700">१. थकीत मुद्दल (₹):</label>
                  <input type="number" value={principalClaim} onChange={(e) => setPrincipalClaim(Number(e.target.value))} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs font-bold text-gray-900 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                  {formM?.loanDetails?.overduePrincipal !== undefined && (
                    <div className="text-[9px] text-gray-500 mt-0.5">हप्ता थकबाकी: ₹{Number(formM.loanDetails.overduePrincipal || 0).toLocaleString('en-IN')}</div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-700">२. नियमित व्याज (₹):</label>
                  <input type="number" value={interestClaim} onChange={(e) => setInterestClaim(Number(e.target.value))} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs font-bold text-gray-900 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                  {formM?.loanDetails?.accruedRegularInterest !== undefined && (
                    <div className="text-[9px] text-amber-900 mt-0.5">
                      येणे: ₹{Number(formM.loanDetails.postedInterestBalance || 0).toLocaleString('en-IN')} + जमा ({formM.loanDetails.interestDays || 0} दि.): ₹{Number(formM.loanDetails.accruedRegularInterest || 0).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-700">३. दंडव्याज (₹):</label>
                  <input type="number" value={penalInterestClaim} onChange={(e) => setPenalInterestClaim(Number(e.target.value))} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs font-bold text-gray-900 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-700">४. येणे कायदेशीर खर्च (₹):</label>
                  <input type="number" value={otherChargesClaim} onChange={(e) => setOtherChargesClaim(Number(e.target.value))} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs font-bold text-gray-900 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>

              <div className="bg-primary/10 border border-primary/30 p-3 rounded-sm flex justify-between items-center">
                <div>
                  <div className="text-[11px] font-black text-primary uppercase">एकूण दावा मागणी रक्कम (Total Claim Amount):</div>
                  <div className="text-[10px] text-slate-600">मुद्दल + व्याज + दंडव्याज + मंजूर येणे कायदेशीर खर्च</div>
                </div>
                <div className="text-xl font-black text-primary">₹{calculatedTotalClaim.toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* Section 3: Case Details & Court Fee */}
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-gray-100 pb-2">
                <span className="text-[11px] font-bold text-primary border-l-4 border-primary pl-2 uppercase">
                  ३. दावा व कोर्ट फी तपशील (Case Filing & Auto-Voucher)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCaseTypeChange('SEC_101')}
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-bold border transition ${
                      caseType === 'SEC_101' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    कलम १०१ (वसुली दाखला)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCaseTypeChange('SEC_91')}
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-bold border transition ${
                      caseType === 'SEC_91' ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    कलम ९१ (सहकारी न्यायालय लवाद)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700">दावा क्रमांक (Case No.):</label>
                  <input type="text" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs font-bold text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700">न्यायालय / प्राधिकरण (Authority / Court):</label>
                  <input type="text" value={courtName} onChange={(e) => setCourtName(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700">वकिलाचे नाव (Advocate Name):</label>
                  <input type="text" value={advocateName} onChange={(e) => setAdvocateName(e.target.value)} placeholder="ॲड. श्री..." className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700">दाखल तारीख (Filing Date):</label>
                  <input
                    type="date"
                    value={filingDate}
                    onChange={(e) => {
                      const nextDt = e.target.value;
                      setFilingDate(nextDt);
                      if (selectedLoanId) handleSelectLoan(selectedLoanId, undefined, nextDt);
                    }}
                    className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700">कोर्ट फी रक्कम (Court Fee ₹):</label>
                  <input type="number" value={courtFeeAmount} onChange={(e) => setCourtFeeAmount(Number(e.target.value))} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs font-bold text-rose-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700">कोर्ट फी शासकीय चलन क्र.:</label>
                  <input type="text" value={courtFeeChallanNo} onChange={(e) => setCourtFeeChallanNo(e.target.value)} placeholder="GRAS / Challan No." className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>

              {Number(courtFeeAmount) > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-sm p-3 space-y-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-800">कोर्ट फी पेमेंट पद्धत:</label>
                      <select
                        value={courtFeePaymentMode}
                        onChange={(e) => {
                          setCourtFeePaymentMode(e.target.value);
                          if (e.target.value !== 'BANK_TRANSFER') {
                            setCourtFeeBankLedgerId(0);
                            setCourtFeeReferenceNo('');
                          }
                        }}
                        className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs font-bold text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      >
                        <option value="CASH">रोख (Cash)</option>
                        <option value="BANK_TRANSFER">बँक खाते / GRAS ऑनलाइन (Bank Account)</option>
                        <option value="JOURNAL">जर्नल (Journal)</option>
                      </select>
                    </div>
                    {courtFeePaymentMode === 'BANK_TRANSFER' && (
                      <div>
                        <label className="text-[11px] font-bold text-primary">चेक / UTR संदर्भ क्र.:</label>
                        <input type="text" value={courtFeeReferenceNo} onChange={(e) => setCourtFeeReferenceNo(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                    )}
                  </div>
                  {courtFeePaymentMode === 'BANK_TRANSFER' && (
                    <BankLedgerSelect value={courtFeeBankLedgerId} onChange={setCourtFeeBankLedgerId} showCountBadge />
                  )}
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-gray-700">शेरा / तपशील (Remarks):</label>
                <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1.5 text-xs text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>

              <button
                onClick={handleFileCase}
                disabled={filing || !selectedLoanId}
                className="w-full py-2.5 rounded-sm font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 bg-primary hover:opacity-95 text-white"
              >
                {filing ? 'दावा दाखल होत आहे...' : `${caseType === 'SEC_91' ? 'कलम ९१ लवाद दावा' : 'कलम १०१ दावा अर्ज'} दाखल करा व सेव्ह करा`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Petition Print Modal */}
      {showPetitionPrint && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:static print:bg-white print:p-0">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl space-y-6 print:shadow-none print:max-h-none print:p-2 print:overflow-visible">
            <div className="text-center font-bold text-sm text-slate-900 border-b-2 border-slate-900 pb-3 space-y-1">
              <p className="text-base font-extrabold uppercase">{courtName || 'मा. सहाय्यक निबंधक, सहकारी संस्था यांचेकडे'}</p>
              <p className="text-xs text-slate-600">
                {caseType === 'SEC_91'
                  ? 'महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे कलम ९१ अन्वये सहकारी न्यायालयात लवाद दावा अर्ज'
                  : 'महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे कलम १०१ अन्वये वसुली दाखला मिळणेबाबतचा दावा अर्ज'}
              </p>
            </div>

            <div className="flex justify-between text-xs font-bold text-slate-800">
              <div>दावा अर्ज क्र.: {caseNumber}</div>
              <div>दाखल तारीख: {filingDate}</div>
            </div>

            <div className="text-xs text-slate-800 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <strong>अर्जदार (Applicant):</strong>
                <br />
                {formM?.sanstha?.sansthaNameMarathi || formM?.sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
                <br />
                पत्ता: {formM?.sanstha?.address || 'मुख्य कार्यालय'}
              </div>
              <div className="text-center font-bold text-slate-400">-- विरुद्ध --</div>
              <div>
                <strong>गैरअर्जदार क्र. १ (मुख्य कर्जदार):</strong>
                <br />
                {borrowerName} (CIF: {borrowerCif || '-'} | कर्ज खाते: {loanAccountNo})
                <br />
                पत्ता: {borrowerAddress || '-'} | मो.: {borrowerMobile || '-'}
              </div>
              {formM?.guarantor1 && (
                <div>
                  <strong>गैरअर्जदार क्र. २ (जामीनदार क्र. १):</strong>
                  <br />
                  {formM.guarantor1.fullName} (CIF: {formM.guarantor1.cifNo || '-'}) | पत्ता: {formM.guarantor1.address || '-'} | मो.: {formM.guarantor1.mobileNo || '-'}
                </div>
              )}
              {formM?.guarantor2 && (
                <div>
                  <strong>गैरअर्जदार क्र. ३ (जामीनदार क्र. २):</strong>
                  <br />
                  {formM.guarantor2.fullName} (CIF: {formM.guarantor2.cifNo || '-'}) | पत्ता: {formM.guarantor2.address || '-'} | मो.: {formM.guarantor2.mobileNo || '-'}
                </div>
              )}
            </div>

            <div className="text-xs text-slate-800 space-y-3 leading-relaxed text-justify">
              <p><strong>अर्जदार संस्थेचा सविनय अर्ज खालीलप्रमाणे आहे:</strong></p>
              <p>
                १. अर्जदार ही एक नोंदणीकृत सहकारी पतसंस्था असून गैरअर्जदार क्र. १ यांनी संस्थेकडून खाते क्र. <strong>{loanAccountNo}</strong> अन्वये कर्ज घेतले होते व गैरअर्जदार क्र. २ व ३ हे सदर कर्जाचे कायदेशीर जामीनदार आहेत.
              </p>
              <p>
                २. गैरअर्जदारांनी कर्जाची नियमित परतफेड न केल्यामुळे त्यांना वारंवार कायदेशीर नोटिसा देण्यात आल्या. परंतु त्यांनी मुदतीत रकमेचा भरणा केला नाही.
              </p>
              <p>
                ३. <strong>थकबाकी विवरण (Form 'M' Statement of Dues — दिनांक {filingDate} अखेर):</strong>
              </p>

              <table className="w-full border text-xs border-slate-300">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border p-2">अ.क्र.</th>
                    <th className="border p-2">तपशील</th>
                    <th className="border p-2 text-right">रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2 text-center">१</td>
                    <td className="border p-2">थकीत मुद्दल रक्कम (Principal Dues)</td>
                    <td className="border p-2 text-right">₹{Number(principalClaim || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="border p-2 text-center">२</td>
                    <td className="border p-2">थकीत नियमित व्याज (Interest @ {interestRate}%)</td>
                    <td className="border p-2 text-right">₹{Number(interestClaim || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="border p-2 text-center">३</td>
                    <td className="border p-2">दंडव्याज (Penal Interest @ {penalRate}%)</td>
                    <td className="border p-2 text-right">₹{Number(penalInterestClaim || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="border p-2 text-center">४</td>
                    <td className="border p-2">नोटीस व कायदेशीर खर्च (Legal/Notice Charges)</td>
                    <td className="border p-2 text-right">₹{Number(otherChargesClaim || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="bg-blue-50 font-bold text-blue-900 text-sm">
                    <td className="border p-2 text-center" colSpan={2}>एकूण दावा वसुली रक्कम (Total Claim Amount)</td>
                    <td className="border p-2 text-right">₹{calculatedTotalClaim.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>

              <p><strong>४. मागणी (Prayer):</strong></p>
              <p>
                अ) गैरअर्जदार यांचेकडून अर्जदार संस्थेस एकूण दावा रक्कम ₹{calculatedTotalClaim.toLocaleString('en-IN')} व प्रत्यक्ष वसुली होईपर्यंतचे चालू व्याज मिळण्याचा{' '}
                <strong>
                  {caseType === 'SEC_91'
                    ? 'महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे कलम ९१ अन्वये निवाडा / आदेश (Award)'
                    : 'महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे कलम १०१ अन्वये वसुली दाखला (Recovery Certificate)'}
                </strong>{' '}
                मंजूर करण्यात यावा.
              </p>
              <p>ब) सदर दाव्याचा कोर्ट फी खर्च (₹{courtFeeAmount}) व कायदेशीर खर्च गैरअर्जदारांवर आकारण्यात यावा.</p>
            </div>

            <div className="flex justify-between items-end pt-8 text-xs font-bold text-slate-900">
              <div>
                <p>ॲडव्होकेट: {advocateName || 'संस्थेचे कायदेशीर सल्लागार'}</p>
              </div>
              <div className="text-center space-y-6">
                <p>अर्जदार संस्थेतर्फे</p>
                <p>
                  शाखा व्यवस्थापक / मुख्य कार्यकारी अधिकारी
                  <br />
                  {formM?.sanstha?.sansthaNameMarathi || formM?.sanstha?.sansthaName || 'सहकारी पतसंस्था'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <button
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" /> अधिकृत दावा अर्ज प्रिंट करा
              </button>
              <button
                onClick={() => setShowPetitionPrint(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-xl font-bold text-xs"
              >
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchableIconPlaceholder() {
  return <span className="text-gray-400 absolute left-2 top-1.5 text-xs pointer-events-none">🔍</span>;
}
