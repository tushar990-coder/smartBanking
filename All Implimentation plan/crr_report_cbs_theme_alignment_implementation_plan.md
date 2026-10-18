# 📋 CRR (रोख राखीव प्रमाण / रोख तरलता) अहवाल — कोअर बँकिंग (CBS) थीम संरेखन व अंमलबजावणी आराखडा
## Cash Reserve Ratio (CRR) & Liquidity Report — CBS Theme Alignment & Implementation Framework

**दस्तऐवज संदर्भ:** `CBS-CRR-THEME-2026-001`  
**घटक (Component):** `client/src/components/CrrReport.tsx`  
**मॉड्यूल:** नियामक अहवाल व तरलता संनियंत्रण (Regulatory Reports & Liquidity Compliance)  
**प्राधिकृत मानके:** महाराष्ट्र सहकारी संस्था अधिनियम १९६०, नियम व पतसंस्था नियामक मंडळ, पुणे मार्गदर्शक तत्त्वे  

---

## १. पार्श्वभूमी व सद्यस्थितीतील थीम विसंगती (Background & Theme Mismatch Analysis)

नवीन आवृत्तीमध्ये तयार करण्यात आलेला **CRR (Cash Reserve Ratio) रोख राखीव प्रमाण व तरलता अहवाल** कार्यान्वित झाला असला, तरी त्याचा युझर इंटरफेस (UI) कोअर बँकिंग सिस्टीमच्या (SmartBanking CBS) अधिकृत डिझाईन सिस्टीम व थीमशी विसंगत (Theme Mismatch) असल्याचे निदर्शनास आले.

### प्रमुख थीम विसंगती मुद्दे (Identified Inconsistencies):
1. **हार्डकोडेड रंग व व्हेरिएबल्सचा अभाव (Hardcoded Colors vs Dynamic Primary Theme):**
   - ॲप्लिकेशनमधील सर्व प्रमुख मॉड्यूल्स (`SwanidhiReport`, `VoucherMaster`, `TrialBalance`, `Sidebar`) डायनॅमिक थीम टोकन्स वापरतात (`var(--color-primary)` - Corporate Navy Blue `#005689`, Emerald Green `#0E8A5A`, किंवा Royal Wine Red `#880E4F`).
   - मात्र `CrrReport.tsx` मध्ये सर्वत्र हार्डकोडेड `bg-emerald-600`, `text-emerald-700`, `purple-600`, `blue-600` वापरल्यामुळे वापरकर्त्याने थीम बदलल्यास CRR अहवाल त्या थीमशी मॅच होत नव्हता.
2. **मोठ्या व अनावश्यक कॉर्नर त्रिज्या (Oversized `rounded-xl` vs CBS `rounded-sm`):**
   - CBS डेस्कटॉप ॲप्लिकेशनमध्ये सर्व कार्ड्स, बटणे, इनपुट्स आणि मॉडेल्ससाठी सुबक, व्यावसायिक व कॉम्पॅक्ट `rounded-sm` किंवा `rounded-xs` बॉर्डर्स वापरल्या जातात.
   - CRR अहवालात सर्वत्र मोबाइल-स्टाईल `rounded-xl` वापरल्याने तो इतर CBS अहवालांपेक्षा पूर्णपणे वेगळा आणि अनफिट वाटत होता.
3. **हेडर व टॅब स्विचरची विसंगती (Header & Tab Controls Inconsistency):**
   - इतर अधिकृत अहवालांप्रमाणे (`SwanidhiReport`, `RegulatoryMisReport`) हेडरमध्ये `border-b-2 border-primary`, `w-8 h-8 rounded-sm bg-primary/10 border border-primary/20` आयकॉन बॉक्स, आणि कॉम्पॅक्ट टॅब स्विचर (`bg-slate-100 p-0.5 rounded-sm border border-slate-300`) नव्हता.
   - त्याऐवजी खाली स्वतंत्र मोठा `rounded-xl` बॉक्स आणि आडवे मोठे बटन्स होते, ज्यामुळे अनपेक्षित उभा स्क्रोलिंग लोड निर्माण होत होता.
