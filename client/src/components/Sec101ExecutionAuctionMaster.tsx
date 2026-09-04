import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Gavel, Printer, Plus, CheckCircle, FileText, AlertTriangle, ShieldCheck, Building, DollarSign } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface ExecutionRecord {
  executionId: number;
  caseId: number;
  caseNumber: string;
  certificateNumber: string;
  memberName: string;
  loanAccountNo: string;
  executionType: string;
  executionOrderNo: string;
  orderDate: string;
  sroName?: string;
  employerName?: string;
  monthlyDeductionAmount?: number;
  propertyDetails?: string;
  estimatedValue?: number;
  reservePrice?: number;
  auctionDate?: string;
  executionStatus: string;
  recoveredAmount: number;
}

interface CertifiedCase {
  caseId: number;
  caseNumber: string;
  certificateNumber: string;
  memberName: string;
  memberCode: string;
  loanAccountNo: string;
  grantedAmount: number;
}

export default function Sec101ExecutionAuctionMaster() {
  const [cases, setCases] = useState<CertifiedCase[]>([]);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [sanstha, setSanstha] = useState<any>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form State
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [executionType, setExecutionType] = useState<string>('SEC_49_SALARY');
  const [executionOrderNo, setExecutionOrderNo] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sroName, setSroName] = useState<string>('');
  const [employerName, setEmployerName] = useState<string>('');
  const [employerAddress, setEmployerAddress] = useState<string>('');
  const [monthlyDeductionAmount, setMonthlyDeductionAmount] = useState<number>(5000);
  const [propertyDetails, setPropertyDetails] = useState<string>('');
  const [estimatedValue, setEstimatedValue] = useState<number>(0);
  const [reservePrice, setReservePrice] = useState<number>(0);
  const [auctionDate, setAuctionDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Print Salary Order Modal
  const [printSalaryOrder, setPrintSalaryOrder] = useState<any | null>(null);

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
      const [caseRes, execRes] = await Promise.all([
        axios.get(`/api/LegalRecovery/cases?branchId=${selectedBranchId}`),
        axios.get(`/api/LegalRecovery/executions?branchId=${selectedBranchId}`)
      ]);

      if (caseRes.data) {
        const allCases = caseRes.data;
        setCases(allCases.filter((c: any) => c.certificateNumber || c.caseStatus === 'CERTIFICATE_ISSUED'));
      }
      if (execRes.data) setExecutions(execRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExecution = async () => {
    if (!selectedCaseId) {
      alert('कृपया दाखला मंजूर झालेली केस निवडा.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/LegalRecovery/execution/create', {
        caseId: selectedCaseId,
        executionType,
        executionOrderNo: executionOrderNo || `EXEC/${new Date().getFullYear()}/${selectedCaseId}`,
        orderDate,
        sroName,
        employerName,
        employerAddress,
        monthlyDeductionAmount,
        propertyDetails,
        estimatedValue,
        reservePrice,
        auctionDate: auctionDate || null,
        remarks
      });

      if (res.status === 200) {
        const result = res.data;
        alert('जप्ती / पगार कपात आदेश यशस्वीरीत्या नोंदवला गेला!');
        fetchData();
        if (executionType === 'SEC_49_SALARY') {
          const selectedC = cases.find((c) => c.caseId === selectedCaseId);
          setPrintSalaryOrder({
            ...result,
            memberName: selectedC?.memberName,
            loanAccountNo: selectedC?.loanAccountNo,
            certificateNumber: selectedC?.certificateNumber,
            grantedAmount: selectedC?.grantedAmount,
            employerName,
            employerAddress,
            monthlyDeductionAmount,
            orderDate
          });
        }
      } else {
        alert('नोंद करताना त्रुटी आली.');
      }
    } catch (e: any) {
      console.error(e);
      alert('नोंद करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans space-y-3">
      {/* Header Banner */}
      <div className={`bg-gradient-to-r ${theme.bannerGrad} text-white p-4 rounded-xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3`}>
        <div>
          <div className="flex items-center gap-2.5">
            <Gavel className="w-6 h-6 text-amber-300" />
            <h1 className="text-base font-bold tracking-wide">नियम १०७ जप्ती, कलम ४९ पगार कपात व लिलाव (Execution & Attachment Master)</h1>
          </div>
          <p className="text-white/80 text-[11px] mt-0.5">
            कलम १०१ वसुली दाखल्यानंतर कलम ४९ पगार कपात आदेश पत्र, नियम १०७ मालमत्ता जप्ती पंचनामा व लिलाव जाहीरनामा.
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
        <span className="text-[11px] text-gray-500 font-medium">दाखला मंजूर केसेस: {cases.length} | चालू जप्ती/कपात: {executions.length}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Execution Form */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 border-b pb-2">
            <Plus className="w-4 h-4 text-primary" />
            नवीन जप्ती / पगार कपात आदेश (Create Execution)
          </h2>

          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-bold text-gray-700">दाखला मंजूर केस निवडा:</label>
              <select
                value={selectedCaseId || ''}
                onChange={(e) => setSelectedCaseId(Number(e.target.value))}
                className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-bold text-gray-900 bg-white"
              >
                <option value="">- दाखला मंजूर केस निवडा -</option>
                {cases.map((c) => (
                  <option key={c.caseId} value={c.caseId}>
                    {c.memberName} (दाखला क्र: {c.certificateNumber || c.caseNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Execution Type Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-700">अंमलबजावणीचा प्रकार (Execution Type):</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExecutionType('SEC_49_SALARY')}
                  className={`p-2 rounded-lg text-left border transition ${
                    executionType === 'SEC_49_SALARY'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xs font-bold">कलम ४९ पगार कपात</div>
                  <div className="text-[10px] text-gray-500">मालकाला पगार कपात आदेश</div>
                </button>

                <button
                  type="button"
                  onClick={() => setExecutionType('RULE_107_IMMOVABLE')}
                  className={`p-2 rounded-lg text-left border transition ${
                    executionType === 'RULE_107_IMMOVABLE'
                      ? 'border-rose-600 bg-rose-50 text-rose-950 font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xs font-bold">नियम १०७ जप्ती/लिलाव</div>
                  <div className="text-[10px] text-gray-500">स्थावर/जंगम मालमत्ता</div>
                </button>
              </div>
            </div>

            {executionType === 'SEC_49_SALARY' ? (
              /* Salary Attachment Fields */
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200 space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-emerald-950">कर्जदाराचे मालक / कंपनी नाव (Employer):</label>
                  <input
                    type="text"
                    value={employerName}
                    onChange={(e) => setEmployerName(e.target.value)}
                    placeholder="उदा. मा. मुख्य कार्यकारी अधिकारी, जि.प. / कंपनी नाव"
                    className="w-full mt-0.5 border rounded-md px-2.5 py-1 text-xs font-bold text-gray-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-emerald-950">कंपनीचा / कार्यालयाचा पत्ता:</label>
                  <input
                    type="text"
                    value={employerAddress}
                    onChange={(e) => setEmployerAddress(e.target.value)}
                    placeholder="कार्यालयाचा संपूर्ण पत्ता..."
                    className="w-full mt-0.5 border rounded-md px-2.5 py-1 text-xs text-gray-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-emerald-950">मासिक पगार कपात रक्कम (₹):</label>
                  <input
                    type="number"
                    value={monthlyDeductionAmount}
                    onChange={(e) => setMonthlyDeductionAmount(Number(e.target.value))}
                    className="w-full mt-0.5 border rounded-md px-2.5 py-1 text-xs font-bold text-emerald-800"
                  />
                </div>
              </div>
            ) : (
              /* Property / Auction Attachment Fields */
              <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-200 space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-rose-950">विशेष वसुली अधिकारी (SRO Name):</label>
                  <input
                    type="text"
                    value={sroName}
                    onChange={(e) => setSroName(e.target.value)}
                    placeholder="श्री. विशेष वसुली अधिकारी..."
                    className="w-full mt-0.5 border rounded-md px-2.5 py-1 text-xs font-bold text-gray-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-rose-950">मालमत्ता वर्णन (Property Details / गट नं./घर नं.):</label>
                  <textarea
                    rows={2}
                    value={propertyDetails}
                    onChange={(e) => setPropertyDetails(e.target.value)}
                    placeholder="जप्ती करावयाच्या जागेचे / घराचे संपूर्ण वर्णन..."
                    className="w-full mt-0.5 border rounded-md p-2 text-xs text-gray-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-rose-950">अंदाजे किंमत (₹):</label>
                    <input
                      type="number"
                      value={estimatedValue}
                      onChange={(e) => setEstimatedValue(Number(e.target.value))}
                      className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-rose-950">लिलाव राखीव किंमत (₹):</label>
                    <input
                      type="number"
                      value={reservePrice}
                      onChange={(e) => setReservePrice(Number(e.target.value))}
                      className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-rose-950">नियोजित लिलाव तारीख (Auction Date):</label>
                  <input
                    type="date"
                    value={auctionDate}
                    onChange={(e) => setAuctionDate(e.target.value)}
                    className="w-full mt-0.5 border rounded-md px-2.5 py-1 text-xs text-gray-800"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleCreateExecution}
              disabled={submitting || !selectedCaseId}
              className={`w-full py-2 rounded-lg font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 ${theme.btnPrimary}`}
            >
              {submitting ? 'आदेश तयार होत आहे...' : 'जप्ती / कपात आदेश जारी करा (Issue Execution Order)'}
            </button>
          </div>
        </div>

        {/* Right: Active Executions Table */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-3 bg-gray-100/70 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-800">जप्ती व पगार कपात आदेश यादी</h2>
            <span className="text-[11px] font-bold text-gray-500">एकूण {executions.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] text-gray-700">
              <thead className="bg-gray-100 text-[11px] font-bold text-gray-700 uppercase border-b">
                <tr>
                  <th className="p-2.5">कर्जदार व दाखला</th>
                  <th className="p-2.5">अंमलबजावणी प्रकार</th>
                  <th className="p-2.5">तपशील (मालक/मालमत्ता)</th>
                  <th className="p-2.5">रक्कम / कपात</th>
                  <th className="p-2.5">स्थिती</th>
                  <th className="p-2.5 text-center">कृती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {executions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-gray-400">
                      कोणतीही अंमलबजावणी नोंद आढळली नाही.
                    </td>
                  </tr>
                ) : (
                  executions.map((e) => (
                    <tr key={e.executionId} className="hover:bg-gray-50/80 transition">
                      <td className="p-2.5">
                        <div className="font-bold text-gray-900">{e.memberName}</div>
                        <div className="text-[10px] text-gray-500 font-mono">दाखला: {e.certificateNumber || e.caseNumber}</div>
                      </td>
                      <td className="p-2.5 font-bold">
                        <span className={`text-[10px] px-1.5 py-0.2 rounded ${e.executionType === 'SEC_49_SALARY' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {e.executionType === 'SEC_49_SALARY' ? 'कलम ४९ पगार कपात' : 'नियम १०७ जप्ती/लिलाव'}
                        </span>
                      </td>
                      <td className="p-2.5 text-[10px]">
                        {e.executionType === 'SEC_49_SALARY' ? (
                          <div>{e.employerName}</div>
                        ) : (
                          <div>{e.propertyDetails}</div>
                        )}
                      </td>
                      <td className="p-2.5 font-bold text-emerald-700">
                        {e.executionType === 'SEC_49_SALARY'
                          ? `₹${e.monthlyDeductionAmount?.toLocaleString('en-IN')}/महिना`
                          : `राखीव: ₹${e.reservePrice?.toLocaleString('en-IN')}`}
                      </td>
                      <td className="p-2.5">
                        <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-1 py-0.2 rounded border">
                          {e.executionStatus}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        {e.executionType === 'SEC_49_SALARY' && (
                          <button
                            onClick={() => setPrintSalaryOrder(e)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs inline-flex items-center gap-1 border border-gray-300"
                          >
                            <Printer className="w-3 h-3" /> आदेश पत्र
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Print Salary Attachment Order Modal */}
      {printSalaryOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl space-y-6">
            <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900 uppercase">
                {sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h2>
              <p className="text-xs text-slate-600">{sanstha?.address}</p>
              <p className="text-xs text-slate-600">नोंदणी क्र.: {sanstha?.registrationNo}</p>
            </div>

            <div className="text-center">
              <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-extrabold px-4 py-1 rounded-full uppercase">
                महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे कलम ४९ अन्वये पगार कपात आदेश पत्र
              </span>
            </div>

            <div className="flex justify-between text-xs text-slate-700 font-bold">
              <div>जावक क्र.: {printSalaryOrder.executionOrderNo || 'SEC49/SALARY/2026'}</div>
              <div>दिनांक: {printSalaryOrder.orderDate}</div>
            </div>

            <div className="text-xs text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <div><strong>प्रति (नियोक्ता / आहरण व संवितरण अधिकारी):</strong></div>
              <div className="font-bold">{printSalaryOrder.employerName || 'मा. आहरण व संवितरण अधिकारी'}</div>
              <div>{printSalaryOrder.employerAddress || 'संबंधित कार्यालय पत्ता'}</div>
            </div>

            <div className="text-xs text-slate-800 leading-relaxed space-y-3 text-justify">
              <p><strong>विषय:</strong> सभासद श्री/श्रीमती <strong>{printSalaryOrder.memberName}</strong> यांच्या मासिक वेतनातून <strong>कलम ४९ अन्वये दरमहा ₹{printSalaryOrder.monthlyDeductionAmount?.toLocaleString('en-IN')}</strong> कपात करून संस्थेकडे जमा करणेबाबत.</p>
              <p><strong>संदर्भ:</strong> मा. सहाय्यक निबंधक, सहकारी संस्था यांचा कलम १०१ वसुली दाखला क्र. <strong>{printSalaryOrder.certificateNumber || 'मंजूर दाखला'}</strong>.</p>
              <p>महोदय,</p>
              <p>
                उपरोक्त विषयास अनुसरून कळविण्यात येते की, आपल्या कार्यालयातील कर्मचारी श्री/श्रीमती <strong>{printSalaryOrder.memberName}</strong> हे आमच्या संस्थेचे कर्जदार आहेत. त्यांच्याकडील थकीत कर्जापोटी मा. निबंधक यांनी संस्थेच्या बाजूने कलम १०१ अन्वये वसुली दाखला मंजूर केलेला आहे.
              </p>
              <p>
                महाराष्ट्र सहकारी संस्था अधिनियम १९६० च्या <strong>कलम ४९ मधील तरतुदीनुसार</strong>, कर्जदाराने कर्ज घेताना दिलेल्या पगार कपात संमतीपत्रानुसार, त्यांच्या मासिक वेतनातून दरमहा <strong>₹{printSalaryOrder.monthlyDeductionAmount?.toLocaleString('en-IN')}</strong> (अक्षरी रु. .................) कपात करून सदर रक्कम दरमहा संस्थेच्या खात्यात जमा करावी, ही नम्र विनंती.
              </p>
              <p className="font-bold text-slate-900">
                कलम ४९ (२) अन्वये पगार कपात करून संस्थेकडे जमा करणे हे नियोक्त्यावर वैधानिक बंधनकारक आहे, याची कृपया नोंद घ्यावी.
              </p>
            </div>

            <div className="flex justify-between items-end pt-8 text-xs font-bold text-slate-900">
              <div>
                <p>प्रत माहितीसाठी: कर्जदार - {printSalaryOrder.memberName}</p>
              </div>
              <div className="text-center space-y-6">
                <p>आपला विश्वासू,</p>
                <p>शाखा व्यवस्थापक / मुख्य कार्यकारी अधिकारी<br />{sanstha?.sansthaName || 'सहकारी पतसंस्था'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <button
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" /> पगार कपात आदेश प्रिंट करा
              </button>
              <button
                onClick={() => setPrintSalaryOrder(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-xl font-bold text-xs"
              >
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
