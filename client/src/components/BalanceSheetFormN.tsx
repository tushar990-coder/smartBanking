import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';
import CbsReportLayout, { CbsPaperSize, formatDisplayDate } from './common/CbsReportLayout';
import {
  Search,
  RefreshCw,
  Scale,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface ReportNode {
  id: number;
  name: string;
  code?: string;
  displayOrder?: number;
  isGroup: boolean;
  amount: number;
  previousYearAmount?: number;
  openingBalance: number;
  openingType: string;
  children: ReportNode[];
}

const fmtCurrency = (n: number | null | undefined) => {
  const num = Number(n || 0);
  const absStr = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return num < -0.004 ? `-${absStr}` : absStr;
};

const hasActivity = (node: ReportNode): boolean => {
  const selfHasActivity =
    Math.abs(node.amount || 0) >= 0.01 ||
    Math.abs(node.previousYearAmount || 0) >= 0.01 ||
    Math.abs(node.openingBalance || 0) >= 0.01;
  if (!node.children || node.children.length === 0) {
    return selfHasActivity;
  }
  const childrenHaveActivity = node.children.some((child) => hasActivity(child));
  return selfHasActivity || childrenHaveActivity;
};

const filterActiveNodes = (nodes: ReportNode[]): ReportNode[] => {
  if (!nodes) return [];
  return nodes
    .filter((node) => hasActivity(node))
    .map((node) => ({
      ...node,
      children: node.children ? filterActiveNodes(node.children) : []
    }));
};

const TreeNode: React.FC<{ node: ReportNode; level: number }> = ({ node, level }) => {
  const [expanded, setExpanded] = useState(true);
  const activeChildren = node.children ? filterActiveNodes(node.children) : [];
  const hasChildren = activeChildren.length > 0;
  const isHead = level === 0 || node.isGroup;
  const prevVal = node.previousYearAmount ?? node.openingBalance ?? 0;
  const isCurrentNegative = Number(node.amount || 0) < -0.004;
  const isPrevNegative = Number(prevVal) < -0.004;

  return (
    <React.Fragment>
      <tr
        className={`transition-colors ${
          isHead
            ? 'bg-slate-50/90 hover:bg-slate-100/80 font-bold text-slate-950'
            : 'bg-white hover:bg-slate-50 font-normal text-slate-900'
        }`}
      >
        <td
          className={`border border-slate-900 py-1 px-1.5 w-[23%] align-top cbs-num-cell ${
            isPrevNegative
              ? 'font-bold text-red-700 text-[10.5px]'
              : isHead
              ? 'font-bold text-slate-900 text-[11px]'
              : 'font-normal text-slate-700 text-[10.5px]'
          }`}
        >
          {Math.abs(Number(prevVal)) >= 0.005 ? fmtCurrency(prevVal) : '-'}
        </td>
        <td
          className="border border-slate-900 py-1 px-2 w-[54%] align-top text-[11px]"
          style={{ paddingLeft: `${level * 0.8 + 0.35}rem` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mr-1 w-3.5 h-3.5 inline-flex items-center justify-center rounded bg-primary/15 hover:bg-primary/25 text-primary font-bold text-[9px] cursor-pointer print:hidden select-none"
            >
              {expanded ? '-' : '+'}
            </button>
          ) : (
            <span className="mr-1 w-3.5 inline-block print:hidden"></span>
          )}
          <span
            className={`font-mono mr-1.5 ${
              isHead ? 'text-primary font-bold print:text-slate-950' : 'text-slate-500 font-normal'
            }`}
          >
            {node.isGroup
              ? node.displayOrder && node.displayOrder > 0
                ? `${node.displayOrder} -`
                : node.code
                ? `${node.code} -`
                : ''
              : `${node.code || node.id} -`}
          </span>
          <span className={isHead ? 'text-slate-950 font-extrabold tracking-tight' : 'text-slate-900 font-normal'}>
            {node.name}
          </span>
          {!isHead && isCurrentNegative && (
            <span className="ml-1 text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-1 rounded print:border-0">
              विपरीत
            </span>
          )}
        </td>
        <td
          className={`border border-slate-900 py-1 px-1.5 w-[23%] align-top cbs-num-cell ${
            isCurrentNegative
              ? 'font-bold text-red-700 text-[11px]'
              : isHead
              ? 'font-bold text-slate-950 text-[11px]'
              : 'font-normal text-slate-800 text-[10.5px]'
          }`}
        >
          {fmtCurrency(node.amount)}
        </td>
      </tr>
      {expanded &&
        hasChildren &&
        activeChildren.map((child, idx) => <TreeNode key={`${child.id}-${idx}`} node={child} level={level + 1} />)}
    </React.Fragment>
  );
};

export default function BalanceSheetFormN() {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paperSize] = useState<CbsPaperSize>('a4-landscape');
  const [signatureTier, setSignatureTier] = useState<'3-tier' | '4-tier'>('3-tier');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);
  const initialBranchId = effectiveBranch === null ? 'all' : String(effectiveBranch);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  useEffect(() => {
    fetchInitData();
    fetchSansthaDetails();
  }, []);

  const fetchSansthaDetails = async () => {
    try {
      const response = await axios.get('/api/SansthaDetails');
      if (response.data) {
        if (Array.isArray(response.data) && response.data.length > 0) {
          setSansthaDetail(response.data[0]);
        } else if (!Array.isArray(response.data)) {
          setSansthaDetail(response.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sanstha detail', err);
    }
  };

  const fetchInitData = async () => {
    try {
      const [resFy, resBranches] = await Promise.all([
        axios.get('/api/FinancialYears'),
        axios.get('/api/Branches')
      ]);

      if (resFy.data && Array.isArray(resFy.data)) {
        const active = resFy.data.find((y: any) => y.isActive);
        if (active) {
          setFromDate(active.startDate.split('T')[0]);
          setToDate(active.endDate.split('T')[0]);
        }
      }

      if (resBranches.data) {
        setBranches(resBranches.data);
      }
    } catch (error) {
      console.error('Failed to fetch active financial year', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = '/api/Reports/BalanceSheet';
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (selectedBranchId !== 'all') params.append('branchId', selectedBranchId);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axios.get(url);
      setReportData(res.data);
    } catch (error) {
      console.error('Error fetching Balance Sheet', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fromDate && toDate) {
      fetchReport();
    }
  }, [fromDate, toDate, selectedBranchId]);

  const handleExportExcel = () => {
    if (!reportData) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');

    const flattenList = (
      nodes: ReportNode[]
    ): { name: string; isGroup: boolean; previousYearAmount: number; amount: number }[] => {
      const result: { name: string; isGroup: boolean; previousYearAmount: number; amount: number }[] = [];
      if (!nodes) return result;
      for (const group of nodes) {
        const groupPrefix =
          group.displayOrder && group.displayOrder > 0
            ? `${group.displayOrder} - `
            : group.code
            ? `${group.code} - `
            : '';
        result.push({
          name: `${groupPrefix}${group.name}`,
          isGroup: true,
          previousYearAmount: group.previousYearAmount || group.openingBalance || 0,
          amount: group.amount || 0
        });
        if (group.children && group.children.length > 0) {
          for (const child of group.children) {
            const childPrefix = child.isGroup
              ? child.displayOrder && child.displayOrder > 0
                ? `${child.displayOrder} - `
                : ''
              : `${child.code || child.id} - `;
            result.push({
              name: `   ${childPrefix}${child.name}`,
              isGroup: false,
              previousYearAmount: child.previousYearAmount || child.openingBalance || 0,
              amount: child.amount || 0
            });
          }
        }
      }
      return result;
    };

    const liabList = flattenList(filterActiveNodes(reportData.liabilities || []));
    const assetList = flattenList(filterActiveNodes(reportData.assets || []));

    const authCap = reportData.authorizedCapital;
    if (authCap && ((authCap.currentYearAmount || 0) > 0 || (authCap.previousYearAmount || 0) > 0)) {
      liabList.unshift({
        name: 'अधिकृत भागभांडवल (मेमो — बेरजेत समाविष्ट नाही)',
        isGroup: true,
        previousYearAmount: authCap.previousYearAmount || 0,
        amount: authCap.currentYearAmount || 0
      });
      assetList.unshift({
        name: '',
        isGroup: false,
        previousYearAmount: 0,
        amount: 0
      });
    }

    const rows: any[] = [];
    rows.push(["नमुना 'न' ताळेबंद (Form N Balance Sheet)"]);
    rows.push([`कालावधी: ${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`]);
    rows.push([]);
    rows.push([
      'देयता आणि भांडवल',
      'मागील वर्ष (₹)',
      'चालू वर्ष (₹)',
      '',
      'मालमत्ता व येणी',
      'मागील वर्ष (₹)',
      'चालू वर्ष (₹)'
    ]);

    const maxRows = Math.max(liabList.length, assetList.length);
    for (let i = 0; i < maxRows; i++) {
      const liab = liabList[i];
      const asset = assetList[i];
      rows.push([
        liab?.name || '',
        liab?.previousYearAmount || 0,
        liab?.amount || 0,
        '',
        asset?.name || '',
        asset?.previousYearAmount || 0,
        asset?.amount || 0
      ]);
    }

    rows.push([]);
    rows.push([
      'एकूण देयता (Total Liabilities)',
      reportData.totalPreviousYearLiabilities || 0,
      reportData.totalLiabilities || 0,
      '',
      'एकूण मालमत्ता (Total Assets)',
      reportData.totalPreviousYearAssets || 0,
      reportData.totalAssets || 0
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Form N');
    XLSX.writeFile(wb, `Form_N_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const isTallied = reportData ? Math.abs((reportData.totalLiabilities || 0) - (reportData.totalAssets || 0)) < 0.01 : false;
  const difference = reportData ? Math.abs((reportData.totalLiabilities || 0) - (reportData.totalAssets || 0)) : 0;

  const selectedBranchName =
    selectedBranchId === 'all'
      ? 'सर्व शाखा (एकत्रित)'
      : branches.find((b) => String(b.branchID) === String(selectedBranchId))?.branchName || '';

  const periodTextStr =
    fromDate && toDate
      ? `${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)} अखेर`
      : toDate
      ? `${formatDisplayDate(toDate)} अखेर`
      : '';

  const hasAuthCap = Boolean(
    reportData?.authorizedCapital &&
      ((reportData.authorizedCapital.currentYearAmount || 0) > 0 ||
        (reportData.authorizedCapital.previousYearAmount || 0) > 0)
  );

  const filterControls = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">शाखा:</label>
        <select
          value={selectedBranchId}
          disabled={!isHOUser}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1.5 text-[10.5px] font-medium bg-white text-slate-800 focus:outline-none focus:border-primary w-28 sm:w-32 disabled:bg-slate-100 disabled:text-slate-600"
        >
          {isHOUser && <option value="all">सर्व शाखा (All)</option>}
          {(isHOUser || !lockedBranchId
            ? branches
            : branches.filter((b) => Number(b.branchID) === Number(lockedBranchId))
          ).map((b) => (
            <option key={b.branchID} value={b.branchID.toString()}>
              {b.branchName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">पासून:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-medium bg-white text-slate-800 focus:outline-none focus:border-primary w-28"
        />
      </div>

      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">पर्यंत:</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-medium bg-white text-slate-800 focus:outline-none focus:border-primary w-28"
        />
      </div>

      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-600 whitespace-nowrap">स्वाक्षरी:</label>
        <select
          value={signatureTier}
          onChange={(e) => setSignatureTier(e.target.value as '3-tier' | '4-tier')}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800 focus:outline-none focus:border-primary"
        >
          <option value="3-tier">३-स्तरीय स्वाक्षरी</option>
          <option value="4-tier">४-स्तरीय स्वाक्षरी</option>
        </select>
      </div>

      <button
        type="button"
        onClick={fetchReport}
        disabled={loading}
        className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
        <span>पहा</span>
      </button>
    </div>
  );

  const summaryBanner = reportData ? (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">
            {hasAuthCap ? 'अधिकृत भागभांडवल (मेमो)' : 'नमुना न दिनांक'}
          </span>
          <strong className="text-primary font-mono text-[11px]">
            {hasAuthCap
              ? `₹ ${fmtCurrency(reportData.authorizedCapital.currentYearAmount)}`
              : toDate
              ? `${formatDisplayDate(toDate)} अखेर`
              : '-'}
          </strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण देयता (Liabilities)</span>
          <strong className="text-slate-900 font-mono text-[11px]">₹ {fmtCurrency(reportData.totalLiabilities)}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण मालमत्ता (Assets)</span>
          <strong className="text-slate-900 font-mono text-[11px]">₹ {fmtCurrency(reportData.totalAssets)}</strong>
        </div>
        <div className="sm:text-right">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">ताळेबंद ताळा स्थिती</span>
          {isTallied ? (
            <strong className="text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1">
              <CheckCircle2 size={12} className="stroke-[2.5]" />
              <span>ताळेबंद जुळले (Tallied)</span>
            </strong>
          ) : (
            <strong className="text-red-700 font-mono font-bold text-[11px] inline-flex items-center gap-1">
              <AlertTriangle size={12} className="stroke-[2.5]" />
              <span>फरक: ₹ {fmtCurrency(difference)}</span>
            </strong>
          )}
        </div>
      </div>

      {((reportData.pendingVouchersCount || 0) > 0 || reportData.isPreviousYearTallied === false) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 text-[10.5px] no-print">
          {(reportData.pendingVouchersCount || 0) > 0 && (
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-semibold">
              <AlertTriangle size={12} className="text-amber-600 shrink-0" />
              <span>
                सूचना: निवडलेल्या तारखेपर्यंत <b>{reportData.pendingVouchersCount}</b> प्रलंबित (Pending) व्हाउचर्स (एकूण ₹
                {fmtCurrency(reportData.pendingVouchersAmount)}) मंजुरीअभावी ताळेबंदात समाविष्ट नाहीत.
              </span>
            </div>
          )}
          {reportData.isPreviousYearTallied === false && (
            <div className="flex items-center gap-1 bg-red-50 border border-red-300 text-red-800 px-2 py-0.5 rounded font-semibold">
              <AlertTriangle size={12} className="text-red-600 shrink-0" />
              <span>मागील वर्षाचा ताळमेळ फरक: ₹{fmtCurrency(reportData.previousYearDifference)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  ) : undefined;

  return (
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      titleStyle="ribbon"
      reportTitle="नमुना 'न' (नियम ६२ (१) पहा) ताळेबंद"
      reportSubtitle="Form N Balance Sheet"
      periodText={periodTextStr}
      branchName={selectedBranchName}
      sansthaInfo={sansthaDetail}
      summaryBanner={summaryBanner}
      signatureTier={signatureTier}
      signatureTitles={
        signatureTier === '4-tier'
          ? [
              { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
              { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
              { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' },
              { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Board of Directors)' }
            ]
          : [
              { title: 'लेखापाल / मुख्य हिशोबनीस', subtitle: '(Accountant)' },
              { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' },
              { title: 'चेअरमन / व्हाईस चेअरमन', subtitle: '(Chairman / Vice-Chairman)' }
            ]
      }
      onExportExcel={handleExportExcel}
      extraToolbarControls={filterControls}
      isLoading={loading}
      hasData={Boolean(reportData)}
      preparedBy={user?.username || 'Admin'}
      emptyState={
        <div className="bg-white p-12 text-center text-slate-500 rounded-xs border border-slate-200 shadow-xs max-w-4xl mx-auto">
          <Scale size={32} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs">माहिती लोड होत आहे किंवा उपलब्ध नाही.</p>
        </div>
      }
    >
      {reportData && (
        <div>
          {/* T-Format Form N Balance Sheet Grid (CBS Standard Table) */}
          <div className="flex w-full border border-slate-900">
            {/* Liabilities Side (Left / देयता आणि भांडवल) */}
            <div className="w-1/2 border-r border-slate-900 flex flex-col">
              <table className="cbs-table w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                    <th className="border border-slate-900 py-1.5 px-1 w-[23%] text-center text-[10px]">
                      {reportData.isMidYearFromDate ? 'पूर्वीची शिल्लक' : 'मागील वर्ष'}
                      <br />
                      <span className="font-mono">{reportData.previousYearLabel || '३१/०३/२०२५'}</span>
                    </th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[54%] text-center text-xs font-extrabold text-primary print:text-slate-950">
                      देयता आणि भांडवल (Liabilities)
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1 w-[23%] text-center text-[10px]">
                      चालू वर्ष
                      <br />
                      <span className="font-mono">
                        {reportData.currentYearLabel || (toDate ? formatDisplayDate(toDate) : '३१/०३/२०२६')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hasAuthCap && (
                    <tr className="bg-primary/5 print:bg-white font-bold text-slate-950 border-b-4 border-double border-slate-900">
                      <td className="border border-slate-900 py-1.5 px-1.5 w-[23%] align-top cbs-num-cell font-bold text-slate-900 text-[11px]">
                        {reportData.authorizedCapital.previousYearAmount > 0
                          ? fmtCurrency(reportData.authorizedCapital.previousYearAmount)
                          : '-'}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-2 w-[54%] align-top text-[11px]">
                        <div className="font-extrabold text-slate-950 tracking-tight">
                          अधिकृत भागभांडवल
                          {selectedBranchId !== 'all' && (
                            <span className="ml-1 text-[9.5px] font-semibold text-slate-600">(संस्था स्तर)</span>
                          )}
                        </div>
                        {(reportData.authorizedCapital.currentYearShareCount > 0 ||
                          reportData.authorizedCapital.shareFaceValue > 0) && (
                          <div className="text-[9.5px] font-normal text-slate-600 leading-tight">
                            {Number(reportData.authorizedCapital.currentYearShareCount || 0).toLocaleString('en-IN')}{' '}
                            शेअर्स @ ₹{fmtCurrency(reportData.authorizedCapital.shareFaceValue || 100)} प्रमाणे (केवळ
                            माहितीसाठी)
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-1.5 w-[23%] align-top cbs-num-cell font-bold text-slate-950 text-[11px]">
                        {reportData.authorizedCapital.currentYearAmount > 0
                          ? fmtCurrency(reportData.authorizedCapital.currentYearAmount)
                          : '-'}
                      </td>
                    </tr>
                  )}
                  {filterActiveNodes(reportData.liabilities || []).map((node: ReportNode, i: number) => (
                    <TreeNode key={`liab-${node.id || node.name}-${i}`} node={node} level={0} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Assets Side (Right / मालमत्ता व येणी) */}
            <div className="w-1/2 flex flex-col">
              <table className="cbs-table w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                    <th className="border border-slate-900 py-1.5 px-1 w-[23%] text-center text-[10px]">
                      {reportData.isMidYearFromDate ? 'पूर्वीची शिल्लक' : 'मागील वर्ष'}
                      <br />
                      <span className="font-mono">{reportData.previousYearLabel || '३१/०३/२०२५'}</span>
                    </th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[54%] text-center text-xs font-extrabold text-primary print:text-slate-950">
                      मालमत्ता व येणी (Assets)
                    </th>
                    <th className="border border-slate-900 py-1.5 px-1 w-[23%] text-center text-[10px]">
                      चालू वर्ष
                      <br />
                      <span className="font-mono">
                        {reportData.currentYearLabel || (toDate ? formatDisplayDate(toDate) : '३१/०३/२०२६')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hasAuthCap && (
                    <tr className="bg-white border-b-4 border-double border-slate-900">
                      <td className="border border-slate-900 py-1.5 px-1.5 w-[23%] text-[11px]">&nbsp;</td>
                      <td className="border border-slate-900 py-1.5 px-2 w-[54%] text-[11px]">
                        <div>&nbsp;</div>
                        {(reportData.authorizedCapital.currentYearShareCount > 0 ||
                          reportData.authorizedCapital.shareFaceValue > 0) && (
                          <div className="text-[9.5px] leading-tight">&nbsp;</div>
                        )}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-1.5 w-[23%] text-[11px]">&nbsp;</td>
                    </tr>
                  )}
                  {filterActiveNodes(reportData.assets || []).map((node: ReportNode, i: number) => (
                    <TreeNode key={`asset-${node.id || node.name}-${i}`} node={node} level={0} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CBS Standard Grand Totals Footer Row */}
          <div className="flex w-full border-b-2 border-l border-r border-slate-900 font-bold text-slate-950 bg-slate-100 text-[11px] break-inside-avoid">
            <div className="w-1/2 flex border-r border-slate-900">
              <div className="w-[23%] py-1.5 px-1.5 border-r border-slate-900 cbs-num-cell font-bold">
                {fmtCurrency(
                  reportData.totalPreviousYearLiabilities ??
                    (reportData.liabilities?.reduce(
                      (sum: number, node: ReportNode) => sum + (node.openingBalance || 0),
                      0
                    ) || 0)
                )}
              </div>
              <div className="w-[54%] py-1.5 px-2 text-right border-r border-slate-900 font-bold uppercase tracking-wide">
                एकूण देयता (Total Liabilities):
              </div>
              <div className="w-[23%] py-1.5 px-1.5 cbs-num-cell font-black text-primary bg-primary/10 print:bg-slate-200 print:text-slate-950">
                ₹ {fmtCurrency(reportData.totalLiabilities || 0)}
              </div>
            </div>
            <div className="w-1/2 flex">
              <div className="w-[23%] py-1.5 px-1.5 border-r border-slate-900 cbs-num-cell font-bold">
                {fmtCurrency(
                  reportData.totalPreviousYearAssets ??
                    (reportData.assets?.reduce(
                      (sum: number, node: ReportNode) => sum + (node.openingBalance || 0),
                      0
                    ) || 0)
                )}
              </div>
              <div className="w-[54%] py-1.5 px-2 text-right border-r border-slate-900 font-bold uppercase tracking-wide">
                एकूण मालमत्ता (Total Assets):
              </div>
              <div className="w-[23%] py-1.5 px-1.5 cbs-num-cell font-black text-primary bg-primary/10 print:bg-slate-200 print:text-slate-950">
                ₹ {fmtCurrency(reportData.totalAssets || 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </CbsReportLayout>
  );
}
