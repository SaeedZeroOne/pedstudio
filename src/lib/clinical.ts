import type { Score, Sex } from "./growth";

export type Visit = {
  id: string;
  date: string;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  respiratoryRate?: number;
  chiefComplaint?: string;
  detailedComplaint?: string;
  diagnosis?: string;
  physicianNote?: string;
  followUpDate?: string;
  followUpPlan?: string;
};

export type BpMethod = "estimate" | "table";

export function interpretScores(scores: Score[], visits: Visit[]) {
  const alerts: { title: string; detail: string; tone: "danger" | "warn" | "info" }[] = [];
  const byMetric = new Map(scores.map((s) => [s.metric, s]));
  const bmi = byMetric.get("bmi");
  const weight = byMetric.get("weight");
  const height = byMetric.get("height");
  const head = byMetric.get("headc");

  if (weight?.percentile !== undefined && weight.percentile < 5) alerts.push({ title: "Underweight", detail: "Weight-for-age is below the 5th percentile.", tone: "warn" });
  if (bmi?.percentile !== undefined && bmi.percentile < 5) alerts.push({ title: "Low BMI", detail: "BMI-for-age is below the 5th percentile.", tone: "warn" });
  if (bmi?.percentile !== undefined && bmi.percentile >= 95) alerts.push({ title: "Obesity range", detail: "BMI-for-age is at or above the 95th percentile.", tone: "danger" });
  if (bmi?.percentile !== undefined && bmi.percentile >= 85 && bmi.percentile < 95) alerts.push({ title: "Overweight range", detail: "BMI-for-age is between the 85th and 95th percentiles.", tone: "warn" });
  if (height?.percentile !== undefined && height.percentile < 3) alerts.push({ title: "Short stature", detail: "Stature-for-age is below the 3rd percentile.", tone: "warn" });
  if (height?.percentile !== undefined && height.percentile > 97) alerts.push({ title: "Tall stature", detail: "Stature-for-age is above the 97th percentile.", tone: "info" });
  if (head?.percentile !== undefined && head.percentile < 3) alerts.push({ title: "Microcephaly range", detail: "Head circumference is below the 3rd percentile.", tone: "warn" });
  if (head?.percentile !== undefined && head.percentile > 97) alerts.push({ title: "Macrocephaly range", detail: "Head circumference is above the 97th percentile.", tone: "warn" });

  if (visits.length >= 2) {
    const latest = visits[visits.length - 1];
    const prior = visits[visits.length - 2];
    const days = Math.max(1, (new Date(latest.date).getTime() - new Date(prior.date).getTime()) / 86400000);
    if (latest.weightKg && prior.weightKg) {
      const gPerDay = ((latest.weightKg - prior.weightKg) * 1000) / days;
      if (gPerDay < 5) alerts.push({ title: "Growth faltering screen", detail: `Recent weight velocity is ${gPerDay.toFixed(1)} g/day. Review intake, illness, and measurement reliability.`, tone: "warn" });
    }
  }

  return alerts;
}

export function growthVelocity(visits: Visit[]) {
  if (visits.length < 2) return [];
  return visits.slice(1).map((visit, index) => {
    const prev = visits[index];
    const days = Math.max(1, (new Date(visit.date).getTime() - new Date(prev.date).getTime()) / 86400000);
    return {
      interval: `${prev.date} to ${visit.date}`,
      weight: visit.weightKg && prev.weightKg ? ((visit.weightKg - prev.weightKg) * 1000) / days : undefined,
      height: visit.heightCm && prev.heightCm ? ((visit.heightCm - prev.heightCm) / days) * 365.25 : undefined,
      head: visit.headCircumferenceCm && prev.headCircumferenceCm ? ((visit.headCircumferenceCm - prev.headCircumferenceCm) / days) * 30.4375 : undefined,
    };
  });
}

