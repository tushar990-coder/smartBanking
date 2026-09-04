import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  Search, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  Key, 
  Box, 
  UserCheck, 
  Clock, 
  Download, 
  Filter 
} from 'lucide-react';

const LockerReports: React.FC = () => {
  const [activeReportTab, setActiveReportTab] = useState<'occupancy' | 'allotment' | 'visits' | 'notices'>('occupancy');
  
  // Data States
  const [lockers, setLockers] = useState<any[]>([]);
  const [allotments, setAllotments] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Notice Print Item
  const [selectedNoticeItem, setSelectedNoticeItem] = useState<any | null>(null);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [lRes, aRes, vRes, sRes] = await Promise.all([
        fetch('/api/Lockers'),
        fetch('/api/LockerAllotments'),
        fetch(`/api/LockerVisits?fromDate=${fromDate}&toDate=${toDate}`),
        fetch('/api/SansthaDetails')
      ]);

      if (lRes.ok) {
        const lData = await lRes.json();
        if (Array.isArray(lData)) setLockers(lData);
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        if (Array.isArray(aData)) setAllotments(aData);
      }
      if (vRes.ok) {
        const vData = await vRes.json();
        if (Array.isArray(vData)) setVisits(vData);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        if (Array.isArray(sData) && sData.length > 0) setSansthaDetail(sData[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [fromDate, toDate]);

  // Safe Arrays
  const safeLockers = Array.isArray(lockers) ? lockers : [];
  const safeAllotments = Array.isArray(allotments) ? allotments : [];
  const safeVisits = Array.isArray(visits) ? visits : [];

  // Calculations for Occupancy
  const totalLockers = safeLockers.length;
  const availableLockers = safeLockers.filter(l => l.status === 'Available').length;
  const allottedLockers = safeLockers.filter(l => l.status === 'Allotted').length;
  const maintenanceLockers = safeLockers.filter(l => l.status === 'UnderMaintenance').length;
  const sealedLockers = safeLockers.filter(l => l.status === 'Sealed').length;

  const occupancyRate = totalLockers > 0 ? Math.round((allottedLockers / totalLockers) * 100) : 0;

  // Overdue Allotments
  const overdueAllotments = safeAllotments.filter(a => a.status === 'Active' && a.isOverdue);

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg shadow-xs border border-slate-200 gap-2 print:hidden">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">लॉकर अहवाल व ऑडिट नोंदवही (Locker Reports & Notices)</h1>
            <p className="text-xs text-slate-500">लॉकर शिल्लक अहवाल, वाटप नोंदवही, व्हिजिट ऑडिट आणि थकीत भाडे नोटीस प्रिंटिंग</p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-md shadow-xs flex items-center gap-1"
        >
          <Printer size={14} /> अहवाल प्रिंट करा
        </button>
      </div>

      {/* Navigation Report Tabs */}
      <div className="flex flex-wrap gap-1 bg-white p-1.5 rounded-lg border border-slate-200 print:hidden">
        <button
          onClick={() => setActiveReportTab('occupancy')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeReportTab === 'occupancy' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Box size={14} /> १. लॉकर स्थिती व शिल्लक अहवाल
        </button>

        <button
          onClick={() => setActiveReportTab('allotment')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeReportTab === 'allotment' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck size={14} /> २. लॉकर वाटप रजिस्टर
        </button>

        <button
          onClick={() => setActiveReportTab('visits')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeReportTab === 'visits' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock size={14} /> ३. दैनिक व्हिजिट ऑडिट नोंदवही
        </button>

        <button
          onClick={() => setActiveReportTab('notices')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeReportTab === 'notices' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
          }`}
        >
          <AlertTriangle size={14} /> ४. थकीत भाडे नोटीस प्रिंट ({overdueAllotments.length})
        </button>
      </div>

      {/* Report 1: Occupancy & Availability Summary */}
      {activeReportTab === 'occupancy' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase">एकूण लॉकर्स</span>
              <p className="text-xl font-black text-slate-800">{totalLockers}</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">🟢 उपलब्ध (Available)</span>
              <p className="text-xl font-black text-emerald-800">{availableLockers}</p>
            </div>
            <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 shadow-xs">
              <span className="text-[10px] font-bold text-rose-700 uppercase">🔴 वाटप झालेले (Occupied)</span>
              <p className="text-xl font-black text-rose-800">{allottedLockers}</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 shadow-xs">
              <span className="text-[10px] font-bold text-amber-700 uppercase">🟡 मेंटेनन्स</span>
              <p className="text-xl font-black text-amber-800">{maintenanceLockers}</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 shadow-xs">
              <span className="text-[10px] font-bold text-purple-700 uppercase">ऑक्युपन्सी दर</span>
              <p className="text-xl font-black text-purple-800">{occupancyRate}%</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-800">कपाट व लॉकरनिहाय स्थिती अहवाल</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2 px-3">कपाट क्र.</th>
                    <th className="py-2 px-3">लॉकर क्र.</th>
                    <th className="py-2 px-3">चावी क्र.</th>
                    <th className="py-2 px-3">प्रकार</th>
                    <th className="py-2 px-3 text-right">वार्षिक भाडे</th>
                    <th className="py-2 px-3 text-right">अनामत रक्कम</th>
                    <th className="py-2 px-3 text-center">स्थिती</th>
                    <th className="py-2 px-3">सध्याचे वाटपदार</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {lockers.map((l) => (
                    <tr key={l.lockerID} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-slate-800">{l.cabinetNo}</td>
                      <td className="py-2 px-3 font-bold text-emerald-800">{l.lockerNo}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{l.keyNo}</td>
                      <td className="py-2 px-3 font-semibold">{l.typeName} ({l.typeCode})</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">₹{l.annualRent?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-blue-700">₹{l.securityDeposit?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          l.status === 'Available' ? 'bg-emerald-100 text-emerald-800' :
                          l.status === 'Allotted' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {l.status === 'Available' ? 'उपलब्ध' : l.status === 'Allotted' ? 'वाटप झालेले' : l.status}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {l.currentAllotment ? (
                          <span className="font-bold text-slate-800">{l.currentAllotment.memberName} ({l.currentAllotment.lockerAccountNo})</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 2: Allotment Register */}
      {activeReportTab === 'allotment' && (
        <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-800">सर्व लॉकर वाटप रजिस्टर (Allotment Master Register)</h2>
            <span className="text-xs text-slate-500">एकूण नोंदी: {allotments.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                  <th className="py-2 px-3">खाते क्र.</th>
                  <th className="py-2 px-3">कपाट व लॉकर</th>
                  <th className="py-2 px-3">सभासद नाव</th>
                  <th className="py-2 px-3">सह-धारक</th>
                  <th className="py-2 px-3">वारसदार</th>
                  <th className="py-2 px-3">वाटप दिनांक</th>
                  <th className="py-2 px-3">नूतनीकरण दिनांक</th>
                  <th className="py-2 px-3 text-right">डिपॉझिट</th>
                  <th className="py-2 px-3 text-right">वार्षिक भाडे</th>
                  <th className="py-2 px-3 text-center">स्थिती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {allotments.map((a) => (
                  <tr key={a.allotmentID} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-emerald-800">{a.lockerAccountNo}</td>
                    <td className="py-2 px-3 font-bold">{a.cabinetNo} - {a.lockerNo}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{a.memberName}</td>
                    <td className="py-2 px-3 text-slate-600">{a.jointMember1_Name || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{a.nomineeName || '-'}</td>
                    <td className="py-2 px-3">{new Date(a.allotmentDate).toLocaleDateString('en-GB')}</td>
                    <td className="py-2 px-3 font-semibold">{new Date(a.expiryDate).toLocaleDateString('en-GB')}</td>
                    <td className="py-2 px-3 text-right font-bold text-blue-700">₹{a.securityDepositAmount?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-700">₹{a.annualRent?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        a.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {a.status === 'Active' ? 'सक्रिय' : 'बंद'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 3: Daily Visits Register */}
      {activeReportTab === 'visits' && (
        <div className="space-y-3">
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center space-x-2 print:hidden">
            <span className="text-xs font-bold text-slate-700">तारीख निवडा:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="text-xs px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <span className="text-xs text-slate-500">ते</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="text-xs px-2 py-1 rounded border border-slate-300 bg-white"
            />
          </div>

          <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-800">दैनिक लॉकर हाताळणी नोंदवही (Access Log Audit Report)</h2>
              <span className="text-xs text-slate-500">एकूण व्हिजिट्स: {visits.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2 px-3">तारीख</th>
                    <th className="py-2 px-3">खाते क्र.</th>
                    <th className="py-2 px-3">लॉकर क्र.</th>
                    <th className="py-2 px-3">व्यक्तीचे नाव</th>
                    <th className="py-2 px-3">प्रकार</th>
                    <th className="py-2 px-3 text-center">Time In</th>
                    <th className="py-2 px-3 text-center">Time Out</th>
                    <th className="py-2 px-3">बँक अधिकारी / कस्टोडियन</th>
                    <th className="py-2 px-3">शेरा</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {visits.map((v) => (
                    <tr key={v.visitID} className="hover:bg-slate-50">
                      <td className="py-2 px-3">{new Date(v.visitDate).toLocaleDateString('en-GB')}</td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-800">{v.lockerAccountNo}</td>
                      <td className="py-2 px-3 font-bold">{v.cabinetNo} - {v.lockerNo}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{v.operatorName}</td>
                      <td className="py-2 px-3 text-slate-600">{v.operatedBy}</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-700">{v.timeIn}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-800">{v.timeOut || '-'}</td>
                      <td className="py-2 px-3 text-slate-600">{v.bankOfficerName || '-'}</td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">{v.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 4: Overdue Rent Demand Notice Generator */}
      {activeReportTab === 'notices' && (
        <div className="space-y-3">
          <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-rose-600" /> थकीत भाडे यादी व नोटीस जनरेटर (Demand Notice Generator)
              </h2>
              <span className="text-xs text-rose-700 font-bold">थकीत खाती: {overdueAllotments.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2 px-3">खाते क्रमांक</th>
                    <th className="py-2 px-3">लॉकर क्र.</th>
                    <th className="py-2 px-3">सभासद नाव</th>
                    <th className="py-2 px-3">मोबाईल</th>
                    <th className="py-2 px-3">देय दिनांक</th>
                    <th className="py-2 px-3 text-right">वार्षिक भाडे</th>
                    <th className="py-2 px-3 text-center">नोटीस प्रिंट</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {overdueAllotments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        कोणतेही थकीत भाडे खाते नाही. सर्व खाती अद्ययावत आहेत!
                      </td>
                    </tr>
                  ) : (
                    overdueAllotments.map((a) => (
                      <tr key={a.allotmentID} className="hover:bg-rose-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-rose-800">{a.lockerAccountNo}</td>
                        <td className="py-2 px-3 font-bold">{a.cabinetNo} - {a.lockerNo}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{a.memberName}</td>
                        <td className="py-2 px-3 text-slate-600">{a.memberPhone || '-'}</td>
                        <td className="py-2 px-3 font-bold text-rose-700">{new Date(a.expiryDate).toLocaleDateString('en-GB')}</td>
                        <td className="py-2 px-3 text-right font-black text-rose-800">₹{a.annualRent?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => setSelectedNoticeItem(a)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md shadow-xs text-xs flex items-center gap-1 mx-auto"
                          >
                            <Printer size={12} /> नोटीस प्रिंट करा
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Demand Notice Print Modal */}
      {selectedNoticeItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center print:hidden">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Printer size={16} className="text-rose-400" /> लॉकर वार्षिक भाडे भरणा नोटीस
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded flex items-center gap-1"
                >
                  <Printer size={13} /> प्रिंट
                </button>
                <button onClick={() => setSelectedNoticeItem(null)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Notice */}
            <div className="p-8 space-y-5 text-slate-800 font-serif leading-relaxed">
              <div className="border border-gray-900 p-3 relative text-center mb-3">
                <div className="flex justify-between items-center text-[12px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2 font-sans">
                  <div><span>रजि. नं. - </span><span className="font-mono">{sansthaDetail?.registrationNo || '-'}</span></div>
                  <div><span>रजि. दि. - </span><span className="font-mono">{sansthaDetail?.registrationDate ? new Date(sansthaDetail.registrationDate).toLocaleDateString('en-GB') : '-'}</span></div>
                </div>
                <h2 className="text-lg font-bold uppercase tracking-wider text-gray-950">{sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}</h2>
                <p className="text-xs text-slate-600 font-sans mt-0.5">{sansthaDetail?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}</p>
                <p className="text-xs text-slate-600 font-bold mt-1">लॉकर विभाग | नोटीस शाखा</p>
                <h3 className="text-sm font-black mt-2 underline text-rose-900 uppercase">लॉकर वार्षिक भाडे थकीत भरणा स्मरणपत्र (Demand Notice)</h3>
              </div>

              <div className="flex justify-between text-xs font-sans">
                <div>
                  <p><strong>जावक क्र.:</strong> NOT/LKR/{selectedNoticeItem.allotmentID}/{new Date().getFullYear()}</p>
                </div>
                <div className="text-right">
                  <p><strong>दिनांक:</strong> {new Date().toLocaleDateString('en-GB')}</p>
                </div>
              </div>

              <div className="text-xs font-sans space-y-1">
                <p><strong>प्रति,</strong></p>
                <p className="font-bold text-sm">{selectedNoticeItem.memberName}</p>
                <p>{selectedNoticeItem.memberAddress || 'मु. पो. मुख्य गाव'}</p>
                <p>मोबाईल: {selectedNoticeItem.memberPhone || '-'}</p>
              </div>

              <div className="text-xs font-sans space-y-2">
                <p><strong>विषय:</strong> लॉकर क्र. <strong>{selectedNoticeItem.lockerNo}</strong> (खाते क्र. {selectedNoticeItem.lockerAccountNo}) चे वार्षिक भाडे भरण्याबाबत.</p>
                <p className="indent-6">
                  महोदय/महोदया, आपल्या पतसंस्थेकडून आपण भाड्याने घेतलेल्या वरील लॉकरचे वार्षिक भाडे दिनांक <strong>{new Date(selectedNoticeItem.expiryDate).toLocaleDateString('en-GB')}</strong> रोजी संपलेले असून पुढील १ वर्षाचे भाडे <strong>₹{selectedNoticeItem.annualRent?.toFixed(2)}</strong> अद्याप संस्थेकडे जमा झालेले नाही.
                </p>
                <p className="indent-6">
                  तरी सदर पत्र मिळाल्यापासून <strong>१५ दिवसांच्या आत</strong> संस्थेच्या शाखेत येऊन अथवा बचत खात्यातून सदर रक्कम जमा करून लॉकरचे नूतनीकरण करून घ्यावे, ही नम्र विनंती.
                </p>
              </div>

              <div className="pt-10 flex justify-between text-xs text-center font-sans">
                <div>
                  <p className="text-slate-500">तयार केले: लिपिक</p>
                </div>
                <div>
                  <div className="h-10"></div>
                  <p className="border-t border-slate-400 pt-1 font-bold">शाखा व्यवस्थापक / मुख्य कार्यकारी अधिकारी</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LockerReports;
