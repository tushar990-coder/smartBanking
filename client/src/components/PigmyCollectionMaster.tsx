import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  PlusIcon, 
  ArrowPathIcon, 
  TableCellsIcon,
  CheckCircleIcon,
  DevicePhoneMobileIcon,
  DocumentArrowUpIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  SparklesIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface Customer {
  customerID: number;
  cifNo?: string;
  customerName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  mobileNo?: string;
}

interface Agent {
  pigmyAgentID: number;
  agentName: string;
  agentCode?: string;
  agentNumber?: string;
  branchID?: number;
  branch?: { branchName: string };
}

interface PigmyAccount {
  pigmyAccountID: number;
  accountNo: string;
  customerID: number;
  pigmyAgentID: number;
  totalDepositedAmount: number;
  status: string;
  customer?: Customer;
  pigmyAgent?: Agent;
  agent?: Agent;
}

interface CollectionHistory {
  collectionId: number;
  receiptNo: string;
  collectionDate: string;
  collectionAmount: number;
  collectionSource: string;
  pigmyAccountNo: string;
  agentName: string;
}

export default function PigmyCollectionMaster() {
  const [activeTab, setActiveTab] = useState<'bulk' | 'manual' | 'app' | 'history'>('bulk');
  
  // Data States
  const [agents, setAgents] = useState<Agent[]>([]);
  const [accounts, setAccounts] = useState<PigmyAccount[]>([]);
  const [history, setHistory] = useState<CollectionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);

  // Bulk Sheet States
  const [selectedAgentId, setSelectedAgentId] = useState<number | ''>('');
  const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bulkAmounts, setBulkAmounts] = useState<{ [accountId: number]: string }>({});
  const [sheetSearchTerm, setSheetSearchTerm] = useState<string>('');

  // Single Manual Form State
  const [manualForm, setManualForm] = useState({
    pigmyAccountId: '',
    collectionDate: new Date().toISOString().split('T')[0],
    collectionAmount: ''
  });

  // App Sync State
  const [appSyncJson, setAppSyncJson] = useState('[\n  {\n    "pigmyAccountId": 1,\n    "agentId": 1,\n    "collectionDate": "2026-08-09",\n    "collectionAmount": 100,\n    "syncReferenceId": "uuid-1234"\n  }\n]');

  // Refs for auto-focus keyboard navigation
  const inputRefs = useRef<{ [accountId: number]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchAgents();
    fetchAccounts();
    fetchHistory();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await axios.get('/api/PigmyAgents');
      setAgents(res.data || []);
    } catch (err) {
      console.error('Failed to fetch agents', err);
    }
  };

  const fetchAccounts = async () => {
    setFetchingAccounts(true);
    try {
      const res = await axios.get('/api/PigmyAccounts');
      const data = res.data || [];
      setAccounts(data);

      const params = new URLSearchParams(window.location.search);
      const entityIdStr = params.get('entityId');
      const pigmyAccountIdStr = params.get('pigmyAccountId') || params.get('id');
      const targetId = pigmyAccountIdStr ? parseInt(pigmyAccountIdStr) : (entityIdStr ? parseInt(entityIdStr) : null);

      if (targetId) {
        setActiveTab('manual');
        setManualForm(prev => ({ ...prev, pigmyAccountId: targetId.toString() }));
      }
    } catch (err) {
      console.error(err);
      toast.error('पिग्मी खाती लोड करताना त्रुटी आली.');
    } finally {
      setFetchingAccounts(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/PigmyCollections');
      setHistory(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Safe Property Extractors
  const getAgentId = (a: any): number => {
    if (!a) return 0;
    const id = a.pigmyAgentID ?? a.pigmyAgentId ?? a.PigmyAgentID ?? a.id;
    return typeof id === 'number' ? id : parseInt(id) || 0;
  };

  const getCustomerFullName = (c: any): string => {
    if (!c) return '-';
    if (c.customerName) return c.customerName;
    const fn = c.firstName || c.FirstName || '';
    const mn = c.middleName || c.MiddleName || '';
    const ln = c.lastName || c.LastName || '';
    const name = `${fn} ${mn} ${ln}`.replace(/\s+/g, ' ').trim();
    return name || '-';
  };

  // Filter accounts belonging to the selected agent
  const agentAccounts = accounts.filter(acc => {
    const accAgentId = acc.pigmyAgentID || getAgentId(acc.pigmyAgent) || getAgentId(acc.agent);
    const matchesAgent = selectedAgentId ? accAgentId === Number(selectedAgentId) : false;
    const isActive = acc.status === 'Active';
    return matchesAgent && isActive;
  });

  const filteredAgentAccounts = agentAccounts.filter(acc => {
    if (!sheetSearchTerm) return true;
    const query = sheetSearchTerm.toLowerCase();
    const accNo = (acc.accountNo || '').toLowerCase();
    const customerName = getCustomerFullName(acc.customer).toLowerCase();
    const mob = (acc.customer?.mobileNo || '').toLowerCase();
    return accNo.includes(query) || customerName.includes(query) || mob.includes(query);
  });

  // Calculate Sheet Totals
  const totalSheetCount = agentAccounts.length;
  const collectedItems = Object.entries(bulkAmounts).filter(([_, val]) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  });
  const collectedCount = collectedItems.length;
  const totalBulkRemittance = Object.values(bulkAmounts).reduce((sum, val) => {
    const num = parseFloat(val);
    return sum + (!isNaN(num) && num > 0 ? num : 0);
  }, 0);

  const handleAmountInputChange = (accountId: number, val: string) => {
    setBulkAmounts(prev => ({
      ...prev,
      [accountId]: val
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextAcc = filteredAgentAccounts[currentIndex + 1];
      if (nextAcc && inputRefs.current[nextAcc.pigmyAccountID]) {
        inputRefs.current[nextAcc.pigmyAccountID]?.focus();
        inputRefs.current[nextAcc.pigmyAccountID]?.select();
      }
    }
  };

  const handleBulkSubmit = async () => {
    if (!selectedAgentId) {
      toast.error('कृपया आधी पिग्मी एजंट निवडा.');
      return;
    }

    const items = Object.entries(bulkAmounts)
      .map(([accIdStr, val]) => ({
        pigmyAccountId: parseInt(accIdStr),
        collectionAmount: parseFloat(val) || 0
      }))
      .filter(i => i.collectionAmount > 0);

    if (items.length === 0) {
      toast.error('कृपया किमान एका खात्याची जमा रक्कम प्रविष्ट करा.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        agentId: Number(selectedAgentId),
        collectionDate: collectionDate,
        items: items
      };

      const res = await axios.post('/api/PigmyCollections/BulkManual', payload);
      toast.success(res.data.message || 'कलेक्शन यशस्वीरीत्या जमा झाले!');
      
      // Reset sheet entries & refresh data
      setBulkAmounts({});
      fetchHistory();
      fetchAccounts();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'बल्क कलेक्शन सेव्ह करताना त्रुटी आली.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.pigmyAccountId || !manualForm.collectionAmount) {
      toast.error('कृपया सर्व आवश्यक माहिती भरा.');
      return;
    }

    const selectedAcc = accounts.find(a => a.pigmyAccountID.toString() === manualForm.pigmyAccountId);
    if (!selectedAcc) return;

    setLoading(true);
    try {
      const payload = {
        pigmyAccountId: parseInt(manualForm.pigmyAccountId),
        agentId: selectedAcc.pigmyAgentID,
        collectionDate: manualForm.collectionDate,
        collectionAmount: parseFloat(manualForm.collectionAmount)
      };

      const res = await axios.post('/api/PigmyCollections/Manual', payload);
      toast.success(`कलेक्शन सेव्ह झाले! पावती क्र.: ${res.data.receiptNo}`);
      setManualForm({ ...manualForm, collectionAmount: '', pigmyAccountId: '' });
      fetchHistory();
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data || 'कलेक्शन सेव्ह करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppSync = async () => {
    try {
      const payload = JSON.parse(appSyncJson);
      setLoading(true);
      const res = await axios.post('/api/PigmyCollections/AppSync', payload);
      toast.success(res.data.message || 'अ‍ॅप डेटा सिंक यशस्वी!');
      fetchHistory();
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data || 'अवैध JSON किंवा सिंक त्रुटी.');
    } finally {
      setLoading(false);
    }
  };

  const selectedSingleAccount = accounts.find(a => a.pigmyAccountID.toString() === manualForm.pigmyAccountId);
  const selectedAgentObj = agents.find(a => getAgentId(a) === Number(selectedAgentId));

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
      {/* Outer Container matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden flex flex-col">
        
        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5 text-blue-200" />
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
                <span>पिग्मी दैनंदिन जमा (Pigmy Deposit Collection Center)</span>
              </h2>
              <p className="text-[10px] text-blue-100 font-normal">एजंटनिहाय बल्क कलेक्शन पत्रक, एकल खाते नोंदणी आणि मोबाईल अ‍ॅप सिंक ताळमेळ</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchAccounts(); fetchHistory(); }}
              className="px-2.5 py-0.5 bg-blue-800/60 hover:bg-blue-800 text-white font-semibold rounded-sm border border-blue-400/40 flex items-center gap-1 text-xs cursor-pointer"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${fetchingAccounts ? 'animate-spin' : ''}`} />
              <span>रिफ्रेश</span>
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">

          {/* Mode Navigation Tabs */}
          <div className="inline-flex items-center p-0.5 bg-gray-100/90 rounded-sm border border-gray-300 gap-0.5 print:hidden">
            <button
              type="button"
              onClick={() => setActiveTab('bulk')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'bulk' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <UserGroupIcon className="w-3 h-3" />
              <span>१. बल्क कलेक्शन (Bulk Sheet)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'manual' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <PlusIcon className="w-3 h-3" />
              <span>२. मॅन्युअल नोंद (Single)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('app')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'app' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <DevicePhoneMobileIcon className="w-3 h-3" />
              <span>३. अ‍ॅप सिंक (App Sync)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-sm cursor-pointer transition flex items-center gap-1 ${
                activeTab === 'history' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <ClockIcon className="w-3 h-3" />
              <span>४. व्यवहार इतिहास (History)</span>
            </button>
          </div>

      {/* TAB 1: BULK AGENT COLLECTION SHEET */}
      {activeTab === 'bulk' && (
        <div className="space-y-3">
          
          {/* Header Controls: Select Agent & Date */}
          <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-2.5">
            
            {/* SELECT AGENT */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center justify-between">
                <span>१. पिग्मी एजंट निवडा (Select Agent) *</span>
                {selectedAgentId && (
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-sm">
                    {totalSheetCount} खाती उपलब्ध
                  </span>
                )}
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => {
                  setSelectedAgentId(e.target.value ? Number(e.target.value) : '');
                  setBulkAmounts({});
                }}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">-- पिग्मी एजंट निवडा --</option>
                {agents.map((a) => {
                  const aId = getAgentId(a);
                  const branchName = a.branch?.branchName || '';
                  return (
                    <option key={`ag-${aId}`} value={aId}>
                      {a.agentName} {a.agentCode ? `(${a.agentCode})` : ''} {branchName ? `- [${branchName}]` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* COLLECTION DATE */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                २. जमा तारीख (Collection Date) *
              </label>
              <input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            {/* SEARCH CUSTOMER SHEET FILTER */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                ३. पत्रकात शोधा (Search Customer / A/C)
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="नाव, खाते क्र. किंवा मोबाईल..."
                  value={sheetSearchTerm}
                  onChange={(e) => setSheetSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 border border-gray-300 rounded-sm bg-white text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          {/* BULK SHEET GRID */}
          {!selectedAgentId ? (
            <div className="py-10 text-center bg-gray-50/80 rounded border border-dashed border-gray-300 p-4 space-y-1">
              <UserGroupIcon className="w-10 h-10 text-gray-400 mx-auto" />
              <h3 className="font-bold text-gray-700 text-xs">कृपया वरील ड्रॉपडाउनमधून पिग्मी एजंट निवडा.</h3>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                एजंट निवडताच त्याच्या हाताखालील सर्व ग्राहकांची खाती पत्रकात लोड होतील आणि एकाच वेळी दैनंदिन जमा नोंदवता येईल.
              </p>
            </div>
          ) : agentAccounts.length === 0 ? (
            <div className="py-8 text-center bg-amber-50 rounded border border-amber-200 p-4">
              <p className="font-bold text-amber-900 text-xs">
                निवडलेल्या एजंटच्या नावावर कोणतेही सक्रिय पिग्मी खाते आढळले नाही.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              
              {/* Sheet Instructions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-blue-50/80 border border-blue-200 rounded-sm p-2 text-xs text-blue-900">
                <div className="flex items-center gap-1.5">
                  <SparklesIcon className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    <strong>रॅपिड एंट्री टीप:</strong> आजची जमा रक्कम टाकून कीबोर्डवरील <kbd className="px-1.5 py-0.2 bg-white border border-blue-300 rounded-sm font-mono font-bold text-[10px]">Enter</kbd> दाबल्यास आपोआप पुढील ओळीवर फोकस होईल.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkAmounts({})}
                  className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline shrink-0 cursor-pointer"
                >
                  रक्कम पत्रक रीसेट करा (Reset Sheet)
                </button>
              </div>

              {/* Table Sheet */}
              <div className="overflow-x-auto border border-gray-200 rounded-sm shadow-2xs">
                <table className="w-full text-xs text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                      <th className="py-2 px-2.5 text-center w-10 border-r border-gray-200">#</th>
                      <th className="py-2 px-2.5 border-r border-gray-200">खाते क्रमांक (Account No)</th>
                      <th className="py-2 px-2.5 border-r border-gray-200">ग्राहकाचे नाव (Customer Name)</th>
                      <th className="py-2 px-2.5 border-r border-gray-200">मोबाईल नंबर (Mobile)</th>
                      <th className="py-2 px-2.5 text-right border-r border-gray-200">सध्याची जमा ठेव (Current ₹)</th>
                      <th className="py-2 px-3 text-right bg-emerald-100/70 text-emerald-900 font-extrabold">
                        आजची जमा रक्कम (Collection Amount ₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs">
                    {filteredAgentAccounts.map((acc, index) => {
                      const accId = acc.pigmyAccountID;
                      const customerName = getCustomerFullName(acc.customer);
                      const currentBal = acc.totalDepositedAmount || 0;
                      const hasEntered = Boolean(bulkAmounts[accId] && parseFloat(bulkAmounts[accId]) > 0);

                      return (
                        <tr 
                          key={accId} 
                          className={`transition-colors ${
                            hasEntered ? 'bg-emerald-50/80 font-semibold' : 'hover:bg-blue-50/40'
                          }`}
                        >
                          <td className="py-1.5 px-2.5 text-center font-mono text-gray-500 font-bold border-r border-gray-200">
                            {index + 1}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-primary border-r border-gray-200">
                            {acc.accountNo}
                          </td>
                          <td className="py-1.5 px-2.5 font-bold text-gray-900 border-r border-gray-200">
                            {customerName}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono text-gray-600 border-r border-gray-200">
                            {acc.customer?.mobileNo || '-'}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-700 border-r border-gray-200">
                            ₹ {currentBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-1 px-2.5 bg-emerald-50/40">
                            <input
                              ref={(el) => (inputRefs.current[accId] = el)}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={bulkAmounts[accId] || ''}
                              onChange={(e) => handleAmountInputChange(accId, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index)}
                              className="w-full text-right border border-gray-300 rounded-sm px-2 py-0.5 bg-white text-gray-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* SHEET SUMMARY BAR & SAVE BUTTON */}
              <div className="bg-primary text-white rounded-sm p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                
                <div className="grid grid-cols-3 gap-4 text-xs w-full md:w-auto">
                  <div>
                    <span className="text-blue-100 text-[10px] block font-medium uppercase">एकूण खाती</span>
                    <span className="font-mono font-bold text-sm text-white">{totalSheetCount}</span>
                  </div>
                  <div>
                    <span className="text-blue-100 text-[10px] block font-medium uppercase">जमा खाती</span>
                    <span className="font-mono font-bold text-sm text-emerald-300">{collectedCount}</span>
                  </div>
                  <div>
                    <span className="text-blue-100 text-[10px] block font-medium uppercase">एकूण रोख जमा (Remittance)</span>
                    <span className="font-mono font-extrabold text-base text-yellow-300">
                      ₹ {totalBulkRemittance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleBulkSubmit}
                    disabled={loading || collectedCount === 0}
                    className="w-full md:w-auto px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-sm shadow-xs transition flex items-center justify-center gap-1 text-xs cursor-pointer"
                  >
                    {loading ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircleIcon className="w-4 h-4" />
                    )}
                    <span>सर्व कलेक्शन सेव्ह करा ({collectedCount} खाती)</span>
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* TAB 2: SINGLE MANUAL ENTRY */}
      {activeTab === 'manual' && (
        <div className="bg-gray-50/80 p-3 rounded border border-gray-200 space-y-3">
          <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider pb-1 border-b border-gray-200 flex items-center gap-1.5">
            <PlusIcon className="w-4 h-4 text-primary" />
            <span>एकल खाते मॅन्युअल नोंदणी (Single Account Manual Collection)</span>
          </div>
          
          <form onSubmit={handleSingleManualSubmit} className="max-w-3xl space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              <div className="space-y-0.5 md:col-span-2">
                <label className="text-[11px] font-medium text-gray-600">पिग्मी खाते निवडा (Select Account) *</label>
                <select 
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={manualForm.pigmyAccountId}
                  onChange={(e) => setManualForm({...manualForm, pigmyAccountId: e.target.value})}
                  required
                >
                  <option value="">-- पिग्मी खाते क्र. किंवा नाव शोधा --</option>
                  {accounts.filter(a => a.status === 'Active').map(acc => (
                    <option key={acc.pigmyAccountID} value={acc.pigmyAccountID}>
                      {acc.accountNo} - {getCustomerFullName(acc.customer)} (एजंट: {acc.agent?.agentName || acc.pigmyAgent?.agentName || '-'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSingleAccount && (
                <div className="md:col-span-2 bg-blue-50/80 p-2.5 rounded-sm border border-blue-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">सध्याची एकूण ठेव (Current Balance)</p>
                    <p className="text-sm font-extrabold text-primary font-mono">
                      ₹ {selectedSingleAccount.totalDepositedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right space-y-0.5 text-[11px]">
                    <p className="text-gray-700 font-bold">ग्राहक: <span className="text-gray-900">{getCustomerFullName(selectedSingleAccount.customer)}</span></p>
                    <p className="text-gray-600">एजंट: <span className="text-gray-800">{selectedSingleAccount.agent?.agentName || selectedSingleAccount.pigmyAgent?.agentName || '-'}</span></p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-0.5 block">जमा तारीख (Collection Date) *</label>
                <input 
                  type="date" 
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white font-bold focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={manualForm.collectionDate}
                  onChange={(e) => setManualForm({...manualForm, collectionDate: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-0.5 block">जमा रक्कम (Collection Amount ₹) *</label>
                <input 
                  type="number" 
                  min="1"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white font-mono font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={manualForm.collectionAmount}
                  onChange={(e) => setManualForm({...manualForm, collectionAmount: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className="flex items-center gap-1 px-4 py-1.5 bg-primary hover:bg-[#004a75] text-white font-bold rounded-sm text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <CheckCircleIcon className="w-3.5 h-3.5" />}
                <span>कलेक्शन सेव्ह करा (Save Collection)</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: APP SYNC */}
      {activeTab === 'app' && (
        <div className="bg-gray-50/80 p-3 rounded border border-gray-200 space-y-3">
          <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider pb-1 border-b border-gray-200 flex justify-between items-center">
            <h2 className="flex items-center gap-1.5">
              <DevicePhoneMobileIcon className="w-4 h-4 text-indigo-600" />
              <span>मोबाईल अ‍ॅप सिंक (Mobile App Sync Simulator)</span>
            </h2>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-sm border border-amber-200">
              Idempotency Protected
            </span>
          </div>
          
          <p className="text-gray-600 text-xs">
            एजंट मोबाईल अ‍ॅपमधील ऑफलाइन जमा व्यवहारांचा JSON डेटा येथे सिंक करण्यासाठी एंटर करा.
          </p>

          <textarea
            className="w-full h-48 p-3 font-mono text-xs bg-slate-900 text-emerald-400 rounded-sm border border-slate-700 focus:outline-none"
            value={appSyncJson}
            onChange={(e) => setAppSyncJson(e.target.value)}
          />

          <div className="flex justify-end">
            <button 
              onClick={handleAppSync}
              disabled={loading}
              className="flex items-center gap-1 px-4 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-sm text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <DocumentArrowUpIcon className="w-3.5 h-3.5" />}
              <span>सिंक डेटा सेव्ह करा (Process Sync)</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: COLLECTION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-sm border border-gray-200 p-3 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">नुकतेच झालेले पिग्मी व्यवहार (Recent Collections History)</h2>
            <button onClick={fetchHistory} className="text-xs text-primary hover:underline flex items-center font-bold cursor-pointer">
              <ArrowPathIcon className="w-3.5 h-3.5 mr-1" /> रिफ्रेश (Refresh)
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200">
                  <th className="py-2 px-2.5">पावती क्र. (Receipt No)</th>
                  <th className="py-2 px-2.5">तारीख (Date)</th>
                  <th className="py-2 px-2.5">खाते क्रमांक (Account)</th>
                  <th className="py-2 px-2.5">एजंट (Agent)</th>
                  <th className="py-2 px-2.5 text-right">जमा रक्कम (Amount ₹)</th>
                  <th className="py-2 px-2.5 text-center">माध्यम (Source)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 font-medium">
                      कोणताही इतिहास सापडला नाही.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.collectionId} className="hover:bg-blue-50/40 transition">
                      <td className="py-2 px-2.5 font-mono font-bold text-gray-900">{item.receiptNo}</td>
                      <td className="py-2 px-2.5">{new Date(item.collectionDate).toLocaleDateString('en-GB')}</td>
                      <td className="py-2 px-2.5 font-mono font-bold text-primary">{item.pigmyAccountNo}</td>
                      <td className="py-2 px-2.5 font-semibold text-gray-700">{item.agentName}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700">
                        ₹ {item.collectionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                          item.collectionSource === 'MANUAL' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {item.collectionSource}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
}
