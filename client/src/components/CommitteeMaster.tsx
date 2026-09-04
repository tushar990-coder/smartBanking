import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';

interface Member extends MemberOption {}

interface CommitteeMember {
  committeeMemberID: number;
  memberID: number;
  memberCode?: string;
  memberName: string;
  mobileNo?: string;
  designation: string;
  joiningDate: string;
  endDate: string | null;
  resolutionNo: string;
  status: string;
  termYear?: string;
  category?: string;
  dinNo?: string;
  remarks?: string;
  hasOverdue?: boolean;
  totalLoanBalance?: number;
  overdueAmount?: number;
}

export default function CommitteeMaster() {
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const designationSelectRef = useRef<HTMLSelectElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTermFilter, setSelectedTermFilter] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [sansthaName, setSansthaName] = useState('प्राथमिक शिक्षक सहकारी पतसंस्था मर्यादित');

  const [formData, setFormData] = useState({
    memberID: '',
    designation: 'संचालक',
    joiningDate: new Date().toISOString().split('T')[0],
    endDate: '',
    resolutionNo: '',
    status: 'Active',
    termYear: '२०२६-२०३१',
    category: 'सर्वसाधारण',
    dinNo: '',
    remarks: ''
  });

  const API_URL = '/api/CommitteeMembers';
  const MEMBERS_URL = '/api/Members';
  const SANSTHA_URL = '/api/SansthaDetails';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchCommittee(), fetchMembers(), fetchSanstha()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSanstha = async () => {
    try {
      const res = await axios.get(SANSTHA_URL);
      if (res.data && res.data.length > 0) {
        setSansthaName(res.data[0].sansthaName || res.data[0].name || 'प्राथमिक शिक्षक सहकारी पतसंस्था मर्यादित');
      }
    } catch {
      // default fallback
    }
  };

  const fetchCommittee = async () => {
    try {
      const res = await axios.get(API_URL);
      setCommittee(res.data || []);
    } catch (err) {
      console.error('Error fetching committee members:', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await axios.get(MEMBERS_URL);
      setMembers(res.data || []);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.memberID) {
      setError('कृपया सभासद निवडा.');
      return;
    }

    try {
      const payload = {
        ...formData,
        memberID: parseInt(formData.memberID),
        endDate: formData.endDate ? formData.endDate : null
      };

      if (editId) {
        await axios.put(`${API_URL}/${editId}`, { committeeMemberID: editId, ...payload });
        setSuccess('संचालक माहिती यशस्वीरीत्या अपडेट झाली!');
      } else {
        await axios.post(API_URL, payload);
        setSuccess('नवीन संचालक यशस्वीरीत्या जतन झाला!');
      }
      
      resetForm();
      fetchCommittee();
    } catch (err: any) {
      console.error('Error saving:', err);
      setError(err.response?.data || 'माहिती सेव्ह करताना त्रुटी आली.');
    }
  };

  const handleEdit = (item: CommitteeMember) => {
    setEditId(item.committeeMemberID);
    setFormData({
      memberID: item.memberID.toString(),
      designation: item.designation || 'संचालक',
      joiningDate: item.joiningDate ? item.joiningDate.split('T')[0] : '',
      endDate: item.endDate ? item.endDate.split('T')[0] : '',
      resolutionNo: item.resolutionNo || '',
      status: item.status || 'Active',
      termYear: item.termYear || '२०२६-२०३१',
      category: item.category || 'सर्वसाधारण',
      dinNo: item.dinNo || '',
      remarks: item.remarks || ''
    });

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (designationSelectRef.current) {
        designationSelectRef.current.focus();
      }
    }, 120);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('ही संचालक माहिती खात्रीने काढायची आहे का?')) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      setSuccess('संचालक माहिती काढली!');
      fetchCommittee();
    } catch (err: any) {
      setError(err.response?.data || 'माहिती काढताना त्रुटी आली.');
    }
  };

  const resetForm = () => {
    setEditId(null);
    setFormData({
      memberID: '',
      designation: 'संचालक',
      joiningDate: new Date().toISOString().split('T')[0],
      endDate: '',
      resolutionNo: '',
      status: 'Active',
      termYear: '२०२६-२०३१',
      category: 'सर्वसाधारण',
      dinNo: '',
      remarks: ''
    });
  };

  const uniqueTerms = Array.from(new Set(committee.map(c => c.termYear).filter(Boolean)));
  const uniqueCategories = Array.from(new Set(committee.map(c => c.category).filter(Boolean)));

  const filteredCommittee = committee.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (item.memberName || '').toLowerCase().includes(q) ||
      (item.designation || '').toLowerCase().includes(q) ||
      (item.resolutionNo || '').toLowerCase().includes(q) ||
      (item.termYear || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.dinNo || '').toLowerCase().includes(q)
    );
    const matchesTerm = !selectedTermFilter || item.termYear === selectedTermFilter;
    const matchesCategory = !selectedCategoryFilter || item.category === selectedCategoryFilter;

    return matchesSearch && matchesTerm && matchesCategory;
  });

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="p-3 font-sans space-y-3">
      {/* Investment Institution Master Styled Container */}
      <div 
        ref={formContainerRef}
        className={`bg-white rounded shadow-sm border transition-all duration-300 ${
          editId ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-gray-200'
        }`}
      >
        
        {/* Header */}
        <div className="bg-primary text-white px-4 py-2 rounded-t flex items-center justify-between shadow-xs">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <span>📊 पंच कमिटी मास्टर (Board of Directors Master)</span>
            {editId && (
              <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                ✏️ संपादन चालू (#{editId})
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-2 py-0.5 rounded bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium border border-red-400/40 transition-all cursor-pointer"
              >
                ✕ संपादन रद्द करा (Cancel)
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>🖨️ अधिकृत रिपोर्ट</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
              className="px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>{viewMode === 'cards' ? '📊 तक्ता प्रकार' : '🗂️ कार्ड प्रकार'}</span>
            </button>
          </div>
        </div>

        {/* Compact Form */}
        <form onSubmit={handleSubmit} className="p-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-sm text-xs mb-2">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-sm text-xs mb-2">
              {success}
            </div>
          )}

          {/* Row 1 */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                सभासद निवडा (Select Member) <span className="text-red-500">*</span>
              </label>
              <MemberSearchSelect
                members={members}
                value={formData.memberID ? Number(formData.memberID) : ''}
                onChange={(val) => setFormData((prev) => ({ ...prev, memberID: val ? String(val) : '' }))}
                placeholder="-- सभासद नाव, कोड किंवा मोबाईलने शोधा --"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                पद (Designation) <span className="text-red-500">*</span>
              </label>
              <select
                ref={designationSelectRef}
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                required
                className={`w-full border rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  editId ? 'border-primary bg-amber-50/40 font-semibold' : 'border-gray-300 bg-white'
                }`}
              >
                <option value="चेअरमन">चेअरमन (Chairman)</option>
                <option value="व्हाईस चेअरमन">व्हाईस चेअरमन (Vice Chairman)</option>
                <option value="सचिव">सचिव (Secretary)</option>
                <option value="खजिनदार">खजिनदार (Treasurer)</option>
                <option value="संचालक">संचालक (Director)</option>
                <option value="संचालिका">संचालिका (Female Director)</option>
                <option value="तज्ञ संचालक">तज्ञ संचालक (Expert Director)</option>
                <option value="इतर">इतर (Other)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                स्थिती (Status) <span className="text-red-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              >
                <option value="Active">चालू / कार्यरत (Active)</option>
                <option value="Inactive">मुदत समाप्त / निवृत्त (Inactive)</option>
                <option value="Resigned">राजीनामा (Resigned)</option>
                <option value="Disqualified">अपात्र (Disqualified)</option>
              </select>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                पंचवार्षिक मुदत वर्ष <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="termYear"
                value={formData.termYear}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="उदा. २०२६-२०३१"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                आरक्षण वर्गवारी (Category) <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              >
                <option value="सर्वसाधारण">सर्वसाधारण (General)</option>
                <option value="महिला राखीव">महिला राखीव (Women Reserved)</option>
                <option value="अनुसूचित जाती/जमाती">अनुसूचित जाती/जमाती (SC/ST)</option>
                <option value="इतर मागासवर्ग">इतर मागासवर्ग (OBC)</option>
                <option value="भटक्या जमाती">भटक्या जमाती (NT/VJNT)</option>
                <option value="तज्ञ संचालक">तज्ञ संचालक (Expert Director)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">DIN क्रमांक</label>
              <input
                type="text"
                name="dinNo"
                value={formData.dinNo}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="उदा. DIN-847291"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">निवड ठराव क्रमांक</label>
              <input
                type="text"
                name="resolutionNo"
                value={formData.resolutionNo}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="उदा. ठराव क्र. ४ (अ)"
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                निवडीची तारीख <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="joiningDate"
                value={formData.joiningDate}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">कार्यकाळ समाप्ती तारीख</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">टीप / शेरा (Remarks)</label>
              <input
                type="text"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="इतर काही विशेष नोंदी किंवा निवडणूक तपशील..."
              />
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="flex gap-2 border-t border-gray-100 pt-2 mt-2">
            <button
              type="submit"
              className="bg-primary hover:bg-[#004a75] text-white px-3 py-1 rounded-sm shadow-sm text-xs font-medium cursor-pointer"
            >
              {editId ? '✏️ अपडेट करा' : '💾 जतन करा'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-sm text-xs font-medium cursor-pointer"
              >
                ❌ रद्द करा
              </button>
            )}
          </div>
        </form>

        {/* Filters & Search Bar */}
        <div className="px-3 py-2 bg-gray-50 border-t border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">मा. संचालक मंडळ रजिस्टर</span>
            <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold">
              एकूण: {filteredCommittee.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {uniqueTerms.length > 0 && (
              <select
                className="border border-gray-300 px-2 py-1 rounded-sm text-xs bg-white focus:outline-none"
                value={selectedTermFilter}
                onChange={e => setSelectedTermFilter(e.target.value)}
              >
                <option value="">-- सर्व मुदती (All Terms) --</option>
                {uniqueTerms.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}

            {uniqueCategories.length > 0 && (
              <select
                className="border border-gray-300 px-2 py-1 rounded-sm text-xs bg-white focus:outline-none"
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="">-- सर्व वर्गवारी --</option>
                {uniqueCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 नाव, पद, DIN किंवा ठरावाने शोधा..."
              className="border border-gray-300 px-2 py-1 rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-52"
            />
          </div>
        </div>

        {/* Listing Register */}
        <div className="p-3">
          {viewMode === 'table' ? (
            <div className="overflow-x-auto border border-gray-200 rounded-sm">
              <table className="w-full text-[11px] text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <th className="border-b border-gray-200 px-2 py-1.5 text-center">#</th>
                    <th className="border-b border-gray-200 px-2 py-1.5 text-left">संचालकाचे नाव</th>
                    <th className="border-b border-gray-200 px-2 py-1.5 text-left">पद</th>
                    <th className="border-b border-gray-200 px-2 py-1.5 text-left">मुदत वर्ष</th>
                    <th className="border-b border-gray-200 px-2 py-1.5 text-left">वर्गवारी</th>
                    <th className="border-b border-gray-200 px-2 py-1.5 text-left">DIN क्र.</th>
                    <th className="border-b border-gray-200 px-2 py-1.5 text-left">निवड दिनांक</th>
                    <th className="border-b border-gray-200 px-2 py-1.5 text-left">ठराव क्र.</th>
                    <th className="border-b border-gray-200 px-2 py-1.5 text-center">स्थिती / अनुपालन</th>
                    <th className="border-b border-gray-200 px-2 py-1.5 text-center">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-4 text-gray-400">लोड होत आहे...</td>
                    </tr>
                  ) : filteredCommittee.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-4 text-gray-400">कोणतेही संचालक आढळले नाहीत.</td>
                    </tr>
                  ) : (
                    filteredCommittee.map((item, idx) => (
                      <tr key={item.committeeMemberID} className="hover:bg-blue-50 transition-colors">
                        <td className="border-b border-gray-100 px-2 py-1 text-center font-medium text-gray-500">{idx + 1}</td>
                        <td className="border-b border-gray-100 px-2 py-1 font-medium text-gray-800">
                          {item.memberName}
                          <span className="block text-[10px] font-normal text-gray-500">कोड: {item.memberCode}</span>
                        </td>
                        <td className="border-b border-gray-100 px-2 py-1">
                          <span className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                            {item.designation}
                          </span>
                        </td>
                        <td className="border-b border-gray-100 px-2 py-1 text-gray-700">{item.termYear || '-'}</td>
                        <td className="border-b border-gray-100 px-2 py-1 text-gray-700">{item.category || 'सर्वसाधारण'}</td>
                        <td className="border-b border-gray-100 px-2 py-1 font-mono text-gray-600">{item.dinNo || '-'}</td>
                        <td className="border-b border-gray-100 px-2 py-1 text-gray-700">
                          {item.joiningDate ? new Date(item.joiningDate).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td className="border-b border-gray-100 px-2 py-1 text-gray-700">{item.resolutionNo || '-'}</td>
                        <td className="border-b border-gray-100 px-2 py-1 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                            item.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {item.status === 'Active' ? 'सक्रिय' : item.status}
                          </span>
                          {item.hasOverdue && item.status === 'Active' && (
                            <span className="block text-[9px] font-bold text-red-600 mt-0.5">⚠️ ७३/C थकबाकीदार</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 px-2 py-1 text-center">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-800 mr-2 text-[11px]"
                            title="संपादन"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(item.committeeMemberID)}
                            className="text-red-600 hover:text-red-800 text-[11px]"
                            title="काढा"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCommittee.map((item) => (
                <div key={item.committeeMemberID} className="bg-white rounded border border-gray-200 p-3 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="bg-blue-50 text-blue-800 text-xs font-bold px-2 py-0.5 rounded">
                        {item.designation}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {item.status === 'Active' ? 'सक्रिय' : item.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-gray-800 mb-1">{item.memberName}</h4>
                    <p className="text-[11px] text-gray-500 mb-2">कोड: {item.memberCode} | मुदत: {item.termYear}</p>

                    <div className="bg-gray-50 p-2 rounded text-[11px] space-y-1 text-gray-600 border border-gray-100">
                      <div>वर्गवारी: <span className="font-medium text-gray-800">{item.category || 'सर्वसाधारण'}</span></div>
                      <div>DIN: <span className="font-mono text-gray-800">{item.dinNo || '-'}</span></div>
                      <div>ठराव क्र.: <span className="font-medium text-gray-800">{item.resolutionNo || '-'}</span></div>
                      <div>निवड दिनांक: <span className="font-medium text-gray-800">{item.joiningDate ? new Date(item.joiningDate).toLocaleDateString('en-GB') : '-'}</span></div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-gray-100 pt-2 mt-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">✏️ संपादन</button>
                    <button onClick={() => handleDelete(item.committeeMemberID)} className="text-red-600 hover:text-red-800 text-xs font-medium">🗑️ काढा</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Printable Report Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full p-5 space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm font-bold text-gray-800">
                🖨️ संचालक मंडळ अधिकृत रिपोर्ट नमुना
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={triggerPrint}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white font-medium text-xs rounded shadow-2xs cursor-pointer"
                >
                  🖨️ प्रिंट काढा
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium text-xs rounded cursor-pointer"
                >
                  ✕ बंद करा
                </button>
              </div>
            </div>

            <div className="print-area p-5 border rounded bg-white space-y-4 text-black text-xs">
              <div className="text-center border-b-2 border-gray-800 pb-3">
                <h2 className="text-base font-extrabold uppercase">{sansthaName}</h2>
                <p className="text-xs font-bold text-gray-700 mt-0.5">
                  मा. संचालक मंडळ अधिकृत नोंदवही (Board of Directors Official Register)
                </p>
              </div>

              <table className="w-full text-xs text-left border-collapse border border-gray-400">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-400 font-bold text-gray-800">
                    <th className="border border-gray-400 p-1.5 text-center">अ.क्र.</th>
                    <th className="border border-gray-400 p-1.5">संचालकाचे नाव</th>
                    <th className="border border-gray-400 p-1.5">पद</th>
                    <th className="border border-gray-400 p-1.5">मुदत वर्ष</th>
                    <th className="border border-gray-400 p-1.5">आरक्षण वर्गवारी</th>
                    <th className="border border-gray-400 p-1.5">DIN क्र.</th>
                    <th className="border border-gray-400 p-1.5">ठराव क्र.</th>
                    <th className="border border-gray-400 p-1.5 text-center">स्वाक्षरी</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommittee.map((item, idx) => (
                    <tr key={item.committeeMemberID} className="border-b border-gray-300">
                      <td className="border border-gray-300 p-1.5 text-center font-bold">{idx + 1}</td>
                      <td className="border border-gray-300 p-1.5 font-bold">{item.memberName}</td>
                      <td className="border border-gray-300 p-1.5 font-semibold">{item.designation}</td>
                      <td className="border border-gray-300 p-1.5">{item.termYear || '-'}</td>
                      <td className="border border-gray-300 p-1.5">{item.category || 'सर्वसाधारण'}</td>
                      <td className="border border-gray-300 p-1.5 font-mono">{item.dinNo || '-'}</td>
                      <td className="border border-gray-300 p-1.5">{item.resolutionNo || '-'}</td>
                      <td className="border border-gray-300 p-1.5 text-center text-gray-300">____________</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-end pt-8 text-xs font-bold text-gray-800">
                <div className="text-center">
                  <p>_______________________</p>
                  <p className="mt-1">मा. सचिव</p>
                </div>
                <div className="text-center">
                  <p>_______________________</p>
                  <p className="mt-1">मा. चेअरमन</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
