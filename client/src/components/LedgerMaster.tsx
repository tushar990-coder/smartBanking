import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  BookOpen, 
  Layers, 
  Building2, 
  Wallet, 
  CheckCircle, 
  XCircle, 
  Search, 
  Plus, 
  RotateCcw, 
  Save, 
  Edit2, 
  Trash2, 
  Download, 
  X, 
  FolderTree, 
  ShieldCheck, 
  TrendingUp, 
  Filter,
  FileSpreadsheet,
  Table as TableIcon,
  ListFilter
} from 'lucide-react';

interface AccountGroup {
  groupID: number;
  groupCode?: string;
  groupName: string;
  groupNameEnglish?: string;
  parentGroupID?: number | null;
  natureOfGroup?: string;
  displayOrder?: number;
  depth?: number;
}

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  ledgerNameEnglish?: string;
  groupID: number;
  accountGroup?: AccountGroup;
  openingBalance: number;
  openingBalanceType: string;
  reportType?: string;
  accountType?: string;
  isActive: boolean;
}

export default function LedgerMaster() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [nextLedgerId, setNextLedgerId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNatureFilter, setSelectedNatureFilter] = useState<string>('All');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'flat' | 'tree'>('flat'); // Default is clean flat table
  const [showListModal, setShowListModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const ledgerNameInputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<any>(null);

  const [formData, setFormData] = useState({
    ledgerID: '',
    ledgerName: '',
    ledgerNameEnglish: '',
    groupID: '',
    reportType: 'ताळेबंद',
    accountType: 'GL',
    isActive: true
  });

  const [success, setSuccess] = useState<string>('');
  const [error, setError] = useState<string>('');

  const LEDGER_API_URL = '/api/Ledgers';
  const GROUP_API_URL = '/api/AccountGroups';

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const response = await axios.get(LEDGER_API_URL);
        if (response.data && isMounted) {
          setLedgers(response.data);
        }
      } catch (err) {
        if (isMounted) console.error("Error fetching ledgers", err);
      }

      try {
        const nextRes = await axios.get(`${LEDGER_API_URL}/NextId`);
        if (nextRes.data && isMounted) {
          setNextLedgerId(nextRes.data.nextLedgerId);
        }
      } catch (err) {
        if (isMounted) console.error("Error fetching next ledger ID", err);
      }

      try {
        const grpRes = await axios.get(GROUP_API_URL);
        if (grpRes.data && isMounted) {
          const enriched = ensureGroupCodes(grpRes.data);
          setGroups(enriched);
        }
      } catch (err) {
        if (isMounted) console.error("Error fetching groups", err);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await axios.get(LEDGER_API_URL);
      if (response.data) {
        setLedgers(response.data);
      }
      fetchNextLedgerId();
    } catch (err) {
      console.error("Error fetching ledgers", err);
    }
  };

  const fetchNextLedgerId = async () => {
    try {
      const response = await axios.get(`${LEDGER_API_URL}/NextId`);
      if (response.data) {
        setNextLedgerId(response.data.nextLedgerId);
      }
    } catch (err) {
      console.error("Error fetching next ledger ID", err);
    }
  };

  const ensureGroupCodes = (list: AccountGroup[]): AccountGroup[] => {
    return list.map(g => ({
      ...g,
      groupCode: g.groupCode && g.groupCode.trim() !== '' ? g.groupCode.trim() : g.groupID.toString()
    }));
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get(GROUP_API_URL);
      if (response.data) {
        const enriched = ensureGroupCodes(response.data);
        setGroups(enriched);
      }
    } catch (err) {
      console.error("Error fetching groups", err);
    }
  };

  const getSortedGroups = (groupsList: AccountGroup[]) => {
    const listWithCodes = ensureGroupCodes(groupsList);
    const sorted: AccountGroup[] = [];
    const addedIds = new Set<number>();
    
    const addGroupAndChildren = (parentId: number | null | undefined, depth: number) => {
      const childrenGroups = listWithCodes.filter(g => g.parentGroupID === parentId);
      childrenGroups.sort((a, b) => {
        const orderA = a.displayOrder ?? 0;
        const orderB = b.displayOrder ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        const codeA = a.groupCode || a.groupID.toString();
        const codeB = b.groupCode || b.groupID.toString();
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });

      childrenGroups.forEach(child => {
        if (!addedIds.has(child.groupID)) {
          child.depth = depth;
          sorted.push(child);
          addedIds.add(child.groupID);
          addGroupAndChildren(child.groupID, depth + 1);
        }
      });
    };
    
    const topLevelGroups = listWithCodes.filter(g => !g.parentGroupID);
    topLevelGroups.sort((a, b) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      const codeA = a.groupCode || a.groupID.toString();
      const codeB = b.groupCode || b.groupID.toString();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

    topLevelGroups.forEach(pg => {
      if (!addedIds.has(pg.groupID)) {
        pg.depth = 0;
        sorted.push(pg);
        addedIds.add(pg.groupID);
        addGroupAndChildren(pg.groupID, 1);
      }
    });
    
    const remaining = listWithCodes.filter(g => !addedIds.has(g.groupID));
    sorted.push(...remaining);
    
    return sorted;
  };

  const sortedGroups = useMemo(() => getSortedGroups(groups), [groups]);

  // Group lookup map for fast details retrieval
  const groupMap = useMemo(() => {
    const map = new Map<number, AccountGroup>();
    groups.forEach(g => map.set(g.groupID, g));
    return map;
  }, [groups]);

  // Statistics KPI Calculations
  const totalLedgersCount = ledgers.length;
  const cashAndBankCount = useMemo(() => {
    return ledgers.filter(l => 
      l.accountType === 'Cash In Hand' || 
      l.accountType === 'Bank Account' ||
      l.ledgerName.includes('रोख') ||
      l.ledgerName.includes('बँक') ||
      (l.ledgerNameEnglish && (l.ledgerNameEnglish.toLowerCase().includes('cash') || l.ledgerNameEnglish.toLowerCase().includes('bank')))
    ).length;
  }, [ledgers]);

  const balanceSheetCount = useMemo(() => {
    return ledgers.filter(l => l.reportType === 'ताळेबंद' || !l.reportType).length;
  }, [ledgers]);

  const activeLedgersCount = useMemo(() => {
    return ledgers.filter(l => l.isActive).length;
  }, [ledgers]);

  const maxExistingId = ledgers.length > 0 ? Math.max(...ledgers.map(l => l.ledgerID)) : 0;
  const calculatedNextId = nextLedgerId ? nextLedgerId.toString() : (maxExistingId + 1).toString();
  const currentDisplayId = formData.ledgerID || (editId ? editId.toString() : calculatedNextId);

  const resetForm = () => {
    setEditId(null);
    setFormData({
      ledgerID: '',
      ledgerName: '',
      ledgerNameEnglish: '',
      groupID: '',
      reportType: 'ताळेबंद',
      accountType: 'GL',
      isActive: true
    });
    setSuccess('');
    setError('');
    setTimeout(() => {
      if (ledgerNameInputRef.current) {
        ledgerNameInputRef.current.focus();
      }
    }, 100);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({
      ...prev,
      [name]: val
    }));
  };

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedGroupId = e.target.value;
    const selectedGroup = groups.find(g => g.groupID.toString() === selectedGroupId);

    let suggestedReportType = formData.reportType;
    let suggestedAccountType = formData.accountType;

    if (selectedGroup) {
      if (selectedGroup.natureOfGroup === 'Assets' || selectedGroup.natureOfGroup === 'Liabilities') {
        suggestedReportType = 'ताळेबंद';
      } else if (selectedGroup.natureOfGroup === 'Income' || selectedGroup.natureOfGroup === 'Expenses') {
        suggestedReportType = 'नफातोटा पत्रक';
      }

      const gName = (selectedGroup.groupName + ' ' + (selectedGroup.groupNameEnglish || '')).toLowerCase();
      if (gName.includes('बँक') || gName.includes('bank')) {
        suggestedAccountType = 'Bank Account';
      } else if (gName.includes('रोख') || gName.includes('cash')) {
        suggestedAccountType = 'Cash In Hand';
      } else if (gName.includes('कर्ज') || gName.includes('loan')) {
        suggestedAccountType = 'Loan Account';
      } else if (gName.includes('गुंतवणूक') || gName.includes('investment')) {
        suggestedAccountType = 'Investment Account';
      } else if (gName.includes('ठेव') || gName.includes('deposit')) {
        suggestedAccountType = 'Deposit';
      } else if (gName.includes('भांडवल') || gName.includes('capital') || gName.includes('share')) {
        suggestedAccountType = 'Share Capital';
      } else if (selectedGroup.natureOfGroup === 'Expenses') {
        suggestedAccountType = 'Expenses';
      } else if (selectedGroup.natureOfGroup === 'Income') {
        suggestedAccountType = 'Income';
      }
    }

    setFormData(prev => ({
      ...prev,
      groupID: selectedGroupId,
      reportType: suggestedReportType,
      accountType: suggestedAccountType
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (!formData.ledgerName.trim()) {
      setError("कृपया खात्याचे नाव (मराठी) प्रविष्ट करा.");
      if (ledgerNameInputRef.current) ledgerNameInputRef.current.focus();
      return;
    }

    if (!formData.groupID) {
      setError("कृपया खाते गट (Account Group) निवडा.");
      return;
    }

    setIsSaving(true);
    try {
      const assignedId = formData.ledgerID ? parseInt(formData.ledgerID) : (editId || 0);
      const payload = {
        ...formData,
        ledgerID: assignedId,
        groupID: parseInt(formData.groupID),
        openingBalance: 0,
        openingBalanceType: 'Dr'
      };

      let response;
      if (editId) {
        response = await axios.put(`${LEDGER_API_URL}/${editId}`, payload);
      } else {
        response = await axios.post(LEDGER_API_URL, payload);
      }
      
      if (response.status === 200 || response.status === 201 || response.status === 204) {
        const msg = editId 
          ? `खाते क्र. ${assignedId} यशस्वीरित्या अद्ययावत (Updated) झाले!` 
          : `नवीन खाते क्र. ${assignedId} यशस्वीरित्या जतन (Saved) झाले!`;
        setSuccess(msg);
        setError('');
        await fetchLedgers();
        await fetchNextLedgerId();
        resetForm();
        if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = setTimeout(() => setSuccess(''), 5000);
      } else {
        setError("खाते माहिती जतन करताना त्रुटी आली.");
      }
    } catch (err: any) {
      console.error("Error saving ledger", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || err.response?.data || err.message || "खाते माहिती जतन करताना त्रुटी आली.";
      setError(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (ledger: Ledger) => {
    setEditId(ledger.ledgerID);
    setSuccess('');
    setError('');
    setFormData({
      ledgerID: ledger.ledgerID.toString(),
      ledgerName: ledger.ledgerName,
      ledgerNameEnglish: ledger.ledgerNameEnglish || '',
      groupID: ledger.groupID.toString(),
      reportType: ledger.reportType || 'ताळेबंद',
      accountType: ledger.accountType || 'GL',
      isActive: ledger.isActive
    });

    if (showListModal) {
      setShowListModal(false);
    }

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (ledgerNameInputRef.current) {
        ledgerNameInputRef.current.focus();
        ledgerNameInputRef.current.select();
      }
    }, 120);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(`तुम्हाला खात्री आहे का की खाते क्र. ${id} डिलीट करायचे आहे?`)) return;
    setSuccess('');
    setError('');
    try {
      const response = await axios.delete(`${LEDGER_API_URL}/${id}`);
      if (response.status === 200 || response.status === 204) {
        setSuccess(`खाते क्र. ${id} यशस्वीरित्या डिलीट करण्यात आले!`);
        resetForm();
        await fetchLedgers();
        await fetchGroups();
        if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = setTimeout(() => setSuccess(''), 4000);
      }
    } catch (err: any) {
      console.error("Error deleting ledger", err);
      const errMsg = err.response?.data?.message || err.response?.data?.detail || err.response?.data || err.message || "खाते डिलीट करताना त्रुटी आली.";
      if (typeof errMsg === 'string' && (errMsg.includes("FK_") || errMsg.includes("REFERENCE constraint") || errMsg.includes("DbUpdateException") || errMsg.includes("VoucherDetails"))) {
        setError("या खात्याशी संबंधित व्हाउचर्स किंवा इतर व्यवहारांच्या नोंदी जोडलेल्या असल्यामुळे हे खाते डिलीट करता येत नाही. तुम्ही हे खाते 'निष्क्रिय (Inactive)' करू शकता.");
      } else {
        setError(typeof errMsg === 'string' ? errMsg : "खाते डिलीट करता येत नाही.");
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Excel Export Handler
  const exportToExcel = () => {
    try {
      const exportData = ledgers.map((l, index) => {
        const grp = groups.find(g => g.groupID === l.groupID);
        return {
          'अनु. क्र.': index + 1,
          'खाते क्र. (Ledger ID)': l.ledgerID,
          'खात्याचे नाव (मराठी)': l.ledgerName,
          'खात्याचे नाव (इंग्रजी)': l.ledgerNameEnglish || '',
          'खाते गट (Group)': grp ? `${grp.displayOrder ? grp.displayOrder + ' - ' : ''}${grp.groupName}` : '',
          'गटाचा प्रकार (Nature)': grp?.natureOfGroup || '',
          'पत्रक (Report)': l.reportType || 'ताळेबंद',
          'खाते प्रकार (Account Type)': l.accountType || 'GL',
          'स्थिती (Status)': l.isActive ? 'सक्रिय (Active)' : 'निष्क्रिय (Inactive)'
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledgers');
      
      const fileName = `SmartBanking_Ledgers_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error("Error exporting to Excel", err);
      setError("एक्सेल फाईल डाउनलोड करताना त्रुटी आली.");
    }
  };

  // Filtered Flat Ledgers List (Clean & Direct)
  const filteredFlatLedgers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return ledgers.filter(l => {
      // Nature filter
      if (selectedNatureFilter === 'BalanceSheet' && l.reportType !== 'ताळेबंद' && l.reportType) return false;
      if (selectedNatureFilter === 'ProfitLoss' && l.reportType !== 'नफातोटा पत्रक') return false;
      if (selectedNatureFilter === 'CashBank') {
        const isCashBank = l.accountType === 'Cash In Hand' || 
          l.accountType === 'Bank Account' ||
          l.ledgerName.includes('रोख') ||
          l.ledgerName.includes('बँक') ||
          (l.ledgerNameEnglish && (l.ledgerNameEnglish.toLowerCase().includes('cash') || l.ledgerNameEnglish.toLowerCase().includes('bank')));
        if (!isCashBank) return false;
      }
      if (selectedNatureFilter === 'Active' && !l.isActive) return false;

      // Group dropdown filter
      if (selectedGroupFilter && l.groupID.toString() !== selectedGroupFilter) return false;

      // Search term
      if (term) {
        const grp = groupMap.get(l.groupID);
        const matchId = l.ledgerID.toString().includes(term);
        const matchName = l.ledgerName.toLowerCase().includes(term);
        const matchEng = l.ledgerNameEnglish ? l.ledgerNameEnglish.toLowerCase().includes(term) : false;
        const matchGrp = grp ? (grp.groupName.toLowerCase().includes(term) || (grp.groupNameEnglish && grp.groupNameEnglish.toLowerCase().includes(term))) : false;
        return matchId || matchName || matchEng || matchGrp;
      }
      return true;
    }).sort((a, b) => a.ledgerID - b.ledgerID);
  }, [ledgers, groupMap, searchTerm, selectedNatureFilter, selectedGroupFilter]);

  // Hierarchical Tree Display Builder (for Tree View mode only)
  interface DisplayItem {
    type: 'group' | 'ledger';
    id: string;
    depth: number;
    data: any;
  }

  const treeDisplayItems = useMemo((): DisplayItem[] => {
    if (viewMode !== 'tree') return [];
    const term = searchTerm.toLowerCase().trim();
    
    let filtered = ledgers;
    if (selectedNatureFilter === 'BalanceSheet') {
      filtered = ledgers.filter(l => l.reportType === 'ताळेबंद' || !l.reportType);
    } else if (selectedNatureFilter === 'ProfitLoss') {
      filtered = ledgers.filter(l => l.reportType === 'नफातोटा पत्रक');
    } else if (selectedNatureFilter === 'CashBank') {
      filtered = ledgers.filter(l => 
        l.accountType === 'Cash In Hand' || 
        l.accountType === 'Bank Account' ||
        l.ledgerName.includes('रोख') ||
        l.ledgerName.includes('बँक') ||
        (l.ledgerNameEnglish && (l.ledgerNameEnglish.toLowerCase().includes('cash') || l.ledgerNameEnglish.toLowerCase().includes('bank')))
      );
    } else if (selectedNatureFilter === 'Active') {
      filtered = ledgers.filter(l => l.isActive);
    }

    if (selectedGroupFilter) {
      filtered = filtered.filter(l => l.groupID.toString() === selectedGroupFilter);
    }

    const ledgerMatches = filtered.filter(l => 
      l.ledgerID.toString().includes(term) ||
      l.ledgerName.toLowerCase().includes(term) || 
      (l.ledgerNameEnglish && l.ledgerNameEnglish.toLowerCase().includes(term))
    );

    const groupMatches = groups.filter(g => 
      g.groupName.toLowerCase().includes(term) || 
      (g.groupNameEnglish && g.groupNameEnglish.toLowerCase().includes(term)) ||
      (g.groupCode && g.groupCode.toLowerCase().includes(term))
    );
    
    const groupsToKeep = new Set<number>();
    const keepGroupAndAncestors = (groupId: number | null | undefined) => {
      if (!groupId || groupsToKeep.has(groupId)) return;
      groupsToKeep.add(groupId);
      const group = groups.find(g => g.groupID === groupId);
      if (group && group.parentGroupID) {
        keepGroupAndAncestors(group.parentGroupID);
      }
    };
    
    ledgerMatches.forEach(l => keepGroupAndAncestors(l.groupID));
    groupMatches.forEach(g => keepGroupAndAncestors(g.groupID));
    
    if (!term && selectedNatureFilter === 'All' && !selectedGroupFilter) {
      groups.forEach(g => groupsToKeep.add(g.groupID));
    }
    
    const list: DisplayItem[] = [];
    const addedGroupIds = new Set<number>();
    
    const addGroupAndChildren = (parentId: number | null | undefined, depth: number) => {
      const childrenGroups = groups.filter(g => g.parentGroupID === parentId);
      childrenGroups.sort((a, b) => {
        const orderA = a.displayOrder ?? 0;
        const orderB = b.displayOrder ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        const codeA = a.groupCode || a.groupID.toString();
        const codeB = b.groupCode || b.groupID.toString();
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });

      childrenGroups.forEach(child => {
        if (!addedGroupIds.has(child.groupID) && groupsToKeep.has(child.groupID)) {
          addedGroupIds.add(child.groupID);
          list.push({ type: 'group', id: `g_${child.groupID}`, depth, data: child });
          
          const childLedgers = filtered.filter(l => l.groupID === child.groupID);
          childLedgers.forEach(l => {
             if (!term || ledgerMatches.some(ml => ml.ledgerID === l.ledgerID) || groupMatches.some(mg => mg.groupID === child.groupID)) {
                list.push({ type: 'ledger', id: `l_${l.ledgerID}`, depth: depth + 1, data: l });
             }
          });
          
          addGroupAndChildren(child.groupID, depth + 1);
        }
      });
    };
    
    const topLevelGroups = groups.filter(g => !g.parentGroupID);
    topLevelGroups.sort((a, b) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      const codeA = a.groupCode || a.groupID.toString();
      const codeB = b.groupCode || b.groupID.toString();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

    topLevelGroups.forEach(pg => {
      if (!addedGroupIds.has(pg.groupID) && groupsToKeep.has(pg.groupID)) {
        addedGroupIds.add(pg.groupID);
        list.push({ type: 'group', id: `g_${pg.groupID}`, depth: 0, data: pg });
        
        const childLedgers = filtered.filter(l => l.groupID === pg.groupID);
        childLedgers.forEach(l => {
           if (!term || ledgerMatches.some(ml => ml.ledgerID === l.ledgerID) || groupMatches.some(mg => mg.groupID === pg.groupID)) {
              list.push({ type: 'ledger', id: `l_${l.ledgerID}`, depth: 1, data: l });
           }
        });
        
        addGroupAndChildren(pg.groupID, 1);
      }
    });
    
    const orphanLedgers = filtered.filter(l => !groups.some(g => g.groupID === l.groupID));
    orphanLedgers.forEach(l => {
        if (!term || ledgerMatches.some(ml => ml.ledgerID === l.ledgerID)) {
           list.push({ type: 'ledger', id: `l_${l.ledgerID}`, depth: 0, data: l });
        }
    });
    
    return list;
  }, [ledgers, groups, searchTerm, selectedNatureFilter, selectedGroupFilter, viewMode]);

  const labelClass = "block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1";
  const inputClass = "w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all";

  return (
    <div className="p-2 sm:p-4 max-w-7xl mx-auto bg-slate-50/50 min-h-screen font-sans pb-10">
      
      {/* 🏛️ Top Header Bar (Matching SavingOpeningBalance.tsx) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 bg-white p-3 rounded-sm border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>खाते माहिती (Ledger Master) व खातावणी संरचना</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              Core Banking System • सामान्य खातेवही (General Ledger), बँक, रोख व नफा-तोटा खाती व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer border border-slate-300"
            title="नवीन नोंद फॉर्म सुरू करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchLedgers();
              fetchGroups();
              setShowListModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व खाती यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदवलेली खाती ({totalLedgersCount})</span>
          </button>
        </div>
      </div>

      {/* 📊 Summary KPI Metric Cards (Matching SavingOpeningBalance.tsx) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण खाती (Total Ledgers)</div>
            <div className="text-sm font-black text-gray-900">{totalLedgersCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">बँक व रोख खाती (Cash/Bank)</div>
            <div className="text-sm font-black text-emerald-800">{cashAndBankCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ताळेबंद खाती (Balance Sheet)</div>
            <div className="text-sm font-black text-indigo-950">{balanceSheetCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय खाती (Active Ledgers)</div>
            <div className="text-sm font-black text-amber-800">{activeLedgersCount}</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">✕</button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">✕</button>
        </div>
      )}

      {/* 📝 MAIN STRUCTURED CBS FORM (Matching SavingOpeningBalance.tsx Section Cards) */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 mb-3.5 ${
          editId ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Ledger Name & ID Control (१. खाते नामाभिधान व तपशील) */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">१. खाते नामाभिधान व तपशील (Ledger Name & Basic Details)</h2>
              </div>
              {editId && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  संपादन चालू (Editing Ledger ID: {editId})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>
                  खात्याचे नाव - मराठी (Ledger Name) <span className="text-red-500">*</span>
                </label>
                <input 
                  ref={ledgerNameInputRef}
                  type="text" 
                  name="ledgerName" 
                  value={formData.ledgerName || ''} 
                  onChange={handleChange} 
                  required 
                  placeholder="उदा. रोख शिल्लक (Cash In Hand)" 
                  className={`${inputClass} font-bold`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  खात्याचे नाव - इंग्रजी (English Name)
                </label>
                <input 
                  type="text" 
                  name="ledgerNameEnglish" 
                  value={formData.ledgerNameEnglish || ''} 
                  onChange={handleChange} 
                  placeholder="e.g. Cash in Hand" 
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  खाते क्र. / आयडी (Ledger No./ID) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  name="ledgerID" 
                  value={currentDisplayId || ''} 
                  onChange={handleChange} 
                  placeholder="खाते क्र." 
                  className={`${inputClass} font-mono font-bold text-primary`}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center space-x-2">
              <input 
                type="checkbox" 
                name="isActive" 
                checked={formData.isActive} 
                onChange={handleChange} 
                id="isActiveLedgerCheck" 
                className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer" 
              />
              <label htmlFor="isActiveLedgerCheck" className="text-xs font-bold text-gray-700 cursor-pointer">
                सक्रिय खाते (Is Active) — व्हाउचर्स व व्यवहारांसाठी उपलब्ध
              </label>
            </div>
          </div>

          {/* Section 2: Group & Classification Structure (२. खाते गट व वर्गीकरण संरचना) */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <FolderTree className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. खाते गट व वर्गीकरण संरचना (Group Classification & Report Type)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>
                  खाते गट (Account Group) <span className="text-red-500">*</span>
                </label>
                <select 
                  name="groupID" 
                  value={formData.groupID || ''} 
                  onChange={handleGroupChange} 
                  required
                  className={`${inputClass} font-semibold`}
                >
                  <option value="">-- खाते गट निवडा --</option>
                  {sortedGroups.map(g => (
                    <option key={g.groupID} value={g.groupID}>
                      {g.depth && g.depth > 0 ? '\u00A0\u00A0\u00A0\u00A0'.repeat(g.depth) + '└─ ' : ''}{g.displayOrder && g.displayOrder > 0 ? `${g.displayOrder} - ` : (g.groupCode ? `${g.groupCode} - ` : '')}{g.groupName} {g.groupNameEnglish ? `(${g.groupNameEnglish})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  पत्रक प्रकार (Report Type) <span className="text-red-500">*</span>
                </label>
                <select 
                  name="reportType" 
                  value={formData.reportType || 'ताळेबंद'} 
                  onChange={handleChange} 
                  required
                  className={inputClass}
                >
                  <option value="ताळेबंद">ताळेबंद (Balance Sheet)</option>
                  <option value="नफातोटा पत्रक">नफातोटा पत्रक (Profit & Loss)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  खाते प्रकार (Account Type) <span className="text-red-500">*</span>
                </label>
                <select 
                  name="accountType" 
                  value={formData.accountType || 'GL'} 
                  onChange={handleChange} 
                  required
                  className={inputClass}
                >
                  <option value="GL">General Ledger (GL)</option>
                  <option value="Cash In Hand">Cash In Hand (हातातील रोख)</option>
                  <option value="Bank Account">Bank Account (बँक खाते)</option>
                  <option value="Personal Account">Personal Account (वैयक्तिक)</option>
                  <option value="Investment Account">Investment Account (गुंतवणूक)</option>
                  <option value="Borrowing Account">Borrowing Account (कर्ज देणी)</option>
                  <option value="Loan Account">Loan Account (दिलेली कर्जे)</option>
                  <option value="Deposit">Deposit (ठेवी)</option>
                  <option value="Share Capital">Share Capital (शेअर भांडवल)</option>
                  <option value="Income">Income (उत्पन्न)</option>
                  <option value="Expenses">Expenses (खर्च)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form Action Buttons (Matching SavingOpeningBalance.tsx) */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer border border-slate-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>नवीन फॉर्म (Reset)</span>
            </button>

            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setFormData(prev => ({ ...prev, ledgerID: '' }));
                }}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="सध्याच्या माहितीवरून नवीन खाते तयार करा"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>नवीन म्हणून घ्या (As New)</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'जतन करत आहे...' : (editId ? 'बदल सेव्ह करा (Update)' : 'खाते सेव्ह करा (Save)')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 📋 REGISTERED LEDGERS DATA GRID & FILTER BAR */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
        
        {/* Table Filter & Action Header */}
        <div className="p-2.5 bg-slate-100/90 border-b border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
          
          {/* Nature Quick Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              फिल्टर:
            </span>
            {[
              { id: 'All', label: 'सर्व खाती', count: totalLedgersCount },
              { id: 'CashBank', label: 'बँक व रोख', count: cashAndBankCount },
              { id: 'BalanceSheet', label: 'ताळेबंद', count: balanceSheetCount },
              { id: 'ProfitLoss', label: 'नफातोटा', count: totalLedgersCount - balanceSheetCount },
              { id: 'Active', label: 'सक्रिय', count: activeLedgersCount },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedNatureFilter(tab.id)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedNatureFilter === tab.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedNatureFilter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search, Group Filter, View Toggle & Excel Export Button */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            
            {/* Quick Group Selector Dropdown */}
            <div className="w-48">
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="w-full text-xs py-1 px-2 border border-gray-300 rounded bg-white font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- सर्व खाते गट --</option>
                {sortedGroups.map(g => (
                  <option key={g.groupID} value={g.groupID}>
                    {g.depth && g.depth > 0 ? '\u00A0\u00A0'.repeat(g.depth) + '└─ ' : ''}{g.displayOrder ? `${g.displayOrder} - ` : ''}{g.groupName}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Bar */}
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="खाते शोधा..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Mode Toggle (Flat Simple Table vs Tree Hierarchy) */}
            <div className="flex items-center border border-gray-300 rounded overflow-hidden bg-white shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`px-2 py-1 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  viewMode === 'flat' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="साधा तक्ता (Clean Flat Table)"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>साधा तक्ता</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`px-2 py-1 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  viewMode === 'tree' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="ट्री व्ह्यू (Hierarchical Tree)"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>ट्री व्ह्यू</span>
              </button>
            </div>

            {/* Excel Export Button */}
            <button
              type="button"
              onClick={exportToExcel}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer shrink-0"
              title="सर्व खाती एक्सेल शीटमध्ये डाऊनलोड करा"
            >
              <Download className="w-3.5 h-3.5" />
              <span>एक्सेल</span>
            </button>
          </div>
        </div>

        {/* 📊 CLEAN FLAT TABLE VIEW (Default - Simple, Direct, No Clutter) */}
        {viewMode === 'flat' ? (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
              <thead className="bg-primary text-white sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="px-2.5 py-2 border-r border-blue-400 font-bold text-center w-20">खाते क्र. (ID)</th>
                  <th className="px-3 py-2 border-r border-blue-400 font-bold text-left">खात्याचे नाव (मराठी)</th>
                  <th className="px-3 py-2 border-r border-blue-400 font-bold text-left">इंग्रजी नाव (English)</th>
                  <th className="px-3 py-2 border-r border-blue-400 font-bold text-left">खाते गट (Account Group)</th>
                  <th className="px-2.5 py-2 border-r border-blue-400 font-bold text-center w-28">पत्रक (Report)</th>
                  <th className="px-2.5 py-2 border-r border-blue-400 font-bold text-center w-32">प्रकार (Type)</th>
                  <th className="px-2.5 py-2 border-r border-blue-400 font-bold text-center w-20">स्थिती</th>
                  <th className="px-2.5 py-2 font-bold text-center w-28">कृती (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredFlatLedgers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 font-medium">
                      कोणतीही खाती आढळली नाहीत.
                    </td>
                  </tr>
                ) : (
                  filteredFlatLedgers.map((ledger) => {
                    const grp = groupMap.get(ledger.groupID);
                    const isRowEditing = editId === ledger.ledgerID;
                    return (
                      <tr 
                        key={ledger.ledgerID} 
                        className={`hover:bg-blue-50/50 transition-colors ${
                          isRowEditing ? 'bg-amber-50/70 font-semibold' : ''
                        }`}
                      >
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-center font-mono font-bold text-primary bg-slate-50/50">
                          {ledger.ledgerID}
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-200 text-left font-bold text-gray-900">
                          {ledger.ledgerName}
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-200 text-left font-sans text-gray-600 text-[11px]">
                          {ledger.ledgerNameEnglish || '-'}
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-200 text-left">
                          {grp ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-medium">
                              <span className="font-mono font-bold text-primary">{grp.displayOrder ? `${grp.displayOrder} - ` : ''}</span>
                              <span>{grp.groupName}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                            ledger.reportType === 'नफातोटा पत्रक' 
                              ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}>
                            {ledger.reportType || 'ताळेबंद'}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-center font-mono text-[11px] text-gray-700">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-semibold">
                            {ledger.accountType || 'GL'}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-center">
                          <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full ${
                            ledger.isActive 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {ledger.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              type="button"
                              onClick={() => handleEdit(ledger)} 
                              className="p-1 px-2 text-primary hover:bg-primary/10 rounded border border-primary/20 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="खाते बदला (Edit)"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>बदला</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDelete(ledger.ledgerID)} 
                              className="p-1 px-2 text-rose-600 hover:bg-rose-50 rounded border border-rose-200 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="खाते डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* 🌳 TREE HIERARCHY VIEW (Optional Alternative) */
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
              <thead className="bg-primary text-white sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="px-2.5 py-2 border-r border-blue-400 font-bold text-center w-24">क्र. (ID)</th>
                  <th className="px-3 py-2 border-r border-blue-400 font-bold text-left">खात्याचे / गटाचे नाव</th>
                  <th className="px-3 py-2 border-r border-blue-400 font-bold text-left">इंग्रजी नाव</th>
                  <th className="px-2.5 py-2 border-r border-blue-400 font-bold text-center w-28">पत्रक</th>
                  <th className="px-2.5 py-2 border-r border-blue-400 font-bold text-center w-36">प्रकार</th>
                  <th className="px-2.5 py-2 border-r border-blue-400 font-bold text-center w-24">स्थिती</th>
                  <th className="px-2.5 py-2 font-bold text-center w-28">कृती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {treeDisplayItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 font-medium">
                      कोणतीही माहिती आढळली नाही.
                    </td>
                  </tr>
                ) : (
                  treeDisplayItems.map((item) => {
                    if (item.type === 'group') {
                      const group = item.data as AccountGroup;
                      return (
                        <tr key={item.id} className="bg-slate-100/90 border-t border-b border-slate-300 font-semibold">
                          <td className="px-2.5 py-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-600 bg-slate-200/60">
                            {group.groupCode || group.groupID}
                          </td>
                          <td className="px-3 py-1.5 border-r border-slate-200 text-left font-bold text-slate-800" colSpan={6}>
                            <div className="flex items-center gap-1.5">
                              {item.depth > 0 && (
                                <span className="text-slate-400 font-mono" style={{ marginLeft: `${item.depth * 1.25}rem` }}>
                                  └─
                                </span>
                              )}
                              <FolderTree className="w-3.5 h-3.5 text-primary" />
                              <span className="text-primary font-mono font-bold mr-1">
                                {group.displayOrder && group.displayOrder > 0 ? `${group.displayOrder} - ` : ''}
                              </span>
                              <span>{group.groupName}</span>
                              {group.groupNameEnglish && (
                                <span className="text-slate-500 font-normal text-[11px]">({group.groupNameEnglish})</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    } else {
                      const ledger = item.data as Ledger;
                      const isRowEditing = editId === ledger.ledgerID;
                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-blue-50/50 transition-colors ${
                            isRowEditing ? 'bg-amber-50/70 font-semibold' : ''
                          }`}
                        >
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center font-mono font-bold text-primary bg-slate-50/50">
                            {ledger.ledgerID}
                          </td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-left font-medium text-gray-900">
                            <div className="flex items-center gap-1.5">
                              {item.depth > 0 && (
                                <span className="text-slate-300 font-mono" style={{ marginLeft: `${item.depth * 1.25}rem` }}>
                                  └─
                                </span>
                              )}
                              <span className="font-bold text-gray-800">{ledger.ledgerName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-left font-sans text-gray-600 text-[11px]">
                            {ledger.ledgerNameEnglish || '-'}
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              {ledger.reportType || 'ताळेबंद'}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center font-mono text-[11px] text-gray-700">
                            {ledger.accountType || 'GL'}
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center">
                            <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full ${
                              ledger.isActive 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {ledger.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                type="button"
                                onClick={() => handleEdit(ledger)} 
                                className="p-1 px-2 text-primary hover:bg-primary/10 rounded border border-primary/20 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>बदला</span>
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleDelete(ledger.ledgerID)} 
                                className="p-1 px-2 text-rose-600 hover:bg-rose-50 rounded border border-rose-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>बाद</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 📋 POP-UP MODAL LIST (Matching SavingOpeningBalance.tsx) */}
      {showListModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5">
          <div className="bg-white rounded-sm shadow-2xl border border-gray-200 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-3 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                <h2 className="text-sm font-bold">नोंदवलेली सामान्य खाती यादी (Registered Ledgers List)</h2>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  एकूण: {totalLedgersCount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowListModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Controls */}
            <div className="p-3 bg-slate-100 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="relative flex-1 w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="खाते क्र., नाव किंवा इंग्रजी नावाने शोधा..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-7 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportToExcel}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>एक्सेल डाऊनलोड</span>
                </button>
              </div>
            </div>

            {/* Modal Table Content (Flat Clean Table) */}
            <div className="overflow-auto flex-1 p-3">
              <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                <thead className="bg-slate-200 text-gray-800 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="px-2.5 py-2 border-r border-gray-300 font-bold text-center w-20">खाते क्र.</th>
                    <th className="px-3 py-2 border-r border-gray-300 font-bold text-left">खात्याचे नाव (Marathi)</th>
                    <th className="px-3 py-2 border-r border-gray-300 font-bold text-left">इंग्रजी नाव (English)</th>
                    <th className="px-3 py-2 border-r border-gray-300 font-bold text-left">खाते गट (Group)</th>
                    <th className="px-2.5 py-2 border-r border-gray-300 font-bold text-center w-28">पत्रक</th>
                    <th className="px-2.5 py-2 border-r border-gray-300 font-bold text-center w-32">प्रकार</th>
                    <th className="px-2.5 py-2 border-r border-gray-300 font-bold text-center w-20">स्थिती</th>
                    <th className="px-2.5 py-2 font-bold text-center w-20">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredFlatLedgers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500 font-medium">
                        कोणतीही खाती आढळली नाहीत.
                      </td>
                    </tr>
                  ) : (
                    filteredFlatLedgers.map((ledger) => {
                      const grp = groupMap.get(ledger.groupID);
                      return (
                        <tr key={ledger.ledgerID} className="hover:bg-blue-50/50">
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center font-mono font-bold text-primary">
                            {ledger.ledgerID}
                          </td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-left font-bold text-gray-800">
                            {ledger.ledgerName}
                          </td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-left text-gray-600 text-[11px]">
                            {ledger.ledgerNameEnglish || '-'}
                          </td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-left">
                            {grp ? `${grp.displayOrder ? grp.displayOrder + ' - ' : ''}${grp.groupName}` : '-'}
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center text-[11px]">
                            {ledger.reportType || 'ताळेबंद'}
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center text-[11px]">
                            {ledger.accountType || 'GL'}
                          </td>
                          <td className="px-2.5 py-1.5 border-r border-gray-200 text-center">
                            <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${
                              ledger.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {ledger.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleEdit(ledger)}
                              className="px-2 py-0.5 bg-primary text-white rounded text-[11px] font-bold hover:opacity-90 cursor-pointer"
                            >
                              निवडा
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-100 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowListModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-bold cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
