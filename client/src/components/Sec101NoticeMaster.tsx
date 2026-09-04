import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Printer, Search, Plus, Send, CheckCircle2, AlertTriangle, ShieldAlert, Clock, ArrowRight, Eye } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface EligibleLoan {
  loanAccountID: number;
  branchID: number;
  branchName: string;
  loanAccountNo: string;
  memberID: number;
  memberName: string;
  memberCode: string;
  mobileNo: string;
  address: string;
  coMemberName?: string;
  coMember2Name?: string;
  loanScheme: string;
  principalBalance: number;
  interestBalance: number;
  overdueInterestBalance: number;
  totalOutstanding: number;
  openingDate: string;
  dueDate: string;
}

interface NoticeRecord {
  noticeId: number;
  branchId: number;
  branchName: string;
  loanAccountId: number;
  loanAccountNo: string;
  memberId: number;
  memberName: string;
  memberCode: string;
  address: string;
  mobileNo: string;
  noticeType: string;
  noticeNumber: string;
  noticeDate: string;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  penalInterestDue: number;
  noticeFee: number;
  totalDemandAmount: number;
  postalTrackingNo: string;
  postalStatus: string;
  deliveredDate?: string;
  remarks?: string;
}

interface SansthaDetails {
  sansthaName?: string;
  address?: string;
  registrationNo?: string;
  phoneNo?: string;
}

