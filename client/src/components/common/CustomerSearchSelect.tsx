import React from 'react';
import Select, { components } from 'react-select';

export interface CustomerOption {
  customerID: number;
  cifNo: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName?: string;
  legacyCustomerNo?: string;
  legacyLoanAccountNo?: string;
  loanAccountNo?: string;
  mobileNo?: string;
  aadhaarNo?: string;
  status?: string;
  id?: number;
  customerId?: number;
  customerName?: string;
}

interface Props {
  customers: (CustomerOption | any)[];
  value: number | string | '' | undefined;
  onChange: (customerId: number | '', searchQuery?: string) => void;
  placeholder?: string;
  className?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  menuAlign?: 'left' | 'right';
}

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

const getCustomerMatchScore = (data: any, rawInput: string): number => {
  if (!rawInput) return 1;
  const q = rawInput.toLowerCase().trim();
  if (!q) return 1;

  const cust = data?.customer;
  if (!cust) return 0;

  const cif = String(cust.cifNo || '').toLowerCase().trim();
  const cifDigits = cif.replace(/\D/g, '');
  const cifInt = cifDigits ? parseInt(cifDigits, 10) : NaN;

  const legacyCust = String(cust.legacyCustomerNo || '').toLowerCase().trim();
  const legacyCustDigits = legacyCust.replace(/\D/g, '');
  const legacyCustInt = legacyCustDigits ? parseInt(legacyCustDigits, 10) : NaN;

  const legacyLoan = String(cust.legacyLoanAccountNo || '').toLowerCase().trim();
  const loanNo = String(cust.loanAccountNo || '').toLowerCase().trim();
  const mobile = String(cust.mobileNo || '').replace(/\D/g, '');
  const aadhaar = String(cust.aadhaarNo || '').replace(/\D/g, '');
  const cId = Number(cust.customerID || 0);

  // 1. Explicit CIF prefix search (e.g. "CIF000105", "cif105", "cif 105")
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

  // 2. Pure numeric search (e.g. "105", "15", "9822...")
  if (/^\d+$/.test(q)) {
    const queryInt = parseInt(q, 10);

    // Tier 1: Exact CIF number match (e.g. "105" -> "CIF000105")
    if (!isNaN(cifInt) && cifInt === queryInt) return 1000;

    // Tier 2: Exact Legacy Customer No match
    if (legacyCust === q || (!isNaN(legacyCustInt) && legacyCustInt === queryInt)) return 950;

    // Tier 3: Exact CustomerID or Legacy Loan No match
    if (cId === queryInt) return 900;
    if (legacyLoan && legacyLoan === q) return 850;

    // Tier 4: Prefix matches on CIF / Legacy Customer No / CustomerID / Legacy Loan
    if (cifDigits && String(cifInt).startsWith(q)) return 750;
    if (legacyCust && legacyCust.startsWith(q)) return 700;
    if (cId > 0 && String(cId).startsWith(q)) return 650;
    if (legacyLoan && legacyLoan.startsWith(q)) return 600;

    // Tier 5: Substring matches on CIF / Legacy No / Loan No
    if ((cifDigits && cifDigits.includes(q)) || (legacyCust && legacyCust.includes(q)) || (legacyLoan && legacyLoan.includes(q)) || (loanNo && loanNo.includes(q))) {
      return 450;
    }

    // Tier 6: Mobile / Aadhaar match ONLY when user types 4+ digits (prevents 1-3 digit CIF/Legacy searches from matching random phone numbers!)
    if (q.length >= 4) {
      if (mobile === q || aadhaar === q) return 800;
      if (mobile.startsWith(q)) return 550;
      if (mobile.includes(q) || aadhaar.includes(q)) return 300;
    }

    return 0;
  }

  // 3. Text / Name (Marathi + English) / Alphanumeric search
  const fullName = String(cust.fullName || '').toLowerCase();
  const fName = String(cust.firstName || '').toLowerCase();
  const mName = String(cust.middleName || '').toLowerCase();
  const lName = String(cust.lastName || '').toLowerCase();
  const fNameEng = String(cust.firstNameEng || '').toLowerCase();
  const mNameEng = String(cust.middleNameEng || '').toLowerCase();
  const lNameEng = String(cust.lastNameEng || '').toLowerCase();
  const fullNameEng = String(cust.fullNameEng || '').toLowerCase();
  const nickName = String(cust.nickName || '').toLowerCase();

  if (cif === q) return 1000;
  if (legacyCust === q) return 950;
  if (legacyLoan && legacyLoan === q) return 920;
  if (fullName === q || (fullNameEng && fullNameEng === q)) return 900;
  if (fullName.startsWith(q) || fName.startsWith(q) || (fullNameEng && fullNameEng.startsWith(q)) || (fNameEng && fNameEng.startsWith(q))) return 820;
  if (lName.startsWith(q) || mName.startsWith(q) || (lNameEng && lNameEng.startsWith(q)) || (mNameEng && mNameEng.startsWith(q)) || (nickName && nickName.startsWith(q))) return 760;

  const searchText = data?.searchText || '';
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    if (tokens.every((t: string) => searchText.includes(t))) {
      const firstTokenStarts = fName.startsWith(tokens[0]) || lName.startsWith(tokens[0]) || (fNameEng && fNameEng.startsWith(tokens[0])) || (lNameEng && lNameEng.startsWith(tokens[0]));
      return firstTokenStarts ? 700 : 600;
    }
    return 0;
  }

  return searchText.includes(q) ? 500 : 0;
};

