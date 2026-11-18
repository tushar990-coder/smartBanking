import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, Plus, Award, RefreshCw, ShieldAlert } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';
import { isHeadOfficeUser, getEffectiveBranchId } from '../utils/branchAccess';

interface HearingRecord {
  hearingLogId: number;
  caseId: number;
  caseNumber: string;
  caseType?: string;
  customerName?: string;
  memberName: string;
  cifNo?: string;
  hearingDate: string;
  hearingStage: string;
  stageLabel?: string;
  presenceType: string;
  courtOrderSummary?: string;
  nextHearingDate?: string;
  nextHearingPurpose?: string;
  advocateNotes?: string;
}

interface CaseOption {
  caseId: number;
  caseType?: string;
  caseNumber: string;
  customerName?: string;
  memberName: string;
  cifNo?: string;
  memberCode: string;
  loanAccountNo: string;
  status?: string;
  caseStatus: string;
  totalClaimAmount: number;
  branchId?: number;
}

interface Sec101HearingDiaryProps {
  branchId?: number;
  effectiveBranch?: number | 'all' | null;
  initialCaseId?: number | null;
  embedded?: boolean;
  onDataChanged?: () => void;
}

const HEARING_STAGES = [
  { value: 'SUMMONS', label: '१. समन्स बजावणी (Summons Service)' },
  { value: 'WRITTEN_STATEMENT', label: '२. गैरअर्जदाराचा लेखी जबाब (Written Statement)' },
  { value: 'EVIDENCE', label: '३. पतसंस्थेचे पुरावे व शपथपत्र (Evidence / Affidavit)' },
  { value: 'ARGUMENT', label: '४. अंतिम युक्तिवाद (Final Arguments)' },
  { value: 'ORDER_PASSED', label: '५. निकाल / दाखला मंजुरी (Order / Certificate Grant)' },
  { value: 'STAYED', label: '६. स्थगिती आदेश (Stay Granted)' },
];

const CASE_STATUS_LABELS: Record<string, string> = {
  FILED: 'दावा दाखल',
  HEARING: 'सुनावणी सुरू',
  CERTIFIED: 'दाखला मंजूर',
  CERTIFICATE_ISSUED: 'दाखला मंजूर',
  AWARDED: 'निवाडा मंजूर (कलम ९१)',
  EXECUTION: 'जप्ती / अंमलबजावणी',
  EXECUTION_RULE107: 'नियम १०७ जप्ती / लिलाव',
  STAYED: 'स्थगिती आदेश',
  DISMISSED: 'फेटाळलेला',
  WITHDRAWN: 'मागे घेतलेला / तडजोड',
  CLOSED_RECOVERED: 'पूर्ण वसूल / बंद',
};

