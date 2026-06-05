import cdcRaw from "../data/CDCref_d.csv?raw";
import whoRaw from "../data/WHOref_d.csv?raw";
import olsenRaw from "../data/olsen_lms.csv?raw";
import { lerp, percentileFromZ, valueFromLms, zFromLms } from "./math";

export type Sex = "male" | "female";
export type MetricKey = "weight" | "height" | "bmi" | "headc" | "wfl";
export type ReferenceName = "WHO 0-24 months" | "WHO 0-5 years" | "CDC 2-20 years" | "Olsen preterm";

export type Score = {
  metric: MetricKey;
  label: string;
  value: number;
  unit: string;
  z?: number;
  percentile?: number;
  reference?: ReferenceName;
};

type Row = Record<string, string>;
type Lms = { l: number; m: number; s: number };

const sexCode = (sex: Sex) => (sex === "male" ? 1 : 2);

function parseCsv(raw: string): Row[] {
  const [headerLine, ...lines] = raw.trim().split(/\r?\n/);
  const headers = headerLine.split(",").map((h) => h.trim());
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(headers.map((h, index) => [h, cells[index]?.trim() ?? ""]));
  });
}

const whoRows = parseCsv(whoRaw);
const cdcRows = parseCsv(cdcRaw);
const olsenRows = parseCsv(olsenRaw);

function num(row: Row, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : Number.NaN;
}

function score(metric: MetricKey, label: string, value: number, unit: string, lms?: Lms, reference?: ReferenceName): Score {
  if (!lms) return { metric, label, value, unit };
  const z = zFromLms(value, lms.l, lms.m, lms.s);
  return { metric, label, value, unit, z, percentile: percentileFromZ(z), reference };
}

function whoForAge(sex: Sex, ageDays: number, metric: MetricKey): Lms | undefined {
  const prefix = metric === "weight" ? "wei" : metric === "height" ? "len" : metric === "headc" ? "headc" : metric === "bmi" ? "bmi" : "";
  if (!prefix) return undefined;
  const row = whoRows.find((r) => Number(r.sex) === sexCode(sex) && Number(r._agedays) === Math.round(ageDays));
  if (!row) return undefined;
  return { l: num(row, `_${prefix}_l`), m: num(row, `_${prefix}_m`), s: num(row, `_${prefix}_s`) };
}

function whoWfl(sex: Sex, lengthCm: number): Lms | undefined {
  const target = Math.round(lengthCm * 10) / 10;
  const rows = whoRows
    .filter((r) => Number(r.sex) === sexCode(sex) && r._denom === "forlen" && Number.isFinite(Number(r._len)))
    .sort((a, b) => Number(a._len) - Number(b._len));
  const exact = rows.find((r) => Math.abs(Number(r._len) - target) < 0.05);
  const row = exact ?? rows.reduce((best, r) => (Math.abs(Number(r._len) - target) < Math.abs(Number(best._len) - target) ? r : best), rows[0]);
  if (!row) return undefined;
  return { l: num(row, "_wfl_l"), m: num(row, "_wfl_m"), s: num(row, "_wfl_s") };
}

function cdcForAge(sex: Sex, ageMonths: number, metric: MetricKey): Lms | undefined {
  const row = cdcRows.find((r) => r.denom === "age" && Number(r.SEX) === sexCode(sex) && ageMonths >= num(r, "_AGEMOS1") && ageMonths < num(r, "_AGEMOS2"));
  if (!row) return undefined;
  const t = (ageMonths - num(row, "_AGEMOS1")) / (num(row, "_AGEMOS2") - num(row, "_AGEMOS1"));
  const prefix = metric === "weight" ? "WT" : metric === "height" ? "HT" : metric === "headc" ? "HC" : metric === "bmi" ? "BMI" : "";
  if (!prefix) return undefined;
  return {
    l: lerp(num(row, `_L${prefix}1`), num(row, `_L${prefix}2`), t),
    m: lerp(num(row, `_M${prefix}1`), num(row, `_M${prefix}2`), t),
    s: lerp(num(row, `_S${prefix}1`), num(row, `_S${prefix}2`), t),
  };
}

export function predictedHeightAt18FromZ(sex: Sex, z?: number): number | undefined {
  if (z === undefined || !Number.isFinite(z)) return undefined;
  const lms = cdcForAge(sex, 216, "height");
  return lms ? valueFromLms(z, lms.l, lms.m, lms.s) : undefined;
}

function cdcWfl(sex: Sex, heightCm: number): Lms | undefined {
  const rows = cdcRows.filter((r) => r.denom === "length" && Number(r.SEX) === sexCode(sex) && Number.isFinite(num(r, "_LG1"))).sort((a, b) => num(a, "_LG1") - num(b, "_LG1"));
  const row = rows.find((r) => heightCm >= num(r, "_LG1") && heightCm < num(r, "_LG2"));
  if (!row) return undefined;
  const t = (heightCm - num(row, "_LG1")) / (num(row, "_LG2") - num(row, "_LG1"));
  return {
    l: lerp(num(row, "_LWLG1"), num(row, "_LWLG2"), t),
    m: lerp(num(row, "_MWLG1"), num(row, "_MWLG2"), t),
    s: lerp(num(row, "_SWLG1"), num(row, "_SWLG2"), t),
  };
}