4. **तक्ते व ग्रिडमधील सुस्पष्टतेचा अभाव (Loose Table Borders vs Crisp CBS Banking Grid):**
   - बँकिंग ताळेबंद व लेजर पडताळणीसाठी आवश्यक असलेले सुस्पष्ट बॉर्डर्स (`border border-slate-300`, `border-collapse`, `thead bg-slate-100 text-gray-800 font-bold`) ऐवजी सैलसर `divide-y divide-slate-100` स्टाईल वापरली गेली होती.
5. **अधिकृत 'अंमलबजावणी आराखडा' टॅबचा अभाव (Missing Statutory Implementation Framework Tab):**
   - वैधानिक १% ते ५% निकष, अतिरिक्त रोख हाताळणी धोरण (Cash Deployment Policy), शाखा तिजोरी मर्यादा (Retention Limit) व आपत्कालीन तरलता मार्गदर्शक सूचना यांचा एकात्मिक मार्गदर्शक आराखडा टॅब उपलब्ध नव्हता.

---

## २. कोअर बँकिंग थीम संरेखन रचना (CBS Design System Alignment Architecture)

```
+----------------------------------------------------------------------------------------------------+
| 🏛️ TOP SLEEK CBS HEADER BANNER (bg-white, border-b-2 border-primary, rounded-sm, shadow-xs)        |
|  [Icon: bg-primary/10 text-primary] CRR रोख राखीव प्रमाण व तरलता अहवाल (१.००% ते ५.००% विहित निकष)   |
|  [Tabs: १. मुख्य सारांश | २. दैनिक कल नोंदवही | ३. शाखा मर्यादा | ४. अंमलबजावणी आराखडा ] [🖨️ प्रिंट] [📊 एक्सेल] |
+----------------------------------------------------------------------------------------------------+
| 🔍 DEDICATED CBS FILTER BAR (bg-white, border border-slate-300, shadow-2xs, h-[30px] inputs)       |
|  दिनांक (As on Date): [ YYYY-MM-DD ]  | लक्ष्य CRR %: [ ३.००% ▼ ]  | [ 🔄 अहवाल रिफ्रेश ]           |
+----------------------------------------------------------------------------------------------------+
| 📊 4 COMPACT HIGH-DENSITY KPI CARDS (rounded-sm, border border-slate-300, border-l-4)              |
|  +-----------------------+-----------------------+-----------------------+-----------------------+  |
|  | Card 1: ठेवी दायित्व  | Card 2: तरल रोख रोकड  | Card 3: प्रत्यक्ष CRR%| Card 4: अधिशेष/तुटवडा |  |
|  | border-l-primary      | border-l-emerald-600  | border-l-emerald/rose | border-l-primary/rose |  |
|  | ₹ NDTL एकूण ठेवी      | ₹ तिजोरी + बँक चालू   | X.XX% (निकष पूर्ण/तूट)| +/- ₹ शिल्लक/तुटवडा   |  |
|  +-----------------------+-----------------------+-----------------------+-----------------------+  |
+----------------------------------------------------------------------------------------------------+
| ⚖️ STATUTORY COMPLIANCE ALERT STRIP (bg-emerald-50/rose-50, border-emerald-300/rose-300)            |
|  वैधानिक स्थिती: संस्थेने एकूण ठेवींच्या तुलनेत X.XX% तरलता राखली असून विहित १% ते ५% निकष पूर्ण.       |
+----------------------------------------------------------------------------------------------------+
| 📋 TAB CONTENT AREA (Crisp Banking Grid Tables with border border-slate-300)                      |
|  टॅब १: अ) प्रत्यक्ष रोख शिल्लक (Cash)  | ब) बँक चालू खाती (Bank Balances) | क) ठेवींची रचना (NDTL)    |
|  टॅब २: सलग ३० दिवसांचा दैनंदिन व पंधरवडानिहाय तरलता कल तक्ता (Daily Statement)                     |
|  टॅब ३: शाखानिहाय तिजोरी रोख मर्यादा (Retention Limit) व विमा सुरक्षा पडताळणी                       |
|  टॅब ४: वैधानिक निकष, गणना सूत्र, आपत्कालीन तरलता व अंमलबजावणी कृती आराखडा                          |
+----------------------------------------------------------------------------------------------------+
| 🖨️ OFFICIAL CBS PRINT TEMPLATE (Hidden on screen, Visible on Print, 3-Tier Signatures)            |
|  रोखपाल / कॅशियर (Maker)  |  लेखापाल / अंतर्गत लेखापरीक्षक (Checker)  |  मुख्य कार्यकारी अधिकारी / व्यवस्थापक  |
+----------------------------------------------------------------------------------------------------+
```

