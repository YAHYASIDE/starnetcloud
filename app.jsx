// === StarNet — نسخة التطبيق الحقيقي (PWA) ===
// تخزين دائم في ذاكرة الهاتف (localStorage) بدل تخزين Claude
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(k){ try{ const v=localStorage.getItem(k); return v==null?null:{key:k,value:v}; }catch(e){ return null; } },
    async set(k,val){ try{ localStorage.setItem(k,val); }catch(e){} return {key:k,value:val}; },
    async delete(k){ try{ localStorage.removeItem(k); }catch(e){} return {key:k,deleted:true}; },
    async list(prefix){ const keys=[]; for(let i=0;i<localStorage.length;i++){ const kk=localStorage.key(i); if(!prefix||kk.startsWith(prefix)) keys.push(kk);} return {keys,prefix}; }
  };
}
const { useState, useEffect, useRef, useMemo } = React;

/* ============================================================
   STAR NET — نظام إدارة عملاء وأجهزة ستارلينك
   - حفظ تلقائي دائم عبر window.storage
   - حساب تاريخ الانتهاء تلقائياً
   - تنبيهات الأجهزة المنتهية والقريبة من الانتهاء
   - تقارير أرباح يومية وشهرية + متابعة الديون
   - رسائل واتساب جاهزة
   ============================================================ */

const STORAGE_KEY = "starnet_data_v1";

const CURRENCIES = [
  { code: "MRU", label: "أوقية (MRU)", symbol: "MRU" },
  { code: "USDT", label: "دولار (USDT)", symbol: "$" },
  { code: "FCFA", label: "سيفا (FCFA)", symbol: "FCFA" },
];

// حالة الجهاز عند استلامه (ملاحظة دائمة)
const ORIGIN_TYPES = [
  { code: "", label: "غير محدّد" },
  { code: "clean", label: "سليم — لم يكن عليه دين قبلنا" },
  { code: "hadDebt", label: "جاءنا عليه دين سابق ودفعناه" },
];
function originLabel(code) {
  return (ORIGIN_TYPES.find((o) => o.code === code) || {}).label || "";
}

// تطبيقات الدفع المتاحة
const PAYMENT_APPS = ["BANKILY", "KACH", "ORANJ", "NITA", "أخرى"];
// باقات ستارلينك الفعلية المتاحة للاختيار عند الشحن/التجديد
const PACKAGES = ["Roam Unlimited", "Roam 100GB", "SIS PANDER", "Residential", "Business", "Mini"];
// رموز الدول التي نتعامل معها
const DIAL_CODES = [
  { n: "موريتانيا", c: "+222" },
  { n: "مالي", c: "+223" },
  { n: "الجزائر", c: "+213" },
  { n: "النيجر", c: "+227" },
];

// كل دول العالم (الاسم بالعربية + رمز العملة) — تُرتّب أبجدياً عند العرض
const WORLD_COUNTRIES = [
  { n: "أفغانستان", c: "AFN" }, { n: "ألبانيا", c: "ALL" }, { n: "الجزائر", c: "DZD" },
  { n: "أندورا", c: "EUR" }, { n: "أنغولا", c: "AOA" }, { n: "الأرجنتين", c: "ARS" },
  { n: "أرمينيا", c: "AMD" }, { n: "أستراليا", c: "AUD" }, { n: "النمسا", c: "EUR" },
  { n: "أذربيجان", c: "AZN" }, { n: "الباهاما", c: "BSD" }, { n: "البحرين", c: "BHD" },
  { n: "بنغلاديش", c: "BDT" }, { n: "باربادوس", c: "BBD" }, { n: "بيلاروسيا", c: "BYN" },
  { n: "بلجيكا", c: "EUR" }, { n: "بليز", c: "BZD" }, { n: "بنين", c: "XOF" },
  { n: "بوتان", c: "BTN" }, { n: "بوليفيا", c: "BOB" }, { n: "البوسنة والهرسك", c: "BAM" },
  { n: "بوتسوانا", c: "BWP" }, { n: "البرازيل", c: "BRL" }, { n: "بروناي", c: "BND" },
  { n: "بلغاريا", c: "BGN" }, { n: "بوركينا فاسو", c: "XOF" }, { n: "بوروندي", c: "BIF" },
  { n: "كمبوديا", c: "KHR" }, { n: "الكاميرون", c: "XAF" }, { n: "كندا", c: "CAD" },
  { n: "الرأس الأخضر", c: "CVE" }, { n: "أفريقيا الوسطى", c: "XAF" }, { n: "تشاد", c: "XAF" },
  { n: "تشيلي", c: "CLP" }, { n: "الصين", c: "CNY" }, { n: "كولومبيا", c: "COP" },
  { n: "جزر القمر", c: "KMF" }, { n: "الكونغو", c: "XAF" }, { n: "الكونغو الديمقراطية", c: "CDF" },
  { n: "كوستاريكا", c: "CRC" }, { n: "كرواتيا", c: "EUR" }, { n: "كوبا", c: "CUP" },
  { n: "قبرص", c: "EUR" }, { n: "التشيك", c: "CZK" }, { n: "الدنمارك", c: "DKK" },
  { n: "جيبوتي", c: "DJF" }, { n: "دومينيكا", c: "XCD" }, { n: "الدومينيكان", c: "DOP" },
  { n: "الإكوادور", c: "USD" }, { n: "مصر", c: "EGP" }, { n: "السلفادور", c: "USD" },
  { n: "غينيا الاستوائية", c: "XAF" }, { n: "إريتريا", c: "ERN" }, { n: "إستونيا", c: "EUR" },
  { n: "إسواتيني", c: "SZL" }, { n: "إثيوبيا", c: "ETB" }, { n: "فيجي", c: "FJD" },
  { n: "فنلندا", c: "EUR" }, { n: "فرنسا", c: "EUR" }, { n: "الغابون", c: "XAF" },
  { n: "غامبيا", c: "GMD" }, { n: "جورجيا", c: "GEL" }, { n: "ألمانيا", c: "EUR" },
  { n: "غانا", c: "GHS" }, { n: "اليونان", c: "EUR" }, { n: "غرينادا", c: "XCD" },
  { n: "غواتيمالا", c: "GTQ" }, { n: "غينيا", c: "GNF" }, { n: "غينيا بيساو", c: "XOF" },
  { n: "غيانا", c: "GYD" }, { n: "هايتي", c: "HTG" }, { n: "هندوراس", c: "HNL" },
  { n: "المجر", c: "HUF" }, { n: "آيسلندا", c: "ISK" }, { n: "الهند", c: "INR" },
  { n: "إندونيسيا", c: "IDR" }, { n: "إيران", c: "IRR" }, { n: "العراق", c: "IQD" },
  { n: "أيرلندا", c: "EUR" }, { n: "إيطاليا", c: "EUR" }, { n: "ساحل العاج", c: "XOF" },
  { n: "جامايكا", c: "JMD" }, { n: "اليابان", c: "JPY" }, { n: "الأردن", c: "JOD" },
  { n: "كازاخستان", c: "KZT" }, { n: "كينيا", c: "KES" }, { n: "الكويت", c: "KWD" },
  { n: "قيرغيزستان", c: "KGS" }, { n: "لاوس", c: "LAK" }, { n: "لاتفيا", c: "EUR" },
  { n: "لبنان", c: "LBP" }, { n: "ليسوتو", c: "LSL" }, { n: "ليبيريا", c: "LRD" },
  { n: "ليبيا", c: "LYD" }, { n: "ليتوانيا", c: "EUR" }, { n: "لوكسمبورغ", c: "EUR" },
  { n: "مدغشقر", c: "MGA" }, { n: "مالاوي", c: "MWK" }, { n: "ماليزيا", c: "MYR" },
  { n: "المالديف", c: "MVR" }, { n: "مالي", c: "XOF" }, { n: "مالطا", c: "EUR" },
  { n: "موريتانيا", c: "MRU" }, { n: "موريشيوس", c: "MUR" }, { n: "المكسيك", c: "MXN" },
  { n: "مولدوفا", c: "MDL" }, { n: "موناكو", c: "EUR" }, { n: "منغوليا", c: "MNT" },
  { n: "الجبل الأسود", c: "EUR" }, { n: "المغرب", c: "MAD" }, { n: "موزمبيق", c: "MZN" },
  { n: "ميانمار", c: "MMK" }, { n: "ناميبيا", c: "NAD" }, { n: "نيبال", c: "NPR" },
  { n: "هولندا", c: "EUR" }, { n: "نيوزيلندا", c: "NZD" }, { n: "نيكاراغوا", c: "NIO" },
  { n: "النيجر", c: "XOF" }, { n: "نيجيريا", c: "NGN" }, { n: "كوريا الشمالية", c: "KPW" },
  { n: "مقدونيا الشمالية", c: "MKD" }, { n: "النرويج", c: "NOK" }, { n: "عُمان", c: "OMR" },
  { n: "باكستان", c: "PKR" }, { n: "بنما", c: "PAB" }, { n: "بابوا غينيا الجديدة", c: "PGK" },
  { n: "باراغواي", c: "PYG" }, { n: "بيرو", c: "PEN" }, { n: "الفلبين", c: "PHP" },
  { n: "بولندا", c: "PLN" }, { n: "البرتغال", c: "EUR" }, { n: "قطر", c: "QAR" },
  { n: "رومانيا", c: "RON" }, { n: "روسيا", c: "RUB" }, { n: "رواندا", c: "RWF" },
  { n: "السعودية", c: "SAR" }, { n: "السنغال", c: "XOF" }, { n: "صربيا", c: "RSD" },
  { n: "سيشل", c: "SCR" }, { n: "سيراليون", c: "SLL" }, { n: "سنغافورة", c: "SGD" },
  { n: "سلوفاكيا", c: "EUR" }, { n: "سلوفينيا", c: "EUR" }, { n: "الصومال", c: "SOS" },
  { n: "جنوب أفريقيا", c: "ZAR" }, { n: "كوريا الجنوبية", c: "KRW" }, { n: "جنوب السودان", c: "SSP" },
  { n: "إسبانيا", c: "EUR" }, { n: "سريلانكا", c: "LKR" }, { n: "السودان", c: "SDG" },
  { n: "سورينام", c: "SRD" }, { n: "السويد", c: "SEK" }, { n: "سويسرا", c: "CHF" },
  { n: "سوريا", c: "SYP" }, { n: "تايوان", c: "TWD" }, { n: "طاجيكستان", c: "TJS" },
  { n: "تنزانيا", c: "TZS" }, { n: "تايلاند", c: "THB" }, { n: "توغو", c: "XOF" },
  { n: "تونغا", c: "TOP" }, { n: "ترينيداد وتوباغو", c: "TTD" }, { n: "تونس", c: "TND" },
  { n: "تركيا", c: "TRY" }, { n: "تركمانستان", c: "TMT" }, { n: "أوغندا", c: "UGX" },
  { n: "أوكرانيا", c: "UAH" }, { n: "الإمارات", c: "AED" }, { n: "بريطانيا", c: "GBP" },
  { n: "الولايات المتحدة", c: "USD" }, { n: "الأوروغواي", c: "UYU" }, { n: "أوزبكستان", c: "UZS" },
  { n: "فانواتو", c: "VUV" }, { n: "فنزويلا", c: "VES" }, { n: "فيتنام", c: "VND" },
  { n: "اليمن", c: "YER" }, { n: "زامبيا", c: "ZMW" }, { n: "زيمبابوي", c: "ZWL" },
];
const WORLD_SORTED = [...WORLD_COUNTRIES].sort((a, b) => a.n.localeCompare(b.n, "ar"));

const DEFAULT_DATA = {
  settings: {
    businessName: "STAR NET",
    defaultDuration: 28,
    supplierDays: 23, // بعد كم يوم من البداية يستحق الدفع للمورّد
    rates: { USDT: 430, FCFA: 3.6, MRU: 1 }, // 1 وحدة من العملة → كم "عملة أساس"
    soonDays: 3,
    sounds: true,
    pin: "", // رمز قفل التطبيق (فارغ = بلا قفل)
    monthlyGoal: 0, // هدف ربح الشهر (بعملة الأساس) — 0 = بلا هدف
    msgCharged:
      "مرحباً {name} 👋\nتم شحن جهاز ستارلينك الخاص بك بنجاح ✅\n\n👤 الاسم: {name}\n📧 البريد: {email}\n🔢 رقم الحساب: {account}\n📅 تاريخ الشحن: {start}\n⏳ ينتهي الرصيد بتاريخ: {end}{debtline}{creditline}\n\nشكراً لتعاملك مع STAR NET ⭐",
    msgReminder:
      "STAR NET ⭐\n🔔 تنبيه قرب انتهاء الاشتراك\n\nالاسم: {name}\nالبريد: {email}\nرقم الجهاز: {account}\nتاريخ الانتهاء: {end}\n{remaining}{debtline}{creditline}\n\nللاستمرار في الخدمة، يرجى إعادة الشحن قبل تاريخ الانتهاء.\n\nشكراً لاختياركم STAR NET ⭐",
  },
  devices: [],
  transactions: [],
  agents: [],
  countries: [
    { id: "c_mali", name: "مالي", currency: "FCFA", perDollar: 600 },
    { id: "c_arg", name: "الأرجنتين", currency: "ARS", perDollar: 1000 },
  ], // سجل الدول/العملات: {id, name, currency, perDollar} — perDollar = كم وحدة = 1 دولار
  trash: [], // سلة المحذوفات: {device, transactions, deletedAt}
  contacts: [], // دفتر العملاء: إيميلات/بيانات محفوظة بدون عملية شحن
  personColors: {}, // لون ثابت لكل شخص (مفتاح الهوية → لون)
  personNumbers: {}, // رقم تسلسلي ثابت لكل شخص
  agentPayouts: [], // تسويات المندوبين: {id, agentId, amount, date}
  inventory: [], // المخزون: {id, name, category(device|accessory), qty, cost, costCurrency, price, currency}
  orders: [], // قائمة انتظار الطلبات: {id, customerName, phone, note, status, date}
};

/* ----------------------- أدوات مساعدة ----------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function parseDate(s) {
  if (!s) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function diffDays(fromStr, toStr) {
  return Math.round((parseDate(toStr) - parseDate(fromStr)) / 86400000);
}
function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + Number(n || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function fmtDate(s) {
  if (!s) return "—";
  const d = parseDate(s);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`; // أرقام لاتينية
}
function asNotes(n) {
  if (Array.isArray(n)) return n;
  if (typeof n === "string" && n.trim()) return [n];
  return [];
}
// تحويل قيمة تاريخ من Excel (Date أو نص dd/mm/yyyy أو yyyy-mm-dd) إلى صيغة التطبيق
function excelToDateStr(v) {
  if (!v && v !== 0) return "";
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return "";
}
function money(n) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(n) || 0));
}
// ربط حسابات نفس الزبون: نفس الاسم أو نفس البريد = نفس الشخص
function sameCustomer(a, b) {
  const n = (s) => (s || "").trim().toLowerCase();
  if (n(a.customerName) && n(a.customerName) === n(b.customerName)) return true;
  if (n(a.email) && n(a.email) === n(b.email)) return true;
  // ربط برقم الهاتف (مع رمز الدولة، أرقام فقط)
  const ph = (x) => ((x.dialCode || "") + (x.phone || "")).replace(/\D/g, "");
  if (ph(a) && ph(a) === ph(b)) return true;
  return false;
}
// الرصيد المجمّع للزبون (كل أجهزته): صافٍ بعملة الأساس. موجب = عليه دين، سالب = له رصيد.
function customerBalance(device, data, rates) {
  const tb = (a, c) => (Number(a) || 0) * (rates[c] ?? 1);
  const devs = data.devices.filter((d) => sameCustomer(d, device));
  let debt = 0, credit = 0;
  devs.forEach((d) => {
    if (d.debt > 0) debt += tb(d.debt, d.debtCurrency || d.currency || "MRU");
    if (d.credit > 0) credit += tb(d.credit, d.creditCurrency || d.currency || "MRU");
  });
  return { net: Math.round((debt - credit) * 100) / 100, debt, credit, count: devs.length, devices: devs };
}

function symbolOf(code) {
  return (CURRENCIES.find((c) => c.code === code) || {}).symbol || code;
}

// ضغط الصورة (تصغير + jpeg) لتقليل حجم التخزين
function compressImage(file, maxDim = 700, quality = 0.5) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = (height * maxDim) / width; width = maxDim; }
      else if (height > maxDim) { width = (width * maxDim) / height; height = maxDim; }
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      c.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      try { resolve(c.toDataURL("image/jpeg", quality)); } catch (e) { resolve(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
function fileToDataURL(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}

// ألوان مميّزة للمندوبين
const AGENT_COLORS = ["#4f9dff", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb7185", "#22d3ee", "#a3e635", "#fb923c", "#94a3b8"];
// لوحة ألوان الأشخاص (12 لوناً متباعدة) — تُعيَّن تسلسلياً بلا تكرار
const PERSON_PALETTE = ["#4da3ff", "#b388ff", "#ffb74d", "#4dd0c4", "#f06292", "#aed581", "#ff8a65", "#7986cb", "#ffd54f", "#4fc3f7", "#ba68c8", "#81c784"];
// مفتاح هوية الشخص: الهاتف (أرقام) ثم البريد ثم الاسم
function personKey(d) {
  const ph = ((d.dialCode || "") + (d.phone || "")).replace(/\D/g, "");
  if (ph) return "p:" + ph;
  const em = (d.email || "").trim().toLowerCase();
  if (em) return "e:" + em;
  const nm = (d.customerName || "").trim().toLowerCase();
  return nm ? "n:" + nm : "";
}
// تعيين لون ثابت لكل شخص بالترتيب التسلسلي (يُحفظ في personColors)
function assignPersonColors(devices, existing) {
  const map = { ...(existing || {}) };
  let count = Object.keys(map).length;
  (devices || []).forEach((d) => {
    const k = personKey(d);
    if (k && !(k in map)) { map[k] = PERSON_PALETTE[count % PERSON_PALETTE.length]; count++; }
  });
  return map;
}
function colorOf(d, personColors) {
  const k = personKey(d);
  return (personColors && personColors[k]) || PERSON_PALETTE[0];
}
// ترقيم تسلسلي ثابت لكل شخص
function assignPersonNumbers(devices, existing) {
  const map = { ...(existing || {}) };
  let max = Object.values(map).reduce((m, v) => Math.max(m, Number(v) || 0), 0);
  (devices || []).forEach((d) => {
    const k = personKey(d);
    if (k && !(k in map)) { max++; map[k] = max; }
  });
  return map;
}
function numberOf(d, personNumbers) {
  const k = personKey(d);
  return personNumbers && personNumbers[k] ? personNumbers[k] : null;
}
function hexA(hex, a) {
  if (!hex) return "transparent";
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ربح المعاملة: الدخل موجب، ومصروف الدفع للمورّد سالب. التكلفة لا تُخصم إلا عند دفعها فعلاً.
function txProfit(tr, toBase) {
  const v = toBase(tr.amount, tr.currency);
  return tr.isExpense ? -v : v;
}

// سجل أرباح جهاز واحد: صفوف بالترتيب الزمني + الإجمالي (بعملة الأساس)
function deviceLedger(deviceId, transactions, toBase) {
  const txs = (transactions || [])
    .filter((t) => t.deviceId === deviceId)
    .slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  let total = 0;
  const rows = txs.map((t) => {
    const base = toBase(t.amount, t.currency);
    const signed = t.isExpense ? -base : base;
    total += signed;
    return { date: t.date, type: t.type, amount: Number(t.amount) || 0, currency: t.currency, isExpense: !!t.isExpense, signed: Math.round(signed * 100) / 100, proof: t.proof || "" };
  });
  return { rows, total: Math.round(total * 100) / 100 };
}

// نسخ نص إلى الحافظة (مع بديل احتياطي للبيئات المقيّدة)
function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    /* fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch (e) {
    return false;
  }
}

function statusOf(device) {
  if (device.broken) return { key: "broken", label: "معطّل", days: 0 };
  const dl = diffDays(todayStr(), device.endDate);
  if (dl < 0) return { key: "expired", label: "منتهي", days: dl };
  if (dl <= 1) return { key: "urgent", label: "ينتهي خلال 24س", days: dl };
  if (dl <= 3) return { key: "soon", label: "ينتهي قريباً", days: dl };
  return { key: "active", label: "نشط", days: dl };
}

// عمر الدين بالأيام (منذ بداية الاشتراك)
function debtAgeDays(device) {
  if (!(device.debt > 0)) return 0;
  const ref = device.startDate || device.createdAt;
  if (!ref) return 0;
  return Math.max(0, diffDays(ref, todayStr()));
}

// ما يستحق اليوم: تجديدات (منتهية/قريبة) + دفعات للمورّد مستحقّة + ديون العملاء
function computeDue(data, settings) {
  const soon = settings.soonDays || 3;
  const today = todayStr();
  const renewals = [], supplier = [], debts = [];
  (data.devices || []).forEach((d) => {
    if (d.broken) {
      if (d.debt > 0) debts.push(d);
      return;
    }
    const dl = diffDays(today, d.endDate);
    if (dl <= soon) renewals.push({ d, dl });
    if (d.cost > 0 && !d.costPaid) {
      const due = d.supplierDueDate || d.endDate;
      if (diffDays(today, due) <= 0) supplier.push(d);
    }
    if (d.debt > 0) debts.push(d);
  });
  renewals.sort((a, b) => a.dl - b.dl);
  return { renewals, supplier, debts, total: renewals.length + supplier.length + debts.length };
}

/* ----------------------- طبقة التخزين ----------------------- */
async function loadData() {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const res = await window.storage.get(STORAGE_KEY);
      if (res && res.value) return JSON.parse(res.value);
    }
  } catch (e) {
    /* لا توجد بيانات محفوظة بعد */
  }
  return null;
}
async function persist(data) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    /* تجاهل أخطاء التخزين */
  }
}
// نسخة احتياطية تلقائية يومية
async function saveAutoBackup(data) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set("starnet_autobackup", JSON.stringify({ date: todayStr(), data }));
    }
  } catch (e) {}
}
async function loadAutoBackup() {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get("starnet_autobackup");
      if (r && r.value) return JSON.parse(r.value);
    }
  } catch (e) {}
  return null;
}

// ===== أصوات قصيرة لطيفة (Web Audio — بلا ملفات) =====
let _sndCtx = null;
let SND_ON = true;
function setSoundOn(v) { SND_ON = !!v; }
function _sctx() {
  if (typeof window === "undefined") return null;
  try {
    if (!_sndCtx) _sndCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_sndCtx.state === "suspended") _sndCtx.resume();
    return _sndCtx;
  } catch (e) { return null; }
}
function _tone(ctx, freq, start, dur, vol, type) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || "sine";
  o.frequency.value = freq;
  o.connect(g); g.connect(ctx.destination);
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.03);
}
function playSound(kind) {
  if (!SND_ON) return;
  const ctx = _sctx(); if (!ctx) return;
  const V = 0.09;
  if (kind === "charge" || kind === "save") { _tone(ctx, 587, 0, 0.12, V); _tone(ctx, 880, 0.10, 0.16, V); }
  else if (kind === "payment") { _tone(ctx, 784, 0, 0.10, V); _tone(ctx, 1175, 0.09, 0.16, V); }
  else if (kind === "delete") { _tone(ctx, 330, 0, 0.13, V * 0.9, "triangle"); _tone(ctx, 247, 0.10, 0.18, V * 0.9, "triangle"); }
  else if (kind === "tap") { _tone(ctx, 660, 0, 0.06, V * 0.7); }
  else { _tone(ctx, 700, 0, 0.10, V); }
}


// تزيل دفعات «تسديد دين» القديمة المنفصلة (التي كانت تسبّب ربحاً وهمياً بعد إلغاء الدفعات).
function reconcileIncome(data) {
  if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.devices)) return data;
  const renewed = new Set(data.transactions.filter((t) => t.type === "تجديد").map((t) => t.deviceId));
  const txs = data.transactions.filter((t) => !(t.type === "تسديد دين" && !renewed.has(t.deviceId)));
  data.devices.forEach((dev) => {
    if (renewed.has(dev.id)) return; // الأجهزة المجدّدة لها دخل متعدّد الفترات — لا نلمسها
    const paid = Math.round((Number(dev.amountPaid) || 0) * 100) / 100;
    const idx = txs.findIndex((t) => t.deviceId === dev.id && t.type === "شحن");
    if (idx >= 0) txs[idx] = { ...txs[idx], amount: paid };
  });
  return { ...data, transactions: txs };
}

/* ============================================================
   المكوّن الرئيسي
   ============================================================ */
