import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, ArrowLeft, CheckCircle2, FileDown, Globe2, HelpCircle, Moon, Plus, Printer, Save, Search, Stethoscope, Sun, Trash2, UserPlus, Users } from "lucide-react";
import { calculateAge } from "./lib/age";
import { dateFromAge, gregorianToJalali, isoDate, jalaliToGregorian, parseIsoParts, type AgeInput } from "./lib/calendar";
import { calculateScores, predictedHeightAt18FromZ, referenceForAge, type MetricKey, type Sex } from "./lib/growth";
import { bloodPressureCategory, bloodPressureScreeningTable, bloodPressureThresholds, growthVelocity, heartRateRange, interpretScores, respiratoryRateRange, targetHeight, vitalInterpretation, type BpMethod, type Visit } from "./lib/clinical";
import { round } from "./lib/math";
import { GrowthChart } from "./components/GrowthChart";
import { VitalChart } from "./components/VitalChart";
import "./styles.css";

type BirthInputMode = "gregorian" | "jalali" | "age";
type Screen = "lookup" | "visits" | "assessment";
type Language = "en" | "fa";
type FollowUpUnit = "years" | "months" | "days";
type Theme = "light" | "dark";

type Patient = {
  sex: Sex;
  dob: string;
  gestationalAgeWeeks: number;
  motherHeightCm?: number;
  fatherHeightCm?: number;
};

type PatientRecord = Patient & {
  id: string;
  nationalId: string;
  fullName: string;
  firstPresentationAge: string;
  phone: string;
  summary: string;
  diagnosis: string;
  visits: Visit[];
};

type PatientDraft = Omit<PatientRecord, "visits">;

const storageKey = "pediatrics-hub-patients";
const languageStorageKey = "pediatrics-hub-language";
const themeStorageKey = "pediatrics-hub-theme";
const today = new Date().toISOString().slice(0, 10);
const defaultAgeInput: AgeInput = { years: 0, months: 6, days: 0 };
const defaultDob = dateFromAge(today, defaultAgeInput);
const defaultDobParts = parseIsoParts(defaultDob);
const defaultJalali = gregorianToJalali(defaultDobParts.year, defaultDobParts.month, defaultDobParts.day);

const defaultPatient: Patient = {
  sex: "female",
  dob: defaultDob,
  gestationalAgeWeeks: 39,
  motherHeightCm: 164,
  fatherHeightCm: 178,
};