---

## ३. तपशीलवार घटक सुधारणा व डिझाईन टोकन्स (Design Tokens Specification)

### ३.१ रंग व व्हेरिएबल्स (Color Variables)
| घटक (Element) | पूर्वीची विसंगत क्लास | नवीन मानकीकृत CBS क्लास |
|---|---|---|
| मुख्य थीम रंग | `bg-emerald-600` / `text-emerald-700` | `bg-primary`, `text-primary`, `border-primary` |
| ॲक्सेंट आयकॉन बॅकग्राउंड | `bg-emerald-600 text-white` | `w-8 h-8 rounded-sm bg-primary/10 border border-primary/20 text-primary` |
| सक्रिय टॅब (Active Tab) | `bg-emerald-50/70 border-emerald-600` | `bg-white text-primary shadow-2xs border border-gray-300 font-bold` |
| निष्क्रिय टॅब (Inactive) | `text-slate-600` | `text-gray-600 hover:text-gray-900` |
| यशस्वी / पात्र बॅज | `bg-emerald-100 text-emerald-800` | `bg-emerald-50 text-emerald-800 border border-emerald-300` |
| चेतावणी / अपात्र बॅज | `bg-rose-100 text-rose-800` | `bg-rose-50 text-rose-800 border border-rose-300` |

### ३.२ कार्ड्स व कंटेनर्स (Containers & Radii)
- सर्व `rounded-xl` आणि `rounded-lg` काढून **`rounded-sm`** (२-३ पिक्सेल सुबक कोपरे) लागू करणे.
- सर्व मुख्य कार्ड्सवर `border border-slate-300 shadow-2xs border-l-4` लागू करणे.
- इनपुट बॉक्सेससाठी मानक `h-[30px] rounded-sm border border-gray-300 px-2.5 py-1 text-[11px] focus:ring-1 focus:ring-primary focus:border-primary` लागू करणे.

### ३.३ तक्ते व खतावणी लेआउट (Banking Grid Tables)
- तक्त्यांची मांडणी: `border-collapse border border-slate-300 text-[11px] w-full`.
- हेडर: `bg-slate-100 text-gray-800 font-bold border-b border-slate-300 py-1.5 px-2`.
- डेटा रोव्ज: `py-1.5 px-2 border border-slate-200 hover:bg-primary/5 transition-colors`.
- एकूण बेरीज: `bg-slate-100 font-bold border-t-2 border-slate-400 text-gray-900`.

---

## ४. अंमलबजावणी आराखडा व वैधानिक तरलता नियमावली (Statutory CRR Framework)

या अहवालात नवीन **टॅब ४: वैधानिक नियम व अंमलबजावणी आराखडा** समाविष्ट करण्यात आला आहे. त्यामध्ये खालील ४ प्रमुख स्तंभांचा समावेश आहे:

### स्तंभ १: वैधानिक तरलता निकष (Statutory Liquidity Norms)
- **किमान CRR मर्यादा:** **१.००%** (कायद्यानुसार अनिवार्य किमान रोख तरलता).
- **आदर्श पतसंस्था प्रमाण:** **३.००%** (दैनिक ठेवी परतावा व व्यवहारांसाठी सुवर्णमध्य).
- **कमाल CRR मर्यादा:** **५.००%** (५% पेक्षा जास्त रोख ठेवणे अनुत्पादक मानले जाते; अतिरिक्त रक्कम बँकेत गुंतवणे आवश्यक).

### स्तंभ २: CRR गणना सूत्र व घटक (Computation Formula)
$$\text{CRR \%} = \frac{\text{उपलब्ध रोख तरलता (Liquid Cash)}}{\text{एकूण बाह्य ठेवी दायित्व (NDTL)}} \times 100$$
- **उपलब्ध रोख तरलता:**
  1. प्रत्यक्ष तिजोरी रोख शिल्लक (Physical Cash in Hand - तिजोरी/काउंटर लेजर्स)
  2. बँकांमधील चालू खाती शिल्लक (Bank Current Balances - तात्काळ उपलब्ध रोकड)
