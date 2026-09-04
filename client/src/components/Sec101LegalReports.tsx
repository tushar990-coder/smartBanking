import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileSpreadsheet, Download, Search, Printer, DollarSign, Scale, Calendar, Plus, RefreshCw } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface CaseReportItem {
  caseId: number;
  caseNumber: string;
  loanAccountNo: string;
  memberCode: string;
  memberName: string;
  courtName: string;
  filingDate: string;
  totalClaimAmount: number;
  courtFeeAmount: number;
  totalLegalExpenses: number;
  caseStatus: string;
  certificateNumber?: string;
  certificateDate?: string;
  grantedAmount?: number;
}

interface ExpenseItem {
  legalExpenseId: number;
  caseNumber: string;
  memberName: string;
  loanAccountNo: string;
  expenseType: string;
  expenseDate: string;
  amount: number;
  payeeName: string;
  voucherNumber: string;
  paymentMode: string;
  isDebitedToBorrower: boolean;
  remarks?: string;
}

export default function Sec101LegalReports() {
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string) : 0;
  const [selectedBranchId, setSelectedBranchId] = useState<number>(initialBranchId);
  const [branches, setBranches] = useState<any[]>([]);
  const [cases, setCases] = useState<CaseReportItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [activeReportTab, setActiveReportTab] = useState<'cases' | 'expenses'>('cases');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Add Expense Modal State
  const [showAddExpenseModal, setShowAddExpenseModal] = useState<boolean>(false);
  const [expCaseId, setExpCaseId] = useState<number | null>(null);
  const [expType, setExpType] = useState<string>('ADVOCATE_FEE');
  const [expDate, setExpDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expAmount, setExpAmount] = useState<number>(1000);
  const [expPayee, setExpPayee] = useState<string>('');
  const [expMode, setExpMode] = useState<string>('CASH');
  const [expRemarks, setExpRemarks] = useState<string>('');
  const [addingExpense, setAddingExpense] = useState<boolean>(false);

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
      const branchQuery = selectedBranchId > 0 ? `?branchId=${selectedBranchId}` : '';
      const [casesRes, expRes] = await Promise.all([
        axios.get(`/api/LegalRecovery/cases${branchQuery}`),
        axios.get(`/api/LegalRecovery/expenses${branchQuery}`)
      ]);

      if (casesRes.data) setCases(casesRes.data);
      if (expRes.data) setExpenses(expRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!expCaseId || !expAmount) {
      alert('कृपया केस आणि रक्कम प्रविष्ट करा.');
      return;
    }

    setAddingExpense(true);
    try {
      const res = await axios.post('/api/LegalRecovery/expense/add', {
        branchId: selectedBranchId,
        caseId: expCaseId,
        expenseType: expType,
        expenseDate: expDate,
        amount: expAmount,
        payeeName: expPayee,
        paymentMode: expMode,
        isDebitedToBorrower: true,
        remarks: expRemarks
      });

      if (res.status === 200) {
        const result = res.data;
        alert(`कायदेशीर खर्च नोंद यशस्वीरीत्या सेव्ह झाली!\nव्हाउचर क्र.: ${result.voucherNumber || 'ऑटो-पोस्ट'}`);
        setShowAddExpenseModal(false);
        fetchData();
      } else {
        alert('खर्च नोंदवताना त्रुटी आली.');
      }
    } catch (e: any) {
      console.error(e);
      alert('खर्च नोंदवताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setAddingExpense(false);
    }
  };

  const filteredCases = cases.filter((c) =>
    c.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.loanAccountNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredExpenses = expenses.filter((e) =>
    e.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.payeeName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-3 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans space-y-3">
      {/* Header Banner */}
      <div className={`bg-gradient-to-r ${theme.bannerGrad} text-white p-4 rounded-xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3`}>
        <div>
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-amber-300" />
            <h1 className="text-base font-bold tracking-wide">कायदेशीर वसुली अहवाल व खर्च खतावणी (Legal Reports & Expense Register)</h1>
          </div>
          <p className="text-white/80 text-[11px] mt-0.5">
            कलम १०१ केस नोंदवही, कोर्ट खर्च खतावणी, ऑटो-व्हाउचर्स व एक्सेल एक्सपोर्ट.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddExpenseModal(true)}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" /> + कायदेशीर खर्च नोंदवा
          </button>
        </div>
      </div>

      {/* Filter and Switcher Bar */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-700">शाखा:</label>
          <select
            value={selectedBranchId}
            disabled={hasGlobalBranch}
            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1 text-xs font-semibold text-gray-800 bg-white"
          >
            <option value={0}>सर्व शाखा (All Branches)</option>
            {branches.map((b) => (
              <option key={b.branchID} value={b.branchID}>
                {b.branchName} ({b.branchCode})
              </option>
            ))}
          </select>

          {/* Sub Tab Toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg border ml-2">
            <button
              onClick={() => setActiveReportTab('cases')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                activeReportTab === 'cases' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-600'
              }`}
            >
              १. केस नोंदवही ({cases.length})
            </button>
            <button
              onClick={() => setActiveReportTab('expenses')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                activeReportTab === 'expenses' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-600'
              }`}
            >
              २. कायदेशीर खर्च खतावणी ({expenses.length})
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="नाव / केस क्र. / खाते क्र. शोधा..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-300 rounded-md pl-7 pr-3 py-1 text-xs w-64"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
        </div>
      </div>

      {activeReportTab === 'cases' ? (
        /* Cases Register Table */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-3 bg-gray-100/70 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-800">कलम १०१ केस नोंदवही (Case Register)</h2>
            <button
              onClick={() => window.print()}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs border flex items-center gap-1 font-bold"
            >
              <Printer className="w-3 h-3" /> प्रिंट
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] text-gray-700">
              <thead className="bg-gray-100 text-[11px] font-bold text-gray-700 uppercase border-b">
                <tr>
                  <th className="p-2.5">दावा क्र. व दाखल तारीख</th>
                  <th className="p-2.5">कर्जदार व खाते</th>
                  <th className="p-2.5">न्यायालय</th>
                  <th className="p-2.5 text-right">दावा रक्कम</th>
                  <th className="p-2.5 text-right">कोर्ट फी</th>
                  <th className="p-2.5 text-right">कायदेशीर खर्च</th>
                  <th className="p-2.5">केस स्थिती</th>
                  <th className="p-2.5">वसुली दाखला तपशील</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-gray-400">
                      कोणत्याही केसेस आढळल्या नाहीत.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map((c) => (
                    <tr key={c.caseId} className="hover:bg-gray-50/80 transition">
                      <td className="p-2.5">
                        <div className="font-bold text-gray-900">{c.caseNumber}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{c.filingDate}</div>
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-gray-900">{c.memberName}</div>
                        <div className="text-[10px] text-gray-500">खाते: {c.loanAccountNo} | कोड: {c.memberCode}</div>
                      </td>
                      <td className="p-2.5 text-[10px] text-gray-600 max-w-[140px] truncate">{c.courtName}</td>
                      <td className="p-2.5 font-bold text-gray-900 text-right">₹{c.totalClaimAmount.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 font-bold text-rose-700 text-right">₹{c.courtFeeAmount?.toLocaleString('en-IN') || 0}</td>
                      <td className="p-2.5 font-bold text-amber-700 text-right">₹{c.totalLegalExpenses?.toLocaleString('en-IN') || 0}</td>
                      <td className="p-2.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${c.caseStatus === 'CERTIFICATE_ISSUED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                          {c.caseStatus}
                        </span>
                      </td>
                      <td className="p-2.5 text-[10px]">
                        {c.certificateNumber ? (
                          <div>
                            <div className="font-bold text-emerald-800">{c.certificateNumber}</div>
                            <div className="text-gray-500">{c.certificateDate} | ₹{c.grantedAmount?.toLocaleString('en-IN')}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">प्रलंबित</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Expenses Register Table */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-3 bg-gray-100/70 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-800">कायदेशीर खर्च खतावणी (Legal Expenses Register)</h2>
            <button
              onClick={() => window.print()}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs border flex items-center gap-1 font-bold"
            >
              <Printer className="w-3 h-3" /> प्रिंट
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] text-gray-700">
              <thead className="bg-gray-100 text-[11px] font-bold text-gray-700 uppercase border-b">
                <tr>
                  <th className="p-2.5">तारीख व व्हाउचर क्र.</th>
                  <th className="p-2.5">दावा क्र. व कर्जदार</th>
                  <th className="p-2.5">खर्च प्रकार</th>
                  <th className="p-2.5">पावती धारक / देय व्यक्ती</th>
                  <th className="p-2.5 text-right">रक्कम (₹)</th>
                  <th className="p-2.5">पेमेंट पद्धत</th>
                  <th className="p-2.5">कर्जदारास नावे?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-400">
                      कोणत्याही खर्च नोंदी आढळल्या नाहीत.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((e) => (
                    <tr key={e.legalExpenseId} className="hover:bg-gray-50/80 transition">
                      <td className="p-2.5">
                        <div className="font-bold text-gray-900">{e.expenseDate}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{e.voucherNumber || 'ऑटो-व्हाउचर'}</div>
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-gray-900">{cFindMember(e.caseNumber) || e.caseNumber}</div>
                        <div className="text-[10px] text-gray-500 font-mono">केस क्र: {e.caseNumber}</div>
                      </td>
                      <td className="p-2.5">
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded">
                          {e.expenseType}
                        </span>
                      </td>
                      <td className="p-2.5 font-medium">{e.payeeName || '-'}</td>
                      <td className="p-2.5 font-bold text-rose-700 text-right">₹{e.amount?.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-[10px]">{e.paymentMode}</td>
                      <td className="p-2.5">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                          होय (Debited)
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Legal Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b pb-3 text-slate-900 font-bold text-base">
              <DollarSign className="w-6 h-6 text-amber-600" />
              कायदेशीर खर्च नोंदवा (Add Legal Expense)
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700">केस निवडा (Select Case):</label>
                <select
                  value={expCaseId || ''}
                  onChange={(e) => setExpCaseId(Number(e.target.value))}
                  className="w-full mt-1 border rounded-md px-2.5 py-1.5 font-bold text-gray-900 bg-white"
                >
                  <option value="">- केस निवडा -</option>
                  {cases.map((c) => (
                    <option key={c.caseId} value={c.caseId}>
                      {c.caseNumber} - {c.memberName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700">खर्च प्रकार (Expense Type):</label>
                <select
                  value={expType}
                  onChange={(e) => setExpType(e.target.value)}
                  className="w-full mt-1 border rounded-md px-2.5 py-1.5 font-bold text-gray-800 bg-white"
                >
                  <option value="ADVOCATE_FEE">वकिली फी (Advocate Fee)</option>
                  <option value="COURT_FEE">कोर्ट फी (Court Fee)</option>
                  <option value="NOTICE_FEE">नोटीस व टपाल खर्च (Notice Fee)</option>
                  <option value="NEWSPAPER_AD">वर्तमानपत्र जाहीरनामा (Newspaper Ad)</option>
                  <option value="SRO_COMMISSION">विशेष वसुली अधिकारी कमिशन (SRO Fee)</option>
                  <option value="OTHER_LEGAL">इतर कायदेशीर खर्च (Other Legal Expense)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700">खर्च तारीख:</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full mt-1 border rounded-md px-2 py-1.5"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700">रक्कम (₹):</label>
                  <input
                    type="number"
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full mt-1 border rounded-md px-2 py-1.5 font-black text-rose-700"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700">देय व्यक्ती / संस्था (Payee Name):</label>
                <input
                  type="text"
                  placeholder="उदा. ॲड. श्री... / पोस्ट मास्टर"
                  value={expPayee}
                  onChange={(e) => setExpPayee(e.target.value)}
                  className="w-full mt-1 border rounded-md px-2.5 py-1.5"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700">पेमेंट पद्धत:</label>
                <select
                  value={expMode}
                  onChange={(e) => setExpMode(e.target.value)}
                  className="w-full mt-1 border rounded-md px-2.5 py-1.5 font-bold text-gray-800 bg-white"
                >
                  <option value="CASH">रोख (Cash)</option>
                  <option value="BANK_TRANSFER">बँक ट्रान्सफर / चेक (Bank)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700">शेरा (Remarks):</label>
                <input
                  type="text"
                  placeholder="खर्चाचा तपशील..."
                  value={expRemarks}
                  onChange={(e) => setExpRemarks(e.target.value)}
                  className="w-full mt-1 border rounded-md px-2.5 py-1.5"
                />
              </div>

              <div className="bg-blue-50 p-2 rounded text-[10px] text-blue-800 border border-blue-200">
                ⚡ डायनॅमिक लेजर मॅपिंगनुसार सदर खर्चाचे व्हाउचर आपोआप तयार होईल आणि कर्जदाराच्या खात्यावर नावे (Debit) पडेल.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                रद्द करा
              </button>
              <button
                onClick={handleAddExpense}
                disabled={addingExpense}
                className={`px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 ${theme.btnPrimary}`}
              >
                {addingExpense ? 'खर्च नोंदवत आहे...' : 'खर्च सेव्ह करा (Save Expense)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function cFindMember(caseNo: string) {
    const found = cases.find((c) => c.caseNumber === caseNo);
    return found ? found.memberName : '';
  }
}
