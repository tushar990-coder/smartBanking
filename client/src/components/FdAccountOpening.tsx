import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import CustomerSearchSelect from './common/CustomerSearchSelect';
import { MemberOption } from './common/MemberSearchSelect';
import FdReceiptPrintModal from './FdReceiptPrintModal';

interface Member extends MemberOption {}

interface FdScheme {
  fdSchemeID: number;
  schemeName: string;
  schemeCode: string;
  interestRate: number;
  seniorCitizenInterestRate: number;
  durationMonths: number;
  interestType: string;
  interestCompoundingFrequency: string;
  minimumAmount: number;
  maximumAmount: number;
}

interface FdAccount {
  fdAccountID: number;
  accountNo: string;
  memberName: string;
  memberCode: string;
  schemeName: string;
  depositAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  nomineeName: string;
  paymentMode?: string;
}

const FdAccountOpening: React.FC = () => {
  const [view, setView] = useState<'form' | 'list'>('form');
  const [members, setMembers] = useState<Member[]>([]);
  const [schemes, setSchemes] = useState<FdScheme[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [bankLedgers, setBankLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Entry Mode: 'single' | 'bulk'
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('single');
  const [totalDepositAmount, setTotalDepositAmount] = useState<number | ''>(1000000);
  const [splitCount, setSplitCount] = useState<number | ''>(10);
  const [amountPerReceipt, setAmountPerReceipt] = useState<number | ''>(100000);

  // Payment Mode & Member SB Accounts State
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank' | 'Transfer'>('Cash');
  const [bankAccountLedgerID, setBankAccountLedgerID] = useState<number>(0);
  const [chequeNo, setChequeNo] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>('');
  const [memberSavingsAccounts, setMemberSavingsAccounts] = useState<any[]>([]);
  const [selectedSavingAccountID, setSelectedSavingAccountID] = useState<number>(0);

  // Next account number preview (branch-specific)
  const [nextAccountNo, setNextAccountNo] = useState('');
  const [loadingAccountNo, setLoadingAccountNo] = useState(false);

  // List view state
  const [fdList, setFdList] = useState<FdAccount[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [listError, setListError] = useState('');
  const [listSuccess, setListSuccess] = useState('');

  // Delete confirmation & print modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; accountNo: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedPrintAccount, setSelectedPrintAccount] = useState<any | null>(null);

  const API_URL = '/api';

  const [formData, setFormData] = useState({
    branchID: 1,
    memberID: 0,
    fdSchemeID: 0,
    openingDate: new Date().toISOString().split('T')[0],
    depositAmount: 50000,
    nomineeName: '',
    nomineeRelation: '',
    remarks: 'नवीन मुदत ठेव खाते उघडले (New FD Opened)',
    isSeniorCitizen: false,
  });

  const [calcData, setCalcData] = useState({
    interestRate: 0,
    durationMonths: 0,
    interestType: '',
    maturityDate: '',
    maturityAmount: 0,
  });

  useEffect(() => {
    fetchMembers();
    fetchSchemes();
    fetchBranches();
    fetchBankLedgers();
  }, []);

  useEffect(() => {
    fetchNextAccountNo(formData.branchID);
  }, [formData.branchID]);

  useEffect(() => {
    if (view === 'list') {
      fetchFdList();
    }
  }, [view]);

  // Fetch Member's Savings Accounts when memberID changes
  useEffect(() => {
    if (formData.memberID > 0) {
      fetchMemberSavingsAccounts(formData.memberID);
    } else {
      setMemberSavingsAccounts([]);
      setSelectedSavingAccountID(0);
    }
  }, [formData.memberID]);

  const fetchMemberSavingsAccounts = async (mId: number) => {
    try {
      const selected = members.find((m: any) => (m.customerID || m.memberID) === mId);
      const cId = selected?.customerID || mId;
      const memId = selected?.memberProfile?.memberID || selected?.memberID || mId;

      const response = await axios.get(`${API_URL}/SavingAccounts?customerId=${cId}&memberId=${memId}`);
      const accs = response.data || [];
      setMemberSavingsAccounts(accs);
      if (accs.length > 0) {
        setSelectedSavingAccountID(accs[0].savingAccountID || accs[0].savingAccountId || 0);
      } else {
        setSelectedSavingAccountID(0);
      }
    } catch (err) {
      console.error('Error fetching member savings accounts', err);
    }
  };

  const fetchBankLedgers = async () => {
    try {
      const response = await axios.get(`${API_URL}/Ledgers`);
      const allLedgers = response.data || [];
      const filteredBanks = allLedgers.filter((l: any) =>
        l.groupName?.toLowerCase().includes('bank') ||
        l.ledgerName?.toLowerCase().includes('bank') ||
        l.ledgerName?.includes('बँक') ||
        l.ledgerName?.includes('बेंक')
      );
      setBankLedgers(filteredBanks.length > 0 ? filteredBanks : allLedgers);
    } catch (err) {
      console.error('Error fetching bank ledgers', err);
    }
  };

  // Synchronize Bulk Split Amount Calculations
  const handleTotalAmountChange = (val: number | '') => {
    setTotalDepositAmount(val);
    if (val !== '' && splitCount !== '' && Number(splitCount) > 0) {
      setAmountPerReceipt(Math.round((Number(val) / Number(splitCount)) * 100) / 100);
    }
  };

  const handleSplitCountChange = (val: number | '') => {
    setSplitCount(val);
    if (val !== '' && totalDepositAmount !== '' && Number(val) > 0) {
      setAmountPerReceipt(Math.round((Number(totalDepositAmount) / Number(val)) * 100) / 100);
    }
  };

  const handleAmountPerReceiptChange = (val: number | '') => {
    setAmountPerReceipt(val);
    if (val !== '' && totalDepositAmount !== '' && Number(val) > 0) {
      setSplitCount(Math.max(1, Math.round(Number(totalDepositAmount) / Number(val))));
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API_URL}/Branches`);
      setBranches(response.data);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API_URL}/Customers`);
      setMembers(response.data);
      const params = new URLSearchParams(window.location.search);
      const memberIdStr = params.get('memberId');
      if (memberIdStr && response.data.length > 0) {
        const mId = parseInt(memberIdStr, 10);
        const matchedMember = response.data.find((m: any) => (m.customerID || m.memberID) === mId);
        if (matchedMember) {
          setFormData((prev) => ({ ...prev, memberID: mId }));
        }
      }
    } catch (err) {
      console.error('Error fetching customers', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      const response = await axios.get(`${API_URL}/FdSchemes`);
      const data = response.data || [];
      setSchemes(data);
      if (data.length > 0) {
        setFormData(prev => (prev.fdSchemeID === 0 ? { ...prev, fdSchemeID: getSchemeId(data[0]) } : prev));
      }
    } catch (err) {
      console.error('Error fetching schemes', err);
    }
  };

  const fetchNextAccountNo = async (branchId: number) => {
    setLoadingAccountNo(true);
    setNextAccountNo('');
    try {
      const response = await axios.get(`${API_URL}/FdAccounts/next-account-no/${branchId}`);
      setNextAccountNo(response.data);
    } catch (err) {
      setNextAccountNo('---');
    } finally {
      setLoadingAccountNo(false);
    }
  };

  const fetchFdList = async () => {
    setListLoading(true);
    setListError('');
    setListSuccess('');
    try {
      const response = await axios.get(`${API_URL}/FdAccounts?branchId=${formData.branchID}`);
      setFdList(response.data);
    } catch (err) {
      console.error('Error fetching FD list', err);
    } finally {
      setListLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setListError('');
    setListSuccess('');
    try {
      await axios.delete(`${API_URL}/FdAccounts/${deleteConfirm.id}`);
      setListSuccess(`✅ खाते '${deleteConfirm.accountNo}' यशस्वीरित्या डिलीट (Delete) केले.`);
      setDeleteConfirm(null);
      fetchFdList();
      fetchNextAccountNo(formData.branchID);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'Delete करताना त्रुटी आली.';
      setListError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const getSchemeId = (s: any) => s?.fdSchemeID ?? s?.fdSchemeId ?? s?.FdSchemeID ?? 0;

  const selectedScheme = schemes.find((s: any) => getSchemeId(s) === Number(formData.fdSchemeID));

  // Maturity calculations with ROUND UP (nearest whole rupee)
  useEffect(() => {
    const selected = schemes.find((s: any) => getSchemeId(s) === Number(formData.fdSchemeID));
    if (!selected) {
      setCalcData({ interestRate: 0, durationMonths: 0, interestType: '', maturityDate: '', maturityAmount: 0 });
      return;
    }
    const rate = Number(formData.isSeniorCitizen ? (selected.seniorCitizenInterestRate || selected.interestRate) : selected.interestRate) || 0;
    const months = Number(selected.durationMonths) || 0;
    const type = selected.interestType || 'Simple';

    let maturityDateStr = '';
    const opDate = new Date(formData.openingDate);
    if (!isNaN(opDate.getTime()) && months > 0) {
      const targetMonth = opDate.getMonth() + months;
      const targetDay = opDate.getDate();
      opDate.setMonth(targetMonth);
      if (opDate.getDate() !== targetDay) {
        opDate.setDate(0); // overflow fix
      }
      maturityDateStr = opDate.toISOString().split('T')[0];
    }

    const currentDepositAmt = entryMode === 'bulk' 
      ? (Number(amountPerReceipt) || 0) 
      : (parseFloat(formData.depositAmount as any) || 0);

    let matAmount = 0;
    const p = currentDepositAmt;
    if (p > 0 && months > 0) {
      const r = rate;
      const t = months / 12;
      if (type === 'Cumulative') {
        let n = 4;
        if (selected.interestCompoundingFrequency === 'Half-Yearly') n = 2;
        if (selected.interestCompoundingFrequency === 'Yearly') n = 1;
        if (selected.interestCompoundingFrequency === 'Monthly') n = 12;
        matAmount = p * Math.pow(1 + r / (n * 100), n * t);
      } else if (type === 'MIS' || type === 'Monthly Interest') {
        matAmount = p;
      } else {
        matAmount = p * (1 + (r * t) / 100);
      }
    }
    setCalcData({
      interestRate: rate,
      durationMonths: months,
      interestType: type,
      maturityDate: maturityDateStr,
      maturityAmount: Math.round(matAmount), // Round up to nearest whole rupee
    });
  }, [formData.depositAmount, formData.fdSchemeID, formData.openingDate, formData.isSeniorCitizen, entryMode, amountPerReceipt, schemes]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | any) => {
    const { name, value, type, checked } = e.target;
    let val: any = value;
    if (type === 'checkbox') {
      val = checked;
    } else if (name === 'depositAmount') {
      val = value === '' ? '' : value;
    } else if (name.endsWith('ID') || name === 'branchID' || name === 'fdSchemeID' || name === 'memberID') {
      val = value === '' ? '' : (parseInt(value, 10) || 0);
    }
    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.memberID === 0) { setError('कृपया सभासद निवडा.'); return; }
    if (formData.fdSchemeID === 0) { setError('कृपया ठेव योजना निवडा.'); return; }
    if (paymentMode === 'Bank' && bankAccountLedgerID === 0) { setError('कृपया बँक खातावणी लेजर निवडा.'); return; }
    if (paymentMode === 'Transfer') {
      if (selectedSavingAccountID === 0) {
        setError('कृपया वर्ग करण्यासाठी सभासदाचे बचत खाते निवडा.');
        return;
      }
      const requiredTotal = entryMode === 'bulk' ? (Number(totalDepositAmount) || 0) : (parseFloat(formData.depositAmount as any) || 0);
      const selectedSb = memberSavingsAccounts.find(a => (a.savingAccountID || a.savingAccountId) === selectedSavingAccountID);
      if (selectedSb && Number(selectedSb.currentBalance || 0) < requiredTotal) {
        setError(`अपुऱ्या शिल्लकेमुळे बचत खात्यातून वर्ग करता येणार नाही! निवडलेल्या बचत खात्यात फक्त ₹${Number(selectedSb.currentBalance).toLocaleString('en-IN', {minimumFractionDigits: 2})} शिल्लक आहेत (हवी असलेली एकूण रक्कम ₹${requiredTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}).`);
        return;
      }
    }

    setLoading(true);
    try {
      if (entryMode === 'single') {
        const depAmt = parseFloat(formData.depositAmount as any) || 0;
        if (depAmt <= 0) { setError('ठेव रक्कम ० पेक्षा जास्त असावी.'); setLoading(false); return; }

        const payload = {
          ...formData,
          customerID: Number(formData.memberID),
          memberID: Number(formData.memberID),
          depositAmount: depAmt,
          accountNo: 'AUTO',
          interestRate: calcData.interestRate,
          maturityDate: calcData.maturityDate,
          maturityAmount: calcData.maturityAmount,
          paymentMode: paymentMode,
          bankAccountLedgerID: paymentMode === 'Bank' ? bankAccountLedgerID : null,
          chequeNo: paymentMode === 'Bank' ? chequeNo : null,
          chequeDate: paymentMode === 'Bank' && chequeDate ? chequeDate : null,
          savingAccountID: paymentMode === 'Transfer' ? selectedSavingAccountID : null,
        };

        const response = await axios.post(`${API_URL}/FdAccounts`, payload);
        const createdNo = response.data.accountNo;
        setSuccess(`✅ मुदत ठेव खाते यशस्वीरित्या उघडले! (पावती क्र: ${createdNo})`);

      } else {
        // BULK SPLIT MODE
        const totalAmt = Number(totalDepositAmount) || 0;
        const count = Number(splitCount) || 0;
        const perReceipt = Number(amountPerReceipt) || 0;

        if (totalAmt <= 0) { setError('एकूण ठेव रक्कम ० पेक्षा जास्त असावी.'); setLoading(false); return; }
        if (count <= 0) { setError('पावत्यांची संख्या १ किंवा अधिक असावी.'); setLoading(false); return; }
        if (perReceipt <= 0) { setError('प्रति पावती रक्कम ० पेक्षा जास्त असावी.'); setLoading(false); return; }

        const bulkPayload = {
          branchID: formData.branchID,
          customerID: Number(formData.memberID),
          memberID: Number(formData.memberID),
          fdSchemeID: formData.fdSchemeID,
          openingDate: formData.openingDate,
          totalAmount: totalAmt,
          splitCount: count,
          amountPerReceipt: perReceipt,
          nomineeName: formData.nomineeName,
          nomineeRelation: formData.nomineeRelation,
          remarks: formData.remarks,
          isSeniorCitizen: formData.isSeniorCitizen,
          paymentMode: paymentMode,
          bankAccountLedgerID: paymentMode === 'Bank' ? bankAccountLedgerID : null,
          chequeNo: paymentMode === 'Bank' ? chequeNo : null,
          chequeDate: paymentMode === 'Bank' && chequeDate ? chequeDate : null,
          savingAccountID: paymentMode === 'Transfer' ? selectedSavingAccountID : null,
        };

        try {
          const response = await axios.post(`${API_URL}/FdAccounts/BulkCreate`, bulkPayload);
          setSuccess(`✅ ${response.data.message}`);
        } catch (bulkErr: any) {
          console.warn('BulkCreate endpoint fallback to sequential creation:', bulkErr);
          const createdNos: string[] = [];
          for (let i = 1; i <= count; i++) {
            const singleRes = await axios.post(`${API_URL}/FdAccounts`, {
              branchID: formData.branchID,
              memberID: formData.memberID,
              fdSchemeID: formData.fdSchemeID,
              openingDate: formData.openingDate,
              depositAmount: perReceipt,
              accountNo: 'AUTO',
              interestRate: calcData.interestRate,
              maturityDate: calcData.maturityDate,
              maturityAmount: calcData.maturityAmount,
              nomineeName: formData.nomineeName,
              nomineeRelation: formData.nomineeRelation,
              remarks: formData.remarks ? `${formData.remarks} (${i}/${count})` : `बल्क स्प्लिट मुदत ठेव पावती (${i}/${count})`,
              isSeniorCitizen: formData.isSeniorCitizen,
              paymentMode: paymentMode,
              bankAccountLedgerID: paymentMode === 'Bank' ? bankAccountLedgerID : null,
              chequeNo: paymentMode === 'Bank' ? chequeNo : null,
              chequeDate: paymentMode === 'Bank' && chequeDate ? chequeDate : null,
              savingAccountID: paymentMode === 'Transfer' ? selectedSavingAccountID : null,
            });
            if (singleRes.data?.accountNo) {
              createdNos.push(singleRes.data.accountNo);
            }
          }
          if (createdNos.length > 0) {
            const startNo = createdNos[0];
            const endNo = createdNos[createdNos.length - 1];
            setSuccess(`✅ एकूण ${createdNos.length} पावत्या यशस्वीरीत्या उघडल्या गेल्या! (पावती क्र. ${startNo} ते ${endNo})`);
          } else {
            throw bulkErr;
          }
        }
      }

      setFormData((prev) => ({
        ...prev,
        depositAmount: 50000,
        nomineeName: '',
        nomineeRelation: '',
        remarks: 'नवीन मुदत ठेव खाते उघडले (New FD Opened)',
      }));
      setChequeNo('');
      setChequeDate('');
      fetchNextAccountNo(formData.branchID);
      if (formData.memberID > 0) {
        fetchMemberSavingsAccounts(formData.memberID);
      }

    } catch (err: any) {
      console.error(err);
      if (err.response?.data) {
        if (typeof err.response.data === 'string') setError(err.response.data);
        else if (err.response.data.title) setError(err.response.data.title);
        else if (err.response.data.message) setError(err.response.data.message);
        else setError(JSON.stringify(err.response.data));
      } else {
        setError(err.message || 'खाते उघडताना त्रुटी आली.');
      }
    } finally {
      setLoading(false);
    }
  };

  const labelClass = 'block text-xs font-bold text-gray-700 mb-1';
  const inputClass = 'w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white shadow-sm transition-all';

  const filteredList = fdList.filter((fd) =>
    fd.accountNo?.toLowerCase().includes(listSearch.toLowerCase()) ||
    fd.memberName?.toLowerCase().includes(listSearch.toLowerCase()) ||
    fd.memberCode?.toLowerCase().includes(listSearch.toLowerCase()) ||
    fd.schemeName?.toLowerCase().includes(listSearch.toLowerCase())
  );

  const formatCurrency = (amount: number) =>
    `₹ ${Math.round(amount || 0).toLocaleString('en-IN')}`;

  // Standard Indian Core Banking Date Format DD/MM/YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusColor = (status: string) => {
    if (status === 'Active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Matured') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'Closed') return 'bg-slate-100 text-slate-600 border-slate-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
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

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
      {/* Outer Container matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden flex flex-col">

        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
              <span>🏦 नवीन मुदत ठेव खाते अर्ज (New FD Account Opening)</span>
            </h2>
            <p className="text-[10px] text-blue-100 font-normal">नवीन मुदत ठेव खाते नोंदणी, ऑटो-इंटरेस्ट कॅल्क्युलेशन आणि पावती जनरेशन</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView('form')}
              className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                view === 'form' ? 'bg-white text-primary font-bold border-white' : 'bg-blue-800/60 hover:bg-blue-800 text-white border-blue-400/40'
              }`}
            >
              <span>✍️ नवीन अर्ज (New Form)</span>
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                view === 'list' ? 'bg-white text-primary font-bold border-white' : 'bg-blue-800/60 hover:bg-blue-800 text-white border-blue-400/40'
              }`}
            >
              <span>👁️ खाती यादी ({fdList.length})</span>
            </button>
          </div>
        </div>

        {/* ==================== FORM VIEW ==================== */}
        {view === 'form' && (
          <div className="p-3">
            
            {/* Top Receipt Bar & Mode Selector */}
            <div className="bg-gray-50 p-2 rounded border border-gray-200 mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-700">आरंभिक ठेव पावती क्र. (FD Receipt No):</span>
                {loadingAccountNo ? (
                  <span className="text-xs text-blue-600 font-medium animate-pulse">क्रमांक तयार होत आहे...</span>
                ) : (
                  <span className="text-xs font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-mono">
                    {nextAccountNo || '---'}
                  </span>
                )}
              </div>

              {/* Mode Selection Pills */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-gray-300">
                <button
                  type="button"
                  onClick={() => setEntryMode('single')}
                  className={`px-2.5 py-0.5 text-xs font-bold rounded cursor-pointer transition ${
                    entryMode === 'single' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  एकेरी पावती (Single)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('bulk')}
                  className={`px-2.5 py-0.5 text-xs font-bold rounded cursor-pointer transition ${
                    entryMode === 'bulk' ? 'bg-blue-800 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  ✨ बल्क स्प्लिट (Bulk Split)
                </button>
              </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-sm text-xs mb-2">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-sm text-xs mb-2">{success}</div>}

            <form onSubmit={handleSubmit}>
              
              {/* Section 1: बेसिक व सभासद माहिती */}
              <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200 mb-3">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200 flex items-center justify-between">
                  <span>१. प्राथमिक व सभासद माहिती (Basic & Member Details)</span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.2 rounded">
                    {entryMode === 'bulk' ? 'बल्क स्प्लिट मोड' : 'एकेरी मोड'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">शाखा (Branch) *</label>
                    <select name="branchID" value={formData.branchID} onChange={handleChange} required
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                      {branches.map((b) => (
                        <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">खातेदार निवडा (Select Customer / CIF) *</label>
                    <CustomerSearchSelect
                      customers={members}
                      value={formData.memberID ? Number(formData.memberID) : ''}
                      onChange={(val) => handleChange({ target: { name: 'memberID', value: val ? Number(val) : 0 } })}
                      placeholder="-- खातेदार (CIF / नाव / मोबाईलने शोधा) --"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">मुदत ठेव योजना (FD Scheme) *</label>
                    <select name="fdSchemeID" value={formData.fdSchemeID} onChange={handleChange} required
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                      <option value="0">--- योजना निवडा ---</option>
                      {schemes.map((s: any) => (
                        <option key={getSchemeId(s)} value={getSchemeId(s)}>
                          {s.schemeName} ({s.schemeCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: ठेव रक्कम व मुदत माहिती */}
              <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200 mb-3">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200 flex items-center justify-between">
                  <span>२. ठेव रक्कम व मुदत गणित (Deposit & Calculations)</span>
                  {selectedScheme && (
                    <span className="text-[10px] font-bold text-blue-900 bg-blue-100 border border-blue-300 px-2 py-0.2 rounded">
                      मुदत: {selectedScheme.durationMonths} महिने ({selectedScheme.interestType})
                    </span>
                  )}
                </div>

                {entryMode === 'single' && (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">खाते उघडल्याची तारीख *</label>
                      <input type="date" name="openingDate" value={formData.openingDate} onChange={handleChange} required
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">ठेव रक्कम (Deposit Amount ₹) *</label>
                      <input type="number" name="depositAmount" value={formData.depositAmount} onChange={handleChange} onFocus={(e) => e.target.select()} required
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-blue-900" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वार्षिक व्याजदर (%)</label>
                      <input type="text" value={formData.fdSchemeID === 0 ? 'योजना निवडा' : `${calcData.interestRate} %`} readOnly
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-emerald-50 font-bold text-emerald-800 cursor-not-allowed border-emerald-200" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">मुदतपूर्ती तारीख (Maturity Date)</label>
                      <input type="text" value={calcData.maturityDate ? new Date(calcData.maturityDate).toLocaleDateString('en-GB') : (formData.fdSchemeID === 0 ? 'योजना निवडा' : '-')} readOnly
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-blue-50 font-bold text-blue-900 cursor-not-allowed border-blue-200 font-mono" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">अंदाजित मुदतपूर्ती रक्कम (Maturity ₹)</label>
                      <input type="text" value={formData.fdSchemeID === 0 ? 'योजना निवडा' : (calcData.maturityAmount > 0 ? `₹ ${Math.round(calcData.maturityAmount).toLocaleString('en-IN')}` : '₹ 0')} readOnly
                        className="w-full border border-emerald-300 rounded-sm px-2 py-1 text-xs bg-emerald-100 font-extrabold text-emerald-950 cursor-not-allowed font-mono shadow-2xs" />
                    </div>
                  </div>
                )}

                {entryMode === 'bulk' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">खाते उघडल्याची तारीख *</label>
                        <input type="date" name="openingDate" value={formData.openingDate} onChange={handleChange} required
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">एकूण ठेव रक्कम (Total ₹) *</label>
                        <input type="number" value={totalDepositAmount} onChange={(e) => handleTotalAmountChange(e.target.value === '' ? '' : parseFloat(e.target.value))} required
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-blue-900" />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">पावत्यांची संख्या (Count) *</label>
                        <input type="number" value={splitCount} onChange={(e) => handleSplitCountChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))} required min="1"
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-center" />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">प्रति पावती रक्कम (₹)</label>
                        <input type="number" value={amountPerReceipt} onChange={(e) => handleAmountPerReceiptChange(e.target.value === '' ? '' : parseFloat(e.target.value))} required
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-emerald-50 font-extrabold text-emerald-900 border-emerald-300" />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">प्रति पावती मुदतपूर्ती (₹)</label>
                        <input type="text" value={formData.fdSchemeID === 0 ? 'योजना निवडा' : (calcData.maturityAmount > 0 ? `₹ ${Math.round(calcData.maturityAmount).toLocaleString('en-IN')}` : '₹ 0')} readOnly
                          className="w-full border border-emerald-300 rounded-sm px-2 py-1 text-xs bg-emerald-100 font-extrabold text-emerald-950 cursor-not-allowed font-mono shadow-2xs" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Calculation Info Banner */}
                {selectedScheme && (
                  <div className="mt-2.5 p-2 bg-gradient-to-r from-emerald-50 via-slate-50 to-teal-50 border border-emerald-200 rounded flex flex-wrap justify-between items-center gap-2 text-xs shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📊</span>
                      <div>
                        <span className="font-bold text-slate-800">{selectedScheme.schemeName} ({selectedScheme.schemeCode})</span>
                        <span className="ml-2 text-[11px] text-slate-500 font-medium">मुदत: <b>{selectedScheme.durationMonths} महिने</b> | व्याज प्रकार: <b>{selectedScheme.interestType}</b></span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 font-semibold text-slate-700">
                      <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                        व्याजदर: <b className="text-emerald-700 font-bold">{calcData.interestRate} %</b> {formData.isSeniorCitizen && <span className="text-[10px] text-amber-700 bg-amber-100 px-1 rounded">(ज्येष्ठ नागरिक)</span>}
                      </span>
                      <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                        मुदतपूर्ती तारीख: <b className="text-indigo-950 font-bold">{calcData.maturityDate ? new Date(calcData.maturityDate).toLocaleDateString('en-GB') : '-'}</b>
                      </span>
                      <span className="bg-emerald-700 text-white px-3 py-1 rounded font-extrabold shadow-2xs">
                        {entryMode === 'bulk' ? `प्रति पावती मुदतपूर्ती: ₹ ${calcData.maturityAmount.toLocaleString('en-IN')}` : `एकूण मुदतपूर्ती: ₹ ${calcData.maturityAmount.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: भरणा पद्धत व वारसदार */}
              <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200 mb-3">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">
                  ३. भरणा पद्धत व वारसदार माहिती (Payment Mode & Nominee)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-end">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">भरणा प्रकार (Payment Mode) *</label>
                    <select value={paymentMode} onChange={(e: any) => setPaymentMode(e.target.value)}
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-blue-900">
                      <option value="Cash">💵 रोख (Cash)</option>
                      <option value="Bank">🏦 बँक ट्रान्सफर</option>
                      <option value="Transfer">🔄 बचत ट्रान्सफर</option>
                    </select>
                  </div>

                  {/* Reflecting Cash Ledger Badge */}
                  {paymentMode === 'Cash' && (
                    <div className="md:col-span-3">
                      <CashLedgerReflectBadge 
                        branchId={formData.branchID} 
                        transactionType="Deposit" 
                        customTitle="ठेव जमा होणारे रोख खाते (Cash Deposit Ledger)"
                      />
                    </div>
                  )}

                  {/* Conditional Fields for Bank Payment */}
                  {paymentMode === 'Bank' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">बँक लेजर निवडा *</label>
                        <select value={bankAccountLedgerID} onChange={(e) => setBankAccountLedgerID(parseInt(e.target.value, 10) || 0)} required
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-slate-800">
                          <option value={0}>-- बँक खाते लेजर निवडा --</option>
                          {bankLedgers.map((l: any) => (
                            <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">चेक / संदर्भ क्र. (Ref/Cheque No)</label>
                        <input type="text" value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} placeholder="चेक क्र. किंवा UTR"
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">चेक तारीख (Cheque Date)</label>
                        <input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)}
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white" />
                      </div>
                    </>
                  )}

                  {/* Conditional Fields for SB Transfer Payment */}
                  {paymentMode === 'Transfer' && (
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                        सभासदाचे बचत खाते निवडा (Select SB Account for Transfer) *
                      </label>
                      {memberSavingsAccounts.length > 0 ? (
                        <select
                          value={selectedSavingAccountID}
                          onChange={(e) => setSelectedSavingAccountID(parseInt(e.target.value, 10) || 0)}
                          required
                          className="w-full border border-emerald-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50 font-bold text-emerald-950"
                        >
                          {memberSavingsAccounts.map((acc: any) => {
                            const accId = acc.savingAccountID || acc.savingAccountId;
                            const bal = Number(acc.currentBalance || 0);
                            return (
                              <option key={accId} value={accId}>
                                {acc.accountNo} - {acc.memberName || 'बचत खाते'} | उपलब्ध शिल्लक: ₹ {bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <div className="p-1.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px] font-semibold flex items-center justify-between">
                          <span>⚠️ या सभासदाचे कोणतेही बचत खाते उघडलेले नाही!</span>
                          <span className="text-[10px] text-amber-700">कृपया रोख किंवा बँक पर्याय वापरा.</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वारसदाराचे नाव (Nominee Name)</label>
                    <input type="text" name="nomineeName" value={formData.nomineeName} onChange={handleChange}
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" placeholder="वारसदाराचे नाव" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वारसदाराशी नाते (Relation)</label>
                    <select name="nomineeRelation" value={formData.nomineeRelation} onChange={handleChange}
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                      <option value="">-- नाते निवडा --</option>
                      <option value="स्वतः (Self)">स्वतः (Self)</option>
                      <option value="पती (Husband)">पती (Husband)</option>
                      <option value="पत्नी (Wife)">पत्नी (Wife)</option>
                      <option value="मुलगा (Son)">मुलगा (Son)</option>
                      <option value="मुलगी (Daughter)">मुलगी (Daughter)</option>
                      <option value="वडील (Father)">वडील (Father)</option>
                      <option value="आई (Mother)">आई (Mother)</option>
                      <option value="भाऊ (Brother)">भाऊ (Brother)</option>
                      <option value="बहीण (Sister)">बहीण (Sister)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">शेरा (Remarks)</label>
                    <input type="text" name="remarks" value={formData.remarks} onChange={handleChange}
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" placeholder="शेरा टाका..." />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" name="isSeniorCitizen" checked={formData.isSeniorCitizen} onChange={handleChange}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300" />
                    <span>👴 सभासद ज्येष्ठ नागरिक (Senior Citizen) सवलत लागू करा</span>
                  </label>

                  {paymentMode === 'Transfer' && selectedSavingAccountID > 0 && (
                    <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                      💳 बचत खात्यातून एकूण वर्ग होणारी रक्कम: ₹ {(entryMode === 'bulk' ? (Number(totalDepositAmount) || 0) : (parseFloat(formData.depositAmount as any) || 0)).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Controls */}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1 rounded-sm shadow-xs text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span>💾 {entryMode === 'bulk' ? `बल्क पावत्या सेव्ह करा (${splitCount})` : 'मुदत ठेव खाते उघडा (Open FD)'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================== LIST VIEW ==================== */}
        {view === 'list' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>📊</span> उघडलेल्या मुदत ठेव खात्यांची यादी (FD Accounts List)
              </div>

              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="पावती क्र / नाव / कोड शोधा..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-sm">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                    <th className="px-3 py-2 text-left font-mono">पावती क्र. (Account No)</th>
                    <th className="px-3 py-2 text-left">सभासदाचे नाव & कोड</th>
                    <th className="px-3 py-2 text-left">ठेव योजना (Scheme)</th>
                    <th className="px-3 py-2 text-right">ठेव रक्कम (₹)</th>
                    <th className="px-3 py-2 text-center">व्याजदर</th>
                    <th className="px-3 py-2 text-center">भरणा पद्धत</th>
                    <th className="px-3 py-2 text-right">मुदतपूर्ती रक्कम (₹)</th>
                    <th className="px-3 py-2 text-center">तारीख</th>
                    <th className="px-3 py-2 text-center">स्थिती</th>
                    <th className="px-3 py-2 text-center w-20">कारवाई</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading ? (
                    <tr><td colSpan={10} className="text-center py-4 text-gray-400">लोड होत आहे...</td></tr>
                  ) : filteredList.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-4 text-gray-400">कोणतेही मुदत ठेव खाते सापडले नाही.</td></tr>
                  ) : (
                    filteredList.map((fd) => (
                      <tr key={fd.fdAccountID} className="hover:bg-emerald-50/50 border-b border-gray-100 transition-colors">
                        <td className="px-3 py-1.5 font-mono font-bold text-blue-900">{fd.accountNo}</td>
                        <td className="px-3 py-1.5 font-bold text-gray-800">{fd.memberName} <span className="text-[10px] text-gray-500 font-normal">({fd.memberCode})</span></td>
                        <td className="px-3 py-1.5 font-medium">{fd.schemeName}</td>
                        <td className="px-3 py-1.5 text-right font-extrabold text-emerald-800">{formatCurrency(fd.depositAmount)}</td>
                        <td className="px-3 py-1.5 text-center font-bold">{fd.interestRate}%</td>
                        <td className="px-3 py-1.5 text-center font-bold text-gray-700">{fd.paymentMode || 'Cash'}</td>
                        <td className="px-3 py-1.5 text-right font-extrabold text-blue-900">{formatCurrency(fd.maturityAmount)}</td>
                        <td className="px-3 py-1.5 text-center text-[10px]">{formatDate(fd.openingDate)}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`inline-block px-2 py-0.2 rounded-full text-[10px] font-bold ${getStatusColor(fd.status)}`}>
                            {fd.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedPrintAccount(fd)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            🖨️ प्रिंट
                          </button>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full space-y-4 shadow-xl border border-gray-200">
            <div className="flex items-center gap-3 text-red-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-bold text-base">खाते डिलीट करण्याची खात्री</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              तुम्हाला खरोखर मुदत ठेव खाते <strong>'{deleteConfirm.accountNo}'</strong> डिलीट करायचे आहे का?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs font-bold border rounded text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 text-xs font-bold bg-red-600 text-white rounded hover:bg-red-700 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'डिलीट होत आहे...' : 'होय, डिलीट करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {selectedPrintAccount && (
        <FdReceiptPrintModal
          account={selectedPrintAccount}
          onClose={() => setSelectedPrintAccount(null)}
        />
      )}
    </div>
  );
};

export default FdAccountOpening;
