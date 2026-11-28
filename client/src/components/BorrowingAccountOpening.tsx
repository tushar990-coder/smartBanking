import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Building2,
  PlusCircle,
  Calculator,
  Save,
  Trash2,
  ArrowRightCircle,
  Edit2,
  X
} from 'lucide-react';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';

interface BorrowingAccountOpeningProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const BORROWING_TYPES = [
  { id: 'GOLD_REPLEDGE', label: '🏅 सोने तारण पुनर्गहाण कर्ज (Gold Re-pledge Refinance)' },
  { id: 'TERM_LOAN', label: '🏦 सामान्य मुदत कर्ज (Term Loan / Refinance)' },
  { id: 'CASH_CREDIT_OD', label: '💳 कॅश क्रेडिट / ओव्हरड्राफ्ट (CC / OD Revolving Limit)' },
  { id: 'FD_AGAINST_LOAN', label: '📜 संस्थेच्या मुदत ठेवीवर कर्ज (Loan Against Sanstha FD)' }
];

const INSTALLMENT_TYPES = [
  { id: 'EMI', label: 'समान हप्ता — मुद्दल + व्याज एकत्र (Reducing EMI)' },
  { id: 'EqualPrincipal', label: 'समान मुद्दल + घटत्या शिल्लकेवर व्याज (Equal Principal)' },
  { id: 'Flat', label: 'फ्लॅट व्याज पद्धत (Flat Rate EMI)' },
  { id: 'Bullet', label: 'बुलेट परतफेड — शेवटच्या हप्त्यात मुद्दल (Bullet / Gold Loan)' }
];

const FREQUENCIES = [
  { id: 'Monthly', label: 'मासिक (Monthly)' },
  { id: 'Quarterly', label: 'त्रैमासिक (Quarterly)' },
  { id: 'HalfYearly', label: 'सहामाही (Half-Yearly)' },
  { id: 'Yearly', label: 'वार्षिक (Yearly)' },
  { id: 'Bullet', label: 'मुदतीअंती एकगठ्ठा (Single Maturity Bullet)' }
];