const uiText = {
  en: {
    patients: "Patients",
    visits: "Visits",
    assessment: "Assessment",
    patientLookup: "Patient Lookup",
    guestMode: "Guest Mode",
    findPatient: "Find Patient",
    findPatientHint: "Search by ID, name, national ID, phone, or diagnosis",
    searchPlaceholder: "Search patient records...",
    addPatient: "Add Patient",
    addPatientHint: "Create a locally stored patient record",
    patientId: "Patient ID",
    patientIdPlaceholder: "Auto-generated if blank, e.g. P100001",
    cardPatientId: "ID",
    cardNationalId: "National ID",
    cardPhone: "Phone",
    cardDiagnosis: "Diagnosis",
    nationalId: "National ID",
    noNationalId: "No national ID",
    fullName: "Full name",
    gender: "Gender",
    female: "Female",
    male: "Male",
    firstPresentationAge: "First presentation age",
    firstPresentationPlaceholder: "e.g. 6 months",
    phoneNumber: "Phone number",
    gestationalAge: "Gestational Age",
    summary: "Summary for the patient",
    diagnosis: "Diagnosis up to now",
    noMatchingPatient: "No matching patient",
    emptyLookup: "Add a patient below, or use Guest Mode for a quick calculation.",
    patientSummary: "Patient Summary",
    noPhone: "No phone",
    firstPresentation: "First presentation",
    visitSessions: "Visit Sessions",
    savedVisit: "saved visit",
    savedVisits: "saved visits",
    todayVisit: "Today visit",
    addVisit: "Add visit",
    noVisits: "No visits yet",
    emptyVisits: "Add today's visit to start growth and vital sign tracking.",
    noChiefComplaint: "No chief complaint",
    noDiagnosis: "No diagnosis",
    openEditVisit: "Open / edit visit",
    quickCalculator: "Quick calculator, not saved to patient records",
    patient: "Patient",
    export: "Export",
    print: "Print",
    visitEntry: "Visit Entry",
    sex: "Sex",
    language: "Language",
    theme: "Theme",
    lightTheme: "Light",
    darkTheme: "Dark",
    patientSection: "Patient and Age",
    ageAndVisit: "Age and Visit",
    ageEntry: "Age entry",
    ageYmd: "Age (Y/M/D)",
    dobGregorian: "DOB - Gregorian",
    dobJalali: "DOB - Jalali",
    visitDate: "Visit date",
    dateOfBirth: "Date of birth",
    year: "Year",
    month: "Month",
    day: "Day",
    jalaliYear: "Jalali year",
    jalaliMonth: "Jalali month",
    jalaliDay: "Jalali day",
    years: "Years",
    months: "Months",
    days: "Days",
    growthMeasurements: "Growth Measurements",
    weightKg: "Weight (kg)",
    heightCm: "Length / Height (cm)",
    headCircCm: "Head Circumference (cm)",
    headCircDisabled: "Head circumference reference charting is disabled after 5 years.",
    vitalSigns: "Vital Signs",
    bpReference: "Blood Pressure Reference",
    aapScreeningTable: "AAP screening table",
    percentileEstimate: "Percentile estimate",
    heartRate: "Heart rate",
    respiratoryRate: "Respiratory Rate",
    systolicBp: "Systolic BP",
    diastolicBp: "Diastolic BP",
    visitSession: "Visit Session",
    chiefComplaint: "Chief complaint",
    detailedComplaint: "Detailed complaint",
    diagnosisVisit: "Diagnosis",
    diagnosisPlaceholder: "Same as before, or enter a new diagnosis",
    physicianNote: "Physician's note",
    followUpDate: "Follow up date",
    followUpFor: "Follow up for",
    followUpAfter: "Return after",
    followUpUnit: "Interval unit",
    followUpDue: "Due",
    followUpYears: "Years",
    followUpMonths: "Months",
    followUpDays: "Days",
    saving: "Saving...",
    saved: "Saved",
    saveGuestVisit: "Save visit in guest session",
    saveVisit: "Save visit",
    familyHeight: "Family Height",
    motherCm: "Mother cm",
    fatherCm: "Father cm",
    chronologicalAge: "Chronological age",
    correctedAge: "Corrected age",
    daysUnit: "days",
    correctedDays: "days corrected",
    termInfant: "Term infant",
    targetHeight: "Target height",
    expectedRange: "expected range",
    enterParentalHeights: "Enter parental heights",
    predictedAdultHeight: "Predicted adult height",
    sameHeightPercentile: "Same height percentile at 18 yr",
    currentVisit: "Current Visit",
    currentVisitReference: "for weight/height/BMI; WHO 0-5 used for HC when age <= 5 yr",
    noAutomaticFlags: "No automatic flags",
    noAutomaticFlagsDetail: "Measurements are not triggering the configured screening thresholds.",
    vitalSignFinding: "Vital sign finding",
    vitalSignDetail: "Vital Sign Detail",
    ageAdjustedRanges: "Age-adjusted screening ranges",
    bloodPressure: "Blood pressure",
    expectedRangeStatus: "Expected range",
    outsideExpectedRange: "Outside expected range",
    bloodPressureTrend: "Blood pressure trend",
    weightForAge: "Weight-for-age",
    lengthForAge: "Length-for-age",
    heightForAge: "Height-for-age",
    bmiForAge: "BMI-for-age",
    headCircForAge: "Head Circumference-for-Age",
    weightAxis: "Weight (kg)",
    lengthAxis: "Length (cm)",
    heightAxis: "Height (cm)",
    bmiAxis: "BMI (kg/m2)",
    headCircAxis: "Head Circumference (cm)",
    heartRateTrend: "Heart rate trend",
    respiratoryRateTrend: "Respiratory Rate Trend",
    longitudinalTracking: "Longitudinal Tracking",
    visitsInWorkspace: "in this workspace",
    showFormula: "Show formula",
    calculationNote: "Calculation note",
    close: "Close",
  },
  fa: {
    patients: "بیماران",
    visits: "ویزیت‌ها",
    assessment: "ارزیابی",
    patientLookup: "جستجوی بیمار",
    guestMode: "حالت مهمان",
    findPatient: "یافتن بیمار",
    findPatientHint: "جستجو با شناسه، نام، کد ملی، تلفن یا تشخیص",
    searchPlaceholder: "جستجو در پرونده‌های بیمار...",
    addPatient: "افزودن بیمار",
    addPatientHint: "ساخت پرونده ذخیره‌شده روی همین دستگاه",
    patientId: "شناسه بیمار",
    patientIdPlaceholder: "اگر خالی بماند خودکار ساخته می‌شود، مثل P100001",
    cardPatientId: "شناسه",
    cardNationalId: "کد ملی",
    cardPhone: "تلفن",
    cardDiagnosis: "تشخیص",
    nationalId: "کد ملی",
    noNationalId: "بدون کد ملی",
    fullName: "نام کامل",
    gender: "جنسیت",
    female: "دختر",
    male: "پسر",
    firstPresentationAge: "سن اولین مراجعه",
    firstPresentationPlaceholder: "مثلا ۶ ماه",
    phoneNumber: "شماره تلفن",
    gestationalAge: "سن بارداری",
    summary: "خلاصه بیمار",
    diagnosis: "تشخیص تا امروز",
    noMatchingPatient: "بیماری پیدا نشد",
    emptyLookup: "یک بیمار اضافه کنید یا برای محاسبه سریع از حالت مهمان استفاده کنید.",
    patientSummary: "خلاصه بیمار",
    noPhone: "بدون تلفن",
    firstPresentation: "اولین مراجعه",
    visitSessions: "جلسات ویزیت",
    savedVisit: "ویزیت ذخیره‌شده",
    savedVisits: "ویزیت ذخیره‌شده",
    todayVisit: "ویزیت امروز",
    addVisit: "افزودن ویزیت",
    noVisits: "هنوز ویزیتی ثبت نشده",
    emptyVisits: "ویزیت امروز را اضافه کنید تا پایش رشد و علائم حیاتی شروع شود.",
    noChiefComplaint: "بدون شکایت اصلی",
    noDiagnosis: "بدون تشخیص",
    openEditVisit: "باز کردن / ویرایش ویزیت",
    quickCalculator: "محاسبه سریع، بدون ذخیره در پرونده بیمار",
    patient: "بیمار",
    export: "خروجی",
    print: "چاپ",
    visitEntry: "ورود اطلاعات ویزیت",
    sex: "جنسیت",
    language: "زبان",
    theme: "پوسته",
    lightTheme: "روشن",
    darkTheme: "تیره",
    patientSection: "بیمار و سن",
    ageAndVisit: "سن و ویزیت",
    ageEntry: "روش ورود سن",
    ageYmd: "سن - سال، ماه، روز",
    dobGregorian: "تاریخ تولد - میلادی",
    dobJalali: "تاریخ تولد - شمسی",
    visitDate: "تاریخ ویزیت",
    dateOfBirth: "تاریخ تولد",
    year: "سال",
    month: "ماه",
    day: "روز",
    jalaliYear: "سال",
    jalaliMonth: "ماه",
    jalaliDay: "روز",
    years: "سال",
    months: "ماه",
    days: "روز",
    growthMeasurements: "اندازه‌گیری رشد",
    weightKg: "وزن (kg)",
    heightCm: "قد / طول (cm)",
    headCircCm: "دور سر (cm)",
    headCircDisabled: "رسم مرجع دور سر بعد از ۵ سالگی غیرفعال است.",
    vitalSigns: "علائم حیاتی",
    bpReference: "مرجع فشار خون",
    aapScreeningTable: "جدول غربالگری AAP",
    percentileEstimate: "برآورد صدکی",
    heartRate: "نبض",
    respiratoryRate: "تعداد تنفس",
    systolicBp: "فشار سیستولیک",
    diastolicBp: "فشار دیاستولیک",
    visitSession: "اطلاعات جلسه ویزیت",
    chiefComplaint: "شکایت اصلی",
    detailedComplaint: "شرح شکایت",
    diagnosisVisit: "تشخیص",
    diagnosisPlaceholder: "مثل قبل، یا تشخیص جدید را وارد کنید",
    physicianNote: "یادداشت پزشک",
    followUpDate: "تاریخ پیگیری",
    followUpFor: "موضوع پیگیری",
    followUpAfter: "مراجعه بعد از",
    followUpUnit: "واحد فاصله",
    followUpDue: "زمان مراجعه",
    followUpYears: "سال",
    followUpMonths: "ماه",
    followUpDays: "روز",
    saving: "در حال ذخیره...",
    saved: "ذخیره شد",
    saveGuestVisit: "ذخیره ویزیت در حالت مهمان",
    saveVisit: "ذخیره ویزیت",
    familyHeight: "قد خانوادگی",
    motherCm: "قد مادر cm",
    fatherCm: "قد پدر cm",
    chronologicalAge: "سن تقویمی",
    correctedAge: "سن اصلاح‌شده",
    daysUnit: "روز",
    correctedDays: "روز اصلاح‌شده",
    termInfant: "نوزاد ترم",
    targetHeight: "قد هدف",
    expectedRange: "محدوده مورد انتظار",
    enterParentalHeights: "قد والدین را وارد کنید",
    predictedAdultHeight: "قد پیش‌بینی‌شده بالغین",
    sameHeightPercentile: "همان صدک قد در ۱۸ سالگی",
    currentVisit: "ویزیت فعلی",
    currentVisitReference: "برای وزن/قد/BMI؛ WHO صفر تا ۵ سال برای دور سر استفاده می‌شود",
    noAutomaticFlags: "هشدار خودکاری وجود ندارد",
    noAutomaticFlagsDetail: "اندازه‌گیری‌ها آستانه‌های غربالگری تنظیم‌شده را فعال نکرده‌اند.",
    vitalSignFinding: "یافته علائم حیاتی",
    vitalSignDetail: "جزئیات علائم حیاتی",
    ageAdjustedRanges: "محدوده‌های غربالگری متناسب با سن",
    bloodPressure: "فشار خون",
    expectedRangeStatus: "در محدوده مورد انتظار",
    outsideExpectedRange: "خارج از محدوده مورد انتظار",
    bloodPressureTrend: "روند فشار خون",
    weightForAge: "وزن برای سن",
    lengthForAge: "طول برای سن",
    heightForAge: "قد برای سن",
    bmiForAge: "BMI برای سن",
    headCircForAge: "دور سر برای سن",
    weightAxis: "وزن (kg)",
    lengthAxis: "طول (cm)",
    heightAxis: "قد (cm)",
    bmiAxis: "BMI (kg/m2)",
    headCircAxis: "دور سر (cm)",
    heartRateTrend: "روند نبض",
    respiratoryRateTrend: "روند تنفس",
    longitudinalTracking: "پیگیری طولی",
    visitsInWorkspace: "در این پرونده",
    showFormula: "نمایش فرمول",
    calculationNote: "یادداشت محاسبه",
    close: "بستن",
  },
} as const;

type UiLabels = (typeof uiText)[Language];

function loadLanguage(): Language {
  return localStorage.getItem(languageStorageKey) === "fa" ? "fa" : "en";
}

function loadTheme(): Theme {
  return localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
}

