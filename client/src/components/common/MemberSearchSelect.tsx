import React from 'react';
import Select from 'react-select';

export interface MemberOption {
  memberID: number;
  memberId?: number;
  memberCode?: string;
  legacyMemberNo?: string;
  oldMemberCode?: string;
  legacyCustomerNo?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  firstNameEng?: string;
  middleNameEng?: string;
  lastNameEng?: string;
  fullName?: string;
  mobileNo?: string;
  aadhaarNo?: string;
  cifNo?: string;
  status?: string;
  customerID?: number;
  customerId?: number;
  id?: number;
  memberProfile?: any;
  memberIdOnly?: number;
}

interface Props {
  members: (MemberOption | any)[];
  value: number | string | '' | undefined;
  onChange: (memberId: number | '', selectedMember?: any) => void;
  placeholder?: string;
  className?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  required?: boolean;
  compact?: boolean;
  valueType?: 'memberId' | 'customerId';
  hideMemberRef?: boolean;
}

export default function MemberSearchSelect({
  members = [],
  value,
  onChange,
  placeholder,
  className = "",
  isDisabled = false,
  isClearable = true,
  compact = false,
  valueType = 'memberId',
  hideMemberRef = false
}: Props) {
  const isCustomerMode = hideMemberRef || valueType === 'customerId';
  
  // Transform members into react-select options format
  const options = React.useMemo(() => {
    if (!Array.isArray(members)) return [];
    return members.map((m: any) => {
      const rawMemProfile = m.memberProfile || m.MemberProfile;
      const memId = Number(rawMemProfile?.memberID || rawMemProfile?.MemberID || m.memberID || m.memberId || m.MemberID || 0);
      const custId = Number(m.customerID || m.customerId || m.CustomerID || m.id || 0);
      
      // If customer mode, strictly prioritize custId.
      // Otherwise (default 'memberId'), prioritize memId if memId > 0; if not, fallback to custId.
      const primaryValueId = isCustomerMode
        ? (custId > 0 ? custId : memId)
        : (memId > 0 ? memId : custId);

      const rawCode = (rawMemProfile?.memberCode || rawMemProfile?.MemberCode || m.memberCode || m.MemberCode || '').trim();
      const isNullOrEmpty = !rawCode || rawCode.toLowerCase() === 'null' || rawCode.toLowerCase() === 'undefined';
      let cleanMemCode = isNullOrEmpty ? '' : rawCode;

      const rawLegacyMember = String(rawMemProfile?.legacyMemberNo || rawMemProfile?.LegacyMemberNo || m.legacyMemberNo || m.oldMemberCode || m.oldMemberNo || m.LegacyMemberNo || '').trim();
      const rawLegacyCustCandidate = String(m.legacyCustomerNo || m.LegacyCustomerNo || (m as any)?.customerProfile?.legacyCustomerNo || '').trim();
      const rawLegacyCust = (!rawLegacyCustCandidate || rawLegacyCustCandidate.toLowerCase() === 'null' || rawLegacyCustCandidate.toLowerCase() === 'undefined') ? '' : rawLegacyCustCandidate;
      const cif = String(m.cifNo || m.cif || m.CifNo || m.CIFNo || '').trim();
      const mobile = String(m.mobileNo || m.mobile || m.MobileNo || m.mobileNumber || '').trim();
      const aadhaar = String(m.aadhaarNo || m.aadhaar || m.AadhaarNo || '').trim();

      const fName = String(m.firstName || m.FirstName || m.firstNameEng || m.FirstNameEng || '').trim();
      const mName = String(m.middleName || m.MiddleName || m.middleNameEng || m.MiddleNameEng || '').trim();
      const lName = String(m.lastName || m.LastName || m.lastNameEng || m.LastNameEng || '').trim();
      const nick = String(m.nickName || m.NickName || '').trim();

      let fullName = String(m.fullName || m.FullName || m.name || m.Name || m.customerName || m.CustomerName || '').trim();
      if (!fullName) {
        fullName = [fName, mName, lName].filter(Boolean).join(' ').trim();
      }
      if (!fullName) {
        fullName = isCustomerMode ? `खातेदार #${primaryValueId}` : `सभासद / खातेदार #${primaryValueId}`;
      }

      // If customer mode or hideMemberRef, strictly display [CIF] (plus जुना खातेदार नं if present) without any Member Code
      const cleanCif = cif ? (cif.toUpperCase().startsWith('CIF') ? cif : `CIF:${cif}`) : (rawLegacyCust ? `CIF:${rawLegacyCust}` : `CIF00${custId || primaryValueId}`);
      const legacyCustTag = isCustomerMode && rawLegacyCust ? ` [जुना खातेदार नं: ${rawLegacyCust}]` : '';
      const prefix = isCustomerMode ? `[${cleanCif}]${legacyCustTag}` : (cleanMemCode ? `[${cleanCif} | ${cleanMemCode}]` : `[${cleanCif}]`);
      const label = `${prefix} ${fullName}${nick ? ` (${nick})` : ''}${mobile ? ` - 📱 ${mobile}` : ''}`;

      return {
        value: primaryValueId,
        label: label,
        member: {
          ...m,
          memberID: memId > 0 ? memId : primaryValueId,
          memberIdOnly: memId,
          customerID: custId > 0 ? custId : primaryValueId,
          memberCode: cleanMemCode,
          legacyMemberNo: rawLegacyMember,
          legacyCustomerNo: rawLegacyCust,
          cifNo: cif,
          mobileNo: mobile,
          aadhaarNo: aadhaar,
          firstName: fName,
          middleName: mName,
          lastName: lName,
          nickName: nick,
          fullName: fullName
        }
      };
    });
  }, [members, isCustomerMode]);

  const numericValue = value !== '' && value !== undefined && value !== null ? Number(value) : '';

  const selectedOption = React.useMemo(() => {
    if (numericValue === '' || isNaN(numericValue as number)) return null;
    
    // Priority 1: Exact match on primary option value
    const exactMatch = options.find(o => o.value === numericValue);
    if (exactMatch) return exactMatch;

    if (isCustomerMode) {
      // Direct CustomerID match on member object
      const custMatch = options.find(o => o.member?.customerID === numericValue);
      if (custMatch) return custMatch;

      // Secondary fallback to memberID
      return options.find(o => o.member?.memberID === numericValue || o.member?.memberIdOnly === numericValue) || null;
    } else {
      // Direct MemberID match on member object
      const memMatch = options.find(o => o.member?.memberID === numericValue || o.member?.memberIdOnly === numericValue);
      if (memMatch) return memMatch;

      // Secondary fallback to customerID
      return options.find(o => o.member?.customerID === numericValue) || null;
    }
  }, [numericValue, options, isCustomerMode]);

  // Pure Customer / CIF filter logic (Searches by CIF Number, Member Code (if not customer mode), Name, Mobile, Legacy IDs)
  const filterOption = (option: any, rawInput: string) => {
    const input = rawInput.toLowerCase().trim();
    if (!input) return true;
    
    const { label, member } = option.data;
    
    const searchString = `
      ${label}
      ${member.fullName || ''}
      ${member.firstName || ''}
      ${member.middleName || ''}
      ${member.lastName || ''}
      ${member.nickName || ''}
      ${member.mobileNo || ''}
      ${member.cifNo || ''}
      ${!isCustomerMode ? (member.memberCode || '') : ''}
      ${member.legacyCustomerNo || ''}
      ${!isCustomerMode ? (member.legacyMemberNo || '') : ''}
      ${member.customerID || ''}
      ${!isCustomerMode ? (member.memberID || '') : ''}
    `.toLowerCase();
    
    const cifNum = (member.cifNo || '').replace(/\D/g, '');
    const cleanInput = input.replace(/\D/g, '');
    if (cleanInput) {
      if (cifNum && (cifNum.includes(cleanInput) || parseInt(cifNum) === parseInt(cleanInput))) return true;
      if (member.customerID && (member.customerID.toString().includes(cleanInput) || member.customerID === parseInt(cleanInput))) return true;
      if (member.legacyCustomerNo) {
        const legStr = member.legacyCustomerNo.toString();
        const legNum = legStr.replace(/\D/g, '');
        if (legStr.includes(cleanInput) || (legNum && (legNum.includes(cleanInput) || parseInt(legNum, 10) === parseInt(cleanInput, 10)))) return true;
      }
      if (!isCustomerMode) {
        const memCodeStr = (member.memberCode || '').toLowerCase();
        const memCodeNum = memCodeStr.replace(/\D/g, '');
        if (memCodeNum && (memCodeNum.includes(cleanInput) || parseInt(memCodeNum) === parseInt(cleanInput))) return true;
        if (member.memberID && (member.memberID.toString().includes(cleanInput) || member.memberID === parseInt(cleanInput))) return true;
        if (member.legacyMemberNo && member.legacyMemberNo.toString().includes(cleanInput)) return true;
      }
    }

    if (!isCustomerMode && member.memberCode && member.memberCode.toLowerCase().includes(input)) return true;

    return searchString.includes(input);
  };

  const formatOptionLabel = (data: any, { context }: any) => {
    const m = data.member;
    const fullName = m.fullName || `${m.firstName || ''} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName || ''}`.trim() || (isCustomerMode ? `खातेदार #${m.customerID || m.memberID}` : `सभासद #${m.memberID || m.customerID}`);
    const cifCode = m.cifNo ? (m.cifNo.toUpperCase().startsWith('CIF') ? m.cifNo : `CIF:${m.cifNo}`) : (m.legacyCustomerNo ? `CIF:${m.legacyCustomerNo}` : `CIF00${m.customerID || m.memberID}`);
    const memCode = isCustomerMode ? '' : (m.memberCode || '');

    if (context === 'value') {
      if (compact) {
        return (
          <div className="flex items-center overflow-hidden text-xs w-full" title={isCustomerMode ? `${cifCode}${m.legacyCustomerNo ? ` | जुना खातेदार नं: ${m.legacyCustomerNo}` : ''} | ${fullName}` : `${cifCode} | ${memCode} | ${fullName}`}>
            <span className="font-bold text-slate-900 truncate text-[11px]">
              {fullName}
            </span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-1.5 overflow-hidden text-xs py-0.5 w-full">
          <span className="text-[11px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-sky-100 text-sky-950 border border-sky-300">
            {cifCode}
          </span>
          {!isCustomerMode && memCode && (
            <span className="text-[11px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-300">
              {memCode}
            </span>
          )}
          {!isCustomerMode && m.legacyMemberNo && (
            <span className="text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-purple-100 text-purple-950 border border-purple-300">
              [जुना: {m.legacyMemberNo}]
            </span>
          )}
          {isCustomerMode && m.legacyCustomerNo && (
            <span className="text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-purple-100 text-purple-950 border border-purple-300">
              [जुना खातेदार नं: {m.legacyCustomerNo}]
            </span>
          )}
          <span className="font-bold text-slate-900 truncate text-xs ml-1">
            {fullName}
          </span>
          {m.mobileNo && (
            <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-auto hidden sm:inline">
              📱 {m.mobileNo}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between py-1.5 px-1 w-full gap-3 hover:bg-transparent">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] shrink-0 bg-sky-100 text-sky-950 border border-sky-300">
            {cifCode}
          </span>
          {!isCustomerMode && memCode && (
            <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] shrink-0 bg-emerald-100 text-emerald-950 border border-emerald-300">
              {memCode}
            </span>
          )}
          {!isCustomerMode && m.legacyMemberNo && (
            <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] shrink-0 bg-purple-100 text-purple-950 border border-purple-300">
              🏷️ जुना सभासद: {m.legacyMemberNo}
            </span>
          )}
          {isCustomerMode && m.legacyCustomerNo && (
            <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] shrink-0 bg-purple-100 text-purple-950 border border-purple-300">
              🏷️ जुना खातेदार नं: {m.legacyCustomerNo}
            </span>
          )}
          <span className="font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate">
            {fullName}
          </span>
          {m.nickName && (
            <span className="text-[11px] text-slate-500 italic shrink-0">
              ({m.nickName})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs">
          {m.mobileNo && (
            <span className="text-[11px] text-slate-600 font-mono shrink-0 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
              📱 {m.mobileNo}
            </span>
          )}
        </div>
      </div>
    );
  };

  const effectivePlaceholder = placeholder || (isCustomerMode ? "-- खातेदार शोधा (नाव, CIF किंवा जुना खातेदार नं) --" : "-- सभासद निवडा --");

  return (
    <div className={className}>
      <Select
        options={options}
        value={selectedOption}
        isDisabled={isDisabled}
        onChange={(selected: any) => {
          onChange(selected ? selected.value : '', selected ? selected.member : undefined);
        }}
        isClearable={isClearable}
        filterOption={filterOption}
        formatOptionLabel={formatOptionLabel}
        placeholder={effectivePlaceholder}
        styles={{
          control: (base, state) => ({
            ...base,
            minHeight: compact ? '26px' : '28px',
            height: compact ? '26px' : '28px',
            fontSize: '11px',
            borderColor: state.isFocused ? '#004a75' : '#d1d5db',
            borderRadius: '2px',
            boxShadow: state.isFocused ? '0 0 0 1px #004a75' : 'none',
            backgroundColor: isDisabled ? '#f8fafc' : '#ffffff',
            '&:hover': {
              borderColor: '#004a75'
            }
          }),
          valueContainer: (base) => ({
            ...base,
            padding: compact ? '0 4px' : '0 6px',
            height: compact ? '26px' : '28px',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden'
          }),
          input: (base) => ({
            ...base,
            margin: '0',
            padding: '0',
            fontSize: '11px'
          }),
          placeholder: (base) => ({
            ...base,
            fontSize: '11px',
            color: '#9ca3af'
          }),
          singleValue: (base) => ({
            ...base,
            fontSize: '11px',
            fontWeight: '700',
            color: '#0f172a',
            maxWidth: '100%',
            overflow: 'hidden'
          }),
          menu: (base) => ({
            ...base,
            fontSize: '11px',
            borderRadius: '4px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 99999,
            minWidth: '420px',
            maxWidth: '650px',
            width: 'max-content'
          }),
          menuPortal: (base) => ({
            ...base,
            zIndex: 999999
          }),
          option: (base, state) => ({
            ...base,
            padding: '6px 10px',
            backgroundColor: state.isSelected ? '#e0f2fe' : state.isFocused ? '#f8fafc' : '#ffffff',
            color: '#0f172a',
            cursor: 'pointer',
            borderBottom: '1px solid #f1f5f9'
          }),
          dropdownIndicator: (base) => ({
            ...base,
            padding: compact ? '0 2px' : '2px 4px'
          }),
          clearIndicator: (base) => ({
            ...base,
            padding: compact ? '0 2px' : '2px 4px'
          })
        }}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      />
    </div>
  );
}
