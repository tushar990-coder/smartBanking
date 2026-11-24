import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Printer,
  FileSpreadsheet,
  Settings,
  ArrowRight,
  Trash2,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';
import { hasPermission } from '../utils/permissionUtils';

interface BranchOption {
  branchID: number;
  branchName: string;
}

interface EmployerOption {
  id: number;
  name: string;
}

interface DemandColumnMeta {
  demandColumnSettingId: number;
  sequenceOrder: number;
  itemType: string;
  columnHeaderMr: string;
  showBalanceColumn: boolean;
  isContributionTarget: boolean;
}

interface DemandCell {
  demandColumnSettingId: number;
  sequenceOrder: number;
  itemType: string;
  columnHeaderMr: string;
  schemeId?: number | null;
  accountId?: number | null;
  sourceAccountIdsCsv?: string | null;
  accountCount?: number;
  hasSubLedgerAccount?: boolean;
  currentBalanceAmount: number;
  demandPrincipalOrDeposit: number;
  demandInterest: number;
  demandPenalInterest: number;
  principalOrDepositLedgerID?: number | null;
  interestLedgerID?: number | null;
  receivableInterestLedgerID?: number | null;
  overdueInterestLedgerID?: number | null;
  loanIntraAllocationOrder?: string;
}

interface DemandRdItem {
  demandColumnSettingId: number;
  sequenceOrder: number;
  subRowIndex: number;
  columnHeaderMr: string;
  rdSchemeID?: number | null;
  accountId?: number | null;
  accountNo?: string;
  displaySubLabel: string;
  currentBalanceAmount: number;
  demandPrincipalOrDeposit: number;
  principalOrDepositLedgerID?: number | null;
}

interface DemandRow {
  srNo: number;
  memberId?: number | null;
  customerId: number;
  isMember?: boolean;
  empCode: string;
  cifNo: string;
  memberName: string;
  isSelected: boolean;
  cells: DemandCell[];
  primaryRd?: DemandRdItem | null;
  rdSubRows: DemandRdItem[];
  totalDeduction: number;
}

const getRowKey = (row: Pick<DemandRow, 'customerId' | 'memberId'>): number =>
  row.customerId > 0 ? row.customerId : Number(row.memberId || 0);

interface SavedNoticeSummary {
  demandNoticeId: number;
  noticeNumber: string;
  month: number;
  year: number;
  demandDate: string;
  employerId: number;
  employerName: string;
  branchId: number;
  branchName: string;
  totalDemandAmount: number;
  totalRecoveredAmount: number;
  pendingAmount: number;
  pendingVoucherCount: number;
  memberCount: number;
  recoveredMemberCount: number;
  status: string;
}

