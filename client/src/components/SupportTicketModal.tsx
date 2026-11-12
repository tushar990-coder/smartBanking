import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Headset, Upload, Image as ImageIcon, CheckCircle, Clock, 
  AlertTriangle, AlertCircle, RefreshCw, Paperclip, Send, 
  Phone, User, Calendar, Building2, Search, ExternalLink, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    userId?: number;
    userID?: number;
    username: string;
    role?: string;
    branchID?: number;
    branchName?: string;
    businessDate?: string;
    financialYearCode?: string;
  };
}

interface Attachment {
  attachmentID: number;
  originalFileName: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  createdOn: string;
}

interface SupportTicketItem {
  ticketID: number;
  ticketNo: string;
  branchID: number;
  branchName: string;
  userID: number;
  username: string;
  contactNumber?: string;
  moduleCategory: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  resolutionRemarks?: string;
  resolvedAt?: string;
  createdOn: string;
  attachments?: Attachment[];
}

export const SupportTicketModal: React.FC<SupportTicketModalProps> = ({ isOpen, onClose, user }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  
  // Form State
  const [subject, setSubject] = useState('');
  const [moduleCategory, setModuleCategory] = useState('Voucher');
  const [priority, setPriority] = useState('MEDIUM');
  const [contactNumber, setContactNumber] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History State
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const currentUserId = user?.userId || user?.userID || 1;
  const currentBranchId = user?.branchID || 1;

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      previews.forEach(p => URL.revokeObjectURL(p));
    };
  }, [previews]);

  // Load History when switching to history tab
  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      fetchTickets();
    }
  }, [isOpen, activeTab, statusFilter]);

  // Direct Clipboard Paste (Ctrl + V) Handler for Screenshots
  useEffect(() => {
    if (!isOpen || activeTab !== 'create') return;

    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData || !e.clipboardData.items) return;

      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
            const pastedFile = new File([blob], `screenshot_${timestamp}.png`, { type: blob.type });
            imageFiles.push(pastedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
        toast.success(`📋 क्लिपबोर्डवरून ${imageFiles.length} स्क्रीनशॉट जोडला गेला!`);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, activeTab, selectedFiles]);

  const addFiles = (newFiles: File[]) => {
    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const f of newFiles) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`'${f.name}' फाईलची साईझ १० MB पेक्षा जास्त आहे.`);
        continue;
      }
      validFiles.push(f);
      newPreviews.push(URL.createObjectURL(f));
    }

    if (selectedFiles.length + validFiles.length > 5) {
      toast.error('एका वेळी जास्तीत जास्त ५ स्क्रीनशॉट्स जोडता येतील.');
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const fetchTickets = async () => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (currentBranchId) params.append('branchId', currentBranchId.toString());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/SupportTickets?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to load tickets');
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
      toast.error('सपोर्ट कॉल्स इतिहास लोड करताना त्रुटी आली.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      toast.error('कृपया समस्येचा विषय प्रविष्ट करा.');
      return;
    }

    if (!description.trim()) {
      toast.error('कृपया समस्येचे सविस्तर वर्णन प्रविष्ट करा.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();

      formData.append('BranchID', currentBranchId.toString());
      formData.append('BranchName', user?.branchName || 'Main Branch');
      formData.append('UserID', currentUserId.toString());
      formData.append('Username', user?.username || 'User');
      formData.append('ContactNumber', contactNumber.trim());
      formData.append('ModuleCategory', moduleCategory);
      formData.append('Priority', priority);
      formData.append('Subject', subject.trim());
      formData.append('Description', description.trim());

      // Auto-captured system info (Branch, User, FY, BusinessDate, Browser/OS - NO URL, NO Tab!)
      const systemInfo = {
        branchId: currentBranchId,
        branchName: user?.branchName || 'Main Branch',
        userId: currentUserId,
        username: user?.username || 'User',
        userRole: user?.role || 'Staff',
        businessDate: user?.businessDate || '',
        financialYear: user?.financialYearCode || '',
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language
      };
      formData.append('SystemInfoJson', JSON.stringify(systemInfo));

      // Append screenshot files
      selectedFiles.forEach(file => {
        formData.append('screenshots', file);
      });

      const res = await fetch('/api/SupportTickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'सपोर्ट कॉल नोंदवता आला नाही.');
      }

      toast.success(result.message || 'सपोर्ट कॉल यशस्वीरित्या नोंदवला गेला!');
      
      // Reset form
      setSubject('');
      setDescription('');
      setSelectedFiles([]);
      setPreviews([]);
      setPriority('MEDIUM');

      // Switch to history tab to show newly created call
      setActiveTab('history');
      fetchTickets();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'सपोर्ट कॉल नोंदवताना त्रुटी आली.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-gray-800"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-primary to-slate-800 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-amber-300 shadow-inner">
              <Headset size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-2">
                <span>सपोर्ट व तक्रार नोंदणी (Helpdesk & Support Center)</span>
                <span className="text-[10px] bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full border border-amber-400/30 font-mono">
                  CBS 24x7
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                सॉफ्टवेअरमध्ये काम करताना अडचण आल्यास थेट स्क्रीनशॉट्ससह तक्रार नोंदवा
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="बंद करा (Close)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-slate-50 px-4 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer border-t border-x ${
              activeTab === 'create'
                ? 'bg-white text-primary border-gray-200 shadow-2xs -mb-px'
                : 'text-gray-600 hover:text-gray-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Paperclip size={14} className={activeTab === 'create' ? 'text-primary' : 'text-gray-400'} />
            <span>✍️ नवीन कॉल नोंदवा (Register New Call)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer border-t border-x ${
              activeTab === 'history'
                ? 'bg-white text-primary border-gray-200 shadow-2xs -mb-px'
                : 'text-gray-600 hover:text-gray-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Clock size={14} className={activeTab === 'history' ? 'text-primary' : 'text-gray-400'} />
            <span>📋 कॉल इतिहास व स्थिती (My Calls & Status)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50">
          {activeTab === 'create' ? (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl mx-auto">
              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Module Category */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    विभाग / मॉड्यूल (Module) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={moduleCategory}
                    onChange={(e) => setModuleCategory(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs font-medium"
                  >
                    <option value="Voucher">📖 व्हाउचर व रोख नोंद (Vouchers)</option>
                    <option value="Loans">💰 कर्ज विभाग (Loans)</option>
                    <option value="Pigmy">🐷 पिग्मी विभाग (Pigmy)</option>
                    <option value="Savings">🏦 बचत व ठेवी (Savings)</option>
                    <option value="FD">🔒 मुदत ठेव (Fixed Deposit)</option>
                    <option value="RD">📅 आवर्ती ठेव (Recurring Deposit)</option>
                    <option value="Daybook">📜 डे-बुक व कची नोंद (Daybook)</option>
                    <option value="Reports">📊 अहवाल व पत्रके (Reports)</option>
                    <option value="General">⚙️ इतर / तांत्रिक अडचण (General)</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    प्राधान्यक्रम (Priority) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs font-medium"
                  >
                    <option value="CRITICAL">🔴 अतितातडीचे (काम पूर्ण थांबले आहे)</option>
                    <option value="HIGH">🟠 तातडीचे (High)</option>
                    <option value="MEDIUM">🟡 मध्यम (अडचण आहे पण इतर काम चालू)</option>
                    <option value="LOW">🟢 सामान्य (शंका किंवा सुधारणा)</option>
                  </select>
                </div>

                {/* Contact Number */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    संपर्क मोबाईल क्र. (Contact Phone)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400">
                      <Phone size={13} />
                    </span>
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="उदा. 98xxxxxxxx"
                      maxLength={15}
                      className="w-full text-xs border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  समस्येचा संक्षिप्त विषय (Subject / Issue Title) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="उदा. व्हाउचर डिलीट करताना एरर ४०० येत आहे / मुदत ठेव प्रमाणपत्र प्रिंट होत नाही"
                  maxLength={200}
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs font-medium"
                  required
                />
              </div>

              {/* Big Textarea: Detailed Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-gray-700">
                    समस्येचे सविस्तर वर्णन (Detailed Problem Description) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-gray-400">
                    खाते क्र., व्हाउचर क्र., किंवा नेमकी एरर लिहा
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="कृपया समस्येची सविस्तर माहिती येथे लिहा:
१. कोणती एन्ट्री करत असताना अडचण आली?
२. खाते क्रमांक किंवा व्हाउचर क्रमांक काय होता?
३. स्क्रीनवर नेमकी कोणती एरर आली किंवा काय घडले?
(इथे तुम्ही थेट Ctrl + V दाबून स्क्रीनशॉट देखील पेस्ट करू शकता)"
                  className="w-full text-xs border border-gray-300 rounded-lg p-3 bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-2xs leading-relaxed"
                  required
                />
              </div>

              {/* Screenshot Upload & Paste Section */}
              <div className="bg-white border border-dashed border-gray-300 rounded-xl p-3.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-blue-50 text-primary">
                      <ImageIcon size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800">
                        स्क्रीनशॉट्स जोडा (Attach Screenshots)
                      </span>
                      <p className="text-[10px] text-gray-500">
                        एकापेक्षा जास्त फोटो निवडू शकता किंवा थेट <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] font-mono font-bold text-gray-700">Ctrl + V</kbd> दाबून पेस्ट करा
                      </p>
                    </div>
                  </div>

                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      multiple
                      accept="image/png, image/jpeg, image/jpg, image/webp, application/pdf"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Upload size={13} />
                      <span>फाईल्स निवडा (Browse)</span>
                    </button>
                  </div>
                </div>

                {/* Previews Grid */}
                {selectedFiles.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-gray-100">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="relative group bg-gray-50 border border-gray-200 rounded-lg p-1.5 flex flex-col items-center">
                        <img
                          src={previews[idx]}
                          alt={file.name}
                          className="w-full h-20 object-cover rounded border border-gray-200 bg-white"
                        />
                        <div className="w-full mt-1 flex items-center justify-between text-[10px] text-gray-600 px-0.5">
                          <span className="truncate max-w-[100px]" title={file.name}>{file.name}</span>
                          <span className="text-gray-400 font-mono">{(file.size / 1024).toFixed(0)} KB</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                          title="फोटो हटवा"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-gray-400 text-xs">
                    कोणतीही फाईल निवडलेली नाही. (Win+Shift+S ने स्क्रीनशॉट घेऊन इथे Ctrl+V दाबा)
                  </div>
                )}
              </div>

              {/* Auto-captured System Context Info (Subtle) */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg px-3 py-2 text-[11px] text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <Building2 size={13} className="text-amber-700" />
                  <span>शाखा: {user?.branchName || 'Main Branch'}</span>
                  <span className="text-amber-400">•</span>
                  <User size={13} className="text-amber-700" />
                  <span>ऑपरेटर: {user?.username} ({user?.role || 'Staff'})</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-amber-800">
                  <Calendar size={12} className="text-amber-700" />
                  <span>दिनांक: {user?.businessDate} | FY: {user?.financialYearCode}</span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  रद्द करा (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>नोंदवत आहे...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>सपोर्ट कॉल नोंदवा (Submit Call)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* History & Tracking Tab */
            <div className="space-y-3">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400">
                      <Search size={13} />
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchTickets()}
                      placeholder="कॉल क्र. किंवा विषयाने शोधा..."
                      className="w-full text-xs border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-medium"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-medium"
                  >
                    <option value="ALL">सर्व स्थिती (All Status)</option>
                    <option value="OPEN">🟡 प्रलंबित (Open)</option>
                    <option value="IN_PROGRESS">🔵 तपासणी सुरू (In Progress)</option>
                    <option value="RESOLVED">🟢 निराकरण झाले (Resolved)</option>
                    <option value="CLOSED">⚪ बंद (Closed)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={fetchTickets}
                  disabled={isLoadingHistory}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="रिफ्रेश करा"
                >
                  <RefreshCw size={12} className={isLoadingHistory ? 'animate-spin' : ''} />
                  <span>रिफ्रेश</span>
                </button>
              </div>

              {/* Ticket Cards List */}
              {isLoadingHistory ? (
                <div className="text-center py-12 text-gray-500 text-xs flex flex-col items-center gap-2">
                  <RefreshCw size={18} className="animate-spin text-primary" />
                  <span>सपोर्ट कॉल्स लोड होत आहेत...</span>
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500 text-xs">
                  <Headset size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="font-bold text-gray-700">कोणतेही सपोर्ट कॉल्स नोंदवलेले नाहीत</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">काम करताना अडचण आल्यास 'नवीन कॉल नोंदवा' टॅबमधून तिकीट नोंदवू शकता.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((t) => {
                    const statusBadge = 
                      t.status === 'RESOLVED' ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', label: 'निराकरण झाले (Resolved)' } :
                      t.status === 'IN_PROGRESS' ? { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', label: 'तपासणी सुरू (In Progress)' } :
                      t.status === 'CLOSED' ? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-300', label: 'बंद (Closed)' } :
                      { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', label: 'प्रलंबित (Open)' };

                    const priorityColor =
                      t.priority === 'CRITICAL' ? 'bg-red-100 text-red-800 border-red-300' :
                      t.priority === 'HIGH' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                      t.priority === 'LOW' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                      'bg-amber-100 text-amber-800 border-amber-300';

                    return (
                      <div key={t.ticketID} className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3.5 transition-all hover:border-gray-300">
                        {/* Card Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                              {t.ticketNo}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityColor}`}>
                              {t.priority}
                            </span>
                            <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                              {t.moduleCategory}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                              {statusBadge.label}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {new Date(t.createdOn).toLocaleString('mr-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                        </div>

                        {/* Card Subject & Description */}
                        <div className="py-2.5">
                          <h3 className="text-xs font-bold text-gray-900 mb-1">
                            {t.subject}
                          </h3>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed bg-slate-50/70 p-2.5 rounded-lg border border-gray-100 font-sans">
                            {t.description}
                          </p>
                        </div>

                        {/* Attachments */}
                        {t.attachments && t.attachments.length > 0 && (
                          <div className="pt-2 pb-1">
                            <span className="text-[10px] font-bold text-gray-500 block mb-1.5 flex items-center gap-1">
                              <ImageIcon size={11} />
                              जोडलेले स्क्रीनशॉट्स ({t.attachments.length}):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {t.attachments.map((att) => (
                                <a
                                  key={att.attachmentID}
                                  href={att.filePath}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group relative inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50/60 hover:bg-blue-100 text-primary rounded border border-blue-200 text-[11px] font-medium transition-all"
                                  title="स्क्रीनशॉट नवीन टॅबमध्ये उघडा"
                                >
                                  <ExternalLink size={11} />
                                  <span className="max-w-[140px] truncate">{att.originalFileName}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Resolution Remarks from Support Team */}
                        {t.resolutionRemarks && (
                          <div className="mt-3 p-3 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-950">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 mb-1">
                              <CheckCircle size={14} className="text-emerald-600" />
                              <span>सपोर्ट टीम / डेव्हलपरचा शेरा (Resolution):</span>
                            </div>
                            <p className="text-xs whitespace-pre-wrap leading-relaxed text-emerald-900">
                              {t.resolutionRemarks}
                            </p>
                            {t.resolvedAt && (
                              <span className="text-[10px] text-emerald-700 block mt-1 font-mono">
                                निराकरण दिनांक: {new Date(t.resolvedAt).toLocaleString('mr-IN', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportTicketModal;

