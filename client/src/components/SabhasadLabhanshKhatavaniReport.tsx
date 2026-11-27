import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';
import { formatLocalYmd, getBusinessDateStr } from '../utils/businessDateUtils';
import { exportHtmlElementToPdf } from '../utils/daybookPdfExport';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';
import SearchableSelect from './SearchableSelect';
import CbsReportLayout, { formatDisplayDate } from './common/CbsReportLayout';
import { Search, RefreshCw, Gift, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

interface DividendKhatavaniRow {
  voucherID: number;
  voucherDetailID: number;
  voucherDate: string;
  voucherNo: string;
  voucherType: string;
  paymentMode: string;
  particulars: string;
  financialYear?: string | null;
  dividendPercentage?: number | null;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  balanceType: string;
  branchName?: string;
}

interface DividendKhatavaniReportData {
  sansthaInfo?: any;
  branchID?: number | null;
  branchName: string;
  ledgerID: number;
  ledgerName: string;
  fromDate: string;
  toDate: string;
  memberID?: number | null;
  customerID?: number | null;
  memberNo: string;
  legacyMemberNo: string;
  cifNo: string;
  memberName: string;
  mobileNo: string;
  village: string;
  taluka: string;
  address: string;
  shareAccountNo: string;
  totalShareCount: number;
  totalShareCapital: number;
  openingBalance: number;
  openingBalanceType: string;
  openingBalanceSource: string;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingBalanceType: string;
  transactions: DividendKhatavaniRow[];
}

interface Props {
  onNavigate?: (tab: string, params?: any) => void;
}

const fmtCurrency = (n: number | null | undefined) =>
  (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getDefaultFyStart = (refYmd: string): string => {
  const clean = (refYmd || '').split('T')[0];
  const parts = clean.split('-').map(Number);
  const year = parts.length === 3 && !Number.isNaN(parts[0]) ? parts[0] : new Date().getFullYear();
  const month = parts.length === 3 && !Number.isNaN(parts[1]) ? parts[1] : new Date().getMonth() + 1;
  const startYear = month < 4 ? year - 1 : year;
  return `${startYear}-04-01`;
};

export default function SabhasadLabhanshKhatavaniReport({ onNavigate }: Props) {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);

  const initialBranchId = effectiveBranch === null ? 'all' : String(effectiveBranch);
  const defaultToDate = getBusinessDateStr(user?.businessDate) || formatLocalYmd(new Date());
  const defaultFromDate = getDefaultFyStart(defaultToDate);

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState<string>(defaultFromDate);
  const [toDate, setToDate] = useState<string>(defaultToDate);

  const [sansthaInfo, setSansthaInfo] = useState<any>(null);
  const [reportData, setReportData] = useState<DividendKhatavaniReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [cameFromList, setCameFromList] = useState<boolean>(false);

  const reportContainerRef = useRef<HTMLDivElement>(null);
  const autoFetchDoneRef = useRef<boolean>(false);

  const ledgerOptions = useMemo(
    () => [
      { value: '', label: '-- लाभांश लेजर निवडा (Auto) --' },
      ...ledgers.map((l: any) => {
        const legacyPart = l.legacyLedgerId ? ` [जुना क्र: ${l.legacyLedgerId}]` : '';
        const engPart = l.ledgerNameEnglish ? ` (${l.ledgerNameEnglish})` : '';
        const groupPart = l.accountGroup?.groupName ? ` - ${l.accountGroup.groupName}` : '';
        return {
          value: String(l.ledgerID),
          label: `${l.ledgerID} - ${l.ledgerName}${engPart}${legacyPart}${groupPart}`,
        };
      }),
    ],
    [ledgers]
  );

  const fetchReport = useCallback(
    async (overrides?: {
      memberId?: number | '';
      customerId?: number | null;
      ledgerId?: string;
      fromDate?: string;
      toDate?: string;
      branchId?: string;
    }) => {
      const mId = overrides?.memberId !== undefined ? overrides.memberId : selectedMemberId;
      const cId = overrides?.customerId !== undefined ? overrides.customerId : selectedCustomerId;
      const lId = overrides?.ledgerId !== undefined ? overrides.ledgerId : selectedLedgerId;
      const fDate = overrides?.fromDate !== undefined ? overrides.fromDate : fromDate;
      const tDate = overrides?.toDate !== undefined ? overrides.toDate : toDate;
      const bId = overrides?.branchId !== undefined ? overrides.branchId : selectedBranchId;

      if (!mId && !cId) {
        toast.error('कृपया सभासद निवडा.');
        return;
      }
      if (!fDate || !tDate) {
        toast.error('कृपया सुरुवातीची व अंतिम तारीख निवडा.');
        return;
      }
      if (tDate < fDate) {
        toast.error('अंतिम तारीख ही सुरुवातीच्या तारखेपेक्षा लहान असू शकत नाही.');
        return;
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (mId) params.set('memberId', String(mId));
        if (cId && cId > 0) params.set('customerId', String(cId));
        if (lId) params.set('ledgerId', String(lId));
        params.set('fromDate', fDate);
        params.set('toDate', tDate);
        if (bId && bId !== 'all') {
          params.set('branchId', bId);
        }

        const res = await api.get<DividendKhatavaniReportData>(
          `/api/Reports/sabhasad-labhansh-khatavani?${params.toString()}`
        );
        setReportData(res.data);
        if (!lId && res.data?.ledgerID) {
          setSelectedLedgerId(String(res.data.ledgerID));
        }
      } catch (err: any) {
        console.error('Error fetching dividend khatavani', err);
        const msg =
          err?.response?.data?.message ||
          (typeof err?.response?.data === 'string' ? err.response.data : null) ||
          'लाभांश खतावणी लोड करताना त्रुटी आली.';
        toast.error(msg);
        setReportData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedMemberId, selectedCustomerId, selectedLedgerId, fromDate, toDate, selectedBranchId]
  );

  useEffect(() => {
    const loadInitial = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const qMemberId = Number(urlParams.get('memberId') || 0) || '';
      const qCustomerId = Number(urlParams.get('customerId') || 0) || null;
      const qLedgerId = urlParams.get('ledgerId') || '';
      const qBranchId = urlParams.get('branchId') || '';
      const qFromDate = urlParams.get('fromDate') || '';
      const qToDate = urlParams.get('toDate') || '';

      if (qMemberId || qCustomerId) {
        setCameFromList(true);
      }

      const resolvedBranch =
        isHOUser && qBranchId
          ? qBranchId
          : lockedBranchId
          ? String(lockedBranchId)
          : initialBranchId;

      if (resolvedBranch !== selectedBranchId) {
        setSelectedBranchId(resolvedBranch);
      }

      try {
        const [resBranches, resSanstha, resFy, resLedgers, resMembers] = await Promise.all([
          api.get('/api/Branches').catch(() => ({ data: [] })),
          api.get('/api/SansthaDetails').catch(() => ({ data: null })),
          api.get('/api/FinancialYears').catch(() => ({ data: [] })),
          api.get('/api/Ledgers').catch(() => ({ data: [] })),
          api
            .get(
              resolvedBranch && resolvedBranch !== 'all'
                ? `/api/Members?branchId=${resolvedBranch}`
                : '/api/Members'
            )
            .catch(() => ({ data: [] })),
        ]);

        setBranches(resBranches.data || []);

        if (resSanstha.data) {
          setSansthaInfo(Array.isArray(resSanstha.data) ? resSanstha.data[0] : resSanstha.data);
        }

        let resolvedFrom = qFromDate || defaultFromDate;
        let resolvedTo = qToDate || defaultToDate;
        if (Array.isArray(resFy.data) && resFy.data.length > 0) {
          const activeFy = resFy.data.find((y: any) => y.isActive) || resFy.data[0];
          if (!qFromDate && activeFy?.startDate) {
            resolvedFrom = String(activeFy.startDate).split('T')[0];
          }
          if (!qToDate && !user?.businessDate && activeFy?.endDate) {
            resolvedTo = String(activeFy.endDate).split('T')[0];
          }
        }
        setFromDate(resolvedFrom);
        setToDate(resolvedTo);

        let resolvedLedger = qLedgerId;
        if (Array.isArray(resLedgers.data)) {
          const sortedLedgers = [...resLedgers.data].sort((a: any, b: any) => {
            const isDivA =
              a.accountType === 'Dividend Payable' ||
              (a.ledgerName || '').includes('लाभांश') ||
              (a.ledgerName || '').includes('डिव्हीडंड');
            const isDivB =
              b.accountType === 'Dividend Payable' ||
              (b.ledgerName || '').includes('लाभांश') ||
              (b.ledgerName || '').includes('डिव्हीडंड');
            if (isDivA && !isDivB) return -1;
            if (!isDivA && isDivB) return 1;
            return (a.ledgerID || 0) - (b.ledgerID || 0);
          });
          setLedgers(sortedLedgers);

          if (!resolvedLedger) {
            const defaultDiv =
              sortedLedgers.find((l: any) => l.accountType === 'Dividend Payable') ||
              sortedLedgers.find(
                (l: any) =>
                  (l.ledgerName || '').includes('देणे') &&
                  ((l.ledgerName || '').includes('लाभांश') || (l.ledgerName || '').includes('डिव्हीडंड'))
              ) ||
              sortedLedgers.find(
                (l: any) =>
                  (l.ledgerName || '').includes('लाभांश') || (l.ledgerName || '').includes('डिव्हीडंड')
              );
            if (defaultDiv) {
              resolvedLedger = String(defaultDiv.ledgerID);
            }
          }
        }
        if (resolvedLedger) {
          setSelectedLedgerId(resolvedLedger);
        }

        const loadedMembers: MemberOption[] = Array.isArray(resMembers.data) ? resMembers.data : [];
        setMembers(loadedMembers);

        let resolvedMemberId: number | '' = qMemberId;
        let resolvedCustomerId: number | null = qCustomerId;
        if (qMemberId && !qCustomerId) {
          const hit = loadedMembers.find(
            (m: any) => Number(m.memberID || m.memberId) === Number(qMemberId)
          );
          if (hit) {
            resolvedCustomerId = Number(hit.customerID || hit.customerId || 0) || null;
          }
        } else if (!qMemberId && qCustomerId) {
          const hit = loadedMembers.find(
            (m: any) => Number(m.customerID || m.customerId) === Number(qCustomerId)
          );
          if (hit) {
            resolvedMemberId = Number(hit.memberID || hit.memberId) || '';
          }
        }

        if (resolvedMemberId) setSelectedMemberId(resolvedMemberId);
        if (resolvedCustomerId) setSelectedCustomerId(resolvedCustomerId);

        if ((resolvedMemberId || resolvedCustomerId) && !autoFetchDoneRef.current) {
          autoFetchDoneRef.current = true;
          await fetchReport({
            memberId: resolvedMemberId,
            customerId: resolvedCustomerId,
            ledgerId: resolvedLedger,
            fromDate: resolvedFrom,
            toDate: resolvedTo,
            branchId: resolvedBranch,
          });
        }
      } catch (err) {
        console.error('Failed to initialize Dividend Khatavani', err);
      }
    };

    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBranchChange = async (newBranch: string) => {
    setSelectedBranchId(newBranch);
    setSelectedMemberId('');
    setSelectedCustomerId(null);
    setReportData(null);
    try {
      const res = await api.get(
        newBranch && newBranch !== 'all' ? `/api/Members?branchId=${newBranch}` : '/api/Members'
      );
      setMembers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error reloading members for branch', err);
    }
  };

  const handleMemberChange = (val: number | '', option?: any) => {
    setSelectedMemberId(val);
    const matched =
      option ||
      members.find((m: any) => Number(m.memberID || m.memberId || m.id) === Number(val));
    const cId = Number(matched?.customerID || matched?.customerId || 0) || null;
    setSelectedCustomerId(cId);
  };

  const activeSanstha = reportData?.sansthaInfo || sansthaInfo;
  const transactions = reportData?.transactions || [];

  const getBranchName = () => {
    if (reportData?.branchName) return reportData.branchName;
    if (!selectedBranchId || selectedBranchId === 'all') return 'सर्व शाखा (All Branches)';
    const b = branches.find((item: any) => String(item.branchID) === String(selectedBranchId));
    return b ? b.branchName : 'मुख्य शाखा';
  };

  const handleExportExcel = async () => {
    if (!reportData) {
      toast.error('एक्सपोर्ट करण्यासाठी माहिती उपलब्ध नाही.');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('सभासद लाभांश खतावणी');

      ws.columns = [
        { header: 'अ.क्र.', key: 'sr', width: 8 },
        { header: 'दिनांक', key: 'date', width: 13 },
        { header: 'व्हाउचर क्र.', key: 'voucherNo', width: 20 },
        { header: 'प्रकार / माध्यम', key: 'mode', width: 18 },
        { header: 'तपशील (Particulars)', key: 'particulars', width: 42 },
        { header: 'नावे / वाटप (Dr ₹)', key: 'debit', width: 16 },
        { header: 'जमा / देय (Cr ₹)', key: 'credit', width: 16 },
        { header: 'शिल्लक रक्कम (₹)', key: 'balance', width: 18 },
      ];

      // Title rows inserted above table header
      ws.insertRow(1, [activeSanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित']);
      ws.mergeCells('A1:H1');
      ws.getRow(1).font = { bold: true, size: 14 };
      ws.getRow(1).alignment = { horizontal: 'center' };

      ws.insertRow(2, [
        `सभासद लाभांश खतावणी पत्रक (${formatDisplayDate(reportData.fromDate)} ते ${formatDisplayDate(reportData.toDate)}) | शाखा: ${getBranchName()}`,
      ]);
      ws.mergeCells('A2:H2');
      ws.getRow(2).font = { bold: true, size: 11 };
      ws.getRow(2).alignment = { horizontal: 'center' };

      const memberMeta = `सभासद क्र.: ${reportData.memberNo || '-'}${
        reportData.legacyMemberNo ? ` (जुना: ${reportData.legacyMemberNo})` : ''
      } | CIF: ${reportData.cifNo || '-'} | नाव: ${reportData.memberName || '-'} | लेजर: ${reportData.ledgerName}`;
      ws.insertRow(3, [memberMeta]);
      ws.mergeCells('A3:H3');
      ws.getRow(3).font = { bold: true, size: 10 };

      // Row 4 is the auto-created table header row
      const headerRow = ws.getRow(4);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // Opening Balance Row
      const obRow = ws.addRow({
        sr: '-',
        date: formatDisplayDate(reportData.fromDate),
        voucherNo: '-',
        mode: 'आरंभी शिल्लक',
        particulars: 'आरंभीची देय लाभांश शिल्लक (Opening Balance)',
        debit: 0,
        credit: 0,
        balance: `${fmtCurrency(reportData.openingBalance)} ${reportData.openingBalanceType}`,
      });
      obRow.font = { bold: true };

      // Transaction Rows
      transactions.forEach((tx, idx) => {
        const fyTag = tx.financialYear
          ? ` [आ.व. ${tx.financialYear}${tx.dividendPercentage ? ` @ ${tx.dividendPercentage}%` : ''}]`
          : '';
        ws.addRow({
          sr: idx + 1,
          date: formatDisplayDate(tx.voucherDate),
          voucherNo: tx.voucherNo || '-',
          mode: tx.paymentMode || tx.voucherType || '-',
          particulars: `${tx.particulars || '-'}${fyTag}`,
          debit: tx.debitAmount || 0,
          credit: tx.creditAmount || 0,
          balance: `${fmtCurrency(tx.runningBalance)} ${tx.balanceType}`,
        });
      });

      // Totals Row
      const totalRow = ws.addRow({
        sr: '',
        date: formatDisplayDate(reportData.toDate),
        voucherNo: '',
        mode: '',
        particulars: 'एकूण व्यवहार / अखेरची देय शिल्लक (Total / Closing):',
        debit: reportData.totalDebit,
        credit: reportData.totalCredit,
        balance: `${fmtCurrency(reportData.closingBalance)} ${reportData.closingBalanceType}`,
      });
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        cell.border = {
          top: { style: 'medium' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' },
        };
      });

      ws.getColumn('debit').numFmt = '#,##0.00';
      ws.getColumn('credit').numFmt = '#,##0.00';

      const buffer = await workbook.xlsx.writeBuffer();
      const safeMember = (reportData.memberNo || reportData.cifNo || 'Member').replace(/[^a-zA-Z0-9_-]/g, '_');
      saveAs(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `Sabhasad_Labhansh_Khatavani_${safeMember}_${reportData.toDate.split('T')[0]}.xlsx`
      );
      toast.success('एक्सेल फाईल यशस्वीरीत्या डाउनलोड झाली.');
    } catch (err) {
      console.error('Excel export failed', err);
      toast.error('एक्सेल एक्सपोर्ट करताना त्रुटी आली.');
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportData || !reportContainerRef.current) {
      toast.error('PDF डाउनलोड करण्यासाठी माहिती उपलब्ध नाही.');
      return;
    }

    const printSheet =
      (reportContainerRef.current.querySelector('.cbs-print-sheet') as HTMLElement) ||
      reportContainerRef.current;

    setIsExportingPdf(true);
    try {
      const safeMember = (reportData.memberNo || reportData.cifNo || 'Member').replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportHtmlElementToPdf({
        element: printSheet,
        filename: `Sabhasad_Labhansh_Khatavani_${safeMember}_${reportData.toDate.split('T')[0]}.pdf`,
        format: 'a4',
        orientation: 'portrait',
        marginMm: 6,
      });
      toast.success('PDF यशस्वीरीत्या डाउनलोड झाली.');
    } catch (err) {
      console.error('PDF export failed', err);
      toast.error('PDF तयार करताना त्रुटी आली.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const summaryBanner = reportData ? (
    <div className="space-y-1.5 text-xs">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सभासद क्र. / CIF</span>
          <strong className="text-primary font-mono text-[11px] block">
            {reportData.memberNo || '-'}
            {reportData.legacyMemberNo ? ` (जुना: ${reportData.legacyMemberNo})` : ''}
          </strong>
          {reportData.cifNo && (
            <span className="text-[10px] text-slate-600 font-mono">CIF: {reportData.cifNo}</span>
          )}
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सभासदाचे नाव व संपर्क</span>
          <strong className="text-slate-900 text-[11px] truncate block">{reportData.memberName || '-'}</strong>
          <span className="text-[10px] text-slate-600 truncate block">
            {[reportData.mobileNo, reportData.village || reportData.address].filter(Boolean).join(' | ') || '-'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">लाभांश लेजर व शेअर्स</span>
          <strong className="text-slate-900 text-[11px] truncate block">{reportData.ledgerName}</strong>
          <span className="text-[10px] text-slate-600 font-mono">
            शेअर्स: {reportData.totalShareCount} | भांडवल: ₹ {fmtCurrency(reportData.totalShareCapital)}
          </span>
        </div>
        <div className="sm:text-right">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">अखेरची देय लाभांश शिल्लक</span>
          <strong className="text-emerald-700 font-mono text-sm block">
            ₹ {fmtCurrency(reportData.closingBalance)}{' '}
            <span className="text-[10px] font-bold">({reportData.closingBalanceType})</span>
          </strong>
          <span className="text-[10px] text-slate-600 font-mono">
            जमा: ₹{fmtCurrency(reportData.totalCredit)} | वाटप: ₹{fmtCurrency(reportData.totalDebit)}
          </span>
        </div>
      </div>
    </div>
  ) : null;

  const filterControls = (
    <div className="w-full flex flex-wrap items-center gap-2">
      {cameFromList && onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate('sabhasad-labhansh-report')}
          className="h-6 px-2 rounded-xs border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
          title="सभासद लाभांश यादीकडे परत जा"
        >
          <ArrowLeft size={11} />
          <span>यादी</span>
        </button>
      )}

      {/* Branch Select */}
      <div className="flex items-center gap-1 shrink-0">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
        <select
          value={selectedBranchId}
          disabled={!isHOUser}
          onChange={(e) => handleBranchChange(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1.5 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28 sm:w-32 disabled:bg-slate-100 disabled:text-slate-600"
        >
          {isHOUser && <option value="all">सर्व शाखा (All)</option>}
          {(isHOUser || !lockedBranchId
            ? branches
            : branches.filter((b: any) => Number(b.branchID) === Number(lockedBranchId))
          ).map((b: any) => (
            <option key={b.branchID} value={String(b.branchID)}>
              {b.branchName}
            </option>
          ))}
        </select>
      </div>

      {/* Member Search */}
      <div className="flex-1 min-w-[240px] max-w-[380px]">
        <MemberSearchSelect
          members={members}
          value={selectedMemberId}
          onChange={handleMemberChange}
          placeholder="सभासद नाव, कोड, जुना क्र. किंवा CIF..."
          className="text-[11px]"
          compact={true}
        />
      </div>

      {/* Dividend Ledger Select */}
      <div className="w-48 sm:w-56">
        <SearchableSelect
          name="selectedLedgerId"
          options={ledgerOptions}
          value={selectedLedgerId}
          onChange={(e: any) => setSelectedLedgerId(e.target.value)}
          placeholder="-- लाभांश लेजर निवडा --"
        />
      </div>

      {/* From Date */}
      <div className="flex items-center gap-1 shrink-0">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28"
        />
      </div>

      {/* To Date */}
      <div className="flex items-center gap-1 shrink-0">
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
        onClick={() => fetchReport()}
        disabled={isLoading || isExportingPdf}
        className="h-6 bg-primary hover:opacity-90 text-white px-3 rounded-xs text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
      >
        {isLoading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
        <span>पहा</span>
      </button>
    </div>
  );

  return (
    <div ref={reportContainerRef}>
      <CbsReportLayout
        defaultPaperSize="a4-portrait"
        allowPaperSizeToggle={true}
        reportTitle="सभासद लाभांश खतावणी पत्रक"
        reportSubtitle="Member Dividend Khatavani / Ledger Statement"
        periodText={`${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`}
        branchName={getBranchName()}
        sansthaInfo={activeSanstha}
        summaryBanner={summaryBanner}
        signatureTier="3-tier"
        signatureTitles={[
          { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
          { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
          { title: 'शाखा व्यवस्थापक / सचिव', subtitle: '(Manager / Secretary)' },
        ]}
        onExportExcel={handleExportExcel}
        onDownloadPdf={handleDownloadPdf}
        toolbarSecondRow={filterControls}
        isLoading={isLoading}
        hasData={Boolean(reportData)}
        preparedBy={user?.username || 'Admin'}
        emptyState={
          <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
            <Gift size={32} className="mx-auto mb-2 text-primary/40" />
            <p className="font-semibold text-xs">
              कृपया सभासद, लाभांश लेजर व कालावधी निवडून &quot;पहा&quot; बटणावर क्लिक करा.
            </p>
          </div>
        }
      >
        <table className="cbs-table w-full border-collapse border border-slate-900 text-[11px]">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
              <th className="border border-slate-900 py-1.5 px-1 w-[5%] text-center">अ.क्र.</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[10%] text-center">दिनांक</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[13%] text-center">व्हाउचर क्र.</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[12%] text-center">प्रकार / माध्यम</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[26%] text-left">तपशील (Particulars)</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[11%] text-right">नावे / वाटप (Dr ₹)</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[11%] text-right">जमा / देय (Cr ₹)</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[12%] text-right font-extrabold">
                शिल्लक (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance Row */}
            {reportData && (
              <tr className="bg-slate-50/80 font-bold text-slate-900 text-[10.5px]">
                <td className="border border-slate-900 py-1 px-1 text-center font-mono">-</td>
                <td className="border border-slate-900 py-1 px-1.5 text-center font-mono">
                  {formatDisplayDate(reportData.fromDate)}
                </td>
                <td className="border border-slate-900 py-1 px-1.5 text-center font-mono">-</td>
                <td className="border border-slate-900 py-1 px-1.5 text-center text-[10px]">आरंभी शिल्लक</td>
                <td className="border border-slate-900 py-1 px-2 italic text-primary">
                  आरंभीची देय लाभांश शिल्लक (Opening Balance)
                </td>
                <td className="border border-slate-900 py-1 px-1.5 text-right font-mono">-</td>
                <td className="border border-slate-900 py-1 px-1.5 text-right font-mono">-</td>
                <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                  {fmtCurrency(reportData.openingBalance)}{' '}
                  <span className="text-[9.5px] font-semibold text-slate-600">
                    {reportData.openingBalanceType}
                  </span>
                </td>
              </tr>
            )}

            {transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-6 text-slate-500 font-semibold border border-slate-900"
                >
                  निवडलेल्या कालावधीत कोणतेही लाभांश व्यवहार आढळले नाहीत.
                </td>
              </tr>
            ) : (
              transactions.map((tx, idx) => (
                <tr
                  key={tx.voucherDetailID || `${tx.voucherID}-${idx}`}
                  className="hover:bg-slate-50 text-slate-900 text-[10.5px]"
                >
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono">{idx + 1}</td>
                  <td className="border border-slate-900 py-1 px-1.5 text-center font-mono whitespace-nowrap">
                    {formatDisplayDate(tx.voucherDate)}
                  </td>
                  <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-semibold whitespace-nowrap">
                    {tx.voucherNo || '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-1.5 text-center whitespace-nowrap text-[10px]">
                    {tx.paymentMode || tx.voucherType || '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2">
                    <span>{tx.particulars || '-'}</span>
                    {tx.financialYear && (
                      <span className="ml-1 inline-block px-1 py-0 text-[9.5px] font-semibold rounded bg-primary/10 text-primary border border-primary/20">
                        आ.व. {tx.financialYear}
                        {tx.dividendPercentage ? ` (${tx.dividendPercentage}%)` : ''}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-900 py-1 px-1.5 text-right font-mono text-rose-700 font-semibold whitespace-nowrap">
                    {tx.debitAmount > 0 ? fmtCurrency(tx.debitAmount) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-1.5 text-right font-mono text-emerald-700 font-semibold whitespace-nowrap">
                    {tx.creditAmount > 0 ? fmtCurrency(tx.creditAmount) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                    {fmtCurrency(tx.runningBalance)}{' '}
                    <span className="text-[9.5px] font-semibold text-slate-600">{tx.balanceType}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {reportData && (
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-[11px]">
                <td colSpan={5} className="border border-slate-900 py-1.5 px-2 text-right uppercase tracking-wide">
                  एकूण व्यवहार / अखेरची देय शिल्लक:
                </td>
                <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono text-rose-800 whitespace-nowrap">
                  ₹ {fmtCurrency(reportData.totalDebit)}
                </td>
                <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono text-emerald-800 whitespace-nowrap">
                  ₹ {fmtCurrency(reportData.totalCredit)}
                </td>
                <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono font-black text-primary bg-primary/10 whitespace-nowrap">
                  ₹ {fmtCurrency(reportData.closingBalance)} {reportData.closingBalanceType}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </CbsReportLayout>
    </div>
  );
}