interface EmployeeDemandFormProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const fmtNum = (val: number) =>
  Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtDec = (val: number) =>
  Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EmployeeDemandForm({ onNavigate }: EmployeeDemandFormProps) {
  const { user } = useAuth();
  const canViewSettings = hasPermission(user?.role, 'Settings', 'View');
  const activeBizStr = getBusinessDateStr(user?.businessDate);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employers, setEmployers] = useState<EmployerOption[]>([]);

  const [branchId, setBranchId] = useState<number>(Number(user?.branchID || 1));
  const [employerId, setEmployerId] = useState<number>(0);
  const [demandDate, setDemandDate] = useState<string>(activeBizStr);
  const [onlyBorrowers, setOnlyBorrowers] = useState<boolean>(false);
  const [includeCurrentMonthInstallments, setIncludeCurrentMonthInstallments] = useState<boolean>(true);
  const [contributionAmount, setContributionAmount] = useState<string>('0');
  const [searchEmp, setSearchEmp] = useState<string>('');

  const [columns, setColumns] = useState<DemandColumnMeta[]>([]);
  const [hasRdZone, setHasRdZone] = useState<boolean>(false);
  const [rdZoneSequence, setRdZoneSequence] = useState<number | null>(null);
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [loadedNoticeId, setLoadedNoticeId] = useState<number | null>(null);
  const [loadedNoticeNo, setLoadedNoticeNo] = useState<string>('');
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Validation popup / banner state
  const [validationReport, setValidationReport] = useState<{
    open: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
    rowIssues: Record<string, string[]>;
  } | null>(null);

  // Saved Notices List & Print Modal ("यादी पहा")
  const [isListModalOpen, setIsListModalOpen] = useState<boolean>(false);
  const [savedNotices, setSavedNotices] = useState<SavedNoticeSummary[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);

  useEffect(() => {
    if (user?.businessDate) {
      setDemandDate(getBusinessDateStr(user.businessDate));
    }
    if (user?.branchID) {
      setBranchId(Number(user.branchID));
    }
  }, [user?.businessDate, user?.branchID]);

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [brRes, empRes] = await Promise.all([
          axios.get('/api/Branches'),
          axios.get('/api/Employers')
        ]);
        const brList = Array.isArray(brRes.data) ? brRes.data : [];
        const empList = Array.isArray(empRes.data) ? empRes.data : [];
        setBranches(brList);
        setEmployers(empList);
        if (empList.length > 0 && employerId === 0) {
          setEmployerId(empList[0].id);
        }
      } catch (err) {
        console.error('Failed loading branches/employers', err);
      }
    };
    loadMasters();
  }, []);

  const recomputeRowTotal = (row: DemandRow): number => {
    const cellSum = row.cells.reduce(
      (s, c) => s + Number(c.demandPrincipalOrDeposit || 0) + Number(c.demandInterest || 0),
      0
    );
    const primaryRdAmt = row.primaryRd ? Number(row.primaryRd.demandPrincipalOrDeposit || 0) : 0;
    const subRdSum = (row.rdSubRows || []).reduce((s, r) => s + Number(r.demandPrincipalOrDeposit || 0), 0);
    return Math.round((cellSum + primaryRdAmt + subRdSum) * 100) / 100;
  };

  const handlePreview = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setValidationReport(null);
    setLoadedNoticeId(null);
    setLoadedNoticeNo('');

    if (!employerId || employerId <= 0) {
      setErrorMsg('कृपया खाते प्रकार (नियोक्ता / Employer) निवडा.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/DemandNotices/preview', {
        branchId,
        employerId,
        demandDate,
        onlyBorrowers,
        includeCurrentMonthInstallments,
        contributionAmount: Number(contributionAmount || 0),
        searchQuery: ''
      });

      const data = res.data || {};
      if (data.needsSettingsSetup) {
        setNeedsSetup(true);
        setColumns([]);
        setRows([]);
        setHasRdZone(false);
        setRdZoneSequence(null);
        setErrorMsg(data.message || 'कृपया प्रथम डिमांड सेटिंग्ज कॉन्फिगर करा.');
        return;
      }

      setNeedsSetup(false);
      setColumns(data.columns || []);
      setHasRdZone(Boolean(data.hasRdZone));
      setRdZoneSequence(typeof data.rdZoneSequence === 'number' ? data.rdZoneSequence : null);
      setRows(
        (data.rows || []).map((r: DemandRow) => ({
          ...r,
          memberId: r.memberId ?? null,
          isMember: r.isMember ?? Boolean(r.memberId && r.memberId > 0),
          isSelected: true,
          rdSubRows: r.rdSubRows || []
        }))
      );
    } catch (err: any) {
      const msg = err.response?.data;
      setErrorMsg(typeof msg === 'string' ? msg : 'डिमांड माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered view for "शोधा Emp Code / नाव / CIF" without losing edits in full rows array
  const visibleRows = useMemo(() => {
    const q = searchEmp.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.empCode || '').toLowerCase().includes(q) ||
        (r.cifNo || '').toLowerCase().includes(q) ||
        (r.memberName || '').toLowerCase().includes(q)
    );
  }, [rows, searchEmp]);

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((r) => r.isSelected);

  const handleToggleAll = (checked: boolean) => {
    const visibleKeys = new Set(visibleRows.map((r) => getRowKey(r)));
    setRows((prev) =>
      prev.map((r) => (visibleKeys.has(getRowKey(r)) ? { ...r, isSelected: checked } : r))
    );
  };

  const handleToggleRow = (rowKey: number, checked: boolean) => {
    setRows((prev) => prev.map((r) => (getRowKey(r) === rowKey ? { ...r, isSelected: checked } : r)));
  };

  const handleCellChange = (
    rowKey: number,
    settingId: number,
    field: 'demandPrincipalOrDeposit' | 'demandInterest',
    rawVal: string
  ) => {
    const num = Math.max(0, Number(rawVal) || 0);
    setRows((prev) =>
      prev.map((row) => {
        if (getRowKey(row) !== rowKey) return row;
        const nextCells = row.cells.map((c) =>
          c.demandColumnSettingId === settingId ? { ...c, [field]: num } : c
        );
        const updated: DemandRow = { ...row, cells: nextCells };
        updated.totalDeduction = recomputeRowTotal(updated);
        return updated;
      })
    );
  };

  const handleRdAmountChange = (rowKey: number, rdSubIndex: number, rawVal: string) => {
    const num = Math.max(0, Number(rawVal) || 0);
    setRows((prev) =>
      prev.map((row) => {
        if (getRowKey(row) !== rowKey) return row;
        let nextPrimary = row.primaryRd;
        let nextSubs = row.rdSubRows;

        if (rdSubIndex === 0 && row.primaryRd) {
          nextPrimary = { ...row.primaryRd, demandPrincipalOrDeposit: num };
        } else {
          nextSubs = (row.rdSubRows || []).map((sr) =>
            sr.subRowIndex === rdSubIndex ? { ...sr, demandPrincipalOrDeposit: num } : sr
          );
        }

        const updated: DemandRow = { ...row, primaryRd: nextPrimary, rdSubRows: nextSubs };
        updated.totalDeduction = recomputeRowTotal(updated);
        return updated;
      })
    );
  };

  // Column Footer Totals across Checked (Selected) Rows
  const footerTotals = useMemo(() => {
    const selected = rows.filter((r) => r.isSelected);
    const cellTotals: Record<number, { bal: number; prin: number; intr: number }> = {};

    columns.forEach((col) => {
      cellTotals[col.demandColumnSettingId] = { bal: 0, prin: 0, intr: 0 };
    });

    let rdTotal = 0;
    let grandTotal = 0;

    for (const r of selected) {
      for (const c of r.cells) {
        if (!cellTotals[c.demandColumnSettingId]) {
          cellTotals[c.demandColumnSettingId] = { bal: 0, prin: 0, intr: 0 };
        }
        cellTotals[c.demandColumnSettingId].bal += Number(c.currentBalanceAmount || 0);
        cellTotals[c.demandColumnSettingId].prin += Number(c.demandPrincipalOrDeposit || 0);
        cellTotals[c.demandColumnSettingId].intr += Number(c.demandInterest || 0);
      }
      if (r.primaryRd) rdTotal += Number(r.primaryRd.demandPrincipalOrDeposit || 0);
      for (const sr of r.rdSubRows || []) {
        rdTotal += Number(sr.demandPrincipalOrDeposit || 0);
      }
      grandTotal += Number(r.totalDeduction || 0);
    }

    return {
      totalEmployees: rows.length,
      selectedEmployees: selected.length,
      cellTotals,
      rdTotal: Math.round(rdTotal * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100
    };
  }, [rows, columns]);

  type GridSlot =
    | { kind: 'COL'; sequenceOrder: number; col: DemandColumnMeta }
    | { kind: 'RD_ZONE'; sequenceOrder: number };

  const getColTdCount = (col: DemandColumnMeta) =>
    col.itemType === 'LOAN' ? (col.showBalanceColumn ? 3 : 2) : 1;

  const displaySlots = useMemo<GridSlot[]>(() => {
    const items: GridSlot[] = columns.map((col, idx) => ({
      kind: 'COL',
      sequenceOrder: Number(col.sequenceOrder ?? idx + 1),
      col
    }));
    if (hasRdZone) {
      items.push({
        kind: 'RD_ZONE',
        sequenceOrder: typeof rdZoneSequence === 'number' ? rdZoneSequence : 9999
      });
    }
    return items.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [columns, hasRdZone, rdZoneSequence]);

  const runValidation = async (): Promise<boolean> => {
    setErrorMsg('');
    try {
      const res = await axios.post('/api/DemandNotices/validate', {
        demandNoticeId: loadedNoticeId,
        branchId,
        employerId,
        demandDate,
        onlyBorrowers,
        contributionAmount: Number(contributionAmount || 0),
        rows
      });
      const v = res.data;
      setValidationReport({
        open: true,
        isValid: Boolean(v.isValid),
        errors: v.errors || [],
        warnings: v.warnings || [],
        rowIssues: v.rowIssues || {}
      });
      return Boolean(v.isValid);
    } catch (err: any) {
      setErrorMsg(err.response?.data || 'Validation तपासताना त्रुटी आली.');
      return false;
    }
  };

  const handleSave = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (searchEmp.trim() && visibleRows.length < rows.length) {
      const proceed = window.confirm(
        `सध्या शोध फिल्टर ("${searchEmp.trim()}") सुरू आहे (${visibleRows.length}/${rows.length} दिसत आहेत). जतन केल्यास सर्व निवडलेले ${footerTotals.selectedEmployees} खातेदार जतन होतील. पुढे जायचे का?`
      );
      if (!proceed) return;
    }
    const ok = await runValidation();
    if (!ok) return;

    setSaving(true);
    try {
      const res = await axios.post('/api/DemandNotices/save-grid', {
        demandNoticeId: loadedNoticeId,
        branchId,
        employerId,
        demandDate,
        onlyBorrowers,
        contributionAmount: Number(contributionAmount || 0),
        rows
      });
      setLoadedNoticeId(res.data?.demandNoticeId || null);
      setLoadedNoticeNo(res.data?.noticeNumber || '');
      setSuccessMsg(res.data?.message || 'डिमान्ड यादी यशस्वीरीत्या जतन झाली!');
    } catch (err: any) {
      const msg = err.response?.data;
      setErrorMsg(typeof msg === 'string' ? msg : 'डिमान्ड जतन करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setRows([]);
    setColumns([]);
    setHasRdZone(false);
    setRdZoneSequence(null);
    setLoadedNoticeId(null);
    setLoadedNoticeNo('');
    setSearchEmp('');
    setContributionAmount('0');
    setValidationReport(null);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const openSavedList = async () => {
    setIsListModalOpen(true);
    setLoadingList(true);
    try {
      const res = await axios.get('/api/DemandNotices');
      setSavedNotices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed loading demand notices', err);
    } finally {
      setLoadingList(false);
    }
  };

  const loadSavedNoticeIntoGrid = async (noticeId: number) => {
    setIsListModalOpen(false);
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await axios.get(`/api/DemandNotices/${noticeId}/grid`);
      const data = res.data;
      const n = data.notice;
      setLoadedNoticeId(n.demandNoticeId);
      setLoadedNoticeNo(n.noticeNumber);
      setBranchId(n.branchId);
      setEmployerId(n.employerId);
      setDemandDate((n.demandDate || activeBizStr).split('T')[0]);
      setOnlyBorrowers(Boolean(n.onlyBorrowers));
      setContributionAmount(String(n.contributionInputAmount || 0));
      setColumns(data.columns || []);
      setHasRdZone(Boolean(data.hasRdZone));
      setRdZoneSequence(typeof data.rdZoneSequence === 'number' ? data.rdZoneSequence : null);
      setRows(
        (data.rows || []).map((r: any) => ({
          srNo: r.srNo,
          memberId: r.memberId ?? null,
          customerId: r.customerId,
          isMember: r.isMember ?? Boolean(r.memberId && r.memberId > 0),
          empCode: r.empCode,
          cifNo: r.cifNo,
          memberName: r.memberName,
          isSelected: r.isSelected ?? true,
          cells: r.cells || [],
          primaryRd: r.primaryRd || null,
          rdSubRows: r.rdSubRows || [],
          totalDeduction: r.totalDeduction || 0
        }))
      );
      setSuccessMsg(`जतन केलेली नोटीस क्र. ${n.noticeNumber} लोड केली आहे.`);
    } catch (err: any) {
      setErrorMsg(err.response?.data || 'सेव्ह केलेली नोटीस लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSavedNotice = async (noticeId: number, noticeNo: string) => {
    if (!window.confirm(`तुम्हाला डिमान्ड नोटीस क्र. ${noticeNo} डिलीट करायची आहे का?`)) return;
    try {
      await axios.delete(`/api/DemandNotices/${noticeId}`);
      setSavedNotices((prev) => prev.filter((x) => x.demandNoticeId !== noticeId));
      if (loadedNoticeId === noticeId) handleReset();
    } catch (err: any) {
      alert(err.response?.data || 'डिलीट करताना त्रुटी आली.');
    }
  };

  const handlePrintGrid = () => {
    if (rows.length === 0) return;
    const empName = employers.find((e) => e.id === employerId)?.name || 'नियोक्ता';
    const brName = branches.find((b) => b.branchID === branchId)?.branchName || 'मुख्य शाखा';
    const selected = rows.filter((r) => r.isSelected);

    const colHeadersHtml = displaySlots
      .map((slot) => {
        if (slot.kind === 'RD_ZONE') {
          return `<th>RD योजना / खाते</th><th>RD हप्ता</th>`;
        }
        const col = slot.col;
        if (col.itemType === 'LOAN') {
          return `
            ${col.showBalanceColumn ? `<th>${col.columnHeaderMr}<br/>(बाकी)</th>` : ''}
            <th>${col.columnHeaderMr}<br/>(हप्ता)</th>
            <th>${col.columnHeaderMr}<br/>(व्याज)</th>
          `;
        }
        return `<th>${col.columnHeaderMr}</th>`;
      })
      .join('');

    const bodyHtml = selected
      .map((r, i) => {
        const mainSlotTds = displaySlots
          .map((slot) => {
            if (slot.kind === 'RD_ZONE') {
              return `<td>${r.primaryRd?.displaySubLabel || '-'}</td><td style="text-align:right">${fmtNum(r.primaryRd?.demandPrincipalOrDeposit || 0)}</td>`;
            }
            const col = slot.col;
            const c = r.cells.find((x) => x.demandColumnSettingId === col.demandColumnSettingId);
            if (col.itemType === 'LOAN') {
              return `
                ${col.showBalanceColumn ? `<td style="text-align:right">${fmtNum(c?.currentBalanceAmount || 0)}</td>` : ''}
                <td style="text-align:right">${fmtNum(c?.demandPrincipalOrDeposit || 0)}</td>
                <td style="text-align:right">${fmtNum(c?.demandInterest || 0)}</td>
              `;
            }
            return `<td style="text-align:right">${fmtNum(c?.demandPrincipalOrDeposit || 0)}</td>`;
          })
          .join('');

        const mainRowHtml = `
          <tr>
            <td style="text-align:center">${i + 1}</td>
            <td style="text-align:center">${r.empCode}</td>
            <td style="text-align:center">${r.cifNo}</td>
            <td>${r.memberName}</td>
            ${mainSlotTds}
            <td style="text-align:right;font-weight:bold">${fmtNum(r.totalDeduction)}</td>
          </tr>
        `;

        const subRowsHtml = (r.rdSubRows || [])
          .map((sr) => {
            const subSlotTds = displaySlots
              .map((slot) => {
                if (slot.kind === 'RD_ZONE') {
                  return `<td>${sr.displaySubLabel}</td><td style="text-align:right">${fmtNum(sr.demandPrincipalOrDeposit)}</td>`;
                }
                return Array(getColTdCount(slot.col)).fill('<td style="background:#f1f5f9"></td>').join('');
              })
              .join('');

            return `
            <tr style="background:#f8fafc;font-size:10px;">
              <td></td><td></td><td></td><td style="color:#475569;padding-left:16px">↳ अतिरिक्त RD (Seq ${sr.sequenceOrder})</td>
              ${subSlotTds}
              <td style="text-align:right;color:#64748b">-</td>
            </tr>
          `;
          })
          .join('');

        return mainRowHtml + subRowsHtml;
      })
      .join('');

    const footerSlotTds = displaySlots
      .map((slot) => {
        if (slot.kind === 'RD_ZONE') {
          return `<td></td><td style="text-align:right">${fmtNum(footerTotals.rdTotal)}</td>`;
        }
        const col = slot.col;
        const tot = footerTotals.cellTotals[col.demandColumnSettingId] || { bal: 0, prin: 0, intr: 0 };
        if (col.itemType === 'LOAN') {
          return `
            ${col.showBalanceColumn ? `<td style="text-align:right">${fmtNum(tot.bal)}</td>` : ''}
            <td style="text-align:right">${fmtNum(tot.prin)}</td>
            <td style="text-align:right">${fmtNum(tot.intr)}</td>
          `;
        }
        return `<td style="text-align:right">${fmtNum(tot.prin)}</td>`;
      })
      .join('');

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) return;
    win.document.write(`
      <html><head><title>पगार डिमान्ड यादी - ${empName}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 16px; }
        h2, h4 { margin: 2px 0; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #334155; padding: 4px 6px; }
        th { background: #e2e8f0; }
        .tot { background: #fef08a; font-weight: bold; }
        @media print { @page { size: landscape; margin: 10mm; } }
      </style></head><body>
      <h2>पगारदार / कर्मचारी पतसंस्था मासिक पगार डिमान्ड यादी</h2>
      <h4>शाखा: ${brName} | नियोक्ता: ${empName} | दिनांक (अखेर): ${demandDate} ${loadedNoticeNo ? `| नोटीस क्र.: ${loadedNoticeNo}` : ''}</h4>
      <table>
        <thead><tr>
          <th>अ.नं.</th><th>Emp Code</th><th>CIF</th><th>खातेदाराचे नाव</th>
          ${colHeadersHtml}
          <th>एकूण</th>
        </tr></thead>
        <tbody>
          ${bodyHtml}
          <tr class="tot">
            <td colspan="4" style="text-align:right">एकूण (${footerTotals.selectedEmployees} खातेदार):</td>
            ${footerSlotTds}
            <td style="text-align:right">${fmtNum(footerTotals.grandTotal)}</td>
          </tr>
        </tbody>
      </table>
      <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `);
    win.document.close();
  };

  const handleExportCsv = () => {
    if (rows.length === 0) return;
    const empName = employers.find((e) => e.id === employerId)?.name || 'Employer';
    const selected = rows.filter((r) => r.isSelected);

    const headers: string[] = ['अ. नं.', 'Emp Code', 'CIF', 'खातेदाराचे नाव'];
    displaySlots.forEach((slot) => {
      if (slot.kind === 'RD_ZONE') {
        headers.push('RD योजना / खाते', 'RD हप्ता');
        return;
      }
      const c = slot.col;
      if (c.itemType === 'LOAN') {
        if (c.showBalanceColumn) headers.push(`${c.columnHeaderMr} (बाकी)`);
        headers.push(`${c.columnHeaderMr} (हप्ता)`);
        headers.push(`${c.columnHeaderMr} (व्याज)`);
      } else {
        headers.push(c.columnHeaderMr);
      }
    });
    headers.push('एकूण');

    const lines: string[] = [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];

    selected.forEach((r, idx) => {
      const line: string[] = [String(idx + 1), `"${r.empCode}"`, `"${r.cifNo}"`, `"${r.memberName}"`];
      displaySlots.forEach((slot) => {
        if (slot.kind === 'RD_ZONE') {
          line.push(`"${r.primaryRd?.displaySubLabel || ''}"`, String(r.primaryRd?.demandPrincipalOrDeposit || 0));
          return;
        }
        const col = slot.col;
        const c = r.cells.find((x) => x.demandColumnSettingId === col.demandColumnSettingId);
        if (col.itemType === 'LOAN') {
          if (col.showBalanceColumn) line.push(String(c?.currentBalanceAmount || 0));
          line.push(String(c?.demandPrincipalOrDeposit || 0));
          line.push(String(c?.demandInterest || 0));
        } else {
          line.push(String(c?.demandPrincipalOrDeposit || 0));
        }
      });
      line.push(String(r.totalDeduction || 0));
      lines.push(line.join(','));

      (r.rdSubRows || []).forEach((sr) => {
        const sLine: string[] = ['', `"${r.empCode}"`, `"${r.cifNo}"`, `"↳ ${r.memberName} (अतिरिक्त RD Seq ${sr.sequenceOrder})"`];
        displaySlots.forEach((slot) => {
          if (slot.kind === 'RD_ZONE') {
            sLine.push(`"${sr.displaySubLabel}"`, String(sr.demandPrincipalOrDeposit || 0));
            return;
          }
          const span = getColTdCount(slot.col);
          for (let k = 0; k < span; k++) sLine.push('');
        });
        sLine.push('');
        lines.push(sLine.join(','));
      });
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Demand_${empName.replace(/\s+/g, '_')}_${demandDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-2 max-w-full mx-auto font-sans text-xs bg-slate-50 min-h-[calc(100vh-70px)] flex flex-col">
      {/* Top Module Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-2 border-b-2 border-primary">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-slate-800">
            कर्मचारी पगार डिमान्ड (Employee Salary Demand)
          </h1>
          {loadedNoticeNo && (
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[11px] border border-emerald-300">
              नोटीस क्र.: {loadedNoticeNo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onNavigate && (
            <>
              {canViewSettings && (
                <button
                  type="button"
                  onClick={() => onNavigate('demand-settings')}
                  className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Settings size={13} /> डिमांड सेटिंग्ज (Sequence / Ledger)
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  onNavigate('demand-recovery', loadedNoticeId ? { noticeId: loadedNoticeId } : undefined)
                }
                className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1 cursor-pointer"
              >
                बल्क पगार वसुली <ArrowRight size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Screenshot-matched Top Filter Bar */}
      <div className="bg-white border border-slate-300 rounded-sm p-2 mb-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="font-bold text-slate-700">शाखा</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(Number(e.target.value))}
              className="border border-slate-300 rounded px-2 py-1 bg-white min-w-[140px]"
            >
              <option value={0}>सर्व शाखा (All)</option>
              {branches.map((b) => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="font-bold text-slate-700">खाते प्रकार</label>
            <select
              value={employerId}
              onChange={(e) => setEmployerId(Number(e.target.value))}
              className="border border-slate-300 rounded px-2 py-1 bg-white min-w-[190px] font-semibold"
            >
              <option value={0}>-- नियोक्ता (Employer) निवडा --</option>
              {employers.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="font-bold text-slate-700">दिनांक</label>
            <input
              type="date"
              value={demandDate}
              onChange={(e) => setDemandDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 font-mono"
            />
            <span className="font-bold text-slate-700">(अखेर)</span>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-slate-700 px-1">
            <input
              type="checkbox"
              checked={onlyBorrowers}
              onChange={(e) => setOnlyBorrowers(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span>कर्जदार</span>
          </label>

          <label
            className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-slate-700 px-1"
            title="महिना सुरू होताच थकबाकी नसल्यास चालू महिन्याचा नियमित कर्ज हप्ता (EMI) समाविष्ट करा"
          >
            <input
              type="checkbox"
              checked={includeCurrentMonthInstallments}
              onChange={(e) => setIncludeCurrentMonthInstallments(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span>चालू महिन्याचा हप्ता धरा</span>
          </label>

          <div className="flex items-center gap-1.5 ml-auto">
            <label className="font-bold text-slate-700">वर्गणी ठेव</label>
            <input
              type="number"
              min={0}
              step="1"
              value={contributionAmount}
              onChange={(e) => setContributionAmount(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 w-24 text-right font-mono font-bold"
            />
            <button
              type="button"
              onClick={handlePreview}
              disabled={loading}
              className="px-4 py-1.5 rounded bg-primary hover:opacity-95 text-white font-bold shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? 'लोड होत आहे...' : 'पहा'}
            </button>
          </div>

          <div className="flex items-center gap-1.5 border border-slate-300 rounded px-2 py-0.5 bg-slate-50">
            <Search size={14} className="text-slate-500" />
            <span className="text-[11px] font-bold text-rose-700">शोधा Emp Code:</span>
            <input
              type="text"
              value={searchEmp}
              onChange={(e) => setSearchEmp(e.target.value)}
              placeholder="कोड / नाव / CIF"
              className="bg-white border border-slate-300 rounded px-2 py-0.5 w-32 text-xs focus:outline-none focus:border-primary"
            />
            {searchEmp.trim() && rows.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                {visibleRows.length}/{rows.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="mb-2 p-2 rounded border border-red-300 bg-red-50 text-red-800 font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={15} /> {errorMsg}
          </div>
          {needsSetup && onNavigate && canViewSettings && (
            <button
              type="button"
              onClick={() => onNavigate('demand-settings')}
              className="px-2.5 py-1 rounded bg-red-700 text-white text-[11px] font-bold cursor-pointer"
            >
              सेटिंग्ज उघडा →
            </button>
          )}
        </div>
      )}

      {successMsg && (
        <div className="mb-2 p-2 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} /> {successMsg}
          </div>
          {loadedNoticeId && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('demand-recovery', { noticeId: loadedNoticeId })}
              className="px-3 py-1 rounded bg-emerald-700 text-white font-bold cursor-pointer"
            >
              बल्क पगार वसुलीकडे जा →
            </button>
          )}
        </div>
      )}

      {/* Validation Modal/Banner */}
      {validationReport?.open && (
        <div
          className={`mb-2 p-2.5 rounded border text-xs ${
            validationReport.isValid
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
              : 'border-red-400 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-center justify-between font-bold mb-1">
            <span>
              {validationReport.isValid
                ? '✓ सर्व पडताळणी (Validation) यशस्वी!'
                : `⚠️ Validation त्रुटी आढळल्या (${validationReport.errors.length})`}
            </span>
            <button
              type="button"
              onClick={() => setValidationReport(null)}
              className="p-0.5 hover:bg-black/10 rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          {validationReport.errors.length > 0 && (
            <ul className="list-disc pl-5 space-y-0.5 text-red-800 font-medium">
              {validationReport.errors.map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          )}
          {validationReport.warnings.length > 0 && (
            <ul className="list-disc pl-5 mt-1 space-y-0.5 text-amber-800">
              {validationReport.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Enterprise Editable Grid */}
      <div className="flex-1 bg-white border border-slate-400 rounded-sm shadow-sm overflow-auto max-h-[560px]">
        <table className="min-w-full border-collapse text-[11px]">
          <thead className="bg-slate-200 text-slate-900 sticky top-0 z-20 shadow-2xs">
            <tr>
              <th className="border border-slate-400 px-1.5 py-1.5 w-8 text-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => handleToggleAll(e.target.checked)}
                  className="w-3.5 h-3.5 accent-primary cursor-pointer"
                />
              </th>
              <th className="border border-slate-400 px-1.5 py-1.5 w-10 text-center">अ. नं.</th>
              <th className="border border-slate-400 px-1.5 py-1.5 w-16 text-center">Emp Code</th>
              <th className="border border-slate-400 px-1.5 py-1.5 w-20 text-center">CIF</th>
              <th className="border border-slate-400 px-2 py-1.5 min-w-[180px] text-left">खातेदाराचे नाव</th>

              {displaySlots.map((slot) => {
                if (slot.kind === 'RD_ZONE') {
                  return (
                    <React.Fragment key="rd-zone-header">
                      <th className="border border-slate-400 px-2 py-1 min-w-[155px] text-left bg-indigo-50">
                        RD योजना / खाते
                      </th>
                      <th className="border border-slate-400 px-2 py-1 min-w-[90px] text-right bg-indigo-50">
                        RD हप्ता
                      </th>
                    </React.Fragment>
                  );
                }

                const col = slot.col;
                return col.itemType === 'LOAN' ? (
                  <React.Fragment key={col.demandColumnSettingId}>
                    {col.showBalanceColumn && (
                      <th className="border border-slate-400 px-2 py-1 min-w-[95px] text-right bg-slate-100">
                        {col.columnHeaderMr}
                        <div className="text-[10px] font-semibold text-slate-600">(बाकी)</div>
                      </th>
                    )}
                    <th className="border border-slate-400 px-2 py-1 min-w-[95px] text-right bg-blue-50">
                      {col.columnHeaderMr}
                      <div className="text-[10px] font-bold text-blue-800">(हप्ता / येणेबाकी)</div>
                    </th>
                    <th className="border border-slate-400 px-2 py-1 min-w-[85px] text-right bg-blue-50">
                      {col.columnHeaderMr}
                      <div className="text-[10px] font-bold text-blue-800">(व्याज)</div>
                    </th>
                  </React.Fragment>
                ) : (
                  <th
                    key={col.demandColumnSettingId}
                    className="border border-slate-400 px-2 py-1 min-w-[100px] text-right bg-emerald-50"
                  >
                    {col.columnHeaderMr}
                  </th>
                );
              })}

              <th className="border border-slate-400 px-2 py-1 min-w-[95px] text-right bg-amber-50 font-bold">
                एकूण
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={40} className="p-10 text-center text-slate-500">
                  माहिती पाहण्यासाठी वरील <strong>खाते प्रकार (नियोक्ता)</strong> निवडून <strong>"पहा"</strong> क्लिक करा किंवा <strong>"यादी पहा"</strong> मधून जतन केलेली नोटीस निवडा.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const rowKey = getRowKey(row);
                const rowErr =
                  validationReport?.rowIssues?.[String(rowKey)] ||
                  (row.memberId ? validationReport?.rowIssues?.[String(row.memberId)] : undefined);
                const rowHighlight = rowErr && rowErr.length > 0 ? 'bg-red-50/70' : row.isSelected ? 'bg-white' : 'bg-slate-100/70 opacity-75';

                return (
                  <React.Fragment key={rowKey}>
                    {/* Primary Employee Row */}
                    <tr className={`${rowHighlight} hover:bg-blue-50/40`}>
                      <td className="border border-slate-300 px-1.5 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={row.isSelected}
                          onChange={(e) => handleToggleRow(rowKey, e.target.checked)}
                          className="w-3.5 h-3.5 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="border border-slate-300 px-1.5 py-1 text-center font-medium">{row.srNo}</td>
                      <td className="border border-slate-300 px-1.5 py-1 text-center font-mono">{row.empCode}</td>
                      <td className="border border-slate-300 px-1.5 py-1 text-center font-mono text-[10px]">
                        {row.cifNo}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 font-semibold text-slate-800">
                        {row.memberName}
                        {row.isMember === false && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                            ब-वर्ग / अ-सभासद
                          </span>
                        )}
                        {rowErr && rowErr.length > 0 && (
                          <div className="text-[10px] text-red-700 font-normal">{rowErr[0]}</div>
                        )}
                      </td>

                      {displaySlots.map((slot) => {
                        if (slot.kind === 'RD_ZONE') {
                          return (
                            <React.Fragment key="rd-zone-primary">
                              <td className="border border-slate-300 px-2 py-1 text-left text-[10px] text-indigo-950 bg-indigo-50/30">
                                {row.primaryRd ? (
                                  <span className="font-medium">
                                    {row.primaryRd.displaySubLabel}
                                    <span className="ml-1 text-[9px] text-slate-500">(Seq {row.primaryRd.sequenceOrder})</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="border border-slate-300 p-0.5 bg-indigo-50/30">
                                {row.primaryRd ? (
                                  <input
                                    type="number"
                                    min={0}
                                    step="1"
                                    disabled={!row.isSelected}
                                    value={row.primaryRd.demandPrincipalOrDeposit}
                                    onChange={(e) => handleRdAmountChange(rowKey, 0, e.target.value)}
                                    className="w-full px-1.5 py-0.5 text-right font-mono bg-transparent focus:bg-yellow-50 focus:outline-none border border-transparent focus:border-primary rounded-2xs"
                                  />
                                ) : (
                                  <div className="text-right px-1.5 text-slate-400">0</div>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        }

                        const col = slot.col;
                        const cell = row.cells.find((c) => c.demandColumnSettingId === col.demandColumnSettingId);
                        if (!cell) {
                          if (col.itemType === 'LOAN') {
                            return (
                              <React.Fragment key={col.demandColumnSettingId}>
                                {col.showBalanceColumn && <td className="border border-slate-300 px-1.5 py-1 text-right">0</td>}
                                <td className="border border-slate-300 px-1.5 py-1 text-right">0</td>
                                <td className="border border-slate-300 px-1.5 py-1 text-right">0</td>
                              </React.Fragment>
                            );
                          }
                          return <td key={col.demandColumnSettingId} className="border border-slate-300 px-1.5 py-1 text-right">0</td>;
                        }

                        if (col.itemType === 'LOAN') {
                          return (
                            <React.Fragment key={col.demandColumnSettingId}>
                              {col.showBalanceColumn && (
                                <td
                                  title={
                                    (cell.accountCount || 0) > 1
                                      ? `${cell.accountCount} सक्रिय कर्जांची एकत्रित बाकी`
                                      : undefined
                                  }
                                  className="border border-slate-300 px-2 py-1 text-right bg-slate-50 font-mono text-slate-700"
                                >
                                  {fmtNum(cell.currentBalanceAmount)}
                                  {(cell.accountCount || 0) > 1 && (
                                    <span className="ml-1 text-[9px] px-1 rounded bg-blue-100 text-blue-800 font-sans">
                                      {cell.accountCount} खाती
                                    </span>
                                  )}
                                </td>
                              )}
                              <td className="border border-slate-300 p-0.5">
                                <input
                                  type="number"
                                  min={0}
                                  step="1"
                                  disabled={!row.isSelected}
                                  value={cell.demandPrincipalOrDeposit}
                                  onChange={(e) =>
                                    handleCellChange(rowKey, col.demandColumnSettingId, 'demandPrincipalOrDeposit', e.target.value)
                                  }
                                  className="w-full px-1.5 py-0.5 text-right font-mono bg-transparent focus:bg-yellow-50 focus:outline-none border border-transparent focus:border-primary rounded-2xs"
                                />
                              </td>
                              <td className="border border-slate-300 p-0.5">
                                <input
                                  type="number"
                                  min={0}
                                  step="1"
                                  disabled={!row.isSelected}
                                  value={cell.demandInterest}
                                  onChange={(e) =>
                                    handleCellChange(rowKey, col.demandColumnSettingId, 'demandInterest', e.target.value)
                                  }
                                  className="w-full px-1.5 py-0.5 text-right font-mono bg-transparent focus:bg-yellow-50 focus:outline-none border border-transparent focus:border-primary rounded-2xs"
                                />
                              </td>
                            </React.Fragment>
                          );
                        }

                        return (
                          <td key={col.demandColumnSettingId} className="border border-slate-300 p-0.5">
                            <div className="flex items-center">
                              {col.itemType === 'THRIFT_SAVING' && cell.hasSubLedgerAccount === false && (
                                <span
                                  title="या खातेदाराचे नवीन खाते वसुलीवेळी तयार होईल"
                                  className="ml-1 px-1 rounded bg-amber-100 text-amber-800 text-[9px] shrink-0"
                                >
                                  नवीन
                                </span>
                              )}
                              {col.itemType === 'PIGMY' && cell.hasSubLedgerAccount === false && (
                                <span
                                  title="या खातेदाराचे सक्रिय पिग्मी खाते आढळले नाही"
                                  className="ml-1 px-1 rounded bg-red-100 text-red-700 text-[9px] shrink-0"
                                >
                                  खाते नाही
                                </span>
                              )}
                              <input
                                type="number"
                                min={0}
                                step="1"
                                disabled={!row.isSelected}
                                value={cell.demandPrincipalOrDeposit}
                                onChange={(e) =>
                                  handleCellChange(rowKey, col.demandColumnSettingId, 'demandPrincipalOrDeposit', e.target.value)
                                }
                                className="w-full px-1.5 py-0.5 text-right font-mono bg-transparent focus:bg-yellow-50 focus:outline-none border border-transparent focus:border-primary rounded-2xs"
                              />
                            </div>
                          </td>
                        );
                      })}

                      {/* Employee Row Grand Total */}
                      <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-slate-900 bg-amber-50/60">
                        {fmtNum(row.totalDeduction)}
                      </td>
                    </tr>

                    {/* Additional RD Sub-Rows RIGHT BELOW the same employee row (ordered by Demand Settings Sequence) */}
                    {hasRdZone &&
                      (row.rdSubRows || []).map((sr) => (
                        <tr
                          key={`${rowKey}-rd-${sr.subRowIndex}-${sr.accountId}`}
                          className="bg-indigo-50/50 hover:bg-indigo-100/50 text-slate-700"
                        >
                          <td className="border border-slate-300"></td>
                          <td className="border border-slate-300 text-center text-[10px] text-indigo-600">↳</td>
                          <td className="border border-slate-300"></td>
                          <td className="border border-slate-300"></td>
                          <td className="border border-slate-300 px-2 py-0.5 text-[10px] text-indigo-800 italic">
                            अतिरिक्त RD (क्रम {sr.sequenceOrder})
                          </td>

                          {displaySlots.map((slot) => {
                            if (slot.kind === 'RD_ZONE') {
                              return (
                                <React.Fragment key="rd-zone-sub">
                                  <td className="border border-slate-300 px-2 py-0.5 text-left text-[10px] font-semibold text-indigo-950">
                                    {sr.displaySubLabel}
                                    <span className="ml-1 text-[9px] text-indigo-700">(Seq {sr.sequenceOrder})</span>
                                  </td>
                                  <td className="border border-slate-300 p-0.5">
                                    <input
                                      type="number"
                                      min={0}
                                      step="1"
                                      disabled={!row.isSelected}
                                      value={sr.demandPrincipalOrDeposit}
                                      onChange={(e) => handleRdAmountChange(rowKey, sr.subRowIndex, e.target.value)}
                                      className="w-full px-1.5 py-0.5 text-right font-mono font-semibold text-indigo-950 bg-white/80 focus:bg-yellow-50 focus:outline-none border border-indigo-200 focus:border-primary rounded-2xs"
                                    />
                                  </td>
                                </React.Fragment>
                              );
                            }

                            const col = slot.col;
                            return col.itemType === 'LOAN' ? (
                              <React.Fragment key={col.demandColumnSettingId}>
                                {col.showBalanceColumn && (
                                  <td className="border border-slate-300 bg-slate-100/60"></td>
                                )}
                                <td className="border border-slate-300 bg-slate-100/60"></td>
                                <td className="border border-slate-300 bg-slate-100/60"></td>
                              </React.Fragment>
                            ) : (
                              <td key={col.demandColumnSettingId} className="border border-slate-300 bg-slate-100/60"></td>
                            );
                          })}

                          <td className="border border-slate-300 px-2 py-0.5 text-right text-[10px] text-slate-400">
                            (वर समाविष्ट)
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {/* Sticky Yellow Footer Total Row matching screenshot */}
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-20 bg-yellow-200 text-red-700 font-bold border-t-2 border-yellow-500 shadow-sm">
              <tr>
                <td className="border border-slate-400 px-1 py-1.5"></td>
                <td className="border border-slate-400 px-1 py-1.5"></td>
                <td className="border border-slate-400 px-1 py-1.5"></td>
                <td className="border border-slate-400 px-2 py-1.5 text-right">एकूण</td>
                <td className="border border-slate-400 px-2 py-1.5 text-left">
                  ({footerTotals.selectedEmployees} निवडलेले)
                </td>

                {displaySlots.map((slot) => {
                  if (slot.kind === 'RD_ZONE') {
                    return (
                      <React.Fragment key="rd-zone-footer">
                        <td className="border border-slate-400 px-2 py-1.5 text-right text-[10px]">RD एकूण:</td>
                        <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                          {fmtNum(footerTotals.rdTotal)}
                        </td>
                      </React.Fragment>
                    );
                  }

                  const col = slot.col;
                  const tot = footerTotals.cellTotals[col.demandColumnSettingId] || { bal: 0, prin: 0, intr: 0 };
                  if (col.itemType === 'LOAN') {
                    return (
                      <React.Fragment key={col.demandColumnSettingId}>
                        {col.showBalanceColumn && (
                          <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                            {fmtNum(tot.bal)}
                          </td>
                        )}
                        <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                          {fmtNum(tot.prin)}
                        </td>
                        <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                          {fmtNum(tot.intr)}
                        </td>
                      </React.Fragment>
                    );
                  }
                  return (
                    <td key={col.demandColumnSettingId} className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                      {fmtNum(tot.prin)}
                    </td>
                  );
                })}

                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono text-sm text-red-800">
                  {fmtNum(footerTotals.grandTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Bottom Control Footer matching screenshot */}
      <div className="mt-2 bg-white border border-slate-300 rounded-sm p-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800">एकूण खातेदार</span>
            <input
              type="text"
              readOnly
              value={footerTotals.totalEmployees}
              className="w-16 border border-slate-300 rounded px-2 py-1 text-center font-bold text-red-700 bg-slate-50"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800">निवडलेले खातेदार</span>
            <input
              type="text"
              readOnly
              value={footerTotals.selectedEmployees}
              className="w-16 border border-slate-300 rounded px-2 py-1 text-center font-bold text-red-700 bg-slate-50"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={runValidation}
          disabled={rows.length === 0}
          className="px-6 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm cursor-pointer disabled:opacity-40"
        >
          Validation
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-1.5 rounded bg-primary hover:opacity-95 text-white font-bold shadow-sm cursor-pointer"
          >
            नविन
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || rows.length === 0}
            className="px-4 py-1.5 rounded bg-primary hover:opacity-95 text-white font-bold shadow-sm cursor-pointer disabled:opacity-40"
          >
            {saving ? 'जतन होत आहे...' : 'जतन'}
          </button>
          <button
            type="button"
            onClick={() => (onNavigate ? onNavigate('loan') : handleReset())}
            className="px-4 py-1.5 rounded bg-primary hover:opacity-95 text-white font-bold shadow-sm cursor-pointer"
          >
            बाहेर
          </button>
          <button
            type="button"
            onClick={openSavedList}
            className="px-4 py-1.5 rounded bg-primary hover:opacity-95 text-white font-bold shadow-sm cursor-pointer"
          >
            यादी पहा
          </button>
          {rows.length > 0 && (
            <>
              <button
                type="button"
                onClick={handlePrintGrid}
                className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-800 text-white font-bold flex items-center gap-1 cursor-pointer"
              >
                <Printer size={13} /> प्रिंट
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet size={13} /> एक्सेल
              </button>
            </>
          )}
        </div>
      </div>

      {/* Saved Notices Modal ("यादी पहा") */}
      {isListModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="bg-white rounded shadow-xl border border-slate-300 w-full max-w-5xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 bg-primary text-white">
              <h3 className="font-bold text-sm">जतन केलेल्या पगार डिमान्ड नोटीस यादी (Saved Demand Notices)</h3>
              <button
                type="button"
                onClick={() => setIsListModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 overflow-auto flex-1">
              {loadingList ? (
                <div className="py-8 text-center text-slate-500">यादी लोड होत आहे...</div>
              ) : savedNotices.length === 0 ? (
                <div className="py-8 text-center text-slate-500">अद्याप कोणतीही डिमान्ड नोटीस जतन केलेली नाही.</div>
              ) : (
                <table className="min-w-full border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-800">
                    <tr>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">नोटीस क्र.</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">नियोक्ता (Employer)</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">दिनांक (अखेर)</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">खातेदार</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">एकूण डिमान्ड</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">वसूल</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">शिल्लक</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">स्थिती</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">कृती</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedNotices.map((n) => (
                      <tr key={n.demandNoticeId} className="hover:bg-slate-50">
                        <td className="border border-slate-300 px-2 py-1.5 font-mono font-bold text-primary">
                          {n.noticeNumber}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 font-semibold">{n.employerName}</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center">
                          {(n.demandDate || '').split('T')[0]}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center">
                          {n.recoveredMemberCount}/{n.memberCount}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-mono font-semibold">
                          ₹{fmtDec(n.totalDemandAmount)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-mono text-emerald-700">
                          ₹{fmtDec(n.totalRecoveredAmount)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-mono font-bold text-rose-700">
                          ₹{fmtDec(n.pendingAmount)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              n.status === 'Received'
                                ? 'bg-green-100 text-green-800'
                                : n.status === 'PartiallyReceived'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {n.status}
                          </span>
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => loadSavedNoticeIntoGrid(n.demandNoticeId)}
                              className="px-2 py-0.5 rounded bg-primary text-white font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={12} /> उघडा
                            </button>
                            {onNavigate && n.status !== 'Received' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsListModalOpen(false);
                                  onNavigate('demand-recovery', { noticeId: n.demandNoticeId });
                                }}
                                className="px-2 py-0.5 rounded bg-emerald-700 text-white font-semibold cursor-pointer"
                              >
                                वसुली
                              </button>
                            )}
                            {n.totalRecoveredAmount <= 0 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSavedNotice(n.demandNoticeId, n.noticeNumber)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="डिलीट करा"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
