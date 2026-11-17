const FR_TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const FR_DAY_MONTH = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });
const FR_MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const FR_MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long' });

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const WEEKDAYS_LONG = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
];

export function capitalize(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const offset = (copy.getDay() + 6) % 7;
  return addDays(copy, -offset);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** 6 weeks x 7 days grid starting on a Monday, covering the whole month. */
export function monthGrid(cursor: Date): Date[] {
  const first = startOfWeek(startOfMonth(cursor));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

export function weekDays(cursor: Date): Date[] {
  const first = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseTime(value: string | null | undefined): number {
  const date = parseDate(value);
  return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? parseDate(value) : value;
  if (!date) return '--:--';
  return FR_TIME.format(date);
}

export function formatMonthYear(date: Date): string {
  return capitalize(FR_MONTH_YEAR.format(date));
}

export function formatMonthShort(date: Date): string {
  return capitalize(FR_MONTH.format(date));
}

export function formatDayMonth(value: string | Date): string {
  const date = typeof value === 'string' ? parseDate(value) : value;
  if (!date) return '—';
  return FR_DAY_MONTH.format(date);
}

export function formatWeekRange(cursor: Date): string {
  const start = startOfWeek(cursor);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = sameMonth
    ? String(start.getDate())
    : `${start.getDate()} ${formatMonthShort(start).toLowerCase()}`;
  return `${startLabel} – ${end.getDate()} ${formatMonthShort(end).toLowerCase()} ${end.getFullYear()}`;
}

export function monthKeyOf(value: Date | string): string {
  const date = typeof value === 'string' ? parseDate(value) : value;
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Local `datetime-local` value (no timezone shift). */
export function toDatetimeLocal(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Move an ISO datetime to another day, keeping its time of day. */
export function mergeDayWithTime(value: string | null, day: Date): string {
  const previous = parseDate(value);
  const hours = previous ? previous.getHours() : 9;
  const minutes = previous ? previous.getMinutes() : 0;
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
  return next.toISOString();
}
