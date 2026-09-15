import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  UserPlus, 
  Edit3, 
  Trash2, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  UserCheck,
  Phone,
  ShieldCheck,
  RotateCcw,
  Save,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  ArrowRightLeft,
  History,
  CheckSquare,
  Square,
  Users,
  Wallet,
  Calendar,
  Check
} from 'lucide-react';
import CustomerSearchSelect from './common/CustomerSearchSelect';

interface PigmyAgent {
  pigmyAgentID?: number;
  pigmyAgentId?: number;
  id?: number;
  agentName: string;
  joiningDate?: string;
  status: string;
  branchID?: number;
  branch?: {
    branchID: number;
    branchName: string;
    branchCode: string;
  };
  customerID?: number;
  createdBy?: number;
  createdDate?: string;
  username?: string;
  password?: string;
  maxCashLimit?: number;
  maxLockDays?: number;
}

interface Branch {
  branchID: number;
  branchCode: string;
  branchName: string;
}

interface DeleteDependencyInfo {
  agent: PigmyAgent;
  agentId: number;
  accountsCount: number;
  collectionsCount: number;
  message: string;
}

export default function PigmyAgentMaster() {
  const [agents, setAgents] = useState<PigmyAgent[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [nextAgentId, setNextAgentId] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [editingAgentId, setEditingAgentId] = useState<number | null>(null);
  const [deleteDependencyModal, setDeleteDependencyModal] = useState<DeleteDependencyInfo | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Transfer Modal States
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferAgent, setTransferAgent] = useState<PigmyAgent | null>(null);
  const [transferPreCheck, setTransferPreCheck] = useState<any | null>(null);
  const [loadingPreCheck, setLoadingPreCheck] = useState<boolean>(false);
  const [targetAgentId, setTargetAgentId] = useState<number | ''>('');
  const [transferMode, setTransferMode] = useState<'ALL' | 'SELECTIVE'>('ALL');
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [outgoingStatus, setOutgoingStatus] = useState<string>('Suspended');
  const [transferReason, setTransferReason] = useState<string>('एजंट कार्यमुक्ती / खाते हस्तांतरण');
  const [transferRemarks, setTransferRemarks] = useState<string>('');
  const [forceAllowCash, setForceAllowCash] = useState<boolean>(false);
  const [submittingTransfer, setSubmittingTransfer] = useState<boolean>(false);

  // History Modal States
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historyAgent, setHistoryAgent] = useState<PigmyAgent | null>(null);
  const [transferHistoryList, setTransferHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const agentNameInputRef = useRef<HTMLInputElement>(null);
  
  const [customers, setCustomers] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    customerID: '',
    agentName: '',
    username: '',
    password: '',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'Active',
    branchID: '' as number | string,
    maxCashLimit: 20000,
    maxLockDays: 2
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const getAgentId = (agent: PigmyAgent): number => {
    return agent.pigmyAgentID ?? agent.pigmyAgentId ?? agent.id ?? 0;
  };

  const formatAgentCode = (id: number): string => {
    if (!id) return '-';
    return `AGT-${String(id).padStart(3, '0')}`;
  };

  const fetchBranches = async () => {
    try {
      const response = await axios.get('/api/Branches');
      if (response.data) {
        setBranches(response.data);
        if (response.data.length > 0) {
          setFormData(prev => ({
            ...prev,
            branchID: prev.branchID || response.data[0].branchID
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch branches', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/Customers');
      if (response.data) {
        setCustomers(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch customers', error);
    }
  };

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const [agentsRes, nextIdRes] = await Promise.all([
        axios.get('/api/PigmyAgents'),
        axios.get('/api/PigmyAgents/next-id')
      ]);

      let loadedAgents: PigmyAgent[] = [];
      if (agentsRes.data) {
        loadedAgents = agentsRes.data;
        setAgents(loadedAgents);
      } else {
        showToast('एजंट लिस्ट लोड करताना त्रुटी आली.');
      }

      if (nextIdRes.data && nextIdRes.data.nextId) {
        setNextAgentId(nextIdRes.data.nextId);
      } else {
        const maxId = loadedAgents.length > 0 ? Math.max(...loadedAgents.map(a => getAgentId(a))) : 0;
        setNextAgentId(maxId + 1);
      }
    } catch (error) {
      console.error('Failed to fetch agents', error);
      showToast('सर्व्हरशी संपर्क होऊ शकला नाही.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchBranches();
    fetchCustomers();
  }, []);

  const resetForm = () => {
    setEditingAgentId(null);
    setFormData({
      customerID: '',
      agentName: '',
      username: '',
      password: '',
      joiningDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      branchID: branches.length > 0 ? branches[0].branchID : '',
      maxCashLimit: 20000,
      maxLockDays: 2
    });
  };

  const handleEdit = (agent: PigmyAgent) => {
    const id = getAgentId(agent);
    setEditingAgentId(id);
    const formattedJoinDate = agent.joiningDate 
      ? agent.joiningDate.split('T')[0] 
      : new Date().toISOString().split('T')[0];

    setFormData({
      customerID: agent.customerID ? String(agent.customerID) : '',
      agentName: agent.agentName || '',
      username: agent.username || '',
      password: '',
      joiningDate: formattedJoinDate,
      status: agent.status || 'Active',
      branchID: agent.branchID || agent.branch?.branchID || (branches.length > 0 ? branches[0].branchID : ''),
      maxCashLimit: agent.maxCashLimit || 20000,
      maxLockDays: agent.maxLockDays || 2
    });
    showToast(`एजंट '${agent.agentName}' (ID: ${formatAgentCode(id)}) चे डिटेल्स फॉर्ममध्ये भरले आहेत. बदल करून अपडेट बटणावर क्लिक करा.`);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (agentNameInputRef.current) {
        agentNameInputRef.current.focus();
        agentNameInputRef.current.select();
      }
    }, 120);
  };

  const handleDelete = async (agent: PigmyAgent, force: boolean = false) => {
    const id = getAgentId(agent);
    if (!id) {
      showToast('वैध एजंट आयडी (Valid Agent ID) सापडला नाही.');
      return;
    }

    if (!force && !window.confirm(`तुम्हाला नक्की एजंट '${agent.agentName}' (ID: #${id}) डिलीट करायचा आहे का?`)) {
      return;
    }

    try {
      const url = `/api/PigmyAgents/${id}${force ? '?force=true' : ''}`;
      const response = await axios.delete(url);

      showToast(response.data?.message || `एजंट '${agent.agentName}' यशस्वीरित्या हटवला गेला.`);
      if (editingAgentId === id) {
        resetForm();
      }
      setDeleteDependencyModal(null);
      fetchAgents();
    } catch (error: any) {
      console.error('Error deleting agent', error);
      const data = error.response?.data;
      if (data?.hasDependencies) {
        setDeleteDependencyModal({
          agent,
          agentId: id,
          accountsCount: data.accountsCount || 0,
          collectionsCount: data.collectionsCount || 0,
          message: data.message || 'या एजंटशी इतर नोंदी जोडलेल्या आहेत.'
        });
      } else {
        showToast(data?.message || 'एजंट डिलीट करताना सर्व्हर त्रुटी आली.');
      }
    }
  };

  const handleMakeInactive = async (agent: PigmyAgent) => {
    const id = getAgentId(agent);
    try {
      await axios.put(`/api/PigmyAgents/${id}`, {
        pigmyAgentID: id,
        agentName: agent.agentName,
        joiningDate: agent.joiningDate,
        status: 'Inactive',
        branchID: agent.branchID || agent.branch?.branchID
      });

      showToast(`एजंट '${agent.agentName}' ची स्थिती (Status) 'Inactive' करण्यात आली.`);
      setDeleteDependencyModal(null);
      fetchAgents();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'एजंट इनॲक्टिव्ह करताना त्रुटी आली.');
    }
  };

  const openTransferModal = async (agent: PigmyAgent) => {
    const id = getAgentId(agent);
    if (!id) return;
    setTransferAgent(agent);
    setTransferPreCheck(null);
    setTargetAgentId('');
    setTransferMode('ALL');
    setSelectedAccountIds([]);
    setAccountSearch('');
    setOutgoingStatus('Suspended');
    setTransferReason('एजंट कार्यमुक्ती / खाते हस्तांतरण');
    setTransferRemarks('');
    setForceAllowCash(false);
    setIsTransferModalOpen(true);
    setDeleteDependencyModal(null);
    setLoadingPreCheck(true);

    try {
      const res = await axios.get(`/api/PigmyAgents/${id}/TransferPreCheck`);
      setTransferPreCheck(res.data);
      if (res.data.activeAccounts) {
        setSelectedAccountIds(res.data.activeAccounts.map((a: any) => a.pigmyAccountId));
      }
    } catch (err: any) {
      console.error('Error fetching transfer precheck', err);
      showToast(err.response?.data?.message || 'हस्तांतरण माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoadingPreCheck(false);
    }
  };

  const openHistoryModal = async (agent: PigmyAgent) => {
    const id = getAgentId(agent);
    if (!id) return;
    setHistoryAgent(agent);
    setTransferHistoryList([]);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);

    try {
      const res = await axios.get(`/api/PigmyAgents/${id}/TransferHistory`);
      setTransferHistoryList(res.data || []);
    } catch (err: any) {
      console.error('Error fetching transfer history', err);
      showToast(err.response?.data?.message || 'हस्तांतरण इतिहास लोड करताना त्रुटी आली.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleAccountSelection = (accId: number) => {
    setSelectedAccountIds(prev => 
      prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]
    );
  };

  const toggleSelectAllAccounts = () => {
    if (!transferPreCheck?.activeAccounts) return;
    const filteredAccounts = transferPreCheck.activeAccounts.filter((a: any) => 
      a.accountNo?.toLowerCase().includes(accountSearch.toLowerCase()) ||
      a.customerName?.toLowerCase().includes(accountSearch.toLowerCase())
    );
    const filteredIds = filteredAccounts.map((a: any) => a.pigmyAccountId);
    const allSelected = filteredIds.every((id: number) => selectedAccountIds.includes(id));

    if (allSelected) {
      setSelectedAccountIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedAccountIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAgent) return;
    const fromId = getAgentId(transferAgent);
    if (!targetAgentId) {
      alert('कृपया हस्तांतरणासाठी नवीन सक्रिय एजंट (Target Agent) निवडा.');
      return;
    }
    if (transferMode === 'SELECTIVE' && selectedAccountIds.length === 0) {
      alert('कृपया हस्तांतरणासाठी किमान एक खाते निवडा.');
      return;
    }

    if (transferPreCheck?.hasPendingCash && !forceAllowCash && outgoingStatus !== 'KeepActive') {
      alert(`एजंटकडे ₹${Number(transferPreCheck.pendingCash).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ची जमा न झालेली रोकड शिल्लक (Unremitted Cash) आहे. कृपया रोकड शाखेत जमा करा अथवा 'व्यवस्थापकीय ओव्हरराईड' निवडा.`);
      return;
    }

    const countToTransfer = transferMode === 'ALL' ? (transferPreCheck?.activeAccountsCount || 0) : selectedAccountIds.length;
    const targetAgentObj = transferPreCheck?.targetAgents?.find((a: any) => a.pigmyAgentId === Number(targetAgentId));
    const confirmMsg = `तुम्हाला नक्की ${countToTransfer} खाती '${targetAgentObj?.agentName || 'नवीन एजंट'}' यांच्याकडे वर्ग करायची आहेत का?`;
    if (!window.confirm(confirmMsg)) return;

    setSubmittingTransfer(true);
    try {
      const payload = {
        fromAgentId: fromId,
        toAgentId: Number(targetAgentId),
        accountIds: transferMode === 'SELECTIVE' ? selectedAccountIds : null,
        newFromAgentStatus: outgoingStatus,
        reason: transferReason,
        remarks: transferRemarks,
        forceAllowWithCashBalance: forceAllowCash
      };

      const res = await axios.post('/api/PigmyAgents/TransferAccounts', payload);
      showToast(res.data?.message || 'खाती यशस्वीरित्या वर्ग झाली!');
      setIsTransferModalOpen(false);
      fetchAgents();
    } catch (err: any) {
      console.error('Error executing transfer', err);
      alert(err.response?.data?.message || 'खाते हस्तांतरण करताना त्रुटी आली.');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.agentName.trim()) {
      showToast('कृपया एजंटचे नाव प्रविष्ट करा.');
      return;
    }

    try {
      const isEditing = editingAgentId !== null;
      const url = isEditing 
        ? `/api/PigmyAgents/${editingAgentId}` 
        : `/api/PigmyAgents`;

      const payload = isEditing 
        ? { pigmyAgentID: editingAgentId, ...formData, customerID: formData.customerID ? Number(formData.customerID) : null, branchID: formData.branchID ? Number(formData.branchID) : null }
        : { ...formData, customerID: formData.customerID ? Number(formData.customerID) : null, branchID: formData.branchID ? Number(formData.branchID) : null };

      const response = isEditing 
        ? await axios.put(url, payload)
        : await axios.post(url, payload);

      const data = response.data || {};
      const savedId = getAgentId(data) || data.pigmyAgentID || nextAgentId;

      showToast(
        isEditing 
          ? `एजंट '${formData.agentName}' ची माहिती अपडेट झाली!` 
          : `नवीन एजंट '${formData.agentName}' (${formatAgentCode(savedId)}) यशस्वीरित्या जतन (Save) झाला!`
      );
      resetForm();
      fetchAgents();
    } catch (error: any) {
      console.error('Error saving agent', error);
      showToast(error.response?.data?.message || 'माहिती सबमिट करताना सर्व्हर त्रुटी आली.');
    }
  };

  const filteredAgents = agents.filter(agent => {
    const idStr = getAgentId(agent).toString();
    const matchesSearch = agent.agentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      idStr.includes(searchTerm);

    const agentBranchId = agent.branchID || agent.branch?.branchID;
    const matchesBranch = selectedBranchFilter === 'ALL' || (agentBranchId && agentBranchId.toString() === selectedBranchFilter);

    return matchesSearch && matchesBranch;
  });

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Custom Toast Notification - Highly Visible */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[9999999] bg-slate-900 border border-slate-700 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 transition-all">
          <AlertCircle className="w-6 h-6 text-amber-400" />
          <span className="font-bold text-sm tracking-wide leading-relaxed">{toastMessage}</span>
        </div>
      )}
      
      {/* Outer Container matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden flex flex-col">
        
        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-white/80" />
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
                <span>पिग्मी एजंट मास्टर (Pigmy Agent Master)</span>
              </h2>
              <p className="text-[10px] text-white/90 font-normal">नवीन पिग्मी एजंट नोंदणी, रुजू दिनांक, माहिती संपादन (Edit) आणि एजंट व्यवस्थापन</p>
            </div>
          </div>

          <button 
            onClick={fetchAgents}
            disabled={loading}
            className="px-2.5 py-0.5 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-sm border border-white/30 flex items-center gap-1 text-xs cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश करा</span>
          </button>
        </div>

        <div className="p-3">

          {/* Add / Edit Form Card */}
          <div 
            ref={formContainerRef}
            className={`p-2.5 rounded-sm border mb-3 transition-all duration-300 ${
              editingAgentId !== null ? 'border-primary ring-2 ring-primary/20 shadow-md bg-blue-50/10' : 'bg-gray-50/80 border-gray-200'
            }`}
          >
            <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                {editingAgentId !== null ? (
                  <>
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-700">एजंट माहिती संपादित करा ({formatAgentCode(editingAgentId)})</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5 text-primary" />
                    <span>१. एजंट प्राथमिक नोंदणी (Add New Agent)</span>
                  </>
                )}
              </span>
              {editingAgentId !== null && (
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="text-[10px] text-gray-500 hover:text-gray-800 underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>रद्द करा (Cancel Edit)</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
              <div className="md:col-span-1">
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-gray-400" />
                  <span>एजंट नंबर / आयडी (Agent No)</span>
                </label>
                <input 
                  type="text" 
                  readOnly
                  disabled
                  value={editingAgentId !== null ? formatAgentCode(editingAgentId) : `${formatAgentCode(nextAgentId)} (ऑटो निर्माण)`}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-gray-100 text-gray-700 font-mono font-bold cursor-not-allowed outline-none"
                  title="आयडी ऑटो-इनक्रिमेंट (Auto-Increment) आहे."
                />
                <span className="text-[10px] text-gray-400 block mt-0.5">Read-Only Auto Code</span>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                  <UserPlus className="w-3 h-3 text-gray-400" />
                  <span>एजंटचे नाव (Agent Name) *</span>
                </label>
                <CustomerSearchSelect
                  customers={customers}
                  value={formData.customerID ? Number(formData.customerID) : ''}
                  onChange={(val) => {
                    const selected = customers.find(c => c.customerID === val);
                    
                    if (val) {
                      // Check if an agent already exists for this customer
                      const existingAgent = agents.find(a => a.customerID === val);
                      if (existingAgent) {
                        handleEdit(existingAgent);
                        showToast(`हा कस्टमर आधीपासूनच '${existingAgent.agentName}' या नावाने नोंदणीकृत आहे. आपण माहिती संपादित करत आहात.`);
                        return;
                      }
                    }

                    // Otherwise, reset edit mode to create a new agent
                    setEditingAgentId(null);
                    
                    setFormData(prev => ({
                      ...prev,
                      customerID: val ? String(val) : '',
                      agentName: selected ? (`${selected.firstName || ''} ${selected.middleName || ''} ${selected.lastName || ''}`.trim() || selected.customerName || prev.agentName) : prev.agentName,
                      password: '', // Clear password when switching to a new user
                      username: ''  // Clear username to prevent mixing up data
                    }));
                  }}
                  placeholder="-- कस्टमर निवडा --"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                  <span>शाखा (Branch) *</span>
                </label>
                <select 
                  required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold"
                  value={formData.branchID}
                  onChange={(e) => setFormData({...formData, branchID: e.target.value ? parseInt(e.target.value) : ''})}
                >
                  <option value="">-- शाखा निवडा --</option>
                  {branches.map(b => (
                    <option key={b.branchID} value={b.branchID}>
                      {b.branchName} ({b.branchCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-gray-400" />
                  <span>स्थिती (Status)</span>
                </label>
                <select 
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="Active">Active (सक्रिय)</option>
                  <option value="Inactive">Inactive (अक्रिय)</option>
                  <option value="Suspended">Suspended (निलंबित)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                  <span>कॅश लिमिट (Max Cash ₹)</span>
                </label>
                <input 
                  type="number"
                  min="0"
                  step="1000"
                  required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold"
                  value={formData.maxCashLimit}
                  onChange={(e) => setFormData({...formData, maxCashLimit: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                  <span>लॉक दिवस (Max Lock Days)</span>
                </label>
                <input 
                  type="number"
                  min="1"
                  step="1"
                  required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold"
                  value={formData.maxLockDays}
                  onChange={(e) => setFormData({...formData, maxLockDays: parseInt(e.target.value) || 1})}
                />
              </div>

              {/* Mobile App Login Details Section */}
              <div className="sm:col-span-2 md:col-span-6 bg-blue-50/50 p-2.5 rounded-sm border border-blue-100 mt-1">
                <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>मोबाईल ॲप्लिकेशन लॉगिन माहिती (Mobile App Credentials)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                      <span>युझरनेम (Username)</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="लॉगिन युझरनेम"
                      autoComplete="off"
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                      <span>पासवर्ड (Password)</span>
                    </label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder={editingAgentId !== null ? "नवीन पासवर्ड (ऐच्छिक)" : "पासवर्ड"}
                        autoComplete="new-password"
                        className="w-full border border-gray-300 rounded-sm pl-2 pr-8 py-1 text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                      />
                      <button
                        type="button"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>


              {/* Action Buttons */}
              <div className="sm:col-span-2 md:col-span-5 flex justify-end gap-2 pt-1 border-t border-gray-200">
                {editingAgentId !== null && (
                  <button 
                    type="button" 
                    onClick={resetForm}
                    className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-sm text-xs font-bold transition cursor-pointer"
                  >
                    रद्द करा (Cancel)
                  </button>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-4 py-1.5 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs shadow-2xs transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : editingAgentId !== null ? (
                    <Save className="w-3.5 h-3.5" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {editingAgentId !== null ? 'बदल जतन करा (Update Agent)' : 'जतन करा (Save Agent)'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Registered Agents List */}
          <div className="bg-white rounded-sm border border-gray-200 overflow-hidden space-y-2">
            
            {/* List Header & Filters */}
            <div className="p-2 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>नोंदणीकृत एजंट लिस्ट (REGISTERED AGENTS: {filteredAgents.length})</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select 
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  className="border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white font-bold focus:outline-none focus:border-primary"
                >
                  <option value="ALL">सर्व शाखा (All Branches)</option>
                  {branches.map(b => (
                    <option key={b.branchID} value={b.branchID}>
                      {b.branchName}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1.5" />
                  <input 
                    type="text"
                    placeholder="नाव किंवा मोबाईलने शोधा..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-7 pr-2 py-1 border border-gray-300 rounded-sm text-xs bg-white focus:outline-none focus:border-primary w-48 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-primary text-white font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-2 px-3 border-r border-white/20">Agent ID</th>
                    <th className="py-2 px-3 border-r border-white/20">एजंटचे नाव (Agent Name)</th>
                    <th className="py-2 px-3 border-r border-white/20">युझरनेम (Username)</th>
                    <th className="py-2 px-3 border-r border-white/20">शाखा (Branch)</th>
                    <th className="py-2 px-3 border-r border-white/20">रुजू दिनांक (Joining Date)</th>
                    <th className="py-2 px-3 border-r border-white/20">लिमिट (Limit)</th>
                    <th className="py-2 px-3 border-r border-white/20">स्थिती (Status)</th>
                    <th className="py-2 px-3 text-center">कारवाई (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading && agents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500 font-bold">
                        लोड होत आहे...
                      </td>
                    </tr>
                  ) : filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500 font-bold">
                        कोणतेही एजंट नोंद सापडली नाही.
                      </td>
                    </tr>
                  ) : (
                    filteredAgents.map((ag) => {
                      const id = getAgentId(ag);
                      const joiningDateStr = ag.joiningDate 
                        ? new Date(ag.joiningDate).toLocaleDateString('en-GB')
                        : '-';
                      const branchName = ag.branch?.branchName || '-';

                      return (
                        <tr key={id} className="hover:bg-blue-50/40 transition">
                          <td className="py-1.5 px-3 font-mono font-bold text-primary border-r border-gray-200">
                            {formatAgentCode(id)}
                          </td>
                          <td className="py-1.5 px-3 font-bold text-gray-900 border-r border-gray-200">
                            {ag.agentName}
                          </td>
                          <td className="py-1.5 px-3 text-gray-600 border-r border-gray-200 font-mono text-[11px]">
                            {ag.username || '-'}
                          </td>
                          <td className="py-1.5 px-3 text-gray-700 border-r border-gray-200">
                            {branchName}
                          </td>
                          <td className="py-1.5 px-3 text-gray-700 border-r border-gray-200">
                            {joiningDateStr}
                          </td>
                          <td className="py-1.5 px-3 text-gray-700 border-r border-gray-200 font-bold">
                            ₹{ag.maxCashLimit?.toLocaleString('en-IN') || '20,000'} <br/>
                            <span className="text-[10px] text-gray-500 font-normal">({ag.maxLockDays || 2} दिवस)</span>
                          </td>
                          <td className="py-1.5 px-3 border-r border-gray-200">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold ${
                              ag.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                              ag.status === 'Inactive' ? 'bg-gray-100 text-gray-800 border border-gray-300' :
                              'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                ag.status === 'Active' ? 'bg-emerald-600' :
                                ag.status === 'Inactive' ? 'bg-gray-500' : 'bg-rose-600'
                              }`}></span>
                              {ag.status}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <div className="flex justify-center gap-1.5">
                              <button 
                                onClick={() => handleEdit(ag)}
                                className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-sm font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                                title="संपादित करा"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>संपादित</span>
                              </button>

                              <button 
                                onClick={() => openTransferModal(ag)}
                                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-sm font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                                title="खाती वर्ग / कार्यमुक्ती (Transfer & Deactivate)"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>खाते वर्ग</span>
                              </button>

                              <button 
                                onClick={() => openHistoryModal(ag)}
                                className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-sm font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                                title="हस्तांतरण इतिहास (Transfer History)"
                              >
                                <History className="w-3 h-3" />
                                <span>इतिहास</span>
                              </button>
                              
                              <button 
                                onClick={() => handleDelete(ag)}
                                className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-sm font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                                title="डिलीट करा"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>डिलीट</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

      {/* DEPENDENCY WARNING POPUP MODAL */}
      {deleteDependencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-amber-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-6 h-6" />
                <div>
                  <h3 className="font-bold text-sm">एजंट डिलीट करण्यापूर्वी सूचना</h3>
                  <p className="text-[10px] text-amber-100">Agent Linked Records Found</p>
                </div>
              </div>
              <button 
                onClick={() => setDeleteDependencyModal(null)}
                className="p-1 rounded-full hover:bg-white/10 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 text-xs space-y-3 bg-slate-50">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-900 text-sm">
                  एजंट: {deleteDependencyModal.agent.agentName} ({formatAgentCode(deleteDependencyModal.agentId)})
                </p>
                <p className="text-slate-600 leading-relaxed">
                  या एजंटच्या नावावर खालील नोंदी नोंदणीकृत आहेत:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-500 font-medium block">पिग्मी खाती</span>
                    <span className="text-sm font-extrabold text-indigo-900">{deleteDependencyModal.accountsCount} खाती</span>
                  </div>
                  <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                    <span className="text-[10px] text-emerald-500 font-medium block">कलेक्शन नोंदी</span>
                    <span className="text-sm font-extrabold text-emerald-900">{deleteDependencyModal.collectionsCount} नोंदी</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-normal">
                खालीलपैकी एक पर्याय निवडा:
              </p>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={() => openTransferModal(deleteDependencyModal.agent)}
                className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>खाती दुसऱ्या एजंटकडे वर्ग करा (Transfer Accounts)</span>
              </button>
              <button
                onClick={() => handleMakeInactive(deleteDependencyModal.agent)}
                className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>एजंट इनॲक्टिव्ह करा</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT TRANSFER & DEACTIVATION MODAL */}
      {isTransferModalOpen && transferAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-800 to-indigo-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-200" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">पिग्मी खाते हस्तांतरण व एजंट कार्यमुक्ती</h3>
                  <p className="text-[10px] text-indigo-200">Pigmy Agent Suspension & Customer Account Reallocation</p>
                </div>
              </div>
              <button 
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingPreCheck ? (
              <div className="p-12 text-center text-gray-500 font-bold flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                <span>एजंट खाती व शिल्लक पडताळणी लोड होत आहे...</span>
              </div>
            ) : (
              <form onSubmit={handleExecuteTransfer} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Outgoing Agent Info Banner */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">सध्याचा एजंट (Outgoing Agent)</span>
                      <span className="text-sm font-bold text-slate-900">
                        {transferAgent.agentName} ({formatAgentCode(getAgentId(transferAgent))})
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">शाखा (Branch)</span>
                      <span className="text-xs font-bold text-slate-800">
                        {transferPreCheck?.agent?.branchName || transferAgent.branch?.branchName || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-500 font-medium block">सक्रिय खाती (Accounts)</span>
                      <span className="text-sm font-extrabold text-indigo-700">
                        {transferPreCheck?.activeAccountsCount || 0}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-500 font-medium block">एकूण ठेव शिल्लक (Deposits)</span>
                      <span className="text-sm font-extrabold text-emerald-700">
                        ₹{Number(transferPreCheck?.totalActiveBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className={`p-2 rounded-lg border text-center ${
                      (transferPreCheck?.pendingCash || 0) > 0 
                        ? 'bg-rose-50 border-rose-200 text-rose-900' 
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}>
                      <span className="text-[10px] font-medium block">
                        {(transferPreCheck?.pendingCash || 0) > 0 ? 'प्रलंबित रोकड (Cash in Hand)' : 'रोकड हिशोब'}
                      </span>
                      <span className="text-sm font-extrabold">
                        ₹{Number(transferPreCheck?.pendingCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cash Balance Warning / Manager Override */}
                {transferPreCheck?.hasPendingCash && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-start gap-2 text-amber-900">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-bold block">रोख वसुली सूचना (Cash Handover Check):</span>
                        या एजंटकडे <span className="font-extrabold text-rose-700">₹{Number(transferPreCheck.pendingCash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> ची जमा न झालेली रोकड शिल्लक आहे. कार्यमुक्तीपूर्वी ही रक्कम शाखेत जमा करणे आवश्यक आहे.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-300 text-xs font-bold text-slate-800 cursor-pointer hover:bg-amber-50/50">
                      <input 
                        type="checkbox"
                        checked={forceAllowCash}
                        onChange={(e) => setForceAllowCash(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>व्यवस्थापकीय मान्यता (Manager Override): शिल्लक रोकड असतानाही खाती हस्तांतरित करण्यास परवानगी द्या.</span>
                    </label>
                  </div>
                )}

                {/* Step 1: Target Agent Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>हस्तांतरणासाठी नवीन एजंट निवडा (Select Target Active Agent) *</span>
                  </label>
                  <select
                    required
                    value={targetAgentId}
                    onChange={(e) => setTargetAgentId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- नवीन एजंट निवडा --</option>
                    {transferPreCheck?.targetAgents?.map((a: any) => (
                      <option key={a.pigmyAgentId} value={a.pigmyAgentId}>
                        {a.agentName} (ID: #{a.pigmyAgentId}) - {a.branchName}
                      </option>
                    ))}
                  </select>
                  {transferPreCheck?.targetAgents?.length === 0 && (
                    <p className="text-[11px] text-rose-600 mt-1 font-bold">
                      कोणताही दुसरा सक्रिय (Active) एजंट उपलब्ध नाही. कृपया आधी नवीन एजंट सक्रिय करा.
                    </p>
                  )}
                </div>

                {/* Step 2: Transfer Mode */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    हस्तांतरण पद्धत (Transfer Mode):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTransferMode('ALL')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        transferMode === 'ALL'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>सर्व सक्रिय खाती वर्ग करा ({transferPreCheck?.activeAccountsCount || 0} खाती)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransferMode('SELECTIVE')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        transferMode === 'SELECTIVE'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>निवडक खाती वर्ग करा ({selectedAccountIds.length} निवडली)</span>
                    </button>
                  </div>
                </div>

                {/* Selective Accounts Table */}
                {transferMode === 'SELECTIVE' && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 p-2 space-y-2">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleSelectAllAccounts}
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                          <span>सर्व निवडा / काढा</span>
                        </button>
                        <span className="text-xs font-bold text-slate-600">
                          निवडली: {selectedAccountIds.length} / {transferPreCheck?.activeAccounts?.length || 0}
                        </span>
                      </div>

                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          placeholder="खाते क्र. किंवा ग्राहक नाव..."
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          className="pl-7 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                        />
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                          <tr>
                            <th className="p-2 text-center w-10">निवडा</th>
                            <th className="p-2">खाते क्र.</th>
                            <th className="p-2">ग्राहक नाव</th>
                            <th className="p-2">योजना</th>
                            <th className="p-2 text-right">शिल्लक (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {transferPreCheck?.activeAccounts
                            ?.filter((a: any) => 
                              a.accountNo?.toLowerCase().includes(accountSearch.toLowerCase()) ||
                              a.customerName?.toLowerCase().includes(accountSearch.toLowerCase())
                            )
                            .map((acc: any) => {
                              const isSelected = selectedAccountIds.includes(acc.pigmyAccountId);
                              return (
                                <tr 
                                  key={acc.pigmyAccountId}
                                  onClick={() => toggleAccountSelection(acc.pigmyAccountId)}
                                  className={`cursor-pointer hover:bg-indigo-50/50 transition ${isSelected ? 'bg-indigo-50/30' : ''}`}
                                >
                                  <td className="p-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleAccountSelection(acc.pigmyAccountId)}
                                      className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                  </td>
                                  <td className="p-2 font-mono font-bold text-indigo-900">{acc.accountNo}</td>
                                  <td className="p-2 font-semibold text-slate-800">{acc.customerName}</td>
                                  <td className="p-2 text-slate-500">{acc.schemeName}</td>
                                  <td className="p-2 text-right font-bold text-slate-900">
                                    ₹{Number(acc.totalDepositedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Step 3: Outgoing Agent Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    हस्तांतरणानंतर मूळ एजंटची स्थिती (Outgoing Agent Status):
                  </label>
                  <select
                    value={outgoingStatus}
                    onChange={(e) => setOutgoingStatus(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Suspended">Suspended (तात्पुरते निलंबित करा) - चौकशी किंवा गैरहजेरी</option>
                    <option value="Terminated">Terminated (कायमस्वरूपी कार्यमुक्त करा) - सेवा समाप्ती / राजीनामा</option>
                    <option value="Inactive">Inactive (अक्रिय करा)</option>
                    <option value="KeepActive">KeepActive (एजंट सक्रिय ठेवा - केवळ खाती वर्ग करा)</option>
                  </select>
                </div>

                {/* Step 4: Reason & Remarks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      हस्तांतरणाचे कारण (Transfer Reason):
                    </label>
                    <select
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-1.5"
                    >
                      <option value="एजंट कार्यमुक्ती / खाते हस्तांतरण">एजंट कार्यमुक्ती / खाते हस्तांतरण</option>
                      <option value="एजंट राजीनामा (Resignation)">एजंट राजीनामा (Resignation)</option>
                      <option value="एजंट निलंबन (Suspension)">एजंट निलंबन (Suspension)</option>
                      <option value="रूट / कार्यक्षेत्र फेरबदल (Route Change)">रूट / कार्यक्षेत्र फेरबदल (Route Change)</option>
                      <option value="ग्राहक विनंती (Customer Request)">ग्राहक विनंती (Customer Request)</option>
                      <option value="इतर (Other)">इतर (Other)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      शेरा / टिप्पणी (Remarks):
                    </label>
                    <input
                      type="text"
                      placeholder="काही विशेष नोंद असल्यास..."
                      value={transferRemarks}
                      onChange={(e) => setTransferRemarks(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    रद्द करा (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTransfer || !targetAgentId || (transferMode === 'SELECTIVE' && selectedAccountIds.length === 0)}
                    className="px-5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {submittingTransfer ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRightLeft className="w-4 h-4" />
                    )}
                    <span>खाती वर्ग करा (Confirm & Execute Transfer)</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TRANSFER HISTORY MODAL */}
      {isHistoryModalOpen && historyAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <History className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">खाते हस्तांतरण इतिहास (Transfer History Log)</h3>
                  <p className="text-[10px] text-slate-300">
                    एजंट: {historyAgent.agentName} ({formatAgentCode(getAgentId(historyAgent))})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center text-gray-500 font-bold flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                <span>इतिहास नोंदी लोड होत आहेत...</span>
              </div>
            ) : transferHistoryList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-bold">
                या एजंटशी संबंधित कोणतीही हस्तांतरण नोंद सापडली नाही.
              </div>
            ) : (
              <div className="p-4 max-h-[75vh] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2">दिनांक व वेळ</th>
                      <th className="p-2">बॅच क्र.</th>
                      <th className="p-2">खाते क्र. व ग्राहक</th>
                      <th className="p-2">हस्तांतरण (From ➔ To)</th>
                      <th className="p-2 text-right">शिल्लक रक्कम</th>
                      <th className="p-2 text-center">प्रकार</th>
                      <th className="p-2">कारण</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transferHistoryList.map((item: any) => {
                      const isOutgoing = item.fromAgentID === getAgentId(historyAgent);
                      return (
                        <tr key={item.transferID} className="hover:bg-slate-50 transition">
                          <td className="p-2 text-slate-600 font-medium">
                            {new Date(item.transferredOn).toLocaleString('en-GB')}
                          </td>
                          <td className="p-2 font-mono text-[11px] text-slate-500">{item.batchNumber}</td>
                          <td className="p-2">
                            <span className="font-mono font-bold text-indigo-900 block">{item.accountNo}</span>
                            <span className="text-[11px] text-slate-600">{item.customerName}</span>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1.5 font-bold">
                              <span className={isOutgoing ? 'text-rose-700' : 'text-slate-700'}>{item.fromAgentName}</span>
                              <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                              <span className={!isOutgoing ? 'text-emerald-700' : 'text-slate-700'}>{item.toAgentName}</span>
                            </div>
                          </td>
                          <td className="p-2 text-right font-bold text-slate-900">
                            ₹{Number(item.totalBalanceAtTransfer).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.transferType === 'BULK' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {item.transferType}
                            </span>
                          </td>
                          <td className="p-2 text-slate-600 text-[11px]">{item.reason || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
}
