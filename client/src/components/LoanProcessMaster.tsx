import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Banknote, ChevronRight } from 'lucide-react';
import LoanApplicationMaster from './LoanApplicationMaster';
import LoanDisbursementMaster from './LoanDisbursementMaster';

interface LoanProcessMasterProps {
    onNavigate?: (tab: string, params?: any) => void;
}

const LoanProcessMaster: React.FC<LoanProcessMasterProps> = ({ onNavigate }) => {
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const subTab = params.get('subTab');
        if (subTab) return parseInt(subTab, 10);
        if (params.get('passingMode') === 'true' && params.get('voucherId')) return 2;
        return 1;
    });
    const [draftApplication, setDraftApplication] = useState<any>(null);
    const [editingDisbursement, setEditingDisbursement] = useState<any>(null);

    const queryParams = new URLSearchParams(window.location.search);
    const voucherIdParam = queryParams.get('voucherId');
    const isPassingMode = queryParams.get('passingMode') === 'true' && Boolean(voucherIdParam);
    const [passingDisbursement, setPassingDisbursement] = useState<any>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const subTab = params.get('subTab');
        if (subTab) {
            setActiveTab(parseInt(subTab, 10));
        } else if (params.get('passingMode') === 'true' && params.get('voucherId')) {
            setActiveTab(2);
        }

        if (isPassingMode && voucherIdParam) {
            axios.get(`/api/LoanDisbursements/by-voucher/${voucherIdParam}`)
                .then(res => {
                    if (res.data) setPassingDisbursement(res.data);
                })
                .catch(err => console.error("LoanProcessMaster failed to load passing disbursement:", err));
        }
    }, [isPassingMode, voucherIdParam]);

    const passingApplicationId = 
        passingDisbursement?.loanAccount?.loanApplicationID || 
        passingDisbursement?.loanAccount?.loanApplicationId || 
        passingDisbursement?.loanAccount?.LoanApplicationID ||
        passingDisbursement?.loanAccount?.loanApplication?.loanApplicationID ||
        passingDisbursement?.loanAccount?.loanApplication?.loanApplicationId;

    const handleNext = (appData: any) => {
        if (isPassingMode) {
            setActiveTab(2);
            return;
        }
        setDraftApplication({...appData});
        setActiveTab(2);
    };

    const handleRequestEditApplication = (disbursement: any) => {
        setEditingDisbursement(disbursement);
        setActiveTab(1);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans">
            {/* Top Modern CBS Workflow Tab Navigation */}
            <div className="bg-white shadow-2xs border-b border-gray-200 z-10 flex px-3 pt-2 gap-2 text-xs font-semibold">
                <button 
                    onClick={() => setActiveTab(1)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-t-sm border-t-2 transition-all cursor-pointer ${
                        activeTab === 1 
                            ? 'border-t-primary border-x border-b-0 border-gray-200 text-primary bg-white font-bold shadow-2xs' 
                            : 'border-t-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                >
                    <FileText size={15} className={activeTab === 1 ? "text-primary" : "text-gray-400"} />
                    <span>१. कर्ज मागणी / अर्ज (Loan Application)</span>
                    {isPassingMode && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] px-1.5 py-0.2 rounded-full font-bold">
                            फक्त वाचन (Read-Only)
                        </span>
                    )}
                </button>
                <button 
                    onClick={() => setActiveTab(2)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-t-sm border-t-2 transition-all cursor-pointer ${
                        activeTab === 2 
                            ? 'border-t-primary border-x border-b-0 border-gray-200 text-primary bg-white font-bold shadow-2xs' 
                            : 'border-t-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                >
                    <Banknote size={15} className={activeTab === 2 ? "text-primary" : "text-gray-400"} />
                    <span>२. कर्ज वितरण / वाटप (Loan Disbursement)</span>
                    {isPassingMode && (
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9.5px] px-1.5 py-0.2 rounded-full font-bold">
                            पासिंग मोड (Passing)
                        </span>
                    )}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto relative">
                <div className={`${activeTab === 1 ? 'block' : 'hidden'}`}>
                    <LoanApplicationMaster 
                        onNext={handleNext} 
                        editingApplicationId={passingApplicationId || editingDisbursement?.loanAccount?.loanApplicationID}
                        isReadOnly={isPassingMode}
                        onNavigate={onNavigate}
                    />
                </div>
                <div className={`${activeTab === 2 ? 'block' : 'hidden'}`}>
                    <LoanDisbursementMaster 
                        draftApplication={draftApplication} 
                        editingDisbursement={editingDisbursement}
                        onRequestEditApplication={handleRequestEditApplication}
                        onSaveSuccess={() => { setActiveTab(1); setDraftApplication(null); setEditingDisbursement(null); }}
                        onNavigate={onNavigate}
                    />
                </div>
            </div>
        </div>
    );
};

export default LoanProcessMaster;
