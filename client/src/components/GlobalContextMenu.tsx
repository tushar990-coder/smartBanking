import React, { useState, useEffect, useRef } from 'react';

interface ContextMenuItem {
  id: string;
  label: string;
  tabName: string;
  isMemberSpecific?: boolean;
}

const GlobalContextMenu: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();

      let x = e.clientX;
      let y = e.clientY;

      // Menu width & height estimation for bounds collision check
      const menuWidth = 220;
      const menuHeight = 360;

      if (x + menuWidth > window.innerWidth) {
        x = Math.max(10, window.innerWidth - menuWidth - 15);
      }
      if (y + menuHeight > window.innerHeight) {
        y = Math.max(10, window.innerHeight - menuHeight - 15);
      }

      setPosition({ x, y });
      setIsVisible(true);
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      } else if (isVisible) {
        setIsVisible(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVisible(false);
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible]);

  const openInNewTab = (tabName: string, paramStr: string = '') => {
    const url = `/?tab=${tabName}${paramStr}`;
    window.open(url, '_blank');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const financialReports: ContextMenuItem[] = [
    { id: 'daybook', label: 'रोजकीर्द', tabName: 'daybook' },
    { id: 'cash-book', label: 'कॅशबुक', tabName: 'cash-book' },
    { id: 'general-ledger', label: 'जनरल लेजर', tabName: 'general-ledger' },
    { id: 'trial-balance', label: 'तेरस पत्रक', tabName: 'trial-balance' }
  ];

  const loanReports: ContextMenuItem[] = [
    { id: 'loan-disbursement', label: 'कर्ज वाटप रजिस्टर', tabName: 'loan-disbursement-register' },
    { id: 'loan-collection', label: 'कर्ज वसुली रजिस्टर', tabName: 'loan-collection-register' },
    { id: 'loan-ledger', label: 'कर्ज खतावणी', tabName: 'loan-ledger-report', isMemberSpecific: true },
    { id: 'loan-overdue', label: 'थकीत कर्ज अहवाल', tabName: 'loan-overdue-report' }
  ];

  const depositAndShareReports: ContextMenuItem[] = [
    { id: 'saving-khatavani', label: 'बचत खतावणी', tabName: 'saving-khatavani-report' },
    { id: 'fd-reports', label: 'मुदत ठेव अहवाल', tabName: 'fd-reports' },
    { id: 'shares-khatavani', label: 'शेअर्स खतावणी', tabName: 'shares-khatavani-report' }
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-slate-200 shadow-xl rounded-lg py-1.5 z-50 text-xs w-52 font-sans text-slate-800 select-none animate-in fade-in zoom-in-95 duration-100 overflow-hidden ring-1 ring-black/5"
      style={{ top: position.y, left: position.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-slate-200 flex justify-between items-center bg-slate-50 mb-1">
        <span className="text-[11px] font-bold text-slate-800">
          क्विक अहवाल
        </span>
        <span className="text-[9px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.5 rounded border border-blue-200">
          नवीन टॅब ↗
        </span>
      </div>

      <div className="max-h-[78vh] overflow-y-auto custom-scrollbar px-1 space-y-1.5">
        {/* Section 1: Financial Reports */}
        <div>
          <div className="px-2.5 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            आर्थिक अहवाल
          </div>
          <div className="space-y-0.5">
            {financialReports.map((item) => (
              <button
                key={item.id}
                onClick={() => openInNewTab(item.tabName)}
                className="w-full text-left px-3 py-1.5 rounded hover:bg-blue-50/80 text-slate-700 hover:text-blue-900 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-blue-600"
              >
                <div className="font-semibold text-slate-800 group-hover:text-blue-900 leading-tight">{item.label}</div>
                <span className="text-[10px] opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity">↗</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Loan Reports */}
        <div className="border-t border-slate-100 pt-1">
          <div className="px-2.5 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            कर्ज अहवाल
          </div>
          <div className="space-y-0.5">
            {loanReports.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.isMemberSpecific) {
                    const memberId = (window as any).selectedLoanMemberId;
                    openInNewTab(item.tabName, memberId ? `&memberId=${memberId}` : '');
                  } else {
                    openInNewTab(item.tabName);
                  }
                }}
                className="w-full text-left px-3 py-1.5 rounded hover:bg-blue-50/80 text-slate-700 hover:text-blue-900 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-blue-600"
              >
                <div className="font-semibold text-slate-800 group-hover:text-blue-900 leading-tight">{item.label}</div>
                <span className="text-[10px] opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity">↗</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Deposits & Shares */}
        <div className="border-t border-slate-100 pt-1">
          <div className="px-2.5 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            ठेवी व भाग
          </div>
          <div className="space-y-0.5">
            {depositAndShareReports.map((item) => (
              <button
                key={item.id}
                onClick={() => openInNewTab(item.tabName)}
                className="w-full text-left px-3 py-1.5 rounded hover:bg-blue-50/80 text-slate-700 hover:text-blue-900 flex items-center justify-between group transition-colors border-l-2 border-transparent hover:border-blue-600"
              >
                <div className="font-semibold text-slate-800 group-hover:text-blue-900 leading-tight">{item.label}</div>
                <span className="text-[10px] opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity">↗</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1 mt-1 border-t border-slate-100 text-[9px] text-slate-400 text-center bg-slate-50/60">
        [Esc] बंद करण्यासाठी दाबा
      </div>
    </div>
  );
};

export default GlobalContextMenu;
