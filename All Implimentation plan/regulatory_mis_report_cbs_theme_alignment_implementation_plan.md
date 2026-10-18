# 📋 महाराष्ट्र राज्य पतसंस्था नियामक मंडळ, पुणे MIS अहवाल — कोअर बँकिंग (CBS) थीम संरेखन व अंमलबजावणी आराखडा
## Maharashtra State Regulatory Board MIS Report — CBS Theme Alignment & Implementation Plan

**दस्तऐवज संदर्भ:** `CBS-MIS-THEME-2026-001`  
**घटक (Component):** `client/src/components/RegulatoryMisReport.tsx`  
**मॉड्यूल:** नियामक मंडळ एम.आय.एस. व वैधानिक अनुपालन (Regulatory Board MIS & Statutory Compliance)  
**प्राधिकृत मानके:** महाराष्ट्र सहकारी संस्था अधिनियम १९६० व पतसंस्था नियामक मंडळ, पुणे अधिकृत पोर्टल (`patsansthaniyamakmandal.in`)  

---

## १. पार्श्वभूमी व सद्यस्थितीतील थीम विसंगती (Problem Statement & Inconsistencies)

सहकार आयुक्त व निबंधक, सहकारी संस्था, महाराष्ट्र राज्य यांच्या पतसंस्था नियामक मंडळ, पुणे यांच्या अधिकृत ७ टॅब्सच्या नमुन्यांनुसार विकसित करण्यात आलेला **Regulatory MIS Report Engine** कार्यान्वित झाला असला, तरी त्याचा UI कोअर बँकिंग सिस्टीमच्या (SmartBanking CBS) अधिकृत डिझाईन सिस्टीमशी जुळत नव्हता.

### प्रमुख विसंगती (Identified Theme Mismatches):
1. **हार्डकोडेड रंग (Hardcoded Indigo & Blue Colors):**
   - सिस्टीममधील डायनॅमिक थीम टोकन्स (`var(--color-primary)` - Corporate Navy Blue `#005689`, Emerald Green `#0E8A5A`, किंवा Royal Wine Red `#880E4F`) ऐवजी अहवालात `bg-indigo-600`, `bg-blue-600`, `text-blue-900` हार्डकोड केले होते.
2. **मोठ्या व अनावश्यक कॉर्नर त्रिज्या (`rounded-xl` vs CBS `rounded-sm`):**
   - सर्व ७ टॅब्सचे कंटेनर्स, हेडर, कार्ड्स व इनपुट्ससाठी `rounded-xl` व `rounded-lg` वापरल्यामुळे कॉम्पॅक्ट डेस्कटॉप बँकिंग लूक गमावला होता.
3. **हेडर व ७ टॅब्स स्विचरची विसंगती:**
   - हेडरमध्ये `border-b-2 border-primary` व `w-8 h-8 rounded-sm bg-primary/10 border border-primary/20` आयकॉन बॉक्स नव्हता.
   - ७ टॅब्सचे बटणे खूप मोठे, आडवे पसरलेले व `bg-blue-50/70 border-b-2 border-blue-600` अशा हार्डकोडेड रंगात होते.
4. **इनपुट व तक्त्यांमधील विसंगती:**
   - सर्व इनपुट्ससाठी मानक `h-[28px]` किंवा `h-[30px]` उंची, `rounded-sm border border-gray-300`, आणि `focus:ring-primary` चा अभाव होता.
   - तक्त्यांमध्ये सुस्पष्ट CBS बँकिंग बॉर्डर्स (`border border-slate-300`, `thead bg-slate-100`) ऐवजी सैलसर स्टाईल होती.

---

## २. कोअर बँकिंग थीम संरेखन रचना (CBS Design System Alignment Architecture)

