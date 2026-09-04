import React, { useState, useEffect } from 'react';
import { getAmountInWordsMarathi } from '../utils/marathiWords';

interface VoucherPrintProps {
  voucherId: number;
  onBack: () => void;
}

export default function VoucherPrint({ voucherId, onBack }: VoucherPrintProps) {
  const [voucher, setVoucher] = useState<any>(null);
  const [sanstha, setSanstha] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [voucherId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Sanstha details
      const sansthaRes = await fetch('/api/SansthaDetails');
      if (sansthaRes.ok) {
        const sansthaData = await sansthaRes.json();
        if (sansthaData.length > 0) setSanstha(sansthaData[0]);
      }

      // Fetch Voucher
      const voucherRes = await fetch(`/api/Vouchers/${voucherId}`);
      if (voucherRes.ok) {
        setVoucher(await voucherRes.json());
      } else {
        alert('Voucher not found!');
        onBack();
      }
    } catch (error) {
      console.error(error);
      alert('Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!voucher) return null;

  return (
    <div className="p-1 max-w-4xl mx-auto bg-gray-50 min-h-screen font-sans print:p-0 print:bg-white">
      <style>
        {`
          @media print {
            @page { size: portrait; margin: 10mm; }
            body { background-color: white; font-family: sans-serif; font-size: 11pt; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
          }
        `}
      </style>

      {/* Action Buttons */}
      <div className="bg-white p-2 rounded-sm shadow-sm mb-3 border border-gray-200 no-print flex justify-between items-center border-b-2 border-primary">
        <h2 className="text-lg font-bold text-gray-800">Print Voucher</h2>
        <div className="space-x-2">
          <button onClick={onBack} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-sm text-xs font-medium transition-colors">
            मागे जा (Back)
          </button>
          <button onClick={handlePrint} className="bg-primary hover:bg-[#004a75] text-white px-3 py-1 rounded-sm shadow-sm font-medium text-xs transition-colors flex items-center gap-1 inline-flex">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            प्रिंट करा (Print)
          </button>
        </div>
      </div>

      <VoucherPrintTemplate voucher={voucher} sanstha={sanstha} />
    </div>
  );
}

export function VoucherPrintTemplate({ voucher, sanstha }: { voucher: any, sanstha: any }) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const partyDetail = voucher.voucherDetails?.find((d: any) => d.member != null) || 
                      voucher.voucherDetails?.find((d: any) => d.ledger?.ledgerName !== 'Cash' && !d.ledger?.ledgerName?.includes('रोख'));

  const partyName = partyDetail?.member 
    ? `${partyDetail.member.memberCode} - ${partyDetail.member.firstName} ${partyDetail.member.lastName}`
    : (partyDetail?.ledger?.ledgerName || 'Unknown');

  let vTypeMarathi = voucher.voucherType;
  if (voucher.voucherType === 'Receipt') vTypeMarathi = 'जमा पावती (RECEIPT)';
  if (voucher.voucherType === 'Payment') vTypeMarathi = 'नावे पावती (PAYMENT)';
  if (voucher.voucherType === 'Contra') vTypeMarathi = 'कॉन्ट्रा (CONTRA)';
  if (voucher.voucherType === 'Journal') vTypeMarathi = 'जर्नल (JOURNAL)';

  const totalDr = voucher.voucherDetails?.filter((d: any) => d.drCr === 'Dr').reduce((sum: number, d: any) => sum + d.amount, 0) || 0;
  const totalCr = voucher.voucherDetails?.filter((d: any) => d.drCr === 'Cr').reduce((sum: number, d: any) => sum + d.amount, 0) || 0;

  return (
      <div className="bg-white p-4 mx-auto print:p-0 relative text-gray-900" style={{ maxWidth: '210mm', height: '138mm', boxSizing: 'border-box', fontFamily: '"Noto Sans", "Arial", sans-serif', pageBreakInside: 'avoid' }}>
        
        {/* Outer Border */}
        <div className="border border-gray-400 p-4 h-full relative shadow-sm print:shadow-none flex flex-col">
          
          {/* Header Section */}
          <div className="text-center relative pb-2 mb-3 border-b-2 border-gray-800 flex flex-col items-center justify-center">
            {sanstha?.registrationNo && (
              <div className="absolute top-0 left-0 text-[10px] text-gray-600">
                रजि.नं.: <span className="font-semibold text-gray-800">{sanstha.registrationNo}</span>
              </div>
            )}
            {sanstha?.contactNo && (
              <div className="absolute top-0 right-0 text-[10px] text-gray-600">
                मोबाईल: <span className="font-semibold text-gray-800">{sanstha.contactNo}</span>
              </div>
            )}
            
            <h1 className="text-2xl font-extrabold text-blue-900 tracking-wide mt-1 mb-0">{sanstha?.sansthaName}</h1>
            <h2 className="text-xs font-medium text-gray-600">{sanstha?.address}</h2>
            
            <div className="mt-2">
              <span className="bg-gray-800 text-white font-bold px-4 py-1 rounded-full text-sm shadow-sm print:border print:border-gray-800 print:text-black print:bg-gray-100 uppercase tracking-widest">
                {vTypeMarathi}
              </span>
            </div>
          </div>

          {/* Voucher Info & Party Info */}
          <div className="flex justify-between mb-3 text-[11px]">
            <div className="w-1/2 pr-2 space-y-1">
              <div className="flex items-start">
                <span className="w-28 text-gray-500 font-medium">पार्टी / सभासदाचे नाव :</span> 
                <span className="flex-1 font-bold text-gray-800 border-b border-dashed border-gray-300 pb-0.5">{partyName}</span>
              </div>
              <div className="flex items-start">
                <span className="w-28 text-gray-500 font-medium">पावती प्रकार :</span> 
                <span className="flex-1 font-bold text-gray-800 border-b border-dashed border-gray-300 pb-0.5">{voucher.voucherType}</span>
              </div>
            </div>
            <div className="w-1/2 pl-2 space-y-1">
              <div className="flex items-start">
                <span className="w-32 text-gray-500 font-medium text-right pr-2">पावती क्र. (Voucher No) :</span> 
                <span className="flex-1 font-bold text-gray-800 border-b border-dashed border-gray-300 pb-0.5">
                  {voucher.voucherNo} {voucher.scrollNo ? <span className="ml-1 text-primary font-black text-[10px]">(स्क्रॉल क्र. #{voucher.scrollNo})</span> : ''}
                </span>
              </div>
              <div className="flex items-start">
                <span className="w-32 text-gray-500 font-medium text-right pr-2">दिनांक (Date) :</span> 
                <span className="flex-1 font-bold text-gray-800 border-b border-dashed border-gray-300 pb-0.5">{formatDate(voucher.voucherDate)}</span>
              </div>
            </div>
          </div>

          {/* Transaction Grid */}
          <div className="flex-grow flex flex-col">
            <table className="w-full border-collapse border border-gray-400 mb-2 text-[11px]">
              <thead>
                <tr className="bg-gray-100 print:bg-gray-50 border-b border-gray-400">
                  <th className="border-r border-gray-400 p-1 text-center w-8 text-gray-600 font-semibold">अ.नं.</th>
                  <th className="border-r border-gray-400 p-1 text-gray-600 font-semibold text-left">तपशील (Particulars / Ledger)</th>
                  <th className="border-r border-gray-400 p-1 text-right w-24 text-gray-600 font-semibold">नावे (Debit) ₹</th>
                  <th className="p-1 text-right w-24 text-gray-600 font-semibold">जमा (Credit) ₹</th>
                </tr>
              </thead>
              <tbody>
                {voucher.voucherDetails?.map((d: any, index: number) => (
                  <tr key={d.voucherDetailID || index} className="border-b border-gray-200 print:border-gray-300">
                    <td className="border-r border-gray-400 p-1 text-center text-gray-500">{index + 1}</td>
                    <td className="border-r border-gray-400 p-1">
                      <span className="font-bold text-gray-800">{d.ledger?.ledgerName}</span>
                      {d.member && <div className="text-[10px] text-gray-500 mt-0.5">({d.member.memberCode} - {d.member.firstName} {d.member.lastName})</div>}
                    </td>
                    <td className="border-r border-gray-400 p-1 text-right font-medium">
                      {d.drCr === 'Dr' ? d.amount.toFixed(2) : ''}
                    </td>
                    <td className="p-1 text-right font-medium">
                      {d.drCr === 'Cr' ? d.amount.toFixed(2) : ''}
                    </td>
                  </tr>
                ))}
                {/* Empty rows to maintain height if needed */}
                {voucher.voucherDetails?.length < 3 && [...Array(3 - (voucher.voucherDetails?.length || 0))].map((_, i) => (
                  <tr key={'empty-'+i} className="border-b border-gray-200 print:border-gray-300 h-6">
                    <td className="border-r border-gray-400"></td>
                    <td className="border-r border-gray-400"></td>
                    <td className="border-r border-gray-400"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-600 font-bold bg-gray-50 print:bg-white">
                  <td colSpan={2} className="border-r border-gray-400 p-1 text-right text-gray-700">एकूण (Total) :</td>
                  <td className="border-r border-gray-400 p-1 text-right text-[11px] text-gray-900">{totalDr.toFixed(2)}</td>
                  <td className="p-1 text-right text-[11px] text-gray-900">{totalCr.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Narration & Amount in Words */}
          <div className="space-y-1.5 mb-10 text-[11px]">
            <div className="flex">
              <span className="text-gray-500 font-medium w-28">तपशील (Narration):</span> 
              <span className="flex-1 italic text-gray-700 border-b border-dashed border-gray-300 pb-0.5">{voucher.narration || '-'}</span>
            </div>
            <div className="bg-blue-50/50 print:bg-white p-1.5 rounded border border-blue-100 print:border-gray-300 flex items-center">
              <span className="text-gray-500 font-medium w-28">अक्षरी रक्कम:</span> 
              <span className="flex-1 font-bold text-gray-900 text-xs uppercase tracking-wide">
                {getAmountInWordsMarathi(totalDr)}
              </span>
            </div>
          </div>

          {/* Signatures */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end text-xs text-gray-600">
            <div className="w-1/3 text-center">
              <div className="mx-auto w-32 border-t border-gray-400 pt-1 font-semibold">तयार करणारा<br/><span className="text-[10px] text-gray-400 font-normal">(Prepared By)</span></div>
            </div>
            <div className="w-1/3 text-center">
              <div className="mx-auto w-32 border-t border-gray-400 pt-1 font-semibold">तपासणारा<br/><span className="text-[10px] text-gray-400 font-normal">(Checked By)</span></div>
            </div>
            <div className="w-1/3 text-center">
              <div className="mx-auto w-32 border-t border-gray-400 pt-1 font-semibold">अधिकारी<br/><span className="text-[10px] text-gray-400 font-normal">(Auth. Signatory)</span></div>
            </div>
          </div>
          
        </div>
      </div>
  );
}

