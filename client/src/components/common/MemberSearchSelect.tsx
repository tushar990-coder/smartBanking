import React from 'react';
import Select, { components } from 'react-select';

const MAX_RENDERED_OPTIONS = 200;

const CappedMenuList = (props: any) => {
  const { children } = props;
  const inputValue = props.selectProps?.inputValue || '';
  const [visibleCount, setVisibleCount] = React.useState(MAX_RENDERED_OPTIONS);

  React.useEffect(() => {
    setVisibleCount(MAX_RENDERED_OPTIONS);
  }, [inputValue]);

  const totalCount = Array.isArray(children) ? children.length : 0;
  const isCapped = Array.isArray(children) && totalCount > visibleCount;
  const cappedChildren = isCapped ? children.slice(0, visibleCount) : children;

  return (
    <components.MenuList {...props}>
      {cappedChildren}
      {isCapped && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="sticky bottom-0 bg-amber-50 border-t border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-900 flex flex-wrap items-center justify-between gap-2 z-10"
        >
          <span className="font-semibold">
            💡 एकूण <b>{totalCount}</b> पैकी पहिल्या <b>{visibleCount}</b> नोंदी दिसत आहेत (पुढील नावांसाठी वर टाईप करून शोधा)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setVisibleCount((prev) => prev + 200);
              }}
              className="px-2 py-0.5 bg-primary text-white rounded text-[10.5px] font-bold hover:bg-primary/90 cursor-pointer shadow-2xs"
            >
              ➕ पुढील २०० दाखवा
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setVisibleCount(totalCount);
              }}
              className="px-2 py-0.5 bg-white text-slate-700 border border-slate-300 rounded text-[10.5px] font-bold hover:bg-slate-100 cursor-pointer"
            >
              सर्व ({totalCount}) दाखवा
            </button>
          </div>
        </div>
      )}
    </components.MenuList>
  );
};

