import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';

interface SavingAccount {
  savingAccountID: number;
  accountNo: string;
  cifNo?: string;
  customerID?: number;
  customerName?: string;
  memberID?: number;
  memberName?: string;
  currentBalance: number;
}

interface SavingTransaction {
  transactionID: number;
  transactionDate: string;
  transactionType: string;
  amount: number;
  balanceAfterTxn: number;
  narration?: string;
  isPrintedOnPassbook: number;
}

const SavingPassbookMaster: React.FC = () => {
  const [accounts, setAccounts] = useState<SavingAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavingAccount | null>(null);
  const [transactions, setTransactions] = useState<SavingTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startingLine, setStartingLine] = useState(1);

  const API_URL = '/api';

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API_URL}/SavingAccounts`);
      setAccounts(response.data);

      const params = new URLSearchParams(window.location.search);
      const customerIdStr = params.get('customerId') || params.get('customerID');
      const memberIdStr = params.get('memberId');
      const accountIdStr = params.get('accountId') || params.get('savingAccountId');

      let matchedAcc: any = null;
      if (accountIdStr) {
        const accId = parseInt(accountIdStr, 10);
        matchedAcc = response.data.find((a: any) => a.savingAccountID === accId);
      } else if (customerIdStr) {
        const cId = parseInt(customerIdStr, 10);
        matchedAcc = response.data.find((a: any) => a.customerID === cId);
      } else if (memberIdStr) {
        const mId = parseInt(memberIdStr, 10);
        matchedAcc = response.data.find((a: any) => a.customerID === mId || a.memberID === mId);
      }

      if (matchedAcc) {
        setSelectedAccount(matchedAcc);
        setLoading(true);
        try {
          const txRes = await axios.get(`${API_URL}/SavingTransactions/account/${matchedAcc.savingAccountID}`);
          setTransactions(txRes.data);
        } catch (err) {
          console.error('Error fetching transactions', err);
          setError('व्यवहार लोड करता आले नाहीत.');
        } finally {
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Error fetching accounts', err);
    }
  };

  const handleAccountChange = async (e: any) => {
    const accountId = parseInt(e.target.value);
    const acc = accounts.find(a => a.savingAccountID === accountId) || null;
    setSelectedAccount(acc);
    setTransactions([]);
    setError('');

    if (acc) {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/SavingTransactions/account/${accountId}`);
        setTransactions(response.data);
      } catch (err) {
        console.error('Error fetching transactions', err);
        setError('व्यवहार लोड करता आले नाहीत.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const accountOptions = accounts.map(a => {
    const cifPart = a.cifNo ? ` [CIF: ${a.cifNo}]` : '';
    const namePart = a.customerName || a.memberName || 'अज्ञात';
    return {
      value: a.savingAccountID,
      label: `${a.accountNo}${cifPart} - ${namePart}`
    };
  });

  // Empty rows to simulate spacing if the print starts on a line other than 1
  const emptyRows = Array.from({ length: startingLine - 1 });

  return (
    <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #passbook-print-area, #passbook-print-area * {
            visibility: visible;
          }
          #passbook-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            font-size: 11px;
            font-family: monospace;
          }
          .no-print {
            display: none !important;
          }
          .print-border-none td {
            border: none !important;
          }
        }
      `}} />

      {/* Title Header */}
      <div className="mb-2 flex justify-between items-end border-b-2 border-red-600 pb-1 no-print">
        <h1 className="text-lg font-bold text-gray-800">पासबुक छपाई (Saving Deposit Passbook Printing)</h1>
      </div>

      {/* Form Area */}
      <div className="bg-white p-1.5 rounded-sm shadow-sm border border-gray-200 mb-3 no-print">
        <h2 className="text-sm font-bold text-primary mb-1 border-b pb-0.5">पासबुक प्रिंट पर्याय (Print Options)</h2>

        {error && (
          <div className="mb-2 bg-red-50 text-red-600 px-2 py-1 rounded-sm text-xs border border-red-100">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-1.5 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">बचत खाते निवडा *</label>
            <SearchableSelect
              options={accountOptions}
              value={selectedAccount?.savingAccountID || 0}
              onChange={handleAccountChange}
              name="savingAccountID"
              placeholder="-- खाते निवडा --"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">कोणत्या ओळीपासून छपाई करायची? (Starting Line)</label>
            <input
              type="number"
              min="1"
              max="20"
              value={startingLine}
              onChange={(e) => setStartingLine(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs bg-white"
            />
          </div>

          <div>
            <button
              onClick={handlePrint}
              disabled={transactions.length === 0}
              className="w-full bg-primary hover:bg-[#004a75] text-white px-6 py-1 rounded-sm font-medium shadow-sm transition-colors text-xs disabled:opacity-50"
            >
              पासबुक प्रिंट करा (Print Passbook)
            </button>
          </div>
        </div>
      </div>

      {/* Passbook Print Preview Box */}
      {selectedAccount && (
        <div className="bg-white p-4 rounded-sm shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-2 border-b pb-1 no-print">
            <h3 className="text-sm font-bold text-gray-800">पासबुक छपाई पूर्वदृश्य (Passbook Print Preview)</h3>
            <span className="text-xs text-gray-500 font-semibold">ओळ क्रमांक: {startingLine} पासून सुरू</span>
          </div>

          <div id="passbook-print-area" className="border p-4 bg-yellow-50/20 max-w-3xl mx-auto rounded-sm">
            <div className="mb-2 text-center text-xs font-bold font-mono tracking-wider border-b pb-1">
              बचत खाते पासबुक (SAVING DEPOSIT PASSBOOK) - {selectedAccount.accountNo} ({selectedAccount.customerName || selectedAccount.memberName || 'खातेदार'}{selectedAccount.cifNo ? ` | CIF: ${selectedAccount.cifNo}` : ''})
            </div>

            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-gray-400 text-left font-bold">
                  <th className="py-1 w-24">दिनांक (Date)</th>
                  <th className="py-1">तपशील (Particulars)</th>
                  <th className="py-1 text-right w-24">जमा (Deposit)</th>
                  <th className="py-1 text-right w-24">नावे (Withdrawal)</th>
                  <th className="py-1 text-right w-24">शिल्लक (Balance)</th>
                </tr>
              </thead>
              <tbody>
                {/* Simulated Empty Rows for Starting Line Offset */}
                {emptyRows.map((_, i) => (
                  <tr key={`empty-${i}`} className="h-5">
                    <td colSpan={5} className="text-gray-300 italic text-[10px] text-center font-mono">
                      [ओळ {i + 1} - रिकामी ओळ]
                    </td>
                  </tr>
                ))}

                {/* Actual Transaction Rows */}
                {transactions.map((t) => {
                  const isDeposit = t.transactionType === 'Deposit' || t.transactionType === 'Interest';
                  const isWithdrawal = t.transactionType === 'Withdrawal' || t.transactionType === 'Charges';
                  
                  return (
                    <tr key={t.transactionID} className="border-b border-dashed border-gray-200 hover:bg-gray-50/50">
                      <td className="py-1 text-gray-700">{new Date(t.transactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td className="py-1 text-gray-800 truncate max-w-xs">{t.narration || t.transactionType}</td>
                      <td className="py-1 text-right font-semibold text-emerald-600">
                        {isDeposit ? `₹${t.amount.toFixed(2)}` : ''}
                      </td>
                      <td className="py-1 text-right font-semibold text-red-600">
                        {isWithdrawal ? `₹${t.amount.toFixed(2)}` : ''}
                      </td>
                      <td className="py-1 text-right font-bold text-gray-800">
                        ₹{t.balanceAfterTxn.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}

                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      या खात्यावर कोणतेही व्यवहार नाहीत.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingPassbookMaster;