export default function Sec101HearingDiary({
  branchId: propBranchId,
  effectiveBranch: propEffectiveBranch,
  initialCaseId,
  embedded = false,
  onDataChanged,
}: Sec101HearingDiaryProps = {}) {
  const { user, globalBranchId } = useAuth();
  const isHo = isHeadOfficeUser(user);
  const bizDateStr = getBusinessDateStr(user?.businessDate);

  const [cases, setCases] = useState<CaseOption[]>([]);
  const [hearings, setHearings] = useState<HearingRecord[]>([]);
  const [upcomingHearings, setUpcomingHearings] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(() => propBranchId || user?.branchID || 1);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add Hearing State
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(initialCaseId || null);
  const [hearingDate, setHearingDate] = useState<string>(bizDateStr);
  const [hearingStage, setHearingStage] = useState<string>('SUMMONS');
  const [presenceType, setPresenceType] = useState<string>('संस्था व वकील हजर');
  const [courtOrderSummary, setCourtOrderSummary] = useState<string>('');
  const [nextHearingDate, setNextHearingDate] = useState<string>('');
  const [nextHearingPurpose, setNextHearingPurpose] = useState<string>('');
  const [advocateNotes, setAdvocateNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Grant Certificate / Award Modal
  const [grantingCase, setGrantingCase] = useState<CaseOption | null>(null);
  const [certificateNumber, setCertificateNumber] = useState<string>('');
  const [certificateDate, setCertificateDate] = useState<string>(bizDateStr);
  const [awardNumber, setAwardNumber] = useState<string>('');
  const [awardDate, setAwardDate] = useState<string>(bizDateStr);
  const [grantedAmount, setGrantedAmount] = useState<number>(0);
  const [grantedInterestRate, setGrantedInterestRate] = useState<number>(14.0);
  const [granting, setGranting] = useState<boolean>(false);

  // Update Case Status Modal (STAYED / DISMISSED / WITHDRAWN / CLOSED_RECOVERED)
  const [statusModalCase, setStatusModalCase] = useState<CaseOption | null>(null);
  const [nextStatus, setNextStatus] = useState<string>('STAYED');
  const [stayOrderNo, setStayOrderNo] = useState<string>('');
  const [stayOrderDate, setStayOrderDate] = useState<string>(bizDateStr);
  const [closedReason, setClosedReason] = useState<string>('');
  const [closedDate, setClosedDate] = useState<string>(bizDateStr);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  useEffect(() => {
    if (propBranchId && propBranchId > 0) setSelectedBranchId(propBranchId);
    else {
      const eff = getEffectiveBranchId(user, globalBranchId);
      if (typeof eff === 'number' && eff > 0) setSelectedBranchId(eff);
    }
  }, [propBranchId, user, globalBranchId]);

  useEffect(() => {
    setHearingDate(bizDateStr);
    setCertificateDate(bizDateStr);
    setAwardDate(bizDateStr);
    setStayOrderDate(bizDateStr);
    setClosedDate(bizDateStr);
  }, [bizDateStr]);

  useEffect(() => {
    if (initialCaseId && initialCaseId > 0) setSelectedCaseId(initialCaseId);
  }, [initialCaseId]);

  useEffect(() => {
    axios.get('/api/Branches').then((r) => Array.isArray(r.data) && setBranches(r.data)).catch(console.error);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchQuery = propEffectiveBranch === 'all' && isHo ? '' : `?branchId=${selectedBranchId}`;
      const [caseRes, hearingRes, upcomingRes] = await Promise.all([
        axios.get(`/api/LegalRecovery/cases${branchQuery}`),
        axios.get(`/api/LegalRecovery/hearings${branchQuery}`),
        axios.get(`/api/LegalRecovery/hearings/upcoming${branchQuery ? `${branchQuery}&days=30` : '?days=30'}`),
      ]);

      setCases(Array.isArray(caseRes.data) ? caseRes.data : []);
      setHearings(Array.isArray(hearingRes.data) ? hearingRes.data : []);
      setUpcomingHearings(Array.isArray(upcomingRes.data) ? upcomingRes.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranchId, propEffectiveBranch]);

  const handleAddHearing = async () => {
    if (!selectedCaseId) {
      alert('कृपया कोर्ट केस निवडा.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post('/api/LegalRecovery/hearing/add', {
        caseId: selectedCaseId,
        hearingDate,
        hearingStage,
        presenceType,
        courtOrderSummary,
        nextHearingDate: nextHearingDate || null,
        nextHearingPurpose,
        advocateNotes,
      });

      if (res.status === 200) {
        alert('सुनावणी डायरी नोंद यशस्वीरीत्या सेव्ह झाली!');
        setCourtOrderSummary('');
        setNextHearingDate('');
        setNextHearingPurpose('');
        setAdvocateNotes('');
        await fetchData();
        if (onDataChanged) onDataChanged();
      }
    } catch (e: any) {
      alert('नोंद सेव्ह करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenGrantModal = (c: CaseOption) => {
    const yr = (bizDateStr || '').slice(0, 4) || String(new Date().getFullYear());
    const cleanNo = (c.caseNumber || String(c.caseId)).replace(/[/\\]/g, '-');
    setGrantingCase(c);
    setCertificateNumber(c.caseType === 'SEC_91' ? `AWARD/${yr}/${cleanNo}` : `CERT/${yr}/${cleanNo}`);
    setCertificateDate(bizDateStr);
    setAwardNumber(c.caseType === 'SEC_91' ? `AWARD/${yr}/${cleanNo}` : '');
    setAwardDate(bizDateStr);
    setGrantedAmount(c.totalClaimAmount || 0);
    setGrantedInterestRate(14.0);
  };

  const handleGrantCertificate = async () => {
    if (!grantingCase) return;
    if (grantingCase.caseType !== 'SEC_91' && !certificateNumber.trim()) {
      alert('कृपया दाखला क्रमांक प्रविष्ट करा.');
      return;
    }
    if (grantingCase.caseType === 'SEC_91' && !awardNumber.trim() && !certificateNumber.trim()) {
      alert('कृपया निवाडा क्रमांक प्रविष्ट करा.');
      return;
    }

    setGranting(true);
    try {
      const res = await axios.post('/api/LegalRecovery/case/grant-certificate', {
        caseId: grantingCase.caseId,
        certificateNo: certificateNumber,
        certificateNumber,
        certificateDate,
        sanctionedAmount: Number(grantedAmount) || 0,
        grantedAmount: Number(grantedAmount) || 0,
        futureInterestRate: Number(grantedInterestRate) || 0,
        grantedInterestRate: Number(grantedInterestRate) || 0,
        awardNumber: grantingCase.caseType === 'SEC_91' ? awardNumber || certificateNumber : undefined,
        awardDate: grantingCase.caseType === 'SEC_91' ? awardDate || certificateDate : undefined,
      });

      if (res.status === 200) {
        alert(
          `${grantingCase.caseType === 'SEC_91' ? 'कलम ९१ निवाडा' : 'कलम १०१ वसुली दाखला'} यशस्वीरीत्या नोंदवला!\nक्र.: ${
            grantingCase.caseType === 'SEC_91' ? awardNumber || certificateNumber : certificateNumber
          }`
        );
        setGrantingCase(null);
        await fetchData();
        if (onDataChanged) onDataChanged();
      }
    } catch (e: any) {
      alert('दाखला नोंदवताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setGranting(false);
    }
  };

  const handleOpenStatusModal = (c: CaseOption) => {
    setStatusModalCase(c);
    setNextStatus('STAYED');
    setStayOrderNo('');
    setStayOrderDate(bizDateStr);
    setClosedReason('');
    setClosedDate(bizDateStr);
  };

  const handleUpdateCaseStatus = async () => {
    if (!statusModalCase) return;
    setUpdatingStatus(true);
    try {
      await axios.put(`/api/LegalRecovery/case/status/${statusModalCase.caseId}`, {
        status: nextStatus,
        stayOrderNo: nextStatus === 'STAYED' ? stayOrderNo : null,
        stayOrderDate: nextStatus === 'STAYED' ? stayOrderDate : null,
        closedReason,
        closedDate,
      });
      setStatusModalCase(null);
      await fetchData();
      if (onDataChanged) onDataChanged();
    } catch (e: any) {
      alert('प्रकरण स्थिती बदलताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const caseSelectOptions = cases.map((c) => ({
    value: c.caseId,
    label: `${c.caseNumber} - ${c.customerName || c.memberName} (CIF: ${c.cifNo || c.memberCode || '-'})`,
    subLabel: `खाते: ${c.loanAccountNo} | ₹${(c.totalClaimAmount || 0).toLocaleString('en-IN')}`,
  }));

  return (
    <div className={embedded ? 'max-w-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5' : 'p-2.5 max-w-full h-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5'}>
      {!embedded && (
        <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary shrink-0" />
              <h1 className="text-sm font-bold text-primary tracking-wide">कोर्ट केस डायरी व सुनावणी ट्रॅकर (Hearing Log & Certificate)</h1>
            </div>
            <p className="text-slate-500 text-[10.5px] mt-0.5">
              निबंधक / सहकारी न्यायालय सुनावणी तारखा, कोर्ट आदेश, स्थगिती नोंदी व कलम १०१ दाखला / कलम ९१ निवाडा मंजुरी.
            </p>
          </div>
        </div>
      )}

      {/* Branch Bar */}
      <div className="bg-white px-3 py-2 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-700">शाखा (Branch):</label>
          <select
            value={selectedBranchId}
            disabled={!isHo}
            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
            className="border border-gray-300 rounded-sm px-2.5 py-1 text-xs font-semibold text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:bg-gray-100"
          >
            {branches.map((b) => (
              <option key={b.branchID} value={b.branchID}>
                {b.branchName} ({b.branchCode})
              </option>
            ))}
          </select>
          <button type="button" onClick={fetchData} className="p-1.5 border border-gray-300 rounded-sm bg-white hover:bg-primary/10 hover:text-primary transition" title="रिफ्रेश करा">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <span className="text-[11px] text-gray-600 font-medium">
          केसेस: <strong className="text-primary">{cases.length}</strong> | सुनावण्या: <strong className="text-primary">{hearings.length}</strong> | आगामी ३० दिवसांत: <strong className="text-amber-700">{upcomingHearings.length}</strong>
        </span>
      </div>

      {/* Upcoming 30-day Hearings Strip */}
      {upcomingHearings.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-600 rounded-sm p-2.5 space-y-2">
          <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-700" />
            आगामी सुनावण्या (Next 30 Days Upcoming Hearings — क्लिक करून केस निवडा):
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingHearings.slice(0, 8).map((u: any) => (
              <button
                key={`${u.hearingId}-${u.caseId}`}
                type="button"
                onClick={() => setSelectedCaseId(u.caseId)}
                className="bg-white hover:bg-amber-100 border border-amber-300 rounded-sm px-2.5 py-1 text-left text-[10px] transition"
              >
                <div className="font-bold text-amber-950">
                  {u.nextHearingDate} — {u.caseNumber} ({u.customerName || u.memberName})
                </div>
                <div className="text-amber-800">{u.nextHearingPurpose || u.stageLabel || 'पुढील सुनावणी'}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: Add Hearing Form */}
        <div className="lg:col-span-5 bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-primary border-l-4 border-primary pl-2 flex items-center gap-1.5 border-b border-gray-100 pb-2">
            <Plus className="w-4 h-4 text-primary" />
            नवीन सुनावणी नोंद (Add Hearing Log)
          </h2>

          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-bold text-gray-700">केस निवडा (CIF / दावा क्र. / नाव):</label>
              <div className="mt-0.5">
                <SearchableSelect
                  options={caseSelectOptions}
                  value={selectedCaseId || ''}
                  onChange={(e) => setSelectedCaseId(Number(e.target.value) || null)}
                  placeholder="- केस निवडा -"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-700">सुनावणी तारीख:</label>
                <input type="date" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-700">सुनावणी टप्पा (Stage):</label>
                <select value={hearingStage} onChange={(e) => setHearingStage(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs font-semibold text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  {HEARING_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-700">हजेरी स्थिती (Presence):</label>
              <input type="text" value={presenceType} onChange={(e) => setPresenceType(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1 text-xs text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-700">कोर्ट आदेश / कार्यवाही सारांश:</label>
              <textarea rows={2} value={courtOrderSummary} onChange={(e) => setCourtOrderSummary(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm p-2 text-xs text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-2.5 rounded-sm border border-gray-200">
              <div>
                <label className="text-[10px] font-bold text-gray-700">पुढील सुनावणी तारीख:</label>
                <input type="date" value={nextHearingDate} onChange={(e) => setNextHearingDate(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-700">पुढील सुनावणीचे कामकाज:</label>
                <input type="text" value={nextHearingPurpose} onChange={(e) => setNextHearingPurpose(e.target.value)} placeholder="उदा. युक्तिवाद / निकाल" className="w-full mt-0.5 border border-gray-300 rounded-sm px-2 py-1 text-xs text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-700">वकिलांच्या नोंदी (Advocate Notes):</label>
              <input type="text" value={advocateNotes} onChange={(e) => setAdvocateNotes(e.target.value)} className="w-full mt-0.5 border border-gray-300 rounded-sm px-2.5 py-1 text-xs text-gray-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
            </div>

            <button
              type="button"
              onClick={handleAddHearing}
              disabled={submitting || !selectedCaseId}
              className="w-full py-2 rounded-sm font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 bg-primary hover:opacity-95 text-white"
            >
              {submitting ? 'नोंद सेव्ह होत आहे...' : 'सुनावणी नोंद सेव्ह करा'}
            </button>
          </div>
        </div>

        {/* Right: Cases & Hearings */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-2.5">
            <h3 className="text-xs font-bold text-primary border-l-4 border-primary pl-2 flex items-center justify-between border-b border-gray-100 pb-2">
              <span>चालू कोर्ट केसेस ({cases.length})</span>
              <span className="text-[10px] text-gray-500 font-normal">दाखला/निवाडा किंवा स्थगिती/तडजोड स्थिती अपडेट करा</span>
            </h3>

            <div className="max-h-[240px] overflow-y-auto space-y-2 pr-1">
              {cases.map((c) => {
                const st = c.status || c.caseStatus;
                const isCertDone = st === 'CERTIFIED' || st === 'CERTIFICATE_ISSUED' || st === 'AWARDED' || st === 'EXECUTION' || st === 'EXECUTION_RULE107' || st === 'CLOSED_RECOVERED';
                return (
                  <div key={c.caseId} className="p-2.5 rounded-sm border border-gray-200 hover:bg-primary/5 flex flex-wrap justify-between items-center gap-2 transition">
                    <div>
                      <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                        <span>{c.caseNumber} - {c.customerName || c.memberName}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-700">
                          {c.caseType === 'SEC_91' ? 'कलम ९१' : 'कलम १०१'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        खाते: {c.loanAccountNo} | CIF: {c.cifNo || c.memberCode || '-'} | दावा: ₹{(c.totalClaimAmount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${isCertDone ? 'bg-emerald-100 text-emerald-800' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                        {CASE_STATUS_LABELS[st] || st}
                      </span>
                      {!isCertDone && (
                        <button
                          type="button"
                          onClick={() => handleOpenGrantModal(c)}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold px-2 py-1 rounded-sm shadow-xs flex items-center gap-1"
                        >
                          <Award className="w-3 h-3" /> {c.caseType === 'SEC_91' ? 'निवाडा' : 'दाखला'}
                        </button>
                      )}
                      {st !== 'CLOSED_RECOVERED' && (
                        <button
                          type="button"
                          onClick={() => handleOpenStatusModal(c)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[10px] font-bold px-2 py-1 rounded-sm flex items-center gap-1"
                        >
                          <ShieldAlert className="w-3 h-3" /> स्थिती
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-2.5">
            <h3 className="text-xs font-bold text-primary border-l-4 border-primary pl-2 border-b border-gray-100 pb-2">सुनावणी डायरी इतिहास ({hearings.length})</h3>
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {hearings.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">कोणत्याही सुनावणी नोंदी आढळल्या नाहीत.</div>
              ) : (
                hearings.map((h) => (
                  <div key={h.hearingLogId} className="p-2.5 rounded-sm border border-gray-200 bg-slate-50/70 space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-xs text-gray-900">{h.caseNumber}</span>
                        <span className="text-[10px] text-gray-500 ml-2">({h.customerName || h.memberName})</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 bg-white border border-gray-200 px-1.5 py-0.2 rounded-sm">
                        तारीख: {h.hearingDate}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-700">
                      <strong>टप्पा:</strong> {h.stageLabel || h.hearingStage} | <strong>हजेरी:</strong> {h.presenceType}
                    </div>
                    {h.courtOrderSummary && (
                      <div className="text-[11px] text-gray-800 bg-white p-1.5 rounded-sm border border-gray-200">
                        <strong>आदेश:</strong> {h.courtOrderSummary}
                      </div>
                    )}
                    {h.nextHearingDate && (
                      <div className="text-[10px] font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" /> पुढील तारीख: {h.nextHearingDate} {h.nextHearingPurpose ? `(${h.nextHearingPurpose})` : ''}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grant Certificate / Award Modal */}
      {grantingCase && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border-t-4 border-t-primary max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b pb-3 text-emerald-800 font-bold text-sm">
              <Award className="w-5 h-5 text-emerald-600" />
              {grantingCase.caseType === 'SEC_91' ? 'कलम ९१ लवाद निवाडा (Award) मंजुरी नोंद' : 'कलम १०१ वसुली दाखला मंजुरी नोंद'}
            </div>

            <div className="bg-emerald-50 p-3 rounded-sm text-xs text-emerald-950 space-y-0.5 border border-emerald-200">
              <div className="font-bold">{grantingCase.customerName || grantingCase.memberName}</div>
              <div>दावा क्र.: {grantingCase.caseNumber} | खाते: {grantingCase.loanAccountNo}</div>
              <div>दावा रक्कम: ₹{(grantingCase.totalClaimAmount || 0).toLocaleString('en-IN')}</div>
            </div>

            <div className="space-y-3 text-xs">
              {grantingCase.caseType === 'SEC_91' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-gray-700">निवाडा क्रमांक (Award No.):</label>
                    <input type="text" value={awardNumber} onChange={(e) => setAwardNumber(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700">निवाडा दिनांक:</label>
                    <input type="date" value={awardDate} onChange={(e) => setAwardDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-gray-700">मंजूर दाखला क्रमांक:</label>
                    <input type="text" value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700">दाखला दिनांक:</label>
                    <input type="date" value={certificateDate} onChange={(e) => setCertificateDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700">मंजूर वसुली रक्कम (₹):</label>
                  <input type="number" value={grantedAmount} onChange={(e) => setGrantedAmount(Number(e.target.value))} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 font-black text-emerald-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="font-bold text-gray-700">मंजूर पुढील व्याजदर (%):</label>
                  <input type="number" value={grantedInterestRate} onChange={(e) => setGrantedInterestRate(Number(e.target.value))} className="w-full mt-1 border border-gray-300 rounded-sm px-2 py-1.5 font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setGrantingCase(null)} className="px-4 py-1.5 rounded-sm text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700">
                रद्द करा
              </button>
              <button type="button" onClick={handleGrantCertificate} disabled={granting} className="px-4 py-1.5 rounded-sm text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs">
                {granting ? 'नोंद होत आहे...' : 'सेव्ह करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Status Modal */}
      {statusModalCase && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border-t-4 border-t-primary max-w-md w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="font-bold text-sm text-primary border-b pb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              प्रकरण स्थिती बदला ({statusModalCase.caseNumber})
            </div>

            <div>
              <label className="font-bold text-gray-700">नवीन स्थिती (Status):</label>
              <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                <option value="STAYED">स्थगिती आदेश (STAYED)</option>
                <option value="HEARING">पुन्हा सुनावणीवर (HEARING / Stay Vacated)</option>
                <option value="WITHDRAWN">तडजोड / अर्ज मागे (WITHDRAWN / OTS)</option>
                <option value="DISMISSED">फेटाळलेला (DISMISSED)</option>
                <option value="CLOSED_RECOVERED">पूर्ण वसूल / बंद (CLOSED_RECOVERED)</option>
              </select>
            </div>

            {nextStatus === 'STAYED' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700">स्थगिती आदेश क्र.:</label>
                  <input type="text" value={stayOrderNo} onChange={(e) => setStayOrderNo(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="font-bold text-gray-700">आदेश दिनांक:</label>
                  <input type="date" value={stayOrderDate} onChange={(e) => setStayOrderDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                </div>
              </div>
            ) : (
              <div>
                <label className="font-bold text-gray-700">दिनांक:</label>
                <input type="date" value={closedDate} onChange={(e) => setClosedDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
            )}

            <div>
              <label className="font-bold text-gray-700">सविस्तर कारण / आदेश शेरा:</label>
              <input type="text" value={closedReason} onChange={(e) => setClosedReason(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-sm px-2.5 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setStatusModalCase(null)} className="px-4 py-1.5 rounded-sm font-bold bg-gray-100 text-gray-700">
                रद्द करा
              </button>
              <button type="button" onClick={handleUpdateCaseStatus} disabled={updatingStatus} className="px-4 py-1.5 rounded-sm font-bold bg-primary hover:opacity-95 text-white">
                {updatingStatus ? 'सेव्ह होत आहे...' : 'स्थिती अपडेट करा'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
