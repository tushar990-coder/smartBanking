import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Select from 'react-select';
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { Search, RefreshCw, Calendar, ShieldCheck, Landmark } from 'lucide-react';
import CbsReportLayout, { formatDisplayDate, SansthaDetails } from './common/CbsReportLayout';
import { useAuth } from '../context/AuthContext';

interface LoanLedgerGuarantorDto {
  name: string;
  cifNo?: string | null;
  mobileNo?: string | null;
}

interface LoanLedgerDepositCollateralDto {
  collateralID: number;
  collateralType: string;
  depositTypeLabel: string;
  schemeName: string;
  depositAccountID: number;
  depositAccountNo: string;
  legacyDepositAccountNo?: string | null;
  holderName: string;
  openingDate?: string | null;
  maturityDate?: string | null;
  interestRate: number;
  depositAmount: number;
  currentBalance: number;
  maturityAmount?: number | null;
  lienAmount: number;
  lienStatus: string;
  depositStatus: string;
}

interface LoanLedgerTransactionDto {
  date: string;
  receiptNo: string;
  particulars: string;
  loanDisbursement: number;
  principalDeposit: number;
  interest: number;
  penalInterest: number;
  receivableInterest: number;
  recoveryCharges: number;
  total: number;
  days: number;
  balance: number;
}

interface OpeningBalanceScheduleDto {
  no: number;
  date: string;
  principal: number;
  interest: number;
  total: number;
  balance: number;
  openingBalance?: number;
  closingBalance?: number;
  days?: number;
  interestRate?: number;
}

interface LoanLedgerReportDto {
  sansthaInfo?: SansthaDetails & { sansthaAddress?: string };
  branchName?: string;
  loanType: string;
  loanAccountNo: string;
  legacyAccountNumber?: string | null;
  status: string;
  sanctionedAmount: number;
  principalBalance?: number;
  memberName: string;
  mobileNo?: string;
  legacyCustomerNo?: string | null;
  interestRate: number;
  disbursementDate: string | null;
  installmentAmount: number;
  installmentFrequency?: string;
  aadhaarNo: string;
  panNo: string;
  cifNo: string;
  maturityDate: string | null;
  durationMonths: number;
  overdueInstallmentCount: number;
  overdueAmount: number;
  collateralCategory?: string | null;
  securityDetails?: string | null;
  securityValue?: number;
  isDepositBackedLoan?: boolean;
  guarantors: LoanLedgerGuarantorDto[];
  depositCollaterals?: LoanLedgerDepositCollateralDto[];
  transactions: LoanLedgerTransactionDto[];
  installmentChart: OpeningBalanceScheduleDto[];
}

interface LoanRate {
  loanRateID: number;
  loanType: string;
  shortName?: string;
}

interface LoanAccountItem {
  loanAccountID: number;
  loanAccountNo: string;
  legacyAccountNumber?: string | null;
  loanRateID: number;
  memberID?: number;
  customerID?: number;
  member?: {
    firstName: string;
    lastName: string;
    memberCode?: string;
  };
  customer?: {
    firstName: string;
    middleName?: string;
    lastName: string;
    cifNo?: string;
    legacyCustomerNo?: string;
  };
}

const fmtCurrency = (num: number | null | undefined): string => {
  const val = Number(num || 0);
  return val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const fmtCellAmount = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num) || Number(num) === 0) return '-';
  return fmtCurrency(num);
};

const formatParticularsMarathi = (raw: string): string => {
  if (!raw) return '-';
  const trimmed = raw.trim();
  if (trimmed === 'Opening Balance') return 'आरंभीची शिल्लक (Op.Bal)';
  if (trimmed.includes('मागील शिल्लक') || trimmed === 'Previous Balance') return 'मागील शिल्लक (Op.Bal)';
  if (trimmed === 'Loan Disbursement') return 'कर्ज वाटप (Disbursement)';
  if (trimmed === 'Loan Collection') return 'कर्ज हप्ता / वसुली जमा';
  return trimmed;
};

const formatLienStatusMarathi = (status?: string | null): string => {
  const s = (status || '').trim().toLowerCase();
  if (s === 'released') return 'बोजा मुक्त';
  if (s === 'invoked') return 'वसुलीत वर्ग';
  if (s === 'lienmarked' || s === 'pledged') return 'तारण सक्रिय';
  return status || 'तारण सक्रिय';
};

const formatLoanStatusMarathi = (status?: string | null): string => {
  const s = (status || '').trim().toLowerCase();
  if (s === 'active') return 'सुरू (Active)';
  if (s === 'closed') return 'बंद (Closed)';
  if (s === 'npa') return 'थकीत / NPA';
  return status || '-';
};

const compactSelectStyles = {
  control: (base: any) => ({
    ...base,
    minHeight: '24px',
    height: '24px',
    fontSize: '11px'
  }),
  valueContainer: (base: any) => ({
    ...base,
    padding: '0 4px'
  }),
  input: (base: any) => ({
    ...base,
    margin: 0,
    padding: 0
  }),
  dropdownIndicator: (base: any) => ({
    ...base,
    padding: '1px'
  }),
  clearIndicator: (base: any) => ({
    ...base,
    padding: '1px'
  }),
  option: (base: any) => ({
    ...base,
    fontSize: '11px',
    padding: '3px 6px'
  }),
  menuPortal: (base: any) => ({
    ...base,
    zIndex: 9999
  })
};