export function targetHeight(sex: Sex, motherCm?: number, fatherCm?: number) {
  if (!motherCm || !fatherCm) return undefined;
  const mid = sex === "male" ? (motherCm + fatherCm + 13) / 2 : (motherCm + fatherCm - 13) / 2;
  return { mid, low: mid - 8.5, high: mid + 8.5 };
}

export function predictedAdultHeight(sex: Sex, ageYears: number, heightCm?: number, motherCm?: number, fatherCm?: number) {
  if (!heightCm) return undefined;
  const target = targetHeight(sex, motherCm, fatherCm)?.mid;
  const maturityFactor = Math.min(0.92, Math.max(0.48, 0.52 + ageYears * 0.028));
  const projection = heightCm / maturityFactor;
  return target ? projection * 0.65 + target * 0.35 : projection;
}

export function heartRateRange(ageYears: number) {
  if (ageYears < 1) return { low: 100, high: 180, label: "Infant" };
  if (ageYears < 3) return { low: 90, high: 160, label: "Toddler" };
  if (ageYears < 6) return { low: 80, high: 140, label: "Preschool" };
  if (ageYears < 12) return { low: 70, high: 120, label: "School age" };
  return { low: 60, high: 100, label: "Adolescent" };
}

export function respiratoryRateRange(ageYears: number) {
  if (ageYears < 2 / 12) return { low: 30, high: 60, label: "<2 months" };
  if (ageYears < 1) return { low: 30, high: 50, label: "2-12 months" };
  if (ageYears < 2) return { low: 24, high: 40, label: "1-2 years" };
  if (ageYears < 5) return { low: 22, high: 30, label: "2-5 years" };
  if (ageYears < 12) return { low: 18, high: 25, label: "5-12 years" };
  return { low: 12, high: 20, label: "Adolescent" };
}

const bpScreeningTable: Record<number, { male: { systolic: number; diastolic: number }; female: { systolic: number; diastolic: number } }> = {
  1: { male: { systolic: 98, diastolic: 52 }, female: { systolic: 98, diastolic: 54 } },
  2: { male: { systolic: 100, diastolic: 55 }, female: { systolic: 101, diastolic: 58 } },
  3: { male: { systolic: 101, diastolic: 58 }, female: { systolic: 102, diastolic: 60 } },
  4: { male: { systolic: 102, diastolic: 60 }, female: { systolic: 103, diastolic: 62 } },
  5: { male: { systolic: 103, diastolic: 63 }, female: { systolic: 104, diastolic: 64 } },
  6: { male: { systolic: 105, diastolic: 66 }, female: { systolic: 105, diastolic: 67 } },
  7: { male: { systolic: 106, diastolic: 68 }, female: { systolic: 106, diastolic: 68 } },
  8: { male: { systolic: 107, diastolic: 69 }, female: { systolic: 107, diastolic: 69 } },
  9: { male: { systolic: 107, diastolic: 70 }, female: { systolic: 108, diastolic: 71 } },
  10: { male: { systolic: 108, diastolic: 72 }, female: { systolic: 109, diastolic: 72 } },
  11: { male: { systolic: 110, diastolic: 74 }, female: { systolic: 111, diastolic: 74 } },
  12: { male: { systolic: 113, diastolic: 75 }, female: { systolic: 114, diastolic: 75 } },
};

export function bloodPressureScreeningTable(ageYears: number, sex: Sex) {
  if (ageYears >= 13) return { systolic: 120, diastolic: 80, label: "AAP adolescent screening" };
  const age = Math.min(12, Math.max(1, Math.floor(ageYears)));
  const row = bpScreeningTable[age][sex];
  return { ...row, label: `AAP simplified screening table, age ${age}` };
}

