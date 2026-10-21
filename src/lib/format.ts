const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateToISO(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayISO(): string {
  return dateToISO(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const date = isoToDate(iso);
  date.setDate(date.getDate() + days);
  return dateToISO(date);
}

export function apiDate(iso: string): string {
  const date = isoToDate(iso);
  return `${pad2(date.getDate())}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

export function longDate(iso: string): string {
  const date = isoToDate(iso);
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function mediumDate(iso: string): string {
  const date = isoToDate(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function dayShort(iso: string): string {
  return DAYS[isoToDate(iso).getDay()];
}

export function bookingLimitISO(days = 10): string {
  return addDaysISO(todayISO(), days);
}

export function trainRunsOn(iso: string, days: string[]): boolean {
  if (!days.length) return true;
  return days.includes(dayShort(iso));
}

export function nextRunningDate(iso: string, days: string[], limit = 10): string | null {
  if (!days.length) return iso;
  let candidate = iso;
  for (let i = 0; i <= limit; i++) {
    if (days.includes(dayShort(candidate))) return candidate;
    candidate = addDaysISO(candidate, 1);
  }
  return null;
}

export function prettyStation(name: string): string {
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function stationKey(name: string): string {
  return name.toLowerCase().replace(/[_\s]+/g, " ").trim();
}

export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  const suffix = (match[3] || "").toLowerCase();
  if (suffix === "pm") hours += 12;
  if (!suffix) {
    // 24-hour clock
    hours = Number(match[1]);
  }
  return hours * 60 + minutes;
}

export function minutesBetween(
  departure: string | null | undefined,
  arrival: string | null | undefined,
): number | null {
  const a = parseClock(departure);
  const b = parseClock(arrival);
  if (a === null || b === null) return null;
  return b >= a ? b - a : b + 1440 - a;
}

export function formatMinutes(total: number | null): string {
  if (total === null || !Number.isFinite(total)) return "—";
  const hours = Math.floor(total / 60);
  const minutes = Math.round(total % 60);
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function stopDuration(routeDuration: string): string {
  const match = routeDuration?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return routeDuration || "—";
  return formatMinutes(Number(match[1]) * 60 + Number(match[2]));
}

export function bdt(value: number): string {
  return `৳${Math.round(value).toLocaleString("en-IN")}`;
}

export function seatsLabel(n: number): string {
  return `${n} seat${n === 1 ? "" : "s"}`;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
