import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

interface CashLedgerReflectBadgeProps {
  branchId?: number;
  transactionType?: 'Receipt' | 'Payment' | 'Deposit' | 'Withdrawal' | 'Disbursement' | 'Collection' | 'General';
  className?: string;
  customTitle?: string;
}

const CashLedgerReflectBadge: React.FC<CashLedgerReflectBadgeProps> = ({
  branchId,
  transactionType = 'General',
  className = '',
  customTitle
}) => {
  const { user } = useAuth();
  const [cashLedger, setCashLedger] = useState<{ id: number; name: string; branchName: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const activeBranchId = branchId || (hasGlobalBranch ? parseInt(globalBranchStr as string) : (user?.branchID || 1));

  useEffect(() => {
    let isMounted = true;

    const resolveCashLedger = async () => {
      try {
        setLoading(true);
        const [branchesRes, ledgersRes] = await Promise.all([
          axios.get('/api/Branches').catch(() => ({ data: [] })),
          axios.get('/api/Ledgers').catch(() => ({ data: [] }))
        ]);

        const branchesList: any[] = Array.isArray(branchesRes.data) ? branchesRes.data : [];
        const ledgersList: any[] = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];

        const currentBranch = branchesList.find((b: any) => b.branchID === activeBranchId) || branchesList[0];
        const branchName = currentBranch?.branchName || 'मुख्य शाखा';

        // 1. Direct branch mapped DefaultCashLedgerID
        let resolvedLedger = null;
        if (currentBranch?.defaultCashLedgerID) {
          resolvedLedger = ledgersList.find((l: any) => l.ledgerID === currentBranch.defaultCashLedgerID);
        }

        // 2. Head Office / मुख्य शाखा
        if (!resolvedLedger) {
          const isHo = currentBranch?.branchType === 'HeadOffice' || activeBranchId === 1 || branchName.includes('मुख्य');
          if (isHo) {
            resolvedLedger = ledgersList.find((l: any) =>
              (l.ledgerName.includes('हातातील रोख शिल्लक') ||
                l.ledgerName.includes('हातावरील रोख शिल्लक (मुख्य') ||
                l.ledgerName === 'हातावरील रोख शिल्लक' ||
                l.ledgerName === 'रोख खाते' ||
                (l.ledgerName || '').toLowerCase() === 'cash' ||
                (l.ledgerName || '').toLowerCase() === 'cash in hand') &&
              !l.ledgerName.includes('शाखा')
            );
          }
        }

        // 3. Match Branch Name
        if (!resolvedLedger && branchName) {
          const cleanName = branchName.replace(/शाखा/g, '').trim();
          if (cleanName) {
            resolvedLedger = ledgersList.find((l: any) =>
              (l.ledgerName.includes('रोख') || (l.ledgerName || '').toLowerCase().includes('cash')) &&
              l.ledgerName.includes(cleanName)
            );
          }
        }

        // 4. General fallback
        if (!resolvedLedger) {
          resolvedLedger = ledgersList.find((l: any) =>
            l.ledgerName.includes('हातातील रोख शिल्लक') ||
            l.ledgerName.includes('हातावरील रोख शिल्लक') ||
            l.ledgerName.includes('रोख') ||
            (l.ledgerName || '').toLowerCase().includes('cash')
          );
        }

        if (isMounted) {
          if (resolvedLedger) {
            setCashLedger({
              id: resolvedLedger.ledgerID,
              name: resolvedLedger.ledgerName,
              branchName
            });
          } else {
            setCashLedger({
              id: 1,
              name: 'हातातील रोख शिल्लक (Cash in Hand)',
              branchName
            });
          }
        }
      } catch (err) {
        console.error('Error resolving cash ledger badge:', err);
        if (isMounted) {
          setCashLedger({
            id: 1,
            name: 'हातातील रोख शिल्लक',
            branchName: 'मुख्य शाखा'
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    resolveCashLedger();

    return () => {
      isMounted = false;
    };
  }, [activeBranchId]);

  if (loading) {
    return (
      <div className={`p-2 bg-emerald-50/60 border border-emerald-200 rounded text-xs text-emerald-800 animate-pulse ${className}`}>
        रोख खाते तपासत आहे...
      </div>
    );
  }

  const getTxnTypeText = () => {
    switch (transactionType) {
      case 'Deposit':
      case 'Collection':
      case 'Receipt':
        return 'रोख जमा (Receipt Dr)';
      case 'Withdrawal':
      case 'Disbursement':
      case 'Payment':
        return 'रोख नावे (Payment Cr)';
      default:
        return 'रोख व्यवहार (Cash Entry)';
    }
  };

  return (
    <div
      className={`p-2 bg-gradient-to-r from-emerald-50/90 via-slate-50 to-teal-50 border border-emerald-300 rounded-sm flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base shrink-0">💵</span>
        <div>
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide block">
            {customTitle || 'संबंधित रोख खाते (Reflecting Cash Ledger)'}
          </span>
          <span className="text-xs font-black text-emerald-950">
            {cashLedger?.id} - {cashLedger?.name}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded border border-emerald-300">
          📍 {cashLedger?.branchName}
        </span>
        {transactionType !== 'General' && (
          <span className="text-[10px] bg-white text-emerald-800 font-extrabold px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
            {getTxnTypeText()}
          </span>
        )}
      </div>
    </div>
  );
};

export default CashLedgerReflectBadge;
