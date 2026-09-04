import React, { useState } from 'react';
import { FileText, Banknote, ChevronRight } from 'lucide-react';
import LoanApplicationMaster from './LoanApplicationMaster';
import LoanDisbursementMaster from './LoanDisbursementMaster';

const LoanProcessMaster: React.FC = () => {
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const subTab = params.get('subTab');
        return subTab ? parseInt(subTab, 10) : 1;
    });
    const [draftApplication, setDraftApplication] = useState<any>(null);
    const [editingDisbursement, setEditingDisbursement] = useState<any>(null);

    const handleNext = (appData: any) => {
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
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto relative">
                <div className={`${activeTab === 1 ? 'block' : 'hidden'}`}>
                    <LoanApplicationMaster 
                        onNext={handleNext} 
                        editingApplicationId={editingDisbursement?.loanAccount?.loanApplicationID} 
                    />
                </div>
                <div className={`${activeTab === 2 ? 'block' : 'hidden'}`}>
                    <LoanDisbursementMaster 
                        draftApplication={draftApplication} 
                        editingDisbursement={editingDisbursement}
                        onRequestEditApplication={handleRequestEditApplication}
                        onSaveSuccess={() => { setActiveTab(1); setDraftApplication(null); setEditingDisbursement(null); }}
                    />
                </div>
            </div>
        </div>
    );
};

export default LoanProcessMaster;
