import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Search, RefreshCw, Printer, FileText, Layers } from 'lucide-react';
import CbsReportLayout, {
  CbsPaperSize,
  SansthaDetails,
  formatDisplayDate
} from './common/CbsReportLayout';
import { VoucherPrintTemplate, fmtVoucherAmt, toMarathiNum } from './VoucherPrint';
import { useAuth } from '../context/AuthContext';

export default function VoucherBatchPrint() {
  const { user } = useAuth();
  const isHOUser =
    user?.role === 'Admin' ||
    user?.role === 'SuperAdmin' ||
    user?.role === 'HeadOffice' ||
    user?.role === 'HO_Manager';

  const getBizDateStr = (b?: string) => {
    if (b && b.trim()) return b.split('T')[0];
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(
      n.getDate()
    ).padStart(2, '0')}`;
  };

  const [startDate, setStartDate] = useState<string>(() => getBizDateStr(user?.businessDate));
  const [endDate, setEndDate] = useState<string>(() => getBizDateStr(user?.businessDate));
  const [voucherType, setVoucherType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'report-table' | 'voucher-slips'>('report-table');
  const [paperSize, setPaperSize] = useState<CbsPaperSize>('a4-portrait');
  const [signatureTier, setSignatureTier] = useState<'3-tier' | '4-tier'>('3-tier');
  const [digitMode, setDigitMode] = useState<'marathi' | 'english'>('english');

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch
    ? (globalBranchStr as string)
    : !isHOUser && user?.branchID
    ? user.branchID.toString()
    : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);
  const [branches, setBranches] = useState<any[]>([]);

  const [vouchers, setVouchers] = useState<any[]>([]);
  const [sanstha, setSanstha] = useState<SansthaDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [singleSlipVoucher, setSingleSlipVoucher] = useState<any | null>(null);

  const isMarathi = digitMode === 'marathi';
  const d = (val: string | number) => (isMarathi ? toMarathiNum(val) : String(val));

  useEffect(() => {
    if (user?.businessDate) {
      const bDate = getBizDateStr(user.businessDate);
      setStartDate(bDate);
      setEndDate(bDate);
    }
  }, [user?.businessDate]);

  useEffect(() => {
    axios
      .get('/api/SansthaDetails')
      .then((res) => {
        if (res.data) {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setSanstha(res.data[0]);
          } else if (!Array.isArray(res.data)) {
            setSanstha(res.data);
          }
        }
      })
      .catch((err) => console.error('Failed to load sanstha details', err));

    axios
      .get('/api/Branches')
      .then((res) => {
        if (Array.isArray(res.data)) setBranches(res.data);
      })
      .catch((err) => console.error('Failed to load branches', err));
  }, []);

  const fetchVouchers = async (sDate = startDate, eDate = endDate, vType = voucherType, bId = selectedBranchId) => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        startDate: sDate,
        endDate: eDate,
        type: vType
      };
      if (bId && bId !== 'all') {
        params.branchId = Number(bId);
      }
      const res = await axios.get('/api/Vouchers/batch', { params });
      setVouchers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch vouchers:', err);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers(startDate, endDate, voucherType, selectedBranchId);
  }, []);

  const resolvedBranchName = useMemo(() => {
    if (selectedBranchId === 'all') return 'सर्व शाखा (All Branches)';
    const found = branches.find((b) => String(b.branchID) === String(selectedBranchId));
    return found?.branchName || user?.branchName || 'मुख्य शाखा (पडवळवाडी)';
  }, [selectedBranchId, branches, user?.branchName]);

  const getVoucherTypeLabel = (vType?: string) => {
    switch (vType) {
      case 'Receipt':
        return 'जमा पावती (Receipt)';
      case 'Payment':
        return 'नावे पावती (Payment)';
      case 'Journal':
        return 'जर्नल (Journal)';
      case 'Contra':
        return 'कॉन्ट्रा (Contra)';
      default:
        return vType || '-';
    }
  };

  const getVoucherPartySummary = (v: any) => {
    const details = Array.isArray(v.voucherDetails) ? v.voucherDetails : [];
    const partyDet =
      details.find((det: any) => det.customer != null || det.member?.customer != null || det.member != null) ||
      details.find(
        (det: any) => det.ledger?.ledgerName !== 'Cash' && !det.ledger?.ledgerName?.includes('रोख')
      ) ||
      details[0];

    const cust = partyDet?.customer || partyDet?.member?.customer;
    const cif = cust?.cifNo || cust?.CIFNo || '';
    const legacyNo = cust?.legacyCustomerNo || cust?.LegacyCustomerNo || '';
    const name = [
      cust?.firstName || cust?.FirstName || partyDet?.member?.firstName || partyDet?.member?.FirstName || '',
      cust?.middleName || cust?.MiddleName || partyDet?.member?.middleName || partyDet?.member?.MiddleName || '',
      cust?.lastName || cust?.LastName || partyDet?.member?.lastName || partyDet?.member?.LastName || ''
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    const codeStr = cif
      ? `${cif}${legacyNo ? ` (जुना: ${legacyNo})` : ''}`
      : legacyNo
      ? `जुना खा.नं: ${legacyNo}`
      : '';

    return codeStr || name
      ? `${codeStr ? `${codeStr} - ` : ''}${name}`.trim()
      : partyDet?.ledger?.ledgerName || '-';
  };

  const filteredVouchers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return vouchers;
    return vouchers.filter((v) => {
      const vNo = String(v.voucherNo || '').toLowerCase();
      const narr = String(v.narration || '').toLowerCase();
      const party = getVoucherPartySummary(v).toLowerCase();
      const ledgerMatch = (v.voucherDetails || []).some((det: any) =>
        String(det.ledger?.ledgerName || '').toLowerCase().includes(q)
      );
      return vNo.includes(q) || narr.includes(q) || party.includes(q) || ledgerMatch;
    });
  }, [vouchers, searchQuery]);

  const metrics = useMemo(() => {
    let totalDr = 0;
    let totalCr = 0;
    let receiptCount = 0;
    let paymentCount = 0;
    let journalCount = 0;
    let contraCount = 0;

    filteredVouchers.forEach((v) => {
      if (v.voucherType === 'Receipt') receiptCount++;
      else if (v.voucherType === 'Payment') paymentCount++;
      else if (v.voucherType === 'Journal') journalCount++;
      else if (v.voucherType === 'Contra') contraCount++;

      (v.voucherDetails || []).forEach((det: any) => {
        const amt = Number(det.amount || 0);
        if (det.drCr === 'Dr') totalDr += amt;
        if (det.drCr === 'Cr') totalCr += amt;
      });
    });

    return {
      count: filteredVouchers.length,
      totalDr,
      totalCr,
      receiptCount,
      paymentCount,
      journalCount,
      contraCount
    };
  }, [filteredVouchers]);

  const handleExportExcel = () => {
    const excelRows: any[] = [];
    filteredVouchers.forEach((v, idx) => {
      const details = Array.isArray(v.voucherDetails) ? v.voucherDetails : [];
      const vDr = details
        .filter((det: any) => det.drCr === 'Dr')
        .reduce((s: number, det: any) => s + Number(det.amount || 0), 0);
      const vCr = details
        .filter((det: any) => det.drCr === 'Cr')
        .reduce((s: number, det: any) => s + Number(det.amount || 0), 0);

      const ledgersText = details
        .map((det: any) => `${det.ledger?.ledgerName || '-'} (${det.drCr}: ₹${Number(det.amount || 0).toFixed(2)})`)
        .join(' | ');

      excelRows.push({
        'अ.क्र.': idx + 1,
        'दिनांक': formatDisplayDate(v.voucherDate),
        'व्हाउचर क्र.': v.voucherNo || '-',
        'व्हाउचर प्रकार': getVoucherTypeLabel(v.voucherType),
        'खातेदार / पार्टी': getVoucherPartySummary(v),
        'लेजर तपशील': ledgersText,
        'तपशील (Narration)': v.narration || '-',
        'नावे (Dr ₹)': Number(vDr.toFixed(2)),
        'जमा (Cr ₹)': Number(vCr.toFixed(2))
      });
    });

    excelRows.push({
      'अ.क्र.': '',
      'दिनांक': '',
      'व्हाउचर क्र.': '',
      'व्हाउचर प्रकार': '',
      'खातेदार / पार्टी': '',
      'लेजर तपशील': '',
      'तपशील (Narration)': 'एकूण व्यवहार बेरीज (Grand Total):',
      'नावे (Dr ₹)': Number(metrics.totalDr.toFixed(2)),
      'जमा (Cr ₹)': Number(metrics.totalCr.toFixed(2))
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Voucher_Register');
    XLSX.writeFile(wb, `SmartBanking_Voucher_Print_${startDate}_to_${endDate}.xlsx`);
  };

  if (singleSlipVoucher) {
    return (
      <div className="cbs-report-wrapper p-2 sm:p-4 bg-slate-100 min-h-screen print:p-0 print:bg-white">
        <div className="cbs-toolbar bg-white px-3 py-1.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print flex flex-wrap items-center justify-between gap-2 max-w-[210mm] mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText size={13} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xs font-bold text-gray-900">
              व्हाउचर पावती प्रिव्ह्यू: <span className="text-primary font-mono">{singleSlipVoucher.voucherNo}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={signatureTier}
              onChange={(e) => setSignatureTier(e.target.value as '3-tier' | '4-tier')}
              className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800"
            >
              <option value="3-tier">३-स्तरीय स्वाक्षरी</option>
              <option value="4-tier">४-स्तरीय स्वाक्षरी</option>
            </select>

            <button
              type="button"
              onClick={() => setSingleSlipVoucher(null)}
              className="h-6 bg-slate-600 hover:bg-slate-700 text-white px-2.5 py-0.5 rounded-xs text-[11px] font-semibold cursor-pointer"
            >
              ← यादीकडे परत जा
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="h-6 bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-0.5 rounded-xs text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Printer size={12} />
              <span>पावती प्रिंट करा (A4)</span>
            </button>
          </div>
        </div>

        <VoucherPrintTemplate
          voucher={singleSlipVoucher}
          sanstha={sanstha}
          signatureTier={signatureTier}
          isMarathiDigits={isMarathi}
          preparedBy={user ? `${user.username} (${user.role})` : 'Admin'}
          branchName={singleSlipVoucher?.branch?.branchName || resolvedBranchName}
        />
      </div>
    );
  }

  const summaryBanner = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण व्हाउचर संख्या</span>
        <strong className="text-primary font-mono text-[11px]">
          {d(metrics.count)} व्हाउचर{' '}
          <span className="text-slate-500 font-normal text-[10px]">
            (जमा: {d(metrics.receiptCount)} | नावे: {d(metrics.paymentCount)} | जर्नल: {d(metrics.journalCount)})
          </span>
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कालावधी एकूण नावे (Total Dr)</span>
        <strong className="text-red-700 font-mono text-[11px]">
          ₹ {fmtVoucherAmt(metrics.totalDr, isMarathi)}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कालावधी एकूण जमा (Total Cr)</span>
        <strong className="text-emerald-700 font-mono text-[11px]">
          ₹ {fmtVoucherAmt(metrics.totalCr, isMarathi)}
        </strong>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">ताळा स्थिती (Balance Check)</span>
        <strong className="text-emerald-700 font-mono text-xs">
          {Math.abs(metrics.totalDr - metrics.totalCr) < 0.01
            ? `✓ संतुलित (₹ ${fmtVoucherAmt(metrics.totalDr, isMarathi)})`
            : `तफावत: ₹ ${fmtVoucherAmt(Math.abs(metrics.totalDr - metrics.totalCr), isMarathi)}`}
        </strong>
      </div>
    </div>
  );

  const filterControls = (
    <>
      {/* Branch Selector */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">शाखा:</label>
        <select
          value={selectedBranchId}
          disabled={hasGlobalBranch || !isHOUser}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="h-6 border border-slate-300 rounded-xs px-1 text-[10.5px] font-medium bg-white text-slate-800 w-28"
        >
          <option value="all">सर्व शाखा (All)</option>
          {branches.map((b: any) => (
            <option key={b.branchID} value={String(b.branchID)}>
              {b.branchName}
            </option>
          ))}
        </select>
      </div>

      {/* Start Date */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">पासून:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-6 border border-slate-300 rounded-xs px-1 text-[10.5px] font-medium bg-white text-slate-800 w-28"
        />
      </div>

      {/* End Date */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">पर्यंत:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-6 border border-slate-300 rounded-xs px-1 text-[10.5px] font-medium bg-white text-slate-800 w-28"
        />
      </div>

      {/* Voucher Type */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">प्रकार:</label>
        <select
          value={voucherType}
          onChange={(e) => setVoucherType(e.target.value)}
          className="h-6 border border-slate-300 rounded-xs px-1 text-[10.5px] font-medium bg-white text-slate-800"
        >
          <option value="All">सर्व (All)</option>
          <option value="Receipt">जमा पावती (Receipt)</option>
          <option value="Payment">नावे पावती (Payment)</option>
          <option value="Journal">जर्नल (Journal)</option>
          <option value="Contra">कॉन्ट्रा (Contra)</option>
        </select>
      </div>

      {/* Quick Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="व्हाउचर क्र. / खातेदार / तपशील..."
        className="h-6 border border-slate-300 rounded-xs px-1.5 text-[10.5px] bg-white text-slate-800 w-36"
      />

      {/* View Mode Selector */}
      <select
        value={viewMode}
        onChange={(e) => setViewMode(e.target.value as 'report-table' | 'voucher-slips')}
        className="h-6 border border-primary/40 rounded-xs px-1 text-[10.5px] font-bold bg-primary/5 text-primary"
        title="प्रिंट स्वरूप निवडा"
      >
        <option value="report-table">📋 अहवाल तक्ता (CBS Report)</option>
        <option value="voucher-slips">🧾 व्हाउचर स्लिप (2/Page Slips)</option>
      </select>

      {/* Digit Mode */}
      <select
        value={digitMode}
        onChange={(e) => setDigitMode(e.target.value as 'marathi' | 'english')}
        className="h-6 border border-slate-300 rounded-xs px-1 text-[10.5px] bg-white text-slate-800"
        title="अंक भाषा निवडा"
      >
        <option value="english">Eng 1,2,3</option>
        <option value="marathi">मराठी १,२,३</option>
      </select>

      {/* Signature Tier Selector (Matching CbsSampleReport.tsx) */}
      <select
        value={signatureTier}
        onChange={(e) => setSignatureTier(e.target.value as '3-tier' | '4-tier')}
        className="h-6 border border-slate-300 rounded-xs px-1 text-[10.5px] bg-white text-slate-800"
        title="स्वाक्षरी लेव्हल निवडा"
      >
        <option value="3-tier">३-स्तरीय स्वाक्षरी</option>
        <option value="4-tier">४-स्तरीय स्वाक्षरी</option>
      </select>

      {/* Search Button */}
      <button
        type="button"
        onClick={() => fetchVouchers(startDate, endDate, voucherType, selectedBranchId)}
        disabled={loading}
        className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-xs text-[11px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
        <span>पहा</span>
      </button>
    </>
  );

  // If user selected 2-per-page Voucher Slips mode, render the CBS toolbar + 2-per-page CBS slips
  if (viewMode === 'voucher-slips') {
    return (
      <div className="cbs-report-wrapper p-2 sm:p-4 bg-slate-100 min-h-screen print:p-0 print:bg-white">
        <style>
          {`
            @media print {
              .cbs-batch-slips-container > div:nth-child(even) {
                page-break-after: always;
                break-after: page;
              }
              .cbs-batch-slips-container > div:nth-child(odd) {
                margin-bottom: 8mm;
              }
            }
          `}
        </style>

        <CbsReportLayout
          defaultPaperSize={paperSize}
          allowPaperSizeToggle={true}
          reportTitle="व्हाउचर प्रिंटिंग पत्रक"
          reportSubtitle="Voucher Batch Print (CBS v2.4)"
          periodText={`${d(formatDisplayDate(startDate))} ते ${d(formatDisplayDate(endDate))}`}
          branchName={resolvedBranchName}
          sansthaInfo={sanstha}
          customHeader={<></>}
          signatureTier="none"
          onExportExcel={handleExportExcel}
          extraToolbarControls={filterControls}
          isLoading={loading}
          hasData={filteredVouchers.length > 0}
          preparedBy={user ? `${user.username} (${user.role})` : 'Admin'}
          emptyState={
            <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
              <Layers size={32} className="mx-auto mb-2 text-primary/40" />
              <p className="font-semibold text-xs">
                निवडलेल्या कालावधीत कोणतेही व्हाउचर सापडले नाही. कृपया तारीख निवडून &quot;पहा&quot; बटणावर क्लिक करा.
              </p>
            </div>
          }
        >
          <div className="cbs-batch-slips-container space-y-5 print:space-y-0">
            {filteredVouchers.map((voucher, idx) => (
              <div key={voucher.voucherID || idx}>
                <VoucherPrintTemplate
                  voucher={voucher}
                  sanstha={sanstha}
                  signatureTier={signatureTier}
                  isMarathiDigits={isMarathi}
                  preparedBy={user ? `${user.username} (${user.role})` : 'Admin'}
                  branchName={voucher?.branch?.branchName || resolvedBranchName}
                />
              </div>
            ))}
          </div>
        </CbsReportLayout>
      </div>
    );
  }

  // Default: Official CBS Sample Report Tabular Layout (100% Matching CbsSampleReport.tsx)
  return (
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      reportTitle="व्हाउचर प्रिंटिंग व नोंदवही पत्रक"
      reportSubtitle="Voucher Batch Print & Register"
      periodText={`${d(formatDisplayDate(startDate))} ते ${d(formatDisplayDate(endDate))}`}
      branchName={resolvedBranchName}
      sansthaInfo={sanstha}
      summaryBanner={summaryBanner}
      signatureTier={signatureTier}
      signatureTitles={
        signatureTier === '4-tier'
          ? [
              { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
              { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
              { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' },
              { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Board of Directors)' }
            ]
          : [
              { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
              { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
              { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' }
            ]
      }
      onExportExcel={handleExportExcel}
      extraToolbarControls={filterControls}
      isLoading={loading}
      hasData={true}
      preparedBy={user ? `${user.username} (${user.role})` : 'Admin'}
    >
      <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
            <th className="border border-slate-900 py-1.5 px-1 w-[5%] text-center">अ.क्र.</th>
            <th className="border border-slate-900 py-1.5 px-1.5 w-[10%] text-center">दिनांक</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-center">व्हाउचर क्र.</th>
            <th className="border border-slate-900 py-1.5 px-1.5 w-[11%] text-center">प्रकार</th>
            <th className="border border-slate-900 py-1.5 px-2.5 w-[36%] text-left">
              खाते / तपशील (Ledger, Party &amp; Narration)
            </th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">नावे (Dr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">जमा (Cr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-1 text-center no-print print:hidden">पावती</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8} className="border border-slate-900 py-8 text-center text-slate-500 font-semibold">
                व्हाउचर माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
              </td>
            </tr>
          ) : filteredVouchers.length === 0 ? (
            <tr>
              <td colSpan={8} className="border border-slate-900 py-8 text-center text-slate-500 font-semibold">
                निवडलेल्या कालावधीत व निकषांनुसार कोणतेही व्हाउचर आढळले नाही.
              </td>
            </tr>
          ) : (
            filteredVouchers.map((voucher, idx) => {
              const details = Array.isArray(voucher.voucherDetails) ? voucher.voucherDetails : [];
              const vDr = details
                .filter((det: any) => det.drCr === 'Dr')
                .reduce((s: number, det: any) => s + Number(det.amount || 0), 0);
              const vCr = details
                .filter((det: any) => det.drCr === 'Cr')
                .reduce((s: number, det: any) => s + Number(det.amount || 0), 0);
              const partySummary = getVoucherPartySummary(voucher);

              return (
                <tr key={voucher.voucherID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px] align-top">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                    {d(idx + 1)}
                  </td>
                  <td className="border border-slate-900 py-1 px-1.5 text-center font-mono">
                    {d(formatDisplayDate(voucher.voucherDate))}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-900">
                    {d(voucher.voucherNo || '-')}
                    {voucher.scrollNo ? (
                      <span className="block text-[9.5px] text-primary font-semibold">
                        स्क्रॉल #{d(voucher.scrollNo)}
                      </span>
                    ) : null}
                  </td>
                  <td className="border border-slate-900 py-1 px-1.5 text-center font-semibold text-slate-800">
                    {getVoucherTypeLabel(voucher.voucherType)}
                  </td>
                  <td className="border border-slate-900 py-1 px-2.5">
                    {partySummary && partySummary !== '-' && (
                      <div className="font-bold text-slate-950 text-[11px]">
                        खातेदार: <span className="text-primary">{d(partySummary)}</span>
                      </div>
                    )}
                    <div className="space-y-0.5 mt-0.5">
                      {details.map((det: any, dIdx: number) => (
                        <div key={det.voucherDetailID || dIdx} className="text-[10.5px] text-slate-800 flex justify-between gap-2">
                          <span>
                            <strong className={det.drCr === 'Dr' ? 'text-red-700' : 'text-emerald-700'}>
                              [{det.drCr}]
                            </strong>{' '}
                            {det.ledger?.ledgerName || '-'}
                          </span>
                          <span className="font-mono text-slate-600 shrink-0">
                            ₹{fmtVoucherAmt(det.amount, isMarathi)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {voucher.narration && (
                      <div className="text-[10px] text-slate-600 italic mt-0.5 border-t border-dashed border-slate-200 pt-0.5">
                        तपशील: {d(voucher.narration)}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-dr">
                    {vDr > 0 ? fmtVoucherAmt(vDr, isMarathi) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-cr">
                    {vCr > 0 ? fmtVoucherAmt(vCr, isMarathi) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center no-print print:hidden">
                    <button
                      type="button"
                      onClick={() => setSingleSlipVoucher(voucher)}
                      className="px-1.5 py-0.5 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded text-[9.5px] font-bold border border-primary/30 cursor-pointer inline-flex items-center gap-0.5 whitespace-nowrap transition-colors"
                      title="ही व्हाउचर पावती स्वतंत्रपणे पहा व प्रिंट करा"
                    >
                      <Printer size={10} />
                      <span>पावती</span>
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {filteredVouchers.length > 0 && (
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
              <td colSpan={5} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                एकूण व्यवहार बेरीज (Grand Total — एकूण व्हाउचर: {d(metrics.count)}):
              </td>
              <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-dr font-bold">
                ₹ {fmtVoucherAmt(metrics.totalDr, isMarathi)}
              </td>
              <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-cr font-bold">
                ₹ {fmtVoucherAmt(metrics.totalCr, isMarathi)}
              </td>
              <td className="border border-slate-900 py-1.5 px-1 text-center no-print print:hidden">-</td>
            </tr>
          </tfoot>
        )}
      </table>
    </CbsReportLayout>
  );
}
