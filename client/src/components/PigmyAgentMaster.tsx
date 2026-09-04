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
  X
} from 'lucide-react';

interface PigmyAgent {
  pigmyAgentID?: number;
  pigmyAgentId?: number;
  id?: number;
  agentName: string;
  mobileNo: string;
  joiningDate?: string;
  status: string;
  branchID?: number;
  branch?: {
    branchID: number;
    branchName: string;
    branchCode: string;
  };
  createdBy?: number;
  createdDate?: string;
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
  const formContainerRef = useRef<HTMLDivElement>(null);
  const agentNameInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    agentName: '',
    mobileNo: '',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'Active',
    branchID: '' as number | string
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

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
        setMessage({ type: 'error', text: 'एजंट लिस्ट लोड करताना त्रुटी आली.' });
      }

      if (nextIdRes.data && nextIdRes.data.nextId) {
        setNextAgentId(nextIdRes.data.nextId);
      } else {
        const maxId = loadedAgents.length > 0 ? Math.max(...loadedAgents.map(a => getAgentId(a))) : 0;
        setNextAgentId(maxId + 1);
      }
    } catch (error) {
      console.error('Failed to fetch agents', error);
      setMessage({ type: 'error', text: 'सर्व्हरशी संपर्क होऊ शकला नाही.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchBranches();
  }, []);

  const resetForm = () => {
    setEditingAgentId(null);
    setFormData({
      agentName: '',
      mobileNo: '',
      joiningDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      branchID: branches.length > 0 ? branches[0].branchID : ''
    });
  };

  const handleEdit = (agent: PigmyAgent) => {
    const id = getAgentId(agent);
    setEditingAgentId(id);
    const formattedJoinDate = agent.joiningDate 
      ? agent.joiningDate.split('T')[0] 
      : new Date().toISOString().split('T')[0];

    setFormData({
      agentName: agent.agentName || '',
      mobileNo: agent.mobileNo || '',
      joiningDate: formattedJoinDate,
      status: agent.status || 'Active',
      branchID: agent.branchID || agent.branch?.branchID || (branches.length > 0 ? branches[0].branchID : '')
    });
    setMessage({ type: 'info', text: `एजंट '${agent.agentName}' (ID: ${formatAgentCode(id)}) चे डिटेल्स फॉर्ममध्ये भरले आहेत. बदल करून अपडेट बटणावर क्लिक करा.` });

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
      setMessage({ type: 'error', text: 'वैध एजंट आयडी (Valid Agent ID) सापडला नाही.' });
      return;
    }

    if (!force && !window.confirm(`तुम्हाला नक्की एजंट '${agent.agentName}' (ID: #${id}) डिलीट करायचा आहे का?`)) {
      return;
    }

    try {
      const url = `/api/PigmyAgents/${id}${force ? '?force=true' : ''}`;
      const response = await axios.delete(url);

      setMessage({ type: 'success', text: response.data?.message || `एजंट '${agent.agentName}' यशस्वीरित्या हटवला गेला.` });
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
        setMessage({ type: 'error', text: data?.message || 'एजंट डिलीट करताना सर्व्हर त्रुटी आली.' });
      }
    }
  };

  const handleMakeInactive = async (agent: PigmyAgent) => {
    const id = getAgentId(agent);
    try {
      await axios.put(`/api/PigmyAgents/${id}`, {
        pigmyAgentID: id,
        agentName: agent.agentName,
        mobileNo: agent.mobileNo,
        joiningDate: agent.joiningDate,
        status: 'Inactive',
        branchID: agent.branchID || agent.branch?.branchID
      });

      setMessage({ type: 'success', text: `एजंट '${agent.agentName}' ची स्थिती (Status) 'Inactive' करण्यात आली.` });
      setDeleteDependencyModal(null);
      fetchAgents();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'एजंट इनॲक्टिव्ह करताना त्रुटी आली.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.agentName.trim()) {
      setMessage({ type: 'error', text: 'कृपया एजंटचे नाव प्रविष्ट करा.' });
      return;
    }
    if (!formData.mobileNo.trim()) {
      setMessage({ type: 'error', text: 'कृपया मोबाईल नंबर प्रविष्ट करा.' });
      return;
    }

    try {
      const isEditing = editingAgentId !== null;
      const url = isEditing 
        ? `/api/PigmyAgents/${editingAgentId}` 
        : `/api/PigmyAgents`;

      const payload = isEditing 
        ? { pigmyAgentID: editingAgentId, ...formData, branchID: formData.branchID ? Number(formData.branchID) : null }
        : { ...formData, branchID: formData.branchID ? Number(formData.branchID) : null };

      const response = isEditing 
        ? await axios.put(url, payload)
        : await axios.post(url, payload);

      const data = response.data || {};
      const savedId = getAgentId(data) || data.pigmyAgentID || nextAgentId;

      setMessage({ 
        type: 'success', 
        text: isEditing 
          ? `एजंट '${formData.agentName}' ची माहिती अपडेट झाली!` 
          : `नवीन एजंट '${formData.agentName}' (${formatAgentCode(savedId)}) यशस्वीरित्या जतन (Save) झाला!` 
      });
      resetForm();
      fetchAgents();
    } catch (error: any) {
      console.error('Error saving agent', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'माहिती सबमिट करताना सर्व्हर त्रुटी आली.' });
    }
  };

  const filteredAgents = agents.filter(agent => {
    const idStr = getAgentId(agent).toString();
    const matchesSearch = agent.agentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.mobileNo?.includes(searchTerm) ||
      idStr.includes(searchTerm);

    const agentBranchId = agent.branchID || agent.branch?.branchID;
    const matchesBranch = selectedBranchFilter === 'ALL' || (agentBranchId && agentBranchId.toString() === selectedBranchFilter);

    return matchesSearch && matchesBranch;
  });

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
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

          {/* Alert Message Banner */}
          {message && (
            <div className={`p-2.5 mb-3 rounded-sm border flex items-center gap-2 text-xs font-bold ${
              message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
              message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              {message.type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
              {message.type === 'error' && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
              {message.type === 'info' && <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />}
              <div className="flex-1">{message.text}</div>
              <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600 font-bold text-sm">×</button>
            </div>
          )}

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

            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              <div>
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

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                  <span>एजंटचे नाव (Agent Name) *</span>
                </label>
                <input 
                  ref={agentNameInputRef}
                  type="text" 
                  required
                  placeholder="उदा. राहुल पांडुरंग पाटील"
                  className={`w-full border rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-bold ${
                    editingAgentId !== null ? 'border-primary bg-amber-50/40' : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  value={formData.agentName}
                  onChange={(e) => setFormData({...formData, agentName: e.target.value})}
                />
              </div>

              <div>
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

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-gray-400" />
                  <span>मोबाईल नंबर (Mobile No) *</span>
                </label>
                <input 
                  type="text" 
                  required
                  maxLength={10}
                  placeholder="उदा. 9876543210"
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                  value={formData.mobileNo}
                  onChange={(e) => setFormData({...formData, mobileNo: e.target.value.replace(/\D/g, '')})}
                />
              </div>

              <div>
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
                    <th className="py-2 px-3 border-r border-white/20">शाखा (Branch)</th>
                    <th className="py-2 px-3 border-r border-white/20">मोबाईल नंबर (Mobile)</th>
                    <th className="py-2 px-3 border-r border-white/20">रुजू दिनांक (Joining Date)</th>
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
                          <td className="py-1.5 px-3 text-gray-700 border-r border-gray-200">
                            {branchName}
                          </td>
                          <td className="py-1.5 px-3 font-mono text-gray-700 border-r border-gray-200">
                            {ag.mobileNo}
                          </td>
                          <td className="py-1.5 px-3 text-gray-700 border-r border-gray-200">
                            {joiningDateStr}
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
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>संपादित करा (Edit)</span>
                              </button>
                              
                              <button 
                                onClick={() => handleDelete(ag)}
                                className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-sm font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>डिलीट (Delete)</span>
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
                onClick={() => handleMakeInactive(deleteDependencyModal.agent)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1"
              >
                <span>एजंट इनॲक्टिव्ह (Inactive) करा</span>
              </button>
              <button
                onClick={() => handleDelete(deleteDependencyModal.agent, true)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1"
              >
                <span>खाती ट्रान्सफर करून सक्तीने डिलीट करा</span>
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
