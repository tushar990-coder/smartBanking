import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Repeat,
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
import SearchableSelect from './SearchableSelect';
import CustomerSearchSelect, { CustomerOption } from './common/CustomerSearchSelect';
import * as XLSX from 'xlsx';

interface Customer extends CustomerOption {}

interface RdScheme {
  rdSchemeID: number;
  schemeName: string;
  schemeCode: string;
  interestRate: number;
  durationMonths: number;
  installmentAmount: number;
  prematurePenaltyRate?: number;
  rdLiabilityLedger?: { ledgerName: string };
  interestExpenseLedger?: { ledgerName: string };
  isActive?: boolean;
}

interface Branch {
  branchID: number;
  branchName: string;
}

export default function RdOpeningBalanceMigration() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [schemes, setSchemes] = useState<RdScheme[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const [nextAccountNo, setNextAccountNo] = useState('');
  const [loadingAccountNo, setLoadingAccountNo] = useState(false);
  const [migratedAccounts, setMigratedAccounts] = useState<any[]>([]);
  const [showMigratedModal, setShowMigratedModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const installmentInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    branchID: 1,
    customerID: '',
    rdSchemeID: '',
    accountNo: 'AUTO',
    legacyAccountNumber: '',
    passbookNo: '',
    openingDate: new Date().toISOString().split('T')[0],
    installmentAmount: 0,
    durationMonths: 12,
    interestRate: 8.0,
    maturityDate: '',
    maturityAmount: 0,
    totalPaidInstallments: 0,
    totalDepositedAmount: 0,
    legacyAccruedInt: 0,
    nomineeName: '',
    nomineeRelation: '',
    remarks: 'जुन्या आरडी खात्याचे मायग्रेशन (Legacy Migration)',
  });

  const selectedCustomer = customers.find((c) => c && c.customerID != null && c.customerID.toString() === formData.customerID);

  const fetchNextAccountNo = async (branchId: number, schemeId?: string | number) => {
    setLoadingAccountNo(true);
    try {
      const q = schemeId ? `?branchId=${branchId}&schemeId=${schemeId}` : `?branchId=${branchId}`;
      const res = await axios.get(`/api/RdAccounts/next-account-no${q}`);
      const acc = res.data?.formattedAccountNo || res.data?.accountNo || (typeof res.data === 'string' ? res.data : '---');
      setNextAccountNo(acc);
    } catch (err) {
      console.error('Error fetching next account number', err);
      setNextAccountNo('---');
    } finally {
      setLoadingAccountNo(false);
    }
  };

  const fetchMigratedAccounts = async () => {
    try {
      const res = await axios.get('/api/RdAccounts');
      if (Array.isArray(res.data)) {
        setMigratedAccounts(res.data.filter((a: any) => a.isLegacyAccount));
      }
    } catch (err) {
      console.error('Error fetching migrated RD accounts', err);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; accNo: string } | null>(null);
  const [modalMessage, setModalMessage] = useState('');
  const [modalIsSuccess, setModalIsSuccess] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, accNo } = deleteTarget;

    try {
      setLoading(true);
      await axios.delete(`/api/RdAccounts/${id}`);
      const delMsg = `आरडी खाते '${accNo}' यशस्वीरीत्या डिलीट केले.`;
      setMessage(delMsg);
      setIsSuccess(true);
      setModalMessage(delMsg);
      setModalIsSuccess(true);
      setDeleteTarget(null);
      fetchMigratedAccounts();
      fetchNextAccountNo(formData.branchID || 1, formData.rdSchemeID);
      if (editingAccountId === id) {
        resetForm(true);
      }
    } catch (err: any) {
      console.error('Error deleting RD account', err);
      const errMsg = err.response?.data?.message || err.response?.data || 'खाते डिलीट करताना त्रुटी आली.';
      setMessage(errMsg);
      setIsSuccess(false);
      setModalMessage(errMsg);
      setModalIsSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [mRes, sRes, bRes] = await axios.all([
          axios.get('/api/Customers'),
          axios.get('/api/RdSchemes'),
          axios.get('/api/Branches'),
        ]);
        if (!isMounted) return;
        setCustomers(mRes.data || []);
        setSchemes((sRes.data || []).filter((s: any) => s.isActive !== false));
        setBranches(bRes.data || []);

        const defaultBranch = bRes.data?.length > 0 ? bRes.data[0].branchID : 1;
        fetchNextAccountNo(defaultBranch);
        fetchMigratedAccounts();

        const params = new URLSearchParams(window.location.search);
        const customerIdStr = params.get('customerId') || params.get('memberId');
        if (customerIdStr && mRes.data?.length > 0) {
          const cId = parseInt(customerIdStr, 10);
          const matchedCustomer = mRes.data.find((c: any) => c && (c.customerID === cId || c.memberID === cId));
          if (matchedCustomer && isMounted) {
            setFormData((prev) => ({
              ...prev,
              customerID: cId.toString()
            }));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const calculateAccruedInterest31March = (installment: number, annualRate: number, paidInstallments: number): number => {
    if (!installment || !paidInstallments || installment <= 0 || paidInstallments <= 0) return 0;
    const p = installment;
    const r = annualRate || 0;
    const k = paidInstallments;

    let totalAccrued = 0;
    for (let i = 1; i <= k; i++) {
      const monthsHeld = k - i + 1;
      const interestForInstallment = (p * r * monthsHeld) / (12 * 100);
      totalAccrued += interestForInstallment;
    }
    return Math.round(totalAccrued);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === 'branchID') {
        fetchNextAccountNo(parseInt(value, 10), prev.rdSchemeID);
      }

      if (name === 'installmentAmount' || name === 'totalPaidInstallments') {
        const inst = name === 'installmentAmount' ? parseFloat(value) || 0 : prev.installmentAmount;
        const count = name === 'totalPaidInstallments' ? parseInt(value, 10) || 0 : prev.totalPaidInstallments;
        updated.totalDepositedAmount = inst * count;

        const autoAccruedInt = calculateAccruedInterest31March(inst, updated.interestRate, count);
        updated.legacyAccruedInt = autoAccruedInt;
      }

      if (name === 'openingDate' || name === 'durationMonths') {
        const opening = new Date(name === 'openingDate' ? value : prev.openingDate);
        const duration = name === 'durationMonths' ? parseInt(value, 10) || 12 : prev.durationMonths;

        if (!isNaN(opening.getTime())) {
          opening.setMonth(opening.getMonth() + duration);
          updated.maturityDate = opening.toISOString().split('T')[0];
        }
      }

      return updated;
    });
  };

  const handleSchemeChange = (schemeId: string) => {
    fetchNextAccountNo(formData.branchID || 1, schemeId);
    const selected = schemes.find((s) => s.rdSchemeID.toString() === schemeId);
    if (selected) {
      setFormData((prev) => {
        const inst = selected.installmentAmount || prev.installmentAmount;
        const dur = selected.durationMonths || prev.durationMonths;
        const count = prev.totalPaidInstallments;

        let maturityDateStr = prev.maturityDate;
        if (prev.openingDate) {
          const opening = new Date(prev.openingDate);
          if (!isNaN(opening.getTime())) {
            opening.setMonth(opening.getMonth() + dur);
            maturityDateStr = opening.toISOString().split('T')[0];
          }
        }

        const p = inst;
        const r = selected.interestRate;
        const n = dur;

        let totalMat = 0;
        for (let k = 1; k <= n; k++) {
          const monthsInBank = n - k + 1;
          const factor = Math.pow(1.0 + (r / 400.0), monthsInBank / 3.0);
          totalMat += p * factor;
        }
        const expectedMaturity = Math.round(totalMat);
        const autoAccruedInt = calculateAccruedInterest31March(inst, r, count);

        return {
          ...prev,
          rdSchemeID: schemeId.toString(),
          installmentAmount: inst,
          durationMonths: dur,
          interestRate: selected.interestRate,
          maturityDate: maturityDateStr,
          totalDepositedAmount: inst * count,
          legacyAccruedInt: autoAccruedInt,
          maturityAmount: expectedMaturity,
        };
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        rdSchemeID: '',
        installmentAmount: 0,
        interestRate: 8.0,
      }));
    }
  };

  const resetForm = (keepMessage = false) => {
    setEditingAccountId(null);
    setFormData({
      branchID: formData.branchID || 1,
      customerID: '',
      rdSchemeID: '',
      accountNo: 'AUTO',
      legacyAccountNumber: '',
      passbookNo: '',
      openingDate: new Date().toISOString().split('T')[0],
      installmentAmount: 0,
      durationMonths: 12,
      interestRate: 8.0,
      maturityDate: '',
      maturityAmount: 0,
      totalPaidInstallments: 0,
      totalDepositedAmount: 0,
      legacyAccruedInt: 0,
      nomineeName: '',
      nomineeRelation: '',
      remarks: 'जुन्या आरडी खात्याचे मायग्रेशन (Legacy Migration)',
    });
    if (!keepMessage) {
      setMessage('');
    }
    fetchNextAccountNo(formData.branchID || 1);
  };

  const handleEdit = (acc: any) => {
    setEditingAccountId(acc.rdAccountID || acc.rdAccountId);
    setFormData({
      branchID: acc.branchID || 1,
      customerID: String(acc.customerID || acc.customerId || acc.memberID || ''),
      rdSchemeID: String(acc.rdSchemeID || ''),
      accountNo: acc.accountNo || 'AUTO',
      legacyAccountNumber: acc.legacyAccountNumber || '',
      passbookNo: acc.passbookNo || '',
      openingDate: acc.openingDate ? acc.openingDate.split('T')[0] : new Date().toISOString().split('T')[0],
      installmentAmount: acc.installmentAmount || 0,
      durationMonths: acc.durationMonths || 12,
      interestRate: acc.interestRate || 8.0,
      maturityDate: acc.maturityDate ? acc.maturityDate.split('T')[0] : '',
      maturityAmount: acc.maturityAmount || 0,
      totalPaidInstallments: acc.totalPaidInstallments || 0,
      totalDepositedAmount: acc.totalDepositedAmount || 0,
      legacyAccruedInt: acc.legacyAccruedInt || 0,
      nomineeName: acc.nomineeName || '',
      nomineeRelation: acc.nomineeRelation || '',
      remarks: acc.remarks || 'जुन्या आरडी खात्याचे मायग्रेशन (Legacy Migration)',
    });
    setMessage(`✏️ संपादन मोड: खाते क्र. '${acc.accountNo}' फॉर्ममध्ये लोड केले आहे. सुधारणा करून सेव्ह करा.`);
    setIsSuccess(true);
    setShowMigratedModal(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      installmentInputRef.current?.focus();
      installmentInputRef.current?.select();
    }, 150);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerID) {
      setMessage('कृपया खातेदार / ग्राहक निवडा.');
      setIsSuccess(false);
      return;
    }
    if (!formData.rdSchemeID) {
      setMessage('कृपया आरडी ठेव योजना निवडा.');
      setIsSuccess(false);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const payload = {
        branchID: parseInt(formData.branchID.toString(), 10),
        customerID: parseInt(formData.customerID, 10),
        rdSchemeID: parseInt(formData.rdSchemeID, 10),
        accountNo: editingAccountId ? formData.accountNo : 'AUTO',
        legacyAccountNumber: formData.legacyAccountNumber || null,
        passbookNo: formData.passbookNo || null,
        openingDate: formData.openingDate,
        installmentAmount: parseFloat(formData.installmentAmount.toString()) || 0,
        durationMonths: parseInt(formData.durationMonths.toString(), 10) || 12,
        interestRate: parseFloat(formData.interestRate.toString()) || 0,
        maturityDate: formData.maturityDate || null,
        maturityAmount: parseFloat(formData.maturityAmount.toString()) || 0,
        totalPaidInstallments: parseInt(formData.totalPaidInstallments.toString(), 10) || 0,
        totalDepositedAmount: parseFloat(formData.totalDepositedAmount.toString()) || 0,
        legacyAccruedInt: parseFloat(formData.legacyAccruedInt.toString()) || 0,
        nomineeName: formData.nomineeName || null,
        nomineeRelation: formData.nomineeRelation || null,
        remarks: formData.remarks || null,
        isLegacyAccount: true,
      };

      let successMsg = '';
      if (editingAccountId) {
        await axios.put(`/api/RdAccounts/${editingAccountId}`, {
          rdAccountID: editingAccountId,
          ...payload,
        });
        successMsg = `✅ आरडी खाते '${payload.accountNo}' ची माहिती यशस्वीरित्या अद्ययावत (Update) केली!`;
      } else {
        const response = await axios.post('/api/RdAccounts/Migrate', payload);
        const createdNo = response.data?.accountNo || nextAccountNo;
        successMsg = `✅ जुन्या आरडी खात्याचे मायग्रेशन यशस्वी झाले! नवीन खाते क्र.: ${createdNo}`;
      }

      resetForm(true);
      setMessage(successMsg);
      setIsSuccess(true);
      fetchMigratedAccounts();
      fetchNextAccountNo(formData.branchID || 1, formData.rdSchemeID);

      if (formContainerRef.current) {
        formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage(err.response?.data?.message || err.response?.data || 'माहिती जतन करताना त्रुटी आली.');
      setIsSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredAccounts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredAccounts.map((acc, i) => ({
      'अ.क्र.': i + 1,
      'खाते क्र.': acc.accountNo,
      'जुना खाते क्र.': acc.legacyAccountNumber || '-',
      'ग्राहक CIF': acc.cifNo || acc.customer?.cifNo || (acc.customerID ? `CUST-${acc.customerID}` : (acc.member?.memberCode || '-')),
      'खातेदाराचे नाव': acc.customerName || (acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : (acc.member ? `${acc.member.firstName} ${acc.member.lastName}` : '-')),
      'योजनेचे नाव': acc.rdScheme?.schemeName || '-',
      'हप्ता रक्कम (₹)': acc.installmentAmount || 0,
      'जमा हप्ते संख्या': acc.totalPaidInstallments || 0,
      'एकूण जमा मुद्दल (₹)': acc.totalDepositedAmount || 0,
      'साचलेले जुने व्याज (₹)': acc.legacyAccruedInt || 0,
      'व्याजदर (%)': `${acc.interestRate || 0}%`,
      'उघडल्याचा दिनांक': acc.openingDate ? acc.openingDate.split('T')[0] : '-',
      'मुदतपूर्ती दिनांक': acc.maturityDate ? acc.maturityDate.split('T')[0] : '-',
      'स्थिती': acc.status === 'Active' ? 'सक्रिय' : 'बंद'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RdOpeningBalances');
    XLSX.writeFile(wb, `RD_Opening_Balances_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredAccounts = migratedAccounts.filter((acc) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const custName = (acc.customerName || (acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : (acc.member ? `${acc.member.firstName} ${acc.member.lastName}` : ''))).toLowerCase();
    const cif = (acc.cifNo || acc.customer?.cifNo || (acc.customerID ? `cust-${acc.customerID}` : '') || (acc.member?.memberCode ? acc.member.memberCode : '')).toLowerCase();
    const accNo = acc.accountNo ? acc.accountNo.toLowerCase() : '';
    const legNo = acc.legacyAccountNumber ? acc.legacyAccountNumber.toLowerCase() : '';
    return accNo.includes(term) || legNo.includes(term) || custName.includes(term) || cif.includes(term);
  });

  // KPI Calculations
  const totalDeposited = migratedAccounts.reduce((sum, a) => sum + (a.totalDepositedAmount || 0), 0);
  const totalAccrued = migratedAccounts.reduce((sum, a) => sum + (a.legacyAccruedInt || 0), 0);
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
            <Repeat size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>आरडी जुन्या खात्यांचे स्थलांतर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(RD Legacy Account Migration)</span>
              {editingAccountId && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editingAccountId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              ३१ मार्च पूर्वीच्या जुन्या आरडी खात्यांचा डेटा, जमा हप्ते, मुद्दल व साचलेले व्याज स्थलांतर व्यवस्थापन
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
            title="सर्व स्थलांतरित आरडी यादी पॉप-अप मध्ये पहा"
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
            <Repeat className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण स्थलांतरित RD</div>
            <div className="text-sm font-black text-gray-900">{migratedAccounts.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण जमा मुद्दल (₹)</div>
            <div className="text-sm font-black text-emerald-800">₹{totalDeposited.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
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
            <div className="text-sm font-black text-amber-800">₹{totalAccrued.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`mb-3 p-3 border rounded-sm flex items-center gap-2.5 text-xs font-bold shadow-xs transition-all ${
          isSuccess ? 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-200' : 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-200'
        }`}>
          {isSuccess ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          <span className="flex-1 text-[12px]">{message}</span>
          <button onClick={() => setMessage('')} className="font-bold text-gray-500 hover:text-gray-800 text-base cursor-pointer px-1">×</button>
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
              <h2 className="text-xs font-bold text-primary">१. शाखा, खातेदार व आरडी योजना (Branch, Customer & Scheme)</h2>
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
                  खातेदार / ग्राहक निवडा (Select Customer / CIF) <span className="text-red-500">*</span>
                </label>
                <CustomerSearchSelect
                  customers={customers}
                  value={formData.customerID ? Number(formData.customerID) : ''}
                  onChange={(val) => setFormData(prev => ({ ...prev, customerID: val ? String(val) : '' }))}
                  placeholder="-- खातेदार (CIF / नाव / मोबाईलने शोधा) --"
                />
              </div>

              <div>
                <label className={labelClass}>
                  आरडी ठेव योजना (RD Scheme) <span className="text-red-500">*</span>
                </label>
                <select name="rdSchemeID" value={formData.rdSchemeID} onChange={(e) => handleSchemeChange(e.target.value)} className={inputClass} required>
                  <option value="">-- योजना निवडा --</option>
                  {schemes.map((s) => (
                    <option key={s.rdSchemeID} value={s.rdSchemeID}>
                      {s.schemeName} ({s.interestRate}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Installments, Amounts & Calculation */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <IndianRupee className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. हप्ता रक्कम, जमा हप्ते व शिल्लक तपशील (Installment & Balance Details)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>
                  खाते क्र. (Account No) <span className="text-gray-400 font-normal text-[10px]">(स्वयंचलित / Read Only)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="accountNo"
                    value={loadingAccountNo ? 'लोड होत आहे...' : (editingAccountId ? formData.accountNo : (nextAccountNo || '001-501-0000001-0'))}
                    readOnly
                    className={`${inputClass} font-mono font-bold text-primary bg-slate-100 border-slate-300 cursor-not-allowed select-none`}
                    title="सीबीएस खाते क्रमांक सिस्टीमद्वारे स्वयंचलित तयार होतो (बदलता येत नाही)"
                    required
                  />
                  <span className="absolute right-2 top-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300 pointer-events-none">
                    CBS Auto
                  </span>
                </div>
              </div>

              <div>
                <label className={labelClass}>जुना खाते क्र. (Old Legacy A/c No)</label>
                <input
                  type="text"
                  name="legacyAccountNumber"
                  value={formData.legacyAccountNumber}
                  onChange={handleChange}
                  className={`${inputClass} font-mono`}
                  placeholder="उदा. जुना RD-105"
                />
              </div>

              <div>
                <label className={labelClass}>मासिक हप्ता रक्कम (Installment ₹) <span className="text-red-500">*</span></label>
                <input
                  ref={installmentInputRef}
                  type="number"
                  name="installmentAmount"
                  value={formData.installmentAmount}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-mono font-bold text-primary`}
                  min="1"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>जमा झालेले हप्ते संख्या (Paid Counts) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  name="totalPaidInstallments"
                  value={formData.totalPaidInstallments}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-mono font-bold text-indigo-800`}
                  min="0"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>एकूण जमा मुद्दल (Deposited Amount ₹)</label>
                <input
                  type="number"
                  name="totalDepositedAmount"
                  value={formData.totalDepositedAmount}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold text-emerald-700 bg-slate-50`}
                  readOnly
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
                <label className={labelClass}>३१ मार्च पर्यंत साचलेले व्याज (Accrued Int ₹)</label>
                <input
                  type="number"
                  name="legacyAccruedInt"
                  value={formData.legacyAccruedInt}
                  onChange={handleChange}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className={labelClass}>अपेक्षित मुदतपूर्ती रक्कम (Maturity ₹)</label>
                <input
                  type="number"
                  name="maturityAmount"
                  value={formData.maturityAmount}
                  onChange={handleChange}
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>खाते उघडल्याचा दिनांक (Opening Date) <span className="text-red-500">*</span></label>
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
                <label className={labelClass}>मुदत (महिने - Duration) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  name="durationMonths"
                  value={formData.durationMonths}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold`}
                  min="1"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>मुदतपूर्ती दिनांक (Maturity Date)</label>
                <input
                  type="date"
                  name="maturityDate"
                  value={formData.maturityDate}
                  onChange={handleChange}
                  className={inputClass}
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
                  placeholder="उदा. रोहन विकास जगताप"
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
                  placeholder="उदा. मुलगा / पत्नी"
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
                  placeholder="उदा. जुन्या आरडी खात्याचे मायग्रेशन"
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
              <span>{loading ? 'जतन होत आहे...' : editingAccountId ? 'बदल सेव्ह करा (Update)' : 'आरडी खाते स्थलांतर सेव्ह करा (Migrate RD)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: MIGRATED RD ACCOUNTS LIST                                   */}
      {/* ========================================================================= */}
      {showMigratedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Repeat className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>स्थलांतरित आरडी (RD) यादी (Migrated RD Accounts List)</span>
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
                  placeholder="खाते क्र, जुना क्र, नाव किंवा कोड शोधा..." 
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

            {/* Modal Alert Message */}
            {modalMessage && (
              <div className={`mx-2.5 mt-2.5 p-2.5 border rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs ${
                modalIsSuccess ? 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-1 ring-emerald-300' : 'bg-rose-50 border-rose-300 text-rose-800 ring-1 ring-rose-300'
              }`}>
                {modalIsSuccess ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span className="flex-1">{modalMessage}</span>
                <button onClick={() => setModalMessage('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
              </div>
            )}

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-24">कृती</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">खाते क्र. & जुना क्र.</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">खातेदार नाव & CIF</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">हप्ता & जमा हप्ते</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">एकूण जमा मुद्दल (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">व्याजदर (%)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">मुदतपूर्ती दिनांक</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredAccounts.map((acc) => (
                      <tr key={acc.rdAccountID || acc.rdAccountId} className="hover:bg-primary/5 transition-colors">
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
                              onClick={() => setDeleteTarget({ id: acc.rdAccountID || acc.rdAccountId, accNo: acc.accountNo })} 
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="खाते डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-mono font-bold text-primary">{acc.accountNo}</div>
                          {acc.legacyAccountNumber && (
                            <div className="text-[10px] text-gray-500 font-mono">जुना: {acc.legacyAccountNumber}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-bold text-gray-900">
                            {acc.customerName || (acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : (acc.member ? `${acc.member.firstName} ${acc.member.lastName}` : '-'))}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            CIF: {acc.cifNo || acc.customer?.cifNo || (acc.customerID ? `CUST-${acc.customerID}` : (acc.member?.memberCode || '-'))}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right">
                          <div className="font-bold text-gray-800 font-mono">₹{acc.installmentAmount}</div>
                          <div className="text-[10px] text-gray-500">{acc.totalPaidInstallments} हप्ते जमा</div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                          ₹{(acc.totalDepositedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono">
                          {acc.interestRate}%
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
                          कोणतेही स्थलांतरित आरडी खाते सापडले नाही.
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-rose-200 max-w-md w-full p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-600 border-b border-rose-100 pb-2">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-gray-900">खाते डिलीट करण्याची खात्री करा (Confirm Delete)</h3>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              तुम्हाला नक्की आरडी खाते क्रमांक <strong className="font-mono text-primary font-bold">{deleteTarget.accNo}</strong> डिलीट करायचे आहे का?
            </p>
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 font-medium">
              ⚠️ हे खाते डिलीट केल्यास त्याच्याशी संबंधित सर्व सुरुवातीचे व्यवहार, हप्ते व वेळापत्रक कायमचे हटवले जाईल.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-all cursor-pointer"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={confirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{loading ? 'हटवत आहे...' : 'होय, डिलीट करा (Delete)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
