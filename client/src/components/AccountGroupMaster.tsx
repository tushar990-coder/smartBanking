import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  FolderTree,
  PlusCircle,
  Edit2,
  Trash2,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Search,
  Layers,
  CheckCircle,
  XCircle,
  Plus,
  FileSpreadsheet,
  X,
  ArrowUp,
  ArrowDown,
  Building2,
  BookOpen
} from 'lucide-react';

interface AccountGroup {
  groupID: number;
  groupCode?: string;
  groupName: string;
  groupNameEnglish?: string;
  parentGroupID: number | null;
  parentGroup?: AccountGroup;
  natureOfGroup: string;
  isActive: boolean;
  displayOrder?: number;
  depth?: number;
}

export default function AccountGroupMaster() {
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [nextGroupCode, setNextGroupCode] = useState<string>('1');
  const [searchTerm, setSearchTerm] = useState('');
  const [natureFilter, setNatureFilter] = useState<string>('ALL');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSavingSequence, setIsSavingSequence] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  
  const formContainerRef = useRef<HTMLDivElement>(null);
  const groupNameInputRef = useRef<HTMLInputElement>(null);
  
  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

  const initialFormState = {
    groupID: '',
    groupCode: '',
    groupName: '',
    groupNameEnglish: '',
    parentGroupID: '',
    natureOfGroup: 'Assets',
    displayOrder: '0',
    isActive: true
  };

  const [formData, setFormData] = useState(initialFormState);

  const API_URL = '/api/AccountGroups';

  const calculateNextCodeClient = (parentGrpId?: string | number, currentGroups = groups): string => {
    if (!parentGrpId) {
      const primaryGroups = currentGroups.filter(g => !g.parentGroupID);
      let maxNum = 0;
      primaryGroups.forEach(g => {
        const c = g.groupCode || g.groupID.toString();
        const num = parseInt(c);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      });
      return (maxNum + 1).toString();
    } else {
      const pIdNum = parseInt(parentGrpId.toString());
      const parent = currentGroups.find(g => g.groupID === pIdNum);
      const parentCode = parent ? (parent.groupCode || parent.groupID.toString()) : parentGrpId.toString();
      const children = currentGroups.filter(g => g.parentGroupID === pIdNum);
      let maxChild = 0;
      const prefix = `${parentCode}.`;
      children.forEach(c => {
        const cCode = c.groupCode || '';
        if (cCode.startsWith(prefix)) {
          const suffix = cCode.substring(prefix.length).split('.')[0];
          const num = parseInt(suffix);
          if (!isNaN(num) && num > maxChild) maxChild = num;
        }
      });
      if (maxChild === 0 && children.length > 0) {
        maxChild = children.length;
      }
      return `${parentCode}.${maxChild + 1}`;
    }
  };

  const ensureGroupCodes = (list: AccountGroup[]): AccountGroup[] => {
    return list.map(g => ({
      ...g,
      groupCode: g.groupCode && g.groupCode.trim() !== '' ? g.groupCode.trim() : g.groupID.toString()
    }));
  };

  const getSortedGroups = (groupsList: AccountGroup[]) => {
    const listWithCodes = ensureGroupCodes(groupsList);
    const sorted: AccountGroup[] = [];
    const addedIds = new Set<number>();
    
    const addGroupAndChildren = (parentId: number | null, depth: number) => {
      const children = listWithCodes.filter(g => g.parentGroupID === parentId);
      children.sort((a, b) => {
        const orderA = a.displayOrder ?? 0;
        const orderB = b.displayOrder ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        const codeA = a.groupCode || a.groupID.toString();
        const codeB = b.groupCode || b.groupID.toString();
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });

      children.forEach(child => {
        if (!addedIds.has(child.groupID)) {
          child.depth = depth;
          sorted.push(child);
          addedIds.add(child.groupID);
          addGroupAndChildren(child.groupID, depth + 1);
        }
      });
    };
    
    addGroupAndChildren(null, 0);
    
    const remaining = listWithCodes.filter(g => !addedIds.has(g.groupID));
    sorted.push(...remaining);
    
    return sorted;
  };

  const sortedGroups = getSortedGroups(groups);

  const filteredGroups = sortedGroups.filter(g => {
    if (natureFilter !== 'ALL' && g.natureOfGroup !== natureFilter) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const nameMatch = (g.groupName || '').toLowerCase().includes(term);
    const engNameMatch = (g.groupNameEnglish || '').toLowerCase().includes(term);
    const natureMatch = (g.natureOfGroup || '').toLowerCase().includes(term);
    const codeMatch = (g.groupCode || '').toLowerCase().includes(term);
    const idMatch = g.groupID.toString().includes(term);
    const parentMatch = g.parentGroup?.groupName ? g.parentGroup.groupName.toLowerCase().includes(term) : false;
    return nameMatch || engNameMatch || natureMatch || codeMatch || idMatch || parentMatch;
  });

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const response = await axios.get(API_URL);
        if (response.data && isMounted) {
          const enriched = ensureGroupCodes(response.data);
          setGroups(enriched);
          const nextCode = calculateNextCodeClient('', enriched);
          if (isMounted) {
            setNextGroupCode(nextCode);
            setFormData(prev => ({ ...prev, groupCode: nextCode }));
          }
          try {
            const nextRes = await axios.get(`${API_URL}/NextCode`);
            if (nextRes.data && isMounted) {
              const serverCode = nextRes.data.nextGroupCode || nextRes.data.groupCode;
              if (serverCode) {
                setNextGroupCode(serverCode);
                setFormData(prev => ({ ...prev, groupCode: serverCode }));
              }
            }
          } catch (e) {
            // Ignore optional next code fetch failure
          }
        }
      } catch (error) {
        if (isMounted) console.error("Error initializing groups", error);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get(API_URL);
      if (response.data) {
        const enriched = ensureGroupCodes(response.data);
        setGroups(enriched);
        return enriched;
      }
    } catch (error) {
      console.error("Error fetching groups", error);
    }
    return [];
  };

  const fetchNextCode = async (parentGrpId?: string | number, currentGroups = groups) => {
    const clientCode = calculateNextCodeClient(parentGrpId, currentGroups);
    setNextGroupCode(clientCode);

    try {
      const pId = parentGrpId !== undefined && parentGrpId !== '' ? parentGrpId : '';
      const response = await axios.get(`${API_URL}/NextCode`, {
        params: { parentGroupId: pId || undefined }
      });
      if (response.data) {
        const serverCode = response.data.nextGroupCode || response.data.groupCode;
        if (serverCode) {
          setNextGroupCode(serverCode);
          return serverCode;
        }
      }
    } catch (error) {
      console.error("Error fetching next group code from server", error);
    }
    return clientCode;
  };

  const handleParentGroupChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedParentId = e.target.value;
    const newCode = calculateNextCodeClient(selectedParentId, sortedGroups);

    let autoNature = formData.natureOfGroup;
    if (selectedParentId) {
      const parentObj = sortedGroups.find(g => g.groupID.toString() === selectedParentId);
      if (parentObj && parentObj.natureOfGroup) {
        autoNature = parentObj.natureOfGroup;
      }
    }

    setFormData(prev => ({
      ...prev,
      parentGroupID: selectedParentId,
      groupCode: newCode,
      natureOfGroup: autoNature
    }));
    setNextGroupCode(newCode);

    fetchNextCode(selectedParentId, sortedGroups).then(serverCode => {
      if (serverCode && serverCode !== newCode) {
        setFormData(p => ({ ...p, groupCode: serverCode }));
        setNextGroupCode(serverCode);
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const resetForm = async () => {
    setEditId(null);
    setSuccess('');
    setError('');
    const c = await fetchNextCode('', groups);
    setFormData({
      ...initialFormState,
      groupCode: c
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    setLoading(true);
    try {
      const assignedCode = formData.groupCode.trim() || nextGroupCode;

      if (!editId) {
        const exists = groups.some(g => (g.groupCode || g.groupID.toString()) === assignedCode);
        if (exists) {
          setError(`गट कोड / आयडी '${assignedCode}' आधीच अस्तित्वात आहे. कृपया वेगळा गट कोड द्या.`);
          setLoading(false);
          return;
        }
      }

      const payload = {
        ...formData,
        groupID: editId ? editId : 0,
        groupCode: assignedCode,
        parentGroupID: formData.parentGroupID ? parseInt(formData.parentGroupID) : null
      };

      let response;
      if (editId) {
        response = await axios.put(`${API_URL}/${editId}`, payload);
      } else {
        response = await axios.post(API_URL, payload);
      }
      
      if (response.status === 200 || response.status === 201 || response.status === 204) {
        setSuccess(editId ? "खाते गट माहिती यशस्वीरित्या अद्ययावत झाली!" : "नवीन खाते गट यशस्वीरित्या जतन झाला!");
        const enriched = await fetchGroups();
        const nextCode = await fetchNextCode('', enriched);
        setFormData({ ...initialFormState, groupCode: nextCode });
        setEditId(null);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError("खाते गट जतन करताना त्रुटी आली.");
      }
    } catch (error: any) {
      console.error("Error saving group", error);
      const errMsg = error.response?.data?.message || error.response?.data || error.message || "खाते गट जतन करताना त्रुटी आली.";
      setError(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("तुम्हाला खात्री आहे का की हा खाते गट डिलीट करायचा आहे?")) return;
    setSuccess('');
    setError('');
    try {
      const response = await axios.delete(`${API_URL}/${id}`);
      if (response.status === 200 || response.status === 204) {
        const enriched = await fetchGroups();
        const nextCode = await fetchNextCode('', enriched);
        setFormData({ ...initialFormState, groupCode: nextCode });
        setEditId(null);
        setSuccess("खाते गट यशस्वीरित्या डिलीट झाला!");
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (error: any) {
      console.error("Error deleting group", error);
      const errMsg = error.response?.data?.message || error.response?.data || error.message || "खाते गट डिलीट करता येत नाही.";
      if (typeof errMsg === 'string' && (errMsg.includes("FK_") || errMsg.includes("REFERENCE constraint") || errMsg.includes("DbUpdateException"))) {
        setError("या खाते गटाच्या अंतर्गत खाती (Ledgers) किंवा उप-गट (Sub-groups) जोडलेले असल्यामुळे हा गट डिलीट करता येत नाही. प्रथम संबंधित खाती किंवा उप-गट हटवा.");
      } else {
        setError(typeof errMsg === 'string' ? errMsg : "हा खाते गट डिलीट करता येत नाही.");
      }
    }
  };

  const handleEdit = (group: AccountGroup) => {
    setEditId(group.groupID);
    setSuccess('');
    setError('');
    setShowListModal(false);
    setFormData({
      groupID: group.groupID.toString(),
      groupCode: group.groupCode || group.groupID.toString(),
      groupName: group.groupName || '',
      groupNameEnglish: group.groupNameEnglish || '',
      parentGroupID: group.parentGroupID ? group.parentGroupID.toString() : '',
      natureOfGroup: group.natureOfGroup || 'Assets',
      displayOrder: (group.displayOrder ?? 0).toString(),
      isActive: group.isActive !== false
    });
    
    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (groupNameInputRef.current) {
        groupNameInputRef.current.focus();
        groupNameInputRef.current.select();
      }
    }, 120);
  };

  const handleInlineOrderChange = (groupId: number, newOrder: number) => {
    setGroups(prev => prev.map(g => g.groupID === groupId ? { ...g, displayOrder: newOrder } : g));
  };

  const handleMoveUp = (groupId: number) => {
    const idx = sortedGroups.findIndex(g => g.groupID === groupId);
    if (idx <= 0) return;
    const current = sortedGroups[idx];
    const prev = sortedGroups[idx - 1];
    if (current.parentGroupID !== prev.parentGroupID) return;

    const currentOrder = current.displayOrder ?? idx;
    const prevOrder = prev.displayOrder ?? (idx - 1);
    const newOrderForCurrent = prevOrder > 0 ? prevOrder - 1 : 0;

    setGroups(all => all.map(g => {
      if (g.groupID === current.groupID) return { ...g, displayOrder: newOrderForCurrent };
      if (g.groupID === prev.groupID) return { ...g, displayOrder: currentOrder };
      return g;
    }));
  };

  const handleMoveDown = (groupId: number) => {
    const idx = sortedGroups.findIndex(g => g.groupID === groupId);
    if (idx < 0 || idx >= sortedGroups.length - 1) return;
    const current = sortedGroups[idx];
    const next = sortedGroups[idx + 1];
    if (current.parentGroupID !== next.parentGroupID) return;

    const currentOrder = current.displayOrder ?? idx;
    const nextOrder = next.displayOrder ?? (idx + 1);

    setGroups(all => all.map(g => {
      if (g.groupID === current.groupID) return { ...g, displayOrder: nextOrder + 1 };
      if (g.groupID === next.groupID) return { ...g, displayOrder: currentOrder };
      return g;
    }));
  };

  const handleSaveSequence = async () => {
    setIsSavingSequence(true);
    setSuccess('');
    setError('');
    try {
      const payload = groups.map((g, index) => ({
        groupID: g.groupID,
        displayOrder: g.displayOrder !== undefined ? g.displayOrder : index
      }));

      const res = await axios.post(`${API_URL}/UpdateSequence`, payload);
      if (res.status === 200) {
        setSuccess("ताळेबंद व नफा-तोटा खात्यातील ग्रुप क्रम यशस्वीरित्या सेव्ह झाला!");
        await fetchGroups();
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err: any) {
      console.error("Error saving sequence", err);
      setError("ग्रुप क्रम सेव्ह करताना त्रुटी आली: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSavingSequence(false);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredGroups.map((g, index) => ({
      'अ.क्र': index + 1,
      'ताळेबंद क्रम (Order)': g.displayOrder ?? index + 1,
      'गट आयडी (Group ID)': g.groupCode || g.groupID,
      'गटाचे नाव (मराठी)': g.groupName,
      'गटाचे नाव (इंग्रजी)': g.groupNameEnglish || '',
      'मुख्य गट (Parent Group)': g.parentGroup?.groupName || 'प्राथमिक गट',
      'प्रकार (Nature)': g.natureOfGroup,
      'स्थिती (Status)': g.isActive ? 'सक्रिय (Active)' : 'निष्क्रिय (Inactive)'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AccountGroups');
    XLSX.writeFile(wb, `Account_Groups_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const isPrimaryMode = !formData.parentGroupID;
  const currentDisplayCode = formData.groupCode || nextGroupCode;
  const primaryGroupsCount = groups.filter(g => !g.parentGroupID).length;
  const subGroupsCount = groups.filter(g => g.parentGroupID).length;
  const activeGroupsCount = groups.filter(g => g.isActive !== false).length;

  const getNatureBadge = (nature: string) => {
    switch (nature) {
      case 'Assets':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">मालमत्ता (Assets)</span>;
      case 'Liabilities':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold">देणी (Liabilities)</span>;
      case 'Income':
        return <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-bold">उत्पन्न (Income)</span>;
      case 'Expenses':
        return <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">खर्च (Expenses)</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">{nature}</span>;
    }
  };

  return (
    <div className="p-2 max-w-7xl mx-auto bg-slate-50/50 min-h-screen font-sans pb-8">
      
      {/* 🌟 TOP SLEEK CBS HEADER BANNER (Matching SavingOpeningBalance.tsx) */}
      <div className="bg-white p-3 rounded-sm border border-slate-200 shadow-xs mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <FolderTree className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              खाते गट (Account Group) माहिती व संरचना
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              Core Banking System • ताळेबंद व नफा-तोटा खात्यांचे वर्गीकरण आणि क्रम नियंत्रण
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
              fetchGroups();
              setShowListModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व खाते गट यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदवलेले खाते गट ({groups.length})</span>
          </button>
        </div>
      </div>

      {/* 📊 Summary KPI Metric Cards (Matching SavingOpeningBalance.tsx) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण खाते गट (Total)</div>
            <div className="text-sm font-black text-gray-900">{groups.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <FolderTree className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">मुख्य गट (Primary)</div>
            <div className="text-sm font-black text-emerald-800">{primaryGroupsCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">उप-गट (Sub-Groups)</div>
            <div className="text-sm font-black text-indigo-950">{subGroupsCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय गट (Active)</div>
            <div className="text-sm font-black text-amber-800">{activeGroupsCount}</div>
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
          
          {/* Section 1: Group Names & Display Sequence */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">१. खाते गट नामाभिधान व क्रम नियंत्रण (Names & Display Order)</h2>
              </div>
              {editId && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  संपादन चालू (Editing Group ID: {editId})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>
                  गटाचे नाव - मराठी (Group Name) <span className="text-red-500">*</span>
                </label>
                <input 
                  ref={groupNameInputRef}
                  type="text" 
                  name="groupName" 
                  value={formData.groupName || ''} 
                  onChange={handleChange} 
                  required 
                  placeholder="उदा. कर्ज" 
                  className={`${inputClass} font-bold`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  गटाचे नाव - इंग्रजी (English Name)
                </label>
                <input 
                  type="text" 
                  name="groupNameEnglish" 
                  value={formData.groupNameEnglish || ''} 
                  onChange={handleChange} 
                  placeholder="e.g. Loans & Advances" 
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  ताळेबंद क्रम (Display Order)
                </label>
                <input 
                  type="number" 
                  name="displayOrder" 
                  value={formData.displayOrder ?? '0'} 
                  onChange={handleChange} 
                  min="0" 
                  placeholder="0"
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
                id="isActiveGrpCheck" 
                className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer" 
              />
              <label htmlFor="isActiveGrpCheck" className="text-xs font-bold text-gray-700 cursor-pointer">
                सक्रिय गट (Is Active) — नवीन खाती उघडण्यासाठी उपलब्ध
              </label>
            </div>
          </div>

          {/* Section 2: Primary Group & Classification */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. गट वर्गीकरण व मुख्य स्तर (Classification & Parent Group)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>
                  गटाचा प्रकार (Nature of Group) <span className="text-red-500">*</span>
                </label>
                <select 
                  name="natureOfGroup" 
                  value={formData.natureOfGroup || 'Assets'} 
                  onChange={handleChange}
                  className={`${inputClass} font-semibold`}
                >
                  <option value="Assets">मालमत्ता (Assets)</option>
                  <option value="Liabilities">देणी (Liabilities)</option>
                  <option value="Income">उत्पन्न (Income)</option>
                  <option value="Expenses">खर्च (Expenses)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  मुख्य गट (Parent Group)
                </label>
                <select 
                  name="parentGroupID" 
                  value={formData.parentGroupID || ''} 
                  onChange={handleParentGroupChange}
                  className={inputClass}
                >
                  <option value="">-- कोणताही नाही (प्राथमिक मुख्य गट) --</option>
                  {sortedGroups.map(g => (
                    <option key={g.groupID} value={g.groupID}>
                      {g.depth && g.depth > 0 ? '\u00A0\u00A0\u00A0\u00A0'.repeat(g.depth) + '└─ ' : ''}{g.displayOrder && g.displayOrder > 0 ? `${g.displayOrder} - ` : (g.groupCode ? `${g.groupCode} - ` : '')}{g.groupName} {g.groupNameEnglish ? `(${g.groupNameEnglish})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  {isPrimaryMode ? 'मुख्य गट आयडी (Group ID) ' : 'उप-गट आयडी (Sub-Group ID) '} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  name="groupCode" 
                  value={currentDisplayCode || ''} 
                  onChange={handleChange} 
                  placeholder={isPrimaryMode ? "उदा. 1" : "उदा. 1.1"} 
                  className={`${inputClass} font-mono font-bold text-primary`}
                  required
                />
              </div>
            </div>
          </div>

          {/* Form Action Buttons (Matching SavingOpeningBalance.tsx) */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>{editId ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
            </button>

            {editId && (
              <button 
                type="button" 
                onClick={async () => { setEditId(null); const c = await fetchNextCode(formData.parentGroupID, groups); setFormData(p => ({ ...p, groupID: '', groupCode: c })); }} 
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>नवीन म्हणून घ्या (As New)</span>
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 ${
                editId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'जतन होत आहे...' : editId ? 'बदल सेव्ह करा (Update)' : 'खाते गट सेव्ह करा (Save Group)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* 📋 EMBEDDED REGISTERED ACCOUNT GROUPS TABLE CARD */}
      <div className="bg-white rounded-sm border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Filter & Search Controls */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mr-2">
              <Layers className="w-4 h-4 text-primary" />
              <span>नोंदवलेले खाते गट</span>
              <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-sm font-mono">
                {filteredGroups.length} / {groups.length}
              </span>
            </h2>

            {/* Nature Filter Pills */}
            <div className="inline-flex rounded-sm bg-slate-200/70 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setNatureFilter('ALL')}
                className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer ${
                  natureFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                सर्व (All)
              </button>
              <button
                type="button"
                onClick={() => setNatureFilter('Assets')}
                className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer ${
                  natureFilter === 'Assets' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                मालमत्ता
              </button>
              <button
                type="button"
                onClick={() => setNatureFilter('Liabilities')}
                className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer ${
                  natureFilter === 'Liabilities' ? 'bg-white text-blue-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                देणी
              </button>
              <button
                type="button"
                onClick={() => setNatureFilter('Income')}
                className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer ${
                  natureFilter === 'Income' ? 'bg-white text-indigo-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                उत्पन्न
              </button>
              <button
                type="button"
                onClick={() => setNatureFilter('Expenses')}
                className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer ${
                  natureFilter === 'Expenses' ? 'bg-white text-rose-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                खर्च
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button 
              type="button" 
              onClick={handleSaveSequence}
              disabled={isSavingSequence}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-sm text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingSequence ? 'सेव्ह होत आहे...' : 'ताळेबंद क्रम सेव्ह करा'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredGroups.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={13} />
              <span>एक्सेल</span>
            </button>

            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="गट शोधा..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 border border-slate-300 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xs bg-white"
              />
            </div>
          </div>
        </div>

        {/* Spreadsheet Data Grid */}
        <div className="overflow-x-auto max-h-[550px] scrollbar-thin">
          <table className="min-w-full divide-y divide-slate-200 text-xs text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 select-none">
              <tr>
                <th className="px-2 py-2 border-r border-slate-200 font-bold text-center w-24">ताळेबंद क्रम</th>
                <th className="px-2 py-2 border-r border-slate-200 font-bold text-center w-24">गट आयडी</th>
                <th className="px-3 py-2 border-r border-slate-200 font-bold text-left">गटाचे नाव - मराठी</th>
                <th className="px-3 py-2 border-r border-slate-200 font-bold text-left">गटाचे नाव - इंग्रजी</th>
                <th className="px-3 py-2 border-r border-slate-200 font-bold text-left">मुख्य गट (Parent)</th>
                <th className="px-3 py-2 border-r border-slate-200 font-bold text-center w-28">प्रकार (Nature)</th>
                <th className="px-2 py-2 border-r border-slate-200 font-bold text-center w-24">स्टेटस</th>
                <th className="px-2 py-2 font-bold text-center w-20">कृती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-medium">
                    कोणतेही खाते गट आढळले नाहीत.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((group) => (
                  <tr 
                    key={group.groupID} 
                    className={`hover:bg-primary/5 transition-colors ${
                      editId === group.groupID ? 'bg-amber-50/50 font-semibold' : ''
                    }`}
                  >
                    {/* Display Order with Controls */}
                    <td className="px-1.5 py-1 border-r border-slate-100 text-center font-mono font-bold bg-slate-50/40">
                      <div className="flex items-center justify-center space-x-1">
                        <input 
                          type="number" 
                          className="w-12 border border-slate-300 text-center text-xs py-0.5 rounded-sm font-bold bg-white font-mono focus:border-primary focus:outline-none"
                          value={group.displayOrder ?? 0}
                          onChange={(e) => handleInlineOrderChange(group.groupID, parseInt(e.target.value) || 0)}
                        />
                        <div className="flex flex-col">
                          <button 
                            type="button" 
                            title="वर घ्या" 
                            onClick={() => handleMoveUp(group.groupID)} 
                            className="text-[10px] text-slate-500 hover:text-primary px-0.5 leading-none cursor-pointer"
                          >
                            ▲
                          </button>
                          <button 
                            type="button" 
                            title="खाली घ्या" 
                            onClick={() => handleMoveDown(group.groupID)} 
                            className="text-[10px] text-slate-500 hover:text-primary px-0.5 leading-none cursor-pointer"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Group ID / Code */}
                    <td className="px-2 py-1 border-r border-slate-100 text-center font-mono font-bold text-slate-800 bg-slate-50/20">
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px]">
                        {group.groupCode || group.groupID}
                      </span>
                    </td>

                    {/* Marathi Name with Hierarchy Tree Indentation */}
                    <td className="px-3 py-1.5 border-r border-slate-100 text-left font-bold text-slate-900">
                      {group.depth && group.depth > 0 ? (
                        <span className="text-slate-400 font-mono select-none" style={{ marginLeft: `${group.depth * 1}rem` }}>
                          └─{' '}
                        </span>
                      ) : null}
                      <span className={group.depth && group.depth > 0 ? 'text-slate-800 font-medium' : 'text-primary font-black'}>
                        {group.groupName}
                      </span>
                    </td>

                    {/* English Name */}
                    <td className="px-3 py-1.5 border-r border-slate-100 text-left text-slate-600 font-medium">
                      {group.groupNameEnglish || '-'}
                    </td>

                    {/* Parent Group */}
                    <td className="px-3 py-1.5 border-r border-slate-100 text-left text-slate-700 text-[11px]">
                      {group.parentGroup?.groupName ? (
                        <span className="flex items-center gap-1">
                          <span className="font-mono font-bold text-primary bg-primary/5 px-1 py-0.2 rounded border border-primary/10">
                            {group.parentGroup.displayOrder && group.parentGroup.displayOrder > 0 ? `${group.parentGroup.displayOrder}` : (group.parentGroup.groupCode || '')}
                          </span>
                          <span className="font-semibold">{group.parentGroup.groupName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">— प्राथमिक गट —</span>
                      )}
                    </td>

                    {/* Nature Badge */}
                    <td className="px-2 py-1.5 border-r border-slate-100 text-center">
                      {getNatureBadge(group.natureOfGroup)}
                    </td>

                    {/* Status Pill */}
                    <td className="px-2 py-1.5 border-r border-slate-100 text-center">
                      <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full border ${
                        group.isActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {group.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          type="button"
                          onClick={() => handleEdit(group)} 
                          title="बदला (Edit)"
                          className="p-1 text-primary hover:bg-primary/10 rounded-sm transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDelete(group.groupID)} 
                          title="डिलीट करा (Delete)"
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded-sm transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: REGISTERED ACCOUNT GROUPS LIST (Matching SavingOpeningBalance)*/}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेले खाते गट यादी (Registered Account Groups List)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredGroups.length} गट
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowListModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors cursor-pointer"
                title="बंद करा (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Toolbar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input 
                  type="text" 
                  placeholder="गट क्र, नाव किंवा मुख्य गट शोधा..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-6 py-1 border border-gray-300 rounded-sm text-xs h-[30px] w-64 lg:w-80 focus:outline-none focus:border-primary bg-white shadow-2xs"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={filteredGroups.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="एक्सेल फाइल डाउनलोड करा"
              >
                <FileSpreadsheet size={13} />
                <span>एक्सेल एक्सपोर्ट</span>
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-24">कृती</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-24">गट आयडी</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">गटाचे नाव - मराठी</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">गटाचे नाव - इंग्रजी</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">मुख्य गट (Parent)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">प्रकार (Nature)</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredGroups.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500 font-medium">
                          कोणतेही खाते गट आढळले नाहीत.
                        </td>
                      </tr>
                    ) : (
                      filteredGroups.map((group) => (
                        <tr key={group.groupID} className="hover:bg-slate-50 transition-colors">
                          <td className="px-2 py-1 border-r border-gray-200 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEdit(group)}
                                className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xs text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Edit2 size={10} />
                                <span>बदला</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(group.groupID)}
                                className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xs text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-200 text-center font-mono font-bold text-gray-900 bg-slate-50/50">
                            {group.groupCode || group.groupID}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-200 text-left font-bold text-gray-900">
                            {group.depth && group.depth > 0 ? (
                              <span className="text-gray-400 font-mono select-none" style={{ marginLeft: `${group.depth * 1}rem` }}>
                                └─{' '}
                              </span>
                            ) : null}
                            <span>{group.groupName}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-gray-200 text-left text-gray-600 font-medium">
                            {group.groupNameEnglish || '-'}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-200 text-left text-gray-700">
                            {group.parentGroup?.groupName || '-'}
                          </td>
                          <td className="px-2 py-1 border-r border-gray-200 text-center">
                            {getNatureBadge(group.natureOfGroup)}
                          </td>
                          <td className="px-2 py-1 text-center">
                            <span className={`px-1.5 py-0.5 inline-flex text-[10px] font-semibold rounded-sm border ${
                              group.isActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              {group.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500 font-medium shrink-0">
              <div>
                एकूण दर्शवलेले गट: <span className="font-bold text-gray-800">{filteredGroups.length}</span> / {groups.length}
              </div>
              <button
                type="button"
                onClick={() => setShowListModal(false)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-sm text-xs cursor-pointer transition-colors"
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
