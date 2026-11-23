import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Unlock, AlertTriangle, ShieldCheck, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';

interface BorrowingGoldUnpledgeMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const fmtAmt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN');
};

export default function BorrowingGoldUnpledgeMaster({ onNavigate }: BorrowingGoldUnpledgeMasterProps) {
  const { user } = useAuth();
  const activeBizDate = getBusinessDateStr(user?.businessDate);
  const urlBorrowingId = Number(new URLSearchParams(window.location.search).get('borrowingId') || 0);

  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [ownLockers, setOwnLockers] = useState<any[]>([]);
  const [externalLockers, setExternalLockers] = useState<any[]>([]);
  const [selectedBorrowingId, setSelectedBorrowingId] = useState<number>(urlBorrowingId);
  const [statusFilter, setStatusFilter] = useState<'Pledged' | 'All'>('Pledged');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustodyIds, setSelectedCustodyIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [releaseForm, setReleaseForm] = useState({
    releaseDate: activeBizDate,
    returnCustodyStatus: 'BRANCH_SAFE' as 'BRANCH_SAFE' | 'OWN_LOCKER' | 'EXTERNAL_LOCKER',
    returnOwnLockerID: '',
    returnExternalLockerID: '',
    remarks: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mstRes, brwRes] = await Promise.all([
        axios.get('/api/Borrowings/masters'),
        axios.get('/api/Borrowings', { params: { status: 'all' } })
      ]);
      setOwnLockers(mstRes.data?.ownLockers || []);
      setExternalLockers(mstRes.data?.externalLockers || []);

      const goldBorrowings = (brwRes.data?.items || []).filter(
        (b: any) => b.borrowingType === 'GOLD_REPLEDGE' || (b.goldPledges && b.goldPledges.length > 0)
      );
      setBorrowings(goldBorrowings);

      const defaultId =
        urlBorrowingId ||
        goldBorrowings.find((b: any) => b.activePledgedCount > 0)?.borrowingID ||
        goldBorrowings[0]?.borrowingID ||
        0;
      setSelectedBorrowingId(defaultId);
      setSelectedCustodyIds([]);
    } catch (err) {
      toast.error('पुनर्गहाण सोने माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const selectedBorrowing = useMemo(
    () => borrowings.find((b) => b.borrowingID === selectedBorrowingId) || null,
    [borrowings, selectedBorrowingId]
  );

  const closedMemberLoanAlerts = useMemo(() => {
    const list: any[] = [];
    borrowings.forEach((b) => {
      (b.goldPledges || []).forEach((p: any) => {
        if (p.pledgeStatus === 'Pledged' && (p.loanStatus === 'Closed' || Number(p.loanPrincipalBalance || 0) <= 0)) {
          list.push({ ...p, borrowingID: b.borrowingID, borrowingNo: b.borrowingNo, lenderName: b.lenderName });
        }
      });
    });
    return list;
  }, [borrowings]);

  const filteredPledges = useMemo(() => {
    const list: any[] = selectedBorrowing?.goldPledges || [];
    return list.filter((p) => {
      if (statusFilter === 'Pledged' && p.pledgeStatus !== 'Pledged') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          (p.packetNumber || '').toLowerCase().includes(q) ||
          (p.borrowerName || '').toLowerCase().includes(q) ||
          (p.loanAccountNo || '').toLowerCase().includes(q) ||
          (p.lenderPledgeReceiptNo || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedBorrowing, statusFilter, searchQuery]);

  const toggleSelect = (custodyId: number) => {
    setSelectedCustodyIds((prev) =>
      prev.includes(custodyId) ? prev.filter((id) => id !== custodyId) : [...prev, custodyId]
    );
  };

  const handleUnpledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrowing) return;
    if (selectedCustodyIds.length === 0) {
      toast.error('सोडवून घेण्यासाठी किमान एक सोने पाकीट निवडा.');
      return;
    }
    if (releaseForm.returnCustodyStatus === 'OWN_LOCKER' && !releaseForm.returnOwnLockerID) {
      toast.error('कृपया संस्थेचा स्वतःचा लॉकर निवडा.');
      return;
    }
    if (releaseForm.returnCustodyStatus === 'EXTERNAL_LOCKER' && !releaseForm.returnExternalLockerID) {
      toast.error('कृपया बाह्य बँक लॉकर निवडा.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`/api/Borrowings/${selectedBorrowing.borrowingID}/unpledge-packets`, {
        goldCustodyIds: selectedCustodyIds,
        releaseDate: releaseForm.releaseDate,
        returnCustodyStatus: releaseForm.returnCustodyStatus,
        returnOwnLockerID:
          releaseForm.returnCustodyStatus === 'OWN_LOCKER' ? Number(releaseForm.returnOwnLockerID) : null,
        returnExternalLockerID:
          releaseForm.returnCustodyStatus === 'EXTERNAL_LOCKER' ? Number(releaseForm.returnExternalLockerID) : null,
        remarks: releaseForm.remarks.trim() || 'बाह्य संस्थेकडून सोने पाकीट सोडवून घेतले'
      });
      toast.success(res.data?.message || 'सोने पाकिटे यशस्वीरीत्या सोडवून संस्थेच्या कस्टडीत घेतली!');
      await loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data || 'पाकीट सोडवताना त्रुटी आली.';
      toast.error(typeof msg === 'string' ? msg : 'पाकीट सोडवताना त्रुटी आली.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              ४. पुनर्गहाण सोने पाकीट सुटका व ट्रॅकिंग (Gold Packet Unpledge & Custody Restore)
            </h1>
            <p className="text-xs text-slate-500">
              बाह्य बँक/पतसंस्थेकडे पुनर्गहाण ठेवलेली सभासदांची सोने पाकिटे परत संस्थेच्या तिजोरीत किंवा लॉकरमध्ये घेणे
            </p>
          </div>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('borrowing-dashboard')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
          >
            ← डॅशबोर्ड
          </button>
        )}
      </div>

      {/* Urgent Closed Customer Loan Alert Banner */}
      {closedMemberLoanAlerts.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>
              अति-महत्त्वाची सूचना: {closedMemberLoanAlerts.length} सभासदांनी स्वतःचे सोने तारण कर्ज पूर्ण फेडले आहे, परंतु त्यांची सोने पाकिटे अद्याप बाह्य बँकेकडे पुनर्गहाण आहेत!
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {closedMemberLoanAlerts.map((al, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSelectedBorrowingId(al.borrowingID);
                  setSelectedCustodyIds([al.goldCustodyID]);
                }}
                className="px-2.5 py-1 bg-white hover:bg-rose-100 border border-rose-300 rounded-lg text-[11px] font-semibold text-rose-900"
              >
                पाकीट {al.packetNumber} ({al.borrowerName}) — {al.lenderName} ({al.borrowingNo}) निवडा →
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Borrowing Account Selector & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              सोने पुनर्गहाण बाह्य कर्ज खाते निवडा
            </label>
            <select
              value={selectedBorrowingId}
              onChange={(e) => {
                setSelectedBorrowingId(Number(e.target.value));
                setSelectedCustodyIds([]);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
            >
              <option value={0}>-- खाते निवडा --</option>
              {borrowings.map((b) => (
                <option key={b.borrowingID} value={b.borrowingID}>
                  {b.borrowingNo} — {b.lenderName} (गहाण पाकिटे: {b.activePledgedCount} • येणे बाकी: ₹{fmtAmt(b.outstandingPrincipal)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">स्थिती फिल्टर</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
            >
              <option value="Pledged">सध्या पुनर्गहाण असलेली (Pledged)</option>
              <option value="All">सर्व पाकिटे (Pledged + Released)</option>
            </select>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="पाकीट क्र. / सभासद नाव शोधा..."
              className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-8 text-center text-xs text-slate-500">लोड होत आहे...</div>
      ) : !selectedBorrowing ? (
        <div className="bg-white rounded-xl border p-8 text-center text-xs text-slate-500">
          कोणतेही सोने पुनर्गहाण बाह्य कर्ज खाते सापडले नाही.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                🏅 {selectedBorrowing.lenderName} ({selectedBorrowing.borrowingNo}) खालील सोने पाकिटे ({filteredPledges.length})
              </span>
              <span className="text-[11px] font-semibold text-amber-800">
                निवडलेली पाकिटे: {selectedCustodyIds.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-center">निवडा</th>
                    <th className="px-3 py-2 text-left">पाकीट क्र.</th>
                    <th className="px-3 py-2 text-left">मूळ कर्जदार व कर्ज क्र.</th>
                    <th className="px-3 py-2 text-right">निव्वळ वजन</th>
                    <th className="px-3 py-2 text-right">घेतलेली रक्कम</th>
                    <th className="px-3 py-2 text-center">स्प्रेड (%)</th>
                    <th className="px-3 py-2 text-center">पाकीट स्थिती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPledges.map((p: any) => {
                    const isMemberClosed = p.loanStatus === 'Closed' || Number(p.loanPrincipalBalance || 0) <= 0;
                    const isPledged = p.pledgeStatus === 'Pledged';
                    return (
                      <tr
                        key={p.borrowingPledgeID}
                        className={isMemberClosed && isPledged ? 'bg-rose-50/70' : 'hover:bg-slate-50'}
                      >
                        <td className="px-3 py-2 text-center">
                          {isPledged ? (
                            <input
                              type="checkbox"
                              checked={selectedCustodyIds.includes(p.goldCustodyID)}
                              onChange={() => toggleSelect(p.goldCustodyID)}
                            />
                          ) : (
                            <span className="text-emerald-600 font-bold">✓</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900">
                          <div>{p.packetNumber}</div>
                          {p.lenderPledgeReceiptNo && (
                            <div className="text-[10px] text-slate-500">पावती: {p.lenderPledgeReceiptNo}</div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-800">{p.borrowerName}</div>
                          <div className="text-[10px] text-slate-500">
                            {p.loanAccountNo} • बाकी: ₹{fmtAmt(p.loanPrincipalBalance)}
                          </div>
                          {isMemberClosed && isPledged && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-rose-600 text-white rounded text-[9px] font-bold">
                              सभासदाचे कर्ज पूर्ण बंद — तातडीने सोडवा!
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{fmtWt(p.netWeight)} ग्रॅम</td>
                        <td className="px-3 py-2 text-right">₹{fmtAmt(p.allocatedBorrowedAmount)}</td>
                        <td className="px-3 py-2 text-center font-bold text-emerald-700">
                          {p.interestSpreadPercent >= 0 ? `+${p.interestSpreadPercent}%` : `${p.interestSpreadPercent}%`}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isPledged ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              पुनर्गहाण ({fmtDate(p.pledgedDate)})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              सुटलेले ({fmtDate(p.releasedDate)})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPledges.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        या फिल्टरमध्ये कोणतेही सोने पाकीट नाही.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unpledge Custody Restore Form */}
          <form
            onSubmit={handleUnpledgeSubmit}
            className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3.5 h-fit"
          >
            <div className="border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> संस्थेच्या कस्टडीत परत घ्या (Restore Custody)
              </h3>
              <p className="text-[11px] text-slate-500">
                बाह्य बँकेतून सोडवलेले दागिने संस्थेत कोठे ठेवले ते नोंदवा
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">सुटका तारीख (Release Date) *</label>
              <input
                type="date"
                value={releaseForm.releaseDate}
                onChange={(e) => setReleaseForm((prev) => ({ ...prev, releaseDate: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                परत आल्यावर ठेवण्याचे ठिकाण (Destination) *
              </label>
              <select
                value={releaseForm.returnCustodyStatus}
                onChange={(e) => setReleaseForm((prev) => ({ ...prev, returnCustodyStatus: e.target.value as any }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
              >
                <option value="BRANCH_SAFE">संस्थेची मुख्य तिजोरी (Branch Safe / Vault)</option>
                <option value="OWN_LOCKER">संस्थेचा स्वतःचा लॉकर (Own Locker)</option>
                <option value="EXTERNAL_LOCKER">बाह्य बँक सुरक्षित लॉकर (External Locker)</option>
              </select>
            </div>

            {releaseForm.returnCustodyStatus === 'OWN_LOCKER' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">संस्थेचा लॉकर निवडा *</label>
                <select
                  value={releaseForm.returnOwnLockerID}
                  onChange={(e) => setReleaseForm((prev) => ({ ...prev, returnOwnLockerID: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                >
                  <option value="">-- लॉकर निवडा --</option>
                  {ownLockers.map((l: any) => (
                    <option key={l.lockerID} value={l.lockerID}>
                      लॉकर क्र. {l.lockerNo} ({l.cabinetNo || 'Main'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {releaseForm.returnCustodyStatus === 'EXTERNAL_LOCKER' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">बाह्य बँक लॉकर निवडा *</label>
                <select
                  value={releaseForm.returnExternalLockerID}
                  onChange={(e) => setReleaseForm((prev) => ({ ...prev, returnExternalLockerID: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                >
                  <option value="">-- बाह्य लॉकर निवडा --</option>
                  {externalLockers.map((l: any) => (
                    <option key={l.externalLockerID} value={l.externalLockerID}>
                      {l.bankOrSansthaName} — लॉकर {l.lockerNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">तपशील / Remarks</label>
              <textarea
                rows={2}
                value={releaseForm.remarks}
                onChange={(e) => setReleaseForm((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="उदा. बँकेकडे आगाऊ रक्कम भरून पाकीट क्र. सोडवून घेतले..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || selectedCustodyIds.length === 0}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {submitting
                ? 'कस्टडी अपडेट होत आहे...'
                : `✓ निवडलेली ${selectedCustodyIds.length} सोने पाकीट(टे) सोडवून घ्या`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
