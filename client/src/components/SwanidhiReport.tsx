import React, { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';
import { getBusinessDateStr } from '../utils/businessDateUtils';
import { exportHtmlElementToPdf } from '../utils/daybookPdfExport';
import {
  Printer,
  FileSpreadsheet,
  FileDown,
  RefreshCw,
  Building2,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Info,
  Sparkles,
  Save,
  FolderSync,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Percent,
  Calculator,
  Lock,
  FileCheck,
  ChevronsUpDown
} from 'lucide-react';

interface CategoryConfig {
  categoryCode: string;
  categoryName: string;
  type: string;
  description: string;
}

interface LedgerItem {
  ledgerID: number;
  ledgerName: string;
  ledgerCode: string;
  groupName: string;
  nature: string;
  excludeFromRule35Swanidhi?: boolean;
  asOfBalance?: number;
  asOfBalanceType?: string;
  openingBalance: number;
  openingBalanceType: string;
}

interface MappingItem {
  mappingID?: number;
  categoryCode: string;
  categoryName: string;
  ledgerID: number;
  ledgerName?: string;
  ledgerCode?: string;
  groupName?: string;
}

interface SwanidhiSettingData {
  settingID?: number;
  branchID: number;
  borrowingLimitMultiplier: number;
  year1DividendRate: number;
  year2DividendRate: number;
  year3DividendRate: number;
  averageDividendRate: number;
  manualCertifiedNetProfit: number | null;
}

const fmtCur = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const fmtLakh = (n: number | null | undefined) => {
  return (n || 0).toFixed(2);
};

export default function SwanidhiReport() {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const effectiveGlobalBranch = getEffectiveBranchId(user, globalBranchId);

  // Rule 35 is a Society-wide (Consolidated) norm: HO users default to 'all' (Consolidated)
  const initialBranchSelection = isHOUser
    ? (effectiveGlobalBranch && effectiveGlobalBranch > 0 ? String(effectiveGlobalBranch) : 'all')
    : String(lockedBranchId || user?.branchID || 1);

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchSelection);
  const [activeTab, setActiveTab] = useState<'report' | 'mapping'>('report');
  const [asOnDate, setAsOnDate] = useState<string>(() => getBusinessDateStr(user?.businessDate));
  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(10.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any>(null);

  // Mapping & Config State
  const [canEditConfig, setCanEditConfig] = useState<boolean>(isHOUser);
  const [isAutoSuggestedPreview, setIsAutoSuggestedPreview] = useState<boolean>(false);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [allLedgers, setAllLedgers] = useState<LedgerItem[]>([]);
  const [savedMappings, setSavedMappings] = useState<MappingItem[]>([]);
  const [settings, setSettings] = useState<SwanidhiSettingData>({
    branchID: lockedBranchId || 1,
    borrowingLimitMultiplier: 10.0,
    year1DividendRate: 9.0,
    year2DividendRate: 9.0,
    year3DividendRate: 9.0,
    averageDividendRate: 9.0,
    manualCertifiedNetProfit: null
  });
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({ '४.': true });
  const [showBorrowingItems, setShowBorrowingItems] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const printAreaRef = useRef<HTMLDivElement>(null);

  const getBranchParam = (bVal = selectedBranchId): number | undefined => {
    if (!bVal || bVal === 'all') return undefined;
    const parsed = Number(bVal);
    return parsed > 0 ? parsed : undefined;
  };

  useEffect(() => {
    fetchBranches();
    fetchConfig(initialBranchSelection, asOnDate);
    fetchReport(asOnDate, undefined, initialBranchSelection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await api.get('/api/Branches');
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch branches', err);
    }
  };

  const fetchReport = async (
    dateVal = asOnDate,
    multVal?: number,
    branchVal = selectedBranchId
  ) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params: Record<string, any> = { asOnDate: dateVal };
      const bParam = getBranchParam(branchVal);
      if (bParam) params.branchId = bParam;
      if (multVal !== undefined && multVal > 0) params.customMultiplier = multVal;

      const res = await api.get('/api/Swanidhi/Report', { params });
      if (res.data) {
        setReportData(res.data);
        if (res.data.borrowingLimitMultiplier) {
          setSelectedMultiplier(res.data.borrowingLimitMultiplier);
        }
      }
    } catch (err: any) {
      console.error('Failed to load Swanidhi Report', err);
      setErrorMsg(err?.response?.data?.message || 'स्वनिधी अहवाल लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async (branchVal = selectedBranchId, dateVal = asOnDate) => {
    try {
      const params: Record<string, any> = { asOnDate: dateVal };
      const bParam = getBranchParam(branchVal);
      if (bParam) params.branchId = bParam;

      const res = await api.get('/api/Swanidhi/Config', { params });
      if (res.data) {
        setCanEditConfig(Boolean(res.data.canEditConfig));
        setIsAutoSuggestedPreview(Boolean(res.data.isAutoSuggestedPreview));
        setCategories(res.data.categories || []);
        setAllLedgers(res.data.allLedgers || []);
        setSavedMappings(res.data.savedMappings || []);
        if (res.data.setting) {
          setSettings(res.data.setting);
          setSelectedMultiplier(res.data.setting.borrowingLimitMultiplier || 10.0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Swanidhi Config', err);
    }
  };

  const handleBranchChange = async (newBranch: string) => {
    setSelectedBranchId(newBranch);
    await Promise.all([
      fetchConfig(newBranch, asOnDate),
      fetchReport(asOnDate, undefined, newBranch)
    ]);
  };

  const handleSaveConfig = async () => {
    if (!canEditConfig) {
      setErrorMsg('फक्त मुख्य कार्यालय (HO / Admin / SuperAdmin) यांनाच स्वनिधी नियम व मॅपिंग बदलण्याचा अधिकार आहे.');
      return;
    }

    setLoading(true);
    setSaveSuccessMsg('');
    setErrorMsg('');
    try {
      const targetSettingBranch = getBranchParam(selectedBranchId) || 1;
      const payload = {
        branchID: targetSettingBranch,
        borrowingLimitMultiplier: Number(settings.borrowingLimitMultiplier) || 10.0,
        year1DividendRate: Number(settings.year1DividendRate) || 0,
        year2DividendRate: Number(settings.year2DividendRate) || 0,
        year3DividendRate: Number(settings.year3DividendRate) || 0,
        manualCertifiedNetProfit:
          settings.manualCertifiedNetProfit !== null &&
          settings.manualCertifiedNetProfit !== undefined &&
          String(settings.manualCertifiedNetProfit) !== ''
            ? Number(settings.manualCertifiedNetProfit)
            : null,
        mappings: savedMappings.map(m => ({
          categoryCode: m.categoryCode,
          categoryName: m.categoryName,
          ledgerID: m.ledgerID
        }))
      };

      await api.post('/api/Swanidhi/Config', payload);
      setSaveSuccessMsg('स्वनिधी डायनॅमिक लेजर मॅपिंग व नियम यशस्वीरीत्या सेव्ह झाले (Audit Log नोंदवले)!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
      await fetchConfig(selectedBranchId, asOnDate);
      await fetchReport(asOnDate, payload.borrowingLimitMultiplier, selectedBranchId);
    } catch (err: any) {
      console.error('Failed to save config', err);
      setErrorMsg(
        err?.response?.status === 403
          ? 'परवानगी नाकारली (403): फक्त HO / Admin / SuperAdmin सेटिंग्ज बदलू शकतात.'
          : err?.response?.data?.message || (typeof err?.response?.data === 'string' ? err.response.data : 'मॅपिंग जतन करताना त्रुटी आली.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMap = async () => {
    if (!canEditConfig) {
      setErrorMsg('फक्त मुख्य कार्यालय (HO / Admin / SuperAdmin) यांनाच Smart Auto-Map चालवण्याचा अधिकार आहे.');
      return;
    }
    if (!window.confirm('तुम्हाला खरोखर प्रणालीद्वारे आपोआप उपलब्ध लेजर्स स्वनिधीच्या शासकीय हेड्सशी मॅप करायचे आहेत का?')) {
      return;
    }
    setLoading(true);
    setSaveSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await api.post('/api/Swanidhi/AutoMap');
      setSaveSuccessMsg(`${res.data?.message || 'आपोआप मॅपिंग पूर्ण झाले!'}`);
      setTimeout(() => setSaveSuccessMsg(''), 5000);
      await fetchConfig(selectedBranchId, asOnDate);
      await fetchReport(asOnDate, undefined, selectedBranchId);
    } catch (err: any) {
      console.error('Auto map failed', err);
      setErrorMsg(
        err?.response?.status === 403
          ? 'परवानगी नाकारली (403): फक्त HO / Admin / SuperAdmin ऑटो-मॅप करू शकतात.'
          : err?.response?.data?.message || 'ऑटो मॅपिंग अयशस्वी.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleLedgerMapping = (categoryCode: string, ledgerID: number) => {
    if (!canEditConfig) return;
    const existing = savedMappings.find(m => m.ledgerID === ledgerID);
    if (existing) {
      if (existing.categoryCode === categoryCode) {
        setSavedMappings(savedMappings.filter(m => m.ledgerID !== ledgerID));
      } else {
        const cat = categories.find(c => c.categoryCode === categoryCode);
        setSavedMappings(
          savedMappings.map(m =>
            m.ledgerID === ledgerID
              ? { ...m, categoryCode, categoryName: cat?.categoryName || categoryCode }
              : m
          )
        );
      }
    } else {
      const cat = categories.find(c => c.categoryCode === categoryCode);
      const ledger = allLedgers.find(l => l.ledgerID === ledgerID);
      setSavedMappings([
        ...savedMappings,
        {
          categoryCode,
          categoryName: cat?.categoryName || categoryCode,
          ledgerID,
          ledgerName: ledger?.ledgerName,
          ledgerCode: ledger?.ledgerCode,
          groupName: ledger?.groupName
        }
      ]);
    }
  };

  const removeMapping = (ledgerID: number) => {
    if (!canEditConfig) return;
    setSavedMappings(savedMappings.filter(m => m.ledgerID !== ledgerID));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!reportData || !printAreaRef.current) return;
    setExportingPdf(true);
    try {
      await exportHtmlElementToPdf({
        element: printAreaRef.current,
        filename: `Rule35_Swanidhi_Report_${reportData.targetDate || asOnDate}.pdf`,
        format: 'a4',
        orientation: 'portrait',
        marginMm: 6
      });
    } catch (err) {
      console.error('PDF export failed', err);
      setErrorMsg('PDF तयार करताना त्रुटी आली.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (!reportData) return;

    try {
      const bCap = reportData.borrowingCapacity || reportData.compliance || {};
      const exp2 = reportData.explanation2Breakdown || reportData.dividendCalc || {};
      const netSwanidhiVal = bCap.netOwnedFunds ?? (reportData?.netSwanidhi?.amountInRupees || 0);
      const maxLimitVal = bCap.maxBorrowingLimit ?? Math.max(0, netSwanidhiVal * selectedMultiplier);
      const actualLiabVal = bCap.actualOutsideLiabilities || 0;
      const surplusVal = bCap.surplusHeadroom ?? (maxLimitVal - actualLiabVal);
      const grossVal = bCap.grossOwnedFunds ?? (reportData.totalA?.amountInRupees || 0);
      const totalDedVal = bCap.totalDeductions ?? (reportData.totalB?.amountInRupees || 0);

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('नियम ३५ स्वनिधी अहवाल');
      ws.columns = [
        { width: 10 },
        { width: 48 },
        { width: 28 },
        { width: 20 },
        { width: 16 }
      ];

      const addMergedTitle = (text: string, size: number, bold = true) => {
        const row = ws.addRow([text]);
        ws.mergeCells(row.number, 1, row.number, 5);
        row.font = { bold, size };
        row.alignment = { horizontal: 'center', vertical: 'middle' };
        return row;
      };

      addMergedTitle(reportData.sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित', 14);
      addMergedTitle(reportData.sanstha?.address || '', 10, false);
      addMergedTitle(
        `नोंदणी क्र.: ${reportData.sanstha?.registrationNo || '-'} | शाखा: ${reportData.branchName || 'सर्व शाखा एकत्रित'} | दिनांक: ${reportData.targetDateDisplay || asOnDate} रोजी अखेर`,
        10
      );
      ws.addRow([]);
      addMergedTitle(
        `महाराष्ट्र सहकारी संस्था नियम, १९६१ चे नियम ३५ अन्वये स्वनिधी व कमाल उचल मर्यादा विवरणपत्र (${selectedMultiplier} पट)`,
        11
      );
      ws.addRow([]);

      const styleHeader = (row: ExcelJS.Row) => {
        row.font = { bold: true };
        row.eachCell(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
          c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      };

      addMergedTitle('भाग - १ : स्वनिधी गणन विवरणपत्र (Calculation of Owned Funds)', 11);
      styleHeader(ws.addRow(['अ.क्र.', 'तपशिल (Particulars)', 'संदर्भ / आधार', 'रक्कम रुपयांत (₹)', 'रक्कम लाखांत (Lakhs)']));
      ws.addRow(['(अ)', 'स्वनिधीमध्ये समाविष्ट होणारे घटक (Inclusions):', '', '', '']).font = { bold: true };

      const incRows = (reportData.rows || []).filter(
        (r: any) => !r.isTotal && !r.isGrandTotal && !r.isDeduction && r.srNo !== 'ब)' && r.srNo !== 'क)'
      );
      incRows.forEach((r: any) => {
        ws.addRow([r.srNo || '', r.particular || '', r.reference || '', r.amountInRupees ?? 0, r.amountInLakhs ?? 0]);
        if (r.items && r.items.length > 0) {
          r.items.forEach((si: any) => {
            const val = si.balance ?? si.amount ?? 0;
            ws.addRow(['', `   ↳ ${si.ledgerName || si.label}`, 'उप-लेजर', val, Number((val / 100000).toFixed(2))]);
          });
        }
      });

      ws.addRow(['', 'एकूण - (अ) सकल स्वनिधी (Total Gross Owned Funds)', '', grossVal, Number((grossVal / 100000).toFixed(2))]).font = { bold: true };
      ws.addRow(['(ब)', 'वजावटी (Deductions):', '', '', '']).font = { bold: true };
      (reportData.deductions || []).forEach((d: any) => {
        ws.addRow([d.srNo || '१.', d.particular || 'संचित तोटा', d.reference || '', d.amountInRupees ?? 0, d.amountInLakhs ?? 0]);
      });
      ws.addRow(['', 'एकूण - (ब) एकूण वजावटी (Total Deductions)', '', totalDedVal, Number((totalDedVal / 100000).toFixed(2))]).font = { bold: true };
      const netRow = ws.addRow(['(क)', 'एकूण - निव्वळ स्वनिधी (Net Owned Funds) [अ - ब]', '', netSwanidhiVal, Number((netSwanidhiVal / 100000).toFixed(2))]);
      netRow.font = { bold: true };
      netRow.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
      });

      ws.addRow([]);
      addMergedTitle('भाग - २ : नियम ३५ अन्वये कमाल उचल मर्यादा व प्रत्यक्ष देयता ताळमेळ विवरणपत्र', 11);
      styleHeader(ws.addRow(['अ.क्र.', 'तपशिल / विवरण', 'नियम / आधार', 'रक्कम रुपयांत (₹)', 'रक्कम लाखांत (Lakhs)']));
      ws.addRow(['१.', 'निव्वळ स्वनिधी (Net Owned Funds)', 'भाग-१ मधील (क) प्रमाणे', netSwanidhiVal, Number((netSwanidhiVal / 100000).toFixed(2))]);
      ws.addRow(['२.', 'अनुज्ञेय कमाल उचल मर्यादा गुणक', 'पोटनियम व नियम ३५ नुसार', `${selectedMultiplier} पट`, `${selectedMultiplier} पट`]);
      ws.addRow(['३.', 'एकूण अनुज्ञेय कमाल उचल मर्यादा [१ × २]', `स्वनिधीच्या ${selectedMultiplier} पट`, maxLimitVal, Number((maxLimitVal / 100000).toFixed(2))]).font = { bold: true };
      ws.addRow(['४.', 'संस्थेची प्रत्यक्ष बाह्य देणी / उचल (As-On Date):', '', '', '']).font = { bold: true };
      ws.addRow(['(अ)', 'बचत ठेवी (Savings Bank Deposits)', 'अखेर दिनांक शिल्लक', bCap.savingBalance || 0, Number(((bCap.savingBalance || 0) / 100000).toFixed(2))]);
      ws.addRow(['(ब)', 'मुदत ठेवी (Fixed Deposits)', 'अखेर दिनांक शिल्लक', bCap.fdBalance || 0, Number(((bCap.fdBalance || 0) / 100000).toFixed(2))]);
      ws.addRow(['(क)', 'आवर्ती ठेवी (Recurring Deposits - RD)', 'अखेर दिनांक शिल्लक', bCap.rdBalance || 0, Number(((bCap.rdBalance || 0) / 100000).toFixed(2))]);
      ws.addRow(['(ड)', 'दैनिक / पिग्मी ठेवी (Daily / Pigmy Deposits)', 'अखेर दिनांक शिल्लक', bCap.pigmyBalance || 0, Number(((bCap.pigmyBalance || 0) / 100000).toFixed(2))]);
      ws.addRow(['(इ)', 'इतर बाह्य वित्तीय संस्था कर्जे / पुनर्गहाण (Outside Borrowings)', 'GL / SansthaBorrowings', bCap.outsideBankLoans || 0, Number(((bCap.outsideBankLoans || 0) / 100000).toFixed(2))]);
      ws.addRow(['', 'एकूण प्रत्यक्ष बाह्य देयता / उचल [अ+ब+क+ड+इ]', 'एकूण बाह्य देणी', actualLiabVal, Number((actualLiabVal / 100000).toFixed(2))]).font = { bold: true };
      ws.addRow([
        '५.',
        bCap.isComplied ? 'शिल्लक सुरक्षित उचल मर्यादा [३ वजा ४]' : 'अतिरिक्त उचल / तूट [३ वजा ४]',
        bCap.isComplied ? 'मर्यादा शिल्लक' : 'तूट',
        Math.abs(surplusVal),
        Number((Math.abs(surplusVal) / 100000).toFixed(2))
      ]).font = { bold: true };
      ws.addRow(['६.', 'नियम ३५ चे पालन व वैधानिक निष्कर्ष', bCap.complianceStatusText || '', bCap.detailedComplianceNote || '', '']);

      ws.addRow([]);
      addMergedTitle('भाग - ३ : स्पष्टीकरण-२ शिल्लक निव्वळ नफा संगणन', 11);
      ws.addRow(['', '१. प्रमाणित निव्वळ नफा (₹):', '', exp2.certifiedNetProfit || 0, '']);
      ws.addRow(['', '२. मागील ३ वर्षांचे लाभांश दर सरासरी (%):', '', `${exp2.averageDividendRate ?? avgDiv}%`, '']);
      ws.addRow(['', '३. वजा: नियोजित लाभांश रक्कम (₹):', '', exp2.estimatedDividendAmount || 0, '']);
      ws.addRow(['', '४. स्वनिधीत ग्राह्य शिल्लक नफा (₹):', '', exp2.surplusProfitInOwnedFunds || 0, '']);

      ws.getColumn(4).numFmt = '#,##0.00';
      ws.getColumn(5).numFmt = '#,##0.00';

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `Rule35_Swanidhi_Report_${reportData.targetDate || asOnDate}.xlsx`
      );
    } catch (err) {
      console.error('Excel export failed', err);
      setErrorMsg('एक्सेल फाईल तयार करताना त्रुटी आली.');
    }
  };

  const toggleRow = (srNo: string) => {
    setExpandedRows(prev => ({ ...prev, [srNo]: !prev[srNo] }));
  };

  const toggleAllRows = () => {
    const anyCollapsed = inclusionRows.some((r: any) => r.items?.length > 0 && !expandedRows[r.srNo]);
    const next: { [key: string]: boolean } = {};
    inclusionRows.forEach((r: any) => {
      if (r.items?.length > 0) next[r.srNo] = anyCollapsed;
    });
    setExpandedRows(next);
    setShowBorrowingItems(anyCollapsed);
  };

  // Exact consecutive 3-year average — strictly aligned with SwanidhiSetting.AverageDividendRate
  const avgDiv = (
    (Math.max(0, Number(settings.year1DividendRate || 0)) +
      Math.max(0, Number(settings.year2DividendRate || 0)) +
      Math.max(0, Number(settings.year3DividendRate || 0))) /
    3
  ).toFixed(2);

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-1';
  const inputClass =
    'w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[30px] disabled:bg-slate-100 disabled:text-slate-500';

  const bCap = reportData?.borrowingCapacity || reportData?.compliance || {};
  const exp2 = reportData?.explanation2Breakdown || reportData?.dividendCalc || {};
  const stdProvInfo = reportData?.standardAssetProvisionInfo || null;
  const grossOwnedFunds = bCap.grossOwnedFunds ?? (reportData?.totalA?.amountInRupees || 0);
  const totalDeductions = bCap.totalDeductions ?? (reportData?.totalB?.amountInRupees || 0);
  const netOwnedFunds = bCap.netOwnedFunds ?? (reportData?.netSwanidhi?.amountInRupees || 0);
  const maxBorrowingLimit = bCap.maxBorrowingLimit ?? Math.max(0, netOwnedFunds * selectedMultiplier);
  const savingBalance = bCap.savingBalance || 0;
  const fdBalance = bCap.fdBalance || 0;
  const rdBalance = bCap.rdBalance || 0;
  const pigmyBalance = bCap.pigmyBalance || 0;
  const outsideBankLoans = bCap.outsideBankLoans || 0;
  const outsideBankLoanItems: Array<{ ledgerID: number; ledgerName: string; balance: number }> = bCap.outsideBankLoanItems || [];
  const actualOutsideLiabilities = bCap.actualOutsideLiabilities ?? (savingBalance + fdBalance + rdBalance + pigmyBalance + outsideBankLoans);
  const surplusHeadroom = bCap.surplusHeadroom ?? (maxBorrowingLimit - actualOutsideLiabilities);
  const isComplied = bCap.isComplied ?? (netOwnedFunds > 0 && surplusHeadroom >= 0);
  const isMultiplierSimulated = Boolean(reportData?.isMultiplierSimulated || bCap.isMultiplierSimulated);
  const configuredMultiplier = reportData?.configuredMultiplier ?? settings.borrowingLimitMultiplier ?? 10;
  const complianceStatusText =
    bCap.complianceStatusText ||
    (isComplied ? '✅ नियम ३५ चे तंतोतंत पालन (मर्यादा सुरक्षित)' : '⚠️ मर्यादा ओलांडली (तूट)');
  const detailedComplianceNote = bCap.detailedComplianceNote || bCap.complianceText || '';

  const inclusionRows = (reportData?.rows || []).filter(
    (r: any) =>
      !r.isTotal &&
      !r.isGrandTotal &&
      !r.isDeduction &&
      r.srNo !== 'ब)' &&
      r.srNo !== 'क)' &&
      !r.particular?.includes('एकूण') &&
      !r.particular?.includes('वजा')
  );

  const deductionRows =
    reportData?.deductions && reportData.deductions.length > 0
      ? reportData.deductions
      : (reportData?.rows || []).filter(
          (r: any) => r.isDeduction || r.srNo === 'ब)' || r.particular?.includes('तोटा')
        );

  const hasSavingGlVariance = Math.abs(bCap.savingGlVariance || 0) >= 1 && (bCap.savingGlBalance || 0) > 0;
  const hasPigmyGlVariance = Math.abs(bCap.pigmyGlVariance || 0) >= 1 && (bCap.pigmyGlBalance || 0) > 0;

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans print:p-0 print:bg-white">
      {/* Clean A4 Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 8mm 8mm 8mm;
            }
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              overflow: visible !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              page-break-inside: auto !important;
              break-inside: auto !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            thead {
              display: table-header-group !important;
            }
          }
        `}
      </style>

      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-slate-300 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2 no-print">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Building2 size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>स्वनिधी व नियम ३५ कमाल उचल मर्यादा</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">
                (Rule 35 Swanidhi &amp; Borrowing Limit)
              </span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              महाराष्ट्र शासन सहकार आयुक्त व निबंधक परिपत्रक आणि नियम ३५ अन्वये अधिकृत स्वनिधी व कमाल उचल अहवाल
            </p>
          </div>
        </div>

        {/* Tab Switcher & Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="bg-slate-100 p-0.5 rounded-sm border border-slate-300 flex items-center gap-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`px-2.5 py-1 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-white text-primary shadow-2xs border border-gray-300 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              शासकीय अहवाल (Report)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mapping')}
              className={`px-2.5 py-1 rounded-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'mapping'
                  ? 'bg-white text-primary shadow-2xs border border-gray-300 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              लेजर मॅपिंग व नियम (Mapping)
            </button>
          </div>

          {activeTab === 'report' && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={!reportData || loading}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-sm flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                title="Excel Export (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                एक्सेल
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!reportData || loading || exportingPdf}
                className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold rounded-sm flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                title="PDF Download"
              >
                <FileDown className="w-3.5 h-3.5" />
                {exportingPdf ? 'PDF...' : 'PDF'}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={!reportData || loading}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white border border-slate-700 text-[11px] font-bold rounded-sm flex items-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                title="A4 Print"
              >
                <Printer className="w-3.5 h-3.5" />
                प्रिंट (A4)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {saveSuccessMsg && (
        <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-sm flex items-center gap-2 shadow-2xs no-print font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-sm flex items-center gap-2 shadow-2xs no-print font-medium">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OFFICIAL STATUTORY REPORT (MAHARASHTRA COOP CIRCULAR TEMPLATE)     */}
      {/* ========================================================================= */}
      {activeTab === 'report' && (
        <div className="space-y-3">
          {/* Filter Bar with Branch / Consolidated Selector */}
          <div className="bg-white px-3.5 py-2 rounded-sm border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 text-[11px] no-print">
            <div className="flex flex-wrap items-center gap-3">
              {/* Branch Selector */}
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <label className="font-bold text-gray-700 whitespace-nowrap">शाखा:</label>
                <select
                  value={selectedBranchId}
                  disabled={!isHOUser}
                  onChange={e => handleBranchChange(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary font-semibold text-gray-800 bg-white h-[30px] disabled:bg-slate-100 disabled:text-slate-600"
                >
                  {isHOUser && <option value="all">सर्व शाखा एकत्रित (Consolidated)</option>}
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

              {/* As On Date */}
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <label className="font-bold text-gray-700 whitespace-nowrap">दिनांक:</label>
                <input
                  type="date"
                  value={asOnDate}
                  onChange={e => setAsOnDate(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary font-medium text-gray-800 bg-white h-[30px]"
                />
              </div>

              {/* Multiplier Simulation Selector */}
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                <label className="font-bold text-gray-700 whitespace-nowrap">मर्यादा पट:</label>
                <select
                  value={selectedMultiplier}
                  onChange={e => setSelectedMultiplier(Number(e.target.value))}
                  className="px-2 py-1 border border-primary/30 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary font-bold text-primary bg-primary/5 h-[30px]"
                >
                  <option value={10}>१० पट (10x - सामान्य)</option>
                  <option value={12}>१२ पट (12x - 'अ' वर्ग)</option>
                  <option value={15}>१५ पट (15x - विशेष)</option>
                  <option value={8}>८ पट (8x - इतर)</option>
                </select>
                {isMultiplierSimulated && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-bold">
                    सिम्युलेशन (सेव्ह: {configuredMultiplier} पट)
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => fetchReport(asOnDate, selectedMultiplier, selectedBranchId)}
                disabled={loading}
                className="px-3 py-1 bg-primary hover:opacity-90 text-white font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors h-[30px] cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                अहवाल तयार करा
              </button>
            </div>

            <button
              type="button"
              onClick={toggleAllRows}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
              title="प्रिंटसाठी सर्व उप-लेजर तपशील उघडा किंवा बंद करा"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              सर्व तपशील उघडा/बंद करा
            </button>
          </div>

          {reportData?.usedInMemoryAutoSuggestions && (
            <div className="p-2 bg-amber-50 border border-amber-300 text-amber-900 text-[10.5px] rounded-sm flex items-center gap-2 no-print">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                टीप: अद्याप कोणतेही कायमस्वरूपी स्वनिधी लेजर मॅपिंग सेव्ह केलेले नाही; सध्या प्रणालीच्या स्वयंचलित सूचनेवरून प्रिव्ह्यू दिसत आहे. कृपया <strong>लेजर मॅपिंग व नियम</strong> टॅबमध्ये तपासून सेव्ह करा.
              </span>
            </div>
          )}

          {/* KPI Dashboard Cards (Screen Only) */}
          {reportData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 no-print">
              <div className="bg-white p-3 rounded-sm border border-slate-300 border-l-4 border-l-primary shadow-2xs flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण सकल स्वनिधी (अ)</div>
                  <div className="text-sm font-bold text-gray-900 font-mono">₹ {fmtCur(grossOwnedFunds)}</div>
                  <div className="text-[10px] text-primary font-bold">{fmtLakh(grossOwnedFunds / 100000)} लाख</div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-sm border border-slate-300 border-l-4 border-l-emerald-600 shadow-2xs flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">निव्वळ स्वनिधी (अ - ब)</div>
                  <div className={`text-sm font-bold font-mono ${netOwnedFunds >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                    ₹ {fmtCur(netOwnedFunds)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold">{fmtLakh(netOwnedFunds / 100000)} लाख</div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-sm border border-slate-300 border-l-4 border-l-purple-600 shadow-2xs flex items-center gap-3">
                <div className="p-2 bg-purple-50 text-purple-700 rounded-sm">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    कमाल उचल मर्यादा ({selectedMultiplier} पट)
                  </div>
                  <div className="text-sm font-bold text-purple-900 font-mono">₹ {fmtCur(maxBorrowingLimit)}</div>
                  <div className="text-[10px] text-purple-700 font-bold">{fmtLakh(maxBorrowingLimit / 100000)} लाख</div>
                </div>
              </div>

              <div
                className={`p-3 rounded-sm border shadow-2xs flex items-center gap-3 ${
                  isComplied
                    ? 'bg-emerald-50/70 border-emerald-300 border-l-4 border-l-emerald-600'
                    : 'bg-rose-50/70 border-rose-300 border-l-4 border-l-rose-600'
                }`}
              >
                <div className={`p-2 rounded-sm ${isComplied ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {isComplied ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">नियम ३५ अनुपालन</div>
                  <div className={`text-xs font-bold ${isComplied ? 'text-emerald-900' : 'text-rose-900'}`}>
                    {complianceStatusText}
                  </div>
                  <div className="text-[10px] text-gray-600 font-medium">
                    {isComplied ? 'शिल्लक मर्यादा:' : 'तूट:'} ₹ {fmtCur(Math.abs(surplusHeadroom))} ({fmtLakh(Math.abs(surplusHeadroom) / 100000)} लाख)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATUTORY A4 PRINTABLE CANVAS                                             */}
          {/* ========================================================================= */}
          <div
            ref={printAreaRef}
            className="print-area bg-white p-5 md:p-7 rounded-sm border border-slate-300 shadow-md print:shadow-none print:border-none print:p-0"
          >
            {/* 1. Official Co-operative Society Header Box */}
            <div className="border-2 border-gray-900 p-3 text-center bg-white mb-2">
              <div className="flex justify-between items-center text-[11px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1.5">
                <div>
                  <span>नोंदणी क्र. : </span>
                  <span className="font-mono">{reportData?.sanstha?.registrationNo || '-'}</span>
                </div>
                <div>
                  <span>शाखा : </span>
                  <span className="text-primary font-bold">{reportData?.branchName || 'सर्व शाखा एकत्रित'}</span>
                </div>
                <div>
                  <span>नोंदणी दिनांक : </span>
                  <span className="font-mono">{reportData?.sanstha?.registrationDate || '-'}</span>
                </div>
              </div>

              <h1 className="text-base sm:text-lg font-black text-gray-950 tracking-tight font-serif uppercase">
                {reportData?.sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h1>

              <p className="text-[11px] font-bold text-gray-800 mt-0.5">
                {reportData?.sanstha?.address || ''}
                {reportData?.sanstha?.village ? ` मु. ${reportData.sanstha.village}, ` : ''}
                {reportData?.sanstha?.taluka ? `ता. ${reportData.sanstha.taluka}, ` : ''}
                {reportData?.sanstha?.district ? `जि. ${reportData.sanstha.district} ` : ''}
                {reportData?.sanstha?.pincode ? `- ${reportData.sanstha.pincode} ` : ''}
                {reportData?.sanstha?.phoneNo ? `| फोन : ${reportData.sanstha.phoneNo}` : ''}
              </p>
            </div>

            {/* 2. Official Statutory Report Title Box */}
            <div className="mb-3 text-center">
              <div className="inline-block border-2 border-gray-900 bg-gray-50/90 px-6 py-1 rounded-xs shadow-2xs">
                <h2 className="text-xs sm:text-sm font-black text-gray-950 tracking-wide font-serif">
                  महाराष्ट्र सहकारी संस्था नियम, १९६१ चे नियम ३५ अन्वये स्वनिधी व कमाल उचल मर्यादा विवरणपत्र
                </h2>
                <div className="text-[10px] font-bold text-gray-700 tracking-normal">
                  (Statement of Owned Funds and Maximum Borrowing Limit under Rule 35 of MCS Rules, 1961)
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] font-bold text-gray-900 mt-2 px-1 border-b-2 border-gray-800 pb-1">
                <div>
                  दिनांक : <span className="font-mono">{reportData?.targetDateDisplay || asOnDate}</span> रोजी अखेर
                </div>
                <div>
                  अनुज्ञेय कमाल उचल मर्यादा : <span className="text-primary font-mono">{selectedMultiplier} पट</span>
                </div>
                <div>
                  आकडे : <span className="font-mono">रुपयांत (₹) व लाखांत (Lakhs)</span>
                </div>
              </div>
            </div>

            {/* PART 1 : OWNED FUNDS */}
            <div className="mt-4 mb-1">
              <div className="bg-gray-800 text-white px-3 py-1 font-bold text-xs flex justify-between items-center rounded-t-xs border border-gray-800">
                <span>भाग - १ : स्वनिधी गणन विवरणपत्र (Calculation of Owned Funds / Swanidhi)</span>
                <span className="text-[10px] font-normal text-gray-200">महाराष्ट्र शासन सहकार आयुक्त व निबंधक परिपत्रकानुसार</span>
              </div>

              <table className="w-full text-[11px] border-collapse border-2 border-gray-900">
                <thead>
                  <tr className="bg-gray-100 text-gray-900 font-bold border-b-2 border-gray-900 text-center">
                    <th className="border border-gray-700 px-2 py-1 w-12 text-center">अ.क्र.</th>
                    <th className="border border-gray-700 px-3 py-1 text-left">तपशिल (Particulars)</th>
                    <th className="border border-gray-700 px-2 py-1 text-left w-52">संदर्भ / आधार (Reference)</th>
                    <th className="border border-gray-700 px-3 py-1 text-right w-40">रुपयांत (₹)</th>
                    <th className="border border-gray-700 px-3 py-1 text-right w-32">लाखांत (Lakhs)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-200/90 font-black text-gray-950 border-b border-gray-700">
                    <td className="border border-gray-700 px-2 py-1 text-center font-black">(अ)</td>
                    <td colSpan={4} className="border border-gray-700 px-3 py-1 uppercase tracking-wide">
                      स्वनिधीमध्ये समाविष्ट होणारे घटक (Inclusions to Owned Funds)
                    </td>
                  </tr>

                  {inclusionRows.map((row: any, idx: number) => {
                    const hasDrillDown = row.items && row.items.length > 0;
                    const isExpanded = expandedRows[row.srNo];

                    return (
                      <React.Fragment key={`inc-${idx}`}>
                        <tr className="hover:bg-slate-50 text-gray-900 border-b border-gray-300">
                          <td className="border border-gray-600 px-2 py-1 text-center font-bold">{row.srNo}</td>
                          <td className="border border-gray-600 px-3 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-gray-900">{row.particular}</span>
                              {hasDrillDown && (
                                <button
                                  type="button"
                                  onClick={() => toggleRow(row.srNo)}
                                  className="text-primary hover:opacity-80 text-[10px] font-bold flex items-center gap-1 no-print cursor-pointer shrink-0"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronDown className="w-3.5 h-3.5" />
                                      बंद ({row.items.length})
                                    </>
                                  ) : (
                                    <>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                      तपशील ({row.items.length})
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="border border-gray-600 px-2 py-1 text-gray-600 text-[10px]">
                            {row.reference || '-'}
                          </td>
                          <td className="border border-gray-600 px-3 py-1 text-right font-mono text-gray-900 font-semibold">
                            {row.amountInRupees !== null && row.amountInRupees !== undefined ? fmtCur(row.amountInRupees) : '-'}
                          </td>
                          <td className="border border-gray-600 px-3 py-1 text-right font-mono font-bold text-gray-900">
                            {row.amountInLakhs !== null && row.amountInLakhs !== undefined ? fmtLakh(row.amountInLakhs) : '-'}
                          </td>
                        </tr>

                        {hasDrillDown &&
                          isExpanded &&
                          row.items.map((si: any, sIdx: number) => (
                            <tr key={`inc-${idx}-sub-${sIdx}`} className="bg-primary/5 text-[10px] text-gray-700">
                              <td className="border border-gray-300 px-2 py-0.5 text-center text-gray-400">↳</td>
                              <td className="border border-gray-300 px-6 py-0.5 italic">
                                <div className="flex items-center justify-between">
                                  <span>{si.ledgerName || si.label}</span>
                                  {si.ledgerID && <span className="text-[9.5px] text-gray-400 font-mono">GL-{si.ledgerID}</span>}
                                </div>
                              </td>
                              <td className="border border-gray-300 px-2 py-0.5 text-gray-500 italic text-[9.5px]">उप-लेजर</td>
                              <td className="border border-gray-300 px-3 py-0.5 text-right font-mono text-gray-600">
                                {fmtCur(si.balance ?? si.amount)}
                              </td>
                              <td className="border border-gray-300 px-3 py-0.5 text-right font-mono text-gray-500">
                                {fmtLakh((si.balance ?? si.amount) / 100000)}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}

                  <tr className="bg-amber-50/70 font-extrabold text-gray-950 border-t-2 border-b-2 border-gray-900">
                    <td className="border border-gray-700 px-2 py-1 text-center font-black"></td>
                    <td colSpan={2} className="border border-gray-700 px-3 py-1 text-left font-black tracking-wide">
                      एकूण - (अ) सकल स्वनिधी (Total Gross Owned Funds)
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-gray-950">
                      ₹ {fmtCur(grossOwnedFunds)}
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-gray-950">
                      {fmtLakh(grossOwnedFunds / 100000)}
                    </td>
                  </tr>

                  {/* Section B: Deductions */}
                  <tr className="bg-rose-50/80 font-black text-rose-950 border-b border-gray-700">
                    <td className="border border-gray-700 px-2 py-1 text-center font-black">(ब)</td>
                    <td colSpan={4} className="border border-gray-700 px-3 py-1 uppercase tracking-wide">
                      वजावटी (Deductions from Owned Funds)
                    </td>
                  </tr>

                  {deductionRows.map((dRow: any, dIdx: number) => (
                    <tr key={`ded-${dIdx}`} className="hover:bg-slate-50 text-gray-800 border-b border-gray-300">
                      <td className="border border-gray-600 px-2 py-1 text-center font-bold">
                        {dRow.srNo || `${dIdx + 1}.`}
                      </td>
                      <td className="border border-gray-600 px-3 py-1 text-rose-900 font-semibold">
                        {dRow.particular || 'संचित तोटा (Accumulated Losses)'}
                      </td>
                      <td className="border border-gray-600 px-2 py-1 text-gray-600 text-[10px]">
                        {dRow.reference || 'ताळेबंद तोटा'}
                      </td>
                      <td className="border border-gray-600 px-3 py-1 text-right font-mono text-rose-700 font-semibold">
                        {fmtCur(dRow.amountInRupees || 0)}
                      </td>
                      <td className="border border-gray-600 px-3 py-1 text-right font-mono text-rose-700 font-bold">
                        {fmtLakh(dRow.amountInLakhs ?? (dRow.amountInRupees || 0) / 100000)}
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-rose-50/50 font-bold text-rose-950 border-t border-b-2 border-gray-900">
                    <td className="border border-gray-700 px-2 py-1 text-center font-black"></td>
                    <td colSpan={2} className="border border-gray-700 px-3 py-1 text-left font-black tracking-wide">
                      एकूण - (ब) एकूण वजावटी (Total Deductions)
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-rose-800">
                      ₹ {fmtCur(totalDeductions)}
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-rose-800">
                      {fmtLakh(totalDeductions / 100000)}
                    </td>
                  </tr>

                  {/* Section C: Net Owned Funds */}
                  <tr className="bg-emerald-50 font-black text-emerald-950 border-t-2 border-b-4 border-emerald-900 text-xs">
                    <td className="border border-emerald-800 px-2 py-1.5 text-center font-black text-xs">(क)</td>
                    <td colSpan={2} className="border border-emerald-800 px-3 py-1.5 text-left font-black tracking-wide text-xs">
                      एकूण - निव्वळ स्वनिधी [अ - ब] (Net Owned Funds / Swanidhi)
                    </td>
                    <td className="border border-emerald-800 px-3 py-1.5 text-right font-mono font-black text-emerald-950 text-xs">
                      ₹ {fmtCur(netOwnedFunds)}
                    </td>
                    <td className="border border-emerald-800 px-3 py-1.5 text-right font-mono font-black text-emerald-950 text-xs">
                      {fmtLakh(netOwnedFunds / 100000)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Standard Asset Provision 0.40% Informational Note (Not inflated into Swanidhi) */}
              {stdProvInfo?.shortfallNote && (
                <div className="mt-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xs text-[10px] text-[#5A1A14] flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#9A3412] shrink-0 mt-0.5" />
                  <span>{stdProvInfo.shortfallNote}</span>
                </div>
              )}
            </div>

            {/* PART 2 : RULE 35 BORROWING LIMIT VS LIABILITIES */}
            <div className="mt-5 mb-1">
              <div className="bg-gray-800 text-white px-3 py-1 font-bold text-xs flex justify-between items-center rounded-t-xs border border-gray-800">
                <span>भाग - २ : नियम ३५ अन्वये कमाल उचल मर्यादा व प्रत्यक्ष देयता ताळमेळ विवरणपत्र</span>
                <span className="text-[10px] font-normal text-gray-200">MCS Rules, 1961 - Rule 35 Borrowing Limit Reconciliation</span>
              </div>

              <table className="w-full text-[11px] border-collapse border-2 border-gray-900">
                <thead>
                  <tr className="bg-gray-100 text-gray-900 font-bold border-b-2 border-gray-900 text-center">
                    <th className="border border-gray-700 px-2 py-1 w-12 text-center">अ.क्र.</th>
                    <th className="border border-gray-700 px-3 py-1 text-left">तपशिल / विवरण (Particulars)</th>
                    <th className="border border-gray-700 px-2 py-1 text-left w-52">नियम / आधार (Norm / Basis)</th>
                    <th className="border border-gray-700 px-3 py-1 text-right w-40">रुपयांत (₹)</th>
                    <th className="border border-gray-700 px-3 py-1 text-right w-32">लाखांत (Lakhs)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-slate-50 text-gray-900 font-bold border-b border-gray-400">
                    <td className="border border-gray-600 px-2 py-1 text-center font-bold">१.</td>
                    <td className="border border-gray-600 px-3 py-1 font-bold">निव्वळ स्वनिधी (Net Owned Funds)</td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-600">भाग-१ मधील (क) प्रमाणे</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono font-bold text-gray-950">
                      ₹ {fmtCur(netOwnedFunds)}
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono font-bold text-gray-950">
                      {fmtLakh(netOwnedFunds / 100000)}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-400">
                    <td className="border border-gray-600 px-2 py-1 text-center font-bold">२.</td>
                    <td className="border border-gray-600 px-3 py-1">
                      नियम ३५ अन्वये अनुज्ञेय कमाल उचल मर्यादा गुणक (Permissible Multiplier)
                    </td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-600">पोटनियम व नियम ३५ नुसार</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono font-bold text-primary">
                      {selectedMultiplier} पट
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono font-bold text-primary">
                      {selectedMultiplier} पट
                    </td>
                  </tr>

                  <tr className="bg-purple-50 font-black text-purple-950 border-t-2 border-b-2 border-purple-800">
                    <td className="border border-purple-700 px-2 py-1.5 text-center font-black">३.</td>
                    <td className="border border-purple-700 px-3 py-1.5 font-black tracking-wide">
                      एकूण अनुज्ञेय कमाल उचल मर्यादा [१ × २] (Max Permissible Limit)
                    </td>
                    <td className="border border-purple-700 px-2 py-1.5 text-purple-900 font-bold">
                      स्वनिधीच्या {selectedMultiplier} पट
                    </td>
                    <td className="border border-purple-700 px-3 py-1.5 text-right font-mono font-black text-purple-950">
                      ₹ {fmtCur(maxBorrowingLimit)}
                    </td>
                    <td className="border border-purple-700 px-3 py-1.5 text-right font-mono font-black text-purple-950">
                      {fmtLakh(maxBorrowingLimit / 100000)}
                    </td>
                  </tr>

                  <tr className="bg-slate-200/90 font-black text-gray-950 border-b border-gray-700">
                    <td className="border border-gray-700 px-2 py-1 text-center font-black">४.</td>
                    <td colSpan={4} className="border border-gray-700 px-3 py-1 uppercase tracking-wide">
                      संस्थेची प्रत्यक्ष बाह्य देणी / उचल (Actual Outside Liabilities as on {reportData?.targetDateDisplay || asOnDate})
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-300">
                    <td className="border border-gray-600 px-2 py-1 text-center">(अ)</td>
                    <td className="border border-gray-600 px-3 py-1 pl-6">बचत ठेवी (Savings Bank Deposits)</td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-500 text-[10px]">
                      दिनांक अखेर As-Of शिल्लक
                    </td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">{fmtCur(savingBalance)}</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">{fmtLakh(savingBalance / 100000)}</td>
                  </tr>

                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-300">
                    <td className="border border-gray-600 px-2 py-1 text-center">(ब)</td>
                    <td className="border border-gray-600 px-3 py-1 pl-6">मुदत ठेवी (Fixed Deposits)</td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-500 text-[10px]">दिनांक अखेर As-Of शिल्लक</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">{fmtCur(fdBalance)}</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">{fmtLakh(fdBalance / 100000)}</td>
                  </tr>

                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-300">
                    <td className="border border-gray-600 px-2 py-1 text-center">(क)</td>
                    <td className="border border-gray-600 px-3 py-1 pl-6">आवर्ती ठेवी (Recurring Deposits - RD)</td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-500 text-[10px]">दिनांक अखेर As-Of शिल्लक</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">{fmtCur(rdBalance)}</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">{fmtLakh(rdBalance / 100000)}</td>
                  </tr>

                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-300">
                    <td className="border border-gray-600 px-2 py-1 text-center">(ड)</td>
                    <td className="border border-gray-600 px-3 py-1 pl-6">दैनिक / पिग्मी ठेवी (Daily / Pigmy Deposits)</td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-500 text-[10px]">दिनांक अखेर As-Of शिल्लक</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">{fmtCur(pigmyBalance)}</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">{fmtLakh(pigmyBalance / 100000)}</td>
                  </tr>

                  <tr className="hover:bg-slate-50 text-gray-800 border-b border-gray-400">
                    <td className="border border-gray-600 px-2 py-1 text-center">(इ)</td>
                    <td className="border border-gray-600 px-3 py-1 pl-6">
                      <div className="flex items-center justify-between gap-2">
                        <span>इतर बाह्य वित्तीय संस्थांची कर्जे / पुनर्गहाण उचल (Outside Borrowings)</span>
                        {outsideBankLoanItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowBorrowingItems(prev => !prev)}
                            className="text-primary text-[10px] font-bold flex items-center gap-0.5 no-print cursor-pointer"
                          >
                            {showBorrowingItems ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            तपशील ({outsideBankLoanItems.length})
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-600 px-2 py-1 text-gray-500 text-[10px]">GL / SansthaBorrowings</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">{fmtCur(outsideBankLoans)}</td>
                    <td className="border border-gray-600 px-3 py-1 text-right font-mono">{fmtLakh(outsideBankLoans / 100000)}</td>
                  </tr>

                  {showBorrowingItems &&
                    outsideBankLoanItems.map((bi, bIdx) => (
                      <tr key={`brw-${bIdx}`} className="bg-primary/5 text-[10px] text-gray-700">
                        <td className="border border-gray-300 px-2 py-0.5 text-center text-gray-400">↳</td>
                        <td className="border border-gray-300 px-8 py-0.5 italic">{bi.ledgerName}</td>
                        <td className="border border-gray-300 px-2 py-0.5 text-gray-500 italic text-[9.5px]">बाह्य कर्ज लेजर</td>
                        <td className="border border-gray-300 px-3 py-0.5 text-right font-mono">{fmtCur(bi.balance)}</td>
                        <td className="border border-gray-300 px-3 py-0.5 text-right font-mono">{fmtLakh(bi.balance / 100000)}</td>
                      </tr>
                    ))}

                  <tr className="bg-slate-100 font-extrabold text-gray-950 border-t-2 border-b-2 border-gray-900">
                    <td className="border border-gray-700 px-2 py-1 text-center"></td>
                    <td colSpan={2} className="border border-gray-700 px-3 py-1 text-left font-black tracking-wide">
                      एकूण प्रत्यक्ष बाह्य देयता / उचल [अ+ब+क+ड+इ] (Total Actual Outside Liabilities)
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-gray-950">
                      ₹ {fmtCur(actualOutsideLiabilities)}
                    </td>
                    <td className="border border-gray-700 px-3 py-1 text-right font-mono font-black text-gray-950">
                      {fmtLakh(actualOutsideLiabilities / 100000)}
                    </td>
                  </tr>

                  <tr
                    className={`font-black border-t-2 border-b-2 ${
                      isComplied ? 'bg-emerald-50 text-emerald-950 border-emerald-800' : 'bg-rose-50 text-rose-950 border-rose-800'
                    }`}
                  >
                    <td className="border border-gray-700 px-2 py-1.5 text-center font-black">५.</td>
                    <td className="border border-gray-700 px-3 py-1.5 font-black">
                      {isComplied
                        ? 'शिल्लक सुरक्षित उचल मर्यादा (Surplus Borrowing Headroom) [३ वजा ४]'
                        : 'अतिरिक्त उचल / मर्यादा तूट (Excess Outside Liabilities / Deficit) [३ वजा ४]'}
                    </td>
                    <td className="border border-gray-700 px-2 py-1.5 font-bold">
                      {isComplied ? 'सुरक्षित मर्यादा शिल्लक' : 'मर्यादा ओलांडली (तूट)'}
                    </td>
                    <td className="border border-gray-700 px-3 py-1.5 text-right font-mono font-black text-xs">
                      ₹ {fmtCur(Math.abs(surplusHeadroom))}
                    </td>
                    <td className="border border-gray-700 px-3 py-1.5 text-right font-mono font-black text-xs">
                      {fmtLakh(Math.abs(surplusHeadroom) / 100000)}
                    </td>
                  </tr>

                  <tr className="bg-gray-50 border-b-2 border-gray-900">
                    <td className="border border-gray-700 px-2 py-2 text-center font-bold">६.</td>
                    <td colSpan={4} className="border border-gray-700 p-2.5">
                      <div className="flex items-start gap-2">
                        {isComplied ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className={`font-black text-xs ${isComplied ? 'text-emerald-900' : 'text-rose-900'}`}>
                            नियम ३५ वैधानिक निष्कर्ष व अनुपालन शेरा :{' '}
                            {isComplied
                              ? '✅ नियम ३५ चे तंतोतंत पालन (संस्था आर्थिकदृष्ट्या सुरक्षित)'
                              : '⚠️ सावधान: नियम ३५ कमाल मर्यादा उल्लंघन'}
                          </div>
                          <p className="text-[10.5px] text-gray-700 mt-1 leading-relaxed">{detailedComplianceNote}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* GL vs Sub-Ledger Variance Audit Note (Screen Only) */}
              {(hasSavingGlVariance || hasPigmyGlVariance) && (
                <div className="mt-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-xs text-[10px] text-amber-950 no-print flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>GL ताळमेळ सूचना:</strong>{' '}
                    {hasSavingGlVariance && `बचत Sub-Ledger (₹${fmtCur(savingBalance)}) वि. GL (₹${fmtCur(bCap.savingGlBalance)}) तफावत ₹${fmtCur(bCap.savingGlVariance)}. `}
                    {hasPigmyGlVariance && `पिग्मी Sub-Ledger (₹${fmtCur(pigmyBalance)}) वि. GL (₹${fmtCur(bCap.pigmyGlBalance)}) तफावत ₹${fmtCur(bCap.pigmyGlVariance)}.`}
                  </span>
                </div>
              )}
            </div>

            {/* PART 3 : EXPLANATION NOTES & WORKINGS */}
            <div className="mt-5 space-y-3">
              {exp2 && (
                <div className="p-3 bg-amber-50/60 border border-amber-300 rounded-xs text-[11px]">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5 mb-2">
                    <Calculator className="w-4 h-4 text-amber-700" />
                    <span>स्पष्टीकरण-२ : शिल्लक निव्वळ नफा संगणन कार्यपत्रिका (Explanation-2 Net Profit Breakdown)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-gray-800 text-[10.5px]">
                    <div className="p-2 bg-white rounded-xs border border-amber-200">
                      <span className="text-gray-500 block text-[10px]">
                        १. प्रमाणित निव्वळ नफा {exp2.usedManualCertifiedNetProfit ? '(Manual)' : '(P&L)'} :
                      </span>
                      <strong className="text-[11px] font-mono font-bold text-gray-900">
                        ₹ {fmtCur(exp2.certifiedNetProfit || 0)}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-xs border border-amber-200">
                      <span className="text-gray-500 block text-[10px]">२. सलग ३ वर्षे सरासरी लाभांश दर :</span>
                      <strong className="text-[11px] text-primary font-mono font-bold">
                        {exp2.averageDividendRate ?? avgDiv}%
                      </strong>
                      <span className="text-[9px] text-gray-500 block">
                        ({exp2.year1DividendRate ?? settings.year1DividendRate}%, {exp2.year2DividendRate ?? settings.year2DividendRate}%,{' '}
                        {exp2.year3DividendRate ?? settings.year3DividendRate}%)
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-xs border border-amber-200">
                      <span className="text-gray-500 block text-[10px]">३. वजा: नियोजित लाभांश रक्कम :</span>
                      <strong className="text-[11px] text-rose-700 font-mono font-bold">
                        - ₹ {fmtCur(exp2.estimatedDividendAmount || 0)}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-xs border border-amber-200">
                      <span className="text-gray-500 block text-[10px]">४. स्वनिधीत ग्राह्य शिल्लक नफा :</span>
                      <strong className="text-[11px] text-emerald-800 font-mono font-bold">
                        ₹ {fmtCur(exp2.surplusProfitInOwnedFunds || 0)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-[11px] leading-relaxed text-gray-700">
                <div className="p-2.5 bg-slate-50 rounded-xs border border-slate-300">
                  <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-primary" />
                    स्पष्टीकरण-१ (Explanation 1): मुक्त निधी व विकास निधी
                  </h4>
                  <p className="whitespace-pre-line text-gray-600 text-[10px] leading-relaxed">
                    {reportData?.explanation1Text}
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xs border border-slate-300">
                  <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-700" />
                    स्पष्टीकरण-२ (Explanation 2): शिल्लक निव्वळ नफा निश्चिती
                  </h4>
                  <p className="whitespace-pre-line text-gray-600 text-[10px] leading-relaxed">
                    {reportData?.explanation2Text}
                  </p>
                </div>

                {reportData?.excludedReserves && reportData.excludedReserves.length > 0 && (
                  <div className="p-2.5 bg-rose-50/50 rounded-xs border border-rose-200">
                    <h4 className="font-bold text-rose-950 mb-1 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-rose-700" />
                      स्वनिधीत समाविष्ट न केलेले बाह्य देयता निधी (Excluded Non-Free Reserves)
                    </h4>
                    <p className="text-[10px] text-gray-600 mb-1.5">
                      परिपत्रकानुसार ज्या निधींवर बाह्य देयता आहे अशा खालील निधींचा स्वनिधीमध्ये समावेश केलेला नाही:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {reportData.excludedReserves.map((er: any, eIdx: number) => (
                        <span
                          key={`excl-${eIdx}`}
                          className="px-2 py-0.5 bg-white border border-rose-200 rounded text-[10px] font-medium text-rose-900"
                        >
                          {er.ledgerName} : ₹ {fmtCur(er.balance)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {reportData?.roundingFootnote && (
                  <p className="text-[9.5px] text-gray-500 italic px-1">{reportData.roundingFootnote}</p>
                )}
              </div>
            </div>

            {/* PART 4 : SIGNATURES BLOCK */}
            <div className="mt-8 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-[11px] text-gray-900 border-t-2 border-gray-900">
              <div className="p-2 border border-gray-300 rounded-xs bg-slate-50/50">
                <div className="h-10"></div>
                <div className="font-bold">लिपिक / रोखपाल</div>
                <div className="text-[10px] text-gray-500 font-medium">तयार केले</div>
              </div>
              <div className="p-2 border border-gray-300 rounded-xs bg-slate-50/50">
                <div className="h-10"></div>
                <div className="font-bold">व्यवस्थापक / मुख्य कार्यकारी अधिकारी</div>
                <div className="text-[10px] text-gray-500 font-medium">तपासले</div>
              </div>
              <div className="p-2 border border-gray-300 rounded-xs bg-slate-50/50">
                <div className="h-10"></div>
                <div className="font-bold">चेअरमन / व्हा. चेअरमन</div>
                <div className="text-[10px] text-gray-500 font-medium">मंजूर केले</div>
              </div>
              <div className="p-2 border border-gray-300 rounded-xs bg-slate-50/50">
                <div className="h-10"></div>
                <div className="font-bold">वैधानिक लेखापरीक्षक</div>
                <div className="text-[10px] text-gray-500 font-medium">प्रमाणित केले</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DYNAMIC LEDGER MAPPING & RULE CONFIGURATION (HO/ADMIN RBAC)        */}
      {/* ========================================================================= */}
      {activeTab === 'mapping' && (
        <div className="space-y-3">
          {!canEditConfig && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-950 rounded-sm text-[11px] font-semibold flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                फक्त वाचन मोड (Read-Only): स्वनिधी नियम ३५ सेटिंग्ज व लेजर मॅपिंग बदलण्याचा अधिकार केवळ <strong>SuperAdmin / Admin / Head Office</strong> यांनाच आहे.
              </span>
            </div>
          )}

          <div className="bg-white rounded-sm border border-slate-300 border-t-2 border-t-primary shadow-xs">
            <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-100 px-3.5 py-2 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 rounded-t-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
                  <SlidersHorizontal size={14} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                    <span>नियम ३५ कमाल उचल व लाभांश दर सेटिंग्ज</span>
                    {isAutoSuggestedPreview && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9.5px] font-bold">
                        ऑटो-सुचवलेले (सेव्ह प्रलंबित)
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium">
                    येथे संस्थेची कमाल उचल मर्यादा पट, मागील सलग ३ वर्षांचे लाभांश दर व प्रमाणित निव्वळ नफा निश्चित करा.
                  </p>
                </div>
              </div>

              {canEditConfig && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoMap}
                    disabled={loading}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[11px] font-semibold rounded-sm shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>आपोआप लेजर शोधा (Smart Auto-Map)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={loading}
                    className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white text-[11px] font-bold rounded-sm shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>मॅपिंग व सेटिंग्ज सेव्ह करा</span>
                  </button>
                </div>
              )}
            </div>

            <div className="p-3.5 space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                <fieldset className="lg:col-span-5 border border-slate-300 rounded-sm px-3.5 pt-2 pb-3 bg-white shadow-2xs">
                  <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs flex items-center gap-1.5">
                    <Building2 size={12} className="text-primary shrink-0" />
                    <span>१. कमाल उचल मर्यादा व प्रमाणित नफा</span>
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                    <div>
                      <label className={labelClass}>
                        उचल मर्यादा (Multiplier): <span className="text-red-500">*</span>
                      </label>
                      <select
                        disabled={!canEditConfig}
                        value={settings.borrowingLimitMultiplier}
                        onChange={e => setSettings({ ...settings, borrowingLimitMultiplier: Number(e.target.value) })}
                        className={inputClass}
                      >
                        <option value={10}>१० पट (10.00x - सामान्य)</option>
                        <option value={12}>१२ पट (12.00x - 'अ' वर्ग)</option>
                        <option value={15}>१५ पट (15.00x - विशेष)</option>
                        <option value={8}>८ पट (8.00x - इतर)</option>
                      </select>
                      <span className="text-[9px] text-gray-500 mt-0.5 block">नियम ३५ कमाल उचल गुणक</span>
                    </div>

                    <div>
                      <label className={labelClass}>प्रमाणित निव्वळ नफा / तोटा (₹):</label>
                      <input
                        type="number"
                        step="1"
                        disabled={!canEditConfig}
                        value={settings.manualCertifiedNetProfit ?? ''}
                        onChange={e =>
                          setSettings({
                            ...settings,
                            manualCertifiedNetProfit: e.target.value === '' ? null : Number(e.target.value)
                          })
                        }
                        className={inputClass}
                        placeholder="रिकामे = स्वयंचलित P&L"
                      />
                      <span className="text-[9px] text-gray-500 mt-0.5 block">0 किंवा ऋण रक्कमही ग्राह्य (रिकामे = Auto)</span>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="lg:col-span-7 border border-slate-300 rounded-sm px-3.5 pt-2 pb-3 bg-white shadow-2xs">
                  <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs flex items-center gap-1.5">
                    <Percent size={12} className="text-primary shrink-0" />
                    <span>२. स्पष्टीकरण-२: मागील सलग ३ वर्षांचे लाभांश दर व सरासरी</span>
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mt-1.5 items-end">
                    <div>
                      <label className={labelClass}>१. वर्ष १ दर (%):</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        disabled={!canEditConfig}
                        value={settings.year1DividendRate}
                        onChange={e => setSettings({ ...settings, year1DividendRate: Number(e.target.value) })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>२. वर्ष २ दर (%):</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        disabled={!canEditConfig}
                        value={settings.year2DividendRate}
                        onChange={e => setSettings({ ...settings, year2DividendRate: Number(e.target.value) })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>३. वर्ष ३ दर (%):</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        disabled={!canEditConfig}
                        value={settings.year3DividendRate}
                        onChange={e => setSettings({ ...settings, year3DividendRate: Number(e.target.value) })}
                        className={inputClass}
                      />
                    </div>
                    <div className="bg-primary/5 p-2 rounded-sm border border-primary/20 flex flex-col justify-between h-[46px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-primary font-bold">सरासरी:</span>
                        <span className="text-xs font-black text-primary font-mono">{avgDiv}%</span>
                      </div>
                      <span className="text-[9px] text-primary/80">(Y1+Y2+Y3) ÷ 3</span>
                    </div>
                  </div>
                </fieldset>
              </div>
            </div>
          </div>

          {/* Dynamic Category Mapping Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {categories.map(cat => {
              const mappedForCat = savedMappings.filter(m => m.categoryCode === cat.categoryCode);
              const isDeduction = cat.type === 'Deduction';
              const isExcluded = cat.type === 'Excluded';
              const isLiability = cat.type === 'Liability';

              return (
                <div
                  key={cat.categoryCode}
                  className={`bg-white rounded-sm border shadow-2xs flex flex-col ${
                    isDeduction
                      ? 'border-rose-300'
                      : isExcluded
                      ? 'border-gray-300'
                      : isLiability
                      ? 'border-purple-300'
                      : 'border-slate-300'
                  }`}
                >
                  <div
                    className={`px-3 py-2 border-b flex items-start justify-between rounded-t-sm ${
                      isDeduction
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                        : isExcluded
                        ? 'bg-slate-100 border-slate-200 text-slate-800'
                        : isLiability
                        ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                        : 'bg-gradient-to-r from-slate-50 to-primary/5 border-slate-200 text-gray-900'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-bold flex items-center gap-1.5">
                        <span
                          className={
                            isDeduction
                              ? 'text-rose-700'
                              : isExcluded
                              ? 'text-slate-600'
                              : isLiability
                              ? 'text-purple-700'
                              : 'text-primary'
                          }
                        >
                          ●
                        </span>
                        <span>{cat.categoryName}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{cat.description}</div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-sm bg-white border border-slate-300 text-slate-700 shrink-0">
                      {mappedForCat.length} लेजर्स
                    </span>
                  </div>

                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1 max-h-44 overflow-y-auto mb-2 pr-1">
                      {mappedForCat.length === 0 ? (
                        <div className="text-[11px] text-gray-400 italic py-2 text-center">
                          कोणताही लेजर मॅप केलेला नाही.
                        </div>
                      ) : (
                        mappedForCat.map(m => {
                          const ledger = allLedgers.find(l => l.ledgerID === m.ledgerID);
                          return (
                            <div
                              key={m.ledgerID}
                              className="flex items-center justify-between p-1 bg-slate-50 hover:bg-slate-100 rounded-sm border border-gray-200 text-[11px]"
                            >
                              <div className="truncate mr-2">
                                <span className="font-semibold text-gray-800">{m.ledgerName || ledger?.ledgerName}</span>
                                <span className="text-[10px] text-gray-500 ml-1.5 font-mono">
                                  [{ledger?.groupName || 'GL'}]
                                </span>
                              </div>
                              {canEditConfig && (
                                <button
                                  type="button"
                                  onClick={() => removeMapping(m.ledgerID)}
                                  className="text-rose-500 hover:text-rose-700 text-[11px] font-bold px-1.5 py-0.5 rounded-sm hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                                  title="काढून टाका"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {canEditConfig && (
                      <div className="pt-2 border-t border-gray-100">
                        <select
                          onChange={e => {
                            const val = Number(e.target.value);
                            if (val > 0) {
                              toggleLedgerMapping(cat.categoryCode, val);
                              e.target.value = '';
                            }
                          }}
                          defaultValue=""
                          className="w-full px-2 py-1 border border-gray-300 rounded-sm text-[11px] text-gray-700 bg-white focus:ring-1 focus:ring-primary focus:border-primary h-[28px]"
                        >
                          <option value="">+ या हेडखाली नवीन लेजर जोडा...</option>
                          {allLedgers
                            .filter(l => !savedMappings.some(m => m.ledgerID === l.ledgerID && m.categoryCode === cat.categoryCode))
                            .map(l => (
                              <option key={l.ledgerID} value={l.ledgerID}>
                                {l.ledgerName} ({l.groupName})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All Ledgers Status Table with Actual As-Of Balance */}
          <div className="bg-white rounded-sm border border-slate-300 shadow-2xs">
            <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-100 px-3.5 py-2 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 rounded-t-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
                  <FolderSync size={14} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900">
                    सर्व जनरल लेजर्स व त्यांचे स्वनिधी मॅपिंग ({reportData?.branchName || 'Consolidated'})
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium">
                    दिनांक {asOnDate} अखेर प्रत्यक्ष शिल्लक व नियम ३५ वर्गीकरण.
                  </p>
                </div>
              </div>

              <div className="w-full md:w-64">
                <input
                  type="text"
                  placeholder="लेजरचे नाव शोधा..."
                  value={ledgerSearchTerm}
                  onChange={e => setLedgerSearchTerm(e.target.value)}
                  className="w-full px-2.5 py-1 border border-gray-300 rounded-sm text-[11px] focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto border-t border-slate-300">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-100 text-gray-700 font-bold border-b border-slate-300 sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 w-14 text-center">ID</th>
                    <th className="px-3 py-1.5">लेजरचे नाव</th>
                    <th className="px-3 py-1.5">ग्रुप</th>
                    <th className="px-3 py-1.5">प्रकार</th>
                    <th className="px-3 py-1.5 text-right">अखेर शिल्लक (₹)</th>
                    <th className="px-3 py-1.5 w-64">स्वनिधी कॅटेगरी</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allLedgers
                    .filter(
                      l =>
                        !ledgerSearchTerm ||
                        l.ledgerName.toLowerCase().includes(ledgerSearchTerm.toLowerCase()) ||
                        l.groupName.toLowerCase().includes(ledgerSearchTerm.toLowerCase())
                    )
                    .map(l => {
                      const currentMapping = savedMappings.find(m => m.ledgerID === l.ledgerID);
                      return (
                        <tr key={l.ledgerID} className="hover:bg-slate-50">
                          <td className="px-3 py-1 text-center text-gray-400 font-mono">{l.ledgerID}</td>
                          <td className="px-3 py-1 font-medium text-gray-900">
                            <span>{l.ledgerName}</span>
                            {l.excludeFromRule35Swanidhi && (
                              <span className="ml-1.5 px-1 py-0 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[9px] font-bold">
                                Rule35 Excluded
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1 text-gray-600">{l.groupName}</td>
                          <td className="px-3 py-1 text-gray-500">
                            <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {l.nature}
                            </span>
                          </td>
                          <td className="px-3 py-1 text-right font-mono text-gray-800 whitespace-nowrap">
                            {fmtCur(l.asOfBalance ?? l.openingBalance)}{' '}
                            <span className="text-[9.5px] text-gray-500">{l.asOfBalanceType ?? l.openingBalanceType}</span>
                          </td>
                          <td className="px-3 py-1">
                            <select
                              disabled={!canEditConfig}
                              value={currentMapping?.categoryCode || ''}
                              onChange={e => {
                                const newCat = e.target.value;
                                if (!newCat) removeMapping(l.ledgerID);
                                else toggleLedgerMapping(newCat, l.ledgerID);
                              }}
                              className={`w-full px-2 py-1 border rounded-sm text-[11px] h-[26px] disabled:bg-slate-100 ${
                                currentMapping
                                  ? 'bg-primary/5 border-primary/40 font-bold text-primary'
                                  : 'bg-white border-gray-300 text-gray-500'
                              }`}
                            >
                              <option value="">-- लागू नाही / Unmapped --</option>
                              {categories.map(c => (
                                <option key={c.categoryCode} value={c.categoryCode}>
                                  {c.categoryName}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
