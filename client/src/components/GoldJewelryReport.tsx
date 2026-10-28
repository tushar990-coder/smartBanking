import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Search,
  RefreshCw,
  Receipt,
  PlusCircle,
  AlertTriangle,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CbsReportLayout, { formatDisplayDate } from './common/CbsReportLayout';
import GoldLoanReceiptPrintModal, { GoldLoanReceiptData } from './GoldLoanReceiptPrintModal';
import { useAuth } from '../context/AuthContext';

export interface GoldJewelryItem {
  srNo: number;
  goldLoanDetailID: number;
  loanAccountID: number;
  loanAccountNo: string;
  legacyAccountNumber?: string | null;
  applicationNo?: string | null;
  loanApplicationID?: number;
  customerID?: number;
  cifNo?: string;
  memberID: number;
  memberCode: string;
  borrowerName: string;
  customerMobile?: string;
  customerAddress?: string;
  branchName?: string;
  loanRateName?: string;
  interestRate?: number;
  durationMonths?: number;
  ornamentName: string;
  estimatedValue: number;
  netWeight: number;
  grossWeight: number;
  quantity: number;
  purity: number;
  goldRatePerGram: number;
  valuerName?: string | null;
  valuerValuation?: number;
  valuationReceiptNo?: string | null;
  valuationDate?: string | null;
  imagePath?: string | null;
  remarks?: string | null;
  securityDetails?: string | null;
  securityValue?: number;
  isCollateralDetailPending?: boolean;
  voucherStatus?: string | null;
  loanStatus: string;
  sanctionedAmount: number;
  principalBalance: number;
  loanDisbursementDate?: string;
}

export interface GoldJewelryReportResponse {
  sansthaInfo: any;
  reportDate: string;
  branchName: string;
  items: GoldJewelryItem[];
  totalEstimatedValue: number;
  totalValuerValuation?: number;
  totalNetWeight: number;
  totalGrossWeight: number;
  totalQuantity: number;
  totalAccountsCount: number;
  pendingCollateralAccountsCount?: number;
  totalSanctionedAmount?: number;
  totalPrincipalBalance?: number;
}

interface GoldJewelryReportProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const toMarathiDigits = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  const marathiDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return str.replace(/[0-9]/g, d => marathiDigits[parseInt(d, 10)]);
};

