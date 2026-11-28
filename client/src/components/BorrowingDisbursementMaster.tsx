import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  ArrowDownCircle,
  Search,
  Scale,
  CheckCircle2
} from 'lucide-react';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';
import BankLedgerSelect from './common/BankLedgerSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';

interface BorrowingDisbursementMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const fmtAmt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function BorrowingDisbursementMaster({ onNavigate }: BorrowingDisbursementMasterProps) {
  const { user } = useAuth();
  const activeBizDate = getBusinessDateStr(user?.businessDate);
  const urlBorrowingId = Number(new URLSearchParams(window.location.search).get('borrowingId') || 0);

  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [eligiblePackets, setEligiblePackets] = useState<any[]>([]);
  const [selectedBorrowingId, setSelectedBorrowingId] = useState<number>(urlBorrowingId);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [packetSearch, setPacketSearch] = useState('');
  const [selectedPacketLoans, setSelectedPacketLoans] = useState<Record<number, { selected: boolean; receiptNo: string }>>({});

  const [form, setForm] = useState({
    disbursementDate: activeBizDate,
    grossDisbursedAmount: '',
    processingFeeDeducted: '0',
    otherDeductionsAmount: '0',
    deductionLedgerID: '',
    paymentMode: 'Bank' as 'Bank' | 'Cash',
    bankLedgerID: 0,
    referenceNo: '',
    firstInstallmentDueDate: '',
    customInstallmentAmount: '',
    remarks: ''
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mstRes, brwRes, pktRes] = await Promise.all([
        axios.get('/api/Borrowings/masters'),
        axios.get('/api/Borrowings', { params: { status: 'all' } }),
        axios.get('/api/Borrowings/eligible-gold-packets')
      ]);
      setLedgers(mstRes.data?.ledgers || []);
      const allItems = brwRes.data?.items || [];
      setBorrowings(allItems);
      setEligiblePackets(Array.isArray(pktRes.data) ? pktRes.data : []);

      const disbursable = allItems.filter((b: any) => b.status !== 'Closed' && b.remainingSanctionLimit > 0);
      const target = urlBorrowingId > 0
        ? allItems.find((b: any) => b.borrowingID === urlBorrowingId)
        : disbursable[0];

      if (target) {
        selectAccount(target);
      }
    } catch (err) {
      toast.error('माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const selectAccount = (b: any) => {
    setSelectedBorrowingId(b.borrowingID);
    setForm((prev) => ({
      ...prev,
      grossDisbursedAmount: String(b.remainingSanctionLimit || b.sanctionedAmount || ''),
      deductionLedgerID: b.processingChargesLedgerID ? String(b.processingChargesLedgerID) : prev.deductionLedgerID,
      firstInstallmentDueDate: b.firstInstallmentDueDate ? b.firstInstallmentDueDate.split('T')[0] : ''
    }));
    setSelectedPacketLoans({});
  };

  const selectedAccount = useMemo(
    () => borrowings.find((b) => b.borrowingID === selectedBorrowingId) || null,
    [borrowings, selectedBorrowingId]
  );

  const disbursableAccounts = useMemo(
    () => borrowings.filter((b) => b.status !== 'Closed' && b.remainingSanctionLimit > 0),
    [borrowings]
  );

  const accountOptions = useMemo<SearchableSelectOption[]>(() => {
    return disbursableAccounts.map((b) => ({
      value: String(b.borrowingID),
      label: `${b.borrowingNo} — ${b.lenderName}${b.externalLoanAccountNo ? ` (A/c: ${b.externalLoanAccountNo})` : ''}`,
      subLabel: `मंजूर: ₹${fmtAmt(b.sanctionedAmount)} • उपलब्ध उचल मर्यादा: ₹${fmtAmt(b.remainingSanctionLimit)} • दर: ${b.borrowingInterestRate}%`,
      badge: b.status === 'Sanctioned' ? 'Sanctioned (नवीन)' : 'Active (उपलब्ध मर्यादा)'
    }));
  }, [disbursableAccounts]);

  const deductionLedgerOptions = useMemo<SearchableSelectOption[]>(() => {
    return ledgers
      .filter((l) => {
        const acct = (l.accountType || '').toLowerCase();
        if (acct.includes('cash') || acct.includes('bank')) return false;
        const nat = (l.natureOfGroup || '').toLowerCase();
        return nat === 'expenses' || nat === 'assets';
      })
      .map((l) => ({
        value: String(l.ledgerID),
        label: `${l.ledgerName} (#${l.ledgerID})`,
        badge: l.natureOfGroup || 'GL'
      }));
  }, [ledgers]);

  const grossAmt = Math.max(0, parseFloat(form.grossDisbursedAmount || '0') || 0);
  const procFee = Math.max(0, parseFloat(form.processingFeeDeducted || '0') || 0);
  const otherDed = Math.max(0, parseFloat(form.otherDeductionsAmount || '0') || 0);
  const totalDeductions = Math.round((procFee + otherDed) * 100) / 100;
  const netReceived = Math.max(0, Math.round((grossAmt - totalDeductions) * 100) / 100);

  const selectedPacketsList = useMemo(
    () => eligiblePackets.filter((p) => selectedPacketLoans[p.loanAccountID]?.selected),
    [eligiblePackets, selectedPacketLoans]
  );

  const filteredPackets = useMemo(() => {
    const q = packetSearch.trim().toLowerCase();
    if (!q) return eligiblePackets;
    return eligiblePackets.filter(
      (p) =>
        (p.packetNumber || '').toLowerCase().includes(q) ||
        (p.loanAccountNo || '').toLowerCase().includes(q) ||
        (p.borrowerName || '').toLowerCase().includes(q)
    );
  }, [eligiblePackets, packetSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) {
      toast.error('कृपया प्रथम बाह्य कर्ज खाते निवडा.');
      return;
    }
    if (grossAmt <= 0) {
      toast.error('कृपया उचल रक्कम ₹0 पेक्षा जास्त प्रविष्ट करा.');
      return;
    }
    if (totalDeductions > 0 && !form.deductionLedgerID) {
      toast.error('प्रोसेसिंग फी / कपातीसाठी कृपया खर्च GL लेजर निवडा.');
      return;
    }
    if (form.paymentMode === 'Bank' && (!form.bankLedgerID || form.bankLedgerID <= 0)) {
      toast.error('बँक खात्यात निधी जमा करण्यासाठी बँक GL खाते निवडा.');
      return;
    }
    if (
      selectedAccount.borrowingType === 'GOLD_REPLEDGE' &&
      (selectedAccount.activePledgedCount || 0) === 0 &&
      selectedPacketsList.length === 0
    ) {
      toast.error('सोने पुनर्गहाण कर्जासाठी किमान एक ग्राहक सोने पाकीट निवडा.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`/api/Borrowings/${selectedAccount.borrowingID}/disburse`, {
        disbursementDate: form.disbursementDate,
        grossDisbursedAmount: grossAmt,
        processingFeeDeducted: procFee,
        otherDeductionsAmount: otherDed,
        deductionLedgerID: totalDeductions > 0 ? Number(form.deductionLedgerID) : null,
        paymentMode: form.paymentMode,
        bankLedgerID: form.paymentMode === 'Bank' ? form.bankLedgerID : null,
        referenceNo: form.referenceNo,
        firstInstallmentDueDate: form.firstInstallmentDueDate || null,
        customInstallmentAmount: parseFloat(form.customInstallmentAmount || '0') > 0 ? parseFloat(form.customInstallmentAmount) : null,
        remarks: form.remarks,
        goldPledges: selectedPacketsList.map((p) => ({
          loanAccountID: p.loanAccountID,
          allocatedBorrowedAmount: 0,
          lenderPledgeReceiptNo: selectedPacketLoans[p.loanAccountID]?.receiptNo || ''
        }))
      });

      toast.success(res.data?.message || 'कर्ज रक्कम उचल यशस्वी!');
      if (onNavigate) {
        onNavigate('borrowing-repayment', { borrowingId: selectedAccount.borrowingID });
      } else {
        await loadAll();
      }
    } catch (err: any) {
      toast.error(typeof err.response?.data === 'string' ? err.response.data : 'उचल सेव्ह करताना त्रुटी आली.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Header */}
      <div className="bg-primary px-3.5 py-2.5 text-white rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ArrowDownCircle size={18} />
          <div>
            <h1 className="text-sm md:text-base font-bold">
              २. बाह्य कर्ज रक्कम उचल व सोने पुनर्गहाण वाटप (Borrowing Loan Disbursement)
            </h1>
            <p className="text-[10.5px] text-amber-100">
              मंजूर खात्यातून निधी जमा करा, बँक कपात नोंदवा, सोने पाकिटे पुनर्गहाण जोडा व हप्ता वेळापत्रक सक्रिय करा
            </p>
          </div>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('borrowing-account')}
            className="px-3 py-1 rounded bg-white/15 hover:bg-white/25 text-white font-bold cursor-pointer"
          >
            + नवीन बाह्य कर्ज खाते उघडा
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-300 rounded-sm p-3.5 shadow-2xs space-y-3">
        {/* Account Selection */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            १. उचल करण्यासाठी मंजूर बाह्य कर्ज खाते निवडा (Select Sanctioned / Revolving Account) *
          </label>
          <SearchableSelect
            options={accountOptions}
            value={selectedBorrowingId ? String(selectedBorrowingId) : ''}
            onChange={(e) => {
              const id = Number(e.target.value || 0);
              const found = borrowings.find((b) => b.borrowingID === id);
              if (found) selectAccount(found);
            }}
            placeholder={loading ? 'खाती लोड होत आहेत...' : 'बाह्य कर्ज क्र. किंवा बँक/पतसंस्थेचे नाव शोधा...'}
            emptyMessage="उचल करण्यासाठी कोणतेही मंजूर खाते उपलब्ध नाही. आधी १. नवीन खाते उघडा."
          />
        </div>

        {selectedAccount && (
          <>
            {/* Selected Account Snapshot */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 bg-slate-50 p-2.5 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">बँक / पतसंस्था</span>
                <span className="font-bold text-slate-900">{selectedAccount.lenderName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">कर्ज प्रकार</span>
                <span className="font-bold text-primary">{selectedAccount.borrowingType}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">मंजूर मर्यादा</span>
                <span className="font-mono font-bold">₹{fmtAmt(selectedAccount.sanctionedAmount)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">उपलब्ध उचल मर्यादा</span>
                <span className="font-mono font-extrabold text-emerald-700">₹{fmtAmt(selectedAccount.remainingSanctionLimit)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-bold">व्याजदर व हप्ता पद्धत</span>
                <span className="font-mono font-bold">{selectedAccount.borrowingInterestRate}% • {selectedAccount.installmentType} ({selectedAccount.totalInstallments} हप्ते)</span>
              </div>
            </div>

            {/* Disbursement Amounts & Deductions */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">निधी प्राप्ती दिनांक *</label>
                <input
                  type="date"
                  value={form.disbursementDate}
                  onChange={(e) => setForm((p) => ({ ...p, disbursementDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5">एकूण उचल रक्कम (Gross ₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedAccount.remainingSanctionLimit}
                  required
                  value={form.grossDisbursedAmount}
                  onChange={(e) => setForm((p) => ({ ...p, grossDisbursedAmount: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono font-bold text-[#5A1A14]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5">प्रोसेसिंग फी कपात (- ₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.processingFeeDeducted}
                  onChange={(e) => setForm((p) => ({ ...p, processingFeeDeducted: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono text-rose-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5">इतर कपात / स्टॅम्प (- ₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.otherDeductionsAmount}
                  onChange={(e) => setForm((p) => ({ ...p, otherDeductionsAmount: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono text-rose-700"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-300 rounded px-2.5 py-1 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-emerald-900">प्रत्यक्ष जमा रक्कम (Net ₹)</span>
                <span className="font-mono font-extrabold text-sm text-emerald-800">₹{fmtAmt(netReceived)}</span>
              </div>
            </div>

            {totalDeductions > 0 && (
              <div className="p-2.5 bg-rose-50/50 border border-rose-200 rounded">
                <label className="block font-bold text-rose-900 mb-0.5">
                  कपात रकमेसाठी नावे (Dr) डायनॅमिक GL लेजर (Processing Fee / Share Deduction GL) *
                </label>
                <SearchableSelect
                  options={deductionLedgerOptions}
                  value={form.deductionLedgerID}
                  onChange={(e) => setForm((p) => ({ ...p, deductionLedgerID: String(e.target.value || '') }))}
                  placeholder="प्रोसेसिंग फी / बँक चार्जेस खर्च लेजर निवडा..."
                />
              </div>
            )}

            {/* Settlement Mode */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 p-2.5 bg-amber-50/40 border border-amber-200 rounded">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">जमा माध्यम (Receipt Mode) *</label>
                <select
                  value={form.paymentMode}
                  onChange={(e) => setForm((p) => ({ ...p, paymentMode: e.target.value as 'Bank' | 'Cash' }))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 font-bold bg-white"
                >
                  <option value="Bank">🏦 संस्थेच्या बँक खात्यात जमा (Bank / RTGS)</option>
                  <option value="Cash">💵 रोख जमा (Cash)</option>
                </select>
              </div>

              {form.paymentMode === 'Bank' && (
                <div className="md:col-span-2">
                  <BankLedgerSelect
                    value={form.bankLedgerID}
                    onChange={(id) => setForm((p) => ({ ...p, bankLedgerID: id }))}
                    showCountBadge
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-0.5">UTR / चेक संदर्भ क्र.</label>
                <input
                  type="text"
                  value={form.referenceNo}
                  onChange={(e) => setForm((p) => ({ ...p, referenceNo: e.target.value }))}
                  placeholder="UTR / Chq No"
                  className="w-full border border-slate-300 rounded px-2 py-1.5"
                />
              </div>
            </div>

            {/* Gold Packet Re-pledge Selector for GOLD_REPLEDGE */}
            {selectedAccount.borrowingType === 'GOLD_REPLEDGE' && (
              <div className="border border-purple-300 rounded p-3 bg-purple-50/30 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-purple-950">
                    🏅 पुनर्गहाण ठेवण्यासाठी पात्र ग्राहक सोने तारण पाकिटे निवडा ({selectedPacketsList.length} निवडली | एकूण वजन: {fmtWt(selectedPacketsList.reduce((s, x) => s + Number(x.totalNetWeight || 0), 0))}g)
                  </div>
                  <div className="relative w-64">
                    <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={packetSearch}
                      onChange={(e) => setPacketSearch(e.target.value)}
                      placeholder="पाकीट क्र. / ग्राहक नाव शोधा..."
                      className="w-full pl-7 pr-2 py-1 border border-purple-300 rounded bg-white"
                    />
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto bg-white border border-purple-200 rounded">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead className="bg-purple-50 sticky top-0">
                      <tr>
                        <th className="border px-2 py-1 w-8">निवडा</th>
                        <th className="border px-2 py-1 text-left">पाकीट क्र.</th>
                        <th className="border px-2 py-1 text-left">ग्राहक नाव व कर्ज खाते</th>
                        <th className="border px-2 py-1 text-right">निव्वळ वजन</th>
                        <th className="border px-2 py-1 text-right">मूल्यांकन</th>
                        <th className="border px-2 py-1 text-center">मार्जिन (Spread)</th>
                        <th className="border px-2 py-1 text-left">बाह्य तारण पावती क्र.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPackets.map((pkt) => {
                        const isSel = Boolean(selectedPacketLoans[pkt.loanAccountID]?.selected);
                        const spread = Math.round((Number(pkt.customerInterestRate || 0) - Number(selectedAccount.borrowingInterestRate || 0)) * 100) / 100;
                        return (
                          <tr key={pkt.loanAccountID} className={isSel ? 'bg-purple-50' : 'hover:bg-slate-50'}>
                            <td className="border px-2 py-1 text-center">
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={(e) =>
                                  setSelectedPacketLoans((prev) => ({
                                    ...prev,
                                    [pkt.loanAccountID]: {
                                      selected: e.target.checked,
                                      receiptNo: prev[pkt.loanAccountID]?.receiptNo || ''
                                    }
                                  }))
                                }
                              />
                            </td>
                            <td className="border px-2 py-1 font-mono font-bold text-purple-900">{pkt.packetNumber}</td>
                            <td className="border px-2 py-1">
                              <div className="font-bold">{pkt.borrowerName}</div>
                              <div className="text-[10px] text-slate-500">A/c: {pkt.loanAccountNo} (बाकी: ₹{fmtAmt(pkt.customerPrincipalBalance)})</div>
                            </td>
                            <td className="border px-2 py-1 text-right font-mono">{fmtWt(pkt.totalNetWeight)}g</td>
                            <td className="border px-2 py-1 text-right font-mono">₹{fmtAmt(pkt.totalValuationAmount)}</td>
                            <td className="border px-2 py-1 text-center font-mono font-bold text-emerald-700">
                              {pkt.customerInterestRate}% → {spread >= 0 ? '+' : ''}{spread}%
                            </td>
                            <td className="border px-2 py-1">
                              <input
                                type="text"
                                disabled={!isSel}
                                value={selectedPacketLoans[pkt.loanAccountID]?.receiptNo || ''}
                                onChange={(e) =>
                                  setSelectedPacketLoans((prev) => ({
                                    ...prev,
                                    [pkt.loanAccountID]: { selected: true, receiptNo: e.target.value }
                                  }))
                                }
                                placeholder="पावती क्र."
                                className="w-full border border-slate-300 rounded px-1.5 py-0.5 text-[10.5px]"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Live Balanced Voucher Preview */}
            {grossAmt > 0 && (
              <div className="border border-slate-300 rounded overflow-hidden">
                <div className="bg-slate-100 px-3 py-1.5 flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1"><Scale size={14} className="text-primary" /> प्रस्तावित लेखा व्हाउचर प्रिव्ह्यू (Maker-Checker Voucher)</span>
                  <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10.5px]">
                    Dr ₹{fmtAmt(netReceived + totalDeductions)} = Cr ₹{fmtAmt(grossAmt)} ✓ संतुलित
                  </span>
                </div>
                <table className="w-full text-[11px] border-collapse">
                  <tbody>
                    <tr className="border-t">
                      <td className="p-1.5 font-semibold">{form.paymentMode === 'Bank' ? 'संस्थेचे बँक खाते (Bank GL)' : 'शाखा रोख खाते (Cash GL)'}</td>
                      <td className="p-1.5 text-center font-mono font-bold text-amber-700 w-16">Dr</td>
                      <td className="p-1.5 text-right font-mono font-bold w-32">₹{fmtAmt(netReceived)}</td>
                      <td className="p-1.5 text-right font-mono w-32">-</td>
                    </tr>
                    {totalDeductions > 0 && (
                      <tr className="border-t">
                        <td className="p-1.5 font-semibold">प्रोसेसिंग फी / बँक कपात खर्च खाते</td>
                        <td className="p-1.5 text-center font-mono font-bold text-amber-700">Dr</td>
                        <td className="p-1.5 text-right font-mono font-bold">₹{fmtAmt(totalDeductions)}</td>
                        <td className="p-1.5 text-right font-mono">-</td>
                      </tr>
                    )}
                    <tr className="border-t">
                      <td className="p-1.5 font-semibold">देणे कर्ज मुद्दल खाते: {selectedAccount.liabilityLedgerName}</td>
                      <td className="p-1.5 text-center font-mono font-bold text-emerald-700">Cr</td>
                      <td className="p-1.5 text-right font-mono">-</td>
                      <td className="p-1.5 text-right font-mono font-bold">₹{fmtAmt(grossAmt)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <input
                type="text"
                value={form.remarks}
                onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                placeholder="वाटपाबाबत विशेष शेरा (ऐच्छिक)..."
                className="w-2/3 border border-slate-300 rounded px-2.5 py-1.5"
              />
              <button
                type="submit"
                disabled={submitting || grossAmt <= 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                <span>{submitting ? 'प्रक्रिया सुरू...' : `रक्कम उचल जतन करा व हप्ता तक्ता सक्रिय करा`}</span>
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