export function bloodPressureThresholds(ageYears: number, sex: Sex, heightPercentile?: number) {
  const hp = Math.min(99, Math.max(1, heightPercentile ?? 50));
  const maleAdj = sex === "male" ? 2 : 0;
  if (ageYears >= 13) {
    return { systolic90: 120, diastolic90: 80, systolic95: 130, diastolic95: 80, systolicStage2: 140, diastolicStage2: 90, heightPercentile: hp };
  }
  const systolic95 = 96 + ageYears * 1.8 + hp * 0.08 + maleAdj;
  const diastolic95 = 57 + ageYears * 0.9 + hp * 0.04;
  return {
    systolic90: systolic95 - 6,
    diastolic90: diastolic95 - 5,
    systolic95,
    diastolic95,
    systolicStage2: systolic95 + 12,
    diastolicStage2: diastolic95 + 12,
    heightPercentile: hp,
  };
}

export function bloodPressureCategory(ageYears: number, sex: Sex, heightPercentile?: number, systolic?: number, diastolic?: number, method: BpMethod = "estimate") {
  if (!systolic || !diastolic) return { category: "Not recorded", detail: "Enter systolic and diastolic blood pressure." };
  if (method === "table") {
    const screen = bloodPressureScreeningTable(ageYears, sex);
    if (systolic >= screen.systolic || diastolic >= screen.diastolic) {
      return { category: "Needs evaluation", detail: `${screen.label}: evaluate if >=${screen.systolic}/${screen.diastolic} mmHg.` };
    }
    return { category: "Below screening threshold", detail: `${screen.label}: below ${screen.systolic}/${screen.diastolic} mmHg.` };
  }
  const bp = bloodPressureThresholds(ageYears, sex, heightPercentile);
  if (systolic >= bp.systolicStage2 || diastolic >= bp.diastolicStage2) return { category: "Stage 2 hypertension", detail: `Stage 2 threshold: >=${bp.systolicStage2.toFixed(0)}/${bp.diastolicStage2.toFixed(0)} mmHg.` };
  if (systolic >= bp.systolic95 || diastolic >= bp.diastolic95) return { category: "Hypertension", detail: `95th percentile threshold: >=${bp.systolic95.toFixed(0)}/${bp.diastolic95.toFixed(0)} mmHg.` };
  if (systolic >= bp.systolic90 || diastolic >= bp.diastolic90) return { category: "Elevated", detail: `90th percentile threshold: >=${bp.systolic90.toFixed(0)}/${bp.diastolic90.toFixed(0)} mmHg.` };
  return { category: "Normal", detail: `Below elevated threshold of ${bp.systolic90.toFixed(0)}/${bp.diastolic90.toFixed(0)} mmHg.` };
}

export function vitalInterpretation(ageYears: number, sex: Sex, heightPercentile?: number, systolic?: number, diastolic?: number, heartRate?: number, respiratoryRate?: number, bpMethod: BpMethod = "estimate") {
  const findings: string[] = [];
  if (heartRate) {
    const { low, high } = heartRateRange(ageYears);
    if (heartRate < low) findings.push(`Heart rate below expected range (${low}-${high}/min).`);
    if (heartRate > high) findings.push(`Heart rate above expected range (${low}-${high}/min).`);
  }
  if (respiratoryRate) {
    const { low, high } = respiratoryRateRange(ageYears);
    if (respiratoryRate < low) findings.push(`Respiratory rate below expected range (${low}-${high}/min).`);
    if (respiratoryRate > high) findings.push(`Respiratory rate above expected range (${low}-${high}/min).`);
  }
  if (systolic && diastolic) {
    const bp = bloodPressureCategory(ageYears, sex, heightPercentile, systolic, diastolic, bpMethod);
    if (bp.category === "Stage 2 hypertension") findings.push("Blood pressure is in stage 2 hypertension range.");
    else if (bp.category === "Hypertension") findings.push("Blood pressure is in hypertension range.");
    else if (bp.category === "Elevated") findings.push("Blood pressure is elevated for age/sex/height.");
    else if (bp.category === "Needs evaluation") findings.push("Blood pressure meets AAP simplified screening threshold for further evaluation.");
  }
  return findings;
}
