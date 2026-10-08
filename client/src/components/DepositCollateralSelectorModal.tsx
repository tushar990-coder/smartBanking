import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  X, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  Landmark, 
  Calendar,
  Lock,
  IndianRupee
} from 'lucide-react';

export interface EligibleDeposit {
  depositType: string;
  depositAccountID: number;
  accountNo: string;
  depositAmount: number;
  currentBalance: number;
  interestRate: number;
  openingDate: string;
  maturityDate?: string;
  isLienMarked: boolean;
  lienLoanAccountNo?: string;
  lienAmount?: number;
  maxEligibleLoan: number;
  schemeName: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerID: number | string;
  customerName?: string;
  collateralCategory: string; // FixedDeposit, PigmyDeposit, RecurringDeposit, SavingDeposit
  maxLtv?: number; // e.g. 85
  onApply: (selectedCollaterals: EligibleDeposit[], totalCollateralValue: number, summaryText: string) => void;
  alreadySelectedIds?: number[];
}

const DepositCollateralSelectorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  customerID,
  customerName,
  collateralCategory,
  maxLtv = 85,
  onApply,
  alreadySelectedIds = []
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<EligibleDeposit[]>([]);
  const [selectedMap, setSelectedMap] = useState<{ [id: number]: boolean }>({});

  useEffect(() => {
    if (isOpen && customerID && Number(customerID) > 0) {
      fetchDeposits();
    } else {
      setDeposits([]);
      setSelectedMap({});
      setError(null);
    }
  }, [isOpen, customerID, collateralCategory, maxLtv]);

  const fetchDeposits = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/LoanCollaterals/EligibleDeposits', {
        params: {
          customerId: customerID,
          collateralCategory: collateralCategory,
          maxLtv: maxLtv || 85
        }
      });
      setDeposits(res.data || []);

      // Pre-select if previously selected
      const initMap: { [id: number]: boolean } = {};
      if (alreadySelectedIds && alreadySelectedIds.length > 0) {
        alreadySelectedIds.forEach(id => {
          initMap[id] = true;
        });
      }
      setSelectedMap(initMap);
    } catch (err: any) {
      console.error('Failed to load eligible deposits', err);
      setError(err?.response?.data || 'ग्राहक तारण ठेवी लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const toggleSelect = (dep: EligibleDeposit) => {
    if (dep.isLienMarked) return; // Cannot select already lien-marked deposit
    setSelectedMap(prev => ({
      ...prev,
      [dep.depositAccountID]: !prev[dep.depositAccountID]
    }));
  };

  const selectedDeposits = deposits.filter(d => selectedMap[d.depositAccountID]);
  const totalCollateralValue = selectedDeposits.reduce((sum, d) => sum + (d.currentBalance || d.depositAmount || 0), 0);
  const totalMaxLoanLimit = selectedDeposits.reduce((sum, d) => sum + (d.maxEligibleLoan || 0), 0);

  const handleConfirm = () => {
    if (selectedDeposits.length === 0) {
      alert('कृपया किमान एक ठेव तारण म्हणून निवडा.');
      return;
    }

    const typeLabel = collateralCategory === 'FixedDeposit' 
      ? 'मुदत ठेव (FD)' 
      : collateralCategory === 'PigmyDeposit' 
        ? 'पिग्मी ठेव' 
        : collateralCategory === 'RecurringDeposit'
          ? 'आवर्ती ठेव (RD)'
          : 'बचत ठेव';

    const accountList = selectedDeposits.map(d => d.accountNo).join(', ');
    const summary = `${typeLabel} तारण: ${selectedDeposits.length} खाते (${accountList}), एकूण तारण मूल्य: ₹${totalCollateralValue.toLocaleString('en-IN')}, कमाल पात्र कर्ज मर्यादा (${maxLtv}%): ₹${totalMaxLoanLimit.toLocaleString('en-IN')}`;

    onApply(selectedDeposits, totalCollateralValue, summary);
    onClose();
  };

  const getCategoryTitle = () => {
    switch (collateralCategory) {
      case 'FixedDeposit': return 'मुदत ठेव (FD) तारण निवड';
      case 'PigmyDeposit': return 'दैनिक पिग्मी ठेव तारण निवड';
      case 'RecurringDeposit': return 'आवर्ती ठेव (RD) तारण निवड';
      case 'SavingDeposit': return 'बचत ठेव तारण निवड';
      default: return 'ग्राहक ठेव तारण निवड';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
      <div className="bg-white rounded-lg shadow-2xl border border-primary/20 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="text-sm font-bold tracking-wide">{getCategoryTitle()}</h2>
              {customerName && (
                <p className="text-xs text-primary-100 font-medium opacity-90">
                  कर्जदार: <span className="text-white font-semibold">{customerName}</span>
                </p>
              )}
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <Landmark className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              योजनेनुसार कमाल कर्ज-तारण प्रमाण (Max LTV): <strong className="text-amber-950 font-bold">{maxLtv}%</strong> (ठेव शिलकीच्या {maxLtv}% पर्यंत कर्ज मंजूर करता येईल)
            </span>
          </div>
          <button 
            type="button" 
            onClick={fetchDeposits} 
            disabled={loading}
            className="flex items-center space-x-1 text-primary hover:underline font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-sm text-red-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs font-semibold text-gray-600">ग्राहकाची ठेव खाती पडताळत आहे...</p>
            </div>
          ) : deposits.length === 0 ? (
            <div className="py-8 text-center max-w-lg mx-auto">
              <Layers className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-800">कोणतीही पात्र ठेव सापडली नाही</p>
              <p className="text-xs text-gray-500 mt-1">
                या कर्जदाराच्या नावावर सदर योजनेशी सुसंगत कोणतीही सक्रिय (Active) ठेव उपलब्ध नाही.
              </p>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-left text-xs text-blue-900 space-y-1 shadow-2xs">
                <p className="font-semibold text-blue-950 flex items-center gap-1.5">
                  💡 आरंभिक शिल्लक (Opening Balance) नोंदणीसाठी सूचना:
                </p>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  जर ठेवीची जुनी एन्ट्री किंवा मायग्रेशन अजून व्हायचे बाकी असेल, तरी आपण <strong>'तारण नंतर जोडा'</strong> पर्याय वापरून कर्ज नोंदणी पूर्ण करू शकता. ठेवीचे मायग्रेशन पूर्ण झाल्यावर हे कर्ज खाते 'Edit' करून ठेव तारण लिंक करता येईल.
                </p>
              </div>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-primary text-white rounded text-xs font-bold hover:bg-primary/90 shadow-xs transition-all cursor-pointer"
                >
                  तारण नंतर जोडा / पुढे चला (Skip & Proceed)
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-gray-800 font-bold border-b border-gray-200">
                  <tr>
                    <th className="p-2.5 text-center w-10">निवड</th>
                    <th className="p-2.5">खाते / पावती क्र.</th>
                    <th className="p-2.5">योजना</th>
                    <th className="p-2.5 text-right">ठेव रक्कम / शिल्लक (₹)</th>
                    <th className="p-2.5 text-center">व्याजदर</th>
                    <th className="p-2.5 text-center">मुदत दिनांक</th>
                    <th className="p-2.5 text-right font-bold text-blue-900 bg-blue-50/50">पात्र कर्ज ({maxLtv}%)</th>
                    <th className="p-2.5 text-center">बोजा स्थिती (Lien)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deposits.map((dep) => {
                    const isSelected = Boolean(selectedMap[dep.depositAccountID]);
                    const isLocked = dep.isLienMarked;

                    return (
                      <tr 
                        key={dep.depositAccountID} 
                        onClick={() => toggleSelect(dep)}
                        className={`transition-colors cursor-pointer ${
                          isLocked 
                            ? 'bg-rose-50/60 opacity-80 cursor-not-allowed' 
                            : isSelected 
                              ? 'bg-emerald-50 hover:bg-emerald-100/70 font-medium' 
                              : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            disabled={isLocked}
                            onChange={() => toggleSelect(dep)}
                            className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer disabled:cursor-not-allowed" 
                          />
                        </td>
                        <td className="p-2.5 font-mono font-bold text-gray-900">
                          {dep.accountNo}
                        </td>
                        <td className="p-2.5 text-gray-700">
                          {dep.schemeName}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-gray-900">
                          ₹ {(dep.currentBalance || dep.depositAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-center font-mono font-semibold text-emerald-700">
                          {dep.interestRate}%
                        </td>
                        <td className="p-2.5 text-center text-gray-600 font-mono">
                          {dep.maturityDate ? new Date(dep.maturityDate).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-blue-800 bg-blue-50/40">
                          ₹ {dep.maxEligibleLoan.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-center">
                          {isLocked ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <Lock className="w-3 h-3" />
                              <span>बोजा: {dep.lienLoanAccountNo || 'इतर कर्ज'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle className="w-3 h-3" />
                              <span>उपलब्ध / मुक्त</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Summary & Action */}
        <div className="bg-slate-100 border-t border-gray-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-4 text-xs">
            <div>
              <span className="text-gray-500">निवडलेल्या ठेवी:</span>{' '}
              <strong className="text-gray-900 font-bold">{selectedDeposits.length}</strong>
            </div>
            <div>
              <span className="text-gray-500">एकूण तारण मूल्य:</span>{' '}
              <strong className="text-emerald-700 font-bold font-mono">
                ₹ {totalCollateralValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div>
              <span className="text-gray-500">कमाल मंजूर कर्ज मर्यादा:</span>{' '}
              <strong className="text-blue-700 font-bold font-mono">
                ₹ {totalMaxLoanLimit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-900 rounded-sm text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
              title="तारण ठेव नंतर लिंक करण्यासाठी पुढे जा"
            >
              तारण नंतर जोडा (Skip)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-gray-300 rounded-sm text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              रद्द करा
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedDeposits.length === 0}
              className="px-4 py-1.5 bg-primary text-white rounded-sm text-xs font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              <span>तारण जोडा (Apply Collateral)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DepositCollateralSelectorModal;
