import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Select, { components } from 'react-select';
import FdAccrualPosting from './FdAccrualPosting';
import CbsReportLayout, { formatDisplayDate, CbsPaperSize, CbsSignatureTier } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  Building2,
  Calendar,
  Users,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, isHeadOfficeUser } from '../utils/branchAccess';

export const format14DigitDisplay = (num?: string) => {
  if (!num) return '-';
  const clean = num.replace(/\D/g, '');
  if (clean.length === 14) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 13)}-${clean.slice(13)}`;
  }
  return num;
};

interface FdAccountReportRow {
  fdAccountID: number;
  branchID?: number;
  branchName: string;
  customerID?: number;
  cifNo?: string;
  customerName?: string;
  memberCode: string;
  memberName: string;
  memberID?: number;
  accountNo: string;
  legacyAccountNumber?: string;
  fdSchemeID?: number;
  schemeCode?: string;
  schemeName: string;
  openingDate: string;
  durationType?: string;
  durationValue?: number;
  durationInDays?: number;
  depositAmount: number;
  interestRate: number;
  maturityDate: string;
  maturityAmount?: number;
  legacyAccruedInt?: number;
  postedInterest?: number;
  isInterestCapitalized?: boolean;
  totalOutstandingWithInterest?: number;
  lastInterestPostingDate?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  remarks?: string;
  status: string;
  voucherNo?: string;
  passingStatus?: string;
}

interface FdVoucherPassingRow {
  voucherID: number;
  voucherNo: string;
  voucherDate: string;
  branchName: string;
  accountNo: string;
  customerName: string;
  customerCode: string;
  transactionType: string;
  typeBadge: string;
  voucherType: string;
  totalAmount: number;
  status: string;
  scrollNo?: number;
  narration: string;
  createdBy: string;
  approvedBy: string;
  approvedOn: string;
}

interface FdDeletedEntryRow {
  logID: number;
  deletedDate: string;
  accountNo: string;
  voucherNo: string;
  deleteType: string;
  typeBadge: string;
  amount: number;
  deletedBy: string;
  rollbackInfo: string;
  reasonOrDetails: string;
}

interface FdLedgerTxItem {
  fdTransactionID: number;
  fdAccountID?: number;
  accountNo?: string;
  legacyAccountNumber?: string;
  customerName?: string;
  cifNo?: string;
  transactionDate: string;
  transactionType: string;
  debitCredit: string;
  debit: number;
  credit: number;
  balance: number;
  amount: number;
  voucherNo: string;
  passingStatus?: string;
  narration: string;
}

interface FdLedgerAccountItem {
  fdAccountID: number;
  fdSchemeID?: number;
  schemeCode?: string;
  customerID?: number;
  customerName?: string;
  cifNo?: string;
  legacyCustomerNo?: string;
  accountNo: string;
  legacyAccountNumber?: string;
  openingDate: string;
  maturityDate: string;
  depositAmount: number;
  interestRate: number;
  maturityAmount: number;
  status: string;
  paymentMode: string;
  nomineeName: string;
  nomineeRelation: string;
  durationType?: string;
  durationValue?: number;
  durationInDays?: number;
  isLienMarked?: boolean;
  lienLoanAccountNo?: string;
  lienAmount?: number;
  remarks: string;
  schemeName: string;
  durationMonths: number;
  totalAccruedInterest: number;
  openingBalance?: number;
  periodTotalDebit?: number;
  periodTotalCredit?: number;
  closingBalance?: number;
  transactions: FdLedgerTxItem[];
}

interface FdSchemeLedgerGroup {
  fdSchemeID: number;
  schemeName: string;
  schemeCode?: string;
  accountsCount: number;
  totalDepositAmount: number;
  totalMaturityAmount: number;
  openingBalance: number;
  periodTotalDebit: number;
  periodTotalCredit: number;
  closingBalance: number;
  accounts: FdLedgerAccountItem[];
  consolidated: {
    accountsCount: number;
    totalDepositAmount: number;
    totalMaturityAmount: number;
    openingBalance: number;
    periodTotalDebit: number;
    periodTotalCredit: number;
    closingBalance: number;
    transactions: FdLedgerTxItem[];
  };
}

interface FdLedgerCustomerOption {
  customerID: number;
  cifNo: string;
  legacyCustomerNo?: string;
  customerName: string;
  customerNameEng?: string;
  nickName?: string;
  mobileNo: string;
  fdCount: number;
  totalDepositAmount: number;
  accountNumbers: string[];
  schemeNames: string[];
}

interface FdLedgerAccountOption {
  fdAccountID: number;
  customerID: number;
  fdSchemeID: number;
  schemeName: string;
  accountNo: string;
  legacyAccountNumber?: string;
  receiptNo?: string;
  depositAmount: number;
  maturityAmount: number;
  status: string;
  openingDate: string;
  customerName: string;
  customerNameEng?: string;
  nickName?: string;
  cifNo: string;
  legacyCustomerNo?: string;
  mobileNo: string;
}

const FD_LEDGER_MAX_OPTIONS = 200;

const FdLedgerCappedMenuList = (props: any) => {
  const { children } = props;
  const inputValue = props.selectProps?.inputValue || '';
  const [visibleCount, setVisibleCount] = useState(FD_LEDGER_MAX_OPTIONS);

  useEffect(() => {
    setVisibleCount(FD_LEDGER_MAX_OPTIONS);
  }, [inputValue]);

  const totalCount = Array.isArray(children) ? children.length : 0;
  const isCapped = Array.isArray(children) && totalCount > visibleCount;
  const cappedChildren = isCapped ? children.slice(0, visibleCount) : children;

  return (
    <components.MenuList {...props}>
      {cappedChildren}
      {isCapped && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="sticky bottom-0 bg-amber-50 border-t border-amber-200 px-2 py-1 text-[10px] text-amber-900 flex flex-wrap items-center justify-between gap-1.5 z-10"
        >
          <span className="font-semibold">
            एकूण <b>{totalCount}</b> पैकी पहिल्या <b>{visibleCount}</b> नोंदी
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setVisibleCount((prev) => prev + 200);
              }}
              className="px-1.5 py-0.5 bg-primary text-white rounded text-[10px] font-bold cursor-pointer"
            >
              +२०० दाखवा
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setVisibleCount(totalCount);
              }}
              className="px-1.5 py-0.5 bg-white text-slate-700 border border-slate-300 rounded text-[10px] font-bold cursor-pointer"
            >
              सर्व ({totalCount})
            </button>
          </div>
        </div>
      )}
    </components.MenuList>
  );
};

const FD_LEDGER_SELECT_COMPONENTS = { MenuList: FdLedgerCappedMenuList };

interface CustomerLedgerData {
  customerID: number;
  cifNo: string;
  legacyCustomerNo?: string;
  customerName: string;
  mobileNo: string;
  address: string;
  branchName: string;
  isAllCustomers?: boolean;
  selectedSchemeId?: number;
  selectedSchemeName?: string;
  totalFDAccountsCount: number;
  totalPrincipalInvested: number;
  totalMaturityValue: number;
  totalOpeningBalance?: number;
  totalPeriodDebit?: number;
  totalPeriodCredit?: number;
  totalClosingBalance?: number;
  fromDate?: string;
  toDate?: string;
  accounts: FdLedgerAccountItem[];
  schemeGroups?: FdSchemeLedgerGroup[];
}

interface FdCustomerSummaryAccountItem {
  fdAccountID: number;
  accountNo: string;
  legacyAccountNumber?: string;
  depositAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  schemeName: string;
}

interface FdCustomerSummaryRow {
  srNo: number;
  customerID: number;
  cifNo: string;
  accountNo: string;
  customerName: string;
  mobileNo: string;
  depositAmount: number;
  maturityAmount: number;
  fdCount: number;
  accounts: FdCustomerSummaryAccountItem[];
}

interface FdReportsProps {
  onNavigate?: (tab: string, params?: any) => void;
  onBack?: () => void;
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function FdReports({ onNavigate }: FdReportsProps) {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);

  const [reportType, setReportType] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('reportType') || 'Register';
  });

  const [paperSize, setPaperSize] = useState<CbsPaperSize>(() => {
    return reportType === 'MemberLedger' || reportType === 'CustomerSummary' ? 'a4-portrait' : 'a4-landscape';
  });
  const [signatureTier, setSignatureTier] = useState<CbsSignatureTier>('3-tier');

  const [branches, setBranches] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number>(0);
  const [selectedCustomerID, setSelectedCustomerID] = useState<number>(0);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);
  const initialBranchId = typeof effectiveBranch === 'number' && effectiveBranch > 0
    ? effectiveBranch
    : (isHOUser ? 0 : (user?.branchID || 1));
  const [branchID, setBranchID] = useState<number>(initialBranchId);

  const [data, setData] = useState<FdAccountReportRow[]>([]);
  const [voucherPassingData, setVoucherPassingData] = useState<FdVoucherPassingRow[]>([]);
  const [deletedEntriesData, setDeletedEntriesData] = useState<FdDeletedEntryRow[]>([]);
  const getLocalTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const initialCbsDateStr = user?.businessDate ? user.businessDate.split('T')[0] : getLocalTodayStr();
  const [hasSyncedCbsDate, setHasSyncedCbsDate] = useState<boolean>(Boolean(user?.businessDate));

  const [fromDate, setFromDate] = useState<string>(() => `${initialCbsDateStr.slice(0, 7)}-01`);
  const [toDate, setToDate] = useState<string>(() => initialCbsDateStr);
  const [voucherPassingStatus, setVoucherPassingStatus] = useState<string>('ALL');

  const [customerSummaryData, setCustomerSummaryData] = useState<FdCustomerSummaryRow[]>([]);
  const [asOfDate, setAsOfDate] = useState<string>(() => initialCbsDateStr);

  useEffect(() => {
    if (user?.businessDate && !hasSyncedCbsDate) {
      const bDate = user.businessDate.split('T')[0];
      setFromDate(`${bDate.slice(0, 7)}-01`);
      setToDate(bDate);
      setAsOfDate(bDate);
      setHasSyncedCbsDate(true);
    }
  }, [user?.businessDate, hasSyncedCbsDate]);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<number[]>([]);
  const [summaryViewMode, setSummaryViewMode] = useState<'DualColumn' | 'Detailed'>('DualColumn');

  const [customerLedger, setCustomerLedger] = useState<CustomerLedgerData | null>(null);
  const [selectedLedgerFdAccountId, setSelectedLedgerFdAccountId] = useState<number>(0);
  const [savedSingleFdAccountId, setSavedSingleFdAccountId] = useState<number>(0);
  const [ledgerViewMode, setLedgerViewMode] = useState<'single' | 'consolidated'>('single');
  const ledgerRequestSeqRef = useRef<number>(0);
  const [ledgerCustomerOptions, setLedgerCustomerOptions] = useState<FdLedgerCustomerOption[]>([]);
  const [ledgerAccountOptions, setLedgerAccountOptions] = useState<FdLedgerAccountOption[]>([]);
  const [ledgerOptionsError, setLedgerOptionsError] = useState<string>('');
  const [ledgerSearchInput, setLedgerSearchInput] = useState<string>('');
  const [ledgerTotalAvailableAccounts, setLedgerTotalAvailableAccounts] = useState<number>(0);
  const [ledgerTotalAvailableDeposit, setLedgerTotalAvailableDeposit] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleReportTypeChange = (nextType: string) => {
    setReportType(nextType);
    if (nextType === 'MemberLedger' || nextType === 'CustomerSummary') {
      setPaperSize('a4-portrait');
    } else {
      setPaperSize('a4-landscape');
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('reportType', nextType);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      // ignore in environments without full window.location
    }
  };

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const rt = params.get('reportType');
      if (rt && rt !== reportType) {
        setReportType(rt);
        if (rt === 'MemberLedger' || rt === 'CustomerSummary') {
          setPaperSize('a4-portrait');
        } else {
          setPaperSize('a4-landscape');
        }
      }
    };
    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  useEffect(() => {
    fetchBranches();
    fetchSansthaDetail();
    fetchSchemes();
  }, []);

  const fetchSansthaDetail = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSansthaDetail(res.data[0]);
      } else if (res.data && !Array.isArray(res.data)) {
        setSansthaDetail(res.data);
      }
    } catch (err) {
      console.error('Error fetching sanstha detail', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      const res = await axios.get('/api/FdSchemes');
      setSchemes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching schemes', err);
    }
  };

  const fetchLedgerCustomerOptions = async (bId: number, schemeId: number) => {
    setLedgerOptionsError('');
    try {
      const res = await axios.get('/api/Reports/fd-ledger-options', {
        params: {
          branchID: bId > 0 ? bId : undefined,
          fdSchemeID: schemeId > 0 ? schemeId : undefined
        }
      });
      const d = res.data;
      const list: FdLedgerCustomerOption[] = Array.isArray(d?.customers) ? d.customers : [];
      const accList: FdLedgerAccountOption[] = Array.isArray(d?.accounts) ? d.accounts : [];
      setLedgerCustomerOptions(list);
      setLedgerAccountOptions(accList);
      setLedgerTotalAvailableAccounts(Number(d?.totalAccountsCount ?? accList.length));
      setLedgerTotalAvailableDeposit(Number(d?.totalDepositAmount ?? 0));

      // If currently selected specific customer does not hold any FD under this scheme, clear selection
      if (selectedCustomerID > 0 && !list.some((c) => c.customerID === selectedCustomerID)) {
        setSelectedCustomerID(0);
        setSelectedLedgerFdAccountId(0);
        setSavedSingleFdAccountId(0);
        setCustomerLedger(null);
      }
    } catch (err: any) {
      console.error('Error fetching FD ledger options', err);
      const status = err?.response?.status;
      const msg =
        status === 404
          ? 'बॅकएंड API सर्व्हर (Port 5242) जुन्या आवृत्तीवर चालू आहे — नवीन /api/Reports/fd-ledger-options साठी API सर्व्हर रीस्टार्ट आवश्यक आहे.'
          : err?.response?.data?.message || 'ठेव प्रकारानुसार खातेदार यादी लोड करताना त्रुटी आली.';
      setLedgerOptionsError(msg);
      setLedgerCustomerOptions([]);
      setLedgerAccountOptions([]);
      setLedgerTotalAvailableAccounts(0);
      setLedgerTotalAvailableDeposit(0);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  useEffect(() => {
    if (reportType === 'MemberLedger') {
      fetchLedgerCustomerOptions(branchID, selectedSchemeId);
    }
  }, [reportType, branchID, selectedSchemeId]);

  useEffect(() => {
    if (reportType === 'MemberLedger') {
      if (selectedCustomerID === -1 || selectedCustomerID > 0) {
        fetchCustomerLedgerData(selectedCustomerID);
      } else {
        setCustomerLedger(null);
      }
    } else if (reportType !== 'AccrualProvision') {
      fetchReportData();
    }
  }, [reportType, branchID, selectedSchemeId, selectedCustomerID, fromDate, toDate, asOfDate, voucherPassingStatus]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (reportType === 'CustomerSummary') {
        const res = await axios.get('/api/Reports/fd-customer-summary', {
          params: {
            branchID: branchID > 0 ? branchID : undefined,
            asOfDate: asOfDate || undefined
          }
        });
        setCustomerSummaryData(res.data?.data || []);
      } else if (reportType === 'VoucherPassing') {
        const res = await axios.get('/api/Reports/fd-voucher-passing', {
          params: {
            branchId: branchID > 0 ? branchID : undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            status: voucherPassingStatus !== 'ALL' ? voucherPassingStatus : undefined
          }
        });
        setVoucherPassingData(res.data || []);
      } else if (reportType === 'DeletedEntries') {
        const res = await axios.get('/api/Reports/fd-deleted-entries', {
          params: {
            branchId: branchID > 0 ? branchID : undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined
          }
        });
        setDeletedEntriesData(res.data || []);
      } else {
        let endpoint = '/api/Reports/fd-register';
        if (reportType === 'Outstanding') endpoint = '/api/Reports/fd-outstanding';
        if (reportType === 'MaturityDue') endpoint = '/api/Reports/fd-maturity-due';
        if (reportType === 'MigratedFD') endpoint = '/api/Reports/fd-migrated';

        const res = await axios.get(endpoint, {
          params: { 
            branchID: branchID > 0 ? branchID : undefined,
            fdSchemeID: selectedSchemeId > 0 ? selectedSchemeId : undefined,
            fromDate: (reportType === 'MaturityDue' || reportType === 'Register') ? fromDate : undefined,
            toDate: (reportType === 'MaturityDue' || reportType === 'Register') ? toDate : undefined
          }
        });
        setData(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching FD report data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerLedgerData = async (customerId: number) => {
    const reqSeq = ++ledgerRequestSeqRef.current;
    setLoading(true);
    try {
      const isAllMode = customerId === -1;
      const res = await axios.get('/api/Reports/fd-ledger-statement', {
        params: {
          branchID: branchID > 0 ? branchID : undefined,
          fdSchemeID: selectedSchemeId > 0 ? selectedSchemeId : undefined,
          customerID: !isAllMode && customerId > 0 ? customerId : undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined
        }
      });
      if (reqSeq !== ledgerRequestSeqRef.current) return;
      const d = res.data;
      if (d) {
        const accounts: FdLedgerAccountItem[] = Array.isArray(d.accounts) ? d.accounts : [];
        const schemeGroups: FdSchemeLedgerGroup[] = Array.isArray(d.schemeGroups) ? d.schemeGroups : [];
        setCustomerLedger({
          customerID: d.customerID || 0,
          cifNo: d.cifNo || d.memberCode || '',
          legacyCustomerNo: d.legacyCustomerNo,
          customerName: d.customerName || d.memberName || '',
          mobileNo: d.mobileNo || '',
          address: d.address || '',
          branchName: d.branchName || '',
          isAllCustomers: Boolean(d.isAllCustomers ?? isAllMode),
          selectedSchemeId: d.selectedSchemeId ?? selectedSchemeId,
          selectedSchemeName: d.selectedSchemeName || 'सर्व ठेव प्रकार',
          totalFDAccountsCount: d.totalFDAccountsCount ?? accounts.length,
          totalPrincipalInvested: Number(d.totalPrincipalInvested ?? accounts.reduce((sum, a) => sum + (Number(a.depositAmount) || 0), 0)),
          totalMaturityValue: Number(d.totalMaturityValue ?? accounts.reduce((sum, a) => sum + (Number(a.maturityAmount) || 0), 0)),
          totalOpeningBalance: Number(d.totalOpeningBalance ?? schemeGroups.reduce((sum, g) => sum + (Number(g.openingBalance) || 0), 0)),
          totalPeriodDebit: Number(d.totalPeriodDebit ?? schemeGroups.reduce((sum, g) => sum + (Number(g.periodTotalDebit) || 0), 0)),
          totalPeriodCredit: Number(d.totalPeriodCredit ?? schemeGroups.reduce((sum, g) => sum + (Number(g.periodTotalCredit) || 0), 0)),
          totalClosingBalance: Number(d.totalClosingBalance ?? schemeGroups.reduce((sum, g) => sum + (Number(g.closingBalance) || 0), 0)),
          fromDate: d.fromDate,
          toDate: d.toDate,
          accounts,
          schemeGroups
        });
      } else {
        setCustomerLedger(null);
      }
    } catch (err) {
      if (reqSeq !== ledgerRequestSeqRef.current) return;
      console.error('Error fetching FD customer ledger', err);
      setCustomerLedger(null);
    } finally {
      if (reqSeq === ledgerRequestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const ledgerViewData = useMemo(() => {
    if (!customerLedger) return null;

    const baseGroups: FdSchemeLedgerGroup[] =
      customerLedger.schemeGroups && customerLedger.schemeGroups.length > 0
        ? customerLedger.schemeGroups
        : [{
            fdSchemeID: 0,
            schemeName: customerLedger.selectedSchemeName || 'मुदत ठेव',
            accountsCount: customerLedger.accounts.length,
            totalDepositAmount: customerLedger.totalPrincipalInvested,
            totalMaturityAmount: customerLedger.totalMaturityValue,
            openingBalance: customerLedger.totalOpeningBalance ?? 0,
            periodTotalDebit: customerLedger.totalPeriodDebit ?? 0,
            periodTotalCredit: customerLedger.totalPeriodCredit ?? 0,
            closingBalance: customerLedger.totalClosingBalance ?? 0,
            accounts: customerLedger.accounts,
            consolidated: {
              accountsCount: customerLedger.accounts.length,
              totalDepositAmount: customerLedger.totalPrincipalInvested,
              totalMaturityAmount: customerLedger.totalMaturityValue,
              openingBalance: customerLedger.totalOpeningBalance ?? 0,
              periodTotalDebit: customerLedger.totalPeriodDebit ?? 0,
              periodTotalCredit: customerLedger.totalPeriodCredit ?? 0,
              closingBalance: customerLedger.totalClosingBalance ?? 0,
              transactions: []
            }
          }];

    const hasValidReceiptFilter =
      ledgerViewMode === 'single' &&
      selectedLedgerFdAccountId > 0 &&
      customerLedger.accounts.some((a) => a.fdAccountID === selectedLedgerFdAccountId);

    const visibleGroups = baseGroups
      .map((grp) => {
        const visibleAccounts = hasValidReceiptFilter
          ? grp.accounts.filter((a) => a.fdAccountID === selectedLedgerFdAccountId)
          : grp.accounts;

        if (visibleAccounts.length === 0) return null;

        const isSingle = ledgerViewMode === 'single';
        const displayCount = isSingle
          ? visibleAccounts.length
          : (grp.consolidated?.accountsCount ?? grp.accountsCount);
        const displayDeposit = isSingle
          ? visibleAccounts.reduce((s, a) => s + Number(a.depositAmount || 0), 0)
          : (grp.consolidated?.totalDepositAmount ?? grp.totalDepositAmount);
        const displayOpening = isSingle
          ? visibleAccounts.reduce((s, a) => s + Number(a.openingBalance ?? 0), 0)
          : (grp.consolidated?.openingBalance ?? grp.openingBalance);
        const displayDebit = isSingle
          ? visibleAccounts.reduce((s, a) => s + Number(a.periodTotalDebit ?? 0), 0)
          : (grp.consolidated?.periodTotalDebit ?? grp.periodTotalDebit);
        const displayCredit = isSingle
          ? visibleAccounts.reduce((s, a) => s + Number(a.periodTotalCredit ?? 0), 0)
          : (grp.consolidated?.periodTotalCredit ?? grp.periodTotalCredit);
        const displayClosing = isSingle
          ? visibleAccounts.reduce((s, a) => s + Number(a.closingBalance ?? a.depositAmount ?? 0), 0)
          : (grp.consolidated?.closingBalance ?? grp.closingBalance);

        return {
          ...grp,
          visibleAccounts,
          displayCount,
          displayDeposit,
          displayOpening,
          displayDebit,
          displayCredit,
          displayClosing
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);

    const accountsCount = visibleGroups.reduce((s, g) => s + g.displayCount, 0);
    const totalPrincipal = visibleGroups.reduce((s, g) => s + g.displayDeposit, 0);
    const totalOpening = visibleGroups.reduce((s, g) => s + g.displayOpening, 0);
    const totalDebit = visibleGroups.reduce((s, g) => s + g.displayDebit, 0);
    const totalCredit = visibleGroups.reduce((s, g) => s + g.displayCredit, 0);
    const totalClosing = visibleGroups.reduce((s, g) => s + g.displayClosing, 0);
    const activeSingleAccount =
      hasValidReceiptFilter && visibleGroups.length === 1 && visibleGroups[0].visibleAccounts.length === 1
        ? visibleGroups[0].visibleAccounts[0]
        : null;

    return {
      visibleGroups,
      summary: {
        accountsCount,
        totalPrincipal,
        totalOpening,
        totalDebit,
        totalCredit,
        totalClosing
      },
      activeSingleAccount
    };
  }, [customerLedger, ledgerViewMode, selectedLedgerFdAccountId]);

  const filteredData = data
    .filter((row) => {
      if (selectedSchemeId > 0 && row.fdSchemeID && row.fdSchemeID !== selectedSchemeId) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        (row.accountNo && row.accountNo.toLowerCase().includes(term)) ||
        (row.legacyAccountNumber && row.legacyAccountNumber.toLowerCase().includes(term)) ||
        (row.memberName && row.memberName.toLowerCase().includes(term)) ||
        (row.customerName && row.customerName.toLowerCase().includes(term)) ||
        (row.cifNo && row.cifNo.toLowerCase().includes(term)) ||
        (row.memberCode && row.memberCode.toLowerCase().includes(term)) ||
        (row.schemeName && row.schemeName.toLowerCase().includes(term)) ||
        (row.nomineeName && row.nomineeName.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => (a.accountNo || '').localeCompare(b.accountNo || '') || (a.fdAccountID - b.fdAccountID));

  const filteredVoucherPassing = voucherPassingData.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (r.voucherNo && r.voucherNo.toLowerCase().includes(term)) ||
      (r.accountNo && r.accountNo.toLowerCase().includes(term)) ||
      (r.customerName && r.customerName.toLowerCase().includes(term)) ||
      (r.customerCode && r.customerCode.toLowerCase().includes(term)) ||
      (r.transactionType && r.transactionType.toLowerCase().includes(term)) ||
      (r.scrollNo && r.scrollNo.toString().includes(term))
    );
  });

  const filteredDeletedEntries = deletedEntriesData.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (r.accountNo && r.accountNo.toLowerCase().includes(term)) ||
      (r.voucherNo && r.voucherNo.toLowerCase().includes(term)) ||
      (r.deleteType && r.deleteType.toLowerCase().includes(term)) ||
      (r.deletedBy && r.deletedBy.toLowerCase().includes(term)) ||
      (r.reasonOrDetails && r.reasonOrDetails.toLowerCase().includes(term))
    );
  });

  const totalDepositSum = filteredData.reduce((s, r) => s + (r.depositAmount || 0), 0);
  const totalOutstandingWithInterestSum = filteredData.reduce((s, r) => s + (r.totalOutstandingWithInterest ?? r.depositAmount ?? 0), 0);
  const totalPostedInterestSum = filteredData.reduce((s, r) => s + (r.postedInterest || 0), 0);
  const totalMaturitySum = filteredData.reduce((s, r) => s + (r.maturityAmount || 0), 0);
  const totalLegacyAccruedSum = filteredData.reduce((s, r) => s + (r.legacyAccruedInt || 0), 0);
  const totalVoucherPassingSum = filteredVoucherPassing.reduce((s, r) => s + (r.totalAmount || 0), 0);
  const totalDeletedSum = filteredDeletedEntries.reduce((s, r) => s + (r.amount || 0), 0);

  const filteredCustomerSummary = customerSummaryData.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (row.cifNo && row.cifNo.toLowerCase().includes(term)) ||
      (row.accountNo && row.accountNo.toLowerCase().includes(term)) ||
      (row.customerName && row.customerName.toLowerCase().includes(term)) ||
      (row.mobileNo && row.mobileNo.toLowerCase().includes(term))
    );
  });

  const totalCustomerSummaryDeposit = filteredCustomerSummary.reduce((s, r) => s + (r.depositAmount || 0), 0);
  const totalCustomerSummaryMaturity = filteredCustomerSummary.reduce((s, r) => s + (r.maturityAmount || 0), 0);
  const totalCustomerSummaryFdCount = filteredCustomerSummary.reduce((s, r) => s + (r.fdCount || 0), 0);

  const getReportTitle = () => {
    switch (reportType) {
      case 'CustomerSummary': return 'मुदतबंद ठेव यादी (ग्राहक-निहाय एकत्रित ठेवी)';
      case 'Register': return 'मुदत ठेव नोंदवही';
      case 'Outstanding': return 'मुदत ठेव बाकी अहवाल';
      case 'MaturityDue': return 'मुदतपूर्ती देय अहवाल';
      case 'MemberLedger': return 'मुदत ठेव खातावणी विवरणपत्र';
      case 'VoucherPassing': return 'मुदत ठेव व्हाउचर पासिंग अहवाल';
      case 'DeletedEntries': return 'मुदत ठेव थेट रद्द नोंदी व रोलबॅक अहवाल';
      case 'MigratedFD': return 'स्थलांतरित मुदत ठेव (FD) यादी अहवाल';
      default: return 'मुदत ठेव अहवाल';
    }
  };

  const getReportSubtitle = () => {
    switch (reportType) {
      case 'CustomerSummary': return 'Customer-wise Fixed Deposit Summary';
      case 'Register': return 'Fixed Deposit Register';
      case 'Outstanding': return 'Fixed Deposit Outstanding Report';
      case 'MaturityDue': return 'Fixed Deposit Maturity Due Report';
      case 'MemberLedger': return 'Customer-wise Fixed Deposit Account Ledger';
      case 'VoucherPassing': return 'Fixed Deposit Voucher Passing Report';
      case 'DeletedEntries': return 'Fixed Deposit Deleted Entries & Rollback Audit';
      case 'MigratedFD': return 'Migrated Fixed Deposit Accounts Report';
      default: return 'Fixed Deposit Report';
    }
  };

  const getPeriodText = () => {
    switch (reportType) {
      case 'CustomerSummary':
        return `दि. ${formatDisplayDate(asOfDate)} अखेर`;
      case 'Outstanding':
        return `दि. ${formatDisplayDate(toDate)} अखेर (चालू बाकी स्थिती)`;
      case 'Register':
      case 'MaturityDue':
      case 'VoucherPassing':
      case 'DeletedEntries':
        return `दि. ${formatDisplayDate(fromDate)} ते दि. ${formatDisplayDate(toDate)}`;
      case 'MigratedFD':
        return 'स्थलांतरित मुदत ठेव खाती यादी (आरंभिक शिल्लक)';
      case 'MemberLedger':
        return customerLedger
          ? customerLedger.isAllCustomers
            ? `${customerLedger.customerName} | कालावधी: ${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`
            : `ग्राहक: ${customerLedger.customerName} (${customerLedger.cifNo || '-'}) | कालावधी: ${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`
          : 'कृपया ठेव प्रकार व खातेदार / सर्व खाती निवडा';
      default:
        return `दिनांक: ${formatDisplayDate(new Date().toISOString())}`;
    }
  };

  const formatSafeFdNarration = (narration?: string, txType?: string, voucherNo?: string, accNo?: string, legacyNo?: string) => {
    const raw = (narration || txType || '').trim();
    const vn = (voucherNo || '').toUpperCase();
    const tt = (txType || '').toLowerCase();
    const leg = legacyNo ? ` (जुनी पावती: ${legacyNo})` : '';

    // 1. Accrual / Interest credit
    if (tt === 'accrual' || vn.includes('INT') || vn.includes('PROV') || raw.includes('व्याज जमा') || raw.includes('व्याज तरतूद') || raw.includes('Accrued Interest')) {
      if (raw.includes('मुदतपूर्व') || vn.includes('PRECLOSE')) return 'मुदतपूर्व व्याज जमा';
      if (raw.includes('मुदतपूर्ती') || vn.includes('MAT')) return 'मुदतपूर्ती व्याज जमा';
      if (raw.includes('जुने व्याज') || vn.includes('LEG-INT')) return `साचलेले जुने व्याज जमा${leg}`;
      return 'मुदत ठेव व्याज जमा';
    }

    // 2. Premature close payout
    if (
      tt.includes('premature') ||
      vn.includes('PRECLOSE') ||
      raw.includes('मुदतपूर्व बंद') ||
      raw.includes('Premature Close')
    ) {
      return 'मुदतपूर्व बंद परतावा';
    }

    // 3. Maturity close payout
    if (
      tt.includes('matur') ||
      vn.includes('MAT') ||
      vn.includes('CLOSE') ||
      raw.includes('मुदतपूर्ती बंद') ||
      raw.includes('मुदत समाप्ती') ||
      raw.includes('Maturity')
    ) {
      return 'मुदतपूर्ती परतावा';
    }

    // 4. Renewal
    if (tt.includes('renew') || vn.includes('REN') || raw.includes('नूतनीकरण') || raw.includes('Renewal')) {
      return 'मुदत ठेव नूतनीकरण';
    }

    // 5. Opening / Migration
    if (
      tt === 'opening' ||
      vn.includes('FD-OP') ||
      raw.includes('आरंभिक') ||
      raw.includes('Migration') ||
      raw.includes('खाते उघडले') ||
      raw.includes('Account Opened')
    ) {
      if (raw.includes('स्थलांतर') || raw.includes('Migration') || legacyNo || raw.includes('आरंभिक')) {
        return `आरंभिक मुदत ठेव जमा${leg}`;
      }
      return 'नवीन मुदत ठेव जमा';
    }

    // Fallback: strip english brackets, trailing account numbers, duration details
    let clean = raw
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*:\s*[0-9A-Za-z\-_]+/g, '')
      .replace(/-\s*कालावधी:[^,]*,?/, '')
      .replace(/पुनर्हिशोब व्याज:[^,]*,?/, '')
      .replace(/दंड कपात:[^,]*/, '')
      .trim();

    return clean || raw || 'मुदत ठेव व्यवहार';
  };

  const selectedBranchObj = branches.find(b => b.branchID === branchID);
  const activeBranchName = branchID > 0
    ? (selectedBranchObj ? selectedBranchObj.branchName : 'शाखा')
    : 'सर्व शाखा (All Branches)';

  const getHasData = () => {
    switch (reportType) {
      case 'CustomerSummary': return filteredCustomerSummary.length > 0;
      case 'VoucherPassing': return filteredVoucherPassing.length > 0;
      case 'DeletedEntries': return filteredDeletedEntries.length > 0;
      case 'MemberLedger': return !!customerLedger;
      default: return filteredData.length > 0;
    }
  };

  const handleExportExcel = () => {
    if (reportType === 'CustomerSummary') {
      if (filteredCustomerSummary.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows = filteredCustomerSummary.map((r, i) => ({
        'अ.क्र.': i + 1,
        'खाते / CIF क्र.': r.cifNo || r.accountNo,
        'खातेदाराचे नाव': r.customerName,
        'मोबाईल क्र.': r.mobileNo || '',
        'एकूण ठेवी (पावत्या)': r.fdCount,
        'एकूण ठेव रक्कम (₹)': r.depositAmount || 0,
        'मुदतपूर्ती रक्कम (₹)': r.maturityAmount || 0
      }));
      rows.push({
        'अ.क्र.': '' as any,
        'खाते / CIF क्र.': 'एकूण बेरीज (Grand Total):',
        'खातेदाराचे नाव': `एकूण खातेदार: ${filteredCustomerSummary.length}`,
        'मोबाईल क्र.': '',
        'एकूण ठेवी (पावत्या)': totalCustomerSummaryFdCount,
        'एकूण ठेव रक्कम (₹)': totalCustomerSummaryDeposit,
        'मुदतपूर्ती रक्कम (₹)': totalCustomerSummaryMaturity
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FD Customer Summary');
      XLSX.writeFile(wb, `FD_Customer_Summary_${asOfDate}.xlsx`);
      return;
    }

    if (reportType === 'MemberLedger') {
      if (!customerLedger || !ledgerViewData || customerLedger.accounts.length === 0) {
        return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      }
      const rows: any[] = [];
      const groupsToExport = ledgerViewData.visibleGroups;

      if (ledgerViewMode === 'consolidated') {
        groupsToExport.forEach(grp => {
          rows.push({
            'ठेव प्रकार': `=== ${grp.schemeName} (एकत्रित: ${grp.displayCount} खाती) ===`,
            'FD पावती क्र.': '',
            'जुनी पावती क्र.': '',
            'खातेदाराचे नाव': '',
            'CIF क्र.': '',
            'व्यवहार तारीख': formatDisplayDate(fromDate),
            'व्हाउचर क्र.': 'B/F',
            'तपशील': 'एकत्रित आरंभिक शिल्लक (Consolidated Opening B/F)',
            'नावे रक्कम (Dr ₹)': 0,
            'जमा रक्कम (Cr ₹)': 0,
            'शिल्लक रक्कम (Balance ₹)': grp.consolidated.openingBalance
          });

          grp.consolidated.transactions.forEach(tx => {
            rows.push({
              'ठेव प्रकार': grp.schemeName,
              'FD पावती क्र.': tx.accountNo || '-',
              'जुनी पावती क्र.': tx.legacyAccountNumber || '-',
              'खातेदाराचे नाव': tx.customerName || customerLedger.customerName,
              'CIF क्र.': tx.cifNo || customerLedger.cifNo || '-',
              'व्यवहार तारीख': formatDisplayDate(tx.transactionDate),
              'व्हाउचर क्र.': tx.voucherNo || '-',
              'तपशील': formatSafeFdNarration(tx.narration, tx.transactionType, tx.voucherNo, tx.accountNo, tx.legacyAccountNumber),
              'नावे रक्कम (Dr ₹)': tx.debit > 0 ? tx.debit : 0,
              'जमा रक्कम (Cr ₹)': tx.credit > 0 ? tx.credit : 0,
              'शिल्लक रक्कम (Balance ₹)': tx.balance
            });
          });

          rows.push({
            'ठेव प्रकार': `${grp.schemeName} एकत्रित बेरीज:`,
            'FD पावती क्र.': `${grp.displayCount} खाती`,
            'जुनी पावती क्र.': '',
            'खातेदाराचे नाव': '',
            'CIF क्र.': '',
            'व्यवहार तारीख': '',
            'व्हाउचर क्र.': '',
            'तपशील': 'ठेव प्रकार एकूण नावे / जमा / अंतिम शिल्लक',
            'नावे रक्कम (Dr ₹)': grp.consolidated.periodTotalDebit,
            'जमा रक्कम (Cr ₹)': grp.consolidated.periodTotalCredit,
            'शिल्लक रक्कम (Balance ₹)': grp.consolidated.closingBalance
          });
        });
      } else {
        groupsToExport.forEach(grp => {
          const accountsToExport = grp.visibleAccounts;

          accountsToExport.forEach(acc => {
            const custDisplay = acc.customerName || customerLedger.customerName;
            const cifDisplay = acc.cifNo || customerLedger.cifNo || '-';
            if (acc.openingBalance !== undefined && acc.openingBalance > 0) {
              rows.push({
                'ठेव प्रकार': acc.schemeName,
                'FD पावती क्र.': acc.accountNo,
                'जुनी पावती क्र.': acc.legacyAccountNumber || '-',
                'खातेदाराचे नाव': custDisplay,
                'CIF क्र.': cifDisplay,
                'ठेव तारीख': formatDisplayDate(acc.openingDate),
                'मुदत तारीख': formatDisplayDate(acc.maturityDate),
                'व्याजदर %': acc.interestRate,
                'वारसदार': acc.nomineeName ? `${acc.nomineeName} (${acc.nomineeRelation || ''})` : '-',
                'तारण बोजा': acc.isLienMarked ? `Lien (${acc.lienLoanAccountNo || 'कर्ज तारण'})` : 'निरंक',
                'व्यवहार तारीख': formatDisplayDate(fromDate),
                'व्हाउचर क्र.': 'B/F',
                'तपशील': 'आरंभिक शिल्लक (Opening Balance Brought Forward)',
                'नावे रक्कम (Dr ₹)': 0,
                'जमा रक्कम (Cr ₹)': 0,
                'शिल्लक रक्कम (Balance ₹)': acc.openingBalance
              });
            }

            acc.transactions.forEach((tx) => {
              rows.push({
                'ठेव प्रकार': acc.schemeName,
                'FD पावती क्र.': acc.accountNo,
                'जुनी पावती क्र.': acc.legacyAccountNumber || '-',
                'खातेदाराचे नाव': custDisplay,
                'CIF क्र.': cifDisplay,
                'ठेव तारीख': formatDisplayDate(acc.openingDate),
                'मुदत तारीख': formatDisplayDate(acc.maturityDate),
                'व्याजदर %': acc.interestRate,
                'वारसदार': acc.nomineeName ? `${acc.nomineeName} (${acc.nomineeRelation || ''})` : '-',
                'तारण बोजा': acc.isLienMarked ? `Lien (${acc.lienLoanAccountNo || 'कर्ज तारण'})` : 'निरंक',
                'व्यवहार तारीख': formatDisplayDate(tx.transactionDate),
                'व्हाउचर क्र.': tx.voucherNo || '-',
                'तपशील': formatSafeFdNarration(tx.narration, tx.transactionType, tx.voucherNo, acc.accountNo, acc.legacyAccountNumber),
                'नावे रक्कम (Dr ₹)': tx.debit > 0 ? tx.debit : 0,
                'जमा रक्कम (Cr ₹)': tx.credit > 0 ? tx.credit : 0,
                'शिल्लक रक्कम (Balance ₹)': tx.balance
              });
            });

            rows.push({
              'ठेव प्रकार': acc.schemeName,
              'FD पावती क्र.': `${acc.accountNo} एकूण:`,
              'जुनी पावती क्र.': '',
              'खातेदाराचे नाव': custDisplay,
              'CIF क्र.': cifDisplay,
              'ठेव तारीख': '',
              'मुदत तारीख': '',
              'व्याजदर %': '',
              'वारसदार': '',
              'तारण बोजा': '',
              'व्यवहार तारीख': '',
              'व्हाउचर क्र.': '',
              'तपशील': 'खाते एकूण नावे / जमा / अखेर शिल्लक',
              'नावे रक्कम (Dr ₹)': acc.periodTotalDebit ?? acc.transactions.reduce((s, t) => s + (t.debit || 0), 0),
              'जमा रक्कम (Cr ₹)': acc.periodTotalCredit ?? acc.transactions.reduce((s, t) => s + (t.credit || 0), 0),
              'शिल्लक रक्कम (Balance ₹)': acc.closingBalance ?? (acc.transactions[acc.transactions.length - 1]?.balance ?? acc.depositAmount)
            });
          });
        });
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FD Ledger');
      const fileTag = customerLedger.isAllCustomers
        ? 'All_Accounts'
        : (customerLedger.customerName || 'Statement').replace(/\s+/g, '_');
      XLSX.writeFile(wb, `FD_Ledger_${fileTag}_${fromDate}_to_${toDate}.xlsx`);
      return;
    }

    if (reportType === 'VoucherPassing') {
      if (filteredVoucherPassing.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows = filteredVoucherPassing.map((v, i) => ({
        'अ.क्र.': i + 1,
        'व्हाउचर क्र.': v.voucherNo,
        'तारीख': formatDisplayDate(v.voucherDate),
        'व्यवहार प्रकार': v.transactionType,
        'FD पावती क्र.': v.accountNo || '-',
        'खातेदाराचे नाव': v.customerName || '-',
        'रक्कम (₹)': v.totalAmount || 0,
        'स्क्रॉल क्र.': v.scrollNo || '-',
        'स्थिती': v.status === 'Approved' ? 'मंजूर' : (v.status === 'Pending' ? 'प्रलंबित' : v.status),
        'तपशील': formatSafeFdNarration(v.narration, v.transactionType, v.voucherNo, v.accountNo)
      }));
      rows.push({
        'अ.क्र.': '' as any,
        'व्हाउचर क्र.': '',
        'तारीख': '',
        'व्यवहार प्रकार': '',
        'FD पावती क्र.': '',
        'खातेदाराचे नाव': 'एकूण व्हाउचर रक्कम बेरीज:',
        'रक्कम (₹)': totalVoucherPassingSum,
        'स्क्रॉल क्र.': '',
        'स्थिती': '',
        'तपशील': ''
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FD Voucher Passing');
      XLSX.writeFile(wb, `FD_Voucher_Passing_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (reportType === 'DeletedEntries') {
      if (filteredDeletedEntries.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows = filteredDeletedEntries.map((d, i) => ({
        'अ.क्र.': i + 1,
        'रद्द दिनांक & वेळ': d.deletedDate,
        'रद्द नोंद प्रकार': d.deleteType,
        'FD पावती क्र.': d.accountNo || '-',
        'व्हाउचर क्र.': d.voucherNo || '-',
        'रक्कम (₹)': d.amount || 0,
        'रद्दकर्ता': d.deletedBy,
        'पावती क्र. रोलबॅक स्थिती': d.rollbackInfo,
        'तपशील व कारण': d.reasonOrDetails
      }));
      rows.push({
        'अ.क्र.': '' as any,
        'रद्द दिनांक & वेळ': '',
        'रद्द नोंद प्रकार': '',
        'FD पावती क्र.': '',
        'व्हाउचर क्र.': 'एकूण रक्कम बेरीज:',
        'रक्कम (₹)': totalDeletedSum,
        'रद्दकर्ता': '',
        'पावती क्र. रोलबॅक स्थिती': '',
        'तपशील व कारण': ''
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FD Deleted Entries');
      XLSX.writeFile(wb, `FD_Deleted_Entries_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (reportType === 'MigratedFD') {
      if (filteredData.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows = filteredData.map((row, i) => ({
        'अ.क्र.': i + 1,
        'नवीन पावती क्र.': row.accountNo,
        'जुनी पावती क्र.': row.legacyAccountNumber || '-',
        'खातेदाराचे नाव': row.customerName || row.memberName,
        'CIF क्र.': row.cifNo || '-',
        'योजना': row.schemeName,
        'ठेव तारीख': formatDisplayDate(row.openingDate),
        'कालावधी': row.durationValue ? `${row.durationValue} ${row.durationType || 'महिने'}` : (row.durationInDays ? `${row.durationInDays} दिवस` : '-'),
        'ठेव मुद्दल (₹)': row.depositAmount || 0,
        'व्याज दर (%)': row.interestRate,
        'मुदतपूर्ती तारीख': formatDisplayDate(row.maturityDate),
        'मुदतपूर्ती रक्कम (₹)': row.maturityAmount || 0,
        'साचलेले जुने व्याज (₹)': row.legacyAccruedInt || 0,
        'शेवटची व्याज तारीख': formatDisplayDate(row.lastInterestPostingDate),
        'वारसदार': row.nomineeName ? `${row.nomineeName} (${row.nomineeRelation || ''})` : '-',
        'शेरा': row.remarks || '-',
        'स्थिती': row.status
      }));
      rows.push({
        'अ.क्र.': '' as any,
        'नवीन पावती क्र.': '',
        'जुनी पावती क्र.': '',
        'खातेदाराचे नाव': 'एकूण बेरीज (Grand Total):',
        'CIF क्र.': '',
        'योजना': '',
        'ठेव तारीख': '',
        'कालावधी': '',
        'ठेव मुद्दल (₹)': totalDepositSum,
        'व्याज दर (%)': 0,
        'मुदतपूर्ती तारीख': '',
        'मुदतपूर्ती रक्कम (₹)': totalMaturitySum,
        'साचलेले जुने व्याज (₹)': totalLegacyAccruedSum,
        'शेवटची व्याज तारीख': '',
        'वारसदार': '',
        'शेरा': '',
        'स्थिती': ''
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Migrated FD Accounts');
      XLSX.writeFile(wb, `Migrated_FD_Accounts_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (filteredData.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
    const excelRows = filteredData.map((row, i) => {
      const item: any = {
        'अ.क्र.': i + 1,
        'FD पावती / खाते नं.': format14DigitDisplay(row.accountNo),
        'जुनी पावती क्र.': row.legacyAccountNumber || '-',
        'ग्राहक क्र. (CIF)': row.cifNo || row.memberCode || '-',
        'खातेदाराचे नाव': row.customerName || row.memberName,
        'योजना': row.schemeName,
        'ठेव तारीख': formatDisplayDate(row.openingDate),
        'मुदत ठेव रक्कम (₹)': row.depositAmount || 0
      };

      if (reportType === 'Outstanding') {
        item['मुद्दल + पोस्ट व्याज (₹)'] = row.totalOutstandingWithInterest ?? row.depositAmount ?? 0;
        item['पोस्ट झालेले व्याज (₹)'] = row.postedInterest || 0;
      }

      item['व्याज दर (%)'] = row.interestRate;
      item['मुदतपूर्ती तारीख'] = formatDisplayDate(row.maturityDate);
      item['मुदतपूर्ती रक्कम (₹)'] = row.maturityAmount || 0;
      item['स्थिती'] = row.status;

      return item;
    });

    const grandTotalRow: any = {
      'अ.क्र.': '' as any,
      'FD पावती / खाते नं.': '',
      'जुनी पावती क्र.': '',
      'ग्राहक क्र. (CIF)': '',
      'खातेदाराचे नाव': 'एकूण बेरीज (Grand Total):',
      'योजना': '',
      'ठेव तारीख': '',
      'मुदत ठेव रक्कम (₹)': totalDepositSum
    };

    if (reportType === 'Outstanding') {
      grandTotalRow['मुद्दल + पोस्ट व्याज (₹)'] = totalOutstandingWithInterestSum;
      grandTotalRow['पोस्ट झालेले व्याज (₹)'] = totalPostedInterestSum;
    }

    grandTotalRow['व्याज दर (%)'] = 0;
    grandTotalRow['मुदतपूर्ती तारीख'] = '';
    grandTotalRow['मुदतपूर्ती रक्कम (₹)'] = totalMaturitySum;
    grandTotalRow['स्थिती'] = '';

    excelRows.push(grandTotalRow);

    const activeScheme = schemes.find(s => s.fdSchemeID === selectedSchemeId);
    const activeSchemeName = activeScheme ? activeScheme.schemeName : 'AllSchemes';
    const cleanSchemeName = activeSchemeName.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_');
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FD Report');
    XLSX.writeFile(wb, `FD_Report_${reportType}_${cleanSchemeName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const renderSummaryBanner = () => {
    if (reportType === 'Register') {
      const avgDeposit = filteredData.length > 0 ? totalDepositSum / filteredData.length : 0;
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण मुदत ठेव खाती</span>
              <strong className="text-primary font-mono text-xs">{filteredData.length.toLocaleString('en-IN')}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण ठेव मुद्दल</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(totalDepositSum)}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण मुदतपूर्ती रक्कम</span>
              <strong className="text-blue-700 font-mono text-xs">₹ {fmtCurrency(totalMaturitySum)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">सरासरी ठेव रक्कम</span>
              <strong className="text-slate-900 font-mono text-xs">₹ {fmtCurrency(avgDeposit)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'Outstanding') {
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण चालू बाकी खाती</span>
              <strong className="text-primary font-mono text-xs">{filteredData.length.toLocaleString('en-IN')} खाती</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण मूळ ठेव मुद्दल</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(totalDepositSum)}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">पोस्ट झालेले व्याज</span>
              <strong className="text-blue-700 font-mono text-xs">₹ {fmtCurrency(totalPostedInterestSum)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण बाकी (मुद्दल + पोस्ट व्याज)</span>
              <strong className="text-amber-800 font-mono text-xs font-black">₹ {fmtCurrency(totalOutstandingWithInterestSum)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'MaturityDue') {
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">मुदतपूर्ती खाती</span>
              <strong className="text-primary font-mono text-xs">{filteredData.length.toLocaleString('en-IN')}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">मूळ ठेव मुद्दल</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(totalDepositSum)}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण देय मुदतपूर्ती रक्कम</span>
              <strong className="text-blue-700 font-mono text-xs">₹ {fmtCurrency(totalMaturitySum)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">कालावधी</span>
              <strong className="text-slate-800 text-[10.5px] font-mono">{formatDisplayDate(fromDate)} - {formatDisplayDate(toDate)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'MemberLedger' && customerLedger && ledgerViewData) {
      const { summary, activeSingleAccount } = ledgerViewData;
      const isSingleMode = ledgerViewMode === 'single';
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">
                {customerLedger.isAllCustomers ? 'निवडलेले खातेदार / प्रकार' : 'खातेदाराचे नाव'}
              </span>
              <strong className="text-slate-950 text-xs truncate block">{customerLedger.customerName}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">
                {customerLedger.isAllCustomers ? 'ठेव प्रकार / प्रदर्शन पद्धत' : 'CIF क्र. / मोबाईल'}
              </span>
              <strong className="text-primary font-mono text-xs">
                {customerLedger.isAllCustomers
                  ? `${customerLedger.selectedSchemeName || 'सर्व प्रकार'} (${isSingleMode ? 'सिंगल खातेनिहाय' : 'एकत्रित'})`
                  : `${customerLedger.cifNo || '-'}${customerLedger.legacyCustomerNo ? ` (जुना: ${customerLedger.legacyCustomerNo})` : ''} | ${customerLedger.mobileNo || '-'}`}
              </strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">
                {activeSingleAccount
                  ? 'निवडलेली FD पावती (सिंगल)'
                  : isSingleMode
                  ? 'सिंगल (खातेनिहाय) खाती'
                  : 'एकत्रित समाविष्ट खाती'}
              </span>
              <strong className="text-blue-700 font-mono text-xs">
                {activeSingleAccount
                  ? `${activeSingleAccount.accountNo}${activeSingleAccount.legacyAccountNumber ? ` (जुनी: ${activeSingleAccount.legacyAccountNumber})` : ''}`
                  : `${summary.accountsCount} खाती`}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">
                {activeSingleAccount
                  ? 'पावती मुद्दल / अखेर शिल्लक'
                  : isSingleMode
                  ? 'सिंगल खाती मुद्दल / शिल्लक'
                  : 'एकत्रित ठेव मुद्दल / शिल्लक'}
              </span>
              <strong className="text-emerald-700 font-mono text-xs">
                ₹ {fmtCurrency(summary.totalPrincipal)} / ₹ {fmtCurrency(summary.totalClosing)}
              </strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'VoucherPassing') {
      const pendingCount = filteredVoucherPassing.filter(v => v.status === 'Pending').length;
      const approvedCount = filteredVoucherPassing.filter(v => v.status === 'Approved').length;
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण व्हाउचर</span>
              <strong className="text-primary font-mono text-xs">{filteredVoucherPassing.length}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">प्रलंबित व्हाउचर</span>
              <strong className="text-amber-700 font-mono text-xs">{pendingCount}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">मंजूर व्हाउचर</span>
              <strong className="text-emerald-700 font-mono text-xs">{approvedCount}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण उलाढाल</span>
              <strong className="text-slate-950 font-mono text-xs">₹ {fmtCurrency(totalVoucherPassingSum)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'DeletedEntries') {
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण रद्द नोंदी</span>
              <strong className="text-rose-700 font-mono text-xs">{filteredDeletedEntries.length}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">ठेव अर्ज रद्द</span>
              <strong className="text-amber-700 font-mono text-xs">{filteredDeletedEntries.filter(d => d.typeBadge === 'ठेव अर्ज रद्द').length}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">परतफेड रद्द</span>
              <strong className="text-purple-700 font-mono text-xs">{filteredDeletedEntries.filter(d => d.typeBadge === 'परतफेड रद्द').length}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण रद्द रक्कम</span>
              <strong className="text-rose-900 font-mono text-xs font-black">₹ {fmtCurrency(totalDeletedSum)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'MigratedFD') {
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">स्थलांतरित खाती</span>
              <strong className="text-primary font-mono text-xs">{filteredData.length}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण ठेव मुद्दल</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(totalDepositSum)}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण मुदतपूर्ती रक्कम</span>
              <strong className="text-blue-700 font-mono text-xs">₹ {fmtCurrency(totalMaturitySum)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">साचलेले जुने व्याज</span>
              <strong className="text-amber-800 font-mono text-xs">₹ {fmtCurrency(totalLegacyAccruedSum)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'CustomerSummary') {
      const avgDepositPerCust = filteredCustomerSummary.length > 0 ? totalCustomerSummaryDeposit / filteredCustomerSummary.length : 0;
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण खातेदार</span>
              <strong className="text-primary font-mono text-xs">{filteredCustomerSummary.length.toLocaleString('en-IN')}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण ठेव पावत्या</span>
              <strong className="text-blue-700 font-mono text-xs">{totalCustomerSummaryFdCount.toLocaleString('en-IN')} ठेवी</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण ठेव रक्कम</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(totalCustomerSummaryDeposit)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">सरासरी ठेव / खातेदार</span>
              <strong className="text-slate-900 font-mono text-xs">₹ {fmtCurrency(avgDepositPerCust)}</strong>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const ledgerAllOptions = useMemo(() => {
    const opts: any[] = [
      {
        value: 'ALL',
        kind: 'all',
        label: `सर्व खाती (All Accounts) — ${ledgerTotalAvailableAccounts} खाती`,
        totalAccountsCount: ledgerTotalAvailableAccounts,
        totalDepositAmount: ledgerTotalAvailableDeposit
      }
    ];

    ledgerCustomerOptions.forEach((c) => {
      const searchBlob = `${c.customerName} ${c.customerNameEng || ''} ${c.nickName || ''} ${c.cifNo} ${c.legacyCustomerNo || ''} ${c.mobileNo} ${(c.accountNumbers || []).join(' ')}`.toLowerCase();
      opts.push({
        value: `cust-${c.customerID}`,
        kind: 'customer',
        label: `${c.cifNo} ${c.legacyCustomerNo ? `[जुना: ${c.legacyCustomerNo}] ` : ''}${c.customerName} (${c.fdCount} खाती)`,
        searchBlob,
        customer: c
      });
    });

    ledgerAccountOptions.forEach((a) => {
      const searchBlob = `${a.legacyAccountNumber || ''} ${a.receiptNo || ''} ${a.accountNo} ${a.customerName} ${a.customerNameEng || ''} ${a.nickName || ''} ${a.cifNo} ${a.legacyCustomerNo || ''} ${a.mobileNo}`.toLowerCase();
      opts.push({
        value: `acc-${a.fdAccountID}`,
        kind: 'account',
        label: `${a.legacyAccountNumber ? `जुना: ${a.legacyAccountNumber} | ` : ''}${a.accountNo} — ${a.customerName}`,
        searchBlob,
        account: a
      });
    });

    return opts;
  }, [ledgerCustomerOptions, ledgerAccountOptions, ledgerTotalAvailableAccounts, ledgerTotalAvailableDeposit]);

  const ledgerFilteredSortedOptions = useMemo(() => {
    const q = ledgerSearchInput.trim().toLowerCase();
    if (!q) return ledgerAllOptions;

    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: { opt: any; score: number; idx: number }[] = [];

    for (let i = 0; i < ledgerAllOptions.length; i++) {
      const opt = ledgerAllOptions[i];
      if (opt.kind === 'all') {
        if ('सर्व खाती all accounts'.includes(q)) {
          scored.push({ opt, score: 1500, idx: i });
        }
        continue;
      }

      if (opt.kind === 'account') {
        const a: FdLedgerAccountOption = opt.account;
        const leg = (a.legacyAccountNumber || '').toLowerCase();
        const rec = (a.receiptNo || '').toLowerCase();
        const accNo = (a.accountNo || '').toLowerCase();
        const nameMar = (a.customerName || '').toLowerCase();
        const nameEng = (a.customerNameEng || '').toLowerCase();
        const nick = (a.nickName || '').toLowerCase();
        const cif = (a.cifNo || '').toLowerCase();
        const legCust = (a.legacyCustomerNo || '').toLowerCase();

        let score = 0;
        if ((leg && leg === q) || (rec && rec === q) || accNo === q) score = 1200;
        else if ((leg && leg.startsWith(q)) || (rec && rec.startsWith(q)) || accNo.startsWith(q)) score = 1050;
        else if ((leg && leg.includes(q)) || (rec && rec.includes(q)) || accNo.includes(q)) score = 820;
        else if (
          nameMar.startsWith(q) ||
          nameEng.startsWith(q) ||
          nick.startsWith(q) ||
          cif === q ||
          (legCust && legCust === q)
        ) score = 720;
        else if (tokens.length > 1 && tokens.every((t) => opt.searchBlob.includes(t))) score = 620;
        else if (opt.searchBlob.includes(q)) score = 450;

        if (score > 0) scored.push({ opt, score, idx: i });
        continue;
      }

      if (opt.kind === 'customer') {
        const c: FdLedgerCustomerOption = opt.customer;
        const nameMar = (c.customerName || '').toLowerCase();
        const nameEng = (c.customerNameEng || '').toLowerCase();
        const nick = (c.nickName || '').toLowerCase();
        const cif = (c.cifNo || '').toLowerCase();
        const legCust = (c.legacyCustomerNo || '').toLowerCase();

        let score = 0;
        if (nameMar === q || (nameEng && nameEng === q) || cif === q || (legCust && legCust === q)) score = 1000;
        else if (
          nameMar.startsWith(q) ||
          (nameEng && nameEng.startsWith(q)) ||
          (nick && nick.startsWith(q)) ||
          cif.startsWith(q) ||
          (legCust && legCust.startsWith(q))
        ) score = 920;
        else if (tokens.length > 1 && tokens.every((t) => opt.searchBlob.includes(t))) score = 780;
        else if ((c.accountNumbers || []).some((n) => n.toLowerCase() === q)) score = 760;
        else if ((c.accountNumbers || []).some((n) => n.toLowerCase().startsWith(q))) score = 680;
        else if (opt.searchBlob.includes(q)) score = 550;

        if (score > 0) scored.push({ opt, score, idx: i });
      }
    }

    scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));
    return scored.map((s) => s.opt);
  }, [ledgerAllOptions, ledgerSearchInput]);

  const selectedLedgerOption = useMemo(() => {
    if (selectedCustomerID === -1) return ledgerAllOptions[0] || null;
    if (selectedCustomerID > 0 && ledgerViewMode === 'single' && selectedLedgerFdAccountId > 0) {
      const matchedAcc = ledgerAllOptions.find(
        (o) => o.kind === 'account' && o.account?.fdAccountID === selectedLedgerFdAccountId
      );
      if (matchedAcc) return matchedAcc;
    }
    if (selectedCustomerID > 0) {
      return ledgerAllOptions.find((o) => o.kind === 'customer' && o.customer?.customerID === selectedCustomerID) || null;
    }
    return null;
  }, [ledgerAllOptions, selectedCustomerID, selectedLedgerFdAccountId, ledgerViewMode]);

  const extraToolbarControls = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* 1. Report Selector */}
      <div className="w-52 sm:w-60">
        <select
          value={reportType}
          onChange={(e) => handleReportTypeChange(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary w-full text-primary"
        >
          <option value="Register">१. मुदत ठेव नोंदवही (FD Register)</option>
          <option value="Outstanding">२. मुदत ठेव बाकी अहवाल (FD Outstanding)</option>
          <option value="MaturityDue">३. मुदतपूर्ती देय अहवाल (Maturity Due)</option>
          <option value="MemberLedger">४. मुदत ठेव खातावणी (FD Account Ledger)</option>
          <option value="AccrualProvision">५. व्याज तरतूद (Interest Provision)</option>
          <option value="VoucherPassing">६. मुदत ठेव व्हाउचर पासिंग अहवाल (Voucher Passing)</option>
          <option value="DeletedEntries">७. मुदत ठेव रद्द नोंदी व रोलबॅक अहवाल (Deleted & Rollback)</option>
          <option value="MigratedFD">८. स्थलांतरित मुदत ठेव (FD) यादी (Migrated FD Accounts Report)</option>
          <option value="CustomerSummary">९. मुदतबंद ठेव यादी (ग्राहक-निहाय एकत्रित ठेवी)</option>
        </select>
      </div>

      {/* 2. Branch Selector */}
      {reportType !== 'AccrualProvision' && branches.length > 0 && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <Building2 size={11} className="text-slate-500" />
          <label className="text-[10px] text-slate-600 font-semibold">शाखा:</label>
          <select
            value={branchID}
            onChange={(e) => setBranchID(parseInt(e.target.value, 10))}
            disabled={!isHOUser}
            className="h-5 text-[10.5px] border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-semibold cursor-pointer max-w-[120px] disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {isHOUser && <option value={0}>सर्व शाखा (All)</option>}
            {(isHOUser ? branches : branches.filter((b) => Number(b.branchID) === (user?.branchID || branchID))).map((b) => (
              <option key={b.branchID} value={b.branchID}>
                {b.branchName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3. Scheme Selector FIRST (for MemberLedger as well as Register, Outstanding, MaturityDue, MigratedFD) */}
      {(reportType === 'MemberLedger' || reportType === 'Register' || reportType === 'Outstanding' || reportType === 'MaturityDue' || reportType === 'MigratedFD') && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <label className="text-[10px] text-slate-600 font-semibold whitespace-nowrap">ठेव प्रकार:</label>
          <select
            value={selectedSchemeId}
            onChange={(e) => {
              const nextSchemeId = parseInt(e.target.value, 10);
              setSelectedSchemeId(nextSchemeId);
              setSelectedLedgerFdAccountId(0);
              setSavedSingleFdAccountId(0);
            }}
            className="h-5 text-[10.5px] font-bold border-none bg-transparent focus:ring-0 p-0 text-slate-900 cursor-pointer max-w-[160px]"
          >
            <option value={0}>सर्व ठेव प्रकार (All)</option>
            {schemes.map((s) => (
              <option key={s.fdSchemeID} value={s.fdSchemeID}>
                {s.schemeName} {s.schemeCode ? `(${s.schemeCode})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 4. Scheme-Filtered Customer / Account Search Box + All Accounts + View Mode Toggle (for MemberLedger) */}
      {reportType === 'MemberLedger' && (
        <>
          <div className="w-64 sm:w-96">
            <Select
              value={selectedLedgerOption}
              onInputChange={(newVal: string, actionMeta: any) => {
                if (actionMeta?.action === 'input-change') {
                  setLedgerSearchInput(newVal || '');
                } else if (actionMeta?.action === 'menu-close' || actionMeta?.action === 'set-value') {
                  setLedgerSearchInput('');
                }
              }}
              onBlur={() => setLedgerSearchInput('')}
              onChange={(opt: any) => {
                setLedgerSearchInput('');
                if (!opt) {
                  setSelectedCustomerID(0);
                  setSelectedLedgerFdAccountId(0);
                  setSavedSingleFdAccountId(0);
                  return;
                }
                if (opt.kind === 'all') {
                  setSelectedCustomerID(-1);
                  setSelectedLedgerFdAccountId(0);
                  setSavedSingleFdAccountId(0);
                  return;
                }
                if (opt.kind === 'account' && opt.account) {
                  setLedgerViewMode('single');
                  setSelectedCustomerID(opt.account.customerID);
                  setSelectedLedgerFdAccountId(opt.account.fdAccountID);
                  setSavedSingleFdAccountId(opt.account.fdAccountID);
                  return;
                }
                if (opt.kind === 'customer' && opt.customer) {
                  setSelectedCustomerID(opt.customer.customerID);
                  setSelectedLedgerFdAccountId(0);
                  setSavedSingleFdAccountId(0);
                }
              }}
              options={ledgerFilteredSortedOptions}
              components={FD_LEDGER_SELECT_COMPONENTS}
              filterOption={() => true}
              isClearable
              isSearchable
              placeholder={`-- ठेवीदार नाव (मराठी/Eng) किंवा जुना ठेव क्र. शोधा (${ledgerCustomerOptions.length} ठेवीदार / ${ledgerAccountOptions.length} खाती) --`}
              noOptionsMessage={() =>
                ledgerOptionsError
                  ? ledgerOptionsError
                  : 'या ठेव प्रकाराखाली जुळणारा ठेवीदार किंवा जुना ठेव क्र. सापडला नाही'
              }
              formatOptionLabel={(opt: any, { context }: any) => {
                if (opt.kind === 'all') {
                  return (
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-primary">🌐 सर्व खाती (प्रकारानुसार संपूर्ण अहवाल)</span>
                      <span className="px-1.5 py-0.2 bg-primary/10 text-primary rounded font-mono font-bold text-[10px]">
                        {opt.totalAccountsCount} खाती
                      </span>
                    </div>
                  );
                }
                if (opt.kind === 'account' && opt.account) {
                  const a: FdLedgerAccountOption = opt.account;
                  const oldNo = a.legacyAccountNumber || a.receiptNo;
                  if (context === 'value') {
                    return (
                      <div className="flex items-center gap-1.5 text-[10.5px] truncate">
                        {oldNo && (
                          <span className="px-1 bg-amber-50 text-amber-900 border border-amber-300 rounded font-mono font-bold text-[9.5px] shrink-0">
                            जुना: {oldNo}
                          </span>
                        )}
                        <span className="font-mono font-bold text-primary shrink-0">{a.accountNo}</span>
                        <span className="font-bold text-slate-900 truncate">{a.customerName}</span>
                      </div>
                    );
                  }
                  return (
                    <div className="flex flex-col text-[11px] leading-tight">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1 min-w-0">
                          {oldNo && (
                            <span className="px-1 py-0.2 bg-amber-50 text-amber-900 border border-amber-300 rounded font-mono font-bold text-[9.5px] shrink-0">
                              🏷️ जुना ठेव: {oldNo}
                            </span>
                          )}
                          <span className="px-1 py-0.2 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded font-mono font-bold text-[9.5px] shrink-0">
                            {a.accountNo}
                          </span>
                          <span className="font-bold text-slate-900 truncate">{a.customerName}</span>
                        </div>
                        <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-mono font-bold text-[9.5px] shrink-0">
                          ₹ {fmtCurrency(a.depositAmount)}
                        </span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 font-mono truncate mt-0.5">
                        {a.cifNo}{a.customerNameEng ? ` • ${a.customerNameEng}` : ''} • {a.schemeName} ({a.status})
                      </div>
                    </div>
                  );
                }
                const c: FdLedgerCustomerOption = opt.customer;
                if (context === 'value') {
                  return (
                    <div className="flex items-center gap-1.5 text-[10.5px] truncate">
                      <span className="px-1 bg-sky-50 text-sky-800 border border-sky-200 rounded font-mono font-bold text-[9.5px] shrink-0">
                        {c.cifNo}
                      </span>
                      <span className="font-bold text-slate-900 truncate">{c.customerName}</span>
                      <span className="text-[9.5px] text-slate-500 font-mono shrink-0">({c.fdCount})</span>
                    </div>
                  );
                }
                const previewAccs = (c.accountNumbers || []).slice(0, 4).join(', ');
                return (
                  <div className="flex flex-col text-[11px] leading-tight">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="px-1 py-0.2 bg-sky-50 text-sky-800 border border-sky-200 rounded font-mono font-bold text-[9.5px] shrink-0">
                          {c.cifNo}
                        </span>
                        {c.legacyCustomerNo && (
                          <span className="px-1 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded font-mono font-bold text-[9.5px] shrink-0">
                            जुना: {c.legacyCustomerNo}
                          </span>
                        )}
                        <span className="font-bold text-slate-900 truncate">
                          {c.customerName}
                          {c.customerNameEng && c.customerNameEng !== c.customerName ? (
                            <span className="font-normal text-slate-500 ml-1">({c.customerNameEng})</span>
                          ) : null}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-mono font-bold text-[9.5px] shrink-0">
                        {c.fdCount} खाती
                      </span>
                    </div>
                    {previewAccs && (
                      <div className="text-[9.5px] text-slate-500 font-mono truncate mt-0.5">
                        ठेव / पावती क्र.: {previewAccs}{(c.accountNumbers || []).length > 4 ? ` (+${c.accountNumbers.length - 4})` : ''}
                      </div>
                    )}
                  </div>
                );
              }}
              styles={{
                control: (base: any) => ({
                  ...base,
                  minHeight: '26px',
                  height: '26px',
                  fontSize: '10.5px',
                  borderRadius: '3px',
                  borderColor: ledgerOptionsError ? '#e11d48' : '#cbd5e1',
                  backgroundColor: '#ffffff'
                }),
                valueContainer: (base: any) => ({ ...base, height: '26px', padding: '0 6px', overflow: 'hidden' }),
                singleValue: (base: any) => ({ ...base, maxWidth: 'calc(100% - 8px)', margin: 0 }),
                input: (base: any) => ({ ...base, margin: 0, padding: 0 }),
                indicatorsContainer: (base: any) => ({ ...base, height: '26px' }),
                menu: (base: any) => ({ ...base, zIndex: 99999, minWidth: '420px', width: 'max-content', maxWidth: '90vw' })
              }}
            />
          </div>

          {/* Single vs Consolidated Toggle */}
          <div
            className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300"
            title="एकाच ठेव प्रकारात एकापेक्षा जास्त खाती असल्यास सिंगल (वेगवेगळी) किंवा एकत्रित पहा"
          >
            <button
              type="button"
              onClick={() => {
                setLedgerViewMode('single');
                if (
                  selectedLedgerFdAccountId === 0 &&
                  savedSingleFdAccountId > 0 &&
                  customerLedger?.accounts.some((a) => a.fdAccountID === savedSingleFdAccountId)
                ) {
                  setSelectedLedgerFdAccountId(savedSingleFdAccountId);
                }
              }}
              className={`px-2 py-0.5 rounded-xs font-bold text-[10.5px] cursor-pointer transition-colors ${
                ledgerViewMode === 'single'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              सिंगल (खातेनिहाय)
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedLedgerFdAccountId > 0) {
                  setSavedSingleFdAccountId(selectedLedgerFdAccountId);
                }
                setLedgerViewMode('consolidated');
                setSelectedLedgerFdAccountId(0);
              }}
              className={`px-2 py-0.5 rounded-xs font-bold text-[10.5px] cursor-pointer transition-colors ${
                ledgerViewMode === 'consolidated'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              एकत्रित (Consolidated)
            </button>
          </div>

          {/* Single Receipt Filter when single customer + single view + multiple accounts */}
          {selectedCustomerID > 0 && ledgerViewMode === 'single' && customerLedger && customerLedger.accounts.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
              <label className="text-[10px] text-slate-600 font-semibold whitespace-nowrap">पावती:</label>
              <select
                value={selectedLedgerFdAccountId}
                onChange={(e) => {
                  const nextAccId = Number(e.target.value);
                  setSelectedLedgerFdAccountId(nextAccId);
                  setSavedSingleFdAccountId(nextAccId);
                }}
                className="h-5 text-[10.5px] font-bold border-none bg-transparent focus:ring-0 p-0 text-slate-900 cursor-pointer max-w-[170px]"
              >
                <option value={0}>सर्व पावत्या ({customerLedger.accounts.length})</option>
                {customerLedger.accounts.map((acc) => (
                  <option key={acc.fdAccountID} value={acc.fdAccountID}>
                    {acc.accountNo} {acc.legacyAccountNumber ? `(जुनी: ${acc.legacyAccountNumber})` : ''} - ₹{fmtCurrency(acc.depositAmount)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {/* 5. Date Filter (AsOfDate for CustomerSummary) */}
      {reportType === 'CustomerSummary' && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <Calendar size={11} className="text-slate-500" />
          <label className="text-[10px] text-slate-600 font-semibold">अखेर तारीख:</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="h-5 text-[11px] font-mono border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-bold"
          />
        </div>
      )}

      {/* 6. Date Range (for Register, MaturityDue, VoucherPassing, DeletedEntries, MemberLedger) */}
      {(reportType === 'Register' || reportType === 'MaturityDue' || reportType === 'VoucherPassing' || reportType === 'DeletedEntries' || reportType === 'MemberLedger') && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <Calendar size={11} className="text-slate-500" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-5 text-[10.5px] font-mono border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-bold w-24"
            title="या तारखेपासून"
          />
          <span className="text-slate-400 text-xs">-</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-5 text-[10.5px] font-mono border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-bold w-24"
            title="या तारखेपर्यंत"
          />
        </div>
      )}

      {/* 7. Status Filter (for VoucherPassing) */}
      {reportType === 'VoucherPassing' && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <label className="text-[10px] text-slate-600 font-semibold">स्थिती:</label>
          <select
            value={voucherPassingStatus}
            onChange={(e) => setVoucherPassingStatus(e.target.value)}
            className="h-5 text-[10.5px] border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-semibold cursor-pointer"
          >
            <option value="ALL">सर्व (All)</option>
            <option value="Pending">प्रलंबित (Pending)</option>
            <option value="Approved">मंजूर / पास (Passed)</option>
          </select>
        </div>
      )}

      {/* 8. Layout Mode Toggle (for CustomerSummary: DualColumn vs Detailed) */}
      {reportType === 'CustomerSummary' && (
        <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300">
          <button
            type="button"
            onClick={() => setSummaryViewMode('DualColumn')}
            className={`px-1.5 py-0.5 rounded-xs font-semibold text-[10.5px] cursor-pointer transition-colors ${
              summaryViewMode === 'DualColumn' 
                ? 'bg-primary text-white shadow-2xs' 
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            २ स्तंभी (Dual)
          </button>
          <button
            type="button"
            onClick={() => setSummaryViewMode('Detailed')}
            className={`px-1.5 py-0.5 rounded-xs font-semibold text-[10.5px] cursor-pointer transition-colors ${
              summaryViewMode === 'Detailed' 
                ? 'bg-primary text-white shadow-2xs' 
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            तपशीलवार
          </button>
        </div>
      )}

      {/* 9. Search Box */}
      {reportType !== 'AccrualProvision' && reportType !== 'MemberLedger' && (
        <div className="relative w-36 sm:w-44">
          <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="शोधा..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-5 pr-1.5 py-0.5 h-6 border border-slate-300 rounded text-[10.5px] focus:outline-none focus:border-primary bg-white"
          />
        </div>
      )}

      {/* 10. Signature Tier Selector */}
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
        <label className="text-[10px] text-slate-600 font-semibold whitespace-nowrap">स्वाक्षरी:</label>
        <select
          value={signatureTier}
          onChange={(e) => setSignatureTier(e.target.value as CbsSignatureTier)}
          className="h-5 text-[10.5px] border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-semibold cursor-pointer"
        >
          <option value="3-tier">३-स्तरीय</option>
          <option value="4-tier">४-स्तरीय</option>
        </select>
      </div>

      {/* 11. Refresh Button */}
      {reportType !== 'AccrualProvision' && (
        <button
          type="button"
          onClick={() => {
            if (reportType === 'MemberLedger') {
              fetchLedgerCustomerOptions(branchID, selectedSchemeId);
              if (selectedCustomerID === -1 || selectedCustomerID > 0) {
                fetchCustomerLedgerData(selectedCustomerID);
              }
            } else {
              fetchReportData();
            }
          }}
          disabled={loading}
          className="h-6 bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 rounded border border-slate-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          title="रिफ्रेश करा"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  );

  const signatureTitles = signatureTier === '4-tier'
    ? [
        { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' },
        { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Director)' }
      ]
    : [
        { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' }
      ];

  if (reportType === 'AccrualProvision') {
    return (
      <div className="cbs-report-wrapper p-2 sm:p-4 bg-slate-100 min-h-screen">
        <div className="cbs-toolbar bg-white px-3 py-1.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText size={13} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xs font-bold text-gray-900 leading-none">
              मुदत ठेव अहवाल केंद्र <span className="text-[10px] font-normal text-slate-500">(FD Reports Center)</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-slate-700">अहवाल प्रकार:</label>
            <div className="w-56 sm:w-64">
              <select
                value={reportType}
                onChange={(e) => handleReportTypeChange(e.target.value)}
                className="h-6 border border-slate-300 rounded px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary w-full text-primary"
              >
                <option value="Register">१. मुदत ठेव नोंदवही (FD Register)</option>
                <option value="Outstanding">२. मुदत ठेव बाकी अहवाल (FD Outstanding)</option>
                <option value="MaturityDue">३. मुदतपूर्ती देय अहवाल (Maturity Due)</option>
                <option value="MemberLedger">४. मुदत ठेव खातावणी (FD Account Ledger)</option>
                <option value="AccrualProvision">५. व्याज तरतूद (Interest Provision)</option>
                <option value="VoucherPassing">६. मुदत ठेव व्हाउचर पासिंग अहवाल (Voucher Passing)</option>
                <option value="DeletedEntries">७. मुदत ठेव रद्द नोंदी व रोलबॅक अहवाल (Deleted & Rollback)</option>
                <option value="MigratedFD">८. स्थलांतरित मुदत ठेव (FD) यादी (Migrated FD Accounts Report)</option>
                <option value="CustomerSummary">९. मुदतबंद ठेव यादी (ग्राहक-निहाय एकत्रित ठेवी)</option>
              </select>
            </div>
          </div>
        </div>
        <FdAccrualPosting />
      </div>
    );
  }

  return (
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      reportTitle={getReportTitle()}
      reportSubtitle={getReportSubtitle()}
      periodText={getPeriodText()}
      branchName={activeBranchName}
      sansthaInfo={sansthaDetail}
      summaryBanner={renderSummaryBanner()}
      signatureTier={signatureTier}
      signatureTitles={signatureTitles}
      onExportExcel={handleExportExcel}
      extraToolbarControls={extraToolbarControls}
      isLoading={loading}
      hasData={getHasData()}
      preparedBy={user?.username || 'Admin'}
      emptyState={
        reportType === 'MemberLedger' && !customerLedger ? (
          <div className="py-16 text-center text-slate-500 font-medium border border-dashed border-slate-300 rounded bg-white">
            <Search size={32} className="mx-auto mb-2 text-slate-400 opacity-60" />
            {ledgerOptionsError ? (
              <p className="text-xs font-bold text-rose-700 bg-rose-50 inline-block px-3 py-1.5 rounded border border-rose-200">
                ⚠️ {ledgerOptionsError}
              </p>
            ) : (
              <>
                <p className="text-xs font-bold text-slate-700">खातावणी पाहण्यासाठी प्रथम ठेव प्रकार निवडा व शोध बॉक्समधून ठेवीदार नाव, जुना ठेव क्र. किंवा &ldquo;सर्व खाती&rdquo; निवडा.</p>
                <p className="text-[11px] text-slate-400 mt-1">(Select FD Scheme first, then search by Depositor Name / Old FD No or choose &ldquo;All Accounts&rdquo;)</p>
              </>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 font-medium border border-dashed border-slate-300 rounded bg-white">
            <Users size={32} className="mx-auto mb-2 text-slate-400 opacity-60" />
            <p className="text-xs font-bold text-slate-700">निवडलेल्या निकषांनुसार कोणतीही माहिती उपलब्ध नाही.</p>
          </div>
        )
      }
    >
      {/* ============================================================
          VIEW 1: CUSTOMER SUMMARY (९. मुदतबंद ठेव यादी - Dual Column & Detailed)
          ============================================================ */}
      {reportType === 'CustomerSummary' && (
        <div className="space-y-4">
          {/* Dual-Column Print Format */}
          {summaryViewMode === 'DualColumn' && (
            <div className="overflow-x-auto">
              {(() => {
                const half = Math.ceil(filteredCustomerSummary.length / 2);
                const leftRows = filteredCustomerSummary.slice(0, half);
                const rightRows = filteredCustomerSummary.slice(half);

                return (
                  <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold text-[11px]">
                        {/* Left Column Header */}
                        <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.नं.</th>
                        <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-center font-mono">खाते क्र.</th>
                        <th className="border border-slate-900 py-1.5 px-2.5 w-[24%] text-left">खातेदाराचे नाव</th>
                        <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-right font-extrabold">रक्कम (₹)</th>
                        
                        {/* Divider / Right Column Header */}
                        <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center border-l-2 border-l-slate-900">अ.नं.</th>
                        <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-center font-mono">खाते क्र.</th>
                        <th className="border border-slate-900 py-1.5 px-2.5 w-[24%] text-left">खातेदाराचे नाव</th>
                        <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-right font-extrabold">रक्कम (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: half }).map((_, i) => {
                        const left = leftRows[i];
                        const right = rightRows[i];
                        return (
                          <tr key={`dual-row-${i}`} className="hover:bg-slate-50 text-slate-900 text-[11px] leading-tight">
                            {/* Left cell */}
                            <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                              {i + 1}
                            </td>
                            <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-slate-900">
                              {left ? (left.cifNo || left.accountNo) : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-2.5 text-left font-medium truncate max-w-[200px]" title={left?.customerName}>
                              {left ? left.customerName : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950">
                              {left ? Number(left.depositAmount).toFixed(2) : ''}
                            </td>

                            {/* Right cell */}
                            <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium border-l-2 border-l-slate-900">
                              {right ? half + i + 1 : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-slate-900">
                              {right ? (right.cifNo || right.accountNo) : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-2.5 text-left font-medium truncate max-w-[200px]" title={right?.customerName}>
                              {right ? right.customerName : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950">
                              {right ? Number(right.depositAmount).toFixed(2) : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                        <td colSpan={3} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                          एकूण खातेदार: <strong className="font-mono">{filteredCustomerSummary.length}</strong>
                        </td>
                        <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-slate-950">
                          ₹ {fmtCurrency(totalCustomerSummaryDeposit)}
                        </td>
                        <td colSpan={3} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider border-l-2 border-l-slate-900">
                          एकूण ठेवी: <strong className="font-mono">{totalCustomerSummaryFdCount}</strong>
                        </td>
                        <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-slate-950">
                          ₹ {fmtCurrency(totalCustomerSummaryDeposit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                );
              })()}
            </div>
          )}

          {/* Detailed Drilldown View */}
          {summaryViewMode === 'Detailed' && (
            <div className="overflow-x-auto">
              <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                    <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">तपशील</th>
                    <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.नं.</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center font-mono">खाते / CIF क्र.</th>
                    <th className="border border-slate-900 py-1.5 px-3 w-[28%] text-left">खातेदाराचे नाव</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center">एकूण ठेवी</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right font-extrabold">एकूण ठेव रक्कम (₹)</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right font-bold">एकूण मुदतपूर्ती (₹)</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center font-mono">मोबाईल नं.</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomerSummary.map((cust, idx) => {
                    const isExpanded = expandedCustomerIds.includes(cust.customerID);
                    return (
                      <React.Fragment key={`cust-summary-${cust.customerID || idx}`}>
                        <tr 
                          onClick={() => {
                            setExpandedCustomerIds(prev => 
                              prev.includes(cust.customerID)
                                ? prev.filter(id => id !== cust.customerID)
                                : [...prev, cust.customerID]
                            );
                          }}
                          className="hover:bg-slate-50 cursor-pointer text-slate-900 text-[11px]"
                        >
                          <td className="border border-slate-900 py-1 px-1 text-center">
                            <button 
                              type="button"
                              className="w-4 h-4 inline-flex items-center justify-center rounded bg-slate-100 hover:bg-primary hover:text-white font-bold text-xs"
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          </td>
                          <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                          <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-primary">
                            {cust.cifNo || cust.accountNo}
                          </td>
                          <td className="border border-slate-900 py-1 px-3 text-left font-bold text-slate-950">
                            {cust.customerName}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-center">
                            <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold text-[10px] font-mono">
                              {cust.fdCount} {cust.fdCount > 1 ? 'ठेवी' : 'ठेव'}
                            </span>
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-emerald-800 text-xs">
                            ₹ {fmtCurrency(cust.depositAmount)}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-blue-900">
                            ₹ {fmtCurrency(cust.maturityAmount)}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10px] text-slate-600">
                            {cust.mobileNo || '-'}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50 border-b-2 border-slate-400">
                            <td colSpan={8} className="p-2 border border-slate-900">
                              <div className="bg-white p-2 rounded border border-slate-300">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-1 pb-1 border-b">
                                  <span>{cust.customerName} - वैयक्तिक मुदत ठेव पावत्या तपशील:</span>
                                  <span className="text-primary font-mono">एकूण ठेवी: {cust.fdCount} | एकूण रक्कम: ₹ {fmtCurrency(cust.depositAmount)}</span>
                                </div>
                                <table className="w-full border-collapse border border-slate-300 text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-800 text-center font-bold">
                                      <th className="border border-slate-300 p-1">पावती क्र.</th>
                                      <th className="border border-slate-300 p-1 text-left">योजना</th>
                                      <th className="border border-slate-300 p-1">ठेव तारीख</th>
                                      <th className="border border-slate-300 p-1 text-right">ठेव रक्कम (₹)</th>
                                      <th className="border border-slate-300 p-1">व्याज दर %</th>
                                      <th className="border border-slate-300 p-1">मुदतपूर्ती तारीख</th>
                                      <th className="border border-slate-300 p-1 text-right">मुदतपूर्ती रक्कम (₹)</th>
                                      <th className="border border-slate-300 p-1">स्थिती</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cust.accounts.map((acc, aIdx) => (
                                      <tr key={acc.fdAccountID || aIdx} className="hover:bg-amber-50/50">
                                        <td className="border border-slate-300 p-1 text-center font-mono font-bold text-primary">
                                          {acc.accountNo}
                                          {acc.legacyAccountNumber && (
                                            <span className="text-[10px] text-amber-900 bg-amber-50 px-1 rounded border border-amber-300 ml-1">
                                              {acc.legacyAccountNumber}
                                            </span>
                                          )}
                                        </td>
                                        <td className="border border-slate-300 p-1 text-left">{acc.schemeName}</td>
                                        <td className="border border-slate-300 p-1 text-center font-mono">{formatDisplayDate(acc.openingDate)}</td>
                                        <td className="border border-slate-300 p-1 text-right font-mono font-bold text-emerald-800">
                                          ₹ {fmtCurrency(acc.depositAmount)}
                                        </td>
                                        <td className="border border-slate-300 p-1 text-center font-mono">{acc.interestRate}%</td>
                                        <td className="border border-slate-300 p-1 text-center font-mono">{formatDisplayDate(acc.maturityDate)}</td>
                                        <td className="border border-slate-300 p-1 text-right font-mono font-bold text-blue-900">
                                          ₹ {fmtCurrency(acc.maturityAmount)}
                                        </td>
                                        <td className="border border-slate-300 p-1 text-center">
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                            {acc.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                    <td colSpan={4} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                      एकूण बेरीज (Grand Total - {filteredCustomerSummary.length} खातेदार):
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-center font-mono font-bold text-primary">
                      {totalCustomerSummaryFdCount} ठेवी
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                      ₹ {fmtCurrency(totalCustomerSummaryDeposit)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-blue-950 bg-blue-100/50">
                      ₹ {fmtCurrency(totalCustomerSummaryMaturity)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-center"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          VIEW 2: MEMBER LEDGER (४. मुदत ठेव खातावणी विवरणपत्र)
          ============================================================ */}
      {reportType === 'MemberLedger' && customerLedger && ledgerViewData && (
        <div
          key={`fd-ledger-${ledgerViewMode}-${selectedCustomerID}-${selectedLedgerFdAccountId}`}
          className="space-y-3"
        >
          {/* Compact View Mode, Address & Period Strip (non-duplicating) */}
          <div className="border border-slate-300 px-2.5 py-1.5 bg-slate-50/70 rounded-xs text-[10.5px] flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-slate-700">
              <span
                className={`px-2 py-0.5 rounded font-bold border ${
                  ledgerViewMode === 'consolidated'
                    ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                    : 'bg-primary/10 text-primary border-primary/30'
                }`}
              >
                {ledgerViewMode === 'consolidated'
                  ? 'प्रदर्शन: एकत्रित खातावणी (Consolidated)'
                  : ledgerViewData.activeSingleAccount
                  ? `प्रदर्शन: सिंगल पावती (${ledgerViewData.activeSingleAccount.accountNo})`
                  : 'प्रदर्शन: सिंगल (खातेनिहाय)'}
              </span>
              {customerLedger.address && !customerLedger.isAllCustomers && (
                <span>
                  <strong className="text-slate-800">पत्ता:</strong> {customerLedger.address}
                </span>
              )}
            </div>
            <div className="font-mono text-slate-700">
              <strong className="font-sans text-slate-800">कालावधी: </strong>
              {customerLedger.fromDate || customerLedger.toDate
                ? `${customerLedger.fromDate ? formatDisplayDate(customerLedger.fromDate) : 'आरंभ'} ते ${customerLedger.toDate ? formatDisplayDate(customerLedger.toDate) : 'आज'}`
                : 'संपूर्ण खातावणी'}
            </div>
          </div>

          {/* Scheme-grouped Ledger Content */}
          {ledgerViewData.visibleGroups.length === 0 ? (
            <div className="p-4 text-center text-slate-500 border border-slate-300 rounded bg-white">
              निवडलेल्या ठेव प्रकारानुसार कोणतीही मुदत ठेव खाती आढळली नाहीत.
            </div>
          ) : (
            <div className="space-y-5">
              {ledgerViewData.visibleGroups.map((grp, gIdx) => {
                const visibleAccounts = grp.visibleAccounts;

                return (
                  <div key={`${ledgerViewMode}-${grp.fdSchemeID || gIdx}`} className="space-y-2.5">
                    {/* Scheme Section Header (shown when multiple visible schemes, All Accounts, or Consolidated view) */}
                    {(ledgerViewData.visibleGroups.length > 1 || customerLedger.isAllCustomers || ledgerViewMode === 'consolidated') && (
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-primary/10 border border-primary/40 border-l-4 border-l-primary px-3 py-1.5 rounded-xs text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">
                            ठेव प्रकार: {grp.schemeName} {grp.schemeCode ? `(${grp.schemeCode})` : ''}
                          </span>
                          <span className="px-1.5 py-0.2 bg-white text-slate-800 border border-slate-300 rounded font-mono font-bold text-[10px]">
                            {grp.displayCount} खाती
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono font-bold">
                          <span className="text-slate-700">मुद्दल: ₹ {fmtCurrency(grp.displayDeposit)}</span>
                          <span className="text-rose-800">नावे: ₹ {fmtCurrency(grp.displayDebit)}</span>
                          <span className="text-emerald-800">जमा: ₹ {fmtCurrency(grp.displayCredit)}</span>
                          <span className="text-blue-950">अखेर शिल्लक: ₹ {fmtCurrency(grp.displayClosing)}</span>
                        </div>
                      </div>
                    )}

                      {ledgerViewMode === 'consolidated' ? (
                        <div className="border border-slate-900 rounded-xs overflow-hidden bg-white shadow-xs">
                          {/* Consolidated Summary Header Strip */}
                          <div className="flex flex-wrap justify-between items-center bg-slate-100 px-2.5 py-1.5 border-b border-slate-900 gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                एकत्रित मुदत ठेव खातावणी ({grp.schemeName})
                              </span>
                              <span className="text-[10.5px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
                                समाविष्ट खाती: {grp.consolidated.accountsCount}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono font-bold text-slate-800">
                              एकूण ठेव मुद्दल: <span className="text-emerald-800">₹ {fmtCurrency(grp.consolidated.totalDepositAmount)}</span>
                              {' | '}मुदतपूर्ती मूल्य: <span className="text-blue-900">₹ {fmtCurrency(grp.consolidated.totalMaturityAmount)}</span>
                            </div>
                          </div>

                          {/* Included FD Accounts Mini-Summary Table */}
                          <div className="p-2 bg-slate-50/70 border-b border-slate-400">
                            <div className="text-[10.5px] font-bold text-slate-700 mb-1">
                              समाविष्ट मुदत ठेव पावत्यांचा गोषवारा (Included FD Receipts):
                            </div>
                            <div className="overflow-x-auto">
                              <table className="cbs-table w-full border-collapse border border-slate-400 text-[10.5px] bg-white">
                                <thead>
                                  <tr className="bg-slate-200/70 text-slate-900 font-bold text-center">
                                    <th className="border border-slate-400 py-1 px-1.5">#</th>
                                    <th className="border border-slate-400 py-1 px-1.5 text-left">FD पावती क्र.</th>
                                    <th className="border border-slate-400 py-1 px-1.5 text-left">जुनी पावती</th>
                                    {customerLedger.isAllCustomers && (
                                      <th className="border border-slate-400 py-1 px-1.5 text-left">खातेदार (CIF)</th>
                                    )}
                                    <th className="border border-slate-400 py-1 px-1.5">ठेव दि.</th>
                                    <th className="border border-slate-400 py-1 px-1.5">मुदत दि.</th>
                                    <th className="border border-slate-400 py-1 px-1.5">दर %</th>
                                    <th className="border border-slate-400 py-1 px-1.5 text-right">मुद्दल (₹)</th>
                                    <th className="border border-slate-400 py-1 px-1.5 text-right">आरंभी (₹)</th>
                                    <th className="border border-slate-400 py-1 px-1.5 text-right">अखेर शिल्लक (₹)</th>
                                    <th className="border border-slate-400 py-1 px-1.5">स्थिती</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {grp.accounts.map((acc, idx) => (
                                    <tr key={acc.fdAccountID || idx} className="hover:bg-slate-50">
                                      <td className="border border-slate-300 py-0.5 px-1.5 text-center font-mono">{idx + 1}</td>
                                      <td className="border border-slate-300 py-0.5 px-1.5 font-mono font-bold text-primary">{acc.accountNo}</td>
                                      <td className="border border-slate-300 py-0.5 px-1.5 font-mono text-amber-800 font-semibold">{acc.legacyAccountNumber || '-'}</td>
                                      {customerLedger.isAllCustomers && (
                                        <td className="border border-slate-300 py-0.5 px-1.5">
                                          <span className="font-semibold text-slate-900">{acc.customerName}</span>
                                          {acc.cifNo && <span className="ml-1 font-mono text-[9.5px] text-slate-500">({acc.cifNo})</span>}
                                        </td>
                                      )}
                                      <td className="border border-slate-300 py-0.5 px-1.5 text-center font-mono">{formatDisplayDate(acc.openingDate)}</td>
                                      <td className="border border-slate-300 py-0.5 px-1.5 text-center font-mono">{formatDisplayDate(acc.maturityDate)}</td>
                                      <td className="border border-slate-300 py-0.5 px-1.5 text-center font-mono">{acc.interestRate}%</td>
                                      <td className="border border-slate-300 py-0.5 px-1.5 text-right font-mono font-semibold">₹ {fmtCurrency(acc.depositAmount)}</td>
                                      <td className="border border-slate-300 py-0.5 px-1.5 text-right font-mono">₹ {fmtCurrency(acc.openingBalance ?? 0)}</td>
                                      <td className="border border-slate-300 py-0.5 px-1.5 text-right font-mono font-bold text-blue-950">₹ {fmtCurrency(acc.closingBalance ?? 0)}</td>
                                      <td className="border border-slate-300 py-0.5 px-1.5 text-center text-[10px]">{acc.status}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Consolidated Chronological Ledger Table */}
                          <div className="overflow-x-auto">
                            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                              <thead>
                                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900 text-center">
                                  <th className="border border-slate-900 py-1.5 px-1 w-[4%]">#</th>
                                  <th className="border border-slate-900 py-1.5 px-2 w-[10%]">दिनांक</th>
                                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">FD पावती (जुनी)</th>
                                  <th className="border border-slate-900 py-1.5 px-2 w-[12%]">व्हाउचर क्र.</th>
                                  <th className="border border-slate-900 py-1.5 px-2 w-[24%] text-left">तपशील (Narration)</th>
                                  <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right text-rose-900 bg-rose-50/50">नावे Dr (₹)</th>
                                  <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right text-emerald-900 bg-emerald-50/50">जमा Cr (₹)</th>
                                  <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right text-slate-950 bg-slate-100">एकत्रित शिल्लक (₹)</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="bg-slate-100/90 font-bold text-slate-800 text-[11px] italic">
                                  <td className="border border-slate-900 py-1 px-1 text-center font-mono text-slate-500">-</td>
                                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                                    {customerLedger.fromDate ? formatDisplayDate(customerLedger.fromDate) : '-'}
                                  </td>
                                  <td className="border border-slate-900 py-1 px-2 font-mono text-slate-600">{grp.consolidated.accountsCount} खाती</td>
                                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-slate-500">-</td>
                                  <td className="border border-slate-900 py-1 px-2 font-semibold text-slate-700">
                                    एकत्रित मागील शिल्लक (Consolidated Opening B/F)
                                  </td>
                                  <td className="border border-slate-900 py-1 px-2 text-right font-mono text-slate-400">-</td>
                                  <td className="border border-slate-900 py-1 px-2 text-right font-mono text-slate-400">-</td>
                                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950 bg-slate-200/60">
                                    ₹ {fmtCurrency(grp.consolidated.openingBalance)}
                                  </td>
                                </tr>
                                {grp.consolidated.transactions.length > 0 ? (
                                  grp.consolidated.transactions.map((tx, tIdx) => {
                                    const isDebit = Number(tx.debit || 0) > 0;
                                    const isCredit = Number(tx.credit || 0) > 0;
                                    return (
                                      <tr key={`${tx.fdTransactionID}-${tx.fdAccountID}-${tIdx}`} className="text-[11px] hover:bg-slate-50">
                                        <td className="border border-slate-900 py-1 px-1 text-center font-mono text-slate-600">{tIdx + 1}</td>
                                        <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(tx.transactionDate)}</td>
                                        <td className="border border-slate-900 py-1 px-2 font-mono text-[10px]">
                                          <div className="font-bold text-primary">{tx.accountNo || '-'}</div>
                                          {tx.legacyAccountNumber && (
                                            <span className="text-amber-800 font-semibold">जुनी: {tx.legacyAccountNumber}</span>
                                          )}
                                          {customerLedger.isAllCustomers && tx.customerName && (
                                            <div className="font-sans text-[9.5px] text-slate-600 truncate">{tx.customerName}</div>
                                          )}
                                        </td>
                                        <td className="border border-slate-900 py-1 px-2 text-center font-mono font-semibold text-blue-900">
                                          <div>{tx.voucherNo || '-'}</div>
                                          {tx.passingStatus && (
                                            <span
                                              className={`inline-block mt-0.5 px-1 py-0.2 rounded text-[8.5px] font-bold border ${
                                                tx.passingStatus === 'Pending'
                                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                              }`}
                                            >
                                              {tx.passingStatus === 'Pending' ? 'प्रलंबित' : 'मंजूर'}
                                            </span>
                                          )}
                                        </td>
                                        <td className="border border-slate-900 py-1 px-2">
                                          {formatSafeFdNarration(tx.narration, tx.transactionType, tx.voucherNo, tx.accountNo, tx.legacyAccountNumber)}
                                        </td>
                                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-rose-700 bg-rose-50/20">
                                          {isDebit ? `₹ ${fmtCurrency(tx.debit)}` : <span className="text-slate-300 font-normal">-</span>}
                                        </td>
                                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                                          {isCredit ? `₹ ${fmtCurrency(tx.credit)}` : <span className="text-slate-300 font-normal">-</span>}
                                        </td>
                                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-black text-slate-950 bg-slate-50/50">
                                          ₹ {fmtCurrency(tx.balance)}
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan={8} className="border border-slate-900 p-4 text-center text-slate-500 italic">
                                      निवडलेल्या कालावधीत कोणतेही व्यवहार उपलब्ध नाहीत.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                                  <td colSpan={5} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                                    एकत्रित कालावधी बेरीज ({grp.schemeName}):
                                  </td>
                                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-rose-900 bg-rose-100/60">
                                    ₹ {fmtCurrency(grp.consolidated.periodTotalDebit)}
                                  </td>
                                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-emerald-900 bg-emerald-100/60">
                                    ₹ {fmtCurrency(grp.consolidated.periodTotalCredit)}
                                  </td>
                                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-blue-950 bg-blue-100/60">
                                    ₹ {fmtCurrency(grp.consolidated.closingBalance)}
                                  </td>
                                </tr>
                                <tr className="bg-slate-50 text-[10px] text-slate-700 border-t border-slate-300">
                                  <td colSpan={8} className="py-1 px-3 border border-slate-900">
                                    <span className="font-semibold text-slate-900">ऑडिट ताळमेळ (Consolidated Balance Equation): </span>
                                    आरंभी शिल्लक: <span className="font-mono font-bold">₹ {fmtCurrency(grp.consolidated.openingBalance)}</span>
                                    {' '}+ एकूण जमा (Cr): <span className="font-mono font-bold text-emerald-700">₹ {fmtCurrency(grp.consolidated.periodTotalCredit)}</span>
                                    {' '}- एकूण नावे (Dr): <span className="font-mono font-bold text-rose-700">₹ {fmtCurrency(grp.consolidated.periodTotalDebit)}</span>
                                    {' '}={' '}
                                    <strong className="text-slate-950">
                                      अंतिम शिल्लक (Closing Balance): <span className="font-mono font-bold text-blue-900">₹ {fmtCurrency(grp.consolidated.closingBalance)}</span>
                                    </strong>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <>
                          {visibleAccounts.map((acc, aIdx) => (
                            <div key={acc.fdAccountID || aIdx} className="border border-slate-900 rounded-xs mt-2 overflow-hidden bg-white shadow-xs">
                              {/* Account Summary Header Strip */}
                              <div className="flex flex-wrap justify-between items-center bg-slate-100 px-2.5 py-1.5 border-b border-slate-900 gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900">
                                    FD पावती नं.: <span className="font-mono text-primary text-sm font-black">{acc.accountNo}</span>
                                  </span>
                                  {acc.legacyAccountNumber && (
                                    <span className="text-[10px] text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.2 rounded font-mono font-bold" title="जुना पावती क्र.">
                                      जुनी पावती: {acc.legacyAccountNumber}
                                    </span>
                                  )}
                                  <span className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-300">
                                    {acc.schemeName}
                                  </span>
                                  {customerLedger.isAllCustomers && acc.customerName && (
                                    <span className="text-[11px] font-bold text-slate-900 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                                      खातेदार: {acc.customerName} {acc.cifNo ? `(${acc.cifNo})` : ''}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                      acc.status === 'Active'
                                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                        : acc.status === 'Matured'
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : 'bg-slate-200 text-slate-800 border-slate-400'
                                    }`}
                                  >
                                    {acc.status === 'Active' ? '● चालू (Active)' : acc.status === 'Matured' ? '● मुदत भरली (Matured)' : `● ${acc.status}`}
                                  </span>
                                </div>
                              </div>

                              {/* Account Metadata Quick Strip */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-2 bg-slate-50/50 border-b border-slate-300 text-[11px]">
                                <div>
                                  <span className="text-slate-500 block text-[10px]">ठेव दिनांक:</span>
                                  <strong className="font-mono text-slate-900">{formatDisplayDate(acc.openingDate)}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">मुदतपूर्ती दिनांक:</span>
                                  <strong className="font-mono text-slate-900">{formatDisplayDate(acc.maturityDate)}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">कालावधी:</span>
                                  <strong className="font-mono text-slate-900">
                                    {acc.durationValue
                                      ? `${acc.durationValue} ${acc.durationType === 'Days' ? 'दिवस' : 'महिने'}`
                                      : (acc.durationMonths ? `${acc.durationMonths} महिने` : '-')}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">मुद्दल ठेव रक्कम:</span>
                                  <strong className="font-mono text-emerald-800 font-bold">₹ {fmtCurrency(acc.depositAmount)}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">व्याज दर:</span>
                                  <strong className="font-mono text-slate-900">{acc.interestRate}%</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">मुदतपूर्ती रक्कम:</span>
                                  <strong className="font-mono text-blue-900 font-bold">₹ {fmtCurrency(acc.maturityAmount)}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">वारसदार (Nominee):</span>
                                  <span className="text-slate-800 font-medium truncate block" title={acc.nomineeName || '-'}>
                                    {acc.nomineeName ? `${acc.nomineeName} (${acc.nomineeRelation || '-'})` : '-'}
                                  </span>
                                </div>
                              </div>

                              {/* Lien Warning Banner (if Encumbered) */}
                              {acc.isLienMarked && (
                                <div className="bg-amber-100/80 border-b border-amber-400 p-2 flex items-center justify-between text-amber-950 text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">🔒</span>
                                    <span>
                                      <strong className="font-bold text-amber-900">तारण नोंद (Lien Warning):</strong> सदर मुदत ठेव पावती कर्जासाठी तारण (Lien Marked) ठेवलेली आहे.
                                      {acc.lienLoanAccountNo && (
                                        <span className="ml-1 font-mono font-bold">कर्ज खाते क्र.: {acc.lienLoanAccountNo}</span>
                                      )}
                                      {acc.lienAmount !== undefined && acc.lienAmount > 0 && (
                                        <span className="ml-1 font-mono font-bold">| तारण रक्कम: ₹ {fmtCurrency(acc.lienAmount)}</span>
                                      )}
                                    </span>
                                  </div>
                                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-400">
                                    कर्ज नील झाल्याशिवाय पावती बंद करू नये
                                  </span>
                                </div>
                              )}

                              {/* Double-Entry Ledger Table */}
                              <div className="overflow-x-auto">
                                <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900 text-center">
                                      <th className="border border-slate-900 py-1.5 px-1 w-[4%]">#</th>
                                      <th className="border border-slate-900 py-1.5 px-2 w-[11%]">दिनांक</th>
                                      <th className="border border-slate-900 py-1.5 px-2 w-[13%]">व्हाउचर क्र.</th>
                                      <th className="border border-slate-900 py-1.5 px-2 w-[34%] text-left">तपशील (Narration / Details)</th>
                                      <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right text-rose-900 bg-rose-50/50">
                                        नावे रक्कम Dr (₹)
                                      </th>
                                      <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right text-emerald-900 bg-emerald-50/50">
                                        जमा रक्कम Cr (₹)
                                      </th>
                                      <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-right text-slate-950 bg-slate-100">
                                        शिल्लक रक्कम (₹)
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {((acc.openingBalance ?? 0) > 0 || customerLedger.fromDate) && (
                                      <tr className="bg-slate-100/90 font-bold text-slate-800 text-[11px] italic">
                                        <td className="border border-slate-900 py-1 px-1 text-center font-mono text-slate-500">-</td>
                                        <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                                          {customerLedger.fromDate ? formatDisplayDate(customerLedger.fromDate) : formatDisplayDate(acc.openingDate)}
                                        </td>
                                        <td className="border border-slate-900 py-1 px-2 text-center font-mono text-slate-500">-</td>
                                        <td className="border border-slate-900 py-1 px-2 font-semibold text-slate-700">
                                          मागील शिल्लक (Opening Balance B/F)
                                        </td>
                                        <td className="border border-slate-900 py-1 px-2 text-right font-mono text-slate-400">-</td>
                                        <td className="border border-slate-900 py-1 px-2 text-right font-mono text-slate-400">-</td>
                                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950 bg-slate-200/60">
                                          ₹ {fmtCurrency(acc.openingBalance ?? 0)}
                                        </td>
                                      </tr>
                                    )}

                                    {acc.transactions && acc.transactions.length > 0 ? (
                                      acc.transactions.map((tx, tIdx) => {
                                        const amt = Math.abs(Number(tx.amount || 0));
                                        let dr = Number(tx.debit || 0);
                                        let cr = Number(tx.credit || 0);

                                        if (dr === 0 && cr === 0 && amt > 0) {
                                          const drcr = (tx.debitCredit || '').trim();
                                          const tt = (tx.transactionType || '').toLowerCase();
                                          const vn = (tx.voucherNo || '').toLowerCase();
                                          const isDr = drcr === 'Dr' || tt.includes('close') || tt.includes('payout') || tt.includes('withdraw') || tt.includes('matur') || vn.includes('preclose') || vn.includes('pmt') || vn.includes('clo');
                                          if (isDr) {
                                            dr = amt;
                                          } else {
                                            cr = amt;
                                          }
                                        }

                                        const isDebit = dr > 0;
                                        const isCredit = cr > 0;
                                        const isAccrual = tx.transactionType?.toLowerCase().includes('accrual') || tx.transactionType?.toLowerCase().includes('interest');
                                        const isClosure = tx.transactionType?.toLowerCase().includes('closure') || tx.transactionType?.toLowerCase().includes('payout') || isDebit;

                                        return (
                                          <tr
                                            key={tx.fdTransactionID || tIdx}
                                            className={`text-[11px] hover:bg-slate-50 transition-colors ${
                                              isClosure ? 'bg-rose-50/20' : isAccrual ? 'bg-emerald-50/20' : ''
                                            }`}
                                          >
                                            <td className="border border-slate-900 py-1 px-1 text-center font-mono text-slate-600">
                                              {tIdx + 1}
                                            </td>
                                            <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                                              {formatDisplayDate(tx.transactionDate)}
                                            </td>
                                            <td className="border border-slate-900 py-1 px-2 text-center font-mono font-semibold text-blue-900">
                                              <div>{tx.voucherNo || '-'}</div>
                                              {tx.passingStatus && (
                                                <span
                                                  className={`inline-block mt-0.5 px-1 py-0.2 rounded text-[8.5px] font-bold border ${
                                                    tx.passingStatus === 'Pending'
                                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                  }`}
                                                >
                                                  {tx.passingStatus === 'Pending' ? 'प्रलंबित' : 'मंजूर'}
                                                </span>
                                              )}
                                            </td>
                                            <td className="border border-slate-900 py-1 px-2">
                                              <span className="font-medium text-slate-900">
                                                {formatSafeFdNarration(tx.narration, tx.transactionType, tx.voucherNo, acc.accountNo, acc.legacyAccountNumber)}
                                              </span>
                                            </td>
                                            <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-rose-700 bg-rose-50/20">
                                              {isDebit ? `₹ ${fmtCurrency(dr)}` : <span className="text-slate-300 font-normal">-</span>}
                                            </td>
                                            <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                                              {isCredit ? `₹ ${fmtCurrency(cr)}` : <span className="text-slate-300 font-normal">-</span>}
                                            </td>
                                            <td className="border border-slate-900 py-1 px-2 text-right font-mono font-black text-slate-950 bg-slate-50/50">
                                              ₹ {fmtCurrency(tx.balance)}
                                            </td>
                                          </tr>
                                        );
                                      })
                                    ) : (
                                      <tr>
                                        <td colSpan={7} className="border border-slate-900 p-4 text-center text-slate-500 italic">
                                          निवडलेल्या कालावधीत कोणतेही खातावणी व्यवहार उपलब्ध नाहीत.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>

                                  <tfoot>
                                    <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                                      <td colSpan={4} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                                        कालावधी एकूण बेरीज (Period Total):
                                      </td>
                                      <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-rose-900 bg-rose-100/60">
                                        ₹ {fmtCurrency(acc.periodTotalDebit ?? 0)}
                                      </td>
                                      <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-emerald-900 bg-emerald-100/60">
                                        ₹ {fmtCurrency(acc.periodTotalCredit ?? 0)}
                                      </td>
                                      <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-blue-950 bg-blue-100/60">
                                        ₹ {fmtCurrency(acc.closingBalance ?? (acc.transactions?.slice(-1)[0]?.balance ?? acc.depositAmount))}
                                      </td>
                                    </tr>

                                    <tr className="bg-slate-50 text-[10px] text-slate-700 border-t border-slate-300">
                                      <td colSpan={7} className="py-1 px-3 border border-slate-900">
                                        <span className="font-semibold text-slate-900">ऑडिट ताळमेळ (Audit Balance Equation): </span>
                                        आरंभी शिल्लक: <span className="font-mono font-bold">₹ {fmtCurrency(acc.openingBalance ?? 0)}</span>
                                        {' '}+ एकूण जमा (Cr): <span className="font-mono font-bold text-emerald-700">₹ {fmtCurrency(acc.periodTotalCredit ?? 0)}</span>
                                        {' '}- एकूण नावे (Dr): <span className="font-mono font-bold text-rose-700">₹ {fmtCurrency(acc.periodTotalDebit ?? 0)}</span>
                                        {' '}={' '}
                                        <strong className="text-slate-950">
                                          अंतिम शिल्लक (Closing Balance): <span className="font-mono font-bold text-blue-900">₹ {fmtCurrency(acc.closingBalance ?? 0)}</span>
                                        </strong>
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                  </div>
                );
              })}

              {/* Grand Total Banner when multiple visible schemes are rendered */}
              {ledgerViewData.visibleGroups.length > 1 && (
                <div className="border-2 border-slate-900 bg-slate-100 px-3 py-2 rounded-xs text-xs flex flex-wrap items-center justify-between gap-2 font-bold">
                  <span className="text-slate-950">
                    संपूर्ण ठेव प्रकार महाबेरीज ({ledgerViewData.visibleGroups.length} ठेव प्रकार | {ledgerViewData.summary.accountsCount} खाती):
                  </span>
                  <div className="flex flex-wrap items-center gap-4 font-mono">
                    <span>मुद्दल: ₹ {fmtCurrency(ledgerViewData.summary.totalPrincipal)}</span>
                    <span>आरंभी: ₹ {fmtCurrency(ledgerViewData.summary.totalOpening)}</span>
                    <span className="text-rose-800">नावे: ₹ {fmtCurrency(ledgerViewData.summary.totalDebit)}</span>
                    <span className="text-emerald-800">जमा: ₹ {fmtCurrency(ledgerViewData.summary.totalCredit)}</span>
                    <span className="text-blue-950 text-sm">अखेर शिल्लक: ₹ {fmtCurrency(ledgerViewData.summary.totalClosing)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          VIEW 3: VOUCHER PASSING (६. मुदत ठेव व्हाउचर पासिंग अहवाल)
          ============================================================ */}
      {reportType === 'VoucherPassing' && (
        <div className="overflow-x-auto">
          <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">#</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-center font-mono">व्हाउचर क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center">तारीख</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">व्यवहार प्रकार</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center font-mono">FD पावती क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">खातेदाराचे नाव</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-right font-extrabold">रक्कम (₹)</th>
                <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center font-mono">स्क्रॉल</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[9%] text-center">स्थिती</th>
              </tr>
            </thead>
            <tbody>
              {filteredVoucherPassing.map((v, idx) => (
                <tr key={v.voucherID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-blue-900">{v.voucherNo}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(v.voucherDate)}</td>
                  <td className="border border-slate-900 py-1 px-2">
                    <span className="font-semibold">{v.transactionType}</span>
                    {v.narration && (
                      <span className="block text-[10px] text-slate-500 truncate max-w-[200px]" title={formatSafeFdNarration(v.narration, v.transactionType, v.voucherNo, v.accountNo)}>
                        {formatSafeFdNarration(v.narration, v.transactionType, v.voucherNo, v.accountNo)}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-800">{v.accountNo || '-'}</td>
                  <td className="border border-slate-900 py-1 px-2 font-medium">{v.customerName || '-'}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(v.totalAmount)}</td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono">{v.scrollNo || '-'}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${v.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                      {v.status === 'Approved' ? 'मंजूर' : (v.status === 'Pending' ? 'प्रलंबित' : v.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredVoucherPassing.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={6} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                    एकूण व्हाउचर रक्कम बेरीज (Total):
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                    ₹ {fmtCurrency(totalVoucherPassingSum)}
                  </td>
                  <td colSpan={2} className="border border-slate-900 py-1.5 px-2 text-center"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ============================================================
          VIEW 4: DELETED ENTRIES & ROLLBACK (७. मुदत ठेव रद्द नोंदी व रोलबॅक)
          ============================================================ */}
      {reportType === 'DeletedEntries' && (
        <div className="overflow-x-auto">
          <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">#</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-center">रद्द दिनांक & वेळ</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">रद्द नोंद प्रकार</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-center font-mono">FD पावती क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-center font-mono">व्हाउचर क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right font-extrabold">रक्कम (₹)</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[9%] text-center">रद्दकर्ता</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-center">पावती रोलबॅक</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-left">तपशील / शेरा</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeletedEntries.map((d, idx) => (
                <tr key={d.logID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10px]">{d.deletedDate}</td>
                  <td className="border border-slate-900 py-1 px-2 font-semibold">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${d.typeBadge === 'ठेव अर्ज रद्द' ? 'bg-rose-100 text-rose-800' : 'bg-purple-100 text-purple-800'}`}>
                      {d.deleteType}
                    </span>
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-900">{d.accountNo || '-'}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-blue-900">{d.voucherNo || '-'}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-rose-800">{fmtCurrency(d.amount)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-medium">{d.deletedBy}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center text-[10px]">
                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold ${d.rollbackInfo.includes('-१') ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'}`}>
                      {d.rollbackInfo}
                    </span>
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-[10px] text-slate-600 truncate max-w-[160px]" title={d.reasonOrDetails}>
                    {d.reasonOrDetails}
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredDeletedEntries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={5} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                    एकूण रद्द रक्कम बेरीज (Total):
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-rose-900 bg-rose-100/50">
                    ₹ {fmtCurrency(totalDeletedSum)}
                  </td>
                  <td colSpan={3} className="border border-slate-900 py-1.5 px-2 text-center"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ============================================================
          VIEW 5: MIGRATED FD ACCOUNTS (८. स्थलांतरित मुदत ठेव यादी)
          ============================================================ */}
      {reportType === 'MigratedFD' && (
        <div className="overflow-x-auto">
          <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                <th className="border border-slate-900 py-1.5 px-1 w-[3%] text-center">#</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center font-mono">नवीन पावती</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center font-mono">जुनी पावती</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center font-mono">CIF नं.</th>
                <th className="border border-slate-900 py-1.5 px-3 text-left">खातेदाराचे नाव</th>
                <th className="border border-slate-900 py-1.5 px-2 text-left">योजना</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">ठेव दिनांक</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">कालावधी</th>
                <th className="border border-slate-900 py-1.5 px-2 text-right font-extrabold">ठेव मुद्दल (₹)</th>
                <th className="border border-slate-900 py-1.5 px-1 text-center">व्याज %</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">मुदतपूर्ती दिनांक</th>
                <th className="border border-slate-900 py-1.5 px-2 text-right font-bold">मुदतपूर्ती (₹)</th>
                <th className="border border-slate-900 py-1.5 px-2 text-right font-medium">मागील व्याज (₹)</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">शेवटची व्याज तारीख</th>
                <th className="border border-slate-900 py-1.5 px-2 text-left">वारसदार</th>
                <th className="border border-slate-900 py-1.5 px-1 text-center">स्थिती</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={row.fdAccountID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-primary">{row.accountNo}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-semibold text-amber-900">
                    {row.legacyAccountNumber ? (
                      <span className="bg-amber-50 text-amber-900 px-1 py-0.5 rounded border border-amber-300">
                        {row.legacyAccountNumber}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-blue-900">
                    {row.cifNo || '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-3 text-left font-bold text-slate-950">
                    {row.customerName || row.memberName}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-slate-700">{row.schemeName}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.openingDate)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10px]">
                    {row.durationValue && row.durationValue > 0
                      ? `${row.durationValue} ${row.durationType === 'Days' ? 'दिवस' : row.durationType === 'Years' ? 'वर्षे' : 'महिने'}`
                      : (row.durationInDays && row.durationInDays > 0 ? `${row.durationInDays} दिवस` : '-')}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(row.depositAmount)}</td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono">{row.interestRate}%</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.maturityDate)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-blue-900">{fmtCurrency(row.maturityAmount)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-medium text-amber-800">{fmtCurrency(row.legacyAccruedInt)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10px] text-blue-700">
                    {formatDisplayDate(row.lastInterestPostingDate)}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-left text-[10px]">
                    {row.nomineeName ? (
                      <span>
                        {row.nomineeName} {row.nomineeRelation ? `(${row.nomineeRelation})` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      row.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}>
                      {row.status === 'Active' ? 'Active' : row.status}
                    </span>
                    {row.passingStatus && (
                      <div className="mt-0.5">
                        <span
                          className={`inline-block px-1 py-0.2 rounded text-[8.5px] font-bold border ${
                            row.passingStatus === 'Pending'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}
                          title={row.voucherNo ? `व्हाउचर क्र.: ${row.voucherNo}` : undefined}
                        >
                          {row.passingStatus === 'Pending' ? 'व्हा.प्रलंबित' : 'व्हा.मंजूर'}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={8} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                    {selectedSchemeId > 0 
                      ? `एकूण स्थलांतरित बेरीज (${schemes.find(s => s.fdSchemeID === selectedSchemeId)?.schemeName || 'योजना'} - ${filteredData.length} खाती):`
                      : `एकूण स्थलांतरित बेरीज (${filteredData.length} खाती):`}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                    ₹ {fmtCurrency(totalDepositSum)}
                  </td>
                  <td colSpan={2} className="border border-slate-900 py-1.5 px-2 text-center"></td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-blue-950 bg-blue-100/50">
                    ₹ {fmtCurrency(totalMaturitySum)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-amber-950 bg-amber-100/50">
                    ₹ {fmtCurrency(totalLegacyAccruedSum)}
                  </td>
                  <td colSpan={3} className="border border-slate-900 py-1.5 px-2 text-center"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ============================================================
          VIEW 6: STANDARD FD TABLE (१. नोंदवही, २. बाकी अहवाल, ३. मुदतपूर्ती देय)
          ============================================================ */}
      {reportType !== 'MemberLedger' && reportType !== 'VoucherPassing' && reportType !== 'DeletedEntries' && reportType !== 'MigratedFD' && reportType !== 'CustomerSummary' && (
        <div className="overflow-x-auto">
          <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">#</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">FD पावती क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center font-mono">CIF नं.</th>
                <th className="border border-slate-900 py-1.5 px-3 w-[20%] text-left">खातेदाराचे नाव</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-left">योजना</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[9%] text-center">ठेव दिनांक</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right font-extrabold">ठेव रक्कम (₹)</th>
                {reportType === 'Outstanding' && (
                  <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-right font-extrabold bg-amber-100/70 text-amber-950">
                    मुद्दल + पोस्ट व्याज (₹)
                  </th>
                )}
                <th className="border border-slate-900 py-1.5 px-1 w-[5%] text-center">व्याज %</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[9%] text-center">मुदतपूर्ती दिनांक</th>
                {(reportType === 'Register' || reportType === 'MaturityDue') && (
                  <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right font-bold">मुदतपूर्ती रक्कम (₹)</th>
                )}
                <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center">स्थिती</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={row.fdAccountID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-slate-900">
                    <span className="font-bold text-slate-900">{format14DigitDisplay(row.accountNo)}</span>
                    {row.legacyAccountNumber && (
                      <div className="text-[10px] text-amber-900 font-semibold bg-amber-50 px-1 rounded border border-amber-300 inline-block mt-0.5" title="जुना पावती क्र. (Legacy Receipt No)">
                        जुनी: {row.legacyAccountNumber}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-blue-900">
                    {row.cifNo || '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-3 font-medium">{row.customerName || row.memberName}</td>
                  <td className="border border-slate-900 py-1 px-2 text-slate-700">{row.schemeName}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.openingDate)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(row.depositAmount)}</td>
                  {reportType === 'Outstanding' && (
                    <td className="border border-slate-900 py-1 px-2 text-right font-mono font-black text-amber-950 bg-amber-50/40">
                      <div>₹ {fmtCurrency(row.totalOutstandingWithInterest ?? row.depositAmount)}</div>
                      {row.isInterestCapitalized && (row.postedInterest || 0) > 0 ? (
                        <div className="text-[9px] font-normal text-emerald-700">
                          (+₹{fmtCurrency(row.postedInterest)} व्याज)
                        </div>
                      ) : (
                        <div className="text-[9px] font-normal text-slate-400">
                          {row.isInterestCapitalized ? '(व्याज निरंक)' : '(परतावा योजना)'}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono">{row.interestRate}%</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.maturityDate)}</td>
                  {(reportType === 'Register' || reportType === 'MaturityDue') && (
                    <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-blue-900">
                      {fmtCurrency(row.maturityAmount)}
                    </td>
                  )}
                  <td className="border border-slate-900 py-1 px-1 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      row.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}>
                      {row.status === 'Active' ? 'Active' : row.status}
                    </span>
                    {row.passingStatus && (
                      <div className="mt-0.5">
                        <span
                          className={`inline-block px-1 py-0.2 rounded text-[8.5px] font-bold border ${
                            row.passingStatus === 'Pending'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}
                          title={row.voucherNo ? `व्हाउचर क्र.: ${row.voucherNo}` : undefined}
                        >
                          {row.passingStatus === 'Pending' ? 'व्हा.प्रलंबित' : 'व्हा.मंजूर'}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={6} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                    {selectedSchemeId > 0 
                      ? `एकूण मुदत ठेव बेरीज (${schemes.find(s => s.fdSchemeID === selectedSchemeId)?.schemeName || 'निवडलेली योजना'} - ${filteredData.length} खाती):`
                      : `एकूण मुदत ठेव बेरीज (सर्व योजना - ${filteredData.length} खाती):`}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                    ₹ {fmtCurrency(totalDepositSum)}
                  </td>
                  {reportType === 'Outstanding' && (
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-amber-950 bg-amber-100/70">
                      ₹ {fmtCurrency(totalOutstandingWithInterestSum)}
                    </td>
                  )}
                  <td colSpan={2} className="border border-slate-900 py-1.5 px-2 text-center"></td>
                  {(reportType === 'Register' || reportType === 'MaturityDue') && (
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-blue-950 bg-blue-100/50">
                      ₹ {fmtCurrency(totalMaturitySum)}
                    </td>
                  )}
                  <td className="border border-slate-900 py-1.5 px-2 text-center"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </CbsReportLayout>
  );
}
