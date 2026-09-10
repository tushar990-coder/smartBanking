import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';
import {
  Landmark,
  Layers,
  CheckCircle,
  XCircle,
  RotateCcw,
  Save,
  Edit2,
  Trash2,
  Search,
  FileSpreadsheet,
  X,
  Plus,
  IndianRupee,
  Percent,
  Calendar,
  UserCheck,
  BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Member extends MemberOption {}

interface FdScheme {
  fdSchemeID: number;
  schemeName: string;
  interestRate: number;
  durationMonths?: number;
  interestType?: string;
  interestCompoundingFrequency?: string;
}

interface FdAccountRecord {
  fdAccountID: number;
  branchID: number;
  branchName?: string;
  memberID: number;
  memberName?: string;
  memberCode?: string;
  fdSchemeID: number;
  schemeName?: string;
  accountNo: string;
  openingDate: string;
  depositAmount: number;
  interestRate: number;
  maturityDate: string;
  maturityAmount: number;
  isLegacyAccount: boolean;
  legacyAccruedInt: number;
  lastInterestPostingDate?: string;
  status: string;
  nomineeName?: string;
  nomineeRelation?: string;
  remarks?: string;
}

const FdOpeningBalanceMigration: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [schemes, setSchemes] = useState<FdScheme[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [migratedAccounts, setMigratedAccounts] = useState<FdAccountRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showMigratedModal, setShowMigratedModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isManualMaturityEdited, setIsManualMaturityEdited] = useState(false);
  const [isManualMaturityDateEdited, setIsManualMaturityDateEdited] = useState(false);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const depositAmountInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api';

  const [formData, setFormData] = useState({
    branchID: 1,
    memberID: 0,
    fdSchemeID: 0,
    accountNo: '',
    openingDate: '',
    depositAmount: 0,
    interestRate: 0,
    maturityDate: '',
    maturityAmount: 0,
    legacyAccruedInt: 0,
    lastInterestPostingDate: '',
    nomineeName: '',
    nomineeRelation: '',
    remarks: '३१/०३/२०२६ पूर्वीचे चालू मुदत ठेव स्थलांतर',
  });

  useEffect(() => {
    fetchMembers();
    fetchSchemes();
    fetchBranches();
    fetchMigratedAccounts();
    fetchNextAccountNo(1);
  }, []);

  const fetchNextAccountNo = async (bId: number) => {
    try {
      const response = await axios.get(`${API_URL}/FdAccounts/next-account-no/${bId}`);
      if (response.data) {
        const nextNo = typeof response.data === 'string'
          ? response.data
          : (response.data.accountNo || response.data.nextAccountNo || response.data.receiptNo || '');
        if (nextNo) {
          setFormData((prev) => ({
            ...prev,
            accountNo: nextNo
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching next receipt number', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API_URL}/Branches`);
      setBranches(response.data);
      if (response.data.length > 0) {
        const firstBranchId = response.data[0].branchID;
        setFormData(prev => ({ ...prev, branchID: firstBranchId }));
        fetchNextAccountNo(firstBranchId);
      }
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API_URL}/Customers`);
      setMembers(response.data);
    } catch (err) {
      console.error('Error fetching customers', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      const response = await axios.get(`${API_URL}/FdSchemes`);
      setSchemes(response.data);
    } catch (err) {
      console.error('Error fetching schemes', err);
    }
  };

  const fetchMigratedAccounts = async () => {
    try {
      const response = await axios.get(`${API_URL}/FdAccounts`);
      const list = response.data.filter((a: any) => a.isLegacyAccount);
      setMigratedAccounts(list);
    } catch (err) {
      console.error('Error fetching migrated FD accounts', err);
    }
  };

  const getSchemeId = (s: any) => s?.fdSchemeID ?? s?.fdSchemeId ?? s?.FdSchemeID ?? 0;

  // [RULE-FD-010] Calendar and leap-year safe maturity date calculation (Timezone-safe)
  const calculateMaturityDate = (opDateStr: string, months: number): string => {
    if (!opDateStr || !months || months <= 0) return '';
    const parts = opDateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); // 1 to 12
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

    const totalMonths = year * 12 + (month - 1) + months;
    const targetYear = Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1; // 1 to 12

    // Find last day of target month to prevent overflow (e.g., Jan 31 + 1 month -> Feb 28 or 29)
    const maxDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(day, maxDaysInTargetMonth);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`;
  };

  // [RULE-FD-009] Scheme-specific maturity amount auto-calculation
  const calculateMaturityAmount = (
    p: number,
    r: number,
    opDateStr: string,
    matDateStr: string,
    scheme?: FdScheme
  ): number => {
    if (!p || p <= 0) return 0;
    if (!r || r <= 0) return Math.round(p);

    let months = 0;
    if (opDateStr && matDateStr) {
      const d1 = new Date(opDateStr);
      const d2 = new Date(matDateStr);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 > d1) {
        const yearsDiff = d2.getFullYear() - d1.getFullYear();
        months = yearsDiff * 12 + (d2.getMonth() - d1.getMonth());
        const dayDiff = d2.getDate() - d1.getDate();
        if (dayDiff !== 0) {
          months += dayDiff / 30;
        }
      }
    }

    if (months <= 0 && scheme?.durationMonths) {
      months = Number(scheme.durationMonths);
    }

    if (months <= 0) return Math.round(p);

    const type = (scheme?.interestType || '').toLowerCase();

    // 1. MIS / Monthly Interest: Maturity Amount = Principal (Interest already disbursed monthly)
    if (type.includes('mis') || type.includes('monthly')) {
      return Math.round(p);
    }

    const t = months / 12;

    // 2. Cumulative / Damduppat / Reinvestment: Quarterly (or configured frequency) compounding
    if (type.includes('cumulative') || type.includes('damduppat') || type.includes('चक्रवाढ') || (scheme?.schemeName || '').toLowerCase().includes('दाम')) {
      let n = 4; // default Quarterly
      const freq = (scheme?.interestCompoundingFrequency || '').toLowerCase();
      if (freq.includes('half') || freq.includes('2')) n = 2;
      if (freq.includes('year') || freq.includes('1')) n = 1;
      if (freq.includes('month') || freq.includes('12')) n = 12;

      const matAmt = p * Math.pow(1 + r / (n * 100), n * t);
      return Math.round(matAmt);
    }

    // 3. Simple Interest / General Payout
    const matAmt = p * (1 + (r * t) / 100);
    return Math.round(matAmt);
  };

  const handleSchemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = parseInt(e.target.value, 10) || 0;
    const selected = schemes.find((s: any) => getSchemeId(s) === sId);
    const newRate = selected ? Number(selected.interestRate) || 0 : 0;
    const months = selected ? Number(selected.durationMonths) || 0 : 0;

    let newMatDate = formData.maturityDate;
    // [RULE-FD-010] If scheme has durationMonths and openingDate is present, auto-calculate maturity date
    if (months > 0 && formData.openingDate && (!isManualMaturityDateEdited || !formData.maturityDate)) {
      newMatDate = calculateMaturityDate(formData.openingDate, months);
    }

    const autoMat = !isManualMaturityEdited
      ? calculateMaturityAmount(formData.depositAmount, newRate, formData.openingDate, newMatDate, selected)
      : formData.maturityAmount;

    setFormData((prev) => ({
      ...prev,
      fdSchemeID: sId,
      interestRate: newRate,
      maturityDate: newMatDate,
      maturityAmount: autoMat,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const parsedVal = name.includes('Amount') || name.includes('Rate') || name.includes('Int') || name === 'branchID'
      ? parseFloat(value) || 0
      : value;
    
    if (name === 'branchID') {
      fetchNextAccountNo(parsedVal as number);
    }

    if (name === 'maturityAmount') {
      setIsManualMaturityEdited(true);
      setFormData((prev) => ({
        ...prev,
        maturityAmount: parsedVal as number
      }));
      return;
    }

    if (name === 'maturityDate') {
      setIsManualMaturityDateEdited(true);
      setFormData((prev) => {
        const updated = {
          ...prev,
          maturityDate: value
        };
        // [RULE-FD-009] If user has not manually overridden maturityAmount, auto-calculate with new maturityDate
        if (!isManualMaturityEdited) {
          const selected = schemes.find((s: any) => getSchemeId(s) === updated.fdSchemeID);
          updated.maturityAmount = calculateMaturityAmount(
            Number(updated.depositAmount) || 0,
            Number(updated.interestRate) || 0,
            updated.openingDate,
            value,
            selected
          );
        }
        return updated;
      });
      return;
    }

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: parsedVal,
      };

      // [RULE-FD-010] Auto-suggest maturityDate if openingDate entered/changed and scheme has durationMonths
      if (name === 'openingDate' && parsedVal) {
        const selected = schemes.find((s: any) => getSchemeId(s) === updated.fdSchemeID);
        if (selected?.durationMonths) {
          updated.maturityDate = calculateMaturityDate(parsedVal as string, selected.durationMonths);
          setIsManualMaturityDateEdited(false);
        }
        // [RULE-FD-011] Auto-suggest lastInterestPostingDate to 31/03/2026 if opening date is before 01/04/2026
        if (!updated.lastInterestPostingDate && (parsedVal as string) < '2026-04-01') {
          updated.lastInterestPostingDate = '2026-03-31';
        }
      }

      // If user has not manually overridden maturityAmount, auto-calculate
      if (!isManualMaturityEdited && ['depositAmount', 'interestRate', 'openingDate', 'maturityDate'].includes(name)) {
        const selected = schemes.find((s: any) => getSchemeId(s) === updated.fdSchemeID);
        updated.maturityAmount = calculateMaturityAmount(
          Number(updated.depositAmount) || 0,
          Number(updated.interestRate) || 0,
          updated.openingDate,
          updated.maturityDate,
          selected
        );
      }

      return updated;
    });
  };

  const handleRecalculateMaturity = () => {
    const selected = schemes.find((s: any) => getSchemeId(s) === formData.fdSchemeID);
    const autoMat = calculateMaturityAmount(
      Number(formData.depositAmount) || 0,
      Number(formData.interestRate) || 0,
      formData.openingDate,
      formData.maturityDate,
      selected
    );
    setFormData((prev) => ({
      ...prev,
      maturityAmount: autoMat
    }));
    setIsManualMaturityEdited(false);
  };

  // [RULE-FD-010] Recalculate maturity date based on scheme duration
  const handleRecalculateMaturityDate = () => {
    const selected = schemes.find((s: any) => getSchemeId(s) === formData.fdSchemeID);
    if (selected?.durationMonths && formData.openingDate) {
      const autoMatDate = calculateMaturityDate(formData.openingDate, selected.durationMonths);
      setFormData((prev) => {
        const updated = {
          ...prev,
          maturityDate: autoMatDate
        };
        if (!isManualMaturityEdited) {
          updated.maturityAmount = calculateMaturityAmount(
            Number(updated.depositAmount) || 0,
            Number(updated.interestRate) || 0,
            updated.openingDate,
            autoMatDate,
            selected
          );
        }
        return updated;
      });
      setIsManualMaturityDateEdited(false);
    }
  };

  const resetForm = () => {
    setEditingAccountId(null);
    setIsManualMaturityEdited(false);
    setIsManualMaturityDateEdited(false);
    const bId = formData.branchID || 1;
    setFormData({
      branchID: bId,
      memberID: 0,
      fdSchemeID: 0,
      accountNo: '',
      openingDate: '',
      depositAmount: 0,
      interestRate: 0,
      maturityDate: '',
      maturityAmount: 0,
      legacyAccruedInt: 0,
      lastInterestPostingDate: '',
      nomineeName: '',
      nomineeRelation: '',
      remarks: '३१/०३/२०२६ पूर्वीचे चालू मुदत ठेव स्थलांतर',
    });
    fetchNextAccountNo(bId);
    setError('');
    setSuccess('');
  };

  const handleEdit = (acc: FdAccountRecord) => {
    setEditingAccountId(acc.fdAccountID);
    setIsManualMaturityEdited(true); // Preserve recorded value from database
    setIsManualMaturityDateEdited(true); // Preserve recorded maturity date from database
    setFormData({
      branchID: acc.branchID || 1,
      memberID: acc.memberID || 0,
      fdSchemeID: acc.fdSchemeID || 0,
      accountNo: acc.accountNo || '',
      openingDate: acc.openingDate ? acc.openingDate.split('T')[0] : '',
      depositAmount: acc.depositAmount || 0,
      interestRate: acc.interestRate || 0,
      maturityDate: acc.maturityDate ? acc.maturityDate.split('T')[0] : '',
      maturityAmount: acc.maturityAmount || 0,
      legacyAccruedInt: acc.legacyAccruedInt || 0,
      lastInterestPostingDate: acc.lastInterestPostingDate ? acc.lastInterestPostingDate.split('T')[0] : '',
      nomineeName: acc.nomineeName || '',
      nomineeRelation: acc.nomineeRelation || '',
      remarks: acc.remarks || '३१/०३/२०२६ पूर्वीचे चालू मुदत ठेव स्थलांतर',
    });
    setError('');
    setSuccess('');
    setShowMigratedModal(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      depositAmountInputRef.current?.focus();
      depositAmountInputRef.current?.select();
    }, 150);
  };

  const handleDelete = async (id: number, accNo: string) => {
    if (!window.confirm(`तुम्हाला खरोखर मुदत ठेव खाते '${accNo}' डिलीट करायचे आहे का?`)) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_URL}/FdAccounts/${id}`);
      setSuccess(`मुदत ठेव खाते '${accNo}' यशस्वीरित्या डिलीट केले.`);
      fetchMigratedAccounts();
      fetchNextAccountNo(formData.branchID);
      if (editingAccountId === id) {
        resetForm();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.response?.data || 'खाते डिलीट करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.memberID === 0) {
      setError('कृपया सभासद निवडा.');
      return;
    }
    if (formData.fdSchemeID === 0) {
      setError('कृपया ठेव योजना निवडा.');
      return;
    }
    if (!formData.openingDate) {
      setError('कृपया ठेव तारीख (Opening Date) टाका.');
      return;
    }
    if (!formData.maturityDate) {
      setError('कृपया मुदतपूर्ती तारीख (Maturity Date) टाका.');
      return;
    }
    if (new Date(formData.maturityDate) <= new Date(formData.openingDate)) {
      setError('[RULE-FD-010] मुदतपूर्ती तारीख (Maturity Date) ही ठेव तारखेपेक्षा (Opening Date) पुढील असणे आवश्यक आहे.');
      return;
    }

    const depAmt = Number(formData.depositAmount) || 0;
    if (depAmt <= 0) {
      setError('ठेव मुद्दल रक्कम ० पेक्षा जास्त असणे आवश्यक आहे.');
      return;
    }

    const selectedScheme = schemes.find((s: any) => getSchemeId(s) === Number(formData.fdSchemeID));
    let matAmt = Number(formData.maturityAmount) || 0;

    // Fallback to auto-calculated if 0 or empty
    if (matAmt <= 0) {
      matAmt = calculateMaturityAmount(
        depAmt,
        Number(formData.interestRate) || 0,
        formData.openingDate,
        formData.maturityDate,
        selectedScheme
      );
    }

    // [RULE-FD-009] Validation: Maturity Amount cannot be less than Principal
    const isMis = (selectedScheme?.interestType || '').toLowerCase().includes('mis');
    if (!isMis && matAmt < depAmt) {
      setError(`[RULE-FD-009] मुदतपूर्ती रक्कम (₹${matAmt}) ठेव मुद्दलापेक्षा (₹${depAmt}) कमी असू शकत नाही.`);
      return;
    }

    // [RULE-FD-001] Customer-First: resolve CustomerID
    const selectedCust = members.find((m: any) => (m.customerID || m.memberID) === Number(formData.memberID));
    const resolvedCustId = Number(selectedCust?.customerID || selectedCust?.id || formData.memberID);

    setLoading(true);
    try {
      const payload = {
        ...formData,
        customerID: resolvedCustId,
        depositAmount: depAmt,
        maturityAmount: matAmt,
        isLegacyAccount: true,
        status: 'Active'
      };

      if (editingAccountId) {
        await axios.put(`${API_URL}/FdAccounts/${editingAccountId}`, {
          fdAccountID: editingAccountId,
          ...payload
        });
        setSuccess('मुदत ठेव खात्याची माहिती यशस्वीरित्या अपडेट झाली!');
      } else {
        await axios.post(`${API_URL}/FdAccounts/Migrate`, payload);
        setSuccess('जुन्या मुदत ठेव खात्याचे स्थलांतर यशस्वीरित्या झाले!');
      }
      resetForm();
      fetchMigratedAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || 'माहिती जतन करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredAccounts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredAccounts.map((acc, i) => ({
      'अ.क्र.': i + 1,
      'पावती / खाते क्र.': acc.accountNo,
      'सभासद कोड': acc.memberCode || '-',
      'सभासदाचे नाव': acc.memberName || '-',
      'योजनेचे नाव': acc.schemeName || '-',
      'ठेव मुद्दल (₹)': acc.depositAmount || 0,
      'व्याजदर (%)': `${acc.interestRate || 0}%`,
      'मुदतपूर्ती रक्कम (₹)': acc.maturityAmount || 0,
      'शेवटची व्याज तारीख': acc.lastInterestPostingDate ? acc.lastInterestPostingDate.split('T')[0] : '-',
      'साचलेले जुने व्याज (₹)': acc.legacyAccruedInt || 0,
      'उघडल्याचा दिनांक': acc.openingDate ? acc.openingDate.split('T')[0] : '-',
      'मुदतपूर्ती दिनांक': acc.maturityDate ? acc.maturityDate.split('T')[0] : '-',
      'स्थिती': acc.status === 'Active' ? 'सक्रिय' : 'बंद'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FdOpeningBalances');
    XLSX.writeFile(wb, `FD_Opening_Balances_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatMemberLabel = (m: Member) => {
    const nameParts = [m.firstName, m.middleName, m.lastName].filter(Boolean);
    let fullName = nameParts.join(' ').trim();
    if (!fullName) {
      const engParts = [m.firstNameEng, m.middleNameEng, m.lastNameEng].filter(Boolean);
      fullName = engParts.join(' ').trim();
    }
    if (!fullName) fullName = `सभासद ID: ${m.memberID}`;

    const cifStr = m.cifNo ? `CIF: ${m.cifNo}` : '';
    const codeStr = m.memberCode ? `सभासद नं: ${m.memberCode}` : '';
    const oldNo = m.oldMemberCode || m.legacyMemberNo;
    const oldNoStr = oldNo ? `जुना नं: ${oldNo}` : '';

    const details = [cifStr, codeStr, oldNoStr].filter(Boolean).join(' | ');
    return details ? `${fullName} (${details})` : fullName;
  };

  const filteredAccounts = migratedAccounts.filter((acc) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (acc.accountNo && acc.accountNo.toLowerCase().includes(term)) ||
      (acc.memberName && acc.memberName.toLowerCase().includes(term)) ||
      (acc.memberCode && acc.memberCode.toLowerCase().includes(term)) ||
      (acc.schemeName && acc.schemeName.toLowerCase().includes(term))
    );
  });

  // KPI Calculations
  const totalDepositAmount = migratedAccounts.reduce((sum, a) => sum + (a.depositAmount || 0), 0);
  const totalAccruedInt = migratedAccounts.reduce((sum, a) => sum + (a.legacyAccruedInt || 0), 0);
  const avgRate = migratedAccounts.length > 0
    ? (migratedAccounts.reduce((sum, a) => sum + (a.interestRate || 0), 0) / migratedAccounts.length).toFixed(2)
    : '0.00';

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Landmark size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>मुदत ठेव सुरुवातीची शिल्लक स्थलांतर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(FD Opening Balance Migration)</span>
              {editingAccountId && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editingAccountId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              ३१ मार्च पूर्वीची जुनी मुदत ठेव खाती, पावती क्रमांक, मुद्दल रक्कम, व्याजदर व मुदतपूर्ती रक्कम स्थलांतर व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {editingAccountId && (
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
            title="नवीन फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchMigratedAccounts();
              setShowMigratedModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व स्थलांतरित मुदत ठेव यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदवलेली खाती पहा ({migratedAccounts.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण स्थलांतरित FD</div>
            <div className="text-sm font-black text-gray-900">{migratedAccounts.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण ठेव मुद्दल (₹)</div>
            <div className="text-sm font-black text-emerald-800">₹{totalDepositAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सरासरी व्याजदर</div>
            <div className="text-sm font-black text-indigo-950">{avgRate}% p.a.</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">साचलेले जुने व्याज (₹)</div>
            <div className="text-sm font-black text-amber-800">₹{totalAccruedInt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* MAIN SINGLE UNIFIED FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          editingAccountId ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Member & Scheme Details */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <UserCheck className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. शाखा, सभासद व ठेव योजना (Branch, Member & Scheme)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>शाखा (Branch)</label>
                <select name="branchID" value={formData.branchID} onChange={handleChange} className={inputClass}>
                  {branches.map((b) => (
                    <option key={b.branchID} value={b.branchID}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  सभासद निवडा (Member) <span className="text-red-500">*</span>
                </label>
                <MemberSearchSelect
                  members={members}
                  value={formData.memberID ? Number(formData.memberID) : ''}
                  onChange={(val) => setFormData(prev => ({ ...prev, memberID: val ? Number(val) : 0 }))}
                  placeholder="-- सभासद नाव, कोड किंवा मोबाईलने शोधा --"
                />
              </div>

              <div>
                <label className={labelClass}>
                  मुदत ठेव योजना (FD Scheme) <span className="text-red-500">*</span>
                </label>
                <select name="fdSchemeID" value={formData.fdSchemeID} onChange={handleSchemeChange} className={inputClass} required>
                  <option value="0">-- योजना निवडा --</option>
                  {schemes.map((s: any) => (
                    <option key={getSchemeId(s)} value={getSchemeId(s)}>
                      {s.schemeName} ({s.interestRate}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Deposit Amount, Rates & Dates */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <IndianRupee className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. ठेव मुद्दल, पावती क्र. व मुदतपूर्ती माहिती (Deposit & Maturity)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>पावती / खाते क्र. (Account / Receipt No) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="accountNo"
                  value={formData.accountNo}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold text-primary`}
                  placeholder="उदा. FD001"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>ठेव मुद्दल रक्कम (Deposit Amount ₹) <span className="text-red-500">*</span></label>
                <input
                  ref={depositAmountInputRef}
                  type="number"
                  name="depositAmount"
                  value={formData.depositAmount}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-mono font-bold text-emerald-700`}
                  min="1"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>व्याजदर (% p.a.) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold text-primary`}
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-[11px] font-bold text-gray-700">
                    मुदतपूर्ती रक्कम (Maturity ₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    {isManualMaturityEdited ? (
                      <span className="text-[9px] bg-amber-100 text-amber-900 px-1 py-0.2 rounded font-bold border border-amber-300" title="जुन्या छापील पावतीप्रमाणे मॅन्युअली बदललेले">
                        ✏️ मॅन्युअल
                      </span>
                    ) : (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold border border-emerald-300" title="सिस्टीमने आपोआप मोजलेले">
                        ⚡ ऑटो
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleRecalculateMaturity}
                      className="text-[10px] text-primary hover:text-primary-dark font-bold underline cursor-pointer flex items-center gap-0.5"
                      title="सूत्राप्रमाणे पुन्हा स्वयं-गणना करा"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>री-कॅल्क</span>
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    name="maturityAmount"
                    value={formData.maturityAmount || ''}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    className={`${inputClass} font-mono font-bold ${
                      isManualMaturityEdited ? 'text-amber-900 bg-amber-50/40 border-amber-300' : 'text-primary bg-blue-50/20'
                    }`}
                    placeholder="उदा. 65000"
                    required
                  />
                </div>
                {formData.maturityAmount > 0 && formData.depositAmount > 0 && (
                  <p className="text-[9px] text-gray-500 mt-0.5 flex justify-between font-medium">
                    <span>एकूण अंदाजित व्याज:</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      +₹{Math.max(0, formData.maturityAmount - formData.depositAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>ठेव तारीख (Opening Date) <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  name="openingDate"
                  value={formData.openingDate}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-[11px] font-bold text-gray-700">
                    मुदतपूर्ती तारीख (Maturity Date) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    {isManualMaturityDateEdited ? (
                      <span className="text-[9px] bg-amber-100 text-amber-900 px-1 py-0.2 rounded font-bold border border-amber-300" title="मॅन्युअली बदललेली तारीख">
                        ✏️ मॅन्युअल
                      </span>
                    ) : (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold border border-emerald-300" title="योजनेनुसार आलेली तारीख">
                        ⚡ योजनेनुसार {schemes.find((s: any) => getSchemeId(s) === formData.fdSchemeID)?.durationMonths ? `(${schemes.find((s: any) => getSchemeId(s) === formData.fdSchemeID)?.durationMonths} म.)` : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleRecalculateMaturityDate}
                      className="text-[10px] text-primary hover:text-primary-dark font-bold underline cursor-pointer flex items-center gap-0.5"
                      title="योजनेच्या कालावधीप्रमाणे पुन्हा तारीख आणा"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>री-कॅल्क</span>
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  name="maturityDate"
                  value={formData.maturityDate}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold ${
                    isManualMaturityDateEdited ? 'text-amber-900 bg-amber-50/40 border-amber-300' : 'text-primary bg-blue-50/20'
                  }`}
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className={labelClass}>
                    शेवटची व्याज तारीख (Last Int. Date)
                  </label>
                  {formData.lastInterestPostingDate && (
                    <span className="text-[9px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-bold border border-blue-300" title="नवीन वर्षात व्याज मोजण्याचा कट-ऑफ">
                      कट-ऑफ
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  name="lastInterestPostingDate"
                  value={formData.lastInterestPostingDate}
                  onChange={handleChange}
                  className={inputClass}
                  title="जुन्या सॉफ्टवेअरमध्ये ज्या तारखेपर्यंत व्याज झाले होते ती तारीख (उदा. 31/03/2026)"
                />
              </div>

              <div>
                <label className={labelClass}>साचलेले जुने व्याज (Accrued Int. ₹)</label>
                <input
                  type="number"
                  name="legacyAccruedInt"
                  value={formData.legacyAccruedInt}
                  onChange={handleChange}
                  className={`${inputClass} font-mono`}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Nominee & Remarks */}
          <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">३. वारसदार व शेरा (Nominee & Remarks)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className={labelClass}>वारसदाराचे नाव (Nominee Name)</label>
                <input
                  type="text"
                  name="nomineeName"
                  value={formData.nomineeName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. सुनीता रमेश पाटील"
                />
              </div>

              <div>
                <label className={labelClass}>वारसदाराशी नाते (Relation)</label>
                <input
                  type="text"
                  name="nomineeRelation"
                  value={formData.nomineeRelation}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. पत्नी / मुलगा"
                />
              </div>

              <div>
                <label className={labelClass}>शेरा (Remarks)</label>
                <input
                  type="text"
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. जुनी मुदत ठेव स्थलांतर"
                />
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{editingAccountId ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 ${
                editingAccountId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'जतन होत आहे...' : editingAccountId ? 'बदल सेव्ह करा (Update)' : 'मुदत ठेव स्थलांतर सेव्ह करा (Migrate FD)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: MIGRATED FD ACCOUNTS LIST                                   */}
      {/* ========================================================================= */}
      {showMigratedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>स्थलांतरित मुदत ठेव (FD) यादी (Migrated FD Accounts List)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredAccounts.length} खाती
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMigratedModal(false)}
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
                  placeholder="पावती क्र, नाव, कोड किंवा योजना शोधा..." 
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
                disabled={filteredAccounts.length === 0}
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">पावती क्र.</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">सभासद नाव & कोड</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">योजना नाव</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">ठेव मुद्दल (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">व्याजदर (%)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">शेवटची व्याज तारीख</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">मुदतपूर्ती दिनांक</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredAccounts.map((acc) => (
                      <tr key={acc.fdAccountID} className="hover:bg-primary/5 transition-colors">
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => handleEdit(acc)} 
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="खाते फॉर्ममध्ये लोड करा (Load in Form)"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>सुधारा</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleDelete(acc.fdAccountID, acc.accountNo)} 
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="खाते डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-mono font-bold text-primary">
                          {acc.accountNo}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-bold text-gray-900">{acc.memberName}</div>
                          <div className="text-[10px] text-gray-500 font-mono">कोड: {acc.memberCode || '-'}</div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium text-gray-800">
                          {acc.schemeName}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                          ₹{(acc.depositAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono">
                          {acc.interestRate}%
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono text-blue-700">
                          {acc.lastInterestPostingDate ? acc.lastInterestPostingDate.split('T')[0] : '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono text-gray-600">
                          {acc.maturityDate ? acc.maturityDate.split('T')[0] : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            acc.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {acc.status === 'Active' ? 'Active' : 'Closed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतेही स्थलांतरित मुदत ठेव खाते सापडले नाही.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex justify-between items-center text-xs shrink-0">
              <span className="text-gray-500 font-medium">
                टीप: 'सुधारा' वर क्लिक केल्यास खाते थेट मुख्य फॉर्ममध्ये संपादन करण्यासाठी लोड होईल.
              </span>
              <button
                type="button"
                onClick={() => setShowMigratedModal(false)}
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

export default FdOpeningBalanceMigration;
