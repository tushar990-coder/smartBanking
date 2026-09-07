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
}

export default function MemberSearchSelect({
  members = [],
  value,
  onChange,
  placeholder = "-- सभासद निवडा --",
  className = "",
  isDisabled = false,
  isClearable = true
}: Props) {
  
  // Transform members into react-select options format
  const options = React.useMemo(() => {
    if (!Array.isArray(members)) return [];
    return members.map((m: any) => {
      const rawMemProfile = m.memberProfile || m.MemberProfile;
      const memId = Number(rawMemProfile?.memberID || rawMemProfile?.MemberID || m.memberID || m.memberId || m.MemberID || 0);
      const custId = Number(m.customerID || m.customerId || m.CustomerID || m.id || 0) || (memId > 0 ? memId : 0);
      const primaryValueId = Number(m.memberID || m.memberId || m.MemberID || m.customerID || m.customerId || m.CustomerID || m.id || 0);

      const rawCode = (rawMemProfile?.memberCode || rawMemProfile?.MemberCode || m.memberCode || m.code || m.MemberCode || '').trim();
      const isNullOrEmpty = !rawCode || rawCode.toLowerCase() === 'null' || rawCode.toLowerCase() === 'undefined';
      const cleanMemCode = isNullOrEmpty ? '' : rawCode;

      const rawLegacyMember = String(rawMemProfile?.legacyMemberNo || rawMemProfile?.LegacyMemberNo || m.legacyMemberNo || m.oldMemberCode || m.oldMemberNo || m.LegacyMemberNo || '').trim();
      const rawLegacyCust = String(m.legacyCustomerNo || m.LegacyCustomerNo || (m as any)?.customerProfile?.legacyCustomerNo || '').trim();
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
        fullName = `सभासद / खातेदार #${primaryValueId}`;
      }

      // If customer has a Member Code, display [CIF | MEMxxxx], otherwise display strictly [CIF]
      const cleanCif = cif || (rawLegacyCust ? `CIF:${rawLegacyCust}` : `CIF00${custId || primaryValueId}`);
      const prefix = cleanMemCode ? `[${cleanCif} | ${cleanMemCode}]` : `[${cleanCif}]`;
      const label = `${prefix} ${fullName}${nick ? ` (${nick})` : ''}${mobile ? ` - 📱 ${mobile}` : ''}`;

      return {
        value: primaryValueId,
        label: label,
        member: {
          ...m,
          memberID: primaryValueId,
          memberIdOnly: memId,
          customerID: custId,
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
  }, [members]);

  const numericValue = value !== '' && value !== undefined && value !== null ? Number(value) : '';

  const selectedOption = React.useMemo(() => {
    if (numericValue === '' || isNaN(numericValue as number)) return null;
    
    // Priority 1: Exact match on primary option value (e.g. CustomerID when passed from Customer list)
    const exactMatch = options.find(o => o.value === numericValue);
    if (exactMatch) return exactMatch;

    // Priority 2: Direct CustomerID match
    const custMatch = options.find(o => o.member?.customerID === numericValue);
    if (custMatch) return custMatch;

    // Priority 3: Direct MemberID match
    const memMatch = options.find(o => o.member?.memberID === numericValue);
    if (memMatch) return memMatch;

    // Priority 4: Secondary fallback to memberIdOnly
    return options.find(o => o.member?.memberIdOnly === numericValue) || null;
  }, [numericValue, options]);

  // Pure Customer / CIF filter logic (Searches by CIF Number, Member Code, Name, Mobile, Legacy IDs)
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
      ${member.memberCode || ''}
      ${member.legacyCustomerNo || ''}
      ${member.legacyMemberNo || ''}
      ${member.customerID || ''}
      ${member.memberID || ''}
    `.toLowerCase();
    
    const cifNum = (member.cifNo || '').replace(/\D/g, '');
    const memCodeStr = (member.memberCode || '').toLowerCase();
    const memCodeNum = memCodeStr.replace(/\D/g, '');
    const cleanInput = input.replace(/\D/g, '');
    if (cleanInput) {
      if (cifNum && (cifNum.includes(cleanInput) || parseInt(cifNum) === parseInt(cleanInput))) return true;
      if (memCodeNum && (memCodeNum.includes(cleanInput) || parseInt(memCodeNum) === parseInt(cleanInput))) return true;
      if (member.customerID && (member.customerID.toString().includes(cleanInput) || member.customerID === parseInt(cleanInput))) return true;
      if (member.memberID && (member.memberID.toString().includes(cleanInput) || member.memberID === parseInt(cleanInput))) return true;
      if (member.legacyCustomerNo && member.legacyCustomerNo.toString().includes(cleanInput)) return true;
      if (member.legacyMemberNo && member.legacyMemberNo.toString().includes(cleanInput)) return true;
    }

    if (memCodeStr && memCodeStr.includes(input)) return true;

    return searchString.includes(input);
  };

  const formatOptionLabel = (data: any, { context }: any) => {
    const m = data.member;
    const fullName = m.fullName || `${m.firstName || ''} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName || ''}`.trim() || `ग्राहक #${m.customerID || m.memberID}`;
    const cifCode = m.cifNo || (m.legacyCustomerNo ? `CIF:${m.legacyCustomerNo}` : `CIF00${m.customerID || m.memberID}`);
    const memCode = m.memberCode || '';

    if (context === 'value') {
      return (
        <div className="flex items-center gap-1.5 overflow-hidden text-xs py-0.5 w-full">
          <span className="text-[11px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-sky-100 text-sky-950 border border-sky-300">
            {cifCode}
          </span>
          {memCode && (
            <span className="text-[11px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-300">
              {memCode}
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
          {memCode && (
            <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] shrink-0 bg-emerald-100 text-emerald-950 border border-emerald-300">
              {memCode}
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
        placeholder={placeholder}
        styles={{
          control: (base, state) => ({
            ...base,
            minHeight: '28px',
            height: '28px',
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
            padding: '0 6px',
            height: '28px',
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
            padding: '2px 4px'
          }),
          clearIndicator: (base) => ({
            ...base,
            padding: '2px 4px'
          })
        }}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      />
    </div>
  );
}
