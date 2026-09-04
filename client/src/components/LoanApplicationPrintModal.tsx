import React, { useRef, useState, useEffect } from 'react';
import { Printer, X, FileText } from 'lucide-react';
import { getAmountInWordsMarathi } from '../utils/marathiWords';

interface Props {
  application: any;
  onClose: () => void;
}

const LoanApplicationPrintModal: React.FC<Props> = ({ application, onClose }) => {
  const [sanstha, setSanstha] = useState<any>(null);

  useEffect(() => {
    fetch('/api/SansthaDetails')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (data && data.length > 0) {
          setSanstha(data[0]);
        }
      })
      .catch(err => console.error('Failed to fetch SansthaDetails:', err));
  }, []);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Loan_Application_${application?.applicationNo || 'Draft'}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const borrower = application?.member || {};
  const coMember1 = application?.coMember || {};
  const coMember2 = application?.coMember2 || {};
  const guarantor1 = application?.guarantor1Member || {};
  const guarantor2 = application?.guarantor2Member || {};
  const director = application?.recommendedByDirector || {};
  const loanRate = application?.loanRate || {};

  const requestedAmount = application?.requestedAmount || 0;
  const amountInWords = getAmountInWordsMarathi(requestedAmount);

  const formatDate = (dateVal: any) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return String(dateVal);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print-modal-container">
      <div className="bg-white rounded-md shadow-2xl border border-gray-300 w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden">
        
        {/* Top ERP Action Header (Hidden on Print) */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-slate-800 no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs sm:text-sm font-bold flex items-center gap-2">
              <span>कर्ज मागणी व मंजुरी अर्ज (Loan Application Form)</span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded font-mono">
                {application?.applicationNo || 'APP-DRAFT'}
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Printer size={15} />
              <span>🖨️ प्रिंट करा (Print A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PRINTABLE SHEET CONTAINER (Targeted by #printable-loan-application)       */}
        {/* ========================================================================= */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-6 bg-slate-100 flex justify-center">
          <div
            id="printable-loan-application"
            className="w-full max-w-3xl bg-white text-slate-950 p-6 sm:p-8 shadow-md text-[11px] leading-tight space-y-3 font-sans border border-gray-300"
          >
            {/* 1. Header: Society Details */}
            <div className="text-center border-b-2 border-black pb-2 space-y-1">
              <div className="text-[10px] font-bold text-gray-700 tracking-wider">
                ।। श्री गणेशाय नमः ।।
              </div>
              <h1 className="text-lg sm:text-xl font-black text-black tracking-wide">
                {sanstha?.sansthaName || 'श्री गुरुदेव नागरी सहकारी पतसंस्था मर्यादित'}
              </h1>
              <p className="text-[10px] text-gray-800 font-medium">
                {sanstha?.address || 'मुख्य कार्यालय: मु.पो. सांगली, ता. मिरज, जि. सांगली'} 
                {sanstha?.phoneNo ? ` | फोन: ${sanstha.phoneNo}` : ''}
                {sanstha?.registrationNo ? ` | नोंदणी क्र.: ${sanstha.registrationNo}` : ''}
              </p>
              <div className="inline-block bg-black text-white font-black text-xs px-4 py-1 rounded-xs mt-1 tracking-wider uppercase">
                कर्ज मागणी व मंजुरी अर्ज (Loan Application & Sanction Form)
              </div>
            </div>

            {/* 2. Metadata Bar: Application No, Date & Loan Scheme */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-xs border border-gray-400 font-mono text-[11px]">
              <div>
                <span className="text-gray-700 font-sans">अर्ज क्रमांक: </span>
                <strong className="text-black font-bold text-xs">{application?.applicationNo || '-'}</strong>
              </div>
              <div className="text-center">
                <span className="text-gray-700 font-sans">अर्ज दिनांक: </span>
                <strong className="text-black">{formatDate(application?.applicationDate)}</strong>
              </div>
              <div className="text-right">
                <span className="text-gray-700 font-sans">कर्ज योजना: </span>
                <strong className="text-black font-sans">{loanRate?.shortName || loanRate?.loanType || application?.loanType || 'सामान्य कर्ज'}</strong>
              </div>
            </div>

            {/* 3. Section 1: कर्जदार सभासदाचा सविस्तर तपशील */}
            <div className="border border-black rounded-xs overflow-hidden">
              <div className="bg-slate-200 px-2 py-1 font-bold text-black border-b border-black flex justify-between items-center text-[11px]">
                <span>१. कर्जदार सभासदाची सविस्तर माहिती (Borrower Details)</span>
                <span className="font-mono text-[10px]">सभासद कोड: {borrower?.memberCode || '-'} {borrower?.cifNo ? `| CIF: ${borrower.cifNo}` : ''}</span>
              </div>
              <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="sm:col-span-2">
                  <span className="text-gray-600 block text-[10px]">सभासदाचे पूर्ण नाव:</span>
                  <strong className="text-black text-xs">{borrower?.firstName} {borrower?.middleName ? borrower.middleName + ' ' : ''}{borrower?.lastName}</strong>
                  {borrower?.firstNameEng && (
                    <span className="block text-[10px] text-gray-500 font-sans">({borrower.firstNameEng} {borrower.lastNameEng})</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-600 block text-[10px]">मोबाईल क्रमांक:</span>
                  <strong className="font-mono text-black">{borrower?.mobileNo || '-'}</strong>
                </div>
                <div>
                  <span className="text-gray-600 block text-[10px]">आधार / पॅन क्र.:</span>
                  <strong className="font-mono text-black">{borrower?.aadharNo || borrower?.panNo || '-'}</strong>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-600 block text-[10px]">पूर्ण पत्ता व गाव:</span>
                  <strong className="text-black">{borrower?.address || borrower?.village || '-'}</strong>
                </div>
                <div>
                  <span className="text-gray-600 block text-[10px]">व्यवसाय / नोकरी:</span>
                  <strong className="text-black">{borrower?.occupation || 'शेती / व्यवसाय'}</strong>
                </div>
                <div>
                  <span className="text-gray-600 block text-[10px]">मासिक उत्पन्न:</span>
                  <strong className="font-mono text-black">₹{(borrower?.monthlyIncome || 25000).toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>

            {/* 4. Section 2: मागितलेल्या कर्जाचा तपशील */}
            <div className="border border-black rounded-xs overflow-hidden">
              <div className="bg-slate-200 px-2 py-1 font-bold text-black border-b border-black text-[11px]">
                २. मागणी केलेल्या कर्जाचा तपशील (Loan Requirement & Terms)
              </div>
              <div className="p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-600 block text-[10px]">मागणी केलेली रक्कम:</span>
                  <strong className="text-xs font-black text-black font-mono">₹{requestedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className="sm:col-span-3">
                  <span className="text-gray-600 block text-[10px]">अक्षरी रक्कम:</span>
                  <strong className="text-black font-semibold">{amountInWords}</strong>
                </div>
                <div>
                  <span className="text-gray-600 block text-[10px]">परतफेडीची मुदत:</span>
                  <strong className="font-mono text-black">{application?.durationMonths || 12} महिने ({application?.noOfInstallments || application?.durationMonths || 12} हप्ते)</strong>
                </div>
                <div>
                  <span className="text-gray-600 block text-[10px]">व्याजदर (%):</span>
                  <strong className="font-mono text-black">{application?.interestRate || 10}% वार्षिक</strong>
                </div>
                <div>
                  <span className="text-gray-600 block text-[10px]">हप्ता प्रकार:</span>
                  <strong className="text-black">{application?.installmentFrequency || 'मासिक (Monthly)'}</strong>
                </div>
                <div>
                  <span className="text-gray-600 block text-[10px]">अंदाजित हप्ता रक्कम:</span>
                  <strong className="font-mono text-black">₹{(application?.installmentAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className="sm:col-span-4">
                  <span className="text-gray-600 block text-[10px]">कर्जाचा हेतू / कारण (Purpose):</span>
                  <strong className="text-black">{application?.purpose || 'वैयक्तिक / घरगुती / व्यवसाय कारणास्तव'}</strong>
                </div>
              </div>
            </div>

            {/* 5. Section 3: सह-कर्जदार व जामीनदारांचा तपशील */}
            <div className="border border-black rounded-xs overflow-hidden">
              <div className="bg-slate-200 px-2 py-1 font-bold text-black border-b border-black text-[11px]">
                ३. सह-कर्जदार व जामीनदारांची माहिती (Co-Borrowers & Guarantors)
              </div>
              
              <div className="p-2 space-y-2">
                {/* Co-Borrower (if present) */}
                {(coMember1?.memberID || coMember2?.memberID) && (
                  <div className="bg-slate-50 p-1.5 rounded-xs border border-gray-400 text-[10px]">
                    <div className="font-bold text-black mb-0.5">सह-कर्जदार (Co-Borrower):</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      <div>नाव: <strong>{coMember1?.firstName} {coMember1?.lastName}</strong></div>
                      <div>कोड: <strong className="font-mono">{coMember1?.memberCode || '-'}</strong></div>
                      <div>मोबाईल: <strong className="font-mono">{coMember1?.mobileNo || '-'}</strong></div>
                      <div>पत्ता: <strong>{coMember1?.address || coMember1?.village || '-'}</strong></div>
                    </div>
                  </div>
                )}

                {/* Guarantors Table */}
                <table className="w-full text-left border-collapse border border-black text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-black border-b border-black">
                      <th className="p-1 border-r border-black w-24">तपशील</th>
                      <th className="p-1 border-r border-black">जामीनदार क्र. १ (Guarantor 1)</th>
                      <th className="p-1">जामीनदार क्र. २ (Guarantor 2)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black">
                    <tr>
                      <td className="p-1 bg-slate-50 font-semibold border-r border-black">पूर्ण नाव</td>
                      <td className="p-1 font-bold border-r border-black">{guarantor1?.firstName ? `${guarantor1.firstName} ${guarantor1.middleName || ''} ${guarantor1.lastName}` : '-'}</td>
                      <td className="p-1 font-bold">{guarantor2?.firstName ? `${guarantor2.firstName} ${guarantor2.middleName || ''} ${guarantor2.lastName}` : '-'}</td>
                    </tr>
                    <tr>
                      <td className="p-1 bg-slate-50 font-semibold border-r border-black">सभासद कोड / CIF</td>
                      <td className="p-1 font-mono border-r border-black">{guarantor1?.memberCode || '-'} {guarantor1?.cifNo ? `(${guarantor1.cifNo})` : ''}</td>
                      <td className="p-1 font-mono">{guarantor2?.memberCode || '-'} {guarantor2?.cifNo ? `(${guarantor2.cifNo})` : ''}</td>
                    </tr>
                    <tr>
                      <td className="p-1 bg-slate-50 font-semibold border-r border-black">पत्ता व मोबाईल</td>
                      <td className="p-1 border-r border-black">{guarantor1?.address || guarantor1?.village || '-'} | Ph: {guarantor1?.mobileNo || '-'}</td>
                      <td className="p-1">{guarantor2?.address || guarantor2?.village || '-'} | Ph: {guarantor2?.mobileNo || '-'}</td>
                    </tr>
                    <tr>
                      <td className="p-1 bg-slate-50 font-semibold border-r border-black">व्यवसाय व उत्पन्न</td>
                      <td className="p-1 border-r border-black">{guarantor1?.occupation || 'व्यवसाय'} | ₹{(guarantor1?.monthlyIncome || 25000).toLocaleString('en-IN')}</td>
                      <td className="p-1">{guarantor2?.occupation || 'व्यवसाय'} | ₹{(guarantor2?.monthlyIncome || 25000).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. Section 4: तारण / सिक्युरिटी तपशील */}
            <div className="border border-black rounded-xs overflow-hidden">
              <div className="bg-slate-200 px-2 py-1 font-bold text-black border-b border-black flex justify-between items-center text-[11px]">
                <span>४. तारण / हमी मालमत्ता तपशील (Security / Collateral Details)</span>
                {application?.securityValue > 0 && (
                  <span className="font-mono font-bold text-[10px]">तारण मूल्यांकन: ₹{application.securityValue.toLocaleString('en-IN')}</span>
                )}
              </div>
              <div className="p-2 text-[11px] space-y-1">
                <div>
                  <span className="text-gray-600">तारण वर्णन / प्रकार: </span>
                  <strong className="text-black">{application?.securityDetails || 'वैयक्तिक हमी व जामीनदार बॉण्ड'}</strong>
                </div>
                {director?.memberID && (
                  <div className="text-[10px] text-black bg-slate-50 p-1 rounded-xs border border-gray-400">
                    शिफारस करणारे संचालक: <strong>{director?.firstName} {director?.lastName}</strong> (सभासद कोड: {director?.memberCode || '-'})
                  </div>
                )}
              </div>
            </div>

            {/* 7. Section 5: प्रतिज्ञापत्र व नियम-अटी (Declaration & Undertaking) */}
            <div className="p-2 bg-slate-50 border border-black rounded-xs text-[9.5px] leading-tight space-y-1 text-gray-900">
              <div className="font-bold text-black">प्रतिज्ञापत्र व हमी (Declaration & Undertaking):</div>
              <p>
                १. मी/आम्ही याद्वारे जाहीर करतो/करतो की, वरील दिलेली सर्व माहिती सत्य व बिनचूक असून संस्थेचे सर्व पोटनियम, कर्ज मंजुरीच्या अटी व शर्ती मला/आम्हाला पूर्णपणे मान्य व बंधनकारक राहतील.
              </p>
              <p>
                २. मंजूर झालेल्या कर्जाची व व्याजाची परतफेड ठरवून दिलेल्या मुदतीत व नियमाप्रमाणे नियमितपणे करण्याची संपूर्ण जबाबदारी कर्जदार व जामीनदारांची संयुक्तिक व वैयक्तिक राहील.
              </p>
            </div>

            {/* 8. Signatures Block */}
            <div className="grid grid-cols-4 gap-2 pt-4 text-center text-[10px] font-bold">
              <div className="space-y-1">
                <div className="border-b border-dashed border-black pb-5"></div>
                <div>कर्जदार सभासदाची सही</div>
              </div>
              <div className="space-y-1">
                <div className="border-b border-dashed border-black pb-5"></div>
                <div>सह-कर्जदाराची सही</div>
              </div>
              <div className="space-y-1">
                <div className="border-b border-dashed border-black pb-5"></div>
                <div>जामीनदार क्र. १ सही</div>
              </div>
              <div className="space-y-1">
                <div className="border-b border-dashed border-black pb-5"></div>
                <div>जामीनदार क्र. २ सही</div>
              </div>
            </div>

            {/* 9. For Office / Sanction Committee Use Only */}
            <div className="border-2 border-black p-2 rounded-xs space-y-1.5 mt-2 bg-slate-50">
              <div className="font-bold text-[10px] text-black uppercase tracking-wider border-b border-black pb-0.5 text-center">
                ।। केवळ कार्यालयीन व कर्ज मंजुरी समितीच्या उपयोगासाठी (For Office & Board Sanction Use Only) ।।
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  शिफारस केलेली रक्कम: <strong>₹{requestedAmount.toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  मंजूर कर्ज रक्कम ₹: ____________________
                </div>
                <div>
                  मंजूर मुदत व व्याजदर: _______ महिने / ___%
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-4 text-center text-[9.5px] font-bold">
                <div>कर्ज लिपिक / तपासनीस</div>
                <div>शाखा व्यवस्थापक</div>
                <div>कर्ज समिती सदस्य</div>
                <div>अध्यक्ष / संचालक मंडळ</div>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer (Hidden on Print) */}
        <div className="bg-slate-100 px-4 py-2 border-t border-gray-200 flex justify-between items-center text-xs shrink-0 no-print">
          <span className="text-gray-500 font-medium">
            टीप: वरील कर्ज मागणी अर्ज A4 कागदावर प्रिंट काढून सभासद व जामीनदारांच्या प्रत्यक्ष स्वाक्षऱ्या घ्याव्यात.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer size={15} />
              <span>प्रिंट करा</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded text-xs transition cursor-pointer"
            >
              बंद करा (Close)
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* PERFECT A4 PRINT ISOLATION CSS                                            */}
      {/* ========================================================================= */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-loan-application,
          #printable-loan-application * {
            visibility: visible !important;
          }
          #printable-loan-application {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 8mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          .print-modal-container > div:first-child > div.no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
};

export default LoanApplicationPrintModal;