- **एकूण ठेवी दायित्व (NDTL):**
  मुदत ठेवी (FD) + बचत खाती (Savings) + आवर्ती ठेवी (RD) + पिग्मी/दैनिक ठेवी (Pigmy).

### स्तंभ ३: शाखा रोख धारणा मर्यादा व तिजोरी विमा (Branch Cash Retention & Insurance)
- संचालक मंडळाने प्रत्येक शाखेसाठी स्वतंत्र **रोख धारणा मर्यादा (Cash Retention Limit)** निश्चित करणे बंधनकारक आहे.
- दिवसाअखेर शाखेची शिल्लक या मर्यादेपेक्षा जास्त झाल्यास तात्काळ मुख्य शाखा किंवा बँकेत भरणा करणे आवश्यक.
- प्रत्येक शाखेचा रोख विमा (Cash-in-Safe & Cash-in-Transit Insurance) हा प्रत्यक्ष रोख मर्यादेपेक्षा जास्त असणे आवश्यक आहे.

### स्तंभ ४: आपत्कालीन तरलता व्यवस्थापन (Contingency Liquidity Action Plan)
- **CRR < १% (अति-धोका):** तात्काळ नवीन कर्ज वितरण स्थगित करणे, बँक ओव्हरड्राफ्ट/क्रेडिट लाईन सक्रिय करणे, आणि मुदतपूर्व ठेवी परताव्यावर मर्यादा आणणे.
- **CRR १% ते ३% (सावध):** दैनंदिन रोख आवक-जावकचे काटेकोर संनियंत्रण.
- **CRR > ५% (अतिरिक्त रोख):** अनुत्पादक रोख रक्कम जिल्हा बँकेच्या अल्पमुदत ठेवींमध्ये (Short Term FD) गुंतवून व्याज उत्पन्न वाढवणे.

---

## ५. चाचणी व पडताळणी आराखडा (Verification Matrix)

| क्र. | चाचणी घटक | अपेक्षित परिणाम | स्थिती |
|---|---|---|---|
| १ | डायनॅमिक थीम सपोर्ट | Blue, Green किंवा Wine-Red थीम निवडल्यावर CRR अहवालातील हेडर, बटणे, सिलेक्टर्स आणि हायलाइट्स त्याच रंगात बदलतात. | ✅ सत्यापित |
| २ | कॉर्नर रेडियस व बॉर्डर्स | `rounded-xl` ऐवजी कॉम्पॅक्ट `rounded-sm` व सूक्ष्म `border-slate-300` दिसतात. | ✅ सत्यापित |
| ३ | टॅब स्विचर व नेव्हिगेशन | हेडरमधील ४ टॅब्स (`summary`, `daily`, `branch`, `framework`) जलद व अखंडपणे बदलतात. | ✅ सत्यापित |
| ४ | रिफ्रेश व ऑटो-कंप्युट | दिनांक किंवा लक्ष्य CRR % बदलून 'अहवाल रिफ्रेश' दाबल्यावर तात्काळ अचूक गणना होते. | ✅ सत्यापित |
| ५ | एक्सेल एक्सपोर्ट (XLSX) | तिन्ही शीट्स (`CRR_Summary`, `Daily_Register`, `Branch_Retention`) सह एक्सेल फाइल डाऊनलोड होते. | ✅ सत्यापित |
| ६ | शासकीय ३-स्वाक्षरी A4 प्रिंट | स्क्रीन घटक लपून संस्थेचे नाव, तपशील, तक्ते आणि ३ अधिकृत स्वाक्षऱ्यांसह परिपूर्ण प्रिंट लेआउट तयार होतो. | ✅ सत्यापित |

---
**निष्कर्ष:** हा अंमलबजावणी आराखडा CRR अहवालाला SmartBanking कोअर बँकिंगच्या सर्वोच्च डिझाईन मानकांशी आणि वैधानिक नियमांशी १००% सुसंगत करतो.
