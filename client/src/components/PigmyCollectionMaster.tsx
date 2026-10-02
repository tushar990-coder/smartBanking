import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { 
  PlusIcon, 
  ArrowPathIcon, 
  TableCellsIcon,
  CheckCircleIcon,
  DevicePhoneMobileIcon,
  DocumentArrowUpIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  SparklesIcon,
  ClockIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface Customer {
  customerID: number;
  cifNo?: string;
  customerName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  mobileNo?: string;
}

interface Agent {
  pigmyAgentID: number;
  agentName: string;
  agentCode?: string;
  agentNumber?: string;
  branchID?: number;
  branch?: { branchName: string };
}

interface PigmyAccount {
  pigmyAccountID: number;
  accountNo: string;
  legacyAccountNumber?: string;
  openingDate?: string;
  customerID: number;
  pigmyAgentID: number;
  totalDepositedAmount: number;
  status: string;
  customer?: Customer;
  pigmyAgent?: Agent;
  agent?: Agent;
}

interface CollectionHistory {
  collectionId: number;
  receiptNo: string;
  collectionDate: string;
  collectionAmount: number;
  collectionSource: string;
  pigmyAccountNo: string;
  customerName?: string;
  agentName: string;
}

export default function PigmyCollectionMaster() {
  const [activeTab, setActiveTab] = useState<'bulk' | 'monthly' | 'manual' | 'app' | 'history'>('bulk');
  
  // Data States
  const [agents, setAgents] = useState<Agent[]>([]);
  const [accounts, setAccounts] = useState<PigmyAccount[]>([]);
  const [history, setHistory] = useState<CollectionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);

  // Bulk Sheet States
  const [selectedAgentId, setSelectedAgentId] = useState<number | ''>('');
  const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bulkAmounts, setBulkAmounts] = useState<{ [accountId: number]: string }>({});
  const [sheetSearchTerm, setSheetSearchTerm] = useState<string>('');

  // Monthly Matrix States
  const [selectedMonthlyAgentId, setSelectedMonthlyAgentId] = useState<number | ''>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [monthlySuccessBanner, setMonthlySuccessBanner] = useState<string | null>(null);
  const [existingMonthlyWarning, setExistingMonthlyWarning] = useState<{
    count: number;
    totalAmount: number;
    accountsCount: number;
    monthYear: string;
  } | null>(null);
  const [monthlyImportPreview, setMonthlyImportPreview] = useState<{
    fileName: string;
    totalRows: number;
    matchedAccountsCount: number;
    totalDepositEntries: number;
    totalAmount: number;
    columns: string[];
    rows: Array<{
      accountNo: string;
      legacyAccountNumber?: string;
      customerName: string;
      pigmyAccountId: number;
      openingDate?: string;
      dailyAmounts: { [dateStr: string]: number };
      rowTotal: number;
      excelTotal?: number;
      isValid: boolean;
      warning?: string;
      isInvalidAccount?: boolean;
    }>;
    skippedRows: Array<{
      rawAccount: string;
      rawName: string;
      reason: string;
    }>;
  } | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [dailyInvalidImports, setDailyInvalidImports] = useState<Array<{ rawAcc: string; rawAmt: number; reason: string }>>([]);
  const [monthlySaving, setMonthlySaving] = useState(false);
  const dailyFileInputRef = useRef<HTMLInputElement>(null);
  const monthlyFileInputRef = useRef<HTMLInputElement>(null);

  // Single Manual Form State
  const [manualForm, setManualForm] = useState({
    pigmyAccountId: '',
    collectionDate: new Date().toISOString().split('T')[0],
    collectionAmount: ''
  });

  // App Sync State
  const [appSyncJson, setAppSyncJson] = useState('[\n  {\n    "pigmyAccountId": 1,\n    "agentId": 1,\n    "collectionDate": "2026-08-09",\n    "collectionAmount": 100,\n    "syncReferenceId": "uuid-1234"\n  }\n]');
  const [mobileQueue, setMobileQueue] = useState<{
    date: string;
    totalCount: number;
    totalAmount: number;
    agentSummaries: any[];
    items: any[];
  } | null>(null);
  const [mobileSyncView, setMobileSyncView] = useState<'queue' | 'json'>('queue');
  const [mobileQueueLoading, setMobileQueueLoading] = useState(false);
  const [selectedQueueAgent, setSelectedQueueAgent] = useState<number | ''>('');

  // Refs for auto-focus keyboard navigation
  const inputRefs = useRef<{ [accountId: number]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchAgents();
    fetchAccounts();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'app') {
      fetchMobileQueue(selectedQueueAgent);
    }
  }, [activeTab, selectedQueueAgent]);

  const fetchMobileQueue = async (agentId?: number | '') => {
    setMobileQueueLoading(true);
    try {
      const url = agentId ? `/api/PigmyCollections/MobileSyncQueue?agentId=${agentId}` : '/api/PigmyCollections/MobileSyncQueue';
      const res = await axios.get(url);
      setMobileQueue(res.data);
    } catch (err) {
      console.error('Failed to fetch mobile sync queue', err);
    } finally {
      setMobileQueueLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await axios.get('/api/PigmyAgents');
      setAgents(res.data || []);
    } catch (err) {
      console.error('Failed to fetch agents', err);
    }
  };

  const fetchAccounts = async () => {
    setFetchingAccounts(true);
    try {
      const res = await axios.get('/api/PigmyAccounts');
      const data = res.data || [];
      setAccounts(data);

      const params = new URLSearchParams(window.location.search);
      const entityIdStr = params.get('entityId');
      const pigmyAccountIdStr = params.get('pigmyAccountId') || params.get('id');
      const targetId = pigmyAccountIdStr ? parseInt(pigmyAccountIdStr) : (entityIdStr ? parseInt(entityIdStr) : null);

      if (targetId) {
        setActiveTab('manual');
        setManualForm(prev => ({ ...prev, pigmyAccountId: targetId.toString() }));
      }
    } catch (err) {
      console.error(err);
      toast.error('पिग्मी खाती लोड करताना त्रुटी आली.');
    } finally {
      setFetchingAccounts(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/PigmyCollections');
      setHistory(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Safe Property Extractors
  const getAgentId = (a: any): number => {
    if (!a) return 0;
    const id = a.pigmyAgentID ?? a.pigmyAgentId ?? a.PigmyAgentID ?? a.id;
    return typeof id === 'number' ? id : parseInt(id) || 0;
  };

  const getCustomerFullName = (c: any): string => {
    if (!c) return '-';
    if (c.customerName) return c.customerName;
    const fn = c.firstName || c.FirstName || '';
    const mn = c.middleName || c.MiddleName || '';
    const ln = c.lastName || c.LastName || '';
    const name = `${fn} ${mn} ${ln}`.replace(/\s+/g, ' ').trim();
    return name || '-';
  };

  const format14DigitDisplay = (accNo: string) => {
    if (!accNo) return '';
    const d = accNo.replace(/\D/g, '');
    if (d.length === 14) {
      return `${d.substring(0, 3)}-${d.substring(3, 6)}-${d.substring(6, 13)}-${d.substring(13, 14)}`;
    }
    return accNo;
  };

  // Filter accounts belonging to the selected agent (only opened on or before collectionDate)
  const agentAccounts = accounts.filter(acc => {
    const accAgentId = acc.pigmyAgentID || getAgentId(acc.pigmyAgent) || getAgentId(acc.agent);
    const matchesAgent = selectedAgentId ? accAgentId === Number(selectedAgentId) : false;
    const isActive = acc.status === 'Active';
    const isOpenedOnOrBeforeDate = acc.openingDate 
      ? new Date(acc.openingDate.split('T')[0]) <= new Date(collectionDate)
      : true;
    return matchesAgent && isActive && isOpenedOnOrBeforeDate;
  });

  const filteredAgentAccounts = agentAccounts.filter(acc => {
    if (!sheetSearchTerm) return true;
    const query = sheetSearchTerm.toLowerCase();
    const accNo = (acc.accountNo || '').toLowerCase();
    const formattedAccNo = format14DigitDisplay(acc.accountNo || '').toLowerCase();
    const legacyAccNo = ((acc as any).legacyAccountNumber || '').toLowerCase();
    const customerName = getCustomerFullName(acc.customer).toLowerCase();
    const mob = (acc.customer?.mobileNo || '').toLowerCase();
    return accNo.includes(query) || formattedAccNo.includes(query) || legacyAccNo.includes(query) || customerName.includes(query) || mob.includes(query);
  });

  // Calculate Sheet Totals
  const totalSheetCount = agentAccounts.length;
  const collectedItems = Object.entries(bulkAmounts).filter(([_, val]) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  });
  const collectedCount = collectedItems.length;
  const totalBulkRemittance = Object.values(bulkAmounts).reduce((sum, val) => {
    const num = parseFloat(val);
    return sum + (!isNaN(num) && num > 0 ? num : 0);
  }, 0);

  const handleAmountInputChange = (accountId: number, val: string) => {
    setBulkAmounts(prev => ({
      ...prev,
      [accountId]: val
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextAcc = filteredAgentAccounts[currentIndex + 1];
      if (nextAcc && inputRefs.current[nextAcc.pigmyAccountID]) {
        inputRefs.current[nextAcc.pigmyAccountID]?.focus();
        inputRefs.current[nextAcc.pigmyAccountID]?.select();
      }
    }
  };

  const handleBulkSubmit = async () => {
    if (!selectedAgentId) {
      toast.error('कृपया आधी पिग्मी एजंट निवडा.');
      return;
    }

    const items = Object.entries(bulkAmounts)
      .map(([accIdStr, val]) => ({
        pigmyAccountId: parseInt(accIdStr),
        collectionAmount: parseFloat(val) || 0
      }))
      .filter(i => i.collectionAmount > 0);

    if (items.length === 0) {
      toast.error('कृपया किमान एका खात्याची जमा रक्कम प्रविष्ट करा.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        agentId: Number(selectedAgentId),
        collectionDate: collectionDate,
        items: items
      };

      const res = await axios.post('/api/PigmyCollections/BulkManual', payload);
      toast.success(res.data.message || 'कलेक्शन यशस्वीरीत्या जमा झाले!');
      
      // Reset sheet entries & refresh data
      setBulkAmounts({});
      fetchHistory();
      fetchAccounts();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'बल्क कलेक्शन सेव्ह करताना त्रुटी आली.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // --- DAILY EXCEL TEMPLATE & IMPORT ---
  const handleDownloadDailyTemplate = () => {
    if (!selectedAgentId) {
      toast.error('कृपया आधी पिग्मी एजंट निवडा.');
      return;
    }
    const currentAgent = agents.find(a => getAgentId(a) === Number(selectedAgentId));
    const agentName = currentAgent?.agentName || `Agent_${selectedAgentId}`;

    if (agentAccounts.length === 0) {
      toast.error(`निवडलेल्या तारखेपर्यंत (${collectionDate}) या एजंटचे कोणतेही सक्रिय खाते उपलब्ध नाही.`);
      return;
    }

    const rows: any[] = agentAccounts.map(acc => ({
      'खाते क्र. (Account No)': format14DigitDisplay(acc.accountNo),
      'मागील / जुना खाते क्र. (Old Acc No)': (acc as any).legacyAccountNumber || '',
      'ग्राहक नाव (Customer Name)': getCustomerFullName(acc.customer),
      'खाते उघडल्याची तारीख (Opening Date)': acc.openingDate ? acc.openingDate.split('T')[0] : '',
      'चालू शिल्लक (Current Balance)': acc.totalDepositedAmount || 0,
      'जमा रक्कम (Collection Amount)': 0
    }));

    // Append summary total row at the bottom
    rows.push({
      'खाते क्र. (Account No)': 'एकूण (TOTAL)',
      'मागील / जुना खाते क्र. (Old Acc No)': '',
      'ग्राहक नाव (Customer Name)': 'एकूण दैनिक संकलन',
      'खाते उघडल्याची तारीख (Opening Date)': '',
      'चालू शिल्लक (Current Balance)': '',
      'जमा रक्कम (Collection Amount)': 0
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Inject live vertical SUM formula for collection amount column (Column F, index 5)
    const lastDailyAccRow = agentAccounts.length + 1;
    const dailySummaryRowIdx = agentAccounts.length + 1;
    const dailyTotalCellRef = XLSX.utils.encode_cell({ r: dailySummaryRowIdx, c: 5 });
    ws[dailyTotalCellRef] = {
      t: 'n',
      v: 0,
      f: `SUM(F2:F${lastDailyAccRow})`
    };

    const wb = XLSX.utils.book_new();
    wb.Workbook = { WBProps: { fullCalcOnLoad: true } };
    XLSX.utils.book_append_sheet(wb, ws, 'Daily_Collection');
    XLSX.writeFile(wb, `Pigmy_Daily_${agentName.replace(/\s+/g, '_')}_${collectionDate}.xlsx`);
    toast.success('दैनिक कलेक्शन टेम्पलेट यशस्वीरीत्या डाउनलोड झाले!');
  };

  const handleDailyExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedAgentId) {
      toast.error('कृपया आधी पिग्मी एजंट निवडा.');
      if (dailyFileInputRef.current) dailyFileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          toast.error('एक्सेल शीटमध्ये कोणताही डेटा सापडला नाही.');
          return;
        }

        let matchedCount = 0;
        let skippedFuture = 0;
        let totalAmt = 0;
        const newAmounts: { [accId: number]: string } = { ...bulkAmounts };
        const invalidDailyList: Array<{ rawAcc: string; rawAmt: number; reason: string }> = [];

        data.forEach((row: any) => {
          const keys = Object.keys(row);
          const accKey = keys.find(k => /acc|खाते|account/i.test(k));
          const amtKey = keys.find(k => /amount|रक्कम|जमा/i.test(k));

          const rawAcc = accKey ? String(row[accKey]).trim() : '';
          const rawAmt = amtKey ? parseFloat(row[amtKey]) : 0;

          if (!rawAcc || isNaN(rawAmt) || rawAmt <= 0) return;
          if (/^(एकूण|total)/i.test(rawAcc)) return;

          const matchedAcc = agentAccounts.find(a => {
            const accClean = a.accountNo.replace(/\D/g, '');
            const rawClean = rawAcc.replace(/\D/g, '');
            const legacyAcc = String((a as any).legacyAccountNumber || '').trim();

            return a.accountNo.toLowerCase() === rawAcc.toLowerCase() ||
                   format14DigitDisplay(a.accountNo).toLowerCase() === rawAcc.toLowerCase() ||
                   (rawClean.length >= 4 && accClean.endsWith(rawClean)) ||
                   legacyAcc === rawAcc ||
                   String(a.pigmyAccountID) === rawAcc;
          });

          if (matchedAcc) {
            newAmounts[matchedAcc.pigmyAccountID] = rawAmt.toString();
            matchedCount++;
            totalAmt += rawAmt;
          } else {
            let reason = 'या एजंटचे सक्रिय खाते सापडले नाही';
            const anyAcc = accounts.find(a => {
              const accClean = a.accountNo.replace(/\D/g, '');
              const rawClean = rawAcc.replace(/\D/g, '');
              const legacyAcc = String((a as any).legacyAccountNumber || '').trim();
              return a.accountNo.toLowerCase() === rawAcc.toLowerCase() ||
                     format14DigitDisplay(a.accountNo).toLowerCase() === rawAcc.toLowerCase() ||
                     (rawClean.length >= 4 && accClean.endsWith(rawClean)) ||
                     legacyAcc === rawAcc ||
                     String(a.pigmyAccountID) === rawAcc;
            });
            if (anyAcc) {
              if (anyAcc.openingDate && new Date(anyAcc.openingDate.split('T')[0]) > new Date(collectionDate)) {
                reason = `खाते उघडल्याची तारीख (${anyAcc.openingDate.split('T')[0]}) ${collectionDate} नंतरची आहे`;
                skippedFuture++;
              } else if (anyAcc.status !== 'Active') {
                reason = `खाते ${anyAcc.status === 'Closed' ? 'बंद' : anyAcc.status} आहे`;
              } else {
                reason = `हे खाते इतर एजंटचे (${anyAcc.pigmyAgent?.agentName || anyAcc.agent?.agentName || 'अन्य'}) आहे`;
              }
            } else {
              reason = 'खाते क्रमांक सिस्टीममध्ये सापडले नाही';
            }
            invalidDailyList.push({ rawAcc, rawAmt, reason });
          }
        });

        setBulkAmounts(newAmounts);
        setDailyInvalidImports(invalidDailyList);

        if (matchedCount > 0) {
          toast.success(`${matchedCount} खाती यशस्वीरीत्या भरली! एकूण रक्कम: ₹${totalAmt.toLocaleString('en-IN')}`);
        } else {
          toast.error('निवडलेल्या एजंटच्या खात्यांशी जुळणारी कोणतीही नोंद सापडली नाही.');
        }

        if (invalidDailyList.length > 0) {
          toast.error(`⚠️ एक्सेलमधील ${invalidDailyList.length} खाती अवैध आढळली आणि मार्किंग केली गेली.`);
        }

        if (skippedFuture > 0) {
          toast(`⚠️ ${skippedFuture} खाती वगळली (खाते उघडण्याची तारीख ${collectionDate} नंतरची आहे).`, { icon: 'ℹ️' });
        }
      } catch (err) {
        console.error(err);
        toast.error('एक्सेल फाईल वाचताना त्रुटी आली.');
      } finally {
        if (dailyFileInputRef.current) dailyFileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- MONTHLY MATRIX EXCEL TEMPLATE & IMPORT ---
  const handleDownloadMonthlyTemplate = () => {
    if (!selectedMonthlyAgentId) {
      toast.error('कृपया आधी पिग्मी एजंट निवडा.');
      return;
    }
    if (!selectedMonth) {
      toast.error('कृपया आधी महिना व वर्ष निवडा.');
      return;
    }
    const currentAgent = agents.find(a => getAgentId(a) === Number(selectedMonthlyAgentId));
    const agentName = currentAgent?.agentName || `Agent_${selectedMonthlyAgentId}`;

    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const daysInMonth = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const eligibleAccounts = accounts.filter(acc => {
      const aId = acc.pigmyAgentID || getAgentId(acc.pigmyAgent) || getAgentId(acc.agent);
      const isAgent = aId === Number(selectedMonthlyAgentId);
      const isActive = acc.status === 'Active';
      const isOpened = acc.openingDate ? new Date(acc.openingDate.split('T')[0]) <= new Date(endOfMonth) : true;
      return isAgent && isActive && isOpened;
    });

    if (eligibleAccounts.length === 0) {
      toast.error(`या महिन्यासाठी (${selectedMonth}) एजंटचे कोणतेही सक्रिय खाते उपलब्ध नाही.`);
      return;
    }

    const dayHeaders: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      dayHeaders.push(`${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')}`);
    }

    const rows = eligibleAccounts.map((acc) => {
      const oldNo = (acc as any).legacyAccountNumber || '';
      const cName = getCustomerFullName(acc.customer);
      const rowObj: any = {
        'पिग्मि जुना acc  no ': oldNo,
        'खातेदाराचे नाव': cName,
        'एजंट': agentName
      };

      dayHeaders.forEach(dh => {
        rowObj[dh] = 0;
      });

      rowObj['TOTAL'] = 0;
      return rowObj;
    });

    // Append summary total row at the bottom for vertical column additions
    const totalRowObj: any = {
      'पिग्मि जुना acc  no ': 'एकूण (TOTAL)',
      'खातेदाराचे नाव': 'एकूण दैनिक संकलन (Daily Total)',
      'एजंट': agentName
    };

    dayHeaders.forEach(dh => {
      totalRowObj[dh] = 0;
    });

    totalRowObj['TOTAL'] = 0;
    rows.push(totalRowObj);

    const ws = XLSX.utils.json_to_sheet(rows);

    const startColLetter = XLSX.utils.encode_col(3); // Column D (Day 1)
    const endColLetter = XLSX.utils.encode_col(3 + daysInMonth - 1); // Column for Last Day
    const totalColIdx = 3 + daysInMonth; // Column index for TOTAL
    const totalColLetter = XLSX.utils.encode_col(totalColIdx);
    const lastAccountRowNumber = eligibleAccounts.length + 1; // Last data row (1-indexed in Excel)
    const summaryRowIdx = eligibleAccounts.length + 1; // 0-indexed row for ws

    // 1. Horizontal SUM formula for each account row (recalculates automatically across all days)
    eligibleAccounts.forEach((_, idx) => {
      const excelRowNumber = idx + 2; // Data rows start at 2 (Row 1 is headers)
      const cellRef = XLSX.utils.encode_cell({ r: idx + 1, c: totalColIdx });
      ws[cellRef] = {
        t: 'n',
        v: 0,
        f: `SUM(${startColLetter}${excelRowNumber}:${endColLetter}${excelRowNumber})`
      };
    });

    // 2. Vertical SUM formula for each day column in the summary row
    for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
      const colIdx = 3 + dayIdx;
      const colLetter = XLSX.utils.encode_col(colIdx);
      const dayTotalCellRef = XLSX.utils.encode_cell({ r: summaryRowIdx, c: colIdx });
      ws[dayTotalCellRef] = {
        t: 'n',
        v: 0,
        f: `SUM(${colLetter}2:${colLetter}${lastAccountRowNumber})`
      };
    }

    // 3. Grand Total formula for the bottom-right corner cell
    const grandTotalCellRef = XLSX.utils.encode_cell({ r: summaryRowIdx, c: totalColIdx });
    ws[grandTotalCellRef] = {
      t: 'n',
      v: 0,
      f: `SUM(${totalColLetter}2:${totalColLetter}${lastAccountRowNumber})`
    };

    const wb = XLSX.utils.book_new();
    wb.Workbook = { WBProps: { fullCalcOnLoad: true } };
    XLSX.utils.book_append_sheet(wb, ws, 'मासिक_कलेक्शन_चार्ट');
    XLSX.writeFile(wb, `डेली_पिग्मि_कलेक्शन_चार्ट_${agentName.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`);
    toast.success('मासिक कलेक्शन चार्ट टेम्पलेट यशस्वीरीत्या डाउनलोड झाले!');
  };

  const handleMonthlyExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedMonthlyAgentId) {
      toast.error('कृपया आधी पिग्मी एजंट निवडा.');
      if (monthlyFileInputRef.current) monthlyFileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rawRows || rawRows.length < 2) {
          toast.error('एक्सेल शीटमध्ये डेटा ओळी सापडल्या नाहीत.');
          return;
        }

        const headerRow = rawRows[0] || [];
        let accColIdx = 0;
        let nameColIdx = 1;
        let totalColIdx = -1;

        let detectedMonth: number | null = null;
        let detectedYear: number | null = null;

        // Auto-detect month and year from column headers (e.g. 01/08 or 01-08-2026 or 01/08/2026)
        headerRow.forEach((cellVal: any) => {
          const str = String(cellVal || '').trim();
          const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
          if (match) {
            const m = parseInt(match[2]);
            if (m >= 1 && m <= 12 && !detectedMonth) {
              detectedMonth = m;
            }
            if (match[3] && !detectedYear) {
              const y = parseInt(match[3]);
              detectedYear = y < 100 ? 2000 + y : y;
            }
          }
        });

        // If not in headers, try detecting from file name (e.g. 2026-08 or 2026_08 or 08_2026)
        if (!detectedMonth || !detectedYear) {
          const fnMatch = file.name.match(/(\d{4})[-_](\d{1,2})/);
          if (fnMatch) {
            if (!detectedYear) detectedYear = parseInt(fnMatch[1]);
            if (!detectedMonth) {
              const m = parseInt(fnMatch[2]);
              if (m >= 1 && m <= 12) detectedMonth = m;
            }
          }
        }

        const currentYear = new Date().getFullYear();
        const effectiveYear = detectedYear || (selectedMonth ? parseInt(selectedMonth.split('-')[0]) : currentYear);

        // Mismatch validation: if user already had a month selected, verify it matches
        if (selectedMonth && detectedMonth) {
          const [selYearStr, selMonthStr] = selectedMonth.split('-');
          const selYear = parseInt(selYearStr);
          const selMonth = parseInt(selMonthStr);

          if (selMonth !== detectedMonth || (detectedYear && selYear !== detectedYear)) {
            const detectedStr = `${String(detectedMonth).padStart(2, '0')}/${detectedYear || selYear}`;
            const selectedStr = `${String(selMonth).padStart(2, '0')}/${selYear}`;
            toast.error(
              `महिन्यात तफावत! एक्सेल शीट महिना ${detectedStr} चा आहे, परंतु सिलेक्ट केलेला महिना ${selectedStr} आहे. कृपया योग्य महिना निवडा.`,
              { duration: 6000 }
            );
            if (monthlyFileInputRef.current) monthlyFileInputRef.current.value = '';
            return;
          }
        }

        // Auto-detect and set selectedMonth if not already chosen
        if (!selectedMonth) {
          if (!detectedMonth) {
            toast.error('एक्सेल शीटमधून महिना ओळखता आला नाही. कृपया वरील इनपुटमधून महिना व वर्ष निवडा.');
            if (monthlyFileInputRef.current) monthlyFileInputRef.current.value = '';
            return;
          }
          const autoMonthStr = `${effectiveYear}-${String(detectedMonth).padStart(2, '0')}`;
          setSelectedMonth(autoMonthStr);
        }

        const effectiveMonth = detectedMonth || (selectedMonth ? parseInt(selectedMonth.split('-')[1]) : (new Date().getMonth() + 1));

        const agentEligibleAccounts = accounts.filter(acc => {
          const aId = acc.pigmyAgentID || getAgentId(acc.pigmyAgent) || getAgentId(acc.agent);
          return aId === Number(selectedMonthlyAgentId) && acc.status === 'Active';
        });

        const dayColMap: { colIdx: number; day: number; dateStr: string; label: string }[] = [];

        headerRow.forEach((cellVal: any, cIdx: number) => {
          const str = String(cellVal || '').trim();
          if (/total|एकूण/i.test(str)) {
            totalColIdx = cIdx;
            return;
          }
          if (cIdx === 0 && (/acc|खाते|जुना/i.test(str) || !str)) {
            accColIdx = cIdx;
            return;
          }
          if (cIdx === 1 && (/नाव|name|खातेदार/i.test(str) || !str)) {
            nameColIdx = cIdx;
            return;
          }

          const dateMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})/);
          if (dateMatch) {
            const d = parseInt(dateMatch[1]);
            const m = parseInt(dateMatch[2]);
            if (d >= 1 && d <= 31) {
              const colMonth = (m >= 1 && m <= 12) ? m : effectiveMonth;
              const fullDateStr = `${effectiveYear}-${String(colMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              dayColMap.push({ colIdx: cIdx, day: d, dateStr: fullDateStr, label: str });
            }
          } else {
            const num = parseInt(str);
            if (!isNaN(num) && num >= 1 && num <= 31) {
              const fullDateStr = `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}-${String(num).padStart(2, '0')}`;
              dayColMap.push({ colIdx: cIdx, day: num, dateStr: fullDateStr, label: String(num) });
            }
          }
        });

        if (dayColMap.length === 0) {
          toast.error('पत्रकात दिवसांचे कॉलम्स (उदा. 01/04 ते 30/04) सापडले नाहीत.');
          return;
        }

        const previewRows: any[] = [];
        const skippedRows: any[] = [];
        let totalEntries = 0;
        let grandTotal = 0;

        for (let r = 1; r < rawRows.length; r++) {
          const rowData = rawRows[r];
          if (!rowData || rowData.length === 0) continue;

          const rawAcc = String(rowData[accColIdx] || '').trim();
          const rawName = String(rowData[nameColIdx] || '').trim();
          if (!rawAcc && !rawName) continue;

          // Safely ignore bottom summary / total row
          if (/^(एकूण|total|grand\s*total)/i.test(rawAcc) || /^(एकूण|total|grand\s*total)/i.test(rawName)) {
            continue;
          }

          const matchedAcc = agentEligibleAccounts.find(a => {
            const accClean = a.accountNo.replace(/\D/g, '');
            const rawClean = rawAcc.replace(/\D/g, '');
            const legacyAcc = String((a as any).legacyAccountNumber || '').trim();

            return a.accountNo.toLowerCase() === rawAcc.toLowerCase() ||
                   format14DigitDisplay(a.accountNo).toLowerCase() === rawAcc.toLowerCase() ||
                   (rawClean.length >= 4 && accClean.endsWith(rawClean)) ||
                   legacyAcc === rawAcc ||
                   String(a.pigmyAccountID) === rawAcc;
          });

          if (!matchedAcc) {
            let failureReason = 'या एजंटचे सक्रिय खाते सापडले नाही';
            const anyAcc = accounts.find(a => {
              const accClean = a.accountNo.replace(/\D/g, '');
              const rawClean = rawAcc.replace(/\D/g, '');
              const legacyAcc = String((a as any).legacyAccountNumber || '').trim();
              return a.accountNo.toLowerCase() === rawAcc.toLowerCase() ||
                     format14DigitDisplay(a.accountNo).toLowerCase() === rawAcc.toLowerCase() ||
                     (rawClean.length >= 4 && accClean.endsWith(rawClean)) ||
                     legacyAcc === rawAcc ||
                     String(a.pigmyAccountID) === rawAcc;
            });

            if (anyAcc) {
              if (anyAcc.status !== 'Active') {
                failureReason = `खाते ${anyAcc.status === 'Closed' ? 'बंद' : anyAcc.status} आहे`;
              } else {
                failureReason = `हे खाते इतर एजंटचे (${anyAcc.pigmyAgent?.agentName || anyAcc.agent?.agentName || 'अन्य'}) आहे`;
              }
            } else {
              failureReason = 'खाते सिस्टीममध्ये अस्तित्वात नाही';
            }

            skippedRows.push({
              rawAccount: rawAcc,
              rawName: rawName,
              reason: failureReason
            });

            // Capture entered amounts for the invalid row so operator can see what was entered
            const dailyAmounts: { [dateStr: string]: number } = {};
            let rowSum = 0;
            dayColMap.forEach(dCol => {
              const cellVal = parseFloat(rowData[dCol.colIdx]) || 0;
              if (cellVal > 0) {
                dailyAmounts[dCol.dateStr] = cellVal;
                rowSum += cellVal;
              }
            });

            const excelTotal = totalColIdx >= 0 ? (parseFloat(rowData[totalColIdx]) || 0) : undefined;

            // Include in preview rows with invalid marking
            previewRows.push({
              accountNo: rawAcc || 'अवैध खाते',
              legacyAccountNumber: rawAcc,
              customerName: rawName || 'अज्ञात खातेदार',
              pigmyAccountId: 0,
              dailyAmounts,
              rowTotal: rowSum,
              excelTotal,
              isValid: false,
              warning: failureReason,
              isInvalidAccount: true
            });
            continue;
          }

          const dailyAmounts: { [dateStr: string]: number } = {};
          let rowSum = 0;
          let warningMsg = '';

          dayColMap.forEach(dCol => {
            const cellVal = parseFloat(rowData[dCol.colIdx]) || 0;
            if (cellVal > 0) {
              if (matchedAcc.openingDate) {
                const openDate = new Date(matchedAcc.openingDate.split('T')[0]);
                const colDate = new Date(dCol.dateStr);
                if (openDate > colDate) {
                  warningMsg = `खाते ${matchedAcc.openingDate.split('T')[0]} रोजी उघडले असल्याने आधीच्या तारखेला रक्कम वगळली.`;
                  return;
                }
              }
              dailyAmounts[dCol.dateStr] = cellVal;
              rowSum += cellVal;
              totalEntries++;
              grandTotal += cellVal;
            }
          });

          const excelTotal = totalColIdx >= 0 ? (parseFloat(rowData[totalColIdx]) || 0) : undefined;

          previewRows.push({
            accountNo: matchedAcc.accountNo,
            legacyAccountNumber: (matchedAcc as any).legacyAccountNumber,
            customerName: getCustomerFullName(matchedAcc.customer),
            pigmyAccountId: matchedAcc.pigmyAccountID,
            openingDate: matchedAcc.openingDate?.split('T')[0],
            dailyAmounts,
            rowTotal: rowSum,
            excelTotal,
            isValid: rowSum > 0,
            warning: warningMsg || (excelTotal !== undefined && excelTotal > 0 && Math.abs(excelTotal - rowSum) > 0.01 ? `एक्सेल Total (${excelTotal}) आणि बेरजेमध्ये (${rowSum}) फरक आहे.` : undefined)
          });
        }

        const dayLabels = dayColMap.map(d => d.label);

        setMonthlyImportPreview({
          fileName: file.name,
          totalRows: previewRows.length + skippedRows.length,
          matchedAccountsCount: previewRows.length,
          totalDepositEntries: totalEntries,
          totalAmount: grandTotal,
          columns: dayLabels,
          rows: previewRows,
          skippedRows
        });

        toast.success(`एक्सेल वाचले: ${previewRows.length} खाती, एकूण ₹${grandTotal.toLocaleString('en-IN')}`);

        // Check if collection already exists in database for this agent & month
        const checkMonthYear = `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}`;
        axios.get(`/api/PigmyCollections/CheckMonthlyExists?agentId=${selectedMonthlyAgentId}&monthYear=${checkMonthYear}`)
          .then(res => {
            if (res.data?.hasExisting) {
              setExistingMonthlyWarning({
                count: res.data.count,
                totalAmount: res.data.totalAmount,
                accountsCount: res.data.accountsCount,
                monthYear: res.data.monthYear
              });
              toast.error(
                `⚠️ सावधान: या एजंटसाठी ${res.data.monthYear} चे कलेक्शन आधीच सिस्टीममध्ये जमा आहे! दुबार जमा टाळण्यासाठी सेव्ह करणे बंद केले आहे.`,
                { duration: 8000 }
              );
            } else {
              setExistingMonthlyWarning(null);
            }
          })
          .catch(err => {
            console.error('Error checking existing monthly collections', err);
          });
      } catch (err) {
        console.error(err);
        toast.error('मासिक चार्ट एक्सेल फाईल वाचताना त्रुटी आली.');
      } finally {
        if (monthlyFileInputRef.current) monthlyFileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveMonthlyImport = async () => {
    if (!monthlyImportPreview || monthlyImportPreview.rows.length === 0) {
      toast.error('जमा करण्यासाठी कोणत्याही वैध नोंदी नाहीत.');
      return;
    }

    const flatEntries: { pigmyAccountId: number; collectionDate: string; collectionAmount: number }[] = [];
    monthlyImportPreview.rows.forEach(r => {
      // Only include valid accounts with an active pigmyAccountId
      if (r.pigmyAccountId > 0 && r.isValid) {
        Object.entries(r.dailyAmounts).forEach(([dateStr, amt]) => {
          if (amt > 0) {
            flatEntries.push({
              pigmyAccountId: r.pigmyAccountId,
              collectionDate: dateStr,
              collectionAmount: amt
            });
          }
        });
      }
    });

    if (flatEntries.length === 0) {
      toast.error('कोणतीही जमा रक्कम (> 0) सापडली नाही.');
      return;
    }

    setMonthlySaving(true);
    try {
      const payload = {
        agentId: Number(selectedMonthlyAgentId),
        monthYear: selectedMonth,
        entries: flatEntries
      };

      const res = await axios.post('/api/PigmyCollections/BulkMonthlyChart', payload);
      const successMsg = res.data?.message || 'मासिक कलेक्शन यशस्वीरीत्या जमा झाले!';
      toast.success(successMsg, { duration: 6000 });
      setMonthlySuccessBanner(successMsg);
      setMonthlyImportPreview(null);
      fetchHistory();
      fetchAccounts();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'मासिक चार्ट सेव्ह करताना त्रुटी आली.';
      toast.error(msg);
    } finally {
      setMonthlySaving(false);
    }
  };

  const handleSingleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.pigmyAccountId || !manualForm.collectionAmount) {
      toast.error('कृपया सर्व आवश्यक माहिती भरा.');
      return;
    }

    const selectedAcc = accounts.find(a => a.pigmyAccountID.toString() === manualForm.pigmyAccountId);
    if (!selectedAcc) return;

    setLoading(true);
    try {
      const payload = {
        pigmyAccountId: parseInt(manualForm.pigmyAccountId),
        agentId: selectedAcc.pigmyAgentID,
        collectionDate: manualForm.collectionDate,
        collectionAmount: parseFloat(manualForm.collectionAmount)
      };

      const res = await axios.post('/api/PigmyCollections/Manual', payload);
      toast.success(`कलेक्शन सेव्ह झाले! पावती क्र.: ${res.data.receiptNo}`);
      setManualForm({ ...manualForm, collectionAmount: '', pigmyAccountId: '' });
      fetchHistory();
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data || 'कलेक्शन सेव्ह करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppSync = async () => {
    try {
      const payload = JSON.parse(appSyncJson);
      setLoading(true);
      const res = await axios.post('/api/PigmyCollections/AppSync', payload);
      toast.success(res.data.message || 'अ‍ॅप डेटा सिंक यशस्वी!');
      fetchHistory();
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data || 'अवैध JSON किंवा सिंक त्रुटी.');
    } finally {
      setLoading(false);
    }
  };

  const selectedSingleAccount = accounts.find(a => a.pigmyAccountID.toString() === manualForm.pigmyAccountId);
  const selectedAgentObj = agents.find(a => getAgentId(a) === Number(selectedAgentId));

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
      {/* Outer Container matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden flex flex-col">
        
        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5 text-blue-200" />
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
                <span>पिग्मी दैनंदिन जमा (Pigmy Deposit Collection Center)</span>
              </h2>
              <p className="text-[10px] text-blue-100 font-normal">एजंटनिहाय बल्क कलेक्शन पत्रक, एकल खाते नोंदणी आणि मोबाईल अ‍ॅप सिंक ताळमेळ</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchAccounts(); fetchHistory(); }}
              className="px-2.5 py-0.5 bg-blue-800/60 hover:bg-blue-800 text-white font-semibold rounded-sm border border-blue-400/40 flex items-center gap-1 text-xs cursor-pointer"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${fetchingAccounts ? 'animate-spin' : ''}`} />
              <span>रिफ्रेश</span>
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">

          {/* Mode Navigation Tabs */}
          <div className="inline-flex items-center p-0.5 bg-gray-100/90 rounded-sm border border-gray-300 gap-0.5 print:hidden">
            <button
              type="button"
              onClick={() => setActiveTab('bulk')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'bulk' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <UserGroupIcon className="w-3 h-3" />
              <span>१. दैनिक बल्क पत्रक (Daily Sheet)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('monthly')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'monthly' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <CalendarDaysIcon className="w-3 h-3" />
              <span>२. मासिक चार्ट आयात (Monthly Chart)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'manual' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <PlusIcon className="w-3 h-3" />
              <span>३. मॅन्युअल नोंद (Single)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('app')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'app' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <DevicePhoneMobileIcon className="w-3 h-3" />
              <span>४. अ‍ॅप सिंक (App Sync)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'history' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <ClockIcon className="w-3 h-3" />
              <span>५. व्यवहार इतिहास (History)</span>
            </button>
          </div>

      {/* TAB 1: BULK AGENT COLLECTION SHEET */}
      {activeTab === 'bulk' && (
        <div className="space-y-3">
          
          {/* Header Controls: Select Agent & Date */}
          <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-2.5">
            
            {/* SELECT AGENT */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center justify-between">
                <span>१. पिग्मी एजंट निवडा (Select Agent) *</span>
                {selectedAgentId && (
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-sm">
                    {totalSheetCount} खाती उपलब्ध
                  </span>
                )}
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => {
                  setSelectedAgentId(e.target.value ? Number(e.target.value) : '');
                  setBulkAmounts({});
                }}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">-- पिग्मी एजंट निवडा --</option>
                {agents.map((a) => {
                  const aId = getAgentId(a);
                  const branchName = a.branch?.branchName || '';
                  return (
                    <option key={`ag-${aId}`} value={aId}>
                      {a.agentName} {a.agentCode ? `(${a.agentCode})` : ''} {branchName ? `- [${branchName}]` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* COLLECTION DATE */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                २. जमा तारीख (Collection Date) *
              </label>
              <input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            {/* SEARCH CUSTOMER SHEET FILTER */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                ३. पत्रकात शोधा (Search Customer / A/C)
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="नाव, खाते क्र. किंवा मोबाईल..."
                  value={sheetSearchTerm}
                  onChange={(e) => setSheetSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 border border-gray-300 rounded-sm bg-white text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Daily Excel Tools Bar */}
          {selectedAgentId && (
            <div className="bg-blue-50/70 p-2 rounded border border-blue-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
              <div className="flex items-center gap-1.5 text-xs text-blue-900 font-bold">
                <DocumentArrowUpIcon className="w-4 h-4 text-blue-600" />
                <span>दैनिक एक्सेल टूल्स (Daily Excel Tools)</span>
                <span className="text-[10px] text-blue-700 font-normal">
                  (निवडलेल्या {collectionDate} तारखेपर्यंतची सक्रिय खाती)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadDailyTemplate}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 font-bold rounded-sm border border-blue-300 shadow-2xs flex items-center gap-1.5 text-[11px] cursor-pointer"
                >
                  <ArrowDownTrayIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>📥 दैनिक टेम्पलेट डाउनलोड</span>
                </button>

                <button
                  type="button"
                  onClick={() => dailyFileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-sm shadow-2xs flex items-center gap-1.5 text-[11px] cursor-pointer"
                >
                  <ArrowUpTrayIcon className="w-3.5 h-3.5 text-white" />
                  <span>📤 दैनिक एक्सेल आयात करा</span>
                </button>
                <input
                  type="file"
                  ref={dailyFileInputRef}
                  onChange={handleDailyExcelImport}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* BULK SHEET GRID */}
          {!selectedAgentId ? (
            <div className="py-10 text-center bg-gray-50/80 rounded border border-dashed border-gray-300 p-4 space-y-1">
              <UserGroupIcon className="w-10 h-10 text-gray-400 mx-auto" />
              <h3 className="font-bold text-gray-700 text-xs">कृपया वरील ड्रॉपडाउनमधून पिग्मी एजंट निवडा.</h3>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                एजंट निवडताच त्याच्या हाताखालील सर्व खातेदारांची खाती पत्रकात लोड होतील आणि एकाच वेळी दैनंदिन जमा नोंदवता येईल.
              </p>
            </div>
          ) : agentAccounts.length === 0 ? (
            <div className="py-8 text-center bg-amber-50 rounded border border-amber-200 p-4">
              <p className="font-bold text-amber-900 text-xs">
                निवडलेल्या एजंटच्या नावावर कोणतेही सक्रिय पिग्मी खाते आढळले नाही.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              
              {/* Sheet Instructions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-blue-50/80 border border-blue-200 rounded-sm p-2 text-xs text-blue-900">
                <div className="flex items-center gap-1.5">
                  <SparklesIcon className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    <strong>रॅपिड एंट्री टीप:</strong> आजची जमा रक्कम टाकून कीबोर्डवरील <kbd className="px-1.5 py-0.2 bg-white border border-blue-300 rounded-sm font-mono font-bold text-[10px]">Enter</kbd> दाबल्यास आपोआप पुढील ओळीवर फोकस होईल.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkAmounts({})}
                  className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline shrink-0 cursor-pointer"
                >
                  रक्कम पत्रक रीसेट करा (Reset Sheet)
                </button>
              </div>

              {/* Invalid Daily Accounts Warning Alert Card */}
              {dailyInvalidImports.length > 0 && (
                <div className="bg-red-50 border-2 border-red-400 rounded-sm p-3 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-900 font-extrabold text-xs">
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-600 shrink-0" />
                      <span>⚠️ एक्सेलमधील {dailyInvalidImports.length} खाती अवैध आढळली (Invalid Accounts Marked)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDailyInvalidImports([])}
                      className="text-[11px] text-red-700 hover:text-red-900 underline font-bold cursor-pointer"
                    >
                      बंद करा (Dismiss)
                    </button>
                  </div>
                  <p className="text-[11px] text-red-800">
                    खालील खाती या एजंटशी किंवा सिस्टीमशी जुळली नाहीत, म्हणून त्यांची रक्कम वगळली गेली आहे:
                  </p>
                  <div className="overflow-x-auto max-h-40 border border-red-200 rounded-sm bg-white">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-red-100/70 text-red-900 border-b border-red-200">
                        <tr>
                          <th className="p-1.5 font-bold border-r border-red-200">अ.क्र.</th>
                          <th className="p-1.5 font-bold border-r border-red-200">एक्सेलमधील खाते क्र.</th>
                          <th className="p-1.5 font-bold text-right border-r border-red-200">एक्सेल रक्कम</th>
                          <th className="p-1.5 font-bold">अवैध असण्याचे कारण</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {dailyInvalidImports.map((inv, i) => (
                          <tr key={i} className="hover:bg-red-50">
                            <td className="p-1 text-center font-mono text-gray-500 border-r border-red-100">{i + 1}</td>
                            <td className="p-1 font-mono font-bold text-red-700 border-r border-red-100">{inv.rawAcc}</td>
                            <td className="p-1 text-right font-mono font-bold text-red-700 border-r border-red-100">₹ {inv.rawAmt.toLocaleString('en-IN')}</td>
                            <td className="p-1 text-red-800 font-medium">{inv.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Table Sheet */}
              <div className="overflow-x-auto border border-gray-200 rounded-sm shadow-2xs">
                <table className="w-full text-xs text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                      <th className="py-2 px-2.5 text-center w-10 border-r border-gray-200">#</th>
                      <th className="py-2 px-2.5 border-r border-gray-200">खाते क्रमांक (Account No)</th>
                      <th className="py-2 px-2.5 border-r border-gray-200">खातेदाराचे नाव (Customer Name)</th>
                      <th className="py-2 px-2.5 border-r border-gray-200">मोबाईल नंबर (Mobile)</th>
                      <th className="py-2 px-2.5 text-right border-r border-gray-200">सध्याची जमा ठेव (Current ₹)</th>
                      <th className="py-2 px-3 text-right bg-emerald-100/70 text-emerald-900 font-extrabold">
                        आजची जमा रक्कम (Collection Amount ₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs">
                    {filteredAgentAccounts.map((acc, index) => {
                      const accId = acc.pigmyAccountID;
                      const customerName = getCustomerFullName(acc.customer);
                      const currentBal = acc.totalDepositedAmount || 0;
                      const hasEntered = Boolean(bulkAmounts[accId] && parseFloat(bulkAmounts[accId]) > 0);

                      return (
                        <tr 
                          key={accId} 
                          className={`transition-colors ${
                            hasEntered ? 'bg-emerald-50/80 font-semibold' : 'hover:bg-blue-50/40'
                          }`}
                        >
                          <td className="py-1.5 px-2.5 text-center font-mono text-gray-500 font-bold border-r border-gray-200">
                            {index + 1}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-primary border-r border-gray-200">
                            <div>{format14DigitDisplay(acc.accountNo)}</div>
                            {(acc as any).legacyAccountNumber && (
                              <div className="text-[10px] text-amber-700 font-bold">जुना: {(acc as any).legacyAccountNumber}</div>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 font-bold text-gray-900 border-r border-gray-200">
                            {customerName}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono text-gray-600 border-r border-gray-200">
                            {acc.customer?.mobileNo || '-'}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-700 border-r border-gray-200">
                            ₹ {currentBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-1 px-2.5 bg-emerald-50/40">
                            <input
                              ref={(el) => (inputRefs.current[accId] = el)}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={bulkAmounts[accId] || ''}
                              onChange={(e) => handleAmountInputChange(accId, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index)}
                              className="w-full text-right border border-gray-300 rounded-sm px-2 py-0.5 bg-white text-gray-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 text-xs font-bold text-gray-900">
                    <tr>
                      <td colSpan={4} className="py-2 px-3 text-right text-gray-800 uppercase tracking-wider border-r border-gray-300">
                        एकूण दैनिक संकलन (Total Live Remittance):
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-gray-800 border-r border-gray-300">
                        ₹ {filteredAgentAccounts.reduce((sum, a) => sum + (a.totalDepositedAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-emerald-800 bg-emerald-50 border-emerald-300">
                        ₹ {totalBulkRemittance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* SHEET SUMMARY BAR & SAVE BUTTON */}
              <div className="bg-primary text-white rounded-sm p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                
                <div className="grid grid-cols-3 gap-4 text-xs w-full md:w-auto">
                  <div>
                    <span className="text-blue-100 text-[10px] block font-medium uppercase">एकूण खाती</span>
                    <span className="font-mono font-bold text-sm text-white">{totalSheetCount}</span>
                  </div>
                  <div>
                    <span className="text-blue-100 text-[10px] block font-medium uppercase">जमा खाती</span>
                    <span className="font-mono font-bold text-sm text-emerald-300">{collectedCount}</span>
                  </div>
                  <div>
                    <span className="text-blue-100 text-[10px] block font-medium uppercase">एकूण रोख जमा (Remittance)</span>
                    <span className="font-mono font-extrabold text-base text-yellow-300">
                      ₹ {totalBulkRemittance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleBulkSubmit}
                    disabled={loading || collectedCount === 0}
                    className="w-full md:w-auto px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-sm shadow-xs transition flex items-center justify-center gap-1 text-xs cursor-pointer"
                  >
                    {loading ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircleIcon className="w-4 h-4" />
                    )}
                    <span>सर्व कलेक्शन सेव्ह करा ({collectedCount} खाती)</span>
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* TAB 2: MONTHLY COLLECTION CHART MATRIX IMPORT */}
      {activeTab === 'monthly' && (
        <div className="space-y-3">
          
          {/* Success Banner if collection saved */}
          {monthlySuccessBanner && (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded p-3 text-emerald-900 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-xs">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{monthlySuccessBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setMonthlySuccessBanner(null)}
                className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-sm font-bold cursor-pointer transition-colors"
              >
                ठीक आहे (OK)
              </button>
            </div>
          )}

          {/* Header Controls: Select Agent & Month */}
          <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-2.5 items-end">
            
            {/* SELECT AGENT */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                १. पिग्मी एजंट निवडा (Select Agent) *
              </label>
              <select
                value={selectedMonthlyAgentId}
                onChange={(e) => {
                  setSelectedMonthlyAgentId(e.target.value ? Number(e.target.value) : '');
                  setMonthlyImportPreview(null);
                  setExistingMonthlyWarning(null);
                }}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">-- पिग्मी एजंट निवडा --</option>
                {agents.map((a) => {
                  const aId = getAgentId(a);
                  const branchName = a.branch?.branchName || '';
                  return (
                    <option key={`monthly-ag-${aId}`} value={aId}>
                      {a.agentName} {a.agentCode ? `(${a.agentCode})` : ''} {branchName ? `- [${branchName}]` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* SELECT MONTH & YEAR */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                २. महिना व वर्ष (Month & Year) <span className="text-[10px] text-gray-500 font-normal">(किंवा एक्सेलवरून आपोआप ओळखले जाईल)</span>
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setMonthlyImportPreview(null);
                  setExistingMonthlyWarning(null);
                }}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            {/* ACTION BUTTONS: DOWNLOAD TEMPLATE & UPLOAD */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadMonthlyTemplate}
                disabled={!selectedMonthlyAgentId}
                className="flex-1 px-2.5 py-1.5 bg-white hover:bg-blue-50 text-blue-700 font-bold rounded-sm border border-blue-300 shadow-2xs flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowDownTrayIcon className="w-4 h-4 text-blue-600" />
                <span>📥 मासिक टेम्पलेट</span>
              </button>

              <button
                type="button"
                onClick={() => monthlyFileInputRef.current?.click()}
                disabled={!selectedMonthlyAgentId}
                className="flex-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-sm shadow-2xs flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpTrayIcon className="w-4 h-4 text-white" />
                <span>📤 एक्सेल चार्ट आयात</span>
              </button>
              <input
                type="file"
                ref={monthlyFileInputRef}
                onChange={handleMonthlyExcelImport}
                accept=".xlsx, .xls"
                className="hidden"
              />
            </div>
          </div>

          {/* Monthly Guide / Instructions when no file uploaded */}
          {!monthlyImportPreview ? (
            <div className="py-8 text-center bg-gray-50/80 rounded border border-dashed border-gray-300 p-6 space-y-2">
              <TableCellsIcon className="w-10 h-10 text-gray-400 mx-auto" />
              <h3 className="font-bold text-gray-800 text-sm">मासिक पिग्मी कलेक्शन चार्ट आयात (Monthly Chart Import)</h3>
              <p className="text-xs text-gray-600 max-w-xl mx-auto">
                तुम्ही संपूर्ण महिन्याचे (१ ते ३०/३१ तारखांचे) कलेक्शन एकाच एक्सेल चार्टद्वारे थेट आयात करू शकता.
                'डेली पिग्मि कलेक्शन चार्ट format' किंवा 'मासिक टेम्पलेट' फाईल वापरून अपलोड करा.
              </p>
              <div className="inline-flex items-center gap-2 text-[11px] text-blue-700 bg-blue-50 px-3 py-1 rounded border border-blue-200">
                <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
                <span>खाते उघडल्याच्या तारखेची (Opening Date) आपोआप पडताळणी केली जाते.</span>
              </div>
            </div>
          ) : (
            /* PREVIEW OF PARSED MONTHLY MATRIX */
            <div className="space-y-3">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="bg-white p-2.5 rounded border border-gray-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">निवडलेला महिना</span>
                  <span className="text-sm font-extrabold text-gray-900 font-mono">{selectedMonth}</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-gray-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">वैध खाती (Valid)</span>
                  <span className="text-sm font-extrabold text-emerald-700 font-mono">
                    {monthlyImportPreview.rows.filter(r => r.isValid && r.pigmyAccountId > 0).length} खाती
                  </span>
                </div>
                {monthlyImportPreview.rows.some(r => !r.isValid || r.pigmyAccountId <= 0) && (
                  <div className="bg-red-50 p-2.5 rounded border border-red-300 shadow-2xs">
                    <span className="text-[10px] text-red-700 font-bold block uppercase">अवैध खाती (Invalid)</span>
                    <span className="text-sm font-black text-red-700 font-mono">
                      {monthlyImportPreview.rows.filter(r => !r.isValid || r.pigmyAccountId <= 0).length} खाती
                    </span>
                  </div>
                )}
                <div className="bg-white p-2.5 rounded border border-gray-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">एकूण दैनंदिन नोंदी</span>
                  <span className="text-sm font-extrabold text-amber-700 font-mono">{monthlyImportPreview.totalDepositEntries} नोंदी</span>
                </div>
                <div className="bg-emerald-50/80 p-2.5 rounded border border-emerald-300 shadow-2xs">
                  <span className="text-[10px] text-emerald-700 font-bold block uppercase">एकूण मासिक जमा रक्कम</span>
                  <span className="text-base font-black text-emerald-800 font-mono">
                    ₹ {monthlyImportPreview.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Skipped / Invalid Rows Notification if any */}
              {monthlyImportPreview.skippedRows.length > 0 && (
                <div className="bg-red-50 p-2.5 rounded border border-red-300 text-xs text-red-900 flex items-start gap-2 shadow-2xs">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">⚠️ {monthlyImportPreview.skippedRows.length} खाती अवैध आढळली (टेबलमध्ये खाली लाल रंगात मार्किंग केली आहेत): </span>
                    {monthlyImportPreview.skippedRows.slice(0, 4).map((sr, idx) => (
                      <span key={idx} className="mr-2 inline-block bg-white px-1.5 py-0.5 rounded border border-red-200 text-[10px] text-red-800 font-mono mt-1">
                        [{sr.rawAccount || sr.rawName}: {sr.reason}]
                      </span>
                    ))}
                    {monthlyImportPreview.skippedRows.length > 4 && (
                      <span className="font-bold ml-1">आणि इतर {monthlyImportPreview.skippedRows.length - 4}...</span>
                    )}
                  </div>
                </div>
              )}

              {/* Duplicate Import Warning Banner if existing collections found */}
              {existingMonthlyWarning && (
                <div className="bg-red-50 border-2 border-red-500 rounded p-3 text-red-900 flex items-start gap-3 shadow-xs">
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-xs text-red-900 flex items-center gap-1.5">
                      <span>⚠️ आधीच जमा झालेले कलेक्शन आढळले (Duplicate Collection Blocked)</span>
                    </h4>
                    <p className="text-[11px] text-red-800">
                      या एजंटच्या खात्यांवर <strong>{existingMonthlyWarning.monthYear}</strong> महिन्यामध्ये आधीच <strong>{existingMonthlyWarning.count}</strong> दैनंदिन नोंदी (<strong>{existingMonthlyWarning.accountsCount}</strong> खाती, एकूण रक्कम <strong>₹{existingMonthlyWarning.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>) जमा आहेत.
                    </p>
                    <p className="text-[11px] text-red-900 font-extrabold">
                      ⛔ खातेदारांच्या खात्यांवर दुबार (Duplicate) रक्कम जमा होऊ नये म्हणून हे मासिक पत्रक पुन्हा सेव्ह करण्यास मनाई आहे.
                    </p>
                  </div>
                </div>
              )}

              {/* Matrix Table Preview */}
              <div className="bg-white rounded border border-gray-300 shadow-2xs overflow-hidden">
                <div className="p-2 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-gray-800">
                      आयात पूर्वदृश्य (Import Preview - {monthlyImportPreview.fileName})
                    </span>
                    <span className="text-[11px] text-gray-500">
                      ({monthlyImportPreview.rows.length} पैकी {
                        monthlyImportPreview.rows.filter(r => {
                          if (previewFilter === 'valid') return r.isValid && r.pigmyAccountId > 0;
                          if (previewFilter === 'invalid') return !r.isValid || r.pigmyAccountId <= 0;
                          return true;
                        }).length
                      } खाती दाखवत आहे)
                    </span>
                  </div>

                  {/* Filter tabs: All / Valid / Invalid */}
                  <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded border border-gray-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('all')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        previewFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      सर्व खाती ({monthlyImportPreview.rows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('valid')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        previewFilter === 'valid' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:text-emerald-900'
                      }`}
                    >
                      ✓ वैध ({monthlyImportPreview.rows.filter(r => r.isValid && r.pigmyAccountId > 0).length})
                    </button>
                    {monthlyImportPreview.rows.some(r => !r.isValid || r.pigmyAccountId <= 0) && (
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('invalid')}
                        className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          previewFilter === 'invalid' ? 'bg-red-600 text-white shadow-2xs' : 'text-red-700 bg-red-50 hover:bg-red-100'
                        }`}
                      >
                        <span>❌ अवैध खाती</span>
                        <span className="px-1 bg-white text-red-700 rounded-full text-[10px]">
                          {monthlyImportPreview.rows.filter(r => !r.isValid || r.pigmyAccountId <= 0).length}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-300 z-10">
                      <tr>
                        <th className="p-1.5 font-bold border-r border-gray-300 w-8 text-center">अ.क्र.</th>
                        <th className="p-1.5 font-bold border-r border-gray-300 min-w-[140px]">खाते क्र. (A/C No)</th>
                        <th className="p-1.5 font-bold border-r border-gray-300 min-w-[150px]">खातेदाराचे नाव</th>
                        {monthlyImportPreview.columns.map((col, idx) => (
                          <th key={idx} className="p-1 font-bold border-r border-gray-300 text-center min-w-[50px] whitespace-nowrap bg-gray-100">
                            {col}
                          </th>
                        ))}
                        <th className="p-1.5 font-bold text-right min-w-[100px] bg-blue-50 text-blue-900 border-l border-gray-300 whitespace-nowrap">
                          एकूण जमा (Total)
                        </th>
                        <th className="p-1.5 font-bold text-center w-24 whitespace-nowrap bg-gray-100 border-l border-gray-300">स्थिती (Status)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {monthlyImportPreview.rows
                        .filter(r => {
                          if (previewFilter === 'valid') return r.isValid && r.pigmyAccountId > 0;
                          if (previewFilter === 'invalid') return !r.isValid || r.pigmyAccountId <= 0;
                          return true;
                        })
                        .map((row, idx) => {
                          const isInvalid = !row.isValid || row.pigmyAccountId <= 0 || Boolean(row.isInvalidAccount);
                          return (
                            <tr key={idx} className={`transition-colors ${
                              isInvalid 
                                ? 'bg-red-50/70 hover:bg-red-100/70 border-l-4 border-l-red-600' 
                                : 'hover:bg-blue-50/40'
                            }`}>
                              <td className="p-1.5 text-center text-gray-500 border-r border-gray-200">{idx + 1}</td>
                              <td className="p-1.5 font-mono font-bold border-r border-gray-200 whitespace-nowrap">
                                <span className={isInvalid ? "text-red-700 font-extrabold" : "text-gray-900"}>
                                  {row.pigmyAccountId > 0 ? format14DigitDisplay(row.accountNo) : (row.accountNo || 'अवैध खाते')}
                                </span>
                                {row.legacyAccountNumber && (
                                  <div className={`text-[10px] font-bold ${isInvalid ? 'text-red-600' : 'text-amber-700'}`}>
                                    जुना: {row.legacyAccountNumber}
                                  </div>
                                )}
                              </td>
                              <td className="p-1.5 border-r border-gray-200 whitespace-nowrap">
                                <div className={isInvalid ? "font-bold text-red-900" : "text-gray-800"}>
                                  {row.customerName}
                                </div>
                                {row.warning && (
                                  <div className={`text-[10px] font-semibold mt-0.5 ${isInvalid ? 'text-red-700 font-bold' : 'text-amber-600'}`}>
                                    ⚠️ {row.warning}
                                  </div>
                                )}
                              </td>
                              {monthlyImportPreview.columns.map((col, cIdx) => {
                                const dayNum = parseInt(col.split('/')[0]) || parseInt(col);
                                const [y, m] = selectedMonth.split('-');
                                const targetDateStr = `${y}-${m}-${String(dayNum).padStart(2, '0')}`;
                                const amt = row.dailyAmounts[targetDateStr] || 0;
                                return (
                                  <td key={cIdx} className={`p-1 text-center font-mono border-r border-gray-200 whitespace-nowrap ${
                                    isInvalid 
                                      ? (amt > 0 ? 'bg-red-100 text-red-800 font-bold line-through' : 'text-red-200')
                                      : (amt > 0 ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-gray-300')
                                  }`}>
                                    {amt > 0 ? amt : '-'}
                                  </td>
                                );
                              })}
                              <td className={`p-1.5 text-right font-mono font-black border-l border-gray-200 whitespace-nowrap ${
                                isInvalid ? 'text-red-700 bg-red-100/50 line-through' : 'text-primary bg-blue-50/50'
                              }`}>
                                ₹ {row.rowTotal.toLocaleString('en-IN')}
                              </td>
                              <td className="p-1.5 text-center border-l border-gray-200 whitespace-nowrap">
                                {isInvalid ? (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-black rounded-sm border border-red-300 shadow-2xs">
                                    ❌ अवैध खाते
                                  </span>
                                ) : row.rowTotal > 0 ? (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-sm">
                                    वैध
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-sm">
                                    निरंक
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot className="bg-slate-100 border-t-2 border-slate-300 text-[11px] font-bold text-gray-900">
                      <tr>
                        <td colSpan={3} className="p-2 text-right text-gray-900 font-extrabold uppercase tracking-wider border-r border-gray-300 bg-slate-200/80">
                          दैनिक उभी बेरीज (Daily Total ₹):
                        </td>
                        {monthlyImportPreview.columns.map((col, cIdx) => {
                          const dayNum = parseInt(col.split('/')[0]) || parseInt(col);
                          const [y, m] = selectedMonth.split('-');
                          const targetDateStr = `${y}-${m}-${String(dayNum).padStart(2, '0')}`;
                          const dayVerticalSum = monthlyImportPreview.rows
                            .filter(r => r.isValid && r.pigmyAccountId > 0)
                            .reduce((sum, r) => sum + (r.dailyAmounts[targetDateStr] || 0), 0);

                          return (
                            <td key={cIdx} className={`p-1.5 text-center font-mono border-r border-gray-300 whitespace-nowrap ${
                              dayVerticalSum > 0 ? 'bg-emerald-100/70 text-emerald-900 font-black' : 'text-gray-400 font-normal'
                            }`}>
                              {dayVerticalSum > 0 ? dayVerticalSum.toLocaleString('en-IN') : '-'}
                            </td>
                          );
                        })}
                        <td className="p-1.5 text-right font-mono font-black text-emerald-900 bg-emerald-200/80 border-l border-gray-300 whitespace-nowrap">
                          ₹ {monthlyImportPreview.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-1.5 text-center border-l border-gray-300 whitespace-nowrap bg-slate-200/80 text-[10px] text-gray-700">
                          एकूण
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Footer Save Action Bar */}
                <div className="p-3 bg-gray-50 border-t border-gray-300 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMonthlyImportPreview(null)}
                      className="px-3 py-1 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-sm border border-gray-300 text-xs cursor-pointer"
                    >
                      रद्द करा (Cancel)
                    </button>
                    <span className="text-xs text-gray-600">
                      एकूण <strong className="text-gray-900">{monthlyImportPreview.totalDepositEntries}</strong> नोंदी खात्यांवर जमा केल्या जातील.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveMonthlyImport}
                    disabled={monthlySaving || monthlyImportPreview.totalAmount <= 0 || Boolean(existingMonthlyWarning)}
                    className={`px-4 py-1.5 font-bold rounded-sm shadow-sm flex items-center gap-2 text-xs transition-all ${
                      existingMonthlyWarning 
                        ? 'bg-red-100 text-red-700 border border-red-300 cursor-not-allowed' 
                        : 'bg-primary hover:bg-blue-800 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {monthlySaving ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin text-white" />
                    ) : existingMonthlyWarning ? (
                      <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
                    ) : (
                      <CheckCircleIcon className="w-4 h-4 text-emerald-300" />
                    )}
                    <span>
                      {existingMonthlyWarning
                        ? '🚫 दुबार नोंद बंदी: या महिन्याचे कलेक्शन आधीच जमा आहे'
                        : `सर्व मासिक कलेक्शन खात्यांवर जमा करा (₹${monthlyImportPreview.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
                      }
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 3: SINGLE MANUAL ENTRY */}
      {activeTab === 'manual' && (
        <div className="bg-gray-50/80 p-3 rounded border border-gray-200 space-y-3">
          <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider pb-1 border-b border-gray-200 flex items-center gap-1.5">
            <PlusIcon className="w-4 h-4 text-primary" />
            <span>एकल खाते मॅन्युअल नोंदणी (Single Account Manual Collection)</span>
          </div>
          
          <form onSubmit={handleSingleManualSubmit} className="max-w-3xl space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              <div className="space-y-0.5 md:col-span-2">
                <label className="text-[11px] font-medium text-gray-600">पिग्मी खाते निवडा (Select Account) *</label>
                <select 
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={manualForm.pigmyAccountId}
                  onChange={(e) => setManualForm({...manualForm, pigmyAccountId: e.target.value})}
                  required
                >
                  <option value="">-- पिग्मी खाते क्र. किंवा नाव शोधा --</option>
                  {accounts.filter(a => a.status === 'Active').map(acc => (
                    <option key={acc.pigmyAccountID} value={acc.pigmyAccountID}>
                      {acc.accountNo} - {getCustomerFullName(acc.customer)} (एजंट: {acc.agent?.agentName || acc.pigmyAgent?.agentName || '-'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSingleAccount && (
                <div className="md:col-span-2 bg-blue-50/80 p-2.5 rounded-sm border border-blue-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">सध्याची एकूण ठेव (Current Balance)</p>
                    <p className="text-sm font-extrabold text-primary font-mono">
                      ₹ {selectedSingleAccount.totalDepositedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right space-y-0.5 text-[11px]">
                    <p className="text-gray-700 font-bold">खातेदार: <span className="text-gray-900">{getCustomerFullName(selectedSingleAccount.customer)}</span></p>
                    <p className="text-gray-600">एजंट: <span className="text-gray-800">{selectedSingleAccount.agent?.agentName || selectedSingleAccount.pigmyAgent?.agentName || '-'}</span></p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-0.5 block">जमा तारीख (Collection Date) *</label>
                <input 
                  type="date" 
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={manualForm.collectionDate}
                  onChange={(e) => setManualForm({...manualForm, collectionDate: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-0.5 block">जमा रक्कम (Collection Amount ₹) *</label>
                <input 
                  type="number" 
                  min="1"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white font-mono font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={manualForm.collectionAmount}
                  onChange={(e) => setManualForm({...manualForm, collectionAmount: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className="flex items-center gap-1 px-4 py-1.5 bg-primary hover:bg-[#004a75] text-white font-bold rounded-sm text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <CheckCircleIcon className="w-3.5 h-3.5" />}
                <span>कलेक्शन सेव्ह करा (Save Collection)</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: MOBILE APP SYNC & REVIEW QUEUE */}
      {activeTab === 'app' && (
        <div className="bg-gray-50/80 p-3 rounded border border-gray-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <DevicePhoneMobileIcon className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  मोबाईल अ‍ॅप सिंक व तपासणी (Mobile App Sync & Audit Queue)
                </h2>
                <p className="text-[10px] text-gray-500">एजंट मोबाईल अ‍ॅपमधील रिअल-टाइम व ऑफलाइन व्यवहारांची तपासणी</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-sm border border-gray-300 p-0.5 bg-white text-xs">
                <button
                  type="button"
                  onClick={() => setMobileSyncView('queue')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-xs transition ${
                    mobileSyncView === 'queue' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📡 सिंक यादी व ऑडिट (Live Queue)
                </button>
                <button
                  type="button"
                  onClick={() => setMobileSyncView('json')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-xs transition ${
                    mobileSyncView === 'json' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ⚡ ऑफलाईन JSON सिंक (JSON Tool)
                </button>
              </div>

              <button
                type="button"
                onClick={() => fetchMobileQueue(selectedQueueAgent)}
                className="p-1.5 border border-gray-300 rounded-sm bg-white hover:bg-gray-100 text-gray-700"
                title="रिफ्रेश करा"
              >
                <ArrowPathIcon className={`w-3.5 h-3.5 ${mobileQueueLoading ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>
          </div>

          {mobileSyncView === 'queue' ? (
            <div className="space-y-3">
              {/* Summary KPIs & Agent Filter */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="bg-white p-2.5 rounded border border-indigo-100 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">आजचे मोबाईल कलेक्शन</span>
                  <span className="text-base font-extrabold text-indigo-700 font-mono">
                    {mobileQueue?.totalCount || 0} पावत्या
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">एकूण जमा रक्कम</span>
                  <span className="text-base font-extrabold text-emerald-700 font-mono">
                    ₹ {(mobileQueue?.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded border border-purple-100 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">सक्रिय सिंक एजंट्स</span>
                  <span className="text-base font-extrabold text-purple-700 font-mono">
                    {mobileQueue?.agentSummaries?.length || 0} एजंट
                  </span>
                </div>
                <div className="bg-white p-2 rounded border border-gray-200 shadow-2xs flex flex-col justify-center">
                  <label className="text-[10px] font-bold text-gray-600 uppercase mb-1">एजंटनुसार फिल्टर</label>
                  <select
                    className="border border-gray-300 rounded-sm px-1.5 py-0.5 text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={selectedQueueAgent}
                    onChange={(e) => setSelectedQueueAgent(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">सर्व एजंट्स (All Agents)</option>
                    {agents.map((ag) => (
                      <option key={ag.pigmyAgentID} value={ag.pigmyAgentID}>
                        {ag.agentName} {ag.agentCode ? `(${ag.agentCode})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Agent Batch Cards */}
              {mobileQueue?.agentSummaries && mobileQueue.agentSummaries.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {mobileQueue.agentSummaries.map((ag) => (
                    <div key={ag.agentId} className="bg-white p-2 rounded border border-gray-200 shadow-2xs flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-gray-800 flex items-center gap-1">
                          <span>{ag.agentName}</span>
                          <span className="text-[10px] text-gray-400">#{ag.agentId}</span>
                        </div>
                        <div className="text-[11px] text-gray-600">
                          {ag.count} पावत्या • <span className="font-bold text-emerald-700">₹ {ag.totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div>
                        {ag.pendingVouchers === 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                            <ShieldCheckIcon className="w-3 h-3 text-emerald-600" /> व्हाउचर पूर्ण
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                            {ag.pendingVouchers} प्रलंबित
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Live Collections Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-sm bg-white">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                      <th className="py-2 px-2.5">पावती क्रमांक (Receipt)</th>
                      <th className="py-2 px-2.5">खाते क्रमांक (Account)</th>
                      <th className="py-2 px-2.5">खातेदाराचे नाव (Customer)</th>
                      <th className="py-2 px-2.5">एजंट (Agent)</th>
                      <th className="py-2 px-2.5 text-right">रक्कम (Amount ₹)</th>
                      <th className="py-2 px-2.5 text-center">मोड (Mode)</th>
                      <th className="py-2 px-2.5 text-center">तपासणी स्थिती (Status)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs">
                    {mobileQueueLoading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500">
                          <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-1" />
                          मोबाईल सिंक माहिती लोड होत आहे...
                        </td>
                      </tr>
                    ) : !mobileQueue?.items || mobileQueue.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500 font-medium">
                          आज मोबाईल अ‍ॅपद्वारे कोणतेही कलेक्शन सिंक झालेले नाही.
                        </td>
                      </tr>
                    ) : (
                      mobileQueue.items.map((item) => (
                        <tr key={item.collectionId} className="hover:bg-indigo-50/40 transition">
                          <td className="py-2 px-2.5 font-mono font-bold text-gray-900">
                            {item.receiptNo}
                            {item.syncReferenceId && (
                              <div className="text-[9px] text-gray-400 truncate max-w-[120px]" title={item.syncReferenceId}>
                                UUID: {item.syncReferenceId}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-primary">{item.pigmyAccountNo}</td>
                          <td className="py-2 px-2.5">
                            <div className="font-bold text-gray-900">{item.customerName || '-'}</div>
                            {item.mobileNo && <div className="text-[10px] text-gray-500 font-mono">{item.mobileNo}</div>}
                          </td>
                          <td className="py-2 px-2.5 font-semibold text-gray-700">{item.agentName}</td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700">
                            ₹ {item.collectionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                              {item.paymentMode || 'CASH'}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            {item.isVoucherGenerated ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                <CheckCircleIcon className="w-3 h-3 text-emerald-600" /> सिंक व व्हाउचर पूर्ण
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                प्रलंबित
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-indigo-50 border border-indigo-200 rounded p-2 text-xs text-indigo-900">
                <span>
                  <strong>ऑफलाइन बॅच सिंक:</strong> मोबाईल अ‍ॅप नेटवर्क नसताना ऑफलाइन साठवलेला व्यवहार डेटा JSON स्वरूपात खाली पेस्ट करून सिंक करा.
                </span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold text-[10px] rounded">
                  Idempotency Protected
                </span>
              </div>

              <textarea
                className="w-full h-44 p-3 font-mono text-xs bg-slate-900 text-emerald-400 rounded-sm border border-slate-700 focus:outline-none"
                value={appSyncJson}
                onChange={(e) => setAppSyncJson(e.target.value)}
              />

              <div className="flex justify-end">
                <button 
                  onClick={handleAppSync}
                  disabled={loading}
                  className="flex items-center gap-1 px-4 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-sm text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <DocumentArrowUpIcon className="w-3.5 h-3.5" />}
                  <span>सिंक डेटा सेव्ह करा (Process Offline Sync)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COLLECTION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-sm border border-gray-200 p-3 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">नुकतेच झालेले पिग्मी व्यवहार (Recent Collections History)</h2>
            <button onClick={fetchHistory} className="text-xs text-primary hover:underline flex items-center font-bold cursor-pointer">
              <ArrowPathIcon className="w-3.5 h-3.5 mr-1" /> रिफ्रेश (Refresh)
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                  <th className="py-2 px-2.5">पावती क्र. (Receipt No)</th>
                  <th className="py-2 px-2.5">तारीख (Date)</th>
                  <th className="py-2 px-2.5">खाते क्रमांक (Account)</th>
                  <th className="py-2 px-2.5">ग्राहक (Customer)</th>
                  <th className="py-2 px-2.5">एजंट (Agent)</th>
                  <th className="py-2 px-2.5 text-right">जमा रक्कम (Amount ₹)</th>
                  <th className="py-2 px-2.5 text-center">माध्यम (Source)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 font-medium">
                      कोणताही इतिहास सापडला नाही.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.collectionId} className="hover:bg-blue-50/40 transition">
                      <td className="py-2 px-2.5 font-mono font-bold text-gray-900">{item.receiptNo}</td>
                      <td className="py-2 px-2.5">{new Date(item.collectionDate).toLocaleDateString('en-GB')}</td>
                      <td className="py-2 px-2.5 font-mono font-bold text-primary">{item.pigmyAccountNo}</td>
                      <td className="py-2 px-2.5 font-semibold text-gray-800">{item.customerName || '-'}</td>
                      <td className="py-2 px-2.5 font-semibold text-gray-700">{item.agentName}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700">
                        ₹ {item.collectionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                          item.collectionSource === 'MANUAL' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {item.collectionSource}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
}