const fmtCurrency = (n: number | null | undefined, isMarathi: boolean = false) => {
  const formatted = (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return isMarathi ? toMarathiDigits(formatted) : formatted;
};

const fmtWeight = (n: number | null | undefined, isMarathi: boolean = false) => {
  const formatted = (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
  return isMarathi ? toMarathiDigits(formatted) : formatted;
};

const hasGoldKeyword = (txt?: string | null): boolean => {
  if (!txt) return false;
  const t = txt.toLowerCase();
  return (
    t.includes('gold') ||
    t.includes('सोने') ||
    t.includes('सोन्या') ||
    t.includes('सुवर्ण') ||
    t.includes('दागिन') ||
    t.includes('अलंकार') ||
    t.includes('ornament') ||
    t.includes('jewel')
  );
};

const getSmartInitialAsOfDate = (businessDate?: string): string => {
  const today = new Date().toISOString().split('T')[0];
  const bDate = businessDate ? businessDate.split('T')[0] : '';
  if (bDate && bDate > today) return bDate;
  return today;
};

export default function GoldJewelryReport({ onNavigate }: GoldJewelryReportProps = {}) {
  const { user } = useAuth();

  const [reportData, setReportData] = useState<GoldJewelryReportResponse | null>(null);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loanAccounts, setLoanAccounts] = useState<any[]>([]);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';

  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [detailFilter, setDetailFilter] = useState<'all' | 'recorded' | 'pending'>('all');
  const [asOfDate, setAsOfDate] = useState<string>(() => getSmartInitialAsOfDate(user?.businessDate));
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [digitMode, setDigitMode] = useState<'marathi' | 'english'>('marathi');
  const [signatureTier, setSignatureTier] = useState<'3-tier' | '4-tier'>('3-tier');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [receiptModalData, setReceiptModalData] = useState<GoldLoanReceiptData | null>(null);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<string | null>(null);

  const isMarathi = digitMode === 'marathi';
  const d = (val: string | number | null | undefined) => (isMarathi ? toMarathiDigits(val) : String(val ?? ''));

  useEffect(() => {
    if (user?.businessDate) {
      const bDate = user.businessDate.split('T')[0];
      if (asOfDate && bDate > asOfDate) {
        setAsOfDate(bDate);
      }
    }
  }, [user?.businessDate]);

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    handleFetchReport();
  }, [selectedBranchId, selectedLoanId, statusFilter, asOfDate]);

  const fetchMasters = async () => {
    try {
      const [sansthaRes, branchRes, loansRes] = await Promise.allSettled([
        axios.get('/api/SansthaDetails'),
        axios.get('/api/Branches'),
        axios.get('/api/LoanAccounts')
      ]);

      if (sansthaRes.status === 'fulfilled' && sansthaRes.value.data) {
        const sData = sansthaRes.value.data;
        setSansthaDetail(Array.isArray(sData) ? sData[0] : sData);
      }
      if (branchRes.status === 'fulfilled' && Array.isArray(branchRes.value.data)) {
        setBranches(branchRes.value.data);
      }
      if (loansRes.status === 'fulfilled' && Array.isArray(loansRes.value.data)) {
        setLoanAccounts(loansRes.value.data);
      }
    } catch (err) {
      console.error('Error loading masters for GoldJewelryReport:', err);
    }
  };

  // Filter dropdown accounts strictly to Gold Loan accounts (+ branch filter) with CustomerID-first display
  const goldLoanDropdownOptions = useMemo(() => {
    return loanAccounts.filter((l: any) => {
      if (selectedBranchId && selectedBranchId !== 'all' && String(l.branchID) !== selectedBranchId) {
        return false;
      }
      return (
        l.loanRate?.collateralCategory?.toLowerCase() === 'gold' ||
        hasGoldKeyword(l.loanRate?.loanType) ||
        hasGoldKeyword(l.loanRate?.shortName) ||
        hasGoldKeyword(l.loanRate?.securityType) ||
        hasGoldKeyword(l.loanType) ||
        hasGoldKeyword(l.securityDetails)
      );
    });
  }, [loanAccounts, selectedBranchId]);

  const handleFetchReport = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (selectedBranchId && selectedBranchId !== 'all') {
        params.branchId = parseInt(selectedBranchId, 10);
      }
      if (selectedLoanId) {
        params.loanAccountId = parseInt(selectedLoanId, 10);
      }
      if (statusFilter) {
        params.status = statusFilter;
      }
      if (asOfDate) {
        params.asOfDate = asOfDate;
      }

      const res = await axios.get<GoldJewelryReportResponse>('/api/Reports/GoldJewelryReport', { params });
      if (res.data) {
        setReportData(res.data);
        if (res.data.sansthaInfo) {
          setSansthaDetail(res.data.sansthaInfo);
        }
      }
    } catch (err) {
      console.error('Error fetching Gold Jewelry report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigateToAddGold = (item: GoldJewelryItem) => {
    if (item.loanAccountID > 0) {
      sessionStorage.setItem('cbs_target_gold_loan_id', String(item.loanAccountID));
      if (onNavigate) {
        onNavigate('gold-loan-details', { loanAccountId: item.loanAccountID });
      } else {
        window.location.href = `/?tab=gold-loan-details&loanAccountId=${item.loanAccountID}`;
      }
    } else if (item.loanApplicationID && onNavigate) {
      onNavigate('loan-process', { applicationId: item.loanApplicationID });
    }
  };

  const handleOpenReceipt = (targetItem: GoldJewelryItem) => {
    const accItems = (reportData?.items || []).filter(
      i =>
        !i.isCollateralDetailPending &&
        ((targetItem.loanAccountID > 0 && i.loanAccountID === targetItem.loanAccountID) ||
          (targetItem.loanAccountNo && i.loanAccountNo === targetItem.loanAccountNo) ||
          (targetItem.loanApplicationID && i.loanApplicationID === targetItem.loanApplicationID))
    );

    const targetList = accItems.length > 0 ? accItems : [targetItem];

    const receiptData: GoldLoanReceiptData = {
      receiptNo:
        targetItem.valuationReceiptNo ||
        `GLR-${new Date().getFullYear()}-${String(targetItem.loanAccountID || targetItem.goldLoanDetailID || '001').padStart(4, '0')}`,
      receiptDate: targetItem.valuationDate || targetItem.loanDisbursementDate || asOfDate || new Date().toISOString().split('T')[0],
      loanAccountNo: targetItem.loanAccountNo,
      applicationNo: targetItem.applicationNo || (targetItem.loanApplicationID ? String(targetItem.loanApplicationID) : undefined),
      loanAccountID: targetItem.loanAccountID,
      loanApplicationID: targetItem.loanApplicationID,
      borrowerName: targetItem.borrowerName,
      cifNo: targetItem.cifNo,
      memberCode: targetItem.memberCode,
      mobileNo: targetItem.customerMobile,
      address: targetItem.customerAddress,
      loanSchemeName: targetItem.loanRateName || 'सुवर्ण तारण कर्ज',
      sanctionedAmount: targetItem.sanctionedAmount,
      interestRate: targetItem.interestRate,
      durationMonths: targetItem.durationMonths,
      valuerName: targetItem.valuerName || undefined,
      valuationReceiptNo: targetItem.valuationReceiptNo || undefined,
      valuationDate: targetItem.valuationDate || undefined,
      items: targetList.map((it, idx) => ({
        srNo: idx + 1,
        ornamentName: it.ornamentName,
        quantity: it.quantity || 1,
        grossWeight: it.grossWeight,
        netWeight: it.netWeight,
        purity: it.purity ? `${it.purity}K` : '-',
        goldRatePerGram: it.goldRatePerGram,
        estimatedValue: it.estimatedValue,
        valuerValuation: it.valuerValuation || it.securityValue || 0,
        valuerName: it.valuerName,
        valuationReceiptNo: it.valuationReceiptNo,
        valuationDate: it.valuationDate,
        imagePath: it.imagePath,
        remarks: it.remarks
      })),
      branchName: targetItem.branchName || reportData?.branchName || sansthaDetail?.branchName || 'मुख्य शाखा',
      sansthaInfo: reportData?.sansthaInfo || sansthaDetail
    };

    document.body.classList.remove(
      'cbs-print-a4-portrait',
      'cbs-print-a4-landscape',
      'cbs-print-legal-landscape',
      'cbs-print-a5-portrait'
    );
    setReceiptModalData(receiptData);
  };

  const filteredItems = useMemo(() => {
    return (reportData?.items || []).filter(item => {
      if (detailFilter === 'recorded' && item.isCollateralDetailPending) return false;
      if (detailFilter === 'pending' && !item.isCollateralDetailPending) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        (item.loanAccountNo || '').toLowerCase().includes(term) ||
        (item.legacyAccountNumber || '').toLowerCase().includes(term) ||
        (item.borrowerName || '').toLowerCase().includes(term) ||
        (item.ornamentName || '').toLowerCase().includes(term) ||
        (item.cifNo || '').toLowerCase().includes(term) ||
        (item.memberCode || '').toLowerCase().includes(term) ||
        (item.valuerName && item.valuerName.toLowerCase().includes(term)) ||
        (item.valuationReceiptNo && item.valuationReceiptNo.toLowerCase().includes(term)) ||
        (item.customerMobile && item.customerMobile.includes(term))
      );
    });
  }, [reportData?.items, detailFilter, searchTerm]);

  // Compute deduplicated account metrics & ornament totals across filteredItems
  const metrics = useMemo(() => {
    const accountMap = new Map<string, { sanctioned: number; balance: number; isPending: boolean }>();
    let estVal = 0;
    let valuerVal = 0;
    let netWt = 0;
    let grossWt = 0;
    let qty = 0;
    let recordedOrnamentsCount = 0;

    filteredItems.forEach((item, index) => {
      const key = item.loanAccountID > 0 ? `ACC_${item.loanAccountID}` : `APP_${item.loanApplicationID || index}`;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          sanctioned: item.sanctionedAmount || 0,
          balance: item.principalBalance || 0,
          isPending: Boolean(item.isCollateralDetailPending)
        });
      }

      if (!item.isCollateralDetailPending) {
        recordedOrnamentsCount += 1;
      }
      estVal += item.estimatedValue || 0;
      valuerVal += item.valuerValuation || item.securityValue || item.estimatedValue || 0;
      netWt += item.netWeight || 0;
      grossWt += item.grossWeight || 0;
      qty += item.quantity || 0;
    });

    let totalSanctioned = 0;
    let totalBalance = 0;
    let pendingAccCount = 0;
    accountMap.forEach(v => {
      totalSanctioned += v.sanctioned;
      totalBalance += v.balance;
      if (v.isPending) pendingAccCount += 1;
    });

    return {
      uniqueAccountsCount: accountMap.size,
      pendingAccountsCount: pendingAccCount,
      recordedOrnamentsCount,
      totalEstimatedValue: estVal,
      totalValuerValue: valuerVal,
      totalNetWeight: netWt,
      totalGrossWeight: grossWt,
      totalQuantity: qty,
      totalSanctioned,
      totalPrincipalBalance: totalBalance
    };
  }, [filteredItems]);

  const handleExportExcel = () => {
    if (!filteredItems || filteredItems.length === 0) {
      alert('एक्सेलमध्ये एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
      return;
    }

    const seenAccKeys = new Set<string>();
    const excelRows = filteredItems.map((item, idx) => {
      const accKey = item.loanAccountID > 0 ? `ACC_${item.loanAccountID}` : `APP_${item.loanApplicationID || idx}`;
      const isFirstRowForAccount = !seenAccKeys.has(accKey);
      seenAccKeys.add(accKey);

      return {
        'अ.क्र.': idx + 1,
        'कर्ज खाते क्र.': item.loanAccountNo,
        'जुना खाते क्र.': item.legacyAccountNumber || '',
        'वाटप दिनांक': item.loanDisbursementDate ? formatDisplayDate(item.loanDisbursementDate) : '',
        'सीआयएफ (CIF)': item.cifNo || item.memberCode || '',
        'कर्जदाराचे नाव': item.borrowerName,
        'मोबाईल नं': item.customerMobile || '',
        'मंजूर कर्ज (₹)': isFirstRowForAccount ? item.sanctionedAmount : ('' as any),
        'येणे मुद्दल बाकी (₹)': isFirstRowForAccount ? item.principalBalance : ('' as any),
        'सोने जिन्नस तपशील': item.ornamentName,
        'दागिना नोंद स्थिती': item.isCollateralDetailPending ? 'सारांश नोंद / सुट्टे दागिने बाकी' : 'नोंद पूर्ण',
        'नग': item.quantity || 0,
        'ग्रॉस वजन (ग्रॅम)': item.grossWeight || 0,
        'शुध्द वजन (ग्रॅम)': item.netWeight || 0,
        'शुद्धता (Karat)': !item.purity ? '' : `${item.purity}K`,
        'प्रति ग्रॅम दर (₹)': item.goldRatePerGram || 0,
        'सिस्टीम किंमत (₹)': item.estimatedValue || 0,
        'सोनार मूल्यांकन (₹)': item.valuerValuation || item.securityValue || item.estimatedValue || 0,
        'सोनाराचे नाव': item.valuerName || '',
        'व्हॅल्युएशन पावती क्र': item.valuationReceiptNo || '',
        'मूल्यांकन दिनांक': item.valuationDate ? formatDisplayDate(item.valuationDate) : '',
        'शेरा': item.remarks || '',
        'कर्ज स्थिती':
          item.loanStatus === 'Active'
            ? (item.voucherStatus === 'Pending' ? 'चालू (व्हाउचर प्रलंबित)' : 'चालू')
            : item.loanStatus === 'Pending Disbursement'
              ? 'वाटप बाकी'
              : 'बंद'
      };
    });

    excelRows.push({
      'अ.क्र.': '' as any,
      'कर्ज खाते क्र.': '',
      'जुना खाते क्र.': '',
      'वाटप दिनांक': '',
      'सीआयएफ (CIF)': '',
      'कर्जदाराचे नाव': 'एकूण (Grand Total):',
      'मोबाईल नं': `खाती: ${metrics.uniqueAccountsCount}`,
      'मंजूर कर्ज (₹)': metrics.totalSanctioned,
      'येणे मुद्दल बाकी (₹)': metrics.totalPrincipalBalance,
      'सोने जिन्नस तपशील': `नोंदवलेले जिन्नस: ${metrics.recordedOrnamentsCount}`,
      'दागिना नोंद स्थिती': metrics.pendingAccountsCount > 0 ? `${metrics.pendingAccountsCount} खाती तपशील बाकी` : 'पूर्ण',
      'नग': metrics.totalQuantity,
      'ग्रॉस वजन (ग्रॅम)': metrics.totalGrossWeight,
      'शुध्द वजन (ग्रॅम)': metrics.totalNetWeight,
      'शुद्धता (Karat)': '',
      'प्रति ग्रॅम दर (₹)': '' as any,
      'सिस्टीम किंमत (₹)': metrics.totalEstimatedValue,
      'सोनार मूल्यांकन (₹)': metrics.totalValuerValue,
      'सोनाराचे नाव': '',
      'व्हॅल्युएशन पावती क्र': '',
      'मूल्यांकन दिनांक': '',
      'शेरा': '',
      'कर्ज स्थिती': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'सोने जिन्नस यादी');

    const fileName = `Sone_Jinnas_Yadi_${asOfDate || new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const activeSanstha = reportData?.sansthaInfo || sansthaDetail;
  const resolvedBranchName = useMemo(() => {
    if (reportData?.branchName) return reportData.branchName;
    if (selectedBranchId === 'all') return 'सर्व शाखा';
    const b = branches.find(br => String(br.branchID) === selectedBranchId);
    return b?.branchName || 'मुख्य शाखा';
  }, [reportData?.branchName, selectedBranchId, branches]);

  const preparedByText = user?.username
    ? `${user.username}${user.roleName || user.role ? ` (${user.roleName || user.role})` : ''}`
    : 'Admin';

  const summaryBanner = (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center text-xs">
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण सोनेतारण खाती</span>
        <strong className="text-primary font-mono text-[11.5px]">
          {d(metrics.uniqueAccountsCount)} खाती
          {metrics.pendingAccountsCount > 0 && (
            <span className="text-amber-700 font-normal text-[10px] ml-1">
              ({d(metrics.pendingAccountsCount)} तपशील बाकी)
            </span>
          )}
        </strong>
      </div>

      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">नोंदवलेले जिन्नस / नग</span>
        <strong className="text-slate-900 font-mono text-[11.5px]">
          {d(metrics.recordedOrnamentsCount)} जिन्नस ({d(metrics.totalQuantity)} नग)
        </strong>
      </div>

      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">ग्रॉस / शुद्ध वजन</span>
        <strong className="text-slate-900 font-mono text-[11.5px]">
          {fmtWeight(metrics.totalGrossWeight, isMarathi)}g / <span className="text-amber-900">{fmtWeight(metrics.totalNetWeight, isMarathi)}g</span>
        </strong>
      </div>

      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सोनार / सिस्टीम मूल्यांकन</span>
        <strong className="text-emerald-700 font-mono text-[11.5px]">
          ₹ {fmtCurrency(metrics.totalValuerValue > 0 ? metrics.totalValuerValue : metrics.totalEstimatedValue, isMarathi)}
        </strong>
      </div>

      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण मंजूर कर्ज / मुद्दल बाकी</span>
        <strong className="text-slate-950 font-mono text-[11.5px]">
          ₹ {fmtCurrency(metrics.totalPrincipalBalance, isMarathi)}
        </strong>
      </div>
    </div>
  );

  const filterControls = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* Branch */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">शाखा:</label>
        <select
          value={selectedBranchId}
          onChange={e => {
            setSelectedBranchId(e.target.value);
            setSelectedLoanId('');
          }}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800 w-24 sm:w-28"
        >
          <option value="all">सर्व शाखा</option>
          {branches.map((b: any) => (
            <option key={b.branchID} value={b.branchID.toString()}>
              {b.branchName}
            </option>
          ))}
        </select>
      </div>

      {/* Gold Loan Account */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">खाते:</label>
        <select
          value={selectedLoanId}
          onChange={e => setSelectedLoanId(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800 w-32 sm:w-44"
        >
          <option value="">सर्व सोनेतारण खाती</option>
          {goldLoanDropdownOptions.map((l: any) => {
            const cust = l.customer || l.member?.customer || l.member;
            const fullName = cust
              ? `${cust.firstName || ''} ${cust.middleName || ''} ${cust.lastName || ''}`.trim().replace(/\s+/g, ' ')
              : '';
            const cif = l.customer?.cifNo || l.member?.customer?.cifNo || l.member?.memberCode || '';
            return (
              <option key={l.loanAccountID} value={l.loanAccountID.toString()}>
                {l.loanAccountNo} - {cif ? `${cif} ` : ''}{fullName || `ID:${l.loanAccountID}`}
              </option>
            );
          })}
        </select>
      </div>

      {/* Loan Status */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">स्थिती:</label>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800 w-20 sm:w-24"
        >
          <option value="Active">चालू</option>
          <option value="Closed">बंद</option>
          <option value="All">सर्व</option>
        </select>
      </div>

      {/* Ornament Detail Status */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">तपशील:</label>
        <select
          value={detailFilter}
          onChange={e => setDetailFilter(e.target.value as 'all' | 'recorded' | 'pending')}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800 w-28"
        >
          <option value="all">सर्व सोनेतारण</option>
          <option value="recorded">दागिने नोंदवलेली</option>
          <option value="pending">तपशील भरणे बाकी</option>
        </select>
      </div>

      {/* As-Of Date */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">दिनांक:</label>
        <div className="inline-flex items-center">
          <input
            type="date"
            value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)}
            title="निवडलेल्या तारखेअखेरचा अहवाल (सर्व तारखांसाठी बाजूचे ✕ बटण दाबा)"
            className={`h-6 border border-slate-300 px-1 text-[10.5px] bg-white text-slate-800 w-28 ${
              asOfDate ? 'rounded-l border-r-0' : 'rounded'
            }`}
          />
          {asOfDate && (
            <button
              type="button"
              onClick={() => setAsOfDate('')}
              title="तारीख फिल्टर काढा (सर्व तारखांच्या नोंदी पहा)"
              className="h-6 px-1.5 border border-slate-300 rounded-r bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 flex items-center justify-center cursor-pointer"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative w-36 sm:w-44">
        <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="खाते, नाव, दागिना शोधा..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-5 pr-1.5 h-6 border border-slate-300 rounded text-[10.5px] bg-white text-slate-800 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Digit Mode */}
      <select
        value={digitMode}
        onChange={e => setDigitMode(e.target.value as 'marathi' | 'english')}
        title="अंक भाषा निवडा"
        className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800"
      >
        <option value="marathi">मराठी १,२,३</option>
        <option value="english">Eng 1,2,3</option>
      </select>

      {/* Signature Tier Selector (Matching CbsSampleReport.tsx) */}
      <select
        value={signatureTier}
        onChange={e => setSignatureTier(e.target.value as '3-tier' | '4-tier')}
        title="स्वाक्षरी स्तर निवडा"
        className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800"
      >
        <option value="3-tier">३-स्तरीय स्वाक्षरी</option>
        <option value="4-tier">४-स्तरीय स्वाक्षरी</option>
      </select>

      {/* Refresh Button */}
      <button
        type="button"
        onClick={handleFetchReport}
        disabled={isLoading}
        className="h-6 bg-primary hover:opacity-90 text-white px-2 rounded text-[10.5px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        {isLoading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
        <span>पहा</span>
      </button>

      {/* Direct A4 Pledge Receipt Button when single account is selected */}
      {selectedLoanId && filteredItems.length > 0 && (
        <button
          type="button"
          onClick={() => handleOpenReceipt(filteredItems[0])}
          className="h-6 bg-amber-600 hover:bg-amber-700 text-white px-2 rounded text-[10.5px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer"
          title="निवडलेल्या खात्याची सुवर्ण तारण पावती प्रिंट करा"
        >
          <Receipt size={11} />
          <span>पावती</span>
        </button>
      )}
    </div>
  );

  // Track seen accounts during row render so Sanctioned / Balance amounts are displayed once per account
  const renderedAccountKeys = new Set<string>();

  return (
    <>
      <div className={receiptModalData ? 'no-print' : ''}>
        <CbsReportLayout
          defaultPaperSize="a4-landscape"
        allowPaperSizeToggle={true}
        reportTitle="सोने जिन्नस यादी"
        reportSubtitle="Gold Jewelry / Collateral Pledge Register"
        periodText={asOfDate ? `दिनांक ${d(formatDisplayDate(asOfDate))} अखेर` : 'सर्व नोंदी (आजअखेर)'}
        branchName={resolvedBranchName}
        sansthaInfo={activeSanstha}
        summaryBanner={summaryBanner}
        signatureTier={signatureTier}
        signatureTitles={
          signatureTier === '4-tier'
            ? [
                { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
                { title: 'सुवर्णकार / व्हॅल्यूअर', subtitle: '(Goldsmith / Valuer)' },
                { title: 'व्यवस्थापक / सचिव', subtitle: '(Manager / Secretary)' },
                { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Board of Directors)' }
              ]
            : [
                { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
                { title: 'सुवर्णकार / व्हॅल्यूअर', subtitle: '(Goldsmith / Valuer)' },
                { title: 'व्यवस्थापक / सचिव', subtitle: '(Manager / Secretary)' }
              ]
        }
        onExportExcel={handleExportExcel}
        extraToolbarControls={filterControls}
        isLoading={isLoading}
        hasData={true}
        preparedBy={preparedByText}
      >
        <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
              <th className="border border-slate-900 py-1.5 px-1 w-[3.5%] text-center">अ.क्र.</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[12%] text-center">कर्ज खाते क्र. व दि.</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">कर्जदाराचे नाव</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[11%] text-right">मंजूर कर्ज / बाकी (₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">सोने जिन्नस / दागिना तपशील</th>
              <th className="border border-slate-900 py-1.5 px-1 w-[3.5%] text-center">नग</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[6.5%] text-right">ग्रॉस वजन (g)</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[6.5%] text-right">शुद्ध वजन (g)</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-right">सिस्टीम किंमत (₹)</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[8.5%] text-right font-extrabold">सोनार मूल्यांकन (₹)</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[8.5%] text-left">सोनार / पावती क्र.</th>
              <th className="border border-slate-900 py-1.5 px-1 text-center no-print print:hidden">कृती</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={12} className="border border-slate-900 py-8 text-center text-slate-500 font-semibold">
                  सोने जिन्नस यादी लोड होत आहे, कृपया प्रतीक्षा करा...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={12} className="border border-slate-900 py-8 text-center text-slate-500 font-semibold">
                  निवडलेल्या कालावधीत व निकषांनुसार सोने जिन्नस / सोनेतारण नोंदी आढळल्या नाहीत.
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                const accKey = item.loanAccountID > 0
                  ? `ACC_${item.loanAccountID}`
                  : `APP_${item.loanApplicationID || idx}`;
                const isFirstForAccount = !renderedAccountKeys.has(accKey);
                renderedAccountKeys.add(accKey);

                const isPendingDetail = Boolean(item.isCollateralDetailPending);

                return (
                  <tr
                    key={`${accKey}_${item.goldLoanDetailID || idx}`}
                    className={`hover:bg-slate-50 text-slate-900 text-[11px] ${
                      isPendingDetail ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    {/* 1. Sr. No. */}
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                      {d(idx + 1)}
                    </td>

                    {/* 2. Loan Account No & Date */}
                    <td className="border border-slate-900 py-1 px-1.5 text-center">
                      <div className="font-mono font-bold text-slate-900 leading-tight">
                        {d(item.loanAccountNo)}
                      </div>
                      {item.legacyAccountNumber && (
                        <div className="text-[9.5px] text-slate-600 font-mono">
                          (जुना: {d(item.legacyAccountNumber)})
                        </div>
                      )}
                      {item.loanDisbursementDate && (
                        <div className="text-[9.5px] text-slate-500 font-mono">
                          दि. {d(formatDisplayDate(item.loanDisbursementDate))}
                        </div>
                      )}
                      {item.voucherStatus === 'Pending' && (
                        <span className="inline-block mt-0.5 px-1 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[8.5px] font-bold">
                          व्हाउचर प्रलंबित
                        </span>
                      )}
                      {item.voucherStatus === 'PendingDisbursement' && (
                        <span className="inline-block mt-0.5 px-1 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[8.5px] font-bold">
                          वाटप बाकी
                        </span>
                      )}
                    </td>

                    {/* 3. Borrower Name & Mobile */}
                    <td className="border border-slate-900 py-1 px-2">
                      <div className="font-semibold text-slate-900 leading-snug">
                        {item.borrowerName}
                      </div>
                      <div className="text-[9.5px] text-slate-500 flex flex-wrap items-center gap-x-2">
                        {item.loanRateName && <span>{item.loanRateName}</span>}
                        {item.customerMobile && (
                          <span className="font-mono">मो. {d(item.customerMobile)}</span>
                        )}
                      </div>
                    </td>

                    {/* 4. Sanctioned Amount & Principal Balance (Deduplicated per Account) */}
                    <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell">
                      {isFirstForAccount ? (
                        <div className="leading-tight">
                          <div className="text-[9.5px] text-slate-500">
                            मंजूर: {fmtCurrency(item.sanctionedAmount, isMarathi)}
                          </div>
                          <div className="font-bold text-slate-950">
                            {fmtCurrency(item.principalBalance, isMarathi)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[9.5px] text-slate-400 italic font-sans">
                          — वरील खात्याप्रमाणे —
                        </span>
                      )}
                    </td>

                    {/* 5. Ornament Description */}
                    <td className="border border-slate-900 py-1 px-2">
                      {isPendingDetail ? (
                        <div className="space-y-0.5">
                          <div className="text-slate-800 font-medium leading-snug">
                            {item.securityDetails || item.ornamentName || 'सोने तारण कर्ज खाते'}
                          </div>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100/90 text-amber-950 border border-amber-300 text-[9px] font-bold">
                            <AlertTriangle size={9} />
                            <span>
                              {item.netWeight > 0 || (item.securityValue && item.securityValue > 0)
                                ? 'सारांश नोंद (सुट्टे दागिने जोडणे बाकी)'
                                : 'दागिन्यांचा तपशील भरणे बाकी'}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-900">
                            {item.ornamentName || 'सोने दागिना'}
                            {item.purity > 0 && (
                              <span className="ml-1 text-[10px] text-amber-800 font-mono font-bold">
                                ({d(item.purity)}K)
                              </span>
                            )}
                          </div>
                          {item.remarks && (
                            <div className="text-[9.5px] text-slate-500 leading-tight">{item.remarks}</div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 6. Quantity */}
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono font-semibold">
                      {isPendingDetail ? (item.quantity > 0 ? d(item.quantity) : '-') : d(item.quantity || 1)}
                    </td>

                    {/* 7. Gross Weight */}
                    <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell font-mono">
                      {isPendingDetail
                        ? item.grossWeight > 0
                          ? fmtWeight(item.grossWeight, isMarathi)
                          : '-'
                        : fmtWeight(item.grossWeight, isMarathi)}
                    </td>

                    {/* 8. Net Weight */}
                    <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell font-mono font-semibold text-slate-950">
                      {isPendingDetail
                        ? item.netWeight > 0
                          ? fmtWeight(item.netWeight, isMarathi)
                          : '-'
                        : fmtWeight(item.netWeight, isMarathi)}
                    </td>

                    {/* 9. System Valuation */}
                    <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell cbs-amt-bal">
                      {isPendingDetail
                        ? item.estimatedValue > 0
                          ? fmtCurrency(item.estimatedValue, isMarathi)
                          : '-'
                        : fmtCurrency(item.estimatedValue, isMarathi)}
                    </td>

                    {/* 10. Goldsmith Valuation */}
                    <td className="border border-slate-900 py-1 px-1.5 cbs-num-cell cbs-amt-cr font-bold">
                      {isPendingDetail ? (
                        (item.valuerValuation || item.securityValue || 0) > 0 ? (
                          <span className="text-amber-950 font-bold" title="कर्ज खात्यावरील तारण मूल्यांकन रक्कम">
                            {fmtCurrency(item.valuerValuation || item.securityValue || 0, isMarathi)}
                          </span>
                        ) : (
                          '-'
                        )
                      ) : item.valuerValuation ? (
                        fmtCurrency(item.valuerValuation, isMarathi)
                      ) : (
                        fmtCurrency(item.estimatedValue, isMarathi)
                      )}
                    </td>

                    {/* 11. Goldsmith / Receipt No */}
                    <td className="border border-slate-900 py-1 px-1.5 text-[10px]">
                      {item.valuerName ? (
                        <div className="leading-tight">
                          <span className="font-semibold text-slate-900 block">{item.valuerName}</span>
                          {item.valuationReceiptNo && (
                            <span className="text-slate-600 font-mono block">
                              पावती: {d(item.valuationReceiptNo)}
                            </span>
                          )}
                          {item.valuationDate && (
                            <span className="text-slate-500 font-mono text-[9px] block">
                              दि. {d(formatDisplayDate(item.valuationDate))}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* 12. Screen-only Actions (Hidden on Print) */}
                    <td className="border border-slate-900 py-1 px-1 text-center no-print print:hidden">
                      <div className="flex flex-col items-center justify-center gap-1">
                        {item.imagePath && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoModal(item.imagePath || null)}
                            className="inline-block p-0.5 border border-amber-300 rounded hover:border-amber-600 cursor-pointer"
                            title="दागिन्याचा फोटो मोठा करून पहा"
                          >
                            <img src={item.imagePath} alt="Gold" className="w-5 h-5 object-cover rounded-xs" />
                          </button>
                        )}

                        {isPendingDetail ? (
                          (item.loanAccountID > 0 || (item.loanApplicationID && item.loanApplicationID > 0)) && (
                            <button
                              type="button"
                              onClick={() => handleNavigateToAddGold(item)}
                              className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9.5px] font-bold cursor-pointer inline-flex items-center gap-0.5 whitespace-nowrap shadow-2xs"
                              title={
                                item.loanAccountID > 0
                                  ? 'सुवर्ण कर्ज तारण स्क्रीनवर जाऊन या खात्याचे सुट्टे दागिने जोडा'
                                  : 'कर्ज प्रक्रिया (अर्ज) स्क्रीनवर जाऊन दागिने अपडेट करा'
                              }
                            >
                              <PlusCircle size={10} />
                              <span>{item.loanAccountID > 0 ? 'दागिना जोडा' : 'अर्ज उघडा'}</span>
                            </button>
                          )
                        ) : (
                          isFirstForAccount && (
                            <button
                              type="button"
                              onClick={() => handleOpenReceipt(item)}
                              className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded text-[9.5px] font-bold border border-amber-300 cursor-pointer inline-flex items-center gap-0.5 whitespace-nowrap"
                              title="सुवर्ण तारण पावती पहा / प्रिंट करा"
                            >
                              <Receipt size={10} />
                              <span>पावती</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {filteredItems.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                <td colSpan={3} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                  एकूण (Grand Total) — खाती: {d(metrics.uniqueAccountsCount)}
                </td>
                <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell leading-tight">
                  <div className="text-[9.5px] text-slate-600 font-semibold">
                    मंजूर: ₹ {fmtCurrency(metrics.totalSanctioned, isMarathi)}
                  </div>
                  <div className="font-black text-slate-950">
                    ₹ {fmtCurrency(metrics.totalPrincipalBalance, isMarathi)}
                  </div>
                </td>
                <td className="border border-slate-900 py-1.5 px-2 text-left text-[10.5px] text-slate-700">
                  जिन्नस: {d(metrics.recordedOrnamentsCount)}
                  {metrics.pendingAccountsCount > 0 && (
                    <span className="text-amber-800 block text-[9.5px]">
                      ({d(metrics.pendingAccountsCount)} खाती तपशील बाकी)
                    </span>
                  )}
                </td>
                <td className="border border-slate-900 py-1.5 px-1 text-center font-mono font-extrabold">
                  {d(metrics.totalQuantity)}
                </td>
                <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell font-extrabold">
                  {fmtWeight(metrics.totalGrossWeight, isMarathi)}
                </td>
                <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell font-extrabold">
                  {fmtWeight(metrics.totalNetWeight, isMarathi)}
                </td>
                <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell cbs-amt-bal font-bold">
                  ₹ {fmtCurrency(metrics.totalEstimatedValue, isMarathi)}
                </td>
                <td className="border border-slate-900 py-1.5 px-1.5 cbs-num-cell cbs-amt-cr font-black text-primary bg-primary/10">
                  ₹ {fmtCurrency(metrics.totalValuerValue, isMarathi)}
                </td>
                <td className="border border-slate-900 py-1.5 px-1.5 text-center text-slate-500 text-[10px]">
                  -
                </td>
                <td className="border border-slate-900 py-1.5 px-1 text-center no-print print:hidden">
                  -
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        </CbsReportLayout>
      </div>

      {/* Gold Loan Deposit / Valuation Receipt Modal */}
      {receiptModalData && (
        <GoldLoanReceiptPrintModal
          isOpen={!!receiptModalData}
          onClose={() => setReceiptModalData(null)}
          receiptData={receiptModalData}
          activeSanstha={activeSanstha}
        />
      )}

      {/* Image Preview Zoom Modal */}
      {previewPhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          onClick={() => setPreviewPhotoModal(null)}
        >
          <div
            className="relative max-w-lg max-h-[85vh] bg-white p-2 rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewPhotoModal(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold hover:bg-red-700 shadow-md cursor-pointer"
            >
              ✕
            </button>
            <img
              src={previewPhotoModal}
              alt="दागिना फोटो मोठा"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded"
            />
            <p className="text-center text-xs text-slate-600 mt-2 font-medium">सुवर्ण तारण दागिना फोटो</p>
          </div>
        </div>
      )}
    </>
  );
}
