import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, Plus, CheckCircle, Award, AlertCircle, FileText, ArrowRight, UserCheck } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface HearingRecord {
  hearingLogId: number;
  caseId: number;
  caseNumber: string;
  memberName: string;
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
  caseNumber: string;
  memberName: string;
  memberCode: string;
  loanAccountNo: string;
  caseStatus: string;
  totalClaimAmount: number;
}

const HEARING_STAGES = [
  { value: 'SUMMONS', label: '१. समन्स बजावणी (Summons Service)' },
  { value: 'WRITTEN_STATEMENT', label: '२. गैरअर्जदाराचा लेखी जबाब (Written Statement)' },
  { value: 'EVIDENCE', label: '३. पतसंस्थेचे पुरावे व शपथपत्र (Evidence / Affidavit)' },
  { value: 'ARGUMENT', label: '४. अंतिम युक्तिवाद (Final Arguments)' },
  { value: 'ORDER_PASSED', label: '५. निकाल / दाखला मंजुरी (Order / Certificate Grant)' }
];

export default function Sec101HearingDiary() {
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [hearings, setHearings] = useState<HearingRecord[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add Hearing Form State
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [hearingDate, setHearingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [hearingStage, setHearingStage] = useState<string>('SUMMONS');
  const [presenceType, setPresenceType] = useState<string>('संस्था व वकील हजर');
  const [courtOrderSummary, setCourtOrderSummary] = useState<string>('');
  const [nextHearingDate, setNextHearingDate] = useState<string>('');
  const [nextHearingPurpose, setNextHearingPurpose] = useState<string>('');
  const [advocateNotes, setAdvocateNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Grant Certificate Modal
  const [grantingCase, setGrantingCase] = useState<CaseOption | null>(null);
  const [certificateNumber, setCertificateNumber] = useState<string>('');
  const [certificateDate, setCertificateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [grantedAmount, setGrantedAmount] = useState<number>(0);
  const [grantedInterestRate, setGrantedInterestRate] = useState<number>(14.0);
  const [granting, setGranting] = useState<boolean>(false);

  // Dynamic Theme Hook
  const getInitialTheme = () => {
    return document.documentElement.getAttribute('data-theme') || 
           localStorage.getItem('app-theme') || 
           'blue';
  };

  const [appTheme, setAppTheme] = useState(getInitialTheme);

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute('data-theme') || 
                      localStorage.getItem('app-theme') || 
                      'blue';
      setAppTheme(current);
    };

    window.addEventListener('storage', updateTheme);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateTheme();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => {
      window.removeEventListener('storage', updateTheme);
      observer.disconnect();
    };
  }, []);

  const getThemeConfig = () => {
    switch (appTheme) {
      case 'green':
        return {
          bannerGrad: 'from-emerald-950 via-[#0E8A5A] to-teal-900',
          btnPrimary: 'bg-[#0E8A5A] hover:bg-emerald-700 text-white',
          badgeText: 'text-emerald-800 bg-emerald-100'
        };
      case 'wine-red':
        return {
          bannerGrad: 'from-[#380413] via-[#880E4F] to-[#4c0519]',
          btnPrimary: 'bg-[#880E4F] hover:bg-rose-900 text-white',
          badgeText: 'text-rose-800 bg-rose-100'
        };
      case 'blue':
      default:
        return {
          bannerGrad: 'from-slate-950 via-[#005689] to-blue-900',
          btnPrimary: 'bg-[#005689] hover:bg-blue-800 text-white',
          badgeText: 'text-blue-800 bg-blue-100'
        };
    }
  };

  const theme = getThemeConfig();

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedBranchId]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      if (res.data) setBranches(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [caseRes, hearingRes] = await Promise.all([
        axios.get(`/api/LegalRecovery/cases?branchId=${selectedBranchId}`),
        axios.get(`/api/LegalRecovery/hearings?branchId=${selectedBranchId}`)
      ]);

      if (caseRes.data) setCases(caseRes.data);
      if (hearingRes.data) setHearings(hearingRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
        advocateNotes
      });

      if (res.status === 200) {
        alert('सुनावणी डायरी नोंद यशस्वीरीत्या सेव्ह झाली!');
        setCourtOrderSummary('');
        setNextHearingDate('');
        setNextHearingPurpose('');
        setAdvocateNotes('');
        fetchData();
      } else {
        alert('नोंद सेव्ह करताना त्रुटी आली.');
      }
    } catch (e: any) {
      console.error(e);
      alert('नोंद सेव्ह करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenGrantModal = (c: CaseOption) => {
    setGrantingCase(c);
    setCertificateNumber(`CERT/${new Date().getFullYear()}/${c.caseNumber.replace(/\//g, '-')}`);
    setGrantedAmount(c.totalClaimAmount);
  };

  const handleGrantCertificate = async () => {
    if (!grantingCase || !certificateNumber) {
      alert('कृपया दाखला क्रमांक प्रविष्ट करा.');
      return;
    }

    setGranting(true);
    try {
      const res = await axios.post('/api/LegalRecovery/case/grant-certificate', {
        caseId: grantingCase.caseId,
        certificateNumber,
        certificateDate,
        grantedAmount,
        grantedInterestRate
      });

      if (res.status === 200) {
        alert(`कलम १०१ वसुली दाखला यशस्वीरीत्या नोंदवला गेला!\nदाखला क्र.: ${certificateNumber}`);
        setGrantingCase(null);
        fetchData();
      } else {
        alert('दाखला नोंदवताना त्रुटी आली.');
      }
    } catch (e: any) {
      console.error(e);
      alert('दाखला नोंदवताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="p-3 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans space-y-3">
      {/* Header Banner */}
      <div className={`bg-gradient-to-r ${theme.bannerGrad} text-white p-4 rounded-xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3`}>
        <div>
          <div className="flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-amber-300" />
            <h1 className="text-base font-bold tracking-wide">कोर्ट केस डायरी व सुनावणी ट्रॅकर (Court Case Diary & Hearing Log)</h1>
          </div>
          <p className="text-white/80 text-[11px] mt-0.5">
            निबंधक कोर्टातील सुनावणीच्या तारखा, कोर्ट आदेश, वकिलांच्या नोंदी व कलम १०१ वसुली दाखला मंजुरी नोंद.
          </p>
        </div>
      </div>

      {/* Branch Selector */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-700">शाखा निवडा (Select Branch):</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white"
          >
            {branches.map((b) => (
              <option key={b.branchID} value={b.branchID}>
                {b.branchName} ({b.branchCode})
              </option>
            ))}
          </select>
        </div>
        <span className="text-[11px] text-gray-500 font-medium">एकूण केसेस: {cases.length} | सुनावणी नोंदी: {hearings.length}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Add Hearing Log Form */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 border-b pb-2">
            <Plus className="w-4 h-4 text-primary" />
            नवीन सुनावणी नोंद (Add Hearing Log)
          </h2>

          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-bold text-gray-700">केस निवडा (Select Case):</label>
              <select
                value={selectedCaseId || ''}
                onChange={(e) => setSelectedCaseId(Number(e.target.value))}
                className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-bold text-gray-900 bg-white"
              >
                <option value="">- केस निवडा -</option>
                {cases.map((c) => (
                  <option key={c.caseId} value={c.caseId}>
                    {c.caseNumber} - {c.memberName} (₹{c.totalClaimAmount.toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-700">सुनावणी तारीख:</label>
                <input
                  type="date"
                  value={hearingDate}
                  onChange={(e) => setHearingDate(e.target.value)}
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-700">सुनावणी टप्पा (Stage):</label>
                <select
                  value={hearingStage}
                  onChange={(e) => setHearingStage(e.target.value)}
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2 py-1 text-xs font-semibold text-gray-800 bg-white"
                >
                  {HEARING_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-700">हजेरी स्थिती (Presence):</label>
              <input
                type="text"
                value={presenceType}
                onChange={(e) => setPresenceType(e.target.value)}
                placeholder="उदा. संस्था वकील हजर, कर्जदार गैरहजर"
                className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1 text-xs text-gray-800"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-700">कोर्ट आदेश / कार्यवाही सारांश (Court Order):</label>
              <textarea
                rows={2}
                value={courtOrderSummary}
                onChange={(e) => setCourtOrderSummary(e.target.value)}
                placeholder="मा. कोर्टाने दिलेला आदेश किंवा आज झालेली कार्यवाही..."
                className="w-full mt-0.5 border border-gray-300 rounded-md p-2 text-xs text-gray-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
              <div>
                <label className="text-[10px] font-bold text-gray-700">पुढील सुनावणी तारीख:</label>
                <input
                  type="date"
                  value={nextHearingDate}
                  onChange={(e) => setNextHearingDate(e.target.value)}
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-700">पुढील सुनावणीचे कामकाज:</label>
                <input
                  type="text"
                  value={nextHearingPurpose}
                  onChange={(e) => setNextHearingPurpose(e.target.value)}
                  placeholder="उदा. अंतिम युक्तिवाद / निकाल"
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-800"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-700">वकिलांच्या नोंदी / सूचना (Advocate Notes):</label>
              <input
                type="text"
                value={advocateNotes}
                onChange={(e) => setAdvocateNotes(e.target.value)}
                placeholder="वकिलांनी दिलेल्या महत्त्वाच्या सूचना..."
                className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1 text-xs text-gray-800"
              />
            </div>

            <button
              onClick={handleAddHearing}
              disabled={submitting || !selectedCaseId}
              className={`w-full py-2 rounded-lg font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 ${theme.btnPrimary}`}
            >
              {submitting ? 'नोंद सेव्ह होत आहे...' : 'सुनावणी नोंद सेव्ह करा (Save Hearing Log)'}
            </button>
          </div>
        </div>

        {/* Right: Active Cases & Diary Timeline */}
        <div className="lg:col-span-7 space-y-3">
          {/* Active Cases Grid with Quick Action for Certificate */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-gray-800 flex items-center justify-between border-b pb-2">
              <span>चालू कोर्ट केसेस ({cases.length})</span>
              <span className="text-[10px] text-gray-500 font-normal">दाखला मंजूर करण्यासाठी 'दाखला नोंदवा' क्लिक करा</span>
            </h3>

            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
              {cases.map((c) => (
                <div key={c.caseId} className="p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-xs text-gray-900">{c.caseNumber} - {c.memberName}</div>
                    <div className="text-[10px] text-gray-500">खाते: {c.loanAccountNo} | दावा रक्कम: ₹{c.totalClaimAmount.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${c.caseStatus === 'CERTIFICATE_ISSUED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                      {c.caseStatus}
                    </span>
                    {c.caseStatus !== 'CERTIFICATE_ISSUED' && (
                      <button
                        onClick={() => handleOpenGrantModal(c)}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xs flex items-center gap-1"
                      >
                        <Award className="w-3 h-3" /> दाखला नोंदवा
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Hearing Logs Timeline */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-gray-800 border-b pb-2">
              सुनावणी डायरी इतिहास ({hearings.length})
            </h3>

            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {hearings.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">कोणत्याही सुनावणी नोंदी आढळल्या नाहीत.</div>
              ) : (
                hearings.map((h) => (
                  <div key={h.hearingLogId} className="p-3 rounded-lg border border-gray-200 bg-gray-50/70 space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-xs text-gray-900">{h.caseNumber}</span>
                        <span className="text-[10px] text-gray-500 ml-2">({h.memberName})</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 bg-white border px-1.5 py-0.2 rounded">
                        तारीख: {h.hearingDate}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-700">
                      <strong>टप्पा:</strong> {h.stageLabel || h.hearingStage} | <strong>हजेरी:</strong> {h.presenceType}
                    </div>
                    {h.courtOrderSummary && (
                      <div className="text-[11px] text-gray-800 bg-white p-1.5 rounded border border-gray-200">
                        <strong>आदेश:</strong> {h.courtOrderSummary}
                      </div>
                    )}
                    {h.nextHearingDate && (
                      <div className="text-[10px] font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded flex items-center gap-1">
                        <Clock className="w-3 h-3" /> पुढील तारीख: {h.nextHearingDate} ({h.nextHearingPurpose})
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grant Certificate Modal */}
      {grantingCase && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b pb-3 text-emerald-800 font-bold text-base">
              <Award className="w-6 h-6 text-emerald-600" />
              कलम १०१ वसुली दाखला मंजुरी नोंद
            </div>

            <div className="bg-emerald-50 p-3 rounded-lg text-xs text-emerald-950 space-y-0.5 border border-emerald-200">
              <div className="font-bold">{grantingCase.memberName}</div>
              <div>दावा क्र.: {grantingCase.caseNumber} | खाते: {grantingCase.loanAccountNo}</div>
              <div>दावा रक्कम: ₹{grantingCase.totalClaimAmount.toLocaleString('en-IN')}</div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700">मंजूर दाखला क्रमांक (Certificate No.):</label>
                <input
                  type="text"
                  value={certificateNumber}
                  onChange={(e) => setCertificateNumber(e.target.value)}
                  className="w-full mt-1 border rounded-md px-2.5 py-1.5 font-bold text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700">दाखला तारीख:</label>
                  <input
                    type="date"
                    value={certificateDate}
                    onChange={(e) => setCertificateDate(e.target.value)}
                    className="w-full mt-1 border rounded-md px-2 py-1.5"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700">मंजूर व्याजदर (%):</label>
                  <input
                    type="number"
                    value={grantedInterestRate}
                    onChange={(e) => setGrantedInterestRate(Number(e.target.value))}
                    className="w-full mt-1 border rounded-md px-2 py-1.5 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700">मंजूर दाखला रक्कम (Granted Amount ₹):</label>
                <input
                  type="number"
                  value={grantedAmount}
                  onChange={(e) => setGrantedAmount(Number(e.target.value))}
                  className="w-full mt-1 border rounded-md px-2.5 py-1.5 font-black text-emerald-700 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setGrantingCase(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                रद्द करा
              </button>
              <button
                onClick={handleGrantCertificate}
                disabled={granting}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
              >
                {granting ? 'दाखला नोंदवत आहे...' : 'दाखला नोंदवा (Save Certificate)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
