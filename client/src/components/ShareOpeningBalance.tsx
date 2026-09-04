import React, { useState, useEffect, useRef } from 'react';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';
import { 
  PlusCircle, 
  List, 
  Search, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Save, 
  CheckCircle, 
  Coins, 
  Users, 
  Award,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
  X,
  Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Member extends MemberOption {}

interface ShareScheme {
  shareSchemeId: number;
  schemeCode: string;
  schemeName: string;
  memberType: string;
  shareFaceValue: number;
  minSharesCount: number;
  maxSharesCount: number;
  dividendRate: number;
  isActive: boolean;
  shareCapitalLedgerID?: number | null;
  shareCapitalLedger?: { ledgerID: number; ledgerName: string } | null;
  dividendPayableLedgerID?: number | null;
  dividendPayableLedger?: { ledgerID: number; ledgerName: string } | null;
}

interface ShareOpeningBalance {
  shareAccountId: number;
  certificateId?: number;
  memberId: number;
  accountNo?: string;
  memberNo?: string;
  legacyMemberNo?: string;
  memberName: string;
  cifNo: string;
  openingDate: string;
  shareQuantity: number;
  faceValue: number;
  shareAmount: number;
  dividendPayable: number;
  certificateNo: string | null;
  fromShareNo?: number;
  toShareNo?: number;
}

const ShareOpeningBalance: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [schemes, setSchemes] = useState<ShareScheme[]>([]);
  const [balances, setBalances] = useState<ShareOpeningBalance[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  
  const [showListModal, setShowListModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isEditMode, setIsEditMode] = useState(false);
  const [editAccountId, setEditAccountId] = useState<number | null>(null);
  const [editCertificateId, setEditCertificateId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    shareSchemeId: '',
    memberId: '',
    legacyMemberNo: '',
    openingDate: new Date().getFullYear() + '-03-31',
    shareQuantity: '',
    faceValue: '100',
    dividendPayable: '',
    dividendPayableLedgerId: '',
    fromShareNo: '',
    toShareNo: '',
    certificateNo: '',
    ledgerId: ''
  });

  const [nextMemberCode, setNextMemberCode] = useState('MEM0001');
  const [nextShareConfig, setNextShareConfig] = useState<{
    nextCertificateNo: string;
    nextFromShareNo: number;
    nextMemberCode?: string;
  }>({ nextCertificateNo: '', nextFromShareNo: 1 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  // Next Member ID (Last Member ID + 1)
  const nextMemberId = React.useMemo(() => {
    if (!members || !Array.isArray(members) || members.length === 0) return 1;
    const maxId = Math.max(...members.map(m => (m?.memberID || (m as any)?.customerID || 0)));
    return maxId > 0 ? maxId + 1 : 1;
  }, [members]);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetchMembers();
    fetchSchemes();
    fetchBalances();
    fetchLedgers();
    fetchNextMemberCode();
    fetchNextShareConfig();
  }, []);

  const fetchSchemes = async () => {
    try {
      const res = await fetch('/api/ShareSchemes', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const safeList: ShareScheme[] = Array.isArray(data) ? data : (data?.value || []);
        setSchemes(safeList);

        if (safeList.length > 0 && !isEditMode) {
          const activeScheme = safeList.find(s => s?.isActive) || safeList[0];
          if (activeScheme) {
            setFormData(prev => ({
              ...prev,
              shareSchemeId: prev.shareSchemeId || String(activeScheme.shareSchemeId ?? ''),
              faceValue: prev.faceValue || String(activeScheme.shareFaceValue || 100),
              ledgerId: prev.ledgerId || (activeScheme.shareCapitalLedgerID ? String(activeScheme.shareCapitalLedgerID) : ''),
              dividendPayableLedgerId: prev.dividendPayableLedgerId || (activeScheme.dividendPayableLedgerID ? String(activeScheme.dividendPayableLedgerID) : '')
            }));
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch share schemes', e);
    }
  };

  const handleSchemeSelect = (schemeIdStr: string) => {
    const selectedScheme = Array.isArray(schemes) ? schemes.find(s => s && String(s.shareSchemeId ?? '') === schemeIdStr) : undefined;
    if (selectedScheme) {
      setFormData(prev => ({
        ...prev,
        shareSchemeId: schemeIdStr,
        faceValue: String(selectedScheme.shareFaceValue || 100),
        ledgerId: selectedScheme.shareCapitalLedgerID ? String(selectedScheme.shareCapitalLedgerID) : prev.ledgerId,
        dividendPayableLedgerId: selectedScheme.dividendPayableLedgerID ? String(selectedScheme.dividendPayableLedgerID) : prev.dividendPayableLedgerId
      }));
    } else {
      setFormData(prev => ({ ...prev, shareSchemeId: schemeIdStr }));
    }
  };

  const fetchNextShareConfig = async () => {
    try {
      const res = await fetch('/api/ShareAccounts/NextShareConfig', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setNextShareConfig(data);
        if (data.nextMemberCode) {
          setNextMemberCode(data.nextMemberCode);
        }
        setFormData(prev => ({
          ...prev,
          fromShareNo: prev.fromShareNo || (data.nextFromShareNo ? data.nextFromShareNo.toString() : '1'),
          certificateNo: prev.certificateNo || (data.nextCertificateNo || '')
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNextMemberCode = async () => {
    try {
      const res = await fetch('/api/Members/next-code', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const code = await res.text();
        setNextMemberCode(code);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLedgers = async () => {
    try {
      const res = await fetch('/api/Ledgers', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLedgers(data);
      }
    } catch (error) {
      console.error('Failed to fetch ledgers', error);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/Customers', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const safeList = Array.isArray(data) ? data : (data?.value || []);
        setMembers(safeList);
      }
    } catch (error) {
      console.error('Failed to fetch customers', error);
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await fetch('/api/ShareAccounts/OpeningBalance', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const safeList = Array.isArray(data) ? data : (data?.value || []);
        setBalances(safeList);
      }
    } catch (error) {
      console.error('Failed to fetch balances', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string, value: string | number } }) => {
    const name = e.target.name || '';
    const value = String(e.target.value ?? '');

    if (name === 'memberId') {
      const sel = Array.isArray(members) ? members.find(m => m && String(m.memberID ?? (m as any).customerID ?? '') === value) : undefined;
      const existingBal = Array.isArray(balances) ? balances.find(b => b && String(b.memberId ?? (b as any).customerID ?? '') === value) : undefined;
      if (existingBal && !isEditMode) {
        handleStartEdit(existingBal);
        return;
      }
      setFormData(prev => ({ 
        ...prev, 
        memberId: value,
        legacyMemberNo: sel?.legacyMemberNo || (sel as any)?.legacyCustomerNo || '' 
      }));
    } else if (name === 'shareQuantity') {
      const qty = parseInt(value, 10);
      const safeQty = !isNaN(qty) && qty > 0 ? qty : 0;
      const currentFrom = parseInt(formData.fromShareNo, 10) || nextShareConfig.nextFromShareNo || 1;
      const calculatedTo = safeQty > 0 ? (currentFrom + safeQty - 1) : '';
      setFormData(prev => ({
        ...prev,
        shareQuantity: value,
        fromShareNo: prev.fromShareNo || currentFrom.toString(),
        toShareNo: calculatedTo ? calculatedTo.toString() : ''
      }));
    } else if (name === 'fromShareNo') {
      const fromNum = parseInt(value, 10);
      const safeFrom = !isNaN(fromNum) && fromNum > 0 ? fromNum : 0;
      const qty = parseInt(formData.shareQuantity, 10) || 0;
      const calculatedTo = (safeFrom > 0 && qty > 0) ? (safeFrom + qty - 1) : '';
      setFormData(prev => ({
        ...prev,
        fromShareNo: value,
        toShareNo: calculatedTo ? calculatedTo.toString() : prev.toShareNo
      }));
    } else if (name === 'toShareNo') {
      const toNum = parseInt(value, 10);
      const safeTo = !isNaN(toNum) && toNum > 0 ? toNum : 0;
      const currentFrom = parseInt(formData.fromShareNo, 10) || nextShareConfig.nextFromShareNo || 1;
      if (safeTo >= currentFrom && currentFrom > 0) {
        const calcQty = safeTo - currentFrom + 1;
        setFormData(prev => ({
          ...prev,
          toShareNo: value,
          fromShareNo: prev.fromShareNo || currentFrom.toString(),
          shareQuantity: calcQty.toString()
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          toShareNo: value
        }));
      }
    } else if (name === 'totalAmountInput') {
      const amt = parseFloat(value) || 0;
      const fv = parseFloat(formData.faceValue) || 100;
      const safeFv = fv > 0 ? fv : 100;
      const calculatedQty = amt > 0 ? Math.floor(amt / safeFv) : 0;
      const currentFrom = parseInt(formData.fromShareNo, 10) || nextShareConfig.nextFromShareNo || 1;
      const calculatedTo = calculatedQty > 0 ? (currentFrom + calculatedQty - 1) : '';
      setFormData(prev => ({
        ...prev,
        shareQuantity: calculatedQty > 0 ? calculatedQty.toString() : '',
        fromShareNo: prev.fromShareNo || currentFrom.toString(),
        toShareNo: calculatedTo ? calculatedTo.toString() : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setEditAccountId(null);
    setEditCertificateId(null);
    setFormData(prev => ({
      shareSchemeId: prev.shareSchemeId,
      memberId: '',
      legacyMemberNo: '',
      openingDate: prev.openingDate,
      shareQuantity: '',
      faceValue: prev.faceValue || '100',
      dividendPayable: '',
      dividendPayableLedgerId: prev.dividendPayableLedgerId,
      fromShareNo: nextShareConfig.nextFromShareNo ? nextShareConfig.nextFromShareNo.toString() : '',
      toShareNo: '',
      certificateNo: nextShareConfig.nextCertificateNo || '',
      ledgerId: prev.ledgerId
    }));
  };

  const handleStartEdit = (b: ShareOpeningBalance) => {
    setIsEditMode(true);
    setEditAccountId(b.shareAccountId);
    setEditCertificateId(b.certificateId || null);
    let formattedDate = b.openingDate ? b.openingDate.split('T')[0] : (new Date().getFullYear() + '-03-31');
    const fv = (b.faceValue || 100).toString();
    const qty = (b.shareQuantity || 0).toString();
    const fromNo = b.fromShareNo ? b.fromShareNo.toString() : '';
    const toNo = b.toShareNo ? b.toShareNo.toString() : (b.fromShareNo && b.shareQuantity ? (b.fromShareNo + b.shareQuantity - 1).toString() : '');

    setFormData({
      shareSchemeId: formData.shareSchemeId || (schemes.length > 0 ? schemes[0].shareSchemeId.toString() : ''),
      memberId: b.memberId.toString(),
      legacyMemberNo: b.legacyMemberNo || '',
      openingDate: formattedDate,
      shareQuantity: qty,
      faceValue: fv,
      dividendPayable: (b.dividendPayable || 0).toString(),
      dividendPayableLedgerId: formData.dividendPayableLedgerId,
      fromShareNo: fromNo,
      toShareNo: toNo,
      certificateNo: b.certificateNo || '',
      ledgerId: formData.ledgerId
    });
    setShowListModal(false);
    setMessage(`संपादन मोड: सभासद ${b.memberName} (${b.certificateNo || 'नोंद'}) ची माहिती फॉर्ममध्ये लोड केली.`);
    setMessageType('success');
    
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberId || !formData.shareQuantity || !formData.faceValue || !formData.openingDate) {
      setMessage('कृपया सर्व अनिवार्य (*) फील्ड भरा.');
      setMessageType('error');
      return;
    }
    if (!formData.ledgerId) {
      const errMsg = 'कृपया शेअर भांडवल लेजर (Capital Ledger) निवडा. लेजर निवडल्याशिवाय शेअर ओपनिंग बॅलन्स सेव्ह करता येत नाही.';
      setMessage(errMsg);
      setMessageType('error');
      alert(errMsg);
      return;
    }

    if (legacyMemberDuplicate) {
      const errMsg = `हा जुना सभासद आयडी (${formData.legacyMemberNo}) आधीच सभासद '${legacyMemberDuplicate.name}' (${legacyMemberDuplicate.code}) साठी नोंदवला आहे.`;
      setMessage(errMsg);
      setMessageType('error');
      alert(errMsg);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const qty = parseInt(formData.shareQuantity, 10) || 0;
      const fromNo = parseInt(formData.fromShareNo, 10) || nextShareConfig.nextFromShareNo || 1;
      const toNo = parseInt(formData.toShareNo, 10) || (qty > 0 ? fromNo + qty - 1 : fromNo);
      const certNo = formData.certificateNo || nextShareConfig.nextCertificateNo || '';

      const payload = {
        certificateId: editCertificateId,
        memberId: parseInt(formData.memberId),
        shareSchemeId: formData.shareSchemeId ? parseInt(formData.shareSchemeId) : null,
        legacyMemberNo: formData.legacyMemberNo,
        openingDate: formData.openingDate,
        shareQuantity: qty,
        faceValue: parseFloat(formData.faceValue),
        dividendPayable: parseFloat(formData.dividendPayable) || 0,
        dividendPayableLedgerId: formData.dividendPayableLedgerId ? parseInt(formData.dividendPayableLedgerId) : null,
        fromShareNo: fromNo,
        toShareNo: toNo,
        certificateNo: certNo,
        ledgerId: formData.ledgerId ? parseInt(formData.ledgerId) : null
      };
      const url = isEditMode && editAccountId ? `/api/ShareAccounts/OpeningBalance/${editAccountId}` : '/api/ShareAccounts/OpeningBalance';
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(isEditMode ? 'शेअर ओपनिंग बॅलन्स यशस्वीरित्या अपडेट केला!' : 'शेअर ओपनिंग बॅलन्स यशस्वीरित्या सेव्ह झाला!');
        setMessageType('success');
        resetForm();
        fetchMembers();
        fetchBalances();
        fetchNextMemberCode();
        fetchNextShareConfig();
      } else {
        setMessage(data.message || 'त्रुटी (Error saving balance).');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('नेटवर्क त्रुटी (Network error).');
      setMessageType('error');
    }
    setLoading(false);
  };

  const handleResequenceMemberCodes = async () => {
    if (!window.confirm("तुम्हाला खात्री आहे का? यामुळे सर्व शेअर्स खातेदारांचे सभासद कोड (Member Code) १ ते N सलग (MEM0001, MEM0002... MEM0113, MEM0114...) अशा अचूक क्रमाने रीसेट होतील.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ShareAccounts/ResequenceMemberCodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'सर्व सभासद कोड सलग रीसेट झाले!');
        setMessageType('success');
        alert(data.message || 'सर्व सभासद कोड सलग रीसेट झाले!');
        await fetchBalances();
        await fetchMembers();
        await fetchNextMemberCode();
        await fetchNextShareConfig();
      } else {
        setMessage(data.message || 'त्रुटी (Error resequencing).');
        setMessageType('error');
        alert(data.message || 'त्रुटी (Error resequencing).');
      }
    } catch(err) {
      setMessage('नेटवर्क त्रुटी (Network error).');
      setMessageType('error');
    }
    setLoading(false);
  };

  const handleSyncImported = async () => {
    if (!formData.ledgerId) { alert("कृपया आधी 'लेजर निवडा' (Please select a ledger first)."); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/ShareAccounts/SyncImportedBalances', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ ledgerId: parseInt(formData.ledgerId) })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'सिंक यशस्वी (Sync successful).');
        setMessageType('success');
        fetchBalances();
      } else {
        setMessage(data.message || 'त्रुटी (Error syncing).');
        setMessageType('error');
      }
    } catch(err) {
      setMessage('नेटवर्क त्रुटी (Network error).');
      setMessageType('error');
    }
    setLoading(false);
  };

  const handleDelete = async (targetId: number, isCertificate: boolean = false) => {
    const itemDesc = isCertificate ? "हे शेअर प्रमाणपत्र / नोंद" : "ही संपूर्ण शेअर ओपनिंग नोंद";
    if (!window.confirm(`तुम्हाला नक्की ${itemDesc} डिलीट करायची आहे का? (Are you sure you want to delete this record?)`)) return;
    try {
      const url = isCertificate ? `/api/ShareAccounts/OpeningBalance/Certificate/${targetId}` : `/api/ShareAccounts/OpeningBalance/${targetId}`;
      const res = await fetch(url, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setMessage('नोंद यशस्वीरित्या डिलीट केली आणि शिल्लक रीकन्साइल झाली!');
        setMessageType('success');
        if (isEditMode && (editAccountId === targetId || editCertificateId === targetId)) {
          resetForm();
        }
        fetchBalances();
        fetchMembers();
        fetchNextMemberCode();
        fetchNextShareConfig();
      } else {
        const data = await res.json();
        alert(data.message || 'त्रुटी (Error deleting).');
      }
    } catch (error) {
      alert('नेटवर्क त्रुटी (Network error).');
    }
  };

  const getMemberDisplayNo = (m: any) => {
    if (!m) return '';
    if (m.legacyMemberNo && String(m.legacyMemberNo).trim()) return String(m.legacyMemberNo).trim();
    if (m.legacyCustomerNo && String(m.legacyCustomerNo).trim()) return String(m.legacyCustomerNo).trim();
    if (m.cifNo) {
      const digits = String(m.cifNo).replace(/\D/g, '').replace(/^0+/, '');
      if (digits) return digits;
    }
    if (m.memberCode) {
      const digits = String(m.memberCode).replace(/\D/g, '').replace(/^0+/, '');
      if (digits) return digits;
    }
    const id = m.memberID ?? m.customerID;
    return id ? String(id) : '';
  };

  const selectedMember = Array.isArray(members) ? members.find(m => m && String(m.memberID ?? (m as any).customerID ?? '') === String(formData.memberId)) : undefined;
  const selectedScheme = Array.isArray(schemes) ? schemes.find(s => s && String(s.shareSchemeId ?? '') === String(formData.shareSchemeId)) : undefined;
  const existingMemberIds = new Set(Array.isArray(balances) ? balances.map(b => b ? String(b.memberId ?? (b as any).customerID ?? '') : '').filter(Boolean) : []);
  const availableMembers = Array.isArray(members) ? members.filter(m => {
    if (!m) return false;
    const mIdStr = String(m.memberID ?? (m as any).customerID ?? '');
    return !existingMemberIds.has(mIdStr) || mIdStr === String(formData.memberId);
  }) : [];

  // Real-time duplicate check for legacyMemberNo
  const legacyMemberDuplicate = React.useMemo(() => {
    if (!formData.legacyMemberNo || !formData.legacyMemberNo.trim()) return null;
    const trimmed = formData.legacyMemberNo.trim().toLowerCase();
    const currentMemberIdStr = String(formData.memberId || '');
    // Check in existing balances
    const matchBal = Array.isArray(balances) ? balances.find(b => b && String(b.memberId || (b as any).customerID || '') !== currentMemberIdStr && (b.legacyMemberNo?.trim().toLowerCase() === trimmed)) : null;
    if (matchBal) return { name: matchBal.memberName, code: matchBal.memberNo || matchBal.legacyMemberNo || `ID:${matchBal.memberId}` };
    // Check in members list
    const matchMem = Array.isArray(members) ? members.find(m => m && String(m.memberID || (m as any).customerID || '') !== currentMemberIdStr && ((m.legacyMemberNo?.trim().toLowerCase() === trimmed) || ((m as any).oldMemberCode?.trim().toLowerCase() === trimmed))) : null;
    if (matchMem) return { name: `${matchMem.firstName} ${matchMem.lastName}`, code: matchMem.memberCode || `ID:${matchMem.memberID || (matchMem as any).customerID}` };
    return null;
  }, [formData.legacyMemberNo, formData.memberId, balances, members]);
  
  const memberOptions = availableMembers.map(m => {
    const oldCif = getMemberDisplayNo(m);
    const oldCifDisplay = oldCif ? `(ID: ${oldCif}) ` : '';
    const fullName = stringJoin([m?.firstName, m?.middleName, m?.lastName]);
    const idVal = String(m?.memberID ?? (m as any)?.customerID ?? '');
    return {
      value: idVal, 
      label: `${m?.cifNo || ''} ${oldCifDisplay}- ${fullName}`.replace(/\s+/g, ' ').trim()
    };
  });

  function stringJoin(arr: (string | undefined)[]): string {
    return arr.filter(s => !!s && String(s).trim().length > 0).join(' ');
  }

  const filteredBalances = balances.filter(b => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (b.memberName && b.memberName.toLowerCase().includes(term)) ||
      (b.memberNo && b.memberNo.toLowerCase().includes(term)) ||
      (b.cifNo && b.cifNo.toLowerCase().includes(term)) ||
      (b.legacyMemberNo && b.legacyMemberNo.toLowerCase().includes(term)) ||
      (b.certificateNo && b.certificateNo.toLowerCase().includes(term)) ||
      (b.accountNo && b.accountNo.toLowerCase().includes(term))
    );
  });

  const totalSharesCount = balances.reduce((sum, b) => sum + (b.shareQuantity || 0), 0);
  const totalCapitalAmount = balances.reduce((sum, b) => sum + (b.shareAmount || 0), 0);
  const totalDividendAmount = balances.reduce((sum, b) => sum + (b.dividendPayable || 0), 0);

  const handleExportExcel = () => {
    if (filteredBalances.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
    const rows = filteredBalances.map((b, i) => ({
      'अ.क्र.': i + 1,
      'तारीख': new Date(b.openingDate).toLocaleDateString('en-GB'),
      'सभासद क्र.': b.memberNo || b.memberId,
      'जुना क्र. (Old ID)': b.legacyMemberNo || '-',
      'सभासदाचे नाव': b.memberName,
      'प्रमाणपत्र क्र.': b.certificateNo || '-',
      'शेअर्स संख्या': b.shareQuantity,
      'दर्शनी मूल्य (₹)': b.faceValue,
      'एकूण रक्कम (₹)': b.shareAmount,
      'देणे लाभांश (₹)': b.dividendPayable || 0
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ShareOpeningBalances');
    XLSX.writeFile(wb, `Share_Opening_Balance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const inputClass = "w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] h-[28px] bg-white";
  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Coins size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>शेअर ओपनिंग बॅलन्स स्थलांतर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Share Opening Balance Migration)</span>
              {isEditMode && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">प्रारंभीचे भाग भांडवल, दर्शनी मूल्य, शेअर्स क्रमांक व देणे लाभांश नोंदणी</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isEditMode && (
            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>संपादन रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन नोंद फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchBalances();
              setShowListModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="नोंदवलेली शेअर्स यादी पॉप-अप मध्ये पहा"
          >
            <List className="w-4 h-4" />
            <span>📋 नोंदवलेली यादी पहा ({balances.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">स्थलांतरित सभासद</div>
            <div className="text-sm font-black text-gray-900">{balances.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण शेअर्स संख्या</div>
            <div className="text-sm font-black text-indigo-950">{totalSharesCount.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण भाग भांडवल (₹)</div>
            <div className="text-sm font-black text-emerald-800">₹ {totalCapitalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण देणे लाभांश (₹)</div>
            <div className="text-sm font-black text-amber-800">₹ {totalDividendAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`mb-3 p-2 rounded-sm font-bold border flex items-center justify-between text-[11px] shadow-2xs ${
          messageType === 'error' 
            ? 'bg-rose-50 text-rose-800 border-rose-200' 
            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          <div className="flex items-center gap-1.5">
            {messageType === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600" /> : <CheckCircle className="w-4 h-4 text-emerald-600" />}
            <span>{message}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setMessage('')} 
            className="text-gray-400 hover:text-gray-700 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Form Entry Card */}
      <div ref={formRef} className="w-full bg-white rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary p-3.5 sm:p-4 mb-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              {isEditMode ? <Edit3 className="w-4 h-4 text-amber-600" /> : <PlusCircle className="w-4 h-4 text-primary" />}
              <h2 className={`text-xs sm:text-sm font-bold ${isEditMode ? 'text-amber-800' : 'text-primary'}`}>
                {isEditMode ? 'नोंद संपादित करा (Edit Share Balance Record)' : '१. शेअर ओपनिंग बॅलन्स माहिती नोंदणी फॉर्म'}
              </h2>
            </div>
            {isEditMode && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2 py-0.5 rounded-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>संपादन रद्द करा (Cancel)</span>
              </button>
            )}
          </div>

          {/* Scheme Selection Card */}
          <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-sm">
            <label className="block text-[11px] font-bold text-primary mb-1">
              भाग भांडवल योजना (Share Scheme) <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
              <select
                name="shareSchemeId"
                className={`${inputClass} font-bold text-primary`}
                value={formData.shareSchemeId}
                onChange={(e) => handleSchemeSelect(e.target.value)}
              >
                <option value="">-- योजना निवडा किंवा डिफॉल्ट वापरा --</option>
                {schemes.map(s => (
                  <option key={s.shareSchemeId} value={s.shareSchemeId.toString()}>
                    {s.schemeCode} - {s.schemeName} (₹{s.shareFaceValue}/शेअर)
                  </option>
                ))}
              </select>
              {selectedScheme && (
                <div className="flex items-center justify-between text-[10px] text-gray-700 font-medium bg-white p-1.5 rounded border border-gray-200">
                  <span>वर्ग: <strong>{selectedScheme.memberType === 'Regular' ? 'नियमित (Class A)' : selectedScheme.memberType === 'Nominal' ? 'नाममात्र (Class B)' : selectedScheme.memberType}</strong></span>
                  <span>दर्शनी मूल्य: <strong>₹{selectedScheme.shareFaceValue}</strong></span>
                  <span>लाभांश: <strong>{selectedScheme.dividendRate}%</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Row 1: Date & Share Capital Ledger */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>तारीख (Opening Date) <span className="text-red-500">*</span></label>
              <input 
                type="date" 
                name="openingDate"
                className={inputClass}
                value={formData.openingDate}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className={labelClass}>भाग भांडवल लेजर (Share Capital Ledger) <span className="text-red-500">*</span></label>
              <select 
                name="ledgerId"
                className={inputClass}
                value={formData.ledgerId}
                onChange={handleChange}
                required
              >
                {ledgers.map(l => (
                  <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Select Member & IDs */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className={labelClass}>सभासद निवडा (Select Member) <span className="text-red-500">*</span></label>
              <MemberSearchSelect 
                members={members} 
                value={formData.memberId ? Number(formData.memberId) : ''} 
                onChange={(val) => handleChange({ target: { name: 'memberId', value: val ? String(val) : '' } })} 
                placeholder="-- सभासद नाव, कोड किंवा मोबाईलने शोधा --"
              />
            </div>

            <div className="sm:col-span-3">
              <label className={labelClass}>सभासद कोड (Member Code)</label>
              <input 
                type="text" 
                readOnly
                value={
                  selectedMember 
                    ? (selectedMember.memberCode && selectedMember.memberCode.trim().toUpperCase().startsWith('MEM') 
                        ? selectedMember.memberCode.trim().toUpperCase() 
                        : (selectedMember.memberCode?.trim() || nextMemberCode))
                    : nextMemberCode
                }
                placeholder="-- सभासद निवडल्यावर दिसेल --"
                className={`${inputClass} bg-slate-100 font-bold text-primary cursor-not-allowed`}
              />
            </div>

            <div className="sm:col-span-3">
              <label className={labelClass}>Old ID (जुना आयडी)</label>
              <input 
                type="text" 
                name="legacyMemberNo"
                value={formData.legacyMemberNo}
                onChange={handleChange}
                placeholder="उदा. 1234"
                className={`${inputClass} ${legacyMemberDuplicate ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-bold focus:ring-rose-500' : ''}`}
              />
              {legacyMemberDuplicate && (
                <span className="text-[10px] text-rose-600 font-bold block mt-0.5 animate-pulse">
                  ⚠️ हा आयडी आधीच {legacyMemberDuplicate.name} ({legacyMemberDuplicate.code}) कडे नोंदवला आहे.
                </span>
              )}
            </div>
          </div>

          {/* Row 3: Shares Count, Face Value & Total Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>शेअर्सची संख्या (Quantity) <span className="text-red-500">*</span></label>
              <input 
                type="number" 
                name="shareQuantity"
                min="1"
                className={`${inputClass} font-bold text-gray-900`}
                value={formData.shareQuantity}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className={labelClass}>दर्शनी मूल्य (Face Value) <span className="text-red-500">*</span></label>
              <input 
                type="number" 
                name="faceValue"
                min="0.01"
                step="0.01"
                className={`${inputClass} font-bold text-gray-900`}
                value={formData.faceValue}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className={labelClass}>एकूण रक्कम (Total Amount)</label>
              <input 
                type="number" 
                name="totalAmountInput"
                min="1"
                step="0.01"
                placeholder="0.00"
                className={`${inputClass} font-bold text-emerald-800`}
                value={((parseInt(formData.shareQuantity) || 0) * (parseFloat(formData.faceValue) || 0)) || ''}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Row 4: Share Number Range & Certificate No */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>
                <span>शेअर्स नं. पासून (From Share No)</span>
                <span className="text-[10px] text-gray-500 font-normal ml-1">[Auto / बदल करा]</span>
              </label>
              <input 
                type="number" 
                name="fromShareNo"
                className={`${inputClass} font-bold text-gray-800`}
                value={formData.fromShareNo}
                onChange={handleChange}
                placeholder={nextShareConfig.nextFromShareNo ? nextShareConfig.nextFromShareNo.toString() : '1'}
              />
            </div>

            <div>
              <label className={labelClass}>
                <span>शेअर्स नं. पर्यंत (To Share No)</span>
                <span className="text-[10px] text-gray-500 font-normal ml-1">[Auto]</span>
              </label>
              <input 
                type="number" 
                name="toShareNo"
                className={`${inputClass} font-bold text-gray-800`}
                value={formData.toShareNo}
                onChange={handleChange}
                placeholder="उदा. 10385"
              />
            </div>

            <div>
              <label className={labelClass}>
                <span>सर्टिफिकेट नं. (Certificate No)</span>
                <span className="text-[10px] text-gray-500 font-normal ml-1">[Auto / बदल करा]</span>
              </label>
              <input 
                type="text" 
                name="certificateNo"
                className={`${inputClass} font-bold text-gray-800 font-mono`}
                value={formData.certificateNo}
                onChange={handleChange}
                placeholder={nextShareConfig.nextCertificateNo || 'CERT-0001'}
              />
            </div>
          </div>

          {/* Row 5: Dividend Payable Section */}
          <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-sm space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>देणे लाभांश रक्कम (Dividend Payable)</label>
                <input 
                  type="number" 
                  name="dividendPayable"
                  step="0.01"
                  className={inputClass}
                  value={formData.dividendPayable}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className={labelClass}>लाभांश लेजर (Dividend Ledger)</label>
                <select 
                  name="dividendPayableLedgerId"
                  className={inputClass}
                  value={formData.dividendPayableLedgerId}
                  onChange={handleChange}
                >
                  <option value="">-- लेजर निवडा --</option>
                  {ledgers.map(l => (
                    <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedScheme && selectedScheme.dividendPayableLedgerID && (
              <div className="text-[10px] text-amber-900 font-medium">
                ⚡ योजनेनुसार मॅप केलेले लेजर: <strong>{ledgers.find(l => l.ledgerID === selectedScheme.dividendPayableLedgerID)?.ledgerName || 'मॅप केलेले'}</strong>
              </div>
            )}
          </div>

          {/* Form Action Buttons */}
          <div className="pt-2 border-t border-gray-200 flex flex-wrap justify-end gap-2">
            <button 
              type="button"
              onClick={resetForm}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-sm font-bold shadow-2xs transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'संपादन रद्द करा' : 'फॉर्म रिकामा करा (Reset)'}</span>
            </button>
            <button 
              type="submit"
              className={`${
                isEditMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white px-6 py-2 rounded-sm font-bold shadow-xs transition-all text-xs flex items-center gap-1.5 cursor-pointer`}
              disabled={loading}
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'प्रक्रिया सुरू आहे...' : isEditMode ? 'बदल सेव्ह करा (Update)' : 'नोंद सेव्ह करा (Save)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: MIGRATED SHARES LIST (स्थलांतरित शेअर्स नोंद यादी)           */}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <List className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>स्थलांतरित शेअर्स नोंद यादी (Migrated Shares List)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full">
                    {filteredBalances.length} / {balances.length} खाती
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

            {/* Modal Toolbar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="नाव, आयडी, CIF, सर्टिफिकेट शोधा..."
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResequenceMemberCodes}
                  disabled={loading || balances.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="सर्व शेअर्स खातेदारांचे सभासद कोड (MEM0001, MEM0002...) सलग रीसेट करा"
                >
                  <RotateCcw size={13} className={loading ? 'animate-spin' : ''} />
                  <span>सलग कोड रीसेट करा (1-N)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={filteredBalances.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="एक्सेल फाइल डाउनलोड करा"
                >
                  <FileSpreadsheet size={13} />
                  <span>एक्सेल एक्सपोर्ट</span>
                </button>

                <button 
                  onClick={handleSyncImported}
                  disabled={loading || !formData.ledgerId}
                  className="bg-primary hover:opacity-90 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="सर्व शेअर्स लेजर शिल्लक पुनर्गणित (Sync) करा"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  <span>इम्पोर्ट सिंक करा</span>
                </button>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-16">तारीख</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-24">सभासद कोड (Code)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-20">जुना क्र. (Old ID)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200">सभासद (Member)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-24">सर्टिफिकेट नं.</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right w-16">शेअर्स</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right w-20">दर्शनी मूल्य</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right w-24">एकूण रक्कम</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right w-24">देणे लाभांश</th>
                      <th className="px-2 py-1.5 text-center w-24">कृती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px]">
                    {filteredBalances.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-gray-400 font-bold">
                          कोणतीही नोंद सापडली नाही (No records found).
                        </td>
                      </tr>
                    ) : (
                      filteredBalances.map((b, idx) => {
                        const isSelected = (editCertificateId && editCertificateId === b.certificateId) || 
                                           (!editCertificateId && editAccountId === b.shareAccountId);
                        const rowKey = b.certificateId ? `cert-${b.certificateId}` : `acc-${b.shareAccountId}-${idx}`;
                        return (
                        <tr 
                          key={rowKey} 
                          className={`transition-colors hover:bg-primary/5 ${
                            isSelected ? 'bg-amber-100 font-bold' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                          }`}
                        >
                          <td className="px-2 py-1.5 border-r border-gray-200 whitespace-nowrap text-gray-600 font-mono text-center">
                            {new Date(b.openingDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 font-bold text-primary font-mono text-center">
                            {b.memberNo || (b.cifNo ? b.cifNo.replace(/\D/g, '').replace(/^0+/, '') : b.memberId)}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-gray-600 font-semibold text-center font-mono">
                            {b.legacyMemberNo || '-'}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 font-medium text-gray-900">
                            {b.cifNo ? `${b.cifNo} - ` : ''}{b.memberName}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-gray-700 font-mono text-[10px] text-center">
                            {b.certificateNo || '-'}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-right font-bold text-gray-900 font-mono">
                            {b.shareQuantity}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-right text-gray-600 font-mono">
                            ₹{b.faceValue.toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-right font-bold text-emerald-700 font-mono">
                            ₹{b.shareAmount.toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-right font-bold text-amber-700 font-mono">
                            ₹{(b.dividendPayable || 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                type="button"
                                onClick={() => handleStartEdit(b)}
                                className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="नोंद फॉर्ममध्ये लोड करा (Load & Edit in Form)"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>एडिट</span>
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleDelete(b.certificateId || b.shareAccountId, Boolean(b.certificateId))}
                                className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="नोंद डिलीट करा (Delete this certificate/entry)"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>डिलीट</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );})
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowListModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-xs font-bold transition-all cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ShareOpeningBalance;