const filterCustomerOption = (option: any, inputValue: string) => {
  if (!inputValue || !inputValue.trim()) return true;
  return getCustomerMatchScore(option.data, inputValue) > 0;
};

export default function CustomerSearchSelect({
  customers = [],
  value,
  onChange,
  placeholder = "-- खातेदार निवडा (CIF / जुना खातेदार नं / नाव / मोबाईलने शोधा) --",
  className = "",
  isDisabled = false,
  isClearable = true,
  menuAlign = 'left'
}: Props) {
  const lastTypedSearchRef = React.useRef<string>('');
  const [searchInput, setSearchInput] = React.useState<string>('');

  const options = React.useMemo(() => {
    if (!Array.isArray(customers)) return [];
    const seenIds = new Set<number>();
    const result: any[] = [];

    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      if (!c) continue;
      const cId = Number(c.customerID || c.customerId || c.CustomerID || c.id || 0);
      if (!cId || isNaN(cId) || seenIds.has(cId)) continue;
      seenIds.add(cId);

      const cif = (c.cifNo || c.cif || c.CIFNo || '').trim();
      const legacyCust = (c.legacyCustomerNo || c.LegacyCustomerNo || c.oldCustomerCode || '').trim();
      const legacyLoan = (c.legacyLoanAccountNo || c.LegacyLoanAccountNo || c.legacyLoanNo || '').trim();
      const loanNo = (c.loanAccountNo || c.LoanAccountNo || '').trim();
      const mobile = (c.mobileNo || c.mobile || c.MobileNo || '').trim();
      const aadhaar = (c.aadhaarNo || c.aadhaar || c.AadhaarNo || '').trim();

      const fName = c.firstName || c.FirstName || '';
      const mName = c.middleName || c.MiddleName || '';
      const lName = c.lastName || c.LastName || '';
      const fNameEng = c.firstNameEng || c.FirstNameEng || '';
      const mNameEng = c.middleNameEng || c.MiddleNameEng || '';
      const lNameEng = c.lastNameEng || c.LastNameEng || '';
      const nickName = c.nickName || c.NickName || '';
      const fullName = (c.fullName || c.FullName || c.customerName || [fName, mName, lName].filter(Boolean).join(' ')).trim();
      const fullNameEng = [fNameEng, mNameEng, lNameEng].filter(Boolean).join(' ').trim();

      const codeParts: string[] = [];
      if (legacyLoan) codeParts.push(`जुने कर्ज क्र: ${legacyLoan}`);
      if (cif) codeParts.push(`CIF: ${cif}`);
      if (legacyCust) codeParts.push(`जुना खातेदार नं: ${legacyCust}`);
      if (mobile) codeParts.push(`मो.: ${mobile}`);

      const codeStr = codeParts.join(' | ');
      const label = codeStr ? `[${codeStr}] ${fullName}` : fullName;

      const searchText = `${label} ${fName} ${mName} ${lName} ${fullName} ${fNameEng} ${mNameEng} ${lNameEng} ${fullNameEng} ${nickName} ${cif} ${legacyCust} ${legacyLoan} ${loanNo} ${mobile} ${aadhaar} ${cId}`.toLowerCase();

      result.push({
        value: cId,
        label,
        searchText,
        customer: {
          ...c,
          customerID: cId,
          cifNo: cif,
          legacyCustomerNo: legacyCust,
          legacyLoanAccountNo: legacyLoan,
          loanAccountNo: loanNo,
          mobileNo: mobile,
          aadhaarNo: aadhaar,
          firstName: fName,
          middleName: mName,
          lastName: lName,
          firstNameEng: fNameEng,
          middleNameEng: mNameEng,
          lastNameEng: lNameEng,
          fullNameEng,
          nickName,
          fullName
        }
      });
    }

    return result;
  }, [customers]);

  const sortedOptions = React.useMemo(() => {
    const q = searchInput.trim();
    if (!q) return options;
    const scored: { opt: any; score: number; idx: number }[] = [];
    for (let i = 0; i < options.length; i++) {
      const score = getCustomerMatchScore(options[i], q);
      if (score > 0) {
        scored.push({ opt: options[i], score, idx: i });
      }
    }
    scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));
    return scored.map(s => s.opt);
  }, [options, searchInput]);

  const numericValue = value !== '' && value !== undefined && value !== null ? Number(value) : '';

  const selectedOption = React.useMemo(() => {
    if (numericValue === '' || isNaN(numericValue as number)) return null;
    return options.find(o => o.value === numericValue) || null;
  }, [numericValue, options]);

  return (
    <div className={`relative z-50 ${className}`}>
      <Select
        value={selectedOption}
        onInputChange={(newValue: string, actionMeta: any) => {
          if (actionMeta?.action === 'input-change') {
            lastTypedSearchRef.current = newValue || '';
            setSearchInput(newValue || '');
          } else if (actionMeta?.action === 'menu-close' || actionMeta?.action === 'set-value') {
            setSearchInput('');
          }
        }}
        onBlur={() => {
          lastTypedSearchRef.current = '';
          setSearchInput('');
        }}
        onChange={(selected: any) => {
          const typedQuery = (lastTypedSearchRef.current || '').trim();
          lastTypedSearchRef.current = '';
          setSearchInput('');
          onChange(selected ? selected.value : '', typedQuery);
        }}
        options={sortedOptions}
        components={SELECT_COMPONENTS}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isClearable={isClearable}
        filterOption={filterCustomerOption}
        classNamePrefix="react-select"
        formatOptionLabel={(data: any, { context }: any) => {
          const cust = data.customer;
          if (context === 'value') {
            const cifDisplay = cust.cifNo || `ID:${cust.customerID}`;
            return (
              <div className="flex items-center gap-1.5 overflow-hidden text-[11px] py-0 w-full" title={`${cust.fullName} (${cifDisplay})${cust.legacyCustomerNo ? ` [जुना खातेदार नं: ${cust.legacyCustomerNo}]` : ''}${cust.legacyLoanAccountNo ? ` [जुने कर्ज: ${cust.legacyLoanAccountNo}]` : ''}`}>
                {cust.legacyLoanAccountNo && (
                  <span className="text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 leading-none shadow-2xs">
                    जुने कर्ज: {cust.legacyLoanAccountNo}
                  </span>
                )}
                <span className="text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-900 border border-blue-300 leading-none">
                  {cifDisplay}
                </span>
                {cust.legacyCustomerNo && (
                  <span className="text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 leading-none">
                    [जुना खातेदार नं: {cust.legacyCustomerNo}]
                  </span>
                )}
                <span className="font-bold text-slate-900 truncate text-[11px]">
                  {cust.fullName}
                </span>
                {cust.mobileNo && (
                  <span className="text-[10px] text-emerald-700 font-mono shrink-0 ml-auto hidden 2xl:inline">
                    📱 {cust.mobileNo}
                  </span>
                )}
              </div>
            );
          }

          return (
            <div className="flex items-center justify-between py-1 px-1 w-full gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {cust.cifNo && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 shrink-0 whitespace-nowrap">
                    {cust.cifNo}
                  </span>
                )}
                {cust.legacyCustomerNo && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 shrink-0 whitespace-nowrap">
                    [जुना खातेदार नं: {cust.legacyCustomerNo}]
                  </span>
                )}
                {cust.legacyLoanAccountNo && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 shrink-0 whitespace-nowrap shadow-2xs">
                    🏷️ जुने कर्ज क्र: {cust.legacyLoanAccountNo}
                  </span>
                )}
                <span className="font-bold text-slate-900 text-xs truncate max-w-[220px] sm:max-w-[280px]">
                  {cust.fullName}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {cust.mobileNo && (
                  <span className="text-[10px] text-slate-600 font-mono shrink-0 whitespace-nowrap bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                    📱 {cust.mobileNo}
                  </span>
                )}
              </div>
            </div>
          );
        }}
        styles={{
          control: (base: any, state: any) => ({
            ...base,
            minHeight: '30px',
            height: '30px',
            fontSize: '11px',
            borderRadius: '2px',
            borderColor: state.isFocused ? '#0284c7' : '#d1d5db',
            boxShadow: state.isFocused ? '0 0 0 1px #0284c7' : 'none',
            backgroundColor: '#ffffff',
            '&:hover': {
              borderColor: '#9ca3af'
            }
          }),
          valueContainer: (base: any) => ({
            ...base,
            height: '30px',
            padding: '0 6px',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden'
          }),
          singleValue: (base: any) => ({
            ...base,
            maxWidth: 'calc(100% - 8px)',
            margin: '0'
          }),
          input: (base: any) => ({
            ...base,
            margin: '0px',
            padding: '0px',
            fontSize: '11px'
          }),
          indicatorsContainer: (base: any) => ({
            ...base,
            height: '30px'
          }),
          dropdownIndicator: (base: any) => ({
            ...base,
            padding: '2px 4px'
          }),
          clearIndicator: (base: any) => ({
            ...base,
            padding: '2px 4px'
          }),
          menu: (base: any) => ({
            ...base,
            fontSize: '11px',
            zIndex: 99999,
            left: menuAlign === 'right' ? 'auto' : 0,
            right: menuAlign === 'right' ? 0 : 'auto',
            minWidth: '480px',
            width: 'max-content',
            maxWidth: '90vw',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
            border: '1px solid #cbd5e1',
          }),
          menuList: (base: any) => ({
            ...base,
            padding: '4px',
            maxHeight: '260px',
          }),
          option: (base: any, state: any) => ({
            ...base,
            padding: '6px 8px',
            borderRadius: '4px',
            backgroundColor: state.isSelected 
              ? '#0284c7' 
              : state.isFocused 
                ? '#f0f9ff' 
                : 'white',
            color: state.isSelected ? 'white' : '#1e293b',
            cursor: 'pointer'
          })
        }}
      />
    </div>
  );
}