export default function Sec101NoticeMaster() {
  const [loans, setLoans] = useState<EligibleLoan[]>([]);
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [sanstha, setSanstha] = useState<SansthaDetails | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  
  // Selected Loan for Notice Generation
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [noticeType, setNoticeType] = useState<string>('NOTICE_1');
  const [noticeDate, setNoticeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [principalDue, setPrincipalDue] = useState<number>(0);
  const [interestDue, setInterestDue] = useState<number>(0);
  const [penalInterestDue, setPenalInterestDue] = useState<number>(0);
  const [noticeFee, setNoticeFee] = useState<number>(100);
  const [postalTrackingNo, setPostalTrackingNo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);

  // Print Modal State
  const [printNotice, setPrintNotice] = useState<any | null>(null);

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
          accentBorder: 'border-emerald-500 bg-emerald-50 text-emerald-950',
          activeTabClass: 'bg-emerald-700 text-white'
        };
      case 'wine-red':
        return {
          bannerGrad: 'from-[#380413] via-[#880E4F] to-[#4c0519]',
          btnPrimary: 'bg-[#880E4F] hover:bg-rose-900 text-white',
          accentBorder: 'border-rose-500 bg-rose-50 text-rose-950',
          activeTabClass: 'bg-rose-800 text-white'
        };
      case 'blue':
      default:
        return {
          bannerGrad: 'from-slate-950 via-[#005689] to-blue-900',
          btnPrimary: 'bg-[#005689] hover:bg-blue-800 text-white',
          accentBorder: 'border-blue-500 bg-blue-50 text-blue-950',
          activeTabClass: 'bg-blue-800 text-white'
        };
    }
  };

  const theme = getThemeConfig();

  useEffect(() => {
    fetchBranches();
    fetchSanstha();
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

  const fetchSanstha = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (res.data && res.data.length > 0) setSanstha(res.data[0]);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loanRes, noticeRes] = await Promise.all([
        axios.get(`/api/LegalRecovery/eligible-loans?branchId=${selectedBranchId}`),
        axios.get(`/api/LegalRecovery/notices?branchId=${selectedBranchId}`)
      ]);

      if (loanRes.data) {
        const loanData: EligibleLoan[] = loanRes.data;
        setLoans(loanData);
        if (loanData.length > 0 && !selectedLoanId) {
          handleSelectLoan(loanData[0].loanAccountID, loanData);
        }
      }
      if (noticeRes.data) setNotices(noticeRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLoan = (loanId: number, fallbackList?: EligibleLoan[]) => {
    setSelectedLoanId(loanId);
    const list = fallbackList || loans;
    const found = list.find((l) => l.loanAccountID === loanId);
    if (found) {
      setPrincipalDue(found.principalBalance || 0);
      setInterestDue(found.interestBalance || 0);
      setPenalInterestDue(found.overdueInterestBalance || 0);
    }
  };

  const handleGenerateNotice = async () => {
    if (!selectedLoanId) {
      alert('कृपया प्रथम कर्जदार खाते निवडा.');
      return;
    }

    setGenerating(true);
    try {
      const res = await axios.post('/api/LegalRecovery/notice/generate', {
        branchId: selectedBranchId,
        loanAccountId: selectedLoanId,
        noticeType,
        noticeDate,
        dueDate,
        principalDue,
        interestDue,
        penalInterestDue,
        noticeFee,
        postalTrackingNo,
        remarks
      });

      if (res.status === 200) {
        const result = res.data;
        alert(`नोटीस यशस्वीरीत्या तयार झाली!\nनोटीस क्र: ${result.noticeNumber}\nएकूण मागणी रक्कम: ₹${result.totalDemandAmount}`);
        fetchData();
        setActiveTab('history');
      } else {
        alert('नोटीस तयार करताना त्रुटी आली.');
      }
    } catch (e: any) {
      console.error(e);
      alert('नोटीस तयार करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const openPrintModal = (record: any) => {
    setPrintNotice(record);
  };

  const totalDemand = Number(principalDue) + Number(interestDue) + Number(penalInterestDue) + Number(noticeFee);
  const selectedLoan = loans.find((l) => l.loanAccountID === selectedLoanId);

  return (
    <div className="p-3 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans space-y-3">
      {/* Header Banner */}
      <div className={`bg-gradient-to-r ${theme.bannerGrad} text-white p-4 rounded-xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3`}>
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-300" />
            <h1 className="text-base font-bold tracking-wide">३-टप्प्यांच्या कायदेशीर वसुली नोटिसा (3-Tier Legal Demand Notices)</h1>
          </div>
          <p className="text-white/80 text-[11px] mt-0.5">
            १ली नोटीस (३० दिवस), २री नोटीस (६० दिवस) व कलम १०१ अंतिम इशारा कायदेशीर नोटीस (१५ दिवस) - स्पीड पोस्ट ट्रॅकिंगसह.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'bg-black/20 text-white hover:bg-black/30'
            }`}
          >
            + नवीन नोटीस काढा (New Notice)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'bg-black/20 text-white hover:bg-black/30'
            }`}
          >
            नोटीस इतिहास ({notices.length})
          </button>
        </div>
      </div>

      {/* Branch Selector */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-700">शाखा निवडा (Branch):</label>
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
        <div className="text-[11px] text-gray-500 font-medium">
          थकबाकीदार खाती: <strong>{loans.length}</strong> | जारी केलेल्या नोटिसा: <strong>{notices.length}</strong>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Overdue Loan Selector */}
          <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 border-b pb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              थकबाकीदार कर्ज खाती (Select Borrower)
            </h2>

            <div className="max-h-[480px] overflow-y-auto space-y-2 pr-1">
              {loans.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  या शाखेत कोणतीही थकबाकीदार खाती आढळली नाहीत.
                </div>
              ) : (
                loans.map((loan) => {
                  const isSelected = selectedLoanId === loan.loanAccountID;
                  return (
                    <div
                      key={loan.loanAccountID}
                      onClick={() => handleSelectLoan(loan.loanAccountID)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition ${
                        isSelected
                          ? `${theme.accentBorder} shadow-xs font-bold`
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-xs text-gray-900">{loan.memberName}</div>
                          <div className="text-[10px] text-gray-500 font-mono">खाते क्र: {loan.loanAccountNo} | कोड: {loan.memberCode}</div>
                        </div>
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                          ₹{loan.totalOutstanding.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                        <span>योजना: {loan.loanScheme}</span>
                        <span>दंडव्याज: ₹{loan.overdueInterestBalance.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Notice Generation Form */}
          <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 border-b pb-2">
              <FileText className="w-4 h-4 text-primary" />
              नोटीस तपशील व मागणी पत्र (Notice Preparation)
            </h2>

            {selectedLoan ? (
              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs text-gray-700 space-y-0.5">
                <div className="font-bold text-gray-900">{selectedLoan.memberName}</div>
                <div className="text-[11px]">पत्ता: {selectedLoan.address} | मो: {selectedLoan.mobileNo}</div>
                {selectedLoan.coMemberName && (
                  <div className="text-gray-600 text-[10px]">जामीनदार १: {selectedLoan.coMemberName}</div>
                )}
                {selectedLoan.coMember2Name && (
                  <div className="text-gray-600 text-[10px]">जामीनदार २: {selectedLoan.coMember2Name}</div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs">
                👈 डाव्या बाजूने थकबाकीदार कर्जदार खाते निवडा.
              </div>
            )}

            {/* Notice Type Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-700">नोटीसचा प्रकार (Notice Stage):</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNoticeType('NOTICE_1')}
                  className={`p-2.5 rounded-lg text-left border transition ${
                    noticeType === 'NOTICE_1'
                      ? 'border-amber-600 bg-amber-50 text-amber-950 font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xs font-bold">१ली नोटीस (Warning)</div>
                  <div className="text-[10px] text-gray-500">३० दिवस स्मरणपत्र</div>
                </button>

                <button
                  type="button"
                  onClick={() => setNoticeType('NOTICE_2')}
                  className={`p-2.5 rounded-lg text-left border transition ${
                    noticeType === 'NOTICE_2'
                      ? 'border-orange-600 bg-orange-50 text-orange-950 font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xs font-bold">२री नोटीस (Demand)</div>
                  <div className="text-[10px] text-gray-500">६० दिवस संयुक्त मागणी</div>
                </button>

                <button
                  type="button"
                  onClick={() => setNoticeType('FINAL_NOTICE')}
                  className={`p-2.5 rounded-lg text-left border transition ${
                    noticeType === 'FINAL_NOTICE'
                      ? 'border-rose-600 bg-rose-50 text-rose-950 font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xs font-bold">कलम १०१ अंतिम नोटीस</div>
                  <div className="text-[10px] text-gray-500">१५ दिवसांची अंतिम मुदत</div>
                </button>
              </div>
            </div>

            {/* Dates & Amounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700">नोटीस तारीख (Notice Date):</label>
                <input
                  type="date"
                  value={noticeDate}
                  onChange={(e) => setNoticeDate(e.target.value)}
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700">भरण्याची मुदत तारीख (Due Date):</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div>
                <label className="text-[10px] font-medium text-gray-600">थकीत मुद्दल:</label>
                <input
                  type="number"
                  value={principalDue}
                  onChange={(e) => setPrincipalDue(Number(e.target.value))}
                  className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-600">नियमित व्याज:</label>
                <input
                  type="number"
                  value={interestDue}
                  onChange={(e) => setInterestDue(Number(e.target.value))}
                  className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-600">दंडव्याज:</label>
                <input
                  type="number"
                  value={penalInterestDue}
                  onChange={(e) => setPenalInterestDue(Number(e.target.value))}
                  className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-600">नोटीस फी:</label>
                <input
                  type="number"
                  value={noticeFee}
                  onChange={(e) => setNoticeFee(Number(e.target.value))}
                  className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-gray-800"
                />
              </div>
            </div>

            {/* Total Demand Highlight */}
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg flex justify-between items-center">
              <div>
                <div className="text-[11px] font-bold text-rose-900 uppercase">एकूण मागणी रक्कम:</div>
                <div className="text-[10px] text-rose-600">मुद्दल + व्याज + दंडव्याज + नोटीस खर्च</div>
              </div>
              <div className="text-xl font-black text-rose-700">₹{totalDemand.toLocaleString('en-IN')}</div>
            </div>

            {/* Postal Tracking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700">स्पीड पोस्ट / RPAD बारकोड क्र.:</label>
                <input
                  type="text"
                  placeholder="उदा. EM123456789IN"
                  value={postalTrackingNo}
                  onChange={(e) => setPostalTrackingNo(e.target.value)}
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700">नोंद / शेरा (Remarks):</label>
                <input
                  type="text"
                  placeholder="उदा. टपालाने पाठवली / समक्ष दिली"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-800"
                />
              </div>
            </div>

            <button
              onClick={handleGenerateNotice}
              disabled={generating || !selectedLoanId}
              className={`w-full py-2.5 rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50 ${theme.btnPrimary}`}
            >
              {generating ? 'नोटीस तयार होत आहे...' : 'कायदेशीर नोटीस तयार करा व सेव्ह करा (Generate Notice)'}
            </button>
          </div>
        </div>
      ) : (
        /* History Table */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-3 bg-gray-100/70 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-800">जारी केलेल्या कायदेशीर नोटिसांची यादी</h2>
            <span className="text-[11px] font-bold text-gray-500">एकूण {notices.length} नोटिसा</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] text-gray-700">
              <thead className="bg-gray-100 text-[11px] font-bold text-gray-700 uppercase border-b">
                <tr>
                  <th className="p-2.5">नोटीस क्र. व तारीख</th>
                  <th className="p-2.5">कर्जदार नाव व खाते</th>
                  <th className="p-2.5">नोटीस प्रकार</th>
                  <th className="p-2.5">मागणी रक्कम</th>
                  <th className="p-2.5">मुदत तारीख</th>
                  <th className="p-2.5">टपाल बारकोड व स्थिती</th>
                  <th className="p-2.5 text-center">कृती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {notices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-400">
                      कोणत्याही नोटिसा आढळल्या नाहीत.
                    </td>
                  </tr>
                ) : (
                  notices.map((n) => (
                    <tr key={n.noticeId} className="hover:bg-gray-50/80 transition">
                      <td className="p-2.5 font-bold text-gray-900">
                        <div>{n.noticeNumber}</div>
                        <div className="text-[10px] text-gray-500 font-normal">{n.noticeDate}</div>
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-gray-900">{n.memberName}</div>
                        <div className="text-[10px] text-gray-500">खाते: {n.loanAccountNo} | {n.mobileNo}</div>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            n.noticeType === 'FINAL_NOTICE'
                              ? 'bg-rose-100 text-rose-800'
                              : n.noticeType === 'NOTICE_2'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {n.noticeType === 'FINAL_NOTICE'
                            ? 'कलम १०१ अंतिम नोटीस'
                            : n.noticeType === 'NOTICE_2'
                            ? '२री नोटीस'
                            : '१ली नोटीस'}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-rose-700">₹{n.totalDemandAmount.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-gray-600">{n.dueDate}</td>
                      <td className="p-2.5 text-[10px]">
                        <div className="font-mono font-bold text-gray-800">{n.postalTrackingNo || '-'}</div>
                        <span className="font-bold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">
                          {n.postalStatus}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => openPrintModal(n)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs inline-flex items-center gap-1 border border-gray-300"
                        >
                          <Printer className="w-3 h-3" /> प्रिंट
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

      {/* Print Notice Modal */}
      {printNotice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl space-y-6">
            {/* Header / Sanstha */}
            <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-wide">
                {sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h2>
              <p className="text-xs text-slate-600">{sanstha?.address}</p>
              <p className="text-xs text-slate-600">नोंदणी क्र.: {sanstha?.registrationNo} | फोन: {sanstha?.phoneNo}</p>
            </div>

            {/* Notice Title */}
            <div className="text-center">
              <span className="bg-rose-100 text-rose-900 border border-rose-300 text-sm font-extrabold px-4 py-1 rounded-full uppercase tracking-wider">
                {printNotice.noticeType === 'FINAL_NOTICE'
                  ? 'महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे कलम १०१ अन्वये अंतिम कायदेशीर मागणी नोटीस'
                  : 'थकबाकी कर्ज वसुली मागणी नोटीस'}
              </span>
            </div>

            <div className="flex justify-between text-xs text-slate-700 font-semibold">
              <div>जावक क्र.: {printNotice.noticeNumber}</div>
              <div>दिनांक: {printNotice.noticeDate}</div>
            </div>

            {/* Borrower Details */}
            <div className="text-xs text-slate-800 space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div><strong>प्रति (कर्जदार):</strong> {printNotice.memberName}</div>
              <div><strong>पत्ता:</strong> {printNotice.address}</div>
              <div><strong>कर्ज खाते क्र.:</strong> {printNotice.loanAccountNo} | <strong>मोबाईल:</strong> {printNotice.mobileNo}</div>
            </div>

            {/* Notice Content Body */}
            <div className="text-xs text-slate-800 leading-relaxed space-y-3 text-justify">
              <p>महोदय / महोदया,</p>
              <p>
                आपण संस्थेकडून कर्ज खाते क्र. <strong>{printNotice.loanAccountNo}</strong> अन्वये कर्ज घेतले होते. कर्जाच्या अटी व शर्तीनुसार आपण नियमित हप्ते भरणे बंधनकारक होते. परंतु वारंवार सूचना देऊनही आपण कर्जाची परतफेड केलेली नाही.
              </p>
              <p>सदर नोटीस दिनांकापर्यंत आपल्या खात्यावर खालीलप्रमाणे रक्कम थकीत आहे:</p>

              <table className="w-full border text-xs border-slate-300">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border p-2">तपशील</th>
                    <th className="border p-2 text-right">रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">१. थकीत मुद्दल (Principal Overdue)</td>
                    <td className="border p-2 text-right">₹{printNotice.principalDue?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="border p-2">२. थकीत नियमित व्याज (Interest Overdue)</td>
                    <td className="border p-2 text-right">₹{printNotice.interestDue?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="border p-2">३. दंडव्याज (Penal Interest)</td>
                    <td className="border p-2 text-right">₹{printNotice.penalInterestDue?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="border p-2">४. नोटीस व टपाल खर्च (Notice Fee)</td>
                    <td className="border p-2 text-right">₹{printNotice.noticeFee?.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="bg-rose-50 font-bold text-rose-900">
                    <td className="border p-2">एकूण मागणी रक्कम (Total Demand)</td>
                    <td className="border p-2 text-right text-sm">₹{printNotice.totalDemandAmount?.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>

              <p className="font-semibold text-rose-900">
                तरी ही नोटीस मिळाल्यापासून <strong>{printNotice.dueDate}</strong> पर्यंत वरील एकूण रक्कम ₹{printNotice.totalDemandAmount?.toLocaleString('en-IN')} संस्थेत भरून पावती घ्यावी.
              </p>
              <p>
                मुदतीत रक्कम न भरल्यास, महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे <strong>कलम १०१ अन्वये मा. सहाय्यक/उपनिबंधक यांच्याकडे वसुली दाखला मिळवण्यासाठी दावा दाखल केला जाईल</strong>, तसेच नियम १०७ अन्वये स्थावर/जंगम मालमत्ता जप्ती व लिलाव कारवाई करण्यात येईल, याची नोंद घ्यावी.
              </p>
            </div>

            {/* Signature Block */}
            <div className="flex justify-between items-end pt-6 text-xs font-bold text-slate-800">
              <div>
                <p>टपाल पोहोच: {printNotice.postalTrackingNo || 'हातोहात / स्पीड पोस्ट'}</p>
              </div>
              <div className="text-center space-y-6">
                <p>आपला नम्र,</p>
                <p>शाखा व्यवस्थापक / मुख्य कार्यकारी अधिकारी<br />{sanstha?.sansthaName || 'सहकारी पतसंस्था'}</p>
              </div>
            </div>

            {/* Print Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <button
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" /> प्रिंट काढा (Print Notice)
              </button>
              <button
                onClick={() => setPrintNotice(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-xl font-bold text-xs"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
