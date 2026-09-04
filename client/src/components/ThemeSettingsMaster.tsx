import React, { useState, useEffect } from 'react';

const ThemeSettingsMaster: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'blue';
  });

  const [currentBg, setCurrentBg] = useState(() => {
    return localStorage.getItem('app-bg-theme') || 'slate-soft';
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const primaryThemes = [
    { id: 'blue', name: 'कॉर्पोरेट निळा (Corporate Blue)', color: '#005689', desc: 'डिफॉल्ट क्लासिक नेव्ही बँकिंग थीम' },
    { id: 'green', name: 'एमराल्ड ग्रीन (Emerald Green - अमला)', color: '#0E8A5A', desc: 'समृद्धी व नैसर्गिक ग्रीन बँकिंग थीम' },
    { id: 'wine-red', name: 'वाइन रेड / बर्गुंडी (Wine Red - Burgundy)', color: '#880E4F', desc: 'रॉयल वाईन रेड व प्रिमियम बँकिंग थीम' },
  ];

  const backgroundModes = [
    { id: 'slate-soft', name: 'Soft Slate (ग्रे)', bgHex: '#f1f5f9', borderHex: '#cbd5e1', desc: 'सॉफ्ट करडा बॅकग्राउंड (डिफॉल्ट)' },
    { id: 'ice-blue', name: 'Ice Blue (आकाशी)', bgHex: '#e6eff8', borderHex: '#bfdbfe', desc: 'थंड आकाशी शेड' },
    { id: 'cream-warm', name: 'Warm Cream (क्रीम)', bgHex: '#f7f4ee', borderHex: '#e7e5e4', desc: 'डोळ्यांना आरामदायी वॉर्म क्रीम' },
    { id: 'pure-white', name: 'Pure White (पांढरा)', bgHex: '#ffffff', borderHex: '#e2e8f0', desc: 'स्वच्छ पांढरा बॅकग्राउंड' },
    { id: 'neutral-gray', name: 'Medium Gray (मध्यम)', bgHex: '#e2e8f0', borderHex: '#94a3b8', desc: 'मध्यम करडा शेड' },
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
    <div className="p-3 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans overflow-y-auto">
      {/* Header */}
      <div className="text-xs font-bold text-primary border-b border-gray-400 pb-1 mb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span>🎨 थीम व डिझाईन सेटिंग्ज (Theme & Appearance Settings)</span>
          <span className="text-[10px] text-gray-500 font-normal">(ॲप्लिकेशनचा रंग व बॅकग्राउंड बदला)</span>
        </div>
        {savedSuccess && (
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-sm font-bold text-[10px] animate-fade-in">
            ✓ सेटिंग्ज सेव्ह झाली!
          </span>
        )}
      </div>

      {/* 1. Primary Accent Colors */}
      <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200 mb-3">
        <div className="text-xs font-bold text-primary border-b border-gray-200 pb-1 mb-2 flex items-center gap-1.5">
          <span>१. प्रायमरी कलर थीम (Primary Color Palette)</span>
          <span className="text-[10px] text-gray-400 font-normal">(हेडर, बटन्स व हायलाईट्सचा मुख्य रंग)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          {primaryThemes.map((t) => {
            const isSelected = currentTheme === t.id;
            return (
              <div
                key={t.id}
                onClick={() => handleApplyTheme(t.id)}
                className={`p-2.5 rounded-sm border cursor-pointer transition-all flex flex-col justify-between relative ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20 shadow-sm'
                    : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
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
                      <span className="text-[9px] bg-primary text-white px-1.5 py-0.2 rounded-xs font-bold">
                        निवडलेले
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-gray-800 text-xs">{t.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{t.desc}</div>
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
      <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200 mb-3">
        <div className="text-xs font-bold text-primary border-b border-gray-200 pb-1 mb-2 flex items-center gap-1.5">
          <span>२. वर्कस्पेस बॅकग्राउंड रंग (Workspace Background Mode)</span>
          <span className="text-[10px] text-gray-400 font-normal">(मुख्य स्क्रीनच्या पार्श्वभूमीचा रंग)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          {backgroundModes.map((b) => {
            const isSelected = currentBg === b.id;
            return (
              <div
                key={b.id}
                onClick={() => handleApplyBg(b.id)}
                className={`p-2.5 rounded-sm border cursor-pointer transition-all flex flex-col justify-between relative ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20 shadow-sm'
                    : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className="w-6 h-6 rounded-md shadow-xs border flex items-center justify-center text-xs font-bold text-gray-700"
                      style={{ backgroundColor: b.bgHex, borderColor: b.borderHex }}
                    >
                      {isSelected && '✓'}
                    </div>
                    {isSelected && (
                      <span className="text-[9px] bg-primary text-white px-1.5 py-0.2 rounded-xs font-bold">
                        निवडलेले
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-gray-800 text-xs">{b.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{b.desc}</div>
                </div>

                <div
                  className="h-3 w-full rounded-xs mt-2.5 border"
                  style={{ backgroundColor: b.bgHex, borderColor: b.borderHex }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Live Preview Demo Component */}
      <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200">
        <div className="text-xs font-bold text-primary border-b border-gray-200 pb-1 mb-2">
          ३. निवडलेल्या थीमचा लाईव प्रीव्ह्यू (Live Interface Preview)
        </div>

        <div className="p-3 border border-gray-200 rounded-sm bg-gray-50 space-y-2.5">
          <div className="flex justify-between items-center bg-white p-2 border border-gray-200 rounded-sm shadow-2xs">
            <span className="text-xs font-bold text-primary">नमूना फॉर्म शीर्षक (Sample Form Title)</span>
            <button className="bg-primary hover:bg-[#004a75] text-white px-3 py-1 rounded-sm font-bold text-[11px] shadow-xs">
              + नवीन नोंद (New Entry)
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-2xs">
              <div className="text-[10px] text-gray-500 font-bold uppercase">एकूण खातेदार</div>
              <div className="text-sm font-black text-gray-800 mt-0.5">१,२४५</div>
            </div>
            <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-2xs">
              <div className="text-[10px] text-gray-500 font-bold uppercase">एकूण ठेव रक्कम्</div>
              <div className="text-sm font-black text-primary mt-0.5">₹ ४५.५० लाख</div>
            </div>
            <div className="bg-white p-2 rounded-sm border border-gray-200 shadow-2xs">
              <div className="text-[10px] text-gray-500 font-bold uppercase">एकूण कर्ज वाटप</div>
              <div className="text-sm font-black text-gray-800 mt-0.5">₹ ३२.१० लाख</div>
            </div>
          </div>

          <table className="w-full text-[11px] border-collapse bg-white border border-gray-200">
            <thead>
              <tr className="bg-primary text-white font-bold text-left">
                <th className="p-1.5 border border-gray-300">खाते क्र.</th>
                <th className="p-1.5 border border-gray-300">सभासदाचे नाव</th>
                <th className="p-1.5 border border-gray-300">प्रकार</th>
                <th className="p-1.5 border border-gray-300 text-right">शिल्लक रक्कम</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200 hover:bg-blue-50/50">
                <td className="p-1.5 border-r border-gray-200 font-medium">SB-1001</td>
                <td className="p-1.5 border-r border-gray-200 font-bold text-gray-800">रमेश मारुती पाटील</td>
                <td className="p-1.5 border-r border-gray-200">बचत खाते</td>
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
