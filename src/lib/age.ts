export type AgeResult = {
  chronologicalDays: number;
  chronologicalMonths: number;
  correctedDays: number;
  correctedMonths: number;
  correctedLabel: string;
  chronologicalLabel: string;
};

const dayMs = 24 * 60 * 60 * 1000;

export function daysBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / dayMs));
}

export function calculateAge(dob: string, visitDate: string, gestationalAgeWeeks: number): AgeResult {
  const chronologicalDays = daysBetween(dob, visitDate);
  const prematurityDays = Math.max(0, Math.round((40 - gestationalAgeWeeks) * 7));
  const correctedDays = Math.max(0, chronologicalDays - prematurityDays);
  return {
    chronologicalDays,
    chronologicalMonths: chronologicalDays / 30.4375,
    correctedDays,
    correctedMonths: correctedDays / 30.4375,
    chronologicalLabel: formatAge(chronologicalDays),
    correctedLabel: formatAge(correctedDays),
  };
}

export function formatAge(days: number): string {
  if (days < 14) return `${days} d`;
  if (days < 90) return `${Math.floor(days / 7)} wk ${days % 7} d`;
  if (days < 730) return `${Math.floor(days / 30.4375)} mo`;
  const years = Math.floor(days / 365.25);
  const months = Math.floor((days - years * 365.25) / 30.4375);
  return `${years} yr ${months} mo`;
}
