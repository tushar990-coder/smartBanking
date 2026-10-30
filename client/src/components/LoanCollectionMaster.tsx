import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { PlusCircle, Search, Save, Edit, Trash2, X, FileText, CheckSquare, Printer, Calendar, CheckCircle, AlertCircle, Clock, Layers, CreditCard, ArrowRight, Building2, Award, Lock, Unlock, Coins, Landmark, UserCheck, Users, RotateCcw, RefreshCw, Share2, ShieldCheck, Zap, ArrowLeft } from 'lucide-react';
import CustomerSearchSelect from './common/CustomerSearchSelect';
import BankLedgerSelect from './common/BankLedgerSelect';
import { filterBankAccountLedgers } from '../utils/bankLedgerUtils';
import LoanCollectionReceiptPrint from './LoanCollectionReceiptPrint';
import { useAuth } from '../context/AuthContext';

export interface LoanCollectionMasterProps {
    onNavigate?: (tab: string, params?: any) => void;
}

export const format14DigitDisplay = (num?: string) => {
    if (!num) return '-';
    const clean = num.replace(/\D/g, '');
    if (clean.length === 14) {
        return `${clean.substring(0, 3)}-${clean.substring(3, 3)}-${clean.substring(6, 7)}-${clean.substring(13, 1)}`;
    }
    return num;
};

interface LoanAccount {
    loanAccountID: number;
    loanAccountNo: string;
    branchID?: number;
    branch?: {
        branchID: number;
        branchName: string;
        branchCode: string;
    };
    memberID: number;
    customerID?: number;
    sanctionedAmount: number;
    principalBalance: number;
    interestBalance: number;
    overdueInterestBalance: number;
    installmentAmount: number;
    member?: {
        firstName: string;
        lastName: string;
        memberCode?: string;
    };
    customer?: {
        customerID?: number;
        firstName?: string;
        middleName?: string;
        lastName?: string;
        cifNo?: string;
        mobileNo?: string;
    };
    loanRateID?: number;
    legacyAccountNumber?: string;
    loanRate?: {
        loanRateID?: number;
        loanType: string;
        loanCode?: string;
        shortName?: string;
        interestRate?: number;
        interestCalculationMethod?: string;
        loanInstallmentType?: string;
        interestPostingFrequency?: string;
        securityType?: string;
    };
    interestRate?: number;
    loanDisbursementDate?: string;
    lastInstallmentPaidDate?: string;
    lastInterestPostingDate?: string;
    openingDate: string;
    maturityDate: string;
    isOpeningBalance?: boolean;
    status?: string;
}

interface LoanInstallmentScheduleDto {
    installmentNo: number;
    dueDate: string;
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
    status: string;
    paidDate?: string;
    openingBalance?: number;
    closingBalance?: number;
    days?: number;
    interestRate?: number;
    paidPrincipal?: number;
    paidInterest?: number;
    remainingPrincipal?: number;
    overdueDays?: number;
    receiptNo?: string;
}

interface LoanTrancheDetail {
    disbursementID: number;
    disbursementDate: string;
    disbursementAmount: number;
    paymentMode: string;
    netAmountPaid: number;
}

interface AccountDetailsAndSchedule {
    sanctionedAmount: number;
    disbursementDate: string;
    march31Balance: number;
    isOpeningBalance: boolean;
    currentPrincipalBalance: number;
    currentInterestBalance: number;
    currentOverdueInterestBalance: number;
    totalDisbursedAmount?: number;
    disbursementCount?: number;
    pendingSanctionedAmount?: number;
    lastInstallmentPaidDate?: string;
    lastInterestPostingDate?: string;
    tranches?: LoanTrancheDetail[];
    schedule: LoanInstallmentScheduleDto[];
}

interface Ledger {
    ledgerID: number;
    ledgerName: string;
    accountGroup?: {
        groupID: number;
        groupName: string;
    };
}

interface LoanCollectionFee {
    loanCollectionFeeID?: number;
    loanCollectionID?: number;
    ledgerID: number;
    amount: number;
    ledger?: Ledger;
}

interface LoanCollection {
    loanCollectionID: number;
    loanAccountID: number;
    branchID?: number;
    collectingCashierID?: number;
    createdByUserID?: number;
    isCrossBranch?: boolean;
    homeBranchID?: number;
    branch?: any;
    collectionDate: string;
    receiptNo: string;
    totalAmountReceived: number;
    surchargeCollected: number;
    penaltyInterestCollected: number;
    receivableInterestCollected?: number;
    interestCollected: number;
    principalCollected: number;
    interestWaived?: number;
    penaltyWaived?: number;
    isOTS?: boolean;
    resolutionNo?: string;
    approvedByUserID?: number;
    paymentMode: string;
    bankName?: string;
    chequeNo?: string;
    bankAccountLedgerID?: number;
    sourceSavingAccountID?: number;
    transferFromSavingAccountNo?: string;
    savingCustomerName?: string;
    sourcePigmyAccountID?: number;
    transferFromPigmyAccountNo?: string;
    pigmyTransferType?: 'PARTIAL' | 'CLOSURE';
    pigmyBalanceBefore?: number;
    pigmyBalanceAfter?: number;
    pigmyConsentRemark?: string;
    remarks?: string;
    loanAccount?: LoanAccount;
    voucherID?: number;
    homeBranchVoucherID?: number;
    voucher?: { voucherID: number; voucherNo?: string; status?: string };
    homeBranchVoucher?: { voucherID: number; voucherNo?: string; status?: string };
    fees?: LoanCollectionFee[];
}

const parseDateSafe = (dateVal: string | Date | undefined | null): Date => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? new Date() : dateVal;
    const str = String(dateVal).trim();
    if (!str) return new Date();
    // Normalize dots to colons in ISO time (e.g. T00.00.00 -> T00:00:00)
    const cleanStr = str.replace(/T(\d{2})\.(\d{2})\.(\d{2})/, 'T$1:$2:$3');
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) return d;
    // Format YYYY-MM-DD
    const matchYmd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (matchYmd) {
        return new Date(parseInt(matchYmd[1], 10), parseInt(matchYmd[2], 10) - 1, parseInt(matchYmd[3], 10));
    }
    // Format DD-MM-YYYY or DD/MM/YYYY
    const matchDmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (matchDmy) {
        return new Date(parseInt(matchDmy[3], 10), parseInt(matchDmy[2], 10) - 1, parseInt(matchDmy[1], 10));
    }
    return new Date();
};