const SELECT_COMPONENTS = { MenuList: CappedMenuList };

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
  const [searchInput, setSearchInput] = React.useState<string>('');
  
  // Transform members into react-select options format
  const options = React.useMemo(() => {
    if (!Array.isArray(members)) return [];
    const seenValues = new Set<number>();
    const result: any[] = [];

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m) continue;
      const rawMemProfile = m.memberProfile || m.MemberProfile;
      const memId = Number(rawMemProfile?.memberID || rawMemProfile?.MemberID || m.memberID || m.memberId || m.MemberID || 0);
      const custId = Number(m.customerID || m.customerId || m.CustomerID || m.id || 0);
      
      // If customer mode, strictly prioritize custId.
      // Otherwise (default 'memberId'), prioritize memId if memId > 0; if not, fallback to custId.
      const primaryValueId = isCustomerMode
        ? (custId > 0 ? custId : memId)
        : (memId > 0 ? memId : custId);

      if (!primaryValueId || isNaN(primaryValueId) || seenValues.has(primaryValueId)) continue;
      seenValues.add(primaryValueId);

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
      const fNameEng = String(m.firstNameEng || m.FirstNameEng || '').trim();
      const mNameEng = String(m.middleNameEng || m.MiddleNameEng || '').trim();
      const lNameEng = String(m.lastNameEng || m.LastNameEng || '').trim();
      const fullNameEng = [fNameEng, mNameEng, lNameEng].filter(Boolean).join(' ').trim();
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

      result.push({
        value: primaryValueId,
        label: label,
        member: {
          ...m,
          memberID: memId > 0 ? memId : primaryValueId,
          memberIdOnly: memId,
          customerID: custId > 0 ? custId : undefined,
          memberCode: cleanMemCode,
          legacyMemberNo: rawLegacyMember,
          legacyCustomerNo: rawLegacyCust,
          cifNo: cif,
          mobileNo: mobile,
          aadhaarNo: aadhaar,
          firstName: fName,
          middleName: mName,
          lastName: lName,
          firstNameEng: fNameEng,
          middleNameEng: mNameEng,
          lastNameEng: lNameEng,
          fullNameEng: fullNameEng,
          nickName: nick,
          fullName: fullName
        }
      });
    }

    return result;
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

  // Smart Relevance Scoring for Member & CIF Search
  const getMemberMatchScore = React.useCallback((opt: any, rawInput: string): number => {
    const q = (rawInput || '').toLowerCase().trim();
    if (!q) return 1;

    const { label, member } = opt;
    if (!member) return 0;

    const cif = String(member.cifNo || '').toLowerCase().trim();
    const cifDigits = cif.replace(/\D/g, '');
    const cifInt = cifDigits ? parseInt(cifDigits, 10) : NaN;

    const memCode = String(member.memberCode || '').toLowerCase().trim();
    const memCodeDigits = memCode.replace(/\D/g, '');
    const memCodeInt = memCodeDigits ? parseInt(memCodeDigits, 10) : NaN;

    const legMem = String(member.legacyMemberNo || '').toLowerCase().trim();
    const legMemDigits = legMem.replace(/\D/g, '');
    const legMemInt = legMemDigits ? parseInt(legMemDigits, 10) : NaN;

    const legCust = String(member.legacyCustomerNo || '').toLowerCase().trim();
    const legCustDigits = legCust.replace(/\D/g, '');
    const legCustInt = legCustDigits ? parseInt(legCustDigits, 10) : NaN;

    const mobile = String(member.mobileNo || '').replace(/\D/g, '');
    const aadhaar = String(member.aadhaarNo || '').replace(/\D/g, '');
    const memId = Number(member.memberIdOnly || member.memberID || 0);
    const custId = Number(member.customerID || 0);

    // 1. Explicit CIF search (e.g. "CIF000015", "cif15", "cif 15") -> Match ONLY CIF!
    if (/^cif[\s\-:]*\d*$/i.test(q)) {
      const cifQueryDigits = q.replace(/^cif[\s\-:]*/i, '').replace(/\D/g, '');
      if (!cifQueryDigits) return cif ? 100 : 0;
      const queryCifInt = parseInt(cifQueryDigits, 10);
      if (cif === q || (!isNaN(cifInt) && !isNaN(queryCifInt) && cifInt === queryCifInt)) {
        return 1000;
      }
      if ((cifDigits && String(cifInt).startsWith(cifQueryDigits)) || cif.startsWith(q)) {
        return 800;
      }
      if (cifDigits && cifDigits.includes(cifQueryDigits)) {
        return 500;
      }
      return 0;
    }

    // 2. Explicit Member Code search (e.g. "MEM0015", "mem15") -> Match ONLY MemberCode / LegacyMemberNo!
    if (!isCustomerMode && /^mem[\s\-:]*\d*$/i.test(q)) {
      const memQueryDigits = q.replace(/^mem[\s\-:]*/i, '').replace(/\D/g, '');
      if (!memQueryDigits) return memCode ? 100 : 0;
      const queryMemInt = parseInt(memQueryDigits, 10);
      if (memCode === q || (!isNaN(memCodeInt) && !isNaN(queryMemInt) && memCodeInt === queryMemInt)) {
        return 1000;
      }
      if ((memCodeDigits && String(memCodeInt).startsWith(memQueryDigits)) || memCode.startsWith(q)) {
        return 800;
      }
      if (memCodeDigits && memCodeDigits.includes(memQueryDigits)) {
        return 500;
      }
      return 0;
    }

    // 3. Pure numeric search (e.g. "15", "105", "9822...")
    if (/^\d+$/.test(q)) {
      const queryInt = parseInt(q, 10);

      // Tier 1: Exact CIF or Legacy Member No match
      const isExactCif = !isNaN(cifInt) && cifInt === queryInt;
      const isExactLegMem = !isCustomerMode && (legMem === q || (!isNaN(legMemInt) && legMemInt === queryInt));
      const isExactLegCust = legCust === q || (!isNaN(legCustInt) && legCustInt === queryInt);
      const isExactMemCode = !isCustomerMode && !isNaN(memCodeInt) && memCodeInt === queryInt;

      if (isExactCif && isExactLegMem) return 1050;
      if (isExactCif) return 1000;
      if (isExactLegMem) return 980;
      if (isExactLegCust) return 960;
      if (isExactMemCode) return 940;
      if (!isCustomerMode && memId === queryInt) return 900;
      if (custId === queryInt) return 880;

      // Tier 2: Prefix match on CIF / Legacy No / MemberCode
      if (cifDigits && String(cifInt).startsWith(q)) return 760;
      if (!isCustomerMode && legMem && legMem.startsWith(q)) return 740;
      if (legCust && legCust.startsWith(q)) return 720;
      if (!isCustomerMode && memCodeDigits && String(memCodeInt).startsWith(q)) return 700;

      // Tier 3: Substring match on CIF / Legacy No / MemberCode
      if (
        (cifDigits && cifDigits.includes(q)) ||
        (!isCustomerMode && legMem && legMem.includes(q)) ||
        (legCust && legCust.includes(q)) ||
        (!isCustomerMode && memCodeDigits && memCodeDigits.includes(q))
      ) {
        return 450;
      }

      // Tier 4: Mobile / Aadhaar match ONLY when user types 4+ digits
      if (q.length >= 4) {
        if (mobile === q || aadhaar === q) return 800;
        if (mobile.startsWith(q)) return 550;
        if (mobile.includes(q) || aadhaar.includes(q)) return 300;
      }

      return 0;
    }

    // 4. Text / Name (Marathi + English) / Mixed Search
    const fullName = String(member.fullName || '').toLowerCase();
    const fName = String(member.firstName || '').toLowerCase();
    const mName = String(member.middleName || '').toLowerCase();
    const lName = String(member.lastName || '').toLowerCase();
    const fNameEng = String(member.firstNameEng || '').toLowerCase();
    const mNameEng = String(member.middleNameEng || '').toLowerCase();
    const lNameEng = String(member.lastNameEng || '').toLowerCase();
    const fullNameEng = String(member.fullNameEng || '').toLowerCase();
    const nickName = String(member.nickName || '').toLowerCase();

    if (cif === q) return 1000;
    if (!isCustomerMode && (memCode === q || legMem === q)) return 980;
    if (legCust === q) return 960;
    if (fullName === q || (fullNameEng && fullNameEng === q)) return 920;
    if (fullName.startsWith(q) || fName.startsWith(q) || (fullNameEng && fullNameEng.startsWith(q)) || (fNameEng && fNameEng.startsWith(q))) return 820;
    if (lName.startsWith(q) || mName.startsWith(q) || (lNameEng && lNameEng.startsWith(q)) || (mNameEng && mNameEng.startsWith(q)) || nickName.startsWith(q)) return 760;

    const searchString = `
      ${label}
      ${fullName}
      ${fName}
      ${mName}
      ${lName}
      ${fullNameEng}
      ${fNameEng}
      ${mNameEng}
      ${lNameEng}
      ${nickName}
      ${mobile}
      ${cif}
      ${!isCustomerMode ? memCode : ''}
      ${legCust}
      ${!isCustomerMode ? legMem : ''}
    `.toLowerCase();

    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      if (tokens.every((t: string) => searchString.includes(t))) {
        const firstTokenStarts = fName.startsWith(tokens[0]) || lName.startsWith(tokens[0]) || (fNameEng && fNameEng.startsWith(tokens[0])) || (lNameEng && lNameEng.startsWith(tokens[0]));
        return firstTokenStarts ? 700 : 600;
      }
      return 0;
    }

    return searchString.includes(q) ? 500 : 0;
  }, [isCustomerMode]);

  const sortedOptions = React.useMemo(() => {
    const q = searchInput.trim();
    if (!q) return options;
    const scored: { opt: any; score: number; idx: number }[] = [];
    for (let i = 0; i < options.length; i++) {
      const score = getMemberMatchScore(options[i], q);
      if (score > 0) {
        scored.push({ opt: options[i], score, idx: i });
      }
    }
    scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));
    return scored.map(s => s.opt);
  }, [options, searchInput, getMemberMatchScore]);

  const filterOptionHandler = React.useCallback(
    (option: any, rawInput: string) => {
      if (!rawInput || !rawInput.trim()) return true;
      return getMemberMatchScore(option.data, rawInput) > 0;
    },
    [getMemberMatchScore]
  );

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
    <div className={`relative z-50 ${className}`}>
      <Select
        options={sortedOptions}
        components={SELECT_COMPONENTS}
        value={selectedOption}
        isDisabled={isDisabled}
        onInputChange={(newValue: string, actionMeta: any) => {
          if (actionMeta?.action === 'input-change') {
            setSearchInput(newValue || '');
          } else if (actionMeta?.action === 'menu-close' || actionMeta?.action === 'set-value') {
            setSearchInput('');
          }
        }}
        onBlur={() => {
          setSearchInput('');
        }}
        onChange={(selected: any) => {
          setSearchInput('');
          onChange(selected ? selected.value : '', selected ? selected.member : undefined);
        }}
        isClearable={isClearable}
        filterOption={filterOptionHandler}
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
      />
    </div>
  );
}
