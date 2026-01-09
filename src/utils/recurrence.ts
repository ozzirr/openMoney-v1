export type Frequency = "WEEKLY" | "MONTHLY" | "YEARLY";

export type RecurrenceRule = {
  frequency: Frequency;
  interval: number;
  timesPerPeriod?: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseISODate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

export function formatISODate(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISODate(iso);
  const date = new Date(y, m - 1, d + days);
  return formatISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function addMonthsClamped(iso: string, months: number, targetDay?: number): string {
  const { y, m, d } = parseISODate(iso);
  const baseTotal = y * 12 + (m - 1);
  const nextTotal = baseTotal + months;
  const nextY = Math.floor(nextTotal / 12);
  const nextM = (nextTotal % 12) + 1;
  const dayTarget = targetDay ?? d;
  const day = Math.min(dayTarget, daysInMonth(nextY, nextM));
  return formatISODate(nextY, nextM, day);
}

export function addYearsClamped(iso: string, years: number): string {
  const { y, m, d } = parseISODate(iso);
  const nextY = y + years;
  const day = Math.min(d, daysInMonth(nextY, m));
  return formatISODate(nextY, m, day);
}

export function diffDays(aIso: string, bIso: string): number {
  const a = parseISODate(aIso);
  const b = parseISODate(bIso);
  const aUtc = Date.UTC(a.y, a.m - 1, a.d);
  const bUtc = Date.UTC(b.y, b.m - 1, b.d);
  return Math.trunc((bUtc - aUtc) / MS_PER_DAY);
}

function compareIso(aIso: string, bIso: string): number {
  if (aIso === bIso) return 0;
  return aIso < bIso ? -1 : 1;
}

function normalizeRule(rule: RecurrenceRule): RecurrenceRule {
  if (rule.timesPerPeriod && rule.timesPerPeriod > 1) {
    console.warn("timesPerPeriod > 1 non supportato, uso 1.");
  }
  return {
    frequency: rule.frequency,
    interval: rule.interval > 0 ? rule.interval : 1,
    timesPerPeriod: 1,
  };
}

export function nextOccurrence(
  startDateIso: string,
  rule: RecurrenceRule,
  fromDateIso: string
): string {
  const safeRule = normalizeRule(rule);
  const interval = safeRule.interval;

  if (compareIso(fromDateIso, startDateIso) <= 0) {
    return startDateIso;
  }

  if (safeRule.frequency === "WEEKLY") {
    const periodDays = 7 * interval;
    const diff = diffDays(startDateIso, fromDateIso);
    const jumps = Math.ceil(diff / periodDays);
    return addDays(startDateIso, jumps * periodDays);
  }

  if (safeRule.frequency === "MONTHLY") {
    const start = parseISODate(startDateIso);
    const from = parseISODate(fromDateIso);
    const startTotal = start.y * 12 + (start.m - 1);
    const fromTotal = from.y * 12 + (from.m - 1);
    const monthsDiff = Math.max(0, fromTotal - startTotal);
    const baseJumps = Math.floor(monthsDiff / interval);
    const targetDay = start.d;
    let candidate = addMonthsClamped(startDateIso, baseJumps * interval, targetDay);
    while (compareIso(candidate, fromDateIso) < 0) {
      candidate = addMonthsClamped(candidate, interval, targetDay);
    }
    return candidate;
  }

  const start = parseISODate(startDateIso);
  const from = parseISODate(fromDateIso);
  const yearsDiff = Math.max(0, from.y - start.y);
  const baseJumps = Math.floor(yearsDiff / interval);
  let candidate = addYearsClamped(startDateIso, baseJumps * interval);
  while (compareIso(candidate, fromDateIso) < 0) {
    candidate = addYearsClamped(candidate, interval);
  }
  return candidate;
}

export function generateOccurrences(
  startDateIso: string,
  rule: RecurrenceRule,
  fromDateIso: string,
  count: number
): string[] {
  const results: string[] = [];
  let cursor = fromDateIso;

  for (let i = 0; i < count; i += 1) {
    const next = nextOccurrence(startDateIso, rule, cursor);
    results.push(next);
    cursor = addDays(next, 1);
  }

  return results;
}