const formatDateSafe = (dateVal: string | Date | undefined | null): string => {
    if (!dateVal) return '-';
    if (dateVal instanceof Date) {
        return isNaN(dateVal.getTime()) ? '-' : dateVal.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    const str = String(dateVal).trim();
    if (!str) return '-';
    // Check if ISO with dots or colons
    const cleanStr = str.replace(/T(\d{2})\.(\d{2})\.(\d{2})/, 'T$1:$2:$3');
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    // Check YYYY-MM-DD
    const matchYmd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (matchYmd) {
        return `${matchYmd[3].padStart(2, '0')}/${matchYmd[2].padStart(2, '0')}/${matchYmd[1]}`;
    }
    // Check DD-MM-YYYY
    const matchDmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (matchDmy) {
        return `${matchDmy[1].padStart(2, '0')}/${matchDmy[2].padStart(2, '0')}/${matchDmy[3]}`;
    }
    return str;
};

interface LienReleasePrompt {
    loanAccountId: number;
    loanAccountNo: string;
    activeCollaterals: Array<{
        collateralID: number;
        depositAccountNo: string;
        collateralType: string;
        depositAccountID: number;
        lienAmount: number;
        lienStatus: string;
    }>;
    collectionId?: number;
}

const LoanCollectionMaster: React.FC<LoanCollectionMasterProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];
    const isHOUser = user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'HeadOffice' || user?.role === 'HO_Manager';

    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number>(user?.branchID || 1);

    const [collections, setCollections] = useState<LoanCollection[]>([]);
    const [accounts, setAccounts] = useState<LoanAccount[]>([]);
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [allowDateOverride, setAllowDateOverride] = useState(false);

    // Passing Mode State (व्हाउचर तपासणी व मंजुरी मोड)
    const [isPassingMode, setIsPassingMode] = useState(false);
    const [passingVoucherId, setPassingVoucherId] = useState<number | null>(null);
    const [passingCollection, setPassingCollection] = useState<LoanCollection | null>(null);
    const [passingVoucher, setPassingVoucher] = useState<any | null>(null);
    const [passingActionLoading, setPassingActionLoading] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    
    // Printing state
    const [lastSavedCollectionId, setLastSavedCollectionId] = useState<number | null>(null);
    const [printingCollectionId, setPrintingCollectionId] = useState<number | null>(null);

    // Lien release on loan closure prompt state
    const [lienPromptData, setLienPromptData] = useState<LienReleasePrompt | null>(null);
    const [releasingLien, setReleasingLien] = useState(false);

    // View All Receipts Modal State
    const [showReceiptsModal, setShowReceiptsModal] = useState(false);
    const [editingReceiptId, setEditingReceiptId] = useState<number | null>(null);
    const [editData, setEditData] = useState<any>({});

    // Installment Schedule Modal State
    const [showInstallmentModal, setShowInstallmentModal] = useState(false);
    const [modalFilter, setModalFilter] = useState<'ALL' | 'OVERDUE' | 'PENDING' | 'PAID' | 'PARTIAL'>('ALL');
    const [isSchedulePrintView, setIsSchedulePrintView] = useState(false);
    const [showFeesPanel, setShowFeesPanel] = useState(false);

    const [formData, setFormData] = useState<Partial<LoanCollection>>({
        collectionDate: activeBusinessDate,
        receiptNo: '',
        paymentMode: "Cash",
        totalAmountReceived: 0,
        surchargeCollected: 0,
        penaltyInterestCollected: 0,
        receivableInterestCollected: 0,
        interestCollected: 0,
        principalCollected: 0,
        fees: []
    });

    useEffect(() => {
        if (user?.businessDate) {
            setFormData(prev => ({ ...prev, collectionDate: user.businessDate.split('T')[0] }));
        }
    }, [user?.businessDate]);

    const [customerMatchingLoans, setCustomerMatchingLoans] = useState<LoanAccount[]>([]);
    const [showMultiLoanModal, setShowMultiLoanModal] = useState(false);
    const [multiLoanCustomerInfo, setMultiLoanCustomerInfo] = useState<{
        name: string;
        cifNo: string;
        customerId?: number;
    } | null>(null);
    const [noLoanFoundAlert, setNoLoanFoundAlert] = useState<string | null>(null);

    const [selectedAccount, setSelectedAccount] = useState<LoanAccount | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [selectedBorrowerKey, setSelectedBorrowerKey] = useState<string | null>(null);
    const [selectedSchemeId, setSelectedSchemeId] = useState<number | null>(null);
    const [loanSchemes, setLoanSchemes] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [accountDetails, setAccountDetails] = useState<AccountDetailsAndSchedule | null>(null);
    const [npaStatus, setNpaStatus] = useState<{ category: string, overdueDays: number, categoryMarathi: string } | null>(null);
    const [todayTotalCash, setTodayTotalCash] = useState(0);
    const [todayTotalBank, setTodayTotalBank] = useState(0);
    const [sanstha, setSanstha] = useState<any>(null);

    // Pigmy Transfer State
    const [customerPigmyAccounts, setCustomerPigmyAccounts] = useState<any[]>([]);
    const [loadingPigmyAccounts, setLoadingPigmyAccounts] = useState(false);
    const [selectedPigmyAccount, setSelectedPigmyAccount] = useState<any | null>(null);
    const [pigmyAccountSourceType, setPigmyAccountSourceType] = useState<'SELF' | 'OTHER'>('SELF');
    const [pigmyOldAccSearchQuery, setPigmyOldAccSearchQuery] = useState('');
    const [otherPigmySearchResults, setOtherPigmySearchResults] = useState<any[]>([]);
    const [loadingOtherPigmySearch, setLoadingOtherPigmySearch] = useState(false);

    const fetchCustomerPigmyAccounts = async (cId: number) => {
        if (!cId) {
            setCustomerPigmyAccounts([]);
            setSelectedPigmyAccount(null);
            return;
        }
        setLoadingPigmyAccounts(true);
        try {
            const res = await axios.get(`/api/PigmyAccounts/Customer/${cId}`);
            const list = res.data || [];
            // Filter accounts with balance or active
            const valid = list.filter((p: any) => p.status === 'Active' || (p.totalDepositedAmount || 0) > 0);
            setCustomerPigmyAccounts(valid);
            if (valid.length > 0) {
                const acc = valid[0];
                setSelectedPigmyAccount(acc);
                setPigmyAccountSourceType('SELF');
                setFormData(p => ({
                    ...p,
                    sourcePigmyAccountID: acc.pigmyAccountID,
                    transferFromPigmyAccountNo: acc.accountNo
                }));
            } else {
                setSelectedPigmyAccount(null);
                setPigmyAccountSourceType('OTHER');
            }
        } catch (err) {
            console.error('Failed to load pigmy accounts for customer:', err);
            setCustomerPigmyAccounts([]);
            setSelectedPigmyAccount(null);
        } finally {
            setLoadingPigmyAccounts(false);
        }
    };

    const searchOtherPigmyAccounts = async (query: string) => {
        if (!query || query.trim().length < 1) {
            setOtherPigmySearchResults([]);
            return;
        }
        setLoadingOtherPigmySearch(true);
        try {
            const res = await axios.get(`/api/PigmyAccounts?search=${encodeURIComponent(query.trim())}`);
            const list = (res.data || []).filter((p: any) => p.status === 'Active' || (p.totalDepositedAmount || 0) > 0);
            setOtherPigmySearchResults(list);
        } catch (err) {
            console.error('Failed to search other pigmy accounts:', err);
            setOtherPigmySearchResults([]);
        } finally {
            setLoadingOtherPigmySearch(false);
        }
    };

    // Saving Transfer State
    const [customerSavingAccounts, setCustomerSavingAccounts] = useState<any[]>([]);
    const [loadingSavingAccounts, setLoadingSavingAccounts] = useState(false);
    const [selectedSavingAccount, setSelectedSavingAccount] = useState<any | null>(null);
    const [savingAccountSourceType, setSavingAccountSourceType] = useState<'SELF' | 'OTHER'>('SELF');
    const [otherSavingSearchQuery, setOtherSavingSearchQuery] = useState('');
    const [otherSavingSearchResults, setOtherSavingSearchResults] = useState<any[]>([]);
    const [loadingOtherSavingSearch, setLoadingOtherSavingSearch] = useState(false);

    const fetchCustomerSavingAccounts = async (cId: number) => {
        if (!cId) {
            setCustomerSavingAccounts([]);
            setSelectedSavingAccount(null);
            return;
        }
        setLoadingSavingAccounts(true);
        try {
            const res = await axios.get(`/api/SavingAccounts?customerId=${cId}`);
            const list = res.data || [];
            const valid = list.filter((s: any) => s.status === 'Active');
            setCustomerSavingAccounts(valid);
            if (valid.length > 0) {
                const acc = valid[0];
                setSelectedSavingAccount(acc);
                setSavingAccountSourceType('SELF');
                setFormData(p => ({
                    ...p,
                    sourceSavingAccountID: acc.savingAccountID,
                    transferFromSavingAccountNo: acc.accountNo,
                    savingCustomerName: acc.customerName || ''
                }));
            } else {
                setSelectedSavingAccount(null);
                setSavingAccountSourceType('OTHER');
            }
        } catch (err) {
            console.error('Failed to load saving accounts for customer:', err);
            setCustomerSavingAccounts([]);
            setSelectedSavingAccount(null);
        } finally {
            setLoadingSavingAccounts(false);
        }
    };

    const searchOtherSavingAccounts = async (query: string) => {
        if (!query || query.trim().length < 2) {
            setOtherSavingSearchResults([]);
            return;
        }
        setLoadingOtherSavingSearch(true);
        try {
            const res = await axios.get(`/api/SavingAccounts?search=${encodeURIComponent(query.trim())}`);
            const list = (res.data || []).filter((s: any) => s.status === 'Active');
            setOtherSavingSearchResults(list);
        } catch (err) {
            console.error('Failed to search other saving accounts:', err);
            setOtherSavingSearchResults([]);
        } finally {
            setLoadingOtherSavingSearch(false);
        }
    };

    const fetchSanstha = async () => {
        try {
            const res = await axios.get('/api/SansthaDetails');
            if (res.data && res.data.length > 0) {
                setSanstha(res.data[0]);
            }
        } catch (err) {
            console.error("Failed to fetch sanstha details", err);
        }
    };

    const fetchLoanSchemes = async () => {
        try {
            const res = await axios.get('/api/LoanRates');
            setLoanSchemes(res.data || []);
        } catch (err) {
            console.error("Failed to load loan schemes", err);
        }
    };

    // 1. Available Loan Schemes (कर्ज प्रकार / योजना) - Instant Load from LoanRates with fallback
    const availableLoanSchemes = useMemo(() => {
        if (loanSchemes && loanSchemes.length > 0) {
            return loanSchemes.map((r: any) => ({
                id: r.loanRateID,
                name: r.shortName || r.loanType || `योजना #${r.loanRateID}`
            })).sort((a, b) => a.name.localeCompare(b.name));
        }

        const schemeMap = new Map<number, { id: number; name: string }>();
        accounts.forEach((a: any) => {
            const rId = a.loanRateID || a.loanRate?.loanRateID;
            if (rId) {
                const name = a.loanRate?.shortName || a.loanRate?.loanType || `योजना #${rId}`;
                if (!schemeMap.has(rId)) {
                    schemeMap.set(rId, { id: rId, name });
                }
            }
        });
        return Array.from(schemeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [loanSchemes, accounts]);

    // 2. Filter accounts by selected loan scheme (empty if no scheme selected to prevent software lag)
    const filteredAccountsForBorrowers = useMemo(() => {
        if (!selectedSchemeId) return [];
        return accounts.filter((a: any) => {
            const rId = a.loanRateID || a.loanRate?.loanRateID;
            return Number(rId) === Number(selectedSchemeId);
        });
    }, [accounts, selectedSchemeId]);

    // 3. Extract unique borrowers (Customers) from active loan accounts filtered by selected loan scheme
    const borrowerCustomers = useMemo(() => {
        if (!selectedSchemeId) return [];
        const map = new Map<number, any>();
        filteredAccountsForBorrowers.forEach((a: any) => {
            const custId = Number(a.customerID || a.customer?.customerID || a.memberID || 0);
            if (custId <= 0) return;

            const legacyAccNo = (a.legacyAccountNumber || '').trim();
            const currentAccNo = (a.loanAccountNo || '').trim();

            if (!map.has(custId)) {
                let fName = '';
                let mName = '';
                let lName = '';
                let fullName = '';
                let cif = '';
                let legacyCust = '';
                let mobile = '';

                if (a.customer) {
                    fName = a.customer.firstName || '';
                    mName = a.customer.middleName || '';
                    lName = a.customer.lastName || '';
                    fullName = [fName, mName, lName].filter(Boolean).join(' ').trim();
                    cif = a.customer.cifNo || '';
                    legacyCust = a.customer.legacyCustomerNo || '';
                    mobile = a.customer.mobileNo || '';
                } else if (a.member) {
                    fName = a.member.firstName || '';
                    mName = a.member.middleName || '';
                    lName = a.member.lastName || '';
                    fullName = [fName, mName, lName].filter(Boolean).join(' ').trim();
                    cif = a.member.memberCode || '';
                } else {
                    fName = 'खातेदार';
                    lName = `#${custId}`;
                    fullName = `खातेदार #${custId}`;
                    cif = a.loanAccountNo || '';
                    legacyCust = a.legacyAccountNumber || '';
                }

                map.set(custId, {
                    customerID: custId,
                    cifNo: cif,
                    legacyCustomerNo: legacyCust,
                    legacyLoanAccountNos: legacyAccNo ? [legacyAccNo] : [],
                    loanAccountNos: currentAccNo ? [currentAccNo] : [],
                    firstName: fName,
                    middleName: mName,
                    lastName: lName,
                    fullName: fullName || `खातेदार #${custId}`,
                    mobileNo: mobile
                });
            } else {
                const existing = map.get(custId);
                if (legacyAccNo && !existing.legacyLoanAccountNos.includes(legacyAccNo)) {
                    existing.legacyLoanAccountNos.push(legacyAccNo);
                }
                if (currentAccNo && !existing.loanAccountNos.includes(currentAccNo)) {
                    existing.loanAccountNos.push(currentAccNo);
                }
            }
        });

        const result = Array.from(map.values()).map(item => ({
            ...item,
            legacyLoanAccountNo: item.legacyLoanAccountNos.join(', '),
            loanAccountNo: item.loanAccountNos.join(', ')
        }));

        return result.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    }, [filteredAccountsForBorrowers, selectedSchemeId]);

    // Backward-compat alias
    const borrowerOptions = borrowerCustomers;

    // 4. Loans of selected borrower, filtered by selected loan scheme
    const borrowerLoans = useMemo(() => {
        if (!selectedBorrowerKey && !selectedCustomerId) return [];
        return accounts.filter((a: any) => {
            const custId = Number(a.customerID || a.customer?.customerID || a.memberID || 0);
            const belongsToBorrower = (selectedCustomerId && custId === Number(selectedCustomerId)) ||
                   (selectedBorrowerKey && (
                       selectedBorrowerKey === `C_${custId}` || 
                       selectedBorrowerKey === `M_${a.memberID}` || 
                       selectedBorrowerKey === `ACC_${a.loanAccountID}`
                   ));
            if (!belongsToBorrower) return false;
            if (selectedSchemeId) {
                const rId = a.loanRateID || a.loanRate?.loanRateID;
                return Number(rId) === Number(selectedSchemeId);
            }
            return true;
        });
    }, [accounts, selectedBorrowerKey, selectedCustomerId, selectedSchemeId]);
    const memberLoans = borrowerLoans;

    const bankLedgers = useMemo(() => filterBankAccountLedgers(ledgers), [ledgers]);

    const fetchBranches = async () => {
        try {
            const res = await axios.get('/api/Branches');
            setBranches(res.data || []);
        } catch (err) {
            console.error("Failed to load branches", err);
        }
    };

    const fetchNextReceiptNo = async (targetBranchId?: number, targetAccountId?: number) => {
        try {
            const bId = targetBranchId || selectedBranchId || user?.branchID || 1;
            const url = targetAccountId 
                ? `/api/LoanCollections/next-receipt-no?branchId=${bId}&loanAccountId=${targetAccountId}`
                : `/api/LoanCollections/next-receipt-no?branchId=${bId}`;
            const res = await axios.get(url);
            if (res.data && res.data.receiptNo) {
                setFormData(prev => ({ ...prev, receiptNo: res.data.receiptNo }));
            }
        } catch (err) {
            console.error("Failed to fetch next receipt number", err);
        }
    };

    const loadCollectionForPassing = async (vId: number) => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/LoanCollections/by-voucher/${vId}`);
            const col: LoanCollection = res.data;
            if (!col) {
                alert('या व्हाउचरशी जोडलेली कोणतीही कर्ज वसुली पावती सापडली नाही.');
                return;
            }
            setPassingCollection(col);
            setPassingVoucher((col as any).voucher || null);
            setFormData({
                ...col,
                collectionDate: col.collectionDate ? col.collectionDate.split('T')[0] : activeBusinessDate,
                fees: col.fees || []
            });
            setLastSavedCollectionId(col.loanCollectionID);

            if (col.loanAccount) {
                const acc = col.loanAccount;
                const accSchemeId = acc.loanRateID || acc.loanRate?.loanRateID;
                if (accSchemeId) setSelectedSchemeId(accSchemeId);
                setSelectedAccount(acc);
                const custId = acc.customerID || acc.customer?.customerID;
                const bKey = custId ? `C_${custId}` : (acc.memberID ? `M_${acc.memberID}` : `ACC_${acc.loanAccountID}`);
                setSelectedBorrowerKey(bKey);
                setSelectedCustomerId(custId || null);
                (window as any).selectedLoanCustomerId = custId;
                (window as any).selectedLoanAccountId = acc.loanAccountID;
                (window as any).selectedLoanMemberId = acc.memberID;

                try {
                    const schedRes = await axios.get(`/api/LoanAccounts/${col.loanAccountID}/AccountDetailsAndSchedule`);
                    if (schedRes.data) {
                        setAccountDetails(schedRes.data);
                    }
                } catch (e) {
                    console.error('Error fetching loan schedule in passing mode:', e);
                }

                try {
                    const npaRes = await axios.get(`/api/Npa/status/${col.loanAccountID}`);
                    if (npaRes.data) {
                        setNpaStatus(npaRes.data);
                    }
                } catch (e) {}
            }
        } catch (err: any) {
            console.error('Failed to load collection for passing:', err);
            alert('कर्ज वसुली पावती लोड करताना त्रुटी आली.');
        } finally {
            setLoading(false);
        }
    };

    const handlePassVoucher = async () => {
        const vId = passingVoucher?.voucherID || passingVoucherId;
        const vNo = passingVoucher?.voucherNo || formData.receiptNo;
        if (!vId) {
            alert('व्हाउचर आयडी सापडला नाही.');
            return;
        }

        setPassingActionLoading(true);
        try {
            const payload = {
                voucherIds: [vId],
                approvedBy: user?.userID || 1
            };

            const res = await fetch('/api/VoucherPosting/Post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                const scrollInfo = data.results && data.results[0] ? ` (Scroll No: ${data.results[0].scrollNo})` : '';
                alert(`कर्ज वसुली व्हाउचर क्र. ${vNo} यशस्वीरीत्या पास करण्यात आले!${scrollInfo}`);
                if (onNavigate) {
                    onNavigate('voucher-posting');
                } else {
                    window.location.href = '/?tab=voucher-posting';
                }
            } else {
                const errText = await res.text();
                alert(`त्रुटी: ${errText}`);
            }
        } catch (e) {
            alert('व्हाउचर पास करताना नेटवर्क त्रुटी आली.');
        } finally {
            setPassingActionLoading(false);
        }
    };

    const handleRejectVoucher = async () => {
        const vId = passingVoucher?.voucherID || passingVoucherId;
        const vNo = passingVoucher?.voucherNo || formData.receiptNo;
        if (!vId) return;
        if (!rejectionReason.trim()) {
            alert('कृपया नामंजूर करण्याचे कारण लिहा.');
            return;
        }

        setPassingActionLoading(true);
        try {
            const res = await fetch(`/api/VoucherPosting/${vId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: rejectionReason.trim(),
                    userId: user?.userID || 1,
                    username: user?.username || 'Admin',
                    userRole: user?.roleName || user?.role || 'Admin'
                })
            });

            const resData = await res.json().catch(() => null);
            if (res.ok) {
                alert(resData?.message || `कर्ज वसुली पावती/व्हाउचर क्र. ${vNo} नामंजूर / रद्द करण्यात आले.`);
                setRejectModalOpen(false);
                if (onNavigate) {
                    onNavigate('voucher-posting');
                } else {
                    window.location.href = '/?tab=voucher-posting';
                }
            } else {
                alert(resData?.message || resData || 'व्हाउचर नामंजूर करताना त्रुटी आली.');
            }
        } catch (e) {
            alert('व्हाउचर नामंजूर करताना त्रुटी आली.');
        } finally {
            setPassingActionLoading(false);
        }
    };

    useEffect(() => {
        fetchSanstha();
        fetchBranches();
        fetchLoanSchemes();
        fetchData();
        fetchAccounts();
        fetchLedgers();

        const params = new URLSearchParams(window.location.search);
        const mode = params.get('passingMode');
        const vId = params.get('voucherId');
        if (mode === 'true' && vId) {
            setIsPassingMode(true);
            setPassingVoucherId(Number(vId));
            loadCollectionForPassing(Number(vId));
        } else {
            fetchNextReceiptNo(selectedBranchId);
        }

        return () => {
            (window as any).selectedLoanCustomerId = undefined;
            (window as any).selectedLoanAccountId = undefined;
            (window as any).selectedLoanMemberId = undefined;
        };
    }, []);

    const fetchData = async (overrideBranchId?: number) => {
        setLoading(true);
        try {
            const bId = overrideBranchId !== undefined ? overrideBranchId : selectedBranchId;
            const res = await axios.get(`/api/LoanCollections${bId ? `?branchId=${bId}&pageSize=50` : '?pageSize=50'}`);
            setCollections(res.data);
            
            // Calculate today's totals
            const todayStr = new Date().toISOString().split('T')[0];
            let cash = 0;
            let bank = 0;
            res.data.forEach((c: any) => {
                if (c.collectionDate && c.collectionDate.split('T')[0] === todayStr) {
                    if (c.paymentMode === 'Cash') cash += c.totalAmountReceived;
                    else bank += c.totalAmountReceived;
                }
            });
            setTodayTotalCash(cash);
            setTodayTotalBank(bank);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingReceiptId) return;
        try {
            const original = collections.find(c => c.loanCollectionID === editingReceiptId);
            if (!original) return;

            const isBankOrChequeEdit = editData.paymentMode === 'Bank' || editData.paymentMode === 'Cheque';
            if (isBankOrChequeEdit && (!editData.bankAccountLedgerID || Number(editData.bankAccountLedgerID) <= 0)) {
                alert("बँक / चेक मोडसाठी कृपया वैध बँक जी.एल. खाते (Bank GL Account) निवडा.");
                return;
            }
            
            const payload = {
                ...original,
                collectionDate: editData.collectionDate,
                paymentMode: editData.paymentMode,
                bankAccountLedgerID: isBankOrChequeEdit ? Number(editData.bankAccountLedgerID) : null,
                bankName: isBankOrChequeEdit ? (editData.bankName || original.bankName || null) : null,
                chequeNo: editData.paymentMode === 'Cheque' ? (editData.chequeNo || original.chequeNo || null) : null,
                remarks: editData.remarks
            };
            
            await axios.put(`/api/LoanCollections/${editingReceiptId}`, payload);
            setEditingReceiptId(null);
            alert("पावती यशस्वीरित्या अपडेट झाली!");
            fetchData();
        } catch (err: any) {
            console.error("Failed to update receipt", err);
            const msg = typeof err.response?.data === 'string'
                ? err.response.data
                : (err.response?.data?.message || "पावती अपडेट करताना त्रुटी आली.");
            alert(msg);
        }
    };

    const handleDeleteReceipt = async (id: number) => {
        if (window.confirm("तुम्हाला ही पावती खरोखर डिलीट करायची आहे का? (Are you sure you want to delete this receipt?)")) {
            try {
                await axios.delete(`/api/LoanCollections/${id}`);
                alert("पावती यशस्वीरित्या डिलीट झाली!");
                fetchData();
                await fetchAccounts();
                if (selectedAccount) {
                    selectLoanAccountById(selectedAccount.loanAccountID);
                }
            } catch (err: any) {
                console.error("Failed to delete receipt", err);
                alert(err.response?.data?.message || "पावती डिलीट करताना त्रुटी आली.");
            }
        }
    };

    const fetchAccounts = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            let cifStr = params.get('cifNo') || params.get('cif');
            let customerIdStr = params.get('customerId') || params.get('customerID');
            let memberIdStr = params.get('memberId') || params.get('memberID');
            let loanAccNo = params.get('loanAccountNo');
            let loanAccountIdStr = params.get('loanAccountId') || params.get('accountId');
            let customerNameStr = params.get('customerName');
            let legacyLoanNo = params.get('legacyLoanAccountNo') || params.get('legacyAccNo') || params.get('oldLoanAccountNo') || params.get('oldAccNo');

            // Also check universal sessionStorage transfer bridge
            if (!cifStr && !customerIdStr && !memberIdStr && !loanAccNo && !loanAccountIdStr && !legacyLoanNo) {
                try {
                    const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
                    if (rawBridge) {
                        sessionStorage.removeItem('cbs_active_customer_transfer');
                        const bridgeData = JSON.parse(rawBridge);
                        if (bridgeData) {
                            cifStr = bridgeData.cifNo || bridgeData.cif;
                            customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
                            memberIdStr = bridgeData.memberId ? String(bridgeData.memberId) : null;
                            loanAccNo = bridgeData.loanAccountNo || loanAccNo;
                            legacyLoanNo = bridgeData.legacyLoanAccountNo || bridgeData.legacyAccountNumber || legacyLoanNo;
                            customerNameStr = bridgeData.customerName || customerNameStr;
                        }
                    }
                } catch (e) {
                    console.error('Failed to read sessionStorage transfer:', e);
                }
            }

            // Safe property extractors
            const getAccCustId = (a: any) => Number(a.customerID ?? a.customerId ?? a.CustomerID ?? a.customer?.customerID ?? 0);
            const getAccMemId = (a: any) => Number(a.memberID ?? a.memberId ?? a.MemberID ?? a.member?.memberID ?? 0);
            const getAccCif = (a: any) => String(a.customer?.cifNo ?? a.cifNo ?? a.CIFNo ?? '').trim().toUpperCase();

            const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
            const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
            const targetAccId = loanAccountIdStr ? parseInt(loanAccountIdStr, 10) : 0;
            let fastTrackDone = false;

            // ⚡ FAST-TRACK 1: Direct targeted account ID lookup (~15-20ms)
            if (targetAccId > 0) {
                try {
                    const singleRes = await axios.get(`/api/LoanAccounts/${targetAccId}`);
                    if (singleRes.data && singleRes.data.loanAccountID) {
                        const acc = singleRes.data;
                        setAccounts([acc]);
                        selectLoanAccountById(acc.loanAccountID, [acc]);
                        setCustomerMatchingLoans([acc]);
                        fastTrackDone = true;
                    }
                } catch (err) {
                    console.warn('Fast-track targeted Loan lookup failed, falling back', err);
                }
            }
            // ⚡ FAST-TRACK 2: Direct targeted customer / member ID lookup (~20-30ms)
            else if (cId > 0 || mId > 0) {
                try {
                    const qParam = cId > 0 ? `customerId=${cId}` : `memberId=${mId}`;
                    const custRes = await axios.get(`/api/LoanAccounts?${qParam}`);
                    const active = (custRes.data || []).filter((a: any) => a.status === 'Active');
                    if (active.length > 0) {
                        setAccounts(active);
                        if (active.length === 1) {
                            selectLoanAccountById(active[0].loanAccountID, active);
                            setCustomerMatchingLoans(active);
                            setNoLoanFoundAlert(null);
                        } else {
                            setCustomerMatchingLoans(active);
                            const custName = customerNameStr || (active[0].customer ? `${active[0].customer.firstName || ''} ${active[0].customer.lastName || ''}`.trim() : 'कर्जदार खातेदार');
                            const primaryCif = cifStr || getAccCif(active[0]) || '-';
                            setMultiLoanCustomerInfo({
                                name: custName,
                                cifNo: primaryCif,
                                customerId: cId || getAccCustId(active[0])
                            });
                            const firstCustId = getAccCustId(active[0]);
                            const bKey = firstCustId ? `C_${firstCustId}` : (active[0].memberID ? `M_${active[0].memberID}` : `ACC_${active[0].loanAccountID}`);
                            setSelectedBorrowerKey(bKey);
                            if (firstCustId) setSelectedCustomerId(firstCustId);
                            setShowMultiLoanModal(true);
                            setNoLoanFoundAlert(null);
                        }
                        fastTrackDone = true;
                    }
                } catch (err) {
                    console.warn('Fast-track customer Loan lookup failed, falling back', err);
                }
            }

            if (!fastTrackDone) {
                const res = await axios.get('/api/LoanAccounts');
                const activeAccs = res.data.filter((a: any) => a.status === 'Active');
                setAccounts(activeAccs);

            if (loanAccNo || legacyLoanNo) {
                const cleanLegacy = legacyLoanNo ? legacyLoanNo.trim().toLowerCase() : '';
                const matchedAcc = activeAccs.find((a: any) => 
                    (loanAccNo && a.loanAccountNo === loanAccNo) ||
                    (cleanLegacy && a.legacyAccountNumber && String(a.legacyAccountNumber).trim().toLowerCase() === cleanLegacy)
                );
                if (matchedAcc) {
                    selectLoanAccountById(matchedAcc.loanAccountID, activeAccs);
                    setCustomerMatchingLoans([matchedAcc]);
                }
            } else if (cifStr || customerIdStr || memberIdStr) {
                const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
                const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
                const cleanCif = cifStr ? cifStr.trim().toUpperCase() : '';
                const cleanDigits = cleanCif ? cleanCif.replace(/\D/g, '') : '';

                // Tiered CIF-First Matching
                let matched: LoanAccount[] = [];

                // Tier 1: CIF Match
                if (cleanCif) {
                    matched = activeAccs.filter((a: any) => {
                        const aCif = getAccCif(a);
                        if (!aCif) return false;
                        if (aCif === cleanCif) return true;
                        if (cleanDigits && aCif.replace(/\D/g, '') === cleanDigits) return true;
                        return false;
                    });
                }

                // Tier 2: CustomerID Match
                if (matched.length === 0 && cId > 0) {
                    matched = activeAccs.filter((a: any) => getAccCustId(a) === cId);
                }

                // Tier 3: MemberID Match
                if (matched.length === 0 && mId > 0) {
                    matched = activeAccs.filter((a: any) => getAccMemId(a) === mId || getAccCustId(a) === mId);
                }

                if (matched.length === 1) {
                    selectLoanAccountById(matched[0].loanAccountID, activeAccs);
                    setCustomerMatchingLoans(matched);
                    setNoLoanFoundAlert(null);
                } else if (matched.length > 1) {
                    setCustomerMatchingLoans(matched);
                    const custName = customerNameStr || (matched[0].customer ? `${matched[0].customer.firstName || ''} ${matched[0].customer.lastName || ''}`.trim() : (matched[0].member ? `${matched[0].member.firstName || ''} ${matched[0].member.lastName || ''}`.trim() : 'कर्जदार खातेदार'));
                    const primaryCif = cleanCif || getAccCif(matched[0]) || '-';
                    setMultiLoanCustomerInfo({
                        name: custName,
                        cifNo: primaryCif,
                        customerId: cId || getAccCustId(matched[0])
                    });
                    const firstCustId = getAccCustId(matched[0]);
                    const bKey = firstCustId ? `C_${firstCustId}` : (matched[0].memberID ? `M_${matched[0].memberID}` : `ACC_${matched[0].loanAccountID}`);
                    setSelectedBorrowerKey(bKey);
                    if (firstCustId) setSelectedCustomerId(firstCustId);

                    setShowMultiLoanModal(true);
                    setNoLoanFoundAlert(null);
                } else {
                    setCustomerMatchingLoans([]);
                    const identifier = cleanCif ? `CIF: ${cleanCif}` : (cId ? `ID: ${cId}` : `Member: ${mId}`);
                    setNoLoanFoundAlert(`निवडलेल्या खातेदाराचे (${customerNameStr || identifier}) कोणतेही सक्रिय कर्ज खाते आढळले नाही.`);
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
    };

    const fetchLedgers = async () => {
        try {
            const res = await axios.get('/api/Ledgers');
            setLedgers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectLoanFromModal = (acc: LoanAccount) => {
        selectLoanAccountById(acc.loanAccountID);
        setShowMultiLoanModal(false);
    };

    const selectLoanAccountById = async (accId: number, accountList?: LoanAccount[]) => {
        const pool = accountList && accountList.length > 0 ? accountList : accounts;
        const acc = pool.find(a => a.loanAccountID === accId);
        if (!acc) return;

        const accSchemeId = acc.loanRateID || acc.loanRate?.loanRateID;
        if (accSchemeId && selectedSchemeId !== accSchemeId) {
            setSelectedSchemeId(accSchemeId);
        }

        setSelectedAccount(acc);
        const custId = acc.customerID || acc.customer?.customerID;
        const bKey = custId ? `C_${custId}` : (acc.memberID ? `M_${acc.memberID}` : `ACC_${acc.loanAccountID}`);
        setSelectedBorrowerKey(bKey);
        setSelectedCustomerId(custId || null);
        (window as any).selectedLoanCustomerId = custId;
        (window as any).selectedLoanAccountId = acc.loanAccountID;
        (window as any).selectedLoanMemberId = acc.memberID;
        setFormData(p => ({ ...p, loanAccountID: acc.loanAccountID }));
        setAccountDetails(null);
        setNpaStatus(null);

        fetchNextReceiptNo(selectedBranchId, acc.loanAccountID);
        if (acc.loanRate) {
            calculateInterest(acc, formData.collectionDate || new Date().toISOString().split('T')[0]);
        }

        try {
            const res = await axios.get(`/api/LoanAccounts/${accId}/AccountDetailsAndSchedule`);
            if (res.data) {
                setAccountDetails(res.data);
                setSelectedAccount(prev => {
                    if (!prev || prev.loanAccountID !== accId) return prev;
                    return {
                        ...prev,
                        principalBalance: res.data.currentPrincipalBalance !== undefined ? res.data.currentPrincipalBalance : prev.principalBalance,
                        interestBalance: res.data.currentInterestBalance !== undefined ? res.data.currentInterestBalance : prev.interestBalance,
                        overdueInterestBalance: res.data.currentOverdueInterestBalance !== undefined ? res.data.currentOverdueInterestBalance : prev.overdueInterestBalance,
                        sanctionedAmount: res.data.sanctionedAmount !== undefined ? res.data.sanctionedAmount : prev.sanctionedAmount,
                        loanDisbursementDate: res.data.disbursementDate || prev.loanDisbursementDate,
                        lastInstallmentPaidDate: res.data.lastInstallmentPaidDate !== undefined ? res.data.lastInstallmentPaidDate : prev.lastInstallmentPaidDate,
                        lastInterestPostingDate: res.data.lastInterestPostingDate !== undefined ? res.data.lastInterestPostingDate : prev.lastInterestPostingDate
                    };
                });
            }

            try {
                const npaRes = await axios.get(`/api/Npa/status/${accId}`);
                if (npaRes.data) {
                    setNpaStatus(npaRes.data);
                }
            } catch (err: any) {
                if (err.response?.status !== 404) {
                    console.error("Failed to fetch NPA status", err);
                }
            }
        } catch (err) {
            console.error("Failed to fetch schedule", err);
            setAccountDetails(null);
        }
    };

    const handleSchemeChange = (schemeId: number | null) => {
        setSelectedSchemeId(schemeId);

        if (!schemeId) {
            setSelectedBorrowerKey(null);
            setSelectedCustomerId(null);
            setSelectedAccount(null);
            setAccountDetails(null);
            setNpaStatus(null);
            (window as any).selectedLoanCustomerId = undefined;
            (window as any).selectedLoanAccountId = undefined;
            (window as any).selectedLoanMemberId = undefined;
            setFormData(p => ({ ...p, loanAccountID: undefined }));
            return;
        }

        // If a borrower is already selected, verify if they have any loans in this new scheme
        if (selectedBorrowerKey || selectedCustomerId) {
            const matchingBorrowerLoans = accounts.filter((a: any) => {
                const custId = Number(a.customerID || a.customer?.customerID || a.memberID || 0);
                const belongsToBorrower = (selectedCustomerId && custId === Number(selectedCustomerId)) ||
                    (selectedBorrowerKey && (
                        selectedBorrowerKey === `C_${custId}` || 
                        selectedBorrowerKey === `M_${a.memberID}` || 
                        selectedBorrowerKey === `ACC_${a.loanAccountID}`
                    ));
                if (!belongsToBorrower) return false;
                const rId = a.loanRateID || a.loanRate?.loanRateID;
                return Number(rId) === Number(schemeId);
            });

            if (matchingBorrowerLoans.length === 0) {
                // Current borrower has no loans in this scheme -> reset selection cleanly
                setSelectedBorrowerKey(null);
                setSelectedCustomerId(null);
                setSelectedAccount(null);
                setAccountDetails(null);
                setNpaStatus(null);
                (window as any).selectedLoanCustomerId = undefined;
                (window as any).selectedLoanAccountId = undefined;
                (window as any).selectedLoanMemberId = undefined;
                setFormData(p => ({ ...p, loanAccountID: undefined }));
            } else if (matchingBorrowerLoans.length === 1) {
                // Exactly 1 loan in this scheme -> auto-select it!
                selectLoanAccountById(matchingBorrowerLoans[0].loanAccountID);
            } else {
                // Multiple loans in this scheme -> keep account unset so the inline grid prompts user
                setSelectedAccount(null);
                setAccountDetails(null);
                setNpaStatus(null);
                (window as any).selectedLoanAccountId = undefined;
                setFormData(p => ({ ...p, loanAccountID: undefined }));
            }
        }
    };

    const handleCustomerSelect = (customerId: number | '') => {
        const cId = customerId ? Number(customerId) : null;
        setSelectedCustomerId(cId);
        (window as any).selectedLoanCustomerId = cId || undefined;

        if (!cId) {
            setSelectedBorrowerKey(null);
            setSelectedAccount(null);
            setAccountDetails(null);
            setNpaStatus(null);
            setCustomerPigmyAccounts([]);
            setSelectedPigmyAccount(null);
            setCustomerSavingAccounts([]);
            setSelectedSavingAccount(null);
            setSavingAccountSourceType('SELF');
            setOtherSavingSearchQuery('');
            setOtherSavingSearchResults([]);
            (window as any).selectedLoanAccountId = undefined;
            (window as any).selectedLoanMemberId = undefined;
            setFormData(p => ({ ...p, loanAccountID: undefined, sourcePigmyAccountID: undefined, transferFromPigmyAccountNo: undefined, sourceSavingAccountID: undefined, transferFromSavingAccountNo: undefined, savingCustomerName: undefined }));
            return;
        }

        setSelectedBorrowerKey(`C_${cId}`);
        fetchCustomerPigmyAccounts(cId);
        fetchCustomerSavingAccounts(cId);

        // Loans of this customer matching the chosen scheme
        const loans = accounts.filter((a: any) => {
            const custId = Number(a.customerID || a.customer?.customerID || a.memberID || 0);
            if (custId !== cId) return false;
            if (selectedSchemeId) {
                const rId = a.loanRateID || a.loanRate?.loanRateID;
                return Number(rId) === Number(selectedSchemeId);
            }
            return true;
        });

        if (loans.length === 1) {
            selectLoanAccountById(loans[0].loanAccountID);
        } else {
            // Multiple loans: keep single account unset so the inline grid is shown
            setSelectedAccount(null);
            setAccountDetails(null);
            setNpaStatus(null);
            (window as any).selectedLoanAccountId = undefined;
            setFormData(p => ({ ...p, loanAccountID: undefined }));
        }
    };

    const handleMemberChange = (e: any) => {
        const val = e?.target?.value || e;
        if (!val) {
            handleCustomerSelect('');
            return;
        }
        if (typeof val === 'number') {
            handleCustomerSelect(val);
        } else {
            const numericId = parseInt(String(val).replace(/\D/g, ''), 10);
            handleCustomerSelect(numericId || '');
        }
    };

    const handleLoanAccountSelect = (e: any) => {
        const val = e.target.value;
        if (!val) {
            setSelectedAccount(null);
            setAccountDetails(null);
            setNpaStatus(null);
            setFormData(p => ({ ...p, loanAccountID: undefined }));
            return;
        }
        selectLoanAccountById(parseInt(val));
    };

    const getInterestStartDate = (acc: any): string | null => {
        if (!acc) return null;

        const candidates: Array<{ date: Date; dateStr: string }> = [];

        const addCandidate = (dStr: string | undefined | null) => {
            if (!dStr) return;
            const d = parseDateSafe(dStr);
            if (!isNaN(d.getTime())) {
                candidates.push({ date: d, dateStr: dStr });
            }
        };

        addCandidate(acc.lastInterestPostingDate);
        addCandidate(acc.lastInstallmentPaidDate);

        let latest: { date: Date; dateStr: string } | null = null;
        for (const c of candidates) {
            if (!latest || c.date.getTime() > latest.date.getTime()) {
                latest = c;
            }
        }

        // Core Banking Rule: For opening balance loans, interest begins from openingDate (migration cutoff date e.g. 31/03/2026), NOT historical disbursementDate (e.g. 31/03/2025)
        if (acc.isOpeningBalance && acc.openingDate) {
            const opDate = parseDateSafe(acc.openingDate);
            if (!isNaN(opDate.getTime())) {
                if (!latest || latest.date.getTime() < opDate.getTime()) {
                    return acc.openingDate;
                }
            }
        }

        if (latest) {
            return latest.dateStr;
        }

        return acc.loanDisbursementDate || acc.openingDate || null;
    };

    // Core banking day count: (toDate - fromDate) inherently counts 1 day per night held (first day included, payment day excluded)
    // E.g., 05/04/2026 to 30/06/2026 = 86 days.
    const calculateElapsedDays = (fromDateStr: string | Date | null | undefined, toDateVal: string | Date | null | undefined): number => {
        if (!fromDateStr) return 0;
        const fromDate = parseDateSafe(fromDateStr);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = parseDateSafe(toDateVal || new Date());
        toDate.setHours(0, 0, 0, 0);

        const rawDiffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        if (rawDiffDays <= 0) return 0;

        // Core banking standard: (toDate - fromDate) inherently includes the first day and excludes the payment day.
        // If an institution explicitly configures both boundary dates to be included, add 1:
        const isIncludeBothDays = sanstha?.loanInterestDayCountMethod === 'IncludeBothDays' || sanstha?.loanInterestDayCountMethod === 'IncludePaymentDay';
        return isIncludeBothDays ? rawDiffDays + 1 : rawDiffDays;
    };

    const calculateInterest = (acc: any, dateStr: string) => {
        if (!acc) return;
        const loanRate = acc.loanRate;
        const isInterestOnly = loanRate && 
            (loanRate.loanInstallmentType?.includes("व्याजवरती") || 
             loanRate.loanInstallmentType?.includes("Interest Only") ||
             loanRate.loanInstallmentType?.includes("Bullet") ||
             loanRate.shortName?.toLowerCase().includes("gold") ||
             loanRate.loanType?.includes("सोने"));

        const rate = acc.loanRate?.interestRate || acc.interestRate || 0;
        const principal = acc.principalBalance || 0;
        const fromDateStr = getInterestStartDate(acc);
        let daysInterest = 0;
        if (fromDateStr) {
            const diffDays = calculateElapsedDays(fromDateStr, dateStr || new Date());
            if (diffDays > 0) {
                daysInterest = Math.round((principal * rate * diffDays) / 36500);
            }
        }
        const yeneVyaj = accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (acc.interestBalance || 0);
        const penal = acc.overdueInterestBalance || 0;

        if (isInterestOnly) {
            const totalDue = penal + yeneVyaj + daysInterest;
            autoApportion(totalDue, formData.fees || [], acc, dateStr);
        } else {
            const installment = acc.installmentAmount || 0;
            // 1 regular principal installment + old receivable interest + current days interest + penalty
            const totalDue = installment + yeneVyaj + daysInterest + penal;
            autoApportion(totalDue, formData.fees || [], acc, dateStr);
        }
    };

    // Watch for collectionDate and accountDetails changes to recalculate interest and due amount
    useEffect(() => {
        if (isPassingMode) return;
        if (selectedAccount) {
            const loanRate = selectedAccount.loanRate;
            const isDailyReducing = loanRate && 
                (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("दैनिक घटती"));

            const isInterestOnly = loanRate && 
                (loanRate.loanInstallmentType?.includes("व्याजवरती") || 
                 loanRate.loanInstallmentType?.includes("Interest Only") ||
                 loanRate.loanInstallmentType?.includes("Bullet") ||
                 loanRate.shortName?.toLowerCase().includes("gold") ||
                 loanRate.loanType?.includes("सोने"));

            if (isInterestOnly) {
                calculateInterest(selectedAccount, formData.collectionDate || new Date().toISOString().split('T')[0]);
            } else if (!isDailyReducing && accountDetails?.schedule && accountDetails.schedule.length > 0) {
                const collectionDateObj = parseDateSafe(formData.collectionDate || new Date());
                collectionDateObj.setHours(0, 0, 0, 0);

                const overdueInstallments = accountDetails.schedule.filter(s => {
                    const dueDateObj = parseDateSafe(s.dueDate);
                    dueDateObj.setHours(0, 0, 0, 0);

                    // For opening balance loans, ignore schedule items on/before opening date
                    if (selectedAccount.isOpeningBalance && selectedAccount.openingDate) {
                        const openingDateObj = parseDateSafe(selectedAccount.openingDate);
                        openingDateObj.setHours(0, 0, 0, 0);
                        if (dueDateObj <= openingDateObj) return false;
                    }

                    return dueDateObj <= collectionDateObj && s.status !== 'Paid';
                });

                let totalInstDue = 0;
                if (overdueInstallments.length > 0) {
                    const overduePrincipal = overdueInstallments.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
                    const overdueInterest = overdueInstallments.reduce((sum, s) => sum + s.interestAmount, 0);
                    totalInstDue = overduePrincipal + overdueInterest;
                } else {
                    const nextInstallment = accountDetails.schedule.find(s => s.status !== 'Paid');
                    if (nextInstallment) {
                        const nextP = nextInstallment.remainingPrincipal !== undefined ? nextInstallment.remainingPrincipal : nextInstallment.principalAmount;
                        totalInstDue = nextP + (nextInstallment.interestAmount || 0);
                    }
                }
                const yeneVyaj = accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (selectedAccount.interestBalance || 0);
                autoApportion((totalInstDue > 0 ? totalInstDue : (selectedAccount.installmentAmount || 0)) + yeneVyaj, formData.fees || [], selectedAccount);
            } else {
                calculateInterest(selectedAccount, formData.collectionDate || new Date().toISOString().split('T')[0]);
            }
        }
    }, [formData.collectionDate, accountDetails, selectedAccount]);

    const applyQuickAmount = (type: '1_INST' | 'INTEREST_ONLY' | 'FULL_DUE') => {
        const account = selectedAccount;
        if (!account) return;
        const dateStr = formData.collectionDate || new Date().toISOString().split('T')[0];
        const feesSum = (formData.fees || []).reduce((acc, f) => acc + (f.amount || 0), 0);
        const penal = account.overdueInterestBalance || 0;
        const yeneVyaj = accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (account.interestBalance || 0);

        const loanRate = account.loanRate;
        const isDailyReducing = loanRate && 
            (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("दैनिक घटती"));

        let currentInterestDue = 0;
        let principalDue = 0;

        if (!isDailyReducing && accountDetails?.schedule && accountDetails.schedule.length > 0) {
            const collectionDateObj = parseDateSafe(dateStr);
            collectionDateObj.setHours(0, 0, 0, 0);

            const overdueInstallments = accountDetails.schedule.filter(s => {
                const dueDateObj = parseDateSafe(s.dueDate);
                dueDateObj.setHours(0, 0, 0, 0);
                if (account.isOpeningBalance && account.openingDate) {
                    const openingDateObj = parseDateSafe(account.openingDate);
                    openingDateObj.setHours(0, 0, 0, 0);
                    if (dueDateObj <= openingDateObj) return false;
                }
                return dueDateObj <= collectionDateObj && s.status !== 'Paid';
            });

            let targetInstallments: any[] = [];
            if (overdueInstallments.length > 0) {
                targetInstallments = overdueInstallments;
            } else {
                const nextInstallment = accountDetails.schedule.find(s => s.status !== 'Paid');
                if (nextInstallment) targetInstallments = [nextInstallment];
            }

            if (targetInstallments.length > 0) {
                currentInterestDue = targetInstallments.reduce((sum, s) => sum + s.interestAmount, 0);
                principalDue = targetInstallments.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
            }
        } else {
            const rate = account.loanRate?.interestRate || account.interestRate || 0;
            const principal = account.principalBalance || 0;
            const fromDateStr = getInterestStartDate(account);
            if (fromDateStr) {
                const diffDays = calculateElapsedDays(fromDateStr, dateStr);
                if (diffDays > 0) {
                    currentInterestDue = Math.round((principal * rate * diffDays) / 36500);
                }
            }
            principalDue = account.installmentAmount || 0;
        }

        if (type === 'INTEREST_ONLY') {
            const total = penal + yeneVyaj + currentInterestDue + feesSum;
            autoApportion(total, formData.fees || []);
        } else if (type === '1_INST') {
            const total = principalDue + penal + yeneVyaj + currentInterestDue + feesSum;
            autoApportion(total, formData.fees || []);
        } else if (type === 'FULL_DUE') {
            const maxPrincipal = account.principalBalance || 0;
            const total = maxPrincipal + penal + yeneVyaj + currentInterestDue + feesSum;
            autoApportion(total, formData.fees || []);
        }
    };

    const handleTotalAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value) || 0;
        autoApportion(val, formData.fees || []);
    };

    const autoApportion = (totalAmt: number, currentFees: any[], accountOverride?: any, dateOverride?: string) => {
        const account = accountOverride || selectedAccount;
        if (!account) return;
        
        const dateStr = dateOverride || formData.collectionDate || new Date().toISOString().split('T')[0];
        let remaining = totalAmt;
        
        // 1. Subtract Fees first
        const feesSum = currentFees.reduce((acc, f) => acc + (f.amount || 0), 0);
        remaining = Math.max(0, remaining - feesSum);

        // 2. Penalty Interest (Overdue)
        const penaltyDue = account.overdueInterestBalance || 0;
        const penaltyCollected = Math.min(remaining, penaltyDue);
        remaining -= penaltyCollected;

        const loanRate = account.loanRate;
        const isDailyReducing = loanRate && 
            (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("दैनिक घटती"));

        // 3. Past Posted / Accrued Receivable Interest (येणे व्याज)
        const receivableDue = accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (account.interestBalance || 0);
        const receivableCollected = Math.min(remaining, receivableDue);
        remaining -= receivableCollected;

        let currentInterestDue = 0;
        let principalDue = 0;

        // Check if we have schedule details loaded and is NOT daily reducing
        if (!isDailyReducing && accountDetails?.schedule && accountDetails.schedule.length > 0) {
            const collectionDateObj = parseDateSafe(dateStr);
            collectionDateObj.setHours(0, 0, 0, 0);

            const overdueInstallments = accountDetails.schedule.filter(s => {
                const dueDateObj = parseDateSafe(s.dueDate);
                dueDateObj.setHours(0, 0, 0, 0);

                if (account.isOpeningBalance && account.openingDate) {
                    const openingDateObj = parseDateSafe(account.openingDate);
                    openingDateObj.setHours(0, 0, 0, 0);
                    if (dueDateObj <= openingDateObj) return false;
                }

                return dueDateObj <= collectionDateObj && s.status !== 'Paid';
            });

            let targetInstallments: any[] = [];
            if (overdueInstallments.length > 0) {
                targetInstallments = overdueInstallments;
            } else {
                const nextInstallment = accountDetails.schedule.find(s => s.status !== 'Paid');
                if (nextInstallment) targetInstallments = [nextInstallment];
            }

            if (targetInstallments.length > 0) {
                currentInterestDue = targetInstallments.reduce((sum, s) => sum + s.interestAmount, 0);
                principalDue = targetInstallments.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
            }
        } else {
            // Dynamic daily calculation for daily reducing
            const rate = account.loanRate?.interestRate || account.interestRate || 0;
            const principal = account.principalBalance || 0;
            const fromDateStr = getInterestStartDate(account);
            if (fromDateStr) {
                const diffDays = calculateElapsedDays(fromDateStr, dateStr);
                if (diffDays > 0) {
                    currentInterestDue = Math.round((principal * rate * diffDays) / 36500);
                }
            }
            principalDue = account.installmentAmount || 0;
        }

        // 4. Current Period Interest (चालू व्याज)
        const currentInterestCollected = Math.min(remaining, currentInterestDue);
        remaining -= currentInterestCollected;

        // 5. Principal
        const maxPrincipal = account.principalBalance || 0;
        const targetPrincipal = principalDue > 0 ? principalDue : maxPrincipal;
        const basePrincipalCollected = Math.min(remaining, targetPrincipal);
        remaining -= basePrincipalCollected;

        // 6. Remaining to Extra Principal / Surcharge
        const actualPrincipalCol = Math.min(maxPrincipal, basePrincipalCollected + remaining);
        const surchargeCol = (basePrincipalCollected + remaining) > maxPrincipal ? ((basePrincipalCollected + remaining) - maxPrincipal) : 0;

        setFormData(p => ({
            ...p,
            totalAmountReceived: totalAmt,
            penaltyInterestCollected: penaltyCollected,
            receivableInterestCollected: receivableCollected,
            interestCollected: currentInterestCollected,
            principalCollected: actualPrincipalCol,
            surchargeCollected: surchargeCol,
            fees: currentFees
        }));
    };

    const handleSplitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const val = parseFloat(value) || 0;
        
        setFormData(p => {
            const newForm = { ...p, [name]: val };
            const feesSum = (newForm.fees || []).reduce((acc, f) => acc + (f.amount || 0), 0);
            
            if (name === 'interestCollected' || name === 'receivableInterestCollected' || name === 'penaltyInterestCollected' || name === 'surchargeCollected') {
                // Keep total constant, adjust principal
                let newPrincipal = (p.totalAmountReceived || 0) - feesSum - (newForm.receivableInterestCollected || 0) - (newForm.interestCollected || 0) - (newForm.penaltyInterestCollected || 0) - (newForm.surchargeCollected || 0);
                
                if (newPrincipal < 0) {
                    newPrincipal = 0;
                    // If principal goes below 0, adjust total instead
                    newForm.totalAmountReceived = feesSum + (newForm.receivableInterestCollected || 0) + (newForm.interestCollected || 0) + (newForm.penaltyInterestCollected || 0) + (newForm.surchargeCollected || 0);
                }
                newForm.principalCollected = newPrincipal;
            } else if (name === 'principalCollected') {
                // If explicitly changing principal, recalculate total
                newForm.totalAmountReceived = (newForm.principalCollected || 0) + (newForm.receivableInterestCollected || 0) + (newForm.interestCollected || 0) + (newForm.penaltyInterestCollected || 0) + (newForm.surchargeCollected || 0) + feesSum;
            }
            
            return newForm;
        });
    };

    const handleFeeChange = (index: number, field: string, val: any) => {
        const newFees = [...(formData.fees || [])];
        newFees[index] = { ...newFees[index], [field]: field === 'amount' ? (parseFloat(val) || 0) : parseInt(val) };
        autoApportion(formData.totalAmountReceived || 0, newFees);
    };

    const addFeeRow = () => {
        setFormData(p => ({
            ...p,
            fees: [...(p.fees || []), { ledgerID: 0, amount: 0 }]
        }));
    };

    const removeFeeRow = (index: number) => {
        const newFees = formData.fees?.filter((_, i) => i !== index) || [];
        autoApportion(formData.totalAmountReceived || 0, newFees);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving || isPassingMode) {
            return;
        }
        
        if ((formData.isOTS || (formData.interestWaived || 0) > 0 || (formData.penaltyWaived || 0) > 0) && !formData.resolutionNo?.trim()) {
            alert('एकरकम तडजोड (OTS) किंवा व्याज सूटीसाठी संचालक मंडळाचा ठराव क्रमांक (Resolution No.) प्रविष्ट करणे अनिवार्य आहे.');
            return;
        }

        if (!formData.isOTS && selectedAccount && formData.principalCollected && selectedAccount.principalBalance !== undefined) {
            if (formData.principalCollected > selectedAccount.principalBalance + 0.01) {
                alert(`जमा मुद्दल रक्कम (₹${formData.principalCollected.toLocaleString('en-IN')}) ही शिल्लक मुद्दल रक्कमेपेक्षा (₹${selectedAccount.principalBalance.toLocaleString('en-IN')}) जास्त असू शकत नाही.`);
                return;
            }
        }

        if (formData.paymentMode === 'Pigmy Transfer') {
            if (!formData.sourcePigmyAccountID) {
                alert('कृपया वर्ग करण्यासाठी पिग्मी खाते निवडा (Please select a Pigmy account).');
                return;
            }
            if (selectedPigmyAccount) {
                const avail = Math.max(0, (selectedPigmyAccount.totalDepositedAmount || 0) - (selectedPigmyAccount.isLienMarked ? (selectedPigmyAccount.lienAmount || 0) : 0));
                const totalReq = (formData.totalAmountReceived || 0) + (formData.fees?.reduce((acc, f) => acc + (f.amount || 0), 0) || 0);
                if (totalReq > avail + 0.01) {
                    alert(`पिग्मी खात्यात शिल्लक कमी आहे! उपलब्ध शिल्लक: ₹${avail.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
                    return;
                }
            }
        }

        if (formData.paymentMode === 'Saving Transfer') {
            if (!formData.sourceSavingAccountID && !formData.transferFromSavingAccountNo) {
                alert('कृपया वर्ग करण्यासाठी बचत खाते निवडा (Please select a Saving account).');
                return;
            }
            if (selectedSavingAccount) {
                const avail = Math.max(0, (selectedSavingAccount.currentBalance || 0) - (selectedSavingAccount.lienAmount || 0) - (selectedSavingAccount.minimumBalance || 0));
                const totalReq = (formData.totalAmountReceived || 0) + (formData.fees?.reduce((acc, f) => acc + (f.amount || 0), 0) || 0);
                if (totalReq > avail + 0.01) {
                    alert(`बचत खात्यात शिल्लक कमी आहे! उपलब्ध शिल्लक: ₹${avail.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
                    return;
                }
            }
        }

        if (formData.paymentMode === 'Bank' || formData.paymentMode === 'Cheque') {
            if (!formData.bankAccountLedgerID || Number(formData.bankAccountLedgerID) <= 0) {
                alert('बँक / चेक वसुलीसाठी कृपया वैध बँक जी.एल. खाते (Bank GL Account) निवडा.');
                return;
            }
        }

        const targetAccountId = formData.loanAccountID || selectedAccount?.loanAccountID || (window as any).selectedLoanAccountId;
        if (!targetAccountId) {
            alert('कृपया आधी कर्जदार व सक्रिय कर्ज खाते निवडा.');
            return;
        }

        setIsSaving(true);
        try {
            const isBankOrCheque = formData.paymentMode === 'Bank' || formData.paymentMode === 'Cheque';
            const payload = {
                ...formData,
                bankAccountLedgerID: isBankOrCheque ? Number(formData.bankAccountLedgerID) : null,
                bankName: isBankOrCheque ? formData.bankName : null,
                chequeNo: formData.paymentMode === 'Cheque' ? formData.chequeNo : null,
                loanAccountID: targetAccountId,
                branchID: selectedBranchId
            };
            const res = await axios.post('/api/LoanCollections', payload);
            const savedCollectionId = res.data?.loanCollectionID || res.data?.LoanCollectionID;

            // Save the ID for printing
            if (savedCollectionId) {
                setLastSavedCollectionId(savedCollectionId);
            }

            // In-memory update of account balance to prevent sluggishness from re-fetching all accounts
            if (selectedAccount) {
                const collected = formData.principalCollected || 0;
                const remainingBal = Math.max(0, (selectedAccount.principalBalance || 0) - collected);
                setAccounts(prev => prev.map(a => a.loanAccountID === selectedAccount.loanAccountID ? {
                    ...a,
                    principalBalance: remainingBal,
                    status: remainingBal <= 0 ? 'Closed' : a.status
                } : a));
            }

            // Check if loan was fully settled and has active collaterals
            if (res.data?.isLoanFullySettled && res.data?.activeCollaterals && res.data.activeCollaterals.length > 0) {
                setLienPromptData({
                    loanAccountId: res.data.loanAccountID || res.data.LoanAccountID || selectedAccount?.loanAccountID,
                    loanAccountNo: res.data.settledLoanAccountNo || selectedAccount?.loanAccountNo || '',
                    activeCollaterals: res.data.activeCollaterals,
                    collectionId: savedCollectionId
                });
            } else {
                alert('पावती यशस्वीरित्या जतन झाली!');
            }

            // Reset form
            setFormData({
                collectionDate: activeBusinessDate,
                receiptNo: '',
                paymentMode: "Cash",
                totalAmountReceived: 0,
                surchargeCollected: 0,
                penaltyInterestCollected: 0,
                receivableInterestCollected: 0,
                interestCollected: 0,
                principalCollected: 0,
                fees: []
            });
            setAllowDateOverride(false);
            setShowFeesPanel(false);
            setSelectedBorrowerKey(null);
            setSelectedCustomerId(null);
            setSelectedAccount(null);
            setAccountDetails(null);
            setCustomerPigmyAccounts([]);
            setSelectedPigmyAccount(null);
            setCustomerSavingAccounts([]);
            setSelectedSavingAccount(null);
            setSavingAccountSourceType('SELF');
            setOtherSavingSearchQuery('');
            setOtherSavingSearchResults([]);
            (window as any).selectedLoanCustomerId = undefined;
            (window as any).selectedLoanAccountId = undefined;
            (window as any).selectedLoanMemberId = undefined;
            fetchData();
            fetchNextReceiptNo(selectedBranchId);
        } catch (err: any) {
            let errorMsg = 'अज्ञात तांत्रिक अडचण आली.';
            if (err.response?.data) {
                const data = err.response.data;
                if (typeof data === 'string') {
                    errorMsg = data;
                } else if (data.message) {
                    errorMsg = data.message;
                } else if (data.errors && typeof data.errors === 'object') {
                    errorMsg = Object.values(data.errors).flat().join('\n');
                } else if (data.title) {
                    errorMsg = data.detail ? `${data.title} (${data.detail})` : data.title;
                } else {
                    try {
                        errorMsg = JSON.stringify(data);
                    } catch {
                        errorMsg = String(data);
                    }
                }
            } else if (err.message) {
                errorMsg = err.message;
            }
            alert('माहिती जतन करण्यास अडचण आली:\n' + errorMsg);
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDirectWhatsAppShare = (c: any) => {
        if (!c) return;
        const sansthaName = sanstha?.sansthaName || 'स्मार्ट मल्टीस्टेट पतसंस्था लि.';
        const borrower = c.loanAccount?.customer;
        const memberName = borrower ? `${borrower.firstName || ''} ${borrower.lastName || ''}`.trim() : 'खातेदार';
        const mobileNo = borrower?.mobileNo || '';

        const totalFees = c.fees?.reduce((acc: number, f: any) => acc + (f.amount || 0), 0) || 0;
        const totalAmount = (c.totalAmountReceived || 0) + totalFees;

        const message = 
`🏦 *${sansthaName}*
----------------------------------------
🧾 *कर्ज जमा पावती (Loan Receipt)*

नमस्कार *${memberName}*,
तुमची कर्ज वसुली जमा पावती यशस्वीरित्या नोंदवली गेली आहे:

📄 *पावती क्रमांक:* ${c.receiptNo}
🗓️ *जमा दिनांक:* ${new Date(c.collectionDate).toLocaleDateString('en-GB')}
👤 *कर्ज खाते क्र.:* ${c.loanAccount?.loanAccountNo}
📊 *कर्ज प्रकार:* ${c.loanAccount?.loanRate?.shortName || c.loanAccount?.loanRate?.loanType || '-'}

💵 *जमा रक्कम तपशील:*
• मुद्दल जमा: ₹ ${c.principalCollected?.toLocaleString('en-IN') || '0.00'}
${(c.receivableInterestCollected || 0) > 0 ? `• थकीत येणे व्याज: ₹ ${(c.receivableInterestCollected || 0).toLocaleString('en-IN')}\n` : ''}• चालू व्याज जमा: ₹ ${c.interestCollected?.toLocaleString('en-IN') || '0.00'}
${c.penaltyInterestCollected > 0 ? `• जादा व्याज: ₹ ${c.penaltyInterestCollected?.toLocaleString('en-IN')}\n` : ''}${c.surchargeCollected > 0 ? `• सरचार्ज: ₹ ${c.surchargeCollected?.toLocaleString('en-IN')}\n` : ''}💰 *एकूण जमा रक्कम:* ₹ ${totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
💳 *पेमेंट पद्धत:* ${c.paymentMode}

सदर पावती संगणक प्रणालीद्वारे तयार करण्यात आली आहे.
धन्यवाद! 🙏
*${sansthaName}*`;

        const encodedMsg = encodeURIComponent(message);
        const cleanMobile = mobileNo ? mobileNo.replace(/\D/g, '') : '';
        const phoneParam = cleanMobile ? (cleanMobile.length === 10 ? `phone=91${cleanMobile}&` : `phone=${cleanMobile}&`) : '';
        if (!navigator.onLine) {
            alert('इंटरनेट कनेक्शन उपलब्ध नाही (Offline Mode). कृपया पावती प्रिंट करा.');
            return;
        }

        const waUrl = `https://api.whatsapp.com/send?${phoneParam}text=${encodedMsg}`;
        window.open(waUrl, '_blank');
    };

    const getCollateralTypeName = (type: string) => {
        switch (type) {
            case 'FixedDeposit': return 'मुदत ठेव (FD)';
            case 'PigmyDeposit': return 'पिग्मी ठेव (Pigmy)';
            case 'RecurringDeposit': return 'आवर्ती ठेव (RD)';
            case 'SavingDeposit': return 'बचत खाते (Saving)';
            default: return type;
        }
    };

    const handleReleaseAllLiens = async () => {
        if (!lienPromptData) return;
        setReleasingLien(true);
        try {
            const res = await axios.post(`/api/LoanCollaterals/ReleaseAllByLoan/${lienPromptData.loanAccountId}`);
            alert(res.data?.message || 'तारण ठेवींवरील बोजा यशस्वीरित्या काढण्यात आला!');
            setLienPromptData(null);
        } catch (err: any) {
            alert('बोजा मोकळा करण्यास अडचण आली: ' + (err.response?.data?.message || err.response?.data || err.message));
            console.error(err);
        } finally {
            setReleasingLien(false);
        }
    };

    const handlePrintClick = () => {
        if (lastSavedCollectionId) {
            setPrintingCollectionId(lastSavedCollectionId);
        } else {
            alert('कृपया आधी माहिती जतन (Save) करा. (Please save the entry first)');
        }
    };

    if (printingCollectionId) {
        return <LoanCollectionReceiptPrint collectionId={printingCollectionId} onBack={() => setPrintingCollectionId(null)} />;
    }

    const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 bg-white text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-[30px] transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed";
    const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";

    const handleResetForm = () => {
        setFormData({
            collectionDate: activeBusinessDate,
            receiptNo: '',
            paymentMode: "Cash",
            totalAmountReceived: 0,
            surchargeCollected: 0,
            penaltyInterestCollected: 0,
            receivableInterestCollected: 0,
            interestCollected: 0,
            principalCollected: 0,
            fees: []
        });
        setAllowDateOverride(false);
        setShowFeesPanel(false);
        setNoLoanFoundAlert(null);
        setSelectedCustomerId(null);
        setSelectedBorrowerKey(null);
        setSelectedAccount(null);
        setAccountDetails(null);
        setNpaStatus(null);
        setCustomerPigmyAccounts([]);
        setSelectedPigmyAccount(null);
        setPigmyAccountSourceType('SELF');
        setPigmyOldAccSearchQuery('');
        setOtherPigmySearchResults([]);
        setCustomerSavingAccounts([]);
        setSelectedSavingAccount(null);
        setSavingAccountSourceType('SELF');
        setOtherSavingSearchQuery('');
        setOtherSavingSearchResults([]);
        (window as any).selectedLoanCustomerId = undefined;
        (window as any).selectedLoanAccountId = undefined;
        (window as any).selectedLoanMemberId = undefined;
        setLastSavedCollectionId(null);
        fetchNextReceiptNo(selectedBranchId);
    };

    const selectedBorrowerName = selectedAccount
        ? (selectedAccount.customer
            ? [selectedAccount.customer.firstName, selectedAccount.customer.middleName, selectedAccount.customer.lastName].filter(Boolean).join(' ').trim()
            : [selectedAccount.member?.firstName, selectedAccount.member?.lastName].filter(Boolean).join(' ').trim()) || 'कर्जदार खातेदार'
        : '';

    const selectedBorrowerCif = selectedAccount?.customer?.cifNo || selectedAccount?.member?.memberCode || '';
    const activeBranchObj = branches.find(b => b.branchID === selectedBranchId);
    const effectiveSchemeId = selectedSchemeId || selectedAccount?.loanRateID || selectedAccount?.loanRate?.loanRateID || '';
    const totalMatchingLoansCount = Math.max(borrowerLoans.length, customerMatchingLoans.length);

    const duesSummary = (() => {
        if (!selectedAccount) return null;
        const loanRate = selectedAccount.loanRate;
        const isDailyReducing = Boolean(
            loanRate &&
            (loanRate.interestCalculationMethod?.includes("Daily Reducing") || loanRate.interestCalculationMethod?.includes("दैनिक घटती"))
        );

        const disbursementDate = accountDetails?.disbursementDate || selectedAccount.loanDisbursementDate || selectedAccount.openingDate;
        const totalDisbursed = accountDetails?.totalDisbursedAmount || accountDetails?.sanctionedAmount || selectedAccount.sanctionedAmount || 0;
        const sanctionedAmount = accountDetails?.sanctionedAmount || selectedAccount.sanctionedAmount || 0;
        const interestRate = selectedAccount.loanRate?.interestRate || selectedAccount.interestRate || 0;
        const yeneBaki = accountDetails?.currentPrincipalBalance !== undefined ? accountDetails.currentPrincipalBalance : (selectedAccount.principalBalance || 0);

        let thakitDinank = "-";
        let vasulpatra = 0;
        let paikiThakbaki = 0;
        let vyaj = 0;
        const yeneVyaj = accountDetails?.currentInterestBalance !== undefined ? accountDetails.currentInterestBalance : (selectedAccount.interestBalance || 0);
        const dandVyaj = accountDetails?.currentOverdueInterestBalance !== undefined ? accountDetails.currentOverdueInterestBalance : (selectedAccount.overdueInterestBalance || 0);
        const surcharge = formData.surchargeCollected || 0;
        const vasuliFee = (formData.fees || []).reduce((acc, f) => acc + (Number(f.amount) || 0), 0);

        const collectionDateObj = parseDateSafe(formData.collectionDate || new Date());
        collectionDateObj.setHours(0, 0, 0, 0);

        let thakitHapteCount = 0;
        if (accountDetails?.schedule && accountDetails.schedule.length > 0) {
            thakitHapteCount = accountDetails.schedule.filter(s => {
                const dDate = parseDateSafe(s.dueDate);
                dDate.setHours(0, 0, 0, 0);
                return dDate <= collectionDateObj && s.status !== 'Paid';
            }).length;
        }

        if (!isDailyReducing && accountDetails?.schedule && accountDetails.schedule.length > 0) {
            const overdueInstallments = accountDetails.schedule.filter(s => {
                const dueDateObj = parseDateSafe(s.dueDate);
                dueDateObj.setHours(0, 0, 0, 0);
                return dueDateObj <= collectionDateObj && s.status !== 'Paid';
            });

            if (overdueInstallments.length > 0) {
                vasulpatra = overdueInstallments.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
                paikiThakbaki = overdueInstallments
                    .filter(s => {
                        const dDate = parseDateSafe(s.dueDate);
                        dDate.setHours(0, 0, 0, 0);
                        return dDate < collectionDateObj;
                    })
                    .reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
                vyaj = overdueInstallments.reduce((sum, s) => sum + s.interestAmount, 0);
            } else {
                const nextInstallment = accountDetails.schedule.find(s => s.status !== 'Paid');
                if (nextInstallment) {
                    vasulpatra = nextInstallment.remainingPrincipal !== undefined ? nextInstallment.remainingPrincipal : (nextInstallment.principalAmount || 0);
                    vyaj = nextInstallment.interestAmount || 0;
                }
            }
        } else {
            const fromDateStr = getInterestStartDate(selectedAccount);
            if (fromDateStr) {
                const diffDays = calculateElapsedDays(fromDateStr, formData.collectionDate);
                if (diffDays > 0) {
                    vyaj = Math.round((yeneBaki * interestRate * diffDays) / 36500);
                }
            }

            if (accountDetails?.schedule) {
                paikiThakbaki = accountDetails.schedule
                    .filter(s => parseDateSafe(s.dueDate) <= collectionDateObj && s.status !== 'Paid')
                    .reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : s.principalAmount), 0);
                vasulpatra = paikiThakbaki;
            }
        }

        if (vasulpatra > yeneBaki) vasulpatra = yeneBaki;
        if (paikiThakbaki > yeneBaki) paikiThakbaki = yeneBaki;

        if (accountDetails?.schedule && accountDetails.schedule.length > 0) {
            const firstUnpaid = accountDetails.schedule.find(s => s.status !== 'Paid');
            if (firstUnpaid) {
                const dDate = parseDateSafe(firstUnpaid.dueDate);
                dDate.setHours(0, 0, 0, 0);
                if (isDailyReducing || dDate < collectionDateObj) {
                    thakitDinank = formatDateSafe(dDate);
                }
            }
        }

        let days = 0;
        const fromDateStrGrid = getInterestStartDate(selectedAccount);
        if (fromDateStrGrid) {
            days = calculateElapsedDays(fromDateStrGrid, formData.collectionDate);
        }

        const shillakKarjRakkam = Math.max(0, yeneBaki - (formData.principalCollected || 0));
        const ekunVasulpatra = vasulpatra + vyaj + yeneVyaj + dandVyaj + surcharge + vasuliFee;

        return {
            disbursementDate,
            totalDisbursed,
            sanctionedAmount,
            interestRate,
            yeneBaki,
            thakitDinank,
            vasulpatra,
            paikiThakbaki,
            vyaj,
            yeneVyaj,
            dandVyaj,
            thakitHapteCount,
            fromDateStrGrid,
            days,
            shillakKarjRakkam,
            ekunVasulpatra,
            isDailyReducing
        };
    })();

    return (
        <div className="p-1.5 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4 space-y-2">
            {/* 1. STANDARD CBS TOP HEADER BANNER (border-b-2 border-primary) */}
            <div className="bg-white px-3.5 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-sm bg-primary/10 border border-primary/20 text-primary">
                        <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-sm font-bold text-gray-900 leading-tight">
                                कर्ज वसुली (Loan Recovery & Collection)
                            </h1>
                            {isHOUser ? (
                                <div className="inline-flex items-center gap-1 bg-slate-50 border border-gray-300 rounded-sm px-1.5 py-0.5">
                                    <Building2 className="w-3 h-3 text-primary" />
                                    <select
                                        value={selectedBranchId}
                                        onChange={(e) => {
                                            const bId = parseInt(e.target.value, 10);
                                            setSelectedBranchId(bId);
                                            fetchData(bId);
                                            fetchNextReceiptNo(bId, selectedAccount?.loanAccountID);
                                        }}
                                        disabled={isPassingMode}
                                        className="text-[11px] font-bold text-gray-800 bg-transparent focus:outline-none cursor-pointer disabled:cursor-not-allowed"
                                        title="वसुली शाखा निवडा"
                                    >
                                        {branches.map(b => (
                                            <option key={b.branchID} value={b.branchID}>
                                                {b.branchName} ({b.branchCode})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-primary text-[10.5px] font-bold">
                                    <Building2 className="w-3 h-3" />
                                    <span>{activeBranchObj ? `${activeBranchObj.branchName}` : `शाखा #${selectedBranchId}`}</span>
                                </span>
                            )}
                        </div>
                        <p className="text-[10.5px] text-gray-500">
                            मुद्दल, येणे/चालू व्याज, दंड व खाते समायोजन पावती प्रणाली
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {selectedAccount && (
                        <button
                            type="button"
                            onClick={() => setShowInstallmentModal(true)}
                            className="px-2.5 py-1 rounded-sm bg-primary/10 hover:bg-primary hover:text-white text-primary border border-primary/25 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="कर्ज हप्ता परतफेड वेळापत्रक चार्ट पहा"
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>हप्ता वेळापत्रक</span>
                            {accountDetails?.schedule && accountDetails.schedule.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-sm bg-white/90 text-primary font-mono text-[10px] font-bold border border-primary/20">
                                    {accountDetails.schedule.length}
                                </span>
                            )}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowReceiptsModal(true)}
                        className="px-2.5 py-1 rounded-sm bg-white hover:bg-slate-50 text-gray-700 border border-gray-300 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>सर्व जमापावती</span>
                        <span className="px-1.5 py-0.2 rounded-sm bg-primary/10 text-primary font-mono text-[10px] font-bold">
                            {collections.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => fetchData(selectedBranchId)}
                        className="p-1.5 rounded-sm bg-white hover:bg-slate-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer shadow-2xs"
                        title="माहिती ताजी करा (Refresh)"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Passing Mode Maker-Checker Verification Strip */}
            {isPassingMode && (
                <div className="p-2.5 bg-amber-50/90 border border-amber-300 border-l-4 border-l-amber-600 rounded-sm shadow-2xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-sm bg-amber-100 text-amber-800 border border-amber-300">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-bold text-xs text-amber-950 flex items-center gap-2">
                                <span>व्हाउचर तपासणी व मंजुरी मोड (Maker-Checker Passing)</span>
                                <span className="bg-amber-200/80 text-amber-900 text-[10px] px-2 py-0.5 rounded-sm font-bold border border-amber-300">
                                    फक्त वाचन (Read-Only)
                                </span>
                            </div>
                            <div className="text-[11px] text-amber-900 flex flex-wrap items-center gap-3 mt-0.5">
                                <span>पावती / व्हाउचर क्र.: <strong className="font-mono">{passingVoucher?.voucherNo || formData.receiptNo || '-'}</strong></span>
                                {passingVoucher?.scrollNo && <span>स्क्रोल क्र.: <strong className="font-mono">{passingVoucher.scrollNo}</strong></span>}
                                {passingVoucher?.createdByUser?.username && (
                                    <span>नोंद करणारा (Maker): <strong>{passingVoucher.createdByUser.username}</strong></span>
                                )}
                                <span>जमा रक्कम: <strong className="font-mono text-emerald-800">₹{(formData.totalAmountReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => onNavigate ? onNavigate('voucher-posting') : window.location.href = '/?tab=voucher-posting'}
                            className="bg-white hover:bg-slate-100 text-gray-700 border border-gray-300 text-[11px] font-bold px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>मागे जा</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setRejectModalOpen(true)}
                            disabled={passingActionLoading}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>रिजेक्ट करा</span>
                        </button>
                        <button
                            type="button"
                            onClick={handlePassVoucher}
                            disabled={passingActionLoading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1 rounded-sm shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{passingActionLoading ? 'पास होत आहे...' : 'पावती पास करा (Approve)'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* No Loan Found Alert */}
            {noLoanFoundAlert && (
                <div className="p-2.5 bg-amber-50 text-amber-900 rounded-sm border border-amber-300 flex items-center justify-between text-xs shadow-2xs">
                    <div className="flex items-center gap-2 font-semibold">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{noLoanFoundAlert}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setNoLoanFoundAlert(null)}
                        className="text-amber-800 hover:text-amber-950 p-0.5 cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* 2. MAIN 12-COLUMN CBS WORKSPACE: LEFT ENTRY FORM (8) + RIGHT LOAN & DUES PANEL (4) */}
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
                    {/* LEFT 8 COLUMNS: LOAN COLLECTION ENTRY CARD */}
                    <div className="lg:col-span-8 bg-white rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary flex flex-col overflow-visible">
                        {/* Card Top Strip: Title + Receipt No + Inline Today Recovery Pills */}
                        <div className="px-3.5 py-2 bg-slate-50/80 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="border-l-4 border-primary pl-2 text-primary font-bold text-xs">
                                    वसुली पावती नोंद (Collection Entry)
                                </span>
                                <span className="px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-primary font-mono text-[10.5px] font-bold">
                                    पावती क्र.: {formData.receiptNo || 'Auto'}
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                                <span className="px-2 py-0.5 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                                    आज रोख: <b className="font-mono">₹{todayTotalCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                </span>
                                <span className="px-2 py-0.5 rounded-sm bg-primary/5 border border-primary/20 text-primary font-semibold">
                                    आज बँक/इतर: <b className="font-mono">₹{todayTotalBank.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                </span>
                                <span className="px-2 py-0.5 rounded-sm bg-white border border-gray-300 text-gray-800 font-bold">
                                    आज एकूण: <b className="font-mono text-primary">₹{(todayTotalCash + todayTotalBank).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                </span>
                                {!isPassingMode && (
                                    <button
                                        type="button"
                                        onClick={handleResetForm}
                                        className="px-2 py-0.5 rounded-sm bg-white hover:bg-slate-100 text-gray-700 border border-gray-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                        title="फॉर्म रिकामा करा (Reset)"
                                    >
                                        <RotateCcw className="w-3 h-3 text-primary" />
                                        <span>रीसेट</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-3.5 space-y-3">
                            {/* STEP 1: Loan Scheme & Borrower Customer Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                <div className="md:col-span-4">
                                    <label className={`${labelClass} text-primary flex items-center gap-1`}>
                                        <Layers className="w-3 h-3 text-primary" />
                                        <span>१. कर्ज प्रकार / योजना <span className="text-rose-600">*</span></span>
                                    </label>
                                    <select
                                        value={effectiveSchemeId ? effectiveSchemeId.toString() : ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            handleSchemeChange(val ? parseInt(val) : null);
                                        }}
                                        disabled={isPassingMode}
                                        className={`${inputClass} font-semibold ${effectiveSchemeId ? 'bg-primary/5 border-primary text-primary font-bold' : ''}`}
                                    >
                                        <option value="">-- कर्ज प्रकार निवडा --</option>
                                        {availableLoanSchemes.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-8">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                                            <span>२. कर्जदार खातेदार निवडा <span className="text-rose-600">*</span></span>
                                            {selectedSchemeId && (
                                                <span className="text-[10px] font-semibold text-gray-500">
                                                    ({borrowerCustomers.length} कर्जदार)
                                                </span>
                                            )}
                                        </label>

                                        {totalMatchingLoansCount > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (customerMatchingLoans.length <= 1 && borrowerLoans.length > 1) {
                                                        setCustomerMatchingLoans(borrowerLoans);
                                                    }
                                                    setShowMultiLoanModal(true);
                                                }}
                                                className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/25 px-2 py-0.2 rounded-sm flex items-center gap-1 transition-all cursor-pointer"
                                                title="खातेदाराच्या इतर कर्ज खात्यांची यादी उघडा"
                                            >
                                                <Layers className="w-3 h-3 text-primary" />
                                                <span>खाते बदला ({totalMatchingLoansCount} खाती)</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="relative z-30">
                                        <CustomerSearchSelect
                                            customers={borrowerCustomers}
                                            value={selectedCustomerId || ''}
                                            onChange={handleCustomerSelect}
                                            isDisabled={isPassingMode || !effectiveSchemeId}
                                            placeholder={!effectiveSchemeId ? "-- आधी कर्ज प्रकार निवडा --" : "-- नाव, जुने कर्ज क्र., CIF किंवा मोबाईलने शोधा --"}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Compact 1-Click Loan Switcher Strip when Borrower has >1 Loans in Scheme */}
                            {borrowerLoans.length > 1 && (
                                <div className="p-2.5 bg-slate-50/90 rounded-sm border border-gray-200 border-l-4 border-l-primary space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold text-primary flex items-center gap-1.5">
                                            <CreditCard className="w-3.5 h-3.5" />
                                            <span>
                                                {selectedAccount
                                                    ? `या योजनेत खातेदाराची ${borrowerLoans.length} कर्ज खाती उपलब्ध आहेत:`
                                                    : `कृपया वसुलीसाठी खालील ${borrowerLoans.length} कर्ज खात्यांपैकी एक खाते निवडा:`}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {borrowerLoans.map((acc: LoanAccount) => {
                                            const isSelected = selectedAccount?.loanAccountID === acc.loanAccountID;
                                            return (
                                                <button
                                                    key={acc.loanAccountID}
                                                    type="button"
                                                    onClick={() => selectLoanAccountById(acc.loanAccountID)}
                                                    className={`px-2.5 py-1.5 rounded-sm border text-left transition-all cursor-pointer flex items-center gap-2 text-[11px] ${
                                                        isSelected
                                                            ? 'bg-primary text-white border-primary shadow-2xs font-bold'
                                                            : 'bg-white hover:bg-primary/5 text-gray-800 border-gray-300'
                                                    }`}
                                                >
                                                    <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-gray-300'}`} />
                                                    <div>
                                                        <div className="font-mono font-bold leading-tight">
                                                            {format14DigitDisplay(acc.loanAccountNo)}
                                                            {acc.legacyAccountNumber && (
                                                                <span className={`ml-1.5 px-1.5 py-0.2 rounded-sm text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                                                    जुना: {acc.legacyAccountNumber}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/90' : 'text-gray-500'}`}>
                                                            मुद्दल बाकी: <b>₹{(acc.principalBalance || 0).toLocaleString('en-IN')}</b>
                                                            {acc.installmentAmount > 0 && ` | हप्ता: ₹${(acc.installmentAmount || 0).toLocaleString('en-IN')}`}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Cross-Branch Compact Alert */}
                            {selectedAccount && selectedAccount.branchID && selectedAccount.branchID !== selectedBranchId && (
                                <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-sm text-amber-900 text-[11px] flex items-center gap-2">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>
                                        <b>आंतर-शाखा वसुली (Cross-Branch):</b> मूळ शाखा <b>{selectedAccount.branch?.branchName || `#${selectedAccount.branchID}`}</b> — जमा रोकड <b>{activeBranchObj?.branchName || `#${selectedBranchId}`}</b> च्या गल्ल्यात नोंदवली जाईल.
                                    </span>
                                </div>
                            )}

                            {/* STEP 2: Date, Payment Mode & Remarks */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-start">
                                <div className="md:col-span-3">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="text-[11px] font-bold text-gray-700">
                                            दिनांक (Date) <span className="text-rose-600">*</span>
                                        </label>
                                        {isHOUser && !isPassingMode ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = !allowDateOverride;
                                                    setAllowDateOverride(next);
                                                    if (!next) {
                                                        setFormData(p => ({ ...p, collectionDate: activeBusinessDate }));
                                                    }
                                                }}
                                                className={`inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.2 rounded-sm border cursor-pointer ${
                                                    allowDateOverride
                                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                        : 'bg-slate-100 text-gray-600 border-gray-300 hover:bg-slate-200'
                                                }`}
                                                title="तारीख बदलण्याची परवानगी (HO Override)"
                                            >
                                                {allowDateOverride ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                                <span>{allowDateOverride ? 'बदला' : 'लॉक'}</span>
                                            </button>
                                        ) : (
                                            <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-sm border border-emerald-200">
                                                <Lock className="w-2.5 h-2.5" /> लॉक
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="date"
                                        name="collectionDate"
                                        value={formData.collectionDate || activeBusinessDate}
                                        onChange={(e) => setFormData(p => ({ ...p, collectionDate: e.target.value }))}
                                        required
                                        disabled={isPassingMode || !allowDateOverride}
                                        readOnly={!allowDateOverride}
                                        className={`${inputClass} font-mono font-bold ${(!allowDateOverride || isPassingMode) ? 'bg-slate-100 text-slate-800 cursor-not-allowed select-none' : 'border-amber-400 bg-amber-50/30'}`}
                                    />
                                    {allowDateOverride && formData.collectionDate !== activeBusinessDate && (
                                        <p className="text-[9.5px] text-amber-700 font-semibold mt-0.5">
                                            लॉगिन तारीख: {activeBusinessDate}
                                        </p>
                                    )}
                                </div>

                                <div className="md:col-span-4">
                                    <label className={labelClass}>
                                        पेमेंट पद्धत (Mode) <span className="text-rose-600">*</span>
                                    </label>
                                    <select
                                        name="paymentMode"
                                        value={formData.paymentMode}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const isBankOrCheque = val === 'Bank' || val === 'Cheque';
                                            setFormData(p => ({
                                                ...p,
                                                paymentMode: val,
                                                ...(!isBankOrCheque
                                                    ? { bankAccountLedgerID: undefined, bankName: undefined, chequeNo: undefined }
                                                    : val !== 'Cheque'
                                                        ? { chequeNo: undefined }
                                                        : {})
                                            }));
                                            if (val === 'Pigmy Transfer' && selectedCustomerId) {
                                                fetchCustomerPigmyAccounts(selectedCustomerId);
                                            }
                                            if (val === 'Saving Transfer' && selectedCustomerId) {
                                                fetchCustomerSavingAccounts(selectedCustomerId);
                                            }
                                        }}
                                        disabled={isPassingMode}
                                        className={`${inputClass} font-bold`}
                                    >
                                        <option value="Cash">रोख (Cash)</option>
                                        <option value="Bank">बँक ट्रान्सफर (Bank)</option>
                                        <option value="Cheque">चेक (Cheque)</option>
                                        <option value="Saving Transfer">बचत खाते वर्ग (Saving Transfer)</option>
                                        <option value="Pigmy Transfer">पिग्मी ठेव वर्ग (Pigmy Transfer)</option>
                                    </select>
                                </div>

                                <div className="sm:col-span-2 md:col-span-5">
                                    <label className={labelClass}>तपशील / शेरा (Remarks)</label>
                                    <input
                                        type="text"
                                        value={formData.remarks || ''}
                                        onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))}
                                        disabled={isPassingMode}
                                        className={inputClass}
                                        placeholder="हप्ता / पावती संदर्भात शेरा..."
                                    />
                                </div>
                            </div>

                            {/* Conditional Bank / Cheque Sub-Panel */}
                            {(formData.paymentMode === 'Bank' || formData.paymentMode === 'Cheque') && (
                                <div className="p-2.5 bg-slate-50/90 rounded-sm border border-gray-200 border-l-4 border-l-primary grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                    <div className={formData.paymentMode === 'Cheque' ? 'md:col-span-8' : 'md:col-span-12'}>
                                        <label className={labelClass}>
                                            बँक जी.एल. खाते निवडा (Bank GL Account) <span className="text-rose-600">*</span>
                                        </label>
                                        <BankLedgerSelect
                                            name="bankAccountLedgerID"
                                            ledgers={ledgers}
                                            value={formData.bankAccountLedgerID}
                                            hideLabel
                                            placeholder="-- बँक जी.एल. खाते निवडा (खाते क्र. / नाव) --"
                                            disabled={isPassingMode}
                                            onChange={(ledgerId) => {
                                                const selectedBank = bankLedgers.find(l => Number(l.ledgerID) === Number(ledgerId));
                                                setFormData(p => ({
                                                    ...p,
                                                    bankAccountLedgerID: ledgerId > 0 ? ledgerId : undefined,
                                                    bankName: selectedBank ? selectedBank.ledgerName : undefined
                                                }));
                                            }}
                                        />
                                    </div>
                                    {formData.paymentMode === 'Cheque' && (
                                        <div className="md:col-span-4">
                                            <label className={labelClass}>
                                                चेक क्रमांक (Cheque No) <span className="text-rose-600">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.chequeNo || ''}
                                                onChange={(e) => setFormData(p => ({ ...p, chequeNo: e.target.value }))}
                                                placeholder="चेक क्र. टाका"
                                                disabled={isPassingMode}
                                                className={`${inputClass} font-mono font-bold`}
                                                required
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Conditional Pigmy Transfer Sub-Panel */}
                            {formData.paymentMode === 'Pigmy Transfer' && (
                                <div className="p-2.5 bg-slate-50/90 rounded-sm border border-gray-200 border-l-4 border-l-primary space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                                            <Coins className="w-3.5 h-3.5 text-primary" />
                                            <span>पिग्मी ठेव कर्ज समायोजन (Pigmy Transfer)</span>
                                        </span>
                                        <div className="inline-flex items-center p-0.5 bg-white border border-gray-300 rounded-sm gap-0.5 text-[10.5px]">
                                            <button
                                                type="button"
                                                disabled={isPassingMode}
                                                onClick={() => {
                                                    setPigmyAccountSourceType('SELF');
                                                    if (customerPigmyAccounts.length > 0) {
                                                        const acc = customerPigmyAccounts[0];
                                                        setSelectedPigmyAccount(acc);
                                                        setFormData(p => ({
                                                            ...p,
                                                            sourcePigmyAccountID: acc.pigmyAccountID,
                                                            transferFromPigmyAccountNo: acc.accountNo
                                                        }));
                                                    } else {
                                                        setSelectedPigmyAccount(null);
                                                        setFormData(p => ({
                                                            ...p,
                                                            sourcePigmyAccountID: undefined,
                                                            transferFromPigmyAccountNo: undefined
                                                        }));
                                                    }
                                                }}
                                                className={`px-2.5 py-0.5 rounded-sm font-bold transition-colors cursor-pointer ${
                                                    pigmyAccountSourceType === 'SELF' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                स्वतःचे पिग्मी खाते
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isPassingMode}
                                                onClick={() => {
                                                    setPigmyAccountSourceType('OTHER');
                                                    setSelectedPigmyAccount(null);
                                                    setFormData(p => ({
                                                        ...p,
                                                        sourcePigmyAccountID: undefined,
                                                        transferFromPigmyAccountNo: undefined
                                                    }));
                                                }}
                                                className={`px-2.5 py-0.5 rounded-sm font-bold transition-colors cursor-pointer ${
                                                    pigmyAccountSourceType === 'OTHER' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                इतर खाते / जुना क्र. शोधा
                                            </button>
                                        </div>
                                    </div>

                                    {loadingPigmyAccounts && (
                                        <div className="text-[10.5px] text-gray-500 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3 animate-spin text-primary" /> पिग्मी खाती लोड होत आहेत...
                                        </div>
                                    )}

                                    {pigmyAccountSourceType === 'SELF' ? (
                                        customerPigmyAccounts.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                                                <div className="md:col-span-6">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <label className="text-[11px] font-bold text-gray-700">
                                                            पिग्मी खाते निवडा <span className="text-rose-600">*</span>
                                                        </label>
                                                        {customerPigmyAccounts.length > 1 && (
                                                            <input
                                                                type="text"
                                                                placeholder="जुना क्र. फिल्टर..."
                                                                value={pigmyOldAccSearchQuery}
                                                                onChange={(e) => {
                                                                    const q = e.target.value;
                                                                    setPigmyOldAccSearchQuery(q);
                                                                    if (q.trim()) {
                                                                        const matched = customerPigmyAccounts.find(a =>
                                                                            (a.oldAccountNo && a.oldAccountNo.toLowerCase().includes(q.toLowerCase())) ||
                                                                            (a.legacyAccountNumber && a.legacyAccountNumber.toLowerCase().includes(q.toLowerCase())) ||
                                                                            (a.previousAccountNo && a.previousAccountNo.toLowerCase().includes(q.toLowerCase())) ||
                                                                            (a.accountNo && a.accountNo.includes(q))
                                                                        );
                                                                        if (matched) {
                                                                            setSelectedPigmyAccount(matched);
                                                                            setFormData(p => ({
                                                                                ...p,
                                                                                sourcePigmyAccountID: matched.pigmyAccountID,
                                                                                transferFromPigmyAccountNo: matched.accountNo
                                                                            }));
                                                                        }
                                                                    }
                                                                }}
                                                                className="text-[10px] px-1.5 py-0.2 border border-gray-300 rounded-sm focus:border-primary focus:outline-none w-24 bg-white"
                                                            />
                                                        )}
                                                    </div>
                                                    <select
                                                        value={formData.sourcePigmyAccountID || ''}
                                                        disabled={isPassingMode || loadingPigmyAccounts}
                                                        onChange={(e) => {
                                                            const accId = parseInt(e.target.value);
                                                            const acc = customerPigmyAccounts.find(a => a.pigmyAccountID === accId);
                                                            setSelectedPigmyAccount(acc || null);
                                                            setFormData(p => ({
                                                                ...p,
                                                                sourcePigmyAccountID: accId || undefined,
                                                                transferFromPigmyAccountNo: acc ? acc.accountNo : undefined
                                                            }));
                                                        }}
                                                        className={`${inputClass} font-semibold`}
                                                        required
                                                    >
                                                        <option value="">-- पिग्मी खाते निवडा --</option>
                                                        {customerPigmyAccounts.map(a => {
                                                            const oldNo = a.oldAccountNo || a.legacyAccountNumber || a.previousAccountNo;
                                                            return (
                                                                <option key={a.pigmyAccountID} value={a.pigmyAccountID}>
                                                                    {format14DigitDisplay(a.accountNo)} {oldNo ? `[जुना: ${oldNo}]` : ''} - {a.pigmyScheme?.schemeName || 'दैनिक ठेव'} (₹{(a.totalDepositedAmount || 0).toLocaleString('en-IN')})
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>

                                                {selectedPigmyAccount && (
                                                    <div className="md:col-span-6 flex flex-wrap gap-1.5 text-[10.5px] items-center pb-0.5">
                                                        {(selectedPigmyAccount.oldAccountNo || selectedPigmyAccount.legacyAccountNumber || selectedPigmyAccount.previousAccountNo) && (
                                                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-sm border border-primary/20 font-bold font-mono">
                                                                जुना: {selectedPigmyAccount.oldAccountNo || selectedPigmyAccount.legacyAccountNumber || selectedPigmyAccount.previousAccountNo}
                                                            </span>
                                                        )}
                                                        <span className="bg-white px-2 py-0.5 rounded-sm border border-gray-300 text-gray-700 font-semibold">
                                                            ठेव: <b className="font-mono text-gray-900">₹{(selectedPigmyAccount.totalDepositedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                                        </span>
                                                        <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-sm border border-emerald-300 font-bold">
                                                            वर्गपात्र: <b className="font-mono text-emerald-700">₹{Math.max(0, (selectedPigmyAccount.totalDepositedAmount || 0) - (selectedPigmyAccount.isLienMarked ? (selectedPigmyAccount.lienAmount || 0) : 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-sm text-[11px] text-amber-900">
                                                <span>या कर्जदाराचे सक्रिय पिग्मी खाते आढळले नाही.</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setPigmyAccountSourceType('OTHER')}
                                                    className="text-primary font-bold underline cursor-pointer"
                                                >
                                                    इतर खाते शोधा
                                                </button>
                                            </div>
                                        )
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                                            <div className="md:col-span-5">
                                                <label className={labelClass}>जुना पिग्मी क्र. / नाव / मोबाईल शोधा</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={pigmyOldAccSearchQuery}
                                                        onChange={(e) => {
                                                            const q = e.target.value;
                                                            setPigmyOldAccSearchQuery(q);
                                                            searchOtherPigmyAccounts(q);
                                                        }}
                                                        placeholder="उदा. 104, नाव किंवा मोबाईल..."
                                                        disabled={isPassingMode}
                                                        className={`${inputClass} pr-7`}
                                                    />
                                                    <Search className="w-3.5 h-3.5 absolute right-2 top-2 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>

                                            {otherPigmySearchResults.length > 0 && !selectedPigmyAccount && (
                                                <div className="md:col-span-7">
                                                    <label className={`${labelClass} text-primary`}>
                                                        शोध निकाल ({otherPigmySearchResults.length} खाती)
                                                    </label>
                                                    <select
                                                        onChange={(e) => {
                                                            const accId = parseInt(e.target.value);
                                                            const acc = otherPigmySearchResults.find(a => a.pigmyAccountID === accId);
                                                            if (acc) {
                                                                setSelectedPigmyAccount(acc);
                                                                setFormData(p => ({
                                                                    ...p,
                                                                    sourcePigmyAccountID: acc.pigmyAccountID,
                                                                    transferFromPigmyAccountNo: acc.accountNo
                                                                }));
                                                            }
                                                        }}
                                                        defaultValue=""
                                                        className={`${inputClass} border-primary font-semibold`}
                                                    >
                                                        <option value="" disabled>-- पिग्मी खाते निवडा --</option>
                                                        {otherPigmySearchResults.map(a => {
                                                            const oldNo = a.oldAccountNo || a.legacyAccountNumber || a.previousAccountNo;
                                                            const custName = a.customerName || (a.customer ? `${a.customer.firstName || ''} ${a.customer.lastName || ''}`.trim() : '');
                                                            return (
                                                                <option key={a.pigmyAccountID} value={a.pigmyAccountID}>
                                                                    {format14DigitDisplay(a.accountNo)} {oldNo ? `[जुना: ${oldNo}]` : ''} - {custName} (₹{(a.totalDepositedAmount || 0).toLocaleString('en-IN')})
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>
                                            )}

                                            {selectedPigmyAccount && (
                                                <div className="md:col-span-7 flex flex-wrap gap-1.5 text-[10.5px] items-center pb-0.5">
                                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-sm border border-primary/20 font-bold">
                                                        {selectedPigmyAccount.customerName || (selectedPigmyAccount.customer ? `${selectedPigmyAccount.customer.firstName || ''} ${selectedPigmyAccount.customer.lastName || ''}`.trim() : '')} ({format14DigitDisplay(selectedPigmyAccount.accountNo)})
                                                    </span>
                                                    <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-sm border border-emerald-300 font-bold">
                                                        वर्गपात्र: <b className="font-mono text-emerald-700">₹{Math.max(0, (selectedPigmyAccount.totalDepositedAmount || 0) - (selectedPigmyAccount.isLienMarked ? (selectedPigmyAccount.lienAmount || 0) : 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedPigmyAccount(null);
                                                            setFormData(p => ({
                                                                ...p,
                                                                sourcePigmyAccountID: undefined,
                                                                transferFromPigmyAccountNo: undefined
                                                            }));
                                                        }}
                                                        className="text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                                                    >
                                                        बदला
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Conditional Saving Transfer Sub-Panel */}
                            {formData.paymentMode === 'Saving Transfer' && (
                                <div className="p-2.5 bg-slate-50/90 rounded-sm border border-gray-200 border-l-4 border-l-primary space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                                            <Landmark className="w-3.5 h-3.5 text-primary" />
                                            <span>बचत ठेव कर्ज समायोजन (Saving Transfer)</span>
                                        </span>
                                        <div className="inline-flex items-center p-0.5 bg-white border border-gray-300 rounded-sm gap-0.5 text-[10.5px]">
                                            <button
                                                type="button"
                                                disabled={isPassingMode}
                                                onClick={() => {
                                                    setSavingAccountSourceType('SELF');
                                                    if (customerSavingAccounts.length > 0) {
                                                        const acc = customerSavingAccounts[0];
                                                        setSelectedSavingAccount(acc);
                                                        setFormData(p => ({
                                                            ...p,
                                                            sourceSavingAccountID: acc.savingAccountID,
                                                            transferFromSavingAccountNo: acc.accountNo,
                                                            savingCustomerName: acc.customerName || ''
                                                        }));
                                                    } else {
                                                        setSelectedSavingAccount(null);
                                                        setFormData(p => ({
                                                            ...p,
                                                            sourceSavingAccountID: undefined,
                                                            transferFromSavingAccountNo: undefined,
                                                            savingCustomerName: undefined
                                                        }));
                                                    }
                                                }}
                                                className={`px-2.5 py-0.5 rounded-sm font-bold transition-colors cursor-pointer ${
                                                    savingAccountSourceType === 'SELF' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                स्वतःचे बचत खाते
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isPassingMode}
                                                onClick={() => {
                                                    setSavingAccountSourceType('OTHER');
                                                    setSelectedSavingAccount(null);
                                                    setFormData(p => ({
                                                        ...p,
                                                        sourceSavingAccountID: undefined,
                                                        transferFromSavingAccountNo: undefined,
                                                        savingCustomerName: undefined
                                                    }));
                                                }}
                                                className={`px-2.5 py-0.5 rounded-sm font-bold transition-colors cursor-pointer ${
                                                    savingAccountSourceType === 'OTHER' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                इतर खातेदार / जामीनदार
                                            </button>
                                        </div>
                                    </div>

                                    {loadingSavingAccounts && (
                                        <div className="text-[10.5px] text-gray-500 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3 animate-spin text-primary" /> बचत खाती लोड होत आहेत...
                                        </div>
                                    )}

                                    {savingAccountSourceType === 'SELF' ? (
                                        customerSavingAccounts.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                                                <div className="md:col-span-6">
                                                    <label className={labelClass}>
                                                        बचत खाते निवडा <span className="text-rose-600">*</span>
                                                    </label>
                                                    <select
                                                        value={formData.sourceSavingAccountID || ''}
                                                        disabled={isPassingMode || loadingSavingAccounts}
                                                        onChange={(e) => {
                                                            const accId = parseInt(e.target.value);
                                                            const acc = customerSavingAccounts.find(a => a.savingAccountID === accId);
                                                            setSelectedSavingAccount(acc || null);
                                                            setFormData(p => ({
                                                                ...p,
                                                                sourceSavingAccountID: accId || undefined,
                                                                transferFromSavingAccountNo: acc ? acc.accountNo : undefined,
                                                                savingCustomerName: acc ? acc.customerName : undefined
                                                            }));
                                                        }}
                                                        className={`${inputClass} font-semibold`}
                                                        required
                                                    >
                                                        {customerSavingAccounts.map(a => (
                                                            <option key={a.savingAccountID} value={a.savingAccountID}>
                                                                {format14DigitDisplay(a.accountNo)} - {a.schemeName || 'बचत ठेव'} (₹{(a.currentBalance || 0).toLocaleString('en-IN')})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {selectedSavingAccount && (
                                                    <div className="md:col-span-6 flex flex-wrap gap-1.5 text-[10.5px] items-center pb-0.5">
                                                        <span className="bg-white px-2 py-0.5 rounded-sm border border-gray-300 text-gray-700 font-semibold">
                                                            शिल्लक: <b className="font-mono text-gray-900">₹{(selectedSavingAccount.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                                        </span>
                                                        {(selectedSavingAccount.minimumBalance || 0) > 0 && (
                                                            <span className="bg-white px-2 py-0.5 rounded-sm border border-gray-300 text-gray-600">
                                                                किमान: <b className="font-mono">₹{(selectedSavingAccount.minimumBalance || 0).toLocaleString('en-IN')}</b>
                                                            </span>
                                                        )}
                                                        <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-sm border border-emerald-300 font-bold">
                                                            वर्गपात्र: <b className="font-mono text-emerald-700">₹{Math.max(0, (selectedSavingAccount.currentBalance || 0) - (selectedSavingAccount.lienAmount || 0) - (selectedSavingAccount.minimumBalance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-sm text-[11px] text-amber-900">
                                                <span>या कर्जदाराचे सक्रिय बचत खाते आढळले नाही.</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setSavingAccountSourceType('OTHER')}
                                                    className="text-primary font-bold underline cursor-pointer"
                                                >
                                                    इतर बचत खाते शोधा
                                                </button>
                                            </div>
                                        )
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                                            <div className="md:col-span-5">
                                                <label className={labelClass}>इतर बचत खाते शोधा (खाते क्र. / नाव / CIF)</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={otherSavingSearchQuery}
                                                        onChange={(e) => {
                                                            const q = e.target.value;
                                                            setOtherSavingSearchQuery(q);
                                                            searchOtherSavingAccounts(q);
                                                        }}
                                                        placeholder="खाते क्र., नाव, मोबाईल किंवा CIF..."
                                                        disabled={isPassingMode}
                                                        className={`${inputClass} pr-7`}
                                                    />
                                                    <Search className="w-3.5 h-3.5 absolute right-2 top-2 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>

                                            {otherSavingSearchResults.length > 0 && !selectedSavingAccount && (
                                                <div className="md:col-span-7">
                                                    <label className={`${labelClass} text-primary`}>
                                                        शोध निकाल ({otherSavingSearchResults.length} खाती)
                                                    </label>
                                                    <select
                                                        onChange={(e) => {
                                                            const accId = parseInt(e.target.value);
                                                            const acc = otherSavingSearchResults.find(a => a.savingAccountID === accId);
                                                            if (acc) {
                                                                setSelectedSavingAccount(acc);
                                                                setFormData(p => ({
                                                                    ...p,
                                                                    sourceSavingAccountID: acc.savingAccountID,
                                                                    transferFromSavingAccountNo: acc.accountNo,
                                                                    savingCustomerName: acc.customerName || ''
                                                                }));
                                                            }
                                                        }}
                                                        defaultValue=""
                                                        className={`${inputClass} border-primary font-semibold`}
                                                    >
                                                        <option value="" disabled>-- बचत खाते निवडा --</option>
                                                        {otherSavingSearchResults.map(a => (
                                                            <option key={a.savingAccountID} value={a.savingAccountID}>
                                                                {format14DigitDisplay(a.accountNo)} - {a.customerName} (₹{(a.currentBalance || 0).toLocaleString('en-IN')})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {selectedSavingAccount && (
                                                <div className="md:col-span-7 flex flex-wrap gap-1.5 text-[10.5px] items-center pb-0.5">
                                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-sm border border-primary/20 font-bold">
                                                        {selectedSavingAccount.customerName} ({format14DigitDisplay(selectedSavingAccount.accountNo)})
                                                    </span>
                                                    <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-sm border border-emerald-300 font-bold">
                                                        वर्गपात्र: <b className="font-mono text-emerald-700">₹{Math.max(0, (selectedSavingAccount.currentBalance || 0) - (selectedSavingAccount.lienAmount || 0) - (selectedSavingAccount.minimumBalance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedSavingAccount(null);
                                                            setFormData(p => ({
                                                                ...p,
                                                                sourceSavingAccountID: undefined,
                                                                transferFromSavingAccountNo: undefined,
                                                                savingCustomerName: undefined
                                                            }));
                                                        }}
                                                        className="text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                                                    >
                                                        बदला
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 3: Amount & Allocation Split Panel */}
                            <div className="bg-slate-50/80 border border-gray-200 rounded-sm p-3 space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-gray-200">
                                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                        <Coins className="w-3.5 h-3.5 text-primary" />
                                        <span>३. रक्कम व वसुली विभागणी (Amount & Allocation)</span>
                                    </span>

                                    {selectedAccount && !isPassingMode && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => applyQuickAmount('1_INST')}
                                                className="px-2.5 py-1 text-[10.5px] font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/25 rounded-sm transition-colors flex items-center gap-1 cursor-pointer"
                                                title="१ हप्ता मुद्दल + सर्व व्याज व फी"
                                            >
                                                <Zap className="w-3 h-3" />
                                                <span>१ हप्ता</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyQuickAmount('INTEREST_ONLY')}
                                                className="px-2.5 py-1 text-[10.5px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white border border-emerald-300 rounded-sm transition-colors flex items-center gap-1 cursor-pointer"
                                                title="थकीत येणे व्याज + चालू व्याज + दंड"
                                            >
                                                <Zap className="w-3 h-3" />
                                                <span>फक्त व्याज</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => applyQuickAmount('FULL_DUE')}
                                                className="px-2.5 py-1 text-[10.5px] font-bold bg-amber-50 text-amber-900 hover:bg-amber-600 hover:text-white border border-amber-300 rounded-sm transition-colors flex items-center gap-1 cursor-pointer"
                                                title="संपूर्ण मुद्दल + सर्व व्याज + दंड (पूर्ण नील)"
                                            >
                                                <Zap className="w-3 h-3" />
                                                <span>पूर्ण नील</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Total Amount + 5 Split Inputs Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 items-end">
                                    <div>
                                        <label className="block text-[11px] font-bold text-primary mb-0.5">
                                            एकूण जमा (Total ₹) <span className="text-rose-600">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            name="totalAmountReceived"
                                            value={formData.totalAmountReceived || ''}
                                            onChange={handleTotalAmountChange}
                                            min="0"
                                            disabled={isPassingMode}
                                            placeholder="0.00"
                                            className={`w-full border-2 border-primary px-2 py-1 rounded-sm font-mono font-bold text-xs text-right h-[32px] focus:outline-none focus:ring-1 focus:ring-primary ${
                                                isPassingMode ? 'bg-slate-100 text-gray-700 cursor-not-allowed' : 'bg-white text-primary'
                                            }`}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>मुद्दल (Principal ₹)</label>
                                        <input
                                            type="number"
                                            name="principalCollected"
                                            value={formData.principalCollected !== undefined ? formData.principalCollected : ''}
                                            onChange={handleSplitChange}
                                            min="0"
                                            disabled={isPassingMode}
                                            placeholder="0.00"
                                            className={`${inputClass} h-[32px] text-right font-mono font-bold`}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="text-[11px] font-bold text-emerald-800">येणे व्याज</label>
                                            {duesSummary && duesSummary.yeneVyaj > 0 && (
                                                <span className="text-[9.5px] font-mono font-bold text-emerald-700">
                                                    ₹{duesSummary.yeneVyaj.toLocaleString('en-IN')}
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            name="receivableInterestCollected"
                                            value={formData.receivableInterestCollected !== undefined ? formData.receivableInterestCollected : ''}
                                            onChange={handleSplitChange}
                                            min="0"
                                            disabled={isPassingMode}
                                            placeholder="0.00"
                                            className={`${inputClass} h-[32px] text-right font-mono font-bold border-emerald-300 text-emerald-900 bg-emerald-50/40 focus:border-emerald-600`}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="text-[11px] font-bold text-gray-700">चालू व्याज</label>
                                            {duesSummary && duesSummary.days > 0 && (
                                                <span className="text-[9.5px] font-mono font-semibold text-gray-500">
                                                    {duesSummary.days} दि.
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            name="interestCollected"
                                            value={formData.interestCollected !== undefined ? formData.interestCollected : ''}
                                            onChange={handleSplitChange}
                                            min="0"
                                            disabled={isPassingMode}
                                            placeholder="0.00"
                                            className={`${inputClass} h-[32px] text-right font-mono font-semibold`}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="text-[11px] font-bold text-gray-700">जादा/दंड व्याज</label>
                                            {duesSummary && duesSummary.dandVyaj > 0 && (
                                                <span className="text-[9.5px] font-mono font-bold text-rose-600">
                                                    ₹{duesSummary.dandVyaj.toLocaleString('en-IN')}
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            name="penaltyInterestCollected"
                                            value={formData.penaltyInterestCollected !== undefined ? formData.penaltyInterestCollected : ''}
                                            onChange={handleSplitChange}
                                            min="0"
                                            disabled={isPassingMode}
                                            placeholder="0.00"
                                            className={`${inputClass} h-[32px] text-right font-mono font-semibold`}
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>सरचार्ज (₹)</label>
                                        <input
                                            type="number"
                                            name="surchargeCollected"
                                            value={formData.surchargeCollected !== undefined ? formData.surchargeCollected : ''}
                                            onChange={handleSplitChange}
                                            min="0"
                                            disabled={isPassingMode}
                                            placeholder="0.00"
                                            className={`${inputClass} h-[32px] text-right font-mono font-semibold`}
                                        />
                                    </div>
                                </div>

                                {/* Compact Optional Toggles Row: Other Fee Ledgers & OTS Waiver */}
                                <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                    <div className="flex items-center gap-2">
                                        {!isPassingMode && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!showFeesPanel && (!formData.fees || formData.fees.length === 0)) {
                                                        setShowFeesPanel(true);
                                                        addFeeRow();
                                                    } else if (formData.fees && formData.fees.length > 0) {
                                                        addFeeRow();
                                                    } else {
                                                        setShowFeesPanel(prev => !prev);
                                                    }
                                                }}
                                                className="text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                            >
                                                <PlusCircle className="w-3.5 h-3.5" />
                                                <span>इतर वसूल खाते / फी जोडा</span>
                                            </button>
                                        )}
                                        {formData.fees && formData.fees.length > 0 && (
                                            <span className="px-1.5 py-0.2 rounded-sm bg-primary/10 text-primary font-mono text-[10px] font-bold">
                                                {formData.fees.length} फी खाते
                                            </span>
                                        )}
                                    </div>

                                    <label className="flex items-center gap-1.5 cursor-pointer select-none font-semibold text-amber-900">
                                        <input
                                            type="checkbox"
                                            checked={formData.isOTS || false}
                                            onChange={(e) => setFormData(p => ({ ...p, isOTS: e.target.checked }))}
                                            disabled={isPassingMode}
                                            className="w-3.5 h-3.5 rounded-sm accent-primary cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <Award className="w-3.5 h-3.5 text-amber-700" />
                                        <span>एकरकमी तडजोड (OTS) / व्याज सूट सवलत</span>
                                    </label>
                                </div>

                                {/* Expanded Dynamic Fee Rows (Only when fees exist or toggled) */}
                                {(showFeesPanel || (formData.fees && formData.fees.length > 0)) && (
                                    <div className="p-2 bg-white rounded-sm border border-gray-200 space-y-1.5">
                                        <div className="flex items-center justify-between text-[10.5px] font-bold text-gray-600">
                                            <span>इतर वसूल खाते तपशील (Other Fee Ledgers)</span>
                                            {(!formData.fees || formData.fees.length === 0) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowFeesPanel(false)}
                                                    className="text-gray-400 hover:text-gray-700 cursor-pointer"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        {formData.fees?.map((fee, index) => (
                                            <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-8">
                                                    <select
                                                        value={fee.ledgerID}
                                                        onChange={(e) => handleFeeChange(index, 'ledgerID', e.target.value)}
                                                        disabled={isPassingMode}
                                                        className={inputClass}
                                                    >
                                                        <option value="0">-- इतर वसूल खाते निवडा --</option>
                                                        {ledgers.map(l => (
                                                            <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        type="number"
                                                        value={fee.amount || ''}
                                                        onChange={(e) => handleFeeChange(index, 'amount', e.target.value)}
                                                        min="0"
                                                        placeholder="रक्कम ₹"
                                                        disabled={isPassingMode}
                                                        className={`${inputClass} text-right font-mono font-bold`}
                                                    />
                                                </div>
                                                <div className="col-span-1 text-center">
                                                    {!isPassingMode && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                removeFeeRow(index);
                                                                if ((formData.fees?.length || 0) <= 1) {
                                                                    setShowFeesPanel(false);
                                                                }
                                                            }}
                                                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                                                            title="हटवा"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Expanded OTS & Interest Waiver Panel (Only when ticked or waiver > 0) */}
                                {(formData.isOTS || (formData.interestWaived && formData.interestWaived > 0) || (formData.penaltyWaived && formData.penaltyWaived > 0)) && (
                                    <div className="p-2.5 bg-amber-50/90 rounded-sm border border-amber-300 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div>
                                            <label className="block text-[10.5px] font-bold text-amber-900 mb-0.5">
                                                माफ करावयाचे व्याज (Waived ₹)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.interestWaived || ''}
                                                onChange={(e) => setFormData(p => ({ ...p, interestWaived: parseFloat(e.target.value) || 0 }))}
                                                disabled={isPassingMode}
                                                placeholder="0.00"
                                                className={`${inputClass} border-amber-300 font-mono font-bold text-amber-950 text-right`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10.5px] font-bold text-amber-900 mb-0.5">
                                                माफ दंड व्याज (Penalty Waived ₹)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.penaltyWaived || ''}
                                                onChange={(e) => setFormData(p => ({ ...p, penaltyWaived: parseFloat(e.target.value) || 0 }))}
                                                disabled={isPassingMode}
                                                placeholder="0.00"
                                                className={`${inputClass} border-amber-300 font-mono font-bold text-amber-950 text-right`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10.5px] font-bold text-amber-900 mb-0.5">
                                                संचालक मंडळ ठराव क्र. <span className="text-rose-600">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.resolutionNo || ''}
                                                onChange={(e) => setFormData(p => ({ ...p, resolutionNo: e.target.value }))}
                                                disabled={isPassingMode}
                                                placeholder="उदा. BR-2026/45"
                                                required
                                                className={`${inputClass} border-amber-300 font-bold text-amber-950`}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* STEP 4: Clean Horizontal Footer Action Bar */}
                            <div className="pt-2.5 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="px-2.5 py-1 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold">
                                        पावती एकूण: <b className="font-mono text-emerald-700">₹{(formData.totalAmountReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                    </span>
                                    {duesSummary && (
                                        <span className="px-2.5 py-1 rounded-sm bg-primary/5 border border-primary/20 text-gray-800 font-semibold">
                                            नवीन मुद्दल बाकी: <b className="font-mono text-primary">₹{duesSummary.shillakKarjRakkam.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                                        </span>
                                    )}
                                </div>

                                {isPassingMode ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={handlePrintClick}
                                            className="px-3 py-1.5 rounded-sm bg-white hover:bg-slate-50 text-gray-700 border border-gray-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Printer className="w-3.5 h-3.5 text-primary" />
                                            <span>प्रिंट पूर्वावलोकन</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRejectModalOpen(true)}
                                            disabled={passingActionLoading}
                                            className="px-3 py-1.5 rounded-sm bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>पावती रिजेक्ट करा</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handlePassVoucher}
                                            disabled={passingActionLoading}
                                            className="px-4 py-1.5 rounded-sm bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            <span>{passingActionLoading ? 'पास होत आहे...' : 'पावती पास करा (Approve)'}</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={handleResetForm}
                                            className="px-3 py-1.5 rounded-sm bg-white hover:bg-slate-50 text-gray-700 border border-gray-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <PlusCircle className="w-3.5 h-3.5 text-gray-600" />
                                            <span>नवीन पावती</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (lastSavedCollectionId) {
                                                    const found = collections.find(c => c.loanCollectionID === lastSavedCollectionId);
                                                    if (found) handleDirectWhatsAppShare(found);
                                                    else alert('पावती सापडली नाही.');
                                                } else {
                                                    alert('कृपया आधी जमा माहिती जतन (Save) करा.');
                                                }
                                            }}
                                            className="px-3 py-1.5 rounded-sm bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Share2 className="w-3.5 h-3.5" />
                                            <span>WhatsApp</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handlePrintClick}
                                            className="px-3 py-1.5 rounded-sm bg-white hover:bg-slate-50 text-primary border border-primary/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Printer className="w-3.5 h-3.5" />
                                            <span>प्रिंट</span>
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className={`px-5 py-1.5 rounded-sm bg-primary hover:opacity-90 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                                                isSaving ? 'opacity-70 cursor-not-allowed' : ''
                                            }`}
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Clock className="w-3.5 h-3.5 animate-spin" />
                                                    <span>जतन होत आहे...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-3.5 h-3.5" />
                                                    <span>जतन करा (Save)</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT 4 COLUMNS: CONSOLIDATED LOAN ACCOUNT & DUES PANEL */}
                    <div className="lg:col-span-4 bg-white rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary flex flex-col overflow-hidden">
                        {/* Card Strip */}
                        <div className="px-3.5 py-2 bg-slate-50/80 border-b border-gray-200 flex items-center justify-between gap-2">
                            <span className="border-l-4 border-primary pl-2 text-primary font-bold text-xs">
                                कर्ज खाते स्थिती व थकबाकी (Loan & Dues)
                            </span>
                            {npaStatus && (
                                <span
                                    className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border ${
                                        npaStatus.category === 'Standard'
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                            : 'bg-rose-50 text-rose-800 border-rose-300'
                                    }`}
                                >
                                    {npaStatus.categoryMarathi}
                                </span>
                            )}
                        </div>

                        {selectedAccount && duesSummary ? (
                            <div className="p-3 space-y-2.5">
                                {/* 1. Account Identity Box */}
                                <div className="p-2.5 rounded-sm bg-primary/5 border border-primary/20 space-y-1.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="text-xs font-bold text-gray-900 leading-snug">
                                                {selectedBorrowerName}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10.5px]">
                                                <span className="font-mono font-bold text-primary">
                                                    {format14DigitDisplay(selectedAccount.loanAccountNo)}
                                                </span>
                                                {selectedBorrowerCif && (
                                                    <span className="px-1.5 py-0.2 rounded-sm bg-white border border-gray-300 text-gray-600 font-mono text-[10px] font-semibold">
                                                        CIF: {selectedBorrowerCif}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {selectedAccount.legacyAccountNumber && (
                                            <span className="px-2 py-0.5 rounded-sm bg-white border border-primary/30 text-primary font-mono text-[10.5px] font-bold shrink-0 shadow-2xs">
                                                जुना क्र.: {selectedAccount.legacyAccountNumber}
                                            </span>
                                        )}
                                    </div>

                                    <div className="pt-1.5 border-t border-primary/15 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-gray-700">
                                        <span>
                                            योजना: <b className="text-gray-900">{selectedAccount.loanRate?.shortName || selectedAccount.loanRate?.loanType || '-'}</b>
                                        </span>
                                        <span>
                                            दर: <b className="font-mono text-primary">{duesSummary.interestRate.toFixed(2)}%</b>
                                        </span>
                                        <span>
                                            पद्धत: <b>{selectedAccount.loanRate?.interestCalculationMethod || 'Daily Reducing'}</b>
                                        </span>
                                        {selectedAccount.branch?.branchName && (
                                            <span>
                                                शाखा: <b>{selectedAccount.branch.branchName}</b>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 2. Four Key KPI Tiles (2x2 Grid) */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 rounded-sm bg-slate-50 border border-gray-200">
                                        <div className="text-[10px] font-bold text-gray-500">चालू मुद्दल बाकी</div>
                                        <div className="text-sm font-black font-mono text-gray-900 mt-0.5">
                                            ₹{duesSummary.yeneBaki.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    <div className="p-2 rounded-sm bg-amber-50/80 border border-amber-300">
                                        <div className="text-[10px] font-bold text-amber-900">आज एकूण देय रक्कम</div>
                                        <div className="text-sm font-black font-mono text-amber-950 mt-0.5">
                                            ₹{duesSummary.ekunVasulpatra.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    <div className="p-2 rounded-sm bg-white border border-gray-200">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
                                            <span>मंजूर / एकूण वाटप</span>
                                            {accountDetails?.disbursementCount && accountDetails.disbursementCount > 1 ? (
                                                <span className="px-1 rounded-sm bg-amber-100 text-amber-900 text-[9px]">
                                                    {accountDetails.disbursementCount} टप्पे
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="text-xs font-bold font-mono text-gray-800 mt-0.5">
                                            ₹{duesSummary.totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                        {(accountDetails?.pendingSanctionedAmount || 0) > 0 && (
                                            <div className="text-[9.5px] text-primary font-semibold mt-0.5">
                                                शिल्लक मंजुरी: ₹{accountDetails?.pendingSanctionedAmount?.toLocaleString('en-IN')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-2 rounded-sm bg-white border border-gray-200">
                                        <div className="text-[10px] font-bold text-gray-500">
                                            {selectedAccount.loanRate?.loanInstallmentType?.includes('व्याजवरती') ? 'हप्ता प्रकार: व्याजवरती' : 'नियमित हप्ता (EMI)'}
                                        </div>
                                        <div className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                                            ₹{(selectedAccount.installmentAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-[9.5px] text-gray-500 mt-0.5">
                                            उचल: {duesSummary.disbursementDate ? formatDateSafe(duesSummary.disbursementDate) : '-'}
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Clean Scannable Dues & Interest Breakdown List */}
                                <div className="border border-gray-200 rounded-sm divide-y divide-gray-100 text-[11px]">
                                    <div className="px-2.5 py-1.5 flex items-center justify-between bg-slate-50/60">
                                        <span className="text-gray-600 font-medium">व्याज आकारणी पासून (दिवस)</span>
                                        <span className="font-mono font-bold text-gray-900">
                                            {duesSummary.fromDateStrGrid ? formatDateSafe(duesSummary.fromDateStrGrid) : '-'}
                                            <span className="ml-1 text-primary">({duesSummary.days} दि.)</span>
                                        </span>
                                    </div>

                                    <div className="px-2.5 py-1.5 flex items-center justify-between">
                                        <span className="text-gray-600 font-medium">थकीत हप्ते / थकीत दिनांक</span>
                                        <span className="font-mono font-bold text-rose-700">
                                            {duesSummary.thakitHapteCount} हप्ते
                                            {duesSummary.thakitDinank !== '-' && (
                                                <span className="text-gray-500 font-normal ml-1">({duesSummary.thakitDinank})</span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="px-2.5 py-1.5 flex items-center justify-between">
                                        <span className="text-gray-600 font-medium">वसूलपात्र / थकीत मुद्दल</span>
                                        <span className="font-mono font-bold text-gray-900">
                                            ₹{duesSummary.vasulpatra.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            {duesSummary.paikiThakbaki > 0 && duesSummary.paikiThakbaki !== duesSummary.vasulpatra && (
                                                <span className="text-[10px] text-rose-600 ml-1">
                                                    (थकीत: ₹{duesSummary.paikiThakbaki.toLocaleString('en-IN')})
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="px-2.5 py-1.5 flex items-center justify-between">
                                        <span className="text-gray-600 font-medium">चालू आकारणी व्याज</span>
                                        <span className="font-mono font-bold text-amber-800">
                                            ₹{duesSummary.vyaj.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    <div className="px-2.5 py-1.5 flex items-center justify-between">
                                        <span className="text-gray-600 font-medium">मागील येणे व्याज</span>
                                        <span className="font-mono font-bold text-emerald-800">
                                            ₹{duesSummary.yeneVyaj.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    <div className="px-2.5 py-1.5 flex items-center justify-between">
                                        <span className="text-gray-600 font-medium">दंड / जादा व्याज</span>
                                        <span className="font-mono font-bold text-rose-700">
                                            ₹{duesSummary.dandVyaj.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    {accountDetails && (
                                        <div className="px-2.5 py-1.5 flex items-center justify-between bg-slate-50/40">
                                            <span className="text-gray-600 font-medium">३१/३ अखेर बाकी</span>
                                            <span className="font-mono font-semibold text-gray-800">
                                                ₹{accountDetails.march31Balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    )}

                                    <div className="px-2.5 py-2 flex items-center justify-between bg-primary/5 border-l-4 border-l-primary">
                                        <span className="text-gray-800 font-bold">वसुलीनंतर नवीन शिल्लक कर्ज</span>
                                        <span className="font-mono font-black text-xs text-primary">
                                            ₹{duesSummary.shillakKarjRakkam.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                {/* Multiple Disbursement Tranches (if >1) */}
                                {accountDetails?.tranches && accountDetails.tranches.length > 1 && (
                                    <div className="p-2 rounded-sm bg-amber-50/70 border border-amber-200 text-[10.5px] space-y-1">
                                        <div className="font-bold text-amber-900">टप्पानिहाय वाटप तपशील:</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {accountDetails.tranches.map((t, idx) => (
                                                <span key={t.disbursementID} className="px-1.5 py-0.5 bg-white rounded-sm border border-amber-300 text-gray-800 font-mono">
                                                    टप्पा {idx + 1}: <b>₹{t.disbursementAmount.toLocaleString('en-IN')}</b> ({new Date(t.disbursementDate).toLocaleDateString('en-GB')})
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Schedule Chart Action Button */}
                                <button
                                    type="button"
                                    onClick={() => setShowInstallmentModal(true)}
                                    className="w-full py-1.5 px-3 rounded-sm bg-primary/10 hover:bg-primary hover:text-white text-primary border border-primary/25 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>हप्ता परतफेड वेळापत्रक चार्ट पहा</span>
                                    {accountDetails?.schedule && accountDetails.schedule.length > 0 && (
                                        <span className="font-mono text-[10.5px] opacity-90">
                                            ({accountDetails.schedule.length} हप्ते)
                                        </span>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="p-6 text-center text-gray-500 flex flex-col items-center justify-center min-h-[260px] space-y-2">
                                <div className="p-2.5 rounded-full bg-slate-100 text-gray-400 border border-gray-200">
                                    <Landmark className="w-6 h-6" />
                                </div>
                                <div className="text-xs font-bold text-gray-700">
                                    {borrowerLoans.length > 1
                                        ? 'डावीकडील यादीतून कर्ज खाते निवडा'
                                        : 'कोणतेही कर्ज खाते निवडलेले नाही'}
                                </div>
                                <p className="text-[11px] text-gray-500 max-w-[230px]">
                                    कर्ज प्रकार व कर्जदार निवडताच येथे मुद्दल बाकी, चालू/येणे व्याज, थकीत हप्ते आणि NPA स्थिती दिसेल.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </form>

            {/* Installment Schedule Modal Window - Matching Smart Banking ERP Theme */}
            {showInstallmentModal && selectedAccount && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 animate-in fade-in duration-150">
                    <div className="bg-white rounded-sm shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-300">
                        {/* Modal Header */}
                        <div className="bg-primary text-white p-2.5 flex justify-between items-center rounded-t-sm shadow-xs border-b border-primary/30">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-white/10 rounded-sm">
                                    <Calendar className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold flex items-center gap-2">
                                        कर्ज हप्ता परतफेड वेळापत्रक चार्ट (Loan Installment Schedule)
                                        <span className="bg-white/20 text-white text-[11px] px-2 py-0.5 rounded-sm font-mono font-bold">
                                            {selectedAccount.loanAccountNo}
                                        </span>
                                    </h2>
                                    <p className="text-[11px] text-white/90 mt-0.5 flex flex-wrap items-center gap-2">
                                        <span>खातेदार: <strong className="text-white">{selectedBorrowerName}</strong></span>
                                        {selectedBorrowerCif && (
                                            <>
                                                <span>•</span>
                                                <span>CIF: <strong className="text-white font-mono">{selectedBorrowerCif}</strong></span>
                                            </>
                                        )}
                                        <span>•</span>
                                        <span>कर्ज प्रकार: <strong className="text-white">{selectedAccount.loanRate?.shortName || selectedAccount.loanRate?.loanType || '-'}</strong></span>
                                        <span>•</span>
                                        <span>मंजूर रक्कम: <strong className="text-white">₹{(accountDetails?.sanctionedAmount || selectedAccount.sanctionedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                                        <span>•</span>
                                        <span>व्याजदर: <strong className="text-white">{selectedAccount.loanRate?.interestRate || selectedAccount.interestRate || 0}%</strong></span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-sm text-xs font-bold transition-colors flex items-center gap-1 border border-white/30 cursor-pointer"
                                >
                                    <Printer size={13} /> प्रिंट
                                </button>
                                <button
                                    onClick={() => setShowInstallmentModal(false)}
                                    className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-sm transition-colors cursor-pointer"
                                    title="बंद करा"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-2.5 overflow-y-auto flex-1 bg-gray-50 flex flex-col gap-2.5">
                            {/* KPI Summary Cards */}
                            {(() => {
                                const schedule = accountDetails?.schedule || [];
                                const totalCount = schedule.length;
                                const totalPrincipal = schedule.reduce((sum, s) => sum + (s.principalAmount || 0), 0);
                                const totalInterest = schedule.reduce((sum, s) => sum + (s.interestAmount || 0), 0);
                                const totalEMI = schedule.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

                                const paidList = schedule.filter(s => s.status === 'Paid');
                                const paidCount = paidList.length;
                                const paidPrincipal = paidList.reduce((sum, s) => sum + (s.paidPrincipal || s.principalAmount || 0), 0);
                                const paidTotal = paidList.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

                                const partialList = schedule.filter(s => s.status === 'Partially Paid');
                                const partialCount = partialList.length;
                                const partialPaidPrincipal = partialList.reduce((sum, s) => sum + (s.paidPrincipal || 0), 0);

                                const collectionDateObj = parseDateSafe(formData.collectionDate || new Date());
                                collectionDateObj.setHours(0, 0, 0, 0);

                                const overdueList = schedule.filter(s => {
                                    if (s.status === 'Paid') return false;
                                    const dDate = parseDateSafe(s.dueDate);
                                    dDate.setHours(0, 0, 0, 0);
                                    return s.status === 'Overdue' || (dDate <= collectionDateObj && s.status !== 'Paid');
                                });
                                const overdueCount = overdueList.length;
                                const overduePrincipal = overdueList.reduce((sum, s) => sum + (s.remainingPrincipal || s.principalAmount || 0), 0);

                                const pendingList = schedule.filter(s => s.status !== 'Paid');
                                const pendingCount = pendingList.length;
                                const currentBalance = selectedAccount.principalBalance || 0;

                                return (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                                        {/* 1. Total EMIs */}
                                        <div className="bg-white p-2 rounded-sm border border-slate-200 shadow-xs flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-primary">
                                                <span className="text-[10px] font-bold uppercase tracking-wider">एकूण हप्ते (Total EMIs)</span>
                                                <FileText size={13} />
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between">
                                                <span className="text-base font-bold text-slate-800">{totalCount}</span>
                                                <span className="text-xs text-primary font-bold">₹ {totalEMI.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-500 mt-0.5 truncate">मुद्दल: ₹{totalPrincipal.toLocaleString('en-IN')} | व्याज: ₹{totalInterest.toLocaleString('en-IN')}</span>
                                        </div>

                                        {/* 2. Paid / Nil EMIs */}
                                        <div className="bg-emerald-50/40 p-2 rounded-sm border border-emerald-300 shadow-xs flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-emerald-800">
                                                <span className="text-[10px] font-bold uppercase tracking-wider">पूर्ण भरले / निल (Nil)</span>
                                                <CheckCircle size={13} />
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between">
                                                <span className="text-base font-bold text-emerald-700">{paidCount}</span>
                                                <span className="text-xs text-emerald-700 font-bold">₹ {paidPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <span className="text-[10px] text-emerald-700 mt-0.5 truncate">हप्ते निल झाले: {paidCount} / {totalCount}</span>
                                        </div>

                                        {/* 3. Partially Paid EMIs */}
                                        <div className="bg-amber-50/40 p-2 rounded-sm border border-amber-300 shadow-xs flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-amber-800">
                                                <span className="text-[10px] font-bold uppercase tracking-wider">अंशतः भरले (Partial)</span>
                                                <Clock size={13} />
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between">
                                                <span className="text-base font-bold text-amber-800">{partialCount}</span>
                                                <span className="text-xs text-amber-800 font-bold">₹ {partialPaidPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <span className="text-[10px] text-amber-700 mt-0.5 truncate">अंशतः वसूल मुद्दल</span>
                                        </div>

                                        {/* 4. Overdue EMIs */}
                                        <div className="bg-rose-50/40 p-2 rounded-sm border border-rose-300 shadow-xs flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-rose-700">
                                                <span className="text-[10px] font-bold uppercase tracking-wider">आजअखेर थकीत (Overdue)</span>
                                                <AlertCircle size={13} />
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between">
                                                <span className="text-base font-bold text-rose-700">{overdueCount}</span>
                                                <span className="text-xs text-rose-700 font-bold">₹ {overduePrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <span className="text-[10px] text-rose-600 mt-0.5 truncate">थकीत मुद्दल रक्कम</span>
                                        </div>

                                        {/* 5. Pending Principal Balance */}
                                        <div className="bg-blue-50/40 p-2 rounded-sm border border-blue-200 shadow-xs flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-primary">
                                                <span className="text-[10px] font-bold uppercase tracking-wider">शिल्लक मुद्दल (Balance)</span>
                                                <Calendar size={13} />
                                            </div>
                                            <div className="mt-1 flex items-baseline justify-between">
                                                <span className="text-base font-bold text-primary">{pendingCount} <span className="text-[10px] text-gray-500 font-normal">हप्ते</span></span>
                                                <span className="text-xs text-primary font-black">₹ {currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-600 mt-0.5 truncate">चालू कर्ज बाकी</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Filter Tabs */}
                            <div className="flex flex-wrap justify-between items-center bg-white p-1.5 rounded-sm border border-slate-200 gap-1.5 shadow-xs">
                                <div className="flex items-center gap-1">
                                    <span className="text-[11px] font-bold text-gray-600 mr-1">फिल्टर:</span>
                                    {(['ALL', 'PAID', 'PARTIAL', 'OVERDUE', 'PENDING'] as const).map(filter => {
                                        const schedule = accountDetails?.schedule || [];
                                        const collectionDateObj = parseDateSafe(formData.collectionDate || new Date());
                                        collectionDateObj.setHours(0, 0, 0, 0);

                                        let count = schedule.length;
                                        if (filter === 'PAID') {
                                            count = schedule.filter(s => s.status === 'Paid').length;
                                        } else if (filter === 'PARTIAL') {
                                            count = schedule.filter(s => s.status === 'Partially Paid').length;
                                        } else if (filter === 'OVERDUE') {
                                            count = schedule.filter(s => {
                                                if (s.status === 'Paid') return false;
                                                const dDate = parseDateSafe(s.dueDate);
                                                dDate.setHours(0, 0, 0, 0);
                                                return s.status === 'Overdue' || (dDate <= collectionDateObj && s.status !== 'Paid');
                                            }).length;
                                        } else if (filter === 'PENDING') {
                                            count = schedule.filter(s => s.status !== 'Paid').length;
                                        }

                                        const labels = {
                                            ALL: 'सर्व हप्ते',
                                            PAID: '🟢 पूर्ण भरले (Nil)',
                                            PARTIAL: '🟡 अंशतः भरले',
                                            OVERDUE: '🔴 थकीत (Overdue)',
                                            PENDING: '🔵 येणे बाकी'
                                        };

                                        const isActive = modalFilter === filter;
                                        return (
                                            <button
                                                key={filter}
                                                type="button"
                                                onClick={() => setModalFilter(filter)}
                                                className={`px-2 py-0.5 rounded-sm text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                                                    isActive
                                                        ? 'bg-primary text-white shadow-xs'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                                                }`}
                                            >
                                                {labels[filter]}
                                                <span className={`text-[9px] px-1 py-0.2 rounded-sm font-mono ${
                                                    isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'
                                                }`}>
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="text-[11px] text-gray-600 font-medium">
                                    हप्ता वारंवारता: <span className="font-bold text-gray-800">{selectedAccount.loanRate?.loanInstallmentType || 'मासिक'}</span> | प्रकार: <span className="font-bold text-primary">{selectedAccount.loanRate?.shortName || selectedAccount.loanRate?.loanType}</span>
                                </div>
                            </div>

                            {/* Detailed Schedule Table */}
                            <div className="bg-white rounded-sm border border-gray-300 shadow-xs overflow-hidden flex-1 max-h-[420px] overflow-y-auto">
                                <table className="w-full text-[11px] text-center border-collapse">
                                    <thead className="bg-gray-100 text-primary border-b-2 border-primary sticky top-0 shadow-xs z-10 font-bold">
                                        <tr>
                                            <th className="p-1.5 border-r border-gray-300 w-12">हप्ता क्र.</th>
                                            <th className="p-1.5 border-r border-gray-300">देय दिनांक (Due Date)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right">सुरुवातीची बाकी</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right text-primary font-bold">मुद्दल हप्ता (₹)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right text-orange-800 font-bold">हप्ता व्याज (₹)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right bg-primary/10 text-primary font-bold">एकूण हप्ता (EMI ₹)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right text-emerald-800 font-bold">भरलेली मुद्दल (₹)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right text-rose-700 font-bold">शिल्लक मुद्दल (₹)</th>
                                            <th className="p-1.5 border-r border-gray-300 text-right text-gray-800 font-bold">अखेरची बाकी (₹)</th>
                                            <th className="p-1.5 border-r border-gray-300">पावती / दिनांक</th>
                                            <th className="p-1.5 min-w-[130px]">हप्ता स्थिती (Status)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {(() => {
                                            const schedule = accountDetails?.schedule || [];
                                            const collectionDateObj = parseDateSafe(formData.collectionDate || new Date());
                                            collectionDateObj.setHours(0, 0, 0, 0);

                                            const filteredSchedule = schedule.filter(s => {
                                                if (modalFilter === 'ALL') return true;
                                                if (modalFilter === 'PAID') return s.status === 'Paid';
                                                if (modalFilter === 'PARTIAL') return s.status === 'Partially Paid';
                                                if (modalFilter === 'PENDING') return s.status !== 'Paid';
                                                if (modalFilter === 'OVERDUE') {
                                                    if (s.status === 'Paid') return false;
                                                    const dDate = parseDateSafe(s.dueDate);
                                                    dDate.setHours(0, 0, 0, 0);
                                                    return s.status === 'Overdue' || (dDate <= collectionDateObj && s.status !== 'Paid');
                                                }
                                                return true;
                                            });

                                            if (filteredSchedule.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={11} className="p-6 text-center text-gray-500 italic">
                                                            या फिल्टर अंतर्गत कोणताही हप्ता उपलब्ध नाही.
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return filteredSchedule.map(row => {
                                                const dDate = parseDateSafe(row.dueDate);
                                                dDate.setHours(0, 0, 0, 0);
                                                const isPaid = row.status === 'Paid';
                                                const isPartial = row.status === 'Partially Paid';
                                                const isOverdue = !isPaid && (row.status === 'Overdue' || dDate <= collectionDateObj);

                                                const paidPrincipal = row.paidPrincipal !== undefined ? row.paidPrincipal : (isPaid ? row.principalAmount : 0);
                                                const remainingPrincipal = row.remainingPrincipal !== undefined ? row.remainingPrincipal : (isPaid ? 0 : row.principalAmount);

                                                return (
                                                    <tr
                                                        key={row.installmentNo}
                                                        className={`transition-colors ${
                                                            isPaid
                                                                ? 'bg-emerald-50/40 hover:bg-emerald-100/50 text-slate-800'
                                                                : isPartial
                                                                ? 'bg-amber-50/50 hover:bg-amber-100/60 font-medium'
                                                                : isOverdue
                                                                ? 'bg-rose-50/50 hover:bg-rose-100/60 font-medium'
                                                                : 'hover:bg-primary/5 text-slate-700'
                                                        }`}
                                                    >
                                                        {/* Installment No */}
                                                        <td className="p-1 border-r border-gray-200 font-bold text-gray-700">
                                                            #{row.installmentNo}
                                                        </td>
                                                        {/* Due Date */}
                                                        <td className="p-1 border-r border-gray-200 font-mono font-medium">
                                                            {formatDateSafe(row.dueDate)}
                                                        </td>
                                                        {/* Opening Balance */}
                                                        <td className="p-1 border-r border-gray-200 text-right text-gray-600 font-mono">
                                                            ₹ {((row.openingBalance ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Principal Amount */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-bold text-primary font-mono">
                                                            ₹ {row.principalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Interest Amount */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-semibold text-orange-800 font-mono">
                                                            ₹ {row.interestAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Total EMI */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-bold text-primary bg-primary/5 font-mono">
                                                            ₹ {row.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Paid Principal */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-bold text-emerald-700 font-mono">
                                                            ₹ {paidPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Remaining Principal */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-bold text-rose-700 font-mono">
                                                            ₹ {remainingPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Closing Balance */}
                                                        <td className="p-1 border-r border-gray-200 text-right font-semibold text-gray-800 font-mono">
                                                            ₹ {((row.closingBalance ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {/* Receipt No & Paid Date */}
                                                        <td className="p-1 border-r border-gray-200 text-[10px]">
                                                            {row.receiptNo || row.paidDate ? (
                                                                <div className="flex flex-col items-center">
                                                                    {row.receiptNo && (
                                                                        <span className="font-mono font-bold text-primary bg-primary/10 px-1 rounded-sm border border-primary/20">
                                                                            {row.receiptNo}
                                                                        </span>
                                                                    )}
                                                                    {row.paidDate && (
                                                                        <span className="text-gray-500 font-mono mt-0.5">
                                                                            {formatDateSafe(row.paidDate)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </td>
                                                        {/* Status Badge */}
                                                        <td className="p-1">
                                                            {isPaid ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                    <CheckCircle size={10} /> पूर्ण भरला (Nil)
                                                                </span>
                                                            ) : isPartial ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                                    <Clock size={10} /> अंशतः भरला
                                                                </span>
                                                            ) : isOverdue ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                                                    <AlertCircle size={10} /> थकीत {row.overdueDays ? `(${row.overdueDays} दि.)` : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                                                    <Calendar size={10} /> आगामी देय
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                    {accountDetails?.schedule && accountDetails.schedule.length > 0 && (
                                        <tfoot className="bg-gray-100 font-bold border-t-2 border-primary sticky bottom-0 z-10 text-slate-800">
                                            <tr>
                                                <td colSpan={3} className="p-1.5 border-r border-gray-300 text-right">
                                                    एकूण हप्ता वेळापत्रक बेरीज (Total Schedule):
                                                </td>
                                                <td className="p-1.5 border-r border-gray-300 text-right text-primary font-bold font-mono">
                                                    ₹ {accountDetails.schedule.reduce((sum, s) => sum + s.principalAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-1.5 border-r border-gray-300 text-right text-orange-800 font-bold font-mono">
                                                    ₹ {accountDetails.schedule.reduce((sum, s) => sum + s.interestAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-1.5 border-r border-gray-300 text-right text-primary font-bold bg-primary/10 font-mono">
                                                    ₹ {accountDetails.schedule.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-1.5 border-r border-gray-300 text-right text-emerald-800 font-bold font-mono">
                                                    ₹ {accountDetails.schedule.reduce((sum, s) => sum + (s.paidPrincipal || (s.status === 'Paid' ? s.principalAmount : 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-1.5 border-r border-gray-300 text-right text-rose-700 font-bold font-mono">
                                                    ₹ {accountDetails.schedule.reduce((sum, s) => sum + (s.remainingPrincipal !== undefined ? s.remainingPrincipal : (s.status === 'Paid' ? 0 : s.principalAmount)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td colSpan={3} className="p-1.5 text-left text-[11px] text-gray-500 italic">
                                                    (एकूण {accountDetails.schedule.length} हप्ते | चालू शिल्लक: ₹{(selectedAccount.principalBalance || 0).toLocaleString('en-IN')})
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-between items-center p-2 bg-gray-100 border-t border-gray-300 rounded-b-sm">
                            <div className="text-[11px] text-gray-600 font-medium flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> पूर्ण भरले (Nil): <strong className="text-emerald-700">{accountDetails?.schedule?.filter(s => s.status === 'Paid').length || 0}</strong></span>
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> अंशतः भरले: <strong className="text-amber-800">{accountDetails?.schedule?.filter(s => s.status === 'Partially Paid').length || 0}</strong></span>
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-600 inline-block" /> थकीत: <strong className="text-rose-700">{accountDetails?.schedule?.filter(s => {
                                    if (s.status === 'Paid') return false;
                                    const dDate = parseDateSafe(s.dueDate);
                                    dDate.setHours(0, 0, 0, 0);
                                    const cDate = parseDateSafe(formData.collectionDate || new Date());
                                    cDate.setHours(0, 0, 0, 0);
                                    return s.status === 'Overdue' || (dDate <= cDate && s.status !== 'Paid');
                                }).length || 0}</strong></span>
                                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> येणे बाकी: <strong className="text-primary">{accountDetails?.schedule?.filter(s => s.status !== 'Paid').length || 0}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-sm text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-gray-300"
                                >
                                    <Printer size={13} /> प्रिंट करा (Print)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowInstallmentModal(false)}
                                    className="px-3.5 py-1 bg-primary hover:bg-primary/90 text-white rounded-sm text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <X size={13} /> बंद करा (Close)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showReceiptsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2">
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-6xl flex flex-col max-h-[90vh]">
                        <div className="bg-primary text-white p-2 flex justify-between items-center rounded-t-sm">
                            <h2 className="text-sm font-bold flex items-center gap-2"><FileText size={16} /> सर्व जमा पावत्या (All Receipts)</h2>
                            <button onClick={() => setShowReceiptsModal(false)} className="hover:text-red-200"><X size={16} /></button>
                        </div>
                        
                        <div className="p-2 flex-1 overflow-auto bg-gray-50">
                            <table className="w-full text-[11px] text-left border-collapse bg-white shadow-sm rounded-sm overflow-hidden">
                                <thead className="bg-gray-100 text-primary border-b-2 border-primary">
                                    <tr>
                                        <th className="p-1 border-r font-bold">दिनांक</th>
                                        <th className="p-1 border-r font-bold">पावती क्र.</th>
                                        <th className="p-1 border-r font-bold">सभासद / खाते</th>
                                        <th className="p-1 border-r font-bold text-right">एकूण रक्कम</th>
                                        <th className="p-1 border-r font-bold">मोड</th>
                                        <th className="p-1 border-r font-bold">शेरा</th>
                                        <th className="p-1 font-bold text-center">कृती (Action)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {collections.map(c => {
                                        const isEditing = editingReceiptId === c.loanCollectionID;
                                        return (
                                            <tr key={c.loanCollectionID} className="border-b hover:bg-blue-50/30 transition-colors">
                                                <td className="p-1 border-r">
                                                    {isEditing ? (
                                                        <input type="date" value={editData.collectionDate?.split('T')[0] || ''} onChange={e => setEditData({...editData, collectionDate: e.target.value})} className="border p-0.5 text-[11px] h-[22px] w-full" />
                                                    ) : new Date(c.collectionDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="p-1 border-r font-semibold">{c.receiptNo}</td>
                                                <td className="p-1 border-r">
                                                    <div>{c.loanAccount?.customer ? `${c.loanAccount.customer.firstName || ''} ${c.loanAccount.customer.lastName || ''}`.trim() : `${c.loanAccount?.member?.firstName || ''} ${c.loanAccount?.member?.lastName || ''}`.trim()}</div>
                                                    <span className="text-[10px] text-gray-500 font-mono block">
                                                        {c.loanAccount?.loanAccountNo} {c.loanAccount?.legacyAccountNumber ? `| जुना क्र: ${c.loanAccount.legacyAccountNumber}` : ''} {c.loanAccount?.customer?.cifNo ? `| CIF: ${c.loanAccount.customer.cifNo}` : (c.loanAccount?.member?.memberCode ? `| ${c.loanAccount.member.memberCode}` : '')}
                                                    </span>
                                                </td>
                                                <td className="p-1 border-r text-right font-bold text-green-700" title={`मुद्दल: ₹${c.principalCollected?.toFixed(2) || '0.00'} | थकीत येणे व्याज: ₹${(c.receivableInterestCollected || 0).toFixed(2)} | चालू व्याज: ₹${c.interestCollected?.toFixed(2) || '0.00'}`}>
                                                    ₹{c.totalAmountReceived.toFixed(2)}
                                                </td>
                                                <td className="p-1 border-r min-w-[140px]">
                                                    {isEditing ? (
                                                        (c.paymentMode === 'Saving Transfer' || c.paymentMode === 'Saving' || c.paymentMode === 'Pigmy Transfer' || c.paymentMode === 'Pigmy') ? (
                                                            <div className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded-sm text-[10px] font-bold text-slate-700 inline-flex items-center gap-1" title="खाते वर्ग (Transfer) पावतीची पेमेंट पद्धत बदलता येत नाही">
                                                                <Lock className="w-2.5 h-2.5" /> {c.paymentMode}
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1">
                                                                <select
                                                                    value={editData.paymentMode || 'Cash'}
                                                                    onChange={e => {
                                                                        const nextMode = e.target.value;
                                                                        setEditData({
                                                                            ...editData,
                                                                            paymentMode: nextMode,
                                                                            ...(nextMode === 'Cash' ? { bankAccountLedgerID: 0, bankName: '', chequeNo: '' } : {})
                                                                        });
                                                                    }}
                                                                    className="border p-0.5 text-[11px] h-[22px] w-full bg-white"
                                                                >
                                                                    <option value="Cash">Cash (रोख)</option>
                                                                    <option value="Bank">Bank (बँक)</option>
                                                                    <option value="Cheque">Cheque (चेक)</option>
                                                                </select>
                                                                {(editData.paymentMode === 'Bank' || editData.paymentMode === 'Cheque') && (
                                                                    <BankLedgerSelect
                                                                        label=""
                                                                        required={false}
                                                                        ledgers={ledgers}
                                                                        value={editData.bankAccountLedgerID || 0}
                                                                        onChange={(bankLId) => {
                                                                            const selectedLedger = bankLedgers.find(l => Number(l.ledgerID) === Number(bankLId));
                                                                            setEditData({
                                                                                ...editData,
                                                                                bankAccountLedgerID: bankLId,
                                                                                bankName: selectedLedger?.ledgerName || editData.bankName || ''
                                                                            });
                                                                        }}
                                                                        placeholder="-- बँक खाते निवडा --"
                                                                        className="border border-primary/40 p-0.5 text-[10px] h-[22px] w-full bg-primary/5 font-semibold"
                                                                    />
                                                                )}
                                                            </div>
                                                        )
                                                    ) : c.paymentMode}
                                                </td>
                                                <td className="p-1 border-r text-gray-500">
                                                    {isEditing ? (
                                                        <input type="text" value={editData.remarks || ''} onChange={e => setEditData({...editData, remarks: e.target.value})} className="border p-0.5 text-[11px] h-[22px] w-full" placeholder="शेरा..." />
                                                    ) : c.remarks}
                                                </td>
                                                <td className="p-1 text-center flex justify-center gap-1">
                                                    {isEditing ? (
                                                        <>
                                                            <button type="button" onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white p-1 rounded-sm shadow-sm" title="Save"><Save size={12} /></button>
                                                            <button type="button" onClick={() => setEditingReceiptId(null)} className="bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-sm shadow-sm" title="Cancel"><X size={12} /></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button type="button" onClick={() => {
                                                                setEditingReceiptId(c.loanCollectionID);
                                                                setEditData({
                                                                    collectionDate: c.collectionDate,
                                                                    paymentMode: c.paymentMode,
                                                                    bankAccountLedgerID: c.bankAccountLedgerID || 0,
                                                                    bankName: c.bankName || '',
                                                                    chequeNo: c.chequeNo || '',
                                                                    remarks: c.remarks || ''
                                                                });
                                                            }} className="bg-slate-600 hover:bg-slate-700 text-white p-1 rounded-sm shadow-2xs cursor-pointer" title="Edit"><Edit size={12} /></button>
                                                            <button onClick={() => setPrintingCollectionId(c.loanCollectionID)} className="bg-primary hover:opacity-90 text-white p-1 rounded-sm shadow-2xs cursor-pointer" title="Print"><Printer size={12} /></button>
                                                            <button onClick={() => handleDirectWhatsAppShare(c)} className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded-sm shadow-2xs flex items-center justify-center cursor-pointer" title="WhatsApp वर पाठवा"><Share2 size={12} /></button>
                                                            {(!c.voucher || c.voucher.status !== 'Approved') && (!c.homeBranchVoucher || c.homeBranchVoucher.status !== 'Approved') && (
                                                                <button type="button" onClick={() => handleDeleteReceipt(c.loanCollectionID)} className="bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-sm shadow-2xs cursor-pointer" title="पावती व व्हाउचर डिलीट करा (Hard Delete)"><Trash2 size={12} /></button>
                                                            )}
                                                            
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {collections.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-2 text-center text-gray-500 italic">कोणतीही पावती उपलब्ध नाही.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Auto Lien Release Confirmation Modal on Loan Closure */}
            {lienPromptData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-3 animate-fade-in">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-lg overflow-hidden border border-emerald-500/30">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-3.5 flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-white/20 rounded-full">
                                    <CheckCircle className="text-white" size={20} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold leading-tight">
                                        कर्ज खाते पूर्ण नील झाले! (Loan Fully Settled)
                                    </h2>
                                    <p className="text-[11px] text-emerald-100 font-mono">
                                        खाते क्र.: {lienPromptData.loanAccountNo}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLienPromptData(null)}
                                className="text-white/80 hover:text-white p-1 rounded-sm transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 bg-gray-50/50 space-y-3.5">
                            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-[12px] text-emerald-900 leading-relaxed">
                                <p className="font-semibold text-emerald-950 mb-1">
                                    🎉 सदर कर्ज खात्याची सर्व येणे मुद्दल व व्याज भरणा पूर्ण झाला असून खाते 'Closed' झाले आहे.
                                </p>
                                <p className="text-emerald-800">
                                    या कर्जापोटी खालील तारण ठेव खात्यांवर बोजा (Lien) नोंदवला आहे. हा बोजा आपण आता <strong className="text-emerald-950 underline">तात्काळ मोकळा (Release)</strong> करू इच्छिता का?
                                </p>
                            </div>

                            {/* Table of Collaterals */}
                            <div className="border border-gray-200 rounded overflow-hidden bg-white shadow-xs">
                                <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-200 text-[11px] font-bold text-gray-700 flex justify-between items-center">
                                    <span>तारण ठेव तपशील (Linked Collaterals)</span>
                                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-semibold">
                                        {lienPromptData.activeCollaterals.length} खाती
                                    </span>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    <table className="w-full text-[11px] text-left border-collapse">
                                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                                            <tr>
                                                <th className="p-2 border-r border-gray-200">ठेव प्रकार</th>
                                                <th className="p-2 border-r border-gray-200 font-mono">खाते क्र.</th>
                                                <th className="p-2 border-r border-gray-200 text-right">बोजा रक्कम (₹)</th>
                                                <th className="p-2 text-center">स्थिती</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {lienPromptData.activeCollaterals.map((c, idx) => (
                                                <tr key={idx} className="hover:bg-emerald-50/30">
                                                    <td className="p-2 border-r border-gray-100 font-medium text-gray-800">
                                                        {getCollateralTypeName(c.collateralType)}
                                                    </td>
                                                    <td className="p-2 border-r border-gray-100 font-mono font-semibold text-primary">
                                                        {c.depositAccountNo}
                                                    </td>
                                                    <td className="p-2 border-r border-gray-100 text-right font-mono font-bold text-gray-800">
                                                        ₹{(c.lienAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-300">
                                                            बोजा नोंदवला
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <p className="text-[11px] text-gray-500 italic">
                                * बोजा तात्काळ मोकळा केल्यास खातेदाराला आपल्या ठेवीवरील रक्कम आहरण किंवा मुदतपूर्ती लाभ त्वरित घेता येईल.
                            </p>
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-3 bg-gray-100 border-t border-gray-200 flex justify-end items-center gap-2">
                            <button
                                type="button"
                                disabled={releasingLien}
                                onClick={() => setLienPromptData(null)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                                नंतर करा (Do Later)
                            </button>
                            <button
                                type="button"
                                disabled={releasingLien}
                                onClick={handleReleaseAllLiens}
                                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {releasingLien ? (
                                    <>मोकळा करत आहे...</>
                                ) : (
                                    <>
                                        <CheckCircle size={14} /> होय, बोजा तात्काळ मोकळा करा
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🛑 Rejection Reason Modal */}
            {rejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs">
                    <div className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden border border-rose-300 border-t-4 border-t-rose-600 animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-rose-50 px-4 py-3 border-b border-rose-100 flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-rose-600" />
                            <div>
                                <h3 className="text-sm font-bold text-rose-900">कर्ज पावती नामंजूर / रद्द करा (Reject Collection)</h3>
                                <p className="text-[11px] text-rose-700">पावती / व्हाउचर क्र: <span className="font-mono font-bold">{passingVoucher?.voucherNo || formData.receiptNo || '-'}</span></p>
                            </div>
                        </div>
                        
                        <div className="p-4 space-y-3">
                            <label className="block text-xs font-semibold text-gray-700">
                                नामंजूर करण्याचे कारण लिहा (Reason for Rejection): <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="उदा. रक्कम जुळत नाही / चुकीच्या कर्ज खात्यात जमा केली आहे / चेक बाऊन्स झाला आहे..."
                                rows={3}
                                className="w-full text-xs border border-gray-300 rounded p-2 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                autoFocus
                            />
                        </div>

                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setRejectModalOpen(false);
                                    setRejectionReason('');
                                }}
                                disabled={passingActionLoading}
                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded transition-colors cursor-pointer"
                            >
                                रद्द करा (Cancel)
                            </button>
                            <button
                                type="button"
                                onClick={handleRejectVoucher}
                                disabled={passingActionLoading || !rejectionReason.trim()}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{passingActionLoading ? 'प्रक्रिया सुरू आहे...' : 'नामंजूर निश्चित करा (Confirm Reject)'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive Multi-Loan Account Selector Modal (CIF-First) */}
            {showMultiLoanModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-sm shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-300">
                        {/* Modal Header */}
                        <div className="bg-primary px-4 py-3 text-white flex items-center justify-between border-b border-primary/20 shadow-xs">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-white/15 rounded-sm">
                                    <Layers className="w-5 h-5 text-amber-300" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm flex items-center gap-2">
                                        <span>कर्ज खाते निवडा (Select Loan Account)</span>
                                        <span className="text-[11px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-sm shadow-2xs">
                                            एकूण {customerMatchingLoans.length} कर्ज खाती
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/90 mt-0.5">
                                        खातेदार: <strong className="text-white">{multiLoanCustomerInfo?.name || 'कर्जदार'}</strong>
                                        {multiLoanCustomerInfo?.cifNo && multiLoanCustomerInfo.cifNo !== '-' && (
                                            <span className="ml-2 font-mono text-amber-300 bg-black/20 px-1.5 py-0.5 rounded-sm text-[11px]">
                                                [CIF: {multiLoanCustomerInfo.cifNo}]
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowMultiLoanModal(false)}
                                className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-sm cursor-pointer transition-colors"
                                title="बंद करा"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Sub-header Notice */}
                        <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs text-slate-700">
                            <span className="font-semibold">कृपया वसुली जमा करण्यासाठी योग्य कर्ज खाते निवडा:</span>
                            <span className="text-[11px] text-slate-500 font-medium">खात्यावर किंवा बटनावर क्लिक करा</span>
                        </div>

                        {/* Modal Body: List of Loans */}
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2.5 bg-slate-50/70">
                            <div className="grid grid-cols-1 gap-2.5">
                                {customerMatchingLoans.map((acc: LoanAccount) => {
                                    const isCurrent = selectedAccount?.loanAccountID === acc.loanAccountID;
                                    const displayAccNo = format14DigitDisplay(acc.loanAccountNo);
                                    const schemeName = acc.loanRate?.shortName || acc.loanRate?.loanType || 'कर्ज योजना';
                                    const loanCategory = (acc.loanRate?.shortName && acc.loanRate?.loanType && acc.loanRate.shortName !== acc.loanRate.loanType)
                                        ? acc.loanRate.loanType
                                        : (acc.loanRate?.loanType || 'विनातारणी');
                                    const interestRate = acc.loanRate?.interestRate || acc.interestRate || 0;
                                    const loanCode = acc.loanRate?.loanCode;

                                    return (
                                        <div
                                            key={acc.loanAccountID}
                                            onClick={() => handleSelectLoanFromModal(acc)}
                                            className={`p-3.5 rounded-sm border text-left cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                                                isCurrent
                                                    ? 'bg-primary/5 border-primary ring-2 ring-primary/40 shadow-sm'
                                                    : 'bg-white hover:bg-slate-50/90 border-slate-200 hover:border-primary/50'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-sm mt-0.5 ${isCurrent ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                                    <CreditCard className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono font-bold text-xs text-slate-900 tracking-wide">
                                                            {displayAccNo}
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                            Active
                                                        </span>
                                                        {acc.legacyAccountNumber && (
                                                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
                                                                🏷️ जुने कर्ज क्र: {acc.legacyAccountNumber}
                                                            </span>
                                                        )}
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/25">
                                                            <Award className="w-3.5 h-3.5 text-primary" />
                                                            योजना: {schemeName}
                                                        </span>
                                                        {loanCode && (
                                                            <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm border border-slate-200">
                                                                कोड: {loanCode}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-600 mt-1.5 flex flex-wrap items-center gap-x-2">
                                                        <span>कर्ज प्रकार: <strong className="text-slate-800">{loanCategory}</strong></span>
                                                        {interestRate > 0 && (
                                                            <span>| व्याजदर: <strong className="text-slate-800">{interestRate}%</strong></span>
                                                        )}
                                                        {acc.loanDisbursementDate && (
                                                            <span>
                                                                | वितरण: <span className="text-slate-600 font-medium">{new Date(acc.loanDisbursementDate).toLocaleDateString('en-GB')}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-2">
                                                        <span>मंजूर रक्कम: <strong className="text-slate-800 font-semibold">₹{(acc.sanctionedAmount || 0).toLocaleString('en-IN')}</strong></span>
                                                        {acc.installmentAmount > 0 && (
                                                            <span>
                                                                | हप्ता: <strong className="text-emerald-700 font-semibold">₹{(acc.installmentAmount || 0).toLocaleString('en-IN')}</strong>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 sm:text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">मुद्दल शिल्लक</div>
                                                    <div className="text-base font-black text-rose-700">
                                                        ₹ {(acc.principalBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectLoanFromModal(acc);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                                        isCurrent
                                                            ? 'bg-primary text-white shadow-sm'
                                                            : 'bg-white hover:bg-primary hover:text-white text-primary border border-primary/40'
                                                    }`}
                                                >
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    <span>{isCurrent ? 'निवडलेले आहे' : 'हे कर्ज खाते निवडा'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center text-xs">
                            <span className="text-slate-600 font-medium">
                                कर्ज खाते निवडल्यावर त्याचे हप्ता व व्याज तपशील आपोआप लोड होतील.
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowMultiLoanModal(false)}
                                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-sm font-bold cursor-pointer transition-colors border border-slate-300"
                            >
                                बंद करा (Close)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoanCollectionMaster;