function generatedPatientId(patients: PatientRecord[]) {
  const maxNumber = patients.reduce((max, patient) => {
    const match = /^P(\d+)$/.exec(patient.id.trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 100000);
  return `P${String(maxNumber + 1).padStart(6, "0")}`;
}

function displayPatientId(id: string) {
  return id.replace(/^PH-/, "");
}

function localizeDigits(value: string | number | undefined, language: Language) {
  const text = String(value ?? "");
  if (language !== "fa") return text;
  return text.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function formatDisplayDate(date: string | undefined, language: Language) {
  if (!date) return "-";
  if (language !== "fa") return date;
  const { year, month, day } = parseIsoParts(date);
  if (!year || !month || !day) return date;
  const jalali = gregorianToJalali(year, month, day);
  return localizeDigits(`${jalali.jy}/${String(jalali.jm).padStart(2, "0")}/${String(jalali.jd).padStart(2, "0")}`, language);
}

function dateAfterInterval(startDate: string, value: number, unit: FollowUpUnit) {
  const date = new Date(`${startDate}T12:00:00`);
  if (unit === "years") date.setFullYear(date.getFullYear() + value);
  if (unit === "months") date.setMonth(date.getMonth() + value);
  if (unit === "days") date.setDate(date.getDate() + value);
  return isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function followUpText(value: number, unit: FollowUpUnit, language: Language) {
  const unitLabel = language === "fa"
    ? unit === "years" ? "سال" : unit === "months" ? "ماه" : "روز"
    : unit === "years" ? "year(s)" : unit === "months" ? "month(s)" : "day(s)";
  return language === "fa" ? `پیگیری بعد از ${localizeDigits(value, language)} ${unitLabel}` : `Follow up after ${value} ${unitLabel}`;
}

function newVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: crypto.randomUUID(),
    date: today,
    ...overrides,
  };
}

function newPatientDraft(): PatientDraft {
  return {
    id: "",
    nationalId: "",
    fullName: "",
    sex: "female",
    firstPresentationAge: "",
    phone: "",
    summary: "",
    diagnosis: "",
    dob: defaultDob,
    gestationalAgeWeeks: 39,
    motherHeightCm: undefined,
    fatherHeightCm: undefined,
  };
}

function formatMonthAge(months: number, language: Language = "en") {
  if (!Number.isFinite(months)) return "-";
  const monthLabel = language === "fa" ? "ماه" : "mo";
  const yearLabel = language === "fa" ? "سال" : "yr";
  if (months < 24) {
    const value = Math.round(months * 10) / 10;
    return `${localizeDigits(Number.isInteger(value) ? value.toFixed(0) : value, language)} ${monthLabel}`;
  }
  const years = Math.floor(months / 12);
  const remainingMonths = Math.round(months - years * 12);
  return `${localizeDigits(years, language)} ${yearLabel} ${localizeDigits(remainingMonths, language)} ${monthLabel}`;
}

function loadPatients() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed as PatientRecord[] : [];
  } catch {
    return [];
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>("lookup");
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [patients, setPatients] = useState<PatientRecord[]>(loadPatients);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [patientDraft, setPatientDraft] = useState<PatientDraft>(newPatientDraft);
  const [formulaInfo, setFormulaInfo] = useState<{ title: string; body: string } | null>(null);
  const [bpMethod, setBpMethod] = useState<BpMethod>("table");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [hideMobileTopbar, setHideMobileTopbar] = useState(false);
  const [overscroll, setOverscroll] = useState({ top: 0, bottom: 0 });
  const overscrollRef = useRef(overscroll);
  const [guestPatient, setGuestPatient] = useState<Patient>(defaultPatient);
  const [guestVisits, setGuestVisits] = useState<Visit[]>([newVisit()]);
  const [birthInputMode, setBirthInputMode] = useState<BirthInputMode>("age");
  const [ageInput, setAgeInput] = useState<AgeInput>(defaultAgeInput);
  const [jalaliDob, setJalaliDob] = useState({ year: defaultJalali.jy, month: defaultJalali.jm, day: defaultJalali.jd });
  const [draft, setDraft] = useState<Visit>(guestVisits[0]);
  const [followUpInterval, setFollowUpInterval] = useState<{ value: number | undefined; unit: FollowUpUnit }>({ value: undefined, unit: "months" });
  const labels = uiText[language];
  const d = (value: string | number | undefined) => localizeDigits(value, language);
  const shellClass = `app-shell ${language === "fa" ? "rtl" : ""} ${theme === "dark" ? "theme-dark" : "theme-light"} ${hideMobileTopbar ? "mobile-topbar-hidden" : ""} ${overscroll.top ? "is-overscrolling-top" : ""} ${overscroll.bottom ? "is-overscrolling-bottom" : ""}`;
  const shellStyle = { "--overscroll-top": `${overscroll.top}px`, "--overscroll-bottom": `${overscroll.bottom}px` } as React.CSSProperties;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    overscrollRef.current = overscroll;
  }, [overscroll]);

  useEffect(() => {
    localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language === "fa" ? "fa" : "en";
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    localStorage.setItem(themeStorageKey, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let lastY = window.scrollY;
    function handleScroll() {
      if (window.innerWidth > 640) {
        setHideMobileTopbar(false);
        return;
      }
      const currentY = window.scrollY;
      if (currentY <= 8) setHideMobileTopbar(false);
      else if (currentY > lastY && currentY > 64) setHideMobileTopbar(true);
      else if (currentY < lastY) setHideMobileTopbar(false);
      lastY = currentY;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    let startY = 0;
    let active = false;
    const maxPull = 74;

    const reset = () => {
      active = false;
      setOverscroll({ top: 0, bottom: 0 });
    };

    const scrollElement = () => document.scrollingElement ?? document.documentElement;

    function handleTouchStart(event: TouchEvent) {
      if (window.innerWidth > 760 || event.touches.length !== 1) return;
      active = true;
      startY = event.touches[0].clientY;
    }

    function handleTouchMove(event: TouchEvent) {
      if (!active || event.touches.length !== 1) return;
      const element = scrollElement();
      const delta = event.touches[0].clientY - startY;
      const maxScroll = element.scrollHeight - element.clientHeight;
      const atTop = element.scrollTop <= 0;
      const atBottom = element.scrollTop >= maxScroll - 1;
      const pull = Math.min(maxPull, Math.pow(Math.abs(delta), 0.78) * 1.35);

      if (atTop && delta > 0) {
        setOverscroll((prev) => Math.abs(prev.top - pull) > 1 ? { top: pull, bottom: 0 } : prev);
      } else if (atBottom && delta < 0 && maxScroll > 0) {
        setOverscroll((prev) => Math.abs(prev.bottom - pull) > 1 ? { top: 0, bottom: pull } : prev);
      } else if (overscrollRef.current.top || overscrollRef.current.bottom) {
        setOverscroll({ top: 0, bottom: 0 });
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", reset, { passive: true });
    window.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", reset);
      window.removeEventListener("touchcancel", reset);
    };
  }, []);

  const selectedRecord = patients.find((patient) => patient.id === selectedPatientId);
  const patient: Patient = isGuest ? guestPatient : selectedRecord ?? defaultPatient;
  const visits = isGuest ? guestVisits : selectedRecord?.visits ?? [];

  useEffect(() => {
    const { year, month, day } = parseIsoParts(patient.dob);
    const jalali = gregorianToJalali(year, month, day);
    setJalaliDob({ year: jalali.jy, month: jalali.jm, day: jalali.jd });
  }, [patient.dob]);

  const displayedVisits = useMemo(() => [...visits, draft].filter((visit, index, array) => array.findIndex((item) => item.id === visit.id) === index).sort((a, b) => a.date.localeCompare(b.date)), [visits, draft]);
  const latest = draft;
  const age = useMemo(() => calculateAge(patient.dob, latest.date, patient.gestationalAgeWeeks), [patient, latest.date]);
  const scores = useMemo(
    () =>
      calculateScores({
        sex: patient.sex,
        ageDays: age.chronologicalDays,
        ageMonths: age.chronologicalMonths,
        correctedDays: age.correctedDays,
        correctedMonths: age.correctedMonths,
        gestationalAgeWeeks: patient.gestationalAgeWeeks,
        weightKg: latest.weightKg,
        heightCm: latest.heightCm,
        headCircumferenceCm: latest.headCircumferenceCm,
      }),
    [patient.sex, patient.gestationalAgeWeeks, latest, age],
  );
  const reference = referenceForAge(age.chronologicalMonths, patient.gestationalAgeWeeks, age.correctedMonths);
  const ageYears = age.chronologicalDays / 365.25;
  const heightPct = scores.find((s) => s.metric === "height")?.percentile;
  const vitalFindings = vitalInterpretation(ageYears, patient.sex, heightPct, latest.systolicBp, latest.diastolicBp, latest.heartRate, latest.respiratoryRate, bpMethod);
  const alerts = [...interpretScores(scores, displayedVisits), ...vitalFindings.map((detail) => ({ title: labels.vitalSignFinding, detail, tone: "warn" as const }))];
  const familyTarget = targetHeight(patient.sex, patient.motherHeightCm, patient.fatherHeightCm);
  const heightScore = scores.find((s) => s.metric === "height");
  const predicted = predictedHeightAt18FromZ(patient.sex, heightScore?.z);
  const velocities = growthVelocity(displayedVisits);
  const hrRange = heartRateRange(ageYears);
  const rrRange = respiratoryRateRange(ageYears);
  const bpThresholds = bloodPressureThresholds(ageYears, patient.sex, heightPct);
  const bpScreen = bloodPressureScreeningTable(ageYears, patient.sex);
  const bpCategory = bloodPressureCategory(ageYears, patient.sex, heightPct, latest.systolicBp, latest.diastolicBp, bpMethod);
  const showHeadCircumference = ageYears <= 5;
  const jalaliVisitDate = (() => {
    const { year, month, day } = parseIsoParts(draft.date);
    const jalali = gregorianToJalali(year, month, day);
    return { year: jalali.jy, month: jalali.jm, day: jalali.jd };
  })();

  const filteredPatients = patients.filter((patient) => {
    const haystack = [patient.id, patient.fullName, patient.nationalId, patient.phone, patient.diagnosis].join(" ").toLowerCase();
    return haystack.includes(searchText.trim().toLowerCase());
  });
  const visitSessions = useMemo(() => [...(selectedRecord?.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [selectedRecord?.visits]);

  function updatePatientRecord(updater: (record: PatientRecord) => PatientRecord) {
    if (!selectedPatientId) return;
    setPatients((prev) => prev.map((record) => record.id === selectedPatientId ? updater(record) : record));
  }

  const setPatientField = <K extends keyof Patient>(key: K, value: Patient[K]) => {
    if (isGuest) setGuestPatient((prev) => ({ ...prev, [key]: value }));
    else updatePatientRecord((record) => ({ ...record, [key]: value }));
  };
  const setDraftField = <K extends keyof Visit>(key: K, value: Visit[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  function addPatient() {
    const id = patientDraft.id.trim() || generatedPatientId(patients);
    const record: PatientRecord = {
      ...patientDraft,
      id,
      fullName: patientDraft.fullName.trim() || "Unnamed patient",
      visits: [],
    };
    setPatients((prev) => [record, ...prev.filter((patient) => patient.id !== id)]);
    setPatientDraft(newPatientDraft());
    setIsGuest(false);
    setSelectedPatientId(record.id);
    setScreen("visits");
  }

  function deletePatient(id: string) {
    const patient = patients.find((record) => record.id === id);
    if (!patient || !window.confirm(`Delete ${patient.fullName || patient.id} and all saved visits?`)) return;
    setPatients((prev) => prev.filter((record) => record.id !== id));
    if (selectedPatientId === id) {
      setSelectedPatientId(null);
      setScreen("lookup");
    }
  }

  function deleteVisit(visitId: string) {
    if (!window.confirm("Delete this visit session?")) return;
    if (isGuest) {
      setGuestVisits((prev) => prev.filter((visit) => visit.id !== visitId));
      if (draft.id === visitId) setDraft(newVisit());
      return;
    }
    updatePatientRecord((record) => ({ ...record, visits: record.visits.filter((visit) => visit.id !== visitId) }));
    if (draft.id === visitId) setScreen("visits");
  }

  function openPatient(id: string) {
    const record = patients.find((patient) => patient.id === id);
    setIsGuest(false);
    setSelectedPatientId(id);
    setScreen("visits");
    if (record?.visits[0]) setDraft(record.visits[record.visits.length - 1]);
  }

  function startGuest() {
    const visit = newVisit();
    setIsGuest(true);
    setSelectedPatientId(null);
    setGuestPatient(defaultPatient);
    setGuestVisits([visit]);
    setDraft(visit);
    setFollowUpInterval({ value: undefined, unit: "months" });
    setBirthInputMode("age");
    setScreen("assessment");
  }

  function startVisit(visit?: Visit) {
    const baseDiagnosis = selectedRecord?.diagnosis;
    setDraft(visit ? { ...visit } : newVisit({ diagnosis: baseDiagnosis }));
    setFollowUpInterval({ value: undefined, unit: "months" });
    setBirthInputMode("age");
    setScreen("assessment");
  }

  function setGregorianDob(dob: string) {
    setPatientField("dob", dob);
    const { year, month, day } = parseIsoParts(dob);
    const jalali = gregorianToJalali(year, month, day);
    setJalaliDob({ year: jalali.jy, month: jalali.jm, day: jalali.jd });
  }

  function setJalaliDobField(key: "year" | "month" | "day", value: number) {
    const next = { ...jalaliDob, [key]: value };
    setJalaliDob(next);
    const gregorian = jalaliToGregorian(next.year, next.month, next.day);
    setPatientField("dob", isoDate(gregorian.gy, gregorian.gm, gregorian.gd));
  }

  function setAgeInputField(key: keyof AgeInput, value: number) {
    const next = { ...ageInput, [key]: Math.max(0, value || 0) };
    setAgeInput(next);
    setPatientField("dob", dateFromAge(draft.date, next));
  }

  function setVisitDate(date: string) {
    setDraftField("date", date);
    if (birthInputMode === "age") setPatientField("dob", dateFromAge(date, ageInput));
    if (followUpInterval.value !== undefined) {
      const value = Math.max(0, followUpInterval.value || 0);
      setDraft((prev) => ({
        ...prev,
        date,
        followUpDate: value ? dateAfterInterval(date, value, followUpInterval.unit) : undefined,
        followUpPlan: value ? followUpText(value, followUpInterval.unit, language) : undefined,
      }));
    }
  }

  function setJalaliIsoDate(date: string | undefined, key: "year" | "month" | "day", value: number) {
    const base = parseIsoParts(date || today);
    const jalali = gregorianToJalali(base.year, base.month, base.day);
    const next = { year: jalali.jy, month: jalali.jm, day: jalali.jd, [key]: value };
    const gregorian = jalaliToGregorian(next.year, next.month, next.day);
    return isoDate(gregorian.gy, gregorian.gm, gregorian.gd);
  }

  function setFollowUp(value: number | undefined, unit: FollowUpUnit = followUpInterval.unit) {
    const normalized = value === undefined ? undefined : Math.max(0, value || 0);
    setFollowUpInterval({ value: normalized, unit });
    setDraft((prev) => ({
      ...prev,
      followUpDate: normalized ? dateAfterInterval(prev.date, normalized, unit) : undefined,
      followUpPlan: normalized ? followUpText(normalized, unit, language) : undefined,
    }));
  }

  function saveVisit() {
    setSaveState("saving");
    const next = { ...draft, id: draft.id || crypto.randomUUID() };
    if (isGuest) {
      setGuestVisits((prev) => [...prev.filter((v) => v.id !== next.id), next].sort((a, b) => a.date.localeCompare(b.date)));
    } else {
      updatePatientRecord((record) => ({
        ...record,
        diagnosis: next.diagnosis || record.diagnosis,
        visits: [...record.visits.filter((v) => v.id !== next.id), next].sort((a, b) => a.date.localeCompare(b.date)),
      }));
    }
    setDraft(next);
    window.setTimeout(() => {
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    }, 180);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ patient: isGuest ? patient : selectedRecord, visits: displayedVisits, scores, alerts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = isGuest ? "guest-growth-assessment.json" : `${selectedRecord?.id ?? "patient"}-growth-assessment.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const chartReference = (metric: MetricKey) => scores.find((s) => s.metric === metric)?.reference ?? reference;
  const chartPoint = (metric: MetricKey) =>
    displayedVisits
      .map((visit) => {
        const visitAge = calculateAge(patient.dob, visit.date, patient.gestationalAgeWeeks);
        const ref = chartReference(metric);
        const rawX = ref === "Olsen preterm" ? patient.gestationalAgeWeeks + visitAge.chronologicalDays / 7 : visitAge.chronologicalMonths;
        const x = Math.round(rawX * 10) / 10;
        const y = metric === "weight" ? visit.weightKg : metric === "height" ? visit.heightCm : metric === "headc" ? visit.headCircumferenceCm : metric === "bmi" && visit.weightKg && visit.heightCm ? visit.weightKg / Math.pow(visit.heightCm / 100, 2) : undefined;
        return y ? { x, y: Math.round(y * 10) / 10, label: visit.date } : undefined;
      })
      .filter(Boolean) as { x: number; y: number; label: string }[];

  const vitalPoints = (key: "heartRate" | "respiratoryRate" | "systolicBp" | "diastolicBp") =>
    displayedVisits.map((visit, index) => ({ x: index + 1, y: visit[key], label: visit.date })).filter((point) => point.y !== undefined);

  const bpPoints = displayedVisits.flatMap((visit, index) => [
    { x: index + 1, y: visit.systolicBp, label: visit.date, series: "Systolic" },
    { x: index + 1, y: visit.diastolicBp, label: visit.date, series: "Diastolic" },
  ]).filter((point) => point.y !== undefined);

  const patientTitle = isGuest ? labels.guestMode : selectedRecord?.fullName ?? labels.patient;
  const patientSub = isGuest ? labels.quickCalculator : `${selectedRecord?.id ?? ""}${selectedRecord?.diagnosis ? ` - ${selectedRecord.diagnosis}` : ""}`;

  if (screen === "lookup") {
    return (
      <main className={shellClass} style={shellStyle} lang={language} dir={language === "fa" ? "rtl" : "ltr"}>
        <SideNav active="patients" labels={labels} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} />
        <header className="topbar">
          <div>
            <div className="app-kicker">Ped Studio</div>
            <h1>{labels.patientLookup}</h1>
          </div>
          <div className="top-actions">
            <div className="mobile-shell-controls">
              <LanguageSwitch language={language} setLanguage={setLanguage} label={labels.language} />
              <ThemeSwitch theme={theme} setTheme={setTheme} labels={labels} />
            </div>
            <button className="primary compact-primary" onClick={startGuest} title={labels.guestMode}><Activity size={18} /> {labels.guestMode}</button>
          </div>
        </header>
        <section className="landing-workspace">
          <section className="lookup-panel">
            <div className="panel-heading">
              <div>
                <h2>{labels.findPatient}</h2>
                <p>{labels.findPatientHint}</p>
              </div>
              <Search size={20} />
            </div>
            <div className="lookup-search">
              <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={labels.searchPlaceholder} />
            </div>
            <div className="patient-results">
              {filteredPatients.length ? filteredPatients.map((patient) => (
                <div key={patient.id} className="patient-card">
                  <button className="card-main-action" onClick={() => openPatient(patient.id)}>
                      <span className={`patient-avatar ${patient.sex}`} aria-hidden="true" />
                      <span className="patient-card-content">
                        <strong>{patient.fullName}</strong>
                        <span className="patient-data-line"><b>{labels.cardPatientId}</b>{d(displayPatientId(patient.id))}</span>
                        <span className="patient-data-line"><b>{labels.cardNationalId}</b>{patient.nationalId ? d(patient.nationalId) : labels.noNationalId}</span>
                        <small className="patient-data-line"><b>{labels.cardPhone}</b>{patient.phone ? d(patient.phone) : labels.noPhone}</small>
                        {patient.diagnosis && <span className="diagnosis-line patient-data-line"><b>{labels.cardDiagnosis}</b>{patient.diagnosis}</span>}
                    </span>
                  </button>
                  <button className="danger-icon-button" onClick={() => deletePatient(patient.id)} title="Delete patient" aria-label={`Delete ${patient.fullName}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )) : (
                <div className="empty-state">
                  <Users size={28} />
                  <strong>{labels.noMatchingPatient}</strong>
                  <span>{labels.emptyLookup}</span>
                </div>
              )}
            </div>
          </section>

          <section className="lookup-panel">
            <div className="panel-heading">
              <div>
                <h2>{labels.addPatient}</h2>
                <p>{labels.addPatientHint}</p>
              </div>
              <UserPlus size={20} />
            </div>
            <div className="add-patient-form">
              <div className="field-grid two">
                <label>
                  {labels.patientId}
                  <input value={patientDraft.id} onChange={(event) => setPatientDraft((prev) => ({ ...prev, id: event.target.value }))} placeholder={labels.patientIdPlaceholder} />
                </label>
                <label>
                  {labels.nationalId}
                  <input value={patientDraft.nationalId} onChange={(event) => setPatientDraft((prev) => ({ ...prev, nationalId: event.target.value }))} />
                </label>
                <label>
                  {labels.fullName}
                  <input value={patientDraft.fullName} onChange={(event) => setPatientDraft((prev) => ({ ...prev, fullName: event.target.value }))} />
                </label>
                <label>
                  {labels.gender}
                  <select value={patientDraft.sex} onChange={(event) => setPatientDraft((prev) => ({ ...prev, sex: event.target.value as Sex }))}>
                    <option value="female">{labels.female}</option>
                    <option value="male">{labels.male}</option>
                  </select>
                </label>
                <label>
                  {labels.firstPresentationAge}
                  <input value={patientDraft.firstPresentationAge} onChange={(event) => setPatientDraft((prev) => ({ ...prev, firstPresentationAge: event.target.value }))} placeholder={labels.firstPresentationPlaceholder} />
                </label>
                <label>
                  {labels.phoneNumber}
                  <input value={patientDraft.phone} onChange={(event) => setPatientDraft((prev) => ({ ...prev, phone: event.target.value }))} />
                </label>
                <label>
                  {labels.gestationalAge}
                  <input type="text" inputMode="decimal" value={d(patientDraft.gestationalAgeWeeks)} onChange={(event) => setPatientDraft((prev) => ({ ...prev, gestationalAgeWeeks: Number(normalizeDigits(event.target.value)) }))} />
                </label>
              </div>
              <label>
                {labels.summary}
                <textarea value={patientDraft.summary} onChange={(event) => setPatientDraft((prev) => ({ ...prev, summary: event.target.value }))} />
              </label>
              <label>
                {labels.diagnosis}
                <textarea value={patientDraft.diagnosis} onChange={(event) => setPatientDraft((prev) => ({ ...prev, diagnosis: event.target.value }))} />
              </label>
              <button className="primary" onClick={addPatient}><UserPlus size={18} /> {labels.addPatient}</button>
            </div>
          </section>
        </section>
      </main>
    );
  }

  if (screen === "visits" && selectedRecord) {
    return (
      <main className={shellClass} style={shellStyle} lang={language} dir={language === "fa" ? "rtl" : "ltr"}>
        <SideNav active="visits" labels={labels} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} />
        <header className="topbar">
          <div>
            <div className="app-kicker">Ped Studio</div>
            <h1>{selectedRecord.fullName}</h1>
            <p>{d(selectedRecord.id)} - {selectedRecord.nationalId ? d(selectedRecord.nationalId) : labels.noNationalId}</p>
          </div>
          <div className="top-actions">
            <div className="mobile-shell-controls">
              <LanguageSwitch language={language} setLanguage={setLanguage} label={labels.language} />
              <ThemeSwitch theme={theme} setTheme={setTheme} labels={labels} />
            </div>
            <button onClick={() => setScreen("lookup")} title={labels.patients}><ArrowLeft size={18} /> {labels.patients}</button>
            <button className="primary compact-primary" onClick={() => startVisit()} title={labels.todayVisit}><Plus size={18} /> {labels.todayVisit}</button>
          </div>
        </header>
        <section className="patient-workspace">
          <section className="lookup-panel">
            <div className="panel-heading">
              <div>
                <h2>{labels.patientSummary}</h2>
                <p>{selectedRecord.phone || labels.noPhone}{selectedRecord.firstPresentationAge ? ` - ${labels.firstPresentation}: ${selectedRecord.firstPresentationAge}` : ""}</p>
              </div>
            </div>
            <div className="patient-profile-grid">
              <ProfileItem label={labels.gender} value={selectedRecord.sex === "female" ? labels.female : labels.male} />
              <ProfileItem label={labels.gestationalAge} value={`${d(selectedRecord.gestationalAgeWeeks)} wk`} />
              <ProfileItem label={labels.diagnosis} value={selectedRecord.diagnosis || "-"} />
              <ProfileItem label={labels.summary} value={selectedRecord.summary || "-"} />
            </div>
          </section>
          <section className="lookup-panel">
            <div className="panel-heading">
              <div>
                <h2>{labels.visitSessions}</h2>
                <p>{d(selectedRecord.visits.length)} {selectedRecord.visits.length === 1 ? labels.savedVisit : labels.savedVisits}</p>
              </div>
              <button onClick={() => startVisit()}><Plus size={18} /> {labels.addVisit}</button>
            </div>
            <div className="visit-session-list">
              {visitSessions.length ? visitSessions.map((visit) => (
                <div key={visit.id} className="visit-session-card">
                  <button className="card-main-action" onClick={() => startVisit(visit)}>
                    <strong>{formatDisplayDate(visit.date, language)}</strong>
                    <span>{visit.chiefComplaint || labels.noChiefComplaint}</span>
                    <small>{visit.diagnosis || selectedRecord.diagnosis || labels.noDiagnosis}</small>
                    <span className="edit-visit-line">{labels.openEditVisit}</span>
                  </button>
                  <button className="danger-icon-button" onClick={() => deleteVisit(visit.id)} title="Delete visit" aria-label={`Delete visit from ${visit.date}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )) : (
                <div className="empty-state">
                  <Activity size={28} />
                  <strong>{labels.noVisits}</strong>
                  <span>{labels.emptyVisits}</span>
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className={shellClass} style={shellStyle} lang={language} dir={language === "fa" ? "rtl" : "ltr"}>
      <SideNav active="assessment" labels={labels} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} />
      <header className="topbar">
        <div>
          <div className="app-kicker">Ped Studio</div>
          <h1>{patientTitle}</h1>
          <p>{patientSub}</p>
        </div>
        <div className="top-actions">
          <div className="mobile-shell-controls">
            <LanguageSwitch language={language} setLanguage={setLanguage} label={labels.language} />
            <ThemeSwitch theme={theme} setTheme={setTheme} labels={labels} />
          </div>
          <button onClick={() => setScreen(isGuest ? "lookup" : "visits")} title={isGuest ? labels.patients : labels.visits}><ArrowLeft size={18} /> {isGuest ? labels.patients : labels.visits}</button>
          <button onClick={exportJson} title={labels.export}><FileDown size={18} /> {labels.export}</button>
          <button onClick={() => window.print()} title={labels.print}><Printer size={18} /> {labels.print}</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="entry-panel">
          <div className="panel-title">
            <Stethoscope size={19} />
            <h2>{labels.visitEntry}</h2>
          </div>

          <div className="input-section">
            <h3>{labels.visitDate}</h3>
            <div className="field-grid one">
              {language === "fa" ? (
                <JalaliDatePicker
                  label={labels.visitDate}
                  value={jalaliVisitDate}
                  labels={labels}
                  yearStart={jalaliVisitDate.year - 5}
                  yearEnd={jalaliVisitDate.year + 5}
                  onChange={(next) => {
                    const gregorian = jalaliToGregorian(next.year, next.month, next.day);
                    setVisitDate(isoDate(gregorian.gy, gregorian.gm, gregorian.gd));
                  }}
                />
              ) : (
                <label>
                  {labels.visitDate}
                  <input type="date" value={draft.date} onChange={(e) => setVisitDate(e.target.value)} />
                </label>
              )}
            </div>
          </div>

          <div className="input-section">
            <h3>{labels.patientSection}</h3>
            <div className="field-grid two">
              <label>
                {labels.sex}
                <select value={patient.sex} onChange={(e) => setPatientField("sex", e.target.value as Sex)}>
                  <option value="female">{labels.female}</option>
                  <option value="male">{labels.male}</option>
                </select>
              </label>
              <label>
                {labels.gestationalAge}
                <input type="text" inputMode="decimal" value={d(patient.gestationalAgeWeeks)} onChange={(e) => setPatientField("gestationalAgeWeeks", Number(normalizeDigits(e.target.value)))} />
              </label>
              <label>
                {labels.ageEntry}
                <select value={birthInputMode} onChange={(e) => setBirthInputMode(e.target.value as BirthInputMode)}>
                  <option value="age">{labels.ageYmd}</option>
                  <option value="gregorian">{labels.dobGregorian}</option>
                  <option value="jalali">{labels.dobJalali}</option>
                </select>
              </label>
            </div>
            {birthInputMode === "gregorian" && <div className="field-grid one birth-fields"><label>{labels.dateOfBirth}<input type="date" value={patient.dob} onChange={(e) => setGregorianDob(e.target.value)} /></label></div>}
            {birthInputMode === "jalali" && (
              <div className="field-grid one birth-fields">
                <JalaliDatePicker
                  label={labels.dateOfBirth}
                  value={jalaliDob}
                  labels={labels}
                  yearStart={jalaliVisitDate.year - 21}
                  yearEnd={jalaliVisitDate.year}
                  onChange={(next) => {
                    setJalaliDob(next);
                    const gregorian = jalaliToGregorian(next.year, next.month, next.day);
                    setPatientField("dob", isoDate(gregorian.gy, gregorian.gm, gregorian.gd));
                  }}
                />
              </div>
            )}
            {birthInputMode === "age" && (
              <div className="field-grid three birth-fields">
                <NumberField label={labels.years} value={ageInput.years} step={1} set={(v) => setAgeInputField("years", v ?? 0)} />
                <NumberField label={labels.months} value={ageInput.months} step={1} set={(v) => setAgeInputField("months", v ?? 0)} />
                <NumberField label={labels.days} value={ageInput.days} step={1} set={(v) => setAgeInputField("days", v ?? 0)} />
              </div>
            )}
          </div>

          <div className="input-section">
            <h3>{labels.growthMeasurements}</h3>
            <div className="field-grid two">
              <NumberField label={labels.weightKg} value={draft.weightKg} set={(v) => setDraftField("weightKg", v)} />
              <NumberField label={labels.heightCm} value={draft.heightCm} set={(v) => setDraftField("heightCm", v)} />
              <NumberField label={labels.headCircCm} value={draft.headCircumferenceCm} disabled={!showHeadCircumference} title={!showHeadCircumference ? labels.headCircDisabled : undefined} set={(v) => setDraftField("headCircumferenceCm", v)} />
            </div>
          </div>

          <div className="input-section">
            <h3>{labels.vitalSigns}</h3>
            <div className="field-grid two">
              <label>{labels.bpReference}<select value={bpMethod} onChange={(e) => setBpMethod(e.target.value as BpMethod)}><option value="table">{labels.aapScreeningTable}</option><option value="estimate">{labels.percentileEstimate}</option></select></label>
              <NumberField label={labels.heartRate} value={draft.heartRate} set={(v) => setDraftField("heartRate", v)} />
              <NumberField label={labels.respiratoryRate} value={draft.respiratoryRate} set={(v) => setDraftField("respiratoryRate", v)} />
              <NumberField label={labels.systolicBp} value={draft.systolicBp} set={(v) => setDraftField("systolicBp", v)} />
              <NumberField label={labels.diastolicBp} value={draft.diastolicBp} set={(v) => setDraftField("diastolicBp", v)} />
            </div>
          </div>

          <div className="input-section">
            <h3>{labels.visitSession}</h3>
            <label>{labels.chiefComplaint}<input value={draft.chiefComplaint ?? ""} onChange={(e) => setDraftField("chiefComplaint", e.target.value)} /></label>
            <label>{labels.detailedComplaint}<textarea value={draft.detailedComplaint ?? ""} onChange={(e) => setDraftField("detailedComplaint", e.target.value)} /></label>
            <label>{labels.diagnosisVisit}<input value={draft.diagnosis ?? selectedRecord?.diagnosis ?? ""} onChange={(e) => setDraftField("diagnosis", e.target.value)} placeholder={labels.diagnosisPlaceholder} /></label>
            <label>{labels.physicianNote}<textarea value={draft.physicianNote ?? ""} onChange={(e) => setDraftField("physicianNote", e.target.value)} /></label>
            <div className="field-grid two">
              <NumberField label={labels.followUpAfter} value={followUpInterval.value} step={1} set={(v) => setFollowUp(v, followUpInterval.unit)} />
              <label>
                {labels.followUpUnit}
                <select value={followUpInterval.unit} onChange={(e) => setFollowUp(followUpInterval.value, e.target.value as FollowUpUnit)}>
                  <option value="years">{labels.followUpYears}</option>
                  <option value="months">{labels.followUpMonths}</option>
                  <option value="days">{labels.followUpDays}</option>
                </select>
              </label>
              <div className="converted-date">{labels.followUpDue}: {formatDisplayDate(draft.followUpDate, language)}</div>
            </div>
          </div>

          <button className={`primary save-button ${saveState !== "idle" ? `is-${saveState}` : ""}`} onClick={saveVisit} disabled={saveState === "saving"}>
            {saveState === "saved" ? <CheckCircle2 size={18} /> : <Save size={18} />}
            {saveState === "saving" ? labels.saving : saveState === "saved" ? labels.saved : isGuest ? labels.saveGuestVisit : labels.saveVisit}
          </button>

          <div className="input-section">
            <h3>{labels.familyHeight}</h3>
            <div className="field-grid two">
              <NumberField label={labels.motherCm} value={patient.motherHeightCm} set={(v) => setPatientField("motherHeightCm", v)} />
              <NumberField label={labels.fatherCm} value={patient.fatherHeightCm} set={(v) => setPatientField("fatherHeightCm", v)} />
            </div>
          </div>
        </aside>

        <section className="results">
          <div className="summary-grid">
            <Metric title={labels.chronologicalAge} value={formatMonthAge(age.chronologicalMonths, language)} detail={`${d(age.chronologicalDays)} ${labels.daysUnit}`} />
            <Metric title={labels.correctedAge} value={patient.gestationalAgeWeeks < 37 ? formatMonthAge(age.correctedMonths, language) : formatMonthAge(age.chronologicalMonths, language)} detail={patient.gestationalAgeWeeks < 37 ? `${d(age.correctedDays)} ${labels.correctedDays}` : labels.termInfant} infoLabel={labels.showFormula} onInfo={() => setFormulaInfo({ title: labels.correctedAge, body: "Corrected age = chronological age - (40 weeks - gestational age at birth). It is clamped at zero days for early newborn visits." })} />
            <Metric title={labels.targetHeight} value={familyTarget ? `${d(round(familyTarget.mid, 1))} cm` : "-"} detail={familyTarget ? `${d(round(familyTarget.low, 1))}-${d(round(familyTarget.high, 1))} cm ${labels.expectedRange}` : labels.enterParentalHeights} infoLabel={labels.showFormula} onInfo={() => setFormulaInfo({ title: labels.targetHeight, body: "Male target height = (mother height + father height + 13 cm) / 2. Female target height = (mother height + father height - 13 cm) / 2. Expected range shown is target height +/- 8.5 cm." })} />
            <Metric title={labels.predictedAdultHeight} value={predicted ? `${d(round(predicted, 1))} cm` : "-"} detail={d(labels.sameHeightPercentile)} infoLabel={labels.showFormula} onInfo={() => setFormulaInfo({ title: labels.predictedAdultHeight, body: "Predicted adult height = the CDC height value at age 18 years for the child's current height-for-age Z-score/percentile. It assumes the child remains on the same height percentile and does not use bone age." })} />
          </div>

          <section className="score-panel current-visit-panel">
            <div className="panel-heading">
              <div>
                <h2>{labels.currentVisit}</h2>
                <p>{formatDisplayDate(latest.date, language)} - {reference} {labels.currentVisitReference}</p>
              </div>
              <Activity size={21} />
            </div>
            <div className="score-table">
              {scores.map((s) => (
                <div className="score-row" key={s.metric}>
                  <span>{s.label}</span>
                  <strong>{d(round(s.value, s.metric === "bmi" ? 1 : 2))} {s.unit}</strong>
                  <span>Z {d(round(s.z, 2))}</span>
                  <span>P{d(round(s.percentile, 1))}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="alerts">
            {alerts.length ? alerts.map((alert) => <div className={`alert ${alert.tone}`} key={`${alert.title}-${alert.detail}`}><strong>{alert.title}</strong><span>{alert.detail}</span></div>) : <div className="alert info"><strong>{labels.noAutomaticFlags}</strong><span>{labels.noAutomaticFlagsDetail}</span></div>}
          </section>

          <section className="vitals-section">
            <section className="score-panel">
              <div className="panel-heading">
                <div><h2>{labels.vitalSignDetail}</h2><p>{labels.ageAdjustedRanges}</p></div>
                <InfoButton label={labels.showFormula} onClick={() => setFormulaInfo({ title: "Blood Pressure Screening", body: "The full 2017 AAP BP tables include sex, age, height percentile columns, and BP percentile thresholds including 50th, 90th, 95th, and 95th+12 mmHg. This app currently offers the AAP simplified screening table, which is a threshold for further evaluation, and a separate estimated percentile mode. The estimate is not a replacement for the full AAP lookup tables." })} />
              </div>
              <div className="vital-grid">
                <VitalDetail title={labels.bloodPressure} value={latest.systolicBp && latest.diastolicBp ? `${d(latest.systolicBp)}/${d(latest.diastolicBp)} mmHg` : "-"} status={bpCategory.category} detail={d(bpCategory.detail)} />
                <VitalDetail title={labels.heartRate} value={latest.heartRate ? `${d(latest.heartRate)}/min` : "-"} status={latest.heartRate && (latest.heartRate < hrRange.low || latest.heartRate > hrRange.high) ? labels.outsideExpectedRange : labels.expectedRangeStatus} detail={`${hrRange.label}: ${d(hrRange.low)}-${d(hrRange.high)}/min`} />
                <VitalDetail title={labels.respiratoryRate} value={latest.respiratoryRate ? `${d(latest.respiratoryRate)}/min` : "-"} status={latest.respiratoryRate && (latest.respiratoryRate < rrRange.low || latest.respiratoryRate > rrRange.high) ? labels.outsideExpectedRange : labels.expectedRangeStatus} detail={`${rrRange.label}: ${d(rrRange.low)}-${d(rrRange.high)}/min`} />
              </div>
            </section>
            <div className="vital-charts">
              <VitalChart title={labels.bloodPressureTrend} unit="mmHg" yLabel="Blood pressure (mmHg)" points={bpPoints} lines={bpMethod === "table" ? [
                { label: `Systolic evaluation threshold: ${bpScreen.systolic} mmHg`, value: bpScreen.systolic, color: "#1d5f8a" },
                { label: `Diastolic evaluation threshold: ${bpScreen.diastolic} mmHg`, value: bpScreen.diastolic, color: "#7b4ab3" },
              ] : [
                { label: `Systolic estimated 90th: ${bpThresholds.systolic90.toFixed(0)} mmHg`, value: bpThresholds.systolic90, color: "#79a8c8" },
                { label: `Systolic estimated 95th: ${bpThresholds.systolic95.toFixed(0)} mmHg`, value: bpThresholds.systolic95, color: "#1d5f8a" },
                { label: `Diastolic estimated 90th: ${bpThresholds.diastolic90.toFixed(0)} mmHg`, value: bpThresholds.diastolic90, color: "#b69bd8" },
                { label: `Diastolic estimated 95th: ${bpThresholds.diastolic95.toFixed(0)} mmHg`, value: bpThresholds.diastolic95, color: "#7b4ab3" },
              ]} />
              <VitalChart title={labels.heartRateTrend} unit="/min" yLabel="Heart rate (/min)" points={vitalPoints("heartRate")} bands={[{ label: labels.expectedRangeStatus, low: hrRange.low, high: hrRange.high, color: "#2f9fe8" }]} />
              <VitalChart title={labels.respiratoryRateTrend} unit="/min" yLabel="Respiratory rate (/min)" points={vitalPoints("respiratoryRate")} bands={[{ label: labels.expectedRangeStatus, low: rrRange.low, high: rrRange.high, color: "#2f9fe8" }]} />
            </div>
          </section>

          <section className="charts">
            <GrowthChart metric="weight" title={labels.weightForAge} sex={patient.sex} reference={chartReference("weight")} points={chartPoint("weight")} unit="kg" yLabel={labels.weightAxis} />
            <GrowthChart metric="height" title={age.chronologicalMonths < 24 ? labels.lengthForAge : labels.heightForAge} sex={patient.sex} reference={chartReference("height")} points={chartPoint("height")} unit="cm" yLabel={age.chronologicalMonths < 24 ? labels.lengthAxis : labels.heightAxis} />
            <GrowthChart metric="bmi" title={labels.bmiForAge} sex={patient.sex} reference={chartReference("bmi")} points={chartPoint("bmi")} unit="kg/m2" yLabel={labels.bmiAxis} />
            {showHeadCircumference && <GrowthChart metric="headc" title={labels.headCircForAge} sex={patient.sex} reference={chartReference("headc")} points={chartPoint("headc")} unit="cm" yLabel={labels.headCircAxis} />}
          </section>

          <section className="longitudinal">
            <div className="panel-heading">
              <div><h2>{labels.longitudinalTracking}</h2><p>{d(displayedVisits.length)} {displayedVisits.length === 1 ? labels.savedVisit : labels.savedVisits} {labels.visitsInWorkspace}</p></div>
              <div className="heading-actions">
                <InfoButton label={labels.showFormula} onClick={() => setFormulaInfo({ title: "Growth Velocity", body: "Weight velocity = change in weight between two saved visits / days between visits, reported as grams/day. Height velocity = change in length or height / days between visits x 365.25, reported as cm/year. Head circumference velocity is reported as cm/month." })} />
              </div>
            </div>
            <div className="visit-list">
              {displayedVisits.map((visit) => (
                <button key={visit.id} onClick={() => setDraft(visit)}>
                  <strong>{formatDisplayDate(visit.date, language)}</strong>
                  <span>{visit.weightKg !== undefined ? d(visit.weightKg) : "-"} kg</span>
                  <span>{visit.heightCm !== undefined ? d(visit.heightCm) : "-"} cm</span>
                </button>
              ))}
            </div>
            <div className="velocity-list">
              {velocities.map((v) => (
                <div key={v.interval}>
                  <span>{v.interval}</span>
                  <strong>{v.weight !== undefined ? `${d(round(v.weight, 1))} g/day` : "-"}</strong>
                  <strong>{v.height !== undefined ? `${d(round(v.height, 1))} cm/yr` : "-"}</strong>
                  <strong>{v.head !== undefined ? `${d(round(v.head, 2))} cm/mo HC` : "-"}</strong>
                </div>
              ))}
            </div>
          </section>
        </section>
      </section>
      {formulaInfo && <FormulaModal title={formulaInfo.title} body={formulaInfo.body} labels={labels} onClose={() => setFormulaInfo(null)} />}
    </main>
  );
}

function NumberField({ label, value, step = 0.1, disabled = false, title, set }: { label: string; value?: number; step?: number; disabled?: boolean; title?: string; set: (value: number | undefined) => void }) {
  const language = typeof document !== "undefined" && document.documentElement.lang === "fa" ? "fa" : "en";
  return (
    <label title={title}>
      {label}
      <input
        type="text"
        inputMode={step === 1 ? "numeric" : "decimal"}
        value={value === undefined ? "" : localizeDigits(value, language)}
        disabled={disabled}
        onChange={(e) => {
          const normalized = normalizeDigits(e.target.value).replace(/,/g, ".");
          set(normalized.trim() === "" ? undefined : Number(normalized));
        }}
      />
    </label>
  );
}

function JalaliDatePicker({
  label,
  value,
  labels,
  yearStart,
  yearEnd,
  onChange,
}: {
  label: string;
  value: { year: number; month: number; day: number };
  labels: UiLabels;
  yearStart: number;
  yearEnd: number;
  onChange: (value: { year: number; month: number; day: number }) => void;
}) {
  const years = Array.from({ length: Math.max(1, yearEnd - yearStart + 1) }, (_, index) => yearEnd - index);
  const days = Array.from({ length: 31 }, (_, index) => index + 1);
  const language = typeof document !== "undefined" && document.documentElement.lang === "fa" ? "fa" : "en";
  return (
    <label className="jalali-picker">
      {label}
      <div>
        <select value={value.year} aria-label={labels.year} onChange={(event) => onChange({ ...value, year: Number(event.target.value) })}>
          {years.map((year) => <option key={year} value={year}>{localizeDigits(year, language)}</option>)}
        </select>
        <select value={value.month} aria-label={labels.month} onChange={(event) => onChange({ ...value, month: Number(event.target.value) })}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{localizeDigits(month, language)}</option>)}
        </select>
        <select value={value.day} aria-label={labels.day} onChange={(event) => onChange({ ...value, day: Number(event.target.value) })}>
          {days.map((day) => <option key={day} value={day}>{localizeDigits(day, language)}</option>)}
        </select>
      </div>
    </label>
  );
}

function Metric({ title, value, detail, onInfo, infoLabel }: { title: string; value: string; detail: string; onInfo?: () => void; infoLabel?: string }) {
  return <div className="metric"><span>{title} {onInfo && <InfoButton onClick={onInfo} label={infoLabel} />}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function VitalDetail({ title, value, status, detail }: { title: string; value: string; status: string; detail: string }) {
  return <div className="vital-detail"><span>{title}</span><strong>{value}</strong><small>{status}</small><p>{detail}</p></div>;
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return <div className="profile-item"><span>{label}</span><strong>{value}</strong></div>;
}

function LanguageSwitch({ language, setLanguage, label }: { language: Language; setLanguage: (language: Language) => void; label: string }) {
  return (
    <button className="language-switch" onClick={() => setLanguage(language === "fa" ? "en" : "fa")} aria-label={label} title={label}>
      <Globe2 size={17} />
      {language === "fa" ? "FA" : "EN"}
    </button>
  );
}

function ThemeSwitch({ theme, setTheme, labels }: { theme: Theme; setTheme: (theme: Theme) => void; labels: UiLabels }) {
  return (
    <button className="theme-switch" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={labels.theme} aria-label={labels.theme}>
      {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
      <span>{theme === "dark" ? labels.darkTheme : labels.lightTheme}</span>
    </button>
  );
}

function SideNav({
  active,
  labels,
  language,
  setLanguage,
  theme,
  setTheme,
}: {
  active: "patients" | "visits" | "assessment";
  labels: UiLabels;
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}) {
  return (
    <aside className="side-nav" aria-label="Application navigation">
      <nav>
        <div className={`side-nav-item ${active === "patients" ? "active" : ""}`} title={labels.patients} aria-label={labels.patients}>
          <Users size={18} />
          <span>{labels.patients}</span>
        </div>
        <div className={`side-nav-item ${active === "visits" ? "active" : ""}`} title={labels.visits} aria-label={labels.visits}>
          <Activity size={18} />
          <span>{labels.visits}</span>
        </div>
        <div className={`side-nav-item ${active === "assessment" ? "active" : ""}`} title={labels.assessment} aria-label={labels.assessment}>
          <Stethoscope size={18} />
          <span>{labels.assessment}</span>
        </div>
      </nav>
      <div className="side-nav-controls">
        <LanguageSwitch language={language} setLanguage={setLanguage} label={labels.language} />
        <ThemeSwitch theme={theme} setTheme={setTheme} labels={labels} />
      </div>
    </aside>
  );
}

function InfoButton({ onClick, label = "Show formula" }: { onClick: () => void; label?: string }) {
  return <button className="info-button" onClick={onClick} title={label} aria-label={label}><HelpCircle size={15} /></button>;
}

function FormulaModal({ title, body, labels, onClose }: { title: string; body: string; labels: UiLabels; onClose: () => void }) {
  return (
    <div className="formula-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="formula-card">
        <div className="panel-heading">
          <div><h2>{title}</h2><p>{labels.calculationNote}</p></div>
          <button className="icon-button" onClick={onClose} title={labels.close} aria-label={labels.close}>x</button>
        </div>
        <p>{body}</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && (window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      // The app still works normally if PWA registration is unavailable.
    });
  });
}
