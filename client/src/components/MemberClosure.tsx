import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';

interface Member extends MemberOption {}

interface GuaranteedLoanInfo {
  loanAccountID: number;
  loanAccountNo: string;
  borrowerName: string;
  borrowerCode: string;
  borrowerCif: string;
  sanctionedAmount: number;
  principalBalance: number;
  interestBalance: number;
  totalOutstanding: number;
  guarantorType: string;
  status: string;
}

interface ClosureInfo {
  memberId: number;
  memberName: string;
  status: string;
  loanBalance: number;
  savingBalance: number;
  fdBalance: number;
  rdBalance: number;
  pigmyBalance: number;
  shareBalance: number;
  shareCount: number;
  guaranteedLoans?: GuaranteedLoanInfo[];
  hasGuarantorLiability?: boolean;
  totalGuaranteedOutstanding?: number;
  canClose: boolean;
}

const MemberClosure: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [closureInfo, setClosureInfo] = useState<ClosureInfo | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/Members');
      if (res.ok) {
        const data = await res.json();
        // Show active members
        setMembers(data.filter((m: any) => m.status !== 'Closed'));
      }
    } catch (error) {
      console.error('Failed to fetch members', error);
    }
  };

  const loadClosureInfo = async (memberId: string) => {
    setLoading(true);
    setClosureInfo(null);
    setMessage('');
    try {
      const res = await fetch(`/api/Members/${memberId}/ClosureInfo`);
      if (res.ok) {
        const data: ClosureInfo = await res.json();
        setClosureInfo(data);
        if (data.hasGuarantorLiability) {
          setMessage('हा सभासद इतर चालू कर्जांसाठी जामीनदार (Guarantor) असल्याने सभासदत्व रद्द करता येणार नाही.');
        } else if (!data.shareBalance || data.shareBalance <= 0) {
          setMessage('सभासदाचे शेअर शिल्लक नाहीत.');
        }
      } else {
        setMessage('Failed to load member closure info.');
      }
    } catch (err) {
      setMessage('Network error.');
    }
    setLoading(false);
  };

  const handleMemberChange = (e: { target: { name?: string; value: string | number } } | React.ChangeEvent<HTMLSelectElement>) => {
    const val = String(e.target.value || '');
    setSelectedMemberId(val);
    if (val !== '') {
      loadClosureInfo(val);
    } else {
      setClosureInfo(null);
      setMessage('');
    }
  };

  const handleCloseMember = async () => {
    if (!selectedMemberId || !closureInfo) return;
    
    if (closureInfo.hasGuarantorLiability) {
      setMessage('हा सभासद इतर चालू कर्जांसाठी जामीनदार (Guarantor) असल्याने सभासदत्व रद्द करता येणार नाही. प्रथम संबंधित कर्जाची परतफेड किंवा जामीनदार बदल करणे आवश्यक आहे.');
      return;
    }

    if (!closureInfo.canClose) {
      setMessage('सर्व बाकी (Loans/Savings/Guarantor Liability) शून्य (0) असल्याशिवाय सभासदत्व रद्द करता येणार नाही.');
      return;
    }

    let confirmMsg = `तुम्ही नक्की ${closureInfo.memberName} यांचे सभासदत्व रद्द करू इच्छिता? (Are you sure?)`;
    if (closureInfo.shareBalance > 0) {
      confirmMsg += `\n\nया सभासदाचे ₹${closureInfo.shareBalance} चे शेअर्स आहेत. सभासदत्व रद्द केल्यावर हे शेअर्स काढून (Withdraw) त्याचे व्हाउचर आपोआप तयार होईल.`;
    }

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/Members/${selectedMemberId}/Close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: 1,
          narration: 'Member Closure'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('सभासदत्व यशस्वीरित्या रद्द करण्यात आले आहे (Member successfully closed).');
        setClosureInfo(null);
        setSelectedMemberId('');
        fetchMembers(); // refresh list
      } else {
        setMessage(data.message || (typeof data === 'string' ? data : 'Closure failed.'));
      }
    } catch (err) {
      setMessage('Error during member closure.');
    }
    setLoading(false);
  };

  const memberOptions = members.map(m => ({ 
      value: m.memberID.toString(), 
      label: `${m.cifNo ? m.cifNo + ' - ' : ''}${m.firstName} ${m.lastName}`
  }));

  return (
    <div className="p-2 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans relative overflow-y-auto">
      {/* Page Header */}
      <div className="flex justify-between items-center border-b border-gray-300 pb-1.5 mb-2">
        <div className="text-xs font-bold text-primary flex items-center gap-1.5">
          <span>🔒</span> सभासदत्व रद्द करणे / खाते बंद (Member Resignation & Closure)
        </div>
        <div className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-sm border border-primary/20">
          शेअर मॉड्युल (Share Capital Module)
        </div>
      </div>

      {message && (
        <div className={`mb-2 p-2 rounded-sm font-bold text-xs border flex items-center gap-2 ${message.includes('यशस्वी') || message.includes('successfully') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-300'}`}>
          <span>{message.includes('यशस्वी') || message.includes('successfully') ? '✅' : '⚠️'}</span>
          <span>{message}</span>
        </div>
      )}

      {/* Member Selector Card */}
      <div className="bg-white p-3 rounded-sm shadow-xs mb-3 border border-gray-200">
        <label className="block text-xs font-bold text-gray-700 mb-1">सभासद निवडा (Select Active Member) *</label>
        <MemberSearchSelect 
          members={members} 
          value={selectedMemberId ? Number(selectedMemberId) : ''} 
          onChange={(val) => handleMemberChange({ target: { value: val ? String(val) : '' } })} 
          placeholder="-- सभासद नाव, कोड किंवा मोबाईलने शोधा --"
        />
      </div>

      {/* Closure Audit Details Card */}
      {selectedMemberId !== '' && closureInfo ? (
        <div className="bg-white p-3 rounded-sm shadow-xs border border-gray-200 space-y-3">
          <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
            <h3 className="text-xs font-bold text-primary flex items-center gap-1.5">
              <span>📋</span> सभासदाची चालू खाती व शिल्लक ऑडिट (Accounts Audit)
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${closureInfo.canClose ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
              {closureInfo.canClose 
                ? '✓ खाते बंद करण्यास पात्र (Eligible)' 
                : (closureInfo.hasGuarantorLiability 
                    ? '⚠️ खाते बंद करू शकत नाही (जामीनदार दायित्व बाकी)' 
                    : '⚠️ खाते बंद करू शकत नाही (Pending Balances)')}
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* Loan Balance */}
            <div className={`p-2.5 rounded-sm border transition-all ${closureInfo.loanBalance > 0 ? 'bg-amber-50/70 border-amber-300 shadow-xs' : 'bg-white border-gray-200'}`}>
              <div className="text-[10px] text-gray-600 font-bold mb-0.5 flex items-center justify-between">
                <span>📉 स्वतःचे कर्ज बाकी</span>
                {closureInfo.loanBalance > 0 && <span className="text-amber-600">⚠️</span>}
              </div>
              <div className={`text-base font-black ${closureInfo.loanBalance > 0 ? 'text-amber-900' : 'text-gray-700'}`}>
                ₹{closureInfo.loanBalance.toFixed(2)}
              </div>
            </div>

            {/* Guarantor Liability Balance */}
            <div className={`p-2.5 rounded-sm border transition-all ${closureInfo.hasGuarantorLiability ? 'bg-amber-50/80 border-amber-400 shadow-xs' : 'bg-white border-gray-200'}`}>
              <div className="text-[10px] text-gray-700 font-bold mb-0.5 flex items-center justify-between">
                <span className="truncate">🛡️ जामीनदार दायित्व</span>
                {closureInfo.hasGuarantorLiability && <span className="text-amber-700 font-bold">⚠️</span>}
              </div>
              <div className={`text-base font-black ${closureInfo.hasGuarantorLiability ? 'text-amber-900' : 'text-gray-700'}`}>
                ₹{(closureInfo.totalGuaranteedOutstanding || 0).toFixed(2)}
              </div>
            </div>

            {/* Saving Balance */}
            <div className={`p-2.5 rounded-sm border transition-all ${closureInfo.savingBalance > 0 ? 'bg-amber-50/60 border-amber-300 shadow-xs' : 'bg-white border-gray-200'}`}>
              <div className="text-[10px] text-gray-600 font-bold mb-0.5 flex items-center justify-between">
                <span>💰 बचत खाती (Saving)</span>
                {closureInfo.savingBalance > 0 && <span className="text-amber-600">⚠️</span>}
              </div>
              <div className={`text-base font-black ${closureInfo.savingBalance > 0 ? 'text-amber-900' : 'text-gray-700'}`}>
                ₹{closureInfo.savingBalance.toFixed(2)}
              </div>
            </div>

            {/* FD Balance */}
            <div className={`p-2.5 rounded-sm border transition-all ${closureInfo.fdBalance > 0 ? 'bg-amber-50/60 border-amber-300 shadow-xs' : 'bg-white border-gray-200'}`}>
              <div className="text-[10px] text-gray-600 font-bold mb-0.5 flex items-center justify-between">
                <span>🏦 मुदत ठेव (FD)</span>
                {closureInfo.fdBalance > 0 && <span className="text-amber-600">⚠️</span>}
              </div>
              <div className={`text-base font-black ${closureInfo.fdBalance > 0 ? 'text-amber-900' : 'text-gray-700'}`}>
                ₹{closureInfo.fdBalance.toFixed(2)}
              </div>
            </div>

            {/* RD Balance */}
            <div className={`p-2.5 rounded-sm border transition-all ${closureInfo.rdBalance > 0 ? 'bg-amber-50/60 border-amber-300 shadow-xs' : 'bg-white border-gray-200'}`}>
              <div className="text-[10px] text-gray-600 font-bold mb-0.5 flex items-center justify-between">
                <span>🪙 आवर्ती ठेव (RD)</span>
                {closureInfo.rdBalance > 0 && <span className="text-amber-600">⚠️</span>}
              </div>
              <div className={`text-base font-black ${closureInfo.rdBalance > 0 ? 'text-amber-900' : 'text-gray-700'}`}>
                ₹{closureInfo.rdBalance.toFixed(2)}
              </div>
            </div>

            {/* Pigmy Balance */}
            <div className={`p-2.5 rounded-sm border transition-all ${closureInfo.pigmyBalance > 0 ? 'bg-amber-50/60 border-amber-300 shadow-xs' : 'bg-white border-gray-200'}`}>
              <div className="text-[10px] text-gray-600 font-bold mb-0.5 flex items-center justify-between">
                <span>🐖 पिग्मी (Pigmy)</span>
                {closureInfo.pigmyBalance > 0 && <span className="text-amber-600">⚠️</span>}
              </div>
              <div className={`text-base font-black ${closureInfo.pigmyBalance > 0 ? 'text-amber-900' : 'text-gray-700'}`}>
                ₹{closureInfo.pigmyBalance.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Guarantor Loans Details Table (जामीनदार दायित्व अहवाल) */}
          {closureInfo.guaranteedLoans && closureInfo.guaranteedLoans.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-sm p-3 space-y-2 shadow-2xs">
              <div className="flex justify-between items-center pb-1 border-b border-gray-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <span className="text-sm">🛡️</span>
                  <span>जामीनदार दायित्व अहवाल (Guarantor on Active Loans)</span>
                </div>
                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded border border-primary/20">
                  एकूण जामीन कर्जे: {closureInfo.guaranteedLoans.length}
                </span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded bg-white">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-1.5 border-r border-gray-200">कर्ज खाते क्र. (Loan No)</th>
                      <th className="p-1.5 border-r border-gray-200">मुख्य कर्जदाराचे नाव (Borrower Name)</th>
                      <th className="p-1.5 border-r border-gray-200 text-center">जामीनदार पद</th>
                      <th className="p-1.5 border-r border-gray-200 text-right">मंजूर रक्कम (Sanctioned)</th>
                      <th className="p-1.5 border-r border-gray-200 text-right">शिल्लक मुद्दल</th>
                      <th className="p-1.5 border-r border-gray-200 text-right">शिल्लक व्याज</th>
                      <th className="p-1.5 text-right font-bold text-slate-800">एकूण थकबाकी (Outstanding)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {closureInfo.guaranteedLoans.map((gl) => (
                      <tr key={gl.loanAccountID} className="hover:bg-slate-50 transition-colors">
                        <td className="p-1.5 border-r border-gray-100 font-bold text-primary">{gl.loanAccountNo}</td>
                        <td className="p-1.5 border-r border-gray-100 font-semibold text-gray-800">
                          {gl.borrowerName}
                          {gl.borrowerCode && <span className="text-[10px] text-gray-500 ml-1">({gl.borrowerCode})</span>}
                        </td>
                        <td className="p-1.5 border-r border-gray-100 text-center">
                          <span className="bg-gray-100 text-gray-700 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-gray-200">
                            {gl.guarantorType}
                          </span>
                        </td>
                        <td className="p-1.5 border-r border-gray-100 text-right font-medium">₹{gl.sanctionedAmount.toFixed(2)}</td>
                        <td className="p-1.5 border-r border-gray-100 text-right font-medium">₹{gl.principalBalance.toFixed(2)}</td>
                        <td className="p-1.5 border-r border-gray-100 text-right font-medium">₹{gl.interestBalance.toFixed(2)}</td>
                        <td className={`p-1.5 text-right font-bold ${gl.totalOutstanding > 0 ? 'text-amber-900' : 'text-emerald-700'}`}>
                          ₹{gl.totalOutstanding.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {closureInfo.hasGuarantorLiability && (
                <div className="bg-amber-50/90 border border-amber-200 p-2 rounded text-[10.5px] text-amber-900 font-medium flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>टीप: जोपर्यंत मुख्य कर्जदार कर्जाची पूर्ण परतफेड करत नाही किंवा संस्थेत जाऊन दुसरा जामीनदार बदलत नाही, तोपर्यंत हा सभासद राजीनामा देऊ शकत नाही.</span>
                </div>
              )}
            </div>
          )}

          {/* Share Capital Highlight Box */}
          <div className="p-3 rounded-sm shadow-xs border bg-primary/5 border-primary/20">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-extrabold flex items-center gap-1 text-primary">
                  <span>📜</span> परत करावयाचे शेअर भांडवल (Share Capital to Refund)
                </div>
                <div className="text-xs font-bold mt-0.5">
                  {closureInfo.shareBalance > 0 ? (
                    <span className="text-gray-700">एकूण शेअर्स संख्या: <span className="text-primary text-sm font-black">{closureInfo.shareCount}</span> शेअर्स</span>
                  ) : (
                    <span className="text-gray-500 font-medium">सभासदाचे शेअर शिल्लक नाहीत.</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wide text-primary">एकूण शेअर रक्कम</div>
                <div className="text-xl font-black text-primary">₹{closureInfo.shareBalance.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {!closureInfo.canClose && (
            <div className="bg-amber-50 border border-amber-300 p-2.5 text-amber-900 text-xs font-medium rounded-sm flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>
                {closureInfo.hasGuarantorLiability
                  ? 'हा सभासद इतर चालू कर्जांसाठी जामीनदार (Guarantor) असल्याने व त्या कर्जाची बाकी शिल्लक असल्याने सभासदत्व रद्द करता येणार नाही. सर्व कर्जे, ठेवी व जामीनदार दायित्व शून्य (₹ 0.00) असणे अनिवार्य आहे.'
                  : 'वर दर्शवलेली सर्व कर्जे व ठेवींची खाती बंद केल्याशिवाय व त्यांची बाकी शून्य (₹ 0.00) असल्याशिवाय सभासदत्व रद्द करता येणार नाही.'}
              </span>
            </div>
          )}

          <div className="border-t border-gray-200 pt-3">
            <button 
              onClick={handleCloseMember}
              className={`w-full px-4 py-2 rounded-sm font-bold shadow-xs transition-colors text-xs uppercase tracking-wide flex items-center justify-center gap-2 ${
                closureInfo.canClose
                  ? 'bg-primary hover:bg-[#004a75] text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed'
              }`}
              disabled={loading || !closureInfo.canClose}
            >
              <span>🔒</span>
              <span>
                {loading ? 'Processing...' : (closureInfo.shareBalance > 0 ? 'शेअर्स काढा आणि सभासदत्व रद्द करा (Withdraw Shares & Close Member)' : 'सभासदत्व रद्द करा (Close Member)')}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-sm shadow-xs border border-gray-200 text-center flex flex-col justify-center items-center">
          <span className="text-3xl mb-2">👈</span>
          <p className="text-primary font-bold text-xs">सभासदत्व रद्द करण्याची प्रक्रिया करण्यासाठी वरील ड्रॉपडाऊनमधून सभासद निवडा.</p>
          <p className="text-[10px] text-gray-500 mt-1">(Select an active member from the dropdown above to audit accounts and process closure)</p>
        </div>
      )}
    </div>
  );
};

export default MemberClosure;