function olsenForGestation(sex: Sex, gaWeeks: number, metric: "weight" | "height" | "headc"): Lms | undefined {
  const rows = olsenRows
    .filter((r) => Number(r.sex) === sexCode(sex) && r.measure === (metric === "height" ? "length" : metric))
    .sort((a, b) => Number(a.ga_weeks) - Number(b.ga_weeks));
  const lower = [...rows].reverse().find((r) => Number(r.ga_weeks) <= gaWeeks);
  const upper = rows.find((r) => Number(r.ga_weeks) >= gaWeeks);
  if (!lower || !upper) return undefined;
  if (lower === upper) return { l: num(lower, "l"), m: num(lower, "m"), s: num(lower, "s") };
  const t = (gaWeeks - num(lower, "ga_weeks")) / (num(upper, "ga_weeks") - num(lower, "ga_weeks"));
  return { l: lerp(num(lower, "l"), num(upper, "l"), t), m: lerp(num(lower, "m"), num(upper, "m"), t), s: lerp(num(lower, "s"), num(upper, "s"), t) };
}

export function referenceForAge(ageMonths: number, gestationalAgeWeeks: number, correctedMonths: number): ReferenceName {
  if (gestationalAgeWeeks < 37 && correctedMonths < 0.5) return "Olsen preterm";
  if (ageMonths < 24) return "WHO 0-24 months";
  return "CDC 2-20 years";
}

export function calculateScores(args: {
  sex: Sex;
  ageDays: number;
  ageMonths: number;
  correctedDays: number;
  correctedMonths: number;
  gestationalAgeWeeks: number;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
}): Score[] {
  const ref = referenceForAge(args.ageMonths, args.gestationalAgeWeeks, args.correctedMonths);
  const bmi = args.weightKg && args.heightCm ? args.weightKg / Math.pow(args.heightCm / 100, 2) : undefined;
  const useAgeDays = args.gestationalAgeWeeks < 37 && args.ageMonths < 24 ? args.correctedDays : args.ageDays;
  const useAgeMonths = args.gestationalAgeWeeks < 37 && args.ageMonths < 24 ? args.correctedMonths : args.ageMonths;
  const lmsFor = (metric: MetricKey) => {
    if (ref === "Olsen preterm" && (metric === "weight" || metric === "height" || metric === "headc")) {
      return olsenForGestation(args.sex, args.gestationalAgeWeeks + args.ageDays / 7, metric);
    }
    if (metric === "headc" && useAgeDays <= 1856) return whoForAge(args.sex, useAgeDays, "headc");
    if (ref === "WHO 0-24 months") return metric === "wfl" && args.heightCm ? whoWfl(args.sex, args.heightCm) : whoForAge(args.sex, useAgeDays, metric);
    return metric === "wfl" && args.heightCm ? cdcWfl(args.sex, args.heightCm) : cdcForAge(args.sex, useAgeMonths, metric);
  };

  return [
    args.weightKg ? score("weight", "Weight-for-age", args.weightKg, "kg", lmsFor("weight"), ref) : undefined,
    args.heightCm ? score("height", args.ageMonths < 24 ? "Length-for-age" : "Height-for-age", args.heightCm, "cm", lmsFor("height"), ref) : undefined,
    args.weightKg && args.heightCm ? score("wfl", args.ageMonths < 24 ? "Weight-for-length" : "Weight-for-height", args.weightKg, "kg", lmsFor("wfl"), ref) : undefined,
    bmi ? score("bmi", "BMI-for-age", bmi, "kg/m2", lmsFor("bmi"), ref) : undefined,
    args.headCircumferenceCm ? score("headc", "Head circumference-for-age", args.headCircumferenceCm, "cm", lmsFor("headc"), args.correctedMonths <= 60 ? "WHO 0-5 years" : ref) : undefined,
  ].filter(Boolean) as Score[];
}

export function curve(metric: MetricKey, sex: Sex, reference: ReferenceName, percentileZs = [-1.8808, -1.2816, 0, 1.2816, 1.8808]) {
  const labels = ["3rd", "10th", "50th", "90th", "97th"];
  if (reference === "WHO 0-24 months" || reference === "WHO 0-5 years") {
    const maxMonth = reference === "WHO 0-5 years" ? 60 : 24;
    return Array.from({ length: maxMonth * 4 + 1 }, (_, index) => {
      const month = index / 4;
      const day = Math.round(month * 30.4375);
      const lms = metric === "wfl" ? undefined : whoForAge(sex, day, metric);
      return Object.fromEntries([["x", month], ...percentileZs.map((z, i) => [labels[i], lms ? valueFromLms(z, lms.l, lms.m, lms.s) : undefined])]);
    });
  }
  if (reference === "CDC 2-20 years") {
    return Array.from({ length: 217 }, (_, i) => i + 24).map((month) => {
      const lms = metric === "wfl" ? undefined : cdcForAge(sex, month, metric);
      return Object.fromEntries([["x", month], ...percentileZs.map((z, idx) => [labels[idx], lms ? valueFromLms(z, lms.l, lms.m, lms.s) : undefined])]);
    });
  }
  return Array.from({ length: 14 }, (_, i) => i + 23).map((ga) => {
    const lms = metric === "wfl" || metric === "bmi" ? undefined : olsenForGestation(sex, ga, metric === "height" ? "height" : metric);
    return Object.fromEntries([["x", ga], ...percentileZs.map((z, idx) => [labels[idx], lms ? valueFromLms(z, lms.l, lms.m, lms.s) : undefined])]);
  });
}
