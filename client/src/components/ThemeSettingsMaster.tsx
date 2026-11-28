import React, { useState, useEffect } from 'react';

const ThemeSettingsMaster: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'pastel-maroon';
  });

  const [currentBg, setCurrentBg] = useState(() => {
    return localStorage.getItem('app-bg-theme') || 'pastel-warm';
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const primaryThemes = [
    { id: 'pastel-maroon', name: 'पॅस्टेल मरून-गोल्ड (Pastel Maroon Gold)', color: '#9A3412', desc: 'डिफॉल्ट फेंट पॅस्टेल मरून, आयव्हरी व केशरी-गोल्ड थीम' },
    { id: 'wine-red', name: 'वाइन रेड / बर्गुंडी (Wine Red - Burgundy)', color: '#880E4F', desc: 'रॉयल वाईन रेड व प्रिमियम बँकिंग थीम' },
    { id: 'green', name: 'एमराल्ड ग्रीन (Emerald Green - अमला)', color: '#0E8A5A', desc: 'समृद्धी व नैसर्गिक ग्रीन बँकिंग थीम' },
    { id: 'blue', name: 'कॉर्पोरेट निळा (Corporate Blue)', color: '#005689', desc: 'क्लासिक नेव्ही बँकिंग थीम' },
  ];

  const backgroundModes = [
    { id: 'pastel-warm', name: 'Pastel Ivory Gold (डिफॉल्ट)', bgHex: '#FDF2EE', borderHex: '#FCD34D', desc: 'फेंट रोझ-आयव्हरी-केशरी सॉफ्ट बॅकग्राउंड (डिफॉल्ट)' },
    { id: 'cream-warm', name: 'Warm Cream (क्रीम)', bgHex: '#f7f4ee', borderHex: '#e7e5e4', desc: 'डोळ्यांना आरामदायी वॉर्म क्रीम' },
    { id: 'pure-white', name: 'Pure White (पांढरा)', bgHex: '#ffffff', borderHex: '#e2e8f0', desc: 'स्वच्छ पांढरा बॅकग्राउंड' },
    { id: 'slate-soft', name: 'Soft Slate (ग्रे)', bgHex: '#f1f5f9', borderHex: '#cbd5e1', desc: 'सॉफ्ट करडा बॅकग्राउंड' },
    { id: 'ice-blue', name: 'Ice Blue (आकाशी)', bgHex: '#e6eff8', borderHex: '#bfdbfe', desc: 'थंड आकाशी शेड' },
  ];

  const handleApplyTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('app-theme', themeId);
    triggerSuccess();
  };

  const handleApplyBg = (bgId: string) => {
    setCurrentBg(bgId);
    document.documentElement.setAttribute('data-bg-theme', bgId);
    localStorage.setItem('app-bg-theme', bgId);
    triggerSuccess();
  };

  const triggerSuccess = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="p-3.5 max-w-full min-h-full flex flex-col cbs-page-canvas text-[11px] font-sans overflow-y-auto">
      {/* Header */}
      <div className="cbs-top-banner rounded-xl px-4 py-2.5 mb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-[#4A1410]">🎨 थीम व डिझाईन सेटिंग्ज (Theme & Appearance Settings)</span>
          <span className="text-[10px] text-[#7A5243] font-medium">(ॲप्लिकेशनचा रंग व बॅकग्राउंड बदला)</span>
        </div>
        {savedSuccess && (
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold text-[10px] animate-fade-in">
            ✓ सेटिंग्ज सेव्ह झाली!
          </span>
        )}
      </div>

      {/* 1. Primary Accent Colors */}
      <div className="cbs-card p-3 mb-3">
        <div className="text-xs font-bold text-[#4A1410] border-b border-amber-200/70 pb-1.5 mb-2.5 flex items-center gap-1.5">
          <span>१. प्रायमरी कलर थीम (Primary Color Palette)</span>
          <span className="text-[10px] text-[#8C5E4F] font-normal">(हेडर, बटन्स व हायलाईट्सचा मुख्य रंग)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {primaryThemes.map((t) => {
            const isSelected = currentTheme === t.id;
            return (
              <div
                key={t.id}
                onClick={() => handleApplyTheme(t.id)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between relative ${
                  isSelected
                    ? 'border-[#B44814] ring-2 ring-[#B44814]/20 bg-amber-50/40 shadow-sm'
                    : 'border-amber-200/70 hover:border-amber-300 hover:bg-[#FFFBF7]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className="w-6 h-6 rounded-full border border-black/10 shadow-xs flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: t.color }}
                    >
                      {isSelected && '✓'}
                    </div>
                    {isSelected && (
                      <span className="text-[9px] bg-[#9A3412] text-white px-1.5 py-0.5 rounded-full font-bold">
                        निवडलेले
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-[#4A1410] text-xs">{t.name}</div>
                  <div className="text-[10px] text-[#7A5243] mt-0.5">{t.desc}</div>
                </div>

                <div
                  className="h-1.5 w-full rounded-full mt-2.5"
                  style={{ backgroundColor: t.color }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Workspace Background Modes */}
      <div className="cbs-card p-3 mb-3">
        <div className="text-xs font-bold text-[#4A1410] border-b border-amber-200/70 pb-1.5 mb-2.5 flex items-center gap-1.5">
          <span>२. वर्कस्पेस बॅकग्राउंड रंग (Workspace Background Mode)</span>
          <span className="text-[10px] text-[#8C5E4F] font-normal">(मुख्य स्क्रीनच्या पार्श्वभूमीचा रंग)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          {backgroundModes.map((b) => {
            const isSelected = currentBg === b.id;
            return (
              <div
                key={b.id}
                onClick={() => handleApplyBg(b.id)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between relative ${
                  isSelected
                    ? 'border-[#B44814] ring-2 ring-[#B44814]/20 bg-amber-50/40 shadow-sm'
                    : 'border-amber-200/70 hover:border-amber-300 hover:bg-[#FFFBF7]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className="w-6 h-6 rounded-md shadow-xs border flex items-center justify-center text-xs font-bold text-[#4A1410]"
                      style={{ backgroundColor: b.bgHex, borderColor: b.borderHex }}
                    >
                      {isSelected && '✓'}
                    </div>
                    {isSelected && (
                      <span className="text-[9px] bg-[#9A3412] text-white px-1.5 py-0.5 rounded-full font-bold">
                        निवडलेले
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-[#4A1410] text-xs">{b.name}</div>
                  <div className="text-[10px] text-[#7A5243] mt-0.5">{b.desc}</div>
                </div>

                <div
                  className="h-3 w-full rounded mt-2.5 border"
                  style={{ backgroundColor: b.bgHex, borderColor: b.borderHex }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Live Preview Demo Component */}
      <div className="cbs-card p-3">
        <div className="text-xs font-bold text-[#4A1410] border-b border-amber-200/70 pb-1.5 mb-2.5">
          ३. निवडलेल्या थीमचा लाईव प्रीव्ह्यू (Live Interface Preview)
        </div>

        <div className="p-3 border border-amber-200/70 rounded-xl bg-[#FFFBF7] space-y-2.5">
          <div className="flex justify-between items-center bg-white p-2 border border-amber-200/70 rounded-lg shadow-2xs">
            <span className="text-xs font-bold text-[#4A1410]">नमूना फॉर्म शीर्षक (Sample Form Title)</span>
            <button className="cbs-btn-primary px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer">
              + नवीन नोंद (New Entry)
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-2 rounded-lg border border-amber-200/70 shadow-2xs">
              <div className="text-[10px] text-[#8C5E4F] font-bold uppercase">एकूण खातेदार</div>
              <div className="text-sm font-black text-[#4A1410] mt-0.5">१,२४५</div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-amber-200/70 shadow-2xs">
              <div className="text-[10px] text-[#8C5E4F] font-bold uppercase">एकूण ठेव रक्कम</div>
              <div className="text-sm font-black text-[#9A3412] mt-0.5">₹ ४५.५० लाख</div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-amber-200/70 shadow-2xs">
              <div className="text-[10px] text-[#8C5E4F] font-bold uppercase">एकूण कर्ज वाटप</div>
              <div className="text-sm font-black text-[#4A1410] mt-0.5">₹ ३२.१० लाख</div>
            </div>
          </div>

          <table className="w-full text-[11px] border-collapse bg-white border border-amber-200/80 rounded-lg overflow-hidden">
            <thead>
              <tr className="cbs-table-head font-bold text-left">
                <th className="p-1.5 border-r border-white/10">खाते क्र.</th>
                <th className="p-1.5 border-r border-white/10">सभासदाचे नाव</th>
                <th className="p-1.5 border-r border-white/10">प्रकार</th>
                <th className="p-1.5 text-right">शिल्लक रक्कम</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-amber-100 hover:bg-amber-50/60">
                <td className="p-1.5 border-r border-amber-100 font-mono font-bold text-[#9A3412]">SB-1001</td>
                <td className="p-1.5 border-r border-amber-100 font-bold text-[#4A1410]">रमेश मारुती पाटील</td>
                <td className="p-1.5 border-r border-amber-100 text-[#6E493C]">बचत खाते</td>
                <td className="p-1.5 text-right font-bold text-emerald-700">₹ २५,०००.००</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettingsMaster;