const fmtAmt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BorrowingAccountOpening({ onNavigate }: BorrowingAccountOpeningProps) {
  const { user } = useAuth();
  const activeBizDate = getBusinessDateStr(user?.businessDate);

  const [institutions, setInstitutions] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [investmentAccounts, setInvestmentAccounts] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Schedule Preview
  const [schedulePreview, setSchedulePreview] = useState<any>(null);

  // Quick Add Institution Modal
  const [showInstModal, setShowInstModal] = useState(false);
  const [newInst, setNewInst] = useState({
    institutionName: '',
    institutionType: 'Bank',
    institutionBranchName: '',
    contactPerson: '',
    mobileNumber: ''
  });

  const [form, setForm] = useState({
    lenderInstitutionID: '',
    lenderName: '',
    lenderBranchName: '',
    externalLoanAccountNo: '',
    sanctionLetterNo: '',
    borrowingType: 'GOLD_REPLEDGE',
    pledgedInvestmentAccountID: '',
    sanctionDate: activeBizDate,
    maturityDate: '',
    sanctionedAmount: '',
    borrowingInterestRate: '9.00',
    penalInterestRate: '0',
    installmentType: 'EMI',
    installmentFrequency: 'Monthly',
    tenureMonths: '12',
    totalInstallments: '12',
    moratoriumMonths: '0',
    firstInstallmentDueDate: '',
    installmentAmount: '',
    borrowingLiabilityLedgerID: '',
    interestExpenseLedgerID: '',
    processingChargesLedgerID: '',
    purposeOrLinkedLoansNote: '',
    remarks: '',
    isOpeningBalance: false,
    openingDisbursementDate: activeBizDate,
    openingDisbursedAmount: '',
    openingOutstandingPrincipal: '',
    lastInterestPaidDate: activeBizDate
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mstRes, accRes] = await Promise.all([
        axios.get('/api/Borrowings/masters'),
        axios.get('/api/Borrowings', { params: { status: 'all' } })
      ]);
      const m = mstRes.data || {};
      setInstitutions(m.institutions || []);
      setLedgers(m.ledgers || []);
      setInvestmentAccounts(m.investmentAccounts || []);
      setAccountsList(accRes.data?.items || []);

      const liabLedgers = (m.ledgers || []).filter(
        (l: any) =>
          (l.natureOfGroup || '').toLowerCase() === 'liabilities' &&
          ((l.ledgerName || '').includes('देणे कर्ज') || (l.ledgerName || '').toLowerCase().includes('borrow'))
      );
      const expLedgers = (m.ledgers || []).filter(
        (l: any) =>
          (l.natureOfGroup || '').toLowerCase() === 'expenses' &&
          ((l.ledgerName || '').includes('व्याज') || (l.ledgerName || '').toLowerCase().includes('interest'))
      );

      setForm((prev) => ({
        ...prev,
        borrowingLiabilityLedgerID: prev.borrowingLiabilityLedgerID || (liabLedgers[0] ? String(liabLedgers[0].ledgerID) : ''),
        interestExpenseLedgerID: prev.interestExpenseLedgerID || (expLedgers[0] ? String(expLedgers[0].ledgerID) : '')
      }));
    } catch (err) {
      toast.error('मास्टर्स लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-calculate total installments when tenure or frequency changes
  useEffect(() => {
    const tenure = Math.max(1, parseInt(form.tenureMonths || '12', 10) || 12);
    const morat = Math.max(0, parseInt(form.moratoriumMonths || '0', 10) || 0);
    if (form.installmentFrequency === 'Bullet') {
      setForm((p) => ({ ...p, totalInstallments: '1' }));
      return;
    }
    const step =
      form.installmentFrequency === 'Quarterly' ? 3 :
      form.installmentFrequency === 'HalfYearly' ? 6 :
      form.installmentFrequency === 'Yearly' ? 12 : 1;
    const calcN = Math.max(1, Math.floor(Math.max(1, tenure - morat) / step));
    setForm((p) => ({ ...p, totalInstallments: String(calcN) }));
  }, [form.tenureMonths, form.installmentFrequency, form.moratoriumMonths]);

  const liabilityLedgerOptions = useMemo<SearchableSelectOption[]>(() => {
    return ledgers
      .filter((l) => {
        const acct = (l.accountType || '').toLowerCase();
        if (acct.includes('cash') || acct.includes('bank')) return false;
        return (l.natureOfGroup || '').toLowerCase() === 'liabilities';
      })
      .map((l) => ({
        value: String(l.ledgerID),
        label: `${l.ledgerName} (#${l.ledgerID})`,
        subLabel: l.groupName ? `गट: ${l.groupName}` : undefined,
        badge: 'Liabilities (देयता)'
      }));
  }, [ledgers]);

  const expenseLedgerOptions = useMemo<SearchableSelectOption[]>(() => {
    return ledgers
      .filter((l) => {
        const acct = (l.accountType || '').toLowerCase();
        if (acct.includes('cash') || acct.includes('bank')) return false;
        return (l.natureOfGroup || '').toLowerCase() === 'expenses';
      })
      .map((l) => ({
        value: String(l.ledgerID),
        label: `${l.ledgerName} (#${l.ledgerID})`,
        subLabel: l.groupName ? `गट: ${l.groupName}` : undefined,
        badge: 'Expenses (खर्च)'
      }));
  }, [ledgers]);

  const handlePreviewSchedule = async () => {
    const principal = form.isOpeningBalance
      ? parseFloat(form.openingOutstandingPrincipal || form.sanctionedAmount || '0')
      : parseFloat(form.sanctionedAmount || '0');
    if (principal <= 0) {
      toast.error('हप्ता वेळापत्रक पाहण्यासाठी प्रथम मंजूर कर्ज रक्कम प्रविष्ट करा.');
      return;
    }
    try {
      const res = await axios.post('/api/Borrowings/preview-schedule', {
        principalAmount: principal,
        annualInterestRate: parseFloat(form.borrowingInterestRate || '0'),
        installmentType: form.installmentType,
        installmentFrequency: form.installmentFrequency,
        tenureMonths: parseInt(form.tenureMonths || '12', 10),
        totalInstallments: parseInt(form.totalInstallments || '12', 10),
        moratoriumMonths: parseInt(form.moratoriumMonths || '0', 10),
        disbursementDate: form.sanctionDate,
        firstInstallmentDueDate: form.firstInstallmentDueDate || null,
        customInstallmentAmount: parseFloat(form.installmentAmount || '0') > 0 ? parseFloat(form.installmentAmount) : null
      });
      setSchedulePreview(res.data);
    } catch (err: any) {
      toast.error(err.response?.data || 'हप्ता वेळापत्रक तयार करताना त्रुटी आली.');
    }
  };

  const handleSaveInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInst.institutionName.trim()) return;
    try {
      const res = await axios.post('/api/Borrowings/lender-institutions', {
        branchID: Number(user?.branchID || 1),
        ...newInst
      });
      const created = res.data?.institution;
      if (created) {
        setInstitutions((prev) => [...prev, created]);
        setForm((prev) => ({
          ...prev,
          lenderInstitutionID: String(created.institutionID),
          lenderName: created.institutionName,
          lenderBranchName: created.institutionBranchName || ''
        }));
      }
      setShowInstModal(false);
      setNewInst({ institutionName: '', institutionType: 'Bank', institutionBranchName: '', contactPerson: '', mobileNumber: '' });
      toast.success('बँक / पतसंस्था यशस्वीरीत्या जोडली!');
    } catch (err: any) {
      toast.error(err.response?.data || 'संस्था जतन करताना त्रुटी आली.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lenderName.trim() && !form.lenderInstitutionID) {
      toast.error('कृपया कर्ज देणारी बँक / पतसंस्था निवडा.');
      return;
    }
    if (parseFloat(form.sanctionedAmount || '0') <= 0) {
      toast.error('कृपया मंजूर कर्ज रक्कम प्रविष्ट करा.');
      return;
    }
    if (!form.borrowingLiabilityLedgerID || !form.interestExpenseLedgerID) {
      toast.error('कृपया देणे कर्ज मुद्दल लेजर आणि व्याज खर्च लेजर निवडा.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        branchID: Number(user?.branchID || 1),
        lenderInstitutionID: form.lenderInstitutionID ? Number(form.lenderInstitutionID) : null,
        lenderName: form.lenderName,
        lenderBranchName: form.lenderBranchName,
        externalLoanAccountNo: form.externalLoanAccountNo,
        sanctionLetterNo: form.sanctionLetterNo,
        borrowingType: form.borrowingType,
        pledgedInvestmentAccountID: form.borrowingType === 'FD_AGAINST_LOAN' && form.pledgedInvestmentAccountID ? Number(form.pledgedInvestmentAccountID) : null,
        sanctionDate: form.sanctionDate,
        maturityDate: form.maturityDate || null,
        sanctionedAmount: parseFloat(form.sanctionedAmount || '0'),
        borrowingInterestRate: parseFloat(form.borrowingInterestRate || '0'),
        penalInterestRate: parseFloat(form.penalInterestRate || '0'),
        interestCalculationMethod: 'Reducing',
        installmentType: form.installmentType,
        installmentFrequency: form.installmentFrequency,
        tenureMonths: parseInt(form.tenureMonths || '12', 10),
        totalInstallments: parseInt(form.totalInstallments || '12', 10),
        moratoriumMonths: parseInt(form.moratoriumMonths || '0', 10),
        firstInstallmentDueDate: form.firstInstallmentDueDate || null,
        installmentAmount: parseFloat(form.installmentAmount || '0'),
        borrowingLiabilityLedgerID: Number(form.borrowingLiabilityLedgerID),
        interestExpenseLedgerID: Number(form.interestExpenseLedgerID),
        processingChargesLedgerID: form.processingChargesLedgerID ? Number(form.processingChargesLedgerID) : null,
        purposeOrLinkedLoansNote: form.purposeOrLinkedLoansNote,
        remarks: form.remarks,
        isOpeningBalance: form.isOpeningBalance,
        openingDisbursementDate: form.isOpeningBalance ? form.openingDisbursementDate : null,
        openingDisbursedAmount: form.isOpeningBalance ? parseFloat(form.openingDisbursedAmount || form.sanctionedAmount || '0') : 0,
        openingOutstandingPrincipal: form.isOpeningBalance ? parseFloat(form.openingOutstandingPrincipal || '0') : 0,
        lastInterestPaidDate: form.isOpeningBalance ? form.lastInterestPaidDate : null
      };

      if (editId) {
        const res = await axios.put(`/api/Borrowings/accounts/${editId}`, payload);
        toast.success(res.data?.message || 'खाते अद्ययावत झाले!');
        setEditId(null);
      } else {
        const res = await axios.post('/api/Borrowings/accounts', payload);
        toast.success(res.data?.message || 'बाह्य कर्ज खाते यशस्वीरीत्या उघडले!');
      }

      setSchedulePreview(null);
      setForm((prev) => ({
        ...prev,
        externalLoanAccountNo: '',
        sanctionLetterNo: '',
        sanctionedAmount: '',
        installmentAmount: '',
        purposeOrLinkedLoansNote: '',
        remarks: '',
        isOpeningBalance: false,
        openingDisbursedAmount: '',
        openingOutstandingPrincipal: ''
      }));
      await loadData();
    } catch (err: any) {
      toast.error(typeof err.response?.data === 'string' ? err.response.data : 'खाते सेव्ह करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (b: any) => {
    setEditId(b.borrowingID);
    setForm((prev) => ({
      ...prev,
      lenderInstitutionID: b.lenderInstitutionID ? String(b.lenderInstitutionID) : '',
      lenderName: b.lenderName || '',
      lenderBranchName: b.lenderBranchName || '',
      externalLoanAccountNo: b.externalLoanAccountNo || '',
      sanctionLetterNo: b.sanctionLetterNo || '',
      borrowingType: b.borrowingType || 'GOLD_REPLEDGE',
      pledgedInvestmentAccountID: b.pledgedInvestmentAccountID ? String(b.pledgedInvestmentAccountID) : '',
      sanctionDate: b.sanctionDate ? b.sanctionDate.split('T')[0] : activeBizDate,
      maturityDate: b.maturityDate ? b.maturityDate.split('T')[0] : '',
      sanctionedAmount: String(b.sanctionedAmount || ''),
      borrowingInterestRate: String(b.borrowingInterestRate || '9'),
      penalInterestRate: String(b.penalInterestRate || '0'),
      installmentType: b.installmentType || 'EMI',
      installmentFrequency: b.installmentFrequency || 'Monthly',
      tenureMonths: String(b.tenureMonths || 12),
      totalInstallments: String(b.totalInstallments || 12),
      moratoriumMonths: String(b.moratoriumMonths || 0),
      firstInstallmentDueDate: b.firstInstallmentDueDate ? b.firstInstallmentDueDate.split('T')[0] : '',
      installmentAmount: b.installmentAmount ? String(b.installmentAmount) : '',
      borrowingLiabilityLedgerID: String(b.borrowingLiabilityLedgerID || ''),
      interestExpenseLedgerID: String(b.interestExpenseLedgerID || ''),
      processingChargesLedgerID: b.processingChargesLedgerID ? String(b.processingChargesLedgerID) : '',
      purposeOrLinkedLoansNote: b.purposeOrLinkedLoansNote || '',
      remarks: b.remarks || ''
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (b: any) => {
    if (!window.confirm(`मंजूर बाह्य कर्ज खाते '${b.borrowingNo}' हटवायचे का?`)) return;
    try {
      await axios.delete(`/api/Borrowings/accounts/${b.borrowingID}`);
      toast.success('खाते हटवले गेले.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data || 'खाते हटवता आले नाही.');
    }
  };

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Header */}
      <div className="bg-primary px-3.5 py-2.5 text-white rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Building2 size={18} />
          <div>
            <h1 className="text-sm md:text-base font-bold">
              १. बाह्य कर्ज खाते उघडणे व मंजुरी मास्टर (Borrowing Account Opening &amp; Sanction)
            </h1>
            <p className="text-[10.5px] text-amber-100">
              बँक / पतसंस्थेकडील मंजूर कर्ज खाते तयार करा, हप्त्यांच्या अटी व GL लेजर मॅपिंग निश्चित करा
            </p>
          </div>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('borrowing-disbursement')}
            className="px-3 py-1 rounded bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>पुढील टप्पा: २. रक्कम उचल (Disbursement) →</span>
          </button>
        )}
      </div>

      {/* Account Creation Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-300 rounded-sm p-3.5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b pb-1.5">
          <span className="font-bold text-primary text-xs">
            {editId ? '✏️ बाह्य कर्ज खाते संपादन (Edit Account)' : '➕ नवीन बाह्य कर्ज खाते नोंदणी (Create Borrowing Account)'}
          </span>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded border border-amber-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isOpeningBalance}
              disabled={!!editId}
              onChange={(e) => setForm((p) => ({ ...p, isOpeningBalance: e.target.checked }))}
            />
            <span>जूने चालू बाह्य कर्ज (Go-Live Opening Balance)</span>
          </label>
        </div>

        {/* Section 1: Lender & Loan Type */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-0.5">
              <label className="font-bold text-slate-700">कर्ज देणारी बँक / पतसंस्था निवडा *</label>
              <button
                type="button"
                onClick={() => setShowInstModal(true)}
                className="text-[10.5px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <PlusCircle size={12} /> नवीन बँक/पतसंस्था जोडा
              </button>
            </div>
            <select
              value={form.lenderInstitutionID}
              onChange={(e) => {
                const id = e.target.value;
                const found = institutions.find((i) => String(i.institutionID) === id);
                setForm((p) => ({
                  ...p,
                  lenderInstitutionID: id,
                  lenderName: found ? found.institutionName : p.lenderName,
                  lenderBranchName: found?.institutionBranchName || p.lenderBranchName
                }));
              }}
              className="w-full border border-slate-300 rounded px-2 py-1.5 font-semibold bg-white"
            >
              <option value="">-- नोंदणीकृत बँक / पतसंस्था निवडा किंवा खाली नाव टाइप करा --</option>
              {institutions.map((inst) => (
                <option key={inst.institutionID} value={inst.institutionID}>
                  {inst.institutionName} {inst.institutionBranchName ? `(${inst.institutionBranchName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">बँक / पतसंस्थेचे नाव *</label>
            <input
              type="text"
              required
              value={form.lenderName}
              onChange={(e) => setForm((p) => ({ ...p, lenderName: e.target.value }))}
              placeholder="उदा. जिल्हा मध्यवर्ती बँक"
              className="w-full border border-slate-300 rounded px-2 py-1.5 font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">शाखा नाव (Lender Branch)</label>
            <input
              type="text"
              value={form.lenderBranchName}
              onChange={(e) => setForm((p) => ({ ...p, lenderBranchName: e.target.value }))}
              placeholder="उदा. मुख्य शाखा"
              className="w-full border border-slate-300 rounded px-2 py-1.5"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 mb-0.5">बाह्य कर्ज प्रकार (Borrowing Type) *</label>
            <select
              value={form.borrowingType}
              onChange={(e) => setForm((p) => ({ ...p, borrowingType: e.target.value }))}
              className="w-full border border-slate-300 rounded px-2 py-1.5 font-bold text-primary bg-white"
            >
              {BORROWING_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">त्या संस्थेतील कर्ज खाते क्र. (External A/c No)</label>
            <input
              type="text"
              value={form.externalLoanAccountNo}
              onChange={(e) => setForm((p) => ({ ...p, externalLoanAccountNo: e.target.value }))}
              placeholder="उदा. LN-908877"
              className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">मंजुरी पत्र / ठराव क्र. (Sanction No)</label>
            <input
              type="text"
              value={form.sanctionLetterNo}
              onChange={(e) => setForm((p) => ({ ...p, sanctionLetterNo: e.target.value }))}
              placeholder="ठराव क्र. / दिनांक"
              className="w-full border border-slate-300 rounded px-2 py-1.5"
            />
          </div>
        </div>

        {form.borrowingType === 'FD_AGAINST_LOAN' && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded">
            <label className="block font-bold text-[#4A1410] mb-0.5">तारण ठेवलेली संस्थेची मुदत ठेव पावती निवडा (Sanstha Investment FD)</label>
            <select
              value={form.pledgedInvestmentAccountID}
              onChange={(e) => setForm((p) => ({ ...p, pledgedInvestmentAccountID: e.target.value }))}
              className="w-full border border-amber-300 rounded px-2 py-1.5 bg-white font-semibold"
            >
              <option value="">-- सक्रिय गुंतवणूक FD निवडा --</option>
              {investmentAccounts.map((inv) => (
                <option key={inv.investmentAccountID} value={inv.investmentAccountID}>
                  {inv.investmentNo} — {inv.institutionName} (पावती: {inv.depositReceiptNo || '-'}, रक्कम: ₹{fmtAmt(inv.principalAmount)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Section 2: Financial Terms & EMI Schedule Setup */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 bg-slate-50 p-2.5 rounded border border-slate-200">
          <div>
            <label className="block font-bold text-slate-700 mb-0.5">मंजुरी दिनांक *</label>
            <input
              type="date"
              value={form.sanctionDate}
              onChange={(e) => setForm((p) => ({ ...p, sanctionDate: e.target.value }))}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">मंजूर रक्कम (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={form.sanctionedAmount}
              onChange={(e) => setForm((p) => ({ ...p, sanctionedAmount: e.target.value }))}
              placeholder="उदा. 500000"
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono font-bold text-[#5A1A14] bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">वार्षिक व्याजदर (%) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={form.borrowingInterestRate}
              onChange={(e) => setForm((p) => ({ ...p, borrowingInterestRate: e.target.value }))}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono font-bold bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">मुदत (महिने) *</label>
            <input
              type="number"
              min="1"
              value={form.tenureMonths}
              onChange={(e) => setForm((p) => ({ ...p, tenureMonths: e.target.value }))}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono font-bold bg-white"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 mb-0.5">हप्ता गणना पद्धत (Installment Type) *</label>
            <select
              value={form.installmentType}
              onChange={(e) => setForm((p) => ({ ...p, installmentType: e.target.value }))}
              className="w-full border border-slate-300 rounded px-2 py-1 font-semibold bg-white"
            >
              {INSTALLMENT_TYPES.map((it) => (
                <option key={it.id} value={it.id}>{it.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">हप्ता वारंवारता *</label>
            <select
              value={form.installmentFrequency}
              onChange={(e) => setForm((p) => ({ ...p, installmentFrequency: e.target.value }))}
              className="w-full border border-slate-300 rounded px-2 py-1 font-semibold bg-white"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">एकूण हप्ते संख्या</label>
            <input
              type="number"
              min="1"
              value={form.totalInstallments}
              onChange={(e) => setForm((p) => ({ ...p, totalInstallments: e.target.value }))}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">पहिला हप्ता दिनांक</label>
            <input
              type="date"
              value={form.firstInstallmentDueDate}
              onChange={(e) => setForm((p) => ({ ...p, firstInstallmentDueDate: e.target.value }))}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">अंतिम मुदत दिनांक</label>
            <input
              type="date"
              value={form.maturityDate}
              onChange={(e) => setForm((p) => ({ ...p, maturityDate: e.target.value }))}
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5">ऐच्छिक हप्ता रक्कम (₹)</label>
            <input
              type="number"
              step="0.01"
              value={form.installmentAmount}
              onChange={(e) => setForm((p) => ({ ...p, installmentAmount: e.target.value }))}
              placeholder="Auto EMI"
              className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handlePreviewSchedule}
              className="w-full py-1.5 bg-[#B44814] hover:bg-[#9A3412] text-white rounded font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Calculator size={13} /> हप्ता तक्ता पहा
            </button>
          </div>
        </div>

        {/* Optional Opening Balance Fields */}
        {form.isOpeningBalance && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 p-2.5 bg-amber-50 border border-amber-300 rounded">
            <div>
              <label className="block font-bold text-amber-950 mb-0.5">मूळ वाटप दिनांक</label>
              <input
                type="date"
                value={form.openingDisbursementDate}
                onChange={(e) => setForm((p) => ({ ...p, openingDisbursementDate: e.target.value }))}
                className="w-full border border-amber-300 rounded px-2 py-1 bg-white font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-amber-950 mb-0.5">मूळ उचललेली रक्कम (₹)</label>
              <input
                type="number"
                step="0.01"
                value={form.openingDisbursedAmount}
                onChange={(e) => setForm((p) => ({ ...p, openingDisbursedAmount: e.target.value }))}
                className="w-full border border-amber-300 rounded px-2 py-1 bg-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-amber-950 mb-0.5">आजची देणे मुद्दल बाकी (₹) *</label>
              <input
                type="number"
                step="0.01"
                required={form.isOpeningBalance}
                value={form.openingOutstandingPrincipal}
                onChange={(e) => setForm((p) => ({ ...p, openingOutstandingPrincipal: e.target.value }))}
                className="w-full border border-amber-300 rounded px-2 py-1 bg-white font-mono font-bold text-rose-700"
              />
            </div>
            <div>
              <label className="block font-bold text-amber-950 mb-0.5">मागील व्याज भरणा दिनांक</label>
              <input
                type="date"
                value={form.lastInterestPaidDate}
                onChange={(e) => setForm((p) => ({ ...p, lastInterestPaidDate: e.target.value }))}
                className="w-full border border-amber-300 rounded px-2 py-1 bg-white font-mono"
              />
            </div>
          </div>
        )}

        {/* Section 3: Dynamic GL Ledger Mappings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <div>
            <label className="block font-bold text-slate-700 mb-0.5">
              १. देणे कर्ज मुद्दल GL लेजर (Liability) *
            </label>
            <SearchableSelect
              options={liabilityLedgerOptions}
              value={form.borrowingLiabilityLedgerID}
              onChange={(e) => setForm((p) => ({ ...p, borrowingLiabilityLedgerID: String(e.target.value || '') }))}
              placeholder="देणे कर्ज (Liabilities) लेजर निवडा..."
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-0.5">
              २. बाह्य कर्ज व्याज खर्च GL लेजर (Expense) *
            </label>
            <SearchableSelect
              options={expenseLedgerOptions}
              value={form.interestExpenseLedgerID}
              onChange={(e) => setForm((p) => ({ ...p, interestExpenseLedgerID: String(e.target.value || '') }))}
              placeholder="व्याज खर्च (Expenses) लेजर निवडा..."
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-0.5">
              ३. प्रोसेसिंग फी / दंड खर्च लेजर (ऐच्छिक)
            </label>
            <SearchableSelect
              options={expenseLedgerOptions}
              value={form.processingChargesLedgerID}
              onChange={(e) => setForm((p) => ({ ...p, processingChargesLedgerID: String(e.target.value || '') }))}
              placeholder="प्रोसेसिंग फी / बँक चार्जेस लेजर..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div>
            <label className="block font-bold text-slate-700 mb-0.5">कर्जाचा उद्देश / संलग्न टिपणी</label>
            <input
              type="text"
              value={form.purposeOrLinkedLoansNote}
              onChange={(e) => setForm((p) => ({ ...p, purposeOrLinkedLoansNote: e.target.value }))}
              placeholder="उदा. सुवर्ण कर्ज पुनर्वित्त / शेती व सर्वसाधारण कर्ज निधी..."
              className="w-full border border-slate-300 rounded px-2 py-1.5"
            />
          </div>
          <div className="flex items-end justify-end gap-2">
            {editId && (
              <button
                type="button"
                onClick={() => setEditId(null)}
                className="px-4 py-1.5 border border-slate-300 rounded font-bold text-slate-700 cursor-pointer"
              >
                रद्द करा
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-1.5 bg-primary hover:bg-[#7C2418] text-white rounded font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>{saving ? 'सेव्ह होत आहे...' : editId ? 'खाते अद्ययावत करा' : 'बाह्य कर्ज खाते सेव्ह करा'}</span>
            </button>
          </div>
        </div>

        {/* Live EMI Schedule Preview */}
        {schedulePreview && (
          <div className="border border-amber-200 rounded bg-orange-50/30 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[#4A1410]">
                📅 संभाव्य हप्ता वेळापत्रक तक्ता ({schedulePreview.installmentsCount} हप्ते | एकूण मुद्दल: ₹{fmtAmt(schedulePreview.totalPrincipal)} + एकूण व्याज: ₹{fmtAmt(schedulePreview.totalInterest)} = ₹{fmtAmt(schedulePreview.totalPayable)})
              </div>
              <button type="button" onClick={() => setSchedulePreview(null)} className="text-slate-500 cursor-pointer">
                <X size={14} />
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto bg-white border border-amber-200 rounded">
              <table className="min-w-full border-collapse text-[11px] leading-tight">
                <thead className="bg-orange-50 sticky top-0">
                  <tr>
                    <th className="border px-2 py-1 text-center whitespace-nowrap">हप्ता #</th>
                    <th className="border px-2 py-1 text-center whitespace-nowrap">देय दिनांक</th>
                    <th className="border px-2 py-1 text-right whitespace-nowrap">सुरुवातीची मुद्दल</th>
                    <th className="border px-2 py-1 text-right whitespace-nowrap">मुद्दल हप्ता</th>
                    <th className="border px-2 py-1 text-right whitespace-nowrap">व्याज</th>
                    <th className="border px-2 py-1 text-right whitespace-nowrap">एकूण हप्ता (EMI)</th>
                    <th className="border px-2 py-1 text-right whitespace-nowrap">अखेरची बाकी</th>
                  </tr>
                </thead>
                <tbody>
                  {(schedulePreview.schedules || []).map((s: any) => (
                    <tr key={s.installmentNo}>
                      <td className="border px-2 py-1 text-center font-mono font-bold align-middle">{s.installmentNo}</td>
                      <td className="border px-2 py-1 text-center font-mono align-middle">{new Date(s.dueDate).toLocaleDateString('en-GB')}</td>
                      <td className="border px-2 py-1 text-right font-mono align-middle">₹{fmtAmt(s.openingPrincipal)}</td>
                      <td className="border px-2 py-1 text-right font-mono font-semibold align-middle">₹{fmtAmt(s.principalDue)}</td>
                      <td className="border px-2 py-1 text-right font-mono text-rose-700 align-middle">₹{fmtAmt(s.interestDue)}</td>
                      <td className="border px-2 py-1 text-right font-mono font-bold text-[#5A1A14] align-middle">₹{fmtAmt(s.totalInstallmentAmount)}</td>
                      <td className="border px-2 py-1 text-right font-mono align-middle">₹{fmtAmt(s.closingPrincipal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </form>

      {/* Created Borrowing Accounts Register */}
      <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-2xs space-y-2">
        <h2 className="font-bold text-xs text-slate-900 border-b pb-1.5">
          नोंदणीकृत बाह्य कर्ज खाती यादी ({accountsList.length})
        </h2>
        {loading ? (
          <div className="py-6 text-center text-slate-500">लोड होत आहे...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[11px] leading-tight">
              <thead className="bg-[#5A1A14] text-amber-50">
                <tr>
                  <th className="border px-2 py-1.5 text-left whitespace-nowrap">खाते क्र.</th>
                  <th className="border px-2 py-1.5 text-left whitespace-nowrap">बँक / पतसंस्था</th>
                  <th className="border px-2 py-1.5 text-left whitespace-nowrap">प्रकार व हप्ता पद्धत</th>
                  <th className="border px-2 py-1.5 text-right whitespace-nowrap">मंजूर मर्यादा</th>
                  <th className="border px-2 py-1.5 text-right whitespace-nowrap">उचललेली रक्कम</th>
                  <th className="border px-2 py-1.5 text-center whitespace-nowrap">व्याजदर / कालावधी</th>
                  <th className="border px-2 py-1.5 text-center whitespace-nowrap">स्थिती</th>
                  <th className="border px-2 py-1.5 text-center whitespace-nowrap">पुढील कृती</th>
                </tr>
              </thead>
              <tbody>
                {accountsList.map((b) => (
                  <tr key={b.borrowingID} className="hover:bg-slate-50">
                    <td className="border px-2 py-1 font-mono font-bold text-primary align-middle">
                      {b.borrowingNo}
                      <span className="block text-[10px] text-slate-500">{new Date(b.sanctionDate).toLocaleDateString('en-GB')}</span>
                    </td>
                    <td className="border px-2 py-1 align-middle">
                      <div className="font-bold">{b.lenderName}</div>
                      {b.externalLoanAccountNo && <div className="text-[10px] text-slate-500">A/c: {b.externalLoanAccountNo}</div>}
                    </td>
                    <td className="border px-2 py-1 align-middle">
                      <div className="font-semibold">{b.borrowingType}</div>
                      <div className="text-[10px] text-slate-500">{b.installmentType} • {b.installmentFrequency}</div>
                    </td>
                    <td className="border px-2 py-1 text-right font-mono font-bold align-middle">₹{fmtAmt(b.sanctionedAmount)}</td>
                    <td className="border px-2 py-1 text-right font-mono align-middle">₹{fmtAmt(b.disbursedAmount)}</td>
                    <td className="border px-2 py-1 text-center font-mono align-middle">
                      {b.borrowingInterestRate}% • {b.tenureMonths}M ({b.totalInstallments} हप्ते)
                    </td>
                    <td className="border px-2 py-1 text-center align-middle">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        b.status === 'Sanctioned'
                          ? 'bg-amber-100 text-amber-900'
                          : b.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="border px-2 py-1 text-center align-middle">
                      <div className="flex items-center justify-center gap-1">
                        {b.status !== 'Closed' && b.remainingSanctionLimit > 0 && onNavigate && (
                          <button
                            type="button"
                            onClick={() => onNavigate('borrowing-disbursement', { borrowingId: b.borrowingID })}
                            className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
                          >
                            <ArrowRightCircle size={11} /> उचल करा
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEdit(b)}
                          className="p-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                          title="संपादित करा"
                        >
                          <Edit2 size={12} />
                        </button>
                        {b.status === 'Sanctioned' && b.disbursedAmount === 0 && (
                          <button
                            type="button"
                            onClick={() => handleDelete(b)}
                            className="p-1 rounded border border-red-200 hover:bg-red-50 text-red-600 cursor-pointer"
                            title="हटवा"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Add Lender Institution Modal */}
      {showInstModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveInstitution} className="bg-white rounded shadow-xl max-w-md w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-primary">नवीन कर्ज देणारी बँक / पतसंस्था जोडा</h3>
              <button type="button" onClick={() => setShowInstModal(false)} className="cursor-pointer"><X size={16} /></button>
            </div>
            <div>
              <label className="block font-bold mb-0.5">बँक / पतसंस्थेचे नाव *</label>
              <input
                type="text"
                required
                value={newInst.institutionName}
                onChange={(e) => setNewInst((p) => ({ ...p, institutionName: e.target.value }))}
                className="w-full border rounded px-2 py-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold mb-0.5">प्रकार</label>
                <select
                  value={newInst.institutionType}
                  onChange={(e) => setNewInst((p) => ({ ...p, institutionType: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 bg-white"
                >
                  <option value="Bank">बँक (Bank / DCCB)</option>
                  <option value="Cooperative">सहकारी पतसंस्था (Patsanstha)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-0.5">शाखा नाव</label>
                <input
                  type="text"
                  value={newInst.institutionBranchName}
                  onChange={(e) => setNewInst((p) => ({ ...p, institutionBranchName: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowInstModal(false)} className="px-3 py-1 border rounded">रद्द</button>
              <button type="submit" className="px-4 py-1 bg-primary text-white rounded font-bold cursor-pointer">जतन करा</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