const LoanLedgerReport: React.FC = () => {
  const { user } = useAuth();

  const [loanRates, setLoanRates] = useState<LoanRate[]>([]);
  const [allLoanAccounts, setAllLoanAccounts] = useState<LoanAccountItem[]>([]);
  const [selectedLoanRate, setSelectedLoanRate] = useState<any>(null);
  const [selectedLoanAccount, setSelectedLoanAccount] = useState<any>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showInstallmentChart, setShowInstallmentChart] = useState<boolean>(false);
  const [signatureTier, setSignatureTier] = useState<'3-tier' | '4-tier'>('3-tier');

  const [reportData, setReportData] = useState<LoanLedgerReportDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const buildAccountOption = (la: LoanAccountItem) => {
    const name = la.customer
      ? `${la.customer.firstName || ''} ${la.customer.middleName ? la.customer.middleName + ' ' : ''}${la.customer.lastName || ''}`.trim()
      : `${la.member?.firstName || ''} ${la.member?.lastName || ''}`.trim();
    const code = la.customer?.cifNo
      ? `(CIF: ${la.customer.cifNo})`
      : la.member?.memberCode
      ? `(सभासद: ${la.member.memberCode})`
      : '';
    const legBadge = la.legacyAccountNumber ? ` (जुना: ${la.legacyAccountNumber})` : '';
    return {
      value: la.loanAccountID,
      loanRateID: la.loanRateID,
      label: `${la.loanAccountNo}${legBadge} - ${name} ${code}`.trim()
    };
  };

  useEffect(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const startYear = today.getMonth() >= 3 ? currentYear : currentYear - 1;
    const defaultFrom = `${startYear}-04-01`;
    const defaultTo = today.toISOString().split('T')[0];

    setFromDate(defaultFrom);
    setToDate(defaultTo);

    const loadInitialMasterData = async () => {
      try {
        const [ratesRes, accountsRes, fyRes] = await Promise.all([
          axios.get('/api/LoanRates').catch(() => ({ data: [] })),
          axios.get('/api/LoanAccounts').catch(() => ({ data: [] })),
          axios.get('/api/FinancialYears').catch(() => ({ data: [] }))
        ]);

        const ratesData: LoanRate[] = Array.isArray(ratesRes.data) ? ratesRes.data : [];
        const accData: LoanAccountItem[] = Array.isArray(accountsRes.data) ? accountsRes.data : [];
        const fyData: any[] = Array.isArray(fyRes.data) ? fyRes.data : [];

        setLoanRates(ratesData);
        setAllLoanAccounts(accData);

        let effectiveFrom = defaultFrom;
        const activeFy = fyData.find((f: any) => f.isActive && f.startDate);
        if (activeFy?.startDate) {
          effectiveFrom = activeFy.startDate.split('T')[0];
          setFromDate(effectiveFrom);
        }

        // URL Query Auto-Selection (Member 360 / Context Menu integration)
        const params = new URLSearchParams(window.location.search);
        const loanAccountIdStr = params.get('loanAccountId');
        const customerIdStr = params.get('customerId');
        const memberIdStr = params.get('memberId');

        if (loanAccountIdStr || customerIdStr || memberIdStr) {
          const accId = loanAccountIdStr ? parseInt(loanAccountIdStr, 10) : null;
          const cId = customerIdStr ? parseInt(customerIdStr, 10) : null;
          const mId = memberIdStr ? parseInt(memberIdStr, 10) : null;

          const matchedAcc = accData.find(
            (a) =>
              (accId && a.loanAccountID === accId) ||
              (cId && a.customerID === cId) ||
              (mId && a.memberID === mId)
          );

          if (matchedAcc) {
            const matchedRate = ratesData.find((r) => r.loanRateID === matchedAcc.loanRateID);
            if (matchedRate) {
              setSelectedLoanRate({
                value: matchedRate.loanRateID,
                label: matchedRate.shortName || matchedRate.loanType
              });
            }
            const accOpt = buildAccountOption(matchedAcc);
            setSelectedLoanAccount(accOpt);
            await fetchReportById(matchedAcc.loanAccountID, effectiveFrom, defaultTo);
          }
        }
      } catch (err) {
        console.error('Error initializing LoanLedgerReport:', err);
      }
    };

    loadInitialMasterData();
  }, []);

  const loanRateOptions = useMemo(
    () =>
      loanRates.map((lr) => ({
        value: lr.loanRateID,
        label: lr.shortName || lr.loanType
      })),
    [loanRates]
  );

  const loanAccountOptions = useMemo(() => {
    const filtered = selectedLoanRate?.value
      ? allLoanAccounts.filter((la) => la.loanRateID === Number(selectedLoanRate.value))
      : allLoanAccounts;
    return filtered.map(buildAccountOption);
  }, [allLoanAccounts, selectedLoanRate]);

  const handleLoanRateChange = (val: any) => {
    setSelectedLoanRate(val);
    if (val?.value && selectedLoanAccount?.loanRateID && selectedLoanAccount.loanRateID !== Number(val.value)) {
      setSelectedLoanAccount(null);
    }
  };

  const handleLoanAccountChange = (val: any) => {
    setSelectedLoanAccount(val);
    if (val?.loanRateID && (!selectedLoanRate || Number(selectedLoanRate.value) !== val.loanRateID)) {
      const matchedRate = loanRates.find((r) => r.loanRateID === val.loanRateID);
      if (matchedRate) {
        setSelectedLoanRate({
          value: matchedRate.loanRateID,
          label: matchedRate.shortName || matchedRate.loanType
        });
      }
    }
  };

  const fetchReportById = async (accountId: number, fDate: string, tDate: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get<LoanLedgerReportDto>('/api/Reports/LoanLedger', {
        params: {
          loanAccountId: accountId,
          fromDate: fDate,
          toDate: tDate
        }
      });
      setReportData(res.data);
    } catch (err: any) {
      console.error('Error fetching Loan Ledger report:', err);
      const msg =
        typeof err?.response?.data === 'string'
          ? err.response.data
          : 'कर्ज खतावणी अहवाल लोड करण्यास त्रुटी आली.';
      setError(msg);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchReport = async () => {
    if (!selectedLoanAccount?.value || !fromDate || !toDate) {
      alert('कृपया कर्ज खाते आणि वैध कालावधी (पासून - पर्यंत) निवडा.');
      return;
    }
    await fetchReportById(Number(selectedLoanAccount.value), fromDate, toDate);
  };

  // Computed Ledger Totals
  const totals = useMemo(() => {
    const txs = reportData?.transactions || [];
    const totalDisbursed = txs.reduce((s, t) => s + (t.loanDisbursement || 0), 0);
    const totalPrincipalCr = txs.reduce((s, t) => s + (t.principalDeposit || 0), 0);
    const totalInterest = txs.reduce((s, t) => s + (t.interest || 0), 0);
    const totalPenal = txs.reduce((s, t) => s + (t.penalInterest || 0), 0);
    const totalReceivable = txs.reduce((s, t) => s + (t.receivableInterest || 0), 0);
    const totalCharges = txs.reduce((s, t) => s + (t.recoveryCharges || 0), 0);
    const totalReceived = txs.reduce((s, t) => s + (t.total || 0), 0);
    const closingBalance =
      txs.length > 0 ? txs[txs.length - 1].balance : reportData?.principalBalance || 0;

    const collaterals = reportData?.depositCollaterals || [];
    const totalCollateralBalance = collaterals.reduce(
      (s, c) => s + (c.currentBalance > 0 ? c.currentBalance : c.depositAmount || 0),
      0
    );
    const totalCollateralLien = collaterals.reduce((s, c) => s + (c.lienAmount || 0), 0);

    return {
      totalDisbursed,
      totalPrincipalCr,
      totalInterest,
      totalPenal,
      totalReceivable,
      totalCharges,
      totalReceived,
      closingBalance,
      totalCollateralBalance,
      totalCollateralLien
    };
  }, [reportData]);

  const showDepositCollateralSection = Boolean(
    reportData &&
      ((reportData.depositCollaterals && reportData.depositCollaterals.length > 0) ||
        reportData.isDepositBackedLoan)
  );

  const handleDownloadPdf = () => {
    if (!reportData) return;
    const element = document.querySelector('.cbs-print-container') as HTMLElement | null;
    if (!element) {
      window.print();
      return;
    }

    const isLandscape =
      element.classList.contains('cbs-paper-preview-a4-landscape') ||
      element.classList.contains('cbs-paper-preview-legal-landscape');
    const isLegal = element.classList.contains('cbs-paper-preview-legal-landscape');

    const opt: any = {
      margin: [6, 6, 6, 6],
      filename: `Karj_Khatavani_${reportData.loanAccountNo}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: {
        unit: 'mm',
        format: isLegal ? 'legal' : 'a4',
        orientation: isLandscape ? 'landscape' : 'portrait'
      }
    };

    try {
      html2pdf()
        .set(opt)
        .from(element)
        .save()
        .catch(() => window.print());
    } catch {
      window.print();
    }
  };

  const handleExportExcel = () => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();
    const sheetRows: any[][] = [];

    // 1. Society & Report Header
    sheetRows.push([reportData.sansthaInfo?.sansthaName || 'सहकारी पतसंस्था मर्यादित']);
    sheetRows.push([
      `कर्ज खतावणी पत्रक (Loan Ledger Statement) | कालावधी: ${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`
    ]);
    sheetRows.push([]);

    // 2. Account Summary Rows
    sheetRows.push([
      'कर्ज खाते क्र.',
      reportData.loanAccountNo,
      'जुना कर्ज खाते क्र.',
      reportData.legacyAccountNumber || '-',
      'कर्ज प्रकार',
      reportData.loanType
    ]);
    sheetRows.push([
      'कर्जदाराचे नाव',
      reportData.memberName,
      'CIF क्र.',
      reportData.cifNo || '-',
      'शाखा',
      reportData.branchName || user?.branchName || 'मुख्य शाखा'
    ]);
    sheetRows.push([
      'मंजूर रक्कम (₹)',
      reportData.sanctionedAmount,
      'व्याजदर (%)',
      `${reportData.interestRate}%`,
      'हप्ता रक्कम (₹)',
      reportData.installmentAmount
    ]);
    sheetRows.push([
      'वाटप दिनांक',
      formatDisplayDate(reportData.disbursementDate),
      'मुदतपूर्ती दिनांक',
      formatDisplayDate(reportData.maturityDate),
      'स्थिती',
      formatLoanStatusMarathi(reportData.status)
    ]);
    sheetRows.push([
      'जामीनदार',
      reportData.guarantors && reportData.guarantors.length > 0
        ? reportData.guarantors.map((g, i) => `${i + 1}) ${g.name}`).join(', ')
        : 'नोंद नाही',
      'तारण तपशील',
      reportData.securityDetails || '-',
      'अखेर मुद्दल बाकी (₹)',
      totals.closingBalance
    ]);
    sheetRows.push([]);

    // 3. Pledged Deposit Collateral Details (if Deposit-Backed Loan)
    if (reportData.depositCollaterals && reportData.depositCollaterals.length > 0) {
      sheetRows.push(['तारण ठेवलेल्या ठेवींचा सविस्तर तपशील (Pledged Deposit Collateral Details)']);
      sheetRows.push([
        'अ.क्र.',
        'ठेव प्रकार',
        'ठेव योजना',
        'ठेव खाते क्र.',
        'जुना ठेव खाते क्र.',
        'ठेव खातेदाराचे नाव',
        'ठेव दि.',
        'मुदतपूर्ती दि.',
        'व्याजदर (%)',
        'ठेव / शिल्लक रक्कम (₹)',
        'तारण बोजा रक्कम (₹)',
        'बोजा स्थिती'
      ]);

      reportData.depositCollaterals.forEach((col, idx) => {
        sheetRows.push([
          idx + 1,
          col.depositTypeLabel,
          col.schemeName,
          col.depositAccountNo,
          col.legacyDepositAccountNo || '-',
          col.holderName || reportData.memberName,
          formatDisplayDate(col.openingDate),
          formatDisplayDate(col.maturityDate),
          col.interestRate,
          col.currentBalance > 0 ? col.currentBalance : col.depositAmount,
          col.lienAmount,
          formatLienStatusMarathi(col.lienStatus)
        ]);
      });

      sheetRows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'एकूण तारण ठेवी:',
        totals.totalCollateralBalance,
        totals.totalCollateralLien,
        ''
      ]);
      sheetRows.push([]);
    }

    // 4. Ledger Transactions Table
    sheetRows.push(['कर्ज खतावणी व्यवहार तपशील (Loan Ledger Transactions)']);
    sheetRows.push([
      'अ.क्र.',
      'दिनांक',
      'पावती / व्हाउचर क्र.',
      'तपशील',
      'वाटप रक्कम (Dr ₹)',
      'मुद्दल जमा (Cr ₹)',
      'व्याज (₹)',
      'दंड व्याज (₹)',
      'येणे व्याज (₹)',
      'वसुली खर्च (₹)',
      'एकूण जमा (₹)',
      'दिवस',
      'शिल्लक मुद्दल (Balance ₹)'
    ]);

    let txCounter = 0;
    reportData.transactions.forEach((t) => {
      const isOpeningRow =
        t.particulars === 'Opening Balance' || t.particulars.includes('मागील शिल्लक');
      if (!isOpeningRow) txCounter += 1;

      sheetRows.push([
        isOpeningRow ? '-' : txCounter,
        formatDisplayDate(t.date),
        t.receiptNo || '-',
        formatParticularsMarathi(t.particulars),
        t.loanDisbursement || 0,
        t.principalDeposit || 0,
        t.interest || 0,
        t.penalInterest || 0,
        t.receivableInterest || 0,
        t.recoveryCharges || 0,
        t.total || 0,
        t.days || 0,
        t.balance || 0
      ]);
    });

    sheetRows.push([
      '',
      formatDisplayDate(toDate),
      '',
      'एकूण व्यवहार / अखेर शिल्लक:',
      totals.totalDisbursed,
      totals.totalPrincipalCr,
      totals.totalInterest,
      totals.totalPenal,
      totals.totalReceivable,
      totals.totalCharges,
      totals.totalReceived,
      '',
      totals.closingBalance
    ]);

    const mainSheet = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, mainSheet, 'कर्ज_खतावणी');

    // Dedicated Collateral Sheet when deposit collaterals exist
    if (reportData.depositCollaterals && reportData.depositCollaterals.length > 0) {
      const collateralJson = reportData.depositCollaterals.map((col, idx) => ({
        'अ.क्र.': idx + 1,
        'कर्ज खाते क्र.': reportData.loanAccountNo,
        'जुना कर्ज खाते क्र.': reportData.legacyAccountNumber || '-',
        'ठेव प्रकार': col.depositTypeLabel,
        'ठेव योजना': col.schemeName,
        'ठेव खाते क्र.': col.depositAccountNo,
        'जुना ठेव खाते क्र.': col.legacyDepositAccountNo || '-',
        'ठेव खातेदाराचे नाव': col.holderName || reportData.memberName,
        'ठेव दिनांक': formatDisplayDate(col.openingDate),
        'मुदतपूर्ती दिनांक': formatDisplayDate(col.maturityDate),
        'व्याजदर (%)': col.interestRate,
        'ठेव / शिल्लक रक्कम (₹)': col.currentBalance > 0 ? col.currentBalance : col.depositAmount,
        'तारण बोजा रक्कम (₹)': col.lienAmount,
        'बोजा स्थिती': formatLienStatusMarathi(col.lienStatus)
      }));
      const colSheet = XLSX.utils.json_to_sheet(collateralJson);
      XLSX.utils.book_append_sheet(wb, colSheet, 'तारण_ठेवी');
    }

    XLSX.writeFile(wb, `Karj_Khatavani_${reportData.loanAccountNo}.xlsx`);
  };

  // Standard CBS Summary Banner (Matches CbsSampleReport.tsx style)
  const summaryBanner = reportData ? (
    <div className="space-y-1.5 text-xs">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 items-start">
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कर्ज खाते क्र.</span>
          <strong className="text-primary font-mono text-[11.5px]">
            {reportData.loanAccountNo}
            {reportData.legacyAccountNumber && (
              <span className="text-slate-700 font-semibold ml-1">
                (जुना: {reportData.legacyAccountNumber})
              </span>
            )}
          </strong>
        </div>

        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कर्जदाराचे नाव व CIF</span>
          <strong className="text-slate-900 text-[11px] block leading-tight">
            {reportData.memberName}{' '}
            {reportData.cifNo && (
              <span className="text-slate-600 font-mono font-normal text-[10px]">
                ({reportData.cifNo}
                {reportData.legacyCustomerNo ? ` / जुना: ${reportData.legacyCustomerNo}` : ''})
              </span>
            )}
          </strong>
        </div>

        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कर्ज प्रकार / योजना</span>
          <strong className="text-slate-900 text-[11px] block leading-tight">
            {reportData.loanType}
            {showDepositCollateralSection && (
              <span className="ml-1 text-[9.5px] font-bold text-primary">
                [ठेव तारण]
              </span>
            )}
          </strong>
        </div>

        <div className="sm:text-right">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सध्याची मुद्दल बाकी</span>
          <strong className="text-emerald-700 font-mono text-xs">
            ₹ {fmtCurrency(totals.closingBalance)}
          </strong>
        </div>

        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">मंजूर रक्कम व व्याजदर</span>
          <strong className="text-slate-900 font-mono text-[11px]">
            ₹ {fmtCurrency(reportData.sanctionedAmount)}{' '}
            <span className="text-slate-600">@ {reportData.interestRate}%</span>
          </strong>
        </div>

        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">वाटप दि. ते मुदतपूर्ती दि.</span>
          <strong className="text-slate-900 font-mono text-[10.5px]">
            {formatDisplayDate(reportData.disbursementDate)} ते {formatDisplayDate(reportData.maturityDate)}{' '}
            <span className="font-sans font-normal text-slate-600">({reportData.durationMonths} म.)</span>
          </strong>
        </div>

        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">हप्ता रक्कम व स्थिती</span>
          <strong className="text-slate-900 font-mono text-[11px]">
            ₹ {fmtCurrency(reportData.installmentAmount)}{' '}
            <span className="font-sans text-[10px] text-slate-600">
              ({formatLoanStatusMarathi(reportData.status)})
            </span>
          </strong>
        </div>

        <div className="sm:text-right">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">थकीत हप्ते / थकबाकी व्याज</span>
          <strong
            className={`font-mono text-[11px] ${
              reportData.overdueInstallmentCount > 0 || reportData.overdueAmount > 0
                ? 'text-red-700'
                : 'text-slate-700'
            }`}
          >
            {reportData.overdueInstallmentCount} हप्ते / ₹ {fmtCurrency(reportData.overdueAmount)}
          </strong>
        </div>
      </div>

      {/* Compact Guarantor, KYC & Security Row */}
      <div className="pt-1 border-t border-slate-300 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-[10px] text-slate-800">
        <div>
          <span className="font-bold text-slate-600">जामीनदार: </span>
          {reportData.guarantors && reportData.guarantors.length > 0 ? (
            <span className="font-semibold text-slate-900">
              {reportData.guarantors.map((g, idx) => `${idx + 1}) ${g.name}`).join('   |   ')}
            </span>
          ) : (
            <span className="italic text-slate-500">नोंद नाही</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3">
          {reportData.securityDetails && (
            <span>
              <strong className="text-slate-600">तारण:</strong>{' '}
              <span className="font-semibold text-slate-900">{reportData.securityDetails}</span>
            </span>
          )}
          {(reportData.mobileNo || reportData.aadhaarNo || reportData.panNo) && (
            <span className="font-mono text-slate-700">
              {[
                reportData.mobileNo ? `मो: ${reportData.mobileNo}` : '',
                reportData.aadhaarNo ? `आधार: ${reportData.aadhaarNo}` : '',
                reportData.panNo ? `PAN: ${reportData.panNo}` : ''
              ]
                .filter(Boolean)
                .join(' | ')}
            </span>
          )}
        </div>
      </div>
    </div>
  ) : undefined;

  // Toolbar Filter Controls inside CbsReportLayout
  const filterControls = (
    <>
      {/* Loan Type Filter */}
      <div className="w-36 sm:w-44">
        <Select
          options={loanRateOptions}
          value={selectedLoanRate}
          onChange={handleLoanRateChange}
          placeholder="-- कर्ज प्रकार --"
          isClearable
          className="text-[11px]"
          menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
          styles={compactSelectStyles}
        />
      </div>

      {/* Loan Account Filter (with Legacy Account No search) */}
      <div className="w-52 sm:w-64">
        <Select
          options={loanAccountOptions}
          value={selectedLoanAccount}
          onChange={handleLoanAccountChange}
          placeholder="खाते क्र. / जुना क्र. / नाव शोधा..."
          isClearable
          className="text-[11px]"
          menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
          styles={compactSelectStyles}
        />
      </div>

      {/* From Date */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28"
        />
      </div>

      {/* To Date */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">पर्यंत:</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28"
        />
      </div>

      {/* View Button */}
      <button
        type="button"
        onClick={handleFetchReport}
        disabled={loading}
        className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-xs text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
        <span>पहा</span>
      </button>

      {/* Installment Schedule Toggle */}
      <label
        className="flex items-center gap-1 text-[10.5px] font-semibold text-slate-700 cursor-pointer bg-slate-50 border border-slate-200 px-1.5 h-6 rounded-xs"
        title="हप्ता परतफेड वेळापत्रक अहवालात दाखवा"
      >
        <input
          type="checkbox"
          checked={showInstallmentChart}
          onChange={(e) => setShowInstallmentChart(e.target.checked)}
          className="w-3 h-3 text-primary rounded border-gray-300 cursor-pointer"
        />
        <span>वेळापत्रक</span>
      </label>

      {/* Signature Tier Selector (Matches CbsSampleReport.tsx) */}
      <select
        value={signatureTier}
        onChange={(e) => setSignatureTier(e.target.value as '3-tier' | '4-tier')}
        className="h-6 border border-slate-300 rounded-xs px-1 text-[10.5px] bg-white text-slate-800 font-medium"
        title="स्वाक्षरी स्तर निवडा"
      >
        <option value="3-tier">३-स्तरीय स्वाक्षरी</option>
        <option value="4-tier">४-स्तरीय स्वाक्षरी</option>
      </select>
    </>
  );

  let runningSrNo = 0;

  return (
    <CbsReportLayout
      defaultPaperSize="a4-portrait"
      allowPaperSizeToggle={true}
      reportTitle="कर्ज खतावणी पत्रक"
      reportSubtitle="Loan Ledger Statement"
      periodText={`${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`}
      branchName={reportData?.branchName || user?.branchName || 'मुख्य शाखा'}
      sansthaInfo={reportData?.sansthaInfo || null}
      summaryBanner={summaryBanner}
      signatureTier={signatureTier}
      signatureTitles={
        signatureTier === '4-tier'
          ? [
              { title: 'लिपिक / खतावणी लेखक', subtitle: '(Clerk / Maker)' },
              { title: 'लेखापाल / कर्ज तपासनीस', subtitle: '(Accountant / Checker)' },
              { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' },
              { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Board of Directors)' }
            ]
          : [
              { title: 'लिपिक / खतावणी लेखक', subtitle: '(Clerk / Maker)' },
              { title: 'लेखापाल / कर्ज तपासनीस', subtitle: '(Accountant / Checker)' },
              { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' }
            ]
      }
      onExportExcel={handleExportExcel}
      onDownloadPdf={handleDownloadPdf}
      extraToolbarControls={filterControls}
      isLoading={loading}
      hasData={Boolean(reportData)}
      preparedBy={user ? `${user.username} (${user.role})` : 'Admin'}
      emptyState={
        <div className="bg-white p-10 text-center text-slate-600 rounded-xs border border-slate-200 shadow-xs max-w-4xl mx-auto">
          {error ? (
            <p className="font-bold text-xs text-red-700">{error}</p>
          ) : (
            <>
              <Landmark size={30} className="mx-auto mb-2 text-primary/40" />
              <p className="font-semibold text-xs text-slate-700">
                कृपया वरील यादीतून कर्ज खाते (नवीन किंवा जुना खाते क्र.) व कालावधी निवडून &quot;पहा&quot; बटणावर क्लिक करा.
              </p>
            </>
          )}
        </div>
      }
    >
      {reportData && (
        <div className="space-y-3">
          {/* 1. PLEDGED DEPOSIT COLLATERAL TABLE (Shown for Deposit-Backed Loans / Pledged Deposits) */}
          {showDepositCollateralSection && (
            <div>
              <div className="bg-slate-100 border border-slate-900 border-b-0 px-2.5 py-1 flex items-center justify-between text-[11px] font-bold text-slate-950">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-primary shrink-0" />
                  <span>तारण ठेवलेल्या ठेवींचा सविस्तर तपशील (Pledged Deposit Collateral Details)</span>
                </div>
                <span className="font-mono text-[10px] text-slate-700">
                  एकूण तारण ठेवी: {reportData.depositCollaterals?.length || 0}
                </span>
              </div>

              <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                    <th className="border border-slate-900 py-1 px-1 w-[4%] text-center">अ.क्र.</th>
                    <th className="border border-slate-900 py-1 px-1.5 w-[15%] text-left">ठेव प्रकार व योजना</th>
                    <th className="border border-slate-900 py-1 px-1.5 w-[11%] text-center">ठेव खाते क्र.</th>
                    <th className="border border-slate-900 py-1 px-1.5 w-[11%] text-center">जुना ठेव खाते क्र.</th>
                    <th className="border border-slate-900 py-1 px-1.5 w-[16%] text-left">ठेव खातेदाराचे नाव</th>
                    <th className="border border-slate-900 py-1 px-1 w-[8%] text-center">ठेव दि.</th>
                    <th className="border border-slate-900 py-1 px-1 w-[8%] text-center">मुदतपूर्ती दि.</th>
                    <th className="border border-slate-900 py-1 px-1 w-[5%] text-center">व्याज %</th>
                    <th className="border border-slate-900 py-1 px-1.5 w-[9%] text-right">ठेव / शिल्लक (₹)</th>
                    <th className="border border-slate-900 py-1 px-1.5 w-[8%] text-right">तारण बोजा (₹)</th>
                    <th className="border border-slate-900 py-1 px-1 w-[5%] text-center">स्थिती</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.depositCollaterals && reportData.depositCollaterals.length > 0 ? (
                    reportData.depositCollaterals.map((col, idx) => {
                      const dispBalance = col.currentBalance > 0 ? col.currentBalance : col.depositAmount;
                      return (
                        <tr key={`${col.collateralType}-${col.depositAccountID}-${idx}`} className="hover:bg-slate-50 text-slate-900 text-[10.5px]">
                          <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-900 py-1 px-1.5 text-left">
                            <span className="font-bold text-slate-950">{col.depositTypeLabel}</span>
                            {col.schemeName && col.schemeName !== col.depositTypeLabel && (
                              <span className="block text-[9.5px] text-slate-600 leading-tight">
                                {col.schemeName}
                              </span>
                            )}
                          </td>
                          <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-slate-950">
                            {col.depositAccountNo || '-'}
                          </td>
                          <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-primary bg-slate-50/70">
                            {col.legacyDepositAccountNo || '-'}
                          </td>
                          <td className="border border-slate-900 py-1 px-1.5 text-left font-medium">
                            {col.holderName || reportData.memberName}
                          </td>
                          <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                            {formatDisplayDate(col.openingDate)}
                          </td>
                          <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                            {formatDisplayDate(col.maturityDate)}
                          </td>
                          <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                            {col.interestRate > 0 ? `${col.interestRate}%` : '-'}
                          </td>
                          <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell font-semibold">
                            {fmtCurrency(dispBalance)}
                          </td>
                          <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell cbs-amt-bal font-bold text-slate-950">
                            {fmtCurrency(col.lienAmount)}
                          </td>
                          <td className="border border-slate-900 py-1 px-1 text-center text-[9.5px] font-semibold">
                            {formatLienStatusMarathi(col.lienStatus)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="border border-slate-900 py-2 px-3 text-center text-[10.5px] text-slate-600 italic">
                        हे खाते ठेव तारण कर्ज प्रकारातील आहे; स्वतंत्र तारण ठेव खाते लिंक केलेले नाही
                        {reportData.securityDetails ? ` (नोंदवलेला तारण तपशील: ${reportData.securityDetails})` : ''}.
                      </td>
                    </tr>
                  )}
                </tbody>
                {reportData.depositCollaterals && reportData.depositCollaterals.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-[11px]">
                      <td colSpan={8} className="border border-slate-900 py-1 px-2.5 text-right uppercase tracking-wider">
                        एकूण तारण ठेव रक्कम व तारण बोजा:
                      </td>
                      <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell font-bold">
                        ₹ {fmtCurrency(totals.totalCollateralBalance)}
                      </td>
                      <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell cbs-amt-bal font-black text-primary bg-primary/10">
                        ₹ {fmtCurrency(totals.totalCollateralLien)}
                      </td>
                      <td className="border border-slate-900 py-1 px-1"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* 2. STANDARD CBS LOAN KHATAVANI TRANSACTIONS TABLE (Matches CbsSampleReport.tsx) */}
          <div>
            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                  <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[8.5%] text-center">दिनांक</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-center">पावती क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[18.5%] text-left">तपशील</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[9%] text-right">वाटप (Dr ₹)</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[9%] text-right">मुद्दल जमा (Cr ₹)</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[7.5%] text-right">व्याज</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[6.5%] text-right">दंड व्याज</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[6.5%] text-right">येणे व्याज</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[5.5%] text-right">खर्च</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-right">एकूण जमा</th>
                  <th className="border border-slate-900 py-1.5 px-1 w-[3.5%] text-center">दिवस</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[9.5%] text-right font-extrabold">
                    शिल्लक (Balance ₹)
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.transactions.length > 0 ? (
                  reportData.transactions.map((t, idx) => {
                    const isOpeningRow =
                      t.particulars === 'Opening Balance' ||
                      t.particulars.includes('मागील शिल्लक');
                    if (!isOpeningRow) {
                      runningSrNo += 1;
                    }

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50 text-slate-900 text-[11px] ${
                          isOpeningRow ? 'bg-slate-50/70 font-bold' : ''
                        }`}
                      >
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                          {isOpeningRow ? '-' : runningSrNo}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center font-mono">
                          {formatDisplayDate(t.date)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-slate-900">
                          {t.receiptNo || '-'}
                        </td>
                        <td
                          className={`border border-slate-900 py-1 px-2 text-left ${
                            isOpeningRow ? 'italic text-primary' : ''
                          }`}
                        >
                          {formatParticularsMarathi(t.particulars)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell cbs-amt-dr">
                          {fmtCellAmount(t.loanDisbursement)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell cbs-amt-cr">
                          {fmtCellAmount(t.principalDeposit)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell">
                          {fmtCellAmount(t.interest)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell">
                          {fmtCellAmount(t.penalInterest)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell">
                          {fmtCellAmount(t.receivableInterest)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell">
                          {fmtCellAmount(t.recoveryCharges)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell font-semibold">
                          {fmtCellAmount(t.total)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                          {t.days > 0 ? t.days : '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell cbs-amt-bal font-bold text-slate-950">
                          {fmtCurrency(t.balance)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={13}
                      className="border border-slate-900 py-6 text-center text-slate-500 font-semibold"
                    >
                      निवडलेल्या कालावधीत कोणतेही कर्ज व्यवहार आढळले नाहीत.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td
                    colSpan={4}
                    className="border border-slate-900 py-1.5 px-2.5 text-right uppercase tracking-wider"
                  >
                    एकूण व्यवहार / अखेर शिल्लक:
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell cbs-amt-dr font-bold">
                    ₹ {fmtCurrency(totals.totalDisbursed)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell cbs-amt-cr font-bold">
                    ₹ {fmtCurrency(totals.totalPrincipalCr)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell font-bold">
                    {fmtCellAmount(totals.totalInterest)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell font-bold">
                    {fmtCellAmount(totals.totalPenal)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell font-bold">
                    {fmtCellAmount(totals.totalReceivable)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell font-bold">
                    {fmtCellAmount(totals.totalCharges)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell font-bold">
                    ₹ {fmtCurrency(totals.totalReceived)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1"></td>
                  <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell cbs-amt-bal font-black text-primary bg-primary/10">
                    ₹ {fmtCurrency(totals.closingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 3. OPTIONAL CBS INSTALLMENT REPAYMENT SCHEDULE TABLE */}
          {showInstallmentChart &&
            reportData.installmentChart &&
            reportData.installmentChart.length > 0 && (
              <div>
                <div className="bg-slate-100 border border-slate-900 border-b-0 px-2.5 py-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-950">
                  <Calendar size={13} className="text-primary shrink-0" />
                  <span>कर्ज हप्ता परतफेड वेळापत्रक (Loan Installment Schedule)</span>
                </div>
                <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                      <th className="border border-slate-900 py-1 px-2 w-[12%] text-center">हप्ता क्र.</th>
                      <th className="border border-slate-900 py-1 px-2 w-[22%] text-center">देय दिनांक</th>
                      <th className="border border-slate-900 py-1 px-2 w-[22%] text-right">मुद्दल रक्कम (₹)</th>
                      <th className="border border-slate-900 py-1 px-2 w-[22%] text-right">व्याज रक्कम (₹)</th>
                      <th className="border border-slate-900 py-1 px-2 w-[22%] text-right font-extrabold">
                        एकूण हप्ता (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.installmentChart.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50 text-slate-900 text-[10.5px]">
                        <td className="border border-slate-900 py-1 px-2 text-center font-mono font-semibold">
                          {h.no || i + 1}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                          {formatDisplayDate(h.date)}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 cbs-num-cell">
                          {fmtCurrency(h.principal || 0)}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 cbs-num-cell">
                          {fmtCurrency(h.interest || 0)}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 cbs-num-cell font-bold">
                          {fmtCurrency(h.total || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-[11px]">
                      <td colSpan={2} className="border border-slate-900 py-1 px-3 text-right uppercase">
                        एकूण वेळापत्रक बेरीज:
                      </td>
                      <td className="border border-slate-900 py-1 px-2 cbs-num-cell font-bold">
                        ₹{' '}
                        {fmtCurrency(
                          reportData.installmentChart.reduce((acc, curr) => acc + (curr.principal || 0), 0)
                        )}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 cbs-num-cell font-bold">
                        ₹{' '}
                        {fmtCurrency(
                          reportData.installmentChart.reduce((acc, curr) => acc + (curr.interest || 0), 0)
                        )}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal font-black text-primary bg-primary/10">
                        ₹{' '}
                        {fmtCurrency(
                          reportData.installmentChart.reduce((acc, curr) => acc + (curr.total || 0), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
        </div>
      )}
    </CbsReportLayout>
  );
};

export default LoanLedgerReport;
