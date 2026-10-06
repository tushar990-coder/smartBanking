import React, { useState, useEffect, useRef } from 'react';
import CustomerSearchSelect, { CustomerOption } from './common/CustomerSearchSelect';
import { 
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
  Plus,
  Layers,
  Hash
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Member extends CustomerOption {}

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
  customerId?: number;
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

interface ShareOpeningBalanceProps {
  onSwitchToBulk?: () => void;
}

const ShareOpeningBalance: React.FC<ShareOpeningBalanceProps> = ({ onSwitchToBulk }) => {
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

  const [nextMemberCode, setNextMemberCode] = useState('');
  const [nextShareConfig, setNextShareConfig] = useState<{
    nextCertificateNo: string;
    nextFromShareNo: number;
    nextMemberCode?: string;
  }>({ nextCertificateNo: '', nextFromShareNo: 1 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

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
    const matchedScheme = Array.isArray(schemes) ? schemes.find(s => s && String(s.shareSchemeId ?? '') === schemeIdStr) : undefined;
    if (matchedScheme) {
      setFormData(prev => ({
        ...prev,
        shareSchemeId: schemeIdStr,
        faceValue: String(matchedScheme.shareFaceValue || 100),
        ledgerId: matchedScheme.shareCapitalLedgerID ? String(matchedScheme.shareCapitalLedgerID) : prev.ledgerId,
        dividendPayableLedgerId: matchedScheme.dividendPayableLedgerID ? String(matchedScheme.dividendPayableLedgerID) : prev.dividendPayableLedgerId
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
        setLedgers(Array.isArray(data) ? data : []);
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

  const handleCustomerSelect = (selectedCustId: number | '') => {
    if (!selectedCustId) {
      if (isEditMode) {
        setIsEditMode(false);
        setEditAccountId(null);
        setEditCertificateId(null);
      }
      setFormData(prev => ({
        ...prev,
        memberId: '',
        legacyMemberNo: ''
      }));
      return;
    }

    const selCust = Array.isArray(members) ? members.find(m => (m.customerID || m.id) === Number(selectedCustId)) : undefined;
    const existingBal = Array.isArray(balances) ? balances.find(b => {
      if (!b) return false;
      const bCustId = Number(b.customerId || 0);
      const selId = Number(selectedCustId);
      if (bCustId > 0 && bCustId === selId) return true;
      if (selCust?.cifNo && b.cifNo && b.cifNo.trim().toLowerCase() === selCust.cifNo.trim().toLowerCase()) return true;
      return false;
    }) : undefined;

    if (existingBal) {
      setIsEditMode(true);
      setEditAccountId(existingBal.shareAccountId);
      setEditCertificateId(existingBal.certificateId || null);
      let formattedDate = existingBal.openingDate ? existingBal.openingDate.split('T')[0] : (new Date().getFullYear() + '-03-31');
      setFormData(prev => ({
        ...prev,
        memberId: String(selectedCustId),
        legacyMemberNo: existingBal.legacyMemberNo || selCust?.legacyCustomerNo || '',
        openingDate: formattedDate,
        shareQuantity: (existingBal.shareQuantity || 0).toString(),
        faceValue: (existingBal.faceValue || 100).toString(),
        dividendPayable: (existingBal.dividendPayable || 0).toString(),
        fromShareNo: existingBal.fromShareNo ? existingBal.fromShareNo.toString() : prev.fromShareNo,
        toShareNo: existingBal.toShareNo ? existingBal.toShareNo.toString() : prev.toShareNo,
        certificateNo: existingBal.certificateNo || prev.certificateNo
      }));
      setMessage(`माहिती: सभासद '${existingBal.memberName}' ची आधीची नोंद सापडली. फॉर्म आपोआप संपादन (Edit) मोडमध्ये लोड केला आहे.`);
      setMessageType('success');
    } else {
      if (isEditMode) {
        setIsEditMode(false);
        setEditAccountId(null);
        setEditCertificateId(null);
      }
      setFormData(prev => ({
        ...prev,
        memberId: String(selectedCustId),
        legacyMemberNo: selCust?.legacyCustomerNo || ''
      }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'shareQuantity') {
      const cleanDigits = value.replace(/\D/g, '');
      const qty = parseInt(cleanDigits, 10);
      const safeQty = !isNaN(qty) && qty > 0 ? qty : 0;
      const currentFrom = parseInt(formData.fromShareNo, 10) || nextShareConfig.nextFromShareNo || 1;
      const calculatedTo = safeQty > 0 ? (currentFrom + safeQty - 1) : '';
      setFormData(prev => ({
        ...prev,
        shareQuantity: cleanDigits,
        fromShareNo: prev.fromShareNo || currentFrom.toString(),
        toShareNo: calculatedTo ? calculatedTo.toString() : ''
      }));
    } else if (name === 'fromShareNo') {
      const cleanDigits = value.replace(/\D/g, '');
      const fromNum = parseInt(cleanDigits, 10);
      const safeFrom = !isNaN(fromNum) && fromNum > 0 ? fromNum : 0;
      const qty = parseInt(formData.shareQuantity, 10) || 0;
      const calculatedTo = (safeFrom > 0 && qty > 0) ? (safeFrom + qty - 1) : '';
      setFormData(prev => ({
        ...prev,
        fromShareNo: cleanDigits,
        toShareNo: calculatedTo ? calculatedTo.toString() : prev.toShareNo
      }));
    } else if (name === 'toShareNo') {
      const cleanDigits = value.replace(/\D/g, '');
      const toNum = parseInt(cleanDigits, 10);
      const safeTo = !isNaN(toNum) && toNum > 0 ? toNum : 0;
      const currentFrom = parseInt(formData.fromShareNo, 10) || nextShareConfig.nextFromShareNo || 1;
      if (safeTo >= currentFrom && currentFrom > 0) {
        const calcQty = safeTo - currentFrom + 1;
        setFormData(prev => ({
          ...prev,
          toShareNo: cleanDigits,
          fromShareNo: prev.fromShareNo || currentFrom.toString(),
          shareQuantity: calcQty.toString()
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          toShareNo: cleanDigits
        }));
      }
    } else if (name === 'faceValue') {
      const cleanNum = value.replace(/[^0-9.]/g, '');
      setFormData(prev => ({ ...prev, faceValue: cleanNum }));
    } else if (name === 'dividendPayable') {
      const cleanNum = value.replace(/[^0-9.]/g, '');
      setFormData(prev => ({ ...prev, dividendPayable: cleanNum }));
    } else if (name === 'legacyMemberNo') {
      setFormData(prev => ({ ...prev, legacyMemberNo: value }));
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
      fromShareNo: nextShareConfig.nextFromShareNo ? nextShareConfig.nextFromShareNo.toString() : '1',
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

    let targetCustId = (b.customerId && b.customerId > 0) ? b.customerId.toString() : '';
    if (!targetCustId && b.cifNo) {
      const foundCust = Array.isArray(members) ? members.find(m => m && m.cifNo && m.cifNo.trim().toLowerCase() === b.cifNo.trim().toLowerCase()) : undefined;
      if (foundCust) {
        targetCustId = String(foundCust.customerID || foundCust.customerId || foundCust.id);
      }
    }
    if (!targetCustId) {
      targetCustId = b.memberId.toString();
    }

    setFormData({
      shareSchemeId: formData.shareSchemeId || (schemes.length > 0 ? schemes[0].shareSchemeId.toString() : ''),
      memberId: targetCustId,
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

      const selMember = Array.isArray(members) ? members.find(m => m && (
        Number(m.customerID || m.customerId || m.id) === Number(formData.memberId)
      )) : undefined;

      const resolvedCustomerId = selMember ? Number(selMember.customerID || selMember.customerId || selMember.id) : parseInt(formData.memberId);

      const existingBalForMember = Array.isArray(balances) ? balances.find(b => b && (
        (b.customerId && Number(b.customerId) === resolvedCustomerId) ||
        (selMember?.cifNo && b.cifNo && b.cifNo.trim().toLowerCase() === selMember.cifNo.trim().toLowerCase())
      )) : undefined;

      const resolvedMemberId = existingBalForMember?.memberId || selMember?.memberProfile?.memberID || (selMember as any)?.memberID || resolvedCustomerId;

      const payload = {
        certificateId: editCertificateId,
        memberId: resolvedMemberId,
        customerId: resolvedCustomerId,
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
      let data: any = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: 'सर्व्हरकडून प्रतिसाद वाचता आला नाही.' };
      }

      if (res.ok) {
        setMessage(isEditMode ? 'शेअर ओपनिंग बॅलन्स यशस्वीरित्या अपडेट केला!' : 'शेअर ओपनिंग बॅलन्स यशस्वीरित्या सेव्ह झाला!');
        setMessageType('success');
        resetForm();
        fetchMembers();
        fetchBalances();
        fetchNextMemberCode();
        fetchNextShareConfig();
      } else {
        const errMsg = data.message || data.error || (typeof data === 'string' ? data : '') || 'त्रुटी (Error saving balance).';
        setMessage(errMsg);
        setMessageType('error');
      }
    } catch (error: any) {
      setMessage(error?.message || 'नेटवर्क त्रुटी (Network error).');
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
    } catch {
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
    } catch {
      setMessage('नेटवर्क त्रुटी (Network error).');
      setMessageType('error');
    }
    setLoading(false);
  };

  const handleDelete = async (targetId: number, isCertificate: boolean = false) => {
    const itemDesc = isCertificate ? "हे शेअर प्रमाणपत्र / नोंद" : "ही संपूर्ण शेअर ओपनिंग नोंद";
    if (!window.confirm(`तुम्हाला नक्की ${itemDesc} डिलीट करायची आहे का? (Are you sure you want to delete this record?)`)) return;
    try {
      setLoading(true);
      const url = isCertificate ? `/api/ShareAccounts/OpeningBalance/Certificate/${targetId}` : `/api/ShareAccounts/OpeningBalance/${targetId}`;
      const res = await fetch(url, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'नोंद यशस्वीरित्या डिलीट केली आणि सभासद कोड पूर्ववत रोलबॅक केला!');
        setMessageType('success');
        if (isEditMode && (editAccountId === targetId || editCertificateId === targetId)) {
          resetForm();
        }
        await fetchBalances();
        await fetchMembers();
        await fetchNextMemberCode();
        await fetchNextShareConfig();
      } else {
        alert(data.message || 'त्रुटी (Error deleting).');
      }
    } catch {
      alert('नेटवर्क त्रुटी (Network error).');
    } finally {
      setLoading(false);
    }
  };

  const selectedMember = Array.isArray(members) ? members.find(m => m && (
    Number(m.customerID || m.customerId || m.id) === Number(formData.memberId)
  )) : undefined;

  const currentMemberCodeDisplay = React.useMemo(() => {
    if (!formData.memberId) return '';
    
    const selCustId = Number(formData.memberId);
    const selCif = selectedMember?.cifNo?.trim().toLowerCase();

    const existingBal = Array.isArray(balances) ? balances.find(b => b && (
      (selCustId > 0 && b.customerId && Number(b.customerId) === selCustId) ||
      (selCif && b.cifNo && b.cifNo.trim().toLowerCase() === selCif)
    )) : undefined;

    if (existingBal?.memberNo && existingBal.memberNo.trim().toUpperCase().startsWith('MEM')) {
      return existingBal.memberNo.trim().toUpperCase();
    }

    const rawCode = (selectedMember as any)?.memberProfile?.memberCode || (selectedMember as any)?.memberCode;
    if (rawCode && String(rawCode).trim().toUpperCase().startsWith('MEM')) {
      return String(rawCode).trim().toUpperCase();
    }

    if (existingBal?.memberNo) {
      return existingBal.memberNo.trim();
    }

    return nextMemberCode || '';
  }, [formData.memberId, balances, selectedMember, nextMemberCode]);

  const selectedScheme = Array.isArray(schemes) ? schemes.find(s => s && String(s.shareSchemeId ?? '') === String(formData.shareSchemeId)) : undefined;

  const legacyMemberDuplicate = React.useMemo(() => {
    if (!formData.legacyMemberNo || !formData.legacyMemberNo.trim()) return null;
    const trimmed = formData.legacyMemberNo.trim().toLowerCase();
    const currentCustId = Number(formData.memberId || 0);

    const matchBal = Array.isArray(balances) ? balances.find(b => {
      if (!b) return false;
      const bCustId = Number(b.customerId || 0);
      const isSamePerson = currentCustId > 0 && bCustId === currentCustId;
      return !isSamePerson && (b.legacyMemberNo?.trim().toLowerCase() === trimmed);
    }) : null;
    if (matchBal) return { name: matchBal.memberName, code: matchBal.memberNo || matchBal.legacyMemberNo || `CIF:${matchBal.cifNo}` };

    const matchMem = Array.isArray(members) ? members.find(m => {
      if (!m) return false;
      const mCustId = Number(m.customerID || m.customerId || m.id || 0);
      const isSamePerson = currentCustId > 0 && mCustId === currentCustId;
      return !isSamePerson && (
        (m.legacyMemberNo?.trim().toLowerCase() === trimmed) ||
        (m.legacyCustomerNo?.trim().toLowerCase() === trimmed)
      );
    }) : null;
    if (matchMem) {
      const fullName = [matchMem.firstName, matchMem.middleName, matchMem.lastName].filter(Boolean).join(' ');
      return { name: fullName, code: matchMem.cifNo || `CIF:${matchMem.customerID}` };
    }
    return null;
  }, [formData.legacyMemberNo, formData.memberId, balances, members]);

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
      'जुना सभासद क्र. (Old Member No)': b.legacyMemberNo || '-',
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

  const calculatedTotalAmount = React.useMemo(() => {
    const qty = parseInt(formData.shareQuantity, 10) || 0;
    const fv = parseFloat(formData.faceValue) || 0;
    return qty * fv;
  }, [formData.shareQuantity, formData.faceValue]);

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

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
                  ✏️ संपादन चालू (#{editAccountId})
                </span>
              )}
            </h1>
            <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium">
              प्रारंभीचे भाग भांडवल, दर्शनी मूल्य, शेअर्स क्रमांक व देणे लाभांश स्थलांतर नोंदणी
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onSwitchToBulk && (
            <button
              type="button"
              onClick={onSwitchToBulk}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="बल्क ग्रिड मोडवर जा (Bulk Grid Migration)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>📊 बल्क ग्रिड (Bulk Grid)</span>
            </button>
          )}

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
            <span>नवीन नोंद (Reset)</span>
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
            <div className="text-sm font-black text-emerald-800">
              ₹ {totalCapitalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण देणे लाभांश (₹)</div>
            <div className="text-sm font-black text-amber-800">
              ₹ {totalDividendAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`mb-3 p-2 rounded-sm font-bold border flex items-center justify-between text-xs shadow-2xs ${
            messageType === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-300'
              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {messageType === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage('')}
            className="text-gray-400 hover:text-gray-700 font-bold ml-2 cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* MAIN SINGLE UNIFIED FORM */}
      <div
        ref={formRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          isEditMode ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Header Banner of Form */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded flex items-center justify-center shadow-2xs ${
                  isEditMode
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}
              >
                {isEditMode ? <Edit3 size={15} /> : <Coins size={15} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight">
                    {isEditMode ? 'नोंद संपादन (Edit Share Opening Balance)' : '१. शेअर ओपनिंग बॅलन्स माहिती नोंदणी फॉर्म'}
                  </h2>
                  {isEditMode ? (
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      ✏️ संपादन मोड
                    </span>
                  ) : (
                    <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      नवीन नोंदणी
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 font-medium">
                  सभासदाचे प्रारंभीचे भाग भांडवल, शेअर्स संख्या, प्रमाणपत्र क्रमांक व देणे लाभांश नोंद
                </p>
              </div>
            </div>

            {isEditMode && (
              <button
                type="button"
                onClick={resetForm}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-sm text-[11px] flex items-center gap-1.5 transition-colors border border-slate-300 cursor-pointer shadow-2xs"
              >
                <RotateCcw size={13} />
                <span>संपादन रद्द करा (Cancel)</span>
              </button>
            )}
          </div>

          {/* Section 1: भाग भांडवल योजना व लेजर सेटअप */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. भाग भांडवल योजना व खाते लेजर तपशील (Share Scheme & Ledger)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Share Scheme */}
              <div>
                <label className={labelClass}>
                  भाग भांडवल योजना (Share Scheme) <span className="text-red-500">*</span>
                </label>
                <select
                  name="shareSchemeId"
                  className={`${inputClass} font-semibold text-primary`}
                  value={formData.shareSchemeId}
                  onChange={(e) => handleSchemeSelect(e.target.value)}
                  required
                >
                  <option value="">-- योजना निवडा किंवा डिफॉल्ट वापरा --</option>
                  {schemes.map(s => (
                    <option key={s.shareSchemeId} value={s.shareSchemeId.toString()}>
                      {s.schemeCode} - {s.schemeName} (₹{s.shareFaceValue}/शेअर)
                    </option>
                  ))}
                </select>
              </div>

              {/* Opening Date */}
              <div>
                <label className={labelClass}>
                  तारीख (Opening Date) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="openingDate"
                  value={formData.openingDate}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold text-gray-800`}
                  required
                />
              </div>

              {/* Share Capital Ledger */}
              <div>
                <label className={labelClass}>
                  शेअर भांडवल लेजर (Capital Ledger) <span className="text-red-500">*</span>
                </label>
                <select
                  name="ledgerId"
                  value={formData.ledgerId}
                  onChange={handleChange}
                  className={`${inputClass} font-semibold text-gray-800`}
                  required
                >
                  <option value="">-- लेजर निवडा --</option>
                  {ledgers.map(l => (
                    <option key={l.ledgerID} value={l.ledgerID}>
                      {l.ledgerName} ({l.ledgerID})
                    </option>
                  ))}
                </select>
                {selectedScheme && selectedScheme.shareCapitalLedgerID && (
                  <div className="text-[9px] text-emerald-800 font-medium mt-0.5 flex items-center gap-1 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                    <span className="font-bold">योजनेनुसार लेजर:</span>
                    <span className="font-mono truncate">
                      {ledgers.find(l => l.ledgerID === selectedScheme.shareCapitalLedgerID)?.ledgerName || 'मॅप केलेले लेजर'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: खातेदार व सभासद तपशील */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. खातेदार व सभासद तपशील (Member & Customer Identification)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
              {/* Select Customer */}
              <div className="sm:col-span-6">
                <div className="flex items-center justify-between min-h-[20px] mb-0.5">
                  <label className={labelClass}>
                    खातेदार निवडा (Select Customer / CIF) <span className="text-red-500">*</span>
                  </label>
                  {selectedMember && (
                    <span className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20 font-mono">
                      {selectedMember.cifNo ? `CIF: ${selectedMember.cifNo}` : (selectedMember.legacyCustomerNo ? `जुना: ${selectedMember.legacyCustomerNo}` : `ID: ${selectedMember.customerID}`)}
                    </span>
                  )}
                </div>
                <div className={isEditMode ? 'opacity-70 pointer-events-none' : ''}>
                  <CustomerSearchSelect 
                    customers={members} 
                    value={formData.memberId ? Number(formData.memberId) : ''} 
                    onChange={handleCustomerSelect} 
                    placeholder="-- खातेदार (CIF / नाव / मोबाईलने शोधा) --"
                  />
                </div>
                {selectedMember && (
                  <div className="mt-1 flex items-center justify-between text-[11px] bg-sky-50/70 border border-sky-200 px-2 py-1 rounded text-sky-950 font-bold shadow-2xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-sky-700">👤 खातेदार:</span>
                      <span className="font-extrabold text-gray-900">
                        {selectedMember.fullName || [selectedMember.firstName, selectedMember.middleName, selectedMember.lastName].filter(Boolean).join(' ') || (selectedMember as any).name || (selectedMember as any).customerName}
                      </span>
                      {selectedMember.cifNo && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 border border-blue-300 ml-1">
                          CIF: {selectedMember.cifNo}
                        </span>
                      )}
                    </div>
                    {selectedMember.mobileNo && (
                      <span className="text-[10px] text-gray-600 font-mono shrink-0 ml-1">
                        📱 {selectedMember.mobileNo}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Member Code */}
              <div className="sm:col-span-3">
                <div className="flex items-center justify-between min-h-[20px] mb-0.5">
                  <label className={labelClass}>सभासद कोड (Member Code)</label>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">सलग सिंक</span>
                </div>
                <div className="flex items-center h-[28px] px-2 bg-slate-100 border border-slate-300 rounded-sm font-mono font-bold text-xs text-primary shadow-2xs">
                  {currentMemberCodeDisplay || '-- निवडल्यावर दिसेल --'}
                </div>
              </div>

              {/* Old Member No */}
              <div className="sm:col-span-3">
                <div className="flex items-center justify-between min-h-[20px] mb-0.5">
                  <label className={labelClass}>जुना सभासद क्र. (Old Member No)</label>
                  <span className="text-[10px] text-gray-500 font-mono">रजिस्टर क्र.</span>
                </div>
                <input 
                  type="text" 
                  name="legacyMemberNo"
                  value={formData.legacyMemberNo}
                  onChange={handleChange}
                  placeholder="उदा. 12"
                  className={`${inputClass} font-mono ${legacyMemberDuplicate ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-bold focus:ring-rose-500' : ''}`}
                />
                {legacyMemberDuplicate && (
                  <span className="text-[10px] text-rose-600 font-bold block mt-1 animate-pulse">
                    ⚠️ हा सभासद नंबर आधीच {legacyMemberDuplicate.name} ({legacyMemberDuplicate.code}) कडे नोंदवला आहे.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: शेअर्स संख्या, दर्शनी मूल्य व एकूण रक्कम */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Award className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">३. शेअर्स वाटप, दर्शनी मूल्य व एकूण रक्कम (Share Quantity & Valuation)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              {/* Share Quantity */}
              <div>
                <label className={labelClass}>
                  शेअर्सची संख्या (Quantity) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="shareQuantity"
                  className={`${inputClass} font-mono font-bold text-gray-900`}
                  value={formData.shareQuantity}
                  onChange={handleChange}
                  placeholder="उदा. 5 किंवा 10"
                  required
                />
              </div>

              {/* Face Value */}
              <div>
                <label className={labelClass}>
                  दर्शनी मूल्य (Face Value) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                  <input 
                    type="text" 
                    inputMode="decimal" 
                    name="faceValue"
                    className={`${inputClass} pl-6 font-mono font-bold text-gray-900`}
                    value={formData.faceValue}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Total Share Capital (Prominent Highlight Card) */}
              <div>
                <label className={labelClass}>
                  एकूण भाग भांडवल (Total Amount)
                </label>
                <div className="flex items-center justify-between h-[28px] px-2.5 bg-emerald-50 border border-emerald-300 rounded-sm shadow-2xs">
                  <span className="text-[11px] font-semibold text-emerald-800">एकूण रक्कम:</span>
                  <span className="font-mono font-bold text-emerald-950 text-xs">
                    ₹ {calculatedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: शेअर्स क्रमांक व प्रमाणपत्र तपशील */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Hash className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">४. शेअर्स क्रमांक व प्रमाणपत्र (Share Serial Range & Certificate)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* From Share No */}
              <div>
                <label className={labelClass}>
                  शेअर्स नं. पासून (From No) <span className="text-[10px] text-gray-400 font-normal ml-1">(Auto / बदल करा)</span>
                </label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="fromShareNo"
                  className={`${inputClass} font-mono font-bold text-gray-800`}
                  value={formData.fromShareNo}
                  onChange={handleChange}
                  placeholder="उदा. 1"
                />
              </div>

              {/* To Share No */}
              <div>
                <label className={labelClass}>
                  शेअर्स नं. पर्यंत (To No) <span className="text-[10px] text-emerald-700 font-bold ml-1 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">Auto-गणना</span>
                </label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="toShareNo"
                  className={`${inputClass} font-mono font-bold text-gray-800 bg-slate-50`}
                  value={formData.toShareNo}
                  onChange={handleChange}
                  placeholder="उदा. 10"
                />
              </div>

              {/* Certificate No */}
              <div>
                <label className={labelClass}>
                  सर्टिफिकेट नं. (Certificate No) <span className="text-[10px] text-indigo-700 font-bold ml-1 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200">CERT-xxxx</span>
                </label>
                <input 
                  type="text" 
                  name="certificateNo"
                  className={`${inputClass} font-mono font-bold text-primary uppercase`}
                  value={formData.certificateNo}
                  onChange={handleChange}
                  placeholder={nextShareConfig.nextCertificateNo || 'CERT-0001'}
                />
              </div>
            </div>
          </div>

          {/* Section 5: देणे लाभांश नोंद (पर्यायी / Optional) */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">५. देणे लाभांश नोंद (Dividend Payable - पर्यायी)</h2>
              </div>
              <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                प्रारंभीचे देणे लाभांश असल्यास
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className={labelClass}>
                  देणे लाभांश रक्कम (Dividend Payable ₹)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                  <input 
                    type="number" 
                    name="dividendPayable"
                    step="0.01"
                    min="0"
                    className={`${inputClass} pl-6 font-mono font-bold text-gray-900`}
                    value={formData.dividendPayable}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  लाभांश लेजर (Dividend Payable Ledger)
                </label>
                <select 
                  name="dividendPayableLedgerId"
                  className={`${inputClass} font-medium text-gray-800 bg-white`}
                  value={formData.dividendPayableLedgerId}
                  onChange={handleChange}
                >
                  <option value="">-- लेजर निवडा --</option>
                  {ledgers.map(l => (
                    <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName} ({l.ledgerID})</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedScheme && selectedScheme.dividendPayableLedgerID && (
              <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5 pt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                <span>योजनेनुसार मॅप केलेले लेजर: <strong>{ledgers.find(l => l.ledgerID === selectedScheme.dividendPayableLedgerID)?.ledgerName || 'मॅप केलेले'}</strong></span>
              </div>
            )}
          </div>

          {/* Form Action Buttons Bar */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200">
            <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>नोंद सेव्ह केल्यावर सभासद कोड (MEM), प्रमाणपत्र व भाग भांडवल लेजर आपोआप सिंक होईल.</span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isEditMode ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
              </button>
              <button 
                type="submit"
                disabled={loading}
                className={`px-6 py-2 ${
                  isEditMode 
                    ? 'bg-amber-600 hover:bg-amber-700' 
                    : 'bg-primary hover:opacity-90'
                } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{loading ? 'जतन होत आहे...' : isEditMode ? 'बदल सेव्ह करा (Update)' : 'शेअर ओपनिंग सेव्ह करा (Save Share OB)'}</span>
              </button>
            </div>
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
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredBalances.length} / {balances.length} खाती
                  </span>
                </h2>
              </div>
              <button 
                type="button" 
                onClick={() => setShowListModal(false)}
                className="text-white hover:bg-white/20 p-1 rounded-sm transition-colors cursor-pointer"
                title="बंद करा"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Toolbar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="नाव, कोड, CIF, सर्टिफिकेट किंवा जुना क्र. शोधा..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-gray-300 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white font-medium"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResequenceMemberCodes}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="सर्व सभासद कोड १ ते N सलग अचूक क्रमाने रीसेट करा"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  <span>कोड सलग रीसेट</span>
                </button>

                <button 
                  onClick={handleExportExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="एक्सेल फाइल डाउनलोड करा"
                >
                  <FileSpreadsheet size={13} />
                  <span>एक्सेल एक्सपोर्ट</span>
                </button>

                <button 
                  onClick={handleSyncImported}
                  disabled={loading || !formData.ledgerId}
                  className="bg-primary hover:opacity-90 disabled:opacity-50 text-white px-3 py-1.5 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-28">जुना सभासद क्र.</th>
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