function LockScreen({ pin, onUnlock }) {
  const [entry, setEntry] = useState("");
  const [err, setErr] = useState(false);
  const press = (k) => {
    setErr(false);
    if (k === "del") { setEntry((e) => e.slice(0, -1)); return; }
    const next = (entry + k).slice(0, 6);
    setEntry(next);
    if (next.length >= String(pin).length) {
      if (next === String(pin)) { playSound("save"); onUnlock(); }
      else { setErr(true); setEntry(""); playSound("delete"); }
    }
  };
  return (
    <div className="sn-root sn-lock" dir="rtl">
      <style>{CSS}</style>
      <div className="sn-lock-box">
        <div className="sn-lock-logo">⭐</div>
        <h2>STAR NET</h2>
        <p>أدخل الرمز السرّي</p>
        <div className="sn-lock-dots">
          {Array.from({ length: String(pin).length }).map((_, i) => (
            <span key={i} className={"sn-lock-dot" + (i < entry.length ? " on" : "")} />
          ))}
        </div>
        {err && <p className="sn-lock-err">رمز خاطئ — حاول مجدّداً</p>}
        <div className="sn-lock-pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
            k === "" ? (
              <span key={i} />
            ) : (
              <button key={i} className="sn-lock-key" onClick={() => press(k)}>
                {k === "del" ? "⌫" : k}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function StarNetApp() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [drawer, setDrawer] = useState(false);
  const [panel, setPanel] = useState(null); // null | countries | contacts | excel | backup | trash
  const [editing, setEditing] = useState(null); // device | "new" | null
  const [renewing, setRenewing] = useState(null); // device | null
  const [collecting, setCollecting] = useState(null); // device being collected | null
  const [payingSupplier, setPayingSupplier] = useState(null); // device being paid to supplier | null
  const [editingAgent, setEditingAgent] = useState(null); // agent | "new" | null
  const [editingCountry, setEditingCountry] = useState(null); // country | "new" | null
  const [editingContact, setEditingContact] = useState(null); // contact | "new" | null
  const [viewAgent, setViewAgent] = useState(null); // agent being viewed
  const [confirm, setConfirm] = useState(null); // {text, onYes}
  const [toast, setToast] = useState("");
  const [locked, setLocked] = useState(false);
  const [undoSnap, setUndoSnap] = useState(null); // {data, label}
  const loaded = useRef(false);

  // تحميل البيانات مرة واحدة
  useEffect(() => {
    (async () => {
      const saved = await loadData();
      if (saved && saved.devices) {
        const fixed = reconcileIncome({
          ...DEFAULT_DATA,
          ...saved,
          settings: { ...DEFAULT_DATA.settings, ...(saved.settings || {}) },
          agents: saved.agents || [],
          countries: saved.countries && saved.countries.length ? saved.countries : DEFAULT_DATA.countries,
          trash: saved.trash || [],
          contacts: saved.contacts || [],
          personColors: saved.personColors || {},
        });
        fixed.personColors = assignPersonColors(fixed.devices, fixed.personColors);
        fixed.personNumbers = assignPersonNumbers(fixed.devices, fixed.personNumbers);
        setData(fixed);
        if (fixed.settings && fixed.settings.pin) setLocked(true);
        try {
          const bk = await loadAutoBackup();
          if (!bk || bk.date !== todayStr()) await saveAutoBackup(fixed);
        } catch (e) {}
      } else {
        setData(DEFAULT_DATA);
      }
      loaded.current = true;
      try { setSoundOn(((saved && saved.settings) || {}).sounds !== false); } catch (e) {}
    })();
  }, []);

  // حفظ تلقائي عند أي تغيير
  useEffect(() => {
    if (loaded.current && data) persist(data);
  }, [data]);

  // تنبيه تلقائي عند فتح التطبيق بما يستحق اليوم (إن سُمح بالتنبيهات)
  const notified = useRef(false);
  useEffect(() => {
    if (!data || notified.current) return;
    notified.current = true;
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const due = computeDue(data, data.settings);
        if (due.total > 0) {
          new Notification("STAR NET ⭐ — تستحق اليوم", {
            body: `🔄 تجديدات: ${due.renewals.length}  •  🏷️ للمورّد: ${due.supplier.length}  •  💰 ديون: ${due.debts.length}`,
          });
        }
      }
    } catch (e) {}
  }, [data]);

  // اختصارات الشاشة الرئيسية (PWA shortcuts)
  useEffect(() => {
    try {
      const action = new URLSearchParams(window.location.search).get("action");
      if (action === "add") setEditing("new");
      else if (action === "devices") setTab("devices");
      else if (action === "due") setTab("dashboard");
    } catch (e) {}
  }, []);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };
  // التقاط لقطة قبل أي إجراء مهم لإتاحة التراجع
  const snapshot = (label) => setUndoSnap({ data, label, t: Date.now() });
  const doUndo = () => {
    if (!undoSnap) return;
    setData(undoSnap.data);
    setUndoSnap(null);
    flash("تم التراجع ↩️");
  };
  useEffect(() => {
    if (!undoSnap) return;
    const id = setTimeout(() => setUndoSnap(null), 8000);
    return () => clearTimeout(id);
  }, [undoSnap]);

  /* --------- عمليات على البيانات --------- */
  const settings = data?.settings || DEFAULT_DATA.settings;

  const toBase = (amount, currency) => {
    const r = settings.rates[currency] ?? 1;
    return (Number(amount) || 0) * r;
  };

  function saveDevice(form, isNew) {
    snapshot(isNew ? "إضافة جهاز" : "تعديل جهاز");
    setData((d) => {
      const endDate = addDays(form.startDate, form.durationDays);
      const dev = { ...form, endDate };
      let devices, transactions = [...d.transactions];
      const expenseTx = () => ({
        id: uid(),
        deviceId: form.id || dev.id,
        customerName: dev.customerName,
        date: todayStr(),
        amount: Number(form.cost) || 0,
        currency: "USDT",
        isExpense: true,
        type: "دفع للمورّد",
      });
      if (isNew) {
        dev.id = uid();
        dev.createdAt = todayStr();
        devices = [dev, ...d.devices];
        // دخل الشحن (المبلغ الذي دفعه الزبون)
        transactions.unshift({
          id: uid(),
          deviceId: dev.id,
          customerName: dev.customerName,
          date: form.startDate,
          amount: Number(form.amountPaid) || 0,
          currency: form.currency,
          method: form.payMethod,
          type: "شحن",
        });
        // مصروف فقط إن كنت قد دفعت للمورّد فعلاً
        if (form.costPaid && Number(form.cost) > 0) {
          const e = expenseTx();
          e.deviceId = dev.id;
          transactions.unshift(e);
        }
      } else {
        const old = d.devices.find((x) => x.id === form.id);
        devices = d.devices.map((x) => (x.id === form.id ? { ...x, ...dev } : x));
        // توفيق حالة الدفع للمورّد عند التعديل
        if (!old?.costPaid && form.costPaid && Number(form.cost) > 0) {
          transactions.unshift(expenseTx());
        } else if (old?.costPaid && !form.costPaid) {
          const idx = transactions.findIndex((tt) => tt.deviceId === form.id && tt.type === "دفع للمورّد");
          if (idx >= 0) transactions.splice(idx, 1);
        }
        // مواءمة دخل الجهاز = المبلغ المدفوع فعلاً (إزالة دفعات الدين القديمة لمنع الربح الوهمي)
        transactions = transactions.filter((tt) => !(tt.deviceId === form.id && tt.type === "تسديد دين"));
        const paidNow = Math.round((Number(form.amountPaid) || 0) * 100) / 100;
        const inIdx = transactions.findIndex((tt) => tt.deviceId === form.id && (tt.type === "تجديد" || tt.type === "شحن"));
        if (inIdx >= 0) {
          transactions[inIdx] = { ...transactions[inIdx], amount: paidNow, currency: form.currency, method: form.payMethod };
        } else {
          transactions.unshift({
            id: uid(),
            deviceId: form.id,
            customerName: dev.customerName,
            date: form.startDate,
            amount: paidNow,
            currency: form.currency,
            method: form.payMethod,
            type: "شحن",
          });
        }
      }
      // حفظ/تحديث العميل تلقائياً في دفتر العملاء
      let contacts = d.contacts || [];
      const cName = (form.customerName || "").trim();
      if (cName) {
        const cData = {
          name: cName,
          dialCode: form.dialCode || "+222",
          phone: form.phone || "",
          email: form.email || "",
          accountNumber: form.accountNumber || "",
          wifiPassword: form.wifiPassword || "",
          emailPassword: form.emailPassword || "",
          country: form.country || "",
          currency: form.currency || "MRU",
          totalCustomer: form.totalCustomer ?? "",
          cost: form.cost ?? "",
          costCurrency: form.costCurrency || "USDT",
          payMethod: form.payMethod || "BANKILY",
          agentId: form.agentId || "",
        };
        const ci = contacts.findIndex((c) => (c.name || "").trim().toLowerCase() === cName.toLowerCase());
        if (ci >= 0) {
          contacts = contacts.map((c, i) => (i === ci ? { ...c, ...cData } : c));
        } else {
          contacts = [...contacts, { ...cData, id: uid(), createdAt: todayStr(), note: "" }];
        }
      }
      return { ...d, devices, transactions, contacts, personColors: assignPersonColors(devices, d.personColors), personNumbers: assignPersonNumbers(devices, d.personNumbers) };
    });
    flash(isNew ? "تمت إضافة الجهاز ✅" : "تم حفظ التعديلات ✅");
    playSound(isNew ? "charge" : "save");
    setEditing(null);
  }

  function renewDevice(device, info) {
    snapshot("تجديد");
    setData((d) => {
      const newEnd = addDays(info.date, info.durationDays);
      const devices = d.devices.map((x) =>
        x.id === device.id
          ? {
              ...x,
              startDate: info.date,
              durationDays: info.durationDays,
              endDate: newEnd,
              broken: false,
              package: info.package || x.package || "",
              // عملية جديدة كاملة: نحدّث كل بيانات العملية
              country: info.country,
              costLocal: Number(info.costLocal) || 0,
              cost: Number(info.cost) || 0,
              costCurrency: "USDT",
              costPaid: info.costPaid,
              supplierDueDate: info.supplierDueDate,
              totalCustomer: Number(info.totalCustomer) || 0,
              amountPaid: Number(info.amount) || 0,
              currency: info.currency,
              debt: Number(info.debt) || 0,
              debtCurrency: info.currency,
              credit: Number(info.credit) || 0,
              creditCurrency: info.currency,
            }
          : x
      );
      const transactions = [
        {
          id: uid(),
          deviceId: device.id,
          customerName: device.customerName,
          date: info.date,
          amount: Number(info.amount) || 0,
          currency: info.currency,
          type: "تجديد",
        },
        ...d.transactions,
      ];
      if (info.costPaid && Number(info.cost) > 0) {
        transactions.unshift({
          id: uid(),
          deviceId: device.id,
          customerName: device.customerName,
          date: info.date,
          amount: Number(info.cost) || 0,
          currency: "USDT",
          isExpense: true,
          type: "دفع للمورّد",
        });
      }
      return { ...d, devices, transactions };
    });
    flash("تم تسجيل تجديد كامل ✅");
    playSound("charge");
    setRenewing(null);
  }

  function deleteDevice(device) {
    setConfirm({
      text: `حذف جهاز «${device.customerName || "بدون اسم"}»؟ سيُنقل إلى سلة المحذوفات ويمكن استعادته.`,
      onYes: () => {
        setData((d) => ({
          ...d,
          devices: d.devices.filter((x) => x.id !== device.id),
          transactions: d.transactions.filter((t) => t.deviceId !== device.id),
          trash: [{ device, transactions: d.transactions.filter((t) => t.deviceId === device.id), deletedAt: todayStr() }, ...(d.trash || [])],
        }));
        flash("نُقل إلى سلة المحذوفات 🗑️");
        playSound("delete");
        setConfirm(null);
        setUndoSnap({ data, label: "حذف جهاز", t: Date.now() });
      },
    });
  }
  function restoreTrash(item) {
    setData((d) => ({
      ...d,
      devices: [item.device, ...d.devices],
      transactions: [...(item.transactions || []), ...d.transactions],
      trash: (d.trash || []).filter((x) => x.device.id !== item.device.id),
    }));
    flash("تمت الاستعادة ✅");
  }
  function purgeTrash(item) {
    setData((d) => ({ ...d, trash: (d.trash || []).filter((x) => x.device.id !== item.device.id) }));
    flash("حُذف نهائياً");
  }
  function emptyTrash() {
    setData((d) => ({ ...d, trash: [] }));
    flash("أُفرغت السلة");
  }

  function clearDebt(device) {
    setCollecting(device);
  }
  function confirmCollect(device, info) {
    snapshot("تحصيل دين");
    const amt = Number(info.amount) || 0;
    setData((d) => {
      const tx = {
        id: uid(),
        deviceId: device.id,
        customerName: device.customerName,
        date: info.date || todayStr(),
        amount: amt,
        currency: device.debtCurrency || device.currency || "MRU",
        method: info.method,
        type: "تسديد دين",
        proof: info.proof || "",
      };
      const newDebt = Math.max(0, Math.round(((Number(device.debt) || 0) - amt) * 100) / 100);
      const newPaid = Math.round(((Number(device.amountPaid) || 0) + amt) * 100) / 100;
      return {
        ...d,
        transactions: amt > 0 ? [tx, ...d.transactions] : d.transactions,
        devices: d.devices.map((x) => (x.id === device.id ? { ...x, debt: newDebt, amountPaid: newPaid } : x)),
      };
    });
    flash("تم تسجيل الدفع ✅");
    playSound("payment");
    setCollecting(null);
  }

  function markCostPaid(device, paid = true) {
    setData((d) => {
      let transactions = [...d.transactions];
      if (paid && Number(device.cost) > 0) {
        // سجّل مصروف الدفع للمورّد (يُخصم من ربحك الآن)
        transactions.unshift({
          id: uid(),
          deviceId: device.id,
          customerName: device.customerName,
          date: todayStr(),
          amount: Number(device.cost) || 0,
          currency: "USDT",
          isExpense: true,
          type: "دفع للمورّد",
        });
      } else if (!paid) {
        // ألغِ آخر مصروف دفع للمورّد لهذا الجهاز
        const idx = transactions.findIndex((tt) => tt.deviceId === device.id && tt.type === "دفع للمورّد");
        if (idx >= 0) transactions.splice(idx, 1);
      }
      return {
        ...d,
        transactions,
        devices: d.devices.map((x) => (x.id === device.id ? { ...x, costPaid: paid } : x)),
      };
    });
    flash(paid ? "تم تسجيل دفعك للمورّد ✅" : "أُلغي الدفع للمورّد");
  }

  // عند الضغط على «دفعت للمورّد»: نفتح نافذة تأكيد المبلغ والتاريخ. الإلغاء فوري.
  function handleMarkPaid(device, paid = true) {
    if (paid) setPayingSupplier(device);
    else markCostPaid(device, false);
  }
  function confirmSupplierPay(device, info) {
    snapshot("دفع للمورّد");
    const amt = Number(info.amount) || 0;
    setData((d) => {
      let transactions = [...d.transactions];
      const idx = transactions.findIndex((t) => t.deviceId === device.id && t.type === "دفع للمورّد");
      if (idx >= 0) transactions.splice(idx, 1); // تفادي التكرار
      if (amt > 0) {
        transactions.unshift({
          id: uid(),
          deviceId: device.id,
          customerName: device.customerName,
          date: info.date || todayStr(),
          amount: amt,
          currency: "USDT",
          isExpense: true,
          type: "دفع للمورّد",
          proof: info.proof || "",
        });
      }
      // حدّث التكلفة المحلية (بعملة دولة الشحن) لتطابق المبلغ الجديد بالدولار
      const rateEntry = device.country ? (d.countries || []).find((c) => c.name === device.country) : null;
      const perDollar = rateEntry && Number(rateEntry.perDollar) > 0 ? Number(rateEntry.perDollar) : null;
      const newLocal = perDollar ? Math.round(amt * perDollar * 100) / 100 : amt;
      return {
        ...d,
        transactions,
        devices: d.devices.map((x) => (x.id === device.id ? { ...x, costPaid: true, cost: amt, costLocal: newLocal } : x)),
      };
    });
    flash("تم تسجيل الدفع للمورّد ✅");
    playSound("payment");
    setPayingSupplier(null);
  }

  // تعطّل الجهاز: لا نخسر شيئاً لأننا لم ندفع التكلفة للمورّد بعد
  function markBroken(device) {
    snapshot("تعطيل جهاز");
    setData((d) => ({
      ...d,
      devices: d.devices.map((x) =>
        x.id === device.id ? { ...x, broken: true } : x
      ),
    }));
    flash("تم تسجيل تعطّل الجهاز 🔧");
  }
  function unBreak(device) {
    setData((d) => ({
      ...d,
      devices: d.devices.map((x) =>
        x.id === device.id ? { ...x, broken: false } : x
      ),
    }));
    flash("أُلغي تعطّل الجهاز");
  }

  // المندوبون (الوسطاء)
  function saveAgent(agent) {
    setData((d) => {
      if (agent.id) {
        return { ...d, agents: d.agents.map((a) => (a.id === agent.id ? { ...a, ...agent } : a)) };
      }
      return { ...d, agents: [...(d.agents || []), { ...agent, id: uid() }] };
    });
    flash("تم حفظ المندوب ✅");
  }
  function deleteAgent(agent) {
    setConfirm({
      text: `حذف المندوب "${agent.name}"؟ ستبقى أجهزته لكن دون ربطها بمندوب.`,
      onYes: () => {
        setData((d) => ({
          ...d,
          agents: d.agents.filter((a) => a.id !== agent.id),
          devices: d.devices.map((x) => (x.agentId === agent.id ? { ...x, agentId: "" } : x)),
        }));
        flash("تم حذف المندوب");
        setConfirm(null);
      },
    });
  }

  function handleCopy(text, label) {
    const ok = copyToClipboard(String(text || ""));
    flash(ok ? `تم نسخ ${label} ✅` : "تعذّر النسخ");
  }

  function handleExport(device) {
    const ok = exportCustomerPDF(device, data, settings);
    flash(ok ? "تم فتح صفحة الطباعة — اختر «حفظ PDF» 📄" : "تعذّر التصدير");
  }

  function setCountries(list) {
    setData((d) => ({ ...d, countries: list }));
  }

  // إضافة/تحديث سعر عملة دولة بالاسم (يُستدعى من داخل نموذج الجهاز)
  function upsertCountryRate(name, currency, perDollar) {
    if (!name || !perDollar) return;
    setData((d) => {
      const exists = (d.countries || []).find((c) => c.name === name);
      if (exists) {
        return { ...d, countries: d.countries.map((c) => (c.name === name ? { ...c, currency, perDollar } : c)) };
      }
      return { ...d, countries: [...(d.countries || []), { id: uid(), name, currency, perDollar }] };
    });
    flash("تم حفظ سعر العملة ✅");
  }

  // سجل الدول/العملات
  function saveCountry(c) {
    setData((d) => {
      if (c.id) {
        return { ...d, countries: d.countries.map((x) => (x.id === c.id ? { ...x, ...c } : x)) };
      }
      return { ...d, countries: [...(d.countries || []), { ...c, id: uid() }] };
    });
    flash("تم حفظ الدولة ✅");
  }
  function deleteCountry(c) {
    setConfirm({
      text: `حذف سعر "${c.name}" من سجل العملات؟ (لن يتأثر تسجيل الأجهزة، فقط التحويل التلقائي)`,
      onYes: () => {
        setData((d) => ({
          ...d,
          countries: d.countries.filter((x) => x.id !== c.id),
        }));
        flash("تم حذف الدولة من السجل");
        setConfirm(null);
      },
    });
  }

  function updateSettings(s) {
    setData((d) => ({ ...d, settings: { ...d.settings, ...s } }));
    setSoundOn(s.sounds !== false);
    flash("تم حفظ الإعدادات ✅");
    playSound("save");
  }

  function settleAgent(agent, amount) {
    const amt = Number(amount) || 0;
    if (amt <= 0) return;
    setData((d) => ({
      ...d,
      agentPayouts: [{ id: uid(), agentId: agent.id, amount: amt, date: todayStr() }, ...(d.agentPayouts || [])],
    }));
    flash(`سُجّل تسليم ${money(amt)} للمندوب ✅`);
    playSound("payment");
  }

  function addInvItem(info) {
    setData((d) => ({
      ...d,
      inventory: [
        { id: uid(), name: info.name, category: info.category || "device", qty: Number(info.qty) || 0, cost: Number(info.cost) || 0, costCurrency: info.costCurrency || "USDT", price: Number(info.price) || 0, currency: info.currency || "MRU", createdAt: todayStr() },
        ...(d.inventory || []),
      ],
    }));
    flash("أُضيف الصنف للمخزون ✅");
    playSound("save");
  }
  function adjustInvQty(id, delta) {
    setData((d) => ({ ...d, inventory: (d.inventory || []).map((it) => (it.id === id ? { ...it, qty: Math.max(0, (Number(it.qty) || 0) + delta) } : it)) }));
  }
  function deleteInvItem(id) {
    setData((d) => ({ ...d, inventory: (d.inventory || []).filter((it) => it.id !== id) }));
    flash("حُذف الصنف");
  }
  function sellInvItem(item, customerName) {
    setData((d) => {
      const inventory = (d.inventory || []).map((it) => (it.id === item.id ? { ...it, qty: Math.max(0, (Number(it.qty) || 0) - 1) } : it));
      const saleId = uid();
      const txs = [...d.transactions];
      txs.unshift({ id: uid(), saleId, date: todayStr(), amount: Number(item.price) || 0, currency: item.currency || "MRU", type: "بيع مخزون", service: item.name, customerName: customerName || "", note: item.category === "device" ? "جهاز" : "اكسسوار" });
      if (Number(item.cost) > 0) {
        txs.unshift({ id: uid(), saleId, date: todayStr(), amount: Number(item.cost) || 0, currency: item.costCurrency || "USDT", isExpense: true, type: "تكلفة مخزون", service: item.name, customerName: customerName || "" });
      }
      return { ...d, inventory, transactions: txs };
    });
    flash("تم تسجيل البيع ✅");
    playSound("payment");
  }

  function addOrder(info) {
    setData((d) => ({ ...d, orders: [{ id: uid(), customerName: info.customerName || "", phone: info.phone || "", note: info.note || "", status: "جديد", date: todayStr() }, ...(d.orders || [])] }));
    flash("أُضيف الطلب 📋");
    playSound("save");
  }
  function cycleOrder(id) {
    const order = ["جديد", "قيد التنفيذ", "منفّذ"];
    setData((d) => ({ ...d, orders: (d.orders || []).map((o) => (o.id === id ? { ...o, status: order[(order.indexOf(o.status) + 1) % order.length] } : o)) }));
  }
  function deleteOrder(id) {
    setData((d) => ({ ...d, orders: (d.orders || []).filter((o) => o.id !== id) }));
    flash("حُذف الطلب");
  }

  function cycleInstall(device) {
    const order = ["", "مطلوب", "قيد التركيب", "مكتمل"];
    const idx = order.indexOf(device.installStatus || "");
    const next = order[(idx + 1) % order.length];
    snapshot("تحديث التركيب");
    setData((d) => ({ ...d, devices: d.devices.map((x) => (x.id === device.id ? { ...x, installStatus: next } : x)) }));
    flash("حالة التركيب: " + (next || "بدون") + " 🚚");
  }

  function archiveDevice(device) {
    snapshot(device.archived ? "إلغاء أرشفة" : "أرشفة");
    setData((d) => ({ ...d, devices: d.devices.map((x) => (x.id === device.id ? { ...x, archived: !x.archived } : x)) }));
    flash(device.archived ? "أُلغيت الأرشفة" : "أُرشف الزبون 🧊");
  }
  function addService(info) {
    const svcId = uid();
    const amt = Number(info.amount) || 0;
    const cost = Number(info.cost) || 0;
    setData((d) => {
      const txs = [...d.transactions];
      txs.unshift({ id: uid(), svcId, date: info.date || todayStr(), amount: amt, currency: info.currency || "MRU", type: "خدمة", service: info.service || "خدمة", customerName: info.customerName || "", note: info.note || "" });
      if (cost > 0) {
        txs.unshift({ id: uid(), svcId, date: info.date || todayStr(), amount: cost, currency: info.costCurrency || "MRU", isExpense: true, type: "تكلفة خدمة", service: info.service || "خدمة", customerName: info.customerName || "" });
      }
      return { ...d, transactions: txs };
    });
    flash("تمت إضافة الخدمة ✅");
    playSound("payment");
  }
  function deleteService(svcId) {
    setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.svcId !== svcId) }));
    flash("حُذفت الخدمة");
  }

  function addExpense(info) {
    setData((d) => ({
      ...d,
      transactions: [
        { id: uid(), date: info.date || todayStr(), amount: Number(info.amount) || 0, currency: info.currency || "MRU", isExpense: true, type: "مصروف عام", note: info.note || "" },
        ...d.transactions,
      ],
    }));
    flash("تم تسجيل المصروف ✅");
    playSound("payment");
  }
  function deleteExpense(id) {
    setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
    flash("حُذف المصروف");
  }

  async function restoreAutoBackup() {
    const bk = await loadAutoBackup();
    if (!bk || !bk.data) { flash("لا توجد نسخة تلقائية بعد"); return; }
    setConfirm({
      text: `استعادة النسخة التلقائية بتاريخ ${fmtDate(bk.date)}؟ ستحلّ محلّ البيانات الحالية.`,
      onYes: () => {
        const fixed = reconcileIncome(bk.data);
        fixed.personColors = assignPersonColors(fixed.devices, fixed.personColors);
        fixed.personNumbers = assignPersonNumbers(fixed.devices, fixed.personNumbers);
        setData(fixed);
        setPanel(null);
        flash("تمت الاستعادة ✅");
        setConfirm(null);
      },
    });
  }

  // دفتر العملاء (إيميلات/بيانات بدون شحن)
  function saveContact(c) {
    setData((d) => {
      if (c.id) {
        return { ...d, contacts: (d.contacts || []).map((x) => (x.id === c.id ? { ...x, ...c } : x)) };
      }
      return { ...d, contacts: [...(d.contacts || []), { ...c, id: uid(), createdAt: new Date().toISOString() }] };
    });
    flash("تم حفظ العميل في الدفتر ✅");
    playSound("save");
  }
  function deleteContact(c) {
    setConfirm({
      text: `حذف "${c.name || c.email}" من دفتر العملاء؟`,
      onYes: () => {
        setData((d) => ({ ...d, contacts: (d.contacts || []).filter((x) => x.id !== c.id) }));
        flash("تم الحذف من الدفتر");
        setConfirm(null);
      },
    });
  }

  // استيراد أجهزة من ملف Excel (صفوف منسّقة)
  function importDevicesFromRows(rows) {
    const valid = (rows || []).filter((r) => (r.customerName || "").trim());
    if (valid.length === 0) {
      flash("لم يُعثر على صفوف صالحة (تأكّد من عمود «اسم العميل»)");
      return;
    }
    setData((d) => {
      const newDevices = [];
      const newTx = [];
      valid.forEach((r) => {
        const name = String(r.customerName).trim();
        const startDate = excelToDateStr(r.startDate) || todayStr();
        const durationDays = Number(r.durationDays) > 0 ? Number(r.durationDays) : d.settings.defaultDuration;
        const endDate = addDays(startDate, durationDays);
        const total = Number(r.totalCustomer) || 0;
        const paid = Number(r.amountPaid) || 0;
        const diff = total - paid;
        const currency = (r.currency || "MRU").toString().trim().toUpperCase();
        const cost = Number(r.cost) || 0;
        const costPaid = ["نعم", "yes", "true", "1", "✓"].includes(String(r.costPaid || "").trim().toLowerCase());
        const dev = {
          id: uid(),
          createdAt: todayStr(),
          customerName: name,
          dialCode: (r.dialCode || "+222").toString().trim() || "+222",
          phone: (r.phone || "").toString().trim(),
          email: (r.email || "").toString().trim(),
          accountNumber: (r.accountNumber || "").toString().trim(),
          wifiPassword: (r.wifiPassword || "").toString().trim(),
          emailPassword: (r.emailPassword || "").toString().trim(),
          startDate,
          durationDays,
          endDate,
          country: (r.country || "").toString().trim(),
          costLocal: "",
          cost,
          costCurrency: "USDT",
          costPaid,
          supplierDueDate: addDays(startDate, d.settings.supplierDays),
          totalCustomer: total,
          amountPaid: paid,
          currency: ["MRU", "USDT", "FCFA"].includes(currency) ? currency : "MRU",
          debt: diff > 0 ? diff : 0,
          debtCurrency: currency,
          credit: diff < 0 ? -diff : 0,
          creditCurrency: currency,
          payMethod: (r.payMethod || "BANKILY").toString().trim() || "BANKILY",
          originType: "",
          originNote: "",
          agentId: "",
          photos: [],
          audio: "",
          notes: (r.note || "").toString().trim() ? [String(r.note).trim()] : [],
          broken: false,
        };
        newDevices.push(dev);
        newTx.push({ id: uid(), deviceId: dev.id, customerName: name, date: startDate, amount: paid, currency: dev.currency, method: dev.payMethod, type: "شحن" });
        if (costPaid && cost > 0) {
          newTx.push({ id: uid(), deviceId: dev.id, customerName: name, date: startDate, amount: cost, currency: "USDT", isExpense: true, type: "دفع للمورّد" });
        }
      });
      let contacts = d.contacts || [];
      newDevices.forEach((dev) => {
        const nm = (dev.customerName || "").trim();
        if (!nm) return;
        const cData = {
          name: nm, dialCode: dev.dialCode || "+222", phone: dev.phone || "", email: dev.email || "",
          accountNumber: dev.accountNumber || "", wifiPassword: dev.wifiPassword || "", emailPassword: dev.emailPassword || "",
          country: dev.country || "", currency: dev.currency || "MRU", totalCustomer: dev.totalCustomer ?? "",
          cost: dev.cost ?? "", costCurrency: dev.costCurrency || "USDT", payMethod: dev.payMethod || "BANKILY", agentId: dev.agentId || "",
        };
        const ci = contacts.findIndex((c) => (c.name || "").trim().toLowerCase() === nm.toLowerCase());
        if (ci >= 0) contacts = contacts.map((c, i) => (i === ci ? { ...c, ...cData } : c));
        else contacts = [...contacts, { ...cData, id: uid(), createdAt: todayStr(), note: "" }];
      });
      const allDevices = [...newDevices, ...d.devices];
      return { ...d, devices: allDevices, transactions: [...newTx, ...d.transactions], contacts, personColors: assignPersonColors(allDevices, d.personColors), personNumbers: assignPersonNumbers(allDevices, d.personNumbers) };
    });
    flash(`تم استيراد ${valid.length} جهازاً ✅`);
    playSound("charge");
  }

  if (!data) {
    return (
      <div className="sn-root sn-loading">
        <style>{CSS}</style>
        <div className="sn-spinner" />
        <p>جارٍ تحميل بيانات STAR NET…</p>
      </div>
    );
  }

  if (locked && data.settings.pin) {
    return <LockScreen pin={data.settings.pin} onUnlock={() => setLocked(false)} />;
  }

  return (
    <div className="sn-root" dir="rtl">
      <style>{CSS}</style>

      {/* الرأس */}
      <header className="sn-header">
        <div className="sn-stars" aria-hidden="true" />
        <button className="sn-hbtn sn-menu-btn" onClick={() => setDrawer(true)} aria-label="القائمة">☰</button>
        <button className="sn-hbtn sn-add-btn" onClick={() => setEditing("new")} aria-label="إضافة جهاز">+</button>
        <div className="sn-brand">
          <span className="sn-logo">⭐</span>
          <div>
            <h1>{settings.businessName}</h1>
            <p>إدارة أجهزة واشتراكات ستارلينك</p>
          </div>
        </div>
      </header>

      {/* القائمة الجانبية */}
      {drawer && (
        <div className="sn-drawer-wrap" onClick={() => setDrawer(false)}>
          <aside className="sn-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sn-drawer-head">
              <span className="sn-logo">⭐</span>
              <div>
                <h2>{settings.businessName}</h2>
                <p>القائمة الرئيسية</p>
              </div>
            </div>
            <div className="sn-drawer-list">
              {[
                ["dashboard", "🛰️", "الرئيسية"],
                ["devices", "📋", `الأجهزة (${data.devices.length})`],
                ["agents", "🤝", "المندوبون"],
                ["reports", "📊", "التقارير والأرباح"],
                ["settings", "⚙️", "الإعدادات"],
              ].map(([k, ic, lbl]) => (
                <button key={k} className={"sn-drawer-item" + (tab === k ? " is-active" : "")} onClick={() => { setTab(k); setDrawer(false); }}>
                  <span className="sn-drawer-ic">{ic}</span>
                  <span className="sn-drawer-lbl">{lbl}</span>
                </button>
              ))}
              <div className="sn-drawer-sep" />
              <button className="sn-drawer-item" onClick={() => { setEditing("new"); setDrawer(false); }}>
                <span className="sn-drawer-ic">➕</span>
                <span className="sn-drawer-lbl">إضافة جهاز جديد</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("contacts"); setDrawer(false); }}>
                <span className="sn-drawer-ic">📒</span>
                <span className="sn-drawer-lbl">دفتر العملاء ({(data.contacts || []).length})</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("countries"); setDrawer(false); }}>
                <span className="sn-drawer-ic">💱</span>
                <span className="sn-drawer-lbl">سجل العملات ({(data.countries || []).length})</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("excel"); setDrawer(false); }}>
                <span className="sn-drawer-ic">📊</span>
                <span className="sn-drawer-lbl">استيراد / تصدير Excel</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("services"); setDrawer(false); }}>
                <span className="sn-drawer-ic">🛠️</span>
                <span className="sn-drawer-lbl">الخدمات (تفعيل/توثيق…)</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("convert"); setDrawer(false); }}>
                <span className="sn-drawer-ic">💱</span>
                <span className="sn-drawer-lbl">محوّل العملات</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("inventory"); setDrawer(false); }}>
                <span className="sn-drawer-ic">📦</span>
                <span className="sn-drawer-lbl">المخزون (أجهزة/اكسسوارات)</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("orders"); setDrawer(false); }}>
                <span className="sn-drawer-ic">📋</span>
                <span className="sn-drawer-lbl">قائمة الطلبات</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("wallets"); setDrawer(false); }}>
                <span className="sn-drawer-ic">🪙</span>
                <span className="sn-drawer-lbl">محافظ الزبائن (رصيد)</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("calendar"); setDrawer(false); }}>
                <span className="sn-drawer-ic">🗓️</span>
                <span className="sn-drawer-lbl">تقويم التجديدات</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("calc"); setDrawer(false); }}>
                <span className="sn-drawer-ic">💹</span>
                <span className="sn-drawer-lbl">حاسبة سعر البيع</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("expenses"); setDrawer(false); }}>
                <span className="sn-drawer-ic">💸</span>
                <span className="sn-drawer-lbl">المصروفات العامة</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("backup"); setDrawer(false); }}>
                <span className="sn-drawer-ic">☁️</span>
                <span className="sn-drawer-lbl">النسخ الاحتياطي ودرايف</span>
              </button>
              <button className="sn-drawer-item" onClick={() => { setPanel("trash"); setDrawer(false); }}>
                <span className="sn-drawer-ic">🗑️</span>
                <span className="sn-drawer-lbl">سلة المحذوفات ({(data.trash || []).length})</span>
              </button>
            </div>
            <p className="sn-drawer-foot">STAR NET ⭐</p>
          </aside>
        </div>
      )}

      <main className="sn-main">
        {tab === "dashboard" && (
          <Dashboard
            data={data}
            settings={settings}
            toBase={toBase}
            onRenew={setRenewing}
            onMarkPaid={handleMarkPaid}
            onBroken={markBroken}
            onClearDebt={clearDebt}
            onWhats={(dev, kind) => openWhatsApp(dev, kind, settings, customerBalance(dev, data, settings.rates))}
            onAdd={() => setEditing("new")}
            goDevices={() => setTab("devices")}
          />
        )}
        {tab === "devices" && (
          <Devices
            data={data}
            toBase={toBase}
            onEdit={setEditing}
            onRenew={setRenewing}
            onDelete={deleteDevice}
            onClearDebt={clearDebt}
            onMarkPaid={handleMarkPaid}
            onBroken={markBroken}
            onUnbreak={unBreak}
            onCopy={handleCopy}
            onExport={handleExport}
            onArchive={archiveDevice}
            onInstall={cycleInstall}
            onWhats={(dev, kind) => openWhatsApp(dev, kind, settings, customerBalance(dev, data, settings.rates))}
          />
        )}
        {tab === "agents" && (
          <Agents
            data={data}
            toBase={toBase}
            onAddAgent={() => setEditingAgent("new")}
            onEditAgent={setEditingAgent}
            onDeleteAgent={deleteAgent}
            onViewAgent={setViewAgent}
            onSettle={settleAgent}
          />
        )}
        {tab === "reports" && <Reports data={data} toBase={toBase} settings={settings} />}
        {tab === "settings" && (
          <Settings
            settings={settings}
            onSave={updateSettings}
            onReset={() =>
              setConfirm({
                text: "مسح كل البيانات نهائياً؟ لا يمكن التراجع.",
                onYes: () => {
                  setData(DEFAULT_DATA);
                  setConfirm(null);
                  flash("تم مسح كل البيانات");
                },
              })
            }
          />
        )}
      </main>

      {/* شريط التنقل السفلي */}
      <nav className="sn-tabs">
        {[
          ["dashboard", "🛰️", "الرئيسية"],
          ["devices", "📋", "الأجهزة"],
          ["agents", "🤝", "المندوبون"],
          ["reports", "📊", "التقارير"],
          ["settings", "⚙️", "الإعدادات"],
        ].map(([k, ic, lbl]) => (
          <button
            key={k}
            className={"sn-tab" + (tab === k ? " is-active" : "")}
            onClick={() => setTab(k)}
          >
            <span className="sn-tab-ic">{ic}</span>
            <span>{lbl}</span>
          </button>
        ))}
      </nav>

      {/* النوافذ */}
      {editing && (
        <DeviceForm
          initial={editing === "new" ? null : editing}
          settings={settings}
          devices={data.devices}
          contacts={data.contacts || []}
          agents={data.agents || []}
          countries={data.countries || []}
          onSaveRate={upsertCountryRate}
          onCancel={() => setEditing(null)}
          onSave={saveDevice}
        />
      )}
      {editingContact && (
        <ContactForm
          initial={editingContact === "new" ? null : editingContact}
          agents={data.agents || []}
          onCancel={() => setEditingContact(null)}
          onSave={(c) => {
            saveContact(c);
            setEditingContact(null);
          }}
        />
      )}
      {panel && (
        <ToolsPanel
          kind={panel}
          data={data}
          toBase={toBase}
          onClose={() => setPanel(null)}
          onAddCountry={() => setEditingCountry("new")}
          onEditCountry={setEditingCountry}
          onDeleteCountry={deleteCountry}
          onAddContact={() => setEditingContact("new")}
          onEditContact={setEditingContact}
          onDeleteContact={deleteContact}
          onImportExcel={importDevicesFromRows}
          onImport={(d) => { const fixed = reconcileIncome(d); fixed.personColors = assignPersonColors(fixed.devices, fixed.personColors); fixed.personNumbers = assignPersonNumbers(fixed.devices, fixed.personNumbers); setData(fixed); flash("تم استيراد البيانات ✅"); }}
          onRestoreTrash={restoreTrash}
          onPurgeTrash={purgeTrash}
          onEmptyTrash={emptyTrash}
          onRestoreAuto={restoreAutoBackup}
          onAddExpense={addExpense}
          onDeleteExpense={deleteExpense}
          onAddService={addService}
          onDeleteService={deleteService}
          onAddInv={addInvItem}
          onAdjustInv={adjustInvQty}
          onDeleteInv={deleteInvItem}
          onSellInv={sellInvItem}
          onAddOrder={addOrder}
          onCycleOrder={cycleOrder}
          onDeleteOrder={deleteOrder}
        />
      )}
      {editingCountry && (
        <CountryForm
          initial={editingCountry === "new" ? null : editingCountry}
          onCancel={() => setEditingCountry(null)}
          onSave={(c) => {
            saveCountry(c);
            setEditingCountry(null);
          }}
        />
      )}
      {editingAgent && (
        <AgentForm
          initial={editingAgent === "new" ? null : editingAgent}
          onCancel={() => setEditingAgent(null)}
          onSave={(a) => {
            saveAgent(a);
            setEditingAgent(null);
          }}
        />
      )}
      {viewAgent && (
        <AgentDevices
          agent={viewAgent}
          data={data}
          toBase={toBase}
          onClose={() => setViewAgent(null)}
          onEdit={(dev) => {
            setViewAgent(null);
            setEditing(dev);
          }}
          onRenew={(dev) => {
            setViewAgent(null);
            setRenewing(dev);
          }}
          onCopy={handleCopy}
          onWhats={(dev, kind) => openWhatsApp(dev, kind, settings, customerBalance(dev, data, settings.rates))}
        />
      )}
      {renewing && (
        <RenewForm
          device={renewing}
          settings={settings}
          countries={data.countries || []}
          onSaveRate={upsertCountryRate}
          onCancel={() => setRenewing(null)}
          onConfirm={renewDevice}
        />
      )}
      {collecting && (
        <PaymentSheet
          device={collecting}
          onCancel={() => setCollecting(null)}
          onConfirm={confirmCollect}
        />
      )}
      {payingSupplier && (
        <SupplierPaySheet
          device={payingSupplier}
          countries={data.countries || []}
          onCancel={() => setPayingSupplier(null)}
          onConfirm={confirmSupplierPay}
        />
      )}
      {confirm && (
        <ConfirmDialog
          text={confirm.text}
          onYes={confirm.onYes}
          onNo={() => setConfirm(null)}
        />
      )}
      {toast && <div className="sn-toast">{toast}</div>}
      {undoSnap && (
        <div className="sn-undo">
          <span>تمّ: {undoSnap.label}</span>
          <button onClick={doUndo}>↩️ تراجع</button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   واتساب
   ============================================================ */
function openWhatsApp(device, kind, settings, balance) {
  const tpl = kind === "reminder" ? settings.msgReminder : settings.msgCharged;
  // الرصيد المجمّع لكل حسابات نفس الشخص (بعملة الأساس)
  const net = balance ? balance.net : Number(device.debt) || 0;
  const hasDebt = net > 0;
  const hasCredit = net < 0;
  const debtText = hasDebt ? `${money(net)} MRU` : "لا يوجد";
  const debtLine = hasDebt ? `\n💰 إجمالي المتبقي عليك: ${money(net)} MRU` : "";
  const creditText = hasCredit ? `${money(-net)} MRU` : "لا يوجد";
  const creditLine = hasCredit ? `\n💳 رصيدك المحفوظ لدينا: ${money(-net)} MRU` : "";
  // الوقت المتبقّي على الانتهاء (أو منذ متى انتهى)
  let remainingLine = "";
  if (device.endDate) {
    const ed = parseDate(device.endDate);
    ed.setHours(23, 59, 59, 999);
    let diff = ed.getTime() - Date.now();
    const past = diff < 0;
    diff = Math.abs(diff);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const txt = `${days} يوم و${hours} ساعة و${mins} دقيقة`;
    remainingLine = past ? `⌛ انتهى الرصيد منذ: ${txt}` : `⏳ يتبقّى على الانتهاء: ${txt}`;
  }
  const msg = tpl
    .replaceAll("{name}", device.customerName || "")
    .replaceAll("{email}", device.email || "—")
    .replaceAll("{start}", fmtDate(device.startDate))
    .replaceAll("{end}", fmtDate(device.endDate))
    .replaceAll("{account}", device.accountNumber || "—")
    .replaceAll("{wifi}", device.wifiPassword || "—")
    .replaceAll("{remaining}", remainingLine)
    .replaceAll("{debtline}", debtLine)
    .replaceAll("{debt}", debtText)
    .replaceAll("{creditline}", creditLine)
    .replaceAll("{credit}", creditText);
  const num = ((device.dialCode || "") + (device.phone || "")).replace(/[^\d]/g, "");
  let outMsg = msg;
  if (kind === "receipt") {
    const dDebt = Number(device.debt) || 0, dCredit = Number(device.credit) || 0;
    const balLine = dDebt > 0
      ? `💰 المتبقّي (دين): ${money(dDebt)} ${symbolOf(device.debtCurrency || device.currency)}`
      : dCredit > 0
      ? `💳 رصيدك لدينا: ${money(dCredit)} ${symbolOf(device.creditCurrency || device.currency)}`
      : "✅ مدفوع بالكامل";
    outMsg = [
      `🧾 *إيصال — ${settings.businessName || "STAR NET"}* ⭐`,
      `━━━━━━━━━━━━`,
      `👤 ${device.customerName || "—"}`,
      device.accountNumber ? `🔢 الحساب: ${device.accountNumber}` : "",
      `📡 اشتراك ستارلينك`,
      `📅 ${fmtDate(device.startDate)} ← ${fmtDate(device.endDate)} (${device.durationDays} يوم)`,
      `━━━━━━━━━━━━`,
      device.totalCustomer > 0 ? `الإجمالي: ${money(device.totalCustomer)} ${symbolOf(device.currency)}` : "",
      `المدفوع: ${money(device.amountPaid)} ${symbolOf(device.currency)}`,
      balLine,
      `━━━━━━━━━━━━`,
      `🗓️ ${fmtDate(todayStr())}`,
      `شكراً لتعاملك مع ${settings.businessName || "STAR NET"} ⭐`,
    ].filter(Boolean).join("\n");
  }
  const url = `https://wa.me/${num}?text=${encodeURIComponent(outMsg)}`;
  try {
    window.open(url, "_blank");
  } catch (e) {
    /* ignore */
  }
}

// تصدير معلومات زبون واحد (كل أجهزته ومعاملاته) إلى صفحة قابلة للطباعة/الحفظ PDF
function exportCustomerPDF(device, data, settings) {
  const norm = (s) => (s || "").trim().toLowerCase();
  const devs = data.devices.filter((d) => sameCustomer(d, device));
  const ids = new Set(devs.map((d) => d.id));
  const txs = data.transactions.filter((t) => ids.has(t.deviceId));
  const bal = customerBalance(device, data, settings.rates);
  const balLine =
    bal.net > 0
      ? `<div class="bal bal-d">💰 إجمالي المتبقي عليه (دين): ${money(bal.net)} MRU</div>`
      : bal.net < 0
      ? `<div class="bal bal-c">💳 رصيده المحفوظ لديكم: ${money(-bal.net)} MRU</div>`
      : `<div class="bal">✅ لا دين ولا رصيد — الحساب صفر</div>`;
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cur = (a, c) => `${money(a)} ${symbolOf(c)}`;
  const statusTxt = (d) => (d.broken ? "معطّل" : statusOf(d).label);

  const devCards = devs
    .map((d) => `
      <div class="card">
        <div class="cardhead">${esc(d.accountNumber || "بدون رقم حساب")} — <span>${statusTxt(d)}</span></div>
        <table>
          <tr><td>البريد</td><td>${esc(d.email || "—")}</td><td>رقم الحساب</td><td>${esc(d.accountNumber || "—")}</td></tr>
          <tr><td>مرور الواي فاي</td><td>${esc(d.wifiPassword || "—")}</td><td>مرور البريد</td><td>${esc(d.emailPassword || "—")}</td></tr>
          <tr><td>دولة الشحن</td><td>${esc(d.country || "—")}</td><td>المدة</td><td>${esc(d.durationDays || "—")} يوم</td></tr>
          <tr><td>تاريخ الشحن</td><td>${fmtDate(d.startDate)}</td><td>تاريخ الانتهاء</td><td>${fmtDate(d.endDate)}</td></tr>
          <tr><td>المطلوب</td><td>${d.totalCustomer ? cur(d.totalCustomer, d.currency) : "—"}</td><td>المدفوع</td><td>${cur(d.amountPaid, d.currency)}</td></tr>
          <tr><td>الدين المتبقي</td><td>${d.debt > 0 ? cur(d.debt, d.debtCurrency || d.currency) : "—"}</td><td>رصيده (وديعة)</td><td>${d.credit > 0 ? cur(d.credit, d.creditCurrency || d.currency) : "—"}</td></tr>
          ${asNotes(d.notes).length ? `<tr><td>ملاحظات</td><td colspan="3">${asNotes(d.notes).map(esc).join(" • ")}</td></tr>` : ""}
        </table>
      </div>`)
    .join("");

  const txRows = txs
    .map((t) => `<tr><td>${fmtDate(t.date)}</td><td>${esc(t.type)}</td><td class="${t.isExpense ? "exp" : "inc"}">${t.isExpense ? "−" : "+"}${cur(t.amount, t.currency)}</td></tr>`)
    .join("");

  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>عميل ${esc(device.customerName)} — ${esc(settings.businessName)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
*{box-sizing:border-box;font-family:'Tajawal',Tahoma,sans-serif}
body{margin:0;padding:20px;color:#111;background:#fff}
h1{font-size:22px;margin:0 0 2px}
.sub{color:#666;font-size:13px;margin-bottom:16px}
.info{background:#f4f6fb;border:1px solid #dde3ef;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:14px;line-height:1.9}
.bal{font-weight:800;font-size:16px;border-radius:10px;padding:12px 14px;margin-bottom:16px;border:1px solid #dde3ef;background:#f4f6fb}
.bal-d{color:#b91c1c;background:#fef2f2;border-color:#fecaca}
.bal-c{color:#047857;background:#ecfdf5;border-color:#a7f3d0}
.card{border:1px solid #dde3ef;border-radius:10px;padding:12px;margin-bottom:12px}
.cardhead{font-weight:800;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:6px}
.cardhead span{color:#2563eb;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:13px}
td{padding:5px 8px;border-bottom:1px dashed #eee;vertical-align:top}
td:nth-child(odd){color:#666;width:22%}
td:nth-child(even){font-weight:600}
h2{font-size:16px;margin:18px 0 8px}
.tx{width:100%;border-collapse:collapse;font-size:13px}
.tx th{background:#f4f6fb;text-align:right;padding:8px;border:1px solid #dde3ef}
.tx td{padding:7px 8px;border:1px solid #eee}
.inc{color:#16a34a;font-weight:700;direction:ltr}
.exp{color:#dc2626;font-weight:700;direction:ltr}
.btn{position:fixed;top:12px;left:12px;background:#2563eb;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:14px;font-family:inherit;cursor:pointer}
@media print{.btn{display:none}body{padding:0}}
</style></head><body>
<button class="btn" onclick="window.print()">🖨️ حفظ PDF / طباعة</button>
<h1>${esc(device.customerName)}</h1>
<div class="sub">${esc(settings.businessName)} ⭐ — ${fmtDate(todayStr())}</div>
<div class="info">
  📞 الهاتف: ${esc(device.phone || "—")}<br>
  📧 البريد: ${esc(device.email || "—")}<br>
  📦 عدد الأجهزة: ${devs.length}
</div>
${balLine}
<h2>الأجهزة</h2>
${devCards || "<p>لا أجهزة</p>"}
<h2>المعاملات (${txs.length})</h2>
<table class="tx"><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th></tr>${txRows || "<tr><td colspan=3>لا معاملات</td></tr>"}</table>
<script>setTimeout(function(){try{window.print()}catch(e){}},600)</script>
</body></html>`;

  try {
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      return true;
    }
  } catch (e) {
    /* fallback */
  }
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `عميل-${device.customerName || "بدون اسم"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   العدّاد التنازلي الحيّ (أيام/ساعات/دقائق)
   ============================================================ */
function Countdown({ endDate, broken, compact }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (broken) return <span className="sn-cd sn-cd--off">⛔ معطّل</span>;
  if (!endDate) return null;
  const d = parseDate(endDate);
  d.setHours(23, 59, 59, 999);
  let diff = d.getTime() - now;
  const past = diff < 0;
  diff = Math.abs(diff);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const cls = past ? "off" : days > 3 ? "ok" : days >= 1 ? "warn" : "urgent";
  const txt = `${days}ي ${hours}س ${mins}د`;
  return (
    <span className={"sn-cd sn-cd--" + cls + (compact ? " sn-cd--sm" : "")}>
      ⏳ {past ? `انتهى منذ ${txt}` : `${txt}`}
    </span>
  );
}

/* ============================================================
   لوحة التحكم
   ============================================================ */
function QuickLookup({ data, onWhats }) {
  const [q, setQ] = useState("");
  const t = todayStr();
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return data.devices
      .filter((d) => `${d.customerName} ${d.phone} ${d.email} ${d.accountNumber}`.toLowerCase().includes(s))
      .sort((a, b) => diffDays(t, a.endDate) - diffDays(t, b.endDate))
      .slice(0, 6);
  }, [q, data.devices]);
  return (
    <section className="sn-block">
      <h2>🔎 بحث سريع (للردّ على الزبون)</h2>
      <input
        className="sn-lookup-input"
        dir="ltr"
        placeholder="الصق إيميل الزبون أو رقمه…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim() && results.length === 0 && <p className="sn-muted-txt">لا يوجد زبون مطابق.</p>}
      {results.map((d) => {
        const s = statusOf(d);
        const dd = diffDays(t, d.endDate);
        const statusTxt = d.broken
          ? "معطّل"
          : s.key === "expired"
          ? `منتهٍ منذ ${Math.abs(dd)} يوم`
          : dd === 0
          ? "ينتهي اليوم"
          : `نشط — يتبقّى ${dd} يوم`;
        return (
          <div className="sn-lookup-row" key={d.id}>
            <div className="sn-lookup-info">
              <span className="sn-lookup-name">{d.customerName}</span>
              <span className={"sn-lookup-status sn-st-" + s.key}>
                {statusTxt}{d.debt > 0 ? ` • عليه ${money(d.debt)}` : ""}
              </span>
              <span className="sn-lookup-email" dir="ltr">{d.email || "—"}</span>
            </div>
            <button className="sn-btn sn-btn--primary sn-lookup-send" onClick={() => onWhats(d, "reminder")}>
              📤 إرسال الحالة
            </button>
          </div>
        );
      })}
    </section>
  );
}

function DueToday({ data, settings, onRenew, onWhats, onClearDebt, onMarkPaid, goDevices }) {
  const [open, setOpen] = useState(true);
  const due = useMemo(() => computeDue(data, settings), [data, settings]);
  const [notifOn, setNotifOn] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");
  if (due.total === 0) {
    return (
      <section className="sn-due sn-due--empty">
        <span>📅 تستحق اليوم</span>
        <span className="sn-due-clear">لا شيء مستحقّ اليوم — ممتاز! ✅</span>
      </section>
    );
  }
  const enableNotif = () => {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => {
      setNotifOn(p === "granted");
      if (p === "granted") {
        try { new Notification("STAR NET ⭐", { body: `لديك ${due.total} مهمّة مستحقّة اليوم` }); } catch (e) {}
      }
    });
  };
  return (
    <section className="sn-due">
      <button className="sn-due-head" onClick={() => setOpen(!open)}>
        <span>📅 تستحق اليوم <span className="sn-due-count">{due.total}</span></span>
        <span>{open ? "▾" : "◂"}</span>
      </button>
      {open && (
        <div className="sn-due-body">
          {!notifOn && typeof Notification !== "undefined" && (
            <button className="sn-due-notif" onClick={enableNotif}>🔔 تفعيل التنبيهات على الهاتف</button>
          )}
          {due.renewals.length > 0 && (
            <div className="sn-due-group">
              <div className="sn-due-glabel">🔄 تجديدات ({due.renewals.length})</div>
              {due.renewals.map(({ d, dl }) => (
                <div className="sn-due-item" key={d.id}>
                  <div className="sn-due-info">
                    <span className="sn-due-name">{d.customerName || "—"}</span>
                    <span className="sn-due-meta">{dl < 0 ? `منتهٍ منذ ${-dl}ي` : dl === 0 ? "ينتهي اليوم" : `بعد ${dl}ي`}</span>
                  </div>
                  <div className="sn-due-acts">
                    <button className="sn-due-btn sn-due-btn--wa" onClick={() => onWhats(d, "reminder")}>واتساب</button>
                    <button className="sn-due-btn sn-due-btn--go" onClick={() => onRenew(d)}>تجديد</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {due.supplier.length > 0 && (
            <div className="sn-due-group">
              <div className="sn-due-glabel">🏷️ دفعات للمورّد ({due.supplier.length})</div>
              {due.supplier.map((d) => (
                <div className="sn-due-item" key={d.id}>
                  <div className="sn-due-info">
                    <span className="sn-due-name">{d.customerName || "—"}</span>
                    <span className="sn-due-meta">{money(d.cost)}$ — موعد {fmtDate(d.supplierDueDate || d.endDate)}</span>
                  </div>
                  <div className="sn-due-acts">
                    <button className="sn-due-btn sn-due-btn--go" onClick={() => onMarkPaid(d, true)}>دفعت</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {due.debts.length > 0 && (
            <div className="sn-due-group">
              <div className="sn-due-glabel">💰 ديون العملاء ({due.debts.length})</div>
              {due.debts.map((d) => (
                <div className="sn-due-item" key={d.id}>
                  <div className="sn-due-info">
                    <span className="sn-due-name">{d.customerName || "—"}</span>
                    <span className="sn-due-meta sn-neg">{money(d.debt)} {symbolOf(d.debtCurrency || d.currency)}{debtAgeDays(d) >= 7 ? ` • متأخّر ${debtAgeDays(d)}ي` : ""}</span>
                  </div>
                  <div className="sn-due-acts">
                    <button className="sn-due-btn sn-due-btn--wa" onClick={() => onWhats(d, "reminder")}>واتساب</button>
                    <button className="sn-due-btn sn-due-btn--go" onClick={() => onClearDebt(d)}>حصّلت</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Dashboard({ data, settings, toBase, onRenew, onMarkPaid, onBroken, onClearDebt, onWhats, onAdd, goDevices }) {
  const t = todayStr();
  const stats = useMemo(() => {
    let active = 0, urgent = 0, expired = 0, debtBase = 0, supplierUnpaid = 0;
    data.devices.forEach((d) => {
      const s = statusOf(d).key;
      if (s === "expired") expired++;
      else if (s === "urgent") urgent++;
      else active++;
      if (d.debt) debtBase += toBase(d.debt, d.debtCurrency || d.currency || "MRU");
      if (!d.costPaid && d.cost && !d.broken) supplierUnpaid += toBase(d.cost, d.costCurrency || "USDT");
    });
    const month = t.slice(0, 7);
    let dayProfit = 0, monthProfit = 0, dayIncome = 0, dayExpense = 0, weekProfit = 0, weekSales = 0, weekCount = 0;
    const weekStart = addDays(t, -6);
    data.transactions.forEach((tr) => {
      const p = txProfit(tr, toBase);
      if (tr.date === t) {
        dayProfit += p;
        if (tr.isExpense) dayExpense += toBase(tr.amount, tr.currency);
        else dayIncome += toBase(tr.amount, tr.currency);
      }
      if (tr.date >= weekStart && tr.date <= t) {
        weekProfit += p;
        if (!tr.isExpense) { weekSales += toBase(tr.amount, tr.currency); weekCount++; }
      }
      if (tr.date.slice(0, 7) === month) monthProfit += p;
    });
    return { active, urgent, expired, debtBase, supplierUnpaid, dayProfit, monthProfit, dayIncome, dayExpense, weekProfit, weekSales, weekCount, total: data.devices.length };
  }, [data, toBase, t]);

  // أجهزة يجب دفع تكلفتها للمورّد (غير مدفوعة) — مرتبة بحسب قرب الموعد
  const supplierDue = data.devices
    .filter((d) => !d.costPaid && d.cost && !d.broken)
    .map((d) => ({ d, due: d.supplierDueDate || d.endDate }))
    .sort((a, b) => diffDays(t, a.due) - diffDays(t, b.due));

  // أجهزة عليها دين للزبون (لنا)
  const debtors = data.devices
    .filter((d) => d.debt > 0)
    .sort((a, b) => toBase(b.debt, b.debtCurrency || b.currency) - toBase(a.debt, a.debtCurrency || a.currency));

  const attention = data.devices
    .filter((d) => ["expired", "urgent", "soon"].includes(statusOf(d).key))
    .sort((a, b) => diffDays(t, a.endDate) - diffDays(t, b.endDate));

  return (
    <div className="sn-page">
      <DueToday data={data} settings={settings} onRenew={onRenew} onWhats={onWhats} onClearDebt={onClearDebt} onMarkPaid={onMarkPaid} goDevices={goDevices} />
      <section className="sn-profit-grid">
        <div className="sn-profit sn-profit--day">
          <span className="sn-profit-lbl">أرباح اليوم</span>
          <strong className={stats.dayProfit < 0 ? "sn-neg" : ""}>{money(stats.dayProfit)} <em>عملة</em></strong>
        </div>
        <div className="sn-profit sn-profit--month">
          <span className="sn-profit-lbl">أرباح الشهر</span>
          <strong className={stats.monthProfit < 0 ? "sn-neg" : ""}>{money(stats.monthProfit)} <em>عملة</em></strong>
        </div>
      </section>

      {settings.monthlyGoal > 0 && (
        <section className="sn-goal">
          <div className="sn-goal-top">
            <span>🎯 هدف الشهر: {money(settings.monthlyGoal)} عملة</span>
            <span className="sn-goal-pct">{Math.round(Math.max(0, stats.monthProfit) / settings.monthlyGoal * 100)}%</span>
          </div>
          <div className="sn-goal-bar"><div className="sn-goal-fill" style={{ width: Math.min(100, Math.max(0, stats.monthProfit) / settings.monthlyGoal * 100) + "%" }} /></div>
          <span className="sn-goal-sub">حقّقت {money(Math.max(0, stats.monthProfit))} — يتبقّى {money(Math.max(0, settings.monthlyGoal - stats.monthProfit))} عملة</span>
        </section>
      )}

      <section className="sn-close">
        <div className="sn-close-h">🧮 إغلاق اليوم</div>
        <div className="sn-close-grid">
          <div className="sn-close-c"><span>دخل اليوم</span><strong className="sn-pos">{money(stats.dayIncome)}</strong></div>
          <div className="sn-close-c"><span>مصروفات اليوم</span><strong className="sn-neg">{money(stats.dayExpense)}</strong></div>
          <div className="sn-close-c"><span>صافي اليوم</span><strong className={stats.dayProfit < 0 ? "sn-neg" : "sn-pos"}>{money(stats.dayProfit)}</strong></div>
        </div>
      </section>

      <section className="sn-close">
        <div className="sn-close-h">📅 ملخّص آخر ٧ أيام</div>
        <div className="sn-close-grid">
          <div className="sn-close-c"><span>المبيعات</span><strong>{money(stats.weekSales)}</strong></div>
          <div className="sn-close-c"><span>الأرباح</span><strong className={stats.weekProfit < 0 ? "sn-neg" : "sn-pos"}>{money(stats.weekProfit)}</strong></div>
          <div className="sn-close-c"><span>عمليات</span><strong>{stats.weekCount}</strong></div>
        </div>
      </section>

      <section className="sn-stats">
        <Stat n={stats.total} label="إجمالي الأجهزة" cls="t" onClick={goDevices} />
        <Stat n={stats.active} label="نشطة" cls="ok" onClick={goDevices} />
        <Stat n={stats.urgent} label="تنتهي خلال 24س" cls="warn" onClick={goDevices} />
        <Stat n={stats.expired} label="منتهية" cls="bad" onClick={goDevices} />
      </section>

      <QuickLookup data={data} onWhats={onWhats} />

      {stats.debtBase > 0 && (
        <div className="sn-debt-banner" onClick={goDevices}>
          <span>💰 ديون العملاء (لنا)</span>
          <strong>{money(stats.debtBase)} عملة</strong>
        </div>
      )}
      {stats.supplierUnpaid > 0 && (
        <div className="sn-supplier-banner">
          <span>🏷️ مستحقات المورّد (علينا)</span>
          <strong>{money(stats.supplierUnpaid)} عملة</strong>
        </div>
      )}

      <section>
        <div className="sn-sec-head">
          <h2>تحتاج إلى متابعة</h2>
          <span className="sn-count">{attention.length}</span>
        </div>
        {attention.length === 0 ? (
          <Empty
            icon="✨"
            title="كل الاشتراكات بحالة جيدة"
            sub="لا توجد أجهزة منتهية أو قريبة من الانتهاء."
          />
        ) : (
          attention.map((d) => (
            <AlertCard key={d.id} d={d} onRenew={onRenew} onBroken={onBroken} onWhats={onWhats} />
          ))
        )}
      </section>

      <section>
        <div className="sn-sec-head">
          <h2>الدفع للمورّد</h2>
          <span className="sn-count">{supplierDue.length}</span>
        </div>
        {supplierDue.length === 0 ? (
          <Empty icon="🏷️" title="لا مستحقات للمورّد" sub="كل تكاليف الأجهزة مدفوعة للمورّد." />
        ) : (
          supplierDue.map(({ d, due }) => {
            const dl = diffDays(t, due);
            const cls = dl < 0 ? "expired" : dl <= (settings.soonDays || 3) ? "urgent" : "soon";
            return (
              <div className={"sn-alert sn-alert--" + cls} key={d.id}>
                <div className="sn-alert-main">
                  <span className="sn-alert-name">{d.customerName}</span>
                  <span className="sn-alert-meta">
                    {dl < 0 ? `تأخّر ${Math.abs(dl)} يوم` : dl === 0 ? "الدفع اليوم" : `ادفع خلال ${dl} يوم`}
                    {" • "}{money(d.cost)} {symbolOf(d.costCurrency || "USDT")} • {fmtDate(due)}
                  </span>
                </div>
                <div className="sn-alert-actions">
                  <button className="sn-mini sn-mini--green" onClick={() => onMarkPaid(d, true)}>
                    دفعت
                  </button>
                  <button className="sn-mini sn-mini--gold" onClick={() => onBroken(d)}>
                    تعطّل
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section>
        <div className="sn-sec-head">
          <h2>ديون العملاء</h2>
          <span className="sn-count">{debtors.length}</span>
        </div>
        {debtors.length === 0 ? (
          <Empty icon="💰" title="لا ديون على العملاء" sub="كل العملاء سدّدوا مستحقاتهم." />
        ) : (
          debtors.map((d) => (
            <div className="sn-alert sn-alert--soon" key={d.id}>
              <div className="sn-alert-main">
                <span className="sn-alert-name">{d.customerName}</span>
                <span className="sn-alert-meta">
                  دين متبقٍّ: {money(d.debt)} {symbolOf(d.debtCurrency || d.currency)}
                </span>
              </div>
              <div className="sn-alert-actions">
                <button className="sn-mini sn-mini--green" onClick={() => onClearDebt(d)}>
                  حصّلت
                </button>
                <button className="sn-mini" onClick={() => onWhats(d, "reminder")}>
                  واتساب
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Stat({ n, label, cls, onClick }) {
  return (
    <div className={"sn-stat sn-stat--" + cls + (onClick ? " sn-stat--tap" : "")} onClick={onClick}>
      <strong>{n}</strong>
      <span>{label}{onClick ? " ›" : ""}</span>
    </div>
  );
}

function AlertCard({ d, onRenew, onBroken, onWhats }) {
  const s = statusOf(d);
  return (
    <div className={"sn-alert sn-alert--" + s.key}>
      <div className="sn-alert-main">
        <span className="sn-alert-name">{d.customerName}</span>
        <span className="sn-alert-meta">
          <Countdown endDate={d.endDate} broken={d.broken} compact /> • {fmtDate(d.endDate)}
        </span>
      </div>
      <div className="sn-alert-actions">
        <button className="sn-mini sn-mini--green" onClick={() => onRenew(d)}>
          تجديد
        </button>
        <button className="sn-mini" onClick={() => onWhats(d, "reminder")}>
          واتساب
        </button>
        {onBroken && (
          <button className="sn-mini sn-mini--gold" onClick={() => onBroken(d)}>
            تعطّل
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   قائمة الأجهزة
   ============================================================ */
// زر ميكروفون بضغط مطوّل (مثل واتساب): يسجّل أثناء الضغط ويتوقّف عند الرفع
function MicButton({ lang, label, onText }) {
  const recRef = useRef(null);
  const [rec, setRec] = useState(false);
  const start = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("البحث الصوتي غير مدعوم في هذا المتصفّح."); return; }
    try {
      const r = new SR();
      r.lang = lang;
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (ev) => {
        let txt = "";
        for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
        onText(txt.trim());
      };
      r.onend = () => setRec(false);
      r.onerror = () => setRec(false);
      recRef.current = r;
      r.start();
      setRec(true);
    } catch (e) { setRec(false); }
  };
  const stop = (e) => {
    if (e) e.preventDefault();
    try { recRef.current && recRef.current.stop(); } catch (er) {}
    setRec(false);
  };
  return (
    <button
      type="button"
      className={"sn-mic" + (rec ? " sn-mic--rec" : "")}
      title={"بحث صوتي — " + label + " (اضغط مطوّلاً)"}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      🎤<span className="sn-mic-lbl">{label}</span>
    </button>
  );
}

function Devices({ data, toBase, onEdit, onRenew, onDelete, onClearDebt, onMarkPaid, onBroken, onUnbreak, onCopy, onExport, onArchive, onInstall, onWhats }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const norm = (s) => (s || "").trim().toLowerCase();
  // عدّ التكرارات بحسب الاسم والبريد ورقم الحساب
  const counts = useMemo(() => {
    const name = {}, email = {}, acc = {};
    data.devices.forEach((d) => {
      const n = norm(d.customerName), e = norm(d.email), a = norm(d.accountNumber);
      if (n) name[n] = (name[n] || 0) + 1;
      if (e) email[e] = (email[e] || 0) + 1;
      if (a) acc[a] = (acc[a] || 0) + 1;
    });
    return { name, email, acc };
  }, [data.devices]);

  const dupReasons = (d) => {
    const r = [];
    if (norm(d.customerName) && counts.name[norm(d.customerName)] > 1) r.push("الاسم");
    if (norm(d.email) && counts.email[norm(d.email)] > 1) r.push("البريد");
    if (norm(d.accountNumber) && counts.acc[norm(d.accountNumber)] > 1) r.push("رقم الحساب");
    return r;
  };

  const list = useMemo(() => {
    const t = todayStr();
    const rates = data.settings.rates;
    const tb = (a, c) => (Number(a) || 0) * (rates[c] ?? 1);
    const devProfit = (d) =>
      data.transactions.filter((x) => x.deviceId === d.id).reduce((s, x) => s + (x.isExpense ? -tb(x.amount, x.currency) : tb(x.amount, x.currency)), 0);
    const arr = data.devices.filter((d) => {
      const k = statusOf(d).key;
      if (filter === "archived") return !!d.archived;
      if (d.archived) return false;
      if (filter === "active" && !["active", "soon"].includes(k)) return false;
      if (filter === "urgent" && k !== "urgent") return false;
      if (filter === "expired" && k !== "expired") return false;
      if (filter === "broken" && k !== "broken") return false;
      if (filter === "debt" && !d.debt) return false;
      if (filter === "supplier" && (d.costPaid || !d.cost || d.broken)) return false;
      if (filter === "loss" && devProfit(d) >= 0) return false;
      if (filter === "dup" && dupReasons(d).length === 0) return false;
      if (filter === "install" && (!d.installStatus || d.installStatus === "مكتمل")) return false;
      if (filter.startsWith("tag:") && (d.tag || "") !== filter.slice(4)) return false;
      if (filter.startsWith("pkg:") && (d.package || "") !== filter.slice(4)) return false;
      if (q) {
        const num = numberOf(d, data.personNumbers);
        const hay = `${d.customerName} ${d.phone} ${d.accountNumber} ${d.email} ${num ? "#" + num : ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    // في وضع المكرّرات نرتّب بالاسم لتتجمّع المتشابهة معاً
    if (filter === "dup") {
      return arr.sort((a, b) => norm(a.customerName).localeCompare(norm(b.customerName)));
    }
    return arr.sort((a, b) => diffDays(t, a.endDate) - diffDays(t, b.endDate));
  }, [data, q, filter, counts]);

  const filters = [
    ["all", "الكل"],
    ["active", "نشطة"],
    ["urgent", "خلال 24س"],
    ["expired", "منتهية"],
    ["debt", "دين علينا (عميل)"],
    ["supplier", "للمورّد"],
    ["loss", "📉 خسارة"],
    ["broken", "معطّلة"],
    ["dup", "🔁 مكرّرة"],
    ["install", "🚚 تركيب معلّق"],
    ["archived", "🧊 المؤرشفة"],
    ...[...new Set(data.devices.map((d) => d.tag).filter(Boolean))].map((t) => ["tag:" + t, "🏷️ " + t]),
    ...[...new Set(data.devices.map((d) => d.package).filter(Boolean))].map((p) => ["pkg:" + p, "🗂️ " + p]),
  ];

  return (
    <div className="sn-page">
      <div className="sn-search-row">
        <input
          className="sn-search"
          placeholder="🔎 بحث بالاسم أو الهاتف أو رقم الحساب…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <MicButton lang="ar-SA" label="ع" onText={setQ} />
        <MicButton lang="fr-FR" label="Fr" onText={setQ} />
      </div>
      <div className="sn-chips">
        {filters.map(([k, l]) => (
          <button
            key={k}
            className={"sn-chip" + (filter === k ? " is-active" : "")}
            onClick={() => setFilter(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {filter === "dup" && (
        <div className="sn-dup-info">
          🔁 الأجهزة التي يتكرّر اسمها أو بريدها أو رقم حسابها مع جهاز آخر ({list.length}).
        </div>
      )}

      {list.length === 0 ? (
        <Empty
          icon={filter === "dup" ? "✅" : "📭"}
          title={filter === "dup" ? "لا توجد تكرارات" : "لا توجد أجهزة"}
          sub={
            filter === "dup"
              ? "لا يوجد اسم أو بريد أو رقم حساب مكرّر."
              : q || filter !== "all"
              ? "جرّب تغيير البحث أو التصنيف."
              : "اضغط زر + لإضافة أول جهاز."
          }
        />
      ) : (
        list.map((d) => (
          <DeviceCard
            key={d.id}
            d={d}
            agents={data.agents || []}
            countries={data.countries || []}
            balance={customerBalance(d, data, data.settings.rates)}
            dupReasons={dupReasons(d)}
            personColor={colorOf(d, data.personColors)}
            personNumber={numberOf(d, data.personNumbers)}
            toBase={toBase}
            txs={data.transactions || []}
            onEdit={onEdit}
            onRenew={onRenew}
            onDelete={onDelete}
            onClearDebt={onClearDebt}
            onMarkPaid={onMarkPaid}
            onBroken={onBroken}
            onUnbreak={onUnbreak}
            onCopy={onCopy}
            onExport={onExport}
            onArchive={onArchive}
            onInstall={onInstall}
            onWhats={onWhats}
          />
        ))
      )}
    </div>
  );
}

// أيقونة صغيرة تتطلّب ضغطاً مطوّلاً (ثانية) قبل التنفيذ
function HoldIcon({ icon, title, onHold, danger }) {
  const [p, setP] = useState(0);
  const raf = useRef(null);
  const start = useRef(0);
  const stop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setP(0);
  };
  const begin = (e) => {
    e.preventDefault();
    e.stopPropagation();
    start.current = Date.now();
    const tick = () => {
      const pr = Math.min(1, (Date.now() - start.current) / 1000);
      setP(pr);
      if (pr >= 1) { stop(); onHold(); }
      else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  return (
    <button
      type="button"
      className={"sn-quick-btn" + (danger ? " sn-quick-del" : "")}
      title={title}
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      style={p > 0 ? { background: `conic-gradient(${danger ? "#f43f5e" : "var(--accent)"} ${p * 360}deg, var(--surface2) 0)` } : undefined}
    >
      {icon}
    </button>
  );
}

function CField({ k, v, danger, copy, onCopy, color, secret }) {
  const [show, setShow] = useState(false);
  const display = secret && v ? (show ? v : "••••••••") : (v || "—");
  return (
    <div className="sn-cf">
      <span className="sn-cf-k">{k}</span>
      <span className="sn-cf-v">
        <span
          className={danger ? "sn-neg" : ""}
          style={color ? { color, fontWeight: 800 } : secret ? { cursor: "pointer", letterSpacing: show ? 0 : 2 } : undefined}
          onClick={secret && v ? () => setShow((s) => !s) : undefined}
        >{display}</span>
        {secret && v && (
          <button className="sn-copy-ic" onClick={() => setShow((s) => !s)} title="إظهار/إخفاء">{show ? "🙈" : "👁️"}</button>
        )}
        {copy && onCopy && (
          <button className="sn-copy-ic" onClick={() => onCopy(copy, k)} title="نسخ" aria-label="نسخ">⎘</button>
        )}
      </span>
    </div>
  );
}

function DeviceCard({ d, agents = [], countries = [], balance, compact = false, dupReasons = [], personColor, personNumber, toBase, txs = [], onEdit, onRenew, onDelete, onClearDebt, onMarkPaid, onBroken, onUnbreak, onCopy, onExport, onArchive, onInstall, onWhats }) {
  const [open, setOpen] = useState(false);
  const [showProfit, setShowProfit] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const s = statusOf(d);
  const agent = agents.find((a) => a.id === d.agentId);
  const countryCur = d.country ? (WORLD_COUNTRIES.find((c) => c.n === d.country) || {}).c : "";
  const pc = personColor || "#4da3ff";
  const riskNoPay = d.debt > 0 && ["urgent", "soon", "expired"].includes(s.key) && !d.costPaid && d.cost > 0 && !d.broken;
  // ترتيب الجهاز ضمن أجهزة نفس الشخص
  const sameDevs = balance && balance.devices && balance.devices.length ? balance.devices : [d];
  const devIdx = sameDevs.findIndex((x) => x.id === d.id);
  const devNo = devIdx >= 0 ? devIdx + 1 : 1;
  const devCount = sameDevs.length;
  const anyLate = sameDevs.some((x) => x.debt > 0 && debtAgeDays(x) >= 14);
  const anyDebt = sameDevs.some((x) => x.debt > 0);
  const reliability = anyLate
    ? { t: "⚠️ متعثّر الدفع", c: "sn-fin--late" }
    : !anyDebt && sameDevs.some((x) => x.totalCustomer > 0)
    ? { t: "⭐ زبون موثوق", c: "sn-fin--good" }
    : null;
  const cardStyle = {};
  cardStyle.borderInlineStartColor = riskNoPay ? "#f43f5e" : pc;
  cardStyle.borderInlineStartWidth = riskNoPay ? "6px" : "5px";
  const ledger = deviceLedger(d.id, txs, toBase || ((a) => Number(a) || 0));
  // برنامج الولاء: عدد التجديدات لكل أجهزة هذا الشخص
  const personDevIds = new Set(sameDevs.map((x) => x.id));
  const renewCount = (txs || []).filter((t) => t.type === "تجديد" && personDevIds.has(t.deviceId)).length;
  const loyal = renewCount >= 5;
  const telNum = ((d.dialCode || "") + (d.phone || "")).replace(/\D/g, "");
  const copyAll = () => {
    const lines = [
      `الاسم: ${d.customerName || "—"}`,
      `الهاتف: ${d.phone || "—"}`,
      `البريد: ${d.email || "—"}`,
      `رقم الحساب: ${d.accountNumber || "—"}`,
      d.wifiPassword ? `مرور الواي فاي: ${d.wifiPassword}` : "",
      d.debt > 0 ? `الدين المتبقي: ${money(d.debt)} ${symbolOf(d.debtCurrency || d.currency)}` : "",
    ].filter(Boolean);
    onCopy(lines.join("\n"), "بيانات الجهاز");
  };
  const shareCard = async () => {
    const lines = [
      `⭐ بطاقة زبون — STAR NET`,
      `━━━━━━━━━━`,
      `👤 ${d.customerName || "—"}${personNumber ? ` (#${personNumber})` : ""}`,
      d.phone ? `📞 ${d.phone}` : "",
      d.email ? `📧 ${d.email}` : "",
      d.accountNumber ? `🔢 الحساب: ${d.accountNumber}` : "",
      d.package ? `🗂️ الباقة: ${d.package}` : "",
      d.startDate ? `📅 ${fmtDate(d.startDate)} ← ${fmtDate(d.endDate)}` : "",
      d.debt > 0 ? `💰 الدين: ${money(d.debt)} ${symbolOf(d.debtCurrency || d.currency)}` : "",
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) { /* fallback */ }
    onCopy(text, "بطاقة الزبون (نُسخت)");
  };
  return (
    <div className={"sn-card sn-card--" + s.key + (riskNoPay ? " sn-card--risk" : "")} style={cardStyle}>
      {riskNoPay && <div className="sn-risk-banner">🚫 لم يسدّد الزبون وقارب الانتهاء — لا تدفع للمورّد!</div>}
      <div className="sn-card-top" onClick={() => setOpen(!open)}>
        <div className="sn-card-id">
          <span className="sn-card-name">
            <span className="sn-agent-dot" style={{ background: pc }} />
            {personNumber ? <span className="sn-pnum">#{personNumber}</span> : null}
            {d.customerName}
            {devCount > 1 && (
              <span className="sn-dev-tag" style={{ borderColor: hexA(pc, 0.6), color: pc }}>جهاز {devNo}/{devCount}</span>
            )}
          </span>
          <span className="sn-card-sub" dir="ltr">
            {[(d.phone || "").trim(), (d.email || "").trim()].filter(Boolean).join(" · ") || "بدون رقم"}
          </span>
          <div className="sn-fin-badges">
            <span className={"sn-badge sn-badge--" + s.key}>{s.label}</span>
            {d.tag && <span className="sn-fin sn-tag-badge">🏷️ {d.tag}</span>}
            {d.package && <span className="sn-fin sn-pkg-badge">🗂️ {d.package}</span>}
            {d.installStatus && <span className={"sn-fin sn-inst-badge inst-" + (d.installStatus === "مكتمل" ? "done" : d.installStatus === "قيد التركيب" ? "prog" : "req")}>🚚 {d.installStatus}</span>}
            {loyal && <span className="sn-fin sn-fin--good">🎁 يستحق خصم ({renewCount} تجديد)</span>}
            {reliability && <span className={"sn-fin " + reliability.c}>{reliability.t}</span>}
            {dupReasons.length > 0 && (
              <span className="sn-dup-badge" title={"مكرّر: " + dupReasons.join("، ")}>🔁 مكرّر</span>
            )}
            {(d.originType || d.originNote) && (
              <span className={"sn-origin-badge sn-origin-badge--" + (d.originType || "note")}>
                {d.originType === "hadDebt" ? "⚠️ دين سابق" : d.originType === "clean" ? "✅ بلا دين" : "📌 ملاحظة"}
              </span>
            )}
            {balance && balance.count > 1 && (
              <span className={"sn-fin " + (balance.net > 0 ? "sn-fin--debt" : balance.net < 0 ? "sn-fin--cred" : "sn-fin--link")}>
                👤 نفس الزبون ({balance.count})
                {balance.net > 0 ? ` • عليه ${money(balance.net)}` : balance.net < 0 ? ` • له ${money(-balance.net)}` : ""}
              </span>
            )}
            {d.debt > 0 && (
              <span className="sn-fin sn-fin--debt" style={{ color: pc }}>💰 دين {money(d.debt)} {symbolOf(d.debtCurrency || d.currency)}</span>
            )}
            {d.debt > 0 && debtAgeDays(d) >= 7 && (
              <span className="sn-fin sn-fin--late">⏳ متأخّر {debtAgeDays(d)}ي</span>
            )}
            {d.credit > 0 && (
              <span className="sn-fin sn-fin--cred">💳 له {money(d.credit)} {symbolOf(d.creditCurrency || d.currency)}</span>
            )}
            {d.totalCustomer > 0 && !d.debt && <span className="sn-fin sn-fin--ok">✅ دفع كاملاً</span>}
            {!d.costPaid && d.cost > 0 && !d.broken && (
              <span className="sn-fin sn-fin--sup">🏷️ للمورّد {money(d.cost)}$</span>
            )}
            {d.costPaid && d.cost > 0 && <span className="sn-fin sn-fin--paid">🏷️ سُدّد للمورّد</span>}
            {d.broken && <span className="sn-fin sn-fin--brk">🔧 معطّل</span>}
          </div>
        </div>
        <div className="sn-card-status">
          <div className="sn-quick-acts" onClick={(e) => e.stopPropagation()}>
            {onEdit && <button className="sn-quick-btn" onClick={() => onEdit(d)} title="تعديل" aria-label="تعديل">✏️</button>}
            {telNum && <button className="sn-quick-btn" onClick={() => window.open("tel:" + telNum)} title="اتصال" aria-label="اتصال">📞</button>}
            {onWhats && <button className="sn-quick-btn" onClick={() => onWhats(d, "reminder")} title="واتساب" aria-label="واتساب">💬</button>}
            <button className={"sn-quick-btn" + (showProfit ? " sn-quick-on" : "")} onClick={() => setShowProfit(!showProfit)} title="الأرباح" aria-label="الأرباح">💰</button>
            {onExport && <button className="sn-quick-btn" onClick={() => onExport(d)} title="PDF" aria-label="PDF">📄</button>}
            {onDelete && <HoldIcon icon="🗑️" title="حذف (اضغط مطوّلاً)" danger onHold={() => onDelete(d)} />}
          </div>
          <Countdown endDate={d.endDate} broken={d.broken} compact />
        </div>
      </div>

      {showProfit && (
        <div className="sn-profit-panel">
          <div className="sn-profit-head">💰 سجل أرباح هذا الجهاز</div>
          {ledger.rows.length === 0 ? (
            <p className="sn-muted-txt">لا توجد عمليات بعد.</p>
          ) : (
            ledger.rows.map((r, i) => (
              <div className="sn-profit-row" key={i}>
                <span className="sn-profit-date">{fmtDate(r.date)}</span>
                <span className="sn-profit-type">{r.type}{r.isExpense ? " (للمورّد)" : ""}{r.proof ? <button className="sn-proof-ic" onClick={(e) => { e.stopPropagation(); const w = window.open(); if (w) w.document.write('<img src="' + r.proof + '" style="max-width:100%">'); }} title="عرض إثبات الدفع">📷</button> : null}</span>
                <span className={"sn-profit-amt " + (r.signed >= 0 ? "sn-pos" : "sn-neg")}>
                  {r.signed >= 0 ? "+" : ""}{money(r.signed)}
                </span>
              </div>
            ))
          )}
          <div className="sn-profit-total">
            <span>إجمالي ربح هذا الجهاز</span>
            <span className={ledger.total >= 0 ? "sn-pos" : "sn-neg"}>{ledger.total >= 0 ? "+" : ""}{money(ledger.total)} عملة</span>
          </div>
          <p className="sn-rate-hint">يُحسب بسعر الصرف الحالي. الزبون يدفع بعملته والمورّد بالدولار.</p>
        </div>
      )}

      {open && (
        <div className="sn-card-body">
          <div className="sn-grid2v">
            <CField k="تاريخ البداية" v={fmtDate(d.startDate)} />
            <CField k="تاريخ الانتهاء" v={fmtDate(d.endDate)} />
            <CField k="المدة" v={`${d.durationDays} يوم`} />
            {d.country && <CField k="دولة الشحن" v={`${d.country}${countryCur ? " (" + countryCur + ")" : ""}`} />}
            {d.totalCustomer > 0 && <CField k="المطلوب من الزبون" v={`${money(d.totalCustomer)} ${symbolOf(d.currency)}`} />}
            <CField k="ما دفعه الزبون" v={`${money(d.amountPaid)} ${symbolOf(d.currency)}`} copy={money(d.amountPaid)} onCopy={onCopy} color={pc} />
            {d.debt > 0 && <CField k="الدين المتبقي" v={`${money(d.debt)} ${symbolOf(d.debtCurrency || d.currency)}`} danger copy={money(d.debt)} onCopy={onCopy} />}
            {d.credit > 0 && <CField k="رصيد (وديعة)" v={`${money(d.credit)} ${symbolOf(d.creditCurrency || d.currency)}`} copy={money(d.credit)} onCopy={onCopy} />}
            {d.cost > 0 && <CField k="التكلفة بالدولار" v={`${money(d.cost)} $`} />}
            {d.cost > 0 && <CField k="الدفع للمورّد" v={d.broken ? "ملغى (تعطّل)" : d.costPaid ? "مدفوع ✅" : "غير مدفوع"} danger={!d.costPaid && !d.broken} />}
            {agent && <CField k="المندوب" v={`${agent.name} (${agent.percent || 0}%)`} />}
          </div>

          <button className="sn-collapse-h" onClick={() => setShowSecret(!showSecret)}>
            <span>🔐 بيانات الحساب وكلمات المرور</span>
            <span>{showSecret ? "▾" : "◂"}</span>
          </button>
          {showSecret && (
            <div className="sn-grid2v">
              <CField k="رقم الحساب" v={d.accountNumber} copy={d.accountNumber} onCopy={onCopy} />
              <CField k="البريد الإلكتروني" v={d.email} copy={d.email} onCopy={onCopy} />
              <CField k="مرور الواي فاي" v={d.wifiPassword} copy={d.wifiPassword} onCopy={onCopy} secret />
              <CField k="مرور البريد" v={d.emailPassword} copy={d.emailPassword} onCopy={onCopy} secret />
            </div>
          )}

          {(asNotes(d.notes).length > 0 || d.originType || d.originNote || (d.photos || []).length > 0 || d.audio) && (
            <button className="sn-collapse-h" onClick={() => setShowMore(!showMore)}>
              <span>📝 ملاحظات وحالة الجهاز</span>
              <span>{showMore ? "▾" : "◂"}</span>
            </button>
          )}
          {showMore && (
            <div className="sn-more-box">
              {(d.originType || d.originNote) && (
                <p className="sn-more-line">{originLabel(d.originType)}{d.originNote ? (d.originType ? " — " : "") + d.originNote : ""}</p>
              )}
              {asNotes(d.notes).length > 0 && (
                <ul className="sn-more-notes">{asNotes(d.notes).map((n, i) => <li key={i}>{n}</li>)}</ul>
              )}
              {(d.photos || []).length > 0 && (
                <div className="sn-photos">
                  {d.photos.map((src, i) => (
                    <a className="sn-photo" key={i} href={src} target="_blank" rel="noreferrer"><img src={src} alt={"صورة " + (i + 1)} /></a>
                  ))}
                </div>
              )}
              {d.audio && <audio controls src={d.audio} style={{ width: "100%", height: 36, marginTop: 8 }} />}
            </div>
          )}

          <div className="sn-card-actions sn-card-actions--bar">
            <HoldButton icon="📋" label="نسخ" variant="blue" onAct={copyAll} />
            <HoldButton icon="📲" label="مشاركة" variant="blue" onAct={shareCard} />
            <HoldButton icon="🔄" label="تجديد" variant="green" hold onAct={() => onRenew(d)} />
            <HoldButton icon="💬" label="تأكيد" onAct={() => onWhats(d, "charged")} />
            <HoldButton icon="🧾" label="إيصال" variant="blue" onAct={() => onWhats(d, "receipt")} />
            <HoldButton icon="✏️" label="تعديل" hold onAct={() => onEdit(d)} />
            {onExport && <HoldButton icon="📄" label="PDF" variant="blue" onAct={() => onExport(d)} />}
            {!compact && (
              <HoldButton icon="📲" label="مشاركة" variant="blue" onAct={() => {
                const txt = [
                  `👤 ${d.customerName || "—"}`,
                  d.phone ? `📞 ${(d.dialCode || "") + d.phone}` : "",
                  d.email ? `✉️ ${d.email}` : "",
                  d.accountNumber ? `🔢 ${d.accountNumber}` : "",
                  `📅 ${fmtDate(d.startDate)} ← ${fmtDate(d.endDate)}`,
                  d.package ? `🗂️ ${d.package}` : "",
                ].filter(Boolean).join("\n");
                if (navigator.share) navigator.share({ text: txt }).catch(() => {});
                else if (navigator.clipboard) { navigator.clipboard.writeText(txt); alert("نُسخت بطاقة الزبون ✅"); }
              }} />
            )}
            {!compact && onArchive && (
              <HoldButton icon={d.archived ? "📤" : "🧊"} label={d.archived ? "استرجاع" : "أرشفة"} hold onAct={() => onArchive(d)} />
            )}
            {!compact && onInstall && (
              <HoldButton icon="🚚" label={d.installStatus || "تركيب"} onAct={() => onInstall(d)} />
            )}
            {!compact && d.debt > 0 && <HoldButton icon="💵" label="تسديد" variant="gold" hold onAct={() => onClearDebt(d)} />}
            {!compact && d.cost > 0 && !d.broken && (
              <HoldButton icon="🏷️" label={d.costPaid ? "إلغاء دفع" : "دفعت"} variant={d.costPaid ? "def" : "green"} hold onAct={() => onMarkPaid(d, !d.costPaid)} />
            )}
            {!compact && (d.broken ? (
              <HoldButton icon="↩️" label="تشغيل" hold onAct={() => onUnbreak(d)} />
            ) : (
              <HoldButton icon="🔧" label="تعطّل" variant="gold" hold onAct={() => onBroken(d)} />
            ))}
            {!compact && <HoldButton icon="🗑️" label="حذف" variant="red" hold onAct={() => onDelete(d)} />}
          </div>
        </div>
      )}
    </div>
  );
}


function Row({ k, v, danger, onCopy, copyVal, copyLabel }) {
  const value = v || "—";
  const canCopy = onCopy && (copyVal ?? v);
  return (
    <div className="sn-row">
      <span className="sn-row-k">{k}</span>
      <span className="sn-row-vwrap">
        <span className={"sn-row-v" + (danger ? " is-danger" : "")}>{value}</span>
        {canCopy && (
          <button
            className="sn-copy"
            onClick={(e) => {
              e.stopPropagation();
              onCopy(copyVal ?? v, copyLabel || k);
            }}
          >
            نسخ
          </button>
        )}
      </span>
    </div>
  );
}

/* ============================================================
   التقارير
   ============================================================ */
function ProfitStatement({ data, toBase }) {
  const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const now = new Date();
  const [mode, setMode] = useState("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const stats = useMemo(() => {
    let income = 0, expense = 0, profit = 0, count = 0;
    const monthly = Array(12).fill(0);
    (data.transactions || []).forEach((tr) => {
      if (!tr.date) return;
      const d = parseDate(tr.date);
      const ty = d.getFullYear(), tm = d.getMonth();
      const inP = mode === "month" ? ty === year && tm === month : ty === year;
      if (ty === year) monthly[tm] += txProfit(tr, toBase);
      if (!inP) return;
      const v = toBase(tr.amount, tr.currency);
      if (tr.isExpense) expense += v; else income += v;
      profit += txProfit(tr, toBase);
      if (tr.type === "شحن") count++;
    });
    return { income, expense, profit, count, monthly };
  }, [data.transactions, toBase, mode, year, month]);
  const prev = () => {
    if (mode === "month") { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); }
    else setYear((y) => y - 1);
  };
  const next = () => {
    if (mode === "month") { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); }
    else setYear((y) => y + 1);
  };
  const maxM = Math.max(1, ...stats.monthly.map((x) => Math.abs(x)));
  return (
    <section className="sn-block">
      <h2>📑 كشف الأرباح</h2>
      <div className="sn-seg">
        <button className={mode === "month" ? "is-on" : ""} onClick={() => setMode("month")}>شهري</button>
        <button className={mode === "year" ? "is-on" : ""} onClick={() => setMode("year")}>سنوي</button>
      </div>
      <div className="sn-period-nav">
        <button onClick={prev} aria-label="السابق">‹</button>
        <span>{mode === "month" ? `${MONTHS[month]} ${year}` : `سنة ${year}`}</span>
        <button onClick={next} aria-label="التالي">›</button>
      </div>
      <div className="sn-ps-profit">
        <span>صافي الربح</span>
        <strong className={stats.profit < 0 ? "sn-neg" : ""}>{money(stats.profit)} عملة</strong>
      </div>
      <div className="sn-ps-row"><span>المبيعات (الدخل)</span><strong>{money(stats.income)} عملة</strong></div>
      <div className="sn-ps-row"><span>المصروفات (للمورّد)</span><strong>{money(stats.expense)} عملة</strong></div>
      <div className="sn-ps-row"><span>عدد عمليات الشحن</span><strong>{stats.count}</strong></div>
      {mode === "year" && (
        <div className="sn-year-bars">
          {stats.monthly.map((v, i) => (
            <div className="sn-ybar" key={i} title={`${MONTHS[i]}: ${money(v)}`}>
              <div className={"sn-ybar-fill" + (v < 0 ? " neg" : "")} style={{ height: Math.max(2, Math.round((Math.abs(v) / maxM) * 56)) }} />
              <span>{i + 1}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Reports({ data, toBase, settings }) {
  const t = todayStr();
  const month = t.slice(0, 7);

  const agg = useMemo(() => {
    let dayP = 0, monthP = 0, allP = 0, monthRevenue = 0, debt = 0, supplierUnpaid = 0;
    const byCur = {};
    const byCurExp = {};
    data.transactions.forEach((tr) => {
      const profit = txProfit(tr, toBase);
      allP += profit;
      if (tr.date === t) dayP += profit;
      if (tr.date.slice(0, 7) === month) {
        monthP += profit;
        if (!tr.isExpense) {
          monthRevenue += toBase(tr.amount, tr.currency);
          byCur[tr.currency] = (byCur[tr.currency] || 0) + (Number(tr.amount) || 0);
        } else {
          byCurExp[tr.currency] = (byCurExp[tr.currency] || 0) + (Number(tr.amount) || 0);
        }
      }
    });
    data.devices.forEach((d) => {
      if (d.debt) debt += toBase(d.debt, d.debtCurrency || d.currency || "MRU");
      if (!d.costPaid && d.cost && !d.broken) supplierUnpaid += toBase(d.cost, d.costCurrency || "USDT");
    });
    // نصيب المندوبين من الأرباح، وصافي ربحي وحدي
    let agentsShare = 0;
    (data.agents || []).forEach((a) => {
      const ap = agentProfit(a.id, data, toBase);
      if (ap > 0) agentsShare += ap * (Number(a.percent) || 0) / 100;
    });
    const myNet = allP - agentsShare;
    return { dayP, monthP, allP, monthRevenue, debt, supplierUnpaid, byCur, byCurExp, agentsShare, myNet };
  }, [data, toBase, t]);

  // أفضل الزبائن + إحصاء الدول + مقارنة الشهر بالماضي
  const extra = useMemo(() => {
    const lastMonth = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
    let monthSales = 0, lastSales = 0, monthProfit = 0, lastProfit = 0;
    data.transactions.forEach((tr) => {
      const mm = (tr.date || "").slice(0, 7);
      const p = txProfit(tr, toBase);
      if (mm === month) { monthProfit += p; if (!tr.isExpense) monthSales += toBase(tr.amount, tr.currency); }
      if (mm === lastMonth) { lastProfit += p; if (!tr.isExpense) lastSales += toBase(tr.amount, tr.currency); }
    });
    // أفضل الزبائن حسب الربح (بحسب الاسم)
    const byCust = {};
    data.transactions.forEach((tr) => {
      const nm = (tr.customerName || "").trim();
      if (!nm) return;
      byCust[nm] = (byCust[nm] || 0) + txProfit(tr, toBase);
    });
    const topCustomers = Object.entries(byCust).map(([n, v]) => ({ n, v: Math.round(v * 100) / 100 })).sort((a, b) => b.v - a.v).slice(0, 8);
    // إحصاء الدول
    const byCountry = {};
    data.devices.forEach((d) => {
      const c = d.country || "مباشر بالدولار";
      const e = byCountry[c] || { count: 0, cost: 0 };
      e.count++;
      if (d.cost) e.cost += Number(d.cost) || 0;
      byCountry[c] = e;
    });
    const countries = Object.entries(byCountry).map(([n, e]) => ({ n, count: e.count, cost: Math.round(e.cost) })).sort((a, b) => b.count - a.count);
    // الحركة حسب العملة (دون دمج العملات)
    const flowByCur = {};
    data.transactions.forEach((tr) => {
      const cur = tr.currency || "MRU";
      if (!flowByCur[cur]) flowByCur[cur] = { in: 0, out: 0 };
      if (tr.isExpense) flowByCur[cur].out += Number(tr.amount) || 0;
      else flowByCur[cur].in += Number(tr.amount) || 0;
    });
    const byCurArr = Object.entries(flowByCur).map(([cur, v]) => ({ cur, inc: v.in, out: v.out, net: v.in - v.out }));
    // الإحالات: من جلب أكثر زبائن (حسب اسم المُحيل، زبائن فريدون)
    const refMap = {};
    const refSeen = new Set();
    data.devices.forEach((d) => {
      const r = (d.referredBy || "").trim();
      if (!r) return;
      const ck = r + "|" + personKey(d);
      if (refSeen.has(ck)) return;
      refSeen.add(ck);
      refMap[r] = (refMap[r] || 0) + 1;
    });
    const referrals = Object.entries(refMap).map(([n, c]) => ({ n, c })).sort((a, b) => b.c - a.c);
    const pct = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0);
    return { monthSales, lastSales, monthProfit, lastProfit, topCustomers, countries, byCurArr, referrals, salesPct: pct(monthSales, lastSales), profitPct: pct(monthProfit, lastProfit) };
  }, [data, toBase, month]);

  // الإيميلات وعددها
  const emails = useMemo(() => {
    const map = {};
    data.devices.forEach((d) => {
      const e = (d.email || "").trim();
      if (e) map[e] = (map[e] || 0) + 1;
    });
    (data.contacts || []).forEach((c) => {
      const e = (c.email || "").trim();
      if (e && !map[e]) map[e] = 0; // إيميل محفوظ بدون شحن
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [data.devices, data.contacts]);
  const [showEmails, setShowEmails] = useState(false);

  // المعاملات مجمّعة لكل زبون (كي لا تختلط)
  const grouped = useMemo(() => {
    const g = {};
    data.transactions.forEach((tr) => {
      const key = (tr.customerName || "بدون اسم").trim();
      if (!g[key]) g[key] = { name: key, txs: [], last: tr.date };
      g[key].txs.push(tr);
      if (tr.date > g[key].last) g[key].last = tr.date;
    });
    return Object.values(g).sort((a, b) => (b.last > a.last ? 1 : b.last < a.last ? -1 : 0));
  }, [data.transactions]);

  // أرباح آخر 7 أيام للرسم البياني
  const week = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const ds = addDays(t, -i);
      let p = 0;
      data.transactions.forEach((tr) => {
        if (tr.date === ds) p += txProfit(tr, toBase);
      });
      days.push({ date: ds, profit: p });
    }
    return days;
  }, [data, toBase, t]);
  const maxP = Math.max(1, ...week.map((d) => d.profit));

  return (
    <div className="sn-page">
      <ProfitStatement data={data} toBase={toBase} />

      <section className="sn-block">
        <h2>📈 مقارنة الشهر بالماضي</h2>
        <div className="sn-cmp-grid">
          <div className="sn-cmp">
            <span>المبيعات</span>
            <strong>{money(extra.monthSales)} عملة</strong>
            <em className={extra.salesPct >= 0 ? "sn-pos" : "sn-neg"}>{extra.salesPct >= 0 ? "▲ +" : "▼ "}{extra.salesPct}%</em>
          </div>
          <div className="sn-cmp">
            <span>الأرباح</span>
            <strong className={extra.monthProfit < 0 ? "sn-neg" : ""}>{money(extra.monthProfit)} عملة</strong>
            <em className={extra.profitPct >= 0 ? "sn-pos" : "sn-neg"}>{extra.profitPct >= 0 ? "▲ +" : "▼ "}{extra.profitPct}%</em>
          </div>
        </div>
        <p className="sn-hint">مقارنةً بالشهر الماضي (مبيعاته {money(extra.lastSales)} • أرباحه {money(extra.lastProfit)} عملة).</p>
      </section>

      {extra.topCustomers.length > 0 && (
        <section className="sn-block">
          <h2>📊 أفضل الزبائن (بالربح)</h2>
          {extra.topCustomers.map((c, i) => (
            <div className="sn-rank-row" key={c.n}>
              <span className="sn-rank-no">{i + 1}</span>
              <span className="sn-rank-name">{c.n}</span>
              <span className={"sn-rank-val " + (c.v < 0 ? "sn-neg" : "sn-pos")}>{c.v >= 0 ? "+" : ""}{money(c.v)} عملة</span>
            </div>
          ))}
        </section>
      )}

      {extra.countries.length > 0 && (
        <section className="sn-block">
          <h2>🌍 إحصاء حسب الدولة</h2>
          {extra.countries.map((c) => (
            <div className="sn-rank-row" key={c.n}>
              <span className="sn-rank-name">{c.n}</span>
              <span className="sn-rank-val">{c.count} جهاز{c.cost ? ` • تكلفة ${c.cost}$` : ""}</span>
            </div>
          ))}
        </section>
      )}

      {extra.referrals.length > 0 && (
        <section className="sn-block">
          <h2>🧑‍🤝‍🧑 الإحالات (من جلب زبائن)</h2>
          {extra.referrals.map((r, i) => (
            <div className="sn-rank-row" key={r.n}>
              <span className="sn-rank-no">{i + 1}</span>
              <span className="sn-rank-name">{r.n}</span>
              <span className="sn-rank-val sn-pos">{r.c} زبون</span>
            </div>
          ))}
          <p className="sn-hint">فكرة: امنح من يجلب أكثر زبائن خصماً أو مكافأة. 🎁</p>
        </section>
      )}

      {extra.byCurArr.length > 0 && (
        <section className="sn-block">
          <h2>💵 الحركة حسب العملة (غير مدمجة)</h2>
          {extra.byCurArr.map((c) => (
            <div className="sn-rank-row" key={c.cur}>
              <span className="sn-rank-name">{symbolOf(c.cur)} {c.cur}</span>
              <span className="sn-rank-val">
                <span className="sn-pos">+{money(c.inc)}</span>
                {c.out > 0 ? <> · <span className="sn-neg">−{money(c.out)}</span></> : null}
                {" "}· صافي {money(c.net)}
              </span>
            </div>
          ))}
          <p className="sn-hint">المبالغ بكل عملة على حدة كما دخلت/خرجت فعلياً (دون تحويلها للأوقية).</p>
        </section>
      )}

      <section className="sn-profit-grid">
        <div className="sn-profit sn-profit--day">
          <span className="sn-profit-lbl">أرباح اليوم</span>
          <strong className={agg.dayP < 0 ? "sn-neg" : ""}>{money(agg.dayP)} <em>عملة</em></strong>
        </div>
        <div className="sn-profit sn-profit--month">
          <span className="sn-profit-lbl">أرباح الشهر</span>
          <strong className={agg.monthP < 0 ? "sn-neg" : ""}>{money(agg.monthP)} <em>عملة</em></strong>
        </div>
      </section>

      <div className="sn-mini-grid">
        <MiniStat label="مبيعات الشهر" val={`${money(agg.monthRevenue)} عملة`} />
        <MiniStat label="إجمالي الأرباح" val={`${money(agg.allP)} عملة`} danger={agg.allP < 0} />
        <MiniStat label="نصيب المندوبين" val={`${money(agg.agentsShare)} عملة`} danger={agg.agentsShare < 0} />
      </div>

      <div className="sn-mini-grid sn-mini-grid--2">
        <MiniStat label="صافي ربحي وحدي" val={`${money(agg.myNet)} عملة`} danger={agg.myNet < 0} />
        <MiniStat label="صافي وضعنا (بعد المورّد)" val={`${money(agg.allP - agg.supplierUnpaid)} عملة`} danger={agg.allP - agg.supplierUnpaid < 0} />
      </div>

      <div className="sn-mini-grid sn-mini-grid--2">
        <MiniStat label="دين العملاء لنا (إجمالي)" val={`${money(agg.debt)} عملة`} danger={agg.debt > 0} />
        <MiniStat label="دين علينا للمورّد (إجمالي)" val={`${money(agg.supplierUnpaid)} عملة`} danger={agg.supplierUnpaid > 0} />
      </div>

      <section className="sn-block">
        <h2>أرباح آخر 7 أيام</h2>
        <div className="sn-chart">
          {week.map((d, i) => (
            <div className="sn-bar-col" key={i}>
              <div className="sn-bar-wrap">
                <div
                  className="sn-bar"
                  style={{ height: `${Math.max(4, (d.profit / maxP) * 100)}%` }}
                  title={`${money(d.profit)} عملة`}
                />
              </div>
              <span className="sn-bar-lbl">{parseDate(d.date).getDate()}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sn-block">
        <h2>مبيعات الشهر حسب العملة</h2>
        {Object.keys(agg.byCur).length === 0 ? (
          <p className="sn-muted-txt">لا توجد معاملات هذا الشهر.</p>
        ) : (
          Object.entries(agg.byCur).map(([cur, amt]) => (
            <div className="sn-row" key={cur}>
              <span className="sn-row-k">{(CURRENCIES.find((c) => c.code === cur) || {}).label || cur}</span>
              <span className="sn-row-v">{money(amt)} {symbolOf(cur)}</span>
            </div>
          ))
        )}
      </section>

      <section className="sn-block">
        <div className="sn-sec-head" onClick={() => setShowEmails((s) => !s)} style={{ cursor: "pointer" }}>
          <h2>الإيميلات {showEmails ? "▾" : "▸"}</h2>
          <span className="sn-count">{emails.length}</span>
        </div>
        {!showEmails ? (
          <p className="sn-muted-txt">اضغط لعرض كل الإيميلات.</p>
        ) : emails.length === 0 ? (
          <p className="sn-muted-txt">لا توجد إيميلات بعد.</p>
        ) : (
          emails.map(([e, n]) => (
            <div className="sn-row" key={e}>
              <span className="sn-row-k" dir="ltr" style={{ textAlign: "right" }}>{e}</span>
              <span className="sn-row-v">{n > 0 ? `${n} جهاز` : "محفوظ"}</span>
            </div>
          ))
        )}
      </section>

      <section className="sn-block">
        <h2>المعاملات حسب الزبون</h2>
        {grouped.length === 0 ? (
          <p className="sn-muted-txt">لا توجد معاملات بعد.</p>
        ) : (
          grouped.map((g) => {
            const net = g.txs.reduce((s, tr) => s + txProfit(tr, toBase), 0);
            return (
              <div className="sn-cust-box" key={g.name}>
                <div className="sn-cust-head">
                  <span className="sn-cust-name">{g.name}</span>
                  <span className={"sn-cust-net" + (net < 0 ? " sn-neg" : "")}>صافي: {money(net)} عملة</span>
                </div>
                {g.txs.map((tr) => (
                  <div className="sn-txn" key={tr.id}>
                    <span className="sn-txn-meta">{tr.type}{tr.method ? " • " + tr.method : ""} • {fmtDate(tr.date)}</span>
                    <span className={"sn-txn-amt" + (tr.isExpense ? " sn-txn-amt--exp" : "")}>
                      {tr.isExpense ? "−" : "+"}{money(tr.amount)} {symbolOf(tr.currency)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function MiniStat({ label, val, danger }) {
  return (
    <div className="sn-ministat">
      <span>{label}</span>
      <strong className={danger ? "is-danger" : ""}>{val}</strong>
    </div>
  );
}

/* ============================================================
   نموذج إضافة / تعديل جهاز
   ============================================================ */
// منتقي دولة الشحن: بحث بالاسم أو العملة (مثل ARS) مع عرض العملة بوضوح
function CountryPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s
      ? WORLD_SORTED.filter((c) => c.n.toLowerCase().includes(s) || (c.c || "").toLowerCase().includes(s))
      : WORLD_SORTED;
    return base.slice(0, 40);
  }, [q]);
  const sel = value ? WORLD_COUNTRIES.find((c) => c.n === value) : null;
  return (
    <div className="sn-autocomplete">
      <input
        value={open ? q : value ? `${value}${sel ? " (" + sel.c + ")" : ""}` : ""}
        placeholder="ابحث عن دولة أو عملة (مثل ARS)…"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQ(""); }}
      />
      {open && (
        <div className="sn-sug-list">
          <div className="sn-sug-head">
            <span>اختر دولة الشحن</span>
            <button type="button" className="sn-sug-close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <button type="button" className="sn-sug-item sn-country-item" onClick={() => { onChange(""); setOpen(false); }}>
            <span className="sn-sug-name">— مباشرة بالدولار —</span>
            <span className="sn-cur-tag">USD</span>
          </button>
          {matches.map((c) => (
            <button type="button" className="sn-sug-item sn-country-item" key={c.n} onClick={() => { onChange(c.n); setOpen(false); }}>
              <span className="sn-sug-name">{c.n}</span>
              <span className="sn-cur-tag">{c.c}</span>
            </button>
          ))}
          {matches.length === 0 && <p className="sn-muted-txt" style={{ padding: "10px 12px" }}>لا توجد نتيجة.</p>}
        </div>
      )}
    </div>
  );
}

function DeviceForm({ initial, settings, devices = [], contacts = [], agents = [], countries = [], onSaveRate, onCancel, onSave }) {
  const isNew = !initial;
  const [f, setF] = useState(
    initial
      ? {
          ...initial,
          dialCode: initial.dialCode || "+222",
          emailPassword: initial.emailPassword || "",
          country: initial.country || "",
          costLocal: initial.costLocal ?? initial.cost ?? "",
          totalCustomer: initial.totalCustomer ?? "",
          debt: initial.debt ?? "",
          credit: initial.credit ?? "",
          payMethod: initial.payMethod || "BANKILY",
          costPaid: initial.costPaid || false,
          supplierDueDate: initial.supplierDueDate || addDays(initial.startDate, settings.supplierDays),
          originType: initial.originType || "",
          originNote: initial.originNote || "",
          tag: initial.tag || "",
          package: initial.package || "",
          referredBy: initial.referredBy || "",
          photos: initial.photos || [],
          audio: initial.audio || "",
          notes: asNotes(initial.notes),
        }
      : {
          customerName: "",
          dialCode: "+222",
          phone: "",
          email: "",
          accountNumber: "",
          wifiPassword: "",
          emailPassword: "",
          startDate: todayStr(),
          durationDays: settings.defaultDuration,
          country: "",          // دولة الشحن (سجل العملات)
          costLocal: "",        // التكلفة بعملة الدولة (أو بالدولار إن لم تُحدّد دولة)
          totalCustomer: "",    // المطلوب من الزبون (إجمالي)
          amountPaid: "",       // كم دفع الزبون
          currency: "MRU",      // عملة دفع الزبون
          debt: "",             // دين الزبون المتبقي (بعملة الدفع)
          credit: "",           // رصيد الزبون (دفع زيادة - وديعة)
          payMethod: "BANKILY", // تطبيق الدفع
          costPaid: false,      // هل دفعت للمورّد أم تسلّفت
          supplierDueDate: addDays(todayStr(), settings.supplierDays),
          originType: "",       // حالة الجهاز عند الاستلام
          originNote: "",       // ملاحظة دائمة
          photos: [],           // صور الملاحظة
          audio: "",            // مقطع صوتي
          agentId: "",          // المندوب
          tag: "",              // وسم الزبون (VIP/جملة/تجزئة)
          package: "",          // نوع الباقة
          referredBy: "",       // من أحال هذا الزبون
          notes: [],
        }
  );
  const [dueManual, setDueManual] = useState(false);
  const [debtManual, setDebtManual] = useState(false);
  const rates = settings.rates;

  const toBaseLocal = (amt, cur) => (Number(amt) || 0) * (rates[cur] ?? 1);
  // الدولة الآن اسم نصّي من قائمة العالم؛ السعر يأتي من سجل الإعدادات (إن وُجد)
  const worldCountry = f.country ? WORLD_COUNTRIES.find((c) => c.n === f.country) : null;
  const rateEntry = f.country ? countries.find((c) => c.name === f.country) : null;
  const hasRate = !!(rateEntry && Number(rateEntry.perDollar) > 0);
  const localCur = worldCountry ? worldCountry.c : "";
  // التكلفة بالدولار: من عملة الدولة ÷ سعرها (إن كان محفوظاً)، وإلا فهي مُدخلة بالدولار مباشرة
  const costUSD = f.country && hasRate
    ? (Number(f.costLocal) || 0) / Number(rateEntry.perDollar)
    : Number(f.costLocal) || 0;
  // الربح = ما دفعه الزبون − (التكلفة فقط إذا دفعتها للمورّد). لا يظهر سالباً قبل أن تدفع.
  const profitBase = toBaseLocal(f.amountPaid, f.currency) - (f.costPaid ? toBaseLocal(costUSD, "USDT") : 0);

  // دين/رصيد الزبون = المطلوب − المدفوع. إن دفع أكثر → رصيد (وديعة). تلقائي ما لم يُعدَّل.
  const recalcDebt = (draft) => {
    if (debtManual) return draft;
    const tot = Number(draft.totalCustomer) || 0;
    const paid = Number(draft.amountPaid) || 0;
    if (tot <= 0) return { ...draft, debt: 0, credit: 0 };
    const diff = Math.round((tot - paid) * 100) / 100;
    return { ...draft, debt: diff > 0 ? diff : 0, credit: diff < 0 ? -diff : 0 };
  };

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // قاعدة العملاء: كل عميل فريد بآخر جهاز له (لاستعادة بياناته)
  const [showSug, setShowSug] = useState(false);
  const customers = useMemo(() => {
    const devMap = {};
    (devices || []).forEach((d) => {
      const key = (d.customerName || "").trim();
      if (!key) return;
      const prev = devMap[key];
      if (!prev || (d.createdAt || "") > (prev.createdAt || "")) devMap[key] = d;
    });
    const out = { ...devMap };
    (contacts || []).forEach((c) => {
      const key = (c.name || "").trim();
      if (!key || out[key]) return; // الجهاز أولى لأنه يحوي آخر سعر
      out[key] = {
        id: c.id,
        customerName: c.name || "",
        dialCode: c.dialCode,
        phone: c.phone,
        email: c.email,
        accountNumber: c.accountNumber,
        wifiPassword: c.wifiPassword,
        emailPassword: c.emailPassword,
        country: c.country,
        currency: c.currency,
        payMethod: c.payMethod,
        agentId: c.agentId,
        costLocal: c.cost ?? "",
        totalCustomer: c.totalCustomer ?? "",
        createdAt: c.createdAt || "",
      };
    });
    return Object.values(out).sort((a, b) => (a.customerName || "").localeCompare(b.customerName || "", "ar"));
  }, [devices, contacts]);
  const nameMatches = useMemo(() => {
    const s = (f.customerName || "").trim().toLowerCase();
    if (!s) return customers.slice(0, 8);
    return customers.filter((d) => (d.customerName || "").toLowerCase().includes(s)).slice(0, 8);
  }, [f.customerName, customers]);
  const applyCustomer = (d) => {
    setF((p) => ({
      ...p,
      customerName: d.customerName || p.customerName,
      dialCode: d.dialCode || p.dialCode || "+222",
      phone: d.phone || "",
      email: d.email || "",
      accountNumber: d.accountNumber || "",
      wifiPassword: d.wifiPassword || "",
      emailPassword: d.emailPassword || "",
      country: d.country || "",
      costLocal: d.costLocal ?? d.cost ?? "",
      totalCustomer: d.totalCustomer ?? "",
      currency: d.currency || "MRU",
      payMethod: d.payMethod || "BANKILY",
      agentId: d.agentId || "",
    }));
    setShowSug(false);
  };
  const setCustomerMoney = (k, v) => setF((p) => recalcDebt({ ...p, [k]: v }));
  const setDebt = (v) => {
    setDebtManual(true);
    setF((p) => ({ ...p, debt: v, credit: 0 }));
  };
  const setCredit = (v) => {
    setDebtManual(true);
    setF((p) => ({ ...p, credit: v, debt: 0 }));
  };
  const setStart = (v) =>
    setF((p) => ({
      ...p,
      startDate: v,
      supplierDueDate: dueManual ? p.supplierDueDate : addDays(v, settings.supplierDays),
    }));
  const setDue = (v) => {
    setDueManual(true);
    set("supplierDueDate", v);
  };

  const addNote = () => setF((p) => ({ ...p, notes: [...p.notes, ""] }));
  const setNote = (i, v) =>
    setF((p) => ({ ...p, notes: p.notes.map((n, idx) => (idx === i ? v : n)) }));
  const removeNote = (i) =>
    setF((p) => ({ ...p, notes: p.notes.filter((_, idx) => idx !== i) }));

  // الصور (حتى 4) مع ضغطها
  const photoInput = useRef(null);
  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const cur = f.photos || [];
    const room = Math.max(0, 4 - cur.length);
    const out = [];
    for (const file of files.slice(0, room)) {
      const d = await compressImage(file);
      if (d) out.push(d);
    }
    if (out.length) setF((p) => ({ ...p, photos: [...(p.photos || []), ...out] }));
  };
  const removePhoto = (i) => setF((p) => ({ ...p, photos: (p.photos || []).filter((_, idx) => idx !== i) }));

  // التسجيل الصوتي
  const [recording, setRecording] = useState(false);
  const [recErr, setRecErr] = useState("");
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const audioInput = useRef(null);
  const startRec = async () => {
    setRecErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const r = new FileReader();
        r.onload = () => setF((p) => ({ ...p, audio: r.result }));
        r.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err) {
      setRecErr("تعذّر الوصول للميكروفون. يمكنك رفع ملف صوتي بدلاً من ذلك.");
    }
  };
  const stopRec = () => {
    try { recRef.current && recRef.current.stop(); } catch (e) {}
    setRecording(false);
  };
  const uploadAudio = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const d = await fileToDataURL(file);
    if (d) setF((p) => ({ ...p, audio: d }));
  };

  // إضافة سعر عملة الدولة بالمثال (مبلغ محلي = كم دولار) من داخل النموذج
  const [rateAmt, setRateAmt] = useState("");
  const [rateUsd, setRateUsd] = useState("");
  const saveRate = () => {
    const amt = Number(rateAmt) || 0;
    const usd = Number(rateUsd) || 0;
    if (amt <= 0 || usd <= 0 || !f.country || !onSaveRate) return;
    onSaveRate(f.country, localCur, Math.round((amt / usd) * 100) / 100);
    setRateAmt("");
    setRateUsd("");
  };

  // كشف التكرار: اسم / بريد / رقم حساب مطابق لجهاز آخر
  const dupes = useMemo(() => {
    const others = devices.filter((x) => x.id !== f.id);
    const norm = (s) => (s || "").trim().toLowerCase();
    const res = [];
    const matchNames = others.filter((x) => norm(x.customerName) && norm(x.customerName) === norm(f.customerName)).map((x) => x.customerName);
    const matchEmail = others.some((x) => norm(x.email) && norm(x.email) === norm(f.email));
    const matchAcc = others.some((x) => norm(x.accountNumber) && norm(x.accountNumber) === norm(f.accountNumber));
    if (matchNames.length) res.push("الاسم");
    if (matchEmail) res.push("البريد الإلكتروني");
    if (matchAcc) res.push("رقم الحساب");
    return res;
  }, [f.customerName, f.email, f.accountNumber, f.id, devices]);

  const endPreview = addDays(f.startDate, f.durationDays);

  const submit = () => {
    if (!f.customerName.trim()) return;
    onSave(
      {
        ...f,
        amountPaid: Number(f.amountPaid) || 0,
        totalCustomer: Number(f.totalCustomer) || 0,
        debt: Number(f.debt) || 0,
        credit: Number(f.credit) || 0,
        debtCurrency: f.currency,
        creditCurrency: f.currency,
        costLocal: Number(f.costLocal) || 0,
        cost: Math.round(costUSD * 100) / 100, // التكلفة بالدولار
        costCurrency: "USDT",
        durationDays: Number(f.durationDays) || settings.defaultDuration,
        notes: f.notes.map((n) => n.trim()).filter(Boolean),
      },
      isNew
    );
  };

  return (
    <Sheet title={isNew ? "إضافة جهاز جديد" : "تعديل الجهاز"} onClose={onCancel}>
      {dupes.length > 0 && (
        <div className="sn-dup-warn">
          ⚠️ يوجد جهاز آخر بنفس: {dupes.join("، ")}. تأكّد قبل الحفظ.
        </div>
      )}
      <Field label="اسم العميل *">
        <div className="sn-autocomplete">
          <input
            value={f.customerName}
            onChange={(e) => { set("customerName", e.target.value); setShowSug(true); }}
            onFocus={() => setShowSug(true)}
            placeholder="اكتب الاسم — تظهر أسماء العملاء السابقين"
          />
          {showSug && nameMatches.length > 0 && (
            <div className="sn-sug-list">
              <div className="sn-sug-head">
                <span>عملاء سابقون ({nameMatches.length})</span>
                <button type="button" className="sn-sug-close" onClick={() => setShowSug(false)}>✕</button>
              </div>
              {nameMatches.map((d) => (
                <button type="button" className="sn-sug-item" key={d.id} onClick={() => applyCustomer(d)}>
                  <span className="sn-sug-name">{d.customerName}</span>
                  <span className="sn-sug-sub" dir="ltr">
                    {[(d.dialCode || "") + " " + (d.phone || ""), d.email].map((x) => (x || "").trim()).filter(Boolean).join(" · ") || "—"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>
      <Field label="رقم الهاتف (رمز الدولة تلقائي)">
        <div className="sn-phone-row">
          <select className="sn-dial" value={f.dialCode || "+222"} onChange={(e) => set("dialCode", e.target.value)}>
            {DIAL_CODES.map((d) => (
              <option key={d.c} value={d.c}>{d.c} {d.n}</option>
            ))}
          </select>
          <input
            type="tel"
            dir="ltr"
            placeholder="رقم الزبون"
            value={f.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
      </Field>
      <Field label="البريد الإلكتروني (حساب ستارلينك)">
        <input dir="ltr" value={f.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="رقم الحساب">
        <input dir="ltr" value={f.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
      </Field>
      <div className="sn-grid2">
        <Field label="كلمة مرور الواي فاي">
          <input dir="ltr" value={f.wifiPassword} onChange={(e) => set("wifiPassword", e.target.value)} />
        </Field>
        <Field label="كلمة مرور البريد">
          <input dir="ltr" value={f.emailPassword} onChange={(e) => set("emailPassword", e.target.value)} />
        </Field>
      </div>
      <div className="sn-grid2">
        <Field label="تاريخ البداية">
          <input type="date" lang="en-GB" value={f.startDate} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="المدة (أيام)">
          <input type="number" value={f.durationDays} onChange={(e) => set("durationDays", e.target.value)} />
        </Field>
      </div>
      <div className="sn-end-preview">
        📅 ينتهي تلقائياً بتاريخ: <strong>{fmtDate(endPreview)}</strong>
      </div>

      {/* (1) تكلفة الشحن — بالدولار، عبر دولة الشحن وعملتها */}
      <Field label="دولة الشحن (من أين تُشحن الاشتراك)">
        <CountryPicker value={f.country} onChange={(v) => set("country", v)} />
      </Field>
      <Field
        label={
          f.country && hasRate
            ? `تكلفة الشحن (بعملة ${f.country} — ${localCur})`
            : "تكلفة الشحن (بالدولار $)"
        }
      >
        <input type="number" inputMode="decimal" value={f.costLocal} onChange={(e) => set("costLocal", e.target.value)} />
      </Field>
      {f.country && hasRate && (
        <div className="sn-end-preview">
          💵 تكلفتك بالدولار ≈ <strong>{money(costUSD)} $</strong>
          <span className="sn-rate-hint"> (حسب 1$ = {rateEntry.perDollar} {localCur})</span>
        </div>
      )}
      {f.country && (
        <div className="sn-rate-box">
          <span className="sn-rate-title">
            {hasRate ? `سعر ${localCur} محفوظ — يمكنك تعديله:` : `أدخل سعر عملة ${f.country} (${localCur}) بالمثال:`}
          </span>
          <div className="sn-rate-row">
            <input type="number" inputMode="decimal" placeholder={`مبلغ ${localCur}`} value={rateAmt} onChange={(e) => setRateAmt(e.target.value)} />
            <span className="sn-rate-eq">=</span>
            <input type="number" inputMode="decimal" placeholder="$ دولار" value={rateUsd} onChange={(e) => setRateUsd(e.target.value)} />
            <button type="button" className="sn-rate-save" disabled={!rateAmt || !rateUsd} onClick={saveRate}>حفظ</button>
          </div>
          <span className="sn-rate-hint">مثال: 63500 = 50 يعني 63500 {localCur} تساوي 50$ — وأنا أحسب السعر.</span>
        </div>
      )}

      {/* (2) دفع الزبون ودينه */}
      <Field label="المطلوب من الزبون (إجمالي السعر — بعملة الدفع)">
        <input type="number" inputMode="numeric" value={f.totalCustomer} onChange={(e) => setCustomerMoney("totalCustomer", e.target.value)} />
      </Field>
      <div className="sn-grid2">
        <Field label="كم دفع الزبون الآن">
          <input type="number" inputMode="numeric" value={f.amountPaid} onChange={(e) => setCustomerMoney("amountPaid", e.target.value)} />
        </Field>
        <Field label="عملة دفع الزبون">
          <select value={f.currency} onChange={(e) => set("currency", e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sn-grid2">
        <Field label="دين الزبون المتبقي (تلقائي)">
          <input type="number" inputMode="numeric" value={f.debt} onChange={(e) => setDebt(e.target.value)} />
        </Field>
        <Field label="رصيد الزبون (دفع زيادة)">
          <input type="number" inputMode="numeric" value={f.credit} onChange={(e) => setCredit(e.target.value)} />
        </Field>
      </div>
      <Field label="تطبيق الدفع (للمبلغ المدفوع)">
        <div className="sn-pay-apps">
          {PAYMENT_APPS.map((a) => (
            <button
              key={a}
              type="button"
              className={"sn-pay-app" + (f.payMethod === a ? " is-on" : "")}
              onClick={() => set("payMethod", a)}
            >
              {a}
            </button>
          ))}
        </div>
      </Field>

      {/* (3) الدفع للمورّد */}
      <div className="sn-supplier-box">
        <label className="sn-switch">
          <input type="checkbox" checked={f.costPaid} onChange={(e) => set("costPaid", e.target.checked)} />
          <span>دفعت التكلفة للمورّد (وإلا فهي ديْن عليك — تسلّفت)</span>
        </label>
        {!f.costPaid && (
          <div className="sn-due-field">
            <span>موعد الدفع للمورّد</span>
            <input type="date" lang="en-GB" value={f.supplierDueDate} onChange={(e) => setDue(e.target.value)} />
          </div>
        )}
      </div>

      {/* (4) الربح التلقائي */}
      <div className="sn-profit-preview">
        📈 ربح هذه العملية ≈ <strong className={profitBase < 0 ? "sn-neg" : ""}>{money(profitBase)} عملة</strong>
        <span className="sn-rate-hint"> (ما دفعه الزبون − تكلفتك)</span>
      </div>

      {/* حالة الجهاز — ملاحظة دائمة */}
      <Field label="حالة الجهاز عند استلامه (تُحفظ دائماً)">
        <select value={f.originType} onChange={(e) => set("originType", e.target.value)}>
          {ORIGIN_TYPES.map((o) => (
            <option key={o.code} value={o.code}>{o.label || "غير محدّد"}</option>
          ))}
        </select>
      </Field>
      <Field label="ملاحظة دائمة عن الجهاز (تظهر عند البحث)">
        <input value={f.originNote} onChange={(e) => set("originNote", e.target.value)} placeholder="مثال: جاءنا بدين 5$ سابق ودفعناه" />
      </Field>

      <Field label="المندوب">
        <select value={f.agentId} onChange={(e) => set("agentId", e.target.value)}>
          <option value="">— بدون مندوب —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.percent || 0}%)</option>
          ))}
        </select>
      </Field>

      <Field label="🏷️ وسم الزبون">
        <select value={f.tag || ""} onChange={(e) => set("tag", e.target.value)}>
          <option value="">— بدون وسم —</option>
          {["VIP", "جملة", "تجزئة", "جديد", "دائم"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>

      <Field label="🗂️ نوع الباقة (ماذا فعّلت له؟)">
        <select value={f.package || ""} onChange={(e) => set("package", e.target.value)}>
          <option value="">— غير محدّد —</option>
          {PACKAGES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </Field>

      <Field label="🧑‍🤝‍🧑 من أحاله؟ (اختياري)">
        <input value={f.referredBy || ""} onChange={(e) => set("referredBy", e.target.value)} placeholder="اسم من جلب هذا الزبون" />
      </Field>

      <div className="sn-media-bar">
        <button type="button" className="sn-icon-btn" onClick={addNote} title="إضافة ملاحظة">📝</button>
        <button type="button" className="sn-icon-btn" disabled={(f.photos || []).length >= 4} onClick={() => photoInput.current?.click()} title="إضافة صورة">📷</button>
        {!recording ? (
          <button type="button" className="sn-icon-btn" onClick={startRec} title="تسجيل صوت">🎙️</button>
        ) : (
          <button type="button" className="sn-icon-btn sn-rec" onClick={stopRec} title="إيقاف التسجيل">⏹️</button>
        )}
        <button type="button" className="sn-icon-btn" onClick={() => audioInput.current?.click()} title="رفع ملف صوتي">📁</button>
        {f.agentId && (() => { const ag = agents.find((a) => a.id === f.agentId); return ag ? (
          <span className="sn-icon-agent" title={"المندوب: " + ag.name} style={{ background: ag.color || "var(--accent)" }}>🤝</span>
        ) : null; })()}
      </div>
      <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
      <input ref={audioInput} type="file" accept="audio/*" hidden onChange={uploadAudio} />

      {f.notes.map((n, i) => (
        <div className="sn-note-row" key={i}>
          <input value={n} placeholder={`ملاحظة ${i + 1}`} onChange={(e) => setNote(i, e.target.value)} />
          <button type="button" className="sn-note-del" onClick={() => removeNote(i)}>✕</button>
        </div>
      ))}

      {(f.photos || []).length > 0 && (
        <div className="sn-photos">
          {(f.photos || []).map((src, i) => (
            <div className="sn-photo" key={i}>
              <img src={src} alt={"صورة " + (i + 1)} />
              <button type="button" className="sn-photo-del" onClick={() => removePhoto(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {recording && <p className="sn-hint" style={{ color: "#fb7185" }}>● جارٍ التسجيل… اضغط ⏹️ عند الانتهاء.</p>}
      {recErr && <p className="sn-hint" style={{ color: "#fb7185" }}>{recErr}</p>}
      {f.audio && (
        <div className="sn-audio-row">
          <audio controls src={f.audio} style={{ width: "100%", height: 36 }} />
          <button type="button" className="sn-note-del" onClick={() => set("audio", "")}>✕</button>
        </div>
      )}

      <div className="sn-sheet-actions">
        <button className="sn-btn sn-btn--ghost" onClick={onCancel}>إلغاء</button>
        <button className="sn-btn sn-btn--primary" onClick={submit} disabled={!f.customerName.trim()}>
          {isNew ? "إضافة الجهاز" : "حفظ التعديلات"}
        </button>
      </div>
    </Sheet>
  );
}

/* ============================================================
   نموذج التجديد
   ============================================================ */
function PaymentSheet({ device, onCancel, onConfirm }) {
  const [amount, setAmount] = useState(device.debt || "");
  const [date, setDate] = useState(todayStr());
  const [method, setMethod] = useState(PAYMENT_APPS[0]);
  const [proof, setProof] = useState("");
  const proofInput = useRef(null);
  const pickProof = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const data = await compressImage(f, 800, 0.55);
    if (data) setProof(data);
    e.target.value = "";
  };
  const cur = symbolOf(device.debtCurrency || device.currency || "MRU");
  return (
    <Sheet title={`تحصيل دفعة — ${device.customerName}`} onClose={onCancel}>
      {device.debt > 0 && (
        <div className="sn-end-preview">الدين الحالي: <strong>{money(device.debt)} {cur}</strong></div>
      )}
      <Field label={`المبلغ المدفوع (${cur})`}>
        <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="تاريخ الدفع">
        <input type="date" lang="en-GB" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="تطبيق الدفع">
        <div className="sn-pay-apps">
          {PAYMENT_APPS.map((a) => (
            <button
              key={a}
              type="button"
              className={"sn-pay-app" + (method === a ? " is-on" : "")}
              onClick={() => setMethod(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </Field>
      <Field label="📸 إثبات الدفع (اختياري)">
        {proof ? (
          <div className="sn-proof-prev"><img src={proof} alt="إثبات" /><button type="button" className="sn-mini sn-mini--red" onClick={() => setProof("")}>🗑️ إزالة</button></div>
        ) : (
          <button type="button" className="sn-btn sn-btn--ghost sn-full" onClick={() => proofInput.current?.click()}>📷 إرفاق صورة التحويل</button>
        )}
        <input ref={proofInput} type="file" accept="image/*" hidden onChange={pickProof} />
      </Field>
      <p className="sn-hint">يُسجَّل كدفعة بتاريخها وتطبيقها، ويُخصم من دين الزبون.</p>
      <div className="sn-sheet-actions">
        <button className="sn-btn sn-btn--ghost" onClick={onCancel}>إلغاء</button>
        <button
          className="sn-btn sn-btn--primary"
          disabled={!(Number(amount) > 0)}
          onClick={() => onConfirm(device, { amount, date, method, proof })}
        >
          تسجيل الدفع
        </button>
      </div>
    </Sheet>
  );
}

function SupplierPaySheet({ device, countries = [], onCancel, onConfirm }) {
  const [amount, setAmount] = useState(device.cost || "");
  const [date, setDate] = useState(todayStr());
  const [proof, setProof] = useState("");
  const proofInput = useRef(null);
  const pickProof = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const data = await compressImage(f, 800, 0.55);
    if (data) setProof(data);
    e.target.value = "";
  };
  const expected = Number(device.cost) || 0;
  const matches = Number(amount) === expected;
  const world = device.country ? WORLD_COUNTRIES.find((c) => c.n === device.country) : null;
  const localCur = world ? world.c : "";
  const rateEntry = device.country ? countries.find((c) => c.name === device.country) : null;
  const perDollar = rateEntry && Number(rateEntry.perDollar) > 0 ? Number(rateEntry.perDollar) : null;
  const localEq = perDollar ? Math.round((Number(amount) || 0) * perDollar * 100) / 100 : null;
  return (
    <Sheet title={`الدفع للمورّد — ${device.customerName}`} onClose={onCancel}>
      <div className="sn-end-preview">
        المبلغ المفترض للمورّد على هذا الجهاز: <strong>${money(expected)}</strong>
      </div>
      <Field label="المبلغ المدفوع للمورّد (بالدولار $)">
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {localEq != null && Number(amount) > 0 && (
        <div className="sn-end-preview">
          💱 ما يعادل بعملة {device.country}: <strong>{money(localEq)} {localCur}</strong>
          <span className="sn-rate-hint"> (حسب 1$ = {perDollar} {localCur})</span>
        </div>
      )}
      {!matches && Number(amount) > 0 && (
        <p className="sn-hint" style={{ color: "#fbbf24" }}>
          ⚠️ المبلغ ({money(Number(amount))}$) يختلف عن المفترض ({money(expected)}$). سيُعتمد المبلغ الذي أدخلته، وتُحدَّث تكلفة الشحن بالعملة المحلية تلقائياً.
        </p>
      )}
      <Field label="تاريخ الدفع للمورّد">
        <input type="date" lang="en-GB" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="📸 إثبات الدفع (اختياري)">
        {proof ? (
          <div className="sn-proof-prev"><img src={proof} alt="إثبات" /><button type="button" className="sn-mini sn-mini--red" onClick={() => setProof("")}>🗑️ إزالة</button></div>
        ) : (
          <button type="button" className="sn-btn sn-btn--ghost sn-full" onClick={() => proofInput.current?.click()}>📷 إرفاق صورة التحويل</button>
        )}
        <input ref={proofInput} type="file" accept="image/*" hidden onChange={pickProof} />
      </Field>
      <p className="sn-hint">تأكّد أن المبلغ بالدولار صحيح ومطابق لما دفعته فعلاً. يُسجَّل مصروفاً بهذا التاريخ.</p>
      <div className="sn-sheet-actions">
        <button className="sn-btn sn-btn--ghost" onClick={onCancel}>إلغاء</button>
        <button
          className="sn-btn sn-btn--primary"
          disabled={!(Number(amount) > 0)}
          onClick={() => onConfirm(device, { amount, date, proof })}
        >
          ✅ تأكيد الدفع للمورّد
        </button>
      </div>
    </Sheet>
  );
}

function RenewForm({ device, settings, countries = [], onSaveRate, onCancel, onConfirm }) {
  const [info, setInfo] = useState({
    date: todayStr(),
    durationDays: device.durationDays || settings.defaultDuration,
    country: device.country || "",
    costLocal: "",
    totalCustomer: "",
    amount: "",
    currency: device.currency || "MRU",
    debt: "",
    credit: "",
    costPaid: false,
    supplierDueDate: addDays(todayStr(), settings.supplierDays),
    package: device.package || "",
  });
  const [debtManual, setDebtManual] = useState(false);
  const rates = settings.rates;
  const toBaseLocal = (amt, cur) => (Number(amt) || 0) * (rates[cur] ?? 1);

  const worldCountry = info.country ? WORLD_COUNTRIES.find((c) => c.n === info.country) : null;
  const rateEntry = info.country ? countries.find((c) => c.name === info.country) : null;
  const hasRate = !!(rateEntry && Number(rateEntry.perDollar) > 0);
  const localCur = worldCountry ? worldCountry.c : "";
  const costUSD = info.country && hasRate
    ? (Number(info.costLocal) || 0) / Number(rateEntry.perDollar)
    : Number(info.costLocal) || 0;
  const profitBase = toBaseLocal(info.amount, info.currency) - (info.costPaid ? toBaseLocal(costUSD, "USDT") : 0);

  const set = (k, v) => setInfo((p) => ({ ...p, [k]: v }));
  const setCustomerMoney = (k, v) =>
    setInfo((p) => {
      const next = { ...p, [k]: v };
      if (!debtManual) {
        const tot = Number(next.totalCustomer) || 0;
        const paid = Number(next.amount) || 0;
        const diff = tot > 0 ? Math.round((tot - paid) * 100) / 100 : 0;
        next.debt = diff > 0 ? diff : 0;
        next.credit = diff < 0 ? -diff : 0;
      }
      return next;
    });
  const setDebt = (v) => {
    setDebtManual(true);
    setInfo((p) => ({ ...p, debt: v, credit: 0 }));
  };
  const setCredit = (v) => {
    setDebtManual(true);
    setInfo((p) => ({ ...p, credit: v, debt: 0 }));
  };
  const endPreview = addDays(info.date, info.durationDays);

  const [rateAmt, setRateAmt] = useState("");
  const [rateUsd, setRateUsd] = useState("");
  const saveRate = () => {
    const amt = Number(rateAmt) || 0;
    const usd = Number(rateUsd) || 0;
    if (amt <= 0 || usd <= 0 || !info.country || !onSaveRate) return;
    onSaveRate(info.country, localCur, Math.round((amt / usd) * 100) / 100);
    setRateAmt("");
    setRateUsd("");
  };

  return (
    <Sheet title={`تجديد (عملية جديدة) — ${device.customerName}`} onClose={onCancel}>
      <p className="sn-hint">يُسجَّل تجديداً كاملاً: شحن جديد بتاريخ جديد + تكلفة + دفع الزبون + ربح.</p>
      <div className="sn-grid2">
        <Field label="تاريخ الشحن">
          <input type="date" lang="en-GB" value={info.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="المدة (أيام)">
          <input type="number" value={info.durationDays} onChange={(e) => set("durationDays", e.target.value)} />
        </Field>
      </div>
      <div className="sn-end-preview">
        📅 ينتهي الاشتراك الجديد بتاريخ: <strong>{fmtDate(endPreview)}</strong>
      </div>

      <Field label="🗂️ الباقة المُفعّلة هذه المرّة">
        <select value={info.package || ""} onChange={(e) => set("package", e.target.value)}>
          <option value="">— غير محدّد —</option>
          {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="دولة الشحن">
        <CountryPicker value={info.country} onChange={(v) => set("country", v)} />
      </Field>
      <Field label={info.country && hasRate ? `تكلفة الشحن (بعملة ${info.country} — ${localCur})` : "تكلفة الشحن (بالدولار $)"}>
        <input type="number" inputMode="decimal" value={info.costLocal} onChange={(e) => set("costLocal", e.target.value)} />
      </Field>
      {info.country && hasRate && (
        <div className="sn-end-preview">💵 تكلفتك بالدولار ≈ <strong>{money(costUSD)} $</strong></div>
      )}
      {info.country && (
        <div className="sn-rate-box">
          <span className="sn-rate-title">
            {hasRate ? `سعر ${localCur} محفوظ — يمكنك تعديله:` : `أدخل سعر عملة ${info.country} (${localCur}) بالمثال:`}
          </span>
          <div className="sn-rate-row">
            <input type="number" inputMode="decimal" placeholder={`مبلغ ${localCur}`} value={rateAmt} onChange={(e) => setRateAmt(e.target.value)} />
            <span className="sn-rate-eq">=</span>
            <input type="number" inputMode="decimal" placeholder="$ دولار" value={rateUsd} onChange={(e) => setRateUsd(e.target.value)} />
            <button type="button" className="sn-rate-save" disabled={!rateAmt || !rateUsd} onClick={saveRate}>حفظ</button>
          </div>
        </div>
      )}

      <Field label="المطلوب من الزبون (إجمالي — بعملة الدفع)">
        <input type="number" inputMode="numeric" value={info.totalCustomer} onChange={(e) => setCustomerMoney("totalCustomer", e.target.value)} />
      </Field>
      <div className="sn-grid2">
        <Field label="كم دفع الزبون الآن">
          <input type="number" inputMode="numeric" value={info.amount} onChange={(e) => setCustomerMoney("amount", e.target.value)} />
        </Field>
        <Field label="عملة الدفع">
          <select value={info.currency} onChange={(e) => set("currency", e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sn-grid2">
        <Field label="دين الزبون المتبقي (تلقائي)">
          <input type="number" inputMode="numeric" value={info.debt} onChange={(e) => setDebt(e.target.value)} />
        </Field>
        <Field label="رصيد الزبون (دفع زيادة)">
          <input type="number" inputMode="numeric" value={info.credit} onChange={(e) => setCredit(e.target.value)} />
        </Field>
      </div>

      <div className="sn-supplier-box">
        <label className="sn-switch">
          <input type="checkbox" checked={info.costPaid} onChange={(e) => set("costPaid", e.target.checked)} />
          <span>دفعت التكلفة للمورّد (وإلا فهي ديْن عليك)</span>
        </label>
        {!info.costPaid && (
          <div className="sn-due-field">
            <span>موعد الدفع للمورّد</span>
            <input type="date" lang="en-GB" value={info.supplierDueDate} onChange={(e) => set("supplierDueDate", e.target.value)} />
          </div>
        )}
      </div>

      <div className="sn-profit-preview">
        📈 ربح هذا التجديد ≈ <strong className={profitBase < 0 ? "sn-neg" : ""}>{money(profitBase)} عملة</strong>
      </div>

      <div className="sn-sheet-actions">
        <button className="sn-btn sn-btn--ghost" onClick={onCancel}>إلغاء</button>
        <button
          className="sn-btn sn-btn--primary"
          onClick={() =>
            onConfirm(device, {
              ...info,
              durationDays: Number(info.durationDays) || settings.defaultDuration,
              cost: Math.round(costUSD * 100) / 100,
            })
          }
        >
          تأكيد التجديد
        </button>
      </div>
    </Sheet>
  );
}

/* ============================================================
   المندوبون (الوسطاء)
   ============================================================ */
// ربح المندوب = (ما حصّلته فعلاً من الزبون) − (التكلفة المدفوعة للمورّد فقط). متسق مع حسابك النقدي.
function agentProfit(agentId, data, toBase) {
  let profit = 0;
  (data.devices || []).forEach((d) => {
    if (d.agentId !== agentId || d.broken) return;
    const collected = toBase(Number(d.amountPaid) || 0, d.currency || "MRU");
    const cost = d.costPaid ? toBase(Number(d.cost) || 0, d.costCurrency || "USDT") : 0;
    profit += collected - cost;
  });
  return Math.round(profit * 100) / 100;
}

function Agents({ data, toBase, onAddAgent, onEditAgent, onDeleteAgent, onViewAgent, onSettle }) {
  const agents = data.agents || [];
  const payouts = data.agentPayouts || [];
  return (
    <div className="sn-page">
      <button className="sn-btn sn-btn--primary sn-full" onClick={onAddAgent}>
        + إضافة مندوب
      </button>
      {agents.length === 0 ? (
        <Empty
          icon="🤝"
          title="لا يوجد مندوبون"
          sub="أضف من يجلب لك العملاء، وحدّد نسبة ربحه، لتُسجَّل أجهزته باسمه."
        />
      ) : (
        agents.map((a) => {
          const profit = agentProfit(a.id, data, toBase);
          const share = (profit * (Number(a.percent) || 0)) / 100;
          const paid = payouts.filter((p) => p.agentId === a.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const remain = Math.round((share - paid) * 100) / 100;
          const count = data.devices.filter((d) => d.agentId === a.id).length;
          return (
            <div className="sn-agent-card" key={a.id}>
              <div className="sn-agent-top">
                <div>
                  <span className="sn-agent-name">
                    {a.color && <span className="sn-agent-dot" style={{ background: a.color }} />}
                    {a.name}
                  </span>
                  <span className="sn-agent-sub">{count} جهاز • نسبة {a.percent || 0}%</span>
                </div>
                <div className="sn-agent-share">
                  <span>نصيبه</span>
                  <strong className={share < 0 ? "sn-neg" : ""}>{money(share)} عملة</strong>
                </div>
              </div>
              <div className="sn-agent-figs">
                <span className={profit < 0 ? "sn-neg" : ""}>ربح أجهزته: {money(profit)} عملة</span>
                <span>سُلّم له: {money(paid)} عملة</span>
                <span className={remain > 0 ? "sn-neg" : "sn-pos"}>{remain > 0 ? `تدين له بـ ${money(remain)}` : remain < 0 ? `زائد ${money(-remain)}` : "مُسوّى ✓"} عملة</span>
              </div>
              <div className="sn-card-actions">
                {onSettle && remain > 0 && (
                  <button
                    className="sn-mini sn-mini--green"
                    onClick={() => {
                      const v = window.prompt(`كم سلّمت للمندوب ${a.name}؟ (المتبقّي ${money(remain)})`, String(Math.round(remain)));
                      if (v != null && Number(v) > 0) onSettle(a, Number(v));
                    }}
                  >
                    💵 سلّمت نصيبه
                  </button>
                )}
                <button className="sn-mini sn-mini--blue" onClick={() => onViewAgent(a)}>
                  📋 أجهزته
                </button>
                <button className="sn-mini" onClick={() => onEditAgent(a)}>
                  ✏️ النسبة/الاسم
                </button>
                <button className="sn-mini sn-mini--red" onClick={() => onDeleteAgent(a)}>
                  🗑️ حذف
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ContactForm({ initial, agents = [], onCancel, onSave }) {
  const isNew = !initial;
  const [c, setC] = useState({
    name: initial?.name || "",
    dialCode: initial?.dialCode || "+222",
    phone: initial?.phone || "",
    email: initial?.email || "",
    accountNumber: initial?.accountNumber || "",
    wifiPassword: initial?.wifiPassword || "",
    emailPassword: initial?.emailPassword || "",
    country: initial?.country || "",
    currency: initial?.currency || "MRU",
    totalCustomer: initial?.totalCustomer ?? "",
    cost: initial?.cost ?? "",
    costCurrency: initial?.costCurrency || "USDT",
    payMethod: initial?.payMethod || "BANKILY",
    agentId: initial?.agentId || "",
    note: initial?.note || "",
  });
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  return (
    <Sheet title={isNew ? "إضافة عميل للدفتر" : "تعديل عميل"} onClose={onCancel}>
      <p className="sn-hint">احفظ بيانات الزبون (إيميله وحسابه…) دون عملية شحن. تظهر تلقائياً عند إضافة جهاز له لاحقاً.</p>
      <Field label="اسم العميل *">
        <input value={c.name} onChange={(e) => set("name", e.target.value)} placeholder="اسم الزبون" />
      </Field>
      <Field label="رقم الهاتف">
        <div className="sn-phone-row">
          <select className="sn-dial" value={c.dialCode} onChange={(e) => set("dialCode", e.target.value)}>
            {DIAL_CODES.map((d) => (
              <option key={d.c} value={d.c}>{d.c} {d.n}</option>
            ))}
          </select>
          <input type="tel" dir="ltr" placeholder="رقم الزبون" value={c.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </Field>
      <Field label="البريد الإلكتروني (حساب ستارلينك)">
        <input dir="ltr" value={c.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" />
      </Field>
      <Field label="رقم الحساب">
        <input dir="ltr" value={c.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
      </Field>
      <div className="sn-grid2">
        <Field label="كلمة مرور الواي فاي">
          <input dir="ltr" value={c.wifiPassword} onChange={(e) => set("wifiPassword", e.target.value)} />
        </Field>
        <Field label="كلمة مرور البريد">
          <input dir="ltr" value={c.emailPassword} onChange={(e) => set("emailPassword", e.target.value)} />
        </Field>
      </div>
      <Field label="عملة الدفع المعتادة">
        <select value={c.currency} onChange={(e) => set("currency", e.target.value)}>
          {CURRENCIES.map((cur) => (
            <option key={cur.code} value={cur.code}>{cur.label}</option>
          ))}
        </select>
      </Field>
      <Field label="سعر الشحن المعتاد (المطلوب من الزبون)">
        <input type="number" inputMode="decimal" value={c.totalCustomer} onChange={(e) => set("totalCustomer", e.target.value)} placeholder="بعملة الدفع المختارة أعلاه" />
      </Field>
      <Field label="تكلفة الشحن (للمورّد) — اختياري">
        <div className="sn-phone-row">
          <select className="sn-dial" value={c.costCurrency} onChange={(e) => set("costCurrency", e.target.value)}>
            {CURRENCIES.map((cur) => (
              <option key={cur.code} value={cur.code}>{cur.code}</option>
            ))}
          </select>
          <input type="number" inputMode="decimal" value={c.cost} onChange={(e) => set("cost", e.target.value)} placeholder="مبلغ التكلفة" />
        </div>
      </Field>
      <Field label="المندوب">
        <select value={c.agentId} onChange={(e) => set("agentId", e.target.value)}>
          <option value="">— بدون مندوب —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.percent || 0}%)</option>
          ))}
        </select>
      </Field>
      <Field label="ملاحظة (اختياري)">
        <input value={c.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
      <div className="sn-sheet-actions">
        <button className="sn-btn sn-btn--ghost" onClick={onCancel}>إلغاء</button>
        <button
          className="sn-btn sn-btn--primary"
          disabled={!c.name.trim()}
          onClick={() => onSave({ ...c, id: initial?.id, name: c.name.trim() })}
        >
          {isNew ? "حفظ في الدفتر" : "حفظ التعديلات"}
        </button>
      </div>
    </Sheet>
  );
}

function CountryForm({ initial, onCancel, onSave }) {
  const isNew = !initial;
  const [name, setName] = useState(initial?.name || "");
  const [currency, setCurrency] = useState(initial?.currency || "");
  const [amt, setAmt] = useState("");
  const [usd, setUsd] = useState("");
  const pickName = (n) => {
    setName(n);
    const w = WORLD_COUNTRIES.find((c) => c.n === n);
    if (w) setCurrency(w.c);
  };
  const perDollar = Number(amt) > 0 && Number(usd) > 0 ? Math.round((Number(amt) / Number(usd)) * 100) / 100 : (initial?.perDollar || 0);
  return (
    <Sheet title={isNew ? "إضافة سعر دولة" : "تعديل سعر الدولة"} onClose={onCancel}>
      <Field label="الدولة *">
        <select value={name} onChange={(e) => pickName(e.target.value)}>
          <option value="">— اختر الدولة —</option>
          {WORLD_SORTED.map((c) => (
            <option key={c.n} value={c.n}>{c.n} ({c.c})</option>
          ))}
        </select>
      </Field>
      <Field label="رمز العملة">
        <input value={currency} onChange={(e) => setCurrency(e.target.value)} />
      </Field>
      <Field label={`أدخل بالمثال: كم ${currency || "عملة"} = كم دولار`}>
        <div className="sn-rate-row">
          <input type="number" inputMode="decimal" placeholder={`مبلغ ${currency || ""}`} value={amt} onChange={(e) => setAmt(e.target.value)} />
          <span className="sn-rate-eq">=</span>
          <input type="number" inputMode="decimal" placeholder="$ دولار" value={usd} onChange={(e) => setUsd(e.target.value)} />
        </div>
      </Field>
      {perDollar > 0 && (
        <p className="sn-hint">السعر المحسوب: 1$ = {perDollar} {currency}</p>
      )}
      <div className="sn-sheet-actions">
        <button className="sn-btn sn-btn--ghost" onClick={onCancel}>إلغاء</button>
        <button
          className="sn-btn sn-btn--primary"
          disabled={!name.trim() || !perDollar}
          onClick={() => onSave({ id: initial?.id, name: name.trim(), currency: currency.trim(), perDollar })}
        >
          {isNew ? "إضافة" : "حفظ"}
        </button>
      </div>
    </Sheet>
  );
}

function AgentForm({ initial, onCancel, onSave }) {
  const isNew = !initial;
  const [name, setName] = useState(initial?.name || "");
  const [percent, setPercent] = useState(initial?.percent ?? 33);
  const [color, setColor] = useState(initial?.color || AGENT_COLORS[0]);
  return (
    <Sheet title={isNew ? "إضافة مندوب" : "تعديل المندوب"} onClose={onCancel}>
      <Field label="اسم المندوب *">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="نسبة ربحه (%)">
        <input
          type="number"
          inputMode="numeric"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
        />
      </Field>
      <Field label="لون المندوب (يميّز أجهزته)">
        <div className="sn-swatches">
          {AGENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={"sn-swatch" + (color === c ? " is-on" : "")}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </Field>
      <div className="sn-sheet-actions">
        <button className="sn-btn sn-btn--ghost" onClick={onCancel}>إلغاء</button>
        <button
          className="sn-btn sn-btn--primary"
          disabled={!name.trim()}
          onClick={() =>
            onSave({ id: initial?.id, name: name.trim(), percent: Number(percent) || 0, color })
          }
        >
          {isNew ? "إضافة" : "حفظ"}
        </button>
      </div>
    </Sheet>
  );
}

function AgentDevices({ agent, data, toBase, onClose, onEdit, onRenew, onCopy, onWhats }) {
  const list = data.devices.filter((d) => d.agentId === agent.id);
  const profit = agentProfit(agent.id, data, toBase);
  const share = (profit * (Number(agent.percent) || 0)) / 100;
  return (
    <Sheet title={`أجهزة ${agent.name}`} onClose={onClose}>
      <div className="sn-agent-summary">
        <div><span>الأجهزة</span><strong>{list.length}</strong></div>
        <div><span>ربح أجهزته</span><strong className={profit < 0 ? "sn-neg" : ""}>{money(profit)} عملة</strong></div>
        <div><span>نصيبه ({agent.percent || 0}%)</span><strong className={share < 0 ? "sn-neg" : ""}>{money(share)} عملة</strong></div>
      </div>
      {list.length === 0 ? (
        <Empty icon="📭" title="لا أجهزة لهذا المندوب" sub="اربط جهازاً بهذا المندوب من نموذج الجهاز." />
      ) : (
        list.map((d) => (
          <DeviceCard
            key={d.id}
            d={d}
            agents={data.agents || []}
            countries={data.countries || []}
            balance={customerBalance(d, data, data.settings.rates)}
            compact
            personColor={colorOf(d, data.personColors)}
            personNumber={numberOf(d, data.personNumbers)}
            toBase={toBase}
            txs={data.transactions || []}
            onEdit={onEdit}
            onRenew={onRenew}
            onCopy={onCopy}
            onWhats={onWhats}
          />
        ))
      )}
    </Sheet>
  );
}

/* ============================================================
   أدوات (تُفتح من القائمة الجانبية)
   ============================================================ */
function CalendarPanel({ data }) {
  const now = new Date();
  const [base, setBase] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selDay, setSelDay] = useState(null);
  const first = new Date(base.y, base.m, 1);
  const daysInMonth = new Date(base.y, base.m + 1, 0).getDate();
  const startWeekday = first.getDay();
  const monthStr = `${base.y}-${String(base.m + 1).padStart(2, "0")}`;
  const byDay = {};
  (data.devices || []).forEach((d) => {
    if (d.broken) return;
    const e = d.endDate || "";
    if (e.slice(0, 7) === monthStr) {
      const day = Number(e.slice(8, 10));
      (byDay[day] = byDay[day] || []).push(d);
    }
  });
  const monthName = first.toLocaleDateString("ar", { month: "long", year: "numeric" });
  const move = (n) => { setSelDay(null); setBase((b) => { const d = new Date(b.y, b.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); };
  const wd = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
  const todayN = (now.getFullYear() === base.y && now.getMonth() === base.m) ? now.getDate() : -1;
  return (
    <>
      <div className="sn-cal-nav">
        <button onClick={() => move(-1)}>‹</button>
        <span>{monthName}</span>
        <button onClick={() => move(1)}>›</button>
      </div>
      <div className="sn-cal-grid sn-cal-head">{wd.map((w) => <span key={w} className="sn-cal-wd">{w}</span>)}</div>
      <div className="sn-cal-grid">
        {Array.from({ length: startWeekday }).map((_, i) => <span key={"b" + i} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const list = byDay[day] || [];
          return (
            <button
              key={day}
              className={"sn-cal-day" + (day === todayN ? " is-today" : "") + (selDay === day ? " is-sel" : "") + (list.length ? " has" : "")}
              onClick={() => setSelDay(selDay === day ? null : day)}
            >
              <span>{day}</span>
              {list.length > 0 && <span className="sn-cal-badge">{list.length}</span>}
            </button>
          );
        })}
      </div>
      {selDay && (
        <div className="sn-cal-list">
          <div className="sn-cal-list-h">تجديدات يوم {selDay}/{base.m + 1}</div>
          {(byDay[selDay] || []).length === 0 ? (
            <p className="sn-muted-txt">لا تجديدات هذا اليوم.</p>
          ) : (
            (byDay[selDay] || []).map((d) => (
              <div className="sn-cal-item" key={d.id}>
                <span>{d.customerName || "—"}</span>
                <span className="sn-cal-item-sub">{d.phone || d.email || "—"}</span>
              </div>
            ))
          )}
        </div>
      )}
      <p className="sn-hint">الأرقام الحمراء = عدد الاشتراكات المنتهية في ذلك اليوم. اضغط يوماً لرؤية الأسماء.</p>
    </>
  );
}

function OrdersPanel({ data, onAdd, onCycle, onDelete }) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const orders = data.orders || [];
  const pending = orders.filter((o) => o.status !== "منفّذ").length;
  const stColor = (s) => (s === "منفّذ" ? "inst-done" : s === "قيد التنفيذ" ? "inst-prog" : "inst-req");
  const add = () => { if (!customerName.trim() && !phone.trim()) return; onAdd({ customerName, phone, note }); setCustomerName(""); setPhone(""); setNote(""); };
  return (
    <>
      <p className="sn-hint" style={{ marginTop: 0 }}>سجّل طلبات الزبائن المنتظرة (جهاز/خدمة) وتابعها حتى التنفيذ.</p>
      <Field label="اسم الزبون"><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field>
      <Field label="الهاتف"><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <Field label="تفاصيل الطلب"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: جهاز Mini + تفعيل" /></Field>
      <button className="sn-btn sn-btn--primary sn-full" onClick={add}>➕ إضافة طلب</button>
      <p className="sn-hint">قيد الانتظار: <strong>{pending}</strong> من {orders.length}. اضغط الحالة لتغييرها.</p>
      {orders.length === 0 ? (
        <p className="sn-muted-txt">لا طلبات بعد.</p>
      ) : (
        orders.map((o) => (
          <div className="sn-inv-row" key={o.id}>
            <div className="sn-inv-info">
              <span className="sn-inv-name">{o.customerName || "—"} {o.phone ? <span className="sn-inv-sub">📞 {o.phone}</span> : null}</span>
              <span className="sn-inv-sub">{o.note || ""} • {fmtDate(o.date)}</span>
            </div>
            <div className="sn-inv-acts">
              <button className={"sn-fin sn-inst-badge " + stColor(o.status)} onClick={() => onCycle(o.id)}>{o.status}</button>
              <button className="sn-mini sn-mini--red" onClick={() => onDelete(o.id)}>🗑️</button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

function WalletsPanel({ data, toBase }) {
  // الزبائن الذين لديهم رصيد محفوظ (credit) أو دين، حسب الرصيد الصافي
  const seen = new Set();
  const rows = [];
  (data.devices || []).forEach((d) => {
    const key = personKey(d);
    if (seen.has(key)) return;
    seen.add(key);
    const bal = customerBalance(d, data, data.settings.rates);
    if (Math.abs(bal.net) >= 1) rows.push({ name: d.customerName, net: bal.net });
  });
  const credits = rows.filter((r) => r.net < 0).sort((a, b) => a.net - b.net);
  const debts = rows.filter((r) => r.net > 0).sort((a, b) => b.net - a.net);
  const totCredit = credits.reduce((s, r) => s - r.net, 0);
  const totDebt = debts.reduce((s, r) => s + r.net, 0);
  return (
    <>
      <p className="sn-hint" style={{ marginTop: 0 }}>الرصيد الصافي لكل زبون: الأخضر رصيد محفوظ لديك له، والأحمر دين عليه.</p>
      <div className="sn-calc-out">
        <div className="sn-calc-row"><span>🪙 إجمالي الأرصدة المحفوظة</span><strong className="sn-pos">{money(totCredit)} عملة</strong></div>
        <div className="sn-calc-row"><span>💰 إجمالي الديون</span><strong className="sn-neg">{money(totDebt)} عملة</strong></div>
      </div>
      {credits.length > 0 && <div className="sn-cal-list-h">🪙 أرصدة محفوظة ({credits.length})</div>}
      {credits.map((r, i) => (
        <div className="sn-rank-row" key={"c" + i}><span className="sn-rank-name">{r.name}</span><span className="sn-rank-val sn-pos">{money(-r.net)} عملة</span></div>
      ))}
      {debts.length > 0 && <div className="sn-cal-list-h">💰 ديون ({debts.length})</div>}
      {debts.map((r, i) => (
        <div className="sn-rank-row" key={"d" + i}><span className="sn-rank-name">{r.name}</span><span className="sn-rank-val sn-neg">{money(r.net)} عملة</span></div>
      ))}
      {rows.length === 0 && <p className="sn-muted-txt">لا أرصدة ولا ديون حالياً.</p>}
    </>
  );
}

function InventoryPanel({ data, onAdd, onAdjust, onDelete, onSell }) {
  const [cat, setCat] = useState("device");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [costCurrency, setCostCurrency] = useState("USDT");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("MRU");
  const items = (data.inventory || []).filter((it) => it.category === cat);
  const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const add = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), category: cat, qty, cost, costCurrency, price, currency });
    setName(""); setQty("1"); setCost(""); setPrice("");
  };
  return (
    <>
      <div className="sn-inv-tabs">
        <button className={cat === "device" ? "is-on" : ""} onClick={() => setCat("device")}>📡 أجهزة</button>
        <button className={cat === "accessory" ? "is-on" : ""} onClick={() => setCat("accessory")}>🔌 اكسسوارات</button>
      </div>
      <Field label={cat === "device" ? "اسم الجهاز" : "اسم الاكسسوار"}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={cat === "device" ? "مثال: Starlink Mini" : "مثال: كابل / راوتر / حامل"} />
      </Field>
      <div className="sn-grid2">
        <Field label="الكمية"><input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="سعر البيع">
          <input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
      <div className="sn-grid2">
        <Field label="عملة البيع">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select>
        </Field>
        <Field label="تكلفة الشراء (للوحدة)"><input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
      </div>
      <Field label="عملة التكلفة">
        <select value={costCurrency} onChange={(e) => setCostCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select>
      </Field>
      <button className="sn-btn sn-btn--primary sn-full" disabled={!name.trim()} onClick={add}>➕ إضافة للمخزون</button>

      <p className="sn-hint">إجمالي الكمية في {cat === "device" ? "الأجهزة" : "الاكسسوارات"}: <strong>{totalQty}</strong> قطعة. زر «بيع» يخصم قطعة ويسجّل الربح تلقائياً.</p>

      {items.length === 0 ? (
        <p className="sn-muted-txt">لا أصناف بعد في هذه الفئة.</p>
      ) : (
        items.map((it) => (
          <div className="sn-inv-row" key={it.id}>
            <div className="sn-inv-info">
              <span className="sn-inv-name">{it.name} <span className={"sn-inv-qty" + (it.qty <= 0 ? " out" : "")}>{it.qty} قطعة</span></span>
              <span className="sn-inv-sub">بيع {money(it.price)} {symbolOf(it.currency)}{it.cost ? ` • تكلفة ${money(it.cost)} ${symbolOf(it.costCurrency)}` : ""}</span>
            </div>
            <div className="sn-inv-acts">
              <button className="sn-mini sn-mini--green" disabled={it.qty <= 0} onClick={() => { const c = window.prompt("اسم المشتري (اختياري):", "") || ""; onSell(it, c); }}>🛒 بيع</button>
              <button className="sn-mini" onClick={() => onAdjust(it.id, 1)} title="زيادة">➕</button>
              <button className="sn-mini" onClick={() => onAdjust(it.id, -1)} title="إنقاص">➖</button>
              <button className="sn-mini sn-mini--red" onClick={() => onDelete(it.id)}>🗑️</button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

function ServicesPanel({ data, toBase, onAdd, onDelete }) {
  const SERVICES = ["تفعيل جهاز", "تعديل جهاز", "توثيق جهاز", "استرداد جهاز", "تغيير البريد", "إعادة ضبط", "أخرى"];
  const [service, setService] = useState(SERVICES[0]);
  const [custom, setCustom] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("MRU");
  const [cost, setCost] = useState("");
  const [costCurrency, setCostCurrency] = useState("MRU");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const incomes = (data.transactions || []).filter((t) => t.type === "خدمة");
  const costFor = (svcId) => (data.transactions || []).find((t) => t.type === "تكلفة خدمة" && t.svcId === svcId);
  const month = todayStr().slice(0, 7);
  let totalProfit = 0, monthProfit = 0;
  incomes.forEach((t) => {
    const c = costFor(t.svcId);
    const p = toBase(t.amount, t.currency) - (c ? toBase(c.amount, c.currency) : 0);
    totalProfit += p;
    if ((t.date || "").slice(0, 7) === month) monthProfit += p;
  });
  const add = () => {
    if (!(Number(amount) > 0)) return;
    const svc = service === "أخرى" ? (custom.trim() || "خدمة") : service;
    onAdd({ service: svc, customerName, amount, currency, cost, costCurrency, note, date });
    setAmount(""); setCost(""); setNote(""); setCustom(""); setCustomerName("");
  };
  return (
    <>
      <p className="sn-hint" style={{ marginTop: 0 }}>سجّل أي خدمة تقدّمها (تفعيل، توثيق، استرداد…) بسعرها وتكلفتها، فتُحسب أرباحها مع أرباحك.</p>
      <Field label="نوع الخدمة">
        <select value={service} onChange={(e) => setService(e.target.value)}>
          {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      {service === "أخرى" && (
        <Field label="اسم الخدمة"><input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="اكتب اسم الخدمة" /></Field>
      )}
      <Field label="اسم الزبون (اختياري)"><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field>
      <div className="sn-grid2">
        <Field label="السعر (ما تتقاضاه)"><input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="عملة السعر">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="sn-grid2">
        <Field label="تكلفتك (اختياري)"><input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="عملة التكلفة">
          <select value={costCurrency} onChange={(e) => setCostCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="ملاحظة (اختياري)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Field label="التاريخ"><input type="date" lang="en-GB" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <button className="sn-btn sn-btn--primary sn-full" disabled={!(Number(amount) > 0)} onClick={add}>➕ تسجيل الخدمة</button>

      <div className="sn-calc-out" style={{ marginTop: 12 }}>
        <div className="sn-calc-row"><span>أرباح خدمات هذا الشهر</span><strong className={monthProfit < 0 ? "sn-neg" : "sn-pos"}>{money(monthProfit)} عملة</strong></div>
        <div className="sn-calc-row sn-calc-total"><span>إجمالي أرباح الخدمات</span><strong className={totalProfit < 0 ? "sn-neg" : "sn-pos"}>{money(totalProfit)} عملة</strong></div>
      </div>

      {incomes.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="sn-cal-list-h">سجل الخدمات ({incomes.length})</div>
          {incomes.map((t) => {
            const c = costFor(t.svcId);
            const prof = toBase(t.amount, t.currency) - (c ? toBase(c.amount, c.currency) : 0);
            return (
              <div className="sn-trash-row" key={t.svcId || t.id}>
                <div>
                  <span className="sn-trash-name">{t.service}{t.customerName ? ` — ${t.customerName}` : ""}</span>
                  <span className="sn-trash-sub">{money(t.amount)} {symbolOf(t.currency)}{c ? ` − تكلفة ${money(c.amount)} ${symbolOf(c.currency)}` : ""} • ربح {money(prof)} • {fmtDate(t.date)}</span>
                </div>
                <button className="sn-mini sn-mini--red" onClick={() => onDelete(t.svcId)}>🗑️</button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ExpensesPanel({ data, toBase, onAdd, onDelete }) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("MRU");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const list = (data.transactions || []).filter((t) => t.type === "مصروف عام");
  const totalBase = list.reduce((s, t) => s + toBase(t.amount, t.currency), 0);
  const month = todayStr().slice(0, 7);
  const monthBase = list.filter((t) => (t.date || "").slice(0, 7) === month).reduce((s, t) => s + toBase(t.amount, t.currency), 0);
  const add = () => {
    if (!(Number(amount) > 0)) return;
    onAdd({ amount, currency, note, date });
    setAmount(""); setNote("");
  };
  return (
    <>
      <p className="sn-hint" style={{ marginTop: 0 }}>مصاريفك خارج المورّد (إنترنت، نقل، هاتف…). تُخصم من صافي ربحك في الرئيسية والتقارير.</p>
      <div className="sn-grid2">
        <Field label="المبلغ"><input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="العملة">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="الوصف (اختياري)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: اشتراك إنترنت" /></Field>
      <Field label="التاريخ"><input type="date" lang="en-GB" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <button className="sn-btn sn-btn--primary sn-full" disabled={!(Number(amount) > 0)} onClick={add}>➕ إضافة مصروف</button>
      <div className="sn-calc-out" style={{ marginTop: 12 }}>
        <div className="sn-calc-row"><span>مصروفات هذا الشهر</span><strong className="sn-neg">{money(monthBase)} عملة</strong></div>
        <div className="sn-calc-row"><span>إجمالي كل المصروفات</span><strong className="sn-neg">{money(totalBase)} عملة</strong></div>
      </div>
      {list.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {list.map((t) => (
            <div className="sn-trash-row" key={t.id}>
              <div>
                <span className="sn-trash-name">{money(t.amount)} {symbolOf(t.currency)}</span>
                <span className="sn-trash-sub">{t.note || "مصروف"} • {fmtDate(t.date)}</span>
              </div>
              <button className="sn-mini sn-mini--red" onClick={() => onDelete(t.id)}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ConvertPanel({ rates }) {
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("USDT");
  const [to, setTo] = useState("MRU");
  const base = (Number(amount) || 0) * (rates[from] ?? 1);
  const out = base / (rates[to] ?? 1);
  const swap = () => { setFrom(to); setTo(from); };
  return (
    <>
      <p className="sn-hint" style={{ marginTop: 0 }}>تحويل سريع بين العملات حسب أسعارك في الإعدادات.</p>
      <Field label="المبلغ"><input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <div className="sn-grid2">
        <Field label="من"><select value={from} onChange={(e) => setFrom(e.target.value)}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
        <Field label="إلى"><select value={to} onChange={(e) => setTo(e.target.value)}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
      </div>
      <button className="sn-btn sn-full" onClick={swap}>🔁 عكس الاتجاه</button>
      <div className="sn-calc-out" style={{ marginTop: 12 }}>
        <div className="sn-calc-row sn-calc-total"><span>الناتج</span><strong className="sn-pos">{money(out)} {symbolOf(to)}</strong></div>
        <div className="sn-calc-row"><span>بالأوقية (الأساس)</span><strong>{money(base)} MRU</strong></div>
      </div>
    </>
  );
}

function PriceCalc({ rates }) {
  const [cost, setCost] = useState("");
  const [margin, setMargin] = useState("30");
  const [cur, setCur] = useState("MRU");
  const usd = Number(rates.USDT) || 430;
  const cRate = Number(rates[cur]) || 1;
  const costCustomer = (Number(cost) || 0) * usd / cRate;
  const m = Number(margin) || 0;
  const price = costCustomer * (1 + m / 100);
  const profit = price - costCustomer;
  return (
    <>
      <Field label="التكلفة (بالدولار $)">
        <input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="مثال: 56" />
      </Field>
      <div className="sn-grid2">
        <Field label="هامش الربح %">
          <input type="number" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
        </Field>
        <Field label="عملة الزبون">
          <select value={cur} onChange={(e) => setCur(e.target.value)}>
            {CURRENCIES.filter((c) => c.code !== "USDT").map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </Field>
      </div>
      {Number(cost) > 0 && (
        <div className="sn-calc-out">
          <div className="sn-calc-row"><span>التكلفة بعملة الزبون</span><strong>{money(costCustomer)} {symbolOf(cur)}</strong></div>
          <div className="sn-calc-row"><span>الربح ({m}%)</span><strong className="sn-pos">+{money(profit)} {symbolOf(cur)}</strong></div>
          <div className="sn-calc-row sn-calc-total"><span>💹 السعر المقترح للزبون</span><strong>{money(price)} {symbolOf(cur)}</strong></div>
        </div>
      )}
      <p className="sn-hint">يُحسب بسعر الصرف المحفوظ (1$ = {usd} MRU). عدّل الأسعار من الإعدادات ← أسعار العملة الأساس.</p>
    </>
  );
}

function ToolsPanel({ kind, data, toBase, onClose, onAddCountry, onEditCountry, onDeleteCountry, onAddContact, onEditContact, onDeleteContact, onImportExcel, onImport, onRestoreTrash, onPurgeTrash, onEmptyTrash, onRestoreAuto, onAddExpense, onDeleteExpense, onAddService, onDeleteService, onAddInv, onAdjustInv, onDeleteInv, onSellInv, onAddOrder, onCycleOrder, onDeleteOrder }) {
  const fileRef = useRef(null);
  const excelRef = useRef(null);
  const EXCEL_HEADERS = [
    "اسم العميل", "رمز الدولة", "رقم الهاتف", "البريد الإلكتروني", "رقم الحساب",
    "كلمة مرور الواي فاي", "كلمة مرور البريد", "تاريخ البداية", "مدة الأيام", "الدولة",
    "تكلفة الشحن بالدولار", "المطلوب من الزبون", "المدفوع", "العملة", "تطبيق الدفع",
    "دفعت للمورد", "ملاحظة",
  ];
  const HEADER_MAP = {
    "اسم العميل": "customerName", "الاسم": "customerName",
    "رمز الدولة": "dialCode", "رقم الهاتف": "phone", "الهاتف": "phone",
    "البريد الإلكتروني": "email", "البريد": "email", "الايميل": "email", "الإيميل": "email",
    "رقم الحساب": "accountNumber", "الحساب": "accountNumber",
    "كلمة مرور الواي فاي": "wifiPassword", "كلمة مرور البريد": "emailPassword",
    "تاريخ البداية": "startDate", "البداية": "startDate",
    "مدة الأيام": "durationDays", "المدة": "durationDays",
    "الدولة": "country",
    "تكلفة الشحن بالدولار": "cost", "التكلفة": "cost", "تكلفة الشحن": "cost",
    "المطلوب من الزبون": "totalCustomer", "المطلوب": "totalCustomer", "الإجمالي": "totalCustomer",
    "المدفوع": "amountPaid", "العملة": "currency",
    "تطبيق الدفع": "payMethod", "دفعت للمورد": "costPaid", "دفعت للمورّد": "costPaid",
    "ملاحظة": "note", "ملاحظات": "note",
  };
  const downloadTemplate = () => {
    if (!window.XLSX) { alert("أعد فتح التطبيق مع الإنترنت أولاً لتفعيل ميزة Excel."); return; }
    const example = ["محمد الأمين", "+222", "44123456", "mohamed@mail.com", "ACC-1001", "wifi1234", "", "01/06/2026", 28, "", 12, 5000, 5000, "MRU", "BANKILY", "نعم", "زبون قديم"];
    const ws = window.XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, example]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "الأجهزة");
    window.XLSX.writeFile(wb, "نموذج_استيراد_الأجهزة.xlsx");
  };
  const handleExcel = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!window.XLSX) { alert("أعد فتح التطبيق مع الإنترنت أولاً لتفعيل ميزة Excel."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = window.XLSX.read(new Uint8Array(ev.target.result), { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = window.XLSX.utils.sheet_to_json(ws, { defval: "" });
        const rows = raw.map((row) => {
          const out = {};
          Object.keys(row).forEach((h) => {
            const key = HEADER_MAP[String(h).trim()];
            if (key) out[key] = row[h];
          });
          return out;
        });
        onImportExcel(rows);
        onClose();
      } catch (err) {
        alert("تعذّر قراءة الملف. تأكّد أنه ملف Excel صحيح بنفس أعمدة القالب.");
      }
    };
    reader.readAsArrayBuffer(file);
  };
  const exportExcel = () => {
    if (!window.XLSX) { alert("أعد فتح التطبيق مع الإنترنت أولاً لتفعيل ميزة Excel."); return; }
    const rows = (data.devices || []).map((d) => ({
      "اسم العميل": d.customerName || "",
      "رمز الدولة": d.dialCode || "",
      "رقم الهاتف": d.phone || "",
      "البريد الإلكتروني": d.email || "",
      "رقم الحساب": d.accountNumber || "",
      "كلمة مرور الواي فاي": d.wifiPassword || "",
      "كلمة مرور البريد": d.emailPassword || "",
      "تاريخ البداية": fmtDate(d.startDate),
      "مدة الأيام": d.durationDays || "",
      "الدولة": d.country || "",
      "تكلفة الشحن بالدولار": d.cost || 0,
      "المطلوب من الزبون": d.totalCustomer || 0,
      "المدفوع": d.amountPaid || 0,
      "العملة": d.currency || "MRU",
      "تطبيق الدفع": d.payMethod || "",
      "دفعت للمورد": d.costPaid ? "نعم" : "لا",
      "ملاحظة": (d.notes || []).join(" | "),
    }));
    const ws = window.XLSX.utils.json_to_sheet(rows, { header: EXCEL_HEADERS });
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "الأجهزة");
    window.XLSX.writeFile(wb, `اجهزة_STARNET_${todayStr()}.xlsx`);
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `starnet-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const shareData = async () => {
    const json = JSON.stringify(data, null, 2);
    const name = `starnet-backup-${todayStr()}.json`;
    try {
      const file = new File([json], name, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "نسخة STAR NET الاحتياطية" });
        return;
      }
    } catch (e) { if (e && e.name === "AbortError") return; }
    try {
      if (navigator.share) { await navigator.share({ title: "نسخة STAR NET", text: json }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    exportData();
  };
  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.devices) { onImport({ ...DEFAULT_DATA, ...parsed }); onClose(); }
      } catch (err) { /* ملف غير صالح */ }
    };
    reader.readAsText(file);
  };

  const titles = {
    countries: "💱 سجل عملات الدول",
    contacts: "📒 دفتر العملاء",
    excel: "📊 استيراد / تصدير Excel",
    calc: "💹 حاسبة سعر البيع",
    convert: "💱 محوّل العملات",
    calendar: "🗓️ تقويم التجديدات",
    services: "🛠️ الخدمات",
    inventory: "📦 المخزون",
    orders: "📋 قائمة الطلبات",
    wallets: "🪙 محافظ الزبائن",
    expenses: "💸 المصروفات العامة",
    backup: "☁️ النسخ الاحتياطي ودرايف",
    trash: "🗑️ سلة المحذوفات",
  };

  return (
    <Sheet title={titles[kind] || "أدوات"} onClose={onClose}>
      {kind === "calc" && <PriceCalc rates={data.settings.rates} />}
      {kind === "convert" && <ConvertPanel rates={data.settings.rates} />}
      {kind === "services" && <ServicesPanel data={data} toBase={toBase} onAdd={onAddService} onDelete={onDeleteService} />}
      {kind === "inventory" && <InventoryPanel data={data} onAdd={onAddInv} onAdjust={onAdjustInv} onDelete={onDeleteInv} onSell={onSellInv} />}
      {kind === "orders" && <OrdersPanel data={data} onAdd={onAddOrder} onCycle={onCycleOrder} onDelete={onDeleteOrder} />}
      {kind === "wallets" && <WalletsPanel data={data} toBase={toBase} />}
      {kind === "calendar" && <CalendarPanel data={data} />}
      {kind === "expenses" && <ExpensesPanel data={data} toBase={toBase} onAdd={onAddExpense} onDelete={onDeleteExpense} />}
      {kind === "countries" && (
        <>
          <p className="sn-hint" style={{ marginTop: 0 }}>الدول التي تشحن منها وسعر عملتها مقابل الدولار. تُستخدم لحساب تكلفة الشحن بالدولار تلقائياً.</p>
          {(data.countries || []).map((c) => (
            <div className="sn-country-row" key={c.id}>
              <div>
                <span className="sn-country-name">{c.name}</span>
                <span className="sn-country-sub">1$ = {c.perDollar} {c.currency}</span>
              </div>
              <div className="sn-country-acts">
                <button className="sn-mini" onClick={() => onEditCountry(c)}>✏️</button>
                <button className="sn-mini sn-mini--red" onClick={() => onDeleteCountry(c)}>🗑️</button>
              </div>
            </div>
          ))}
          <button className="sn-btn sn-btn--primary sn-full" onClick={onAddCountry} style={{ marginTop: 10 }}>+ إضافة دولة/عملة</button>
        </>
      )}

      {kind === "contacts" && (
        <>
          <p className="sn-hint" style={{ marginTop: 0 }}>احفظ بيانات عملائك (الإيميل، الحساب…) دون عملية شحن. تظهر تلقائياً في خانة الاسم عند «إضافة جهاز».</p>
          {(data.contacts || []).length === 0 && <p className="sn-muted-txt">لا يوجد عملاء محفوظون بعد.</p>}
          {(data.contacts || []).map((c) => (
            <div className="sn-country-row" key={c.id}>
              <div style={{ minWidth: 0 }}>
                <span className="sn-country-name">{c.name}</span>
                <span className="sn-country-sub" dir="ltr" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[(c.dialCode || "") + " " + (c.phone || ""), c.email].map((x) => (x || "").trim()).filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
              <div className="sn-country-acts">
                <button className="sn-mini" onClick={() => onEditContact(c)}>✏️</button>
                <button className="sn-mini sn-mini--red" onClick={() => onDeleteContact(c)}>🗑️</button>
              </div>
            </div>
          ))}
          <button className="sn-btn sn-btn--primary sn-full" onClick={onAddContact} style={{ marginTop: 10 }}>+ إضافة عميل (بدون شحن)</button>
        </>
      )}

      {kind === "excel" && (
        <>
          <p className="sn-hint" style={{ marginTop: 0 }}>استورد أجهزتك من ملف Excel (كل صف = جهاز) أو صدّر أجهزتك الحالية إلى ملف Excel.</p>
          <ol className="sn-steps">
            <li>للاستيراد: نزّل القالب واملأه، «اسم العميل» إلزامي.</li>
            <li>التاريخ يوم/شهر/سنة. العملة: MRU أو USDT أو FCFA. «دفعت للمورد»: نعم/لا.</li>
          </ol>
          <button className="sn-btn sn-btn--ghost sn-full" onClick={downloadTemplate} style={{ marginBottom: 8 }}>⬇️ تنزيل القالب الفارغ</button>
          <button className="sn-btn sn-btn--primary sn-full" onClick={() => excelRef.current?.click()} style={{ marginBottom: 8 }}>⬆️ استيراد من Excel</button>
          <button className="sn-btn sn-btn--ghost sn-full" onClick={exportExcel}>📊 تصدير الأجهزة إلى Excel ({(data.devices || []).length})</button>
          <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleExcel} />
        </>
      )}

      {kind === "backup" && (
        <>
          <div className="sn-grid2">
            <button className="sn-btn sn-btn--ghost" onClick={exportData}>⬇️ تصدير ملف</button>
            <button className="sn-btn sn-btn--ghost" onClick={() => fileRef.current?.click()}>⬆️ استيراد ملف</button>
          </div>
          <button className="sn-btn sn-btn--primary sn-full" style={{ marginTop: 10 }} onClick={shareData}>📤 مشاركة النسخة (إلى درايف…)</button>
          {onRestoreAuto && (
            <button className="sn-btn sn-btn--ghost sn-full" style={{ marginTop: 10 }} onClick={onRestoreAuto}>
              ☁️ استعادة آخر نسخة تلقائية
            </button>
          )}
          <button
            className="sn-btn sn-btn--ghost sn-full"
            style={{ marginTop: 10 }}
            onClick={() => {
              const ok = copyToClipboard(JSON.stringify(data));
              alert(ok ? "تم نسخ بيانات المزامنة — أرسلها للهاتف الآخر والصقها في «استيراد من نص»." : "تعذّر النسخ");
            }}
          >
            📋 نسخ بيانات المزامنة (نص)
          </button>
          <button
            className="sn-btn sn-btn--ghost sn-full"
            style={{ marginTop: 10 }}
            onClick={() => {
              const txt = window.prompt("الصق نص بيانات المزامنة هنا:");
              if (!txt) return;
              try {
                const parsed = JSON.parse(txt);
                if (parsed && parsed.devices) { onImport({ ...DEFAULT_DATA, ...parsed }); onClose(); }
                else alert("النص غير صالح.");
              } catch (e) { alert("النص غير صالح."); }
            }}
          >
            📥 استيراد من نص (مزامنة بين هاتفين)
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
          <p className="sn-hint">للمزامنة بين هاتفين: في الأول «📋 نسخ بيانات المزامنة»، أرسل النص (واتساب مثلاً)، وفي الثاني «📥 استيراد من نص». للحفظ على درايف: «📤 مشاركة النسخة» ← Google Drive. (المزامنة التلقائية اللحظية تحتاج خادماً — في التطبيق الثاني.)</p>
        </>
      )}

      {kind === "trash" && (
        <>
          {(data.trash || []).length === 0 ? (
            <p className="sn-hint" style={{ marginTop: 0 }}>لا عناصر محذوفة. عند حذف جهاز يُنقل هنا ويمكن استعادته.</p>
          ) : (
            <>
              {(data.trash || []).map((item) => (
                <div className="sn-trash-row" key={item.device.id}>
                  <div>
                    <span className="sn-trash-name">{item.device.customerName || "بدون اسم"}</span>
                    <span className="sn-trash-sub">{item.device.accountNumber || item.device.phone || "—"} • حُذف {fmtDate(item.deletedAt)}</span>
                  </div>
                  <div className="sn-trash-acts">
                    <button className="sn-mini sn-mini--green" onClick={() => onRestoreTrash(item)}>استعادة</button>
                    <button className="sn-mini sn-mini--red" onClick={() => onPurgeTrash(item)}>حذف نهائي</button>
                  </div>
                </div>
              ))}
              <button className="sn-btn sn-btn--ghost sn-full" style={{ marginTop: 10 }} onClick={onEmptyTrash}>إفراغ السلة نهائياً</button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/* ============================================================
   الإعدادات
   ============================================================ */
function Settings({ settings, onSave, onReset }) {
  const [s, setS] = useState(settings);
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));
  const setRate = (cur, v) =>
    setS((p) => ({ ...p, rates: { ...p.rates, [cur]: Number(v) || 0 } }));

  return (
    <div className="sn-page">
      <section className="sn-block">
        <h2>إعدادات عامة</h2>
        <Field label="اسم النشاط">
          <input value={s.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </Field>
        <Field label="المدة الافتراضية للاشتراك (أيام)">
          <input type="number" value={s.defaultDuration} onChange={(e) => set("defaultDuration", Number(e.target.value) || 28)} />
        </Field>
        <Field label="مهلة الدفع للمورّد (أيام من بداية الاشتراك)">
          <input type="number" value={s.supplierDays} onChange={(e) => set("supplierDays", Number(e.target.value) || 23)} />
        </Field>
        <Field label="🎯 هدف ربح الشهر (بالأوقية — 0 = بلا هدف)">
          <input type="number" value={s.monthlyGoal || 0} onChange={(e) => set("monthlyGoal", Number(e.target.value) || 0)} />
        </Field>
        <label className="sn-switch-row">
          <span>🔊 أصوات التطبيق (دفع / شحن / حفظ)</span>
          <input
            type="checkbox"
            checked={s.sounds !== false}
            onChange={(e) => { set("sounds", e.target.checked); setSoundOn(e.target.checked); if (e.target.checked) playSound("save"); }}
          />
        </label>
        <label className="sn-switch-row">
          <span>🔒 قفل التطبيق برمز سرّي</span>
          <input
            type="checkbox"
            checked={!!s.pin}
            onChange={(e) => {
              if (e.target.checked) {
                const p = (window.prompt("اختر رمزاً سرّياً (4 إلى 6 أرقام):") || "").replace(/\D/g, "").slice(0, 6);
                if (p.length >= 4) set("pin", p);
                else if (p) window.alert("الرمز يجب أن يكون 4 أرقام على الأقل.");
              } else {
                set("pin", "");
              }
            }}
          />
        </label>
        {s.pin && (
          <button
            type="button"
            className="sn-btn sn-btn--ghost sn-full"
            onClick={() => {
              const p = (window.prompt("الرمز الجديد (4 إلى 6 أرقام):") || "").replace(/\D/g, "").slice(0, 6);
              if (p.length >= 4) set("pin", p);
              else if (p) window.alert("الرمز يجب أن يكون 4 أرقام على الأقل.");
            }}
          >
            🔑 تغيير الرمز السرّي
          </button>
        )}
      </section>

      <section className="sn-block">
        <h2>أسعار العملة الأساس (الأوقية)</h2>
        <div className="sn-grid2">
          <Field label="سعر الدولار: 1 دولار = ؟ أوقية">
            <input type="number" value={s.rates.USDT} onChange={(e) => setRate("USDT", e.target.value)} />
          </Field>
          <Field label="سعر سيفا: 1 سيفا = ؟ أوقية">
            <input type="number" value={s.rates.FCFA} onChange={(e) => setRate("FCFA", e.target.value)} />
          </Field>
        </div>
        <p className="sn-hint">تتحكّم بها في توحيد الأرباح والديون. الأوقية (MRU) = 1 (الأساس).</p>
        <button
          type="button"
          className="sn-btn sn-btn--ghost sn-full"
          onClick={async () => {
            try {
              const res = await fetch("https://open.er-api.com/v6/latest/USD");
              const j = await res.json();
              const r = j && j.rates ? j.rates : null;
              if (!r || !r.MRU) { alert("تعذّر جلب الأسعار. تأكّد من الإنترنت."); return; }
              const usdToMru = r.MRU;
              const xof = r.XOF || r.XAF;
              setS((p) => ({
                ...p,
                rates: {
                  ...p.rates,
                  USDT: Math.round(usdToMru * 100) / 100,
                  FCFA: xof ? Math.round((usdToMru / xof) * 1000) / 1000 : p.rates.FCFA,
                },
              }));
              alert(`تم التحديث:\n1$ = ${Math.round(usdToMru)} أوقية` + (xof ? `\n1 فرنك = ${(usdToMru / xof).toFixed(3)} أوقية` : "") + "\nلا تنسَ «حفظ الإعدادات».");
            } catch (e) {
              alert("تعذّر جلب الأسعار. تأكّد من الإنترنت.");
            }
          }}
        >
          💱 جلب أسعار الصرف تلقائياً من الإنترنت
        </button>
      </section>

      <section className="sn-block">
        <h2>رسائل واتساب</h2>
        <p className="sn-hint">المتغيرات: {"{name}"} • {"{email}"} • {"{account}"} • {"{start}"} (تاريخ الشحن) • {"{end}"} (الانتهاء) • {"{remaining}"} (الوقت المتبقّي/منذ الانتهاء) • {"{debt}"} (الدين) • {"{debtline}"} • {"{creditline}"} (الرصيد) • {"{wifi}"}</p>
        <Field label="رسالة تأكيد الشحن">
          <textarea rows={6} value={s.msgCharged} onChange={(e) => set("msgCharged", e.target.value)} />
        </Field>
        <Field label="رسالة تذكير التجديد">
          <textarea rows={6} value={s.msgReminder} onChange={(e) => set("msgReminder", e.target.value)} />
        </Field>
        <button
          className="sn-btn sn-btn--ghost sn-full"
          onClick={() => setS((p) => ({ ...p, msgCharged: DEFAULT_DATA.settings.msgCharged, msgReminder: DEFAULT_DATA.settings.msgReminder }))}
        >
          ↺ استعادة الرسائل الافتراضية (تشمل الاسم والبريد والحساب والتواريخ)
        </button>
      </section>

      <button className="sn-btn sn-btn--primary sn-full" onClick={() => onSave(s)}>
        حفظ الإعدادات
      </button>

      <p className="sn-hint" style={{ textAlign: "center" }}>سجل العملات، دفتر العملاء، Excel، النسخ الاحتياطي، وسلة المحذوفات — كلها الآن في القائمة الجانبية (زر ☰ بالأعلى).</p>

      <button className="sn-btn sn-btn--danger sn-full" onClick={onReset}>
        🗑️ مسح كل البيانات
      </button>
      <p className="sn-footer-note">STAR NET ⭐ — نظام إدارة أجهزة ستارلينك</p>
    </div>
  );
}

/* ============================================================
   عناصر واجهة عامة
   ============================================================ */
// زر دائري: الإجراءات الحسّاسة تتطلّب ضغطاً مطوّلاً (ثانية) للتأكيد
function HoldButton({ icon, label, onAct, variant = "def", hold = false }) {
  const [progress, setProgress] = useState(0);
  const raf = useRef(null);
  const start = useRef(0);

  const stop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setProgress(0);
  };
  const begin = (e) => {
    if (!hold) return;
    e.preventDefault();
    start.current = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start.current) / 1000);
      setProgress(p);
      if (p >= 1) {
        stop();
        onAct();
      } else {
        raf.current = requestAnimationFrame(tick);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (hold) stop();
  };
  const click = () => {
    if (!hold) onAct();
  };

  return (
    <div className="sn-hold-wrap">
      <button
        type="button"
        className={"sn-hold sn-hold--" + variant + (progress > 0 ? " is-holding" : "")}
        onClick={click}
        onPointerDown={begin}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        title={label}
      >
        {hold && <span className="sn-hold-fill" style={{ height: progress * 100 + "%" }} />}
        <span className="sn-hold-icon">{icon}</span>
      </button>
      <span className="sn-hold-label">{hold && progress > 0 ? "استمرّ…" : label}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="sn-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="sn-overlay" onClick={onClose}>
      <div className="sn-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sn-sheet-head">
          <h3>{title}</h3>
          <button className="sn-x" onClick={onClose}>✕</button>
        </div>
        <div className="sn-sheet-body">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({ text, onYes, onNo }) {
  return (
    <div className="sn-overlay" onClick={onNo}>
      <div className="sn-confirm" onClick={(e) => e.stopPropagation()}>
        <p>{text}</p>
        <div className="sn-confirm-actions">
          <button className="sn-btn sn-btn--ghost" onClick={onNo}>إلغاء</button>
          <button className="sn-btn sn-btn--danger" onClick={onYes}>تأكيد</button>
        </div>
      </div>
    </div>
  );
}

function Empty({ icon, title, sub }) {
  return (
    <div className="sn-empty">
      <span className="sn-empty-ic">{icon}</span>
      <strong>{title}</strong>
      <p>{sub}</p>
    </div>
  );
}

/* ============================================================
   الأنماط
   ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');

.sn-root *{box-sizing:border-box;margin:0;padding:0}
.sn-root{
  --bg:#0A0E1A; --surface:#121829; --surface2:#1A2238; --elevated:#222C46;
  --border:rgba(255,255,255,.09); --text:#EAEEF7; --muted:#8B95AC;
  --accent:#4F9DFF; --accent2:#7C5CFF; --ok:#34D399; --warn:#FBBF24; --bad:#FB7185; --gold:#FFD166;
  font-family:'Tajawal','Segoe UI',Tahoma,sans-serif;
  background:var(--bg); color:var(--text);
  min-height:100vh; max-width:720px; margin:0 auto; position:relative;
  padding-bottom:78px;
}
.sn-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;min-height:100vh;color:var(--muted)}
.sn-spinner{width:38px;height:38px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:sn-spin .8s linear infinite}
@keyframes sn-spin{to{transform:rotate(360deg)}}

/* الرأس */
.sn-header{position:relative;padding:22px 18px 18px;background:
  radial-gradient(120% 140% at 85% -20%, rgba(124,92,255,.28), transparent 55%),
  radial-gradient(110% 120% at 10% -10%, rgba(79,157,255,.30), transparent 55%),
  linear-gradient(180deg,#0E1530,#0A0E1A);
  border-bottom:1px solid var(--border);overflow:hidden}
.sn-stars{position:absolute;inset:0;background-image:
  radial-gradient(1.5px 1.5px at 20% 30%,#fff,transparent),
  radial-gradient(1.5px 1.5px at 70% 20%,#cfe0ff,transparent),
  radial-gradient(1px 1px at 40% 60%,#fff,transparent),
  radial-gradient(1px 1px at 88% 70%,#fff,transparent),
  radial-gradient(1.5px 1.5px at 55% 40%,#bcd2ff,transparent);
  opacity:.55;animation:sn-twinkle 4s ease-in-out infinite alternate}
@keyframes sn-twinkle{from{opacity:.35}to{opacity:.7}}
@media (prefers-reduced-motion:reduce){.sn-stars,.sn-spinner{animation:none}}
.sn-brand{position:relative;display:flex;align-items:center;gap:12px}
.sn-logo{font-size:30px;filter:drop-shadow(0 0 8px rgba(255,209,102,.5))}
.sn-logo-img{width:46px;height:46px;border-radius:50%;object-fit:cover;box-shadow:0 0 12px rgba(120,170,255,.45);border:1px solid rgba(255,255,255,.18);flex-shrink:0}
.sn-drawer-head .sn-logo-img{width:50px;height:50px}
.sn-brand h1{font-size:21px;font-weight:800;letter-spacing:.5px}
.sn-brand p{font-size:12.5px;color:var(--muted);margin-top:2px}
.sn-menu-btn{position:absolute;top:18px;left:16px;z-index:2;width:42px;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.sn-hbtn{position:absolute;top:18px;z-index:2;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.10);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-size:21px;line-height:1;padding:0}
.sn-hbtn:active{transform:scale(.93)}
.sn-menu-btn.sn-hbtn{left:16px;border-radius:50%;width:44px;height:44px;background:linear-gradient(135deg,#22d3ee,#3b82f6);border-color:transparent;box-shadow:0 4px 14px rgba(56,189,248,.4);font-size:19px}
.sn-add-btn{right:16px;font-size:30px;font-weight:300;background:linear-gradient(135deg,#6f8bff,#8b5cf6);border-color:transparent;box-shadow:0 4px 14px rgba(120,120,255,.4)}
.sn-brand{justify-content:center;text-align:center;padding:0 54px}
.sn-drawer-wrap{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:flex;justify-content:flex-start;animation:snFade .15s ease}
.sn-drawer{width:80%;max-width:320px;height:100%;background:var(--surface);border-inline-end:1px solid var(--border);display:flex;flex-direction:column;box-shadow:0 0 40px rgba(0,0,0,.5);animation:snSlideIn .22s ease;overflow-y:auto}
@keyframes snSlideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
.sn-drawer-head{display:flex;align-items:center;gap:12px;padding:22px 18px;background:linear-gradient(135deg,#13204a,#0a1024);border-bottom:1px solid var(--border)}
.sn-drawer-head h2{font-size:18px;font-weight:800}
.sn-drawer-head p{font-size:12px;color:var(--muted);margin-top:2px}
.sn-drawer-list{flex:1;padding:10px 0}
.sn-drawer-item{display:flex;align-items:center;gap:14px;width:100%;padding:14px 20px;background:none;border:none;color:var(--text);font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;text-align:right;border-inline-start:3px solid transparent}
.sn-drawer-item:active{background:var(--surface2)}
.sn-drawer-item.is-active{background:var(--surface2);border-inline-start-color:var(--accent);color:var(--accent)}
.sn-drawer-ic{font-size:20px;width:26px;text-align:center;flex-shrink:0}
.sn-drawer-lbl{flex:1}
.sn-drawer-sep{height:1px;background:var(--border);margin:8px 18px}
.sn-drawer-foot{text-align:center;padding:14px;color:var(--muted);font-size:13px;font-weight:700}

.sn-main{padding:0}
.sn-page{padding:16px 14px;display:flex;flex-direction:column;gap:16px}

/* الأرباح */
.sn-profit-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sn-profit{padding:16px 14px;border-radius:16px;border:1px solid var(--border);position:relative;overflow:hidden}
.sn-profit--day{background:linear-gradient(135deg,rgba(52,211,153,.16),rgba(52,211,153,.04))}
.sn-profit--month{background:linear-gradient(135deg,rgba(79,157,255,.18),rgba(124,92,255,.06))}
.sn-profit-lbl{font-size:12.5px;color:var(--muted)}
.sn-profit strong{display:block;margin-top:6px;font-size:23px;font-weight:800}
.sn-profit strong em{font-size:12px;font-weight:500;color:var(--muted);font-style:normal}

/* الإحصائيات */
.sn-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sn-stat{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:13px;display:flex;flex-direction:column;gap:3px;border-inline-start:3px solid var(--muted)}
.sn-stat--tap{cursor:pointer}
.sn-stat--tap:active{background:var(--surface2)}
.sn-seg{display:flex;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:4px;margin:10px 0}
.sn-seg button{flex:1;background:none;border:none;color:var(--muted);font-family:inherit;font-size:14px;font-weight:700;padding:9px;border-radius:9px;cursor:pointer}
.sn-seg button.is-on{background:var(--accent);color:#04122b}
.sn-period-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.sn-period-nav button{width:40px;height:40px;border-radius:11px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:22px;cursor:pointer;line-height:1}
.sn-period-nav span{font-weight:800;font-size:15px}
.sn-ps-profit{display:flex;justify-content:space-between;align-items:center;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px}
.sn-ps-profit span{color:var(--muted);font-weight:700}
.sn-ps-profit strong{font-size:20px;color:var(--ok)}
.sn-ps-row{display:flex;justify-content:space-between;padding:9px 2px;border-bottom:1px dashed var(--border);font-size:13.5px}
.sn-ps-row:last-child{border-bottom:none}
.sn-ps-row span{color:var(--muted)}
.sn-year-bars{display:flex;align-items:flex-end;justify-content:space-between;gap:3px;height:80px;margin-top:14px;padding-top:6px;border-top:1px solid var(--border)}
.sn-ybar{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end}
.sn-ybar-fill{width:100%;max-width:16px;background:var(--accent);border-radius:4px 4px 0 0}
.sn-ybar-fill.neg{background:var(--bad)}
.sn-ybar span{font-size:9px;color:var(--muted)}
.sn-stat strong{font-size:24px;font-weight:800}
.sn-stat span{font-size:12.5px;color:var(--muted)}
.sn-stat--ok{border-inline-start-color:var(--ok)}
.sn-stat--warn{border-inline-start-color:var(--warn)}
.sn-stat--bad{border-inline-start-color:var(--bad)}
.sn-stat--t{border-inline-start-color:var(--accent)}

.sn-debt-banner{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(251,191,36,.16),rgba(251,113,133,.08));border:1px solid rgba(251,191,36,.3);border-radius:14px;padding:13px 15px;cursor:pointer}
.sn-debt-banner strong{font-size:18px;color:var(--gold)}
.sn-supplier-banner{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(124,92,255,.16),rgba(79,157,255,.06));border:1px solid rgba(124,92,255,.32);border-radius:14px;padding:13px 15px}
.sn-supplier-banner strong{font-size:18px;color:#bcaaff}
.sn-supplier-box{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:13px;margin-bottom:13px}
.sn-switch{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px}
.sn-switch input{width:20px;height:20px;accent-color:var(--accent);cursor:pointer}
.sn-due-field{margin-top:11px}
.sn-due-field>span{display:block;font-size:13px;color:var(--muted);margin-bottom:6px}
.sn-due-field input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:11px 13px;color:var(--text);font-family:inherit;font-size:14.5px}
.sn-mini-grid--2{grid-template-columns:1fr 1fr;margin-top:-6px}

.sn-sec-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.sn-sec-head h2{font-size:16px;font-weight:700}
.sn-count{background:var(--surface2);color:var(--muted);font-size:12px;padding:1px 9px;border-radius:10px}

/* بطاقات التنبيه */
.sn-alert{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 14px;margin-bottom:9px;border-inline-start:4px solid var(--muted)}
.sn-alert--expired{border-inline-start-color:var(--bad)}
.sn-alert--urgent{border-inline-start-color:var(--warn)}
.sn-alert--soon{border-inline-start-color:var(--accent)}
.sn-alert-name{display:block;font-weight:700;font-size:15px}
.sn-alert-meta{display:block;font-size:12px;color:var(--muted);margin-top:2px}
.sn-alert-actions{display:flex;gap:6px;flex-shrink:0}

.sn-mini{background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:7px 11px;font-size:12.5px;font-family:inherit;cursor:pointer;white-space:nowrap;transition:.15s}
.sn-mini:active{transform:scale(.95)}
.sn-mini--green{background:rgba(52,211,153,.15);border-color:rgba(52,211,153,.35);color:#7ff0c4}
.sn-mini--red{background:rgba(251,113,133,.13);border-color:rgba(251,113,133,.32);color:#ffb3c0}
.sn-mini--gold{background:rgba(255,209,102,.14);border-color:rgba(255,209,102,.34);color:#ffe199}
.sn-mini--blue{background:rgba(79,157,255,.15);border-color:rgba(79,157,255,.35);color:#a9ccff}
.sn-row-vwrap{display:flex;align-items:center;gap:8px;min-width:0}
.sn-cd{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:9px;background:var(--surface2);color:var(--muted);white-space:nowrap;font-variant-numeric:tabular-nums;margin-top:4px}
.sn-cd--sm{font-size:11.5px;padding:2px 8px}
.sn-cd--ok{background:rgba(52,211,153,.16);color:#7ff0c4}
.sn-cd--warn{background:rgba(251,191,36,.18);color:#ffd98a}
.sn-cd--urgent{background:rgba(251,113,133,.18);color:#ffb3c0}
.sn-cd--off{background:rgba(139,149,172,.18);color:var(--muted)}
.sn-dup-badge{display:inline-block;margin-top:4px;font-size:9.5px;font-weight:700;color:#ffd98a;background:rgba(251,191,36,.14);border:1px solid rgba(251,191,36,.32);border-radius:8px;padding:2px 8px}
.sn-dup-info{background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.34);border-radius:11px;padding:11px 13px;font-size:13px;color:#ffd98a;line-height:1.5}
.sn-profit-preview{background:linear-gradient(135deg,rgba(52,211,153,.16),rgba(52,211,153,.04));border:1px solid rgba(52,211,153,.32);border-radius:11px;padding:11px 13px;font-size:14px;margin-bottom:13px;color:#cdebd9}
.sn-profit-preview strong{color:#7ff0c4;font-size:14px}
.sn-neg{color:var(--bad)!important}
.sn-rate-hint{font-size:11.5px;color:var(--muted)}
.sn-rate-box{background:var(--bg);border:1px solid rgba(79,157,255,.28);border-radius:12px;padding:12px;margin-bottom:13px}
.sn-rate-title{display:block;font-size:13px;color:#bcd6ff;margin-bottom:8px}
.sn-rate-row{display:flex;align-items:center;gap:8px}
.sn-rate-row input{flex:1;min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text);font-family:inherit;font-size:14px}
.sn-rate-eq{color:var(--muted);font-weight:700}
.sn-rate-save{background:var(--accent);color:#04122b;border:none;border-radius:10px;padding:10px 14px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;flex-shrink:0}
.sn-rate-save:disabled{opacity:.45}
.sn-txn-amt--exp{color:var(--bad)}
.sn-origin-badge{display:inline-block;margin-top:4px;margin-inline-start:5px;font-size:9.5px;font-weight:700;border-radius:8px;padding:2px 8px;border:1px solid var(--border)}
.sn-origin-badge--hadDebt{background:rgba(251,113,133,.15);color:#ffb3c0;border-color:rgba(251,113,133,.32)}
.sn-origin-badge--clean{background:rgba(52,211,153,.15);color:#7ff0c4;border-color:rgba(52,211,153,.32)}
.sn-origin-badge--note{background:rgba(79,157,255,.14);color:#a9ccff;border-color:rgba(79,157,255,.3)}
.sn-fin-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;justify-content:flex-start}
.sn-fin{font-size:9.5px;font-weight:700;border-radius:7px;padding:2px 6px;border:1px solid var(--border);white-space:nowrap}
.sn-fin--debt{background:rgba(251,113,133,.16);color:#ffb3c0;border-color:rgba(251,113,133,.34)}
.sn-fin--cred{background:rgba(45,212,191,.16);color:#7fe7d6;border-color:rgba(45,212,191,.34)}
.sn-fin--link{background:rgba(79,157,255,.16);color:#a9ccff;border-color:rgba(79,157,255,.34)}
.sn-agent-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-inline-end:6px;vertical-align:middle}
.sn-card--risk{border-color:rgba(244,63,94,.5)}
.sn-risk-banner{background:linear-gradient(90deg,rgba(244,63,94,.28),rgba(244,63,94,.12));color:#ffd0d6;font-size:11.5px;font-weight:800;padding:6px 12px;text-align:center;animation:snPulse 1.4s ease-in-out infinite}
.sn-swatches{display:flex;flex-wrap:wrap;gap:8px}
.sn-swatch{width:30px;height:30px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}
.sn-swatch.is-on{border-color:#fff;box-shadow:0 0 0 2px var(--surface),0 0 0 4px currentColor}
.sn-trash-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px dashed var(--border)}
.sn-trash-row:last-of-type{border-bottom:none}
.sn-trash-name{display:block;font-weight:700;font-size:14px}
.sn-trash-sub{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
.sn-trash-acts{display:flex;gap:6px;flex-shrink:0}
.sn-fin--ok{background:rgba(52,211,153,.15);color:#7ff0c4;border-color:rgba(52,211,153,.3)}
.sn-fin--sup{background:rgba(124,92,255,.16);color:#bcaaff;border-color:rgba(124,92,255,.32)}
.sn-fin--paid{background:rgba(139,149,172,.16);color:var(--muted)}
.sn-fin--brk{background:rgba(255,209,102,.14);color:#ffe199;border-color:rgba(255,209,102,.34)}
.sn-fin--warn{background:rgba(244,63,94,.2);color:#ffd0d6;border:1px solid rgba(244,63,94,.5);animation:snPulse 1.4s ease-in-out infinite}
@keyframes snPulse{0%,100%{box-shadow:0 0 0 0 rgba(244,63,94,.5)}50%{box-shadow:0 0 0 5px rgba(244,63,94,0)}}
@keyframes snFade{from{opacity:0}to{opacity:1}}
.sn-hold-wrap{display:flex;flex-direction:column;align-items:center;gap:3px;width:52px}
.sn-hold{position:relative;width:40px;height:40px;border-radius:50%;border:1.5px solid var(--border);background:var(--surface);overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;flex-shrink:0;transition:transform .1s}
.sn-hold.is-holding{transform:scale(1.12)}
.sn-hold-fill{position:absolute;left:0;bottom:0;width:100%;background:currentColor;opacity:.4}
.sn-hold-icon{position:relative;font-size:17px;line-height:1;z-index:1}
.sn-hold-label{font-size:9.5px;color:var(--muted);text-align:center;line-height:1.1;white-space:nowrap}
.sn-hold--green{color:#34d399;border-color:rgba(52,211,153,.45)}
.sn-hold--red{color:#fb7185;border-color:rgba(251,113,133,.45)}
.sn-hold--gold{color:#ffd166;border-color:rgba(255,209,102,.45)}
.sn-hold--blue{color:#4f9dff;border-color:rgba(79,157,255,.45)}
.sn-country-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px dashed var(--border)}
.sn-country-row:last-of-type{border-bottom:none}
.sn-country-name{display:block;font-weight:700;font-size:14.5px}
.sn-country-sub{display:block;font-size:12px;color:var(--muted);margin-top:2px;direction:ltr;text-align:right}
.sn-country-acts{display:flex;gap:6px;flex-shrink:0}
.sn-copy{background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:3px 9px;font-size:11.5px;font-family:inherit;color:var(--accent);cursor:pointer;flex-shrink:0}
.sn-copy:active{transform:scale(.93)}
.sn-agent-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:11px}
.sn-agent-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.sn-agent-name{display:block;font-weight:700;font-size:16px}
.sn-agent-sub{display:block;font-size:12.5px;color:var(--muted);margin-top:3px}
.sn-agent-share{text-align:left;flex-shrink:0}
.sn-agent-share span{display:block;font-size:11.5px;color:var(--muted)}
.sn-agent-share strong{font-size:17px;color:#7ff0c4}
.sn-agent-figs{display:flex;justify-content:space-between;gap:10px;margin:10px 0;font-size:12.5px;color:var(--muted);flex-wrap:wrap}
.sn-agent-summary{display:flex;justify-content:space-between;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:14px}
.sn-agent-summary>div{display:flex;flex-direction:column;gap:3px;text-align:center;flex:1}
.sn-agent-summary span{font-size:11px;color:var(--muted)}
.sn-agent-summary strong{font-size:14px}

/* البحث والتصنيفات */
.sn-search{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;color:var(--text);font-family:inherit;font-size:14px}
.sn-search-row{display:flex;gap:8px;align-items:stretch}
.sn-search-row .sn-search{flex:1}
.sn-mic{flex-shrink:0;min-width:46px;border:1px solid var(--border);background:var(--surface2);border-radius:12px;font-size:16px;cursor:pointer;color:var(--accent);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:4px 6px;font-family:inherit;touch-action:none}
.sn-mic:active,.sn-mic--rec{background:var(--bad);color:#fff;border-color:transparent}
.sn-mic-lbl{font-size:9px;font-weight:800}
.sn-fin--good{background:rgba(61,220,151,.14);color:#5ee0a8;border:1px solid rgba(61,220,151,.4)}
.sn-tag-badge{background:rgba(167,139,250,.16);color:#c4b5fd;border:1px solid rgba(167,139,250,.4)}
.sn-pkg-badge{background:rgba(56,189,248,.14);color:#7dd3fc;border:1px solid rgba(56,189,248,.4)}
.sn-inst-badge.inst-req{background:rgba(251,191,36,.14);color:#fcd34d;border:1px solid rgba(251,191,36,.4)}
.sn-inst-badge.inst-prog{background:rgba(167,139,250,.16);color:#c4b5fd;border:1px solid rgba(167,139,250,.4)}
.sn-inst-badge.inst-done{background:rgba(61,220,151,.14);color:#5ee0a8;border:1px solid rgba(61,220,151,.4)}
.sn-proof-prev{display:flex;align-items:center;gap:10px}
.sn-proof-prev img{width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--border)}
.sn-proof-ic{background:none;border:none;cursor:pointer;font-size:13px;padding:0 4px;margin-inline-start:4px}
.sn-pnum{font-size:11px;font-weight:800;color:var(--muted);background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:0 5px;margin-inline-end:3px}
.sn-cmp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sn-cmp{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center}
.sn-cmp span{display:block;font-size:12px;color:var(--muted)}
.sn-cmp strong{display:block;font-size:17px;margin:5px 0}
.sn-cmp em{font-size:12.5px;font-weight:800;font-style:normal}
.sn-rank-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed var(--border)}
.sn-rank-row:last-child{border-bottom:none}
.sn-rank-no{width:24px;height:24px;flex-shrink:0;background:var(--accent);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}
.sn-rank-name{flex:1;font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sn-rank-val{font-weight:800;font-size:13px;flex-shrink:0}
.sn-inv-tabs{display:flex;gap:8px;margin-bottom:12px}
.sn-inv-tabs button{flex:1;padding:10px;border-radius:11px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;font-weight:800;font-size:13px;cursor:pointer}
.sn-inv-tabs button.is-on{background:var(--accent);border-color:transparent;color:#fff}
.sn-inv-row{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;padding:9px 11px;margin-bottom:7px}
.sn-inv-info{min-width:0;flex:1}
.sn-inv-name{display:block;font-weight:700;font-size:13.5px}
.sn-inv-qty{display:inline-block;background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:1px 7px;font-size:11px;margin-inline-start:5px;color:var(--ok)}
.sn-inv-qty.out{color:var(--bad);border-color:rgba(244,63,94,.4)}
.sn-inv-sub{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
.sn-inv-acts{display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;max-width:50%}
.sn-goal{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 14px;margin-bottom:12px}
.sn-goal-top{display:flex;justify-content:space-between;font-weight:800;font-size:13.5px;margin-bottom:8px}
.sn-goal-pct{color:var(--gold)}
.sn-goal-bar{height:12px;background:var(--surface2);border-radius:7px;overflow:hidden}
.sn-goal-fill{height:100%;background:linear-gradient(90deg,#4da3ff,#3ddc97);border-radius:7px;transition:width .4s}
.sn-goal-sub{display:block;font-size:11.5px;color:var(--muted);margin-top:7px}
.sn-close{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 14px;margin-bottom:12px}
.sn-close-h{font-weight:800;font-size:14px;margin-bottom:10px}
.sn-close-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sn-close-c{background:var(--surface2);border:1px solid var(--border);border-radius:11px;padding:9px;text-align:center}
.sn-close-c span{display:block;font-size:11px;color:var(--muted);margin-bottom:4px}
.sn-close-c strong{font-size:14px}
.sn-search::placeholder{color:var(--muted)}
.sn-chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
.sn-chip{flex-shrink:0;background:var(--surface);border:1px solid var(--border);color:var(--muted);border-radius:20px;padding:7px 15px;font-size:13px;font-family:inherit;cursor:pointer}
.sn-chip.is-active{background:var(--accent);border-color:var(--accent);color:#04122b;font-weight:700}

/* بطاقة الجهاز */
.sn-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;margin-bottom:9px;overflow:hidden;border-inline-start:4px solid var(--muted)}
.sn-card--expired{border-inline-start-color:var(--bad)}
.sn-card--urgent{border-inline-start-color:var(--warn)}
.sn-card--soon{border-inline-start-color:var(--accent)}
.sn-card--active{border-inline-start-color:var(--ok)}
.sn-card-top{display:flex;justify-content:space-between;align-items:center;padding:11px 12px;cursor:pointer;gap:9px}
.sn-card-name{display:block;font-weight:700;font-size:14px}
.sn-card-phone{display:block;font-size:11px;color:var(--muted);margin-top:1px;direction:ltr;text-align:right}
.sn-card-status{text-align:left;flex-shrink:0}
.sn-fin--late{background:rgba(244,63,94,.16);color:#ff9aa6;border:1px solid rgba(244,63,94,.4)}
/* تستحق اليوم */
.sn-due{background:var(--surface);border:1px solid var(--border);border-radius:16px;margin-bottom:14px;overflow:hidden}
.sn-due--empty{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;font-weight:800;font-size:14px;color:var(--muted)}
.sn-due-clear{color:var(--ok);font-weight:700;font-size:13px}
.sn-due-head{width:100%;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,rgba(79,157,255,.18),rgba(139,92,246,.14));border:none;padding:13px 15px;font-family:inherit;font-size:15px;font-weight:800;color:var(--text);cursor:pointer}
.sn-due-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;background:var(--bad);color:#fff;border-radius:11px;font-size:12px;margin-inline-start:6px}
.sn-due-body{padding:10px 12px}
.sn-due-notif{width:100%;background:rgba(255,209,102,.14);border:1px solid rgba(255,209,102,.4);color:var(--gold);border-radius:11px;padding:10px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;margin-bottom:10px}
.sn-due-group{margin-bottom:10px}
.sn-due-glabel{font-size:12.5px;font-weight:800;color:var(--muted);margin-bottom:6px}
.sn-due-item{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;padding:8px 10px;margin-bottom:6px}
.sn-due-info{min-width:0;flex:1}
.sn-due-name{display:block;font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sn-due-meta{display:block;font-size:11.5px;color:var(--muted);margin-top:1px}
.sn-due-acts{display:flex;gap:6px;flex-shrink:0}
.sn-due-btn{border:none;border-radius:9px;padding:7px 11px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}
.sn-due-btn--wa{background:rgba(37,211,102,.16);color:#4ade80;border:1px solid rgba(37,211,102,.4)}
.sn-due-btn--go{background:var(--accent);color:#fff}
.sn-calc-out{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px}
.sn-calc-row{display:flex;align-items:center;justify-content:space-between;font-size:14px;padding:6px 0}
.sn-calc-total{border-top:1px solid var(--border);margin-top:4px;padding-top:10px;font-size:16px;font-weight:800;color:var(--accent)}
/* تقويم التجديدات */
.sn-cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sn-cal-nav span{font-weight:800;font-size:15px}
.sn-cal-nav button{width:40px;height:40px;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:20px;cursor:pointer}
.sn-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.sn-cal-head{margin-bottom:5px}
.sn-cal-wd{text-align:center;font-size:10.5px;color:var(--muted);font-weight:700;padding:3px 0}
.sn-cal-day{position:relative;aspect-ratio:1;border:1px solid var(--border);background:var(--surface2);border-radius:9px;color:var(--text);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit}
.sn-cal-day.has{border-color:var(--bad)}
.sn-cal-day.is-today{outline:2px solid var(--accent)}
.sn-cal-day.is-sel{background:var(--accent);color:#fff}
.sn-cal-badge{position:absolute;top:-5px;left:-5px;min-width:18px;height:18px;background:var(--bad);color:#fff;border-radius:9px;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0 4px}
.sn-cal-list{margin-top:14px}
.sn-cal-list-h{font-weight:800;font-size:14px;margin-bottom:8px}
.sn-cal-item{display:flex;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:9px 11px;margin-bottom:6px}
.sn-cal-item-sub{color:var(--muted);font-size:12px}
/* شاشة القفل */
.sn-lock{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.sn-lock-box{text-align:center;width:100%;max-width:320px}
.sn-lock-logo{font-size:46px;filter:drop-shadow(0 0 12px rgba(255,209,102,.6));margin-bottom:6px}
.sn-lock-box h2{font-size:24px;font-weight:800;letter-spacing:1px}
.sn-lock-box p{color:var(--muted);margin:4px 0 18px}
.sn-lock-dots{display:flex;justify-content:center;gap:14px;margin-bottom:14px}
.sn-lock-dot{width:15px;height:15px;border-radius:50%;border:2px solid var(--muted);transition:all .15s}
.sn-lock-dot.on{background:var(--accent);border-color:var(--accent)}
.sn-lock-err{color:var(--bad)!important;font-weight:700;margin-top:0}
.sn-lock-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px}
.sn-lock-key{height:64px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:24px;font-weight:700;cursor:pointer;font-family:inherit}
.sn-lock-key:active{background:var(--accent);color:#fff}
/* بطاقة مضغوطة */
.sn-card-sub{display:block;font-size:12px;color:var(--muted);margin-top:3px;direction:ltr;text-align:right;word-break:break-all}
.sn-dev-tag{display:inline-block;font-size:10px;font-weight:800;border:1px solid;border-radius:6px;padding:1px 6px;margin-inline-start:6px;vertical-align:middle}
.sn-grid2v{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:10px}
.sn-cf{background:var(--surface2);border:1px solid var(--border);border-radius:11px;padding:7px 9px;min-width:0}
.sn-cf-k{display:block;font-size:10.5px;color:var(--muted);margin-bottom:2px}
.sn-cf-v{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:13px;font-weight:700;min-width:0}
.sn-cf-v>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.sn-neg{color:var(--bad)}
.sn-copy-ic{flex-shrink:0;background:var(--surface);border:1px solid var(--border);border-radius:7px;width:24px;height:24px;font-size:12px;color:var(--accent);cursor:pointer;padding:0;line-height:1}
.sn-copy-ic:active{background:var(--accent);color:#fff}
.sn-collapse-h{width:100%;display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:11px;padding:10px 12px;font-family:inherit;font-size:13.5px;font-weight:800;color:var(--text);cursor:pointer;margin-bottom:8px}
.sn-collapse-h:active{background:var(--surface)}
.sn-more-box{background:var(--surface2);border:1px solid var(--border);border-radius:11px;padding:10px 12px;margin-bottom:8px}
.sn-more-line{font-size:13px;margin-bottom:6px}
.sn-more-notes{margin:0;padding-inline-start:18px;font-size:13px}
.sn-more-notes li{margin-bottom:3px}
.sn-card-actions--bar{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:8px;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.sn-card-actions--bar::-webkit-scrollbar{height:0}
.sn-quick-on{background:var(--accent)!important;border-color:transparent!important}
/* لوحة الربح */
.sn-profit-panel{background:var(--surface2);border:1px solid var(--border);border-radius:12px;margin:0 12px 12px;padding:10px 12px}
.sn-profit-head{font-size:13px;font-weight:800;margin-bottom:8px;color:var(--gold)}
.sn-profit-row{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:6px 0;border-bottom:1px dashed var(--border)}
.sn-profit-date{color:var(--muted);flex-shrink:0;font-size:11.5px}
.sn-profit-type{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sn-profit-amt{font-weight:800;flex-shrink:0}
.sn-pos{color:var(--ok)}
.sn-profit-total{display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:14px;font-weight:800}
.sn-quick-acts{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:6px;width:96px;margin-inline-start:auto}
.sn-quick-btn{width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex-shrink:0}
.sn-quick-btn:active{background:var(--surface);transform:scale(.92)}
.sn-quick-del{border-color:rgba(244,63,94,.55)}
.sn-card-end{display:block;font-size:12px;color:var(--muted);margin-top:4px}
.sn-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:9px;background:var(--surface2);color:var(--muted)}
.sn-badge--expired{background:rgba(251,113,133,.18);color:#ffb3c0}
.sn-badge--urgent{background:rgba(251,191,36,.18);color:#ffd98a}
.sn-badge--soon{background:rgba(79,157,255,.18);color:#a9ccff}
.sn-badge--active{background:rgba(52,211,153,.18);color:#7ff0c4}
.sn-card-body{padding:4px 14px 14px;border-top:1px solid var(--border)}
.sn-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13.5px}
.sn-row:last-of-type{border-bottom:none}
.sn-row-k{color:var(--muted)}
.sn-row-v{font-weight:600;text-align:left;word-break:break-all}
.sn-row-v.is-danger{color:var(--bad)}
.sn-card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}

/* التقارير */
.sn-mini-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px}
.sn-ministat{background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:11px 9px;display:flex;flex-direction:column;gap:4px}
.sn-ministat span{font-size:11.5px;color:var(--muted)}
.sn-ministat strong{font-size:14px}
.sn-ministat strong.is-danger{color:var(--bad)}
.sn-block{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:15px}
.sn-block h2{font-size:15px;font-weight:700;margin-bottom:12px}
.sn-chart{display:flex;align-items:flex-end;justify-content:space-between;gap:6px;height:130px}
.sn-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%}
.sn-bar-wrap{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center}
.sn-bar{width:70%;max-width:30px;border-radius:6px 6px 0 0;background:linear-gradient(180deg,var(--accent),var(--accent2));min-height:4px;transition:height .4s}
.sn-bar-lbl{font-size:11px;color:var(--muted)}
.sn-muted-txt{color:var(--muted);font-size:13px}
.sn-txn{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px dashed var(--border)}
.sn-cust-box{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:10px}
.sn-cust-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:7px;margin-bottom:4px}
.sn-cust-name{font-weight:800;font-size:13.5px}
.sn-cust-net{font-size:12px;font-weight:700;color:var(--ok)}
.sn-cust-box .sn-txn{padding:7px 0;font-size:13px}
.sn-cust-box .sn-txn:last-child{border-bottom:none}
.sn-txn:last-child{border-bottom:none}
.sn-txn-name{display:block;font-weight:600;font-size:14px}
.sn-txn-meta{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
.sn-txn-amt{font-weight:700;color:var(--ok);font-size:14px;direction:ltr}

/* الحالة الفارغة */
.sn-empty{text-align:center;padding:38px 20px;color:var(--muted);background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.sn-empty-ic{font-size:38px;display:block;margin-bottom:10px}
.sn-empty strong{display:block;color:var(--text);font-size:16px;margin-bottom:5px}
.sn-empty p{font-size:13px}

/* الزر العائم */
.sn-fab{position:fixed;bottom:90px;inset-inline-start:50%;transform:translateX(-50%);max-width:720px;margin:0 auto}
.sn-fab{inset-inline-start:auto;inset-inline-end:18px;transform:none;width:56px;height:56px;border-radius:50%;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:30px;line-height:1;cursor:pointer;box-shadow:0 8px 24px rgba(79,157,255,.45);z-index:40}
.sn-fab:active{transform:scale(.92)}

/* شريط التنقل */
.sn-tabs{position:fixed;bottom:0;inset-inline:0;max-width:720px;margin:0 auto;display:grid;grid-template-columns:repeat(5,1fr);background:rgba(14,21,40,.96);backdrop-filter:blur(10px);border-top:1px solid var(--border);z-index:30}
.sn-tab{background:none;border:none;color:var(--muted);font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 0 12px;font-size:10.5px;cursor:pointer}
.sn-tab-ic{font-size:18px}
.sn-tab.is-active{color:var(--accent)}

/* النوافذ المنبثقة */
.sn-overlay{position:fixed;inset:0;background:rgba(4,8,18,.72);backdrop-filter:blur(3px);z-index:60;display:flex;align-items:flex-end;justify-content:center}
.sn-sheet{background:var(--surface);width:100%;max-width:720px;max-height:92vh;border-radius:22px 22px 0 0;border:1px solid var(--border);display:flex;flex-direction:column;animation:sn-up .25s ease}
@keyframes sn-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
.sn-sheet-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface)}
.sn-sheet-head h3{font-size:16px;font-weight:700}
.sn-x{background:var(--surface2);border:none;color:var(--muted);width:30px;height:30px;border-radius:8px;font-size:15px;cursor:pointer}
.sn-sheet-body{padding:16px 18px 22px;overflow-y:auto}
.sn-field{display:block;margin-bottom:13px}
.sn-field>span{display:block;font-size:13px;color:var(--muted);margin-bottom:6px}
.sn-field input,.sn-field select,.sn-field textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:11px;padding:11px 13px;color:var(--text);font-family:inherit;font-size:14.5px}
.sn-field input:focus,.sn-field select:focus,.sn-field textarea:focus{outline:none;border-color:var(--accent)}
.sn-field textarea{resize:vertical}
.sn-grid2{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.sn-end-preview{background:rgba(79,157,255,.1);border:1px solid rgba(79,157,255,.28);border-radius:11px;padding:10px 13px;font-size:13.5px;margin-bottom:13px;color:#bcd6ff}
.sn-dup-warn{background:rgba(251,191,36,.14);border:1px solid rgba(251,191,36,.4);border-radius:11px;padding:11px 13px;font-size:13.5px;margin-bottom:14px;color:#ffd98a;line-height:1.5}
.sn-sheet-actions{display:flex;gap:10px;margin-top:8px}
.sn-sheet-actions .sn-btn{flex:1}

.sn-btn{border:none;border-radius:12px;padding:13px;font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer;transition:.15s}
.sn-btn:active{transform:scale(.97)}
.sn-btn:disabled{opacity:.45}
.sn-btn--primary{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff}
.sn-btn--ghost{background:var(--surface2);color:var(--text);border:1px solid var(--border)}
.sn-btn--danger{background:rgba(251,113,133,.16);color:#ffb3c0;border:1px solid rgba(251,113,133,.34)}
.sn-full{width:100%}

.sn-confirm{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:22px;margin:auto 16px;max-width:380px;align-self:center}
.sn-confirm p{font-size:15px;margin-bottom:18px;line-height:1.6}
.sn-confirm-actions{display:flex;gap:10px}
.sn-confirm-actions .sn-btn{flex:1}

.sn-hint{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.5}
.sn-notes-head{display:flex;justify-content:space-between;align-items:center;margin:6px 0 8px}
.sn-notes-head>span{font-size:13px;color:var(--muted)}
.sn-add-note{background:rgba(79,157,255,.14);color:#bcd6ff;border:1px solid rgba(79,157,255,.32);border-radius:9px;padding:6px 12px;font-family:inherit;font-size:12.5px;cursor:pointer}
.sn-note-row{display:flex;gap:8px;margin-bottom:8px}
.sn-note-row input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:11px;padding:11px 13px;color:var(--text);font-family:inherit;font-size:14px}
.sn-note-del{background:rgba(251,113,133,.13);color:#ffb3c0;border:1px solid rgba(251,113,133,.3);border-radius:10px;width:42px;flex-shrink:0;font-size:13px;cursor:pointer}
.sn-notes-view{padding:8px 0 2px}
.sn-photos{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.sn-photo{position:relative;width:72px;height:72px;border-radius:10px;overflow:hidden;border:1px solid var(--border);display:block;flex-shrink:0}
.sn-photo img{width:100%;height:100%;object-fit:cover;display:block}
.sn-photo-del{position:absolute;top:2px;inset-inline-end:2px;width:20px;height:20px;border-radius:50%;border:none;background:rgba(0,0,0,.6);color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.sn-audio-row{display:flex;align-items:center;gap:8px;margin-top:6px}
.sn-autocomplete{position:relative}
.sn-sug-list{margin-top:6px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;overflow:hidden;max-height:260px;overflow-y:auto}
.sn-sug-head{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;font-size:11px;font-weight:700;color:var(--muted);border-bottom:1px solid var(--border)}
.sn-sug-close{background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;padding:0 4px}
.sn-sug-item{display:flex;flex-direction:column;gap:2px;width:100%;text-align:right;background:none;border:none;border-bottom:1px solid var(--border);padding:10px 12px;cursor:pointer;font-family:inherit}
.sn-sug-item:last-child{border-bottom:none}
.sn-sug-item:active{background:var(--surface)}
.sn-country-item{flex-direction:row;justify-content:space-between;align-items:center}
.sn-cur-tag{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:2px 9px;font-size:11px;font-weight:800;color:var(--accent);font-family:monospace;flex-shrink:0}
.sn-switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 2px;font-size:14px;font-weight:600;cursor:pointer}
.sn-switch-row input[type=checkbox]{width:46px;height:26px;-webkit-appearance:none;appearance:none;background:var(--surface2);border:1px solid var(--border);border-radius:14px;position:relative;cursor:pointer;flex-shrink:0;transition:background .2s}
.sn-switch-row input[type=checkbox]::after{content:"";position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}
.sn-switch-row input[type=checkbox]:checked{background:var(--accent)}
.sn-switch-row input[type=checkbox]:checked::after{transform:translateX(-20px)}
.sn-sug-name{font-weight:700;font-size:13.5px;color:var(--text)}
.sn-sug-sub{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sn-lookup-input{width:100%;margin-bottom:8px}
.sn-steps{margin:0 0 12px;padding-inline-start:20px;color:var(--muted);font-size:12.5px;line-height:1.9}
.sn-steps li{margin-bottom:2px}.sn-lookup-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed var(--border)}
.sn-lookup-row:last-child{border-bottom:none}
.sn-lookup-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.sn-lookup-name{font-weight:700;font-size:13.5px}
.sn-lookup-status{font-size:11.5px;font-weight:700}
.sn-lookup-email{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}
.sn-st-active,.sn-st-soon{color:var(--ok)}
.sn-st-urgent{color:var(--warn)}
.sn-st-expired{color:var(--bad)}
.sn-st-broken{color:var(--muted)}
.sn-lookup-send{flex-shrink:0;padding:8px 12px;font-size:12px;width:auto}
.sn-pay-apps{display:flex;flex-wrap:nowrap;gap:5px;overflow-x:auto}
.sn-pay-app{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:7px 9px;font-family:inherit;font-size:11px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap;flex:1 0 auto}
.sn-pay-app.is-on{background:var(--accent);color:#04122b;border-color:var(--accent)}
.sn-phone-row{display:flex;gap:8px;align-items:center}
.sn-field .sn-phone-row .sn-dial{flex:0 0 134px;width:134px;min-width:0}
.sn-field .sn-phone-row input{flex:1 1 auto;width:auto;min-width:0}
.sn-media-bar{display:flex;gap:12px;align-items:center;margin:12px 0 6px}
.sn-icon-btn{width:42px;height:42px;border-radius:50%;border:1.5px solid var(--border);background:var(--surface2);font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex-shrink:0}
.sn-icon-btn:disabled{opacity:.4}
.sn-icon-btn.sn-rec{border-color:#fb7185;color:#fb7185;animation:snPulse 1.2s ease-in-out infinite}
.sn-icon-agent{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;margin-inline-start:auto;border:2px solid #fff3}
.sn-notes-view>.sn-row-k{display:block;margin-bottom:6px}
.sn-notes-view ul{list-style:none;display:flex;flex-direction:column;gap:6px}
.sn-notes-view li{background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:8px 11px;font-size:13.5px;line-height:1.5;position:relative;padding-inline-start:24px}
.sn-notes-view li::before{content:"•";position:absolute;inset-inline-start:10px;color:var(--accent);font-size:18px;line-height:1.1}
.sn-footer-note{text-align:center;color:var(--muted);font-size:12px;padding:8px}
.sn-toast{position:fixed;bottom:96px;inset-inline:0;margin:0 auto;width:fit-content;max-width:90%;background:var(--elevated);color:var(--text);border:1px solid var(--border);padding:11px 20px;border-radius:30px;font-size:13.5px;z-index:80;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:sn-up .25s ease}
.sn-undo{position:fixed;bottom:140px;inset-inline:0;margin:0 auto;width:fit-content;max-width:92%;display:flex;align-items:center;gap:14px;background:var(--elevated);border:1px solid var(--border);padding:9px 9px 9px 16px;border-radius:30px;z-index:81;box-shadow:0 8px 24px rgba(0,0,0,.5);font-size:13px;animation:sn-up .25s ease}
.sn-undo button{background:var(--accent);color:#fff;border:none;border-radius:20px;padding:8px 16px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer}
`;


// === تشغيل التطبيق ===
const __root = ReactDOM.createRoot(document.getElementById("root"));
__root.render(React.createElement(StarNetApp));