```
+----------------------------------------------------------------------------------------------------+
| 🏛️ TOP SLEEK CBS HEADER BANNER (bg-white, border-b-2 border-primary, rounded-sm, shadow-xs)        |
|  [Icon: bg-primary/10 text-primary] महाराष्ट्र राज्य पतसंस्था नियामक मंडळ MIS अहवाल [FY: २०२५-२६]     |
|  [Action Buttons: ⚡ ऑटो-लोड | 💾 मसुदा सेव्ह | 📊 एक्सेल | 🖨️ प्रिंट | 🔒 अंतिम लॉक]            |
+----------------------------------------------------------------------------------------------------+
| 🔍 DEDICATED CBS FILTER BAR (bg-white, border border-slate-300, shadow-2xs, h-[30px] inputs)       |
|  आर्थिक वर्ष: [ २०२५-२६ ▼ ]  |  अखेर दिनांक: [ YYYY-MM-DD ]  |  संस्था: श्री गणेश पतसंस्था मर्यादित  |
+----------------------------------------------------------------------------------------------------+
| 📑 7-TABS HORIZONTAL CBS SEGMENTED SWITCHER (bg-slate-100, border border-slate-300, rounded-sm)    |
|  [१. सर्वसाधारण ] [२. भांडवल/ठेवी] [३. कर्ज/वसुली] [४. गुंतवणूक] [५. मापदंड] [६. अंशदान] [७. घोषणा] |
+----------------------------------------------------------------------------------------------------+
| 📋 COMPACT CBS TAB WORKSPACE (bg-white, border border-slate-300, rounded-sm, shadow-2xs)          |
|  - सब-कार्ड्स: bg-slate-50 border border-slate-300 rounded-sm p-3                                  |
|  - इनपुट्स: border border-gray-300 rounded-sm px-2 py-1 text-[11px] focus:ring-primary              |
|  - तक्ते: border-collapse border border-slate-300 thead bg-slate-100 font-bold                      |
|  - मापदंड कार्ड्स: border-l-4 (हिरवा/पिवळा/लाल) सह संक्षिप्त हाय-डेंसिटी लेआउट                     |
+----------------------------------------------------------------------------------------------------+
| 🖨️ OFFICIAL CBS 4-TIER SIGNATURE PRINT TEMPLATE (Hidden on screen, Visible on Print)               |
|  अध्यक्ष  |  उपाध्यक्ष  |  मानद सचिव / संचालक  |  मुख्य कार्यकारी अधिकारी / व्यवस्थापक                |
+----------------------------------------------------------------------------------------------------+
```

---

## ३. तपशीलवार घटक फेररचना (Detailed Component Specifications)

### ३.१ डिझाईन टोकन्स व क्लास मॅपिंग (Design Tokens Mapping)
| घटक (Element) | पूर्वीची विसंगत क्लास | नवीन मानकीकृत CBS क्लास |
|---|---|---|
| मुख्य थीम रंग | `bg-indigo-600` / `bg-blue-600` | `bg-primary`, `text-primary`, `border-primary` |
| हेडर बॅनर | `border border-slate-200 rounded-xl p-4` | `bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-slate-300 border-b-2 border-primary` |
| हेडर आयकॉन | `bg-emerald-600 p-1.5 rounded-lg` | `w-8 h-8 rounded-sm bg-primary/10 border border-primary/20 text-primary shadow-2xs` |
| टॅब स्विचर पट्टी | `rounded-xl divide-x divide-slate-100` | `bg-slate-100 p-0.5 rounded-sm border border-slate-300 flex overflow-x-auto gap-1` |
| सक्रिय टॅब | `bg-blue-50/70 border-b-2 border-blue-600` | `bg-white text-primary shadow-2xs border border-gray-300 font-bold px-3 py-1.5 rounded-sm` |
| फॉर्म इनपुट्स | `rounded border border-slate-300` | `border border-gray-300 rounded-sm px-2 py-1 text-[11px] focus:ring-1 focus:ring-primary focus:border-primary` |
| तक्ते (Tables) | `w-full divide-y divide-slate-200` | `border-collapse border border-slate-300 thead bg-slate-100 text-gray-800 font-bold` |

---

## ४. पडताळणी व चाचणी आराखडा (Verification Matrix)

1. **डायनॅमिक थीम संरेखन:** वापरकर्त्याने निळी, हिरवी किंवा वाईन-रेड थीम निवडल्यास संपूर्ण MIS अहवालातील हेडर, ॲक्टिव्ह टॅब, बटणे आणि फोकस रिंग्स त्याच रंगात बदलतात.
2. **कॉम्पॅक्ट CBS लेआउट:** अनावश्यक व्हर्टिकल स्क्रोलिंग कमी होऊन सर्व फॉर्म्स सुबक, दाट आणि वाचनीय बनतात.
3. **सर्व ७ टॅब्स कार्यक्षमता:** प्राथमिक माहिती, भांडवल व ठेवी, कर्ज व वसुली, गुंतवणूक, आर्थिक मापदंड, अंशदान योजना व स्वयंघोषणा सर्व टॅब्स अखंडपणे डेटा हाताळतात.
4. **ऑटो-कंप्युट व सेव्ह:** 'ऑटो-लोड (Auto Fetch)' व 'मसुदा सेव्ह (Save)' अचूकपणे काम करतात.
5. **एक्सेल व शासकीय ४-स्वाक्षरी A4 प्रिंट:** पोर्टलवर डेटा अपलोड करण्यासाठी एक्सेल फाइल आणि शासकीय लेखापरीक्षणासाठी ४ अधिकृत स्वाक्षऱ्यांसह परिपूर्ण प्रिंट लेआउट तयार होतो.
