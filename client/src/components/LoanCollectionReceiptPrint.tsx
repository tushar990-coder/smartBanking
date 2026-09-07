import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface LoanCollectionReceiptPrintProps {
  collectionId: number;
  onBack: () => void;
}

export default function LoanCollectionReceiptPrint({ collectionId, onBack }: LoanCollectionReceiptPrintProps) {
  const [collection, setCollection] = useState<any>(null);
  const [sanstha, setSanstha] = useState<any>(null);
  const [accountDetails, setAccountDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [collectionId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Sanstha details
      const sansthaRes = await axios.get('/api/SansthaDetails');
      if (sansthaRes.data && sansthaRes.data.length > 0) setSanstha(sansthaRes.data[0]);

      // Fetch Collection
      const collRes = await axios.get(`/api/LoanCollections`);
      if (collRes.data) {
        const found = collRes.data.find((c: any) => c.loanCollectionID === collectionId);
        if (found) {
            setCollection(found);
            try {
                const detailRes = await axios.get(`/api/LoanAccounts/${found.loanAccountID}/AccountDetailsAndSchedule`);
                if (detailRes.data) {
                    setAccountDetails(detailRes.data);
                }
            } catch (err) { console.error(err); }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!collection) return;
    const sansthaName = sanstha?.sansthaName || 'स्मार्ट मल्टीस्टेट पतसंस्था लि.';
    const borrower = collection.loanAccount?.customer || collection.loanAccount?.member;
    const memberName = borrower ? `${borrower.firstName || ''} ${borrower.lastName || ''}`.trim() : 'खातेदार';
    const mobileNo = borrower?.mobileNo || '';

    const totalCollected = (collection.totalAmountReceived || 0) + (collection.fees?.reduce((acc: number, f: any) => acc + f.amount, 0) || 0);

    const message = 
`🏦 *${sansthaName}*
----------------------------------------
🧾 *कर्ज जमा पावती (Loan Receipt)*

नमस्कार *${memberName}*,
तुमची कर्ज वसुली जमा पावती यशस्वीरित्या नोंदवली गेली आहे:

📄 *पावती क्रमांक:* ${collection.receiptNo}
🗓️ *जमा दिनांक:* ${new Date(collection.collectionDate).toLocaleDateString('en-GB')}
👤 *कर्ज खाते क्र.:* ${collection.loanAccount?.loanAccountNo}
📊 *कर्ज प्रकार:* ${collection.loanAccount?.loanRate?.shortName || collection.loanAccount?.loanRate?.loanType || '-'}

💵 *जमा रक्कम तपशील:*
• मुद्दल जमा: ₹ ${collection.principalCollected?.toLocaleString('en-IN') || '0.00'}
• व्याज जमा: ₹ ${collection.interestCollected?.toLocaleString('en-IN') || '0.00'}
${collection.penaltyInterestCollected > 0 ? `• जादा व्याज: ₹ ${collection.penaltyInterestCollected?.toLocaleString('en-IN')}\n` : ''}${collection.surchargeCollected > 0 ? `• सरचार्ज: ₹ ${collection.surchargeCollected?.toLocaleString('en-IN')}\n` : ''}💰 *एकूण जमा रक्कम:* ₹ ${totalCollected?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
💳 *पेमेंट पद्धत:* ${collection.paymentMode}

सदर पावती संगणक प्रणालीद्वारे तयार करण्यात आली आहे.
धन्यवाद! 🙏
*${sansthaName}*`;

    const encodedMsg = encodeURIComponent(message);
    const cleanMobile = mobileNo ? mobileNo.replace(/\D/g, '') : '';
    if (!navigator.onLine) {
      alert('इंटरनेट कनेक्शन उपलब्ध नाही (Offline Mode). कृपया पावती प्रिंट करा.');
      return;
    }

    const waUrl = `https://api.whatsapp.com/send?${phoneParam}text=${encodedMsg}`;
    window.open(waUrl, '_blank');
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!collection) return <div className="p-8 text-center text-red-500">पावती सापडली नाही (Receipt not found)</div>;

  return (
    <div className="p-1 max-w-4xl mx-auto bg-gray-50 min-h-screen font-sans print:p-0 print:bg-white">
      <style>
        {`
          @media print {
            @page { size: portrait; margin: 10mm; }
            body { background-color: white; font-family: sans-serif; font-size: 11pt; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
      </style>

      {/* Action Buttons */}
      <div className="bg-white p-2 rounded-sm shadow-sm mb-3 border border-gray-200 no-print flex justify-between items-center border-b-2 border-primary">
        <h2 className="text-lg font-bold text-gray-800">Print / Share Receipt</h2>
        <div className="space-x-2 flex items-center">
          <button onClick={onBack} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-sm text-xs font-medium transition-colors">
            मागे जा (Back)
          </button>
          <button onClick={handleWhatsAppShare} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-sm shadow-sm font-medium text-xs transition-colors flex items-center gap-1 inline-flex">
            <span>📲</span> WhatsApp वर पाठवा
          </button>
          <button onClick={handlePrint} className="bg-primary hover:bg-[#004a75] text-white px-3 py-1 rounded-sm shadow-sm font-medium text-xs transition-colors flex items-center gap-1 inline-flex">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            प्रिंट करा (Print)
          </button>
        </div>
      </div>

      {/* Receipt Content */}
      <div className="bg-white border-2 border-slate-700 p-8 mx-auto w-[210mm] min-h-[148mm] shadow-md print:shadow-none print:border-slate-800 print:w-full font-serif">
        {/* Header section with Logo & Text */}
        <div className="relative border-b-2 border-slate-700 pb-4 mb-4 flex justify-between items-center">
          <div className="text-left">
            <h1 className="text-2xl font-extrabold text-primary tracking-wide mb-1 leading-tight">{sanstha?.sansthaName || 'संस्थेचे नाव उपलब्ध नाही'}</h1>
            <p className="text-xs text-gray-600 font-semibold">{sanstha?.address || 'पत्ता उपलब्ध नाही'}</p>
            {sanstha?.registrationNo && <p className="text-[10px] text-gray-500 font-mono mt-0.5">रजिस्ट्रेशन क्र: {sanstha.registrationNo}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-800 border-2 border-slate-700 px-3 py-1 bg-slate-50 rounded-sm">
              कर्ज जमा पावती
            </h2>
            <p className="text-[10px] text-gray-400 font-mono mt-1">संगणकीय पावती</p>
          </div>
        </div>

        {/* Info Grid Section */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-xs bg-slate-50 p-3 rounded border border-slate-200">
          <div className="space-y-1.5 border-r border-slate-200 pr-2">
            <p className="text-gray-600">खातेदार नाव (Borrower Name):</p>
            <p className="text-sm font-bold text-slate-900">
              {collection.loanAccount?.customer ? `${collection.loanAccount.customer.firstName || ''} ${collection.loanAccount.customer.lastName || ''}`.trim() : `${collection.loanAccount?.member?.firstName || ''} ${collection.loanAccount?.member?.lastName || ''}`.trim()}
              {collection.loanAccount?.customer?.cifNo ? ` (CIF: ${collection.loanAccount.customer.cifNo})` : (collection.loanAccount?.member?.memberCode ? ` (कोड: ${collection.loanAccount.member.memberCode})` : '')}
            </p>
            <p className="text-gray-600 mt-1">कर्ज खाते क्र. (Loan Account No): <span className="font-bold text-slate-900 ml-1">{collection.loanAccount?.loanAccountNo}</span></p>
            <p className="text-gray-600">कर्ज प्रकार (Loan Type): <span className="font-bold text-slate-900 ml-1">{collection.loanAccount?.loanRate?.shortName || collection.loanAccount?.loanRate?.loanType || 'N/A'}</span></p>
            {accountDetails && (
              <div className="flex justify-between pt-1 border-t border-dashed border-slate-300 text-[11px]">
                <span className="text-gray-600">मंजूर मर्यादा: <strong className="text-slate-800">₹ {(accountDetails.sanctionedAmount || collection.loanAccount?.sanctionedAmount || 0).toLocaleString('en-IN')}</strong></span>
                <span className="text-gray-600">एकूण वाटप: <strong className="text-blue-900">₹ {(accountDetails.totalDisbursedAmount || collection.loanAccount?.principalBalance || 0).toLocaleString('en-IN')}</strong></span>
              </div>
            )}
          </div>
          <div className="space-y-1.5 pl-2">
            <div className="flex justify-between">
              <span className="text-gray-600">पावती क्र. (Receipt No):</span>
              <span className="font-bold text-primary font-mono">{collection.receiptNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">दिनांक (Date):</span>
              <span className="font-bold text-slate-900 font-mono">{new Date(collection.collectionDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">पेमेंट प्रकार (Payment Mode):</span>
              <span className="font-bold text-slate-900">{collection.paymentMode}</span>
            </div>
            {accountDetails && (
              <div className="flex justify-between pt-1 border-t border-dashed border-slate-300">
                <span className="text-gray-600">३१/३ अखेर बाकी:</span>
                <span className="font-bold text-red-600 font-mono">₹ {accountDetails.march31Balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Collection Details Table */}
        <table className="w-full text-xs border-collapse border border-slate-700 mb-6">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-slate-700">
              <th className="border-r border-slate-700 p-2 text-left text-slate-800">तपशील (Particulars)</th>
              <th className="p-2 text-right w-1/3 text-slate-800">रक्कम (Amount) ₹</th>
            </tr>
          </thead>
          <tbody>
            {collection.principalCollected > 0 && (
              <tr className="border-b border-slate-700 hover:bg-slate-50/50">
                <td className="border-r border-slate-700 p-2 text-slate-700">कर्ज मुद्दल जमा (Principal Recovery)</td>
                <td className="p-2 text-right font-semibold font-mono text-slate-900">{collection.principalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            )}
            {collection.interestCollected > 0 && (
              <tr className="border-b border-slate-700 hover:bg-slate-50/50">
                <td className="border-r border-slate-700 p-2 text-slate-700">कर्ज व्याज जमा (Interest Recovery)</td>
                <td className="p-2 text-right font-semibold font-mono text-slate-900">{collection.interestCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            )}
            {collection.penaltyInterestCollected > 0 && (
              <tr className="border-b border-slate-700 hover:bg-slate-50/50">
                <td className="border-r border-slate-700 p-2 text-slate-700">जादा व्याज जमा (Penal Interest Recovery)</td>
                <td className="p-2 text-right font-semibold font-mono text-slate-900">{collection.penaltyInterestCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            )}
            {collection.surchargeCollected > 0 && (
              <tr className="border-b border-slate-700 hover:bg-slate-50/50">
                <td className="border-r border-slate-700 p-2 text-slate-700">सरचार्ज जमा (Surcharge Recovery)</td>
                <td className="p-2 text-right font-semibold font-mono text-slate-900">{collection.surchargeCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            )}
            {collection.fees?.map((fee: any, idx: number) => (
              <tr key={idx} className="border-b border-slate-700 hover:bg-slate-50/50">
                <td className="border-r border-slate-700 p-2 text-slate-700">{fee.ledger?.ledgerName || 'इतर वसूल'}</td>
                <td className="p-2 text-right font-semibold font-mono text-slate-900">{fee.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-slate-100 border-t border-slate-700">
              <td className="border-r border-slate-700 p-2 text-right text-slate-800">एकूण गोळा रक्कम (Total Collected)</td>
              <td className="p-2 text-right text-sm font-extrabold text-primary font-mono">
                ₹ {((collection.totalAmountReceived || 0) + (collection.fees?.reduce((acc: number, f: any) => acc + f.amount, 0) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Remarks/Footer */}
        <div className="flex justify-between items-start text-[11px] text-gray-700 mt-2">
          <div>
            {collection.remarks && <p className="italic"><span className="font-semibold text-slate-800">शेरा:</span> {collection.remarks}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">टीप: ही संगणक प्रणालीद्वारे तयार केलेली पावती असल्याने स्वाक्षरीची गरज नाही.</p>
          </div>
        </div>

        {/* Signature lines */}
        <div className="flex justify-between mt-12 pt-4 px-4 text-xs font-semibold text-slate-800">
          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1.5">खातेदाराची स्वाक्षरी</div>
          </div>
          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1.5">रोखपाल / लिपिक</div>
          </div>
          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1.5">अधिकारी / व्यवस्थापक</div>
          </div>
        </div>

      </div>
    </div>
  );
}

